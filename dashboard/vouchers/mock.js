/* -----------------------------------------------------------------------------
 * Made-up venues and codes for walking through the staff voucher page without
 * Google or a database. Loaded only on a local copy opened with ?mock (config.js
 * gates it on the hostname), never on a deployed one. Nothing here is real: the
 * codes are random and would be refused by any board.
 *
 * From the console: STAFF_VOUCHERS_MOCK.use(3) marks three codes of the length on
 * screen as used, as if guests had spent them; then tap Check now.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  var seed = 20261122;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function code(prefix) {
    var s = '';
    for (var i = 0; i < 8; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
    return prefix + '-' + s.slice(0, 4) + '-' + s.slice(4);
  }
  function batch(prefix, minutes, total, used) {
    var codes = [];
    for (var i = 0; i < total; i++) codes.push(code(prefix));
    return { minutes: minutes, all: codes, spent: codes.slice(0, used) };
  }

  var venues = [
    { locationId: 'mock-metropolis', name: 'Metropolis Epsom',
      batches: [batch('MET', 15, 50, 0), batch('MET', 60, 50, 0)] },
    { locationId: 'mock-rising-sun', name: 'The Rising Sun',
      batches: [batch('RS', 15, 50, 20)] }
  ];
  var access = [
    { email: 'brianroberthowe@gmail.com', locationId: 'mock-rising-sun', venue: 'The Rising Sun', note: null, addedBy: 'richard@hawktivity.com', addedAt: '2026-11-22T17:00:00Z' }
  ];

  function view() {
    return {
      email: 'richard@hawktivity.com',
      admin: true,
      venues: venues.map(function (v) {
        return {
          locationId: v.locationId, name: v.name,
          lengths: v.batches.map(function (b) {
            return {
              minutes: b.minutes,
              codes: b.all.filter(function (c) { return b.spent.indexOf(c) < 0; }).sort(),
              used: b.spent.length,
              total: b.all.length
            };
          })
        };
      }).sort(function (a, b) { return a.name < b.name ? -1 : 1; })
    };
  }

  window.STAFF_VOUCHERS_MOCK = {
    email: 'richard@hawktivity.com',
    call: function (name, args) {
      if (name === 'staff_vouchers') return { data: view(), error: null };
      if (name === 'staff_access_list') return { data: access.slice(), error: null };
      if (name === 'staff_access_grant') {
        var email = String(args.p_email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return { data: null, error: { code: '22023', message: 'That is not an email address: ' + args.p_email } };
        }
        var v = venues.filter(function (x) { return x.locationId === args.p_location_id; })[0];
        access = access.filter(function (a) { return !(a.email === email && a.locationId === args.p_location_id); });
        access.push({ email: email, locationId: args.p_location_id, venue: v ? v.name : args.p_location_id,
                      note: null, addedBy: 'richard@hawktivity.com', addedAt: new Date().toISOString() });
        return { data: access.slice(), error: null };
      }
      if (name === 'staff_access_revoke') {
        access = access.filter(function (a) { return !(a.email === args.p_email && a.locationId === args.p_location_id); });
        return { data: access.slice(), error: null };
      }
      return { data: null, error: { code: '42883', message: 'mock has no ' + name } };
    },
    // Spend n codes of the venue and length now on screen, as guests would.
    use: function (n) {
      var pick = {};
      try { pick = JSON.parse(localStorage.getItem('staff-vouchers:pick') || '{}') || {}; } catch (e) {}
      var v = venues.filter(function (x) { return x.locationId === pick.venue; })[0] || venues[0];
      var b = v.batches.filter(function (x) { return x.minutes === pick.minutes; })[0] || v.batches[0];
      var left = b.all.filter(function (c) { return b.spent.indexOf(c) < 0; });
      b.spent = b.spent.concat(left.slice(0, n || 1));
      return (n || 1) + ' used at ' + v.name + ', ' + b.minutes + ' min';
    }
  };
})();
