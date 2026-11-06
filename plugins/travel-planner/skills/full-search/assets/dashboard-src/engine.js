/* TripEngine: shared data layer + rendering primitives for the redesigned trip dashboards.
   Every template includes this file, then supplies its own shell (layout, CSS, navigation).
   The markup it returns uses stable class names so each template can style it differently. */
window.TripEngine = function (DATA, opts) {
  'use strict';
  opts = opts || {};
  const trip = DATA.trip;
  const TIERS = [{ id: 'budget', label: 'Budget', short: 'Budget' }, { id: 'mid', label: 'Mid-tier', short: 'Mid' },
    { id: 'upper', label: 'Upper class', short: 'Upper' }, { id: 'luxury', label: 'Luxury', short: 'Luxury' }, { id: 'custom', label: 'Custom', short: 'Custom', custom: true }];
  const REAL_TIERS = TIERS.filter(t => !t.custom);
  const CAT_DEFS = [
    { id: 'flights', label: 'Flights', icon: '✈️' }, { id: 'lodging', label: 'Stays', icon: '🏨' }, { id: 'car', label: 'Rental car', icon: '🚗' },
    { id: 'transfer', label: 'Airport transfer', icon: '🚕' }, { id: 'return', label: 'Return to airport', icon: '🛫' }, { id: 'activities', label: 'Activities & tours', icon: '🎟️' },
    { id: 'food', label: 'Food & daily spend', icon: '🍜' }, { id: 'transport', label: 'Daily transport', icon: '🚇' }, { id: 'sim', label: 'SIM & mobile data', icon: '📶' },
    { id: 'insurance', label: 'Insurance', icon: '🛡️' }, { id: 'other', label: 'Visa & fees', icon: '🛂' }];
  const CATS = (DATA.categories || CAT_DEFS).map(c => ({ ...(CAT_DEFS.find(d => d.id === c.id) || {}), ...c })).map(c => c.id === 'lodging' ? { ...c, label: 'Accommodation' } : c);
  const catOf = id => CATS.find(c => c.id === id) || CAT_DEFS.find(c => c.id === id) || { id, label: id, icon: '•' };
  const items = (DATA.items || []).map(it => ({ ...it, tiers: it.tiers || (it.tier ? [it.tier] : []), default_on: it.default_on !== false }));
  const NB = (DATA.neighborhoods || []).filter(n => n && n.id && n.name);
  const nbName = id => (NB.find(n => n.id === id) || {}).name || id;
  // one color per neighborhood, used wherever an area is named (cards, pills, chips, the stay picker)
  const NB_PALETTE = ['#f472b6', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc', '#2dd4bf', '#fb923c', '#22d3ee'];
  const nbColor = id => { const i = NB.findIndex(n => n.id === id); return i < 0 ? '#94a3b8' : NB_PALETTE[i % NB_PALETTE.length]; };
  const nbPill = id => id && NB.some(n => n.id === id) ? `<span class="pill area" style="--nbc:${nbColor(id)}">📍 ${esc(nbName(id))}</span>` : '';
  const pois = DATA.pois || [];

  // ---- dates, money, text ----
  const d0 = new Date(trip.start_date + 'T00:00:00'), d1 = new Date(trip.end_date + 'T00:00:00');
  const nights = Math.max(1, Math.round((d1 - d0) / 86400000)), days = trip.days || nights + 1, travelers = Math.max(1, trip.travelers || 1);
  const cur = trip.currency || 'USD';
  const fmt0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = v => fmt0.format(Number(v) || 0);
  const money2 = v => v == null || v === '' ? '' : (Math.abs(Number(v)) < 100 && Number(v) % 1 ? fmt2 : fmt0).format(Number(v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const fmtDate = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const fmtDateY = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const fmtTime = t => { if (!t) return ''; const h = +String(t).slice(11, 13), m = String(t).slice(14, 16); return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`; };
  const fmtHM = m => m == null ? '' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  const hm = m => m == null ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;
  const toC = f => f == null || f === '' ? '' : Math.round((Number(f) - 32) * 5 / 9);
  const kmTxt = m => `${m.toFixed(1)} mi · ${(m * 1.609344).toFixed(1)} km`;
  const tripDays = () => { const out = []; for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) out.push(new Date(d)); return out; };
  const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS_L.map(m => m.slice(0, 3));
  const mi = (a, b, c, d) => { const R = 3958.8, toR = x => x * Math.PI / 180, dLat = toR(c - a), dLng = toR(d - b); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const tierLabel = id => (TIERS.find(t => t.id === id) || {}).label || id;
  const dPart = (d, o) => d.toLocaleDateString('en-US', o);
  const rangeTxt = (() => { const wk = d => dPart(d, { weekday: 'short' }), mo = d => dPart(d, { month: 'short' });
    return d0.getMonth() !== d1.getMonth() || d0.getFullYear() !== d1.getFullYear() ? `${wk(d0)} ${mo(d0)} ${d0.getDate()} – ${wk(d1)} ${mo(d1)} ${d1.getDate()}, ${d1.getFullYear()}` : `${wk(d0)} ${d0.getDate()} – ${wk(d1)} ${d1.getDate()} ${mo(d1)} ${d1.getFullYear()}`; })();
  const linkTo = (url, html, cls) => url ? `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${html}</a>` : html;

  // ---- state ----
  const KEY = 'tripdash3:' + (opts.key || 'tpl') + ':' + slug(trip.title + trip.start_date + trip.end_date);
  const DATA_SIG = (() => { let h = 5381; const str = items.map(i => i.id + (i.custom_default ? '*' : '') + (i.default_on ? '+' : '')).join('|'); for (let k = 0; k < str.length; k++) h = ((h << 5) + h + str.charCodeAt(k)) | 0; return String(h); })();
  const state = { tier: 'budget', group: 'fl', checked: {}, customInit: false, stayId: null, sort: 'price_asc', f: {}, dish: 'all', rkind: 'all', rcuisine: 'all', gmode: 'all', nbOpen: true, poiCats: ['hospital', 'pharmacy', 'grocery', 'transit'], open: {} };
  const store = {
    load() { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s.dataSig !== DATA_SIG) { delete s.checked; delete s.customInit; } ['tier', 'group', 'checked', 'customInit', 'sort', 'stayId', 'poiCats', 'collapsed'].forEach(k => { if (s[k] !== undefined) state[k] = s[k]; }); } catch (e) { } },
    save() { try { localStorage.setItem(KEY, JSON.stringify({ dataSig: DATA_SIG, tier: state.tier, group: state.group, checked: state.checked, customInit: state.customInit, sort: state.sort, stayId: state.stayId, poiCats: state.poiCats, collapsed: state.collapsed || {} })); } catch (e) { } }
  };
  store.load();
  if (!TIERS.some(t => t.id === state.tier)) state.tier = 'budget';
  const ck = (tier, it) => `${tier}:${it.id}`;
  const CUSTOM_BASE = items.some(it => it.tiers.includes('mid')) ? 'mid' : 'budget';
  const isOn = (tier, it) => state.checked[ck(tier, it)] !== undefined ? !!state.checked[ck(tier, it)] : (it.default_on && it.tiers.includes(tier === 'custom' ? CUSTOM_BASE : tier));
  function initCustom() {
    if (state.customInit) return;
    const cdGroups = new Set(items.filter(it => it.custom_default && it.exclusive_group).map(it => it.exclusive_group));
    items.forEach(it => { state.checked[ck('custom', it)] = (it.exclusive_group && cdGroups.has(it.exclusive_group)) ? !!it.custom_default : !!(it.tiers.includes(CUSTOM_BASE) && it.default_on); });
    state.customInit = true; store.save();
  }
  initCustom();
  function setOn(tier, it, val) {
    if (val && it.exclusive_group) items.filter(o => o !== it && o.exclusive_group === it.exclusive_group).forEach(o => { state.checked[ck(tier, o)] = false; });
    state.checked[ck(tier, it)] = !!val;
    if (val && it.category === 'lodging' && it.lat != null) state.stayId = it.id;
    store.save();
  }
  const qtyFor = it => it.qty != null ? Number(it.qty) : ({ per_person: travelers, per_night: nights, per_day: days, per_person_per_day: travelers * days, per_person_per_night: travelers * nights }[it.unit] || 1);
  const unitLabel = it => ({ per_person: 'per person', per_night: 'per night', per_day: 'per day', per_person_per_day: 'per person per day', per_person_per_night: 'per person per night', total: 'total' }[it.unit] || '');
  const line = it => Number(it.price) * qtyFor(it);
  const onItems = tier => items.filter(it => isOn(tier, it));
  const tierTotal = tier => onItems(tier).reduce((s, it) => s + line(it), 0);
  const tierCount = tier => tier === 'custom' ? items.length : items.filter(it => it.tiers.includes(tier)).length;
  const selectedStay = () => items.find(it => it.id === state.stayId && it.lat != null) || items.find(it => it.category === 'lodging' && it.lat != null && isOn(state.tier, it)) || items.find(it => it.category === 'lodging' && it.lat != null);
  const F = cat => (state.f[cat] = state.f[cat] || { vendor: 'all', tier: 'all', area: 'all', stype: 'all', part: 'all', airport: 'all', mode: 'all', bagCarry: false, bagChecked: false });

  // ---- sections and groups (templates decide how to present them) ----
  const GROUPS = [
    { id: 'fl', label: 'Flights', icon: '✈️', secs: ['flights'] },
    { id: 'st', label: 'Accommodation', icon: '🏨', secs: ['neighborhoods', 'lodging', 'nearby'] },
    { id: 'go', label: 'Transportation', icon: '🚕', secs: ['transfer', 'return', 'car', 'transport', 'ground'] },
    { id: 'ac', label: 'Things to do', icon: '🎟️', secs: ['activities', 'daytrips'] },
    { id: 'fd', label: 'Food', icon: '🍜', secs: ['food', 'localfood', 'restaurants'] },
    { id: 'es', label: 'Essentials', icon: '🧳', secs: ['entry', 'other', 'sim', 'insurance', 'onward'] },
    { id: 'wx', label: 'Weather', icon: '🌤️', secs: ['weather'] },
    { id: 'src', label: 'Sources', icon: '📚', secs: ['master', 'coverage', 'notes'] }];
  const SEC_LABEL = { neighborhoods: 'Where to base yourself', nearby: "What's near your stay", ground: 'Buses, trains & metro', daytrips: 'Day trips', localfood: 'Local dishes to try', restaurants: 'Best restaurants', entry: 'Entry rules', onward: 'Proof of onward travel', weather: 'Weather', master: 'Master search list', coverage: 'Sites searched', notes: 'Notes from the research' };
  const has = {
    cat: id => items.some(it => it.category === id),
    nearby: () => items.some(it => it.category === 'lodging' && it.lat != null), neighborhoods: () => NB.length > 0,
    ground: () => { const G = DATA.ground; return !!(G && ((G.options || []).length || (G.local_transit || []).length)); },
    daytrips: () => (DATA.day_trips || []).some(d => d && d.name),
    localfood: () => !!(DATA.local_food && ((DATA.local_food.dishes || []).length)),
    restaurants: () => !!(DATA.restaurants && (DATA.restaurants.restaurants || []).length),
    entry: () => !!(DATA.entry && Array.isArray(DATA.entry.items)),
    onward: () => !!(trip.onward_ticket && (trip.onward_ticket.options || []).length),
    weather: () => !!DATA.weather, master: () => !!(DATA.search_links && Object.keys(DATA.search_links).length), coverage: () => !!(DATA.coverage && Object.keys(DATA.coverage).length), notes: () => true
  };
  const secExists = id => has[id] ? has[id]() : has.cat(id);
  const secLabel = id => SEC_LABEL[id] || catOf(id).label;
  const groupsPresent = () => GROUPS.map(g => ({ ...g, secs: g.secs.filter(secExists) })).filter(g => g.secs.length);
  const groupOfSec = id => (GROUPS.find(g => g.secs.includes(id)) || GROUPS[0]).id;

  // ---- small pieces ----
  const revTxt = r => typeof r === 'number' ? r.toLocaleString('en-US') : esc(r);
  function rateHTML(o, defScale) {
    const src = o.rating_source ? (o.rating_url ? `<a href="${esc(o.rating_url)}" target="_blank" rel="noopener noreferrer">${esc(o.rating_source)}</a>` : esc(o.rating_source)) : '';
    if (o.rating != null) { const sc = o.rating_scale || defScale; return `<span class="rate"><span class="star">★</span><b>${esc(o.rating)}</b>${sc ? `<span class="rs">/${esc(sc)}</span>` : ''}${o.reviews ? `<span class="rv">${revTxt(o.reviews)} reviews</span>` : ''}${src && !/^(Agoda|Booking|Expedia|Trip|Kayak|Google|Skyscanner|Hostelworld)/i.test(o.rating_source) ? `<span class="rsrc">${src}</span>` : ''}</span>`; }
    return src ? `<span class="norate">No rating</span>` : '';
  }
  const badge = it => it.verified ? `<span class="badge live" title="Read on ${esc(it.provider)} ${it.checked_at ? 'on ' + fmtDate(it.checked_at) : ''}">Live${it.checked_at ? ' · ' + fmtDate(it.checked_at) : ''}</span>` : `<span class="badge est" title="${esc(it.source || 'Not read on the site')}">Estimate</span>`;
  const pill = (txt, cls) => `<span class="pill${cls ? ' ' + cls : ''}">${txt}</span>`;
  const cpill = t => { let h = 0; for (const ch of String(t).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return pill(esc(t), 'tag tc' + (h % 8)); };   // a stable color per tag text
  const chip = (label, n, pressed, data, style) => `<button type="button" class="chip${style ? ' nbchip' : ''}" aria-pressed="${!!pressed}"${style ? ` style="${style}"` : ''} ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
  const openBtn = it => `<a class="open" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">Open on ${esc(it.provider)}<span class="arr">↗</span></a>`;
  const tierPills = it => it.tiers.map(t => pill(esc((TIERS.find(x => x.id === t) || {}).short || t), 'tier t-' + t)).join('');

  // ---- flights ----
  const HEIGHT_IN = +(trip.traveler_height_in || 73);
  const PERIODS = [['morning', 'Morning', '🌅'], ['afternoon', 'Afternoon', '☀️'], ['night', 'Night', '🌙']];
  const periodOf = f => { if (f && f.period) return f.period; const t = f && (f.depart || ((f.legs || [])[0] || {}).depart); if (!t) return ''; const h = +String(t).slice(11, 13); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'afternoon' : 'night'; };
  const isFlight = it => it.category === 'flights' && it.flight && it.kind !== 'bags';
  const isBag = it => it.kind === 'bags' || /^bags-/.test(it.id);
  const minsBetween = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 60000) : null;
  function legroomFit(inches) { if (inches == null) return null; const need = HEIGHT_IN >= 74 ? 33 : HEIGHT_IN >= 72 ? 32 : HEIGHT_IN >= 69 ? 31 : 30; const ft = `${Math.floor(HEIGHT_IN / 12)}'${HEIGHT_IN % 12}"`;
    if (inches >= need + 4) return ['ok', `Roomy for ${ft}`]; if (inches >= need) return ['ok', `Enough for ${ft}`]; if (inches >= need - 1) return ['mid', `Tight for ${ft}`]; return ['bad', `Cramped for ${ft}`]; }
  const bagMark = v => v === true ? '<i class="yes">✓</i>' : v === false ? '<i class="no">✗</i>' : v ? `<i class="fee">${esc(v)}</i>` : '<i class="unk">?</i>';
  const bagWt = (kg, lb) => kg == null && lb == null ? '' : ` <small class="wt">${kg != null ? Math.round(kg * 10) / 10 : Math.round(lb / 2.20462 * 10) / 10} kg / ${lb != null ? Math.round(lb * 10) / 10 : Math.round(kg * 2.20462 * 10) / 10} lb</small>`;
  const freeBag = (it, kind) => !it.flight || ((it.flight.bags || {})[kind] === true);   // bag-fee lines carry no flight and stay visible
  const fOrigin = it => (it.flight && (it.flight.origin || ((it.flight.legs || [])[0] || {}).from)) || '';
  const fDest = it => (it.flight && (it.flight.destination || ((it.flight.legs || []).slice(-1)[0] || {}).to)) || '';
  function airportCodes(its) {
    const fl = its.filter(it => it.flight), cnt = {}, dest = new Set(fl.map(fDest).filter(Boolean));
    fl.forEach(it => { const o = fOrigin(it); if (o) cnt[o] = (cnt[o] || 0) + 1; if (dest.size > 1) { const d = fDest(it); if (d) cnt[d] = (cnt[d] || 0) + 1; } });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code, n]) => ({ code, n }));
  }
  const hasAirport = (it, code) => !it.flight || fOrigin(it) === code || fDest(it) === code;
  const altsHTML = it => (it.alternatives || []).length ? `<div class="links alts">Also on: ${it.alternatives.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.provider)}${a.price != null ? ' ' + money(a.price) : ''} ↗</a>`).join('')}</div>` : '';
  function flightHTML(it, tier) {
    const f = it.flight, legs = f.legs || [], first = legs[0] || {}, last = legs[legs.length - 1] || first;
    const on = isOn(tier, it), q = qtyFor(it), tot = line(it), cid = 'cb-' + slug(tier + '-' + it.id);
    const dep = f.depart || first.depart, arr = f.arrive || last.arrive, from = f.origin || first.from, to = f.destination || last.to;
    const stops = f.stops != null ? f.stops : Math.max(0, legs.length - 1);
    const lays = (f.layovers && f.layovers.length) ? f.layovers : legs.slice(0, -1).map((l, i) => ({ airport: l.to, city: l.to_city, minutes: minsBetween(l.arrive, legs[i + 1].depart) }));
    const total = f.total_min != null ? f.total_min : legs.reduce((a, l) => a + (l.duration_min || 0), 0) + lays.reduce((a, l) => a + (l.minutes || 0), 0);
    const nos = [].concat(f.flight_numbers || legs.map(l => l.flight_no).filter(Boolean)).filter(Boolean);
    const air = f.airline || first.airline || it.name, lr = f.legroom_in != null ? f.legroom_in : first.legroom_in, fit = legroomFit(lr), per = periodOf(f), ac = f.aircraft || first.aircraft;
    const plus = arr && dep && String(arr).slice(0, 10) !== String(dep).slice(0, 10) ? '<sup>+1</sup>' : '';
    const legsHTML = legs.map((l, i) => `<div class="leg"><b>${esc(l.from || from)} → ${esc(l.to || to)}</b> ${esc(l.airline || air)} ${esc(l.flight_no || '')}${l.depart ? ' · ' + fmtTime(l.depart) + ' → ' + fmtTime(l.arrive) : ''}${l.duration_min ? ' · ' + fmtHM(l.duration_min) : ''}${l.aircraft ? ' · ' + esc(l.aircraft) : ''}</div>${lays[i] ? `<div class="lay">Layover${lays[i].minutes != null ? ' ' + fmtHM(lays[i].minutes) : ''} in ${esc(lays[i].airport || '')}${lays[i].city ? ' (' + esc(lays[i].city) + ')' : ''}</div>` : ''}`).join('');
    const cabin = String(f.cabin || 'economy'); const cabinLbl = cabin.charAt(0).toUpperCase() + cabin.slice(1);
    const perLbl = PERIODS.find(p => p[0] === per);
    return `<article class="row flight${on ? ' on' : ' off'}" data-id="${esc(it.id)}">
      <label class="tick" for="${cid}"><input type="checkbox" id="${cid}" data-act="tick" data-id="${esc(it.id)}" ${on ? 'checked' : ''} aria-label="Include ${esc(it.name)}"><span class="box"></span></label>
      <div class="body">
        <div class="fl-head"><span class="airline">${esc(air)}</span>${nos.length ? `<span class="fno">${esc(nos.join(' · '))}</span>` : ''}${pill(esc(cabinLbl), 'cabin')}${perLbl ? pill(perLbl[2] + ' ' + perLbl[1], 'part') : ''}${tierPills(it)}</div>
        <div class="fl-tl">
          <div class="pt"><b>${fmtTime(dep)}</b><span>${esc(from || '')}</span><small>${fmtDate(dep)}</small></div>
          <div class="mid"><span class="dur">${fmtHM(total)}</span><span class="line"><i class="dot a"></i>${Array.from({ length: stops }, (_, i) => `<i class="dot s" title="${esc((lays[i] || {}).airport || 'stop')}"></i>`).join('')}<i class="dot b"></i></span><span class="stops ${stops ? 'has' : 'non'}">${stops === 0 ? 'Nonstop' : stops + ' stop' + (stops > 1 ? 's' : '') + (lays[0] && lays[0].airport ? ' · ' + lays.map(l => esc(l.airport)).join(', ') : '')}</span></div>
          <div class="pt end"><b>${fmtTime(arr)}${plus}</b><span>${esc(to || '')}</span><small>${fmtDate(arr)}</small></div>
        </div>
        <div class="fl-facts">
          <span class="fact"><small>Aircraft</small><span>${esc(ac || 'Not listed')}</span></span>
          <span class="fact"><small>Legroom</small><span>${lr != null ? esc(lr) + ' in' : 'Not listed'}${fit ? ` <em class="fit ${fit[0]}">${esc(fit[1])}</em>` : ''}</span></span>
          <span class="fact bags" title="Bags included in the fare shown"><small>Bags</small><span>Carry-on ${bagMark((f.bags || {}).carry_on)}${bagWt((f.bags || {}).carry_on_kg, (f.bags || {}).carry_on_lb)} Checked ${bagMark((f.bags || {}).checked)}${bagWt((f.bags || {}).checked_kg, (f.bags || {}).checked_lb)}</span></span>
          ${f.trip_type === 'one_way' ? `<span class="fact"><small>Trip</small><span>One way</span></span>` : ''}
          ${legsHTML && (stops > 0 || legs.some(l => l.flight_no)) ? `<details class="more legs"><summary>Legs & layovers</summary><div class="legs-body">${legsHTML}</div></details>` : ''}
        </div>
        ${it.details ? `<div class="dtl">${esc(it.details)}</div>` : ''}${altsHTML(it)}
      </div>
      <div class="side"><div class="price">${money(tot)}</div><div class="calc">${q !== 1 ? money(it.price) + ' ' + esc(unitLabel(it)) + ' × ' + q : esc(unitLabel(it))}</div>${badge(it)}${openBtn(it)}</div></article>`;
  }
  const STAY_TYPES = [['entire', '🏠', 'Entire place'], ['private', '🚪', 'Private room'], ['hostel', '🛏️', 'Hostel']];
  const stypeOf = it => it.stay_type || 'private';
  function stayHTML(it, tier) {
    const on = isOn(tier, it), tot = line(it), cid = 'cb-' + slug(tier + '-' + it.id), st = STAY_TYPES.find(x => x[0] === stypeOf(it)) || STAY_TYPES[1];
    const am = it.amenities || {}, perNight = tot / nights;
    const addr = (it.address || '').replace(/\s*\(approximate pin[^)]*\)/i, '');
    return `<article class="row stay${on ? ' on' : ' off'}" data-id="${esc(it.id)}">
      <label class="tick" for="${cid}"><input type="checkbox" id="${cid}" data-act="tick" data-id="${esc(it.id)}" ${on ? 'checked' : ''} aria-label="Include ${esc(it.name)}"><span class="box"></span></label>
      <div class="body">
        <div class="ttl"><label for="${cid}">${esc(it.name)}</label></div>
        <div class="meta">${pill(esc(it.provider), 'prov')}${pill(st[1] + ' ' + st[2], 'stype')}${nbPill(it.neighborhood)}${(it.tags || []).map(t => pill(esc(t), 'tag')).join('')}${tierPills(it)}</div>
        <div class="meta2">${rateHTML(it)}${am.air_conditioning ? pill('❄️ A/C', 'am') : ''}${am.wifi ? pill('📶 Wi-Fi', 'am') : ''}${it.airport_km != null ? pill(`✈️ ${Number(it.airport_km).toFixed(0)} km${it.airport_drive_min ? ' · ' + hm(it.airport_drive_min) : ''} from airport`, 'am') : ''}${it.room_type ? `<span class="muted">${esc(String(it.room_type).split(' (')[0])}</span>` : ''}</div>
        ${addr ? `<div class="addr">${esc(addr)}</div>` : ''}${altsHTML(it)}
      </div>
      <div class="side"><div class="price">${money(tot)}</div><div class="calc">${money(perNight)} / night · ${nights} nights</div>${badge(it)}${openBtn(it)}</div></article>`;
  }
  const MODE_ICON = { shared: '🚐', taxi: '🚖', tuktuk: '🛺', private: '🚘', bus: '🚌', train: '🚆', metro: '🚇', brt: '🚍', tram: '🚊', ferry: '⛴️', card: '💳', car: '🚗', tour: '🧭', rideshare: '🚕', walk: '🚶' };
  const MODE_LABEL = { bus: 'Public bus', shared: 'Shared minivan', rideshare: 'Ride app', taxi: 'Taxi', tuktuk: 'Tuk-tuk', private: 'Private car', metro: 'Metro', train: 'Train', other: 'Other' };
  const HL_CATS = new Set(['transfer', 'return']);
  const modeOf = it => it.mode || 'private';
  function bestOf(its) {   // cheapest and fastest transfer for the selected stay's area (or any area)
    const st = selectedStay(), area = st && st.neighborhood;
    let pool = its.filter(it => it.price != null && (!area || it.neighborhood === area || !it.neighborhood));
    if (!pool.length) pool = its.filter(it => it.price != null);
    if (!pool.length) return null;
    const cheap = pool.reduce((m, it) => line(it) < line(m) || (line(it) === line(m) && (it.duration_min || 1e9) < (m.duration_min || 1e9)) ? it : m);
    const timed = pool.filter(it => it.duration_min);
    const fast = timed.length ? timed.reduce((m, it) => it.duration_min < m.duration_min || (it.duration_min === m.duration_min && line(it) < line(m)) ? it : m) : null;
    return { area, cheap, fast };
  }
  function itemHTML(it, tier, hl) {
    if (isFlight(it)) return flightHTML(it, tier);
    if (it.category === 'lodging') return stayHTML(it, tier);
    const on = isOn(tier, it), q = qtyFor(it), tot = line(it), cid = 'cb-' + slug(tier + '-' + it.id);
    const icon = catOf(it.category).icon;
    const isC = hl && hl.cheap && hl.cheap.id === it.id, isF = hl && hl.fast && hl.fast.id === it.id;
    const hlb = isC && isF ? '<span class="hl both">💲⚡ Cheapest & fastest</span>' : isC ? '<span class="hl cheap">💲 Cheapest</span>' : isF ? '<span class="hl fast">⚡ Fastest</span>' : '';
    const pic = it.image && it.image.thumb ? `<a class="a-img" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" title="Photo from ${esc(it.provider)}"><img src="${esc(it.image.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.row').classList.remove('hasimg');this.parentNode.remove()"></a>` : '';
    return `<article class="row item c-${esc(it.category)}${on ? ' on' : ' off'}${isC || isF ? ' hl-row' : ''}${pic ? ' hasimg' : ''}" data-id="${esc(it.id)}">
      <label class="tick" for="${cid}"><input type="checkbox" id="${cid}" data-act="tick" data-id="${esc(it.id)}" ${on ? 'checked' : ''} aria-label="Include ${esc(it.name)}"><span class="box"></span></label>${pic}
      <div class="body">
        <div class="ttl"><span class="ico" aria-hidden="true">${it.mode ? (MODE_ICON[it.mode] || icon) : icon}</span><label for="${cid}">${esc(it.name)}</label>${hlb}</div>
        <div class="meta">${pill(esc(it.provider), 'prov')}${it.duration_min ? pill('⏱ ' + hm(it.duration_min) + (it.duration_note ? '' : ' door to door'), 'tag') : ''}${it.mode && HL_CATS.has(it.category) ? pill(esc(MODE_LABEL[it.mode] || it.mode), 'tag') : ''}${nbPill(it.neighborhood)}${(it.tags || []).map(t => pill(esc(t), 'tag')).join('')}${it.days ? pill(it.days + ' days', 'tag') : ''}${it.kind === 'local' ? pill('Local carrier', 'tag') : it.kind === 'esim' ? pill('eSIM', 'tag') : ''}${tierPills(it)}${rateHTML(it)}${it.address ? `<span class="muted">${esc(it.address)}</span>` : ''}</div>
        ${it.price_note ? `<div class="note">${esc(it.price_note)}</div>` : ''}
        ${it.details ? `<details class="more"><summary>Details</summary><div class="dtl">${esc(it.details)}</div></details>` : ''}${altsHTML(it)}
      </div>
      <div class="side"><div class="price">${money(tot)}</div><div class="calc">${q !== 1 ? money2(it.price) + ' ' + esc(unitLabel(it)) + ' × ' + q : esc(unitLabel(it))}</div>${badge(it)}${openBtn(it)}</div></article>`;
  }

  // ---- category section with filters ----
  const vendorOf = it => isBag(it) ? 'Checked bags' : it.provider;
  const tierRank = it => Math.min(...(it.tiers.length ? it.tiers : ['zz']).map(t => { const i = REAL_TIERS.findIndex(r => r.id === t); return i < 0 ? 99 : i; }));
  const ratingOf = it => it.rating == null ? -1 : Number(it.rating) / Number(it.rating_scale || 10);
  const depKey = it => { const f = it.flight || {}; return String(f.depart || ((f.legs || [])[0] || {}).depart || '9999').slice(0, 16); };
  const SORTS = [['price_asc', 'Cheapest first'], ['price_desc', 'Priciest first'], ['rating', 'Best rated'], ['tier', 'By tier, then cheapest'], ['vendor', 'By site, then cheapest'], ['depart', 'Earliest departure']];
  function sortList(arr) {
    const cheap = (x, y) => line(x) - line(y);
    const by = { price_asc: cheap, price_desc: (x, y) => line(y) - line(x), rating: (x, y) => ratingOf(y) - ratingOf(x) || cheap(x, y), tier: (x, y) => tierRank(x) - tierRank(y) || cheap(x, y), vendor: (x, y) => vendorOf(x).localeCompare(vendorOf(y)) || cheap(x, y), depart: (x, y) => depKey(x).localeCompare(depKey(y)) || cheap(x, y) }[state.sort] || cheap;
    return arr.slice().sort((x, y) => isBag(x) - isBag(y) || by(x, y));
  }
  function areasOf(its) {
    if (!NB.length || !its.some(it => it.neighborhood)) return [];
    const out = NB.map(n => ({ id: n.id, name: n.name, n: its.filter(it => it.neighborhood === n.id).length })).filter(a => a.n);
    const other = its.filter(it => !it.neighborhood || !NB.some(n => n.id === it.neighborhood)).length;
    if (other) out.push({ id: '_other', name: 'Elsewhere', n: other });
    return out;
  }
  function categoryHTML(catId, o) {
    o = o || {};
    const c = catOf(catId), its = items.filter(it => it.category === catId), tier = state.tier, f = F(catId);
    if (!its.length) return '';
    const hlc = HL_CATS.has(catId), hl = hlc ? bestOf(its) : null;
    const areas = catId === 'lodging' || hlc ? areasOf(its) : [];
    const at = areas.some(a => a.id === f.area) ? f.area : 'all';
    let base = at === 'all' ? its : its.filter(it => (it.neighborhood || '_other') === at);
    const stOn = catId === 'lodging' && its.some(it => it.stay_type), stSel = stOn && STAY_TYPES.some(x => x[0] === f.stype) ? f.stype : 'all';
    base = stSel === 'all' ? base : base.filter(it => stypeOf(it) === stSel);
    const modes = hlc ? Object.keys(MODE_LABEL).map(id => ({ id, n: base.filter(it => modeOf(it) === id).length })).filter(m => m.n) : [];
    const md = modes.some(m => m.id === f.mode) ? f.mode : 'all';
    const baseM = md === 'all' ? base : base.filter(it => modeOf(it) === md);
    const apc = catId === 'flights' ? airportCodes(its) : [], ap = apc.some(a => a.code === f.airport) ? f.airport : 'all';
    const baseA = ap === 'all' ? baseM : baseM.filter(it => hasAirport(it, ap));
    const bagOn = catId === 'flights' && (f.bagCarry || f.bagChecked);
    base = !bagOn ? baseA : baseA.filter(it => (!f.bagCarry || freeBag(it, 'carry_on')) && (!f.bagChecked || freeBag(it, 'checked')));
    const tt = REAL_TIERS.some(t => t.id === f.tier) ? f.tier : 'all';
    const pool0 = tt === 'all' ? base : base.filter(it => it.tiers.includes(tt));
    const pd = catId === 'flights' && PERIODS.some(p => p[0] === f.part) ? f.part : 'all';
    const pool = pd === 'all' ? pool0 : pool0.filter(it => periodOf(it.flight) === pd);
    const vendors = (() => { const cnt = {}; pool.forEach(it => { const v = vendorOf(it); cnt[v] = (cnt[v] || 0) + 1; }); return Object.entries(cnt).sort((a, b) => (a[0] === 'Checked bags') - (b[0] === 'Checked bags') || b[1] - a[1] || a[0].localeCompare(b[0])); })();
    const vt = vendors.some(v => v[0] === f.vendor) ? f.vendor : 'all';
    const shown0 = vt === 'all' ? pool : pool.filter(it => vendorOf(it) === vt);
    const shown = sortList(shown0);
    const lim = state.open['cap:' + catId] || (o.initial || 40);
    const list = shown.slice(0, lim), left = shown.length - list.length;
    const sub = its.filter(it => isOn(tier, it)).reduce((s, it) => s + line(it), 0), nOn = its.filter(it => isOn(tier, it)).length;
    const D = { cat: catId, act: 'filter' };
    const rows = [];
    if (areas.length) rows.push(`<div class="frow"><span class="flbl">Area</span>${chip('All', its.length, at === 'all', { ...D, key: 'area', val: 'all' })}${areas.map(a => chip('📍 ' + esc(a.name), a.n, at === a.id, { ...D, key: 'area', val: a.id }, a.id === '_other' ? '' : `--nbc:${nbColor(a.id)}`)).join('')}</div>`);
    const tierChips = chip('All tiers', base.length, tt === 'all', { ...D, key: 'tier', val: 'all' }) + REAL_TIERS.map(t => { const n = base.filter(it => it.tiers.includes(t.id)).length; return n ? chip(esc(t.label), n, tt === t.id, { ...D, key: 'tier', val: t.id }) : ''; }).join('');
    const areaBase = at === 'all' ? its : its.filter(it => (it.neighborhood || '_other') === at);
    const stChips = stOn ? `<span class="flbl">Type</span>` + chip('All', areaBase.length, stSel === 'all', { ...D, key: 'stype', val: 'all' }) + STAY_TYPES.map(([id, ic, lab]) => { const n = areaBase.filter(it => stypeOf(it) === id).length; return n ? chip(ic + ' ' + lab, n, stSel === id, { ...D, key: 'stype', val: id }) : ''; }).join('') : '';
    if (modes.length > 1) rows.push(`<div class="frow"><span class="flbl">How</span>${chip('All', base.length, md === 'all', { ...D, key: 'mode', val: 'all' })}${modes.map(m => chip((MODE_ICON[m.id] || '🚗') + ' ' + esc(MODE_LABEL[m.id] || m.id), m.n, md === m.id, { ...D, key: 'mode', val: m.id })).join('')}</div>`);
    const airportChips = apc.length > 1 ? `<span class="fright"><span class="flbl">Airport</span>${chip('All', baseM.length, ap === 'all', { ...D, key: 'airport', val: 'all' })}${apc.map(a => chip(esc(a.code), a.n, ap === a.code, { ...D, key: 'airport', val: a.code })).join('')}</span>` : '';
    rows.push(`<div class="frow"><span class="flbl">Tier</span>${tierChips}${stChips}${airportChips}</div>`);
    const bagChips = catId === 'flights' && baseA.some(it => it.flight) ? `<span class="fright"><span class="flbl">Bags</span>${chip('🎒 Free carry-on', baseA.filter(it => it.flight && freeBag(it, 'carry_on')).length, f.bagCarry, { ...D, key: 'bagCarry', val: 'toggle' })}${chip('🧳 Free checked bag', baseA.filter(it => it.flight && freeBag(it, 'checked')).length, f.bagChecked, { ...D, key: 'bagChecked', val: 'toggle' })}</span>` : '';
    if (catId === 'flights' && pool0.some(it => it.flight)) rows.push(`<div class="frow"><span class="flbl">Departs</span>${chip('Any time', pool0.length, pd === 'all', { ...D, key: 'part', val: 'all' })}${PERIODS.map(([k, lab, ic]) => chip(ic + ' ' + lab, pool0.filter(it => periodOf(it.flight) === k).length, pd === k, { ...D, key: 'part', val: k })).join('')}${bagChips}</div>`);
    if (vendors.length > 1) rows.push(`<div class="frow"><span class="flbl">Site</span>${chip('All sites', pool.length, vt === 'all', { ...D, key: 'vendor', val: 'all' })}${vendors.map(([v, n]) => chip(esc(v), n, vt === v, { ...D, key: 'vendor', val: v })).join('')}</div>`);
    const sortSel = `<label class="sortsel"><span>Sort</span><select data-act="sort">${SORTS.filter(s => s[0] !== 'depart' || catId === 'flights').map(s => `<option value="${s[0]}"${state.sort === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></label>`;
    const hlStrip = hl ? (() => { const st = selectedStay(), ap2 = (trip.arrival_airport || {}).iata || 'the airport', where = hl.area ? nbName(hl.area) : (st ? st.name : 'your stay');
      const one = (it, cls, lab) => it ? `<button type="button" class="hlpick ${cls}" data-act="jump" data-id="${esc(it.id)}"><span class="hl ${cls}">${lab}</span><span class="hn">${esc(it.name)}</span><span class="hv">${money2(line(it))}${it.duration_min ? ' · ' + hm(it.duration_min) : ''}</span></button>` : '';
      const both = hl.fast && hl.cheap.id === hl.fast.id;
      return `<div class="hlstrip"><div class="hlt">${catId === 'return' ? `From ${esc(where)} back to ${esc(ap2)}` : `From ${esc(ap2)} to ${esc(where)}`}${st && hl.area ? ` <span class="muted">(${esc(st.name)})</span>` : ''}</div><div class="hlrow">${both ? one(hl.cheap, 'both', '💲⚡ Cheapest & fastest') : one(hl.cheap, 'cheap', '💲 Cheapest') + one(hl.fast, 'fast', '⚡ Fastest')}</div></div>`; })() : '';
    return `<section class="sec cat-${esc(catId)}" id="sec-${esc(catId)}" data-sec="${esc(catId)}" data-group="${groupOfSec(catId)}">
      <header class="sec-h"><div class="sec-t"><span class="sec-ico" aria-hidden="true">${c.icon}</span><h2>${esc(c.label)}</h2><span class="sec-n">${its.length} options</span></div><div class="sec-r"><span class="sec-on">${nOn} selected</span><span class="sec-sum">${money(sub)}</span></div></header>
      ${o.before || ''}${hlStrip}
      <div class="filters">${rows.join('')}<div class="frow tools">${sortSel}<span class="showing">${shown.length} shown${vt === 'all' ? '' : ' from ' + esc(vt)}${tt === 'all' ? '' : ' · ' + esc(tierLabel(tt))}${ap === 'all' ? '' : ' · ' + esc(ap)}${f.bagCarry ? ' · free carry-on' : ''}${f.bagChecked ? ' · free checked bag' : ''}</span></div></div>
      <div class="list">${list.map(it => itemHTML(it, tier, hl)).join('') || '<div class="empty">Nothing matches these filters.</div>'}${left > 0 ? `<button type="button" class="morebtn" data-act="more" data-cat="${esc(catId)}">Show ${Math.min(40, left)} more <span class="n">${left} left</span></button>` : ''}</div>
      ${o.after || ''}</section>`;
  }

  // ---- neighborhoods ----
  function neighborhoodsHTML() {
    if (!NB.length) return '';
    const st = items.filter(it => it.category === 'lodging');
    const tile = n => { const here = st.filter(it => it.neighborhood === n.id), from = here.length ? Math.min(...here.map(it => line(it) / nights)) : null;
      const maps = n.maps_url || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n.name + ', ' + trip.destination.city));
      const ph = n.image && n.image.thumb ? `<a class="nb-photo" href="${esc(n.image.page || n.image.full || n.image.thumb)}" target="_blank" rel="noopener noreferrer"><img src="${esc(n.image.thumb)}" alt="${esc(n.name)}" loading="lazy" referrerpolicy="no-referrer"></a>` : '<div class="nb-photo none"></div>';
      return `<article class="nb" data-nb="${esc(n.id)}" style="--nbc:${nbColor(n.id)}">${ph}<div class="nb-body"><h3><span class="nbdot" aria-hidden="true"></span>${esc(n.name)}${n.local_name ? `<span class="ln">${esc(n.local_name)}</span>` : ''}</h3>
        <div class="tags">${(n.tags || []).map(cpill).join('')}</div>
        ${n.summary ? `<p class="sum">${esc(n.summary)}</p>` : ''}
        <div class="nb-text">${n.nightlife ? `<p><b>🍸 Nightlife</b> ${esc(n.nightlife)}</p>` : ''}${n.food ? `<p><b>🍜 Food</b> ${esc(n.food)}</p>` : ''}${n.good_to_know ? `<p><b>ℹ️</b> ${esc(n.good_to_know)}</p>` : ''}</div>
        <div class="nb-foot"><span class="grow">${here.length ? `${here.length} stays · from ${money(from)}/night` : 'No stays here'}</span>${here.length ? `<button type="button" class="btn sm" data-act="filter" data-cat="lodging" data-key="area" data-val="${esc(n.id)}" data-scroll="sec-lodging">Show stays</button>` : ''}<a class="lnk" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Map ↗</a>${n.source_url ? `<a class="lnk" href="${esc(n.source_url)}" target="_blank" rel="noopener noreferrer">Guide ↗</a>` : ''}</div></div></article>`; };
    return `<div class="nbs"><div class="nb-scroll" tabindex="0">${NB.map(tile).join('')}</div><p class="muted small">Scroll sideways for more areas. "Show stays" filters the Stays card to that area; each area links to a map and a guide.</p></div>`;
  }
  function neighborhoodsSectionHTML() {
    if (!NB.length) return '';
    return `<section class="sec" id="sec-neighborhoods" data-sec="neighborhoods" data-group="st"><header class="sec-h"><div class="sec-t"><span class="sec-ico" aria-hidden="true">📍</span><h2>Where to base yourself</h2><span class="sec-n">${NB.length} tourist neighborhoods for nightlife &amp; food</span></div></header>${neighborhoodsHTML()}</section>`;
  }

  // ---- weather ----
  function wx(f) { const c = f.code != null ? Number(f.code) : null, s = String(f.summary || '').toLowerCase(), p = Number(f.precip_in || 0);
    const thunder = (c != null && c >= 95) || /thunder/.test(s), snow = (c != null && ((c >= 71 && c <= 77) || c === 85 || c === 86)) || /snow/.test(s);
    const wet = thunder || (c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82))) || /rain|drizzle|shower/.test(s);
    if (thunder) return { icon: '⛈️', label: 'Thunderstorms' }; if (snow) return { icon: '🌨️', label: 'Snow' };
    if (wet) return p >= 0.4 || c === 65 || c === 82 ? { icon: '🌧️', label: 'Heavy rain' } : p >= 0.1 || c === 63 || c === 81 ? { icon: '🌧️', label: 'Rain' } : { icon: '🌦️', label: 'Light rain' };
    if ((c === 45 || c === 48) || /fog/.test(s)) return { icon: '🌫️', label: 'Fog' }; if (c === 0 || /^clear/.test(s)) return { icon: '☀️', label: 'Sunny' };
    if (c === 1 || /mostly clear/.test(s)) return { icon: '🌤️', label: 'Mostly sunny' }; if (c === 2 || /partly/.test(s)) return { icon: '⛅', label: 'Partly cloudy' }; return { icon: '☁️', label: 'Cloudy' }; }
  function wxNormal(n) { if (!n) return { icon: '·', label: 'No data' }; const r = Number(n.rain_days) / Number(n.days_in_month || 30); return r >= 0.5 ? { icon: '🌦️', label: 'Showers likely' } : r >= 0.25 ? { icon: '⛅', label: 'Some showers' } : { icon: '☀️', label: 'Mostly dry' }; }
  function dayWeather() { const W = DATA.weather; if (!W) return []; const fc = {}; (W.forecast || []).forEach(f => { fc[f.date] = f; }); const nm = {}; (W.normals || []).forEach(n => { nm[n.month] = n; }); const cm = {}; (W.climate_months || []).forEach(m => { cm[String(m.month).slice(0, 3)] = m; });
    return tripDays().map(d => { const f = fc[isoD(d)], n = nm[MONTHS_L[d.getMonth()]] || cm[MON[d.getMonth()]]; const w = f ? wx(f) : wxNormal(n); return { d, f, n, w, hi: f ? f.high_f : n && n.high_f, lo: f ? f.low_f : n && n.low_f, rain: f ? f.rain_chance : null }; }); }
  function rainStats() { const dw = dayWeather(); if (!dw.length) return null; let exp = 0, fDays = 0, fRain = 0; dw.forEach(x => { if (x.f) { fDays++; const r = (x.f.rain_chance != null && x.f.rain_chance >= 50) || Number(x.f.precip_in || 0) >= 0.1; if (r) { fRain++; exp++; } } else if (x.n) exp += Number(x.n.rain_days) / Number(x.n.days_in_month || 30); }); return { total: dw.length, expected: exp, pct: Math.round(100 * exp / dw.length), fDays, fRain }; }
  function seasonInfo() { const W = DATA.weather, rs = W && W.rainy_season; if (!rs || !(rs.months || []).length) return null; const wet = new Set(rs.months.map(Number)), dd = tripDays(); const inWet = dd.filter(d => wet.has(d.getMonth() + 1)).length; const tm = [...new Set(dd.map(d => d.getMonth() + 1))];
    const near = tm.some(m => wet.has(m === 1 ? 12 : m - 1) || wet.has(m === 12 ? 1 : m + 1)), after = tm.some(m => wet.has(m === 1 ? 12 : m - 1));
    let level, text; if (inWet === dd.length) { level = 'bad'; text = 'Your whole trip is in the rainy season'; } else if (inWet > 0) { level = 'warn'; text = `${inWet} of ${dd.length} days fall in the rainy season`; } else if (near) { level = 'warn'; text = after ? 'Your trip starts right after the rainy season' : 'Your trip ends just before the rainy season'; } else { level = 'good'; text = 'Your trip is in the dry season'; }
    return { rs, level, text, inWet, wet, tripMonths: new Set(tm) }; }
  function weatherTilesHTML(mini) { return `<div class="wdays${mini ? ' mini' : ''}">${dayWeather().map(x => `<div class="wday${x.f ? '' : ' nf'}" title="${esc(x.d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ': ' + x.w.label + (x.f ? '' : ' (monthly normal, no forecast yet)'))}"><span class="wd">${esc(x.d.toLocaleDateString('en-US', { weekday: 'short' }))}<b>${x.d.getDate()}</b></span><span class="wi" aria-hidden="true">${x.w.icon}</span><span class="wt"><b>${x.hi != null ? esc(x.hi) + '°' : '–'}</b><small>${x.lo != null ? esc(x.lo) + '°' : ''}</small></span>${mini ? '' : `<span class="wl">${esc(x.w.label)}</span><span class="wc">${x.hi != null ? toC(x.hi) + '° / ' + toC(x.lo) + '°C' : ''}</span><span class="wr">${x.rain != null ? x.rain + '% rain' : x.f ? '' : 'normal'}</span>`}</div>`).join('')}</div>`; }
  function weatherHTML() {
    const W = DATA.weather; if (!W) return '';
    const si = seasonInfo(), st = rainStats(), cm = W.climate_months || [], max = Math.max(...cm.map(m => Number(m.precip_in) || 0), 0.01);
    const tm = si ? si.tripMonths : new Set(tripDays().map(d => d.getMonth() + 1)), wet = si ? si.wet : new Set();
    const bars = cm.length ? `<div class="rainchart" role="img" aria-label="Average rain by month">${cm.map((m, i) => `<div class="m${wet.has(i + 1) ? ' wet' : ''}${tm.has(i + 1) ? ' trip' : ''}" title="${esc(MONTHS_L[i])}: ${esc(m.precip_in)} in on about ${esc(m.rain_days)} days; ${esc(m.low_f)}–${esc(m.high_f)} °F"><div class="bar" style="height:${Math.max(3, Math.round(100 * (Number(m.precip_in) || 0) / max))}%"></div><div class="lab">${MON[i][0]}</div></div>`).join('')}</div><div class="rainleg"><span><i class="k wet"></i>Rainy season</span><span><i class="k dry"></i>Drier months</span><span><i class="k trip"></i>Your trip</span></div>` : '';
    const nf = (W.forecast || []).length, lead = (W.normals || []).map(n => `Normally in ${esc(n.month)}: <b>${esc(n.low_f)}–${esc(n.high_f)} °F</b> (${toC(n.low_f)}–${toC(n.high_f)} °C), rain on about ${esc(n.rain_days)} of ${esc(n.days_in_month || 30)} days.`).join(' ');
    return `<section class="sec sec-weather" id="sec-weather" data-sec="weather" data-group="wx"><header class="sec-h"><div class="sec-t"><span class="sec-ico" aria-hidden="true">🌤️</span><h2>Weather in ${esc(W.location || trip.destination.city)}</h2><span class="sec-n">${nf ? `forecast for ${nf} of ${tripDays().length} days` : 'monthly normals'}</span></div></header>
      <div class="wx-grid"><div class="wx-main">${weatherTilesHTML(false)}<p class="muted small">${nf ? `Forecast checked ${fmtDate(W.checked_at)}; dashed days are beyond the forecast window and show the monthly normal.` : `Too far out for a forecast; every day shows the monthly normal.`} ${lead}</p></div>
      <aside class="wx-side">${si ? `<div class="status ${si.level}">${si.level === 'good' ? '✓' : '⚠'} ${esc(si.text)}</div><div class="kv"><span>Rainy season</span><b>${esc(si.rs.label)}</b></div>${si.rs.peak ? `<div class="kv"><span>Wettest</span><b>${esc(si.rs.peak)}</b></div>` : ''}` : ''}${st ? `<div class="kv"><span>Days likely to rain</span><b>≈ ${st.pct}% (${Math.round(st.expected)} of ${st.total})</b></div><div class="meter"><i style="width:${st.pct}%"></i></div>` : ''}${bars}${(W.links || []).length ? `<div class="links">${W.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('')}</div>` : ''}</aside></div></section>`;
  }

  // ---- entry rules ----
  function entryHTML(compact) {
    const e = DATA.entry; if (!e || !Array.isArray(e.items)) return '';
    const req = e.items.filter(x => x.status === 'required'), rec = e.items.filter(x => x.status === 'recommended'), level = req.length ? 'req' : rec.length ? 'warn' : 'ok';
    const tagTxt = { required: 'Required', recommended: 'Recommended', 'not-required': 'Not required', info: 'Good to know' }, order = { required: 0, recommended: 1, info: 2, 'not-required': 3 };
    const list = e.items.slice().sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    if (compact) return `<div class="entry-mini ${level}"><div class="eh">${level === 'ok' ? '✓' : '⚠'} ${esc(e.headline || (req.length ? req.length + ' things required to enter' : 'Nothing required to enter'))}</div>${req.length ? `<ul>${req.map(x => `<li>${esc(x.title)}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ''}</li>`).join('')}</ul>` : ''}<a class="lnk" href="#sec-entry" data-act="goto" data-sec="entry">Full entry rules →</a></div>`;
    return `<section class="sec sec-entry ${level}" id="sec-entry" data-sec="entry" data-group="es"><header class="sec-h"><div class="sec-t"><span class="sec-ico" aria-hidden="true">🛂</span><h2>Entry rules</h2><span class="sec-n">${esc((e.nationality || 'US citizens').split('(')[0].trim())} · checked ${fmtDate(e.checked_at || trip.generated_at)}</span></div></header>
      <div class="entry-head ${level}">${level === 'ok' ? '✓' : '!'} ${esc(e.headline || '')}</div>
      <ul class="entry-list">${list.map(x => `<li class="${esc(x.status)}"><span class="tag">${esc(tagTxt[x.status] || x.status)}</span><div><b>${esc(x.title)}</b><p>${esc(x.text || '')}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.link_label || 'Official page')} ↗</a>` : ''}</p></div></li>`).join('')}</ul>
      ${(e.sources || []).length ? `<p class="src muted small">Sources: ${e.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`).join(' · ')}</p>` : ''}</section>`;
  }
  function onwardHTML() {
    const ow = trip.onward_ticket; if (!ow || !(ow.options || []).length) return '';
    return `<section class="sec" id="sec-onward" data-sec="onward" data-group="es"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🎫</span><h2>Proof of onward travel</h2><span class="sec-n">not in totals</span></div></header>${ow.note ? `<p class="lead">${esc(ow.note)}</p>` : ''}<div class="list">${ow.options.map(o => `<article class="row item"><div class="body"><div class="ttl">${linkTo(o.url, esc(o.name))}</div><div class="meta">${(o.features || []).map(f => pill('✓ ' + esc(f), 'tag')).join('')}</div>${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}</div><div class="side">${o.price ? `<div class="price">${esc(o.price)}</div>` : ''}${o.url ? `<a class="open" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.cta || 'Open')}<span class="arr">↗</span></a>` : ''}</div></article>`).join('')}</div></section>`;
  }

  // ---- ground transport, day trips, food, restaurants ----
  function groundHTML() {
    const G = DATA.ground; if (!has.ground()) return '';
    const opts2 = G.options || [], loc = G.local_transit || [], sts = G.stations || [];
    const orow = o => `<article class="row item"><div class="body"><div class="ttl"><span class="ico">${MODE_ICON[o.mode] || '🚌'}</span>${linkTo(o.url, esc(o.operator || o.provider || 'Departure'))}${o.class ? pill(esc(o.class)) : ''}</div><div class="meta"><span><b>${fmtTime(o.depart)}</b> ${esc(o.from || '')} → <b>${fmtTime(o.arrive)}</b> ${esc(o.to || '')}</span>${o.duration_min ? pill(fmtHM(o.duration_min), 'tag') : ''}${rateHTML(o, 5)}${badge(o)}</div>${(o.amenities || []).length || o.note ? `<div class="note">${esc([(o.amenities || []).join(' · '), o.note].filter(Boolean).join(' · '))}</div>` : ''}</div><div class="side">${o.price != null ? `<div class="price">${money2(o.price)}</div><div class="calc">per person, one way</div>` : ''}${o.url ? `<a class="open" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Open<span class="arr">↗</span></a>` : ''}</div></article>`;
    const lrow = t => `<article class="row item"><div class="body"><div class="ttl"><span class="ico">${MODE_ICON[t.mode] || '🚇'}</span>${linkTo(t.url, esc(t.name))}</div>${t.note || t.how ? `<div class="note">${esc(t.note || t.how)}</div>` : ''}${t.verified != null ? `<div class="meta">${badge(t)}</div>` : ''}</div><div class="side">${(t.fare_usd ?? t.cost_usd) != null ? `<div class="price">${money2(t.fare_usd ?? t.cost_usd)}</div><div class="calc">${t.fare_usd != null ? 'per ride' : 'one way'}</div>` : ''}</div></article>`;
    const inter = opts2.slice().sort((a, b) => (Number(a.price) || 1e9) - (Number(b.price) || 1e9));
    return `<section class="sec" id="sec-ground" data-sec="ground" data-group="go"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🚇</span><h2>${G.same_country === false ? 'Metro & getting around' : 'Buses, trains & metro'}</h2><span class="sec-n">not in totals</span></div></header>
      ${G.summary ? `<p class="lead">${esc(G.summary)}</p>` : ''}<div class="list">${inter.map(orow).join('')}${sts.length ? `<h4 class="subh">Getting to the stations</h4>` + sts.map(x => lrow({ ...x, name: x.name + (x.city ? ' (' + x.city + ')' : '') })).join('') : ''}${loc.length ? (inter.length ? `<h4 class="subh">City transport</h4>` : '') + loc.map(lrow).join('') : ''}</div></section>`;
  }
  function dayTripsHTML() {
    const D = (DATA.day_trips || []).filter(d => d && d.name); if (!D.length) return '';
    const from = selectedStay();
    const card = d => { const tr = (d.transport || []).slice().sort((a, b) => (a.cost_usd ?? 1e9) - (b.cost_usd ?? 1e9)), best = tr.find(x => x.cost_usd != null), en = d.entry || {};
      const maps = d.maps_url || `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from ? from.name + ', ' + trip.destination.city : trip.destination.city)}&destination=${encodeURIComponent((d.place || d.name) + ', ' + (trip.destination.country || ''))}`;
      const img = d.image && d.image.thumb ? `<a class="dt-img" href="${esc(d.image.page || d.image.full || d.image.thumb)}" target="_blank" rel="noopener noreferrer"><img src="${esc(d.image.thumb)}" alt="${esc(d.name)}" loading="lazy" referrerpolicy="no-referrer"></a>` : '<div class="dt-img none"></div>';
      const total = best ? Number(best.cost_usd) + Number(en.price_usd || 0) : null;
      return `<article class="dtrip">${img}<div class="dt-body"><h3>${linkTo(maps, esc(d.name))}</h3><div class="muted small">${esc(d.place || '')}${d.distance_km ? ` · ${d.distance_km} km` : ''}${d.drive_min ? ` · ${hm(d.drive_min)} by car` : ''}</div><div class="tags">${(d.tags || []).map(cpill).join('')}</div>${d.summary ? `<p>${esc(d.summary)}</p>` : ''}
        ${en.price_usd != null || en.note ? `<div class="note">🎟️ Entry ${en.price_usd != null ? linkTo(en.url, money2(en.price_usd)) : ''}${en.note ? ' · ' + esc(en.note) : ''}</div>` : ''}
        <div class="dt-tr">${tr.map(x => `<div class="dtr"><span>${MODE_ICON[x.mode] || '🧭'}</span><span>${esc(x.how || x.mode)}${x.duration_min ? ' · ' + hm(x.duration_min) : ''}${x === best ? ' <em class="cheap">cheapest</em>' : ''}</span><b>${x.cost_usd != null ? linkTo(x.url, money2(x.cost_usd)) : '–'}</b></div>`).join('')}</div>
        <div class="dt-foot">${total != null ? `<b>From ${money2(total)}</b><span class="muted">pp, round trip${en.price_usd ? ' incl. entry' : ''}</span>` : ''}<a class="lnk" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Directions ↗</a>${d.source_url ? `<a class="lnk" href="${esc(d.source_url)}" target="_blank" rel="noopener noreferrer">${esc(d.source_label || 'Guide')} ↗</a>` : ''}</div></div></article>`; };
    const sorted = D.slice().sort((a, b) => (a.drive_min || a.distance_km * 1.2 || 999) - (b.drive_min || b.distance_km * 1.2 || 999));
    return `<section class="sec" id="sec-daytrips" data-sec="daytrips" data-group="ac"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🗺️</span><h2>Day trips</h2><span class="sec-n">${D.length} · closest first · not in totals</span></div></header><div class="dtrips">${sorted.map(card).join('')}</div></section>`;
  }
  function localFoodHTML() {
    const Fd = DATA.local_food; if (!has.localfood()) return '';
    const dishes = Fd.dishes || [], rs = Fd.restaurants || [], dsel = dishes.some(d => d.id === state.dish) ? state.dish : 'all';
    const short = n => String(n).split(' (')[0], dname = id => short((dishes.find(d => d.id === id) || { name: id }).name), stay = selectedStay();
    const shown = rs.filter(r => dsel === 'all' || (r.dishes || []).includes(dsel)).sort((a, b) => ratingOf(b) - ratingOf(a) || (Number(b.reviews) || 0) - (Number(a.reviews) || 0));
    const photos = d => d.photos_url || ('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(short(d.name) + ' ' + (trip.destination.country || '') + ' food'));
    const tile = d => { const n = rs.filter(r => (r.dishes || []).includes(d.id)).length; return `<button type="button" class="dish${dsel === d.id ? ' sel' : ''}" data-act="dish" data-val="${esc(d.id)}" title="${esc(d.name)}">${d.image ? `<img src="${esc(d.image.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="noimg">🍜</span>'}<span class="dn">${esc(short(d.name))}</span>${n ? `<span class="n">${n} place${n > 1 ? 's' : ''}</span>` : '<span class="n none">no rated place</span>'}</button>`; };
    const cur2 = dishes.find(d => d.id === dsel);
    const local = dishes.filter(d => d.scope !== 'country'), national = dishes.filter(d => d.scope === 'country');
    const desc = cur2 ? `<div class="dish-hero">${cur2.image ? `<a href="${esc(cur2.image.page || cur2.image.full || cur2.image.thumb)}" target="_blank" rel="noopener noreferrer"><img src="${esc(cur2.image.thumb)}" alt="${esc(short(cur2.name))}" referrerpolicy="no-referrer"></a>` : ''}<div>${pill(cur2.scope === 'country' ? esc(Fd.country_label || 'National classic') : '📍 ' + esc(Fd.city_label || 'Local specialty'), 'tag')}<h3>${esc(cur2.name)}${cur2.chinese || cur2.thai ? ` <span class="ln">${esc(cur2.chinese || cur2.thai)}</span>` : ''}</h3><p>${esc(cur2.description || '')}</p><div class="links">${cur2.source_url ? `<a href="${esc(cur2.source_url)}" target="_blank" rel="noopener noreferrer">About this dish ↗</a>` : ''}<a href="${esc(photos(cur2))}" target="_blank" rel="noopener noreferrer">Photos ↗</a>${cur2.image ? `<span class="muted small">Photo: ${esc(cur2.image.credit || 'Wikimedia Commons')}${cur2.image.license ? ' · ' + esc(cur2.image.license) : ''}</span>` : ''}</div><button type="button" class="btn sm" data-act="dish" data-val="all">Show all dishes</button></div></div>` : '';
    const row = r => `<article class="row rest"><div class="body"><div class="ttl">${linkTo(r.url, esc(r.name))}${r.michelin ? pill(esc(r.michelin), 'mich') : ''}</div><div class="meta">${rateHTML(r, 5)}${r.area ? pill(esc(r.area), 'area') : ''}${stay && r.lat != null ? `<span class="muted">${kmTxt(mi(stay.lat, stay.lng, r.lat, r.lng))} from your stay</span>` : ''}</div><div class="note">Known for: ${(r.dishes || []).map(id => esc(dname(id))).join(', ')}${r.notes ? ' · ' + esc(r.notes) : ''}</div><div class="links">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Map & reviews ↗</a>` : ''}${r.evidence_url ? `<a href="${esc(r.evidence_url)}" target="_blank" rel="noopener noreferrer">${esc(r.evidence_label || 'Source')} ↗</a>` : ''}</div></div><div class="side"><span class="muted small">${esc(r.price_note || '')}</span></div></article>`;
    return `<section class="sec" id="sec-localfood" data-sec="localfood" data-group="fd"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🥢</span><h2>Local dishes to try</h2><span class="sec-n">${dishes.length} dishes · ${rs.length} rated places · not in totals</span></div></header>
      ${local.length ? `<h4 class="subh">📍 ${esc(Fd.city_label || 'Local specialties')}</h4><div class="dishes">${local.map(tile).join('')}</div>` : ''}${national.length ? `<h4 class="subh">${esc(Fd.country_label || 'National classics')}</h4><div class="dishes">${national.map(tile).join('')}</div>` : ''}
      ${desc}<div class="list">${shown.map(row).join('') || (cur2 ? '<div class="empty">No rated place found for this dish.</div>' : '')}</div>${Fd.gaps ? `<p class="muted small">${esc(Fd.gaps)}</p>` : ''}</section>`;
  }
  function restaurantsHTML() {
    const R = DATA.restaurants || {}, rs = (R.restaurants || []).filter(r => r && r.name); if (!rs.length) return '';
    const rk = ['local', 'international'].includes(state.rkind) ? state.rkind : 'all', pool = rs.filter(r => rk === 'all' || r.kind === rk);
    const cuisines = [...new Set(pool.map(r => r.cuisine).filter(Boolean))].sort(), rc = cuisines.includes(state.rcuisine) ? state.rcuisine : 'all';
    const shown = pool.filter(r => rc === 'all' || r.cuisine === rc).sort((a, b) => ratingOf(b) - ratingOf(a) || (Number(b.reviews) || 0) - (Number(a.reviews) || 0)), stay = selectedStay();
    const nk = k => rs.filter(r => r.kind === k).length;
    const chips = `<div class="frow"><span class="flbl">Kind</span>${[['all', 'All', rs.length], ['local', '📍 Local', nk('local')], ['international', '🌍 International', nk('international')]].map(([k, lab, c]) => c ? chip(lab, c, rk === k, { act: 'rkind', val: k }) : '').join('')}</div>${cuisines.length > 1 ? `<div class="frow"><span class="flbl">Cuisine</span>${chip('All', pool.length, rc === 'all', { act: 'rcuisine', val: 'all' })}${cuisines.map(c => chip(esc(c), pool.filter(r => r.cuisine === c).length, rc === c, { act: 'rcuisine', val: c })).join('')}</div>` : ''}`;
    const row = r => { const pic = r.image && r.image.thumb ? `<a class="r-img" href="${esc(r.image.page || r.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(r.image.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('none')"></a>` : '<div class="r-img none"><span>🍽️</span></div>';
      return `<article class="row rest hasimg">${pic}<div class="body"><div class="ttl">${linkTo(r.url, esc(r.name))}${r.cuisine ? pill(esc(r.cuisine), 'tag') : ''}${r.price_level ? pill(esc(r.price_level), 'tag') : ''}</div><div class="meta">${rateHTML(r, 5)}${r.area ? pill(esc(r.area), 'area') : ''}${stay && r.lat != null ? `<span class="muted">${kmTxt(mi(stay.lat, stay.lng, r.lat, r.lng))} from your stay</span>` : ''}</div>${r.signature || r.why ? `<div class="note">${[r.signature ? '<b>Known for:</b> ' + esc(r.signature) : '', r.why ? esc(r.why) : ''].filter(Boolean).join('<br>')}</div>` : ''}<div class="links">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Map & reviews ↗</a>` : ''}${r.evidence_url ? `<a href="${esc(r.evidence_url)}" target="_blank" rel="noopener noreferrer">${esc(r.evidence_label || 'Source')} ↗</a>` : ''}${r.hours_note ? `<span class="muted">${esc(r.hours_note)}</span>` : ''}${r.reservations ? `<span class="muted">Reservations: ${esc(r.reservations)}</span>` : ''}</div></div></article>`; };
    return `<section class="sec" id="sec-restaurants" data-sec="restaurants" data-group="fd"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🍽️</span><h2>Best restaurants</h2><span class="sec-n">${rs.length} places · best rated first · not in totals</span></div></header><div class="filters">${chips}</div><div class="list">${shown.map(row).join('') || '<div class="empty">Nothing for this filter.</div>'}</div></section>`;
  }

  // ---- nearby places (embedded snapshot first, live OpenStreetMap otherwise) ----
  const POI_CATS = { hospital: { label: 'Hospitals', icon: '✚', sel: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]', 'node["healthcare"="hospital"]'] }, pharmacy: { label: 'Pharmacies', icon: '℞', sel: ['node["amenity"="pharmacy"]', 'way["amenity"="pharmacy"]'] }, grocery: { label: 'Grocery', icon: '🛒', sel: ['node["shop"="supermarket"]', 'way["shop"="supermarket"]'], named: true }, transit: { label: 'Stations', icon: '🚆', sel: ['node["railway"="station"]', 'node["station"="subway"]', 'node["public_transport"="station"]'], named: true }, nightlife: { label: 'Nightlife', icon: '🍸', sel: ['node["amenity"="bar"]', 'node["amenity"="pub"]', 'node["amenity"="nightclub"]'], named: true }, nature: { label: 'Parks & nature', icon: '🌿', sel: ['node["leisure"="park"]', 'way["leisure"="park"]', 'node["tourism"="viewpoint"]'], named: true }, hotel: { label: 'Hotels', icon: '🏨', sel: ['node["tourism"="hotel"]', 'way["tourism"="hotel"]'], named: true }, car_rental: { label: 'Car rental', icon: '🚗', sel: ['node["amenity"="car_rental"]'] } };
  const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const liveCache = new Map(); let liveBusy = null;
  const poiCat = p => { const t = String(p.type || '').toLowerCase(); return /hospital|clinic|medical/.test(t) ? 'hospital' : /pharm/.test(t) ? 'pharmacy' : /grocer|supermarket/.test(t) ? 'grocery' : null; };
  const stays = () => items.filter(it => it.category === 'lodging' && it.lat != null && it.lng != null);
  function classify(t) { if (t.amenity === 'hospital' || t.healthcare === 'hospital') return 'hospital'; if (t.amenity === 'pharmacy') return 'pharmacy'; if (/^(supermarket|grocery)$/.test(t.shop || '')) return 'grocery'; if (/^(bar|pub|nightclub)$/.test(t.amenity || '')) return 'nightlife'; if (/^(park|nature_reserve)$/.test(t.leisure || '') || t.tourism === 'viewpoint') return 'nature'; if (/^(hotel|hostel|guest_house)$/.test(t.tourism || '')) return 'hotel'; if (t.amenity === 'car_rental') return 'car_rental'; if (t.railway === 'station' || t.station === 'subway' || t.public_transport === 'station') return 'transit'; return null; }
  async function fetchLive(st) {
    const key = st.id; if (liveCache.has(key)) return liveCache.get(key);
    const sel = Object.values(POI_CATS).flatMap(c => c.sel).map(s => `${s}(around:8047,${st.lat},${st.lng});`).join('');
    const q = `[out:json][timeout:40];(${sel});out center qt;`;
    let j = null;
    for (const ep of ENDPOINTS) { try { const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); if (r.ok) { j = await r.json(); break; } } catch (e) { } }
    if (!j) { liveCache.set(key, null); return null; }
    const cats = {}; Object.keys(POI_CATS).forEach(c => { cats[c] = []; }); const seen = new Set();
    (j.elements || []).forEach(e => { const la = e.lat != null ? e.lat : (e.center || {}).lat, lo = e.lon != null ? e.lon : (e.center || {}).lon; if (la == null) return; const tags = e.tags || {}, cat = classify(tags); if (!cat) return; const name = tags['name:en'] || tags.name || tags.brand || ''; if (POI_CATS[cat].named && !name) return; const dist = mi(st.lat, st.lng, la, lo); if (dist > 5.05) return; const k = cat + '|' + name.toLowerCase() + '|' + la.toFixed(3); if (seen.has(k)) return; seen.add(k); cats[cat].push({ name, lat: la, lng: lo, dist, tags }); });
    Object.values(cats).forEach(l => l.sort((a, b) => a.dist - b.dist));
    const out = { cats, source: 'OpenStreetMap (live)' }; liveCache.set(key, out); return out;
  }
  const dirTo = (st, p) => st && p.lat != null ? 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(`${st.lat},${st.lng}`) + '&destination=' + encodeURIComponent(p.name ? `${p.name}, ${trip.destination.city}` : `${p.lat},${p.lng}`) + '&travelmode=driving' : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.lat},${p.lng}`);
  const walkTxt = m => { const w = Math.round(m * 1.609344 * 1.25 / 4.8 * 60); return w <= 60 ? `🚶 ${Math.max(1, w)} min` : ''; };
  function nearbyHTML() {
    if (!has.nearby()) return '';
    const st = selectedStay(), list = stays(), ap = trip.arrival_airport;
    const optLabel = it => `${it.name}${it.neighborhood && NB.length ? ' (' + nbName(it.neighborhood) + ')' : ''}${isOn(state.tier, it) ? ' ✓' : ''}`;
    const byArea = NB.map(n => ({ n, its: list.filter(it => it.neighborhood === n.id) })).filter(g => g.its.length), rest = list.filter(it => !NB.some(n => n.id === it.neighborhood));
    const opt = it => `<option value="${esc(it.id)}"${st && it.id === st.id ? ' selected' : ''}>${esc(optLabel(it))}</option>`;
    const selColor = st && st.neighborhood ? nbColor(st.neighborhood) : null;
    const sel = `<label class="staysel"${selColor ? ` style="--nbc:${selColor}"` : ''}><span>Around</span><select data-act="stay"${selColor ? ' class="nbsel"' : ''}>${byArea.length ? byArea.map(g => `<optgroup label="${esc(g.n.name)}">${g.its.map(opt).join('')}</optgroup>`).join('') + (rest.length ? `<optgroup label="Elsewhere">${rest.map(opt).join('')}</optgroup>` : '') : list.map(opt).join('')}</select>${st ? nbPill(st.neighborhood) : ''}</label>`;
    const cats = Object.keys(POI_CATS);
    const chips = `<div class="frow">${cats.map(c => chip(POI_CATS[c].icon + ' ' + POI_CATS[c].label, null, state.poiCats.includes(c), { act: 'poicat', val: c })).join('')}</div>`;
    let body = '';
    if (st) {
      const snap = DATA.nearby && DATA.nearby[st.id], live = liveCache.get(st.id);
      const src = snap || live;
      const apHTML = ap && ap.lat != null ? `<div class="poi-col airport"><h3>✈️ From ${esc(ap.iata || ap.name)}</h3><div class="ap-kv"><b>${st.airport_km != null ? Number(st.airport_km).toFixed(1) + ' km' : (mi(ap.lat, ap.lng, st.lat, st.lng) * 1.609344 * 1.3).toFixed(0) + ' km'}</b> by road${st.airport_drive_min ? ` · ≈ ${hm(st.airport_drive_min)} driving` : ''}</div><div class="links"><a href="https://www.google.com/maps/dir/?api=1&origin=${ap.lat},${ap.lng}&destination=${st.lat},${st.lng}&travelmode=driving" target="_blank" rel="noopener noreferrer">Driving ↗</a><a href="https://www.google.com/maps/dir/?api=1&origin=${ap.lat},${ap.lng}&destination=${st.lat},${st.lng}&travelmode=transit" target="_blank" rel="noopener noreferrer">Transit ↗</a><a href="#sec-transfer" data-act="goto" data-sec="transfer">Transfer prices →</a></div>${trip.uber_available === false ? '<p class="muted small">Uber does not operate here' + ((trip.ride_apps || []).length ? '; locals use ' + trip.ride_apps.map(a => esc(a.name)).join(', ') : '') + '.</p>' : ''}</div>` : '';
      const curated = cats.filter(c => pois.some(p => poiCat(p) === c));
      const colFor = c => { let L; if (curated.includes(c)) L = pois.filter(p => poiCat(p) === c).map(p => ({ ...p, dist: mi(st.lat, st.lng, p.lat, p.lng), tags: {} })).sort((a, b) => a.dist - b.dist).slice(0, 8); else if (src) L = ((src.cats || {})[c] || []).slice(0, 10); else L = null;
        const li = p => `<li><a href="${esc(p.url && curated.includes(c) ? p.url : dirTo(st, p))}" target="_blank" rel="noopener noreferrer">${esc(p.name || '(unnamed)')}</a>${p.rating != null ? rateHTML(p, 5) : ''}<span class="dist">${p.dist.toFixed(1)} mi · ${(p.dist * 1.609344).toFixed(1)} km${walkTxt(p.dist) ? ' · ' + walkTxt(p.dist) : ''}</span>${(p.tags || {}).emergency === 'yes' || p.er_24h ? '<em class="er">ER</em>' : ''}</li>`;
        return `<div class="poi-col" data-cat="${c}"><h3><span>${POI_CATS[c].icon}</span>${esc(POI_CATS[c].label)}${L ? `<span class="n">${L.length}</span>` : ''}</h3>${L === null ? (live === null ? '<p class="muted small">Could not reach OpenStreetMap. <button type="button" class="btn sm" data-act="retrylive">Retry</button></p>' : '<p class="muted small loading">Loading from OpenStreetMap…</p>') : `<ul>${L.map(li).join('') || '<li class="muted">Nothing within 5 miles.</li>'}</ul>`}</div>`; };
      body = `<div class="poi-grid">${apHTML}${cats.filter(c => state.poiCats.includes(c)).map(colFor).join('')}</div><p class="muted small">Within 5 miles / 8 km of ${esc(st.name)}. ${snap ? 'Places from OpenStreetMap, fetched ' + fmtDate(snap.fetched_at) + '.' : live ? 'Live from OpenStreetMap.' : ''} Rated hospitals come from Google Maps. Walking times are estimates.</p>`;
      if (!snap && live === undefined && !liveBusy) { liveBusy = st.id; fetchLive(st).then(() => { liveBusy = null; if (api.onChange) api.onChange('nearby'); }); }
    }
    return `<section class="sec" id="sec-nearby" data-sec="nearby" data-group="fl"><header class="sec-h"><div class="sec-t"><span class="sec-ico">📍</span><h2>What's near your stay</h2><span class="sec-n">5-mile radius</span></div><div class="sec-r">${sel}</div></header><div class="filters">${chips}</div>${body}</section>`;
  }

  // ---- summary pieces ----
  function selGroups(on) {
    const order = [['Flight', 'flights', it => !isBag(it)], ['Checked bags', 'flights', isBag], ['Visa & fees', 'other'], ['SIM & data', 'sim'], ['Airport transfer', 'transfer'], ['Rental car', 'car'], ['Stay', 'lodging'], ['Activities', 'activities'], ['Food', 'food'], ['Daily transport', 'transport'], ['Return to airport', 'return'], ['Insurance', 'insurance']];
    const known = new Set(order.map(g => g[1])); CATS.filter(c => !known.has(c.id)).forEach(c => order.push([c.label, c.id]));
    return order.map(([label, cat, f]) => [{ id: cat, label }, on.filter(it => it.category === cat && (!f || f(it)))]).filter(([, l]) => l.length);
  }
  function selectionHTML(tier) {
    const on = onItems(tier), tot = tierTotal(tier);
    return `<div class="sel"><div class="sel-h"><span>${esc(tierLabel(tier))} · ${on.length} lines</span><b>${money(tot)}</b></div>${selGroups(on).map(([c, l]) => `<div class="selg"><div class="selc"><i class="dot c-${esc(c.id)}"></i>${esc(c.label)}</div>${l.map(it => `<div class="seli" data-act="jump" data-id="${esc(it.id)}" role="button" tabindex="0"><span class="sn">${esc(it.name)}</span><span class="sv">${money(line(it))}</span><span class="via">${esc(it.provider)}${it.verified ? '' : ' · estimate'}<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">open ↗</a></span></div>`).join('')}</div>`).join('') || '<div class="empty">Nothing selected yet. Tick lines to build this total.</div>'}<div class="sel-tot"><span>Total</span><b>${money(tot)}</b></div></div>`;
  }
  function breakdownHTML(tier) {
    const on = onItems(tier), total = tierTotal(tier) || 1;
    const byCat = CATS.map(c => ({ ...c, v: on.filter(it => it.category === c.id).reduce((s, it) => s + line(it), 0) })).filter(c => c.v > 0).sort((a, b) => b.v - a.v);
    return `<div class="bd"><div class="bd-bar">${byCat.map(c => `<span class="c-${esc(c.id)}" style="width:${(100 * c.v / total).toFixed(2)}%" title="${esc(c.label)}: ${money(c.v)}"></span>`).join('')}</div><div class="bd-leg">${byCat.map(c => `<div class="bd-row"><span class="lab"><i class="dot c-${esc(c.id)}"></i>${esc(c.label)}</span><span class="v">${money(c.v)}</span><span class="p">${Math.round(100 * c.v / total)}%</span></div>`).join('') || '<div class="muted">Nothing ticked.</div>'}</div></div>`;
  }
  function compareHTML(tier) { const totals = TIERS.map(t => ({ ...t, v: tierTotal(t.id) })), max = Math.max(1, ...totals.map(t => t.v)); return `<div class="cmp">${totals.map(t => `<button type="button" class="cmp-row${t.id === tier ? ' active' : ''}" data-act="tier" data-val="${t.id}"><span class="l">${esc(t.label)}</span><span class="track"><i style="width:${(100 * t.v / max).toFixed(1)}%"></i></span><span class="v">${money(t.v)}</span></button>`).join('')}</div>`; }
  function tierTabsHTML(tier) { return `<div class="tiers" role="tablist">${TIERS.map(t => `<button type="button" role="tab" class="tier-btn t-${t.id}${t.custom ? ' custom' : ''}" aria-selected="${tier === t.id}" data-act="tier" data-val="${t.id}"><span class="tl">${esc(t.label)}</span><span class="tv">${money(tierTotal(t.id))}</span><span class="ts">${t.custom ? 'mix any tier' : tierCount(t.id) + ' options · ' + money(tierTotal(t.id) / travelers) + ' pp'}</span></button>`).join('')}</div>`; }
  function kpis(tier) { const on = onItems(tier), total = tierTotal(tier), est = on.filter(it => !it.verified).length; return { total, pp: total / travelers, pd: total / days, lines: on.length, est, verifiedPct: on.length ? Math.round(100 * (on.length - est) / on.length) : 0 }; }
  function calendarHTML() {
    const first = new Date(d0.getFullYear(), d0.getMonth(), 1), last = new Date(d1.getFullYear(), d1.getMonth(), 1), today = new Date(); today.setHours(0, 0, 0, 0);
    const fly = new Set([isoD(d0)].concat(trip.trip_type === 'one_way' ? [] : [isoD(d1)])), months = [];
    for (let m = new Date(first); m <= last; m.setMonth(m.getMonth() + 1)) months.push(new Date(m));
    return `<div class="cals">${months.map(m => { const y = m.getFullYear(), mo = m.getMonth(), lead = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate(); let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<div class="dow">${x}</div>`).join('') + '<div></div>'.repeat(lead);
      for (let day = 1; day <= n; day++) { const dt = new Date(y, mo, day), k = isoD(dt), inStay = dt >= d0 && dt <= d1; cells += `<div class="d${inStay ? ' stay' : ''}${k === isoD(d0) ? ' in' : ''}${k === isoD(d1) ? ' out' : ''}${dt.getTime() === today.getTime() ? ' today' : ''}">${day}${fly.has(k) ? '<i>✈</i>' : ''}</div>`; }
      return `<div class="cal"><div class="mh">${m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div><div class="g">${cells}</div></div>`; }).join('')}</div>`;
  }
  function masterHTML() {
    const S = DATA.search_links; if (!has.master()) return ''; const cov = DATA.coverage || {}, cols = [['flights', 'Flights'], ['lodging', 'Stays'], ['car', 'Cars'], ['activities', 'Activities']];
    const norm = v => typeof v === 'string' ? { url: v } : (v || {}), covLabel = { searched: 'searched', 'no-inventory': 'nothing for these dates', blocked: 'blocked' };
    const rows = Object.entries(S).map(([v, cells]) => `<tr><th>${esc(v)}</th>${cols.map(([c]) => { const o = cells[c] ? norm(cells[c]) : null, st = cov[v] && cov[v][c]; return `<td>${o && o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Results ↗</a>` : '<span class="muted">–</span>'}${st && st !== 'searched' ? `<small class="cst ${esc(st)}">${esc(covLabel[st] || st)}</small>` : ''}${o && o.note ? `<small class="muted">${esc(o.note)}</small>` : ''}</td>`; }).join('')}<td>${Object.entries(cells).filter(([c, o]) => !cols.some(([m]) => m === c) && norm(o).url).map(([c, o]) => `<a href="${esc(norm(o).url)}" target="_blank" rel="noopener noreferrer">${esc(norm(o).label || c)} ↗</a>`).join(' ') || '<span class="muted">–</span>'}</td></tr>`).join('');
    return `<section class="sec" id="sec-master" data-sec="master" data-group="src"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🔎</span><h2>Master search list</h2><span class="sec-n">every site's results page for your dates</span></div></header><div class="tbl-wrap"><table class="mtable"><thead><tr><th>Site</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}<th>Other</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function coverageHTML() {
    const cov = DATA.coverage; if (!has.coverage()) return '';
    const cols = ['flights', 'lodging', 'car', 'activities'], lab = { searched: '✓ searched', 'no-inventory': '– nothing for these dates', blocked: '⚠ blocked / form failed' };
    const n = { searched: 0, 'no-inventory': 0, blocked: 0 }; Object.values(cov).forEach(c => Object.values(c || {}).forEach(v => { if (n[v] != null) n[v]++; }));
    const run = trip.run, est = items.filter(it => !it.verified).length;
    return `<section class="sec" id="sec-coverage" data-sec="coverage" data-group="src"><header class="sec-h"><div class="sec-t"><span class="sec-ico">🧾</span><h2>Sites searched</h2><span class="sec-n">${Object.keys(cov).length} sites · ${n.searched} searched · ${n['no-inventory']} with nothing for these dates · ${n.blocked} blocked</span></div></header>
      <div class="kpis"><div class="kpi"><small>Prices checked</small><b style="font-size:15px">${esc(fmtDateY(trip.generated_at))}</b></div><div class="kpi"><small>Researched lines</small><b>${items.length}</b><span>${items.length - est} read on the site · ${est} estimates</span></div>${run && run.elapsed ? `<div class="kpi"><small>Research took</small><b style="font-size:15px">${esc(run.elapsed)}</b><span>${run.started_at ? esc(String(run.started_at).replace('T', ' ').slice(0, 16)) : ''}</span></div>` : ''}</div>
      <div class="tbl-wrap"><table class="mtable cov"><thead><tr><th>Site</th>${cols.map(c => `<th>${esc(catOf(c).label)}</th>`).join('')}</tr></thead><tbody>${Object.entries(cov).map(([v, cells]) => `<tr><th>${esc(v)}</th>${cols.map(c => `<td class="cst ${esc((cells || {})[c] || 'na')}">${cells && cells[c] ? esc(lab[cells[c]] || cells[c]) : '<span class="muted">n/a</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="muted small">"n/a" means that site does not sell that category. Lines marked Estimate were not read on the vendor's page. Map data © OpenStreetMap contributors. Nothing on this page books or charges anything.</p></section>`;
  }
  function notesHTML() {
    const providers = [...new Set(items.map(it => it.provider))].sort(), run = trip.run;
    const notes = String(trip.notes || '').split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean);
    const E = DATA.entry || {}, W = DATA.weather || {}, Fd = DATA.local_food || {}, R = DATA.restaurants || {};
    const srcs = [].concat((E.sources || []).map(s => ({ ...s, what: 'Entry rules' })), (W.links || []).map(l => ({ ...l, what: 'Weather' })),
      W.climate_source_url ? [{ label: W.climate_source || 'Climate normals', url: W.climate_source_url, what: 'Weather' }] : [],
      W.rainy_season && W.rainy_season.source_url ? [{ label: W.rainy_season.source || 'Rainy season', url: W.rainy_season.source_url, what: 'Weather' }] : [],
      NB.filter(n => n.source_url).map(n => ({ label: n.source_label || n.name, url: n.source_url, what: 'Neighborhood: ' + n.name })),
      (DATA.day_trips || []).filter(d => d.source_url).map(d => ({ label: d.source_label || 'Guide', url: d.source_url, what: 'Day trip: ' + d.name })));
    return `<section class="sec" id="sec-notes" data-sec="notes" data-group="src"><header class="sec-h"><div class="sec-t"><span class="sec-ico">📝</span><h2>Notes & sources</h2><span class="sec-n">prices checked ${fmtDateY(trip.generated_at)}${run && run.elapsed ? ' · research took ' + esc(run.elapsed) : ''}</span></div></header>
      ${notes.length ? `<h4 class="subh">Notes from the research</h4><ul class="notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <h4 class="subh">Price sources (${providers.length} sites and providers)</h4><div class="tags srcpills">${providers.map(p => pill(esc(p), 'prov')).join('')}</div>
      ${srcs.length ? `<h4 class="subh">Reference sources</h4><ul class="notes srcs">${srcs.map(s => `<li><span class="muted">${esc(s.what)}:</span> <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`).join('')}</ul>` : ''}
      ${Fd.checked_at || R.checked_at ? `<p class="muted small">Restaurant ratings read ${esc(fmtDateY(R.checked_at || Fd.checked_at))}${Fd.coordinates_note ? '. ' + esc(Fd.coordinates_note) : ''}</p>` : ''}
      <p class="muted small">Every link opens the live page so you can confirm before booking; prices change daily.</p></section>`;
  }
  // ---- small sidebar cards: currency, ride apps, SIM summary ----
  function fxHTML() {
    const fx = trip.fx; if (!fx || !fx.rate) return '';
    let lf; try { lf = new Intl.NumberFormat('en-US', { style: 'currency', currency: fx.code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }); } catch (e) { lf = { format: v => Math.round(v) + ' ' + fx.code }; }
    const r = Number(fx.rate);
    return `<div class="fxc"><div class="kv"><span>1 ${esc(trip.currency)}</span><b>${esc(fx.rate)} ${esc(fx.code)}</b></div><div class="fxq">${[10, 20, 50, 100].map(v => `<span><b>${money(v)}</b> ≈ ${esc(lf.format(v * r))}</span>`).join('')}</div><div class="muted small">Checked ${fmtDate(fx.checked_at)}${fx.url ? ` · <a href="${esc(fx.url)}" target="_blank" rel="noopener noreferrer">today's rate ↗</a>` : ''}</div></div>`;
  }
  function ridesHTML() {
    const tx = items.filter(it => it.category === 'transfer'), apps = trip.ride_apps || [];
    if (!tx.length && !apps.length && trip.uber_available !== false) return '';
    const on = tx.find(it => isOn(state.tier, it)), lo = tx.length ? Math.min(...tx.map(line)) : 0, hi = tx.length ? Math.max(...tx.map(line)) : 0;
    return `<div class="ridec">${on ? `<div class="big">${money2(line(on))}</div><div class="muted small">${esc(on.name)}</div>` : ''}${tx.length ? `<div class="kv"><span>All transfer options</span><b>${money2(lo)} – ${money2(hi)}</b></div>` : ''}
      ${apps.length || trip.uber_available === false ? `<div class="apps">${apps.map(a => `<a class="pill prov" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" title="${esc(a.note || '')}">${esc(a.name)} ↗</a>`).join('')}${trip.uber_available === false ? '<span class="pill no" title="Uber does not operate here">Uber ✗</span>' : ''}</div>${apps[0] && apps[0].note ? `<div class="muted small">${esc(apps[0].note)}${trip.uber_available === false ? ' Uber does not operate here.' : ''}</div>` : ''}` : ''}
      ${tx.length ? `<a class="lnk" href="#sec-transfer" data-act="goto" data-sec="transfer">Compare rides →</a>` : ''}</div>`;
  }
  function simHTML() {
    const sims = items.filter(it => it.category === 'sim'); if (!sims.length) return '';
    const need = tripDays().length, fits = a => a.filter(it => it.days == null || Number(it.days) >= need);
    const loc = fits(sims.filter(it => it.kind === 'local')), es = fits(sims.filter(it => it.kind === 'esim'));
    const byOp = {}; loc.filter(it => it.days != null).forEach(it => { const op = it.operator || it.provider; if (!byOp[op] || line(it) < line(byOp[op])) byOp[op] = it; });
    const best = Object.values(byOp), avg = best.length ? best.reduce((s, it) => s + line(it), 0) / best.length : null;
    return `<div class="simc">${avg != null ? `<div class="kv"><span>Local SIM, average</span><b>${money2(avg)}</b></div><div class="muted small">Cheapest pack covering your ${need} days: ${best.map(it => esc(it.operator || it.provider) + ' ' + money2(line(it))).join(' · ')}</div>` : ''}${es.length ? `<div class="kv"><span>eSIM, from</span><b>${money2(Math.min(...es.map(line)))}</b></div>` : ''}<a class="lnk" href="#sec-sim" data-act="goto" data-sec="sim">All SIMs and eSIMs →</a></div>`;
  }
  // ---- the original dashboard's sidebar, same components in the same order (entry, currency, selection, weather, dates, custom, ride, SIM, onward) ----
  function origSideHTML(o) {
    o = o || {}; const skip = new Set(o.skip || []);
    const link = (sec, txt) => `<a class="go" href="#sec-${sec}" data-act="goto" data-sec="${sec}">${esc(txt)}</a>`;
    const C = [];
    const Ei = DATA.entry;
    if (Ei && Array.isArray(Ei.items)) { const req = Ei.items.filter(x => x.status === 'required');
      C.push(`<div class="sc"><h3><span class="i">🛂</span>Entry: must-haves${req.length ? `<span class="status bad inh" title="${req.length} required to enter">⚠ ${req.length} required</span>` : '<span class="status good inh">✓ Nothing required</span>'}</h3>${req.length ? `<ul class="req">${req.map(x => `<li><strong>${esc(x.title)}</strong>${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ''}</li>`).join('')}</ul>` : `<div class="line">${esc(Ei.headline || '')}</div>`}${link('entry', 'Full entry rules →')}</div>`); }
    const fx = trip.fx;
    if (fx && fx.rate && !skip.has('fx')) { let lf; try { lf = new Intl.NumberFormat('en-US', { style: 'currency', currency: fx.code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }); } catch (e) { lf = { format: v => Math.round(v) + ' ' + fx.code }; } const r = Number(fx.rate);
      C.push(`<div class="sc"><h3><span class="i">💱</span>Currency</h3><div class="srow"><span>1 ${esc(trip.currency)}</span><b>${esc(fx.rate)} ${esc(fx.code)}</b></div><div class="fxq">${[10, 20].map(v => `<span><b>${money(v)}</b> ≈ ${esc(lf.format(v * r))}</span>`).join('')}</div><div class="line">Checked ${fmtDate(fx.checked_at)}${fx.url ? ` · <a href="${esc(fx.url)}" target="_blank" rel="noopener noreferrer">today's rate ↗</a>` : ''}</div></div>`); }
    const on = onItems(state.tier);
    if (on.length) { const tot = on.reduce((s, it) => s + line(it), 0), groups = selGroups(on);
      C.push(`<details class="sc sel" open><summary><h3><span class="i">🧾</span>Your selection</h3><div class="selsum"><span>${esc(tierLabel(state.tier))} · ${on.length} line${on.length === 1 ? '' : 's'}</span><b class="mono">${money(tot)}</b></div><span class="chev" aria-hidden="true">⌄</span></summary>
        <div class="selbody">${groups.map(([c, l]) => `<div class="selg"><div class="selc"><span class="dot c-${esc(c.id)}"></span>${esc(c.label)}</div>${l.map(it => `<div class="seli" data-act="jump" data-id="${esc(it.id)}" role="button" tabindex="0" title="Show this line in its card"><span class="sn">${esc(it.name)}</span><span class="mono">${money(line(it))}</span><span class="via">${esc(it.provider)}${it.verified ? '' : ' · estimate'}<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" title="Open on ${esc(it.provider)}">open ↗</a></span></div>`).join('')}</div>`).join('')}
        <div class="seltot"><span>Total</span><b class="mono">${money(tot)}</b></div></div></details>`); }
    if (DATA.weather) { const si = seasonInfo(), st = rainStats();
      const cells = dayWeather().map(x => `<div class="mw${x.f ? '' : ' nf'}" title="${esc(x.d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ': ' + x.w.label + (x.hi != null ? ', ' + x.hi + '°/' + x.lo + '°F' : '') + (x.f ? '' : ' (normal for the month, no forecast yet)'))}"><span class="mwd">${esc(x.d.toLocaleDateString('en-US', { weekday: 'short' }))} ${x.d.getDate()}</span><span class="mwi" aria-hidden="true">${x.w.icon}</span><b class="mwh">${x.hi != null ? esc(x.hi) + '°' : '–'}</b><span class="mwl">${x.lo != null ? esc(x.lo) + '°' : ''}</span></div>`).join('');
      C.push(`<div class="sc"><h3><span class="i">🌤️</span>Weather &amp; rainy season</h3><div class="miniwx" role="group" aria-label="Weather for each trip day">${cells}</div><div class="line mwnote">Solid days are forecasts; dashed days show the monthly normal. °F high / low.</div>
        ${si ? `<div class="status ${si.level}">${si.level === 'good' ? '✓ No, you miss it' : si.level === 'bad' ? '⚠ Yes, your whole trip' : si.inWet ? `⚠ Partly: ${si.inWet} of ${tripDays().length} days` : si.text.includes('after') ? '⚠ Just after it ends' : '⚠ Just before it starts'}</div><div class="srow"><span>Rainy season</span><b>${esc(si.rs.label)}</b></div>${si.rs.peak ? `<div class="srow"><span>Wettest</span><b>${esc(si.rs.peak)}</b></div>` : ''}` : ''}
        ${st ? `<div class="srow"><span>Days likely to rain</span><b>≈ ${st.pct}% (${Math.round(st.expected)} of ${st.total})</b></div><div class="meter" aria-hidden="true"><i style="width:${st.pct}%"></i></div>` : ''}${link('weather', 'Full weather and forecast →')}</div>`); }
    // calendar, as the original drew it
    { const first = new Date(d0.getFullYear(), d0.getMonth(), 1), last = new Date(d1.getFullYear(), d1.getMonth(), 1), today = new Date(); today.setHours(0, 0, 0, 0);
      const fly = new Set([isoD(d0)].concat(trip.trip_type === 'one_way' ? [] : [isoD(d1)])), months = [];
      for (let mm = new Date(first); mm <= last; mm.setMonth(mm.getMonth() + 1)) months.push(new Date(mm));
      const html = months.map(mm => { const y = mm.getFullYear(), mo = mm.getMonth(), lead = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate();
        let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<div class="dow">${x}</div>`).join('') + '<div></div>'.repeat(lead);
        for (let day = 1; day <= n; day++) { const dt = new Date(y, mo, day), k = isoD(dt), inStay = dt >= d0 && dt <= d1;
          const cls = ['d', inStay ? 'stay' : '', k === isoD(d0) ? 'in' : '', k === isoD(d1) ? 'out' : '', dt.getDay() === 0 ? 'wkstart' : '', dt.getDay() === 6 ? 'wkend' : '', dt.getTime() === today.getTime() ? 'today' : ''].filter(Boolean).join(' ');
          const tip = k === isoD(d0) ? 'Check-in' + (fly.has(k) ? ' and flight' : '') : k === isoD(d1) ? 'Check-out' + (fly.has(k) ? ' and flight home' : '') : inStay ? 'Night ' + (Math.round((dt - d0) / 86400000) + 1) : '';
          cells += `<div class="${cls}"${tip ? ` title="${esc(dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))}: ${tip}"` : ''}>${day}${fly.has(k) ? '<span class="fl" aria-hidden="true">✈️</span>' : ''}</div>`; }
        return `<div class="cal"><div class="mh">${mm.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}<span>${months.length > 1 ? '' : nights + ' night' + (nights === 1 ? '' : 's')}</span></div><div class="g" role="grid">${cells}</div></div>`; }).join('');
      C.push(`<div class="sc"><h3><span class="i">📅</span>Your dates</h3>${html}<div class="cal-leg"><span><i style="background:var(--accent)"></i>Check-in / check-out</span><span><i style="background:color-mix(in srgb, var(--accent) 22%, var(--surface))"></i>Your stay</span><span>✈️ Flight</span><span><i style="background:var(--bad);width:6px;height:6px;border-radius:50%;vertical-align:1px"></i>Today</span></div><div class="line">${fmtDateY(trip.start_date)} → ${fmtDateY(trip.end_date)}</div></div>`); }
    { const ct = tierTotal('custom');
      C.push(`<div class="sc"><h3><span class="i">💰</span>Your Custom trip</h3><div class="big mono">${money(ct)}</div><div class="line">${money(ct / travelers)} per person · ${money(ct / days)} per day</div><button type="button" class="go" data-act="tier" data-val="custom">Open the Custom tab</button></div>`); }
    { const tx = items.filter(it => it.category === 'transfer'), apps = trip.ride_apps || [];
      if (tx.length || apps.length) { const onT = tx.find(it => isOn('custom', it)) || tx.find(it => isOn(state.tier, it)), stay = items.find(it => it.category === 'lodging' && isOn('custom', it)), lo = tx.length ? Math.min(...tx.map(line)) : 0, hi = tx.length ? Math.max(...tx.map(line)) : 0;
        C.push(`<div class="sc"><h3><span class="i">🚕</span>${tx.length ? 'Airport → your stay' : 'Ride apps'}</h3>${onT ? `<div class="big mono">${money(line(onT))}</div><div class="line">${esc(onT.name)}${stay ? ' · to ' + esc(stay.name) : ''}</div>` : ''}${tx.length ? `<div class="srow"><span>All options</span><b>${money(lo)} – ${money(hi)}</b></div>` : ''}
          ${apps.length || trip.uber_available === false ? `<div class="srow" style="margin-top:4px"><span>Ride apps here</span></div><div class="apps">${apps.map(a => `<a class="app" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" title="${esc(a.note || '')}">${esc(a.name)}</a>`).join('')}${trip.uber_available === false ? '<span class="app no" title="Uber does not operate here">Uber</span>' : ''}</div>${apps[0] && apps[0].note ? `<div class="line">${esc(apps[0].note)}${trip.uber_available === false ? ' Uber does not operate here.' : ''}</div>` : ''}` : ''}
          ${tx.length ? link('transfer', 'Compare rides →') : ''}</div>`); } }
    { const sims = items.filter(it => it.category === 'sim'), loc = sims.filter(it => it.kind === 'local'), es = sims.filter(it => it.kind === 'esim');
      if (sims.length) { const need = tripDays().length, fits = a => a.filter(it => it.days == null || Number(it.days) >= need); const byOp = {}; fits(loc).filter(it => it.days != null).forEach(it => { const op = it.operator || it.provider; if (!byOp[op] || line(it) < line(byOp[op])) byOp[op] = it; });
        const best = Object.values(byOp), avg = best.length ? best.reduce((s, it) => s + line(it), 0) / best.length : null, esFit = fits(es);
        C.push(`<div class="sc"><h3><span class="i">📶</span>SIM &amp; eSIM</h3>${avg != null ? `<div class="srow"><span>Local SIM, average</span><b>${money(avg)}</b></div><div class="line">Cheapest pack covering your ${need} days: ${best.map(it => esc(it.operator || it.provider) + ' ' + money(line(it))).join(' · ')}</div>` : ''}${esFit.length ? `<div class="srow"><span>eSIM, from</span><b>${money(Math.min(...esFit.map(line)))}</b></div>` : ''}${link('sim', 'All SIMs and eSIMs →')}</div>`); } }
    const ow = trip.onward_ticket;
    if (ow && (ow.options || []).length) C.push(`<div class="sc onward"><h3><span class="i">🎫</span>Proof of onward travel</h3>${ow.status ? `<div class="status ${esc(ow.level || 'good')}">${esc(ow.status)}</div>` : ''}${ow.note ? `<div class="line">${esc(ow.note)}</div>` : ''}<div class="onw">${ow.options.map(o => `<div class="op"><div class="nm">${esc(o.name)}</div><div class="pr">${esc(o.price || '')}</div>${(o.features || []).length ? `<div class="ft">${o.features.map(f => `<span>✓ ${esc(f)}</span>`).join('')}</div>` : ''}${o.note ? `<div class="tip" style="grid-column:1/-1">${esc(o.note)}</div>` : ''}<a class="get" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.cta || 'Open')} ↗</a></div>`).join('')}</div>${ow.tip ? `<div class="tip" style="margin-top:8px">${esc(ow.tip)}</div>` : ''}</div>`);
    return C.join('');
  }
  // ---- currency strip for a toolbar: 1 USD = 6.67 CNY · $5 ≈ ¥33 · $10 ≈ ¥67 · $20 ≈ ¥133 ----
  function fxStripHTML() {
    const fx = trip.fx; if (!fx || !fx.rate) return '';
    let lf; try { lf = new Intl.NumberFormat('en-US', { style: 'currency', currency: fx.code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }); } catch (e) { lf = { format: v => Math.round(v) + ' ' + fx.code }; }
    const r = Number(fx.rate);
    return `<div class="fxstrip" title="Checked ${esc(fmtDate(fx.checked_at))}"><span class="fxbase"><b>1 ${esc(trip.currency)}</b> = <b>${esc(Number(fx.rate).toFixed(2))} ${esc(fx.code)}</b></span>${[5, 10, 20, 50].map(v => `<span class="fxq2"><em>${money(v)}</em>≈ ${esc(lf.format(v * r))}</span>`).join('')}${fx.url ? `<a href="${esc(fx.url)}" target="_blank" rel="noopener noreferrer" title="Today's rate">↗</a>` : ''}</div>`;
  }
  // ---- per-card links: back to the top of this section, and on to the next one ----
  const allSecs = () => groupsPresent().flatMap(g => g.secs);
  function rowLinks(sec) {
    const order = allSecs(), i = order.indexOf(sec), next = i >= 0 ? order[i + 1] : null;
    return `<div class="rowlinks"><button type="button" data-act="top" data-sec="${esc(sec)}" title="Back to the top of this section">⤒ <span>Top of ${esc(secLabel(sec))}</span></button>${next ? `<button type="button" data-act="goto" data-sec="${esc(next)}" title="Go to the next section">⤵ <span>Next: ${esc(secLabel(next))}</span></button>` : ''}</div>`;
  }
  const withLinks = (html, sec) => html.replace(/<\/article>/g, rowLinks(sec) + '</article>');
  const collapseBtn = sec => `<button type="button" class="collapse" data-act="collapse" data-sec="${esc(sec)}" aria-expanded="${!(state.collapsed || {})[sec]}" title="Collapse or expand this card"><span class="chev">⌄</span></button>`;
  function decorate(html, sec) {   // adds the collapse toggle to the card header, the collapsed state, and the per-card links
    if (!html) return html;
    const collapsed = !!(state.collapsed || {})[sec];
    let out = html.replace(/<section class="sec/, `<section class="sec${collapsed ? ' collapsed' : ''}`).replace(/<header class="sec-h">([\s\S]*?)<\/header>/, (m, inner) => `<header class="sec-h">${inner}${collapseBtn(sec)}</header>`);
    return collapsed ? out : withLinks(out, sec);
  }
  // ---- bottom navigation (a router shared by every template) ----
  function bottomNavHTML(screens, current, subs) {
    const groupsHTML = screens.map(s => `<button type="button" data-act="group" data-val="${esc(s.id)}" aria-selected="${current === s.id}" title="${esc(s.label)}"><span class="ic" aria-hidden="true">${s.icon}</span><span class="lb">${esc(s.label)}</span></button>`).join('');
    const subsHTML = (subs || []).length ? `<div class="bn-subs" aria-label="Sections in this tab">${subs.map(s => `<button type="button" class="sub" data-act="top" data-sec="${esc(s.id)}" data-sub="${esc(s.id)}">${esc(s.label)}</button>`).join('')}</div>` : '';
    return `<nav class="bnav" aria-label="Sections"><div class="in"><div class="bn-groups">${groupsHTML}</div>${subsHTML}</div></nav>`;
  }
  const SHORT_LABEL = { fl: 'Flights', st: 'Accommodation', go: 'Transportation', ac: 'To do', fd: 'Food', es: 'Essentials', wx: 'Weather', src: 'Sources' };

  // ---- behaviour: one delegated listener per root ----
  function jumpTo(id, paint) {
    const it = items.find(o => o.id === id); if (!it) return;
    const f = F(it.category); f.vendor = 'all'; f.tier = 'all'; f.area = 'all'; f.stype = 'all'; f.part = 'all'; f.airport = 'all'; f.mode = 'all'; f.bagCarry = false; f.bagChecked = false; state.open['cap:' + it.category] = 9999;
    state.group = groupOfSec(it.category); paint('jump');
    setTimeout(() => { const row = document.querySelector(`.row[data-id="${CSS.escape(id)}"]`); if (!row) return; row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 2200); }, 60);
  }
  function bind(root, paint) {
    api.onChange = paint;
    root.addEventListener('change', e => {
      const t = e.target; if (!t.dataset) return;
      if (t.dataset.act === 'tick') { const it = items.find(o => o.id === t.dataset.id); if (it) { setOn(state.tier, it, t.checked); paint('tick'); } }
      else if (t.dataset.act === 'sort') { state.sort = t.value; store.save(); paint('sort'); }
      else if (t.dataset.act === 'stay') { state.stayId = t.value; store.save(); paint('stay'); }
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      const a = b.dataset.act;
      if (a === 'tier') { state.tier = b.dataset.val; store.save(); paint('tier'); }
      else if (a === 'filter') { const f = F(b.dataset.cat), k = b.dataset.key; if (b.dataset.val === 'toggle') f[k] = !f[k]; else f[k] = b.dataset.val; if (k !== 'vendor') f.vendor = 'all'; state.open['cap:' + b.dataset.cat] = 0; paint('filter'); if (b.dataset.scroll) { const el = document.getElementById(b.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
      else if (a === 'more') { state.open['cap:' + b.dataset.cat] = (state.open['cap:' + b.dataset.cat] || 40) + 40; const y = scrollY; paint('more'); scrollTo(0, y); }
      else if (a === 'dish') { state.dish = b.dataset.val; paint('dish'); }
      else if (a === 'rkind') { state.rkind = b.dataset.val; state.rcuisine = 'all'; paint('rkind'); }
      else if (a === 'rcuisine') { state.rcuisine = b.dataset.val; paint('rcuisine'); }
      else if (a === 'poicat') { const c = b.dataset.val, i = state.poiCats.indexOf(c); if (i >= 0) state.poiCats.splice(i, 1); else state.poiCats.push(c); store.save(); paint('poicat'); }
      else if (a === 'retrylive') { const st = selectedStay(); if (st) liveCache.delete(st.id); paint('retry'); }
      else if (a === 'jump') { if (e.target.closest('a')) return; e.preventDefault(); jumpTo(b.dataset.id, paint); }
      else if (a === 'goto') { e.preventDefault(); state.group = groupOfSec(b.dataset.sec); paint('goto'); setTimeout(() => { const el = document.getElementById('sec-' + b.dataset.sec); if (el) { const off = parseInt(getComputedStyle(el).scrollMarginTop) || 0; scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: 'auto' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); } }, 30); }
      else if (a === 'group') { state.group = b.dataset.val; store.save(); paint('group'); }
      else if (a === 'collapse') { state.collapsed = state.collapsed || {}; state.collapsed[b.dataset.sec] = !state.collapsed[b.dataset.sec]; store.save(); const y = scrollY; paint('collapse'); scrollTo(0, y); }
      else if (a === 'top') { const el = document.getElementById('sec-' + b.dataset.sec); if (el) { const off = parseInt(getComputedStyle(el).scrollMarginTop) || 0; scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: 'auto' }); } }
      else if (a === 'copy') { copySummary(b); }
    });
    root.addEventListener('keydown', e => { const b = e.target.closest && e.target.closest('[data-act="jump"]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); jumpTo(b.dataset.id, paint); } });
  }
  async function copySummary(btn) {
    const tier = state.tier, on = onItems(tier);
    const lines = [`${trip.title} — ${tierLabel(tier)}`, `${fmtDateY(trip.start_date)} – ${fmtDateY(trip.end_date)}, ${travelers} traveler(s), ${trip.trip_type === 'one_way' ? 'one way' : 'round trip'}. Prices checked ${fmtDateY(trip.generated_at)}.`, ''];
    selGroups(on).forEach(([c, its]) => { lines.push(c.label.toUpperCase()); its.forEach(it => lines.push(`- ${it.name} — ${money(line(it))}${it.verified ? '' : ' (estimate)'} [${it.provider}]\n  ${it.url}`)); lines.push(''); });
    lines.push(`TOTAL ${money(tierTotal(tier))} (${money(tierTotal(tier) / travelers)} per person)`);
    const text = lines.join('\n'), t0 = btn.textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied ✓'; } catch (e) { btn.textContent = 'Copy failed'; }
    setTimeout(() => { btn.textContent = t0; }, 1500);
  }
  const titleTxt = `${String(trip.title).split(' · ')[0]} · ${rangeTxt}`;
  const metaTxt = () => { const o = trip.origin || {}, d = trip.destination || {}; return { route: `${o.city || o.iata || ''}${o.iata ? ' (' + o.iata + ')' : ''} → ${d.city}${d.iata ? ' (' + d.iata + ')' : ''}`, dates: rangeTxt, nights, days, travelers, tripType: trip.trip_type === 'one_way' ? 'One way' : 'Round trip', checked: fmtDateY(trip.generated_at), dest: d }; };

  const api = { DATA, trip, items, state, TIERS, REAL_TIERS, CATS, GROUPS, NB, SHORT_LABEL, nbColor, nbName, nights, days, travelers, money, money2, esc, fmtDate, fmtDateY, hm, fmtHM, tierLabel, titleTxt, metaTxt, isOn, setOn, line, tierTotal, onItems, kpis, selectedStay, selGroups, groupsPresent, secExists, secLabel, groupOfSec, store, bind, jumpTo, copySummary,
    rainStats, seasonInfo, dayWeather,
    html: { category: categoryHTML, item: itemHTML, neighborhoods: neighborhoodsHTML, weather: weatherHTML, weatherTiles: weatherTilesHTML, entry: entryHTML, onward: onwardHTML, ground: groundHTML, daytrips: dayTripsHTML, localfood: localFoodHTML, restaurants: restaurantsHTML, nearby: nearbyHTML, selection: selectionHTML, breakdown: breakdownHTML, compare: compareHTML, tierTabs: tierTabsHTML, calendar: calendarHTML, master: masterHTML, coverage: coverageHTML, notes: notesHTML, fx: fxHTML, rides: ridesHTML, sim: simHTML, bottomNav: bottomNavHTML,
      origSide: origSideHTML, rowLinks, fxStrip: fxStripHTML,
      section(id, o) { const raw = (() => { switch (id) { case 'weather': return weatherHTML(); case 'entry': return entryHTML(false); case 'onward': return onwardHTML(); case 'ground': return groundHTML(); case 'daytrips': return dayTripsHTML(); case 'localfood': return localFoodHTML(); case 'restaurants': return restaurantsHTML(); case 'nearby': return nearbyHTML(); case 'neighborhoods': return neighborhoodsSectionHTML(); case 'master': return masterHTML(); case 'coverage': return coverageHTML(); case 'notes': return notesHTML(); default: return categoryHTML(id, o); } })(); return decorate(raw, id); } } };
  return api;
};
