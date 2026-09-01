-- A3 (owner-final, 2026-07-28): the app-overview tour fires ONCE on first
-- login after deployment for EVERY account, then stays revisitable from the
-- avatar menu.
--
-- The marker is per-account on profiles. NULL = never seen (the tour
-- auto-opens); stamped = seen (auto-open never fires again). Reopening from
-- the menu deliberately does NOT touch the marker, so a member can re-read the
-- tour without changing state. The end-of-onboarding mount stamps it too, so a
-- freshly activated member does not see it twice.
--
-- Every existing account starts NULL, which is the point: they all get the
-- tour once on their next login, showing the post-D8 surface.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_seen_at timestamptz;

COMMENT ON COLUMN profiles.tour_seen_at IS
  'A3: when this account first dismissed the app-overview tour. NULL = show it on next login. Menu re-opens do not stamp it.';

/** Stamp the marker for the signed-in account. Idempotent — the first stamp
 *  wins, so a re-open (or a double dismiss) never rewrites the date. */
CREATE OR REPLACE FUNCTION public.mark_tour_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  -- app.allow_profile_link lets this pass the role guard: the member is
  -- writing their own presentational marker, not an identity/employment field.
  PERFORM set_config('app.allow_profile_link', '1', true);
  UPDATE profiles SET tour_seen_at = now()
   WHERE user_id = auth.uid() AND tour_seen_at IS NULL;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.mark_tour_seen() TO authenticated;
