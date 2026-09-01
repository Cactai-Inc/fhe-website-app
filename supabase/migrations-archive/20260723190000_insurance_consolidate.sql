-- §14 Insurance cleanup: consolidate each insurance type into ONE clause.
--
-- Before, each type (Mortality, Major Medical, Loss of Use) was TWO clauses:
--   • a header clause holding the Yes/No + a Minimum limit field, and
--   • a separate gated "…_REQ" clause repeating the minimum limit in prose plus
--     the cost/obtaining parties.
-- That produced: a duplicate "Minimum limit", odd numbering (each type ate two
-- clause numbers → 14.2, 14.4, 14.6 with hidden odd ones), and a big party-picker
-- block for the cost that broke the sentence layout.
--
-- Now each type is ONE clause. Line 1 (always) is the Yes/No; line 2 (gated on
-- YES, via the composer's line-level field gating) is the requirement sentence
-- with the single minimum limit + cost + obtaining party. The cost is a plain
-- select (Lessor/Lessee/Shared), matching the obtaining-party control.

DO $ins$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('MORTALITY',     'Mortality insurance'),
      ('MAJOR_MEDICAL', 'Major medical insurance'),
      ('LOSS_OF_USE',   'Loss of use insurance')
    ) AS x(key, phrase)
  LOOP
    -- one consolidated body on the header clause: Yes/No line + gated requirement
    UPDATE contract_clause_defs SET body =
        'Require ' || lower(t.phrase) || '? {{TXN.' || t.key || '_INSURANCE_REQ}}' || E'\n'
     || t.phrase || ' is required on the Horse with a minimum limit of {{TXN.' || t.key || '_MIN_LIMIT}}. '
        || 'Party responsible for the cost: {{TXN.' || t.key || '_COST_PARTY}}. '
        || 'Party responsible for obtaining the policy: {{TXN.' || t.key || '_OBTAIN_PARTY}}.'
     WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.' || t.key;

    -- all four fields live on the header clause now; min limit + cost + obtain are
    -- gated on YES so their whole line only appears when the insurance is required.
    UPDATE contract_field_defs
       SET clause_key = 'INSURANCE_RISK.' || t.key, conditional_on = NULL
     WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.' || t.key || '_INSURANCE_REQ';

    UPDATE contract_field_defs
       SET clause_key = 'INSURANCE_RISK.' || t.key,
           conditional_on = ('{"equals": ["YES"], "field_key": "TXN.' || t.key || '_INSURANCE_REQ"}')::jsonb
     WHERE template_key = 'HORSE_LEASE_V2'
       AND field_key IN ('TXN.' || t.key || '_MIN_LIMIT',
                         'TXN.' || t.key || '_COST_PARTY',
                         'TXN.' || t.key || '_OBTAIN_PARTY');

    -- cost party: was a big responsibility/party picker that broke the line.
    -- make it a plain inline select, same options as the obtaining party.
    UPDATE contract_field_defs
       SET input_kind = 'select', value_type = 'select', format_type = 'select',
           responsibility_kind = NULL,
           options = '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Shared","value":"SHARED"}]'::jsonb
     WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.' || t.key || '_COST_PARTY';

    -- drop the now-redundant separate requirement clause
    DELETE FROM contract_clause_defs
     WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.' || t.key || '_REQ';
  END LOOP;
END $ins$;
