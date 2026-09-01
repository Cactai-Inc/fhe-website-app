-- Add activity-specific risk-acknowledgment clauses matching the existing Trail
-- Riding Risks clause: Jumping, Competitions, and Shared-Arena riding (riding in
-- the arena while others ride there too). Each is gated on its activity being
-- selected and placed right after Trail Riding Risks (sort 120).

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.JUMPING_RISKS','Jumping Risks',
   'Lessee acknowledges that jumping the Horse exposes Lessee and the Horse to additional risks beyond flat riding, including refusals, run-outs, awkward or missed distances, falls, unseating, and the Horse landing, stopping, or twisting unpredictably. Lessee voluntarily assumes these additional risks.',
   121,'{"contains": ["JUMPING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}'),

  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.COMPETITION_RISKS','Competition Risks',
   'Lessee acknowledges that competing with the Horse exposes Lessee and the Horse to additional risks, including unfamiliar and crowded show grounds, proximity to other horses and riders, loudspeakers, banners, and other stimuli that may cause the Horse to spook or behave unpredictably, as well as the physical demands and pressures of competition. Lessee voluntarily assumes these additional risks.',
   122,'{"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}'),

  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.SHARED_ARENA_RISKS','Shared Arena Riding Risks',
   'Lessee acknowledges that riding in an arena at the same time as other riders exposes Lessee and the Horse to additional risks, including collisions, crowding, sudden movements or loss of control by other horses or riders, and the Horse reacting to other horses. Lessee agrees to ride with awareness of others, to follow standard arena etiquette and right-of-way rules and any directions of Lessor or an instructor, and voluntarily assumes these additional risks.',
   123,'{"contains": ["ARENA_GROUP"], "field_key": "TXN.PERMITTED_ACTIVITIES"}')
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key=EXCLUDED.section_key, heading=EXCLUDED.heading, body=EXCLUDED.body,
      sort_order=EXCLUDED.sort_order, conditional_on=EXCLUDED.conditional_on;
