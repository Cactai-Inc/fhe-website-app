-- Notifications: reach a party's real account even when their party contact is a
-- duplicate not linked to a profile.
--
-- Bug: notification inserts resolved the user via `profiles.contact_id = <party
-- contact>`. A party can be assigned to a duplicate contact record (same email,
-- different id, no profile link) — e.g. the FHE Lessee seat pointed at a
-- "French Heritage Equestrian" contact, not the real account contact — so the
-- account holder got no in-app notification even though they have a dashboard.
--
-- Fix: a helper that returns every distinct user_id for a party, matching on
-- contact_id OR the contact's email (profiles.email is unique per account here).
-- Both notification sites now use it.

CREATE OR REPLACE FUNCTION public.party_user_ids(p_document_id uuid, p_party_role text)
 RETURNS TABLE(user_id uuid)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.user_id
    FROM document_parties dp
    JOIN contacts c ON c.id = dp.contact_id
    JOIN profiles p ON (p.contact_id = dp.contact_id
                        OR (c.email IS NOT NULL AND lower(p.email) = lower(c.email)))
   WHERE dp.document_id = p_document_id
     AND dp.party_role = p_party_role
     AND p.user_id IS NOT NULL;
$function$;

-- ── send_contract_to_party: use the email-fallback resolver ──────────────────
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('send_contract_to_party'::regproc);
  v_def := replace(v_def,
$old$    FROM profiles p WHERE p.contact_id = v_target;$old$,
$new$    FROM profiles p
   WHERE p.user_id IN (SELECT user_id FROM party_user_ids(p_document_id, p_party_role));$new$);
  IF v_def NOT LIKE '%party_user_ids(p_document_id, p_party_role)%' THEN
    RAISE EXCEPTION 'send_contract_to_party: target select not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;

-- ── advance_document_workflow (in_review/locked): resolve per party w/ email ──
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('advance_document_workflow'::regproc);
  v_def := replace(v_def,
$old$      FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();$old$,
$new$      FROM document_parties dp
      JOIN contacts pc ON pc.id = dp.contact_id
      JOIN profiles pr ON (pr.contact_id = dp.contact_id
                           OR (pc.email IS NOT NULL AND lower(pr.email) = lower(pc.email)))
      WHERE dp.document_id = p_document_id
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();$new$);
  IF v_def NOT LIKE '%JOIN contacts pc ON pc.id = dp.contact_id%' THEN
    RAISE EXCEPTION 'advance_document_workflow: in_review/locked insert not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;
