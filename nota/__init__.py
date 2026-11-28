from pathlib import Path
from . import store
from .forecast import forecast

def create_app(config=None):
    from flask import Flask, g, jsonify, render_template, request
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(DATABASE=str(Path(app.instance_path)/"nota.sqlite3"), MAX_CONTENT_LENGTH=32768)
    if config:
        app.config.update(config)
    Path(app.config["DATABASE"]).parent.mkdir(parents=True,exist_ok=True)
    init_db = store.connect(app.config["DATABASE"])
    try:
        store.initialize(init_db)
    finally:
        init_db.close()

    def db():
        if "db" not in g:
            g.db = store.connect(app.config["DATABASE"])
        return g.db

    @app.teardown_appcontext
    def close_db(error):
        conn = g.pop("db", None)
        if conn is not None:
            conn.close()

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/state")
    def state():
        records = store.sales(db())
        from .charts import figures
        projection = forecast(records, horizon=30)
        return jsonify(figures=figures(records, projection), products=[dict(r) for r in db().execute("SELECT * FROM product")], sales=records, forecast=projection)

    @app.post("/api/sales")
    @app.route("/api/sales/<int:sale_id>",methods=["PUT","DELETE"])
    def change(sale_id=None):
        try:
            ident = store.save(db(),request.get_json(),sale_id,request.method=="DELETE")
        except ValueError as exc:
            return jsonify(error=str(exc)),400
        except KeyError:
            return jsonify(error="Transaksi sudah dihapus."),404
        except store.Conflict as exc:
            return jsonify(error=str(exc)),409
        return jsonify(id=ident),201 if sale_id is None else 200
    return app
