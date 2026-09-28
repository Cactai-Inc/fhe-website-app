-- CR-126: horse keeping-spots become an unbounded list (the medications pattern),
-- and a vaccinations list is added. Barn/stall stop being single flat columns.
--
-- keeping_spots is [{term,value}] — term from a fixed vocabulary (Barn, Stable,
-- Field, Stall, Pen, Paddock, Corral, Building), value free text. The legacy
-- home_barn/current_barn/home_stall/current_stall columns are KEPT and populated
-- from the first matching spot, so existing readers (HorsePage, contract merge,
-- HorseRecordsPage) keep working with no change; the jsonb list is the new
-- source of truth the form reads and writes.

ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS home_keeping_spots    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_keeping_spots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vaccinations          jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Back-fill the one existing horse (and any created before this ships): split the
-- composite "Barn A" / "Stall 10" strings into {term,value} rows.
UPDATE horses SET
  home_keeping_spots = (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'term',  split_part(s, ' ', 1),
             'value', nullif(btrim(substr(s, length(split_part(s, ' ', 1)) + 1)), ''))), '[]'::jsonb)
    FROM (SELECT unnest(array_remove(ARRAY[nullif(btrim(home_barn),''), nullif(btrim(home_stall),'')], NULL)) AS s) x
  ),
  current_keeping_spots = (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'term',  split_part(s, ' ', 1),
             'value', nullif(btrim(substr(s, length(split_part(s, ' ', 1)) + 1)), ''))), '[]'::jsonb)
    FROM (SELECT unnest(array_remove(ARRAY[nullif(btrim(current_barn),''), nullif(btrim(current_stall),'')], NULL)) AS s) x
  )
WHERE deleted_at IS NULL
  AND (coalesce(home_barn,'')<>'' OR coalesce(home_stall,'')<>''
    OR coalesce(current_barn,'')<>'' OR coalesce(current_stall,'')<>'');
