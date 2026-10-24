-- disc_36: remove 16 orphan template_tokens rows — tokens registered but used by no
-- contract clause/template body, no email_templates body, and no composer code (each
-- traced to zero consumers). Under the corrected D32 (2026-10-24: D32 protects client
-- records and user data, not code or schema/definition artifacts — a replaced or unused
-- definition is removed, total deletion), these are dead machinery and are deleted.
-- HORSE.EUTHANASIA_A/B were superseded by the single-statement vet-auth wording
-- (CR-69, 2026-08-25) and had been kept "defined and unused" under the old D32 reading;
-- that retention was the misapplication being corrected.

DELETE FROM template_tokens
 WHERE (namespace || '.' || field) IN (
   'CLIENT.JUMP_LIMITATIONS',
   'HORSE.OWNER_NAME',
   'HORSE.EUTHANASIA_A',
   'HORSE.EUTHANASIA_B',
   'ORD.SERVICE_SELECTION',
   'ORD.UUID',
   'REQ.CONDITION_UPDATES',
   'REQ.LOCATION_PREFERENCE',
   'REQ.PREFERRED_SCHEDULE',
   'TXN.ADDITIONAL_SERVICES',
   'TXN.EVALUATION_FEE',
   'TXN.JUMPER_TRAINING_FEE',
   'TXN.MONTHLY_FEE',
   'TXN.OTHER_FEES',
   'TXN.PACKAGE_FEE',
   'TXN.SESSION_FEE'
 );
