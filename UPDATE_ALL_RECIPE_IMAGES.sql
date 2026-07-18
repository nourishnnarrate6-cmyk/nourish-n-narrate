-- Update All 8 Recipe Images with Supabase Storage URLs
-- Upload these 8 images to: https://supabase.co → Storage → recipe-images bucket
-- Filenames to upload:
-- 1. banana-oat-pancakes.webp
-- 2. whole-wheat-veggie-pizza.webp
-- 3. strawberry-frozen-yogurt.webp
-- 4. veggie-noodles.webp
-- 5. berry-smoothie-bowl.webp
-- 6. rainbow-quinoa-salad.webp
-- 7. creamy-lentil-dal.webp
-- 8. avocado-toast-with-egg.webp

-- Once uploaded, run these UPDATE statements:

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/banana-oat-pancakes.webp'
WHERE "title" = 'Banana Oat Pancakes';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/whole-wheat-veggie-pizza.webp'
WHERE "title" = 'Whole Wheat Veggie Pizza';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/strawberry-frozen-yogurt.webp'
WHERE "title" = 'Strawberry Frozen Yogurt';

UPDATE "public"."recipes"
SET "image_url" = 'https://qonuiowgfwhgqnojzjxy.supabase.co/storage/v1/object/public/recipe-images/veggie-noodles.webp'
WHERE "title" = 'Veggie Noodles';

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

-- Verify all images are set
SELECT title, image_url FROM "public"."recipes" WHERE image_url IS NOT NULL ORDER BY title;
