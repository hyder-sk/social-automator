-- Drop existing table and policies
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table with proper permissions
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    first_name TEXT,
    last_name TEXT,
    is_email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set table owner
ALTER TABLE public.users OWNER TO postgres;

-- Disable RLS temporarily for debugging
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Grant all permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.users TO anon;
GRANT ALL PRIVILEGES ON TABLE public.users TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.users TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify table and permissions
DO $$ 
BEGIN
    RAISE NOTICE 'Checking users table...';
    RAISE NOTICE 'Table exists: %', EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users');
    RAISE NOTICE 'Table owner: %', (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users');
    RAISE NOTICE 'RLS enabled: %', (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users');
END $$; 