/* ===================================================================
   NOURISH N NARRATE — "ADD TO HOME SCREEN" NUDGE

   A slide-up bar that appears ONLY after the user has done something
   that shows they intend to come back — saved a nutrition plan, or
   logged a meal. Asking at that moment converts far better than a
   banner on arrival, and it never interrupts someone who is just
   browsing recipes.

   Rules it enforces for itself:
     • Never shown inside the installed app.
     • Never shown twice in one page view.
     • Dismissing snoozes it for 7 days.
     • Gives up entirely after MAX_ASKS refusals — if someone has said
       no three times, they mean it.

   On Chrome/Edge the button fires the real one-tap install prompt.
   On iOS, where Apple provides no such API, it opens install.html
   with the Share → Add to Home Screen walkthrough.

   Usage — load the script, then at a high-intent moment:
       NNInstall.nudge('saved-plan');
=================================================================== */
(function (w, d) {
  'use strict';

  var STORE_KEY = 'nnInstallNudge';
  var SNOOZE_DAYS = 7;
  var MAX_ASKS = 3;
  var SHOW_DELAY_MS = 1200; // let the user see their result land first

  var shownThisPage = false;
  var deferredPrompt = null;
  var barEl = null;

  /* ---------- state ---------- */

  function readState() {
    try {
      var raw = w.localStorage.getItem(STORE_KEY);
      if (!raw) return { asks: 0, snoozedUntil: 0, installed: false };
      var s = JSON.parse(raw);
      return {
        asks: Number(s.asks) || 0,
        snoozedUntil: Number(s.snoozedUntil) || 0,
        installed: !!s.installed,
      };
    } catch (e) {
      return { asks: 0, snoozedUntil: 0, installed: false };
    }
  }

  function writeState(s) {
    try { w.localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  function isStandalone() {
    return (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) ||
           w.navigator.standalone === true;
  }

  function isIOS() {
    var ua = w.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
           (w.navigator.platform === 'MacIntel' && w.navigator.maxTouchPoints > 1);
  }

  function canAsk() {
    if (shownThisPage) return false;
    if (isStandalone()) return false;          // already using the app
    var s = readState();
    if (s.installed) return false;             // installed at some point
    if (s.asks >= MAX_ASKS) return false;      // they've said no enough times
    if (Date.now() < s.snoozedUntil) return false;
    return true;
  }

  /* ---------- styles ---------- */

  function injectStyles() {
    if (d.getElementById('nn-install-styles')) return;
    var css =
      '.nn-install-bar{' +
        'position:fixed;left:0;right:0;bottom:0;z-index:1200;' +
        'display:flex;align-items:center;gap:.9rem;' +
        'padding:.9rem 1rem calc(.9rem + env(safe-area-inset-bottom,0px));' +
        'background:var(--surface,#fff);' +
        'border-top:1px solid var(--border,rgba(0,0,0,.1));' +
        'box-shadow:0 -10px 40px rgba(10,18,30,.16);' +
        'transform:translateY(110%);transition:transform .45s cubic-bezier(.22,1,.36,1);' +
      '}' +
      '.nn-install-bar.open{transform:translateY(0);}' +
      '.nn-install-bar img{width:44px;height:44px;border-radius:11px;flex:0 0 auto;}' +
      '.nn-install-copy{flex:1;min-width:0;}' +
      '.nn-install-copy strong{display:block;font-size:.95rem;color:var(--ink,#0f172a);margin-bottom:.1rem;}' +
      '.nn-install-copy span{display:block;font-size:.82rem;color:var(--text-muted,#64748b);line-height:1.45;}' +
      '.nn-install-go{' +
        'flex:0 0 auto;padding:.6rem 1.1rem;' +
        'font-family:inherit;font-size:.88rem;font-weight:700;color:#fff;' +
        'background:var(--grad-green,linear-gradient(135deg,#059669,#047857));' +
        'border:none;border-radius:999px;cursor:pointer;text-decoration:none;' +
        'white-space:nowrap;' +
      '}' +
      '.nn-install-x{' +
        'flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;' +
        'font-size:.8rem;color:var(--text-muted,#64748b);' +
        'background:transparent;border:none;cursor:pointer;border-radius:50%;' +
      '}' +
      '.nn-install-x:hover{background:var(--surface-2,#f4f8f6);}' +
      '@media(max-width:420px){' +
        '.nn-install-bar{gap:.7rem;padding-left:.8rem;padding-right:.8rem;}' +
        '.nn-install-bar img{width:38px;height:38px;}' +
        '.nn-install-copy span{display:none;}' +
        '.nn-install-go{padding:.55rem .9rem;font-size:.83rem;}' +
      '}';
    var el = d.createElement('style');
    el.id = 'nn-install-styles';
    el.textContent = css;
    d.head.appendChild(el);
  }

  /* ---------- the bar ---------- */

  function dismiss(countIt) {
    if (!barEl) return;
    barEl.classList.remove('open');
    var el = barEl;
    barEl = null;
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 500);

    if (countIt) {
      var s = readState();
      s.asks += 1;
      s.snoozedUntil = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      writeState(s);
    }
  }

  function markInstalled() {
    var s = readState();
    s.installed = true;
    writeState(s);
    dismiss(false);
  }

  function build(message) {
    injectStyles();

    var bar = d.createElement('div');
    bar.className = 'nn-install-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Add Nourish N Narrate to your home screen');

    var icon = d.createElement('img');
    icon.src = 'icon-192.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');

    var copy = d.createElement('div');
    copy.className = 'nn-install-copy';
    var title = d.createElement('strong');
    title.textContent = 'Keep it one tap away';
    var sub = d.createElement('span');
    sub.textContent = message;
    copy.appendChild(title);
    copy.appendChild(sub);

    // iOS can't be automated, so send those users to the walkthrough.
    var go;
    if (deferredPrompt) {
      go = d.createElement('button');
      go.type = 'button';
      go.textContent = 'Install';
      go.addEventListener('click', function () {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (res) {
          deferredPrompt = null;
          if (res && res.outcome === 'accepted') markInstalled();
          else dismiss(true);
        });
      });
    } else {
      go = d.createElement('a');
      go.href = 'install.html';
      go.textContent = isIOS() ? 'Show me' : 'How to';
      go.addEventListener('click', function () {
        // Not a refusal — they're going to the instructions.
        dismiss(false);
      });
    }
    go.className = 'nn-install-go';

    var x = d.createElement('button');
    x.className = 'nn-install-x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Not now');
    x.textContent = '✕';
    x.addEventListener('click', function () { dismiss(true); });

    bar.appendChild(icon);
    bar.appendChild(copy);
    bar.appendChild(go);
    bar.appendChild(x);
    d.body.appendChild(bar);
    barEl = bar;

    // Next frame, so the transform transition actually runs.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bar.classList.add('open'); });
    });
  }

  /* Context-specific copy — the reason they'd want it, in their words. */
  var MESSAGES = {
    'saved-plan': 'Add Nourish N Narrate to your home screen to open your plan instantly.',
    'logged-meal': 'Logging is quicker from your home screen — and works without a signal.',
    'default': 'Open it like an app — full screen, and works offline.',
  };

  /** Ask, if the rules allow it. Safe to call as often as you like. */
  function nudge(reason) {
    if (!canAsk()) return false;
    shownThisPage = true;
    var msg = MESSAGES[reason] || MESSAGES['default'];
    setTimeout(function () {
      if (isStandalone()) return; // installed between the call and the timer
      build(msg);
    }, SHOW_DELAY_MS);
    return true;
  }

  /* ---------- browser events ---------- */

  w.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  w.addEventListener('appinstalled', function () { markInstalled(); });

  w.NNInstall = {
    nudge: nudge,
    canAsk: canAsk,
    dismiss: dismiss,
    /** Clears the snooze — handy for testing from the console. */
    reset: function () { try { w.localStorage.removeItem(STORE_KEY); } catch (e) {} },
  };
})(window, document);
