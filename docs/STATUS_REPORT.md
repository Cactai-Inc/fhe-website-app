# FHE Platform — Status Report

**Date:** 2026-07-27 · **Branch:** `work/category-report` · **Baseline:** `b0476a9`
**Build health:** TypeScript 0 errors · ESLint 0 errors (26 pre-existing warnings)
**Every fact below was verified against the live database and git at time of writing.**

---

## 1. Executive summary

Seven commits landed, all applied to production and verified. The work fell into two
arcs:

1. **Phases 1–4** — a client-lifecycle consolidation: fixing the kiosk/invite gap,
   binding horse-care to a specific horse behind a document gate, building the
   invitation lifecycle + status model, and replacing the offering/catalog sprawl.
2. **Ecosystem Stages 0–2** — the root-cause fix for *why* the invite path kept
   needing patches: a person's category was written by five different functions and
   was divorced from both their signed documents and their account. It is now
   **derived** from signed documents by a single authoritative function.

**Not pushed.** All 8 commits are local to `work/category-report`. The DB changes are
live on prod; the calling code is not on the remote.

---

## 2. Commits (all applied to prod + verified)

| Commit | Title | Substance |
|---|---|---|
| `b0a9ea4` | Phase 1 — fan-out provision foundation | kiosk→Guest default, doc-status "Signed" fix, provision idempotency, **one shared `ProvisionClientForm`** replacing 3 divergent invite UIs |
| `276e319` | Phase 2 — per-horse care gate | `assert_horse_care_eligible` (first care booking generates the 2 releases for *that horse*; subsequent require both EXECUTED), service credits, purchase-grain reconcile, one horse-add path |
| `244ab2d` | Phase 3 — invitation lifecycle, account spine, status model | config-driven expiry, redeemed/redeemed_unsuccessful + reasons, supersede-on-resend, `_ensure_client_account` shared spine, `status_events` + vocab + triggers, purchase↔contract link |
| `b9bad0b` | Phase 4 — offering configuration | SKU mechanics as **data** (`config_kind`/`unit_count`/`weekly_frequency`, 43 SKUs backfilled), **deleted 2 hardcoded shadow catalogs**, fixed the dead `o.tiers` invite bug, acquisition intake, full evaluation-report subsystem |
| `7cd1c7f` | membership → member rename | code identifiers only; gate verified identical; marketing copy untouched |
| `a726e4a` | Ecosystem Stage 0–1 | `derive_affiliations()` (read-only source of truth) + reconciliation proof view + the plan/analysis docs |
| `1c01b32` | Ecosystem Stage 2 | `apply_affiliations()` = **sole** group writer + live triggers + backfill |

### Migrations added (13, all applied to prod)
`20260726000000` phase1 kiosk/doc-status · `000500` suggested-category · `010000` phase2
service-credits/horse-gate · `020000` phase3a invitation-lifecycle · `030000` phase3b
account-spine/contract-link · `040000` phase3c status-model · `050000` phase3d
status-writers · `060000` phase4a offering-config · `070000` phase4b acquisition-intake
· `080000` phase4c evaluation-reports · `091000` membership→member · `100000` stage1
derive-affiliations · `110000` stage2 apply-affiliations

---

## 3. The root-cause fix (the most important work)

### The defect, proven with live data
Categories were written by **five independent functions** (`sign_release`,
`_ensure_client_account`, `admin_create_client`, `default_guest_on_client_role`,
`update_my_onboarding_profile`) with nothing reconciling them — and
`documents`/`signatures`/`document_parties` carry **no account link** (contact_id only).
The result, measured before the fix:

- **Sarah Rosengard** had signed the complete horse-owner document set
  (RELEASE_HORSE_CARE + HORSE_EMERGENCY_VET + participant + policies) and held
  **zero** group roles.
- **Six people** who signed the rider set were tagged **GUEST-only**.
- Account-holders largely had *no* roles while non-account contacts carried them.

**This is why the invite path required continuous patching** — the model underneath
was incoherent, so every fix was a patch on a symptom.

### The fix (live on prod)
- **`derive_affiliations(contact)`** — single source of truth. Rules:
  `RELEASE_PARTICIPANT` ⇒ **RIDER**; `RELEASE_HORSE_CARE` + `HORSE_EMERGENCY_VET`
  **or** horse ownership ⇒ **HORSE_OWNER**; GUARDIAN document party ⇒
  **PARENT_GUARDIAN**.
- **`apply_affiliations(contact)`** — the **only** writer of standing group rows;
  never touches CLIENT/PARTICIPANT/GUARDIAN/GUEST, never touches `members`/`profiles`
  (so the login gate is provably unaffected).
- **Live triggers** on document-execution and horse-ownership keep groups current.
- **Backfill reconciled everyone.**

**Verified result on prod today:** `RIDER 9 · HORSE_OWNER 2 · CLIENT 7 · GUEST 7 ·
PARTICIPANT 3 · GUARDIAN 1`. Sarah now correctly holds RIDER + HORSE_OWNER; the six
mistagged riders are correct.

---

## 4. Live production objects created this session

**Tables:** `members` (renamed from memberships) · `status_events` ·
`status_events_vocab` · `evaluation_reports` · `evaluation_report_shares` ·
`evaluation_report_access`

**Functions (verified live):** `derive_affiliations` · `apply_affiliations` ·
`affiliation_reconciliation` · `_ensure_client_account` · `link_contract_to_purchase`
· `assert_horse_care_eligible` · `log_status_event` · `my_acquisition_intake_state` ·
`deliver_evaluation_report` · `record_invitation_failure` · `supersede_invitations` ·
`invitation_expiry_days`

**Data state:** 95 status events · 43/43 offerings classified by `config_kind` ·
7 members

---

## 5. In flight / not finished

| Item | State | Blocker |
|---|---|---|
| **Ecosystem Stage 3** (re-anchor 6 stranded executed docs) | Analysed, not built | **Owner decision** — the stranded docs sit on your own multi-role test identities (CJ Z across 3 emails) + the company contact. Moving *signed* documents is destructive; needs your canonical-identity call. |
| **Ecosystem Stages 4–6** | Not started | Stage 4 = taxonomy rename (`contact_roles`→`groups`, guest = account-with-no-group, drop `members.tier`, split `category_document_requirements`). Stage 5 = table reconcile. Stage 6 = FE sweep + E2E. Two naming decisions still open. |
| **Business admin suite** | DB migration written, **uncommitted + unapplied** | Deliberately parked: it still contains a **wrong MRR calculation** (lifetime sum mislabelled "monthly", no active-window) and a **misleading member KPI**. Must be fixed before it ships. UI (sales/expense/growth/KPI + PDF/CSV generators) not started. |
| **Lease change request** | Export delivered | **Owner** — awaiting the change list from your authoring thread. Export is at `docs/contract-exports/`. |

### Uncommitted in the working tree (not mine)
10 root-level docs (`README.md`, `PLATFORM_ARCHITECTURE.md`, `SETUP.md`, etc.) appear
moved into `docs/`. This change is **not part of my work** and is left untouched.

---

## 6. Known defects found but not yet fixed

From the two audits run this session (email + UX), verified in code:

**Email (14 emails, one `sendViaProvider` helper — Google Workspace SMTP primary):**
- **Payment receipts have no logging and no idempotency.** A receipt cannot be proven
  sent, and the Zelle path can re-send. *Highest-value gap.*
- **The "6-hour email guard" does not exist** — searched code and all Postgres
  functions. Treat as a regression.
- **Dead templates:** `signup` (welcome) and `dunning` (overdue) are written but never
  called — no welcome email, no payment reminder.
- Hardcoded `hello@fhequestrian.com` in an otherwise multi-tenant layer.
- Company/ops-inbox mirror copies are never logged.

**UX / functionality:**
- **Gift redemption is a dead "coming soon" button** (`Gifts.tsx:97`) — owned value
  the client cannot redeem in-app.
- **Order documents render placeholder legal bodies** (`OrderDocuments.tsx:6,50`) —
  *legal risk before anything is signed against them.*
- **Landing's only CTA goes to `/story`, not the booking funnel** (`Landing.tsx:104`).
- **Dead nav route** `/app/ops/brokerage` (`AppLayout.tsx:133` → undefined route).
- **`o.tiers` bug survives in `AttachOfferingPanel`** (`Admin.tsx:130,155`) — the same
  dead-tier reference fixed in ProvisionClientForm; this panel is still broken.
- Public `Lessons.tsx` has no loading/error state; placeholder hero + "SWAP" media.

**Not started (owner asks):** chat-with-us SMS/WhatsApp deep-link + contact capture ·
full SEO strategy · hero image + page content · payment/Zelle testing (audit-only was
agreed).

---

## 7. Recommended next steps

1. **Fix the business migration** (drop the bogus MRR, correct the member KPI), apply,
   then build the sales/expense/growth/KPI surfaces + PDF/CSV generators. Highest owner
   value, self-contained, reads live data.
2. **Ecosystem Stage 4** — the taxonomy rename, now safe because the mechanism beneath
   it is coherent. Needs two naming calls: affiliation table name (`groups`
   recommended) and the client/customer wording.
3. **Audit-backlog sweep** — receipt logging + idempotency, the two dead email
   templates, gift-redeem, Landing CTA, the `o.tiers` panel bug, dead route. Each is
   small and independently shippable.
4. **Order-document legal text** — flagged as legal risk; should not wait.
5. **Push the branch / open a PR** — 8 commits are local-only while the DB changes are
   already live on prod. That gap is worth closing.

---

## 8. Working-practice note

Several times this session I asserted structural claims that the data then contradicted
(that `members.tier` was load-bearing; that certain double-keyed columns were redundant
when they were merely unused; that three same-name contact records were one duplicated
person; that empty tables were safe to delete when they are still code-referenced).
Each was caught by querying rather than assuming. The operating rule going forward —
and the reason the facts in this report carry row counts and file:line references —
is **verify against the live system first, assert second.**
