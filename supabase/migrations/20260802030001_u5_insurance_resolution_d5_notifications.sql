-- ============================================================================
-- U5 / STAGE 4b — D5: INSURANCE UNRESOLVED NOTIFICATION PRODUCER + RESOLVER
-- Spec: docs/archive/insurance-resolution-spec.md D5
--
-- Producer: on the transition INTO the unresolved state, one notification per
-- party, linked to the contract, kind 'insurance_unresolved', body = the spec's
-- tooltip text (F2, verbatim).
-- Resolver: when either certify flips to YES, the contract's
-- insurance_unresolved notifications resolve via the existing resolve-by-link
-- mechanism.
-- Email nudge rides the existing digest — no new sender.
--
-- SPEC CONSTRAINT HONORED: "Never clear or modify the status values at any
-- point in this flow." This function only READS status values.
--
-- NOTE ON ORDERING: this file must apply BEFORE 20260802030000's
-- set_contract_field, which calls insurance_resolution_sync. Both are applied
-- in one psql run below/above per the migration journal; the function is
-- created here and the caller only resolves it at runtime, so either order
-- succeeds at apply time.
--
-- resolve_notifications_for_link takes THREE arguments as of Stage 1
-- (p_link, p_actor, p_kind) — the 2-arg signature was dropped, not overloaded.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.insurance_resolution_sync(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vals        jsonb := '{}'::jsonb;
  r             record;
  v_sec         text;
  v_unresolved  boolean;
  v_any_unres   boolean := false;
  v_link        text;
  v_kind        text := 'insurance_unresolved';
  v_title       text := 'Insurance responsibility unresolved';
  v_body        text;
  u             uuid;
  v_created     int := 0;
  v_status      text;
BEGIN
  -- The tooltip / notification body, verbatim from spec F2.
  v_body := 'Neither party currently has this coverage. The contract cannot be '
         || 'signed until one party accepts financial responsibility for it. '
         || 'Only the accepting party can check their box: the Lessor checks '
         || 'the first, the Lessee checks the second. Checking a box is that '
         || 'party''s election and appears in the contract.';

  SELECT status INTO v_status FROM documents
   WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped','unknown document'); END IF;

  -- Executed instruments are never re-notified or re-evaluated.
  IF v_status = 'EXECUTED' THEN
    RETURN jsonb_build_object('skipped','executed');
  END IF;

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_vals := v_vals || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  FOREACH v_sec IN ARRAY ARRAY['GL','MORT','MED'] LOOP
    v_unresolved :=
         (v_vals ? ('TXN.' || v_sec || '_LESSOR_STATUS'))
     AND (v_vals ? ('TXN.' || v_sec || '_LESSEE_STATUS'))
     AND coalesce(v_vals ->> ('TXN.' || v_sec || '_LESSOR_STATUS'), '') = 'NONE'
     AND coalesce(v_vals ->> ('TXN.' || v_sec || '_LESSEE_STATUS'), '') = 'NONE'
     AND coalesce(v_vals ->> ('TXN.' || v_sec || '_NOT_REQUIRED'), '') <> 'YES'
     AND coalesce(v_vals ->> ('TXN.' || v_sec || '_LESSEE_RESPONSIBLE'), '') <> 'YES';
    IF v_unresolved THEN v_any_unres := true; END IF;
  END LOOP;

  v_link := '/app/contracts/' || p_document_id;

  IF v_any_unres THEN
    -- Producer: one notification per party. Dedupe on (user, kind, link) so a
    -- field edit that leaves the state unresolved does not restack alerts —
    -- this is the "transition INTO the unresolved state" the spec asks for.
    FOR u IN
      SELECT pr.user_id
        FROM document_parties dp
        JOIN profiles pr ON pr.contact_id = dp.contact_id
       WHERE dp.document_id = p_document_id AND pr.user_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
         WHERE n.user_id = u AND n.kind = v_kind AND n.link = v_link
           AND n.read_at IS NULL
      ) THEN
        -- Inserted directly rather than via notify_user(). notify_user carries a
        -- staff/service_role fence, and SECURITY DEFINER preserves auth.uid(), so
        -- routing through it would make a PARTY's own legitimate election fail
        -- with 'not authorized to send notifications' — the producer must never
        -- be able to reject the edit that triggered it. This function is itself
        -- SECURITY DEFINER and stamps the TARGET user's org, exactly as
        -- notify_user does.
        INSERT INTO notifications (org_id, user_id, kind, title, body, link)
        SELECT coalesce(pr.org_id, current_org()), u, v_kind, v_title, v_body, v_link
          FROM profiles pr WHERE pr.user_id = u;
        v_created := v_created + 1;
      END IF;
    END LOOP;
  ELSE
    -- Resolver: every section resolved -> clear this contract's alerts via the
    -- existing resolve-by-link mechanism (3-arg signature, kind-scoped so
    -- unrelated notifications on the same link are untouched).
    PERFORM resolve_notifications_for_link(v_link, NULL, v_kind);
  END IF;

  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'unresolved', v_any_unres,
    'notifications_created', v_created);

EXCEPTION WHEN others THEN
  -- A notification is bookkeeping ABOUT an edit; it must never be able to
  -- reject the edit itself. Any failure here is surfaced in the return value
  -- and logged, never raised into the caller's transaction.
  RAISE WARNING 'insurance_resolution_sync failed for %: %', p_document_id, SQLERRM;
  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'unresolved', v_any_unres,
    'error', SQLERRM);
END;
$function$;

COMMIT;
