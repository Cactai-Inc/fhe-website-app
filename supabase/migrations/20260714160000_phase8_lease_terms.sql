/*
  # Phase 8 — structured lease terms + leased-horse availability on the calendar

  A horse lease gets structured terms (beyond the horses.lease_start/lease_end
  the contract already stamps): payment options, the days the lessee uses vs is
  unavailable, lessons-per-day by riding level with exclusivity rules,
  events/competition authorization, and an optional shared rider. Then those
  terms GENERATE the leased horse's availability onto the calendar as flexible
  blocks the lessee can book.

  A. lease_terms — one active terms row per horse.
  B. save_lease_terms / lease_terms_for_horse.
  C. generate_lease_availability(horse, weeks) — flexible 'available' blocks on
     the lessee's used days (skipping unavailable days) across business hours,
     within the lease window.
*/

-- ── A. the terms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_terms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  horse_id            uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  lessee_contact_id   uuid REFERENCES contacts(id) ON DELETE SET NULL,
  -- [{ amount, describe }]
  payment_options     jsonb NOT NULL DEFAULT '[]'::jsonb,
  days_used           text[] NOT NULL DEFAULT '{}',        -- e.g. {Mon,Wed,Fri}
  days_unavailable    text[] NOT NULL DEFAULT '{}',
  -- { beginner, intermediate, advanced } max lessons/day at each level
  lessons_per_day     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- [ "3 beginner OK; any advanced -> none else that day", ... ] enforced by staff
  exclusivity_rules   jsonb NOT NULL DEFAULT '[]'::jsonb,
  events_authorized   boolean NOT NULL DEFAULT false,
  shared_with_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (horse_id)
);
ALTER TABLE lease_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lease_terms_read ON lease_terms;
CREATE POLICY lease_terms_read ON lease_terms
  FOR SELECT TO authenticated USING (org_id = current_org());
DROP POLICY IF EXISTS lease_terms_write ON lease_terms;
CREATE POLICY lease_terms_write ON lease_terms
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

-- ── B. save / read ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION save_lease_terms(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid := current_org(); v_horse uuid := (p->>'horse_id')::uuid; v_id uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_horse IS NULL THEN RAISE EXCEPTION 'horse_id required'; END IF;

  INSERT INTO lease_terms (org_id, horse_id, lessee_contact_id, payment_options,
      days_used, days_unavailable, lessons_per_day, exclusivity_rules,
      events_authorized, shared_with_contact_id, notes, updated_at)
    VALUES (v_org, v_horse, nullif(p->>'lessee_contact_id','')::uuid,
      coalesce(p->'payment_options','[]'::jsonb),
      coalesce((SELECT array_agg(value::text) FROM jsonb_array_elements_text(coalesce(p->'days_used','[]'::jsonb)) value), '{}'),
      coalesce((SELECT array_agg(value::text) FROM jsonb_array_elements_text(coalesce(p->'days_unavailable','[]'::jsonb)) value), '{}'),
      coalesce(p->'lessons_per_day','{}'::jsonb),
      coalesce(p->'exclusivity_rules','[]'::jsonb),
      coalesce((p->>'events_authorized')::boolean, false),
      nullif(p->>'shared_with_contact_id','')::uuid,
      nullif(p->>'notes',''), now())
  ON CONFLICT (horse_id) DO UPDATE SET
      lessee_contact_id = excluded.lessee_contact_id,
      payment_options = excluded.payment_options,
      days_used = excluded.days_used,
      days_unavailable = excluded.days_unavailable,
      lessons_per_day = excluded.lessons_per_day,
      exclusivity_rules = excluded.exclusivity_rules,
      events_authorized = excluded.events_authorized,
      shared_with_contact_id = excluded.shared_with_contact_id,
      notes = excluded.notes, updated_at = now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'horse_id', v_horse);
END;
$fn$;
REVOKE ALL ON FUNCTION save_lease_terms(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION save_lease_terms(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION lease_terms_for_horse(p_horse_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT to_jsonb(t) FROM lease_terms t
  WHERE t.horse_id = p_horse_id AND t.org_id = current_org()
$fn$;
REVOKE ALL ON FUNCTION lease_terms_for_horse(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION lease_terms_for_horse(uuid) TO authenticated, service_role;

-- ── C. generate leased-horse availability onto the calendar ──────────────────
-- For each of the next p_weeks, on the lessee's used days (skipping unavailable
-- days), create a flexible 'available' block for the horse across that weekday's
-- business hours — but only within the horse's lease window. Idempotent per day
-- (skips a day that already has a generated lease block for this horse).
CREATE OR REPLACE FUNCTION generate_lease_availability(p_horse_id uuid, p_weeks int DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_org uuid := current_org();
  v_t   lease_terms%ROWTYPE;
  v_h   horses%ROWTYPE;
  d     date;
  v_dow text;
  v_open time; v_close time; v_closed boolean;
  v_made int := 0;
  v_start timestamptz; v_end timestamptz;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_t FROM lease_terms WHERE horse_id = p_horse_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'no lease terms for this horse'; END IF;
  SELECT * INTO v_h FROM horses WHERE id = p_horse_id;

  FOR d IN SELECT generate_series(current_date, current_date + (p_weeks*7), '1 day')::date LOOP
    -- inside the lease window (when set)
    CONTINUE WHEN v_h.lease_start IS NOT NULL AND d < v_h.lease_start;
    CONTINUE WHEN v_h.lease_end   IS NOT NULL AND d > v_h.lease_end;
    v_dow := to_char(d, 'Dy');  -- Mon, Tue, ...
    CONTINUE WHEN NOT (v_dow = ANY (v_t.days_used));
    CONTINUE WHEN v_dow = ANY (v_t.days_unavailable);
    -- respect business hours for that weekday
    SELECT open_time, close_time, closed INTO v_open, v_close, v_closed
      FROM business_hours WHERE org_id = v_org AND weekday = extract(dow FROM d)::int;
    CONTINUE WHEN coalesce(v_closed, false);
    v_open := coalesce(v_open, '10:00'); v_close := coalesce(v_close, '18:00');
    -- idempotent: skip if a lease block for this horse already exists that day
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM bookings b WHERE b.horse_id = p_horse_id AND b.kind='block'
        AND b.is_flexible AND b.starts_at::date = d);

    v_start := d + v_open; v_end := d + v_close;
    INSERT INTO bookings (org_id, kind, status, is_flexible, horse_id, starts_at, ends_at, notes, created_by)
      VALUES (v_org, 'block', 'available', true, p_horse_id, v_start, v_end,
              'Leased-horse availability', auth.uid());
    v_made := v_made + 1;
  END LOOP;
  RETURN jsonb_build_object('created', v_made);
END;
$fn$;
REVOKE ALL ON FUNCTION generate_lease_availability(uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION generate_lease_availability(uuid, int) TO authenticated, service_role;
