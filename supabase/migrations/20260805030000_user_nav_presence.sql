/*
  # TASK I2 — my_nav_presence(): five cheap per-account EXISTS checks driving
  the dynamic USER sidebar + avatar-menu links (Orders, Documents, Stable,
  My Posts, Saved Content). Each mirrors the exact scope its own page/RPC
  already uses — a nav link must never appear when the page it opens would
  render empty, and vice versa.

  orders     — purchases RLS for a member (20260725007000_purchases_member_own_select.sql):
               buyer_user_id = auth.uid() OR buyer_contact_id = current_contact_id(),
               AND the org_boundary restrictive policy (org_id = current_org()).
               SECURITY DEFINER bypasses RLS, so both conditions are reproduced
               explicitly here rather than relying on the policy.
  documents  — reuses my_documents() directly (post-DOCVIS party-read scope),
               guaranteeing byte-identical scope with Documents.tsx forever,
               not just today.
  stable     — reuses my_stable_horses() directly, matching the locked design's
               explicit "stable = my_stable_horses() scope" (not gear/supplies,
               even though the Account page's Stable section also shows those).
  posts      — feed_my_posts()'s own WHERE clause (author_id = auth.uid()),
               reproduced directly rather than calling feed_my_posts() itself:
               that RPC returns a single jsonb-aggregated array, not a table,
               so EXISTS(... LIMIT 1) doesn't short-circuit the way it does for
               the two TABLE-returning functions above.
  saved      — hardcoded false. Orchestrator ruling 2026-08-05: "Saved Content"
               has no backing data model anywhere in this codebase — the
               Account page's Saved section renders only static seed fixtures
               (SEED_SAVED) to every account, unconditionally. There is nothing
               real to check presence against yet; the actual saved/bookmark
               feature is deliberately out of scope here and tracked
               separately. Paired with a fix in the same commit to
               AccountPanels.tsx so the page stops showing fake content to
               real users (SavedPanel now honors SEED_ENABLED, matching every
               other seed-fallback section) — otherwise the nav link (always
               hidden) and the page (always non-empty) would contradict each
               other.

  Grants: this project's public schema auto-grants EXECUTE on every new
  function to anon/authenticated/service_role via a default privilege
  (pg_default_acl, defaclobjtype='f' — see TASK-C10-REPORT.md §2, "Found and
  fixed mid-verification"). REVOKE ALL ... FROM public, anon does NOT remove
  those default per-role grants — anon keeps EXECUTE unless revoked from anon
  explicitly too. This function returns only booleans about the caller
  themselves, so authenticated is the intended audience (service_role for
  admin-client callers); anon is revoked.
*/

CREATE OR REPLACE FUNCTION public.my_nav_presence()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_orders boolean;
  v_documents boolean;
  v_stable boolean;
  v_posts boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'orders', false, 'documents', false, 'stable', false,
      'posts', false, 'saved', false);
  END IF;

  v_orders := EXISTS (
    SELECT 1 FROM purchases p
    WHERE (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
      AND p.org_id = current_org()
  );

  v_documents := EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1);

  v_stable := EXISTS (SELECT 1 FROM public.my_stable_horses() LIMIT 1);

  v_posts := EXISTS (
    SELECT 1 FROM feed_posts fp WHERE fp.author_id = auth.uid()
  );

  RETURN jsonb_build_object(
    'orders', v_orders,
    'documents', v_documents,
    'stable', v_stable,
    'posts', v_posts,
    'saved', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.my_nav_presence() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_nav_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_nav_presence() TO service_role;
