# Backlog

The standing work list. Everything here is either not started or deliberately
deferred; anything finished simply leaves the file.

---

## Ready to build

### Business admin suite
`supabase/migrations/20260726090000_biz_expenses_and_financials.sql` is written but
**deliberately unapplied**. Two defects must be fixed before it ships:

- **The MRR calculation is wrong** — it sums `amount` over all recurring purchases
  with no time window and no per-month normalisation: a lifetime total mislabelled
  "monthly", for a product that does not exist.
- **The member KPI is misleading** — it counts activated accounts including staff,
  not paying members.

Then build: sales tracker, expense tracker, growth tracker, KPI dashboard, a PDF
business-report generator, and a CSV financial export. All must read live data
(`purchases.amount/amount_paid/paid_at`, `board_charges`, `contacts`, `expenses`) and
degrade gracefully on empty periods. Existing building blocks: the `KpiSpec`/`KpiTile`
framework in `OpsDashboard.tsx`, the reduce-sum pattern in `api-boarding.ts`, and the
`<Money>` formatter.

### Verification gaps
- **The DB test suites have never been executed.** They are re-targeted onto the
  current schema but need a dedicated test database. Several were stale before that.
- **The fulfillment spine is proven only synthetically.** `purchases` is at 0 rows;
  its first real exercise is the first real purchase.
- **The email-change round-trip has never been run end to end.**

---

## Pre-launch cleanup

Test-era data and follow-ups that must be disposed of before real users arrive.
Opened by U1 (lead trust + notification integrity), 2026-08-01.

- **Charles Zigmund duplicate contact pair** — `07ab7dbf-33f2-4c2c-963a-f37761d5ffd1`
  (no email) and `d268330c-436a-4f42-bf88-9172d9b4155f` (`cjzigs@icloud.com`) are the
  same person. **Deliberately NOT merged** during U1: `d268330c` is the live lessor on
  the reference sample draft, and merging mid-run could disturb it. Owner decides the
  merge direction at cleanup time. Both were typed `CONTACT` by U1's `contact_type`
  backfill — a transitional value, not a judgement that they are distinct people.
- **Two `Unnamed Contact` artifacts** — `bb57e418-3875-4219-90a4-31ab47fb4bde` and
  `6ecceaf0-4a59-4ac6-83a3-3c330d5682e6`; no email, no name. Shape matches what
  `ensure_contact_for_profile`'s fallback produces when a profile carries neither a
  name nor an email. Dispose at cleanup; confirm the origin trace before deleting in
  case the fallback is still reachable.
- **Notification NULL-link hardening (prophylactic)** — U1 item 5e's anchor was absent:
  live `select count(*) from notifications where link is null` returned **0**, so its
  own done-check already passed and no producer was touched. `notify_staff` and
  `notify_user` both take a link parameter today. Worth adding a NOT NULL constraint or
  a producer-side guard so a future call site cannot write an unresolvable row —
  deliberate hardening, not a bug fix.
- **Intake deep-link** — `request_new` notifications link to
  `/app/ops/intake?request=<id>`. The link is unique per request (which is what makes
  kind-scoped resolution correct) but `IntakePage.tsx` reads no query params, so the
  parameter is currently inert. Wire the page to read it and open that request's
  drawer; the link then becomes a real deep-link with no notification change.
- **Stages 4–5 proof-of-fix document** — `c36449f7-a29f-4b12-9313-4f9a8a0ca9a1`
  (contract `07d84769-23cd-4c76-bf96-3a735a502c73`), lessee `d99f1472-...` ("CJ Z"),
  lessor `352c3898-...` (FHE), horse `a8e82033-...`. Created live through
  `start_lease_contract_v2` + `set_contract_field` to prove D1–D5 (insurance
  resolution) end to end for `docs/reports/PROMPT_A_STAGES_4-5.md`'s final sample —
  real RPCs, real accounts, not synthetic. Void or dispose at cleanup. A sibling
  attempt, `4051bd91-e904-49db-a0e8-9a27a419b707`, was already voided during the same
  run (superseded — wrong lessee identity for the proof, no linked account to
  exercise the party-exclusive election).

---

## Known defects

- **`remerge_contract_from_clauses` is missing U2.1's entire money-rendering
  layer** (found 2026-08-02, generating the Stages 4-5 final sample).
  `generate_document` (document CREATION) has Stage 2's `fmt_money` +
  `fee_schedule` JSON parsing; `remerge_contract_body` →
  `remerge_contract_from_clauses` (the re-render path used every time a party
  edits a draft's fields — the normal, expected editing flow, not an edge
  case) has neither. Confirmed live on draft `b7446f9e`: `HORSE.FAIR_MARKET_VALUE`
  renders bare `45000.00` (not `$45,000.00`) and `TXN.LEASE_FEE` renders the
  raw stored JSON `{"initial_due":"850"}` (not `Initial payment due: $850.00.`)
  even though both fields are stored correctly per U2.1's fix. Net effect: any
  money token U2.1 fixed reverts to its pre-fix broken rendering the moment a
  party edits ANY field on the document, because that edit triggers a remerge
  through the unfixed path. This makes U2.1 effectively unfixed for a
  document's whole life after its first edit. Needs the same fmt_money /
  fee_schedule logic ported into `remerge_contract_from_clauses` (or both
  functions refactored to share one formatting layer — worth doing regardless,
  since two independent implementations is how this happened).
- **Landing's only CTA goes to `/story`, not the booking funnel** —
  `src/pages/Landing.tsx:104-105`.
- **Dead nav route** — `src/components/app/AppLayout.tsx` links "Brokerage" to
  `/app/ops/brokerage`, which is not defined in `App.tsx`.
- **`Lessons.tsx` has no loading or error state** (`src/pages/Lessons.tsx:36-40`); on
  fetch failure it silently renders an empty grid.
- **Placeholder media** — hero (`src/pages/Landing.tsx:24`), Story "SWAP" bands
  (`Story.tsx:104,164,183,250`), offering-card `CoverPlaceholder`
  (`OfferingCatalog.tsx:39,46`), and `src/pages/Faq.tsx:6-7` placeholder copy.

---

## Deferred

- **Linked accounts: schedule sharing** — rider-permission-gated schedule visibility
  between linked accounts. (The record-sharing half is covered: a shared horse record
  works through `horse_relationships` parties.)
- **Calendar day/list view modes** — week/month exist; the item panel is still
  compact (`CalendarItemPanel.tsx`).
- **Stable item form fields** — `AddItemModal` is name + detail + vendor only
  (`src/components/app/StableEditors.tsx`); category list, conditional size,
  where-bought, price-paid and notes are not built.
- **Mobile device pass** — needs real-device testing.
- **Membership tiers** — settled as deferred (D4). `tier` stays a reserved word.
- **Chat-with-us** — SMS/WhatsApp deep-link with preformatted messages, recording the
  click and capturing the visitor as a contact.
- **SEO** — technical SEO is implementable now; keyword/content strategy needs input.
  `src/lib/seo.ts:18` has a TODO for the real street address, and `Contact.tsx:21` is
  `noindex` — confirm that is intended.
- **Hero image + page content refresh.**
- **Payment / Zelle receipt-validation live testing** — needs real credentials.
- **Org-config streamlining** — `src/lib/stable.ts` hardcodes a
  `'Carmel Creek Ranch'` location fallback and nulls discipline/markings/photo_url.
- **Purchase/sale contract template** — blocked on the owner's reference document.

---

## Standing notes

- **Migrations are not rebuild-safe.** Many rewrite existing function bodies in place
  via `pg_get_functiondef` + string-replace, which silently no-ops on a fresh
  database. Worth a strategy if a clean rebuild is ever needed.
- There is no `supabase_migrations.schema_migrations` table — migrations are a
  hand-maintained journal applied via `psql`.
- **`profiles.payment_reminders` is vestigial** (D9: no dunning email exists). It has
  no reader and is not in the profile payload.
- **Insurance: both parties report no coverage — SUPERSEDED by
  `insurance-resolution-spec.md`** (owner ruling, 2026-08-01). The editor
  auto-check design formerly described here is **withdrawn: do not implement
  it.** Auto-checking `TXN.{X}_NOT_REQUIRED` would have made an election on
  the Lessor's behalf — and only the party inheriting responsibility may make
  it. The replacement treats a both-`NONE` section as UNRESOLVED: it alerts
  both parties and blocks signing until the responsible party checks their own
  certify (`TXN.{X}_NOT_REQUIRED` for Lessor, a new
  `TXN.{X}_LESSEE_RESPONSIBLE` for Lessee), party-exclusively and enforced
  server-side. Has DB and frontend parts that run as a later specified
  workstream; the spec is authoritative and now lives in-repo at
  `docs/insurance-resolution-spec.md`.

- **Insurance: the no-coverage clause bodies are UNWRITTEN** (2026-08-01,
  item E of `docs/clause-gate-batch-spec.md`). Only the clause *language* is
  outstanding; the mechanism question is settled and lives in
  `docs/insurance-resolution-spec.md`.
  - **Gates are unchanged and stay that way.** The three
    `INSURANCE_RISK.{GL,MORT,MED}_NONE` clauses keep their existing
    equals-`YES` gate on `TXN.{X}_NOT_REQUIRED`. The proposed widening —
    firing them when both parties' status is `NONE` — is **withdrawn, not
    deferred.** Their bodies read *"Lessor has elected not to require…"*, so
    firing them at `NOT_REQUIRED = 'NO'` would assert a waiver Lessor
    demonstrably did not make: a false statement of fact in an executed
    instrument, sitting beside the `{X}_STATUS` declarations that contradict
    its own opening sentence.
  - **Resolution is a party election, not an inference.** A both-`NONE`
    section is UNRESOLVED and blocks signing until the party inheriting
    responsibility checks their own box — `TXN.{X}_NOT_REQUIRED` (Lessor
    side) or the new `TXN.{X}_LESSEE_RESPONSIBLE` (Lessee side),
    party-exclusive and enforced server-side. Two boxes, each checkable by
    one side only; the other renders disabled but visible. See the spec for
    the DB unit (D1–D5), the frontend set (F1–F4), and the sequencing.
  - **What remains here is content:** a body for the new
    Lessee-responsible clause in all three sections, a re-read of the
    existing `{X}_NONE` election language against every state that renders
    it, and tooltip/notification wording. Blocked on the legal pass; do not
    draft legal language in a DB thread.

- **`purchases.status = 'confirmed'` is a retiring value** (2026-08-01). Stripe's
  webhook used to overwrite `mark_purchase_paid`'s `'paid'` with `'confirmed'`, so a
  Stripe order ended in a different status than a Zelle or staff-marked order — and
  the webhook's own duplicate guard only worked because its overwrite put it there.
  The overwrite is removed; `mark_purchase_paid` sets `status='paid'` and `paid_at`
  on every route. Two consumers were **widened** to accept either value rather than
  swapped, so any historical `'confirmed'` row still renders and still guards:
  `src/pages/OrderDetail.tsx:117` (the customer success panel) and
  `api/stripe-create-session.ts:46` (the already-paid guard). **Deferred cleanup:**
  once the vocabulary has been unified long enough that no `'confirmed'` rows remain,
  drop the `|| 'confirmed'` branches in both files and the value from the
  `purchases.status` union in `src/lib/types.ts:22`. Left in place deliberately —
  they are not dead code yet.

- **`_provision_purchase_for_offerings` still has two overloads** (2026-08-01). The
  07-25 signature (`…, p_mark_paid boolean, p_payment_method text, …`) is the one
  `provision_client_invitation` calls positionally — dropping it breaks invite
  provisioning. The 07-26 signature (`…, p_payment_method text, p_mark_paid boolean,
  …`) had its `PUBLIC`/`anon` grants revoked in
  `20260801010000_revoke_anon_provision_overload.sql`; the **drop** still needs a
  caller trace first, since call sites resolve positionally and parameters 5 and 6
  are reversed between the two. Same caveat applies to `sign_release` (26-arg only
  today) and `staff_assign_horse_party` (8-arg only) — the 14-arg and 3-arg
  overloads named in the original audit do not exist.

- **`profiles.address_line1/address_line2/city/state/postal_code` are vestigial**
  (verified 2026-07-29). Zero writers and zero readers in the DB and the frontend:
  `update_my_onboarding_profile` mirrors only first/last name onto `profiles` and
  writes the address to `contacts`. Live counts: `contacts` 12/16 populated,
  `profiles` 0/7. `contacts` is the canonical home — it is what the onboarding
  intake writes, what `compose_address()` generates `address_composed` from, and
  what the contract party tokens (`LESSEE.ADDRESS`) resolve through. The dead
  fallbacks that read these columns are removed; the columns themselves remain
  until a schema-drop decision. They stay a trap for anyone who greps for an
  address and finds the wrong table first.
