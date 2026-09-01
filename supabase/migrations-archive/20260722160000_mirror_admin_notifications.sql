-- Co-owner notification mirroring + new-request alerts.
--
-- FHE is co-owned by two admin accounts (admin@ and hello@fhequestrian.com) who
-- jointly manage all client/org work. Requirement: any org/client notification
-- that reaches one admin must reach the other too — a single shared inbox across
-- both logins — while personal pings ("you signed", social "hi") stay personal.
--
-- Implementation: an AFTER INSERT trigger on notifications. When a row lands for
-- an ADMIN/OWNER of an org, it fans the same alert out to every OTHER admin/owner
-- in that org. Guarded so it never recurses (fan-out copies are skipped) and never
-- duplicates (skip if that admin already has the same kind+link).
--
-- Also: submit_public_request now notifies staff in-app on every new request —
-- previously it inserted the request and alerted no one, which is why website
-- inquiries were "never received" (they sat unseen in the Request Inbox).

-- Kinds that are inherently personal and must NOT be mirrored to co-admins.
CREATE OR REPLACE FUNCTION public.notification_is_personal(p_kind text)
 RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$
  SELECT p_kind IN ('member_hi','member_hi_back')
      OR p_kind LIKE '%_reminder'
      OR p_kind = 'document_executed_self';  -- reserved: a signer's own confirmation
$function$;

CREATE OR REPLACE FUNCTION public.mirror_admin_notification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  -- only mirror org/client events, and only when the recipient is themselves an
  -- admin/owner (so client-facing alerts to clients are never copied to staff).
  IF notification_is_personal(NEW.kind) THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.user_id = NEW.user_id AND p.org_id = NEW.org_id
       AND coalesce(p.role,'USER') IN ('ADMIN','MANAGER','EMPLOYEE','OWNER','SUPERADMIN')
  ) THEN RETURN NEW; END IF;

  -- fan out to every OTHER admin/owner in the org, skipping any who already have
  -- this exact alert (keeps it idempotent and prevents trigger recursion loops).
  INSERT INTO notifications (org_id, user_id, kind, title, body, link)
  SELECT NEW.org_id, p.user_id, NEW.kind, NEW.title, NEW.body, NEW.link
    FROM profiles p
   WHERE p.org_id = NEW.org_id
     AND p.user_id <> NEW.user_id
     AND coalesce(p.role,'USER') IN ('ADMIN','MANAGER','EMPLOYEE','OWNER','SUPERADMIN')
     AND NOT EXISTS (
       SELECT 1 FROM notifications n2
        WHERE n2.user_id = p.user_id AND n2.org_id = NEW.org_id
          AND n2.kind = NEW.kind
          AND coalesce(n2.link,'') = coalesce(NEW.link,'')
          AND n2.created_at > now() - interval '1 minute'
     );
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_mirror_admin_notification ON notifications;
CREATE TRIGGER trg_mirror_admin_notification
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION mirror_admin_notification();

-- ── submit_public_request: alert staff in-app on every new request ───────────
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('submit_public_request'::regproc);
  v_def := replace(v_def,
$old$  RETURN jsonb_build_object('request_id', v_id, 'status', 'new');$old$,
$new$  -- alert the barn: in-app to every staff/owner (mirrored to co-admins by the
  -- notifications trigger). Email is sent separately by the /api/request-received
  -- endpoint the public form calls after this returns.
  PERFORM notify_staff(
    v_org, 'request_new',
    'New inquiry from ' || coalesce(nullif(btrim(v_first || ' ' || v_last), ''), v_email),
    '/app/ops/intake');

  RETURN jsonb_build_object('request_id', v_id, 'status', 'new');$new$);
  IF v_def NOT LIKE '%request_new%' THEN
    RAISE EXCEPTION 'submit_public_request: return not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;
