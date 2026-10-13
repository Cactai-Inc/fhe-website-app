-- CR-126 — the Carmel Creek Ranch location record was malformed: its address_line1
-- (the STREET field) held "Carmel Creek Ranch, San Diego, CA" (name + city + state),
-- so composing name + address_line1 + city + state + postal tripled every part and
-- the horse's "Current Location" printed "Carmel Creek Ranch, Carmel Creek Ranch,
-- San Diego, CA, San Diego, CA 92130".
--
-- The real street (verified from the French Heritage Equestrian company contact,
-- where it is correctly recorded) is 11500 Clews Ranch Rd, Ste A. Correct the record
-- so every reader — the horse record, the contract's HORSE.CURRENT_LOCATION, the
-- location pickers — composes it cleanly. Data fix (one row), not a schema change.

UPDATE locations
   SET address_line1 = '11500 Clews Ranch Rd Ste A',
       address       = '11500 Clews Ranch Rd Ste A, San Diego, CA 92130'
 WHERE id = '2d771cea-5150-43b9-8e3d-38faa434a07d'
   AND name = 'Carmel Creek Ranch';

-- The HORSE.CURRENT_LOCATION already stored on open contracts is the OLD tripled
-- auto value. The horse-field sync trigger won't refresh it (it only overwrites when
-- the stored value equals the horse's PREVIOUS computed value, and here the previous
-- value is already the new clean one — the location record changed, not the horse).
-- Force-refresh the auto-imported HORSE location fields to the current clean token
-- value on editable docs whose horse is at the corrected location (D22: the record is
-- the source of truth; this is the auto value, not a manual edit), then recompose.
UPDATE contract_fields cf
   SET value = horse_field_token_value(h, upper(split_part(replace(cf.field_key,'HORSE.',''), '.', 1))),
       updated_at = now()
  FROM documents doc
  JOIN horses h ON h.id = doc.horse_id
 WHERE cf.document_id = doc.id
   AND doc.deleted_at IS NULL
   AND doc.workflow_state IN ('editable','editing','in_review')
   AND cf.field_key IN ('HORSE.CURRENT_LOCATION','HORSE.HOME_LOCATION')
   AND h.current_location_id = '2d771cea-5150-43b9-8e3d-38faa434a07d';
