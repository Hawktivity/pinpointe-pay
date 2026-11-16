/* -----------------------------------------------------------------------------
 * Made-up sessions for walking through the dashboard without Google or a
 * database. Loaded only on a local copy opened with ?mock (config.js gates it on
 * the hostname), never on a deployed one. Nothing here is real.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var seed = 20261116;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }

  var BOARDS = [
    { suiteRowId: 'mock-rs-1', board: 'The Rising Sun board 1 (PC1)', venue: 'The Rising Sun', locationId: 'mock-rs' },
    { suiteRowId: 'mock-oa-1', board: 'Oxford Arms board 1 (PC2)', venue: 'Oxford Arms board 1 (PC2)', locationId: 'mock-oa' }
  ];
  var GAMES = [10, 10, 10, 7, 7, 3, 3, 5, 5, 1, 8, 2, 6, 4, 9];
  var HINTS = ['SJXV', 'HC48', 'ZX2J', 'KNVW', 'MUGE', '6SY5', 'Q7PD', 'T3LM'];

  var rows = [];
  var now = Date.now();
  for (var i = 0; i < 70; i++) {
    var b = rnd() < 0.8 ? BOARDS[0] : BOARDS[1];
    var daysAgo = Math.floor(Math.pow(rnd(), 1.6) * 34);
    var start = new Date(now - daysAgo * 864e5);
    start.setUTCHours(12 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0);
    if (start.getTime() > now) start = new Date(now - 3600e3 * (1 + rnd() * 3));
    var heads = 1 + Math.floor(rnd() * 4);
    var minutes = pick([15, 15, 30, 60]);
    var how = rnd();
    var acts = [];
    var at = start.toISOString();
    if (how < 0.55) {
      acts.push({ kind: 'new', paidVia: 'card', at: at, players: heads, minutes: minutes, priceMinor: heads * minutes / 60 * 1000,
        currency: 'GBP', isTest: false, acked: true, voucher: null, sharesPaid: heads > 1 && rnd() < 0.3 ? 2 : 1,
        refundedMinor: rnd() < 0.05 ? 500 : 0 });
    } else if (how < 0.92) {
      minutes = 15;
      acts.push({ kind: 'new', paidVia: 'voucher', at: at, players: heads, minutes: 15, priceMinor: heads * 250,
        currency: 'GBP', isTest: false, acked: true, voucher: { hint: pick(HINTS), batch: 'The Rising Sun 15-minute tasters, 14 Nov 2026', maxMinutes: 15 },
        sharesPaid: 0, refundedMinor: 0 });
    }
    if (acts.length && rnd() < 0.15) {
      acts.push({ kind: 'ext', paidVia: 'card', at: new Date(start.getTime() + minutes * 60e3).toISOString(), players: heads, minutes: 30,
        priceMinor: heads * 500, currency: 'GBP', isTest: false, acked: rnd() < 0.8, voucher: null, sharesPaid: 1, refundedMinor: 0 });
      minutes += 30;
    }
    if (acts.length && rnd() < 0.1) {
      acts.push({ kind: 'join', paidVia: 'card', at: new Date(start.getTime() + 6 * 60e3).toISOString(), players: 1, minutes: minutes - 6,
        priceMinor: 250, currency: 'GBP', isTest: false, acked: false, voucher: null, sharesPaid: 1, refundedMinor: 0 });
      heads++;
    }
    var isTest = rnd() < 0.12;
    acts.forEach(function (a) { a.isTest = isTest; });
    var uploaded = daysAgo > 0 || rnd() < 0.7;
    var len = minutes - Math.floor(rnd() * 3);
    var games = [];
    if (uploaded) {
      var t = start.getTime() + 60e3;
      while (t < start.getTime() + len * 60e3) {
        var secs = 120 + Math.floor(rnd() * 600);
        games.push({ typeId: pick(GAMES), startedAt: new Date(t).toISOString(), completed: rnd() < 0.85, seconds: secs,
          rounds: 3 + Math.floor(rnd() * 10), players: heads });
        t += secs * 1000 + 30e3;
      }
    }
    rows.push({
      sessionId: 'SMOCK' + (100000 + i), suiteRowId: b.suiteRowId, board: b.board, venue: b.venue, locationId: b.locationId,
      startedAt: start.toISOString(), boardStartedAt: uploaded ? start.toISOString() : null,
      boardEndedAt: uploaded ? new Date(start.getTime() + len * 60e3).toISOString() : null,
      uploaded: uploaded, isTest: isTest, activations: acts,
      guests: (function () {
        var u18 = rnd() < 0.1 ? 1 : 0, extra = rnd() < 0.1 ? 1 : 0;
        return uploaded
          ? { registered: heads + extra, registeredUnder18: u18, played: games.length ? heads : 0, playedUnder18: games.length ? u18 : 0, remembered: rnd() < 0.3 ? 1 : 0 }
          : { registered: 0, registeredUnder18: 0, played: 0, playedUnder18: 0, remembered: 0 };
      })(),
      games: games
    });
  }
  rows.sort(function (a, b) { return b.startedAt < a.startedAt ? -1 : 1; });

  window.DASHBOARD_MOCK = {
    email: 'someone@hawktivity.com',
    rows: function (from) {
      return JSON.parse(JSON.stringify(rows.filter(function (r) { return !from || new Date(r.startedAt) >= from; })));
    }
  };
})();
