# TASK REVIEWNAV — a temporary "Review" section that puts every duplicate side by side

**Owner, 2026-08-11:**

> *"have the nav menu on admin on desktop create a section for Review: and lets use it while we
> audit and work on pages. then we can move the nav to the right location after the work is
> complete… we need to find all duplicates in the code, wire them up and make them visible for
> A/B, A/B/C, or A/B/C/D review by placing them side-by-side in the temporary 'Review' section.
> move the page link for the currently used page(s) from the current nav panel location to place
> it in the review section."*

**DEPENDS ON `TASK-DUPECENSUS`. Do not start until its report exists** — its final section is a
manifest of exactly what goes in here, and re-deriving it is wasted work you will get wrong.

**This is scaffolding with a demolition date.** Build it so it can be removed in one commit.

---

# WHAT THIS IS FOR

The owner's position, and the reason this exists rather than a document:

> *"Often the UI is nice in the original and the hack ass replacement is shoddy and worth shit."*

**He cannot judge that from a report.** He needs to click A, then B, then C, on the same day in
the same browser, and decide which one to build from. Everything below serves that and nothing
else.

---

# THE MODEL

## 1. One new nav group: `REVIEW`

- **Desktop admin nav.** The owner said *"nav menu on admin on desktop"* — scope it there.
  **State what you did about the mobile drawer**, which renders the same `navGroups`: showing it
  there too is fine, hiding it is fine, but it must be a decision with a sentence, not an
  accident.
- **It must look temporary.** This is scaffolding and it should read as scaffolding — the owner
  will otherwise be looking at it in three weeks wondering whether it shipped. Follow the
  preview-banner precedent ADMINSWEEP set (`InstructorHomePreview` — dashed gold, an explicit
  "not a live page" eyebrow) rather than inventing a second visual language for "temporary".
- **Admin only.** Use the existing `adminOnly` mechanism that `SETTINGS_GROUP` already uses.
  Do not invent a new gate.

## 2. Entries come from the manifest, labelled so the slot is obvious

`Horses A (in use)` · `Horses B (original 2026-07-01)` · `Horses C (module hub)`

**The label must say which is the incumbent and roughly what each is**, because the owner is
comparing them minutes apart and the URLs are not self-explanatory. Group them so A/B/C sit
together and adjacent groups do not blur into each other.

## 3. ⚠️ MOVE the live page's entry. Do not copy it.

> *"move the page link for the currently used page(s) from the current nav panel location to
> place it in the review section."*

**Remove it from its current group and add it to `REVIEW`.** Two entries for one page is the
duplication problem in miniature, and it would make the owner's comparison ambiguous — he would
not know whether he was looking at A or at the copy.

**Record where each one came from** — one comment or one table in the report listing every
moved entry and its original group. **The re-bucketing pass has to put these back**, and it is
the owner's stated next step. If that mapping is lost, this task has traded one mess for another.

## 4. Wire up what is not reachable — the minimum, and no more

The manifest marks each implementation `nav` / `url-only` / `NEEDS A ROUTE` / `RETIRED behind
<CONSTANT>`. For each:

- **`url-only`** — just add the Review entry.
- **`NEEDS A ROUTE`** — register one under `/app/ops/review/…`. **Do not resurrect a URL that
  was deliberately retired** and do not give a dead component a permanent-looking home.
- **`RETIRED behind <CONSTANT>`** — ⚠️ **do NOT flip the retirement constant.** Flipping
  `CONTACTS_PAGE_RETIRED` puts a retired page back into the live app for every user. Mount the
  component at a review route instead, leaving the constant `true`. **Say in the report which
  ones you handled this way.**

**Do not modify any page you are wiring up.** Not a class, not a label, not a fix. **The whole
point is that the owner sees them as they actually are.** A page tidied on the way into review
is a page he cannot judge. If you spot a defect while wiring, **write it down; do not fix it.**

## 5. Nothing about the live app changes except which nav group a link is in

- No page's contents change.
- No route is deleted or redirected.
- No retirement constant is flipped.
- `mod.*` entitlements are untouched.

**If wiring an implementation requires changing it to work at all, stop and report that.** That
is itself a finding about that implementation's quality, and it is the owner's call whether to
spend on it.

## 6. Removing this later must be one commit

Keep the group definition, its entries, and any review-only routes **together and clearly
marked**, so the re-bucketing pass deletes a block rather than hunting. **A comment at the top
saying what this is, who asked for it, and what removing it entails.**

---

# THE "OPS" LABEL — RECORDED HERE, NOT FIXED HERE

> *"some pages say Ops on them in the title area, and the section is MANAGEMENT, or People…
> the use of the term Ops, is meaningless unless it was a page that has a duplicate and one is
> Member the other Admin, but Ops, doesnt help me. And we will be rebucketing all the nav links
> after the restructuring and revisions."*

**Measured: `Ops` is user-visible in exactly two places.**

```
src/pages/app/ops/DocumentsQueuePage.tsx:337   <p className="eyebrow mb-2">Ops</p>
src/pages/app/ops/PaymentReviewPage.tsx:106    <p className="eyebrow mb-2">Ops · Payments</p>
```

Every other `OPS-` in the tree is an **internal surface identifier in a code comment**
(`OPS-DOCS-QUEUE`, `OPS-DASH`) and is not on screen. Those are fine and are not in scope.

**Do not fix the two eyebrows in this task.** The owner has said re-bucketing comes after the
restructuring, and an eyebrow is part of a page's naming, which is what that pass decides.
**Carry this note into the report so it is not lost.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-reviewnav`, branch `task/reviewnav`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **You own `AppLayout.tsx`** — but check first whether `TASK-PAGEVIS` or `TASK-HORSEONE` has
  merged, since both also change the nav. **Rebase before you start.** `TASK-HORSEONE` is
  **HELD** precisely so it does not consolidate the horse pages before this review happens.
- **`DashboardPanel.tsx` / `ops/IntakePage.tsx` belong to `TASK-LEADCLEAN`** and
  **`DataTable.tsx` to `TASK-FRAMESCROLL`** if either is still running. Do not edit them —
  **you may still add Review entries pointing at their routes.**
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Delete nothing. Fix nothing. Tidy nothing.**
- **T1 — arbitrary Tailwind values have silently emitted no rule at all in this repo, twice.**
  Use declared scale steps; grep anything you add out of the built CSS.
- No staff browser session exists and you will not be given one. **Prove the route table and the
  nav array; report the render as NOT VERIFIED.**
- **End the report with the owner's walkthrough: every Review group, its A/B/C URLs, and the
  order to look at them in.** That list is the actual deliverable — the nav is how he gets to it.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. A `REVIEW` group renders in the desktop admin nav, visibly temporary, admin-only.
2. Every implementation in DUPECENSUS's manifest has an entry, labelled with its slot and
   whether it is the incumbent.
3. Each one **loads** when clicked — including the ones that had no route before.
4. The live page's entry has **moved**, not been copied — it appears in `REVIEW` and **not** in
   its old group.
5. Every moved entry's original group is recorded for the re-bucketing pass.
6. **No retirement constant was flipped**, no page's contents changed, no route deleted.
7. Removing the whole thing later is one clearly-marked block.

Report to `docs/reports/TASK-REVIEWNAV-REPORT.md`.

---

# ADDENDUM 2026-08-12 — REVIEW IS A STANDING QUEUE, NOT A ONE-OFF COMPARISON

**Owner, asked what the Review section is actually for:**

> *"the purpose of the temporary review section is so we can put all the duplicate pages or
> similar pages together next to each other for quick review. **any new pages go here too for
> review before confirmation and acceptance that they are done and ready for use** (then they
> move to their new home). the moving of the nav link within the menu list order has only the
> intention of making it faster and easier to review them and to ensure nothing is forgotten or
> missed, **once its moved out of the review section its deemed done**. right now i have no way
> to manage this without keeping a running list manually external to the app interface."*

**Everything above this line still stands. This changes what the section IS, and therefore what
"done" means for this task.** Read it before building.

## What changes

### 1. Review has TWO intakes, not one

| intake | what enters | when it leaves |
|---|---|---|
| **Duplicates** — DUPECENSUS's manifest | every implementation of every duplicated concept | when the owner has picked a winner **and the consolidation has shipped and been accepted** |
| **New pages** — anything a thread builds | any page that did not exist before | when the owner has looked at it and accepted it |

**The second intake is new and the body of this doc does not contemplate it.** Build the group
so adding one entry is one line, because entries will be added continuously by other threads —
not once by this one.

### 2. Nav position IS the status. Say so on the page.

**Out of Review = deemed done.** That is the owner's acceptance signal and there is no other
one. It follows that:

- **Moving an entry out is a deliberate act with a meaning**, not tidying. The banner copy must
  say this in one sentence, so nobody — including the owner in three weeks, and including the
  next thread — reads an empty Review group as "the feature was abandoned" rather than
  "everything has been accepted."
- **The re-bucketing pass referenced in §3 above is not a separate future task.** It is what
  happens one entry at a time, as each is accepted. Keep the origin-group mapping (§3) as a
  **living table in the report**, not a one-time record — the next thread to accept something
  needs to know where to put it back.

### 3. "Temporary" applies to the CONTENTS, not the mechanism

§6 above says removing this later must be one commit. **That requirement is now secondary to a
more important one:**

- **Removing ONE ENTRY must be cheap and obvious** — that is the operation that will actually
  run, repeatedly, for months.
- The whole-block removal stays a goal, but **do not trade per-entry simplicity for it.**
- **Do not write a demolition date into the code.** It has no demolition date; it empties out.

### 4. Scope is ALL of DUPECENSUS's manifest — including the groups already ruled on

**This reverses the scoping question DUPECENSUS raised.** People (`TASK-ONEPEOPLE`) and Horses
(`TASK-HORSEONE`) have owner rulings but **have not shipped and have not been accepted**, so by
the rule above they belong in Review. A decision is not an acceptance.

### 5. Consequence for sequencing — REVIEWNAV GOES FIRST

**`TASK-ONEPEOPLE` builds a new page. By this addendum's own rule, a new page goes to Review for
acceptance. So Review has to exist before ONEPEOPLE lands, or ONEPEOPLE has nowhere to arrive.**
Same for `TASK-HORSEONE`.

Both also edit `AppLayout.tsx`, which this task owns. **Do not run them concurrently with this
one** — that is the exact failure mode `docs/reports/TASK-DUPECENSUS-REPORT.md` documents, where
four threads landed on `main` mid-audit and closed three findings out from under it.

## What this does NOT change

- **Still no page contents change. Still no retirement constant flipped. Still fix nothing.**
  §4 and §5 above are unaffected — a page tidied on the way into Review is a page the owner
  cannot judge.
- **Still MOVE the live entry, do not copy it** (§3).
- **Still admin-only, still desktop nav, still visibly not-a-live-page** (§1).

## The test this addendum adds

8. **A new page can be added to Review in one line**, and the mechanism for doing so is written
   down where the next thread will find it.
9. **The section's own copy states that leaving Review means accepted** — not that the section
   is scaffolding awaiting deletion.
10. **The origin-group table is written as a living record** the next accepting thread updates,
    not as a closed one-time list.
