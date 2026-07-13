/* ===================================================================
   SUPABASE CLIENT — Initialize and manage Supabase connection
   This module handles all communication with the Supabase backend.

   Usage:
   - Import and initialize with your API keys
   - Use SupabaseClient.fetchRecipes() to get all recipes
   - Use SupabaseClient.submitSuggestion() for food suggestions
   - Use SupabaseClient.submitContact() for contact forms
=================================================================== */

const SupabaseClient = (() => {

  // ✏️ CONFIGURATION — Replace these with your actual Supabase credentials
  const CONFIG = {
    SUPABASE_URL: 'https://qonuiowgfwhgqnojzjxy.supabase.co', // Your project URL
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbnVpb3dnZndoZ3Fub2p6anh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYzNDQsImV4cCI6MjA5OTUyMjM0NH0.u2SxUdFzufbJk9L0WHASepfvHcxw-RiwqufemQ3ywFs', // Your anon public key
  };

  // Store the supabase instance
  let supabase = null;

  /**
   * Initialize Supabase client
   * Must be called once before any other operations
   */
  function initialize() {
    console.log('Attempting to initialize Supabase...');
    console.log('window.supabase available?', !!window.supabase);
    console.log('CONFIG:', CONFIG);

    if (!window.supabase) {
      console.error('❌ Supabase library not loaded. CDN script may have failed to load.');
      console.error('Make sure <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> is in HTML');
      return false;
    }

    try {
      console.log('Creating Supabase client with:', CONFIG.SUPABASE_URL);
      // Use the correct Supabase method
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

      if (!supabase) {
        console.error('❌ createClient returned null/undefined');
        return false;
      }

      console.log('✓ Supabase client initialized', supabase);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      console.error('Error details:', error.message, error.stack);
      return false;
    }
  }

  /**
   * Fetch all recipes from Supabase database
   * Converts database records to the format expected by nn-cards.js
   * @returns {Promise<Array>} Array of recipe objects
   */
  async function fetchRecipes() {
    if (!supabase) {
      console.warn('Supabase not initialized. Returning empty array.');
      return [];
    }

    try {
      console.log('Fetching recipes from Supabase...');
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: true });

      console.log('Supabase response - data:', data, 'error:', error);

      if (error) {
        console.error('Error fetching recipes:', error);
        return [];
      }

      console.log('Raw recipes data from Supabase:', data);

      // Transform database records to match nn-cards.js format
      return data.map(record => ({
        title: record.title,
        category: record.category || 'snack',
        type: record.type || 'veg',
        emoji: record.emoji,
        image_url: record.image_url,
        desc: record.description,
        time: record.cook_time,
        servings: record.servings,
        calories: record.calories_per_serving,
        protein: record.protein_g ? `${record.protein_g}g` : null,
        fiber: record.fiber_g ? `${record.fiber_g}g` : null,
        fat: record.fat_g ? `${record.fat_g}g` : null,
        ingredients: record.ingredients ? JSON.parse(record.ingredients) : [],
        steps: record.steps ? JSON.parse(record.steps) : [],
        tip: record.tip,
        whyHealthier: record.why_healthier ? JSON.parse(record.why_healthier) : [],
        comparison: record.comparison ? JSON.parse(record.comparison) : [],
      }));
    } catch (error) {
      console.error('Unexpected error in fetchRecipes:', error);
      return [];
    }
  }

  /**
   * Fetch recipes filtered by diet type (veg/non-veg)
   * @param {string} type - 'veg' or 'non-veg'
   * @returns {Promise<Array>} Filtered recipe objects
   */
  async function fetchRecipesByType(type) {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching recipes by type:', error);
        return [];
      }

      return data.map(record => ({
        title: record.title,
        category: record.category || 'snack',
        type: record.type || 'veg',
        emoji: record.emoji,
        image_url: record.image_url,
        desc: record.description,
        time: record.cook_time,
        servings: record.servings,
        calories: record.calories_per_serving,
        protein: record.protein_g ? `${record.protein_g}g` : null,
        fiber: record.fiber_g ? `${record.fiber_g}g` : null,
        fat: record.fat_g ? `${record.fat_g}g` : null,
        ingredients: record.ingredients ? JSON.parse(record.ingredients) : [],
        steps: record.steps ? JSON.parse(record.steps) : [],
        tip: record.tip,
        whyHealthier: record.why_healthier ? JSON.parse(record.why_healthier) : [],
        comparison: record.comparison ? JSON.parse(record.comparison) : [],
      }));
    } catch (error) {
      console.error('Error in fetchRecipesByType:', error);
      return [];
    }
  }

  /**
   * Submit a recipe suggestion (from "Suggest a Food" form)
   * @param {Object} formData - { name, email, foodName, category, dietary, reason }
   * @returns {Promise<Object>} { success: boolean, error?: string, data?: Object }
   */
  async function submitSuggestion(formData) {
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('recipe_suggestions')
        .insert([{
          user_name: formData.name,
          user_email: formData.email,
          food_name: formData.foodName,
          category: formData.category,
          dietary_preference: formData.dietary,
          reason: formData.reason,
          status: 'pending',
        }]);

      if (error) {
        console.error('Error submitting suggestion:', error);
        return { success: false, error: error.message };
      }

      console.log('✓ Suggestion submitted:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Unexpected error in submitSuggestion:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit a contact form message
   * @param {Object} formData - { name, email, subject, message }
   * @returns {Promise<Object>} { success: boolean, error?: string, data?: Object }
   */
  async function submitContact(formData) {
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .insert([{
          user_name: formData.name,
          user_email: formData.email,
          subject: formData.subject,
          message: formData.message,
          status: 'new',
        }]);

      if (error) {
        console.error('Error submitting contact:', error);
        return { success: false, error: error.message };
      }

      console.log('✓ Contact message submitted:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Unexpected error in submitContact:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add a new recipe (admin only)
   * Note: In production, this should be protected by backend authentication
   * @param {Object} recipe - Full recipe object
   * @returns {Promise<Object>} { success: boolean, error?: string }
   */
  async function addRecipe(recipe) {
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert([{
          title: recipe.title,
          category: recipe.category,
          type: recipe.type,
          emoji: recipe.emoji,
          image_url: recipe.image,
          description: recipe.desc,
          cook_time: recipe.time,
          servings: recipe.servings,
          calories_per_serving: recipe.calories,
          protein_g: recipe.protein ? parseFloat(recipe.protein) : null,
          fiber_g: recipe.fiber ? parseFloat(recipe.fiber) : null,
          fat_g: recipe.fat ? parseFloat(recipe.fat) : null,
          ingredients: JSON.stringify(recipe.ingredients || []),
          steps: JSON.stringify(recipe.steps || []),
          tip: recipe.tip,
          why_healthier: JSON.stringify(recipe.whyHealthier || []),
          comparison: JSON.stringify(recipe.comparison || []),
          created_by_admin: true,
        }]);

      if (error) {
        console.error('Error adding recipe:', error);
        return { success: false, error: error.message };
      }

      console.log('✓ Recipe added:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Unexpected error in addRecipe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all recipe suggestions (admin only in production)
   * @returns {Promise<Array>} All suggestions
   */
  async function getSuggestions() {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('recipe_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching suggestions:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Unexpected error in getSuggestions:', error);
      return [];
    }
  }

  /**
   * Get all contact submissions (admin only in production)
   * @returns {Promise<Array>} All contact submissions
   */
  async function getContacts() {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Unexpected error in getContacts:', error);
      return [];
    }
  }

  /**
   * Check if Supabase is connected
   * @returns {boolean} True if initialized and ready
   */
  function isConnected() {
    const connected = supabase !== null && supabase !== undefined;
    console.log('isConnected() check:', connected, 'supabase object exists:', !!supabase);
    return connected;
  }

  // Public API
  return {
    initialize,
    fetchRecipes,
    fetchRecipesByType,
    submitSuggestion,
    submitContact,
    addRecipe,
    getSuggestions,
    getContacts,
    isConnected,
    // Expose config for testing/debugging
    getConfig: () => CONFIG,
    setConfig: (newConfig) => Object.assign(CONFIG, newConfig),
  };
})();

// Expose SupabaseClient globally so other scripts can access it
window.SupabaseClient = SupabaseClient;
console.log('✓ SupabaseClient exposed to window');

// Auto-initialize on script load (if keys are set)
// Wait for Supabase library to load from CDN
function waitForSupabase(maxAttempts = 10, delay = 500) {
  let attempts = 0;

  const checkSupabase = () => {
    attempts++;
    console.log(`Checking for Supabase library... (attempt ${attempts}/${maxAttempts})`);

    if (window.supabase) {
      console.log('✓ Supabase library found! Initializing...');
      if (SupabaseClient.getConfig().SUPABASE_URL !== 'https://xxxxx.supabase.co') {
        SupabaseClient.initialize();
      }
    } else if (attempts < maxAttempts) {
      setTimeout(checkSupabase, delay);
    } else {
      console.error('❌ Supabase library failed to load from CDN after ' + maxAttempts + ' attempts');
      console.error('This may be a network issue. Check your internet connection.');
    }
  };

  checkSupabase();
}

document.addEventListener('DOMContentLoaded', () => {
  waitForSupabase();
});
