# TASK ACCTEVAL — account system audit (findings)

**Date:** 2026-08-06 · **Branch:** `task/accteval` (report only, no code changes)
**Base:** `origin/main` @ `20061f0`
**Database:** production `db.lrstswfxfsezdmvkvukc` — read-only session
(`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` on every connection;
`SELECT` / catalog reads only). No migrations, no writes. Sarah's document
`704c8d2d-…` was never touched — no document row was read or written in this audit.

This is a findings report. It states what exists. It does not propose what to do.

---

## 0. Method — what I verified with my own eyes vs. what I inferred

**Verified by live query against production** (output quoted throughout):
schema of `contacts` / `profiles`; every RLS policy on `contacts`, `profiles`,
`members`, `clients`, `groups`, `document_parties` including `polpermissive`;
column-level `GRANT`s; all triggers on `contacts` / `profiles` / `auth.users`
and their function bodies; the `member_directory` view definition and its
`reloptions`; role attributes (`rolbypassrls`); function bodies for
`sign_release`, `update_my_onboarding_profile`, `confirm_my_legal_name`,
`update_contact_record`, `contact_dossier`, `_ensure_client_account`,
`admin_account_action`, `admin_client_overview`, `my_nav_presence`,
`ensure_contact_for_profile`, `current_contact_id`, `is_admin`, `app_role`,
`has_staff_access`, `compose_address`, `members_post_join_event`,
`calendar_reminder_sweep`; function ACLs; `template_tokens` → `contacts`
mapping and token presence in live template bodies and clause defs; row counts
and per-column population figures; generated-column definitions.

**Verified by simulated session** — `SET LOCAL ROLE anon` and
`SET LOCAL ROLE authenticated` + `request.jwt.claims` for a real plain-USER
member (Madeline, `ac3aecb9-…`). `auth.uid()`, `current_contact_id()`,
`is_admin()`, `is_active_member()` all resolved correctly under the simulation,
so the RLS results below are the real policy outcome, not a guess.

**Verified by reading the source** in this checkout: `AccountHub.tsx`,
`ProfileAndPreferences.tsx`, `ProfileCard.tsx`, `PreferencesCard.tsx`,
`AccountInfoCard.tsx`, `LoginSecurityCard.tsx`, `SectionCard.tsx`,
`AccountPanels.tsx`, `Account.tsx`, `ContactDossierModal.tsx`, `AppLayout.tsx`,
`ProtectedRoute.tsx`, `Admin.tsx`, `TeamPage.tsx`, `Onboarding.tsx`,
`DocsParticipantFlow.tsx`, `lib/contact.ts`, `lib/api.ts`, `lib/admin.ts`,
`lib/community.ts`, `lib/community-types.ts`, `lib/seed.ts`, `App.tsx`,
`api/sign-release.ts`, `api/email-change-complete.ts`,
`api/register-invited.ts`, `api/calendar-reminders.ts`.

**Inferred, and labelled as such where it appears:** that the anon-role reads
proven at the database are reachable over HTTPS through PostgREST. I proved the
*role* can read the rows; I did **not** fire an HTTP request, because the local
`.env` holds `VITE_SUPABASE_URL=https://placeholder.supabase.co` and the built
bundle in `dist/` was compiled with the same placeholder — I had no production
anon key to test with. The inference rests on: `public` is PostgREST's default
exposed schema, this database sets no `pgrst.db_schemas` override
(`pg_db_role_setting` for `authenticator` contains only
`session_preload_libraries`, `statement_timeout`, `lock_timeout`), and
unauthenticated PostgREST requests execute as exactly the role I simulated.

**Personal data in this report is masked.** Phone digits are replaced with
`(XXX) XXX-XXXX` and email local-parts with `x***`. Structure, counts and
column names are verbatim.

---

## 1. Flagged as urgent

Facts only; consequence stated, no fix prescribed.

### U1 — Every member's real email address and mobile number are readable without signing in

`member_directory` is a plain view owned by `postgres`, with no
`security_invoker` option. `postgres` carries `rolbypassrls = t`. `anon` — the
role an unauthenticated browser request executes as — holds `SELECT` on it.
RLS on `contacts` and `profiles` is therefore never evaluated for a read through
this view.

```
     relname      | relkind | relrowsecurity | owner    | reloptions
------------------+---------+----------------+----------+------------
 member_directory | v       | f              | postgres | (null)

    rolname    | rolsuper | rolbypassrls
---------------+----------+--------------
 postgres      | f        | t
 anon          | f        | f
```

```sql
SET LOCAL ROLE anon; SELECT count(*) FROM member_directory;
--  anon_visible_rows
-- -------------------
--                  6
```

All six rows carry contact values (masked here):

```
 first_name |    community_email     |   mobile_call  |  whatsapp_text |         email          | is_horse_owner
------------+------------------------+----------------+----------------+------------------------+----------------
 Sarah      | s***@gmail.com         | (XXX) XXX-XXXX | (XXX) XXX-XXXX | s***@gmail.com         | t
 CJ         | c***@icloud.com        | (XXX) XXX-XXXX | (XXX) XXX-XXXX | c***@icloud.com        | t
 Madeline   | m***@gmail.com         | (XXX) XXX-XXXX | (XXX) XXX-XXXX | m***@gmail.com         | f
 Mary       | m***@gmail.com         | (XXX) XXX-XXXX | (XXX) XXX-XXXX | m***@gmail.com         | f
 CJ         | a***@fhequestrian.com  | (XXX) XXX-XXXX | (XXX) XXX-XXXX | a***@fhequestrian.com  | f
 Claire     | h***@fhequestrian.com  | (XXX) XXX-XXXX | (XXX) XXX-XXXX | h***@fhequestrian.com  | f
```

The `profile-images` storage bucket is `public = true`, and `avatar_url` is one
of the columns this view returns, so avatar images are fetchable by the same
unauthenticated caller.

### U2 — Four more views have the same shape, including one carrying staff notes

Every view in `public` is `postgres`-owned with no `security_invoker`, and all
five grant `SELECT` to `anon`:

```
     relname      |  owner   | reloptions |  select_grantees
------------------+----------+------------+--------------------
 clients_overview | postgres |            | anon,authenticated
 inbound_queue    | postgres |            | anon,authenticated
 member_directory | postgres |            | anon,authenticated
 memberships      | postgres |            | anon,authenticated
 service_credits  | postgres |            | anon,authenticated
```

Row counts read as `anon`: `clients_overview` 14, `inbound_queue` 11,
`memberships` 9, `service_credits` 0.

- `clients_overview` columns: `id, status, source, created_at, first_name,
  last_name, email, phone, display_code`
- `inbound_queue` columns include `contact_email`, `contact_phone`, `notes`,
  **`staff_notes`**, `subject`, `proposed_times`
- `memberships` columns: `id, user_id, status, started_at, renews_at, created_at, org_id`

### U3 — A member can repoint their own account at another person's contact record

`profiles_update_own` is the only permissive UPDATE policy on `profiles` and its
`USING` / `WITH CHECK` are row-scoped only:

```
       polname       | polcmd |                using_expr
---------------------+--------+---------------------------------------------
 profiles_update_own | w      | ((user_id = auth.uid()) OR (app_role() = 'SUPER_ADMIN') OR (is_admin() AND ...))
```

`authenticated` holds `UPDATE` on all 29 columns of `profiles`, `contact_id`
included. The only column guard is the trigger `profiles_role_guard_trg`, which
covers `role`, `is_admin`, `org_id`, `title`, `pay_type`, `staff_active` — and
**not** `contact_id`.

`current_contact_id()` is `SELECT p.contact_id FROM profiles p WHERE p.user_id =
auth.uid()`. `contacts_select` is `is_admin() OR (deleted_at IS NULL AND id =
current_contact_id())` and `contacts_update_own` is `id = current_contact_id()`.
A `profiles.contact_id` a member writes to themselves therefore becomes the row
they can read and write on `contacts`, all 66 columns.

I did **not** find a member-reachable read that discloses another person's
`contacts.id`: `document_parties_self_read` is `contact_id =
current_contact_id()`, and under the simulated member session all 8 visible
`document_parties` rows carried only her own contact id. `member_directory`
returns `user_id`, not `contact_id`. I did not attempt the write, and I did not
exhaustively enumerate every table for a `contacts.id` disclosure. The structural
gap is proven; end-to-end exploitability is not.

### U4 — `profiles_role_guard` is `BEFORE UPDATE` only; the first insert of a profile row is unguarded

```
 profiles_role_guard_trg | CREATE TRIGGER profiles_role_guard_trg BEFORE UPDATE ON public.profiles
                           FOR EACH ROW EXECUTE FUNCTION profiles_role_guard()
```

`profiles_insert_own` is `WITH CHECK (user_id = auth.uid())` with no column
restriction, `authenticated` holds `INSERT` on `role`, `is_admin` and `org_id`,
and there is no trigger on `auth.users` that creates the profile row
(`SELECT … FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT
tgisinternal` → 0 rows). A signed-in user with no `profiles` row yet is the
window this describes.

Two such users exist in production right now:

```
           email            |          created_at
----------------------------+-------------------------------
 cjzigs+averify2@icloud.com | 2026-08-05 10:10:32.378645+00
 ashlanalexis22@gmail.com   | 2026-07-16 19:50:00.528287+00
```

For both, `app_role()`, `current_org()` and `current_contact_id()` return NULL,
`is_active_member()` is false, and `ProtectedRoute` renders the "We couldn't
activate your account" terminal state. (`ashlanalexis22@gmail.com` corresponds
to the `Ashlan` contact row, `contact_type = CONTACT`, no account link.)

### U5 — `_ensure_client_account` is anon-executable with no caller check

```
        proname          | prosecdef |                        acl
-------------------------+-----------+--------------------------------------------------
 _ensure_client_account  | t         | =X/postgres | anon=X/postgres | authenticated=X/… 
```

The body's first statements are `IF p_org IS NULL … IF v_email IS NULL … IF
p_marker NOT IN ('CLIENT','CUSTOMER')`. There is no `is_admin()`,
`has_staff_access()` or `auth.uid()` test anywhere in it, and the org is taken
from the `p_org` parameter rather than from the caller. It writes:

```
INSERT INTO clients
INSERT INTO contact_required_documents
INSERT INTO contacts
UPDATE clients
UPDATE contacts
```

For contrast, `admin_account_action` opens with
`IF NOT (has_staff_access() AND is_admin()) THEN RAISE EXCEPTION`, and
`promote_contact_to_account` / `purge_account` are granted only to `postgres`
and `service_role`.

`sign_release` (also `anon`-executable, by design — it is the kiosk) matches an
existing contact by email: `SELECT id INTO v_contact FROM contacts WHERE org_id
= v_org AND lower(email) = v_email AND deleted_at IS NULL`. It then fills that
contact's still-empty person fields (DOB, address, both emergency contacts) and
attaches an executed release document to it. Existing non-empty values are not
overwritten (see §5.1).

---

## 2. Field map — `contacts` (66 columns)

"Member UI" = the four cards at `/app/account`. "Staff UI" = `ContactDossierModal`.
"API-writable by member" = the column-level `UPDATE` grant to `authenticated`
combined with `contacts_update_own` — verified: all 66 columns are granted.

| Column | Written by | Read by | Second copy? |
|---|---|---|---|
| `id` | — | everything | — |
| `display_code` | `contacts_assign_code` trigger (`CON-` + `contact_code_seq`) | dossier header | — |
| `first_name`, `last_name` | `sign_release` (fill-if-blank/placeholder), `update_my_onboarding_profile` (fill-if-blank), `confirm_my_legal_name` (always), `update_contact_record` (staff, always), `AccountInfoCard` (member, direct table `UPDATE`), `_ensure_client_account`, `provision_client_invitation`, `redeem_invitation`, `promote_contact_to_account` | `member_directory` (`COALESCE(p.first_name, c.first_name)`), `{{PARTY.FULL_NAME}}`, `{{PARTY.PRINTED_NAME}}`, dossier, ops lists | **YES** — `profiles.first_name/last_name`; one-way sync only (§4.1) |
| `email` | `sign_release` (insert only), `_ensure_client_account`, `update_contact_record` (staff) | `member_directory.email` (gated by `hide_email`), `{{PARTY.EMAIL}}` (declared, in 0 template bodies), `ensure_contact_for_profile` match, `_ensure_client_account` match | **YES** — `profiles.email` and `auth.users.email`; no sync (§4.2) |
| `phone` | `AccountInfoCard` ("Contact phone (for calls)"), `ProfileCard` ("Phone" → `updateMyContactPhone`), `adminUpdateProfile` (Clients + Team pages), `update_contact_record`, `sign_release`, `update_my_onboarding_profile` | `{{PARTY.PHONE}}` (via `phone_display`), `admin_client_overview`, dossier | seeds four community channels on every write (§3.1) |
| `mobile`, `whatsapp` | staff dossier only | **`member_directory.mobile` / `.whatsapp`** | — |
| `phone_ext`, `mobile_ext` | staff dossier | `phone_display` / `mobile_display` generation | — |
| `phone_display`, `mobile_display` | `GENERATED ALWAYS` (verified) | `fill_party_fields_from_contacts` (`c.phone_display AS phone`) | derived |
| `address_line1/2`, `city`, `state`, `postal_code`, `country` | `AccountInfoCard`, dossier, `sign_release`, `update_my_onboarding_profile` | `address_composed` generation, `admin_client_overview` → `contactAddress` | — |
| `address_composed` | `GENERATED ALWAYS (compose_address(...))` (verified) | `fill_party_fields_from_contacts` (preferred over the parts), `generate_document`, `deal_record_export`, `document_parties_summary`, `{{PARTY.ADDRESS}}` | derived |
| `date_of_birth` | `AccountInfoCard`, dossier, `sign_release` (fill-if-null), `update_my_onboarding_profile` | C10 minor logic, `{{PARTY.DOB}}` (declared, 0 bodies) | — |
| `tags` | dossier allowlist (no dossier UI field) | ops filters | — |
| `notes` | dossier ("Staff notes"), the 2026-07-30 name-consolidation migration | dossier | member can read and write it via the API (§8) |
| `deleted_at`, `deleted_by` | soft-delete paths | `contacts_select`, most reads | — |
| `org_id` | `DEFAULT current_org()` | `contacts_org_boundary` (RESTRICTIVE) | — |
| `emergency_contact_1/2_{name,relationship,phone}` | `sign_release` (fill-if-blank), `update_my_onboarding_profile` (**incoming wins**), `update_contact_record` (staff, always) | `AccountInfoCard` (read-only display), `{{CLIENT.EMERGENCY_CONTACT_*}}` (2 live templates) | — |
| `riding_experience_years`, `jump_experience`, `riding_background` | Onboarding step 1, dossier | `{{CLIENT.*}}` — each in exactly 1 live template body (`RELEASE_JUMPER_ADDENDUM`) | — |
| `jump_limitations` | staff dossier only — `update_my_onboarding_profile` accepts the key but no caller sends it (`jump_limitations` appears in `src/` only in `ContactDossierModal.tsx:54`) | `{{CLIENT.JUMP_LIMITATIONS}}` — **0 template bodies, 0 clause defs** | — |
| `is_company` | staff paths | party-type checks, `_ensure_client_account` exclusion | — |
| `guardian_contact_id` | `sign_release`, `update_my_onboarding_profile`, dossier allowlist | C10, dossier Relationships | — |
| `contact_type` | `set_contact_type` (staff-guarded), dossier | dossier "Filed under" | — |
| `mobile_call`, `mobile_text`, `whatsapp_call`, `whatsapp_text`, `community_email` | `ProfileCard` per keystroke, **and the `contacts_a_seed_community_channels` trigger on every `phone`/`email` write** | `member_directory` (gated by their own `hide_*`) | mirror `phone` / `email` for effectively the whole table (§3.1) |
| `hide_community_email`, `hide_mobile_call`, `hide_mobile_text`, `hide_whatsapp_call`, `hide_whatsapp_text` | `ProfileCard` checkboxes | `member_directory` CASE arms | — |
| `hide_email`, `hide_mobile`, `hide_whatsapp` | **nothing in `src/` or `api/`**; present in `update_contact_record`'s allowlist but rendered by no dossier field | `member_directory` CASE arms for `email` / `mobile` / `whatsapp` | — |
| `preferred_contact` | `ProfileCard` select | `member_directory` (with a suppression CASE) | — |
| `social_tiktok/instagram/facebook/linkedin` | `ProfileCard` | `member_directory`, `MemberProfile`, feed cards | — |
| `name_needs_confirmation` | set `true` **only** by migration `20260730150000_name_consolidation_s7.sql`; cleared by `confirm_my_legal_name` | `my_name_confirmation_state` → `ConfirmNameModal` signing gate | — |
| `rider_skill_level` | **nothing** | **nothing** | added by `20260804030000_guest_category_promotion_skill.sql` with a `COMMENT`; 0 references in `src/`, `api/`, or any function |
| `mobile_number`, `texts_phone`, `correspondence_email`, `zelle_phone`, `zelle_email`, `staff_preferred_contact` | `AccountInfoCard` only | **`AccountInfoCard` only** — 0 other readers anywhere (§6.3) | — |
| `created_at`, `updated_at` | `set_updated_at` trigger | — | — |

## 2b. Field map — `profiles` (29 columns)

| Column | Written by | Read by | Second copy? |
|---|---|---|---|
| `user_id` | insert | everything | FK → `auth.users` |
| `first_name`, `last_name` | `Account.tsx` (`/account`), `adminUpdateProfile` (Clients + Team), `update_my_onboarding_profile` (fill-if-blank), `sync_profile_name_from_contact` trigger | `member_directory` (**preferred over `contacts.first_name`**), `AuthContext`, greetings | **YES** — `contacts` |
| `email` | `email-change-complete.ts`, `Account.tsx`, `adminUpdateProfile` (free-text field on both staff pages) | `email-change-complete`'s password proof (`signInWithPassword({ email: profile.email })`), `ensure_contact_for_profile` matching, `calendar-reminders.ts` send target, ops lists | **YES** — `auth.users.email` and `contacts.email` |
| `display_name` | `ProfileCard`, `adminUpdateProfile` | `member_directory`, feed/thread/DM author names | — |
| `avatar_url` | `ProfileCard` → `uploadMyAvatar` (public bucket `profile-images`) | `member_directory`, feed, messages | — |
| `bio` | `ProfileCard`, `adminUpdateProfile` (Clients + Team) | `member_directory`, `MemberProfile`, `PostModal`, `Admin.tsx` Overview | — |
| `riding_level` | `ProfileCard`, `adminUpdateProfile` | `member_directory`, `MemberProfile`, `Messages`, feed cards | `contacts.rider_skill_level` exists and is dead |
| `is_admin` | `adminSetAdmin`, `adminSetRole` | legacy checks | mirrors `role` |
| `role` | `adminSetRole`, `redeem_invitation` | `app_role()` → `is_admin()`, `has_staff_access()`, nav gating | — |
| `is_suspended` | `adminSetSuspended`, `admin_account_action` | `is_active_member()`, `member_directory` WHERE | — |
| `contact_id` | `promote_contact_to_account` (documented as sole writer) — **and any authenticated user on their own row** (§U3) | `current_contact_id()` → all `contacts` RLS | — |
| `org_id` | provisioning | `current_org()` → every org-boundary policy | — |
| `pending_email`, `pending_email_mode`, `pending_email_token_hash`, `pending_email_started_at`, `old_email` | `email-change-start.ts` / `-complete.ts` | same | — |
| `title`, `pay_type`, `staff_active` | admin-only (guard trigger) | Team page | — |
| `tour_seen_at` | declared in `lib/types.ts` only | **no reader, no writer** — `tour_seen_desktop_at` / `_mobile_at` are the live pair | superseded by the two device-specific columns |
| `first_dashboard_at`, `welcome_removed_at` | **0 references in `src/` or `api/`** | — | — |
| `created_from_request_id` | declared in `lib/types.ts` only | — | — |

`profiles.payment_reminders` — described in `CLAUDE.md` D9 as "a vestigial column
with no reader" — **does not exist**:

```sql
SELECT count(*) FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles' AND column_name='payment_reminders';
--  count
-- -------
--      0
```

---

## 3. The write paths — eight surfaces write the same person

| # | Surface | Route / entry | Writes |
|---|---|---|---|
| 1 | `ProfileCard` | `/app/account` → Profile & preferences → Edit profile | `profiles.display_name/bio/avatar_url/riding_level` + `contacts.phone` + 15 `contacts` pref columns |
| 2 | `AccountInfoCard` | same card stack, always in edit mode | 15 `contacts` columns (names, phones, address, DOB, Zelle, correspondence email, staff-preferred contact) |
| 3 | `Account.tsx` | `/account` (legacy public page) | `profiles.first_name/last_name/email` + `contacts.phone` |
| 4 | `Admin.tsx` (Clients) | `/app/admin` → `adminUpdateProfile` | `profiles` (6 fields) + `contacts.phone` |
| 5 | `TeamPage.tsx` | `/app/ops/team` → `adminUpdateProfile` | same six + `contacts.phone` |
| 6 | `ContactDossierModal` | staff, any contact → `update_contact_record` | 36-column `contacts` allowlist |
| 7 | `Onboarding.tsx` | `/app/onboarding` → `update_my_onboarding_profile` | `contacts` (name, phone, DOB, address, both emergency contacts, 4 riding-background fields) + `profiles` name |
| 8 | `Release.tsx` / `DocsParticipantFlow.tsx` | `/release`, `/docs/...` → `sign_release` (anon) | `contacts` (creates or fills an existing row matched by email) |

---

## 4. Duplication and divergence

### 4.1 `first_name` / `last_name` — one-way sync, so the two copies diverge in one direction

`contacts → profiles` is synced by a trigger:

```sql
CREATE TRIGGER sync_profile_name_from_contact_trg
  AFTER UPDATE OF first_name, last_name ON public.contacts …
-- body: UPDATE profiles SET first_name = NEW.first_name, last_name = NEW.last_name
--       WHERE contact_id = NEW.id;
```

There is no trigger in the other direction. The triggers on `profiles` are
`contacts_file_team_on_link_trg`, `profiles_link_contact_trg`,
`profiles_role_guard_trg`, `profiles_set_updated_at`,
`trg_profiles_sync_staff_profile` — none writes `contacts` names.

Write paths 3, 4 and 5 above write `profiles.first_name/last_name` and nothing
else. After any of those, the two copies hold different values. `member_directory`
resolves `COALESCE(p.first_name, c.first_name)` — it shows the `profiles` copy;
merge tokens `{{PARTY.FULL_NAME}}` / `{{PARTY.PRINTED_NAME}}` read the `contacts`
copy. The community and the legal document would then print different names for
the same person.

Currently in production the two copies agree for every account that has both:

```
        profile_email          | p_first  | c_first  |   p_last   |   c_last   | name_diverged
-------------------------------+----------+----------+------------+------------+---------------
 admin@cactai.io               |          | CACTAI   |            | INC.       | t
 zz-test-seller@example.invalid| Seller   |          | ZZTest     |            | t
 zz-test-cobuyer@…             | Cobuyer  |          | ZZTest     |            | t
 zz-test-buyer@…               | Buyer    |          | ZZTest     |            | t
 admin@fhequestrian.com        | CJ       | CJ       | Z          | Z          | f
 sarahrosengard@gmail.com      | Sarah    | Sarah    | Morgan     | Morgan     | f
 madelinedo@gmail.com          | Madeline | Madeline | Do         | Do         | f
 maeboon@gmail.com             | Mary     | Mary     | Richardson | Richardson | f
 hello@fhequestrian.com        | Claire   | Claire   | Bourdon    | Bourdon    | f
 cjzigs@icloud.com             | CJ       | CJ       | Z          | Z          | f
```

The four `name_diverged = t` rows are the platform-owner row and the three
`zz-test` rows whose `contacts` row does not exist (§9.1).

### 4.2 `email` exists in three places and no path reconciles all three

`auth.users.email`, `profiles.email`, `contacts.email` (plus the derived
`contacts.community_email`).

`api/email-change-complete.ts` updates `auth.users.email` (via
`admin.updateUserById`) and `profiles.email`. It contains **no reference to
`contacts`** (`grep -n "contacts" api/email-change-*.ts` → no matches). After a
login-email change, `contacts.email` and `contacts.community_email` still hold
the previous address, and `member_directory` publishes both of them.

Separately, `adminUpdateProfile` exposes `profiles.email` as a free-text input on
both `/app/admin` and `/app/ops/team`. `email-change-complete.ts` proves the
password by calling `signInWithPassword({ email: profile.email, password })` —
i.e. the value an admin can edit is the address the proof authenticates against.

### 4.3 `contacts.phone` vs the five community channels — one write, five copies

`contacts_a_seed_community_channels` is `BEFORE INSERT OR UPDATE OF phone, email`:

```sql
IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
  NEW.mobile_call   := coalesce(NEW.mobile_call,   NEW.phone);
  NEW.mobile_text   := coalesce(NEW.mobile_text,   NEW.phone);
  NEW.whatsapp_call := coalesce(NEW.whatsapp_call, NEW.phone);
  NEW.whatsapp_text := coalesce(NEW.whatsapp_text, NEW.phone);
END IF;
IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
  NEW.community_email := coalesce(NEW.community_email, NEW.email);
END IF;
```

The four channel columns and `community_email` are exactly what `member_directory`
publishes. Their `hide_*` columns default to `false`. In production:

```
 with_phone | call_eq_phone | watext_eq_phone | ce_eq_email
------------+---------------+-----------------+-------------
         19 |            19 |              19 |          22
```

19 of 19 phone-holding contacts have `mobile_call` and `whatsapp_text` equal to
their `phone`; 22 of 23 contacts have `community_email` equal to their `email`.
Two of these five channels are WhatsApp channels seeded from an ordinary phone
number, with no check that the number is on WhatsApp.

The `contacts.phone` field is labelled "Contact phone (for calls)" inside the
`AccountInfoCard`, whose header badge reads **"Visible only to French Heritage
staff"**. `contacts.phone` itself is indeed absent from `member_directory`;
the four values the same write creates are not.

### 4.4 Two write paths for the same onboarding fields, with opposite precedence

`sign_release` (kiosk / participant flow) — **existing value wins**:

```sql
UPDATE contacts SET
  date_of_birth = coalesce(date_of_birth, p_dob),
  address_line1 = coalesce(nullif(address_line1,''), NULLIF(trim(coalesce(p_address_line1,'')),'')),
  emergency_contact_1_name = coalesce(nullif(emergency_contact_1_name,''), NULLIF(trim(coalesce(p_ec1_name,'')),'')),
  … WHERE id = v_contact;
```

`update_my_onboarding_profile` (in-app onboarding) — **incoming value wins**:

```sql
UPDATE contacts SET
  date_of_birth = coalesce(NULLIF(trim(p->>'date_of_birth'), '')::date, date_of_birth),
  address_line1 = coalesce(NULLIF(trim(p->>'address_street'), ''), address_line1),
  emergency_contact_1_name = coalesce(NULLIF(trim(p->>'emergency_contact_1_name'), ''), emergency_contact_1_name),
  … WHERE id = v_contact;
```

The same person entering the same corrected emergency-contact phone gets it
saved through `/app/onboarding` and silently discarded through `/release`.

Name precedence is a third rule again: `sign_release` writes the name only when
the existing one is blank or equals the email; `update_my_onboarding_profile`
only when blank; `confirm_my_legal_name` and `update_contact_record` always.

### 4.5 `riding_level` and `rider_skill_level`

`profiles.riding_level` is live (member-editable, staff-editable, published to
the directory). `contacts.rider_skill_level` was added by
`20260804030000_guest_category_promotion_skill.sql` with a column comment and has
zero references in `src/`, `api/`, or any database function.

### 4.6 `tour_seen_at` vs `tour_seen_desktop_at` / `tour_seen_mobile_at`

`tour_seen_at` appears only in `src/lib/types.ts`. The two device-specific
columns are the ones `AppLayout.tsx` and `AppOverviewModal.tsx` read and write.

---

## 5. Fake or dead surfaces

### 5.1 `PreferencesCard` states three things that no producer exists for

The card renders:

> "You'll receive updates for the following. Per-category control is coming soon."
> · Replies to my discussions · Event reminders · New member welcomes

Verified against the database:

- **Replies to my discussions** — no database function references `thread_posts`
  (`SELECT proname … WHERE pg_get_functiondef(oid) ~* 'thread_posts'` → 0 rows),
  and no trigger exists on `thread_posts` or `threads`
  (`pg_trigger` filtered to those relations → 0 rows). `replyToThread()` in
  `lib/community.ts` is a bare `insert` with no notification. No in-app
  notification and no email is produced by a reply.
- **Event reminders** — no function references the community `events` table
  (`~* 'from events|join events'` → 0 rows). `calendar_reminder_sweep` reads
  `FROM bookings` with `kind IN ('lesson', …)`; `api/calendar-reminders.ts`
  emails `kind LIKE 'booking_%'`. Community events produce nothing.
- **New member welcomes** — `members_post_join_event` inserts a `feed_posts` row
  of `post_type = 'member_joined'`. That is a post in the feed, not a
  notification or an email to any member.

The card's own header comment describes it as the fix for the previous
`defaultChecked` checkboxes that "were never read or saved". It replaced three
non-functional controls with three sentences asserting behaviour that does not
occur.

### 5.2 "Saved items" can never contain anything

`SEED_ENABLED = false` in `src/lib/seed.ts`, so `SavedPanel` renders `items = []`
unconditionally and shows "Nothing saved yet — Bookmark articles, listings, and
links to find them here." `my_nav_presence()` returns `'saved', false` as a
literal, not a query. There is no bookmark or save control anywhere in `src/`
(searched for `bookmark`, `saved_item`, `save_post`, `unsave` — the only hits are
the `Bookmark` lucide icon, the empty-state copy itself, and unrelated
"unsaved changes" strings). The row exists on the Account hub and the nav link
exists in `PRESENCE_LINKS`, gated by a flag hardcoded to false.

### 5.3 Two-factor authentication is unreachable for any member

`TwoFactorSettings` is rendered in exactly one place — `src/pages/Account.tsx`,
the `/account` route. That page's first statement after its hooks is:

```tsx
if (isMember) {
  return <Navigate to="/app" replace />;
}
```

`isMember` is `(!profile?.is_suspended) && (isStaff || member?.status === 'active')`.
Every account in production that has completed provisioning has an active
`members` row or is staff. `LoginSecurityCard` (the `/app/account` security
section) offers Login, Password and Connect-Google only. `Login.tsx` still
performs the MFA challenge at sign-in (`needsMfaChallenge()`), so an enrolled
factor is still enforced — there is simply no reachable surface to enrol or
unenrol one.

`/account` is also the default post-login destination
(`Login.tsx: const from = … || '/account'`), the OAuth redirect
(`signInWithOAuth(provider, redirectTo = '/account')`), the signup email redirect,
and the password-reset destination — so members pass through a page that
immediately redirects them. `OrderDetail.tsx` renders "Back to your account"
pointing at `/account`, which for a member lands on `/app`.

### 5.4 Legacy directory columns with no control and an active publisher

`hide_email`, `hide_mobile`, `hide_whatsapp` have **zero references** in `src/`
or `api/` (exact word-boundary search). They are in `update_contact_record`'s
allowlist but the `ContactDossierModal` `FIELD_GROUPS` renders no field for them,
so no staff surface writes them either. Production state:

```
 contacts_total | hide_email_true | hide_mobile_true | hide_whatsapp_true | hide_ce_true
----------------+-----------------+------------------+--------------------+--------------
             23 |               0 |                0 |                  0 |            0
```

`member_directory` returns `email`, `mobile` and `whatsapp` gated on exactly
those three always-false flags. `fetchMemberDirectory` / `fetchMemberProfile` use
`.select('*')`, so those three columns are on the wire in every directory
response delivered to every member's browser, even though
`MemberDirectoryEntry` deliberately omits them from the TypeScript type. The
only code that reads `m.mobile` / `m.whatsapp` is `SeedFallback` in
`CommunityFeed.tsx`, which is dead while `SEED_ENABLED = false`.

The five *new* hide flags are set on 13 contacts — and those 13 are precisely
the contacts with **no account**, i.e. the ones `member_directory` does not
publish. Every one of the 6 contacts the directory does publish has all hide
flags `false`:

```
 first_name | contact_type | has_account | hide_mobile_call | hide_community_email
------------+--------------+-------------+------------------+----------------------
 Anita      | CONTACT      | f           | t                | f
 Ashlan     | CONTACT      | f           | t                | f
 …
 CJ         | TEAM         | t           | f                | f
 Madeline   | CONTACT      | t           | f                | f
 Mary       | CONTACT      | t           | f                | f
 Sarah      | CONTACT      | t           | f                | f
```

`hide_community_email` is `false` on all 23 rows.

### 5.5 `{{CLIENT.JUMP_LIMITATIONS}}` merges into nothing

Editable in the staff dossier, declared in `template_tokens` — and present in 0
`contract_templates.body` values and 0 `contract_clause_defs.body` values. (The
other three riding-background tokens each appear in exactly one body,
`RELEASE_JUMPER_ADDENDUM`.) The onboarding form does not collect it: its
`EMPTY_FORM` carries `riding_experience_years`, `jump_experience` and
`riding_background` only, and `jump_limitations` occurs in `src/` at exactly one
line — `ContactDossierModal.tsx:54`. `update_my_onboarding_profile` writes the
column if a caller supplies the key; none does. All six
`{{PARTY.*}}` tokens are likewise declared and appear in 0 template bodies and 0
clause defs — those are filled through `fill_party_fields_from_contacts` into
`contract_field_defs` instead, which I did not trace further.

### 5.6 `name_needs_confirmation` can never be raised again

Only two functions reference the column: `confirm_my_legal_name` (sets it
`false`) and `my_name_confirmation_state` (reads it). The only code that ever
set it `true` is the one-time backfill in
`supabase/migrations/20260730150000_name_consolidation_s7.sql` (line 76). One
contact carries the flag today. The `ConfirmNameModal` signing gate is described
in `lib/api.ts` as failing closed; no live path re-arms it when a name conflict
arises after 2026-07-30.

### 5.7 `?section=profile` deep link has no link

`AccountHub` accepts `?section=` values `profile | stable | saved | documents`.
`PRESENCE_LINKS` uses only `stable` and `saved`. Nothing in the codebase links to
`?section=profile` or `?section=documents`.

### 5.8 Two writes on the member's own account do not prove they landed

`CLAUDE.md` states every write goes through `assertWrote()`. Two do not:

- `updateMyContactPhone` (`lib/api.ts:451`) — `.update({ phone }).eq('id', …)`
  with no `.select()` and no `assertWrote`.
- `upsertMyProfile` (`lib/api.ts:421`) — `.upsert(…)` with no `.select()` and no
  `assertWrote`.

Both are called by `ProfileCard.save()` and by `Account.tsx`'s save form.

### 5.9 "Close without saving" does not discard the contact fields

In `ProfileCard`, the contact channels, hide checkboxes, socials and preferred-contact
select are wired to `set()`:

```tsx
function set<K extends keyof MyContactPrefs>(key: K, value: MyContactPrefs[K]) {
  setPrefs((p) => (p ? { ...p, [key]: value } : p));
  saveMyContactPrefs({ [key]: value }).catch(() => { /* keep UI state; retried on next field save */ });
}
```

That is one database write per keystroke, committed immediately. The `X` control
carries `aria-label="Close without saving"` and the footer button reads "Close";
both call `setEditing(false)` only. The `Save` button writes
`display_name/bio/avatar_url/riding_level` and the phone — the 15 pref columns are
already written by then. The `.catch()` discards the error and leaves the new
value on screen; there is no retry mechanism, and the next field's save sends only
that field.

---

## 6. Exposure

### 6.1 Unauthenticated

Covered in §U1 / §U2: `member_directory`, `clients_overview`, `inbound_queue`,
`memberships`, `service_credits`, plus the public `profile-images` bucket.

### 6.2 Member-to-member

Under the simulated plain-member session:

```
          t          | count
---------------------+-------
 contacts            |     1
 profiles            |     1
 member_directory    |     6
 members             |     1
 clients             |     1
 groups              |     1
 document_parties    |     8
 horse_relationships |     0
```

A member sees exactly one `contacts` row and one `profiles` row — their own —
and every directory row. The 8 `document_parties` rows all carry her own
`contact_id`. What reaches other members is precisely the `member_directory`
column set, which is the same set §U1 shows reaching non-members.

### 6.3 Fields the member fills in that nothing consumes

`staff_preferred_contact`, `zelle_phone`, `zelle_email`, `correspondence_email`,
`mobile_number`, `texts_phone` appear in `src/`, `api/` and `supabase/` only in
`AccountInfoCard.tsx`, `lib/contact.ts` (the read/write helpers for that card)
and the migration that created them
(`20260805120000_task_profile_account_info.sql`). No staff surface displays them
— the `ContactDossierModal` `FIELD_GROUPS` does not list any of them. No email
sender, receipt, payment-reconciliation path or document token reads them.
`api/zelle-reconcile.ts` does not reference `zelle_phone` or `zelle_email`
(case-insensitive search for "zelle" across `src/` and `api/` returns only
`OrderPayment.tsx`'s QR/instructions and these two card fields).

The card presents these as consumed:
- Zelle ID: *"Used to match your Zelle payments to your orders."*
- Staff-preferred contact: *"Preferred contact method (for our staff)"*
- Correspondence email: *"Used for company correspondence — except access emails …"*

### 6.4 Emergency contacts are presented as immutable and are not

`AccountInfoCard` renders them read-only under *"From your signed onboarding
paperwork — shown here for reference, not editable."* They are freely writable by
staff through `update_contact_record` (the `Emergency contacts` field group in
`ContactDossierModal`), by the member themselves through `/app/onboarding`
(`update_my_onboarding_profile`, incoming-wins), and by the member directly via
the API (§8). What the card says is true of *that card*, not of the field.

---

## 7. Click depth

Desktop member, starting anywhere inside `/app`. Two entries exist to the same
page: the left rail's `Account` link (1 click) and the avatar dropdown's
`Account` item (2 clicks: avatar, then Account). Counts below use the rail.

| Task | Path | Clicks to reach the control |
|---|---|---|
| Edit display name / bio / photo / riding level | Account → "Profile & preferences" row → "Edit profile" | **3** (a 4th, `Save`, commits) |
| Edit any community channel or hide flag | Account → "Profile & preferences" → "Edit profile" | **3** — then saves per keystroke, no commit click |
| Edit mailing address / DOB / Zelle / correspondence email / staff-preferred contact | Account → "Profile & preferences" | **2** — fields are live, commit on blur |
| Change password | Account → "Profile & preferences" → "Password" row (modal) | **3** |
| Change login email | Account → "Profile & preferences" → "Login" row (modal) | **3** |
| Connect Google | Account → "Profile & preferences" → "Connect" | **3** |
| View own documents | Account → "Documents" row | **2** |
| My Stable | rail "My Stable" (present only when `my_nav_presence().stable`) | **1**, else Account → "My Stable" = **2** |
| Saved items | Account → "Saved items" | **2**, always empty (§5.2) |
| Orders / Gifts / My posts / My lessons | Account → row (navigates away) | **2** |
| Enable or disable 2FA | — | **unreachable** (§5.3) |
| Change emergency contact | — | **unreachable from the member UI** |

**Inner pages inside the account surface: none.** `ProfileAndPreferences`
renders all four `SectionCard`s in one flat stack; password and email changes are
modals over that stack. The route `/app/profile` no longer exists (`App.tsx`
lines 227–232). Everything else on the Account hub either expands inline
(`profile`, `stable`, `saved`, `documents`) or navigates to a separate page
(`my-posts`, `lessons`, `orders`, `gifts`).

The `Profile & preferences` row is collapsed by default and the four sections
render only after it is expanded, so no account field is visible on first load of
`/app/account`.

---

## 8. Permission reality

### What the member can do beyond what the UI offers

`contacts_update_own` is `id = current_contact_id()` with no column predicate,
and `authenticated` holds `UPDATE` on all 66 `contacts` columns. `contacts_select`
returns the whole row for the same predicate. Confirmed live under the simulated
member session — she reads her own `notes`, `tags`, `contact_type`, `is_company`,
`date_of_birth`, `emergency_contact_1_name` and every `hide_*` flag:

```
 first_name | notes | tags | contact_type | is_company | has_dob | emergency_contact_1_name | hide_email
------------+-------+------+--------------+------------+---------+--------------------------+------------
 Madeline   |       | {}   | CONTACT      | f          | t       | Amanda Do                | f
```

So, through the REST API and not through any screen, a member may read and write
their own: `notes` (labelled "Staff notes" in the dossier and used by the
2026-07-30 migration to record an audit message about them), `tags`,
`contact_type`, `is_company`, `guardian_contact_id`, `date_of_birth` (which
drives the C10 minor rules), all six emergency-contact fields, `deleted_at`,
`display_code`, and the four riding-background fields.

On `profiles`, the same member may write every column except the six the
`profiles_role_guard` trigger covers — including `contact_id` (§U3),
`is_suspended` and `email`.

### What staff can do

| Actor | `contacts` read | `contacts` write |
|---|---|---|
| ADMIN / SUPER_ADMIN | whole table, via `contacts_select` (`is_admin()`) | whole table, via `contacts_admin_write` |
| MANAGER / EMPLOYEE | **nothing** through the table (`contacts_select` tests `is_admin()`, not `has_staff_access()`) | nothing through the table |
| MANAGER / EMPLOYEE | **all 66 columns** through `contact_dossier()` — `SECURITY DEFINER`, guarded by `has_staff_access()`, and its contact block is `to_jsonb(c)` | **36 columns** through `update_contact_record()` — same `has_staff_access()` guard |

```sql
-- has_staff_access()
SELECT app_role() IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')
```

The two `SECURITY DEFINER` RPCs therefore grant instructor/employee roles a
level of access to person records that the table policies deny them. No account
in production currently holds `MANAGER` or `EMPLOYEE` — all ten `profiles` rows
are `USER`, `ADMIN` or `SUPER_ADMIN` — so nothing exercises this today.

`contact_dossier` returns `to_jsonb(c)`, the entire row. The dossier UI renders
about 25 of the 66 columns; the remaining columns — including `zelle_phone`,
`zelle_email`, `correspondence_email`, `date_of_birth`, all `hide_*` flags and the
five community channels — are in the response payload but on no screen.

The `AccountInfoCard` header comment states `contacts_select` is "own-row-or-staff
only". The policy reads `is_admin() OR ((deleted_at IS NULL) AND (id =
current_contact_id()))` — own-row-or-**admin**; the widening to all staff happens
in the RPCs, not the policy.

### What the badges claim

| Badge | Where | Accurate? |
|---|---|---|
| "Visible to the community" | Profile section | Understates it — the same row is readable without a session (§U1) |
| "Visible only to French Heritage staff" | Account information section | The columns that card writes are absent from `member_directory` — but writing `phone` through it seeds four columns that are in it (§4.3) |
| "not editable" | Emergency contact block | True of that block; the field is writable by staff, by onboarding, and by the member's own API session (§6.4) |

---

## 9. Data-integrity facts observed in production

### 9.1 Three `profiles` rows violate two validated foreign keys

```
              email              |              contact_id              | contact_exists | auth_user_exists
---------------------------------+--------------------------------------+----------------+------------------
 zz-test-seller@example.invalid  | 48addb61-fa0a-4e01-a6f0-42a61b3f7547 |              0 | f
 zz-test-buyer@example.invalid   | 753f5b74-b1fd-4b33-8c3a-aaba1357d371 |              0 | f
 zz-test-cobuyer@example.invalid | 20ab79ef-5d77-4995-a724-f211e9146ef5 |              0 | f
```

Both constraints exist, are validated, and their RI triggers are enabled:

```
          conname          | convalidated | condeferrable
---------------------------+--------------+---------------
 profiles_contact_id_fkey  | t            | f

            tgname            | tgenabled | tgrelid
------------------------------+-----------+----------
 RI_ConstraintTrigger_a_18420 | O         | contacts
 RI_ConstraintTrigger_c_18422 | O         | profiles
```

`profiles_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE` is likewise
in place, yet `auth.users` holds 9 rows and `profiles` holds 10. I could not
determine how the rows came to violate the constraints; the state is verified,
the cause is not.

### 9.2 The platform-owner row holds a tenant contact

`admin@cactai.io` (`SUPER_ADMIN`, `org_id` NULL) has `contact_id` set to the
`CACTAI INC.` contact (`contact_type = TEAM`). `ensure_contact_for_profile`
explicitly denies that user id from acquiring a contact bridge:

```sql
c_denied_users constant uuid[] := ARRAY[
  'b45a5503-…',  -- admin@fhequestrian.com
  'fdbdfe89-…',  -- hello@fhequestrian.com
  '3c5d6af1-…'   -- admin@cactai.io (platform)
];
```

so the link predates or bypasses that guard. Because `org_id` is NULL,
`current_org()` returns NULL for this account and `contacts_org_boundary`
(`org_id = current_org()`) matches nothing.

### 9.3 Contact-type distribution

```
 contact_type | is_company | count
--------------+------------+-------
 CONTACT      | f          |    14
 LEAD         | f          |     5
 TEAM         | f          |     3
 TEAM         | t          |     1
```

There are no `DIRECTORY` rows.

---

## 10. Relationship to `docs/reference/IDENTITY_MODEL_DESIGN.md`

Read first, as instructed. Not re-litigated. Where findings touch it:

**State of the phased build — none of P1–P5 exists yet.**

```sql
SELECT (SELECT count(*) FROM information_schema.columns
         WHERE table_name='contacts' AND column_name='is_tenant')       AS is_tenant_col,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_name='contact_affiliations')                        AS affil_table,
       (SELECT count(*) FROM pg_indexes
         WHERE indexname='one_company_contact_per_org')                  AS old_index;
--  is_tenant_col | affil_table | old_index
-- ---------------+-------------+-----------
--              0 |           0 |         1
```

`is_tenant` is absent, `contact_affiliations` is absent, and the
`one_company_contact_per_org` index the design marks as DROPPED is still present.

**Consistent with the ratified model:**

- "People and companies are both contacts" already holds structurally —
  `is_company` is an ordinary boolean on `contacts` (14 CONTACT + 5 LEAD + 3 TEAM
  persons, 1 TEAM company).
- P3's directory migration has an empty input set today: 0 rows carry
  `contact_type = 'DIRECTORY'`.
- The design's "member profile → the person" resolution matches what
  `member_directory` does: it joins `profiles → contacts` on `p.contact_id` and
  returns the person.

**In tension with the ratified model, as findings:**

- The design makes edge creation **staff/admin-only**, calling a self-declared
  company association "the abuse vector". The finding in §U3 is that a member can
  already rewrite `profiles.contact_id` on their own row — the same class of
  self-declared identity link, on the anchor the affiliation edge would hang off.
- The design routes "everything meaning the org's own company" through a single
  `is_tenant` marker. `ensure_contact_for_profile` currently hard-codes three
  user UUIDs in a `c_denied_users` array to express the same idea, and
  `admin@cactai.io` holds a company contact anyway (§9.2).
- The design states "every listing is a company, but no company auto-lists".
  `member_directory` today has the opposite property for people: nothing opts a
  person in and nothing lets them opt out of the legacy `email` / `mobile` /
  `whatsapp` columns (§5.4), and the five new channels are auto-populated by
  trigger (§4.3).

---

## 11. What I could not determine

1. **Whether the anon-readable views are reachable over HTTPS in production.**
   I proved the `anon` role reads all six `member_directory` rows at the
   database. I could not issue the HTTP request: the local `.env` and the
   committed `dist/` bundle both carry `https://placeholder.supabase.co`, so I
   had no production URL or anon key. The bridging step — that PostgREST serves
   `public` as `anon` for an unauthenticated request — is stated as an inference
   in §0, not as something I observed.

2. **How the three `zz-test` `profiles` rows came to violate two validated,
   enabled foreign keys.** The violation is verified; the mechanism is not.

3. **Whether a member can discover another person's `contacts.id`.** I checked
   `document_parties` (own-row only under simulation) and `member_directory`
   (returns `user_id`, not `contact_id`). I did not sweep every table with a
   `contact_id` column against every RLS policy, so I cannot say the identifier
   is undiscoverable — only that I did not find a path.

4. **How `{{PARTY.*}}` tokens actually reach a rendered lease.** They resolve
   through `fill_party_fields_from_contacts` into `contract_field_defs`, not
   through template bodies. I confirmed that function reads
   `c.address_composed`, `c.phone_display`, `c.email`, `c.first_name`,
   `c.last_name`; I did not trace the field-def side, and `ClauseDocument.tsx` is
   frozen and out of scope.

5. **Whether the 13 accountless contacts' `hide_*` flags were set deliberately.**
   The correlation with "has no account" is exact, which reads as a backfill, but
   I found no migration line that sets them and did not search the full migration
   history for one.

6. **Browser behaviour.** Everything in §7 was counted from the routing and
   component source. I did not run the app or click through it.

7. **Whether any MANAGER/EMPLOYEE account has ever existed.** The RPC-vs-policy
   permission gap in §8 is structural. Production currently holds none, and I did
   not examine the audit log for historical role assignments.
