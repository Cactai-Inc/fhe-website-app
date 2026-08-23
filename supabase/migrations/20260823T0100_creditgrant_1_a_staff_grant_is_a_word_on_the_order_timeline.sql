-- TASK-CREDITGRANT 1 — a staff grant is a WORD on the order timeline, not a jsonb diff.
--
-- D19 requires a value-moving action to RECORD ITSELF legibly. `audit_logs` already
-- fires on lesson_credits (TASK-AUTHORITY, authority_5), but an audit row is an
-- opaque jsonb diff no staff member reads without SQL — the task names that exact
-- failure. `status_events` is the ledger a person reads (StatusLog renders it), and
-- an order is the entity a grant already hangs off, so the three staff acts get
-- their own vocabulary there.
--
-- All three are is_true_status = false: they are notes ON the order's timeline, not
-- replacements for its true status, which order_status_code() still owns. Writing a
-- true status here would overwrite `purchases.current_status` and lose "paid" /
-- "submitted" / "void".

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES
  ('order', 'staff_grant',       'Credit granted by staff',   false, false, 4),
  ('order', 'grant_reversed',    'Staff credit grant undone', false, false, 4),
  ('order', 'payment_requested', 'Payment requested',         false, false, 24)
ON CONFLICT (entity_type, code) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      is_true_status = EXCLUDED.is_true_status,
      sort_order = EXCLUDED.sort_order;
