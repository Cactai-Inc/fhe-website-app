# TASK-STABILIZE — REPORT

**All four items are fixed and proven in a browser against the production database.**
Two of them turned out to be the same bug seen from two ends. One of them was not a
missing feature at all but two guards refusing a shape the owner needs, and one was
exactly as suspected.

Run 2026-08-22, 01:15–03:05 PDT. Branch `task/stabilize`, worktree
`~/Downloads/claude-code-repo/wt-stabilize`. Committed, **not pushed**. Three migrations
dry-run in `BEGIN … ROLLBACK` with the rollback proven, then applied to production.

| # | item | result |
|---|---|---|
| 1 | activation reports failure on success | **PASS** — root cause found and fixed; two fresh activations succeeded on the FIRST attempt |
| 2 | a "deal party" account category | **PASS, but the brief's premise was wrong twice** — see below |
| 3 | adding a horse for a client | **WAS BROKEN, now fixed** — verified absent in a browser first, then wired and proven |
| 4 | weekly riders never get their standing slot | **PASS** — same root cause as item 1; 28 standing sessions on the calendar, client side and staff side, zero spendable credits |
| 5 | typecheck 0 · lint identical to main · test/db diffed | **PASS** — see "Checks" |
| 6 | no new tables, no schema redesign, no second write path | **PASS** — three `CREATE OR REPLACE FUNCTION`s and four component edits |

---

## ITEM 1 — a party can finish activating and be told they failed

### PASS. The cause is one line, and it is not where WALK4 guessed.

WALK4 escalated this as "something client-side, after the successful
`redeem_contract_invitation` call, throws." It is the opposite: **the call never
succeeded, and the client-side error handler could not show why.**

**The cause** — `redeem_contract_invitation` opened with:

```
SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
IF NOT FOUND THEN RAISE EXCEPTION 'no profile for the signed-in user'; END IF;
```

**Nothing in the password-activation path creates that row.** `/api/register-invited`
creates the auth user; there are zero non-internal triggers on `auth.users` (verified);
`AuthContext` only SELECTs; `ensure_my_member_access` only touches `members`. The only
function in the database that inserts a profile for an invitee is `redeem_invitation` —
the COMMUNITY redemption — and a contract counterparty never calls it. So the very first
thing a brand-new counterparty did, ~300 ms after their account existed, raised and
rolled back.

**Reproduced against production, on WALK4's own identity**, before changing anything:

```
BEGIN;
DELETE FROM profiles WHERE user_id = 'e77e0852-…';           -- the state a new account is in
SELECT redeem_contract_invitation('<a live CONTRACT token>');
→ ERROR: no profile for the signed-in user
ROLLBACK;
```

The forensic trail agrees. For Walk4 WALKTEST:

| fact | timestamp |
|---|---|
| `auth.users.created_at` | 16:45:34.938 |
| `profiles.created_at` | 16:46:53.564 ─┐ identical to the microsecond, so ONE |
| `invitations.redeemed_at` | 16:46:53.564 ─┘ transaction wrote both |

Only `redeem_invitation` writes both of those in one transaction. So what WALK4 read as
"the first attempt had actually succeeded" was a **later** community-path self-heal
redeeming the invitation — the contract redemption itself never ran at all. That also
explains why that contact never got a `clients` row: `_ensure_client_account` sits
*below* the raise (**this is item 4**).

**Why the screen said nothing useful.** The catch branch read
`err instanceof Error ? err.message : 'We could not finish activating your account.'`
Every lib wrapper does `if (error) throw error`, and PostgREST errors are plain
`{ message, details, hint, code }` objects — never `Error` instances. So that branch
could only ever print its own fallback, which is the exact sentence WALK4 photographed.
The real message, `no profile for the signed-in user`, never reached the screen or the
report.

### The fix

1. **`redeem_contract_invitation` seeds the profile instead of refusing**
   (`20260822T0100`). Not a second write path — it is `redeem_invitation`'s own insert,
   in the same shape, under the same `app.allow_profile_link` guard, using the
   invitation's `org_id` (without which the `profiles_link_contact` trigger inserts a
   contact with a null `org_id` and aborts). The raise is kept for the genuinely
   impossible case.
2. **`Register.tsx` surfaces the real reason** through the existing `toErrorMessage`
   helper, which exists for exactly this and was not being used here.
3. **The dead-end retry now offers a way in.** Every branch reachable only by someone
   whose account *does* exist — the endpoint's 409 ("an account already exists for this
   email"), its 404 (the invitation is spent, which on this screen almost always means
   they spent it a moment ago), and any post-sign-in failure — now renders a **Sign in**
   link inside the error box, carrying the same `from` state a contract party needs to
   land back on their document.

### The test

Two fresh contract parties, created through the real staff UI (contract → Parties &
Horse → Edit → "or add by email…" → Send → Send to Lessee only), then activated at
`/activate?token=…&kind=contract` in a clean browser context:

| | first attempt |
|---|---|
| `cjzigs+stab-party-1787389379@icloud.com` | **succeeded** — landed inside the app on the contract, welcome tour showing. `redeem_contract_invitation` → 200 |
| `cjzigs+stab-weekly-1787390195@icloud.com` | **succeeded** — landed on `/app/contracts/375efff8-…`. `redeem_contract_invitation` → 200 |

Neither screen contained the string "could not finish activating". Afterwards, for the
first: `invitations.status = redeemed`, profile created, **clients row created**, and
`contact_required_documents = 0` (correct — a counterparty owes no onboarding paperwork;
PARTYROLE's explicit `'{}'` branch is untouched).

The old failure path is no longer reachable to reproduce deliberately, because the
condition that caused it (no profile row) is now handled rather than refused. The retry
screen was therefore exercised through its other entrance — a second submit on a spent
invitation — and the sign-in link is present and correct there.

---

## ITEM 2 — a party whose only relationship is the contract

### PASS, and two things in the brief were not true.

**First: a fourth category already existed.** `CLIENT_CATEGORIES` in `src/lib/admin.ts`
has read `Guest | Rider | Horse owner | Deal client` since CAREPATH, and
`ProvisionClientForm` renders all four. 'Deal client' maps to the `GUEST` token, and a
code comment records the owner's PARTYROLE ruling for why: *"a deal client is your
client, arriving at the property, and signs what any guest signs."*

That was put to the owner rather than guessed. **His ruling, 2026-08-22:**

> "Do not touch 'Deal client', it keeps its PARTYROLE meaning unchanged… Do not add a
> fifth token either. An account gets tags that ENABLE an action, never OBLIGATE one on
> their own… For a party who signs nothing but the contract: select ZERO categories, not
> a new one."

So: no new token, no `DEAL_PARTY`, no schema change, no group type, no
`category_document_requirements` row. Nothing about 'Deal client' moved.

**Second: selecting zero categories was not already working.** The ruling also said
*"this case is already working; it was never blocked."* Half of that is right and half is
not, and the difference is the whole item. `apply_category_documents` does no-op on an
empty array (rule 1a, verified) — but **three guards upstream of it refused an empty
selection outright:**

| guard | what it did |
|---|---|
| `ProvisionClientForm` submit button | `disabled={… \|\| categories.length === 0}` — physically unclickable |
| `provision_client_invitation` | `RAISE EXCEPTION 'at least one category is required'` |
| `api/admin-send-invitation` | `provisioning = categories.length > 0 \|\| offeringIds.length > 0` — an empty selection fell into the PLAIN branch: a bare `invitations` row with **no contact, no clients row, no account** |

And a fourth trap sat underneath them: `_ensure_client_account` **defaults** an empty
category array to `ARRAY['GUEST']` and then, for a contact it has just created, calls
`apply_category_documents` with it — so simply removing the guards would have silently
assigned Company Policies, Facility Rules and the General Release to the one person who
owes none of them.

### The fix (four small changes, one per guard)

1. `provision_client_invitation` — the raise becomes a `v_no_cats` flag
   (`20260822T0120`). Nothing downstream that would default an empty set to GUEST reads
   it any more: the linked-contact branch skips `apply_category_documents` entirely
   (passing an empty array there is *not* a no-op — with no categories it falls back to
   reading the contact's existing groups), and `_ensure_client_account` is called with an
   **explicit empty `p_template_keys`**, the documented `'{}'` branch that inserts
   nothing and deletes nothing.
2. `ProvisionClientForm` — the submit button no longer requires a category, and a line
   of copy under the checkboxes makes the empty state read as a choice:
   *"**No service category.** Leave these unticked when this person's only relationship
   with us is a contract — they aren't visiting, riding or boarding a horse. They'll get
   an account and no onboarding paperwork; the contract carries its own signing gate."*
3. `api/admin-send-invitation` — a new explicit `provisionClient` flag, sent **only** by
   `ProvisionClientForm`, whose whole purpose is creating a client account. The other two
   zero-category callers keep the plain path unchanged: `Admin.tsx` re-mints a link for
   someone already provisioned, `TeamPage` invites staff.
4. `src/lib/admin.ts` — the flag on the typed input, with the reasoning.

### The test

**In the browser**, on the real staff form at `/app/ops/accounts/new`: with a fresh email
and **nothing ticked**, the copy renders, the button reads `CREATE & SEND INVITATION` and
is **enabled**, and the submit produced an invitation and an activation link
(`i2-02-zero-categories.png`, `i2-05-result.png`).

**In the database**, `provision_client_invitation` called exactly as the endpoint calls
it, dry-run and rolled back:

```
zero categories → contact created, clients row 1, required_docs 0, groups 0, categories NULL
ARRAY['GUEST']  → COMPANY_POLICIES, FACILITY_RULES, RELEASE_GENERAL   (unchanged)
```

**One honest gap.** `api/` runs as Vercel functions; local dev proxies `/api/*` to the
deployed production build, and there is no service-role key on this machine, so the
endpoint half of change 3 **could not be executed locally** — it is proven by the RPC
dry-run above plus `tsc -p tsconfig.api.json` clean, and goes live on the next deploy.
Until then, a zero-category submit on production still takes the plain branch and the
account materialises at activation instead of at invite time (the item-4 change makes
even that produce a `clients` row). The three `cjzigs+stab-dealparty-*` invitations in
the purge list below are exactly that shape.

**`/sign/deal`** was checked and needed no change: it mints a CONTRACT invitation, whose
redemption already calls `_ensure_client_account` with an explicit empty
`p_template_keys` — no category, no documents. Proven live: the two parties activated in
item 1 finished with **0** `contact_required_documents`.

**Visibility** needed no new mechanism, and none was built. The member nav is already
presence-driven (`my_nav_presence`): My Orders appears only with purchases, My Stable
only with horses, My Documents only with documents. A contract-only account sees My
Documents and nothing else of that set.

---

## ITEM 3 — adding a horse from a client's own record

### It was broken. Verified in a browser first, as instructed, then fixed.

**Verification, against production, before any change.** Opened a real client's dossier
and walked every tab it has — Overview, Bookings, Documents, Orders, Payments, Activity.
**Zero add-horse controls of any kind on any tab.** The Overview's "Horses" block and the
Documents tab's "Horse records" card are read-only lists, and the card is worse than that:

```
if (horses === null || horses.length === 0) return null;
```

A client with no horse yet — precisely the client staff need to add one for — saw
**nothing at all**. The only creation path was the separate Horse Records page, which
starts from the horse rather than from the person.

### The fix — the smallest gap, wired to the functions that already exist

`ClientHorseRecordsCard` now renders whenever the fetch has resolved (still `null` while
in flight, so it doesn't flash an empty state over data about to arrive), carries an
**"+ Add a horse"** button, and says "No horse on this client's record yet." when empty.
The button opens **the same `HorseIntakeForm`** the Horse Records page opens, with
`ownerContactId` preset to this client — the one `create_horse_record` intake path, which
already honours `owner_contact_id` for staff. **No new function, no new RPC** (D18).

### The test

From a client's own record → Documents tab → **+ Add a horse** → the modal opens with
**"ASSIGN THIS HORSE TO AN ACCOUNT"** already preset to that client → filled and
submitted → `create_horse_record` → 200.

```
horses.id                    3ab75c1d-b454-47dd-8b18-3f5a30b2b4ed
current_owner_contact_id     6cc4cb7d-…  (the client whose record we started from)
```

The horse appeared **on that client's record immediately** (the card reloaded and now
shows it with its completeness badge, `i3-fix-04-after.png`) and **on the horse's own
record** at `/app/horses/3ab75c1d-…`. (The horse is named "N/A" only because the test
script ticked the intake's own N/A boxes after typing a name — a script artefact, not a
product one.)

---

## ITEM 4 — a weekly rider never gets their standing slot

### PASS. Same family of cause as item 1, and the brief's narrowing was right.

`_ensure_client_account` **is** the function that creates the `clients` row, and it is
already called from `provision_client_invitation`, `redeem_gift`,
`ensure_gift_buyer_account` and `redeem_contract_invitation`. Two holes, not one:

1. **The contract-party shape.** `redeem_contract_invitation` calls it — but the call
   sits *below* the profile raise from item 1, so for a brand-new counterparty it was
   **unreachable**. Fixing item 1 fixes this outright.
2. **The community shape.** `redeem_invitation` never called it at all. It builds the
   profile, promotes the contact, grants membership, and stops;
   `promote_contact_to_account` only ever inserts a `clients` row by *copying* one off a
   contact it is dissolving, so a first-time account gets none.

Measured on production before the change: of every non-staff account, **exactly one**
contact had no `clients` row — Walk4 WALKTEST. Everyone else was staff-provisioned, which
is why this stayed invisible: it only opens for someone who becomes an account without
staff provisioning them first.

### The fix

`redeem_invitation` now calls `_ensure_client_account` (`20260822T0110`) with an explicit
empty `p_template_keys`, so redemption never changes a document set staff already decided.
Staff invitations are excluded (`invited_role = 'USER'`) — an operator is not someone we
serve, and a `clients` row would put them in the booking form's CLIENT dropdown. Swallowed
on error, exactly as the contract redemption already does, so a fully activated account is
never rolled back over a provisioning nicety. **No second spine.**

**D23 is untouched.** Nothing here mints a credit. A `clients` row is an identity fact.

### The test — both shapes, both sides, in the browser

**Shape A, contract-party path** — `add_document_party_by_email` → invite → activate:
`clients` row present immediately after activation, twice.

**Shape B, community path** — dry-run, rolled back, on the same contact:

```
CONTROL (today's redeem_invitation):  clients_row 0 · docs 4
FIXED   (with the migration):         clients_row 1 · docs 4    ← documents unchanged
```

**Then the whole weekly-rider journey, live, as the newly activated party**
(`cjzigs+stab-weekly-1787390195@icloud.com`): Catalog → Riding Lesson → **2x Weekly
Lessons $880/mo** → BOOK IT → GO TO CHECKOUT → CONTINUE TO YOUR ORDER → full onboarding
wizard (details, all four documents signed, payment step) → **step 5, Your weekly time**:

```
Tuesdays 16:00 + Thursdays 17:00
POST …/rpc/set_my_standing_schedule → 200
"Riding Lessons — Tuesdays at 4:00 PM and Thursdays at 5:00 PM are yours, every week
 until you tell us otherwise. 28 sessions already on the calendar · held through 2026-11-20"
```

That is the exact call WALK4 got `400 "not your plan"` for.

**Staff side**, on the same client, from the dossier's own control
(Records → All → the contact → OPEN FULL RECORD → Orders → **THEIR STANDING WEEKLY TIME**
→ Change the day and time): set **Wednesdays 10:00 AM + Fridays 11:00 AM** →
`set_my_standing_schedule` → **200**, panel re-read the new pair. That is the exact call
WALK4 got `400 "no client for purchase item"` for.

**On the calendar, and D23 honoured:**

```
Thu 17:00 ×14 · Tue 16:00 ×14      = 28 bookings, 2026-08-25 → 2026-11-26
lesson_credits: 4 rows, credits_total 28, credits_remaining 0     ← no spendable credit
```

**The manual-booking dropdown**, Calendar → Calendar item → Session → CLIENT (REQUIRED TO
BOOK): the client is listed — **"STABTEST STABTEST · CLI-000256"**, first in the list.
WALK4's "absent from the client dropdown" is closed.

---

## Checks

| check | result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **0 errors** |
| `tsc --noEmit -p tsconfig.api.json` | **0 errors** |
| `eslint .` | **46 problems (0 errors, 46 warnings)** — byte-identical to `main` |
| `vitest run test/db` | **46 failed / 30 passed (76)** on this branch and **46 failed / 30 passed (76)** on `main`; the failing-file lists diff **identical**. Baseline held, not improved (not this task's job) |
| migrations | all three dry-run in `BEGIN … ROLLBACK`; function definitions md5-compared before and after the rollback and **identical**, then applied |
| function grants | unchanged by `CREATE OR REPLACE` — verified `proacl` after apply |

---

## Things found on the way that are NOT this task

1. **`my_property_term()` does not exist in production.** Every authenticated page load
   404s on it. `AuthContext` catches and falls back to "FACILITY", so it is cosmetic —
   but TASK-FACILITYTERM's migration was never applied. Its fix lives in an unmerged
   branch; not applied here, because applying another thread's migration mid-task is
   exactly what the brief rules out.
2. **`redeem_invitation` carries an `anon` EXECUTE grant.** Pre-existing, and inert (the
   function raises without `auth.uid()`), but it is the same shape SECFIX has been
   closing elsewhere. Left alone; flagged.
3. **The onboarding wizard resets to step 1 on any fresh page load** — WALK1/WALK2's
   F-11/F-19, reproduced again here. Not touched.

**Nothing in these four items needed the ground-up rebuild's scope.** Every fix was a
`CREATE OR REPLACE` of a function that already existed, or a component edit. No new
table, no schema change, no new identity model, no second write path.

---

## Every row this session created (purge list — nothing deleted, per D11/D16)

| type | id | note |
|---|---|---|
| invitation ×3 | `bff5cd74…`, `1fd62001…`, `1ec9ca5f…` | `cjzigs+stab-dealparty-*`, zero-category test invites, **still `sent`**, bare rows with no contact (the pre-deploy API shape — see item 2) |
| contact | `6cc4cb7d…` | `cjzigs+stab-party-1787389379@icloud.com` — item 1 / item 3 party |
| auth.user | `4fc5ac55…` | that party's account |
| invitation | `1713c46f…` | that party's CONTRACT invite, redeemed |
| horse | `3ab75c1d…` | "N/A", owned by that party — item 3's proof |
| contact | `b442080f…` | `cjzigs+stab-weekly-1787390195@icloud.com` — item 4 party |
| auth.user | `fc7f20ab…` | that party's account |
| invitation | `c5931279…` | that party's CONTRACT invite, redeemed |
| purchase | `ee1f48cc…` | 2x Weekly Lessons $880, cash-declared |
| documents ×4 + signatures ×4 | onboarding set for the item-4 party | Company Policies, Facility Rules, Participant Liability Release, Human Emergency Medical Auth v2 — **executed**, therefore never swept |
| bookings ×28 | on the item-4 party's client row | Wed 10:00 / Fri 11:00 after the staff change, running to 2026-11-26 |

**No real client's row was read for a write, and none was written.** Roster searches were
scoped by name/email to the test identities at every use. The contract used throughout is
`375efff8-…`, WALK4's own throwaway test document (never locked, never executed) — it now
carries the item-4 party as LESSEE.

⚠️ **28 test bookings are on the live calendar through November.** They are listed here
rather than deleted (D11/D16). Say the word and they go.

---

## Teardown

**Browser processes:** none left running — Playwright closed every context on script exit;
`ps` clean at report time.
**Dev server:** one `vite` on :5199, stopped at report time.
**Database sessions:** every `psql` call was a one-shot `-c`/heredoc; none left open.
**Tooling:** Playwright 1.62.1 installed worktree-local at `stabilize-tooling/` via
`npm install --no-save`, with a `.gitignore` containing `*`. The repo's own
`package.json` was never touched. A worktree-local `stabilize-tooling/vite.dev.config.ts`
(gitignored) added an `/api` proxy to production for the dev server; the committed
`vite.config.ts` is unchanged.
**Credentials:** `FHE_ADMIN_PASSWORD` read from `.env.test` into a Node process, never
printed or screenshotted. The two test parties' passwords live only in
`stabilize-tooling/state/`, gitignored. `.env` / `.env.local` (the local Supabase URL and
the public anon key, lifted from the deployed bundle) are gitignored and not committed.
