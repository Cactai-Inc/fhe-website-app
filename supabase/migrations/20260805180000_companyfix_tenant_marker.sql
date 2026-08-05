/*
  TASK COMPANYFIX — deterministic tenant-company contact marker.

  company_contact_id() resolves "the tenant's own company contact" today as
  SELECT id FROM contacts WHERE org_id=v_org AND is_company AND deleted_at IS
  NULL LIMIT 1 — no ordering, no marker. Correct today only because exactly
  one is_company contact exists (French Heritage Equestrian,
  352c3898-65d0-4a90-ad59-29107b7e03fe). The moment a counterparty company
  (LLC buyer/lessor, etc.) gets an is_company contact row, this becomes
  nondeterministic and log_mirror_delivery / my_stable_horses can silently
  bind to the wrong company. This migration makes the tenant's own company an
  explicit fact instead of an inference.

  1. organizations.company_contact_id: nullable marker column. Absence falls
     back to today's LIMIT-1 behavior, so this is additive/safe by construction.
  2. Backfill: stamp it with the org's single current is_company contact.
     Guarded — aborts loudly unless there is exactly one org and exactly one
     candidate contact (same defensive DO-block pattern as C10's
     minor_delivery_guard data fix).
  3. company_contact_id() resolution order becomes:
       (a) organizations.company_contact_id, when set and the contact is live
           (not deleted) — the explicit marker;
       (b) fallback to the existing is_company LIMIT 1 lookup ONLY when (a) is
           null, self-healing by stamping organizations.company_contact_id
           with the found id (so the fallback runs at most once per org);
       (c) the existing create-from-BRAND-config branch, unchanged, likewise
           stamping the new column after creating.
     The BRAND-config name-resolution and insert logic is carried forward
     verbatim from the live body.

  Callers of company_contact_id() (live prosrc grep, confirmed — no others):
    - log_mirror_delivery(...)   — public.log_mirror_delivery
    - my_stable_horses(...)      — public.my_stable_horses
  Both call the function and use its uuid return value only; the function's
  signature and return type are unchanged, so neither needs modification.
  Client-side: src/lib/horses.ts calls supabase.rpc('company_contact_id') —
  also unaffected, same reason.
*/

-- ── 1. Schema: explicit marker column ───────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS company_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- ── 2. Backfill, guarded ─────────────────────────────────────────────────────
DO $backfill$
DECLARE
  v_org_count     int;
  v_contact_count int;
  v_org_id        uuid;
  v_contact_id    uuid;
  v_n             int;
BEGIN
  SELECT count(*) INTO v_org_count FROM organizations WHERE deleted_at IS NULL;
  IF v_org_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 org, found % — aborting backfill', v_org_count;
  END IF;

  SELECT count(*) INTO v_contact_count FROM contacts WHERE is_company AND deleted_at IS NULL;
  IF v_contact_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 is_company contact, found % — aborting backfill', v_contact_count;
  END IF;

  SELECT id INTO v_org_id FROM organizations WHERE deleted_at IS NULL;
  SELECT id INTO v_contact_id FROM contacts WHERE is_company AND deleted_at IS NULL;

  UPDATE organizations SET company_contact_id = v_contact_id WHERE id = v_org_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'expected to stamp exactly 1 org row, stamped % — aborting', v_n;
  END IF;
END $backfill$;

-- ── 3. company_contact_id(): explicit marker first, self-healing fallback ──
CREATE OR REPLACE FUNCTION public.company_contact_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid := current_org();
  v_marker   uuid;
  v_id       uuid;
  v_name     text;
BEGIN
  IF v_org IS NULL THEN RETURN NULL; END IF;

  -- (a) explicit marker, when set and the contact is still live
  SELECT o.company_contact_id INTO v_marker
    FROM organizations o
    JOIN contacts c ON c.id = o.company_contact_id AND c.deleted_at IS NULL
   WHERE o.id = v_org;
  IF v_marker IS NOT NULL THEN RETURN v_marker; END IF;

  -- (b) fallback: existing is_company lookup, then self-heal the marker
  SELECT id INTO v_id FROM contacts
   WHERE org_id = v_org AND is_company AND deleted_at IS NULL LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE organizations SET company_contact_id = v_id WHERE id = v_org;
    RETURN v_id;
  END IF;

  -- (c) create-from-BRAND-config, unchanged, then stamp the marker
  SELECT cv.value_text INTO v_name FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'BRAND' AND cv.key = 'NAME';
  IF v_name IS NULL THEN
    SELECT name INTO v_name FROM organizations WHERE id = v_org;
  END IF;
  v_name := coalesce(v_name, 'The Company');

  INSERT INTO contacts (org_id, first_name, last_name, is_company)
  VALUES (v_org, v_name, NULL, true)
  RETURNING id INTO v_id;

  UPDATE organizations SET company_contact_id = v_id WHERE id = v_org;
  RETURN v_id;
END;
$function$;
