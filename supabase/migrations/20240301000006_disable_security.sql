-- Disable Row Level Security for all tables
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow public user creation" ON public.users;
DROP POLICY IF EXISTS "Allow users to view own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own data" ON public.users;
DROP POLICY IF EXISTS "Allow public user read" ON public.users;
DROP POLICY IF EXISTS "Users can view their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can manage their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their own task logs" ON public.task_logs;

-- Grant full access to all tables for all roles
GRANT ALL PRIVILEGES ON TABLE public.users TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.social_accounts TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.tasks TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.task_logs TO anon, authenticated;

-- Grant usage on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated; 