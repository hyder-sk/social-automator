-- First, add new columns without constraints
ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS proxy_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS proxy_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_country VARCHAR(2) DEFAULT 'US',
ADD COLUMN IF NOT EXISTS proxy_last_used TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS proxy_rotation_interval INTEGER DEFAULT 3600;

-- Drop existing proxy constraint if it exists
ALTER TABLE social_accounts
DROP CONSTRAINT IF EXISTS valid_proxy;

-- Add new constraint for proxy validation (more lenient version)
ALTER TABLE social_accounts
ADD CONSTRAINT valid_proxy CHECK (
    (type = 'api') OR
    (type = 'manual' AND (
        (proxy_ip IS NULL AND proxy_port IS NULL) OR
        (proxy_ip IS NOT NULL AND proxy_port IS NOT NULL)
    ))
);

-- Add comment to explain the proxy configuration
COMMENT ON COLUMN social_accounts.proxy_type IS 'Type of proxy (e.g., socks5)';
COMMENT ON COLUMN social_accounts.proxy_country IS 'Country code for the proxy location (e.g., US)';
COMMENT ON COLUMN social_accounts.proxy_last_used IS 'Timestamp of when the proxy was last used';
COMMENT ON COLUMN social_accounts.proxy_rotation_interval IS 'Interval in seconds before rotating the proxy';

-- Create index for proxy-related queries
CREATE INDEX IF NOT EXISTS idx_social_accounts_proxy_country 
ON social_accounts(proxy_country);

CREATE INDEX IF NOT EXISTS idx_social_accounts_proxy_last_used 
ON social_accounts(proxy_last_used); 