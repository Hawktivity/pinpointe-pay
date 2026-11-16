/* -----------------------------------------------------------------------------
 * Which Supabase project this copy of the page talks to.
 *
 * Both values here are meant to be public. The anon key is a publishable key:
 * on its own it grants nothing, because every table the suite touches is behind
 * row-level security scoped to that suite's own auth user. The Edge Functions
 * below are useless without a payload signed by a venue's own key, and none of
 * them takes money: card payments happen on Stripe's own page.
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
    // Despite its name, the page only ever asks this one to `describe` a code: what it
    // costs, whether it is paid for, whether the board has picked it up. The unlock a
    // member of staff used to do with it was retired on 14 Nov 2026 and now answers 410.
    functionUrl: project.url ? project.url + '/functions/v1/unlock-session' : '',

    // Where register.html posts. Separate endpoint because it is a different act:
    // registering costs nothing, so it must not sit behind -- or anywhere near --
    // the ones that deal in payments.
    registerUrl: project.url ? project.url + '/functions/v1/register-player' : '',

    // Where "pay by card" posts. Its own endpoint: it starts a payment and unlocks
    // nothing itself -- the board starts when Stripe's webhook records the sale. Whether
    // the button appears at all is not decided here -- the describe response says
    // whether this code can be paid for.
    checkoutUrl: project.url ? project.url + '/functions/v1/create-checkout' : '',

    // Where "Have a voucher?" posts: a one-time code the pub handed out, instead of paying.
    // Its own endpoint, like the card one: it spends a code and unlocks the board. Whether
    // the box shows at all is asked of the same endpoint (action
    // 'available'): only for a new session at a venue that has unspent codes.
    voucherUrl: project.url ? project.url + '/functions/v1/redeem-voucher' : '',

    // Where story.html fetches a guest's night from. The link in the email carries the token
    // after the #, and this is the only place the page sends it.
    storyUrl: project.url ? project.url + '/functions/v1/get-story' : '',

    // The project itself, for pages that sign in rather than call one function: the staff
    // dashboard (dashboard/) signs Hawktivity people in with Google through Supabase Auth.
    supabaseUrl: project.url,

    anonKey: project.anonKey,
    environment: project === PROJECTS.prod ? 'prod' : 'dev'
  };

  // A local copy is driven from a fake so the screens can be walked through
  // without a Supabase project, Stripe or a real voucher. Deliberately gated on
  // the hostname: a deployed copy has no route to this code at all.
  if (isLocal && new URLSearchParams(window.location.search).has('mock')) {
    document.write('<script src="mock.js"><\/script>');
  }
})();
