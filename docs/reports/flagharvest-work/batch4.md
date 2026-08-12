# FLAGHARVEST batch4 — extracted items

## TASK-A8B-REPORT.md

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: The shared working directory changed the checked-out branch underneath the session more than once, and the original branch ref got fast-forwarded onto an unrelated foreign commit; recovered via stash into an isolated worktree.
- quote: "the checked-out branch changed underneath this session more than once, and `task/a8b-send-resend-ui`'s own ref ended up fast-forwarded onto an unrelated foreign commit ... No push had happened at that point and no data was lost"
- kind: process
- artifacts: task/a8b-send-resend-ui, ~/Downloads/claude-code-repo/fhe-website-app, git worktree
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Two unrelated files from another session's in-progress work were swept up by the stash -u flag and had to be identified and excluded from the commit.
- quote: "Two unrelated files that were swept up by the stash's `-u` flag from that other session's in-progress work (`api/request-received.ts`, `api/support-received.ts`) were identified and excluded before committing"
- kind: process
- artifacts: api/request-received.ts, api/support-received.ts
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Deviation from the literal spec — the admin menu was placed in the executed-only "Manage" card rather than the named ContractSubheader, because that subheader is unmounted for executed documents.
- quote: "Deviation from the literal spec text, with reason: the spec says the surface is 'ContractPage.tsx subheader.' `ContractSubheader` ... is only rendered when `showDeck && id && !isExecuted` ... it is unmounted precisely when this button needs to exist."
- kind: correctness
- artifacts: ContractPage.tsx, ContractSubheader.tsx, SendCopiesMenu.tsx
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: DeliveryPanel.tsx was left unchanged because it is not part of ContractPage's surface (lives on a separate ops route), per the spec's conditional wording.
- quote: "`DeliveryPanel.tsx` — checked; it is not rendered inside `ContractPage.tsx` at all ... so per the spec's own phrasing no change was made to `DeliveryPanel.tsx`."
- kind: correctness
- artifacts: DeliveryPanel.tsx, DocumentViewerPage.tsx
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Company-inbox mirror notice deliberately skipped for targeted sends (not explicitly in spec) to avoid spam and extra delivery rows.
- quote: "the company-inbox mirror notice ... is skipped entirely for targeted sends: it is an execution-event notice, and firing it on every staff re-send would (a) be spam and (b) write extra `document_deliveries` rows"
- kind: correctness
- artifacts: api/deliver-documents.ts
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Endpoint recipient-filter verification was reasoned line-by-line only, not exercised against a deployed preview (no preview exists, no service-role key locally).
- quote: "Endpoint recipient-filter verification: reasoned line-by-line (not exercised against a preview) ... no deployed preview exists for this branch ... So a local invocation of the handler ... is not possible either"
- kind: not-verified
- artifacts: api/deliver-documents.ts, api/_lib/supabaseAdmin.ts
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: The write-side psql test (POST to endpoint to prove is_mirror row and untouched stamp) was NOT run; a manual test plan is documented instead.
- quote: "The write test (POST to the endpoint against a throwaway contact) was NOT run. ... I did not fabricate this result. No preview exists yet"
- kind: not-verified
- artifacts: api/deliver-documents.ts, document_deliveries, documents.executed_email_sent_at
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Lint shows 29 warnings vs CLAUDE.md's stated ~26 baseline; reconciled by re-running lint on clean main to confirm 29 is the real baseline.
- quote: "CLAUDE.md's stated baseline is '~26 pre-existing warnings'; 29 is close enough that I re-ran lint on a clean `origin/main` checkout ... 29 pre-existing warnings on main"
- kind: process
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: api/request-received.ts shows as modified in git status but was pre-existing uncommitted work, left untouched and excluded from the commit.
- quote: "`api/request-received.ts` shows as modified in `git status` but was not touched by this task — it was already modified, uncommitted, in the working tree before this session started ... left untouched and excluded"
- kind: process
- artifacts: api/request-received.ts
- decision-mention: none

## TASK-ACCTEVAL-REPORT.md

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U1 — Every member's real email and mobile number are readable without signing in, via the anon-granted member_directory view that bypasses RLS.
- quote: "U1 — Every member's real email address and mobile number are readable without signing in ... `anon` — the role an unauthenticated browser request executes as — holds `SELECT` on it. RLS on `contacts` and `profiles` is therefore never evaluated"
- kind: security
- artifacts: member_directory, contacts, profiles, profile-images bucket
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U2 — Four more anon-readable views share the same shape, including inbound_queue which carries staff_notes.
- quote: "U2 — Four more views have the same shape, including one carrying staff notes ... `inbound_queue` columns include `contact_email`, `contact_phone`, `notes`, **`staff_notes`**"
- kind: security
- artifacts: clients_overview, inbound_queue, memberships, service_credits, member_directory
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U3 — A member can repoint their own profiles.contact_id at another person's contact record (no column guard on contact_id), giving read/write on that contact.
- quote: "U3 — A member can repoint their own account at another person's contact record ... The only column guard is the trigger `profiles_role_guard_trg` ... and **not** `contact_id`."
- kind: security
- artifacts: profiles.contact_id, profiles_role_guard_trg, contacts_select, contacts_update_own, current_contact_id()
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U3 exploitability not proven end-to-end — no member-reachable read that discloses another person's contacts.id was found, but not exhaustively checked.
- quote: "I did **not** find a member-reachable read that discloses another person's `contacts.id` ... I did not attempt the write, and I did not exhaustively enumerate every table for a `contacts.id` disclosure. The structural gap is proven; end-to-end exploitability is not."
- kind: not-verified
- artifacts: contacts.id, document_parties_self_read, member_directory
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U4 — profiles_role_guard is BEFORE UPDATE only; the first insert of a profile row is unguarded, allowing role/is_admin/org_id to be set on insert. Two signed-in users have no profiles row today.
- quote: "U4 — `profiles_role_guard` is `BEFORE UPDATE` only; the first insert of a profile row is unguarded ... `authenticated` holds `INSERT` on `role`, `is_admin` and `org_id`"
- kind: security
- artifacts: profiles_role_guard_trg, profiles_insert_own, auth.users
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U5 — _ensure_client_account is anon-executable with no caller check (no is_admin/has_staff_access/auth.uid test); org taken from parameter, writes clients/contacts.
- quote: "U5 — `_ensure_client_account` is anon-executable with no caller check ... There is no `is_admin()`, `has_staff_access()` or `auth.uid()` test anywhere in it, and the org is taken from the `p_org` parameter rather than from the caller."
- kind: security
- artifacts: _ensure_client_account, clients, contacts, contact_required_documents
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: first_name/last_name has one-way contacts→profiles sync only, so the two copies diverge when profiles-only write paths (Account.tsx, admin/team pages) run — community and legal document print different names.
- quote: "There is no trigger in the other direction. ... After any of those, the two copies hold different values. ... The community and the legal document would then print different names for the same person."
- kind: data-integrity
- artifacts: contacts, profiles, sync_profile_name_from_contact_trg, member_directory, {{PARTY.FULL_NAME}}
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: email exists in three places (auth.users, profiles, contacts) and no path reconciles all three; after a login-email change contacts.email and community_email keep the old address and member_directory publishes them.
- quote: "`email` exists in three places and no path reconciles all three ... After a login-email change, `contacts.email` and `contacts.community_email` still hold the previous address, and `member_directory` publishes both of them."
- kind: data-integrity
- artifacts: auth.users.email, profiles.email, contacts.email, api/email-change-complete.ts, member_directory
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: adminUpdateProfile exposes profiles.email as free-text, and email-change-complete authenticates the password proof against that editable value.
- quote: "`email-change-complete.ts` proves the password by calling `signInWithPassword({ email: profile.email, password })` — i.e. the value an admin can edit is the address the proof authenticates against."
- kind: security
- artifacts: adminUpdateProfile, api/email-change-complete.ts, profiles.email
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: contacts.phone write seeds four community channels (mobile_call/text, whatsapp_call/text) plus community_email via trigger; two are WhatsApp channels from an ordinary phone with no WhatsApp check — and they are published by member_directory though phone itself is not.
- quote: "one write, five copies ... Two of these five channels are WhatsApp channels seeded from an ordinary phone number, with no check that the number is on WhatsApp. ... `contacts.phone` itself is indeed absent from `member_directory`; the four values the same write creates are not."
- kind: data-integrity
- artifacts: contacts_a_seed_community_channels, member_directory, AccountInfoCard.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two onboarding write paths (sign_release, update_my_onboarding_profile) use opposite precedence for the same fields — corrections saved through onboarding are silently discarded through release.
- quote: "Two write paths for the same onboarding fields, with opposite precedence ... The same person entering the same corrected emergency-contact phone gets it saved through `/app/onboarding` and silently discarded through `/release`."
- kind: data-integrity
- artifacts: sign_release, update_my_onboarding_profile, contacts
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: PreferencesCard states three notification behaviors (discussion replies, event reminders, new member welcomes) for which no producer exists — no trigger/function fires them.
- quote: "`PreferencesCard` states three things that no producer exists for ... It replaced three non-functional controls with three sentences asserting behaviour that does not occur."
- kind: correctness
- artifacts: PreferencesCard.tsx, thread_posts, events, members_post_join_event, calendar_reminder_sweep
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: "Saved items" can never contain anything — SEED_ENABLED=false, my_nav_presence returns saved=false as a literal, and no bookmark/save control exists anywhere.
- quote: "'Saved items' can never contain anything ... There is no bookmark or save control anywhere in `src/` ... The row exists on the Account hub and the nav link exists ... gated by a flag hardcoded to false."
- kind: correctness
- artifacts: seed.ts, SavedPanel, my_nav_presence, PRESENCE_LINKS
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two-factor authentication is unreachable for any member — TwoFactorSettings renders only on /account which immediately redirects members to /app; MFA is still enforced at sign-in with no surface to enrol/unenrol.
- quote: "Two-factor authentication is unreachable for any member ... there is simply no reachable surface to enrol or unenrol one."
- kind: correctness
- artifacts: TwoFactorSettings, Account.tsx, LoginSecurityCard, Login.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: /account is the default post-login/OAuth/reset destination yet immediately redirects members, so members pass through a redirecting page; OrderDetail "Back to your account" points there too.
- quote: "`/account` is also the default post-login destination ... so members pass through a page that immediately redirects them."
- kind: correctness
- artifacts: Login.tsx, Account.tsx, OrderDetail.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Legacy directory columns hide_email/hide_mobile/hide_whatsapp have zero references (no control writes them) yet member_directory gates on them and they ship on the wire in every directory response.
- quote: "Legacy directory columns with no control and an active publisher ... those three columns are on the wire in every directory response delivered to every member's browser"
- kind: security
- artifacts: hide_email, hide_mobile, hide_whatsapp, member_directory, fetchMemberDirectory
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: {{CLIENT.JUMP_LIMITATIONS}} merges into nothing — editable in staff dossier, declared in template_tokens, but present in 0 template bodies and 0 clause defs; onboarding never collects it.
- quote: "`{{CLIENT.JUMP_LIMITATIONS}}` merges into nothing ... present in 0 `contract_templates.body` values and 0 `contract_clause_defs.body` values."
- kind: correctness
- artifacts: jump_limitations, template_tokens, ContactDossierModal.tsx, update_my_onboarding_profile
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: name_needs_confirmation can never be raised again — only the one-time 2026-07-30 backfill ever set it true; no live path re-arms it when a name conflict arises after that date.
- quote: "`name_needs_confirmation` can never be raised again ... no live path re-arms it when a name conflict arises after 2026-07-30."
- kind: correctness
- artifacts: name_needs_confirmation, confirm_my_legal_name, my_name_confirmation_state, ConfirmNameModal
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: ?section=profile and ?section=documents deep links have no link anywhere in the codebase.
- quote: "`?section=profile` deep link has no link ... Nothing in the codebase links to `?section=profile` or `?section=documents`."
- kind: correctness
- artifacts: AccountHub, PRESENCE_LINKS
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two writes on the member's own account (updateMyContactPhone, upsertMyProfile) do not use assertWrote/.select, contrary to CLAUDE.md's stated rule, so they do not prove they landed.
- quote: "Two writes on the member's own account do not prove they landed ... `updateMyContactPhone` ... with no `.select()` and no `assertWrote`. `upsertMyProfile` ... with no `.select()` and no `assertWrote`."
- kind: defect
- artifacts: updateMyContactPhone (lib/api.ts:451), upsertMyProfile (lib/api.ts:421), ProfileCard, Account.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: "Close without saving" does not discard contact fields — ProfileCard writes one DB write per keystroke via set(), errors are swallowed by .catch() with no retry, and Close only sets editing false.
- quote: "'Close without saving' does not discard the contact fields ... That is one database write per keystroke, committed immediately. ... The `.catch()` discards the error and leaves the new value on screen; there is no retry mechanism"
- kind: defect
- artifacts: ProfileCard, saveMyContactPrefs
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: A member can, through the REST API only (no screen), read and write their own notes, tags, contact_type, is_company, guardian_contact_id, date_of_birth (drives C10 minor rules), emergency contacts, etc. — contacts_update_own has no column predicate.
- quote: "through the REST API and not through any screen, a member may read and write their own: `notes` ... `date_of_birth` (which drives the C10 minor rules), all six emergency-contact fields, `deleted_at`, `display_code`, and the four riding-background fields."
- kind: security
- artifacts: contacts_update_own, contacts_select, contacts, date_of_birth
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Emergency contacts are presented as immutable ("not editable") but are writable by staff, by member onboarding, and by the member's own API session.
- quote: "Emergency contacts are presented as immutable and are not ... What the card says is true of *that card*, not of the field."
- kind: correctness
- artifacts: AccountInfoCard, update_contact_record, update_my_onboarding_profile
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Fields the member fills that nothing consumes — staff_preferred_contact, zelle_phone, zelle_email, correspondence_email, mobile_number, texts_phone are read by no email sender, receipt, reconciliation, or token, yet the card presents them as consumed.
- quote: "Fields the member fills in that nothing consumes ... No email sender, receipt, payment-reconciliation path or document token reads them. `api/zelle-reconcile.ts` does not reference `zelle_phone` or `zelle_email`"
- kind: correctness
- artifacts: AccountInfoCard.tsx, lib/contact.ts, api/zelle-reconcile.ts
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two SECURITY DEFINER RPCs (contact_dossier, update_contact_record) grant MANAGER/EMPLOYEE person-record access the table RLS policies deny them; dormant today because no MANAGER/EMPLOYEE account exists.
- quote: "The two `SECURITY DEFINER` RPCs therefore grant instructor/employee roles a level of access to person records that the table policies deny them. No account in production currently holds `MANAGER` or `EMPLOYEE`"
- kind: security
- artifacts: contact_dossier, update_contact_record, contacts_select, has_staff_access
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: contact_dossier returns the entire contacts row (to_jsonb) including columns on no screen (zelle_phone, zelle_email, all hide_* flags, community channels) delivered in the payload.
- quote: "`contact_dossier` returns `to_jsonb(c)`, the entire row. The dossier UI renders about 25 of the 66 columns; the remaining columns ... are in the response payload but on no screen."
- kind: security
- artifacts: contact_dossier, ContactDossierModal
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: 9.1 — Three profiles rows (zz-test seller/buyer/cobuyer) violate two validated, enabled foreign keys; auth.users has 9 rows but profiles has 10. Cause could not be determined.
- quote: "Three `profiles` rows violate two validated foreign keys ... Both constraints exist, are validated, and their RI triggers are enabled ... I could not determine how the rows came to violate the constraints; the state is verified, the cause is not."
- kind: data-integrity
- artifacts: profiles, profiles_contact_id_fkey, profiles_user_id_fkey, auth.users
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: 9.2 — The platform-owner row admin@cactai.io holds a tenant contact (CACTAI INC.) despite ensure_contact_for_profile explicitly denying that user id, so the link predates or bypasses the guard; org_id NULL means org boundary matches nothing.
- quote: "The platform-owner row holds a tenant contact ... so the link predates or bypasses that guard. Because `org_id` is NULL, `current_org()` returns NULL for this account and `contacts_org_boundary` ... matches nothing."
- kind: data-integrity
- artifacts: admin@cactai.io, ensure_contact_for_profile, contacts_org_boundary
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: CLAUDE.md D9 describes profiles.payment_reminders as vestigial, but the column does not exist.
- quote: "`profiles.payment_reminders` — described in `CLAUDE.md` D9 as 'a vestigial column with no reader' — **does not exist**"
- kind: correctness
- artifacts: profiles
- decision-mention: D9

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Could not confirm the anon-readable views are reachable over HTTPS in production — proved the anon role reads at the DB but could not issue the HTTP request (placeholder URL/key locally); PostgREST reachability is an inference.
- quote: "Whether the anon-readable views are reachable over HTTPS in production. I proved the `anon` role reads all six `member_directory` rows at the database. I could not issue the HTTP request"
- kind: not-verified
- artifacts: member_directory, PostgREST
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Could not determine whether the 13 accountless contacts' hide_* flags were set deliberately — exact correlation reads as a backfill but no migration line found.
- quote: "Whether the 13 accountless contacts' `hide_*` flags were set deliberately. The correlation with 'has no account' is exact, which reads as a backfill, but I found no migration line that sets them"
- kind: not-verified
- artifacts: contacts hide_* flags
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Browser behaviour was not verified — all click-depth figures counted from routing/component source, app not run.
- quote: "Browser behaviour. Everything in §7 was counted from the routing and component source. I did not run the app or click through it."
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: None of the IDENTITY_MODEL_DESIGN phased build (P1–P5) exists yet — is_tenant absent, contact_affiliations absent, and the index the design marks DROPPED still present.
- quote: "State of the phased build — none of P1–P5 exists yet. ... `is_tenant` is absent, `contact_affiliations` is absent, and the `one_company_contact_per_org` index the design marks as DROPPED is still present."
- kind: inventory
- artifacts: is_tenant, contact_affiliations, one_company_contact_per_org
- decision-mention: none

## TASK-ADDNEW-REPORT.md

### ITEM
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: Substituted the lucide Plus glyph for DocumentsQueuePage's literal "+" text character; flagged in case the owner meant the literal glyph specifically.
- quote: "I did **not** copy `DocumentsQueuePage.tsx:345`'s exact markup (a literal `+` text character, no SVG). I kept the `lucide-react` `Plus` glyph ... **Flagging this substitution explicitly** in case the owner meant the literal glyph specifically."
- kind: cosmetic
- artifacts: PageHeader.tsx, DocumentsQueuePage.tsx
- decision-mention: A6 (supersedes)

### ITEM
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: PageCreateButton question left to the owner — three page-level controls (Messages, Home, MyPosts) arguably should read "Add New" but none use PageHeader/PageLayout; not acted on.
- quote: "PageCreateButton — reported, not changed ... I did not act on any of these — the task is explicit that this is the owner's call, not mine ... Flagging the design question rather than picking one."
- kind: blocked-on-owner
- artifacts: PageCreateButton.tsx, StableSection.tsx, CalendarPage.tsx, Messages.tsx, Home.tsx, MyPosts.tsx
- decision-mention: none

### ITEM
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: Overflow at the narrowest viewport for "Horse records" could not be ruled out — a two-line wrap (not horizontal scroll) is possible at 320-375px on that page; needs a manual look.
- quote: "I can't rule out a wrap to two lines on the *narrowest* real devices for that specific page name — but a wrap, not a horizontal scrollbar ... **This is the one page worth a manual look**"
- kind: not-verified
- artifacts: HorseRecordsPage.tsx, PageHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: No browser verification — no Supabase creds in worktree; all six affected pages proven only by diff/typecheck/lint/CSS, someone with a browser should check aria-labels and widths.
- quote: "NOT VERIFIED — no browser session available ... The following is proven by diff, typecheck, lint, and built-CSS inspection only. **Someone with a browser should look at:**"
- kind: not-verified
- artifacts: CareHome.tsx, Admin.tsx, DealsPage.tsx, HorseRecordsPage.tsx, ContactsPage.tsx, DocumentsQueuePage.tsx
- decision-mention: none

## TASK-ADMINSWEEP-PHASE2.md

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: M-6 reversed as directed — nothing was retired, gated or deleted; removal candidates X-1…X-4 remain untouched and unruled.
- quote: "M-6 was reversed as directed: **nothing was retired, gated or deleted.** The removal candidates X-1 … X-4 are untouched and remain unruled."
- kind: blocked-on-owner
- artifacts: X-1, X-2, X-3, X-4
- decision-mention: M-6

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-1 — OpsDashboard's docstring is stale: promises four KPI tiles but code renders two, across a still-four-column grid.
- quote: "D-1 · The file's own docstring is stale. It describes 'Four RLS-scoped KPI tiles ...' The code has two. Engagements and charges were removed and the comment was not."
- kind: correctness
- artifacts: OpsDashboard
- decision-mention: D-1

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-2 — OpsDashboard's intake number (12, counts new+contacted) disagrees with the Dashboard's (7, new only); two staff landing surfaces state the same concept differently, never reconciled.
- quote: "D-2 · Its intake number disagrees with the Dashboard's. ... Two staff landing surfaces state the same concept as 12 and 7. Neither is wrong on its own terms; they were never reconciled."
- kind: correctness
- artifacts: countPendingIntake, useOpenLeads, OpsDashboard, DashboardPanel, InstructorHome
- decision-mention: D-2

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-3 — InstructorHome's status chip is keyed lowercase but statuses are uppercased, so the lookup never matches and every row falls through to "Scheduled"; a cancelled lesson renders as Scheduled.
- quote: "D-3 · The status chip always says 'Scheduled', whatever the real status is. ... The lookup therefore **never matches** ... A cancelled lesson renders as 'Scheduled'. The chip is decorative."
- kind: defect
- artifacts: InstructorHome, lessonSessionFromBooking, STATUS_CHIP
- decision-mention: D-3

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-4 — InstructorHome renders availability slots as lessons (listLessonSessions doesn't filter status: 318 rows, 279 available), overstating a trainer's day ~5x, all chipped "Scheduled".
- quote: "D-4 · Availability slots render as lessons. ... the page is not merely empty-looking, it is **wrong**, and wrong in the flattering direction."
- kind: defect
- artifacts: InstructorHome, listLessonSessions
- decision-mention: D-4

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-5 — Every InstructorHome row is named "Client" as a literal; the query selects client_id with no join so the name isn't in the payload.
- quote: "D-5 · Every row is named 'Client'. `toRow` sets `who: 'Client'` as a literal ... Fixing this needs a join or a second lookup, not a one-line change."
- kind: defect
- artifacts: InstructorHome, toRow, LESSON_BOOKING_COLS
- decision-mention: D-5

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-6 — InstructorHome's "Clients" tile points at retired route /app/ops/contacts which redirects to /app/admin.
- quote: "D-6 · Its 'Clients' tile points at a retired route. It links `/app/ops/contacts`, which redirects to `/app/admin` (Phase 1 X-1). Works, but via a redirect."
- kind: defect
- artifacts: InstructorHome, /app/ops/contacts
- decision-mention: D-6

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: Recommendation (not implemented): OpsDashboard should not replace DashboardPanel and InstructorHome should not ship as-is; the call is the owner's, downstream of LEADCLEAN.
- quote: "`OpsDashboard` should not replace `DashboardPanel`, and `InstructorHome` should not ship as-is. ... **Not implemented, per the direction.** The call is the owner's and it is downstream of LEADCLEAN landing."
- kind: blocked-on-owner
- artifacts: OpsDashboard, DashboardPanel, InstructorHome
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: The nav-entry diff for /app/ops was specified but NOT applied (AppLayout.tsx is NAVMOTION's); flagged with a sequencing warning that it duplicates what LEADCLEAN is removing.
- quote: "The nav entry — exact diff, NOT applied ... this is flagged rather than decided: **apply it for the evaluation window, and expect to remove it in the same motion that resolves LEADCLEAN.**"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: App.tsx is a shared route-registration file not claimed by any live branch; flagged since route registration is a shared surface.
- quote: "`App.tsx` is not claimed by any live branch ... Flagged here anyway since route registration is a shared file."
- kind: process
- artifacts: App.tsx
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: Browser render of the preview route is NOT VERIFIED — no staff session; proven only by 4 passing tests.
- quote: "Browser render is still NOT VERIFIED — see the checklist at the end."
- kind: not-verified
- artifacts: InstructorHomePreview.tsx, /app/ops/preview/instructor-home
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: Pre-existing test failure in pluspass_create_controls.test.tsx reproduces on clean main; unrelated to this work.
- quote: "The pre-existing failure in `test/ui/pluspass_create_controls.test.tsx` (1 failed / 10 passed) reproduces identically on clean `origin/main` and is unrelated to this work."
- kind: process
- artifacts: test/ui/pluspass_create_controls.test.tsx
- decision-mention: none

## TASK-BP410-REPORT.md

### ITEM
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: Real-device rendering (iOS Safari specifically, where the original jagged-outline defect appeared) was not verified; everything checked in Chrome only.
- quote: "Not verified: real-device rendering (iOS Safari specifically, where the original jagged-outline defect actually showed up before). Everything above was checked in Chrome only"
- kind: not-verified
- artifacts: CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: Out-of-scope, not fixed — 500px viewport also overflows (scrollWidth 582 vs 500), pre-existing on origin/main, unrelated to the ≤410 budget.
- quote: "Out-of-scope observation (not fixed) ... **500px also overflows** ... flagging it since I noticed it, not fixing it since it's out of this task's scope"
- kind: defect
- artifacts: CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: The exact half-pixel rounding for .cs-fh (16.5px) was assumed from the task doc's worked example, not eyeballed against a mockup (no mockup exists for the compact marks).
- quote: "Assumed: the exact half-pixel rounding for `.cs-fh` (16.5px) follows the task doc's own worked example ... rather than a fresh eyeball pass against a mockup — there is no mockup for the compact marks to eyeball against"
- kind: not-verified
- artifacts: header-cardstock.css .cs-fh
- decision-mention: none

### ITEM
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: The live drawer tab and AppLayout were not mounted/screenshotted (out of scope); confirmed only by computed style that dependent variables resolve identically.
- quote: "I did not mount `AppLayout` (out of scope ...) so I couldn't screenshot the live drawer tab; instead I confirmed by computed style that the variable it depends on ... resolves identically before and after."
- kind: not-verified
- artifacts: AppLayout, --cs-hdr-h, --cs-tab-right
- decision-mention: none

## TASK-COMPANYFIX-REPORT.md

### ITEM
- report: TASK-COMPANYFIX-REPORT.md
- date: 2026-08-05
- item: The specified adversarial proof (insert a second is_company contact in the same org) cannot be executed — blocked by the one_company_contact_per_org partial unique index; not run as specified.
- quote: "Proof 2 — adversarial rolled-back test: BLOCKED BY A REAL CONSTRAINT, not run as specified ... This cannot be executed, in one transaction or any number of retries, because `contacts` already carries: `one_company_contact_per_org`"
- kind: blocked-on-owner
- artifacts: one_company_contact_per_org, contacts, company_contact_id()
- decision-mention: none

### ITEM
- report: TASK-COMPANYFIX-REPORT.md
- date: 2026-08-05
- item: The task doc's stated threat model doesn't hold — the old LIMIT 1 was never at risk of binding to the wrong company within one org; the change is legitimate hardening but does not fix a live bug.
- quote: "So: `company_contact_id()`'s old `LIMIT 1` was never actually at risk of binding to the wrong company within one org ... this task's schema/backfill/function change is a legitimate hardening ... but it does not fix a live bug, and the specified adversarial proof cannot be performed against the current schema."
- kind: correctness
- artifacts: company_contact_id()
- decision-mention: none

### ITEM
- report: TASK-COMPANYFIX-REPORT.md
- date: 2026-08-05
- item: Recommendation flagged back to the task author — the adversarial proof needs re-scoping to two separate orgs since the single-org version is not executable against the current schema.
- quote: "flag back to the task author that the adversarial proof needs re-scoping (e.g. two separate orgs ...) since the single-org version in the locked design is not executable against the schema as it stands today."
- kind: process
- artifacts: company_contact_id()
- decision-mention: none

## TASK-DOCQUEUE-REPORT.md

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: Correction to the task's diagnosis — VOID unreachability was caused by the missing filter option, not by api-client.ts's .neq('status','VOID') (which is a different function on a different page); api-client.ts left untouched.
- quote: "One correction to the task's diagnosis ... That line is real, but it's in `listMySignableDocuments()` — a different function, on a different data seam ... I left `api-client.ts` untouched"
- kind: correctness
- artifacts: api-client.ts, listMySignableDocuments, listDocuments, DocumentQueueTable.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: HORSE_BILL_OF_SALE has no picker card (diverged from "6→6 cards") because there is no standalone entry point to author one; needs a new RPC or an explicit sale-only decision. Left for the owner.
- quote: "HORSE_BILL_OF_SALE has no card, and this is the one place I diverged from '6 → 6 cards.' ... **If a standalone bill-of-sale start is wanted**, it needs either a new RPC ... or an explicit decision that it stays sale-only. Left for the owner — not built here."
- kind: blocked-on-owner
- artifacts: HORSE_BILL_OF_SALE, startBillOfSale, CONTRACT_KIND_DESTINATION, DocumentQueuePicker.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: The default view changed from all 74 documents to the 5 awaiting signature (Needs attention preset default) — a real behavior change, flagged explicitly.
- quote: "**This changes the page's default view** from showing all 74 documents to showing the 5 awaiting signature — flagging this explicitly since it's a real behavior change, not just a rendering fix."
- kind: correctness
- artifacts: DocumentsQueuePage.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: "By person" preset deviates from v1's deep-link-into-dossier spec — filters the same list in place instead; flagged for the owner to veto if the deep-link was load-bearing.
- quote: "Deviates from v1's literal 'deep-links into the existing dossier Documents tab ...' I filter the SAME list in place instead ... Flagging the deviation for the owner to veto if the deep-link was actually load-bearing."
- kind: blocked-on-owner
- artifacts: DocumentsQueuePage.tsx, ContactDossierModal, Admin.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: Several preset views are partially unbuilt — Needs attention lacks assigned-but-never-generated obligations and expires_on items (needs uploads build J1b); Signed library lacks template-category grouping; By horse lacks health-due-date surfacing.
- quote: "Not built (what it needs) ... Assigned-but-never-generated obligations ... and `expires_on`-based items — neither exists yet; the second needs the uploads build (J1b)."
- kind: correctness
- artifacts: DocumentsQueuePage.tsx, contact_required_documents, horse_health_events
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: The Templates tab from design-doc v2 (full version-control workflow) was not built or attempted — a separate much larger spec.
- quote: "The **Templates tab** from design-doc v2 §4–5 ... is a separate, much larger spec that this task never asked for — not built, not attempted."
- kind: correctness
- artifacts: DocumentsQueuePage.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: RLS observation found not touched — documents_select/contacts_select/horses_select gate org-wide read behind is_admin(), but frontend isStaff includes MANAGER/EMPLOYEE, so those roles would see a partial queue; dormant today (no such accounts).
- quote: "One RLS observation — found, not touched ... a MANAGER/EMPLOYEE user hitting this page would, under current RLS, see only documents/contacts/horses they own ... **This is pre-existing and unchanged by this task**"
- kind: security
- artifacts: documents_select, contacts_select, horses_select, listDocuments, ProtectedRoute
- decision-mention: none

### ITEM
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: Render NOT VERIFIED — no staff browser session; everything proved at query/type level only.
- quote: "**Render: NOT VERIFIED.** No staff browser session exists in this environment. Everything above is proved at the query/type level, not by clicking through the UI."
- kind: not-verified
- artifacts: DocumentsQueuePage.tsx, DocumentQueueTable.tsx
- decision-mention: none

## TASK-DOCVIS-REPORT.md

### ITEM
- report: TASK-DOCVIS-REPORT.md
- date: 2026-08-04
- item: caller_owns_document was deliberately NOT widened because a write path (signatures_insert_self) depends on it; only documents_select got a new OR-arm.
- quote: "`signatures_insert_self` is a **WRITE** path gated by `caller_owns_document`. ... because a write path depends on the helper, **the helper itself is not widened** — only `documents_select` gets a new OR-arm."
- kind: correctness
- artifacts: caller_owns_document, signatures_insert_self, documents_select, document_deliveries_select, signatures_select
- decision-mention: none

### ITEM
- report: TASK-DOCVIS-REPORT.md
- date: 2026-08-04
- item: my_documents()'s "pending" branch was widened alongside "executed" as a reading of the design's general wording — a judgment call beyond the literal executed-only bug report, called out explicitly.
- quote: "`my_documents()`'s 'pending' branch was widened alongside 'executed' as a reading of the locked design's general wording; this is a judgment call beyond the literal bug report ... and is called out here rather than silently bundled in."
- kind: correctness
- artifacts: my_documents()
- decision-mention: none

### ITEM
- report: TASK-DOCVIS-REPORT.md
- date: 2026-08-04
- item: BUILD_TRACKER A17/A18/A19 set to PARTIAL — server-side fix verified, browser render of the Documents page not confirmed (re-verify pass's call); LESSEE company-party side remains BLOCKED.
- quote: "A17 changed from **FAIL** to **PARTIAL — server-side fix verified, browser pending** ... LESSEE side (company party) remains **BLOCKED** on both, unrelated to this task — see A7."
- kind: not-verified
- artifacts: BUILD_TRACKER.md, my_documents(), documents_select
- decision-mention: none

## TASK-NOGUARD3-REPORT.md

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: feed_post_delete / feed_post_update let any signed-in account delete or rewrite the 9 live posts with NULL author_id (NULL propagation through a nullable stored column) — REAL, exploitable; FIXED in Phase A.
- quote: "**Any signed-in account could delete or rewrite those 9 posts.** ... REAL — exploitable, 9 live rows. FIXED in Phase A."
- kind: security
- artifacts: feed_post_delete, feed_post_update, feed_posts.author_id
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Every fresh signup begins contactless (auth.uid non-NULL, current_contact_id/current_org NULL) because nothing provisions a profile at signup (no trigger on auth.users); two such real users exist.
- quote: "**Nothing provisions a profile at signup.** ... **every fresh signup begins in exactly this state** ... Two of ten `auth.users` have no `profiles` row"
- kind: security
- artifacts: current_contact_id, current_org, auth.users, profiles
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The central negative result — a blind coalesce sweep across the 48 house-guard functions would lock out the org-less platform-operator account (admin@cactai.io); that is why Phase A is two functions, not fifty.
- quote: "**The NULL propagation is not an accident in most places — it is what makes the org-less SUPER_ADMIN account work.** A blind `coalesce(…, false)` sweep across the 48 functions ... would have locked `admin@cactai.io` out of the entire contract surface."
- kind: correctness
- artifacts: admin@cactai.io, current_org(), has_staff_access()
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: NOGUARD2's applied caller_is_document_party_or_staff guard is already denying the platform operator today (not "inert" as previously judged) on every document they're not a party to.
- quote: "So NOGUARD2's applied guard **denies the platform operator today** ... NOGUARD2 flagged this as residual risk ... and judged it 'inert today' ... **It is not inert; it is live.**"
- kind: defect
- artifacts: caller_is_document_party_or_staff, fill_party_fields_from_contacts, admin@cactai.io
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: B4 — a policy decision the owner must make (operator org-scoped / platform-role / leave it) that sequences before any coalesce sweep; recommended Option 1 but not taken because it's a real-data change.
- quote: "The decision this forces — B4, for the owner ... I recommend **Option 1**, and I did not take it, because it is a data change to a real row and the decision is the owner's."
- kind: blocked-on-owner
- artifacts: profiles.org_id, admin@cactai.io, is_super_admin()
- decision-mention: B4

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The vulnerable house-guard idiom is still being written — three new SECURITY DEFINER functions (can_cleanup_document etc.) landed mid-session in the same NULL class; the class regenerates faster than per-function auditing.
- quote: "**A brand-new, well-written, security-conscious function lands in the same NULL class, because the idiom is the house style.** ... this class regenerates faster than it can be audited one function at a time."
- kind: security
- artifacts: can_cleanup_document, cleanup_document, document_integrity
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Two inverted guards (remerge_contract_from_fields, invite_contract_counterparty) with the auth.uid() IS NOT NULL AND NOT(...) shape — not currently exploitable, defensively rewritten in Phase B.
- quote: "**Neither of the two is currently exploitable, and I would rather say so than dress it up** ... The change is defensive — a guard that cannot fire for the caller it names stops anyone from looking again."
- kind: security
- artifacts: remerge_contract_from_fields, invite_contract_counterparty
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: _provision_purchase_for_offerings was granted to anon/authenticated and lets any free signup mint a purchase marked paid (caller-supplied p_mark_paid); revoked in Phase B.
- quote: "**The highest-consequence item is `_provision_purchase_for_offerings`**: it creates a purchase for a caller-supplied contact/client/org with a caller-supplied `p_mark_paid`, so any free signup could mint a purchase marked **paid**."
- kind: security
- artifacts: _provision_purchase_for_offerings
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: generate_document is a SECURITY INVOKER function that creates documents and is granted to anon — left alone as a larger decision than this migration should make; deserves its own look.
- quote: "**The more interesting finding is the one I did not act on:** `generate_document` is a `SECURITY INVOKER` function that creates documents and is granted to `anon`. It is left alone because changing it is a larger decision than this migration should make."
- kind: security
- artifacts: generate_document, documents
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The document/deal/horse/member readers reachable by id (group d/e, several write) are genuine info leaks left for a Phase C — deferred because the obvious guard denies the platform operator until B4 is settled.
- quote: "These are genuine information leaks and several write. **They are not in Phase B because the obvious guard ... denies the platform operator ... B4 first, then this group as a coherent Phase C.**"
- kind: security
- artifacts: contract_notes_for_document, contract_comments_list, document_signature_state, deal_completion_state, member_horses, complete_deal
- decision-mention: B4

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: feed_post_create is safe only by accident — a NULL p_as_company skips the guard and is stopped only by a NOT NULL column constraint; flagged, not changed.
- quote: "`feed_post_create` | Safe in effect, **by accident** ... NOGUARD1's 'safe only because of a column constraint' class. Flagged, not changed."
- kind: security
- artifacts: feed_post_create, feed_posts.as_company
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The classification of all 371 functions is an evaluation of guard text, not execution; the "86 no identity check" is an over-count of real exposure by an unknown amount (a trigger/CHECK/FK could stop an unguarded function).
- quote: "**The classification of all 371 is an evaluation of guard *text*, not an execution.** ... **My 86 'no identity check' is therefore an over-count of the real exposure, in an unknown amount.**"
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: No unguarded function was executed and no PostgREST HTTP probe was made — "no effective guard" is a claim about the code, not a demonstrated exploit.
- quote: "**I did not execute any of the unguarded functions.** 'No effective guard' is a claim about the code and the predicate, not a demonstration of a completed exploit. ... **No PostgREST HTTP probe.**"
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The 23 Phase B revokes were not exercised through every real in-database caller (mechanism re-demonstrated but individual chains not run to avoid mutating real rows).
- quote: "**The 23 Phase B revokes were not exercised through every real in-database caller.** ... the individual chains were not run, because each creates or mutates real contract, purchase or document rows."
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The definer-function snapshot moved during the session (442→445, 371→374); classification is of the 371 while Phase B arithmetic is against the live number.
- quote: "**The snapshot moved under me.** `definer_total` 442 → 445 and `auth_callable` 371 → 374 during this session. ... NOGUARD1's caveats #8 and #9 are not theoretical — they bit twice in one session."
- kind: process
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Phase B was held as dry-run-only pending the owner decision, then applied later by the orchestrator; the delay is called out as an orchestrator failure (threads set to stop-for-review, loop not closed).
- quote: "**Why this sat unapplied:** the orchestrator sets threads to stop-for-review and had not been closing the loop. That is the mechanism behind work being specified and never shipping, and it is an orchestrator failure rather than a thread failure."
- kind: process
- artifacts: 20260811T0200, 20260811T0300, 20260811T0400
- decision-mention: D1a

### ITEM
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Correction to NOGUARD1 — it lists ContractPage.tsx as a caller of document_changes_frozen, but that is a comment, not a call.
- quote: "**Correction to NOGUARD1:** it lists `src/pages/app/ContractPage.tsx` as a caller of `document_changes_frozen`. That is a comment, not a call."
- kind: correctness
- artifacts: document_changes_frozen, ContractPage.tsx
- decision-mention: none

## TASK-ONEAUTHOR-REPORT.md

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The four lease templates (V2/FULL/SIMPLE/STANDARD) are byte-for-byte identical redundant copies created for a divergence that hasn't happened; every lease content change is a 4x write. Nothing deleted; owner decision on which of three options.
- quote: "**They are three redundant copies, created for a divergence that has not happened yet. Nothing was deleted, as instructed.** ... **The decision is the owner's.** Three options, none taken here"
- kind: blocked-on-owner
- artifacts: HORSE_LEASE_V2, HORSE_LEASE_FULL, HORSE_LEASE_SIMPLE, HORSE_LEASE_STANDARD, NewContractPage.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The lease-version picker shows five options that all produce the identical document — a confusing surface today that worsens the moment one fork diverges.
- quote: "Reading it, a staff member is asked to choose between 'Horse Lease Agreement', '— Standard', '— Comprehensive' and '— Simple' that all produce the identical document. That is a confusing surface today"
- kind: correctness
- artifacts: NewContractPage.tsx, listLeaseTemplates()
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Found not fixed — FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are active=true, selectable, with body='' and zero clause defs, so a document generated from either would have no text.
- quote: "**Two active templates compose an empty document.** `FACILITY_LICENSE` and `INDEPENDENT_CONTRACTOR` are `active = true`, selectable, and carry **`body = ''` and zero clause defs**."
- kind: defect
- artifacts: FACILITY_LICENSE, INDEPENDENT_CONTRACTOR, FlatDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Found not fixed — listContractTemplates() (src/lib/api.ts:1093) has no callers; dead read path, not deleted.
- quote: "**`listContractTemplates()` (`src/lib/api.ts:1093`) has no callers.** The only template picker in the app uses `listLeaseTemplates()`. Dead read path; not deleted."
- kind: inventory
- artifacts: listContractTemplates() (src/lib/api.ts:1093)
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Found not fixed — the ops document viewer's SigningPanel presents a sign box for every unsigned party but record_signature() admits staff only for the org's own company contact, so it's an affordance that fails on click.
- quote: "**The ops document viewer offers signing the server refuses.** ... the ops viewer was never updated to match. **This is an affordance that fails on click**"
- kind: defect
- artifacts: SigningPanel, record_signature(), /app/ops/documents/:id, ContractPage
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Routing deliberately left alone — flat documents reach the one authoring page only by direct URL; flipping DocumentQueueTable.tsx:50 would route the whole estate but the ops viewer carries DeliveryPanel (MAIL/PORTAL/DOWNLOAD channels) that ContractPage lacks. Owner's call.
- quote: "**Routing was deliberately left alone — the one line that finishes the convergence is the owner's call.** ... **I did not flip it**, because the ops viewer carries one capability `ContractPage` does not: `DeliveryPanel`"
- kind: blocked-on-owner
- artifacts: DocumentQueueTable.tsx, DocumentViewerPage, DeliveryPanel, ContractPage
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The inline body-preview block was retired behind INLINE_BODY_PREVIEW_RETIRED=true (not deleted) rather than removed.
- quote: "It is retired behind `INLINE_BODY_PREVIEW_RETIRED = true` (the `CONTACTS_PAGE_RETIRED` pattern), not deleted."
- kind: inventory
- artifacts: ContractPage.tsx, INLINE_BODY_PREVIEW_RETIRED
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The rendered page is NOT VERIFIED — no staff browser session; everything proved against SQL and a production build only.
- quote: "**The rendered page is NOT VERIFIED.** No staff browser session exists. Everything above is proved against SQL and a clean production bundle build."
- kind: not-verified
- artifacts: ContractPage.tsx, FlatDocument.tsx, ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: FLAT→CLAUSE conversion for 12 flat templates was reported not started (per task); estimated ~3-5 threads, sequenced by value; the four negotiated commercial agreements recommended first.
- quote: "FLAT → CLAUSE CONVERSION — what it would involve (reported, not started) ... **Roughly 3–5 threads**, and it should be sequenced by value, not by size"
- kind: correctness
- artifacts: HORSE_SEARCH_RETAINER, HORSE_TRANSACTION_REP, INDEPENDENT_CONTRACTOR, FACILITY_LICENSE
- decision-mention: none

### ITEM
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Contract/document DB suite shows 9 failed / 2 passed, byte-identical on origin/main (pre-existing).
- quote: "contract/document DB suite (11 files) | 9 failed / 2 passed — **byte-identical on `origin/main`**, pre-existing"
- kind: process
- artifacts: none
- decision-mention: none

## TASK-ONEHEADER-REPORT.md

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: "Nav resize — the drawer's dimensions, per the owner" was NOT built because the dimensions are recorded nowhere; drawer left at w-72 max-w-[85vw].
- quote: "**'Nav resize — the drawer's dimensions, per the owner' (§5).** The dimensions are not recorded ... I did not invent a number."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx drawer
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: .cs-tab and .cs-drawer-tab CSS were not deleted line-by-line as the task asked — the cardstock stylesheet is unimported so they're dead by a stronger mechanism (shelved intact for restore).
- quote: "This is why `.cs-tab` and `.cs-drawer-tab` were not deleted line-by-line as the task doc asked. They are dead by a stronger mechanism than deletion: the stylesheet that declares them is not imported"
- kind: inventory
- artifacts: CardstockHeader.tsx, header-cardstock.css, .cs-tab, .cs-drawer-tab, public/header-stock.jpg
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Open question 1 — should the app header minify on scroll? Built fixed-height as the safer default; recommend keeping fixed, but it's the owner's call.
- quote: "**Should the app header minify on scroll?** The task doc asks this and names a fixed height as the safer default; that is what is built ... Recommend keeping it fixed."
- kind: blocked-on-owner
- artifacts: AppHeader.tsx, --cs-hdr-h
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Open question 2 — was the staff rail meant to go green too? Built green (interpretation), flagged; reverting alone means a second palette for five shared components.
- quote: "**Was the staff rail meant to go green too?** Built green, for the reason in §3. Reverting it alone means giving the five shared row components a second palette."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, RailLink, PresenceLink, AccountNavLink, CommunityNav, NavFooter
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Open question 3 — the third header item (H3 in the task doc) was cut off mid-sentence; still unknown, the doc says "Ask."
- quote: "**The third header item, cut off mid-sentence (H3 in the task doc).** Still unknown — the doc says 'Ask.' Asking."
- kind: blocked-on-owner
- artifacts: AppHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: glass.nav in tailwind.config.js now has no reader after NAV_GLASS removal; left in place because removing a theme colour is a separate call.
- quote: "`glass.nav` in `tailwind.config.js` ... now has no reader. Left in place; removing a theme colour is a separate call."
- kind: inventory
- artifacts: tailwind.config.js glass.nav, NAV_GLASS
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Most of the nav-icon assignment can't be applied until page merges exist (which aren't implemented); only 5 icons applied, the rest (Lessons, Horse care, People→Contact2, merged pages, Gifts) not applied.
- quote: "**'most of this assignment cannot be applied until [the merges] exist'** — and the merges are not implemented ... So the applied subset is only pages that survive the merges under their own name"
- kind: correctness
- artifacts: AppLayout.tsx, nav-icon-exercise.md
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Pre-existing defect found not fixed — superadmin chrome is h-14 (56px) but rails stick at 76px, a 20px gap; superadmin chrome explicitly untouched.
- quote: "**One pre-existing defect found, not fixed** ... a 20px gap. This predates the task ... and superadmin chrome is explicitly 'deliberately untouched', so I left it."
- kind: defect
- artifacts: AppLayout.tsx, --cs-hdr-h
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Not verified — signed-in app on a real device, the mobile drawer open on a phone, and whether the avatar reads as "menu" to an untold user (a discoverability failure that can't be tested from here). No Supabase creds; screenshots from a throwaway harness.
- quote: "**Not verified, and someone should:** The signed-in app on a real device ... The mobile drawer *open*, on a phone. ... **Whether the avatar reads as 'menu'** ... I cannot test discoverability from here."
- kind: not-verified
- artifacts: AppHeader.tsx, AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: AppLayout.tsx, CardstockHeader.tsx and header-cardstock.css are shared with TASK-MOBILEPASS; this branch holds them (only AppLayout.tsx is a real conflict surface).
- quote: "**Shared-file note:** `AppLayout.tsx`, `CardstockHeader.tsx` and `header-cardstock.css` are shared with `TASK-MOBILEPASS`. This branch holds them."
- kind: process
- artifacts: AppLayout.tsx, CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

## TASK-SENDGUARD-REPORT.md

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: §2 (stop the churn refactor) is built and dry-run but deliberately NOT applied — waits on the review the APPLY MODE section calls for.
- quote: "**§2 is built, dry-run, and NOT applied** — it waits on the review the APPLY MODE section calls for."
- kind: blocked-on-owner
- artifacts: 20260810T1400_sendguard_reuse_pending_onboarding_document.sql, compose_document_body, regenerate_document_body, generate_document
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: The "should staff override the refusal" question — recommendation is yes eventually but not as a "send anyway" button (would silently answer six open re-sign/version decisions); build "ask for a re-signature" instead. Not part of this task.
- quote: "**Recommendation: yes, eventually — but not as part of this task, and not as a 'send anyway' button.** ... A 'send anyway' button would quietly pick answers to all six."
- kind: blocked-on-owner
- artifacts: invite_contract_counterparty
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: SEPARATE FINDING not fixed — ensure_horse_documents sweeps documents with no status filter and has two EXECUTED signed documents in its blast radius right now; either is soft-deleted (signature and all) next run. Deliberately not fixed (needs a supersede decision).
- quote: "a signature-destroying sweep this task did not scope ... `ensure_horse_documents` sweeps with **no status filter at all** ... Two EXECUTED, signed documents are in its blast radius right now ... **I did not fix it, deliberately.**"
- kind: data-integrity
- artifacts: ensure_horse_documents, documents 152912dd (HORSE_EMERGENCY_VET), a8623897 (RELEASE_HORSE_CARE)
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: §3 kept the status <> 'EXECUTED' test rather than replacing it (task said key on "no live signature") — a judgment call: literal reading would let the sweep reach an EXECUTED document with no signature row, which the traps forbid.
- quote: "**I kept the `status <> 'EXECUTED'` test rather than replacing it.** ... taken literally, that would let the sweep reach an EXECUTED document that happens to carry no signature row, which the traps forbid outright."
- kind: correctness
- artifacts: 20260810T1300_sendguard_sweep_is_signature_aware.sql
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: Known limitation stated — regenerate_document_body takes service type as a parameter (row doesn't record it); a future caller regenerating a document generated with a service type (ensure_horse_documents passes 'horse') must pass the same value or cut-blocks compose differently.
- quote: "**Known limitation, stated rather than hidden:** `regenerate_document_body` takes the service type as a parameter because the row does not record it. ... A future caller ... must pass the same value or the `JUMPER_*` cut-blocks would compose differently."
- kind: correctness
- artifacts: regenerate_document_body, generate_my_onboarding_documents, ensure_horse_documents
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: No browser click-through — Register.tsx, ContractPage.tsx and contracts.ts changes verified by typecheck/lint/build and reading only; the "already-signed party lands on their document" claim proven at the RPC boundary, not by driving the UI.
- quote: "**No browser click-through.** The `Register.tsx`, `ContractPage.tsx` and `contracts.ts` changes are verified by typecheck, lint and build, and by reading the code paths — not by driving the UI."
- kind: not-verified
- artifacts: Register.tsx, ContractPage.tsx, contracts.ts
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: sendForReview refusal copy is exercised by no test — the shape is typechecked, the sentence is not proven against a real send.
- quote: "**`sendForReview` refusal copy** is exercised by no test. The shape is typechecked; the sentence is not proven against a real send."
- kind: not-verified
- artifacts: sendForReview, contracts.ts
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: §2's behaviour under a concurrent second session (two tabs entering onboarding at once) is not modelled — reuse path is SELECT...LIMIT 1 with no lock; not a regression but not tested.
- quote: "**§2's behaviour under a *concurrent* second session** ... is not modelled. The reuse path is `SELECT … ORDER BY created_at DESC LIMIT 1` with no lock. ... I did not test it."
- kind: not-verified
- artifacts: generate_my_onboarding_documents
- decision-mention: none

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: Did not re-derive the task's account of Sarah's three documents — took F1/F2 as given, verified only F3.
- quote: "I did not re-derive the task doc's account of Sarah's three documents; I took F1/F2 as given and verified only F3, the claim §3 depends on."
- kind: not-verified
- artifacts: none
- decision-mention: F1, F2, F3

### ITEM
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: Process note — the first §1 dry-run was not a dry-run; sourcing the migration with \i executed its own COMMIT and committed fixture rows, which were then deleted and all counts confirmed restored.
- quote: "The first §1 dry-run was not a dry-run. Sourcing the migration with `\i` inside an outer transaction executed the migration's own `COMMIT;`, which closed that transaction and committed the fixture rows ... I found it immediately, deleted every one"
- kind: process
- artifacts: 20260810T1200_sendguard_no_invite_after_signature.sql
- decision-mention: none

## TASK-WALLSYNC-REPORT.md

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: Base commit differs from the brief — brief said 267fc97 but origin/main had moved one docs-only commit ahead to 38c2b05; branched off current main. Flagged.
- quote: "The brief said `267fc97`; `origin/main` had moved one commit ahead to `38c2b05` ... Flagging it because it differs from the brief."
- kind: process
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: Contradiction in the brief — it says demands are manufactured by the wall AND that Madeline genuinely owes two re-signed documents; those can't both be true. Followed the corrected section per the tie-break rule; the "still walled" verification item 3 is uncorrected pre-correction text.
- quote: "The brief states two things that cannot both be true ... The residual 'still walled' wording is `## Verification` item 3, which is pre-correction text the correction did not sweep. **I followed the CORRECTED section**"
- kind: correctness
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: require_resign_from() was already partly broken — it inserted a crd row with ON CONFLICT DO NOTHING, so for anyone already holding the assignment it wrote nothing; version-blindness would have finished it into a total no-op. Fixed to use supersession instead.
- quote: "`require_resign_from()` was already partly broken, and version-blindness would have finished it off. ... `resolve_version_decision` would report *N people required* and create zero real obligations."
- kind: defect
- artifacts: require_resign_from(), contact_required_documents, resolve_version_decision
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: All 6 template_version_events from the 2026-08-02 contract sprint are still unresolved (resolved_at IS NULL) — the wall was enforcing a queued decision nobody had made. The owner must decide whether those body changes require re-signatures.
- quote: "All **6 events from the 2026-08-02 contract sprint are still `resolved_at IS NULL`.** Nobody has decided that anyone must re-sign. ... Whether any of those body changes were material enough to require past signers to re-sign is your call."
- kind: blocked-on-owner
- artifacts: template_version_events, pending_version_decisions()
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: Assumed not verified — that the Bug A backfill touched exactly 19 rows; the UPDATE had already committed, only the end state (0 ambiguous rows) is provable.
- quote: "*Assumed, not verified:* that the backfill's affected count was exactly 19. I could not observe the UPDATE — it had already committed."
- kind: not-verified
- artifacts: 20260807T1200_backfill_signed_template_version_zero.sql
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: No browser click-through — did not log in as Sarah or Madeline and navigate to /app/documents or the feed; verification is at the RPC layer only; RESIGN_REQUIRED renders actionable by code reading, not observation.
- quote: "**No browser click-through.** I did not log in as Sarah or Madeline and click to `/app/documents` ... Verification item 2 is satisfied at the RPC layer only ... I did not watch it not fire."
- kind: not-verified
- artifacts: AppLayout.tsx, my_wall_state(), Onboarding.tsx
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: The latent-case count measured 8 people / 18 documents vs the brief's 10/20 (brief count predates the Bug A backfill); did not simulate each of the other 7 logins.
- quote: "The 8 latent cases: I measured **8 people / 18 documents** ... the brief says 10/20 — that count predates the Bug A backfill ... I did not simulate each of their logins."
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: For the owner — the 6 template version bumps from 2026-08-02 remain unresolved; the decision (ALL/SELECTED/NONE) is left, now actually taking effect after migration 2 whereas it did not before.
- quote: "The 6 template version bumps from 2026-08-02 are still **unresolved** ... As of migration 2 that answer now actually takes effect, which it did not before."
- kind: blocked-on-owner
- artifacts: template_version_events, pending_version_decisions(), resolve_version_decision
- decision-mention: none

### ITEM
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: The two WALLSYNC migrations rewrite function bodies and are not replayable on a fresh database (standing CLAUDE.md caveat), like ~31 existing migrations.
- quote: "Standing caveat from `CLAUDE.md` applies: like ~31 existing migrations these rewrite function bodies and are not replayable on a fresh database."
- kind: process
- artifacts: 20260807T1500, 20260807T1510
- decision-mention: none

## INVENTORY

### INVENTORY
- report: TASK-A8B-REPORT.md
- what: SendCopiesMenu is a new admin 4-option component wired into the executed-doc Manage card; unpushed at time of report.
- where: src/components/app/SendCopiesMenu.tsx, src/pages/app/ContractPage.tsx
- quote: "New component `src/components/app/SendCopiesMenu.tsx` (178 lines), wired into `src/pages/app/ContractPage.tsx:1378-1387`"

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: "Saved items" nav row and panel are permanently empty — gated by SEED_ENABLED hardcoded to false, no save/bookmark control exists.
- where: src/lib/seed.ts (SEED_ENABLED=false), SavedPanel, my_nav_presence(), PRESENCE_LINKS
- quote: "`SEED_ENABLED = false` in `src/lib/seed.ts`, so `SavedPanel` renders `items = []` unconditionally ... There is no bookmark or save control anywhere in `src/`"

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: TwoFactorSettings is unreachable — rendered only on /account which redirects members to /app.
- where: src/pages/Account.tsx (TwoFactorSettings), LoginSecurityCard
- quote: "`TwoFactorSettings` is rendered in exactly one place — `src/pages/Account.tsx`, the `/account` route. That page's first statement after its hooks is: `if (isMember) return <Navigate to='/app' replace />`"

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: contacts.rider_skill_level column is dead — zero references in src/, api/, or any DB function.
- where: contacts.rider_skill_level (added 20260804030000_guest_category_promotion_skill.sql)
- quote: "`contacts.rider_skill_level` was added by `20260804030000_guest_category_promotion_skill.sql` with a column comment and has zero references in `src/`, `api/`, or any database function."

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: contacts.jump_limitations / {{CLIENT.JUMP_LIMITATIONS}} token — appears in 0 template bodies and 0 clause defs; onboarding never collects it.
- where: contacts.jump_limitations, ContactDossierModal.tsx:54, template_tokens
- quote: "declared in `template_tokens` — and present in 0 `contract_templates.body` values and 0 `contract_clause_defs.body` values."

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: profiles columns tour_seen_at, first_dashboard_at, welcome_removed_at, created_from_request_id — no reader/writer (superseded or declared only in types).
- where: profiles.tour_seen_at, profiles.first_dashboard_at, profiles.welcome_removed_at, profiles.created_from_request_id, lib/types.ts
- quote: "`tour_seen_at` | ... **no reader, no writer** ... `first_dashboard_at`, `welcome_removed_at` | **0 references in `src/` or `api/`**"

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: contacts fields staff_preferred_contact, zelle_phone, zelle_email, correspondence_email, mobile_number, texts_phone — read by nothing outside the AccountInfoCard that writes them.
- where: contacts columns; AccountInfoCard.tsx, lib/contact.ts, 20260805120000_task_profile_account_info.sql
- quote: "appear in `src/`, `api/` and `supabase/` only in `AccountInfoCard.tsx`, `lib/contact.ts` ... and the migration that created them ... No email sender, receipt ... or document token reads them."

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: Directory columns hide_email/hide_mobile/hide_whatsapp have no control anywhere yet ship on the wire in every directory response; only dead SeedFallback reads m.mobile/m.whatsapp.
- where: contacts.hide_email/hide_mobile/hide_whatsapp, member_directory, SeedFallback in CommunityFeed.tsx
- quote: "`hide_email`, `hide_mobile`, `hide_whatsapp` have **zero references** in `src/` or `api/` ... The only code that reads `m.mobile` / `m.whatsapp` is `SeedFallback` in `CommunityFeed.tsx`, which is dead while `SEED_ENABLED = false`."

### INVENTORY
- report: TASK-ACCTEVAL-REPORT.md
- what: ?section=profile and ?section=documents deep-link values accepted by AccountHub but linked from nowhere.
- where: AccountHub, PRESENCE_LINKS
- quote: "`AccountHub` accepts `?section=` values `profile | stable | saved | documents`. `PRESENCE_LINKS` uses only `stable` and `saved`. Nothing in the codebase links to `?section=profile` or `?section=documents`."

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE2.md
- what: InstructorHome landing page is unreachable — renders only when OpsHome sees isAdmin===false, and no MANAGER/EMPLOYEE account exists; now viewable only via an unlinked preview URL.
- where: InstructorHome, /app/ops/preview/instructor-home (InstructorHomePreview.tsx), OpsHome
- quote: "`InstructorHome` renders only when `OpsHome` sees `isAdmin === false`. Production `profiles.role` holds ... **zero MANAGER or EMPLOYEE rows**, so no account in existence renders it."

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE2.md
- what: OpsDashboard (/app/ops) has been registered and unlinked since it shipped — reachable only by typing the URL; nav entry specified but not applied.
- where: /app/ops (OpsDashboard), AppLayout.tsx
- quote: "/app/ops has been registered and unlinked since it shipped; the owner asked to see it before ruling on it."

### INVENTORY
- report: TASK-ADDNEW-REPORT.md
- what: PageHeader aria-label falls back to visible text if addLabel omitted — no page does this today; fallback exists for a future page.
- where: PageHeader.tsx
- quote: "If `addLabel` is omitted, `aria-label` is `undefined` and the accessible name falls back to the visible text alone (resolution 2) — no page does this today, but the fallback exists"

### INVENTORY
- report: TASK-ONEAUTHOR-REPORT.md
- what: listContractTemplates() has no callers — dead read path, not deleted.
- where: src/lib/api.ts:1093 listContractTemplates()
- quote: "`listContractTemplates()` (`src/lib/api.ts:1093`) has no callers. The only template picker in the app uses `listLeaseTemplates()`. Dead read path; not deleted."

### INVENTORY
- report: TASK-ONEAUTHOR-REPORT.md
- what: The inline "Review the document text" body-preview block retired behind a boolean (not deleted).
- where: ContractPage.tsx, INLINE_BODY_PREVIEW_RETIRED = true
- quote: "It is retired behind `INLINE_BODY_PREVIEW_RETIRED = true` (the `CONTACTS_PAGE_RETIRED` pattern), not deleted."

### INVENTORY
- report: TASK-ONEAUTHOR-REPORT.md
- what: Three lease template forks (_FULL, _SIMPLE, _STANDARD) carry 0 documents each and are byte-identical clones of V2; new FlatDocument.tsx renderer added behind the null-structure branch.
- where: HORSE_LEASE_FULL, HORSE_LEASE_SIMPLE, HORSE_LEASE_STANDARD; src/components/app/FlatDocument.tsx
- quote: "`HORSE_LEASE_V2` = 6 documents. `_FULL` / `_SIMPLE` / `_STANDARD` = **0 documents each.** No signed or in-flight lease depends on any fork."

### INVENTORY
- report: TASK-ONEAUTHOR-REPORT.md
- what: FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are active/selectable templates with empty bodies and zero clause defs — compose an empty document.
- where: FACILITY_LICENSE, INDEPENDENT_CONTRACTOR (contract_templates)
- quote: "`FACILITY_LICENSE` and `INDEPENDENT_CONTRACTOR` are `active = true`, selectable, and carry **`body = ''` and zero clause defs**."

### INVENTORY
- report: TASK-ONEHEADER-REPORT.md
- what: CardstockHeader.tsx, header-cardstock.css and public/header-stock.jpg are shelved — no longer imported, emit no CSS, kept byte-identical for restore.
- where: src/components/app/CardstockHeader.tsx, src/components/app/header-cardstock.css, public/header-stock.jpg, docs/reference/shelved-cardstock-header/README.md
- quote: "The two cardstock files are no longer imported, so nothing of theirs reaches the bundle ... They are left byte-identical rather than edited, because they *are* the shelf"

### INVENTORY
- report: TASK-ONEHEADER-REPORT.md
- what: glass.nav theme colour in tailwind.config.js now has no reader after NAV_GLASS removal; left in place.
- where: tailwind.config.js glass.nav
- quote: "`glass.nav` in `tailwind.config.js` ... now has no reader. Left in place"

### INVENTORY
- report: TASK-ONEHEADER-REPORT.md
- what: AppHeader.tsx (new) and app-header.css (new) adopt the login screen's header; verification harness archived as .txt files kept out of build.
- where: src/components/app/AppHeader.tsx, src/components/app/app-header.css, oneheader-shots/harness.main.tsx.txt, harness.index.html.txt
- quote: "The harness is archived as `oneheader-shots/harness.main.tsx.txt` + `harness.index.html.txt` (the `.txt` suffix ... keeps the files out of typecheck, lint and the build)."

### INVENTORY
- report: TASK-NOGUARD3-REPORT.md
- what: 23 internal/generate_document helper functions revoked from anon/authenticated in Phase B — each has no browser/api RPC caller (loose grep hits were comments or different functions).
- where: _provision_purchase_for_offerings, send_executed_document_email, undelivered_executed_documents, document_horse_ids, expand_horse_blocks, and 18 others
- quote: "**Every loose hit on this list resolved to a comment or to a different function.**"

### INVENTORY
- report: TASK-SENDGUARD-REPORT.md
- what: §2 migration (compose_document_body / regenerate_document_body / rewritten generate_my_onboarding_documents) is committed unapplied — these functions do not exist in production.
- where: supabase/migrations/20260810T1400_sendguard_reuse_pending_onboarding_document.sql
- quote: "Production still runs the original `generate_document`, and `compose_document_body` / `regenerate_document_body` do not exist there"

### INVENTORY
- report: TASK-WALLSYNC-REPORT.md
- what: The deliberate re-sign workflow (record_template_version_bump, pending_version_decisions, resolve_version_decision, require_resign_from) exists but its 6 queued version-decision events have never been actioned.
- where: template_version_events, pending_version_decisions(), resolve_version_decision(), require_resign_from()
- quote: "A deliberate owner-decision workflow already exists, and the wall was pre-empting it. ... All **6 events from the 2026-08-02 contract sprint are still `resolved_at IS NULL`.**"
