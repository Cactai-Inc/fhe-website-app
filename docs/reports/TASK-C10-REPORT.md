# TASK C10 — Minor downstream rules: no outreach to minors, guardian-addressed delivery

Branch: `task/c10-minor-rules` · Worktree: `wt-c10` (off `origin/main` @ `42ebdc9`)
Date: 2026-08-04

## Scope delivered

One migration (predicate + guard trigger + two-row data fix + a staff-alert
wrapper), and edits to the three email-send boundaries plus the one
account-invitation boundary named in the task doc. `sign_release`, the kiosk
machinery, and `ClauseDocument.tsx` were not touched.

## 1. Re-verified the doc's discovery before writing anything

The task doc's "verified current state" was re-run against production
(`db.lrstswfxfsezdmvkvukc.supabase.co`) before any write, per session
discipline. It matched exactly:

```
                  id                  | first_name | last_name | date_of_birth |         email         |         guardian_contact_id          | signup_date
--------------------------------------+------------+-----------+---------------+------------------------+--------------------------------------+-------------
 3c23bb7f-bdce-4943-b40a-85cf41554491 | Gabriella  | Olenik    | 2013-03-31    |                        | 41c5dae9-fc73-4766-9173-6c27347c722c | 2026-07-26
 23dc8f83-a46e-4937-b7c5-78acc052e41b | Raymond    | Thicklin  | 2026-07-18    | rkthicklin@gmail.com   |                                       | 2026-07-18
 41c5dae9-fc73-4766-9173-6c27347c722c | Brian      | Olenik    | 2026-07-26    | brian@brianolenik.com  |                                       | 2026-07-26
```

Also confirmed: Gabriella is a party on exactly 4 EXECUTED documents (Facility
Rules, Company Policies, Human Emergency Medical Authorization v2, Participant
Liability Release), and `document_deliveries` has zero rows for her — nothing
has ever been sent to her, consistent with the doc's framing that her null
email is the only thing stopping delivery today.

## 2. Migration — `supabase/migrations/20260804150000_minor_delivery_guard.sql`

1. `is_minor_contact(p_contact_id uuid) returns boolean` — the canonical
   predicate, exactly the expression the doc specifies
   (`date_of_birth IS NOT NULL AND date_of_birth + interval '18 years' >
   current_date`), `coalesce`d to `false` for an unmatched id.
2. Data fix: `UPDATE contacts SET date_of_birth = NULL WHERE id IN
   ('23dc8f83-…', '41c5dae9-…')`, wrapped in a `DO` block that asserts via
   `GET DIAGNOSTICS` that the update touched **exactly 2** rows — aborts the
   whole migration otherwise, so a stale assumption can't silently do the
   wrong thing.
3. An invariant check (`DO` block) counting minor-DOB rows that still carry a
   non-null email — must be 0 after the fix, or the migration aborts before
   the trigger goes live.
4. `contacts_minor_no_email_guard_trg` — `BEFORE INSERT OR UPDATE ON
   contacts`, no column restriction (so it also blocks turning an existing
   emailed adult row into a minor via a `date_of_birth` update, not just a
   direct email-on-a-minor write). Raises the doc's exact message: `'a minor
   contact carries no direct email; put the address on the guardian record'`.
5. `notify_minor_delivery_skipped(p_org, p_link, p_names text[])` — a thin
   `SECURITY DEFINER` wrapper that `PERFORM`s `notify_staff('minor_no_guardian',
   …)`. Needed because every existing call site in this codebase invokes
   `notify_staff` only via `PERFORM` from inside another definer function —
   never directly from the API layer — and `notify_staff` itself is revoked
   from `public`/`anon` with no `service_role` grant. Matches the existing
   `log_mirror_delivery` / `log_evaluation_report_access` shape (a small
   definer wrapper the TS admin client calls via `.rpc()`).

### Dry-run, then apply

```
$ psql "$DB_URL"
BEGIN;
\i supabase/migrations/20260804150000_minor_delivery_guard.sql
SELECT id, first_name, last_name, date_of_birth, email, is_minor_contact(id) AS is_minor
FROM contacts WHERE id IN ('3c23bb7f-…','23dc8f83-…','41c5dae9-…') ORDER BY last_name;
ROLLBACK;
```
→ `CREATE FUNCTION` / `DO` / `DO` / `CREATE FUNCTION` / `CREATE TRIGGER` /
`CREATE FUNCTION` all succeeded; predicate output inside the transaction:

```
 first_name | last_name | date_of_birth |         email         | is_minor
------------+-----------+---------------+------------------------+----------
 Gabriella  | Olenik    | 2013-03-31    |                        | t
 Brian      | Olenik    |               | brian@brianolenik.com | f
 Raymond    | Thicklin  |               | rkthicklin@gmail.com  | f
```
`ROLLBACK` — confirmed by re-querying prod immediately after: original
uncorrupted-looking DOBs still present, `is_minor_contact` didn't exist yet.

Then a second dry-run proved the trigger rejects an email write on the real
minor (Gabriella), again inside `BEGIN;…ROLLBACK;` (a `SAVEPOINT` attempt hit
`ON_ERROR_STOP` and exited before the explicit `ROLLBACK` line executed, so I
separately re-queried live prod to confirm nothing was committed — it wasn't).

**Applied for real**: `psql -v ON_ERROR_STOP=1 -f
supabase/migrations/20260804150000_minor_delivery_guard.sql` — same six
statements, no errors. Live re-query after apply matches the dry-run table
above exactly (Gabriella `is_minor=t`, both corrected adults `f`).

**Live trigger-rejection proof (rolled back), against the applied schema**:
```
BEGIN;
UPDATE contacts SET email = 'gabriella@example.com' WHERE id = '3c23bb7f-…';
ROLLBACK;
```
```
ERROR:  a minor contact carries no direct email; put the address on the guardian record
CONTEXT:  PL/pgSQL function contacts_minor_no_email_guard() line 7 at RAISE
ROLLBACK
```

**Live `notify_minor_delivery_skipped` proof (rolled back)** — org resolved
from Gabriella's documents (`e656f20b-ef43-4725-9029-19e7f0190d9c`):
```
BEGIN;
SELECT notify_minor_delivery_skipped('e656f20b-…', '/app/ops/contacts', ARRAY['Gabriella Olenik']);
SELECT user_id, kind, title, link FROM notifications WHERE org_id='e656f20b-…' AND kind='minor_no_guardian';
ROLLBACK;
```
inserted 2 rows (org's two admin/co-admin users, matching the existing
notification-mirror pattern), title `Not sent — no guardian email on file:
Gabriella Olenik`, link `/app/ops/contacts` — then rolled back.

### Found and fixed mid-verification: a broader privilege exposure

After the first apply, I checked whether `service_role` (the only role the
API layer uses, via `getSupabaseAdmin()`) could actually call the two new
functions — and, while checking, found that this project's `public` schema
has a **default privilege** auto-granting `EXECUTE` on every newly created
function to `anon`, `authenticated`, and `service_role` (confirmed via
`pg_default_acl`, `defaclobjtype='f'`). My initial `REVOKE ALL … FROM public,
anon` (mirroring the `notify_staff` precedent) left `authenticated` — any
logged-in, non-staff user — able to call `is_minor_contact(uuid)` directly
and learn whether an arbitrary contact is a minor. Checked whether this is a
pre-existing pattern rather than something new: it is — `log_mirror_delivery`
(no explicit grants at all) is executable by both `anon` and `authenticated`
today, and `notify_staff` itself is executable by `authenticated` today too.
This is a systemic, pre-existing characteristic of the codebase's grant
model, not something introduced here, and fixing it project-wide is outside
C10's scope. I did tighten my own two new functions, since nothing in the
locked design calls for either to be reachable from a browser session (the
doc says "through the **existing admin client**" for the predicate) —
amended the migration file to `REVOKE … FROM public, anon, authenticated`
on both, then applied that corrected grant delta directly (function
privileges only, no data touched, fully idempotent). Verified end state:

```
 svc_is_minor | auth_is_minor | anon_is_minor | svc_notify | auth_notify | anon_notify
--------------+---------------+---------------+------------+-------------+-------------
 t            | f             | f             | t          | f           | f
```

**Disclosure**: production was therefore written to in two passes for the
grant statements — the migration file as committed reflects the final,
correct state (`FROM public, anon, authenticated`); production was brought
in sync with a direct follow-up `REVOKE/GRANT` (not a second migration file)
rather than re-running the whole script, since re-running would have hit the
data-fix block's row-count assertion a second time (0 rows would now match,
correctly aborting) — re-running was unnecessary noise once the corrected
grants were verified live. No data was touched by the correction.

## 3. Send-boundary edits (guardian substitution)

Shared logic added to `api/_lib/delivery.ts`:
- `resolveMinorRecipient(db, contactId)` — calls `is_minor_contact` via the
  admin client; if true, resolves `guardian_contact_id` → the guardian's
  `{email, firstName, lastName}`, or `{guardian: null}` when there's no
  guardian or the guardian has no email.
- `notifyMinorRecipientsSkipped(db, orgId, link, names)` — fires the wrapper
  RPC once with the full skipped list, no-ops on an empty list.
- `buildPartyCopyEmail` gained an optional `guardianRecipient` param: when
  set, the greeting names the guardian and the body reads "The document …
  for `<minor name>` has been signed and executed" instead of "Your
  document …". The PDF filename still uses the actual signer's (the minor's)
  name — unchanged, per the file's existing "signer-attributed" filename
  spec, which the doc doesn't ask to change.

**`deliverExecutedDocument`** (used by `api/deliver-document.ts` and the
in-process release-signing call): the per-party loop now calls
`resolveMinorRecipient` before using `party.contacts?.email`. Guardian found
→ send to the guardian's address with the guardian-addressed copy; no
guardian/no guardian email → skip (no send, no delivery row), collect the
name, and fire one `notifyMinorRecipientsSkipped` call after the loop.
`document_deliveries.recipient_contact_id` is unchanged — still the minor
party, per the doc ("the party is who the delivery is FOR").

**`api/deliver-documents.ts`** (multi-document, one email, default union or
targeted recipients): same `resolveMinorRecipient` call added per recipient,
placed *before* the `pending` fully-delivered check so an already-fully-
delivered minor doesn't spuriously trigger a skip-alert. Greeting/intro text
branches the same way (guardian-addressed vs. normal). Applies uniformly to
both the default party-union path and the `recipientContactIds`-targeted
path, since both build the same `byContact` shape.

**`api/deliver-evaluation-report.ts`**: only the internal contact-resolution
branch (`!toEmailInput`, i.e. no explicit `toEmail` was passed by the
caller) is guarded — matching the doc's own scoping of this file to lines
63–84. An explicitly-supplied `toEmail` (the `action: 'share'` flow, or a
caller-supplied override) is an operator/self-typed address, not a "resolved
recipient contact," so it's left alone, consistent with `admin-send-
invitation.ts`'s operator-typed-address path also being out of the item-4
guard list. Guardian found → send there, guardian-addressed intro naming
the minor. No guardian/no email → **no send at all** (this endpoint has
exactly one recipient, so there's no "skip and continue" available) — fires
the staff alert and returns `400 { error: 'recipient is a minor with no
guardian email on file' }` instead of the prior silent `'no recipient
email'` 400, without calling `log_evaluation_report_access` (no send
happened).

**`api/admin-send-invitation.ts`**: added a guard immediately after the
staff-auth check and before either the provisioning or plain-invite branch —
looks up an existing contact by the invite's `email` (same `ilike`/
`deleted_at IS NULL` pattern already used for the checklist lookup further
down), and if that contact is a minor, returns `400 { error: 'minors cannot
be invited to hold accounts; invite the guardian' }`. No guardian-redirect
built, per the doc ("reject only").

### Reasoned trace (no deployed preview exists — nothing below was executed as a live HTTP call or a real email send)

Using Gabriella (the only real minor with live document/party data) as the
concrete case:

- **`deliverExecutedDocument`**, called for one of her 4 executed documents:
  loop reaches her party row (not in `alreadyDelivered` — confirmed 0 prior
  rows). `resolveMinorRecipient` → `is_minor_contact` RPC returns `true` →
  looks up her `guardian_contact_id` (Brian's id) → looks up Brian's row →
  `email='brian@brianolenik.com'` (non-null) → returns `{guardian: {email:
  'brian@brianolenik.com', firstName: 'Brian', lastName: 'Olenik'}}`.
  `toEmail` becomes Brian's address; `buildPartyCopyEmail` renders "Hi
  Brian," + "The document `<title>` for Gabriella Olenik has been signed and
  executed…". `sendViaProvider` would fire to Brian's address — **not
  executed**. On a hypothetical successful send, the delivery row would
  still record `recipient_contact_id = Gabriella's id`.
- **`api/deliver-documents.ts`**, called with all 4 of her document ids
  (default union path): `byContact` includes her row; `pending` = all 4 (no
  prior deliveries); same `resolveMinorRecipient` resolution as above →
  `toEmail` = Brian's address, intro = "The signed documents for Gabriella
  Olenik are attached…". On success, 4 delivery rows would be written with
  `recipient_contact_id = Gabriella's id`, `is_mirror` unset (not a targeted
  send). **Not executed.**
- **`api/deliver-evaluation-report.ts`**: no evaluation report exists for
  Gabriella or any minor today (`SELECT … FROM evaluation_reports er JOIN
  contacts …` returned 0 rows) — the guardian-addressed path can't be
  exercised against live data. The mechanism is the same
  `resolveMinorRecipient` helper already proven live above for Brian/
  Gabriella, so I'm confident in the logic but stating plainly that this
  specific file's minor branch was reasoned, not exercised.
- **`admin-send-invitation.ts`**: the guard's true-branch is, by
  construction, currently unreachable against live data — the trigger
  applied in this same migration guarantees no minor contact can carry a
  non-null email, and the guard only matches an *existing contact found by
  email*. A contact found by email match therefore can never be a minor
  under the new invariant (verified: the migration's own invariant check
  found 0 such rows before the trigger went live, and the trigger prevents
  any future one). The check is still correct and required as defense-in-
  depth per the locked design (e.g. it would catch a contact the trigger
  hadn't yet covered, or a future relaxation of the trigger) — verified
  structurally: it calls the exact same `is_minor_contact` predicate already
  proven `true` for Gabriella and `false` for both corrected adults above.
  **Not exercised via a live HTTP call** (no deployed preview, and no live
  data can currently drive the reject branch).

## 4. Out of scope (per the locked design — logged, not built)

- Purge-routine guardian orphaning (what happens to a minor's records if
  their guardian contact is deleted/merged) — not addressed.
- Sign-start self-serve age screening (kiosk-side minor detection before a
  release is even signed) — not addressed; `sign_release`'s existing form-DOB
  validator is untouched, per the hard rule.
- Profiles-based reminder senders (`calendar-reminders`, `notifications-
  nudge`) — these resolve recipients via `profiles`, and a minor without an
  account is already incidentally unreachable there. Not touched.

## 5. Done-checks

- `npm install` (worktree had no `node_modules` — fresh worktree).
- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — **0 errors, 29 warnings**, matching the documented
  baseline exactly; none of the 29 warnings are in a file this task touched.
- Live proofs: see §2 (predicate outputs, trigger rejection, notify wrapper)
  and §3 (reasoned/live trace per send boundary).

## 6. Production writes (everything logged)

1. The one migration, `20260804150000_minor_delivery_guard.sql` — applied
   live via `psql -v ON_ERROR_STOP=1 -f …` (§2).
2. The two-row data fix (Raymond Thicklin, Brian Olenik `date_of_birth` →
   `NULL`) — inside that same migration, row-count-asserted.
3. A follow-up grant correction (`REVOKE … FROM public, anon, authenticated;
   GRANT … TO service_role;` on both new functions) — function privileges
   only, no data, applied directly and disclosed in §2 rather than folded
   into a second migration file, since it brings production in line with
   the single committed migration file rather than constituting a second
   independent change.

Everything else against production was either read-only (`\d`, `SELECT`,
`has_function_privilege`) or ran inside `BEGIN;…ROLLBACK;`/`SAVEPOINT` blocks
that were rolled back and independently re-verified as leaving no residue.

## Honesty notes

- Every command output quoted above is what was actually returned — nothing
  is asserted without the corresponding `psql` output shown or paraphrased
  faithfully.
- Two of the four guarded code paths (`deliver-evaluation-report.ts`'s minor
  branch, and `admin-send-invitation.ts`'s reject branch) could not be
  exercised against live data — no evaluation report belongs to a minor, and
  the trigger makes the invitation-guard's true-branch structurally
  unreachable today. Both are flagged explicitly above rather than implied
  to have been tested.
- No live email was sent by this task. All delivery-path reasoning in §3 is
  a traced read of the code against live contact/document rows, explicitly
  labeled "not executed" where that's the case.
- The grant-correction two-step (§2) is disclosed in full rather than
  presented as a single clean apply — production required a second, minor,
  non-data write to match what's actually in the committed migration file.
