-- ─────────────────────────────────────────────────────────────────────────────
-- PERSON CONSOLIDATION — S7: one name, and a gate for the ambiguous ones
-- (2026-07-30, owner-approved)
--
-- The last duplicated person field. `contacts` and `profiles` each carried
-- first_name/last_name — four fields for one person — and 2 of 6 linked pairs
-- disagreed:
--
--   Claire  contacts 'B'          vs profiles 'Bourdon'
--   Sarah   contacts 'Rosengard'  vs profiles 'Morgan'
--
-- These two are NOT the same kind of problem, and treating them the same would
-- have been the mistake:
--
--   • Claire's 'B' is an abbreviation of 'Bourdon'. One is a truncation of the
--     other, so consolidating loses nothing. Resolved silently.
--
--   • Sarah's are two DIFFERENT surnames. The evidence is one-sided but not
--     conclusive about her intent: she signed SIX executed documents as "Sarah
--     Morgan" on 2026-07-10 — typed by her, in her own hand — while "Rosengard"
--     appears nowhere except her contact record and her email address
--     (sarahrosengard@gmail.com), which is very likely where it was derived from
--     at provisioning.
--
--     That is enough to distrust "Rosengard", but NOT enough to assert "Morgan"
--     is her current legal surname — a maiden/married pair is exactly the case
--     where guessing puts a wrong name on a contract. So per the owner: blank it
--     and have her supply it herself.
--
-- The executed documents are untouched and remain valid. A name correction never
-- rewrites signed evidence — those six documents record what she typed on the
-- day she signed, which is the point of a signature.
--
-- profiles.first_name/last_name are NOT dropped here: several staff surfaces
-- still read them and admin_client_overview returns them. This migration makes
-- `contacts` authoritative and keeps profiles as a synchronised mirror, so the
-- drop can happen later without a second data decision.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Flag: this person's name needs their own confirmation ────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS name_needs_confirmation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN contacts.name_needs_confirmation IS
  'TRUE when we cannot safely assert this person''s legal name and they must '
  'supply it before filling a form or signing anything. Set when two sources '
  'disagreed irreconcilably (not a mere abbreviation) — the alternative was to '
  'guess, and a guessed surname on an executed contract is not recoverable. '
  'Cleared the moment they confirm.';

-- ── 2. Claire: abbreviation → full name. Silent, nothing is lost ────────────
UPDATE contacts c SET last_name = p.last_name, updated_at = now()
  FROM profiles p
 WHERE p.contact_id = c.id
   AND c.deleted_at IS NULL
   AND nullif(trim(coalesce(c.last_name,'')),'') IS NOT NULL
   AND nullif(trim(coalesce(p.last_name,'')),'') IS NOT NULL
   AND c.last_name IS DISTINCT FROM p.last_name
   -- one is a prefix of the other, case-insensitively → an abbreviation
   AND (lower(p.last_name) LIKE lower(c.last_name) || '%'
     OR lower(c.last_name) LIKE lower(p.last_name) || '%');

-- ── 3. Genuine conflicts: blank the surname, flag for their own input ───────
-- Only rows that still disagree after step 2 — i.e. two different names, not a
-- truncation. Today this is Sarah alone.
WITH conflicted AS (
  SELECT c.id
    FROM contacts c JOIN profiles p ON p.contact_id = c.id
   WHERE c.deleted_at IS NULL
     AND nullif(trim(coalesce(c.last_name,'')),'') IS NOT NULL
     AND nullif(trim(coalesce(p.last_name,'')),'') IS NOT NULL
     AND lower(trim(c.last_name)) IS DISTINCT FROM lower(trim(p.last_name))
)
UPDATE contacts c
   SET last_name = NULL,
       name_needs_confirmation = true,
       notes = concat_ws(E'\n', nullif(c.notes,''),
                 'Name conflict 2026-07-30: two different surnames were on file '
                 || '(contact vs account). Blanked rather than guessed — the member '
                 || 'supplies their legal surname before their next form or signature. '
                 || 'Previously executed documents are unaffected and remain valid.'),
       updated_at = now()
  FROM conflicted x
 WHERE c.id = x.id;

-- ── 4. Keep profiles in step, and make contacts authoritative ──────────────
-- profiles becomes a MIRROR: the community surfaces read it, but it never
-- diverges again because contacts drives it.
CREATE OR REPLACE FUNCTION public.sync_profile_name_from_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
    UPDATE profiles
       SET first_name = NEW.first_name,
           last_name  = NEW.last_name,
           updated_at = now()
     WHERE contact_id = NEW.id;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS sync_profile_name_from_contact_trg ON contacts;
CREATE TRIGGER sync_profile_name_from_contact_trg
  AFTER UPDATE OF first_name, last_name ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_name_from_contact();

COMMENT ON FUNCTION public.sync_profile_name_from_contact() IS
  'contacts is authoritative for the legal name; profiles mirrors it so the two '
  'can never diverge again (they had, for 2 of 6 linked pairs). The community '
  'PERSONA — display_name, avatar_url, bio — is separate and deliberately not '
  'touched: a member may show "CJ" while their contracts read "Charles Zigmund".';

-- ── 5. The confirm RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_my_legal_name(p_first text, p_last text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_first text := nullif(trim(coalesce(p_first,'')),'');
  v_last  text := nullif(trim(coalesce(p_last,'')),'');
BEGIN
  IF v_contact IS NULL THEN RAISE EXCEPTION 'no contact record for this account'; END IF;
  IF v_first IS NULL OR v_last IS NULL THEN
    RAISE EXCEPTION 'both a first and a last name are required';
  END IF;

  UPDATE contacts
     SET first_name = v_first,
         last_name  = v_last,
         name_needs_confirmation = false,
         updated_at = now()
   WHERE id = v_contact;
END
$function$;

COMMENT ON FUNCTION public.confirm_my_legal_name(text, text) IS
  'The member states their own legal name, clearing the confirmation gate. This '
  'is the ONLY way the flag is cleared — staff cannot confirm on someone''s '
  'behalf, because the whole point is that we could not safely assert it.';

GRANT EXECUTE ON FUNCTION public.confirm_my_legal_name(text, text) TO authenticated;

-- ── 6. Expose the flag to the app ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_name_confirmation_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_needs boolean; v_first text; v_last text;
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN
    RETURN jsonb_build_object('needs_confirmation', false);
  END IF;
  SELECT name_needs_confirmation, first_name, last_name
    INTO v_needs, v_first, v_last
    FROM contacts WHERE id = v_contact;
  RETURN jsonb_build_object(
    'needs_confirmation', coalesce(v_needs, false),
    'first_name', v_first,
    'last_name', v_last);
END
$function$;

GRANT EXECUTE ON FUNCTION public.my_name_confirmation_state() TO authenticated;

-- ── 7. The hard backstop on signing ────────────────────────────────────────
-- The UI gate is the friendly half; this is the one that cannot be deep-linked
-- past. Mirrors the document-before-contract guard installed on 2026-07-29.
DO $do$
DECLARE
  v_def text;
  v_anchor text := '  -- DOCUMENT-BEFORE-CONTRACT (2026-07-29)';
  v_guard text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'record_signature'
     AND pg_get_function_identity_arguments(p.oid)
         = 'p_document_id uuid, p_party_role text, p_typed_name text, p_ip text, p_user_agent text, p_esign_consent boolean';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'record_signature not found — cannot install the name guard';
  END IF;
  IF position('NAME-BEFORE-SIGNATURE' in v_def) > 0 THEN
    RAISE NOTICE 'record_signature already carries the name guard — skipping';
    RETURN;
  END IF;
  IF position(v_anchor in v_def) = 0 THEN
    RAISE EXCEPTION 'record_signature body changed shape — re-derive the name guard';
  END IF;

  v_guard :=
    '  -- NAME-BEFORE-SIGNATURE (2026-07-30): a party whose legal name we could' || E'\n' ||
    '  -- not safely assert must state it before signing anything. Signing with a' || E'\n' ||
    '  -- guessed surname produces a contract naming the wrong person.' || E'\n' ||
    '  IF EXISTS (SELECT 1 FROM contacts WHERE id = v_signer' || E'\n' ||
    '               AND coalesce(name_needs_confirmation, false)) THEN' || E'\n' ||
    '    RAISE EXCEPTION ''cannot sign: please confirm your legal name first'';' || E'\n' ||
    '  END IF;' || E'\n\n';

  EXECUTE replace(v_def, v_anchor, v_guard || v_anchor);
  RAISE NOTICE 'record_signature: name-before-signature guard installed';
END
$do$;
