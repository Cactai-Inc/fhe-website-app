# GLOBALIZATION DEBT — measured 2026-08-12

> **STATUS: RECORDED, NOT SCHEDULED. DO NOT ACT ON THIS YET.**
>
> **Owner, 2026-08-12:** *"Dont act on it yet, note it well and the full sweep we do after we
> finish these spot checks can include refactoring the entire repo to ensure everything is using
> globalization wherever possible."*
>
> This is the measurement so the sweep can be scoped when it is time. **No thread should
> implement any of it until the owner opens that work.**

---

# WHY THIS EXISTS

Surfaced while sizing `TASK-DUPECENSUS`. The owner's standing complaint is *"this entire build
has been plagued by fucked up UI and shoddy wiring."* Duplication is one cause and has its own
census. **This is the other one, and by these numbers it is the larger.**

The app has a shared frame, a shared table, a shared modal, a shared empty state and a declared
design-token scale. **Almost nothing uses them.** Every page that does not is a page that
invented its own header height, its own width cap, its own control placement and its own
spacing — which is exactly why *"the add-new button sits at a different height on every page"*
was true, and why fixing it page-by-page never finished.

---

# THE MEASUREMENT — `src/pages/app`, 80 page files

## Shared primitives: adoption

| primitive | used in | adoption |
|---|---|---|
| **`PageHeader`** | **1 / 80** | **1%** |
| **`PageLayout`** | **9 / 80** | **11%** |
| `EmptyState` | 3 / 80 | 3% |
| `PageCreateButton` | 4 / 80 | 5% |
| `StatusBadge` | 15 / 80 | 18% |
| `Modal` | 16 / 80 | 20% |
| `DataTable` | 19 / 80 | 23% |
| `ModuleGate` | 20 / 80 | 25% |
| `useAsync` | 23 / 80 | 28% |

**`PageLayout` at 11% is largely `TASK-PAGEFRAME`'s doing** — it converted 8 pages on
2026-08-11. Before that day the number was **1**.

## Hand-rolled chrome

```
63 of 80 pages   render their own <h1>          (rather than through PageHeader)
16 of 80 pages   render their own eyebrow       (className="eyebrow")
```

**`PageHeader` exists specifically to own that row.** Its docstring records the owner's own
report — *"the add-new button sits at a different height on every page — new deal higher than
new contract, lower than new horse"* — and notes *"Ten pages had hand-rolled this row, so they
drifted."* The real number is **63**.

## The arbitrary-value surface — this is the T1 trap, at scale

```
885 arbitrary Tailwind values  across  105 files   (src/pages + src/components)
```

**Every one is a place a rule can silently fail to emit.** This repo has been bitten twice, in
production, by exactly this:

- `bg-cream-100/[0.92]` — emitted **no rule at all**; the header shipped as bare blur.
- `border-green-900/12` — `/12` was absent from the opacity scale; the border did not exist. The
  sweep that fixed it found `/8` missing too, across six more sites in four files.

**A class that compiles is not a class that emits.** The standing rule — grep every added value
out of the built CSS — is a per-task defence. **885 pre-existing instances have never been
checked.**

---

# WHAT THE SWEEP SHOULD DO, WHEN IT IS OPENED

Recorded now so it does not have to be re-derived. **Not a plan to execute.**

1. **`PageHeader` / `PageLayout` across all 80 pages.** The highest-leverage item: it settles
   header height, width cap, eyebrow, title, description and control placement in one component
   for every page at once. **63 hand-rolled `<h1>`s is the work list.**
2. **Audit all 885 arbitrary values against the emitted CSS.** Mechanical, scriptable, and it
   ends a whole class of invisible defect. **Anything that emits nothing is a live bug today.**
   This can be done independently of everything else and is the cheapest real win here.
3. **`EmptyState` at 3%** — every page that can be empty should say so the same way. Its absence
   is why "empty" has read as "broken" repeatedly.
4. **`DataTable` at 23%** — find the hand-rolled tables beside it. `TASK-FRAMESCROLL` is fixing
   the overflow bug in `DataTable` itself; **a hand-rolled table does not inherit that fix**, so
   this list is also the list of pages that will still scroll the whole page sideways.
5. **`useAsync` at 28%** — the shared loading/error path. A page not using it is a page that
   probably has no error branch.

## Sequencing note

**Do this AFTER the duplicate consolidation, not before.** Converting a page to `PageLayout` and
then discovering it was the losing half of a duplicate is work spent on something about to be
retired. `TASK-DUPECENSUS` → `TASK-REVIEWNAV` → the owner's rulings → consolidation → **then**
this sweep, over the pages that survived.

**The one exception is item 2.** The arbitrary-value audit is independent of which pages
survive, finds live bugs rather than inconsistency, and can run whenever.

---

# HOW TO RE-MEASURE

```bash
total=$(find src/pages/app -name '*.tsx' | wc -l)
for c in PageLayout PageHeader PageCreateButton DataTable EmptyState StatusBadge Modal useAsync ModuleGate; do
  echo "$c: $(grep -rl "\b$c\b" src/pages/app --include='*.tsx' | wc -l)/$total"
done
grep -rl "<h1" src/pages/app --include='*.tsx' | wc -l              # hand-rolled headers
grep -rho "\[[0-9][^]]*\]" src/pages src/components --include='*.tsx' | wc -l   # arbitrary values
```
