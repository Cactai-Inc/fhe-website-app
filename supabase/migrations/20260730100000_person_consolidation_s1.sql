-- ─────────────────────────────────────────────────────────────────────────────
-- PERSON CONSOLIDATION — STAGE 1: contacts becomes the single person record
-- (2026-07-30, owner-approved. Full spec: docs/archive/PERSON_DATA_CONSOLIDATION.md)
--
-- WHY: a person's data lives on two tables and the app cannot agree which is
-- real. The reported symptom: a member enters their address on the app profile
-- page, it vanishes from that page, then reappears inside a contract. The
-- profile page writes `profiles`; contracts read `contacts`; and the five
-- `profiles` address columns have ZERO writers (0/7 populated, vs 12/16 on
-- contacts).
--
-- DIRECTION: onto `contacts`, not `profiles`. 10 of 16 contacts have no login at
-- all (leads, counterparties, kiosk signers) and could not survive a move onto
-- an auth-bridged table; and admin@cactai.io is deliberately an account with NO
-- contact (D1 — the platform owner holds zero tenant rows). The tables are not
-- 1:1 and cannot be.
--
-- THIS STAGE IS PURELY ADDITIVE. No column is dropped and no reader is
-- re-pointed here — that is S2/S6. Applying this alone changes no behaviour, so
-- it is safe to land ahead of the frontend work.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Reach / contact-preference columns ────────────────────────────────────
-- `contacts` has only `phone`. These are the rest of "how do we reach this
-- person", which today sit on profiles and are therefore unavailable for the 10
-- people who have no account.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS mobile              text,
  ADD COLUMN IF NOT EXISTS whatsapp            text,
  ADD COLUMN IF NOT EXISTS preferred_contact   text,
  ADD COLUMN IF NOT EXISTS allow_sms           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_call          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_whatsapp      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_whatsapp_call boolean NOT NULL DEFAULT false;

-- ── 2. Community visibility flags ────────────────────────────────────────────
-- NOTE (honesty, carried from the audit): these three are currently DECORATIVE.
-- No DB function reads them and there is no member-directory surface that
-- exposes contact details, so today they protect nothing. They are moved here so
-- the person record owns them, but S5 must either enforce them against a real
-- directory or remove them from the UI. A privacy toggle that does nothing is
-- worse than none, because it implies a protection that is not there.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS hide_email    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_mobile   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_whatsapp boolean NOT NULL DEFAULT false;

-- ── 3. Socials ───────────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS social_tiktok    text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook  text,
  ADD COLUMN IF NOT EXISTS social_linkedin  text;

-- ── 4. Backfill from profiles — FILL-WHEN-BLANK ONLY ─────────────────────────
-- contacts is authoritative: we only fill where contacts has nothing and the
-- linked profile has something. Live data already disagrees between the two
-- tables (2 of 6 linked pairs differ on last_name, 2 on phone), so an
-- overwrite would silently pick the wrong side. Never overwrite.
UPDATE contacts c SET
  mobile              = coalesce(c.mobile, p.mobile),
  whatsapp            = coalesce(c.whatsapp, p.whatsapp),
  preferred_contact   = coalesce(c.preferred_contact, p.preferred_contact),
  allow_sms           = c.allow_sms           OR coalesce(p.allow_sms, false),
  allow_call          = c.allow_call          OR coalesce(p.allow_call, false),
  allow_whatsapp      = c.allow_whatsapp      OR coalesce(p.allow_whatsapp, false),
  allow_whatsapp_call = c.allow_whatsapp_call OR coalesce(p.allow_whatsapp_call, false),
  hide_email          = c.hide_email          OR coalesce(p.hide_email, false),
  hide_mobile         = c.hide_mobile         OR coalesce(p.hide_mobile, false),
  hide_whatsapp       = c.hide_whatsapp       OR coalesce(p.hide_whatsapp, false),
  social_tiktok       = coalesce(c.social_tiktok, p.social_tiktok),
  social_instagram    = coalesce(c.social_instagram, p.social_instagram),
  social_facebook     = coalesce(c.social_facebook, p.social_facebook),
  social_linkedin     = coalesce(c.social_linkedin, p.social_linkedin),
  -- The address: contacts is already the populated side (12/16 vs 0/7), so this
  -- is a no-op in practice. Kept for completeness and for any future tenant
  -- whose profiles rows DID get an address before the split was understood.
  address_line1 = coalesce(c.address_line1, p.address_line1),
  address_line2 = coalesce(c.address_line2, p.address_line2),
  city          = coalesce(c.city, p.city),
  state         = coalesce(c.state, p.state),
  postal_code   = coalesce(c.postal_code, p.postal_code),
  updated_at    = now()
FROM profiles p
WHERE p.contact_id = c.id AND c.deleted_at IS NULL;

-- ── 5. contact_type — the person-page discriminator ──────────────────────────
-- All 16 rows are currently NULL. This becomes the explicit classification that
-- replaces the leftover-derived "Lead" (ContactsPage.tsx:51 pushes 'Lead' only
-- when NOTHING else classified the row — which is why the Leads page is not the
-- campaign list it should be).
--
--   CLIENT      — has a clients row, or a linked account with role='USER'
--   PROSPECT    — captured from inbound, not yet converted (the campaign list)
--   EXTERNAL    — vendor / vet / farrier / counterparty: the rolodex
--   COMPANY     — an organisation, not a person (is_company)
--   TEAM        — linked account with a staff role
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_type_check;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IS NULL
         OR contact_type IN ('CLIENT','PROSPECT','EXTERNAL','COMPANY','TEAM'));

-- Seed from what is already provable. Deliberately conservative: anything we
-- cannot classify from evidence stays NULL rather than being guessed into a
-- bucket, so S4 surfaces it for a human decision instead of silently mislabelling.
UPDATE contacts c SET contact_type = 'COMPANY'
 WHERE c.deleted_at IS NULL AND coalesce(c.is_company,false) AND c.contact_type IS NULL;

-- TEAM before CLIENT, and matched on the ORG STAFF IDENTITIES too: the D1
-- production identities (admin@ / hello@ fhequestrian.com) carry a `clients` row
-- from earlier provisioning, so a clients-row test alone would mislabel staff as
-- CLIENT. Role first, then the known org addresses.
UPDATE contacts c SET contact_type = 'TEAM'
 WHERE c.deleted_at IS NULL AND c.contact_type IS NULL
   AND (EXISTS (SELECT 1 FROM profiles p
                 WHERE p.contact_id = c.id AND p.role IS NOT NULL AND p.role <> 'USER')
     OR lower(c.email) IN ('admin@fhequestrian.com','hello@fhequestrian.com'));

UPDATE contacts c SET contact_type = 'CLIENT'
 WHERE c.deleted_at IS NULL AND c.contact_type IS NULL
   AND (EXISTS (SELECT 1 FROM clients cl WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL)
     OR EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.role = 'USER'));

COMMENT ON COLUMN contacts.contact_type IS
  'The person-page discriminator: CLIENT | PROSPECT | EXTERNAL | COMPANY | TEAM. '
  'Explicit and settable — it replaces the old leftover-derived "Lead", which was '
  'assigned only when no other designation matched and therefore never formed a '
  'usable campaign list. NULL means unclassified: surfaced for a human decision, '
  'never silently bucketed.';

COMMENT ON TABLE contacts IS
  'THE person record — the single home for everything we know about a human or '
  'organisation, whether or not they have a login. `profiles` is the ACCOUNT '
  '(auth bridge, role, community persona, tour markers) and holds nothing about '
  'the person. Onboarding, the website form, the app profile page and every staff '
  'surface all read and write HERE.';
