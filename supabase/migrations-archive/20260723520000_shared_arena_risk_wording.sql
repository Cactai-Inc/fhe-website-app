-- Shared Arena Riding Risks: its closing phrase is mid-sentence ("… and
-- voluntarily assumes these additional risks."), so the prior regex (which
-- matched the sentence starting "Lessee voluntarily assumes …") missed it. Update
-- this one to the broadened wording, preserving its mid-sentence "and".
UPDATE contract_clause_defs
   SET body = replace(
        body,
        'and voluntarily assumes these additional risks.',
        'and voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SHARED_ARENA_RISKS';
