# Upload 8 Recipe Images to Supabase Storage

## Step 1: Go to Supabase
Navigate to: https://app.supabase.com (or your Supabase dashboard)

## Step 2: Click Storage
In the left sidebar, click **Storage**

## Step 3: Open recipe-images Bucket
Click on the **recipe-images** bucket

## Step 4: Upload These 8 Images
Click **Upload file** and upload each image with these exact filenames:

1. **banana-oat-pancakes.webp** - The pancakes with syrup pouring
2. **whole-wheat-veggie-pizza.webp** - Pizza sliced on black board
3. **strawberry-frozen-yogurt.webp** - Pink frozen yogurt scoops
4. **veggie-noodles.webp** - Spiralized noodles in white bowl
5. **berry-smoothie-bowl.webp** - Purple smoothie bowl with toppings
6. **rainbow-quinoa-salad.webp** - Colorful salad in wooden bowl
7. **creamy-lentil-dal.webp** - Dal with lentil patties
8. **avocado-toast-with-egg.webp** - Avocado toast with egg

## Step 5: Run the SQL
Once all 8 images are uploaded:
1. Go to **SQL Editor** in Supabase
2. Create a **New Query**
3. Copy all the SQL from `UPDATE_ALL_RECIPE_IMAGES.sql`
4. Paste it in
5. Click **Run**

## Step 6: Verify
Hard refresh your website (⌘ Cmd + Shift + R) and all 8 recipes should have images! ✅

---

**Need help saving the images?** 
The images you pasted are available. You need to save/download them with these filenames to your computer, then upload them to Supabase Storage.
