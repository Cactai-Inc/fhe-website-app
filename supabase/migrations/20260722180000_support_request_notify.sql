-- Support requests: alert staff on the dashboard when a member submits one.
--
-- Like the website-inquiry path before it, submit_support_request inserted the
-- row and notified no one — so a support message reached the support page but
-- nobody knew to look. Add a notify_staff call so every submission raises an
-- in-app alert to all staff/owners (mirrored to both admins by the notifications
-- trigger), linking to the staff Support page (/app/ops/support).

DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('submit_support_request'::regproc);
  v_def := replace(v_def,
$old$  RETURN v_id;
END;$old$,
$new$  -- alert the barn: in-app to every staff/owner (co-admins get it via the
  -- notifications mirror trigger). No email — support is an in-app channel.
  PERFORM notify_staff(
    v_org, 'support_new',
    'New support request: ' || left(btrim(p_subject), 80),
    '/app/ops/support');

  RETURN v_id;
END;$new$);
  IF v_def NOT LIKE '%support_new%' THEN
    RAISE EXCEPTION 'submit_support_request: return not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;
