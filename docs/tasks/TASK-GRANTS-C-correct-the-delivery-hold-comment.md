# TASK-GRANTS-C — correct spec §5 edit 4's replacement text, and add the miss to THE TEST

**Profile: `DSNR` — spec amendment only, no build. Thread name `FHE-TASK-GRANTS-C`.**
**Dispatched by `FHE-MGMT-GRANTS` 2026-09-03, on `docs/reports/TASK-GRANTS-B-VERIFICATION.md`'s DOES NOT
HOLD verdict (one row: item 6, comment edit 4). Per `MGMT-ROLE.md` §4: a VRFY DOES NOT HOLD is never
overruled at the pass — it goes to a DSNR-profile task to amend the spec and add the miss to THE TEST,
then to a fresh CODR-profile task. This is that DSNR task.**
**Hand this back to `FHE-MGMT-GRANTS`** — not to ORCH, not to the owner.

> ## READ THESE, BY PATH
> - `docs/method/DSNR-ROLE.md` — the profile. `docs/method/TASK-ROLE.md` §2c — the three questions,
>   relevant here because the miss you are fixing touches one of them.
> - 🔒 **`docs/reports/TASK-GRANTS-B-VERIFICATION.md` §6, §12 finding 5** — the finding, verbatim, and
>   why it is the spec's miss and not the builder's (CODR applied the spec's text exactly).
> - **`docs/tasks/TASK-GRANTS-B-close-the-anon-door-on-every-writer-nothing-anonymous-calls.md` §5,
>   edit 4** — the wrong text you are replacing, and the line range it targets.
> - `src/pages/app/Onboarding.tsx`, read on `task/grants-b` @ `7f2b36ff` (the branch this continues):
>   `:1391-1400` (the `showShopStep`/`showTimeStep` comment and their unconditional-`true` assignment,
>   commit `f9c66b49`, 2026-09-01) · `:615-634` (the effect and its current, wrong comment) ·
>   `:1265-1275` (where the provisioned door routes into `review` after the last signature) ·
>   `holdMyDocumentDelivery`'s one call site, `:632-633` — **grep the whole file for it: there is
>   exactly one, gated `if (step !== 'sign' || !selfServe) return;`. No provisioned-door equivalent
>   exists anywhere in the file.** (MGMT confirmed this by grep 2026-09-03; do not re-derive, but do
>   re-read the two lines it returns before you write anything.)

---

## 1 · THE FACT, ESTABLISHED, NOT YOURS TO RE-LITIGATE

The comment at `Onboarding.tsx:625-628` (spec's edit 4) claims *"the provisioned door has no shop,
time or submit step to wait for."* **That has been false since `f9c66b49` (2026-09-01), two days
before this spec was written** — `showShopStep` and `showTimeStep` are unconditionally `true`, and
the comment immediately above them says why: *"BOTH STEPS BELONG TO ANYBODY WHO IS BUYING OR
SCHEDULING IN THIS WIZARD — not only to the self-serve visitor."* `wizardSteps()` therefore emits
`review` and `submit` for the provisioned door too, and the code already routes a provisioned client
into `review` right after their last signature (`:1271`).

**The behaviour the effect implements is NOT wrong** — `holdMyDocumentDelivery()` really does only fire
for `selfServe`, and that is a true, deliberate, single-call-site fact. **The comment's STATED REASON
for that behaviour is wrong.**

## 2 · THE QUESTION THIS SURFACES, AND WHAT YOU DO WITH IT

Because the provisioned door now also has a `review`/`slots`/`submit` sequence, it too creates its
order and booking request **after** signing, in steps the self-serve door's hold was built to wait
for. **Nothing currently holds the provisioned door's document delivery for those steps** — its emails
may go out before its booking request exists, the exact condition CR-98 step 8 was written to prevent
on the self-serve door.

🔒 **This is a product decision, not yours to make here, and not this task's to fix.** `TASK-ROLE.md`
§2c's three questions apply to what the effect CAPTURES (the held email), and the honest answer today
is: the provisioned door's outcome does not get this treatment, and nobody has said whether it should.
**Your job is to write a comment that says this truthfully — including the asymmetry — not to resolve
it and not to silently narrow scope by pretending the question does not exist.**
⚠️ **Do not widen `holdMyDocumentDelivery`'s guard to cover the provisioned door.** That is a
behavioural change with its own spec, its own THE TEST, and its own owner call — exactly what
`fhe-scope-narrows-dont-invent-affordances` exists to stop. **Flag it; do not fix it.**

## 3 · WHAT TO PRODUCE

1. **Corrected replacement text for `Onboarding.tsx:625-628`** (the amendment to spec §5 edit 4),
   something in this shape — write it in the file's own voice, don't just copy this verbatim:
   > *"⚠️ Self-serve only, by construction — this is the ONLY call site of `holdMyDocumentDelivery`,
   > gated on `selfServe`. The provisioned door also reaches `review`/`slots`/`submit` after signing
   > (since `f9c66b49` widened `showShopStep`/`showTimeStep` to both doors) and creates its own order
   > and booking request there, but nothing holds ITS document delivery for that — an open question,
   > not an oversight fixed here. (It does not end at payment — nothing routes to that step on either
   > door; see `wizardSteps`.)"*
   **Get the commit hash and line numbers right against the branch tip, not this task file's copy.**
2. **One line added to `TASK-GRANTS-B-close-the-anon-door…md` §"THE TEST THIS MUST PASS"** (or a
   dated correction note beside criterion 10, matching the style `-A`'s spec already uses for its own
   corrections): *"Before writing a claim about which steps a door has, read `showShopStep`/
   `showTimeStep`'s current values and the comment above them — a claim about step inclusion is a
   DB-STATE-shaped claim about the file, not something to infer from an older spec's premise."*
3. **A one-line addition to your handoff naming the open product question from §2**, so MGMT can carry
   it up as a routed finding distinct from the comment fix (VRFY already filed it as finding 5 — your
   job is to confirm it is still accurate at your read time, not to re-file it).

## 4 · WHAT IS NOT YOURS

- Editing `Onboarding.tsx` itself. That is `FHE-TASK-GRANTS-D` (CODR profile), which MGMT dispatches
  next, on the SAME branch (`task/grants-b`, `wt-2`) — this is a continuation, not a fresh worktree,
  because nothing else has touched that tree since `-B` paused there.
- Deciding whether the provisioned door needs the same delivery hold. Routed, not decided.
- Any of the other three comment edits, the migration, or anything already `HOLDS` in the verification.

## THE PROMPT — for `FHE-MGMT-GRANTS` to hand out
**Fable 5.1 · effort HIGH** *(a comment claim needs to be checked against a file whose behaviour moved
underneath it two days before the spec was written — the same shape-before-fix ground the CR-116 gift
ruling sat on, not a mechanical copy-edit)*
