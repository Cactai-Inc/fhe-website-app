# FHE App — Complete Enumeration (every item, flat, with status)

Companion to AUTHORITATIVE-SPEC.md. This is the exhaustive flat list — every decision, requirement, and detail as a discrete checkable line. Nothing summarized. Status per line.

Legend: DONE / DEFECTIVE / MISSING / PARTIAL / CC (Claude Code lane) / VERIFY (confirm against code) / CONSTRAINT (rule, not a build item) / SUPERSEDED.

## A. App shape & navigation
A1. Two rider surfaces only: Main + Account — DONE
A2. Early Dashboard/Community/Directory/Library/Resources as top-level destinations — SUPERSEDED (now views within the two surfaces)
A3. Rider nav is avatar-menu only, no rail — VERIFY
A4. Instructor/admin get persistent desktop left rail — VERIFY
A5. Rail labeled "Servicing" for trainers (isTrainer) — VERIFY
A6. Rail labeled "Management" for admin (isAdmin) — VERIFY
A7. Roles USER/EMPLOYEE/MANAGER/ADMIN/SUPER_ADMIN from profiles.role — CC/VERIFY
A8. AuthContext exposes isAdmin/isStaff/isTrainer/isSuperAdmin — CC/VERIFY
A9. TRAINER role is admin-only at launch; no trainer self-serve flows — CONSTRAINT
A10. Header logo mark + wordmark; logo tap → Main — VERIFY
A11. Header universal borderless "+" create for all user types — VERIFY
A12. Header calendar icon — VERIFY
A13. Notifications shown on avatar badge — VERIFY
A14. Rail must be role-filtered: rider none, instructor Servicing only, admin Management only, super-admin platform set — DEFECTIVE (currently shows platform + admin nav together)
A15. Sign out available in avatar menu (and in Account) — VERIFY

## B. Community feed
B1. Single filterable stream on Main — DONE
B2. View dropdown order locked: All, Social, Discussions, For Sale, Events, Articles, Resources, Members — DONE
B3. All is default combined view — DONE
B4. Sort options depend on active view — DONE (data); VERIFY (rendered)
B5. Sort — all: Latest activity, Chronological — DONE
B6. Sort — social: Latest, Most liked — DONE
B7. Sort — discussions: Latest activity, Newest, My discussions — DONE
B8. Sort — for_sale: All, Horses, Gear, Free — DONE (Free here is a sort/price filter, not a create category — see D9)
B9. Sort — events: Upcoming, Newest — DONE
B10. Sort — articles: All audiences, General, New riders, Advanced riders, Competition riders, Trail riders, Horse owners — DONE
B11. Sort — resources: All, Vets, Farriers, Suppliers — DONE
B12. Sort — members: A→Z, Z→A, Recently joined — DONE
B13. Per-view unseen-in-feed count badges — PARTIAL/VERIFY
B14. All view has no unseen badge — VERIFY
B15. Unseen counts from seen flag; live path only social + for-sale drive counts — CC/VERIFY
B16. Adaptive layout — Members → roster + tap-to-contact — VERIFY
B17. Adaptive layout — For Sale → square grid — VERIFY
B18. Adaptive layout — Articles → reading list — VERIFY
B19. Adaptive layout — Resources → listing cards — VERIFY
B20. Adaptive layout — default → masonry cards — VERIFY
B21. Federated feed pulls each view's real source (feed_get, fetchThreads, fetchEvents, fetchContentPosts, fetchResources, fetchMemberDirectory) — CC/VERIFY
B22. Seed is fallback only, gated by SEED_ENABLED — DONE
B23. No surface shows the same "latest" twice — VERIFY
B24. Members roster tap-to-contact uses shared contact fields (mailto/wa.me/sms/tel via contact.ts) — DONE (client); CC (directory RPC must expose fields)

## C. Create ("+") modal
C1. Two-step: Step 1 destination (community post / book / shop / message) — PARTIAL
C2. Step 2 for community post: type (Social / For Sale / Event / Discussion) — PARTIAL
C3. Minimal type-specific form per post type — PARTIAL
C4. Upload one media + description — VERIFY
C5. Discussions require no media — VERIFY
C6. EVENT branch invite-scope chooser: everyone vs specific people — MISSING
C7. Social create wired to feedPostCreate + uploadFeedMedia — CC/VERIFY
C8. Discussion create wired to createThread — CC/VERIFY
C9. Event create wired to proposeEvent — CC/VERIFY
C10. Create menu adapts to user type (riders full list; non-rider clients short; operators theirs) — VERIFY

## D. For Sale / marketplace
D1. For Sale create listing types are Horse and Gear only — DEFECTIVE (Free wrongly present as a type)
D2. Claude's UI create offers GEAR only; horse listing entry belongs to horse-records thread — DEFECTIVE (remove horse free-text path)
D3. No free-text "Horse" type with no record connection — DEFECTIVE (present, remove)
D4. No ad-hoc sale-vs-lease field in Claude's create — DEFECTIVE (remove)
D5. Horse listings are produced from a real horse record by the other thread — CONSTRAINT
D6. Listing prefill pulls descriptive fields only (name/breed/height/age/color/discipline/photo), never parties/terms — CONSTRAINT (other thread)
D7. Listing rights: non-admin/non-instructor may only list a horse on their own account record (owner/lessee/lessor party); admins/instructors exempt — CC
D8. For Sale feed view renders as square grid — VERIFY
D9. "Free" is a PRICE STATE of a gear item, not a listing category — DEFECTIVE (must be reworked as price state everywhere in create)

## E. Calendar
E1. Calendar icon opens a LARGE modal — DEFECTIVE (modal is small/list)
E2. Default view is an ACTUAL month grid — DEFECTIVE/MISSING (only list built)
E3. View switcher: month / week / day / list — MISSING (month/week/day)
E4. List is one refinement option, not the whole calendar — DEFECTIVE (list is the whole thing, mislabeled "Your calendar")
E5. Aggregates everything dated whether RSVP'd or not: lessons, events, payments/billing due, confirmations, expirations (holds/documents) — DONE (kinds present in aggregation)
E6. Dates legible on day cells/columns with time, not buried in gray subtitle — DEFECTIVE
E7. Live sources: myLessonSessions + fetchEvents — CC/VERIFY
E8. Payment/expiration/confirmation real sources wired — CC (currently seed only)
E9. Seed fallback (SEED_CALENDAR) only when live empty + SEED_ENABLED — VERIFY
E10. Seed calendar items must have real start AND end times (no identical start=end "9:00 AM · 9:00 AM") — DEFECTIVE
E11. Renderer must not emit identical start=end ranges — DEFECTIVE

## F. Account — You
F1. Profile & preferences section exists — VERIFY
F2. Contact: Email always present, hideable from community, never hidden from operator — VERIFY
F3. Contact: Mobile — number + Text checkbox + Call checkbox + hideable — VERIFY
F4. Contact: WhatsApp — number + Text checkbox + Call checkbox + hideable — VERIFY
F5. NO field labeled "Phone" (fields are Email, Mobile, WhatsApp) — VERIFY
F6. Social accounts SEPARATE from contact — VERIFY
F7. Social: TikTok (handle/URL + hideable) — VERIFY
F8. Social: Instagram (handle/URL + hideable) — VERIFY
F9. Social: Facebook (handle/URL + hideable) — VERIFY
F10. Social: LinkedIn (handle/URL + hideable) — VERIFY
F11. Notification preferences (payment reminders, reply/event toggles) — VERIFY
F12. Login & security: password management — PARTIAL/CC
F13. Login & security: change email (state machine §G) — PARTIAL/CC
F14. Login & security: switch to Sign in with Google (conditional) — PARTIAL/CC
F15. My posts — manage view (edit/delete) — VERIFY
F16. My posts distinct from read-only Directory/Members view — VERIFY
F17. Saved items — DONE
F18. Documents render as PAPER (PaperViewer) — DONE
F19. Documents contain signed agreements/releases — VERIFY (content source CC)

## G. Email-change / auth state machine
G1. "Google-based" not inferable from domain (Workspace custom domains are Google-based) — CC
G2. @gmail → Google path — CC/VERIFY
G3. Non-gmail → show "Google-hosted" checkbox / real Google check — CC
G4. Google path: re-auth modal, NO verification email — PARTIAL/CC
G5. Non-Google path: set password (both inputs clear-text/visible, must match) — PARTIAL
G6. Non-Google path: "verification sent, check spam" → standalone /verify-email screen — PARTIAL
G7. DB stores current/new/old email — CC
G8. Atomic promotion on verify; no expiry — CC
G9. Seam callbacks: startGoogleChange, startPasswordChange, verifyWithPassword, verifyWithGoogle — CC (see HANDOFF-email-change.md)

## H. Account — Billing & orders
H1. Billing (next payment, history) — VERIFY/CC
H2. Membership types: monthly / annual / pay-as-you-go — VERIFY
H3. Pay-as-you-go is a valid state (not subscribed, pays per booking) — VERIFY
H4. Orders (past purchases, receipts) — VERIFY/CC
H5. Payment method: Zelle on file — VERIFY
H6. Payment method: update — VERIFY/CC
H7. Payment method: payment-responsibility transfer — VERIFY/CC
H8. Gifts: resend — DONE (GiftsPanel)
H9. Gifts: time-delay — DONE/VERIFY
H10. Gifts: transfer payment responsibility — DONE/VERIFY
H11. Gifts: recipient-linking — DONE/VERIFY

## I. Account — Help
I1. Support — VERIFY
I2. Sign out here and in avatar menu — VERIFY

## J. My Stable
J1. Three groups: Horses, Gear, Supplies — CONSTRAINT (horses relocated, see K)
J2. Horses section in Claude's My Stable is placeholder only; canonical record owned by horse-records thread — CONSTRAINT
J3. Do not build a competing horses table or horse intake in Claude's My Stable — CONSTRAINT
J4. Gear items retained (Claude's lane) — DONE
J5. Supplies items retained (Claude's lane) — DONE
J6. Each gear/supply item can link a vendor — DONE
J7. Vendor selected from Resources directory OR added new via same vendor form — DONE
J8. Optional share-back of new vendor into Resources — DONE
J9. Stable item form fields — Category from a common-type list — DEFECTIVE (currently single "detail" field)
J10. Common gear/supply category list provided (saddle, bridle, girth, stirrups/leathers, saddle pad, half chaps/boots, helmet, gloves, breeches, show coat, blanket/sheet, supplement, grooming supply, first-aid, other) — MISSING (list not built)
J11. Stable item form — Size, conditional (shown only for sized items: boots, saddle, helmet, breeches, half chaps) — DEFECTIVE/MISSING
J12. Stable item form — Where bought (framed as where-bought, not "reorder from") — DEFECTIVE
J13. Stable item form — Price paid (optional) — MISSING
J14. Stable item form — Notes (optional) — MISSING
J15. Remove "vendor you reorder from" barn-ops framing for personal items — DEFECTIVE

## K. Horse records boundary (cross-thread)
K1. ONE canonical horse records table = existing repo table — CONSTRAINT
K2. NOT a separate stable_horses table — CONSTRAINT
K3. Claude's migration must DROP stable_horses and stable_horse_parties — ACTION (20260710030000_my_stable_vendors.sql)
K4. Migration KEEPS only vendors + stable_items — ACTION
K5. Agreements/horse-records thread authoritative for: the record — CONSTRAINT
K6. …the horse intake form + fields (from real lease/purchase-sale doc data) — CONSTRAINT
K7. …the horse section of the account page — CONSTRAINT
K8. …the listing↔record wiring — CONSTRAINT
K9. Claude's AddHorseModal / My Stable horse section / listing horse-selector superseded — SUPERSEDED
K10. Three creation paths (other thread): agreement find-or-create; onboarding intake (lesson pack not using barn horses); manual add (no documents) — REFERENCE
K11. Listing rights rule (K/D7) enforced backend — CC
K12. HANDOFF-horse-records.md arbitrates so Claude Code gets no conflicting instructions — PROCESS

## L. Mobile
L1. Fixed device frame; exactly one scroll region per screen — VERIFY
L2. Never whole-app scroll; never nested scroll — VERIFY
L3. Main: single scroll region is the feed — VERIFY
L4. Main: pinned next-ride strip is the first feed item — VERIFY
L5. Header pinned; FAB/create floats — VERIFY
L6. Multi-area pages use fixed in-page segment switcher + one scroll region — VERIFY
L7. Avatar menu is a scrollable overlay (its own single scroll region) — VERIFY
L8. Mobile pages show eyebrow + serif title at top — VERIFY

## M. Theme & formatting
M1. Warm light theme, cream canvas #faf8f4 — VERIFY
M2. Forest green ink/accent green-800 #143321, green-900 #0d2118 — VERIFY
M3. Gold warmth gold-600 #ba9935, gold-800 #7a6421 — VERIFY
M4. Cormorant Garamond serif titles; Inter body — VERIFY
M5. Dark mode deferred — CONSTRAINT
M6. One nav pattern throughout — VERIFY

## N. Seed data hygiene
N1. Seed reads as clearly sample, not broken real data — DEFECTIVE
N2. Fix internal inconsistencies (multi-hour "lesson" artifacts, mismatched amounts, identical start=end) — DEFECTIVE
N3. Empty states render cleanly when SEED_ENABLED=false — VERIFY
N4. SEED_ENABLED gates all fallbacks in one place — DONE
N5. Retirement: set SEED_ENABLED=false then delete seed.ts once RPCs return real rows — DONE (mechanism)
N6. Teardown migration idempotent, [SEED]/seed_tag markers, transaction-wrapped, never drops schema — CC/VERIFY

## O. Backend confirmations (CC lane)
O1. RLS allows admin UPDATE profiles.role, or SECURITY DEFINER admin_set_role RPC — CC
O2. supabase.rpc('current_org') exists — CC
O3. Directory/member RPC widened to expose shared contact fields — CC
O4. Feed federation fns return rows (feed_get, fetchThreads, fetchEvents, fetchContentPosts, fetchResources, fetchMemberDirectory) — CC
O5. Calendar payment/expiration/confirmation sources wired — CC
O6. adminSetRole (admin.ts) writes profiles.role — CC/VERIFY
O7. stable.ts client contract matches backend (My Stable + vendors) — CC/VERIFY

## P. Process / delivery
P1. Lane split: Claude owns UI/UX + "⇢ WIRE" seams; Claude Code owns DB/RLS/RPC/auth/wiring — PROCESS
P2. Every delivery includes a placement map (new vs replacement, exact repo path, what to Claude Code) — PROCESS
P3. Handoff docs arbitrate cross-thread schema — PROCESS
P4. Deliver one complete bundle, complete non-partial files — PROCESS
P5. Sale/transfer agreement flow BLOCKED until owner provides same-source purchased reference doc; do not author from scratch — CONSTRAINT

## Defect/gap roll-up (every non-DONE build item Claude owns)
Calendar: E1, E2, E3, E4, E6, E10, E11.
Events: C6.
Create/marketplace: D1, D2, D3, D4, D9.
Stable item form: J9, J10, J11, J12, J13, J14, J15.
Rail role gating: A14.
Migration: K3, K4.
Seed: N1, N2.
Partial (finish + verify): C1, C2, C3, B13, F12, F13, F14, G4, G5, G6.
