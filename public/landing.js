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
        button.textContent = 'Get notified';
        form.classList.add('err');
        msg.textContent = 'That didn\'t go through. Please try again in a moment.';
      }
    });
  });
})();

// Hero: a small recreation of the app. Walls close around the document window,
// hold, open, and the session line shows. Values from WallsWindow.swift and FocusStats.swift.
(function () {
  var stage = document.getElementById('stage');
  if (!stage || !stage.animate) return;
  var doc = document.getElementById('doc');
  var walls = {};
  stage.querySelectorAll('.wall').forEach(function (w) { walls[w.getAttribute('data-side')] = { el: w, edge: w.firstElementChild }; });
  var toasts = stage.querySelectorAll('.toast');
  var bubble = stage.querySelector('.bubble');
  var typed = stage.querySelector('.typing span');
  var sentence = typed.textContent;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var closed = false, timers = [], running = false, visible = false;

  function geo() {
    var W = stage.clientWidth, H = stage.clientHeight, F = W * 0.13;
    var h = { l: doc.offsetLeft, t: doc.offsetTop, r: doc.offsetLeft + doc.offsetWidth, b: doc.offsetTop + doc.offsetHeight };
    var s = walls;
    set(s.top.el, 0, 0, W, h.t); set(s.bottom.el, 0, h.b, W, H - h.b);
    set(s.left.el, 0, 0, h.l, H); set(s.right.el, h.r, 0, W - h.r, H);
    return {
      top: 'translateY(' + -(h.t + F + 2) + 'px)', bottom: 'translateY(' + (H - h.b + F + 2) + 'px)',
      left: 'translateX(' + -(h.l + F + 2) + 'px)', right: 'translateX(' + (W - h.r + F + 2) + 'px)'
    };
  }
  function set(el, x, y, w, h) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }
  function scale(side, v) { return side === 'top' || side === 'bottom' ? 'scaleY(' + v + ')' : 'scaleX(' + v + ')'; }

  function place() {
    var open = geo();
    Object.keys(walls).forEach(function (k) {
      walls[k].el.style.transform = closed ? 'none' : open[k];
      walls[k].edge.style.transform = scale(k, 0);
    });
  }

  function close() {
    var open = geo(); closed = true;
    Object.keys(walls).forEach(function (k) {
      var w = walls[k];
      w.el.style.transform = 'none';
      w.edge.style.transform = scale(k, 0);
      w.el.animate([{ transform: open[k] }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.3,.02,.12,1)' });
      w.edge.animate([{ transform: scale(k, 1) }, { transform: scale(k, 1), offset: .3 }, { transform: scale(k, 0) }], { duration: 1350, easing: 'cubic-bezier(.5,0,.14,1)' });
    });
  }
  function open() {
    var o = geo(); closed = false;
    Object.keys(walls).forEach(function (k) {
      walls[k].el.style.transform = o[k];
      walls[k].el.animate([{ transform: 'none' }, { transform: o[k] }], { duration: 850, easing: 'cubic-bezier(.6,0,.2,1)' });
    });
  }

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function type(from, to) {
    var n = sentence.length, step = (to - from) / n;
    for (var i = 1; i <= n; i++) (function (i) { at(from + i * step, function () { typed.textContent = sentence.slice(0, i); }); })(i);
  }

  function cycle() {
    timers.forEach(clearTimeout); timers = [];
    typed.textContent = '';
    toasts.forEach(function (t) { t.classList.remove('in'); });
    bubble.classList.remove('in');
    at(500, function () { toasts[0].classList.add('in'); });
    at(1300, function () { toasts[1].classList.add('in'); });
    at(2100, function () { toasts[2].classList.add('in'); });
    at(3300, close);
    at(4300, function () { toasts.forEach(function (t) { t.classList.remove('in'); }); });
    type(4400, 7600);
    at(8800, open);
    at(9800, function () { bubble.classList.add('in'); });
    at(12600, function () { bubble.classList.remove('in'); });
    at(13600, function () { if (visible && !document.hidden) cycle(); else running = false; });
  }
  function start() { if (!running && visible && !document.hidden) { running = true; cycle(); } }

  if (reduce) { closed = true; place(); return; }
  place();
  if (window.ResizeObserver) new ResizeObserver(place).observe(stage);
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; start(); }, { threshold: 0.25 }).observe(stage);
  document.addEventListener('visibilitychange', start);
})();
