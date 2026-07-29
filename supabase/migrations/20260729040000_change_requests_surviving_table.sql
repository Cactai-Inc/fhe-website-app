-- ─────────────────────────────────────────────────────────────────────────────
-- CHANGE-REQUEST / CHANGE-HISTORY / VOID — Part 1 of 4: the surviving table.
--
-- OWNER DECISION: comments and change requests merge into ONE surface.
--
-- `contract_comments` already carries the threading model (parent_comment_id),
-- anchoring (anchor_kind/anchor_ref/quote), authorship stamps (author_role /
-- author_label) and a thread-close marker (resolved_at). `document_change_requests`
-- is FLAT and has zero rows. So contract_comments SURVIVES and
-- document_change_requests RETIRES.
--
-- The owner asked the survivor be named so it stays identifiable as the
-- change-request surface. NAMING CHOICE: `contract_change_requests`.
--   contract_comments  ──ALTER TABLE RENAME──▶  contract_change_requests
--
-- SEMANTICS THAT MUST SURVIVE THE MOVE (other code depends on them):
--   • an OPEN change request BLOCKS locking (contract_lock_blockers +
--     lock_and_sign_contract). On the survivor an OPEN request is a ROOT row
--     (parent_comment_id IS NULL) that is SUBMITTED and NOT yet resolved.
--     A never-submitted DRAFT does not block — it isn't a request yet.
--   • `open_change_requests` on contract_document_detail keeps its shape.
--   • resolve_change_request keeps its name/arity (ContractPage calls it).
--
-- NEW COLUMNS the threaded "chat thread, locked on send" model needs:
--   submitted_at        — NULL = free-to-edit draft; set = thread locked on send
--   agreed_at/_by       — the explicit Agreed/Accepted close (distinct from the
--                         legacy resolved_at, which we keep as the close marker
--                         so the existing resolve_contract_comment path still works)
--   annotation_number   — per-document sequential number, carried over from the
--                         retired table so requests stay citable ("Change #3")
--   target_section      — the section_key the request targets (anchor_ref carries
--                         it too, but a typed column keeps the lock/detail queries
--                         readable and indexable)
--   impact_rank         — cached money/term/liability weight; see Part 3.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Rename the survivor ───────────────────────────────────────────────────
ALTER TABLE public.contract_comments RENAME TO contract_change_requests;

-- constraints + indexes carry the old name; rename them so the schema reads true
ALTER INDEX public.contract_comments_pkey        RENAME TO contract_change_requests_pkey;
ALTER INDEX public.contract_comments_anchor_idx  RENAME TO contract_change_requests_anchor_idx;
ALTER INDEX public.contract_comments_doc_idx     RENAME TO contract_change_requests_doc_idx;
ALTER INDEX public.contract_comments_thread_idx  RENAME TO contract_change_requests_thread_idx;

ALTER TABLE public.contract_change_requests
  RENAME CONSTRAINT contract_comments_anchor_kind_check TO contract_change_requests_anchor_kind_check;
ALTER TABLE public.contract_change_requests
  RENAME CONSTRAINT contract_comments_author_contact_id_fkey TO contract_change_requests_author_contact_id_fkey;
ALTER TABLE public.contract_change_requests
  RENAME CONSTRAINT contract_comments_document_id_fkey TO contract_change_requests_document_id_fkey;
ALTER TABLE public.contract_change_requests
  RENAME CONSTRAINT contract_comments_org_id_fkey TO contract_change_requests_org_id_fkey;
ALTER TABLE public.contract_change_requests
  RENAME CONSTRAINT contract_comments_parent_comment_id_fkey TO contract_change_requests_parent_request_id_fkey;
ALTER TABLE public.contract_change_requests
  RENAME CONSTRAINT contract_comments_resolved_by_contact_id_fkey TO contract_change_requests_resolved_by_contact_id_fkey;

-- the self-referencing thread column reads better as parent_request_id
ALTER TABLE public.contract_change_requests RENAME COLUMN parent_comment_id TO parent_request_id;

ALTER POLICY contract_comments_read ON public.contract_change_requests
  RENAME TO contract_change_requests_read;

-- ── 2. Columns the threaded change-request model adds ────────────────────────
ALTER TABLE public.contract_change_requests
  ADD COLUMN IF NOT EXISTS submitted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS agreed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS agreed_by_contact_id uuid REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS annotation_number int,
  ADD COLUMN IF NOT EXISTS target_section    text,
  ADD COLUMN IF NOT EXISTS impact_rank       int NOT NULL DEFAULT 0;

-- annotation numbers are per document and only meaningful on ROOT rows.
CREATE UNIQUE INDEX IF NOT EXISTS contract_change_requests_annotation_key
  ON public.contract_change_requests (document_id, annotation_number)
  WHERE annotation_number IS NOT NULL;

-- the lock-blocker query: root + submitted + not agreed. Partial index keeps it
-- a single index probe on the hot path (every lock attempt runs it).
CREATE INDEX IF NOT EXISTS contract_change_requests_open_idx
  ON public.contract_change_requests (document_id)
  WHERE parent_request_id IS NULL AND submitted_at IS NOT NULL AND resolved_at IS NULL;

-- ── 3. WRITE policies. The old table had a READ policy only — every write went
--      through a SECURITY DEFINER function, and that stays true here. Making the
--      absence deliberate rather than accidental: no INSERT/UPDATE/DELETE policy
--      exists, so a direct client write is refused and only the RPCs below can
--      author a request. (Proof (a) exercises this.)
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.contract_change_requests IS
  'The single change-request surface (was contract_comments; document_change_requests retired into it). '
  'A ROOT row (parent_request_id IS NULL) is a change request against target_section. '
  'submitted_at NULL = a free-to-edit draft that does NOT block locking; '
  'submitted_at SET = the thread is locked-on-send and BLOCKS locking until resolved_at (Agreed). '
  'Child rows are thread entries, each stamped with author_role/author_label + created_at.';

COMMIT;
