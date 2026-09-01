-- §7.2 Ownership of the Horse — reformat so each question sits on its own line and
-- the pieces stay grouped in the right order:
--   • warrant + "I am the sole owner? [Yes/No]"          (own line)
--   • certification checkbox (when sole owner = No)       (own line, no lead-in text)
--   • "Are there any limitations on ownership? [Yes/No]"  (own line, after the checkbox)
--   • "Limitations on ownership: ____"  (when limitations = Yes, directly below)

-- 1) main clause: keep the warrant + sole-owner question; DROP the limitations
--    question from here (it moves to its own clause below). Two lines.
UPDATE contract_clause_defs
   SET body = 'Lessor warrants that Lessor owns the Horse free of liens and encumbrances and has all requisite rights and powers to enter into this Agreement.' || E'\n'
           || 'I am the sole owner of the Horse: {{TXN.IS_SOLE_OWNER}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.OWNERSHIP';

-- 2) certification: drop the preceding "Lessor certifies …" prose (the checkbox
--    label states it in full). Body is just the checkbox. Still gated on sole = No.
UPDATE contract_clause_defs
   SET body = '{{TXN.SOLE_OWNER_CERT}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.SOLE_OWNER_CERT';

-- 3) the limitations QUESTION → its own clause, ordered AFTER the cert and BEFORE
--    the limitations input. Renumber: cert 21 → 22, limits-input 22 → 24, and the
--    new question slots at 23.
UPDATE contract_clause_defs SET sort_order = 22
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.SOLE_OWNER_CERT';
UPDATE contract_clause_defs SET sort_order = 24
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.OWNERSHIP_LIMITS';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'HORSE', 'HORSE.OWNERSHIP_LIMITS_Q', NULL,
   'Are there any limitations on ownership? {{TXN.HAS_OWNERSHIP_LIMITS}}', 23)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body, sort_order = EXCLUDED.sort_order;

-- move the limitations Yes/No field onto that new clause
UPDATE contract_field_defs
   SET clause_key = 'HORSE.OWNERSHIP_LIMITS_Q', sort_order = 1
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.HAS_OWNERSHIP_LIMITS';
