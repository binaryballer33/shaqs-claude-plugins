# Brief template: stays searched neighborhood by neighborhood

Copy this into the scratchpad, fill the {placeholders} and the neighborhood table from the trip's
`neighborhoods`, and give each research helper one or two sites plus that site's known quirks
(`providers.md`). Four helpers with two sites each covered 8 sites × 6 Beijing areas (about 800
stays) in 25–40 minutes. Import their files with `scripts/import_area_stays.py`.

---


You are one of four helpers searching hotel/hostel sites in the user's own Chrome for a trip-cost
dashboard. The user asked for **at least 5 stays per neighborhood, per price tier, per site**.

## Trip
- {City, Country}. Check-in **{Day YYYY-MM-DD}**, check-out **{Day YYYY-MM-DD}** ({N} nights), **{n} adult(s), 1 room**, prices in **USD**.
- Today is {Day YYYY-MM-DD}.

## The neighborhoods (search each one on your sites)
| id | name (search text) | local name | centre lat,lng | counts as inside |
|---|---|---|---|---|
| {id} | {Name} | {本地名} | {lat,lng} | {streets, landmarks, stations, within ≈1.5 km} |

A stay belongs to an area only if its address, the site's area label, or its map pin puts it inside
(roughly 1.5 km of the centre). Ignore marketing names ("near Sanlitun", "adjacent to Wangfujing").
Areas that touch: put a stay in whichever centre is nearer. Never list the same property twice
for the same site.

## Every stay must have air conditioning AND wifi (user's standing instruction, Nov 2 2026)
Never save a stay without both. Turn on your site's amenities filters first (Booking.com "Air conditioning" + "Free WiFi"; Airbnb
"Air conditioning" + "Wifi"; Agoda / Expedia / Trip.com / Kayak / Skyscanner "Air conditioning" + "Wifi"; Google Hotels "Air-conditioned" +
"Wi-Fi"; Hostelworld "Air conditioning" + "Free WiFi"). If your site has no such filter, open the listing or read the card's amenity line and
keep the stay only when both are shown (note it in `gaps`). Add `"amenities": {"air_conditioning": true, "wifi": true}` to every stay you save.

## Stay mix: mostly entire places (user's standing instruction, Nov 2 2026)
**About 70% of the stays you save must be an entire place with no shared occupancy** (apartment, condo, villa, house,
townhouse, studio). The other 30% are private rooms (hotel rooms, guesthouse rooms, a private room in a host's home)
and **hostels, but only the best ones according to Hostelworld** (top-rated: 8.5/10 or better with 100+ reviews).
- Start every search with your site's entire-place filter: Airbnb "Entire home", Booking.com / Agoda / Trip.com /
  Kayak / Skyscanner "Apartments / Villas / Homes", Expedia and Google Hotels "Vacation rentals". Then add private
  rooms only to fill what is missing.
- Per tier per area, of the 5: 4 entire places + 1 other (3 + 2 at the least). If the site has fewer entire places in
  that band, save what exists and write the reason in `gaps`.
- Hostelworld helper: sell only hostels, so save the top-rated hostels per area (sort by rating), not the cheapest;
  do not pad the list with weaker ones. Other sites: no hostel lines unless it is one of Hostelworld's top-rated.
- Always fill `room_type` exactly as the site words it; it tells the dashboard which stays are entire places.

## Tiers (5 of each, per area, per site)
- **budget**: entire studios and small flats first, then the best-rated hostels (Hostelworld top-rated only), guesthouse rooms, private rooms, the cheapest well-rated hotels (prefer rating ≥ 7.5/10 or 3.8/5 with ~30+ reviews)
- **mid**: entire apartments and condos first, then 3-star hotels and good-value chains
- **upper**: entire serviced residences, villas and townhouses first, then 4-star and boutique / courtyard (siheyuan) hotels
- **luxury**: entire pool villas and penthouses first, then 5-star and luxury brands (Mandarin Oriental, Peninsula, Rosewood, Aman, Waldorf, Four Seasons, Bvlgari, etc.)

How: open the area search, sort by price low→high and read budget then mid; use the site's star
filter (4★, then 5★) for upper and luxury. Read the results page once and scroll; a JavaScript
read of the cards (`javascript_tool`) is fastest. If the site truly has fewer than 5 in a tier in
that area, list what exists and write the reason in `gaps` (e.g. "Hostelworld sells hostels only",
"only 2 five-star hotels in Guijie on Expedia").

## Safety rules (strict)
- Claude in Chrome tools (`mcp__claude-in-chrome__*`): load them with ONE ToolSearch call
  (`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__find,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_close_mcp`).
  Call `tabs_context_mcp` (createIfEmpty true), then open YOUR OWN tab(s) with `tabs_create_mcp` and
  use only the tab ids you created. Other helpers share the same Chrome window: never touch their tabs.
  Close your tabs when done. Your tabs belong to the Chrome tab group `travel planner lodging` (one group per category: `travel planner flights`, `travel planner transportation`, `travel planner activities`, `travel planner foodie`, `travel planner other essentials`; see SKILL.md "Chrome tab groups"): keep to your group's tabs.
- The user may be signed in to some sites (for example a hotel site with a loyalty account). **Search only.** Never book, pay, add to cart,
  create accounts, enter personal data, change settings, sign in or out, or click anything on the account.
  Cookie banners: reject non-essential / necessary only. Do not record any personal data you see.
- Never click, hold or solve a CAPTCHA or bot check ("press and hold", "verify you are human",
  Kayak "Security Check"). If one appears and does not clear by itself, stop that site and report it
  as blocked with what you saw.
- Keep batches small; if a navigation bounces back, retry once.

## Output: save after EVERY area (so nothing is lost if you are cut off)
Write JSON to the path your task gives you, shaped like:
```json
{"site": "Booking.com", "checked_at": "YYYY-MM-DD", "blocked": null, "notes": "site-wide quirks",
 "coord_datum": "WGS84 or GCJ-02 (mainland China: Booking, Skyscanner, Google and Expedia give GCJ-02; Trip.com WGS84)",
 "areas": {
   "sanlitun": {"results_url": "the area search URL you used", "how": "how you narrowed it to the area",
     "gaps": {"luxury": "reason"},
     "stays": [{"name": "…", "tier": "budget|mid|upper|luxury", "price": 0, "price_basis": "per_night|total_30_nights|total_28_nights",
                "amenities": {"air_conditioning": true, "wifi": true}, "room_type": "entire place | private room | Deluxe Double Room | Bed in 8-Bed Dormitory (as the site words it; needed for the Custom tab)", "taxes": "incl|excl|?", "price_local": {"amount": 0, "currency": "THB"} , "rating": 8.4, "rating_scale": 10,
                "reviews": 1234, "stars": 4, "address": "text from the page", "lat": null, "lng": null,
                "url": "property page with the dates if the site has one, else the results URL", "url_is_results_page": false}]}
 }}
```
`price` is in USD (convert only where the site refuses USD; then keep `price_local`). Read every
number off the page: never estimate. Use Python or a heredoc to write the file.

## When done
Reply with a short table: per area, the count per tier for each of your sites, the gaps, anything
blocked, and the file path(s). Under 200 words.
