-- Run this in your Supabase SQL Editor to fix the "Save Failed" issue

-- 1. Enable RLS on profiles (good practice, likely already on)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Allow users to insert their *own* profile
-- This is needed if you DO NOT have a trigger auto-creating users.
CREATE POLICY "Enable insert for users based on user_id"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. Allow users to update their *own* profile
CREATE POLICY "Enable update for users based on user_id"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Allow users to read their *own* profile
CREATE POLICY "Enable read for users based on user_id"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 5. (Optional) Allow everyone to read profiles (needed for Drivers/Merchants to see you)
-- CREATE POLICY "Enable public read access"
-- ON profiles FOR SELECT
-- USING (true);
