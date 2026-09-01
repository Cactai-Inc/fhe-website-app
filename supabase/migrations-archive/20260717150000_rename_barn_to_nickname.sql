-- "Barn name" was the horse's everyday NICKNAME — a term that collides with the
-- barn/stall location concept. Rename the column to its true meaning. "Barn" is now
-- reserved for the location model (a barn on a property, holding stalls).
ALTER TABLE public.horses RENAME COLUMN barn_name TO nickname;

-- Split the per-horse barn_stall into separate barn + stall (a property has named
-- barns/stables; inside is a stall/pen — some properties have outdoor stalls with no
-- barn). Each stores the composite string "Barn A" / "Stall 16" produced by the
-- select-prefix + typed-value control.
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_barn text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_stall text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_barn text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_stall text;
ALTER TABLE public.horses DROP COLUMN IF EXISTS home_barn_stall;
ALTER TABLE public.horses DROP COLUMN IF EXISTS current_barn_stall;
