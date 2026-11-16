/* Feedback form. With a service address in <meta name="feedback-endpoint"> it posts
   the message there (it becomes a GitHub issue); without one it opens an email.
   The Mac app links here as feedback.html?from=app&v=<version>&os=<macOS>. */
(function () {
  var ADDRESS = 'hello@getdeepfocus.com';
  var form = document.getElementById('feedback');
  if (!form) return;
  var endpoint = (document.querySelector('meta[name="feedback-endpoint"]') || {}).content || '';
  var status = document.getElementById('status');
  var send = document.getElementById('send');
  var q = new URLSearchParams(location.search);
  var VERSION = /^[0-9][0-9A-Za-z.+-]{0,23}$/, MACOS = /^[0-9]{1,2}(\.[0-9]{1,3}){0,2}$/;
  var v = VERSION.test(q.get('v') || '') ? q.get('v') : '';
  var os = MACOS.test(q.get('os') || '') ? q.get('os') : '';
  var fromApp = q.get('from') === 'app';

  function say(text, kind) {
    status.textContent = text; status.hidden = !text;
    status.className = 'notice' + (kind ? ' ' + kind : '');
  }
  var messages = {
    sent: ['Thanks, we got it.', 'ok'],
    busy: ['Too many messages from here just now. Please try again in a few minutes.', 'warn'],
    invalid: ['Please write at least a few words, and check the email address.', 'warn'],
    error: ['Could not send right now. Please email ' + ADDRESS + '.', 'warn']
  };
  if (messages[q.get('status')]) say.apply(null, messages[q.get('status')]);

  if (v || os) {
    var parts = [];
    if (v) parts.push('Deep Focus ' + v);
    if (os) parts.push('macOS ' + os);
    document.getElementById('versions').textContent = parts.join(' and ');
    document.getElementById('include').hidden = false;
  }
  if (endpoint) form.action = endpoint;
  else {
    send.textContent = 'Send by email';
    document.getElementById('how').textContent =
      'This opens your email app with your message filled in, addressed to ' + ADDRESS + '. Please leave out journal contents, passwords and card details.';
  }

  function data() {
    var include = !document.getElementById('include').hidden && document.getElementById('include-versions').checked;
    return {
      message: form.message.value.trim(),
      email: form.email.value.trim(),
      website: form.website.value,
      source: fromApp ? 'app' : 'site',
      app_version: include ? v : '',
      macos: include ? os : ''
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = data();
    if (d.message.length < 3) { say(messages.invalid[0], 'warn'); form.message.focus(); return; }
    if (d.email && !form.email.checkValidity()) { say(messages.invalid[0], 'warn'); form.email.focus(); return; }
    if (!endpoint) {
      var extra = [d.app_version && 'Deep Focus ' + d.app_version, d.macos && 'macOS ' + d.macos].filter(Boolean).join(', ');
      location.href = 'mailto:' + ADDRESS + '?subject=' + encodeURIComponent('Deep Focus feedback') +
        '&body=' + encodeURIComponent(d.message + (extra ? '\n\n(' + extra + ')' : ''));
      return;
    }
    send.disabled = true; say('Sending…');
    fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) {
        if (r.ok) {
          form.reset(); say.apply(null, messages.sent);
          if (window.posthog) posthog.capture('feedback_sent', { source: d.source });
        } else say.apply(null, messages[r.status === 429 ? 'busy' : r.status === 400 ? 'invalid' : 'error']);
      })
      .catch(function () { say.apply(null, messages.error); })
      .then(function () { send.disabled = false; });
  });
})();
