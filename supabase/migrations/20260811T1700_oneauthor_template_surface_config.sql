/*
  # TASK-ONEAUTHOR — per-document-type behaviour as DATA on contract_templates

  ONE authoring page (`/app/contracts/:id`) serves every document. The body
  renderer is already chosen by the document itself — `contract_template_structure`
  returns zero sections for a flat template, ContractPage.tsx:498 turns that into a
  null structure, and the null branch renders the composed `merged_body` instead of
  the clause authoring surface. Nothing about that changes here.

  What DOES vary per document type is everything AROUND the body: which content
  surfaces exist (comments / change requests / change history), whether the parties
  have negotiating controls at all, whether a co-buyer can be added, and what the
  document is called when it appears as a step in a signing set.

  That variation is CONFIGURATION, and `contract_templates` is already where this
  codebase keeps it — `contract_kind`, `service_type`, `wall_gating` and
  `party_namespaces` are all per-type mechanics carried as columns on this row.
  This migration extends that row rather than adding `if (template_key === …)` to
  the page: the codebase deleted two hardcoded shadow catalogs for exactly that
  reason, and 26 templates behind a conditional is 26 special cases.

  ── the columns ──────────────────────────────────────────────────────────────
    short_label            short name for a signing-set step / picker chip.
                           Replaces the hardcoded stepLabel() map in
                           ContractPage.tsx, which knew 5 of the 26 templates and
                           called every other document "Document".
    show_comments          the Comments drawer.
    show_change_requests   the Requests drawer (and its compose affordance).
    show_history           the Change History drawer.
    show_party_controls    the per-party can_fill / can_edit_deal / can_suggest
                           card inside Parties & Horse.
    allows_co_buyer        the co-buyer capture card (was: template_key IN
                           ('HORSE_SALE_V2','HORSE_BILL_OF_SALE')).
    companion_template_key the document this one can generate alongside itself
                           (was: template_key = 'HORSE_SALE_V2' → bill of sale).

  ── the defaults are DELIBERATELY permissive ─────────────────────────────────
  Every surface column defaults TRUE. An unconfigured row — including any template
  added later — therefore behaves EXACTLY as the page behaves today, so this
  migration cannot silently take a surface away from a document nobody classified.
  Only the rows explicitly UPDATEd below lose anything, and each loses only a
  surface that document can never fill.

  ── which rows are turned down, and why ──────────────────────────────────────
  A standard-form document is issued as-is and signed: a release, a waiver, a
  policy acknowledgment, an authorization. There is no counterparty with standing
  to redline it, so a change-requests drawer and a per-party permissions matrix on
  one are surfaces that can never have contents — the same defect as an "and 1
  more" control that expands to nothing.

  `wall_gating` already marks that class exactly (it is the onboarding-document
  flag), and MINOR_RIDER / MEDIA_RELEASE are the same shape without the flag. The
  negotiated documents — the six clause-composed ones plus the four flat two-party
  commercial agreements (FACILITY_LICENSE, HORSE_SEARCH_RETAINER,
  HORSE_TRANSACTION_REP, INDEPENDENT_CONTRACTOR) — keep every surface.

  Comments and change history stay ON for every template: a staff note and a
  status trail are possible on any document, and hiding a surface that CAN have
  contents is the opposite defect.

  This is a starting classification carried in data, not a rule in code. Any of it
  is one UPDATE to change.

  ── replay ───────────────────────────────────────────────────────────────────
  Additive and idempotent: ADD COLUMN IF NOT EXISTS + value-scoped UPDATEs. Safe to
  replay on a fresh database. No self-contained COMMIT; no temp tables.
  Requires PGCLIENTENCODING=UTF8 — the seeded labels contain an em dash.
*/

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS short_label            text,
  ADD COLUMN IF NOT EXISTS show_comments          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_change_requests   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_history           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_party_controls    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allows_co_buyer        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS companion_template_key text;

COMMENT ON COLUMN contract_templates.short_label IS
  'OPTIONAL shorter name for a signing-set step or picker chip. Not a registry every '
  'template must appear in: readers resolve coalesce(short_label, title), so a template '
  'that is never given one is named by its title, and a title edited later flows through.';
COMMENT ON COLUMN contract_templates.show_change_requests IS
  'Whether the Requests drawer appears. FALSE for standard-form documents nobody negotiates.';
COMMENT ON COLUMN contract_templates.show_party_controls IS
  'Whether the per-party can_fill / can_edit_deal / can_suggest card appears.';
COMMENT ON COLUMN contract_templates.companion_template_key IS
  'A document this one can generate alongside itself (HORSE_SALE_V2 -> HORSE_BILL_OF_SALE).';

/* The self-reference is a real integrity constraint: a companion that names a
   template key with no row would render a button that generates nothing.
   template_key already carries a UNIQUE constraint, so it is a valid FK target.
   Guarded because ADD CONSTRAINT has no IF NOT EXISTS. */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_templates_companion_fkey'
      AND conrelid = 'contract_templates'::regclass
  ) THEN
    ALTER TABLE contract_templates
      ADD CONSTRAINT contract_templates_companion_fkey
      FOREIGN KEY (companion_template_key) REFERENCES contract_templates(template_key);
  END IF;
END $$;

-- ── standard-form documents: nothing to negotiate ───────────────────────────
UPDATE contract_templates
   SET show_change_requests = false,
       show_party_controls  = false
 WHERE (wall_gating OR template_key IN ('MINOR_RIDER', 'MEDIA_RELEASE'))
   AND (show_change_requests OR show_party_controls);

-- ── the sale family takes a co-buyer ────────────────────────────────────────
UPDATE contract_templates
   SET allows_co_buyer = true
 WHERE template_key IN ('HORSE_SALE_V2', 'HORSE_BILL_OF_SALE')
   AND NOT allows_co_buyer;

-- ── a sale agreement can generate its bill of sale ──────────────────────────
UPDATE contract_templates
   SET companion_template_key = 'HORSE_BILL_OF_SALE'
 WHERE template_key = 'HORSE_SALE_V2'
   AND companion_template_key IS DISTINCT FROM 'HORSE_BILL_OF_SALE'
   AND EXISTS (SELECT 1 FROM contract_templates c WHERE c.template_key = 'HORSE_BILL_OF_SALE');

/* ── short labels ────────────────────────────────────────────────────────────
   The five the old stepLabel() map knew, plus every other live template, so a
   signing set never again shows a step called "Document". Only rows that are
   still NULL are written, so a label edited later is never overwritten by a
   replay. */
UPDATE contract_templates t
   SET short_label = v.label
  FROM (VALUES
    ('HORSE_LEASE',                  'Lease agreement'),
    ('HORSE_LEASE_V2',               'Lease agreement'),
    ('HORSE_LEASE_STANDARD',         'Lease — Standard'),
    ('HORSE_LEASE_FULL',             'Lease — Comprehensive'),
    ('HORSE_LEASE_SIMPLE',           'Lease — Simple'),
    ('HORSE_SALE_V2',                'Sale agreement'),
    ('HORSE_BILL_OF_SALE',           'Bill of sale'),
    ('HORSE_EMERGENCY_VET',          'Vet authorization'),
    ('RELEASE_HORSE_CARE',           'Care liability release'),
    ('RELEASE_GENERAL',              'Visitor release'),
    ('RELEASE_PARTICIPANT',          'Participant release'),
    ('RELEASE_JUMPER_ADDENDUM',      'Jumper addendum'),
    ('COMPANY_POLICIES',             'Company policies'),
    ('FACILITY_RULES',               'Facility rules'),
    ('FACILITY_LICENSE',             'Facility use license'),
    ('HUMAN_EMERGENCY_MEDICAL',      'Medical authorization'),
    ('EVALUATION_LIABILITY_WAIVER',  'Evaluation waiver'),
    ('HORSE_SEARCH_RETAINER',        'Search retainer'),
    ('HORSE_TRANSACTION_REP',        'Transaction representation'),
    ('HORSE_REPRESENTATION',         'Representation agreement'),
    ('INDEPENDENT_CONTRACTOR',       'Contractor agreement'),
    ('MINOR_RIDER',                  'Minor rider agreement'),
    ('MEDIA_RELEASE',                'Media release'),
    ('HORSE_PURCHASE_SALE',          'Purchase and sale'),
    ('HORSE_SALE_TRANSFER',          'Sale and transfer'),
    ('RELEASE_HORSE_EXERCISE',       'Exercise release')
  ) AS v(key, label)
 WHERE t.template_key = v.key
   AND t.short_label IS NULL;

/* ── the read seam ───────────────────────────────────────────────────────────
   contract_template_structure() is already the page's per-template fetch: it is
   called on template_key, cached per key on the client, and its empty `sections`
   IS the flat branch. Returning the surface config from the same call means the
   page makes no extra round trip and the config is available on BOTH branches —
   including the flat one, which is precisely where it decides the most.

   `sections` is unchanged, so every existing caller keeps working. */
CREATE OR REPLACE FUNCTION public.contract_template_structure(p_template_key text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'template_key', p_template_key,
    -- TASK-ONEAUTHOR: which surfaces this document type can actually have.
    -- Absent template row -> the permissive default, identical to pre-config
    -- behaviour, so an unknown key never silently loses a drawer.
    'config', coalesce((
      SELECT jsonb_build_object(
        'title',                  t.title,
        'short_label',            coalesce(t.short_label, t.title),
        'contract_kind',          t.contract_kind,
        'show_comments',          t.show_comments,
        'show_change_requests',   t.show_change_requests,
        'show_history',           t.show_history,
        'show_party_controls',    t.show_party_controls,
        'allows_co_buyer',        t.allows_co_buyer,
        'companion_template_key', t.companion_template_key,
        'companion_label', (
          SELECT coalesce(c.short_label, c.title)
            FROM contract_templates c
           WHERE c.template_key = t.companion_template_key
             AND c.active AND c.deleted_at IS NULL)
      )
      FROM contract_templates t
      WHERE t.template_key = p_template_key
    ), jsonb_build_object(
        'title',                  NULL,
        'short_label',            NULL,
        'contract_kind',          NULL,
        'show_comments',          true,
        'show_change_requests',   true,
        'show_history',           true,
        'show_party_controls',    true,
        'allows_co_buyer',        false,
        'companion_template_key', NULL,
        'companion_label',        NULL
    )),
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section_key', s.section_key,
        'heading', s.heading,
        'sort_order', s.sort_order,
        'is_optional', s.is_optional,
        'guidance', s.guidance,
        'clauses', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'clause_key', c.clause_key,
            'heading', c.heading,
            'body', c.body,
            'clause_type', c.clause_type,
            'sort_order', c.sort_order,
            'is_optional', c.is_optional,
            'conditional_on', c.conditional_on,
            'guidance', c.guidance
          ) ORDER BY c.sort_order)
          FROM contract_clause_defs c
          WHERE c.template_key = p_template_key AND c.section_key = s.section_key
        ), '[]'::jsonb)
      ) ORDER BY s.sort_order)
      FROM contract_section_defs s WHERE s.template_key = p_template_key
    ), '[]'::jsonb)
  );
$function$;

/* ── signing-set steps carry their own label ─────────────────────────────────
   The set already returns template_key; the page turned that into a display name
   through a 5-entry hardcoded map. Return the label with the row instead, so a
   sixth document type added later names itself. Additive: template_key stays. */
CREATE OR REPLACE FUNCTION public.contract_signing_set(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ctr uuid;
  v_org uuid;
  v_may boolean;
BEGIN
  SELECT contract_id, org_id INTO v_ctr, v_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_ctr IS NULL THEN RETURN '[]'::jsonb; END IF;

  v_may := (coalesce(has_staff_access() AND v_org = current_org(), false))
    OR caller_is_document_party(p_document_id)
    OR EXISTS (SELECT 1 FROM documents d
                WHERE d.id = p_document_id AND d.horse_id IS NOT NULL
                  AND client_can_read_horse(d.horse_id));
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this document set'; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'document_id', d.id,
        'title', d.title,
        'template_key', t.template_key,
        'short_label', coalesce(t.short_label, t.title),
        'sign_sequence', d.sign_sequence,
        'status', d.status,
        'executed', d.status = 'EXECUTED'
      ) ORDER BY d.sign_sequence NULLS LAST, d.created_at), '[]'::jsonb)
    FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
    WHERE d.contract_id = v_ctr AND d.deleted_at IS NULL AND d.sign_sequence IS NOT NULL
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.contract_template_structure(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_signing_set(uuid) TO authenticated;
