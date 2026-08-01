/* ===================================================================
   SUPABASE CLIENT — recipes + public form submissions

   Credentials live in nn-config.js, which must be loaded first:
     <script src="nn-config.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="supabase-client.js"></script>

   Public API (window.SupabaseClient):
     initialize()             — create the client (called automatically)
     isConnected()            — true once the client exists
     fetchRecipes()           — every recipe, oldest first
     fetchRecipesByType(type) — 'veg' | 'non-veg'
     submitSuggestion(data)   — { name, email, foodName, category, dietary, reason }
     submitContact(data)      — { name, email, subject, message }
=================================================================== */

const SupabaseClient = (() => {
  'use strict';

  // Credentials live in nn-config.js — load it before this file.
  const CONFIG = {
    SUPABASE_URL: (window.NN_CONFIG || {}).SUPABASE_URL,
    SUPABASE_ANON_KEY: (window.NN_CONFIG || {}).SUPABASE_ANON_KEY,
  };

  let supabase = null;

  /** Parse a JSON column that may already be an array/object, or be null. */
  function parseJSON(value, fallback) {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (e) { return fallback; }
  }

  /**
   * Collections a recipe belongs to. These are ADDITIVE tags — a recipe keeps
   * its Vegetarian / Non-Vegetarian home and may also appear in others.
   *
   * The database now stores this in `recipes.collections`, but we still derive
   * it when the column is absent or empty, so the site keeps working against
   * an older database and for the offline fallback recipe.
   *
   * High Protein: at least 15 g per serving AND either 20 g+ outright, or
   * protein supplying 20%+ of the calories. Requiring both stops a small
   * dessert qualifying on ratio alone, and a large carb-heavy bowl qualifying
   * on grams alone.
   */
  function deriveCollections(record) {
    const list = [record.type === 'non-veg' ? 'Non-Vegetarian' : 'Vegetarian'];
    const protein = Number(record.protein_g);
    const kcal = Number(record.calories_per_serving);
    const ratio = kcal > 0 ? (protein * 4) / kcal : 0;
    if (protein >= 15 && (protein >= 20 || ratio >= 0.20)) list.push('High Protein');
    return list;
  }

  /** Map one database row onto the shape nn-cards.js expects. */
  function toRecipe(record) {
    const stored = Array.isArray(record.collections) ? record.collections : [];
    return {
      title: record.title,
      category: record.category || 'snack',
      type: record.type || 'veg',
      collections: stored.length ? stored : deriveCollections(record),
      emoji: record.emoji,
      image_url: record.image_url,
      desc: record.description,
      time: record.cook_time,
      servings: record.servings,
      calories: record.calories_per_serving,
      protein: record.protein_g ? `${record.protein_g}g` : null,
      fiber: record.fiber_g ? `${record.fiber_g}g` : null,
      fat: record.fat_g ? `${record.fat_g}g` : null,
      ingredients: parseJSON(record.ingredients, []),
      steps: parseJSON(record.steps, []),
      tip: record.tip,
      whyHealthier: parseJSON(record.why_healthier, []),
      comparison: parseJSON(record.comparison, []),
    };
  }

  /** Create the Supabase client. Safe to call more than once. */
  function initialize() {
    if (supabase) return true;

    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      console.error('SupabaseClient: nn-config.js is missing or loaded too late.');
      return false;
    }
    if (!window.supabase) {
      console.error('SupabaseClient: the Supabase library did not load from the CDN.');
      return false;
    }

    try {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      return !!supabase;
    } catch (error) {
      console.error('SupabaseClient: failed to initialize —', error.message);
      return false;
    }
  }

  function isConnected() {
    return !!supabase;
  }

  /* ---------------- Recipes (public read) ---------------- */

  async function fetchRecipes() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('SupabaseClient: could not fetch recipes —', error.message);
      return [];
    }
    return (data || []).map(toRecipe);
  }

  async function fetchRecipesByType(type) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('SupabaseClient: could not fetch recipes by type —', error.message);
      return [];
    }
    return (data || []).map(toRecipe);
  }

  /* ---------------- Public form submissions ---------------- */

  async function submitSuggestion(formData) {
    if (!supabase) return { success: false, error: 'Not connected' };
    const { data, error } = await supabase.from('recipe_suggestions').insert([{
      user_name: formData.name,
      user_email: formData.email,
      food_name: formData.foodName,
      category: formData.category,
      dietary_preference: formData.dietary,
      reason: formData.reason,
      status: 'pending',
    }]);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async function submitContact(formData) {
    if (!supabase) return { success: false, error: 'Not connected' };
    const { data, error } = await supabase.from('contact_submissions').insert([{
      user_name: formData.name,
      user_email: formData.email,
      subject: formData.subject,
      message: formData.message,
      status: 'new',
    }]);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  return {
    initialize,
    isConnected,
    fetchRecipes,
    fetchRecipesByType,
    submitSuggestion,
    submitContact,
    getConfig: () => CONFIG,
  };
})();

window.SupabaseClient = SupabaseClient;

/* Wait for the Supabase CDN library, then connect. */
(function waitForLib(attempt) {
  if (window.supabase) {
    SupabaseClient.initialize();
  } else if (attempt < 20) {
    setTimeout(() => waitForLib(attempt + 1), 250);
  } else {
    console.error('SupabaseClient: the Supabase library failed to load from the CDN.');
  }
})(0);
