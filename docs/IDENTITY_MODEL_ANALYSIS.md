> ⚠️ **PARTIALLY SUPERSEDED (2026-07-27).** Two corrections:
> 1. The "**KILL** these empty tables" verdicts (`lease_participants`, `horse_parties`,
>    `document_party_archives`, `content_acknowledgments`) were **REVERSED** — each is
>    still code-referenced and is empty only because its flow isn't reachable yet.
>    See `docs/ECOSYSTEM_PLAN.md` §F5. **Do not drop them.**
> 2. Row counts are a 2026-07-26 snapshot. Current live state is in
>    `docs/STATUS_REPORT.md` (e.g. RIDER 9 · HORSE_OWNER 2 after Stage 2).
>
> The two-anchor analysis (contacts vs accounts) and the reasoning remain valid.

# FHE Identity Model — Honest Analysis (facts from the live DB)

You challenged me to justify the table complexity with real facts or make the case
for the leanest honest set. Here it is, grounded in queries against the live
database — not assertions. Where I previously stated things as fact and was wrong
or sloppy, this document supersedes those statements.

## Corrections to what I said earlier (owned)
- I blurred "7 guests" and "9 VISITOR_RELEASE clients" as if one set. They are
  **different counts** (7 GUEST roles; 9 clients with source=VISITOR_RELEASE).
- I said those clients "never bought." True only because **`purchases` has 0 rows
  — nobody has bought anything.** I framed an empty-table fact as a distinguishing
  trait of those 9. Misleading.
- I called `members.tier` "load-bearing." It is **not** — the gate is
  `status='active'`; tier is always `'community'`, display-only. Correct call by you.
- I implied several "both user_id+contact_id" tables were redundant bridges. The
  data says otherwise (below) — only `profiles` truly needs both.

---

## The one structural fact that answers your question

**58 tables reference a person. They key on exactly two anchors:**

| Anchor | Meaning | # tables keyed on it | Population |
|---|---|---|---|
| `contact_id` | the **person record** (may have no login) | **34** | all 16 contacts |
| `user_id` | the **auth account** (can log in) | **20** | only 7 have one |
| both | the bridge / denormalized | **5** | see below |

**`profiles` is the bridge and it is clean:** 1:1, all 7 profiles have a
contact_id, 0 orphans. **9 contacts have no account.**

### Why this is NOT accidental sprawl (the justified core)
The two anchors encode a **real distinction that matches your own radius model**:
- A **contact** with no account (9 of them) can still sign a waiver
  (`signatures.signer_contact_id`), be a document party, own a horse — all
  contact_id-keyed. You cannot notify them (`notifications.user_id`) or let them
  post in community (`group_members.user_id`) because **they have no account.**
- A **client/member** has an account → gets the user_id-keyed tables (feed,
  notifications, RSVPs, member access).

So `contact_id` vs `user_id` = **person-we-hold vs account-that-logs-in** =
**your contact vs client radius, already enforced by which key a table uses.**
Collapsing these into "one users table" would force every no-account
contact (9/16 = 56% of people) to get a fake account, or lose the ability to be a
document party / signer / horse owner. **That is the complexity that is justified.**

---

## Where the complexity is NOT justified (prune these)

Verified against live row counts + intended purpose:

| Table / column | Rows | Verdict | Reason |
|---|---|---|---|
| `contact_roles` (role_type) | 18 | **RESLICE** | overloads 4 concepts: CLIENT (→ already in `clients`), GUEST (→ contact_type), RIDER/HORSE_OWNER (→ the real **group**), PARTICIPANT/GUARDIAN (→ already on `document_parties`). Your original point — correct. |
| `members.tier` | — | **DROP column** | vestigial, always 'community', no gating. Frees "tier" for a real membership product later. |
| `staff_profiles` | 2 | **MERGE → profiles** | a whole table to add title/pay_type to 2 profiles. Fold the columns into `profiles`. |
| `bookings.account_user_id` + `account_contact_id` | 13 rows, **both NULL on all 13** | **DROP columns** | built, never populated — bookings identify the client via `client_id`. Dead columns. |
| `lease_participants` | 0 | **KILL** (verify no code) | empty; lease parties live on `contract_parties`/`document_parties`. |
| `horse_parties` | 0 | **KILL** (verify no code) | empty; superseded by `horse_relationships` (2 rows). Two tables for the same idea — one is dead. |
| `document_party_archives` | 0 | **KILL** (verify no code) | empty. |
| `content_acknowledgments` | 0 | **KILL or keep-if-planned** | empty; confirm it's a planned feature vs abandoned. |
| `category_document_requirements.category` | 21 | **SPLIT** | mixes **groups** (Guest/Rider/Horse owner) with **doc-roles** (Buyer/Lessee/Lessor/Seller). Groups drive onboarding; doc-roles belong to the contract engine. |

**Net prune:** ~4 empty tables killed, `staff_profiles` merged, `contact_roles`
resliced into `groups` + `contact_type`, dead `bookings` columns + `members.tier`
dropped. That's a real, honest reduction — without touching the justified
contact/account split.

---

## The lean target model (the case for the minimal honest set)

**Two identity anchors + purpose tables. Nothing more.**

### Anchor 1 — `contacts` (the person; everyone starts here)
Every human = one contacts row. Enriched over time. Add:
- `contact_type` (single current value, changeable): `WEB_SUBMITTER` · `INQUIRER`
  · `GUEST_VISITOR` · `GUEST_CHECKOUT`. Distinguishes **kinds of non-member**.

### Anchor 2 — `profiles` (the account; only for people who log in)
The bridge (contact_id ↔ user_id), 1:1. **Merge `staff_profiles` in** (title,
pay_type, active). `profiles.role` = **internal role ONLY** (ADMIN/MANAGER/
INSTRUCTOR/TRAINER/ASSISTANT/…). Reserve "role" for staff.

### Promotion markers (thin, existing)
- `clients` = a contact promoted on purchase (contact_id, status, source). Keep.
- `members` = a client active in the community gate (user_id, status). Keep, **drop
  tier**. "Is a member" = has an active row + ≥1 group.

### Affiliation — `groups` (rename of contact_roles, affiliations only)
Stacking community affiliation on a **client**: `RIDER` · `HORSE_OWNER` ·
`PARENT_GUARDIAN`. Add/remove to bump up/down. Drives onboarding docs, nav gating,
community access. **Community access = has ≥1 group** (so a guest-checkout customer
with no group is correctly excluded from posts/messaging).

### Per-thing relationship roles (leave where they are — they are NOT identity)
`document_parties` / `contract_parties` (PARTICIPANT, GUARDIAN, BUYER, SELLER,
LESSEE, LESSOR, SIGNER), `horse_relationships` (OWNER, LESSEE). These describe who
someone is **on one specific document / horse** — correctly scoped to that thing,
not standing identity. Your "Seller who is also a horse-owner, on a contract, and a
client and member" example resolves cleanly: **Seller** = their party_role on that
one contract; **Horse Owner** = a group; **Client/Member** = their ring — three
different tables because they are three different facts, each true independently.

---

## Why NOT one giant table (the honest counter to "just use one")
A single `users` table with a role column cannot express: a person who signs a
waiver but has no login (9 people today); the same person being SELLER on contract
A and BUYER on contract B (party_role is per-document, not per-person); a horse
having an owner + a lessee who are different people with term dates. These are
**many-to-many, per-thing facts** — they require join rows, not columns on one
identity record. The lean model keeps ONE identity per person (contacts, +profile
if they log in) and lets the **per-thing** tables (documents, horses, contracts)
carry the roles that only make sense in that context. That is the minimum.

---

## Open decisions (I will not guess these)
1. `groups` vs `member_groups` vs `client_groups` for the affiliation table name.
2. `contact_type`: single current value (simple) vs history join (accumulates)?
3. The 9 VISITOR_RELEASE clients — the data can't tell me intent. **What actually
   creates a VISITOR_RELEASE client today, and should a pure visitor be a client?**
   (I'll trace `sign_release` to show you what the code does before you decide.)
4. Kill the 4 empty tables? (I'll grep code for each first — empty ≠ safe if code
   references them.)
5. Merge `staff_profiles` into `profiles` now, or leave until it has more rows?
6. Execution: one staged migration set with verify-each-step, given this touches
   Phase 1 gating (kiosk→guest, apply_category_documents, provision spine).
