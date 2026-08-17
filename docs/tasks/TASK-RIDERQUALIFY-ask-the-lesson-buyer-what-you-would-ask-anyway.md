# TASK RIDERQUALIFY — the lesson buyer answers what you would ask on the call anyway

> ⚠️ **CANCELLED — DO NOT RUN. Owner, 2026-08-16:** *"the rider questions are already on the lesson
> form. there is nothing to add and no separate questions for them."* The submission form already
> carries riding experience (years), the notes prompt and availability — that IS the rider
> information. Lessons never gain a questions page (`TASK-ASKRIGHT` §A0), and nothing is added to
> the form for riders. **Nothing below is to be built.** The one surviving housekeeping item —
> retiring the orphaned `/book/rider` behind a redirect — moves to the orchestrator's cleanup list.

**Owner, 2026-08-16:**

> *"they are giving us information ahead of the call that we would initially ask anyway."*

That is the purpose of the qualifier steps on the horse-care and acquisition funnels — they are
not obstacles, they are **the phone call happening before the phone call**.

**The gap: riding lessons asks nothing.** `/lessons` goes card → checkout in one step, while both
other funnels ask a qualifying question first. So the one buyer the business knows LEAST about —
a first-time rider — is the only one who arrives with nothing on file.

# WHAT WAS MEASURED (main, 2026-08-16 — verify, then build)

**The questions already exist, fully built, on a page nothing links to.**

`src/pages/BookRider.tsx` (`/book/rider`) is an older rider funnel with three live
`QualifierGroup`s:

| key | question | options |
|---|---|---|
| `owns_horse` | *Do you currently own or lease a horse?* | Yes, I have a horse · Not yet · I ride school horses |
| `boarding` | (shown only when `owns_horse = yes`) | — |
| `wants_horse` | *Are you considering owning or leasing a horse?* | Yes, actively looking · Possibly in the future · Not at the moment |

**Nothing links to `/book/rider`.** The only mention in the source is a comment. This is the same
built-but-unreachable pattern as the kiosk funnels — the work was done and then orphaned.

**Also relevant:**
- `QualifierGroup` is the shared component all three funnels use — reuse it, do not write another.
- The horse-care and acquisition funnels are three-step (`Select → qualifier → Review`); `/lessons`
  is one step and goes straight to `/checkout`.
- **`SESSIONBOOK` is queued against `/lessons`** and changes what that page renders when signed
  in. **These two tasks touch the same page — coordinate or sequence them.**

# THE BUILD

## Q1 — the lesson buyer gets asked, once, before checkout
- Add a qualifying step to the rider path so a lesson purchase carries the same context a horse-care
  purchase does.
- **Reuse `BookRider.tsx`'s existing questions rather than inventing new ones** — they were written
  for exactly this buyer. Whether all three belong, or only `owns_horse`, is an owner question (below).
- **Reuse `QualifierGroup`.** Same component, same answer-persistence path the other funnels use.

## Q2 — do not tax the returning buyer
- The owner's framing is "information we would ask anyway" — that applies to someone new. A
  **signed-in member with a history should not be re-interrogated**; `SESSIONBOOK` makes the
  signed-in view a fast purchase flow, and a qualifier would fight that.
- **Establish what is already known** (`my_stable_horses`, prior purchases) and skip questions the
  answer to which is already on file. Report what you found rather than assuming.

## Q3 — the answers have to be readable when the call happens
- Qualifier answers must land where staff will actually see them next to the order — the same place
  horse-care and acquisition answers land today. **Find that place and match it**; do not invent a
  second store.
- If the existing answers are hard to find from the order, **say so** — that is a finding worth more
  than this feature.

## Q4 — decide what happens to `/book/rider`
Once its questions live in the real funnel, the old page is a duplicate. **Retire it behind a
redirect, do not delete it** (the `/shop` treatment, 2026-08-16) — and confirm first that it holds
nothing else of value.

# TRAPS
- **Do not build a second qualifier component or a second answer store.**
- **Do not add friction to the common case.** The owner's most frequent gift/lesson buyer is a
  parent or spouse buying a package; a long form before checkout would cost sales the phone call
  was meant to win.
- **`SESSIONBOOK` overlaps this page.** Sequence deliberately.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes). Not a green
  baseline — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. A signed-out lesson buyer answers the qualifier before checkout; the answers are stored and
   visible to staff alongside the order — prove where.
2. A signed-in member with a horse on file is NOT asked whether they own a horse — prove the skip.
3. The non-qualifier path (card → checkout) still works for anyone the questions do not apply to.
4. `QualifierGroup` and the existing answer store are reused — prove no second implementation.
5. `/book/rider` redirects and nothing of value was lost.
6. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTIONS — ask before building
1. **Which questions?** All three from `/book/rider`, or just *"do you own or lease a horse?"*
   The more asked, the more friction on a buyer who has already decided.
2. ~~**Where in the flow?**~~ **MOOT — the task is cancelled (see the banner).** Nothing is added
   anywhere: the form already carries the rider information, and the lesson flow stays two pages.

Report to `docs/reports/TASK-RIDERQUALIFY-REPORT.md`. Do not push; the orchestrator merges.
