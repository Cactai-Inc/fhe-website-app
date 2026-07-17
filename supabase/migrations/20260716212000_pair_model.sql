-- PAIR MODEL — fold each matched manage↔cost item into ONE structured 'pair' field.
-- The responsibility field becomes format_type='pair' and its `structured` jsonb holds
-- BOTH decisions: { manage:{party,provider?,parties?}, cost:{same_as_manage,party?,split?,note?} }.
-- The cost field_key stays alive (the template body has a separate {{..._COST}} token),
-- but it is marked pair_child so the renderer HIDES it as an independent row — its value
-- is composed from the pair's structure. cost.same_as_manage defaults true: unless the
-- author overrides it, the managing party also covers the cost.
--
-- Only the 5 items that have BOTH a management and a cost decision are paired. Training
-- and Lessons have a cost token but their "management" is the terms longtext, so their
-- cost fields stay standalone (not paired).

-- pair_meta on the responsibility field points at its cost field; pair_child on the cost
-- field points back (and flags it hidden-as-independent).
ALTER TABLE public.contract_fields ADD COLUMN IF NOT EXISTS pair_cost_key text;   -- on the manage field
ALTER TABLE public.contract_fields ADD COLUMN IF NOT EXISTS pair_manage_key text; -- on the cost field (child)

-- map: manage_key -> cost_key
DO $$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST'],
    ARRAY['TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST'],
    ARRAY['TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST'],
    ARRAY['TXN.EMERGENCY_VET_RESPONSIBILITY','TXN.NON_ROUTINE_VET_COST'],
    ARRAY['TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST']
  ];
  p text[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY pairs LOOP
    -- manage field: becomes the pair, remembers its cost child
    UPDATE contract_fields
       SET format_type = 'pair', input_kind = 'pair', pair_cost_key = p[2]
     WHERE field_key = p[1];
    -- cost field: child, hidden as an independent row, points back to its manage field
    UPDATE contract_fields
       SET pair_manage_key = p[1]
     WHERE field_key = p[2];
  END LOOP;
END $$;
