-- Backfill: existing lease docs are missing the 4 newly-tokenized horse fields.
-- Insert them (mirroring the seed) and fill from the attached horse.
DO $$
DECLARE d RECORD; v_h horses%ROWTYPE;
BEGIN
  FOR d IN
    SELECT dc.id AS doc_id, dc.org_id, dc.horse_id
      FROM documents dc
      JOIN contract_templates t ON t.id = dc.template_id
     WHERE dc.contract_id IS NOT NULL AND dc.deleted_at IS NULL
       AND t.template_key = 'HORSE_LEASE'
  LOOP
    -- add the fields if absent
    INSERT INTO contract_fields (org_id, document_id, field_key, label, section, owner_role, value_type, input_kind, format_type, required, sort_order)
    SELECT d.org_id, d.doc_id, x.k, x.l, 'Horse', 'LESSOR', 'text', 'text', 'text', false, x.so
      FROM (VALUES
        ('HORSE.MARKINGS','Markings',182),
        ('HORSE.REGISTRATION_ORG','Registration Organization',184),
        ('HORSE.PASSPORT_NUMBER','Passport Number',186),
        ('HORSE.PASSPORT_COUNTRY','Passport Country',188)
      ) AS x(k,l,so)
     WHERE NOT EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id=d.doc_id AND cf.field_key=x.k);

    -- fill from the horse
    IF d.horse_id IS NOT NULL THEN
      SELECT * INTO v_h FROM horses WHERE id = d.horse_id;
      UPDATE contract_fields SET value=v_h.markings          WHERE document_id=d.doc_id AND field_key='HORSE.MARKINGS'          AND coalesce(value,'')='';
      UPDATE contract_fields SET value=v_h.registration_org  WHERE document_id=d.doc_id AND field_key='HORSE.REGISTRATION_ORG'  AND coalesce(value,'')='';
      UPDATE contract_fields SET value=v_h.passport_number   WHERE document_id=d.doc_id AND field_key='HORSE.PASSPORT_NUMBER'   AND coalesce(value,'')='';
      UPDATE contract_fields SET value=v_h.passport_country  WHERE document_id=d.doc_id AND field_key='HORSE.PASSPORT_COUNTRY'  AND coalesce(value,'')='';
    END IF;
  END LOOP;
END $$;
