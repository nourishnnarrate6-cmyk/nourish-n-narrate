# Supabase Integration — Quick Start Checklist

## Phase 1: Supabase Project Setup (15 min)

- [ ] Go to [supabase.com](https://supabase.com) and create account
- [ ] Click "New Project"
- [ ] Fill in: Name, Database Password, Region
- [ ] Wait for project deployment (1-2 min)
- [ ] Click **Settings** → **API**
- [ ] Copy and save:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

---

## Phase 2: Database Setup (10 min)

- [ ] In Supabase, click **SQL Editor**
- [ ] Click **"New Query"**
- [ ] Copy entire SQL schema from `SUPABASE_SETUP.md`
- [ ] Paste into SQL Editor
- [ ] Click **Run** (or Ctrl+Enter)
- [ ] Wait for completion (should see "Date Ladoo" sample recipe)

---

## Phase 3: Code Integration (10 min)

### Update supabase-client.js

- [ ] Open `supabase-client.js`
- [ ] Find line ~10 with `const CONFIG = {`
- [ ] Replace `SUPABASE_URL` with your project URL
  ```javascript
  SUPABASE_URL: 'https://xxxxx.supabase.co',
  ```
- [ ] Replace `SUPABASE_ANON_KEY` with your anon key
  ```javascript
  SUPABASE_ANON_KEY: 'eyJhbGc...',
  ```
- [ ] Save file

### Update index.html

- [ ] Open `index.html` in editor
- [ ] Find the `<head>` section
- [ ] Locate: `<script src="recipes-data.js"></script>` (old line)
- [ ] **DELETE** that line
- [ ] **ADD** these 4 lines after `<link rel="stylesheet" href="nn-styles.css">`:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase-client.js"></script>
  <script src="recipes-data-supabase.js"></script>
  <script src="form-handlers.js"></script>
  <script src="nn-cards.js"></script>
  ```
- [ ] Save file

### Update all-recipes.html

- [ ] Repeat the same changes as index.html
- [ ] Delete old `recipes-data.js` script tag
- [ ] Add the 4 new script tags
- [ ] Save file

---

## Phase 4: Testing (10 min)

- [ ] Open `index.html` in browser
- [ ] Press **F12** to open Developer Tools
- [ ] Click **Console** tab
- [ ] Look for:
  - ✅ `"✓ Supabase client initialized"`
  - ✅ `"Loading recipes from Supabase..."`
  - ✅ `"✓ Loaded X recipes from Supabase"`
  - ❌ Any red errors?

### If you see errors:

1. **"Supabase library not loaded"**
   - Check that Supabase CDN script is BEFORE supabase-client.js

2. **"fetch failed" / "CORS"**
   - Go to Supabase Settings → API → CORS
   - Add your domain (e.g., `http://localhost:3000` for local testing)

3. **"Permission denied"**
   - Go to Supabase and manually check recipes table
   - Verify "Date Ladoo" recipe exists

4. **No recipes loading**
   - Check if recipes table in Supabase has data
   - Check browser console for exact error message

---

## Phase 5: Form Testing (5 min)

### Locate your contact or suggestion form in the HTML

- [ ] Find the form element
- [ ] Add `data-form-type="contact"` or `data-form-type="suggestion"` attribute:
  ```html
  <form data-form-type="contact">
    <!-- form fields -->
  </form>
  ```

- [ ] Ensure form has these input names (for contact):
  - `name` — user's name
  - `email` — user's email
  - `subject` — message subject (optional)
  - `message` — message body

- [ ] For suggestions, these input names:
  - `name`
  - `email`
  - `foodName`
  - `category`
  - `dietary`
  - `reason`

### Test submission:

- [ ] Fill out form and submit
- [ ] You should see a success message (green box)
- [ ] Go to Supabase → Table Editor
- [ ] Click **contact_submissions** or **recipe_suggestions**
- [ ] Verify your test data appears

---

## Phase 6: Optional Enhancements (Later)

- [ ] Add image uploads to recipes (using Supabase Storage)
- [ ] Build admin panel to manage recipes and submissions
- [ ] Set up email notifications for form submissions
- [ ] Add authentication for admin users
- [ ] Implement recipe search/filter by category
- [ ] Add pagination for large recipe lists

---

## Troubleshooting Quick Guide

| Problem | Solution |
|---------|----------|
| No recipes appear | Check Supabase URL/key in supabase-client.js |
| "CORS Error" | Add your domain to Supabase CORS settings |
| Form won't submit | Add `data-form-type` attribute to form element |
| "Permission denied" | Verify RLS policies allow public SELECT/INSERT |
| Scripts not loading | Check file paths are correct and files exist |
| Recipes load but forms don't | Check form-handlers.js is included in HTML |

---

## Files You've Added

```
✓ supabase-client.js           — Supabase connection & API
✓ recipes-data-supabase.js     — Load recipes from database
✓ form-handlers.js              — Handle form submissions
✓ SUPABASE_SETUP.md             — Complete setup guide
✓ SUPABASE_INTEGRATION.md       — API reference & architecture
✓ SUPABASE_QUICK_START.md       — This file
✓ INDEX_SUPABASE_HEAD_EXAMPLE.html — Example of updated HTML
```

---

## Success Indicators

Once everything is working, you should see:

✅ Recipes load from Supabase (not hardcoded)
✅ Recipe cards display correctly
✅ Modal opens when clicking recipe
✅ Form submissions save to Supabase
✅ No errors in browser console
✅ Data appears in Supabase dashboard

---

## Next Steps

1. ✅ Complete all checkboxes above
2. ✅ Test thoroughly in multiple browsers
3. ✅ Set up CORS for your production domain
4. ✅ Configure RLS policies for production
5. ✅ Deploy to your hosting (Vercel, Netlify, etc.)
6. ✅ Monitor Supabase dashboard for user submissions

---

## Need Help?

- **Supabase Issues**: [supabase.com/docs](https://supabase.com/docs)
- **JavaScript Errors**: Open browser console (F12 → Console)
- **Database Questions**: Check Supabase Table Editor

**You're all set! 🚀**
