/*
  # Phase 5 (cont.) — owner-configurable intake requirements

  The unified public form always requires first name, last name, and email. Any
  OTHER field's required-ness is the owner's call, made from an in-app settings
  page — and it's tied to the CHANNEL the submission came through. In practice
  only the 'booking' channel asks for more; contact/inquiry stay at the base
  three. This stores that per-org, per-channel, per-field toggle so the public
  form (anon) can read it and shape which fields it demands.

  A. intake_requirements — org × channel × field → required.
  B. intake_requirements(channel) reader (anon) + set_intake_requirement writer.
  C. seed the booking defaults for this tenant (owner tunes them in-app).
*/

-- ── A. the config table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_requirements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel    text NOT NULL CHECK (channel IN ('contact','inquiry','booking','kiosk')),
  field_key  text NOT NULL CHECK (field_key IN
    ('phone','contact_method','message','source','availability','experience')),
  required   boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel, field_key)
);

ALTER TABLE intake_requirements ENABLE ROW LEVEL SECURITY;

-- anyone (incl. anon on the public form) may READ the config for their tenant.
DROP POLICY IF EXISTS intake_requirements_read ON intake_requirements;
CREATE POLICY intake_requirements_read ON intake_requirements
  FOR SELECT TO anon, authenticated
  USING (org_id = coalesce(current_org(), current_addressed_org(), sole_org()));

DROP POLICY IF EXISTS intake_requirements_write ON intake_requirements;
CREATE POLICY intake_requirements_write ON intake_requirements
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

-- ── B. reader + writer ───────────────────────────────────────────────────────
-- the required-field map for a channel, e.g. {"phone": true, "message": false}.
CREATE OR REPLACE FUNCTION intake_requirements(p_channel text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT coalesce(jsonb_object_agg(field_key, required), '{}'::jsonb)
  FROM intake_requirements
  WHERE channel = p_channel
    AND org_id = coalesce(current_org(), current_addressed_org(), sole_org())
$fn$;

REVOKE ALL ON FUNCTION intake_requirements(text) FROM public;
GRANT EXECUTE ON FUNCTION intake_requirements(text) TO anon, authenticated, service_role;

-- staff flip one field's required-ness for a channel (upsert).
CREATE OR REPLACE FUNCTION set_intake_requirement(p_channel text, p_field_key text, p_required boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  INSERT INTO intake_requirements (org_id, channel, field_key, required, updated_at)
    VALUES (v_org, p_channel, p_field_key, p_required, now())
  ON CONFLICT (org_id, channel, field_key)
    DO UPDATE SET required = excluded.required, updated_at = now();
END;
$fn$;

REVOKE ALL ON FUNCTION set_intake_requirement(text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_intake_requirement(text, text, boolean) TO authenticated, service_role;

-- ── C. seed booking defaults for this tenant (owner tunes in-app) ─────────────
INSERT INTO intake_requirements (org_id, channel, field_key, required)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid, 'booking', v.field_key, v.required
FROM (VALUES
  ('phone', true),
  ('contact_method', false),
  ('message', false),
  ('source', false),
  ('availability', false),
  ('experience', false)
) AS v(field_key, required)
ON CONFLICT (org_id, channel, field_key) DO NOTHING;
