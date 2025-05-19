-- Add last_verified_at column to social_accounts table
ALTER TABLE social_accounts
ADD COLUMN last_verified_at TIMESTAMP WITH TIME ZONE;

-- Add comment to the column
COMMENT ON COLUMN social_accounts.last_verified_at IS 'Timestamp of when the account was last verified'; 