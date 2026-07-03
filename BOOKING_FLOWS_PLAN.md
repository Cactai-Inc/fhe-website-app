# Booking & Onboarding Master Plan

Status: **DRAFT — owner review pending.** This is Plan 1 of 3 (who/what/how). Plan 2
(per-thread instruction files) and Plan 3 (sequencing detail) are authored only after
this document is approved.

Scope discipline: **Phase 1 = lessons** (single lesson, punch card, monthly lesson
membership). Phase 2 = leases, horsemanship training, exercise, search retainer,
evaluations, broker service, horse training. Phase 3 = jumper training (addendum
flow), clipping, gift purchases. Nothing in Phase 2/3 is built in Phase 1, but the
data model must not paint them into a corner.

---

## 1. Locked decisions

| Decision                                        | Value                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site can never produce a signed document | Signing happens ONLY in an authenticated session (attribution/identity — see release-signing audit). The website is lead capture + (Phase 3) gift payment.                                                                                                                                                                                                                      |
| Vocabulary                                      | **Request** = what a visitor/member submits (items + preferred weeks + contact method). **Booking** = a request that staff approved with real date(s)/time(s) — the client-facing word everywhere scheduling is involved. **Order** = the money record behind any purchase (and the client-facing word only for non-scheduled purchases, e.g. gifts). One word each; no mixing. |
| Signature vs payment                            | Documents reach **EXECUTED on signature, independent of payment**. The BOOKING is what's contingent on payment (confirmed on Stripe success / Zelle reconcile). A failed card still leaves valid signed releases on file.                                                                                                                                                       |
| Staff rails                                     | **Manual first**: staff read the request, log call notes, set/suggest dates, complete a fit checklist, click "Send confirmation." Automation (click-to-call, transcription, auto-summary, auto-calendar) is a later phase layered on the same structure.                                                                                                                        |
| Messaging                                       | No new messaging build. Community surfaces (Chat, Threads, member DMs) auto-hide at launch under the progressive-disclosure rule. Flows are driven by a new **notifications** spine (dashboard cards + email nudge). Client↔staff support inbox = post-launch revisit, cheap because DM plumbing exists.                                                                        |
| Progressive disclosure                          | A nav item / panel is hidden until it has something actionable or populated. First-time member sees: pending-booking card, profile, help. The app grows as the relationship grows.                                                                                                                                                                                              |
| Document term                                   | Releases/rules run "until superseded by a later executed version." Returning clients re-sign ONLY when a template version bumps (superseding version resurfaces in their next booking flow).                                                                                                                                                                                    |
| Addendum model (generalized, Phase 3)           | Offerings can be qualification-gated: `requires_qualification` + `qualification_addendum_template_key`. Qualified first-timers get the addendum as one more packet page; everyone else hits a qualification-review wall before booking opens. Implemented as conditional rows in the existing `contract_requirements` matrix.                                                   |

## 2. The four flows

### Flow A — New client, full onboarding (Phase 1)

1. **Visitor (public site, unauthenticated):** submits a **Request** — item(s) of
   interest (single lesson / punch card / membership), preferred week(s), preferred
   contact method. No dates, no payment, no documents.
2. **Staff (ops, manual rails):** request appears in a Request Inbox → contact the
   person per their preference → log call notes → assess fit → enter (or suggest)
   date(s)+time(s) → complete the per-service **fit checklist** → "Send confirmation"
   becomes clickable only when the checklist is green → sends the app invitation
   (existing invitation system) tied to the approved request.
3. **Client (app, authenticated):** signs in → dashboard shows ONE card: "Review your
   pending booking" → reviews engagement details → accepts → **intake gap-fill** (see
   §4: only the fields their required documents need and their profile doesn't have)
   → reviews + signs each populated required document (medical auth, rules, policies,
   liability release — order doesn't matter; every one must be seen populated and
   signed) → documents EXECUTE on signature → payment screen:
   - **Stripe:** completes inline → confirmation screen "everything has been emailed"
     → receipt + executed docs email.
   - **Zelle:** instructions + "when payment is confirmed you'll receive confirmation
     - your document copies by email" → booking stays `AWAITING_PAYMENT` until
       reconcile.
4. **Post-purchase dashboard states:** pending-review card gone → Bookings + calendar
   show date(s)/time(s) → first-time card: what to expect, directions, when to
   arrive, what to wear, preparation, making the most of it → link to Resources
   auto-sorted to their purchase → (later) social follow + preformatted share item.

### Flow B — Qualification-gated offering (jumper training) (Phase 3)

Same as A/D, except: offering is gated. Not yet qualified → booking blocked pending a
separate staff qualification review. Once qualified (or a rare already-qualified
newcomer), the jumper addendum is injected as one more document in the signing
packet. Mechanism: conditional requirement rows + a qualification status on the
client.

### Flow C — Gift purchase (Phase 3)

Anonymous buyer on the public site → giftable offering → "this is a gift" →
straight to payment → **simulated reveal-email preview** (buyer types occasion
string, recipient email, optional scheduled send date/time) → strict final
confirmation → pay. On PAID: buyer gets receipt; recipient gets the anonymous
"[Buyer] sent you something special for [occasion]" email **via a `scheduled_sends`
row + cron worker — never sent on write; gated on `send_after <= now()` AND parent
order PAID AND status `pending`** → animated click-to-open reveal → claim link =
pre-provisioned account creation → first-time experience like A but with no dates:
dashboard instructs them to schedule, pre-populated request form. Profile gap-fill
does the heavy lifting (buyer didn't know recipient's data).
Hard wall: the anonymous buyer's only power is create-order + pay. No contact record
they control, no documents, no account until the recipient claims.

### Flow D — Returning client, rebook/repurchase (Phase 1, alongside A)

Signed-in member → browses offerings **in the context of what they've done** ("Book
another lesson," "Refill your punch card") → submits an in-app booking request with
preferred dates → staff can approve quickly WITHOUT a call (fit already established;
checklist collapses to date confirmation) → notification → client confirms → payment
(or punch-card debit — no payment screen when a punch remains) → on calendar.
Friction reappears only when: (a) a document version bumped → superseding version
must be re-signed first, or (b) they cross into a gated offering → Flow B.

## 3. What exists today (verified by audit) vs. what's missing

**Exists and is load-bearing:**

- `contract_requirements` matrix + `required_documents_for()` RPC — required doc set
  per service type. Correctly seeded. (20260701070000)
- Contract engine: `generate_document` v8, token registry, seal-on-sign,
  `record_signature` with party check; `/app/documents` self-sign for pre-generated
  drafts; `/release` kiosk (input collection for 4 release variants + rules gate).
- `finalize_order_payment` RPC (unique amounts, payment references, tier price
  enforcement), Stripe webhook idempotency, Zelle reconcile.
- Invitations end-to-end (create → email → register → `redeem_invitation`).
- Email: send-email, deliver-document (party + company copies, logged in
  `document_deliveries`), receipts; **orphan** `send-transactional-email` endpoint
  with a reminder template and no caller — the notifications nudge gives it its job.
- `MyEngagementDetail` shows required-vs-signed read-only; admin `TemplatePicker`
  shows the required set when generating one doc at a time.
- Community layer (chat/DMs/threads/announcements) fully wired — to be auto-hidden.

**Missing (the build):**

- Service engagements: no `create_service_engagement`-style RPC, no UI (engagement
  creation is brokerage-only, admin-only).
- Public Request form + `booking_requests` storage.
- Staff Request Inbox: notes, dates, fit checklist, send-confirmation gate.
- Pending-booking review/accept in the app.
- **Signing packet**: guided multi-document flow that generates the required set,
  gap-fills inputs, shows each populated doc, signs each. (Keystone.)
- Profile field registry + template field-requirements + gap-fill mechanism (§4).
- Notifications spine (table, triggers/RPCs, dashboard cards, email nudge).
- Booking scheduling surface (client calendar shows booked slots; staff calendar
  confirm/approve). Scout step: inventory existing events/availability tables before
  designing new ones.
- Progressive-disclosure nav rules.
- Punch-card balance debit path in Flow D.
- Dashboard state machine (§6).

## 4. Profile-as-source + gap-fill (the central mechanism)

The profile is the canonical store; every document's fields are projections of it.

- **Profile field registry:** a table of member-profile fields (key, label, input
  type, validation, sensitivity), covering app-profile needs AND document needs
  (emergency contacts, physician, insurance, allergies, horse info, etc.).
- **Template field requirements:** each contract template declares which registry
  fields it consumes. ⚠ BLOCKED on owner's in-flight doc revisions — the machine is
  built now, the rows load when the revised templates land.
- **Gap-fill computation:** at intake time, `required fields for this booking's
document set − fields already on profile = the form the client sees`. Handles all
  flows with one mechanism: Flow A user enters most of it; Flow C recipient enters
  nearly all of it; Flow D user usually sees nothing.
- Anything entered flows INTO the profile (not into a one-off form), so it's there
  next time.

## 5. Two-lane sequencing (accommodates the in-flight doc revisions)

**Lane 1 — unblocked now (doc-independent):**

1. Data model: `booking_requests`, service engagement creation, `notifications`,
   scheduling scout + slots, profile field registry (structure), template
   field-requirements (structure), checklist definitions.
2. Public Request form (items/weeks/contact-method — offering list is pricing-driven,
   already final for lessons).
3. Staff Request Inbox + notes + dates + checklist + send-confirmation.
4. Notifications spine + dashboard state machine + progressive-disclosure nav.
5. Pending-booking review/accept UI.
6. Payment step wiring (Stripe/Zelle branches on the booking; punch-card debit).
7. Packet flow SHELL: navigation, per-doc review+sign UX, execute-on-sign — pointing
   at current template keys as placeholders.

**Lane 2 — blocked until revised templates are pushed + loader run:**

1. Template field-requirement rows (which profile fields each doc consumes).
2. Token dictionary updates for new/renamed tokens.
3. Gap-fill form content per document.
4. Packet flow pointed at final template keys; per-doc population verified.
5. E2E: request → onboard → sign all → pay → dashboard, per lesson product.

Rule: no thread may touch `supabase/contract_templates/*` or the token dictionary
until the owner's revisions land (owner runs the loader + pushes; Lane 2 starts
after).

## 6. Dashboard state machine (member)

| State                               | Card                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Invited, pending booking unaccepted | "Review your pending booking" (the ONLY card)                                                   |
| Accepted, docs unsigned             | "Finish signing your documents (n of m)"                                                        |
| Signed, unpaid                      | "Complete payment" (Stripe) / "Awaiting Zelle confirmation"                                     |
| Paid, upcoming first visit          | First-time card: expectations, directions, arrival, attire, prep + Resources link (auto-sorted) |
| Paid, returning                     | Bookings/calendar + contextual "book more" offers (Flow D entry)                                |
| Doc version bumped                  | "An updated [document] needs your signature" (blocks next booking, not current)                 |

## 7. Thread decomposition preview (Plan 2 will finalize)

| Thread      | Work                                                                                                                                      | Model rec                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| T1          | Migrations: booking_requests, notifications, service engagements, field registry + requirements structure, checklist defs (+PGlite tests) | Fable (RLS + RPC design risk)    |
| T2          | Public Request form + submit RPC + tests                                                                                                  | Sonnet 5                         |
| T3          | Staff Request Inbox (notes, dates, checklist, send-confirmation gate)                                                                     | Opus 4.8                         |
| T4          | Notifications spine + dashboard state machine + email nudge (reuse orphan endpoint)                                                       | Opus 4.8                         |
| T5          | Progressive-disclosure nav + community auto-hide                                                                                          | Sonnet 5                         |
| T6          | Pending-booking review/accept + payment step wiring + punch-card debit                                                                    | Opus 4.8                         |
| T7          | Signing packet shell (guided multi-doc UX on current templates)                                                                           | Fable (legal-adjacent, keystone) |
| T8 (Lane 2) | Field-requirement rows, token dict updates, gap-fill content, packet on final templates, E2E                                              | Fable                            |

Each thread ships with: exact file list, step order, validation checks (tests that
must pass, greps that must be empty), and "do not touch" fences.
