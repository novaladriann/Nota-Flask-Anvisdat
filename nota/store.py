import sqlite3
from datetime import date, datetime, timedelta, timezone
from .demo import PAYMENTS, PRODUCTS, seed_sales

SCHEMA = """
CREATE TABLE IF NOT EXISTS product(code TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0));
CREATE TABLE IF NOT EXISTS sale(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, payment TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS item(sale_id INTEGER REFERENCES sale(id) ON DELETE CASCADE, product TEXT REFERENCES product(code), qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 999), price INTEGER NOT NULL CHECK(price>0), PRIMARY KEY(sale_id,product));
"""

def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db

def initialize(db):
    db.executescript(SCHEMA)
    with db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM product LIMIT 1").fetchone():
            return
        db.executemany("INSERT INTO product VALUES(?,?,?,?)", PRODUCTS)
        for s in seed_sales():
            db.execute("INSERT INTO sale(id,date,payment) VALUES(?,?,?)", (s["id"],s["date"],s["payment"]))
            db.executemany("INSERT INTO item VALUES(?,?,?,?)", [(s["id"],i["product"],i["qty"],i["price"]) for i in s["items"]])

def sales(db):
    results = {}
    for row in db.execute("SELECT s.*, i.product, i.qty, i.price FROM sale s JOIN item i ON i.sale_id=s.id ORDER BY s.id,i.rowid"):
        if row["id"] not in results:
            results[row["id"]] = {k:row[k] for k in ("id","date","payment","version")}
            results[row["id"]]["items"] = []
        results[row["id"]]["items"].append({k:row[k] for k in ("product","qty","price")})
    return list(results.values())

def today():
    return datetime.now(timezone(timedelta(hours=7))).date()

def validate(payload, catalog, now=None):
    if not isinstance(payload, dict):
        raise ValueError("Format transaksi tidak valid.")
    try:
        day = date.fromisoformat(payload["date"])
        if not date(2000,1,1) <= day <= (now or today()) or day.isoformat() != payload["date"]:
            raise ValueError
    except (KeyError,ValueError,TypeError):
        raise ValueError("Pilih tanggal transaksi antara 1 Januari 2000 dan hari ini.") from None
    if payload.get("payment") not in PAYMENTS:
        raise ValueError("Pilih metode pembayaran yang tersedia.")
    items = payload.get("items")
    if not isinstance(items,list) or not 1 <= len(items) <= len(catalog):
        raise ValueError("Tambahkan sedikitnya satu produk.")
    rows, seen = [], set()
    for item in items:
        if not isinstance(item,dict):
            raise ValueError("Rincian produk tidak valid.")
        code, qty = item.get("product"), item.get("qty")
        if not isinstance(code,str) or code not in catalog or code in seen:
            raise ValueError("Gunakan produk berbeda di setiap baris.")
        if type(qty) is not int or not 1 <= qty <= 999:
            raise ValueError("Jumlah produk harus berupa bilangan bulat 1–999.")
        rows.append((code,qty,catalog[code]))
        seen.add(code)
    return day.isoformat(), payload["payment"], rows

class Conflict(Exception):
    pass

def save(db, payload, sale_id=None, remove=False):
    with db:
        db.execute("BEGIN IMMEDIATE")
        catalog = {r[0]:r[1] for r in db.execute("SELECT code,price FROM product")}
        if sale_id is not None:
            sale = db.execute("SELECT version FROM sale WHERE id=?", (sale_id,)).fetchone()
            if not sale:
                raise KeyError(sale_id)
            if not isinstance(payload,dict) or type(payload.get("version")) is not int or sale[0] != payload["version"]:
                raise Conflict("Transaksi berubah. Tutup formulir dan muat ulang halaman.")
            if remove:
                db.execute("DELETE FROM sale WHERE id=?", (sale_id,))
                return sale_id
            catalog.update(db.execute("SELECT product,price FROM item WHERE sale_id=?", (sale_id,)))
        day, payment, rows = validate(payload, catalog)
        if sale_id is None:
            sale_id = db.execute("INSERT INTO sale(date,payment) VALUES(?,?)",(day,payment)).lastrowid
        else:
            db.execute("UPDATE sale SET date=?,payment=?,version=version+1 WHERE id=?",(day,payment,sale_id))
            db.execute("DELETE FROM item WHERE sale_id=?", (sale_id,))
        db.executemany("INSERT INTO item VALUES(?,?,?,?)", [(sale_id,*r) for r in rows])
    return sale_id
