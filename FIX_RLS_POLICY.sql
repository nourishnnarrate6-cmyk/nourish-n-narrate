-- Drop the old SELECT policy if it exists
DROP POLICY IF EXISTS "Recipes are publicly readable" ON "public"."recipes";

-- Create a new permissive policy that allows everyone to read recipes
CREATE POLICY "Enable read access for all users" ON "public"."recipes"
  FOR SELECT
  USING (true);

-- Verify the policy is in place
SELECT * FROM "public"."recipes";
