# TASK R11 REPORT — heading-derived numbering + add-item rebuild

Branch `task/r11-numbering-additem`, cut from `main` at `523ab7f`.
Commits: `b9a57ee` (Phase A), `155eab5` (Phase B).
Database: `lrstswfxfsezdmvkvukc` (prod). Live draft used throughout:
`215bac09-9f66-43ce-8655-85fd05fea1e2` (HORSE_LEASE_V2, workflow_state `editable`).

Health at both commits: **typecheck 0 errors** (`tsconfig.app.json` and
`tsconfig.api.json`), **lint 0 errors / 29 warnings** — the same 29 warnings the
branch inherited; none of them is in a file this task touched (`npm run lint |
grep -E "ClauseDocument|AddElementModal|contracts.ts|ContractPage"` returns
nothing). `npm run build` completes.

---

# PHASE A — numbering derives from headings

## A1 — renderer (`src/components/app/ClauseDocument.tsx`)

### Changed loop (ClauseDocument.tsx:828-846)

```tsx
const gatedOff = !clauseConditionMet(clause.conditional_on, valueByKey);
/* NUMBERING DERIVES FROM HEADINGS (R11, owner ruling 2026-08-04;
   supersedes the "every rendered clause consumes a number" rule).
   A number is an ENFORCEABLE cross-reference, so it may exist only
   where there is a titled thing to reference — a HEADER, i.e. a
   clause carrying its own heading — and only when that header is
   actually part of the instrument:
     • headed + gated-on      -> takes the next sub-number (3.1, 3.2…)
     • headingless + gated-on -> CONTINUATION of the item above it:
       no number, no increment (more prose under the same header;
       before the first header it is section preamble under "N.")
     • gated-off (muted preview) -> never numbers, never increments,
       so the editor's numbering always equals the executed form's.
   Numbers are order-derived, so insertion/removal renumbers itself.
   The mirror of this rule lives in remerge_contract_from_clauses. */
const isHeader = !!(clause.heading && clause.heading.trim());
const numbered = isHeader && !gatedOff;
if (numbered) clauseNo += 1;
const num = numbered ? `${secNum}.${clauseNo}` : '';
```

### Changed title line (ClauseDocument.tsx:923-944)

```tsx
const showWords = isHeader && !echoesSection;
if (!num && !showWords && !clauseRequired) return null;
return (
  <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
    {num ? <span className="text-muted tabular-nums">{num}</span> : null}
    {showWords ? clause.heading : null}
    {clauseRequired && <span className="text-gold-700" title="Needs an answer before signing">*</span>}
  </p>
);
```

The R7 rule survives intact: a heading that merely echoes its section heading
still consumes the number and still drops the repeated words. A headingless
continuation now prints no title line at all (unless it carries an unanswered
required field, whose `*` marker keeps its own line so the signing blocker
stays visible).

### The three variant states, walked

Take the serious-injury group after A3: `HORSE.INJURY_HISTORY_PENDING` (sort 43,
heading "Serious Injury History"), `_NONE` (44), `_DISCLOSED` (45). Exactly one
is ever gated on.

1. **Nothing selected.** PENDING's gate (equals-`''`) is met -> `isHeader` true,
   `gatedOff` false -> it takes **3.5** and prints "3.5 Serious Injury History"
   with the placeholder text. NONE and DISCLOSED are gated off: they render as
   muted previews with their gold captions and **no number**, and `clauseNo`
   does not move — so the next headed clause is 3.6, exactly as it will be in
   the executed instrument.
2. **"No injuries" selected.** PENDING's gate no longer holds; it is an
   unanswered-placeholder, so `isUnansweredPlaceholder` suppresses it entirely
   (pre-existing rule). NONE is gated on and headed -> it takes **3.5**.
   DISCLOSED is a muted preview: no number, no increment.
3. **"Injuries disclosed" selected.** Mirror image: DISCLOSED takes **3.5**,
   NONE previews muted and unnumbered. The number never moved between states —
   which is the whole point, since 3.5 is what a party would cite.

## A2 — `remerge_contract_from_clauses`

### LIVE FUNCTION BODY BEFORE REPLACEMENT

Dumped with `pg_get_functiondef` immediately before the migration was written.
The defect is the `ELSE` branch at the bottom: `v_cl_no` incremented for every
clause, and a headingless clause had `'§CLAUSENUM§.<n> '` prefixed onto its
first body line.

```sql
CREATE OR REPLACE FUNCTION public.remerge_contract_from_clauses(p_document_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc documents%ROWTYPE; v_tkey text;
  v_fields jsonb := '{}'::jsonb; v_labels jsonb := '{}'::jsonb;
  v_out text[] := '{}'; v_sec_buf text[]; v_cl_buf text[];
  v_sec record; v_cl record; v_sec_no int := 0; v_cl_no int; v_sub_no int := 0;
  v_body text; v_lines text[]; v_line text; v_stripped text;
  v_toks text[]; v_tok text; v_any_token boolean; v_all_empty boolean; v_has_sig boolean;
  r record; v_cf record; v_val text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_doc.template_id;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN RETURN NULL; END IF;

  PERFORM recompose_document_fields(p_document_id);
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT coalesce(jsonb_object_agg(field_key, vmap), '{}'::jsonb) INTO v_labels
  FROM (SELECT field_key, jsonb_object_agg(opt->>'value', opt->>'label') AS vmap
          FROM contract_field_defs fd CROSS JOIN LATERAL jsonb_array_elements(fd.options) AS opt
         WHERE fd.template_key = v_tkey AND fd.options IS NOT NULL GROUP BY field_key) m;

  FOR v_sec IN SELECT * FROM contract_section_defs WHERE template_key = v_tkey ORDER BY sort_order LOOP
    IF v_sec.cut_name IS NOT NULL AND NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN CONTINUE; END IF;
    v_sec_buf := '{}'; v_cl_no := 0; v_sub_no := 0;

    FOR v_cl IN SELECT * FROM contract_clause_defs WHERE template_key = v_tkey AND section_key = v_sec.section_key ORDER BY sort_order LOOP
      IF v_cl.cut_name IS NOT NULL AND NOT clause_cut_kept(v_cl.cut_name, v_fields) THEN CONTINUE; END IF;
      IF NOT clause_condition_met(v_cl.conditional_on, v_fields) THEN CONTINUE; END IF;
      v_body := coalesce(v_cl.body, '');

      IF v_cl.clause_type = 'input' AND v_cl.is_optional THEN
        v_toks := ARRAY(SELECT (regexp_matches(v_body, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
        v_all_empty := true;
        FOREACH v_tok IN ARRAY coalesce(v_toks, ARRAY[]::text[]) LOOP
          IF v_tok NOT LIKE 'SIG.%' AND coalesce(v_fields ->> v_tok,'') <> '' THEN v_all_empty := false; END IF;
        END LOOP;
        IF coalesce(array_length(v_toks,1),0) > 0 AND v_all_empty THEN CONTINUE; END IF;
      END IF;

      v_cl_buf := '{}';
      IF v_body <> '' THEN
        v_lines := string_to_array(v_body, E'\n');
        FOREACH v_line IN ARRAY v_lines LOOP
          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;
          -- line-level field gating: if any token on this line is a field with an
          -- unmet conditional_on, drop the whole line.
          IF EXISTS (
            SELECT 1 FROM unnest(v_toks) t
             JOIN contract_field_defs fdg
               ON fdg.template_key = v_tkey AND fdg.field_key = t
            WHERE fdg.conditional_on IS NOT NULL
              AND NOT clause_condition_met(fdg.conditional_on, v_fields)
          ) THEN CONTINUE; END IF;
          v_all_empty := true; v_has_sig := false;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN v_has_sig := true; v_all_empty := false;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN v_all_empty := false;
            ELSIF coalesce(v_fields ->> v_tok,'') <> '' THEN v_all_empty := false; END IF;
          END LOOP;
          IF v_all_empty AND NOT v_has_sig THEN
            v_stripped := regexp_replace(v_line, '\{\{[A-Z0-9_.]+\}\}', '', 'g');
            -- drop a leading "Label:" (up to ~5 words) so a labeled line with only
            -- blank tokens is treated as empty and omitted, not printed as "Label:".
            v_stripped := regexp_replace(v_stripped, '^\s*[[:alpha:]][[:alpha:] ''()/-]{0,60}:\s*', '');
            v_stripped := btrim(regexp_replace(v_stripped, '[[:punct:][:space:]]', '', 'g'));
            IF v_stripped = '' THEN CONTINUE; END IF;
          END IF;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN CONTINUE;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', to_char(coalesce(v_doc.effective_date, v_doc.created_at::date), 'FMMonth FMDD, YYYY'));
            ELSIF EXISTS (SELECT 1 FROM contract_field_defs fdc
                          WHERE fdc.template_key = v_tkey AND fdc.field_key = v_tok
                            AND fdc.format_type = 'certify') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', certify_statement(v_tok, v_fields ->> v_tok, v_tkey));
            ELSIF (v_fields ->> v_tok) ~ '^\d+(\.\d+)?$'
              AND EXISTS (SELECT 1 FROM contract_field_defs fdpct
                          WHERE fdpct.template_key = v_tkey AND fdpct.field_key = v_tok
                            AND fdpct.format_type = 'percent') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', (v_fields ->> v_tok) || '%');
            ELSIF (v_fields ->> v_tok) ~ '^\d+(\.\d+)?$'
              AND EXISTS (SELECT 1 FROM contract_field_defs fdcur
                          WHERE fdcur.template_key = v_tkey AND fdcur.field_key = v_tok
                            AND fdcur.format_type = 'currency') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', fmt_money((v_fields ->> v_tok)::numeric));
            ELSE v_line := replace(v_line, '{{'||v_tok||'}}', token_display_value(v_tok, v_fields ->> v_tok, v_labels)); END IF;
          END LOOP;
          /* R5 (2026-08-04): sentence-terminal punctuation is appended HERE,
             not authored into the body. The clause bodies used to end
             "…: {{TOKEN}}." which produced an orphan "." under a full-width
             input in the editor and a doubled ".." whenever the signer typed
             their own period. Now: if the composed line ends with a filled
             token and lacks terminal punctuation, add one. A line whose token
             resolved to empty gets nothing, so no orphan period survives. */
          /* Only punctuate a line that actually SAYS something: a line whose
             token resolved to empty ends in its lead-in colon ("are: ") and
             must stay bare rather than becoming "are: ." — the unanswered
             field is already flagged by the required marker. */
          IF btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
            v_line := v_line || '.';
          END IF;
          v_line := regexp_replace(v_line, ':\s*\.\s*$', ':');
          v_line := regexp_replace(v_line, '\s+([.,;])', '\1', 'g');
          v_cl_buf := array_append(v_cl_buf, v_line);
        END LOOP;
      END IF;

      IF (v_cl.heading IS NULL OR v_cl.heading = '') AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(v_cl_buf, ARRAY[]::text[])) x WHERE btrim(x) <> '') THEN CONTINUE; END IF;

      IF coalesce(v_cl.render_as_subitem,false) AND (v_cl.heading IS NULL OR v_cl.heading = '') AND coalesce(array_length(v_cl_buf,1),0) > 0 THEN
        v_sub_no := coalesce(array_upper(v_sec_buf,1),0);
          WHILE v_sub_no >= 1 AND v_sec_buf[v_sub_no] = '' LOOP v_sub_no := v_sub_no - 1; END LOOP;
          IF v_sub_no >= 1 THEN
            v_sec_buf[v_sub_no] := v_sec_buf[v_sub_no] || ' ' || array_to_string(v_cl_buf, ' ');
        ELSE
          v_sec_buf := v_sec_buf || v_cl_buf;
        END IF;
      ELSE
      v_sub_no := 0;
      v_cl_no := v_cl_no + 1;
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        v_sec_buf := array_append(v_sec_buf, ('§CLAUSENUM§.' || v_cl_no || ' ' || v_cl.heading)::text);
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN v_sec_buf := v_sec_buf || v_cl_buf; END IF;
      ELSE
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN
          v_cl_buf[1] := '§CLAUSENUM§.' || v_cl_no || ' ' || v_cl_buf[1];
          v_sec_buf := v_sec_buf || v_cl_buf;
        END IF;
      END IF;
      END IF;
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    -- custom fields added by the author to THIS existing section
    FOR v_cf IN SELECT field_key, label, value FROM contract_fields
                 WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
                   AND section = v_sec.section_key ORDER BY sort_order LOOP
      v_val := btrim(coalesce(v_cf.value, ''));
      IF v_val = '' THEN CONTINUE; END IF;                          -- omit empty
      v_cl_no := v_cl_no + 1;
      v_sec_buf := array_append(v_sec_buf,
        ('§CLAUSENUM§.' || v_cl_no || ' ' || coalesce(v_cf.label,'Item') || ': ' || v_val)::text);
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    IF coalesce(array_length(v_sec_buf,1),0) > 0 THEN
      v_sec_no := v_sec_no + 1;
      v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.heading))::text);
      v_out := v_out || ARRAY(SELECT replace(x, '§CLAUSENUM§', v_sec_no::text) FROM unnest(v_sec_buf) x);
    END IF;
  END LOOP;

  -- custom SECTIONS (a CUSTOM.* field whose `section` matches no def section_key):
  -- group by section, emit each as its own numbered section with its fields.
  FOR v_sec IN
    SELECT DISTINCT section FROM contract_fields
     WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
       AND section NOT IN (SELECT section_key FROM contract_section_defs WHERE template_key = v_tkey)
     ORDER BY section
  LOOP
    v_sec_buf := '{}'; v_cl_no := 0; v_sub_no := 0;
    FOR v_cf IN SELECT field_key, label, value FROM contract_fields
                 WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
                   AND section = v_sec.section ORDER BY sort_order LOOP
      v_val := btrim(coalesce(v_cf.value, ''));
      IF v_val = '' THEN CONTINUE; END IF;
      v_cl_no := v_cl_no + 1;
      v_sec_buf := array_append(v_sec_buf,
        ('§CLAUSENUM§.' || v_cl_no || ' ' || coalesce(v_cf.label,'Item') || ': ' || v_val)::text);
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;
    IF coalesce(array_length(v_sec_buf,1),0) > 0 THEN
      v_sec_no := v_sec_no + 1;
      v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.section))::text);
      v_out := v_out || ARRAY(SELECT replace(x, '§CLAUSENUM§', v_sec_no::text) FROM unnest(v_sec_buf) x);
    END IF;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');
  UPDATE documents SET merged_body = v_body WHERE id = p_document_id AND workflow_state <> 'executed';
  RETURN v_body;
END;
$function$
```

### The change

Migration `supabase/migrations/20260804110000_numbering_derives_from_headings.sql`.
Verified by dry-run (`BEGIN; \i migration; pg_get_functiondef; ROLLBACK;`) and
diffed against the live dump — the diff is exactly and only this:

```diff
       v_sub_no := 0;
-      v_cl_no := v_cl_no + 1;
+      /* R11: the NUMBER belongs to the HEADING. Only a headed clause consumes
+         one; a headingless clause is continuation text under the item above
+         (or section preamble when no header precedes it) and is emitted bare. */
       IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
+        v_cl_no := v_cl_no + 1;
         v_sec_buf := array_append(v_sec_buf, ('§CLAUSENUM§.' || v_cl_no || ' ' || v_cl.heading)::text);
         IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN v_sec_buf := v_sec_buf || v_cl_buf; END IF;
       ELSE
         IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN
-          v_cl_buf[1] := '§CLAUSENUM§.' || v_cl_no || ' ' || v_cl_buf[1];
           v_sec_buf := v_sec_buf || v_cl_buf;
         END IF;
       END IF;
```

Gated-off clauses were already skipped earlier in the loop (`CONTINUE`), so
"muted never numbers" needs no separate code in SQL.

### A3 — data pass

Migration `supabase/migrations/20260804110001_lease_heading_data_pass.sql`.
Every UPDATE is guarded on the current live value, so it is idempotent and a
replay against a template someone else has edited is a no-op rather than an
overwrite. Live shape verified per group BEFORE writing (raw output in the
"live shapes" appendix below).

| # | Change | Live before | After |
|---|--------|-------------|-------|
| 1 | `HORSE.IDENTITY` heading | `Horse` | `Horse Details` |
| 2a | `HORSE.INJURY_HISTORY_PENDING` | sort 45, heading NULL | sort 43, heading `Serious Injury History`, body replaced with the spec's wording; NONE 43->44, DISCLOSED 44->45 (headings kept, per spec) |
| 2b | `TRAINING_LESSONS.PENDING` | sort 256, heading `Lessons` | sort 245 (in front of LESSONS 250 / LESSONS_ENTITY 255); heading already correct |
| 2c | `LESSEE_REPS.PENDING` | sort 21, heading `Lessee's Representations` | sort 5 (in front of MAIN_INDIVIDUAL 10 / MAIN_ENTITY 20); heading already correct |
| 2d | `PURPOSE.RECREATION_DEFAULT` | sort 12, heading `Purpose of Agreement` | sort 5 (in front of RECREATION 10); heading already correct |
| 2e | DEFINITIONS block | tied sort_orders 10/11/11/12/13/13/14/15, all headingless | restated 10..80 with each placeholder ahead of its own variants; all still headingless (preamble-position variants, per spec) |
| 3 | `LOCATION.MAIN` heading | `Location of the Horse` | `Location` |

**Live shapes that differed from the spec's description, and how they were
adapted** — the spec said "verify each group's live rows BEFORE updating … report
any group whose live shape differs and adapt to the same pattern":

- `TRAINING_LESSONS.PENDING`, `LESSEE_REPS.PENDING` and
  `PURPOSE.RECREATION_DEFAULT` **already carried** their group headings, so only
  the sort order moved. Only `HORSE.INJURY_HISTORY_PENDING` needed a heading.
- The DEFINITIONS block had **tied sort_orders** (LESSOR_PENDING and LESSOR_ENT
  both 11; LESSEE_PENDING and LESSEE_ENT both 13), so "insert the placeholder
  before its variants" had no free integer. The whole eight-row block was
  restated on a clean 10..80 scale instead, guarded row-by-row on `(clause_key,
  old sort_order, heading IS NULL)`.
- The PURPOSE placeholder is named `PURPOSE.RECREATION_DEFAULT`, not
  `PURPOSE.*_PENDING`.

## A done-checks

### Live draft remerged — §3, before and after

Every number now owns a heading; the two manufactured numbers (old 3.3 and old
3.10, both headingless) became continuation prose under the item above them, and
the section closes at 3.9 instead of 3.11.

**BEFORE**

```
3. THE HORSE
3.1 Horse
This Agreement applies to the following horse (the "Horse"): Beaumont de Cactai.
Color: Bay.
Markings: Star and left hind sock.
Breed: Selle Français.
Registration Number: SF-2016-04412.
Sex: Gelding.
Foaling date: April 12, 2016.
Current fair market value: $45,000.00.
Microchip: 985141002347781.
Passport: FRA-2016-778110.

3.2 Ownership of the Horse
Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

3.3 Are there any ownership related leasing restrictions? No.

3.4 Behavior
The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

3.5 Physical Condition
The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

3.6 Serious Injury History Disclosed
Lessor discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury:. Lessee acknowledges this disclosure and proceeds with knowledge of it.

3.7 Pre-Lease Veterinary Examination

3.8 Pre-Lease Trainer Evaluation

3.9 Location of the Horse
Location of the Horse: Carmel Creek Ranch, 11500 Clews Ranch Rd, San Diego, CA 92130
Main Barn, Stall 12.

3.10 Lessor may inspect the Horse at any time, subject to the reasonable access rules of the facility where the Horse is kept. If Lessor reasonably determines that the Horse is not being properly cared for, Lessor may take possession of the Horse upon written notice to Lessee.

3.11 Disclaimer of Warranties
Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

4. PURPOSE AND LEASE GRANT
```

**AFTER**

```
3. THE HORSE
3.1 Horse Details
This Agreement applies to the following horse (the "Horse"): Beaumont de Cactai.
Color: Bay.
Markings: Star and left hind sock.
Breed: Selle Français.
Registration Number: SF-2016-04412.
Sex: Gelding.
Foaling date: April 12, 2016.
Current fair market value: $45,000.00.
Microchip: 985141002347781.
Passport: FRA-2016-778110.

3.2 Ownership of the Horse
Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

Are there any ownership related leasing restrictions? No.

3.3 Behavior
The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

3.4 Physical Condition
The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

3.5 Serious Injury History Disclosed
Lessor discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury:. Lessee acknowledges this disclosure and proceeds with knowledge of it.

3.6 Pre-Lease Veterinary Examination

3.7 Pre-Lease Trainer Evaluation

3.8 Location
Location of the Horse: Carmel Creek Ranch, 11500 Clews Ranch Rd, San Diego, CA 92130
Main Barn, Stall 12.

Lessor may inspect the Horse at any time, subject to the reasonable access rules of the facility where the Horse is kept. If Lessor reasonably determines that the Horse is not being properly cared for, Lessor may take possession of the Horse upon written notice to Lessee.

3.9 Disclaimer of Warranties
Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

4. PURPOSE AND LEASE GRANT
```

### Live draft remerged — §9-§10, before and after

Old 9.2, 10.2, 10.6, 10.8 and 10.10 were all headingless. §10 closes at 10.9
instead of 10.13.

**BEFORE**

```
9. AGREEMENT TERM
9.1 Agreement Term
Term of this Agreement:. This Agreement begins on.

9.2 Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.

10. PERMITTED USE(S) & RESTRICTIONS
10.1 Permitted Use(s)
Lessor grants Lessee the right to use the Horse for the following purpose(s): Riding Lessons, Solo Arena Riding, Group Arena Riding, Jumping, Competitions, Trail Riding.
Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

10.2 Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.

10.3 Lessons — Lessee's Instruction Program
Lessee is permitted by Lessor to provide riding lessons with the Horse: 

10.4 Competition Costs and Winnings
Expenses of competition (entry fees, transportation, and the like) are:
Any prize money or winnings earned in competition shall belong to: 

10.5 Competition Restrictions

10.6 Lessor does not restrict competition activity in any way.

10.7 Jumping Restrictions

10.8 Lessor does not restrict jumping activity in any way.

10.9 Trail-Riding Restrictions

10.10 Lessor does not restrict trail-riding activity in any way.

10.11 Additional Restrictions

10.12 Other Allowed Activities
Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

10.13 Releases Required for Authorized Riders
All persons other than Lessee must, prior to handling or riding the Horse, have executed a liability release that names the Lessor Parties and the Lessee Parties as released parties, contains an express assumption of the inherent risks of equine activities, has been reviewed and approved by Lessor, and, for any rider under 18 years of age, is signed by the rider's parent or legal guardian. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

11. HORSE CARE AND EXPENSES
```

**AFTER**

```
9. AGREEMENT TERM
9.1 Agreement Term
Term of this Agreement:. This Agreement begins on.

Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.

10. PERMITTED USE(S) & RESTRICTIONS
10.1 Permitted Use(s)
Lessor grants Lessee the right to use the Horse for the following purpose(s): Riding Lessons, Solo Arena Riding, Group Arena Riding, Jumping, Competitions, Trail Riding.
Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.

10.2 Lessons — Lessee's Instruction Program
Lessee is permitted by Lessor to provide riding lessons with the Horse: 

10.3 Competition Costs and Winnings
Expenses of competition (entry fees, transportation, and the like) are:
Any prize money or winnings earned in competition shall belong to: 

10.4 Competition Restrictions

Lessor does not restrict competition activity in any way.

10.5 Jumping Restrictions

Lessor does not restrict jumping activity in any way.

10.6 Trail-Riding Restrictions

Lessor does not restrict trail-riding activity in any way.

10.7 Additional Restrictions

10.8 Other Allowed Activities
Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

10.9 Releases Required for Authorized Riders
All persons other than Lessee must, prior to handling or riding the Horse, have executed a liability release that names the Lessor Parties and the Lessee Parties as released parties, contains an express assumption of the inherent risks of equine activities, has been reviewed and approved by Lessor, and, for any rider under 18 years of age, is signed by the rider's parent or legal guardian. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

11. HORSE CARE AND EXPENSES
```

### A3.4 — headingless-clause attachment audit (report only, nothing fixed)

Every headingless clause across `HORSE_LEASE_V2`, `HORSE_SALE_V2` and
`HORSE_BILL_OF_SALE`, with the header it now reads under. Full raw table is in
the appendix; the flags follow.

**Reads wrong — flagged, NOT fixed (outside this spec):**

1. `HORSE_LEASE_V2 / CARE / CARE.INTRO` (sort 5) and `CARE.SUPPLEMENTS` (sort 10)
   attach under **"3rd Party Exercise"** (`SCHEDULE.TRAINER_CARE`, sort 2), which
   sorts ahead of them in the CARE section. CARE.INTRO is the general
   care-and-expenses lead-in for the whole section and CARE.SUPPLEMENTS is the
   medications builder; neither belongs under a third-party-exercise header.
   Fixing it means giving CARE.INTRO a heading (e.g. "Care and Expenses") or
   moving the two SCHEDULE.* clauses — a content decision, not a numbering one.
2. `HORSE_SALE_V2` and `HORSE_BILL_OF_SALE` **[Pending] placeholders are still
   headingless** — `HORSE.INJURY_HISTORY_PENDING`, `PPE.PENDING`,
   `PRICE.INSTALLMENTS_PENDING`, `TRIAL.PENDING`, `PARTIES.CO_BUYER_PENDING`,
   `DEFINITIONS.{SELLER,BUYER}_PENDING`, and all seven BOS `*_PENDING` rows.
   A3 only covered HORSE_LEASE_V2. Consequence: while the driving question is
   unanswered, those groups show **no number and no title** — the item appears
   to materialise when the selection is made. The same one-line fix A3 applied
   to the lease would resolve each.
3. `HORSE_BILL_OF_SALE` has 11 headed clauses in 12 sections, and in most of them
   every headingless clause precedes the first header — so `BOS_TITLE`,
   `BOS_HORSE`, `BOS_CONSIDERATION`, `BOS_CONVEYANCE`, `BOS_GOVERNING`,
   `BOS_WARRANTY`, `BOS_AGENT` and `BOS_SIGNATURES` now compose as **"N. TITLE"
   plus unnumbered preamble**, with no sub-numbers at all. For a bill of sale
   that reads acceptably (it is a short instrument), but it is a visible change
   from the previous numbering and is recorded here as such.

**Reads correctly (no action):** the alternative-branch pairs
(`RESTRICT.{COMP,JUMP,TRAIL}_{ON,OFF}` under their restriction headers, the
INSURANCE_RISK deductible/status rows under their insurance headers,
`EVALUATION.{REFUSED,WAIVED}`, `TERM.FIXED_END`, `HORSE.*_EXC`,
`LOCATION.{MOVE_CHOICE,NEW,INSPECTION}` under "Location", the signature-capacity
rows under "Signatures"), and the DEFINITIONS sections of both the lease and the
sale, which are unnumbered preamble by design.

## Deviations and honesty notes — Phase A

1. **"Muted previews render title-only + gold caption."** Read literally this
   would drop the muted preview's BODY. I did **not** do that, and the reason is
   functional, not stylistic: a headingless gated clause has no title, so
   title-only would render it as nothing at all — and the existing code
   deliberately renders a gated clause's own self-enabling toggle
   (`gateControls`) so the clause can still be switched on. Title-only would
   hide those toggles and make several clauses unreachable. What I implemented
   is the numbering half, which is what Phase A is for: **a muted preview's title
   line carries its title and never a number**, the gold caption stays, the body
   still previews muted. If the owner did mean "collapse muted previews to their
   title", that is a separate, small change and I have not made it.
2. **The A3 dry-run committed.** I ran the data migration inside
   `BEGIN; \i file; …; ROLLBACK;` — but the file carried its own `BEGIN;` /
   `COMMIT;`, so the inner COMMIT ended the outer transaction and the ROLLBACK
   was a no-op ("there is no transaction in progress"). The data pass therefore
   landed at dry-run time rather than at apply time. No harm resulted — the
   guarded re-run reported `UPDATE 0` ten times and the final live state was
   re-verified outside any transaction (appendix) — but the dry-run was not a
   dry run, and stating otherwise would be false.

---

# PHASE B — add-item rebuild

## B0 — what the add surface was (verify-first)

- **UI:** `src/components/app/AddElementModal.tsx`, one modal with three modes —
  `field` / `section` / `clause`. Mounted once, from
  `src/pages/app/ContractPage.tsx:1069`, which passed
  `sections={structure.sections.map(sec => sec.heading)}` — section HEADINGS, not
  keys.
- **RPCs:** `addContractElement` -> `add_contract_element(p_document_id, p_kind,
  p_section, p_after_section, p_position, p_label, p_format_type, p_options,
  p_guidance)`; `proposeClause` -> `propose_clause`; `listContractFormats` reads
  the `contract_formats` registry.
- **Storage:** one `contract_fields` row per addition, `field_key` =
  `CUSTOM.<LABEL>_<n>`, `section` = whatever string the modal passed. Columns
  already present and usable: `options`, `guidance`, `required`, `input_kind`,
  `format_type`, `conditional_on`, `clause_key`, `sort_order`. **Missing:** any
  place for prose, and any notion of a header.
- **Rendering:** `ClauseDocument` grouped `CUSTOM.*` by `f.section` into
  `customBySection`; a row whose section matched a template `section_key`
  rendered as "Label: control" at the end of that section, everything else as
  its own trailing section. The composer mirrored that (`'§CLAUSENUM§.<n>
  <label>: <value>'`), and skipped any row with an empty value.
- **Pre-existing quirk found while tracing:** because ContractPage passed
  headings and `customBySection` matched against `section_key`, a legacy custom
  field could never land inside a template section — it always became a trailing
  custom section. Not fixed beyond being superseded by the new path, which
  passes keys.

**What was reused:** the `CUSTOM.*` `contract_fields` storage, `clause_key`
(header grouping), `conditional_on` (gates), `guidance` (caption / placeholder),
`options` / `required` / `input_kind` (elements), `add_contract_element` (kept,
signature unchanged), `propose_clause` (kept as a second tab), the
`clauseConditionMet` / `clause_condition_met` engine (untouched — gates are
written as ordinary JSON), and `ClauseProse` for the live preview.

## B1/B2/B3 — storage and RPCs (`20260804120000_add_item_composition.sql`)

Two new columns, four row kinds, everything else pre-existing:

| `custom_kind` | what it is | columns used |
|---|---|---|
| `section` | a whole new section | `label` = title, `sort_order` = position |
| `header` | a numbered header in a section | `label` = words, `sort_order` = position |
| `line` | one content line | **`body`** = prose with `{CUSTOM.*}` tokens, `clause_key` = its header, `conditional_on` = its gate, `guidance` = the gold caption |
| `element` | an inline control | `input_kind` `select`/`buttons`/`text`, `options`, `guidance` = placeholder, `required` |

**Placement space.** Template `sort_order`s sit as close as 10/12
(PARTIES/DEFINITIONS), so an authored row stores its `sort_order` in a **x1000
insertion space** (template value x 1000). A midpoint always exists between two
adjacent template rows and no template row is ever renumbered. The renderer uses
the identical arithmetic.

**`add_contract_composition(p_document_id, p_spec jsonb)`** writes the whole
addition in one transaction (a function IS the transaction, so a partial
addition cannot survive), mints the CUSTOM keys through the one shared
`next_custom_field_key`, and resolves the spec's LOCAL element ids —
`{CUSTOM.@e1}` in prose and `"@e1"` in a gate's `field_key` — to the real keys
it just minted, so the client never predicts a key. `add_contract_element` keeps
its exact signature and now calls the same key generator instead of carrying its
own copy of the formula.

**`remove_contract_composition(p_document_id, p_field_key)`** — a header takes
its lines and elements with it, a section takes everything authored into it.
Added because the done-check requires deletion and the feature is unusable
without it; it writes nothing new, it only deletes `custom_kind IS NOT NULL`
rows.

**Composer.** The section cursor and the clause cursor became UNIONs of template
rows and authored rows, ordered by the shared insertion space, with an authored
line sorting immediately under the header its `clause_key` names. That gives ONE
code path for numbering, gating, token substitution and punctuation — and the
Phase A heading rule applies to authored content for free (a header numbers, a
line is continuation). Plus: CUSTOM option labels join the label map (so a
dropdown value composes as its words), and **B4** — a blank CUSTOM token
composes as `N/A` once `workflow_state` is no longer `editable`/`editing`
(`advance_document_workflow` sets the state before it re-merges, so the body
written at lock time carries the N/A).

**`contract_document_detail`** was patched in place (anchored replace over
`pg_get_functiondef`, with a guard that raises if the anchor is not found and
returns if already patched) to serialise `custom_kind` and `body`.

## B2/B3 — the modal (`src/components/app/AddElementModal.tsx`, rewritten)

- **Row 1 SECTION**: a select of the document's sections *numbered as the
  document numbers them* (template + already-added authored sections, folded in
  at their stored position), or a free-text new title with a 1..N+1 position
  select.
- **Row 2 HEADER**: scoped to the chosen section, listing existing headers by
  `number + words` (only clauses that HAVE a heading — the R11 definition of a
  header), or a new header name with a position select defaulting to end of
  section.
- **Row 3 CONTENT**: a stack of independently-authored lines, starting with one
  blank line, with per-entry up / down / remove; below it a `+ Add a line` and
  `+ Add a condition` pair — exactly two choices.
- **Chips.** A line is `Seg[] = {t:'text',v} | {t:'el',id}`. `[Dropdown]`
  `[Buttons]` `[Text field]` split the text segment at the caret and insert an
  element segment. A chip is an object, never text, so it cannot be
  half-deleted; `Backspace` at offset 0 of a text segment removes the entire
  preceding chip. Config opens in a **popover on the chip** (`+ menu item` /
  `+ button` rows with reorder and remove, placeholder input, `Required` toggle
  offered only for a text field). When an item or button is labelled "Other"
  (case-insensitive) the popover offers **`+ details field for "Other"`**, which
  appends a text-field chip immediately after that element.
- **Conditions are separators.** A condition block holds its driver (chosen only
  from the dropdown/button elements already in THIS addition), one or more of
  that driver's values, the gold caption, and **its own content zone with its
  own `+ line inside this condition`**. It gates only the lines in that zone; a
  top-level line added after it is independent, unconditional content. Values
  already used by another separator on the same driver stay selectable and are
  marked `· already used` — never hidden.
- **Caption.** Auto-generated (`This is included when "<driver>" is "<v>" or
  "<v>".`) and re-derived whenever the condition changes; typing in the box
  stores an override verbatim and stops the sync. The hint under the box says
  which state it is in.
- **Live preview** renders each line through **`ClauseProse`** — the document's
  own render path, now exported from `ClauseDocument` — with a synthetic field
  map built from the chip configs, so the preview IS the render, and gated lines
  preview muted under their caption.
- **Gates on submit** are written as `{field_key, equals:[…]}` for a dropdown
  driver and `{field_key, contains:[…]}` for buttons. No composites, no
  negation, no template-field drivers. Nothing was added to the gating engine.

`ContractPage.tsx:1069` now passes `structure={structure} fields={detail.fields}`
instead of a list of heading strings.

## B4 — executed rendering

- **Blank CUSTOM -> `N/A`**: implemented in the composer (above) and verified.
- **Required CUSTOM fields participate in the signing lock**: verified, not
  rewired. `contract_lock_blockers` LEFT JOINs `contract_clause_defs` on
  `cf.clause_key`; for a CUSTOM element that join misses, `cd.conditional_on` is
  NULL, `clause_condition_met(NULL, …)` is true, and the row is counted. The only
  thing that was missing was a way to SET `required` — `add_contract_element`
  hard-coded `false`. `add_contract_composition` passes it through, and the live
  check below shows "Paddock" in the blocker message.

## B done-checks — live draft `215bac09`, raw output

The RPC path was driven from `psql` with the caller's JWT claims set
(`set_config('request.jwt.claims', …, true)` + `SET LOCAL ROLE authenticated`,
`sub` = `b45a5503-…` = admin@fhequestrian.com, staff). The UI cannot be driven
headless; the spec permits RPC level.

### The addition

```
SELECT add_contract_composition('215bac09-…', '{
  "section": "HORSE", "section_new": false,
  "header": { "text": "Turnout", "position": null },
  "elements": [
    {"id":"e1","kind":"select","label":"Turnout preference","placeholder":"Choose one",
     "options":[{"value":"AM","label":"Mornings"},{"value":"PM","label":"Evenings"}]},
    {"id":"e2","kind":"text","label":"Paddock","placeholder":"which paddock","required":true}
  ],
  "lines": [
    {"body":"The Horse shall be turned out {{CUSTOM.@e1}} in {{CUSTOM.@e2}}"},
    {"body":"Evening turnout requires the Lessee to bring the Horse in before dark",
     "conditional_on": {"field_key":"@e1","equals":["PM"]},
     "caption":"This is included when “Turnout preference” is “Evenings”."}
  ]
}')

{
    "created": ["CUSTOM.TURNOUT_1","CUSTOM.TURNOUT_PREFERENCE_2","CUSTOM.PADDOCK_3",
                "CUSTOM.LINE_4","CUSTOM.LINE_5"],
    "section": "HORSE",
    "header_key": "CUSTOM.TURNOUT_1",
    "element_keys": {"e1": "CUSTOM.TURNOUT_PREFERENCE_2", "e2": "CUSTOM.PADDOCK_3"}
}
```

### Remerge 1 — driver UNSET

```
3.10 Turnout

The Horse shall be turned out  in.
```

The header takes 3.10 (continuing straight on from 3.9 Disclaimer of
Warranties — Phase A numbering applied to authored content with no extra code),
the unconditional line is present, **the gated line is absent**.

### Remerge 2 — driver = "Evenings" (item 2)

```
3.10 Turnout

The Horse shall be turned out Evenings in.

Evening turnout requires the Lessee to bring the Horse in before dark.
```

**The gated line appears only here.** The dropdown value composed as its LABEL
("Evenings", not the stored "PM") — the CUSTOM option-label map working. Neither
line took a number: they are continuation under 3.10, per Phase A.

### B4 — required field in the signing lock

```
SELECT contract_lock_blockers('215bac09-…');
  "code": "required_fields",
  "message": "Required field(s) still empty: Paddock, Purpose of the lease, … "
```

### B4 — blank CUSTOM at execution

Run inside `BEGIN … ROLLBACK` so prod state was not moved (`workflow_state`
confirmed back at `editable` afterwards):

```
UPDATE documents SET workflow_state='locked' WHERE id='215bac09-…';
SELECT remerge_contract_from_clauses('215bac09-…');

3.10 Turnout

The Horse shall be turned out Evenings in N/A.

Evening turnout requires the Lessee to bring the Horse in before dark.
```

### Deletion — zero residue

```
SELECT remove_contract_composition('215bac09-…','CUSTOM.TURNOUT_1');
 rows_deleted
--------------
            5

-- any CUSTOM row left on the draft?
 NONE
-- 'turnout' / 'paddock' anywhere in merged_body?
 NONE
-- diff of merged_body against the pre-addition (post-Phase-A) baseline:
 IDENTICAL — zero residue
```

## Deviations and honesty notes — Phase B

1. **The spec says "the composer already appends terminal punctuation (R5
   rule)". Live contradicted it.** R5 only punctuates a line that CONTAINS a
   token; a token-free line is appended verbatim and returns before the
   punctuation step. The gated line above composed as "…before dark" with no
   period. Rather than make the modal demand a period it told authors not to
   type, migration `20260804120001_authored_line_punctuation.sql` extends R5 to
   authored lines only — scoped by `v_cl.clause_key LIKE 'CUSTOM.%'`, so not one
   template clause changes. Verified: re-merging after the patch changed exactly
   one line of the whole document (`diff` shows a single hunk, the missing
   period).
2. **`remove_contract_composition` is new and not named in the spec.** The B
   done-check requires deleting the custom rows, and the feature is not usable
   without a removal path. It only deletes rows the new path created.
3. **A composite RPC rather than N calls to `add_contract_element`.** An
   addition is a header plus lines plus elements plus gates that reference those
   elements' keys; written one row at a time from the client it could half-land,
   and the client would have to guess keys before they exist. The composite
   writer uses the same storage, the same key generator, and the same gate
   format — `add_contract_element` is unchanged and still live.
4. **Two new columns on `contract_fields`.** `body` and `custom_kind`. There was
   nowhere to put prose, and no way to say what an authored row is. Everything
   else the spec asked for (options, placeholder, required, gate, caption,
   grouping, ordering) fits columns that already existed.
5. **Section-position support required a per-document section order.** Template
   `contract_section_defs` are shared by every document of a template, so a new
   section could not be interleaved by editing them. It is stored as a
   `custom_kind='section'` row carrying the position, and both the composer and
   the renderer merge the two ordered lists.
6. **Nothing was retried and nothing failed.** The only mid-course corrections
   were the two quoting errors in migration `20260804120001` (dollar-quoting the
   inner literals) and the removal of a redundant query block in
   `add_contract_composition` — both caught before anything reached prod.
7. **Not run:** the UI itself was never exercised in a browser. Typecheck, lint
   and a full production build pass; the modal's behaviour is asserted from the
   code, not from a click-through.

---

# Appendix — raw live-state verification

## Live shapes read before the A3 updates

```
  section_key  |           clause_key            | sort_order |                heading                 | gated
---------------+---------------------------------+------------+----------------------------------------+------
 DEFINITIONS   | DEFINITIONS.LESSOR_IND          |         10 | «NULL»                                 | t
 DEFINITIONS   | DEFINITIONS.LESSOR_PENDING      |         11 | «NULL»                                 | t
 DEFINITIONS   | DEFINITIONS.LESSOR_ENT          |         11 | «NULL»                                 | t
 DEFINITIONS   | DEFINITIONS.LESSEE_IND          |         12 | «NULL»                                 | t
 DEFINITIONS   | DEFINITIONS.LESSEE_PENDING      |         13 | «NULL»                                 | t
 DEFINITIONS   | DEFINITIONS.LESSEE_ENT          |         13 | «NULL»                                 | t
 DEFINITIONS   | DEFINITIONS.BINDING             |         14 | «NULL»                                 | f
 DEFINITIONS   | DEFINITIONS.BENEFICIARIES       |         15 | «NULL»                                 | f
 HORSE         | HORSE.IDENTITY                  |         10 | Horse                                  | f
 HORSE         | HORSE.INJURY_HISTORY_NONE       |         43 | No Serious Injury History              | t
 HORSE         | HORSE.INJURY_HISTORY_DISCLOSED  |         44 | Serious Injury History Disclosed       | t
 HORSE         | HORSE.INJURY_HISTORY_PENDING    |         45 | «NULL»                                 | t
 HORSE         | LOCATION.MAIN                   |         56 | Location of the Horse                  | f
 LESSEE_REPS   | LESSEE_REPS.MAIN_INDIVIDUAL     |         10 | Lessee's Representations               | t
 LESSEE_REPS   | LESSEE_REPS.MAIN_ENTITY         |         20 | Lessee's Representations               | t
 LESSEE_REPS   | LESSEE_REPS.PENDING             |         21 | Lessee's Representations               | t
 PERMITTED_USE | TRAINING_LESSONS.LESSONS        |        250 | Lessons — Continuous Enrollment        | t
 PERMITTED_USE | TRAINING_LESSONS.LESSONS_ENTITY |        255 | Lessons — Lessee's Instruction Program | t
 PERMITTED_USE | TRAINING_LESSONS.PENDING        |        256 | Lessons                                | t
 PURPOSE       | PURPOSE.RECREATION              |         10 | Purpose of Agreement                   | t
 PURPOSE       | PURPOSE.RECREATION_DEFAULT      |         12 | Purpose of Agreement                   | t
```

## Live state re-verified after A3, outside any transaction

```
           clause_key           | sort_order |             heading
--------------------------------+------------+----------------------------------
 DEFINITIONS.LESSOR_PENDING     |         10 | «NULL»
 DEFINITIONS.LESSOR_IND         |         20 | «NULL»
 DEFINITIONS.LESSOR_ENT         |         30 | «NULL»
 DEFINITIONS.LESSEE_PENDING     |         40 | «NULL»
 DEFINITIONS.LESSEE_IND         |         50 | «NULL»
 DEFINITIONS.LESSEE_ENT         |         60 | «NULL»
 DEFINITIONS.BINDING            |         70 | «NULL»
 DEFINITIONS.BENEFICIARIES      |         80 | «NULL»
 HORSE.IDENTITY                 |         10 | Horse Details
 HORSE.INJURY_HISTORY_PENDING   |         43 | Serious Injury History
 HORSE.INJURY_HISTORY_NONE      |         44 | No Serious Injury History
 HORSE.INJURY_HISTORY_DISCLOSED |         45 | Serious Injury History Disclosed
 LOCATION.MAIN                  |         56 | Location
 LESSEE_REPS.PENDING            |          5 | Lessee's Representations
 TRAINING_LESSONS.PENDING       |        245 | Lessons
 PURPOSE.RECREATION_DEFAULT     |          5 | Purpose of Agreement

HORSE.INJURY_HISTORY_PENDING body:
[This section is completed by the Lessor's selection above. The applicable
 statement replaces this placeholder once the selection is made; signing is
 blocked until then.]
```

## A3.4 — full headingless-clause attachment table

Generated with a window function taking, for each headingless clause, the last
non-null heading before it within its own section.

```
tpl | sect | clause_key | so | gated | attaches_under | body
HORSE_BILL_OF_SALE | BOS_AGENT | BOS_AGENT.DISCLOSURE | 10 | t | << SECTION PREAMBLE >> | The following person or entity acted as agent or int
HORSE_BILL_OF_SALE | BOS_AGENT | BOS_AGENT.NONE | 20 | t | << SECTION PREAMBLE >> | No agent or intermediary receives compensation in co
HORSE_BILL_OF_SALE | BOS_AGENT | BOS_AGENT.PENDING | 30 | t | << SECTION PREAMBLE >> | [Pending — state whether a compensated agent or inte
HORSE_BILL_OF_SALE | BOS_CONSIDERATION | BOS_CONSIDERATION.PRICE | 10 | f | << SECTION PREAMBLE >> | The purchase price for the Horse is {{TXN.PURCHASE_P
HORSE_BILL_OF_SALE | BOS_CONVEYANCE | BOS_CONVEYANCE.PAID | 10 | t | << SECTION PREAMBLE >> | Seller acknowledges receipt of the Purchase Price in
HORSE_BILL_OF_SALE | BOS_CONVEYANCE | BOS_CONVEYANCE.INSTALLMENT | 20 | t | << SECTION PREAMBLE >> | The Purchase Price is payable in installments under 
HORSE_BILL_OF_SALE | BOS_CONVEYANCE | BOS_CONVEYANCE.PENDING | 30 | t | << SECTION PREAMBLE >> | [Pending — select whether the Purchase Price is paid
HORSE_BILL_OF_SALE | BOS_DISCLOSURES | BOS_DISCLOSURES.INJURY_PENDING | 50 | t | Serious Injury History Disclosed | [Pending — state whether anyone or any animal has be
HORSE_BILL_OF_SALE | BOS_DISCLOSURES | BOS_DISCLOSURES.ENCUMBRANCES_PENDING | 70 | t | Disclosed Encumbrances and Interests | [Pending — state whether any liens, leases, or other
HORSE_BILL_OF_SALE | BOS_GOVERNING | BOS_GOVERNING.CHOICE | 10 | t | << SECTION PREAMBLE >> | This Bill of Sale is governed by the laws of the Sta
HORSE_BILL_OF_SALE | BOS_GOVERNING | BOS_GOVERNING.STANDALONE | 20 | t | << SECTION PREAMBLE >> | This Bill of Sale is governed by the laws of the Sta
HORSE_BILL_OF_SALE | BOS_GOVERNING | BOS_GOVERNING.PENDING | 30 | t | << SECTION PREAMBLE >> | [Pending — state whether a Horse Sale and Purchase A
HORSE_BILL_OF_SALE | BOS_HORSE | BOS_HORSE.IDENTITY | 10 | f | << SECTION PREAMBLE >> | This Bill of Sale conveys the following horse (the "
HORSE_BILL_OF_SALE | BOS_SIGNATURES | BOS_SIGNATURES.BLOCK | 10 | f | << SECTION PREAMBLE >> | IN WITNESS WHEREOF, Seller and Buyer execute this Bi
HORSE_BILL_OF_SALE | BOS_SIGNATURES | BOS_SIGNATURES.SELLER_CAPACITY | 20 | t | << SECTION PREAMBLE >> | By: {{SELLER.ENTITY_SIGNER_NAME}} / Title: {{SELLER.
HORSE_BILL_OF_SALE | BOS_SIGNATURES | BOS_SIGNATURES.BUYER_BLOCK | 30 | f | << SECTION PREAMBLE >> | BUYER / Signature: {{SIG.BUYER.NAME}} / Printed Name
HORSE_BILL_OF_SALE | BOS_SIGNATURES | BOS_SIGNATURES.BUYER_CAPACITY | 40 | t | << SECTION PREAMBLE >> | By: {{BUYER.ENTITY_SIGNER_NAME}} / Title: {{BUYER.EN
HORSE_BILL_OF_SALE | BOS_SIGNATURES | BOS_SIGNATURES.COBUYER_BLOCK | 50 | t | << SECTION PREAMBLE >> | CO-BUYER / Signature: {{SIG.COBUYER.NAME}} / Printed
HORSE_BILL_OF_SALE | BOS_SIGNATURES | BOS_SIGNATURES.COBUYER_CAPACITY | 60 | t | << SECTION PREAMBLE >> | By: {{COBUYER.ENTITY_SIGNER_NAME}} / Title: {{COBUYE
HORSE_BILL_OF_SALE | BOS_TITLE | BOS_TITLE.INTRO | 10 | f | << SECTION PREAMBLE >> | EQUINE BILL OF SALE. This Bill of Sale is made effec
HORSE_BILL_OF_SALE | BOS_TITLE | BOS_TITLE.CO_BUYER | 20 | t | << SECTION PREAMBLE >> | {{COBUYER.FULL_NAME}} of {{COBUYER.ADDRESS}} ("Co-Bu
HORSE_BILL_OF_SALE | BOS_WARRANTY | BOS_WARRANTY.TITLE | 10 | f | << SECTION PREAMBLE >> | Seller warrants that Seller is the lawful owner of t
HORSE_BILL_OF_SALE | BOS_WARRANTY | BOS_WARRANTY.CONDITION_XREF | 20 | t | << SECTION PREAMBLE >> | The Horse is conveyed subject to, and with the benef
HORSE_BILL_OF_SALE | BOS_WARRANTY | BOS_WARRANTY.CONDITION_STANDALONE | 30 | t | << SECTION PREAMBLE >> | Except for the warranty of title above and the repre
HORSE_BILL_OF_SALE | BOS_WARRANTY | BOS_WARRANTY.PENDING | 40 | t | << SECTION PREAMBLE >> | [Pending — state whether a Horse Sale and Purchase A
HORSE_LEASE_V2 | CARE | CARE.INTRO | 5 | f | 3rd Party Exercise | Horse care and expenses shall be managed and paid fo
HORSE_LEASE_V2 | CARE | CARE.SUPPLEMENTS | 10 | f | 3rd Party Exercise | {{TXN.MEDICATIONS}}
HORSE_LEASE_V2 | CARE | CARE.PROTECTIVE_EQUIP | 62 | t | Protective Equipment | Lessor will provide the following equipment for the 
HORSE_LEASE_V2 | CARE | CARE.RIDER_AIDS_OTHER | 92 | t | Rider Aids | Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.LESSOR_PENDING | 10 | t | << SECTION PREAMBLE >> | [Pending — select whether Lessor is an individual or
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.LESSOR_IND | 20 | t | << SECTION PREAMBLE >> | "Lessor Parties" means Lessor; Lessor's spouse and f
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.LESSOR_ENT | 30 | t | << SECTION PREAMBLE >> | "Lessor Parties" means Lessor; Lessor's parent, subs
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.LESSEE_PENDING | 40 | t | << SECTION PREAMBLE >> | [Pending — select whether Lessee is an individual or
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.LESSEE_IND | 50 | t | << SECTION PREAMBLE >> | "Lessee Parties" means Lessee; Lessee's spouse and f
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.LESSEE_ENT | 60 | t | << SECTION PREAMBLE >> | "Lessee Parties" means Lessee; Lessee's parent, subs
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.BINDING | 70 | f | << SECTION PREAMBLE >> | Each release, waiver, assumption of risk, and covena
HORSE_LEASE_V2 | DEFINITIONS | DEFINITIONS.BENEFICIARIES | 80 | f | << SECTION PREAMBLE >> | Each Lessor Party and each Lessee Party who is not a
HORSE_LEASE_V2 | EVALUATION | EVALUATION.CHOICE | 10 | f | << SECTION PREAMBLE >> | 
HORSE_LEASE_V2 | EVALUATION | EVALUATION.REFUSED | 40 | t | Evaluation Period Details | No evaluation period applies to this Agreement. The 
HORSE_LEASE_V2 | EVALUATION | EVALUATION.WAIVED | 41 | t | Evaluation Period Details | No evaluation period applies to this Agreement. The 
HORSE_LEASE_V2 | HORSE | HORSE.COOWNERS | 22 | f | Ownership of the Horse | Co-owners: {{TXN.CO_OWNERS}}
HORSE_LEASE_V2 | HORSE | HORSE.OWNERSHIP_LIMITS_Q | 25 | f | Ownership of the Horse | Are there any ownership related leasing restrictions
HORSE_LEASE_V2 | HORSE | HORSE.OWNERSHIP_LIMITS | 26 | t | Ownership of the Horse | Ownership related leasing restrictions: {{TXN.OWNERS
HORSE_LEASE_V2 | HORSE | HORSE.BEHAVIOR_EXC | 32 | t | Behavior | The Lessor notes the following known exceptions to t
HORSE_LEASE_V2 | HORSE | HORSE.CONDITION_EXC | 42 | t | Physical Condition | The Lessor notes the following known exceptions to t
HORSE_LEASE_V2 | HORSE | LOCATION.MOVE_CHOICE | 57 | f | Location | 
HORSE_LEASE_V2 | HORSE | LOCATION.NEW | 58 | t | Location | Location during lease term: {{TXN.NEW_LOCATION}}
HORSE_LEASE_V2 | HORSE | LOCATION.INSPECTION | 59 | f | Location | Lessor may inspect the Horse at any time, subject to
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.GL_STATUS | 155 | t | General Liability Insurance | Lessor: {{TXN.GL_LESSOR_STATUS}} general liability i
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.GL_DED_SIMPLE | 162 | t | General Liability Insurance | If a claim is made under any such policy arising fro
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.GL_DED_SPLITC | 164 | t | General Liability Insurance | The deductible shall be split between the parties: {
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.GL_NONE | 168 | t | General Liability Insurance | Lessor has elected not to require general liability 
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MORT_STATUS | 205 | t | Mortality Insurance | Lessor: {{TXN.MORT_LESSOR_STATUS}} mortality insuran
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MORT_DEDR_SIMPLE | 214 | t | Mortality Insurance | If a claim is made under any such policy arising fro
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MORT_DEDR_SPLITC | 215 | t | Mortality Insurance | The deductible shall be split between the parties: {
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MORT_NONE | 220 | t | Mortality Insurance | Lessor has elected not to require mortality insuranc
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MED_NONE | 305 | t | Medical Insurance | Lessor has elected not to maintain medical insurance
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MED_STATUS | 308 | t | Medical — Lessee Responsibility | Lessor: {{TXN.MED_LESSOR_STATUS}} medical insurance 
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MED_DEDR_SIMPLE | 314 | t | Medical — Lessee Responsibility | If a claim is made under any such policy arising fro
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MED_DEDR_SPLITC | 315 | t | Medical — Lessee Responsibility | The deductible shall be split between the parties: {
HORSE_LEASE_V2 | INSURANCE_RISK | INSURANCE_RISK.MED_TAIL | 320 | t | Medical — Lessee Responsibility | Any out-of-pocket costs for deductibles or other exp
HORSE_LEASE_V2 | LEASE_FEE | LEASE_FEE.CHOICE | 5 | f | << SECTION PREAMBLE >> | {{TXN.LEASE_FEE}} / If no monetary lease fee is paya
HORSE_LEASE_V2 | PARTIES | PARTIES.INTRO | 10 | f | << SECTION PREAMBLE >> | This Horse Lease Agreement (the "Agreement") is made
HORSE_LEASE_V2 | PAYMENT_METHOD | PAYMENT_METHOD.CARD | 20 | t | Payments by the Lessee | Credit card payments are processed as follows: {{TXN
HORSE_LEASE_V2 | PAYMENT_METHOD | PAYMENT_METHOD.CARD_LESSOR | 40 | t | Payments by the Lessor | Credit card payments are processed as follows: {{TXN
HORSE_LEASE_V2 | PERMITTED_USE | PERMITTED_USE.TRAINER | 200 | t | Permitted Use(s) | Riding Lessons, Jumping, and Competitions may take p
HORSE_LEASE_V2 | PERMITTED_USE | RESTRICT.COMP_ON | 313 | t | Competition Restrictions | Competitions are restricted as follows: {{TXN.COMP_R
HORSE_LEASE_V2 | PERMITTED_USE | RESTRICT.COMP_OFF | 314 | t | Competition Restrictions | Lessor does not restrict competition activity in any
HORSE_LEASE_V2 | PERMITTED_USE | RESTRICT.JUMP_ON | 321 | t | Jumping Restrictions | Jumping is restricted as follows: maximum height {{T
HORSE_LEASE_V2 | PERMITTED_USE | RESTRICT.JUMP_OFF | 322 | t | Jumping Restrictions | Lessor does not restrict jumping activity in any way
HORSE_LEASE_V2 | PERMITTED_USE | RESTRICT.TRAIL_ON | 331 | t | Trail-Riding Restrictions | Trail riding is restricted as follows: {{TXN.TRAIL_R
HORSE_LEASE_V2 | PERMITTED_USE | RESTRICT.TRAIL_OFF | 332 | t | Trail-Riding Restrictions | Lessor does not restrict trail-riding activity in an
HORSE_LEASE_V2 | PERMITTED_USE | PROHIBITED.OTHER_NOTE | 460 | t | Other Allowed Activities | Other additional permitted activity: {{TXN.ADDITIONA
HORSE_LEASE_V2 | PERMITTED_USE | PROHIBITED.OTHERS_OTHER | 490 | t | Allowing Others to Ride | Other persons allowed to ride or handle the Horse: {
HORSE_LEASE_V2 | SCHEDULE | SCHEDULE.OTHER | 12 | t | Schedule for Lessee's Usage | Additional or custom schedule terms: {{TXN.SCHEDULE_
HORSE_LEASE_V2 | SIGNATURES | SIGNATURES.LESSEE_CAPACITY | 11 | t | Signatures | By: {{LESSEE.ENTITY_SIGNER_NAME}} / Title: {{LESSEE.
HORSE_LEASE_V2 | SIGNATURES | SIGNATURES.LESSOR_CAPACITY | 12 | t | Signatures | By: {{LESSOR.ENTITY_SIGNER_NAME}} / Title: {{LESSOR.
HORSE_LEASE_V2 | TERM | TERM.FIXED_END | 12 | t | Agreement Term | This Agreement continues until {{TXN.LEASE_END}}
HORSE_LEASE_V2 | TERM | TERM.ADDITIONAL | 22 | f | Renewal Terms | Additional terms: {{TXN.ADDITIONAL_TERMS}}
HORSE_LEASE_V2 | TERM | TERM.TERMINATION_XREF | 30 | f | Renewal Terms | Notwithstanding the term stated above, this Agreemen
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.SELLER_IND | 10 | t | << SECTION PREAMBLE >> | "Seller Parties" means Seller; Seller's spouse and f
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.SELLER_ENT | 20 | t | << SECTION PREAMBLE >> | "Seller Parties" means Seller; Seller's parent, subs
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.SELLER_PENDING | 30 | t | << SECTION PREAMBLE >> | [Pending — select whether Seller is an individual or
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.BUYER_IND | 40 | t | << SECTION PREAMBLE >> | "Buyer Parties" means Buyer; Buyer's spouse and fami
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.BUYER_ENT | 50 | t | << SECTION PREAMBLE >> | "Buyer Parties" means Buyer; Buyer's parent, subsidi
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.BUYER_PENDING | 60 | t | << SECTION PREAMBLE >> | [Pending — select whether Buyer is an individual or 
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.CLOSING | 70 | f | << SECTION PREAMBLE >> | "Closing" means the moment at which both of the foll
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.BINDING | 80 | f | << SECTION PREAMBLE >> | Each release, waiver, assumption of risk, and covena
HORSE_SALE_V2 | DEFINITIONS | DEFINITIONS.BENEFICIARIES | 90 | f | << SECTION PREAMBLE >> | Each Seller Party and each Buyer Party who is not a 
HORSE_SALE_V2 | HORSE | HORSE.INJURY_HISTORY_PENDING | 80 | t | Serious Injury History Disclosed | [Pending — state whether anyone has been seriously i
HORSE_SALE_V2 | PARTIES | PARTIES.INTRO | 10 | f | << SECTION PREAMBLE >> | This Horse Sale and Purchase Agreement (the "Agreeme
HORSE_SALE_V2 | PARTIES | PARTIES.CO_BUYER_PENDING | 30 | t | Co-Buyer | [Pending — state whether there is a co-buyer. This p
HORSE_SALE_V2 | PARTIES | PARTIES.CO_BUYER_TITLE_DETAIL | 40 | t | Co-Buyer | Title detail: {{TXN.CO_BUYER_TITLE_DETAIL}}
HORSE_SALE_V2 | PPE | PPE.PENDING | 40 | t | Examination Waived | [Pending — select whether a pre-purchase examination
HORSE_SALE_V2 | PRICE | PRICE.INSTALLMENTS_PENDING | 60 | t | Installment Terms | [Pending — select whether the Purchase Price is paid
HORSE_SALE_V2 | SIGNATURES | SIGNATURES.BUYER_CAPACITY | 20 | t | Signatures | By: {{BUYER.ENTITY_SIGNER_NAME}} / Title: {{BUYER.EN
HORSE_SALE_V2 | SIGNATURES | SIGNATURES.COBUYER_BLOCK | 30 | t | Signatures | CO-BUYER / Signature: {{SIG.COBUYER.NAME}} / Printed
HORSE_SALE_V2 | SIGNATURES | SIGNATURES.COBUYER_CAPACITY | 40 | t | Signatures | By: {{COBUYER.ENTITY_SIGNER_NAME}} / Title: {{COBUYE
HORSE_SALE_V2 | SIGNATURES | SIGNATURES.SELLER_BLOCK | 50 | f | Signatures | SELLER (OWNER) / Signature: {{SIG.SELLER.NAME}} / Pr
HORSE_SALE_V2 | SIGNATURES | SIGNATURES.SELLER_CAPACITY | 60 | t | Signatures | By: {{SELLER.ENTITY_SIGNER_NAME}} / Title: {{SELLER.
HORSE_SALE_V2 | TRIAL | TRIAL.NONE | 20 | t | Trial Period | No trial period applies to this sale.
HORSE_SALE_V2 | TRIAL | TRIAL.PENDING | 30 | t | Trial Period | [Pending — select whether a trial period applies. Th
(102 rows)
```
