/*
  # TASK DOCVIS — parties see documents they signed

  Bug: my_documents() and the documents_select RLS policy (via
  caller_owns_document) only match documents.contact_id = current_contact_id().
  documents.contact_id is a single-owner column; a genuine signer recorded in
  document_parties (is_signer or not — e.g. a minor PARTICIPANT whose guardian
  signed on their behalf) whose contact differs from the owner sees nothing.
  caller_is_document_party(id) already implements the correct broader check and
  is used correctly elsewhere (document_shares_party_read, contract_fields, etc).

  Dependents check (read-first, required by the task): caller_owns_document is
  used directly in FOUR policies —
    documents_select              (SELECT on documents)      <- widen
    document_deliveries_select    (SELECT on document_deliveries)
    signatures_select             (SELECT on signatures)
    signatures_insert_self        (INSERT on signatures)      <- WRITE PATH
  Because a WRITE path (signatures_insert_self) keys off caller_owns_document,
  the helper itself is NOT widened — that would let a party (not owner) satisfy
  an insert-signature check that was scoped to ownership. Instead only the
  documents_select SELECT policy gets a caller_is_document_party(id) OR-arm,
  following the exact precedent of 20260714420000_lessee_reads_horse_docs_in_term.sql
  (which added the horse-read OR-arm to this same policy the same way). Every
  other caller_owns_document policy is untouched.

  my_documents() return type is unchanged (no new columns), so CREATE OR REPLACE
  is used rather than the DROP+recreate needed when RETURNS TABLE grows a column
  (20260804110000 precedent). Both the "pending" and "executed" branches get the
  OR caller_is_document_party(d.id) arm, matching the locked design's general
  statement ("rows where the caller is the owner OR a party via
  document_parties") rather than restricting it to only the executed branch —
  a party who hasn't signed yet should still see the document listed. No
  duplicate rows: caller_is_document_party is used as an EXISTS-shaped boolean
  predicate in the WHERE clause (not a join), so each branch still yields at
  most one row per document.id. The "assigned" branch (contact_required_documents,
  no document row yet) is untouched — there is nothing to be a party to.
*/

CREATE OR REPLACE FUNCTION public.my_documents()
RETURNS TABLE(document_id uuid, template_key text, title text, kind text, signed_at timestamp with time zone, current_status text, superseded boolean, created_at timestamp with time zone, executed_email_sent_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- pending (generated but unsigned)
  SELECT d.id, ct.template_key, ct.title, 'pending'::text,
         NULL::timestamptz, d.current_status, false, d.created_at, NULL::timestamptz
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status <> 'EXECUTED' AND coalesce(d.current_status,'') <> 'void'
  UNION ALL
  -- assigned but not yet generated
  SELECT NULL::uuid, crd.template_key, ct.title, 'assigned'::text,
         NULL::timestamptz, 'assigned', false, now(), NULL::timestamptz
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = current_contact_id()
     AND NOT EXISTS (SELECT 1 FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
                      WHERE d.contact_id = crd.contact_id AND d.deleted_at IS NULL
                        AND ct2.template_key = crd.template_key
                        AND (d.status <> 'EXECUTED' OR (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded')))
  UNION ALL
  -- executed, signing order (newest last → FE may reverse per page convention)
  SELECT d.id, ct.template_key, ct.title, 'executed'::text,
         (SELECT max(s.signed_at) FROM signatures s WHERE s.document_id = d.id AND s.deleted_at IS NULL),
         d.current_status, (d.current_status = 'superseded'), d.created_at, d.executed_email_sent_at
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
   ORDER BY 4 DESC, 8;
$function$;

DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR caller_owns_document(id)
    OR caller_is_document_party(id)
    OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))
  );
