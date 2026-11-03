"""Merge the rated map places into trip.json["pois"]: hospitals, big-chain pharmacies, big-chain supermarkets.
Rules (user's standing instruction, Nov 2 2026): only chains with 3+ branches on the island, and and only chains known as reliable
(pharmacies: Boots and Watsons; the smaller local groups have too little evidence). A branch needs 3.5+ stars and 20+
reviews on Google Maps; every place carries its rating and review count."""
import json, os, re, sys
# usage: python poi_merge.py <trip folder>/trip.json
if len(sys.argv) > 1:
    os.chdir(os.path.dirname(os.path.abspath(sys.argv[1])))
L = lambda f: json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {}
MIN_RATING = 3.5
CHAIN_ALLOW = {'pharmacy': {'boots', 'watsons'}}   # judged on chain reputation; others (Pure, Morya, LAB, Palm) are thinly evidenced
MIN_BRANCHES = 3
MIN_REVIEWS = 20     # a 5.0 from two reviews says nothing
import math
t = L('trip.json')
key = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())

old = t.get('pois') or []
keep = [p for p in old if p.get('type') not in ('hospital', 'pharmacy', 'grocery') and not p.get('_rated_list')]
old_hosp = {key(p['name']): p for p in old if p.get('type') == 'hospital'}
out = []
report = []


TEL_RX = re.compile(r"(?:\btel\b|\bphone\b|\bcall\b)\.?:?\s*(\+?\d[\d\s\-()]{6,}\d)", re.I)


def find_tel(x):
    """The place's phone number: a `tel` / `phone` field, else 'tel 076 342 633' inside its note."""
    for k in ("tel", "phone"):
        v = str(x.get(k) or "").strip()
        if v:
            return v
    for k in ("note", "address"):   # searched one at a time: joined, the next text's digits would be read as part of the number
        m = TEL_RX.search(str(x.get(k) or ""))
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip()
    return None


def num(v):
    try:
        return float(str(v).replace(',', ''))
    except (TypeError, ValueError):
        return None


def base(x, typ):
    r = num(x.get('rating')); n = num(x.get('reviews'))
    return {'name': x['name'], 'type': typ, 'lat': x['lat'], 'lng': x['lng'], 'rating': r, 'rating_scale': x.get('rating_scale') or 5,
            'reviews': int(n) if n is not None else None, 'rating_source': x.get('rating_source') or 'Google Maps', 'url': x['url'], 'tel': find_tel(x), '_rated_list': True}


# hospitals: every one with a rating
H = L('info/poi_hospitals.json')
for x in H.get('places') or []:
    if num(x.get('rating')) is None or num(x.get('reviews')) is None:
        report.append(f"hospital skipped (no rating/reviews): {x.get('name')}"); continue
    p = base(x, 'hospital')
    prev = old_hosp.get(key(x['name']))
    note = x.get('note') or (prev or {}).get('note') or ''
    p['note'] = note
    for k in ('hours', 'er_24h', 'intl', 'ownership', 'address'):
        if x.get(k) is not None: p[k] = x[k]
    out.append(p)
if not (H.get('places')):   # helper file missing: keep the hospitals already curated
    out += [dict(p, _rated_list=True) for p in old if p.get('type') == 'hospital']

# chains
for typ, f in (('pharmacy', 'info/poi_pharmacies.json'), ('grocery', 'info/poi_grocery.json')):
    D = L(f)
    places = [x for x in D.get('places') or [] if x.get('lat') is not None]
    count = {}
    for x in places:
        c = (x.get('chain') or '').strip().lower(); count[c] = count.get(c, 0) + 1
    declared = {(c.get('chain') or '').strip().lower(): c for c in D.get('chains') or []}
    for x in places:
        c = (x.get('chain') or '').strip().lower()
        branches = max(count.get(c, 0), int((declared.get(c) or {}).get('island_branches') or 0))
        r, n = num(x.get('rating')), num(x.get('reviews'))
        if typ in CHAIN_ALLOW and c not in CHAIN_ALLOW[typ]:
            report.append(f"{typ} skipped (chain not on the reliable list): {x.get('name')}"); continue
        if not c or branches < MIN_BRANCHES:
            report.append(f"{typ} skipped (not a 3+ branch chain): {x.get('name')}"); continue
        if r is None or n is None:
            report.append(f"{typ} skipped (no rating): {x.get('name')}"); continue
        if r < MIN_RATING:
            report.append(f"{typ} skipped (rated {r}): {x.get('name')}"); continue
        if n < MIN_REVIEWS:
            report.append(f"{typ} skipped (only {int(n)} reviews): {x.get('name')}"); continue
        if re.search(r'closed', str(x.get('hours') or ''), re.I):
            report.append(f"{typ} skipped (closed): {x.get('name')}"); continue
        p = base(x, typ)
        p['chain'] = x.get('chain')
        p['note'] = ' '.join(z for z in [f"{x.get('chain')} ({branches} branches on the island).", x.get('note') or ''] if z).strip()
        for k in ('hours', 'address'):
            if x.get(k): p[k] = x[k]
        out.append(p)

# the same shop listed twice on Google (or by two helpers): same chain within 150 m keeps the one with most reviews
def km(a, b):
    la, lb = math.radians(a['lat']), math.radians(b['lat']); dl = math.radians(b['lng'] - a['lng'])
    return 6371 * math.acos(min(1, math.sin(la) * math.sin(lb) + math.cos(la) * math.cos(lb) * math.cos(dl)))
uniq = []
for p in sorted(out, key=lambda p: -(p.get('reviews') or 0)):
    dup = next((q for q in uniq if q['type'] == p['type'] and (q.get('chain') or q['name']) == (p.get('chain') or p['name']) and km(p, q) < 0.15), None)
    if dup:
        report.append(f"duplicate listing dropped: {p['name']} (same place as {dup['name']})"); continue
    uniq.append(p)
# phone numbers read on Google Maps for places whose note had none (info/poi_tel_*.json: {"phones": [{"name", "tel"}]})
import glob
tels = {}
for f in glob.glob('info/poi_tel_*.json'):
    for x in (L(f).get('phones') or []):
        if x.get('name') and x.get('tel'):
            tels[key(x['name'])] = str(x['tel']).strip()
for p in uniq:
    if not p.get('tel') and key(p['name']) in tels:
        p['tel'] = tels[key(p['name'])]
t['pois'] = keep + uniq
json.dump(t, open('trip.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
import collections
print('rated places:', dict(collections.Counter(p['type'] for p in uniq)), '| other curated kept:', len(keep))
for r in report: print(' -', r)
