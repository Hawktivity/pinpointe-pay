/* -----------------------------------------------------------------------------
 * A fake unlock endpoint, for walking the page's screens on a laptop.
 *
 * Loaded only from a localhost copy, and only with ?mock in the URL -- config.js
 * is what enforces both, so a deployed copy never fetches this file.
 *
 * Scenarios, chosen with &case=:
 *   (default)     a £70 session, correct password is "pub"
 *   ext           an extension to a session already running
 *   paid          a code that has already been redeemed
 *   expired       a code past its half hour
 *   altered       a forged payload
 *   nostaff       a venue with nobody set up to unlock
 *   offline       the network is down
 *   fallback      unlock succeeds but the board never answers
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var scenario = params.get('case') || 'new';
  var PASSWORD = 'pub';
  var failures = 0;
  var LIMIT = 5;

  function later(value, ms) {
    return new Promise(function (resolve, reject) {
      window.setTimeout(function () {
        if (value instanceof Error) { reject(value); } else { resolve(value); }
      }, ms == null ? 600 : ms);
    });
  }

  function body(data, status) {
    return { status: status || 200, data: data };
  }

  function describe() {
    if (scenario === 'offline') {
      return later(new Error('Failed to fetch'), 1200);
    }
    if (scenario === 'expired') {
      return later(body({
        ok: false, reason: 'expired',
        message: 'This code was made more than half an hour ago. Ask the suite for a new one.'
      }, 400));
    }
    if (scenario === 'altered') {
      return later(body({
        ok: false, reason: 'altered',
        message: 'This code has been changed since the suite made it.'
      }, 400));
    }
    if (scenario === 'paid') {
      return later(body({
        ok: true, players: 7, minutes: 60, amountMinor: 7000, currency: 'GBP',
        kind: 'new', suiteId: '9f2c41ab-0e55-4a71-9c8e-2b3d5f6a7c81',
        expiresInSeconds: 900, alreadyPaid: true, approvedBy: 'Dani'
      }));
    }

    return later(body({
      ok: true,
      players: scenario === 'ext' ? 7 : 7,
      minutes: scenario === 'ext' ? 30 : 60,
      amountMinor: scenario === 'ext' ? 3500 : 7000,
      currency: 'GBP',
      kind: scenario === 'ext' ? 'ext' : 'new',
      suiteId: '9f2c41ab-0e55-4a71-9c8e-2b3d5f6a7c81',
      expiresInSeconds: 1524,
      alreadyPaid: false,
      approvedBy: null
    }));
  }

  function unlock(request) {
    if (scenario === 'offline') {
      return later(new Error('Failed to fetch'), 1200);
    }
    if (scenario === 'nostaff') {
      return later(body({
        ok: false, reason: 'no_staff',
        message: 'No staff passwords have been set up for this venue.'
      }, 403));
    }

    if (request.password !== PASSWORD) {
      failures++;
      if (failures >= LIMIT) {
        return later(body({
          ok: false, reason: 'locked', retryAfterSeconds: 180,
          attemptsRemaining: 0
        }, 429));
      }
      return later(body({
        ok: false, reason: 'wrong_password',
        attemptsRemaining: LIMIT - failures
      }, 403));
    }

    return later(body({
      ok: true,
      approvedBy: 'Dani',
      minutes: scenario === 'ext' ? 30 : 60,
      players: 7,
      amountMinor: scenario === 'ext' ? 3500 : 7000,
      currency: 'GBP',
      fallbackToken: '481902'
    }), 900);
  }

  window.PINPOINTE_CONFIG.transport = function (request) {
    return request.action === 'describe' ? describe() : unlock(request);
  };

  // Obvious on screen, so a mocked run is never mistaken for a real one.
  window.addEventListener('DOMContentLoaded', function () {
    var flag = document.createElement('div');
    flag.textContent = 'MOCK · password "pub" · case=' + scenario;
    flag.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#d08a2c;' +
      'color:#1a1206;font:600 10px/1 Montserrat,sans-serif;letter-spacing:.16em;' +
      'text-transform:uppercase;text-align:center;padding:8px 6px';
    document.body.appendChild(flag);
  });
})();
