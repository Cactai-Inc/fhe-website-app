-- MY STABLE — business-aware (act as company, D7).
--
-- Owner, 2026-08-15: "i need a page for my stable... my horse and my tack and
-- my supplies should all live in there for my business." /app/stable already
-- exists (TASK-ACCOUNTSURFACE) and, for horses, is HALF business-aware
-- already — a real, verified gap, not a guess:
--
--   my_stable_horses() READS: has_staff_access() -> v_scope = company_contact_id()
--     (staff already see the COMPANY's horses, not their own, by hardcoded
--     default — no toggle).
--   my_stable_add_horse() WRITES via create_horse_record(), which defaults
--     v_me := current_contact_id() (the caller's PERSONAL contact) and only
--     overrides it when an explicit owner_contact_id is passed — which
--     lib/stable.ts's addStableHorse() never does. So a horse a staff member
--     adds via My Stable is owned by THEM PERSONALLY, and then never appears
--     in their own My Stable list again (the read side is company-scoped).
--   my_stable_update_horse() / my_stable_delete_horse() hardcode
--     `current_owner_contact_id = current_contact_id()` — neither can ever
--     touch a company-owned horse, even for staff. A company horse, once it
--     existed, would be unreachable from this page for edit/delete.
--
-- FIX: an explicit p_as_company toggle, default-preserving current read
-- behavior (staff default to company, exactly D7's established convention
-- for community posts — "staff default to company voice, posting personally
-- is the opt-out"), threaded through add/update/delete so all four functions
-- agree on the same scope a caller can reach.
--
-- stable_items (gear/supplies) has NO company concept at all today —
-- `user_id` is NOT NULL, FK to auth.users, and the company has no login of
-- its own (DUAL_IDENTITY_TRACE.md: "no login of its own"). Structurally
-- cannot represent company ownership without a schema change. Adds
-- `owner_kind` exactly mirroring the already-owner-approved D15 file spine
-- (`files.owner_kind`: 'contact' | 'org') — the established, convergent
-- pattern for "whose is this," not a new one invented here.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Horses — read side gains an explicit toggle, default unchanged.
--    DROP first: CREATE OR REPLACE cannot widen an argument list (the old
--    0-arg form would otherwise survive alongside this one and every bare
--    my_stable_horses() call becomes ambiguous between the two).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.my_stable_horses();

CREATE OR REPLACE FUNCTION public.my_stable_horses(p_as_company boolean DEFAULT NULL::boolean)
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, sex text, height text, date_of_birth date, color text, current_location text, is_owner boolean, created_at timestamp with time zone, lease_start date, lease_end date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid;
  v_as_company boolean := coalesce(p_as_company, has_staff_access());
BEGIN
  IF v_as_company AND NOT has_staff_access() THEN
    RAISE EXCEPTION 'only staff may view the company''s stable';
  END IF;
  v_scope := CASE WHEN v_as_company THEN company_contact_id()
                  ELSE current_contact_id() END;
  RETURN QUERY
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.sex, h.height,
         h.date_of_birth, h.color, h.current_location,
         (h.current_owner_contact_id = v_scope) AS is_owner,
         h.created_at, h.lease_start, h.lease_end
  FROM horses h
  WHERE h.deleted_at IS NULL
    AND h.org_id = current_org()
    AND (
      h.current_owner_contact_id = v_scope
      OR h.lessee_contact_id     = v_scope
      OR EXISTS (
        SELECT 1 FROM horse_relationships hr
        WHERE hr.horse_id = h.id AND hr.active
          AND hr.party_contact_id = v_scope
          AND (hr.term_end IS NULL OR hr.term_end >= current_date)
      )
    )
  ORDER BY h.created_at;
END;
$function$;

-- same grant profile the dropped 0-arg version had (verified live before drop).
GRANT EXECUTE ON FUNCTION public.my_stable_horses(boolean) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Horses — write side: add gains the same toggle, threaded to
--    create_horse_record's existing (staff-only) owner_contact_id override —
--    reusing that mechanism, not inventing a second one. DROP first, same
--    reason as above (10 args -> 11 is a widened argument list).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.my_stable_add_horse(text, text, text, text, text, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.my_stable_add_horse(p_name text, p_barn_name text DEFAULT NULL::text, p_breed text DEFAULT NULL::text, p_sex text DEFAULT NULL::text, p_height text DEFAULT NULL::text, p_dob date DEFAULT NULL::date, p_color text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_markings text DEFAULT NULL::text, p_as_company boolean DEFAULT NULL::boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb;
  v_as_company boolean := coalesce(p_as_company, has_staff_access());
  v_owner uuid;
BEGIN
  IF v_as_company THEN
    IF NOT has_staff_access() THEN RAISE EXCEPTION 'only staff may add to the company''s stable'; END IF;
    v_owner := company_contact_id();
  END IF;
  v_res := create_horse_record(jsonb_strip_nulls(jsonb_build_object(
    'registered_name', p_name,
    'nickname', p_barn_name,
    'breed', p_breed,
    'sex', p_sex,
    'height', p_height,
    'date_of_birth', p_dob,
    'color', p_color,
    'current_location', coalesce(p_location, 'Carmel Creek Ranch'),
    'markings', p_markings,
    'medical_history', p_notes,
    'owner_contact_id', v_owner::text
  )));
  RETURN (v_res->>'horse_id')::uuid;
END;
$function$;

-- same grant profile the dropped 10-arg version had (verified live before drop).
GRANT EXECUTE ON FUNCTION public.my_stable_add_horse(text, text, text, text, text, date, text, text, text, text, boolean) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Horses — update/delete: widen from "mine personally" to "mine, or the
--    company's when I'm staff" — otherwise a company-owned horse is
--    unreachable for edit/delete from this page forever.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_stable_update_horse(p_id uuid, p_barn_name text DEFAULT NULL::text, p_breed text DEFAULT NULL::text, p_sex text DEFAULT NULL::text, p_height text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_location text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE horses
     SET nickname        = COALESCE(p_barn_name, nickname),
         breed            = COALESCE(p_breed, breed),
         sex              = COALESCE(p_sex, sex),
         height           = COALESCE(p_height, height),
         color            = COALESCE(p_color, color),
         current_location = COALESCE(p_location, current_location),
         updated_at       = now()
   WHERE id = p_id
     AND org_id = current_org()
     AND deleted_at IS NULL
     AND (
       current_owner_contact_id = current_contact_id()
       OR (has_staff_access() AND current_owner_contact_id = company_contact_id())
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'horse not found or not yours to edit';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_stable_delete_horse(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE horses
     SET deleted_at = now()
   WHERE id = p_id
     AND org_id = current_org()
     AND deleted_at IS NULL
     AND (
       current_owner_contact_id = current_contact_id()
       OR (has_staff_access() AND current_owner_contact_id = company_contact_id())
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'horse not found or not yours to remove';
  END IF;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Gear/supplies — the D15 file-spine pattern, reused: an owner_kind
--    column, `user_id` retained as who-actually-clicked-add (audit), never
--    the ownership question.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.stable_items
  ADD COLUMN IF NOT EXISTS owner_kind text NOT NULL DEFAULT 'contact'
    CHECK (owner_kind IN ('contact', 'org'));

COMMENT ON COLUMN public.stable_items.owner_kind IS
  'Mirrors files.owner_kind (D15/TASK-UPLOADS): contact = the adding user''s '
  'own gear/supplies; org = the tenant''s (My Stable, act-as-company). '
  'user_id is retained as the audit trail (who clicked add), never the '
  'ownership question, same distinction files.ts documents for uploaded_by.';

DROP POLICY IF EXISTS stable_items_own ON public.stable_items;

-- Read: your own personal items, OR the company's (any staff), OR an admin
-- reading everything in-org (unchanged reach, restated explicitly rather
-- than folded into the org-wide admin branch, so "the company's stable" has
-- its own name in the policy, matching the horses read-side model).
CREATE POLICY stable_items_read ON public.stable_items
  FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (owner_kind = 'org' AND org_id = current_org() AND has_staff_access())
    OR (org_id = current_org() AND is_admin())
  );

-- Write: personal items stay self-serve; company items are staff-only (D7:
-- "only operators post as the company" — same is_admin() gate feed_post_create
-- uses for as_company writes). user_id always records the actual clicker.
CREATE POLICY stable_items_write ON public.stable_items
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND org_id = current_org()
    AND (owner_kind = 'contact' OR is_admin())
  );

CREATE POLICY stable_items_modify ON public.stable_items
  FOR UPDATE
  USING (
    (user_id = auth.uid() AND owner_kind = 'contact')
    OR (owner_kind = 'org' AND org_id = current_org() AND is_admin())
  )
  WITH CHECK (
    (user_id = auth.uid() AND owner_kind = 'contact')
    OR (owner_kind = 'org' AND org_id = current_org() AND is_admin())
  );

CREATE POLICY stable_items_remove ON public.stable_items
  FOR DELETE
  USING (
    (user_id = auth.uid() AND owner_kind = 'contact')
    OR (owner_kind = 'org' AND org_id = current_org() AND is_admin())
  );
