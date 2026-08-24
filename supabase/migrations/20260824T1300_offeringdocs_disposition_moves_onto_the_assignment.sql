-- TASK-OFFERINGDOCS §10 prerequisite — WHEN a document is due is a property of
-- the ASSIGNMENT, not of the template.
--
-- Owner, 2026-08-24: a tag landing "can prompt me to decide if the docs should be
-- added to their contract, required on first login, or not added at all."
--
-- That decision had nowhere to live. `wall_gating` is a column on
-- contract_templates — ten templates carry it — so a document was gating for
-- everybody or for nobody, and "require THIS person at first login" could not be
-- expressed. It moves onto contact_required_documents, the row that already knows
-- who and why.
--
--   AT_LOGIN       must be signed before they get into the app (the wall)
--   WITH_CONTRACT  signed after the contract executes, with the deal's own set
--   WHEN_READY     surfaced at every login, skippable, never forgotten (§12)
--
-- "Not added at all" is the absence of a row, which is what it always was.
ALTER TABLE contact_required_documents
  ADD COLUMN IF NOT EXISTS disposition text NOT NULL DEFAULT 'AT_LOGIN';

ALTER TABLE contact_required_documents DROP CONSTRAINT IF EXISTS crd_disposition_check;
ALTER TABLE contact_required_documents ADD CONSTRAINT crd_disposition_check
  CHECK (disposition = ANY (ARRAY['AT_LOGIN','WITH_CONTRACT','WHEN_READY']));

-- BEHAVIOUR-PRESERVING BACKFILL: today a row walls iff its TEMPLATE is gating.
-- Every existing row keeps exactly the strength it already had.
UPDATE contact_required_documents crd
   SET disposition = CASE
     WHEN EXISTS (SELECT 1 FROM contract_templates ct
                   WHERE ct.template_key = crd.template_key AND ct.wall_gating)
     THEN 'AT_LOGIN' ELSE 'WHEN_READY' END;

-- ── THE WALL now reads the ASSIGNMENT ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_document_wall_state(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending int; v_gating int; v_titles text[];
  v_waiting int; v_waiting_titles text[];
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'gating', 0, 'titles', '[]'::jsonb,
                              'waiting', 0, 'waiting_titles', '[]'::jsonb);
  END IF;

  SELECT count(*),
         -- ⚠️ WAS `ct.wall_gating` — a property of the TEMPLATE. It is the
         -- ASSIGNMENT's disposition now, so staff can require one person to sign
         -- at login and merely ask another for the same document.
         count(*) FILTER (WHERE crd.disposition = 'AT_LOGIN'),
         array_agg(coalesce(ct.title, ct.template_key)
                   ORDER BY coalesce(ct.title, ct.template_key))
           FILTER (WHERE crd.disposition = 'AT_LOGIN'),
         -- §12: asked for, not demanded. Surfaced every login until signed.
         count(*) FILTER (WHERE crd.disposition = 'WHEN_READY'),
         array_agg(coalesce(ct.title, ct.template_key)
                   ORDER BY coalesce(ct.title, ct.template_key))
           FILTER (WHERE crd.disposition = 'WHEN_READY')
    INTO v_pending, v_gating, v_titles, v_waiting, v_waiting_titles
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key
                          AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = p_contact_id
     AND crd.skipped_at IS NULL
     -- WITH_CONTRACT is not owed yet: it arrives with the deal, on execution.
     AND crd.disposition <> 'WITH_CONTRACT'
     AND NOT contact_document_satisfied(p_contact_id, crd.template_key);

  RETURN jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'gating',  coalesce(v_gating, 0),
    'titles',  to_jsonb(coalesce(v_titles, ARRAY[]::text[])),
    'waiting', coalesce(v_waiting, 0),
    'waiting_titles', to_jsonb(coalesce(v_waiting_titles, ARRAY[]::text[])));
END;
$function$;

-- The onboarding page offers what is owed NOW — never the contract's own set.
CREATE OR REPLACE FUNCTION public.required_templates_for_contact(p_contact_id uuid)
 RETURNS TABLE(template_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT crd.template_key FROM contact_required_documents crd
  WHERE crd.contact_id = p_contact_id
    AND crd.skipped_at IS NULL
    AND crd.disposition <> 'WITH_CONTRACT'
$function$;

-- ── STAFF ASK FOR DOCUMENTS, AND THE PERSON IS TOLD ──────────────────────────
-- Owner: "i can select them from a list by checking them off... and they get an
-- email notification, a dashboard notification, and on their login the docs are
-- shown to them." Assignment used to be silent — set_contact_required_documents
-- writes an audit row and nothing else.
CREATE OR REPLACE FUNCTION public.request_documents_from_contact(
  p_contact_id uuid, p_template_keys text[], p_disposition text DEFAULT 'WHEN_READY')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_user uuid; v_email text; v_titles text[]; v_n int;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_disposition NOT IN ('AT_LOGIN','WITH_CONTRACT','WHEN_READY') THEN
    RAISE EXCEPTION 'unknown disposition %', p_disposition;
  END IF;

  SELECT c.org_id, c.email INTO v_org, v_email
    FROM contacts c WHERE c.id = p_contact_id AND c.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact % not found', p_contact_id; END IF;

  INSERT INTO contact_required_documents (contact_id, template_key, org_id, disposition)
  SELECT p_contact_id, k, v_org, p_disposition
    FROM unnest(coalesce(p_template_keys, ARRAY[]::text[])) k
   WHERE btrim(k) <> ''
  ON CONFLICT (contact_id, template_key) DO UPDATE
    SET disposition = EXCLUDED.disposition, skipped_at = NULL, skipped_by = NULL;

  SELECT array_agg(coalesce(ct.title, k) ORDER BY coalesce(ct.title, k)), count(*)
    INTO v_titles, v_n
    FROM unnest(coalesce(p_template_keys, ARRAY[]::text[])) k
    LEFT JOIN contract_templates ct ON ct.template_key = k AND ct.active
   WHERE btrim(k) <> '';

  -- The dashboard notification. The email is sent by the caller, which holds the
  -- transport — this returns what it needs rather than guessing at delivery.
  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = p_contact_id;
  IF v_user IS NOT NULL AND coalesce(v_n, 0) > 0 THEN
    PERFORM notify_user(v_user, 'documents_requested',
      CASE WHEN v_n = 1 THEN 'A document needs your signature'
           ELSE v_n || ' documents need your signature' END,
      array_to_string(v_titles, ', '), '/app/onboarding');
  END IF;

  RETURN jsonb_build_object('count', coalesce(v_n, 0), 'titles',
    to_jsonb(coalesce(v_titles, ARRAY[]::text[])), 'email', v_email,
    'has_account', v_user IS NOT NULL, 'disposition', p_disposition);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.request_documents_from_contact(uuid, text[], text)
  TO authenticated, service_role;
