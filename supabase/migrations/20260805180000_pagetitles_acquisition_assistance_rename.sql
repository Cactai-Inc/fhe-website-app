-- TASK-PAGETITLES: rename the "Transaction Assistance" service_types category to
-- "Acquisition Assistance" for consistency with the offerings row (offerings.name
-- for slug 'acquisition-assistance' was already "Acquisition Assistance"; only
-- service_types.display_name/description still said "Transaction Assistance").
UPDATE public.service_types
SET display_name = 'Acquisition Assistance',
    description = 'Full service assistance for acquisition and lease transactions.'
WHERE code = 'HORSE_PURCHASE_ASSISTANCE';
