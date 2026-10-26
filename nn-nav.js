/* ===================================================================
   NOURISH N NARRATE — SHARED PAGE CHROME

   One copy of the code every page used to repeat inline:
     • Dark-mode toggle (preference shared across pages as `nnTheme`)
     • Navbar "scrolled" glass effect
     • Signed-in nav state: reveals [data-nn-signed-in] items and turns
       every [data-nn-auth] link into "Sign Out"
     • Service-worker registration (offline support + installability)

   The saved theme is applied by a one-line script in each page's <head>
   so dark-mode visitors never see a white flash; this file only wires
   up the button. The mobile menu and back-to-top button live in
   nn-premium.js.

   Load after nn-auth.js:  <script src="nn-nav.js"></script>
=================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------------- Dark mode ---------------- */
  function readTheme() {
    try { return localStorage.getItem('nnTheme') || 'light'; } catch (e) { return 'light'; }
  }

  var themeBtn = document.getElementById('theme-toggle');
  root.setAttribute('data-theme', readTheme());
  if (themeBtn) {
    var sync = function () {
      themeBtn.textContent = root.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    };
    sync();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('nnTheme', next); } catch (e) { /* private mode */ }
      sync();
    });
  }

  /* ---------------- Navbar glass effect ---------------- */
  var navbar = document.getElementById('navbar');
  if (navbar) {
    var onScroll = function () { navbar.classList.toggle('scrolled', window.scrollY > 20); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Signed-in nav state ---------------- */
  if (window.NNAuth) {
    NNAuth.onReady(async function () {
      var session = await NNAuth.getSession();
      if (!session) return;

      document.querySelectorAll('[data-nn-signed-in]').forEach(function (el) {
        el.style.display = '';
      });

      document.querySelectorAll('[data-nn-auth]').forEach(function (el) {
        el.textContent = el.classList.contains('nav-auth') ? 'Sign Out' : '🔓 Sign Out';
        el.href = '#';
        el.title = 'Signed in as ' + session.user.email;
        el.addEventListener('click', async function (e) {
          e.preventDefault();
          await NNAuth.signOut();
          location.reload();
        });
      });
    });
  }

  /* ---------------- Service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
})();
