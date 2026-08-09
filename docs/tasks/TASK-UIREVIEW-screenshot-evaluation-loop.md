# TASK UIREVIEW — the standing UI review loop

**This is not a build-and-report task. It is a standing working mode.** You stay open. The
owner posts screenshots. You respond in one of three modes, which he selects. There is no
final deliverable and no "done" — the thread ends when he closes it.

Everything below is either the current state of the UI, verified 2026-08-09, or a rule that
exists because breaking it has already cost this project real time.

---

# PART 1 — THE THREE MODES

**The owner tells you which mode. If he does not, ASK. Do not infer it from the screenshot.**

## MODE A — ADVICE

> "What do you think of this?" · "Which of these is better?" · "How should this work?"

Give an opinion and the reasoning behind it. **Write no code.** If the answer depends on
something you can check in the repo, check it and say what you found.

You may disagree with him. He would rather be contradicted with evidence than agreed with
wrongly. Say so plainly and show the evidence.

## MODE B — CHANGE

> "Make the header shorter." · "That green is wrong, use X." · "Move the button right."

Make **exactly** that change. Then stop.

**Do not fix adjacent things you noticed.** Do not tidy, re-align, re-space or re-colour
anything he did not name. If you spot something else wrong, finish the change, then say
*"separately, I noticed X — want me to look at it?"* and wait.

This rule is not stylistic caution. **A previous session shipped eight visual changes the
owner rejected, including a colour value he had already explicitly turned down.** Unrequested
visual changes are the single most expensive failure mode on this project.

## MODE C — EVALUATE

> "What's wrong with this?" · "Identify the issues here."

**Two steps, with a hard stop between them.**

**Step 1 — list the issues. Numbered. No solutions.** For each: what you see, where it is
(file and line if you can find it), and why it reads as wrong. Include a confidence marker —
whether you can see it in the screenshot, whether you confirmed it in the code, or whether
you are inferring it.

**Then STOP. Ask him which are real.**

**Step 2 — only after he confirms** — propose solutions for the confirmed items only. Not
the ones he did not confirm. Not new ones you thought of since.

**Do not skip to Step 2.** He asked for identification precisely so he can filter before you
spend effort. Jumping to solutions defeats the purpose of the mode and puts you back in the
failure described under MODE B.

---

# PART 2 — THE CURRENT UI, AS OF 2026-08-09

## 2.1 The header — replaced 2026-08-08, this is the live one

`src/components/app/AppHeader.tsx` + `src/components/app/app-header.css` (242 lines).

It is the **login/public page header adopted into the app**. Flat and opaque. No glass, no
blur, and it **does not minify on scroll** — the height is fixed per breakpoint, deliberately,
so `--cs-hdr-h` is provably accurate in every state.

**`--cs-hdr-h` IS the header height, not a description of it.** The header takes its height
*from* the variable. Two rails and the contract subheader offset themselves from it. Change
it in one place and everything tracks; hardcode a number anywhere and they desync.

Declared heights (`app-header.css`):

| condition | `--cs-hdr-h` |
|---|---|
| default | **76px** |
| `max-width: 600px` | 68px |
| `max-width: 400px` | 64px |
| `max-height: 500px` + landscape + coarse pointer | 56px |

That last one is a **phone in landscape** — ~850px wide but ~390px tall. Keyed on height and
pointer so it can never catch a tablet or a narrow desktop window. It was inherited from the
previous header, which learned it the hard way. Do not "simplify" it to a width query.

**Known, deliberately unfixed:** superadmin chrome is `h-14` (56px) while the rails read
`--cs-hdr-h` and stick at 76px — a 20px gap. Superadmin chrome is explicitly untouched.

## 2.2 The nav — three of them, different widths

All in `src/components/app/AppLayout.tsx`.

| surface | width | line |
|---|---|---|
| client desktop rail | `w-60` (240px) | 779 |
| staff rail, pinned | `w-60 xl:w-64` (240 / 256px) | 840 |
| staff rail, collapsed | `w-14` (56px) | 840 |
| mobile drawer | `w-72 max-w-[85vw]` (288px) | 1369 |

**The nav panel is NEAR-WHITE with green ink. It is not green.** This reversed an earlier
direction and the reversal is not recorded in the change-request file:

```
NAV_PANEL      = 'bg-cream-25'                    // #fdfcfa, near-white
NAV_ROW_IDLE   = 'text-green-800' + hover bg-navfill/64
NAV_ROW_ACTIVE = 'bg-navfill/80 text-cream-25'
```

So: near-white panel, green text, and a green fill only on the selected and hovered rows —
selected at 80%, hover at 64%.

**The mobile drawer tab is GONE** (ONEHEADER, owner ruling 2026-08-08). The header's avatar
button is the only way into the nav on a phone. There is one control for one job.

## 2.3 The colour system — and why two tokens are not what they look like

`tailwind.config.js`. Brand green `green-800 #143321`, brand gold `gold-600 #ba9935`, page
cream `#faf8f4`.

**`navfill: #0d341e` and `glass.nav: #09975e` are NOT colours anyone sees.** They are
**inputs to an alpha blend, pre-shifted cooler to cancel a hue rotation.**

The maths, which the owner worked out and was right about: a translucent green over the warm
cream page (hue 37°) composites **72° toward yellow**. `green-800/20` over cream renders
`#c8cac0` — hue 73°, saturation 9%. A grey-green. So the declared base is rotated the other
way, and the *rendered* colour lands on the brand hue:

- `navfill/85` over the near-white panel → `#31523f`, hue 145.5°, contrast 8.50:1
- `navfill/65` over the near-white panel → `#617a6b`, hue 144.0°, contrast 4.55:1

**If the backdrop changes, both tokens are invalid and must be recomputed.** The compensation
is specific to what sits behind them. Worked examples: `docs/reference/`.

Corollary already established: **a green glass panel over a near-white page cannot read as
green below roughly 90% alpha.** Back-solving for it needs negative channel values. Do not
re-attempt this; it is arithmetic, not taste.

## 2.4 Page layout and the "empty page" problem

`src/index.css`. Root font-size steps up on large displays, so `rem`-based Tailwind sizes —
type, spacing **and `max-w-*` caps** — all scale together:

```
>= 1400px  ->  18px      (laptops, 13-16")
>= 1800px  ->  19px
>= 2400px  ->  20px
```

The 1400px step was moved down from a higher threshold because **a 15" laptop was missing the
scale-up by 88px**.

**Open and unsolved:** pages with narrow caps still look empty on a 15" laptop. The scale-up
landed, but a `max-w-3xl` page fills only ~77% of the space beside the rail. The owner's
read: this is **per-page caps**, not the scaling ladder. Do not re-tune the ladder to fix it.

Content columns are centred (`2cc9742`) — the earlier emptiness was an alignment bug, and
that part is fixed.

## 2.5 The file map

**Layout and chrome**
- `src/components/app/AppLayout.tsx` — the app shell, all three navs, the drawer. Large.
- `src/components/app/AppHeader.tsx` + `app-header.css` — **the live header**
- `src/components/app/PageHeader.tsx` — the shared page-header component (A5/A6)
- `src/components/app/ContractSubheader.tsx` — offsets from `--cs-hdr-h`
- `src/components/layout/Header.tsx`, `Footer.tsx`, `Layout.tsx` — the public marketing site

**Styles** — there are only three stylesheets
- `src/index.css` (514) — root scale, `.container-site`, print rules, reduced-motion
- `src/components/app/app-header.css` (242) — the live header
- `src/components/app/header-cardstock.css` (532) — **the shelved header. See the traps.**

**Pages** — `src/pages/` (public) and `src/pages/app/` (in-app), `src/pages/app/ops/` (staff)

---

# PART 3 — TRAPS. Every one of these has already cost time.

## T1 — An arbitrary Tailwind value can silently emit NOTHING

Typecheck passes. Lint passes. Build passes. The rule is simply absent.

- `bg-cream-100/[0.92]` produced **no rule at all**
- `bg-navfill/64` produced **nothing**, because 64 is not in Tailwind's default opacity scale
  (it is now declared in `tailwind.config.js` under `opacity`, specifically so the owner's
  exact 80/64 values are expressible)

**Any new arbitrary value or non-standard alpha must be grepped out of `dist/assets/*.css`
after a build.** Do not report a colour change as done without that grep.

## T2 — Minified CSS keeps the space after the colon

`min-width: 1400px` compiles **with** a space. Grepping `min-width:1400px` returns nothing
and looks exactly like a failed deploy. Three consecutive wrong "not deployed" calls came
from this and from comparing bundle filenames on a code-split build.

## T3 — Root-level CSS is a different risk class

Nothing lands on `html` or `body` without a browser check. An `overflow-x: clip` added to
`html` broke scroll anchoring and **made contract authoring unusable**. Typecheck, lint and
build all passed. It was reverted at `259d0e9`.

## T4 — `CardstockHeader.tsx` is orphaned but still wired to its stylesheet

`CardstockHeader.tsx` is referenced **only in comments** — nothing renders it. But it still
does `import './header-cardstock.css'`, and that stylesheet declares `:root { --cs-hdr-h:
80px }`.

**If anything renders that component again, the header height silently becomes 80px and every
rail offset and subheader in the app moves 4px.** A comment in `AppLayout.tsx` claims the
stylesheet "is no longer imported" — that is true only because the component is dead, not
because the import was removed.

## T5 — A stale comment in `AppLayout.tsx` contradicts the code

Around line 1342: *"ONEHEADER §1: solid green panel (NAV_PANEL), not glass"*.

`NAV_PANEL` is `bg-cream-25` — near-white. The comment is left over from a direction the owner
reversed. **Trust the code, not the comment.** If you touch that region, fix the comment.

## T6 — Two open complaints that may not be fixable as stated

- **C1, selection flickers.** Ten nested `backdrop-filter`s were removed; the owner reports it
  persists. The diagnosis was wrong. It is likely inherent — a `backdrop-blur` panel
  re-composites its backdrop whenever a child changes. **This needs a decision, not a fix:**
  a translucent panel *without* blur, or an opaque one.
- **C2/C3, the green.** See 2.3. Arithmetic, not taste.

## T7 — Diagnose from evidence, not from plausible code paths

The contract reload bug took three attempts. Two were confident diagnoses from reading likely
culprits. What found it was **enumerating every call site of the reload function** — two
minutes of work that should have been the first move.

Related: **distinguish a workaround from a fix.** Restoring scroll position after a teardown
was a workaround; not tearing down was the fix. The owner spotted that immediately.

---

# PART 4 — WHAT IS ALREADY REQUESTED AND LOGGED

**Read `docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md` in full before your first
evaluation.** It is 127 lines and it is the authoritative record of what the owner has asked
for, what shipped, what he says is still wrong, and — critically — **what is SUPERSEDED and
must not be rebuilt.**

Its structure:

- **A1–A15** — requested, with the owner's disposition on each. A1 (adopt the login header)
  has since SHIPPED.
- **B1–B17** — implemented, present in the deployed CSS, **never confirmed by eye**
- **C1–C6** — implemented and the owner says still wrong
- **D** — **SUPERSEDED. Do not implement any of these.** Several are reversals of reversals.
- **E1–E4** — all now answered

## Still open, and relevant to almost any screenshot he sends

- **Narrow page caps still look empty** on a 15" laptop — per-page caps, not the ladder (2.4)
- **Subheader button outlines** — he asked to remove them except on Void and Delete, then
  asked for them back. **All are present now. CONFIRM BEFORE TOUCHING.**
- **Nav resize (A13)** — blocked; he has not given a width, and when asked said it is not a
  priority. Do not invent a number. A previous thread correctly refused to.
- **A9/A10/A11, the icons** — assignment is settled in `docs/reference/nav-icon-exercise.md`.
  **Two icons are custom and unbuilt** (Lessons: jumping horse with rider; Horse care:
  galloping horse) and **no horse artwork exists in the repo** — the only mark in code is
  `public/favicon.svg`, the letters `FH`. Artwork is ON HOLD by owner ruling; do not block on
  it. A9 is also gated behind the admin refactor.
- **`PAGEFRAME`** (nine pages onto the shared header) and **`TITLESWEEP`** (page intro copy,
  runs after it) are specced and unrun — `docs/tasks/`. If a screenshot shows a page with the
  old frame, that is why.

## The leather track — PAUSED, NOT CANCELLED

The header is settled **as version A only**. Version B was an active A/B the owner paused with
"circle back" on 2026-08-06. Decisions already locked inside it:

- **Material:** the whole hide via `background-size: cover`. Assets are cut and in the repo —
  `docs/reference/leather/`.
- **Stamping:** variant 5, "emboss · raised face", exact CSS recorded. Raised beat debossed
  on leather and on cardstock both times.
- **Unbuilt:** full header composition in the raised treatment; a green-glass tab behind the
  header pulling a full-screen glass menu down; over-centre bistable motion; real content
  scrolling visibly beneath the glass. On mobile the glass tab replaces both the drawer and
  the avatar menu. He also wants a leather login screen where typed characters stamp into
  the hide.

**Do not treat the header as closed.** The shelved cardstock header is preserved intact at
`docs/reference/shelved-cardstock-header/`.

## Browser-verification debt

About twenty tracker items over two weeks are **code-complete, browser pending**: `A11`–`A13`,
`A20`, `A21`, `F3`, `I1`–`I11`, `K1`–`K4`. Several were proven server-side through rolled-back
`psql` sessions, which proves an RPC and proves nothing about a render.

**If a screenshot happens to confirm or refute one of these, say so.** Closing them is worth
more than any single build task currently queued.

---

# PART 5 — HOW TO WORK

## Showing, not describing

**A rendered comparison settles in seconds what paragraphs cannot.** When the owner said "I
can't do anything with numbers", the answer was a page of live swatches.

For any colour, spacing or type question: build a small standalone comparison page, run it,
and let him look. Do not send him hex values and ask him to imagine them.

## Verification, before you say a visual change is done

1. `npm run typecheck` · `npm run lint` · `npm run build`
2. **Grep `dist/assets/*.css` for the actual rule body** — see T1 and T2
3. Say explicitly **what you verified versus what you assumed.** "The rule is in the built
   CSS" and "it looks right" are different claims and only one of them is yours to make.

Baseline health: typecheck 0 errors, lint 0 errors (~26 pre-existing warnings). If you see
more than that, you introduced it.

## Commits

Commit each change on its own with a message naming what the owner asked for. **Do not push.**
The orchestrator merges and pushes — a push to `main` auto-deploys and is a release. Batching
is deliberate: a previous session pushed after nearly every one of 39 commits in a day and the
owner could not tell which build he was testing.

## Reporting

There is no single end-of-thread report. **Keep a running log at
`docs/reports/TASK-UIREVIEW-LOG.md`**: one entry per exchange — what he asked, what mode, what
you changed or concluded, and the commit. Append; never rewrite history in it.

---

# PART 6 — CONSTRAINTS

- **Worktree:** `~/Downloads/claude-code-repo/wt-uireview`, branch `task/uireview`, off
  `origin/main`. **Repo is `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app`.
  NEVER any clone under `~/Desktop`** — an iCloud sync destroyed a repo there and stranded
  four applied migrations.
- **`ClauseDocument.tsx` is FROZEN.** Do not edit it. If a screenshot shows a problem inside
  it, report the problem and stop.
- **You own `AppLayout.tsx`, `AppHeader.tsx`, `app-header.css`, `index.css`,
  `tailwind.config.js`, `PageHeader.tsx` and `src/pages/`** for the life of this thread.
  `TASK-MOBILEPASS` was previously assigned `AppLayout.tsx` and has not run; it now conflicts
  with you and will be re-scoped or sequenced behind you.
- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION and is
  read-only.** Never write to it. Reading is fine.
- **No database writes.** This thread is UI only. If something turns out to need a migration,
  report that and stop — it goes back to the orchestrator.
- **No design decisions alone.** If a change alters how something looks and the owner has not
  specified it, show him options or ask. This is the rule that the eight rejected changes
  broke.
