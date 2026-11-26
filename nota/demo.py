"""Deterministic synthetic sales for the Cirebon stationery case study."""
from datetime import date, timedelta
from random import Random

PRODUCTS = [
    ("BK01", "Buku Tulis A5", "Buku", 8500),
    ("PN01", "Pulpen Gel 0.5", "Alat tulis", 6500),
    ("KT01", "Kertas HVS A4", "Kertas", 55000),
    ("BK02", "Buku Sketsa", "Buku", 28000),
    ("PN02", "Pensil 2B", "Alat tulis", 3500),
    ("AR01", "Map Kancing", "Arsip", 5500),
    ("KT02", "Memo Tempel", "Kertas", 12500),
    ("AR02", "Binder A5", "Arsip", 32000),
    ("PN03", "Stabilo Pastel", "Alat tulis", 11500),
    ("BK03", "Agenda Harian", "Buku", 34000),
]
PAYMENTS = ("Tunai", "QRIS", "Debit")

def seed_sales():
    rng = Random(26)
    sales = []
    for day in range(112):
        on = date(2026, 8, 6) + timedelta(days=day)
        visits = max(2, int(7 + day * .025 + (4 if on.weekday() < 5 else -2) + rng.gauss(0, 2)))
        for _ in range(visits):
            items = []
            for code, _, _, price in rng.sample(PRODUCTS, rng.choices([1, 2, 3], [5, 4, 1])[0]):
                qty = rng.randint(1, 4) + (rng.randint(1, 4) if code in ("BK01", "PN01") else 0)
                items.append(dict(product=code, qty=qty, price=price))
            sales.append(dict(id=len(sales)+1, date=on.isoformat(), payment=rng.choices(PAYMENTS, [4, 5, 1])[0], items=items, version=1))
    return sales
