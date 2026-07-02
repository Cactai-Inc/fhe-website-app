/*
  # FHE Suite — Audit coverage: attach audit_row_change() to every NEW business
  table (U14, migration 14 in the platform-backbone sequence). Module core.payments.

  Per PLATFORM_ARCHITECTURE.md §8.3 + §4.3(e): AUDIT-TRIGGER ATTACHMENT HAS EXACTLY
  ONE OWNER — U14. This migration is the single site that extends the migration-13
  `business_tables` array (audit_logs.sql) to cover every business table added by the
  platform-backbone domain units. It re-declares a fresh DO-loop over the new business
  tables and attaches the generic AFTER INSERT/UPDATE/DELETE trigger `audit_row_change()`
  (defined in migration 13, SECURITY DEFINER, writes past audit_logs RLS).

  Idempotent by construction: every attachment is `DROP TRIGGER IF EXISTS audit_<t>`
  then `CREATE TRIGGER audit_<t>`, and the trigger name convention matches the domain
  units that already attach their own (products_billing, entitlements, value_registry,
  mod_lessons, mod_employees), so re-attaching here is a harmless no-op — never a
  double-fire (a table can carry only one trigger of a given name).

  STRICTLY ADDITIVE. Depends on ALL domain schema units (U2/U3/U5/U7–U12): every table
  named below exists at apply time (this migration's timestamp sorts AFTER all of them).
  The §4.3 CI meta-test (test/db/rls_meta_coverage.test.ts, this unit) then PROVES
  coverage: every business table has exactly one audit_row_change() trigger.

  These are the SAME 22 business tables enumerated in the U14 spec:
    org_modules, config_values,
    products, product_prices, billable_lines,
    engagement_stages,
    lesson_packages, lesson_credits,
    horse_parties, horse_health_events,
    facilities, stalls, board_agreements, board_charges,
    resources, resource_lots, consumption_events, cost_allocation_rules,
    staff_profiles, shifts, time_entries, service_assignments.

  Lookup/enum tables and the global entitlement/template catalog (modules, tiers,
  tier_modules, template_variants, contract_templates, template_tokens) carry no
  business history and are excluded — matching migration 13's exclusion of lookups.
  audit_logs itself is the append-only sink, never audited.
*/

-- Attach the generic audit trigger to every NEW business table (the sole owner site).
-- Extends the migration-13 business_tables array. Idempotent: DROP IF EXISTS + CREATE,
-- with the same audit_<t> naming the domain units use, so re-attach is a no-op.
DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    -- entitlement/registry substrate (boundary + access; audited; NO module_gate)
    'org_modules', 'config_values',
    -- core.payments
    'products', 'product_prices', 'billable_lines',
    -- mod.brokerage
    'engagement_stages',
    -- mod.lessons
    'lesson_packages', 'lesson_credits',
    -- mod.horserecords
    'horse_parties', 'horse_health_events',
    -- mod.boarding
    'facilities', 'stalls', 'board_agreements', 'board_charges',
    -- mod.barnops
    'resources', 'resource_lots', 'consumption_events', 'cost_allocation_rules',
    -- mod.employees
    'staff_profiles', 'shifts', 'time_entries', 'service_assignments'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    -- Guard: only attach when the table actually exists (it always does at this
    -- migration's position, but to_regclass keeps the DO-loop robust if the sequence
    -- is ever sliced with `upTo`). Skips cleanly rather than raising.
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'audit_' || t, t);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION audit_row_change()',
        'audit_' || t, t
      );
    END IF;
  END LOOP;
END;
$$;
