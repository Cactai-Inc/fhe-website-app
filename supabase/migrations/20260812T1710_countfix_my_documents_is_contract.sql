-- TASK-COUNTFIX 1.4 — a member's documents counted two ways, on two pages.
--
-- `/app/documents` (and `/app/account` → My Documents) read `my_documents()`.
-- `/app/deal` read `my_contract_documents()`. Production, per real account:
--
--     account                        my_documents   my_contract_documents
--     cjzigs@icloud.com                   11                  5
--     sarahrosengard@gmail.com             8                  1
--     claire.bourdon21@gmail.com           6                  0
--     maeboon@gmail.com                    6                  0
--     madelinedo@gmail.com                 4                  0
--
-- Three members would see an Acquisition home reading "nothing here yet" while
-- their Documents page listed six, six and four.
--
-- WHAT THE TASK EXPECTED, AND WHAT IS ACTUALLY TRUE. The spec's hypothesis was
-- that the WIDER count is the wrong one — that it includes documents the member
-- is a party to but cannot read, or soft-deleted rows. Checked against the RLS,
-- that is FALSE, and the numbers are in the report:
--   * `my_documents()` is visible on `contact_id = me OR caller_is_document_party(id)`;
--   * `documents_select` admits `caller_owns_document(id) OR caller_is_document_party(id)
--     OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))`;
--   * the first is a strict SUBSET of the second, and per-account the wider count
--     is <= the RLS-readable count for EVERY account in production (11<=15, 8<=9,
--     6<=6, 6<=6, 4<=4). Both readers already exclude `deleted_at IS NOT NULL`.
-- So `my_documents()` never lists a document the member cannot open. It is the
-- right count for "my documents", and it stays.
--
-- THE ONE DEFINITION (COUNTFIX 1.4): a member's documents are `my_documents()`.
-- The Acquisition home does not get a rival list — it gets the SAME list,
-- filtered. This migration adds the column that makes that filter possible:
--
--     is_contract = EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
--
-- which is exactly the predicate `my_contract_documents()` used to select on. An
-- "assigned" row is a placeholder for paperwork not yet produced — it has no
-- document, so it is never a contract (false), and the Acquisition home stops
-- claiming a document exists that does not.
--
-- Consequence on screen: `/app/deal` renders my_documents() filtered to
-- is_contract, so the two surfaces can never disagree about whether a document
-- exists. They still show different NUMBERS — one is a subset of the other —
-- and the page now says so in words rather than leaving the member to guess.
--
-- This replaces the whole function body, so it is safe to replay on a fresh DB.
-- The DROP is required, not cosmetic: adding an output column changes the return
-- type, and Postgres refuses that through CREATE OR REPLACE. The only other
-- reference is `my_nav_presence()`, which does `EXISTS (SELECT 1 FROM
-- my_documents() LIMIT 1)` — column-agnostic, resolved at runtime, and the DROP
-- and CREATE are in one transaction.

DROP FUNCTION IF EXISTS public.my_documents();

CREATE OR REPLACE FUNCTION public.my_documents()
 RETURNS TABLE(document_id uuid, template_key text, title text, kind text, signed_at timestamp with time zone, current_status text, superseded boolean, created_at timestamp with time zone, executed_email_sent_at timestamp with time zone, is_contract boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- pending (generated but unsigned)
  SELECT d.id, ct.template_key, ct.title, 'pending'::text,
         NULL::timestamptz, d.current_status, false, d.created_at, NULL::timestamptz,
         EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status <> 'EXECUTED' AND coalesce(d.current_status,'') <> 'void'
  UNION ALL
  -- assigned but not yet generated (a placeholder: there is no document yet, so
  -- it is not a contract)
  SELECT NULL::uuid, crd.template_key, ct.title, 'assigned'::text,
         NULL::timestamptz, 'assigned', false, now(), NULL::timestamptz,
         false
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
         d.current_status, (d.current_status = 'superseded'), d.created_at, d.executed_email_sent_at,
         EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
   ORDER BY 4 DESC, 8;
$function$;
