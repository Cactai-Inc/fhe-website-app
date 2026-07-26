-- Ecosystem Stage 2 — make derive_affiliations AUTHORITATIVE for group rows.
--
-- apply_affiliations(contact) is the SINGLE writer of the standing GROUP rows
-- (RIDER / HORSE_OWNER / PARENT_GUARDIAN) in contact_roles: it syncs them to
-- exactly what derive_affiliations() computes. It deliberately leaves the OTHER
-- role_type values alone — CLIENT (client marker), PARTICIPANT/GUARDIAN
-- (per-document roles), GUEST (legacy) — those are resolved in Stage 4's taxonomy
-- split. It also does NOT touch members/profiles, so the is_active_member gate is
-- untouched (groups are independent of the login gate).
--
-- The three former GROUP writers now delegate here instead of writing group rows
-- directly, ending the split-brain. Then a one-time backfill reconciles every
-- existing contact so state matches the derivation.

BEGIN;

-- The set of role_type values that ARE standing groups (owned by the derivation).
-- Everything else in contact_roles is left untouched.
CREATE OR REPLACE FUNCTION public._group_role_types()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY['RIDER','HORSE_OWNER','PARENT_GUARDIAN']::text[] $$;

-- Sync a contact's GROUP rows to derive_affiliations(). Sole authority for groups.
CREATE OR REPLACE FUNCTION public.apply_affiliations(p_contact_id uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_want text[] := coalesce(derive_affiliations(p_contact_id), ARRAY[]::text[]);
BEGIN
  -- add missing group rows
  INSERT INTO contact_roles (contact_id, role_type)
  SELECT p_contact_id, g FROM unnest(v_want) g
  ON CONFLICT (contact_id, role_type) DO NOTHING;

  -- remove group rows no longer derived (never touches non-group role_types)
  DELETE FROM contact_roles
   WHERE contact_id = p_contact_id
     AND role_type = ANY(_group_role_types())
     AND role_type <> ALL(v_want);

  RETURN v_want;
END;
$function$;

-- Convenience: re-derive after a document reaches EXECUTED (the natural trigger
-- point for promotion). A trigger on documents keeps groups live going forward.
CREATE OR REPLACE FUNCTION public.trg_apply_affiliations_on_doc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'EXECUTED' AND NEW.contact_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM apply_affiliations(NEW.contact_id);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS documents_apply_affiliations ON public.documents;
CREATE TRIGGER documents_apply_affiliations
  AFTER INSERT OR UPDATE OF status ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_apply_affiliations_on_doc();

-- Also re-derive when horse ownership changes (owning a horse ⇒ HORSE_OWNER).
CREATE OR REPLACE FUNCTION public.trg_apply_affiliations_on_horse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.current_owner_contact_id IS NOT NULL THEN
    PERFORM apply_affiliations(NEW.current_owner_contact_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.current_owner_contact_id IS DISTINCT FROM NEW.current_owner_contact_id
     AND OLD.current_owner_contact_id IS NOT NULL THEN
    PERFORM apply_affiliations(OLD.current_owner_contact_id);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS horses_apply_affiliations ON public.horses;
CREATE TRIGGER horses_apply_affiliations
  AFTER INSERT OR UPDATE OF current_owner_contact_id ON public.horses
  FOR EACH ROW EXECUTE FUNCTION public.trg_apply_affiliations_on_horse();

-- ── Backfill: reconcile EVERY existing contact so groups match the derivation. ──
-- This fixes the Stage-0 defects (6 riders mistagged GUEST, Sarah's missing
-- RIDER+HORSE_OWNER, etc.). Non-group roles (CLIENT/PARTICIPANT/GUARDIAN/GUEST)
-- are left exactly as they are.
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM contacts WHERE deleted_at IS NULL LOOP
    PERFORM apply_affiliations(r.id);
  END LOOP;
END $backfill$;

COMMIT;
