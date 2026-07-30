/* ===================================================================
   NOURISH N NARRATE — RECIPE DATA (Supabase Dynamic)

   This version fetches recipes dynamically from Supabase instead of
   using a hardcoded array. Maintains backward compatibility with nn-cards.js.

   The RECIPES variable will be populated by SupabaseClient.fetchRecipes()
   and available globally after initialization.

   Fallback: If Supabase is unavailable, falls back to local recipes.
=================================================================== */

// Global RECIPES variable that will be populated from Supabase
let RECIPES = [];

/**
 * Load recipes from Supabase
 * This function is called after SupabaseClient initializes
 */
async function loadRecipesFromSupabase() {
  // Show loading state
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
  }

  try {
    // Check if SupabaseClient is available and initialized
    console.log('loadRecipesFromSupabase() called');
    console.log('window.SupabaseClient available?', !!window.SupabaseClient);

    if (!window.SupabaseClient) {
      console.warn('⚠️ SupabaseClient not available globally');
      loadFallbackRecipes();
      return;
    }

    const isConnected = SupabaseClient.isConnected();
    console.log('SupabaseClient.isConnected():', isConnected);

    if (!isConnected) {
      console.warn('⚠️ Supabase not connected. Using fallback recipes.');
      loadFallbackRecipes();
      return;
    }

    // Fetch recipes from Supabase
    console.log('Loading recipes from Supabase...');
    const fetchedRecipes = await SupabaseClient.fetchRecipes();

    if (fetchedRecipes && fetchedRecipes.length > 0) {
      RECIPES = fetchedRecipes;
      console.log(`✓ Loaded ${RECIPES.length} recipes from Supabase`);
      dispatchRecipesLoadedEvent();
    } else {
      console.warn('No recipes found in Supabase. Using fallback recipes.');
      loadFallbackRecipes();
    }
  } catch (error) {
    console.error('Error loading recipes from Supabase:', error);
    console.warn('Falling back to local recipes.');
    loadFallbackRecipes();
  } finally {
    // Hide loading screen
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 300);
    }
  }
}

/**
 * Fallback recipes (stored locally for offline support)
 * These are used if Supabase is unavailable
 */
function loadFallbackRecipes() {
  // ✏️ Add your fallback recipes here in case Supabase is down
  // For now, we'll use an empty array and let the UI handle "no recipes"
  RECIPES = [
    {
      title: "Date Ladoo",
      category: "snack",
      type: "veg",
      emoji: "🍪",
      image_url: null,
      desc: "A wholesome no-bake Indian sweet made from dates and roasted nuts — naturally sweet, energy-packed, and completely guilt-free.",
      time: "25 min",
      servings: "12",
      calories: "95",
      protein: "2g",
      fiber: "2g",
      fat: "5g",
      ingredients: [
        "Dates (non-seeded) – 1 cup",
        "Almonds – ½ cup",
        "Cashews – ¼ cup",
        "Ghee – 2 tbsp",
        "Cardamom powder – ¼ tsp",
        "Cocoa powder – 1 tbsp (optional, for coating)"
      ],
      steps: [
        "Soak dates in warm water for 5 minutes, then remove pits.",
        "Lightly roast almonds and cashews in a pan without oil (2 min). Let cool slightly.",
        "Blend soaked dates, roasted nuts, and ghee into a smooth paste.",
        "Add cardamom powder and mix well.",
        "Scoop small portions and roll into balls between your palms.",
        "Optional: Roll in cocoa powder or coconut for extra flavor and coating.",
        "Refrigerate for 2 hours before serving."
      ],
      tip: "The riper the dates, the sweeter and easier to blend. Dates are the only sweetener needed!",
      whyHealthier: [
        "Dates provide natural sweetness + energy-boosting fiber",
        "Nuts add healthy fats and protein (no refined sugar)",
        "No refined flour or processed ingredients",
        "Great for pre-workout or energy boost"
      ],
      comparison: [
        ["Traditional ladoos with condensed milk & sugar", "Our version: whole dates + nuts + ghee only"],
        ["Store-bought sweets (200+ cal, high sugar)", "Date Ladoos (95 cal, natural sweetness)"]
      ]
    }
  ];

  console.log('Using fallback recipes:', RECIPES.length, 'recipe(s)');
  dispatchRecipesLoadedEvent();
}

/**
 * Dispatch a custom event when recipes are loaded
 * This allows other scripts to react to recipe availability
 */
function dispatchRecipesLoadedEvent() {
  const event = new CustomEvent('recipesLoaded', {
    detail: { recipeCount: RECIPES.length }
  });
  window.dispatchEvent(event);
  console.log('Event "recipesLoaded" dispatched');
}

/**
 * Reload recipes (useful for admin/refresh scenarios)
 */
async function refreshRecipes() {
  console.log('Refreshing recipes...');
  await loadRecipesFromSupabase();
}

// Wait for SupabaseClient to be available, then load recipes
function waitForSupabaseClientThenLoadRecipes(maxAttempts = 20, delay = 250) {
  let attempts = 0;

  const checkAndLoad = () => {
    attempts++;
    console.log(`Checking for SupabaseClient... (attempt ${attempts}/${maxAttempts})`);

    if (window.SupabaseClient) {
      console.log('✓ SupabaseClient found! Loading recipes...');
      loadRecipesFromSupabase();
    } else if (attempts < maxAttempts) {
      setTimeout(checkAndLoad, delay);
    } else {
      console.error('❌ SupabaseClient not available after ' + maxAttempts + ' attempts');
      loadFallbackRecipes();
    }
  };

  checkAndLoad();
}

// Start checking for SupabaseClient
document.addEventListener('DOMContentLoaded', () => {
  waitForSupabaseClientThenLoadRecipes();
});
