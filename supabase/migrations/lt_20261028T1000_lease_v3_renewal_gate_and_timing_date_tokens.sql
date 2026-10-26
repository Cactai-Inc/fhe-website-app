-- LEASE TEMPLATE ROUND — HORSE_LEASE_V3 defects (b) and (c).
--
-- (b) Open-ended term offers "Include renewal terms". TXN.RENEWAL_INCLUDE (the
--     certify checkbox that drives the Renewal Terms clause) had an EMPTY
--     conditional_on, so it rendered on every term type. Renewal only applies to a
--     FIXED term — an open-ended lease has no fixed end to renew from. Gate the
--     checkbox on TXN.LEASE_TERM_TYPE = FIXED. (The TERM.RENEWAL clause already
--     gates on RENEWAL_INCLUDE = YES, so hiding the checkbox hides the clause too.)
--
-- (c) The trainer- and vet-evaluation timing selectors print a RAW TOKEN as an
--     option label: " on or before {{TXN.TRAINER_TIMING_DATE}}" and the vet twin.
--     Rule 3: no token ever prints as text in an option; a date is a field. Relabel
--     the DATE option so it reads plainly, make the paired *_TIMING_DATE fields real
--     date pickers (format_type was blank), and gate each date field on its timing
--     selector = DATE so the picker appears exactly when that option is chosen. The
--     clause body already renders {{TXN.TRAINER_TIMING_DATE}} as the field value.

BEGIN;

-- (b) renewal only on a fixed term
UPDATE contract_field_defs
   SET conditional_on = '{"equals": ["FIXED"], "field_key": "TXN.LEASE_TERM_TYPE"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V3' AND field_key = 'TXN.RENEWAL_INCLUDE';

-- (c) relabel the DATE option so no token prints, trainer + vet
UPDATE contract_field_defs
   SET options = jsonb_set(options,
         '{2,label}'::text[], '" on or before a date the parties specify"'::jsonb)
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.TRAINER_TIMING', 'TXN.VET_TIMING')
   AND options -> 2 ->> 'value' = 'DATE';

-- (c) the paired date fields become date pickers, shown only when timing = DATE
UPDATE contract_field_defs
   SET format_type = 'date',
       conditional_on = '{"equals": ["DATE"], "field_key": "TXN.TRAINER_TIMING"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V3' AND field_key = 'TXN.TRAINER_TIMING_DATE';

UPDATE contract_field_defs
   SET format_type = 'date',
       conditional_on = '{"equals": ["DATE"], "field_key": "TXN.VET_TIMING"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V3' AND field_key = 'TXN.VET_TIMING_DATE';

COMMIT;
