-- CLOSEOUT §1.8 (CONTRACTWALK B5) — notification resolution is a DELETE with no
-- log. Owner-ruled 2026-08-18:
--   "Deleting a notification is only acceptable if the log for them is part of
--    the contract docs set. At minimum this should include (notification
--    name/type/category, created timestamp, author, reason, notified timestamp,
--    recipients, locations, outcome, outcome timestamp) when resolved. The log
--    is our source of truth."
--
-- What existed: notifications (id·org_id·user_id·kind·title·body·link·read_at·
-- created_at·emailed_at) — no category, no author, no reason, no outcome — and
-- two deleters (consume_notification, resolve_notifications_for_link) writing
-- only a generic audit_logs row. audit_logs cannot serve: it records that a row
-- vanished, not why it existed.
--
-- Built here, following the shape of the four purpose-built send logs already
-- in this schema (document_deliveries, request_alert_sends, receipt_sends,
-- signup_alert_sends):
--   1. notifications gains category + author_user_id + reason; a BEFORE INSERT
--      trigger stamps category (derived from kind) and author (auth.uid()) so
--      all 28 existing notifier call sites capture provenance without being
--      rewritten. A NULL author reads as "system".
--   2. ONE log for ALL notifications — notification_log — one row per
--      recipient-notification, written BEFORE the delete IN THE SAME
--      TRANSACTION by both deleters. The contract view filters it by link.
--      It has no delete path and is never swept.
--   3. purge_account and hard_delete_contract keep their wholesale deletes:
--      purge is the owner-run test-identity removal (D1) where retaining a log
--      would defeat the purge; hard delete applies to never-sent documents.
--      Both are deliberate destruction paths, not resolution.

-- ── 1. capture what was never captured ───────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category       text,
  ADD COLUMN IF NOT EXISTS author_user_id uuid,
  ADD COLUMN IF NOT EXISTS reason         text;

CREATE OR REPLACE FUNCTION public.notification_category(p_kind text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_kind LIKE 'contract%' OR p_kind IN
      ('document_executed','party_signed','insurance_unresolved') THEN 'contract'
    WHEN p_kind LIKE 'purchase%' OR p_kind LIKE 'payment%' OR p_kind LIKE 'receipt%' THEN 'payment'
    WHEN p_kind LIKE 'lesson%' OR p_kind LIKE 'booking%' OR p_kind LIKE 'session%' THEN 'lesson'
    WHEN p_kind LIKE 'request%' OR p_kind LIKE 'lead%' OR p_kind LIKE 'signup%' THEN 'lead'
    WHEN p_kind IN ('member_hi','redemption_conflict') THEN 'account'
    WHEN p_kind LIKE 'horse%' THEN 'horse'
    ELSE 'general'
  END
$function$;

CREATE OR REPLACE FUNCTION public.notifications_capture_provenance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.category       := coalesce(NEW.category, notification_category(NEW.kind));
  -- the acting session raised it; NULL (cron, service role) reads as "system"
  NEW.author_user_id := coalesce(NEW.author_user_id, auth.uid());
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notifications_provenance ON notifications;
CREATE TRIGGER trg_notifications_provenance
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notifications_capture_provenance();

-- backfill the live rows so the log never writes a NULL category
UPDATE notifications SET category = notification_category(kind) WHERE category IS NULL;

-- ── 2. the log — one row per recipient-notification, written before delete ──
CREATE TABLE IF NOT EXISTS notification_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  notification_id   uuid NOT NULL,
  kind              text NOT NULL,          -- name / type
  category          text,                   -- contract · payment · lesson · lead · account · horse · general
  title             text,
  body              text,
  link              text,                   -- where it pointed; the contract view's filter key
  author_user_id    uuid,                   -- who or what raised it (NULL = system)
  reason            text,                   -- why it was raised, when the notifier said so
  recipient_user_id uuid,                   -- one row per recipient
  recipient_email   text,
  raised_at         timestamptz NOT NULL,   -- notifications.created_at
  emailed_at        timestamptz,            -- email delivery timestamp, when emailed
  read_at           timestamptz,            -- in-app read mark at resolution time
  locations         text[] NOT NULL,        -- where it surfaced (in_app, email)
  outcome           text NOT NULL,          -- what resolved it
  outcome_at        timestamptz NOT NULL DEFAULT now(),
  outcome_by        uuid                    -- who resolved it (NULL = system)
);
CREATE INDEX IF NOT EXISTS notification_log_link_idx ON notification_log (link);
CREATE INDEX IF NOT EXISTS notification_log_org_outcome_idx ON notification_log (org_id, outcome_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_log_staff_read ON notification_log;
CREATE POLICY notification_log_staff_read ON notification_log
  FOR SELECT USING (has_staff_access() AND org_id = current_org());
-- no INSERT/UPDATE/DELETE policies: only the SECURITY DEFINER resolvers write,
-- and nothing deletes — the log outlives the notification and is never swept.

-- ── 3. one writer, called by both deleters BEFORE the delete, same txn ──────
CREATE OR REPLACE FUNCTION public._log_notification_resolution(
  p_n notifications, p_outcome text, p_actor uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO notification_log (
    org_id, notification_id, kind, category, title, body, link,
    author_user_id, reason, recipient_user_id, recipient_email,
    raised_at, emailed_at, read_at, locations, outcome, outcome_at, outcome_by)
  VALUES (
    p_n.org_id, p_n.id, p_n.kind,
    coalesce(p_n.category, notification_category(p_n.kind)),
    p_n.title, p_n.body, p_n.link,
    p_n.author_user_id, p_n.reason, p_n.user_id,
    (SELECT pr.email FROM profiles pr WHERE pr.user_id = p_n.user_id),
    p_n.created_at, p_n.emailed_at, p_n.read_at,
    CASE WHEN p_n.emailed_at IS NOT NULL
         THEN ARRAY['in_app','email'] ELSE ARRAY['in_app'] END,
    p_outcome, now(), p_actor)
$function$;

-- ── 4. the recipient dismissing their own notification ──────────────────────
CREATE OR REPLACE FUNCTION public.consume_notification(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_n notifications%ROWTYPE;
BEGIN
  SELECT * INTO v_n FROM notifications WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;

  -- CLOSEOUT §1.8: the log is the source of truth, written before the delete
  -- in the same transaction — a failed delete rolls the log entry back with it.
  PERFORM _log_notification_resolution(v_n, 'dismissed_by_recipient', auth.uid());

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'DELETE', 'notifications', v_n.id,
    to_jsonb(v_n), jsonb_build_object('event', 'notification_consumed', 'by', 'recipient'));

  DELETE FROM notifications WHERE id = v_n.id;
  RETURN true;
END;
$function$;

-- ── 5. the event resolving every notification that pointed at it ────────────
CREATE OR REPLACE FUNCTION public.resolve_notifications_for_link(
  p_link text, p_actor uuid DEFAULT NULL::uuid, p_kind text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ct integer := 0; v_n notifications%ROWTYPE;
BEGIN
  IF p_link IS NULL OR btrim(p_link) = '' THEN RETURN 0; END IF;
  FOR v_n IN SELECT * FROM notifications
              WHERE link = p_link
                AND (p_kind IS NULL OR kind = p_kind) LOOP
    -- CLOSEOUT §1.8: log first, delete second, one transaction.
    PERFORM _log_notification_resolution(v_n, 'target_resolved', coalesce(p_actor, auth.uid()));
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
    VALUES (coalesce(p_actor, auth.uid()), 'DELETE', 'notifications', v_n.id,
      to_jsonb(v_n), jsonb_build_object('event', 'notification_resolved', 'by', 'target_resolved'));
    v_ct := v_ct + 1;
  END LOOP;
  DELETE FROM notifications WHERE link = p_link AND (p_kind IS NULL OR kind = p_kind);
  RETURN v_ct;
END;
$function$;

-- ── 6. the contract view reads its slice of the ONE log ─────────────────────
-- Contract notifications point at two link shapes ('/app/contracts/<doc>' for
-- parties, '/app/ops/documents/<doc>' for staff), so the filter matches the
-- document id anywhere in the link.
CREATE OR REPLACE FUNCTION public.contract_notification_log(p_document_id uuid)
 RETURNS TABLE(kind text, category text, title text, author text, reason text,
               recipient text, raised_at timestamptz, emailed_at timestamptz,
               locations text[], outcome text, outcome_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT nl.kind, nl.category, nl.title,
         coalesce((SELECT nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')
                     FROM profiles pr WHERE pr.user_id = nl.author_user_id), 'system'),
         nl.reason,
         coalesce((SELECT nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')
                     FROM profiles pr WHERE pr.user_id = nl.recipient_user_id),
                  nl.recipient_email),
         nl.raised_at, nl.emailed_at, nl.locations, nl.outcome, nl.outcome_at
    FROM notification_log nl
   WHERE has_staff_access()
     AND nl.org_id = current_org()
     AND position(p_document_id::text in coalesce(nl.link, '')) > 0
   ORDER BY nl.raised_at
$function$;

REVOKE ALL ON FUNCTION public.contract_notification_log(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_notification_log(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._log_notification_resolution(notifications, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._log_notification_resolution(notifications, text, uuid) TO service_role;
