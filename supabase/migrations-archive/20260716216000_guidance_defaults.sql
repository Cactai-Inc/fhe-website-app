-- Guidance everywhere: fill each field's guidance from its format's registry default
-- (only where the field has none), so every input carries a placeholder/help hint —
-- not just the sample optional box.
UPDATE contract_fields cf SET guidance = f.guidance
  FROM contract_formats f
 WHERE cf.format_type = f.format_type
   AND coalesce(cf.guidance,'') = '' AND coalesce(f.guidance,'') <> '';
-- also seed defs so newly-seeded fields inherit guidance
UPDATE contract_field_defs df SET guidance = f.guidance
  FROM contract_formats f
 WHERE df.format_type = f.format_type
   AND coalesce(df.guidance,'') = '' AND coalesce(f.guidance,'') <> '';
