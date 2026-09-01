/*
  # Lease v2 — restore the OWNER'S authored mandatory-attire clause verbatim

  The previous contract version (migration 20260714440000) made protective attire
  a FIXED mandatory clause the owner authored. The V2 transcription lost it and a
  prior fix invented different wording. This restores the owner's EXACT authored
  language: mandatory helmet/boots/pants, gloves/sleeves recommended, and the
  violation penalty (lease voided + deemed rider negligence + no claims).

  Reverts the earlier 20260720193000 rewrite for this clause.
*/
UPDATE contract_clause_defs
   SET heading = 'Required Protective Attire',
       body = E'Wearing an ASTM/SEI-certified equestrian helmet, heeled boots, and long pants is required while riding. Gloves and long sleeves are highly recommended. Riders must provide their own helmet, boots, and pants in accordance with the requirements set forth herein. Any rider who declines to wear such items will have their rights under this Lease Agreement immediately voided without recourse. Any injury arising from the failure to wear the required helmet, boots, and pants shall be deemed rider negligence and, as such, is the sole responsibility of the rider, and no claim may be brought against any party listed herein for any reason related to such injury.',
       clause_type = 'prose'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SAFETY_ATTIRE';
