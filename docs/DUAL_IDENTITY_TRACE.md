# Dual-Identity Trace — how act-as-company works today

**Stage 1a verify-first output (2026-07-27, Thread R).** This is the behavioral
contract for D7: any later consolidation must reproduce EXACTLY what is described
here, proven against this document. Every claim below was read from the live
database (`pg_get_functiondef` / live rows) or the working tree at `53af184`.

## 0. The identity substrate

| Identity | auth user (`profiles`) | personal contact | role |
|---|---|---|---|
| CJ (owner) | `b45a5503` admin@fhequestrian.com, role ADMIN, display_name NULL | `75475f66` "CJ Z" (is_company=false) | staff |
| Claire | `fdbdfe89` hello@fhequestrian.com, role ADMIN, display_name NULL | `862b7936` "Claire B" (is_company=false) | staff |
| The company | — (no login of its own) | `352c3898` "French Heritage Equestrian", **is_company=true**, email hello@fhequestrian.com | operating identity |

- **`contacts.is_company`** is the company marker — one flagged row per org.
- **`company_contact_id()`** (SECURITY DEFINER) resolves the org's is_company
  contact — and if none exists it **lazily INSERTs one**, named from
  `config_values` BRAND/NAME, falling back to `organizations.name`, then
  `'The Company'`. A read-path helper with a write side effect: any caller can
  mint the company contact.
- **`staff_profiles`** (2 rows, both title "Owner") is the employment record:
  `profile_user_id` + `contact_id` (the personal staff contact) + title/pay_type/
  active. Readers: FE staff pickers (`src/lib/api.ts:1509,1519`), the employees
  suite (`src/lib/ops/api-employees.ts` — shifts/time_entries join
  `staff:staff_profiles(...)`), DB fns `caller_staff_profile_ids`,
  `ensure_staff_profile`, `redeem_invitation`. This is the 1j merge substrate.
- **The company contact shares its email (hello@) with Claire's personal
  contact** — the shared-inbox model. Email match can NOT distinguish
  Claire-personal from company; only `is_company` can.
- `is_admin()` = `app_role() IN ('ADMIN','SUPER_ADMIN')`. Both staff accounts are
  ADMIN, so both hold every company-voice right below. Instructors would not.

## 1. Community posts

**Write path** — `feed_post_create(p_as_company boolean, …)`:
- Gate: `IF p_as_company AND NOT is_admin() THEN RAISE` — only operators post as
  the company.
- Storage: `feed_posts.author_id = auth.uid()` **always** (personal identity is
  always recorded) + `feed_posts.as_company` boolean. Company voice is a flag on
  a personally-attributed row — there is no company author id.

**Display path** — `feed_get` LATERAL:
- `as_company=true` → author_name = BRAND/NAME config value (live:
  "French Heritage Equestrian"), with a **hardcoded fallback literal
  'French Heritage Equestrian'** in the function body; avatar forced NULL (brand
  mark); `author_is_company=true`.
- `as_company=false` → `profiles.display_name` → first+last → 'Member'; personal
  avatar.
- FE mirror: `src/lib/communityFeed.ts:100-102` (`author_is_company ?? as_company`).

**UI controls**:
- `FeedComposer.tsx:36` and `CreateModal.tsx:83`: `useState(isAdmin)` — **staff
  default to company voice**; posting personally is the opt-out (select
  company/self at `FeedComposer.tsx:163`, `CreateModal.tsx:281`). Non-admins
  always send `as_company:false` (`CreateModal.tsx:157`, `FeedComposer.tsx:94`).
- `MyPosts.tsx:178` renders the badge with a **hardcoded string** "Posted as
  French Heritage Equestrian" (does not read BRAND/NAME).

## 2. Contract origination

- `NewContractPage.tsx:16,122,162`: "The company originates every contract";
  after start, the page calls `claimDocumentOrigination(docId)`.
- **`claim_document_origination`** (SECURITY DEFINER, staff-gated) sets
  `documents.originator_contact_id = current_contact_id()` — i.e. **the staff
  member's PERSONAL contact**, not the company contact.
  `current_contact_id()` = `profiles.contact_id` for `auth.uid()`.
- **Live proof**: the one originated document (executed HORSE_LEASE_V2
  `ecaecd42…`) has `originator_contact_id = 75475f66` = CJ's personal staff
  contact, `is_company = false`. **The narrative says company; the record says
  person.** This is the patch-shaped core of D7 — display layers say company
  while attribution rows carry the person.
- Template party defs include an `FHE` party role
  (`20260629040000_contract_templates_tokens.sql:56-61`), and
  `ContractPage.tsx:405,423,427,1183` filters `'FHE'`/`'COMPANY'` out of every
  pending-signer computation — but **no live `document_parties` or `signatures`
  row carries FHE** (live roles: CLIENT 39, PARTICIPANT/LESSOR/LESSEE 1 each).
  The company is currently never a signing party; it "exists" on contracts only
  as originator narrative + filtered-out role constants.
- `redeem_contract_invitation` branches on the invited contact's `is_company`:
  a person redeeming a COMPANY-party invitation does **not** get
  `profiles.contact_id` linked to the company contact (the company stays the
  party; the person keeps their own identity), and the party-row re-pointing
  UPDATE is skipped for company invitations. Comment in body: "a company party
  is represented by the company contact, not the person."
- Contract messages (`contract_message_post`) are **always personal**:
  `sender_contact_id = current_contact_id()`, `sender_user_id = auth.uid()`,
  `sender_label` frozen from the personal contact name (fallback 'Member').
  There is no company voice in contract messaging.
- Staff-as-party ("two hats") is a **view-level** mechanism only:
  `ContractPage.tsx:323-336` (`staffIsParty`, `viewAsSigner`,
  `isOwnerSide = (isStaff || is_originator) && !viewAsSigner`). No DB flag
  records which hat performed an edit.

## 3. Outbound email sender

- `api/_lib/email.ts:67-76`: `fromName` = BRAND/NAME → legal name →
  'Notifications'; `fromEmail` = `config_values` CONTACT/FROM_EMAIL (live:
  **unset**) → `TRANSACTIONAL_FROM_EMAIL` env. SMTP From =
  `"French Heritage Equestrian <env-address>"` (`email.ts:160,183`).
- **Every outbound email is company-voiced. The acting staff member's personal
  identity never reaches the From line** — there is no per-actor sender
  selection anywhere in `api/`. deliver-documents, receipts, and reminders all
  use the same `identity.fromName` (`deliver-documents.ts:154-156,195`,
  `receipt.ts:38-43`).
- Known hardcodes (Stage 5d scope): `OPS_INBOX='hello@fhequestrian.com'`
  (`api/calendar-reminders.ts:19`), fhequestrian.com link
  (`api/request-received.ts:74`).

## 4. Delivery logs

- `document_deliveries` columns: recipient_contact_id, channel, copy_url,
  delivered_at (+ soft-delete). **No sender-identity column at all** — deliveries
  record who received, never who (or which hat) sent. Company/ops mirror copies
  are not logged (known defect, Stage 5d).

## 5. Status events

- `log_status_event` INSERTs `actor_user_id = auth.uid()` — **always the
  personal account; there is no company-actor dimension** in `status_events`.
  An action taken "as the company" is indistinguishable from a personal action
  in the status trail.

## The trace's verdict for D7 consolidation (later stages)

Company voice today = **display-time resolution** (feed_get CASE, email
fromName, UI narrative) sitting on top of **personally-attributed rows**
(feed_posts.author_id, originator_contact_id, sender_user_id, actor_user_id).
The ONLY row-level company attributions in the system are
`feed_posts.as_company` and the company contact itself as a (currently unused)
contract party. Behavior-identical consolidation must therefore preserve:

1. `feed_posts.as_company` semantics + admin gate + admin-default-on composers.
2. BRAND/NAME as the display name source **and** the two hardcoded
   'French Heritage Equestrian' fallbacks (feed_get literal, MyPosts.tsx:178) —
   or consciously replace both with config reads in the same change.
3. Personal attribution rows everywhere else (originator, messages, status
   events, audit) — D7 says personal identity must be RECORDED; today it is, in
   all five lanes.
4. `company_contact_id()` lazy-create semantics (or remove the write side
   effect deliberately, with the company contact guaranteed to exist first).
5. The `redeem_contract_invitation` is_company branch (company parties never
   capture a person's profile link).
6. `staff_profiles` reader set (1j): api.ts pickers, api-employees joins,
   `caller_staff_profile_ids`, `ensure_staff_profile`, `redeem_invitation`.

**Untraceable links: none found.** Every company-vs-personal display/attribution
path above was located and read. (No escalation needed under D7's stop rule.)
