-- Bulk Import All 11 Recipes to Supabase
-- This SQL file imports all recipes from recipes-data.js into the recipes table

-- First, delete any existing recipes to avoid duplicates
DELETE FROM "public"."recipes";

-- Insert all 11 recipes
INSERT INTO "public"."recipes" (
  "title", "category", "type", "emoji", "image_url", "description",
  "cook_time", "servings", "calories_per_serving", "protein_g", "fiber_g", "fat_g",
  "ingredients", "steps", "tip", "why_healthier", "comparison", "created_by_admin"
) VALUES

-- Recipe 1: Date Ladoo
(
  'Date Ladoo', 'snack', 'veg', '🍪', null,
  'A wholesome no-bake Indian sweet made from dates and roasted nuts — naturally sweet, energy-packed, and completely guilt-free.',
  '25 min', '12', 95, 2.0, 2.0, 5.0,
  '["Dates (non-seeded) – 1 cup","Pistachios – ¼ cup","Almonds – ¼ cup","Cashews – ¼ cup","Pumpkin seeds – 2 tbsp","Ghee – 1–2 tsp (plus extra for hands)"]',
  '["Roast all the nuts (pistachios, almonds, cashews, and pumpkin seeds) in a pan on medium heat until the cashews start to turn golden brown. Stir frequently so nothing burns.","Transfer the roasted nuts to a grinder and pulse until you get a light powder that still has some chunks for texture. Do not over-blend.","Pour the ground nuts into a bowl and set aside. Clean the grinder thoroughly before the next step.","Add the ghee to the same pan and let it melt on medium heat.","Add the dates to the pan and mix continuously until they soften and start to clump together.","Transfer the softened dates to the cleaned grinder and blend until you get a smooth, slightly sticky paste.","Combine the date paste and the ground nuts in the bowl. Mix them together firmly until everything clumps into one large dough.","Apply a little ghee to your palms. Pinch off small portions of the dough and roll each one between your palms into a smooth ball to make the perfect ladoo. Repeat until all the dough is used up."]',
  'Chilling the dough for 10 minutes before rolling makes it easier to shape, and a light coat of ghee on your hands prevents sticking.',
  '["Dates are naturally sweet — there is zero added sugar or jaggery, making this a guilt-free treat.","Almonds, cashews, and pistachios provide healthy fats, protein, and essential minerals like magnesium and zinc.","Pumpkin seeds add a bonus of iron, omega-3 fatty acids, and plant-based protein.","Ghee in small amounts provides fat-soluble vitamins and is easier to digest than refined oils.","The whole recipe is gluten-free and made entirely from whole, unprocessed ingredients."]',
  '[["Store-bought sweets with refined sugar","Sweetened only by natural dates — no added sugar"],["Artificial preservatives and additives","100% whole, unprocessed ingredients"],["High in empty calories","Calories come with fiber, protein, and healthy fats"],["Refined flour or corn syrup binders","Dates act as the natural binder"],["Little to no nutritional value","Rich in iron, magnesium, zinc, and antioxidants"]]',
  true
),

-- Recipe 2: Whole Wheat Veggie Pizza
(
  'Whole Wheat Veggie Pizza', 'lunch', 'veg', '🍕', null,
  'Crispy whole wheat crust topped with fresh vegetables and mozzarella. A healthier take on the classic pizza.',
  '40 min', '4', 280, 12.0, 5.0, 8.0,
  '["Whole wheat flour – 2 cups","Warm water – ¾ cup","Olive oil – 2 tbsp","Salt – 1 tsp","Tomato sauce – 1 cup","Bell peppers – 1 of each color","Mushrooms – 1 cup","Red onion – ½ medium","Fresh mozzarella – 1 cup","Fresh basil – for topping"]',
  '["Make the dough: Mix whole wheat flour, salt, and yeast in a bowl. Add warm water and olive oil, knead until smooth. Let rise for 1 hour.","Preheat oven to 425°F.","Roll out dough to pizza size on a floured surface.","Spread tomato sauce evenly over the dough.","Layer vegetables (peppers, mushrooms, onion) evenly.","Top with mozzarella cheese.","Bake for 20-25 minutes until crust is golden and cheese is melted.","Garnish with fresh basil before serving."]',
  'Use a pizza stone for a crispier crust. Chop vegetables into uniform sizes for even cooking.',
  '["Whole wheat flour provides fiber and complex carbs instead of refined white flour.","Fresh vegetables add vitamins, minerals, and nutrients.","Olive oil provides heart-healthy monounsaturated fats.","Mozzarella adds calcium and protein without excess saturated fat.","Homemade pizza means no hidden preservatives or excess sodium."]',
  '[["Store-bought frozen pizza (high sodium, preservatives)","Fresh, whole-grain homemade pizza"],["White flour crust (empty calories)","Whole wheat crust (fiber-rich)"],["Processed cheese product","Real mozzarella"]]',
  true
),

-- Recipe 3: Chicken Biryani (Healthier Version)
(
  'Chicken Biryani', 'lunch', 'non-veg', '🍛', null,
  'Fragrant basmati rice with lean chicken and aromatic spices. A lighter version of the traditional biryani.',
  '50 min', '6', 380, 28.0, 2.0, 10.0,
  '["Basmati rice – 2 cups","Chicken breast – 1 lb, cubed","Onion – 2 medium, sliced","Ginger-garlic paste – 2 tbsp","Yogurt – ½ cup (plain, unsweetened)","Ghee – 2 tbsp","Bay leaves – 3","Cinnamon – 1 stick","Cloves – 4","Cardamom pods – 4","Salt and pepper – to taste","Mint leaves – for garnish"]',
  '["Soak basmati rice in water for 30 minutes, then drain.","Marinate chicken in yogurt and ginger-garlic paste for 20 minutes.","Heat ghee in a large pot and sauté onions until golden. Reserve half for garnish.","Add marinated chicken to the pot and cook for 5-7 minutes.","Add spices (bay leaves, cinnamon, cloves, cardamom) and stir for 1 minute.","Add the soaked rice and stir to combine with the chicken and spices.","Pour in 4 cups of water and bring to a boil.","Reduce heat to low, cover tightly, and cook for 20-25 minutes until rice is tender and water is absorbed.","Let it rest for 5 minutes before opening the lid.","Fluff with a fork and garnish with reserved onions and mint."]',
  'Do not open the lid while the biryani is cooking to prevent steam from escaping. Use only chicken breast for a leaner version.',
  '["Chicken breast is lean protein with minimal fat.","Basmati rice has a lower glycemic index than regular white rice.","Aromatic spices add flavor without added salt or sugar.","Yogurt adds probiotics and creaminess without cream.","Ghee in moderation provides fat-soluble vitamins."]',
  '[["Traditional biryani with mutton (high fat)","Biryani with lean chicken breast"],["White rice (high glycemic index)","Basmati rice (lower glycemic index)"],["Cream-based sauce","Yogurt-based marinade"]]',
  true
),

-- Recipe 4: Banana Oat Pancakes
(
  'Banana Oat Pancakes', 'breakfast', 'veg', '🥞', null,
  'Fluffy, naturally sweet pancakes made from just oats and banana — no refined sugar needed. Perfect for a healthy breakfast.',
  '15 min', '2', 210, 8.0, 4.0, 4.0,
  '["Ripe bananas – 2 medium","Rolled oats – 1 cup","Eggs – 2","Cinnamon – ½ tsp","Vanilla extract – ½ tsp","Baking powder – 1 tsp","Salt – pinch"]',
  '["Add oats to a blender and blend until they become flour.","In a bowl, mash the bananas until smooth.","Mix the oat flour, mashed banana, eggs, cinnamon, vanilla, baking powder, and salt. Stir until well combined.","Heat a non-stick pan over medium heat and lightly grease it.","Pour ¼ cup of batter per pancake onto the pan.","Cook for 2-3 minutes on each side until golden brown.","Serve hot with fresh berries or a drizzle of honey."]',
  'The riper the bananas, the sweeter your pancakes — no added sugar needed! Freeze leftover pancakes for quick breakfasts.',
  '["Bananas provide natural sweetness and are rich in potassium.","Oats add fiber and B vitamins.","Eggs provide complete protein and choline.","No refined sugar means stable energy and no sugar crashes.","Whole grain oats support digestive health."]',
  '[["Pancakes with refined flour and added sugar","Pancakes sweetened only by natural bananas"],["Syrup and butter topping (high sugar, saturated fat)","Fresh fruit topping"],["Processed pancake mix (preservatives, additives)","Simple whole food ingredients"]]',
  true
),

-- Recipe 5: Strawberry Frozen Yogurt
(
  'Strawberry Frozen Yogurt', 'snack', 'veg', '🍓', null,
  'A creamy, naturally sweet frozen treat made with plain yogurt and fresh strawberries. No ice cream needed.',
  '10 min (plus freezing)', '4', 120, 6.0, 2.0, 2.0,
  '["Plain Greek yogurt – 2 cups","Fresh strawberries – 2 cups","Honey – 2 tbsp","Lemon juice – 1 tbsp","Vanilla extract – ½ tsp"]',
  '["Hull and chop the fresh strawberries.","Add strawberries, Greek yogurt, honey, lemon juice, and vanilla to a blender.","Blend until smooth and creamy.","Serve immediately for a soft-serve texture, or","Freeze in ice cream containers for 3-4 hours for a firmer texture.","Scoop and enjoy with fresh berries as topping if desired."]',
  'Use frozen strawberries in a blender for an instant soft-serve texture. Greek yogurt makes it extra creamy without ice cream.',
  '["Greek yogurt provides protein and probiotics for gut health.","Fresh strawberries are rich in vitamin C and antioxidants.","Honey adds natural sweetness instead of refined sugar.","No artificial ingredients or additives.","Much lower in calories than traditional ice cream."]',
  '[["Ice cream (high fat, artificial flavors)","Frozen yogurt (protein-rich, probiotics)"],["High fructose corn syrup","Natural honey sweetening"],["Artificial food coloring","Natural strawberry color"]]',
  true
),

-- Recipe 6: Veggie Noodles (Zucchini Noodles with Pesto)
(
  'Veggie Noodles', 'lunch', 'veg', '🥒', null,
  'Spiralized zucchini noodles tossed with fresh basil pesto and cherry tomatoes. A light, veggie-packed alternative to pasta.',
  '20 min', '2', 150, 5.0, 3.0, 8.0,
  '["Zucchini – 2 medium","Fresh basil – 2 cups","Pine nuts – ¼ cup","Parmesan cheese – ½ cup, grated","Garlic – 2 cloves","Lemon juice – 2 tbsp","Olive oil – ¼ cup","Cherry tomatoes – 1 cup, halved","Salt and pepper – to taste"]',
  '["Wash and trim the zucchini. Using a spiralizer, create zucchini noodles. Set aside.","Make the pesto: Add basil, pine nuts, garlic, Parmesan, and lemon juice to a food processor.","While blending, slowly add olive oil until you reach desired consistency.","Season with salt and pepper.","In a pan, gently heat the zucchini noodles for 2-3 minutes (do not overcook).","Toss the warm noodles with pesto.","Add halved cherry tomatoes and toss gently.","Serve immediately with extra Parmesan if desired."]',
  'Do not overcook zucchini noodles — they should remain slightly firm. Make pesto in batches and freeze for quick meals.',
  '["Zucchini noodles are low in calories and carbs, high in fiber.","Fresh basil has anti-inflammatory properties.","Olive oil provides heart-healthy monounsaturated fats.","Cherry tomatoes add lycopene and vitamin C.","Parmesan adds calcium and umami flavor without cream."]',
  '[["Regular pasta (refined carbs, high calories)","Zucchini noodles (low-carb, nutrient-dense)"],["Cream-based pasta sauce (high fat)","Olive oil-based pesto"],["Processed cheese","Fresh Parmesan"]]',
  true
),

-- Recipe 7: Garlic Chicken Noodles
(
  'Garlic Chicken Noodles', 'dinner', 'non-veg', '🍜', null,
  'Tender chicken and crisp vegetables in a light garlic sauce over whole wheat noodles. A quick and healthy weeknight dinner.',
  '30 min', '4', 350, 30.0, 5.0, 8.0,
  '["Chicken breast – 1 lb, sliced thin","Whole wheat noodles – 8 oz","Garlic – 6 cloves, minced","Soy sauce – 3 tbsp (low-sodium)","Olive oil – 2 tbsp","Broccoli – 2 cups, florets","Bell peppers – 1 red, sliced","Green onions – 2, chopped","Ginger – 1 tbsp, minced","Sesame oil – 1 tsp","Vegetable broth – ½ cup"]',
  '["Cook whole wheat noodles according to package directions. Drain and set aside.","Heat olive oil in a large wok or skillet over medium-high heat.","Add sliced chicken and cook until golden and cooked through (about 5-7 minutes). Set aside.","In the same wok, add minced garlic and ginger. Stir-fry for 1 minute until fragrant.","Add broccoli and bell peppers. Stir-fry for 3-4 minutes until crisp-tender.","Return chicken to the wok. Add soy sauce, vegetable broth, and sesame oil.","Toss in the cooked noodles and green onions. Mix well until everything is heated through.","Serve hot with extra green onions on top if desired."]',
  'Prep all ingredients before cooking for quick assembly. Use low-sodium soy sauce to control salt intake.',
  '["Chicken breast is lean protein with minimal fat.","Whole wheat noodles provide fiber and B vitamins.","Garlic has antimicrobial and anti-inflammatory properties.","Broccoli is packed with vitamin C and sulforaphane.","Minimal oil keeps calories and fat in check."]',
  '[["Regular pasta (refined carbs)","Whole wheat noodles (fiber-rich)"],["Cream or butter-based sauce (high fat)","Light soy sauce (low-fat)"],["Takeout noodles (MSG, excess sodium)","Homemade with controlled ingredients"]]',
  true
),

-- Recipe 8: Berry Smoothie Bowl
(
  'Berry Smoothie Bowl', 'breakfast', 'veg', '🥣', null,
  'A thick, creamy berry smoothie base topped with granola, coconut, and fresh berries. A nutritious and delicious breakfast.',
  '10 min', '1', 280, 10.0, 6.0, 6.0,
  '["Mixed frozen berries – 1.5 cups (blueberries, strawberries, raspberries)","Greek yogurt – ¾ cup","Almond milk – ½ cup","Honey – 1 tbsp","Granola – ¼ cup (unsweetened)","Coconut flakes – 2 tbsp","Chia seeds – 1 tbsp","Fresh berries – for topping"]',
  '["Add frozen berries, Greek yogurt, almond milk, and honey to a blender.","Blend until thick and creamy (should be thicker than a regular smoothie).","Pour into a bowl.","Top with granola, coconut flakes, chia seeds, and fresh berries.","Eat with a spoon and enjoy!"]',
  'Make the smoothie base thick by using more frozen berries and less liquid. Prep toppings in small bowls for easy assembly.',
  '["Frozen berries are nutrient-dense and have anthocyanins (antioxidants).","Greek yogurt provides protein and probiotics.","Almond milk is lower in calories than dairy milk.","Chia seeds add omega-3 fatty acids and fiber.","Toppings add texture and extra nutrients without excess sugar."]',
  '[["Sugar-sweetened yogurt smoothies (high added sugar)","Plain yogurt with natural fruit sweetness"],["Granola with added sugars and oils","Unsweetened granola"],["Protein powder (processed)","Whole Greek yogurt (natural protein)"]]',
  true
),

-- Recipe 9: Rainbow Quinoa Salad
(
  'Rainbow Quinoa Salad', 'lunch', 'veg', '🥗', null,
  'A colorful, nutrient-packed salad with quinoa, roasted vegetables, and a light lemon-tahini dressing. Perfect for meal prep.',
  '35 min', '4', 320, 12.0, 7.0, 12.0,
  '["Quinoa – 1 cup","Red bell pepper – 1, diced","Yellow bell pepper – 1, diced","Cucumber – 1 medium, diced","Cherry tomatoes – 1 cup, halved","Red onion – ¼ medium, thinly sliced","Kale – 2 cups, chopped","Tahini – 3 tbsp","Lemon juice – 3 tbsp","Olive oil – 2 tbsp","Garlic – 1 clove, minced","Water – 3 tbsp","Salt and pepper – to taste","Pumpkin seeds – ¼ cup for topping"]',
  '["Rinse quinoa under cold water and cook according to package directions. Let cool.","Chop all vegetables into uniform sizes for even distribution.","Make the dressing: Whisk together tahini, lemon juice, olive oil, minced garlic, and water until smooth.","In a large bowl, combine cooled quinoa, bell peppers, cucumber, cherry tomatoes, red onion, and kale.","Pour dressing over salad and toss until everything is well coated.","Season with salt and pepper to taste.","Top with pumpkin seeds before serving.","This salad is great for meal prep — it stores well in containers for 3-4 days."]',
  'Massage the kale with a little lemon juice before adding to soften it. Make extra dressing for drizzling later.',
  '["Quinoa is a complete protein with all nine amino acids.","Colorful vegetables provide a variety of vitamins and minerals.","Tahini is rich in calcium and healthy fats.","Kale is packed with iron, calcium, and antioxidants.","No processed ingredients — just whole foods."]',
  '[["Processed grain salads (added oils, preservatives)","Whole grain quinoa salad"],["Creamy dressings (high in fat)","Tahini-based light dressing"],["Pre-packaged salad kits (wilted greens, additives)","Fresh vegetables tossed to order"]]',
  true
),

-- Recipe 10: Creamy Lentil Dal
(
  'Creamy Lentil Dal', 'dinner', 'veg', '🍲', null,
  'A comforting, protein-packed Indian lentil curry made with coconut milk and aromatic spices. Serve over rice or with naan.',
  '40 min', '4', 280, 18.0, 8.0, 6.0,
  '["Red lentils – 1 cup","Onion – 1 medium, diced","Garlic – 4 cloves, minced","Ginger – 1 tbsp, minced","Cumin – 1 tsp","Turmeric – ½ tsp","Coriander – 1 tsp","Coconut milk – 1 can (13.5 oz)","Vegetable broth – 3 cups","Tomato – 1 medium, diced","Spinach – 2 cups","Coconut oil – 1 tbsp","Salt and pepper – to taste","Cilantro – for garnish"]',
  '["Rinse lentils under cold water and set aside.","Heat coconut oil in a large pot over medium heat.","Add diced onion and cook until softened (about 3 minutes).","Add minced garlic and ginger. Stir and cook for 1 minute until fragrant.","Add cumin, turmeric, and coriander. Stir for 30 seconds to toast the spices.","Add the rinsed lentils and vegetable broth. Bring to a boil.","Reduce heat to low and simmer for 15-20 minutes until lentils start to soften.","Add diced tomato and coconut milk. Stir well.","Simmer for another 10 minutes.","Add spinach and stir until wilted.","Season with salt and pepper to taste.","Serve hot, garnished with fresh cilantro."]',
  'Make a big batch and freeze portions for easy weeknight dinners. The dal thickens as it cools — add more broth if needed when reheating.',
  '["Lentils are an excellent plant-based protein and fiber source.","Coconut milk adds creaminess without dairy.","Turmeric has anti-inflammatory compounds (curcumin).","Spinach adds iron, calcium, and vitamins.","Ginger aids digestion and has anti-nausea properties."]',
  '[["Creamy curries with heavy cream (saturated fat)","Coconut milk-based dal (healthier fats)"],["White rice (refined carbs)","Brown rice or whole grains (fiber-rich)"],["Processed curry paste (additives)","Whole spices (no preservatives)"]]',
  true
),

-- Recipe 11: Avocado Toast with Egg
(
  'Avocado Toast with Egg', 'breakfast', 'veg', '🥑', null,
  'Creamy mashed avocado on whole grain toast, topped with a perfectly cooked egg. A simple yet nutritious breakfast or lunch.',
  '10 min', '1', 340, 14.0, 7.0, 16.0,
  '["Whole grain bread – 2 slices","Avocado – 1 medium, ripe","Egg – 1","Lemon juice – ½ tbsp","Red pepper flakes – pinch","Sea salt – pinch","Black pepper – to taste","Tomato slices – optional","Fresh cilantro – optional"]',
  '["Toast the whole grain bread until golden and crispy.","While bread is toasting, cut the avocado in half and remove the pit.","Scoop the avocado into a small bowl and mash with a fork.","Add lemon juice, sea salt, and black pepper to the mashed avocado. Mix gently.","Heat a small non-stick pan over medium heat. Crack the egg into the pan and cook to your liking (fried, poached, or soft scrambled).","Spread the mashed avocado evenly onto both slices of toasted bread.","Top with the cooked egg.","Sprinkle with red pepper flakes and additional cilantro if desired.","Serve immediately."]',
  'Choose a ripe avocado that yields slightly to gentle pressure. Make this ahead for meal prep — toast bread, prepare avocado, and store separately until ready to assemble.',
  '["Avocado is rich in heart-healthy monounsaturated fats.","Whole grain bread provides fiber and B vitamins.","Eggs provide complete protein and choline for brain health.","Lemon juice aids nutrient absorption and adds flavor without salt.","Minimal ingredients mean maximum nutrition."]',
  '[["White bread (refined, low fiber)","Whole grain bread (fiber-rich, nutrient-dense)"],["Butter or mayo spread (saturated fats)","Avocado (unsaturated fats)"],["Pre-packaged breakfast sandwich (processed, additives)","Fresh, homemade avocado toast"]]',
  true
);

-- Verify all recipes were inserted
SELECT COUNT(*) as total_recipes FROM "public"."recipes";
