-- Add new task types for account management
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'add_account';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'update_account';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'delete_account'; 