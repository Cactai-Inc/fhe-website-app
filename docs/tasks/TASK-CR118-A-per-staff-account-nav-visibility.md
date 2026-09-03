# TASK-CR118-A — per-staff-account nav visibility, an Admin-nested account link, a Team-page control surface, and a self-protection invariant (DSNR profile: spec + build, one thread)

**Owner's words, verbatim — `docs/reference/CHANGE-ORDER-LEDGER.md` CR-118. Read it before anything
else.** The five requirements ORCH unbundled from it are restated there; treat CR-118 as the source,
this file as the charge.

## Why this is one ORCH-dispatched task, not a bundle
Bounded: one new DB shape, three existing files, one invariant. The design question — how a NEW
per-account nav config sits alongside the org-level `org_page_visibility` mechanism and the existing
`adminOnly` + `grantKeys` role gate — is answerable by reading those three mechanisms in the ONE file
that already contains them (`AppLayout.tsx`), not by reconciling separate subsystems the way SUPPLIES
or DASHBOARDS must. **Model: Opus · HIGH · thinking ON** — a real design decision, but self-contained;
not the cross-subsystem shape confusion Fable is reserved for (D45, MODEL-CHOICE-NOTES §SHAPE-BEFORE-FIX).

## Read first
1. `docs/reference/CHANGE-ORDER-LEDGER.md` CR-118 (this task's source) and CR-107 (the two-owner-account
   premise CR-118 just confirmed for B7 DASHBOARDS — read-only context, not yours to act on).
2. `src/components/app/AppLayout.tsx` in full — three existing visibility/gating mechanisms already
   live here, in this order of granularity: (a) `hasModule()` — tenant module on/off; (b) `adminOnly`
   + role (`isAdmin`) — static per-role gate; (c) `grantKeys` — a per-INSTRUCTOR unlock list that
   un-hides `adminOnly` items for that one person (search `grantKeys`, `:1605-1625`). **(c) is the
   closest existing precedent for "per-account" and the idiom to converge on or deliberately depart
   from — say which (D18).**
3. `docs/orch/RECONCILED-2026-09-02.md` rows **R2** and **Q7** (§1/§4): `isPageHidden` has one call
   site, `AppLayout.tsx` never reads `org_page_visibility` (14 of 25 pages drifted from the registry),
   **0 rows have `hidden_at` set today — live impact is nil.** These were queued for B10; **ORCH pulls
   them into this task** because they are the same file and the same axis of "what does this account
   see in the nav." **Decide, in the spec, whether org-level hiding (`org_page_visibility`) stays as a
   coarser layer under the new per-account config, gets superseded by it, or was never going to matter
   (0 rows) — do not silently pick one.**
4. `src/pages/app/ops/TeamPage.tsx` — the surface CR-118 puts the new control on (D20: this is the
   one roster). **Row Q11d rides along:** `run()` at `:195` still ends in `onChanged()`, which closes
   the panel before "Saved." can show (`:176-182`'s own comment says so) — fix it while you are in the
   file; it is 2-3 lines, no thread owns it, and ORCH-ROLE's own exception covers it.
5. `src/pages/app/AccountHub.tsx` — **read only what you need to add one row.** `NavRow`/`Row` idiom
   at `:175,201,231-238`. **Do not touch the existing rows** (My Stable, Boarding, Barn Ops, Employees)
   — **B5 SUPPLIES holds this file** for its own access-point rows (My Stable restructure, the new
   Company/Accounting rows from CR-112·A3) and is running concurrently. Add your one row, nothing else,
   and expect to rebase past whichever of you merges second.
6. `supabase/migrations/20260812T1600_pagevis_all_modules_and_page_visibility.sql` — the
   `org_page_visibility` shape and its `set_page_hidden` writer, as the pattern for whether a per-account
   table should be presence-means-hidden the same way, or the inverse (presence-means-configured, since
   this covers ORDER too, not just show/hide).
7. `CLAUDE.md` D17 (a nav row is a table row, not hand-written JSX — the CR85/FIX3 lesson `AppLayout.tsx`
   already carries scars from), D18 (converge on the incumbent), D35/D36 (ownership + disjointness),
   D45 (this file's own tier line is the model).
8. **Added by ORCH 2026-09-03, from B7 DASHBOARDS' hand-up (routed, not fixed there):** B7 is building
   an owner-only "company documents" page (separate from client documents, per CR-112·A1 #12) and needs
   a nav row for it. `AppLayout.tsx`'s `MANAGEMENT_GROUP` is still hand-written for a few rows (D17's
   own scar) — add the company-documents row as a proper `NavItem` while you are already reshaping this
   file's Admin section, not hand-written JSX. Confirm the exact route/label with B7 before adding it
   (`docs/reports/FHE-MGMT-DASHBOARDS-LEDGER.md`) rather than inventing one.

## The five requirements (from CR-118 — the spec's THE TEST is built from these)
1. The account-page nav link nests inside Admin, staff-side, in the persistent left rail (today it is
   a header dropdown item only, `AppLayout.tsx:1768` — decide whether it stays there too or moves).
2. That nested link shows ONLY on `admin@fhequestrian.com`'s login.
3. The whole Admin section is hideable, and IS hidden, on `hello@fhequestrian.com`'s login.
4. Team page gains a control: per staff account (every account, including the owner's own), which nav
   sections and which links within them are visible, and their order.
5. **Self-protection invariant, enforced server-side, not just in the UI:** no configuration state can
   hide, from `admin@fhequestrian.com`, (a) the account page, or (b) the account page's link to this
   same control surface. Write THE TEST as: attempt to persist a config that hides either from that one
   account, by every route the write RPC exposes, and confirm it is refused every time — not merely
   defaulted-around by the read side.

## Ownership (D35/D36) — this task holds
- **Files:** `src/components/app/AppLayout.tsx` (nav filter + Admin-nesting + Admin-section hide +
  R2/Q7's dead-registry-read fix, folded in) · `src/pages/app/ops/TeamPage.tsx` (new control surface +
  Q11d) · `src/pages/app/AccountHub.tsx` — **one new row only.**
- **DB:** one NEW per-account nav-config table (+ its RLS: an account reads its own row; only
  `admin@fhequestrian.com` / an owner role writes any row — spec decides the write-role test against
  what `isAdmin` already means here) + a read RPC + a write RPC carrying the self-protection guard in
  its body, not just at the call site.
- **NOT yours:** `org_page_visibility` / `set_page_hidden` (existing, read-only reference) ·
  `pageRegistry.ts` (read-only reference; do not add rows unless the new nav-config table needs a
  registry-shaped key, in which case say so as a finding, don't assume) · anything in `AccountHub.tsx`
  outside your one new row · `mod.*` module flags.

## What this is not
- Not the org-level visibility rebuild R2/Q7 originally implied on its own — that finding is now
  folded into this task's design question (§3 above), not a separate future thread.
- Not a change to who counts as staff, admin, or super-admin — `isAdmin`/`isSuperAdmin` are read, not
  redefined.

## THE REACH / THE TELL / THE TEST
Write these per `TASK-ROLE.md`'s DSNR anatomy: THE REACH = which of the three nav surfaces (desktop
rail, mobile drawer, header dropdown — `manageNavGroups` feeds all three per the file's own header
comment) this config must reach, and confirm it is all three, not one. THE TELL = what the owner sees
change: the Admin link's new nesting, `hello@`'s Admin section gone, the Team-page control's presence
and effect, "Saved." showing on Team page. THE TEST = the self-protection invariant's refusal, proven
by attempting to hide from `admin@fhequestrian.com` and confirming refusal, plus a WALKTEST as
`hello@fhequestrian.com` confirming Admin is absent end to end (not merely `display:none`).

## Merge lane
One task, one merge, after your own VRFY pass (D40: ORCH merges to `main`; this is a direct one-off,
report to ORCH for verification per the standing camera, ORCH-ROLE §4). Guest-facing: no. Staff-facing
nav change and a standard being set (per-account nav control) — render checklist up before merge
(ORCH-ROLE §6: staffing/visibility standards are the owner's to see first).

## Report to
`FHE-ORCH` (direct dispatch, not a bundle).
