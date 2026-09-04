# THE BOARD — what has right of way, right now

⚠️ **`ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state, written
down, so a fresh ORCH takes the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-04 · **FHE-ORCH-9 in the seat (handoff from ORCH-8: `orchestration/handoffs/active/FHE-ORCH-9.md`).** Four MGMT copies running (GRANTS furthest along, VRFY partial DOES-NOT-HOLD) · four ORCH one-off tasks in flight (CR-118/119/120 + GRANTS-C) · one owner product question open (provisioned-door delivery-hold, handoff §4). Pool wt-1…wt-17.

## THE PLAN OF RECORD — RECONCILED-2026-09-02.md §8, twelve bundles (ORCH adopts as written)
| Bundle | Tier | State |
|---|---|---|
| **B1 GRANTS + STALE** — ACL sweep of EVERY SECURITY DEFINER writer (`request_purchase_payment` anon CONFIRMED by ORCH) + stale comments + ledger-status headers | Sonnet · MEDIUM | **RUNNING** — `FHE-MGMT-GRANTS`, wt-1; section below |
| **B2 FUNNELDEBT** — F1–F4, F6, 3.2a, DEPENDENT; F3's CHECK constraint (781 rows CONFIRMED) + guardian. **F5/4.7 (display-name control) moved to B10** — its control lives on `AccountHub.tsx`, which B5 holds | Fable · HIGH design → builds | **CUT 2026-09-03 → `BUNDLE-FUNNELDEBT.md`, wt-9 + wt-10; prompt handed** |
| **B3 INROADS** — ONERAIL first, then the contract-entry matrix; research, no removal | Fable · HIGH | MGMT |
| **B4 SITE (FRONT)** — CR-106 analytics + audit, SITEPOLICY, `/visit` `/contact` indexability | Fable · HIGH architecture → Opus builds | MGMT — owner's stated priority; his inputs finish it, not start it |
| **B5 SUPPLIES** — CR-109/112 (+A1/A2), CR-110 access point, door naming | Fable · HIGH design | **RUNNING** — `FHE-MGMT-SUPPLIES`, wt-3; section below |
| **B6 REQUESTS + MONTH** — REQCARDS (§9 struck), MONTHEND, dossier tabs, dashboard inbox | Opus · HIGH | after the pending-bookings measurement (0 today — LIFECYCLE's "4 pending" was a rehearsal; MONTHEND premise must be re-stated) |
| **B7 DASHBOARDS** — CR-107, FIX6, plan revisit, global dashboard/element/report machinery (CR-112 §11–13); ENGINE CONTRACT first (B5 gates on it) | Fable · HIGH | **CUT 2026-09-03 → `BUNDLE-DASHBOARDS.md`, wt-7 + wt-8; prompt handed** |
| **B8 EDITOR** | Opus · HIGH | after B5/B6 |
| **B9 RECORD PAGE** | owner decision (M4) → Opus | after M4 |
| **B10 SMALL, UNCONTENDED** — one thread each | Sonnet/Opus · MEDIUM | dispatch alongside B1 |
| **B11 NOTIFY** — CR-113 + deliverability | Opus design → build | MGMT |
| **B12 OWNER** — checklists, inputs, rulings | — | the owner, at his pace |
| **Held** — CLNR-REPO-STATE (+ RUN-QUEUE retirement, test/db snapshot regen for H's assertion) | CLNR | when no build is mid-flight |
**Disjointness (ORCH):** B1/B10 share nothing with the design bundles; B5⊥B7 (B7 owns the engine, B5 consumes it); B2⊥B3 except `SignStart.tsx` deal branch (B3 owns it; B2 does not touch it); B2⊥B5 at the column level on `purchases` (payer vs horse attribution — separate migrations, names declared before applying); B2⊥B1: B1 holds ACLs + 5 comment lines (incl. `Onboarding.tsx:106-108/:621`), B2 holds bodies + the rest of `Onboarding.tsx`; B4⊥all. **MGMT copies may run B2, B3, B4, B5, B7 concurrently once in force.**

## PROCESS — 2026-09-03
- ⚠️ **Three of four batch-2 threads ignored their tree** (G in wt-1, H in wt-2, BANNEDWORDS on the canonical checkout). **Root cause found: the worktree rode OUTSIDE the paste block; the owner pastes only the block.** Fixed: the block now carries a third line `Worktree: wt-<n> · hand back to FHE-ORCH-7` (ORCHESTRATOR § THE PROMPT, TASK-ROLE §5).
- D42 was reverted (never in force); SIGNFLOW-D's citation of it is a dangling reference — CLNR note.
- ✅ **MGMT IN FORCE — D44 (2026-09-03).** First two bundles cut and handed: `BUNDLE-GRANTS.md` (wt-1 + wt-2) · `BUNDLE-SUPPLIES.md` (wt-3 + wt-4/5/6). Pool grown to wt-8. **Canonical-checkout writer: ORCH.**
- **FHE-ORCH-8 took over 2026-09-03** (handoff `orchestration/handoffs/active/FHE-ORCH-8.md`). Cut B7 `BUNDLE-DASHBOARDS.md` (wt-7 + wt-8) and B2 `BUNDLE-FUNNELDEBT.md` (wt-9 + wt-10); provisioned wt-9/10/11 (env pair + node_modules). **wt-11 allotted to GRANTS for its VRFY/WALKR** (its ledger asked). Bundle files now say "hand back to `FHE-ORCH`" — the standing thread answers whatever its number.
- 🔒 **D45 (2026-09-03, final wording): no thread dictates a tier — the spawning thread evaluates the work and decides, Fable when required, the weekly allowance as the constraint.** Seven Fable threads spent 30% in 9h; the owner is stopping and re-spawning the barely-started ones. Bundle 'Suggested model/effort' sections are suggestions only.
- ⚠️ **MGMT docs lane, loop finding #1:** both MGMT ledgers plan to reach `main` by fast-forward push of the bundle branch. `main` moved (f8b10c99, 2779ca2c) after both branched from a1c6c105 — a fast-forward is no longer possible, and D40 says ORCH is the one writer. **Ruling (ORCH): MGMT never pushes `main`; MGMT pushes its bundle branch; ORCH merges bundle branches into `main` (docs-only merges at each hand-back or on request).** GRANTS' board section is mirrored below by ORCH from `bundle/grants`. → MGMT-ROLE §10 wording to follow (SELF-IMPROVEMENT when the trial closes).
- **Open to the OWNER from SUPPLIES' ledger:** the numbered CR-112 suggestions list (items 1–8) that FHE-ORCH-7 handed and the owner answered in CR-112·A1 exists only in the owner's chat window. ORCH-8 does not have it. ✅ Owner pasted it; filed verbatim as **CR-112·A1·THE PROPOSED LIST** (this commit). SUPPLIES' INHERITED-UNKNOWN markers resolve against it. **CR-112·A3** (same day): vocabulary confirmed, escalation 5 struck; Admin gains Company + Accounting pages; Headquarters/G&A are Admin-only attributions.

## RESUME — what is true right now (2026-09-03)
- **`main` = `2779ca2c` at ORCH-8 takeover (this commit moves it), pushed, clean.** Merged and verified since: SITESEO · SIGNFLOW-G · SIGNFLOW-H; docs: SIGNFLOW-F specs · RANCHWORD-A spec (withdrawn) · TACKROOM · METHOD-MGMT · BANNEDWORDS audit · RECONCILED list. Gates: typecheck 0 · typecheck:api 0 · lint 45w/0e · build clean · test:api 7/7 · `test:db` red at baseline (proof of nothing).
- **Merged and VERIFIED this session (each has a `-VERIFICATION.md`):** LIFECYCLE · SIGNBOOK (after the fact) · SITECOPY-A/B · SIGNFLOW-A/B/C/D · LANDINGSIGNIN · SITESEO. Docs merged: SIGNFLOW-F specs (G+H) · RANCHWORD-A spec · TACKROOM handoff · MGMT-ROLE/VRFY/WALKR (not in force).
- **Owed:** `test/db` snapshot regen (H's assertion red until then) · the Pamela lease's next open (drops its four periods by the normal path).
- **Pool:** wt-1 GRANTS (MGMT) · wt-2 GRANTS tasks · wt-3 SUPPLIES (MGMT) · wt-4/5/6 SUPPLIES tasks · wt-7 DASHBOARDS (MGMT) · wt-8 DASHBOARDS tasks · wt-9 FUNNELDEBT (MGMT) · wt-10 FUNNELDEBT tasks · wt-11 GRANTS VRFY/WALKR. **Canonical-checkout writer (D40): ORCH.**
- **REQCARDS** still queued: option-set conversation happens HERE, then its DSNR fold — dissolves into the MGMT bundles.
- **CLNR-REPO-STATE** hold stands until no build is mid-flight.

### Docs tasks (D41: profiles, not roles) — ONE canonical-checkout writer at a time (D40)
`FHE-TASK-ONERAIL` (DSNR profile — rebase the stale spec) ·
`FHE-TASK-FUNNELDEBT` (DSNR profile — the SIGNBOOK fallout lane) ·
`FHE-TASK-SITEPOLICY` (DISCO profile — the POLICIESANDFAQ research; the two owner calls come to
ORCH) ·
`FHE-TASK-INROADS` (DISCO profile — fill the contract-inroads matrix from the database; research
only, NO removal/merge/convergence; `SIGNFLOW-E` withdrawn)

### New queue items out of wave 2
- ~~the Barn Ops wording call~~ ✅ **ANSWERED — D43: Ranch, everywhere (CR-108)**; the module
  name/bucketing goes through CR-109's review. Queue: `FHE-TASK-RANCHWORD` (DSNR profile → build;
  sweep copy, hold the hub name) then `FHE-TASK-TACKROOM` (DISCO profile; CR-109 — inventory
  what barnops/My Stable/gear/horse-supplies hold today, the reachability question, and the
  Horses·Gear·Supplies·Business + assignment/consumption model against the existing machinery).
- ~~Cursive-period defect~~ ✅ **RULED (CR-101·A1): no trailing period on a signature line.** Folds
  into the SIGNFLOW follow-up spec task with SIGNFLOW-F (one DSNR-profile task writes both specs).
- **Stale-comment batch grows:** Onboarding.tsx:106-108/:621 (payment step claimed live) joins D's
  three.
- **Spec corrections for the DSNR profile:** SITECOPY-B's false zero-consumers premise · SIGNFLOW-A's
  three (§7) · LANDINGSIGNIN §8.4's "cart has not moved".

### New queue items out of wave 1
- **`FHE-TASK-SIGNFLOW-F`** — the 3 remaining unnormalised address writers (ProvisionClientForm,
  ContractIntake, ContractPage). DSNR-profile spec first; **sequenced AFTER SIGNFLOW-C** (ContractPage).
- **D's §4/§5 leftovers** — 3 stale comments in other threads' files (exact replacements in the
  report) + the caller-less `authenticated` grant on both retired sign functions.
- **OWNER, from D's report:** (a) the redirect-vs-404 call on the two retired URLs — ten real people
  used the old link from something outside the repo; (b) render checklists for all three merges.
- **10 pre-D41 reports carry no VALIDATION block** (SIGNFLOW-B's CLNR finding) — SIGNSTRIP, SIGNDOOR,
  AR4, REAPER, MODAL2, CR85, BOOKS1, BACKDATE, ZELLECLOSE, WALLSYNC. Backfill audit queued.

### CR-110 — the pending MODULES ACCESS-POINT refactor (owner correction 2026-09-02)
Rail removal (FIX3) was half of a MOVE; the account settings page as THE access point for modules is
unbuilt and unspecced. **Bundle candidate for the MGMT trial** — it sits at the seam of CR-109 (where
Stable/Tackroom surfaces live) and the admin-refactor design; RECONCILE's list must carry it.

### TACKROOM's owner rulings (handoff §5) — needed before CR-109 can be shaped
See `docs/reports/FHE-DISCO-TACKROOM-HANDOFF.md` §5. Headline facts: every barnops table is EMPTY in
production; "depletion of on-hand" is implemented NOWHERE (consumption never touches `on_hand`); the
billing resolver cannot run for FHE (no default payer row); three vendor notions exist; My Stable
shows three empty lists; `horse_medications` is the only populated "supplies" (3 rows). The
convergence question is about SHAPE, not migrating data.
Also from RANCHWORD (optional): "affiliated barns" wording on ContactsPage:77 · contracts' "Barn Name:"
label (owner ruled "Nickname" for Records — follow in contracts?). And from SIGNFLOW-F: vet-premises
address fields left unshaped by design — want them shaped too?

### 🔒 HOLDS
- **Contract entry points (`/sign/deal` alignment, the three-state-door widening)** — HELD for the
  inroads research. The two D35-queued items behind SITECOPY-B/SIGNFLOW-B stand.
- **`CLNR-REPO-STATE`** — dispatch only when NO build thread is mid-flight (it moves files).
- **Owner's own diagnostics (block nothing):** A1 Vercel top-pages for `/ride`/`/shop`/`/membership` ·
  A2 GSC verify + performance (no `google-site-verification` tag exists) · B1 the Business Profile
  URL + socials for `seo.ts` `sameAs`.

## ▶ THE SIGNBOOK-FALLOUT LANE — queued for DSNR (handoff §2/§3, owner: "these are not small")
1. **F1** — an order submission sends TWO emails (activation + inquiry confirmation); collapsing them
   is subtractive against his own CAREPATH §C6 ruling — needs his call inside the spec work.
2. **F2** — `flush_held_executed_document_emails` 30-min backstop can split the one email into two.
3. **F3 · UPGRADED by ORCH verification: 759 live `status_events` rows** file booking events under
   `entity_type='offering'` — a mislabeled ledger plus the writer to fix.
4. **F4** — a member with no `clients` row cannot submit a booking request; nothing heals it.
5. **DISPLAYNAME, the unbuilt half (D39):** no `set_my_display_name` RPC, no control on the account
   page — the half the owner explained the field's purpose by.
6. **GUARDIAN** — `FINDING-the-guardian-declared-at-the-door-is-lost-at-provisioning.md`: minor spine
   works, the lead→client door drops the declared guardian; four revisions proposed, none built.
7. **`trg_seed_display_name` carries PUBLIC+anon EXECUTE** — inert (trigger function) but a false
   "anon absent" claim; one-line REVOKE.

## QUEUED BEHIND RUNNING THREADS (D35 — do not spec until the owner clears them to move)
- **Confirmation copy** (activate-THEN-sign, spam/address-book lines) — behind **SITECOPY-B** (owns
  `Confirmation.tsx`). ⚠️ Owner framing: account first, then documents; copy must not imply signing
  before activation.
- **Deal/guest doors aligned with the rider flow** (email-first, three-state door) — behind
  **SIGNFLOW-B** (owns `SignStart.tsx` + `Onboarding.tsx` inputs).

## PARKED, OWNER-PACED
- **The Casey Caddell 11-item backlog** — `OWNER-BACKLOG-2026-09-01-contact-form-and-the-casey-incident.md`;
  only item 4.7 (display name) is touched. He deferred the set.
- **Deliverability:** `email_sent` means provider-accepted, never delivered — a bounce webhook is the
  only real fix. Unowned.
- 🔒 **DO NOT ACTION:** the visit when-pickers (owner CUT them) · Charlotte Caddell (he is handling
  it himself).

## ROUTED, NEEDS A SPEC — not fixed at the pass
1. ⚠️ **`reap_expired_holds` carries `anon=X`** — an unauthenticated caller can execute a function
   that WRITES. **Not probed; probing executes a write on production.**
2. **`isPageHidden` has ONE call site and the nav never reads `org_page_visibility`** — ⚠️ **CR-85
   made this WIDER:** the tenant can now toggle Catalog/Messages and nothing happens.
3. **The dossier Orders tab settles through the union seam but offers no discount/comp
   affordance** — one additive edit, uncontended.
4. ⚠️ **`/api/expire-holds` was fixed; the four other scheduled endpoints have never been audited.**
5. **The `test/db` per-file triage** — 56 red files, each needing fix-or-retire **with the decision
   named** *(`ORCHESTRATOR.md`: a test is deleted only for a deliberately retired feature)*.
6. **(LIFECYCLE) a 1-hour reminder fires for an UNAPPROVED session** — pre-existing behaviour under
   a new name; product question.
7. **(LIFECYCLE) a client accepting a staff counter-time on an unpaid order lands `scheduled` with
   no payment request** — `request_purchase_payment` is staff-only.
8. **CR-116 — activate-then-review.** Fact-finding done directly by ORCH in conversation, 2026-09-03:
   `docs/reports/FHE-DISCO-CR116-HANDOFF.md`. Most of the described flow already exists (`Register.tsx`'s
   docs-needed routing, Onboarding's `details` review step, contact-wins prefill). The real gap:
   `promote_contact_to_account` never mirrors name onto `profiles` the way `update_my_onboarding_profile`
   does, and the no-docs branch skips the one screen that would trigger that mirror — so a lead promoted
   straight to a docs-free account lands on a dashboard with a blank name/greeting forever. Handoff
   names the scope question (fix the mirror · make review unconditional · both) for DSNR to settle.
   **Ready to dispatch as a DSNR-profile task** (`FHE-TASK-CR116-A`, prompt in the handoff's tail) —
   not contended with any live bundle.

## OWNER CHECKLISTS UNRUN — the half no thread can prove
`FIX1` §8 · `FIX2` §9 · **`FIX4` §11 (13 items, the biggest visual change)** · `CR85` §8 ·
`MODAL2` · `BACKDATE` §8 · `BOOKS1` §14 · **`LIFECYCLE` §8 (7 items — item 6 is the visible change: next month renders pending/orange)** · **`SIGNDOOR` — ⚠️ load `/sign/rider` and count the boxes;
"exactly two" is the whole task and only its own probe has tested it.**

## BUNDLE SUPPLIES — FHE-MGMT-SUPPLIES
*(MGMT edits ONLY this section — MGMT-ROLE §10. Ledger: `docs/reports/FHE-MGMT-SUPPLIES-LEDGER.md`.)*
**Bundle tree `wt-3` · branch `bundle/supplies` (from `a1c6c105`) · lane: door reshuffle + first sub-pages as ONE unit; spine migrations per task after VRFY · escalations 0/5 reached · last updated 2026-09-03**
| Tree | Thread | Branch | Profile · tier | Holds (DB objects / files) | State |
|---|---|---|---|---|---|
| wt-4 | `FHE-TASK-SUPPLIES-A` | `task/supplies-a` | DSNR · Fable HIGH | docs only: `docs/tasks/TASK-SUPPLIES-*`, `docs/reports/FHE-DSNR-SUPPLIES-HANDOFF.md`, own ledger/report. Read-only on prod. | **FIRED 2026-09-03** — specs + chunk declaration + escalation evidence |
| wt-5 | — | — | — | held for CODR | idle, detached |
| wt-6 | — | — | — | held for CODR | idle, detached |
**DB objects held by the bundle (declared in BUNDLE-SUPPLIES.md; nothing applied yet):** `resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` · `resolve_consumption_billing` · `billable_lines` (consumption source) · `stable_items` · `vendors` · `horse_medications` · `purchases`/`purchase_items` horse-attribution column only (exact column to be declared by the spec).
**Open to ORCH:** ORCH's numbered CR-112 suggestions list (A1 items 1,2,5,6,8; 7 absent) is not on file — record under CR-112·A1. **Gated on B7:** dashboard/projection/deviation/report consumers.

## ⚠️ CR-116 (activate-then-review) vs B2 FUNNELDEBT — ORCH's disjointness finding, 2026-09-03
`FHE-DISCO-CR116-HANDOFF.md` §5 says "not blocked on anything running — worth a fresh branch-diff check
at dispatch time (D35/D36), not assumed here." **ORCH ran that check. It IS contended.**
| CR-116-A would need | B2 FUNNELDEBT already holds |
|---|---|
| `promote_contact_to_account` body (the name mirror) | `redeem_invitation` body — **which calls `promote_contact_to_account`** (`20260802000001…sql:380`) |
| `Onboarding.tsx` `wizardSteps()` / routing | `Onboarding.tsx` "for the guardian path" (its charge file §8 names `:157-169`, `:488`) |
| `Register.tsx` `redeemByKind()` routing | — (uncontended) |
| `update_my_onboarding_profile` (reuse as the idiom) | — (uncontended) |
**They are the same defect class at the same seam:** *a value declared at the door is lost at
promotion.* B2's F6 is the guardian; CR-116 is the name. Both are fixed in the same call chain, in the
same migration file, on the same act. B2's own chunk **(G)** is literally "F6 guardian at the door
(`provision_client_invitation`, `redeem_invitation`, `Onboarding.tsx` guardian path)".
**ORCH's recommendation: FOLD CR-116 into B2 as item 9** rather than run a second DSNR thread on the
seam. It costs nothing today — **`wt-10` is still detached at `2779ca2c`, porcelain empty: `FHE-TASK-FUNNELDEBT-A` has NOT been launched.** MGMT re-issues one charge file.
**Owner's call.** If he dispatches CR116-A standalone anyway, the boundary is: CR116-A owns
`promote_contact_to_account`, `Register.tsx` and the name mirror; B2 owns `redeem_invitation`,
`provision_client_invitation` and `Onboarding.tsx`; neither designs redemption's shape without the other,
and the two specs come back to ORCH together before either builds.

## FHE-TASK-CR118-A — per-staff-account nav visibility (ORCH direct dispatch, 2026-09-03)
**Not a bundle.** `docs/tasks/TASK-CR118-A-per-staff-account-nav-visibility.md` · **wt-12** · Opus ·
HIGH · thinking ON (one line why: in the charge file) · DSNR profile, one thread specs and builds.
**Pulls R2 and Q7 out of B10** (same file, same axis — `AppLayout.tsx` never reads
`org_page_visibility`); **B10 SMALL, UNCONTENDED shrinks by three items (R2, Q7, Q11d).**
**Contends with B5 SUPPLIES (running) on ONE file:** `AccountHub.tsx` — this task adds exactly one new
row; SUPPLIES holds every other row in that file. Whichever merges second rebases past the other;
noted to SUPPLIES' ledger.
**Confirms for B7 DASHBOARDS escalation 1:** `hello@` and `admin@fhequestrian.com` are two real,
distinct logins.

## FHE-TASK-CR119-A — bill of sale co-buyer stuck election (ORCH direct dispatch, 2026-09-03)
⚠️ **First diagnosis was wrong, caught by the owner ("no such surface exits"), corrected same session
— see `THE FACT-FINDING STEP` note below and the ledger's corrected CR-119 entry.**
`docs/tasks/TASK-CR119-A-a-way-out-of-the-co-buyer-election.md` · **wt-13** · Opus · HIGH · ON.
**Real defect (confirmed against the template's own data, not re-guessed):** `HORSE_SALE_V2` renders
via `ClauseDocument.tsx` (clause-composed), never `ContractCascade.tsx`. `TXN.CO_BUYER_ENABLED`'s only
clause (`PARTIES.CO_BUYER_PENDING`) is visible only while the field is blank — answering Yes hides the
only control that could answer No. A true self-locking control.
**The live document, `80537662-7b4e-4adc-9ebc-49ed9d2bed78`, fixed DIRECTLY by ORCH** (rehearsed in a
transaction, rolled back, then applied for real): field cleared, body recomposed. Not the task's to
touch. **Durable fix target unchanged** — an explicit exit inside the co-buyer capture card
(`ContractPage.tsx`, not clause-gated). No file ownership conflict — `ContractPage.tsx` /
`ContractCascade.tsx` / `ClauseDocument.tsx` untouched by any running bundle.

## FHE-TASK-CR120-A — horse location gap, fact-find only (ORCH direct dispatch, 2026-09-03)
`docs/tasks/TASK-CR120-A-horse-location-facts.md` · **wt-14** · Opus · HIGH · ON · DISCO profile, no
build. ORCH's own check found something more serious than the owner's report: his newest horse has
NO location data anywhere in the DB (not a wrong-column problem — nothing captured), while the other
3 horses in production all carry one. Confirmed separately: `HorseIntakeForm.tsx` never normalizes
(zero `normalize(` calls). The "Other" dropdown claim does not match the component read so far
(`PrefixSelect` has no Other option) — routed to the task to trace properly, not re-guessed by ORCH
after the CR-119 miss. No file ownership conflict.

## BUNDLE GRANTS — FHE-MGMT-GRANTS (D44 trial · opened 2026-09-03 · ledger `docs/reports/FHE-MGMT-GRANTS-LEDGER.md`)
**Bundle tree `wt-1` · branch `bundle/grants` (origin/main e8bdb372 merged in) · merge lane: per task after VRFY — MGMT pushes `bundle/grants`, ORCH merges it to `main` (ORCH-8 docs-lane ruling) · hands back to `FHE-ORCH`.**
**DB objects held by this bundle: the ACL (`proacl`) of every SECURITY DEFINER function in `public` — never a body.**
| Thread | Profile | Tree | Branch | State |
|---|---|---|---|---|
| `FHE-TASK-GRANTS-A` | DSNR | wt-2 (returned, detached, clean) | `task/grants-a-spec` | **DONE — merged into `bundle/grants` 6ed5ff63** (docs only). Spec: `docs/tasks/TASK-GRANTS-B-close-the-anon-door-on-every-writer-nothing-anonymous-calls.md` · escalation list: `docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md` · handoff: `docs/reports/FHE-DSNR-GRANTS-A-HANDOFF.md` |
| `FHE-TASK-GRANTS-B` | CODR | **wt-2** | `task/grants-b` | **WAITING ON ESCALATION 1** (the Block A ruling). Sonnet · MEDIUM · thinking ON. Holds: the migration file + the four comment lines (`contact.ts`, `deliver-document.ts`, `Onboarding.tsx` ×2) |
| `FHE-TASK-GRANTS-V` | VRFY | **wt-11** (allotted by ORCH 2026-09-03) | — | after -B reports |
| `FHE-TASK-GRANTS-W` | WALKR | wt-11 (after -V) | — | at close, on `main` as deployed: the inbound request flow (contact form) · the sign-start flow · **`/redeem` as a recipient with no account** (added by -A's finding) — all as an anonymous visitor |
**Escalations: 1 of 1 ✅ RULED 2026-09-03 — CR-117** (ORCH; the owner: there is no anonymous user any more). **Block A REVOKE as one block · `submit_public_request` KEEP · `open_gift` REVOKE (the reveal is an email animation, not an anonymous page) · `redeem_gift` REVOKE.** ORCH's safety measurement: `gifts` = 0 rows in production. -B unblocked. ~~RAISED~~ — Block A (140 writers, none with an anonymous caller) as ONE block · confirm KEEP on `submit_public_request` and `open_gift` · `redeem_gift` recommended REVOKE. The ruling lands verbatim in `## RULING` of the ANON-WRITERS file; -B reads it there.
**GRANTS status 2026-09-04:** -A merged (6ed5ff63) · -B built (Sonnet, wt-2) · -V ran, verdict
**DOES NOT HOLD on one row** (item 6 edit 4, `Onboarding.tsx:625-628` — spec text 2 days stale;
`showShopStep`/`showTimeStep` unconditionally true since `f9c66b49`) · `TASK-GRANTS-C` (DSNR
amendment, Fable · HIGH — MGMT's own call) authored, **ORCH allots `wt-17`.**
⚠️ **Routed product question, confirmed real by VRFY + MGMT's own re-check (not resolved here):**
`holdMyDocumentDelivery` has exactly ONE call site, gated `!selfServe` — **the provisioned door has
no equivalent hold.** A staff-provisioned account's document-delivery email can go out before its
booking request exists. **ORCH-9's first act:** bring this to the owner with a recommendation
(extend the hold to the provisioned door, matching the self-serve gate, OR name why the asymmetry is
intentional) — see handoff §4.
**For ORCH (routed up, fixed by nobody here):** (1) ⚠️ **14 anon-executable writers have NO in-body guard** (`open_gift` · `reap_expired_holds` · `apply_offering_documents` · `apply_sign_path_documents` · `complete_deal` · `supersede_invitations` · `upsert_content_block` · … full list, -A handoff §5) — revoking `anon` shuts the door; any `authenticated` caller still reaches them unguarded. **A BODY finding for B2 FUNNELDEBT.** (2) 135 anon-executable definer READERS + 60 invoker non-trigger + 15 invoker trigger functions remain; a read-ACL sweep is a separate bundle (classification already in the ANON-WRITERS file). (3) `Onboarding.tsx:632` carries the same stale payment-step claim on a line the bundle does not name. (4) RECONCILED §8 row B1 lists 1.15 · 1.19 · §7.6, which `BUNDLE-GRANTS.md` does not carry. (5) Item 6 is FOUR comments, not five — `MergedBodyView.tsx` was already fixed by d78d3b3c.
**Item 7** (CHANGE-ORDER-LEDGER status headers CR-85/89/93/97): last, after ORCH is told.
## BUNDLE DASHBOARDS — FHE-MGMT-DASHBOARDS (opened 2026-09-03 · ledger `docs/reports/FHE-MGMT-DASHBOARDS-LEDGER.md`)
**✅ HAND-UP PROCESSED 2026-09-03 (`97bd5567`): engine contract STABLE, `bundle/dashboards` merged to
`main`.** `docs/design/DASHBOARD-ENGINE-CONTRACT.md` §9 is the consumer interface — SUPPLIES told
directly (its ledger). §9 marks `AWAITING B5 RECONCILE` — `FHE-DSNR-SUPPLIES-HANDOFF.md` §7 does not
exist yet on `main` or `bundle/supplies`.
**Routed items disposed:** `my_documents()` anon proacl → GRANTS' ledger (fold into its sweep, not a
new finding). `AppLayout.tsx` company-docs nav row → folded into `TASK-CR118-A` (§8, still unbuilt,
safe to amend — do not spec it twice). `api/deliver-report.ts` + `api/reports-monthly.ts` +
`scheduled-jobs.yml` line → **granted to DASHBOARDS**, added to `BUNDLE-DASHBOARDS.md`'s ownership.
AdminRegistryPage tenant-editor gap → evidence appended to CR-110 (B10/CR-118 future scope, not built
here).
**Trees: two more allotted, as asked — `wt-15` (E1/E2 lane) · `wt-16` (VRFY).** `wt-8` continues its
own internal sequencing (B → D → C), unchanged by ORCH.
| Tree | Thread | Profile · tier | State |
|---|---|---|---|
| wt-8 | `FHE-TASK-DASHBOARDS-B/D/C` | CODR · Opus HIGH ON | sequenced by MGMT, B then D then C |
| wt-15 | `FHE-TASK-DASHBOARDS-E1/E2` | CODR · Opus HIGH ON | allotted, awaiting MGMT dispatch |
| wt-16 | `FHE-TASK-DASHBOARDS-V` | VRFY · Opus HIGH ON | allotted, awaiting MGMT dispatch |

## FHE-TASK-CR119-A — bill of sale co-buyer stuck election (ORCH direct dispatch, 2026-09-03)
⚠️ **First diagnosis was wrong, caught by the owner ("no such surface exits"), corrected same session
— see `THE FACT-FINDING STEP` note below and the ledger's corrected CR-119 entry.**
`docs/tasks/TASK-CR119-A-a-way-out-of-the-co-buyer-election.md` · **wt-13** · Opus · HIGH · ON.
**Real defect (confirmed against the template's own data, not re-guessed):** `HORSE_SALE_V2` renders
via `ClauseDocument.tsx` (clause-composed), never `ContractCascade.tsx`. `TXN.CO_BUYER_ENABLED`'s only
clause (`PARTIES.CO_BUYER_PENDING`) is visible only while the field is blank — answering Yes hides the
only control that could answer No. A true self-locking control.
**The live document, `80537662-7b4e-4adc-9ebc-49ed9d2bed78`, fixed DIRECTLY by ORCH** (rehearsed in a
transaction, rolled back, then applied for real): field cleared, body recomposed. Not the task's to
touch. **Durable fix target unchanged** — an explicit exit inside the co-buyer capture card
(`ContractPage.tsx`, not clause-gated). No file ownership conflict — `ContractPage.tsx` /
`ContractCascade.tsx` / `ClauseDocument.tsx` untouched by any running bundle.

## FHE-TASK-CR120-A — horse location gap, fact-find only (ORCH direct dispatch, 2026-09-03)
`docs/tasks/TASK-CR120-A-horse-location-facts.md` · **wt-14** · Opus · HIGH · ON · DISCO profile, no
build. ORCH's own check found something more serious than the owner's report: his newest horse has
NO location data anywhere in the DB (not a wrong-column problem — nothing captured), while the other
3 horses in production all carry one. Confirmed separately: `HorseIntakeForm.tsx` never normalizes
(zero `normalize(` calls). The "Other" dropdown claim does not match the component read so far
(`PrefixSelect` has no Other option) — routed to the task to trace properly, not re-guessed by ORCH
after the CR-119 miss. No file ownership conflict.

## BUNDLE GRANTS — FHE-MGMT-GRANTS (D44 trial · opened 2026-09-03 · ledger `docs/reports/FHE-MGMT-GRANTS-LEDGER.md`)
**Bundle tree `wt-1` · branch `bundle/grants` (origin/main e8bdb372 merged in) · merge lane: per task after VRFY — MGMT pushes `bundle/grants`, ORCH merges it to `main` (ORCH-8 docs-lane ruling) · hands back to `FHE-ORCH`.**
**DB objects held by this bundle: the ACL (`proacl`) of every SECURITY DEFINER function in `public` — never a body.**
| Thread | Profile | Tree | Branch | State |
|---|---|---|---|---|
| `FHE-TASK-GRANTS-A` | DSNR | wt-2 (returned, detached, clean) | `task/grants-a-spec` | **DONE — merged into `bundle/grants` 6ed5ff63** (docs only). Spec: `docs/tasks/TASK-GRANTS-B-close-the-anon-door-on-every-writer-nothing-anonymous-calls.md` · escalation list: `docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md` · handoff: `docs/reports/FHE-DSNR-GRANTS-A-HANDOFF.md` |
| `FHE-TASK-GRANTS-B` | CODR | **wt-2** | `task/grants-b` | **WAITING ON ESCALATION 1** (the Block A ruling). Sonnet · MEDIUM · thinking ON. Holds: the migration file + the four comment lines (`contact.ts`, `deliver-document.ts`, `Onboarding.tsx` ×2) |
| `FHE-TASK-GRANTS-V` | VRFY | **wt-11** (allotted by ORCH 2026-09-03) | — | after -B reports |
| `FHE-TASK-GRANTS-W` | WALKR | wt-11 (after -V) | — | at close, on `main` as deployed: the inbound request flow (contact form) · the sign-start flow · **`/redeem` as a recipient with no account** (added by -A's finding) — all as an anonymous visitor |
**Escalations: 1 of 1 ✅ RULED 2026-09-03 — CR-117** (ORCH; the owner: there is no anonymous user any more). **Block A REVOKE as one block · `submit_public_request` KEEP · `open_gift` REVOKE (the reveal is an email animation, not an anonymous page) · `redeem_gift` REVOKE.** ORCH's safety measurement: `gifts` = 0 rows in production. -B unblocked. ~~RAISED~~ — Block A (140 writers, none with an anonymous caller) as ONE block · confirm KEEP on `submit_public_request` and `open_gift` · `redeem_gift` recommended REVOKE. The ruling lands verbatim in `## RULING` of the ANON-WRITERS file; -B reads it there.
**For ORCH (routed up, fixed by nobody here):** (1) ⚠️ **14 anon-executable writers have NO in-body guard** (`open_gift` · `reap_expired_holds` · `apply_offering_documents` · `apply_sign_path_documents` · `complete_deal` · `supersede_invitations` · `upsert_content_block` · … full list, -A handoff §5) — revoking `anon` shuts the door; any `authenticated` caller still reaches them unguarded. **A BODY finding for B2 FUNNELDEBT.** (2) 135 anon-executable definer READERS + 60 invoker non-trigger + 15 invoker trigger functions remain; a read-ACL sweep is a separate bundle (classification already in the ANON-WRITERS file). (3) `Onboarding.tsx:632` carries the same stale payment-step claim on a line the bundle does not name. (4) RECONCILED §8 row B1 lists 1.15 · 1.19 · §7.6, which `BUNDLE-GRANTS.md` does not carry. (5) Item 6 is FOUR comments, not five — `MergedBodyView.tsx` was already fixed by d78d3b3c.
**Item 7** (CHANGE-ORDER-LEDGER status headers CR-85/89/93/97): last, after ORCH is told.
## BUNDLE DASHBOARDS — FHE-MGMT-DASHBOARDS (cut 2026-09-03 · `docs/orch/BUNDLE-DASHBOARDS.md`)
*(MGMT edits ONLY this section on its bundle branch. Ledger: `docs/reports/FHE-MGMT-DASHBOARDS-LEDGER.md`.)*
**Bundle tree `wt-7` · branch `bundle/dashboards` · lane: B ENGINE first as one unit, then D→C (header lane) ∥ E1→E2 (registry lane) after VRFY each; STOP after E1 for Claire's Ops list; E3 last; F after escalation 4 · MGMT pushes the bundle branch, ORCH merges to `main` · escalations: 1 closed by evidence, 3 collapsed into 2, the rest SUMMONED 2026-09-03 (rulings pending) · last updated 2026-09-03**
✅ **ENGINE CONTRACT STABLE — `docs/design/DASHBOARD-ENGINE-CONTRACT.md` @ `9fcd6e6b` on `bundle/dashboards` (A's commit `44f7ec24`). B5 may spec against §9 now; consumer side marked `AWAITING B5 RECONCILE`.**
| Tree | Thread | Branch | Profile · tier | Holds (DB objects / files) | State |
|---|---|---|---|---|---|
| wt-8 | `FHE-TASK-DASHBOARDS-A` | `task/dashboards-a` (archived `archive/dashboards-a-2026-09-03`) | DSNR · Fable HIGH | docs only | **MERGED 2026-09-03** → `bundle/dashboards` @ `9fcd6e6b` (VALIDATION on its report) |
| wt-8 | `FHE-TASK-DASHBOARDS-B` | `task/dashboards-b` | CODR · Opus HIGH ON | `src/lib/dashboard/**`, `api-dashboard.ts`, `OwnerDashboard.tsx`, `TeamPage.tsx:255-300`, one migration, `test/db/dashboard_engine.test.ts` · **DB:** `dashboard_provisions`, `dashboard_element_config`, `my_dashboards`, `set_dashboard_provision`, `set_dashboard_default`, `my_element_config`, `set_element_config`, `set_element_default`, `period_bounds`, `set_dashboard_focus` (DROP+CREATE), DROP `profiles_dashboard_focus_chk`, `config_keys/values` rows (`OPS.TIMEZONE`, `DASHBOARDS.SHOW_EMPTY`), `lookup_options` rows (`dashboard_period`, `display_variant`), `add_lookup_value` allowlist | **DISPATCHED 2026-09-03** — awaiting owner launch |
| (asks ORCH) | `FHE-TASK-DASHBOARDS-D` then `-C` | `task/dashboards-d`, `-c` | CODR | D: `DashboardChrome.tsx`, `DashboardsPanel.tsx` (new), `OwnerDashboard.tsx` header, `TeamPage.tsx:255-300` · C: `reports` table + 6 RPCs, `src/lib/dashboard/{reports,reportBody,csv,reportFiles}.ts`, `GenerateReportModal.tsx`, `CompanyDocumentsPage.tsx`, one `App.tsx` route line, one `pageRegistry.ts` row | waiting on B's merge (+ rulings 5 for C) |
| (asks ORCH) | `FHE-TASK-DASHBOARDS-E1` then `-E2` | `task/dashboards-e1`, `-e2` | CODR | E1: registry E1 block, `TrainerZones.tsx`, `SalesZones/MarketingZones/charts/*` (new), `dash_money`, `sales_*`, `marketing_*` RPCs · E2: registry E2 block, `AdminDeskZones.tsx`, `admin_*` RPCs | waiting on B's merge (+ rulings 2/6 for E1's content) |
| (asks ORCH) | `FHE-TASK-DASHBOARDS-V` / `-W` | — | VRFY / WALKR · Opus HIGH ON | — | V after B's report; W at close |
**Cross-bundle contention declared:** `registry.ts` — B5 will append its block; contract §9 prescribes one fenced block per bundle (ORCH to tell MGMT-SUPPLIES). `pageRegistry.ts` — one-row appends by C and by B5/CR-110 (additive).
**Open to ORCH (routed, not fixed):** (1) `my_documents()` `proacl` carries `anon=X` — B1 GRANTS; (2) `AppLayout.tsx` `MANAGEMENT_GROUP` row for the company documents page — the nav is hand-written, B10/CR-118; (3) `api/deliver-report.ts` (email a report) + `api/reports-monthly.ts` + one `scheduled-jobs.yml` line (auto-generation) — unowned `api/` files, need assignment; C ships store-only with the email control disabled-with-reason until then; (4) `AdminRegistryPage` is super-admin-only — no tenant editor for any `ORG`/`CONTACT` config key (D13 gap wider than ours; D ships the editor for the engine's three keys on the dashboards panel); (5) two more trees requested: one for the E lane, one for VRFY.

## BUNDLE FUNNELDEBT — FHE-MGMT-FUNNELDEBT (cut 2026-09-03 · `docs/orch/BUNDLE-FUNNELDEBT.md`)
*(MGMT edits ONLY this section on its bundle branch. Ledger: `docs/reports/FHE-MGMT-FUNNELDEBT-LEDGER.md`.)*
**Bundle tree `wt-9` · branch `bundle/funneldebt` (from `a1399848`) · lane: per task after VRFY; F3 relabel only after the owner's words are in the CR ledger, under rehearsal · escalations 0/7 reached (ONE batched summons after -A) · MGMT pushes the bundle branch, ORCH merges to `main` · last updated 2026-09-03**
| Tree | Thread | Branch | Profile · tier | Holds (DB objects / files) | State |
|---|---|---|---|---|---|
| wt-10 | `FHE-TASK-FUNNELDEBT-A` | `task/funneldebt-a` | DSNR · Fable HIGH | docs only: `docs/tasks/TASK-FUNNELDEBT-*`, `docs/reports/FHE-DSNR-FUNNELDEBT-HANDOFF.md`, `docs/reports/FHE-TASK-FUNNELDEBT-A-ESCALATIONS.md`, own ledger/report. Read-only on prod. | **DISPATCHED 2026-09-03** — charge `docs/tasks/TASK-FUNNELDEBT-A-shape-the-request-to-booking-spine-and-the-guardian-spine.md`; awaiting owner launch |
| — | `FHE-TASK-FUNNELDEBT-B…` | — | CODR · Opus HIGH ON | per -A's chunk declaration | waiting on -A; more trees to be asked of ORCH if -A declares >1 disjoint chunk |
| — | `FHE-TASK-FUNNELDEBT-V` / `-W` | — | VRFY / WALKR · Opus HIGH ON | — | at merge / at close (F4→F1→F5; minor variant of F4→F1; WALKTEST fixture) |
**DB objects held by the bundle (declared in BUNDLE-FUNNELDEBT.md; nothing applied yet):** `status_events` + `status_events_vocab` `entity_type` CHECK constraints · every writer filing a booking status event (`trg_status_bookings` lineage) · `request_open_time` · `book_open_slot` · the other `'no member profile'` guard sites if healed · `provision_client_invitation` · `redeem_invitation` (bodies only) · a NEW payer/guardian column on `purchases`/`bookings` (name to be declared by the spec before apply; never B5's horse-attribution column).
**Measured 2026-09-03 (ledger §MEASUREMENT):** `offering` 829 / booking-shaped 781 / `booking` 0; live CHECK is `20260826T1000`'s (includes `payment`), not the `20260821T1500` one the bundle cites; F4 traps 3 profiles, all zz-test fixtures.
