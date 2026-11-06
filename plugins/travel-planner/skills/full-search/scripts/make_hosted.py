"""Make a hostable copy of a built dashboard for the claude.ai Artifact host, which blocks images from other sites:
download every <img src="http..."> and inline it as a data: URI, and drop the document wrapper (the host adds its own).
Usage: python make_hosted.py <built dashboard.html> <out.html>"""
import base64, html, os, re, sys, urllib.request, concurrent.futures, mimetypes
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
# images live inside the JSON payload (escaped) and in markup; collect every distinct http(s) image URL from the payload
m = re.search(r'<script id="trip-data" type="application/json">(.*?)</script>', s, re.S)
payload = m.group(1)
urls = sorted(set(re.findall(r'"thumb":\s*"(https?://[^"]+)"', payload)))
print(f'{len(urls)} image URLs')
def grab(u):
    try:
        req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': 'image/*,*/*'})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read(2_500_000)
            ct = r.headers.get('Content-Type', '').split(';')[0].strip() or mimetypes.guess_type(u)[0] or 'image/jpeg'
        if not ct.startswith('image/') or len(data) < 200: return u, None, f'bad content ({ct}, {len(data)} B)'
        try:   # shrink to card size: nothing on the page shows a photo wider than 600 px
            from PIL import Image; import io
            im = Image.open(io.BytesIO(data)); im.load()
            if im.mode not in ('RGB', 'L'): im = im.convert('RGB')
            if im.width > 640: im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
            buf = io.BytesIO(); im.save(buf, 'JPEG', quality=76, optimize=True); data, ct = buf.getvalue(), 'image/jpeg'
        except Exception: pass
        return u, f'data:{ct};base64,' + base64.b64encode(data).decode(), None
    except Exception as e:
        return u, None, f'{type(e).__name__}: {str(e)[:60]}'
ok, bad, total = 0, [], 0
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for u, uri, err in ex.map(grab, urls):
        if uri:
            payload = payload.replace(u, uri); ok += 1; total += len(uri)
        else:
            bad.append((u, err))
print(f'inlined {ok}, failed {len(bad)}, {total/1e6:.1f} MB of image data')
for u, e in bad[:20]: print('  MISS', u[:90], e)
s = s[:m.start(1)] + payload + s[m.end(1):]
# strip the document wrapper: keep from <title> through the end of </body>
head = re.search(r'<title>.*?</title>', s, re.S).group(0)
links = ''.join(re.findall(r'<link[^>]+fonts\.googleapis\.com[^>]*>', s))
style = re.search(r'<style>.*?</style>', s, re.S).group(0)
body = re.search(r'<body>(.*)</body>', s, re.S).group(1)
open(out, 'w', encoding='utf-8').write(head + '\n' + links + '\n' + style + '\n' + body)
print(f'wrote {out} ({os.path.getsize(out)/1e6:.1f} MB)')
