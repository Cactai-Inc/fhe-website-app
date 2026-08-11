# TASK-ROSTERCARD — report

Branch `task/rostercard` (worktree off `origin/main` @ `2f5f5d2`). 2026-08-11. Not pushed.

## What was built

**`/app/admin` (`Admin.tsx`) now renders the roster as CARDS**, replacing the positional-row
build that `TASK-ROSTER` left held back on `task/roster` (unmerged, superseded per the owner's
2026-08-10 reversal). The isolated single-record view (profile block, danger zone, account tabs,
`PendingClientView`) is untouched except for widening two `kind === 'pending'` checks to also
cover the new `'contact'` kind.

### Data layer (`src/lib/admin.ts`) — types only, no RPC/migration touched

`ClientAccountRow` widened from 15 to the live 20 columns and `kind` widened to include
`'contact'`, matching `admin_client_accounts()` as already applied in production and reconciled
by `TASK-ROSTER` (`016c89c` on `main`). **This file had drifted**: `main`'s frontend type was
still the pre-`ROSTER` 15-column shape even though the RPC itself had already shipped 20 columns
— confirmed live via `pg_get_functiondef` and a `psql` call under a simulated admin JWT before
touching anything.

### The card (`src/components/app/RosterCard.tsx`, new file)

Every derivation the settled model calls for, and where each one is sourced:

| dimension | source | notes |
|---|---|---|
| **RING** | `client_id` + `kind` (already on the RPC) | gold = has a `clients` row, green = login with no `clients` row, grey = the bare `'contact'` arm. No extra query. |
| **BADGES** | `groups` table (`group_type`), direct read | Rider / Horse Owner. `contacts.tags` render separately, visually distinct (dashed border), never merged into this row. |
| **deal-only party** | `document_parties` existence, direct read | `kind === 'contact'` **and** has ≥1 document-party row. |
| **PAIR** | `contacts.guardian_contact_id`, direct read | both directions — dependent's card names the parent, parent's card names every dependent. |
| **NAMES (horses)** | `horses.current_owner_contact_id` / `.lessee_contact_id`, direct read | owned and leased kept as two separate lines; see the leasing-source finding below. |
| **COUNTS** | `order_count` (RPC) · `credits` (RPC, summed) · `services.RIDING_LESSON` (RPC) | zero omitted everywhere — a zero is noise. |
| **ACTIVITY** | `audit_logs`, direct read, batched by `user_id` | green dot at < 1hr; no signal at all (not "inactive") for a row with no `user_id`. |
| **FLAGS** | invite fields (RPC) + outstanding-docs + unpaid (direct reads) | actionable only — see the flag table below. |

`admin_client_accounts()` carries none of groups / guardian pairing / deal-party evidence /
horse names / activity — this is not a gap in the RPC, it was never meant to. TASK-ROSTERCARD is
explicit that this task does no database work, so all of it is read **directly**, under the same
admin RLS the RPC itself already requires (`is_admin()` on `groups`, `contacts`, `horses`,
`documents`; `has_staff_access()` on `document_parties`, `purchases`, `audit_logs` — all verified
live under a simulated admin JWT, not assumed). One batched round-trip per table, keyed off the
visible roster's `contact_id`/`user_id` lists — no N+1 per card.

### Retirement (ported from `task/roster`, mechanism only — not its row presentation)

- `ContactsPage.tsx`: `export const CONTACTS_PAGE_RETIRED = true`, same comment/placement as
  `task/roster`'s version. `ContactsPage`/`DirectoryPage`/`LeadsPage` all still exported —
  nothing deleted, per the standing `86a2c33` rule.
- `App.tsx`: `/app/ops/contacts` redirects to `/app/admin` when the flag is true; old links land
  on the winning page instead of 404ing.
- **`AppLayout.tsx` NOT touched** — UIBUILD owns it and is active in it (constraint). The nav
  change this retirement needs is one line: `AppLayout.tsx:288`,
  `{ to: '/app/ops/contacts', label: 'Contacts', icon: Contact },` inside `ACCOUNTS_GROUP`, needs
  the same guard `task/roster` used —
  `...(CONTACTS_PAGE_RETIRED ? [] : [{ to: '/app/ops/contacts', ... }])` — plus the
  `CONTACTS_PAGE_RETIRED` import. **Reporting this rather than editing it, per the task's own
  instruction.** Until it lands, the nav item is a live link to a page that immediately bounces
  to `/app/admin` — harmless, not broken, just one extra hop.

## Verified — reconciled against direct SQL, not assumed

Population: `admin_client_accounts()` returns **15** rows under a simulated admin JWT — **5
account, 9 pending, 1 contact** — matching `TASK-ROSTER-REPORT`'s reconciliation exactly (15
CONTACT + 6 LEAD + 4 TEAM = 25 total contacts; LEAD/TEAM excluded, confirmed absent from the
RPC output).

**Four card shapes, each cross-checked field-by-field against `psql`:**

- **Rider — Madeline Do** (`account`, gold ring). Badge: Rider only (`groups = {RIDER}`).
  Counts: 9 lessons (`services.RIDING_LESSON`), 0 orders, 0 credits (all correctly blank, not
  zero-printed). No flags: not in the outstanding-docs set, not in the unpaid set. Activity:
  `user_id ac3aecb9…`, last audit row 2026-07-10 — stale, no green dot, exact timestamp shown.
- **Horse owner — CJ Z** (`account`, gold ring). Badges: Rider + Horse Owner
  (`groups = {HORSE_OWNER,RIDER}`). Owns: Beaumont de Cactai, Peep Show (`horses.current_owner_
  contact_id`, 2 rows) — leases none. `services = {}` today, so no lessons count (a real zero,
  not a bug: he hasn't consumed a riding-lesson event). **Two flags fire, both confirmed against
  source**: *Documents outstanding* (4 `AWAITING_SIGNATURE` rows, own + party grain) and *Unpaid*
  (one `awaiting_payment` purchase, $420). Activity resolves to his **client-side** `user_id`
  (`0a7fc801…`, last 2026-08-07) — not his separate staff/admin login (`b45a5503…`, a different
  `user_id` under the same name, excluded correctly because `admin_client_accounts()`'s arm 1
  filters `role = 'USER'`).
- **Dependent — Gabriella Olenik** (`contact`, grey ring — no `clients` row, the F1 gap case).
  Badge: *Deal-only party* (4 `document_parties` rows, no account, no clients row — the exact
  condition). No Rider/Horse Owner (confirmed zero `groups` rows for her). PAIR: **CLIENT ·
  DEPENDENT**, "Parent: Brian Olenik" — sourced from `contacts.guardian_contact_id`, the only
  populated guardian link in the org. No flags (her 4 documents are all past `AWAITING_SIGNATURE`/
  `DRAFT`, and the `not_invited` flag is scoped to `kind === 'pending'` only — see the open
  question below on whether a bare deal-only contact should carry one too).
- **Parent — Brian Olenik** (`pending`, gold ring — has a `clients` row, no login yet). Badge:
  Rider. PAIR: **CLIENT · PARENT**, "Dependent: Gabriella Olenik" (the reverse lookup — built to
  hold more than one name, only one exists today). Flag: **Not yet invited** —
  `invite_status IS NULL` confirmed (8 of the 9 `pending` rows have never had a matching
  `invitations` row at all; only Anita Tackette does, and hers is long expired). This is the
  single largest real finding on the roster right now: most provisioned clients were never
  actually invited.

**Tailwind classes built, not silently dropped.** This codebase has a documented failure mode
(`tailwind.config.js`'s own comments: `opacity: 64`/`bg-navfill/64` emitted *no rule at all*
before being declared as real theme values). Grepped the built `dist/assets/index-*.css` for
every non-obvious class the card uses (`ring-gold-600`, `ring-green-600`, `ring-gray-300`,
`ring-offset-2`, `ring-offset-white`, `border-dashed`, `ring-2`) — all present.

**Health**: `typecheck` 0, `typecheck:api` 0, `lint` 0 errors / 35 warnings (identical to the
pre-change baseline on this branch, stash-compared — no new warnings, none fixed), `build`
passes including prerender (the same two `<Navigate>`-in-`<StaticRouter>` warnings the ROSTER
report noted as pre-existing baseline, not new).

## NOT VERIFIED — no staff browser session (owner ruling 2026-08-10)

The render itself. Everything above is the RPC output, the direct-query results, and the built
CSS, proven against `psql` and the production bundle — not a screenshot, not a click-through. I
did not build a psql-snapshot-through-real-components harness for this thread; the SQL-level
reconciliation above already accounts for every value each of the four named cards would show,
field by field, which is what a harness screenshot would additionally illustrate but not
additionally verify.

## Assumed / judgment calls — flagged, not silently made

- **The embedded-resource query** (`document_parties.select('contact_id, documents(status,
  deleted_at)')`) can't be exercised without a real session (the `.env` in this worktree is a
  placeholder — no anon key). Verified the underlying FK exists (`document_parties_document_id_
  fkey`) and that this exact embedding shape (`table.select('..., related:table(cols)')`) is
  already live elsewhere in this codebase, e.g. `src/lib/ops/api-documents.ts:25` selecting from
  the same `document_parties` table via its other FK. Not independently exercised this session.
- **Ring derivation.** The task doc states the three states without a literal predicate. An
  earlier exploration doc (`docs/tasks/TASK-ROSTER-one-people-page.md`) verified one against SQL
  same-day (`clients.client_since`/`.customer_since`, backfilled — 0 of 15 `clients` rows lack
  both, checked live) but left the bare-`'contact'`-arm case uncovered (that doc predates F1's
  widening being reflected in its own ring table). I closed that gap by reading `client_id`
  presence as the gold signal directly off the RPC (equivalent, since every `clients` row already
  carries one of the two stamps) and treating the bare `'contact'` arm as grey — the only
  remaining case once gold/green are assigned, and the closest state on this page to a lead
  (`LEAD` itself never appears in the roster's population).
- **"Client" as a fixed word in the PAIR badge**, not conditional on `client_id`. Gabriella (the
  one real dependent) has no `clients` row, so a literal `client_id`-gated "Client" badge
  wouldn't fire for her — but the owner's own worked example
  (`docs/tasks/TASK-ROSTER-one-people-page.md:192-193`) shows `CLIENT · DEPENDENT` for exactly
  her case. Read "Client" as the owner's chosen fixed replacement word for "Counterparty" in this
  pairing context specifically (his instruction was a direct substitution: *"we should just
  label them as CLIENT and also as DEPENDENT"*), not as a second, competing ring-style
  derivation. Real Rider/Horse Owner badges still render alongside it when they exist — nothing
  is masked, which was the original complaint about `COUNTERPARTY`.
- **Credits shown as a summed count** (total remaining units across all open credit lines), not
  itemized by name the way the row build showed them. The settled model's COUNTS line groups
  "orders · credits · lessons" as three numbers; if a single count isn't what's wanted, the
  itemized `{remaining} × {label}` data is already on `m.credits` and trivial to swap in.
- **Outstanding-documents flag is a partial signal, stated plainly.** `contact_required_
  documents` (the *assigned-but-not-yet-created* half of "outstanding") has RLS enabled with
  **zero policies** — deny-all for the `authenticated` role, confirmed live. The one RPC that
  computes real per-document completion, `contact_checklist(contact_id)`, is granted to
  `service_role` only, **not** `authenticated` — also confirmed live; calling it from the
  frontend would fail. `admin_client_documents(user_id)` **is** callable but only covers the 5
  `account`-kind rows (needs a `user_id`). Per the task's own "no database work" constraint I did
  not add a grant or a bulk RPC. What the flag actually checks: the contact's own `documents`
  table directly (`status IN ('DRAFT','AWAITING_SIGNATURE')`, own + party grain, RLS-readable by
  an admin) — this catches "started but not finished," not "required but never even generated."
  CJ Z's card is a real, live example of the flag firing correctly on data that exists.
- **Activity — actions, not sessions, per the settled model.** Source is `audit_logs` only, the
  same table the isolated view's Activity tab already reads directly. `bookings` carries no
  audit trigger (confirmed: 29 tables write to `audit_logs`, `bookings` is not one), so a client
  whose only engagement is booked lessons reads with no activity signal at all rather than a
  false "Active" or a misleading "Inactive." I did **not** union `bookings` in as an interim
  measure and did **not** add the missing trigger — both were named as the task's own options,
  and `TASK-BOOKFLOW` is where the owner said this is being addressed in full.
- **"Not yet invited" is scoped to `kind === 'pending'` only.** The bare `'contact'` arm
  (Gabriella today) gets no equivalent flag even though nobody has "reached out" to her either —
  she was never put in the provisioning pipeline at all. I left this unflagged because the
  settled model's five-item flag list doesn't name a bare-contact equivalent, and a deal-only
  party by design may never need an account. Flagging this as a judgment call rather than
  silently deciding it either way.
- **Leasing source: `horses.lessee_contact_id` stamp, not `horse_relationships`.** The
  exploration doc flagged these two as possibly disagreeing and asked to confirm before building.
  They do disagree on Beaumont de Cactai: `horse_relationships` carries three concurrent
  `active = true` `LESSEE` rows for it — one for the real lessee (`352c3898…`, backed by an
  `EXECUTED` `HORSE_LEASE_V2` document, matching the `lessee_contact_id` stamp) and **two for a
  contact_id that no longer exists in `contacts` at all**, referencing a `source_document_id`
  that doesn't exist in `documents` either — orphaned rows, most likely leftover from the
  synthetic demo data `TASK-ROSTER-REPORT` mentioned building through a temporary harness. Used
  the stamp (agrees with the one real, document-backed row; simpler; already a single value per
  horse) rather than `horse_relationships`. **Flagging the orphaned rows as a data-quality find**,
  not fixing them — out of scope, no database work.

## Constraints honored

- No database work — every gap above that would normally want a column, a bulk RPC, or a grant
  change was worked around by direct-reading existing tables under existing RLS, and reported
  rather than built around with a schema change.
- `task/roster` read for its aggregate handling (`admin_client_accounts`'s third arm,
  `document_count`/`order_count`/`credits`/`services`) and its `ContactsPage` retirement
  mechanism — both reused. Its `RosterRow`/`RosterHeader` positional-row presentation was **not**
  ported and **not** merged; `task/roster` itself is untouched.
- Not pushed.
