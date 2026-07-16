-- Delete any existing Date Ladoo recipe first
DELETE FROM "public"."recipes" WHERE "title" = 'Date Ladoo';

-- Insert fresh Date Ladoo recipe
INSERT INTO "public"."recipes" (
  "title",
  "category",
  "type",
  "emoji",
  "image_url",
  "description",
  "cook_time",
  "servings",
  "calories_per_serving",
  "protein_g",
  "fiber_g",
  "fat_g",
  "ingredients",
  "steps",
  "tip",
  "why_healthier",
  "comparison",
  "created_by_admin"
) VALUES (
  'Date Ladoo',
  'snack',
  'veg',
  '🍪',
  null,
  'A wholesome no-bake Indian sweet made from dates and roasted nuts - naturally sweet, energy-packed, and completely guilt-free.',
  '25 min',
  '12',
  95,
  2.0,
  2.0,
  5.0,
  '["Dates (non-seeded) – 1 cup","Almonds – ½ cup","Cashews – ¼ cup","Ghee – 2 tbsp","Cardamom powder – ¼ tsp","Cocoa powder – 1 tbsp (optional, for coating)"]',
  '["Soak dates in warm water for 5 minutes, then remove pits.","Lightly roast almonds and cashews in a pan without oil (2 min). Let cool slightly.","Blend soaked dates, roasted nuts, and ghee into a smooth paste.","Add cardamom powder and mix well.","Scoop small portions and roll into balls between your palms.","Optional: Roll in cocoa powder or coconut for extra flavor and coating.","Refrigerate for 2 hours before serving."]',
  'Store in an airtight container in the fridge for up to 2 weeks.',
  '["Dates provide natural sweetness + energy-boosting fiber","Nuts add healthy fats and protein (no refined sugar)","No refined flour or processed ingredients","Great for pre-workout or energy boost"]',
  '[["Traditional ladoos with condensed milk & sugar","Our version: whole dates + nuts + ghee only"],["Store-bought sweets (200+ cal, high sugar)","Date Ladoos (95 cal, natural sweetness)"]]',
  true
);
