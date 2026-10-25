-- disc_37: the care-team writer (HorseHealthPage "Edit care team") updated horses.vet_*
-- / farrier_* directly; those columns were removed in the overhaul (data moved to
-- horse_relationships), so the write errored. This upserts the primary VET and FARRIER
-- provider rows in horse_relationships — the one source — keyed on horse_id, mirroring
-- the upsert capture_horse_record_info already performs from the contract side.

CREATE OR REPLACE FUNCTION public.update_horse_care_team(p_horse_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_owner uuid;
BEGIN
  SELECT org_id, current_owner_contact_id INTO v_org, v_owner
    FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR v_owner = current_contact_id()) THEN
    RAISE EXCEPTION 'only the horse owner or staff may edit the care team';
  END IF;

  IF p ?| ARRAY['vet_name','vet_phone'] THEN
    IF EXISTS (SELECT 1 FROM horse_relationships WHERE horse_id = p_horse_id AND relationship='VET' AND active) THEN
      UPDATE horse_relationships r SET
        party_name_text = CASE WHEN p ? 'vet_name'  THEN nullif(btrim(p->>'vet_name'),'')  ELSE party_name_text END,
        phone           = CASE WHEN p ? 'vet_phone' THEN nullif(btrim(p->>'vet_phone'),'') ELSE phone END
      WHERE r.id = (SELECT id FROM horse_relationships WHERE horse_id = p_horse_id AND relationship='VET' AND active
                    ORDER BY (provider_role='primary') DESC, created_at DESC LIMIT 1);
    ELSE
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role,
        party_name_text, phone, active, created_by_contact_id)
      VALUES (v_org, p_horse_id, 'VET', 'primary',
        nullif(btrim(p->>'vet_name'),''), nullif(btrim(p->>'vet_phone'),''), true, current_contact_id());
    END IF;
  END IF;

  IF p ?| ARRAY['farrier_name','farrier_phone'] THEN
    IF EXISTS (SELECT 1 FROM horse_relationships WHERE horse_id = p_horse_id AND relationship='FARRIER' AND active) THEN
      UPDATE horse_relationships r SET
        party_name_text = CASE WHEN p ? 'farrier_name'  THEN nullif(btrim(p->>'farrier_name'),'')  ELSE party_name_text END,
        phone           = CASE WHEN p ? 'farrier_phone' THEN nullif(btrim(p->>'farrier_phone'),'') ELSE phone END
      WHERE r.id = (SELECT id FROM horse_relationships WHERE horse_id = p_horse_id AND relationship='FARRIER' AND active
                    ORDER BY (provider_role='primary') DESC, created_at DESC LIMIT 1);
    ELSE
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role,
        party_name_text, phone, active, created_by_contact_id)
      VALUES (v_org, p_horse_id, 'FARRIER', 'primary',
        nullif(btrim(p->>'farrier_name'),''), nullif(btrim(p->>'farrier_phone'),''), true, current_contact_id());
    END IF;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_horse_care_team(uuid, jsonb) TO authenticated;
