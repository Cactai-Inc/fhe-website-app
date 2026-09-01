-- Kill the dead CARE.* duplicate system. Audit finding: the 10 CARE.* cascade
-- fields (CARE.MED.*, CARE.FARRIER.*, CARE.ROUTINE_VET.*) are seeded on every lease
-- but rendered by NOTHING — no {{CARE...}} token exists in the lease template body,
-- and regroup_contract_subjects never touches them. Every real-world fact they held
-- is already covered by a token-driving TXN.*/HORSE.* field (farrier/vet/supplements
-- responsibility+cost, vet/farrier name+phone). Violates no-parallel-systems.
--
-- start_lease_contract already had its seed_cascade_fields(v_doc) call removed
-- (separate patch) so new leases won't re-create these. Here we remove the existing
-- rows and their seed defs.

DELETE FROM contract_fields     WHERE field_key LIKE 'CARE.%';
DELETE FROM contract_field_defs WHERE field_key LIKE 'CARE.%';
