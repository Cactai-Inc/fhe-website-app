-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRACT REAL-TIME + SERVER-SIDE SEED NOTE (2026-07-31)
--
-- WHY. Notes, change requests and field edits all persisted immediately, but the
-- OTHER party never saw them without a page refresh — no polling, no push. Two
-- people reviewing a contract together (likely on the phone) would each be
-- looking at a stale copy of the other's work.
--
-- The alternative considered and rejected was SEQUENCING: lock the document to
-- one party at a time. That serialises a conversation that is naturally
-- simultaneous and leaves one side staring at an inaccessible document.
--
-- This codebase already does realtime correctly — the community chat uses
-- Supabase postgres_changes (subscribeToChannel in src/lib/community.ts), and
-- four tables are already published. This extends the SAME mechanism to the
-- contract surfaces rather than inventing anything.
--
-- RLS STILL APPLIES to realtime: Supabase evaluates row policies per subscriber,
-- so a party receives events only for documents they are a party to. All six
-- tables below were verified to have RLS enabled with policies before being
-- published — publishing a table without RLS would broadcast it to every
-- authenticated client.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Publish the contract surfaces ────────────────────────────────────────
-- Idempotent: ALTER PUBLICATION errors if the table is already a member, so each
-- add is guarded.
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contract_notes',            -- thread created / renamed
    'contract_note_messages',    -- a message posted
    'contract_change_requests',  -- request opened, replied to, resolved
    'contract_change_log',       -- an edit recorded
    'contract_fields',           -- a field value saved
    'documents'                  -- workflow state: sent for review, locked, signed
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'realtime: published %', t;
    END IF;
  END LOOP;
END
$do$;

-- REPLICA IDENTITY FULL so UPDATE events carry the OLD row too. Without it a
-- subscriber receives only the primary key on an update and cannot tell what
-- changed — which is exactly what the field-edit merge needs to know.
ALTER TABLE contract_fields          REPLICA IDENTITY FULL;
ALTER TABLE contract_change_requests REPLICA IDENTITY FULL;
ALTER TABLE contract_notes           REPLICA IDENTITY FULL;
ALTER TABLE documents                REPLICA IDENTITY FULL;

-- ── 2. The seed note, created ONCE, server-side ─────────────────────────────
-- Was client-side: the first browser to open an empty drawer created it. With
-- realtime on, two parties opening a fresh contract together would BOTH see an
-- empty list and both seed. Moving it to document creation removes the race
-- rather than guarding against it.
--
-- Scoped to contract documents (contract_id IS NOT NULL): a release or policy
-- document has no counterparty to talk to, so a notes thread there is noise.
CREATE OR REPLACE FUNCTION public.seed_contract_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.contract_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM contract_notes WHERE document_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)
  VALUES (NEW.org_id, NEW.id,
          'Click to edit to rename, then click anywhere on this header to open',
          NULL);   -- authored by the system, not by whoever generated the doc
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS seed_contract_note_trg ON documents;
CREATE TRIGGER seed_contract_note_trg
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION public.seed_contract_note();

COMMENT ON FUNCTION public.seed_contract_note() IS
  'Creates the single starter note on a new CONTRACT document (contract_id not '
  'null). Server-side and guarded, so it happens exactly once however many '
  'parties open the document simultaneously — the client-side version it '
  'replaces could double-seed under exactly that race.';

-- Backfill: existing contract documents that have no note yet get the same one,
-- so the affordance is not limited to contracts created from today onward.
INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)
SELECT d.org_id, d.id,
       'Click to edit to rename, then click anywhere on this header to open',
       NULL
  FROM documents d
 WHERE d.contract_id IS NOT NULL
   AND d.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM contract_notes n WHERE n.document_id = d.id);
