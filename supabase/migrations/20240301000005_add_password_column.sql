-- Add password column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password TEXT;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public user creation" ON public.users;
DROP POLICY IF EXISTS "Allow users to view own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own data" ON public.users;
DROP POLICY IF EXISTS "Allow public user read" ON public.users;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create new policies
-- Allow public to create users (for signup)
CREATE POLICY "Allow public user creation" ON public.users
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Allow users to read their own data
CREATE POLICY "Allow users to view own data" ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Allow users to update own data" ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id); 