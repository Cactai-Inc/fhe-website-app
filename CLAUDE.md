# CLAUDE.md — orientation for a working session

**Read this first.** It describes what the system actually is: the live spine, the
retired concepts, the migration convention, and the settled owner decisions.

---

## No subagent delegation

**Do not use the Agent tool or the Workflow tool in this repo unless the owner
explicitly asks for it.** Do the work directly in this thread — read files, edit
files, run commands yourself. Do not spawn `Explore`, `general-purpose`, or any
other subagent for research, search, or execution, even for broad or multi-step
tasks.

**Why:** a prior session let subagent fan-out run unchecked and burned roughly 5
hours of usage allowance in about 10 minutes. This is a standing rule, not a
one-off — it applies to every thread in this repo, not just the one it was
first raised in.

**How to apply:** author task docs/plans yourself; if a task genuinely needs
parallel execution, ask the owner first and let them run it in their own
separate thread, per the existing owner-orchestration workflow.

---

## Commands

```bash
npm run typecheck        # tsc --noEmit -p tsconfig.app.json   (frontend)
npm run typecheck:api    # tsc --noEmit -p tsconfig.api.json   (api/ serverless)
npm run lint             # eslint .
npm run build            # vite build + prerender + seo-files
npm run dev              # vite
```
Baseline health: typecheck 0 errors, lint 0 errors (~26 pre-existing warnings).

---

## The live spine (what actually exists)

**Orders/commerce:** `purchases` + `purchase_items` + `bookings` + `lesson_credits`.
Purchases auto-get an order number (`display_code`, format `PUR-000001`, via the
`purchases_assign_code` trigger); `purchase_items` holds the contents plus a
`config jsonb` for per-line intent.

**Catalog:** flat SKUs in `offerings`, read via the `public_offerings` RPC.
**There is no tier layer** — it was removed 2026-07-08. Each offering IS the
purchasable item, and its mechanics are DATA: `config_kind`
(`scheduled` | `recurring` | `intake_finder` | `intake_evaluation` |
`document_transaction` | `inquire`), `unit_count`, `weekly_frequency`. All 43 SKUs
are classified. Frontend read path: `src/lib/publicCatalog.ts` + `src/lib/pricing.ts`.

**Identity — two anchors, one person in one at a time:**
- `contacts` = the person record (may have no login). ~34 tables key on `contact_id`.
- `profiles` (↔ `auth.users`) = the account. ~20 tables key on `user_id`.
- `profiles` is the 1:1 bridge. Owning a horse or being a contract party requires an
  account.
- `members` = the access gate; `is_active_member()` reads it, and RLS on ~10
  community tables depends on that. The word "membership" is deliberately reserved
  for a future real product (D4), so there is no tier column.
- `groups` (contact_id, group_type) = standing affiliations, RIDER / HORSE_OWNER /
  PARENT_GUARDIAN only. `clients.client_since` / `.customer_since` are the two D8
  markers (service engagement vs commercial purchase) on one account.
- **Promotion is one path:** `promote_contact_to_account(user, contact)` — the SOLE
  writer of `profiles.contact_id`. It links or merges (evidence-based survivor),
  re-anchors documents/parties/signatures, grants membership, and derives groups.
  A structural denylist refuses the protected identities and any company contact.

**Affiliation groups are DERIVED, never hand-written.** `derive_affiliations(contact)`
computes them from executed documents + horse ownership; `apply_affiliations(contact)`
is the **sole writer** of RIDER / HORSE_OWNER / PARENT_GUARDIAN rows, kept live by
triggers on document-execution and horse-ownership. If you find code writing those
roles directly, that's a regression — route it through `apply_affiliations`.

**Fulfillment:** `fulfillment_units` are generated from `purchase_items` by
`config_kind` (scheduled→session, recurring→period, intake_*→milestone,
document_transaction→execution, inquire→none). Bookings consume them; evaluation
delivery satisfies milestones; `status_events` drives unit state.

**Documents:** assignment is `contact_required_documents` (the "pending set" is a
QUERY, not a table). `contract_templates.wall_gating` marks the onboarding class
that gates a member's session — `my_wall_state()` drives the signing wall; staff are
never hard-walled. A newer version executing marks the prior one `superseded`
(retained as evidence). Signatures carry `signer_user_id` from Stage 2c.

**Other live subsystems:** `status_events` + `status_events_vocab` (+ `current_status`
denormalized on documents/purchases/bookings/invitations, maintained by triggers);
`evaluation_reports` (+ `_shares`, `_access`); invitation lifecycle
(`record_invitation_failure`, `supersede_invitations`, `invitation_expiry_days`);
`_ensure_client_account` (the contact-side account spine); `receipt_sends`
(one row per attempt; a receipt is provable and single); `purge_account` (allowlisted
account removal, staff-invoked only).

---

## RETIRED — do not resurrect

Tables/concepts: `engagements`, `orders`, `client_purchases`, `lesson_sessions`,
`transactions`, `contact_roles` (now `groups`), `horse_parties` (now
`horse_relationships`), `staff_profiles` (merged into `profiles`), offering **tiers**,
`members.tier`, welcome/dunning email (D9).
Functions: `start_broker_contract`, `dunning_due`, `mark_dunning_sent`.
Files: `src/lib/services.ts`, `src/lib/catalog.ts` (the two hardcoded shadow
catalogs — the catalog is DB-driven), `src/components/order/OrderDocuments.tsx`.

**The lease is built from DB clause content**, not a flat markdown template
(`contract_section_defs` / `contract_clause_defs` / `contract_field_defs`, template
key `HORSE_LEASE_V2`, started by `start_lease_contract_v2`).
→ `supabase/contract_templates/HORSE_LEASE.md` is **CURRENT and useful**: it was
rewritten into a pointer doc explaining *where and how to edit the lease* (which
tables, a worked `UPDATE` example, the `PGCLIENTENCODING=UTF8` caveat, and how
`remerge_contract_from_clauses` recomposes). Read it before touching lease wording.
The owner round-trip export lives in `docs/contract-exports/`.

---

## Migration convention

Timestamped files in `supabase/migrations/`, additive. **There is no
`supabase_migrations.schema_migrations` table** — migrations are a hand-maintained
journal applied directly via `psql`. The DB connection string is the first line of
`.env.db` (gitignored).

Discipline used throughout this codebase:
1. Dry-run inside `BEGIN; … ROLLBACK;` against prod,
2. apply,
3. verify with a query,
4. commit.

Caveat: ~31 migrations rewrite existing function bodies in place (read
`pg_get_functiondef`, string-replace, re-execute). They are **not safe to replay on a
fresh database** — they would find nothing to rewrite and silently no-op. This is a
pre-existing property of the repo, not a per-migration bug.

---

## Working rule

Verify against the live database/code **before** asserting, and claim only what the
diff contains. This codebase has repeatedly contradicted plausible-sounding
assumptions (a column that looked load-bearing was vestigial; "empty" tables turned
out to be wired and code-referenced; same-name contact records turned out to be
different people). Query first.

**Writes must prove they landed.** Supabase returns no error when RLS filters an
UPDATE to zero rows. Every write goes through `assertWrote()`
(`src/lib/writeGuard.ts`) with a `.select()` so a blocked write throws instead of
reporting success.

---

## The docs

- `docs/BACKLOG.md` — the standing work list (the only place to look for what's next)
- `docs/TOKEN_DICTIONARY.md` — the document merge-token contract
- `docs/NOTIFICATIONS.md`, `docs/GOOGLE_SMTP_SETUP.md` — the email/notification setup
- `docs/DUAL_IDENTITY_TRACE.md` — how act-as-company works (D7's behavioral contract;
  any change to company-vs-personal attribution must be diffed against it)
- `docs/contract-exports/` — generated from the live lease template
- `supabase/contract_templates/HORSE_LEASE.md` — how to edit the lease (pointer doc)

---

## Settled owner decisions — inherit these, do not re-ask

- **D1 — Identity disposition.** admin@fhequestrian.com (CJ) + hello@fhequestrian.com
  (Claire) + the company contact (French Heritage Equestrian) are PRODUCTION FHE
  identities. admin@cactai.io is the PLATFORM owner (Cactai Inc, super admin) — never
  an FHE tenant identity; must hold zero FHE tenant rows. cjzigs@ / charlesjzigmund@
  are the owner's test identities: live and untouched until the owner-run post-Stage-5
  purge (via the 5g routine, never ad hoc). The 6 stranded executed documents ride on
  the test identities and exit with that purge — no re-anchoring.
- **D1a — The platform owner is not a tenant (2026-08-10).** Sharpens D1, does not
  supersede it. `admin@cactai.io` = PLATFORM owner, `org_id` **NULL by design**, and
  **not a member of any tenant**. `admin@fhequestrian.com` = TENANT owner. They are
  different things and are never merged. **Consequence: being DENIED by FHE
  staff-gated functions is CORRECT for the platform account, not a bug.** Three
  threads reported it as breakage; all three were wrong. `has_staff_access() AND
  v_org = current_org()` goes NULL for it, so the `IF` skips and it is admitted —
  *that admission was the accident.* All `coalesce(…, false)` repairs on those ~48
  functions are therefore **safe**. **Do NOT set `org_id` on `admin@cactai.io`** — it
  was proposed as the cheap fix and is refused. Full ruling:
  `docs/reference/D1a-PLATFORM-OWNER-IS-NOT-A-TENANT.md`.
- **D2 — Rename.** The affiliation table becomes `groups`.
- **D3 — Purchaser wording.** DB stores a neutral promotion marker; display "client"
  in staff/ops surfaces, "customer" only in gift/product-only contexts. Members must
  see "Member" about themselves and each other — never "Client".
- **D4 — Membership tiers DEFERRED** as a product. Strip tier-implying copy
  (monthly/annual); billing schedules + implicit pay-as-you-go are current reality.
  `tier` stays a reserved word.
- **D5 — Promotion pathway.** `promote_contact_to_account` = `_ensure_client_account`
  spine + re-anchor documents/parties/signatures + `apply_affiliations` + dissolve the
  faceless contact. Real users only; D1's protected/test identities are never dissolved.
- **D6 — Fulfillment = one deliverable spine.** Every `purchase_item` with a
  `config_kind` produces fulfillment unit rows; `status_events` drives their state;
  receipts, dunning, and delivery logging hang off the spine as provable events.
- **D7 — Dual-identity (act-as-company) is protected behavior.** Both staff accounts
  act as themselves or as the company (displayed AND recorded). It works via patches
  today; consolidation only as behavior-identical change against the Stage-1 trace
  (`docs/DUAL_IDENTITY_TRACE.md`), never blind.
- **D8 — Access model (owner-final 2026-07-27; supersedes "guest = account with no
  group" as a derivation).** (1) Community access is gated by ACCOUNT, not documents —
  any account holder views and participates. Documents gate ACTIONS: RELEASE_GENERAL
  gates physical visits (signed at visit, kiosk-style); the participant release gates
  riding; the horse-care set gates care services. GUEST is never a derived group —
  "guest" is display-only for an account with no service group. (2) CUSTOMER =
  commercial marker for any purchaser incl. gift buyers; a gift purchase auto-creates
  the account through the single spine (no manual provisioning) with order visibility,
  repurchase, community access, and marketing eligibility. CLIENT = service-engagement
  marker, attached at invitation with service documents. Customer→client promotion is
  a marker change on the same account. (3) An account with assigned-but-unsigned
  documents is PENDING: service features locked until executed, community open,
  surfaced in ops needs-attention. (4) Mary Richardson is untouched — she is the
  Stage 2 live acceptance case (supersede expired invite → re-invite → sign → derive
  RIDER + HORSE_OWNER). (5) Linked accounts (separate logins, shared
  horse_relationships-based record via add-by-email, rider-permission-gated schedule
  visibility) are recorded scope, not built: record-sharing folds into Stage 3's
  horse-visibility item; schedule-sharing is BACKLOG-deferred. The gift auto-account
  lands with Stage 4's gift work on the Stage 2 spine.
- **D9 — The email chain ends at setup.** There is NO welcome email and NO dunning
  email. The invitation IS the welcome; the document-flow completion email IS the
  account-setup confirmation. Payment is prepaid-gated (no payment, no service), so
  overdue reminders have no business function. Both producers are deleted, not
  dormant. `profiles.payment_reminders` survives as a vestigial column with no
  reader.
- **D10 — The lease family is Standard / Simple / Detailed, plus an archived original
  (2026-08-11).** Answers the four-byte-identical-templates question. **`HORSE_LEASE_V2` IS
  the Standard** — it holds the live lease documents and is every `leasefix` migration's
  target; it is retitled, never re-keyed. `HORSE_LEASE_SIMPLE` and `HORSE_LEASE_FULL`
  ("Detailed") are derivatives of it and **stay byte-identical until the owner modifies
  them — that is the ruled state, not a defect to tidy away.** `HORSE_LEASE_STANDARD` was a
  redundant fourth clone with zero documents and is deactivated (clause rows retained).
  `HORSE_LEASE` is the pre-clause **original**: retained as historical reference and as a
  source of wording that could be resurrected, **never activated, never used to generate a
  document.** Owner: *"We dont label the default as that we call it Standard."* Lockstep
  content writes now target **three** keys — `_V2` + `_SIMPLE` + `_FULL`. Full ruling:
  `docs/tasks/TASK-LEASESET-three-leases-and-an-archive.md`.
- **D11 — Nothing is purged. Accounts are ARCHIVED, and files stay with them
  (2026-08-11).** Owner: *"If the files are in the system they were used for something…
  they stay along with the user account in archive. we dont need to purge data at this
  point in the life of this app… the only thing we would want to do is stop seeing the
  person's account in the main views, but the files will likely be associated with things
  that other people still see and the files need to remain visible for them."*
  **Three consequences.** (1) **A file is never cascade-deleted with its owner.** The
  uploader-ownership model (`TASK-UPLOADS`) stands; departure does not revoke it, because a
  file's audience is usually other people. (2) **`purge_account` is the wrong shape for
  the current stage** — the requirement is to hide an account from main views, not to
  remove rows. Removal stays available for the owner-run D1 test-identity purge; it is not
  the answer for a departing real member. (3) **Reevaluate later** — this is explicitly a
  stage-of-life ruling, not a permanent architecture. Consistent with the standing rules
  that executed documents are evidence and that retirement means hidden behind a boolean,
  never deleted.
- **D12 — TWO template engines: a Form builder and a Document builder (2026-08-12).**
  Owner: *"we build two… i want the interfaces to be different… The option to add a
  signature block should not be part of a form. one giant authoring tool will make it
  less efficient to build or edit with."* **The authoring INTERFACES are separate** —
  different element palettes, different presets, different canvases. **A signature block
  exists only in the Document builder.** Both open the same way: *"I need to create a
  form/document"* → choose a **preset** or **build from scratch**.
  **What IS shared, because the owner specified it identically for both:** the lifecycle
  and its controls — save as draft · publish (new = v1, edit = +1) · edit returns to draft
  (with the option to remove or keep the published version) · archive · delete. That is
  state management, not authoring, and sharing it is what stops the two engines drifting
  into two different meanings of "published". **Do not read D12 as licence to build the
  version/publish machinery twice.**
  Taxonomy (owner): products, articles and guides are built with **forms**; contracts and
  read-only personalized items are built with **documents**; correspondence emails are
  documents with a delivery channel and live in their own Templates section.
  Full delta: `docs/reference/TEMPLATE-ENGINES-DELTA-2026-08-12.md`.
- **D13 — THE OWNER MUST BE ABLE TO CHANGE IT WITHOUT A DEVELOPER (2026-08-12).**
  Owner: *"you are going to build and design all of this, im just going to nudge you in
  the right direction after seeing things and wanting changes. but i dont want to come
  back here every time i need to modify something and im not going to climb into the db
  or git either."*
  **This is an acceptance criterion on every configuration feature, not an aspiration.**
  A feature is NOT DONE if changing it requires the owner to (a) open a thread, (b) write
  SQL or touch the database, or (c) touch git. **If the only way to change a thing is a
  migration, that thing has no editor and the work is unfinished** — say so in the report
  rather than calling it shipped.
  **Corollary for specs:** when a task adds tenant-configurable content — copy, prices,
  templates, catalog structure, nav arrangement, field vocabularies — it must ship the
  surface that edits it, or explicitly name the follow-up that will. **Seeding content
  through a migration and leaving no UI is the pattern this decision exists to stop.**
- **D14 — CHANGE REVIEW REPLACES THE LOCK. Signability is gated by COMPLETENESS, not
  by workflow state (owner, 2026-08-12).** Supersedes the orchestrator's recommendation
  to keep structural editing blocked during `in_review`. **The owner had already ruled;
  the lock was removed deliberately.**
  **1. A document is signable only when every field is complete** — not when it reaches a
  state. Until then there is nothing to protect, because *"each one constitutes a change
  when its made and its not until the fields are all completed that the document can be
  signed anyway."* **Do NOT surface field-by-field edits as reviewable changes.**
  **2. Once signable, every change is surfaced to the party who did NOT make it.** The
  flow runs **when they click the signature section, before signing** — and again on
  login if a completed document changed since they last had it open. **Changes are
  presented one at a time (`review > next > next`), and BEING SEEN ON SCREEN IS
  APPROVAL.** No explicit accept step.
  **3. A signed party may keep editing without removing their signature.** But **the other
  party's signature must come off for THEM to edit**, because a signer is past the review
  flow and cannot otherwise be shown the change. Owner's case: *"i reviewed and signed,
  then we agreed to a change and i need to make it, i make it without the complexity of
  removing my signature and the other party is forced to see the change when they go to
  sign."*
  **4. Once BOTH parties have signed, both must agree to remove signatures before an
  edit.** The signature was valid for the period in between, **so the signed copy and all
  data that makes it binding are RETAINED.**
  **5. The result is a SUPERSEDING VERSION, not a void and not a new document.** The prior
  one is marked **superseded, never voided**; the new version is the current one and
  carries **new signatures whose timestamp is when it took effect.** Consistent with the
  existing supersession spine.
  **Consequence for `TASK-ADDITEM`'s flagged question: widen all five RPCs to `in_review`**
  — `add_contract_composition`, `remove_contract_composition`, `add_contract_element`,
  `propose_clause`, `set_field_included`. **The safeguard is the review flow, not the
  lock.**
  **Delta to build:** `ReviewChangesModal.tsx` exists but triggers on *"since this party's
  signature came off"* with explicit **Accept/Reject**. D14 needs the trigger moved to the
  signature click plus the login check, and the approval model changed to
  **seen-is-approved**.
- **D15 — A LINKED FILE IS NEVER REMOVED FROM THE SYSTEM (owner, 2026-08-12).** Settles
  the `TASK-UPLOADS` question about whether a member's "remove" may hard-delete the bytes.
  **It may not, when the file was linked to a shared item.** Owner: *"a file must remain
  available if it isnt superseded by a newer one when it was linked to a shared item. so a
  file added to a contract, a file added to horse record when its a leased horse, etc…
  must not be removed from the system entirely. it must be able to be restored or at least
  reviewed by admin in case of discrepancy or dispute."*
  **Consequences.** (1) **"Remove" is a visibility action, not a destruction action**, for
  any file with a `file_links` row. Today `removeMyFile()` soft-deletes the row and
  **hard-deletes the storage object** — that is wrong and must change. (2) **Supersession
  is the only thing that retires a linked file**, and even then the prior one is retained,
  exactly as executed documents are. (3) **Admin must be able to review and restore**, so
  the bytes and the link history survive the member's removal — the reason is dispute
  resolution, and evidence you deleted is evidence you do not have. (4) Consistent with
  **D11** (nothing is purged at this stage) and with the standing rule that executed
  documents are evidence. **An unlinked file the member uploaded and never shared is not
  covered by this ruling** — decide that separately if it ever matters.
