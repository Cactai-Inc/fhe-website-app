-- Phase 1 — signed-contact detection.
--
-- When staff provision/upgrade an existing contact (e.g. a kiosk walk-in who
-- already signed docs), the provision form should preselect the account category
-- implied by what they've already signed:
--   - EXECUTED RELEASE_PARTICIPANT (or other rider docs) → RIDER
--   - EXECUTED horse releases (RELEASE_HORSE_CARE / HORSE_EMERGENCY_VET) → HORSE_OWNER
--   - else → GUEST
-- Staff can still change it. Returns a single suggested token + the set of
-- EXECUTED template_keys (so the UI can show "already signed" and not re-request).

CREATE OR REPLACE FUNCTION public.suggested_category_for_contact(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH signed AS (
    SELECT DISTINCT t.template_key
    FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
    JOIN contract_templates t ON t.id = d.template_id
    WHERE dp.contact_id = p_contact_id
  )
  SELECT jsonb_build_object(
    'suggested', CASE
      WHEN EXISTS (SELECT 1 FROM signed WHERE template_key IN ('RELEASE_HORSE_CARE','HORSE_EMERGENCY_VET'))
        THEN 'HORSE_OWNER'
      WHEN EXISTS (SELECT 1 FROM signed WHERE template_key IN ('RELEASE_PARTICIPANT','RIDER_LESSON','RIDER_LESSON_JUMPER','MINOR_RIDER'))
        THEN 'RIDER'
      ELSE 'GUEST'
    END,
    'executed_templates', coalesce((SELECT array_agg(template_key ORDER BY template_key) FROM signed), ARRAY[]::text[])
  );
$function$;

REVOKE ALL ON FUNCTION public.suggested_category_for_contact(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.suggested_category_for_contact(uuid) TO authenticated, service_role;
