/*
  # Lease v2 — safety attire mandated to match FHE's liability release

  Correction: the transcribed Safety Attire clause said helmets were "strongly
  encouraged," but FHE's own liability documents MANDATE them, and the prior
  contract required helmet + boots + pants. Per owner instruction to adhere to the
  liability release, this makes the lease's requirement match:
    - FACILITY_RULES §7: ASTM/SEI helmet REQUIRED for all mounted activities;
      a rider without a compliant helmet may not participate.
    - FACILITY_RULES attire rule: long pants, torso-covering shirt, close-toe
      footwear with a heel.
    - RELEASE_JUMPER_ADDENDUM: helmet "required for all mounted activities without
      exception."
  This is the attire REQUIREMENT only — it does NOT add a release of the right to
  sue (that lives in the liability release the lease defers to).
*/
UPDATE contract_clause_defs
   SET heading = 'Required Safety Attire',
       body = E'Lessee shall wear proper safety attire at all times while mounted on or handling Horse, in accordance with French Heritage Equestrian''s facility rules and the liability release the parties have signed. An appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet is required for all mounted activities without exception. Lessee shall also wear long pants, a shirt that fully covers the torso, and close-toe footwear with a heel. Riding or handling Horse without the required helmet and attire is not permitted; Lessee assumes all increased risk of injury or death resulting from any failure to wear the required safety equipment.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SAFETY_ATTIRE';
