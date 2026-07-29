/* ===================================================================
   NOURISH N NARRATE — RECIPE DATA (from Supabase)

   Populates the global RECIPES array from the database, then fires a
   `recipesLoaded` event that index.html and all-recipes.html listen for.

   If the database is unreachable, a single built-in recipe is used so
   the page never renders an empty grid.

   Load order (see any page's script block):
     nn-config.js → supabase-js CDN → supabase-client.js → this file
=================================================================== */

let RECIPES = [];

/** Hide the full-screen loader using the same fade the pages expect. */
function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (el) el.classList.add('hidden');
}

/** Let the page know RECIPES is ready. */
function dispatchRecipesLoadedEvent() {
  window.dispatchEvent(new CustomEvent('recipesLoaded', {
    detail: { recipeCount: RECIPES.length },
  }));
}

/** Fetch every recipe from Supabase, falling back if that isn't possible. */
async function loadRecipesFromSupabase() {
  try {
    if (!window.SupabaseClient || !SupabaseClient.isConnected()) {
      loadFallbackRecipes();
      return;
    }

    const fetched = await SupabaseClient.fetchRecipes();
    if (fetched && fetched.length) {
      RECIPES = fetched;
      dispatchRecipesLoadedEvent();
    } else {
      loadFallbackRecipes();
    }
  } catch (error) {
    console.error('Could not load recipes from Supabase —', error.message);
    loadFallbackRecipes();
  } finally {
    hideLoadingScreen();
  }
}

/**
 * Offline fallback so the grid is never blank.
 * ✏️ Add more entries here if you want a richer offline experience.
 */
function loadFallbackRecipes() {
  RECIPES = [
    {
      title: 'Date Ladoo',
      category: 'snack',
      type: 'veg',
      emoji: '🍪',
      image_url: null,
      desc: 'A wholesome no-bake Indian sweet made from dates and roasted nuts — naturally sweet, energy-packed, and completely guilt-free.',
      time: '25 min',
      servings: '12',
      calories: '95',
      protein: '2g',
      fiber: '2g',
      fat: '5g',
      ingredients: [
        'Dates (non-seeded) – 1 cup',
        'Almonds – ½ cup',
        'Cashews – ¼ cup',
        'Ghee – 2 tbsp',
        'Cardamom powder – ¼ tsp',
        'Cocoa powder – 1 tbsp (optional, for coating)',
      ],
      steps: [
        'Soak dates in warm water for 5 minutes, then remove pits.',
        'Lightly roast almonds and cashews in a pan without oil (2 min). Let cool slightly.',
        'Blend soaked dates, roasted nuts, and ghee into a smooth paste.',
        'Add cardamom powder and mix well.',
        'Scoop small portions and roll into balls between your palms.',
        'Optional: Roll in cocoa powder or coconut for extra flavor and coating.',
        'Refrigerate for 2 hours before serving.',
      ],
      tip: 'The riper the dates, the sweeter and easier to blend. Dates are the only sweetener needed!',
      whyHealthier: [
        'Dates provide natural sweetness + energy-boosting fiber',
        'Nuts add healthy fats and protein (no refined sugar)',
        'No refined flour or processed ingredients',
        'Great for pre-workout or energy boost',
      ],
      comparison: [
        ['Traditional ladoos with condensed milk & sugar', 'Our version: whole dates + nuts + ghee only'],
        ['Store-bought sweets (200+ cal, high sugar)', 'Date Ladoos (95 cal, natural sweetness)'],
      ],
    },
  ];

  dispatchRecipesLoadedEvent();
}

/** Reload recipes on demand. */
async function refreshRecipes() {
  await loadRecipesFromSupabase();
}

/* Wait until the Supabase client has actually connected, then load. */
(function waitForConnection(attempt) {
  if (window.SupabaseClient && SupabaseClient.isConnected()) {
    loadRecipesFromSupabase();
  } else if (attempt < 30) {
    setTimeout(() => waitForConnection(attempt + 1), 200);
  } else {
    console.warn('Supabase did not connect in time — showing offline recipes.');
    loadFallbackRecipes();
    hideLoadingScreen();
  }
})(0);
