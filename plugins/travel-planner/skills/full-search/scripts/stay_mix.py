#!/usr/bin/env python3
"""Enforce the stay mix on trip.json, in place (user's standing instruction, Nov 2 2026):
about 70% of the stays are an entire place to yourself; the other 30% are private rooms and only the best Hostelworld hostels.

  python stay_mix.py trip.json            # trim
  python stay_mix.py trip.json --dry-run  # report only

What it does, per neighborhood (all sites and tiers together):
  1. Hostel lines (dorm beds, hostels) from any site other than Hostelworld are dropped unless they are top-rated there
     (8.5/10 or better, 100+ reviews); Hostelworld hostels below that bar are dropped too.
  2. Every entire place is kept.
  3. The other lines (private rooms, hotel rooms, the kept hostels) are limited to 3/7 of the entire places in that
     neighborhood (so entire places are 70% of the total). The best-rated lines are kept (rating / scale, then review
     count), taken round-robin across the four tiers so every tier keeps some choice.
Run it after import_area_stays.py and before ticking default stays. A neighborhood with no entire place keeps up to 5 others.
"""
import argparse
import json
import math
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pick_custom_stay import stay_type  # noqa: E402

TIERS = ["budget", "mid", "upper", "luxury"]


def score(it):
    try:
        r = float(it.get("rating")) / float(it.get("rating_scale") or 10)
    except (TypeError, ValueError):
        r = 0.0
    try:
        n = float(str(it.get("reviews") or 0).replace(",", "").replace("+", ""))
    except ValueError:
        n = 0.0
    return (round(r, 2), n)


def top_hostel(it):
    s = score(it)
    return s[0] >= 0.85 and s[1] >= 100


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("trip_json")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    data = json.load(open(a.trip_json, encoding="utf-8"))
    items = data["items"]
    drop = set()
    by_nb = defaultdict(list)
    for it in items:
        if it.get("category") != "lodging":
            continue
        it["stay_type"] = stay_type(it)
        if it["stay_type"] == "hostel" and not top_hostel(it):
            drop.add(it["id"])
            continue
        by_nb[it.get("neighborhood") or "_none"].append(it)
    report = []
    for nb, lines in by_nb.items():
        ent = [i for i in lines if i["stay_type"] == "entire"]
        oth = [i for i in lines if i["stay_type"] != "entire"]
        cap = math.floor(len(ent) * 3 / 7) if ent else 5
        if len(oth) > cap:
            buckets = {t: sorted([i for i in oth if (i.get("tiers") or ["mid"])[0] == t], key=score, reverse=True) for t in TIERS}
            keep, k = [], 0
            while len(keep) < cap and any(buckets.values()):
                t = TIERS[k % 4]
                k += 1
                if buckets[t]:
                    keep.append(buckets[t].pop(0))
            kept = {i["id"] for i in keep}
            for i in oth:
                if i["id"] not in kept:
                    drop.add(i["id"])
        report.append((nb, len(ent), min(len(oth), cap)))
    for nb, e, o in report:
        tot = e + o
        print(f"  {nb:<16} {e} entire + {o} other = {e / tot:.0%} entire" if tot else f"  {nb}: none")
    print(f"dropping {len(drop)} lodging line(s)")
    if not a.dry_run:
        data["items"] = [i for i in items if i.get("id") not in drop]
        json.dump(data, open(a.trip_json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        left = [i for i in data["items"] if i.get("category") == "lodging"]
        ent = sum(1 for i in left if i["stay_type"] == "entire")
        print(f"{len(left)} stays left, {ent} entire ({ent / max(1, len(left)):.0%})")


if __name__ == "__main__":
    main()
