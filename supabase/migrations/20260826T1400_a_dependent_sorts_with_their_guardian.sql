-- A DEPENDENT SORTS WITH THEIR GUARDIAN.
--
-- Owner, 2026-08-26: "yes first name alphabetised is good, the one thing to
-- create a special rule for is dependents, they need to be shown together, if
-- that means you need to use last name instead of first to implement an easy
-- solution for that, im ok with it."
--
-- ⚠️ LAST NAME WOULD NOT ACTUALLY SOLVE IT, so this does not take him up on the
-- offer. A dependent does not reliably share a guardian's surname — remarriage,
-- a parent who kept their own name, a step-parent — so surname order groups
-- families only by luck, and it would cost the first-name ordering he just said
-- he wants.
--
-- What groups them is the GUARDIAN LINK, which is already the authority every
-- other guardian path trusts. So each contact carries a FAMILY SORT KEY: their
-- own name normally, and their GUARDIAN's name when they have one. Sorting by
-- that key puts a dependent immediately after the person responsible for them,
-- with the ordinary first-name ordering everywhere else, untouched.
--
--   Brian Olenik          family key "brian olenik"      ← guardian, own name
--   Gabriella Olenik      family key "brian olenik"      ← dependent, HIS name
--
-- The second sort term is the dependent flag, so the guardian always leads their
-- own group; the third is the person's own name, so siblings are alphabetical
-- among themselves.
--
-- ⚠️ THE KEY IS STORED, NOT COMPUTED PER READ. Four separate list readers already
-- do `.order('first_name').order('last_name')` through the Supabase query builder,
-- which cannot express a self-join — and a fifth reader written next month would
-- have to know to. One column, maintained by trigger, and every reader present and
-- future gets the grouping by ordering on it.

BEGIN;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS family_sort_key text;

CREATE OR REPLACE FUNCTION public._contact_sort_name(p_first text, p_last text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT lower(btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')));
$function$;

CREATE OR REPLACE FUNCTION public.trg_contacts_family_sort_key()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_key text;
BEGIN
  IF NEW.guardian_contact_id IS NOT NULL THEN
    SELECT _contact_sort_name(g.first_name, g.last_name) INTO v_key
      FROM contacts g WHERE g.id = NEW.guardian_contact_id;
  END IF;
  -- A dangling guardian id must not sort someone to the very front under an
  -- empty key: fall back to their own name.
  NEW.family_sort_key := coalesce(nullif(v_key, ''), _contact_sort_name(NEW.first_name, NEW.last_name));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contacts_family_sort_key_trg ON public.contacts;
CREATE TRIGGER contacts_family_sort_key_trg
  BEFORE INSERT OR UPDATE OF first_name, last_name, guardian_contact_id ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION trg_contacts_family_sort_key();

-- ⚠️ AND THE CASCADE. Renaming a GUARDIAN has to move their dependents with them,
-- or the family silently splits — the exact failure this column exists to stop.
CREATE OR REPLACE FUNCTION public.trg_contacts_cascade_family_key()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF (coalesce(NEW.first_name,'') IS DISTINCT FROM coalesce(OLD.first_name,''))
     OR (coalesce(NEW.last_name,'') IS DISTINCT FROM coalesce(OLD.last_name,'')) THEN
    UPDATE contacts d
       SET family_sort_key = _contact_sort_name(NEW.first_name, NEW.last_name)
     WHERE d.guardian_contact_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS contacts_cascade_family_key_trg ON public.contacts;
CREATE TRIGGER contacts_cascade_family_key_trg
  AFTER UPDATE OF first_name, last_name ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION trg_contacts_cascade_family_key();

-- Backfill: guardians first so dependents read a settled key.
UPDATE contacts SET family_sort_key = _contact_sort_name(first_name, last_name)
 WHERE guardian_contact_id IS NULL;
UPDATE contacts c SET family_sort_key = coalesce(
    nullif(_contact_sort_name(g.first_name, g.last_name), ''),
    _contact_sort_name(c.first_name, c.last_name))
  FROM contacts g WHERE g.id = c.guardian_contact_id;

CREATE INDEX IF NOT EXISTS contacts_family_sort_idx
  ON public.contacts (family_sort_key, (guardian_contact_id IS NOT NULL), first_name, last_name);

COMMIT;
