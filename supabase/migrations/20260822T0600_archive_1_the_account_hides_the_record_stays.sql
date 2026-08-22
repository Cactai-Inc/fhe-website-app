-- TASK-ARCHIVE §1 — AN ACCOUNT CAN BE HIDDEN WITHOUT DESTROYING WHAT IT IS
-- EVIDENCE OF.
--
-- D11 (2026-08-11), generalised into D32 (2026-08-22): "the only thing we would
-- want to do is stop seeing the person's account in the main views, but the
-- files will likely be associated with things that other people still see and
-- the files need to remain visible for them."
--
-- D11 was RULED and never BUILT. `contacts.deleted_at`/`.deleted_by` existed,
-- and the one staff control that wrote them (ContactsPage's "Archive" button)
-- was a bare client-side UPDATE: no protected-identity check, no reason, no way
-- back. `purge_account` is the wrong tool entirely and D11/D32 say so
-- explicitly — it is a genuine hard delete (`DELETE FROM signatures WHERE
-- signer_contact_id = …` among ~15 other DELETEs), kept only as the owner's own
-- deliberate test-identity routine. THIS migration adds the OTHER thing next to
-- it; `purge_account` is not read, not called and not modified anywhere here.
--
-- SHAPE: converged on `staff_archive_horse` (20260815T2000), the codebase's
-- existing archive RPC — same guard, same two writes, same "not found or
-- already archived" failure. A second archive mechanism is not built; the two
-- read as one pattern applied to two record types.

-- ── 1. THE REASON (D19: a reversible action states itself and records itself) ─
-- deleted_at/deleted_by already carry WHEN and BY WHOM. WHY had nowhere to go.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_reason text;
COMMENT ON COLUMN public.contacts.deleted_reason IS
  'Why this contact was archived, captured by archive_contact (D19). Cleared by unarchive_contact; the audit_contacts trigger keeps the prior value in audit_logs either way.';

-- ── 2. D1'S DENYLIST, IN ONE NAMED PLACE ────────────────────────────────────
-- The platform owner, the two production FHE staff identities and the company
-- contact are never archivable, on purpose (D1/D1a). purge_account carries this
-- same list inlined; it is deliberately NOT edited here (its whole safety
-- argument is that its allowlist and denylist are literals inside its own body
-- that nothing else can widen). This function is the canonical copy for
-- everything that is not purge_account.
CREATE OR REPLACE FUNCTION public.is_protected_contact(p_contact_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p_contact_id = ANY (ARRAY[
           '75475f66-8950-4f13-832c-5471070737f8',
           '862b7936-9148-465c-b0db-b83246e236a0',
           '352c3898-65d0-4a90-ad59-29107b7e03fe',
           'c6f7cddc-69da-4948-8e62-4a310f079100'
         ]::uuid[])
      OR EXISTS (SELECT 1 FROM contacts c
                  WHERE c.id = p_contact_id AND c.is_company)
      OR EXISTS (SELECT 1 FROM profiles p
                  WHERE p.contact_id = p_contact_id
                    AND p.user_id = ANY (ARRAY[
                          'b45a5503-89bc-489a-b012-c7fbf5c09632',  -- admin@fhequestrian.com
                          'fdbdfe89-76d7-486b-b734-8e23b09e0353',  -- hello@fhequestrian.com
                          '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'   -- admin@cactai.io (platform)
                        ]::uuid[]));
$$;
COMMENT ON FUNCTION public.is_protected_contact(uuid) IS
  'D1/D1a: the platform owner, the two production FHE staff identities and the tenant company contact are never archivable. Shared by archive_contact; purge_account keeps its own inlined copy on purpose.';

-- ── 3. archive_contact — HIDES, DESTROYS NOTHING ────────────────────────────
-- Two column writes on ONE row. It does not touch documents, document_parties,
-- signatures, contract_execution_audit, merged_body, clients, profiles, files
-- or purchases — D16/D32 are absolute and the whole point of the feature is
-- that the record survives the account.
CREATE OR REPLACE FUNCTION public.archive_contact(p_contact_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF is_protected_contact(p_contact_id) THEN
    RAISE EXCEPTION 'protected identity — refusing to archive';
  END IF;

  UPDATE contacts
     SET deleted_at     = now(),
         deleted_by     = auth.uid(),
         deleted_reason = nullif(btrim(coalesce(p_reason, '')), '')
   WHERE id = p_contact_id AND org_id = current_org() AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact not found in this org, or already archived';
  END IF;
END;
$$;
COMMENT ON FUNCTION public.archive_contact(uuid, text) IS
  'D11/D32: stop seeing the account in the main views. Sets deleted_at/deleted_by/deleted_reason on ONE contacts row and nothing else — no document, signature, contract, client, profile or file row is read or written. Reverse it with unarchive_contact. Refuses D1 protected identities.';

-- ── 4. unarchive_contact — the way back (D19: it can be undone) ─────────────
CREATE OR REPLACE FUNCTION public.unarchive_contact(p_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;

  UPDATE contacts
     SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL
   WHERE id = p_contact_id AND org_id = current_org() AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact not found in this org, or not archived';
  END IF;
END;
$$;
COMMENT ON FUNCTION public.unarchive_contact(uuid) IS
  'Reverses archive_contact completely: the contact returns to every listing it left. Archiving is reversible by design (D19) precisely because nothing was destroyed to begin with.';

REVOKE ALL ON FUNCTION public.is_protected_contact(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_contact(uuid, text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unarchive_contact(uuid)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_protected_contact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_contact(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unarchive_contact(uuid)     TO authenticated, service_role;
