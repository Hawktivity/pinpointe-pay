/* -----------------------------------------------------------------------------
 * Passkey (Face ID) helpers for the pay page and the ambassador page (25 Nov 2026).
 *
 * The same conversions register.html has inline: the backend sends WebAuthn options as
 * JSON with base64url strings, the browser wants ArrayBuffers, and the answer goes back
 * the other way. The calls go through PAY_CONFIG.passkeys when the local mock sets one,
 * so the screens can be walked on a laptop with no authenticator.
 * -------------------------------------------------------------------------- */
(function () {
  'use strict';

  function credentials() {
    var cfg = window.PAY_CONFIG || {};
    return cfg.passkeys || (window.navigator && navigator.credentials) || null;
  }

  /** A phone that can do Face ID, a fingerprint or a screen lock for this site. */
  function usable() {
    var cfg = window.PAY_CONFIG || {};
    if (cfg.passkeys) { return Promise.resolve(true); }
    var pkc = window.PublicKeyCredential;
    var c = credentials();
    if (!pkc || !c || !c.create || !c.get) { return Promise.resolve(false); }
    if (!pkc.isUserVerifyingPlatformAuthenticatorAvailable) { return Promise.resolve(true); }
    return pkc.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }

  function fromB64u(value) {
    var s = value.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) { s += '='; }
    var raw = atob(s);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) { bytes[i] = raw.charCodeAt(i); }
    return bytes.buffer;
  }
  function toB64u(buffer) {
    var bytes = new Uint8Array(buffer);
    var s = '';
    for (var i = 0; i < bytes.length; i++) { s += String.fromCharCode(bytes[i]); }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function creationOptions(json) {
    var o = Object.assign({}, json);
    o.challenge = fromB64u(json.challenge);
    o.user = Object.assign({}, json.user, { id: fromB64u(json.user.id) });
    o.excludeCredentials = (json.excludeCredentials || []).map(function (c) {
      return Object.assign({}, c, { id: fromB64u(c.id) });
    });
    return o;
  }
  function requestOptions(json) {
    var o = Object.assign({}, json);
    o.challenge = fromB64u(json.challenge);
    o.allowCredentials = (json.allowCredentials || []).map(function (c) {
      return Object.assign({}, c, { id: fromB64u(c.id) });
    });
    return o;
  }

  function credentialJson(cred) {
    var r = cred.response;
    var response = { clientDataJSON: toB64u(r.clientDataJSON) };
    if (r.attestationObject) {
      response.attestationObject = toB64u(r.attestationObject);
      if (r.getTransports) { try { response.transports = r.getTransports(); } catch (e) {} }
    } else {
      response.authenticatorData = toB64u(r.authenticatorData);
      response.signature = toB64u(r.signature);
      if (r.userHandle) { response.userHandle = toB64u(r.userHandle); }
    }
    return {
      id: cred.id,
      rawId: toB64u(cred.rawId),
      type: cred.type,
      response: response,
      clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      authenticatorAttachment: cred.authenticatorAttachment || undefined
    };
  }

  /** Face ID to prove who this is, with options fetched BEFORE the tap (Safari needs that). */
  function get(optionsJson) {
    return credentials().get({ publicKey: requestOptions(optionsJson) }).then(credentialJson);
  }

  /** Face ID to save a new passkey, likewise with options fetched before the tap. */
  function create(optionsJson) {
    return credentials().create({ publicKey: creationOptions(optionsJson) }).then(credentialJson);
  }

  window.HawkPasskey = { usable: usable, get: get, create: create };
})();
