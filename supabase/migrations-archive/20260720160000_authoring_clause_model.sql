/*
  # Authoring engine — Section › Clause › Field (Pass I-a)

  A template-agnostic clause model that sits ABOVE the existing contract_fields
  store. Fields keep flowing through the engine we retain (detail RPC, signing,
  workflow, delivery); they simply gain clause membership, and new definition
  tables own the STRUCTURE, PROSE, NUMBERING and HINTS.

  Two tiers of definitions (per template_key, like contract_field_defs):

    contract_section_defs   — numbered top-level groups (auto-numbered at merge)
    contract_clause_defs    — decimal-numbered clauses within a section; each owns
                              its own tokenized prose, a type, an optional reveal
                              condition, and guidance/hint text

  And the instance link:

    contract_fields.clause_key   — which clause a field belongs to (nullable, so
                                   legacy/flat fields still work)
    documents  gains nothing     — merged_body is still produced onto the document

  clause_type:
    input     — a clause with fields (prose has {{TOKENS}} the fields fill)
    prose     — pure legal boilerplate, no inputs, still numbered
    choice    — a heading clause whose reveal condition gates its sub-fields

  Numbering is NOT stored — it's derived at render/merge from sort_order, so
  dropping an optional clause never leaves a gap.
*/

-- ── section definitions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_section_defs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  text NOT NULL,
  section_key   text NOT NULL,          -- stable id, e.g. 'CARE_OF_HORSE'
  heading       text NOT NULL,          -- 'Care of Horse'
  sort_order    int  NOT NULL,
  is_optional   boolean NOT NULL DEFAULT false,
  cut_name      text,                   -- optional: gates the whole section (reuses CUT logic)
  guidance      text,                   -- section-level hint
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, section_key)
);
CREATE INDEX IF NOT EXISTS contract_section_defs_tmpl_idx ON contract_section_defs (template_key, sort_order);

-- ── clause definitions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_clause_defs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  text NOT NULL,
  section_key   text NOT NULL,          -- FK-by-value into contract_section_defs
  clause_key    text NOT NULL,          -- stable id, e.g. 'CARE.FARRIER'
  heading       text,                   -- 'Farrier Care' (null → unnumbered lead-in prose)
  body          text,                   -- tokenized prose for this clause
  clause_type   text NOT NULL DEFAULT 'input' CHECK (clause_type IN ('input','prose','choice')),
  sort_order    int  NOT NULL,
  is_optional   boolean NOT NULL DEFAULT false,
  cut_name      text,                   -- optional per-clause conditional
  conditional_on jsonb,                 -- {field_key, equals:[...]} reveal gate (choice clauses)
  guidance      text,                   -- clause-level hint (ELS definitions live here)
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, clause_key)
);
CREATE INDEX IF NOT EXISTS contract_clause_defs_tmpl_idx ON contract_clause_defs (template_key, section_key, sort_order);

-- ── field ↔ clause link (instances + defs) ──────────────────────────────────
ALTER TABLE contract_fields     ADD COLUMN IF NOT EXISTS clause_key text;
ALTER TABLE contract_field_defs ADD COLUMN IF NOT EXISTS clause_key text;
-- responsibility_kind drives the party picker's option set: 'financial'
-- (Owner/Lessee/Shared) vs 'care' (Owner/Lessee/FHE/Shared). Null = not a party field.
ALTER TABLE contract_fields     ADD COLUMN IF NOT EXISTS responsibility_kind text;
ALTER TABLE contract_field_defs ADD COLUMN IF NOT EXISTS responsibility_kind text;

CREATE INDEX IF NOT EXISTS contract_fields_clause_idx ON contract_fields (document_id, clause_key);

-- ── RLS: defs are template metadata (readable by any authenticated user of the
--    org); no per-row secrets. Writes via SECURITY DEFINER seeding only. ──
ALTER TABLE contract_section_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_clause_defs  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS section_defs_read ON contract_section_defs;
DROP POLICY IF EXISTS clause_defs_read  ON contract_clause_defs;
CREATE POLICY section_defs_read ON contract_section_defs FOR SELECT TO authenticated USING (true);
CREATE POLICY clause_defs_read  ON contract_clause_defs  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON contract_section_defs FROM anon;
REVOKE ALL ON contract_clause_defs  FROM anon;
GRANT SELECT ON contract_section_defs TO authenticated, service_role;
GRANT SELECT ON contract_clause_defs  TO authenticated, service_role;


-- ── read model: the clause structure for a template (feeds grouped rendering) ─
CREATE OR REPLACE FUNCTION public.contract_template_structure(p_template_key text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  SELECT jsonb_build_object(
    'template_key', p_template_key,
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
$fn$;
REVOKE ALL ON FUNCTION contract_template_structure(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION contract_template_structure(text) TO authenticated, service_role;
