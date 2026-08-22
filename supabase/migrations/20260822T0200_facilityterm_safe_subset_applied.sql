-- FACILITYTERM, safe subset — 2026-08-22
-- Applies only what is additive and non-conflicting: the new property_terms
-- table + seed data, and the two brand-new functions (resolve_property_term,
-- my_property_term) that fix the live 404. SKIPS the migration's reissue of
-- org_public_config() and provision_tenant() — both have drifted from this
-- migration's version since 2026-08-11 (confirmed by hash mismatch against
-- a dry-run), and reissuing them here would silently revert whatever changed
-- them since. Those two stay as a separate, deliberate follow-up.

CREATE TABLE IF NOT EXISTS property_terms (
  key         text PRIMARY KEY,
  term        text NOT NULL,
  article     text NOT NULL DEFAULT 'the',
  plural      boolean NOT NULL DEFAULT false,
  preposition text NOT NULL DEFAULT 'at',
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE property_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_terms_read ON property_terms;
CREATE POLICY property_terms_read ON property_terms
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS property_terms_super_write ON property_terms;
CREATE POLICY property_terms_super_write ON property_terms
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO property_terms (key, term, article, plural, preposition, sort_order) VALUES
  ('BARN',     'barn',     'the', false, 'at', 1),
  ('RANCH',    'ranch',    'the', false, 'at', 2),
  ('STABLES',  'stables',  'the', true,  'at', 3),
  ('GROUNDS',  'grounds',  'the', true,  'on', 4),
  ('FACILITY', 'facility', 'the', false, 'at', 5)
ON CONFLICT (key) DO NOTHING;

INSERT INTO config_keys (namespace, key, expected_type, required, description) VALUES
  ('PROPERTY', 'TERM_KEY', 'text', false, 'Selected property_terms.key — the tenant''s own word for their facility (fallback: FACILITY)')
ON CONFLICT (namespace, key) DO NOTHING;

CREATE OR REPLACE FUNCTION resolve_property_term(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_key text;
  v_row property_terms%ROWTYPE;
BEGIN
  SELECT cv.value_text INTO v_key
    FROM config_values cv
    WHERE cv.org_id = p_org AND cv.namespace = 'PROPERTY' AND cv.key = 'TERM_KEY';

  SELECT * INTO v_row FROM property_terms WHERE key = COALESCE(v_key, 'FACILITY') AND active;
  IF NOT FOUND THEN
    SELECT * INTO v_row FROM property_terms WHERE key = 'FACILITY';
  END IF;

  RETURN jsonb_build_object(
    'key',         v_row.key,
    'term',        v_row.term,
    'article',     v_row.article,
    'plural',      v_row.plural,
    'preposition', v_row.preposition
  );
END;
$$;

CREATE OR REPLACE FUNCTION my_property_term()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT resolve_property_term(current_org());
$$;

COMMENT ON FUNCTION my_property_term() IS
  'U16 seam: the CURRENT caller''s own tenant''s property-term shape (term/article/plural/preposition), read past config_values RLS so a plain USER member can resolve it for UI copy. current_org()-scoped; never crosses tenants.';

GRANT EXECUTE ON FUNCTION my_property_term() TO authenticated, service_role;

DO $$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO config_values (org_id, namespace, key, value_text, category) VALUES
    (v_org, 'PROPERTY', 'TERM_KEY', 'RANCH', 'property')
  ON CONFLICT (org_id, namespace, key) DO UPDATE SET value_text = EXCLUDED.value_text;
END $$;
