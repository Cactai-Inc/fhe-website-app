/*
  # Contract redlining — schema (part 1 of the propose→highlight→approve→weave flow)

  - document_party_controls gains can_add_clause (distinct from can_suggest):
      can_suggest    → propose an EDIT to an existing field/clause
      can_add_clause → propose a NEW free-text clause
    Both enforced server-side by the RPCs (part 2). set_party_controls extended.
  - contract_fields gains a STAGED proposal (proposed_value / proposed_by /
    proposed_at) so a proposed edit is highlighted to the counterparty without
    overwriting the accepted value until approved.
  - contract_addenda: party-authored NEW clauses, with a propose→accept/reject
    lifecycle. Accepted clauses fold into a TXN.ADDITIONAL_TERMS field that the
    body renders in a new "Additional Terms" area (empty → stripped by remerge).
*/

ALTER TABLE document_party_controls ADD COLUMN IF NOT EXISTS can_add_clause boolean NOT NULL DEFAULT false;

ALTER TABLE contract_fields
  ADD COLUMN IF NOT EXISTS proposed_value text,
  ADD COLUMN IF NOT EXISTS proposed_by_contact_id uuid REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS proposed_at timestamptz;

CREATE TABLE IF NOT EXISTS contract_addenda (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id) ON DELETE CASCADE,
  document_id            uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_number            int NOT NULL,
  body                   text NOT NULL,
  proposed_by_contact_id uuid REFERENCES contacts(id),
  proposed_by_role       text,
  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','withdrawn')),
  resolved_by_contact_id uuid REFERENCES contacts(id),
  resolved_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, item_number)
);
CREATE INDEX IF NOT EXISTS contract_addenda_doc_idx ON contract_addenda (document_id, status);

ALTER TABLE contract_addenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_addenda_read ON contract_addenda;
CREATE POLICY contract_addenda_read ON contract_addenda
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));
-- all writes go through SECURITY DEFINER RPCs (part 2)
REVOKE ALL ON contract_addenda FROM authenticated, anon;

-- ── set_party_controls: carry can_add_clause ────────────────────────────────
DROP FUNCTION IF EXISTS set_party_controls(uuid, text, boolean, boolean, boolean);
CREATE OR REPLACE FUNCTION public.set_party_controls(
  p_document_id uuid, p_role text, p_can_fill boolean,
  p_can_edit_deal boolean, p_can_suggest boolean, p_can_add_clause boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
  VALUES (p_document_id, upper(p_role), p_can_fill, p_can_edit_deal, p_can_suggest, p_can_add_clause, v_org)
  ON CONFLICT (document_id, party_role)
  DO UPDATE SET can_fill = excluded.can_fill,
                can_edit_deal = excluded.can_edit_deal,
                can_suggest = excluded.can_suggest,
                can_add_clause = excluded.can_add_clause;
END;
$fn$;

-- ── Lease body: an Additional Terms area rendered from TXN.ADDITIONAL_TERMS ──
UPDATE contract_templates SET body = replace(
    body,
    E'Any modification must be in writing and signed by both parties.\n\nLESSOR',
    E'Any modification must be in writing and signed by both parties.\n\n{{TXN.ADDITIONAL_TERMS}}\n\nLESSOR')
 WHERE template_key='HORSE_LEASE'
   AND body NOT LIKE '%{{TXN.ADDITIONAL_TERMS}}%';

DELETE FROM template_tokens WHERE template_id=(SELECT id FROM contract_templates WHERE template_key='HORSE_LEASE');
INSERT INTO template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
  SELECT (SELECT id FROM contract_templates WHERE template_key='HORSE_LEASE'),
         split_part(trim(both '{}' from tok),'.',1),
         substr(trim(both '{}' from tok), position('.' in trim(both '{}' from tok))+1),
         tok,
         CASE split_part(trim(both '{}' from tok),'.',1) WHEN 'SIG' THEN 'signature' WHEN 'DOC' THEN 'system' ELSE 'field' END,
         false,
         split_part(trim(both '{}' from tok),'.',1) IN ('CLIENT','LESSEE','LESSOR','PARTICIPANT','SIG')
    FROM (SELECT DISTINCT unnest(regexp_matches((SELECT body FROM contract_templates WHERE template_key='HORSE_LEASE'),'\{\{[A-Z0-9_.]+\}\}','g')) AS tok) t;

REVOKE ALL ON FUNCTION set_party_controls(uuid,text,boolean,boolean,boolean,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_party_controls(uuid,text,boolean,boolean,boolean,boolean) TO authenticated, service_role;
