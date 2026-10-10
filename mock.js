/* -----------------------------------------------------------------------------
 * A fake unlock endpoint, for walking the page's screens on a laptop.
 *
 * Loaded only from a localhost copy, and only with ?mock in the URL -- config.js
 * is what enforces both, so a deployed copy never fetches this file.
 *
 * Scenarios, chosen with &case=:
 *   (default)     a £70 session, correct password is "pub"
 *   ext           an extension to a session already running
 *   join          one more player buying a seat on a session already running
 *   paid          a code that has already been redeemed
 *   expired       a code past its half hour
 *   altered       a forged payload
 *   nostaff       a venue with nobody set up to unlock
 *   offline       the network is down
 *   fallback      unlock succeeds but the board never answers -- with cardpending,
 *                 the only way to see the six digits at all
 *   card          a venue that takes cards: the button shows and "pays"
 *   cardreturn    back from the card page; the row lands on the third ask
 *   cardpending   back from the card page and the row never lands
 *   cardoff       the button shows but checkout refuses it
 *   cardonly      a venue that sells by card alone: no bar button at all
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var scenario = params.get('case') || 'new';
  var PASSWORD = 'pub';
  var failures = 0;
  var polls = 0;
  var ackPolls = 0;
  var unlocked = false;
  var LIMIT = 5;

  /**
   * Whether the board has said it applied this activation.
   *
   * The page polls describe for this and only offers the six digits once it has given up,
   * so the mock has to be able to say no indefinitely -- `fallback` and `cardpending` are
   * the boards that never answer, and they are the only way to see the digits panel at all.
   * Everything else answers on the second ask, which is about what a real one does.
   */
  function acknowledged(paid) {
    if (!paid && !unlocked) return false;
    if (scenario === 'fallback' || scenario === 'cardpending') return false;
    // Already redeemed and long since picked up -- a guest reopening their own link.
    if (scenario === 'paid') return true;
    ackPolls++;
    return ackPolls >= 2;
  }

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
        expiresInSeconds: 900, alreadyPaid: true, approvedBy: 'Dani', paidVia: 'bar',
        fallbackToken: '481902',
        boardAcknowledged: acknowledged(true)
      }));
    }

    // Back from the card page. The row is written by the webhook, not by the redirect, so
    // the page asks again every couple of seconds until it appears -- here on the third
    // ask, which is roughly what a real one looks like. `cardpending` never answers yes,
    // so the "do not pay again" screen can be seen without breaking anything.
    if (scenario === 'cardreturn' || scenario === 'cardpending') {
      polls++;
      var landed = scenario === 'cardreturn' && polls >= 3;
      return later(body({
        ok: true, players: 7, minutes: 60, amountMinor: 7000, currency: 'GBP',
        kind: 'new', suiteId: '9f2c41ab-0e55-4a71-9c8e-2b3d5f6a7c81',
        expiresInSeconds: 900,
        alreadyPaid: landed,
        approvedBy: null,
        paidVia: landed ? 'card' : null,
        cardPayment: false,
        fallbackToken: landed ? '481902' : null,
        boardAcknowledged: acknowledged(landed)
      }), 250);
    }

    // A join is always exactly one head and its minutes are what is LEFT to play, not time
    // bought -- which is the case the page used to get wrong in three places.
    if (scenario === 'join') {
      return later(body({
        ok: true, players: 1, minutes: 45, amountMinor: 750, currency: 'GBP',
        kind: 'join', suiteId: '9f2c41ab-0e55-4a71-9c8e-2b3d5f6a7c81',
        expiresInSeconds: 1524, alreadyPaid: false, approvedBy: null,
        boardAcknowledged: acknowledged(false)
      }));
    }

    return later(body({
      ok: true,
      players: 7,
      minutes: scenario === 'ext' ? 30 : 60,
      amountMinor: scenario === 'ext' ? 3500 : 7000,
      currency: 'GBP',
      kind: scenario === 'ext' ? 'ext' : 'new',
      suiteId: '9f2c41ab-0e55-4a71-9c8e-2b3d5f6a7c81',
      expiresInSeconds: 1524,
      alreadyPaid: false,
      approvedBy: null,
      cardPayment: scenario === 'card' || scenario === 'cardoff' || scenario === 'cardonly',
      // Only ever false where a venue has withdrawn the bar route. Absent means bar.
      barPayment: scenario !== 'cardonly',
      boardAcknowledged: acknowledged(false)
    }));
  }

  /**
   * The card endpoint. Stripe is not involved: a successful "checkout" sends the page back
   * to itself with ?paid=1, which is exactly the shape of the real round trip.
   */
  function checkout() {
    if (scenario === 'cardoff') {
      return later(body({
        ok: false, reason: 'not_enabled',
        message: 'This venue takes payment at the bar. Show this screen to your server.'
      }, 403));
    }

    var back = new URL(window.location.href);
    back.searchParams.set('paid', '1');
    back.searchParams.set('case', 'cardreturn');
    return later(body({ ok: true, url: back.toString(), amountMinor: 7000, currency: 'GBP' }), 700);
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

    // The bar rail has now put a row in front of the board, so describe should start
    // reporting that the board picked it up -- otherwise the default walkthrough ends on
    // the six digits, which is the behaviour this whole change exists to remove.
    unlocked = true;

    // No kind here, deliberately: the real endpoint does not send one either, so this is what
    // keeps the page honest about reading it from the describe response instead.
    return later(body({
      ok: true,
      approvedBy: 'Dani',
      minutes: scenario === 'join' ? 45 : scenario === 'ext' ? 30 : 60,
      players: scenario === 'join' ? 1 : 7,
      amountMinor: scenario === 'join' ? 750 : scenario === 'ext' ? 3500 : 7000,
      currency: 'GBP',
      fallbackToken: '481902'
    }), 900);
  }

  window.PAY_CONFIG.transport = function (request) {
    return request.action === 'describe' ? describe() : unlock(request);
  };

  window.PAY_CONFIG.checkoutTransport = checkout;

  // Six quick asks rather than fifteen slow ones, so the "still confirming" screen can be
  // reached in a few seconds instead of half a minute.
  window.PAY_CONFIG.paymentPollAttempts = 6;
  window.PAY_CONFIG.paymentPollMs = 500;

  // Same reasoning for the wait on the board: sixteen seconds is right in a pub and
  // tedious on a laptop, and the thing being walked through is which panel appears,
  // not how long it took.
  window.PAY_CONFIG.boardAckTries = 4;
  window.PAY_CONFIG.boardAckPollMs = 400;

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
