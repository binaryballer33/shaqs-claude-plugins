---
name: full-search
description: >
  Plan and price a whole trip from origin, destination and dates (mm/dd/yyyy or yyyy-mm-dd; cities or
  airport codes). Defaults: 1 traveler, 1-week stay, round trip. Searches Airbnb, Booking.com, Expedia,
  Kayak, Skyscanner, Trip.com, Agoda, Hostelworld, Google Flights and Google Hotels for flights (5 per
  tier per time of day), stays by neighborhood, cars, activities, food, SIMs and transfers, with DIRECT
  links, then builds a self-contained HTML dashboard (Budget / Mid / Upper / Luxury / Custom tabs,
  checkboxes, nearby-places cards) and emails it to the requester. Use it for any trip, vacation, travel budget,
  flights plus hotel, "how much to go to X", or booking links, even without the word "dashboard".
  Also refreshes an existing trip: "update the prices", "refresh the Pattaya trip", "are these prices
  still right" re-reads current flight, stay and rental car prices (and anything else dated) in the same
  dashboard, shows what changed, and re-sends it.
model: sonnet
effort: high
---

# Travel Planner

## Model and effort (required)

This skill runs on **Claude Sonnet at effort high**, and so does every helper it starts. The frontmatter
(`model: sonnet`, `effort: high`) switches the session to Sonnet / high when the skill is invoked; that
switch lasts for the turn, so on every later turn of a run (helper reports, map downloads, the email) keep
working the same way and keep starting helpers as below.

- **Helpers:** start every research helper with the Agent tool's `model: "sonnet"` and `effort: "high"`.
  Never use `haiku` or `fable` for this skill, and do not use `opus` while Sonnet works.
- **Fallback, only when Sonnet is unavailable** (the model is refused or not in the allowed list, or a
  helper fails because Sonnet could not be used): use `opus` with `effort: "high"`. Relaunch a failed helper
  with `model: "opus"`, `effort: "high"`, and say in `trip.notes` which helpers ran on Opus and why.
- **Main session:** if the session is on a model other than Sonnet (or Opus when Sonnet is unavailable) or
  below effort high, say so in one line in the opening message and carry on: the research still runs in
  Sonnet / high helpers. The user can switch the session with `/model sonnet` and effort high.

You are producing two things for the user:

1. **Researched options with direct links.** For each price tier and each cost category, real
   options found on the booking sites, each with the price you saw, the date you saw it, and a link
   that opens *that specific flight / listing / car* with the user's dates and guests pre-filled.
2. **A trip-cost dashboard** (one self-contained HTML file) built from `assets/dashboard-template.html`
   by `scripts/build_dashboard.py`. The template is the **Mission Control** design (user's instruction, Nov 6 2026;
   sources in `assets/dashboard-src/`, regenerate with `python assets/dashboard-src/assemble.py` after editing them):
   a dark workspace with a light-theme toggle; a left rail with a collapsible Price tier panel (Budget, Mid-tier,
   Upper class, Luxury, **Custom**), the Workspace tabs (Flights · Accommodation · Transportation · Things to do · Food ·
   Essentials · Weather · Sources) and the essentials cards (entry must-haves, your selection, weather & rainy season,
   your dates, custom trip, airport → stay, SIM, onward travel); a header with the selected total, a Ledger drawer,
   check-in / check-out dates and a currency strip; a bottom navigation router whose chips are the current tab's
   cards; collapsible cards with filter chips (area, tier, type, time of day, airport, bags, site, sort) and a
   checkbox on every line; "Top of section" / "Next section" links on every sub-card; photo cards for
   neighborhoods, day trips and tours; and nearby-places cards for each stay (or any address or Google Maps link
   the user pastes) with everything useful within a 5-mile radius. There is no map.

The dashboard is only as good as the research behind it. Most of your time goes into step 2.

## Invocation and arguments

```
/travel-planner:full-search <origin> <destination> <check-in> <check-out> [travelers] [one way]
/travel-planner:full-search LAX Lisbon 11/10/2026 11/17/2026 2
/travel-planner:full-search TPA GIG 01/15/2027 02/15/2027 1 one way
/travel-planner:full-search rio de janeiro to belo horizonte 01/15/2027 one way   # 1 traveler, nothing else asked
```

Plain English works the same ("LAX to Lisbon Nov 10–17 2026 for 2"). Casing never matters for
cities or airport codes. Flights are round trip unless the prompt says one way (then the check-in
date is the flight date and lodging still runs check-in to check-out). Optional extras anywhere in
the prompt: cabin (business, first), currency, children, "no car" / "with a car", a budget, must-haves.

## Step 0 — Four inputs, one question, sensible defaults

The skill runs on exactly four things from the user:

1. **Check-in date** — `mm-dd-yyyy`, `mm/dd/yyyy` or `yyyy-mm-dd` (month first when ambiguous)
2. **Check-out date** — same formats; also the return-flight date (default: check-in + 7 days)
3. **Origin** — city or airport code, any casing
4. **Destination** — city or airport code, any casing

**Standing defaults (apply them silently and say so in the opening line):**

- **Travelers: 1** unless the prompt says otherwise ("2 adults", "the three of us", a number after the dates). Do not ask.
- **Check-out missing: check-in + 7 days** (one week).
- **Trip type missing: round trip.** Only "one way" in the prompt makes it one way.
- **Email the result automatically** every time a run finishes (Step 6), without being asked and without
  asking for confirmation, to the address the requester gave. **If no email address is known, ask for one**
  (one short question) and send as soon as they answer; never guess an address.

If origin, destination or check-in is missing, ask for just that one thing. A past check-in date is the
only other thing worth a question (the user has twice chosen the same dates one year later: say that you
assumed it when you do not ask). That is the whole interview: every other input has a default, and more
questions turn a one-line request into a form the user did not ask for.

| Input | Default | Shown as |
|---|---|---|
| Travelers | 1 adult (never asked) | "for 1 traveler" (per-person lines × 1) |
| Rooms | 1 | |
| Cabin | economy; upper/luxury tiers upgrade per `references/tiers.md` | |
| Currency | USD | |
| Rental car | researched for every tier, left **unchecked** | user ticks it if they want one |
| Trip style | general sightseeing | activities chosen accordingly |
| Children | none | |

When the user volunteers more (budget, must-haves, a car, a cabin, children), use it.

**Resolve places the way a dropdown would.** `scripts/deeplinks.py --suggest "<text>"` returns
case-insensitive matches from a table of about 750 cities and their main international airports.
One match → use it and say what you resolved ("Lisbon (LIS)"). Several plausible matches, or a
partial word ("rio", "san j", "georgia") → present them as clickable options with
`AskUserQuestion` (combine with the travelers question so the user answers once). No match → use
the airport code you know, or search "{place} airport IATA", and say which airport you picked. The
bundled `assets/trip-request-form.html` is a real typeahead form (type "rio", pick "Rio de Janeiro
(GIG), Brazil" from the dropdown) that generates the exact prompt; offer it when the user asks for
a form or plans trips often.

A past check-in date or a check-out before check-in are the only other things worth a question;
everything else you assume and state.

Open your reply with one line that states the resolved parameters and the defaults you applied, for
example: "Planning LAX → Lisbon (LIS), Nov 10–17 2026, 7 nights, 2 travelers, USD, economy; say if
any of that should change." Then start researching without waiting for a reply.

## Scope: full run or limited search (user's instruction Oct 30 2026)

Not every request wants the whole dashboard. Decide the scope from the prompt before Step 1 and say it
in the opening line ("Limited search: stays only, Lisbon, Nov 10–17 (7 nights), all four tiers").

| The user says | Scope | What to run |
|---|---|---|
| origin + destination + dates, nothing narrower | **Full** | every step as written |
| "stays / hotels / where to stay in X" | **Stays only** | tourist neighborhoods + stays on every lodging site; map; weather and entry rules only if asked |
| "flights only", "just flights A to B" | **Flights only** | flight sites, bag fees |
| "cars", "activities", "food", "SIM", "transfer" alone | that category only | only that category's research |
| any list ("stays and activities") | those categories | only those |
| "budget and mid only", "just budget", "no luxury" | **Tier-limited** | only those tiers (combine with any scope) |
| "top 3 neighborhoods", "5 per site", "Booking and Airbnb only" | **Depth/vendor-limited** | cap neighborhoods, per-site counts, or sites as stated |

Rules for a limited run:

- **Ask for as little as possible.** A destination and a check-in date are enough for stays, activities,
  food, SIM or weather; the origin is only needed for flights, transfers from an airport, ground
  transport and entry rules. "7 nights" or no check-out means check-out = check-in + 7. If the prompt
  gives a month but no day, ask once for the check-in date.
- **Only research and build what was asked.** Skip the other stages, helpers and fetch scripts
  (`fetch_pois.py` still runs when stays are in scope, `fetch_weather.py` only if weather is in scope).
- **Build the dashboard for the scope.** Set `categories` in `trip.json` to just the requested ones, e.g.
  `"categories": [{"id": "lodging", "label": "Lodging"}]`, and the page shows only those cards (tested
  with a stays-only build). Origin may be `{"city": "", "iata": ""}` when there are no flights. Ignore
  build warnings about sections outside the scope; fix errors. Tier tabs and the Custom tab still work
  and total only what is in scope. Do not use `--partial` for this: it adds "still searching" banners.
- **Name and title it for the scope:** `<destination>-<yyyy-mm>-stays-dashboard.html`, title
  "Lisbon stays · Mon 10 – Mon 17 Nov 2026 (7 Nights)".
- **Everything else is unchanged:** Chrome only, search links with dates, verified vs estimate labels,
  the run timer, build-as-you-go, send the file, then email it (Step 6; the summary says what was
  skipped).
- **Easy to widen later.** Keep the trip folder and `trip.json`; when the user later says "now add
  flights", run only the new category's research, merge it, drop it from the scope limits (extend
  `categories`) and rebuild the same file.

## Where trips are saved (user's instruction, Oct 30 2026)

Every trip goes in its own folder inside `~/travel-planner-trips/` (on Windows
`C:\Users\<user>\travel-planner-trips\`), whatever folder the session started in. Create the parent
folder if it is missing, then one folder per trip named `<destination>-<yyyy-mm>[-<scope>]`
(`bangkok-pattaya-2026-10`, `lisbon-2026-11-stays`). That trip folder is "the trip folder" everywhere
in this skill: the run timer file, `trip.json`, helper outputs and subfolders, the dashboard and the
email all live there, and helpers get its full path in their briefs. Never save trips in a session's
scratch folder (it is deleted with the session). Resuming or widening a trip reuses its folder.

```bash
mkdir -p ~/travel-planner-trips/<destination>-<yyyy-mm>
```

## Run timer (start time and end time, user's instruction Oct 30 2026)

The user wants to know how long a run takes. **First action of every run**, before any research:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/run_timer.py start --file <trip folder>/.run_timer.json
```

State the start time in the opening line ("Started 7:05 PM"). **Last action before the email** (after the
final build is verified; rebuild afterwards so the footer carries it):

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/run_timer.py end --file <trip folder>/.run_timer.json --trip trip.json
```

It prints "Started … · Finished … · Took 2 h 7 min", stores `trip.run` {started_at, finished_at, elapsed}
and appends the line to `trip.notes`. Put that same line at the top of the closing message and in
`closing-summary.md`, so the email shows it. If a run is resumed in a later session, keep the original
start time (the file is already there) and say if the clock includes time spent waiting for the user.

## Step 1 — Generate the starting search links

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/deeplinks.py "Los Angeles" Lisbon 11/10/2026 11/17/2026
# optional: --adults 2 --children 1 --rooms 1 --cabin business --currency EUR --json
```

Pass the four inputs exactly as the user gave them: city names or airport codes, dates in any of the
accepted formats. The script resolves cities to airport codes and prints the normalised trip line.

This prints one results-page link per provider (flights, lodging, cars) with the dates and guests
already in the URL. These are *starting points* for your research, and they are also acceptable
fallback links for the dashboard because they land on the user's exact search, not a homepage.
`references/providers.md` documents every URL pattern and which query parameters each site needs.

## Step 2 — Research every tier (the core of the job)

Read `references/research-playbook.md` before the first search. It covers tool choice, how to read
prices off each site, how to capture the exact listing URL, what to do about anti-bot pages, and how
to label what you found. Read `references/tiers.md` for what counts as budget / mid / upper / luxury
in each category.

### Tier order (user's standing instruction, Oct 30 2026): budget + mid first, upper + luxury last

Research runs in **two phases**. Everything in this step that names tiers applies to the phase you are in:

- **Phase A — Budget and Mid-tier, every category.** Run all seven stages below (flights, stays,
  transfer / SIM / entry, cars and ground transport, activities and day trips, food and restaurants,
  map places) for the **budget and mid tiers only**: economy flight searches (cheapest 5 → budget,
  next 5 → mid), hostel / guesthouse / private-room stays and 3★ / entire-flat stays, budget and mid
  cars, tours and daily spend, basic and standard insurance. Do **not** open business-class searches,
  4★/5★ star filters or private/luxury tours in Phase A. Mark `upper` and `luxury` as pending
  (`--partial` plus the tier tabs show "still searching"), and treat only the Budget, Mid-tier and Custom
  tabs as live. Finish with a full Phase A build, verification, and **send the file to the user** (and
  tell them the upper/luxury tabs are still being filled in). Entry rules, weather, SIM, transfer, local
  food, restaurants, day trips and ground transport are tier-independent, so they belong to Phase A.
- **Phase B — Upper class and Luxury, right after Phase A (user's instruction, Oct 30 2026).** Never stop
  after Phase A to ask whether to continue: the moment Phase A's research is done and its dashboard is
  built and sent, launch every Phase B helper at once, and keep merging and rebuilding as each lands.
  Phase B tasks of a category may start as soon as that category's Phase A helper has finished (a
  site's budget/mid flights done, then its business search), so no browser sits idle. Business / first
  flight searches (cheapest 5 → upper, next 5 → luxury), 4★ / boutique and 5★ / luxury-brand stays per
  neighborhood, premium cars or private drivers, small-group and private tours, fine dining and
  chauffeured transfers, comprehensive insurance. Merge into the same `trip.json`, run the final build
  without `--partial`/`--map-pending`, verify, send, then email (Step 6).

**Build continuously (user's standing instruction, Oct 30 2026).** The moment any task finishes (one
site's flights, one helper's stays, the transfer, the SIM list, entry rules, weather, a food or
restaurant batch), merge its JSON into `trip.json`, rebuild the dashboard to the same output path
(`--partial` for sections still open) and send it. Nothing waits for an unrelated task to finish; only
wait when a step truly depends on another (the transfer needs the default stay and arrival airport,
`fetch_pois.py` needs the ticked stays, the email needs the final build). Start independent tasks
(helpers, `fetch_weather.py`, `fetch_pois.py`, exchange rate) in the background as soon as their inputs
exist, and merge each result as it lands rather than in one batch at the end.

Mixed items (a stay or flight that fits several tiers) go in the phase of the lowest tier they serve.
If the user asks for Phase A only, stop after the Phase A send and email it (Step 6); say what Phase B
would add.

Non-negotiables, because they are the whole point of the deliverable:

- **Direct links only.** A link must open the specific flight itinerary, hotel, Airbnb listing,
  hostel or car offer, with dates and guests in the URL. When a site will not give you an
  itinerary-level URL (flights often won't), use the results-page deep link for the exact route and
  dates and say so in the item's `details`. A bare homepage is never acceptable; the build script
  rejects it.
- **Label verified vs. estimate honestly.** `verified: true` means you read that price on that
  provider's page today. Anything else (a price from a search snippet, a typical-price article, your
  own knowledge) is `verified: false` and shows an "Estimate" badge. Never dress an estimate up as a
  live price. Prices move daily, so the badge and the `checked_at` date protect the user.
- **Flights: five per site, per tier, per part of the day.** For every flight site and every tier
  (budget, mid, upper, luxury) list at least **5 morning** (departs 05:00–11:59), **5 afternoon**
  (12:00–17:59) and **5 night** (18:00–04:59) flights: 15 per tier, 60 per site (Google Flights after
  searching should show 5 morning budget, 5 afternoon budget, 5 night budget, 5 morning mid-tier …).
  Read them off the results page (sort by cheapest, then use the site's time-of-day / departure-time
  filter for each band; business searches for upper and luxury). Where a band truly has fewer on a
  route, list what exists and say so in `trip.notes`. Every flight line carries a `flight` object
  (`references/trip-schema.md` § Flight cards) so the dashboard can draw the flight card: airline and
  flight number(s), origin → destination, date and time, connections, each leg's flight time, layover
  time, total time, the site it was found on and a link to the flight, cabin, whether a carry-on and/or
  checked bag is free, one way or round trip, the aircraft type (e.g. Airbus A350-900) and the legroom in
  inches as the site shows it (the card judges it for a 6 ft 1 in traveler: `trip.traveler_height_in`,
  default 73). A missing field shows "Not listed": read the flight's details panel on the site (Google
  Flights and Kayak show aircraft and legroom) rather than leaving it empty. This is a lot of lines: split flight
  sites across helpers (one or two sites each) and have them save JSON after every tier.
  Earlier rule, still true: economy search → budget + mid, business search → upper + luxury.
- **Flights: at least five per site in EVERY tier.** Run two searches on every flight site: economy
  (sorted cheapest) and business / premium (sorted cheapest). From economy, the 5 cheapest distinct
  flights are `budget` and the next 5 are `mid` (put full-service carriers there when the site lists
  them); from business, the 5 cheapest are `upper` and the next 5 are `luxury` (first class when it
  exists). That is at least 20 flights per site, each tiered explicitly, each linking that site's
  results page for its cabin. Where a route truly has fewer business seats, list what the site shows
  and say so in `trip.notes`. The build warns about any site with fewer than 5 in a tier.
- **Tourist neighborhoods, then stays in each one.** Before searching lodging, find the 3–6
  neighborhoods visitors base themselves in for nightlife and food (Wikivoyage district pages, the
  tourism board, Time Out / Lonely Planet "where to stay"): for Rio, Copacabana, Ipanema, Lapa,
  Botafogo. Write them to `neighborhoods` [{id, name, local_name, lat, lng, radius_m, tags, summary,
  nightlife, food, good_to_know, source_url, source_label}]; they render as a "Tourist neighborhoods: nightlife & food" fold at the top of the Lodging card
  (area names always visible, click to expand the details), as outlined areas on the map, and as an
  **Area** filter on the Lodging card.
  **Then search stays in every neighborhood on every lodging site, at least 5 per tier**: 5 budget,
  5 mid, 5 upper and 5 luxury from Hostelworld, 5 of each from Airbnb, from Booking.com, and so on
  (`deeplinks.py --areas "Copacabana,Ipanema,Lapa"` prints each site's search per area). Tag every
  stay with `"neighborhood": "<id>"` and set its `tiers` from the band you searched (tiers.md: hostel
  or private room → budget, 3★ or entire flat → mid, 4★/boutique → upper, 5★/luxury brand →
  luxury); mostly entire places, see "Stay mix" below (about 70% entire place, 30% private rooms and the best Hostelworld hostels); sort each area's results by price and use the site's star filter to reach the upper and
  luxury bands. Where a site has none in a band (Hostelworld sells no 5★; a quiet area has two
  luxury hotels), list what exists and record it in that neighborhood's `gaps`
  ({"Hostelworld": "hostels only: no upper or luxury"}). The build warns about every
  neighborhood × site × tier cell under 5 without a gap note. This is the biggest research job in a
  run (4 areas × 9 sites × 4 tiers × 5 ≈ 700 stays): split it across subagents by site (four
  helpers with two sites each did Beijing's 6 areas × 8 sites, about 800 stays, in 25–40 minutes),
  each briefed from `references/area-stays-brief.md` and saving its JSON after every area; merge
  them with `scripts/import_area_stays.py trip.json stays_*.json`, then tick one stay per tier. Cities with more than 6 tourist areas: keep the 4–5 most popular for
  stays and list the rest on the card with `"search_stays": false`.
- **At least five options per site per category, across all tiers** (cars, activities; lodging
  follows the neighborhood rule above).
  Harvest at least five options from every site that returned results (its results
  page, read once and scrolled, gives them: `references/research-playbook.md` § harvesting), each
  with its own dated link, whatever tier they will land in: a luxury hotel still goes in when you are
  filling the budget tier. Only when a site truly has fewer (Hostelworld lists four Manaus hostels;
  Expedia had one Beijing property for a month) list what exists and say so in `trip.notes`; the
  build warns about every site under five. Every card in the dashboard lists every option from every
  site and tier, cheapest first by default (the user can re-sort), so nothing is hidden. Then tier
  them: hand-pick the lines ticked by default (one flight, one stay per tier) and let
  `scripts/assign_tiers.py` place the rest by price rank. Daily spend and insurance stay one line per
  tier. Give checked-bag lines `"kind": "bags"` so they group under "Checked bags" below the flights.
- **Entry rules for US citizens (the red banner).** Unless the user says otherwise, research what a
  US passport holder needs to enter the destination: visa or e-visa, electronic travel authorization
  (ETA/ETIAS/ESTA-style), arrival card or health form, required and recommended vaccines and
  malaria advice, passport validity. Read the State Department country page and the CDC traveler
  page (in Chrome; both block the fetch tool), plus the official visa portal. Record it in the trip
  JSON `entry` object (`references/entry-requirements.md`); the dashboard turns any `required` item
  into a big red banner at the top of the page.
- **Every vendor, every category it sells.** Airbnb, Booking.com, Expedia, Kayak, Skyscanner,
  Trip.com, Agoda, Hostelworld, Google Flights and Google Hotels each get searched for each category
  they offer (matrix at the top of `references/providers.md`; `deeplinks.py` prints the links vendor
  by vendor). Record each cell in the trip JSON `coverage` object as `searched`, `no-inventory` or
  `blocked`; the dashboard shows that table under "Sources checked", and the build warns about
  missing cells.
- **Checked-bag fees.** For every flight option, find what a checked bag costs on that fare and add
  a companion "Checked bags" line linking the airline's official baggage page
  (`references/baggage.md`). Budget fares usually exclude bags; that line is what makes the budget
  tier honest.
- **Ratings and reviews on everything that has them.** Every stay, rental car and activity line
  carries `rating`, `rating_scale` and `reviews` (count) read off the same results page as its price:
  the site's guest score for stays, the rental company's score for cars (Kayak shows only its own
  deal score: label it with `rating_source`), the activity's stars. If a site shows none, use the
  property's Google Maps rating and set `"rating_source": "Google Maps"` (where Google is thin, as in
  China, Trip.com or Tripadvisor, with the page in `rating_url`). Restaurants, transfers and
  eSIMs get theirs too (Google Maps, the booking site, Trustpilot). When no site rates it, set only
  `rating_source` with the reason; the page shows "No rating · …". The build warns about any
  stay, car, activity or restaurant with neither.
- **Trips that start today.** Same-day searches lose inventory: flight sites drop departed flights
  and car hire refuses a pick-up time that has passed. Search cars from a time after the flight lands,
  and say in `trip.notes` which sites showed little same-day inventory.
- **Overnight flights.** When the cheap flights leave on the check-in evening and land the next
  morning, say so in `trip.notes` (the first booked night goes unused; suggest checking in on the
  arrival day) and start car hire after landing.
- **Airport to the stay.** Price the ride from the arrival airport to each tier's default stay in a
  `transfer` card: Uber's estimate first (uber.com/global/en/price-estimate; it now asks the user to
  log in before it shows prices, so never sign in: check Uber's country list instead and, where
  Uber operates, link its universal ride link and take the fare from the app's public city page or
  a reputable report, labelled an estimate). Then the local ride apps (Bolt publishes route-price
  pages, `bolt.eu/en/cities/{city}/route/…`; Grab does not), the airport's official taxi or limousine
  counter, the airport bus, and pre-booked private transfers (Booking.com Attractions, GetYourGuide,
  Kiwitaxi) with their ratings. Set `trip.arrival_airport` and `trip.uber_available` so the map shows
  directions and ride links for whichever stay is selected.
- **SIM and mobile data: local carriers first.** In every country, list each of the destination's
  own mobile network operators (Thailand: AIS, True/dtac, NT; elsewhere the national carriers) with
  every tourist / visitor package they sell that fits the trip: official price, validity, data,
  calls, physical SIM or eSIM, where to buy at the arrival airport, and the official page. Mark them
  `"kind": "local"` with `"tags": ["Local carrier", "Physical SIM" | "eSIM"]`. Then add 3–4
  international eSIMs (Airalo, Holafly, Nomad, Saily) as `"kind": "esim"` with Trustpilot ratings.
  The sidebar shows the average local-SIM price and the cheapest eSIM.
- **Local food: country classics AND city specialties.** A `local_food` block with two groups of
  dishes: 8–10 national classics (`"scope": "country"`, e.g. pad thai, tom yum, green curry) and 8–10
  dishes popular and specific to the city or region (`"scope": "city"`, e.g. Bangkok boat noodles,
  Phuket moo hong), plus `city_label` / `country_label` ("Bangkok specialties", "Thailand classics").
  Each dish has a page describing it and the best-rated restaurants that serve them (Google Maps rating and review count
  read in Chrome, a link proving the dish is on the menu: Michelin Guide page, the menu, a local
  food guide). Leave out places under about 4.0. It renders as the "Local food to try" card with
  dish filters; it is not part of the totals.
  **Every tour gets a photo.** After the activities are merged, run `scripts/fetch_activity_images.py trip.json`: it
  stores each tour page's og:image in `activities/activity_images.json` and on the line as `image`. Most sites refuse
  plain fetches (GetYourGuide, Klook, Trip.com, Expedia): for every URL it reports MISS, open the page in Chrome, read
  `document.querySelector('meta[property="og:image"]').content` (for us.trip.com detail pages take the first large
  product photo instead; "things-to-do/list" search links have no image), add it to the cache and rerun with
  `--apply-only`. Rerun `--apply-only` after any merge that rewrites the activity lines.
  **Every dish gets a photo.** Give each dish `wiki` (its English Wikipedia article, e.g. "Peking
  duck") and run `scripts/fetch_dish_images.py trip.json`: it takes the article's lead photo from
  Wikimedia Commons (free licence, credited on the page, stable URL) and adds a Google Images search
  link for more photos. Commons rather than Google Images because Google's results are other sites'
  copyrighted photos behind short-lived URLs. Look at every match (the script prints where each came
  from; a contact sheet or the built page shows them) and fix a wrong one with
  `--set id="Article"` or `--set id="File:Name.jpg"`. The card shows a photo strip of every dish and a
  larger photo with its credit for the chosen dish.
- **Buses, trains & metro (same-country trips).** When the origin is in the destination's country (deeplinks.py
  then prints a `ground` link per site: Rome2Rio, Google Maps transit, Busbud, and the national sellers such as ClickBus
  and Buser in Brazil, Amtrak / Greyhound / Wanderu in the US, Trainline / Omio / FlixBus in Europe, 12Go in Southeast
  Asia), research the intercity buses and trains for the travel date: up to 5 departures per site across the day, with
  operator, seat class, terminals, times, duration, price and rating, each linking the dated results page. Say plainly
  when no passenger train runs (`ground.no_train_note` with a source). Add how to reach each bus or train station, and
  the destination's metro / bus / BRT fares and fare card (official operator pages). Write it to `ground`
  (`references/trip-schema.md`); it renders as the "Buses, trains & metro" card before Local food, with a cheapest
  bus vs cheapest flight comparison. Not in the totals.
- **Popular day trips.** List the 6-8 most popular day trips from the destination (tourism board, Wikivoyage
  "Go next", Tripadvisor). For each: distance and drive time, why go, entry fee (official site), and every way to get
  there with a round-trip cost per person: public bus or train (operator timetable and fare), rental car (fuel and
  tolls, labelled an estimate), ride app if sensible, and an organized tour with its rating. Give each a `wiki` title;
  `fetch_dish_images.py` adds a credited photo. Write them to `day_trips`; they render as the "Popular day trips" card
  next to Buses, trains & metro. Not in the totals.
- **Best restaurants.** Beyond the dish-led Local food card, list the 10-12 best-rated local restaurants and 10-12
  international ones across different cuisines (Google Maps 4.5+ with many reviews, nothing under 4.3; candidates from
  respected local lists and awards), each with cuisine, area, coordinates, rating, review count, price level, what it
  is known for, why it is on the list, Google Maps link, the list or award page, and its own `website`
  (the Website link on its Google Maps page). `fetch_dish_images.py` then adds a photo from the website's share
  image (og:image), credited to the restaurant; logo-only images are skipped and the row keeps an icon. Write them to `restaurants`; they
  render as the "Best restaurants" card after Local food, filterable by local / international and cuisine.
- **Rainy season.** `fetch_weather.py` writes all 12 months of rain and a first guess at the rainy
  season; confirm the months with the national weather service or tourism board and overwrite
  `weather.rainy_season` {months, label, peak, source, source_url}, and replace `climate_months` with
  the official monthly table when one exists. When the season starts or ends mid-month, add
  `"start": "05-15"` / `"end": "10-15"` so trip days after the end are not counted as rainy. The weather card opens with a coloured rainy-season
  panel (red: trip inside it, amber: partly or right next to it, green: dry season), a 12-month rain
  chart with the trip months outlined, and the share of trip days likely to rain.
- **Weather.** Run `scripts/fetch_weather.py trip.json` (Open-Meteo, no key). It stores the real
  daily forecast for every trip day inside the 16-day window and the monthly normal for the rest,
  with links to verify. Reanalysis runs cool on coasts: check the national weather service's climate
  table (or timeanddate's climate page) and overwrite the month's `high_f`/`low_f`/`rain_days` with
  it, citing the page. The card sits above the map: "Normally during November in Phuket, the weather
  is 77–89 °F…" plus a tile per day.
- **Dates carry their weekday.** Write dates as "Sun Nov 1 2026" / "Sun 1 – Sat 14 Nov 2026". The
  build adds the weekday to any date in item text that lacks one, the page formats every date it
  prints with the weekday, and the title reads "Phuket, Thailand · Sun 1 – Sat 14 Nov 2026 (13 Nights)".
- **Proof of onward travel (sidebar card).** Fill `trip.onward_ticket` {status, level, note, options,
  tip}: say whether this trip needs one (one-way into a visa-exempt country usually can), and list
  only real, verifiable options: onward-ticket rental services that make a genuine reservation with
  a PNR checkable on the airline's site (OnwardTicket.com, BestOnwardTicket.com — verify each still
  says so), a refundable fare out, or a cheap real ticket out. Never link "dummy" or "fake" ticket
  generators: a fabricated ticket shown to an airline or immigration is misrepresentation and can get
  the traveler refused boarding or entry. If the user asks for one, explain that and offer these.
- **Sidebar essentials, in this order:** entry must-haves; currency (rate plus what $10 and $20 are in
  local money); "Your selection" (collapsed at first: the open tab and its total; expanded, every ticked
  line grouped by category with its price, each name a direct link to that listing); rainy season; calendar of the trip month(s) (stay highlighted, check-in/out ends,
  ✈️ on flight days, today marked); Custom trip total; airport → stay cost together with the ride apps
  used there; SIM & eSIM; proof of onward travel. Set `trip.ride_apps` [{name, url, note}] (the apps locals actually use,
  most used first), `trip.uber_available`, and `trip.fx` {code, rate, checked_at, url} (today's rate
  from open.er-api.com, linked to a converter). The right-hand sidebar shows: rainy season and the %
  of trip days likely to rain, entry must-haves (status "required" items), the Custom trip total,
  airport → stay cost, local SIM average, ride apps (Uber struck through when absent) and the rate.
- **Every line has a link** the user can open to verify or buy: items, restaurants, dishes,
  transfers, SIMs, weather. The build rejects homepages for items and warns when a link is missing.
- **Never book, pay, create accounts, enter personal data or solve a CAPTCHA.** You research and
  link; the user clicks and books.

**Browser: the user's own Chrome first, for every vendor.** The user asked that every run use their
personal Chrome profile through Claude in Chrome (`mcp__claude-in-chrome__*`; load
`anthropic-skills:chrome-browser` first). Their real profile and home IP pass the bot scoring that
the fresh, proxied built-in pane fails: Skyscanner, Booking.com Cars and Trip.com loaded there after
blocking the pane. Call `tabs_context_mcp` (with `createIfEmpty: true`), open your own tabs with
`tabs_create_mcp`, run every vendor's deep link there, and close your tabs at the end. It is their
browser, with their sign-ins: search only, never act on an
account, never sign out, and reject non-essential cookies only.

**Claude in Chrome is the browser for this skill (user's instruction, Oct 30 2026).** Every search, price
read and helper runs in Claude in Chrome. Before starting, call `tabs_context_mcp` (`createIfEmpty: true`); if it
reports "not connected", retry once, then ask the user to open Chrome with the extension signed in rather than
switching to the built-in pane. Start every helper with the same instruction. Use the pane only for the
human-check handoff below, or when the user says to.

**Chrome tab groups (user's standing instruction, Nov 1 2026).** Group the tabs of every Claude in Chrome
search by category, using exactly these group names, one group per category:

| Group name | What is searched in it |
|---|---|
| `travel planner flights` | every flight site (Google Flights, Kayak, Skyscanner, Trip.com, Booking.com, Expedia, Agoda) |
| `travel planner lodging` | every lodging site (Booking.com, Agoda, Airbnb, Hostelworld, Expedia, Trip.com, Google Hotels, Kayak, Skyscanner) |
| `travel planner transportation` | rental cars, airport transfers, buses, trains, metro / local transit |
| `travel planner activities` | activities and tours, popular day trips |
| `travel planner foodie` | restaurants, local food to try (Google Maps, Michelin, Numbeo) |
| `travel planner other essentials` | insurance and fees, SIM and mobile data, entry rules, weather, FX |

Every helper brief must name its group and say: open your tabs in that group, never touch another group's tabs,
close your tabs when done. As of Nov 1 2026 the Claude in Chrome tools (`tabs_context_mcp`, `tabs_create_mcp`)
take no group name and give each session one shared "MCP" tab group, so naming a group is not possible yet.
Until a tool offers it: (1) open each category's tabs together so they sit side by side; (2) use these group
names in every helper brief and report; (3) the moment a tab tool exposes a group or title parameter, create and
name the six groups before the first search and put every tab in its group. Say in the opening line if the
groups could not be named.

**Fallback when Chrome does not work** (the extension is not connected, a tool call fails twice, or
a site still shows a robot check / "Security Check — Continue" / a form that never submits there):

1. **The user takes over the pane and confirms they are human.** Open that vendor's same deep link
   in the built-in browser (`mcp__Claude_Browser__*`), call `tabs_context` to make sure the pane is
   displayed (if hidden, ask them to press Cmd+Shift+B / Ctrl+Shift+B), and tell them in one line:
   "You can take over the pane and confirm you're human on {site}; the pane keeps that session cookie
   afterwards." Wait for their reply, then read the results in the pane; later pages on that site go
   through on the same cookie. You never click, hold or solve the check yourself. If the user is not
   around to answer, finish every other vendor first, leave the gated page open in the pane, and ask
   once at the end.
2. **Record `blocked`** with a one-line reason in `trip.notes` only when both fail, and keep the
   site's results link in the Master Search List with a note. Some failures are not bot checks
   (Agoda's flight form never accepts an origin; Trip.com Car Hire finds no cars for some long
   rentals): say what actually happened.

Say which browser read each price in the item `details` ("read in your Chrome", "read in the pane
after you confirmed"). With no browser at all, fall back to `WebFetch`/`WebSearch` and label every
result an estimate. `references/research-playbook.md` §4c has the per-site quirks.

### Search order: seven stages, a dashboard update after each (Phase A first, then Phase B)

Run these seven stages first for **budget + mid only (Phase A)**. When stage 7 of Phase A is built and
sent, repeat stages 1, 2, 4, 5 and 6 for **upper + luxury only (Phase B)**, then do the final build and
email. Stages 3 and 7's tier-independent work is not repeated.

The user set this order: flights first, stays second, then the rest in the order that is fastest and
lets each stage feed the next. After every stage, rebuild to the same output path and send the file
when it is quick to do (a build takes seconds); `--partial` lists the sections still being searched,
so the open page shows "still searching" placeholders for them and reloads itself every minute
(skipping a reload while the user scrolls or types, and keeping their ticks).

1. **Flights** on every site (economy and business searches), with **each flight's details panel
   opened** (Booking.com "View details", Google Flights row expand, Kayak / Expedia / Trip.com
   details): every leg's flight number, each layover's airport code, city and minutes, aircraft,
   legroom, and the economy / basic fare's carry-on and checked-bag allowance or fee. Add `entry`,
   `search_links` and the `coverage` cells you have, then
   `python3 ${CLAUDE_SKILL_DIR}/scripts/build_dashboard.py trip.json --partial lodging,car,transfer,activities,food,transport,sim,insurance -o <name>-trip-dashboard.html` → send.
2. **Stays**: tourist neighborhoods, then stays per area and tier on every lodging site; tick one
   default stay per tier. Then `python3 ${CLAUDE_SKILL_DIR}/scripts/build_dashboard.py trip.json --partial car,transfer,activities,food,transport,sim,insurance -o …` → send.
   Start the scripts that need no browser in the background now: `fetch_pois.py` for each default
   stay (write to a copy with `-o pois_out.json` so it never rewrites `trip.json` under you; merge
   its `nearby` when it exits), `fetch_weather.py`, and today's exchange rate.
3. **Airport transfer, SIM / eSIM, entry rules**: short official pages; the transfer needs stage 2's
   stays and the flight's arrival airport. `python3 ${CLAUDE_SKILL_DIR}/scripts/build_dashboard.py trip.json --partial car,activities,food,transport,insurance -o …` → send.
4. **Rental cars, then buses, trains & metro** (same-country trips): car pick-up starts after the
   flight lands; the ground card compares buses with stage 1's cheapest flight, and the bus sites
   also show the regional operators stage 5 needs. `python3 ${CLAUDE_SKILL_DIR}/scripts/build_dashboard.py trip.json --partial activities,food,insurance -o …` → send.
5. **Activities, then popular day trips**: the activity sites already list the day tours with prices
   and ratings, and stage 4 gave the bus operators and fares; run `fetch_dish_images.py` for the
   day-trip photos. `python3 ${CLAUDE_SKILL_DIR}/scripts/build_dashboard.py trip.json --partial food,insurance -o …` → send.
6. **Local food, then best restaurants** (one Google Maps session; restaurant distances use stage 2's
   stays), then daily spend, insurance and curated hospitals. Build with `--map-pending` if the map
   places are still downloading, else the normal build → verify → send.
7. **Map places**: when `fetch_pois.py` exits, merge its `nearby`, run the normal build (no flag) to
   the same output path, verify, send the final file (a copy on another device does not refresh),
   then email it (Step 6). If it reports "0 of 1 stays" for some, retry those once; if they still
   fail, ship anyway and say which stays use the live map.

Split each stage's sites across helpers (one or two sites each, saving JSON as they go), each started
with `model: "sonnet"` and `effort: "high"` (Opus / high only if Sonnet is unavailable; see Model and effort). A stage's
helpers can start while you merge the previous stage, as long as they work on different sites
in their own Chrome tabs.

## Step 3 — Build the nearby-places cards (there is no map)

**No map (user's standing instruction, Nov 2 2026).** Dashboards have no map and no map text: OpenStreetMap's tile servers answer
403 / slow, so the Leaflet map was removed from the template. What stays: the stay picker, the "paste an address" box, the category
tabs (Hospitals, Pharmacies, Grocery, Nightlife, Nature, Hotels, Car rental, Stations) and one card per category, each **full width on
its own row**, plus the airport-to-stay card first in that grid. Do not add a map, map tiles or Leaflet back.

For the selected stay the cards list hospitals, pharmacies, grocery, nightlife, nature, hotels, car rental and transit within 5
miles. Three things make that work:

1. **Coordinates for every stay** (`lat`/`lng`). Get them with
   `python3 scripts/geocode.py "Hotel name or address, City"` (OpenStreetMap geocoder, no key), or
   read them from the listing page. Without coordinates a stay does not appear on the map.
2. **Embedded places.** Once `trip.json` exists with its stays (step 4), and before you build, run
   `python3 scripts/fetch_pois.py trip.json`. It pulls the 5-mile places for each stay from
   OpenStreetMap (Overpass), retrying across mirrors with backoff, and writes them into the JSON
   under `nearby`. Do this at build time because the public Overpass servers are often at capacity
   and a browser gives up after ~30 s; with the snapshot embedded the map answers instantly, and the
   page keeps a live "Refresh" fallback plus Google Maps "nearby" links for ratings. The script can
   take several minutes when servers are busy: run it in the background and ship the
   `--map-pending` build meanwhile (above).
3. **Curated `pois`**: the 2–3 highest-rated international / private hospitals (with their rating,
   where the rating came from, and a link), plus anything else worth pinning (24-hour pharmacy,
   embassy). OpenStreetMap has no ratings, so this is the only way "high-rated" gets onto the map.
   Search the web for "international hospital {city} English-speaking", open the Google Maps page for
   each candidate to read its rating, and record the Google Maps URL as the source.

4. **Airport route (user's standing instruction, Nov 1 2026).** Run
   `python scripts/airport_routes.py trip.json` once the stays and `trip.arrival_airport` (with lat/lng)
   exist. It writes the road distance and no-traffic drive time from the airport onto every stay and
   neighborhood (`airport_km`, `airport_drive_min`, OSRM, cached in `work/`). The page then shows, for the
   selected stay, a card (first in the grid beside Hospitals, Pharmacies and
   Grocery) with the road distance, ride-app time and fares, and the public-transport option. The public-transport option is the nearest stop from
   `trip.airport_bus` (`routes[].stops[]` with lat/lng, first/last times, `every_min`,
   `ride_to_airport_min` / `ride_from_airport_min`, fare) and `drive[]` (`min_no_traffic` / `min_traffic`
   per area). Research those timetables in Chrome (tab group "travel planner transportation").

**Lodging type filter (user's standing instruction, Nov 2 2026).** The Lodging card has a Type filter floated right on
the Tier row: Hostel (a dorm bed), Private room (your own room: hotel, guesthouse, a room in a host's home) and
Entire place (the whole apartment, villa or house). Every lodging line gets `stay_type`
(`hostel` | `private` | `entire`) from `pick_custom_stay.py` / `build_dashboard.py` (`stay_type()`), which reads the
provider, `room_type` (record it for Airbnb and Booking.com) and the name. Airbnb's "entire place" is trusted as is.

**Cheapest way to get there (user's standing instruction, Nov 2 2026).** The Rental Cars & Transportation tab opens
with a "Cheapest way to get there" card: whole-trip routes from the origin to the stay as a chain of legs (bus,
minivan, train, flight, ferry, ride app), with the total price and time, the Cheapest and Fastest badges, and a
"Cheapest that arrives on check-in day" pick. It reads `trip.routes`: `routes[]` (each with `legs[]`: mode, from, to,
operator, price, duration_min, depart, arrive, wait_after_min, url, verified), `last_mile` (per arrival point and area,
for routes that end at a bus terminal) and `ferry` (one line, even when the answer is "none that helps"). The page adds
the last leg to the stay selected under "What's near your stay". Build it in two parts:
1. Flight combos: `scripts/routes_build.py trip.json` (ground leg to each airport + the cheapest flight, the cheapest
   with a free checked bag and the quickest nonstop; adapt its `GROUND` table to the origin).
2. Overland and mixed routes: have a helper research every way by land and sea (direct buses, train + bus chains,
   ferries, Rome2Rio's suggestions) into `info/routes_overland.json`, in the same leg shape, and the last mile from each
   terminal to each area.

**Rated map lists (user's standing instruction, Nov 2 2026).** The map's Hospitals, Pharmacies and Grocery columns list
only places with a Google Maps rating and review count ("★ 4.5/5 · 480 reviews"): all hospitals and 24 h clinics, only
big reliable pharmacy chains (Phuket: Boots, Watsons) and supermarket chains (3+ island branches, not convenience
stores), each branch 3.5+ stars with 20+ reviews. Helpers write `info/poi_hospitals.json`, `info/poi_pharmacies.json`,
`info/poi_grocery.json` (shapes in `references/trip-schema.md`); `scripts/poi_merge.py trip.json` merges them into
`pois`.

**Rating colors (user's instruction, Nov 2 2026).** Everywhere a rating shows on the dashboard (stays, cars, activities,
restaurants, map places) the star is gold, the number is bold and the review count is blue. Map place cards show only
name, hours, distance with walking and driving times, rating and phone (see `references/trip-schema.md`).

**Flight bag filters (user's standing instruction, Nov 2 2026).** The Flights card has two toggle chips,
"Free carry-on" and "Free checked bag", floated right on the Time of day row (they can be combined). They read
`flight.bags.carry_on` and `flight.bags.checked` and count a bag as free only when the value is exactly `true`
(a fee string like "$22" or `false` is not free). So record both fields on every flight line, as `true`,
`false`, or the fee as text.

**Return to airport and Cheapest / Fastest (user's standing instruction, Nov 1 2026).**
- **The Return to airport category:** every trip gets a `return` category (label "Return to airport"),
  with lines from each stay area back to the departure airport, in the Rental Cars & Transportation tab.
  Cover every way that exists: public bus, shared van, ride apps (Grab/Bolt/Uber), taxi, tuk-tuk,
  pre-booked private car, and train or metro where the city has them. Say so in `return_info.rail`
  when it has none.
- **Line fields:** each line carries `neighborhood` (the area id), `mode` (bus | shared | rideshare |
  taxi | tuktuk | private) and `duration_min` (door to door, with `duration_note` saying how it was
  worked out).
- **Defaults:** each tier ticks a return line, and so does Custom (`pick_custom_stay.py`).
- **Arrival transfers:** they carry the same `mode`, `neighborhood` id and `duration_min`.
- **Cheapest / Fastest badges:** on both the Airport transfer and Return to airport cards, the dashboard
  marks the Cheapest and the Fastest line for the selected stay's area. On a tie in time, a live
  price beats an estimate, then the lower price wins. Both cards open filtered to that area.

## Step 4 — Write the trip JSON and build

Write `trip.json` following `references/trip-schema.md` exactly (field names matter: the template
reads them). Include `search_links`, the dashboard's **Master Search List**: for every vendor and
every category you searched, the URL of that site's full results page for the route, dates and
guests, so the user can redo any search by hand later. Start from

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/deeplinks.py MCO GIG 04/01/2027 05/01/2027 --one-way --search-links
```

then replace every entry that still carries a "fill the form" note with the results URL you copied
during research (read it from `tabs_context` in Chrome), and add a `note` where the user must do
something on arrival ("press Continue on Kayak's check", "type the origin on Agoda"). When you learn
a new site id (Skyscanner `entity_id`, a car-hire place id, a Trip.com city id, a GetYourGuide
location id), add it to the id tables at the top of `deeplinks.py` so the next run gets a real
results link straight away.

Start `scripts/fetch_pois.py trip.json --stay-id <default stay>` in the background for at least each
tier's default stay (step 3), send the `--map-pending` build while it runs, then once it exits:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/build_dashboard.py trip.json -o lisbon-2026-11-trip-dashboard.html
```

The script validates the JSON (required fields, dates, tier and category ids, homepage links),
prints a per-tier total so you can quote it, and writes the HTML. Fix every error it reports; treat
its warnings (missing coordinates, many estimates) as a to-do list, not noise.

Save the output in the trip's own folder under `~/travel-planner-trips/` (see "Where trips are saved")
with a descriptive name: `<destination>-<yyyy-mm>-trip-dashboard.html`. Keep `trip.json` next to it so
the dashboard can be rebuilt after edits.

**Neighborhood photos (user's instruction, Nov 2 2026).** Every tourist-neighborhood tile in the Lodging section shows a photo of
the place. Run `python scripts/fetch_neighborhood_images.py trip.json` after writing `neighborhoods`: it finds a freely licensed
Wikimedia Commons photo per neighborhood (Wikipedia article about the place, then a Commons search), stores it as
`neighborhoods[].image` with credit and license, and prints each match. The article must mention the city or country (so
Wikipedia's "Kata" martial art is skipped). Check each printed match and fix a wrong one with `--set <id>="Article title"` or
`--set <id>=File:Name.jpg`, or put the title in `neighborhoods[].wiki` up front.

**Saved ticks belong to one build (bug fixed Nov 2 2026).** The page remembers the user's ticks in their browser. After a redone search the
line ids change, so old ticks pointed at stays that no longer existed and the Custom total silently lost its stay. The template now
stores a fingerprint of the build's lines (`DATA_SIG`) with the ticks and ignores saved ticks from any other build. Never remove it.

**Every stay must have air conditioning and wifi (user's standing instruction, Nov 2 2026).** A stay without both is never listed, in any
tier, area or site: tropical heat and remote work make them a requirement, not a nice-to-have.
- **How:** switch on each site's amenities filters for both before reading results: Booking.com facilities "Air conditioning" + "Free WiFi";
  Airbnb amenities "Air conditioning" + "Wifi"; Agoda facilities "Air conditioning" + "WiFi in all areas / free WiFi"; Expedia "Air
  conditioning" + "Wifi" / "Free wifi"; Trip.com facilities "Air conditioning" + "Wi-Fi"; Google Hotels amenities "Air-conditioned" +
  "Wi-Fi"; Kayak and Skyscanner "Air conditioning" + "Wifi"; Hostelworld facilities "Air conditioning" + "Free WiFi" (dorm and private rooms).
- **If a site has no such filter:** open the listing (or read the card's amenity line) and keep the stay only when both are shown. Never assume
  a hotel has them. Say in `gaps` which site had no filter.
- **Record it:** every lodging line gets `"amenities": {"air_conditioning": true, "wifi": true}` from the listing. A line where the page does not
  say, or says one is missing, is dropped, not kept with a note. The build warns about lodging lines without both flags.
- **Defaults:** the ticked stay of every tier and the Custom stay must have both flags `true`.
- **Existing dashboards:** this applies to future searches; do not rerun an old trip's search just for it unless the user asks.

**Phone layout (user's instruction, Nov 2 2026).** At 760px wide or less the same self-contained HTML becomes an app: a bottom navigation bar with
Trip (overview, totals, the essentials sidebar, Master Search List), Fly & stay, Transport, Food, Activities and Essentials (insurance, SIM, onward
travel, weather, nearby places); a sticky top bar with the screen title and the running total (tap it to go to Trip); one screen at a time;
cards that grow with the page and show the first 25 lines with a "Show 25 more" button instead of a scroll box; 38-46px tap targets; swipeable
tier tabs and filter chips; `viewport-fit=cover` and safe-area padding. Desktop is unchanged. Rules when changing the template: test at 390px, keep
`document.documentElement.scrollWidth` equal to the viewport width on every screen (one wide element makes phones zoom the whole page out), and keep
all rules under `body.m` (set by `mSync()`). The email tells phone users to open the attached .html in Chrome (Android) or Safari (iPhone, via Save
to Files): an email app's built-in preview cannot run scripts.

**Your selection order (user's instruction, Nov 2 2026).** The sidebar's "Your selection" list and the copied summary list ticked lines in trip order:
Flight ticket, Checked bag, Transport to the airport (origin city to the departure airport), SIM & mobile data, Rental car (only if ticked),
Transport to your stay, Lodging, Activities & tours, Food & daily spend, Daily Transportation Spend Estimate, Return to airport, Insurance & fees,
then anything else. A transfer counts as "to the airport" when its id or `exclusive_group` contains the origin city (`transfer-pattaya-...`)
or it has `"leg": "origin"`; every other transfer is "to your stay".

**The Daily Transportation Spend Estimate is required (tiers.md; missing from the first Phuket run, fixed Nov 2 2026).** Every trip has a "Daily Transportation Spend Estimate" card in
the Transportation tab with `transport` lines (unit `per_day`, so the page multiplies by the trip's days): one ticked line per tier plus
alternatives, built from the local fares you already read (`ground.local_transit`): budget = a transit day pass (or 3 songthaew / bus rides),
mid = a day pass + 1 rideshare, upper = 2-3 rideshares, luxury = a private driver for the day (quote a chauffeur service). Give each line a
direct link to the fare source, the THB basis in `price_note` and `details`, and `verified: false` unless the fare was read on the
operator's page. The build warns when the trip has none.

**Stay mix: mostly an entire place to yourself (user's standing instruction, Nov 2 2026).** Search for stays so that
**about 70% are an entire place with no shared occupancy**, and the other **30% are private rooms and the best
hostels**. This applies to every city and every tier.
- **Entire place** (the 70%): an apartment, condo, villa, house, townhouse or studio that only you use (kitchen or
  bathroom not shared with strangers). A hotel room is not an entire place: it is a private room.
- **The other 30%:** private rooms (hotel rooms, guesthouse rooms, a private room in a host's home) and hostels.
  Hostels are only **the best ones according to Hostelworld**: sort Hostelworld by rating and take the top-rated
  hostels in the area (8.5/10 or better with 100+ reviews, award winners first). Do not list weaker hostels from
  any other site.
- **How to reach 70%:** open every site's entire-place filter first, then fill the rest with private rooms: Airbnb
  "Entire home" place type; Booking.com property type Apartments / Villas / Homes; Agoda Apartment / Villa / Homes;
  Expedia Vacation rentals (entire home); Trip.com Apartments / Villas; Google Hotels Vacation rentals; Kayak and
  Skyscanner property type Apartments / Villas / Homes. Hostelworld only sells hostels, so it contributes just its
  best hostels; note that in `gaps`.
- **Per cell** (area × site × tier, the usual 5): aim for 4 entire places + 1 other; 3 + 2 is the minimum. Where a
  site has no entire places in a price band (a quiet area, or a tier like luxury with few villas), list what exists
  and say so in `gaps`. Keep the tier rules of `references/tiers.md`: entire places exist at every price level (a
  budget studio, a mid-tier flat, an upper-tier serviced residence, a luxury pool villa).
- **Record `room_type` on every stay** exactly as the site words it ("Entire home", "Apartment", "Deluxe Double Room",
  "Bed in 8-Bed Dormitory"). The dashboard's Lodging filter and `scripts/build_dashboard.py` use it to count the mix.
- **Default ticked stay per tier:** prefer an entire place; fall back to a private room only when no entire place with
  a good rating (4.5/5 or 8.5/10, 20+ reviews) exists in that tier.
- **Enforce it:** after `import_area_stays.py`, run `python scripts/stay_mix.py trip.json`. It keeps every entire place, drops
  hostel lines that are not top-rated on Hostelworld, and trims the lowest-rated private rooms per neighborhood until entire
  places are 70% (round-robin across the four tiers, so every tier keeps choice). Some sites list few entire places (Agoda, Trip.com
  and Expedia had only 0-2 per tier in Phuket), so searching alone often lands near 55-60%: say so in the closing summary.
  A site that shows a robot check ("press and hold") is recorded as blocked; never solve it. Ask the user to clear it in their
  own Chrome and retry, and keep that site's earlier lines meanwhile.
- **Check:** `build_dashboard.py` warns when fewer than 70% of the stays (overall, and per neighborhood) are entire
  places, and when a hostel line is not top-rated. Fix the warning by searching again with the entire-place filter,
  not by relabeling lines.

 The dashboard opens on the **Custom** tab (a
saved tier from an earlier visit never overrides that). Its stay is always a place you have entirely to yourself
(a whole apartment, studio, villa or house; never a hostel, dorm, shared flat or a private room in someone's
home) in a tourist neighborhood with good nightlife. Before every build run
`python scripts/pick_custom_stay.py trip.json`: it tags each stay `private_place` (entire / hotel / shared), picks
the cheapest strongly rated whole place in the nightlife areas, marks it `custom_default`, and marks the matching
airport transfer too. A neighborhood counts as good nightlife only when it carries the exact tag `Nightlife` (or
`good_nightlife: true`), so tag Patong-style bar districts that way and never tag a quiet area. Helpers should pass
the site's room type through as `room_type` on every stay ("entire place", "private room", "Deluxe Double Room",
"Bed in 10-Bed Dormitory Room"): that is what the picker reads. With no whole place in a nightlife area it falls
back to a private hotel room and says so; tell the user which rule it used.

## Step 5 — Verify, then deliver

Open the built file and check it before handing it over: the five tier buttons in the rail switch the totals,
unchecking a line changes the total, every link opens the right provider page, the Sources tab's Master Search List
lists a results link for every vendor × category you searched and its Sites-searched table shows the run, each
Workspace tab shows its cards and the bottom navigation lists those cards as chips, every card collapses and expands,
the Flights card has Tier / Airport / Departs / Bags / Site chips and the sort menu works (Morning / Afternoon / Night
list flights by departure time; each stop sits on the route line with its airport code and layover length), stays show
their rating, A/C, Wi-Fi and airport distance, the neighborhood and day-trip cards show their photos and the tours their
thumbnails, the Ledger drawer opens with the selected lines and prices, the rail's entry card shows what US citizens
need, the weather tab shows the forecast or the monthly normal, and the "What's near your stay" card shows the
airport-to-stay column, then the stay's hospitals, pharmacies and groceries (rated, with distance and walking time) and
the other place types. Use the built-in browser (serve the folder with `python3 -m http.server` through
`preview_start`; the pane cannot open `file://` paths) or publish it with the `Artifact` tool when
that tool exists (load the `artifact-design` skill first, as that tool requires). Send the file with
`SendUserFile` when available so it reaches the user's other devices.

Your closing message to the user should contain, in this order:

1. The resolved trip parameters (route, dates, travelers, currency).
2. A four-row table: tier → default total → what is included, per person.
3. The count of verified vs. estimated lines and which ones are estimates, so they know what to
   re-check before booking.
4. Where the file is, and one line on how to use it (tier buttons, Workspace tabs, checkboxes, Ledger, Sources tab).
5. One line on vendors: all ten searched, or which ones were blocked / had no inventory, and what
   you used instead.

Keep prices out of prose except in the table. Do not paste the item list into chat; the dashboard
is the item list.

## Step 5b — Organize the trip folder (user's instruction, Oct 30 2026)

Every run ends with a tidy trip folder: one subfolder per category, no loose working files. Helpers write
their JSON straight into the category folder (`stays/`, `flights/`, `food/`, `activities/`, `transport/`,
`transfer-sim/`, `insurance/`, `map/`, `info/`; `briefs/` for their briefs, `work/` for scratch), so tell each
helper the full path in its brief. Scripts read helper files with a recursive glob
(`glob.glob('**/stays_*.json', recursive=True)`), and a script kept in `work/` finds the trip folder as its
parent. When every helper has finished and the final build is verified, before the email, run:

```bash
python ${CLAUDE_SKILL_DIR}/scripts/organize_trip.py <trip folder>          # add --dry-run to preview
```

It moves stays files to `stays/`, flights to `flights/`, local food, restaurants and daily spend to `food/`,
activities and day trips to `activities/`, buses and trains to `transport/`, SIM and airport transfer to
`transfer-sim/`, insurance to `insurance/`, map places and hospitals to `map/`, weather and entry rules to
`info/`, briefs to `briefs/`, and logs, flags and one-off scripts to `work/`. `trip.json`, the dashboard
`.html`, the `.eml`, `closing-summary.md`, `email-preview.html` and the run timer stay at the top. It is safe to
run twice and never overwrites. Rebuild commands then use `trip.json` at the top as before.

## Step 6 — Email the result

Every run ends with this step: when the final build is delivered (after Phase B, or after Phase A when the user asked for budget + mid only), email it to the requester without being
asked and without asking for confirmation, at the address they gave (pass it with `--to`); if none is known,
ask for it (one question) and send when they reply (skip the email only if they decline).
**Send only when everything is finished**: every stage researched and merged, the photos fetched, and the map
places embedded for every default stay (stage 7 done, final build without `--partial` or `--map-pending`).
If `fetch_pois.py` is still running, wait for it; if a stay still fails after one retry, do the final build,
say in the email which stay loads its map live, and send. Build the message first:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/email_results.py trip.json dashboard.html \
  --summary closing-summary.md --to you@example.com
```

The email body is a **styled one-page summary of the dashboard** that the script builds from the trip JSON (inline styles and tables, so Gmail, Outlook and Apple Mail show it the same): trip header, the red entry banner, a card per tier with its default flight / stay / transfer / SIM and total, where the money goes, the cheapest flight in each part of the day with its stops, stays by neighborhood, weather, currency, airport transfer, SIM, local food photos, caveats and sources checked. Add `--preview email-preview.html` and look at it in the browser before sending. The email you create also contains: a **subject line you write** ("Trip plan: Rio de Janeiro → Belo Horizonte ·
Fri Jan 15 2027 · 1 traveler · from $214"), the **summary** (the same content as your closing message:
parameters, tier table, verified vs estimate, vendors, key notes), and the **attachments** needed to view the
trip on any computer: the self-contained dashboard `.html`, the trip `.json`, and a how-to-open note. Write
`closing-summary.md` first; the script turns it into the plain-text and HTML bodies.

**Host the dashboard first (user's instruction, Nov 6 2026)** so the email carries a link that opens in a browser with
no download: Gmail shows an attached `.html` as source, never rendered. Make a hostable copy with every photo embedded
(the Artifact host blocks images from other sites) and publish it:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/make_hosted.py <trip>-dashboard.html <trip>-hosted.html   # needs Pillow: pip install pillow
```

then publish `<trip>-hosted.html` with the `Artifact` tool (icon "map", a one-sentence description). The link is private to
the user's Claude account until they allow link access from the page's Share button: say so in the email and the closing
message. Put the link first in the email body. Rebuild and republish the same file path when the dashboard changes.

Then send it. **The Gmail connector is the go-to; Chrome is the fallback (user's instruction, Nov 6 2026).**

1. **The Gmail connector** (the `send_message` tool of the Gmail MCP server; load it with `ToolSearch` if it is deferred):
   `to` = the address, your subject, `htmlBody` = the styled summary from `email_results.py --preview` (inline styles) with the
   hosted link at the top, `body` = the plain-text summary, `includeSignature: true`. Attachments go in `attachments` as
   base64 only when the file is small (under about 300 KB); the dashboard and trip JSON are far bigger than fits in one tool
   call, so for those send the message with the hosted link and, when the user wants the files too, attach them with step 2.
   Confirm the returned message `id` before saying it was sent.
2. **Gmail in the user's Chrome (Claude in Chrome)**, only when the connector is not connected, its send fails, or a large
   attachment is needed: compose to the address, paste the subject and summary, attach the files with `file_upload`, and
   press Send only because this standing instruction authorizes mail to the user's own address. Never send to anyone else
   without asking.
   How: open https://mail.google.com/mail/u/0/?view=cm&fs=1&to=<address>&su=<subject>, then load the styled body without
   pasting it as text: build the HTML string in `javascript_tool`, put it in a `DataTransfer` as `text/html` and dispatch a
   `paste` ClipboardEvent on `div[aria-label="Message Body"]` (Gmail enforces Trusted Types, so `insertHTML` is refused; the
   paste event is accepted). `file_upload` the dashboard and trip JSON into Gmail's hidden `input[type=file]`, wait for the
   chips to finish uploading, check To / subject / attachments, then Send, open Sent and confirm the message is there.
3. Resend, if its MCP server is authorized and neither of the above is available.
4. None available: run the script with `--open` so the `.eml` opens in the default mail app, and tell the user
   plainly that it was prepared but not sent, with the path.

Say in the closing message whether the email was sent, drafted or only prepared. Never claim it was sent
unless a tool confirmed it.

## Refresh: update out-of-date prices in an existing dashboard (user's instruction, Oct 30 2026)

Prices move daily. When the user asks to update, refresh or re-check a trip made earlier ("update the
prices", "refresh my Pattaya trip", "is this still right?"), do not start a new trip. Reuse the same trip
folder, `trip.json` and dashboard file name, re-read today's prices, and rebuild in place.

1. **Find the trip.** It is the newest matching folder in `~/travel-planner-trips/` (ask only if several
   fit). Read its `trip.json`. If check-in is today or already past, say so and offer a new search with new
   dates instead (the scan warns about this).
2. **Scan.** `python ${CLAUDE_SKILL_DIR}/scripts/refresh_trip.py scan <trip folder>/trip.json`
   lists every line older than 3 days (`--days N` to change; estimates always count) by provider and writes
   `<trip folder>/refresh/worklist.json`. Add `--categories flights,lodging,car` when the user names
   categories ("just flights and stays", "only the rental car"), or `--defaults-only` for a quick pass
   over the lines that make up the tier totals. A quick refresh can be limited to that and the user told so.
3. **Re-read the prices (Sonnet / high helpers in the user's Chrome, same safety rules and pacing as the
   original run).** One helper per one or two providers, each given its slice of the worklist, in this order:
   flights, stays, rental cars, then transfers, activities, buses and the rest if in scope. For each line the
   helper opens its `url` (the dated listing), reads today's price on the page the same way the original
   price was read (same unit and basis: per night vs 3-night total, taxes in or out, per person), and notes
   the rating and review count if shown. Lines on ticked-by-default rows come first. Helpers write
   `refresh/updates_<provider>.json`:
   `{"updates": [{"id", "price"}, {"id", "unavailable": true, "note": "sold out"}, {"id", "unreadable": true,
   "note": "bot check"}], "add": [new cheaper or better options found along the way]}`.
   A line that cannot be read stays as it was (old price, old date): never guess, never mark an estimate as
   verified. Unavailable lines get `"unavailable": true`; a bot check on a site means stop that site and mark
   its lines unreadable (see the playbook's Chrome-first ladder).
4. **Apply.** Combine the helpers' files into one `updates.json` (concatenate `updates` and `add`), then
   `python ${CLAUDE_SKILL_DIR}/scripts/refresh_trip.py apply <trip folder>/trip.json updates.json --build-to <dashboard>.html`.
   It backs up `trip.json` to `refresh/`, keeps each old price (`price_prev`) and date, sets
   `checked_at` to today, logs changes in `trip.price_history`, marks sold-out lines, and prints the tier
   totals before and after plus the biggest movers. If a default (ticked) stay, flight or car became
   unavailable, tick the next-best one in that tier by hand (`exclusive_group` allows one per tier), then
   rebuild. Re-run `fetch_weather.py trip.json` to refresh the forecast (it fills more days as the trip
   nears), and the exchange rate (`trip.fx`).
5. **Verify and deliver.** Open the rebuilt dashboard as in Step 5, check the header's "prices checked on"
   date, then send the file (`SendUserFile`) and email it (Step 6) with a subject such as
   "Trip plan UPDATED: Bangkok → Pattaya · Sat Oct 31 2026 · from $91". Run `organize_trip.py` last.
6. **Report what changed:** a four-row table (tier, old total, new total, change), the biggest movers,
   what is now unavailable, what could not be read, and how many lines are verified today. If nothing moved,
   say so plainly. Start the run timer (Run timer section) for refreshes too, in `refresh/.run_timer.json`.

## Resources

- `references/research-playbook.md` — how to search, read, capture URLs, label, and recover from blocks. Read first.
- `references/providers.md` — URL patterns per provider, parameters to keep, parameters to strip.
- `references/tiers.md` — what each tier means per category, and how to adapt bands to the destination.
- `references/trip-schema.md` — the trip JSON contract the template reads, with a full example.
- `references/entry-requirements.md` — what US citizens need to enter (visa, ETA, arrival card, vaccines) and how to research it for the red banner.
- `references/baggage.md` — how to price checked bags, with the airlines' official baggage pages.
- `scripts/refresh_trip.py` — `scan` lists out-of-date prices by provider; `apply` merges re-read prices into the same trip and shows the before/after totals (Refresh section).
- `scripts/organize_trip.py` — sorts a trip folder's working files into stays/, flights/, food/, activities/, transport/ and so on (Step 5b).
- `scripts/email_results.py` — builds the results email (.eml) with subject, summary and attachments (Step 6).
- `scripts/deeplinks.py` — search links for every provider from route, dates and guests.
- `scripts/geocode.py` — coordinates for an address via OpenStreetMap (polite, 1 request/second).
- `scripts/fetch_pois.py` — embeds the 5-mile places for every stay into the trip JSON (run before building).
- `scripts/import_area_stays.py` — merges the per-neighborhood stay files (helper output) into lodging lines, converting China's GCJ-02 coordinates.
- `references/area-stays-brief.md` — the brief to hand each stays helper (trip, areas, tiers, safety rules, output format).
- `scripts/fetch_dish_images.py` — a credited Wikimedia Commons photo and a Google Images link for every local dish.
- `scripts/fetch_weather.py` — embeds the forecast (inside 16 days) and monthly normals for the trip dates, with verify links.
- `scripts/assign_tiers.py` — tiers untiered items by price rank within their category (quality floors applied).
- `scripts/build_dashboard.py` — validate trip JSON and build the dashboard HTML.
- `scripts/make_hosted.py` — a hostable copy of a built dashboard (photos embedded, document wrapper dropped) for the Artifact host (Step 6).
- `scripts/fetch_activity_images.py` — a thumbnail for every tour line from its page's og:image (cached per trip; blocked sites are read in Chrome).
- `assets/dashboard-template.html` — the dashboard (generated: do not edit by hand); `assets/sample-trip.json` — a complete example input.
- `assets/dashboard-src/` — the template's sources (`control.html` shell, `engine.js`, `base.css`) and `assemble.py`, which regenerates `dashboard-template.html`.
- `assets/trip-request-form.html` — typeahead form (cities/airports dropdown, dates, travelers) that writes the prompt.
