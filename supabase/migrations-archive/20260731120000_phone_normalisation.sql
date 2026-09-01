-- ─────────────────────────────────────────────────────────────────────────────
-- PHONE NUMBERS: ONE FORMAT, SET AT THE SOURCE (2026-07-31)
--
-- THE SYMPTOM. On a live lease the company's phone reads "(858) 439-3614" while
-- the Lessor's reads "6178384183" — ten bare digits.
--
-- THE CAUSE, traced end to end:
--   • {{FHE.PHONE}} resolves to brand.phone_display, a column that already holds
--     a HAND-FORMATTED string. It looks right by accident of data entry.
--   • Every party token ({{LESSOR.PHONE}}, {{PARTY.PHONE}}, …) resolves to
--     contacts.phone, and fill_party_fields_from_contacts copies that column
--     VERBATIM into the contract field.
--   • Nothing normalises contacts.phone on the way in. 14 of 15 stored numbers
--     are bare digits; the one exception is the company row someone typed by hand.
--
-- So the contract is faithfully reproducing what is stored. Formatting the
-- contract would be treating the symptom — the number is wrong everywhere it is
-- displayed, not only there.
--
-- THE FIX. Normalise at the SOURCE, so every reader inherits it without knowing
-- anything about phone numbers: the contract, the dossier, the directory, emails.
-- A number typed in any shape lands stored as (XXX) XXX-XXXX, and the existing
-- rows are backfilled.
--
-- EXTENSIONS. There was no column for one anywhere — a person with "x412" had
-- nowhere to put it and would have jammed it into the number itself, which is
-- exactly what breaks normalisation. Added as its own field and appended to the
-- display form when present, so "(858) 439-3614 ext. 412" composes correctly and
-- the raw number stays clean for dialling.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The formatter ────────────────────────────────────────────────────────
-- Deliberately conservative: it only reformats what it RECOGNISES as a NANP
-- number. Anything else (an international number, a partial entry, a note) is
-- returned trimmed but otherwise untouched — mangling a number we do not
-- understand would be worse than leaving it alone.
CREATE OR REPLACE FUNCTION public.format_phone(p_raw text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_digits text;
BEGIN
  IF p_raw IS NULL OR trim(p_raw) = '' THEN RETURN NULL; END IF;
  v_digits := regexp_replace(p_raw, '\D', '', 'g');

  -- 11 digits starting with the US country code: drop the 1.
  IF length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN
    v_digits := substr(v_digits, 2);
  END IF;

  IF length(v_digits) = 10 THEN
    RETURN '(' || substr(v_digits, 1, 3) || ') '
                || substr(v_digits, 4, 3) || '-'
                || substr(v_digits, 7, 4);
  END IF;

  RETURN trim(p_raw);   -- not a NANP number — leave it as the person wrote it
END
$function$;

COMMENT ON FUNCTION public.format_phone(text) IS
  'Normalises a NANP number to (XXX) XXX-XXXX, tolerating any input shape and '
  'stripping a leading US country code. Anything it does not recognise as a '
  '10-digit number is returned trimmed and otherwise UNCHANGED — an international '
  'or partial number must not be mangled into a plausible-looking wrong one.';

-- ── 2. The extension ────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_ext  text,
  ADD COLUMN IF NOT EXISTS mobile_ext text;

COMMENT ON COLUMN contacts.phone_ext IS
  'Extension for `phone`, stored separately so the number itself stays clean and '
  'dialable. Composed into the display form as "(858) 439-3614 ext. 412".';

-- ── 3. Display forms, generated so they can never drift ─────────────────────
-- A generated column cannot be written directly and is recomputed on every
-- change, so a formatted value and its parts can never disagree — the same
-- reasoning as contacts.address_composed.
ALTER TABLE contacts
  DROP COLUMN IF EXISTS phone_display,
  DROP COLUMN IF EXISTS mobile_display;

ALTER TABLE contacts
  ADD COLUMN phone_display text
    GENERATED ALWAYS AS (
      CASE WHEN phone IS NULL OR trim(phone) = '' THEN NULL
           ELSE format_phone(phone)
                || CASE WHEN phone_ext IS NULL OR trim(phone_ext) = '' THEN ''
                        ELSE ' ext. ' || trim(phone_ext) END
      END) STORED,
  ADD COLUMN mobile_display text
    GENERATED ALWAYS AS (
      CASE WHEN mobile IS NULL OR trim(mobile) = '' THEN NULL
           ELSE format_phone(mobile)
                || CASE WHEN mobile_ext IS NULL OR trim(mobile_ext) = '' THEN ''
                        ELSE ' ext. ' || trim(mobile_ext) END
      END) STORED;

COMMENT ON COLUMN contacts.phone_display IS
  'THE reading form of the phone number, generated from phone + phone_ext. Every '
  'surface that SHOWS a number should read this; `phone` is the storage form. '
  'Generated, so it cannot fall out of step with its parts.';

-- ── 4. Normalise what is stored, on write ───────────────────────────────────
-- The display column would format the output either way, but leaving the raw
-- column ragged means every direct reader (exports, the contract fill, a future
-- integration) still sees ten bare digits. Normalise the storage too.
CREATE OR REPLACE FUNCTION public.contacts_normalise_phone()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.phone  := format_phone(NEW.phone);
  NEW.mobile := format_phone(NEW.mobile);
  NEW.phone_ext  := nullif(regexp_replace(coalesce(NEW.phone_ext, ''),  '\D', '', 'g'), '');
  NEW.mobile_ext := nullif(regexp_replace(coalesce(NEW.mobile_ext, ''), '\D', '', 'g'), '');
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS contacts_normalise_phone_trg ON contacts;
CREATE TRIGGER contacts_normalise_phone_trg
  BEFORE INSERT OR UPDATE OF phone, mobile, phone_ext, mobile_ext ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_normalise_phone();

-- ── 5. Backfill the 14 ragged rows ──────────────────────────────────────────
UPDATE contacts
   SET phone = format_phone(phone), mobile = format_phone(mobile)
 WHERE (phone IS NOT NULL AND phone <> format_phone(phone))
    OR (mobile IS NOT NULL AND mobile <> format_phone(mobile));

-- ── 6. The contract reads the DISPLAY form ──────────────────────────────────
-- fill_party_fields_from_contacts copied c.phone verbatim. Pointing it at
-- phone_display means a contract shows the same string as every other surface,
-- and picks up the extension for free.
DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fill_party_fields_from_contacts';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'fill_party_fields_from_contacts not found';
  END IF;

  IF position('c.phone_display' in v_def) > 0 THEN
    RAISE NOTICE 'party fill already reads phone_display — skipping';
  ELSE
    IF position('c.email, c.phone,' in v_def) = 0 THEN
      RAISE EXCEPTION 'party fill body changed shape — re-derive the patch';
    END IF;
    EXECUTE replace(v_def, 'c.email, c.phone,', 'c.email, c.phone_display AS phone,');
    RAISE NOTICE 'party fill now reads phone_display';
  END IF;
END
$do$;

-- ── 7. Re-fill the phone on every live contract ─────────────────────────────
-- Without this the change only reaches contracts created from now on, and the
-- owner's sample lease would still show the old string. Only PHONE fields on
-- documents that are still editable are touched — an executed document is
-- evidence of what was agreed and is never rewritten.
UPDATE contract_fields cf
   SET value = c.phone_display
  FROM documents d
  JOIN contract_parties cp ON cp.contract_id = d.contract_id
  JOIN contacts c ON c.id = cp.contact_id
 WHERE cf.document_id = d.id
   AND d.status <> 'EXECUTED'
   AND d.deleted_at IS NULL
   AND cf.field_key = cp.party_role || '.PHONE'
   AND c.phone_display IS NOT NULL
   AND cf.value IS DISTINCT FROM c.phone_display;
-- Allow the new extension columns through the contact-record writer. Without
-- this the dossier's "Phone ext." field would RAISE on save: the allowlist
-- deliberately refuses unknown keys rather than skipping them, which is what
-- made this omission visible immediately instead of silently discarding input.
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='update_contact_record';
  IF position('phone_ext' in v_def) > 0 THEN
    RAISE NOTICE 'already allowlisted — skipping';
  ELSE
    EXECUTE replace(v_def,
      '''first_name'',''last_name'',''email'',''phone'',''mobile'',''whatsapp'',',
      '''first_name'',''last_name'',''email'',''phone'',''phone_ext'',''mobile'',''mobile_ext'',''whatsapp'',');
    RAISE NOTICE 'phone_ext / mobile_ext allowlisted';
  END IF;
END $do$;
