# MGMT — the design brief (owner + ORCH conversation, 2026-09-02) — INPUT TO THE AUTHORING TASK

**This captures a design that lived only in the ORCH window. It is the brief for the task that
authors `MGMT-ROLE.md`, `VRFY-PROFILE.md` and `WALKR-PROFILE.md`. It is not yet in force; D41 is.**

## 1. THE SHAPE THE OWNER SETTLED ON (his words where it matters)
> *"it honestly works best when i work with you and you read the task output and handle things, the
> issue is the backlog and the inability to run multiple sets of tasks simultaneously without agentic
> assistance. so the whole key here is that we can run up a big ledger but it gets handed to an
> intermediary that works directly with task and i am summoned rather than living there, and you
> still have visibility over it and work alongside it and can spawn multiple copies working on
> different things simultaneously."*
> *"1 you, 2 them, 3-6 task threads per them is 12 things getting done with only one conversation
> for me to truly manage."*
> *"we add mgmt between us and task and that thread can have multiple copies running simultaneously,
> it needs to be on your level of capability and self sufficiency and it needs to not be a
> discussion thread more than decisions and rulings that come up or are left unresolved because we
> didnt have enough information when you created the bundle."*

- **ORCH (standing, one):** the owner's single conversation; the big ledger; bundling; visibility
  over every MGMT copy; reasoning support when something goes sideways; may engage a TASK directly
  and merge one-off-sized work itself.
- **MGMT (per bundle, many at once, disposable):** takes ONE bundle handoff; does the tasking,
  dispatch, review, approval, merge, commit for that bundle; **Fable-tier, ORCH's own rules and
  discipline**; self-sufficient — exhausts the file before asking; **its conversation budget is
  decisions and rulings only**; summons the owner through PRE-REGISTERED escalation points named in
  the handoff (anything ORCH and the owner could not resolve when the bundle was cut), never a
  re-run discussion; dumps-and-respawns at 50% context or a natural boundary, whichever first.
- **TASK:** unchanged. Hands BACK, by name, to whoever spawned it (MGMT or ORCH).
- **GHOST / RNR / PLNR:** NOT part of this. Deferred to the product environment (D41 §4).

## 2. THE TWO GUARDS THAT MAKE PARALLEL MGMT SAFE
1. **Bundles are DISJOINT at formation** — no shared files, no shared DB objects; ownership declared
   before either spawns (D35/D36 one level up). Two bundles that cannot be made disjoint are one.
2. **One merge authority per piece of work** — bundle work merges through its MGMT; ORCH-direct
   work merges through ORCH; never both on one branch. The board stays the single right-of-way map.

## 3. THE PROFILE ROSTER MGMT SERIALIZES BY — six
DISCO (research) · DSNR (spec + chunking) · CODR (build) · CLNR (zeroth act, or alone) ·
**VRFY (new): independent verification as a task** — fresh eyes that never built it; re-run claims
against production AT MERGE TIME, diff vs merge-base, reach by rendered element, `proacl`; MGMT
approves on VRFY's evidence. Kills degrading/reverting.
**WALKR (new): end-to-end flow walks at bundle close** — real surfaces + real DB, files findings as
intake, fixes nothing. Kills miswired seams and half-built (a stored value with no reader cannot
survive a walk).
**Sequence per bundle:** DISCO → DSNR → CODR (parallel only where DSNR declared chunks disjoint) →
VRFY → merge → WALKR at close → results up to ORCH.

## 4. OPERATING RULES ALREADY SETTLED THAT MGMT INHERITS
D35 · D36 (assignment, and the pool GROWS ON DEMAND — ORCH provisions trees; count is never the
limit when work is conflict-free) · D37 naming · D39 · D40 · hand-back-by-name · every launched
prompt carries tier/effort/thinking + sender.

## 5. THE TRIAL (owner, 2026-09-02)
After the current batches land: **reconcile every open item against the current repo state**
(remove or revise what recent merges changed), bundle by shared context, hand bundles to MGMT copies.
