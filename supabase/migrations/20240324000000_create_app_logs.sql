-- Create enum for log levels
DO $$ BEGIN
    CREATE TYPE log_level AS ENUM ('info', 'warning', 'error', 'debug', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for log categories
DO $$ BEGIN
    CREATE TYPE log_category AS ENUM (
        'auth',
        'task_execution',
        'api_error',
        'proxy_error',
        'rate_limit',
        'system',
        'account_verification',
        'media_upload',
        'database'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create app_logs table
CREATE TABLE IF NOT EXISTS app_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    task_id UUID,
    social_account_id UUID,
    level log_level NOT NULL,
    category log_category NOT NULL,
    message TEXT NOT NULL,
    error_details JSONB,
    stack_trace TEXT,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_task_id ON app_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_social_account_id ON app_logs(social_account_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON app_logs(category);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at);

-- Enable Row Level Security
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for app_logs
CREATE POLICY "Users can view their own logs"
    ON app_logs FOR SELECT
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Create function to automatically log errors
CREATE OR REPLACE FUNCTION log_error(
    p_user_id UUID,
    p_task_id UUID,
    p_social_account_id UUID,
    p_category log_category,
    p_message TEXT,
    p_error_details JSONB DEFAULT NULL,
    p_stack_trace TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO app_logs (
        user_id,
        task_id,
        social_account_id,
        level,
        category,
        message,
        error_details,
        stack_trace,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        p_task_id,
        p_social_account_id,
        'error',
        p_category,
        p_message,
        p_error_details,
        p_stack_trace,
        p_metadata,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to automatically log info messages
CREATE OR REPLACE FUNCTION log_info(
    p_user_id UUID,
    p_task_id UUID,
    p_social_account_id UUID,
    p_category log_category,
    p_message TEXT,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO app_logs (
        user_id,
        task_id,
        social_account_id,
        level,
        category,
        message,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        p_task_id,
        p_social_account_id,
        'info',
        p_category,
        p_message,
        p_metadata,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain the table
COMMENT ON TABLE app_logs IS 'Comprehensive logging table for tracking errors, warnings, and system events';
COMMENT ON COLUMN app_logs.error_details IS 'JSON object containing detailed error information';
COMMENT ON COLUMN app_logs.metadata IS 'Additional contextual information about the log entry';
COMMENT ON COLUMN app_logs.stack_trace IS 'Full stack trace for error logs'; 