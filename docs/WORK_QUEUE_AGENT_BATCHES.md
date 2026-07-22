# Work Queue top-level agent batches

The Work Queue can run one registered top-level agent across up to 25 selected
entities. The browser performs a preflight, but the server repeats eligibility
checks immediately before each case begins.

## Execution contract

- Only enabled, available, user-triggerable agents marked
  `top_level_trigger=true` are accepted.
- One agent is selected per batch.
- At most three cases execute concurrently.
- Existing per-entity Sourcing/DD sequencing and pending-attribute review rules
  remain authoritative.
- Ineligible cases are recorded as `skipped`; one failed case does not stop the
  rest of the batch.
- Browser closure does not stop execution because processing occurs on the
  server and status is persisted in `agent_run_batches` and
  `agent_run_batch_items`.
- Each actual case execution continues to use ordinary `agent_runs` records.
- Cancellation prevents queued cases from starting; already-running cases are
  allowed to finish. Retry requeues failed cases only.

## API

- `POST /api/work-queue/agent-runs/preflight`
- `POST /api/work-queue/agent-run-batches`
- `GET /api/work-queue/agent-run-batches/:batchId`
- `POST /api/work-queue/agent-run-batches/:batchId/cancel`
- `POST /api/work-queue/agent-run-batches/:batchId/retry`

Batch creation requires a client-generated idempotency key. Batch reads and
actions are restricted to the initiating user.
