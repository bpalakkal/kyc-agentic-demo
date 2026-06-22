-- =============================================================================
-- Migration 003 — Add confidence column to entity_attributes
-- =============================================================================
-- Stores the source confidence (0–100) alongside each attribute value.
-- API runners always write 100. Autonomous LLM agents write whatever
-- confidence score the model produces in its output JSON.
-- Run once in: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

ALTER TABLE entity_attributes
  ADD COLUMN IF NOT EXISTS confidence smallint
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100));
