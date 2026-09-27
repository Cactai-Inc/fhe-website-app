# TASK-FULLAUDIT — full-application defect & completeness audit

**Owner directive, 2026-09-25.** Captured VERBATIM below before any planning, per the
owner's explicit instruction. Nothing in this section is paraphrased.

---

## A. THE OWNER'S REQUIREMENTS — VERBATIM

> lets pause for a moment on this and fix an issue with the calendar. the week view no
> longer allows the user to slide horizontally between weeks to view more than the
> current week. After identifying the cause of this issue, i would like you to review
> the entire application for bugs and other defects, omissions, or other items that need
> attention. If there are things that are still incorrectly wired, or missing
> functionality like CRUD, edit buttons or multi select capability, anything that is
> preventing the users from using the application to its intended functionality and
> purpose must be found and presented to me for review and potential remediation.
> furthermore i need you to include in your analysis the analysis of the connectivity
> between findings, the centralization of resources and the usage of global elements and
> configurations/design/formatting. we should not be hardcoding things that could be
> centralized and standardized. if you have any questions. please ask them before you
> begin so you can do your work uninterrupted and i can go to bed while you perform your
> analysis and generate your report. to be clear this requires you to work from the UI
> downward into the code to the fullest depth, this is not a grep operation nor is it a
> surface level audit or arbitrary depth level governed review. if you find something
> shown on a page and it requires looking 5 folders deep or you see something that is
> shown on a page and wired incorrectly you need to look at similar pages to see if they
> have the same item missing, evaluate if other items are missing or should be included
> when the missing item is implemented, it may take several passes over the same files to
> fully understand the big picture and the comprehensive understanding of all the details
> as well as the context within which the contents are used so your suggestions and
> findings are rooted in user usage and application functionality that is aligned with
> the real needs and purposes of the app, its not sufficient to add an edit button
> without then making sure there is the ability to actually edit the things that should
> be editable, likewise its not sufficient to add a delete button without ensuring the
> delete function actually deletes the item(s) its put in place to remove. if you fun
> into rules or decisions that conflict with best practices, industry norms, standard
> user expectations or percieved necessities, ignore the rule and author the suggestion
> with a note about the rule so it can be evaluated alongside your suggestion and we can
> determine if the rule needs revision/removal or if the suggestion needs
> modification/omission. its highly likely you will find pages that should be used that
> have no nav, improper nesting, missing CRUD, missing multi select, data sources that
> are wired to tables that other elements with the same data are not using, and things
> that are not wired at all. plenty of non functional buttons, links, tips, and page
> formatting/layout/design/styling and contents are certain to be non-conforming to your
> mission directive which is to ensure the application works to the full extent it is
> intended to and it serves the needs of the users to this extent and everything complies
> with best practices, clean code, and doesnt contain outdated notes, commented out
> functions or features or elements, and isnt attempting to document things like changes
> that no one needs referenced because the code hasnt been seen or known by anyone who
> will benefit from preserving this information. before you perform this work you need to
> capture this entire set of requirements in its verbatim form in a file in the repo,
> then write up a work plan for me to review and approve, then upon approval your first
> task is to write up a statement of what success looks like after your work is complete.
> this will be what you measure your final output against to ensure nothing is missed,
> skipped, ignored, or overlooked for any reason. After writing this file into memory and
> generating your plan you will also need to write up a handoff prompt so this thread can
> be left to work on this set of lessons and we can run this full task set inside a new
> thread. also, the repo is filled with a massive amount of work trees that may or may not
> be worth continuing with. I need a report on what each work tree is working on and your
> ruling on what to do with it. if any are working on things you have already completed,
> we can make note of that and i will find the thread doing that work and ask it to review
> the current code against what it is tasked with and decide if the work is complete in
> which case the work tree can be properly freed up for another thread.

---

## B. OWNER DECISIONS ON HOW TO RUN IT (answered 2026-09-25, before start)

1. **THIS thread produces artifacts ONLY, then stops.** It writes: this capture file, the
   work plan, the success statement, the handoff prompt, and the worktree report + rulings.
   It does NOT begin the audit — a fresh thread runs the deep audit from the handoff.
2. **BLOCK until the owner approves the work plan.** Do not begin analysis on the plan
   without sign-off. (Applies to the fresh thread; this thread stops regardless.)
3. **FINDINGS ONLY.** The audit changes NO application code. The deliverable is a report the
   owner triages: every defect, omission, mis-wire, and centralization opportunity, with
   severity and connectivity analysis, presented for review and potential remediation. The
   one exception already taken: the calendar week-view horizontal-slide fix (commit
   517db211), done before this directive's findings-only rule was set.
4. **PRIORITY ORDER: staff/ops surfaces first** (calendar, lessons, records, orders/payments,
   contracts, dashboard — the daily drivers), then member-facing, then public/marketing.

---

## C. THE CALENDAR BUG (fixed 2026-09-25, commit 517db211) — the triggering item

**Cause identified:** `body { overflow-x: clip }` in `src/index.css` (the page-fit guard added
2026-09-14 to stop the page opening wider than the screen on iPhone) swallows a NESTED
`overflow-x:auto` scroller's overflow on iOS Safari. The week grid is `min-w-[720px]` inside
such a scroller, so on a phone the later days — and thus the sense of "sliding horizontally
across the week" — became unreachable. `overflow-x: clip` clips descendants hard and does not
let a descendant scroll region present content past the clipped edge.

**Fix applied:** the week-grid scroller now claims the horizontal pan explicitly
(`touch-action: pan-x pan-y`, `overscroll-x: contain`, `-webkit-overflow-scrolling: touch`) so
the gesture is honored inside it without reintroducing the page-slides-past-its-edges
regression. ⚠️ **Not verified in a live browser from the working session** — must be confirmed
on the owner's device. Fallback if still broken: remove the body clip and instead contain the
one or two genuinely-wide children directly (bigger change, deferred).

⚠️ **This cause generalises and is a SEED FINDING for the audit:** any nested horizontal
scroller in the app (data tables, wide cards, other grids) is at risk from the same body clip.
The audit must check every `overflow-x` scroller against it.
