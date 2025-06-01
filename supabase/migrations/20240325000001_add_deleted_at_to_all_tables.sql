-- Add deleted_at column to users table
ALTER TABLE users
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_at column to social_accounts table (if not already added)
ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_at column to tasks table
ALTER TABLE tasks
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_at column to task_logs table
ALTER TABLE task_logs
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_social_accounts_deleted_at ON social_accounts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_task_logs_deleted_at ON task_logs(deleted_at);

-- Add comments to explain the soft delete functionality
COMMENT ON COLUMN users.deleted_at IS 'Timestamp when the user was soft deleted. NULL means the user is active.';
COMMENT ON COLUMN social_accounts.deleted_at IS 'Timestamp when the account was soft deleted. NULL means the account is active.';
COMMENT ON COLUMN tasks.deleted_at IS 'Timestamp when the task was soft deleted. NULL means the task is active.';
COMMENT ON COLUMN task_logs.deleted_at IS 'Timestamp when the log was soft deleted. NULL means the log is active.';

-- Update existing foreign key constraints to handle soft deletes
ALTER TABLE social_accounts
DROP CONSTRAINT IF EXISTS social_accounts_user_id_fkey,
ADD CONSTRAINT social_accounts_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS fk_social_account,
ADD CONSTRAINT fk_social_account
    FOREIGN KEY (social_account_id)
    REFERENCES social_accounts(id)
    ON DELETE SET NULL;

ALTER TABLE task_logs
DROP CONSTRAINT IF EXISTS task_logs_task_id_fkey,
ADD CONSTRAINT task_logs_task_id_fkey
    FOREIGN KEY (task_id)
    REFERENCES tasks(id)
    ON DELETE SET NULL; 