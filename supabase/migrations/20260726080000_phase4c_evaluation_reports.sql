-- Phase 4c — evaluation-report subsystem (full lifecycle).
--
-- A Horse Evaluation produces a written report. This builds the WHOLE thing:
--   * storage + authoring (staff create/update a draft, tied to the buyer, the
--     purchase line, and the horse label from the intake);
--   * delivery (staff release → status 'delivered', delivered_at + the 90-day
--     retention window, an ALERT to the client, staff notified);
--   * retention rule (90 days from delivery, UNLESS the buyer holds a RIDER or
--     HORSE_OWNER standing category → indefinite) enforced in RLS + the read;
--   * sharing (report_shares — share the report with another contact);
--   * download-audit (every download/email logged), and the client read.
-- The PDF render + email attachment + share-email are the /api layer (reusing the
-- existing document PDF + email helpers); this migration is the data + rules.

BEGIN;

-- ── Storage ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT current_org(),
  contact_id       uuid NOT NULL REFERENCES public.contacts(id),
  purchase_item_id uuid REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  horse_id         uuid REFERENCES public.horses(id) ON DELETE SET NULL,
  horse_label      text,
  title            text NOT NULL DEFAULT 'Horse Evaluation Report',
  body             text,                 -- the written report (markdown/plain)
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','delivered','void')),
  delivered_at     timestamptz,          -- set when released to the client
  available_until  timestamptz,          -- delivered_at + 90d; NULL = indefinite
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX IF NOT EXISTS evaluation_reports_contact_idx ON public.evaluation_reports (contact_id);
CREATE INDEX IF NOT EXISTS evaluation_reports_org_idx ON public.evaluation_reports (org_id);

-- reuse the shared set_updated_at() trigger fn (already defined for other tables)
DROP TRIGGER IF EXISTS evaluation_reports_set_updated ON public.evaluation_reports;
CREATE TRIGGER evaluation_reports_set_updated BEFORE UPDATE ON public.evaluation_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shares: a delivered report shared with another contact (co-owner, trainer, vet)
CREATE TABLE IF NOT EXISTS public.evaluation_report_shares (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL DEFAULT current_org(),
  report_id             uuid NOT NULL REFERENCES public.evaluation_reports(id) ON DELETE CASCADE,
  shared_with_contact_id uuid REFERENCES public.contacts(id),
  shared_with_email     text,
  shared_by             uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evaluation_report_shares_report_idx ON public.evaluation_report_shares (report_id);
CREATE INDEX IF NOT EXISTS evaluation_report_shares_contact_idx ON public.evaluation_report_shares (shared_with_contact_id);

-- access-audit: every view/download/email of a report (who, how, when)
CREATE TABLE IF NOT EXISTS public.evaluation_report_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT current_org(),
  report_id   uuid NOT NULL REFERENCES public.evaluation_reports(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action      text NOT NULL CHECK (action IN ('viewed','downloaded','emailed','shared')),
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evaluation_report_access_report_idx ON public.evaluation_report_access (report_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.evaluation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_report_access ENABLE ROW LEVEL SECURITY;

-- staff: full read within their org
DROP POLICY IF EXISTS evaluation_reports_staff_read ON public.evaluation_reports;
CREATE POLICY evaluation_reports_staff_read ON public.evaluation_reports FOR SELECT TO authenticated
  USING (has_staff_access() AND org_id = current_org());

-- the buyer / a share recipient: read a DELIVERED report while it's still
-- available. Retention rule lives here: available while not-yet-expired, OR the
-- viewer holds a RIDER/HORSE_OWNER standing category (a consistent client →
-- indefinite), OR it was shared with them.
DROP POLICY IF EXISTS evaluation_reports_owner_read ON public.evaluation_reports;
CREATE POLICY evaluation_reports_owner_read ON public.evaluation_reports FOR SELECT TO authenticated
  USING (
    delivered_at IS NOT NULL
    AND deleted_at IS NULL
    AND (
      -- the buyer, subject to the retention window / consistent-client exception
      (contact_id = current_contact_id()
        AND (available_until IS NULL OR available_until >= now()
             OR EXISTS (SELECT 1 FROM contact_roles cr
                         WHERE cr.contact_id = current_contact_id()
                           AND cr.role_type IN ('RIDER','HORSE_OWNER'))))
      -- or a share recipient (shares don't expire on the 90-day window)
      OR EXISTS (SELECT 1 FROM evaluation_report_shares s
                  WHERE s.report_id = evaluation_reports.id
                    AND s.shared_with_contact_id = current_contact_id())
    )
  );

DROP POLICY IF EXISTS evaluation_report_shares_read ON public.evaluation_report_shares;
CREATE POLICY evaluation_report_shares_read ON public.evaluation_report_shares FOR SELECT TO authenticated
  USING (has_staff_access() AND org_id = current_org()
         OR shared_with_contact_id = current_contact_id());

DROP POLICY IF EXISTS evaluation_report_access_read ON public.evaluation_report_access;
CREATE POLICY evaluation_report_access_read ON public.evaluation_report_access FOR SELECT TO authenticated
  USING (has_staff_access() AND org_id = current_org());

-- ── Authoring (staff) ────────────────────────────────────────────────────────
-- Create a draft (or reuse an existing draft for the same purchase line). Pulls
-- the horse label from the buyer's submitted intake when present.
CREATE OR REPLACE FUNCTION public.create_evaluation_report(
  p_contact_id uuid, p_purchase_item_id uuid DEFAULT NULL,
  p_horse_id uuid DEFAULT NULL, p_title text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_id  uuid;
  v_label text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF p_contact_id IS NULL THEN RAISE EXCEPTION 'contact is required'; END IF;

  -- reuse an existing draft for this purchase line if one exists
  IF p_purchase_item_id IS NOT NULL THEN
    SELECT id INTO v_id FROM evaluation_reports
     WHERE purchase_item_id = p_purchase_item_id AND status = 'draft' AND deleted_at IS NULL
     LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'reused', true); END IF;
  END IF;

  -- horse label from the submitted intake, if any
  SELECT coalesce(pi.config->>'horse_name', pi.config->>'horse_location')
    INTO v_label FROM purchase_items pi WHERE pi.id = p_purchase_item_id;

  INSERT INTO evaluation_reports (org_id, contact_id, purchase_item_id, horse_id, horse_label, title, created_by)
    VALUES (v_org, p_contact_id, p_purchase_item_id, p_horse_id, v_label,
            coalesce(p_title, 'Horse Evaluation Report'), auth.uid())
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'reused', false);
END;
$function$;

-- Save the report body/title (staff, draft only).
CREATE OR REPLACE FUNCTION public.save_evaluation_report(
  p_report_id uuid, p_body text, p_title text DEFAULT NULL, p_horse_label text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  UPDATE evaluation_reports
     SET body = p_body,
         title = coalesce(p_title, title),
         horse_label = coalesce(p_horse_label, horse_label)
   WHERE id = p_report_id AND org_id = current_org() AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found or not a draft'; END IF;
END;
$function$;

-- ── Deliver (staff) → status delivered + retention window + alert the CLIENT ──
CREATE OR REPLACE FUNCTION public.deliver_evaluation_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_user    uuid;
  v_consistent boolean;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT contact_id, org_id INTO v_contact, v_org FROM evaluation_reports
   WHERE id = p_report_id AND org_id = current_org();
  IF v_contact IS NULL THEN RAISE EXCEPTION 'report not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM contact_roles cr
                  WHERE cr.contact_id = v_contact AND cr.role_type IN ('RIDER','HORSE_OWNER'))
    INTO v_consistent;

  UPDATE evaluation_reports
     SET status = 'delivered', delivered_at = now(),
         available_until = CASE WHEN v_consistent THEN NULL ELSE now() + interval '90 days' END
   WHERE id = p_report_id;

  -- ALERT the client (their account), not just staff. notifications.user_id is
  -- the account; resolve it from the report's contact.
  SELECT user_id INTO v_user FROM profiles WHERE contact_id = v_contact LIMIT 1;
  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, v_user, 'evaluation_report_ready',
            'Your horse evaluation report is ready',
            'Your evaluation report is available to review, download, or share.',
            '/app/evaluations');
  END IF;
  PERFORM notify_staff(v_org, 'evaluation_report_delivered',
    'An evaluation report was delivered', '/app/ops/oversight');

  RETURN jsonb_build_object('ok', true, 'consistent_client', v_consistent);
END;
$function$;

-- ── Share (owner or staff) → record + let the /api layer email the recipient ──
CREATE OR REPLACE FUNCTION public.share_evaluation_report(
  p_report_id uuid, p_email text DEFAULT NULL, p_contact_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_allowed boolean;
BEGIN
  SELECT org_id, (has_staff_access() OR contact_id = current_contact_id())
    INTO v_org, v_allowed
    FROM evaluation_reports WHERE id = p_report_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'report not found'; END IF;
  IF NOT coalesce(v_allowed, false) THEN RAISE EXCEPTION 'not allowed to share this report'; END IF;

  INSERT INTO evaluation_report_shares (org_id, report_id, shared_with_contact_id, shared_with_email, shared_by)
    VALUES (v_org, p_report_id, p_contact_id, lower(nullif(trim(p_email), '')), auth.uid());
  INSERT INTO evaluation_report_access (org_id, report_id, actor_user_id, action, detail)
    VALUES (v_org, p_report_id, auth.uid(), 'shared', coalesce(p_email, p_contact_id::text));
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── Access-audit writer (view/download/email) — reused by FE + /api ──
CREATE OR REPLACE FUNCTION public.log_evaluation_report_access(
  p_report_id uuid, p_action text, p_detail text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM evaluation_reports WHERE id = p_report_id;
  IF v_org IS NULL THEN RETURN; END IF;
  INSERT INTO evaluation_report_access (org_id, report_id, actor_user_id, action, detail)
    VALUES (v_org, p_report_id, auth.uid(), p_action, p_detail);
END;
$function$;

-- ── Reads ────────────────────────────────────────────────────────────────────
-- The client's own currently-available reports (RLS enforces retention + shares).
CREATE OR REPLACE FUNCTION public.my_evaluation_reports()
RETURNS TABLE(id uuid, title text, horse_label text, body text,
              delivered_at timestamptz, available_until timestamptz, is_shared boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT r.id, r.title, r.horse_label, r.body, r.delivered_at, r.available_until,
         (r.contact_id <> current_contact_id()) AS is_shared
    FROM evaluation_reports r
   WHERE r.deleted_at IS NULL
   ORDER BY r.delivered_at DESC NULLS LAST;
$function$;

-- Staff: reports for the org (all statuses), with the access count.
CREATE OR REPLACE FUNCTION public.staff_evaluation_reports()
RETURNS TABLE(id uuid, contact_id uuid, title text, horse_label text, status text,
              delivered_at timestamptz, available_until timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.id, r.contact_id, r.title, r.horse_label, r.status,
         r.delivered_at, r.available_until, r.created_at
    FROM evaluation_reports r
   WHERE r.deleted_at IS NULL AND r.org_id = current_org()
     AND has_staff_access()
   ORDER BY r.created_at DESC;
$function$;

COMMIT;
