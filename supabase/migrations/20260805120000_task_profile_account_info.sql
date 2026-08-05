-- TASK-PROFILE: Account Information (internal-only) fields for the consolidated
-- Profile & Preferences page (docs/tasks/TASK-PROFILE-account-restructure.md).
--
-- All new columns live on `contacts` (person-facts, per the owner's identity
-- taxonomy) and are internal-only BY CONSTRUCTION: `contacts_select` RLS only
-- permits an own-row read (`id = current_contact_id()`) or `is_admin()` (staff).
-- This migration does not touch `member_directory`, so none of these columns
-- are reachable from the community read path.
--
-- `mobile_number` is a deliberately NEW column, not a reuse of the legacy
-- `contacts.mobile` — that column (with `hide_mobile`) predates the five-channel
-- community model (2026-08-01), is retired per the comment in src/lib/contact.ts,
-- and is STILL exposed through member_directory (gated only by a hide flag with
-- no UI to set it). Storing a new internal-only fact there would leak it to the
-- community the moment it's populated. See TASK-PROFILE-REPORT.md for detail.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS texts_phone text,
  ADD COLUMN IF NOT EXISTS correspondence_email text,
  ADD COLUMN IF NOT EXISTS zelle_phone text,
  ADD COLUMN IF NOT EXISTS zelle_email text,
  ADD COLUMN IF NOT EXISTS staff_preferred_contact text NOT NULL DEFAULT 'none';

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_staff_preferred_contact_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_staff_preferred_contact_check
  CHECK (staff_preferred_contact IN ('none', 'phone_call', 'text', 'email'));

-- Keep the new phone-shaped columns in the same normalised-storage format as
-- every other phone column, via the existing generic multi-column normaliser
-- (already used for the emergency-contact phones) rather than editing
-- contacts_normalise_phone()'s body.
DROP TRIGGER IF EXISTS contacts_normalise_account_info_phone_trg ON public.contacts;
CREATE TRIGGER contacts_normalise_account_info_phone_trg
  BEFORE INSERT OR UPDATE OF mobile_number, texts_phone, zelle_phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION normalise_phone_columns('mobile_number', 'texts_phone', 'zelle_phone');

-- C10 (contacts_minor_no_email_guard): a minor contact must not carry a direct
-- personal email under EITHER name — extend the existing guard to also cover
-- correspondence_email. The trigger has no `OF` column list (fires on every
-- INSERT/UPDATE already), so no trigger-definition change is needed, only the
-- function body.
CREATE OR REPLACE FUNCTION public.contacts_minor_no_email_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.date_of_birth IS NOT NULL
     AND NEW.date_of_birth + interval '18 years' > current_date
     AND (NEW.email IS NOT NULL OR NEW.correspondence_email IS NOT NULL)
  THEN
    RAISE EXCEPTION 'a minor contact carries no direct email; put the address on the guardian record';
  END IF;
  RETURN NEW;
END;
$function$;
