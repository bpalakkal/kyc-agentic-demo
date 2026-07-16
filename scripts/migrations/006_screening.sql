-- =============================================================================
-- Migration 006 — Screening (separate master: screening_results_schema.json)
-- =============================================================================
-- Screening is a SEPARATE master from entity attributes (OpenSanctions output:
-- subjects × hits). Each run is stored as a jsonb blob; analyst dispositions
-- live in an overlay table re-applied on read so they survive re-screens.
--
-- Run once in: Supabase Dashboard -> SQL Editor -> New query
-- =============================================================================

-- Full screening_results_schema.json output for one run.
CREATE TABLE IF NOT EXISTS screening_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref      text        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  data         jsonb       NOT NULL,   -- { entity_id, case_id, screening_timestamp, screening_config, screening_results[] }
  initiated_by text,
  screened_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS screening_runs_kyc_idx
  ON screening_runs (kyc_ref, screened_at DESC);

-- Durable analyst decisions per matched entity, re-applied by getScreening on
-- every read so they persist across re-screens. match_id = OpenSanctions id.
-- party_index uses -1 for the entity subject (party_role = 'entity') so it can
-- participate in the primary key (NULL is not allowed in a PK).
-- disposition holds the ANALYST override (the flow itself sets pending_review /
-- discounted via its discount rules — those show through when no analyst decision
-- exists). Analyst may confirm a match, clear it, or escalate.
CREATE TABLE IF NOT EXISTS screening_dispositions (
  kyc_ref      text        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  party_role   text        NOT NULL,
  party_index  integer     NOT NULL DEFAULT -1,
  match_id     text        NOT NULL,
  disposition  text        NOT NULL
    CHECK (disposition IN ('true_match', 'false_positive', 'escalated')),
  analyst      text,
  notes        text,
  decided_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kyc_ref, party_role, party_index, match_id)
);

COMMENT ON TABLE screening_runs IS
  'One OpenSanctions screening run per row (screening_results_schema.json blob). Latest per kyc_ref is shown.';
COMMENT ON TABLE screening_dispositions IS
  'Durable analyst hit dispositions, re-applied on read so they survive re-screens.';
