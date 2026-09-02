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
Baseline health: typecheck 0 errors, lint 0 errors, **48 pre-existing warnings**
(measured on `main` 2026-08-26; the "~26" this line carried for weeks was stale,
and a stale baseline is how a thread reports someone else's warnings as its own).

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

- `docs/orch/RUN-QUEUE.md` — the standing work list (the only place to look for what's next)
- `docs/design/TOKEN_DICTIONARY.md` — the document merge-token contract
- `docs/reference/NOTIFICATIONS.md`, `docs/reference/GOOGLE_SMTP_SETUP.md` — the email/notification setup
- `docs/reference/DUAL_IDENTITY_TRACE.md` — how act-as-company works (D7's behavioral contract;
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
  (`docs/reference/DUAL_IDENTITY_TRACE.md`), never blind.
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
  ⚠️ **RECORDED EXCEPTION — A SELF-ARRANGING SURFACE NEEDS NO ARRANGEMENT EDITOR
  (owner, 2026-08-22).** `TASK-DASHBOARDBUILD` shipped the two owner dashboards and flagged
  the plan's `dashboard_prefs` (per-zone pin/hide/reorder) as **a D13 gap — "the owner cannot
  rearrange his own board without a thread."** The owner ruled it is not one: *"The dashboard
  doesn't need an editor in the traditional sense. Surfaces should be fluid and dynamic and
  only shown when there is something to show."*
  **The reasoning, and it generalises.** D13 exists because a tenant should never need a
  developer to change something they own. **A surface that responds to its own data has already
  solved that** — the zone framework renders a zone when it holds something and drops it when it
  does not, so the board reorders itself as the day changes and there is nothing left to
  arrange. An editor here would be **configuration for its own sake**: a second thing to
  maintain, and a way for the owner to hide a zone that was about to matter.
  **So the test is not "is this arrangeable?" but "does a person have a preference the DATA
  cannot express?"** Zone order on a dashboard: no. Prices, copy, templates, document sets,
  field vocabularies, business formulas: yes — D13 and D21 are undisturbed for all of them, and
  this exception is about **dashboard/zone arrangement only**, not about content or rules.
  **`dashboard_prefs` is ruled out, not deferred.** Do not re-open it as unfinished work, and
  do not report a self-hiding surface as missing an editor. Recorded in
  `docs/design/DASHBOARDS-GROUND-UP-PLAN.md` §5/§7, `src/lib/dashboard/registry.ts` and
  `docs/reports/TASK-DASHBOARDBUILD-REPORT.md` §9.2.
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
- **D16 — TEMPLATES ARE NEVER DELETED, HARD OR SOFT (owner, 2026-08-17).** Said during the
  production test-data purge, after this repo's orchestrator soft-deleted four retired
  `contract_templates` and had to restore them from a 44MB backup with their original
  `deleted_at` timestamps. Owner: *"dont delete templates."* **A retired template is retired
  behind a flag and kept.** It is the definition of a document that was executed under it, and
  destroying it destroys the meaning of every signature that references it. **No exception for
  "unused", "superseded", or "test" — the retirement decision and the template both survive.**
- **D17 — A FEATURE IS NOT DONE UNTIL IT IS REACHABLE AND CORRECTLY NAMED (2026-08-18).**
  Established by `docs/reports/OWNER-WALKTHROUGH-2026-08-18.md`, which found the eighth instance
  of correct code that nothing reaches. **Routed is not reachable:** `/app/ops` is routed and has
  no row in `pageRegistry.ts`; the calendar is hand-written JSX parked in the temporary Review
  menu; the central bookings list at `/app/ops/lessons/sessions` is a small underlined text link
  on a KPI card, named *Sessions*, so the owner concluded no such surface existed.
  **Consequences.** (1) Every spec answers **THE REACH** — what a person clicks, from which page,
  and whether that is the only way. (2) Every audit greps the route, the registry row, the link
  and the call site — **a green function call is not a shipped feature.** (3) The owner's
  *"there is so much work that hasnt run yet"* was, in nearly every case, work that had run and
  could not be found.
- **D18 — NEVER LEAVE A SECOND WRITE PATH BESIDE A CORRECT ENGINE (2026-08-18).** The credit
  engine (`_mint_credits_for_purchase_item`, `_refund_booking_credit`, `complete_lesson_session`)
  mints, expires, refunds and reconciles correctly. `LessonCreditsPage` writes `credits_remaining`
  straight onto the table through PostgREST — no RPC, no audit row, no link to a lesson, no undo —
  and *"Grant credits"* inserts an entitlement with no offering, no purchase, no period and **no
  expiry**. **The wrong path is the one the owner found first.** When a staff action touches data
  an engine already owns, it calls that engine or it does not ship. This is the standing
  "never build a second implementation" rule, in its most expensive form yet.
- **D19 — A VALUE-MOVING ACTION STATES ITSELF, RECORDS ITSELF, AND CAN BE UNDONE (2026-08-18).**
  From the owner's account of the credits page: *"theres literally no transparency, no safety
  protocols to back out of something before triggering it."* **Anything that moves money, credits,
  documents or state** must (1) say what it will do **before** it does it, (2) capture a reason,
  (3) record what it was for — the lesson, the purchase, the document — and (4) be reversible.
  *"Use 1 credit"* firing on one click with none of the four is the standard this rule exists to
  stop. **And the corollary the app fails completely today: four ledgers (`audit_logs`,
  `notifications`, `document_deliveries`, `status_events`) are written and none is ever read back
  to a human, so no staff member can answer "what does this client see?"**
- **D20 — ONE ROSTER OF THE PEOPLE WHO WORK HERE, AND IT IS TEAM (owner, 2026-08-18).** Owner:
  *"i stated to consolidate by taking pages like staff and team and merge them into one. we either
  have a staff or a team and we chose team but staff was in the original build and never revised
  only written around."* **`StaffPage` (`/app/ops/employees/staff`) is retired into `TeamPage`
  (`/app/ops/team`)**, which absorbs `profiles.title` and `profiles.pay_type`. Spec:
  `docs/tasks/TASK-ONETEAM-there-is-one-roster-and-it-is-team.md`.
  **The part that outlives this one merge:** `is_suspended` (Team) and `staff_active` (Staff) are
  **two independent booleans for one fact**, written by two pages that never read each other —
  that is the real defect, and the duplicate page is only how it became visible.
  ⚠️ **And how it survived is the lesson.** `TASK-PAGEMERGE` had this exact pair in scope and
  deferred it citing *"`mod.employees` still off for FHE"* — a claim already **three days stale**
  (`TASK-PAGEVIS` enabled every module on 2026-08-12; PAGEMERGE ran 2026-08-15). The false premise
  came from a comment in `reviewSection.ts` written within an hour of the module being turned on.
  **A state claim in a doc is a hypothesis. Query `org_modules`, the live function body, or the
  table — then act.** Same class as D17's stale `pageRegistry.ts:125` comment about the calendar.
- **D21 — AN ALGORITHM IS CONFIGURATION, NOT CODE. IT SHIPS WITH AN EDITOR (owner, 2026-08-20).**
  Owner: *"pricing algorithms should have an editor to construct them built into the app, not hard
  coded into the app via working with you."* **Extends D13 one level further than it has ever been
  taken.** D13 said tenant-configurable *content* — copy, prices, templates, vocabularies — must
  ship the surface that edits it. **D21 says the same of the RULE that computes a value.** The two
  acquisition pricing algorithms (finder: fee against duration and volume; assistance: fixed fee
  from a budget band) are **not to be designed by the owner and then hardcoded by a thread.** The
  deliverable is the editor in which he constructs them himself, and re-constructs them whenever he
  likes. **Consequence: "the owner has not designed the algorithm yet" stops being a blocker on
  anything** — it is work the product absorbs, not a prerequisite a thread waits on.
  ⚠️ **Generalise it.** Any future formula — a discount rule, a proration, a cancellation penalty,
  a commission split — is subject to this. **A hardcoded business formula is now a defect by
  default**, and a spec proposing one must say explicitly why an editor is impossible.
- **D22 — THE CONTACT RECORD IS THE SOURCE OF TRUTH FOR PARTY FIELDS, AND CHANGES PROPAGATE
  (owner, 2026-08-20).** Owner: *"the contract template only supplies the email address, everything
  else is derived from the contact record, which the onboarding flow enters the data into… if the
  contract record changes, email, name, phone, address, they need to be pushed to the contract
  fields."* And on why: *"otherwise we end up with a contract that is locked to only using the
  email address."*
  **0. THE COLLECTED SET IS PER PATH (owner, 2026-08-20 — REVISED the same day; the revision is
  the ruling).** First stated as four values for everyone: *"the form they fill in when they use the
  link for /sign/deal they enter their full name, phone number, email, and full address."* That was
  read as a universal rule and built as one, which made every `/sign/*` path demand a street address
  before a stranger could ask about lessons. **Corrected:** *"full name and email and phone number
  are the minimum required set, if they have a contract they need to give us an address."*
  **So: name + email + phone are the minimum on every path. The full address is REQUIRED on
  `/sign/deal` only** — that is the path with a contract behind it, and `.ADDRESS` is one of the
  five party tokens the instrument prints. It is still ASKED for on the other four paths, plainly
  marked optional, because the contact record wants it and asking later costs more.
  **A PARTIAL address is refused on every path**, required or not: "optional" means leave it blank,
  not "a street with no city will do" — `compose_address` would compose the fragment into the
  contract exactly as typed. Enforced in `SignStart.tsx` AND in `api/sign-start.ts`; the browser is
  not the authority on what a request must contain.
  ⚠️ **THE PER-PATH DIFFERENCE IS A CONSTANT IN THE PAGE, NOT CONFIGURATION — AND THAT IS AN OWNER
  RULING, NOT AN OVERSIGHT (2026-08-20).** `PATH_REQUIRES_ADDRESS` sits beside `PATH_SEGMENTS`,
  `PATH_CATEGORIES` and `WELCOME_COPY`, which are the same idiom and already vary that page by path.
  A thread proposed backing `/sign/*` with `form_definitions` + the existing `/app/ops/admin/forms`
  editor instead; **the owner declined**, in these words: *"i did not intend to invite this type of
  question and answer set into my life."* **This is a deliberate, recorded exception to the D13/D21
  reflex** — the machinery exists (`form_definitions`, 28 live rows, `set_form_required`, a live
  admin page) and was considered and rejected FOR THIS SURFACE. **Do not re-propose it.** D13 and
  D21 are undisturbed everywhere else: they govern tenant-editable CONTENT and business FORMULAS,
  and which four boxes a signup page shows is neither.
  **1. A contract party is an email plus a contact reference. Nothing else is stored on the
  contract.** Name, phone and address are DERIVED, never typed into the contract a second time.
  Selecting an existing contact pulls their record into the party fields; an email-only party
  derives nothing until the contact record is populated.
  **2. A change to the contact record — email, name, phone, address — is pushed to the party
  fields of that contact's contracts.** The engine already exists and must be reused, never
  rebuilt: `fill_party_fields_from_contacts(p_document_id)` → `remerge_contract_from_clauses(
  p_document_id)`, the pair `captureContactInfo()` already runs (`src/lib/contracts.ts:680-698`).
  **3. THE NAME IS THE SIGNATURE AND CANNOT BE CHANGED. Contact details CAN (owner, 2026-08-20).**
  Owner: *"even on a locked contract this information can be updated because we would have the
  previous version archived and the contract information such as phone and email and address are not
  part of the signature, only the name is… so that cannot be changed."*
  **Phone · email · address propagate even on locked and executed documents. The party NAME does
  not** — it is what the signature attests to, and on a signed document it is immutable.
  **Verified, and this is why the ruling is safe:** execution snapshots the signed content into
  `contract_execution_audit` — `merged_body`, `execution_hash`, `change_log`, `comments`, written by
  the `snapshot_execution_audit` trigger. **The evidence is the snapshot, not the live row**, so
  re-merging the live document does not destroy what was signed.
  **6. THE IMPLEMENTATION IS TOKEN-LEVEL, AND IT IS SMALL (owner direction, 2026-08-20).** Owner:
  *"this requires a fetch and read on generation for the contract even after its signed… make only
  the name fields lock with the rest of the contract and the phone, email, and address need to stay
  unlocked and editable… the contracts are already created with a 'this value is changed in the
  record where the data lives' rule."*
  **Verified — the rule already exists as data.** `template_tokens` declares `source_table` and
  `source_column` per token, and party identity is **tokens, not `contract_field_defs` entries** —
  the party's name/email/phone/address are not editable contract fields at all, which is exactly why
  they are edited at the record. `fill_party_fields_from_contacts` writes **five tokens** per party
  namespace: `.FULL_NAME` · `.PRINTED_NAME` · `.EMAIL` · `.PHONE` · `.ADDRESS`.
  **So the build is: freeze two of the five once signed, keep three live, and re-fill on
  generation.** `.FULL_NAME` and `.PRINTED_NAME` lock with the rest of the contract because they are
  what the signature attests to; `.EMAIL`, `.PHONE` and `.ADDRESS` keep re-filling forever.
  **Do not invent a second locking concept** — this is an exclusion inside the existing fill, plus a
  remerge on generation which today runs only at edit points.
  **7. THE OWNER'S CANONICAL RESTATEMENT (2026-08-20) — this is the design in one paragraph.**
  *"only an email address is required for a contract to have a valid party and it must have a full
  name for it to be signable, and only the name is locked after signing and all data comes from the
  contact record or horse record, and the one exception is the email address — when its added to the
  contract to create a party that information is matched, that means it isnt read from the client
  record until they claim the contract by activating their account with a matching email."*
  **Verified accurate, including the horse half:** `sync_horse_fields_to_documents` mirrors the
  contact fill, and `template_tokens` declares `source_table='horses'` per horse token. The two
  exceptions on the horse side (`HORSE.MICROCHIP`, `HORSE.LABEL`, plus vet/farrier details) carry no
  source and are typed, because the horse record does not hold them.
  **THE EMAIL IS THE ONE VALUE THAT FLOWS THE OTHER WAY.** Every other token reads
  record → contract. The email is written contract → party as a **match key**, and nothing is read
  back from the contact record until the person claims the contract by activating with that address.
  **This is what makes an email-only party coherent rather than an empty one.**
  ⚠️ **"Must have a full name to be signable" is NOT ENFORCED TODAY — it must be built.**
  `contract_lock_blockers` raises `required_fields` and `party_type_mismatch` but **no
  name-completeness blocker**, and it coalesces a party's display name to
  `… c.email, 'A party'` — so a nameless party renders as their email address, or as the literal
  string **"A party"**, and signing is not prevented. **A signature whose printed name is "A party"
  is worthless, and the name is the one thing the signature attests to.** This blocker is part of
  the work, not a separate cleanup.
  ⚠️ **EXCEPT where the snapshot never ran.** Flow-map finding X4: `sign_release` executes with a
  status-only UPDATE and therefore **skips all three execution triggers including
  `snapshot_execution_audit`.** Kiosk-executed documents have **no archived copy**, so for those the
  live row IS the only evidence and propagation would destroy it. **Fix X4 before enabling
  propagation on any kiosk-executed document.**
  **4. On a signable-but-unsigned document, a propagated change is a CHANGE, and D14 governs it** —
  surfaced to the party who did not make it, one at a time, seen-is-approved. Propagation does not
  get to bypass the review flow just because a machine made the edit rather than a person.
  **5. The defect this rule exists to close:** `fill_party_fields_from_contacts` has **no trigger on
  `contacts`** and runs only at contract-start and party-change, so an email-only party fills from an
  empty contact and **nothing ever re-fills it** — `redeem_contract_invitation` promotes and
  re-anchors but never calls the pair. The party opens their contract and sees their own details
  blank.
- **D23 — DECLARING PAYMENT UNBLOCKS EVERYTHING. THE LESSON IS THE CONTROL, NOT THE BOOKING
  (owner, 2026-08-20, restated and enforced).** Owner: *"nothing blocks them from any action because
  the lesson never happens without payment being verified,"* and when shown that the app did the
  opposite: *"the app needs to follow my instruction that you quoted back to me, nothing blocks
  them."*
  **A client who declares payment — Zelle or cash — is immediately able to do everything**, booking
  included. **Credits mint on DECLARATION, not on staff confirmation.** Staff confirmation remains,
  and it governs **whether the lesson happens**, which is an operational control, not a UI gate.
  **Proven broken by `TASK-WALK1` (2026-08-20):** after declaring both Zelle and cash, *Book this
  time* returned `NO_CREDITS` and booked nothing, because `trg_mint_credits_when_order_opens` mints
  only on a status transition staff perform. **Two of the app's own screens already promise the
  ruled behaviour** — the order page (*"scheduling doesn't wait on payment"*) and onboarding
  (*"either way you can book your sessions on the Calendar"*). **The copy was right and the code was
  wrong.**
  ⚠️ **Corollary — A WEEKLY MEMBERSHIP IS A STANDING SLOT, NOT A CREDIT BALANCE.** Owner,
  2026-08-20: *"its not like we get paid and then issue them credits and then they have to go
  schedule them, that would be a monthly riding punch card, not a weekly paid monthly riding slot,"*
  and *"mint into eternity the weekly schedule and its gated on did they pay at the staff
  fullfilment level."*
  **Two shapes, two products.** `config_kind = 'scheduled'` (Single, Evaluation, 4-/8-Lesson Punch
  Cards) gives **credits the client spends and schedules themselves**. `config_kind = 'recurring'`
  (1x/2x Weekly) gives **a standing weekly slot — a reserved recurring time that is theirs**, chosen
  once, recurring until cancelled. **`weekly_frequency` is slots per week, not credits.**
  **This is CAREPLANS' ruling generalised** — *the chosen days ARE the entitlement; the month opens
  with bookings and zero spendable credits* — and weekly lessons must converge on that same
  mechanism, not a second one. **A recurring purchase that produces a SPENDABLE credit is defective** — the allotment
  row itself is correct. Owner: *"the way a credit is minted for a weekly recurring client is if they
  cancel or while they are rescheduling."* **The credit is a holding form for a session owed but not
  delivered at its standing time.** CAREPLANS proved the shape — one allotment row, `total = N`,
  `remaining = 0`, and that row is the cap `_refund_booking_credit` restores into on cancellation.
  **An orchestrator reported the zero as a defect and was corrected; do not report it again.** **"Did they pay" is answered by staff AT FULFILMENT**, not at purchase and not at
  booking.
  ⚠️ **No scheduler exists and none is needed:** `pg_cron` is **not installed** (no extension, no
  `cron` schema) and the Vercel crons were never created — but a standing slot has nothing to top up
  monthly. Today a recurring purchase produces **nothing at all**, which is the live defect.
  ⚠️ **The orchestrator specced this wrong twice — "mint the first period then ask about month 2",
  then "mint credits forever" — and was corrected both times. The product is a slot.**
- **D24 — D23 NARROWS D9's PREPAID GATE: A STANDING SLOT SURVIVES AN UNCONFIRMED PAYMENT
  (orchestrator ruling on the BUYANDBOOK thread's flagged override, 2026-08-20, owner-confirmed).**
  D9 records the reasoning *"payment is prepaid-gated (no payment, no service)"*. **D23 rules that
  declaring payment unblocks everything, and staff confirmation governs whether the lesson happens.**
  The `BUYANDBOOK` thread hit the collision on recurring plans and **deliberately overrode the
  prepaid gate, then flagged it rather than hiding it. That override is CORRECT and is now the
  rule.**
  **A weekly slot that disappears while a Zelle payment awaits confirmation is precisely the block
  the owner ruled out** — the client would watch their reserved time vanish for a reason they cannot
  act on. **The slot persists; delivery is the control.**
  **D9's prepaid principle survives everywhere it was actually about** — no dunning, no overdue
  reminders, no service delivered unpaid. **It does not extend to withholding a reserved time from a
  client who has declared payment.**
  ⚠️ **When a settled decision collides with a newer one, override deliberately and FLAG IT.**
  This thread did exactly that, which is why the collision was ruled on rather than discovered later
  as a defect.

- **D25 — "BOOKING" IS INTERNAL TAXONOMY ONLY. THE USER SEES THE OFFERING, AT THE RIGHT LEVEL
  (owner, 2026-08-21).** Owner: *"we have bookings (a term used for a calendar item linked to an
  offering purchased by a client on a processed order that has payment pending or paid status)…
  Its supposed to be an internal taxonomy only… this was flat out wrong."* The word was applied
  liberally to calendar entries, page names, step names and references. **It is a data concept, not
  a label.**
  **The naming level differs by service, deliberately:**
  - **Riding lessons — go HIGH.** Always *"Riding Lesson"*. **Never** surface 2x weekly, evaluation,
    single or à la carte to the client. *"Schedule a Riding Lesson"* · *"Select the day and time for
    your weekly Riding Lesson(s)"* · *"You are scheduled for a Riding Lesson with Claire this week"*
    · *"Reschedule your Riding Lesson"*.
  - **Horse care — go LOW, but stop above quantity/frequency.** Name the actual service —
    turnout · clipping · training · exercise — never the SKU's frequency. *"Select the day for
    turnout"* · *"Select the day for your horse's hair clipping"*.
  **And the noun changes per service:** exercise/turnout/training are a **service** (*"your horse
  {name} is scheduled for turnout service with us"* → *"change or cancel your request"*); clipping is
  an **appointment** (*"your horse {name} is booked with us for a hair clipping"* → *"change or
  cancel your appointment"*); lessons are a **Riding Lesson**.
  **⚠️ BOOKING CONFIGURATION IS PER-OFFERING AND MUST BE FLEXIBLE.** *"we need to be flexible for the
  user to configure the terms of the booking request relative to what is needed/logical on an
  offering by offering basis."*
  - **Riding lessons:** day **and time** (a standing weekly slot — see D23).
  - **Horse care:** the client picks **month OR week OR day** — one of three granularities — and
    **"any day is fine" is valid** (common for training and clipping). **Do NOT make horse-care
    clients pick timeslots**; if a specific slot matters it is resolved with Claire directly.
  - **Turnout additionally takes a QUANTITY plus what the quantity applies to.** Real shapes to
    support: *2x this week* · *4x every week* · *every Mon/Wed/Fri* · *every weekend* · *as needed,
    bill me monthly for what was done* · *at least X times per week for the month of Z* (a
    prearranged fixed monthly price, typically mixing ridden exercise and turnout, **with Claire
    choosing which to do on a given day — or resting the horse — based on weather, the horse's
    condition and her availability**).
  **Owner presence is NOT modelled.** Horse care usually happens without the owner there, and is
  often needed *because* they are away. If they want to attend, they arrange it with Claire.
  **Do not add complexity to capture it.**
- **D26 — TWO OWNER ROLES: HEAD TRAINER vs BUSINESS OPERATIONS, AND EACH GETS ITS OWN DASHBOARD
  (owner, 2026-08-21).** *"the logical split is Client vs Business ops."*
  **`hello@fhequestrian.com` (Claire) = Owner — Head Trainer.** Client-facing. Her dashboard is her
  working surface: the day/week plan of what is scheduled · people to reach out to · outstanding
  payments · new orders · client questions · client contributions and responses to lesson notes ·
  **plus the stable: horses and their needs/appointments/schedule/usage, equipment and supplies
  needed or broken, and follow-ups with vendors, suppliers, partners and customers.** Owner: *"She
  should live in her dashboard as the action surface she uses to manage her day/week/month."*
  **`admin@fhequestrian.com` (CJ) = Owner — Business Operations.** Business-facing, **but carries a
  subset of Claire's KPIs, alerts and to-do visibility deliberately — a second set of eyes, or
  because they are working on it together.**
  **Both are Ops dashboards. The role selects the emphasis, not the capability** — same user role,
  same permissions; only the default views and priorities differ.
  ⚠️ **The dashboard is the LANDING SURFACE**, shown on a fresh login **and after ~30 minutes away**
  — not a page you navigate to.
  ⚠️ **Every user with anything on a calendar gets a schedule view.** Not staff-only.
  ⚠️ **Revenue by week and month is a first-class dashboard number.** The calendar shows it today
  and **shows it inaccurately.**
  **Shippable now, ahead of the refactor:** a designation on the company accounts plus a
  dashboard that reads it. The full split lands with the refactor.
- **D27 — EVALUATIONS AND ACTIVITY RECORDS ARE RECORDS ON A RIDER OR HORSE — NOT DOCUMENTS, DEALS
  OR MONEY (owner, 2026-08-21).** Corrects both the chat thread's *"move Evaluations to Money"* and
  the orchestrator's counter-proposal of *"Documents & Deals"*. **Both were wrong.**
  Owner: *"The evaluation is like a report card, we have two types, rider and horse, both live on
  their record and both are considered an initial entry after creation of the account and used as
  reference for downstream actions."*
  **The full record taxonomy, all living on the rider or horse record:**
  1. **Evaluations** — rider and horse. The initial entry; referenced downstream.
  2. **Riding / exercise logs.** Riding applies to riders **and** horses; exercise applies to horses
     only. **Claire rides as Trainer, with a ride type of Training or Exercise.**
  3. **Reports** — Riding Lesson Report · Horse Training Report.
  4. **Horse Exercise Notes** — covering turnout and riding.
  5. **Photos and video** — lessons, training, exercise. **Clipping uses a log, a note and
     before/after photos — and the app must PROMPT Claire to capture them.**
  **Everyone involved sees what makes sense for them** — Claire, the horse's record, the business,
  the rider. **An activity log is the minimum; clicking an entry opens the content.** Calendar and
  schedule are additional access paths showing past/current/future, and **notes, photos and plans can
  be added before and after the activity.**
  ⚠️ **NEVER LOCKED, ALWAYS LOGGED.** *"they are never locked they can always be edited but the
  changes are always logged so the record cant be changed without visibility if needed during an
  audit."* Real deletion happens **only at the database level**, never through the UI.
  ⚠️ **THE ONE SCRUB EXCEPTION — narrows D11/D15.** *"If something sensitive is accidentally captured
  like maybe the wrong photo is added or the wrong text is pasted into a note and saved, we need to
  have the ability to fully scrub it so we remove liability over that content."* **This is the sole
  case where content is genuinely destroyed rather than retired behind a flag.** It exists for
  liability over content that should never have been captured. **It is not a general delete, and it
  does not weaken D11 (accounts archive), D15 (linked files survive) or the rule that executed
  documents are evidence.**
- **D28 — THE GENERAL RELEASE IS FOR VISITORS AND DOES NOT STACK. RIDER AND OWNER RELEASES DO
  (owner, 2026-08-21).** Owner: *"general release is for visitors, riders and horse owners have
  their own release to sign and the rider and owner releases stack but the general release doesnt."*
  **The live `category_document_requirements` data is CORRECT as it stands** — this rule exists to
  stop it being "fixed":
  - **Guest** → `RELEASE_GENERAL` + `COMPANY_POLICIES` + `FACILITY_RULES`
  - **Rider** → `RELEASE_PARTICIPANT` + `HUMAN_EMERGENCY_MEDICAL` + policies + rules — **no general
    release**
  - **Horse owner** → `RELEASE_HORSE_CARE` + `RELEASE_PARTICIPANT` + `HORSE_EMERGENCY_VET` +
    policies + rules — **no general release**
  **A rider who is also a horse owner holds BOTH the participant and horse-care releases — they
  stack.** `RELEASE_GENERAL` never joins that stack, because a person with a rider or owner release
  is covered by a narrower, stronger instrument.
  ⚠️ **`TASK-CATEGORISE` raised "a Rider never gets a general release" as an open question and the
  orchestrator relayed it without checking the design. It was never a defect.** Do not raise it
  again.
- **D29 — A CHANGE AND A PROPOSAL ARE DIFFERENT THINGS. D14's SEEN-IS-APPROVED APPLIES ONLY TO
  CHANGES (owner correction, 2026-08-21).** The orchestrator read `TASK-WALK3`'s observation —
  *"proposals appear in a card with no accept/reject control anywhere"* — as confirming D14. **It
  does not. It is the defect.** Owner: *"how is this good news? the entire task was adding the
  accept reject revise mechanisms."*
  **The two mechanisms, and they must never be conflated again:**
  1. **A CHANGE** — a party edits something they are entitled to edit. It is already true. The other
     party is shown it before signing, one at a time, and **being seen on screen IS approval**
     (D14 §2). **No accept button, by design.** `ReviewChangesModal.tsx` is this flow — and note it
     still carries the OLD explicit accept/reject machinery (`outcomes: 'accepted' | 'rejected'`,
     rejection comments) that D14 says to replace with seen-is-approved.
  2. **A PROPOSAL** — a party asks for something they cannot do unilaterally. It is **not** true yet.
     **It requires an explicit disposition: ACCEPT · REJECT · REVISE.** Being seen changes nothing,
     because nothing has happened yet.
  ⚠️ **CORRECTION, 2026-08-21 — THE ORCHESTRATOR WAS WRONG. THE DISPOSITION IS BUILT AND WIRED.**
  I grepped for `accept`/`reject` by name, found nothing, and concluded it did not exist. **It is
  named `resolve`.** Verified end to end by the repo-review thread:
  `resolve_clause(p_addendum_id, p_accept boolean)` sets `status` to `accepted` or `rejected`,
  guarded by **`caller_may_resolve`** so a proposer cannot resolve their own suggestion ·
  `resolve_field_edit` · `withdraw_clause` · `withdraw_field_edit` · plus
  `update_contract_composition` (edit an added item, gated staff-or-author via
  `added_by_contact_id`). **All have live UI call sites** — `ContractPage.tsx:214-243` renders
  Accept, Reject and Withdraw; `ClauseDocument.tsx:809/823` renders edit and remove. The
  `20260815T1000_partystaging_edit_vs_suggest.sql` header states the design outright:
  *"Suggest-tier stays pending until the ACTUAL COUNTERPARTY (not staff) resolves it — peer
  approval, not a staff-brokered one."*
  ⚠️ **SO WALK3's OBSERVATION IS A GATING BUG, NOT A MISSING FEATURE.** The controls are conditional:
  `isOwnerSide || (hasPartyRole && !mine)` → Accept/Reject · `mine` → Withdraw · **otherwise the
  text "Pending review"**. Both of WALK3's sessions landed on that last branch, which means
  **`my_roles` came back empty from `contract_document_detail`.**
  **ONE IDENTITY BUG PRESENTING AS TWO MISSING FEATURES:** the same identity resolution gates the
  edit controls (`isOwnerSide || f.added_by_me`). If the viewer's party identity does not resolve,
  proposal controls AND edit controls both vanish. **Fix `my_roles` and both symptoms likely clear
  at once.** Connects to the `PARTYRLS` and `PARTYEMAIL` party-visibility work.
  ✅ **REVISE is the ONLY genuinely absent capability** — a recipient can accept, reject or the
  proposer can withdraw, but **there is no counter-offer.**
  **So the contract review area needs work in BOTH directions:** strip the explicit accept/reject
  from the CHANGE flow (D14), and build it for the PROPOSAL flow.
- **D30 — THE REBUILD IS GROUND-UP: NEW APP, NEW DATABASE, DATA PORTED NOT MIGRATED (owner,
  2026-08-21).** Owner: *"everything will be built anew and the data will be ported, not
  migrated. We need to map the old data to the new app and db because they will for sure be
  completely different. There is no chance that all of the tables and functions we have in the
  current one are necessary for this app to function as required and that starts with the way
  the records are constructed."*
  **Consequences, binding on every thread that touches the refactor:**
  1. **This is not an ALTER-forward migration.** The new schema is designed independently of the
     current one. **No thread may propose "extend the existing table" as a shortcut** — the
     existing schema is a reference for what data exists, not a constraint on what the new one
     must look like.
  2. **`supabase/migrations/` (852 files, 8.4MB, zero tracking table, 114+ non-replayable
     in-place function rewrites) is ARCHIVED, not carried forward.** Tag `pre-refactor-migrations`
     before removal. It documents history; it builds nothing.
  3. **"Ported" means: extract from the current production DB, transform to fit the NEW schema
     once designed, load into the NEW database.** This is a data-migration SCRIPT written after
     the new schema exists, not a schema migration applied to the old one.
  4. **The identity/records model is explicitly named as suspect and first in line for
     redesign** — `contacts`/`profiles`/`groups`/hardcoded GUEST-RIDER-HORSE_OWNER categories,
     the fragmented "Records → All" tab. **Do not assume any current table survives unchanged.**
  5. **`fhe-database-export.zip`** (2026-08-21, all 644 function bodies + full schema + RLS +
     triggers, pulled live from prod) **is the reference for what exists today** — read for
     inventory, not treated as a target to preserve.
- **D31 — TAGS ENABLE. THEY DO NOT OBLIGATE. OBLIGATION IS COMPUTED FROM WHAT WAS PURCHASED
  (owner, 2026-08-22).** Corrects the GUEST/RIDER/HORSE_OWNER category model itself, not just
  the missing deal-party case. Owner: *"We need to back out of the guest/client paradigm and
  just have accounts. then an account can get a tag that shows up as a badge as an identifier
  that obligates or enables something in the system for that user. a person without the horse
  owner tag doesnt have the option to sign a horse vet auth document, and a person with the tag
  has the ability to sign it but isnt obligated to do so until they purchase something that puts
  us in a position to need that authorization from them."*
  **Two separate questions, currently conflated into one hardcoded bucket:**
  1. **Eligibility** — can this account even be shown/offered a given document or action. A tag.
  2. **Obligation** — must this account complete it now. **Computed from what was actually
     purchased or what relationship currently exists, never from static category membership
     alone.**
  **The current `category_document_requirements` model conflates them** — picking a category
  wholesale assigns a fixed document SET, whether or not anything yet requires it.
  **The system already has the correct mechanism for HALF of this, underused:** the
  purchase-triggered chain (`purchase_items` trigger → `promote_buyer_from_offering` →
  `apply_affiliations` → `apply_category_documents`) already derives obligation from what was
  bought, not from a static staff-picked bucket. **The rebuild's job is to make this the ONLY
  path**, with the staff-picked "category" reduced to eligibility tags only.
  **A null tag set is a real, intentional state, not a gap** — verified 2026-08-22:
  `apply_category_documents` already no-ops safely on an empty category array, and the
  email-only contract-party path (D22/PARTYEMAIL) already creates a party with zero categories
  touched. **A person who owes nothing but a contract needs no new category — they need none at
  all**, which the system already supports.
  ⚠️ **Do not resolve this by adding more hardcoded tokens to `CLIENT_CATEGORIES`.** Every
  addition (GUEST → RIDER → HORSE_OWNER → 'Deal client') has been exactly this pattern, and D30
  already names the category/role model as first in line for the ground-up redesign. Stabilize
  the current app by using the null-tag state where it already works (see the `TASK-STABILIZE`
  deal-party resolution); do not extend the old paradigm to buy time.
  ⚠️ **CORRECTED SAME DAY — the null-tag answer was incomplete.** Owner: *"deal party or contract
  party are appropriate tags for an account that has a deal or a contract. for something like a
  lease agreement with signed auth and liability release docs where there are no purchases they
  need to be a deal so the three documents can be seen together. and live in the same known
  event."*
  **The account-level category still stays empty for a pure contract signer** — that holds.
  **But document OBLIGATION for a contract party is not an account-category question at all —
  it is a CONTRACT-ROLE question, and the mechanism already exists, seeded, completely unwired:**
  `contract_role_documents` (`doc_role`, `template_key`) already maps LESSEE → Company Policies +
  Facility Rules + Horse Care Release + Emergency Vet Auth; LESSOR/BUYER/SELLER have their own
  bundles. **Verified 2026-08-22: zero functions in the database reference this table.** It is
  exactly "the documents that live together in one known event" the owner is describing — the
  event is the specific contract, the role determines the bundle — and it was never wired to
  actually assign anything.
  **So the real fix is not a new account tag. It is connecting `contract_role_documents` to
  document assignment when a party is placed in a role on a contract** (D22's
  `document_parties`/party-add machinery is where this belongs). The visible "deal party" badge
  the owner wants is a DISPLAY layer on top of this — a person derives that badge from holding a
  contract role with no purchase behind it, not from a category picked at account creation.
- **D32 — THE MASTER RETENTION PRINCIPLE: NOTHING IS EVER REMOVED FROM THE DATABASE, EXCEPT
  DELIBERATELY SCRUBBED SENSITIVE CONTENT (owner, 2026-08-22).** Owner, generalizing today's
  archive-vs-delete finding into the standing rule it always was: *"the rule is that nothing
  ever actually gets removed from the db and this is a good example of the reason why. the only
  time something is ever actually truly scrubbed is if its deemed sensitive information that
  shouldnt be in the database."*
  **This is the single principle D11, D15, D16 and D27 were each independently instances of.**
  Cite D32 going forward; the other four remain as the worked examples.
  - **D11** — accounts are archived, never purged; a departing client's files stay because
    other people's records still depend on them.
  - **D15** — a file linked to a shared item is never removed, even by its own uploader.
  - **D16** — templates are never deleted, hard or soft; a retired one is flagged and kept.
  - **D27** — activity/evaluation records are never locked and never destroyed through the UI;
    editable forever, every change logged.
  **The ONE exception, and it is narrow on purpose:** content that should never have been
  captured at all — an accidentally uploaded photo, a pasted note containing something
  sensitive — may be genuinely scrubbed, because its continued existence is the liability, not
  its removal. **This is a decision about the CONTENT, never about the ACCOUNT or RECORD it sits
  on.** Archiving a person is never a reason to scrub their data; only the sensitivity of a
  specific piece of content is.
  ⚠️ **Consequence for `purge_account`:** it is a genuine hard delete (confirmed 2026-08-22 —
  `DELETE FROM signatures WHERE signer_contact_id = …` among ~15 other DELETEs) and is
  **already the odd one out under D32**, kept only as the owner's own deliberate, manually
  invoked tool for his own test identities (D1's 5g routine). **It is not a pattern to extend or
  generalize — `TASK-ARCHIVE` is the actual D32-compliant tool**, and the rebuild's job is to
  ask whether `purge_account` should exist at all once a real archive mechanism does.

- **D33 — A TEMPLATE VERSION CHANGE NEVER OBLIGES A PAST SIGNER (owner, 2026-08-26).**
  Asked directly — *"on the contract version change and past signers, no and no"* — whether
  editing a template should mint a version on the lease trio now, and whether past signers must
  re-sign when a template changes. **Both no.**

  **An executed document is frozen against the version it was signed at, and that is sufficient.**
  `documents.signed_template_version` carries it on all 67 executed documents (zero nulls,
  verified 2026-08-26), and `regenerate_contract_document` returns the stored body without writing
  when the versions differ on an executed document. **So a template edit cannot reach signed
  paper, and there is nothing for a past signer to re-affirm.**

  ⚠️ **THEREFORE: NEVER BUILD A RE-SIGN PROMPT, A "YOUR CONTRACT HAS CHANGED" NOTICE, OR A
  RE-EXECUTION FLOW TRIGGERED BY A TEMPLATE EDIT.** If a signed agreement genuinely needs to
  change, that is a new document — an amendment or a superseding contract — not a version bump.

- **D34 — PERSISTING AND COMMITTING ARE DIFFERENT ACTS (owner via CR-83/CR-84, built by
  `TASK-FIX4`, merged 2026-08-31).** **Closing a dialog — the X, Escape, the backdrop — NEVER
  submits, and NEVER discards.** Input is kept because the surface **auto-saves after input** and
  flushes the pending write on unmount; the affirmative control is the only thing that commits.

  ⚠️ **THE HISTORY MATTERS, BECAUSE THE THIRD BEHAVIOUR IS NOT A RETURN TO THE FIRST.** Close
  originally **discarded** (data loss, the owner reported it) · `TASK-FIX2` made close **commit**
  (an unintended write) · `TASK-FIX4` makes close **do nothing**, which is only safe because the
  work is already saved. **A thread that "restores" either earlier behaviour is reintroducing a
  defect the owner has already lived through.**

  **Enforced globally, not per call site:** `src/components/ops/kit/Modal.tsx` decides backdrop
  close **from the live DOM** — it asks whether the panel currently holds a field — so **no call
  site can get it wrong by forgetting a flag**, and a dialog whose fields appear on step 2 is
  protected on step 2. ⚠️ **Do not add a Save button to it; it deliberately offers no way to render
  one.** Two escape hatches exist and are used once each (`allowBackdropClose` on the Messages
  member picker, `disableBackdropClose` where a dialog must not be dismissed at all).

  **Settled alongside it, and NOT open for a fresh opinion:** **Escape still closes** *(the a11y
  contract for `role="dialog"`, a keystroke nobody presses by accident, and nothing is lost)* ·
  **drafts live in `localStorage`, namespaced per signed-in user** *(a server-side table cannot
  serve `/sign/*` at all — a stranger typing their name has no `auth.uid()`, and that is exactly
  where losing input costs most)* · **normalisation happens on blur, once, in front of the person,
  and never re-corrects what they deliberately changed back.**

  ⚠️ **AND THE TEST THAT PROVES IT MUST ASSERT BOTH HALVES** — that closing writes nothing **and**
  that the record still saves. A test asserting only the first passes on a dialog that loses
  everything, which is the defect FIX2 existed to fix.

  **Standing consequence, and it is deliberate:** the four lease templates currently sit one
  clause ahead of their retained version 3 (`LEASE_FEE.NO_FEE_CONSIDERATION`, applied
  2026-08-26 by migration `20260826T1900`). The owner declined to mint v4 for it. **Restore-to-v3
  therefore refuses on those templates until the next publish mints v4 — that is correct
  behaviour, not a defect, and the next wording change is what resolves it.**

  ⚠️ **AND THE RULE THAT CAUSED IT: a migration that changes template wording must call
  `save_contract_template_version` afterwards.** The migration above did not, which is how the
  drift was created — found by TASK-VERSIONSPINE, against the orchestrator's own work.

- **D35 — A WORKTREE ISOLATES GIT. IT DOES NOT ISOLATE THE DATABASE (2026-09-01).**
  Four threads ran in parallel with file-level ownership assigned. ⚠️ **`TASK-BOOKS1` replaced
  `mark_purchase_paid` in production fifteen minutes after `TASK-BACKDATE` had applied a guard to it.
  The guard vanished silently — the function still existed, still compiled, still returned `paid`.**
  It was caught only because BACKDATE re-ran a test that had passed an hour earlier.

  ⚠️ **THE CAUSE WAS THE ORCHESTRATOR'S, AND IT WAS WRITTEN DOWN IN ITS OWN TWO SPECS:**
  `TASK-BOOKS1` §8 said *"`mark_purchase_paid` IS YOURS"* while `TASK-BACKDATE` required that same
  function to carry a date and refuse a future one. **Two specs, one function, opposite ownership.**

  🔒 **THEREFORE: ownership of a DATABASE OBJECT is exclusive across every running thread, and it is
  declared before any of them start.** **There is ONE production database and every worktree writes
  to it.** ⚠️ **Two threads may never hold the same function, table or trigger, however different
  their file lists look.**

  🔒 **AND: a thread that applies a migration re-runs its own verification immediately before
  reporting**, because between apply and report someone else may have replaced what it just proved.
  ⚠️ **A green check from an hour ago is not evidence.**

- **D36 — THE POOL SURVIVES; SELF-SELECTION DOES NOT. ORCH ASSIGNS EVERY WORKTREE (2026-09-01).**
  Rules on the wt-1 collision and on the owner's question of reverting ORCH6's recycled-pool rule.
  **The recycling was not the cause and is kept** — what reuse saves is real (`.env`/`.env.db`,
  which never propagate, and 449 MB of `node_modules` per tree; `git worktree add` itself is 1s).
  ⚠️ **The cause was the SELECTION protocol: a thread chose its own worktree from an observational
  idleness test.** Reflog-proven sequence: REQCARDS' census recorded `wt-1` idle at ~14:11;
  SIGNBOOK claimed it seconds later; when REQCARDS converted mid-flight to LIFECYCLE — a task with
  no worktree assignment, because the conversion happened after dispatch — it fell back to
  "take one that is idle", trusted its minutes-old census, and checked out `task/lifecycle` inside
  `wt-1` under SIGNBOOK. **A read-then-act idleness test is a race; recycling merely created the
  shared resource it raced on.**

  🔒 **THE RULE, three parts, all binding:**
  1. **ORCH names the worktree at dispatch** — beside the model and effort, outside the prompt
     block — **and records it on the board BEFORE the prompt is handed over.** Contention over a
     directory is right-of-way, and right-of-way is ORCH's, not a station's.
  2. ⚠️ **A TASK thread with no assignment STOPS AND ASKS. It never picks.** A mid-flight task
     conversion is precisely the case: the new task needs a fresh assignment from ORCH.
  3. **The thread-side guard stays, and runs immediately before the checkout, in the same turn:**
     detached HEAD + clean `git status --porcelain`, else the tree is OCCUPIED whatever the board
     says — stop and report. **And the `task/<id>` branch checkout is the CLAIM, run as the first
     act in the tree** — it makes occupancy visible in `git worktree list`, so the next entrant's
     guard fails loudly instead of silently sharing a directory.

- **D37 — THREAD NAMES ARE `[REPO]-[ROLE]-[CHANGE NAME]`, AND EVERY HANDED PROMPT CARRIES
  MODEL TIER · EFFORT · THINKING (owner, 2026-09-01).** The CHANGE NAME is coined once, when the
  change enters the pipeline, and travels with it unchanged through every station:
  `FHE-DISCO-SIGNFLOW` → `FHE-DSNR-SIGNFLOW` → `FHE-ORCH-SIGNFLOW` (a prompt label — ORCH's
  standing thread is not renamed) → `FHE-TASK-SIGNFLOW`. **Multiple TASK threads for one change are
  lettered `-A`/`-B`/`-C` — NEVER numbered: numbers are reserved for a future thread set that
  revisits the same change after its context has moved on.** If the context has NOT changed since
  the last run, future work on that change revisits the existing DISCO/DSNR threads (their context
  is the asset) but always gets NEW task threads, lettered continuing after the last that ran.
  **And every prompt any role hands the owner states, outside the code block: MODEL TIER · EFFORT ·
  THINKING on/off when the model is not Fable** (Fable needs no thinking line). Recorded in all
  four role files + `ORCHESTRATOR.md` § THE PROMPT — the role files predated both rules, which is
  why DISCO's SIGNFLOW handoff shipped without a name or tier line.

- **D38 — PUBLIC-COPY IDENTITY RULINGS: FHE IS JUMPER-ONLY, AND IT IS A PROGRAM, NOT A BARN
  (owner, 2026-08-26, promoted to a D-rule 2026-09-01).** Two wording rulings lived only in
  `docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:104-112` and nothing stopped the
  words returning in the next round of marketing copy — DSNR-SITE-PUBLIC flagged the gap.
  (1) **Never "hunter/jumper" — FHE trains jumpers only.** (2) **The business is a PROGRAM (or the
  tenant's chosen property word via `usePropertyTerm()`), never "the barn", in any copy a guest or
  member reads.** Enforced by `TASK-SITECOPY-A/B`; any future copy task inherits both.

- **D39 — THE UNIT OF WORK IS THE OUTCOME, NOT THE INSTRUCTION (owner, 2026-09-01).** Said after a
  thread built exactly the field he named and nothing that made it visible: *"its obvious that if we
  collect any information from a person it needs to be visible somewhere, right? … you seem to really
  like to build half of something and skip the part where it becomes usable or accessible."*
  🔒 **"Add a field" is never the job — the job is what the field makes possible.** Anything CAPTURED
  is named with the surface that SHOWS it and the surface it is ACTED ON from, and for anything
  time-bound that means the surface the owner actually watches, not a detail page he must go looking
  at. ⚠️ **And anything the outcome needs that was not asked for is PRESENTED BEFORE THE WORK IS
  CALLED DONE** — *"if there are additional things to be done, present them to the user before
  completing your work."*
  ⚠️ **THIS IS NOT A RESTATEMENT OF D17.** D17 asks what a person clicks to reach a FEATURE, and it
  is answered in a spec's own §THE REACH section. **D39 governs work that arrives as a bare
  instruction with no spec** — which is exactly where the question gets skipped, and where it was
  skipped. ⚠️ **It fails hardest under time pressure:** the thread cut the reach question *because* a
  customer was waiting, which is how the customer finds the missing half in production.
  Enforced in `docs/method/TASK-ROLE.md` §2c as three questions every report must answer.
