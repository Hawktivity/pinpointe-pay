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
    // The production project. Named explicitly rather than defaulted to: a real venue
    // silently talking to the dev project would take money against the wrong ledger.
    prod: {
      url: 'https://qtkldntrchsvgizwojvv.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0a2xkbnRyY2hzdmdpendvanZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjE0MDIsImV4cCI6MjEwNDU5NzQwMn0.oPRMFuZ21TKCggAQWPYitTMSMMLVm6fCShi3l6Oc2Cg'
    }
  };

  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' ||
                host === '[::1]' || /\.local$/.test(host);

  // pay.hawktivity.com is the live domain. Everything else -- the github.io copy
  // the dev boards use, a preview, a branch deploy -- is treated as dev.
  var project = host === 'pay.hawktivity.com' ? PROJECTS.prod : PROJECTS.dev;

  window.PAY_CONFIG = {
    functionUrl: project.url ? project.url + '/functions/v1/unlock-session' : '',

    // Where register.html posts. Separate endpoint because it is a different act:
    // registering costs nothing and needs no staff password, so it must not sit
    // behind -- or anywhere near -- the one that takes money.
    registerUrl: project.url ? project.url + '/functions/v1/register-player' : '',

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
