# TASK PROFILE — Profile & Preferences restructure (owner spec 2026-08-05)

Branch `task/profile-restructure`, own worktree (`wt-profile`), off `origin/main`
at `1d78b49`.

## Scope delivered

Consolidated the Account page's Profile & Preferences surface — previously an
inline "ProfileSection" inside `AccountHub.tsx` that blended straight into the
cards below it, plus a separate `/app/profile` route ("Name, photo & bio")
that duplicated both the profile-edit fields AND a second sign-in-methods card
— into ONE surface, ONE interaction model: four unmistakably-bounded sections
(colored header band + hard border, per section), no inner pages anywhere.

1. **Profile** (community-visible) — rendered as other members actually see
   it, one Edit reveals every field in place.
2. **Preferences** — notification prefs, own section.
3. **Account information** (internal-only, staff-visible) — new.
4. **Login & security** — login email / password / Google, modal or inline.

`/app/profile` is deleted. `AppLayout.tsx` and `ClauseDocument.tsx` were not
touched (see §5).

## 1. Read-first

Before writing anything, mapped every field in the spec to what already
existed:

- `contacts` (person-facts) already had: `first_name`/`last_name`, `phone`
  (the "contact phone for calls" — confirmed NOT exposed via
  `member_directory`), `date_of_birth`, `address_line1/2/city/state/postal_code`,
  the five community channels (`community_email`, `mobile_call`, `mobile_text`,
  `whatsapp_call`, `whatsapp_text` + their `hide_*` flags, 2026-08-01 model),
  socials, `emergency_contact_1/2_{name,relationship,phone}`.
- `profiles` (login-facts) already had: `display_name`, `avatar_url`, `bio`,
  `riding_level`.
- `PREFERRED_CONTACT_OPTIONS` in `lib/contact.ts` **already included**
  Instagram/Facebook/LinkedIn/TikTok as community preferred-contact options —
  the spec's "gains socials" ask was already live (presumably from an earlier
  pass); nothing to build there, just preserved it.
- No badge data model exists anywhere (checked for a `badge` table — none;
  checked all `badge`/`Badge` code references — every one is either the
  unrelated lucide `BadgeCheck` icon or a UI notification-count/status pill,
  nothing about member achievement badges). Per the task doc's own
  instruction, the badge slot is **omitted**, not faked.
- No notification-preferences data model exists. The prior "Notifications"
  block in `ProfileSection` was three `defaultChecked` checkboxes with zero
  read/write wiring — toggling them did nothing, on every account, forever.
  This is the same class of bug `AccountPanels.tsx`'s `SavedPanel` was fixed
  for (owner's I2 report: fake seed data shown as real). Rather than repeat
  it, Preferences now renders the categories as plain informational rows, not
  interactive controls, and says "coming soon." Flagged here for the owner;
  building real per-category preferences is out of this task's scope.
- Emergency contact: the task doc hedged "(find where that lives —
  contract_fields on their executed docs)". Verified directly: the
  `CLIENT.EMERGENCY_CONTACT_1_NAME` (etc.) merge tokens in
  `token_dictionary_sync` are `field`-type, bound straight to
  `contacts.emergency_contact_1_name` — not to the lease-engine's
  `contract_fields` table (that table is the DB-driven clause system for
  `HORSE_LEASE_V2`/sale/etc., a different mechanism). The onboarding release
  flow (`DocsParticipantFlow.tsx`/`Onboarding.tsx` → `sign-release.ts` →
  `api-public.ts`) writes these columns directly at signing time, and staff's
  `ContactDossierModal` already reads them. So "what the signed onboarding
  documents captured" **is** `contacts.emergency_contact_1/2_*` — read-through
  only, no new table, no second editable copy.
- **A real, undocumented leak found while mapping the community read path**:
  `member_directory` still exposes the *legacy* `contacts.mobile`, `.whatsapp`,
  `.email` columns (the pre-2026-08-01 "one-value-plus-allow-toggles" model),
  gated only by `hide_mobile`/`hide_whatsapp`/`hide_email` — flags with **no
  UI to set them**. `community-types.ts` already documents this as known,
  deferred cleanup ("Stage B drops the columns; that is a DB change and not
  this thread's"). This directly shaped a design decision below.

## 2. Design decision: `mobile_number` is a NEW column, not a reuse of `contacts.mobile`

The spec's Account Information section asks for an internal-only "mobile
number" alongside the existing "contact phone for calls." The obvious
candidate, `contacts.mobile`, is retired (comment in `lib/contact.ts`: "the
old one-value-plus-allow-toggles model is retired") **and is still live-wired
into `member_directory`** with no way to hide it. Populating it with new
internal-only data would leak that data to the entire community the moment it
was saved — directly contradicting this task's own RLS requirement. This
isn't the "two existing columns, unclear which is canonical" ambiguity the
task doc's STOP-and-ask gate describes (there is exactly one existing
candidate, and it's provably wrong); it's resolved by evidence, not a guess,
so I proceeded rather than stopping. New column: `contacts.mobile_number`.
Same reasoning ruled out reusing `contacts.email`/`.whatsapp` for anything.

`correspondence_email`, `texts_phone`, `zelle_phone`/`zelle_email`,
`staff_preferred_contact` are all new columns per the task doc's own
migration hint list — no ambiguity there.

## 3. Migration — `supabase/migrations/20260805120000_task_profile_account_info.sql`

```sql
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS texts_phone text,
  ADD COLUMN IF NOT EXISTS correspondence_email text,
  ADD COLUMN IF NOT EXISTS zelle_phone text,
  ADD COLUMN IF NOT EXISTS zelle_email text,
  ADD COLUMN IF NOT EXISTS staff_preferred_contact text NOT NULL DEFAULT 'none';

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_staff_preferred_contact_check
  CHECK (staff_preferred_contact IN ('none', 'phone_call', 'text', 'email'));

CREATE TRIGGER contacts_normalise_account_info_phone_trg
  BEFORE INSERT OR UPDATE OF mobile_number, texts_phone, zelle_phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION normalise_phone_columns('mobile_number', 'texts_phone', 'zelle_phone');

-- C10 extension: a minor contact must not carry a personal email under
-- EITHER name (legacy `email` or the new `correspondence_email`).
CREATE OR REPLACE FUNCTION public.contacts_minor_no_email_guard() ...
  IF NEW.date_of_birth IS NOT NULL
     AND NEW.date_of_birth + interval '18 years' > current_date
     AND (NEW.email IS NOT NULL OR NEW.correspondence_email IS NOT NULL)
  THEN RAISE EXCEPTION 'a minor contact carries no direct email; ...';
```

No new RPC, so the standard "default-EXECUTE" grant-tightening does not
apply — every read/write goes through the existing own-row RLS on `contacts`
(`contacts_select`: `is_admin() OR (deleted_at IS NULL AND id =
current_contact_id())`; `contacts_update_own`: `id = current_contact_id()`),
exactly like the pre-existing `getMyContactPrefs`/`saveMyContactPrefs`.

The phone-shaped columns are normalised via the existing generic
`normalise_phone_columns(...)` trigger function (already used for the
emergency-contact phones) rather than editing `contacts_normalise_phone()`'s
body — additive, doesn't touch a shared function other paths depend on.

### Dry-run, then apply

```
$ psql "$DBURL" -v ON_ERROR_STOP=1 -c "BEGIN;" -f 20260805120000_task_profile_account_info.sql -c "ROLLBACK;"
BEGIN
ALTER TABLE
... (NOTICE: constraint/trigger doesn't exist yet, skipping — expected on first run)
CREATE TRIGGER
CREATE FUNCTION
ROLLBACK
```

Applied for real (`psql -v ON_ERROR_STOP=1 -f ...`, no error), then verified:

```
 correspondence_email    | text | YES |
 mobile_number           | text | YES |
 staff_preferred_contact | text | NO  | 'none'::text
 texts_phone             | text | YES |
 zelle_email              | text | YES |
 zelle_phone              | text | YES |
```
Trigger `contacts_normalise_account_info_phone_trg` present. Guard function
`pg_get_functiondef` confirmed the `OR NEW.correspondence_email IS NOT NULL`
clause landed.

## 4. Live proofs (raw psql against production, all writes rolled back)

Simulation technique (same as prior reports): `SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<user_id>"}'` inside
`BEGIN;…ROLLBACK;`.

**Self write + read** (cjzigs@icloud.com, `contact_id
d99f1472-48b4-466e-aaa7-f76396745c17`) — wrote all six new fields, read them
back:
```
 mobile_number  |  texts_phone   |    correspondence_email     |  zelle_phone   |    zelle_email    | staff_preferred_contact
 (555) 123-4567 | (555) 987-6543 | cj-correspondence-test@...  | (555) 111-2222 | cj-zelle-test@...  | text
```
(Formatting confirms the new normalise trigger fired.)

**Other-member direct read** (maeboon@gmail.com, unrelated active member)
against cjzigs' contact row — `SELECT count(*) ... rows_visible_to_other = 0`.

**Other-member read via `member_directory`** (the actual community read
path) for cjzigs — returned the expected community columns only
(`display_name`, `first_name`, `avatar_url`, `bio`, `riding_level`,
`community_email`, `mobile_call/text`, `whatsapp_call/text`, legacy
`email`/`mobile`/`whatsapp`, socials, `is_horse_owner`, `preferred_contact`).
None of the six new fields appear — not filtered out, structurally absent.

**Structural exclusion, not just filtered** — querying the view for the new
column by name:
```
SELECT mobile_number FROM member_directory WHERE user_id = '...';
ERROR:  column "mobile_number" does not exist
```
Confirms it is impossible for this field to ever reach a community read,
regardless of future changes to hide-flag logic.

**C10 guard extension** — set an adult DOB with `correspondence_email` set
(succeeded), then flipped DOB to a minor age on the same row:
```
ERROR:  a minor contact carries no direct email; put the address on the guardian record
CONTEXT:  PL/pgSQL function contacts_minor_no_email_guard() line 7 at RAISE
```
Guard fires on the new column exactly like the legacy one. The app-layer
error mapper (`saveMyAccountInfo` in `lib/contact.ts`) catches this specific
Postgres message and surfaces: *"This record is on file as a minor, so a
personal email can't be stored here — correspondence for minors goes through
a guardian."*

Both transactions `ROLLBACK`ed; no test data persisted to production.

## 5. Frontend changes

New: `src/components/app/profile/{SectionCard,ProfileCard,PreferencesCard,
AccountInfoCard,LoginSecurityCard,ProfileAndPreferences}.tsx`.

- **`SectionCard`** — the shared shell giving every section a colored header
  band + hard border, directly addressing the owner's "current expansion
  blends into the cards below it" critique.
- **`ProfileCard`** (Section 1) — default view fetches through
  `fetchMemberProfile(user.id)`, i.e. the *literal same* `member_directory`
  read path `MemberProfile.tsx` uses for other members, so the preview is
  guaranteed WYSIWYG rather than a hand-rebuilt approximation that could
  drift. Edit reveals: avatar (existing crop-modal flow, unchanged), display
  name, riding level (moved in from the old `/app/profile`), phone, bio, the
  five community channels + hide toggles, socials, preferred-contact
  (already includes socials). Explicit "Close" button as the collapse
  affordance, plus a top-right X — never click-the-title-to-collapse.
- **`PreferencesCard`** (Section 2) — see §1 honesty note on scope.
- **`AccountInfoCard`** (Section 3) — every field internal-only by RLS
  construction (§4). Emergency contact rendered read-only, "None on file."
  when empty. Mailing address MOVED here from Section 1 (removed
  `MyContactPrefs.address_*`/`AddressField` from the community path
  entirely — one editable copy, not two).
- **`LoginSecurityCard`** (Section 4) — reuses `EmailChangeModal` unchanged
  (already a well-built modal with an explicit verified-before-effect flow);
  `ChangePasswordModal` moved here verbatim from the old inline
  `AccountHub.tsx` definition; Google connect redirects to `/app/account`
  (was defaulting to the now-deleted `/app/profile` — fixed the dead default
  in `lib/auth.ts`'s `linkOAuthIdentity` too, since its only remaining caller
  already overrode it).
- **`ProfileAndPreferences`** — orchestrator, renders the four in a flat
  stack; this is what `AccountHub.tsx`'s "Profile & preferences" row now
  expands to (was `<ProfileSection />`).

`lib/contact.ts`: added `MyAccountInfo`/`getMyAccountInfo`/
`saveMyAccountInfo`/`StaffPreferredContact` (own-row read/write on
`contacts`, matching the existing `getMyContactPrefs` pattern); removed the
address fields from `MyContactPrefs`/`PREF_COLS` (moved to `MyAccountInfo`,
with a comment pointing future readers there so the "second editable copy"
mistake isn't reintroduced).

## 6. Eliminations

- **`src/pages/app/Profile.tsx`** — deleted. Its route
  (`<Route path="profile" element={<Profile />} />` in `App.tsx`) removed,
  with an inline comment pointing at this report. Its only inbound link
  (`AccountHub.tsx`'s "Name, photo & bio" row, `window.location.assign
  ('/app/profile')`) is gone along with the row.
- **Dead in-file code removed from `AccountHub.tsx`**: `linkGoogleIdentity`,
  `ChangePasswordModal`, `ContactCheckbox`, `ContactField`, `AddressField`,
  `SocialField`, `ProfileSection` (~300 lines) — all superseded by the new
  components above. `Row`, `SectionLabel`, `StableSection`, and the rest of
  the hub (Saved/Documents/Orders/Gifts rows) are untouched.
- **The duplicate sign-in card** inside old `/app/profile` ("Sign-in
  methods": connected-provider list + Connect Google) — gone; Section 4 is
  now the one place login/password/Google live.
- Verified with a repo-wide grep: no remaining references to `/app/profile`
  or `pages/app/Profile` outside comments that point at this report.

## `AppLayout.tsx` / `ClauseDocument.tsx`

Neither touched. `AppLayout.tsx` only links to `/app/account` (never
`/app/profile` directly), so no nav change was needed there, and none is
being requested of the parallel thread — confirmed by grep before starting.
`ClauseDocument.tsx` has no relationship to this surface at all.

## 7. `docs/archive/BUILD_TRACKER.md`

Added section K (K1–K5), all **"Code-complete, browser pending"** except K5
(elimination itself, **Done** — a deletion has no browser-dependent state to
verify). See §8 for why "browser pending" and not a claimed pass.

## 8. Done-checks

- `npm install` — fresh worktree had no `node_modules` (see §9 for a
  disk-space complication this surfaced).
- `npm run typecheck` — 0 errors (after fixing: `SectionCard`'s `icon` prop
  needed lucide's `LucideIcon` type, not a hand-rolled signature; a thenable
  from `.maybeSingle()` doesn't have `.catch`, only `.then`; one unused
  `ContactCheckbox` left over from copying the old component).
- `npm run typecheck:api` — 0 errors (this task touched no `api/` files).
- `npm run lint` — **0 errors, 29 warnings**, matching the documented
  baseline exactly. (First pass introduced 2 new `react-hooks/exhaustive-deps`
  warnings in `ProfileCard.tsx`; fixed by wrapping `loadPreview` in
  `useCallback` and depending on `user` instead of `user?.id` — brought the
  count back to exactly 29, not just "close.")
- `npm run build` — full production build + prerender + sitemap succeeds
  (required temporarily copying the shared checkout's gitignored `.env` for
  the Supabase URL/anon key the prerender step needs; removed it again
  immediately after — never committed, and the task doc only asked for
  `.env.db`).
- Live RPC/RLS proofs: §4, all reproduced above.
- **Not done: an authenticated in-browser click-through.** This session has
  no credentials for a real Supabase session (no password for the owner's
  test identities, and minting one via service-role/JWT tooling felt like
  exactly the kind of workaround the task's "no workarounds" instruction
  rules out). Per this repo's own established convention (`BUILD_TRACKER.md`
  §I already carries several "code-complete, browser pending" rows for
  exactly this reason), K1–K4 are marked the same way rather than claimed as
  verified. Recommend the owner or the orchestrator does a visual pass on
  `/app/account` → "Profile & preferences" before this ships.

## 9. Disk-space incident (disclosed in full)

`npm install` in the fresh worktree failed with `ENOSPC` — the volume was at
99% capacity (134Mi free) because ~19 other task worktrees under
`claude-code-repo/` each carry their own ~446MB `node_modules`. Checked every
worktree's branch against `origin/main` with `git branch -r --merged`: 19 of
them (`wt-a1113, wt-a12, wt-a13, wt-a14, wt-a15, wt-a16, wt-a8, wt-a8b,
wt-averify, wt-averify2, wt-b-leads, wt-c-sign, wt-c10, wt-docvis, wt-f3,
wt-i1b, wt-inav, wt-partyctrl, wt-sqltruth`) have branches **already merged
into main** — done, stale threads. Deleted only their `node_modules`
directories (8GB reclaimed) — no git state touched, nothing that isn't
trivially regenerated with `npm install`. Left alone: the shared
`fhe-website-app` checkout, `wt-uipolish` and `fhe-kiosk-worktree` (branches
not yet merged — still active), `wt-orchestrator` (detached HEAD), and
`fhe-a8b-worktree` (an older, separately-named copy I wasn't confident about).
Flagging this for whoever owns worktree hygiene — it will hit the same wall
again soon.

## 10. Production writes (everything logged)

1. The one migration, `20260805120000_task_profile_account_info.sql` —
   dry-run in `BEGIN;…ROLLBACK;`, then applied live via `psql -v
   ON_ERROR_STOP=1 -f …` (§3).

Everything else against production was read-only (`\d`, `pg_get_functiondef`,
`pg_get_viewdef`, `pg_policy`, `information_schema`) or ran inside
`BEGIN;…ROLLBACK;` blocks, independently re-verified as rolled back (§4). No
document, contact, or profile row was permanently mutated by this task
outside the migration itself.

## Honesty notes

- Every psql output quoted above is what was actually returned against
  `db.lrstswfxfsezdmvkvukc.supabase.co`, not paraphrased.
- The "contract_fields" pointer in the task doc for emergency contact turned
  out not to be literally where the data lives (§1) — said so plainly rather
  than forcing the literal instruction to fit.
- The `mobile_number`-vs-`contacts.mobile` call (§2) is the one place this
  task came closest to the STOP-and-ask gate; documented the evidence rather
  than either guessing silently or blocking on a question I could answer
  from the code and the DB.
- Preferences (K2) is not "done" in the sense of shipping real per-category
  control — it's honestly scoped as informational, and that gap is called
  out twice (§1, BUILD_TRACKER) so it doesn't read as more finished than it
  is.
- No browser/UI verification was performed (§8); `BUILD_TRACKER.md` says so
  explicitly rather than claiming a pass.
