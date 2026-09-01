-- MULTI-HORSE RENDERING — expand the horse blocks, then fill per horse.
--
-- THE SHAPE OF THE TWO TEMPLATES (verified against the live bodies)
-- -----------------------------------------------------------------
-- HORSE_EMERGENCY_VET and RELEASE_HORSE_CARE both carry:
--   (a) a CONTIGUOUS RUN of lines that each hold HORSE.* tokens — the
--       "HORSE INFORMATION" block (Horse Name / Microchip / Barn Name / ...),
--   (b) further SCATTERED HORSE.* lines elsewhere: the euthanasia election, the
--       medication block, "Known Conditions", and the signature-block
--       "Horse Name:" line.
-- Both kinds must name every bound horse.
--
-- THE TRANSFORM
-- -------------
-- Before any token substitution, walk the body line by line and group MAXIMAL
-- RUNS of consecutive lines carrying at least one HORSE.* token. Replace each
-- run with N copies of itself — one per bound horse, in position order — each
-- copy prefixed by a "Horse N — <name>" caption and separated by a blank line.
-- Within a copy, HORSE.* tokens are replaced with THAT horse's values via the
-- existing horse_field_token_value(); no new value logic is introduced.
--
-- WHY THIS AND NOT A NEW TEMPLATE
-- --------------------------------
-- The alternative — a second "multi-horse" template body with a repeat marker —
-- would fork the wording of two legal documents and require the owner to
-- maintain both. Expanding the SAME body keeps one source of legal text.
--
-- SINGLE-HORSE OUTPUT IS BYTE-IDENTICAL
-- -------------------------------------
-- With exactly one bound horse the function short-circuits: each run is emitted
-- ONCE, with NO caption and NO separator, and each token resolved exactly as
-- generate_document already resolves it. The output is the same string the old
-- code produced. Proven by byte-compare in the migration's verification.

-- ── The ordered horse set for a document ────────────────────────────────────
-- Falls back to documents.horse_id so a document written before the join table
-- (or by a path that only sets the column) still renders.
CREATE OR REPLACE FUNCTION public.document_horse_ids(p_document_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT array_agg(dh.horse_id ORDER BY dh.position, dh.created_at)
       FROM document_horses dh WHERE dh.document_id = p_document_id),
    (SELECT CASE WHEN d.horse_id IS NULL THEN NULL ELSE ARRAY[d.horse_id] END
       FROM documents d WHERE d.id = p_document_id));
$$;

COMMENT ON FUNCTION public.document_horse_ids(uuid) IS
  'Ordered horses a document names (join table, else the legacy horse_id column).';

-- ── The caption for one horse in a multi-horse block ─────────────────────────
-- A single-line run (e.g. the signature block's trailing "Horse Name:" line, or
-- "Known Conditions:") reads badly under a caption heading — the caption would
-- just restate the line. For those, the copies are emitted WITHOUT a caption and
-- the line's own label carries the horse. Multi-line runs get the caption.
CREATE OR REPLACE FUNCTION public.horse_block_caption(v_horse horses, p_index integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'Horse ' || p_index || ' — '
      || coalesce(nullif(btrim(coalesce(v_horse.registered_name, '')), ''),
                  nullif(btrim(coalesce(v_horse.nickname, '')), ''),
                  'Unnamed');
$$;

-- ── The transform ───────────────────────────────────────────────────────────
-- Takes a tokenized body and the ordered horse ids; returns the body with every
-- HORSE.* run expanded per horse and every HORSE.* token filled.
CREATE OR REPLACE FUNCTION public.expand_horse_blocks(p_body text, p_horse_ids uuid[])
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lines   text[];
  v_out     text[] := '{}';
  v_run     text[] := '{}';
  v_line    text;
  v_i       integer;
  v_n       integer := coalesce(array_length(p_horse_ids, 1), 0);
  v_h       integer;
  v_horse   horses%ROWTYPE;
  v_copy    text;
  v_runline text;
  v_tok     text;
  v_toks    text[];
BEGIN
  IF p_body IS NULL THEN RETURN NULL; END IF;

  -- No horses bound: hand the body back untouched. generate_document's existing
  -- token loop then blanks the HORSE.* tokens exactly as it does today, so the
  -- "no horse named" document is unchanged.
  IF v_n = 0 THEN RETURN p_body; END IF;

  v_lines := string_to_array(p_body, E'\n');

  -- Local helper as an inline block: flush the accumulated run into v_out.
  -- (Written out longhand because plpgsql has no nested functions.)
  FOR v_i IN 1 .. coalesce(array_length(v_lines, 1), 0) LOOP
    v_line := v_lines[v_i];

    IF v_line ~ '\{\{HORSE\.[A-Z0-9_]+\}\}' THEN
      v_run := v_run || v_line;
      CONTINUE;
    END IF;

    -- non-horse line: flush any pending run first
    IF coalesce(array_length(v_run, 1), 0) > 0 THEN
      FOR v_h IN 1 .. v_n LOOP
        SELECT * INTO v_horse FROM horses WHERE id = p_horse_ids[v_h];
        -- caption + blank-line separator ONLY when there is more than one horse,
        -- so the single-horse body is byte-identical to the pre-change output.
        -- caption only for MULTI-LINE runs; a one-line run (e.g. the signature
        -- block's "Horse Name:") already names the horse on the line itself.
        IF v_n > 1 AND coalesce(array_length(v_run, 1), 0) > 1 THEN
          -- ''::text, not '': bare '' concatenated to a text[] is read as an
          -- array literal and raises "malformed array literal".
          IF v_h > 1 THEN v_out := v_out || ''::text; END IF;
          v_out := v_out || horse_block_caption(v_horse, v_h);
        END IF;
        FOREACH v_runline IN ARRAY v_run LOOP
          v_copy := v_runline;
          v_toks := ARRAY(SELECT (regexp_matches(v_copy, '\{\{(HORSE\.[A-Z0-9_]+)\}\}', 'g'))[1]);
          FOREACH v_tok IN ARRAY v_toks LOOP
            v_copy := replace(v_copy, '{{' || v_tok || '}}',
              coalesce(horse_field_token_value(v_horse, split_part(v_tok, '.', 2)), ''));
          END LOOP;
          v_out := v_out || v_copy;
        END LOOP;
      END LOOP;
      v_run := '{}';
    END IF;

    v_out := v_out || v_line;
  END LOOP;

  -- trailing run (a body ending on horse lines)
  IF coalesce(array_length(v_run, 1), 0) > 0 THEN
    FOR v_h IN 1 .. v_n LOOP
      SELECT * INTO v_horse FROM horses WHERE id = p_horse_ids[v_h];
      IF v_n > 1 AND coalesce(array_length(v_run, 1), 0) > 1 THEN
        IF v_h > 1 THEN v_out := v_out || ''::text; END IF;
        v_out := v_out || horse_block_caption(v_horse, v_h);
      END IF;
      FOREACH v_runline IN ARRAY v_run LOOP
        v_copy := v_runline;
        v_toks := ARRAY(SELECT (regexp_matches(v_copy, '\{\{(HORSE\.[A-Z0-9_]+)\}\}', 'g'))[1]);
        FOREACH v_tok IN ARRAY v_toks LOOP
          v_copy := replace(v_copy, '{{' || v_tok || '}}',
            coalesce(horse_field_token_value(v_horse, split_part(v_tok, '.', 2)), ''));
        END LOOP;
        v_out := v_out || v_copy;
      END LOOP;
    END LOOP;
  END IF;

  RETURN array_to_string(v_out, E'\n');
END;
$$;

COMMENT ON FUNCTION public.expand_horse_blocks(text, uuid[]) IS
  'Expand each contiguous run of HORSE.*-token lines into one filled copy per '
  'bound horse. One horse in = byte-identical to single-horse substitution.';
