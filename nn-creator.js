/* ===================================================================
   NOURISH N NARRATE — AI RECIPE CREATOR

   The one place on the site that writes a recipe instead of reading
   one. Everything else — the finder, pantry mode, the collections —
   only ever surfaces recipes from the curated database. This does not,
   so three rules hold it in place:

     • Generated recipes are always labelled "✨ AI Generated Recipe".
     • They are saved to `ai_recipes`, a private per-user table. The
       curated `recipes` table is never written to from the browser, so
       nothing generated here can leak into the collections, the pantry
       matcher or anyone else's site.
     • The server may refuse. If the ingredients cannot honestly make
       the requested meal it returns a problem and suggested fixes, and
       we show those instead of a recipe. Never a filler recipe.

   The heavy thinking (and every safety check on allergies, diet and
   nutrition arithmetic) lives in the create-recipe edge function. This
   file is the form, the result, and the actions on it.

   Requires: NNAuth (nn-auth.js).
   Optional: NNPantry (nn-pantry.js) — when present, the "use my
   pantry" shortcut and a second opinion on the shopping list.
=================================================================== */
(function (w, d) {
  'use strict';

  var STORE = 'nn-creator-form';   // last form state, so a reload keeps it
  var MAX_ING = 25;
  var MAX_ALLERGY = 10;

  /* Kept between generations so "another version" can ask for something
     genuinely different rather than a rename of what we just showed. */
  var seenTitles = [];
  var lastSpec = null;
  var current = null;              // the recipe on screen right now
  var currentSavedId = null;       // set once it has been saved
  var busy = false;

  var ingredients = [];
  var allergies = [];

  var form = {
    diet: 'Vegetarian',
    mealType: 'dinner',
    maxMinutes: 30,
    targetCalories: 500,
    proteinGoal: 25,
    difficulty: 'Easy',
  };

  var els = {};

  /* ---------------- Small helpers ---------------- */

  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /** Title-case a lowercase word for display without touching the value. */
  function titleCase(s) {
    return String(s || '').replace(/(^|\s)([a-z])/g, function (m, a, b) {
      return a + b.toUpperCase();
    });
  }

  function minutesLabel(n) {
    if (n < 60) return n + ' min';
    var h = Math.floor(n / 60), m = n % 60;
    return m ? h + ' hr ' + m + ' min' : h + ' hr';
  }

  /* ---------------- Form state ---------------- */

  function loadForm() {
    try {
      var raw = w.localStorage.getItem(STORE);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      if (Array.isArray(saved.ingredients)) ingredients = saved.ingredients.slice(0, MAX_ING);
      if (Array.isArray(saved.allergies)) allergies = saved.allergies.slice(0, MAX_ALLERGY);
      ['diet', 'mealType', 'difficulty'].forEach(function (k) {
        if (typeof saved[k] === 'string') form[k] = saved[k];
      });
      ['maxMinutes', 'targetCalories', 'proteinGoal'].forEach(function (k) {
        if (typeof saved[k] === 'number') form[k] = saved[k];
      });
    } catch (e) { /* private browsing, corrupt value — start fresh */ }
  }

  function saveForm() {
    try {
      w.localStorage.setItem(STORE, JSON.stringify({
        ingredients: ingredients, allergies: allergies,
        diet: form.diet, mealType: form.mealType, difficulty: form.difficulty,
        maxMinutes: form.maxMinutes, targetCalories: form.targetCalories,
        proteinGoal: form.proteinGoal,
      }));
    } catch (e) { /* quota or disabled storage — the form still works */ }
  }

  /** Split typed text into clean, de-duplicated entries. */
  function parseEntries(text, existing, cap) {
    var parts = String(text || '').split(/[,\n;]+/);
    var added = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].replace(/\s+/g, ' ').trim().toLowerCase();
      if (s.length < 2 || s.length > 40) continue;
      if (existing.indexOf(s) !== -1 || added.indexOf(s) !== -1) continue;
      added.push(s);
      if (existing.length + added.length >= cap) break;
    }
    return added;
  }

  /* ---------------- Chip inputs ---------------- */

  function renderChips(host, list, onRemove) {
    if (!host) return;
    host.innerHTML = '';
    host.style.display = list.length ? 'flex' : 'none';
    list.forEach(function (name) {
      var chip = el('span', 'nnp-chip');
      chip.appendChild(el('span', 'nnp-chip-name', name));
      var x = el('button', 'nnp-chip-x', '✕');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ' + name);
      x.addEventListener('click', function () { onRemove(name); });
      chip.appendChild(x);
      host.appendChild(chip);
    });
  }

  function renderIngredients() {
    renderChips(els.ingChips, ingredients, function (name) {
      ingredients = ingredients.filter(function (x) { return x !== name; });
      renderIngredients();
      saveForm();
    });
    if (els.pantryBtn) {
      var have = pantryItems();
      // Only offer the shortcut when it would actually add something.
      var useful = have.filter(function (x) { return ingredients.indexOf(x) === -1; });
      els.pantryBtn.style.display = useful.length ? '' : 'none';
      els.pantryBtn.textContent = '🧺 Use my pantry (' + useful.length + ')';
    }
  }

  function renderAllergies() {
    renderChips(els.algChips, allergies, function (name) {
      allergies = allergies.filter(function (x) { return x !== name; });
      renderAllergies();
      saveForm();
    });
  }

  /** What Pantry Mode currently holds, if that tool is on the page. */
  function pantryItems() {
    try {
      if (w.NNPantry && typeof w.NNPantry.get === 'function') return w.NNPantry.get();
    } catch (e) { /* pantry not mounted */ }
    return [];
  }

  /* ---------------- Option pill groups ---------------- */

  function pillGroup(host, key, options, onChange) {
    host.innerHTML = '';
    host.setAttribute('role', 'radiogroup');
    options.forEach(function (opt) {
      var b = el('button', 'nnf-chip nnc-opt', opt.label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.value = opt.value;
      var on = form[key] === opt.value;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      if (on) b.classList.add('active');
      b.addEventListener('click', function () {
        form[key] = opt.value;
        Array.prototype.forEach.call(host.children, function (c) {
          var sel = c.dataset.value === opt.value;
          c.classList.toggle('active', sel);
          c.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
        saveForm();
        if (onChange) onChange(opt.value);
      });
      host.appendChild(b);
    });
  }

  /* ---------------- Shopping list ---------------- */

  /* The generator marks each ingredient with fromPantry, but that is its
     opinion, not a fact — a model that flags everything as "you have it"
     would produce an empty shopping list. So the question is put to Pantry
     Mode instead, one ingredient at a time, and answered by exactly the same
     matcher that decides which curated recipes you can cook tonight. That
     buys the whole synonym, modifier and derivative vocabulary for free:
     "greek yogurt" satisfies "yogurt", but "coconut" does not satisfy
     "coconut milk".

     When Pantry Mode is not on the page the fallback is a plain token
     overlap, which is coarser but never wrong in a dangerous way — at worst
     it lists something you already own. */

  function isStaple(name) {
    try {
      if (w.NNPantry && typeof w.NNPantry.isStaple === 'function') {
        return !!w.NNPantry.isStaple(name);
      }
    } catch (e) { /* fall through */ }
    return /^(salt|pepper|water|oil|olive oil|cooking spray)$/.test(
      String(name || '').toLowerCase().trim());
  }

  function pantryMatcher() {
    try {
      if (w.NNPantry && typeof w.NNPantry.match === 'function') return w.NNPantry.match;
    } catch (e) { /* not mounted */ }
    return null;
  }

  /** Coarse fallback: the significant words of a name. */
  function simpleTokens(text) {
    return String(text || '').toLowerCase().split(/[^a-z]+/)
      .filter(function (t) { return t.length > 2; });
  }

  function shoppingList(recipe) {
    var match = pantryMatcher();
    var out = [];

    var haveTokens = null;
    if (!match) {
      haveTokens = {};
      ingredients.forEach(function (line) {
        simpleTokens(line).forEach(function (t) { haveTokens[t] = 1; });
      });
    }

    (recipe.ingredients || []).forEach(function (ing) {
      if (isStaple(ing.item)) return;          // assumed in every kitchen

      if (match) {
        // A one-line recipe: missing comes back empty when the pantry covers it.
        var m = match({ ingredients: [ing.item] }, ingredients);
        if (m && m.missing && m.missing.length === 0 && m.total > 0) return;
        if (m && m.total === 0) return;        // the matcher treated it as a staple
        out.push(ing);
        return;
      }

      var toks = simpleTokens(ing.item);
      var covered = toks.length > 0 && toks.some(function (t) { return haveTokens[t]; });
      if (!covered) out.push(ing);
    });

    return out;
  }

  /* ---------------- Rendering the recipe ---------------- */

  function statBlock(value, label) {
    var box = el('div', 'nnc-stat');
    box.appendChild(el('div', 'nnc-stat-val', value));
    box.appendChild(el('div', 'nnc-stat-label', label));
    return box;
  }

  function renderRecipe(recipe, opts) {
    opts = opts || {};
    current = recipe;
    currentSavedId = opts.savedId || null;

    // The recipe is now the current one whether or not there is anywhere to
    // draw it — the public API and the action buttons work off `current`.
    var box = els.result;
    if (!box) return null;
    box.innerHTML = '';
    box.classList.add('show');

    /* Header */
    var head = el('div', 'nnc-rx-head');
    head.appendChild(el('div', 'nnc-rx-emoji', recipe.emoji || '🍽️'));
    var headText = el('div', 'nnc-rx-headtext');
    headText.appendChild(el('span', 'nnc-badge', '✨ AI Generated Recipe'));
    headText.appendChild(el('h4', 'nnc-rx-title', recipe.title));
    if (recipe.description) headText.appendChild(el('p', 'nnc-rx-desc', recipe.description));
    var tags = el('div', 'nnc-rx-tags');
    tags.appendChild(el('span', 'nnc-tag', titleCase(recipe.category || 'meal')));
    tags.appendChild(el('span', 'nnc-tag', (opts.spec && opts.spec.diet) || form.diet));
    if (opts.difficulty || form.difficulty) {
      tags.appendChild(el('span', 'nnc-tag', opts.difficulty || form.difficulty));
    }
    headText.appendChild(tags);
    head.appendChild(headText);
    box.appendChild(head);

    /* Times and servings */
    var times = el('div', 'nnc-stats');
    times.appendChild(statBlock(minutesLabel(recipe.prepMinutes), 'Prep'));
    times.appendChild(statBlock(minutesLabel(recipe.cookMinutes), 'Cook'));
    times.appendChild(statBlock(minutesLabel(recipe.totalMinutes), 'Total'));
    times.appendChild(statBlock(String(recipe.servings), recipe.servings === 1 ? 'Serving' : 'Servings'));
    box.appendChild(times);

    /* Nutrition, per serving */
    var macros = el('div', 'nnc-stats nnc-macros');
    macros.appendChild(statBlock(recipe.calories + ' cal', 'Calories'));
    macros.appendChild(statBlock(recipe.protein + ' g', 'Protein'));
    macros.appendChild(statBlock(recipe.carbs + ' g', 'Carbs'));
    macros.appendChild(statBlock(recipe.fat + ' g', 'Fat'));
    box.appendChild(macros);

    var estimate = el('p', 'nnc-rx-note',
      'Nutrition is an estimate per serving, not a lab measurement — treat it as a guide.');
    box.appendChild(estimate);

    /* Ingredients */
    box.appendChild(el('h5', 'nnc-rx-h', 'Ingredients'));
    var ul = el('ul', 'nnc-ing');
    recipe.ingredients.forEach(function (ing) {
      var li = el('li', ing.fromPantry ? 'nnc-ing-have' : 'nnc-ing-need');
      li.appendChild(el('span', 'nnc-ing-mark', ing.fromPantry ? '✓' : '+'));
      var body = el('span', 'nnc-ing-body');
      if (ing.quantity) body.appendChild(el('strong', null, ing.quantity + ' '));
      body.appendChild(d.createTextNode(ing.item));
      li.appendChild(body);
      ul.appendChild(li);
    });
    box.appendChild(ul);

    /* Shopping list for what is genuinely missing */
    var missing = shoppingList(recipe);
    var shop = el('div', 'nnc-shop');
    if (missing.length) {
      shop.appendChild(el('h5', 'nnc-rx-h', '🛒 Shopping list'));
      shop.appendChild(el('p', 'nnc-shop-sub',
        missing.length + (missing.length === 1 ? ' item' : ' items') + ' to pick up. Everything else you already have.'));
      var sul = el('ul', 'nnp-list');
      missing.forEach(function (ing, i) {
        var li = d.createElement('li');
        var id = 'nnc-shop-' + i;
        var cb = d.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        var lab = d.createElement('label');
        lab.setAttribute('for', id);
        lab.textContent = (ing.quantity ? ing.quantity + ' ' : '') + ing.item;
        li.appendChild(cb);
        li.appendChild(lab);
        sul.appendChild(li);
      });
      shop.appendChild(sul);
    } else {
      shop.appendChild(el('h5', 'nnc-rx-h', '🛒 Shopping list'));
      shop.appendChild(el('p', 'nnc-shop-sub', 'Nothing to buy — this uses only what you already have.'));
    }
    box.appendChild(shop);

    /* Method */
    box.appendChild(el('h5', 'nnc-rx-h', 'Method'));
    var ol = el('ol', 'nnc-steps');
    recipe.steps.forEach(function (s) { ol.appendChild(el('li', null, s)); });
    box.appendChild(ol);

    /* Tips and substitutions */
    if (recipe.tips && recipe.tips.length) {
      box.appendChild(el('h5', 'nnc-rx-h', '💡 Tips & substitutions'));
      var tl = el('ul', 'nnc-tips');
      recipe.tips.forEach(function (t) { tl.appendChild(el('li', null, t)); });
      box.appendChild(tl);
    }
    if (recipe.note) box.appendChild(el('p', 'nnc-rx-note', recipe.note));

    box.appendChild(renderActions());

    /* A plain-language reminder of what this is, at the bottom where it is
       read after the recipe rather than dismissed before it. */
    box.appendChild(el('p', 'nnc-disclaimer',
      'Written by AI from what you entered. It is not one of our tested recipes — ' +
      'check it over before you cook, especially if you have allergies.'));

    return box;
  }

  function renderActions() {
    var row = el('div', 'nnc-actions');

    els.saveBtn = el('button', 'nnf-go nnc-save');
    els.saveBtn.type = 'button';
    els.saveBtn.textContent = currentSavedId ? '✓ Saved'
      : needsLogin ? '🔐 Log in to save' : '💾 Save to My Recipes';
    if (currentSavedId) els.saveBtn.disabled = true;
    els.saveBtn.addEventListener('click', onSave);
    row.appendChild(els.saveBtn);

    var print = el('button', 'nnf-chip', '🖨️ Print');
    print.type = 'button';
    print.addEventListener('click', onPrint);
    row.appendChild(print);

    els.shareBtn = el('button', 'nnf-chip', '🔗 Share');
    els.shareBtn.type = 'button';
    els.shareBtn.addEventListener('click', onShare);
    row.appendChild(els.shareBtn);

    var again = el('button', 'nnf-chip', '🔄 Generate another version');
    again.type = 'button';
    again.addEventListener('click', function () { generate(true); });
    row.appendChild(again);

    return row;
  }

  /* ---------------- Refusal ---------------- */

  function renderRefusal(problem, suggestions) {
    current = null;
    var box = els.result;
    if (!box) return;
    box.innerHTML = '';
    box.classList.add('show');

    var panel = el('div', 'nnc-refuse');
    panel.appendChild(el('div', 'nnc-refuse-ico', '🤔'));
    panel.appendChild(el('h4', 'nnc-refuse-title', 'That combination will not work yet'));
    panel.appendChild(el('p', 'nnc-refuse-why', problem));

    if (suggestions && suggestions.length) {
      panel.appendChild(el('p', 'nnc-refuse-lead', 'Try one of these:'));
      var ul = el('ul', 'nnc-refuse-list');
      suggestions.forEach(function (s) { ul.appendChild(el('li', null, s)); });
      panel.appendChild(ul);
    }

    var retry = el('button', 'nnf-go', 'Adjust and try again');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      if (els.ingInput) els.ingInput.focus();
      if (els.formCard && els.formCard.scrollIntoView) {
        els.formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    panel.appendChild(retry);

    box.appendChild(panel);
  }

  /* ---------------- Generate ---------------- */

  function setBusy(on, message) {
    busy = on;
    if (els.go) {
      els.go.disabled = on;
      els.go.textContent = on ? 'Creating…' : '✨ Generate Recipe';
    }
    if (els.status) {
      els.status.textContent = message || '';
      els.status.classList.toggle('thinking', !!on);
    }
  }

  function skeleton() {
    var box = els.result;
    if (!box) return;
    box.innerHTML = '';
    box.classList.add('show');
    var sk = el('div', 'nnc-skel');
    sk.appendChild(el('div', 'nnf-skel-line'));
    sk.appendChild(el('div', 'nnf-skel-line'));
    sk.appendChild(el('div', 'nnf-skel-line'));
    sk.appendChild(el('div', 'nnf-skel-line'));
    box.appendChild(sk);
  }

  function currentSpec() {
    return {
      ingredients: ingredients.slice(),
      diet: form.diet,
      allergies: allergies.slice(),
      mealType: form.mealType,
      maxMinutes: form.maxMinutes,
      targetCalories: form.targetCalories,
      proteinGoal: form.proteinGoal,
      difficulty: form.difficulty,
    };
  }

  function generate(another, isRetry) {
    if (busy) return;
    if (!w.NNAuth || typeof w.NNAuth.generateRecipe !== 'function') {
      setBusy(false, 'The recipe service is not available right now.');
      return;
    }

    var spec = currentSpec();
    // Only exclude past titles when the person explicitly wants a different
    // take — otherwise a fresh visit is needlessly constrained.
    if (another && seenTitles.length) spec.avoidTitles = seenTitles.slice(-6);
    lastSpec = spec;

    setBusy(true, another ? 'Writing a different version…' : 'Writing your recipe…');
    skeleton();

    w.NNAuth.generateRecipe(spec).then(function (res) {
      setBusy(false, '');

      if (!res.ok) {
        var msg = res.reason === 'not_configured'
          ? 'The recipe writer is not switched on yet. Please try again later.'
          : res.reason === 'network'
            ? 'Could not reach the recipe writer — check your connection and try again.'
            : 'Something went wrong writing that recipe. Please try again.';
        renderRefusal(msg, []);
        return;
      }

      if (res.feasible === false) {
        // A refusal on "another version" is suspicious: the very same inputs
        // produced a recipe moments ago, so what changed is the request for
        // something different — and asking for variety can talk the model
        // into declining. Drop that one constraint and ask again, plainly.
        // A repeated idea is a far better answer than a false "this cannot
        // be done" for a combination we know works.
        if (another && !isRetry) {
          generate(false, true);
          return;
        }
        renderRefusal(
          res.problem || 'These inputs do not make a workable recipe.',
          res.suggestions || []);
        return;
      }

      seenTitles.push(res.recipe.title);
      if (seenTitles.length > 12) seenTitles.shift();
      renderRecipe(res.recipe, { spec: spec, difficulty: spec.difficulty });
      if (els.result && els.result.scrollIntoView) {
        els.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, function () {
      setBusy(false, '');
      renderRefusal('Something went wrong writing that recipe. Please try again.', []);
    });
  }

  /* ---------------- Actions ---------------- */

  var needsLogin = false;   // set once a save has failed for want of an account

  function onSave() {
    if (!current || !els.saveBtn || currentSavedId) return;

    // Second press after "log in to save" takes them there, keeping the
    // recipe in place so it is still on screen when they come back.
    if (needsLogin) { w.location.href = 'login.html'; return; }

    var btn = els.saveBtn;
    btn.disabled = true;
    btn.textContent = 'Saving…';

    w.NNAuth.saveAiRecipe(current, lastSpec).then(function (res) {
      btn.disabled = false;
      if (res.ok) {
        currentSavedId = res.id;
        btn.disabled = true;
        btn.textContent = '✓ Saved';
        loadSaved();
        return;
      }
      if (/log in/i.test(res.message || '')) {
        needsLogin = true;
        btn.textContent = '🔐 Log in to save';
        return;
      }
      btn.textContent = 'Could not save — retry';
    }, function () {
      btn.disabled = false;
      btn.textContent = 'Could not save — retry';
    });
  }

  /** Plain-text version, used by both Print and Share. */
  function asText(r) {
    var lines = [];
    lines.push(r.title);
    lines.push('✨ AI Generated Recipe — Nourish N Narrate');
    if (r.description) lines.push('', r.description);
    lines.push('', 'Prep ' + minutesLabel(r.prepMinutes) +
      '  ·  Cook ' + minutesLabel(r.cookMinutes) +
      '  ·  Total ' + minutesLabel(r.totalMinutes) +
      '  ·  Serves ' + r.servings);
    lines.push('Per serving: ' + r.calories + ' cal · ' + r.protein + ' g protein · ' +
      r.carbs + ' g carbs · ' + r.fat + ' g fat');
    lines.push('', 'INGREDIENTS');
    r.ingredients.forEach(function (i) {
      lines.push('  • ' + (i.quantity ? i.quantity + ' ' : '') + i.item);
    });
    lines.push('', 'METHOD');
    r.steps.forEach(function (s, i) { lines.push('  ' + (i + 1) + '. ' + s); });
    if (r.tips && r.tips.length) {
      lines.push('', 'TIPS');
      r.tips.forEach(function (t) { lines.push('  • ' + t); });
    }
    return lines.join('\n');
  }

  function onPrint() {
    if (!current) return;
    var r = current;
    var win = w.open('', '_blank', 'width=720,height=860');
    if (!win) {
      // Almost always a pop-up blocker. Say so rather than doing nothing.
      if (els.status) {
        els.status.textContent = 'Allow pop-ups for this site to print.';
        setTimeout(function () { els.status.textContent = ''; }, 3000);
      }
      return;
    }

    // Built with the DOM rather than a string so nothing in the recipe can be
    // read as markup.
    var doc = win.document;
    doc.title = r.title;
    var style = doc.createElement('style');
    style.textContent =
      'body{font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:36px 28px;' +
      'line-height:1.65;color:#0f172a}' +
      'h1{font-size:26px;margin:0 0 4px}' +
      '.badge{display:inline-block;font-family:system-ui,sans-serif;font-size:11px;' +
      'font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#065f46;' +
      'background:#ecfdf5;padding:4px 10px;border-radius:99px;margin-bottom:14px}' +
      '.desc{font-style:italic;color:#475569;margin:0 0 18px}' +
      '.meta{font-family:system-ui,sans-serif;font-size:13px;color:#475569;' +
      'border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:10px 0;margin:0 0 22px}' +
      'h2{font-family:system-ui,sans-serif;font-size:14px;letter-spacing:.06em;' +
      'text-transform:uppercase;color:#059669;margin:26px 0 8px}' +
      'li{margin:0 0 7px}ol{padding-left:22px}ul{padding-left:20px}' +
      '.foot{font-family:system-ui,sans-serif;font-size:11px;color:#64748b;' +
      'margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px}';
    doc.head.appendChild(style);

    function add(tag, cls, text) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      doc.body.appendChild(n);
      return n;
    }
    add('div', 'badge', '✨ AI Generated Recipe · Nourish N Narrate');
    add('h1', null, r.title);
    if (r.description) add('p', 'desc', r.description);
    add('p', 'meta',
      'Prep ' + minutesLabel(r.prepMinutes) + '  ·  Cook ' + minutesLabel(r.cookMinutes) +
      '  ·  Total ' + minutesLabel(r.totalMinutes) + '  ·  Serves ' + r.servings +
      '  ·  ' + r.calories + ' cal, ' + r.protein + ' g protein, ' +
      r.carbs + ' g carbs, ' + r.fat + ' g fat per serving');

    add('h2', null, 'Ingredients');
    var ul = doc.createElement('ul');
    r.ingredients.forEach(function (i) {
      var li = doc.createElement('li');
      li.textContent = (i.quantity ? i.quantity + ' ' : '') + i.item;
      ul.appendChild(li);
    });
    doc.body.appendChild(ul);

    add('h2', null, 'Method');
    var ol = doc.createElement('ol');
    r.steps.forEach(function (s) {
      var li = doc.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });
    doc.body.appendChild(ol);

    if (r.tips && r.tips.length) {
      add('h2', null, 'Tips & substitutions');
      var tl = doc.createElement('ul');
      r.tips.forEach(function (t) {
        var li = doc.createElement('li');
        li.textContent = t;
        tl.appendChild(li);
      });
      doc.body.appendChild(tl);
    }

    add('p', 'foot', 'Written by AI from ingredients you entered. Nutrition figures are ' +
      'estimates. nourishnnarrate6-cmyk.github.io/nourish-n-narrate');

    doc.close();
    win.focus();
    win.print();
  }

  function onShare() {
    if (!current) return;
    var btn = els.shareBtn;
    var text = asText(current);

    if (w.navigator && w.navigator.share) {
      w.navigator.share({ title: current.title, text: text }).catch(function () {
        // Cancelling the share sheet lands here too — nothing to report.
      });
      return;
    }
    copyText(text, function (ok) {
      btn.textContent = ok ? '✓ Copied' : 'Copy blocked';
      setTimeout(function () { btn.textContent = '🔗 Share'; }, 1800);
    });
  }

  function copyText(text, done) {
    if (w.navigator.clipboard && w.navigator.clipboard.writeText) {
      w.navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { fallbackCopy(text, done); });
      return;
    }
    fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    var ta = d.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    d.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
    d.body.removeChild(ta);
    done(ok);
  }

  /* ---------------- Saved recipes ---------------- */

  function loadSaved() {
    if (!els.saved || !w.NNAuth || typeof w.NNAuth.getAiRecipes !== 'function') return;
    w.NNAuth.getAiRecipes().then(renderSaved, function () { renderSaved([]); });
  }

  function renderSaved(rows) {
    var host = els.saved;
    if (!host) return;
    host.innerHTML = '';

    if (!rows || !rows.length) {
      host.style.display = 'none';
      return;
    }
    host.style.display = '';

    var head = el('h5', 'nnc-rx-h', 'My AI Recipes (' + rows.length + ')');
    host.appendChild(head);
    host.appendChild(el('p', 'nnc-shop-sub',
      'Saved to your account only. These stay separate from the site’s tested recipes.'));

    var list = el('div', 'nnc-saved-list');
    rows.forEach(function (row) {
      var item = el('div', 'nnc-saved');

      var open = el('button', 'nnc-saved-open');
      open.type = 'button';
      open.appendChild(el('span', 'nnc-saved-emoji', (row.payload && row.payload.emoji) || '🍽️'));
      var meta = el('span', 'nnc-saved-meta');
      meta.appendChild(el('span', 'nnc-saved-title', row.title));
      var p = row.payload || {};
      meta.appendChild(el('span', 'nnc-saved-sub',
        [p.calories ? p.calories + ' cal' : null,
          p.protein ? p.protein + ' g protein' : null,
          p.totalMinutes ? minutesLabel(p.totalMinutes) : null]
          .filter(Boolean).join(' · ')));
      open.appendChild(meta);
      open.addEventListener('click', function () {
        if (!row.payload) return;
        renderRecipe(row.payload, { savedId: row.id, spec: row.spec });
        if (els.result && els.result.scrollIntoView) {
          els.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      item.appendChild(open);

      var del = el('button', 'nnc-saved-del', '🗑');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete ' + row.title);
      del.addEventListener('click', function () {
        del.disabled = true;
        w.NNAuth.deleteAiRecipe(row.id).then(function (res) {
          if (res.ok) {
            if (currentSavedId === row.id) currentSavedId = null;
            loadSaved();
          } else {
            del.disabled = false;
          }
        }, function () { del.disabled = false; });
      });
      item.appendChild(del);

      list.appendChild(item);
    });
    host.appendChild(list);
  }

  /* ---------------- Mount ---------------- */

  function slider(id, label, min, max, step, key, fmt) {
    var wrap = el('div', 'nnc-field');
    var lab = el('label', 'nnc-label');
    lab.setAttribute('for', id);
    lab.appendChild(d.createTextNode(label));
    var out = el('span', 'nnc-value', fmt(form[key]));
    lab.appendChild(out);
    wrap.appendChild(lab);

    var input = d.createElement('input');
    input.type = 'range';
    input.className = 'nnc-range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(form[key]);
    input.addEventListener('input', function () {
      form[key] = Number(input.value);
      out.textContent = fmt(form[key]);
    });
    input.addEventListener('change', saveForm);
    wrap.appendChild(input);
    return wrap;
  }

  function mount() {
    var host = d.getElementById('nn-creator');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';

    loadForm();

    host.innerHTML =
      '<div class="nnf-head">' +
        '<span class="nnf-badge">✨ AI Recipe Creator</span>' +
        '<h3 class="nnf-title">Tell us what you have. We’ll write the recipe.</h3>' +
        '<p class="nnf-sub">A brand-new healthy recipe built around your ingredients, ' +
          'your time and your targets — with a shopping list for anything missing.</p>' +
      '</div>' +
      '<div class="nnc-form" id="nnc-form">' +

        '<div class="nnc-field nnc-field-wide">' +
          '<label class="nnc-label" for="nnc-ing">What do you have?' +
            '<span class="nnc-value nnc-optional">optional</span></label>' +
          '<form class="nnf-bar nnc-bar" id="nnc-ing-form">' +
            '<span class="nnf-icon" aria-hidden="true">🥕</span>' +
            '<input type="text" id="nnc-ing" autocomplete="off" ' +
              'placeholder="eggs, spinach, feta, tomatoes…" ' +
              'aria-label="Ingredients you already have" />' +
            '<button class="nnf-go" type="submit">Add</button>' +
          '</form>' +
          '<div class="nnp-chips" id="nnc-ing-chips" style="display:none;"></div>' +
          '<button type="button" class="nnf-chip nnf-chip-ghost nnc-pantry" id="nnc-pantry" style="display:none;"></button>' +
        '</div>' +

        '<div class="nnc-field nnc-field-wide">' +
          '<label class="nnc-label" for="nnc-alg">Allergies to avoid' +
            '<span class="nnc-value nnc-optional">optional</span></label>' +
          '<form class="nnf-bar nnc-bar" id="nnc-alg-form">' +
            '<span class="nnf-icon" aria-hidden="true">⚠️</span>' +
            '<input type="text" id="nnc-alg" autocomplete="off" ' +
              'placeholder="peanuts, dairy, gluten…" ' +
              'aria-label="Allergies to avoid" />' +
            '<button class="nnf-go" type="submit">Add</button>' +
          '</form>' +
          '<div class="nnp-chips" id="nnc-alg-chips" style="display:none;"></div>' +
        '</div>' +

        '<div class="nnc-field"><span class="nnc-label">Diet</span>' +
          '<div class="nnf-chips nnc-pills" id="nnc-diet"></div></div>' +
        '<div class="nnc-field"><span class="nnc-label">Meal</span>' +
          '<div class="nnf-chips nnc-pills" id="nnc-meal"></div></div>' +
        '<div class="nnc-field nnc-field-wide"><span class="nnc-label">Difficulty</span>' +
          '<div class="nnf-chips nnc-pills" id="nnc-diff"></div></div>' +

        '<div class="nnc-sliders" id="nnc-sliders"></div>' +
      '</div>' +

      '<div class="nnc-go-row">' +
        '<button class="nnf-go nnc-generate" type="button" id="nnc-go">✨ Generate Recipe</button>' +
      '</div>' +
      '<p class="nnf-status" id="nnc-status" aria-live="polite"></p>' +
      '<div class="nnc-result" id="nnc-result" aria-live="polite"></div>' +
      '<div class="nnc-saved-wrap" id="nnc-saved" style="display:none;"></div>';

    els.formCard = d.getElementById('nnc-form');
    els.ingInput = d.getElementById('nnc-ing');
    els.ingChips = d.getElementById('nnc-ing-chips');
    els.algInput = d.getElementById('nnc-alg');
    els.algChips = d.getElementById('nnc-alg-chips');
    els.pantryBtn = d.getElementById('nnc-pantry');
    els.status = d.getElementById('nnc-status');
    els.result = d.getElementById('nnc-result');
    els.saved = d.getElementById('nnc-saved');
    els.go = d.getElementById('nnc-go');

    d.getElementById('nnc-ing-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var added = parseEntries(els.ingInput.value, ingredients, MAX_ING);
      if (added.length) ingredients = ingredients.concat(added);
      els.ingInput.value = '';
      renderIngredients();
      saveForm();
    });

    d.getElementById('nnc-alg-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var added = parseEntries(els.algInput.value, allergies, MAX_ALLERGY);
      if (added.length) allergies = allergies.concat(added);
      els.algInput.value = '';
      renderAllergies();
      saveForm();
    });

    els.pantryBtn.addEventListener('click', function () {
      pantryItems().forEach(function (item) {
        if (ingredients.length < MAX_ING && ingredients.indexOf(item) === -1) {
          ingredients.push(item);
        }
      });
      renderIngredients();
      saveForm();
    });

    pillGroup(d.getElementById('nnc-diet'), 'diet', [
      { value: 'Vegetarian', label: '🌱 Vegetarian' },
      { value: 'Non-Vegetarian', label: '🍗 Non-Vegetarian' },
    ]);
    pillGroup(d.getElementById('nnc-meal'), 'mealType', [
      { value: 'breakfast', label: 'Breakfast' },
      { value: 'lunch', label: 'Lunch' },
      { value: 'dinner', label: 'Dinner' },
      { value: 'snack', label: 'Snack' },
    ]);
    pillGroup(d.getElementById('nnc-diff'), 'difficulty', [
      { value: 'Easy', label: 'Easy' },
      { value: 'Medium', label: 'Medium' },
      { value: 'Hard', label: 'Hard' },
    ]);

    var sl = d.getElementById('nnc-sliders');
    sl.appendChild(slider('nnc-time', 'Max cook time', 10, 120, 5, 'maxMinutes', minutesLabel));
    sl.appendChild(slider('nnc-cal', 'Target calories', 150, 1200, 25, 'targetCalories',
      function (v) { return v + ' cal'; }));
    sl.appendChild(slider('nnc-pro', 'Protein goal', 0, 60, 5, 'proteinGoal',
      function (v) { return v + ' g'; }));

    els.go.addEventListener('click', function () { generate(false); });

    renderIngredients();
    renderAllergies();
    loadSaved();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
  else mount();

  /* Pantry Mode may mount after us; refresh the shortcut when it changes. */
  w.addEventListener('recipesLoaded', function () { mount(); renderIngredients(); });

  /* Public API — small on purpose. The form is the interface. */
  w.NNCreator = {
    mount: mount,
    /** generate() for a fresh recipe, generate({ another: true }) to ask for
        a different take on the same inputs. */
    generate: function (opts) { return generate(!!(opts && opts.another)); },
    setIngredients: function (list) {
      ingredients = [];
      var added = parseEntries((list || []).join(','), ingredients, MAX_ING);
      ingredients = added;
      renderIngredients();
      saveForm();
    },
    getIngredients: function () { return ingredients.slice(); },
    setAllergies: function (list) {
      allergies = parseEntries((list || []).join(','), [], MAX_ALLERGY);
      renderAllergies();
      saveForm();
    },
    getAllergies: function () { return allergies.slice(); },
    set: function (key, value) {
      if (!(key in form)) return false;
      form[key] = value;
      saveForm();
      return true;
    },
    spec: currentSpec,
    shoppingList: shoppingList,
    asText: asText,
    current: function () { return current; },
    refreshSaved: loadSaved,
  };
})(window, document);
