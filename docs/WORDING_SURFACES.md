# Wording Surfaces — client / customer / member (D3 inventory)

**Stage 1d verify-first output (2026-07-27, Thread R).** Every USER-VISIBLE
occurrence of client/customer/member, tagged **ops-only** (staff/admin surfaces),
**member-facing** (rendered to members/guests about themselves or each other),
**public** (pre-login site), or **signed-document** (contract/legal bodies —
wording owned by the separate contract thread, out of remediation scope).
D3 rule being enforced: members must see "Member", never "Client"; "client" is
staff/ops display; "customer" only in gift/product-only contexts.
Method: word-boundary grep over src/ (613 raw hits) + api/ (34) filtered to
rendered strings; SELECT-only sweep of contract_templates / clause / section /
field defs; pg_proc string-literal sweep for DB-generated UI text.

## ⚑ FLAGS — member-facing "Client" (D3 violations, for owner disposition)

| # | Location | Text | Note |
|---|---|---|---|
| F1 | `src/pages/Release.tsx:231` | "This document is signed in your **client** account — sign in or use your invitation link." | Kiosk screen addressed TO the person about their own account. Clear violation. |
| F2 | DB fn exception strings surfaced as member error toasts: `attach_booking_horse`, `book_open_slot`, `request_open_time` → "no **client** profile"; `request_horse_intake` → "this booking has no client account to notify" | Member-reachable error paths (booking/requesting are member actions). | Violation on the error path. |
| F3 | `src/pages/app/CalendarPage.tsx:271,908` | fallback name literal `'Client'` on roster/pending rows | Shared member+staff surface; the fallback can render for members. Verify context when Stage 3/4 touches the calendar; safest fix is 'Member'. |
| F4 | `src/components/app/HorseIntakeForm.tsx:622,627` | "Select the **client** account…" / "…owned by the selected client." | Renders only in the staff-assign branch, but the form itself is member-used — keep the strings inside the staff-only branch when touched. Borderline. |

**Public-page borderline (owner tone call, not a D3 violation):**
`PublicIntakeForm.tsx:42` "I'm a returning client"; `BookSupport.tsx:148` "Many
of our clients combine…". Public visitors are not yet members; D3 does not
strictly govern, but the owner may want tone consistency.

## Member-facing — compliant today (uses "member"/"Member")

- Fallback display name 'Member' (12 sites: AppLayout:393, CommunityFeed:204,
  PostModal:33,163, communityFeed.ts:101,120,164, Messages:81,273,316,
  ThreadDetail:9, MemberProfile:27,52 + Profile.tsx:123) and DB fns
  (`contract_message_post`, `feed_get` 'Member'; `member_display_name`
  'A member').
- Community chrome: "Members" view + directory copy (seed.ts:26,36,38,41,42;
  CommunityFeed:223,367), AppOverviewModal:30,38, Messages pickers
  ("Search members…", "No members found."), MyPosts visibility labels
  ("Members only" / "Members & public"), composer visibility option "Members"
  (CreateModal:291, FeedComposer:173), AccountHub:212 "New member welcomes",
  `say_hi` error "members must be in the same community",
  `create_horse_record` error "an authenticated member account is required…".
- Login/entry: "Members" eyebrow (Login:105, ForgotPassword:30,
  ResetPassword:51), "Member Area" (Header:271,322; Footer:109).
- "staff member"/"team member" phrasings (Release:149,209,
  DocsParticipantFlow:149,243, SchedulePage:61,162, StaffPage:65-128,
  admin.ts:120, api/hard-delete-client.ts:56) — refers to staff, not members;
  compliant.

## Ops-only — "client" as staff vocabulary (compliant under D3)

Staff nav "Clients" (AppLayout:112; grants.ts:16); CreateModal staff section
(:415-417); ProvisionClientForm:203; DeliveryPanel:44 "Client portal";
Admin.tsx Clients page (502,521,653,657,662,717,727,740) + account grid row
"Member · {tier ?? 'member'} · status" (Admin.tsx:205 — NOTE: displays
`members.tier`; becomes a 1g rewire site); AccountInvitePage:13,18,20;
ContactsPage chips/copy (45,47,180,267); TeamPage (50-51,214-228,275-281);
IntakePage (66,519-520,671); SupportPage:58 ("Member support requests" — about
members, shown to staff; fine); OversightPage:13 tab "Members";
EvaluationReportsPage (47,73-74,93,108,110,146); AdminFormsPage:20
"Client-facing"; lessons suite (SessionsPage:148,166, ScheduleSessionForm:61,
83,93,164, LessonCreditsPage:64,82,93,258,291,311,319,357, LessonsHubPage:94);
InstructorHome:44,116,123; CalendarItemPanel staff panel (304,308,337,340,357,
371,437); TenantDetailPage:125,143,169 (superadmin, "members" descriptive);
DB staff notifications ("A client added their horse to their session",
"A client requested {time}", "A client submitted their acquisition intake") and
staff-called fn errors (`schedule_lesson_session` "unknown client" etc.).

## "customer" — one hit in the whole system

`AdminProductsPage.tsx:540` "The catalog customers see, and the internal price
book." Ops-only surface; D3 reserves "customer" for gift/product-only contexts —
this is the product catalog, arguably conformant; flag to owner only if they
want "customer" excluded from ops vocabulary too.

## Email layer — CLEAN

Zero user-visible client/customer/member strings in any api/ subject or body
(all 34 raw hits are comments/identifiers).

## Signed-document surface (contract thread's lane — inventory only)

- "client(s)" appears in 14 of 26 `contract_templates` bodies, overwhelmingly as
  the ALL-CAPS defined party term CLIENT and `{{CLIENT.*}}`/`{{SIG.CLIENT.*}}`
  tokens. Counts: FACILITY_RULES 53, HORSE_EMERGENCY_VET 50, RELEASE_GENERAL 50,
  RELEASE_HORSE_CARE 49, HUMAN_EMERGENCY_MEDICAL 46, COMPANY_POLICIES 38,
  RELEASE_PARTICIPANT 34, RIDER_LESSON_JUMPER 32, HORSE_SEARCH_RETAINER 26,
  HORSE_TRANSACTION_REP 24, EVALUATION_LIABILITY_WAIVER 22,
  RELEASE_JUMPER_ADDENDUM 18, HORSE_EVALUATION 3, MINOR_RIDER 1.
- Lowercase-prose pattern: "…by the undersigned client (\"CLIENT\")…" preamble in
  12 templates; scattered prose in HORSE_EVALUATION ("The requesting client…"),
  COMPANY_POLICIES ("Client equipment and farrier…"), MINOR_RIDER ("At
  client-owned facilities").
- `party_label()` renders `'CLIENT' → 'the Client'` in contract UI text.
- HORSE_LEASE_V2 structured engine: only "family members" (clause
  INSURANCE_RISK.DEFINITIONS; field option "Lessee's family members") — benign.
- Zero "customer"/"member-as-status" in any template body; zero hits in all
  HORSE_LEASE_V2/purchase/transfer/training bodies.
