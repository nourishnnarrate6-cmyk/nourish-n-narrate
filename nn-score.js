/* ===================================================================
   NOURISH N NARRATE — NUTRITION SCORE

   One number out of 100 for how nourishing a recipe is per serving,
   plus the reasons behind it in plain language.

   ---------------------------------------------------------------
   WHY IT IS CALCULATED, NOT STORED

   The score is derived from the recipe data we already hold, every
   time a card is drawn. Nothing is written to the database. That
   means a recipe added tomorrow is scored the moment it appears, and
   correcting a protein figure corrects the score with it — there is
   no second copy to fall out of step.

   ---------------------------------------------------------------
   WHAT IT IS BUILT FROM

   The database gives us calories, protein, fibre and fat per serving,
   and the ingredient list. It does NOT give us sugar, sodium or
   saturated fat. Rather than pretend otherwise, the last three
   factors read the ingredient list for the things that drive them —
   syrups and sugars, salty items, and the difference between whole
   foods and refined ones.

   That is an honest estimate, not a lab analysis, and the wording
   shown to visitors says so.

   ---------------------------------------------------------------
   THE SIX FACTORS                                       max points

     Protein          how much of the calories come from protein   20
     Fibre            fibre per 100 calories                       20
     Whole foods      share of ingredients that are unprocessed    20
     Fat quality      sensible amount, from good sources           15
     Added sugar      starts full, comes down for each sweetener   15
     Sodium           starts full, comes down for each salty item  10
                                                                  ---
                                                                  100

   Everything is measured per serving and per calorie, so a large
   dinner is not punished for being large and a small snack cannot
   win simply by being small.

   Public API (window.NNScore):
     score(recipe)     — { total, band, label, color, factors[], summary }
     of(recipe)        — just the number, memoised
     band(total)       — { key, label, color, emoji }
     sort(list, dir)   — indices sorted by score
=================================================================== */
(function (w) {
  'use strict';

  /* ---------------- Ingredient vocabulary ----------------
     Deliberately small and readable. Each list answers one question
     about a line of the ingredient list. Matching is done on whole
     words so "sugar snap peas" is not read as sugar. */

  /* Sweeteners, worst first. The number is how many points that line
     costs, so a spoon of honey is treated more gently than sugar. */
  var SWEETENERS = [
    ['brown sugar', 5], ['white sugar', 5], ['caster sugar', 5], ['icing sugar', 5],
    ['powdered sugar', 5], ['corn syrup', 6], ['sugar', 5],
    ['golden syrup', 5], ['syrup', 4], ['agave', 4], ['jaggery', 4],
    ['honey', 3], ['maple', 3], ['molasses', 3],
    ['chocolate chips', 3], ['white chocolate', 4], ['milk chocolate', 4],
    ['sweetened', 4], ['condensed milk', 5],
  ];

  /* Whole fruit is sweet but comes with fibre — never penalised. */
  var WHOLE_SWEET = ['date', 'dates', 'banana', 'apple', 'berries', 'raisins', 'fruit'];

  /* Phrases where a sweetener word is part of something that is not a
     sweetener at all. Sugar snap peas are a vegetable. Checked before the
     sweetener list so the line is skipped entirely. */
  var NOT_SWEET = ['sugar snap', 'sugar free', 'sugarfree', 'snap peas'];

  /* Salty items. Salt itself is mild because almost every savoury
     recipe uses a pinch; the processed sources cost more. */
  var SALTY = [
    ['soy sauce', 3], ['fish sauce', 3], ['bacon', 3], ['salami', 3], ['pepperoni', 3],
    ['ham', 2], ['sausage', 2], ['olives', 2], ['pickle', 2], ['pickles', 2],
    ['capers', 2], ['feta', 2], ['parmesan', 2], ['halloumi', 2],
    ['broth', 2], ['stock', 2], ['bouillon', 3], ['canned', 1],
    ['cheese', 1], ['salt', 1],
  ];

  /* Fats that improve the picture, and fats that do not. */
  var GOOD_FATS = [
    'olive oil', 'avocado', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio',
    'peanut', 'seeds', 'seed', 'tahini', 'salmon', 'sardine', 'mackerel',
    'flaxseed', 'chia', 'nuts', 'nut butter',
  ];
  var HEAVY_FATS = [
    'butter', 'ghee', 'lard', 'cream', 'heavy cream', 'coconut oil',
    'palm oil', 'shortening', 'mayonnaise', 'mayo',
  ];

  /* Refined staples. Their whole-grain counterparts are handled by
     WHOLE below, and are checked first so "whole wheat flour" counts
     as whole rather than refined. */
  var REFINED = [
    'all-purpose', 'all purpose', 'white flour', 'plain flour', 'white rice',
    'white bread', 'white pasta', 'semolina', 'cornflour', 'corn flour',
    'crackers', 'chips', 'puff pastry', 'processed', 'instant noodles',
  ];

  var WHOLE_GRAINS = [
    'whole wheat', 'wholewheat', 'whole grain', 'wholegrain', 'oats', 'oat',
    'quinoa', 'brown rice', 'barley', 'millet', 'buckwheat', 'farro',
    'bulgur', 'rye', 'whole', 'sourdough',
  ];

  /* Foods that are whole by nature — produce, legumes, plain proteins,
     plain dairy, herbs and spices. Used to work out what share of a
     recipe is real food rather than packaged food. */
  var WHOLE_FOODS = [
    'spinach', 'kale', 'lettuce', 'broccoli', 'cauliflower', 'carrot', 'celery',
    'tomato', 'tomatoes', 'onion', 'garlic', 'ginger', 'pepper', 'peppers',
    'cucumber', 'zucchini', 'courgette', 'aubergine', 'eggplant', 'mushroom',
    'mushrooms', 'cabbage', 'beet', 'squash', 'pumpkin', 'sweet potato',
    'potato', 'peas', 'corn', 'asparagus', 'green beans', 'leek', 'scallion',
    'herbs', 'basil', 'cilantro', 'coriander', 'parsley', 'mint', 'dill',
    'cumin', 'turmeric', 'paprika', 'cinnamon', 'chili', 'chilli', 'spice',
    'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'blueberries',
    'strawberries', 'raspberries', 'mango', 'avocado', 'date', 'dates',
    'lentil', 'lentils', 'chickpeas', 'beans', 'black beans', 'kidney beans',
    'tofu', 'tempeh', 'edamame',
    'chicken', 'turkey', 'beef', 'lamb', 'pork', 'fish', 'salmon', 'tuna',
    'shrimp', 'prawn', 'egg', 'eggs',
    'yogurt', 'yoghurt', 'greek yogurt', 'milk', 'paneer', 'cottage cheese',
    'almond', 'walnut', 'cashew', 'seeds', 'seed', 'quinoa', 'oats', 'rice',
    'water', 'olive oil',
  ];

  /* ---------------- Text helpers ---------------- */

  function norm(line) {
    return String(line || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Whole-word containment, so "pepper" does not fire inside "peppercorn"
      and "sugar" does not fire inside "sugar snap peas" (checked by the
      caller passing the full phrase). */
  function has(text, term) {
    var i = text.indexOf(term);
    while (i !== -1) {
      var before = i === 0 ? ' ' : text.charAt(i - 1);
      var end = i + term.length;
      if (text.charAt(end) === 's') end++;
      var after = end >= text.length ? ' ' : text.charAt(end);
      if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) return true;
      i = text.indexOf(term, i + 1);
    }
    return false;
  }

  function anyOf(text, list) {
    for (var i = 0; i < list.length; i++) if (has(text, list[i])) return true;
    return false;
  }

  /** Numbers arrive as either 20 or "20g" depending on the caller. */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function lines(recipe) {
    var raw = recipe && recipe.ingredients;
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var s = norm(raw[i]);
      if (s.length > 1) out.push(s);
    }
    return out;
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  /** Points on a sliding scale: `good` earns full marks, `poor` earns none. */
  function scale(value, poor, good, max) {
    if (good === poor) return 0;
    return clamp((value - poor) / (good - poor), 0, 1) * max;
  }

  /* ---------------- The six factors ----------------
     Each returns { key, label, points, max, verdict, note }.
     `verdict` is 'good' | 'ok' | 'poor' and drives the wording and
     colour in the "Why this score?" panel. */

  function verdictFor(points, max) {
    var pct = max ? points / max : 0;
    return pct >= 0.7 ? 'good' : pct >= 0.4 ? 'ok' : 'poor';
  }

  function proteinFactor(kcal, protein) {
    // Share of calories from protein. 25%+ is excellent for a meal,
    // 10% is where a dish stops being filling.
    var share = kcal > 0 ? (protein * 4) / kcal : 0;
    var pts = scale(share, 0.06, 0.25, 20);
    var v = verdictFor(pts, 20);
    return {
      key: 'protein', label: 'Protein', points: pts, max: 20, verdict: v,
      note: v === 'good'
        ? 'High protein — ' + Math.round(protein) + ' g a serving, ' +
          Math.round(share * 100) + '% of its calories'
        : v === 'ok'
          ? 'Moderate protein at ' + Math.round(protein) + ' g a serving'
          : 'Low in protein — ' + Math.round(protein) + ' g a serving, so it will not keep you full for long',
    };
  }

  function fiberFactor(kcal, fiber) {
    // Fibre per 100 calories. 3 g is a genuinely high-fibre dish.
    var per100 = kcal > 0 ? (fiber / kcal) * 100 : 0;
    var pts = scale(per100, 0.4, 3, 20);
    var v = verdictFor(pts, 20);
    return {
      key: 'fiber', label: 'Fibre', points: pts, max: 20, verdict: v,
      note: v === 'good'
        ? 'High fibre — ' + Math.round(fiber) + ' g a serving from whole plants'
        : v === 'ok'
          ? 'Some fibre, ' + Math.round(fiber) + ' g a serving'
          : 'Light on fibre at ' + Math.round(fiber) + ' g — worth serving with vegetables or a salad',
    };
  }

  function wholeFoodFactor(ls) {
    if (!ls.length) {
      return { key: 'whole', label: 'Whole ingredients', points: 10, max: 20,
        verdict: 'ok', note: 'Ingredients not listed, so this part is estimated.' };
    }
    var whole = 0, refined = 0;
    for (var i = 0; i < ls.length; i++) {
      var line = ls[i];
      // Whole grains are checked first: "whole wheat flour" is whole,
      // not refined, even though it contains the word flour.
      if (anyOf(line, WHOLE_GRAINS) || anyOf(line, WHOLE_FOODS)) whole++;
      else if (anyOf(line, REFINED)) refined++;
    }
    var share = whole / ls.length;
    var pts = clamp(scale(share, 0.35, 0.9, 20) - refined * 2.5, 0, 20);
    var v = verdictFor(pts, 20);
    return {
      key: 'whole', label: 'Whole ingredients', points: pts, max: 20, verdict: v,
      note: v === 'good'
        ? 'Built from whole ingredients — ' + whole + ' of ' + ls.length + ' are unprocessed'
        : v === 'ok'
          ? 'Mostly whole ingredients, with a few packaged ones'
          : refined
            ? 'Leans on refined ingredients like white flour or white rice'
            : 'Fewer whole ingredients than most of our recipes',
    };
  }

  function fatFactor(kcal, fat, ls) {
    // Around a third of calories from fat is the sweet spot. Well under
    // that is fine; far over it is where a dish gets heavy.
    var share = kcal > 0 ? (fat * 9) / kcal : 0;
    var pts;
    if (share <= 0.35) pts = 11;
    else if (share <= 0.45) pts = 8;
    else if (share <= 0.55) pts = 5;
    else pts = 2;

    var good = false, heavy = false;
    for (var i = 0; i < ls.length; i++) {
      if (anyOf(ls[i], GOOD_FATS)) good = true;
      if (anyOf(ls[i], HEAVY_FATS)) heavy = true;
    }
    if (good) pts += 4;
    if (heavy) pts -= 3;
    pts = clamp(pts, 0, 15);

    var v = verdictFor(pts, 15);
    return {
      key: 'fat', label: 'Healthy fats', points: pts, max: 15, verdict: v,
      note: v === 'good'
        ? (good ? 'Healthy fats from things like olive oil, nuts or avocado'
                : 'A sensible amount of fat — ' + Math.round(share * 100) + '% of calories')
        : v === 'ok'
          ? (heavy ? 'Some heavier fats such as butter or cream'
                   : 'A fair amount of fat, ' + Math.round(share * 100) + '% of calories')
          : 'Fat-heavy at ' + Math.round(share * 100) + '% of calories' +
            (heavy ? ', mostly from butter, cream or coconut oil' : ''),
    };
  }

  function sugarFactor(ls) {
    var pts = 15, found = [];
    for (var i = 0; i < ls.length; i++) {
      var line = ls[i];
      // "Sugar snap peas" is a vegetable, not a sweetener.
      var innocent = false;
      for (var k = 0; k < NOT_SWEET.length; k++) {
        if (line.indexOf(NOT_SWEET[k]) !== -1) { innocent = true; break; }
      }
      if (innocent) continue;
      // Whole fruit is sweet but brings fibre with it — not a penalty.
      if (anyOf(line, WHOLE_SWEET) && !has(line, 'sugar') && !has(line, 'syrup')) continue;
      for (var j = 0; j < SWEETENERS.length; j++) {
        if (has(line, SWEETENERS[j][0])) {
          pts -= SWEETENERS[j][1];
          if (found.indexOf(SWEETENERS[j][0]) === -1) found.push(SWEETENERS[j][0]);
          break;   // one penalty per line, worst match wins
        }
      }
    }
    pts = clamp(pts, 0, 15);
    var v = verdictFor(pts, 15);
    return {
      key: 'sugar', label: 'Added sugar', points: pts, max: 15, verdict: v,
      note: v === 'good'
        ? (found.length ? 'Only a touch of ' + found[0] + ' for sweetness'
                        : 'No added sugar — the sweetness is from real food')
        : v === 'ok'
          ? 'Some added sweetness from ' + found.slice(0, 2).join(' and ')
          : 'Noticeably sweetened with ' + found.slice(0, 2).join(' and '),
    };
  }

  function sodiumFactor(ls) {
    var pts = 10, found = [];
    for (var i = 0; i < ls.length; i++) {
      for (var j = 0; j < SALTY.length; j++) {
        if (has(ls[i], SALTY[j][0])) {
          pts -= SALTY[j][1];
          if (found.indexOf(SALTY[j][0]) === -1) found.push(SALTY[j][0]);
          break;
        }
      }
    }
    pts = clamp(pts, 0, 10);
    var v = verdictFor(pts, 10);
    return {
      key: 'sodium', label: 'Sodium', points: pts, max: 10, verdict: v,
      note: v === 'good'
        ? 'Low in salt — seasoned lightly'
        : v === 'ok'
          ? 'Moderate sodium, mostly from ' + found.slice(0, 2).join(' and ')
          : 'Saltier than most, from ' + found.slice(0, 3).join(', ') +
            ' — go easy on the added salt',
    };
  }

  /* ---------------- Bands ---------------- */

  var BANDS = [
    { min: 90, key: 'excellent', label: 'Excellent',        color: 'green',  emoji: '🟢' },
    { min: 80, key: 'very-good', label: 'Very Good',        color: 'green',  emoji: '🟢' },
    { min: 70, key: 'good',      label: 'Good',             color: 'yellow', emoji: '🟡' },
    { min: 60, key: 'fair',      label: 'Fair',             color: 'orange', emoji: '🟠' },
    { min: 0,  key: 'low',       label: 'Needs Improvement', color: 'red',   emoji: '🔴' },
  ];

  function band(total) {
    for (var i = 0; i < BANDS.length; i++) if (total >= BANDS[i].min) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  /* ---------------- Public scoring ---------------- */

  var cache = null;      // WeakMap when available — recipes are stable objects

  function score(recipe) {
    if (!recipe) return null;

    var kcal = num(recipe.calories);
    var protein = num(recipe.protein);
    var fiber = num(recipe.fiber);
    var fat = num(recipe.fat);
    var ls = lines(recipe);

    var factors = [
      proteinFactor(kcal, protein),
      fiberFactor(kcal, fiber),
      wholeFoodFactor(ls),
      fatFactor(kcal, fat, ls),
      sugarFactor(ls),
      sodiumFactor(ls),
    ];

    var raw = 0;
    for (var i = 0; i < factors.length; i++) {
      factors[i].points = Math.round(factors[i].points * 10) / 10;
      raw += factors[i].points;
    }
    var total = clamp(Math.round(raw), 0, 100);
    var b = band(total);

    // Strengths first, then anything holding it back — that ordering is
    // what makes the panel read like an explanation rather than a table.
    var strengths = factors.filter(function (f) { return f.verdict === 'good'; });
    var holdingBack = factors.filter(function (f) { return f.verdict === 'poor'; });

    return {
      total: total,
      band: b.key,
      label: b.label,
      color: b.color,
      emoji: b.emoji,
      factors: factors,
      strengths: strengths,
      holdingBack: holdingBack,
      summary: summarise(total, b, strengths, holdingBack),
    };
  }

  function summarise(total, b, strengths, holdingBack) {
    var names = strengths.map(function (f) { return f.label.toLowerCase(); });
    if (total >= 80 && names.length) {
      return 'Scores well on ' + listOut(names) + '.' +
        (holdingBack.length ? ' Held back by ' + listOut(holdingBack.map(lower)) + '.' : '');
    }
    if (holdingBack.length) {
      return 'A ' + b.label.toLowerCase() + ' score, mainly because of ' +
        listOut(holdingBack.map(lower)) + '.' +
        (names.length ? ' It does well on ' + listOut(names) + '.' : '');
    }
    return 'A balanced recipe with no single factor standing out.';
  }

  function lower(f) { return f.label.toLowerCase(); }

  function listOut(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + ' and ' + arr[1];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  /** Just the number. Memoised, because filtering and sorting ask for the
      same recipe many times over. */
  function of(recipe) {
    if (!recipe) return 0;
    if (typeof WeakMap === 'function') {
      if (!cache) cache = new WeakMap();
      if (cache.has(recipe)) return cache.get(recipe);
      var s = score(recipe);
      cache.set(recipe, s ? s.total : 0);
      return s ? s.total : 0;
    }
    var t = score(recipe);
    return t ? t.total : 0;
  }

  /** Indices of `list`, ordered by score. dir 'desc' (default) or 'asc'.
      Ties keep their original order so the featured run stays stable. */
  function sortIndices(list, dir) {
    var idx = [];
    for (var i = 0; i < list.length; i++) idx.push(i);
    var sign = dir === 'asc' ? 1 : -1;
    return idx.sort(function (a, b) {
      var d = (of(list[a]) - of(list[b])) * sign;
      return d !== 0 ? d : a - b;
    });
  }

  w.NNScore = {
    score: score,
    of: of,
    band: band,
    sort: sortIndices,
    BANDS: BANDS,
  };
})(window);
