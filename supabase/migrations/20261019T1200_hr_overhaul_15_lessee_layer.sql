-- The lessee layer: a lessee of record keeps their own entries about a horse —
-- notes, providers, histories, conditions, injuries, location notes, any list the
-- record has — isolated from the owner's data. The owner's record is never altered;
-- the lessee's entries are attributed to their account and merged for viewing.
-- Write access follows being the current lessee of record (set by lease execution,
-- cleared by End lease); authorship grants read access forever, independent of the
-- lease, so a former lessee keeps their own layer after the lease ends.

CREATE TABLE IF NOT EXISTS public.horse_lessee_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  horse_id           uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  author_contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- the lease the author was lessee under when they created it (provenance only)
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  -- which record list this entry belongs to; mirrors the owner's list kinds
  kind               text NOT NULL CHECK (kind IN (
                       'note','provider','medical_history','behavioral','known_condition',
                       'injury','training','competition','location_note')),
  -- the entry payload, same shape as the owner's corresponding list entry. For a
  -- provider, data references a contact: {provider_type, party_contact_id, role, ...}.
  data               jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- the owner may hide a lessee entry from their own / other parties' view; never
  -- deletes it, never affects the author's access. Default visible.
  hidden_by_owner    boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
ALTER TABLE public.horse_lessee_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS horse_lessee_entries_horse ON public.horse_lessee_entries (horse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS horse_lessee_entries_author ON public.horse_lessee_entries (author_contact_id) WHERE deleted_at IS NULL;

-- Is the caller the current lessee of record on this horse? (write gate)
CREATE OR REPLACE FUNCTION public.caller_is_current_lessee(h_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM horses h WHERE h.id = h_id AND h.deleted_at IS NULL
      AND h.lessee_contact_id = current_contact_id());
$function$;
REVOKE EXECUTE ON FUNCTION public.caller_is_current_lessee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caller_is_current_lessee(uuid) TO authenticated, service_role;

-- READ: the author always (forever), staff, or the horse's current owner.
CREATE POLICY horse_lessee_entries_read ON public.horse_lessee_entries FOR SELECT
  USING (
    deleted_at IS NULL AND org_id = current_org() AND (
      author_contact_id = current_contact_id()
      OR has_staff_access()
      OR EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_id AND h.current_owner_contact_id = current_contact_id())
    ));
-- WRITE: staff, or the current lessee acting as the author of their own rows.
CREATE POLICY horse_lessee_entries_write ON public.horse_lessee_entries FOR ALL
  USING (
    org_id = current_org() AND (
      has_staff_access()
      OR (author_contact_id = current_contact_id() AND caller_is_current_lessee(horse_id))
    ))
  WITH CHECK (
    org_id = current_org() AND (
      has_staff_access()
      OR (author_contact_id = current_contact_id() AND caller_is_current_lessee(horse_id))
    ));

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- Add an entry to the caller's own layer. Providers go through the contact
-- match/create flow (same as the owner's) so the entry references a contact.
CREATE OR REPLACE FUNCTION public.add_lessee_entry(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_org uuid; v_horse uuid := (p ->> 'horse_id')::uuid; v_me uuid := current_contact_id();
  v_src uuid; v_id uuid; v_data jsonb := coalesce(p -> 'data', '{}'::jsonb);
  v_pcontact uuid; v_email text;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_is_current_lessee(v_horse)) THEN
    RAISE EXCEPTION 'only the current lessee may add to the lessee layer';
  END IF;

  -- the lease the author is currently under (provenance)
  SELECT id INTO v_src FROM horse_relationships
   WHERE horse_id = v_horse AND relationship = 'LESSEE' AND active
     AND party_contact_id = v_me ORDER BY created_at DESC LIMIT 1;

  -- a provider entry references a contact: match by email or create from name+phone
  IF (p ->> 'kind') = 'provider' THEN
    v_email := nullif(btrim(v_data ->> 'email'), '');
    IF v_email IS NOT NULL THEN
      SELECT c.id INTO v_pcontact FROM contacts c JOIN profiles pr ON pr.contact_id = c.id
       WHERE c.org_id = v_org AND c.deleted_at IS NULL AND lower(c.email) = lower(v_email) LIMIT 1;
    END IF;
    IF v_pcontact IS NULL AND nullif(btrim(v_data ->> 'name'), '') IS NOT NULL THEN
      INSERT INTO contacts (org_id, first_name, last_name, phone)
      VALUES (v_org, split_part(btrim(v_data ->> 'name'),' ',1),
              nullif(btrim(substr(btrim(v_data ->> 'name'), length(split_part(btrim(v_data ->> 'name'),' ',1))+1)),''),
              nullif(btrim(v_data ->> 'phone'),''))
      RETURNING id INTO v_pcontact;
    END IF;
    v_data := v_data || jsonb_build_object('party_contact_id', v_pcontact);
  END IF;

  INSERT INTO horse_lessee_entries (org_id, horse_id, author_contact_id, source_document_id, kind, data)
  VALUES (v_org, v_horse, v_me, (SELECT source_document_id FROM horse_relationships WHERE id = v_src), p ->> 'kind', v_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_lessee_entry(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_lessee_entry(jsonb) TO authenticated, service_role;

-- Update the author's own entry data.
CREATE OR REPLACE FUNCTION public.update_lessee_entry(p_id uuid, p_data jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE horse_lessee_entries SET data = p_data, updated_at = now()
   WHERE id = p_id AND org_id = current_org()
     AND (has_staff_access() OR (author_contact_id = current_contact_id() AND caller_is_current_lessee(horse_id)));
  IF NOT FOUND THEN RAISE EXCEPTION 'not your entry to edit, or the lease has ended'; END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_lessee_entry(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_lessee_entry(uuid, jsonb) TO authenticated, service_role;

-- Soft-delete the author's own entry (the author keeps nothing, it is retired).
CREATE OR REPLACE FUNCTION public.delete_lessee_entry(p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE horse_lessee_entries SET deleted_at = now(), updated_at = now()
   WHERE id = p_id AND org_id = current_org()
     AND (has_staff_access() OR (author_contact_id = current_contact_id() AND caller_is_current_lessee(horse_id)));
  IF NOT FOUND THEN RAISE EXCEPTION 'not your entry to remove, or the lease has ended'; END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.delete_lessee_entry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_lessee_entry(uuid) TO authenticated, service_role;

-- Owner (or staff) hides/shows a lessee entry on their own view. Never deletes.
CREATE OR REPLACE FUNCTION public.set_lessee_entry_hidden(p_id uuid, p_hidden boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE horse_lessee_entries e SET hidden_by_owner = p_hidden, updated_at = now()
   WHERE e.id = p_id AND e.org_id = current_org()
     AND (has_staff_access() OR EXISTS (
       SELECT 1 FROM horses h WHERE h.id = e.horse_id AND h.current_owner_contact_id = current_contact_id()));
  IF NOT FOUND THEN RAISE EXCEPTION 'only the horse owner or staff may hide a lessee entry'; END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_lessee_entry_hidden(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_lessee_entry_hidden(uuid, boolean) TO authenticated, service_role;

-- A former (or current) lessee's own layer across every horse they have entries on —
-- independent of lease read access, so it works forever. Returns each horse's
-- identity plus that author's entries only.
CREATE OR REPLACE FUNCTION public.my_leased_horse_entries()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT coalesce(jsonb_agg(h ORDER BY h->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'horse_id', hz.id,
      'name', coalesce(hz.nickname, hz.registered_name, 'Horse'),
      'is_current_lessee', (hz.lessee_contact_id = current_contact_id()),
      'entries', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', e.id, 'kind', e.kind, 'data', e.data, 'created_at', e.created_at) ORDER BY e.created_at DESC), '[]'::jsonb)
        FROM horse_lessee_entries e
        WHERE e.horse_id = hz.id AND e.author_contact_id = current_contact_id() AND e.deleted_at IS NULL)
    ) AS h
    FROM horses hz
    WHERE hz.org_id = current_org() AND hz.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM horse_lessee_entries e
                   WHERE e.horse_id = hz.id AND e.author_contact_id = current_contact_id() AND e.deleted_at IS NULL)
  ) q;
$function$;
REVOKE EXECUTE ON FUNCTION public.my_leased_horse_entries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_leased_horse_entries() TO authenticated, service_role;
