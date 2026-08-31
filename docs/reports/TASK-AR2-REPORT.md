# TASK-AR2 — REPORT · reaching a client record, and booking a weekly rider

**Worktree** `~/Downloads/claude-code-repo/wt-ar2` · **branch** `task/ar2` · **base** `bb49e713`
**Method** source read (every branch, not "what it would render") + production `psql`, SELECT-only,
staff impersonation inside `BEGIN … ROLLBACK`. **No writes. Nothing fixed.**
**Measured 2026-08-30.** Counts differ from the task brief's 2026-08-27 figures — two people were
added since. **Re-verified numbers are used throughout and the drift is named where it matters.**

---

## 1. ⚠️ URGENT

### U1 — $880 was paid on 2026-08-26 and the system placed nothing. Staff cannot see it or fix it.

**Madeline Do**, purchase `c93d1c7c-b02c-4332-adc5-2d39efb8d029`, `2x Weekly Lessons`, `status=paid`,
`payment_status=paid`, `amount=880.00`. What it produced:

| | |
|---|---|
| `purchase_items.config` | `{}` — **no `recurring_days`, no `recurring_times`, no horizon** |
| `bookings` on that purchase | **0** |
| `lesson_credits` rows | **0** |

Her only booked sessions hang off the **earlier, unpaid** `2x Weekly` order
(`84d044a4…`, `awaiting_payment`, 2026-08-18), whose allotment row reads `total 4 / remaining 0` and
**expires 2026-09-01**.

**And she is shown TWO identical plans to choose between.** Run as her own login:

```
my_standing_slots() → 2 rows, both "2x Weekly Lessons", both "chosen": false
  c93d1c7c… (paid,   booked_ahead 0)
  84d044a4… (unpaid, booked_ahead 1)
```

**Staff see neither.** `StaffStandingSlotSection` — the only staff control that can set a standing
weekly time — mounts **exclusively** on `ContactDossierModal`, and the dossier is **unreachable for
every one of the 24 people on the Clients list** (F3). Madeline is `contact_type='CONTACT'`, has no
horse, and is not archived, so no door opens onto her dossier at all.

**Why it is urgent and not merely a finding:** money has changed hands, the product is a *reserved
time*, and the only party who can place it is the client herself — from a bar on her own Calendar
that offers her a choice between a paid plan and an unpaid one with no way to tell them apart.
**Do not fix it here.** ORCH6 should decide whether Claire is told to have Madeline pick, or whether
the first build thread out of this report leads.

### U2 — five of six live recurring plans have an empty `config`.

```
offering                 status            payment   config
1x Weekly Lesson         awaiting_payment  unpaid    {}        2026-08-30  (today)
2x Weekly Lessons        paid              paid      FULL      2026-08-26  (Steph — the only one)
2x Weekly Lessons        paid              paid      {}        2026-08-26  (Madeline — U1)
2x Weekly Lessons        draft             unpaid    {}        2026-08-22  (Rachel Page)
2x Weekly Lessons        awaiting_payment  unpaid    {}        2026-08-18  (Madeline, duplicate)
1x Weekly Lesson         awaiting_payment  unpaid    {}        2026-08-15  (Gabriella Olenik)
```

**This is not "pre-launch empty."** Each row is a sold plan whose entitlement — under D23 the chosen
days *are* the entitlement — was never created. **One in six worked**, and the one that worked
(Steph, 27 bookings Tue 17:00 / Sat 14:00 through 2026-11-28) was configured **98 seconds after
provisioning, through a door that closes on page reload** (F4d).

---

## 2. WHAT THIS AREA IS FOR

Someone gets in touch, or Claire meets them at the barn. She writes down who they are, what they
ride, who to call in an emergency, and which horse is theirs. She sells them something — usually a
weekly riding slot — takes the money by Zelle or cash, picks the day and time with them on the
phone, sends them a link so they can sign the paperwork and see their own calendar, and from then on
keeps coming back to that one page to change the day, add a horse, assign a document, or check
whether they ever signed in.

**That is one page and one person, from first phone call to years later.** Everything in this report
is about the fact that the app instead has *five* of those pages, each holding a different third of
the job, and the one you get depends on which list you happened to click through — never on where
the person actually is in their life.

---

## 3. THE STATE MATRIX

**All 24 people on the Clients list are `contact_type = 'CONTACT'`.** There are 5 `LEAD`, 4 `TEAM`,
**0 `PARTNER`, 0 `VENDOR`, 0 archived**. *(Those zeroes are not a finding — they are load-bearing
for the reach rule in F3.)*

### 3a — the Clients page (`/app/records/clients`, `Admin.tsx`) by life stage

`kind` is `admin_client_accounts()`'s own discriminator: `account` = a `profiles` row with a login;
`pending` = a `clients` row without one; `contact` = neither.

| Life stage | `kind` | live | Nine tabs | Provisioning form | Agreed-lesson picker | Horse add | Attach offering | Paperwork editor | Invitation controls | **Standing weekly slot** |
|---|---|---|---|---|---|---|---|---|---|---|
| Contact, no account, never invited | `contact` | **1** | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ (send) | **✗** |
| Client saved, invitation never sent | `pending` | **14** | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ (send) | **✗** |
| Invitation SAVED as draft | `pending` | 0 today | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ (send) | **✗** |
| ⚠️ **Invitation SENT, never signed in** | `pending` | **2** | **✗** | **✗** | **✗** | **✗** | ✗ | ✓ | ✓ (resend/expire/regen) | **✗** |
| Signed in, no purchases | `account` | 5 | ✓ | **✗** | **✗** | ✓ *(Documents tab)* | ✓ *(Orders tab)* | **✗** | **✗** | **✗** |
| Active client with orders | `account` | 2 | ✓ | **✗** | **✗** | ✓ *(Documents tab)* | ✓ *(Orders tab)* | **✗** | **✗** | **✗** |
| Archived | — | 0 | n/a — archived people leave this list entirely; they surface only on Records › Archived, which opens the **dossier**, read-only |

**The two people in the stranded row are Pamela Godde and Charlotte Caddell.** Pamela is the owner of
the live production lease and the named subject of CR-31 and CR-80.

**Gate evidence, exact:**
- `Admin.tsx:1018` and `Admin.tsx:1033` — the tab **rail** and the tab **body** are each wrapped in
  `{selected.kind === 'account' && (…)}`. ⚠️ **Correction to the brief:** the tabs do not "render
  against nothing" — they **do not render at all**. `Admin.tsx:739`'s
  `if (!selectedId || !selected?.user_id) return;` only skips the fetch; the tabs were already gone.
- `Admin.tsx:1005` — `{selected.kind !== 'account' && <PendingClientView …/>}`, which is the sole
  host of `PaperworkEditor` and `InvitePanel`.
- `Admin.tsx:379` — `if ((neverInvited || isDraft) && row.contact_id)`, with
  `neverInvited = !row.invite_id && !row.invite_status` (`:363`) and
  `isDraft = row.invite_status === 'draft'` (`:369`).

**So gate 2 is narrower than the brief states.** It closes on **two** conditions, not one: the
invitation going out *and* the person signing in. `InvitePanel` sits inside `PendingClientView`, so
**a signed-in client never reaches the provisioning form either** — the hole is not a gap between two
surfaces, it is a gap that swallows everything after `neverInvited || isDraft`. **9 of 24 people
(2 stranded + 7 accounts) have no provisioning surface on this page.**

### 3b — the same person, by which list you clicked through

| Entry point | Surface you get | Who is on it |
|---|---|---|
| Records › **Clients** | `Admin.tsx` — nine tabs *or* provisioning form | the 24 `CONTACT`s |
| Records › **Leads** | quick-view modal → *"Full record"* → **`ContactDossierModal`** | the 5 `LEAD`s |
| Records › **Partners** / **Vendors** | same → **dossier** | **0 people** |
| Records › **Horses** → click owner/lessee | **dossier** | Sarah Morgan · Pamela Godde · Abby Little |
| Records › **Archived** | **dossier**, read-only | **0 people** |
| `/app/ops/review/contact-dossier` | **dossier**, behind a review banner | any, admin-only |

⚠️ **This is the answer to *"older accounts showing the older records page."*** There is a real
split, and **the rule is not the account's age — it is which tab you entered through.** Nothing about
the person decides it. Nothing about their stage decides it. The identical human being renders as a
nine-tab isolated view from Clients and as a seven-tab dossier from Horses, and the two surfaces do
not hold the same things.

### 3c — staff vs member

| Capability | Staff | Member (own login) |
|---|---|---|
| See their standing weekly slot | dossier only — **unreachable for all 24 Clients-list people** | ✓ Calendar bar (`CalendarPage.tsx:431`, gated `!isStaff`) + onboarding wizard |
| **Set / change** the slot | same, unreachable | ✓ same two places |
| Edit contact fields | dossier, 30 fields · `ContactForm`, 4 fields | own profile surfaces |

⚠️ **`CalendarPage.tsx:431` is `{!isStaff && standing.length > 0 && …}`** — staff are explicitly
excluded from the calendar's standing bar. Combined with the dossier's unreachability, **no staff
member can see a client's weekly time anywhere in the app.**

### 3d — desktop vs mobile

Nothing in this area is desktop-only; the failures above are identical on a phone. Two mobile-specific
notes, both minor and both recorded as findings: the dossier is `h-[85vh]` where the repo's own newer
overlays use `dvh` (F14), and reaching a client record on a phone is Records → tab strip → card →
(on non-Clients tabs) quick-view modal → *"Full record"* — **four taps to a record**.

---

## 4. FINDINGS

### F1 — The nine-tab surface is keyed on having a LOGIN, and 17 of 24 people do not have one.
**Evidence.** `Admin.tsx:1018`, `:1033` gate on `selected.kind === 'account'`; `:739` gates the
`admin_client_overview` fetch on `selected.user_id`. `admin_client_accounts()` returns
`account` (7) · `pending` (16) · `contact` (1) — measured 2026-08-30.
**Conditions.** Always true, every viewport, staff and admin alike. `pending` and `contact` rows
carry `user_id = NULL` by construction — arms 2 and 3 of the function select `NULL` for it.
**Why it matters.** Overview, Bookings, Documents, Orders, Payments, Activity, Posts, Messages and
Login are **absent** — not empty — for 71% of the people on the page. Gate 1 was correct in July when
this file was an *account* admin page. It is wrong now that the page is the people page.

### F2 — The provisioning form is gated on TWO conditions, and the second one is invisible.
**Evidence.** `Admin.tsx:379`, inside `InvitePanel`, which is only mounted from `PendingClientView`
at `Admin.tsx:1005` under `selected.kind !== 'account'`.
**Conditions.** The block renders **only** when the person has no login **and** has either never been
invited or holds a draft invitation. Sending the invitation closes it; signing in closes it
permanently.
**Why it matters.** Nine capabilities leave with it (F5). **The brief and CR-80 describe this as a
gap between two surfaces; it is not — it is the terminal state.** Once someone signs in, the
provisioning form never returns, which is precisely the owner's *"an existing client who wants to
start, resume, or change a weekly plan has no surface."*
**And the history is the finding.** `git log` on `:379`: the condition was `neverInvited` alone until
2026-08-23, when `618c673d` *"PAMELA §A: the account exists when it is saved, not when the email goes
out"* widened it to `neverInvited || isDraft`. **That fix did not reach Pamela.** Her invitation was
sent 2026-08-25 (`invitations.2735fd45…`, `status='sent'`), two days after the fix, and the moment it
went out the surface closed again. The owner's 2026-08-27 walkthrough is the same complaint arriving
a second time against the same line.

### F3 — Five surfaces render a person; the most complete one is unreachable for everyone on the Clients list.
**Evidence.** `ContactDossierModal` is mounted at exactly four live call sites —
`RecordsPage.tsx:129` (horse cross-link), `ArchivedAccountsPage.tsx:164`, `ContactsPage.tsx:455`
(the Leads/Partners/Vendors renderers), `ReviewMounts.tsx:85`. **`Admin.tsx` does not mount it.**
`ContactsPage` filters by stored `contact_type`; `MODE_TYPE` maps `leads→LEAD`, `vendors→VENDOR`,
`partners→PARTNER`. All 24 Clients-list people are `CONTACT`, and **no live route renders
`ContactDirectory` in `contacts` mode** — `/app/ops/contacts` redirects (`App.tsx:338`).
**Conditions.** Universal. The only exception is a person who owns or leases a horse, who can be
reached from Records › Horses — three people, none of whom has a recurring plan.
**Why it matters.** This is `CR-33` and `CR-80`'s *"shitty outdated version"* inverted: the dossier is
not the outdated one. It is the **only** surface that carries the 30-field record, relationships,
paperwork, orders with line items, **and the standing weekly slot** — and the incumbent Clients page
cannot open it.

**Neither surface is a superset of the other:**

| Only on `Admin.tsx` (accounts) | On both | Only on `ContactDossierModal` |
|---|---|---|
| Bookings · Payments · Messages · Posts · Login · sign-in detail | Documents (+assign) · Orders (+attach offering) · Activity/audit · horse records | **30-field record editor** · origin/channel · contact-type filing · Relationships (guardian, dependants, horses, contract roles) · Paperwork · Notifications · **standing weekly slot** |
| **invitation lifecycle**: resend · expire · delete · regenerate-with-confirm · every link ever issued · timeline | provisioning form + agreed-lesson picker | — |
| suspend / reinstate · remove · archive · hard delete | — | — |

### F4 — ⚠️ The 2× weekly. The engine works; the doorway is on the wrong page. *(CR-81, corrected)*
**F4a — the brief's diagnosis is out of date and would produce the wrong build.** The brief and CR-81
both state that picking the standing days and times *"exists only inside `ProvisionClientForm` +
`AgreedLessonSection`."* **It does not, and it never did.** `AgreedLessonPanel.tsx:22-30` says so in
its own header: `provision_client_invitation(p_agreed_lesson => …)` writes **one `bookings` row** —
the lesson agreed on the phone. **It never writes `purchase_items.config`.** Routing a weekly plan
through it *"would book one lesson and leave the membership with no slot at all."*

**F4b — the real control exists and shipped.** `StaffStandingSlotSection`
(`StandingSlotPicker.tsx:306`, TASK-SLOTREACH, merged `31973642`) reads `client_standing_slots` — a
staff-gated read keyed on `buyer_contact_id` — and writes through `set_my_standing_schedule`, the
same RPC the member's picker calls. **This is a D18-clean single writer and it must be kept.**

**F4c — and it is mounted in exactly one place.** `ContactDossierModal` Orders tab (`:460`) and
Account tab (`:478`, `:510`). Nowhere in `Admin.tsx`. Therefore, by F3, **staff reach it for 1 of the
5 people who have bought a weekly plan** — Rachel Page, and only because she is still filed as a
`LEAD`. The other four are `CONTACT`s with no horse.

| Recurring buyer | `contact_type` | login | horse | staff can reach the picker? |
|---|---|---|---|---|
| Rachel Page | `LEAD` | ✗ | ✗ | **✓** — Records › Leads |
| Steph | `CONTACT` | ✗ | ✗ | ✗ |
| Madeline Do | `CONTACT` | ✓ | ✗ | ✗ |
| Evan LaBuzetta | `CONTACT` | ✓ | ✗ | ✗ |
| Gabriella Olenik | `CONTACT` | ✗ | ✗ | ✗ |

**F4d — how the one that worked, worked.** Steph's audit trail: contact INSERT `20:28:27` → filed
`LEAD` `20:28:28` → provisioning spine (`clients` + `groups`, and `contact_type` back to `CONTACT`)
`20:28:54` → 27 bookings + credits `20:30:32`. **She was created from the Leads tab, provisioned from
inside her own already-open dossier, and the slot was set on that same open modal — after the
provisioning had already moved her off the list the modal was opened from.** Reload the page and that
door is gone. That is not a workflow; it is a modal outliving its list.

**F4e — adding the offering elsewhere writes an order line and nothing else.** `AttachOfferingPanel`
(the only offering-add an `account`-kind client has, on the Orders tab) calls
`adminAttachOfferings → attach_offerings_to_client → _provision_purchase_for_offerings`. That chain
takes no schedule argument and writes no `config`. **This is exactly the owner's *"it doesn't show up
the same way"*** — and the five `config = {}` rows in U2 are its output.

### F5 — What lives ONLY on the provisioning path, and would be lost in a naïve consolidation.
**The task requires this list. Nothing below exists anywhere else.**

**In `ProvisionClientForm` (`AccountInvitePage` · `Admin.tsx` draft branch · dossier Account tab · `LeadWorkDrawer`):**
1. **Save-without-send** — the invitation persists as a `draft` and round-trips through
   `invitations.categories / offering_ids / template_keys`. PAMELA §A's whole point; no second store.
2. **Identity block written to the contact** — `phone`, `address_line1`, `city`, `state`,
   `postal_code` via `update_contact_record` (D22 propagation to contract party tokens).
3. **Evaluation-first enforcement** — `lessonsLocked` (`:399`) makes every riding lesson
   unselectable until the Evaluation is picked. Owner ruling 2026-08-25, enforced only here.
4. **Paperwork narrowing with a mandatory reason** — `narrowContactRequiredDocuments`, run first and
   alone so a refusal leaves nothing half-applied (NOSTRIP §2).
5. **Payment status at point of sale** — paid / partial / unpaid + method + partial amount, folded
   into the same act.
6. **The scheduling gate** — `schedulingNeeded` (`:363`): the picker appears only for a RIDER or a
   `scheduled`/`recurring` offering. Owner-specified; it is a gate, not a collapse.
7. **The agreed lesson, in one act** — books through `schedule_lesson_session` *and* names the slot
   in the invitation email using `AgreedLesson.display`, because **this database has no tenant
   timezone column** and a server-formatted time reaches the client in UTC.
8. **`InviteResultPanel`** — the claim URL shown when email delivery fails.

**In `Admin.tsx`'s post-invitation branch — the page the owner wants "thrown in the trash":**
9. **Resend the same link** (`adminResendInvitation`) — the link keeps working.
10. **Regenerate**, behind a two-press confirmation, explicitly distinct from resend (owner ruling
    2026-08-11).
11. **Expire now** · 12. **Delete invite**.
13. **`InvitationHistoryPanel`** — every link ever issued, with the real URL on each row. The support
    view for *"a client just read me a link over the phone."*
14. **The invitation timeline** — `entityStatusLog('account', invite_id)`: sent → resent → redeemed →
    superseded.

⚠️ **Items 9–14 exist nowhere else in the app.** The surface he wants deleted is the only place the
invitation lifecycle is visible or controllable. **Retire the layout, keep the fourteen.**

### F6 — The Overview tab's order count reads 0 for everyone, and disagrees with the Orders tab beside it.
**Evidence.** `admin_client_overview` computes `counts.orders` as
`SELECT count(*) FROM purchases WHERE buyer_user_id = p_user_id`. **All 13 live purchases have
`buyer_user_id IS NULL`** — the staff provisioning spine sets `buyer_contact_id` only.
`Admin.tsx:800`'s `buyerFilter()` correctly matches `buyer_contact_id.eq… , buyer_user_id.eq…`.
**Measured:** Evan `0` vs `2`; Madeline `0` vs `2`; everyone else `0` vs `0`.
**Conditions.** Every login-backed client, always. `counts.documents`, `counts.bookings` and
`counts.posts` all agree with their tabs; **only orders is wrong.**
**Why it matters.** COUNTFIX's rule: one fact, one named query. Two numbers for one fact, two clicks
apart, is how staff stop trusting the page.

### F7 — Unsaved edits on the dossier are destroyed by a backdrop click or Escape. *(CR-68a, live)*
**Evidence.** `ContactDossierModal.tsx:243` — the backdrop carries `onClick={onClose}`; the panel
stops propagation. `:170-174` — Escape calls `onClose`. `dirty` is component state and is never
committed on close. There is a separate **"Save changes"** button at `:587`.
**Conditions.** Every dossier, every field, every viewport.
**Why it matters.** CR-75 settled the opposite rule — *"closing everything … saves their work"* — and
ruled that **an expanded card needs no separate save button**. The dossier today does both wrong
halves: it has the button, and closing discards. The owner has already reported this exact behaviour
once (*"the click out of the modal closes it and the data is lost"*).

### F8 — The dossier offers "Send invitation" to someone already holding a live link, with no history and no confirmation.
**Evidence.** `ContactDossierModal.tsx:206` — `const [invited, setInvited] = useState(false)`, never
seeded from the record. The Account tab's branch at `:526` reads
`archived ? … : invited ? "Invitation sent to …" : !c.email ? … : <ProvisionClientForm/>`.
**Conditions.** Any contact with an email and no login, on first render — **including Pamela, whose
invitation went out on 2026-08-25.** `invited` only becomes true after a send in that same modal
session.
**Why it matters.** `adminSendInvitation` defaults to `mode: 'new'`, which by its own contract
*"leaves any prior live link working"* — so the act mints a **second live claim link** for one person
with no warning. `Admin.tsx` guards precisely this with a two-press confirm and shows the full
history; the dossier shows neither. **Same act, two surfaces, one guarded** (D19).

### F9 — Two contact editors, 4 fields against 30, and the create path is the small one.
**Evidence.** `ContactForm.tsx` writes `first_name`, `last_name`, `email`, `phone` — four columns.
`ContactDossierModal`'s `FIELD_GROUPS` covers 30 across five groups plus origin/channel and filing.
`ContactsPage` uses `ContactForm` for **create** and `updateContact` for edit; the dossier writes
through `update_contact_record`.
**Conditions.** Every contact created from Leads / Partners / Vendors.
**Why it matters.** `reviewSection.ts:185` already records that DUPE$ ps -Ao pid,stat,etime,command | grep -Ei "psql|vite|node .*dev|nodemon|esbuild|chromium|playwright" | grep -v grep
(no output — 0 matching processes) recommended retiring
`ContactForm` onto `update_contact_record` and **that it was not attempted**. Emergency contacts,
riding background, date of birth, address and preferred contact — the fields Claire needs before a
first lesson — cannot be captured at creation on any surface except `ProvisionClientForm`'s partial
identity block.

### F10 — `CONTACTS_PAGE_RETIRED` retires a route, not a surface.
**Evidence.** `ContactsPage.tsx:663` sets it `true`; `App.tsx:338` redirects `/app/ops/contacts` to
`/app/records/clients`. But the file also exports `LeadsPage`, `PartnersPage`, `VendorsPage`,
`DirectoryPage` (`:669-689`), and `RecordsPage.tsx:117-120` mounts three of them **live**.
**Conditions.** Always.
**Why it matters.** The brief lists this file as *"behind `CONTACTS_PAGE_RETIRED`"*. It is not. It is
the live renderer for three Records tabs and the only live door onto the dossier. **A retirement
plan written against that assumption would delete a working surface.**

### F11 — Adding a horse to a client's record is missing in exactly the state where it was asked for.
**Evidence.** `ClientHorseRecordsCard` (with its STABILIZE item-3 *"Add a horse"* button, which opens
the incumbent `HorseIntakeForm` with `ownerContactId` preset) mounts at `Admin.tsx:379`'s draft branch,
`Admin.tsx`'s **Documents tab** for accounts, and the dossier's Documents tab.
**Conditions.** For a `pending` person whose invitation has been **sent** — Pamela, Charlotte — it
renders **nowhere**. For an `account`-kind person it renders only after clicking through to a tab
labelled *Documents*, which is not where anyone looks for a horse.
**Why it matters.** CR-31 is *"i have no way to add a horse to pamela godde's client record."* The
capability was built. **On the named person, in her current state, it is still absent** — and she owns
Sundance, so a record exists to attach to.

### F12 — Three functions read one person, and they disagree about what a person is.
**Evidence.** `admin_client_accounts()` (three UNION arms, keyed on `profiles`/`clients`/`contacts`,
returns 24) · `staff_contact_directory()` (keyed on stored `contact_type`, feeds
`ContactDirectory`) · `contact_dossier(contact_id)` (keyed on the contact, returns everything).
**Conditions.** Always. `contact_dossier` **already works for every kind** — verified against Pamela
(`account` → JSON `null`, correct) and Madeline (`account` populated).
**Why it matters.** `contact_dossier` is the read that does not need a login and does not need a
`contact_type` bucket. **It is the one that should survive.** The other two are list reads and can
stay list reads.

### F13 — Three code comments now describe behaviour that no longer exists.
- `Admin.tsx:50` lists the account tabs as *"Overview / **Billing** / Bookings / …"*. There is no
  Billing tab; `TABS` has nine and Billing is not one.
- `Admin.tsx:145` says `admin_client_overview` *"builds its profile block from `profiles`, whose
  look-alike address columns the onboarding intake does NOT write."* **`profiles` has no address
  columns at all** — the RPC reads `phone`/`mobile`/`whatsapp` from `contacts` already.
- `api-calendar.ts:731` says `my_standing_slots` is *"caller-scoped (`buyer_user_id = auth.uid()`)"*.
  The live body also matches `buyer_contact_id = current_contact_id()`, which is the only reason the
  member's Calendar bar works at all — every live purchase has `buyer_user_id IS NULL`.
**Why it matters.** D20. Each of these is a sentence a future thread would reason from. The third one
would have produced a false URGENT in this very report.

### F14 — Mobile: the dossier is sized in `vh` where the repo's newer overlays use `dvh`.
**Evidence.** `ContactDossierModal.tsx:245` — `h-[85vh]`. The add-horse overlay two files away
(`ClientRecordActions.tsx:314`) uses `max-h-[92dvh]`, as do `Modal.tsx`, `CreateModal`, `Header`,
`HorseRecordsPage` and eight others.
**Conditions.** Mobile browsers with dynamic chrome — the owner's working device.
**Why it matters.** Low severity, but this surface is a candidate to become *the* record surface, and
`vh` on iOS measures the chrome-less viewport, so the footer holding **Save changes** is the part that
goes under the browser bar.

### F15 — CRUD, per entity, on this area

| Entity | Create | Read | Update | "Delete" (D32 = archive) |
|---|---|---|---|---|
| **Contact** | `ContactForm` (4 fields, Leads/Partners/Vendors) · `ProvisionClientForm` (partial identity) — ⚠️ **no full-field create anywhere** | 3 functions (F12) | dossier only (30 fields) — ⚠️ **unreachable from Clients** | `archiveContact` from the dossier host and from `Admin.tsx`'s Remove/Delete panel |
| **Client (account)** | `ProvisionClientForm` — ⚠️ one gated door | `admin_client_accounts` | suspend/reinstate (`account` kind only) | archive · ⚠️ **hard delete** |
| **Invitation** | `ProvisionClientForm` send/save | `InvitationHistoryPanel` — ⚠️ **`Admin.tsx` only** | resend · regenerate · expire — ⚠️ `Admin.tsx` only | **`adminDeleteInvitation`** — a real delete, D32's odd one out |
| **Horse (on a person)** | ✓ `ClientHorseRecordsCard` — ⚠️ absent in the stranded state | ✓ three surfaces | horse page / horse card | not from here |
| **Offering / order line** | `ProvisionClientForm` · `AttachOfferingPanel` | Orders tab both surfaces | ⚠️ **none** — no void, no change, no re-price from a person's record | ⚠️ **none** (Madeline's duplicate unpaid $880 order cannot be voided from either surface) |
| **Standing weekly slot** | ⚠️ dossier only | ⚠️ dossier only (staff) · Calendar (member) | same | cancel via the picker |

⚠️ **`adminHardDeleteClient` → `POST /api/hard-delete-client`** is offered on **every** kind,
including a bare contact, behind a typed `DELETE`. Under D32 it is already the acknowledged exception;
worth naming because the consolidated surface will inherit it and should not spread it.

---

## 5. THE PLAN

**Sequencing rule for ORCH6:** P0 is a data act, not a code change, and is independent of everything
else. P1 and P2 **must land together** — P1 alone makes a control reachable that then has no home;
P2 alone gives the record a home with the control still missing. P3–P6 are independent and can run in
any order after P2. P7 and P8 are independent of all of it.

### P0 — Place Madeline's paid slot, and resolve the duplicate order. *(independent, do first)*
Not a build. Either Claire sets the days on Madeline's paid plan (`c93d1c7c…`), or Madeline is asked
to pick from her Calendar bar — but she is currently shown two identical plans, so **the unpaid
duplicate (`84d044a4…`) must be voided or clearly distinguished first**, and there is no UI that can
void it (F15). ⚠️ **Owner decision, not a thread's.**

### P1 — Mount the record surface on the person, not on the login. *(with P2)*
Delete gates 1 and 2 as *surface selectors*. `contact_dossier` already serves every kind (F12), so the
record surface stops asking "do they have a login?" and starts asking "what does this person have?" —
each section renders when its own data exists, exactly as `StaffStandingSlotSection` already does
(it returns `null` when there is no recurring purchase). **The stage-dependent sections become
stage-dependent CONTENT inside one surface**, which is CR-30's *"a provisioning cover page"* and
CR-75's expanding row, not a fourth flag (D31).

### P2 — Make the Clients list open that surface. *(with P1)*
`Admin.tsx`'s isolated view is replaced by the consolidated record. Under **CR-75** the Clients grid
becomes **condensed alphabetical rows that expand in place**, and under **CR-74** the horse inside it
is the expanding editable card the owner rates highest — the component already exists
(`ClientHorseRecordsCard` → `HorseRecordsPage`'s row card). ⚠️ **The document level is the one CR-75
says to test rather than decide.** Report where the line landed; do not pre-empt it.

### P3 — Give the standing weekly slot the reach the rest of the plan already has. *(after P2)*
`StaffStandingSlotSection` moves onto the consolidated record's Orders section — unchanged, D18-clean.
⚠️ **And `AttachOfferingPanel` must stop being able to sell a recurring plan without asking the
question**: when a picked offering has `config_kind = 'recurring'`, the attach act carries the day and
time or says out loud that the plan has no slot yet. **That is the fix for U2.** ⚠️ It is *not* a
second writer — it calls `set_my_standing_schedule`, the same one.

### P4 — Carry all fourteen provisioning and invitation capabilities forward. *(after P2)*
F5's list, one by one, onto the consolidated record. The invitation block (items 9–14) becomes a
section of the record that renders when an invitation exists — which is what the owner is actually
asking for when he says the configuration page should be thrown away: **not the controls, the fact
that they replaced everything else.**

### P5 — One create path, one field set. *(independent)*
Retire `ContactForm` behind `CONTACT_FORM_RETIRED` (D32: retire, never delete) and rebuild the
Leads/Partners/Vendors create on `update_contact_record`, closing the DUPE$ ps -Ao pid,stat,etime,command | grep -Ei "psql|vite|node .*dev|nodemon|esbuild|chromium|playwright" | grep -v grep
(no output — 0 matching processes) item
`reviewSection.ts:185` records as never attempted.

### P6 — Fix the count, the close, and the double link. *(independent, small)*
(a) `admin_client_overview.counts.orders` matches on `buyer_contact_id OR buyer_user_id` (F6).
(b) Closing the record **commits** `dirty`, and the separate Save button goes (F7, CR-75).
(c) The record reads its own invitation state instead of `useState(false)`, and the send act reuses
`Admin.tsx`'s resend-vs-regenerate distinction (F8, D19).

### P7 — Correct three stale comments. *(independent, trivial, do it inside whichever thread touches the file)*
F13.

### P8 — `h-[85vh]` → `h-[85dvh]` on the record overlay. *(independent, trivial)*
F14.

### Which duplicates are retired, and behind what

| Surface | Verdict | Mechanism |
|---|---|---|
| `ContactDossierModal` | ⚠️ **SURVIVES — it is the incumbent record surface.** It is the only one that keys on the person rather than the login, and the only one carrying the standing slot | — |
| `Admin.tsx` isolated view (nine tabs) | **Retired as a surface; its content merges in.** Bookings, Payments, Messages, Posts, Login and the whole invitation block have no other home | replaced in place; no flag needed once P2 lands |
| `Admin.tsx` list (roster cards) | **Survives, re-shaped to rows** (CR-75) | — |
| `ContactsPage` / `ContactDirectory` | **Survives** as the Leads/Partners/Vendors list renderer. ⚠️ Its fate is **AR3's**, not mine | — |
| `ContactForm` | **RETIRE** | `CONTACT_FORM_RETIRED = true`, `CONTACTS_PAGE_RETIRED`'s pattern |
| `ContactsPage`'s quick-view Modal | **RETIRE** — it is a click between a card and the record, and CR-74 rules the expanded card replaces exactly this | folded into P2's expanding row |
| `ProvisionClientForm` | ⚠️ **SURVIVES, unchanged, four call sites.** It is the one shared spine call; do not fork it | — |
| `AgreedLessonPanel` / `AgreedLessonSection` | **SURVIVES.** It is not the weekly slot and must not be merged with it | — |
| `LeadWorkDrawer` | **Out of scope** — it is the lead handling surface CR-30 rules is correct as a modal | — |
| `/app/ops/review/*` mounts | **Survive** — they are the comparison harness | — |

### How a 2× weekly gets started, changed, or resumed for an EXISTING client
**After P1–P3, one path, on the client's own record, at any stage:**
1. **Orders section → Add offering →** pick `2x Weekly Lessons`, set payment status. *(exists today)*
2. **The attach act asks for the day and time**, because the offering is `recurring` — writing
   `purchase_items.config` through `set_my_standing_schedule`, which materialises the month.
   *(the new half — P3)*
3. **The standing-slot section then shows the plan and both days**, and changing them re-materialises
   from today forward, leaving past weeks untouched. *(exists today, needs reach)*
4. **Resuming or cancelling** is the same section. **Pausing is not modelled anywhere** — flagged, S3.

---

## 6. TEST CRITERIA

Each is provable by query or by rendering against a real production-shaped row. ⚠️ **`test:db` is 51
files red on `main` and proves nothing here** — these are DB assertions and browser-harness renders.

**T1 (P1/P2).** For each of the six life stages in §3a, open the person from Records › Clients and
assert the record surface renders **the same set of section headings**, with a section absent only
when its own data is absent. **Explicit rows: Pamela Godde (`pending`, invite sent) and Madeline Do
(`account`) must both show the record, the horse section, the paperwork section, the orders section
and the invitation section.**

**T2 (P2).** From Records › **Horses**, click Pamela's name on Sundance's row. From Records ›
**Clients**, click Pamela. **Assert the same surface, with the same sections.** Today these are two
different components.

**T3 (P3).** As staff, on Madeline Do: the standing-slot section renders and lists **2** plans.
Set days on the paid one; assert `purchase_items.config->'recurring_days'` is non-empty and
`SELECT count(*) FROM bookings WHERE purchase_id='c93d1c7c-…'` is **> 0**. *(Run against a restored
copy, not production.)*

**T4 (P3).** Attach `2x Weekly Lessons` to a fresh test contact through the offering panel. Assert
**either** `config->'recurring_days'` is non-empty **or** the surface displays an explicit
"no day chosen yet" state naming the plan. ⚠️ **A silent `{}` fails this test** — that is U2.

**T5 (P4).** On a person with `invitations.status='sent'`: assert all six invitation controls are
present (resend · regenerate-with-confirm · expire · delete · full history with URLs · timeline) and
that resend does **not** mint a second `invitations` row while regenerate does.

**T6 (P4).** On a person with `invitations.status='sent'`, assert the offering picker, the paperwork
editor, the horse-add and the agreed-lesson picker all render. **Today all four are absent** (§3a).

**T7 (P6a).** `admin_client_overview(evan)->'counts'->>'orders'` = `2`, matching the Orders tab.
Repeat for Madeline. Today both return `0`.

**T8 (P6b).** Type into a field, click the backdrop. Re-open. **The value is there.** Repeat with
Escape. Assert no separate Save button exists.

**T9 (P6c).** Open Pamela's record. Assert it states an invitation is outstanding and shows its
expiry, and that the primary act is **resend**, not a bare "Send invitation".

**T10 (P5).** Create a contact from Records › Leads. Assert every field the dossier can edit is
offered at creation, and that the row lands with `contact_type='LEAD'`.

**T11 (regression, P1–P4).** `ProvisionClientForm`'s save-without-send still round-trips through
`invitations.categories / offering_ids / template_keys`; the evaluation lock still holds; the
agreed-lesson act still writes exactly **one** `bookings` row and names it in the email.

**T12 (P8).** On an iOS-width viewport with browser chrome visible, the record's footer controls are
reachable without the page scrolling horizontally.

---

## 7. SUCCESS, AT TWO LEVELS

**Per fix**
- **P0** — Madeline's paid $880 has days on the calendar, and she is not shown two identical plans.
- **P1+P2** — one component renders a person; the words `kind === 'account'` and
  `neverInvited || isDraft` no longer decide **which surface** anyone sees.
- **P3** — every `config_kind='recurring'` purchase in the database either has a chosen slot or is
  visibly marked as awaiting one, on a screen staff can reach.
- **P4** — all fourteen capabilities in F5 are reachable from the record, at every stage.
- **P5** — one create path; `ContactForm` retired behind a flag, not deleted.
- **P6** — the two order numbers agree; closing saves; a second live claim link cannot be minted by
  accident.

**For the area**
Claire opens Records, types a name, and the row expands into **that person** — the same sections in
the same order whether they phoned yesterday or have been riding for a year, whether they have a login
or never will. **She can sell them a weekly slot and pick the days in the same act she sells it.** She
never has to know which tab she came in through, and there is no state a person can occupy that leaves
her looking at a screen with nothing on it.

**The measurable version:** today **1 of 5** weekly-plan buyers is reachable by staff for the one
question that plan exists to answer, **9 of 24** people have no provisioning surface, and **17 of 24**
have no record tabs. **After this work all three numbers are 24 of 24 / 5 of 5.**

---

## 8. FLAGGED, NOT FIXED

**S1 — the 90-day horizon and proration. → CR-82, its own thread.** Confirmed live: Steph's plan
materialised **27 bookings through 2026-11-28** — `ensure_standing_slots` line 11
(`current_date + 90`) and `_ensure_plan_horizon` line 10. Zero DB functions match `prorat`, while
`Lessons.tsx:52` already promises proration to the public. **Not in AR2's scope**, but it lands on
`StandingSlotPicker` and `_ensure_plan_horizon`, so it must not run concurrently with P3.

**S2 — `bookings.purchase_id` is NULL on 9 of Madeline's 13 sessions.** A lesson that cannot be traced
to what paid for it. **Not this task's territory** — routing to **AR1 (calendar)**.

**S3 — a weekly plan cannot be PAUSED.** The picker cancels or changes; there is no "skip a month, my
rider is injured" state. Not asked for, not built, and it is the shape a barn will need. **Owner
question, not a thread's.**

**S4 — no order line can be voided, changed or re-priced from a person's record.** Madeline's
duplicate unpaid $880 order has no UI that can retire it. **Neighbouring: whichever thread owns
orders — not named in the AR series.** Flagging for ORCH6 to route.

**S5 — the Records page split. → AR3.** My surface lives inside its outcome. ⚠️ **The dependency runs
both ways and AR3 needs to know it:** the dossier's only live doors today are Leads, Horses and
Archived. **If AR3 moves Leads onto a new Contacts page or removes them per CR-30, the last general
door onto the record surface closes before P2 opens a new one.** P2 must land before, or with, AR3's
tab changes.

**S6 — nav rows and section labels. → AR4.** I touch no nav row. But `/app/admin` is a redirect to
`/app/records/clients` (`App.tsx:316`) and there are inbound `?open=<contactId>` links from
`DashboardPanel.tsx:475`, `DocumentQueueTable.tsx:94` and `dashboard/registry.ts:177`. **All three
must survive P2** or the dashboard stops reaching the record (D17).

**S7 — CR-30's embedded verification task, answered.** *"The one thing to check is if the information
on the client record and the information the user enters into their UI fields are the same resource."*
**Answer: yes for the fields that matter, and it is worth stating plainly.** `profiles` and `contacts`
share only `created_at, email, first_name, last_name, org_id, updated_at`; **`profiles` holds no
phone, no address, no emergency contact.** `admin_client_overview` reads `phone`/`mobile`/`whatsapp`
straight off `contacts`, and the dossier edits `contacts`. **One resource, two views — as ruled.** The
only duplicated facts are `first_name`/`last_name`/`email`, and they were consistent across all seven
login-backed clients when measured. ⚠️ **This clears the verification standing in front of CR-30's
rebuild.**

**S8 — `adminDeleteInvitation` is a genuine hard delete of an invitation row, and `adminHardDeleteClient`
of a person.** Both are D32 exceptions inherited by the consolidated surface. **Not mine to change**;
named so nobody spreads them.

---

## 9. CONTENDED FILES

Every file P0–P8 would need to touch, so the build order can be computed.

| File | Why | Contended with |
|---|---|---|
| `src/pages/app/Admin.tsx` | P1, P2, P4, P6 — the surface being replaced | **AR3** (renders it as the Clients tab), **AR5** |
| `src/components/app/ContactDossierModal.tsx` | P1, P2, P3, P6, P8 — the incumbent record | **AR3**, **AR6** (its Activity tab) |
| `src/components/app/ClientRecordActions.tsx` | P3 — `AttachOfferingPanel` must ask the recurring question | **AR5** |
| `src/components/app/StandingSlotPicker.tsx` | P3 reach; ⚠️ **S1/CR-82 rewrites its copy and horizon** | **CR-82 thread**, **AR1** |
| `src/pages/app/ops/ContactsPage.tsx` | P5 create path; the dossier's live door | ⚠️ **AR3 — high** |
| `src/components/ops/contacts/ContactForm.tsx` | P5 retirement flag | AR3 |
| `src/pages/app/RecordsPage.tsx` | P2 — the Clients tab's contents change shape | ⚠️ **AR3 — high** |
| `src/components/app/ProvisionClientForm.tsx` | P4 — hosted differently, ideally unmodified | AR5 |
| `src/components/app/AgreedLessonPanel.tsx` | P4 — moves with its host; **do not merge with P3** | — |
| `src/pages/app/ops/AccountInvitePage.tsx` | P4 — may become a route onto the record | AR4 |
| `src/pages/app/ops/ArchivedAccountsPage.tsx` | P1 — archived is a state of the one surface | AR3 (Archived tab) |
| `src/lib/admin.ts` | P6c — invitation state and mode on the record | AR5 |
| `src/lib/ops/api-calendar.ts` | P7 — the stale `my_standing_slots` comment | CR-82 thread |
| `src/lib/reviewSection.ts` | P5 — closing the contact-editor group | AR3, AR6 |
| **DB** `admin_client_overview` | P6a — `buyer_contact_id OR buyer_user_id` | none found |
| **DB** `attach_offerings_to_client` / `_provision_purchase_for_offerings` | P3 — carrying a schedule | ⚠️ **CR-82 thread** |
| `src/pages/app/CalendarPage.tsx` | read-only here; named because P3 changes what staff can see | ⚠️ **AR1 — high** |

⚠️ **The two highest-risk overlaps are `RecordsPage.tsx` + `ContactsPage.tsx` with AR3, and
`StandingSlotPicker.tsx` + `attach_offerings_to_client` with the CR-82 horizon/proration work.**
Neither pair should run concurrently.

---

## 10. TEARDOWN

- Every `psql` invocation was a one-shot `psql … <<SQL` that exited on completion. **No session left
  open, no dev server started, no watcher, no browser harness.**
- All impersonated reads ran inside `BEGIN; SET LOCAL role authenticated; … ROLLBACK;`.
  **No mutation was executed, not even a rolled-back one.**
- ⚠️ **Pamela Godde's lease `7adcd08f-fd5d-40f9-b726-634074266d7c` was not read, referenced or
  touched.** Her contact row was read; her document was not.

**Process census, after the work:**

```
$ ps -Ao pid,stat,etime,command | grep -Ei "psql|vite|node .*dev|nodemon|esbuild|chromium|playwright" | grep -v grep
(no output — 0 matching processes)
```

**Worktree** `/Users/cactai/Downloads/claude-code-repo/wt-ar2` · **branch** `task/ar2` ·
**committed:** this file only. **Not pushed.**
