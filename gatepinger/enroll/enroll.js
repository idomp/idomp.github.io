// GatePinger enrollment hand-off + link builder. Runs entirely in the browser:
// the invite lives in the URL fragment, which is never sent to this web server.
(function () {
  'use strict';

  var PACKAGE = 'io.github.idomp.gatepinger';
  var SCHEME = 'gatekeeper';
  var PAGE = 'https://idomp.github.io/gatepinger/enroll';
  var CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

  function $(id) { return document.getElementById(id); }

  // Same rules as the app: https, a host, no credentials, no query/fragment.
  function normServer(s) {
    s = (s || '').trim();
    if (!s) return null;
    if (s.indexOf('://') < 0) s = 'https://' + s;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password || u.search || u.hash) return null;
    return u.protocol + '//' + u.host + u.pathname.replace(/\/+$/, '');
  }

  function normProbe(s) {
    s = (s || '').trim();
    if (!s) return '';
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password || u.hash) return null;
    // The serialized form (spaces escaped, IDN as punycode) is what the app's parser accepts.
    return u.href;
  }

  function query(p) {
    var q = 'server=' + encodeURIComponent(p.server) + '&code=' + encodeURIComponent(p.code);
    if (p.probe) q += '&probe=' + encodeURIComponent(p.probe);
    return q;
  }

  function schemeLink(p) { return SCHEME + '://enroll?' + query(p); }
  function httpsLink(p) { return PAGE + '#' + query(p); }

  function parseFragment() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return null;
    var out = {};
    var parts = h.split('&');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var kv = parts[i].split('=');
      var k, v;
      try {
        k = decodeURIComponent(kv[0]);
        v = decodeURIComponent(kv.slice(1).join('='));
      } catch (e) { return { error: 'The link is malformed.' }; }
      if (Object.prototype.hasOwnProperty.call(out, k) && out[k] !== v) {
        return { error: 'The link repeats "' + k + '" with different values.' };
      }
      out[k] = v;
    }
    var server = normServer(out.server);
    if (!server) return { error: 'The link has no valid https server address.' };
    if (!CODE_RE.test(out.code || '')) return { error: 'The link has no valid invite code.' };
    var probe = normProbe(out.probe);
    if (probe === null) return { error: 'The link\'s check URL is not a valid https URL.' };
    return { server: server, code: out.code, probe: probe };
  }

  function copy(text, done) {
    var ok = function () { if (done) { done.hidden = false; setTimeout(function () { done.hidden = true; }, 2000); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () {});
    }
  }

  function showInvite(p) {
    var host = new URL(p.server).host;
    $('inv-host').textContent = host;
    $('inv-server').textContent = p.server;
    var isAndroid = /Android/i.test(navigator.userAgent);
    var open = $('open-app');
    if (isAndroid) {
      // Chrome: launch the app if installed, else come back here (invite kept, client-side only).
      open.href = 'intent://enroll?' + query(p) + '#Intent;scheme=' + SCHEME + ';package=' + PACKAGE +
        ';S.browser_fallback_url=' + encodeURIComponent(PAGE + '?noapp=1#' + query(p)) + ';end';
    } else {
      open.href = schemeLink(p);
    }
    $('plain-link').href = schemeLink(p);
    $('copy-invite').addEventListener('click', function () { copy(httpsLink(p), $('copy-invite-done')); });
    if (/[?&]noapp=1/.test(location.search)) $('noapp').hidden = false;
    $('invite').hidden = false;
    // The fragment stays: it never reaches the server, and a refresh keeps the invite.
  }

  function setupBuilder() {
    var inputs = ['b-server', 'b-code', 'b-probe'];
    function update() {
      var err = $('b-error');
      var rawServer = $('b-server').value, rawCode = $('b-code').value.trim();
      if (!rawServer.trim() && !rawCode) { err.hidden = true; $('b-out').hidden = true; return; }
      var server = normServer(rawServer);
      var probe = normProbe($('b-probe').value);
      var msg = !server ? 'Server must be an https:// address.'
        : !CODE_RE.test(rawCode) ? 'Invite code: letters, digits, - and _ only.'
        : probe === null ? 'Access check URL must be an https:// address.' : '';
      err.textContent = msg;
      err.hidden = !msg;
      if (msg) { $('b-out').hidden = true; return; }
      var p = { server: server, code: rawCode, probe: probe };
      $('b-scheme').value = schemeLink(p);
      $('b-https').value = httpsLink(p);
      $('b-out').hidden = false;
    }
    inputs.forEach(function (id) { $(id).addEventListener('input', update); });
    var buttons = document.querySelectorAll('.copy');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        var t = $(ev.target.getAttribute('data-target'));
        t.select();
        copy(t.value, null);
      });
    }
    $('builder').hidden = false;
  }

  var p = parseFragment();
  if (p && p.error) {
    $('bad-why').textContent = p.error;
    $('bad').hidden = false;
  } else if (p) {
    showInvite(p);
  } else {
    setupBuilder();
  }
})();
