-- TASK-FIX4 §4 · CR-83 · CR-84 §2 — the name rule, applied ONCE to `contacts`.
--
-- Owner, 2026-08-31: *"What we should be doing with name entries like Elisheva
-- fiszer, is correcting the non capitalized last name to normalize it, what we
-- should not do is change LaBuzetta to Labuzetta."*
-- And on scope: *"for the old documents, leave documents alone, just correct the
-- client records."*
--
-- ══ WHAT THIS IS NOT ═══════════════════════════════════════════════════════
--
-- ⚠️ **IT IS NOT A TRIGGER, AND MUST NEVER BECOME ONE.** CR-83's second rule is
-- the one that stops the app fighting the person: *"if the person corrects it to
-- La buzetta that is ok we shouldnt recorrect it."* A `BEFORE UPDATE` trigger
-- running this function would overwrite that correction on the very next write,
-- forever, and the person could not win. Normalisation happens **on blur, in the
-- browser, once, in front of them** (`src/lib/normalize.ts`); this file is a
-- single historical pass over rows typed before that existed.
--
-- ⚠️ **AND IT DOES NOT TOUCH `signatures`.** A signature's `typed_name` is sealed
-- evidence — `block_signed_signature_update` refuses it, by design. Four executed
-- signatures carry an uncapitalised surname (`"Brian olenik"` ×1, `"Elisheva
-- fiszer"` ×3, signed 2026-07-14 and 2026-07-26). **They stay exactly as signed.**
-- Rewriting them would destroy what the signature attests to, in order to tidy a
-- capital letter.
--
-- ══ WHAT IT FOUND ══════════════════════════════════════════════════════════
--
-- ⚠️ **MEASURED BEFORE APPLYING: ZERO ROWS TO CHANGE.** All 33 contacts and 13
-- profiles already carry properly capitalised names and lowercase emails. The
-- four uncapitalised names in this database exist ONLY in `signatures`, and are
-- the ones this migration is explicitly forbidden to touch.
--
-- It is applied anyway, and that is deliberate: this is a multi-tenant schema, the
-- pass is idempotent, and running it is how "there was nothing to fix" becomes a
-- recorded fact rather than an assumption. It is also the SQL statement of a rule
-- that otherwise lives only in TypeScript.

-- ── the word rule, in SQL, matching src/lib/normalize.ts exactly ────────────
-- A word that ALREADY carries a capital of its own is returned untouched: that is
-- what protects `LaBuzetta`, `McDonald` and `O'Brien`, and it is why the
-- transform can only ever ADD the first capital, never move one.
CREATE OR REPLACE FUNCTION public.normalize_person_name(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL
    WHEN btrim(p_value) = '' THEN btrim(p_value)
    ELSE (
      SELECT string_agg(
        CASE
          -- already has a capital somewhere — hands off
          WHEN w ~ '[[:upper:]]' THEN w
          -- starts with a lowercase letter — capitalise that one letter only
          WHEN w ~ '^[[:lower:]]' THEN upper(left(w, 1)) || substr(w, 2)
          ELSE w
        END, ' ' ORDER BY ord)
      FROM regexp_split_to_table(
             regexp_replace(btrim(p_value), '\s+', ' ', 'g'), ' '
           ) WITH ORDINALITY AS t(w, ord)
    )
  END;
$$;

COMMENT ON FUNCTION public.normalize_person_name(text) IS
  'TASK-FIX4/CR-83: capitalise each word that carries no capital of its own. '
  'ONE-TIME backfill helper. NEVER attach this to a trigger — re-normalising on '
  'every write overwrites a person''s deliberate correction (CR-83).';

-- ── the pass ───────────────────────────────────────────────────────────────
-- Only rows the rule would actually change are touched, so re-running writes
-- nothing and `updated_at` is not disturbed on rows that were already right.
UPDATE contacts
SET first_name = public.normalize_person_name(first_name),
    last_name  = public.normalize_person_name(last_name)
WHERE (first_name IS DISTINCT FROM public.normalize_person_name(first_name))
   OR (last_name  IS DISTINCT FROM public.normalize_person_name(last_name));

-- Email lowercasing, same scope, same one-time rule.
UPDATE contacts
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email IS DISTINCT FROM lower(btrim(email));
