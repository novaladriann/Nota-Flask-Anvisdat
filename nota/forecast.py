"""OLS with a shared daily trend and a separate intercept for each weekday."""
from datetime import date, timedelta

def fit(values, start):
    weeks = [[] for _ in range(7)]
    for i, value in enumerate(values):
        weeks[(start.weekday() + i) % 7].append((i, value))
    means = [(sum(x for x, y in g)/len(g), sum(y for x, y in g)/len(g)) for g in weeks]
    numerator = denominator = 0
    for group, (mx, my) in zip(weeks, means):
        for x, y in group:
            numerator += (x-mx)*(y-my)
            denominator += (x-mx)**2
    slope = numerator / denominator
    def predict(i):
        mx, my = means[(start.weekday()+i) % 7]
        return max(0, round(my + slope*(i-mx)))
    return predict

def forecast(sales, horizon=7):
    if not sales:
        return None
    totals = {}
    for sale in sales:
        day = date.fromisoformat(sale["date"])
        totals[day] = totals.get(day, 0) + sum(item["price"]*item["qty"] for item in sale["items"])
    end = max(totals)
    start = max(min(totals), end-timedelta(days=364))
    n = (end-start).days + 1
    if n < 35:
        return None
    values = [totals.get(start+timedelta(days=i), 0) for i in range(n)]
    cutoff = n-7
    model = fit(values[:cutoff], start)
    mae = sum(abs(model(i)-values[i]) for i in range(cutoff,n)) / 7
    baseline = sum(abs(values[i-7]-values[i]) for i in range(cutoff,n)) / 7
    final = fit(values, start)
    return dict(days=n, end=end.isoformat(), mae=round(mae), baseline=round(baseline),
                testStart=(end-timedelta(days=6)).isoformat(),
                future=[dict(date=(start+timedelta(days=i)).isoformat(), amount=final(i)) for i in range(n, n + horizon)])
