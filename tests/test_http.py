import tempfile
import unittest
from pathlib import Path
from nota import create_app

class HttpTest(unittest.TestCase):
    def test_full_flow(self):
        with tempfile.TemporaryDirectory() as directory:
            config={"TESTING":True,"DATABASE":str(Path(directory)/"sales.db")}
            client=create_app(config).test_client()
            self.assertEqual(client.get("/").status_code,200)
            with client.get("/static/app.js") as script:
                self.assertEqual(script.status_code,200)
            state=client.get("/api/state").get_json()
            payload=dict(date=state["forecast"]["end"],payment="QRIS",items=[dict(product="BK01",qty=2)])
            result=client.post("/api/sales",json=payload)
            self.assertEqual(result.status_code,201)
            url="/api/sales/"+str(result.get_json()["id"])
            self.assertEqual(client.put(url,json=payload|{"version":1,"payment":"Tunai"}).status_code,200)
            self.assertEqual(client.delete(url,json={"version":1}).status_code,409)
            self.assertEqual(client.delete(url,json={"version":2}).status_code,200)
            self.assertEqual(create_app(config).test_client().get("/api/state").get_json(),state)
