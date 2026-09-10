/* -----------------------------------------------------------------------------
 * Which Supabase project this copy of the page talks to.
 *
 * Both values here are meant to be public. The anon key is a publishable key:
 * on its own it grants nothing, because every table the suite touches is behind
 * row-level security scoped to that suite's own auth user, and the two tables
 * that matter here -- staff_credentials and unlock_attempts -- have no policy at
 * all, so nothing outside the unlock Edge Function can read them. The endpoint
 * itself is useless without a payload signed by a venue's own key and a real
 * staff password.
 *
 * Chosen by hostname rather than baked in, so the same commit can serve the
 * production domain and a preview without a build step.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var PROJECTS = {
    dev: {
      url: 'https://kdwwhftbakaozgdzspeq.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkd3doZnRiYWthb3pnZHpzcGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjEzNzcsImV4cCI6MjEwNDU5NzM3N30.D5SzNLJUCO1RxRL4NNauPwl1dj_AJH123dowpmZfM_I'
    },
    // Filled in when pinpointe-prod-uk has the function deployed. Left explicit
    // rather than defaulted to dev: a real venue silently talking to the dev
    // project would take money against the wrong ledger.
    prod: {
      url: '',
      anonKey: ''
    }
  };

  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' ||
                host === '[::1]' || /\.local$/.test(host);

  // pay.pinpointe.uk is the live domain. Everything else -- the github.io
  // fallback URL, a preview, a branch deploy -- is treated as dev.
  var project = host === 'pay.pinpointe.uk' ? PROJECTS.prod : PROJECTS.dev;

  window.PINPOINTE_CONFIG = {
    functionUrl: project.url ? project.url + '/functions/v1/unlock-session' : '',
    anonKey: project.anonKey,
    environment: project === PROJECTS.prod ? 'prod' : 'dev'
  };

  // A local copy is driven from a fake so the five screens can be walked through
  // without a Supabase project or a real staff password. Deliberately gated on
  // the hostname: a deployed copy has no route to this code at all.
  if (isLocal && new URLSearchParams(window.location.search).has('mock')) {
    document.write('<script src="mock.js"><\/script>');
  }
})();
