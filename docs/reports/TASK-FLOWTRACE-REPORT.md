# TASK-FLOWTRACE REPORT — the flow from invitation to fulfilment, traced

**This task fixed nothing.** `git diff` shows this file only. Every mechanism below was traced on
current `main` (`c6b51b6`) and verified against production; every mutation experiment ran inside
`BEGIN; … ROLLBACK;`. No email was sent, nothing was signed, Kit Garcin and Kylie Pinion were not
touched. No browser session exists: **every claim about what a screen renders is read from source
and is NOT VERIFIED in a browser.** `test:db` was not cited for anything.

Method note on production reads: a direct psql connection has NULL auth, so org-scoped RPCs
returning zero rows proves nothing by itself. Where an RPC's behavior mattered, the trace either
impersonated the test identity inside a rolled-back transaction or read the function body with
`pg_get_functiondef` and queried the tables directly.

---

# 0 · THE RUN ITSELF — one date correction that reframes everything

**The owner's run happened 2026-08-10, not 2026-08-12.** This is not inferred: migration
`20260810T1730_inviteflow_category_is_evidence.sql:17` names the test identity explicitly, and
production holds zero invitations dated 08-12.

| | |
|---|---|
| Contact | Claire Bourdon — `CON-000255`, claire.bourdon21@gmail.com |
| Client | `CLI-000125` |
| Invitation | redeemed, categories `{HORSE_OWNER, RIDER}` |
| Purchase | **PUR-000059**, $1,000.00, **still `awaiting_payment` / unpaid** |
| Horse | `HOR-000085` "TIZ love" |

The purchase holds **five** items, not three — Single Lesson $150, Single Class $90, Training 1×
Weekly $360, Exercise 1× Weekly $200, Full Body Clip $200 — summing exactly to $1,000 across his
three service categories. Timeline (UTC, 08-10): provision 15:49 → activate+redeem 15:56 → 6 docs
generated 15:58 → horse 16:41 → docs regenerated 16:42 → all 6 signed by 16:43 → **two bookings
16:45:29 and 16:45:58**.

**Consequence: his run predates the BOOKWRITE merge (2026-08-12 11:00 PT) by ~44 hours.** Which of
his observations that fix actually cures is answered per-item below — the short version is:
fewer than it appears, because BOOKWRITE repaired a function the calendar path doesn't use for
credit choice.

One prior-leg bug is already dead: at his activation, invitation category rows were deleted,
leaving him category-less until the horse/participant-release step re-derived them. That was fixed
**45 minutes after his session ended** (`20260810T1730_inviteflow_category_is_evidence`) and will
not recur.

---

# 1 · PROVISIONING

The spine is sound; three findings ride along.

**Two entry points, not three.** `provision_client_invitation` is called from exactly two places:
`api/admin-send-invitation.ts:224` (admin) and `api/sign-start.ts:92` (kiosk funnel — see §12).
The third entry point named in older docs was dropped in `20260725003000`. Nothing in `src/` calls
it directly. Prod's function body matches the repo's newest migration layer; the `docs/proposed/`
variant is not applied.

One call writes, in order: contacts → clients → contact_required_documents → duplicate-basket
guard → purchases + purchase_items + **lesson_credits** → invitations → supersession →
`apply_affiliations`. Purchases are attached via a category-filtered checkbox multi-select in
`ProvisionClientForm.tsx:289-336`.

**F1 — The on-screen total is display-only and never reconciled.** The $1,000 the owner saw at
provisioning is a client-side `useMemo` (`ProvisionClientForm.tsx:159-164`); only the offering ids
cross the wire and Postgres re-sums from `offerings.price_amount`. Correct trust boundary — but if
catalog prices drift from the form, admin sees one number and the DB books another, silently.
*Category WIRING · cost: one component (display the server's echo).*

**F2 — A hair clipping bought a lesson punch-card credit.** `_provision_purchase_for_offerings`
mints a `lesson_credits` row for any `price_unit='session'` offering with **no segment check** —
Claire's Full Body Clip produced a bookable lesson credit. Still in current code. *Category WRONG
BY DESIGN (in the mint logic) · cost: one migration. Subsumed by F8 if the ledger is unified.*

**F3 — Credits are granted at provisioning, unpaid.** Claire has never paid; her credits existed
immediately and she booked with them. Note this **contradicts the screen copy** that says booking
waits on payment (§5) — the system is *more* aligned with the owner's bookings-first model than
its own copy claims. *Not a defect against the owner's requirement; recorded because the copy
says otherwise.*

# 2 · CLAIM → LOGIN → DOCUMENTS → HORSE — noted, not investigated (owner's deferral)

Path: `/activate?token` (password only) → server-side user creation → sign-in →
`redeem_invitation` → `/app/onboarding` (5-step wizard) → `/app/documents` (`record_signature`) →
`/app/horse-intake` (`create_horse_record` → `ensure_horse_documents`). Signing path traced only;
nothing signed. Noted in passing, one line each, all NOT VERIFIED renders:

- Onboarding's docstring says "three steps" over a five-step model.
- The wizard's Payment step sits after signing, while its copy elsewhere implies the client
  already paid offline.
- Redeem logic is duplicated verbatim across two pages.
- ~6 stale/retired route comments in `App.tsx`.
- Since his run, DOCPACKET collapsed the six onboarding docs into one packet row — the Documents
  screen he used no longer looks the way he saw it.

---

# 3 · "The order sort of shows up" — item 1

| | |
|---|---|
| What he saw | *the order "sort of shows up"* |
| What happens | The data is complete and readable — impersonating Claire, `listMyOrders()` and `getOrder()` return everything. But the orders list card (`OrdersContent.tsx:48-65`) renders only date / status / total: **no item labels, and `PUR-000059` is never shown anywhere in the client UI**. `OrderDetail` (`src/pages/OrderDetail.tsx`) does show all five items correctly. |
| Why | The list card was never given the fields; the display code was never surfaced. |
| Still true? | **Yes** — main and prod. |
| Category · cost | **MISSING · one component** (labels + display code on the card). |

# 4 · One item, whole total — item 2

| | |
|---|---|
| What he saw | *"the order looked like i bought a $1000 riding lesson"* — three items listed as one, full total shown |
| What happens | Not a render bug — **the API returns exactly that.** Prod's `my_onboarding_state()` builds the payment step's order as `'tier_label', (SELECT pi.label FROM purchase_items … ORDER BY pi.created_at DESC LIMIT 1), 'amount', pu.amount` — one label, whole total, **verified in the live function body and reproduced as Claire: `{"tier_label": "Single Class", "amount": 1000.00}`**. All five items share one `created_at`, so which label wins is non-deterministic. The whole `OnboardingPurchase` contract is single-SKU (`lessons_included`/`cadence` hardcoded NULL); `PurchaseCard` (`Onboarding.tsx:109`) faithfully renders the lie it is handed. |
| Why | The onboarding payment surface was designed when an order was one SKU and was never widened for baskets. Two surfaces, two truths: `OrderDetail` shows five items; the screen that asks for money shows one. |
| Still true? | **Yes** — `LIMIT 1` verified in prod during this trace; last edit to that code 2026-08-07, before his run. |
| Category · cost | **WRONG BY DESIGN** (single-SKU contract, not a typo) · **one RPC + one component** — widen `my_onboarding_state` to return the item array and teach `PurchaseCard` to list it. No schema change; the data already exists. |

# 5 · The memo says "later" on the screen requesting payment — item 3, the sharpest failure

| | |
|---|---|
| What he saw | memo *"will be generated later"* — on the payment screen |
| What happens | The generator (`finalize_purchase_payment`) exists and works — **it is unreachable, twice over.** Lock 1, UI: provisioned orders start at `status='awaiting_payment'`, which makes the payment screen render its Zelle-instructions branch on first load — and the **"Pay with Zelle" button, the only caller of the RPC, lives in the other branch.** The screen tells you the memo will be assigned "when you continue," having removed the control you would continue with. Lock 2, server: even if called, the RPC matches on `buyer_user_id = auth.uid()` — a column `_provision_purchase_for_offerings` **never writes** (it writes `buyer_contact_id`). Proven as Claire in a rolled-back transaction: 0 rows matched, RPC raises `purchase not found`. RLS accepts her via contact; the RPC does not. **A provisioned buyer can see the order and can never pay it.** |
| Why | Two path-dependent halves built against different lifecycles: the UI assumed self-serve orders (start unpaid, click pay); provisioning creates orders already in the post-click state with a different buyer key. |
| Downstream | This is why Zelle matching can never work today: `api-payments.ts` matches inbound payments on `unique_amount`, then `payment_reference` — **both NULL for 100% of purchases ever created** (there are only 2). Every provisioned order is unmatchable by construction. |
| Still true? | **Yes** — main and prod. Neither prod purchase has ever had a memo. |
| Category · cost | **WIRING · one component + one migration** (show the button / call the generator at provisioning; key the RPC on `buyer_contact_id`). **A copy fix alone fixes nothing** — the memo would still never generate. |

# 6 · "Booking after payment is confirmed" — item 4 — and THE INVERSION — where it lives

**The inversion is COPY. Nothing structural enforces payment-before-booking.** This is the single
most consequential answer in the report, because it sets the repair cost of the owner's core
requirement near zero on the enforcement side:

- The claim appears in exactly **two strings**: `OrderDetail.tsx:101` ("After payment is
  confirmed, you'll pick your time on the Calendar") and `Onboarding.tsx:1114` ("Complete payment
  to confirm your booking"). Both re-verified on `c6b51b6` during this trace.
- **No booking writer checks payment.** All 12 DB functions mentioning `payment_status` were
  enumerated; none writes bookings. `request_open_time` is ungated. `book_open_slot` gates on
  *credits* — which provisioning grants before payment (§1-F3). Claire, unpaid, booked twice.
- The DB already models the owner's requirement: `confirm_booking_for_purchase` exists to confirm
  *already-made* bookings when payment lands — **book first, confirm on payment is the shape the
  schema assumes.** Onboarding even ships an "I'll pay later — finish" bypass.
- What's actually missing is the other half of his sentence: *"have them select the bookings"* —
  the onboarding wizard (`details → horse → sign → payment → done`) has **no booking step at
  all.** The flow isn't reversed so much as the booking step is absent, and the copy papers over
  the hole by pointing at "after payment."

| | |
|---|---|
| Category · cost | Copy lie: **COPY · two strings.** Booking step in the flow: **MISSING · a redesign of the wizard sequence** — but with no structural gate to dismantle, it is an additive redesign, the cheapest kind. |

# 7 · The calendar is never surfaced — item 5

| | |
|---|---|
| What he saw | the calendar never appeared for requesting bookings |
| What happens | `/app/calendar` exists, is ungated in nav, and `OrderDetail` links to it twice — but the inline link sits *inside* the "wait for payment" sentence, and the prominent "Schedule on the Calendar" button renders only at `status==='paid'` — a status no provisioned order can reach (§5). `OrderPayment.tsx` and the wizard's payment step have no calendar link at all. (NOT VERIFIED renders; code-read.) |
| Why | Every path to the calendar routes through copy or gates premised on the payment-first story. |
| Still true? | **Yes.** |
| Category · cost | **WIRING · one component** for the links; the real cure is the §6 booking step. |

---

# 8 · Credits — items 6 and 12, and the finding under both

**F8 — There are two credit ledgers, and they disagree about everything.**
`fulfillment_units` is the obligations spine a purchase mints (trigger
`purchase_items_generate_units`, count = `offerings.unit_count × quantity` — **correct**, verified
against prod data). `lesson_credits` is what the member sees and the calendar spends — minted
inline by `_provision_purchase_for_offerings` with count = **a regex on the offering's display
name** (`'(\d+)-Lesson'`), else 1 if `price_unit='session'`, **else nothing**. `offerings.unit_count`
is never read. Proven in prod inside BEGIN/ROLLBACK with real offerings:

| offering | units minted | credits granted |
|---|---|---|
| 8-Lesson Punch Card | 8 | 8 *(coincidence — the name contains "8-Lesson")* |
| 4-Class Pack $320 | 4 | **0** |
| Exercise 1× Weekly $200/mo | 1 | **0** |
| Single Lesson / Full Body Clip | 1 | 1 |

**Item 12 (wrong counts) — CONFIRMED, mechanism above.** And worse than he saw: since
`book_open_slot` is credit-gated, a 4-Class Pack buyer — and every buyer of all 12 recurring
monthly SKUs, up to $880/mo — gets **zero** bookable credits and hits `NO_CREDITS` on everything
they paid for. Claire's two monthly items — **$560 of her $1,000 — minted nothing bookable.**

A regression is buried here: `20260726010000` had already widened this logic and tagged credits
with `offering_id`; `20260802020000_u3_payment_notifications.sql:146` re-declared the function and
**silently reverted both**. Second known instance in this codebase of a later migration undoing an
earlier fix.

| | |
|---|---|
| Category · cost | **WRONG BY DESIGN · one migration** to mint from `unit_count × quantity` — or, properly, retire the double ledger and point the calendar at `fulfillment_units`, which is **a schema-level redesign** and subsumes F2. |

**Item 6 ("credits shown accurately") — accidentally true, not actually true.**
`MyLessonsContent.tsx` ← `myLessonsOverview()` (`api-member.ts:51`) reads `lesson_credits`
directly with RLS as the only fence — faithful to the table, which is why what he saw was right.
But it faithfully renders an incomplete ledger: 3 correct rows while $560 of his order produced no
row at all. The one thing that worked, worked by having no logic to get wrong.

# 9 · Booking subject and kind — items 7 and 8

**Item 7 — the subject is chosen by purchase date because nothing else exists to choose by.**
There is **no subject picker anywhere** in the client calendar (`CalendarPage.tsx`): the booking
panel offers a *horse* select and time fields only. `requestOpenTime` even accepts an
`offeringId` — the call site (`CalendarPage.tsx:720`) never passes it. So `book_open_slot` infers:
its credit sort is `ORDER BY (offering_id = v_offering) DESC NULLS LAST, purchased_at, created_at`
— and since all 278 published open slots are generic (`v_offering IS NULL`), the first key is NULL
for every row and the sort collapses to **`purchased_at`, oldest first** (function body re-read in
prod during this trace). The booking then inherits its `offering_id`/`purchase_id` from whichever
credit won. His three credits had NULL `offering_id` and byte-identical `purchased_at` — a
three-way tie, i.e. arbitrary. Exactly "chronological order of the order summary."

**BOOKWRITE does not fix this.** It repaired `consume_unit_for_booking` (the units ledger) —
`book_open_slot`'s credit choice, the one the calendar actually uses, is untouched. And on the
units side, all five of PUR-000059's units share `seq=1`, so the fix's `u.seq` tiebreak is a
five-way tie: **non-deterministic, not merely chronological.**

| Category · cost | **WRONG BY DESIGN (no intent is ever captured) · one component + pass-through** — a subject picker on the booking panel feeding the parameter that already exists. |

**Item 8 — everything is a lesson, four stacked causes.** `_publish_open_slots_for_org` inserts
literal `'lesson'` with no `offering_id`; `book_open_slot` and `request_open_time` both
`coalesce(…, 'lesson')`; and the `bookings_kind_check` constraint allows only 4 kinds, so horse
exercise and hair clipping would **both** collapse to `care` even when classified. Prod:
**319 of 319 bookings ever are `lesson` or `block`** — zero `care`, zero anything else.

| Category · cost | **WRONG BY DESIGN · one migration + the §7 picker** (derive kind from the chosen offering; widen or re-map the check). |

# 10 · Booking state and the company side — items 10 and 11

**Item 10 — BOOKED, never REQUESTED.** The pending states exist — the column even defaults to
`pending_slot` — but `book_open_slot` writes `status='scheduled'` literally (verified in the prod
function body). And display makes it unfixable-by-accident: `booking_status_code` **collapses
`pending` / `pending_slot` / `pending_payment` all into `'scheduled'`**, so even a correctly
pending booking would be stamped and evented as scheduled. Production has never held a pending
booking.

| Category · cost | **WRONG BY DESIGN · one migration** (write `pending`, stop collapsing) — cheap only if item 11 exists to receive it. |

**Item 11 — there is no company-side review queue. MISSING, plainly.** The whole apparatus is one
Confirm button (`CalendarItemPanel.tsx:476-479`) gated on `status === 'pending'` exactly — a state
no client booking has ever had, so it has never rendered (NOT VERIFIED render; the gate is code).
The orange "Pending requests" bar reads `booking_change_requests` — reschedule/cancel/defer only —
so **a new booking structurally cannot appear in it.** No reject. No counter-offer. No queue
route. The only refusal mechanism is `delete_calendar_item`, a literal `DELETE FROM bookings` with
no notification — which is precisely what happened to the owner's own two test bookings: **both
were hard-deleted, orphaning their audit events; his two spent credits still point at bookings
that no longer exist.** (Flag: the surviving evidence is itself mislabelled —
`trg_status_bookings` writes booking events as `entity_type='offering'`.)

| Category · cost | **MISSING · a build** (queue surface + confirm/reject/propose RPCs + notification). This is the largest genuinely-new construction on the list besides Zelle ingestion. |

# 11 · Payment confirmation and fulfilment — items 13, 14

**Item 13 — nothing prompts anyone, and staff *cannot* act.** `mark_purchase_paid` has **zero
callers in `src/`** and is granted to `service_role` only — no staff surface can mark an order
paid even deliberately. No client CTA ("I've paid"), no payment copy on `Confirmation.tsx`. Both
purchases in prod history remain unpaid. *Category MISSING · one component + one grant.*

**Item 14 — correction: Zelle matching IS built; its trigger and its failure path are not.**
`api/zelle-reconcile.ts` → `api/_lib/reconcile.ts` exists on main. But (a) its inbound trigger is
a hand-configured **Google Apps Script outside version control** (`workspace/zelle-poller.gs` is a
reference copy; nothing in `supabase/functions/`, no pg_cron, no workflow); (b) its `review`
failure branch **alerts nobody**; (c) per §5, every purchase has NULL matching keys, so it could
never have matched anything anyway. Functionally the owner is right — no alert is possible today —
but the repair is completion, not greenfield. *Category WIRING+MISSING · trigger-in-repo + alert
on `review` + §5's keys.*

**Fulfilment — the machinery works and has never once run.** `trg_booking_unit_link` consumes a
unit on `completed` and returns it on cancel — and **zero fulfillment status events have ever been
written**; all 12 units in prod read `open`; no booking has ever reached `completed`.
`fulfillment_units` and `my_fulfillment()` have **zero references in `src/`** — the obligations
ledger is invisible to every human. *Category MISSING (the surface) · one component + a staff
"mark delivered" affordance.*

**The punch-card ledger is still necessary.** 15 of 39 real bookings carry hand-typed counts
(`Melanie 3/8`, `Maddie 6/8`) — unchanged since BOOKWRITE, four of them **future-dated through
2026-08-23**: this is live procedure, not residue. And it is drifting — `Melanie 3/8` appears
twice. **Do not tell staff to stop typing counts until a screen exists that shows the automated
ledger** — today none does.

---

# 12 · THE KIOSK — verdict: IMPLEMENTED, twice — and neither is reachable

Not authored-only, not shelved, not forgotten: **built, merged, live in production, used by real
visitors — and left without an entrance.** Two generations exist:

**Generation 2 — the self-onboarding funnel (`/sign/guest|rider|horse|rider+horse`).** Fully
built and merged at `f415634`: `SignStart.tsx`, `api/sign-start.ts`, shared activation email,
rate-limit migration, `sign_start_register_attempt` live in prod. It converges on the spine —
`api/sign-start.ts:92` calls the same `provision_client_invitation` the admin path calls — so
"one flow, two initiation points" is **already true for identity onboarding**. Two things hide it:

1. **Zero inbound links.** Exhaustive search: no link to `/sign/*` exists anywhere in `src/` —
   only the route definition itself (re-verified this trace). There is no button. *WIRING · one
   anchor per funnel.*
2. **`docs/archive/BUILD_TRACKER.md:51-64` marks C4–C9 NOT STARTED** — re-verified verbatim this trace —
   while every artifact is merged and live. The document any thread consults to answer "was the
   kiosk forgotten?" answers *never built*. **That is the mechanism of the owner's confusion.**
   *Category: the tracker is WRONG · one docs edit (post-review).*

Caveat: routes verified in `App.tsx`; `vercel.json` rewrites were not audited; pages rendering is
NOT VERIFIED.

**Generation 1 — the visit-day release kiosk (`/release`).** Live and *used*: **7 kiosk-channel
requests (2026-07-14 → 2026-08-02 — half of all inbound volume), 28 executed documents… and 0
accounts, 0 invitations, 6 of 7 still `status='new'` after up to 30 days.** It calls
`sign_release` (a signing RPC, not the provisioning spine), notifies no one, and creates the work
item the admin path is supposed to close — nobody closes them. Its only inbound link is a
`⚠ DESTRUCTIVE`-flagged row in the temporary admin Review nav. Meanwhile `RELEASE_GENERAL` — the
document D8 describes as "signed at visit, kiosk-style" — has **one** executed instance ever.

**What unification still has to reconcile** (gen-1 → spine): anonymous auth (gen-2's server hop is
the proven pattern); identity depth (kiosk collects DOB/address/emergency contacts — *more* than
the spine takes); category declared-up-front vs derived-from-documents; documents already-executed
vs required-later (`ProvisionClientForm.tsx:95` already anticipates this); and account/purchase/
payment — present in the spine, absent at the kiosk. **The commerce half of the kiosk
(BUILD_TRACKER section D: in-flow orders/calendar/payment) is accurately NOT STARTED** — identity
is done, commerce never began.

Record hygiene found on the way (reported, not fixed): D8's "GUEST is never a derived group"
(owner-final, 2026-07-27) is contradicted by live `derive_affiliations`, which derives it (code
comment dates the reversal 2026-08-04) — the code looks right and the decision registry was never
amended. The 2026-07-26 "kiosk→Guest" ruling exists nowhere in `docs/tasks/`
(`WORK-INVENTORY-2026-08-08.md:157` lists it as an unwritten spec). The 2026-07-03 and 07-07
`/release` directives survive only as mutually contradictory comments in `Release.tsx`.

---

# 13 · WHAT BOOKWRITE DID AND DID NOT CURE — the cross-reference, settled

- **The fix is live in prod** (offering-preference `ORDER BY` present in
  `consume_unit_for_booking`; trigger widened to fire on the UPDATE path real bookings take) and
  **it genuinely works** — re-run this trace inside BEGIN/ROLLBACK: a Full Body Clip booking
  claimed the Full Body Clip unit with the target deliberately not lowest-seq. Old code would
  have taken the wrong one.
- **The owner's run predates it by ~44 hours** — but re-dating changes little, because:
- **It fixed the wrong function for what he saw.** His items 7/9 route through
  `book_open_slot`'s *credit* choice, which BOOKWRITE never touched (§9).
- **No backfill:** every pre-08-12 credit carries NULL `purchase_id`/`offering_id`; the repaired
  chain works for new purchases only.
- **It has never been exercised by a real user:** no booking created since 2026-08-04; 0 units
  ever consumed.

# 14 · FINDINGS NOT ON HIS LIST

1. **Two disconnected ledgers** (§8) — the root under items 6, 9, 12.
2. **$560 of his $1,000 is unbookable** — monthly/pack SKUs mint zero credits (§8).
3. **A provisioned buyer can never pay** — the `buyer_user_id` key mismatch (§5).
4. **Refusal = unnotified hard DELETE**, which orphaned his own test bookings' audit trail (§10).
5. **Non-deterministic unit claim** — the `seq=1` tie (§9).
6. **A migration silently reverted an earlier fix** — second known instance (§8).
7. **BUILD_TRACKER falsely reports the kiosk unbuilt** (§12).
8. **7 kiosk visitors, 28 executed docs, dead-ended unworked** (§12).
9. **Booking audit events mislabelled** `entity_type='offering'` (§10).
10. *Unattributed:* two prod bookings were mutated 2026-08-13 15:53/15:54 UTC by something other
    than this thread (which mutated nothing outside rollbacks). FLAGHARVEST is the other live
    thread; worth one question, not an alarm.

---

# 15 · THE COST LEDGER — what is one line and what is a rebuild

| # | Failure (owner's item) | Category | Cost |
|---|---|---|---|
| 1 | Order "sort of shows up" | MISSING | one component |
| 2 | One item, whole total | WRONG BY DESIGN | one RPC + one component |
| 3 | Memo "later" on pay screen | WIRING | one component + one migration |
| 4 | "Booking after payment" copy | **COPY** | **two strings** |
| — | Booking step absent from flow | MISSING | additive redesign of wizard (no gate to dismantle) |
| 5 | Calendar never surfaced | WIRING | one component |
| 6 | Credits shown accurately | (worked — by accident) | — |
| 7 | Subject auto-chosen chronologically | WRONG BY DESIGN | one component (picker) + pass-through |
| 8 | Everything is a lesson | WRONG BY DESIGN | one migration + picker |
| 9 | Credits consumed chronologically | WRONG BY DESIGN | fixed for units (BOOKWRITE); credits still need §9 |
| 10 | BOOKED not REQUESTED | WRONG BY DESIGN | one migration |
| 11 | No company review queue | **MISSING** | **a build** — queue + reject/propose + notify |
| 12 | Credit counts wrong | WRONG BY DESIGN | one migration — or the ledger-unification redesign |
| 13 | Nothing prompts payment check | MISSING | one component + one grant |
| 14 | No Zelle alert | WIRING+MISSING | trigger-in-repo + review-alert + §5 keys |
| — | Kiosk unreachable | WIRING | one anchor per funnel (+ tracker correction) |
| — | Kiosk commerce half | MISSING | accurately not started (tracker section D) |

**The shape of the repair, in one paragraph:** the owner's core requirement — bookings first,
payment last, requests reviewed — is blocked by *copy and absence, not by structure*. Nothing has
to be torn down: two strings retract the false gate; a booking step and a subject picker capture
intent; a pending status plus a review queue give the company its side; the memo/payment path
needs its two locks re-keyed; and the credit ledger needs to stop being two ledgers. The genuinely
new builds are exactly three — the wizard booking step, the company review queue, and the
Zelle-trigger/alert completion. Everything else on the list is a component, a migration, or a
sentence.

---

*Full per-segment evidence (function bodies, SQL transcripts, file:line quotes) preserved in the
orchestrator's session records; every claim above carries its mechanism inline. Renders NOT
VERIFIED throughout — no browser session existed.*
