/* -----------------------------------------------------------------------------
 * Made-up ambassadors for walking through the ambassadors page without Google or a
 * database. Loaded only on a local copy opened with ?mock (config.js gates it on the
 * hostname), never on a deployed one. Nobody here is real.
 *
 * &as=outsider: an account that may not manage ambassadors.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var now = Date.now();
  function ago(days) { return new Date(now - days * 864e5).toISOString(); }

  var people = [
    { id: 'a1', email: 'jess.example@example.com', firstName: 'Jess', lastName: 'Example', status: 'active',
      invitedAt: ago(9), invitedBy: 'richard@hawktivity.com', inviteExpiresAt: null, invitesSent: 1,
      enrolledAt: ago(8), endedAt: null, endedBy: null, note: 'Uni darts society', isTest: false,
      coveredToday: true, covers: 6, coveredMinor: 2750, lastCoverAt: ago(0) },
    { id: 'a2', email: 'sam.example@example.com', firstName: 'Sam', lastName: null, status: 'invited',
      invitedAt: ago(1), invitedBy: 'richard@hawktivity.com', inviteExpiresAt: new Date(now + 13 * 864e5).toISOString(),
      invitesSent: 1, enrolledAt: null, endedAt: null, endedBy: null, note: null, isTest: false,
      coveredToday: false, covers: 0, coveredMinor: 0, lastCoverAt: null },
    { id: 'a3', email: 'old.example@example.com', firstName: 'Kit', lastName: 'Former', status: 'ended',
      invitedAt: ago(40), invitedBy: 'richard@hawktivity.com', inviteExpiresAt: null, invitesSent: 1,
      enrolledAt: ago(39), endedAt: ago(5), endedBy: 'richard@hawktivity.com', note: null, isTest: false,
      coveredToday: false, covers: 3, coveredMinor: 1500, lastCoverAt: ago(12) }
  ];
  var next = 4;

  window.AMBASSADORS_MOCK = {
    email: params.get('as') === 'outsider' ? 'someone@gmail.com' : 'richard@hawktivity.com',
    call: function (name, args) {
      if (params.get('as') === 'outsider') return { error: { code: '42501', message: 'not allowed' } };
      if (name === 'dashboard_ambassadors') return { data: JSON.parse(JSON.stringify(people)) };
      if (name === 'dashboard_end_ambassador') {
        people.forEach(function (p) { if (p.id === args.p_id) { p.status = 'ended'; p.endedAt = new Date().toISOString(); p.endedBy = 'richard@hawktivity.com'; } });
        return { data: { ok: true } };
      }
      return { error: { message: 'unknown rpc ' + name } };
    },
    invoke: function (body) {
      if (body.action === 'admin_invite') {
        var existing = people.filter(function (p) { return p.email === body.email.toLowerCase() && p.status !== 'ended'; })[0];
        if (!existing) {
          people.unshift({ id: 'a' + next++, email: body.email.toLowerCase(), firstName: body.firstName || null, lastName: null,
            status: 'invited', invitedAt: new Date().toISOString(), invitedBy: 'richard@hawktivity.com',
            inviteExpiresAt: new Date(now + 14 * 864e5).toISOString(), invitesSent: 1, enrolledAt: null,
            endedAt: null, endedBy: null, note: body.note || null, isTest: false, coveredToday: false,
            covers: 0, coveredMinor: 0, lastCoverAt: null });
        }
        return { data: { ok: true, id: 'x', created: !existing, enrolled: false, sent: 'dev',
          devLink: 'http://localhost:8916/ambassador.html?mock&i=mock-invite-token-0000000000' } };
      }
      if (body.action === 'admin_resend') {
        return { data: { ok: true, sent: 'sent' } };
      }
      return { data: { ok: false, message: 'Something went wrong. Try again.' } };
    }
  };
})();
