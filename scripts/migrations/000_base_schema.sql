-- =============================================================================
-- Migration 000 — Base Schema
-- =============================================================================
-- Run this FIRST in the Supabase SQL Editor before any other migration.
-- Creates all core tables that migrations 001-003 build upon.
-- All DDL uses IF NOT EXISTS so it is safe to re-run.
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── 1. drgs ─────────────────────────────────────────────────────────────────
-- Discrete Risk Groups: buckets that group related entities under one client.

CREATE TABLE IF NOT EXISTS drgs (
  id    uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text  NOT NULL UNIQUE
);


-- ─── 2. entities ─────────────────────────────────────────────────────────────
-- One row per KYC case.

CREATE TABLE IF NOT EXISTS entities (
  kyc_ref               text  PRIMARY KEY,
  entity_name           text  NOT NULL,
  entity_type           text,
  jurisdiction          text,
  risk_rating           text,
  priority              text,
  drg_id                uuid  REFERENCES drgs(id) ON DELETE SET NULL,
  status                text  NOT NULL DEFAULT 'open',
  due_date              date,
  open_exceptions_count integer NOT NULL DEFAULT 0,
  case_owner            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entities_drg_id_idx   ON entities (drg_id);
CREATE INDEX IF NOT EXISTS entities_status_idx   ON entities (status);
CREATE INDEX IF NOT EXISTS entities_priority_idx ON entities (priority);


-- ─── 3. entity_snapshots ─────────────────────────────────────────────────────
-- Stores the raw KYC JSON blob received from a Forge agent or uploaded manually.
-- Each snapshot triggers attribute + person extraction on the server.

CREATE TABLE IF NOT EXISTS entity_snapshots (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref    text        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  data       jsonb       NOT NULL,
  agent_id   text,
  run_id     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_snapshots_kyc_ref_idx
  ON entity_snapshots (kyc_ref, created_at DESC);


-- ─── 4. entity_attributes ────────────────────────────────────────────────────
-- Flattened attribute rows extracted from a snapshot (or written directly by
-- an API runner).  snapshot_id is NOT NULL here; migration 001 makes it nullable
-- to support agent-run attributes that bypass the snapshot path.

CREATE TABLE IF NOT EXISTS entity_attributes (
  id                   uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref              text  NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  snapshot_id          uuid  NOT NULL REFERENCES entity_snapshots(id) ON DELETE CASCADE,

  attribute_name       text  NOT NULL,
  attribute_group      text  NOT NULL,   -- 'core' | 'wgq'
  display_value        text,
  source               text,

  -- Identity verification flags
  id_flag              boolean NOT NULL DEFAULT false,
  id_source            text,

  -- Verification flags
  verification_flag    boolean NOT NULL DEFAULT false,
  verification_source  text,

  -- Exception flags
  exception_flag       boolean NOT NULL DEFAULT false,
  exception_type       text,

  -- Audit lineage stored as a JSON array of source entries
  lineage              jsonb,

  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_attributes_kyc_ref_idx
  ON entity_attributes (kyc_ref);
CREATE INDEX IF NOT EXISTS entity_attributes_snapshot_idx
  ON entity_attributes (snapshot_id);
CREATE INDEX IF NOT EXISTS entity_attributes_group_idx
  ON entity_attributes (kyc_ref, attribute_group);


-- ─── 5. entity_persons ───────────────────────────────────────────────────────
-- Person-level records extracted from a snapshot (officers, controllers, etc.).

CREATE TABLE IF NOT EXISTS entity_persons (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref      text  NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  snapshot_id  uuid  NOT NULL REFERENCES entity_snapshots(id) ON DELETE CASCADE,
  role         text  NOT NULL,
  person_index integer NOT NULL DEFAULT 0,
  full_name    text,
  ownership_pct numeric(6,3),
  nationality  text,
  attributes   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_persons_kyc_ref_idx
  ON entity_persons (kyc_ref, snapshot_id);


-- ─── 6. exceptions ───────────────────────────────────────────────────────────
-- KYC exceptions flagged on an entity.  exception_number is sequential within
-- a kyc_ref, allocated by the alloc_exception_numbers() function below.
-- Columns `severity` and `agent_run_id` are added by migration 001.
-- Column `source_type` tracks origin: 'forge' | 'agent:<slug>' | 'manual'.

CREATE TABLE IF NOT EXISTS exceptions (
  id                   uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref              text  NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  exception_number     integer NOT NULL,

  attribute_name       text,
  field_name           text,
  source_type          text,

  status               text  NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'waived')),

  title                text,
  reasoning            jsonb,
  recommended_actions  jsonb,
  sources              jsonb,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (kyc_ref, exception_number)
);

CREATE INDEX IF NOT EXISTS exceptions_kyc_ref_idx
  ON exceptions (kyc_ref, exception_number);
CREATE INDEX IF NOT EXISTS exceptions_status_idx
  ON exceptions (kyc_ref, status);


-- ─── 7. exception_audit_log ──────────────────────────────────────────────────
-- Immutable append-only log of every action taken on an exception.

CREATE TABLE IF NOT EXISTS exception_audit_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref          text        NOT NULL,
  exception_number integer     NOT NULL,
  action           text        NOT NULL,
  actor            text,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exception_audit_log_idx
  ON exception_audit_log (kyc_ref, exception_number, occurred_at DESC);


-- ─── 8. alloc_exception_numbers() RPC ────────────────────────────────────────
-- Atomically reserves `p_count` sequential exception numbers for `p_kyc_ref`.
-- Returns the first number in the allocated block.
-- Used by ExceptionPublisher to avoid MAX()+1 race conditions.

CREATE TABLE IF NOT EXISTS exception_number_counters (
  kyc_ref      text PRIMARY KEY REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  next_number integer NOT NULL CHECK (next_number > 0)
);

INSERT INTO exception_number_counters (kyc_ref, next_number)
SELECT kyc_ref, MAX(exception_number) + 1
FROM exceptions
GROUP BY kyc_ref
ON CONFLICT (kyc_ref) DO UPDATE
SET next_number = GREATEST(exception_number_counters.next_number, EXCLUDED.next_number);

CREATE OR REPLACE FUNCTION alloc_exception_numbers(p_kyc_ref text, p_count integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start integer;
BEGIN
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'p_count must be greater than zero';
  END IF;

  INSERT INTO exception_number_counters AS counters (kyc_ref, next_number)
  VALUES (
    p_kyc_ref,
    COALESCE((SELECT MAX(exception_number) + 1 FROM exceptions WHERE kyc_ref = p_kyc_ref), 1) + p_count
  )
  ON CONFLICT (kyc_ref) DO UPDATE
  SET next_number = GREATEST(
    counters.next_number,
    COALESCE((SELECT MAX(exception_number) + 1 FROM exceptions WHERE kyc_ref = p_kyc_ref), 1)
  ) + p_count
  RETURNING next_number - p_count INTO v_start;

  RETURN v_start;
END;
$$;

REVOKE ALL ON exception_number_counters FROM anon, authenticated;
REVOKE ALL ON FUNCTION alloc_exception_numbers(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alloc_exception_numbers(text, integer) TO authenticated, service_role;


-- ─── 9. Row-Level Security ────────────────────────────────────────────────────
-- The Express server uses the service key and bypasses RLS entirely.
-- These policies allow signed-in browser clients to read data.

ALTER TABLE entities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE drgs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_attributes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_persons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policies text[][] := ARRAY[
    ARRAY['entities',            'Authenticated users can read entities'],
    ARRAY['drgs',                'Authenticated users can read drgs'],
    ARRAY['entity_snapshots',    'Authenticated users can read entity_snapshots'],
    ARRAY['entity_attributes',   'Authenticated users can read entity_attributes'],
    ARRAY['entity_persons',      'Authenticated users can read entity_persons'],
    ARRAY['exceptions',          'Authenticated users can read exceptions'],
    ARRAY['exception_audit_log', 'Authenticated users can read exception_audit_log']
  ];
  p text[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY policies LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE tablename = p[1] AND policyname = p[2]
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
        p[2], p[1]
      );
    END IF;
  END LOOP;
END
$$;
