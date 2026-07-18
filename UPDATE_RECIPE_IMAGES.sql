-- Update Recipes with Image URLs from Supabase Storage

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/date-ladoo.webp'
WHERE "title" = 'Date Ladoo';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/chicken-biryani.webp'
WHERE "title" = 'Chicken Biryani';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/garlic-chicken-noodles.webp'
WHERE "title" = 'Garlic Chicken Noodles';

-- Verify updates
SELECT title, image_url FROM "public"."recipes" WHERE image_url IS NOT NULL;
