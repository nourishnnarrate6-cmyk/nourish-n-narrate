/* ===================================================================
   NOURISH N NARRATE — PREMIUM CURSOR INTERACTIONS
   Magnetic buttons, card tilt toward the cursor, and subtle image
   parallax. Vanilla JS, rAF-throttled for 60fps.

   Automatically disabled on:
     • touch devices / coarse pointers
     • prefers-reduced-motion
=================================================================== */
(function () {
  'use strict';

  /* ---------------- Device detection ----------------
     Tags <html data-device="phone|tablet|desktop"> on load so CSS and
     JS can adapt to the actual device, not just the window width. */
  (function () {
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    var shortSide = Math.min(window.screen.width, window.screen.height);
    var device = 'desktop';
    if (coarse || touch) device = shortSide >= 600 ? 'tablet' : 'phone';
    document.documentElement.setAttribute('data-device', device);
  })();

  /* ---------------- Shared mobile menu ----------------
     Pages other than the homepage mark their hamburger + dropdown
     with data-nn-menu; this wires them up (works on touch). */
  (function () {
    var burger = document.querySelector('.hamburger[data-nn-menu]');
    var menu = document.querySelector('.mobile-menu[data-nn-menu]');
    if (!burger || !menu) return;
    var open = false;
    function setOpen(v) {
      open = v;
      burger.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      menu.style.display = open ? 'flex' : 'none';
      burger.setAttribute('aria-expanded', String(open));
    }
    burger.addEventListener('click', function () { setOpen(!open); });
    document.addEventListener('click', function (e) {
      if (open && !burger.contains(e.target) && !menu.contains(e.target)) setOpen(false);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });
  })();

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  /* ---------------- Magnetic buttons ---------------- */
  var MAGNET_SEL = [
    '.btn-primary', '.btn-secondary', '.nav-cta', '.btn-calculate',
    '.btn-suggest', '.btn-rate', '.see-more-btn', '.btn-auth',
    '.btn-track', '.btn-main', '.btn-calc-promo', '.diet-see-all',
  ].join(',');

  var magnetEl = null, magnetRaf = null;

  function resetMagnet() {
    if (magnetRaf) { cancelAnimationFrame(magnetRaf); magnetRaf = null; }
    if (magnetEl) { magnetEl.style.transform = ''; magnetEl = null; }
  }

  /* ---------------- Card tilt + image parallax ---------------- */
  var TILT_SEL = [
    '.recipe-card', '.pillar', '.diet-btn', '.stat-card',
    '.t-card', '.p-card', '.res-card', '.target-tile',
  ].join(',');

  var tiltEl = null, tiltRaf = null;

  function resetTilt() {
    if (tiltRaf) { cancelAnimationFrame(tiltRaf); tiltRaf = null; }
    if (tiltEl) {
      tiltEl.style.transform = '';
      var img = tiltEl.querySelector('.card-img');
      if (img) img.style.transform = '';
      tiltEl = null;
    }
  }

  /* One delegated listener keeps this working for dynamically
     rendered cards (recipes load from Supabase after page load). */
  document.addEventListener('mousemove', function (e) {
    if (!e.target || !e.target.closest) return;

    // Magnetic pull
    var m = e.target.closest(MAGNET_SEL);
    if (m !== magnetEl) resetMagnet();
    if (m) {
      magnetEl = m;
      var mr = m.getBoundingClientRect();
      var mx = (e.clientX - mr.left - mr.width / 2) * 0.16;
      var my = (e.clientY - mr.top - mr.height / 2) * 0.22;
      if (magnetRaf) cancelAnimationFrame(magnetRaf);
      magnetRaf = requestAnimationFrame(function () {
        m.style.transform = 'translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px) scale(1.03)';
      });
    }

    // Tilt
    var t = e.target.closest(TILT_SEL);
    if (t !== tiltEl) resetTilt();
    if (t && !m) {
      var tr = t.getBoundingClientRect();
      if (tr.width <= 720) { // huge cards stay put
        tiltEl = t;
        var px = (e.clientX - tr.left) / tr.width - 0.5;
        var py = (e.clientY - tr.top) / tr.height - 0.5;
        if (tiltRaf) cancelAnimationFrame(tiltRaf);
        tiltRaf = requestAnimationFrame(function () {
          t.style.transform =
            'perspective(900px) rotateX(' + (-py * 3.5).toFixed(2) + 'deg)' +
            ' rotateY(' + (px * 4.5).toFixed(2) + 'deg) translateY(-5px)';
          // Subtle image parallax inside the card
          var img = t.querySelector('.card-img');
          if (img) {
            img.style.transform =
              'scale(1.09) translate(' + (px * -7).toFixed(1) + 'px,' + (py * -7).toFixed(1) + 'px)';
          }
        });
      }
    }
  }, { passive: true });

  // Clean up when the cursor leaves the window
  document.documentElement.addEventListener('mouseleave', function () {
    resetMagnet();
    resetTilt();
  });
})();
