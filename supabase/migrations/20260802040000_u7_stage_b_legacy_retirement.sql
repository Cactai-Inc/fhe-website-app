-- ============================================================================
-- U7 / STAGE 5 — STAGE B LEGACY RETIREMENT (partial — per the zero-reader sweep)
-- Plan: master-finishing-plan.md U7.
--
-- ZERO-READER SWEEP (raw, run live 2026-08-02 against lrstswfxfsezdmvkvukc):
--
--   pg_proc bodies referencing each legacy column (excluding the two functions
--   rebuilt in this migration):
--     mobile          -> admin_client_overview, pending_fee_candidates, mark_tour_seen
--     whatsapp        -> admin_client_overview
--     mobile_display  -> (none)
--     allow_call      -> (none)
--     allow_sms       -> (none)
--     allow_whatsapp  -> (none)
--     allow_whatsapp_call -> (none)
--     hide_mobile     -> (none)
--     hide_whatsapp   -> (none)
--     hide_email      -> (none)
--
--   Of the `mobile`/`whatsapp` hits: mark_tour_seen's is a string literal
--   ('mobile' as a form-factor flag) — false positive, confirmed by reading the
--   body. pending_fee_candidates reads `p.mobile` where p is `profiles`, which
--   HAS NO mobile COLUMN — confirmed by executing it live:
--     ERROR: column p.mobile does not exist
--     HINT: Perhaps you meant to reference the column "c.mobile".
--   That function is already broken in production on every call, independent
--   of this migration — reported below, not fixed here (out of this unit's
--   scope; it is a pre-existing defect in unrelated code).
--
--   admin_client_overview IS a real, executing reader of contacts.mobile and
--   contacts.whatsapp (via the linked contact `pc`), and its result is rendered
--   live in src/pages/app/Admin.tsx:140-141 ("Mobile" / "WhatsApp" rows in the
--   staff account-detail panel).
--
--   mobile_display is GENERATED ALWAYS AS (... mobile ...) STORED — structurally
--   coupled to `mobile` and cannot be dropped independently of it.
--
--   member_directory (view) still emits mobile, whatsapp, hide_mobile,
--   hide_whatsapp, allow_sms, allow_call, allow_whatsapp, allow_whatsapp_call —
--   a Stage-A dual-emit. Confirmed nothing in src/ reads the legacy-named
--   fields from it: community-types.ts:33 deliberately does NOT declare them,
--   with a comment stating exactly this ("nothing reads them... Stage B drops
--   the columns"). The view is rebuilt here to stop emitting the columns this
--   migration drops; it keeps emitting mobile/whatsapp/hide_mobile/hide_whatsapp
--   until admin_client_overview's blocker resolves.
--
-- PER THE RULING: any nonzero reader is reported and skips EXACTLY the drops
-- it blocks; the rest applies.
--
--   BLOCKED (not dropped this migration): mobile, whatsapp, mobile_display,
--   hide_mobile, hide_whatsapp, hide_email. The first three: entangled with the
--   one live reader (admin_client_overview / Admin.tsx) or structurally
--   dependent on a blocked column. hide_mobile/hide_whatsapp/hide_email: each
--   still gates a column member_directory continues to emit after this
--   migration (mobile/whatsapp respectively, and hide_email gates `email`,
--   which the view keeps regardless of this drop). SELF-CAUGHT DURING APPLY:
--   the first attempt classified hide_email as clear on the strength of the
--   pg_proc sweep alone and tried to drop it; the live DROP failed with
--   "other objects depend on it — view member_directory depends on column
--   hide_email" (rolled back cleanly, nothing left half-applied). The pg_proc
--   sweep alone was insufficient — the view being rebuilt in the SAME
--   migration is itself a reader and had to be checked too. Corrected below.
--
--   CLEARED AND DROPPED this migration: allow_call, allow_sms, allow_whatsapp,
--   allow_whatsapp_call. Zero readers anywhere, including the rebuilt view
--   (which no longer emits them).
--
-- OUT OF SCOPE, deliberately NOT touched (verify-first divergence from a
-- misreading of the plan's own phrase): the plan's U7 text mentions "the
-- '|| confirmed' widenings and the types.ts:22 union member" as if part of this
-- unit. Traced to docs/BACKLOG.md's `purchases.status = 'confirmed'` entry —
-- an entirely different, unrelated retiring value (Stripe status vocabulary),
-- not a contacts/phone column at all. It is its own BACKLOG-tracked deferred
-- cleanup with its own stated gate ("once no 'confirmed' rows remain" — true
-- today, 0 rows) and its own owner. Conflating it into U7 was the plan's error,
-- not a live anchor; left alone here as report-only. Src/lib/types.ts:22 is
-- actually `OrderStatus`'s 'confirmed' member, not phone-related.
-- ============================================================================

BEGIN;

-- ── 1. member_directory: rebuilt, no longer emits the CLEARED columns ───────
-- Full replacement of the live view. mobile/whatsapp/hide_mobile/hide_whatsapp
-- STAY (blocked). allow_call/allow_sms/allow_whatsapp/allow_whatsapp_call are
-- dropped from the SELECT list, matching the columns being dropped below.
--
-- CREATE OR REPLACE VIEW cannot remove trailing columns from the output list
-- (Postgres: "cannot drop columns from view") — confirmed live, migration
-- failed and cleanly rolled back on first attempt. DROP + CREATE instead, with
-- the grant restored explicitly afterward — same pattern as the last migration
-- that altered this view's column set (20260801020000_community_channels_
-- stage_a.sql:219, "Restore the grants the DROP removed").
DROP VIEW IF EXISTS public.member_directory;
CREATE VIEW public.member_directory AS
 SELECT p.user_id,
    p.display_name,
    COALESCE(p.first_name, c.first_name) AS first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
        CASE
            WHEN c.hide_community_email THEN NULL::text
            ELSE c.community_email
        END AS community_email,
        CASE
            WHEN c.hide_mobile_call THEN NULL::text
            ELSE c.mobile_call
        END AS mobile_call,
        CASE
            WHEN c.hide_mobile_text THEN NULL::text
            ELSE c.mobile_text
        END AS mobile_text,
        CASE
            WHEN c.hide_whatsapp_call THEN NULL::text
            ELSE c.whatsapp_call
        END AS whatsapp_call,
        CASE
            WHEN c.hide_whatsapp_text THEN NULL::text
            ELSE c.whatsapp_text
        END AS whatsapp_text,
        CASE
            WHEN c.hide_email THEN NULL::text
            ELSE c.email
        END AS email,
        -- BLOCKED, kept: mobile / whatsapp still read by admin_client_overview.
        CASE
            WHEN c.hide_mobile THEN NULL::text
            ELSE c.mobile
        END AS mobile,
        CASE
            WHEN c.hide_whatsapp THEN NULL::text
            ELSE c.whatsapp
        END AS whatsapp,
    c.social_tiktok,
    c.social_instagram,
    c.social_facebook,
    c.social_linkedin,
    (EXISTS ( SELECT 1
           FROM horses h
          WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL)) AS is_horse_owner,
        CASE
            WHEN c.preferred_contact = 'email'::text AND (c.hide_community_email OR c.community_email IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'sms'::text AND (c.hide_mobile_text OR c.mobile_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'call'::text AND (c.hide_mobile_call OR c.mobile_call IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'whatsapp'::text AND (c.hide_whatsapp_text OR c.whatsapp_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'instagram'::text AND c.social_instagram IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'facebook'::text AND c.social_facebook IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'linkedin'::text AND c.social_linkedin IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'tiktok'::text AND c.social_tiktok IS NULL THEN 'none'::text
            ELSE c.preferred_contact
        END AS preferred_contact
   FROM profiles p
     JOIN members m ON m.user_id = p.user_id AND m.status = 'active'::text
     JOIN contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
  WHERE NOT p.is_suspended AND p.role IS DISTINCT FROM 'SUPER_ADMIN'::text;

-- Restore the grant the DROP removed, matching the prior migration's own
-- restoration of this exact view's ACL.
GRANT SELECT ON public.member_directory TO anon, authenticated, service_role;

-- ── 2. update_contact_record: full CREATE OR REPLACE from the LIVE body ─────
-- The CLEARED columns (allow_*) are removed from the allowlist and the
-- boolean-cast branch. mobile/whatsapp/hide_mobile/hide_whatsapp/hide_email
-- ALL STAY in the allowlist — every one of them is blocked.
CREATE OR REPLACE FUNCTION public.update_contact_record(p_contact_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed text[] := ARRAY[
    'first_name','last_name','email','phone','phone_ext','mobile','mobile_ext','whatsapp',
    'address_line1','address_line2','city','state','postal_code','country',
    'date_of_birth','notes','tags','contact_type','guardian_contact_id',
    'emergency_contact_1_name','emergency_contact_1_relationship','emergency_contact_1_phone',
    'emergency_contact_2_name','emergency_contact_2_relationship','emergency_contact_2_phone',
    'riding_experience_years','jump_experience','riding_background','jump_limitations',
    'preferred_contact','hide_mobile','hide_whatsapp','hide_email',
    'social_tiktok','social_instagram','social_facebook','social_linkedin'];
  k text;
  v_sets text[] := '{}';
  v_sql text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = current_org() AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (k = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'field % is not editable here', k;
    END IF;
    v_sets := v_sets || format('%I = ($1->>%L)::text', k, k);
  END LOOP;

  IF array_length(v_sets, 1) IS NULL THEN
    RETURN contact_dossier(p_contact_id);
  END IF;

  -- tags is text[], the booleans are boolean, dates are date — cast per column
  -- rather than forcing everything through text.
  v_sql := 'UPDATE contacts SET ' || array_to_string(
    ARRAY(SELECT CASE
      WHEN key = 'tags' THEN
        format('tags = CASE WHEN $1->%L = ''null''::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text($1->%L)) END', key, key)
      WHEN key IN ('hide_mobile','hide_whatsapp','hide_email') THEN
        format('%I = ($1->>%L)::boolean', key, key)
      WHEN key = 'date_of_birth' THEN
        format('date_of_birth = nullif($1->>%L, '''')::date', key)
      WHEN key = 'guardian_contact_id' THEN
        format('guardian_contact_id = nullif($1->>%L, '''')::uuid', key)
      ELSE format('%I = nullif($1->>%L, '''')', key, key)
    END FROM jsonb_object_keys(p_patch) AS key), ', ')
    || ', updated_at = now() WHERE id = $2';

  EXECUTE v_sql USING p_patch, p_contact_id;
  RETURN contact_dossier(p_contact_id);
END
$function$;

-- ── 3. contacts_normalise_phone: full CREATE OR REPLACE from the LIVE body ──
-- No legacy-column reference in this trigger to begin with (it only touches
-- phone/mobile/whatsapp's *_call/_text variants and the extensions) — rebuilt
-- verbatim per the plan's instruction that both named functions land as full
-- replacements in this migration, not because anything here changed.
CREATE OR REPLACE FUNCTION public.contacts_normalise_phone()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.phone  := format_phone(NEW.phone);
  NEW.mobile := format_phone(NEW.mobile);
  NEW.phone_ext  := nullif(regexp_replace(coalesce(NEW.phone_ext, ''),  '\D', '', 'g'), '');
  NEW.mobile_ext := nullif(regexp_replace(coalesce(NEW.mobile_ext, ''), '\D', '', 'g'), '');
  NEW.mobile_call   := format_phone(NEW.mobile_call);
  NEW.mobile_text   := format_phone(NEW.mobile_text);
  NEW.whatsapp_call := format_phone(NEW.whatsapp_call);
  NEW.whatsapp_text := format_phone(NEW.whatsapp_text);
  RETURN NEW;
END
$function$;

-- ── 4. Drop the CLEARED columns only ─────────────────────────────────────────
ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS allow_call,
  DROP COLUMN IF EXISTS allow_sms,
  DROP COLUMN IF EXISTS allow_whatsapp,
  DROP COLUMN IF EXISTS allow_whatsapp_call;

-- mobile, whatsapp, mobile_display, hide_mobile, hide_whatsapp, hide_email
-- deliberately NOT dropped — all six blocked, per the corrected disposition
-- above.

COMMIT;
