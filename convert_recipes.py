#!/usr/bin/env python3
"""
Convert recipes from recipes-data.js to Supabase INSERT SQL
"""
import json
import re

# Read the recipes-data.js file
with open('/Users/sathvikeru/Downloads/OIP/recipes-data.js', 'r') as f:
    content = f.read()

# Extract the RECIPES array
# Find the start of const RECIPES = [
start = content.find('const RECIPES = [')
if start == -1:
    print("Could not find 'const RECIPES = ['")
    exit(1)

# Find the matching closing bracket
bracket_count = 0
in_array = False
end = start + len('const RECIPES = ')

for i in range(end, len(content)):
    if content[i] == '[':
        bracket_count += 1
        in_array = True
    elif content[i] == ']':
        bracket_count -= 1
        if in_array and bracket_count == 0:
            end = i + 1
            break

# Extract just the array part
array_str = content[start + len('const RECIPES = '):end]

print("Extracted recipes array")
print(f"Array length: {len(array_str)} characters")
print()

# Try to parse it as JavaScript and convert to Python
# This is a simplified approach - we'll manually parse it
recipes_text = array_str

# Replace JavaScript object notation with Python dict notation
recipes_text = recipes_text.replace('true', 'True')
recipes_text = recipes_text.replace('false', 'False')
recipes_text = recipes_text.replace('null', 'None')

print("Attempting to evaluate as Python...")
try:
    recipes = eval(recipes_text)
    print(f"✓ Successfully parsed {len(recipes)} recipes!")
except Exception as e:
    print(f"❌ Error parsing: {e}")
    print("Will use manual extraction instead")
    recipes = []

if recipes:
    print("\nRecipes found:")
    for recipe in recipes:
        print(f"  - {recipe.get('title', 'Unknown')}")

    print("\n" + "="*80)
    print("SQL INSERT STATEMENTS")
    print("="*80 + "\n")

    # Generate SQL for each recipe
    for recipe in recipes:
        title = recipe.get('title', '').replace("'", "''")  # Escape single quotes
        category = recipe.get('category', 'snack').replace("'", "''")
        type_ = recipe.get('type', 'veg').replace("'", "''")
        emoji = recipe.get('emoji', '').replace("'", "''")
        image = recipe.get('image', None)
        desc = recipe.get('desc', '').replace("'", "''")
        time = recipe.get('time', '').replace("'", "''")
        servings = recipe.get('servings', '').replace("'", "''")
        calories = recipe.get('calories', '')
        protein = recipe.get('protein', None)
        fiber = recipe.get('fiber', None)
        fat = recipe.get('fat', None)
        tip = recipe.get('tip', '').replace("'", "''")

        # Convert arrays to JSON
        ingredients = json.dumps(recipe.get('ingredients', []))
        steps = json.dumps(recipe.get('steps', []))
        why_healthier = json.dumps(recipe.get('whyHealthier', []))
        comparison = json.dumps(recipe.get('comparison', []))

        # Extract numeric values
        try:
            calories_num = int(calories) if calories else None
        except:
            calories_num = None

        try:
            protein_num = float(protein.replace('g', '')) if protein and isinstance(protein, str) else None
        except:
            protein_num = None

        try:
            fiber_num = float(fiber.replace('g', '')) if fiber and isinstance(fiber, str) else None
        except:
            fiber_num = None

        try:
            fat_num = float(fat.replace('g', '')) if fat and isinstance(fat, str) else None
        except:
            fat_num = None

        # Build the SQL
        sql = f"""INSERT INTO "public"."recipes" (
  "title", "category", "type", "emoji", "image_url", "description",
  "cook_time", "servings", "calories_per_serving", "protein_g", "fiber_g", "fat_g",
  "ingredients", "steps", "tip", "why_healthier", "comparison", "created_by_admin"
) VALUES (
  '{title}', '{category}', '{type_}', '{emoji}',
  {f"'{image}'" if image else 'null'},
  '{desc}',
  '{time}', '{servings}', {calories_num},
  {protein_num}, {fiber_num}, {fat_num},
  '{ingredients.replace("'", "''")}',
  '{steps.replace("'", "''")}',
  '{tip}',
  '{why_healthier.replace("'", "''")}',
  '{comparison.replace("'", "''")}',
  true
);
"""
        print(sql)
        print()

else:
    print("No recipes found or parsing failed")
