/* -----------------------------------------------------------------------------
 * Made-up prices for walking the price page without Google or a database. Loaded
 * only on a local copy opened with ?mock (config.js gates it on the hostname),
 * never on a deployed one. It answers like the three database functions
 * (pinpointe-supabase 20261123200000): a save "now" retires the active row and adds
 * the next version; a save for later adds it scheduled; a scheduled row whose start
 * has passed is switched on the next time the page reads (the database does that
 * every 5 minutes).
 *
 *   /dashboard/prices/?mock                 three venues as on 23 Nov 2026
 *   /dashboard/prices/?mock&as=outsider     a dashboard viewer outside Hawktivity: refused
 *   /dashboard/prices/?mock&fail=1          the database can't be reached
 *
 * From the console: PRICES_MOCK.due() winds every scheduled price's start back to
 * a second ago, so the next Reload switches it on.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var EMAIL = params.get('as') === 'outsider' ? 'brianroberthowe@gmail.com' : 'richard@hawktivity.com';
  var nextId = 1;
  function id() { return 'mock-' + (nextId++); }
  function iso(ms) { return new Date(ms).toISOString(); }
  var DAY = 86400000;

  function row(o) {
    return Object.assign({ id: id(), currency: 'GBP', ratePerMinutes: 60, overrides: {}, note: null,
                           isActive: false, effectiveFrom: null, createdBy: null, retiredAt: null,
                           bands: [], timetable: null }, o);
  }

  var rows = {
    'mock-rising-sun': [
      row({ version: 1, model: 'per_person', rateMinor: 1000, lengths: [15, 30, 60, 90],
            createdAt: '2026-10-07T14:05:17Z', retiredAt: '2026-11-23T14:02:32Z' }),
      row({ version: 2, model: 'per_group', rateMinor: 2000, lengths: [30, 60, 90], overrides: { 30: 1200 },
            isActive: true, effectiveFrom: '2026-11-23T14:02:32Z', createdAt: '2026-11-23T14:02:32Z' })
    ],
    // As on prod at 15:38Z on 23 Nov: the launch price now, £30 from Mon 7 Dec.
    'mock-metropolis': [
      row({ version: 1, model: 'per_person', rateMinor: 1000, lengths: [15, 30, 60, 90],
            createdAt: '2026-11-21T12:25:06Z', retiredAt: '2026-11-23T15:31:19Z' }),
      row({ version: 2, model: 'per_group', rateMinor: 2000, lengths: [30, 60, 90], overrides: { 30: 1200 },
            note: 'Launch Special, to 6 Dec:  {price}', isActive: true,
            effectiveFrom: '2026-11-23T15:31:19Z', createdAt: '2026-11-23T15:31:19Z', createdBy: 'richard@hawktivity.com' }),
      row({ version: 3, model: 'per_group', rateMinor: 3000, lengths: [30, 60, 90], overrides: { 30: 1800 },
            effectiveFrom: '2026-12-07T00:00:00Z', createdAt: '2026-11-23T15:38:12Z', createdBy: 'richard@hawktivity.com' })
    ],
    'cd243f94-1d65-4dc6-8f1f-63748d27d38e': [
      row({ version: 1, model: 'per_person', rateMinor: 1000, lengths: [15, 30, 60, 90],
            isActive: true, createdAt: '2026-10-06T19:43:47Z' })
    ]
  };
  var venues = [
    { locationId: 'mock-metropolis', name: 'Metropolis Epsom', boards: [{ name: 'Metropolis Lane 1', isTest: false }] },
    { locationId: 'mock-rising-sun', name: 'The Rising Sun', boards: [{ name: 'The Rising Sun board 1 (PC1)', isTest: false }] },
    { locationId: 'cd243f94-1d65-4dc6-8f1f-63748d27d38e', name: 'cd243f94-1d65-4dc6-8f1f-63748d27d38e', boards: [] }
  ];

  function scheduled(r) { return !r.isActive && !r.retiredAt && r.effectiveFrom; }

  // pricing_activate_due(), run before every read here.
  function activateDue() {
    var now = Date.now();
    Object.keys(rows).forEach(function (loc) {
      var due = rows[loc].filter(function (r) { return scheduled(r) && Date.parse(r.effectiveFrom) <= now; })
        .sort(function (a, b) { return Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom) || b.version - a.version; });
      if (!due.length) return;
      due.slice(1).forEach(function (r) { r.retiredAt = iso(now); });
      var active = rows[loc].filter(function (r) { return r.isActive; })[0];
      if (active && Date.parse(active.effectiveFrom || active.createdAt) > Date.parse(due[0].effectiveFrom)) {
        due[0].retiredAt = iso(now); return;
      }
      if (active) { active.isActive = false; active.retiredAt = iso(now); }
      due[0].isActive = true;
    });
  }

  function view() {
    activateDue();
    return {
      email: EMAIL, now: iso(Date.now()), jobEveryMinutes: 5,
      venues: venues.map(function (v) {
        var list = rows[v.locationId] || [];
        return {
          locationId: v.locationId, name: v.name, boards: v.boards,
          active: list.filter(function (r) { return r.isActive; })[0] || null,
          scheduled: list.filter(scheduled).sort(function (a, b) { return Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom); }),
          history: list.filter(function (r) { return !r.isActive && !scheduled(r); }).sort(function (a, b) { return b.version - a.version; })
        };
      })
    };
  }

  function fail(code, message) { return { data: null, error: { code: code, message: message } }; }

  function setPrice(a) {
    var list = rows[a.p_location_id];
    if (!list) return fail('22023', 'No venue ' + a.p_location_id);
    if (['per_group', 'per_person'].indexOf(a.p_model) < 0) return fail('22023', 'Unknown model');
    if (!(a.p_rate_minor >= 1 && a.p_rate_minor <= 100000)) return fail('22023', 'The hourly price must be between 1p and £1,000');
    var lengths = (a.p_lengths || []).filter(function (m, i, all) { return all.indexOf(m) === i; }).sort(function (x, y) { return x - y; });
    if (!lengths.length) return fail('22023', 'Sell at least one length');
    if (lengths.length > 4) return fail('22023', 'Sell at most four lengths');
    var overrides = {};
    var bad = Object.keys(a.p_overrides || {}).filter(function (k) {
      var v = a.p_overrides[k];
      overrides[k] = v;
      return lengths.indexOf(Number(k)) < 0 || !(v >= 1 && v <= 100000) || v !== Math.round(v);
    });
    if (bad.length) return fail('22023', 'A price for ' + bad[0] + ' minutes, which isn\'t a length on sale or isn\'t whole pence');
    var note = a.p_note ? String(a.p_note).trim() || null : null;
    if (note && note.length > 120) return fail('22023', 'The note can be at most 120 characters');
    var starts = a.p_starts_at ? Date.parse(a.p_starts_at) : null;
    if (starts != null && starts <= Date.now()) return fail('22023', 'Pick a start in the future, or start it now');

    var active = list.filter(function (r) { return r.isActive; })[0];
    if (a.p_based_on != null && (!active || active.version !== a.p_based_on)) {
      return fail('40001', 'This venue\'s price changed while you were editing (now version ' + (active ? active.version : 'none') + '). Reload to see it.');
    }
    var now = iso(Date.now());
    // An edit of a scheduled price replaces it in the same step (20261123210000).
    if (a.p_replaces) {
      var old = list.filter(function (r) { return r.id === a.p_replaces; })[0];
      if (!old || !scheduled(old)) {
        return fail('22023', 'The price you were editing has started, been changed or been deleted since. Reload to see it.');
      }
      old.retiredAt = now;
    }
    var version = list.reduce(function (n, r) { return Math.max(n, r.version); }, 0) + 1;
    // Bands and their timetable, as pricing_bands_checked stores them (20261123220000): no bands,
    // no timetable; names trimmed; a rule naming no band is refused.
    var bands = (a.p_bands || []).map(function (b) { return { name: String(b.name || '').trim(), rateMinor: b.rateMinor, overrides: b.overrides || {} }; });
    var timetable = null;
    if (bands.length) {
      var tt = a.p_timetable || {};
      var names = [String(tt.base || 'Standard').trim()].concat(bands.map(function (b) { return b.name; }));
      var unknown = (tt.weekly || []).concat(tt.dates || []).filter(function (r) { return names.indexOf(r.band) < 0; })[0];
      if (unknown) return fail('22023', 'A rule names a band "' + unknown.band + '" that isn\'t one of this price\'s bands');
      if (bands.some(function (b) { return !(b.rateMinor >= 1); })) return fail('22023', 'Each band needs an hourly price');
      timetable = { base: names[0], weekly: tt.weekly || [], dates: tt.dates || [] };
    }
    var fresh = row({ version: version, model: a.p_model, rateMinor: a.p_rate_minor, lengths: lengths, overrides: overrides,
                      note: note, createdAt: now, createdBy: EMAIL, bands: bands, timetable: timetable });
    if (starts == null) {
      if (active) { active.isActive = false; active.retiredAt = now; }
      list.forEach(function (r) { if (scheduled(r) && Date.parse(r.effectiveFrom) <= Date.now()) r.retiredAt = now; });
      fresh.isActive = true; fresh.effectiveFrom = now;
    } else {
      list.forEach(function (r) { if (scheduled(r) && Date.parse(r.effectiveFrom) === starts) r.retiredAt = now; });
      fresh.effectiveFrom = iso(starts);
    }
    list.push(fresh);
    return { data: view(), error: null };
  }

  function cancelPrice(a) {
    var r = null;
    Object.keys(rows).forEach(function (loc) { rows[loc].forEach(function (x) { if (x.id === a.p_pricing_id) r = x; }); });
    if (!r || !scheduled(r)) return fail('22023', 'Only a price that hasn\'t started yet can be withdrawn');
    r.retiredAt = iso(Date.now());
    return { data: view(), error: null };
  }

  window.PRICES_MOCK = {
    email: EMAIL,
    call: function (name, args) {
      if (params.has('fail')) return fail('', 'Failed to fetch');
      if (!/@hawktivity\.com$/.test(EMAIL)) return fail('42501', 'Only a Hawktivity Google account can see and change prices');
      if (name === 'dashboard_prices') return { data: view(), error: null };
      if (name === 'dashboard_set_price') return setPrice(args);
      if (name === 'dashboard_cancel_price') return cancelPrice(args);
      return fail('42883', 'mock has no ' + name);
    },
    due: function () {
      Object.keys(rows).forEach(function (loc) {
        rows[loc].forEach(function (r) { if (scheduled(r)) r.effectiveFrom = iso(Date.now() - 1000); });
      });
      return 'Scheduled prices are now due: tap Reload.';
    }
  };
})();
