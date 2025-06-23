-- Drop existing foreign key constraints
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS fk_social_account;

ALTER TABLE task_logs
DROP CONSTRAINT IF EXISTS task_logs_task_id_fkey;

-- Add new foreign key constraints with SET NULL instead of CASCADE
ALTER TABLE tasks
ADD CONSTRAINT fk_social_account
    FOREIGN KEY (social_account_id)
    REFERENCES social_accounts(id)
    ON DELETE SET NULL;

ALTER TABLE task_logs
ADD CONSTRAINT task_logs_task_id_fkey
    FOREIGN KEY (task_id)
    REFERENCES tasks(id)
    ON DELETE SET NULL;

-- Add a deleted_at column to social_accounts to track soft deletes
ALTER TABLE social_accounts
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create an index for the deleted_at column
CREATE INDEX IF NOT EXISTS idx_social_accounts_deleted_at 
ON social_accounts(deleted_at);

-- Add a comment to explain the soft delete functionality
COMMENT ON COLUMN social_accounts.deleted_at IS 'Timestamp when the account was soft deleted. NULL means the account is active.'; 