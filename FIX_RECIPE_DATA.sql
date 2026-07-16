-- Fix the Date Ladoo recipe with proper data

UPDATE "public"."recipes"
SET
  "emoji" = '🍪',
  "ingredients" = '["Dates (non-seeded) – 1 cup","Almonds – ½ cup","Cashews – ¼ cup","Ghee – 2 tbsp","Cardamom powder – ¼ tsp","Cocoa powder – 1 tbsp (optional, for coating)"]',
  "steps" = '["Soak dates in warm water for 5 minutes, then remove pits.","Lightly roast almonds and cashews in a pan without oil (2 min). Let cool slightly.","Blend soaked dates, roasted nuts, and ghee into a smooth paste.","Add cardamom powder and mix well.","Scoop small portions and roll into balls between your palms.","Optional: Roll in cocoa powder or coconut for extra flavor and coating.","Refrigerate for 2 hours before serving."]',
  "why_healthier" = '["Dates provide natural sweetness + energy-boosting fiber","Nuts add healthy fats and protein (no refined sugar)","No refined flour or processed ingredients","Great for pre-workout or energy boost"]',
  "comparison" = '[["Traditional ladoos with condensed milk & sugar","Our version: whole dates + nuts + ghee only"],["Store-bought sweets (200+ cal, high sugar)","Date Ladoos (95 cal, natural sweetness)"]]'
WHERE "title" = 'Date Ladoo';
