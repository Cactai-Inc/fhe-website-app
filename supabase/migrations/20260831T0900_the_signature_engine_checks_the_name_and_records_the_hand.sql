-- TASK-FIX1 §C — record_signature gets the check that already exists next door.
--
-- Source of truth: docs/reports/TASK-AR7-REPORT.md, findings F3 and F4, plan
-- items R4 and R5.
--
-- F3: six signing surfaces, six different name rules, four of them enforcing
-- nothing at all, and the server enforcing nothing beyond "not blank".
-- F4: the fix already existed in this database, in sign_release, twice — the
-- case-insensitive comparison AND the http_request_attribution() capture — and
-- record_signature used neither.
--
-- Replayed against production before writing this: all 71 executed signatures,
-- compared against each signer's contact record AS IT READS TODAY, 67 pass and
-- 4 refuse (all four Evan LaBuzetta's, the incident). Compared against the
-- record AS IT STOOD AT SIGNING TIME (reconstructed from audit_logs), 65 pass
-- and 6 refuse — Sarah Rosengard→Morgan's, which AR7 §5's "really zero" claim
-- did not account for. Neither number is retroactive: nothing here rewrites an
-- existing row. See docs/reports/TASK-FIX1-REPORT.md §C.
--
-- CREATE OR REPLACE, never DROP + CREATE: a DROP resets the function's ACLs
-- (TASK-ORIGIN, 2026-08-27), and this function is granted to authenticated and
-- service_role. The signature is unchanged, so the replace is in place.

CREATE OR REPLACE FUNCTION public.record_signature(p_document_id uuid, p_party_role text, p_typed_name text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_org uuid; v_signer uuid; v_need int; v_have int; v_status text;
  v_body text; v_hash text; v_sig record; v_user uuid; v_title text;
  v_ip text; v_ua text; r record;
  v_ns text;
  v_is_company_signer boolean := false;
  v_expected text;   -- FIX1 §C: the name on the signer's own contact record
BEGIN
  SELECT org_id INTO v_doc_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_doc_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  v_signer := current_contact_id();
  IF v_signer IS NULL THEN RAISE EXCEPTION 'no contact for the signing account'; END IF;

  IF NOT EXISTS (SELECT 1 FROM document_parties
                  WHERE document_id = p_document_id AND contact_id = v_signer
                    AND party_role = p_party_role AND is_signer) THEN
    -- COMPANY-SIDE SIGNING (2026-08-03): the org's company contact is a
    -- faceless entity with no linked account (the identity consolidation
    -- moved every staff profile onto a personal TEAM contact), so when the
    -- signing party IS the company contact, a staff member signs on the
    -- company's behalf: the signature is recorded against the company
    -- contact, the acting human is captured in signer_user_id + typed_name.
    -- Mirrors remove_my_signature's existing staff-on-behalf allowance.
    IF has_staff_access() AND EXISTS (
         SELECT 1 FROM document_parties dp
           JOIN contacts cc ON cc.id = dp.contact_id
          WHERE dp.document_id = p_document_id AND dp.party_role = p_party_role
            AND dp.is_signer AND cc.is_company AND cc.org_id = v_doc_org
            AND cc.deleted_at IS NULL) THEN
      SELECT dp.contact_id INTO v_signer
        FROM document_parties dp JOIN contacts cc ON cc.id = dp.contact_id
       WHERE dp.document_id = p_document_id AND dp.party_role = p_party_role
         AND dp.is_signer AND cc.is_company LIMIT 1;
      v_is_company_signer := true;
    ELSE
      RAISE EXCEPTION 'not a signer on this document in role %', p_party_role;
    END IF;
  END IF;

  IF nullif(btrim(coalesce(p_typed_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a typed name is required to sign';
  END IF;

  -- ── FIX1 §C — THE NAME RULE, SERVER-SIDE (AR7 F3/F4, R4) ─────────────────
  -- Four of the six signing surfaces enforced NOTHING, and three code comments
  -- told every reader for two months that a server check had their back.
  -- sign_release has had the real comparison since the kiosk shipped; this is
  -- that same rule, moved into the function every other surface reaches.
  --
  -- CASE-INSENSITIVE, deliberately, not laxly: four already-executed production
  -- signatures — "Brian olenik" and three "Elisheva fiszer" — are real people
  -- signing their own names with a lowercase letter. A case-sensitive rule
  -- would refuse 4 of 71. Whitespace is collapsed for the same reason: a double
  -- space between forename and surname is a typing artefact, not another
  -- person. NOTHING else is folded — no accent stripping, no punctuation
  -- stripping, no nicknames, no initials. Each of those would let a DIFFERENT
  -- person's name pass, which is the failure this rule exists to prevent.
  --
  -- EXEMPT — the company signer. The branch above reassigned v_signer to the
  -- faceless company contact, and the human deliberately types THEIR OWN name
  -- on the company's behalf. Comparing here would refuse every company
  -- signature this system has ever taken.
  --
  -- EXEMPT — a signer whose contact record holds no name at all. An email-only
  -- contract party derives nothing until their record is populated (D22 §1), so
  -- there is no expected string to compare and refusing would strand them with
  -- no route out. The non-empty check above still applies to them.
  --
  -- ⚠️ This would NOT have caught the 2026-08-28 incident: that record genuinely
  -- said "Aubrey" at signing time, so this check would have PASSED. It is
  -- defence in depth. The fix for that incident is §A and §B, at the front door.
  IF NOT v_is_company_signer THEN
    SELECT nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')
      INTO v_expected
      FROM contacts c WHERE c.id = v_signer;
    IF v_expected IS NOT NULL
       AND lower(regexp_replace(btrim(p_typed_name), '\s+', ' ', 'g'))
        <> lower(regexp_replace(v_expected,          '\s+', ' ', 'g')) THEN
      -- The expected string is named so the surface can show it. It is the
      -- caller's own contact record; nothing is disclosed that is not theirs.
      RAISE EXCEPTION 'typed signature must match the name on your record exactly: %', v_expected;
    END IF;
  END IF;

  -- ── FIX1 §C — ATTRIBUTION IS CAPTURED, NOT MERELY ACCEPTED (AR7 F4, R5) ──
  -- This function has always TAKEN p_ip/p_user_agent and every caller has
  -- always passed NULL, so 21 of 71 production signatures carry neither, and
  -- the 2026-08-28 incident had to be reconstructed out of audit_logs. The old
  -- line here coalesced p_ip onto v_ip — itself still NULL — a no-op shaped
  -- exactly like a fallback. This is the real one, and it is the same line
  -- sign_release line 106 already runs. An explicitly passed value still wins.
  SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;
  v_ip := coalesce(nullif(trim(coalesce(p_ip, '')), ''), v_ip);
  v_ua := coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), v_ua);

  INSERT INTO signatures (org_id, document_id, signer_contact_id, signer_user_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, coalesce((SELECT pr.user_id FROM profiles pr WHERE pr.contact_id = v_signer LIMIT 1), auth.uid()), p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO UPDATE
      SET typed_name = EXCLUDED.typed_name,
          -- the rows pre-seeded at lock time carry NULL signer_user_id; the
          -- sealing update must stamp the signing account or no executed
          -- document ever records WHO signed (found in the 2026-08-03 e2e)
          signer_user_id = EXCLUDED.signer_user_id,
          signed_at  = EXCLUDED.signed_at,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          method     = EXCLUDED.method
      WHERE signatures.signed_at IS NULL;  -- never overwrite an already-sealed signature  -- but a WITHDRAWN one may be given again

  IF coalesce(p_esign_consent, false) THEN
    INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
      VALUES (v_doc_org, v_signer, p_document_id, v_ip, v_ua);
  END IF;

  -- the signer's TOKEN namespace: a second (or later) same-role BUYER contact is
  -- the co-buyer and substitutes SIG.COBUYER.* (the block its clause renders)
  v_ns := p_party_role;
  IF p_party_role = 'BUYER' THEN
    SELECT CASE WHEN t.rn > 1 THEN 'COBUYER' ELSE 'BUYER' END INTO v_ns
      FROM (SELECT dp.contact_id,
                   row_number() OVER (ORDER BY dp.signer_order NULLS LAST, dp.id) AS rn
              FROM document_parties dp
             WHERE dp.document_id = p_document_id AND dp.party_role = 'BUYER') t
     WHERE t.contact_id = v_signer;
    v_ns := coalesce(v_ns, p_party_role);
  END IF;

  UPDATE documents SET merged_body =
      replace(replace(merged_body,
        '{{SIG.' || v_ns || '.NAME}}', p_typed_name),
        '{{SIG.' || v_ns || '.DATE}}', to_char(now(), 'FMMonth FMDD, YYYY'))
    WHERE id = p_document_id AND merged_body IS NOT NULL;

  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM document_parties WHERE document_id = p_document_id;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_need > 0 AND v_have >= v_need THEN
    SELECT merged_body INTO v_body FROM documents WHERE id = p_document_id;
    SELECT signer_contact_id, typed_name, signed_at INTO v_sig
      FROM signatures
      WHERE document_id = p_document_id AND signer_contact_id = v_signer
        AND party_role = p_party_role AND deleted_at IS NULL;
    IF FOUND THEN
      v_hash := compute_execution_hash(v_body, v_sig.signer_contact_id, v_sig.typed_name, v_sig.signed_at);
    END IF;

    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash, workflow_state = 'executed'
      WHERE id = p_document_id AND status <> 'EXECUTED';

    IF FOUND THEN
      -- the contract is signed: its per-party "ready to sign / in review" alerts
      -- (link /app/contracts/<id>) are no longer valid for anyone — clear all.
      PERFORM resolve_notifications_for_link('/app/contracts/' || p_document_id::text, auth.uid());

      SELECT coalesce(d.title, 'Your document') INTO v_title
        FROM documents d WHERE d.id = p_document_id;

      -- ITEM 5c: notify the OTHER parties, never the signer whose own action
      -- completed execution. Telling someone their own click succeeded is
      -- residue, and it arrived in the same breath as the resolve above.
      FOR r IN
        SELECT DISTINCT pr.user_id
          FROM document_parties dp
          JOIN profiles pr ON pr.contact_id = dp.contact_id
         WHERE dp.document_id = p_document_id
           AND dp.contact_id <> v_signer
           AND pr.user_id IS NOT NULL
      LOOP
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_doc_org, r.user_id, 'document_executed', v_title || ' is signed', '/app/documents');
      END LOOP;

      -- TASK A16: the old staff-only broadcast here is folded into the
      -- unified party_signed notification below (same event, one row).
    END IF;
  END IF;

  -- TASK A16: admin notified when a (non-company) party signs, every
  -- signature event. Best-effort — isolated the same way
  -- documents_send_executed_email isolates its mail send, so a notification
  -- failure can never block or roll back a signature that already sealed.
  IF NOT v_is_company_signer THEN
    BEGIN
      SELECT coalesce(d.title, 'A document') INTO v_title FROM documents d WHERE d.id = p_document_id;
      IF v_need > 0 AND v_have >= v_need THEN
        PERFORM notify_staff(v_doc_org, 'party_signed',
          v_title || ' — fully executed; signed by ' || p_typed_name || ' (' || p_party_role || ')',
          '/app/ops/documents/' || p_document_id::text);
      ELSE
        PERFORM notify_staff(v_doc_org, 'party_signed',
          v_title || ' — signed by ' || p_typed_name || ' (' || p_party_role || ')',
          '/app/ops/documents/' || p_document_id::text);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'record_signature: party_signed notify_staff failed for document %: %', p_document_id, SQLERRM;
    END;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$function$

;
