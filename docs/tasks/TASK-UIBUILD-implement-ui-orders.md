# TASK UIBUILD — implement UI change orders

**You write the code. You do not decide what the code should be.**

A separate thread (`UIREVIEW`) works with the owner off screenshots and writes change orders.
You implement them. This is a standing working mode, not a one-shot task — you stay open and
pick up orders as they arrive.

## Read first, in this order

1. **`docs/reference/UI-STATE-2026-08-09.md`** — the current UI, the file map, the colour
   maths, and **seven traps that have each already cost this project time.** Shared with
   `UIREVIEW`. Neither of you owns it. **The traps are the most important part of this task
   for you** — three of them describe changes that pass typecheck, lint and build while
   emitting nothing or breaking a page.
2. **`docs/ui-orders/`** — your work queue.

---

# PART 1 — THE LOOP

## 1. Take the lowest-numbered order marked `Status: READY`

**Skip anything marked `BLOCKED`.** Blocked means a value the owner has not supplied is
missing. **Do not fill it in.** Do not pick a sensible default, do not match a nearby value,
do not compute what would look right. Say the order is blocked and move to the next one.

If the queue has no `READY` orders, say so and wait.

## 2. Implement exactly what the order says

**The order is the whole spec.** Its `## Files` section is exhaustive — **touch nothing else.**
Its `## Do NOT` section names things that look wrong and are deliberately out of scope.

**If the order is ambiguous, STOP and ask.** Do not resolve the ambiguity yourself. The order
came from a thread whose entire job was to make it unambiguous; an ambiguity is a defect in
the order, and guessing at it reintroduces exactly the failure this two-thread split exists to
prevent.

**If implementing it requires touching a file the order does not list, STOP and ask.** That is
a scoping error in the order, not a licence to widen.

## 3. Verify — and a build passing is not verification

```
npm run typecheck      # must be 0 errors
npm run lint           # 0 errors, ~26 pre-existing warnings — more means you added them
npm run build
```

**Then grep `dist/assets/*.css` for the actual rule body.** This is not optional and it is not
belt-and-braces. Read T1 and T2 in the state doc:

- `bg-cream-100/[0.92]` emitted **no rule at all** — typecheck, lint and build all passed
- `bg-navfill/64` emitted **nothing**, because 64 is not in Tailwind's default opacity scale,
  and the hover state silently had no fill
- minified CSS **keeps the space after the colon** — grepping `min-width:1400px` returns
  nothing and looks exactly like a failed deploy

Follow the order's own `## Verification` section as well.

## 4. Commit one order per commit

Message names the order: `feat(ui): UIO-007 — the selected row's icon now matches its text`.

**Do not push.** The orchestrator merges and pushes; a push to `main` auto-deploys and is a
release.

## 5. Report

Append to `docs/reports/TASK-UIBUILD-LOG.md`: order number, commit, what you verified, and
**explicitly what you did not verify.** "The rule is in the built CSS" and "it looks right"
are different claims and only the first is yours to make — **nothing you do here proves a
render.** The owner confirms by eye.

---

# PART 2 — THE RULES THAT ARE NOT NEGOTIABLE

## Change only what the order says

**No tidying. No refactoring. No fixing adjacent things you noticed. No improving the code
around what you touched.**

**A previous session shipped eight visual changes the owner rejected, including a colour value
he had already explicitly turned down.** Unrequested visual change is the single most
expensive failure mode on this project. If you spot something genuinely wrong, note it in your
log and say so in your reply — `UIREVIEW` will turn it into an order if the owner wants it.

## Never invent a value

No width, no hex, no spacing, no duration the order did not give you. If a value is missing
the order is `BLOCKED` and it is not yours to unblock.

## Root-level CSS is a different risk class

Nothing lands on `html` or `body` without saying so loudly in your report. An `overflow-x:
clip` added to `html` broke scroll anchoring and **made contract authoring unusable.**
Typecheck, lint and build all passed. See T3.

## Do not resurrect the shelved header

`src/components/app/CardstockHeader.tsx` is orphaned — referenced only in comments, rendered
nowhere — but it still imports `header-cardstock.css`, which declares `--cs-hdr-h: 80px`
against the live header's 76px. **Rendering it moves every rail offset and subheader in the
app.** See T4. If an order appears to require it, stop and ask.

## Trust the code over the comments

At least one comment contradicts what the code does — `AppLayout.tsx` around line 1342 calls
`NAV_PANEL` a "solid green panel" when it is `bg-cream-25`, near-white. See T5. If you touch
that region, fix the comment as part of the same commit.

## The colour tokens are blend inputs, not colours

`navfill` and `glass.nav` are pre-shifted to cancel a 72° hue rotation that happens when a
translucent green composites over the warm page. **Nobody ever sees the declared value.** If
an order changes what sits *behind* either token, both are invalid and must be recomputed —
say so rather than shipping it. See §3 of the state doc.

## Diagnose from evidence

If an order describes a symptom rather than a cause, **enumerate the call sites before
theorising.** The contract reload bug took three attempts; two were confident diagnoses from
reading likely culprits, and what actually found it was listing every caller of one function —
two minutes of work that should have been first. See T7.

Related: **distinguish a workaround from a fix.** Restoring scroll position after a teardown
was a workaround; not tearing down was the fix.

---

# PART 3 — CONSTRAINTS

- **Worktree** `~/Downloads/claude-code-repo/wt-uibuild`, branch `task/uibuild`, off
  `origin/main`. Repo is `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app`.
  **NEVER any clone under `~/Desktop`** — an iCloud sync destroyed a repo there and stranded
  four applied migrations.
- **You own the UI code** — `AppLayout.tsx`, `AppHeader.tsx`, `app-header.css`, `index.css`,
  `tailwind.config.js`, `PageHeader.tsx`, `ContractSubheader.tsx`, `src/pages/`.
  `TASK-MOBILEPASS` was previously assigned `AppLayout.tsx`, has not run, and is sequenced
  behind you.
- **`ClauseDocument.tsx` is FROZEN.** Do not edit it for any reason.
- **`docs/reference/UI-STATE-2026-08-09.md` is shared and read-only to you.** If it is wrong,
  say so in your report — do not edit it. The orchestrator corrects it so both threads stay
  in sync.
- **No database writes, no migrations.** UI only. If an order turns out to need one, stop and
  report it — it goes back to the orchestrator.
- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION.** Read-only.
