# FLAGHARVEST pass 2 — verified slice: IDENTITY

Worktree: /Users/cactai/Downloads/claude-code-repo/wt-flagharvest (86283dc, = origin/main 6a58c0f).
Prod DB queried read-only via `psql "$(head -1 .env.db)"`. No code changed.

---

## ID-01: ContactForm's create path never sets contact_type
- item: Creating a person through the shared contact form files them as CONTACT regardless of which tab you created them from, so the new person does not appear in the list you created them in.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12, two entries); TASK-REVIEWNAV-REPORT.md (2026-08-12); TASK-RECORDS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/components/ops/contacts/ContactForm.tsx:50-55` assembles `ContactInput` with exactly `first_name, last_name, email, phone` — no `contact_type`. `src/pages/app/ops/ContactsPage.tsx:225-230` calls `createContact(input)` unchanged; `src/lib/api.ts:1028-1036` is a bare `.from('contacts').insert(input)`. Prod: `select column_default, is_nullable from information_schema.columns where table_name='contacts' and column_name='contact_type'` → `'CONTACT'::text | NO`. The form is now MORE reachable than when this was raised: `ContactDirectory` (the same file) is the renderer behind the live Records tabs (`RecordsPage.tsx:86-90` → AllRecordsPage/LeadsPage/PartnersPage/VendorsPage), so a "New lead"/"New vendor"/"New partner" press still lands the row on the Clients tab.
- decision-note: none
- cost-rank: 1
- recommendation: Pass the active mode's `contact_type` into `createContact` (the mode is already in scope as `MODE_TYPE[mode]` at ContactsPage.tsx:209), or rebuild the create path on `update_contact_record`. Fix this before any further people-page consolidation, or the consolidation re-ships it.

## ID-02: The review-route mount of ContactForm has a deliberately inert submit
- item: The one review mount that is not byte-identical to production is the contact form, whose submit refuses because its real create path carries ID-01.
- sources: TASK-REVIEWNAV-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/pages/app/ops/review/ReviewMounts.tsx:100-111` — the banner says "Submit is inert here" and `onSubmit` is `async () => { setError('Review mount — nothing was saved…') }`. Validation, layout and cancel are the real component.
- decision-note: none
- cost-rank: 6
- recommendation: Leave inert until ID-01 is fixed; then either wire it or delete the mount with the rest of the Review section.

## ID-03: Two contact editors with two field sets and two write paths on one page
- item: A person on the people pages can be edited through a 30-field RPC-backed dossier or a 4-field direct-table form, and which you get depends on where you clicked.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Both survive and both are mounted from the same file. `src/pages/app/ops/ContactsPage.tsx:16` imports `ContactForm`, renders it at `:544-548` from the `onAdd`/`Edit` controls (`:284`, `:491`); `src/components/app/ContactDossierModal.tsx` is the other editor (its Horses block at `:238` and `:267`). Never seen side by side in a browser.
- decision-note: none
- cost-rank: 5
- recommendation: Pick the dossier (RPC writes, 30 fields) and retire the 4-field form after carrying ID-05's items across.

## ID-04: ContactDossierModal and ContactForm had no route and could not be reviewed
- item: Two contact components took props rather than URL params, so nobody could look at them.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: commit `aca38d7` (2026-08-12, "feat(reviewnav): a temporary Review section that puts every duplicate side by side") created `src/pages/app/ops/review/ReviewMounts.tsx`, which mounts both against a real production contact; `src/lib/reviewSection.ts` carries 33 review slots and `src/App.tsx` registers the routes.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing. Delete the mounts when the owner accepts the comparisons.

## ID-05: Carry FormField usage + pre-submit validation across before ContactForm is retired
- item: If the 4-field form goes, its FormField primitives, its inline pre-submit validation and an RPC-based create that passes contact_type must be rebuilt on the survivor.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `ContactForm.tsx:3` imports `FormField` from `lib/ops`; `:41-48` blocks an empty first name before the data fn is reached. `ContactDossierModal.tsx` has no equivalent import. Nothing has been retired: both components still exist and are both reachable.
- decision-note: none
- cost-rank: 4
- recommendation: Fold into whatever task actually performs the retirement; do not retire without it.

## ID-06: The "Unfiled" banner + file(id,type) control is the only contact_type setter
- item: The filing control on the old Contacts page was the only place in the app that can set contact_type and had to be carried into the composed page.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: The control was not moved — the file that holds it BECAME the Records renderer. Commit `d7b9f49` / merge `af8420a` (2026-08-12, TASK-RECORDS): `RecordsPage.tsx:86-90` renders `AllRecordsPage/LeadsPage/PartnersPage/VendorsPage`, all of which are `ContactDirectory` in `src/pages/app/ops/ContactsPage.tsx:569-592`. The `file()` helper (`:213-222`, calls `setContactType`), the Unfiled banner (`:287-301`) and the "Filed under" picker with the full type list (`:419-427`) are all inside it and live. Separately, prod now makes the null case unreachable: `contacts.contact_type` is NOT NULL default `'CONTACT'`, and `select coalesce(contact_type,'(null)'), count(*) from contacts where deleted_at is null group by 1` → CONTACT 17, LEAD 6, TEAM 4, no nulls.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-07: The four TEAM-typed contacts appear on no people page
- item: CJ Z, Claire Bourdon, French Heritage Equestrian and CACTAI INC. are filed TEAM and no surface lists them.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Prod `select first_name, last_name, contact_type from contacts where contact_type='TEAM' and deleted_at is null` → the same 4 rows. `ContactsPage.tsx:207-209` explicitly excludes them from the Records "All" tab (`mode === 'all' ? !!r.contact_type && r.contact_type !== 'TEAM'`), with the comment "TEAM, which lives in Configuration, not on this page". But `/app/ops/team` (`src/pages/app/ops/TeamPage.tsx`) lists `adminListMembers()` — profiles with internal ROLES — not TEAM-typed contacts; it never reads `contacts`. `admin_client_accounts` still filters `AND (c.contact_type = 'CONTACT' OR c.contact_type IS NULL)` (pg_proc body line 54). `ContactDirectory` as a standalone file no longer exists (`find src -name "ContactDirectory*"` → nothing; it is a function inside ContactsPage.tsx).
- decision-note: D1/D1a bear on this — the company contact and the two staff identities are protected FHE/platform identities. Noted only; the item's factual status is unchanged.
- cost-rank: 3
- recommendation: Owner ruling: either add a TEAM tab/section (probably on the Team page, reading contacts not profiles) or state that TEAM contacts are intentionally invisible. Right now four production rows are unreachable from any UI.

## ID-08: The ContactsPage retirement was half-applied — nav row still shown
- item: The /app/ops/contacts route redirected but the nav still carried a Contacts entry, so two nav rows landed on one page.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11); TASK-ROSTERCARD-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: CLOSED BY LATER WORK
- evidence: commit `0687429` (2026-08-12, "fix(nav): remove the Contacts entry (it redirected to Clients); Leads takes Users, Clients takes Contact — ADMINSWEEP X-1"). Current `src/components/app/AppLayout.tsx` `ACCOUNTS_GROUP` (`:538-569`) has no Contacts entry at all — it now holds one row, `{ to: '/app/records', label: 'Records', icon: BookOpen }`. Route still redirects: `src/App.tsx:297-299` → `<Navigate to="/app/records/clients" replace />`.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-09: InstructorHome's "Clients" tile points at the retired /app/ops/contacts
- item: The instructor landing page's Clients tile links a retired route and reaches the real page only via a redirect.
- sources: TASK-ADMINSWEEP-PHASE2.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/pages/app/InstructorHome.tsx:145` — `<ActionTile to="/app/ops/contacts" … label="Clients" …>`. The redirect target has since MOVED (`App.tsx:297` now goes to `/app/records/clients`, not `/app/admin`), so the tile still works but through a hop, and the report's stated destination is now stale.
- decision-note: none
- cost-rank: 6
- recommendation: One-line repoint to `/app/records/clients`.

## ID-10: Every InstructorHome row is literally named "Client"
- item: The instructor's session list shows "Client" as the person on every row because the query selects client_id with no join.
- sources: TASK-ADMINSWEEP-PHASE2.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/pages/app/InstructorHome.tsx:44-45` — `function toRow(s: LessonSession): Row { return { …, who: 'Client', … } }`. The sibling mapper at `:48` uses `s.rider`, so the shape exists; the lesson-session path has no name in its payload.
- decision-note: D3 bears on wording (staff surfaces display "client"). Noted only.
- cost-rank: 1
- recommendation: Add the contact join to the lesson-session read, or a second lookup keyed on client_id. Not a one-liner, as the report said.

## ID-11: InstructorHome cannot be judged from code — the owner must open the preview
- item: The instructor landing page has never rendered for a real account (no non-admin staff exists in production), so it must be looked at before it is judged, and the preview route must stay.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Route still present: `src/App.tsx:286` `ops/preview/instructor-home` → `<InstructorHomePreview />`; also listed as review slot C in `src/lib/reviewSection.ts:132`. Prod still has no MANAGER/EMPLOYEE account (the GUARDREST migration header, `supabase/migrations/20260812T1210_guardrest_staff_rls_matches_the_nav.sql:11`, records "SUPER_ADMIN(1), USER(10) and no MANAGER or EMPLOYEE"). No owner verdict is recorded anywhere in the tree.
- decision-note: none
- cost-rank: 3
- recommendation: Owner opens `/app/ops/preview/instructor-home` and rules keep/retire. Do not delete the preview route first.

## ID-12: OpsDashboard's intake number disagreed with the Dashboard's (12 vs 7)
- item: Two staff landing surfaces stated the same "inbound work waiting" concept as two different numbers.
- sources: TASK-ADMINSWEEP-PHASE2.md (2026-08-11)
- raised: 2026-08-11
- status: CLOSED BY LATER WORK
- evidence: commit `20acafd` ("COUNTFIX 1.1: the Ops KPI tile adopts inbound_open_count()"). `src/pages/app/ops/OpsDashboard.tsx:181` now reads `{ key: 'intake', label: 'Inbound work waiting', to: '/app/dashboard', load: counts.inboundOpen }`. `countPendingIntake` no longer exists anywhere in `src/` (grep: zero hits). `src/lib/ops/useOpenLeads.ts:85-88` documents the same predicate: "Deliberately the same predicate `inbound_open_count()` counts for the Dashboard nav badge (AppLayout.tsx), so the dashboard's entry list and its badge number never disagree." Prod `inbound_open_count()` body confirms one definition (inbound_queue not converted/expired + unresolved support_requests).
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-13: /app/ops/intake was reachable only when the lead list was non-empty
- item: The largest ops page had no route to it when there was no work in it.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: SUPERSEDED BY EVENTS
- evidence: The page was retired the day after this was raised. `src/pages/app/ops/IntakePage.tsx:447` `export const INTAKE_PAGE_RETIRED = true;` (header comment: "⚠ RETIRED 2026-08-11 (TASK-LEADCLEAN)"); `src/App.tsx:316-318` renders `<IntakeRetiredRedirect />`. `src/components/app/DashboardPanel.tsx:26` — "the ONLY surface for it (/app/ops/intake is retired)"; `:398` — the row expands in place instead of navigating. Commits `3848dfe` / merge `5d54177` (2026-08-11).
- decision-note: none
- cost-rank: 6
- recommendation: Nothing. The reachability question died with the page.

## ID-14: DashboardPanel has no loading branch and no error branch
- item: Every fetch on the dashboard swallows its error, so a failed read renders as "you're all caught up".
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/components/app/DashboardPanel.tsx` — no `loading` or `error` state among the 12 `useState` declarations (`:191-229`); every read is `.catch(() => [])` or `.catch(() => {})` (`:236,239,242,244,245,246,248`); the empty state at `:379` is the unconditional "Looks like you're all caught up, nothing new to report."
- decision-note: none
- cost-rank: 1
- recommendation: Add a `loading` and an `error` state; render a retry rather than a false all-clear. This is the staff landing page.

## ID-15: Schedule.tsx casts one type to another and mislabels the staff view
- item: The Schedule page force-casts listLessonSessions output and heads the staff view "Your lessons" while listing the whole property's.
- sources: TASK-COUNTFIX-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/pages/app/Schedule.tsx:55` — `listLessonSessions().then((rows) => rows as unknown as MemberLessonSession[])`; `:88` — the comment/heading "Your lessons — the member's own confirmed sessions, first."
- decision-note: none
- cost-rank: 5
- recommendation: Give `listLessonSessions` an honest return type and split the heading by role. Owned by the consolidation that retires the page.

## ID-16: Schedule.tsx holds the app's only RSVP control
- item: Before Schedule.tsx is retired, its community-events + RSVP section must be carried across, because it is the only place a member can RSVP.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/pages/app/Schedule.tsx:4` imports `fetchEvents, fetchMyRsvps, setRsvp` from `lib/community`; `:52-53,62,70-75` are the RSVP read/write. `grep -rn "setRsvp" src/` finds it only in `lib/community.ts` and this page. Nothing has been retired.
- decision-note: none
- cost-rank: 4
- recommendation: Attach as an acceptance condition on the Schedule retirement task; do not retire until RSVP has a new home.

## ID-17: ServiceSelector's radiogroup semantics and mechanics() hint must survive its retirement
- item: If the older catalog renderer is retired, its accessibility semantics and its per-SKU mechanics hint have to be carried into the survivor first.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/components/ServiceSelector.tsx` still exists and is still LIVE on two public funnels — `src/pages/BookSupport.tsx:118` and `src/pages/BookRider.tsx:122`. It carries `role="radiogroup" aria-labelledby` (`:66`), `aria-checked` (`:90`) and the `mechanics()` hint (`:37`, rendered `:110`). `src/components/OfferingCatalog.tsx` has none of those (grep for `radiogroup|aria-checked|mechanics` → zero hits in that file). Nothing retired; both renderers are live.
- decision-note: none
- cost-rank: 4
- recommendation: Same as ID-16 — a precondition on the retirement, not work on its own.

## ID-18: RecordsHubPage sends the reader to a "Horses screen" with no nav entry
- item: The horse-records hub's empty message instructs staff to go somewhere the app does not link to.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/pages/app/ops/hubs/RecordsHubPage.tsx:95` — `emptyMessage="Add horses on the Horses screen; their records appear here."`. `/app/ops/horses` is registered (`App.tsx:306`) but appears in no nav group (grep `ops/horses` across `AppLayout.tsx` → zero hits). Horses now live as a Records tab (`RecordsPage.tsx:91`, route `/app/records/horses`), which the message does not name.
- decision-note: none
- cost-rank: 6
- recommendation: Reword to "Add horses on the Records → Horses tab" and link `/app/records/horses`.

## ID-19: The Records page has never been looked at rendered
- item: The whole five-tab Records page shipped without a staff browser session; a 10-step manual walkthrough is owed.
- sources: TASK-RECORDS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: The page exists and is routed (`src/App.tsx:270-271`, `src/pages/app/RecordsPage.tsx`). No browser session exists in this environment either (the worktree has DB credentials in `.env.db` but no logged-in staff session; every report since 2026-08-05 records the same wall). Nothing in the tree records a completed walkthrough.
- decision-note: none
- cost-rank: 4
- recommendation: Owner walks the 10 steps. Combine with ID-01, ID-07, ID-18 and ID-21, which are all on this page.

## ID-20: Person→horse links leave the page; horse→person expands in place
- item: On the Records people tabs a horse link is a route change to the member-facing horse page, unlike the new same-page horse→person modal.
- sources: TASK-RECORDS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/components/app/ClientRecordActions.tsx:256` — `<Link to={\`/app/horses/${h.id}\`}>`; also `src/components/app/StableSection.tsx:76` and `src/components/ops/documents/DocumentQueueTable.tsx:99`. The reverse direction is the `onOpenContact` prop threaded through `RecordsPage.tsx:76-91`.
- decision-note: none
- cost-rank: 6
- recommendation: Owner ruling on whether symmetry is wanted; it is a real inconsistency, not a bug.

## ID-21: A second, inert "Horses" section duplicates ClientHorseRecordsCard in the dossier
- item: The contact dossier renders the same horse information twice, once as a live card and once as plain non-clickable text.
- sources: TASK-RECORDS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/components/app/ContactDossierModal.tsx:238` `<Section title="Horses">` (plain rows) and `:267` `<ClientHorseRecordsCard contactId={contactId} />` — both still in the same render.
- decision-note: none
- cost-rank: 6
- recommendation: Delete the inert `Section`.

## ID-22: /account is a dead page carrying a duplicated status-label map and its own usd()
- item: The legacy public account page is URL-only, duplicates OrdersContent's order-status labels and money formatter, and should be retired behind a boolean once TwoFactorSettings has a home.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/pages/Account.tsx:10-19` — `const ORDER_STATUS_LABEL` and `const usd`, duplicating `src/components/app/OrdersContent.tsx:18-22` (`STATUS_LABEL`) and `:23` (`usd`). The stated precondition FAILS: `TwoFactorSettings` is imported only by `src/pages/Account.tsx:7` (rendered `:188`); `MyLoginContent` (`src/components/app/profile/ProfileAndPreferences.tsx:34-40`) renders `LoginSecurityCard`, which contains no 2FA/MFA code (grep `TwoFactor|factor|MFA` in `LoginSecurityCard.tsx` → zero hits).
- decision-note: none
- cost-rank: 4
- recommendation: Do NOT retire yet — retiring `/account` today removes the only route to two-factor setup. Move `TwoFactorSettings` into `LoginSecurityCard` first, then retire behind a boolean and delete the duplicated map/formatter.

## ID-23: /account bounces members and is still the default post-login destination
- item: Members are redirected off /account the instant it renders, yet login, OAuth, password reset and an OrderDetail link all send them there.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06); TASK-REVIEWNAV-REPORT.md (2026-08-12)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `src/pages/Account.tsx:68-70` — `if (isMember) { return <Navigate to="/app" replace />; }`, guarded by the comment at `:63-67`. The page is otherwise unchanged since the report.
- decision-note: none
- cost-rank: 5
- recommendation: Repoint the post-login/OAuth/reset destinations and the OrderDetail back-link at `/app/account`, so nobody transits a redirecting page. Blocks cleanly on ID-64 (the Supabase redirect allow-list) and pairs with ID-22.

## ID-24: "Saved Content" has no backing data model and can never contain anything
- item: The saved-items row and nav link exist, but saved=false is a literal in the DB function and there is no bookmark control anywhere.
- sources: TASK-I-REPORT.md (2026-08-04); TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-04
- status: STILL OPEN
- evidence: Prod `pg_get_functiondef` for `my_nav_presence()` returns `'saved', false` as a literal in both arms (body lines 16 and 38). `src/components/app/AccountPanels.tsx:32-40` — comment "saved/bookmark data model yet (tracked separately)", `const items = SEED_ENABLED ? SEED_SAVED : []`, empty state "Bookmark articles, listings, and links to find them here." No save/bookmark write exists in `src/` (the only `Bookmark` hits are lucide icons and unrelated prose).
- decision-note: none
- cost-rank: 4
- recommendation: Either build the saved/bookmark table as its own tracker item or remove the row and the nav link. It is currently a promise the app cannot keep.

## ID-25: Saved Content became unreachable from mobile nav when the avatar menu went
- item: Removing the avatar dropdown stranded Saved Content, which I6 had deliberately kept out of the drawer.
- sources: TASK-ONEMENU-PHASE1-PLAN.md (2026-08-07)
- raised: 2026-08-07
- status: CLOSED BY LATER WORK
- evidence: The owner ruled and it was added. `src/components/app/AppLayout.tsx:1147-1155` — comment "Owner ruling 2026-08-07 (#5): Saved Content ships as a visible nav item … that menu is gone now, so its only remaining home is here", then `<PresenceLink to="/app/account?section=saved" label="My Saved Items" icon={Bookmark} section="saved" …/>`. Also in `PRESENCE_LINKS` at `:446`. (It is presence-gated and presence is permanently false — that is ID-24, not this item.)
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-26: AccountHub reads ?section= only in its useState initializer
- item: A query-string-only navigation while already on /app/account may not switch the visible panel.
- sources: TASK-I-REPORT.md (2026-08-04)
- raised: 2026-08-04
- status: STILL OPEN
- evidence: `src/pages/app/AccountHub.tsx:82-84` — `const [open, setOpen] = useState<Section>(() => SECTION_VALUES.includes(sectionParam ?? '') ? … )`. No `useEffect` syncs `open` to `sectionParam` (grep for `useEffect` in the file → none on this state). `src/App.tsx` mounts one `AccountHub`, so React does not remount on a search-only change.
- decision-note: none
- cost-rank: 5
- recommendation: Add a `useEffect([sectionParam])` that sets `open`. Small fix; every `?section=` deep link in the nav depends on it.

## ID-27: The Account page's "My Lessons" row has no lessons-module gate
- item: The row always renders even when the lessons module is off, promising a destination that only shows the lock screen.
- sources: TASK-ACCOUNTSURFACE-PHASE1.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `src/pages/app/AccountHub.tsx:138-139` — the `My Lessons` `<Row>` and its `MyLessonsContent` sit inside the plain `{!isStaff && (…)}` block with no `lessonsOn` condition; grep for `lessonsOn` in `AccountHub.tsx` → zero hits. The nav does gate it: `AppLayout.tsx:1134` `{lessonsOn && <RailLink to="/app/lessons" label="My Lessons" …/>}`. Currently latent for FHE (prod `org_modules` has `mod.lessons = t`), so it bites only a tenant with lessons off.
- decision-note: none
- cost-rank: 5
- recommendation: Thread `lessonsOn` into AccountHub and gate the row the same way the rail does.

## ID-28: Whether "Profile & preferences" becomes "My Profile & Preferences"
- item: A label question was raised and explicitly not decided.
- sources: TASK-ACCOUNTSURFACE-PHASE1.md (2026-08-07)
- raised: 2026-08-07
- status: CLOSED BY LATER WORK
- evidence: The question dissolved when the section was split. Commit `15e4ed3` / merge `8d6fff6` (2026-08-05, "TASK-PROFILE: consolidate Profile & Preferences into one no-inner-pages surface"), and `src/pages/app/AccountHub.tsx:28` records "Profile & preferences split into My Profile / My Preferences / My Login". The live row is `title="My Profile"` at `:108`; `My Preferences` and `My Login` at `:129-130`. All three carry the "My" prefix, so no exemption is needed.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-29: The Account hub's 10-row section order is not owner-ranked
- item: Today's relative order was preserved plus one placement call; a real ranking is owed.
- sources: TASK-ACCOUNTSURFACE-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: `src/pages/app/AccountHub.tsx:29` — "Row order is TODAY'S RELATIVE" (order preserved, not chosen). No ordering decision is recorded in CLAUDE.md or the task docs.
- decision-note: none
- cost-rank: 3
- recommendation: Show the owner the rendered list (pairs with ID-19's walkthrough) and take the ranking in one pass.

## ID-30: My Lessons' Account-row icon was changed from Boxes to GraduationCap
- item: A deliberate icon change was flagged rather than left to be discovered.
- sources: TASK-ACCOUNTSURFACE-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: The change is in place and unreversed: `src/pages/app/AccountHub.tsx:138` `<Row icon={GraduationCap} title="My Lessons" …>`; `Boxes` now carries My Stable (`:155`). No owner acknowledgement recorded.
- decision-note: none
- cost-rank: 6
- recommendation: Confirm at the next visual review; no work.

## ID-31: My Posts' "+ Post" create control is page-only, absent from the Account panel
- item: The inline Account version of My Posts has no create control — a considered omission flagged for the owner.
- sources: TASK-ACCOUNTSURFACE-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: `src/components/app/MyPostsContent.tsx:13` — "'+ Post' control, which this task leaves page-only". No create control in the component today.
- decision-note: none
- cost-rank: 3
- recommendation: Owner call. Related to ID-90 (no member-facing create affordance in the header either).

## ID-32: Orders' list item navigates outside /app to /order/:id
- item: "Orders expands in place" does not make the subject click-free — an order detail is still a route change off /app.
- sources: TASK-ACCOUNTSURFACE-PHASE1.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `src/components/app/OrdersContent.tsx:50` — `<Link to={\`/order/${o.id}\`}>`, a public-site path outside the `/app` shell.
- decision-note: none
- cost-rank: 6
- recommendation: Either accept it or move order detail under `/app/orders/:id`. Note ID-23: OrderDetail's back-link points at the bouncing `/account`.

## ID-33: Two writes on the member's own account do not prove they landed
- item: updateMyContactPhone and upsertMyProfile write without .select()/assertWrote, contrary to CLAUDE.md's stated rule.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `src/lib/api.ts:519-527` `updateMyContactPhone` — `.from('contacts').update({ phone }).eq('id', contactId)`, no `.select()`, no `assertWrote`. `src/lib/api.ts:489-496` `upsertMyProfile` — `.from('profiles').upsert({…}, { onConflict: 'user_id' })`, same. CLAUDE.md ("Working rule"): "Every write goes through `assertWrote()` … with a `.select()` so a blocked write throws instead of reporting success."
- decision-note: none
- cost-rank: 2
- recommendation: Wrap both in `assertWrote` with `.select()`. These are the member's own phone and profile — an RLS-filtered zero-row update currently reports success.

## ID-34: ProfileCard writes one row per keystroke and swallows the error; "Close without saving" does not discard
- item: Contact-preference fields commit immediately on every change, failures are discarded silently with no retry, and Close only stops editing.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `src/components/app/profile/ProfileCard.tsx:130` — `saveMyContactPrefs({ [key]: value }).catch(() => { /* keep UI state; retried on next field save */ });`. The fields are uncontrolled-on-change, not on-blur: `:54` and `:71` are `onChange={(e) => onValue(e.target.value)}`, and every call site (`:280-301`) routes `onValue` straight into `set(...)`. So one write per keystroke, error dropped, new value left on screen.
- decision-note: none
- cost-rank: 1
- recommendation: Debounce or move to blur, surface the failure, and make Close actually revert. The "retried on next field save" comment is only true if the member happens to touch the same field again.

## ID-35: Emergency contacts are presented as immutable but are writable elsewhere
- item: The card says "not editable", which is true of that card and not of the field — staff, onboarding and the member's own API session can all write it.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `src/components/app/profile/AccountInfoCard.tsx:9` excludes both emergency fields from the editable `FieldKey`; `:43-46` and `:173-176` render "From your signed onboarding paperwork — shown here for reference, not editable." `update_contact_record` and `update_my_onboarding_profile` both still exist in prod and both write the columns.
- decision-note: none
- cost-rank: 5
- recommendation: Reword to "captured from your signed paperwork — ask us to change it", or make the card the one editor. The current copy is a claim about the system that is not true.

## ID-36: Whether the accountless contacts' hide_* flags were set deliberately
- item: The hide_* flags correlate exactly with "has no account", which reads as a backfill, but no migration line sets them.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: CANNOT DETERMINE
- evidence: The correlation still holds exactly. Prod: `select (p.user_id is null) as accountless, count(*) from contacts c left join profiles p on p.contact_id=c.id where c.deleted_at is null and (c.hide_email or c.hide_mobile or c.hide_mobile_call or c.hide_mobile_text or c.hide_whatsapp or c.hide_whatsapp_call or c.hide_whatsapp_text or c.hide_community_email) group by 1` → `t | 13` and no `f` row at all: all 13 flagged contacts are accountless, no account-holder is flagged. I searched `supabase/migrations/` for any statement setting a `hide_` column and found none. The provenance is not recoverable from the repo or from the current DB state (no audit row survives for a column default/backfill of this age).
- decision-note: none
- cost-rank: 5
- recommendation: Treat as unknown-but-harmless while those 13 have no login; re-check the day one of them is promoted to an account, because the flags will follow them into the member directory.

## ID-37: Expired invitations never flip to status 'expired'
- item: Nothing sweeps invitations, so "sent" counts read as live invitations when several are dead.
- sources: TASK-INVITEWORKS-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Prod `select status, count(*) from invitations group by 1` → accepted 6, redeemed 9, revoked 13, sent 12, superseded 3 — **no 'expired' row exists at all**. `select id,email,status,expires_at from invitations where expires_at < now() and status <> 'expired'` returns 29 rows, of which 7 are `sent`, including `maeboon@gmail.com` (`8cfc92d3…`, expired 2026-08-04) — the exact row named in the report, unchanged 2 days later. No sweep function exists (`invitation_expiry_days`, `record_invitation_failure`, `supersede_invitations` are the only lifecycle functions).
- decision-note: none
- cost-rank: 2
- recommendation: Either add a scheduled/triggered sweep or make `current_status` derive expiry from the date so no surface can read a dead invite as live. Every panel that derives Expired at render is compensating for this.

## ID-38: The "13 sent, never redeemed" figure was twelve test sends plus one real address
- item: A correction to an earlier alarming number — it was not thirteen failures.
- sources: TASK-INVITEWORKS-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: The correction stands and the shape is unchanged. Prod today: 12 rows at `status='sent'`; of the 7 that are past expiry, 6 are to `hello@fhequestrian.com` or `cjzigs@icloud.com` (D1 protected/test identities) and one is `maeboon@gmail.com`. The genuine 2026-08-10 redemption is visible as the 9 `redeemed` rows. No action was ever owed on this entry; it is context that keeps being re-alarmed about.
- decision-note: D1 bears — the test identities are live and untouched until the owner-run purge. Noted only.
- cost-rank: 6
- recommendation: Keep as context. Any future invitation census should exclude D1 identities before quoting a number.

## ID-39: Eight of the nine pending-kind roster rows have no invitation at all
- item: Most provisioned clients were never actually invited.
- sources: TASK-ROSTERCARD-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Prod, re-run today: `select count(*) filter (where inv.id is null) as no_invite, count(*) as total from clients cl join contacts c on c.id=cl.contact_id left join profiles p on p.contact_id=c.id left join lateral (select id from invitations i where lower(i.email)=lower(c.email) limit 1) inv on true where p.user_id is null and c.deleted_at is null` → `8 | 9`. Identical to the reported figure, unchanged in two days.
- decision-note: D8 bears (CLIENT marker is attached at invitation with service documents). Noted only.
- cost-rank: 2
- recommendation: Owner decides per person: send the invitation, or accept that a `clients` row can exist without one. Today the roster shows nine people as pending when eight of them were never contacted.

## ID-40: api/admin-send-invitation.ts flattened every failure to "could not create invitation"
- item: A catch-all swallowed the real cause and returned one flat message.
- sources: TASK-INVITEFLOW-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: CLOSED BY LATER WORK
- evidence: `api/admin-send-invitation.ts` now carries a staged error model. `:188-191` explicitly names the old behaviour in the past tense ("both previously flattened to 'could not create invitation'"); the flow is wrapped in `at('provision', …)` stage markers (`:223`), and the outer handler at `:352-360` logs `detail.stage, detail.message` and returns `{ error: detail.message }` with `detail.status`. The success path also returns `emailError`/`stage` when the email leg fails (`:396-400` region). No `"could not create invitation"` string literal survives as a returned message.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-41: A "dry run" applied to production for real because the migration carried its own BEGIN/COMMIT
- item: The house dry-run wrapper's ROLLBACK hit no transaction; psql warned twice and the warnings were missed.
- sources: TASK-INVITEFLOW-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: CLOSED BY LATER WORK
- evidence: The named file was corrected. `supabase/migrations/20260810T1730_inviteflow_category_is_evidence.sql:31-32` now opens with "NO BEGIN/COMMIT IN THIS FILE. The house discipline is to dry-run a migration inside `BEGIN; \i <file>; ROLLBACK;` against production first — and a COMMIT…". The only remaining `BEGIN` tokens in the file (lines 118, 172) are plpgsql function-body openers, which are inert to the wrapper.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing on this file. The general lesson (stop on the first psql warning) belongs in CLAUDE.md's migration section if it is not already there.

## ID-42: Queued, not started — invite page fields, booking calendar, contact-record edit mode, "File Under" row
- item: Four INVITEFLOW follow-ups were left unstarted.
- sources: TASK-INVITEFLOW-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: Mixed, and partly overtaken. The **"File Under" row EXISTS** — `src/pages/app/ops/ContactsPage.tsx:419-427` renders "Filed under" / "Not filed yet" with the full type picker (that is ID-06's control, now live on Records). The **contact-record edit mode** exists in two forms and is itself a defect (ID-03). The **booking calendar** and the **invite page fields** have no completion recorded anywhere in the tree.
- decision-note: none
- cost-rank: 4
- recommendation: Re-scope: two of the four are done or superseded. Re-file only the invite page fields and the booking calendar.

## ID-43: provision_client_invitation — the account-provisioning spine — has zero test coverage
- item: Every provisioning test is written against a function that no longer exists.
- sources: TASK-TESTDB-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `grep -rln "provision_client_invitation" test/` → exactly two hits, neither a test of it: `test/ui/leadclean_intake_retired.test.tsx` (a UI test) and `test/db/fixtures/schema_snapshot.sql` (the schema dump). No file in `test/db/` exercises the RPC. The function is live in prod and is the sole spine called by `api/admin-send-invitation.ts:232`.
- decision-note: none
- cost-rank: 2
- recommendation: Open the follow-up task. Note the standing constraint: `test:db` is broken (203 failures), so this needs the harness fixed first or it cannot be proven either way.

## ID-44: requests_capture_contact has no ambiguous-match branch producing NULL
- item: A correction to a brief — the trigger picks the oldest matching contact or creates one; "absent" is unreachable via a valid insert.
- sources: TASK-REQTRIGGER-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: The correction still describes the live function. Prod `pg_get_functiondef('requests_capture_contact')`: `IF v_email IS NULL THEN RETURN NEW; END IF;` (body line 13), then a single lookup `WHERE lower(email)=v_email AND org_id=NEW.org_id AND deleted_at IS NULL` (line 17), then `IF v_contact IS NULL THEN` insert (line 21), then the AFTER-trigger `UPDATE … WHERE id = NEW.id AND contact_id IS NULL` (line 38). No branch yields NULL for an ambiguous match. The gap between the brief's wording and the code was flagged, not closed.
- decision-note: none
- cost-rank: 5
- recommendation: Owner/spec decision: is oldest-match the intended rule for two contacts sharing an email, or should ambiguity be surfaced? Do not invent a branch without the ruling.

## ID-45: No audit of application code reading requests.contact_id with the old semantics
- item: The REQTRIGGER fix assumed, without grepping, that nothing consumed the previously-never-populated column.
- sources: TASK-REQTRIGGER-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Consumers DO exist and were not in the report: `src/lib/ops/api-intake.ts:138` types `contact_id: string | null`; `:199` documents "the view joins requests → contacts on `contact_id` when it is set"; `:228` maps it to `contactId`; `:324` filters `.eq('contact_id', contact.id)`. All read the column as "the linked contact", which is what the fix now makes true — so the assumption looks correct — but the audit the report said it had not done still has not been done as a deliberate pass (I checked `lib/ops/api-intake.ts` only).
- decision-note: none
- cost-rank: 5
- recommendation: A 20-minute grep pass over `src/` and `api/` for `contact_id` on request-shaped reads, to convert "looks fine" into "checked".

## ID-46: RETURNING on an INSERT does not reflect an AFTER trigger's separate UPDATE
- item: A methodology note — a first proof attempt looked like failure; a second independent SELECT is required to observe AFTER-trigger side effects.
- sources: TASK-REQTRIGGER-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Correct as stated and confirmed by the function shape above (the AFTER trigger's effect is a separate `UPDATE … WHERE id = NEW.id`, body line 38). This is a lesson with no home: it is not in CLAUDE.md (grep for "RETURNING" → no such guidance).
- decision-note: none
- cost-rank: 6
- recommendation: Add one line to CLAUDE.md's verification discipline. Cheap, and it has already cost one thread a false negative.

## ID-47: Should the schedule-lesson path write requests.status='converted'?
- item: It is the only writer of that status and has never run — production has never held a 'converted' request.
- sources: TASK-LEADCLEAN-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Prod `select status, count(*) from requests group by 1` → `contacted 6`, `expired 1`, `new 7`. Still no `converted` row (an `expired` row has appeared since the report; `converted` has not). `schedule_lesson_session` is unchanged. The report explicitly says "report, do not decide" and no ruling is recorded.
- decision-note: none
- cost-rank: 3
- recommendation: Owner ruling. Note the interaction with ID-12: `inbound_open_count()` excludes `status IN ('converted','expired')`, so writing 'converted' would immediately change both the badge and the queue.

## ID-48: Whatever converts a worked lead should set contact_type / go through the provisioning spine
- item: Context noted, not built — the roster picks conversions up automatically once the converting flow files the person correctly.
- sources: TASK-ROSTER-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: No conversion writer sets `contact_type` today; the only setter is the manual `file()` control (ID-06) and the column default. This is the DB-side twin of ID-01 — the UI create path has the same hole. Prod still shows 6 `LEAD` rows and no automated promotion path in `pg_proc` that writes `contact_type`.
- decision-note: D5 bears (`promote_contact_to_account` is the promotion pathway) and D8 (CLIENT marker attaches at invitation). Noted only.
- cost-rank: 3
- recommendation: Specify the lead→client conversion as one flow and make it the single writer, rather than leaving it to whoever remembers.

## ID-49: The roster/Clients page render has never been verified in a browser
- item: Everything about the cards page is RPC output, direct queries and built CSS — no screenshot, no click-through, because no staff browser session exists.
- sources: TASK-ROSTERCARD-REPORT.md (2026-08-11); TASK-ROSTER-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: The wall is still there. `src/pages/app/Admin.tsx` is live and routed, and the worktree carries DB credentials (`.env.db`) but no authenticated app session; the ROSTER thread's temporary local harness was deleted before commit and is not in the tree. The same "no staff browser session (owner ruling 2026-08-10)" note recurs in every subsequent report.
- decision-note: none
- cost-rank: 4
- recommendation: One owner-driven click-through covering Admin/Clients, Records (ID-19) and the Account hub (ID-29) at once. This wall is the single largest source of unverified inventory in this slice.

## ID-50: is_admin() was verified by simulating the admin JWT in psql, not in a browser
- item: The admin gate's behaviour rests on a simulated `request.jwt.claims`, not an observed session.
- sources: TASK-ROSTER-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: Same wall as ID-49. Note that this connection's `auth.uid()` is NULL, so the same simulation is the only method available here too — I could not improve on it.
- decision-note: D1a bears — being denied by FHE staff-gated functions is CORRECT for the platform account, so a naive browser test as `admin@cactai.io` would mislead. Noted only.
- cost-rank: 5
- recommendation: Fold into ID-49's session; test as `admin@fhequestrian.com`, not the platform account.

## ID-51: Roster credits are shown as one summed count, not itemised
- item: A judgment call — the itemised data is already on the row and trivial to swap in.
- sources: TASK-ROSTERCARD-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: The itemised shape is still carried: `src/lib/admin.ts:558-559` — `credits: { label: string; remaining: number }[]`. Prod has 3 `lesson_credits` rows total, so the difference is currently invisible.
- decision-note: none
- cost-rank: 6
- recommendation: Owner picks at the ID-49 walkthrough; one-line change either way.

## ID-52: "Not yet invited" is flagged only for kind='pending', not for bare contacts
- item: A bare-contact row gets no equivalent flag even though nobody has reached out to that person either.
- sources: TASK-ROSTERCARD-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/lib/admin.ts:539-540` still defines the three kinds — `kind: 'account' | 'pending' | 'contact'` with "'contact' (TASK-ROSTER): a bare contact — no clients row, no login". No bare-contact flag exists. Directly compounds ID-39: eight pending rows genuinely have no invitation, and the bare-contact arm is silent about the same condition.
- decision-note: none
- cost-rank: 3
- recommendation: Owner ruling on whether the flag list gains a bare-contact entry. Decide it together with ID-39.

## ID-53: main's ClientAccountRow had drifted to the pre-ROSTER 15-column shape
- item: The frontend type lagged the RPC, which had already shipped 20 columns in production.
- sources: TASK-ROSTERCARD-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: CLOSED BY LATER WORK
- evidence: The correction is on main. `src/lib/admin.ts:538-562` now declares exactly 20 fields (kind, user_id, contact_id, client_id, first_name, last_name, display_name, email, is_suspended, member_status, created_at, tags, invite_id, invite_status, invite_expires_at, invite_scheduled_for, document_count, order_count, credits, services), matching `admin_client_accounts()`. Landed with `7011e9c` / merge `e584fe7` (2026-08-11, ROSTERCARD).
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-54: No live contact has consumed a horse-care service; the horse-owner roster row was synthetic
- item: The screenshot's horse-owner row was a clearly-labelled demo row because no real data exists for it.
- sources: TASK-ROSTER-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: Still true in the direction that matters: prod `bookings` holds 319 rows of which **294 have `client_id` NULL** (see ID-69), so the service-slot join has almost nothing to attach to. No fabricated row was committed — the harness was deleted before commit and no synthetic row exists in prod.
- decision-note: none
- cost-rank: 4
- recommendation: Nothing to fix; re-verify the positional row once a real horse-care booking exists. Keep the "synthetic, labelled" note attached so it is not later mistaken for evidence.

## ID-55: The Active-first sort key was dropped when the sort was ported verbatim
- item: A behaviour that existed on the old page did not survive the port.
- sources: TASK-ROSTER-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: `src/pages/app/Admin.tsx:535` — "The old Active-first sort key is gone with the port."; `:546` `useState<SortKey>('name')`; `:691-694` "ContactsPage's sort, ported verbatim: newest by created_at, else name A–Z." Two sort keys, no Active.
- decision-note: none
- cost-rank: 6
- recommendation: Owner decides whether Active-first comes back as a third key. Recorded loss, not a silent one.

## ID-56: The gift CUSTOMER-marker branch may never fire against real inventory
- item: D2's customer branch was tested only with a synthetic goods offering; the live catalog has no physical good.
- sources: TASK-GIFTCREDITS-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Prod `select config_kind, count(*) from offerings where active group by 1` → scheduled 13, recurring 11, document_transaction 1, intake_evaluation 1, intake_finder 1. All services; no goods SKU. `redeem_gift`'s body still carries the branch (`ELSE 'CUSTOMER'`, body line 50). Prod `gifts` table: 0 rows.
- decision-note: D8 bears (CUSTOMER = commercial marker for any purchaser incl. gift buyers). Noted only — the item's status is factual: the branch is untriggered.
- cost-rank: 4
- recommendation: Nothing to fix. Re-verify the day a goods SKU is added; until then the branch is correct-by-inspection only.

## ID-57: The public /gift → conversion → /redeem → new-account → schedule path was never clicked through
- item: Everything provable at the SQL layer was proven; the UI path was flagged, not claimed.
- sources: TASK-GIFTCREDITS-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: All four surfaces exist and are unchanged: `src/pages/Redeem.tsx`, `api/register-gift.ts`, `src/components/app/GiftCreateForm.tsx`, `src/pages/app/ops/IntakePage.tsx` (the last now behind `INTAKE_PAGE_RETIRED`, ID-13). Prod `gifts` = 0 rows, so nothing has run the path since either. Same browser wall as ID-49.
- decision-note: none
- cost-rank: 4
- recommendation: Fold into ID-49's session; it is the longest unverified flow in the slice and it creates accounts.

## ID-58: The gift coalesce fix narrowed a NULL-buyer gift from any-account-holder to staff-only
- item: A behaviour change worth naming — moot at 0 gift rows, but it will matter when the gift subsystem is finished.
- sources: TASK-NOGUARD2-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: The change is live and the disclosure stands. Prod `gift_claim_link` body line 11: `IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN` — with a NULL `buyer_user_id` and a non-staff caller the expression is NULL, now coalesced to false (deny). Prod `gifts` = 0 rows, so still moot.
- decision-note: D1a bears — the coalesce repairs on ~48 functions are explicitly ruled safe. Noted only.
- cost-rank: 5
- recommendation: When guest-checkout gifts are built, decide deliberately whether a NULL-buyer gift is staff-only. Do not let the coalesce default decide it.

## ID-59: A single-direction Gifts header needs a structural change and a shared component
- item: Splitting "received" from "given" requires lifting gift data up or a callback down, and GiftsContent is reused on the Account page.
- sources: TASK-TITLESWEEP-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: `src/pages/app/Gifts.tsx:13` still reads `<h1 …>Gifts you've received — and given.</h1>` — the both-directions header. `src/components/app/GiftsContent.tsx` is still the shared renderer.
- decision-note: none
- cost-rank: 6
- recommendation: Leave until gifts have data (prod: 0 rows). Copy work on an empty subsystem is premature.

## ID-60: The mixed-cart render has never been seen on screen
- item: One priced item plus one "Price on enquiry" item, with a per-cadence subtotal covering only the priced ones, is correct in code but unobserved.
- sources: TASK-COUNTFIX-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: The two halves are still there and still only reasoned about: `src/lib/cart.ts:16-17` — "it is quoted on enquiry. `price` is 0 so totals stay arithmetic, but every surface must render 'Price on enquiry' rather than '$0'"; `src/pages/Checkout.tsx:570` — `{item.priceOnEnquiry ? 'Price on enquiry' : formatPrice(item.price, item.unit)}`. No test and no screenshot.
- decision-note: none
- cost-rank: 4
- recommendation: A jsdom test with a two-line mixed cart would close this without a browser — cheaper than waiting for ID-49.

## ID-61: member_directory_list gates on authenticated, not on membership
- item: A non-member account holder can read the member directory, and there is a pre-existing drift between D8's account-gating and is_active_member() gating the other community tables.
- sources: TASK-SECFIX2-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: Prod `pg_get_functiondef('member_directory_list')` — the only two gates are "Gate 1 — no anonymous reads" (`IF auth.uid() IS NULL THEN RETURN`) and "Gate 2 — a suspended caller reads nothing" (`is_suspended`). No `is_active_member()` call anywhere in the body. Unchanged since the report.
- decision-note: D8 bears directly and is the reason this is a genuine drift rather than a plain bug — D8(1) says community access is gated by ACCOUNT, which is what the function does, while `is_active_member()` gates the other ~10 community tables. Recorded, not used to close the item.
- cost-rank: 3
- recommendation: Owner rules once, then make the whole community surface obey the same gate. Right now two gates coexist and neither is wrong on its own terms.

## ID-62: /app/community and the member profile pages were never loaded after the SECFIX2 change
- item: "The React layer has nothing new to handle" is reasoning, not observation.
- sources: TASK-SECFIX2-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `src/lib/community.ts` and `src/pages/app/MemberProfile.tsx` still exist and still call the definer RPC. Same browser wall as ID-49; nothing since 2026-08-07 records a click-through.
- decision-note: none
- cost-rank: 4
- recommendation: Fold into ID-49's session.

## ID-63: The PostgREST schema-cache reload after the member_directory_list change was never verified
- item: If the RPC 404s from the client after deploy, `NOTIFY pgrst, 'reload schema'` is the fix; PostgREST was not restarted or poked.
- sources: TASK-SECFIX2-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: CANNOT DETERMINE
- evidence: I can confirm the function exists and is well-formed in `pg_proc` (see ID-61), but the cache state of the hosted PostgREST is not observable from psql, and issuing `NOTIFY` would be a write to the running system, which this pass is forbidden from doing. No client-side 404 report exists in the tree.
- decision-note: none
- cost-rank: 5
- recommendation: Load `/app/community` once (ID-49's session answers it in ten seconds). Six days have passed, so a Supabase-side reload has almost certainly happened on its own — but "almost certainly" is what this pass exists to avoid.

## ID-64: Whether the Supabase redirect allow-list contains /app/account
- item: Nobody has ever completed the OAuth redirect in production; if only the site root is allowed, the member lands on the home page and nothing reports it.
- sources: TASK-GOOGLEAUTH-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: CANNOT DETERMINE
- evidence: The allow-list lives in the Supabase dashboard's Authentication → URL Configuration, which is not in the repo and not readable over the Postgres connection (it is not a table in this database — `information_schema` has no auth-config surface exposed to this role). The `redirectTo` value is set client-side and is all the tree can show.
- decision-note: none
- cost-rank: 3
- recommendation: Owner opens the Supabase dashboard and reads the list — a 30-second check nobody can do from here. Pair with ID-23, since the destination itself is a bouncing page.

## ID-65: Retirement-by-boolean is the house pattern and the hidden-page list changes weekly
- item: Anything consuming the list of retirement constants must re-derive it, not copy it.
- sources: TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: The warning proved itself immediately. `src/lib/reviewSection.ts:150` and `:183` both carry hardcoded prose about the constants, and `:183` already had to be amended in place ("the redirect target moved with the Clients tab; the constant did not change") — a copied fact going stale exactly as predicted. Live constants today: `CONTACTS_PAGE_RETIRED` (`ContactsPage.tsx:563`, true), `INTAKE_PAGE_RETIRED` (`IntakePage.tsx:447`, true), plus `SEED_ENABLED`, `STRIPE_ENABLED`, `INLINE_BODY_PREVIEW_RETIRED`.
- decision-note: none
- cost-rank: 5
- recommendation: If a surface needs the list, derive it from the exported constants rather than restating it in prose. At minimum, stop putting redirect targets in comments.

## ID-66: A microchip of "N/A" hijacks the next owner's horse
- item: Server-side text matching on microchip means two horses saved with a placeholder chip collide; latent today, made reachable by the N/A-save fix.
- sources: TASK-HORSEINTAKE-REPORT.md (no header date; batch6)
- raised: (undated report; batch6 window, ≤2026-08-12)
- status: STILL OPEN
- evidence: Prod `pg_get_functiondef('create_horse_record')`, body lines 10 and 39-56: `v_chip := nullif(regexp_replace(coalesce(p ->> 'microchip_id',''), '\s','','g'), '')`, then `SELECT * INTO v_match FROM horses WHERE org_id = v_org AND deleted_at IS NULL AND regexp_replace(coalesce(microchip_id,''),'\s','','g') = v_chip LIMIT 1;` — a plain equality on normalised text with no format validation. On a hit it either returns `match_found` or files a `horse_reconciliation` claim with `match_method='MICROCHIP'`. "N/A" is a valid value for `v_chip`.
- decision-note: none
- cost-rank: 2
- recommendation: Reject non-chip-shaped values (or an explicit placeholder denylist) inside `create_horse_record` before the match runs. The client cannot fix it — the match is server-side, as the report said.

## ID-67: suggested_category_for_contact still lists two retired template keys in a dead IN branch
- item: Cosmetic, behaviour unchanged, but it needs a live function-body rewrite so it was left alone.
- sources: TASK-SVCPURGE-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: Prod `pg_get_functiondef('suggested_category_for_contact')`, body line 18: `WHEN EXISTS (SELECT 1 FROM signed WHERE template_key IN ('RELEASE_PARTICIPANT','RIDER_LESSON','RIDER_LESSON_JUMPER','MINOR_RIDER'))`. Both retired keys still present.
- decision-note: none
- cost-rank: 6
- recommendation: Fold into the next migration that touches this function. Not worth its own task, contrary to the original note — but do not forget it, because it reads as documentation of a live template set.

## ID-68: save_calendar_item's edit branch overwrites four foreign keys unconditionally
- item: A partial payload silently clears client_id, purchase_id, offering_id and horse_id.
- sources: TASK-BOOKWRITE-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Prod `pg_get_functiondef('save_calendar_item')` — the vars are parsed with `nullif(p->>'…','')::uuid` (body lines 14-20) and the UPDATE assigns them flat at lines 85-91: `client_id = v_client, … horse_id = v_horse, purchase_id = v_pur, offering_id = v_offer`. No `coalesce(…, existing)` and no key-presence check on the jsonb payload.
- decision-note: none
- cost-rank: 1
- recommendation: Switch to "assign only when the key is present in `p`" (`p ? 'client_id'`), which preserves intentional clearing (explicit null) while stopping accidental clearing (key absent). That is the distinction the report said was risky to get wrong, and jsonb key-presence makes it safe.

## ID-69: 294 of 319 bookings have a NULL client_id
- item: The guard is safe now, but the data question stands — should staff-created bookings carry a client, and what is a NULL one for?
- sources: TASK-GUARDREST-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Prod `select count(*) filter (where client_id is null), count(*) from bookings` → `294 | 319`. Identical to the reported figure. No ruling recorded.
- decision-note: none
- cost-rank: 3
- recommendation: Owner ruling. It also blocks ID-54 (nothing to attach service slots to) and any per-client booking history.

## ID-70: Argument-typed composite functions are under-tested and were ranked by reasoning
- item: Three functions taking whole table rows were ranked low-risk on reasoning rather than on a test.
- sources: TASK-NOGUARD1-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `grep -rln "horse_field_token_value|booking_notifies_client|booking_service_type" test/` → one hit, `test/db/fixtures/schema_snapshot.sql` (the schema dump). No test exercises any of the three.
- decision-note: none
- cost-rank: 5
- recommendation: Blocked behind the same broken `test:db` harness as ID-43. Fix the harness once and close both.

## ID-71: No positive-path proof was run for book_open_slot's lesson-branch gate
- item: The lessee contact has no credit row, so a positive case would only prove the horse gate passes before failing on NO_CREDITS; the test was skipped rather than manufacturing a credit.
- sources: TASK-A13-REPORT.md (2026-08-04)
- raised: 2026-08-04
- status: STILL OPEN
- evidence: Prod `select count(*) from lesson_credits` → 3 rows exist now (up from the reported zero for that contact), so the blocker may have eased, but no proof was ever run and no test exists. `book_open_slot` is unchanged in `pg_proc`.
- decision-note: none
- cost-rank: 5
- recommendation: Re-attempt: three credit rows now exist, so a rolled-back positive case against a real credited contact is probably runnable without fabricating data.

## ID-72: The specified adversarial proof is blocked by a real database constraint
- item: Inserting a second is_company contact in the same org cannot be executed, in one transaction or any number of retries.
- sources: TASK-COMPANYFIX-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: The constraint is still there and still absolute. Prod `select indexdef from pg_indexes where indexname='one_company_contact_per_org'` → `CREATE UNIQUE INDEX one_company_contact_per_org ON public.contacts USING btree (org_id) WHERE (is_company AND (deleted_at IS NULL))`. A second company contact is unrepresentable, so `company_contact_id()`'s ambiguity case cannot be constructed.
- decision-note: D1 bears (the company contact is a protected production identity). Noted only.
- cost-rank: 5
- recommendation: Rewrite the proof requirement rather than the code: the constraint IS the guarantee the proof was meant to establish. Record that and close the request for the test.

## ID-73: There is no admin order surface of any kind
- item: /app/orders is the member's own order list and is hidden from admin; staff have nowhere to see business orders.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `grep -rn "admin_orders|ops/orders|AdminOrders" src/` → zero hits. No route under `/app/ops` serves orders in `src/App.tsx`. `src/components/app/OrdersContent.tsx` is the member component.
- decision-note: D6 bears (fulfillment is one deliverable spine; receipts hang off it). Noted only.
- cost-rank: 4
- recommendation: A real gap in the admin surface, not a duplicate or a cleanup. Belongs on the build list, not the flag list.

## ID-74: The sales-KPI / P&L / expenses backend is written, unapplied, and has no client code
- item: A whole financial backend exists as a migration nothing has run and nothing reads.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Confirmed on both sides. Prod `select proname from pg_proc where proname in ('sales_summary','business_kpis','profit_and_loss')` → **zero rows**: the migration `supabase/migrations/20260726090000_biz_expenses_and_financials.sql` was never applied. `grep -rn "sales_summary|business_kpis|profit_and_loss" src/` → zero hits.
- decision-note: D13 bears (a feature with no editing surface is unfinished). Noted only.
- cost-rank: 4
- recommendation: Owner decides: apply and build the surface, or delete the migration. Leaving an unapplied migration in the folder is a trap for anyone who replays the journal.

## ID-75: Duplicate nav glyphs — the Contact icon and the Shield icon
- item: Several nav entries share one icon: three carried Contact (Leads, Team, Contacts) and the whole Settings group carries Shield.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11); TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: The **Contact** collision is resolved — `0687429` removed the Contacts entry and reassigned icons (`AppLayout.tsx:545-549`: "Leads and Contacts carried the SAME `Contact` icon… Leads takes `Users` and Clients takes `Contact`"), and Team took `UserRound` when it moved to Settings (`:604-611`). The **Shield** collision is NOT — `grep -c "icon: Shield" src/components/app/AppLayout.tsx` → **7**. `mod.employees`'s row still carries `Contact` (`:602`), which is now Clients' glyph, so one duplicate remains there too.
- decision-note: none
- cost-rank: 6
- recommendation: Give the seven Settings rows distinct glyphs (the reports suggest `FileText` for the template one) and repoint Employees off `Contact`. Cosmetic, but it is the second time it has been raised.

## ID-76: The TEXTEDIT nav diff was never applied because AppLayout.tsx is contended
- item: The template wording editor sits under the temporary Review section instead of Settings; a one-line SETTINGS_GROUP addition was supplied but held.
- sources: TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/lib/reviewSection.ts` still owns the page's nav entry (33 review slots; `REVIEW_GROUPS` feeds `AppLayout.tsx:698` `label: 'Review'`). No corresponding row exists in `SETTINGS_GROUP` (`AppLayout.tsx:604-…`).
- decision-note: D13 bears — the wording editor is exactly the "owner can change it without a developer" surface, and it currently lives behind a temporary review section. Noted only; the status stays factual.
- cost-rank: 3
- recommendation: Apply the held one-line diff when the Review section is dismantled, and do it in the same change so the page does not fall out of the nav entirely.

## ID-77: The "People" and "Modules" headings disappeared, and Records must return with its module key
- item: Two nav headings vanished as a side effect of the Review moves; on acceptance, Records must be restored WITH its `module` key or it shows to tenants with the module off.
- sources: TASK-REVIEWNAV-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Both headings are back — `AppLayout.tsx:669` `{ key: 'accounts', label: 'People', … defaultOpen: true }` and `:671` `{ key: 'modules', label: 'Modules', items: visible(MODULES_GROUP) }`, and `MODULES_GROUP` (`:586-603`) is non-empty (Boarding, Barn Ops, Employees), all three modules enabled in prod. But the **restoration named in the item has not happened**: `AppLayout.tsx:592-601` still carries the commented-out `{ to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords' }` with the instruction "Restore the row WITH its `module` key". `mod.horserecords` is enabled in prod, so the horse-records hub currently has no nav row.
- decision-note: none
- cost-rank: 4
- recommendation: Restore that one commented row, with its module key, when Review is dismantled. Note the trap: the People group's `/app/records` row is a DIFFERENT page from `/app/ops/records`.

## ID-78: Eleven rows in one Modules nav group may itself read as clutter
- item: The mandated default-visible shape produced a long Modules group, against an owner complaint that was originally about volume.
- sources: TASK-PAGEVIS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: SUPERSEDED BY EVENTS
- evidence: The group no longer has eleven rows. `MODULES_GROUP` (`AppLayout.tsx:586-603`) contains three entries — Boarding, Barn Ops, Employees — plus one commented-out row (ID-77). Brokerage was removed as a 404 (`:587-589`). The specific shape the concern was about does not exist to be judged.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing on this count. Re-raise only if a future default-visible pass regrows the group.

## ID-79: Staff roster slot B rendered ModuleGate's locked fallback because mod.employees was off
- item: The review comparison could not show the employees page because enabling the module would have changed the live app for every staff user.
- sources: TASK-REVIEWNAV-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: The module is now enabled in production. `select org_id, module_key, enabled from org_modules` → all six rows `t`, including `mod.employees`. `supabase/migrations/20260812T1210_guardrest_staff_rls_matches_the_nav.sql:11` records the state change in its header ("mod.employees was enabled for…"), landed as `4c66e62` / merge `c43ed72` (2026-08-12, GUARDREST). The route is live and ungated at `src/App.tsx:354`, and the review slot at `src/lib/reviewSection.ts:327` will now render the real page.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing — but note that the thing the report declined to do was done by another thread the same day, which is exactly the staleness pattern to watch for.

## ID-80: The Stable nav links pointed at /app/account?section=stable instead of the real route
- item: Two nav call sites reached My Stable only through a redirect until ONEMENU repointed them.
- sources: TASK-ACCOUNTSURFACE-REPORT.md (2026-08-05); TASK-ONEMENU-REPORT.md (2026-08-07)
- raised: 2026-08-05
- status: CLOSED BY LATER WORK
- evidence: commit `3299a1b` (2026-08-07, "fix(nav): header-height offsets and resolve D2 stable route"). Both call sites now point at the real route: `AppLayout.tsx:444` `{ key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' }` and `:1145` `<PresenceLink to="/app/stable" label="My Stable" …/>`, each with a comment recording that `section` was dropped so `isActive` matches on pathname. `AccountHub.tsx:96` keeps a `?section=stable` redirect for old links.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-81: Nav labels were internally inconsistent — "Stable" vs "My Stable", and "Lessons" colliding with /lessons
- item: One destination carried two labels in two nav surfaces, and the personal lessons link lacked the "My" prefix that exists to prevent a collision with the public route.
- sources: TASK-ACCOUNTSURFACE-PHASE1.md (2026-08-07)
- raised: 2026-08-07
- status: CLOSED BY LATER WORK
- evidence: Both are now consistent. `AppLayout.tsx:444` and `:1145` both label it **"My Stable"**; `:1134` is `{lessonsOn && <RailLink to="/app/lessons" label="My Lessons" icon={GraduationCap} />}` — the "My" prefix is present. `AccountHub.tsx:155` matches ("My Stable"), `:138` matches ("My Lessons"). Landed across the ONEMENU/ACCOUNTSURFACE work (`3299a1b`, `91ea92e`, merge `a4f49b4`, 2026-08-07).
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-82: Staff have no personal Account link in ANY nav surface (worse than reported)
- item: Removing the avatar dropdown stranded instructors and admins from their own account page on mobile.
- sources: TASK-ONEMENU-PHASE1-PLAN.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: ONEMENU fixed it, REVIEWNAV removed it again, and it is now broader than the original report. **Both** staff call sites are commented out: the desktop rail at `src/components/app/AppLayout.tsx:1978-1988` ("REVIEW SECTION — MOVED OUT… `<AccountNavLink open={staffRailPinned} />` … Put this block back exactly as written above") and the mobile drawer at `:2180-2188` ("the drawer half of the same move as the rail above"). `StaffNavItems` (`:1171-1188`) contains no `AccountNavLink`; the only live one is in `ClientNavItems` at `:1156`, members-only. The header is not a fallback: `accountMenu` (which holds `<MenuLink to="/app/account" label="Account" …>` at `:1636`) renders **only in the superadmin header** — `:1743-1750` states "the tenant's CardstockHeader avatar is now an inert monogram and no longer renders `accountMenu` at all", and its single render site is `:1803`, inside the `isSuperAdmin` header branch. The ONEMENU comment at `:1970-1972` records the original ruling this violates: "Staff never had a personal Account link in ANY nav surface before this (owner ruling #3: 'no exceptions')."
- decision-note: none
- cost-rank: 1
- recommendation: Put both commented blocks back now rather than at Review teardown. A tenant admin or instructor currently has no route to `/app/account` from any chrome, on any viewport — the regression is wider than the mobile-only gap that was reported.

## ID-83: B3's RailLink-only scope would leave two active-state styles in one drawer list
- item: PresenceLink, AccountNavLink and CommunityNav's nested links hand-copy the same active convention; changing only RailLink splits the look.
- sources: TASK-ONEMENU-PHASE1-PLAN.md (2026-08-07)
- raised: 2026-08-07
- status: CLOSED BY LATER WORK
- evidence: The convention was centralised into shared constants rather than left hand-copied. `AppLayout.tsx:124` `NAV_ROW_IDLE` and `:167` `NAV_ROW_ACTIVE` (plus `NAV_ICON_ACTIVE`/`NAV_ICON_IDLE`, `NAV_INSET_ROW`); `AccountNavLink` consumes them at `:901-906`, and the same pair is used by RailLink/PresenceLink/CommunityNav. One definition now serves all four, so the split the plan warned about cannot occur.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing.

## ID-84: The avatar menu's MenuLink render site was deliberately left unbadged
- item: No nav-group item has ever shown a badge there, so leaving it unbadged regresses nothing.
- sources: TASK-B-REPORT.md (2026-08-04)
- raised: 2026-08-04
- status: STILL OPEN
- evidence: Still true and still unbadged. `AppLayout.tsx:845` `function MenuLink({ to, label, icon: Icon, end, onNavigate }: NavItem & {…})` — the destructure takes no `badge`, and the render (`:846-856`) has no badge slot; group items are fed through it at `:1708`.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing. Recorded so a future badge feature knows this render site is a gap.

## ID-85: The hover sweep was scoped to the nav-rail family; the account-menu block still carries the old fill
- item: MenuLink and the account-dropdown block still use hover:bg-navfill/64, and the scope guess was never checked against what the owner was looking at.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: The old fill is still there, in eight places. `AppLayout.tsx:853` (MenuLink itself), and `:1643, 1656, 1661, 1682, 1694, 1715, 1719, 1794` all carry `[@media(hover:hover)]:hover:bg-navfill/64`. The rail family moved to the underline convention (`NAV_ROW_IDLE`, `:124`), so two hover languages coexist.
- decision-note: none
- cost-rank: 6
- recommendation: Owner looks at the account dropdown once and says whether it should follow the rail. Do not sweep it blind — the reason it was left is that nobody knew which surface the complaint was about.

## ID-86: The "Add New" divider was added only to the staff rail, because the client rail has no create control
- item: The order said "both rails"; one rail had nothing to divide.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: `ClientRail` (`AppLayout.tsx:1244-1270`) renders `ClientNavItems` and the footer only — no create control, so no divider. The deviation stands as described and no owner ruling is recorded. Directly connected to ID-90 (members have no create affordance anywhere in the chrome).
- decision-note: none
- cost-rank: 6
- recommendation: Resolve with ID-90 and ID-31 as one "does a member get a create control" decision, rather than three separate divider/button questions.

## ID-87: UIO-016's premise about the "p-3 plus px-3" comment did not hold, so the comment was not edited
- item: The order asked for an edit the code did not need; the comment was already correct for the path it describes.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: The comment family is still in place and still describes the staff-rail icon strip — `AppLayout.tsx:947` ("at 16px, exactly on the `px-4` line its sibling MenuLinks sit on") and the parallel notes at `:1653` and `:1674`. Nothing was edited, as reported; no owner acknowledgement recorded.
- decision-note: none
- cost-rank: 6
- recommendation: Confirm and close at the next UI review. It is a declined order, not an open defect.

## ID-88: Was the staff rail meant to go green too?
- item: Built green as an interpretation and flagged; reverting it alone would mean a second palette for five shared components.
- sources: TASK-ONEHEADER-REPORT.md (2026-08-08)
- raised: 2026-08-08
- status: STILL OPEN
- evidence: The interpretation is in place and the "five shared components" argument has since hardened: `NAV_ROW_IDLE` (`:124`, `text-green-800`) and `NAV_ROW_ACTIVE` (`:167`, `text-green-900`) are single constants consumed by RailLink, PresenceLink, AccountNavLink, CommunityNav and NavFooter (see ID-83). Reverting the staff rail alone now means forking those constants. No owner answer is recorded.
- decision-note: none
- cost-rank: 3
- recommendation: Ask once at the next visual review. The cost of reverting rises every time a component adopts the shared constants.

## ID-89: The account dropdown's max-height still assumes the old 3.5rem header
- item: With an 88px phone header the dropdown can overflow by ~12px; left alone because it scrolls internally.
- sources: TASK-HEADER-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx:1634` — `max-h-[calc(100dvh-5rem)]`, unchanged. `5rem` = 80px against an 88px header.
- decision-note: none
- cost-rank: 6
- recommendation: Retune to the `--cs-hdr-h` custom property as the report suggested — a one-token change, and it stops the next header-height change re-breaking it.

## ID-90: A regular member has no create affordance in the header at all
- item: The old + button is gone, the Create tab is admin/staff-only and hidden on mobile even for staff, so members have no create control until page-level ones land.
- sources: TASK-HEADER-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `CardstockHeader.tsx` no longer exists in the tree (shelved by ONEHEADER; `ls src/components/app/CardstockHeader.tsx` → no such file), but the gap survived the shelving: `src/components/app/PageCreateButton.tsx:7` still documents the constraint — "is admin/staff + desktop only (CardstockHeader)". The `CreateModal` is mounted once in `AppLayout.tsx:2198` behind `createOpen`, whose triggers are staff-side.
- decision-note: none
- cost-rank: 3
- recommendation: Decide it as one question with ID-31 and ID-86. A member can currently create nothing from the chrome; the "until page-level controls land" premise has held for a week.

## ID-91: The Lessons nav inclusion (I6) is built and module-gated but awaits go/no-go
- item: Removal would be a one-line drop in ClientNavItems plus a small block in AppOverviewModal.
- sources: TASK-UIPOLISH-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: Both halves are exactly as described and still awaiting the ruling. `AppLayout.tsx:1134` is the one line (`{lessonsOn && <RailLink to="/app/lessons" label="My Lessons" …/>}`); `AppLayout.tsx:1120` names it ("dropping it is the one `lessonsOn &&` line"); `src/components/app/AppOverviewModal.tsx:98` is the `if (lessonsOn)` block. `mod.lessons` is enabled in prod, so it is currently visible to every member.
- decision-note: none
- cost-rank: 3
- recommendation: Owner go/no-go. It is live to members today, so "awaiting a decision" and "shipped" are the same thing right now.

## ID-92: npm run build:client fails at the copy step with ENOSPC
- item: The host disk was at 99% capacity (134Mi free); unrelated to the change and not fixed.
- sources: TASK-UIPOLISH-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: CLOSED BY LATER WORK
- evidence: `df -h` on this host today → `/System/Volumes/Data 228Gi total, 132Gi used, 70Gi available, 66%`. The 99%/134Mi condition is gone (the PROFILE session's 8GB node_modules cleanup and subsequent housekeeping). `public/ffmpeg/ffmpeg-core.wasm` still exists and is still copied.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing, but keep the disk census in the session-start routine — this failure mode looks like a code error and is not one.

## ID-93: Superadmin's live chrome was never re-verified after the isSuperAdmin conditionals
- item: The conditionals restoring original drawer behaviour were checked by code trace only; no superadmin credentials.
- sources: TASK-ONEMENU-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: The conditionals are load-bearing and numerous — `AppLayout.tsx:2155` `{!isSuperAdmin && (…)}` wraps the whole drawer nav block, `:2189` wraps `NavFooter`, and `:2179-2188` is the commented-out staff Account block (ID-82) inside the same region. Still no superadmin session in this environment.
- decision-note: D1a bears — `admin@cactai.io` is the platform owner with `org_id` NULL, so a superadmin click-through will legitimately be denied by tenant-gated functions and that is not breakage. Noted only.
- cost-rank: 4
- recommendation: Fold into ID-49's session as a separate login. Read D1a first so denials are not re-reported as bugs for the fourth time.

## ID-94: Pixel-level rendering of the wall-return work was assumed, not verified
- item: jsdom/React Testing Library only; no browser session.
- sources: TASK-WALLRETURN-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `src/lib/wallReturn.ts`, `src/pages/app/Onboarding.tsx` and `AppLayout.tsx` are all unchanged in the relevant paths. Same browser wall as ID-49.
- decision-note: none
- cost-rank: 4
- recommendation: Fold into ID-49.

## ID-95: That enterApp() is the only place onboarding navigates the member away was read, not fuzzed
- item: Every `navigate(` call site was checked by reading; no exhaustive UI-path test was run.
- sources: TASK-WALLRETURN-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `src/pages/app/Onboarding.tsx:397-409` — `enterApp()` calls `consumeWallReturnDestination()` and then `navigate(…, { replace: true })` on both branches. The assumption is unchanged and still unproven by test.
- decision-note: none
- cost-rank: 5
- recommendation: A single test asserting `consumeWallReturnDestination` is called on every exit path would convert this from reading to proof. Cheap, and the wall is a security-adjacent surface.

## ID-96: The wall return fires on enterApp() rather than the instant the wall clears
- item: A deliberate trade of the task's literal wording against not yanking a member away mid-flow.
- sources: TASK-WALLRETURN-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `Onboarding.tsx:397-406` confirms the chosen point — the destination is consumed inside `enterApp()`, after `markTourSeen()`, not on a `my_wall_state()` transition. No owner ruling on the trade-off is recorded.
- decision-note: none
- cost-rank: 5
- recommendation: Confirm the judgment call with the owner and write it down; it is the kind of deviation that gets "fixed" back by a later thread reading the original wording.

## ID-97: No browser was opened for TASK-I's I1–I5 UI work
- item: All of it is code-complete, browser pending.
- sources: TASK-I-REPORT.md (2026-08-04)
- raised: 2026-08-04
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx` and `src/components/app/AccountPanels.tsx` both still carry the I-series work (e.g. the I6 ordering comments at `AppLayout.tsx:1147-1155`, `AccountPanels.tsx:27-40`). This is the oldest entry in the browser-verification backlog and it has been overtaken twice by ONEMENU and REVIEWNAV.
- decision-note: none
- cost-rank: 4
- recommendation: Do not verify I1–I5 as specified — the surfaces have changed twice since. Verify today's nav and Account hub once (ID-49) and retire this entry.

## ID-98: A rider account has never clicked through SessionNotesView
- item: F3 was verified by type/lint checks and a rolled-back RPC proof only.
- sources: TASK-F3-REPORT.md (no header date; status CODE-COMPLETE, BROWSER PENDING)
- raised: (undated report; batch6 window)
- status: STILL OPEN
- evidence: `src/components/app/SessionNotesView.tsx` exists and is unchanged; its consumers `CalendarPage.tsx` and `MyLessons.tsx` are live. Same browser wall as ID-49, and this one additionally needs a RIDER-group member session, not a staff one.
- decision-note: none
- cost-rank: 4
- recommendation: Needs a member login, so it will not be covered by the staff walkthrough — schedule it separately.

## ID-99: The ACCOUNTSURFACE worktree had no Supabase credentials, so nothing runtime could be checked
- item: The app throws "supabaseUrl is required"; the 390px screenshot and the runtime halves of four items could not be done, and it is not a gap the thread could close itself.
- sources: TASK-ACCOUNTSURFACE-REPORT.md (2026-08-05, two entries)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: The specific blocker is partly gone and the consequence is not. This worktree DOES carry `.env.db` (the Postgres string I used all pass), but no `VITE_SUPABASE_URL`/anon key for the client app and no authenticated session — so `/app/stable`, `HorseIntakeForm`, `StableSection` and the accordion at 390px remain unobserved, exactly as reported.
- decision-note: none
- cost-rank: 3
- recommendation: Give one worktree the client env vars and a test login, or accept that every UI item in this slice ends at "code-complete". Eleven families here (ID-19, 49, 50, 57, 60, 62, 93, 94, 97, 98, 99) are the same missing capability wearing different hats.

---

# SLICE SUMMARY
- raw items in slice: 109
- families after dedup: 99
- status counts: CLOSED 14 / OPEN 81 / SUPERSEDED 2 / CANNOT-DETERMINE 2
- possible cross-domain overlaps:
  - **UI slice** — ID-75 (duplicate nav glyphs), ID-77 (nav headings / Records module key), ID-78 (Modules group size), ID-80 (Stable nav link), ID-81 (nav labels), ID-82 (staff Account link in drawer), ID-83 (active-state styles), ID-84 (MenuLink unbadged), ID-85 (hover sweep scope), ID-86 (Add New divider), ID-87 (UIO-016 comment), ID-88 (staff rail green), ID-89 (dropdown max-height), ID-90 (member create affordance), ID-91 (Lessons nav I6), ID-76 (TEXTEDIT nav diff), ID-14 (DashboardPanel loading/error), ID-30/ID-32 (Account hub cosmetics)
  - **SEC slice** — ID-33 (writes without assertWrote), ID-61 (member_directory_list gating vs D8), ID-58 (gift coalesce narrowing), ID-63 (PostgREST cache), ID-72 (one_company_contact_per_org)
  - **DB-MISC slice** — ID-66 (create_horse_record microchip), ID-67 (suggested_category_for_contact), ID-68 (save_calendar_item), ID-69 (bookings.client_id NULL), ID-70/ID-71/ID-43 (test coverage, all blocked on the broken test:db harness), ID-74 (unapplied biz-financials migration)
  - **DOCFLOW slice** — ID-94/95/96 (wall return + onboarding), ID-98 (SessionNotesView)
  - **EMAIL slice** — ID-37 (invitation expiry), ID-40 (admin-send-invitation error shape), ID-39 (clients never invited)
- items you could not process: none

## Notes on the dedup (109 → 99)
Ten source items collapsed into six families:
- **ID-01** absorbed 4 items (batch1#44, batch1#47, batch2#84, batch3#80) — the same ContactForm/contact_type fact reported by four threads.
- **ID-08** absorbed 2 (batch7#19, batch2#99) — the ContactsPage nav guard, reported as a defect and as a blocked edit.
- **ID-23** absorbed 2 (batch2#87, batch4#24) — /account bouncing members.
- **ID-24** absorbed 2 (batch3#22, batch4#22) — Saved Content has no data model.
- **ID-49** absorbed 2 (batch2#100, batch6#90) — the roster render, unverified for the same reason twice.
- **ID-75** absorbed 2 (batch7#35, batch5#114) — duplicate nav glyphs (Contact and Shield), which resolved asymmetrically: Contact fixed, Shield not.
- **ID-80** absorbed 2 (batch7#7, batch8#67) — the Stable link, reported from both sides of the ACCOUNTSURFACE/ONEMENU handoff.
- **ID-99** absorbed 2 (batch7#13, batch7#14) — no credentials, and the runtime behaviour that therefore rests on reasoning.
Items that merely *look* like duplicates were kept apart: ID-01 vs ID-02 vs ID-48 (three different consequences of one missing column write), ID-19 vs ID-49 vs ID-57 vs ID-62 vs ID-93 vs ID-94 vs ID-97 vs ID-98 vs ID-99 (one missing capability, nine different unverified surfaces — the recommendation on ID-99 names them all).
