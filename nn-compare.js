/* ===================================================================
   NOURISH N NARRATE — SMART RECIPE COMPARISON

   Pick two recipes, see them side by side. Lives entirely inside the
   recipes pages: a Compare button on each card, a tray along the
   bottom, and a slide-over panel. No new page, and no recipe data is
   copied — the tray stores titles and everything else is read back
   out of RECIPES when it is needed.

   ---------------------------------------------------------------
   WHAT WE CAN AND CANNOT COMPARE

   The database stores calories, protein, fibre, fat, one combined
   prep-and-cook time, servings and the collections. It does not store
   carbohydrates, a separate prep/cook split, or a difficulty rating.

   Rather than invent those:

     • Carbohydrates are worked back out of the calories using the
       standard 4/4/9 split, and labelled as an estimate.
     • Difficulty is read off the recipe's own shape — how many steps,
       how many ingredients, how long it takes — and labelled as such.
     • Prep and Cook appear as separate rows only if a recipe ever
       carries those fields. Today they do not, so the row hides
       itself and Total Time is shown instead. Nothing is faked.

   A row with no data on either side never renders.

   ---------------------------------------------------------------
   THE SUMMARY

   Written here from the numbers rather than fetched from a model.
   It is instant, works offline, costs nothing, and for a comparison
   of two known recipes there is nothing a language model could add
   that the figures do not already say.

   Requires: RECIPES (recipes-data-supabase.js).
   Optional: NNScore (nn-score.js) — the score row and the summary's
   verdict both degrade gracefully without it.
=================================================================== */
(function (w, d) {
  'use strict';

  var MAX = 2;
  var STORE = 'nn-compare';

  var picked = [];        // recipe titles, in the order they were added
  var minimized = false;
  var els = {};
  var lastFocused = null;

  /* ---------------- Data access ---------------- */

  function recipeList() {
    try { if (typeof RECIPES !== 'undefined' && Array.isArray(RECIPES)) return RECIPES; }
    catch (e) {}
    return Array.isArray(w.RECIPES) ? w.RECIPES : [];
  }

  function findRecipe(title) {
    var list = recipeList();
    for (var i = 0; i < list.length; i++) if (list[i].title === title) return list[i];
    return null;
  }

  function indexOfRecipe(title) {
    var list = recipeList();
    for (var i = 0; i < list.length; i++) if (list[i].title === title) return i;
    return -1;
  }

  /** The recipes currently in the tray, skipping any that no longer exist. */
  function chosen() {
    var out = [];
    for (var i = 0; i < picked.length; i++) {
      var r = findRecipe(picked[i]);
      if (r) out.push(r);
    }
    return out;
  }

  /* ---------------- Derived values ---------------- */

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : 0;
  }

  /** Minutes from a stored time like "25 min" or "1 hr 10 min". */
  function minutes(text) {
    var s = String(text || '').toLowerCase();
    if (!s) return null;
    var h = s.match(/(\d+)\s*(?:h|hr|hour)/);
    var m = s.match(/(\d+)\s*(?:m|min)/);
    var total = (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
    if (!total) {
      var bare = s.match(/(\d+)/);
      total = bare ? parseInt(bare[1], 10) : 0;
    }
    return total || null;
  }

  function timeLabel(mins) {
    if (!mins) return null;
    if (mins < 60) return mins + ' min';
    var h = Math.floor(mins / 60), m = mins % 60;
    return m ? h + ' hr ' + m + ' min' : h + ' hr';
  }

  /** Carbohydrates are not stored, so they are worked back out of the
      calories: whatever is left once protein and fat are accounted for.
      Always shown as an estimate. */
  function carbs(recipe) {
    var kcal = num(recipe.calories);
    if (!kcal) return null;
    var left = kcal - num(recipe.protein) * 4 - num(recipe.fat) * 9;
    var g = Math.round(left / 4);
    return g > 0 ? g : 0;
  }

  /** Difficulty is not stored either. It is read off the recipe's shape:
      a long ingredient list, many steps or a long cook are what actually
      make a recipe demanding. */
  function difficulty(recipe) {
    var steps = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
    var ings = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
    var mins = minutes(recipe.time) || 0;
    if (!steps && !ings) return null;

    var load = 0;
    if (steps >= 10) load += 2; else if (steps >= 7) load += 1;
    if (ings >= 13) load += 2; else if (ings >= 10) load += 1;
    if (mins >= 60) load += 2; else if (mins >= 35) load += 1;

    return load >= 4 ? 'Hard' : load >= 2 ? 'Medium' : 'Easy';
  }

  function collectionsOf(recipe) {
    if (Array.isArray(recipe.collections) && recipe.collections.length) return recipe.collections;
    return [recipe.type === 'non-veg' ? 'Non-Vegetarian' : 'Vegetarian'];
  }

  function scoreOf(recipe) {
    if (!w.NNScore) return null;
    try { return w.NNScore.of(recipe); } catch (e) { return null; }
  }

  /* ---------------- The rows ----------------
     `better` says which direction wins:
       'high'  — more is better        'low' — less is better
       null    — informational, no winner is claimed.
     Rows where neither recipe has a value are dropped before render. */

  function rows(a, b) {
    var all = [
      {
        key: 'score', label: '⭐ Nutrition Score', better: 'high', emphasis: true,
        value: function (r) { var s = scoreOf(r); return s == null ? null : s; },
        text: function (v) { return v + '/100'; },
      },
      {
        key: 'calories', label: 'Calories', better: 'low',
        value: function (r) { return num(r.calories) || null; },
        text: function (v) { return v + ' cal'; },
      },
      {
        key: 'protein', label: 'Protein', better: 'high',
        value: function (r) { return num(r.protein) || null; },
        text: function (v) { return v + ' g'; },
      },
      {
        key: 'carbs', label: 'Carbohydrates', better: null, note: 'estimated',
        value: function (r) { return carbs(r); },
        text: function (v) { return v + ' g'; },
      },
      {
        key: 'fat', label: 'Fat', better: 'low',
        value: function (r) { return num(r.fat) || null; },
        text: function (v) { return v + ' g'; },
      },
      {
        key: 'fiber', label: 'Fibre', better: 'high',
        value: function (r) { return num(r.fiber) || null; },
        text: function (v) { return v + ' g'; },
      },
      // Prep and Cook only appear once a recipe actually carries them.
      // Today the database keeps a single combined figure, so these two
      // drop out and Total Time below does the work.
      {
        key: 'prep', label: 'Prep Time', better: 'low',
        value: function (r) { return minutes(r.prepTime); },
        text: timeLabel,
      },
      {
        key: 'cook', label: 'Cook Time', better: 'low',
        value: function (r) { return minutes(r.cookTime); },
        text: timeLabel,
      },
      {
        key: 'total', label: 'Total Time', better: 'low',
        value: function (r) { return minutes(r.time); },
        text: timeLabel,
      },
      {
        key: 'servings', label: 'Servings', better: null,
        value: function (r) { return num(r.servings) || null; },
        text: function (v) { return String(v); },
      },
      {
        key: 'difficulty', label: 'Difficulty', better: null, note: 'from steps and time',
        value: function (r) { return difficulty(r); },
        text: function (v) { return v; },
      },
      {
        key: 'collections', label: 'Collections', better: null,
        value: function (r) { return collectionsOf(r).join(', ') || null; },
        text: function (v) { return v; },
      },
    ];

    var out = [];
    for (var i = 0; i < all.length; i++) {
      var row = all[i];
      var va = row.value(a), vb = row.value(b);
      if (va == null && vb == null) continue;          // nothing to show
      out.push({
        label: row.label,
        note: row.note || '',
        emphasis: !!row.emphasis,
        a: va, b: vb,
        aText: va == null ? '—' : row.text(va),
        bText: vb == null ? '—' : row.text(vb),
        winner: winnerOf(row.better, va, vb),
      });
    }
    return out;
  }

  /** 'a', 'b' or null. Only claimed where "better" is defensible and the
      two actually differ. */
  function winnerOf(better, va, vb) {
    if (!better || typeof va !== 'number' || typeof vb !== 'number') return null;
    if (va === vb) return null;
    if (better === 'high') return va > vb ? 'a' : 'b';
    return va < vb ? 'a' : 'b';
  }

  /* ---------------- The summary ---------------- */

  function summarise(a, b) {
    var sa = scoreOf(a), sb = scoreOf(b);
    var pa = num(a.protein), pb = num(b.protein);
    var ca = num(a.calories), cb = num(b.calories);
    var ta = minutes(a.time), tb = minutes(b.time);
    var fa = num(a.fiber), fb = num(b.fiber);

    // Each recipe collects the things it is genuinely better at.
    var forA = [], forB = [];
    function split(diff, aWins, phraseA, phraseB) {
      if (!diff) return;
      (aWins ? forA : forB).push(aWins ? phraseA : phraseB);
    }

    if (Math.abs(pa - pb) >= 4) {
      split(true, pa > pb, 'high-protein meals', 'high-protein meals');
    }
    if (Math.abs(ca - cb) >= 40) {
      (ca < cb ? forA : forB).push('keeping calories down');
    }
    if (ta && tb && Math.abs(ta - tb) >= 10) {
      (ta < tb ? forA : forB).push('quick weeknight cooking');
    }
    if (Math.abs(fa - fb) >= 3) {
      (fa > fb ? forA : forB).push('fibre');
    }

    var parts = [];
    if (forA.length) parts.push(a.title + ' is better for ' + listOut(forA));
    if (forB.length) parts.push(b.title + ' is better for ' + listOut(forB));

    var lead;
    if (!parts.length) {
      lead = a.title + ' and ' + b.title + ' are closely matched — ' +
        'there is no meaningful nutritional gap between them.';
    } else if (parts.length === 1) {
      lead = parts[0] + '.';
    } else {
      // Both clauses open with a recipe title, so the second keeps its
      // capitals — lowercasing it turned "Crispy Baked French Fries" into
      // "crispy Baked French Fries".
      lead = parts[0] + ', while ' + parts[1] + '.';
    }

    // The overall verdict, only when the scores are far enough apart to
    // mean something.
    if (sa != null && sb != null && Math.abs(sa - sb) >= 5) {
      var win = sa > sb ? a : b;
      lead += ' Overall ' + win.title + ' scores higher on nutrition (' +
        Math.max(sa, sb) + ' against ' + Math.min(sa, sb) + ').';
    }
    return lead;
  }

  function listOut(arr) {
    var seen = [], i;
    for (i = 0; i < arr.length; i++) if (seen.indexOf(arr[i]) === -1) seen.push(arr[i]);
    if (seen.length === 1) return seen[0];
    if (seen.length === 2) return seen[0] + ' and ' + seen[1];
    return seen.slice(0, -1).join(', ') + ' and ' + seen[seen.length - 1];
  }

  /* ---------------- Selection ---------------- */

  function isPicked(title) { return picked.indexOf(title) !== -1; }

  function toggle(title) {
    var i = picked.indexOf(title);
    if (i !== -1) {
      picked.splice(i, 1);
    } else {
      // Full tray: the oldest pick steps aside, which is what people
      // expect when they keep clicking Compare on new cards.
      if (picked.length >= MAX) picked.shift();
      picked.push(title);
      minimized = false;
    }
    save();
    refresh();
    return isPicked(title);
  }

  function remove(title) {
    var i = picked.indexOf(title);
    if (i !== -1) { picked.splice(i, 1); save(); refresh(); }
  }

  function clear() {
    picked = [];
    save();
    closePanel();
    refresh();
  }

  function save() {
    try { w.sessionStorage.setItem(STORE, JSON.stringify(picked)); } catch (e) {}
  }

  function load() {
    try {
      var raw = w.sessionStorage.getItem(STORE);
      var v = raw ? JSON.parse(raw) : null;
      if (Array.isArray(v)) picked = v.slice(0, MAX).filter(function (t) {
        return typeof t === 'string';
      });
    } catch (e) { picked = []; }
  }

  /* ---------------- Card buttons ---------------- */

  /** Keep every Compare button on the page in step with the tray. */
  function syncButtons() {
    var btns = d.querySelectorAll('[data-compare-title]');
    for (var i = 0; i < btns.length; i++) {
      var on = isPicked(btns[i].getAttribute('data-compare-title'));
      btns[i].classList.toggle('active', on);
      btns[i].textContent = on ? '✓ Comparing' : '⇄ Compare';
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /** Build the button that nn-cards.js drops onto each recipe card. */
  function buildButton(recipe) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'card-compare';
    b.setAttribute('data-compare-title', recipe.title);
    b.setAttribute('aria-pressed', 'false');
    b.title = 'Compare this recipe with another';
    b.textContent = '⇄ Compare';
    b.addEventListener('click', function (e) {
      e.stopPropagation();          // the card itself opens the recipe
      toggle(recipe.title);
    });
    return b;
  }

  /* ---------------- Tray ---------------- */

  function mountTray() {
    if (els.tray || !d.body) return;   // nothing to attach to yet
    var tray = d.createElement('div');
    tray.className = 'nncmp-tray';
    tray.id = 'nn-compare-tray';
    tray.setAttribute('role', 'region');
    tray.setAttribute('aria-label', 'Recipe comparison tray');
    tray.innerHTML =
      '<div class="nncmp-tray-inner">' +
        '<div class="nncmp-tray-head">' +
          '<span class="nncmp-tray-title">⇄ Compare</span>' +
          '<span class="nncmp-tray-count" id="nncmp-count"></span>' +
        '</div>' +
        '<div class="nncmp-slots" id="nncmp-slots"></div>' +
        '<div class="nncmp-tray-actions">' +
          '<button type="button" class="nncmp-go" id="nncmp-open">Compare</button>' +
          '<button type="button" class="nncmp-ghost" id="nncmp-clear">Clear</button>' +
          '<button type="button" class="nncmp-min" id="nncmp-min" aria-label="Minimise comparison tray">▾</button>' +
        '</div>' +
      '</div>';
    d.body.appendChild(tray);

    els.tray = tray;
    els.slots = d.getElementById('nncmp-slots');
    els.count = d.getElementById('nncmp-count');
    els.open = d.getElementById('nncmp-open');
    els.min = d.getElementById('nncmp-min');

    els.open.addEventListener('click', openPanel);
    d.getElementById('nncmp-clear').addEventListener('click', clear);
    els.min.addEventListener('click', function () {
      minimized = !minimized;
      refresh();
    });
  }

  function renderTray() {
    if (!els.tray) return;
    var list = chosen();

    els.tray.classList.toggle('show', list.length > 0);
    els.tray.classList.toggle('mini', minimized);
    // The tray is fixed to the bottom, so give the page room underneath
    // rather than letting it sit over the last row of cards.
    if (d.body) d.body.classList.toggle('nncmp-tray-open', list.length > 0 && !minimized);
    els.min.textContent = minimized ? '▴' : '▾';
    els.min.setAttribute('aria-label',
      minimized ? 'Expand comparison tray' : 'Minimise comparison tray');

    els.count.textContent = list.length + ' of ' + MAX +
      (list.length < MAX ? ' — pick one more' : ' — ready');

    els.slots.innerHTML = '';
    for (var i = 0; i < MAX; i++) {
      var r = list[i];
      var slot = d.createElement('div');
      slot.className = 'nncmp-slot' + (r ? '' : ' empty');
      if (r) {
        var chip = d.createElement('span');
        chip.className = 'nncmp-slot-emoji';
        chip.textContent = r.emoji || '🍽️';
        var name = d.createElement('span');
        name.className = 'nncmp-slot-name';
        name.textContent = r.title;
        var x = d.createElement('button');
        x.type = 'button';
        x.className = 'nncmp-slot-x';
        x.setAttribute('aria-label', 'Remove ' + r.title + ' from comparison');
        x.textContent = '✕';
        (function (title) {
          x.addEventListener('click', function () { remove(title); });
        })(r.title);
        slot.appendChild(chip);
        slot.appendChild(name);
        slot.appendChild(x);
      } else {
        slot.textContent = 'Pick a recipe';
      }
      els.slots.appendChild(slot);
    }

    els.open.disabled = list.length < MAX;
    els.open.textContent = list.length < MAX ? 'Pick 2 to compare' : 'Compare →';
  }

  function refresh() {
    mountTray();
    renderTray();
    syncButtons();
    if (els.panel && els.panel.classList.contains('open')) {
      if (chosen().length < MAX) closePanel(); else renderPanel();
    }
  }

  /* ---------------- Slide-over panel ---------------- */

  function mountPanel() {
    if (els.panel || !d.body) return;
    var panel = d.createElement('div');
    panel.className = 'nncmp-panel-overlay';
    panel.id = 'nn-compare-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'nncmp-panel-title');
    panel.innerHTML =
      '<div class="nncmp-panel">' +
        '<div class="nncmp-panel-head">' +
          '<h3 class="nncmp-panel-title" id="nncmp-panel-title">Recipe comparison</h3>' +
          '<button type="button" class="nncmp-panel-x" id="nncmp-panel-x" aria-label="Close comparison">✕</button>' +
        '</div>' +
        '<div class="nncmp-panel-body" id="nncmp-panel-body"></div>' +
      '</div>';
    d.body.appendChild(panel);

    els.panel = panel;
    els.panelBody = d.getElementById('nncmp-panel-body');

    d.getElementById('nncmp-panel-x').addEventListener('click', closePanel);
    panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
      trapFocus(e);
    });
  }

  function openPanel() {
    // Usage analytics — which recipes people put head to head.
    try {
      if (w.NNAnalytics && chosen().length >= MAX) {
        w.NNAnalytics.track('recipe_compare', {
          titles: chosen().map(function (r) { return r.title; }),
        });
      }
    } catch (e) {}
    if (chosen().length < MAX) return;
    mountPanel();
    renderPanel();
    lastFocused = d.activeElement;
    els.panel.classList.add('open');
    d.body.style.overflow = 'hidden';
    var x = d.getElementById('nncmp-panel-x');
    if (x) x.focus();
  }

  function closePanel() {
    if (!els.panel || !els.panel.classList.contains('open')) return;
    els.panel.classList.remove('open');
    d.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' || !els.panel || !els.panel.classList.contains('open')) return;
    var f = els.panel.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderPanel() {
    var list = chosen();
    if (list.length < MAX || !els.panelBody) return;
    var a = list[0], b = list[1];

    var body = els.panelBody;
    body.innerHTML = '';

    /* Summary */
    var sum = el('div', 'nncmp-summary');
    sum.appendChild(el('div', 'nncmp-summary-label', '✨ In short'));
    sum.appendChild(el('p', 'nncmp-summary-text', summarise(a, b)));
    body.appendChild(sum);

    /* Headers */
    var head = el('div', 'nncmp-grid nncmp-heads');
    head.appendChild(el('div', 'nncmp-rowlabel', ''));
    [a, b].forEach(function (r) {
      var cell = el('div', 'nncmp-head');
      cell.appendChild(el('div', 'nncmp-head-emoji', r.emoji || '🍽️'));
      cell.appendChild(el('div', 'nncmp-head-title', r.title));
      cell.appendChild(el('div', 'nncmp-head-cat', r.category || ''));
      head.appendChild(cell);
    });
    body.appendChild(head);

    /* Rows */
    var table = el('div', 'nncmp-rows');
    rows(a, b).forEach(function (row) {
      var line = el('div', 'nncmp-grid nncmp-row' + (row.emphasis ? ' is-key' : ''));

      var lab = el('div', 'nncmp-rowlabel');
      lab.appendChild(el('span', null, row.label));
      if (row.note) lab.appendChild(el('span', 'nncmp-rownote', row.note));
      line.appendChild(lab);

      ['a', 'b'].forEach(function (side) {
        var cell = el('div', 'nncmp-cell' + (row.winner === side ? ' is-better' : ''));
        cell.appendChild(el('span', 'nncmp-val', side === 'a' ? row.aText : row.bText));
        if (row.winner === side) {
          var tick = el('span', 'nncmp-better', '✓');
          tick.title = 'Better on this measure';
          cell.appendChild(tick);
        }
        line.appendChild(cell);
      });
      table.appendChild(line);
    });
    body.appendChild(table);

    body.appendChild(el('p', 'nncmp-legend',
      '✓ marks the recipe that does better where "better" is clear — more protein or ' +
      'fibre, fewer calories, less time. Carbohydrates, servings, difficulty and ' +
      'collections are shown for context, not scored.'));

    /* Per-recipe actions */
    var acts = el('div', 'nncmp-grid nncmp-actions-row');
    acts.appendChild(el('div', 'nncmp-rowlabel', ''));
    [a, b].forEach(function (r) {
      var cell = el('div', 'nncmp-actions');

      var view = el('button', 'nncmp-act nncmp-act-primary', 'View Recipe');
      view.type = 'button';
      view.addEventListener('click', function () {
        var i = indexOfRecipe(r.title);
        closePanel();
        if (i !== -1 && typeof w.openModal === 'function') w.openModal(i);
      });
      cell.appendChild(view);

      var swap = el('button', 'nncmp-act', 'Replace');
      swap.type = 'button';
      swap.title = 'Take this one out and pick a different recipe';
      swap.addEventListener('click', function () {
        remove(r.title);
        closePanel();
        // Send them back to the grid to choose the replacement.
        var grid = d.getElementById('recipe-grid');
        if (grid && grid.scrollIntoView) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      cell.appendChild(swap);

      var drop = el('button', 'nncmp-act nncmp-act-quiet', 'Remove');
      drop.type = 'button';
      drop.addEventListener('click', function () { remove(r.title); });
      cell.appendChild(drop);

      acts.appendChild(cell);
    });
    body.appendChild(acts);
  }

  /* ---------------- Boot ---------------- */

  function init() {
    load();
    refresh();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();

  // Cards are rebuilt whenever the recipe list arrives or a filter changes.
  w.addEventListener('recipesLoaded', function () { refresh(); });

  w.NNCompare = {
    buildButton: buildButton,
    toggle: toggle,
    remove: remove,
    clear: clear,
    get: function () { return picked.slice(); },
    open: openPanel,
    close: closePanel,
    sync: syncButtons,
    refresh: refresh,
    /* Exposed for tests — these are the parts worth pinning down. */
    rows: rows,
    summary: summarise,
    difficulty: difficulty,
    carbs: carbs,
    minutes: minutes,
    MAX: MAX,
  };
})(window, document);
