-- disc_39 (fix round item 2): the client record reads contract roles and the
-- execution date from the dossier.
--   - documents rows carry effective_date (the date the document is in force on),
--     so the record shows it instead of generated_at (item 2b / item 4).
--   - a new contract_roles array gives each party membership its own linkable
--     row (document id + code + title + status), so the Contract roles section
--     is read-only with a link to the source document (item 2a). standing.party_roles
--     is unchanged, because the contacts-list RPC and ContactsPage still read it.

CREATE OR REPLACE FUNCTION public.contact_dossier(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_user uuid;
  v_out  jsonb;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = p_contact_id;

  SELECT jsonb_build_object(
    -- ── the person: every editable field on the contact record ──────────────
    'contact', (SELECT to_jsonb(c) FROM contacts c WHERE c.id = p_contact_id),

    -- ── the account, when there is one ──────────────────────────────────────
    'account', CASE WHEN v_user IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'user_id', p.user_id, 'role', p.role, 'is_suspended', p.is_suspended,
        'display_name', p.display_name, 'bio', p.bio, 'riding_level', p.riding_level,
        'avatar_url', p.avatar_url, 'created_at', p.created_at,
        'member_status', (SELECT m.status FROM members m WHERE m.user_id = p.user_id LIMIT 1),
        'login', (SELECT jsonb_build_object(
            'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
                                     FROM auth.identities i WHERE i.user_id = p.user_id), '[]'::jsonb),
            'last_sign_in_at', u.last_sign_in_at,
            'email_confirmed_at', u.email_confirmed_at)
          FROM auth.users u WHERE u.id = p.user_id))
      FROM profiles p WHERE p.user_id = v_user) END,

    -- ── how they are filed, and what that was derived from ──────────────────
    'standing', jsonb_build_object(
      'contact_type', (SELECT c.contact_type FROM contacts c WHERE c.id = p_contact_id),
      'is_client', EXISTS (SELECT 1 FROM clients cl
                            WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL),
      'groups', coalesce((SELECT jsonb_agg(g.group_type ORDER BY g.group_type)
                            FROM groups g WHERE g.contact_id = p_contact_id), '[]'::jsonb),
      'party_roles', coalesce((SELECT jsonb_agg(DISTINCT dp.party_role)
                                 FROM document_parties dp WHERE dp.contact_id = p_contact_id), '[]'::jsonb)),

    -- ── CONTRACT ROLES, each one linkable to its document (item 2a). One row
    --    per party membership on a live (not deleted) document, newest first,
    --    so the record can list the role AND link to the source contract rather
    --    than printing a bare role word.
    'contract_roles', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'document_id', d.id, 'document_code', d.display_code,
                 'document_title', d.title, 'party_role', dp.party_role,
                 'status', d.status, 'current_status', d.current_status,
                 'effective_date', d.effective_date) ORDER BY d.generated_at DESC)
                 FROM document_parties dp
                 JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
                WHERE dp.contact_id = p_contact_id), '[]'::jsonb),

    -- ── RELATIONSHIPS. The guardian link existed in the schema and was already
    --    populated, but nothing ever showed it. Both directions are returned so
    --    the tie reads correctly from parent or child.
    'family', jsonb_build_object(
      'guardian', (SELECT jsonb_build_object(
                     'contact_id', g.id,
                     'name', coalesce(nullif(trim(concat_ws(' ', g.first_name, g.last_name)), ''), g.email),
                     'email', g.email)
                     FROM contacts g
                     JOIN contacts c ON c.guardian_contact_id = g.id
                    WHERE c.id = p_contact_id AND g.deleted_at IS NULL),
      'dependants', coalesce((SELECT jsonb_agg(jsonb_build_object(
                     'contact_id', d.id,
                     'name', coalesce(nullif(trim(concat_ws(' ', d.first_name, d.last_name)), ''), d.email),
                     'date_of_birth', d.date_of_birth) ORDER BY d.date_of_birth)
                     FROM contacts d
                    WHERE d.guardian_contact_id = p_contact_id AND d.deleted_at IS NULL), '[]'::jsonb)),

    'horses', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'horse_id', h.id,
                 'name', coalesce(h.nickname, h.registered_name),
                 'relation', CASE WHEN h.current_owner_contact_id = p_contact_id THEN 'owner'
                                  ELSE 'lessee' END) ORDER BY h.registered_name)
                 FROM horses h
                WHERE h.deleted_at IS NULL
                  AND (h.current_owner_contact_id = p_contact_id
                    OR h.lessee_contact_id = p_contact_id)), '[]'::jsonb),

    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'document_id', d.id, 'code', d.display_code, 'title', d.title,
                 'status', d.status, 'current_status', d.current_status,
                 'generated_at', d.generated_at,
                 -- item 2b / item 4: the date the document is in force on, so the
                 -- record shows an execution date rather than when it was drafted.
                 'effective_date', d.effective_date) ORDER BY d.generated_at DESC)
                 FROM documents d
                WHERE d.deleted_at IS NULL
                  AND (d.contact_id = p_contact_id
                    OR EXISTS (SELECT 1 FROM document_parties dp
                                WHERE dp.document_id = d.id AND dp.contact_id = p_contact_id))), '[]'::jsonb),

    'orders', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'purchase_id', pu.id, 'code', pu.display_code, 'status', pu.status,
                 'amount', pu.amount, 'amount_paid', pu.amount_paid,
                 'payment_status', pu.payment_status, 'payment_method', pu.payment_method,
                 'paid_at', pu.paid_at, 'current_status', pu.current_status,
                 'client_claim_status', pu.client_claim_status,
                 'client_reported_method', pu.client_reported_method,
                 'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
                              'item_id', pi.id, 'offering_id', pi.offering_id,
                              'label', coalesce(o.name, pi.label),
                              'quantity', pi.quantity,
                              'price_amount', pi.price_amount, 'price_unit', pi.price_unit,
                              'config_kind', o.config_kind, 'service_type', o.service_type,
                              'voided_at', pi.voided_at, 'void_reason', pi.void_reason)
                              ORDER BY pi.created_at)
                            FROM purchase_items pi
                            LEFT JOIN offerings o ON o.id = pi.offering_id
                           WHERE pi.purchase_id = pu.id), '[]'::jsonb),
                 'created_at', pu.created_at) ORDER BY pu.created_at DESC)
                 FROM purchases pu WHERE pu.buyer_contact_id = p_contact_id), '[]'::jsonb),

    'notifications', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', n.id, 'kind', n.kind, 'title', n.title,
                 'created_at', n.created_at) ORDER BY n.created_at DESC)
                 FROM notifications n WHERE v_user IS NOT NULL AND n.user_id = v_user
                 LIMIT 25), '[]'::jsonb),

    'posts', CASE WHEN v_user IS NULL THEN NULL ELSE
                 coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'id', f.id, 'post_type', f.post_type, 'body', left(f.body, 120),
                   'published', f.published, 'pulled_down', f.pulled_down,
                   'created_at', f.created_at) ORDER BY f.created_at DESC)
                   FROM feed_posts f WHERE f.author_id = v_user), '[]'::jsonb) END,

    'activity', CASE WHEN v_user IS NULL THEN NULL ELSE
                 coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'id', a.id, 'action', a.action, 'table_name', a.table_name,
                   'occurred_at', a.occurred_at) ORDER BY a.occurred_at DESC)
                   FROM (SELECT * FROM audit_logs al
                          WHERE al.actor_user_id = v_user
                          ORDER BY al.occurred_at DESC LIMIT 50) a), '[]'::jsonb) END
  ) INTO v_out;

  RETURN v_out;
END
$function$;
