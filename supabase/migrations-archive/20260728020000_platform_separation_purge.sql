-- Platform separation purge (pre-Stage-1, REMEDIATION_PLAN D1 — owner
-- disposition 2026-07-27 after docs/PLATFORM_SEPARATION_AUDIT.md).
--
-- admin@cactai.io is the PLATFORM owner (Cactai Inc, super admin) and must
-- hold no FHE tenant rows. Its FHE-side identity chain (day-one bootstrap
-- testing) is removed here. ORDER MATTERS: the executed document + parties +
-- signatures go FIRST so the affiliation triggers cannot re-derive group rows
-- from them; then groups, member-app state, clients, and the contact; finally
-- the profile keeps its login and only the tenant bridge (contact_id) is
-- severed.
--
-- KEPT AS HISTORY (explicit owner disposition): all audit_logs rows (76 actor
-- rows + 8 contacts-table record rows) and the single moderation_actions row
-- (set_role_admin 2026-07-10) — records of admin acts, not identity state.
-- The DELETEs below add their own audit_logs entries via audit_row_change,
-- which is correct: the purge itself is auditable history.
--
-- Idempotent: skips cleanly when the contact is already gone.

DO $$
DECLARE
  v_user    uuid := '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'; -- auth.users admin@cactai.io
  v_contact uuid := 'c6f7cddc-69da-4948-8e62-4a310f079100'; -- its FHE-org contact ("CJ Z")
  v_doc     uuid := 'f9d7dbb4-5cd5-43d5-af7f-4c1989348852'; -- executed RELEASE_PARTICIPANT anchored to it
BEGIN
  -- Safety latch: only proceed if the target rows are exactly what the audit
  -- described (the platform contact, by id AND email).
  PERFORM 1 FROM contacts WHERE id = v_contact AND email = 'admin@cactai.io';
  IF NOT FOUND THEN
    RAISE NOTICE 'platform separation purge: contact % not found — nothing to do', v_contact;
    RETURN;
  END IF;

  -- 1. The document chain first (prevents any re-derivation from executed docs)
  DELETE FROM signatures       WHERE document_id = v_doc;
  DELETE FROM document_parties WHERE document_id = v_doc;
  DELETE FROM documents        WHERE id = v_doc AND contact_id = v_contact;

  -- 2. Groups (contact_roles: PARTICIPANT 2026-07-03 + derived RIDER 2026-07-26)
  DELETE FROM contact_roles WHERE contact_id = v_contact;

  -- 3. Member-app state on the login (members row + community onboarding cards)
  DELETE FROM members            WHERE user_id = v_user;
  DELETE FROM feed_account_items WHERE user_id = v_user;
  DELETE FROM feed_view_pref     WHERE user_id = v_user;

  -- 4. Client record, then sever the profile bridge BEFORE the contact goes
  DELETE FROM clients WHERE contact_id = v_contact;
  UPDATE profiles SET contact_id = NULL WHERE user_id = v_user; -- login preserved

  -- 5. The FHE contact itself
  DELETE FROM contacts WHERE id = v_contact;

  RAISE NOTICE 'platform separation purge complete for %', v_user;
END $$;
