# THE BOARD — what has right of way, right now

⚠️ **`ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state, written
down, so a fresh ORCH takes the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-02 · **ORCH — batch 1 ALL FIVE landed and merged (`366b0a20`); batch 2 dispatching: RANCHWORD-A · SIGNFLOW-G · SIGNFLOW-H · RECONCILE**

## RUN ORDER (owner, 2026-09-02 — revised: pool grows on demand; the rest goes through MGMT)
**Pool: wt-1…wt-6 provisioned (env pair + node_modules). More on request.**
**Batch 1 — ✅ ALL FIVE MERGED 2026-09-02:** SITESEO (verified; post-deploy curls owed) · SIGNFLOW-F specs (G+H) · RANCHWORD spec (A) · TACKROOM research handoff · METHOD-MGMT (three files, NOT IN FORCE).
⚠️ **Deviation recorded, not chased:** RANCHWORD and TACKROOM wrote their docs on the CANONICAL checkout's `main` instead of their assigned trees (wt-1/wt-4) — no damage (docs-only, disjoint), but D36/D40 say assigned tree. Both threads were told a tree; the profile files should say it louder.
**Batch 2 — concurrent NOW:** `RANCHWORD-A` build (Opus·HIGH·ON, wt-1) · `SIGNFLOW-G` (Sonnet·MEDIUM·ON, wt-3) · `SIGNFLOW-H` (Opus·HIGH·ON, wt-5) · `RECONCILE` (DISCO profile, Fable·HIGH, wt-6). ⚠️ G and RANCHWORD-A both touch `ContractPage.tsx` line-level — whichever merges second re-greps (handoff §2).
**Batch 2 — as gates open:** the two builds F's specs produce · RANCHWORD build (after TACKROOM's handoff, since the hub name depends on it).
**Then — the MGMT trial:** `RECONCILE` (running in batch 2): every open item — board queues, open CRs, the SIGNBOOK-fallout lane, the Casey backlog, ROUTED, owner checklists, the old docs tasks — checked against post-batch `main`, classified keep/revise/remove with evidence, into ONE reconciled list. ORCH bundles by shared context; disjoint bundles hand to MGMT copies. ONERAIL · FUNNELDEBT · SITEPOLICY · INROADS · CR-106 · REQCARDS dissolve into those bundles rather than running as batch 3.
**Last:** `CLNR-REPO-STATE` when no build is mid-flight.

## RESUME — what is true right now
- **`main` = `0e9ebaf0`, pushed, clean.** Gates: typecheck 0 · typecheck:api 0 · lint 45w/0e · build clean · test:api 7/7 · `test:db` red at baseline (proof of nothing).
- **Merged and VERIFIED this session (each has a `-VERIFICATION.md`):** LIFECYCLE · SIGNBOOK (after the fact) · SITECOPY-A/B · SIGNFLOW-A/B/C/D · LANDINGSIGNIN · SITESEO. Docs merged: SIGNFLOW-F specs (G+H) · RANCHWORD-A spec · TACKROOM handoff · MGMT-ROLE/VRFY/WALKR (not in force).
- **Owed by ORCH:** the post-deploy SITESEO curls (301s still read 200 at `0e9ebaf0`+0 min — deploy pending).
- **Pool:** wt-1…wt-6, all detached at `origin/main`, clean. **Canonical-checkout writer (D40): ORCH.**
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

## OWNER CHECKLISTS UNRUN — the half no thread can prove
`FIX1` §8 · `FIX2` §9 · **`FIX4` §11 (13 items, the biggest visual change)** · `CR85` §8 ·
`MODAL2` · `BACKDATE` §8 · `BOOKS1` §14 · **`LIFECYCLE` §8 (7 items — item 6 is the visible change: next month renders pending/orange)** · **`SIGNDOOR` — ⚠️ load `/sign/rider` and count the boxes;
"exactly two" is the whole task and only its own probe has tested it.**
