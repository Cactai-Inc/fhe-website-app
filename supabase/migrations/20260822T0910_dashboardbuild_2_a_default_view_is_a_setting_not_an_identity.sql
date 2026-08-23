-- DASHBOARDBUILD §2 — the owner's toggle ruling, as data.
--
-- Owner, 2026-08-22: *"we need to have a way for claire and i to either select
-- which dashboard from the two styles we see in the ui on the dashboard or it
-- needs to be generated for us based on a designation of our role... I vote for
-- the toggle between the two views and we can set the primary view in the
-- setting based on the email account used to login."*
--
-- Three things follow, and they are deliberately separate:
--
--   BOTH VIEWS ARE ALWAYS REACHABLE BY BOTH ACCOUNTS. D26 is explicit that the
--   designation "selects emphasis only, never capability" — Claire and CJ hold
--   the same role and the same permissions. So nothing here gates a view. This
--   column decides what you LAND on, never what you may open.
--
--   THE DEFAULT IS A STORED SETTING, NOT A HARDCODED EMAIL SWITCH. D13: if the
--   only way to change a thing is a migration, that thing has no editor and the
--   work is unfinished. The seeding below is an initial value for two known
--   accounts, and `set_dashboard_focus` is the editor behind the Team page's
--   member panel.
--
--   THE SESSION TOGGLE NEVER WRITES HERE. Switching view to check something is
--   not a decision about where you start tomorrow; only the settings control
--   writes this column (§2.3).
--
-- D1a: `admin@cactai.io` is the PLATFORM owner and is not a tenant identity. It
-- is not seeded, `set_dashboard_focus` refuses it along with every other caller
-- outside the org, and DashboardHome routes it to the platform surfaces before
-- either view is ever considered.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_focus text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_dashboard_focus_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_dashboard_focus_chk
      CHECK (dashboard_focus IS NULL OR dashboard_focus IN ('trainer', 'business'));
  END IF;
END$$;

COMMENT ON COLUMN public.profiles.dashboard_focus IS
  'DASHBOARDBUILD §2 / D26. Which owner dashboard this account LANDS on: trainer '
  '(Head Trainer) or business (Business Operations). NULL = fall back by role. '
  'NEVER read by a permission check — both views are open to every staff account.';

-- The two production identities, per the owner's own wording ("based on the
-- email account used to login"). Written by email, not by user_id, so this
-- statement says what it means.
UPDATE public.profiles p
   SET dashboard_focus = 'trainer'
  FROM auth.users u
 WHERE u.id = p.user_id
   AND lower(u.email) = 'hello@fhequestrian.com'
   AND p.dashboard_focus IS NULL;

UPDATE public.profiles p
   SET dashboard_focus = 'business'
  FROM auth.users u
 WHERE u.id = p.user_id
   AND lower(u.email) = 'admin@fhequestrian.com'
   AND p.dashboard_focus IS NULL;

-- THE EDITOR (D13). A staff member sets their own default; an admin sets any
-- staff member's in their own org. Both FHE owners are ADMIN, so in practice
-- either can set either — which is what "Claire and i" asks for.
CREATE OR REPLACE FUNCTION public.set_dashboard_focus(p_user_id uuid, p_focus text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_target uuid;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  IF p_focus IS NOT NULL AND p_focus NOT IN ('trainer', 'business') THEN
    RAISE EXCEPTION 'unknown dashboard view: %', p_focus;
  END IF;

  -- Self, or anyone on my own org's roster if I am an admin. The org test is
  -- not decoration: it is what keeps the platform owner (org_id NULL, D1a) from
  -- reaching a tenant's rows, and `coalesce(..., false)` is what stops a NULL
  -- comparison being read as permission (the D1a repair pattern).
  SELECT p.user_id INTO v_target
    FROM profiles p
   WHERE p.user_id = p_user_id
     AND coalesce(p.org_id = v_org, false)
     AND (p.user_id = auth.uid() OR coalesce(is_admin(), false));

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'not permitted to change that account''s default view';
  END IF;

  UPDATE profiles SET dashboard_focus = p_focus, updated_at = now()
   WHERE user_id = v_target;

  RETURN coalesce(p_focus, 'default');
END;
$function$;

REVOKE ALL ON FUNCTION public.set_dashboard_focus(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_dashboard_focus(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_dashboard_focus(uuid, text) IS
  'DASHBOARDBUILD §2.2 — the owner-editable default dashboard view (D13). Reached '
  'from Team -> the member panel -> "Default dashboard". The on-dashboard toggle '
  'does NOT call this: a session switch must not silently move where you land.';
