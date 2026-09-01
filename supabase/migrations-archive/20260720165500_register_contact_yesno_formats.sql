/*
  # Register contact + yesno in the format registry (Pass I-c)
  So the add-field modal offers them and apply_field_formats can map to them.
*/
INSERT INTO contract_formats (format_type, label, category, input_kind, guidance, reusable_as, sort_order)
VALUES
  ('contact', 'Contact block', 'structured', 'contact',
   'A full contact: name, business, address, phone, email, website — captured once, reusable.', 'contact', 145),
  ('yesno', 'Yes / No', 'choice', 'yesno',
   'A simple yes-or-no choice.', NULL, 215)
ON CONFLICT (format_type) DO UPDATE
  SET label=excluded.label, category=excluded.category, input_kind=excluded.input_kind,
      guidance=excluded.guidance, reusable_as=excluded.reusable_as, sort_order=excluded.sort_order;
