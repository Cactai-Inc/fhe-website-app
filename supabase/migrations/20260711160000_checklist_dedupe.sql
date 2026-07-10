/*
  # contact_checklist v3 — dedupe engagement rows, actionable links

  Owner-reported: "Riding Lesson" listed twice in Needs-your-attention, and
  clicking it dumped them on the account items list. Two causes:
  - duplicate provisions create N identical paperless engagements → N
    identical rows. Now collapsed to ONE row per (service_type, status).
  - paperless AWAITING_SIGNATURE engagements linked to /app/account, which is
    a list, not an action. They now link to /app/onboarding (where their
    paperwork generates and gets signed); completed lesson engagements link
    to the schedule.
*/

CREATE OR REPLACE FUNCTION contact_checklist(p_contact_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY done, created_at), '[]'::jsonb)
  FROM (
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
      AND ep.party_role <> 'PARTICIPANT'

    UNION ALL

    SELECT jsonb_build_object(
        'kind', 'required_doc',
        'id', ct.template_key,
        'title', t.title,
        'action', 'Review and sign at first login',
        'link', '/app/onboarding',
        'done', false
      ),
      false,
      now()
    FROM required_templates_for_contact(p_contact_id) ct
    JOIN contract_templates t ON t.template_key = ct.template_key
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t2 ON t2.id = d.template_id
      JOIN engagement_parties ep ON ep.engagement_id = d.engagement_id
      WHERE t2.template_key = ct.template_key
        AND ep.contact_id = p_contact_id AND d.deleted_at IS NULL
    )

    UNION ALL

    -- paperless engagements: ONE row per service/status (duplicate provisions
    -- collapse), linked to the action, not a list
    SELECT DISTINCT ON (e.service_type, e.status) jsonb_build_object(
        'kind', 'engagement',
        'id', e.id,
        'title', initcap(replace(coalesce(e.service_type, 'engagement'), '_', ' ')),
        'action', CASE WHEN e.status = 'ACTIVE' THEN 'Active' ELSE 'Complete your paperwork' END,
        'link', CASE
          WHEN e.status <> 'ACTIVE' THEN '/app/onboarding'
          WHEN e.service_type IN ('RIDING_LESSON','JUMPER_TRAINING','HORSEMANSHIP_TRAINING') THEN '/app/schedule'
          ELSE '/app/account'
        END,
        'done', e.status = 'ACTIVE'
      ),
      e.status = 'ACTIVE',
      e.created_at
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id AND cl.deleted_at IS NULL
    WHERE cl.contact_id = p_contact_id AND e.deleted_at IS NULL
      AND e.service_type <> 'ONBOARDING'
      AND NOT EXISTS (SELECT 1 FROM documents d2
                       WHERE d2.engagement_id = e.id AND d2.deleted_at IS NULL)
  ) items
$$;
