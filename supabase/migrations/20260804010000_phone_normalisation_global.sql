-- GLOBAL phone normalisation (owner directive 2026-08-04).
--
-- 20260731120000 introduced format_phone() + a normalising trigger, but wired
-- it to contacts ONLY — and only to that table's own phone/mobile family. Every
-- other phone in the system stayed however it was typed, which is why an
-- account phone rendered "(617) 838-4183" on a contract while the same horse's
-- vet and farrier rendered "8003331234" right above it.
--
-- This makes normalisation a property of the DATA MODEL rather than of one
-- table: one shared trigger function, driven by a registry of
-- (table, column) pairs, attached to every table that stores a phone number.
-- Adding a phone column later means adding one row's worth of arguments here,
-- not writing another trigger.

-- The generic normaliser: formats every column named in TG_ARGV.
CREATE OR REPLACE FUNCTION public.normalise_phone_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_col text;
  v_val text;
BEGIN
  FOREACH v_col IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT ($1).%I::text', v_col) INTO v_val USING NEW;
    IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
      NEW := jsonb_populate_record(NEW, to_jsonb(NEW) || jsonb_build_object(v_col, format_phone(v_val)));
    END IF;
  END LOOP;
  RETURN NEW;
END
$function$;

-- horses: vet + farrier (the pair that surfaced this)
DROP TRIGGER IF EXISTS horses_normalise_phone_trg ON public.horses;
CREATE TRIGGER horses_normalise_phone_trg
  BEFORE INSERT OR UPDATE OF vet_phone, farrier_phone ON public.horses
  FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_columns('vet_phone', 'farrier_phone');

-- contacts: the emergency-contact pair the original migration missed
-- (its own trigger still owns phone/mobile/whatsapp — left untouched).
DROP TRIGGER IF EXISTS contacts_normalise_ec_phone_trg ON public.contacts;
CREATE TRIGGER contacts_normalise_ec_phone_trg
  BEFORE INSERT OR UPDATE OF emergency_contact_1_phone, emergency_contact_2_phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_columns('emergency_contact_1_phone', 'emergency_contact_2_phone');

-- vendors (directory), requests (public intake), horse_medications (supplier)
DROP TRIGGER IF EXISTS vendors_normalise_phone_trg ON public.vendors;
CREATE TRIGGER vendors_normalise_phone_trg
  BEFORE INSERT OR UPDATE OF phone ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_columns('phone');

DROP TRIGGER IF EXISTS requests_normalise_phone_trg ON public.requests;
CREATE TRIGGER requests_normalise_phone_trg
  BEFORE INSERT OR UPDATE OF contact_phone ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_columns('contact_phone');

DROP TRIGGER IF EXISTS horse_medications_normalise_phone_trg ON public.horse_medications;
CREATE TRIGGER horse_medications_normalise_phone_trg
  BEFORE INSERT OR UPDATE OF supplier_phone ON public.horse_medications
  FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_columns('supplier_phone');

-- Backfill every existing row through the same function (idempotent: a value
-- already in canonical form formats to itself; a non-NANP value is returned
-- unchanged rather than mangled).
UPDATE horses SET vet_phone = format_phone(vet_phone)
 WHERE vet_phone IS NOT NULL AND vet_phone IS DISTINCT FROM format_phone(vet_phone);
UPDATE horses SET farrier_phone = format_phone(farrier_phone)
 WHERE farrier_phone IS NOT NULL AND farrier_phone IS DISTINCT FROM format_phone(farrier_phone);
UPDATE contacts SET emergency_contact_1_phone = format_phone(emergency_contact_1_phone)
 WHERE emergency_contact_1_phone IS NOT NULL AND emergency_contact_1_phone IS DISTINCT FROM format_phone(emergency_contact_1_phone);
UPDATE contacts SET emergency_contact_2_phone = format_phone(emergency_contact_2_phone)
 WHERE emergency_contact_2_phone IS NOT NULL AND emergency_contact_2_phone IS DISTINCT FROM format_phone(emergency_contact_2_phone);
UPDATE vendors SET phone = format_phone(phone)
 WHERE phone IS NOT NULL AND phone IS DISTINCT FROM format_phone(phone);
UPDATE requests SET contact_phone = format_phone(contact_phone)
 WHERE contact_phone IS NOT NULL AND contact_phone IS DISTINCT FROM format_phone(contact_phone);
UPDATE horse_medications SET supplier_phone = format_phone(supplier_phone)
 WHERE supplier_phone IS NOT NULL AND supplier_phone IS DISTINCT FROM format_phone(supplier_phone);
