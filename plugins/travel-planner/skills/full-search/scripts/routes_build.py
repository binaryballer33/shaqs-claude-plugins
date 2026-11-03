"""Whole-trip routes (origin -> arrival point) for the "Cheapest way to get there" card:
 * flight combos built from the data already on the page: ground leg to each airport + the cheapest flight from it
   (and the cheapest with a free checked bag when that differs);
 * overland / mixed routes researched by the helper (info/routes_overland.json).
The last leg (arrival point -> the selected stay) is added by the page, because it depends on the stay."""
import json, os, re, datetime
import sys
if len(sys.argv) > 1:
    os.chdir(os.path.dirname(os.path.abspath(sys.argv[1])))   # usage: python routes_build.py <trip folder>/trip.json
L = lambda f: json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {}
t = L('trip.json')
items = t['items']
FX = (t['trip'].get('fx') or {}).get('rate') or 33.75
AIRPORT_BUFFER = 90      # minutes at the airport before a domestic departure
EXIT_BUFFER = 30         # minutes from landing to the curb
ORIGIN = t['trip']['origin']['city']
ARR = t['trip'].get('arrival_airport') or {}

# ground leg from the origin city to each departure airport: the cheapest line per airport
GROUND = {'BKK': ('Suvarnabhumi (BKK)', 'transfer-pattaya-bkk'), 'DMK': ('Don Mueang (DMK)', 'transfer-pattaya-dmk'), 'UTP': ('U-Tapao (UTP)', 'transfer-pattaya-utp')}
DUR = {'transfer-pattaya-bkk-bus': 105, 'transfer-pattaya-bkk-car': 90, 'transfer-pattaya-dmk-bus': 150, 'transfer-pattaya-dmk-taxi': 135, 'transfer-pattaya-utp-van': 60}


def base_id(i):
    return re.sub(r'-(budget|mid|upper|luxury)$', '', i['id'])


def ground_leg(code):
    name, prefix = GROUND[code]
    c = [i for i in items if i['category'] == 'transfer' and i['id'].startswith(prefix)]
    if not c:
        return None
    i = min(c, key=lambda x: x['price'])
    mode = 'minivan' if 'van' in i['id'] else 'taxi' if ('taxi' in i['id'] or 'car' in i['id']) else 'bus'
    return {'mode': mode, 'from': f'{ORIGIN} (city centre)', 'to': name, 'operator': i['provider'], 'price': float(i['price']), 'price_thb': round(i['price'] * FX),
            'duration_min': DUR.get(base_id(i)) or i.get('duration_min'), 'url': i['url'], 'verified': bool(i.get('verified')),
            'note': (i.get('details') or '')[:140]}


def hm(dt):
    return datetime.datetime.fromisoformat(dt)


flights = [i for i in items if i['category'] == 'flights' and i.get('flight') and i.get('kind') != 'bags'
           and str(i['flight'].get('cabin', 'Economy')).lower().startswith('econ') and i['price'] and i['flight'].get('depart')]
routes = []
for code in ('DMK', 'UTP', 'BKK'):
    g = ground_leg(code)
    cand = [i for i in flights if (i['flight'].get('origin') or '').upper() == code]
    if not (g and cand):
        continue
    live = [i for i in cand if i.get('verified')] or cand
    picks = [('cheapest', min(live, key=lambda i: (i['price'], i['flight'].get('total_min') or 9999)))]
    bag = [i for i in live if (i['flight'].get('bags') or {}).get('checked') is True]
    if bag:
        b = min(bag, key=lambda i: (i['price'], i['flight'].get('total_min') or 9999))
        if b['id'] != picks[0][1]['id'] and b['price'] > picks[0][1]['price']:
            picks.append(('checked bag', b))
    # the quickest nonstop, when it costs at most $60 more than the cheapest
    ns = [i for i in live if (i['flight'].get('stops') or 0) == 0 and i['price'] <= picks[0][1]['price'] + 60]
    if ns:
        q = min(ns, key=lambda i: (i['flight'].get('total_min') or 9999, i['price']))
        if all(q['id'] != p[1]['id'] for p in picks):
            picks.append(('nonstop', q))
    for tag, f in picks:
        fl = f['flight']
        dep, arr = hm(fl['depart']), hm(fl['arrive'])
        bags = fl.get('bags') or {}
        gl = dict(g)
        leave = dep - datetime.timedelta(minutes=AIRPORT_BUFFER + (g['duration_min'] or 0))
        gl['depart'] = leave.strftime('%Y-%m-%dT%H:%M'); gl['arrive'] = (dep - datetime.timedelta(minutes=AIRPORT_BUFFER)).strftime('%Y-%m-%dT%H:%M')
        gl['wait_after_min'] = AIRPORT_BUFFER
        stops = fl.get('stops') or 0
        leg = {'mode': 'flight', 'from': f"{fl.get('origin')}", 'to': f"{fl.get('destination') or ARR.get('iata', 'HKT')}", 'operator': fl.get('airline') or f['provider'],
               'flight_no': '/'.join(fl.get('flight_numbers') or []), 'price': float(f['price']), 'price_thb': round(f['price'] * FX),
               'duration_min': fl.get('total_min'), 'depart': fl['depart'], 'arrive': fl['arrive'], 'wait_after_min': EXIT_BUFFER,
               'url': f['url'], 'verified': bool(f.get('verified')), 'stops': stops,
               'note': ('Nonstop' if stops == 0 else f'{stops} stop' + ('s' if stops > 1 else '')) + f", sold on {f['provider']}; " +
                       ('carry-on' + (' + checked bag included' if bags.get('checked') is True else ' only, checked bag costs extra' if bags.get('carry_on') is True else ''))}
        label = {'cheapest': 'cheapest flight', 'checked bag': 'cheapest flight with a free checked bag', 'nonstop': 'quickest nonstop'}[tag]
        routes.append({'id': f'route-fly-{code.lower()}-{tag.replace(" ", "")}', 'kind': 'flight', 'title': f"Bus/van to {g['to'].split(' (')[0]}, then fly ({label})",
                       'ends_at': 'HKT', 'legs': [gl, leg], 'source': 'built from the flights and transfers on this page'})

# overland / mixed routes from the helper
H = L('info/routes_overland.json')
for r in H.get('routes') or []:
    legs = r.get('legs') or []
    if not legs or any(l.get('price') is None for l in legs):
        continue
    r = dict(r); r['kind'] = 'overland'
    r['title'] = re.sub(r'^(cheapest|fastest)\s*:\s*', '', r.get('title') or '', flags=re.I).strip()
    r['title'] = r['title'][:1].upper() + r['title'][1:]
    routes.append(r)

# totals
for r in routes:
    legs = r['legs']
    r['price'] = round(sum(float(l['price']) for l in legs), 2)
    dur = 0
    for l in legs:
        dur += int(l.get('duration_min') or 0) + int(l.get('wait_after_min') or 0)
    # a leg chain with real clock times: use first departure -> last arrival instead of summed durations
    try:
        d0, d1 = hm(legs[0]['depart']), hm(legs[-1]['arrive'])
        dur = max(dur - int(legs[-1].get('wait_after_min') or 0), int((d1 - d0).total_seconds() / 60)) if r['kind'] == 'overland' else dur
        r['depart'] = legs[0]['depart']; r['arrive'] = legs[-1]['arrive']
    except Exception:
        pass
    r['duration_min'] = dur
    r['verified'] = all(l.get('verified') for l in legs)
routes.sort(key=lambda r: (r['price'], r['duration_min']))
t['routes'] = {'checked_at': H.get('checked_at') or t['trip'].get('generated_at'), 'origin': ORIGIN, 'routes': routes, 'last_mile': H.get('last_mile') or {},
               'ferry': H.get('ferry'), 'notes': H.get('notes'), 'airport_buffer_min': AIRPORT_BUFFER}
json.dump(t, open('trip.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
for r in routes:
    print(f"${r['price']:7.2f} {r['duration_min']//60}h{r['duration_min']%60:02d} {r['kind']:8} {r['title'][:70]}")
