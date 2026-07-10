-- ============================================================
-- Standardized Horse Record — schema reference (for Claude Code)
-- ============================================================
-- This is the authoritative horse record. It is the single source of truth for
-- horse data across the app. It is created by four authenticated paths (account-
-- activation intake, add-a-horse from the account page, lease/sale transaction,
-- staff add-a-horse) and referenced by documents, onboarding, and marketplace
-- listings. The intake form (horse_intake_form.md) is its data-entry mirror:
-- every intake field maps to a column here.
--
-- This file is a REFERENCE for the migration Claude Code will write, not a drop-in
-- migration. It shows the target columns, roles, identity/dedup model, and the
-- history table. Reconcile against the EXISTING `horses` table (defined in
-- 20260629030000_engagements_horses_backbone.sql) and ADD what is missing —
-- additive only, nothing dropped. Where the existing table already has a column
-- (registered_name, barn_name, breed, color, sex, date_of_birth, height,
-- registration_number, microchip_id, current_location — and, per spec-B,
-- fair_market_value, vet_name, vet_phone, farrier_name, farrier_phone), keep it.

-- ------------------------------------------------------------
-- horses — extend the existing table (ADD COLUMN IF NOT EXISTS)
-- ------------------------------------------------------------
-- Identity / core (mostly exist already):
--   registered_name text            -- registered/show name
--   barn_name text                  -- barn/call name
--   breed text                      -- FK code → horse_breeds
--   color text                      -- FK code → horse_colors
--   markings text                   -- NEW: free-text markings/identifying marks
--   sex text                        -- mare/gelding/stallion
--   date_of_birth date              -- birthdate (age derives)
--   height text                     -- e.g. "16.2 hh"
--   registration_number text        -- breed registry number
--   registration_org text           -- NEW: registering organization
--   microchip_id text               -- PRIMARY IDENTITY KEY (see dedup model)
--   passport_number text            -- NEW: passport #, if any
--   passport_country text           -- NEW
--   current_location text           -- current facility/location
--   fair_market_value numeric       -- (spec-B)
--   vet_name text / vet_phone text           -- (spec-B) preferred veterinarian
--   farrier_name text / farrier_phone text   -- (spec-B) preferred farrier
--
-- Care / disclosure (NEW — mirror the lease's horse-adjacent detail so the record
-- is complete for vet-auth and care contexts; all nullable, blank when unknown):
--   medical_history text            -- known medical history
--   behavioral_history text         -- known behavioral concerns
--   medication_current text         -- current medications/supplements
--   known_conditions text           -- disclosed conditions (feeds vet auth)
--   training_history text           -- optional
--   competition_history text        -- optional
--
-- Record roles (NEW — creator is distinct from owner/lessee parties):
--   created_by_contact_id uuid REFERENCES contacts(id)   -- who created the record (always the authenticated creator)
--   owner_contact_id uuid REFERENCES contacts(id)        -- current owner (Lessor/Seller), NULL if unassigned (e.g. staff-created listing horse)
--   owner_name_text text            -- owner identity as entered when owner has no contact yet (matched later)
--   lessee_contact_id uuid REFERENCES contacts(id)       -- current lessee, NULL if not leased
--   lessee_name_text text           -- lessee identity as text when no contact yet
--   lease_start date                -- current lease term start (NULL if not leased)
--   lease_end date                  -- current lease term end (drives pre-expiration prompt)
--   sublease_allowed boolean        -- set from the governing lease; gates marketplace listing
--
-- Note: owner/lessee are CURRENT-STATE pointers. Full history lives in
-- horse_relationships (below). created_by is immutable; owner/lessee change over
-- the horse's life and each change writes a history row.

-- Tenancy + RLS: follow the existing `horses` policies (org boundary + the
-- established access pattern). Reads: staff of the org; the owner (owner_contact_id
-- = current_contact_id); the lessee (lessee_contact_id = current_contact_id); the
-- creator (created_by_contact_id = current_contact_id). This is what makes the
-- dedup "authorized reveal" safe — a user sees a horse only via one of these links.

-- ------------------------------------------------------------
-- horse_relationships — FULL HISTORY of ownership and leases (NEW table)
-- ------------------------------------------------------------
-- Every owner and every lease (past and present) is a row here. Current state on
-- `horses` is a denormalized convenience; this table is the durable record.
CREATE TABLE IF NOT EXISTS horse_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  horse_id           uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  relationship       text NOT NULL CHECK (relationship IN ('OWNER','LESSEE')),
  party_contact_id   uuid REFERENCES contacts(id),   -- the party, when in the system
  party_name_text    text,                            -- identity when no contact yet
  term_start         date,                            -- leases: start; owners: acquisition date (optional)
  term_end           date,                            -- leases: end; owners: NULL until sold
  source_document_id uuid REFERENCES documents(id),   -- the lease/sale that created this, if any
  created_by_contact_id uuid REFERENCES contacts(id),
  active             boolean NOT NULL DEFAULT true,    -- false when superseded (lease ended, horse sold)
  created_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz                       -- when this relationship was closed out
);
-- Indexes: (horse_id), (party_contact_id), (org_id), partial on active.
-- RLS: org boundary; read by staff or any party_contact_id that is the caller.

-- ------------------------------------------------------------
-- Identity / dedup model (microchip primary key)
-- ------------------------------------------------------------
-- microchip_id is the universal identifier. Enforce practically, not with a hard
-- UNIQUE (a hard constraint would leak existence via insert errors and can't
-- express the authorized-reveal rule). Dedup is a SERVER-SIDE, WRITE-TIME check
-- inside the record-creation RPC (create_horse_record, below), never a client-
-- driven lookup:
--
--   1. On submit, if microchip_id is provided, the RPC queries for an existing
--      horse with the same microchip_id (case/space-normalized).
--   2. MATCH + caller authorized to see that horse (owner/lessee/creator/staff):
--      return a "match_found" result WITH the existing horse so the UI can say
--      "already on file" and ask only for missing fields. Do NOT create a duplicate.
--   3. MATCH + caller NOT authorized: return a "match_pending_review" result that
--      reveals NOTHING about the horse. Create a reconciliation task for admin
--      (horse_reconciliation, below) capturing the claim + the caller, and ask the
--      caller to upload their basis (lease agreement if claiming lessee; ownership
--      docs if claiming owner) via the existing document/storage path. Admin
--      validates the chip and the claim, then links the caller (as owner or lessee)
--      or rejects.
--   4. NO microchip, or no match: proceed to create the record. A fuzzy fallback
--      (name + date_of_birth + color + markings + owner) runs AFTER creation as a
--      background/admin reconciliation signal — it NEVER surfaces suggestions to the
--      submitter. Possible fuzzy collisions become horse_reconciliation tasks.
--
--   Responses must be indistinguishable in timing/shape between "match, not
--   authorized" and other outcomes to the extent practical, and the microchip is
--   validated/submitted with the form (checked once), not queried interactively as
--   the user types. Rate-limit record-creation submissions.

-- ------------------------------------------------------------
-- horse_reconciliation — admin queue for unauthorized matches & fuzzy collisions (NEW)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horse_reconciliation (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  existing_horse_id    uuid REFERENCES horses(id),        -- the matched record (staff-only visibility)
  claimed_by_contact_id uuid REFERENCES contacts(id),      -- who is trying to add/claim
  claim_type           text CHECK (claim_type IN ('OWNER','LESSEE','OTHER')),
  claim_note           text,
  evidence_document_id uuid REFERENCES documents(id),      -- uploaded lease/ownership doc
  match_method         text CHECK (match_method IN ('MICROCHIP','FUZZY')),
  status               text NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','approved','rejected')),
  resolved_by_contact_id uuid REFERENCES contacts(id),
  resolved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
-- RLS: staff-only read/write (this queue references horses the claimant may NOT
-- see; never expose to the claimant beyond "your request is under review").
