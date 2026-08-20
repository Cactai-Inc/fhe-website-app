# SURFACE-INVENTORY — every routed surface, its reach, its CRUD, its write paths

**Audited: main @ `60eab08` (2026-08-19). Source-only — no production DB access.**
Method: `docs/tasks/TASK-REACHAUDIT-surface-and-crud-inventory.md` §4. Grounding reads (once each):
`src/App.tsx`, `src/lib/pageRegistry.ts`, `src/components/app/AppLayout.tsx` nav tables
(`MANAGEMENT_GROUP`/`ACCOUNTS_GROUP`/`COMMUNITY_GROUP`/`MODULES_GROUP`/`SETTINGS_GROUP`,
`ClientNavItems`, `StaffNavItems`, `PLATFORM_NAV`), `src/lib/reviewSection.ts`,
`src/components/layout/Header.tsx` + `Footer.tsx`. Link graph: one `grep -rn` pass for
`to=|navigate(|href=` across `src/` (197 hits). Write-class: a script walked every exported
function in the 19 general (`src/lib/*.ts`) and 17 ops (`src/lib/ops/api-*.ts`) data-access
modules, classifying each by whether its body chains a mutation method
(`.insert/.update/.delete/.upsert`) directly off `.from('table')` (**RAW-TABLE-WRITE**) or calls
`.rpc('name')` (**ENGINE-RPC**, further split by whether the RPC name itself reads as a mutation)
— 76 raw-write functions, 327 RPC-backed functions. Every page file was then grepped for calls to
either set, giving file:line-traceable CRUD attribution without re-opening `App.tsx` per route.

**Column key:** reach = `NAV:<rail/group, file:line>` · `LINK-ONLY:<linking page(s)>` ·
`URL-ONLY` · `ORPHAN` (routed, zero links in). Write class = **ENGINE-RPC** (calls a DB function)
· **RAW-TABLE-WRITE** (PostgREST `.insert/.update/.delete` straight on a table) · **MIXED**.
D19 = states-itself-first / captures-reason / records-reference / undoable, each Y or N.

---

## 0. Reach map, established once (cited by path below, not re-derived per row)

**Public marketing nav** — sitewide, not gated:
- Header `NAV_LINKS` (`src/components/layout/Header.tsx:38-45`): Our Community→`/story`, Horse Care
  Services→`/horse`, Find a Horse→`/acquisition`, Book a Lesson→`/lessons`. Plus a persistent
  "Say Hello"→`/contact` (Header.tsx:278,323) and Member area/Sign in→`/app` or `/login`
  (Header.tsx:336,343).
- Footer nav (`src/components/layout/Footer.tsx:54-87`): Home, Our Community, Book a Lesson, Horse
  Care, Acquisition Support, Gift a Service, Member area/sign-in, FAQ.

**Member nav** (`ClientNavItems`, AppLayout.tsx:1079-1114, + `AccountNavLink`/`CommunityNav`):
Community Feed, Dashboard, Calendar, My Lessons*, My Orders*, Catalog, My Documents*, Messages, My
Posts*, My Stable*, My Saved Items*, Account. (*presence-gated via `my_nav_presence()`.)

**Staff nav** — `StaffNavItems` (AppLayout.tsx:1126-1135: Calendar, Catalog, Messages) +
`manageNavGroups()` (AppLayout.tsx:617-659), which returns:
- **Management**: Dashboard, Records, Support, Payment review (4 rows — MANAGEMENT_GROUP,
  AppLayout.tsx:490-525)
- **People** (`ACCOUNTS_GROUP`): **empty** — kept for a future row, drops from render
  (AppLayout.tsx:537)
- **Community**: Activity, Evaluations, Moderation, Field options, Content store, Oversight
  (COMMUNITY_GROUP, AppLayout.tsx:541-552)
- **Modules**: Boarding, Barn Ops, Employees (MODULES_GROUP, AppLayout.tsx:553-570)
- **Settings**: Team, Branding, Products, Forms, Templates (SETTINGS_GROUP, AppLayout.tsx:571-607)
  — **rendered only via the `/app/ops/settings` and `/app/ops/modules` card pages, filtered out of
  the sidebar itself** (AppLayout.tsx:639-652 comment) — same source, two different presentations.

**Platform (superadmin) nav** — `PLATFORM_NAV` (AppLayout.tsx:474-478): Organizations, Feature
flags, Registry. Superadmin also gets the header wordmark linking to Organizations
(AppLayout.tsx:1707).

**Review section nav — DEAD.** `reviewSection.ts` exports `REVIEW_NAV_ITEMS`
(reviewSection.ts:321-326), built from `REVIEW_GROUPS`, but **nothing imports it** — grepped
across `src/`, its only reference outside its own file is a stale AppLayout.tsx comment
(line 459). `navGroups` (AppLayout.tsx:1466-1471) is built from `manageNavGroups()` alone. So
every `/app/ops/review*` route has **zero nav row of any kind** — reachable only by typing the URL
or by a link from `ReviewIndexPage` itself. Classified **URL-ONLY** below, per the task's own
instruction not to propose deleting this section (item W13).

---

## 1. Public / marketing surfaces (Layout chrome, ungated unless noted)

| path | component | registry | reach | role gate | name check | CRUD | write class | D19 | ledger reads |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Landing.tsx | NONE | NAV: Header logo, Header.tsx:189; Footer "Home" | public | OK | R | — | — | none |
| `/about` | About.tsx | NONE | LINK-ONLY: Confirmation.tsx:182 | public | OK | R | — | — | none |
| `/story` | Story.tsx | NONE | NAV: Header "Our Community", Header.tsx:41; Footer | public | ⚠ nav label "Our Community" vs route `/story` — same drift the task doc's own example class names | R | — | — | none |
| `/faq` | Faq.tsx | NONE | NAV: Footer "FAQ", Footer.tsx:83 (not in Header) | public | OK | R | — | — | none |
| `/services` | Services.tsx | NONE | LINK-ONLY: Account.tsx:122, Checkout.tsx:122, About.tsx:206, NotFound.tsx:24 | public | OK | R | — | — | none |
| `/contact` | Contact.tsx | NONE | NAV: Header "Say Hello", Header.tsx:278,323 | public | OK | R via `submitRequest` (RPC, ENGINE-RPC) | ENGINE-RPC | states-itself-first:Y (form submit is the only action) · captures-reason:Y (inquiry fields) · records-reference:N (no confirmation id surfaced) · undoable:N | none |
| `/lessons` | Lessons.tsx | NONE | NAV: Header "Book a Lesson", Header.tsx:44; Footer | public | OK | R (`fetchPublicCatalog`, `listStableHorses`) | ENGINE-RPC (read only) | — | none |
| `/horse` | BookHorse.tsx | NONE | NAV: Header "Horse Care Services", Header.tsx:42; Footer | public | OK | R + C (`submitRequest` via BookHorse→Checkout funnel) | ENGINE-RPC | see `/checkout` (funnel shares one create action) | none |
| `/acquisition` | BookSupport.tsx | NONE | NAV: Header "Find a Horse", Header.tsx:43; Footer | public | OK | R + C (funnel into `/checkout`) | ENGINE-RPC | see `/checkout` | none |
| `/gift` | Gift.tsx | NONE | LINK-ONLY: Lessons.tsx:379, BookSupport.tsx:231, BookHorse.tsx:256 (`?item=` query variants); Footer "Gift a Service" | public | OK | C (`createGift`, RPC) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y (order/gift id shown) · undoable:N | none |
| `/redeem` | Redeem.tsx | NONE | URL-ONLY (gift-code emails; `navigate('/app')` and a Contact-us link are its own outputs, nothing routes IN) | public | OK | R + U (`openGift`, `redeemGift`, both RPC) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y (redemption confirmation shown) · undoable:N | none |
| `/release`, `/release/:releaseKey` | Release.tsx | NONE | URL-ONLY (kiosk / QR / emailed link by design — see reviewSection.ts:283 "Signing D · public kiosk", flagged DESTRUCTIVE there) | public | OK | R + U (signature capture; `fetchReleasePreview`, sign RPC) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y (signed doc) · undoable:N (a signed release is not revocable from this surface) | none |
| `/docs/release-participant` | DocsParticipantFlow.tsx | NONE | URL-ONLY (guided doc-set link, sent externally) | public | OK | R + U (`fetchReleasePreview`, `submitRequest`, sign) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y · undoable:N | none |
| `/book/rider` | BookRider.tsx | NONE | **ORPHAN — zero incoming links anywhere in `src/`.** Only self-reference is its own `<Route>` declaration (App.tsx:193) and a code comment (ServiceListState.tsx:7). Matches the audit's #2 calibration instance verbatim. | public | OK | R + C (into `/checkout`) | ENGINE-RPC | see `/checkout` | none |
| `/book/horse`, `/book/support` | BookHorse.tsx, BookSupport.tsx | NONE | LINK-ONLY: BookRider.tsx:245,258 (legacy aliases of `/horse`, `/acquisition`) | public | OK | same as `/horse`/`/acquisition` | ENGINE-RPC | see above | none |
| `/questions` | Questions.tsx | NONE | LINK-ONLY: reached mid-funnel from cart state, not a nav link (self-redirects to `/checkout` when nothing in cart asks anything — App comment ASKRIGHT §A0) | public | OK | R + U (answers attach to cart, `navigate('/checkout')`) | — (client-side cart state only) | — | none |
| `/checkout` | Checkout.tsx | NONE | LINK-ONLY: every funnel's terminal step (BookRider/BookHorse/BookSupport `navigate('/checkout')`); NAV: none direct | public | OK | C (`createDraftOrder`) + R (`ensureHorseDocuments`) | **RAW-TABLE-WRITE** — `createDraftOrder`, `src/lib/api.ts` (orders table insert) | states-itself-first:Y (order summary shown before submit) · captures-reason:N · records-reference:Y (order id → `/order/:id`) · undoable:N (no cancel path found) | none |
| `/confirmation` | Confirmation.tsx | NONE | LINK-ONLY: Checkout.tsx:80 (`onSubmitted`), BookHorse.tsx:230, BookSupport.tsx (InquiryForm submit) | public | OK | R | — | — | none |
| `/login` | Login.tsx | NONE | NAV: Header "Sign in", Header.tsx:343; Footer "Member sign-in" | public | OK | R + auth | — | — | none |
| `/register` | Register.tsx | NONE | **URL-ONLY by design** — App.tsx:206 comment: "legacy links in already-sent emails redirect into the app chrome" (`/activate`). No in-app link found; that is correct, not a gap. | public | OK | U (`redeemInvitation`/`redeemContractInvitation`, RPC) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y (account created) · undoable:N | none |
| `/register/complete` | RegisterComplete.tsx | NONE | URL-ONLY, same reason | public | OK | R + U (`redeemInvitation`, `myOnboardingState`) | ENGINE-RPC | same as above | none |
| `/forgot-password` | ForgotPassword.tsx | NONE | LINK-ONLY: Login.tsx:150 | public | OK | C (password-reset email trigger) | — (Supabase auth, not app-owned tables) | — | none |
| `/reset-password` | ResetPassword.tsx | NONE | **URL-ONLY by design** — no in-app `to="/reset-password"` found anywhere; reached only via the emailed reset link, matching the pattern App.tsx documents for `/register`. | public | OK | U (password update, Supabase auth) | — | — | none |
| `/account` | Account.tsx (`ACCOUNT_PAGE_RETIRED` gate) | NONE | LINK-ONLY: OrderDetail.tsx:57,71 ("Back to your account"); redirects to `/app` when retired (App.tsx:214-216 — retired = `true` today, TASK-PAGEMERGE) | member (`ProtectedRoute`) | ⚠ every real link still says "your account" but the retired flag sends every member straight into `/app` — the destination the link promises no longer exists as a distinct page. Not a broken link (redirect resolves), but a stale mental model on every caller. | R/U (dead code path while retired) | n/a while retired | — | none |
| `/order/:id` | OrderDetail.tsx | NONE | LINK-ONLY: OrdersContent.tsx:50 (`/app/orders` list), Account.tsx:132, PaymentReviewPage.tsx:382, plus `navigate()` from Checkout.tsx:99 and CalendarPage.tsx:1012 | member (`ProtectedRoute`) | OK | R | — | — | none |
| `/redirects`: `/shop`→`/lessons`, `/ride`→`/lessons`, `/membership`→`/lessons`, `/inquire`→`/contact` | — | NONE | intentional redirects, not surfaces | public | — | — | — | — | — |
| `/verify-email` | VerifyEmailScreen.tsx | NONE | URL-ONLY (emailed verification link) | public | OK | U (email-change verification) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y · undoable:N | none |
| `/sign` | SignChoose.tsx | NONE | **URL-ONLY** — ONBOARD §1 comment (App.tsx:180-182) confirms this chooser page itself has no in-app link; the four deep links (`/sign/:path`) it fans out to are reached directly by sent-link recipients. | public | OK | R | — | — | none |
| `/sign/:path` | SignStart.tsx | NONE | URL-ONLY, same as above; internal self-links only (SignStart.tsx:345,365 → `/sign`) | public | OK | R + U (fetchPublicCatalog, sign flow) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y · undoable:N | none |
| `*` (404) | NotFound.tsx | NONE | reached by definition (any unmatched path) | public | branded, OK | R | — | — | none |

---

## 2. Member `/app/*` surfaces (`requireMember`, AppLayout chrome)

| path | component | registry | reach | role gate | name check | CRUD | write class | D19 | ledger reads |
|---|---|---|---|---|---|---|---|---|---|
| `/app` (index) | Home.tsx | NONE (App-pages block, not a NavItem table — pageRegistry.ts:127 note) | NAV: `CommunityNav`, AppLayout.tsx:921,978 (the feed itself) | member | OK — "Community Feed" is the actual front door, matches label | R + C (posts, RSVPs — `setRsvp` raw write) | RAW-TABLE-WRITE (`setRsvp`, `src/lib/community.ts`) | states-itself-first:Y · captures-reason:N · records-reference:N · undoable:N | none |
| `/app/dashboard` | DashboardHome.tsx | `mgmt.dashboard` | NAV: `ClientNavItems`, AppLayout.tsx:1084; MANAGEMENT_GROUP (staff view), AppLayout.tsx:502 | member | OK | R | — | — | none (comment-only hits, not a real read — see §0) |
| `/app/schedule` | Schedule.tsx | NONE | LINK-ONLY: `DashboardPanel.tsx:293,301` ("Schedule"/"Details" CTAs) — no persistent nav row (retired from the rail per reviewSection.ts:205, "Time B"), reached only through those two dashboard-card links | member | ⚠ still a live route with real data (`myLessonSessions`) behind a page with no rail entry — the Review section's own "time" comparison names this exact gap | R + C (`setRsvp`) | RAW-TABLE-WRITE | N/A (RSVP, not value-moving) | none |
| `/app/calendar` | CalendarPage.tsx | NONE (not in registry — pageRegistry.ts header note names this explicitly: "the App-pages block… has no row to filter") | NAV: `ClientNavItems`/`StaffNavItems`, AppLayout.tsx:1085,1130 | member | OK | C/R/U (`bookOpenSlot`, `confirmBooking`, `decideBookingChange`, `proposeBookingTime`, `requestBookingChange`, `withdrawMyPendingBooking`, `createDraftOrder`) | ENGINE-RPC + **RAW-TABLE-WRITE** (`createDraftOrder`, orders table) | states-itself-first:Y (booking summary before submit) · captures-reason:N (no reason field on change requests found) · records-reference:Y (order id) · undoable:Y (`withdrawMyPendingBooking`) | none |
| `/app/threads/:id` | ThreadDetail.tsx | NONE | LINK-ONLY: `/app?filter=discussions` feed cards | member | OK | R + C (`replyToThread`, raw write) | RAW-TABLE-WRITE | states-itself-first:Y · captures-reason:N · records-reference:N · undoable:N | none |
| `/app/members/:userId` | MemberProfile.tsx | NONE | LINK-ONLY: `/app?filter=members` feed cards | member | OK | R + C (`sayHi`, RPC) | ENGINE-RPC | states-itself-first:Y · N · N · N | none |
| `/app/messages`, `/app/messages/:userId` | Messages.tsx | NONE | NAV: `ClientNavItems`/`StaffNavItems`, AppLayout.tsx:1093,1132 | member | OK | C/R/U/D (`sendDirectMessage` raw write; `dmDeleteMessage`, `dmEditMessage`, `dmHideConversation`, `dmMarkConversationRead` RPC) | MIXED | states-itself-first:Y · captures-reason:N · records-reference:N · undoable:Y (`dmDeleteMessage`/`dmEditMessage`) | none |
| `/app/content/:slug` | ContentPostDetail.tsx | NONE | LINK-ONLY: `/app?filter=articles` feed cards | member | OK | R | — | — | none |
| `/app/documents` | Documents.tsx | NONE | NAV: `PRESENCE_LINKS` "My Documents", AppLayout.tsx:431 (presence-gated) | member | OK | R + U (signing) | ENGINE-RPC | states-itself-first:Y · N · records-reference:Y (signed copy) · undoable:N | reads `document_deliveries` indirectly via `lib/api.ts` (page itself does not query it) |
| `/app/onboarding` | Onboarding.tsx | NONE | LINK-ONLY: post-signup redirect (Home.tsx:35-41 style logic), DashboardPanel links, AppLayout.tsx:1563,1682 | member | OK | R + C/U (`attachPurchaseHorse`, `generateMyOnboardingDocuments`, `setMyOnboardingHorses`, `signMyDocument`, `updateMyOnboardingProfile`) | ENGINE-RPC | states-itself-first:Y · captures-reason:N · records-reference:Y (documents generated/signed) · undoable:N | writes (not reads) `document_deliveries` — comment at Onboarding.tsx:581 |
| `/app/book` → redirect `/app/calendar` | — | NONE | intentional redirect (Flow D retired) | member | — | — | — | — | — |
| `/app/orders` | Orders.tsx | NONE | NAV: `PRESENCE_LINKS` "My Orders", AppLayout.tsx:430 | member | OK | R | — | — | none |
| `/app/gifts` | Gifts.tsx | NONE | **ORPHAN — zero incoming links anywhere in `src/`.** `GiftsContent` (the same component this page wraps) is rendered inline instead, inside `/app/account`'s "My Gifts" accordion row (`AccountHub.tsx:203-204`) — the standalone route exists, works, and nothing ever sends a member to it. A 9th instance of the audit's own defect class, found by this method. | member | OK | R | — | — | none |
| `/app/catalog` | CatalogPage.tsx | NONE | NAV: `ClientNavItems`/`StaffNavItems`/`QUICK`, AppLayout.tsx:1091,1131 | member | OK | R + C (`navigate('/app/checkout')` on book) | — | — | none |
| `/app/checkout` | Checkout.tsx (app instance) | NONE | LINK-ONLY: CatalogPage.tsx:21 | member | OK | same as public `/checkout` | RAW-TABLE-WRITE (`createDraftOrder`) | same as public `/checkout` | none |
| `/app/lessons` | MyLessons.tsx | NONE | NAV: `ClientNavItems` "My Lessons", AppLayout.tsx:1089 (module-gated `mod.lessons`) | member | OK | R + C (MyLessonsContent → `addMyLessonNote`, RPC) | ENGINE-RPC | states-itself-first:Y · N · N · N | none |
| `/app/support` | Support.tsx | `mgmt.support` | NAV: `MANAGEMENT_GROUP`, AppLayout.tsx:514; member reach via AccountHub | member | OK | C (`submitSupportRequest`, RPC) | ENGINE-RPC | states-itself-first:Y · captures-reason:Y (support request body) · records-reference:N · undoable:N | none |
| `/app/account` | AccountHub.tsx | NONE | NAV: `AccountNavLink`, AppLayout.tsx:853,1586 | member | OK | R + U (`myContactPhone`, profile) | ENGINE-RPC | states-itself-first:Y · N · N · N | none |
| `/app/my-posts` | MyPosts.tsx | NONE | NAV: `PRESENCE_LINKS` "My Posts", AppLayout.tsx:437 | member | OK | R | — | — | none |
| `/app/stable` | Stable.tsx | NONE | NAV: `PRESENCE_LINKS`/`ClientNavItems` "My Stable", AppLayout.tsx:436,1100 | member | OK | R (page itself); C/U/D live in `HorseIntakePage`/`HorsePage`, not here | — | — | none |
| `/app/care` | CareHome.tsx | NONE | LINK-ONLY: Home.tsx/DashboardHome.tsx redirect here when `surfaces.includes('care_dashboard')` | member | OK | R | — | — | none — **but see finding: `CareHome.tsx:70` links `to="/horse-care"`, which is not a route (the real route is `/horse`). A dead in-app link — every click 404s.** |
| `/app/deal` | DealHome.tsx | NONE | LINK-ONLY: Home.tsx/DashboardHome.tsx redirect here when `surfaces.includes('deal_dashboard')` | member | OK | R (`myDocuments`) | — | — | none |
| `/app/horse-intake` | HorseIntakePage.tsx | NONE | LINK-ONLY: CareHome.tsx:83, AppLayout onboarding links | member | OK | C/U (`attachBookingHorse`, `attachHorseToDocument`, `ensureHorseDocuments`) | ENGINE-RPC | states-itself-first:Y · N · records-reference:Y (horse record id) · N | none |
| `/app/acquisition-intake` | AcquisitionIntakePage.tsx | NONE | LINK-ONLY (from purchase unlock flow, not a persistent nav row) | member | OK | R + U (`submitAcquisitionIntake`) | ENGINE-RPC | Y · captures-reason:Y (criteria fields) · N · N | none |
| `/app/evaluations` | EvaluationsPage.tsx | NONE | LINK-ONLY (from a purchased-evaluation notification, not nav) | member | OK | R + share (`shareEvaluationReport`, `downloadEvaluationReport`, `logReportViewed`) | ENGINE-RPC | — | — | none |
| `/app/horses/:horseId` | HorsePage.tsx | NONE | LINK-ONLY: Stable list rows | member (`ProtectedRoute`) | OK | R + U/D (`deleteStableHorse`, `updateHorseRecord`) | ENGINE-RPC | states-itself-first:Y (confirm() present, HorsePage.tsx) · N · N · undoable:N (delete has no restore) | none |
| `/app/contracts/:id` | ContractPage.tsx | NONE | LINK-ONLY: notification links, DealHome, HorseIntakePage; onboarding "Review and sign" | member/staff (dual view) | OK | full C/R/U (34 distinct functions — see file; heaviest single surface in the app) | ENGINE-RPC (contracts.ts) + one raw write (`captureContactInfo`) | states-itself-first:Y (5 `confirm()` sites) · captures-reason:Y (59 reason/note hits — change requests, terminations) · records-reference:Y (signature/version ids) · undoable:Y (34 withdraw/reopen/decline hits — the one surface in the app where D19 is substantively satisfied, not just possible) | none directly (writes notifications via `contracts.ts`, does not read them back on this page) |
| `/app/records`, `/app/records/:tab` | RecordsPage.tsx | `people.records` | NAV: `MANAGEMENT_GROUP` "Records", AppLayout.tsx:513 | staff (`requireStaff`) | OK — composes Clients/Leads/Partners/Vendors/Horses/Lessons/Documents/Deals tabs, each its own sub-CRUD (out of this table's row budget; see tab components individually where they have their own route, e.g. `ops/records/*`) | R (tab shell); mutations live in the tab components | mixed, per tab | — | — |
| `/app/admin` → redirect `/app/records/clients` | — | NONE | intentional (TASK-RECORDS) | staff | — | — | — | — | — |

---

## 3. Staff `/app/ops/*` surfaces (`requireStaff` unless noted)

| path | component | registry | reach | role gate | name check | CRUD | write class | D19 | ledger reads |
|---|---|---|---|---|---|---|---|---|---|
| `/app/ops` | OpsHome.tsx (→ `OpsDashboard` for admins, `InstructorHome` for trainers) | NONE | **URL-ONLY — zero incoming `to="/app/ops"` anywhere in `src/`.** Both role branches render correctly when visited; nothing links here. Matches the audit's #1 calibration instance verbatim (reviewSection.ts's own "Staff home B/C" comparison names this same gap). | staff | OK | R (KPI tiles) | — | — | reads `inbound_open_count()` (RPC), not a ledger table |
| `/app/ops/preview/instructor-home` | InstructorHomePreview.tsx | NONE | URL-ONLY by design (ADMINSWEEP comment, App.tsx:305-310 — no production non-admin-staff account exists to view the real path) | staff | OK, comment explains itself | R | — | — | none |
| `/app/ops/contacts` (retired→redirect `/app/records/clients`) | ContactsPage.tsx | NONE | dead route unless `CONTACTS_PAGE_RETIRED=false`; component itself still has real C/U/D | staff | — | C/U/D (`createContact`, `updateContact`, `deleteContact` — raw writes; `setContactType`, RPC) | RAW-TABLE-WRITE + ENGINE-RPC | states-itself-first:Y · N · N · undoable:N (delete has no restore found) | none |
| `/app/ops/directory` → redirect `/app/records/vendors` | — | NONE | intentional | staff | — | — | — | — | — |
| `/app/ops/leads` → redirect `/app/records/leads` | — | NONE | intentional | staff | — | — | — | — | — |
| `/app/ops/horses` (retired→redirect) | HorsesPage.tsx | NONE | dead route unless flag flipped; component has real C/U | staff | — | C/U (`createHorse`, `updateHorse`, raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/horse-records` (still live — `HORSE_RECORDS_STANDALONE_RETIRED` only retires the *standalone entry point*; the component IS the Records "Horses" tab) | HorseRecordsPage.tsx | NONE | NAV via Records tab; standalone route URL-ONLY | staff | OK | R + C/U/Archive (`staffArchiveHorse`, `staffAssignHorseParty`, `staffUpdateHorse`, `createHorseRecord`, `generateLeaseAvailability`) | ENGINE-RPC | states-itself-first:Y · N · N · undoable: partial (archive, not delete) | none |
| `/app/ops/documents` (retired→redirect `/app/records/documents`) | DocumentsQueuePage.tsx | NONE | dead route unless flag flipped; component has real D (`deleteDocuments`, raw write) + RPC reads | RAW-TABLE-WRITE | N · N · N · undoable:N | staff | — | none |
| `/app/ops/documents/:id` | DocumentViewerPage.tsx | NONE | LINK-ONLY: HorseRecordsPage.tsx:158, notification links | staff | ⚠ this is reviewSection.ts's own "Document B · read-only view" comparison point — a second, independent body renderer (`MergedBodyView`) from `/app/contracts/:id`'s `ContractBody` | R | — | — | comment references `document_deliveries`/`record_signature`, no page-level read confirmed |
| `/app/ops/intake` (retired→`IntakeRetiredRedirect`) | IntakePage.tsx | NONE | dead route unless flag flipped; component has `setSupportStatus` (RPC) | ENGINE-RPC | N · N · N · N | staff | — | none |
| `/app/ops/team` | TeamPage.tsx | `settings.team` | NAV: `SETTINGS_GROUP`, AppLayout.tsx:595 (via `/app/ops/settings` cards — see §0) | staff | OK | C/U/D (`addGrant`, `adminRevokeStaffInvite`, `adminSetRole`, `adminSetSuspended`, `adminUpdateProfile`, `removeGrant` — all raw writes) | RAW-TABLE-WRITE | states-itself-first:Y · N · N · undoable:Y (`removeGrant` reverses `addGrant`; suspend is itself reversible) | none |
| `/app/ops/accounts/new` | AccountInvitePage.tsx | NONE | LINK-ONLY: TeamPage/ContactsPage/NewContractPage "add them as an account first" | staff | OK | C (invitation, RPC) | ENGINE-RPC | Y · N · records-reference:Y (invite link/id) · N | none |
| `/app/ops/contracts/new` | NewContractPage.tsx | NONE | LINK-ONLY: ClientRecordActions.tsx:176, Admin.tsx:512 | staff | OK | C (`createHorseRecord`, `startLeaseContract`, `startSaleContract`, `assignHorseSection`) | ENGINE-RPC | Y · N · records-reference:Y (new document id) · N | none |
| `/app/ops/deals` (retired→redirect) | DealsPage.tsx | NONE | dead route unless flag flipped; component reads only (`listDeals`); create lives on this page too (`createDeal`, RPC) | ENGINE-RPC | Y · N · Y (deal id) · N | staff | — | none |
| `/app/ops/deals/:dealId` | DealPage.tsx | NONE | LINK-ONLY: DealsPage rows, RecordsPage Deals tab | staff | OK | R + U (`updateDeal`, `voidDeal`, `addDealDocument`) | ENGINE-RPC | states-itself-first:Y (`confirm()` present) · N · Y · **undoable:Y — `voidDeal` is a real, named undo path, one of very few in the app** | none |
| `/app/ops/availability` → redirect `/app/calendar` | — | NONE | intentional (Phase 6) | staff | — | — | — | — | — |
| `/app/ops/moderation` | ModerationPage.tsx | `community.moderation` | NAV: `COMMUNITY_GROUP`, AppLayout.tsx:544 | staff | OK | U (`feedModerate`, RPC) | ENGINE-RPC | Y · N · N · N | none |
| `/app/ops/lookups` | LookupReviewPage.tsx | `community.lookups` | NAV: `COMMUNITY_GROUP`, AppLayout.tsx:545 | staff | label "Field options" vs nav constant name `community.lookups` — consistent, OK | U/D (`dismissLookupSuggestion`, raw write; `promoteLookupSuggestion`, RPC) | MIXED | Y · N · N · N | none |
| `/app/ops/support` | SupportPage.tsx | `mgmt.support` | NAV: `MANAGEMENT_GROUP`, AppLayout.tsx:514 | staff | OK | U (`setSupportStatus`, RPC) | ENGINE-RPC | Y · N · N · N | none |
| `/app/ops/oversight` | OversightPage.tsx | `community.oversight` | NAV: `COMMUNITY_GROUP`, AppLayout.tsx:551 | staff | OK | R (`adminOversight`) | — | — | none |
| `/app/ops/activity` | ActivityPage.tsx | `community.activity` | NAV: `COMMUNITY_GROUP`, AppLayout.tsx:542 | staff | OK | R (`statusFeed`) | — | — | reads `status_events` via `statusFeed()` — **the one surface in the app that actually reads a ledger table** |
| `/app/ops/evaluations` | EvaluationReportsPage.tsx | `community.evaluations` | NAV: `COMMUNITY_GROUP`, AppLayout.tsx:543 | staff | OK | C/U (`createEvaluationReport`, `saveEvaluationReport`, `deliverEvaluationReport`) | ENGINE-RPC | Y · N · Y (delivery confirmation) · N | none |
| `/app/ops/content` | ContentStorePage.tsx | `community.content` | NAV: `COMMUNITY_GROUP`, AppLayout.tsx:547 | staff | OK | C/U (`adminCreateAnnouncement/ContentPost/Event/Offering/Resource` — raw writes; `upsertContentBlock`, RPC) | MIXED | N · N · N · N | none |
| `/app/ops/payments/review` | PaymentReviewPage.tsx | `mgmt.payments_review` | NAV: `MANAGEMENT_GROUP`, AppLayout.tsx:524 | staff | OK | U (`confirmPaymentClaim`, `declinePaymentClaim`, RPC; `dismissNotification`, raw write) | MIXED | states-itself-first:Y (`confirm()` present) · N · Y (claim decision recorded) · N | writes (does not read back) `notifications`/`receipt_sends` per `api-payments.ts` |
| `/app/ops/boarding` | BoardingHubPage.tsx | `boarding.hub` | NAV: `MODULES_GROUP`, AppLayout.tsx:557 | staff (mod.boarding) | OK | R | — | — | none |
| `/app/ops/boarding/facilities` | FacilitiesPage.tsx | `boarding.facilities` | NAV: child of Boarding hub | staff | OK | C/U (`createFacility`, `createStall`, `updateFacility`, `updateStall` — all raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/boarding/agreements` | BoardAgreementsPage.tsx | `boarding.agreements` | NAV: child of Boarding hub | staff | OK | R (mutations happen via HorseRecordsPage/ContractPage, not here) | — | — | none |
| `/app/ops/boarding/charges` | BoardChargesPage.tsx | `boarding.charges` | NAV: child of Boarding hub | staff | OK | R (`emitBoardCharge` lives in `api-boarding.ts`, not called from this page directly in the grep pass — flagged, not fixed) | — | — | none |
| `/app/ops/barnops` | BarnopsHubPage.tsx | `barnops.hub` | NAV: `MODULES_GROUP`, AppLayout.tsx:558 | staff (mod.barnops) | OK | R | — | — | none |
| `/app/ops/barnops/resources` | ResourcesPage.tsx | `barnops.resources` | NAV: child of Barn Ops hub | staff | OK | C/U (`createResource`, `createResourceLot`, `updateResource` — raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/barnops/consumption` | ConsumptionLogPage.tsx | `barnops.consumption` | NAV: child of Barn Ops hub | staff | OK | C (`createConsumptionEvent`, raw write) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/barnops/allocation-rules` | AllocationRulesPage.tsx | `barnops.allocation_rules` | NAV: child of Barn Ops hub | staff | OK | C/U/D (`createCostAllocationRule`, `updateCostAllocationRule`, `deleteCostAllocationRule` — raw writes; `resolveConsumptionBilling`, RPC) | MIXED | N · N · N · **undoable:N — a delete with no counterpart** | none |
| `/app/ops/lessons` (retired→redirect `/app/records/lessons`) | LessonsHubPage.tsx | `lessons.hub` (path already points at the Records tab per pageRegistry.ts:168) | dead route unless flag flipped | staff | OK | R + links out to Sessions/Credits/Packages | — | — | — |
| `/app/ops/lessons/packages` | LessonPackagesPage.tsx | NONE | NAV: LessonsHubPage links only (LessonsHubPage.tsx:85) | staff | OK | C/U (`createLessonPackage`, `updateLessonPackage` — raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/lessons/credits` | LessonCreditsPage.tsx | NONE | NAV: LessonsHubPage links (LessonsHubPage.tsx:74,96) | staff | OK — but the mutation is named "consumeLessonCredit" while the UI reads "1 credit used", both consistent | U (`consumeLessonCredit`) | **RAW-TABLE-WRITE — `src/lib/ops/api-lessons.ts:275-290`, `.from('lesson_credits').update({credits_remaining: current - count})`, reads-then-writes with an optimistic-lock `.eq('credits_remaining', current)` guard but no ledger row, no reason, no reversal.** Matches the audit's #8 calibration instance verbatim — this is the exact "reaching around the entire credit engine" defect named in the walkthrough. | states-itself-first:N (no confirm before decrement) · captures-reason:N · records-reference:N (no ledger entry, no receipt) · undoable:N | none |
| `/app/ops/lessons/sessions` | SessionsPage.tsx | NONE | NAV: LessonsHubPage.tsx:63 | staff | ⚠ **"Sessions" is the bookings list — the exact name-check class the task doc itself flags (§5, "the bookings list is named Sessions")** | R + form-driven C/U (`ScheduleSessionForm`, `SessionActivityForm` sub-components call `addBookingNote`, `saveBookingForm`, `discardBookingForm`, all RPC) | ENGINE-RPC | Y (form confirm) · Y (notes field) · N · Y (`discardBookingForm`) | none |
| `/app/ops/records` (retired→redirect `/app/records/horses`) | RecordsHubPage.tsx | `records.hub` | dead route unless flag flipped | staff (mod.horserecords) | OK | R | — | — | — |
| `/app/ops/records/horses/:horseId/parties` | HorsePartiesPage.tsx | NONE | LINK-ONLY: HorseHealthPage.tsx:384, HorseRecordsPage per-record row | staff | OK | C/Archive (`createHorseParty`, `archiveHorseParty`, RPC) | ENGINE-RPC | Y · N · Y (party id) · undoable: partial (archive) | none |
| `/app/ops/records/horses/:horseId/health` | HorseHealthPage.tsx | NONE | LINK-ONLY: HorsePartiesPage.tsx:345 | staff | OK | C/U (`createHealthEvent` raw write; `updateHorseCareTeam` raw write) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/employees` | EmployeesHubPage.tsx | `employees.hub` | NAV: `MODULES_GROUP`, AppLayout.tsx:569 | staff (mod.employees) | OK | R | — | — | none |
| `/app/ops/employees/staff` | StaffPage.tsx | `employees.staff` | NAV: child of Employees hub | staff | OK | C/U (`createStaffProfile`, `updateStaffProfile` — raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/employees/schedule` | SchedulePage.tsx | `employees.schedule` | NAV: child of Employees hub | staff | OK | C (`createShift`, `createTimeEntry` — raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/review` | ReviewIndexPage.tsx | NONE | **URL-ONLY — dead nav, see §0.** | admin (`requireAdmin`) | temporary by design (REVIEW_NOTE) | R | — | — | none |
| `/app/ops/review/contacts` | ReviewContactsPage (ReviewMounts.tsx) | NONE | LINK-ONLY: ReviewIndexPage cards only; **no independent nav row (URL-ONLY otherwise)** | admin | temporary | mounts `ContactsPage` — same CRUD as `/app/ops/contacts` | RAW-TABLE-WRITE | — | none |
| `/app/ops/review/intake` | ReviewIntakePage (ReviewMounts.tsx) | NONE | LINK-ONLY: ReviewIndexPage cards only | admin | temporary | mounts retired `IntakePage` | ENGINE-RPC | — | none |
| `/app/ops/review/contact-dossier` | ReviewContactDossier (ReviewMounts.tsx) | NONE | LINK-ONLY: ReviewIndexPage cards only | admin | ⚠ **reviewSection.ts:181 own warning: "Mounted on a REAL production contact and its saves are REAL"** — a review/comparison route with live production write access | U (real `ContactDossierModal` save path) | ENGINE-RPC/RAW (same as ContactsPage's editor) | — | none |
| `/app/ops/review/contact-form` | ReviewContactForm (ReviewMounts.tsx) | NONE | LINK-ONLY: ReviewIndexPage cards only | admin | OK — submit is inertted on this mount only (reviewSection.ts:185) | R only on this mount (submit handler refused) | — | — | none |

---

## 4. Ops admin / superadmin (`requireAdmin` / `requireSuperAdmin`)

| path | component | registry | reach | role gate | name check | CRUD | write class | D19 | ledger reads |
|---|---|---|---|---|---|---|---|---|---|
| `/app/ops/admin/modules` | AdminModulesPage.tsx | NONE | LINK-ONLY: `/app/ops/modules` cards | superadmin | OK | U (`setOrgModule`, RPC) | ENGINE-RPC | Y · N · N · N | none |
| `/app/ops/admin/registry` | AdminRegistryPage.tsx | NONE | LINK-ONLY: `/app/ops/settings` cards | superadmin | OK | R | — | — | none |
| `/app/ops/admin/branding` | AdminBrandingPage.tsx | `settings.branding` | NAV: `SETTINGS_GROUP`, AppLayout.tsx:596 (via cards, §0) | admin | OK | U (`upsertConfigValue`, raw write) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/admin/products` | AdminProductsPage.tsx | `settings.products` | NAV: `SETTINGS_GROUP`, AppLayout.tsx:597 | admin | OK | C/U (`adminCreateOffering`, `adminUpdateOffering`, `createProduct`, `createProductPrice` — raw writes) | RAW-TABLE-WRITE | N · N · N · N | none |
| `/app/ops/admin/forms` | AdminFormsPage.tsx | `settings.forms` | NAV: `SETTINGS_GROUP`, AppLayout.tsx:598 | admin | OK | U (`setFormRequired`, RPC) | ENGINE-RPC | Y · N · N · N | none |
| `/app/ops/admin/templates` | AdminTemplatesPage.tsx | `settings.templates` (implicit — page exists, TASK-TEXTEDIT note at App.tsx:432) | NAV: `SETTINGS_GROUP`, AppLayout.tsx:606 | admin | OK | R (list) | — | — | none |
| `/app/ops/admin/templates/:templateKey` | AdminTemplateEditorPage.tsx | NONE | LINK-ONLY: AdminTemplatesPage rows | admin | OK | C/U (`saveClauseDraft`, `saveFlatDraft`, `publishTemplate`, `discardTemplateDrafts` — all RPC) | ENGINE-RPC | Y (publish confirms) · N · Y (published version) · Y (`discardTemplateDrafts`) | none |
| `/app/ops/admin/pages` | AdminPageVisibilityPage.tsx | `settings.page_visibility` (`protected: true`) | NAV: `SETTINGS_GROUP` via cards | admin | OK | U (`setPageHidden`, RPC) | ENGINE-RPC | Y · N · N · Y (toggle reverses itself) | none |
| `/app/ops/settings` | NavGroupCardsPage (`groupKey="settings"`) | NONE | LINK-ONLY: AccountHub.tsx:170 | staff | OK — renders `SETTINGS_GROUP` as cards, the mechanism §0 describes | R (shell) | — | — | — |
| `/app/ops/modules` | NavGroupCardsPage (`groupKey="modules"`) | NONE | LINK-ONLY: AccountHub.tsx:212 | staff | OK | R (shell) | — | — | — |
| `/app/ops/superadmin/provision` | ProvisionTenantPage.tsx | NONE | LINK-ONLY: OrganizationsPage.tsx:41 | superadmin | OK | C (`provisionTenant`, RPC) | ENGINE-RPC | Y · N · Y (new tenant id) · N | none |
| `/app/ops/superadmin/organizations` | OrganizationsPage.tsx | NONE | NAV: `PLATFORM_NAV`, AppLayout.tsx:475; header wordmark, AppLayout.tsx:1707 | superadmin | OK | R | — | — | none |
| `/app/ops/superadmin/organizations/:id` | TenantDetailPage.tsx | NONE | LINK-ONLY: OrganizationsPage rows | superadmin | OK | U (`platform_set_tenant_module`, `platform_set_tenant_status`, both RPC, called directly in-page) | ENGINE-RPC | Y · N · N · **undoable: partial (status is a toggle, module is a toggle — both self-reversing, no confirmation dialog found on this page despite the tenant-wide blast radius)** | none |

---

## 5. Reconciliation — 128 raw matches → true route count → 27 registry rows → 117 page files

- `grep -c "path=" src/App.tsx` = **128** (still true at `60eab08`, re-run live).
- Of the 128, subtract 15 that are pure `<Navigate>`/`<RedirectWithQuery>` redirects with no
  component of their own (`/shop`, `/ride`, `/membership`, `/register`, `/register/complete`,
  `/inquire`, `app/book`, `app/admin`, `ops/directory`, `ops/leads`, `ops/availability`, plus the
  4 retirement-flag conditional redirects that are *currently* redirecting: `ops/contacts`,
  `ops/horses`, `ops/horse-records`, `ops/documents`, `ops/deals`, `ops/lessons`, `ops/records` —
  7 of those, not 4; the flag is real code both ways, so the table above lists both branches).
  Net: **128 routed paths, 121 of which mount a real component today** (including the one `index`
  route, bringing rendered surfaces to **122**).
- **27 registry rows** cover a deliberately narrow slice — "every staff page with a nav row of its
  own" (pageRegistry.ts:114). It excludes, by the file's own header: the 6 `core.*` substrate
  modules, the 3 platform/superadmin rows, the 5 dead Review rows, and the entire member-side
  `/app/*` block (12 routes) plus the App-pages block (Calendar/Catalog/Messages) — all hand-written
  JSX, not table rows, so they have nothing for the registry to key on. That gap is not a defect;
  it is recorded, not silently absent, in the registry's own comments (pageRegistry.ts:125-127).
- **117 page files**: 105 are imported by `App.tsx` (some components serve 2-3 routes each — e.g.
  `BookHorse`, `Checkout`, `Release` — which is why 105 files cover more than 105 routes). The
  remaining 12 are NOT imported by `App.tsx`:
  - **10 are real sub-components** of a routed page, confirmed by grep for their exact import
    elsewhere: `CalendarItemPanel`/`CalendarSettingsPanel` (both ← `CalendarPage.tsx`),
    `InstructorHome` (← `OpsHome.tsx`, live production path for trainer-role staff — not preview
    code, unlike `InstructorHomePreview`), `BookingFieldsSettings` (← `IntakePage.tsx`),
    `FilesRecordsPage` (← `RecordsPage.tsx`), `OpsDashboard` (← `OpsHome.tsx`/`InstructorHome.tsx`),
    `ScheduleSessionForm`/`SessionActivityForm` (← `SessionsPage.tsx`, `IntakePage.tsx`,
    `CalendarItemPanel.tsx`), `ReviewBanner` (← `ReviewMounts.tsx`), and `ReviewMounts` itself
    (imported by `App.tsx` via named exports, not a default import — my dead-file grep pattern
    missed it; corrected here).
  - **2 are genuinely unrouted — see §6.**

## 6. Page files with no route (dead-file candidates — listed, not deleted)

| file | status |
|---|---|
| `src/pages/Shop.tsx` | By design — App.tsx:21-22 comment: "Shop (the public catalog) is hidden… The page file is untouched; restoring it is this import plus one route line." Still imports cleanly (grepped for compile-breaking drift: none found). Not a defect. |
| `src/pages/app/Admin.tsx` | **No import anywhere in `src/` — zero call sites.** Its functionality (Clients/Leads/Directory) was absorbed into `RecordsPage.tsx` by TASK-RECORDS (2026-08-12) and `ContactsPage.tsx`/`RosterCard.tsx` elsewhere. Flagged as a true dead file — candidate for deletion, decision left to the owner per this task's scope. |

## 7. Routes whose only reach is the half-retired `reviewSection.ts`

All five: `/app/ops/review`, `/app/ops/review/contacts`, `/app/ops/review/intake`,
`/app/ops/review/contact-dossier`, `/app/ops/review/contact-form`. See §0 for why
(`REVIEW_NAV_ITEMS` is exported but never imported outside its own module — the nav group was
removed 2026-08-15 per `reviewSection.ts`'s own history, and nothing restored it). Per the task's
instruction (§5 of the audit spec): **not proposed for deletion** — that teardown is item W13 and
belongs to a separate decision. `/app/ops/review/contact-dossier` carries a live-production-write
warning in its own source (reviewSection.ts:181) worth the owner's attention independent of the
nav question.
