/* ===================================================================
   NOURISH N NARRATE — AUTH + SAVED RESULTS + DAILY TRACKER
   Shared helper for login.html, calculator.html, profile.html
   and tracker.html.

   Uses Supabase Auth (email + password) plus two RLS-protected
   tables (users only ever see their own rows):
     saved_results — calculator runs (inputs + results as JSON)
     daily_logs    — food / exercise entries for the tracker

   Public API (window.NNAuth):
     onReady(cb)              — run cb once the Supabase client exists
     getSession()             — current session or null
     signUp / signIn / signOut
     saveResult(inputs, results)
     getLatestResult()        — most recent saved run or null
     getAllResults()          — every saved run, newest first
     deleteResult(id)
     getLogs(dateStr)         — entries for one day (YYYY-MM-DD)
     addLog(dateStr, kind, name, calories)
     deleteLog(id)
     generateRecipe(spec)     — AI Recipe Creator (create-recipe function)
     saveAiRecipe / getAiRecipes / deleteAiRecipe
=================================================================== */

const NNAuth = (() => {

  /* Credentials live in nn-config.js — load it before this file. */
  const CFG = window.NN_CONFIG || {};
  const SUPABASE_URL = CFG.SUPABASE_URL;
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('NNAuth: nn-config.js is missing or was loaded after nn-auth.js.');
  }

  let client = null;
  const readyCallbacks = [];

  /* Wait for the Supabase CDN library, then create the client. */
  (function waitForLib(attempt) {
    if (window.supabase) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { storageKey: 'nn-auth' }, // own storage key — avoids clashing with the recipes client
      });
      readyCallbacks.splice(0).forEach(cb => { try { cb(client); } catch (e) { console.error(e); } });
    } else if (attempt < 20) {
      setTimeout(() => waitForLib(attempt + 1), 300);
    } else {
      console.error('NNAuth: Supabase library failed to load from CDN.');
    }
  })(0);

  function onReady(cb) {
    if (client) cb(client); else readyCallbacks.push(cb);
  }

  /* ---------------- Auth ---------------- */

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session || null;
  }

  async function signUp(email, password) {
    // After the user clicks the confirmation email, send them back to our
    // login page (works when the site is served over http/https and the URL
    // is allow-listed in Supabase → Authentication → URL Configuration).
    const options = {};
    try {
      if (location.protocol === 'http:' || location.protocol === 'https:') {
        options.emailRedirectTo = new URL('login.html', location.href).href;
      }
    } catch (e) { /* fall back to the project Site URL */ }
    const { data, error } = await client.auth.signUp({ email, password, options });
    if (error) return { ok: false, message: error.message };
    // If email confirmation is enabled, there is no session yet.
    if (!data.session) {
      return { ok: true, needsConfirm: true, message: 'Account created! Check your email to confirm, then sign in.' };
    }
    return { ok: true, session: data.session };
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, session: data.session };
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  /* ---------------- Saved calculator plans ---------------- */

  /** Save one calculator run for the signed-in user. */
  async function saveResult(inputs, results) {
    const session = await getSession();
    if (!session) return { ok: false, message: 'Please log in first.' };
    const { error } = await client.from('saved_results').insert([{ inputs, results }]);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  /** Fetch the most recent saved run for the signed-in user. */
  async function getLatestResult() {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await client
      .from('saved_results')
      .select('id, inputs, results, created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || !data.length) return null;
    return data[0];
  }

  /** Fetch every saved run for the signed-in user, newest first. */
  async function getAllResults() {
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('saved_results')
      .select('id, inputs, results, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data;
  }

  /** Delete one saved run by id (RLS ensures it must belong to the user). */
  async function deleteResult(id) {
    const { error } = await client.from('saved_results').delete().eq('id', id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  /* ---------------- Daily tracker logs ---------------- */

  /** Fetch all food/exercise entries for one day (dateStr = 'YYYY-MM-DD'). */
  async function getLogs(dateStr) {
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('daily_logs')
      .select('id, kind, name, calories, log_date')
      .eq('log_date', dateStr)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data;
  }

  /** Add one entry. kind = 'food' | 'exercise'. */
  async function addLog(dateStr, kind, name, calories) {
    const session = await getSession();
    if (!session) return { ok: false, message: 'Please log in first.' };
    const { error } = await client.from('daily_logs').insert([{
      log_date: dateStr, kind, name, calories: Math.round(calories),
    }]);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  /** Delete one entry by id. */
  async function deleteLog(id) {
    const { error } = await client.from('daily_logs').delete().eq('id', id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  /* ---------------- Weight check-ins ---------------- */

  /** Save (or update) the weight for one day. weightKg in kilograms. */
  async function saveWeight(dateStr, weightKg) {
    const session = await getSession();
    if (!session) return { ok: false, message: 'Please log in first.' };
    const { error } = await client.from('weight_logs').upsert(
      [{ user_id: session.user.id, log_date: dateStr, weight_kg: weightKg }],
      { onConflict: 'user_id,log_date' }
    );
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  /** Fetch recent weight entries, oldest → newest. */
  async function getWeights(limit) {
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('weight_logs')
      .select('log_date, weight_kg')
      .order('log_date', { ascending: false })
      .limit(limit || 60);
    if (error || !data) return [];
    return data.reverse();
  }

  /* #2 EXTRA FEATURE: history for streaks / weekly chart / recent foods */
  /** Fetch all log entries since a date (oldest first). */
  async function getLogsSince(sinceDateStr) {
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('daily_logs')
      .select('log_date, kind, name, calories')
      .gte('log_date', sinceDateStr)
      .order('log_date', { ascending: true });
    if (error || !data) return [];
    return data;
  }
  /* end #2 EXTRA FEATURE */

  /* ---------------- Site recipes (public read) ---------------- */

  /** Fetch the site's recipes (title, category, type, calories). */
  async function getRecipes() {
    if (!client) return [];
    const { data, error } = await client
      .from('recipes')
      .select('title, category, type, emoji, calories_per_serving')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data;
  }

  /* ---------------- Photo AI (Gemini via Edge Function) ---------------- */

  /** Analyze a food photo server-side. imageBase64 = raw base64, no data: prefix.
      phash = optional 64-char perceptual hash so the server can reuse a saved
      scan of a visually-similar photo instead of re-analyzing. */
  async function analyzeFoodPhoto(imageBase64, mime, phash) {
    if (!client) return { ok: false, reason: 'no_client' };
    try {
      const body = { image: imageBase64, mime: mime || 'image/jpeg' };
      if (phash) body.phash = phash;
      const { data, error } = await client.functions.invoke('analyze-food', { body: body });
      if (error) return { ok: false, reason: error.message || 'invoke_failed' };
      if (!data || data.error) return { ok: false, reason: (data && data.error) || 'empty' };
      return {
        ok: true,
        foods: data.foods || [],
        cached: !!data.cached,
        model: data.model,
        scanId: data.scan_id || null,
        mealTotal: typeof data.mealTotal === 'number' ? data.mealTotal : null,
        refined: !!data.refined,
      };
    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  /** Push a user's calorie correction back into the shared scan cache so future
      similar photos benefit. Best-effort — callers should not block on it. */
  async function correctFoodScan(scanId, foodName, calories) {
    if (!client || !scanId) return { ok: false };
    try {
      const { data, error } = await client.functions.invoke('correct-scan', {
        body: { scan_id: scanId, food_name: foodName, calories: calories },
      });
      if (error || !data || data.error) return { ok: false };
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  /* ---------------- Reference libraries & meal plans ---------------- */

  /** Food library (name + typical-serving kcal), public read. */
  async function getFoodLibrary() {
    if (!client) return [];
    const { data, error } = await client
      .from('food_library').select('name, kcal').order('name');
    if (error || !data) return [];
    return data;
  }

  /** Exercise library (name + MET), public read. */
  async function getExerciseLibrary() {
    if (!client) return [];
    const { data, error } = await client
      .from('exercise_library').select('name, met').order('name');
    if (error || !data) return [];
    return data;
  }

  /** Curated meal plans for one goal ('lose' | 'maintain' | 'gain'). */
  async function getMealPlans(goal) {
    if (!client) return [];
    const { data, error } = await client
      .from('meal_plans').select('day_index, items')
      .eq('goal', goal).order('day_index');
    if (error || !data) return [];
    return data;
  }

  /* ---------------- AI Recipe Creator ----------------
     Generated recipes live in their own table, ai_recipes, and are private
     to the person who made them. The curated `recipes` table is never
     written to from the browser — that separation is what keeps AI output
     out of the collections, the pantry matcher and the site's search. */

  /** Generate one recipe from a spec. Resolves to either
        { ok:true, feasible:true,  recipe }
        { ok:true, feasible:false, problem, suggestions }  — could not be done
        { ok:false, reason }                               — call failed
      Never throws. */
  async function generateRecipe(spec) {
    if (!client) return { ok: false, reason: 'no_client' };
    try {
      const { data, error } = await client.functions.invoke('create-recipe', { body: spec || {} });
      if (error) return { ok: false, reason: error.message || 'invoke_failed' };
      if (!data || data.error) return { ok: false, reason: (data && data.error) || 'empty' };
      if (data.feasible === false) {
        return {
          ok: true, feasible: false,
          problem: data.problem || '',
          suggestions: data.suggestions || [],
        };
      }
      if (!data.recipe) return { ok: false, reason: 'empty' };
      return { ok: true, feasible: true, recipe: data.recipe, model: data.model };
    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  /** Store a generated recipe against the signed-in user. */
  async function saveAiRecipe(recipe, spec) {
    if (!client) return { ok: false, message: 'Not connected.' };
    const session = await getSession();
    if (!session) return { ok: false, message: 'Please log in first.' };
    const { data, error } = await client.from('ai_recipes')
      .insert({
        user_id: session.user.id,
        title: recipe.title,
        payload: recipe,
        spec: spec || null,
      })
      .select('id, created_at')
      .single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, id: data.id, created_at: data.created_at };
  }

  /** Every recipe this user has saved, newest first. */
  async function getAiRecipes() {
    if (!client) return [];
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('ai_recipes')
      .select('id, title, payload, spec, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data;
  }

  async function deleteAiRecipe(id) {
    if (!client) return { ok: false };
    const { error } = await client.from('ai_recipes').delete().eq('id', id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  /* ---------------- Favourites ----------------
     Mirrors the AI assistant's localStorage favourites for signed-in
     users. The browser copy still drives ranking; this one exists so
     favourites survive a change of device, and so the admin dashboard
     has something to count. */

  /** Add or remove one favourite. Silent no-op when signed out. */
  async function setFavorite(title, on) {
    if (!client || !title) return { ok: false };
    try {
      const session = await getSession();
      if (!session) return { ok: false, message: 'Not signed in.' };
      if (on) {
        const { error } = await client.from('favorites')
          .upsert({ user_id: session.user.id, recipe_title: title },
                  { onConflict: 'user_id,recipe_title' });
        return { ok: !error };
      }
      const { error } = await client.from('favorites')
        .delete().eq('user_id', session.user.id).eq('recipe_title', title);
      return { ok: !error };
    } catch (e) {
      return { ok: false };
    }
  }

  /** This user's saved favourites, newest first. */
  async function getFavorites() {
    if (!client) return [];
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('favorites').select('recipe_title, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(r => r.recipe_title);
  }

  /* ---------------- Admin dashboard ----------------
     Each of these is refused by the database for a non-admin, so calling
     them from the browser gets an ordinary user nothing. */

  /** True when the signed-in account is an administrator. */
  async function isAdmin() {
    if (!client) return false;
    try {
      const { data, error } = await client.rpc('is_admin');
      return !error && data === true;
    } catch (e) {
      return false;
    }
  }

  /** Call one admin_* aggregation function. Returns null when refused. */
  async function adminStats(fn, arg) {
    if (!client) return null;
    try {
      const { data, error } = await client.rpc(fn,
        fn === 'admin_overview' ? { days: arg || 30 } : { top_n: arg || 10 });
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  return {
    onReady, getSession, signUp, signIn, signOut,
    saveResult, getLatestResult, getAllResults, deleteResult,
    getLogs, addLog, deleteLog,
    saveWeight, getWeights, getRecipes,
    getFoodLibrary, getExerciseLibrary, getMealPlans,
    analyzeFoodPhoto, correctFoodScan,
    generateRecipe, saveAiRecipe, getAiRecipes, deleteAiRecipe,
    setFavorite, getFavorites,
    isAdmin, adminStats,
    getLogsSince, /* #2 EXTRA FEATURE */
  };
})();

window.NNAuth = NNAuth;
