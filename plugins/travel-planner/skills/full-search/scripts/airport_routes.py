"""Road distance and drive time from the arrival airport to every stay (and neighborhood) in trip.json.

Uses the public OSRM demo router (car profile, no traffic). Results are written onto each lodging item as
`airport_km` / `airport_drive_min` and onto each neighborhood the same way; the dashboard map shows them for the
selected stay. A cache file next to trip.json (`work/airport_routes_cache.json`) avoids re-asking for known points.

usage: python airport_routes.py trip.json
"""
import json, os, sys, time, urllib.request

OSRM = "https://router.project-osrm.org/table/v1/driving/"
BATCH = 80


def table(origin, pts):
    coords = ";".join(f"{lng:.5f},{lat:.5f}" for lat, lng in [origin] + pts)
    url = OSRM + coords + "?sources=0&annotations=duration,distance"
    req = urllib.request.Request(url, headers={"User-Agent": "travel-planner-dashboard/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.load(r)
            if d.get("code") == "Ok":
                return d["durations"][0][1:], d["distances"][0][1:]
        except Exception as e:  # network hiccup: retry
            err = e
        time.sleep(2 + attempt * 3)
    raise SystemExit(f"OSRM failed: {err if 'err' in dir() else d.get('code')}")


def main(path):
    t = json.load(open(path, encoding="utf-8"))
    ap = (t.get("trip") or {}).get("arrival_airport") or {}
    if not (ap.get("lat") and ap.get("lng")):
        print("no trip.arrival_airport lat/lng; skipping")
        return
    origin = (ap["lat"], ap["lng"])
    cache_path = os.path.join(os.path.dirname(os.path.abspath(path)), "work", "airport_routes_cache.json")
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}
    key = lambda lat, lng: f"{ap.get('iata', '')}:{lat:.5f},{lng:.5f}"

    targets = [i for i in t.get("items", []) if i.get("category") == "lodging" and i.get("lat") and i.get("lng")]
    targets += [n for n in t.get("neighborhoods", []) if n.get("lat") and n.get("lng")]
    todo = []
    for x in targets:
        k = key(float(x["lat"]), float(x["lng"]))
        if k not in cache and k not in [kk for kk, _ in todo]:
            todo.append((k, (float(x["lat"]), float(x["lng"]))))
    for s in range(0, len(todo), BATCH):
        chunk = todo[s:s + BATCH]
        dur, dist = table(origin, [p for _, p in chunk])
        for (k, _), du, di in zip(chunk, dur, dist):
            if du is not None and di is not None:
                cache[k] = [round(di / 1000, 1), round(du / 60)]
        print(f"routed {min(s + BATCH, len(todo))}/{len(todo)}")
        time.sleep(1.5)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    json.dump(cache, open(cache_path, "w", encoding="utf-8"))

    n = 0
    for x in targets:
        c = cache.get(key(float(x["lat"]), float(x["lng"])))
        if c:
            x["airport_km"], x["airport_drive_min"] = c
            n += 1
    t["trip"]["airport_routes"] = {"source": "OSRM (OpenStreetMap road network), car, no traffic",
                                   "url": "https://project-osrm.org/"}
    json.dump(t, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"airport routes on {n}/{len(targets)} stays and neighborhoods")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "trip.json")
