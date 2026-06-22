-- =============================================================================
-- Migration 001 — Agent Runs + Case Files
-- =============================================================================
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- All DDL uses IF NOT EXISTS guards so a failed partial run can be re-run safely.
-- =============================================================================

-- ─── 1. agent_runs ───────────────────────────────────────────────────────────
-- Persists every agent invocation so the app can show run history, link
-- attributes / exceptions / files back to their originating run, and let
-- the server resume polling on restart without losing context.

CREATE TABLE IF NOT EXISTS agent_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref           text        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,

  -- Which agent ran and how it was invoked.
  agent_slug        text        NOT NULL,   -- e.g. "companies-house", "fca", "adverse-media"
  runner_type       text        NOT NULL
    CHECK (runner_type IN ('api', 'autonomous')),
                                            -- 'api'        = direct REST/API pull (synchronous)
                                            -- 'autonomous' = AWS ELB AI agent  (async + polling)

  -- For autonomous agents: the opaque run ID returned by the AWS ELB.
  external_run_id   text,

  -- What kind of data the run produced.
  output_type       text
    CHECK (output_type IN ('attributes', 'exceptions', 'both', 'files-only')),

  -- Lifecycle.
  status            text        NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'complete', 'failed')),
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  error             text,

  -- Provenance.
  sources_consulted jsonb,                  -- e.g. ["companies-house.gov.uk", "fca.org.uk"]
  initiated_by      uuid                    -- auth.users.id of the analyst who triggered the run
);

-- Index for work-queue queries: "show me all runs for this entity"
CREATE INDEX IF NOT EXISTS agent_runs_kyc_ref_idx
  ON agent_runs (kyc_ref);

-- Partial index: only running jobs need external_run_id lookups (for polling)
CREATE INDEX IF NOT EXISTS agent_runs_external_run_id_idx
  ON agent_runs (external_run_id)
  WHERE external_run_id IS NOT NULL;

-- Partial index: only used while polling; completed runs don't need status scans
CREATE INDEX IF NOT EXISTS agent_runs_running_idx
  ON agent_runs (kyc_ref, started_at DESC)
  WHERE status = 'running';


-- ─── 2. case_files ───────────────────────────────────────────────────────────
-- Metadata for every document or screenshot produced by any agent run (or
-- manually uploaded by an analyst).  Actual bytes live in Supabase Storage
-- bucket "kyc-files"; this table stores pointers + display metadata.

CREATE TABLE IF NOT EXISTS case_files (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref        text        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  agent_run_id   uuid        REFERENCES agent_runs(id) ON DELETE SET NULL,

  -- Category drives how the UI renders and routes the file.
  file_category  text        NOT NULL
    CHECK (file_category IN ('document', 'screenshot')),

  -- MIME type for correct Content-Type on download and viewer selection.
  mime_type      text        NOT NULL,   -- "application/pdf", "image/png", "image/jpeg",
                                         -- "application/vnd.openxmlformats-officedocument.wordprocessingml.document", …

  -- Display metadata.
  filename       text        NOT NULL,
  title          text,                   -- human-readable label shown in the UI
  caption        text,                   -- screenshot annotation / document description

  -- Storage location — unique enforces one DB row per file in the bucket.
  storage_path   text        NOT NULL UNIQUE,
                                         -- format: "{kyc_ref}/documents/{filename}"
                                         --      or "{kyc_ref}/screenshots/{filename}"

  -- Where the file originated (for audit trail and "open source" links in UI).
  source_url     text,                   -- original URL if scraped/downloaded

  -- Who uploaded (null = agent-uploaded via service key).
  uploaded_by    uuid,                   -- auth.users.id; null for agent uploads

  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_files_kyc_ref_idx
  ON case_files (kyc_ref, created_at DESC);

CREATE INDEX IF NOT EXISTS case_files_agent_run_id_idx
  ON case_files (agent_run_id)
  WHERE agent_run_id IS NOT NULL;

-- Efficient "show me documents only" / "show me screenshots only" queries.
CREATE INDEX IF NOT EXISTS case_files_category_idx
  ON case_files (kyc_ref, file_category);


-- ─── 3. Existing table schema adjustments ────────────────────────────────────

-- entity_attributes.snapshot_id must be nullable so that agent-run attributes
-- (which don't come from a Forge JSON snapshot) can be stored with snapshot_id=NULL
-- and agent_run_id set instead.  Existing rows are unaffected.
ALTER TABLE entity_attributes ALTER COLUMN snapshot_id DROP NOT NULL;

-- Add severity to exceptions so agent-raised exceptions can carry risk weighting.
ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS severity text
  CHECK (severity IN ('low', 'medium', 'high'));

-- ─── 4. Link entity_attributes → agent_runs ──────────────────────────────────
-- Lets the attribute lineage panel show "written by run #xyz on <date>".

ALTER TABLE entity_attributes
  ADD COLUMN IF NOT EXISTS agent_run_id uuid
    REFERENCES agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS entity_attributes_agent_run_id_idx
  ON entity_attributes (agent_run_id)
  WHERE agent_run_id IS NOT NULL;


-- ─── 5. Link exceptions → agent_runs ─────────────────────────────────────────
-- Lets the exception detail panel show which agent raised the exception.

ALTER TABLE exceptions
  ADD COLUMN IF NOT EXISTS agent_run_id uuid
    REFERENCES agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS exceptions_agent_run_id_idx
  ON exceptions (agent_run_id)
  WHERE agent_run_id IS NOT NULL;


-- ─── 6. Row-Level Security ────────────────────────────────────────────────────
-- The Express server always uses the service key, which bypasses RLS entirely.
-- These policies cover any direct Supabase JS client calls made from the browser
-- (e.g., real-time subscriptions or future front-end queries).

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;

-- Read-only access for signed-in analysts. All writes go through the server.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_runs'
      AND policyname = 'Authenticated users can read agent_runs'
  ) THEN
    CREATE POLICY "Authenticated users can read agent_runs"
      ON agent_runs FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'case_files'
      AND policyname = 'Authenticated users can read case_files'
  ) THEN
    CREATE POLICY "Authenticated users can read case_files"
      ON case_files FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;
