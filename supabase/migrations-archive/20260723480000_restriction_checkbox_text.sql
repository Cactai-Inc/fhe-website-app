-- Restriction clauses: reword the "do not restrict …" checkboxes to the tighter
-- "No [activity] restrictions" phrasing. These are certify checkboxes whose label
-- is the displayed text.

UPDATE contract_field_defs SET label='No jumping restrictions'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.JUMP_OMIT';

UPDATE contract_field_defs SET label='No competition restrictions'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.COMP_OMIT';

UPDATE contract_field_defs SET label='No trail-riding restrictions'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAIL_OMIT';
