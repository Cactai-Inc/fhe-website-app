-- disc_40 (fix round item 1 addendum): registration number has no N/A control;
-- blank is its only empty state. Null out the existing 'N/A' sentinel values so
-- the stored data matches the form's single empty state (blank), not a literal
-- "N/A" that would print onto a contract.
UPDATE horses
   SET registration_number = NULL, updated_at = now()
 WHERE deleted_at IS NULL
   AND btrim(lower(coalesce(registration_number, ''))) IN ('n/a', 'na', 'none', 'n\a');
