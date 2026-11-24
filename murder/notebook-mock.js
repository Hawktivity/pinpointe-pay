/* -----------------------------------------------------------------------------
 * A made-up Case 1 for walking notebook.html on a laptop: notebook.html?mock=1.
 *
 * Loaded only from a localhost copy with ?mock in the URL -- config.js enforces both, so a
 * deployed copy never fetches this file. Nothing here is real, and nothing here is the
 * answer: like the board, it publishes only what a table could have found.
 *
 * Scenarios, chosen with &case=:
 *   (default)  mid-case on Novice: five clues, two suspects questioned, Nell cleared,
 *              this phone has voted Freddie / poisoned port, two other phones have voted
 *   briefing   the case has just opened: nothing found
 *   accusing   the table is on the accuse screen
 *   closed     two good reads, then the board finishes the case
 *   waiting    the board has not published anything yet
 *   offline    one good read, then every ask fails ("catching up")
 *   bad        the code is refused (401)
 * &phase= (briefing, hub, throwing, revealing, accusing) and &kind= (search, interview,
 * ezra, chase) set what the table is doing now, for the line under the heading.
 * Votes work: tap to change them and the tally follows. A phone's crosses and circles are
 * seeded once (Major Pike crossed, Freddie circled) so the Suspects page shows both.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var scenario = params.get('case') || 'hub';
  var reads = 0;

  // A code-shaped string naming session MOCK-1. Unsigned: the mock never checks it.
  window.PAY_CONFIG.mockCode = btoa(JSON.stringify({ v: 1, loc: 'mock', ste: 'mock', sid: 'MOCK-1', k: 'note' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.mock';
  window.PAY_CONFIG.notebookPollMs = 2500;

  var FOUND = [
    { letter: 'A', place: 'The cellar', tier: 'obvious',
      text: 'Venn lies at the foot of the steps with a lump on his head and a broken port glass beside him.' },
    { letter: 'B', place: 'The cellar', tier: 'hidden',
      text: 'The port spilled from the glass smells of bitter almonds. This was poison, not a fall.' },
    { letter: 'C', place: 'The snug', tier: 'obvious',
      text: 'Mrs Stoke’s knitting and three empty sherry glasses by the fire. “He spent ten minutes bullying me about my Arthur’s debts, then stormed out at twenty-five to nine.”' },
    { letter: 'D', place: 'The snug', tier: 'hidden',
      text: 'Alfie: “Nell never went out the back all night. I was on the back door from eight.”' },
    { letter: 'E', place: 'The garden', tier: 'obvious',
      text: 'In the shed, a tin of wasp-nest killer, the deadly sort, with its lid prised off and a spoonful missing.' }
  ];

  function state() {
    // &phase= and &kind= put the table mid-action, e.g. &phase=throwing&kind=search or
    // &phase=revealing&kind=interview, to see each "Now" line.
    var kind = params.get('kind') || 'none';
    var briefing = scenario === 'briefing';
    var accusing = scenario === 'accusing';
    return {
      v: 1,
      case: { id: 'case01', number: 1, title: 'The Death of Silas Venn',
              boardLine: 'Found dead in the cellar of the Rising Sun at closing time. Nobody leaves till we know who.' },
      level: 'novice',
      clock: briefing ? '9.00' : accusing ? '10.40' : '10.05',
      minutesLeft: briefing ? 120 : accusing ? 20 : 55,
      phase: params.get('phase') || (briefing ? 'briefing' : accusing ? 'accusing' : 'hub'),
      action: { kind: kind, place: kind === 'search' ? 'The cellar' : null, suspect: kind === 'interview' ? 'pike' : null },
      victim: { name: 'Silas Venn', portrait: 'c1-venn' },
      suspects: [
        { id: 'pike', number: 1, name: 'Major Pike', plate: 'MAJOR PIKE', short: 'the Major', portrait: 'c1-pike',
          role: 'Retired soldier, the pub’s best darts player. Gout.', cleared: false, questioned: true, cracked: false },
        { id: 'thistle', number: 2, name: 'Rev. Thistle', plate: 'REV. THISTLE', short: 'the vicar', portrait: 'c1-vicar',
          role: 'The young vicar. Drinks only lemonade.', cleared: false, questioned: !briefing, cracked: false },
        { id: 'nell', number: 3, name: 'Nell Hartley', plate: 'NELL HARTLEY', short: 'Nell', portrait: 'c1-nell',
          role: 'The barmaid. Poured Venn’s port at 8.25.', cleared: !briefing, questioned: false, cracked: false },
        { id: 'freddie', number: 4, name: 'Freddie Venn', plate: 'FREDDIE VENN', short: 'Freddie', portrait: 'c1-freddie',
          role: 'Venn’s nephew. Charming, broke, plays darts with the Major.', cleared: false, questioned: !briefing, cracked: false }
      ].map(function (s) { if (briefing) s.questioned = false; return s; }),
      found: briefing ? [] : FOUND,
      statements: briefing ? [] : [
        { who: 'freddie', kind: 'stonewall', text: 'Uncle Silas? We weren’t close. Is there any more of this beer?' },
        { who: 'thistle', kind: 'slip', text: 'I stepped out to the bar for a moment during the raffle. Only a moment.' }
      ],
      notes: briefing ? [] : ['That clears Nell.', 'Poison, not a fall. So who went out to the shed?'],
      how: [{ id: 'port', label: 'Poisoned port' }, { id: 'steps', label: 'Pushed down the steps' },
            { id: 'bottle', label: 'A bottle to the head' }, { id: 'rope', label: 'The cellar rope' }],
      why: [{ id: 'inheritance', label: 'The inheritance' }, { id: 'blackmail', label: 'Blackmail' },
            { id: 'debts', label: 'Gambling debts' }, { id: 'love', label: 'Love' }],
      howRequired: false,
      ezra: { onThisLevel: true, used: false }
    };
  }

  // Two other phones at the table, and this one.
  var others = [{ who: 'freddie', how: 'port', why: 'inheritance' }, { who: 'thistle', how: 'port', why: 'blackmail' }];
  var mine = scenario === 'briefing' ? null : { who: 'freddie', how: 'port', why: null };

  function tally() {
    var t = { who: {}, how: {}, why: {}, voters: 0 };
    others.concat(mine ? [mine] : []).forEach(function (v) {
      if (!v.who && !v.how && !v.why) return;
      t.voters++;
      ['who', 'how', 'why'].forEach(function (f) { if (v[f]) t[f][v[f]] = (t[f][v[f]] || 0) + 1; });
    });
    return t;
  }

  function later(value, ms) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { if (value instanceof Error) reject(value); else resolve(value); }, ms == null ? 300 : ms);
    });
  }

  function ids(listOf) { return listOf.map(function (o) { return o.id; }); }

  // This phone's crosses and circles, once, so the Suspects page has both to show.
  try {
    var key = 'ezra-notebook:marks:MOCK-1:case01';
    if (scenario !== 'briefing' && window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, JSON.stringify({ pike: 'cross', freddie: 'circle' }));
    }
  } catch (e) { /* storage blocked: no seeded marks */ }

  window.PAY_CONFIG.notebookTransport = function (request) {
    reads++;
    if (scenario === 'bad') {
      return later({ status: 401, data: { error: 'altered', message: 'This code has been altered or was not issued by this venue.' } });
    }
    if (scenario === 'waiting' || (scenario === 'closed' && reads > 2)) {
      return later({ status: 404, data: { closed: true } });
    }
    if (scenario === 'offline' && reads > 1) {
      return later(new TypeError('Failed to fetch'), 800);
    }

    var s = state();
    if (request.method === 'POST') {
      var b = request.body || {};
      var ok = function (value, allowed) { return value === null || value === undefined || allowed.indexOf(value) >= 0; };
      if (!ok(b.who, ids(s.suspects)) || !ok(b.how, ids(s.how)) || !ok(b.why, ids(s.why))) {
        return later({ status: 400, data: { error: 'not_an_option', message: 'That is not one of the choices.' } });
      }
      mine = { who: b.who || null, how: b.how || null, why: b.why || null };
      window.lastVote = b;
      return later({ status: 200, data: { tally: tally() } });
    }
    return later({ status: 200, data: { state: s, tally: tally(), mine: mine } });
  };

  // Obvious on screen, so a mocked run is never mistaken for a real one.
  window.addEventListener('DOMContentLoaded', function () {
    var flag = document.createElement('div');
    flag.textContent = 'MOCK · ' + scenario;
    flag.style.cssText = 'position:fixed;top:0;right:0;z-index:99;background:#d08a2c;color:#1a1206;' +
      'font:600 9px/1 sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:4px 6px';
    document.body.appendChild(flag);
  });
})();
