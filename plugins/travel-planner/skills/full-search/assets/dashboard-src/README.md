# Dashboard template sources ("Mission Control")

`../dashboard-template.html` is generated from the three files here. Edit these, then run
`python assemble.py` (optionally `--build <trip folder>/trip.json -o out.html` to build a trip at once).
`scripts/build_dashboard.py` uses the generated template by default.

```
control.html   the shell: layout, design tokens (dark default, light theme), navigation, page-level JS
engine.js      the data layer + every renderer: totals, selection, filters, flight / stay / item cards,
               neighborhoods, weather, entry rules, nearby places, food, restaurants, day trips, sources, sidebar
base.css       structural CSS driven by the tokens the shell sets
```

What the page has: a left rail (collapsible Price tier panel, Workspace tabs, the essentials cards: entry must-haves,
your selection, weather & rainy season, your dates, custom trip, airport → stay, SIM, onward travel); a header with the
selected total, theme toggle, Copy summary, a Ledger drawer, check-in / check-out dates and a currency strip; a KPI strip
(selected total, per day, where the money goes); one Workspace tab at a time (Flights · Stays · Getting around · Things
to do · Food · Essentials · Weather · Sources) with collapsible cards, filter chips and a checkbox on every line; a bottom
navigation router whose chips are the current tab's cards; "Top of section" / "Next section" links on every sub-card;
photo cards for neighborhoods, day trips and tours (tour photos come from `scripts/fetch_activity_images.py`);
and `--partial` builds show a "still searching" banner that reloads the page every minute.

The markup the engine emits uses stable class names (`.sec`, `.row`, `.chip`, `.pill`, `.tiers`, `.bnav`, …), so a
different look is a matter of tokens and shell CSS. Ticks, collapsed cards and the chosen tab are saved in the browser
per trip (`localStorage`, keyed by the trip and a fingerprint of its lines).
