CREATE TABLE IF NOT EXISTS agent_registry_audit (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug  text        NOT NULL,
  changed_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  old_config  jsonb       NOT NULL,
  new_config  jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_registry_audit_slug_idx
  ON agent_registry_audit (agent_slug, changed_at DESC);

ALTER TABLE agent_registry_audit ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE agent_registry_audit IS
  'Immutable audit history for Agent Register configuration changes made through the administration UI.';
