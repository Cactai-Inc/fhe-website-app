-- Phase 3c — generic status model: append-only status_events + a denormalized
-- current_status per entity, a constrained vocab (true-status vs sub-status),
-- one writer (log_status_event), writers wired into the mutating RPCs, a
-- backfill from existing columns, and read APIs (entity_status_log + status_feed).
--
-- Grounded in discovery:
--   * audit_logs (full-row diff) already exists but does NOT model a constrained
--     status vocab or the true-status/sub-status distinction — so status_events
--     is a distinct, purpose-built table (not a reuse of audit_logs).
--   * The vocab-lookup pattern (document_status/engagement_status: code +
--     display_name + is_terminal + sort_order, FK'd from the entity) is the
--     house style — status_events_vocab mirrors it.
--   * Terminology is inconsistent (documents UPPER_SNAKE, others lower_snake) so
--     the vocab normalizes to a single presentation value per (entity_type, code).
--   * documents carry a dual axis (status + workflow_state); the backfill resolves
--     them into ONE presentation status (business status wins for terminal states).
--   * Row counts are tiny (contacts 18 / invitations 27 / documents 43 /
--     purchases 0 / bookings 13) so the backfill is trivial.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Vocabulary. One row per (entity_type, code). is_true_status distinguishes a
--    TRUE lifecycle status (shown prominently) from a SUB-status / log entry
--    (shown adjacent but distinct). Mirrors the document_status lookup shape.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.status_events_vocab (
  entity_type   text NOT NULL CHECK (entity_type IN ('account','document','order','offering')),
  code          text NOT NULL,
  display_name  text NOT NULL,
  is_true_status boolean NOT NULL DEFAULT true,   -- false = sub-status / log entry
  is_terminal   boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, code)
);
ALTER TABLE public.status_events_vocab ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS status_events_vocab_read ON public.status_events_vocab;
CREATE POLICY status_events_vocab_read ON public.status_events_vocab FOR SELECT TO authenticated USING (true);

INSERT INTO public.status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order) VALUES
  -- account (true statuses)
  ('account','invited','Invited',true,false,10),
  ('account','redeemed','Redeemed',true,false,20),
  ('account','active','Active',true,false,30),
  ('account','redeemed_unsuccessful','Redeemed — unsuccessful',true,false,25),
  ('account','revoked','Revoked',true,true,40),
  ('account','superseded','Superseded',true,true,45),
  ('account','expired','Expired',true,true,50),
  -- account (sub-status / log)
  ('account','sent','Invitation sent',false,false,11),
  ('account','resent','Invitation resent',false,false,12),
  ('account','redeem_failed','Redemption failed',false,false,26),
  -- document (true statuses)
  ('document','assigned','Assigned',true,false,10),
  ('document','sent_for_review','Sent for review',true,false,20),
  ('document','in_progress','In progress',true,false,30),
  ('document','ready_to_sign','Ready to sign',true,false,40),
  ('document','signed','Signed',true,true,50),
  ('document','void','Void',true,true,60),
  -- document (sub-status / log)
  ('document','viewed','Viewed',false,false,31),
  ('document','downloaded','Downloaded',false,false,32),
  ('document','sent','Delivered',false,false,21),
  ('document','send_failed','Delivery failed',false,false,22),
  -- order (true statuses)
  ('order','pending','Pending',true,false,10),
  ('order','submitted','Submitted',true,false,20),
  ('order','paid','Paid',true,false,30),
  ('order','complete','Complete',true,true,40),
  ('order','void','Void',true,true,50),
  -- order (sub-status / log)
  ('order','partial_payment','Partial payment',false,false,25),
  -- offering / booking (true statuses)
  ('offering','pending','Pending',true,false,10),
  ('offering','scheduled','Scheduled',true,false,20),
  ('offering','completed','Completed',true,true,30),
  ('offering','cancelled','Cancelled',true,true,40),
  -- offering (sub-status / log)
  ('offering','rescheduled','Rescheduled',false,false,21),
  ('offering','no_show','No-show',false,false,22)
ON CONFLICT (entity_type, code) DO UPDATE
  SET display_name = excluded.display_name, is_true_status = excluded.is_true_status,
      is_terminal = excluded.is_terminal, sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The append-only log. current_status on each entity is denormalized from the
--    latest TRUE-status event by the writer.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.status_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  entity_type   text NOT NULL CHECK (entity_type IN ('account','document','order','offering')),
  entity_id     uuid NOT NULL,
  status        text NOT NULL,        -- vocab code (true status OR sub-status)
  detail        text,                 -- free-text elaboration
  actor_user_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entity_type, status) REFERENCES public.status_events_vocab(entity_type, code)
);
CREATE INDEX IF NOT EXISTS status_events_entity_idx ON public.status_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS status_events_org_idx ON public.status_events (org_id, created_at DESC);

ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS status_events_staff_read ON public.status_events;
CREATE POLICY status_events_staff_read ON public.status_events FOR SELECT TO authenticated
  USING (has_staff_access() AND org_id = current_org());

-- denormalized current TRUE status per entity
ALTER TABLE public.documents   ADD COLUMN IF NOT EXISTS current_status text;
ALTER TABLE public.purchases   ADD COLUMN IF NOT EXISTS current_status text;
ALTER TABLE public.bookings    ADD COLUMN IF NOT EXISTS current_status text;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS current_status text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The single writer. Appends an event; when the code is a TRUE status, also
--    updates the entity's current_status. entity_type → the table it denormalizes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_status_event(
  p_entity_type text, p_entity_id uuid, p_status text, p_detail text DEFAULT NULL,
  p_org uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := p_org;
  v_true boolean;
  v_id   uuid;
BEGIN
  -- validate vocab + true/sub classification
  SELECT is_true_status INTO v_true FROM status_events_vocab
   WHERE entity_type = p_entity_type AND code = p_status;
  IF v_true IS NULL THEN
    RAISE EXCEPTION 'unknown status % for entity %', p_status, p_entity_type;
  END IF;

  -- resolve org from the entity when not supplied
  IF v_org IS NULL THEN
    v_org := CASE p_entity_type
      WHEN 'document' THEN (SELECT org_id FROM documents   WHERE id = p_entity_id)
      WHEN 'order'    THEN (SELECT org_id FROM purchases   WHERE id = p_entity_id)
      WHEN 'offering' THEN (SELECT org_id FROM bookings    WHERE id = p_entity_id)
      WHEN 'account'  THEN (SELECT org_id FROM invitations WHERE id = p_entity_id)
    END;
  END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for status event'; END IF;

  INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
    VALUES (v_org, p_entity_type, p_entity_id, p_status, p_detail, auth.uid())
    RETURNING id INTO v_id;

  IF v_true THEN
    IF    p_entity_type = 'document' THEN UPDATE documents   SET current_status = p_status WHERE id = p_entity_id;
    ELSIF p_entity_type = 'order'    THEN UPDATE purchases   SET current_status = p_status WHERE id = p_entity_id;
    ELSIF p_entity_type = 'offering' THEN UPDATE bookings    SET current_status = p_status WHERE id = p_entity_id;
    ELSIF p_entity_type = 'account'  THEN UPDATE invitations SET current_status = p_status WHERE id = p_entity_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Presentation mappers — normalize each entity's native columns into a single
--    vocab code. Used by the backfill and callable for on-the-fly display.
-- ─────────────────────────────────────────────────────────────────────────────
-- document: business status wins for terminal (EXECUTED→signed, VOID→void),
-- else derive from workflow_state.
CREATE OR REPLACE FUNCTION public.doc_status_code(p_status text, p_workflow text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN p_status = 'EXECUTED' THEN 'signed'
    WHEN p_status = 'VOID'     THEN 'void'
    WHEN p_workflow = 'in_review' THEN 'sent_for_review'
    WHEN p_workflow = 'locked'    THEN 'ready_to_sign'
    WHEN p_workflow IN ('editing') THEN 'in_progress'
    WHEN p_status = 'AWAITING_SIGNATURE' THEN 'ready_to_sign'
    ELSE 'assigned' END;
$function$;

CREATE OR REPLACE FUNCTION public.order_status_code(p_status text, p_payment text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN p_status = 'void' THEN 'void'
    WHEN p_status = 'paid' OR p_payment = 'paid' THEN 'paid'
    WHEN p_status = 'awaiting_payment' THEN 'submitted'
    WHEN p_status = 'sent' THEN 'submitted'
    ELSE 'pending' END;
$function$;

CREATE OR REPLACE FUNCTION public.booking_status_code(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN p_status IN ('completed') THEN 'completed'
    WHEN p_status IN ('cancelled','expired') THEN 'cancelled'
    WHEN p_status IN ('scheduled','confirmed','pending','pending_slot','pending_payment') THEN 'scheduled'
    ELSE 'pending' END;
$function$;

CREATE OR REPLACE FUNCTION public.account_status_code(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN p_status IN ('redeemed','accepted') THEN 'redeemed'
    WHEN p_status = 'redeemed_unsuccessful' THEN 'redeemed_unsuccessful'
    WHEN p_status = 'revoked' THEN 'revoked'
    WHEN p_status = 'superseded' THEN 'superseded'
    WHEN p_status = 'expired' THEN 'expired'
    ELSE 'invited' END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill current_status + a seed status_event from existing columns.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE documents SET current_status = doc_status_code(status, workflow_state) WHERE current_status IS NULL;
UPDATE purchases SET current_status = order_status_code(status, payment_status) WHERE current_status IS NULL;
UPDATE bookings  SET current_status = booking_status_code(status) WHERE current_status IS NULL;
UPDATE invitations SET current_status = account_status_code(status) WHERE current_status IS NULL;

INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, created_at)
  SELECT org_id, 'document', id, doc_status_code(status, workflow_state), 'backfilled', coalesce(updated_at, created_at, now())
    FROM documents WHERE deleted_at IS NULL;
INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, created_at)
  SELECT org_id, 'order', id, order_status_code(status, payment_status), 'backfilled', coalesce(updated_at, created_at, now())
    FROM purchases WHERE deleted_at IS NULL;
INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, created_at)
  SELECT org_id, 'offering', id, booking_status_code(status), 'backfilled', coalesce(updated_at, created_at, now())
    FROM bookings;
INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, created_at)
  SELECT org_id, 'account', id, account_status_code(status), 'backfilled', coalesce(created_at, now())
    FROM invitations WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Read APIs. entity_status_log = the full timeline for one entity (true +
--    sub, newest first). status_feed = the org-wide aggregate with filters.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entity_status_log(p_entity_type text, p_entity_id uuid)
RETURNS TABLE(status text, display_name text, is_true_status boolean, is_terminal boolean,
              detail text, actor_user_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.status, v.display_name, v.is_true_status, v.is_terminal, e.detail, e.actor_user_id, e.created_at
    FROM status_events e
    JOIN status_events_vocab v ON v.entity_type = e.entity_type AND v.code = e.status
   WHERE e.entity_type = p_entity_type AND e.entity_id = p_entity_id
     AND has_staff_access() AND e.org_id = current_org()
   ORDER BY e.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.status_feed(
  p_entity_type text DEFAULT NULL, p_true_only boolean DEFAULT false, p_limit int DEFAULT 100)
RETURNS TABLE(entity_type text, entity_id uuid, status text, display_name text,
              is_true_status boolean, detail text, actor_user_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.entity_type, e.entity_id, e.status, v.display_name, v.is_true_status,
         e.detail, e.actor_user_id, e.created_at
    FROM status_events e
    JOIN status_events_vocab v ON v.entity_type = e.entity_type AND v.code = e.status
   WHERE has_staff_access() AND e.org_id = current_org()
     AND (p_entity_type IS NULL OR e.entity_type = p_entity_type)
     AND (NOT p_true_only OR v.is_true_status)
   ORDER BY e.created_at DESC
   LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

COMMIT;
