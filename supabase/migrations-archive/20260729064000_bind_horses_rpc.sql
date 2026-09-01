-- THE MEMBER-FACING MULTI-HORSE BINDING RPC + THE DEFERRED-HORSE REMINDER.
--
-- set_my_onboarding_horses(p_horse_ids, p_deferred_horse_ids)
--   The ONE call the onboarding horse step makes once the member has finished
--   adding horses and chosen combined-vs-split. It:
--     • binds the given horses, IN ORDER, to BOTH of this member's open horse
--       documents (HORSE_EMERGENCY_VET + RELEASE_HORSE_CARE) — the "combined"
--       path is simply passing more than one id;
--     • attaches the primary horse to the member's latest purchase, preserving
--       the existing single-horse behaviour that the purchase carries a horse;
--     • raises the SOFT deferred-horse reminder for any horse the member said
--       they have but chose not to finish (see below).
--   Everything is scoped to horses the CALLER owns — a member can never bind
--   somebody else's horse. Staff are not special-cased here; this is the member
--   path (staff use attach_horse_to_document / the ops surfaces).
--
-- THE SPLIT PATH uses the same RPC: the UI calls it once per horse against the
-- separately generated per-horse document pair rather than passing both ids.
--
-- THE DEFERRED REMINDER (owner-final: gentle)
--   A single dashboard notification per deferred horse. NO email — notify_user
--   only writes the notifications row; the email half is a separate, unrelated
--   producer that is not invoked. NO cadence — it is written once and never
--   re-raised while it sits unread. The member dismisses it by marking it read
--   (markNotificationRead), which is the existing dismiss path. Its link is the
--   horse intake form for that exact horse, so the member lands ON the form
--   rather than navigating menu → account → stable → add horse.

CREATE OR REPLACE FUNCTION public.set_my_onboarding_horses(
  p_horse_ids uuid[],
  p_deferred_horse_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contact uuid;
  v_user    uuid := auth.uid();
  v_org     uuid;
  v_doc     record;
  v_i       integer;
  v_hid     uuid;
  v_bound   integer := 0;
  v_docs    integer := 0;
  v_notes   integer := 0;
  v_name    text;
  v_purch   uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := current_contact_id();
  IF v_contact IS NULL THEN RAISE EXCEPTION 'no contact record for this account'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = v_contact;

  -- Ownership fence: every id must be a horse this contact owns or leases.
  IF p_horse_ids IS NOT NULL THEN
    FOR v_i IN 1 .. coalesce(array_length(p_horse_ids, 1), 0) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM horses h
         WHERE h.id = p_horse_ids[v_i] AND h.deleted_at IS NULL
           AND (h.current_owner_contact_id = v_contact OR h.lessee_contact_id = v_contact)
      ) THEN
        RAISE EXCEPTION 'you can only attach your own horse';
      END IF;
    END LOOP;
  END IF;

  -- Bind to every OPEN horse document this member holds. Executed documents are
  -- never touched — a signed release is evidence and its horse set is frozen.
  --
  -- Binding replaces the whole set (the member's choice on this pass is the
  -- truth) and then REGENERATES the document, because the body was composed for
  -- whatever horse it previously named. Regeneration goes through
  -- generate_my_onboarding_documents' own path: we soft-delete the stale copy
  -- and let generate_document recompose with the full set, which is the single
  -- composition path everything else uses.
  FOR v_doc IN
    SELECT d.id, t.template_key
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = v_contact
       AND d.deleted_at IS NULL
       AND t.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
       AND d.status <> 'EXECUTED'
       AND d.workflow_state IN ('editable','editing','in_review')
  LOOP
    v_docs := v_docs + 1;
    DELETE FROM document_horses WHERE document_id = v_doc.id;
    FOR v_i IN 1 .. coalesce(array_length(p_horse_ids, 1), 0) LOOP
      INSERT INTO document_horses (org_id, document_id, horse_id, position)
        VALUES (v_org, v_doc.id, p_horse_ids[v_i], v_i)
        ON CONFLICT (document_id, horse_id) DO UPDATE SET position = EXCLUDED.position;
      v_bound := v_bound + 1;
    END LOOP;
  END LOOP;

  -- Recompose: soft-delete the now-stale bodies and regenerate them bound to the
  -- full set. generate_my_onboarding_documents captures the set we just wrote
  -- (per template key) and replays it into generate_document.
  IF v_docs > 0 AND coalesce(array_length(p_horse_ids, 1), 0) > 0 THEN
    PERFORM generate_my_onboarding_documents();
  END IF;

  -- the purchase keeps carrying the PRIMARY horse (unchanged behaviour)
  IF coalesce(array_length(p_horse_ids, 1), 0) > 0 THEN
    SELECT pu.id INTO v_purch FROM purchases pu
      WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
      ORDER BY pu.created_at DESC LIMIT 1;
    IF v_purch IS NOT NULL THEN
      UPDATE purchases SET horse_id = p_horse_ids[1] WHERE id = v_purch;
    END IF;
  END IF;

  -- THE SOFT DEFERRED REMINDER — one per deferred horse, never duplicated while
  -- an undismissed one is already sitting there.
  FOR v_i IN 1 .. coalesce(array_length(p_deferred_horse_ids, 1), 0) LOOP
    v_hid := p_deferred_horse_ids[v_i];
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM horses h WHERE h.id = v_hid AND h.deleted_at IS NULL
        AND (h.current_owner_contact_id = v_contact OR h.lessee_contact_id = v_contact));
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM notifications n
       WHERE n.user_id = v_user AND n.kind = 'horse_record_task'
         AND n.read_at IS NULL
         AND n.link = '/app/horse-intake?horse=' || v_hid::text);
    SELECT coalesce(nullif(btrim(h.nickname), ''), h.registered_name, 'your horse')
      INTO v_name FROM horses h WHERE h.id = v_hid;
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
      VALUES (v_org, v_user, 'horse_record_task',
        'Finish ' || v_name || '''s record',
        'You set ' || v_name || ' aside for later. Their record still needs a few '
        || 'details before the horse paperwork can cover them. Pick up where you '
        || 'left off whenever you are ready — nothing else is waiting on it.',
        '/app/horse-intake?horse=' || v_hid::text);
    v_notes := v_notes + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'documents', v_docs, 'bindings', v_bound, 'deferred_reminders', v_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_onboarding_horses(uuid[], uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.set_my_onboarding_horses(uuid[], uuid[]) TO authenticated;

COMMENT ON FUNCTION public.set_my_onboarding_horses(uuid[], uuid[]) IS
  'Member path: bind an ordered horse set to BOTH open horse documents (combined '
  'signing), attach the primary to the purchase, and raise the soft dashboard '
  'reminder for horses the member deferred. Own horses only.';
