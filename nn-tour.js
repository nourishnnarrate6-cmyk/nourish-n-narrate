/* ===================================================================
   NOURISH N NARRATE — FIRST-VISIT GUIDED TOUR
   Spotlights key elements with step-by-step instructions the first
   time a visitor opens a page. Runs once per page (localStorage),
   can be skipped any time, fully keyboard accessible.

   Restart manually from the console: NNTour.restart()
=================================================================== */
(function () {
  'use strict';

  /* ---------------- Steps per page ---------------- */
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (page === '') page = 'index.html';

  var STEPS = {
    'index.html': [
      { sel: '.nav-logo', title: '👋 Welcome to Nourish N Narrate!', text: 'Quick tour? We turn your favorite comfort foods into healthier versions — let us show you around in 20 seconds.' },
      { sel: '.hero-actions', title: '🌿 Start here', text: 'Explore our healthy recipe collection, or scroll down to learn what we are all about.' },
      { sel: '#diet-selector', title: '🍽️ Browse recipes', text: 'Pick Vegetarian or Non-Vegetarian to see our recipes. Every card has a "+ Track" button that logs the meal to your daily tracker.' },
      { sel: '.calc-banner', title: '🧮 Your personal plan', text: 'The Nutrition Calculator builds a daily calorie and macro plan just for you — and saves it to your free account.' },
      { sel: '#theme-toggle', title: '🌙 One more thing', text: 'Prefer dark mode? Toggle it here. Enjoy the site!' },
    ],
    'calculator.html': [
      { sel: '.calc-form-card', title: '📝 Tell us about yourself', text: 'Enter your birthday, height, weight, activity level and goal. Height and weight work in both metric and imperial.' },
      { sel: '.btn-calculate', title: '🧮 Get your plan', text: 'One click calculates your daily calories, protein, carbs, fat, water and fiber — using real nutrition science (Mifflin-St Jeor + BMI).' },
      { sel: '#auth-link', title: '🔐 Save it forever', text: 'Log in (or create a free account) and every plan saves automatically — plus you unlock the daily tracker.' },
    ],
    'tracker.html': [
      { sel: '.date-nav', title: '📅 Your day at a glance', text: 'Use the arrows to hop between days, or click the date to open a calendar and jump anywhere.' },
      { sel: '.summary-card', title: '🎯 Calorie balance', text: 'The ring shows how much of your daily budget is left. Log water and see your weekly trend right below.' },
      { sel: '#btn-scan', title: '📷 Scan packaged food', text: 'Point your camera at any barcode and the calories fill in automatically from a global food database.' },
      { sel: '.entry-forms', title: '📝 Log meals & workouts', text: 'Type what you ate or did. Not sure of the calories? Both forms have an "Estimate it for me" helper.' },
      { sel: '.wk-open', title: '🥗 Your meal plans', text: 'A fresh plan every day, tailored to your goal. Tap "Full Week" to see all 7 days ahead.' },
      { sel: '.weight-card', title: '⚖️ Morning habit', text: 'Weigh in each morning before breakfast — the trend line shows your real progress over time.' },
    ],
  };

  var steps = STEPS[page];
  if (!steps) return;
  var KEY = 'nnTour-' + page;

  /* ---------------- Styles (self-contained) ---------------- */
  var css = ''
    + '.nnt-hole{position:fixed;z-index:1200;border-radius:16px;pointer-events:none;'
    + 'box-shadow:0 0 0 9999px rgba(10,18,30,.62),0 0 0 3px rgba(52,211,153,.9),0 0 24px rgba(52,211,153,.45);'
    + 'transition:all .45s cubic-bezier(.22,1,.36,1);}'
    + '.nnt-tip{position:fixed;z-index:1201;width:min(330px,calc(100vw - 2rem));'
    + 'background:var(--surface,#fff);border:1px solid var(--border,rgba(15,23,42,.1));border-radius:18px;'
    + 'box-shadow:0 24px 60px rgba(10,18,30,.35);padding:1.15rem 1.25rem 1rem;'
    + 'font-family:Inter,-apple-system,sans-serif;transition:all .45s cubic-bezier(.22,1,.36,1);}'
    + '.nnt-tip h4{font-family:"Playfair Display",Georgia,serif;font-size:1.06rem;color:var(--ink,#0f172a);margin:0 0 .35rem;}'
    + '.nnt-tip p{font-size:.87rem;line-height:1.55;color:var(--text-muted,#64748b);margin:0 0 .9rem;}'
    + '.nnt-row{display:flex;align-items:center;gap:.5rem;}'
    + '.nnt-dots{font-size:.72rem;font-weight:600;color:var(--text-muted,#64748b);margin-right:auto;}'
    + '.nnt-btn{font-family:inherit;font-size:.8rem;font-weight:600;border-radius:999px;cursor:pointer;'
    + 'padding:.42rem 1rem;transition:transform .2s ease,opacity .2s ease;}'
    + '.nnt-btn:hover{transform:translateY(-1px);}'
    + '.nnt-next{color:#fff;border:none;background:linear-gradient(135deg,#059669,#047857);}'
    + '.nnt-back{color:var(--text-muted,#64748b);background:var(--surface-2,#f4f8f6);border:1px solid var(--border,rgba(15,23,42,.1));}'
    + '.nnt-skip{position:absolute;top:.55rem;right:.7rem;background:none;border:none;font-size:.72rem;'
    + 'color:var(--text-muted,#94a3b8);cursor:pointer;font-family:inherit;text-decoration:underline;padding:.2rem;}'
    + '@media (prefers-reduced-motion: reduce){.nnt-hole,.nnt-tip{transition:none;}}';

  var hole, tip, current = 0, active = false, raf = null;

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    hole = document.createElement('div');
    hole.className = 'nnt-hole';
    hole.setAttribute('aria-hidden', 'true');

    tip = document.createElement('div');
    tip.className = 'nnt-tip';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-live', 'polite');
    tip.innerHTML =
      '<button class="nnt-skip" type="button">Skip tour ✕</button>' +
      '<h4 id="nnt-title"></h4><p id="nnt-text"></p>' +
      '<div class="nnt-row"><span class="nnt-dots" id="nnt-dots"></span>' +
      '<button class="nnt-btn nnt-back" type="button" id="nnt-back">← Back</button>' +
      '<button class="nnt-btn nnt-next" type="button" id="nnt-next">Next →</button></div>';

    document.body.appendChild(hole);
    document.body.appendChild(tip);

    tip.querySelector('.nnt-skip').addEventListener('click', end);
    tip.querySelector('#nnt-back').addEventListener('click', function () { go(current - 1); });
    tip.querySelector('#nnt-next').addEventListener('click', function () {
      if (current >= steps.length - 1) end(); else go(current + 1);
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', schedulePlace);
    window.addEventListener('scroll', schedulePlace, { passive: true });
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); if (current >= steps.length - 1) end(); else go(current + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
  }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0) && el.offsetParent !== null;
  }

  function target() {
    return document.querySelector(steps[current].sel);
  }

  function place() {
    var el = target();
    if (!el) return;
    var r = el.getBoundingClientRect();
    var pad = 8;
    hole.style.left = (r.left - pad) + 'px';
    hole.style.top = (r.top - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px';
    hole.style.height = (r.height + pad * 2) + 'px';

    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var top = r.bottom + 16;
    if (top + th > vh - 12) top = r.top - th - 16;      // flip above
    if (top < 12) top = Math.max(12, vh / 2 - th / 2);  // fallback: center
    var left = r.left + r.width / 2 - tw / 2;
    left = Math.min(Math.max(12, left), vw - tw - 12);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function schedulePlace() {
    if (!active) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  }

  function go(i) {
    if (i < 0) i = 0;
    // Skip over steps whose element is missing/hidden
    while (i < steps.length && !visible(document.querySelector(steps[i].sel))) i++;
    if (i >= steps.length) { end(); return; }
    current = i;

    var s = steps[current];
    tip.querySelector('#nnt-title').textContent = s.title;
    tip.querySelector('#nnt-text').textContent = s.text;
    tip.querySelector('#nnt-dots').textContent = (current + 1) + ' of ' + steps.length;
    tip.querySelector('#nnt-back').style.visibility = current === 0 ? 'hidden' : 'visible';
    tip.querySelector('#nnt-next').textContent = current >= steps.length - 1 ? 'Finish ✓' : 'Next →';

    var el = target();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(place, 420);
    setTimeout(place, 800); // settle after smooth scroll
  }

  function end() {
    active = false;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    if (hole) hole.remove();
    if (tip) tip.remove();
    document.removeEventListener('keydown', onKey);
  }

  function start() {
    // Only run if at least two steps have visible targets
    var count = 0;
    for (var i = 0; i < steps.length; i++) {
      if (visible(document.querySelector(steps[i].sel))) count++;
    }
    if (count < 2) return;
    build();
    active = true;
    go(0);
  }

  window.NNTour = {
    restart: function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); },
  };

  /* Only for genuine newcomers:
     1. Never if this device has already seen/skipped the tour (localStorage).
     2. Never if the visitor is logged in — an account means they already
        know the site, so we quietly mark the tour as done for them. */
  function maybeStart() {
    if (window.NNAuth && NNAuth.getSession) {
      NNAuth.onReady(function () {
        NNAuth.getSession().then(function (session) {
          if (session) {
            try { localStorage.setItem(KEY, '1'); } catch (e) {}
            return; // logged in — no tutorial
          }
          start();
        }).catch(function () { start(); });
      });
    } else {
      start();
    }
  }

  try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
  if (document.readyState === 'complete') setTimeout(maybeStart, 1500);
  else window.addEventListener('load', function () { setTimeout(maybeStart, 1500); });
})();
