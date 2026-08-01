/* ===================================================================
   NOURISH N NARRATE — AI RECIPE FINDER

   Recommends recipes from the site's OWN database. It never invents a
   recipe: every result is an entry from the global RECIPES array, and
   every card is built by buildRecipeCard() so it looks identical to
   the rest of the site.

   How a query is handled:
     1. interpret()  — turn plain English into a structured intent
                       (diet, collection, meal, calorie cap, time cap,
                       ingredients, loose keywords).
     2. score()      — rank every recipe against that intent and record
                       WHY it matched.
     3. render()     — draw the winners as normal recipe cards with a
                       short row of reasons underneath.

   No AI key is required. If one is ever configured, interpret() is the
   single function to swap for a model call — everything downstream
   works off the same intent object.

   Requires: RECIPES (recipes-data-supabase.js) and buildRecipeCard()
   (nn-cards.js). Load this after both.
=================================================================== */
(function (w, d) {
  'use strict';

  var MAX_RESULTS = 12;
  var QUICK_MINUTES = 30;      // what "quick" means
  var LOW_CALORIE = 350;       // what "low calorie" means
  var MIN_POINTS = 3;          // below this a "match" is really just noise

  /**
   * Common cravings mapped to what this database actually calls them.
   * Without this, "ice cream" is split into "ice" and "cream" and starts
   * matching ice cubes and anything described as creamy.
   */
  var CONCEPTS = [
    { phrase: 'ice cream', meal: 'dessert', terms: ['frozen', 'yogurt'] },
    { phrase: 'milkshake', terms: ['smoothie'] },
    { phrase: 'shake', terms: ['smoothie'] },
    { phrase: 'pasta', terms: ['noodles', 'pasta'] },
    { phrase: 'spaghetti', terms: ['noodles'] },
    { phrase: 'curry', terms: ['curry', 'dal', 'masala'] },
    { phrase: 'burger', terms: ['burger'] },
    { phrase: 'pizza', terms: ['pizza'] },
    { phrase: 'fries', terms: ['fries', 'chips'] },
    { phrase: 'crisps', terms: ['chips'] },
    { phrase: 'sandwich', terms: ['wrap', 'toast'] },
    { phrase: 'soup', terms: ['soup'] },
    { phrase: 'salad', terms: ['salad'] },
    { phrase: 'smoothie', terms: ['smoothie'] },
  ];

  /* ---------- vocabulary ---------- */

  var STOP = ('i im i\'m a an and or the some any what want need have has got give me my we ' +
    'for with without something anything meal meals recipe recipes food dish dishes make ' +
    'cook cooking eat eating please can you show find looking look at only just about of to ' +
    'is are be that this it in on under over less than more using use idea ideas').split(' ');

  var MEALS = {
    breakfast: ['breakfast', 'brunch', 'morning'],
    lunch: ['lunch', 'midday'],
    dinner: ['dinner', 'supper', 'evening'],
    snack: ['snack', 'snacks', 'bite', 'nibble', 'munch'],
    dessert: ['dessert', 'desserts', 'sweet', 'pudding', 'treat'],
  };

  /* "a meal" means something you sit down to — not a smoothie or a dip.
     Without this, "quick meals under 30 minutes" happily returns drinks. */
  var MEAL_GROUPS = [
    { test: /\b(meal|meals|proper meal|square meal|main|mains|main course|entree|something to eat)\b/,
      meals: ['breakfast', 'lunch', 'dinner'], terms: [] },
    // Drinks live under "snack" alongside crisps and dips, so seed the words
    // that actually identify a drink or the crisps will out-rank them.
    { test: /\b(drink|drinks|beverage|smoothie|smoothies|shake|shakes|juice|lassi)\b/,
      meals: ['snack', 'breakfast'], terms: ['smoothie', 'lassi'] },
  ];

  // Words that imply the dish must contain meat or fish.
  var MEATY = ['chicken', 'turkey', 'beef', 'salmon', 'tuna', 'cod', 'fish', 'shrimp',
    'prawn', 'lamb', 'pork', 'bacon', 'meat', 'mutton'];

  /* ---------- helpers ---------- */

  /**
   * The recipe list. recipes-data-supabase.js declares it with `let`, which
   * does NOT put it on window — so it has to be read through the scope chain
   * rather than as window.RECIPES, or every search returns nothing.
   */
  function recipeList() {
    try {
      if (typeof RECIPES !== 'undefined' && Array.isArray(RECIPES)) return RECIPES;
    } catch (e) { /* not defined yet */ }
    return Array.isArray(w.RECIPES) ? w.RECIPES : [];
  }

  function norm(s) { return String(s || '').toLowerCase(); }

  function words(s) {
    return norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  /** Crude singular form so "eggs" matches "egg" and "noodles" matches "noodle". */
  function stem(t) {
    if (t.length > 3 && t.slice(-3) === 'ies') return t.slice(0, -3) + 'y';
    if (t.length > 3 && t.slice(-2) === 'es') return t.slice(0, -2);
    if (t.length > 3 && t.slice(-1) === 's') return t.slice(0, -1);
    return t;
  }

  function num(v) {
    var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  }

  /** Minutes from a cook_time string like "40 min" or "5 min + overnight". */
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

  /** Every ingredient name, lower-cased, without the quantity after the dash. */
  function ingredientNames(recipe) {
    var list = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    return list.map(function (line) {
      return norm(String(line).split(/[–—-]/)[0]).trim();
    });
  }

  /* ---------- 1. interpret ---------- */

  /**
   * Turn a plain-English query into a structured intent.
   * Swap this one function for a model call if an AI key is ever added —
   * it just has to return the same shape.
   */
  function interpret(query) {
    var q = ' ' + norm(query).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var intent = {
      raw: query, diet: null, collection: null, meals: null,
      maxCalories: null, maxMinutes: null, terms: [], wantsMeat: false,
    };

    // Diet
    if (/\b(vegetarian|veggie|meatless|plant based|plantbased|no meat|vegan)\b/.test(q)) {
      intent.diet = 'Vegetarian';
    } else if (/\b(non vegetarian|nonvegetarian|non veg|nonveg)\b/.test(q)) {
      intent.diet = 'Non-Vegetarian';
    }

    // Collection
    if (/\b(high protein|protein packed|lots of protein|muscle|gains|bulking|post workout)\b/.test(q)
        || /\bprotein\b/.test(q)) {
      intent.collection = 'High Protein';
    }

    // Meal. A named meal wins; otherwise a group word like "meals" applies.
    var groupTerms = [];
    var named = [];
    Object.keys(MEALS).forEach(function (key) {
      MEALS[key].forEach(function (word) {
        if (new RegExp('\\b' + word + '\\b').test(q) && named.indexOf(key) === -1) named.push(key);
      });
    });
    if (named.length) {
      intent.meals = named;
    } else {
      for (var g = 0; g < MEAL_GROUPS.length; g++) {
        if (!MEAL_GROUPS[g].test.test(q)) continue;
        intent.meals = MEAL_GROUPS[g].meals.slice();
        groupTerms = (MEAL_GROUPS[g].terms || []).slice();
        break;
      }
    }

    // Calorie cap — "under 500 calories", "less than 400 cal", "low calorie"
    var cal = q.match(/(?:under|below|less than|max|fewer than)\s*(\d{2,4})\s*(?:cal|calorie|calories|kcal)/);
    if (cal) intent.maxCalories = parseInt(cal[1], 10);
    else if (/\b(low calorie|low cal|light|lighter)\b/.test(q)) intent.maxCalories = LOW_CALORIE;

    // Time cap — "under 30 minutes", "quick", "fast"
    var t = q.match(/(?:under|below|less than|within|max|in)\s*(\d{1,3})\s*(?:min|mins|minute|minutes)/);
    if (t) intent.maxMinutes = parseInt(t[1], 10);
    else if (/\b(quick|quickly|fast|speedy|easy|busy|hurry|no time)\b/.test(q)) intent.maxMinutes = QUICK_MINUTES;

    // Remaining meaningful words become ingredient / keyword terms.
    var used = {};
    Object.keys(MEALS).forEach(function (k) { MEALS[k].forEach(function (x) { used[x] = 1; }); });
    ['vegetarian', 'veggie', 'meatless', 'vegan', 'protein', 'high', 'low', 'calorie', 'calories',
      'cal', 'kcal', 'quick', 'fast', 'easy', 'minute', 'minutes', 'min', 'mins', 'under', 'below',
      'less', 'than', 'non', 'veg'].forEach(function (x) { used[x] = 1; });

    words(q).forEach(function (tok) {
      if (tok.length < 3) return;
      if (STOP.indexOf(tok) !== -1) return;
      if (used[tok]) return;
      if (/^\d+$/.test(tok)) return;
      if (intent.terms.indexOf(tok) === -1) intent.terms.push(tok);
    });

    // Words implied by a group word — "a drink" should prefer the smoothies
    // over the crisps that share the same snack category.
    groupTerms.forEach(function (gt) {
      if (intent.terms.indexOf(gt) === -1) intent.terms.push(gt);
    });

    // Multi-word cravings are concepts, not two separate words. Match those
    // before the loose word-by-word search gets a chance to misfire.
    for (var c = 0; c < CONCEPTS.length; c++) {
      var con = CONCEPTS[c];
      if (q.indexOf(' ' + con.phrase + ' ') === -1) continue;
      con.phrase.split(' ').forEach(function (part) {
        var at = intent.terms.indexOf(part);
        if (at !== -1) intent.terms.splice(at, 1);
      });
      con.terms.forEach(function (t3) {
        if (intent.terms.indexOf(t3) === -1) intent.terms.push(t3);
      });
      if (con.meal && !intent.meals) intent.meals = [con.meal];
      break;
    }

    intent.wantsMeat = intent.terms.some(function (t2) { return MEATY.indexOf(stem(t2)) !== -1; });
    return intent;
  }

  /* ---------- 1b. AI interpretation ----------
     Sends the raw phrase to the interpret-query Edge Function, which uses
     the Gemini key already configured for the photo scanner. The model only
     describes the request — it never picks recipes, so nothing can be
     invented. Any failure falls straight back to interpret() above. */

  function interpretRemote(query) {
    var cfg = w.NN_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return Promise.resolve(null);

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);

    return fetch(cfg.SUPABASE_URL + '/functions/v1/interpret-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ q: query }),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.ok || !data.intent) return null;
        var ai = data.intent;
        var local = interpret(query); // reuse the local read as a safety net

        // Ingredients are what the person actually asked for, so they decide
        // whether a match counts. Keywords are mood/cuisine words like
        // "comfort" or "italian" — helpful for ranking, but a recipe should
        // never be demoted just because it does not contain the word "cosy".
        var terms = (ai.ingredients || []).slice();
        if (!terms.length && !(ai.keywords || []).length) terms = local.terms;

        return {
          raw: query,
          source: 'ai',
          diet: ai.diet || local.diet,
          collection: ai.collection || local.collection,
          meals: (Array.isArray(ai.meals) && ai.meals.length) ? ai.meals : local.meals,
          maxCalories: ai.maxCalories != null ? ai.maxCalories : local.maxCalories,
          maxMinutes: ai.maxMinutes != null ? ai.maxMinutes : local.maxMinutes,
          terms: terms,
          soft: ai.keywords || [],
          avoid: ai.avoid || [],
          wantsMeat: terms.some(function (t) { return MEATY.indexOf(stem(t)) !== -1; }),
        };
      })
      .catch(function () { clearTimeout(timer); return null; });
  }

  /* ---------- 2. score ---------- */

  /**
   * How well a term matches: 1 for a real word match, 0.4 for a loose
   * prefix match, 0 for nothing. Grading this matters — "cream" only
   * half-matches "Creamy", and treating that as a full hit is how a search
   * for ice cream ends up recommending lentil dal.
   */
  function matchStrength(term, haystackWords) {
    var s = stem(term);
    var best = 0;
    for (var i = 0; i < haystackWords.length; i++) {
      var h = stem(haystackWords[i]);
      if (h === s) return 1;
      if (s.length >= 5 && h.length >= 5 &&
          (h.indexOf(s) === 0 || s.indexOf(h) === 0) &&
          Math.abs(h.length - s.length) <= 2) {
        best = Math.max(best, 0.4);
      }
    }
    return best;
  }

  function matchesTerm(term, haystackWords) { return matchStrength(term, haystackWords) > 0; }

  function score(recipe, intent) {
    var reasons = [];
    var points = 0;
    var violation = false;

    var cols = collectionsOf(recipe);
    var titleWords = words(recipe.title);
    var descWords = words(recipe.desc);
    var ingLines = ingredientNames(recipe);
    var ingWords = words(ingLines.join(' '));
    var mins = minutesOf(recipe);
    var kcal = num(recipe.calories);
    var protein = num(recipe.protein);

    // Foods the person said they cannot eat rule a recipe out entirely.
    if (intent.avoid && intent.avoid.length) {
      for (var a = 0; a < intent.avoid.length; a++) {
        if (matchesTerm(intent.avoid[a], ingWords)) return null;
      }
    }

    // Diet — treated as a requirement, not a preference.
    if (intent.diet) {
      if (cols.indexOf(intent.diet) === -1) return null;
      points += 3;
      reasons.push('✓ ' + intent.diet);
    }
    // Asking for chicken should not return a vegetarian dish.
    if (intent.wantsMeat && cols.indexOf('Non-Vegetarian') === -1) return null;

    // Collection
    if (intent.collection) {
      if (cols.indexOf(intent.collection) !== -1) {
        points += 3;
        reasons.push('✓ ' + intent.collection);
      } else {
        violation = true;
      }
    }

    // Meal — may be several (e.g. "meals" covers breakfast, lunch and dinner).
    if (intent.meals && intent.meals.length) {
      if (intent.meals.indexOf(recipe.category) !== -1) {
        points += 3;
        reasons.push('✓ ' + recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1));
      } else {
        violation = true;
      }
    }

    // Calories
    if (intent.maxCalories != null) {
      if (kcal != null && kcal <= intent.maxCalories) {
        points += 2.5;
        reasons.push('✓ ' + kcal + ' calories');
      } else {
        violation = true;
      }
    }

    // Time
    if (intent.maxMinutes != null) {
      if (mins != null && mins <= intent.maxMinutes) {
        points += 2.5;
        reasons.push('✓ Ready in ' + recipe.time);
      } else {
        violation = true;
      }
    }

    // Ingredients and loose keywords.
    // A miss on one term is NOT a failure — asking for "chicken, rice,
    // broccoli" should still surface a dish with two of the three. Only a
    // recipe matching none of them is treated as off-target.
    var matchedIngredients = [];
    var keywordOnly = [];
    var termHits = 0;

    intent.terms.forEach(function (term) {
      var sIng = matchStrength(term, ingWords);
      var sTitle = matchStrength(term, titleWords);
      var sDesc = matchStrength(term, descWords);
      // A loose partial only counts as a hit if nothing matched properly.
      var strongest = Math.max(sIng, sTitle, sDesc);
      var inIng = sIng > 0, inTitle = sTitle > 0, inDesc = sDesc > 0;

      if (inIng) {
        points += 3 * sIng;
        // Name the ingredient line it matched, for a readable reason.
        for (var i = 0; i < ingLines.length; i++) {
          if (matchesTerm(term, words(ingLines[i]))) {
            var label = ingLines[i].replace(/\s*\(.*?\)\s*/g, '').trim();
            label = label.charAt(0).toUpperCase() + label.slice(1);
            if (matchedIngredients.indexOf(label) === -1) matchedIngredients.push(label);
            break;
          }
        }
      }
      if (inTitle) points += 3 * sTitle;
      if (inDesc) points += 1 * sDesc;

      // Only a solid match counts toward coverage; a 0.4 partial does not.
      if (strongest >= 1) {
        termHits++;
        if (sIng < 1) keywordOnly.push(term);
      }
    });

    // Reward covering more of what was asked for.
    if (intent.terms.length > 1) points += (termHits / intent.terms.length) * 2;

    // Soft words (cuisine, mood) nudge the ranking but never gate a result.
    if (intent.soft && intent.soft.length) {
      intent.soft.forEach(function (term) {
        if (matchesTerm(term, titleWords) || matchesTerm(term, descWords) || matchesTerm(term, ingWords)) {
          points += 1.5;
          if (keywordOnly.length < 2) keywordOnly.push(term);
        }
      });
    }

    matchedIngredients.slice(0, 3).forEach(function (name) {
      reasons.push('✓ Contains ' + name);
    });
    keywordOnly.slice(0, 2).forEach(function (term) {
      reasons.push('✓ Matches “' + term + '”');
    });

    // Gentle tie-breakers so results are sensibly ordered, not random.
    if (intent.collection === 'High Protein' && protein) points += Math.min(protein / 20, 1.5);
    if (intent.maxCalories != null && kcal) points += Math.max(0, (intent.maxCalories - kcal) / 400);
    if (intent.maxMinutes != null && mins) points += Math.max(0, (intent.maxMinutes - mins) / 60);

    // A relevance floor. Without it a single weak partial word match is
    // enough to surface a completely unrelated recipe.
    var floor = intent.terms.length ? MIN_POINTS : 0.5;
    if (points < floor) return null;
    // "Exact" means every stated constraint was met and, when ingredients
    // were named, at least one of them is actually in the recipe.
    var exact = !violation && (intent.terms.length === 0 || termHits > 0);
    return { recipe: recipe, points: points, reasons: reasons, exact: exact };
  }

  /** Rank the whole database against an already-built intent. */
  function rank(intent) {
    var list = recipeList();
    var scored = [];

    list.forEach(function (r, i) {
      var s = score(r, intent);
      if (s) { s.index = i; scored.push(s); }
    });

    scored.sort(function (a, b) {
      if (b.exact !== a.exact) return b.exact ? 1 : -1;
      return b.points - a.points;
    });

    var exact = scored.filter(function (s) { return s.exact; });
    return {
      intent: intent,
      exact: exact.length > 0,
      results: (exact.length ? exact : scored).slice(0, MAX_RESULTS),
    };
  }

  /** Synchronous search using only the built-in parser. */
  function search(query) { return rank(interpret(query)); }

  /**
   * Search with AI interpretation when it is available, falling back to the
   * local parser. Always resolves — a failed model call is invisible to the
   * user beyond slightly simpler understanding.
   */
  function searchSmart(query) {
    return interpretRemote(query).then(function (aiIntent) {
      if (!aiIntent) return rank(interpret(query));
      var out = rank(aiIntent);
      // If the model over-constrained and found nothing, try the plain read.
      if (!out.results.length) {
        var local = rank(interpret(query));
        if (local.results.length) return local;
      }
      return out;
    });
  }

  /* ---------- 3. render ---------- */

  var els = {};

  var runToken = 0;

  /** Kick off a search: show a thinking state, then draw whatever comes back. */
  function runSearch(query) {
    var mine = ++runToken;
    els.status.textContent = 'Looking through our recipes…';
    els.results.innerHTML = '';
    els.clear.style.display = '';
    searchSmart(query).then(function (out) {
      if (mine !== runToken) return; // a newer search has started
      draw(out);
    });
  }

  function draw(out) {
    els.results.innerHTML = '';

    if (!out.results.length) {
      els.status.textContent = 'We couldn’t find an exact match, but here are the closest healthy options.';
      // Fall back to a genuinely useful set rather than an empty grid.
      var all = recipeList();
      var fallback = all.slice()
        .sort(function (a, b) { return (num(b.protein) || 0) - (num(a.protein) || 0); })
        .slice(0, 6);
      fallback.forEach(function (r) {
        els.results.appendChild(buildRecipeCard(r, all.indexOf(r)));
      });
      els.clear.style.display = '';
      return;
    }

    els.status.textContent = out.exact
      ? out.results.length + (out.results.length === 1 ? ' recipe matches' : ' recipes match') + ' your search'
      : 'We couldn’t find an exact match, but here are the closest healthy options.';

    out.results.forEach(function (item) {
      var card = buildRecipeCard(item.recipe, item.index);
      if (item.reasons.length) {
        var why = d.createElement('div');
        why.className = 'nnf-why';
        item.reasons.slice(0, 4).forEach(function (r) {
          var chip = d.createElement('span');
          chip.className = 'nnf-why-chip';
          chip.textContent = r;
          why.appendChild(chip);
        });
        card.appendChild(why);
      }
      els.results.appendChild(card);
    });

    els.clear.style.display = '';
  }

  function clearAll() {
    els.input.value = '';
    els.results.innerHTML = '';
    els.status.textContent = '';
    els.clear.style.display = 'none';
    els.input.focus();
  }

  /* ---------- mount ---------- */

  var CHIPS = [
    ['High Protein', 'high protein'],
    ['Vegetarian', 'vegetarian'],
    ['Breakfast', 'breakfast'],
    ['Dinner', 'dinner'],
    ['Lunch', 'lunch'],
    ['Snack', 'snack'],
    ['Quick Meals', 'quick meals under 30 minutes'],
    ['Under 500 Calories', 'under 500 calories'],
  ];

  function mount() {
    var host = d.getElementById('nn-finder');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';

    host.innerHTML =
      '<div class="nnf-head">' +
        '<span class="nnf-badge">✨ AI Recipe Finder</span>' +
        '<h3 class="nnf-title">Tell us what you have — we’ll find it in our recipes</h3>' +
        '<p class="nnf-sub">Searches only Nourish N Narrate recipes. Try “eggs and spinach”, ' +
          '“high protein breakfast” or “vegetarian dinner under 400 calories”.</p>' +
      '</div>' +
      '<form class="nnf-bar" id="nnf-form">' +
        '<span class="nnf-icon" aria-hidden="true">🔍</span>' +
        '<input type="search" id="nnf-input" autocomplete="off" ' +
          'placeholder="What ingredients do you have or what are you craving?" ' +
          'aria-label="Search recipes by ingredients or cravings" />' +
        '<button class="nnf-go" type="submit">Find recipes</button>' +
      '</form>' +
      '<div class="nnf-chips" id="nnf-chips" role="group" aria-label="Quick searches"></div>' +
      '<p class="nnf-status" id="nnf-status" aria-live="polite"></p>' +
      '<div class="recipe-grid nnf-results" id="nnf-results"></div>' +
      '<div class="nnf-foot"><button type="button" class="nnf-clear" id="nnf-clear">Clear search</button></div>';

    els.input = d.getElementById('nnf-input');
    els.results = d.getElementById('nnf-results');
    els.status = d.getElementById('nnf-status');
    els.clear = d.getElementById('nnf-clear');
    els.clear.style.display = 'none';

    var chipWrap = d.getElementById('nnf-chips');
    CHIPS.forEach(function (pair) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'nnf-chip';
      b.textContent = pair[0];
      b.addEventListener('click', function () {
        els.input.value = pair[1];
        runSearch(pair[1]);
        els.results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      chipWrap.appendChild(b);
    });

    d.getElementById('nnf-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = els.input.value.trim();
      if (!q) { clearAll(); return; }
      runSearch(q);
    });

    els.clear.addEventListener('click', clearAll);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
  else mount();
  w.addEventListener('recipesLoaded', mount);

  w.NNFinder = { search: search, searchSmart: searchSmart, interpret: interpret, rank: rank, mount: mount };
})(window, document);
