/* ===================================================================
   NOURISH N NARRATE — SITE CONFIG
   Single source of truth for the Supabase connection.

   Load this BEFORE supabase-client.js / nn-auth.js on every page:
     <script src="nn-config.js"></script>

   The anon (publishable) key is designed to be public — it only ever
   grants what the Row Level Security policies allow. Every table in
   this project has RLS enabled, so users can only read public data
   (recipes, food/exercise libraries, meal plans) and read/write their
   own rows (saved_results, daily_logs, weight_logs).

   Project: nourishnnarrate6-cmyk's Project  (ref: qonuiowgfwhgqnojzjxy)
=================================================================== */
(function (w) {
  'use strict';

  w.NN_CONFIG = {
    SUPABASE_URL: 'https://qonuiowgfwhgqnojzjxy.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbnVpb3dnZndoZ3Fub2p6anh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYzNDQsImV4cCI6MjA5OTUyMjM0NH0.u2SxUdFzufbJk9L0WHASepfvHcxw-RiwqufemQ3ywFs',
  };

  /* Fundraising figures. Single source of truth: donate.html and the
     admin dashboard both read these, so the number is only ever edited
     in one place. Update `raised` as donations come in. */
  w.NN_CONFIG.DONATIONS = { raised: 643, goal: 10000 };

  /* Public storage bucket that holds every recipe photo. */
  w.NN_CONFIG.STORAGE_URL = w.NN_CONFIG.SUPABASE_URL + '/storage/v1/object/public/recipe-images/';
})(window);
