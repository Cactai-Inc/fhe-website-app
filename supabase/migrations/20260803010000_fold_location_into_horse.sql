-- Fold "Location of the Horse" into THE HORSE section (owner directive
-- 2026-08-03): the standalone LOCATION section (rendered as its own numbered
-- section) moves under HORSE, between the pre-lease evaluations and the
-- Disclaimer of Warranties closer. Clause keys are unchanged (keys are
-- identity, section placement is layout); numbering is order-derived
-- everywhere, so renumbering flows automatically.
UPDATE contract_clause_defs SET section_key='HORSE', sort_order=56
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.MAIN' AND section_key='LOCATION';
UPDATE contract_clause_defs SET section_key='HORSE', sort_order=57
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.MOVE_CHOICE' AND section_key='LOCATION';
UPDATE contract_clause_defs SET section_key='HORSE', sort_order=58
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.NEW' AND section_key='LOCATION';
UPDATE contract_clause_defs SET section_key='HORSE', sort_order=59
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.INSPECTION' AND section_key='LOCATION';

UPDATE contract_field_defs SET section='HORSE'
 WHERE template_key='HORSE_LEASE_V2' AND section='LOCATION';

-- Open (non-executed) documents carry seeded copies of the section on their
-- contract_fields rows — regroup them so the editor files the fields under
-- The Horse. Executed documents are frozen instruments; untouched.
UPDATE contract_fields cf SET section='HORSE'
  FROM documents d JOIN contract_templates ct ON ct.id=d.template_id
 WHERE cf.document_id=d.id AND ct.template_key='HORSE_LEASE_V2'
   AND cf.section='LOCATION' AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;

DELETE FROM contract_section_defs
 WHERE template_key='HORSE_LEASE_V2' AND section_key='LOCATION';
