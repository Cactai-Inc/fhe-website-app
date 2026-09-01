/*
  # Lease realign · Slice 2 — availability reads the executed lease contract

  generate_lease_availability now reads the scheduling terms off the horse's
  EXECUTED HORSE_LEASE document (contract_fields TXN.DAYS_USED / DAYS_UNAVAILABLE)
  and the lease window off the horse row — instead of the retired horse-keyed
  lease_terms table. The lease_terms table + its RPCs are dropped (the terms now
  live on the contract).

  A. drop the horse-keyed lease_terms model.
  B. generate_lease_availability v2 (reads the executed lease doc).
*/

-- ── A. retire the horse-keyed terms ──────────────────────────────────────────
DROP FUNCTION IF EXISTS save_lease_terms(jsonb);
DROP FUNCTION IF EXISTS lease_terms_for_horse(uuid);
DROP TABLE IF EXISTS lease_terms CASCADE;

-- ── B. availability from the executed lease contract ─────────────────────────
CREATE OR REPLACE FUNCTION generate_lease_availability(p_horse_id uuid, p_weeks int DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_org   uuid := current_org();
  v_h     horses%ROWTYPE;
  v_doc   uuid;
  v_used  text[];
  v_unav  text[];
  d       date;
  v_dow   text;
  v_open time; v_close time; v_closed boolean;
  v_made int := 0;
  v_start timestamptz; v_end timestamptz;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  -- the horse's active executed lease document
  SELECT dc.id INTO v_doc
    FROM documents dc
    JOIN contract_templates t ON t.id = dc.template_id
    WHERE dc.horse_id = p_horse_id AND t.template_key = 'HORSE_LEASE'
      AND dc.status = 'EXECUTED' AND dc.deleted_at IS NULL
    ORDER BY dc.effective_date DESC NULLS LAST, dc.created_at DESC
    LIMIT 1;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'no executed lease contract for this horse'; END IF;

  -- scheduling terms off the contract (comma lists like "Mon,Wed,Fri")
  SELECT string_to_array(regexp_replace(coalesce(value,''), '\s', '', 'g'), ',')
    INTO v_used FROM contract_fields WHERE document_id = v_doc AND field_key = 'TXN.DAYS_USED';
  SELECT string_to_array(regexp_replace(coalesce(value,''), '\s', '', 'g'), ',')
    INTO v_unav FROM contract_fields WHERE document_id = v_doc AND field_key = 'TXN.DAYS_UNAVAILABLE';
  v_used := coalesce(v_used, '{}'); v_unav := coalesce(v_unav, '{}');
  IF array_length(array_remove(v_used,''),1) IS NULL THEN
    RAISE EXCEPTION 'the lease has no "days used" set — fill it on the contract first';
  END IF;

  FOR d IN SELECT generate_series(current_date, current_date + (p_weeks*7), '1 day')::date LOOP
    CONTINUE WHEN v_h.lease_start IS NOT NULL AND d < v_h.lease_start;
    CONTINUE WHEN v_h.lease_end   IS NOT NULL AND d > v_h.lease_end;
    v_dow := to_char(d, 'Dy');
    CONTINUE WHEN NOT (v_dow = ANY (v_used));
    CONTINUE WHEN v_dow = ANY (v_unav);
    SELECT open_time, close_time, closed INTO v_open, v_close, v_closed
      FROM business_hours WHERE org_id = v_org AND weekday = extract(dow FROM d)::int;
    CONTINUE WHEN coalesce(v_closed, false);
    v_open := coalesce(v_open, '10:00'); v_close := coalesce(v_close, '18:00');
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
