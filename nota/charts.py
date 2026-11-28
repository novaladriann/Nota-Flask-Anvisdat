"""Figures shared by the Flask API and the standalone demo build."""
from collections import Counter
from datetime import date, timedelta
import json
import pandas as pd
import plotly.express as px


def line_figure(points, prediction=False):
    frame = pd.DataFrame(points, columns=["date", "amount"])
    fig = px.line(frame, x="date", y="amount", markers=True, template="none",
                  labels={"date": "Tanggal", "amount": "Omzet (Rp)"})
    fig.update_traces(line=dict(color="#4e38b8", width=3, dash="dash" if prediction else "solid"),
                      marker=dict(size=6, color="#4e38b8"),
                      fill=None if prediction else "tozeroy", fillcolor="rgba(133,105,241,0.12)")
    fig.update_layout(showlegend=False, margin=dict(l=55, r=14, t=12, b=32),
                      height=230, paper_bgcolor="#fffdf7", plot_bgcolor="#fffdf7",
                      font=dict(family="Arial, sans-serif", color="#211e22", size=12),
                      hoverlabel=dict(bgcolor="#211e22", font_color="white"),
                      clickmode="event", hovermode="closest", dragmode="zoom", selectdirection="h")
    fig.update_xaxes(type="date", title=None, showgrid=False, nticks=5)
    fig.update_yaxes(title=None, rangemode="tozero", gridcolor="#dcd7cf", nticks=5, zeroline=False)
    return json.loads(fig.to_json())


def figures(sales, projection):
    totals = Counter()
    for sale in sales:
        totals[sale["date"]] += sum(item["qty"] * item["price"] for item in sale["items"])
    history = []
    if totals:
        last = date.fromisoformat(max(totals))
        for i in range(89, -1, -1):
            day = (last - timedelta(days=i)).isoformat()
            history.append({"date": day, "amount": totals[day]})
    return {"history": line_figure(history), "forecast": line_figure(projection["future"] if projection else [], True)}
