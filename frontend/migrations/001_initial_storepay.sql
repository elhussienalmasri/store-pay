CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  publishable_key TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS merchants_email_lower_key ON merchants (LOWER(email));

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  listed BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS products_merchant_created_idx ON products (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_marketplace_idx ON products (created_at DESC) WHERE active AND listed;

CREATE TABLE IF NOT EXISTS payment_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_sessions_merchant_created_idx ON payment_sessions (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_sessions_expires_at_idx ON payment_sessions (expires_at);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_merchant_created_idx ON webhook_deliveries (merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience IN ('merchant', 'buyer')),
  merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
  wallet TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_merchant_created_idx ON notifications (merchant_id, created_at DESC) WHERE audience = 'merchant';
CREATE INDEX IF NOT EXISTS notifications_wallet_created_idx ON notifications (wallet, created_at DESC) WHERE audience = 'buyer';

CREATE TABLE IF NOT EXISTS payout_profiles (
  wallet TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS p2p_listings (
  wallet TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (wallet, id)
);
CREATE INDEX IF NOT EXISTS p2p_listings_created_idx ON p2p_listings (created_at DESC);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS checkout_sessions_expires_at_idx ON checkout_sessions (expires_at);
