-- FIELD-DEFINITION MODEL for the cascading living-document lease builder.
--
-- Extends contract_fields (keeps the shipped spine — value/redlining/controls
-- unchanged) with the columns the cascade UI needs:
--   parent_field_key  — cascade: this field surfaces UNDER its parent (when the
--                       parent has content / is included). NULL = top-level.
--   input_kind        — richer than value_type: 'text' | 'longtext' | 'select' |
--                       'buttons' | 'responsibility' | 'week_grid' | 'contact' |
--                       'currency' | 'date' | 'percent' | 'prose' | 'checkbox'
--   options           — jsonb array of {value,label} for select/buttons.
--   conditional_on    — jsonb {field_key, equals:[...]}: reveal only when another
--                       field holds one of these values (e.g. reveal a contact
--                       block only when a responsibility dropdown = 'CARE_PROVIDER').
--   guidance          — the ⓘ / hint text shown for the field.
--   is_optional       — an includable (non-essential) field: hidden until included.
--   included          — explicit include state for optional fields/sections.
--   is_na             — explicit "not applicable" (distinct from empty/unanswered).
--   control_override  — jsonb {lock,edit,suggest}: per-field control that overrides
--                       the document-global control (only stored when it differs).
--   responsibility    — jsonb structured party assignment for 'responsibility'
--                       kinds: {duty, party:'OWNER'|'LESSEE'|'CARE_PROVIDER'|'SHARED',
--                       detail, split:{owner,lessee}} — replaces the old free-text.

ALTER TABLE contract_fields
  ADD COLUMN IF NOT EXISTS parent_field_key text,
  ADD COLUMN IF NOT EXISTS input_kind       text,
  ADD COLUMN IF NOT EXISTS options          jsonb,
  ADD COLUMN IF NOT EXISTS conditional_on   jsonb,
  ADD COLUMN IF NOT EXISTS guidance         text,
  ADD COLUMN IF NOT EXISTS is_optional      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS included         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_na            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS control_override jsonb,
  ADD COLUMN IF NOT EXISTS responsibility   jsonb;

-- Backfill input_kind from the existing value_type so current docs still render.
UPDATE contract_fields
   SET input_kind = CASE
     WHEN value_type = 'longtext' THEN 'longtext'
     WHEN value_type = 'currency' THEN 'currency'
     WHEN value_type = 'date'     THEN 'date'
     WHEN value_type = 'select'   THEN 'select'
     WHEN value_type = 'checkbox' THEN 'checkbox'
     WHEN value_type = 'number'   THEN 'text'
     WHEN field_key LIKE '%\_COST' THEN 'responsibility'
     ELSE 'text'
   END
 WHERE input_kind IS NULL;

-- A field-definition TEMPLATE table: the per-template default definition each
-- contract instance is seeded from (so a template is "configurable then used per
-- contract"). Contract_fields remains the per-document instance; this is the source.
CREATE TABLE IF NOT EXISTS contract_field_defs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key   text NOT NULL,
  field_key      text NOT NULL,
  parent_field_key text,
  label          text NOT NULL,
  section        text NOT NULL,
  owner_role     text NOT NULL DEFAULT 'DEAL',
  input_kind     text NOT NULL DEFAULT 'text',
  value_type     text NOT NULL DEFAULT 'text',
  options        jsonb,
  conditional_on jsonb,
  guidance       text,
  required       boolean NOT NULL DEFAULT false,
  is_optional    boolean NOT NULL DEFAULT false,
  responsibility jsonb,
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, field_key)
);

ALTER TABLE contract_field_defs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cfd_read ON contract_field_defs;
CREATE POLICY cfd_read ON contract_field_defs FOR SELECT USING (has_staff_access());
DROP POLICY IF EXISTS cfd_write ON contract_field_defs;
CREATE POLICY cfd_write ON contract_field_defs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
