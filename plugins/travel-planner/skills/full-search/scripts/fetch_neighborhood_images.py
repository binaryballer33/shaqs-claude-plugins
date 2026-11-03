#!/usr/bin/env python3
"""Give every tourist neighborhood a photo (Wikimedia Commons, with credit and license), in place.

  python fetch_neighborhood_images.py trip.json                 # neighborhoods without an image
  python fetch_neighborhood_images.py trip.json --force         # redo them all
  python fetch_neighborhood_images.py trip.json --set patong="Patong" --set kamala=File:Kamala_Beach.jpg

How a neighborhood is matched, in order:
  1. neighborhood["wiki"]: an English Wikipedia article title or a Commons "File:" name.
  2. Wikipedia articles named after the neighborhood: "<name>", "<name>, <city>", "<name> Beach", "<name> (<city>)",
     and each part of a combined name ("Kata & Karon" -> Kata, Karon), keeping the first article whose lead image
     is a Commons photo.
  3. A Commons file search for "<name> <city>" (bitmap photos only; the file name must carry the neighborhood name).
Every match is printed with how it was found: open the thumbnails and fix a wrong one with --set.

Writes on each neighborhood: image {thumb, full, page, credit, license, source, via, checked_at}.
Reuses the Wikimedia helpers of fetch_dish_images.py (paced to ~1 request a second).
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_dish_images as F  # noqa: E402


def candidates(n, city):
    name = re.sub(r"\s*\(.*?\)", "", n.get("name") or "").strip()
    parts = [p.strip() for p in re.split(r"\s*(?:&|/|,| and )\s*", name) if p.strip()]
    out = []
    for base in [name] + parts:
        for t in (base, f"{base}, {city}", f"{base} Beach", f"{base} ({city})", f"{city} {base}"):
            if t and t not in out:
                out.append(t)
    if n.get("local_name"):
        out.append(n["local_name"])
    return out


def search_commons_place(q, key):
    p = urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": q + " filetype:bitmap", "srnamespace": 6,
                                "srlimit": 10, "format": "json"})
    for hit in F.get("https://commons.wikimedia.org/w/api.php?" + p).get("query", {}).get("search", []):
        if F.squash(key) not in F.squash(hit["title"]):
            continue
        info = F.commons_info(hit["title"])
        if info:
            info["via"] = "Commons search: " + q
            return info
    return None


def article(title):
    """from_article that treats any HTTP error (a title Wikipedia rejects) as 'no article'."""
    try:
        return F.from_article(title)
    except Exception as e:  # urllib.error.HTTPError, timeouts
        print(f"    skipped {title!r}: {str(e)[:60]}")
        return None, None


def is_place(summary, city, country):
    """The article must be about a place in this destination (Wikipedia's "Kata" is a martial art)."""
    text = " ".join([(summary or {}).get("description", ""), (summary or {}).get("extract", "")[:600]])
    return bool(re.search(re.escape(city), text, re.I) or (country and re.search(re.escape(country), text, re.I)))


def find(n, city, override=None, country=""):
    wiki = override or n.get("wiki")
    if wiki:
        if wiki.startswith("File:"):
            info = F.commons_info(wiki)
            if info:
                info["via"] = "set: " + wiki
            return info
        info, _ = article(wiki)
        if info:
            return info
    for t in candidates(n, city):
        info, summ = article(t)
        if info and is_place(summ, city, country):
            return info
    name = re.sub(r"\s*\(.*?\)", "", n.get("name") or "").strip()
    for key in [name] + [p.strip() for p in re.split(r"\s*(?:&|/|,| and )\s*", name) if p.strip()]:
        try:
            info = search_commons_place(f"{key} {city}", key)
        except Exception as e:
            print(f"    skipped commons search {key!r}: {str(e)[:60]}")
            info = None
        if info:
            return info
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("trip_json")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--set", action="append", default=[], metavar="ID=TITLE")
    a = ap.parse_args()
    data = json.load(open(a.trip_json, encoding="utf-8"))
    dest = data.get("trip", {}).get("destination") or {}
    city, country = dest.get("city", ""), dest.get("country", "")
    sets = dict(x.split("=", 1) for x in a.set)
    done = miss = 0
    for n in data.get("neighborhoods") or []:
        if not n.get("id"):
            continue
        if n.get("image") and not a.force and n["id"] not in sets:
            continue
        info = find(n, city, sets.get(n["id"]), country)
        if info:
            info["checked_at"] = date.today().isoformat()
            n["image"] = info
            done += 1
            print(f"  {n['id']:<18} {info['via']:<40} {info.get('license') or '?':<14} {info['page']}")
        else:
            miss += 1
            print(f"  {n['id']:<18} NO PHOTO FOUND: set neighborhood.wiki or --set {n['id']}=\"Article title\"")
    json.dump(data, open(a.trip_json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{done} neighborhood photo(s) found, {miss} without; wrote {a.trip_json}")


if __name__ == "__main__":
    main()
