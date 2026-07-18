-- Veterinarian gets a business name + structured address (client asked for these on
-- the vet block). Structured parts mirror the contacts address model.
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS vet_business_name text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS vet_address_line1 text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS vet_city text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS vet_state text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS vet_postal text;
