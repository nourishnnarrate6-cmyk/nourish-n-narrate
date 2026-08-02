/* ===================================================================
   NOURISH N NARRATE — PANTRY MODE

   Tell it what is in your kitchen; it ranks the recipes you can
   actually cook tonight. Every result comes from the existing RECIPES
   array and every card is built by buildRecipeCard(), so nothing is
   invented and no recipe data is duplicated.

   ---------------------------------------------------------------
   HOW MATCHING WORKS

   Each ingredient line is reduced once to a small set of canonical
   food tokens, then two ingredients match when they share one:

     pantry "chicken"       → {chicken}
     recipe "Chicken breast"→ {chicken, breast}      shared → match

   Three rules stop that being too loose or too strict:

   • Synonyms  — "garbanzo beans" and "chickpeas" reduce to the same
     token, as do capsicum/bell pepper, cilantro/coriander, and so on.
   • Modifiers — "baby", "fresh", "ground", colours and sizes are
     dropped, so "baby spinach" and "spinach" match in both directions.
   • Derivatives — "milk", "butter", "oil", "flour" and friends must be
     present on BOTH sides. Coconut does not cover coconut milk, and
     peanuts do not cover peanut butter.

   Quantities are deliberately ignored. If a recipe wants two eggs and
   you say you have eggs, you have eggs. Quantity tracking can be added
   later without touching any of this.

   Staples — salt, pepper, water, oils and dried spices, about a fifth
   of every ingredient line in the database — are assumed present and
   excluded from both the percentage and the shopping list. They are
   matched by exact canonical name, never by substring: matching
   loosely made "bell peppers" disappear into "pepper".

   ---------------------------------------------------------------
   PERFORMANCE

   Parsing happens ONCE, into an index rebuilt only when the recipe
   list changes. Ranking then walks precomputed token arrays, so it
   stays fast as the database grows past a few hundred recipes.

   Requires: RECIPES (recipes-data-supabase.js) and buildRecipeCard()
   (nn-cards.js). Load this after both.
=================================================================== */
(function (w, d) {
  'use strict';

  var NN_STORE = 'nnAssistant';   // shared with nn-finder.js
  var MAX_RESULTS = 12;
  var GOOD_MATCH = 0.5;

  /* Assumed in every kitchen. Matched on the exact canonical name. */
  var STAPLES = {};
  ('salt|pepper|black pepper|sea salt|water|cold water|warm water|oil|olive oil|' +
   'vegetable oil|sesame oil|coconut oil|mustard oil|olive oil spray|cooking spray|' +
   'vinegar|rice vinegar|sugar|baking powder|cornstarch|cornflour|cumin|cumin powder|' +
   'cumin seeds|paprika|smoked paprika|turmeric|oregano|cinnamon|chili powder|cayenne|' +
   'coriander powder|garam masala|garlic powder|onion powder|cardamom|bay leaves|cloves|' +
   'ajwain|chaat masala|kashmiri chili powder|biryani masala|chole masala|amchur|' +
   'salt pepper'
  ).split('|').forEach(function (s) { STAPLES[s] = 1; });
  // Deliberately NOT staples: vanilla extract, soy sauce, worcestershire and
  // rice vinegar. Dried spices live in most kitchens; a bottle of soy sauce
  // is a real purchase, and hiding it from the shopping list would be wrong.

  /* Whole-name equivalents, applied before anything else. */
  var PHRASE_SYNONYMS = [
    [/\bgarbanzo beans?\b/g, 'chickpeas'],
    [/\bcapsicum\b/g, 'bell pepper'],
    [/\bscallions?\b/g, 'green onion'],
    [/\bspring onions?\b/g, 'green onion'],
    [/\bcilantro\b/g, 'coriander'],
    [/\byoghurt\b/g, 'yogurt'],
    [/\bcurd\b/g, 'yogurt'],
    [/\bdahi\b/g, 'yogurt'],
    [/\baubergines?\b/g, 'eggplant'],
    [/\bbrinjals?\b/g, 'eggplant'],
    [/\bcourgettes?\b/g, 'zucchini'],
    [/\brocket\b/g, 'arugula'],
    [/\bprawns?\b/g, 'shrimp'],
    [/\bmince\b/g, 'ground meat'],
    [/\bcoriander leaves\b/g, 'coriander'],
    [/\bgreek yogurt\b/g, 'yogurt'],
    [/\bmaida\b/g, 'flour'],
    [/\bbesan\b/g, 'chickpea flour'],
    [/\bpaneer\b/g, 'paneer'],
  ];

  /* Words that describe rather than name. Dropped from token sets so
     "baby spinach" and "spinach" match, in both directions. */
  var MODIFIERS = {};
  ('baby|fresh|frozen|dried|ground|whole|plain|natural|unsweetened|raw|cooked|uncooked|' +
   'lean|extra|low|fat|nonfat|reduced|light|firm|shelled|mixed|ripe|large|small|medium|' +
   'thin|thick|chopped|sliced|diced|minced|grated|shredded|crushed|roasted|toasted|' +
   'boneless|skinless|red|green|yellow|white|purple|dark|sweet|hot|mild|of|and|or|the'
  ).split('|').forEach(function (s) { MODIFIERS[s] = 1; });

  /* A product made FROM something else. Required on both sides, so
     "coconut" never covers "coconut milk". */
  var DERIVATIVES = {};
  // "juice" is deliberately absent — if you have a lemon you can squeeze it.
  ('milk|butter|oil|powder|sauce|paste|broth|stock|extract|flour|syrup|vinegar|' +
   'crumbs|breadcrumbs|spray'
  ).split('|').forEach(function (s) { DERIVATIVES[s] = 1; });

  /* Anything here is left out of "cheap ingredients that unlock recipes". */
  var PRICEY = {};
  ('salmon|cod|shrimp|paneer|saffron|cashews|pine|tahini|parmesan|feta|' +
   'protein|powder|almond|walnuts|pistachios'
  ).split('|').forEach(function (s) { PRICEY[s] = 1; });

  var EMOJI = {
    chicken: '🍗', turkey: '🦃', beef: '🥩', salmon: '🐟', tuna: '🐟', cod: '🐟',
    fish: '🐟', shrimp: '🍤', egg: '🥚', milk: '🥛', yogurt: '🥣', cheese: '🧀',
    paneer: '🧀', butter: '🧈', rice: '🍚', quinoa: '🍚', oats: '🥣', bread: '🍞',
    toast: '🍞', pasta: '🍝', noodles: '🍜', tortillas: '🌯', roti: '🫓', potato: '🥔',
    tomato: '🍅', onion: '🧅', garlic: '🧄', ginger: '🫚', carrot: '🥕', broccoli: '🥦',
    spinach: '🥬', kale: '🥬', lettuce: '🥬', cabbage: '🥬', cucumber: '🥒',
    zucchini: '🥒', avocado: '🥑', pepper: '🫑', corn: '🌽', mushrooms: '🍄',
    beans: '🫘', lentils: '🫘', chickpeas: '🫘', edamame: '🫛', tofu: '🧊',
    banana: '🍌', apple: '🍎', berries: '🫐', strawberries: '🍓', mango: '🥭',
    lemon: '🍋', lime: '🍋', cherries: '🍒', honey: '🍯', peanut: '🥜',
    chocolate: '🍫', cocoa: '🍫', celery: '🥬', peas: '🫛',
  };

  /* ---------- small helpers ---------- */

  function recipeList() {
    try {
      if (typeof RECIPES !== 'undefined' && Array.isArray(RECIPES)) return RECIPES;
    } catch (e) { /* not loaded yet */ }
    return Array.isArray(w.RECIPES) ? w.RECIPES : [];
  }

  function norm(s) { return String(s || '').toLowerCase().trim(); }

  function stem(t) {
    if (t.length > 3 && t.slice(-3) === 'ies') return t.slice(0, -3) + 'y';
    if (t.length > 4 && t.slice(-2) === 'es') return t.slice(0, -2);
    if (t.length > 3 && t.slice(-1) === 's') return t.slice(0, -1);
    return t;
  }

  function num(v) {
    var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  }

  function minutesOf(recipe) {
    var m = String(recipe.time || '').match(/(\d+)/);
    if (!m) return null;
    var mins = parseInt(m[1], 10);
    if (/overnight/i.test(recipe.time || '')) mins += 480;
    return mins;
  }

  function collectionsOf(recipe) {
    if (Array.isArray(recipe.collections) && recipe.collections.length) return recipe.collections;
    var out = [recipe.type === 'non-veg' ? 'Non-Vegetarian' : 'Vegetarian'];
    var p = num(recipe.protein) || 0;
    var k = num(recipe.calories) || 0;
    if (p >= 15 && (p >= 20 || (k > 0 && (p * 4) / k >= 0.20))) out.push('High Protein');
    return out;
  }

  function title(s) {
    return String(s).replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  /* ---------- ingredient parsing ---------- */

  var UNITS = {};
  ('cup|cups|tbsp|tbsps|tablespoon|tablespoons|tsp|tsps|teaspoon|teaspoons|lb|lbs|pound|' +
   'pounds|oz|ounce|ounces|g|gram|grams|kg|ml|l|litre|liter|can|cans|jar|jars|packet|' +
   'packets|bunch|bunches|clove|cloves|handful|handfuls|scoop|scoops|slice|slices|piece|' +
   'pieces|stalk|stalks|head|heads|sprig|sprigs|pinch|dash|each|about|approx'
  ).split('|').forEach(function (s) { UNITS[s] = 1; });

  var TRAILING = {};
  ('drained|rinsed|halved|cubed|peeled|trimmed|thawed|optional|divided|packed|softened|' +
   'melted|beaten|finely|roughly|thinly|taste|serve|top|finish|garnish|topping|dipping|' +
   'removed|stems|seeded|needed|loosen'
  ).split('|').forEach(function (s) { TRAILING[s] = 1; });

  /**
   * Reduce one ingredient line to a bare food name.
   *   "Chicken breast – 1 lb, cubed"            → "chicken breast"
   *   "1 tbsp olive oil"                        → "olive oil"
   *   "2 cans (15 oz each) chickpeas, drained"  → "chickpeas"
   *   "Juice of 1 lime"                         → "lime"
   *   "4 cups chopped kale or Swiss chard"      → "kale"
   */
  function foodName(line) {
    var s = norm(line);

    var dash = s.search(/[–—]| - /);
    if (dash !== -1) s = s.slice(0, dash);

    s = s.replace(/\([^)]*\)/g, ' ');
    s = s.replace(/^(juice|zest|pinch)\s+of\s+/, '');
    s = s.replace(/^optional\s*:\s*/, '');
    s = s.split(/\s+or\s+/)[0];

    // Cut at a comma only when what precedes it already names a food, so
    // "1½ lbs boneless, skinless chicken thighs" does not become "boneless".
    var head = s.split(',')[0];
    if (head.replace(/[^a-z]/g, '').length > 3 &&
        !/\b(boneless|lean|low-fat|whole|fresh|frozen|plain)\s*$/.test(head)) {
      s = head;
    }

    s = s.replace(/[¼½¾⅓⅔⅛]/g, ' ');
    s = s.replace(/\d+([./]\d+)?/g, ' ');
    s = s.replace(/[^a-z\s-]/g, ' ');

    PHRASE_SYNONYMS.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });

    var out = s.split(/\s+/).filter(function (t) {
      return t && !UNITS[t] && !TRAILING[t] &&
        t !== 'of' && t !== 'or' && t !== 'and' && t !== 'the' && t !== 'a';
    });

    // Drop leading adjectives so the food itself comes first.
    while (out.length > 1 && MODIFIERS[out[0]]) out.shift();

    return out.slice(0, 2).join(' ').trim();
  }

  /** Is this line marked optional? Optional things are not "missing". */
  function isOptional(line) {
    return /\boptional\b/i.test(String(line));
  }

  /** Canonical food tokens for a name, with the derivatives it involves. */
  function tokenize(name) {
    var s = norm(name);
    PHRASE_SYNONYMS.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });

    var tokens = [];
    var deriv = [];
    s.split(/[\s-]+/).forEach(function (raw) {
      if (!raw) return;
      var t = stem(raw.replace(/[^a-z]/g, ''));
      if (!t || t.length < 2) return;
      if (DERIVATIVES[t]) {
        if (deriv.indexOf(t) === -1) deriv.push(t);
        if (tokens.indexOf(t) === -1) tokens.push(t);
        return;
      }
      if (MODIFIERS[t]) return;
      if (tokens.indexOf(t) === -1) tokens.push(t);
    });

    // A name that is nothing but modifiers keeps its last word.
    if (!tokens.length) {
      var last = stem(s.split(/\s+/).pop().replace(/[^a-z]/g, ''));
      if (last) tokens.push(last);
    }
    return { tokens: tokens, deriv: deriv };
  }

  /* Words whose plural names a vegetable while the singular names a spice.
     "pepper" is the seasoning; "peppers" are the thing you slice up. */
  var PLURAL_IS_FOOD = { pepper: 1, chili: 1, clove: 1 };

  function isStaple(name) {
    var n = norm(name);
    if (STAPLES[n]) return true;

    var tokens = tokenize(n).tokens;
    if (tokens.length === 1 && PLURAL_IS_FOOD[tokens[0]] && /s\s*$/.test(n)) return false;

    // Compare on the canonical form so "cumin seeds" also resolves.
    return !!STAPLES[tokens.join(' ')];
  }

  /** Does a pantry entry cover a required ingredient? */
  function covers(pantryTok, reqTok) {
    var shared = false;
    for (var i = 0; i < reqTok.tokens.length; i++) {
      if (pantryTok.tokens.indexOf(reqTok.tokens[i]) !== -1) { shared = true; break; }
    }
    if (!shared) return false;
    // Every derivative the recipe needs must also be in the pantry entry.
    for (var j = 0; j < reqTok.deriv.length; j++) {
      if (pantryTok.tokens.indexOf(reqTok.deriv[j]) === -1) return false;
    }
    return true;
  }

  /* ---------- index (parse once) ---------- */

  var idx = { source: null, size: 0, entries: [], vocab: null };

  function buildIndex() {
    var list = recipeList();
    if (idx.source === list && idx.size === list.length) return idx.entries;

    idx.entries = list.map(function (recipe, index) {
      var lines = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      var seen = {};
      var req = [];
      lines.forEach(function (line) {
        if (isOptional(line)) return;             // optional is never "missing"
        var name = foodName(line);
        if (!name || name.length < 3) return;
        if (isStaple(name)) return;
        if (seen[name]) return;
        seen[name] = 1;
        var tk = tokenize(name);
        req.push({ name: name, label: title(name), tokens: tk.tokens, deriv: tk.deriv });
      });
      return {
        recipe: recipe,
        index: index,
        req: req,
        cols: collectionsOf(recipe),
        mins: minutesOf(recipe),
        kcal: num(recipe.calories),
        prot: num(recipe.protein),
      };
    });

    idx.source = list;
    idx.size = list.length;
    idx.vocab = null;
    return idx.entries;
  }

  /**
   * Turn raw pantry strings into token sets once per query.
   *
   * Staples are dropped here. They are already assumed, so counting them
   * again adds nothing — and it actively misleads: "pepper" (the seasoning)
   * would otherwise satisfy "bell peppers" and overstate what you can cook.
   * The chip stays on screen; it just does not earn credit.
   */
  function tokenizePantry(pantryItems) {
    var out = [];
    for (var i = 0; i < pantryItems.length; i++) {
      if (isStaple(pantryItems[i])) continue;
      out.push(tokenize(pantryItems[i]));
    }
    return out;
  }

  /* ---------- matching ---------- */

  function matchEntry(entry, pantryTok) {
    var have = [];
    var missing = [];
    for (var i = 0; i < entry.req.length; i++) {
      var req = entry.req[i];
      var hit = false;
      for (var j = 0; j < pantryTok.length; j++) {
        if (covers(pantryTok[j], req)) { hit = true; break; }
      }
      (hit ? have : missing).push(req.label);
    }
    var total = entry.req.length;
    return {
      recipe: entry.recipe,
      index: entry.index,
      have: have,
      missing: missing,
      total: total,
      pct: total ? have.length / total : 1,
    };
  }

  /** Public single-recipe match, for tests and future callers. */
  function matchRecipe(recipe, pantryItems) {
    var lines = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    var seen = {};
    var req = [];
    lines.forEach(function (line) {
      if (isOptional(line)) return;
      var name = foodName(line);
      if (!name || name.length < 3 || isStaple(name) || seen[name]) return;
      seen[name] = 1;
      var tk = tokenize(name);
      req.push({ name: name, label: title(name), tokens: tk.tokens, deriv: tk.deriv });
    });
    return matchEntry({ recipe: recipe, index: -1, req: req }, tokenizePantry(pantryItems));
  }

  function passesFilters(entry, f) {
    if (f.diet && entry.cols.indexOf(f.diet) === -1) return false;
    if (f.collection && entry.cols.indexOf(f.collection) === -1) return false;
    if (f.meal && entry.recipe.category !== f.meal) return false;
    if (f.maxMinutes && (entry.mins == null || entry.mins > f.maxMinutes)) return false;
    if (f.maxCalories && (entry.kcal == null || entry.kcal > f.maxCalories)) return false;
    if (f.minProtein && (entry.prot == null || entry.prot < f.minProtein)) return false;
    return true;
  }

  /**
   * Ranking score. Coverage and missing count dominate — that is what
   * people actually care about — and the rest only breaks ties.
   */
  function scoreOf(m, entry, favorites) {
    var s = (m.pct * 10) - (m.missing.length * 1.6);
    if (favorites.indexOf(m.recipe.title) !== -1) s += 2;
    if (entry.cols.indexOf('High Protein') !== -1) s += 0.8;
    if (entry.mins != null) s += Math.max(0, (60 - entry.mins) / 60) * 0.6;
    if (entry.kcal != null) s += Math.max(0, (600 - entry.kcal) / 600) * 0.4;
    // Ready for a popularity column if one is ever added.
    s += (Number(m.recipe.popularity) || 0) * 0.5;
    return s;
  }

  function rank(pantryItems, filters) {
    filters = filters || {};
    var entries = buildIndex();
    var pantryTok = tokenizePantry(pantryItems || []);
    var favorites = (profile().favorites || []);
    var out = [];

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!passesFilters(entry, filters)) continue;
      var m = matchEntry(entry, pantryTok);
      m.score = scoreOf(m, entry, favorites);
      out.push(m);
    }

    out.sort(function (a, b) { return b.score - a.score; });

    var good = out.filter(function (m) { return m.pct >= GOOD_MATCH; });
    return {
      exact: good.length > 0,
      results: (good.length ? good : out).slice(0, MAX_RESULTS),
    };
  }

  /**
   * Which cheap ingredient would unlock the most recipes? Counts the
   * recipes that are missing exactly one thing, so the number shown is
   * literally true rather than a guess.
   */
  function unlockSuggestions(pantryItems, filters, limit) {
    filters = filters || {};
    var entries = buildIndex();
    var pantryTok = tokenizePantry(pantryItems || []);
    var tally = {};

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!passesFilters(entry, filters)) continue;
      var m = matchEntry(entry, pantryTok);
      if (m.missing.length !== 1) continue;
      var name = m.missing[0];
      var tokens = tokenize(name).tokens;
      var cheap = tokens.every(function (t) { return !PRICEY[t]; });
      if (!cheap) continue;
      tally[name] = (tally[name] || 0) + 1;
    }

    return Object.keys(tally)
      .map(function (name) { return { name: name, unlocks: tally[name] }; })
      .sort(function (a, b) { return b.unlocks - a.unlocks; })
      .slice(0, limit || 3);
  }

  /** Every distinct ingredient, most-used first — powers auto-complete. */
  function vocabulary() {
    var entries = buildIndex();
    if (idx.vocab) return idx.vocab;
    var count = {};
    var label = {};
    entries.forEach(function (e) {
      e.req.forEach(function (r) {
        count[r.name] = (count[r.name] || 0) + 1;
        label[r.name] = r.label;
      });
    });
    idx.vocab = Object.keys(count)
      .sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); })
      .map(function (k) { return { name: k, label: label[k], uses: count[k] }; });
    return idx.vocab;
  }

  function emojiFor(name) {
    var tokens = tokenize(name).tokens;
    for (var i = 0; i < tokens.length; i++) {
      if (EMOJI[tokens[i]]) return EMOJI[tokens[i]];
    }
    return '🥗';
  }

  /* ---------- storage ---------- */

  function profile() {
    try {
      var raw = w.localStorage.getItem(NN_STORE);
      var p = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(p.pantry)) p.pantry = [];
      if (!Array.isArray(p.favorites)) p.favorites = [];
      return p;
    } catch (e) { return { pantry: [], favorites: [] }; }
  }

  function saveProfile(p) {
    try { w.localStorage.setItem(NN_STORE, JSON.stringify(p)); } catch (e) { /* private mode */ }
  }

  var pantry = [];

  function loadPantry() { pantry = profile().pantry || []; }

  function persistPantry() {
    var p = profile();
    p.pantry = pantry;
    saveProfile(p);
  }

  var MAX_ITEM_LEN = 40;   // keeps a pasted paragraph from becoming one chip

  function addItems(text) {
    String(text).split(/[,\n]/).forEach(function (raw) {
      var item = norm(raw).replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
      if (item.length < 2) return;
      if (item.length > MAX_ITEM_LEN) item = item.slice(0, MAX_ITEM_LEN).trim();
      if (pantry.indexOf(item) !== -1) return;
      pantry.push(item);
    });
    persistPantry();
  }

  function removeItem(item) {
    var at = pantry.indexOf(item);
    if (at !== -1) pantry.splice(at, 1);
    persistPantry();
  }

  function clearPantry() { pantry = []; persistPantry(); }

  /* ---------- UI ---------- */

  var els = {};
  var filters = {};
  var runToken = 0;

  var FILTER_CHIPS = [
    ['🌱 Vegetarian', 'diet', 'Vegetarian'],
    ['🍗 Non-Veg', 'diet', 'Non-Vegetarian'],
    ['💪 High Protein', 'collection', 'High Protein'],
    ['Breakfast', 'meal', 'breakfast'],
    ['Lunch', 'meal', 'lunch'],
    ['Dinner', 'meal', 'dinner'],
    ['Snack', 'meal', 'snack'],
  ];

  var NUM_CHIPS = [
    ['≤ 20 min', 'maxMinutes', 20],
    ['≤ 30 min', 'maxMinutes', 30],
    ['≤ 400 cal', 'maxCalories', 400],
    ['20 g+ protein', 'minProtein', 20],
  ];

  function button(label, cls, onClick) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderChips() {
    if (!els.chips) return;
    els.chips.innerHTML = '';
    if (!pantry.length) {
      els.chips.style.display = 'none';
      els.clear.style.display = 'none';
      return;
    }
    els.chips.style.display = '';
    els.clear.style.display = '';

    pantry.forEach(function (item) {
      var chip = d.createElement('span');
      chip.className = 'nnp-chip';
      chip.innerHTML = '<span class="nnp-chip-emoji" aria-hidden="true">' + emojiFor(item) + '</span>' +
        '<span class="nnp-chip-name"></span>';
      chip.querySelector('.nnp-chip-name').textContent = title(item);
      var x = d.createElement('button');
      x.type = 'button';
      x.className = 'nnp-chip-x';
      x.setAttribute('aria-label', 'Remove ' + item);
      x.textContent = '✕';
      x.addEventListener('click', function () {
        chip.classList.add('leaving');
        setTimeout(function () { removeItem(item); renderChips(); runMatch(); }, 180);
      });
      chip.appendChild(x);
      els.chips.appendChild(chip);
    });
  }

  /* Auto-complete state. Kept here so the keyboard handler and the
     renderer agree on which option is highlighted. */
  var sugHits = [];
  var sugActive = -1;

  function closeSuggestions() {
    if (!els.suggest) return;
    els.suggest.style.display = 'none';
    els.input.setAttribute('aria-expanded', 'false');
    els.input.removeAttribute('aria-activedescendant');
    sugHits = [];
    sugActive = -1;
  }

  function highlightSuggestion(next) {
    if (!sugHits.length) return;
    sugActive = (next + sugHits.length) % sugHits.length;
    var nodes = els.suggest.children;
    for (var i = 0; i < nodes.length; i++) {
      var on = i === sugActive;
      nodes[i].classList.toggle('active', on);
      nodes[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        els.input.setAttribute('aria-activedescendant', nodes[i].id);
        if (nodes[i].scrollIntoView) nodes[i].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function chooseSuggestion(i) {
    var v = sugHits[i];
    if (!v) return;
    addItems(v.name);
    els.input.value = '';
    closeSuggestions();
    renderChips();
    runMatch();
  }

  /** Auto-complete: exact prefixes first, then contains, commonest first. */
  function renderSuggestions(query) {
    if (!els.suggest) return;
    var q = norm(query);
    els.suggest.innerHTML = '';
    if (q.length < 2) { closeSuggestions(); return; }

    var starts = [];
    var contains = [];
    vocabulary().forEach(function (v) {
      if (pantry.indexOf(v.name) !== -1) return;
      var at = v.name.indexOf(q);
      if (at === 0) starts.push(v);
      else if (at > 0) contains.push(v);
    });
    sugHits = starts.concat(contains).slice(0, 6);
    sugActive = -1;

    if (!sugHits.length) { closeSuggestions(); return; }

    els.suggest.style.display = '';
    els.input.setAttribute('aria-expanded', 'true');

    sugHits.forEach(function (v, i) {
      var b = button(emojiFor(v.name) + '  ' + v.label, 'nnp-suggest-item', function () {
        chooseSuggestion(i);
      });
      b.id = 'nnp-opt-' + i;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.addEventListener('mousemove', function () { highlightSuggestion(i); });
      var badge = d.createElement('span');
      badge.className = 'nnp-suggest-uses';
      badge.textContent = v.uses + (v.uses === 1 ? ' recipe' : ' recipes');
      b.appendChild(badge);
      els.suggest.appendChild(b);
    });
  }

  function showSkeletons(n) {
    els.results.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var s = d.createElement('div');
      s.className = 'nnf-skel';
      s.innerHTML = '<div class="nnf-skel-img"></div><div class="nnf-skel-body">' +
        '<div class="nnf-skel-line"></div><div class="nnf-skel-line short"></div>' +
        '<div class="nnf-skel-chips"><span></span><span></span><span></span></div></div>';
      els.results.appendChild(s);
    }
  }

  /** The match strip under each recipe card. */
  function matchPanel(m) {
    var box = d.createElement('div');
    box.className = 'nnp-match';

    if (!m.missing.length) {
      var done = d.createElement('p');
      done.className = 'nnp-match-all';
      done.textContent = '🎉 You already have everything needed!';
      box.appendChild(done);
      return box;
    }

    var head = d.createElement('p');
    head.className = 'nnp-match-head';
    head.textContent = '✅ ' + m.have.length + ' of ' + m.total + ' ingredients available';
    box.appendChild(head);

    var bar = d.createElement('div');
    bar.className = 'nnp-bar';
    var fill = d.createElement('div');
    fill.className = 'nnp-bar-fill';
    fill.style.width = Math.round(m.pct * 100) + '%';
    bar.appendChild(fill);
    box.appendChild(bar);

    // Colour-coded: green ticks for what you have, amber crosses for what you need.
    var pills = d.createElement('div');
    pills.className = 'nnp-pills';
    m.have.slice(0, 3).forEach(function (n) {
      var s = d.createElement('span');
      s.className = 'nnp-pill nnp-pill-have';
      s.textContent = '✓ ' + n;
      pills.appendChild(s);
    });
    m.missing.slice(0, 4).forEach(function (n) {
      var s = d.createElement('span');
      s.className = 'nnp-pill nnp-pill-need';
      s.textContent = '✗ ' + n;
      pills.appendChild(s);
    });
    if (m.missing.length > 4) {
      var more = d.createElement('span');
      more.className = 'nnp-pill nnp-pill-need';
      more.textContent = '+' + (m.missing.length - 4) + ' more';
      pills.appendChild(more);
    }
    box.appendChild(pills);

    box.appendChild(button('🛒 Generate shopping list', 'nnp-list-btn', function () { openList(m); }));
    return box;
  }

  function renderUnlocks() {
    if (!els.unlock) return;
    els.unlock.innerHTML = '';
    if (!pantry.length) return;

    var sugg = unlockSuggestions(pantry, filters, 3);
    if (!sugg.length) return;

    var label = d.createElement('span');
    label.className = 'nnf-recent-label';
    label.textContent = 'Add one more';
    els.unlock.appendChild(label);

    sugg.forEach(function (s) {
      els.unlock.appendChild(button(
        emojiFor(s.name) + '  ' + s.name + ' · unlocks ' + s.unlocks,
        'nnf-chip nnf-chip-ghost',
        function () {
          addItems(s.name);
          renderChips();
          runMatch();
        }));
    });
  }

  /* ---------- shopping list ---------- */

  function openList(m) {
    els.modalTitle.textContent = m.recipe.title;
    els.modalBody.innerHTML = '';

    var h = d.createElement('p');
    h.className = 'nnp-modal-sub';
    h.textContent = 'Missing ingredients';
    els.modalBody.appendChild(h);

    var ul = d.createElement('ul');
    ul.className = 'nnp-list';
    m.missing.forEach(function (name) {
      var li = d.createElement('li');
      var id = 'nnp-i-' + Math.random().toString(36).slice(2, 8);
      var cb = d.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      var lab = d.createElement('label');
      lab.setAttribute('for', id);
      lab.textContent = name;
      li.appendChild(cb);
      li.appendChild(lab);
      ul.appendChild(li);
    });
    els.modalBody.appendChild(ul);

    var note = d.createElement('p');
    note.className = 'nnp-modal-note';
    note.textContent = 'Basic salt, oil and dried spices are assumed and not listed.';
    els.modalBody.appendChild(note);

    els.modal.dataset.text = 'Shopping list — ' + m.recipe.title + '\n\n' +
      m.missing.map(function (x) { return '[ ] ' + x; }).join('\n');
    els.modal.classList.add('open');

    // Move focus into the dialog and remember where to send it back.
    lastFocused = d.activeElement;
    var closeBtn = d.getElementById('nnp-modal-x');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
  }

  var lastFocused = null;

  function closeList() {
    if (!els.modal || !els.modal.classList.contains('open')) return;
    els.modal.classList.remove('open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  /** Keep Tab inside the dialog while it is open. */
  function trapFocus(e) {
    if (e.key !== 'Tab' || !els.modal || !els.modal.classList.contains('open')) return;
    var focusable = els.modal.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function copyList() {
    var text = els.modal.dataset.text || '';
    var done = function () {
      els.copyBtn.textContent = '✓ Copied';
      setTimeout(function () { els.copyBtn.textContent = '📋 Copy'; }, 1600);
    };
    if (w.navigator.clipboard && w.navigator.clipboard.writeText) {
      w.navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
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
    if (ok) { done(); return; }
    // Never fail silently — say what happened and leave the list on screen.
    els.copyBtn.textContent = 'Copy blocked';
    setTimeout(function () { els.copyBtn.textContent = '📋 Copy'; }, 2200);
  }

  function printList() {
    var text = els.modal.dataset.text || '';
    var win = w.open('', '_blank', 'width=460,height=640');
    if (!win) {
      // Almost always a pop-up blocker. Tell the user rather than doing nothing.
      var btn = d.getElementById('nnp-print');
      if (btn) {
        btn.textContent = 'Allow pop-ups to print';
        setTimeout(function () { btn.textContent = '🖨️ Print'; }, 2600);
      }
      return;
    }
    win.document.write(
      '<title>Shopping list</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:28px;line-height:1.9;color:#0f172a}' +
      'h1{font-size:18px;margin:0 0 16px}li{list-style:none;margin:0 0 6px}' +
      'span{display:inline-block;width:14px;height:14px;border:1.5px solid #64748b;' +
      'border-radius:3px;margin-right:10px;vertical-align:-2px}</style>' +
      '<h1>' + els.modalTitle.textContent + '</h1><ul>' +
      text.split('\n').slice(2).map(function (l) {
        return '<li><span></span>' + l.replace('[ ] ', '') + '</li>';
      }).join('') + '</ul>');
    win.document.close();
    win.focus();
    win.print();
  }

  /* ---------- run ---------- */

  function runMatch() {
    if (!els.results || !els.status) return;
    var mine = ++runToken;

    if (!pantry.length) {
      els.status.textContent = '';
      els.results.innerHTML = '';
      if (els.unlock) els.unlock.innerHTML = '';
      return;
    }

    if (typeof buildRecipeCard !== 'function') {
      // nn-cards.js failed to load. Say so rather than leaving a blank panel.
      els.status.textContent = 'Recipe cards couldn’t load — please refresh the page.';
      els.results.innerHTML = '';
      return;
    }

    // Only show the loading state when there is nothing on screen yet.
    // Ranking takes well under a millisecond, so flashing skeletons on every
    // added ingredient would be pure flicker.
    var firstRun = !els.results.children.length;
    if (firstRun) {
      els.status.textContent = 'Checking what you can make…';
      showSkeletons(3);
    }

    setTimeout(function () {
      if (mine !== runToken) return;
      var out = rank(pantry, filters);
      els.results.innerHTML = '';

      if (!out.results.length) {
        els.status.textContent = 'We couldn’t find a recipe with your current pantry, ' +
          'but these are the closest healthy options.';
        var all = recipeList();
        all.slice(0, 6).forEach(function (r, i) { els.results.appendChild(buildRecipeCard(r, i)); });
        renderUnlocks();
        return;
      }

      els.status.textContent = out.exact
        ? 'You can make ' + out.results.length +
          (out.results.length === 1 ? ' recipe' : ' recipes') + ' with what you have.'
        : 'We couldn’t find a recipe with your current pantry, but these are the closest healthy options.';

      out.results.forEach(function (m, n) {
        var card = buildRecipeCard(m.recipe, m.index);
        card.classList.add('nnf-in');
        card.style.animationDelay = (n * 45) + 'ms';
        card.appendChild(matchPanel(m));
        els.results.appendChild(card);
      });

      renderUnlocks();
    }, firstRun ? 240 : 0);
  }

  function renderFilters() {
    if (!els.filters) return;
    els.filters.innerHTML = '';
    FILTER_CHIPS.concat(NUM_CHIPS).forEach(function (f) {
      var active = filters[f[1]] === f[2];
      var cls = 'nnf-chip' + (f[2] === 20 || f[2] === 30 || f[2] === 400 ? ' nnf-chip-ghost' : '');
      els.filters.appendChild(button(f[0], cls + (active ? ' nnf-chip-solid' : ''), function () {
        filters[f[1]] = active ? null : f[2];
        renderFilters();
        runMatch();
      }));
    });
  }

  function mount() {
    var host = d.getElementById('nn-pantry');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';

    host.innerHTML =
      '<div class="nnf-head">' +
        '<span class="nnf-badge">🧺 Pantry Mode</span>' +
        '<h3 class="nnf-title">What’s in your kitchen right now?</h3>' +
        '<p class="nnf-sub">Add what you already have and we’ll rank the recipes you can cook ' +
          'tonight — with a shopping list for anything missing.</p>' +
      '</div>' +
      '<div class="nnp-inputwrap">' +
        '<form class="nnf-bar" id="nnp-form">' +
          '<span class="nnf-icon" aria-hidden="true">🧺</span>' +
          '<input type="search" id="nnp-input" autocomplete="off" ' +
            'placeholder="chicken, rice, broccoli, garlic…" ' +
            'aria-label="Add pantry ingredients" role="combobox" ' +
            'aria-autocomplete="list" aria-expanded="false" aria-controls="nnp-suggest" />' +
          '<button class="nnf-go" type="submit">Add</button>' +
        '</form>' +
        '<div class="nnp-suggest" id="nnp-suggest" role="listbox" ' +
          'aria-label="Ingredient suggestions" style="display:none;"></div>' +
      '</div>' +
      '<div class="nnp-chips" id="nnp-chips" style="display:none;"></div>' +
      '<div class="nnf-chips" id="nnp-filters"></div>' +
      '<p class="nnf-status" id="nnp-status" aria-live="polite"></p>' +
      '<div class="nnf-suggest" id="nnp-unlock"></div>' +
      '<div class="recipe-grid nnf-results" id="nnp-results"></div>' +
      '<div class="nnf-foot"><button type="button" class="nnf-clear" id="nnp-clear" style="display:none;">Clear pantry</button></div>' +
      '<div class="nnp-modal-overlay" id="nnp-modal" role="dialog" aria-modal="true" aria-labelledby="nnp-modal-title">' +
        '<div class="nnp-modal">' +
          '<button class="nnp-modal-x" id="nnp-modal-x" type="button" aria-label="Close">✕</button>' +
          '<h4 class="nnp-modal-title" id="nnp-modal-title"></h4>' +
          '<div id="nnp-modal-body"></div>' +
          '<div class="nnp-modal-actions">' +
            '<button type="button" class="nnf-chip" id="nnp-copy">📋 Copy</button>' +
            '<button type="button" class="nnf-chip" id="nnp-print">🖨️ Print</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    els.input = d.getElementById('nnp-input');
    els.chips = d.getElementById('nnp-chips');
    els.suggest = d.getElementById('nnp-suggest');
    els.filters = d.getElementById('nnp-filters');
    els.status = d.getElementById('nnp-status');
    els.unlock = d.getElementById('nnp-unlock');
    els.results = d.getElementById('nnp-results');
    els.clear = d.getElementById('nnp-clear');
    els.modal = d.getElementById('nnp-modal');
    els.modalTitle = d.getElementById('nnp-modal-title');
    els.modalBody = d.getElementById('nnp-modal-body');
    els.copyBtn = d.getElementById('nnp-copy');

    d.getElementById('nnp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      // Enter with a suggestion highlighted takes that suggestion.
      if (sugActive >= 0) { chooseSuggestion(sugActive); return; }
      var v = els.input.value.trim();
      if (!v) return;
      addItems(v);
      els.input.value = '';
      closeSuggestions();
      renderChips();
      runMatch();
    });

    els.input.addEventListener('input', function () { renderSuggestions(els.input.value); });
    els.input.addEventListener('blur', function () {
      setTimeout(closeSuggestions, 160);
    });

    // Full keyboard control of the suggestion list.
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeSuggestions(); return; }
      if (!sugHits.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlightSuggestion(sugActive + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlightSuggestion(sugActive - 1); }
      else if (e.key === 'Home') { e.preventDefault(); highlightSuggestion(0); }
      else if (e.key === 'End') { e.preventDefault(); highlightSuggestion(sugHits.length - 1); }
    });

    els.clear.addEventListener('click', function () {
      clearPantry();
      renderChips();
      els.results.innerHTML = '';
      els.unlock.innerHTML = '';
      els.status.textContent = '';
      els.input.focus();
    });

    d.getElementById('nnp-modal-x').addEventListener('click', closeList);
    els.modal.addEventListener('click', function (e) { if (e.target === els.modal) closeList(); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeList();
      trapFocus(e);
    });
    els.copyBtn.addEventListener('click', copyList);
    d.getElementById('nnp-print').addEventListener('click', printList);

    loadPantry();
    renderFilters();
    renderChips();
    if (pantry.length) runMatch();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
  else mount();
  w.addEventListener('recipesLoaded', function () {
    idx.source = null;          // recipes arrived — rebuild the index
    mount();
    if (pantry.length) runMatch();
  });

  /* Public API. The add* hooks are the seams for barcode, photo and voice
     input later — each only has to hand a plain ingredient string to
     addItems() and everything downstream already works. */
  w.NNPantry = {
    get: function () { return pantry.slice(); },
    set: function (items) { pantry = []; addItems(items); renderChips(); runMatch(); },
    add: function (text) { addItems(text); renderChips(); runMatch(); },
    remove: function (item) { removeItem(item); renderChips(); runMatch(); },
    clear: function () { clearPantry(); renderChips(); runMatch(); },
    setFilter: function (key, value) { filters[key] = value; renderFilters(); runMatch(); },
    match: matchRecipe,
    rank: rank,
    unlockSuggestions: unlockSuggestions,
    foodName: foodName,
    isStaple: isStaple,
    tokenize: tokenize,
    vocabulary: function () { return vocabulary().map(function (v) { return v.label; }); },
    vocabularyDetailed: vocabulary,
    /* Future input methods — all funnel into the same addItems(). */
    addFromBarcode: function (name) { return this.add(name); },
    addFromPhoto: function (names) { return this.add((names || []).join(',')); },
    addFromVoice: function (phrase) { return this.add(phrase); },
  };
})(window, document);
