-- Offering-attachment spine — reconcile admin_create_client onto the standing
-- category source of truth.
--
-- Before: admin_create_client wrote categories ONLY to contacts.tags — accounts
-- made via the AccountInvitePage never got standing contact_roles or
-- category-derived onboarding documents.
--
-- After: it also normalizes the account categories to the standing set
-- (Guest/Rider/Horse Owner → GUEST/RIDER/HORSE_OWNER), writes them to
-- contact_roles (the source of truth the doc engine + nav read), and materializes
-- the onboarding documents via apply_category_documents — same as the invite
-- spine. tags are still mirrored for backward-compatible display.

CREATE OR REPLACE FUNCTION public.admin_create_client(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text    DEFAULT NULL,
  p_categories text[]  DEFAULT '{}'
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_client  uuid;
  v_roles   text[];
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  -- Map display category strings to standing role tokens. Only the three
  -- account categories become standing roles; anything else stays a tag only.
  SELECT array_agg(DISTINCT tok)
    INTO v_roles
    FROM (
      SELECT CASE lower(btrim(c))
               WHEN 'guest'       THEN 'GUEST'
               WHEN 'rider'       THEN 'RIDER'
               WHEN 'horse owner' THEN 'HORSE_OWNER'
               ELSE NULL END AS tok
        FROM unnest(coalesce(p_categories, '{}')) c
    ) m
   WHERE tok IS NOT NULL;

  SELECT id INTO v_contact FROM contacts
   WHERE lower(email) = lower(trim(p_email)) AND deleted_at IS NULL
   LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (first_name, last_name, email, phone, tags)
    VALUES (nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''),
            lower(trim(p_email)), nullif(trim(p_phone), ''), coalesce(p_categories, '{}'))
    RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
      first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
      last_name  = coalesce(nullif(trim(p_last_name), ''), last_name),
      phone      = coalesce(nullif(trim(p_phone), ''), phone),
      tags = (SELECT coalesce(array_agg(DISTINCT t), '{}')
                FROM unnest(coalesce(tags, '{}') || coalesce(p_categories, '{}')) t),
      updated_at = now()
    WHERE id = v_contact;
  END IF;

  SELECT id INTO v_client FROM clients
   WHERE contact_id = v_contact AND deleted_at IS NULL LIMIT 1;
  IF v_client IS NULL THEN
    INSERT INTO clients (contact_id, status, source)
    VALUES (v_contact, 'ACTIVE', 'staff created')
    RETURNING id INTO v_client;
  END IF;

  -- Standing categories → contact_roles (source of truth), then materialize
  -- the onboarding documents from them — same spine as provisioning.
  IF v_roles IS NOT NULL AND array_length(v_roles, 1) IS NOT NULL THEN
    INSERT INTO contact_roles (contact_id, role_type)
    SELECT v_contact, r FROM unnest(v_roles) r
    ON CONFLICT ON CONSTRAINT contact_roles_contact_id_role_type_key DO NOTHING;
    PERFORM apply_category_documents(v_contact);
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$function$;
