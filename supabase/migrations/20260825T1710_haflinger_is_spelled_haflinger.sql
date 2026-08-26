-- The breed is HAFLINGER, not "Halfinger" (owner, 2026-08-25).
--
-- Both the code and the display name are corrected. `horses.breed` is a foreign
-- key ON UPDATE CASCADE, so the one horse carrying it (Sundance) follows the
-- rename automatically — no second UPDATE, and no window where the row points at
-- a code that no longer exists.
--
-- The display name is what actually reaches a reader: `horse_field_token_value`
-- resolves HORSE.BREED through `horse_breeds.display_name`, so any lease or bill
-- of sale naming this horse has been printing the misspelling. Documents recompose
-- from the record on open, so the correction propagates on its own.

BEGIN;

UPDATE horse_breeds
   SET code = 'HAFLINGER', display_name = 'Haflinger'
 WHERE code = 'HALFINGER';

COMMIT;
