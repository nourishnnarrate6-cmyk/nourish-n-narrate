/* ===================================================================
   NOURISH N NARRATE — AI NUTRITION ASSISTANT

   Recommends recipes from the site's OWN database. It never invents a
   recipe: every result is an entry from the global RECIPES array, and
   every card is built by buildRecipeCard() so it is identical to the
   rest of the site.

   Pipeline:
     1. interpret()        plain English → a structured intent
        interpretRemote()  same job via Gemini, for open-ended phrasing
     2. rank()             score every recipe and record WHY it matched
     3. draw()             cards, reasons, a spoken-style summary,
                           a follow-up question when the ask is vague,
                           and related searches to try next

   Personalisation is stored locally under NN_STORE and applied as soft
   preferences only — an explicit request always wins. Nothing is sent
   anywhere; the profile is a stub ready for favourites, goals and
   history to be filled in later.

   Requires: RECIPES (recipes-data-supabase.js) and buildRecipeCard()
   (nn-cards.js). Load this after both.
=================================================================== */
(function (w, d) {
  'use strict';

  var MAX_RESULTS = 12;
  var QUICK_MINUTES = 30;
  var LOW_CALORIE = 350;
  var MIN_POINTS = 3;
  var NN_STORE = 'nnAssistant';
  var MAX_RECENT = 6;

  /* ---------- vocabulary ---------- */

  var STOP = ('i im i\'m a an and or the some any what want need have has got give me my we ' +
    'for with without something anything meal meals recipe recipes food dish dishes make ' +
    'cook cooking eat eating please can you show find looking look at only just about of to ' +
    'is are be that this it in on under over less than more using use idea ideas ' +
    // Every recipe here is already healthy and tasty, so these say nothing.
    // Left in, they become search terms that match nothing and drag the
    // whole result set into the "no exact match" fallback.
    'healthy healthier good nice tasty delicious yummy best great lovely proper ' +
    'today tonight now please thanks').split(' ');

  var MEALS = {
    breakfast: ['breakfast', 'brunch', 'morning'],
    lunch: ['lunch', 'midday'],
    dinner: ['dinner', 'supper', 'evening', 'tonight'],
    snack: ['snack', 'snacks', 'bite', 'nibble', 'munch'],
    dessert: ['dessert', 'desserts', 'sweet', 'pudding', 'treat'],
  };

  /* "a meal" means something you sit down to — not a smoothie or a dip. */
  var MEAL_GROUPS = [
    { test: /\b(meal|meals|proper meal|square meal|main|mains|main course|entree|something to eat)\b/,
      meals: ['breakfast', 'lunch', 'dinner'], terms: [] },
    { test: /\b(drink|drinks|beverage|smoothie|smoothies|shake|shakes|juice|lassi)\b/,
      meals: ['snack', 'breakfast'], terms: ['smoothie', 'lassi'] },
  ];

  var MEATY = ['chicken', 'turkey', 'beef', 'salmon', 'tuna', 'cod', 'fish', 'shrimp',
    'prawn', 'lamb', 'pork', 'bacon', 'meat', 'mutton'];

  /* Cravings mapped to what this database actually calls them. */
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

  /* Ingredients that push a recipe out of "cheap student cooking". */
  var PRICEY = ['salmon', 'cod', 'shrimp', 'prawn', 'paneer', 'pine', 'tahini',
    'saffron', 'cashew', 'protein powder', 'parmesan', 'feta', 'almond butter'];

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

  function ingredientNames(recipe) {
    var list = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    return list.map(function (line) {
      return norm(String(line).split(/[–—-]/)[0]).trim();
    });
  }

  /** Rough effort score from steps, ingredient count and time. */
  function difficultyOf(recipe) {
    var steps = Array.isArray(recipe.steps) ? recipe.steps.length : 6;
    var ings = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 8;
    var mins = minutesOf(recipe) || 30;
    var effort = steps + (ings * 0.5) + (mins / 15);
    if (effort <= 13) return 'easy';
    if (effort <= 20) return 'medium';
    return 'hard';
  }

  /** Few ingredients and nothing expensive in the basket. */
  function isBudget(recipe) {
    var lines = ingredientNames(recipe);
    if (lines.length > 10) return false;
    for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < PRICEY.length; j++) {
        if (lines[i].indexOf(PRICEY[j]) !== -1) return false;
      }
    }
    return true;
  }

  /* ---------- personalisation (local only) ---------- */

  function profile() {
    try {
      var raw = w.localStorage.getItem(NN_STORE);
      var p = raw ? JSON.parse(raw) : {};
      return {
        diet: p.diet || null,
        maxCalories: p.maxCalories || null,
        minProtein: p.minProtein || null,
        favorites: Array.isArray(p.favorites) ? p.favorites : [],
        viewed: Array.isArray(p.viewed) ? p.viewed : [],
        recent: Array.isArray(p.recent) ? p.recent : [],
      };
    } catch (e) {
      return { diet: null, maxCalories: null, minProtein: null, favorites: [], viewed: [], recent: [] };
    }
  }

  function saveProfile(p) {
    try { w.localStorage.setItem(NN_STORE, JSON.stringify(p)); } catch (e) { /* private mode */ }
  }

  function remember(query) {
    var p = profile();
    var q = String(query).trim();
    if (!q) return;
    p.recent = [q].concat(p.recent.filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); }))
      .slice(0, MAX_RECENT);
    saveProfile(p);
  }

  /* ---------- 1. interpret ---------- */

  function interpret(query) {
    var q = ' ' + norm(query).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var intent = {
      raw: query, diet: null, collection: null, meals: null,
      maxCalories: null, maxMinutes: null, difficulty: null, budget: false,
      terms: [], soft: [], avoid: [], wantsMeat: false,
    };

    // Non-vegetarian is tested FIRST: the phrase contains the word
    // "vegetarian", so checking the other way round always matches veg.
    if (/\b(non vegetarian|nonvegetarian|non veg|nonveg|meat eater)\b/.test(q)) {
      intent.diet = 'Non-Vegetarian';
    } else if (/\b(vegetarian|veggie|meatless|plant based|plantbased|no meat|vegan)\b/.test(q)) {
      intent.diet = 'Vegetarian';
    }

    if (/\b(high protein|protein packed|lots of protein|muscle|gains|bulking|post workout|filling|keep me full)\b/.test(q)
        || /\bprotein\b/.test(q)) {
      intent.collection = 'High Protein';
    }

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

    var cal = q.match(/(?:under|below|less than|max|fewer than)\s*(\d{2,4})\s*(?:cal|calorie|calories|kcal)/);
    if (cal) intent.maxCalories = parseInt(cal[1], 10);
    else if (/\b(low calorie|low cal|light|lighter)\b/.test(q)) intent.maxCalories = LOW_CALORIE;

    var t = q.match(/(?:under|below|less than|within|max|in)\s*(\d{1,3})\s*(?:min|mins|minute|minutes)/);
    if (t) intent.maxMinutes = parseInt(t[1], 10);
    else if (/\b(quick|quickly|fast|speedy|busy|hurry|no time|rush)\b/.test(q)) intent.maxMinutes = QUICK_MINUTES;

    if (/\b(easy|simple|beginner|basic|no skill|straightforward|foolproof)\b/.test(q)) intent.difficulty = 'easy';
    if (/\b(cheap|budget|affordable|inexpensive|low cost|student|broke)\b/.test(q)) intent.budget = true;

    if (/\b(no dairy|dairy free|lactose)\b/.test(q)) intent.avoid.push('milk', 'cheese', 'yogurt');
    if (/\b(no nuts|nut free|nut allergy)\b/.test(q)) intent.avoid.push('almond', 'cashew', 'peanut');
    if (/\b(no egg|egg free)\b/.test(q)) intent.avoid.push('egg');

    var used = {};
    Object.keys(MEALS).forEach(function (k) { MEALS[k].forEach(function (x) { used[x] = 1; }); });
    ['vegetarian', 'veggie', 'meatless', 'vegan', 'protein', 'high', 'low', 'calorie', 'calories',
      'cal', 'kcal', 'quick', 'fast', 'busy', 'minute', 'minutes', 'min', 'mins', 'under', 'below',
      'less', 'than', 'non', 'veg', 'easy', 'simple', 'beginner', 'basic', 'cheap', 'budget',
      'affordable', 'student', 'dairy', 'free', 'nuts', 'allergy'].forEach(function (x) { used[x] = 1; });

    words(q).forEach(function (tok) {
      if (tok.length < 3) return;
      if (STOP.indexOf(tok) !== -1) return;
      if (used[tok]) return;
      if (/^\d+$/.test(tok)) return;
      if (intent.terms.indexOf(tok) === -1) intent.terms.push(tok);
    });

    groupTerms.forEach(function (gt) {
      if (intent.terms.indexOf(gt) === -1) intent.terms.push(gt);
    });

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

  /** Apply saved preferences where the request said nothing. */
  function withProfile(intent) {
    var p = profile();
    if (!intent.diet && p.diet) { intent.diet = p.diet; intent.fromProfile = true; }
    if (intent.maxCalories == null && p.maxCalories) { intent.maxCalories = p.maxCalories; intent.fromProfile = true; }
    return intent;
  }

  /* ---------- 1b. AI interpretation ---------- */

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
        var local = interpret(query);

        // Ingredients decide whether a match counts; keywords only rank.
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
          difficulty: local.difficulty,
          budget: local.budget,
          terms: terms,
          soft: ai.keywords || [],
          avoid: (ai.avoid || []).concat(local.avoid),
          wantsMeat: terms.some(function (t) { return MEATY.indexOf(stem(t)) !== -1; }),
        };
      })
      .catch(function () { clearTimeout(timer); return null; });
  }

  /* ---------- 2. rank ---------- */

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

    // Foods they cannot eat rule a recipe out entirely.
    if (intent.avoid && intent.avoid.length) {
      for (var a = 0; a < intent.avoid.length; a++) {
        if (matchesTerm(intent.avoid[a], ingWords)) return null;
      }
    }

    if (intent.diet) {
      if (cols.indexOf(intent.diet) === -1) return null;
      points += 3;
      reasons.push('✓ ' + intent.diet);
    }
    if (intent.wantsMeat && cols.indexOf('Non-Vegetarian') === -1) return null;

    if (intent.collection) {
      if (cols.indexOf(intent.collection) !== -1) {
        points += 3;
        reasons.push('✓ ' + intent.collection);
      } else { violation = true; }
    }

    if (intent.meals && intent.meals.length) {
      if (intent.meals.indexOf(recipe.category) !== -1) {
        points += 3;
        reasons.push('✓ ' + recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1));
      } else { violation = true; }
    }

    if (intent.maxCalories != null) {
      if (kcal != null && kcal <= intent.maxCalories) {
        points += 2.5;
        reasons.push('✓ ' + kcal + ' calories');
      } else { violation = true; }
    }

    if (intent.maxMinutes != null) {
      if (mins != null && mins <= intent.maxMinutes) {
        points += 2.5;
        reasons.push('✓ Ready in ' + recipe.time);
      } else { violation = true; }
    }

    if (intent.difficulty === 'easy') {
      if (difficultyOf(recipe) === 'easy') {
        points += 2;
        reasons.push('✓ Beginner friendly');
      } else { violation = true; }
    }

    if (intent.budget) {
      if (isBudget(recipe)) {
        points += 2;
        reasons.push('✓ Budget friendly');
      } else { violation = true; }
    }

    // Ingredients and loose keywords. Missing one term is not a failure.
    var matchedIngredients = [];
    var keywordOnly = [];
    var termHits = 0;

    intent.terms.forEach(function (term) {
      var sIng = matchStrength(term, ingWords);
      var sTitle = matchStrength(term, titleWords);
      var sDesc = matchStrength(term, descWords);
      var strongest = Math.max(sIng, sTitle, sDesc);

      if (sIng > 0) {
        points += 3 * sIng;
        for (var i = 0; i < ingLines.length; i++) {
          if (matchesTerm(term, words(ingLines[i]))) {
            var label = ingLines[i].replace(/\s*\(.*?\)\s*/g, '').trim();
            label = label.charAt(0).toUpperCase() + label.slice(1);
            if (matchedIngredients.indexOf(label) === -1) matchedIngredients.push(label);
            break;
          }
        }
      }
      if (sTitle > 0) points += 3 * sTitle;
      if (sDesc > 0) points += 1 * sDesc;

      if (strongest >= 1) {
        termHits++;
        if (sIng < 1) keywordOnly.push(term);
      }
    });

    if (intent.terms.length > 1) points += (termHits / intent.terms.length) * 2;

    if (intent.soft && intent.soft.length) {
      intent.soft.forEach(function (term) {
        if (matchesTerm(term, titleWords) || matchesTerm(term, descWords) || matchesTerm(term, ingWords)) {
          points += 1.5;
          if (keywordOnly.length < 2) keywordOnly.push(term);
        }
      });
    }

    // "Uses ingredients you have" reads better than listing three of them.
    if (matchedIngredients.length >= 2) {
      reasons.push('✓ Uses ingredients you have');
      matchedIngredients.slice(0, 2).forEach(function (n) { reasons.push('✓ Contains ' + n); });
    } else {
      matchedIngredients.slice(0, 2).forEach(function (n) { reasons.push('✓ Contains ' + n); });
    }
    keywordOnly.slice(0, 2).forEach(function (term) {
      reasons.push('✓ Matches “' + term + '”');
    });

    // Tie-breakers.
    if (intent.collection === 'High Protein' && protein) points += Math.min(protein / 20, 1.5);
    if (intent.maxCalories != null && kcal) points += Math.max(0, (intent.maxCalories - kcal) / 400);
    if (intent.maxMinutes != null && mins) points += Math.max(0, (intent.maxMinutes - mins) / 60);

    var p = profile();
    if (p.favorites.indexOf(recipe.title) !== -1) points += 1.5;
    if (p.minProtein && protein && protein >= p.minProtein) points += 0.5;

    var floor = intent.terms.length ? MIN_POINTS : 0.5;
    if (points < floor) return null;

    var exact = !violation && (intent.terms.length === 0 || termHits > 0);
    return { recipe: recipe, points: points, reasons: reasons, exact: exact };
  }

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

  function search(query) { return rank(withProfile(interpret(query))); }

  function searchSmart(query) {
    return interpretRemote(query).then(function (aiIntent) {
      if (!aiIntent) return rank(withProfile(interpret(query)));
      var out = rank(withProfile(aiIntent));
      if (!out.results.length) {
        var local = rank(withProfile(interpret(query)));
        if (local.results.length) return local;
      }
      return out;
    });
  }

  /* ---------- 3. conversation ---------- */

  /** A spoken-style summary of what was understood and found. */
  function describe(out) {
    var i = out.intent;
    var n = out.results.length;
    if (!n) return 'We couldn’t find an exact match, but here are the closest healthy alternatives.';

    var bits = [];
    if (i.collection) bits.push('high-protein');
    if (i.diet === 'Vegetarian') bits.push('vegetarian');
    if (i.diet === 'Non-Vegetarian') bits.push('non-vegetarian');

    var noun = 'recipe';
    if (i.meals && i.meals.length === 1) noun = i.meals[0];
    var phrase = bits.join(' ') + (bits.length ? ' ' : '') + noun + (n === 1 ? '' : 's');

    var tail = [];
    if (i.maxCalories != null) tail.push('under ' + i.maxCalories + ' calories');
    if (i.maxMinutes != null) tail.push('ready in ' + i.maxMinutes + ' minutes or less');
    if (i.difficulty === 'easy') tail.push('easy to make');
    if (i.budget) tail.push('easy on the budget');

    var s = (out.exact ? 'Here ' + (n === 1 ? 'is' : 'are') + ' ' + n + ' ' : 'The closest ' + n + ' ')
      + phrase + (tail.length ? ' ' + tail.join(' and ') : '') + '.';
    if (!out.exact) s = 'We couldn’t find an exact match. ' + s;
    if (i.fromProfile) s += ' (Using your saved preferences.)';
    return s;
  }

  /** One helpful question when the request is too open to answer well. */
  function followUp(out) {
    var i = out.intent;
    var vague = !i.terms.length && !i.collection && i.maxCalories == null && i.maxMinutes == null;

    if (vague && i.meals && i.meals.length && !i.diet) {
      return {
        q: 'Would you prefer vegetarian or non-vegetarian?',
        options: [
          ['Vegetarian', 'vegetarian ' + i.meals[0]],
          ['Non-vegetarian', 'non-vegetarian ' + i.meals[0]],
          ['Either is fine', i.meals[0] + ' recipes'],
        ],
      };
    }
    if (vague && !i.meals && !i.diet) {
      return {
        q: 'What are you after right now?',
        options: [
          ['Breakfast', 'breakfast'],
          ['Lunch', 'lunch'],
          ['Dinner', 'dinner'],
          ['A snack', 'snack'],
        ],
      };
    }
    return null;
  }

  /** Related searches worth trying next. */
  function suggestions(out) {
    var i = out.intent;
    var list = [];
    var meal = (i.meals && i.meals.length === 1) ? i.meals[0] : '';

    if (!i.collection) list.push(['Looking for higher protein options?', ('high protein ' + meal).trim()]);
    if (i.maxCalories == null) list.push(['Need something under 400 calories?', ('under 400 calories ' + meal).trim()]);
    if (i.diet !== 'Vegetarian') list.push(['Show similar vegetarian recipes', ('vegetarian ' + meal).trim()]);
    if (i.maxMinutes == null) list.push(['Anything ready in 20 minutes?', ('under 20 minutes ' + meal).trim()]);
    if (!i.budget) list.push(['Budget-friendly ideas', ('budget ' + meal).trim()]);

    return list.slice(0, 3);
  }

  /* ---------- 4. UI ---------- */

  var els = {};
  var runToken = 0;

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

  function chip(label, cls, onClick) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
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

  function renderRecent() {
    var p = profile();
    els.recent.innerHTML = '';
    if (!p.recent.length) { els.recent.style.display = 'none'; return; }
    els.recent.style.display = '';
    var label = d.createElement('span');
    label.className = 'nnf-recent-label';
    label.textContent = 'Recent';
    els.recent.appendChild(label);
    p.recent.forEach(function (q) {
      els.recent.appendChild(chip(q, 'nnf-chip nnf-chip-ghost', function () {
        els.input.value = q;
        runSearch(q);
      }));
    });
  }

  function runSearch(query) {
    var mine = ++runToken;
    remember(query);
    renderRecent();
    els.followup.innerHTML = '';
    els.suggest.innerHTML = '';
    els.status.textContent = 'Thinking…';
    els.status.classList.add('thinking');
    showSkeletons(3);
    els.clear.style.display = '';

    searchSmart(query).then(function (out) {
      if (mine !== runToken) return;
      els.status.classList.remove('thinking');
      draw(out);
    });
  }

  function draw(out) {
    els.results.innerHTML = '';
    els.status.textContent = describe(out);

    var list = out.results;
    if (!list.length) {
      var all = recipeList();
      all.slice()
        .sort(function (a, b) { return (num(b.protein) || 0) - (num(a.protein) || 0); })
        .slice(0, 6)
        .forEach(function (r) {
          els.results.appendChild(buildRecipeCard(r, all.indexOf(r)));
        });
    } else {
      list.forEach(function (item, n) {
        var card = buildRecipeCard(item.recipe, item.index);
        card.classList.add('nnf-in');
        card.style.animationDelay = (n * 45) + 'ms';
        if (item.reasons.length) {
          var why = d.createElement('div');
          why.className = 'nnf-why';
          item.reasons.slice(0, 4).forEach(function (r) {
            var c = d.createElement('span');
            c.className = 'nnf-why-chip';
            c.textContent = r;
            why.appendChild(c);
          });
          card.appendChild(why);
        }
        els.results.appendChild(card);
      });
    }

    // Follow-up question
    var fu = followUp(out);
    els.followup.innerHTML = '';
    if (fu) {
      var box = d.createElement('div');
      box.className = 'nnf-followup';
      var qEl = d.createElement('p');
      qEl.className = 'nnf-followup-q';
      qEl.textContent = fu.q;
      box.appendChild(qEl);
      var row = d.createElement('div');
      row.className = 'nnf-followup-row';
      fu.options.forEach(function (opt) {
        row.appendChild(chip(opt[0], 'nnf-chip nnf-chip-solid', function () {
          els.input.value = opt[1];
          runSearch(opt[1]);
        }));
      });
      box.appendChild(row);
      els.followup.appendChild(box);
    }

    // Related searches
    els.suggest.innerHTML = '';
    var sugg = suggestions(out);
    if (sugg.length) {
      var head = d.createElement('span');
      head.className = 'nnf-recent-label';
      head.textContent = 'Try next';
      els.suggest.appendChild(head);
      sugg.forEach(function (s) {
        els.suggest.appendChild(chip(s[0], 'nnf-chip nnf-chip-ghost', function () {
          els.input.value = s[1];
          runSearch(s[1]);
        }));
      });
    }
  }

  function clearAll() {
    runToken++;
    els.input.value = '';
    els.results.innerHTML = '';
    els.followup.innerHTML = '';
    els.suggest.innerHTML = '';
    els.status.textContent = '';
    els.status.classList.remove('thinking');
    els.clear.style.display = 'none';
    els.input.focus();
  }

  function mount() {
    var host = d.getElementById('nn-finder');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';

    host.innerHTML =
      '<div class="nnf-head">' +
        '<span class="nnf-badge">✨ AI Nutrition Assistant</span>' +
        '<h3 class="nnf-title">Tell me what you have — I’ll find it in our recipes</h3>' +
        '<p class="nnf-sub">Ask in your own words. Try “I only have chicken and rice”, ' +
          '“a filling breakfast in 15 minutes” or “something cheap and vegetarian”.</p>' +
      '</div>' +
      '<form class="nnf-bar" id="nnf-form">' +
        '<span class="nnf-icon" aria-hidden="true">🔍</span>' +
        '<input type="search" id="nnf-input" autocomplete="off" ' +
          'placeholder="What ingredients do you have or what are you craving?" ' +
          'aria-label="Ask the nutrition assistant" />' +
        '<button type="button" class="nnf-mic" id="nnf-mic" aria-label="Voice search">🎤</button>' +
        '<button class="nnf-go" type="submit">Ask</button>' +
      '</form>' +
      '<div class="nnf-chips" id="nnf-chips" role="group" aria-label="Quick searches"></div>' +
      '<div class="nnf-recent" id="nnf-recent" style="display:none;"></div>' +
      '<p class="nnf-status" id="nnf-status" aria-live="polite"></p>' +
      '<div id="nnf-followup"></div>' +
      '<div class="recipe-grid nnf-results" id="nnf-results"></div>' +
      '<div class="nnf-suggest" id="nnf-suggest"></div>' +
      '<div class="nnf-foot"><button type="button" class="nnf-clear" id="nnf-clear">Clear search</button></div>';

    els.input = d.getElementById('nnf-input');
    els.results = d.getElementById('nnf-results');
    els.status = d.getElementById('nnf-status');
    els.clear = d.getElementById('nnf-clear');
    els.recent = d.getElementById('nnf-recent');
    els.followup = d.getElementById('nnf-followup');
    els.suggest = d.getElementById('nnf-suggest');
    els.clear.style.display = 'none';

    var chipWrap = d.getElementById('nnf-chips');
    CHIPS.forEach(function (pair) {
      chipWrap.appendChild(chip(pair[0], 'nnf-chip', function () {
        els.input.value = pair[1];
        runSearch(pair[1]);
        els.results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
    });

    d.getElementById('nnf-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = els.input.value.trim();
      if (!q) { clearAll(); return; }
      runSearch(q);
    });

    els.clear.addEventListener('click', clearAll);

    // Voice input — used when the browser supports it, otherwise it explains.
    var mic = d.getElementById('nnf-mic');
    var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    mic.addEventListener('click', function () {
      if (!SR) {
        els.status.textContent = 'Voice search isn’t supported in this browser yet — type your question instead.';
        els.input.focus();
        return;
      }
      var rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      mic.classList.add('listening');
      els.status.textContent = 'Listening…';
      rec.onresult = function (ev) {
        var said = ev.results[0][0].transcript;
        els.input.value = said;
        runSearch(said);
      };
      rec.onerror = function () { els.status.textContent = 'Didn’t catch that — try again or type it.'; };
      rec.onend = function () { mic.classList.remove('listening'); };
      rec.start();
    });

    renderRecent();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
  else mount();
  w.addEventListener('recipesLoaded', mount);

  /* Public API — also the hooks for future personalisation. */
  w.NNFinder = {
    search: search,
    searchSmart: searchSmart,
    interpret: interpret,
    rank: rank,
    describe: describe,
    followUp: followUp,
    suggestions: suggestions,
    mount: mount,
    profile: profile,
    saveProfile: saveProfile,
    setPreference: function (key, value) {
      var p = profile();
      p[key] = value;
      saveProfile(p);
    },
    toggleFavorite: function (title) {
      var p = profile();
      var at = p.favorites.indexOf(title);
      if (at === -1) p.favorites.push(title); else p.favorites.splice(at, 1);
      saveProfile(p);
      return p.favorites.indexOf(title) !== -1;
    },
    noteViewed: function (title) {
      var p = profile();
      p.viewed = [title].concat(p.viewed.filter(function (x) { return x !== title; })).slice(0, 30);
      saveProfile(p);
    },
  };
})(window, document);
