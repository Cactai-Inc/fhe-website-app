-- ─────────────────────────────────────────────────────────────────────────────
-- THE CONTACT DOSSIER — one record view that works for EVERY person (2026-07-31)
--
-- WHY THIS IS KEYED ON contact_id, NOT user_id.
--
-- The existing client page and all six of its RPCs take p_user_id, so they only
-- work for someone with a login. But 13 of 19 contacts have NO account —
-- counterparties, kiosk signers, leads, and minors like Gabriella Olenik, who is
-- on her father's account and will never have her own. Lifting that page into a
-- contact-card modal unchanged would produce a modal that fails for two thirds of
-- the people you click, including the one who prompted the request.
--
-- So the dossier keys on the thing that ALWAYS exists — the contact — and
-- resolves to the account only where there is one. Account-only sections
-- (login, posts, the audit trail) come back null for someone without a login;
-- the UI simply does not render them.
--
-- MINORS get first-class treatment here: contacts.guardian_contact_id already
-- exists and was already populated (Gabriella → Brian), but nothing surfaced it.
-- The dossier returns the guardian AND the dependants, so the relationship is
-- visible from either side.
-- ─────────────────────────────────────────────────────────────────────────────

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
                  WHERE id = p_contact_id AND org_id = v_org AND deleted_at IS NULL) THEN
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
                 'generated_at', d.generated_at) ORDER BY d.generated_at DESC)
                 FROM documents d
                WHERE d.deleted_at IS NULL
                  AND (d.contact_id = p_contact_id
                    OR EXISTS (SELECT 1 FROM document_parties dp
                                WHERE dp.document_id = d.id AND dp.contact_id = p_contact_id))), '[]'::jsonb),

    'orders', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'purchase_id', pu.id, 'code', pu.display_code, 'status', pu.status,
                 'amount', pu.amount, 'amount_paid', pu.amount_paid,
                 'payment_status', pu.payment_status, 'payment_method', pu.payment_method,
                 'created_at', pu.created_at) ORDER BY pu.created_at DESC)
                 FROM purchases pu WHERE pu.buyer_contact_id = p_contact_id), '[]'::jsonb),

    'notifications', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', n.id, 'kind', n.kind, 'title', n.title,
                 'created_at', n.created_at) ORDER BY n.created_at DESC)
                 FROM notifications n WHERE v_user IS NOT NULL AND n.user_id = v_user
                 LIMIT 25), '[]'::jsonb),

    -- ── account-only: null (not empty) when there is no login, so the UI can
    --    tell "nothing here" apart from "does not apply to this person".
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

GRANT EXECUTE ON FUNCTION public.contact_dossier(uuid) TO authenticated;

COMMENT ON FUNCTION public.contact_dossier(uuid) IS
  'Everything known about one person, keyed on CONTACT so it works for the 13 of '
  '19 contacts with no account — counterparties, kiosk signers, leads and minors. '
  'The account block, posts and activity come back NULL (not empty) when there is '
  'no login, so the UI can distinguish "nothing yet" from "does not apply". '
  'Includes the guardian/dependant links, which existed in the schema and were '
  'populated but had no surface anywhere in the app.';

-- ── Editing the record ───────────────────────────────────────────────────────
-- One staff writer for the person fields, with an explicit allowlist. A patch of
-- unknown keys is refused rather than silently ignored, so a typo in a field
-- name cannot look like a successful save.
CREATE OR REPLACE FUNCTION public.update_contact_record(p_contact_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed text[] := ARRAY[
    'first_name','last_name','email','phone','mobile','whatsapp',
    'address_line1','address_line2','city','state','postal_code','country',
    'date_of_birth','notes','tags','contact_type','guardian_contact_id',
    'emergency_contact_1_name','emergency_contact_1_relationship','emergency_contact_1_phone',
    'emergency_contact_2_name','emergency_contact_2_relationship','emergency_contact_2_phone',
    'riding_experience_years','jump_experience','riding_background','jump_limitations',
    'preferred_contact','allow_sms','allow_call','allow_whatsapp','allow_whatsapp_call',
    'hide_email','hide_mobile','hide_whatsapp',
    'social_tiktok','social_instagram','social_facebook','social_linkedin'];
  k text;
  v_sets text[] := '{}';
  v_sql text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = current_org() AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (k = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'field % is not editable here', k;
    END IF;
    v_sets := v_sets || format('%I = ($1->>%L)::text', k, k);
  END LOOP;

  IF array_length(v_sets, 1) IS NULL THEN
    RETURN contact_dossier(p_contact_id);
  END IF;

  -- tags is text[], the booleans are boolean, dates are date — cast per column
  -- rather than forcing everything through text.
  v_sql := 'UPDATE contacts SET ' || array_to_string(
    ARRAY(SELECT CASE
      WHEN key = 'tags' THEN
        format('tags = CASE WHEN $1->%L = ''null''::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text($1->%L)) END', key, key)
      WHEN key IN ('allow_sms','allow_call','allow_whatsapp','allow_whatsapp_call',
                   'hide_email','hide_mobile','hide_whatsapp') THEN
        format('%I = ($1->>%L)::boolean', key, key)
      WHEN key = 'date_of_birth' THEN
        format('date_of_birth = nullif($1->>%L, '''')::date', key)
      WHEN key = 'guardian_contact_id' THEN
        format('guardian_contact_id = nullif($1->>%L, '''')::uuid', key)
      ELSE format('%I = nullif($1->>%L, '''')', key, key)
    END FROM jsonb_object_keys(p_patch) AS key), ', ')
    || ', updated_at = now() WHERE id = $2';

  EXECUTE v_sql USING p_patch, p_contact_id;
  RETURN contact_dossier(p_contact_id);
END
$function$;

GRANT EXECUTE ON FUNCTION public.update_contact_record(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_contact_record(uuid, jsonb) IS
  'Staff edit of one contact record. The patch is checked against an explicit '
  'allowlist and an unknown key RAISES rather than being skipped — a mistyped '
  'field name must not look like a successful save. Returns the fresh dossier so '
  'the caller never has to guess what landed.';
