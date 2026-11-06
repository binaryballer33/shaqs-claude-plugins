"""Generate assets/dashboard-template.html from its sources (this folder):

  control.html   the shell: layout, design tokens, navigation, page-level JS
  engine.js      the data layer and every renderer (totals, filters, flight / stay cards, weather, nearby, sidebar)
  base.css       structural CSS driven by the tokens the shell sets

Run after editing any of them:   python assemble.py
Optionally build a trip too:     python assemble.py --build <trip folder>/trip.json [-o out.html]
build_dashboard.py reads the generated template by default, so a normal build needs nothing else."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'dashboard-template.html')
shell = open(os.path.join(HERE, 'control.html'), encoding='utf-8').read()
engine = open(os.path.join(HERE, 'engine.js'), encoding='utf-8').read()
css = open(os.path.join(HERE, 'base.css'), encoding='utf-8').read()
assert '/*__ENGINE__*/' in shell and '/*__BASECSS__*/' in shell, 'control.html must keep the /*__ENGINE__*/ and /*__BASECSS__*/ markers'
html = shell.replace('/*__BASECSS__*/', css).replace('/*__ENGINE__*/', engine)
for ph in ('__TRIP_DATA_JSON__', '__TRIP_TITLE__'):
    assert ph in html, f'template must keep the {ph} placeholder'
open(OUT, 'w', encoding='utf-8').write(html)
print(f'wrote {OUT} ({len(html):,} bytes)')
if '--build' in sys.argv:
    trip = sys.argv[sys.argv.index('--build') + 1]
    out = sys.argv[sys.argv.index('-o') + 1] if '-o' in sys.argv else None
    cmd = [sys.executable, os.path.join(os.path.dirname(os.path.dirname(HERE)), 'scripts', 'build_dashboard.py'), trip] + (['-o', out] if out else [])
    sys.exit(subprocess.call(cmd))
