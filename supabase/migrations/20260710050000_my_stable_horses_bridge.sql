-- MY STABLE ← EXISTING HORSE RECORDS bridge (Update B backend, per
-- HANDOFF-horse-records.md). There is ONE horse records table — `horses` — and the
-- agreements thread (Update A) is authoritative for the full record system. This
-- migration is the minimal member-stable surface over that table:
--   * a member's stable = horses where they are the current owner contact OR hold
--     an ACTIVE horse_parties row (owner/lessee/…, effective window open)
--   * member add = the "manual add" creation path (light version; Update A's
--     create_horse_record with microchip dedup supersedes the internals, the
--     client contract stays)
--   * member update/delete = owner-contact only; delete is SOFT (deleted_at)
-- Direct writes to `horses` remain admin-only via RLS; these RPCs are the member path.

-- ── 1. extend the existing read helper: active party rows also grant read ──
CREATE OR REPLACE FUNCTION public.client_can_read_horse(h_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (
        h.current_owner_contact_id = current_contact_id()
        OR EXISTS (
          SELECT 1 FROM engagements e
          WHERE e.primary_horse_id = h.id
            AND e.deleted_at IS NULL
            AND e.client_id = current_client_id()
        )
        OR EXISTS (
          SELECT 1 FROM horse_parties hp
          WHERE hp.horse_id = h.id
            AND hp.deleted_at IS NULL
            AND hp.contact_id = current_contact_id()
            AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
        )
      )
  );
$$;

-- ── 2. the member's stable: owned or active-party horses (NOT engagement-linked
--       barn horses — those are readable in detail but are not "my stable") ──
CREATE OR REPLACE FUNCTION public.my_stable_horses()
RETURNS TABLE (
  id              uuid,
  registered_name text,
  barn_name       text,
  breed           text,
  sex             text,
  height          text,
  date_of_birth   date,
  color           text,
  current_location text,
  is_owner        boolean,
  created_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.sex, h.height,
         h.date_of_birth, h.color, h.current_location,
         (h.current_owner_contact_id = current_contact_id()) AS is_owner,
         h.created_at
  FROM horses h
  WHERE h.deleted_at IS NULL
    AND h.org_id = current_org()
    AND (
      h.current_owner_contact_id = current_contact_id()
      OR EXISTS (
        SELECT 1 FROM horse_parties hp
        WHERE hp.horse_id = h.id
          AND hp.deleted_at IS NULL
          AND hp.contact_id = current_contact_id()
          AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
      )
    )
  ORDER BY h.created_at
$$;

-- ── 3. manual add (one of the record creation paths; light until Update A) ──
CREATE OR REPLACE FUNCTION public.my_stable_add_horse(
  p_name       text,
  p_barn_name  text DEFAULT NULL,
  p_breed      text DEFAULT NULL,
  p_sex        text DEFAULT NULL,
  p_height     text DEFAULT NULL,
  p_dob        date DEFAULT NULL,
  p_color      text DEFAULT NULL,
  p_location   text DEFAULT NULL,
  p_notes      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org     uuid := current_org();
  v_contact uuid := current_contact_id();
  v_id      uuid;
BEGIN
  IF v_org IS NULL OR v_contact IS NULL THEN
    RAISE EXCEPTION 'no member context';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'horse name required';
  END IF;

  INSERT INTO horses (org_id, registered_name, barn_name, breed, sex, height,
                      date_of_birth, color, current_location, notes,
                      current_owner_contact_id)
  VALUES (v_org, btrim(p_name), p_barn_name, p_breed, p_sex, p_height,
          p_dob, p_color, COALESCE(p_location, 'Carmel Creek Ranch'), p_notes,
          v_contact)
  RETURNING id INTO v_id;

  -- party ledger: the creator is the owner from today
  INSERT INTO horse_parties (org_id, horse_id, contact_id, role, effective_from)
  VALUES (v_org, v_id, v_contact, 'owner', current_date);

  RETURN v_id;
END;
$$;

-- ── 4. member update (owner-contact only; descriptive fields only) ──
CREATE OR REPLACE FUNCTION public.my_stable_update_horse(
  p_id        uuid,
  p_barn_name text DEFAULT NULL,
  p_breed     text DEFAULT NULL,
  p_sex       text DEFAULT NULL,
  p_height    text DEFAULT NULL,
  p_color     text DEFAULT NULL,
  p_location  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE horses
     SET barn_name        = COALESCE(p_barn_name, barn_name),
         breed            = COALESCE(p_breed, breed),
         sex              = COALESCE(p_sex, sex),
         height           = COALESCE(p_height, height),
         color            = COALESCE(p_color, color),
         current_location = COALESCE(p_location, current_location),
         updated_at       = now()
   WHERE id = p_id
     AND org_id = current_org()
     AND deleted_at IS NULL
     AND current_owner_contact_id = current_contact_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'horse not found or not yours to edit';
  END IF;
END;
$$;

-- ── 5. member delete = SOFT delete (owner-contact only) ──
CREATE OR REPLACE FUNCTION public.my_stable_delete_horse(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE horses
     SET deleted_at = now()
   WHERE id = p_id
     AND org_id = current_org()
     AND deleted_at IS NULL
     AND current_owner_contact_id = current_contact_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'horse not found or not yours to remove';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_stable_horses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_stable_add_horse(text, text, text, text, text, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_stable_update_horse(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_stable_delete_horse(uuid) TO authenticated;
