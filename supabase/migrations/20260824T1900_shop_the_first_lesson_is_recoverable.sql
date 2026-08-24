-- TASK-INTAKE — "have they ever bought a riding lesson?", so the first-lesson
-- prompt can be recovered instead of lost.
--
-- Owner, 2026-08-24: "make it so the shop path is recoverable if the user doesnt
-- complete it... shown to the user when they have no prior riding lesson purchase
-- and then they can close out of it, navigate away from it, but it lives on the
-- dashboard as a notification to schedule their evaluation lesson."
--
-- ⚠️ DERIVED, NOT A NOTIFICATION ROW. A notification is a one-shot record: dismiss
-- it and the prompt is gone forever, which is the opposite of recoverable. This
-- answers the question from the purchases themselves, so the dashboard card
-- appears while it is true and disappears the moment they buy — the self-hiding
-- surface D13's 2026-08-22 exception describes, which needs no editor and cannot
-- go stale.
--
-- `my_purchase_categories` was NOT reused: it unions in party roles and tags, so
-- it answers "is this person riding-shaped", not "have they bought a lesson".
CREATE OR REPLACE FUNCTION public.my_first_lesson_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'has_lesson_purchase', EXISTS (
      SELECT 1
        FROM purchases pu
        JOIN purchase_items pi ON pi.purchase_id = pu.id AND pi.voided_at IS NULL
        JOIN offerings o       ON o.id = pi.offering_id
       WHERE pu.buyer_contact_id = current_contact_id()
         AND pu.deleted_at IS NULL
         -- A DRAFT counts. They picked it and are mid-checkout; nagging somebody
         -- who is already holding the thing is how a prompt loses its authority.
         AND coalesce(pu.status, '') <> 'void'
         AND o.service_type = 'RIDING_LESSON'),
    -- Only prompt people for whom a lesson is the point. A boarder or a pure
    -- contract party is not failing to do something by never buying one.
    'is_rider', EXISTS (
      SELECT 1 FROM groups g
       WHERE g.contact_id = current_contact_id() AND g.group_type = 'RIDER')
      OR EXISTS (
      SELECT 1 FROM contact_required_documents crd
       WHERE crd.contact_id = current_contact_id()
         AND crd.template_key = 'RELEASE_PARTICIPANT'));
$function$;
GRANT EXECUTE ON FUNCTION public.my_first_lesson_state() TO authenticated;
