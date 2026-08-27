# CR-TRIAGE — keep / kill / do, all 80 — 2026-08-27

Planning-thread ruling pass over CHANGE-ORDERS-LIST.md (CR-01…CR-79 + CR-76b), performed at the
owner's direction before TASK-REGROUND runs. The ledger remains the record; nothing here deletes
a ledger entry.

Verdicts: DO — act now as its own small vertical slice, ahead of wave planning; bugs, false
pages, data faults, and one-file fixes. KEEP — requirement stands and folds into the re-grounded
refactor waves; where a surface is being replaced, the requirement carries, not the code. KILL —
out of the stop-gap: superseded by the owner's own later ruling, or deferred to the v2 platform;
reason stated each time. Items already 🔒 LOCKED by the owner are cited as law, not re-triaged.

Verdicts marked "confirm" are my recommendation on an A/B the owner offered and has not chosen —
they need his one-word confirm, and the build should not assume them until he gives it.

## Do now — before wave planning (14)

- CR-02 DO. Correct the 12AM/12PM data slip on the two bookings; the picker that prevents it is
  CR-07, kept. Also draw out-of-range items reachable in week view or at minimum in the opened
  day.
- CR-04 DO. The read already sends staff full detail and the staff label; make the screen look at
  the label. Display format is already ruled — name only on mobile, name plus type larger
  (relay ruling 6).
- CR-52 DO. Delete the "being activated" page — the state does not exist. Route to login with an
  accurate message or nothing. What "deleted" means for still-authenticating credentials goes to
  TASK-ONERAIL's trace.
- CR-54 DO. Investigation first, as the owner ordered: two components reading two shapes is the
  working hypothesis (set A knows role, set B knows date). Find the cause, then fix at the
  cause.
- CR-56 DO. Remove the text.
- CR-64 DO. Delete the onboarding liar page; landing rule is ruled — dashboard if notifications
  are present, community feed otherwise; the signing exit (CR-59) must stop landing there.
- CR-65 DO. Commission the exit-map sweep the owner assigned: one table, flow · exit label ·
  actual destination · correct destination, across the ten flows he listed. Small task, runs
  beside TASK-ONERAIL.
- CR-68a DO. Fix the outside-click-destroys-input defect at the shared component level, and make
  that the pattern the kit inherits — an overlay containing a form never discards on outside
  click.
- CR-68b DO. Two location fields, each a key-term select (barn · stable · stall · pen) plus an
  empty own-title option and text entry; delete the outdoor line.
- CR-68c DO. Placeholder text change, verbatim as given.
- CR-69 DO. Remove the euthanasia block from the shared intake component (account page and
  contract confirmed one component); verify the onboarding instance; add the photo-upload block
  in its place.
- CR-70a DO. Verify horse remove works and is double-gated. Correct under the D19 ruling: hard
  delete is irreversible, so confirmation is exactly where friction belongs.
- CR-70b-storage DO. Nine buckets with no allowed types and no size limit is live exposure — set
  both now. The Documents-tab upload button itself is KEEP, G7 wave.
- CR-76-faults DO. The Manage-payment dropdown offers four values, two lead nowhere, and it
  writes capitalised 'Zelle' against a production vocabulary of lowercase 'zelle'. This is the
  standing vocabulary-bound-select trap live in production: bind the select to the real
  vocabulary, write codes, reconcile the case. The My Payments build itself is owner-ruled and
  KEEP (G5).

## G1 · Calendar

- CR-01 KEEP — already ruled. Full-size center modal is relay ruling 7 / ADMIN-IA-REVISION §5.
  Lands with the three-door shell; unhosts the panel from the calendar page so dashboard and
  person surfaces can open the same item.
- CR-03 KEEP. The availability inversion — empty-is-open, remove generated slot furniture,
  orange/green/faded states. Spec as one slice with CR-06 and the self-booking path: 92% of the
  bookings table is furniture and the public path books it, so removal and the replacement
  booking mechanism ship together or not at all.
- CR-05 KEEP. Durations must exist somewhere first — add duration to the service definition,
  then draw by it. Prerequisite to CR-07.
- CR-06 KEEP. Decommission the three-position toggle inside the CR-03 slice — they are each
  other's evidence, decided together.
- CR-07 KEEP. Thirty-minute-increment dropdown, clash-aware, duration-aware. After CR-03 and
  CR-05 by dependency.

## G2 · Booking provisioning

- CR-08 KEEP. Client-first inversion; matches the calendar create flow under the hard split.
- CR-09 KEEP. Booking-creates-or-uses-offering, built strictly on CR-27's locked lifecycle so
  the order it creates actually opens.
- CR-10 KEEP. Make the screen honor the rule the save already enforces — filter services by
  horse-plus-care-paperwork. Its philosophical conflict with CR-51 is on the owner list below.
- CR-11 KEEP (built). Requirement carries to CR-30's replacement surfaces.
- CR-12 KEEP. Standing-weekly set from the client card; machinery exists, destination is the
  new client record. Repeat-on-booking stays only for credits and punch-card intent.
- CR-13 KEEP. Default trainer to Claire, one-tap to change, never skipped — the field recording
  who taught is not removed, it is pre-filled.
- CR-14 KEEP. Unclaimed horse names on bookings plus a claim path; the two already-built halves
  are noted, the two missing halves (unclaimed filter, name-only horse on a booking) are the
  build.

## G3 · Claire's day

- CR-21 KEEP. The next-up card, advancing forward list, done-list below — this is the Dashboard
  front-door zone from the IA revision, specced there.
- CR-22 KEEP. Add skipped; wire bookings into the existing history log; complete and no-show
  already exist, use them.
- CR-23 KEEP narrowed / KILL remainder. Timed-versus-all-day stays Claire's call (nothing to
  build); the medication note stays a notes field. Deriving tasks from contract data is AI and
  AI is v2 — the owner's own correction. The lease's reserved-days structured field stays live
  as CR-71 input.

## G4 · Notifications and email

- CR-24 KEEP remainder. Cadence shipped; remaining: timezone as a tenant setting not code, and
  send-at-chosen-times rather than on-appearance.
- CR-25 KEEP. Build the order-placed alert (none exists); fix the 2-of-12 lead-alert email
  delivery as part of the same slice. Rachel's stuck order is owner-ruled untouched (CR-27).
- CR-26 KEEP. Payment reminder ladder, G5 wave with CR-28/CR-60 vocabulary reconciled first.
- CR-78 KEEP. Two events, signable and signed; requires watching contract_lock_blockers, which
  nothing does today. The owner's ordering assumption is flagged for ONERAIL to confirm, not
  inherit.

## G5 · Billing and pricing

- CR-28 KEEP. Month-ahead fill on confirmed payment, pending-payment versus confirmed states
  (exist, unused), paid-through period (does not exist — build it). Kill the false three-month
  promise text immediately as part of this slice's first commit.
- CR-29 KEEP. Cadence pricing model — one service, three cadence prices; the +$20/evaluation
  bundling rule. Which ladder covers which of the four weekly plans is on the owner list.
- CR-38 KEEP. Quantity for weekly care services once visits-per-week versus weeks-bought is
  answered — that question rides the line-item model.
- CR-39 KEEP, with its investigation in the DO lane's spirit: first check whether comps have
  been recorded as paid — if yes, revenue figures are wrong today and the owner should know
  before the model builds. Comp-as-loss, visible to the client, per his wording.
- CR-40 KEEP. Discounts — almost certainly the same missing mechanism as comp and override
  (line price different from offering price); build once.
- CR-41 KEEP. Published rate card; same pricing rebuild as CR-29; feeds the public-site lane.
- CR-16 KEEP — owner-ruled scope. The line-item editing model (quantity, comp, discount, void,
  mark paid, cadence), specced across CR-38…42, not a button.
- CR-60 KEEP. Three-state payment ladder; reconcile vocabulary with CR-28 before either builds.
- CR-76 KEEP — owner-ruled (card + page, consolidate to the simpler surface unless the complex
  one shows more, method-only client-editable, pending semantics as quoted). Faults are in DO.
- CR-76b 🔒 LOCKED — build as ruled: payment as its own entity with a payment number, full
  history not outstanding-only, same build as split payment. Fix the 39-orphan status_events
  fault while in there.

## G6 · People surfaces

- CR-30 KEEP — owner-ruled surface model. Lead = dashboard notification + modal + buttons;
  client = record page with tab set; provisioning cover page; delete-with-optional-block as
  fourth exit; submission becomes account history. This IS the People wave, re-grounded by
  TASK-REGROUND against the offering model.
- CR-31 KEEP. Horse-add on the client record — folds into CR-30's tab set.
- CR-32 KILL — superseded by CR-30 by the owner's own account; the ledger's override rule
  applies. The phone-as-working-device caveat survives as a mobile requirement on CR-30.
- CR-33 KEEP as verification: the client page inherits the modal's parts (its own header says
  they came from there); CR-30's build closes it.
- CR-34 KEEP. Submission, contact info, contact preference — two clicks to contact. Fix the
  data loss at promotion (request-row data never reaching the contact record) as an early
  slice; that half is effectively DO once CR-30's target exists.
- CR-35 KEEP. Snapshot at promotion; scope question (whole submission vs order-only, where the
  diff shows) on the owner list.
- CR-36 KEEP (built). Size-lock requirement carries to whatever replaces the modal.
- CR-43 KEEP, unresolved — on the owner list. His lean (B, public order creates account behind
  hCaptcha) collides with his own community-for-every-account ruling and depends on CR-27's
  "accepted as client" state. Both cannot stand as written; he chooses.
- CR-44 KEEP. Lead card with submission + three dispositions; marketing zone is a new surface;
  the fourth exit is CR-30's delete.
- CR-45 KEEP. Marketing zone and dungeon as surfaces; the key distinction (account is free,
  CLIENT DESIGNATION triggers everything) becomes a stated design rule of the People wave. His
  three sub-questions on the owner list.
- CR-46 KEEP. From-scratch client creation in his stated order; the cover-page sequence is the
  spec.
- CR-47 KEEP as research → merged into TASK-ONERAIL, which is already tracing exactly this
  (draft/active triggers, tags, sent-versus-active).
- CR-48 KEEP. Visitor over guest: display-layer rename in the waves it touches; stored-value
  migration is its own careful slice with readers enumerated first.
- CR-49 KEEP. Lead self-serve door as a variant of the built /sign/* pathway; his two
  sub-questions on the owner list.
- CR-50 KILL as written — superseded in detail by CR-53 and CR-62, and the three-boolean state
  model loses to membership-status + designation (CR-45). The intent (a lead sees a narrow
  app) survives entirely in its successors.
- CR-51 KEEP, flagged — its let-them-order-and-ask-at-signin philosophy and CR-10's
  hide-without-a-horse are unreconciled; owner list.
- CR-53 KEEP minus card order (superseded by CR-62). Lead nav allowlist stands: Dashboard,
  Catalog, Account, Sign out.
- CR-59 KEEP. The promote→tour→payment-prompt→sign→dashboard member flow; buildable only on
  CR-27; the signing exit change is in CR-64's DO.
- CR-61 KEEP. Audience rule as found: toggle governs only their own header; everyone else sees
  photo and name. Collision with lead-preferences-hidden resolves itself — the toggle is
  client-tier; leads get the default.
- CR-62 KEEP — supersedes CR-53's order. One ordered list, prefix-for-leads, column count per
  layout.
- CR-63 KEEP with my take, as he asked: one surface, two doors — the nav item and the account
  card open the same expanded surface, never two implementations. Default member nav shows My
  Orders, not My Documents; documents are rare-but-blocking and already arrive as dashboard
  notifications (CR-59), and CR-66's toggles let anyone who wants Documents in the menu put it
  back. Confirm.
- CR-66 KEEP. Build the first-sign-in modal and Preferences toggles that never landed.
  Precedence ruled architecturally: presence gates availability (what exists to show), the
  person's toggle gates visibility among what is available; presence always wins when empty.
- CR-67 KEEP remainder. KPI header shipped; the admin dashboard layout problem dissolves into
  the Dashboard wave, which replaces that layout.
- CR-74 🔒 LOCKED — the surface rule (expanded cards in place; modals for quick view and quick
  action, and a modal can be the work when the work is quick; a record is a page). Feeds the
  kit directly.
- CR-75 KEEP — revises CR-30's client half to expanding rows; collapse-saves is the build; the
  line-in-the-sand and document-expansion questions stay open by his own instruction, answered
  by testing, not ruled now.

## G7 · Orders and paperwork

- CR-15 / CR-17 / CR-18 / CR-19 KEEP (built). Requirements carry; CR-18 addendum: place jumper
  training where he listed it or ask — his list did not include it and it sits last; owner
  list, one word.
- CR-20 KEEP, confirm B — built as the version he elaborated; lock it and close the A/B.
- CR-72 KEEP with my take, as he asked: collapse the visible controls to two — can-fill-own-
  fields (default on) and can-edit-deal-terms (default off, staff-set). Remove the suggest and
  add-clause tier from the UI for v1: never exercised once, largest surface area, and the
  propose-and-review pattern belongs to the v2 collaboration model. Keep the schema, resolve
  the duplicated flag to one source of truth. Confirm.
- CR-73 DO after its two checks: confirm the lock blocker is unconditional and nothing else
  reads the confirmation (zero writes in 68 documents says nothing will miss it), then remove
  the checkbox and its paths entirely.
- CR-77 KEEP. Wire ENTITY_SIGNER name/title into the signing act so signing populates them and
  the final PDF goes to both parties; his two sub-questions on the owner list.
- CR-79 🔒 built. Done.

## G8 · The request → order spine

- CR-27 🔒 LOCKED — and it is wave priority one after TASK-REGROUND. The dependency table says
  it plainly: nothing in G5, CR-09, CR-25, CR-43, CR-59, or CR-76b can exist until approval
  works. The ten locked validation criteria are the spec; build to them exactly.

## Horse record

- CR-68d KEEP. Managed-options with author-scoped suggestions; the half-built mechanism gets
  its editor and its queue screen, or the queue keeps filling with nothing to read it.
- CR-70b KEEP (upload button on Documents tab honoring the documents/files split); storage
  limits already in DO.
- CR-70c KILL for v1 — defer to v2. Cross-member horse tagging that writes to another member's
  record is an unresolved permission model, and community is deliberately operable-only in the
  stop-gap. The requirement is preserved in the ledger for the v2 community build, where the
  feed is the product.
- CR-71 KEEP capture, defer enforcement. Put the limit fields on the horse record now
  (volume, kind, day-specific — structured, displayed); the enforcement engine (consecutive-day
  lookback, lease contradiction, override policy) waits on his four open answers and lands
  with the CR-03/07 calendar slice at the earliest.

## G9 · Globalization

- CR-37 KEEP, ruled: the primitive kit sets the standard (authored in the planning thread, per
  the relay), and each wave applies it to every surface it touches — no separate big-bang pass
  before flow integrity, and no fix lands off-standard. That answers his open question: the
  refactor sets the standard, the fixes carry it.
- CR-57 KEEP. Arrow-points-at-what-the-next-click-does, codified in the kit; verified at three
  nesting levels for CR-75.
- CR-58 KEEP. Two add-patterns, both stand, both codified: outlined empty line-item for lines
  on an order (CR-15's case), plain + text link for records in a list (this case). The kit
  names when each applies.

## Needs the owner's answer before LOCKED (not before wave planning)

CR-43 A or B, knowing B collides with community-for-every-account and needs CR-27. CR-29 which
plans the ladder covers. CR-71's four enforcement questions. CR-35 snapshot scope. CR-45's
three exits questions. CR-49's two. CR-77's two. CR-18 jumper-training position. Confirms:
CR-20 (B), CR-63 (take), CR-72 (take), CR-55 — on CR-55 my recommendation: A only if the
viewer literally embeds the already-rendered PDF with no second renderer; any second renderer
and it is B, download-only, by his own fallback and by D18.

## Sequence handed to ORCH5

DO items run now as small slices. Then TASK-ONERAIL and TASK-REGROUND as gated. Then waves:
CR-27 spine first; calendar model (CR-03/05/06/07) second; People surfaces (CR-30 family)
third, consuming ONERAIL; billing model (G5) fourth; kit rides every wave from wave zero.

---

# ORCH5 AUDIT OF THIS TRIAGE — 2026-08-27

**Accepted, with four corrections and one new finding.** The verdicts are sound, the DO/KEEP/KILL
split is the right shape, and **the sequence is right: CR-27 first.** The dependency table supports
that plainly — nothing in G5, and none of CR-09, CR-25, CR-43, CR-59 or CR-76b, can exist until
approval works. Everything below is a correction to this document, not a re-triage of it.

## 1. TWO ITEMS HAVE NO VERDICT — 79 of 80, not 80

- ⚠️ **CR-42 (send an incentive with something redeemable in it) is absent entirely** — it appears
  nowhere in this file, in no group and in no lane. It needs a verdict.
  **For whoever rules it:** the gift path already issues something redeemable to someone who did not
  buy it, so the machinery may exist and want pointing at a new purpose. The build-defining question
  is single-use-per-person versus one code many people use — those are very different builds.
- **CR-55 (the read view that turns 4 pages into 7) has a recommendation but no verdict.** It appears
  only in the confirms paragraph. **The recommendation in it is right and worth promoting to a
  verdict:** A only if the viewer embeds the already-rendered PDF, otherwise B by his own fallback
  and by D18 — a second renderer repeating a defect already fixed in the first is exactly the
  second-write-path failure. **B is a deletion, which makes it DO, not KEEP.**

## 2. CR-73 IS IN TWO LANES

It is marked **DO** in the G7 section but is not among the fourteen in the DO list, so the lane is
**fifteen items, not fourteen.** No disagreement with the verdict — the count is just wrong, and a
DO lane is a work list.

## 3. ⚠️ THE STORAGE CLAIM IS UNDERSTATED — VERIFIED AGAINST PRODUCTION, 2026-08-27

CR-70b-storage says *"nine buckets with no allowed types and no size limit."* **Measured: it is
worse, and the shape of the exposure is different.**

| | |
|---|---|
| buckets | **12**, not nine |
| accepting **ANY** MIME type | ⚠️ **all 12** |
| with **no** size limit | **11** — only `feed-media` has one (25 MB) |
| ⚠️ **PUBLIC** | **2 — `feed-media` and `profile-images`** |

⚠️ **`profile-images` is public, accepts any type, and has no size limit.** That is the sharp end:
any authenticated user can put an arbitrary-size file of arbitrary type into a **publicly readable**
bucket. **The DO item stands and should name that bucket first.** Setting the two limits is a
security decision about which types are allowed, not a mechanical config change — so it is a small
spec, not an orchestrator one-liner.

## 4. ⚠️ CR-77 IS RESOLVED. I WAS WRONG ABOUT IT, THREE TIMES.

I have told the owner in three consecutive reports that CR-77 **blocks a real client with a real
lease today.** **It does not, and has not since 2026-08-26.** Verified just now against production:

```
contract_lock_blockers('7adcd08f-…') → []          (empty)
documents.status = AWAITING_SIGNATURE · workflow_state = in_review · current_status = sent_for_review
signatures = 0
```

All three previously blocking fields are filled. **The lease is unblocked, sent, and waiting on a
signature.** This triage filing CR-77 as **KEEP** is therefore correct and my "it is urgent" framing
was stale — I carried a fact from the handoff forward across three turns without re-querying it,
which is the exact discipline this repo has a standing rule about. **The design half — should
capacity move to the signature act — is genuinely a wave item.**

## 5. ⚠️ NEW FINDING FROM THAT CHECK — A COUNTERPARTY-OWNED TERM WAS ANSWERED BY THE OTHER PARTY

Checking *how* CR-77 got unblocked turned this up. It is not in any change request.

```
TXN.RIDER_AIDS_PROHIBITED   owner_role = LESSOR   value = 'NO'
entered_by = CJ Z           entered_at = 2026-08-26 10:47
```

**LESSOR is Pamela. That field is hers, and it was answered by the LESSEE.** The ledger's own CR-77
entry warned against precisely this — *"the rider-aids pair is Pamela's and filling it for her is
answering on her behalf"* — and the other two fields filled at the same sitting were correctly FHE's
own.

**Why it matters beyond one field:** it is a substantive term of a lease she is about to sign,
recording that she does **not** prohibit the use of rider aids, and nobody asked her. **D14 should
catch it** — a change on a signable document is surfaced to the party who did not make it, one at a
time, before signing. **But D29 records that this exact flow has been gated on `my_roles` resolving,
and that it has come back empty in real sessions**, which is how proposals and edit controls both
vanished. **So the safety net here is one whose gating is a known defect.**

**Recommendation, and it is the owner's call, not a build:** clear that field back to empty before
she signs, or confirm with her directly that NO is what she meant. **Not a code change — a one-row
correction on a live document, and it should be his decision.** ⚠️ Rehearse in
`BEGIN; … ROLLBACK;` first, per the standing rule on that document.

## 6. WHAT ORCH5 DOES WITH THIS

**The sequence is accepted as handed over:** DO items as small slices → TASK-ONERAIL and
TASK-REGROUND gated → then waves, CR-27 spine first, calendar model second, People third consuming
ONERAIL, billing fourth, the kit riding every wave.

⚠️ **One item sits ahead of all of it and is not in this triage because it is not a change request:
`TASK-ORIGIN`.** It is written, reconciled and ready, and it is on the critical path for a reason
none of the waves change — **the owner is about to hand-enter every account, and a field that does
not exist when he starts is data entered twice.** It is re-checked against the platform framing and
still ships; the reasoning is in the spec.
