/* ===================================================================
   NOURISH N NARRATE — SERVICE WORKER

   What this does:
     • Precaches the app shell so the site opens instantly and works
       offline once it has been visited.
     • NEVER caches Supabase auth / REST / Edge Function traffic, so a
       user can never see stale calories, logs, weights or session
       state. Those always go straight to the network.
     • Caches recipe photos, Google Fonts and the supabase-js library
       separately, since those are large and effectively immutable.

   Bump CACHE_VERSION whenever you change any file in the app shell —
   INCLUDING when you edit one again after already bumping. The version is
   what names the cache, so a file edited after install is never re-fetched:
   v29 shipped, nn-modern.css was then edited twice, and every visitor kept
   the stylesheet as it was at install time. If in doubt, bump. —
   that is what tells existing installs to pull the new build.
=================================================================== */

const CACHE_VERSION = 'v31';
const SHELL_CACHE = 'nn-shell-' + CACHE_VERSION;
const ASSET_CACHE = 'nn-assets-' + CACHE_VERSION;
const VALID_CACHES = [SHELL_CACHE, ASSET_CACHE];

/* Everything needed to render the app with no network. */
const SHELL = [
  './',
  'index.html',
  'recipes.html',
  'all-recipes.html',
  'calculator.html',
  'login.html',
  'profile.html',
  'tracker.html',
  'install.html',
  'donate.html',
  'nn-modern.css',
  'nn-auth.js',
  'nn-cards.js',
  'nn-analytics.js',
  'nn-score.js',
  'nn-compare.js',
  'nn-config.js',
  'nn-premium.js',
  'nn-install.js',
  'nn-finder.js',
  'nn-pantry.js',
  'nn-creator.js',
  'nn-tour.js',
  'form-handlers.js',
  'recipes-data-supabase.js',
  'supabase-client.js',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'manifest.json',
];

/* ---------- install: precache the shell ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll() is atomic — one 404 would abort the whole install, so add
      // each entry individually and tolerate any single failure.
      .then(cache => Promise.all(
        SHELL.map(url => cache.add(url).catch(() => {
          console.warn('[sw] could not precache', url);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

/* ---------- activate: drop caches from older versions ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('nn-') && !VALID_CACHES.includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- helpers ---------- */

/** Live application data — must always hit the network. */
function isSupabaseData(url) {
  if (!url.hostname.endsWith('.supabase.co')) return false;
  // Public storage objects (recipe photos) are immutable and safe to cache.
  if (url.pathname.startsWith('/storage/v1/object/public/')) return false;
  return true; // /auth/, /rest/, /functions/, /realtime/ ...
}

/** Big, effectively-immutable third-party assets. */
function isCacheableAsset(url) {
  return (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    (url.hostname.endsWith('.supabase.co') &&
     url.pathname.startsWith('/storage/v1/object/public/'))
  );
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

/* ---------- fetch ---------- */
self.addEventListener('fetch', event => {
  const request = event.request;

  // Only ever handle simple GETs. POSTs (sign-in, inserts) pass through.
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1. Supabase auth/data — network only, never cached, never fallback.
  if (isSupabaseData(url)) return;

  // 2. Pages — network first so updates land immediately; cache is the
  //    offline safety net.
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)
          .then(hit => hit || caches.match('index.html'))
          .then(hit => hit || new Response(
            '<h1>Offline</h1><p>Reconnect to load this page.</p>',
            { headers: { 'Content-Type': 'text/html' }, status: 503 }
          ))
        )
    );
    return;
  }

  // 3. Fonts, supabase-js, recipe photos — cache first, refresh in background.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(hit => {
        const network = fetch(request).then(response => {
          // Opaque (no-cors) responses are fine to store for fonts/images.
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then(c => c.put(request, copy));
          }
          return response;
        }).catch(() => hit);
        return hit || network;
      })
    );
    return;
  }

  // 4. Same-origin app files — cache first, fall back to network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(c => c.put(request, copy));
        }
        return response;
      }))
    );
  }
});

/* Lets the page trigger an immediate update via
   registration.waiting.postMessage({ type: 'SKIP_WAITING' }) */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
