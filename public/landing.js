// Deep Focus landing page: launch-list signup (Kit form, double opt-in) + light event hooks.
(function () {
  var KIT_URL = 'https://app.kit.com/forms/10195361/subscriptions';

  function track(name, props) {
    try { if (window.posthog && window.posthog.capture) window.posthog.capture(name, props || {}); } catch (e) {}
  }

  document.querySelectorAll('[data-track]').forEach(function (el) {
    el.addEventListener('click', function () { track('cta_click', { where: el.getAttribute('data-track') }); });
  });

  document.querySelectorAll('form[data-signup]').forEach(function (form) {
    var input = form.querySelector('input[type=email]');
    var button = form.querySelector('button');
    var msg = form.querySelector('.form-msg');
    var where = form.getAttribute('data-signup');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = 'Please enter a valid email address.';
        form.classList.add('err');
        input.focus();
        return;
      }
      form.classList.remove('err');
      button.disabled = true;
      button.textContent = 'Sending…';
      track('cta_click', { where: 'signup_' + where });

      var body = new FormData();
      body.append('email_address', email);
      fetch(KIT_URL, { method: 'POST', body: body, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === 'success') {
            done();
          } else if (data && data.status === 'quarantined' && data.url) {
            // Kit's bot check: finish the signup on Kit's own page.
            window.open(data.url, '_blank', 'noopener');
            done('One quick check opened in a new tab. Finish it, then look for our confirmation email.');
          } else {
            fail();
          }
        })
        .catch(fail);

      function done(text) {
        track('email_signup', { where: where });
        form.classList.add('ok');
        form.innerHTML = '<p class="thanks"><strong>Thanks! Check your inbox.</strong><br>' +
          (text || 'Tap the link in our email to confirm, and we\'ll write when Deep Focus launches.') + '</p>';
      }
      function fail() {
        button.disabled = false;
        button.textContent = 'Get notified at launch';
        form.classList.add('err');
        msg.textContent = 'That didn\'t go through. Please try again in a moment.';
      }
    });
  });
})();
