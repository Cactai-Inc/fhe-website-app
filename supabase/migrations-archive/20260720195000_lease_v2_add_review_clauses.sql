/*
  # Lease v2 — add the three owner-provided clauses (for now; reevaluate later)

  Owner provided three clauses to add to the lease template, adapted to the lease's
  third-person voice (Lessee/Lessor, {{LESSOR.FULL_NAME}} instead of the literal
  owner name). Added to the Insurance/Risk section. To be reevaluated later.

    1. Assumption of Inherent Risks (with CA Primary Assumption of Risk citations)
    2. Release of Liability (ordinary-negligence release)
    3. Mandatory Protective Headgear (helmet strictly required + revocation/breach)
*/

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance) VALUES
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.ASSUMPTION_INHERENT','Assumption of Inherent Risks',
    E'Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Pursuant to this binding legal precedent, Lessee expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that Lessor owes no duty to protect Lessee from these inherent risks.',
    'prose', 95,
    'Assumption of the inherent risks of equine activities, grounded in California case law. Under owner review — to be reevaluated.'),

  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RELEASE','Release of Liability',
    E'In consideration for being permitted to ride the Horse, Lessee completely releases, forever discharges, and agrees to hold harmless Lessor, {{LESSOR.FULL_NAME}}, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee''s use, handling, or riding of the Horse, whether caused by the ordinary negligence of Lessor or otherwise.',
    'prose', 96,
    'Release of Lessor from claims, including ordinary negligence. Under owner review — to be reevaluated.'),

  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MANDATORY_HELMET','Mandatory Protective Headgear',
    E'Lessee agrees that Lessee is strictly required to wear an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse. Lessee assumes all increased risk of injury or death resulting from any failure to properly wear a helmet. Lessee further understands and agrees that any refusal or failure to wear an approved helmet immediately revokes Lessee''s permission to ride or handle the Horse and constitutes a material breach of this Agreement. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights, including the right to sue Lessor.',
    'prose', 97,
    'Mandatory helmet with revocation + material-breach penalty. Under owner review — to be reevaluated.')
ON CONFLICT (template_key, clause_key) DO NOTHING;
