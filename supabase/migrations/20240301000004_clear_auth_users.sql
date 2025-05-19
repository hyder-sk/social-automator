-- First, delete all users from public.users table
DELETE FROM public.users;

-- Then delete all users from auth.users table
DELETE FROM auth.users;

-- Note: This will also automatically delete:
-- - All sessions
-- - All refresh tokens
-- - All identities
-- - All MFA factors
-- - All audit logs 