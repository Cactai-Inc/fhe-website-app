-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTED HORSE FIELDS THAT NEVER IMPORTED ANYTHING (2026-07-31)
--
-- Auditing every field that draws from an outside record turned up five that
-- exist in the template but have NO case in generate_document's token CASE
-- statement, so they render blank no matter what the horse record holds:
--
--   HORSE.MARKINGS         horses.markings
--   HORSE.PASSPORT_NUMBER  horses.passport_number
--   HORSE.VET_ADDRESS      horses.vet_address_line1 (+ city/state/postal)
--   HORSE.VET_BUSINESS     horses.vet_business_name
--   HORSE.FAIR_MARKET_VALUE — this one IS handled; listed here because its
--                             template_tokens row is missing, see the note below.
--
-- All four unhandled columns exist on `horses` and are populated for the live
-- horse, so the data was there the whole time; nothing was reading it.
--
-- WORTH KNOWING FOR THE WIDER AUDIT: generate_document resolves HORSE.* tokens
-- from a HARDCODED CASE, not from the template_tokens table. template_tokens is
-- metadata — useful for documentation, but it is NOT what fills a contract. A
-- token can therefore be perfectly mapped there and still render empty, which is
-- exactly what happened here. Any future "is this field wired?" check has to
-- read the CASE.
-- ─────────────────────────────────────────────────────────────────────────────

-- A helper, so the address composition lives in normal SQL instead of inside a
-- string that is being injected into another function's body.
CREATE OR REPLACE FUNCTION public.compose_vet_address(
  p_line1 text, p_city text, p_state text, p_postal text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT nullif(concat_ws(', ',
           nullif(btrim(coalesce(p_line1,'')),''),
           nullif(btrim(coalesce(p_city,'')),''),
           nullif(btrim(concat_ws(' ',
             nullif(btrim(coalesce(p_state,'')),''),
             nullif(btrim(coalesce(p_postal,'')),''))),'')), '');
$fn$;

COMMENT ON FUNCTION public.compose_vet_address(text,text,text,text) IS
  'One-line vet address from its parts, skipping empties so a partial address '
  'never renders with stray separators. Mirrors compose_address() for contacts.';

DO $do$
DECLARE
  v_def text;
  v_anchor text := '        WHEN ''FAIR_MARKET_VALUE''   THEN fmt_money(v_horse.fair_market_value)';
  v_add text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_document';
  IF v_def IS NULL THEN RAISE EXCEPTION 'generate_document not found'; END IF;

  IF position('WHEN ''MARKINGS''' in v_def) > 0 THEN
    RAISE NOTICE 'horse tokens already extended — skipping';
    RETURN;
  END IF;
  IF position(v_anchor in v_def) = 0 THEN
    RAISE EXCEPTION 'generate_document CASE changed shape — re-derive the patch';
  END IF;

  -- The vet address composes from its parts, mirroring how the contact address
  -- is built, so a partial address still reads cleanly instead of printing
  -- stray commas.
  -- The vet address composes from its parts, mirroring how the contact address
  -- is built, so a partial address still reads cleanly rather than printing
  -- stray separators. Built with format() and %L placeholders: hand-escaping
  -- nested quotes inside a dollar-quoted DO block that itself writes plpgsql is
  -- how the first attempt broke.
  v_add := v_anchor || E'\n'
    || format('        WHEN %L            THEN v_horse.markings', 'MARKINGS') || E'\n'
    || format('        WHEN %L     THEN v_horse.passport_number', 'PASSPORT_NUMBER') || E'\n'
    || format('        WHEN %L        THEN v_horse.vet_business_name', 'VET_BUSINESS') || E'\n'
    || format('        WHEN %L         THEN compose_vet_address(v_horse.vet_address_line1, v_horse.vet_city, v_horse.vet_state, v_horse.vet_postal)', 'VET_ADDRESS');

  EXECUTE replace(v_def, v_anchor, v_add);
  RAISE NOTICE 'generate_document now fills MARKINGS, PASSPORT_NUMBER, VET_BUSINESS and VET_ADDRESS';
END
$do$;
