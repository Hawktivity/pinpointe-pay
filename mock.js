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
 *   cardonly      a venue that sells by card alone: no bar button at all (vouchers offered)
 *   voucher       card-only venue with vouchers: RS-TEST-GOOD works once, RS-USED-0000,
 *                 RS-GONE-0000 and anything else are refused
 *
 * Split payments -- a card-only venue, 4 players, 30 min, £20.00 (£5.00 a head):
 *   split         nobody has paid: Pay for everyone / Pay just my share
 *   splitpartial  £5 of £20 paid: Pay my share / Pay the rest
 *   splitheld     £5 paid and the other £15 is in somebody's card form right now; the
 *                 checkout refuses until "They gave up? Pay the rest" is used
 *   sharepaid     back from paying my £5 share; the rest of the group never pays
 *   splitdone     back from paying my £5 share; the group finishes, the board starts
 *   splitwhole    back from a payment that finished the split (everyone, or the rest)
 *   splitcovered  CHANGE lowered the price below what was already paid: nothing to pay
 *   splitexpired  £5 of £20 paid, but this phone's code has run out
 *   sharerefund   (with &s=x) my £5 is paid but the group never finished: it is going back
 *   splitrace     (with &s=x) a friend paid the last share at the same moment; the board is
 *                 running and my £5 is going back
 * Add &back=1&s=x to any of them to see Stripe's back link release a held share
 * (window.lastRelease). Every checkout request is kept on window.checkoutRequests.
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

  // ---- split payments -----------------------------------------------------------------
  var SPLIT_CASES = ['split', 'splitpartial', 'splitheld', 'sharepaid', 'splitdone',
    'splitwhole', 'splitcovered', 'splitexpired', 'sharerefund', 'splitrace'];
  var splitPolls = 0;
  var coveredSettled = false;
  // What this phone paid, carried through the fake Stripe round trip in the URL.
  var mineMinor = Number(params.get('mockamt')) || 500;

  function splitDescribe(request) {
    var base = {
      ok: true, players: 4, minutes: 30, amountMinor: 2000, currency: 'GBP', kind: 'new',
      suiteId: '9f2c41ab-0e55-4a71-9c8e-2b3d5f6a7c81', expiresInSeconds: 1524,
      alreadyPaid: false, approvedBy: null, paidVia: null, fallbackToken: null,
      cardPayment: true, barPayment: false, splitPayment: true,
      split: null, share: null, codeExpired: false, boardAcknowledged: false
    };
    var partial = { paidMinor: 500, heldMinor: 0, payers: 1, remainingMinor: 1500 };

    if (scenario === 'splitpartial') {
      base.split = partial;
    } else if (scenario === 'splitheld') {
      base.split = { paidMinor: 500, heldMinor: 1500, payers: 1, remainingMinor: 1500 };
    } else if (scenario === 'splitexpired') {
      base.split = partial;
      base.codeExpired = true;
      base.cardPayment = false;
      base.expiresInSeconds = 0;
    } else if (scenario === 'splitcovered') {
      // The board re-quoted for 2 players after three of the original four had paid £5.
      base.players = 2;
      base.amountMinor = 1000;
      base.split = { paidMinor: 1500, heldMinor: 0, payers: 3, remainingMinor: -500 };
      if (coveredSettled) {
        base.alreadyPaid = true;
        base.paidVia = 'card';
        base.fallbackToken = '481902';
        base.boardAcknowledged = acknowledged(true);
      }
    } else if (scenario === 'sharerefund') {
      // The split was closed unfinished; describe reports the share and what is going back.
      base.share = { state: 'paid', amountMinor: 500, heads: 1, splitState: 'abandoned', returnedMinor: 500 };
    } else if (scenario === 'splitrace') {
      base.share = { state: 'paid', amountMinor: 500, heads: 1, splitState: 'complete', returnedMinor: 500 };
      base.alreadyPaid = true;
      base.paidVia = 'card';
      base.fallbackToken = '481902';
      base.cardPayment = false;
      base.splitPayment = false;
      base.boardAcknowledged = acknowledged(true);
    } else if (scenario === 'sharepaid' || scenario === 'splitdone' || scenario === 'splitwhole') {
      splitPolls++;
      // The webhook lands on the second ask, as it does for a whole card payment.
      var landed = splitPolls >= 2;
      base.share = { state: landed ? 'paid' : 'held', amountMinor: mineMinor, heads: 1 };
      base.split = landed
        ? { paidMinor: 500, heldMinor: 0, payers: 1, remainingMinor: 1500 }
        : { paidMinor: 0, heldMinor: mineMinor, payers: 0, remainingMinor: 2000 };
      // splitdone: the rest of the group pays a few asks later; splitwhole: this payment
      // was the one that finished it.
      var complete = (scenario === 'splitdone' && splitPolls >= 5)
        || (scenario === 'splitwhole' && landed);
      if (complete) {
        base.split = { paidMinor: 2000, heldMinor: 0, payers: 4, remainingMinor: 0 };
        base.alreadyPaid = true;
        base.paidVia = 'card';
        base.fallbackToken = '481902';
        base.cardPayment = false;
        base.splitPayment = false;
        base.boardAcknowledged = acknowledged(true);
      }
    }

    if (request && !request.share) base.share = null;
    return later(body(base), 250);
  }

  window.checkoutRequests = [];

  function splitCheckout(request) {
    if (request.action === 'release') {
      window.lastRelease = request;
      return later(body({ ok: true, released: true }), 200);
    }
    if (scenario === 'splitcovered') {
      coveredSettled = true;
      return later(body({ ok: true, settled: true }), 500);
    }
    if (scenario === 'splitheld' && !request.ignoreHolds) {
      return later(body({
        ok: false, reason: 'held_elsewhere', heldMinor: 1500, paidMinor: 500,
        remainingMinor: 1500,
        message: 'Someone is paying the rest on another phone right now.'
      }, 409));
    }

    var paidAlready = scenario === 'split' ? 0 : 500;
    var left = 2000 - paidAlready;
    var amount = Math.min(left, 500 * Math.max(1, request.heads || 4));
    var back = new URL(window.location.href);
    back.searchParams.set('paid', '1');
    back.searchParams.set('s', 'mock-share-' + window.checkoutRequests.length);
    back.searchParams.set('mockamt', String(amount));
    back.searchParams.set('case', amount >= left ? 'splitwhole' : 'sharepaid');
    return later(body({
      ok: true, url: back.toString(), amountMinor: amount, currency: 'GBP',
      shareId: 'mock-share-' + window.checkoutRequests.length
    }), 700);
  }

  function describe(request) {
    if (SPLIT_CASES.indexOf(scenario) >= 0) {
      return splitDescribe(request);
    }
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
      cardPayment: scenario === 'card' || scenario === 'cardoff' || scenario === 'cardonly'
        || scenario === 'voucher',
      // Only ever false where a venue has withdrawn the bar route. Absent means bar.
      barPayment: scenario !== 'cardonly' && scenario !== 'voucher',
      boardAcknowledged: acknowledged(false)
    }));
  }

  /**
   * The card endpoint. Stripe is not involved: a successful "checkout" sends the page back
   * to itself with ?paid=1, which is exactly the shape of the real round trip.
   */
  function checkout(request) {
    window.checkoutRequests.push(request);
    if (SPLIT_CASES.indexOf(scenario) >= 0) {
      return splitCheckout(request);
    }
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
    return request.action === 'describe' ? describe(request) : unlock(request);
  };

  window.PAY_CONFIG.checkoutTransport = checkout;

  // Vouchers, offered in the `voucher` and `cardonly` cases. RS-TEST-GOOD works once; then
  // "already used". RS-USED-0000 is used, RS-GONE-0000 revoked; anything else is unknown.
  var voucherSpent = false;
  window.PAY_CONFIG.voucherTransport = function (request) {
    var offered = scenario === 'voucher' || scenario === 'cardonly';
    if (request.action === 'available') {
      return later(body({ ok: true, available: offered && scenario !== 'ext', maxMinutes: 60 }), 200);
    }
    var typed = String(request.voucher || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (typed === 'RSTESTGOOD' && !voucherSpent) {
      voucherSpent = true;
      unlocked = true;
      return later(body({
        ok: true, players: 7, minutes: 60, amountMinor: 7000, currency: 'GBP', kind: 'new',
        paidVia: 'voucher', fallbackToken: '481902'
      }), 800);
    }
    if (typed === 'RSTESTGOOD' || typed === 'RSUSED0000') {
      return later(body({ ok: false, reason: 'used', message: 'That voucher has already been used.' }, 409));
    }
    if (typed === 'RSGONE0000') {
      return later(body({ ok: false, reason: 'revoked', message: 'That voucher is no longer valid.' }, 410));
    }
    return later(body({
      ok: false, reason: 'unknown',
      message: 'That voucher code wasn’t recognised. Check it and try again.'
    }, 404));
  };

  // register.html. Says whether the registration was for an under-18, from the date of
  // birth, the way the real endpoint does, so both done screens can be seen. Records the
  // last submission on window.lastRegistration for checking what the page sent.
  //
  // Remembered players (register.html only), chosen with &case=:
  //   (default)    passkeys offered; Join finds "Sam", Remember me saves
  //   nopasskeys   a backend that doesn't offer them: the page looks as it always did
  //   unknown      Join's passkey was forgotten on our side
  //   cancel       the guest cancels Face ID, on Join and on Remember me
  //   sameemail    Remember me keeps everything but the email (only with nocodes)
  //   nocodes      a backend that can't email codes: Remember me as before 14 Nov
  //   merged       Remember me with an email already saved: the phone is added
  //   norecover    a new phone's email has no saved details
  // Email codes are on unless nocodes/nopasskeys; the code is always 123456.
  // The phone's passkey store is faked too (PAY_CONFIG.passkeys), so no real Face ID or
  // Windows Hello prompt ever appears.
  function fakeCredential(kind) {
    var b = function (n) { return new Uint8Array(n).buffer; };
    var response = kind === 'create'
      ? { clientDataJSON: b(8), attestationObject: b(8), getTransports: function () { return ['internal']; } }
      : { clientDataJSON: b(8), authenticatorData: b(8), signature: b(8), userHandle: b(16) };
    return {
      id: 'mock-credential', rawId: b(16), type: 'public-key', response: response,
      authenticatorAttachment: 'platform', getClientExtensionResults: function () { return {}; }
    };
  }
  function refused() {
    var e = new Error('The operation either timed out or was not allowed.');
    e.name = 'NotAllowedError';
    return e;
  }
  window.PAY_CONFIG.passkeys = {
    create: function () { return later(scenario === 'cancel' ? refused() : fakeCredential('create'), 700); },
    get: function () { return later(scenario === 'cancel' ? refused() : fakeCredential('get'), 700); }
  };
  var mockOptions = {
    create: { challenge: 'AAAA', rp: { id: 'localhost', name: 'Hawktivity Darts' },
              user: { id: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'Sam', displayName: 'Sam' },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }] },
    get: { challenge: 'AAAA', rpId: 'localhost', allowCredentials: [] }
  };

  window.PAY_CONFIG.registerTransport = function (request) {
    if (request.action === 'describe') {
      return later(body({ ok: true, suiteName: 'Suite 1', expiresInSeconds: 1500, registered: 0, full: false,
                          remember: scenario !== 'nopasskeys',
                          emailCodes: scenario !== 'nopasskeys' && scenario !== 'nocodes' }));
    }
    if (request.action === 'email_code') {
      window.lastEmailCode = request;
      return later(body({ ok: true }), 500);
    }
    if (request.action === 'verify_email') {
      return later(body(request.emailCode === '123456'
        ? { ok: true, emailTicket: 'mock-ticket-' + request.purpose + '-00000000000000' }
        : { ok: false, reason: 'wrong', message: 'That’s not the code. Check the email and try again.' },
        request.emailCode === '123456' ? 200 : 400), 300);
    }
    if (request.action === 'recover_options') {
      if (scenario === 'norecover') {
        return later(body({ ok: false, reason: 'not_found',
          message: 'We don’t have saved details for that email. Fill in the form, then choose Remember me.' }, 404));
      }
      return later(body({ ok: true, firstName: 'Sam', challengeId: '00000000-0000-4000-8000-000000000003',
                          options: mockOptions.create }), 300);
    }
    if (request.action === 'recover') {
      window.lastRecover = request;
      return later(body({ ok: true, firstName: 'Sam', suiteName: 'Suite 1', alreadyOn: false,
                          photoKept: true, forgetToken: 'mock-forget-token-0000000000' }));
    }
    if (request.action === 'join_options') {
      return later(body({ ok: true, challengeId: '00000000-0000-4000-8000-000000000001', options: mockOptions.get }), 300);
    }
    if (request.action === 'enrol_options') {
      return later(body({ ok: true, challengeId: '00000000-0000-4000-8000-000000000002', options: mockOptions.create }), 300);
    }
    if (request.action === 'join') {
      window.lastJoin = request;
      if (scenario === 'unknown') {
        return later(body({ ok: false, reason: 'unknown_passkey',
          message: 'We don’t have that one saved any more. Fill in the form instead.' }, 400));
      }
      return later(body({ ok: true, firstName: 'Sam', suiteName: 'Suite 1', alreadyOn: false,
                          photoKept: true, forgetToken: 'mock-forget-token-0000000000' }));
    }
    if (request.action === 'enrol') {
      window.lastEnrol = request;
      var codes = scenario !== 'nopasskeys' && scenario !== 'nocodes';
      if (codes && !request.emailTicket) {
        return later(body({ ok: false, reason: 'email_unverified',
          message: 'Confirm your email with the code we sent, then tap Remember me.' }, 400));
      }
      return later(body({ ok: true, firstName: request.firstName, emailKept: scenario !== 'sameemail',
                          emailVerified: codes, merged: scenario === 'merged',
                          forgetToken: 'mock-forget-token-0000000000' }));
    }
    if (request.action === 'forget') {
      window.lastForget = request;
      return later(body({ ok: true }));
    }
    window.lastRegistration = request;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(request.dateOfBirth || '');
    if (!m) {
      return later(body({ ok: false, reason: 'no_birth_date', message: 'Enter your date of birth.' }, 400));
    }
    var now = new Date();
    var had = now.getMonth() + 1 > +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() >= +m[3]);
    var minor = now.getFullYear() - +m[1] - (had ? 0 : 1) < 18;
    return later(body({
      ok: true, firstName: request.firstName, suiteName: 'Suite 1',
      underEighteen: minor, photoKept: !minor && !!request.photo,
      canRemember: !minor && scenario !== 'nopasskeys'
    }));
  };


  // Six quick asks rather than fifteen slow ones, so the "still confirming" screen can be
  // reached in a few seconds instead of half a minute.
  window.PAY_CONFIG.paymentPollAttempts = 6;
  window.PAY_CONFIG.paymentPollMs = 500;

  // Same reasoning for the wait on the board: sixteen seconds is right in a pub and
  // tedious on a laptop, and the thing being walked through is which panel appears,
  // not how long it took.
  window.PAY_CONFIG.boardAckTries = 4;
  window.PAY_CONFIG.boardAckPollMs = 400;

  // And for a share payer waiting on the rest of the group: quick asks, and few enough that
  // `sharepaid` reaches its "Check again" button in about ten seconds.
  window.PAY_CONFIG.splitPollMs = 700;
  window.PAY_CONFIG.splitPollTries = 14;

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
