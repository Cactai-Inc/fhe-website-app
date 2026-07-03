/*
  # Non-enumerable document codes (owner directive 2026-07-02)

  documents.display_code was sequential (DOC-000001…): anyone holding one code
  could infer volume and guess neighbors. Access is still RLS-fenced, but the
  identifier printed on executed documents must not be enumerable. New codes:
  DOC- + 10 chars from an unambiguous alphabet (no 0/O/1/I/L), ~46 bits —
  collision-checked against the UNIQUE constraint with retry.
  Other CRM codes (CON-/HOR-/…) stay sequential: internal, never shared.
*/

CREATE OR REPLACE FUNCTION assign_random_document_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.display_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := 'DOC-';
    FOR i IN 1..10 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM documents WHERE display_code = candidate);
    tries := tries + 1;
    IF tries > 5 THEN
      RAISE EXCEPTION 'could not allocate a unique document code';
    END IF;
  END LOOP;
  NEW.display_code := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_assign_code ON documents;
CREATE TRIGGER documents_assign_code BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION assign_random_document_code();
