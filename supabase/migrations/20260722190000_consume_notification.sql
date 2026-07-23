-- Notification lifecycle: two classes of dashboard alert (owner model 2026-07-22).
--
-- (A) NON-RESOLVABLE — the app can't tell if it's handled (a new inquiry that
--     might be dealt with by phone). PER-USER: persists until THAT user closes or
--     visits it. consume_notification() deletes the caller's own row and logs it.
--
-- (B) RESOLVABLE — the underlying thing can be known done (e.g. "sign this
--     contract"). When ANYONE resolves it (one owner signs), the notification is
--     invalid for EVERYONE and is deleted for all recipients, seen or not.
--     resolve_notifications_for_link() clears every recipient's copy for a target.
--
-- A permanent record survives in audit_logs (action 'DELETE', which the CHECK
-- constraint allows; the semantic is carried in new_value.event).

-- ── (A) per-user consume ─────────────────────────────────────────────────────
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

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'DELETE', 'notifications', v_n.id,
    to_jsonb(v_n), jsonb_build_object('event', 'notification_consumed', 'by', 'recipient'));

  DELETE FROM notifications WHERE id = v_n.id;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consume_notification(uuid) TO authenticated;

-- ── (B) resolve-for-all: clear every recipient's copy for a target ───────────
-- p_actor is who resolved it (logged); deletion applies to all recipients. Called
-- from server-side flows (SECURITY DEFINER), so it does not gate on auth.uid().
CREATE OR REPLACE FUNCTION public.resolve_notifications_for_link(
  p_link text, p_actor uuid DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ct integer := 0; v_n notifications%ROWTYPE;
BEGIN
  IF p_link IS NULL OR btrim(p_link) = '' THEN RETURN 0; END IF;
  FOR v_n IN SELECT * FROM notifications WHERE link = p_link LOOP
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
    VALUES (coalesce(p_actor, auth.uid()), 'DELETE', 'notifications', v_n.id,
      to_jsonb(v_n), jsonb_build_object('event', 'notification_resolved', 'by', 'target_resolved'));
    v_ct := v_ct + 1;
  END LOOP;
  DELETE FROM notifications WHERE link = p_link;
  RETURN v_ct;
END;
$function$;

-- ── hook (B) into signing: when a contract executes, the "ready to sign" /
--    "in review" alerts pointing at it (for BOTH owners) are now invalid — clear
--    them for everyone. Inserted inside record_signature's execute-once block. ──
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('record_signature'::regproc);
  v_def := replace(v_def,
$old$    IF FOUND THEN
      SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_signer;$old$,
$new$    IF FOUND THEN
      -- the contract is signed: its per-party "ready to sign / in review" alerts
      -- (link /app/contracts/<id>) are no longer valid for anyone — clear all.
      PERFORM resolve_notifications_for_link('/app/contracts/' || p_document_id::text, auth.uid());
      SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_signer;$new$);
  IF v_def NOT LIKE '%resolve_notifications_for_link%' THEN
    RAISE EXCEPTION 'record_signature: execute block not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;
