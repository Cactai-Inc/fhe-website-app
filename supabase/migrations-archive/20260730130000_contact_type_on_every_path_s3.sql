-- ─────────────────────────────────────────────────────────────────────────────
-- S3: EVERY contact-creating path files the person (2026-07-30)
--
-- S4 made contacts.contact_type the page discriminator, and S5 made inbound
-- capture set it to LEAD. But six other functions also create contacts, and NONE
-- of them set a type:
--
--   _ensure_client_account, admin_create_client, sign_release,
--   ensure_contact_for_profile, company_contact_id, update_my_onboarding_profile
--
-- Left alone, every staff-created client, every kiosk release signer and every
-- account promotion would land in the Unfiled banner — turning a deliberate
-- "somebody must decide this" signal into constant noise, which is exactly how a
-- warning stops being read.
--
-- Rather than patch six function bodies (brittle: they are rewritten in place by
-- other migrations), this installs ONE trigger that files a new contact from the
-- evidence available at insert time, and only when the caller did not say.
--
-- Precedence, most specific first:
--   explicitly given         → left exactly as the caller set it
--   is_company row           → TEAM. NOTE: `is_company` does NOT mean "some
--                              organisation". A partial unique index
--                              (one_company_contact_per_org) allows exactly ONE
--                              such row per org — it is the TENANT'S OWN company
--                              record (French Heritage Equestrian), which is why
--                              S1b already filed it under TEAM. Vendor
--                              organisations are ordinary rows filed DIRECTORY
--                              by staff.
--   linked to a staff role   → TEAM (applied on the profile, see below)
--   otherwise                → CONTACT (a person we serve)
--
-- Why CONTACT and not LEAD as the fallback: every one of these paths is invoked
-- when a person is ALREADY being engaged — provisioned as a client, signing a
-- release, promoted to an account. LEAD is reserved for the inbound trigger,
-- where someone has merely enquired. Defaulting these to LEAD would pad the
-- campaign list with people who are already customers.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.contacts_file_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- The caller was explicit (e.g. the inbound trigger says LEAD, or staff picked
  -- a page). Never second-guess that.
  IF NEW.contact_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- is_company is the TENANT'S OWN company record (one per org, enforced by the
  -- one_company_contact_per_org partial unique index) — not a generic vendor
  -- organisation. It belongs to TEAM.
  IF coalesce(NEW.is_company, false) THEN
    NEW.contact_type := 'TEAM';
  ELSE
    NEW.contact_type := 'CONTACT';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS contacts_file_on_insert_trg ON contacts;
CREATE TRIGGER contacts_file_on_insert_trg
  BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_file_on_insert();

COMMENT ON FUNCTION public.contacts_file_on_insert() IS
  'Files a new contact onto a person-page when the creating path did not say. '
  'An is_company row becomes TEAM — that flag marks the TENANT''S OWN company '
  'record (one per org, per the one_company_contact_per_org index), not a vendor. '
  'Everyone else becomes CONTACT, because every path reaching here is engaging a '
  'person already — provisioning a client, signing a release, promoting an '
  'account. LEAD is set only by the inbound-capture trigger, where someone has '
  'merely enquired: defaulting here to LEAD would pad the campaign list with '
  'existing customers. An explicit contact_type from the caller always wins.';

-- ── TEAM: derived, not guessed ───────────────────────────────────────────────
-- Staff are identified by their linked profile role, which does not exist yet at
-- contact-insert time (the profile is created afterwards). So file them when the
-- link is made, rather than trying to predict it above.
CREATE OR REPLACE FUNCTION public.contacts_file_team_on_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.contact_id IS NULL OR NEW.role IS NULL OR NEW.role = 'USER' THEN
    RETURN NEW;
  END IF;
  -- Only promote a contact that is not already deliberately filed elsewhere.
  UPDATE contacts
     SET contact_type = 'TEAM', updated_at = now()
   WHERE id = NEW.contact_id
     AND coalesce(contact_type, 'CONTACT') = 'CONTACT';
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS contacts_file_team_on_link_trg ON profiles;
CREATE TRIGGER contacts_file_team_on_link_trg
  AFTER INSERT OR UPDATE OF role, contact_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.contacts_file_team_on_link();

COMMENT ON FUNCTION public.contacts_file_team_on_link() IS
  'Moves a contact to TEAM when its account is given a staff role. Runs on the '
  'profile because the role does not exist at contact-insert time. Never '
  'overrides a deliberate filing — only a contact still sitting at the CONTACT '
  'default is promoted.';

-- ── Conversion: a LEAD who becomes a client stops being a campaign target ────
-- Without this the Leads page would keep advertising people who already bought.
CREATE OR REPLACE FUNCTION public.contacts_convert_lead_on_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE contacts
     SET contact_type = 'CONTACT', updated_at = now()
   WHERE id = NEW.contact_id
     AND contact_type = 'LEAD';
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS contacts_convert_lead_on_client_trg ON clients;
CREATE TRIGGER contacts_convert_lead_on_client_trg
  AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION public.contacts_convert_lead_on_client();

COMMENT ON FUNCTION public.contacts_convert_lead_on_client() IS
  'A LEAD who becomes a client moves to CONTACT automatically — the campaign list '
  'must never keep advertising someone who already bought. Only LEAD rows are '
  'converted, so a TEAM or DIRECTORY row given a client record is left alone.';
