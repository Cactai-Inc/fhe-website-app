/*
  # FHE CRM — Audit Logging (migration 13)

  Phase 1, step 5. Additive. Implements DATABASE_SECURITY_AND_PERMISSION_MODEL §8.

  - audit_logs — append-only history: occurred_at, actor (auth.uid()), action,
    table, record id, old/new JSONB, ip, user_agent.
  - audit_row_change() — a generic AFTER INSERT/UPDATE/DELETE trigger attached to
    every new business table. SECURITY DEFINER so it can write the log row past
    audit_logs' deny-all RLS, and so it cannot be bypassed by a direct write.
  - Append-only is enforced two ways (§157): REVOKE UPDATE/DELETE from all roles,
    AND a guard trigger that raises on any UPDATE/DELETE — admin included.
  - RLS: admin-read only (matrix line 89). Writes happen solely via the trigger.

  Scope is the new business tables (mig 8/10/11/12). Lookup tables are excluded —
  they carry no business history (§149). Existing platform tables are out of this
  thread's scope (handoff: audit "every new table").

  The trigger reads ip/user_agent from request.headers when present (Supabase
  runtime) and degrades gracefully when absent (e.g. tests, psql).
*/

-- ============================================================
-- audit_logs — the append-only trail
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,                       -- auth.uid() of the acting principal (NULL for system)
  action      text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  table_name  text NOT NULL,
  record_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  ip          text,
  user_agent  text
);

CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx ON audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx        ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_occurred_idx     ON audit_logs (occurred_at);

-- ============================================================
-- Generic row-change capture (SECURITY DEFINER — writes past RLS, unbypassable)
-- ============================================================
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_headers text;
  v_ip      text;
  v_ua      text;
  v_rec     uuid;
BEGIN
  -- best-effort request metadata; absent outside the Supabase runtime
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NOT NULL AND v_headers <> '' THEN
    v_ip := (v_headers::json) ->> 'x-forwarded-for';
    v_ua := (v_headers::json) ->> 'user-agent';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_rec := OLD.id;
  ELSE
    v_rec := NEW.id;
  END IF;

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value, ip, user_agent)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_rec,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_ip,
    v_ua
  );

  RETURN NULL;  -- AFTER trigger; return value ignored
END;
$$;

-- Attach the audit trigger to every new business table (lookups excluded).
DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    'contacts','contact_roles','clients',
    'horses','engagements','engagement_parties',
    'contract_templates',
    'documents','signatures','document_deliveries'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'audit_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION audit_row_change()',
      'audit_' || t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- Append-only enforcement (§157): REVOKE + a guard trigger
-- ============================================================
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_mutate ON audit_logs;
CREATE TRIGGER audit_logs_no_mutate BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

-- ============================================================
-- RLS — admin-read only; nobody writes directly (trigger is the only writer)
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_admin_read ON audit_logs;
CREATE POLICY audit_logs_admin_read ON audit_logs
  FOR SELECT TO authenticated USING (is_admin());
