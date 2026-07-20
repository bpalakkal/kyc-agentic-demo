-- Per-analyst review cursors for case Documents and Agent Runs badges.
CREATE TABLE IF NOT EXISTS case_tab_reviews (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kyc_ref     text        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  tab         text        NOT NULL CHECK (tab IN ('documents', 'agent_runs')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kyc_ref, tab)
);

CREATE INDEX IF NOT EXISTS case_tab_reviews_case_idx
  ON case_tab_reviews (kyc_ref, user_id);

ALTER TABLE case_tab_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Analysts can read their case tab reviews" ON case_tab_reviews;
CREATE POLICY "Analysts can read their case tab reviews"
  ON case_tab_reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE case_tab_reviews IS
  'Last time an analyst opened a case Documents or Agent Runs tab; used for persistent unread badges.';
