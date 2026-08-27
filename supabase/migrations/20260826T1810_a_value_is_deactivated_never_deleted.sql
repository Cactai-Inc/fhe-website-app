-- The option lists become editable, safely (TASK-CONTRACTOPTIONS §1, §3, §4)
--
-- THE FIVE RULES, and where each one lives:
--   1. A value is DEACTIVATED, never deleted, never re-coded  -> set_active / recode
--   2. An edit MINTS A NEW TEMPLATE VERSION                   -> every mutator calls save_
--   3. The unsafe edit is REFUSED, not warned about           -> contract_menu_recode raises
--   4. ADDING writes to BOTH stores                           -> add_value (the Bell Boots rule)
--   5. EXECUTED OR SIGNED DOCUMENTS ARE NEVER TOUCHED         -> _contract_document_frozen
--
-- ⚠️ THE FLAG LIVES INSIDE THE JSON, because `contract_field_defs` has no `active`
-- column and the list is jsonb. An entry with NO `active` key reads as ACTIVE: all
-- 212 live lists predate the flag and none of them is retired.
--
-- ⚠️ AND THE FULL LIST IS KEPT EVERYWHERE, flags and all -- nothing is stripped at
-- generation. One rule then holds in every reader: THE PICKER FILTERS ON `active`,
-- THE LABEL RESOLVER DOES NOT. Stripping retired entries out of a document's
-- snapshot would make a historic selection render as a raw code, which is the exact
-- failure deactivation exists to prevent -- and it would make reactivation
-- irreversible on documents already generated.

-- ── frozen: executed, or signed by anybody ─────────────────────────────────
-- §3 and §5 of the brief: "executed or signed". Signature-bearing is included
-- deliberately and conservatively -- clearing an answer out from under a party
-- who has already signed it is the one outcome no amount of logging repairs.
CREATE OR REPLACE FUNCTION public._contract_document_frozen(p_document_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT d.workflow_state = 'executed' OR d.status = 'EXECUTED'
       FROM documents d WHERE d.id = p_document_id), true)
  OR EXISTS (SELECT 1 FROM signatures s
              WHERE s.document_id = p_document_id AND s.deleted_at IS NULL);
$function$;

-- ── rewrite one entry of an options array, by code ─────────────────────────
CREATE OR REPLACE FUNCTION public._options_patch(
  p_options jsonb, p_code text, p_patch jsonb
) RETURNS jsonb
 LANGUAGE sql IMMUTABLE
AS $function$
  SELECT coalesce(jsonb_agg(
           CASE WHEN o ->> 'value' = p_code THEN o || p_patch ELSE o END
           ORDER BY ord), p_options)
    FROM jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) WITH ORDINALITY t(o, ord);
$function$;

-- ── remove one code from a stored value (single or comma-joined multi) ─────
CREATE OR REPLACE FUNCTION public._value_without_code(p_value text, p_code text)
 RETURNS text
 LANGUAGE sql IMMUTABLE
AS $function$
  SELECT nullif(array_to_string(ARRAY(
    SELECT btrim(x) FROM regexp_split_to_table(coalesce(p_value, ''), ',') x
     WHERE btrim(x) <> '' AND btrim(x) <> p_code), ', '), '');
$function$;

-- ══ DEACTIVATE / REACTIVATE ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.contract_menu_set_active(
  p_template_key text, p_field_key text, p_code text, p_active boolean
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opt      jsonb;
  v_before   jsonb;
  r          record;
  v_new      text;
  v_blk_before int;
  v_blk_after  int;
  v_cleared  jsonb := '[]'::jsonb;
  v_reopened jsonb := '[]'::jsonb;
  v_touched  int := 0;
  v_version  int;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin access required'; END IF;

  SELECT o INTO v_opt
    FROM contract_field_defs f, LATERAL jsonb_array_elements(f.options) o
   WHERE f.template_key = p_template_key AND f.field_key = p_field_key
     AND o ->> 'value' = p_code
   LIMIT 1;
  IF v_opt IS NULL THEN
    RAISE EXCEPTION 'no option % on %.%', p_code, p_template_key, p_field_key;
  END IF;

  -- What the caller is about to affect, captured BEFORE the write so the return
  -- value describes the decision they made rather than the world after it.
  v_before := contract_menu_dependents(p_template_key, p_field_key, p_code);

  -- 1 ── the template
  UPDATE contract_field_defs
     SET options = _options_patch(options, p_code, jsonb_build_object('active', p_active))
   WHERE template_key = p_template_key AND field_key = p_field_key;

  -- 2 ── every document that is still allowed to change
  FOR r IN
    SELECT cf.id, cf.document_id, cf.value, cf.label, cf.owner_role, cf.required, d.title
      FROM contract_fields cf
      JOIN documents d ON d.id = cf.document_id AND d.deleted_at IS NULL
      JOIN contract_templates ct ON ct.id = d.template_id
     WHERE ct.template_key = p_template_key
       AND cf.field_key = p_field_key
       AND NOT _contract_document_frozen(cf.document_id)
  LOOP
    UPDATE contract_fields
       SET options = _options_patch(options, p_code, jsonb_build_object('active', p_active))
     WHERE id = r.id;
    v_touched := v_touched + 1;

    -- ⚠️ A DRAFT TAKES THE NEW OPTIONS, SO A SELECTED OLD OPTION IS CLEARED
    -- (owner, 2026-08-26). Only on the way OUT -- reactivating never rewrites
    -- an answer, because nothing about it became untrue.
    CONTINUE WHEN p_active OR NOT _value_selects_code(r.value, p_code);

    SELECT jsonb_array_length(coalesce(contract_lock_blockers(r.document_id), '[]'::jsonb))
      INTO v_blk_before;

    v_new := _value_without_code(r.value, p_code);
    UPDATE contract_fields SET value = v_new WHERE id = r.id;

    -- ⚠️ LOGGED, ALWAYS. "A value vanishing with no trace is indistinguishable
    -- from a bug, and the author will swear they answered it."
    PERFORM log_contract_change(
      r.document_id, 'option_retired', p_field_key, r.label, r.owner_role,
      r.value, v_new,
      jsonb_build_object('code', p_code, 'label', v_opt ->> 'label',
                         'reason', 'the option was retired on the template'));

    SELECT jsonb_array_length(coalesce(contract_lock_blockers(r.document_id), '[]'::jsonb))
      INTO v_blk_after;

    v_cleared := v_cleared || jsonb_build_object(
      'document_id', r.document_id, 'title', r.title,
      'was', r.value, 'now', v_new, 'required', coalesce(r.required, false));

    -- ⚠️ RETIRING AN OPTION CAN UN-READY A CONTRACT THAT WAS READY TO SIGN.
    -- Correct, and the person who did it has to be told which ones.
    IF v_blk_after > v_blk_before THEN
      v_reopened := v_reopened || jsonb_build_object(
        'document_id', r.document_id, 'title', r.title,
        'blockers_before', v_blk_before, 'blockers_after', v_blk_after);
    END IF;
  END LOOP;

  -- 3 ── the template's new version (D33: the live template must not drift
  -- ahead of its own retained version)
  v_version := save_contract_template_version(p_template_key);

  RETURN jsonb_build_object(
    'ok', true, 'action', CASE WHEN p_active THEN 'reactivated' ELSE 'deactivated' END,
    'template_key', p_template_key, 'field_key', p_field_key, 'code', p_code,
    'label', v_opt ->> 'label',
    'template_version', v_version,
    'documents_updated', v_touched,
    'dependents', v_before,
    'cleared',  v_cleared,
    'reopened', v_reopened);
END;
$function$;

-- ══ RELABEL — the label may change, the code may not ══════════════════════
CREATE OR REPLACE FUNCTION public.contract_menu_relabel(
  p_template_key text, p_field_key text, p_code text, p_label text
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_touched int := 0; v_version int; v_exists boolean;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin access required'; END IF;
  IF coalesce(btrim(p_label), '') = '' THEN
    RAISE EXCEPTION 'a label cannot be blank';
  END IF;

  SELECT EXISTS (SELECT 1 FROM contract_field_defs f, LATERAL jsonb_array_elements(f.options) o
                  WHERE f.template_key = p_template_key AND f.field_key = p_field_key
                    AND o ->> 'value' = p_code) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'no option % on %.%', p_code, p_template_key, p_field_key;
  END IF;

  UPDATE contract_field_defs
     SET options = _options_patch(options, p_code, jsonb_build_object('label', btrim(p_label)))
   WHERE template_key = p_template_key AND field_key = p_field_key;

  -- Both stores, non-frozen only. A relabel changes no answer, so nothing is
  -- cleared and nothing re-opens -- it is the safe half of rule 1.
  WITH upd AS (
    UPDATE contract_fields cf
       SET options = _options_patch(cf.options, p_code, jsonb_build_object('label', btrim(p_label)))
      FROM documents d, contract_templates ct
     WHERE cf.document_id = d.id AND d.deleted_at IS NULL AND ct.id = d.template_id
       AND ct.template_key = p_template_key AND cf.field_key = p_field_key
       AND NOT _contract_document_frozen(cf.document_id)
     RETURNING 1)
  SELECT count(*) INTO v_touched FROM upd;

  v_version := save_contract_template_version(p_template_key);

  RETURN jsonb_build_object('ok', true, 'action', 'relabelled',
    'template_key', p_template_key, 'field_key', p_field_key, 'code', p_code,
    'label', btrim(p_label), 'template_version', v_version,
    'documents_updated', v_touched);
END;
$function$;

-- ══ ADD — safe by construction, but it must reach the live documents ══════
CREATE OR REPLACE FUNCTION public.contract_menu_add_value(
  p_template_key text, p_field_key text, p_code text, p_label text
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_entry jsonb; v_touched int := 0; v_version int; v_have jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin access required'; END IF;
  IF coalesce(btrim(p_code), '') = '' OR coalesce(btrim(p_label), '') = '' THEN
    RAISE EXCEPTION 'a value needs both a code and a label';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_field_defs
                  WHERE template_key = p_template_key AND field_key = p_field_key) THEN
    RAISE EXCEPTION 'no field %.%', p_template_key, p_field_key;
  END IF;

  SELECT o INTO v_have
    FROM contract_field_defs f, LATERAL jsonb_array_elements(f.options) o
   WHERE f.template_key = p_template_key AND f.field_key = p_field_key
     AND o ->> 'value' = btrim(p_code) LIMIT 1;
  IF v_have IS NOT NULL THEN
    -- ⚠️ INCLUDING A RETIRED ONE. Re-adding a code that already exists would
    -- give one code two meanings, which is the thing rule 1 protects against.
    RAISE EXCEPTION 'the code % already exists on %.% (%). %',
      btrim(p_code), p_template_key, p_field_key,
      CASE WHEN coalesce((v_have ->> 'active')::boolean, true)
           THEN 'active' ELSE 'retired' END,
      CASE WHEN coalesce((v_have ->> 'active')::boolean, true)
           THEN 'Relabel it instead.'
           ELSE 'Reactivate it instead — it kept its code, which is why undo is possible.' END;
  END IF;

  v_entry := jsonb_build_object('label', btrim(p_label), 'value', btrim(p_code), 'active', true);

  UPDATE contract_field_defs
     SET options = coalesce(options, '[]'::jsonb) || jsonb_build_array(v_entry)
   WHERE template_key = p_template_key AND field_key = p_field_key;

  -- ⚠️ THE BELL BOOTS LESSON (2026-08-26): updating only the template adds the
  -- option to FUTURE documents and leaves the live one without it.
  WITH upd AS (
    UPDATE contract_fields cf
       SET options = coalesce(cf.options, '[]'::jsonb) || jsonb_build_array(v_entry)
      FROM documents d, contract_templates ct
     WHERE cf.document_id = d.id AND d.deleted_at IS NULL AND ct.id = d.template_id
       AND ct.template_key = p_template_key AND cf.field_key = p_field_key
       AND NOT _contract_document_frozen(cf.document_id)
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(cf.options,'[]'::jsonb)) x
                        WHERE x ->> 'value' = btrim(p_code))
     RETURNING 1)
  SELECT count(*) INTO v_touched FROM upd;

  v_version := save_contract_template_version(p_template_key);

  RETURN jsonb_build_object('ok', true, 'action', 'added',
    'template_key', p_template_key, 'field_key', p_field_key,
    'code', btrim(p_code), 'label', btrim(p_label),
    'template_version', v_version, 'documents_updated', v_touched);
END;
$function$;

-- ══ RE-CODE — REFUSED, ALWAYS, AND IT NAMES WHAT DEPENDS ═════════════════
-- Rule 3: "REFUSE THE UNSAFE EDIT, DO NOT WARN ABOUT IT." This function exists
-- so the refusal is a thing a caller can discover and a test can prove, rather
-- than an absence someone later fills in with an UPDATE.
CREATE OR REPLACE FUNCTION public.contract_menu_recode(
  p_template_key text, p_field_key text, p_code text, p_new_code text
) RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_dep jsonb; v_t jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin access required'; END IF;
  v_dep := contract_menu_dependents(p_template_key, p_field_key, p_code);
  v_t   := v_dep -> 'totals';

  RAISE EXCEPTION USING
    ERRCODE = 'raise_exception',
    MESSAGE = format(
      'a value''s code can never change. %s names "%s": %s clause condition(s), %s field condition(s), %s option gate(s), and %s document(s) have it selected (%s of them frozen). Retire it and add a new one instead — the old code must keep resolving for every one of those.',
      p_template_key, p_code,
      v_t ->> 'clauses', v_t ->> 'fields', v_t ->> 'options',
      (v_t ->> 'documents_open')::int + (v_t ->> 'documents_frozen')::int,
      v_t ->> 'documents_frozen'),
    HINT = 'contract_menu_set_active(..., false) then contract_menu_add_value(...)';
END;
$function$;

REVOKE ALL ON FUNCTION public.contract_menu_set_active(text, text, text, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.contract_menu_relabel(text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.contract_menu_add_value(text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.contract_menu_recode(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.contract_menu_set_active(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_menu_relabel(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_menu_add_value(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_menu_recode(text, text, text, text) TO authenticated;
