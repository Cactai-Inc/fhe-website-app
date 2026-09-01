-- Stage 1i (REMEDIATION_PLAN): horse_parties → horse_relationships, per the
-- owner-accepted 1c evidence and disposition (2026-07-27).
--
-- Survivor: horse_relationships (all live write paths already target it:
-- create_horse_record, the contract-execution trigger, staff_assign_horse_party,
-- hard_delete_contract). horse_parties had 0 rows ever, no DB-function writer,
-- and only an unused admin-ledger UI writing it client-side.
--
-- Ports (each from the disposition):
--   1. share_pct (+ notes) become nullable columns on horse_relationships.
--   2. resolve_consumption_billing precedence-2 re-points to it (active rows,
--      term window replaces the effective_from/to window).
--   3. my_stable_horses fallback + attach_booking_horse gate collapse to
--      single-table. attach_booking_horse also takes the F2 wording fix
--      ("no client profile" → "no member profile") since 1i touches it.
--   4. The ledger UI's write path becomes the staff_assign_horse_party RPC
--      (extended with share/notes + the ledger roles) + a sibling end RPC;
--      reads go through the survivor's RLS. (FE in the same commit.)
--   5. Audit trigger recreated on the survivor; DELETE revoked (ledger rows
--      end, they are never hard-deleted — matching the old ledger discipline).
--   6. CLIENT.HORSE_CAPACITY token rows: the unread global dictionary row
--      (source_table='horse_parties') is deleted; the two per-template rows
--      that generate_document ACTUALLY reads get the corrected source
--      (horses columns + document_parties — the function's real logic).
--      NOTE: the disposition said "one row"; the evidence shows the two
--      per-template rows are live merge drivers (generate_document filters
--      template_id = template's id), so both must survive. Flagged in the
--      stage report.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE horse_relationships
  ADD COLUMN share_pct numeric CHECK (share_pct > 0 AND share_pct <= 100),
  ADD COLUMN notes text;

-- The ledger's wider role set joins the model (existing rows stay OWNER/LESSEE).
ALTER TABLE horse_relationships DROP CONSTRAINT horse_relationships_relationship_check;
ALTER TABLE horse_relationships ADD CONSTRAINT horse_relationships_relationship_check
  CHECK (relationship IN ('OWNER','LESSEE','TRAINER','CARETAKER','BOARDER'));

-- ── 2. Billing precedence-2 re-point ────────────────────────────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='resolve_consumption_billing';
  v_src := replace(v_src,
$old$        SELECT hp.contact_id AS payer_contact_id, hp.share_pct
        FROM horse_parties hp
        WHERE hp.org_id = v_org
          AND hp.horse_id = v_ev.horse_id
          AND hp.deleted_at IS NULL
          AND hp.share_pct IS NOT NULL
          AND hp.share_pct > 0
          AND (hp.effective_from IS NULL OR hp.effective_from <= v_ev.occurred_at::date)
          AND (hp.effective_to   IS NULL OR hp.effective_to   >= v_ev.occurred_at::date)$old$,
$new$        SELECT hr.party_contact_id AS payer_contact_id, hr.share_pct
        FROM horse_relationships hr
        WHERE hr.org_id = v_org
          AND hr.horse_id = v_ev.horse_id
          AND hr.active
          AND hr.share_pct IS NOT NULL
          AND hr.share_pct > 0
          AND (hr.term_start IS NULL OR hr.term_start <= v_ev.occurred_at::date)
          AND (hr.term_end   IS NULL OR hr.term_end   >= v_ev.occurred_at::date)$new$);
  v_src := replace(v_src, 'Precedence 2: derived from horse_parties', 'Precedence 2: derived from horse_relationships');
  IF v_src ILIKE '%horse_parties%' THEN RAISE EXCEPTION 'resolve_consumption_billing rewrite incomplete'; END IF;
  EXECUTE v_src;
END $$;

-- ── 3a. my_stable_horses: single-table membership predicate ─────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='my_stable_horses';
  v_src := replace(v_src,
$old$      OR EXISTS (
        SELECT 1 FROM horse_parties hp
        WHERE hp.horse_id = h.id AND hp.deleted_at IS NULL
          AND hp.contact_id = v_scope
          AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
      )$old$,
$new$      OR EXISTS (
        SELECT 1 FROM horse_relationships hr
        WHERE hr.horse_id = h.id AND hr.active
          AND hr.party_contact_id = v_scope
          AND (hr.term_end IS NULL OR hr.term_end >= current_date)
      )$new$);
  IF v_src ILIKE '%horse_parties%' THEN RAISE EXCEPTION 'my_stable_horses rewrite incomplete'; END IF;
  EXECUTE v_src;
END $$;

-- ── 3b. attach_booking_horse: single-table gate + F2 wording ────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='attach_booking_horse';
  v_src := replace(v_src,
$old$        OR EXISTS (SELECT 1 FROM horse_parties hp WHERE hp.horse_id = h.id AND hp.contact_id = v_contact
                     AND hp.deleted_at IS NULL AND (hp.effective_to IS NULL OR hp.effective_to >= current_date))
        OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = h.id AND hr.party_contact_id = v_contact
                     AND hr.active)$old$,
$new$        OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = h.id AND hr.party_contact_id = v_contact
                     AND hr.active AND (hr.term_end IS NULL OR hr.term_end >= current_date))$new$);
  v_src := replace(v_src, '''no client profile''', '''no member profile''');
  IF v_src ILIKE '%horse_parties%' THEN RAISE EXCEPTION 'attach_booking_horse rewrite incomplete'; END IF;
  EXECUTE v_src;
END $$;

-- ── 4. The ledger write path: staff_assign_horse_party grows share/notes and
--       the ledger roles; a sibling RPC ends a relationship (never deletes) ──
CREATE OR REPLACE FUNCTION public.staff_assign_horse_party(
  p_horse_id uuid, p_role text, p_contact_id uuid,
  p_term_start date DEFAULT NULL, p_term_end date DEFAULT NULL,
  p_sublease_allowed boolean DEFAULT false,
  p_share_pct numeric DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_role NOT IN ('OWNER','LESSEE','TRAINER','CARETAKER','BOARDER') THEN
    RAISE EXCEPTION 'role must be OWNER, LESSEE, TRAINER, CARETAKER, or BOARDER';
  END IF;

  -- OWNER/LESSEE keep their exclusive semantics + horses-column side effects
  -- (live behavior, unchanged). The ledger roles are plain additive rows.
  IF p_role = 'OWNER' THEN
    UPDATE horse_relationships SET active = false, ended_at = now()
     WHERE horse_id = p_horse_id AND relationship = 'OWNER' AND active
       AND (p_contact_id IS NULL OR party_contact_id IS DISTINCT FROM p_contact_id);
    UPDATE horses SET current_owner_contact_id = p_contact_id, updated_at = now()
     WHERE id = p_horse_id AND org_id = v_org;
  ELSIF p_role = 'LESSEE' THEN
    UPDATE horse_relationships SET active = false, ended_at = now()
     WHERE horse_id = p_horse_id AND relationship = 'LESSEE' AND active
       AND (p_contact_id IS NULL OR party_contact_id IS DISTINCT FROM p_contact_id);
    UPDATE horses
       SET lessee_contact_id = p_contact_id,
           lease_start = CASE WHEN p_contact_id IS NULL THEN NULL ELSE coalesce(p_term_start, lease_start) END,
           lease_end   = CASE WHEN p_contact_id IS NULL THEN NULL ELSE coalesce(p_term_end, lease_end) END,
           sublease_allowed = CASE WHEN p_contact_id IS NULL THEN false ELSE p_sublease_allowed END,
           updated_at = now()
     WHERE id = p_horse_id AND org_id = v_org;
  END IF;

  IF p_contact_id IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_contact_id, term_start, term_end,
       share_pct, notes, created_by_contact_id)
    VALUES (v_org, p_horse_id, p_role, p_contact_id, p_term_start, p_term_end,
            p_share_pct, p_notes, current_contact_id());
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_end_horse_relationship(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  UPDATE horse_relationships SET active = false, ended_at = now()
   WHERE id = p_id AND org_id = current_org() AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'relationship not found or already ended';
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.staff_end_horse_relationship(uuid) TO authenticated;

-- ── 5. Ledger discipline on the survivor: audit + no hard deletes ───────────
CREATE TRIGGER audit_horse_relationships
  AFTER INSERT OR UPDATE OR DELETE ON horse_relationships
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
REVOKE DELETE ON horse_relationships FROM anon, authenticated;

-- ── 6. Retire the loser ─────────────────────────────────────────────────────
DROP TABLE horse_parties;

-- ── 7. CLIENT.HORSE_CAPACITY token source correction ────────────────────────
DELETE FROM template_tokens
 WHERE field = 'HORSE_CAPACITY' AND template_id IS NULL;  -- the unread dictionary row
UPDATE template_tokens
   SET source_table  = 'horses',
       source_column = 'current_owner_contact_id / lessee_contact_id vs signer (document_parties)',
       computed      = true,
       notes         = 'Capacity as to the horse (owns / leases / authorized agent), resolved at signing inside generate_document from horses.current_owner_contact_id and horses.lessee_contact_id matched against the signer via document_parties. (Corrected 2026-07-27: the old note claimed horse_parties.role, which generate_document never read.)'
 WHERE field = 'HORSE_CAPACITY';

-- provision_tenant references the old table in a comment only — update it so
-- the zero-references assertion below is absolute.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='provision_tenant';
  v_src := replace(v_src, 'the split derives from horse_parties', 'the split derives from horse_relationships');
  EXECUTE v_src;
END $$;

-- ── 8. Assertions ───────────────────────────────────────────────────────────
DO $$
DECLARE v_bad text; v_n int;
BEGIN
  SELECT string_agg(proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND prosrc ILIKE '%horse_parties%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'horse_parties references remain in: %', v_bad;
  END IF;
  SELECT count(*) INTO v_n FROM template_tokens WHERE field='HORSE_CAPACITY';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'expected exactly 2 HORSE_CAPACITY rows (the live per-template drivers), found %', v_n;
  END IF;
END $$;
