# THE BOARD — what has right of way, right now

⚠️ **`ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state, written
down, so a fresh ORCH takes the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-03 · **FHE-ORCH-8 in the seat. Four MGMT copies cut: GRANTS (B1) · SUPPLIES (B5) running; DASHBOARDS (B7) · FUNNELDEBT (B2) handed. Pool wt-1…wt-11.**

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

## BUNDLE GRANTS — FHE-MGMT-GRANTS (D44 trial · opened 2026-09-03 · ledger `docs/reports/FHE-MGMT-GRANTS-LEDGER.md`)
**Bundle tree `wt-1` · branch `bundle/grants` @ a1c6c105 · merge lane: per task after VRFY · hands back to `FHE-ORCH-7`.**
**DB objects held by this bundle: the ACL (`proacl`) of every SECURITY DEFINER function in `public` — never a body.**
| Thread | Profile | Tree | Branch | State |
|---|---|---|---|---|
| `FHE-TASK-GRANTS-A` | DSNR | **wt-2** | `task/grants-a-spec` | DISPATCHED 2026-09-03 — `docs/tasks/TASK-GRANTS-A-author-the-acl-sweep-spec.md`; awaiting owner launch |
| `FHE-TASK-GRANTS-B` | CODR | wt-2 (after -A retires) | `task/grants-b` | waiting on -A's spec |
| `FHE-TASK-GRANTS-V` | VRFY | **wt-11** (allotted by ORCH 2026-09-03) | — | waiting |
| `FHE-TASK-GRANTS-W` | WALKR | wt-11 (after -V) | — | at close, on `main` as deployed |
**Escalations:** 1/1 RAISED 2026-09-03 — `FHE-TASK-GRANTS-A-ANON-WRITERS.md` (bundle/grants): 145 anon-executable writers; Block A 140 no anonymous caller → revoke; Block B: keep `submit_public_request` + `open_gift` (code is the credential), revoke `redeem_gift` (self-guards on auth.uid()). ORCH verified in production: open_gift anon=t no guard · redeem_gift anon=t self-guard=t. **With the owner.** -B blocked behind the ruling. **Item 7** (ledger status headers): last, after ORCH is told.
*(mirrored by ORCH from `bundle/grants` d5f97724; MGMT keeps editing its copy on the bundle branch — MGMT-ROLE §10.)*

## BUNDLE DASHBOARDS — FHE-MGMT-DASHBOARDS (cut 2026-09-03 · `docs/orch/BUNDLE-DASHBOARDS.md`)
*(MGMT edits ONLY this section on its bundle branch.)*
**Bundle tree `wt-7` · task tree `wt-8` · prompt handed 2026-09-03 · first deliverable: `docs/design/DASHBOARD-ENGINE-CONTRACT.md` UP to ORCH (B5 gates on it) · escalations 0/6.**
| Tree | Thread | Profile · tier | State |
|---|---|---|---|
| wt-8 | `FHE-TASK-DASHBOARDS-A` | DSNR · Fable HIGH | awaiting MGMT dispatch |

## BUNDLE FUNNELDEBT — FHE-MGMT-FUNNELDEBT (cut 2026-09-03 · `docs/orch/BUNDLE-FUNNELDEBT.md`)
*(MGMT edits ONLY this section on its bundle branch.)*
**Bundle tree `wt-9` · task tree `wt-10` · prompt handed 2026-09-03 · one batched summons after DSNR (7 points) · production data change (F3 relabel) only after the ruling is in the CR ledger.**
| Tree | Thread | Profile · tier | State |
|---|---|---|---|
| wt-10 | `FHE-TASK-FUNNELDEBT-A` | DSNR · Fable HIGH | awaiting MGMT dispatch |
