/*
  # Stage 1 cleanup — wiring fixes + retirements (deal plan L10, L11)

  Owner directive: part of getting the app ready; each drop ships with proof of
  zero callers. Evidence gathered before writing this migration:

    inquiries          — 0 rows; no src/ or api/ reader or writer (only a comment
                         in src/lib/supabase.ts noting it is dead). Superseded by
                         `requests` (20260702010000 public intake).
    admin_create_client— only reference anywhere is its own unused wrapper
                         `adminCreateClient` (src/lib/admin.ts:576), which has no
                         component callers. Diverges from the canonical spine
                         (_ensure_client_account): writes categories as contact
                         TAGS, and matches contacts by email with no is_company
                         and no profile-ownership guard, so it could bind to the
                         tenant's own company contact.
    engagement_status  — 9 lookup rows, zero functions reference it, zero
                         frontend references, and no inbound foreign keys. The
                         engagement-stage concept it served was superseded by the
                         contract spine.
    contract_horse_field_writeback — single caller (set_contract_field's HORSE.%
                         branch). The abandoned fill-the-record-from-the-document
                         idea; owner ruled data flows forward only, edit at source.

  NOT dropped here: template_variants + the generate_document DIR.* lookup. That
  retirement requires first replacing DIR.* tokens on three flat templates
  (HORSE_EVALUATION, HORSE_SEARCH_RETAINER, HORSE_TRANSACTION_REP) with an
  explicit client-role field — content work with its own review. Deferred to its
  own migration so this one stays mechanical and reversible.
*/

-- ── WIRING FIX 1: inbound_queue resolves the contact by FK, not email ────────
-- requests.contact_id is a real, populated FK (stamped by requests_capture_contact
-- on both the found-existing and created-new paths, precisely "so provisioning
-- follows a real FK instead of re-matching on email"). The view never got the
-- memo and re-matches on email always, so correcting a contact's email silently
-- detaches the request from its own contact. Fix: prefer the FK, fall back to the
-- email match ONLY for historical rows predating the column.
CREATE OR REPLACE VIEW public.inbound_queue AS
 SELECT r.id,
    r.org_id,
    r.status,
    r.channel,
    r.category,
    r.created_at,
    r.contact_first_name,
    r.contact_last_name,
    r.contact_email,
    r.contact_phone,
    r.subject,
    r.notes,
    r.staff_notes,
    r.proposed_times,
    r.booking_eligible,
    now()::date - r.created_at::date AS days_open,
    c.id AS contact_id,
    c.contact_type,
    c.contact_type = 'CONTACT'::text AS already_converted,
    r.status = 'new'::text AND COALESCE(c.contact_type, ''::text) <> 'CONTACT'::text AND (now()::date - r.created_at::date) >= 2 AS overdue
   FROM requests r
     LEFT JOIN LATERAL ( SELECT c2.id,
            c2.contact_type
           FROM contacts c2
          WHERE c2.deleted_at IS NULL
            AND c2.org_id = r.org_id
            AND (
              -- the real link, when present
              (r.contact_id IS NOT NULL AND c2.id = r.contact_id)
              -- historical rows only: fall back to the email match
              OR (r.contact_id IS NULL AND lower(c2.email) = lower(r.contact_email))
            )
          ORDER BY c2.created_at
         LIMIT 1) c ON true;

-- ── RETIREMENT 1: the abandoned document→record backfill ─────────────────────
-- Remove the single call site first, then drop the function. The HORSE.% branch
-- of set_contract_field is replaced by nothing: under the ownership rule a
-- record value is edited at its source, never written back from a document.
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc WHERE proname = 'set_contract_field' LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'set_contract_field not found';
  END IF;
  IF position('contract_horse_field_writeback' in v_def) = 0 THEN
    RAISE NOTICE 'set_contract_field: writeback call already absent — nothing to remove';
  ELSE
    v_def := replace(v_def,
$x$  -- bidirectional horse sync (contract → record): open states only, party or
  -- staff, never clobbers a differing value, idempotent when unchanged.
  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);
  END IF;
$x$,
$x$  -- (horse writeback removed 2026-08-03: record values are edited at their
  -- source, never written back from a document. Deal plan L10.)
$x$);
    IF position('contract_horse_field_writeback' in v_def) > 0 THEN
      RAISE EXCEPTION 'set_contract_field: writeback block did not match the expected literal — inspect manually';
    END IF;
    EXECUTE v_def;
  END IF;
END $do$;

DROP FUNCTION IF EXISTS public.contract_horse_field_writeback(uuid, text, text);

-- ── RETIREMENT 2: the orphaned second account-creation spine ─────────────────
DROP FUNCTION IF EXISTS public.admin_create_client(text, text, text, text, text[]);

-- ── RETIREMENT 3: dead inbound table (superseded by `requests`) ──────────────
DROP TABLE IF EXISTS public.inquiries;

-- ── RETIREMENT 4: orphaned engagement-stage vocabulary ──────────────────────
DROP TABLE IF EXISTS public.engagement_status;
