# Supabase Setup Guide for Nourish N Narrate

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"** or sign in
3. Click **"New project"**
4. Fill in the form:
   - **Name**: `nourish-n-narrate` (or your preference)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
5. Click **"Create new project"** and wait 1-2 minutes for deployment

---

## Step 2: Get Your API Keys

After your project is created:

1. Click the **Settings** icon (gear) in the bottom left
2. Select **API** from the left sidebar
3. Copy these values and save them somewhere safe:
   - **Project URL** (under "Configuration")
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys") — keep this SECRET!

Your `.env` file (create at project root) should look like:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...xxxxx
```

---

## Step 3: Create Database Tables

1. In Supabase, click **SQL Editor** in the left sidebar
2. Click **"New Query"**
3. Copy and paste the SQL schema below
4. Click **"Run"** or press `Ctrl+Enter`

### Complete SQL Schema

```sql
-- =====================================================================
-- RECIPES TABLE — stores all recipes with nutritional data
-- =====================================================================
CREATE TABLE IF NOT EXISTS recipes (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL, -- "breakfast", "lunch", "dinner", "snack"
  type VARCHAR(20) NOT NULL DEFAULT 'veg', -- "veg" or "non-veg"
  emoji VARCHAR(10),
  image_url TEXT, -- URL to image or base64 data URL
  description TEXT,
  cook_time VARCHAR(50), -- e.g., "15 min"
  servings VARCHAR(50),
  calories_per_serving INT,
  protein_g DECIMAL(5,2),
  fiber_g DECIMAL(5,2),
  fat_g DECIMAL(5,2),
  ingredients TEXT, -- JSON array: ["item1", "item2", ...]
  steps TEXT, -- JSON array: ["step1", "step2", ...]
  tip TEXT,
  why_healthier TEXT, -- JSON array: ["point1", "point2", ...]
  comparison TEXT, -- JSON array: [["original", "our version"], ...]
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by_admin BOOLEAN DEFAULT FALSE
);

-- =====================================================================
-- RECIPE SUGGESTIONS TABLE — user-submitted food requests
-- =====================================================================
CREATE TABLE IF NOT EXISTS recipe_suggestions (
  id BIGSERIAL PRIMARY KEY,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  food_name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  dietary_preference VARCHAR(20), -- "veg", "non-veg", "no-preference"
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- "pending", "approved", "rejected", "completed"
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- =====================================================================
-- CONTACT SUBMISSIONS TABLE — general contact form submissions
-- =====================================================================
CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGSERIAL PRIMARY KEY,
  user_name VARCHAR(255),
  user_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new', -- "new", "read", "replied"
  admin_reply TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- RECIPES: Everyone can read, only admins can write/update/delete
CREATE POLICY "Recipes are publicly readable" ON recipes
  FOR SELECT USING (true);

-- RECIPE_SUGGESTIONS: Everyone can insert, only admins can view all
CREATE POLICY "Anyone can submit suggestions" ON recipe_suggestions
  FOR INSERT WITH CHECK (true);

-- CONTACT_SUBMISSIONS: Everyone can insert, only admins can view
CREATE POLICY "Anyone can submit contact form" ON contact_submissions
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- INDEXES for performance
-- =====================================================================
CREATE INDEX idx_recipes_category ON recipes(category);
CREATE INDEX idx_recipes_type ON recipes(type);
CREATE INDEX idx_suggestions_status ON recipe_suggestions(status);
CREATE INDEX idx_contact_status ON contact_submissions(status);

-- =====================================================================
-- Insert sample recipe (Date Ladoo) for testing
-- =====================================================================
INSERT INTO recipes (
  title, category, type, emoji, description, cook_time, servings, 
  calories_per_serving, protein_g, fiber_g, fat_g, tip
) VALUES (
  'Date Ladoo',
  'snack',
  'veg',
  '🍪',
  'A wholesome no-bake Indian sweet made from dates and roasted nuts — naturally sweet, energy-packed, and completely guilt-free.',
  '25 min',
  '12',
  95,
  2.0,
  2.0,
  5.0,
  'Store in an airtight container in the fridge for up to 2 weeks.'
);
```

---

## Step 4: Enable Public Access for Recipe Reads

Since the frontend needs to read recipes without authentication:

1. In Supabase, go to **Authentication** → **Policies**
2. For the `recipes` table, ensure the SELECT policy allows public access
3. The SQL above already handles this — no additional action needed

---

## Step 5: Test the Connection

To verify everything works:

1. In Supabase, go to **Table Editor**
2. Click on the `recipes` table
3. You should see the "Date Ladoo" sample recipe
4. Copy your **Project URL** and **anon key** (you'll add these to your HTML soon)

---

## Next Steps

Once Supabase is set up:

1. **Add the Supabase CDN** to your HTML files
2. **Create supabase-client.js** — the client library
3. **Update recipes-data.js** — to fetch from database
4. **Create form-handlers.js** — for submissions
5. **Update HTML forms** — to use new handlers

All of these are provided in the integration files.

---

## Troubleshooting

### "CORS Error" when fetching from frontend
- Go to **Settings** → **API** → **CORS** in Supabase
- Add your domain (e.g., `http://localhost:3000`, your production domain)

### "Permission denied" when inserting
- Check that RLS policies are created correctly
- Ensure the INSERT policy for `recipe_suggestions` and `contact_submissions` allows anonymous access

### Image not displaying
- Verify the image URL is correct or the base64 string is valid
- If using Supabase Storage, ensure the bucket is public

### Recipes not loading
- Open browser console (F12 → Console tab)
- Check for JavaScript errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in your code

---

## Security Notes

- **Never expose** your `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Use **RLS policies** to control who can read/write each table
- Keep passwords and API keys in `.env` files (not in version control)
- Test RLS policies thoroughly before going to production

---

For more info, visit the [Supabase Documentation](https://supabase.com/docs).
