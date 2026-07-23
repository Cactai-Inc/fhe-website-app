-- Rewrite the Required Protective Attire clause to remove redundancy (the helmet
-- requirement and the "declining voids your rights" consequence were each stated
-- twice) while keeping the strongest language. Move the general "By signing …
-- read this Agreement … giving up substantial legal rights, including the right to
-- sue Lessor" acknowledgment out of this clause into Lessee's Representations,
-- where it belongs (it's a representation the Lessee makes by signing, not an
-- attire term).

UPDATE contract_clause_defs
   SET body = 'Lessee is strictly required to wear an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Lessee shall provide Lessee''s own helmet, boots, and pants meeting these requirements. Lessee assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes Lessee''s permission to ride or handle the Horse, constitutes a material breach of this Agreement, and voids Lessee''s rights under this Agreement without recourse. Any injury arising from the failure to wear the required helmet, boots, or pants shall be deemed rider negligence and is the sole responsibility of the rider, and no claim may be brought against any party listed herein for any reason related to such injury.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.SAFETY_ATTIRE';

-- add the general signing acknowledgment to Lessee's Representations.
UPDATE contract_clause_defs
   SET body = body || ' By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights, including the right to sue Lessor.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'LESSEE_REPS.MAIN';
