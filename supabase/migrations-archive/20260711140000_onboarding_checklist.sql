/*
  # The one-email / one-card checklist

  A provisioned person with several items (contracts, engagements) gets ONE
  invitation email listing everything they'll be asked to do, and after they
  claim the account the SAME checklist renders as a single card in their
  dashboard's attention section — updating as items complete, each row linking
  to its item. One card, not one per item.

  contact_checklist(contact) derives the rows live (nothing stored, so it can
  never drift):
    - each contract document they're a party to → action wording follows the
      party's document controls + whether their fields still need filling;
      done = their signature is recorded.
    - each engagement without a document → "review"; done = ACTIVE.
*/

CREATE OR REPLACE FUNCTION contact_checklist(p_contact_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY done, created_at), '[]'::jsonb)
  FROM (
    -- contract documents where this contact is a party
    SELECT jsonb_build_object(
        'kind', 'document',
        'id', d.id,
        'title', coalesce(d.title, 'Contract'),
        'action', CASE
          WHEN EXISTS (SELECT 1 FROM signatures sg
                        WHERE sg.document_id = d.id
                          AND sg.signer_contact_id = p_contact_id
                          AND sg.deleted_at IS NULL)
            THEN 'Signed'
          WHEN coalesce(c.can_fill, true) AND EXISTS (
                 SELECT 1 FROM contract_fields f
                  WHERE f.document_id = d.id AND f.owner_role = ep.party_role
                    AND coalesce(f.value, '') = '')
            THEN 'Add your information and sign'
          WHEN coalesce(c.can_edit_deal, false) THEN 'Review, edit the terms, and sign'
          WHEN coalesce(c.can_suggest, false) THEN 'Review, suggest changes if needed, and sign'
          ELSE 'Review and sign'
        END,
        'link', '/app/contracts/' || d.id,
        'done', EXISTS (SELECT 1 FROM signatures sg
                         WHERE sg.document_id = d.id
                           AND sg.signer_contact_id = p_contact_id
                           AND sg.deleted_at IS NULL)
      ) AS row,
      EXISTS (SELECT 1 FROM signatures sg
               WHERE sg.document_id = d.id
                 AND sg.signer_contact_id = p_contact_id
                 AND sg.deleted_at IS NULL) AS done,
      d.created_at
    FROM engagement_parties ep
    JOIN documents d ON d.engagement_id = ep.engagement_id AND d.deleted_at IS NULL
    LEFT JOIN document_party_controls c
      ON c.document_id = d.id AND c.party_role = ep.party_role
    WHERE ep.contact_id = p_contact_id

    UNION ALL

    -- engagements with no paperwork attached (e.g. lesson packages)
    SELECT jsonb_build_object(
        'kind', 'engagement',
        'id', e.id,
        'title', initcap(replace(coalesce(e.service_type, 'engagement'), '_', ' ')),
        'action', CASE WHEN e.status = 'ACTIVE' THEN 'Active' ELSE 'Review' END,
        'link', '/app/account',
        'done', e.status = 'ACTIVE'
      ),
      e.status = 'ACTIVE',
      e.created_at
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id AND cl.deleted_at IS NULL
    WHERE cl.contact_id = p_contact_id AND e.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM documents d2
                       WHERE d2.engagement_id = e.id AND d2.deleted_at IS NULL)
  ) items
$$;

-- the signed-in member's own checklist (the dashboard card)
CREATE OR REPLACE FUNCTION my_onboarding_checklist()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN current_contact_id() IS NULL
    THEN '[]'::jsonb
    ELSE contact_checklist(current_contact_id())
  END
$$;

REVOKE ALL ON FUNCTION contact_checklist(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION contact_checklist(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION my_onboarding_checklist() TO authenticated;
