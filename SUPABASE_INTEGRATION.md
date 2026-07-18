# Supabase Integration Guide — Nourish N Narrate

## Overview

This guide explains how to integrate Supabase into your Nourish N Narrate website to:
- Store and manage recipes dynamically
- Collect user recipe suggestions
- Store contact form submissions
- Enable real-time updates and admin management

---

## Architecture

### Data Flow

```
User visits website
         ↓
index.html loads supabase-client.js
         ↓
SupabaseClient.initialize() connects to Supabase
         ↓
recipes-data-supabase.js calls loadRecipesFromSupabase()
         ↓
SupabaseClient.fetchRecipes() retrieves from database
         ↓
RECIPES array populated globally
         ↓
nn-cards.js displays recipe cards from RECIPES
         ↓
User submits form (suggestion/contact)
         ↓
FormHandlers catches submission
         ↓
SupabaseClient.submitSuggestion() or submitContact()
         ↓
Data stored in Supabase database
         ↓
User gets success/error feedback
```

### Files Structure

```
OIP/
├── index.html                    # Main page (updated with scripts)
├── all-recipes.html              # Recipe listing page (updated with scripts)
├── nn-cards.js                   # (unchanged) Card/modal logic
├── nn-styles.css                 # (unchanged) Styles
├── supabase-client.js            # NEW: Supabase connection & API
├── recipes-data-supabase.js      # NEW: Fetch recipes from DB
├── form-handlers.js              # NEW: Handle form submissions
├── SUPABASE_SETUP.md             # Setup instructions
└── SUPABASE_INTEGRATION.md       # This file
```

---

## Quick Start

### 1. Set Up Supabase (Complete First)

Follow **SUPABASE_SETUP.md** step by step:
- Create a Supabase project
- Get your API keys
- Create database tables (run the SQL)
- Note your `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### 2. Update Configuration

Edit **supabase-client.js** (line ~10):

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://yourproject.supabase.co',      // ← Replace this
  SUPABASE_ANON_KEY: 'eyJhbGc...your_key_here',          // ← Replace this
};
```

### 3. Add Script Tags to HTML

Add these to the `<head>` of **index.html** and **all-recipes.html**:

```html
<!-- Supabase Library -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Nourish N Narrate Supabase Integration -->
<script src="supabase-client.js"></script>
<script src="recipes-data-supabase.js"></script>
<script src="form-handlers.js"></script>

<!-- Card Logic (unchanged) -->
<script src="nn-cards.js"></script>
```

### 4. Update Recipe Forms (Optional)

For your contact and suggestion forms, add `data-form-type` attribute:

```html
<!-- Suggestion Form -->
<form data-form-type="suggestion">
  <input type="text" name="name" placeholder="Your name" required />
  <input type="email" name="email" placeholder="Your email" required />
  <input type="text" name="foodName" placeholder="Food to recreate" required />
  <select name="category">
    <option value="">Category</option>
    <option value="breakfast">Breakfast</option>
    <option value="lunch">Lunch</option>
    <option value="dinner">Dinner</option>
    <option value="snack">Snack</option>
  </select>
  <select name="dietary">
    <option value="veg">Vegetarian</option>
    <option value="non-veg">Non-Vegetarian</option>
  </select>
  <textarea name="reason" placeholder="Why would you like this?"></textarea>
  <button type="submit">Submit Suggestion</button>
</form>

<!-- Contact Form -->
<form data-form-type="contact">
  <input type="text" name="name" placeholder="Your name" required />
  <input type="email" name="email" placeholder="Your email" required />
  <input type="text" name="subject" placeholder="Subject (optional)" />
  <textarea name="message" placeholder="Your message" required></textarea>
  <button type="submit">Send Message</button>
</form>
```

### 5. Done!

Now when users visit your site:
- ✓ Recipes load from Supabase
- ✓ Suggestions/contact forms save to database
- ✓ You can manage everything from Supabase dashboard

---

## API Reference

### SupabaseClient

#### `SupabaseClient.initialize()`
Initialize the Supabase connection. Called automatically on page load if keys are configured.

```javascript
const success = SupabaseClient.initialize();
if (success) console.log('Connected to Supabase');
```

#### `SupabaseClient.fetchRecipes()`
Get all recipes from the database.

```javascript
const recipes = await SupabaseClient.fetchRecipes();
console.log(`Loaded ${recipes.length} recipes`);
```

#### `SupabaseClient.fetchRecipesByType(type)`
Get recipes filtered by diet type.

```javascript
const vegRecipes = await SupabaseClient.fetchRecipesByType('veg');
const nonVegRecipes = await SupabaseClient.fetchRecipesByType('non-veg');
```

#### `SupabaseClient.submitSuggestion(formData)`
Submit a recipe suggestion.

```javascript
const result = await SupabaseClient.submitSuggestion({
  name: 'John Doe',
  email: 'john@example.com',
  foodName: 'Biryani',
  category: 'lunch',
  dietary: 'veg',
  reason: 'Love it but want healthier version'
});

if (result.success) {
  console.log('Submitted!');
} else {
  console.error('Error:', result.error);
}
```

#### `SupabaseClient.submitContact(formData)`
Submit a contact message.

```javascript
const result = await SupabaseClient.submitContact({
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Partnership inquiry',
  message: 'I would like to collaborate...'
});
```

#### `SupabaseClient.addRecipe(recipe)` (Admin)
Add a new recipe to the database.

```javascript
const result = await SupabaseClient.addRecipe({
  title: 'Quinoa Bowls',
  category: 'lunch',
  type: 'veg',
  emoji: '🥗',
  image: 'path/to/image.jpg',
  desc: 'Healthy grain bowl...',
  time: '20 min',
  servings: '2',
  calories: '350',
  protein: 15,
  fiber: 8,
  fat: 12,
  ingredients: ['Quinoa', 'Spinach', ...],
  steps: ['Cook quinoa', 'Assemble bowl', ...],
  tip: 'Cook ahead for meal prep',
  whyHealthier: ['High in protein', 'Full of fiber'],
  comparison: [['White rice', 'Quinoa']]
});
```

#### `SupabaseClient.isConnected()`
Check if Supabase is initialized and ready.

```javascript
if (SupabaseClient.isConnected()) {
  console.log('Connected to Supabase');
}
```

---

### FormHandlers

#### `FormHandlers.handleSuggestionSubmit(formElement)`
Attach handlers to a suggestion form.

```javascript
const form = document.getElementById('suggestion-form');
FormHandlers.handleSuggestionSubmit(form);
```

#### `FormHandlers.handleContactSubmit(formElement)`
Attach handlers to a contact form.

```javascript
const form = document.getElementById('contact-form');
FormHandlers.handleContactSubmit(form);
```

#### `FormHandlers.initializeAllForms()`
Auto-initialize all forms with `data-form-type` attribute. Called automatically on page load.

```javascript
FormHandlers.initializeAllForms();
```

#### `FormHandlers.showMessage(element, message, isSuccess)`
Display a success or error message to the user.

```javascript
FormHandlers.showMessage(formElement, '✓ Success!', true);
FormHandlers.showMessage(formElement, '❌ Error occurred', false);
```

---

### Recipes Data (recipes-data-supabase.js)

#### `loadRecipesFromSupabase()`
Manually trigger loading recipes from Supabase.

```javascript
await loadRecipesFromSupabase();
console.log(RECIPES); // Global variable now populated
```

#### `refreshRecipes()`
Reload recipes from Supabase (useful for refreshing after admin adds a recipe).

```javascript
await refreshRecipes();
```

#### Event: `recipesLoaded`
Listen for when recipes finish loading.

```javascript
window.addEventListener('recipesLoaded', (event) => {
  console.log(`${event.detail.recipeCount} recipes loaded`);
});
```

---

## Database Schema

### Recipes Table

```
id                    BIGSERIAL PRIMARY KEY
title                 VARCHAR(255) NOT NULL UNIQUE
category              VARCHAR(50)  -- breakfast, lunch, dinner, snack
type                  VARCHAR(20)  -- veg, non-veg
emoji                 VARCHAR(10)
image_url             TEXT         -- URL or base64
description           TEXT
cook_time             VARCHAR(50)  -- e.g., "15 min"
servings              VARCHAR(50)
calories_per_serving  INT
protein_g             DECIMAL(5,2)
fiber_g               DECIMAL(5,2)
fat_g                 DECIMAL(5,2)
ingredients           TEXT         -- JSON array
steps                 TEXT         -- JSON array
tip                   TEXT
why_healthier         TEXT         -- JSON array
comparison            TEXT         -- JSON array
created_at            TIMESTAMP    -- auto-set
updated_at            TIMESTAMP    -- auto-set
created_by_admin      BOOLEAN      -- TRUE if added via backend
```

### Recipe Suggestions Table

```
id                    BIGSERIAL PRIMARY KEY
user_name             VARCHAR(255)
user_email            VARCHAR(255)
food_name             VARCHAR(255) NOT NULL
category              VARCHAR(50)
dietary_preference    VARCHAR(20)  -- veg, non-veg, no-preference
reason                TEXT
status                VARCHAR(50)  -- pending, approved, rejected, completed
admin_notes           TEXT
created_at            TIMESTAMP    -- auto-set
updated_at            TIMESTAMP    -- auto-set
```

### Contact Submissions Table

```
id                    BIGSERIAL PRIMARY KEY
user_name             VARCHAR(255)
user_email            VARCHAR(255) NOT NULL
subject               VARCHAR(255)
message               TEXT NOT NULL
status                VARCHAR(50)  -- new, read, replied
admin_reply           TEXT
created_at            TIMESTAMP    -- auto-set
updated_at            TIMESTAMP    -- auto-set
```

---

## Error Handling

### Common Issues & Solutions

#### "Supabase library not loaded"
**Problem:** `<script src="...supabase-js"></script>` missing from HTML
**Solution:** Add CDN script tag before supabase-client.js

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
```

#### "CORS Error" when fetching
**Problem:** Browser blocks request from your domain
**Solution:** Add your domain to Supabase CORS in Settings → API

#### "Permission denied" on insert
**Problem:** RLS policy doesn't allow anonymous inserts
**Solution:** Verify RLS policies are correct (see SUPABASE_SETUP.md)

#### "No recipes load"
**Problem:** Supabase is not initialized or recipes table is empty
**Solution:**
1. Check browser console for errors (F12 → Console)
2. Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
3. Confirm recipes table has data in Supabase
4. Check RLS policy allows SELECT for public

#### "Form submissions not working"
**Problem:** FormHandlers not attached or form structure doesn't match
**Solution:**
1. Ensure form has `data-form-type="suggestion"` or `data-form-type="contact"`
2. Verify input names match expected: name, email, foodName, category, dietary, reason
3. Check browser console for validation errors

---

## Admin Panel (Optional)

Supabase provides a built-in admin dashboard:

1. Log into your Supabase project
2. Go to **Table Editor** to browse/edit data
3. View submissions under **recipe_suggestions** and **contact_submissions**
4. Add recipes by clicking **"Insert row"** in the recipes table
5. Use **API** section to generate admin tokens for backend operations

For production, you may want to build a custom admin panel that:
- Authenticates admins via Supabase Auth
- Shows recipe suggestions with approve/reject buttons
- Displays contact messages with reply functionality
- Provides recipe editing/deletion interface

---

## Offline Fallback

If Supabase is down, `recipes-data-supabase.js` automatically falls back to local recipes defined in `loadFallbackRecipes()`. This ensures users can still view some content.

To customize fallback recipes, edit the RECIPES array in `recipes-data-supabase.js`.

---

## Performance Tips

1. **Cache Recipes**: Consider storing recipes in localStorage after first fetch to reduce database hits
2. **Lazy Load Images**: Use lazy loading for recipe images to improve initial page load
3. **Pagination**: For large recipe lists, implement pagination to fetch recipes in batches
4. **Database Indexes**: The schema includes indexes on category, type, and status fields for faster queries

---

## Security Notes

⚠️ **Important:**

- **Never expose** `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Use **Row Level Security (RLS)** to control data access
- The `SUPABASE_ANON_KEY` is public by design — don't treat it as a secret
- For sensitive admin operations, use a backend server with `SUPABASE_SERVICE_ROLE_KEY`
- Validate all user inputs on the backend (Supabase Functions or API layer)

---

## Troubleshooting Checklist

- [ ] Supabase project created at supabase.com
- [ ] Database tables created (ran SQL schema)
- [ ] API keys copied to supabase-client.js
- [ ] Supabase CDN script added before supabase-client.js
- [ ] HTML forms have `data-form-type` attributes
- [ ] Form input names match expected fields
- [ ] Browser console shows no errors (F12 → Console)
- [ ] Supabase CORS configured for your domain
- [ ] RLS policies set correctly (or temporarily disabled for testing)

---

## Support & Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Community](https://supabase.com/community)
- [JavaScript Client Library Docs](https://supabase.com/docs/reference/javascript)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

## Next Steps

1. ✅ Follow SUPABASE_SETUP.md to create project
2. ✅ Update configuration in supabase-client.js
3. ✅ Add script tags to HTML files
4. ✅ Test recipes load on page visit
5. ✅ Test form submissions
6. ✅ Monitor Supabase dashboard for data
7. ✅ Set up admin panel or monitoring (optional)
8. ✅ Deploy to production with proper CORS settings

---

**Version**: 1.0  
**Last Updated**: July 2026  
**Compatibility**: All modern browsers with ES6 support
