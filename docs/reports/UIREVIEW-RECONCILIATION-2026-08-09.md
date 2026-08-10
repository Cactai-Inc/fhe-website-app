# UIREVIEW → orchestrator: reconcile before merge

**From:** thread `UIREVIEW`, branch `task/uireview` (pushed, `e53ecc2`)
**Date:** 2026-08-09
**Status:** merge to `main` HALTED by this thread. Nothing from this branch is on `main`.
**Asking for:** a reconciliation decision on 5 files before anything merges.

---

## 1. The other thread

**`UIBUILD`** — `docs/tasks/TASK-UIBUILD-implement-ui-orders.md`, queue at `docs/ui-orders/`.

Its work is already on `main`:

| commit | what |
|---|---|
| `f3f4f4d` | fix(header): give the header a real edge; split the avatar's two forms |
| `3e62816` | **same message, duplicate commit** — worth checking whether one is a stray |
| `de51ec8` | fix(nav): retire the stale green-panel palette on the Community Feed row |

All authored `Admin`, pushed straight to `main` with no merge commit, so no branch name
survives in history. `f3f4f4d` / `3e62816` being identical in message is the one thing here
that looks like an accident rather than a decision.

**Process note, stated plainly because it is the root cause.** `main` also carries
`docs: split the UI loop into two threads with an order queue between them`, which makes
UIREVIEW write change orders and UIBUILD implement them. **This thread implemented instead.**
The owner had told it the orchestrator was not involved and to work directly, and the split
landed on `main` after this branch was cut, so the thread never saw it. Meanwhile
`docs/ui-orders/` contains only `README.md` — **no orders were ever written**, so UIBUILD was
working from an empty queue while UIREVIEW built directly. Both threads then solved the same
owner requests independently.

---

## 2. What collides

Five files. 33 other files on this branch touch nothing `main` has changed.

| file | `main` (UIBUILD) | `task/uireview` | verdict |
|---|---|---|---|
| `app-header.css` | header **`box-shadow`** `0 2px 4px /.08` + `0 6px 18px /.10`; `border-bottom` deliberately kept **transparent**; avatar forms split; `letter-spacing` removed from the one-glyph avatar | **no shadow**; `border-bottom: 1px solid rgba(20,51,33,.15)`; desktop avatar takes the logo treatment (transparent + ring); mobile 66%→100% | **TRUE CONFLICT — design decision, not mechanical** |
| `AppHeader.tsx` | avatar's two forms split | `data-open` added to drive the 66/100 fill | probably reconcilable, both touch the same element |
| `AppLayout.tsx` | Community Feed row palette (`de51ec8`) | same fix **+** motion vocabulary, icon transitions, rail border, `overscroll-contain` | **partly duplicate** — see §3 |
| `ContractPage.tsx` | Send on locked docs; page bottom edge | Save button restyled | likely auto-merges, different regions |
| `CreateModal.tsx` | — | `overscroll-contain` only | trivial |

---

## 3. Already solved on `main` — do not merge twice

**Flicker cause 1.** Both threads independently diagnosed the Community Feed row as
`text-cream-100/80` on a near-white panel (1.08:1, invisible until hovered) and both landed on
the **identical** values — `text-green-800` idle, `group-hover:text-cream-25`. `main`'s version
is `de51ec8`. This branch's version is redundant and should be dropped in favour of it.

**Flicker cause 2 is NOT solved on `main`.** The chevron button still carries
`[@media(hover:hover)]:hover:bg-navfill/64` while its parent row carries the same fill, so
hovering it composites 0.64 over 0.64 — an effective 87%, rendering `#2c4e3a` against the
row's `#637c6d`. That is a real remaining defect on `main` and this branch has the fix.

---

## 4. The decision the orchestrator actually has to make

**Does the header have height, or do edges carry the structure?** The two branches answer
oppositely and both are internally coherent:

- **`main` / UIBUILD** — header lifted by a real shadow, border kept transparent on purpose
  (it holds 1px of the box open so a rule can be added later without reflowing a
  fixed-height, border-box header — a good reason, recorded in the file).
- **`task/uireview`** — nothing lifted; header, rail and subheader carry equal 1px edges.

The owner asked for the second in his own words — *"either the header loses the drop shadow
and the line used as a border is ever so slight enough to exist visually but remain subtle, or
the entire thing needs to be rethought"* — but he asked while looking at `main`, i.e. while
looking at UIBUILD's shadow. **He has not chosen since being shown both.** Options are rendered
at `docs/reference/chrome-edge-weights.html`.

One measured caveat on this branch's version: it set all three edges to `green-800/15`, which
renders **1.32:1** — at the threshold of visible. Consistency was right, that level was too
weak. `/25`–`/30` is where an edge reads as deliberate. Do not merge `/15` as-is.

---

## 5. Merges clean, no reconciliation needed

33 files, no counterpart on `main`:

- **`ee9a261`** — `overscroll-behavior: contain` on all 40 scroll containers. Owner's spec:
  keep the document's rubber-band, keep the page scrolling under an overlay, but stop a box
  the cursor is inside from delegating. A body-lock implementation was written, applied to 31
  files, and **reverted before commit** when the owner ruled out "artificial harnesses".
  *Known gap:* 8 overlays have no scrollable panel, so nothing binds — listed in the commit.
- **`7622e1c`** — motion vocabulary: `ease-glide` + `duration-320/440` as real theme values
  (the arbitrary form is trap T1 and emits nothing). Nav fills ease; the drawer glides instead
  of appearing and vanishing.
- **`b052637`** — Save as the outlined form of Send; favicon adopts the header mark.
- **`a51e779` / `e53ecc2`** — icon research: Phosphor mapped across all 76 routes under the
  owner's six buckets, every icon verified present. No dependency added.

---

## 6. Recommendation

1. Merge the 33 clean files now — scroll, motion, Save, favicon, icons, docs.
2. Drop this branch's Community Feed row change in favour of `de51ec8`.
3. Take this branch's chevron nested-fill fix; `main` still has that defect.
4. **Hold the header/avatar until the owner picks a model**, then have ONE thread implement it.
5. Check whether `3e62816` and `f3f4f4d` are a duplicated push.
6. Decide which thread owns `AppHeader.tsx` / `app-header.css` / `AppLayout.tsx` going
   forward. Two threads editing four files with no queue between them is how this happened,
   and last-push-wins is not a merge strategy.

---

## 7. Correction this thread owes the record

UIREVIEW told the owner three times that **no drop shadow existed on the header**. It does —
`f3f4f4d` added one. The thread verified against its own branch, cut from `5cce651`, before
that commit landed, and asserted the conclusion with more confidence than the evidence
supported. The owner was right. `docs/reference/UI-STATE-2026-08-09.md` on `main` is the
shared source of truth and this thread had never read it, because it did not exist at branch
time.
