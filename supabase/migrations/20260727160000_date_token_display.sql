-- Date tokens in contract prose render as "August 15, 2026" instead of raw ISO
-- "2026-08-15" — matching the style DOC.EFFECTIVE_DATE already uses
-- (to_char 'FMMonth FMDD, YYYY' in remerge_contract_from_clauses).
-- token_display_value is value-based (it does not see the field def), so the
-- branch recognizes exact ISO-date values; date-input fields store exactly this
-- shape, and a free-text value that IS an ISO date is still a date.

BEGIN;

CREATE OR REPLACE FUNCTION public.token_display_value(p_token text, p_raw text, p_labels jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(p_raw,'') = '' THEN ''
    -- pure include-toggles (checkbox controls) emit no document text; they only
    -- gate their target clause. Convention: token key ends in _INCLUDE.
    WHEN p_token LIKE '%\_INCLUDE' THEN ''
    -- ISO date values render in written-out style, matching DOC.EFFECTIVE_DATE
    WHEN p_raw ~ '^\d{4}-\d{2}-\d{2}$'
      THEN to_char(to_date(p_raw, 'YYYY-MM-DD'), 'FMMonth FMDD, YYYY')
    WHEN p_raw LIKE '%,%' AND p_labels ? p_token THEN (
      SELECT string_agg(
               coalesce(p_labels #>> ARRAY[p_token, btrim(v)], btrim(v)),
               ', ' ORDER BY ord)
        FROM unnest(string_to_array(p_raw, ',')) WITH ORDINALITY AS t(v, ord)
        WHERE btrim(v) <> ''
    )
    WHEN p_labels #>> ARRAY[p_token, p_raw] IS NOT NULL
      THEN p_labels #>> ARRAY[p_token, p_raw]
    WHEN upper(p_raw) = 'YES' THEN 'Yes'
    WHEN upper(p_raw) = 'NO'  THEN 'No'
    ELSE p_raw
  END;
$function$;

DO $$
BEGIN
  IF token_display_value('TXN.LEASE_START', '2026-08-15', '{}'::jsonb) <> 'August 15, 2026' THEN
    RAISE EXCEPTION 'date restyle failed: %', token_display_value('TXN.LEASE_START', '2026-08-15', '{}'::jsonb);
  END IF;
  IF token_display_value('TXN.NOTES', 'plain text', '{}'::jsonb) <> 'plain text' THEN
    RAISE EXCEPTION 'non-date passthrough broken';
  END IF;
END $$;

COMMIT;
