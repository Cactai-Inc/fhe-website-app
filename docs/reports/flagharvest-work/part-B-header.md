# Unviewed inventory — batches 5–8

> *"An artifact the owner has never seen is not dead code — it is unreviewed inventory."*

This file shows you **45 artifacts you have never looked at**, so you can judge each one for
yourself. **Nothing here is recommended for deletion. No code was changed.** Every block pastes
the real content — the actual clause text, the actual email wording, the actual SQL, the actual
page copy — rather than describing it.

**Source:** `master-inventory.txt` entries `[INV batch5.md#77]` through `[INV batch8.md#130]` —
54 raw entries, deduped to 45 artifacts. Nine entries were repeat sightings of the same template
or page reported by different tasks (HORSE_LEASE_STANDARD alone was reported four times;
ContactsPage and `/app/ops` three and two times respectively).

**Verified against:** working tree at `86283dc`, and the live production database (`SELECT`-only)
as of 2026-08-13.

---

## Read this first — seventeen of these entries were wrong or have gone stale

These entries were written days or weeks ago and parallel threads have moved underneath them.
Every block below re-verifies its claim against current code and current prod, and says so when
the claim no longer holds.

### The one that matters most

**The eleven "dark by design" module pages are not dark.** TASK-ADMINSWEEP reported
boarding (×4), barn-ops (×4) and employees (×3) as unreachable because their modules were off.
All three modules flipped `enabled=t` on 2026-08-12, `org_page_visibility` has zero rows, and the
nav rows pass the filter at `AppLayout.tsx:659-662`. **3,373 lines of fully-built boarding,
barn-ops and employees software — including an append-only consumption ledger and a billing
resolver — is live and navigable in your app today.** You may never have clicked it. Per-page
copy and line counts are in that block.

### The rest, in one table

| # | The report said | What is actually true now |
|---|---|---|
| 1 | `ensure_gift_buyer_account` is dead code, zero callers | **Wrong — it is live.** `create_gift` calls it; GIFTCREDITS revived the call site on 08-11, after the report. The original three-way check missed it because plpgsql calls leave no `pg_depend` row. |
| 2 | `service_credits` has 0 rows | **Stale — 3 rows**, all created 2026-08-10, two already decremented. Live data, not an empty shell. |
| 3 | `caller_is_document_party` isn't wired into `documents_select` / `my_documents()` | **Gap is closed.** DOCVIS landed after the report; it is OR'd into both. |
| 4 | `void_signatures_on_edit` is dead but anon-executable | **The function is gone**, dropped by a NOGUARD2 migration. Source recovered here from the schema fixture so you can still see what it did. |
| 5 | Six anon-callable mutators (`apply_field_formats`, `seed_cascade_fields`, `affiliation_reconciliation`, …) | "No callers" holds; **"anon-callable" is stale** — all revoked to `{postgres,service_role}`. |
| 6 | MINOR_RIDER is a "body-less" template | **Wrong — a complete 5,481-character agreement**, pasted in full. (HORSE_REPRESENTATION, named in the same breath, genuinely is empty.) |
| 7 | FACILITY_LICENSE / INDEPENDENT_CONTRACTOR are active with empty bodies, so a user could reach an empty contract | **The alarm is wrong.** Both bodies are SQL `NULL`, and `generate_document` raises `template X has no body loaded` before rendering anything. They are unreachable stubs, not a live hazard. |
| 8 | Four lease documents sit on HORSE_LEASE_V2; STANDARD has 144 clauses / 117 fields | **Six** documents, and **163 clauses / 114 fields**. Byte-identity of the four forks is now *proven* in SQL rather than asserted. |
| 9 | There is no shared `PageHeader` component anywhere | **One exists** and has for days. The surviving finding is adoption: 10 of 113 pages use it; 94 files still hand-roll an `<h1>` across 20 class variants. |
| 10 | No `/app/stable` route exists | **It shipped.** Route registered, in the nav, reachable. |
| 11 | ContactsPage redirects to `/app/admin`, nav item hidden | Retirement intact, but the **redirect target moved** to `/app/records/clients`, and it is **clickable again** from the admin Review nav. |
| 12 | `/app/ops` (OpsHome/OpsDashboard/InstructorHome) is unreachable, trainers have no home | **Stale — reachable.** `reviewSection.ts:356-361` gives it and the InstructorHome preview real admin nav rows. |
| 13 | `/app/ops/horses` has zero references outside its route | **Stale** — now carries the Review nav row "Horses B · 07-01 original". |
| 14 | CJ's contract-invite link landed on an unwired page | **Not supported.** The whole chain verified end to end (`api/contract-invite.ts:116` → `/activate?token=…&kind=contract` → `Register.tsx` → `redeem_contract_invitation` → `/app/contracts/:id`), and CJ's invitation row reads `redeemed`. The only real defect is copy: the valid-token screen still says "Sign in to activate your account" with no mention of a contract. Live-browser confirmation remains **UNRESOLVED**. |
| 15 | IntakePage's nav entry was removed (`cefaad7`); route still reachable from dashboard links | Commit verified, but a **second** retirement (LEADCLEAN, `INTAKE_PAGE_RETIRED=true`) closed the route. The dashboard links now expand in place; zero links reach it. |
| 16 | Community → Resources lists content_resources but exposes no download control | Zero callers confirmed, and the root cause is upstream (`fromResource` discards `storage_path`/`file_id`). But **`content_resources` has 0 rows** — a latent gap, not stranded published guides. |
| 17 | The FHE company contact fails `admin_client_accounts()` arm 3's type check | True, but there are **two independent blockers**: `PartyCell` branches on `is_company` and never emits a link at all, so the arm-3 check is never even reached. |

### Four things nobody was looking for

- **`affiliation_reconciliation()` is not a dead dump — it is reporting a live defect.** Running
  it shows Mary Richardson (CON-000052) derives `{HORSE_OWNER, RIDER}` but has `{}` stored
  groups, which gates her nav and her onboarding documents. It also surfaces a deleted contact
  still carrying RIDER, and two duplicate-contact pairs.
- **`start_bill_of_sale_standalone` is the cash-sale path.** It creates its own contract and sets
  `TXN.BOS_HAS_SALE_AGREEMENT='NO'` — a real business case ("sold, no written agreement") with no
  way to reach it from the UI.
- **The deleted RIDER_LESSON_JUMPER template is the outlier of the six.** It was a full signed
  liability addendum; its live successor drops roughly **3,200 characters of jumping-specific
  risk, assumption-of-risk and indemnification language**. All six deleted files are pasted here
  complete (16,814 chars total) so you can decide whether that loss was intended.
- **HORSE_LEASE's stored body carries 6 triple-encoded mojibake em-dashes** (a healthy template
  has zero) — a latent encoding defect in the 18,253-character historical reference.

---

