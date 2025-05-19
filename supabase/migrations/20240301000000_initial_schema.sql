-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE social_platform AS ENUM ('facebook', 'instagram', 'twitter', 'linkedin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('api', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('post', 'like', 'follow', 'unfollow', 'comment', 'dm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('active', 'paused', 'completed', 'failed', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_schedule_type AS ENUM ('once', 'daily', 'weekly', 'interval','scheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create social_accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    type account_type NOT NULL,
    username TEXT,
    email TEXT,
    -- For API accounts
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    -- For manual accounts
    password TEXT, -- Will be encrypted
    -- Proxy settings
    proxy_ip TEXT,
    proxy_port INTEGER,
    -- Status and metadata
    status TEXT NOT NULL DEFAULT 'active',
    profile_pic_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_proxy CHECK (
        (type = 'api' AND proxy_ip IS NULL AND proxy_port IS NULL) OR
        (type = 'manual' AND proxy_ip IS NOT NULL AND proxy_port IS NOT NULL)
    ),
    -- Add additional optional columns
    mail_password TEXT DEFAULT NULL,
    mfa_code TEXT DEFAULT NULL
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL,
    type task_type NOT NULL,
    action_data JSONB NOT NULL,
    schedule_type task_schedule_type NOT NULL,
    -- For once: specific datetime
    -- For daily: time of day
    -- For weekly: day of week and time
    -- For interval: minutes between runs
    schedule_data JSONB NOT NULL,
    status task_status NOT NULL DEFAULT 'active',
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_social_account
        FOREIGN KEY (social_account_id)
        REFERENCES social_accounts(id)
        ON DELETE CASCADE
);

-- Add explicit foreign key relationship for PostgREST
ALTER TABLE tasks
    ADD CONSTRAINT tasks_social_account_id_fkey
    FOREIGN KEY (social_account_id)
    REFERENCES social_accounts(id)
    ON DELETE CASCADE;

-- Create task_logs table
CREATE TABLE IF NOT EXISTS task_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    result TEXT NOT NULL,
    message TEXT,
    proxy_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_social_account_id ON tasks(social_account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_next_run_at ON tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_execution_time ON task_logs(execution_time);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow public user creation" ON users;
DROP POLICY IF EXISTS "Users can view their own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can manage their own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their own task logs" ON task_logs;

-- Users policies
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Allow public access for user creation (needed for signup)
CREATE POLICY "Allow public user creation"
    ON users FOR INSERT
    WITH CHECK (true);

-- Social accounts policies
CREATE POLICY "Users can view their own social accounts"
    ON social_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own social accounts"
    ON social_accounts FOR ALL
    USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view their own tasks"
    ON tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tasks"
    ON tasks FOR ALL
    USING (auth.uid() = user_id);

-- Task logs policies
CREATE POLICY "Users can view their own task logs"
    ON task_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_logs.task_id
        AND tasks.user_id = auth.uid()
    ));

-- Create functions for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS encrypt_sensitive_data_trigger ON social_accounts;
DROP FUNCTION IF EXISTS encrypt_sensitive_data();
DROP FUNCTION IF EXISTS decrypt_sensitive_data(UUID, UUID);

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
    -- For manual accounts, only handle password
    IF NEW.type = 'manual' THEN
        IF NEW.password IS NOT NULL THEN
            -- For now, we'll just store the password as is
            -- In production, you should implement proper encryption
            NEW.password = NEW.password;
        END IF;
    -- For API accounts, only handle access_token
    ELSIF NEW.type = 'api' THEN
        IF NEW.access_token IS NOT NULL THEN
            -- For now, we'll just store the access token as is
            -- In production, you should implement proper encryption
            NEW.access_token = NEW.access_token;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for encrypting sensitive data
CREATE TRIGGER encrypt_sensitive_data_trigger
    BEFORE INSERT OR UPDATE ON social_accounts
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_sensitive_data();

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(user_id UUID, account_id UUID)
RETURNS TEXT AS $$
DECLARE
    decrypted_password TEXT;
BEGIN
    SELECT password
    INTO decrypted_password
    FROM social_accounts
    WHERE id = account_id AND user_id = $1;
    
    RETURN decrypted_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 