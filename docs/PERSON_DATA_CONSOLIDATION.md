# Person-data consolidation — the plan

Owner-approved 2026-07-30. This is the working spec for collapsing the person /
account split, fixing the three person-pages, and turning Inbound into a real
queue. Written before the build so each stage can be checked off and verified.

---

## The problem, stated once

A person's data lives in two tables and the app cannot agree which one is real.

- `contacts` — the person record. 16 rows, **10 of which have no login at all**
  (leads, counterparties, kiosk signers). Onboarding writes here. The contract
  party tokens (`LESSEE.ADDRESS` → `compose_address()`) read here.
- `profiles` — the account. 7 rows, bridged 1:1 to `auth.users`. **50 columns**
  mixing account concerns, person data, contact prefs and visibility flags.

**The live symptom the owner reported:** a member fills in their address on the
app profile page; it disappears from that page but later shows up inside a
contract. Cause: the profile page writes `profiles`, the contract reads
`contacts`, and the five `profiles` address columns have **zero writers** (0 of 7
populated, vs 12 of 16 on `contacts`).

### Why we merge onto `contacts`, not `profiles`

Merging into `profiles` would strand the 10 contacts with no `auth.users` row,
and `admin@cactai.io` is deliberately an account with **no** contact (D1: the
platform owner holds zero tenant rows). The tables are not 1:1 and cannot be.

**The rule:** `contacts` is the person. `profiles` is the account — auth bridge,
role, tour markers, community display. Nothing about a *person* lives on
`profiles` after this work.

---

## Field disposition

Verified population counts (n=7 profiles) in brackets.

**MOVE to `contacts` (person data on the wrong table)**
| Field | Now | Note |
|---|---|---|
| `address_line1/2`, `city`, `state`, `postal_code` | [0/7] | zero writers; `contacts` already has these + generated `address_composed` |
| `mobile` [1/7], `whatsapp` [0/7] | | `contacts` has only `phone` — add these |
| `preferred_contact` [7/7], `allow_sms`, `allow_call`, `allow_whatsapp`, `allow_whatsapp_call` | | how to reach the person |
| `social_*` (tiktok/instagram/facebook/linkedin) | | |
| `hide_email`, `hide_mobile`, `hide_whatsapp` | [0/7] | see Visibility below |

**STAY on `profiles` (genuinely account-scoped)**
`user_id`, `contact_id`, `org_id`, `role`, `is_admin`, `is_suspended`,
`display_name` [2/7], `avatar_url` [1/7], `bio` [2/7], `riding_level` [3/7],
`tour_seen_*`, `first_dashboard_at`, `welcome_removed_at`, `pending_email*`,
`old_email`, `created_from_request_id`, `title` [2/7], `pay_type` [0/7],
`staff_active`.

> `display_name`/`avatar_url`/`bio` are the *community persona* — deliberately
> distinct from legal name on `contacts`. A member may show "CJ" to the
> community while contracts say "Charles Zigmund".

**DROP (vestigial, no reader and no writer)**
- the 5 `profiles` address columns (superseded by `contacts`)
- `payment_reminders` — D9: no dunning email exists
- `profiles.first_name/last_name/phone/email` — **duplicated on `contacts` and
  already diverging in live data** (2 of 6 linked pairs disagree on last name,
  2 on phone). `contacts` wins; `profiles` keeps `email` only as the auth mirror.

---

## Visibility controls — enforced (corrected)

An earlier note in this doc claimed these toggles were decorative. **That was
wrong.** The audit searched `pg_proc` for functions reading `hide_email` and
found none — but the enforcement lives in a **view**, `member_directory`, which
was never checked. It has always worked correctly:

- `hide_email` / `hide_mobile` / `hide_whatsapp` null out the field, and
- force the corresponding `allow_sms` / `allow_call` / `allow_whatsapp` false, and
- collapse `preferred_contact` to `'none'` when it points at a hidden or empty
  channel — so a profile never advertises a route the member closed off.

`/app/members/:userId` (`MemberProfile.tsx`) is the surface that renders it.

**What S2 did break, and how it was fixed.** Once the account page began writing
these preferences to `contacts`, the view still read them from `profiles` — so a
member could tick "hide from community" and see nothing happen. Migration
`20260730102000` re-points the view at `contacts` for person fields while keeping
persona fields (`display_name`, `avatar_url`, `bio`, `riding_level`) on
`profiles`. Verified: view output byte-identical before and after (6 rows, 0
differing), and a simulated toggle correctly nulls email + mobile and forces the
allow flags false.

**The persona split is deliberate:** a member may show "CJ" to the community
while their contracts read "Charles Zigmund". Community identity lives on
`profiles`; legal identity lives on `contacts`.

**Staff-only vs member-visible** (the owner's ask) resolves cleanly once merged:
`contacts` = the full record, staff-visible, RLS-gated to staff.
`profiles.display_name/avatar_url/bio` = the member-visible persona.
Anything on `contacts` is staff-only unless explicitly surfaced.

---

## The three person-pages — real definitions

Today all three render the SAME component (`ContactDirectory`) over the SAME RPC
(`staff_contact_directory`), split by a client-side `mode` prop. Worse, "Lead"
is not a status — it is the *leftover* case:
`ContactsPage.tsx:51 → if (d.length === 0) d.push('Lead')`. A contact is a Lead
only because nothing else classified it. That is why the Leads page is not the
marketing list the owner wants.

Owner decision: **keep the pages separate, give each a real server-side
definition.** The owner's taxonomy (2026-07-30) has FOUR groups, and the key
distinction is that "Directory" is a **vendor/provider book**, not a catch-all
for "not a client":

| Page | `contact_type` | Who belongs |
|---|---|---|
| **Leads** | `LEAD` | Potential future clients — people we hold information about so we can reach out or run a campaign. **Not** directory entries. |
| **Contacts** | `CONTACT` | Internal people who are not part of the company: clients, members, horse owners, counterparties, family. The people the business **serves**. |
| **Team** | `TEAM` | The company itself — staff, internal accounts, the tenant org record. |
| **Directory** | `DIRECTORY` | External people and businesses that **provide** something: farriers, veterinarians, feed/supply companies, service providers, event organizers. The rolodex. |

The distinction that makes this work: someone we serve who hasn't bought yet is a
**LEAD**; someone who sells to us is **DIRECTORY**. Collapsing those into one
generic "external" bucket is what made the old pages ambiguous.

`contacts.contact_type` is the discriminator, and one row appears on exactly one
page. Applied seed (S1b): 12 CONTACT, 3 TEAM, 1 unclassified (NULL — surfaced
for a human decision, never guessed).

---

## Inbound — a queue, not a registry

`requests` (9 rows) carries three channels: `kiosk` (6), `booking` (3), plus web
forms. **8 of 9 are still `status='new'`, the oldest from 2026-07-14** — sixteen
days unactioned. That is the conversion loss the owner described, visible in the
data.

Inbound is *work*: it has a state machine and must reach zero. The person-pages
are *registries*: they are browsed and never empty. Rendering both with the same
page format is the root of the sprawl.

**Owner decision: an inbound submission creates a contact immediately**, flagged
`PROSPECT`, so there is one person record from first touch and the Prospects list
is a real marketing list. The request row remains the *work item*.

Build: aging + overdue signal, one-click convert (Prospect → Client), explicit
close states, and no silent "new" older than N days.

---

## Stages

Each stage: dry-run in a transaction → apply → verify with a query → commit.

- **S1** `contacts` gains the moved columns; backfill from `profiles` where
  `contacts` is null and `profiles` has a value. Non-destructive, additive only.
- **S2** Re-point all readers/writers at `contacts`. The app profile page
  (`saveMyContactPrefs`) writes `contacts` — **this is the owner's reported bug**.
- **S3** ✅ **Done.** All five input paths verified onto `contacts`:
  1. **Website form** → `submit_public_request` → `requests` → capture trigger.
     Verified live: a submission creates a LEAD with name, email and phone.
  2. **Onboarding intake** → `update_my_onboarding_profile` writes `contacts`
     (address, DOB, emergency contacts, riding background). The `profiles`
     UPDATE in the same function is names-only.
  3. **App profile page** → `saveMyContactPrefs` writes `contacts` (S2).
  4. **Staff lead/contact record** → `createContact` / `updateContact` on `contacts`.
  5. **Invite-to-activate / promotion** → `_ensure_client_account`,
     `admin_create_client`, `sign_release`, `ensure_contact_for_profile`.

  Gap found and closed: of the seven functions that create contacts, only the
  inbound trigger set `contact_type`. Everything else would have landed in the
  Unfiled banner — turning a deliberate "someone must decide" signal into
  permanent noise. Three triggers now file automatically
  (`20260730130000`): a default on insert, TEAM on staff-role link, and
  LEAD→CONTACT on becoming a client so the campaign list never advertises
  someone who already bought. An explicit `contact_type` from the caller always
  wins.

  Correction learned here: `is_company` does **not** mean "an organisation". A
  partial unique index (`one_company_contact_per_org`) permits exactly one per
  org — it is the tenant's own company record, so it files under TEAM. Vendor
  organisations are ordinary rows filed DIRECTORY by staff.
- **S4** Person-pages get real server-side definitions; `contact_type` becomes
  the discriminator; nav renames land.
- **S5** Inbound queue: auto-create contact as PROSPECT, aging/overdue, convert.
- **S6** ✅ **Done.** Dropped 20 duplicated person columns from `profiles`
  (50 → 30). Reader audit first: `member_directory` re-pointed in S2,
  `admin_client_overview` re-pointed here (it read `p.phone/p.mobile/p.whatsapp`
  off profiles), frontend confirmed clean.

  **Kept deliberately:** `first_name`/`last_name` (still read by several staff
  surfaces, and 2 of 6 linked pairs already disagree — picking a winner is a data
  decision, not a refactor, so it deserves its own stage) and `email` (the auth
  mirror used by the email-change flow, not a duplicate in the same sense).

---

## Where it landed

| | |
|---|---|
| Contacts filed onto a page | 18 |
| Unfiled (surfaced, not hidden) | 1 |
| Member directory rows | 6 |
| Inbound genuinely overdue | 3 |
| Contacts with an address | 12 |
| Person columns left on `profiles` | **0** |

Still open: the **name** consolidation (S7), and a click-through of the new
Inbound and person-pages — everything above is verified at the database and type
level, but the app has not been run.

## Known blockers

- **`cjzigs@icloud.com` is a genuine duplicate** (Charles Zigmund / CJ Z — same
  DOB 1986-01-20, same street address). It is the D1 test identity slated for the
  owner-run purge, and it is why **document supersession is currently broken**
  (0 rows marked superseded): the 07-29 re-signs landed on the live twin and
  could not see the 07-07 priors on the dissolved one. Recommend the purge
  resolves it; do not merge executed documents across that boundary.
- **`hello@fhequestrian.com` is NOT a duplicate** — it is the company contact
  (`is_company=true`) and Claire's personal contact sharing a shared inbox. D1
  working as designed. Must not be merged.
