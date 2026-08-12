### ITEM [batch1.md#15]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: The mixed-cart render (one priced item plus one "Price on enquiry" item, per-cadence subtotal covering only priced ones) has not been seen on screen.
- quote: "That is correct and the group's own comment says so, but it has not been seen on screen."
- kind: not-verified
- artifacts: src/lib/cart.ts, src/pages/Checkout.tsx
- decision-mention: none

### ITEM [batch1.md#16]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: Schedule.tsx still casts listLessonSessions to MemberLessonSession[] via `as unknown as` and still heads the staff view "Your lessons" while listing the whole property's; census 2.5 owns the consolidation.
- quote: "**`Schedule.tsx` still casts one type to another to compile** ... and still heads the staff view **\"Your lessons\"** while listing the whole property's."
- kind: defect
- artifacts: src/pages/app/Schedule.tsx
- decision-mention: none

### ITEM [batch1.md#29]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: DashboardPanel still has no loading branch and no error branch — every fetch swallows errors, so a failed read renders "you're all caught up"; it also carries 15 arbitrary Tailwind values, most in its group.
- quote: "**the panel itself still has no loading branch and no error branch** — every fetch is `.catch(() => …)`, so a failed read renders as \"you're all caught up.\""
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx
- decision-mention: none

### ITEM [batch1.md#33]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Before Schedule.tsx is retired, its community-events + RSVP section must be carried across — it is the only place in the app a member can RSVP and it would be lost.
- quote: "the **community-events + RSVP section** ... that is the only place in the app a member can RSVP, and it would be lost."
- kind: inventory
- artifacts: src/pages/app/Schedule.tsx, fetchEvents, fetchMyRsvps, setRsvp
- decision-mention: none

### ITEM [batch1.md#37]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: If ServiceSelector is retired, its radiogroup accessibility semantics and its mechanics() hint line must be carried across before retirement — OfferingCatalog lacks both.
- quote: "**Carry across from `ServiceSelector` before retiring it:** the **radiogroup semantics** (`role`, `aria-checked`, labelled group) and the **`mechanics()` hint line**"
- kind: inventory
- artifacts: src/components/ServiceSelector.tsx, src/components/OfferingCatalog.tsx
- decision-mention: none

### ITEM [batch1.md#40]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: RecordsHubPage's empty message directs the reader to "the Horses screen" — a page with no nav entry that nothing in the app links to; a staff member following the instruction has nowhere to go.
- quote: "prose directing the reader to a page that **has no nav entry and that nothing in the app links to.** A staff member following that instruction has nowhere to go."
- kind: defect
- artifacts: src/pages/app/ops/hubs/RecordsHubPage.tsx, /app/ops/horses
- decision-mention: none

### ITEM [batch1.md#43]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: InstructorHome is unjudgeable from code (never rendered for a real account — no non-admin staff exists in production); the owner must open /app/ops/preview/instructor-home and look before it is judged; do not retire the preview route yet.
- quote: "**This is the one place in this report where I will not give you a final verdict from code** ... **Open `/app/ops/preview/instructor-home` and look at it.**"
- kind: blocked-on-owner
- artifacts: src/pages/app/InstructorHome.tsx, src/pages/app/ops/InstructorHomePreview.tsx
- decision-mention: none

### ITEM [batch1.md#44]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Defect: "New lead" on /app/ops/leads creates a CONTACT-typed row (ContactInput has no contact_type; column default is 'CONTACT'), so the new person is not in the list and appears on /app/admin instead; same for "New directory entry" — NOT VERIFIED in a browser.
- quote: "pressing **\"New lead\"** on `/app/ops/leads` creates a `CONTACT`-typed row ... the new person **is not in the list**."
- kind: defect
- artifacts: src/pages/app/ops/ContactsPage.tsx, src/components/ops/contacts/ContactForm.tsx, createContact, src/lib/ops/types.ts
- decision-mention: none

### ITEM [batch1.md#45]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The 4 TEAM-typed contacts (CJ Z, Claire Bourdon, French Heritage Equestrian, CACTAI INC.) appear on no people page — ContactDirectory has no TEAM mode and admin_client_accounts excludes them; owner must decide whether they appear on any tab.
- quote: "The **4 `TEAM`-typed contacts** ... appear on **no people page** — `ContactDirectory` has no `TEAM` mode and `admin_client_accounts` excludes them."
- kind: defect
- artifacts: contacts, ContactDirectory, admin_client_accounts, TeamPage
- decision-mention: none

### ITEM [batch1.md#46]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Answer to ONEPEOPLE §5: the "Unfiled" section and file(id, type) filing control in ContactsPage is the only place in the app that can set contact_type — it must be carried into the composed page or a NULL-typed contact is unfilable forever.
- quote: "This is **the only place in the app that can set `contact_type`**. `Admin.tsx` has no equivalent."
- kind: inventory
- artifacts: src/pages/app/ops/ContactsPage.tsx, setContactType
- decision-mention: none

### ITEM [batch1.md#47]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Warning for ONEPEOPLE: fixing tab-following on the create control without fixing the ContactForm writer (which does not set contact_type) ships the same bug with better chrome.
- quote: "**Fixing the tab-following without fixing the writer ships the same bug with better chrome.**"
- kind: defect
- artifacts: ContactForm.tsx, createContact
- decision-mention: none

### ITEM [batch1.md#48]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.4: two contact editors on the same pages — ContactDossierModal (30 fields, RPC writes) and ContactForm (4 fields, direct table writes); which one you get depends on where you clicked — NOT VERIFIED visually.
- quote: "**So on `/app/ops/leads` a person can be edited two ways, in two modals, with two field sets (4 vs 30) and two write paths (table vs RPC).**"
- kind: defect
- artifacts: src/components/app/ContactDossierModal.tsx, src/components/ops/contacts/ContactForm.tsx
- decision-mention: none

### ITEM [batch1.md#49]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Before ContactForm is retired its FormField usage and pre-submit validation pattern must be carried across, and the create path must be rebuilt on the RPC with contact_type passed.
- quote: "**Carry across before B is retired:** **`FormField` usage and the pre-submit validation pattern** ... **the create path must be rebuilt on the RPC with `contact_type` passed**"
- kind: inventory
- artifacts: FormField, ContactForm.tsx, update_contact_record
- decision-mention: none

### ITEM [batch1.md#58]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.1: /account (Account.tsx) is a dead page (URL-only, production audience 3 synthetic accounts) carrying a verbatim copy of OrdersContent's order-status label map and its own usd() formatter; verify TwoFactorSettings is reachable in MyLoginContent, then retire behind a boolean.
- quote: "`Account.tsx` also carries a **verbatim copy** of the order-status label map that `OrdersContent.tsx:18` has"
- kind: defect
- artifacts: src/pages/Account.tsx, src/components/app/OrdersContent.tsx, TwoFactorSettings, MyLoginContent
- decision-mention: none

### ITEM [batch1.md#64]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.7: retirement-by-boolean is now the house pattern and the list of hidden pages changes weekly — anything consuming the retirement-constant list must re-derive it, not copy it (INTAKE_PAGE_RETIRED landed mid-census).
- quote: "retirement-by-boolean is now the house pattern, and the list of what is hidden changes weekly. Anything that consumes this list must re-derive it, not copy it."
- kind: process
- artifacts: CONTACTS_PAGE_RETIRED, INTAKE_PAGE_RETIRED, INLINE_BODY_PREVIEW_RETIRED, STRIPE_ENABLED, SEED_ENABLED
- decision-mention: none

### ITEM [batch1.md#67]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: For REVIEWNAV: two components (ContactDossierModal, ContactForm) have no route and cannot be reviewed side-by-side without one being mounted; both take props not URL params.
- quote: "**Two components have no route and cannot be reviewed side-by-side without one being mounted:** `ContactDossierModal` and `ContactForm`."
- kind: process
- artifacts: ContactDossierModal.tsx, ContactForm.tsx
- decision-mention: none

### ITEM [batch1.md#80]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Not verified: whether the Supabase redirect allow-list contains /app/account — nobody has ever completed this redirect in production; if only the site root is allowed, the member lands on the home page and the outcome is reported nowhere (the quiet failure).
- quote: "**The redirect allow-list contains `/app/account`.** Nobody has ever completed this redirect in production ... The flag itself is the loud failure; this one is the quiet one."
- kind: not-verified
- artifacts: Supabase Authentication URL Configuration, redirectTo
- decision-mention: none

### ITEM [batch1.md#89]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Broken but out of scope: expired invitations never flip to status 'expired' — nothing sweeps them, so "13 sent" reads as thirteen live invitations when several are dead; the new panel derives Expired from the date, but the underlying rows stay wrong.
- quote: "**Expired invitations never flip to `expired`.** `maeboon@gmail.com` has been `status='sent'` since it expired Aug 4. Nothing sweeps them"
- kind: defect
- artifacts: invitations
- decision-mention: none

### ITEM [batch1.md#95]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Clarification of the "13 sent, never redeemed" figure: twelve of thirteen are earlier threads' test sends; the one real address is maeboon@gmail.com (expired Aug 4) — it is not thirteen failures.
- quote: "**It is not thirteen failures.** A genuine redemption ran 2026-08-10 ... and produced a complete account."
- kind: correction
- artifacts: invitations
- decision-mention: none

### ITEM [batch1.md#99]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F2 reported, not decided: should the schedule-lesson path also write status='converted'? It is the only writer of that status and has never run (production holds only 'new' and 'contacted').
- quote: "**F2 — should the schedule-lesson path also write `status='converted'`?** The addendum says report, do not decide."
- kind: blocked-on-owner
- artifacts: requests.status, schedule_lesson_session
- decision-mention: none

### ITEM [batch1.md#136]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Behaviour change worth naming: a future guest-checkout gift with NULL buyer_user_id was actionable by any account holder before the coalesce fix and is now staff-only — a correction, moot at 0 gift rows, but it will matter when the gift subsystem is finished.
- quote: "a future guest-checkout gift would be actionable today by any account holder, and afterwards by staff only ... it is currently moot at 0 gift rows."
- kind: correctness
- artifacts: gift_claim_link, gift_mark_sent, gift_reschedule, gifts
- decision-mention: none

### ITEM [batch1.md#147]
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Correction to the brief: requests_capture_contact has no branch producing NULL for an ambiguous match — it picks the oldest-created matching contact or creates one; "absent" is unreachable via a valid insert; pre-existing matching behaviour left unchanged, the gap between wording and code flagged rather than an ambiguity branch invented.
- quote: "**`requests_capture_contact` has no branch that produces `NULL` for an ambiguous match** — it was never in scope of this fix and I did not add one."
- kind: correction
- artifacts: requests_capture_contact
- decision-mention: none

### ITEM [batch1.md#148]
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Assumed, not verified: that no application code path reads requests.contact_id expecting the old (broken, never-populated) semantics — frontend/API consumers were not audited.
- quote: "No application code path reads `requests.contact_id` expecting the old (broken) semantics — I did not grep the frontend/API for consumers."
- kind: not-verified
- artifacts: requests.contact_id
- decision-mention: none

### ITEM [batch1.md#149]
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Methodology note worth keeping: RETURNING on an INSERT reflects the row before an AFTER trigger's separate UPDATE lands — a first proof attempt looked like failure; a second independent SELECT is required to observe AFTER-trigger side effects.
- quote: "`RETURNING` on the `INSERT` statement reflects the row as of that statement, before the `AFTER` trigger's separate `UPDATE` lands."
- kind: process
- artifacts: requests_capture_contact_trg
- decision-mention: none

---

### ITEM [batch1.md#154]
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: Flag for owner/future task: a single-direction Gifts header ("received" vs "given") requires lifting gift data up to Gifts.tsx or a callback from GiftsContent — a structural change out of this copy pass — and GiftsContent is also reused on the Account page, so any fix must target the shared component.
- quote: "**Flag for owner/future task:** if a single-direction header is wanted, it requires either lifting the gift-direction data up to `Gifts.tsx` or passing a callback down from `GiftsContent`"
- kind: process
- artifacts: src/pages/app/Gifts.tsx, src/components/app/GiftsContent.tsx
- decision-mention: none

### ITEM [batch2.md#37]
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The avatar-menu's MenuLink render site was deliberately left unbadged — no nav-group item has ever shown a badge there, so this doesn't regress anything.
- quote: "The avatar-menu's `MenuLink` render site (`:681`) was left unbadged — no nav-group item has ever shown a badge there"
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx (MenuLink)
- decision-mention: none

### ITEM [batch2.md#47]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: The CUSTOMER-marker branch (D2) may never fire against real inventory — no actual physical-good offering exists in the live catalog; the branch was tested only with a synthetic test-only offering.
- quote: "I could not find any *actual* physical-good offering in the live catalog — every priced, active offering is a service ... it may never fire against real inventory unless the catalog grows a goods SKU."
- kind: not-verified
- artifacts: offerings, redeem_gift, clients.customer_since
- decision-mention: D2

### ITEM [batch2.md#48]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Browser click-through of the public /gift → staff-conversion → /redeem → new-account → schedule path was not done (no browser in the environment); everything provable at the SQL layer was proven, the UI path is flagged not claimed.
- quote: "**Not verified — flagged, not claimed:** browser click-through of the public `/gift` → staff-conversion → `/redeem` → new-account → schedule path."
- kind: not-verified
- artifacts: src/pages/Redeem.tsx, api/register-gift.ts, GiftCreateForm.tsx, IntakePage.tsx
- decision-mention: none

### ITEM [batch2.md#60]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: 11 rows in one Modules nav group may itself read as clutter — the mandated default-visible shape; the fix is two clicks on the new settings page, but the owner's original complaint was about volume.
- quote: "**11 rows in one Modules group is a lot of nav** and that may itself read as clutter."
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx, org_page_visibility
- decision-mention: none

### ITEM [batch2.md#84]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: ContactForm's create path does not set contact_type, so anything created through it lands on /app/admin rather than the page it was created from; TASK-ONEPEOPLE's tab-following requirement would re-ship it. The review-route mount's submit is inert for exactly this reason.
- quote: "**`ContactForm`'s create path does not set `contact_type`** — anything created through it lands on `/app/admin` rather than the page it was created from."
- kind: defect
- artifacts: ContactForm, contacts.contact_type, /app/ops/review/contact-form
- decision-mention: none

### ITEM [batch2.md#87]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: /account bounces any member to /app before it renders, so slot B of the Account comparison cannot be looked at by a member.
- quote: "**`/account` bounces any member to `/app`** before it renders, so slot B of the Account comparison cannot be looked at by a member."
- kind: defect
- artifacts: /account
- decision-mention: none

### ITEM [batch2.md#95]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Two consequences of the moves the next thread must not read as breakage: the "People" nav heading is gone (its three rows all moved into Review) and the "Modules" heading is gone (Records was the only visible module row); restore Records WITH its module key on acceptance.
- quote: "**The \"People\" heading is gone from the rail.** ... **The \"Modules\" heading is gone too.** ... Restore Records **with its `module` key**"
- kind: process
- artifacts: AppLayout.tsx, manageNavGroups, mod.horserecords
- decision-mention: none

### ITEM [batch2.md#97]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Staff roster slot B (/app/ops/employees/staff) renders ModuleGate's locked fallback because mod.employees is disabled in org_modules — deliberately left off rather than changing the live app for every staff user.
- quote: "**the module was not enabled**, because that would change the live app for every staff user."
- kind: inventory
- artifacts: /app/ops/employees/staff, ModuleGate, org_modules (mod.employees)
- decision-mention: none

### ITEM [batch2.md#98]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The one review mount not byte-identical to production: ContactForm's submit is inert on its review route (its real create path would ship the contact_type defect from a new surface); validation, layout, and cancel remain real.
- quote: "`ContactForm`'s **submit is inert** on its review route. ... Wiring a real create from a review page would have shipped that defect from a new surface."
- kind: process
- artifacts: /app/ops/review/contact-form, ContactForm, ReviewMounts.tsx
- decision-mention: none

### ITEM [batch2.md#99]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: The one-line nav guard the ContactsPage retirement needs in AppLayout.tsx was reported rather than edited (UIBUILD owns the file); until it lands, the Contacts nav item is a live link that bounces to /app/admin — harmless, one extra hop.
- quote: "**Reporting this rather than editing it, per the task's own instruction.** Until it lands, the nav item is a live link to a page that immediately bounces to `/app/admin`"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx:288, CONTACTS_PAGE_RETIRED, ContactsPage.tsx
- decision-mention: none

### ITEM [batch2.md#100]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: The render itself is NOT VERIFIED — no staff browser session (owner ruling 2026-08-10); everything is RPC output, direct-query results, and built CSS proven via psql and the production bundle, not a screenshot or click-through.
- quote: "## NOT VERIFIED — no staff browser session (owner ruling 2026-08-10) / The render itself."
- kind: not-verified
- artifacts: src/components/app/RosterCard.tsx, Admin.tsx
- decision-mention: none

### ITEM [batch2.md#104]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Judgment call flagged: credits are shown as a single summed count, not itemized by name — the itemized data is already on m.credits and trivial to swap in if a single count isn't wanted.
- quote: "**Credits shown as a summed count** (total remaining units across all open credit lines), not itemized by name the way the row build showed them."
- kind: process
- artifacts: RosterCard.tsx, admin_client_accounts (credits)
- decision-mention: none

### ITEM [batch2.md#107]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Open question flagged as a judgment call: "Not yet invited" is scoped to kind='pending' only — the bare 'contact' arm (Gabriella) gets no equivalent flag even though nobody has reached out to her either; left unflagged because the settled model's flag list names no bare-contact equivalent.
- quote: "Flagging this as a judgment call rather than silently deciding it either way."
- kind: blocked-on-owner
- artifacts: RosterCard.tsx, invitations
- decision-mention: none

### ITEM [batch2.md#109]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Largest real finding on the roster: 8 of the 9 pending-kind rows have never had a matching invitations row at all (only Anita Tackette has one, long expired) — most provisioned clients were never actually invited.
- quote: "This is the single largest real finding on the roster right now: most provisioned clients were never actually invited."
- kind: data-integrity
- artifacts: invitations, clients, admin_client_accounts
- decision-mention: none

### ITEM [batch2.md#110]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Frontend-type drift found and corrected: main's ClientAccountRow was still the pre-ROSTER 15-column shape even though admin_client_accounts() had already shipped 20 columns in production.
- quote: "**This file had drifted**: `main`'s frontend type was still the pre-`ROSTER` 15-column shape even though the RPC itself had already shipped 20 columns"
- kind: correctness
- artifacts: src/lib/admin.ts, admin_client_accounts
- decision-mention: none

### ITEM [batch3.md#22]
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: "Saved Content" has no backing data model anywhere — saved=false is hardcoded permanently in my_nav_presence() until a real saved/bookmark feature is built as its own tracker item (orchestrator ruling).
- quote: "**`saved=false` is permanent until a real feature is built** — this task deliberately does not create a saved/bookmark table. The Saved Content nav link will never appear until that's built as its own item."
- kind: deferred
- artifacts: my_nav_presence(), SavedPanel, src/components/app/AccountPanels.tsx
- decision-mention: none

### ITEM [batch3.md#23]
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: Pre-existing SPA quirk in A11's ?section= pattern: AccountHub reads ?section= only in its useState initializer, so a query-string-only navigation while already on /app/account may not switch the visible panel — noted, not fixed.
- quote: "`AccountHub` reads `?section=` only in its `useState` initializer, which doesn't re-run on a query-string-only navigation ... noted for visibility, not fixed."
- kind: defect
- artifacts: AccountHub, /app/account?section=, src/pages/app/CalendarPage.tsx
- decision-mention: none

### ITEM [batch3.md#25]
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: No browser was opened this session — all I1–I5 UI work is code-complete, browser pending.
- quote: "No browser was opened this session (SQL + TypeScript only...). Everything above is \"code-complete, browser pending\""
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, src/components/app/AccountPanels.tsx
- decision-mention: none

---

### ITEM [batch3.md#63]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Saved Content becomes unreachable from mobile nav entirely once the avatar menu is removed (I6 deliberately excluded it from the drawer on the premise the avatar menu still listed it) — owner must decide: add to drawer (breaking I6) or accept the loss.
- quote: "Once it's gone, that sentence's premise is gone too: Saved Content becomes unreachable from mobile nav entirely ... This needs an explicit call"
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx (I6 comment 475-490), /app/account?section=saved
- decision-mention: none

### ITEM [batch3.md#64]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B3's literal scope (RailLink only) would leave two different active-state styles side by side in one drawer list — PresenceLink, AccountNavLink and CommunityNav's nested links hand-copy the same cream-fill convention; owner should decide all-four vs RailLink-only.
- quote: "If only `RailLink` changes, a member's own drawer will show **two different active-state styles side by side in one list**"
- kind: blocked-on-owner
- artifacts: RailLink, PresenceLink, AccountNavLink, CommunityNav, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch3.md#65]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Staff have no personal Account link in the mobile drawer today at all — removing the avatar dropdown without adding one strands instructors and admins from their account page on mobile; placement is net-new with no existing position to preserve.
- quote: "**Staff have no personal Account link in the mobile drawer today, at all.** ... Removing the avatar dropdown without adding one strands instructors and admins"
- kind: defect
- artifacts: src/components/app/AppLayout.tsx (showRail branch), /app/account
- decision-mention: none

### ITEM [batch3.md#79]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: The whole Records page has never been looked at rendered — no staff browser session; a 10-step manual walkthrough is specified for the owner.
- quote: "**NOT VERIFIED — no staff browser session exists in this environment.** Nobody has looked at this rendered. Walk this by hand:"
- kind: not-verified
- artifacts: RecordsPage.tsx, /app/records, ContactDirectory, HorseRecordsPage
- decision-mention: none

### ITEM [batch3.md#80]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Pre-existing defect flagged again, not fixed: ContactForm's create path does not set contact_type on any tab, so a contact created from any tab (All included) lands Unfiled regardless.
- quote: "`ContactForm`'s create path does not set `contact_type` on any tab today (a pre-existing defect, first named in the DUPECENSUS/REVIEWNAV reports) ... Not fixed here; flagged again below."
- kind: defect
- artifacts: ContactForm, ContactsPage.tsx
- decision-mention: none

### ITEM [batch3.md#82]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Caveat: person→horse links navigate away to /app/horses/:id (route change), not a same-page expansion like the new horse→person modal — recorded rather than smoothed over.
- quote: "those links navigate to the member-facing horse page, a route change, not a same-page expansion the way the new horse→person link is. Recorded rather than smoothed over."
- kind: caveat
- artifacts: ClientHorseRecordsCard, /app/horses/:id
- decision-mention: none

### ITEM [batch3.md#83]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: A second, inert "Horses" section renders in the dossier duplicating ClientHorseRecordsCard's information as plain text — pre-existing quirk, not touched.
- quote: "A second, INERT \"Horses\" section (`Section title=\"Horses\"` / `Row`) also renders in the same dossier — pre-existing, plain text, not a link, and not touched"
- kind: cosmetic
- artifacts: ContactDossierModal
- decision-mention: none

### ITEM [batch3.md#103]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-003/UIO-013 scope guess flagged: the hover sweep was applied to the nav-rail family only; MenuLink and the account-menu-dropdown block (~lines 1132-1268) still carry the old hover:bg-navfill/64 fill — unverified against what the owner was actually looking at.
- quote: "the account-menu-dropdown-shaped block (`MenuLink` and the block around what's now lines 1132-1268) still carries the old `hover:bg-navfill/64` fill untouched. ... Flagging in case that scope guess was too narrow."
- kind: caveat
- artifacts: MenuLink, src/components/app/AppLayout.tsx:1132-1268
- decision-mention: none

### ITEM [batch3.md#112]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-012 scope flag: the order said the Add New divider "applies to both rails" but the client rail has no create control at all — divider added only to the staff rail rather than inventing a control.
- quote: "Checked `ClientRail`'s render and found no create control above its list at all ... Added the divider only where a create control actually exists"
- kind: deviation
- artifacts: ClientRail, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch3.md#118]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-016 correction: the order's premise about the "p-3 plus px-3" comment being wrong doesn't hold — the comment describes the staff-rail icon strip and was already correct; left untouched with reasons rather than edited because the order said to.
- quote: "**The order's premise about the flagged comment doesn't hold, and I didn't edit it.** ... the comment was already correct for the code path it actually describes"
- kind: correction
- artifacts: src/components/app/AppLayout.tsx (I1B staff rail icon strip comment), ClientRail
- decision-mention: none

### ITEM [batch4.md#22]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: "Saved items" can never contain anything — SEED_ENABLED=false, my_nav_presence returns saved=false as a literal, and no bookmark/save control exists anywhere.
- quote: "'Saved items' can never contain anything ... There is no bookmark or save control anywhere in `src/` ... The row exists on the Account hub and the nav link exists ... gated by a flag hardcoded to false."
- kind: correctness
- artifacts: seed.ts, SavedPanel, my_nav_presence, PRESENCE_LINKS
- decision-mention: none

### ITEM [batch4.md#24]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: /account is the default post-login/OAuth/reset destination yet immediately redirects members, so members pass through a redirecting page; OrderDetail "Back to your account" points there too.
- quote: "`/account` is also the default post-login destination ... so members pass through a page that immediately redirects them."
- kind: correctness
- artifacts: Login.tsx, Account.tsx, OrderDetail.tsx
- decision-mention: none

### ITEM [batch4.md#29]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two writes on the member's own account (updateMyContactPhone, upsertMyProfile) do not use assertWrote/.select, contrary to CLAUDE.md's stated rule, so they do not prove they landed.
- quote: "Two writes on the member's own account do not prove they landed ... `updateMyContactPhone` ... with no `.select()` and no `assertWrote`. `upsertMyProfile` ... with no `.select()` and no `assertWrote`."
- kind: defect
- artifacts: updateMyContactPhone (lib/api.ts:451), upsertMyProfile (lib/api.ts:421), ProfileCard, Account.tsx
- decision-mention: none

### ITEM [batch4.md#30]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: "Close without saving" does not discard contact fields — ProfileCard writes one DB write per keystroke via set(), errors are swallowed by .catch() with no retry, and Close only sets editing false.
- quote: "'Close without saving' does not discard the contact fields ... That is one database write per keystroke, committed immediately. ... The `.catch()` discards the error and leaves the new value on screen; there is no retry mechanism"
- kind: defect
- artifacts: ProfileCard, saveMyContactPrefs
- decision-mention: none

### ITEM [batch4.md#32]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Emergency contacts are presented as immutable ("not editable") but are writable by staff, by member onboarding, and by the member's own API session.
- quote: "Emergency contacts are presented as immutable and are not ... What the card says is true of *that card*, not of the field."
- kind: correctness
- artifacts: AccountInfoCard, update_contact_record, update_my_onboarding_profile
- decision-mention: none

### ITEM [batch4.md#40]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Could not determine whether the 13 accountless contacts' hide_* flags were set deliberately — exact correlation reads as a backfill but no migration line found.
- quote: "Whether the 13 accountless contacts' `hide_*` flags were set deliberately. The correlation with 'has no account' is exact, which reads as a backfill, but I found no migration line that sets them"
- kind: not-verified
- artifacts: contacts hide_* flags
- decision-mention: none

### ITEM [batch4.md#49]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-2 — OpsDashboard's intake number (12, counts new+contacted) disagrees with the Dashboard's (7, new only); two staff landing surfaces state the same concept differently, never reconciled.
- quote: "D-2 · Its intake number disagrees with the Dashboard's. ... Two staff landing surfaces state the same concept as 12 and 7. Neither is wrong on its own terms; they were never reconciled."
- kind: correctness
- artifacts: countPendingIntake, useOpenLeads, OpsDashboard, DashboardPanel, InstructorHome
- decision-mention: D-2

### ITEM [batch4.md#52]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-5 — Every InstructorHome row is named "Client" as a literal; the query selects client_id with no join so the name isn't in the payload.
- quote: "D-5 · Every row is named 'Client'. `toRow` sets `who: 'Client'` as a literal ... Fixing this needs a join or a second lookup, not a one-line change."
- kind: defect
- artifacts: InstructorHome, toRow, LESSON_BOOKING_COLS
- decision-mention: D-5

### ITEM [batch4.md#53]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-6 — InstructorHome's "Clients" tile points at retired route /app/ops/contacts which redirects to /app/admin.
- quote: "D-6 · Its 'Clients' tile points at a retired route. It links `/app/ops/contacts`, which redirects to `/app/admin` (Phase 1 X-1). Works, but via a redirect."
- kind: defect
- artifacts: InstructorHome, /app/ops/contacts
- decision-mention: D-6

### ITEM [batch4.md#63]
- report: TASK-COMPANYFIX-REPORT.md
- date: 2026-08-05
- item: The specified adversarial proof (insert a second is_company contact in the same org) cannot be executed — blocked by the one_company_contact_per_org partial unique index; not run as specified.
- quote: "Proof 2 — adversarial rolled-back test: BLOCKED BY A REAL CONSTRAINT, not run as specified ... This cannot be executed, in one transaction or any number of retries, because `contacts` already carries: `one_company_contact_per_org`"
- kind: blocked-on-owner
- artifacts: one_company_contact_per_org, contacts, company_contact_id()
- decision-mention: none

### ITEM [batch4.md#107]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Open question 2 — was the staff rail meant to go green too? Built green (interpretation), flagged; reverting alone means a second palette for five shared components.
- quote: "**Was the staff rail meant to go green too?** Built green, for the reason in §3. Reverting it alone means giving the five shared row components a second palette."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, RailLink, PresenceLink, AccountNavLink, CommunityNav, NavFooter
- decision-mention: none

### ITEM [batch5.md#63]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The account dropdown's max-h-[calc(100dvh-5rem)] still assumes the old 3.5rem header and can overflow by ~12px under the 88px phone header — left alone (scrolls internally), trivially retunable with --cs-hdr-h.
- quote: "With an 88px header on a phone it can overflow by ~12px. Left alone (it scrolls internally); trivial to retune with `--cs-hdr-h`."
- kind: cosmetic
- artifacts: AppLayout.tsx (account dropdown)
- decision-mention: none

### ITEM [batch5.md#64]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for PLUSPASS — a regular member now has no create affordance in the header at all (old + button gone, Create tab admin/staff-only, hidden on mobile even for staff); a live gap until page-level + controls land.
- quote: "a regular member now has **no create affordance in the header at all** ... until then it is a live gap."
- kind: known issue
- artifacts: CardstockHeader.tsx, CreateModal
- decision-mention: none

### ITEM [batch5.md#78]
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Process failure recorded — the migration carried its own BEGIN/COMMIT, so the house dry-run wrapper's ROLLBACK hit no transaction and the "dry" run applied to production for real, before verification; psql warned twice and the warnings were missed.
- quote: "the \"dry\" run applied for real, and the `ROLLBACK` hit no transaction. psql said so twice ... and I should have stopped on the first warning."
- kind: process
- artifacts: supabase/migrations/20260810T1730_inviteflow_category_is_evidence.sql
- decision-mention: none

### ITEM [batch5.md#81]
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: api/admin-send-invitation.ts:229 catches everything and returns a flat "could not create invitation" — the same error-discarding pattern the horse form had; worth the same fix.
- quote: "`api/admin-send-invitation.ts:229` catches everything and returns a flat `\"could not create invitation\"`. Same discard the horse form had; worth the same fix."
- kind: defect
- artifacts: api/admin-send-invitation.ts
- decision-mention: none

### ITEM [batch5.md#82]
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Queued, not started — the invite page fields, the booking calendar, the contact-record edit mode, and the "File Under" row.
- quote: "The invite page fields, the booking calendar, the contact-record edit mode, and the \"File Under\" row — queued, not started."
- kind: deferred
- artifacts: invite page, booking calendar, contact-record edit mode
- decision-mention: none

### ITEM [batch5.md#101]
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: Decision deliberately not made — member_directory_list gates on authenticated, not membership, so a non-member account holder can still read the directory; there is a pre-existing drift between D8 (community = account-gated) and is_active_member() gating the other community tables; one-line change offered if the owner rules members-only.
- quote: "There is a genuine drift here between D8 (community = account-gated) and the implementation (`is_active_member()` gates the other community tables). ... resolving it is an owner call."
- kind: blocked-on-owner
- artifacts: member_directory_list(uuid), is_active_member()
- decision-mention: D8

### ITEM [batch5.md#102]
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: No browser click-through — /app/community and member profile pages were not loaded; the React layer having nothing new to handle is reasoning, not observation.
- quote: "**No browser click-through.** ... but that is reasoning, not observation."
- kind: not-verified
- artifacts: /app/community, src/lib/community.ts, MemberProfile.tsx
- decision-mention: none

### ITEM [batch5.md#103]
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: PostgREST schema-cache reload not verified — if member_directory_list 404s from the client immediately after deploy, `NOTIFY pgrst, 'reload schema'` is the fix; PostgREST was not restarted or poked.
- quote: "If `member_directory_list` 404s from the client immediately after deploy, `NOTIFY pgrst, 'reload schema';` is the fix. I did not restart or poke PostgREST."
- kind: not-verified
- artifacts: member_directory_list(uuid), PostgREST
- decision-mention: none

### ITEM [batch5.md#106]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: The nav diff was NOT applied because AppLayout.tsx is contended — the page sits under the Review section via REVIEW_GROUPS; on acceptance, move it with a one-line SETTINGS_GROUP addition (diff supplied).
- quote: "## The nav diff — NOT applied (AppLayout.tsx is contended)"
- kind: deferred
- artifacts: src/components/app/AppLayout.tsx, src/lib/reviewSection.ts
- decision-mention: none

### ITEM [batch5.md#114]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Cosmetic nav note relayed — OPEN-CHANGE-REQUESTS note A9 flags eight identical Shield glyphs in the settings nav; a distinct icon (e.g. FileText) would serve better when the rename-to-Configuration lands.
- quote: "Note A9 in OPEN-CHANGE-REQUESTS flags the eight identical `Shield` glyphs — a distinct icon, e.g. `FileText`, would serve better"
- kind: cosmetic
- artifacts: AppLayout.tsx SETTINGS_GROUP
- decision-mention: none

---

### ITEM [batch5.md#116]
- report: TASK-UIPOLISH-REPORT.md
- date: 2026-08-05
- item: Lessons nav inclusion (I6) is built in and module-gated but awaits the owner's go/no-go; removal is a one-line drop in ClientNavItems plus a small block in AppOverviewModal.tsx.
- quote: "**Lessons inclusion (I6, item 1's footnote)** — built in, module-gated, awaiting the owner's go/no-go"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx (ClientNavItems), AppOverviewModal.tsx
- decision-mention: none

### ITEM [batch5.md#117]
- report: TASK-UIPOLISH-REPORT.md
- date: 2026-08-05
- item: npm run build:client fails at the copy step with ENOSPC — the host disk is at 99% capacity (134Mi free), unrelated to the change and not fixed (all 2084 modules transform successfully first).
- quote: "The step then fails copying `public/ffmpeg/ffmpeg-core.wasm` into `dist/` with `ENOSPC` — this environment's disk is at 99% capacity"
- kind: known issue
- artifacts: build environment, public/ffmpeg/ffmpeg-core.wasm
- decision-mention: none

---

# INVENTORY

### ITEM [batch6.md#10]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Profile-label question presented but not decided — whether "Profile & preferences" becomes "My Profile & Preferences" or stays exempt.
- quote: "I'm not picking one — flagging it back per the task's own instruction ('Ask; do not decide')."
- kind: blocked-on-owner
- artifacts: AccountHub.tsx
- decision-mention: none

### ITEM [batch6.md#11]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Account page's "My lessons" row has no lessonsOn gate — it always renders even when the lessons module is off, promising a destination that only shows the lock screen.
- quote: "the Account page's 'My lessons' row (AccountHub.tsx:211) has no lessonsOn gate at all ... currently promises a destination that just shows the module's lock screen ... flagging it here since it's adjacent, not fixing it."
- kind: defect
- artifacts: AccountHub.tsx, AppLayout.tsx, MyLessons.tsx
- decision-mention: none

### ITEM [batch6.md#13]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Nav rail labels are internally inconsistent — Stable link labeled "Stable" in one surface and "My Stable" in another; lessons destination labeled "Lessons" with no "My" prefix, colliding with the public /lessons route.
- quote: "Two different labels for one destination, in two different nav surfaces, today ... The in-app rail calling the personal one just 'Lessons' is the exact collision pattern the 'My' rule exists to prevent"
- kind: cosmetic
- artifacts: AppLayout.tsx (PRESENCE_LINKS, ClientNavItems, RailLink), App.tsx
- decision-mention: none

### ITEM [batch6.md#15]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Orders' list item navigates to /order/:id outside /app — noted so it isn't discovered as a surprise in Phase 2 (Orders won't be fully click-free even when expanded in place).
- quote: "'Orders expands in place' doesn't make the whole subject click-free — noting it so it isn't discovered as a surprise in Phase 2 review."
- kind: process
- artifacts: Orders.tsx
- decision-mention: none

### ITEM [batch6.md#32]
- report: TASK-F3-REPORT.md
- date: (no header date; status CODE-COMPLETE, BROWSER PENDING)
- item: Browser verification pending — a rider account has not clicked through the actual SessionNotesView UI; verified only by type/lint checks and a rolled-back RPC proof.
- quote: "Browser verification is pending — not done in this session (no browser available in this environment). ... a rider account has not yet clicked through the actual UI."
- kind: not-verified
- artifacts: SessionNotesView.tsx, CalendarPage.tsx, MyLessons.tsx
- decision-mention: none

### ITEM [batch6.md#43]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Defect A (reported, not fixed) — a microchip of "N/A" hijacks the next owner's horse via server-side text match in create_horse_record; latent today but the N/A-save fix makes it reachable.
- quote: "a microchip of 'N/A' hijacks the next owner's horse. Proven. ... the fix above is what lets people save an N/A microchip in the first place, so this moves from latent to reachable. The client cannot fix it; the match is server-side."
- kind: data-integrity
- artifacts: create_horse_record, horse_reconciliation
- decision-mention: none

### ITEM [batch6.md#89]
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: No live contact has consumed a horse-care service yet — the horse-owner row in the positional screenshot is a clearly-labeled synthetic demo row; no prod data fabricated.
- quote: "No live contact has consumed a horse-care service yet ... The horse-owner row in the positional screenshot is therefore a clearly-labeled synthetic demo row"
- kind: not-verified
- artifacts: RosterRow, roster_service_slots, bookings
- decision-mention: none

### ITEM [batch6.md#90]
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: Screenshot produced through a temporary local harness (no staff credentials in this environment, same wall ACCOUNTSURFACE hit); an in-browser authenticated click-through is still owed.
- quote: "no staff credentials exist in this environment (same wall the ACCOUNTSURFACE thread hit). Harness deleted before commit; an in-browser authenticated click-through is still owed when the owner is logged in."
- kind: not-verified
- artifacts: Admin.tsx, admin_client_accounts, roster_service_slots
- decision-mention: none

### ITEM [batch6.md#91]
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: is_admin() behavior verified by simulating the admin JWT in psql, not via a browser session.
- quote: "is_admin() behavior was verified by simulating the admin JWT (request.jwt.claims) in psql, not via a browser session."
- kind: not-verified
- artifacts: is_admin()
- decision-mention: none

### ITEM [batch6.md#92]
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: Lead lifecycle context noted, not built — whatever converts a worked lead should set contact_type='CONTACT' or create the clients row/account through the provisioning spine; roster picks it up automatically.
- quote: "Lead lifecycle (context noted, not built) ... whatever flow does the conversion should set contact_type = 'CONTACT' ... no roster-side change is needed."
- kind: process
- artifacts: contact_type, clients, LeadsPage
- decision-mention: none

### ITEM [batch6.md#94]
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: The old Active-first sort key was dropped when porting sort verbatim from ContactsPage.
- quote: "The old Active-first sort key is gone with the port."
- kind: correctness
- artifacts: Admin.tsx, ContactsPage
- decision-mention: none

---

### ITEM [batch6.md#95]
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: Follow-up (not actioned) — suggested_category_for_contact(uuid) still lists RIDER_LESSON / RIDER_LESSON_JUMPER in a now-dead IN branch; cosmetic, behavior unchanged, needs a live function-body rewrite so wants its own task.
- quote: "suggested_category_for_contact(uuid) still lists RIDER_LESSON / RIDER_LESSON_JUMPER in a dead IN branch. Cosmetic; behavior is unchanged. Requires a live function-body rewrite, so it wants its own task. Left in place."
- kind: correctness
- artifacts: suggested_category_for_contact, src/lib/admin.ts
- decision-mention: none

### ITEM [batch7.md#7]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: The two nav call sites in AppLayout.tsx still point at /app/account?section=stable; until ONEMENU repoints them the Stable nav is not a direct link (works only via redirect).
- quote: "the two nav call sites in `AppLayout.tsx` still point at `/app/account?section=stable` — that file is ONEMENU's, not touched here."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, /app/stable, /app/account
- decision-mention: none

### ITEM [batch7.md#8]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: My Posts' "+ Post" create button stays page-only; no create control was added to the Account panel's inline version — a considered omission flagged for the owner.
- quote: "My Posts' "+ Post" button (PLUSPASS) stays page-only ... Flagging it as a considered omission, not an oversight, in case the owner wants it added."
- kind: blocked-on-owner
- artifacts: MyPostsContent, AccountPanels.tsx
- decision-mention: none

### ITEM [batch7.md#10]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: The section order (10 rows) is not owner-ranked; today's relative order was preserved plus one placement call for two new rows, awaiting owner ranking.
- quote: "This still needs the owner's ranking — I did not decide a final order, only preserved what exists plus the one placement call above"
- kind: blocked-on-owner
- artifacts: AccountHub.tsx
- decision-mention: none

### ITEM [batch7.md#11]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: My Lessons' Account-row icon changed from Boxes to GraduationCap to remove a duplicate-icon collision — a deliberate change flagged.
- quote: "My Lessons' icon changed from `Boxes` to `GraduationCap` on the Account row ... flagging it as a deliberate change rather than something that crept in."
- kind: cosmetic
- artifacts: AccountHub.tsx, MyLessonsContent
- decision-mention: none

### ITEM [batch7.md#13]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: Worktree has no Supabase credentials, so the 390px screenshot and the runtime halves of items 2/4/5/7 could not be done; app throws supabaseUrl is required.
- quote: "This worktree has no Supabase credentials ... I could not log in, could not click through, and could not take the requested screenshot. This is not a gap I can close myself"
- kind: blocked-on-owner
- artifacts: /app/stable, HorseIntakeForm, StableSection
- decision-mention: none

### ITEM [batch7.md#14]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: Runtime behavior (stable render, add flows, redirect firing, accordion at 390px) is assumed from code correctness, not verified in a running browser.
- quote: "Assumed, not runtime-verified: everything gated behind an authenticated session ... These rest on the code being correct ... rather than on having watched them run."
- kind: not-verified
- artifacts: /app/stable, AccountHub.tsx
- decision-mention: none

### ITEM [batch7.md#17]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: R-3 — /app/ops/intake (the largest ops page) is reachable only when the lead list is non-empty; with an empty list there is no route to the page.
- quote: "`/app/ops/intake` is reachable only when there is work in it ... With an empty lead list there is no route to the page."
- kind: defect
- artifacts: /app/ops/intake, IntakePage, DashboardPanel.tsx
- decision-mention: none

### ITEM [batch7.md#19]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: N-1 / X-1 — the Contacts retirement is half-applied: the /app/ops/contacts route redirects but the nav item is still shown, so Clients and Contacts both land on /app/admin.
- quote: "The Contacts retirement is half-applied — two nav rows, one page ... `CONTACTS_PAGE_RETIRED` is referenced only in `App.tsx`, never in `AppLayout.tsx`"
- kind: defect
- artifacts: ContactsPage.tsx, AppLayout.tsx, App.tsx, CONTACTS_PAGE_RETIRED
- decision-mention: none

### ITEM [batch7.md#22]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-1 — no admin order surface of any kind; /app/orders is the member's own list, hidden from admin.
- quote: "Orders (business) | Nothing. `/app/orders` is the member's own order list ... and is hidden from admin. No admin order surface of any kind."
- kind: inventory
- artifacts: /app/orders, OrdersContent
- decision-mention: none

### ITEM [batch7.md#25]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-4 — Sales KPIs/P&L/expenses backend is written but unapplied, and no client code exists for its 8 objects.
- quote: "Sales KPIs / P&L / expenses | Backend written and unapplied ... No client code exists either — nothing in `src/` references any of its 8 objects"
- kind: inventory
- artifacts: 20260726090000_biz_expenses_and_financials.sql, sales_summary, business_kpis, profit_and_loss
- decision-mention: none

### ITEM [batch7.md#35]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: N-3 — three nav entries share the Contact icon (Leads, Team, Contacts) and three share Shield (all of Settings); noted only, icon exercise not re-opened.
- quote: "Three nav entries share the `Contact` icon (Leads, Team, Contacts) and three share `Shield` (all of Settings)."
- kind: cosmetic
- artifacts: AppLayout.tsx
- decision-mention: none

### ITEM [batch7.md#41]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #4 — save_calendar_item's edit branch overwrites client_id/purchase_id/offering_id/horse_id unconditionally, so a partial payload silently clears them; latent, not changed.
- quote: "`save_calendar_item`'s edit branch overwrites unconditionally ... Not changed — tightening it risks breaking intentional clearing."
- kind: defect
- artifacts: save_calendar_item
- decision-mention: none

### ITEM [batch7.md#79]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #2 — 294 bookings have client_id NULL; the guard is now safe but the data question stands (should staff-created bookings carry a client, what is a NULL one for). Worth a ruling.
- quote: "294 bookings have `client_id` NULL. The guard is now safe, but the data question stands ... Worth a ruling."
- kind: blocked-on-owner
- artifacts: bookings.client_id
- decision-mention: none

### ITEM [batch7.md#108]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — argument-typed composite functions (horse_field_token_value, booking_notifies_client, booking_service_type take whole table rows) are under-tested; ranked low by reasoning, not test.
- quote: "Argument-typed composite functions are under-tested ... I ranked them low on that reasoning rather than on a test."
- kind: not-verified
- artifacts: horse_field_token_value, booking_notifies_client, booking_service_type
- decision-mention: none

### ITEM [batch7.md#122]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Urgent finding — provision_client_invitation, the canonical account-provisioning spine, has ZERO test coverage; every provisioning test is written against a function that no longer exists. A follow-up task worth opening.
- quote: "`provision_client_invitation` — the canonical account-provisioning spine ... has ZERO test coverage ... That is a follow-up task worth opening on its own."
- kind: process
- artifacts: provision_client_invitation, test/db/
- decision-mention: none

### ITEM [batch8.md#23]
- report: TASK-A13-REPORT.md
- date: 2026-08-04
- item: No positive-path proof was run for book_open_slot's new lesson-branch gate because the lessee contact has no lesson_credits row; skipped rather than manufacturing a credit row.
- quote: "A positive case for `book_open_slot` wasn't run: the lessee contact has no `lesson_credits` row, so it would only prove the horse-gate passes before failing later on `NO_CREDITS`"
- kind: not-verified
- artifacts: book_open_slot, lesson_credits
- decision-mention: none

### ITEM [batch8.md#65]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Superadmin's live chrome was not re-verified — the isSuperAdmin conditionals restoring original drawer behavior were checked by code trace only, no superadmin credentials.
- quote: "**Superadmin's live chrome**, to confirm the `isSuperAdmin` conditionals actually produce byte-identical behavior to before, not just correct-looking code."
- kind: not-verified
- artifacts: AppLayout.tsx (isSuperAdmin branches), accountMenu
- decision-mention: none

### ITEM [batch8.md#67]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Follow-up owed — ClientNavItems' Stable link still points at /app/account?section=stable; ACCOUNTSURFACE must ping this thread once /app/stable ships so the one-line repoint can be made.
- quote: "**ACCOUNTSURFACE needs to ping this thread once `/app/stable` ships** — repointing is a one-line change at that point ... but it wasn't safe to do blind."
- kind: follow-up
- artifacts: AppLayout.tsx (ClientNavItems PresenceLink), /app/stable
- decision-mention: none

### ITEM [batch8.md#96]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Pixel-level rendering in a real browser was assumed, not verified — jsdom/React Testing Library only, no browser session in the environment.
- quote: "**Assumed, not verified:** pixel-level rendering in a real browser — no browser session is available in this environment"
- kind: not-verified
- artifacts: AppLayout.tsx, Onboarding.tsx, wallReturn.ts
- decision-mention: none

### ITEM [batch8.md#97]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Assumed by reading, not fuzzing — that enterApp() is the only place onboarding ever navigates the member away.
- quote: "Also assumed: that `enterApp()` is genuinely the *only* place onboarding ever navigates the member away without going through it — checked by reading every `navigate(` call site ... not by exhaustively fuzzing every UI path."
- kind: not-verified
- artifacts: src/pages/app/Onboarding.tsx (enterApp)
- decision-mention: none

### ITEM [batch8.md#98]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Judgment call flagged — the return fires on enterApp() (all onboarding requirements done) rather than the instant the wall clears, deliberately trading literal wording for not yanking a member away mid-flow.
- quote: "Flagging this trade-off explicitly since it's a judgment call, not a re-derivation of the task's wording."
- kind: process
- artifacts: enterApp, my_wall_state, consumeWallReturnDestination
- decision-mention: none
