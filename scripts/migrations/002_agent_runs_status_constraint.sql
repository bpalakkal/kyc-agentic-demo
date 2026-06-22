-- =============================================================================
-- Migration 002 — Widen agent_runs.status CHECK constraint
-- =============================================================================
-- Migration 001 only allowed ('running', 'complete', 'failed') but the
-- two-phase preview→commit flow introduced two additional status values:
--   pending_review  — execute() completed, waiting for analyst to accept/reject
--   cancelled       — analyst rejected, or 30-minute review window expired
--
-- PostgreSQL does not support ALTER CONSTRAINT, so we drop and re-add.
-- Run once in: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

ALTER TABLE agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_status_check;

ALTER TABLE agent_runs
  ADD CONSTRAINT agent_runs_status_check
  CHECK (status IN ('running', 'pending_review', 'complete', 'failed', 'cancelled'));
