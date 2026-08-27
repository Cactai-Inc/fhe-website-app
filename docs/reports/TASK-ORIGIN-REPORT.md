# TASK-ORIGIN — REPORT

Worktree: `~/Downloads/claude-code-repo/wt-origin` · branch `task/origin`
DB functions touched (⚠️ do not appear in `git diff`, named here per §10):
`add_lookup_value`, `update_contact_record`, `menu_inventory`, `staff_contact_directory`,
`admin_client_accounts`, `requests_capture_contact`, `_payment_settle`, `mark_purchase_paid`,
`grant_lesson_credit`.

Migration: `supabase/migrations/20260827T0900_the_three_things_he_must_log.sql` — written,
rollback-tested (`BEGIN; … ROLLBACK;`), applied to production, verified with direct SQL, committed
(`a5c62f78`).

---

## 0. STALENESS AGAINST THE SPEC'S OWN MEASUREMENTS

The spec's §2 counts (28 contacts, 21 clients) were measured 2026-08-26/27. Re-measured just before
building: **29 contacts, 22 clients** — one of each landed in the interim. Expected drift
([[fhe-verify-before-build-staleness]]); does not change the design.

## 1. THE OWNER'S SEED LISTS — HIS WORDS, NOT GUESSED

Asked directly, mid-build, per §4.1's own instruction ("ASK HIM FOR THE STARTING LISTS").

**client_origin** (6, + the existing Other-to-add-new escape): Google search, Google Maps,
Google Business Page, Apple Maps, Instagram, Facebook.

I proposed adding "Referral" and "Saw the facility" (his own earlier words, "a friend... a sign").
**He declined both, explicitly**: *"saw the sign is other, person is other, i need specifics so
checking the box doesnt help me. we arent dealing with high volume so i dont need to collect 500
checked boxes for saw the sign to know the sign is bringing in business."* Seeded exactly his list,
nothing added.

**contact_channel** (5, + Other): Website form, Text message, Phone call, Email, Walk-up.

A further ruling arrived on the channel list specifically: *"but the form submissions are self
evident because they are system captured and should self inform, the others are manual inputs we
need to log."* This is why `requests_capture_contact` stamps `contact_channel = 'WEBSITE_FORM'`
programmatically on a new lead (§5 below) rather than asking anyone to pick it — the other four
values are the ones a person actually logs.

## 2. THE BUILD

### §4.1/§4.2 — the columns and vocabularies
- `contacts.client_origin`, `contacts.contact_channel` — nullable text, no default. NULL means
  "not recorded yet" for all 29 rows on day one; **not backfilled** (§8 — that is his manual
  review session, the whole reason this ships first).
- `lookup_options` seeded with both keys, all `active = true`.
- **Not seeded:** an `OTHER` row. "Other (enter manually)…" is the existing
  `SelectOrOther`/`addLookupValue` escape (owner, 2026-08-25) — a UI affordance, never a stored
  vocabulary value.

### §4.2 — where they're settable
- **On the record, forever** — `ContactDossierModal.tsx` (`src/components/app/ContactDossierModal.tsx:339-346`),
  a new "Where they came from" block, two `OriginChannelSelect` controls
  (`ContactDossierModal.tsx:92-163`), saving through `updateContactRecord` exactly like every
  other field in the modal (`val`/`set`/`dirty` — no new state machinery).
- **At intake, for the one case the system can know:** `requests_capture_contact` sets
  `contact_channel = 'WEBSITE_FORM'` on a brand-new LEAD's INSERT only — never on the
  dedupe-match branch, so an existing contact's already-recorded (or deliberately blank) channel
  is never overwritten by a later request.
- **Origin is not asked on any public form.** The owner's own framing — "a way to **add info to
  every client record**" — and §6's "ONE WRITER" clause read together as: this is a staff
  data-entry field, not a visitor self-report. No question was added to any public form for
  either column. (Recorded reasoning, not left implicit — flagged for his awareness in case he
  wants it reconsidered later, though not asked as an open question since §7 doesn't list it and
  nothing in the transcript asked for it.)

### T4 — a deactivated code still renders its words
`listLookupOptionsAll()` (`src/lib/api.ts`, new) fetches a vocabulary **unfiltered by `active`** —
unlike every existing vocabulary fetch (`listLookupOptions`, `listHorseBreeds`, `listHorseColors`),
all three of which are active-only at the DB query. That existing pattern combined with
`lookupName`'s raw-code fallback is itself a latent bug for a retired value (confirmed in
`HorseRecordsPage.tsx:159-162`, not touched — out of scope, named here as a finding for later).
`OriginChannelSelect` and `RosterCard`'s `originLabel`/`channelLabel` both resolve display names
against the full list; the `<select>`'s **offered** options are filtered to `active || code ===
currentValue`, so a retired value still renders as its words when already on a record, but is not
offered as a new choice.

### §4.3 — a backfilled purchase needs an honest date
Confirmed by reading it: `revenue_summary` — the function an actual monthly report runs — filters
on `purchases.paid_at`, never `created_at`. `grant_lesson_credit` and `mark_purchase_paid` both
hardcoded `now()` for that column. Both gained an optional trailing `p_paid_at` /
`p_paid_at`/`p_confirmed_at` parameter (`_payment_settle` too, so a payment's own `confirmed_at`
never drifts from the order's `paid_at`). `created_at` is untouched — it correctly stays the day
the backfill was actually typed in.

Reachable from `GrantCreditDialog.tsx` — a new "When it happened" date field, shown for
handwrite/comp (the two modes that stamp `paid_at` immediately; a bill has none until settled),
defaulting to today so an ordinary grant is unaffected, with a backdated warning on the confirm
step (D19.1 — state it before doing it).

## 3. ⚠️ THREE ALLOWLISTS — AND A FOURTH RISK FOUND DURING THE FIX

**T1** — `add_lookup_value`'s hardcoded five-key list widened to seven (body-only change).
**T2** — `update_contact_record`'s `v_allowed` array widened (body-only change).
**T3** — `menu_inventory`'s `used_by` CASE widened for both new keys (body-only change).

**T4 (new, this task) — privilege regression from DROP + CREATE.** `staff_contact_directory` and
`admin_client_accounts` needed new OUTPUT columns, which Postgres refuses via
`CREATE OR REPLACE` ("cannot change return type of existing function") — same for
`mark_purchase_paid`/`_payment_settle`/`grant_lesson_credit`, which needed a new trailing
parameter (ORCHESTRATOR §3c: a new param **overloads** rather than replaces under
`CREATE OR REPLACE`, so this had to be `DROP` then `CREATE` regardless).

**Measured in a rolled-back transaction before touching production:** `DROP FUNCTION` +
`CREATE FUNCTION` resets the ACL to this database's default — `EXECUTE` granted to
`anon`, `authenticated`, `service_role` **and PUBLIC**, via what appears to be an
`ALTER DEFAULT PRIVILEGES` rule (proven, not assumed: revoking from PUBLIC alone left `anon` and
`authenticated` still holding EXECUTE — they came from a separate grant path). Three of the five
functions did **not** have that full grant set beforehand:

| function | before | after DROP+CREATE, uncorrected |
|---|---|---|
| `_payment_settle` | postgres, service_role only | + anon, authenticated, PUBLIC |
| `mark_purchase_paid` | postgres, service_role, authenticated | + anon, PUBLIC |
| `grant_lesson_credit` | postgres, anon, authenticated, service_role | + PUBLIC |

Uncorrected, this migration would itself have handed an internal payment-settling helper and two
staff/service-gated write RPCs to `anon`/`PUBLIC` — a privilege escalation shipped by the fix meant
to widen a menu. Corrected with explicit `REVOKE`/`GRANT` at the end of the migration, verified by
re-diffing `pg_proc.proacl` before and after: **exact match, zero drift**, both in the rehearsal
transaction and against production post-apply.

## 4. THE REACH

| | Where | Proof |
|---|---|---|
| Set/change it | `ContactDossierModal.tsx:339-346` (dossier save → `updateContactRecord`) | reachable from the expanding row on `/app/records/clients` (`Admin.tsx` → `RosterCard` → `onOpen` → dossier) and `/app/records/leads` (`ContactsPage.tsx`'s `ContactDirectory({mode:'leads'})` → same dossier) |
| Edit the lists | `/app/ops/admin/editor` → **Client Origin** · **Contact Channel** | `AdminEditorPage.tsx:76-78` calls `menuInventory()` and filters only `source === 'vocabulary'` — **no key-based allowlist**, so both new keys surface with zero UI work, exactly as §2 predicted. **No route added, no `pageRegistry` row added** — confirmed by `git diff` touching neither `src/App.tsx`/router nor `src/lib/pageRegistry.ts`. |
| Read the data | Clients tab (`Admin.tsx:869-876` filters, `:897-898` resolved labels into `RosterCard.tsx:270-273`) and Leads tab (`ContactsPage.tsx:374-384` filters, `:439-446` card display) | both origin and channel are a filter AND a visible line on every card |

**ONE WRITER, verified:** grepped for `client_origin`/`contact_channel` across the repo after the
build — the only `.eq`/`.rpc`/JSX write reference is `ContactDossierModal.tsx`'s two selects
(plus the trigger's system-set default). Nothing was added to `ProvisionClientForm.tsx`,
`ContactForm.tsx`, or the invite form.

## 5. FLAGGED, NOT FIXED (§7)

1. **Self-reported origin/channel on `/sign/*`** — not touched, per D22 §0. Not applicable here
   in any case: neither field is asked on any public form (see §2 above), so this doesn't newly
   arise from this task, but is named per the instruction.
2. **The referrer's name** — not built. A constrained list was asked for; free text is a separate
   request. `Referral` isn't even in the seeded list per the owner's own ruling (§1), so this is
   doubly out of scope right now.
3. **No metric, KPI, or dashboard tile built or touched.** The owner ruled the metric list is not
   ours to author (`04-OPEN-QUESTIONS.md` §3). This task's deliverable is the captured input only.
4. **(New finding, not in original §7)** `HorseRecordsPage.tsx:159-162`'s breed/color columns
   fetch active-only lists and fall back to the raw stored code for a deactivated value — the
   exact trap this task's T4 fix avoids for origin/channel. Not fixed here: out of scope (§8 rules
   out restructuring beyond T1/T3's named minimal changes), named so it doesn't get rediscovered
   as new news.

## 6. OUT OF SCOPE — CONFIRMED

- `clients.source` — untouched.
- No new page, route, or nav row — confirmed above.
- The 29 existing contacts — **not backfilled.** All `client_origin`/`contact_channel` are NULL.
- `menu_inventory`/`add_lookup_value` — no restructuring beyond T3's CASE and T1's two keys.

## 7. §9 — THE NUMBERED TESTS, EACH PROVEN

All proofs run against **live production** via `psql`, migration-mutating tests (`4`, `5`, `6`,
`7`, `9`) inside `BEGIN; … ROLLBACK;` so nothing persisted from the proof itself (§1's real seed
values are the only thing actually committed, via the applied migration).

**1. Both columns exist on `contacts`:**
```
 table_name |   column_name   | data_type | is_nullable
------------+-----------------+-----------+-------------
 contacts   | client_origin   | text      | YES
 contacts   | contact_channel | text      | YES
```

**2. Both `lookup_options` keys, seeded, all active:**
```
   lookup_key    |         code         |     display_name     | active | sort_order
-----------------+----------------------+----------------------+--------+------------
 client_origin   | GOOGLE_SEARCH        | Google search        | t      |         10
 client_origin   | GOOGLE_MAPS          | Google Maps          | t      |         20
 client_origin   | GOOGLE_BUSINESS_PAGE | Google Business Page | t      |         30
 client_origin   | APPLE_MAPS           | Apple Maps           | t      |         40
 client_origin   | INSTAGRAM            | Instagram            | t      |         50
 client_origin   | FACEBOOK             | Facebook             | t      |         60
 contact_channel | WEBSITE_FORM         | Website form         | t      |         10
 contact_channel | TEXT_MESSAGE         | Text message         | t      |         20
 contact_channel | PHONE_CALL           | Phone call           | t      |         30
 contact_channel | EMAIL                | Email                | t      |         40
 contact_channel | WALK_UP              | Walk-up              | t      |         50
```

**3. `menu_inventory()` returns both keys, neither `used_by` says "Horse intake · contracts":**
```json
{"label": "Client Origin", "total": 6, "active": 6, "source": "vocabulary", "used_by": "Contact & client record", "menu_key": "client_origin"}
{"label": "Contact Channel", "total": 5, "active": 5, "source": "vocabulary", "used_by": "Contact & client record", "menu_key": "contact_channel"}
```

**4. `add_lookup_value('client_origin', 'TikTok')` succeeds and inserts a row** (T1), in
`BEGIN; … ROLLBACK;`:
```json
{"code": "TIKTOK", "created": true, "display_name": "TikTok"}
```
Row count `client_origin`: 6 → **7**.

**5. `set_menu_value` switches an option off, before/after:**
```
   code   | active_before        code   | active_after
----------+---------------      ----------+--------------
 FACEBOOK | t                    FACEBOOK | f
```

**6. `update_contact_record` accepts both fields; values land ON THE ROW** (T2), in
`BEGIN; … ROLLBACK;`, against real contact `3c23bb7f-bdce-4943-b40a-85cf41554491` —
**stored values queried directly, not the RPC's return**:
```
 client_origin | contact_channel
---------------+-----------------
 INSTAGRAM     | PHONE_CALL
```

**7. `update_contact_record` still raises on a genuinely unknown key:**
```
ERROR:  field not_a_real_field is not editable here
CONTEXT:  PL/pgSQL function update_contact_record(uuid,jsonb) line 26 at RAISE
```

**8. A contact holding a deactivated code still renders that option's display name** (T4).
Code path: `listLookupOptionsAll()` (`src/lib/api.ts`) fetches unfiltered by `active`;
`OriginChannelSelect` (`ContactDossierModal.tsx:92`) and `RosterCard`'s `originLabel`/
`channelLabel` (resolved via `lookupName` in `Admin.tsx:897-898` / `ContactsPage.tsx:442-443`)
both resolve display names against that unfiltered list. DB-side proof: `FACEBOOK` deactivated
in test 5 above still carries `display_name = 'Facebook'` — the row a person's stored code
resolves against is never removed (T4's write-time-only validation, unchanged from the existing
`set_menu_value` contract).

**9. A purchase recorded with a June date reads as June, not today.** `grant_lesson_credit`
called with `p_paid_at = '2026-06-15T12:00:00-07:00'`:
```
        paid_at         |          created_at
------------------------+------------------------------
 2026-06-15 12:00:00-07 | 2026-08-27 04:05:15.44281-07
```
The exact query `revenue_summary` runs, narrowed to June 2026 vs. a window keyed to today:
```
 june_total | june_count      today_total | today_count
------------+------------    -------------+-------------
     320.00 |          1                0 |           0
```
`created_at` is genuinely today (when the backfill act happened); `paid_at` is genuinely June
(when the sale happened); the report reads the latter.

**10. Roster columns and filters; typecheck and lint clean.**
- `npm run typecheck` — **clean, zero errors.**
- `npm run lint` — **`0 errors, 48 warnings`, matching the documented main baseline exactly**
  (re-ran after `npm install`, since the fresh worktree had no `node_modules`).
- Filters' queries named: `Admin.tsx`'s `visible` memo (`m.client_origin`/`m.contact_channel`
  equality against `originFilter`/`channelFilter` state) and `ContactsPage.tsx`'s `visible` memo
  (`r.client_origin`/`r.contact_channel`, same shape).

**11. THE REACH, verified in source — see §4 table above.** No route added, no `pageRegistry` row
added (confirmed by diff scope: neither `src/App.tsx` nor `src/lib/pageRegistry.ts` appears in
the frontend changes).

**12. Renders are NOT VERIFIED by me.** Owner's checklist:

1. Open `/app/records/leads`, open any lead's record → "Where they came from" shows two selects,
   both showing "Not recorded".
2. Set Client origin to "Instagram", Contact channel to "Text message", Save. Reopen the record —
   both values persisted.
3. On the same record, open Client origin, choose "Other (enter manually)…", type "TikTok",
   click away from the field. It should resolve to a normal-looking "TikTok" option (not stay in
   free-text mode).
4. Go to `/app/ops/admin/editor` → Shared lists tab → confirm **Client Origin** and
   **Contact Channel** both appear, each already carrying your seeded values, each with a working
   Add/rename/on-off toggle.
5. Switch one Contact Channel option off in that editor. Go back to a record that already had it
   selected — it should still show that option's name, not go blank and not show a raw code.
6. On `/app/records/leads`, use the new Origin/Channel filter dropdowns at the top — filtering to
   a value should show only leads carrying it.
7. Repeat 6 on `/app/records/clients`.
8. Submit the public contact/enquiry form as a brand-new email address. Open the resulting lead's
   record — Contact channel should already read "Website form" with no one having picked it.
9. Open Lessons → Grant a credit → pick Hand-write mode → a "When it happened" date field should
   appear, defaulting to today; back-dating it should show a "Backdated" note on the confirm step.

---

## 8. TEARDOWN

No dev server, watcher, `vitest`, or long-lived `psql` session was started — every database check
in this task ran as a one-shot `psql` invocation and exited. Process census immediately before
filing this report:
```
$ ps aux | grep -iE "vite|vitest|psql|npm run dev|node.*wt-origin" | grep -v grep
(no output)
```
`npm install` ran once (the fresh worktree had no `node_modules`) and completed; nothing left
running.

**Worktree:** `~/Downloads/claude-code-repo/wt-origin`
**Branch:** `task/origin`
**Commits:** `a5c62f78` (migration) + this report's commit.
