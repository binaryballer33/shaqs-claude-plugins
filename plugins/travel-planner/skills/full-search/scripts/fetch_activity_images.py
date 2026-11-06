"""Give every activity / tour line a thumbnail: the og:image of its page on GetYourGuide, Viator, Klook, Trip.com,
Expedia or Booking.com. The dashboard shows it beside the checkbox and links it to the tour page.

  python fetch_activity_images.py <trip folder>/trip.json            fetch what is missing, then apply
  python fetch_activity_images.py <trip folder>/trip.json --apply-only   only write cached images into the trip

Results are cached in <trip folder>/activities/activity_images.json, so a merge or rebuild can re-apply them.
Most of these sites refuse plain HTTP fetches (GetYourGuide and Klook 403, Trip.com 432, Expedia 429): for every
URL the script reports MISS, open the page in Chrome, read
  document.querySelector('meta[property="og:image"]').content
and put it in the cache as {"<url>": {"thumb": "<image url>"}}, then run with --apply-only. Trip.com "things-to-do/list"
search pages have no single image; us.trip.com detail pages return a generic og:image, so take the first large
product photo on the page instead."""
import json, os, re, sys, html, concurrent.futures, urllib.request, datetime
if len(sys.argv) < 2 or not sys.argv[1].endswith('.json'):
    sys.exit(__doc__)
TRIP = os.path.abspath(sys.argv[1]); R = os.path.dirname(TRIP)
CACHE = os.path.join(R, 'activities', 'activity_images.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
GENERIC = ('0AS1k120009l60yh36D69',)   # Trip.com's placeholder og:image
d = json.load(open(TRIP, encoding='utf-8'))
acts = [i for i in d.get('items', []) if i.get('category') == 'activities' and i.get('url')]
cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}

def og(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9'})
    with urllib.request.urlopen(req, timeout=25) as r:
        body = r.read(600000).decode('utf-8', 'ignore')
    for pat in (r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)'):
        m = re.search(pat, body, re.I)
        if m:
            u = html.unescape(m.group(1)).strip()
            if u.startswith('//'): u = 'https:' + u
            if u.startswith('http') and not any(g in u for g in GENERIC): return u
    return None

if '--apply-only' not in sys.argv:
    todo = [i for i in acts if i['url'] not in cache or not cache[i['url']].get('thumb')]
    def work(it):
        try: return it['url'], og(it['url']), None
        except Exception as e: return it['url'], None, f'{type(e).__name__}: {str(e)[:80]}'
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for url, thumb, err in ex.map(work, todo):
            cache[url] = {'thumb': thumb, 'error': err, 'checked_at': datetime.date.today().isoformat()}
            print(('OK  ' if thumb else 'MISS') + ' ' + url[:100] + ('' if thumb else '  ' + (err or 'no og:image')))
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), indent=1)

n = 0
for it in acts:
    c = cache.get(it['url'])
    if c and c.get('thumb'):
        it['image'] = {'thumb': c['thumb'], 'page': it['url'], 'credit': it.get('provider'), 'checked_at': c.get('checked_at')}; n += 1
json.dump(d, open(TRIP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{n} of {len(acts)} activities have a thumbnail' + ('' if n == len(acts) else '; read the MISS pages in Chrome (see the docstring) and rerun with --apply-only'))
