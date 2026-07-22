-- Durable Work Queue batches for running one registered top-level agent across
-- multiple entities. Individual executions remain ordinary agent_runs rows.

CREATE TABLE IF NOT EXISTS agent_run_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug      text NOT NULL REFERENCES agent_registry(slug),
  category        text NOT NULL,
  initiated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'complete', 'partial', 'failed', 'cancelled')),
  idempotency_key text NOT NULL,
  total_count     integer NOT NULL DEFAULT 0,
  queued_count    integer NOT NULL DEFAULT 0,
  running_count   integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  skipped_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  UNIQUE (initiated_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS agent_run_batch_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid NOT NULL REFERENCES agent_run_batches(id) ON DELETE CASCADE,
  kyc_ref            text NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  entity_name        text NOT NULL,
  status             text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'complete', 'failed', 'skipped', 'cancelled')),
  eligibility_reason text,
  agent_run_id       uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  attempts           integer NOT NULL DEFAULT 0,
  error              text,
  started_at         timestamptz,
  completed_at       timestamptz,
  UNIQUE (batch_id, kyc_ref)
);

CREATE INDEX IF NOT EXISTS agent_run_batches_created_idx
  ON agent_run_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_run_batch_items_batch_status_idx
  ON agent_run_batch_items (batch_id, status);

ALTER TABLE agent_run_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_batch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read agent run batches" ON agent_run_batches;
CREATE POLICY "authenticated read agent run batches" ON agent_run_batches
  FOR SELECT TO authenticated USING (initiated_by = auth.uid());
DROP POLICY IF EXISTS "authenticated read agent run batch items" ON agent_run_batch_items;
CREATE POLICY "authenticated read agent run batch items" ON agent_run_batch_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM agent_run_batches batch WHERE batch.id = batch_id AND batch.initiated_by = auth.uid())
  );
