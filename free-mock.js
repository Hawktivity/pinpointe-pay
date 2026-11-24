/* -----------------------------------------------------------------------------
 * A fake free-15 backend for walking free.html's screens on a local copy:
 *   http://localhost:8000/free.html?mock            (sign up at home)
 *   http://localhost:8000/free.html?mock&c=board    (at the board: Ann, Bob, Cat)
 *   ...&case=one                                    (at the board, one adult)
 * Loaded by config.js only on localhost and only with ?mock. Any code typed works except
 * FR-USED-USED (already used) and FR-GONE-GONE (expired).
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var adults = params.get('case') === 'one'
    ? [{ id: 1, name: 'Ann' }]
    : [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Cat' }];
  var covered = {};
  var sent = 0;
  var now = function () { return new Promise(function (r) { setTimeout(r, 350); }); };

  function standing(extra) {
    var complete = adults.every(function (a) { return covered[a.id]; });
    return Object.assign({
      ok: true,
      complete: complete,
      superseded: false,
      venue: 'The Rising Sun',
      minutes: 15,
      players: adults.map(function (a) { return { id: a.id, name: a.name, covered: !!covered[a.id] }; }),
      covered: adults.filter(function (a) { return covered[a.id]; }).map(function (a) { return a.id; }),
      needed: adults.length,
      expiresInSeconds: 1500,
      fallbackToken: complete ? '482913' : undefined
    }, extra || {});
  }

  window.PAY_CONFIG.freeTransport = function (request) {
    return now().then(function () {
      switch (request.action) {
        case 'venues':
          return { ok: true, venues: [
            { venue: 'rs', name: 'The Rising Sun', minutes: 15 },
            { venue: 'met', name: 'Metropolis Epsom', minutes: 15 }
          ] };
        case 'signup':
          if (request.offersConsent !== true) {
            return { ok: false, reason: 'offers_required', message: 'Tick the box to join our offers list. That’s what gets you the free 15 minutes.' };
          }
          if (request.dateOfBirth > '2008-11-24') {
            return { ok: false, reason: 'under_18', message: 'Free 15 codes are for over-18s. Under-18s play free with the adults they come with.' };
          }
          sent++;
          return { ok: true, sentTo: request.email.charAt(0) + '***' + request.email.slice(request.email.indexOf('@')),
                   devCode: 'FR-TEST-000' + sent };
        case 'status':
          return standing();
        case 'claim': {
          var v = String(request.voucher || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (v === 'FRUSEDUSED') return { ok: false, reason: 'used', message: 'That code has already been used. It’s one free 15 per person.' };
          if (v === 'FRGONEGONE') return { ok: false, reason: 'expired_code', message: 'That code has expired.' };
          covered[request.playerId] = true;
          return standing();
        }
        default:
          return { ok: false, reason: 'action', message: 'Unknown action.' };
      }
    });
  };
})();
