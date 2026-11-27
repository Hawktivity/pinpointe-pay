// Made-up data for story.html?demo=event on localhost only: one guest's page from a private
// event night (27 Nov 2026), where the board took a group photo after every game. Same shape
// as get-story's answer. Photos and clips are drawn here, so the demo needs no files.
// story.html?demo=event&selfie adds the end-of-night photo (the last game's players get it).
(function () {
  'use strict';

  var NAMES = ['Sam', 'Priya', 'Dan', 'Mo', 'Ellie', 'Ruth', 'Jordan', 'Kate', 'Ben', 'Alex', 'Tom', 'Ola', 'Jess', 'Lee'];
  var COLOURS = ['#3e5a7a', '#6b3f5c', '#3f6b52', '#7a5a3e', '#4a4a7a'];

  function picture(w, h, title, sub, colour) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, colour); grad.addColorStop(1, '#101015');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // A row of heads, so it reads as a group photo.
    for (var i = 0; i < 6; i++) {
      var x = w * (0.14 + i * 0.145), y = h * 0.52;
      g.fillStyle = 'rgba(240,240,242,.22)';
      g.beginPath(); g.arc(x, y, h * 0.09, 0, Math.PI * 2); g.fill();
      g.fillRect(x - h * 0.11, y + h * 0.11, h * 0.22, h * 0.3);
    }
    g.fillStyle = '#f0f0f2';
    g.font = 'bold ' + Math.round(h * 0.08) + 'px sans-serif';
    g.fillText(title, w * 0.05, h * 0.14);
    g.font = Math.round(h * 0.05) + 'px sans-serif';
    g.fillText(sub, w * 0.05, h * 0.22);
    return c.toDataURL('image/jpeg', 0.8);
  }

  /** A two-second clip drawn on a canvas and recorded, or null where the browser can't. */
  function recordClip(title, colour) {
    return new Promise(function (resolve) {
      try {
        var c = document.createElement('canvas');
        c.width = 270; c.height = 480;
        var g = c.getContext('2d');
        var stream = c.captureStream(15);
        var rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
        var parts = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
        rec.onstop = function () { resolve(parts.length ? URL.createObjectURL(new Blob(parts, { type: 'video/webm' })) : null); };
        var t = 0;
        // A timer, not requestAnimationFrame: a hidden preview pane runs no frames.
        var timer = setInterval(function () {
          g.fillStyle = colour; g.fillRect(0, 0, 270, 480);
          g.fillStyle = '#f0f0f2';
          g.beginPath(); g.arc(135, 220, 30 + (t % 15) * 3, 0, Math.PI * 2); g.fill();
          g.font = 'bold 22px sans-serif'; g.fillText(title, 20, 420);
          t++;
        }, 66);
        rec.start(250);
        setTimeout(function () { clearInterval(timer); rec.stop(); }, 2000);
      } catch (e) { resolve(null); }
    });
  }

  function stats(over) {
    var s = { darts: 0, points: 0, threeDartAverage: null, bestVisit: 0, oneEighties: 0, tons: 0, bulls: 0, trebles: 0,
      doubles: 0, favouriteNumber: null, games: 0, finished: 0, wins: 0, podiums: 0, spreadMm: null };
    Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
    return s;
  }

  // Five games on the night; Sam (p1) played g1, g3 and g5.
  var games = [
    { key: 'g1', name: 'Around the World', completed: true, durationMinutes: 14, lineup: ['p2', 'p1', 'p3', 'p4', 'p5', 'p6'], started: '2026-11-27T19:48:00Z' },
    { key: 'g2', name: '501', completed: true, durationMinutes: 18, lineup: ['p10', 'p11', 'p12', 'p13'], started: '2026-11-27T20:05:00Z' },
    { key: 'g3', name: 'Killshot Roulette', completed: true, durationMinutes: 11, lineup: ['p1', 'p7', 'p8', 'p9'], started: '2026-11-27T20:30:00Z' },
    { key: 'g4', name: 'Zero Hour', completed: true, durationMinutes: 16, lineup: ['p3', 'p4', 'p13', 'p14'], started: '2026-11-27T20:55:00Z' },
    { key: 'g5', name: 'Smart Arrows', completed: true, durationMinutes: 15, lineup: ['p10', 'p2', 'p11', 'p1', 'p12', 'p13', 'p4', 'p14'], started: '2026-11-27T21:22:00Z' }
  ];
  function ended(g) { return new Date(Date.parse(g.started) + g.durationMinutes * 60000).toISOString(); }

  var players = NAMES.map(function (n, i) {
    var key = 'p' + (i + 1);
    var mine = games.filter(function (g) { return g.lineup.indexOf(key) >= 0; });
    return {
      key: key, name: n, isYou: i === 0, isMinor: false,
      stats: stats(i === 0
        ? { darts: 141, points: 2130, threeDartAverage: 45.3, bestVisit: 140, tons: 2, bulls: 3, trebles: 9, games: 3, finished: 3, wins: 1, podiums: 2,
            favouriteNumber: { label: '20', hits: 31 } }
        : { darts: 60, games: mine.length, finished: mine.length }),
      title: { key: 'steady', name: 'The Steady Hand', why: 'Made-up title' },
      achievements: [],
      games: mine.map(function (g) { return { game: g.key, rank: g.lineup.indexOf(key) + 1, of: g.lineup.length }; }),
      rival: null, heat: [], highlights: [], bestMoment: null
    };
  });

  var highlights = [
    { id: 'h1', player: 'p1', game: 'g3', gameName: 'Killshot Roulette', type: 'win', label: 'The winning dart', achievement: null, video: null,
      thumbnail: picture(270, 480, 'Winning dart', 'Killshot Roulette', '#6b3f5c') },
    { id: 'h2', player: 'p1', game: 'g1', gameName: 'Around the World', type: 'ton', label: 'Treble 20', achievement: null, video: null,
      thumbnail: picture(270, 480, 'Treble 20', 'Around the World', '#3e5a7a') }
  ];
  players[0].highlights = ['h1', 'h2'];
  players[0].bestMoment = 'h1';

  var mineGames = ['g1', 'g3', 'g5'];
  var demo = {
    venue: 'Metropolis Epsom',
    reviewUrl: null,
    startedAt: '2026-11-27T19:30:00Z',
    endedAt: '2026-11-27T22:30:00Z',
    expiresAt: '2026-12-27T22:30:00Z',
    you: 'p1',
    players: players,
    games: games.map(function (g) {
      return { key: g.key, name: g.name, completed: g.completed, durationMinutes: g.durationMinutes,
        results: g.lineup.map(function (p, i) { return { player: p, rank: i + 1, team: null }; }),
        winners: [g.lineup[0]] };
    }),
    leaderboard: [],
    highlights: highlights,
    selfie: null,
    groupPhotos: games.filter(function (g) { return mineGames.indexOf(g.key) >= 0; }).map(function (g, i) {
      return { url: picture(1200, 900, 'Group photo · ' + g.name, 'After game ' + (i + 1), COLOURS[i % COLOURS.length]),
        game: g.key, gameName: g.name, boardGameId: 900 + i, takenAt: ended(g) };
    }),
    audience: 'guest'
  };
  if (new URLSearchParams(window.location.search).has('selfie')) {
    demo.selfie = picture(1200, 900, 'End of the night', 'The last group', '#7a5a3e');
  }

  window.STORY_DEMO = demo;
  window.STORY_DEMO_READY = Promise.all(highlights.map(function (h, i) {
    return recordClip(h.label, COLOURS[(i + 1) % COLOURS.length]).then(function (url) { h.video = url; });
  }));
})();
