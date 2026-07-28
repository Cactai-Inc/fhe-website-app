-- Stage 3f (STAGE3F_DOCUMENT_ASSIGNMENT_SPEC, owner-final): DB foundation for
-- document assignment, re-signing, and the signing wall.
--
--   wall_gating          — per-template flag: onboarding-class documents gate
--                          the person's own app session (never staff ops).
--   superseded           — new document status (vocab EXTENDED, not forked):
--                          when a newer version of a template executes for a
--                          person, the prior executed doc is marked superseded
--                          (still retrievable evidence; its validity window
--                          stands). Gates need no change: an executed doc
--                          satisfies them until superseded, at which point the
--                          newer execution satisfies them — assignment alone
--                          changes nothing (version-aware gates per spec).
--   the pending set      — a QUERY, not a table: assigned-and-unsigned =
--                          contact_required_documents rows without a current
--                          executed doc + generated-but-unsigned documents.
--   assignment           — staff_assign_documents appends template keys to the
--                          person's required set; account holders hit the wall
--                          (my_wall_state); contact-only recipients ride the
--                          Stage 2 invitation spine (docs attach to the
--                          contact; activation carries them).
--
-- Also lands here (Stage 3e, per the Stage-1 disposition "else Stage 3"):
-- the two remaining member-facing "no client profile" exception strings.

-- ── A. wall_gating flag (class is data, not a hardcoded list) ───────────────
ALTER TABLE contract_templates ADD COLUMN wall_gating boolean NOT NULL DEFAULT false;
UPDATE contract_templates SET wall_gating = true
 WHERE template_key IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT','RELEASE_HORSE_CARE',
                        'RELEASE_HORSE_EXERCISE','RELEASE_JUMPER_ADDENDUM',
                        'EVALUATION_LIABILITY_WAIVER','COMPANY_POLICIES','FACILITY_RULES',
                        'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET');

-- ── B. superseded status (vocab extension) + supersession on execution ──────
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('document', 'superseded', 'Superseded', true, true, 55)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_document_supersession()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  -- The just-executed document supersedes every prior executed document of
  -- the SAME template family (any version) for the SAME person.
  FOR r IN
    SELECT d.id FROM documents d
    JOIN contract_templates ct_old ON ct_old.id = d.template_id
    JOIN contract_templates ct_new ON ct_new.id = NEW.template_id
   WHERE d.contact_id = NEW.contact_id
     AND d.id <> NEW.id
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
     AND coalesce(d.current_status, '') <> 'superseded'
     AND ct_old.template_key = ct_new.template_key
  LOOP
    UPDATE documents SET current_status = 'superseded' WHERE id = r.id;
    PERFORM log_status_event('document', r.id, 'superseded',
      jsonb_build_object('superseded_by', NEW.id), NEW.org_id);
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER documents_apply_supersession
  AFTER UPDATE ON documents
  FOR EACH ROW
  WHEN (NEW.status = 'EXECUTED' AND OLD.status IS DISTINCT FROM 'EXECUTED')
  EXECUTE FUNCTION apply_document_supersession();

-- ── C. The assignment picker's DOCUMENTS section (staff) ────────────────────
-- Flat sign-only family = active templates NOT driven by the clause engine.
-- On-file status per template for the person; only the CURRENT version of a
-- template family is assignable (enforced in staff_assign_documents too).
CREATE OR REPLACE FUNCTION public.staff_assignable_templates(p_contact_id uuid)
RETURNS TABLE(template_key text, title text, version int, wall_gating boolean,
              on_file_status text, on_file_date date, on_file_version int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ct.template_key, ct.title, ct.version, ct.wall_gating,
         CASE WHEN d.id IS NULL THEN 'none'
              WHEN d.current_status = 'superseded' THEN 'superseded'
              ELSE 'executed' END,
         d.exec_date, d.version
    FROM contract_templates ct
    LEFT JOIN LATERAL (
      SELECT dd.id, dd.current_status, dd.created_at::date AS exec_date, ct2.version
        FROM documents dd JOIN contract_templates ct2 ON ct2.id = dd.template_id
       WHERE dd.contact_id = p_contact_id AND dd.deleted_at IS NULL
         AND dd.status = 'EXECUTED' AND ct2.template_key = ct.template_key
       ORDER BY (dd.current_status IS DISTINCT FROM 'superseded') DESC, dd.created_at DESC
       LIMIT 1
    ) d ON true
   WHERE has_staff_access()
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.body IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM contract_section_defs s WHERE s.template_key = ct.template_key)
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   ORDER BY ct.wall_gating DESC, ct.title;
$function$;
GRANT EXECUTE ON FUNCTION public.staff_assignable_templates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_assign_documents(p_contact_id uuid, p_template_keys text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_n   int := 0;
  k     text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact not found'; END IF;

  FOREACH k IN ARRAY coalesce(p_template_keys, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM staff_assignable_templates(p_contact_id) t WHERE t.template_key = k) THEN
      RAISE EXCEPTION 'template % is not assignable (inactive, clause-engine, or not the current version)', k;
    END IF;
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    VALUES (p_contact_id, k, v_org)
    ON CONFLICT DO NOTHING;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.staff_assign_documents(uuid, text[]) TO authenticated;

-- ── D. The wall (person side): pending set + gating state ───────────────────
-- Pending = required templates with no CURRENT executed doc, plus generated
-- unsigned docs. Wall trips only on wall_gating templates and NEVER for staff
-- (belt-and-suspenders: the FE also banners staff instead of walling).
CREATE OR REPLACE FUNCTION public.my_wall_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_pending int; v_gating int;
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'wall', false, 'staff', false);
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE ct.wall_gating)
    INTO v_pending, v_gating
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = v_contact
     AND NOT EXISTS (
       SELECT 1 FROM documents d
       JOIN contract_templates ct2 ON ct2.id = d.template_id
      WHERE d.contact_id = v_contact AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status,'') <> 'superseded'
        AND ct2.template_key = crd.template_key
        AND ct2.version >= ct.version);

  RETURN jsonb_build_object(
    'pending', v_pending,
    'wall', (v_gating > 0 AND NOT has_staff_access()),
    'staff_banner', (v_gating > 0 AND has_staff_access()),
    'staff', has_staff_access());
END;
$function$;
GRANT EXECUTE ON FUNCTION public.my_wall_state() TO authenticated;

-- ── E. The person's documents list (3a source) ──────────────────────────────
-- One chronological list: unsigned/pending first (assignment order), then
-- executed in signing order. Superseded docs stay retrievable as evidence.
CREATE OR REPLACE FUNCTION public.my_documents()
RETURNS TABLE(document_id uuid, template_key text, title text, kind text,
              signed_at timestamptz, current_status text, superseded boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- pending (generated but unsigned)
  SELECT d.id, ct.template_key, ct.title, 'pending'::text,
         NULL::timestamptz, d.current_status, false, d.created_at
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.contact_id = current_contact_id() AND d.deleted_at IS NULL
     AND d.status <> 'EXECUTED' AND coalesce(d.current_status,'') <> 'void'
  UNION ALL
  -- assigned but not yet generated
  SELECT NULL::uuid, crd.template_key, ct.title, 'assigned'::text,
         NULL::timestamptz, 'assigned', false, now()
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = current_contact_id()
     AND NOT EXISTS (SELECT 1 FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
                      WHERE d.contact_id = crd.contact_id AND d.deleted_at IS NULL
                        AND ct2.template_key = crd.template_key
                        AND (d.status <> 'EXECUTED' OR (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded')))
  UNION ALL
  -- executed, signing order (newest last → FE may reverse per page convention)
  SELECT d.id, ct.template_key, ct.title, 'executed'::text,
         (SELECT max(s.signed_at) FROM signatures s WHERE s.document_id = d.id AND s.deleted_at IS NULL),
         d.current_status, (d.current_status = 'superseded'), d.created_at
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.contact_id = current_contact_id() AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
   ORDER BY 4 DESC, 8;
$function$;
GRANT EXECUTE ON FUNCTION public.my_documents() TO authenticated;

-- ── F. Stage 3e: the two remaining member-facing exception strings ──────────
DO $$
DECLARE f text; v_src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['book_open_slot','request_open_time'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname = f;
    v_src := replace(v_src, '''no client profile''', '''no member profile''');
    IF v_src ILIKE '%no client profile%' THEN
      RAISE EXCEPTION '% wording fix incomplete', f;
    END IF;
    EXECUTE v_src;
  END LOOP;
END $$;
