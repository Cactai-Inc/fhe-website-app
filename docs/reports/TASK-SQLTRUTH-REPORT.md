# TASK SQLTRUTH — SQL truth recapture report (2026-08-04)

Branch: `task/sqltruth`. Migration: `supabase/migrations/20260804130000_sql_truth_recapture.sql`.
DB: project `lrstswfxfsezdmvkvukc` (verified via `.env.db` host `db.lrstswfxfsezdmvkvukc.supabase.co`).

## Correction to the task brief

The brief names `20260804110000_numbering_derives_from_headings.sql` as "the last committed
migration" for `remerge_contract_from_clauses` and describes four features as absent from git
history (blank-CUSTOM→N/A, author header/line UNION ordering via ord1/ord2, element option-label
merge, CUSTOM.% terminal punctuation).

That is stale. `origin/main` at this task's start (`418174e`) already contains
`20260804120000_add_item_composition.sql`, committed in the same merge as `110000` but after it,
which itself does a `CREATE OR REPLACE FUNCTION remerge_contract_from_clauses` carrying three of
those four features (its own header comment says so: "SECTION cursor ... UNION author-added
sections", "CLAUSE cursor ... UNION author-added headers UNION author-added lines", "CUSTOM option
labels join the label map, and a blank CUSTOM token renders 'N/A'"). Diffed byte-for-byte against
live, only **one** of the four claimed-missing features was actually missing from git: the
CUSTOM.% terminal-punctuation block. Real drift is smaller than the brief describes. This report
uses the true last-committed version of each function (found by scanning every migration file for
`CREATE OR REPLACE FUNCTION` of that name and taking the one with the latest commit in history),
not the filename the brief guessed.

## Overload check

Queried `pg_proc`/`pg_namespace` for all 11 function names (4 primary + 7 neighbor). Every name
resolved to exactly one `public` schema OID — no overloads on any of them.

```
   oid  |               proname               |                                                args
--------+--------------------------------------+----------------------------------------------------------------------------------------------------
  26224 | add_contract_element                 | p_document_id uuid, p_kind text, p_section text, p_after_section text, p_position integer, ...
  29509 | apply_category_documents             | p_contact_id uuid, p_categories text[]
  26773 | clause_condition_met                 | p_cond jsonb, v_fields jsonb
  26767 | clause_cut_kept                      | p_cut text, v_fields jsonb
  26764 | contract_template_structure          | p_template_key text
  21173 | record_signature                     | p_document_id uuid, p_party_role text, p_typed_name text, p_ip text, p_user_agent text, ...
  26765 | remerge_contract_from_clauses         | p_document_id uuid
  34102 | remove_contract_composition          | p_document_id uuid, p_field_key text
  34047 | resend_executed_document_email       | p_document_id uuid
  34046 | send_executed_document_email         | p_document_id uuid
  21679 | set_contract_field                   | p_document_id uuid, p_field_key text, p_value text
```

## md5 before/after proof

Primary 4, captured via `md5(pg_get_functiondef(oid))` through `psql` immediately before and
after applying the migration:

```
BEFORE
remerge_contract_from_clauses|9206b64b57e083e9840e89af50976291
clause_condition_met|25617ae1947182b535c127d55b597ea2
clause_cut_kept|7bce501d670c33222621f78da2684121
contract_template_structure|7c1b6c5e73c520c72883176473f253b1

AFTER
remerge_contract_from_clauses|9206b64b57e083e9840e89af50976291
clause_condition_met|25617ae1947182b535c127d55b597ea2
clause_cut_kept|7bce501d670c33222621f78da2684121
contract_template_structure|7c1b6c5e73c520c72883176473f253b1
```

Identical in all four cases.

`set_contract_field` was added to the migration mid-task (item 5's "if drifted, add it") after its
raw `pg_get_functiondef` body had already been captured for the drift diff, but before a dedicated
`md5()` query was run against it — so there is no `psql`-computed *before* hash for this one
function. What was captured instead, before the migration was applied: the full raw
`pg_get_functiondef` text (saved to a file). After applying, the same query was re-run and diffed
byte-for-byte against that pre-apply file — `diff` reported no differences — and `md5` was run on
both files locally, giving the same digest both times:

```
pre-apply dump vs post-apply dump: diff -> (no output, byte-identical)
md5 (local, both files): 414a55c83769e6a78e68a0bce77c9c93
```

This is a weaker proof than the server-side before/after `md5()` pair used for the other four (it
relies on the file capture being an exact copy of what `psql` returned, rather than two independent
server-side hash computations), but it demonstrates the same thing: applying the migration changed
nothing about this function's live definition.

## Drift diffs: last-committed migration vs live (primary 4 + drifted neighbor)

"lastcommit" = the function body from the most recent migration file in git history that defines
that function, found by grepping every `supabase/migrations/*.sql` for `CREATE (OR REPLACE)?
FUNCTION <name>` and taking the one from the latest commit touching it (verified with `git log`
where two migration files shared a timestamp prefix). "live" = `pg_get_functiondef` captured before
this task applied anything.

- `remerge_contract_from_clauses`: lastcommit = `20260804120000_add_item_composition.sql`. **DRIFTED** — one real diff: the CUSTOM.% terminal-punctuation block (an `IF v_cl.clause_key LIKE 'CUSTOM.%' ...` append of a trailing period) present live, absent in git.
- `clause_condition_met`: lastcommit = `20260727220000_lease_v2_deductible_gating.sql`. **MATCHES** — the only diff is `pg_get_functiondef`'s own cosmetic reformatting (trailing blank line), no logic difference.
- `clause_cut_kept`: lastcommit = `20260720161000_clause_composition.sql`. **MATCHES** — diff is only `pg_get_functiondef`'s canonical formatting (multi-line signature, `$fn$`→`$function$` tag rename); function body content is identical.
- `contract_template_structure`: lastcommit = `20260720160000_authoring_clause_model.sql`. **DRIFTED** — one real diff: live's clause object includes `'body', c.body,`, absent in git (plus the same cosmetic formatting diffs as above).
- `set_contract_field`: lastcommit = `20260802090001_sale_engine_functions.sql`. **DRIFTED** — two real diffs: (1) live calls `assert_not_signature_locked(p_document_id)` where git still has `void_signatures_on_edit(p_document_id)`; (2) live has removed the `HORSE.%` writeback block (`contract_horse_field_writeback`) entirely, replaced with a comment noting it was intentionally removed 2026-08-03 (Deal plan L10) — git still has the writeback call live.

Full unified diffs:

```diff
### remerge_contract_from_clauses (lastcommit=20260804120000_add_item_composition.sql vs live)
@@ -105,7 +105,17 @@
         FOREACH v_line IN ARRAY v_lines LOOP
           v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
           v_any_token := coalesce(array_length(v_toks,1),0) > 0;
-          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;
+          IF NOT v_any_token THEN
+            /* R11: an AUTHORED line is never typed with a closing period —
+               the composer supplies terminal punctuation here, exactly as R5
+               does for a token-bearing line. Template prose is left verbatim:
+               its punctuation is part of the drafted instrument. */
+            IF v_cl.clause_key LIKE 'CUSTOM.%' AND btrim(v_line) <> ''
+               AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
+              v_line := v_line || '.';
+            END IF;
+            v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE;
+          END IF;
           -- line-level field gating: if any token on this line is a field with an
           -- unmet conditional_on, drop the whole line.
           IF EXISTS (
@@ -262,4 +272,5 @@
   UPDATE documents SET merged_body = v_body WHERE id = p_document_id AND workflow_state <> 'executed';
   RETURN v_body;
 END;
-$function$;
+$function$
+

### clause_condition_met (lastcommit=20260727220000_lease_v2_deductible_gating.sql vs live)
@@ -63,4 +63,5 @@

   RETURN false;
 END;
-$function$;
+$function$
+

### clause_cut_kept (lastcommit=20260720161000_clause_composition.sql vs live)
@@ -1,7 +1,9 @@
 CREATE OR REPLACE FUNCTION public.clause_cut_kept(p_cut text, v_fields jsonb)
-RETURNS boolean
-LANGUAGE sql IMMUTABLE SET search_path TO 'public'
-AS $fn$
+ RETURNS boolean
+ LANGUAGE sql
+ IMMUTABLE
+ SET search_path TO 'public'
+AS $function$
   SELECT CASE p_cut
     WHEN 'EVALUATION_PERIOD' THEN
       coalesce(v_fields->>'TXN.EVALUATION_START','') <> '' OR coalesce(v_fields->>'TXN.EVALUATION_END','') <> ''
@@ -16,4 +18,5 @@
       OR coalesce(v_fields->>'TXN.COMPETITION_EXPENSES','') <> ''
     ELSE true
   END;
-$fn$;
+$function$
+

### contract_template_structure (lastcommit=20260720160000_authoring_clause_model.sql vs live)
@@ -1,7 +1,9 @@
 CREATE OR REPLACE FUNCTION public.contract_template_structure(p_template_key text)
-RETURNS jsonb
-LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
-AS $fn$
+ RETURNS jsonb
+ LANGUAGE sql
+ STABLE SECURITY DEFINER
+ SET search_path TO 'public'
+AS $function$
   SELECT jsonb_build_object(
     'template_key', p_template_key,
     'sections', coalesce((
@@ -15,6 +17,7 @@
           SELECT jsonb_agg(jsonb_build_object(
             'clause_key', c.clause_key,
             'heading', c.heading,
+            'body', c.body,
             'clause_type', c.clause_type,
             'sort_order', c.sort_order,
             'is_optional', c.is_optional,
@@ -28,6 +31,5 @@
       FROM contract_section_defs s WHERE s.template_key = p_template_key
     ), '[]'::jsonb)
   );
-$fn$;
-REVOKE ALL ON FUNCTION contract_template_structure(text) FROM public, anon;
-GRANT EXECUTE ON FUNCTION contract_template_structure(text) TO authenticated, service_role;
+$function$
+

### set_contract_field (lastcommit=20260802090001_sale_engine_functions.sql vs live)
@@ -138,7 +138,7 @@
   -- signature is voided. A save that writes back the identical value is not
   -- an edit and must leave signatures intact. The signer is told at the next SEND.
   IF v_changed THEN
-    PERFORM void_signatures_on_edit(p_document_id);
+    PERFORM assert_not_signature_locked(p_document_id);
   END IF;

   UPDATE contract_fields
@@ -155,11 +155,8 @@
      WHERE id = p_document_id;
   END IF;

-  -- bidirectional horse sync (contract → record): open states only, party or
-  -- staff, never clobbers a differing value, idempotent when unchanged.
-  IF p_field_key LIKE 'HORSE.%' THEN
-    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);
-  END IF;
+  -- (horse writeback removed 2026-08-03: record values are edited at their
+  -- source, never written back from a document. Deal plan L10.)

   -- audit: only log an actual change
   IF v_changed THEN
@@ -185,4 +182,5 @@
     'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
     'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
 END;
-$function$;
+$function$
+
```

## Neighbor drift scan (report-only unless drifted)

| function | verdict | note |
|---|---|---|
| `record_signature` | MATCHES | only `pg_get_functiondef`'s own cosmetic trailing-blank-line diff; body identical |
| `send_executed_document_email` | MATCHES | only cosmetic signature-line reformatting; body identical |
| `resend_executed_document_email` | MATCHES | only cosmetic signature-line reformatting; body identical |
| `apply_category_documents` | MATCHES | only cosmetic trailing-blank-line diff |
| `add_contract_element` | MATCHES | only cosmetic trailing-blank-line diff |
| `remove_contract_composition` | MATCHES | only cosmetic signature-line reformatting |
| `set_contract_field` | **DRIFTED** | `assert_not_signature_locked` vs `void_signatures_on_edit`, and HORSE.% writeback removed live but still present in git — recaptured into the migration (see above) |

## What the migration does

`supabase/migrations/20260804130000_sql_truth_recapture.sql` contains `CREATE OR REPLACE FUNCTION`
for all 5 of: `remerge_contract_from_clauses`, `clause_condition_met`, `clause_cut_kept`,
`contract_template_structure`, `set_contract_field` — verbatim live bodies, byte-for-byte
(`clause_condition_met` and `clause_cut_kept` are included even though they showed no real drift,
per work item 2's instruction to capture all four primary functions; `set_contract_field` was added
per work item 5 because it drifted). No reformatting, no cleanup. Verified with a `BEGIN; ... 
ROLLBACK;` dry run before the real apply. Applied live; the md5/diff proof above shows it changed
nothing.

## Done-checks

- `npm run typecheck` — clean (0 errors).
- `npm run lint` — 0 errors, 29 pre-existing warnings (all in files untouched by this task; no TSX
  was edited — `ClauseDocument.tsx` untouched, in fact no `.tsx` file was touched at all).
- No retries were needed — nothing failed on the first attempt.
