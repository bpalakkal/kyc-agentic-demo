-- C5: Immutable audit trail for exception state transitions.
-- This table is append-only — never UPDATE or DELETE rows.
CREATE TABLE IF NOT EXISTS exception_audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref           TEXT        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  exception_number  INT         NOT NULL,
  action            TEXT        NOT NULL,          -- 'resolved', 're_opened', etc.
  actor             TEXT,                          -- user email or id from JWT
  resolution_option INT,
  resolution        TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-entity audit queries
CREATE INDEX IF NOT EXISTS idx_exc_audit_kyc ON exception_audit_log(kyc_ref, exception_number);

-- Revoke UPDATE and DELETE so even service-role cannot mutate audit rows
REVOKE UPDATE, DELETE ON exception_audit_log FROM service_role;
