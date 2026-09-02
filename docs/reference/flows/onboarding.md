# FLOWS — ONBOARDING

**Traced at main `c56559e` (2026-08-20), prod `lrstswfxfsezdmvkvukc` read-only.**
Areas touched (nav taxonomy from `AppLayout.tsx` / `pageRegistry.ts`): **Public site**
(funnels, `/activate`, kiosk) · **Member app** (`/app/onboarding`, `/app/documents`,
`/app/horse-intake`) · **Management** (Records → Clients/Leads) · the mail edge (`api/`).
Spine incumbents absorbed: `TASK-FLOWTRACE-REPORT.md` §1–2, `TASK-CONTRACTWALK-REPORT.md`
Part 1 §1–3, `TASK-CLOSEOUT-REPORT.md` §1.3/§1.6/§3.5.

---

## F1 — Admin-provisioned client onboarding (the canonical spine)

TRIGGER      Staff provisions a person: Records → Clients "New client"
             (`ClientRecordActions.tsx:176` region), a lead in the work drawer
             (`LeadWorkDrawer.tsx:271` area), a contact dossier's Provision section, or
             `/app/ops/accounts/new` (SURFACE-INVENTORY §3, AccountInvitePage row).
ACTORS       staff (admin) · invitee (lead→client) · system: `api/admin-send-invitation.ts`,
             the mail provider, Supabase auth.
PRECONDITION Staff session. Optionally an inbound request (F5) to convert.

SEQUENCE
1. Staff fills the provisioning form (categories, offerings multi-select, per-document
   paperwork checkboxes, payment status, optional agreed-lesson panel — CLOSEOUT §3.5 put
   `AgreedLessonSection` on **all** provisioning surfaces). Client-side total is display-only
   (FLOWTRACE F1, inherited).
   → *Staff see the form; nobody else sees anything yet.*
2. Submit → `src/lib/admin.ts` → POST `/api/admin-send-invitation` (staff bearer token).
   Two paths: plain staff invite (no categories/offerings — plain `invitations` insert) or
   the **provisioned client invite**: RPC `provision_client_invitation` (service-role).
3. The RPC writes, in one transaction: `contacts` → `clients` →
   `contact_required_documents` (the checkbox list is now the whole truth — CONTRACTWALK A1's
   "cannot narrow" is FIXED; CLOSEOUT walk16 E1 proves unchecked docs are never created) →
   duplicate-basket guard → `purchases` + `purchase_items` → per-item triggers fire
   (`trg_generate_fulfillment_units`, `trg_mint_purchase_credits`,
   `attach_first_purchase_policies`, `promote_buyer_from_offering` — see fulfilment.md F13)
   → `invitations` (+ supersession of older live invitations) → `apply_affiliations` →
   optional agreed lesson (`p_agreed_lesson`) books the phone-agreed time in the same act.
   When converting a request, `invitations.request_id` is stamped and the request flips to
   `invited`.
   → *Staff see the new client row; the invitee sees nothing until the email lands.*
4. The endpoint emails the activation link (`_lib/invitationEmail.ts`, one shared template
   with the kiosk path) and records the send outcome against the invitation
   (`recordInvitationDelivery`); on send failure the invitation still exists and the URL is
   returned to the admin to copy (admin-send-invitation.ts header).
5. Invitee clicks `/activate?token=…` (`App.tsx:155` — `/register` is a redirect,
   `App.tsx:212`). `Register.tsx` calls `validate_invitation` on load; dead links get the
   replacement notice, and a **redeemed token with an existing profile** now gets
   "You've already activated — sign in" (CLOSEOUT §1.3, five cases proven).
6. Password path: POST `/api/register-invited` creates the auth user server-side with
   `email_confirm: true` (the client-side signUp dead-end is why this endpoint exists) →
   sign-in → `redeemInvitation` (`Register.tsx:36`) → `redeem_invitation`: profile linked to
   the contact (`profiles_link_contact` trigger), `members` row (community), invitation →
   `redeemed`, originating request → `converted`. Google path: same redemption after OAuth.
7. Route into `/app/onboarding` (Onboarding.tsx; SURFACE-INVENTORY §2 row): profile step
   (gating fields exactly: phone, DOB, EC1 name, EC1 phone — CONTRACTWALK §3, inherited),
   documents step (`generate_my_onboarding_documents`, `signMyDocument` → `record_signature`),
   horse step only when a horse-bearing category needs it, payment step (see BREAKS 2).
8. The signing wall: `AppLayout.tsx:1412` calls `myWallState()` → `my_wall_state` on every
   app load; wall up = service nav locked, community open. Signing each required document
   drops `pending`; staff get a notification per signed document (both co-owner inboxes,
   `mirror_admin_notification` trigger).
9. Horse intake (`/app/horse-intake`, HorseIntakePage): `create_horse_record` →
   `ensure_horse_documents` (guard: HORSEDOCS 87f3219) — horse-linked releases assigned.
   Affiliations re-derive on document and horse writes (`trg_apply_affiliations_on_doc`,
   `trg_apply_affiliations_on_horse` — trigger map, this task's psql pass).

NOTIFIES     Invitation email (`admin-send-invitation` / shared template) · per-signature
             staff notifications (in-app; emailed only by the daily
             `/api/notifications-nudge` digest) · no email tells the INVITEE anything after
             activation except executed-document delivery (contracts.md).
TERMINAL     `invitations.status='redeemed'` (prod: 5 `accepted`… see BREAKS 6) ·
             `my_wall_state = {wall:false, pending:0}` · `contact_required_documents` all
             satisfied or skipped (CLOSEOUT §1.6 skip machinery) · categories derived.
VARIANTS
- **Minor/guardian**: `contacts.is_minor_contact` + `contacts_minor_no_email_guard_trg`
  (trigger map); deliveries address the guardian (task C10, 626ada6).
- **Company vs personal**: provisioning always creates a person; company identity is
  display-time only (`DUAL_IDENTITY_TRACE.md` §0 — is_company, never email match).
- **Already-activated**: CLOSEOUT §1.3 branch, proven.
- **Resend vs regenerate**: `admin-resend-invitation` (same token) vs regenerate (new token,
  supersedes) — two deliberate acts (endpoint header).
- **Skip**: staff can skip a required document with a reason; skip clears wall and lock gate,
  never reads as signed (CLOSEOUT §1.6, walk16).

BREAKS
1. **UNPROVEN — no real send has ever been demonstrated.** All email claims here are
   code-read; `RETEST-CHECKLIST.md` steps 3–4 are the proof. (Standing since FLOW-PROGRAM
   "wave 1 built but not walked".)
2. **BROKEN (re-proven this trace)** — the onboarding payment card is still single-SKU:
   prod `my_onboarding_state` builds the order as
   `'tier_label', (SELECT pi.label … ORDER BY pi.created_at DESC LIMIT 1), 'amount', pu.amount`
   (function body read live, this task) — one arbitrary label carrying the whole total.
   FLOWTRACE item 2, unchanged.
3. **Inherited (FLOWTRACE §6, not re-walked)** — the wizard has no booking step; the agreed-
   lesson panel at provisioning (CLOSEOUT §3.5) covers the phone-call case only; a client
   activating without an agreed time still meets no calendar until they find `/app/calendar`.
4. **BROKEN (design gap, CONTRACTWALK §3, re-checked against the same predicate)** — the
   profile gate is all-or-nothing: nothing tells the client *which* of the four fields is
   missing.
5. **UNPROVEN** — every render claim (screens, wall behaviour in a browser): no browser
   session; RETEST steps 25–26 own it.
6. **Status-vocabulary drift (new, this trace)** — prod invitations read
   `accepted 5 / sent 1 / revoked 6 / superseded 2`; the spine's own writers say `redeemed`.
   One of the two vocabularies is being translated somewhere; any reader filtering on
   `redeemed` sees zero. Recorded, not chased (query: invitations GROUP BY status).

---

## F2 — Self-onboarding funnel (`/sign/*`, "kiosk generation 2")

TRIGGER      A visitor opens `/sign` or a deep link `/sign/guest|rider|horse|rider+horse|deal`
             (SURFACE-INVENTORY §1: URL-ONLY, zero inbound links — re-verified this trace:
             the only `to="/sign"` anchors are SignStart's own, `SignStart.tsx:345,365`).
ACTORS       visitor · system: `api/sign-start.ts`, mail provider.
PRECONDITION None (anonymous). Rate limit 10/hour per requester hash.

SEQUENCE
1. Visitor picks a path and types name/phone/email (all required —
   sign-start.ts §2). POST `/api/sign-start`.
2. `sign_start_register_attempt` rate-gates (requester hash, never the email).
3. Non-deal paths: the **same** `provision_client_invitation` spine as F1
   (sign-start.ts, provision call with `p_categories` from the path map, no offerings) —
   "one flow, two initiation points" holds. Repeat email = resume (same contact, fresh
   token).
4. The **same** activation email as F1 (shared `_lib/invitationEmail.ts`); real outcome
   rendered to the visitor (`sent | send_failed | rate_limited | unavailable`).
5. Every attempt writes `signup_attempts`; the "I never received it" link posts
   `/api/signup-help` → staff in-app notice + ops-inbox email + `signup_alert_sends` row.
6. From activation on, identical to F1 steps 5–9.
   → *The visitor sees the send-state screen; staff see NOTHING unless the visitor
   escalates — see BREAKS 2.*

VARIANTS     **`deal` path** — claims an existing contract instead of provisioning:
             `find_claimable_contract` by email → `fill_claimant_details` (blanks only) →
             `invite_contract_counterparty` → CONTRACT_INVITE email → activation lands on
             the document (contracts.md F10). Response is identical whether or not a
             contract matched (anti-oracle, by design).
NOTIFIES     Activation email to the visitor; ops-inbox email only on self-escalation.
TERMINAL     Same as F1; plus one `signup_attempts` row per attempt (prod: **0 rows ever** —
             the funnel has never been used, consistent with it being unreachable).
BREAKS
1. **BROKEN (wiring, re-proven)** — zero inbound links anywhere in `src/` to `/sign/*`.
   Fully built, live in prod, unreachable except by typed URL. (FLOWTRACE §12 finding,
   still true at `c56559e`.)
2. **BROKEN (visibility)** — a successful self-onboarding tells NO staff member anything:
   no request row, no in-app notice, no ops email (only the failure path escalates via
   signup-help). A person can provision themselves and appear in Records unannounced.
   D19-corollary: a step nobody can see.
3. **UNPROVEN** — send outcomes and screens (no browser, no real send).

---

## F3 — ~~Visit-day release kiosk (`/release`) and the guided participant flow~~ · 🔒 RETIRED

> 🔒 **RETIRED 2026-09-01 — TASK-SIGNFLOW-D. THE TRACE BELOW IS HISTORY, NOT CURRENT BEHAVIOUR.**
> Owner: *"we dont use docs/release-participant nor /release, those urls if they are still operational
> should be traced and most likely anything associated with them should be decommissioned and the
> /sign/ flow should be the single pathway we use"*, and — the ruling that settled it —
> *"we dont have a situation where a person without an account signs documents on an ipad or any
> other way."*
> **REMOVED:** the three routes from `src/App.tsx`; `api/sign-release.ts`; `src/pages/Release.tsx`;
> `src/pages/DocsParticipantFlow.tsx`; the release seams in `src/lib/ops/api-public.ts`; the Review
> page's slot D. **`anon` EXECUTE revoked on `sign_release` and `sign_general_release`
> (`20260902T0010`) — this flow was the ONLY reason an unauthenticated caller could write an
> executed document.**
> **KEPT (D32):** every executed document, signature, contact, client and delivery row this flow
> created, and both function bodies.
> ⚠️ **MEASURED BEFORE REMOVAL, from production:** 40 signatures (`signatures.method='KIOSK_TYPED'`,
> and `sign_release` is its only writer), **10 real signers**, 2026-07-13 → **2026-08-15**, four
> documents each — **every one of them through `/docs/release-participant`. The single-document
> `/release` kiosk produced NOTHING, ever.** The delivery rows number **28**, not the 35 the
> flow register claimed.
> 🔒 **THE INCUMBENT IS `/sign/rider`**, whose `sign_path_document_requirements` set is EXACTLY the
> four documents this flow produced (RELEASE_PARTICIPANT · FACILITY_RULES · COMPANY_POLICIES ·
> HUMAN_EMERGENCY_MEDICAL). ⚠️ **What is genuinely GONE is same-moment, no-account signing** — a
> walk-in now gives an email, activates an account and signs there.
> ⚠️ **BREAKS 1 and 2 below are moot: the surface they describe no longer exists.**


TRIGGER      `/release` (QR/typed URL; only in-app link is the ⚠-flagged Review nav row —
             SURFACE-INVENTORY §1 `/release` row) · `/docs/release-participant`
             (externally sent link).
ACTORS       walk-in visitor · system: `api/sign-release.ts`, `api/deliver-documents.ts`.
PRECONDITION None (sessionless by design).

SEQUENCE (single release, `/release`)
1. Visitor fills identity + emergency contacts, types signature. `Release.tsx:205` → POST
   `/api/sign-release` (server-side; the old unauthenticated `deliver-document` call was
   closed by H2).
2. `sign_release` RPC creates the document, seals the signature, and executes when the
   single signer has signed — `UPDATE documents SET status='EXECUTED', …` **without naming
   `workflow_state`** (prod body, sign_release line ~229 of the functiondef read this
   trace). See fulfilment.md F14-BREAKS-2 for what that skips.
3. `deliverExecutedDocument()` runs in-process — the signer is emailed their copy;
   `document_deliveries` row written after a real send.
   → *The visitor sees the confirmation + print affordance. Staff see NOTHING.*

SEQUENCE (guided 4-document participant flow, `/docs/release-participant`)
1. Four documents signed through four `sign-release` calls with `hold_set: true` (one
   combined email instead of four — ONBOARD §4, endpoint header).
2. Final signature → one POST `/api/deliver-documents` with the full id list
   (`DocsParticipantFlow.tsx:219`).
3. Then — unlike `/release` — the flow files an inbox item: `submitRequest(channel:'kiosk',
   category:'general', status new)` (`DocsParticipantFlow.tsx:229-236`), which fires the
   staff + buyer alert emails (F5 spine).

NOTIFIES     Executed-copy email to the signer (both variants). Staff alert **only** on the
             participant variant.
TERMINAL     Executed documents (prod: 51 executed docs incl. the kiosk's 28+); participant
             variant adds one `requests` row (`channel='kiosk'`; prod: 9).
BREAKS
1. **BROKEN (visibility, sharpened since FLOWTRACE §12)** — `/release` today creates **no
   request row and no alert of any kind**: `sign_release`'s prod body contains zero
   references to `requests` (grep of the functiondef, this trace) and `Release.tsx` never
   calls `submitRequest`. FLOWTRACE's "6 of 7 kiosk requests unworked" has become "a
   walk-in signer produces only a document nobody is told about". The 9 kiosk-channel
   request rows in prod all came through the participant flow or predate this shape.
2. **BROKEN (wiring)** — `/release`'s only in-app entrance is the temporary admin Review
   nav (URL-ONLY per SURFACE-INVENTORY); the kiosk commerce half (BUILD_TRACKER section D)
   is accurately unbuilt (FLOWTRACE §12, inherited).
3. **UNPROVEN** — the delivery email (real send never observed).
