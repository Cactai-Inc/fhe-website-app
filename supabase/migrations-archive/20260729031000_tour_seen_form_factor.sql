-- A3 SPLIT PERSISTENCE (owner-final 2026-07-28): the desktop and mobile app
-- tours are DIFFERENT experiences and each persists independently — each keeps
-- auto-showing on its own form factor until dismissed there. The single
-- profiles.tour_seen_at marker becomes two form-factor markers.
--
-- Backfill: existing tour_seen_at stamps were set on the (desktop-first)
-- pre-split tour, so they carry to the DESKTOP marker; the mobile tour (which
-- also orients the member to the new mobile nav button) shows once to everyone.
-- tour_seen_at is kept as an "any form factor" compatibility stamp.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_seen_desktop_at timestamptz,
  ADD COLUMN IF NOT EXISTS tour_seen_mobile_at  timestamptz;

UPDATE public.profiles
   SET tour_seen_desktop_at = tour_seen_at
 WHERE tour_seen_at IS NOT NULL AND tour_seen_desktop_at IS NULL;

-- Replace the zero-arg RPC (a defaulted parameter alongside the old signature
-- would make rpc('mark_tour_seen') ambiguous under PostgREST). The only
-- callers are the app's fire-and-forget markTourSeen() calls.
DROP FUNCTION IF EXISTS public.mark_tour_seen();

CREATE OR REPLACE FUNCTION public.mark_tour_seen(p_form_factor text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  -- app.allow_profile_link lets this pass the role guard: the member is
  -- writing their own presentational marker, not an identity/employment field.
  PERFORM set_config('app.allow_profile_link', '1', true);
  IF p_form_factor = 'mobile' THEN
    UPDATE profiles
       SET tour_seen_mobile_at = coalesce(tour_seen_mobile_at, now()),
           tour_seen_at        = coalesce(tour_seen_at, now())
     WHERE user_id = auth.uid();
  ELSE
    UPDATE profiles
       SET tour_seen_desktop_at = coalesce(tour_seen_desktop_at, now()),
           tour_seen_at         = coalesce(tour_seen_at, now())
     WHERE user_id = auth.uid();
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_tour_seen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_tour_seen(text) TO anon, authenticated, service_role;
