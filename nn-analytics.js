/* ===================================================================
   NOURISH N NARRATE — USAGE ANALYTICS

   Records which features get used, so the admin dashboard has
   something to report. Nothing here is required for the site to work:
   every call is wrapped, every failure is swallowed, and no feature
   waits on a network round trip.

   ---------------------------------------------------------------
   WHAT IS AND IS NOT RECORDED

   Recorded: the name of the thing that happened, and a small payload
   describing it — a search phrase, a list of ingredients, a recipe
   title, how long a generation took.

   Not recorded: names, email addresses, IP addresses, or anything
   typed into the calculator or tracker. When someone is signed in the
   event carries their user id so the dashboard can count distinct
   people; signed-out events carry null and are simply anonymous.

   The row-level security policy only accepts `user_id is null` or the
   caller's own id, so an event can never be attributed to someone else.

   ---------------------------------------------------------------
   HOW IT SENDS

   Events are queued and flushed in batches — on a short timer, when
   the queue fills, or when the page is being hidden. A recipe search
   should never cost the visitor a network wait, so nothing is sent
   inline with the interaction that caused it.

   Requires: nn-config.js. Uses NNAuth's session when it is available.
=================================================================== */
(function (w, d) {
  'use strict';

  var CFG = w.NN_CONFIG || {};
  var ENDPOINT = CFG.SUPABASE_URL ? CFG.SUPABASE_URL + '/rest/v1/analytics_events' : null;
  var KEY = CFG.SUPABASE_ANON_KEY;

  var BATCH = 6;          // flush once this many are waiting
  var INTERVAL = 6000;    // …or after this long, whichever comes first
  var MAX_QUEUE = 40;     // hard ceiling if the network is down

  var queue = [];
  var timer = null;
  var userId = null;
  var enabled = !!(ENDPOINT && KEY);

  /* ---------------- Session ----------------
     Best-effort. If we never learn who they are, events stay anonymous
     rather than being dropped. */
  function pickUpSession() {
    try {
      if (!w.NNAuth || typeof w.NNAuth.getSession !== 'function') return;
      w.NNAuth.getSession().then(function (s) {
        userId = s && s.user ? s.user.id : null;
      }, function () { /* signed out */ });
    } catch (e) { /* auth not loaded on this page */ }
  }

  /* ---------------- Payload hygiene ----------------
     Keeps rows small and stops anything unexpectedly large or personal
     ending up in the props column. The database also enforces a size
     limit, but failing there would lose the whole batch. */

  function str(v, max) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 120);
  }

  function list(v, maxItems, maxLen) {
    if (!Array.isArray(v)) return [];
    var out = [];
    for (var i = 0; i < v.length && out.length < maxItems; i++) {
      var s = str(v[i], maxLen || 40).toLowerCase();
      if (s.length > 1 && out.indexOf(s) === -1) out.push(s);
    }
    return out;
  }

  function clean(props) {
    var out = {};
    if (!props || typeof props !== 'object') return out;
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v == null) continue;
      if (typeof v === 'number') { if (isFinite(v)) out[k] = Math.round(v * 100) / 100; }
      else if (typeof v === 'boolean') out[k] = v;
      else if (Array.isArray(v)) { var a = list(v, 12, 60); if (a.length) out[k] = a; }
      else out[k] = str(v, 160);
    }
    return out;
  }

  /* ---------------- Queue + flush ---------------- */

  function track(name, props) {
    if (!enabled) return;
    try {
      var n = str(name, 60);
      if (n.length < 3) return;
      queue.push({ user_id: userId, name: n, props: clean(props) });
      if (queue.length >= MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
      if (queue.length >= BATCH) flush();
      else schedule();
    } catch (e) { /* analytics must never break a feature */ }
  }

  function schedule() {
    if (timer) return;
    timer = w.setTimeout(function () { timer = null; flush(); }, INTERVAL);
  }

  function flush(useBeacon) {
    if (!enabled || !queue.length) return;
    var batch = queue.splice(0, queue.length);
    if (timer) { w.clearTimeout(timer); timer = null; }

    var body = JSON.stringify(batch);

    // On the way out of the page, sendBeacon is the only thing that
    // reliably survives. It cannot set custom headers, so the key rides
    // in the query string — it is the publishable anon key, which is
    // designed to be public and grants only what RLS allows.
    if (useBeacon && w.navigator && w.navigator.sendBeacon) {
      try {
        var url = ENDPOINT + '?apikey=' + encodeURIComponent(KEY);
        var blob = new Blob([body], { type: 'application/json' });
        if (w.navigator.sendBeacon(url, blob)) return;
      } catch (e) { /* fall through to fetch */ }
    }

    try {
      w.fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': KEY,
          'Authorization': 'Bearer ' + KEY,
          'Prefer': 'return=minimal',
        },
        body: body,
        keepalive: true,
      }).catch(function () { /* offline — these events are simply lost */ });
    } catch (e) { /* no fetch — give up quietly */ }
  }

  /* Send what is waiting before the page goes away. */
  d.addEventListener('visibilitychange', function () {
    if (d.visibilityState === 'hidden') flush(true);
  });
  w.addEventListener('pagehide', function () { flush(true); });

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', pickUpSession);
  else pickUpSession();

  w.NNAnalytics = {
    track: track,
    flush: function () { flush(false); },
    /** Exposed so the dashboard can show whether tracking is even on. */
    enabled: function () { return enabled; },
    pending: function () { return queue.length; },
  };
})(window, document);
