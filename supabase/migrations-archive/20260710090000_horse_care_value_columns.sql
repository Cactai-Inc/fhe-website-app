-- SPEC B (lease/horse-record update) — horse care + value columns.
-- vet/farrier columns already exist on the live DB (added with generate_document v9);
-- IF NOT EXISTS keeps this correct on a fresh DB. fair_market_value is new — the
-- lease references {{HORSE.FAIR_MARKET_VALUE}}. Nullable; blank renders as a
-- fillable blank. RLS inherited from existing horses policies.
ALTER TABLE horses ADD COLUMN IF NOT EXISTS fair_market_value numeric;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS vet_name          text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS vet_phone         text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS farrier_name      text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS farrier_phone     text;
