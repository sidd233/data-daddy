-- DataDaddy AI Training Data Marketplace — DB Migration
-- Run against Supabase Postgres. Old tables (leases, lease_requests, buyer_content) are left intact.

CREATE TABLE IF NOT EXISTS data_submissions (
  id              SERIAL PRIMARY KEY,
  wallet_address  TEXT NOT NULL,
  fileverse_cid   TEXT NOT NULL UNIQUE,
  fileverse_url   TEXT NOT NULL,
  attribute_keys  TEXT[] NOT NULL DEFAULT '{}',
  content_preview TEXT,               -- first 200 chars of answer
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_submissions_attr_gin ON data_submissions USING GIN (attribute_keys);
CREATE INDEX IF NOT EXISTS idx_data_submissions_wallet ON data_submissions (LOWER(wallet_address));

CREATE TABLE IF NOT EXISTS data_requests (
  id                  SERIAL PRIMARY KEY,
  company_address     TEXT NOT NULL,
  attribute_keys      TEXT[] NOT NULL DEFAULT '{}',
  min_confidence      NUMERIC(4,3) DEFAULT 0,
  max_records         INT NOT NULL DEFAULT 100,
  price_per_record    NUMERIC(30,0) NOT NULL,   -- wei
  request_type        TEXT NOT NULL CHECK (request_type IN ('raw','labelled')),
  label_task_spec     JSONB,                     -- { labels: string[], instructions: string }
  stake_required      NUMERIC(30,0),
  voting_period_sec   INT,
  on_chain_task_id    TEXT,                      -- bytes32 hex
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS label_submissions (
  id                  SERIAL PRIMARY KEY,
  task_id             INT NOT NULL REFERENCES data_requests(id),
  data_id             INT NOT NULL REFERENCES data_submissions(id),
  labeller_address    TEXT NOT NULL,
  label               TEXT NOT NULL,
  on_chain_tx         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, data_id, labeller_address)
);

CREATE TABLE IF NOT EXISTS label_results (
  id              SERIAL PRIMARY KEY,
  task_id         INT NOT NULL REFERENCES data_requests(id),
  data_id         INT NOT NULL REFERENCES data_submissions(id),
  winning_label   TEXT NOT NULL,
  total_labellers INT NOT NULL,
  majority_count  INT NOT NULL,
  settled_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, data_id)
);
