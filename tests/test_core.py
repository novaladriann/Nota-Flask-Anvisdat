import unittest
from datetime import date, timedelta
from nota import store
from nota.demo import PRODUCTS, seed_sales
from nota.forecast import forecast

class SalesTest(unittest.TestCase):
    def setUp(self):
        self.db=store.connect(":memory:")
        self.db.executescript(store.SCHEMA)
        self.db.executemany("INSERT INTO product VALUES(?,?,?,?)",PRODUCTS)
        self.db.commit()
        self.form={"date":"2025-11-01","payment":"QRIS","items":[{"product":"BK01","qty":2},{"product":"PN01","qty":3}]}
    def tearDown(self):
        self.db.close()
    def test_crud_and_stale_edit(self):
        key=store.save(self.db,self.form)
        row=store.sales(self.db)[0]
        self.assertEqual(sum(i["price"]*i["qty"] for i in row["items"]),36500)
        store.save(self.db,dict(self.form,version=1,items=[{"product":"BK01","qty":4}]),key)
        with self.assertRaises(store.Conflict):
            store.save(self.db,{"version":1},key,remove=True)
        self.assertEqual(store.sales(self.db)[0]["version"],2)
        store.save(self.db,{"version":2},key,remove=True)
        self.assertEqual(store.sales(self.db),[])
        self.assertFalse(self.db.execute("SELECT 1 FROM item").fetchone())
    def test_invalid_edit_preserves_items(self):
        key=store.save(self.db,self.form)
        old=store.sales(self.db)
        for items in ([],[{"product":"X","qty":2}],[{"product":"BK01","qty":True}],self.form["items"]*2):
            with self.subTest(items=items),self.assertRaises(ValueError):
                store.save(self.db,dict(self.form,version=1,items=items),key)
        self.assertEqual(store.sales(self.db),old)
    def test_invalid_day_and_payment(self):
        for patch in ({"date":"2001-02-29"},{"date":"2099-01-01"},{"payment":"?"}):
            with self.assertRaises(ValueError):
                store.save(self.db,self.form|patch)
    def test_seed_once_and_keep_deletions(self):
        other=store.connect(":memory:")
        try:
            store.initialize(other)
            self.assertEqual(len(store.sales(other)),len(seed_sales()))
            with other: other.execute("DELETE FROM sale")
            store.initialize(other)
            self.assertEqual(store.sales(other),[])
        finally: other.close()

class ForecastTest(unittest.TestCase):
    def synthetic(self,n):
        start=date(2025,1,1)
        return [dict(date=(start+timedelta(days=i)).isoformat(),items=[dict(qty=1,price=10000+100*i+1000*(i%7))]) for i in range(n)]
    def test_trend_and_season(self):
        f=forecast(self.synthetic(56))
        self.assertEqual(f["mae"],0)
        self.assertEqual(f["baseline"],700)
        self.assertEqual([p["amount"] for p in f["future"]],[s["items"][0]["price"] for s in self.synthetic(63)[56:]])
    def test_holdout_is_unseen(self):
        s=self.synthetic(56)
        for row in s[-7:]:row["items"][0]["price"]+=9999
        self.assertEqual(forecast(s)["mae"],9999)
    def test_missing_days_and_minimum(self):
        self.assertIsNone(forecast([]))
        self.assertIsNone(forecast(self.synthetic(34)))
        rows=self.synthetic(35)
        f=forecast([rows[0],rows[-1]])
        self.assertEqual(f["days"],35)
        self.assertEqual(len(f["future"]),7)
