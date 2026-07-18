-- Update ALL 11 Recipes with Image URLs from Supabase Storage
-- All images have been uploaded to: https://supabase.co → Storage → recipe-images bucket

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/banana-oat-pancakes.webp'
WHERE "title" = 'Banana Oat Pancakes';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/whole-wheat-veggie-pizza.webp'
WHERE "title" = 'Whole Wheat Veggie Pizza';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/chicken-biryani.webp'
WHERE "title" = 'Chicken Biryani';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/strawberry-frozen-yogurt.webp'
WHERE "title" = 'Strawberry Frozen Yogurt';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/veggie-noodles.webp'
WHERE "title" = 'Veggie Noodles';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/garlic-chicken-noodles.webp'
WHERE "title" = 'Garlic Chicken Noodles';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/berry-smoothie-bowl.webp'
WHERE "title" = 'Berry Smoothie Bowl';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/rainbow-quinoa-salad.webp'
WHERE "title" = 'Rainbow Quinoa Salad';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/creamy-lentil-dal.webp'
WHERE "title" = 'Creamy Lentil Dal';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/avocado-toast-with-egg.webp'
WHERE "title" = 'Avocado Toast with Egg';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/date-ladoo.webp'
WHERE "title" = 'Date Ladoo';

-- Verify all images are set
SELECT title, image_url FROM "public"."recipes" WHERE image_url IS NOT NULL ORDER BY title;
