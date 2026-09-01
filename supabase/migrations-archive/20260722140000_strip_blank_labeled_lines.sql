-- Composer: drop a labeled line when its token(s) are blank.
--
-- The per-line blank check in remerge_contract_from_clauses stripped tokens and
-- then removed the line only if what remained was pure punctuation/whitespace.
-- A line like "Address: {{LESSEE.ADDRESS}}" left the word "Address", so a party
-- with no address on file printed a bare "Address:" line. The desired behavior
-- (and the stated rule — omit content the author didn't provide) is for the whole
-- labeled line to disappear. We extend the emptiness test to also drop a leading
-- "Label:" prefix before deciding the line is empty. Applies uniformly to every
-- "Label: {{TOKEN}}" line (Contact block, Farrier/Vet, cost-responsibility, etc.).

DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('remerge_contract_from_clauses'::regproc);
  v_def := replace(v_def,
$old$          IF v_all_empty AND NOT v_has_sig THEN
            v_stripped := regexp_replace(v_line, '\{\{[A-Z0-9_.]+\}\}', '', 'g');
            v_stripped := btrim(regexp_replace(v_stripped, '[[:punct:][:space:]]', '', 'g'));
            IF v_stripped = '' THEN CONTINUE; END IF;
          END IF;$old$,
$new$          IF v_all_empty AND NOT v_has_sig THEN
            v_stripped := regexp_replace(v_line, '\{\{[A-Z0-9_.]+\}\}', '', 'g');
            -- drop a leading "Label:" (up to ~5 words) so a labeled line with only
            -- blank tokens is treated as empty and omitted, not printed as "Label:".
            v_stripped := regexp_replace(v_stripped, '^\s*([[:alpha:]]+[[:space:]]*){1,5}:\s*', '');
            v_stripped := btrim(regexp_replace(v_stripped, '[[:punct:][:space:]]', '', 'g'));
            IF v_stripped = '' THEN CONTINUE; END IF;
          END IF;$new$);
  IF v_def NOT LIKE '%drop a leading%' THEN
    RAISE EXCEPTION 'remerge composer: per-line strip block not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;
