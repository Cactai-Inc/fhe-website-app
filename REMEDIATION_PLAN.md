# REMEDIATION PLAN — FHE Platform

Instructions for Thread R (Claude Code, single session for the whole remediation). Execute ONE stage at a time. Stop at each stage's exit criterion, report with evidence, and wait for the owner's explicit "Stage N verified, proceed" before continuing — verification happens in a separate thread you never see. Where this file conflicts with any other doc, this file wins; it encodes owner decisions dated 2026-07-27. Read /CLAUDE.md in full before Stage 0. Its working rule is binding here: verify against the live database and code BEFORE asserting anything. Query first, always.

## Settled decisions (inputs — do not re-litigate, do not re-ask)

D1. Identity disposition. admin@fhequestrian.com (CJ, FHE tenant owner) and hello@fhequestrian.com (Claire) are PRODUCTION tenant accounts. The company contact (French Heritage Equestrian) is a PRODUCTION operating identity. admin@cactai.io is the PLATFORM owner (Cactai Inc, super admin) — not an FHE identity; it must hold no FHE tenant rows and is excluded from every tenant-scoped operation in this plan. cjzigs@ and charlesjzigmund@ are the owner's test identities — they remain LIVE and untouched through all stages; their purge happens in owner-run acceptance testing after Stage 5, via the Part-5F purge routine, never ad hoc. The 6 stranded executed documents ride on the test identities and exit with that final purge — no re-anchoring, no cleanup of them in any stage.

D2. The affiliation table is renamed to `groups`.

D3. Purchaser wording: the DB stores a neutral promotion marker; the DISPLAY word is "client" in staff/ops surfaces, "customer" reserved for gift/product-only contexts. CRITICAL member-facing rule: members must see "Member" language about themselves and each other — never "Client". As you touch any surface in any stage, review the strings you render: do not introduce the word "Client" into member-facing UI elements, and flag any existing member-facing use of it in your stage report rather than silently keeping it.

D4. Membership tiers are DEFERRED as a product. Strip UI copy implying monthly/annual membership tiers. Billing schedules + implicit pay-as-you-go describe current reality. `tier` remains a reserved word for the future product.

D5. Build the full promotion pathway: promote_contact_to_account = create/attach account via _ensure_client_account + re-anchor documents/parties/signatures to the account + run apply_affiliations + dissolve the faceless contact. Real users only; identities in D1's protected and test sets are never dissolved.

D6. Fulfillment = one deliverable spine. Every purchase_item with a config_kind produces fulfillment unit rows; status_events drives their state; receipts, dunning, and delivery logging hang off the spine as provable events.

D7. Dual-identity (act-as-company) is a protected behavior: both staff accounts act either as themselves (personal identity displayed AND recorded) or on behalf of the company (French Heritage Equestrian / hello@fhequestrian.com displayed AND recorded). It currently works via patches. Function cannot break. It may be streamlined ONLY as behavior-identical consolidation against the trace produced in Stage 1, and only after that trace exists. If you cannot fully trace the mechanism, STOP and escalate — no blind consolidation.

## Standing boundaries (all stages)

- apply_affiliations remains the SOLE writer of group rows. Never write RIDER/HORSE_OWNER/PARENT_GUARDIAN rows directly anywhere.
- Retired concepts stay retired: engagements, orders, client_purchases, lesson_sessions, transactions, offering tiers, the deleted shadow catalogs (src/lib/services.ts, src/lib/catalog.ts).
- Lease/contract template wording is OUT OF SCOPE — a separate thread owns it via the DB clause model. If a stage forces contract-engine rewiring (Stage 1 and 2 will), rewire read paths only; never edit clause bodies or template content.
- Migration discipline per /CLAUDE.md: timestamped additive files, dry-run inside BEGIN…ROLLBACK against prod, apply via psql, verify with a query, commit. Connection string = first line of .env.db.
- Do not drop lease_participants, document_party_archives, or content_acknowledgments (code-referenced; empty ≠ dead). horse_parties vs horse_relationships is resolved by Stage 1's evidence, not assumption.
- Every stage report ends with: typecheck 0 errors, lint 0 errors (26 pre-existing warnings allowed), the stage's exit-criterion evidence, and the list of anything you flagged rather than fixed.

## STAGE 0 — Documentation corrections

Objective: one truth in the repo before execution.

Work:
0a. Resolve the STATUS_REPORT push-state contradiction: HANDOFF (later, with drift audit) says main is at 1c01b32 and pushed; STATUS_REPORT §1/§7 say 8 commits local-only. Verify against git remote, then correct STATUS_REPORT with a dated amendment note (do not rewrite history claims silently).
0b. Restructure docs/BACKLOG.md around the six pillars (contracts / identity / accounts / account creation / ordering / fulfillment) with a seventh "deferred" bucket. Preserve every existing item.
0c. Pull the orphaned items from the archived GAP-ANALYSIS roll-up back into BACKLOG tracking, with verified current status for each (grep/inspect before writing a status): calendar LARGE modal + week/day/list switcher; stable item form fields (J9–J15); my-posts manage view; standalone password + switch-to-Google; gifts/payment-method backends; documents panel real source; mobile device pass; membership tier model (record as SETTLED-DEFERRED per D4). Mark calendar modal/switcher, stable item form fields, and the mobile pass as UI-lane / deferred — they are NOT in this plan's stages.
0d. TOKEN_DICTIONARY.md: remap the ORD.* namespace to the purchases/purchase_items spine; remove the stale-warning header once done.
0e. Append the D1–D7 settled decisions to /CLAUDE.md (short form) so future sessions inherit them.

Exit: docs commit merged; BACKLOG mirrors the pillars; no doc contradicts another on push state, taxonomy, or decisions.

## STAGE 1 — Identity taxonomy

Objective: the rename and reconcile, with every protected behavior traced first.

Verify-first (report all findings BEFORE any migration):
1a. THE DUAL-IDENTITY TRACE (D7). Document end to end how act-as-company works today: every column, flag, function, trigger, and patched path that produces company display/attribution vs personal, across community posts, contract origination, outbound email sender, delivery logs, and status events. Output: docs/DUAL_IDENTITY_TRACE.md. This document is the behavioral contract for the rest of the project. If any link in the chain cannot be traced, stop and escalate.
1b. Platform separation audit. Query every person-keyed table for rows tied to admin@cactai.io (its user_id, contact_id if any, email matches). Report findings to the owner BEFORE removal — how contamination got there matters more than removing it. Zero rows expected; any row found is reported, not silently cleaned.
1c. horse_parties vs horse_relationships usage evidence: which do the LIVE flows write/read (grep all 4 DB fns + 5 FE references for horse_parties, all references for horse_relationships; check row provenance). Recommend the survivor with evidence. Note: CLIENT.HORSE_CAPACITY resolves from horse_parties.role at signing per the token dictionary — whichever table survives, that resolution path must be re-pointed and proven.
1d. Wording-surface inventory (D3): grep client/customer/member across components, email templates, and document template bodies; tag each hit ops-only / member-facing / signed-document. Output: docs/WORDING_SURFACES.md. Flag any member-facing "Client" for the owner.
1e. Enumerate every reader/writer of contact_roles, members.tier, and category_document_requirements (DB functions + FE) so the rename's rewire list is complete before you start.

Work (each its own migration, dry-run → apply → verify → commit):
1f. contact_roles → groups: affiliations only (RIDER / HORSE_OWNER / PARENT_GUARDIAN), written solely by apply_affiliations. CLIENT moves to the neutral promotion marker per D3; GUEST leaves the table (guest = account with no group); PARTICIPANT/GUARDIAN stay per-document on document_parties. contact_type added on the faceless side (VENDOR, TRACKED_VISITOR, WEB_SUBMITTER). Rewire every reader found in 1e.
1g. Drop members.tier (vestigial, always 'community'). Verify is_active_member() and all RLS gates behave identically before and after with a before/after query pair.
1h. Split category_document_requirements: group-driven onboarding docs (by group) vs contract doc-roles (Buyer/Lessee/Lessor/Seller — contract engine ownership). Rewire readers.
1i. Reconcile horse_parties ↔ horse_relationships per 1c's evidence: migrate to the survivor, re-point every reference including the CLIENT.HORSE_CAPACITY signing resolution, retire the loser. Do not guess; the 1c evidence governs.
1j. Merge staff_profiles (2 rows: the two staff accounts) into profiles (title, pay_type, active). This touches D7's substrate — diff behavior against the 1a trace before and after; identical or roll back.

Exit: all migrations live; every 1e reader rewired (grep proves zero references to old names outside migrations); is_active_member gate proven identical; dual-identity behavior proven identical against the trace; contract engine still renders (do not touch clause content — read-path only); typecheck/lint clean.

## STAGE 2 — Promotion pathway

Objective: one path from person to account, with documents anchored to accounts.

Verify-first: enumerate current account-creation entry points (redeem_invitation, gift redeem, kiosk conversion, self-signup, admin provision) and what each writes today; enumerate the document→contact keying (documents, document_parties, signatures) and confirm no account link exists.

Work:
2a. Build promote_contact_to_account(contact, …) per D5: _ensure_client_account spine → re-anchor the contact's documents/parties/signatures to the account (explicit, queryable linkage; resolve via profiles.contact_id where that avoids column churn, but the linkage must be provable by query) → apply_affiliations → dissolve the faceless contact into the account (no dual-association). Hard guard: refuse to dissolve any identity in D1's protected set (both staff accounts, the company contact, admin@cactai.io) — structurally, not by convention (an explicit denylist checked inside the function).
2b. Route ALL entry points through it. The five-writers problem must not regrow: grep-prove no path creates accounts or writes identity state outside the spine.
2c. New signing by an account holder records the account linkage at signing time.
2d. Backfill: link existing signed docs to accounts where an account exists — EXCLUDING the 6 stranded test-identity docs (D1: they exit with the final purge, untouched).

Exit: the invite → sign → promote → community E2E passes end to end on a disposable test contact you create and clean up (not the owner's test identities): invited person receives account, their signed docs anchor to it, groups derive correctly, community access works, the faceless contact is dissolved. Evidence: the full state trail queried at each step. Dual-identity behavior re-proven against the 1a trace (re-anchoring touches its substrate).

## STAGE 3 — Account surfaces

Objective: the member's account reads the coherent model.

Work:
3a. Documents panel: replace the seed-shaped source with the real signed-documents source (the account-anchored linkage from Stage 2). Documents render as paper per the existing PaperViewer.
3b. My posts manage view: the row exists, the page doesn't — build edit/delete of own posts, distinct from the read-only directory view.
3c. Standalone change-password row (currently a stub inside email-change) and the "switch to Sign in with Google" standalone flow (linkIdentity plumbing exists in the email-change google path — surface it).
3d. Horse-record account visibility: parties on the record drive account visibility and listing rights (owner/lessee/lessor; admins/instructors exempt), reading the Stage-1 survivor table.
3e. Apply D3's wording rule to every surface you touch; report any member-facing "Client" found via the 1d inventory that these surfaces resolve or expose.

Exit: each surface demonstrated against live data (screenshots or rendered-output evidence); email-change live round-trip tested once end to end; typecheck/lint clean.

## STAGE 4 — Ordering

Objective: buying works, tiers are gone from sight.

Work:
4a. Fix the o.tiers dead-tier reference in AttachOfferingPanel (src/pages/app/Admin.tsx:130,155,158) — same fix pattern as ProvisionClientForm.
4b. Gift redemption end to end: backend redemption endpoint + replace the dead "coming soon" button (src/pages/app/Gifts.tsx:97-98). A client can redeem owned value in-app.
4c. Gifts panel backends: resend / reschedule / transfer / claim-link — the UI seams exist ("• WIRE"); build the endpoints and wire them.
4d. Payment-method update endpoint and payment-responsibility transfer endpoint; wire the Account rows.
4e. Strip tier-implying copy per D4 (membership "monthly/annual" language) from member-facing surfaces; billing schedules + PAYG remain the displayed reality.

Exit: a gift purchased, delivered, and redeemed on a disposable test path with the value reflected; payment-method update round-trips; zero references to offering tiers outside retired migrations (grep); typecheck/lint clean.

## STAGE 5 — Fulfillment

Objective: the ledger of promises made and kept, with provable money events.

Work:
5a. The deliverable spine per D6: schema for fulfillment units generated from purchase_items by config_kind (scheduled → session units; recurring → period units; intake/evaluation → milestone units; document_transaction → execution unit; inquire → none). status_events (existing vocab model — extend vocab, don't fork) drives unit state. Booking consumption, lesson_credits, and evaluation delivery connect to units. Design for purchases currently at 0 rows: everything degrades gracefully empty.
5b. Receipt logging + idempotency (api/_lib/receipt.ts:41, api/zelle-reconcile.ts:49): a DB row per send attempt, idempotency key preventing re-send, success/failure logged. A receipt is provable and single.
5c. Wire the dead dunning template (overdue balance) and the dead signup/welcome template (api/_lib/email.ts:227,242) to real triggers off the spine and billing schedules. Decide nothing about cadence yourself — implement the existing 3-day payment-reminder preference as the dunning trigger; welcome fires on account activation.
5d. Log company/ops-inbox mirror copies in document_deliveries like party copies; de-hardcode OPS_INBOX and the fhequestrian.com link (api/calendar-reminders.ts:19, api/request-received.ts:74) to org-level config.
5e. Calendar real sources: payments/billing due from billing schedules (partially wired), plus member-readable expiration/confirmation sources now that the spine exists.
5f. Order documents: replace placeholder legal bodies (src/components/order/OrderDocuments.tsx:6,50) with the real content from the executed template set — sourcing from the contract system's real bodies, not authoring new legal text. If real content doesn't exist for a document type, flag to the owner; do not draft legal prose.
5g. THE PURGE ROUTINE (Phase-5 prerequisite): a function that removes an account and ALL associated content (documents, parties, signatures, posts, purchases, fulfillment units, status events, notifications) cleanly — no orphaned references, no trigger misfires — accepting ONLY identities on an explicit allowlist containing cjzigs@ and charlesjzigmund@. Structurally unable to touch anything else: the allowlist is checked inside the function against the D1 protected set. Do NOT run it against the test identities; build it, prove it on a disposable synthetic account, deliver it.

Exit: a synthetic end-to-end proven with queries at each step — purchase created → units generated → booking consumes a unit → receipt logged once (re-send attempt provably blocked) → status trail complete; dunning and welcome fire in a test harness; purge routine proven on a synthetic account with a zero-orphan query sweep after; typecheck/lint clean.

## After Stage 5

Report completion. The owner runs the acceptance cycle (fresh verification full-pass, then live UAT: purge test identities via 5g, re-invite, transact, validate, final purge). Fixes from that cycle come back to this thread as itemized failures with evidence; treat each as a mini-stage with the same discipline.
