# WORK INVENTORY — the single index that did not exist

**Built 2026-08-08 by reconciling every source of recorded work against
`docs/archive/ORCHESTRATOR-HANDOFF.md`.** The handoff's own suggestion S7 says "there is no single
index of workstreams." It was right, and then the handoff itself became a partial index that
omits the two largest documents in the repo.

**This file is that index. Read it before proposing any next task.**

Sources reconciled: `docs/BUILD_TRACKER.md` (129 items, sections A–K) ·
`docs/BACKLOG.md` · `docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md` (A/B/C/D/E) ·
`docs/THREAD_REGISTRY.md` · all 60 `docs/tasks/` files · all 54 `docs/reports/` ·
the insurance document set · the orchestrator's memory notes.

---

# PART 1 — WHAT THE HANDOFF ALREADY CARRIES

Not repeated here. `docs/archive/ORCHESTRATOR-HANDOFF.md` PART 6 correctly covers: the just-shipped
header/nav/contract-reload work, `PARTYJOURNEY`, the undescribed contract issues, narrow page
caps, subheader outlines, the A13 drawer width, the nine specced-and-ready tasks, five owner
decisions, and `test:db`.

**Everything below is missing from it.**

---

# PART 2 — THE TWO DOCUMENTS THE HANDOFF NEVER MENTIONS

## 2.1 `docs/BUILD_TRACKER.md` — the master build map, 129 items

**The handoff does not name this file once.** It is the product build plan and it holds more
unstarted work than everything in the handoff combined. Its own "Working order" section at
the foot is the closest thing this project has to a roadmap.

**NOT STARTED, entire sections:**

| ref | workstream | items |
|---|---|---|
| **C4–C9** | Kiosk self-onboarding pages | `/sign/guest`, `/sign/rider`, `/sign/horse`, `/sign/rider+horse`, the pre-submit screen (welcome copy, eligible services, email + confirm-email, deliverability guidance, vCard button), and reuse of the existing activation email |
| **D1–D4** | Onboarding flow upgrades | orders + their offerings shown in-flow; calendar for bookable purchases; create-an-order from inside the flow; payment in the same modal |
| **E1–E4** | Dual-entry booking | cart line carries a slot; slot HOLD so a time is not sold twice; calendar-first path; catalog-first path |
| **F1, F2, F7, F8, F9** | Lesson card & horse-on-booking | lesson card in the calendar panel; same card on the lessons page; default lesson horse; retroactive attach; barn-supplied horse hidden until the lesson |
| **G1–G3** | Calendar document status | staff sees client doc completeness; client sees their own outstanding docs; 48-hour reminder when docs are incomplete before a booking |
| **J1–J5** | Admin documents library & deals vetting | document library preset views (**research was IN PROGRESS and orchestrator-owned — that ownership transferred to nobody**); `+` as universal quick-create; deal adoption of an existing contract; deal-page post-creation editability; deal-party vs contract-party divergence model |

**PARTIAL / BUILT-but-unfinished:** `D5` (credits granted, not surfaced in-flow) · `E5`,
`E6` (no in-flow path, no booking lines at checkout) · `F4`, `F5`, `F6` (built, `F6` has no
UI at all) · `B1–B3` (lead notifications — **NOT VERIFIED**, and inbound website inquiries
have been silently dropped before).

**The lease go-live blocker is in here and is not in the handoff.** `A2`/`A3`/`A4` are
**BLOCKED**, not pending: a brand-new party cannot complete redemption because
`redeem_contract_invitation` requires a pre-existing `profiles` row and nothing creates one
for a fresh `auth.users` insert. The owner scoped this as a **deal-only party account
provisioning** workstream. It was never specced and it gates the entire party-side half of
lease go-live. **See PART 4.1 — this overlaps `PARTYJOURNEY` and must be reconciled with it
before either runs.**

**Also here and nowhere else:** "**Service Definition documents** — the replacement concept —
are a SEPARATE upcoming build. `SVCPURGE` only removed; it did not build a replacement." Six
service contract templates were retired and nothing took their place.

## 2.2 `docs/BACKLOG.md` — owner-decision stops and zero-live-behaviour work

**Also never named in the handoff.** The handoff carries exactly one of its items (`test:db`).

**Owner-decision stops — these are blocked on him, and the handoff's "Decisions the owner
owes" list does not include any of them:**

- **Charles Zigmund duplicate contact pair.** `07ab7dbf-…` (no email) and `d268330c-…`
  (`cjzigs@icloud.com`) are the same person. Deliberately unmerged — `d268330c` is the live
  lessor on real lease drafts. **Owner picks the merge direction.** Standing note: contact
  sprawl is unresolved; do not merge contacts without asking.
- **Placeholder media and copy** — hero (`Landing.tsx`), Story "SWAP" bands, offering-card
  `CoverPlaceholder`, `Faq.tsx`, hero/page content refresh, **the real street address**
  (`src/lib/seo.ts:18` TODO), and whether `Contact.tsx`'s `noindex` is intentional.
- **Purchase/sale contract template** — blocked on the owner's reference document.
- **SEO keyword and content strategy** — the technical work is implementable; the strategy is not.
- **Payment / Zelle receipt-validation live testing** — needs real credentials only he can use.
- **Fulfillment-spine live proof** — `purchases` has ~1 row; first real purchase is the first
  real exercise. Cannot be manufactured honestly.
- **Email-change round-trip** — requires clicking links from the real inboxes.

**Zero-live-behaviour work:**

- **Business admin suite** — sales tracker, expense tracker, growth tracker, KPI dashboard,
  PDF report, CSV export. Its migration `20260726090000_biz_expenses_and_financials.sql` is
  **deliberately unapplied** and stays that way until the suite ships. Its two blocking
  defects are already fixed in-file.
- **Brokerage staff hub** — `mod.brokerage`'s page does not exist; the dead nav entry was
  removed 2026-08-02. Build the hub, then restore the nav item.
- **Feature work, unchanged scope:** linked-account schedule sharing · calendar day/list view
  modes · stable item form fields · mobile device pass · chat-with-us deep-link · membership
  tiers (deferred by owner ruling D4, `tier` stays reserved).
- **DB test-suite remediation** — the handoff has this.

**Standing fact the handoff omits, and it is a real risk:** **migrations are not
rebuild-safe.** Many rewrite live function bodies via `pg_get_functiondef` + string-replace,
which no-ops on a fresh database. There is no `supabase_migrations.schema_migrations` table —
the journal is hand-maintained and applied via `psql`. **A production rebuild has no
strategy.** The test harness sidesteps this with a schema snapshot; production could not.

---

# PART 3 — DEFECT AND VERIFICATION DEBT

## 3.1 The `averify2` defect queue — three items never re-homed

Surfaced 2026-08-06. Items 1 and 2 were addressed (`PARTYRLS`, and item 2 is the deal-only
provisioning workstream in 2.1). **These three landed in no document the owner reads:**

- **Document-card status stamp trail + Complete badge.** Spec exists in the `averify2` report
  under "stamp trail". Needs a `my_resends` column added to `my_documents()`. **This overlaps
  the STATUS-LOG model the owner specced for account / documents / orders / offerings** — the
  two should be designed together, not separately.
- **Cold / direct navigation to `/app/…` fails in the owner's Chrome.** Unconfirmed, needs a
  live devtools repro. **This is an owner-blocking bug of unknown size and it has been open
  since 2026-08-06 with nobody assigned.**
- **Staff `DocumentQueueTable`** shows a raw contract-id column; should show parties.

## 3.2 Reports the owner has never read — one of them is a live-document problem

The handoff does not carry this list. `THREAD_REGISTRY.md` does.

| report | why it matters |
|---|---|
| **`TASK-LEASEMAP-REPORT.md`** | 5 findings; **2 of them mean live lease documents print contradictory risk terms.** By the handoff's own priority rule this is category 2 — "production is exposed or wrong" — and it outranks every UI task currently queued. |
| **`TASK-ACCTEVAL-REPORT.md`** | 932 lines, the full account-system audit. Never read. |
| `TIPTAP`, `BP410`, `PLUSPASS`, `SECFIX` | merged, reports unread |

## 3.3 Browser-verification debt — far larger than the handoff admits

The handoff says "nothing shipped in the last two days has been verified in a browser by
anyone but the owner." **The true figure is roughly twenty named tracker items over two
weeks**, all marked *code-complete, browser pending*:

`A11` `A12` `A13` `A20` `A21` · `F3` · `I1` `I1B` `I2` `I3` `I4` `I5` `I6` `I7` `I8` `I9`
`I10` `I11` · `K1` `K2` `K3` `K4`

Several were verified server-side via rolled-back `psql` sessions, which proves the RPC and
proves nothing about the render. **This is a single cheap task — one browser pass against a
checklist — and it would close more open items than any build task on the list.**

---

# PART 4 — SPECCED WORK LIVING ONLY IN MEMORY OR SIDE DOCUMENTS

## 4.1 Specs that exist as owner rulings and nowhere in `docs/tasks/`

These were captured in the orchestrator's session memory across July and August. **A new
orchestrator has no access to them.** Each is an owner ruling, not a proposal.

- **Onboarding token map** — the onboarding form must collect **only** body-verified document
  tokens. An exact CLIENT / PARTICIPANT / HORSE field map exists; stale riding-background
  fields are to be dropped; completion email carries per-document PDFs.
- **Invite + status spec** — kiosk → Guest; convert-to-client; horse-intake gating
  (horse-care purchase → stable-horse link + first-purchase document gate); the invite-page
  final spec; invitation lifecycle (fixed DB expiry, resend vs regenerate,
  redeemed-unsuccessful notifications); and the **STATUS-LOG model** for account, documents,
  orders and offerings.
- **Fan-out / account-creation architecture** — capture-contact vs upgrade-to-account; ONE
  shared provision component that four invite UIs converge on; **all** account creation
  through one spine (folding in gift and contract-counterparty); purchase unification
  (`buyer_contact_id` always); purchase ↔ contract link, manual and traceable; horse link
  grain = booking OR contract-document depending on service shape.
- **Deal record design** — **AWAITING THE OWNER'S SPEC, do not build.** One dataset, three
  projections (deal record / bill of sale / sale contract); a deal intake page modelled on
  the horse intake page; the header `+` becomes a universal create menu (deal, order,
  contact, eventually campaign). The owner said explicitly: "Don't build anything yet. Let me
  spec first."
- **Identity taxonomy, authoritative** — lead (self-created) → account → contact;
  **client** = services, **customer** = goods, **visitor** = guest. This supersedes the older
  "contacts are faceless external parties" framing that some task docs still carry.
- **Phase-4 follow-ups**, never scheduled: recurring auto-repurchase monthly job; report
  authoring rich-text; `purchase_items.config` surfaced on the order-detail UI.

## 4.2 The leather / glass header track — "version B", paused, not cancelled

The handoff states the header is settled. **It is settled as version A only.** Version B was
an active A/B the owner paused on 2026-08-06 with the word "circle back", and the decisions
inside it are already made:

- **Material locked** — the whole hide via `background-size: cover` (option G). Production
  assets are already cut: `leather-band-2400.jpg` and `leather-band-1600.jpg`.
- **Stamping locked** — variant 5, "emboss · raised face", with the exact CSS recorded. Raised
  beat debossed on leather and on cardstock both times.
- **Still to build:** full header composition in the raised treatment; the green-glass tab
  behind the header that pulls a full-screen glass menu down; over-centre bistable motion;
  real content scrolling visibly beneath the glass. Mobile: the glass tab replaces the drawer
  and the avatar menu. Also wanted: a leather login screen where typed characters stamp into
  the hide.

**Do not let a new orchestrator treat the header as closed.** The shelved cardstock header is
preserved at `docs/reference/shelved-cardstock-header/`; the leather work is not in the repo
at all beyond this note.

## 4.3 The insurance workstream — four documents, no index entry

`INSURANCE_BUILD_PLAN.md` · `INSURANCE_CONTROL_SET.md` · `INSURANCE_QUESTIONS_FOR_COUNSEL.md`
· `insurance-resolution-spec.md` · `docs/reference/insurance-decision-map/`

The handoff mentions only "the `LEASEGATE` insurance model's remaining questions." The
control-set spec is done (6 blocks, 4-type matrix). **`INSURANCE_QUESTIONS_FOR_COUNSEL.md` is
addressed to a lawyer and nobody has been asked to send it.**

Standing fact worth carrying: **California has no equine liability act.** §3333.7 is a
motor-vehicle statute. Any clause drafted on the assumption of an equine act is wrong.

## 4.4 The facility-term sweep is bigger than `FACILITYTERM`

`FACILITYTERM` covers the tenant choosing their word. Separately: **FHE is a stable at a
ranch, not a barn**, and there are **160 "barn" mentions across 45 files** requiring a judged
sweep — not a find-replace. The handoff lists `FACILITYTERM` and omits the sweep.

## 4.5 `MOBILEPASS` is missing from the handoff's ready list

`THREAD_REGISTRY.md` lists it as specced, not run, and **it owns `AppLayout.tsx`** — which
makes it a file-ownership conflict with any nav work. The handoff's "specced, ready to run"
paragraph omits it entirely.

---

# PART 5 — CORRECTIONS TO THE HANDOFF AS WRITTEN

Apply these; do not merely note them.

1. **`NOGUARD1` is listed as ready to run. It has run.** Report merged at `9679006`; the
   orchestrator's audit is at `docs/reports/TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md`. **`NOGUARD2`
   is now unblocked and carries a verified target list.** It is the highest-ranked security
   item open.
2. **`void_signatures_on_edit` belongs in "Known and unfixed."** An unauthenticated caller
   can void every signature on any document by id. The handoff's existing entry — "three gift
   functions still have guards that do not fire" — understates the surface by two orders of
   magnitude: 76 unguarded functions, 38 of which write.
3. **The handoff has no A-series index.** It refers to "A5/A6" and "A13" without saying that
   the list lives in `docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md`. A new orchestrator
   reading only the handoff cannot resolve those references.
4. **"Nothing shipped in the last two days has been verified in a browser"** → two weeks, and
   about twenty named items. See 3.3.

---

# PART 6 — WHAT I WOULD RUN NEXT, AND WHY

The handoff's own priority order, applied to the full inventory rather than the partial list:

| rank | rule | item |
|---|---|---|
| 1 | production is exposed | **`NOGUARD2`** — signatures on legal instruments can be voided anonymously |
| 1= | production is exposed | **`SENDGUARD`** (added 2026-08-09) — three signing-invite paths have no already-signed guard, and `generate_my_onboarding_documents` deletes and recreates the pending draft on every page visit, so an emailed link points at a deleted row after one reload. Same write class as `NOGUARD2`; run them adjacent |
| 2 | production is wrong | **Read `LEASEMAP`** — two findings mean live leases print contradictory risk terms. Costs one reading session, not a thread |
| 3 | a person is blocked | **Deal-only party provisioning** — a brand-new party still cannot redeem a contract invitation. Blocks `A2`/`A3`/`A4`, and overlaps `PARTYJOURNEY`; reconcile the two before specing either |
| 4 | the owner is blocked | **Cold-navigation failure** in his Chrome — open since 2026-08-06, unassigned, size unknown |
| 5 | cheap, closes many | **One browser verification pass** over the ~20 code-complete items |

Everything currently in the handoff's "specced, ready to run" paragraph sits below all five.

---

## AWAITING DETAIL FROM THE OWNER

- **`TASK-BOOKFLOW`** — booking, calendar and order-view errors found 2026-08-10 walking the
  real new-client invite and onboarding flow with Claire as **both horse owner and rider**.
  Surfaces named: the calendar, booking of things already purchased, the order view, what admin
  sees when a client picks slots, and what the client sees. **A launch blocker in his words —
  "before i can turn this over to clients to use."** Placeholder at
  `docs/tasks/TASK-BOOKFLOW-PENDING-owner-walkthrough.md`.

## How to keep this file true

Any new request goes **here** as well as into its task doc. The failure this file exists to
fix is not that work went unrecorded — almost all of it was recorded — but that it was
recorded in six places with no index, and the owner was told a workstream did not exist when
it did. **If it is not in this file, assume the owner cannot see it.**
