#!/usr/bin/env python3
"""Pick the Custom tab's default stay: an entire place to yourself, in a tourist area with good nightlife.

  python pick_custom_stay.py trip.json            # writes trip.json in place
  python pick_custom_stay.py trip.json --dry-run  # only prints the pick

User's standing rule (Nov 1 2026): the Custom tab's lodging is always a place with no sharing (no hostel, dorm,
shared apartment or private room in someone's home), in a tourist neighborhood with good nightlife.

What it does
  * tags every lodging line `private_place`: "entire" (whole apartment, studio, villa, house; Airbnb "entire
    place"), "hotel" (a private hotel room: nothing shared with other guests but not a whole place) or "shared"
    (hostel, dorm bed, private room in a home or hostel);
  * a neighborhood has good nightlife when it carries the exact tag "Nightlife" (so "Chill nightlife" does not
    count) or `good_nightlife: true`;
  * sets `custom_default: true` on ONE line (and removes it from all others): among "entire" places in those
    neighborhoods with a live price and a strong rating (>= 90% of the scale, then relaxed in steps), the
    cheapest. With no entire place there, it falls back to a private hotel room, then widens to any
    neighborhood, and says so.
The dashboard reads `custom_default` when it builds the Custom tab.
"""
import argparse
import json
import re
import sys

SHARED = re.compile(r"\b(hostel|dorm(itory)?|capsule|bunk|pod|shared|share|bed in|private room|room in|"
                    r"guest ?house room|homestay|co-?living)\b", re.I)
ENTIRE_TYPE = re.compile(r"\b(entire|whole|apartment|villa|house|home|studio|condo|bungalow|cottage|chalet|cabin|"
                         r"flat|townhouse)\b", re.I)


def kind(it):
    prov = (it.get("provider") or "")
    rt = str(it.get("room_type") or "")
    txt = " ".join([rt, it.get("name") or "", it.get("price_note") or ""])
    if prov == "Hostelworld":
        return "shared"
    if prov == "Airbnb":
        if re.search(r"private room|room in|shared", rt, re.I):
            return "shared"
        if re.search(r"entire", rt, re.I):
            return "entire"
        return "shared" if SHARED.search(txt) else "entire"
    if SHARED.search(txt):
        return "shared"
    if rt and ENTIRE_TYPE.search(rt) and not re.search(r"\broom\b", rt, re.I):
        return "entire"
    if rt and re.search(r"\b(apartment|villa|studio|condo|house)\b", rt, re.I):
        return "entire"
    return "hotel"


HOSTEL = re.compile(r"\b(hostel|dorm(itory)?|capsule|bunk|pod|poshtel|bed in|shared (room|dorm|bath))\b", re.I)


def stay_type(it):
    """The dashboard's Lodging filter: 'hostel' (dorm bed or hostel), 'private' (a private room: hotel room, guesthouse
    room, a room in someone's home), 'entire' (the whole apartment, villa or house to yourself)."""
    k = it.get("private_place") or kind(it)
    if k == "entire":
        return "entire"
    txt = " ".join([str(it.get("room_type") or ""), it.get("name") or "", it.get("price_note") or ""])
    if it.get("provider") == "Hostelworld" or HOSTEL.search(txt):
        return "hostel"
    return "private"


def norm(it):
    return (it.get("rating") or 0) / (it.get("rating_scale") or 10)


def revs(it):
    try:
        return float(str(it.get("reviews") or 0).replace(",", "").replace("+", ""))
    except ValueError:
        return 0.0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("trip_json")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    data = json.load(open(a.trip_json, encoding="utf-8"))
    nbs = data.get("neighborhoods") or []
    night = {n["id"] for n in nbs if n.get("good_nightlife") or any(str(t).strip().lower() == "nightlife" for t in n.get("tags") or [])}
    lodging = [i for i in data["items"] if i.get("category") == "lodging"]
    for i in lodging:
        i["private_place"] = kind(i)
        i["stay_type"] = stay_type(i)
        i.pop("custom_default", None)

    def choose(kinds, areas):
        for floor, minrev in ((0.9, 50), (0.9, 20), (0.85, 20), (0.8, 5), (0.0, 0)):
            c = [i for i in lodging if i["private_place"] in kinds and (areas is None or i.get("neighborhood") in areas)
                 and i.get("verified") and i.get("price") and norm(i) >= floor and revs(i) >= minrev
                 and (i.get("amenities") or {}).get("air_conditioning") is not False and (i.get("amenities") or {}).get("wifi") is not False]
            if c:
                return min(c, key=lambda i: (i["price"], -norm(i))), floor, minrev
        return None, None, None

    pick, note = None, ""
    for kinds, areas, why in ((("entire",), night, ""),
                              (("hotel",), night, "no whole place with good nightlife was found, so a private hotel room"),
                              (("entire",), None, "no good-nightlife area had a whole place, so the best one elsewhere"),
                              (("hotel",), None, "falling back to a private hotel room outside the nightlife areas")):
        if areas is not None and not areas:
            continue
        pick, floor, minrev = choose(kinds, areas)
        if pick:
            note = why
            break
    if not pick:
        print("No private stay found; Custom keeps the mid-tier default.", file=sys.stderr)
        return 1
    pick["custom_default"] = True
    # the airport transfer that goes with that stay's area (cheapest mid-tier line that names the area)
    for i in data["items"]:   # one airport transfer at a time, whatever area the helper filed it under
        if i.get("category") == "transfer" and not str(i.get("id", "")).startswith("transfer-pattaya"):
            i["exclusive_group"] = "transfer-airport"
    nbo = next((n for n in nbs if n["id"] == pick.get("neighborhood")), None)
    if nbo:
        parts = {nbo["id"].replace("-", " "), nbo["name"].lower()}
        for part in re.split(r"\s*(?:&|,| and )\s*", nbo["name"].lower()):
            parts.add(part.strip())
            parts.add(re.sub(r"^" + re.escape((data["trip"].get("destination") or {}).get("city", "").lower()) + r"\s+", "", part.strip()))
        parts = {x for x in parts if len(x) > 2}
        for i in data["items"]:
            i.pop("custom_default", None) if i is not pick else None
        tx = [i for i in data["items"] if i.get("category") == "transfer" and not str(i.get("id", "")).startswith("transfer-pattaya")
              and i.get("price") and any(x in (i.get("name", "") + " " + i.get("id", "")).lower() for x in parts)]
        tx = [i for i in tx if "mid" in (i.get("tiers") or [])] or tx
        if tx:
            t = min(tx, key=lambda i: (not i.get("verified"), i["price"]))
            t["custom_default"] = True
            print(f"Custom airport transfer: {t['name']} ${t['price']:g}")
        # the ride back to the airport from that same area (cheapest mid-tier line, a live price first)
        rt = [i for i in data["items"] if i.get("category") == "return" and i.get("neighborhood") == nbo["id"] and i.get("price")]
        rt = [i for i in rt if "mid" in (i.get("tiers") or [])] or rt
        if rt:
            r = min(rt, key=lambda i: (not i.get("verified"), i["price"]))
            r["custom_default"] = True
            print(f"Custom return to airport: {r['name']} ${r['price']:g}")
    nb = next((n["name"] for n in nbs if n["id"] == pick.get("neighborhood")), pick.get("neighborhood"))
    print(f"Custom stay: {pick['name']} ({pick['provider']}, {nb}) ${pick['price']:g} total, "
          f"{pick.get('rating')}/{pick.get('rating_scale')} from {pick.get('reviews')} reviews, {pick['private_place']}"
          + (f"; {note}" if note else ""))
    from collections import Counter
    print("private_place:", dict(Counter(i["private_place"] for i in lodging)), "| nightlife areas:", sorted(night))
    if not a.dry_run:
        with open(a.trip_json, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
