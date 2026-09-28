-- CR-126 B13 — a REQUIRED certify (checkbox) must block signing until it is CHECKED.
--
-- The investigation: TXN.NO_SLAUGHTER_ACK and TXN.BUYER_ACCEPTS_DISCLOSURES were
-- required=false, so they were never lock blockers; the document read "complete"
-- with them unchecked and signing opened (the owner's report). Making them required
-- (cr126_3) is half the fix. The other half is here:
--
-- contract_lock_blockers' required-field predicate treats a field as satisfied once
-- its value is non-empty. A certify checkbox stores 'YES' when checked and 'NO' when
-- unchecked-after-touch — so a required certify the signer checked then UNCHECKED
-- holds 'NO', which is non-empty, and the blocker would let signing open with the
-- box unchecked. For a required certify, ONLY 'YES' satisfies it: 'NO' and '' must
-- both block. (Non-required certify fields — the lease include/omit toggles — are
-- untouched: a 'NO' there is a legitimate answer, and they never enter this
-- required predicate.)
--
-- In-place rewrite (the repo convention for editing a live function body): read the
-- current definition, string-replace the one predicate, re-execute. Not replayable
-- on a fresh DB, like the other ~31 in-place rewrites here — a pre-existing property.

DO $cr126_blockers$
DECLARE
  v_def text;
  v_old text := 'AND nullif(trim(coalesce(cf.value, '''')), '''') IS NULL';
  v_new text := 'AND (nullif(trim(coalesce(cf.value, '''')), '''') IS NULL'
             || ' OR (cf.format_type = ''certify'' AND upper(coalesce(cf.value, '''')) <> ''YES''))';
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc WHERE proname = 'contract_lock_blockers'
     AND pronamespace = 'public'::regnamespace;
  IF v_def IS NULL THEN RAISE EXCEPTION 'contract_lock_blockers not found'; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'expected required-field predicate not found — body changed since CR-126';
  END IF;
  -- exactly one occurrence expected (the required_fields check)
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'required-field predicate is not unique — refusing to rewrite';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END $cr126_blockers$;
