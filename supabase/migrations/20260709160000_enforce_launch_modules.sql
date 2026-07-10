-- SLICE 6 — enforce the launch module set for FHE (org e656f20b…). The feature
-- modules that ship at launch are lessons + brokerage + records; boarding, barn ops,
-- and employees are explicitly OFF (recorded as enabled=false so the posture is a
-- deliberate, auditable decision, not incidental absence). Core modules (core.*) are
-- always on and untouched. Intake/availability/contacts/horses/transactions/payments
-- are core surfaces (not module-gated) and need no row.
--
-- Idempotent: upserts each launch module to its target enabled state for the org.
DO $$
DECLARE
  v_org uuid := 'e656f20b-ef43-4725-9029-19e7f0190d9c';
  v_on  text[]  := ARRAY['mod.lessons', 'mod.brokerage', 'mod.horserecords'];
  v_off text[]  := ARRAY['mod.boarding', 'mod.barnops', 'mod.employees'];
  v_key text;
BEGIN
  -- launch-ON modules: ensure a row exists and is enabled
  FOREACH v_key IN ARRAY v_on LOOP
    INSERT INTO org_modules (org_id, module_key, enabled, source)
    VALUES (v_org, v_key, true, 'GRANT')
    ON CONFLICT (org_id, module_key) DO UPDATE
      SET enabled = true, expires_at = NULL, updated_at = now();
  END LOOP;

  -- launch-OFF modules: record an explicit disabled row (intentional off)
  FOREACH v_key IN ARRAY v_off LOOP
    INSERT INTO org_modules (org_id, module_key, enabled, source)
    VALUES (v_org, v_key, false, 'GRANT')
    ON CONFLICT (org_id, module_key) DO UPDATE
      SET enabled = false, updated_at = now();
  END LOOP;
END $$;
