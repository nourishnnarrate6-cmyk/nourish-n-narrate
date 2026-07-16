# Bulk Import All Recipes to Supabase

You have 11 recipes in your `recipes-data.js` file that need to be imported to Supabase.

## Option 1: Use the Python Script (Easiest)

1. **Open Terminal**
2. **Navigate to your OIP folder:**
   ```bash
   cd ~/Downloads/OIP
   ```

3. **Run the Python script:**
   ```bash
   python3 convert_recipes.py > IMPORT_ALL_RECIPES.sql
   ```

4. **Open the generated SQL file:**
   ```bash
   cat IMPORT_ALL_RECIPES.sql
   ```

5. **Copy all the SQL output**

6. **Go to Supabase** → SQL Editor → New Query

7. **Paste all the SQL**

8. **Click Run**

---

## Option 2: Manual Import via Supabase UI

If the script doesn't work:

1. **Go to Supabase**
2. **Click Table Editor** → Click **recipes** table
3. **Click "Insert row"** button
4. **Manually add each recipe**

This is slower but guaranteed to work.

---

## Option 3: Ask Me to Generate the SQL

Tell me you want me to generate the SQL manually by extracting recipes from your `recipes-data.js` file and I'll create a large INSERT statement with all recipes.

---

## Which Option Works Best?

- **Option 1** = Fastest (automated)
- **Option 2** = Slowest but guaranteed
- **Option 3** = I handle it for you

**Let me know which you prefer! 👇**
