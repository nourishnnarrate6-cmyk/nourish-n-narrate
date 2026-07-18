# 🗄️ Set Up Your Supabase Database — Copy & Paste SQL

Your code is configured! Now you need to create the database tables.

---

## 📋 Step 1: Open SQL Editor in Supabase

1. Go to your Supabase project
2. Look at the left sidebar
3. Click **"SQL Editor"**
4. Click **"New Query"**

---

## 📋 Step 2: Copy This SQL

Copy the entire SQL code below (all of it):

```sql
-- =====================================================================
-- RECIPES TABLE — stores all recipes with nutritional data
-- =====================================================================
CREATE TABLE IF NOT EXISTS recipes (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'veg',
  emoji VARCHAR(10),
  image_url TEXT,
  description TEXT,
  cook_time VARCHAR(50),
  servings VARCHAR(50),
  calories_per_serving INT,
  protein_g DECIMAL(5,2),
  fiber_g DECIMAL(5,2),
  fat_g DECIMAL(5,2),
  ingredients TEXT,
  steps TEXT,
  tip TEXT,
  why_healthier TEXT,
  comparison TEXT,
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
  dietary_preference VARCHAR(20),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
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
  status VARCHAR(50) DEFAULT 'new',
  admin_reply TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipes are publicly readable" ON recipes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can submit suggestions" ON recipe_suggestions
  FOR INSERT WITH CHECK (true);

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

## 📋 Step 3: Paste Into Supabase

1. In the SQL Editor, paste the code into the text area
2. You should see all the SQL code
3. Click the **"Run"** button (or press Ctrl+Enter)
4. Wait a few seconds for it to complete

---

## ✅ Step 4: Verify It Worked

1. Look for a green checkmark ✅ (success message)
2. Go to **"Table Editor"** in the left sidebar
3. You should see three new tables:
   - `recipes` (with "Date Ladoo" recipe inside)
   - `recipe_suggestions`
   - `contact_submissions`

If you see those tables, you're done! ✅

---

## 🎉 What's Next?

Once the database is set up:

1. ✅ Your code is configured
2. ✅ Database tables are created
3. ✅ Sample recipe is loaded

Now you need to:
- Update your HTML files with the new script tags
- Test in your browser
- Deploy!

---

## 🆘 If Something Goes Wrong

**Error: "relation already exists"**
→ It's fine, means the tables already exist. Ignore it.

**Error: "Permission denied"**
→ This shouldn't happen. Try refreshing the page and running again.

**No green checkmark**
→ Scroll down in SQL Editor to see if there's an error message

---

**Once you see the three tables created, come back and tell me! 👇**
