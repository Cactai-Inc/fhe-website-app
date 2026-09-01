# TASK-AR3 — the Records page becomes Contacts, and horses go to My Stable

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST.** **You are writing a report. You are
fixing nothing.**

**Owner, 2026-08-29 — two items, one decision:**
> *"3) move Leads, Clients, Partners, Vendors to a Page called Contacts with a nav link in the
> sidebar nav on desktop and in the mobile menu."*
> *"4) move horses to the My Stable Page or if its still shown there, remove it from the records
> page. Add My Stable to the sidebar nav on desktop and the nav in the mobile menu."*

⚠️ **These are one task because they are one question: what happens to the Records page.** Answering
them separately produces two plans that fight over the same tab strip.

---

## 1. WHAT EXISTS TODAY — verified 2026-08-28

**`src/pages/app/RecordsPage.tsx` is a 133-line tab shell** at `/app/records` and `/app/records/:tab`,
with **ten tabs**: `leads · clients · partners · vendors · horses · lessons · documents · files ·
deals · archived` *(archived is admin-only)*. The tab content is delegated, not inline.

**The registry row is `{ key: 'people.records', path: '/app/records', label: 'Records', group:
'accounts' }`** — `pageRegistry.ts:152`. ⚠️ **The `accounts` group is already labelled "People"**
(`AppLayout.tsx:634`), not "Records".

⚠️ **There is a SECOND Records row: `{ key: 'records.hub', path: '/app/ops/records', label:
'Records', group: 'modules', module: 'mod.horserecords' }`** — `pageRegistry.ts:195`. **Two nav rows
both labelled "Records", in two different groups, on two different paths.** Establish what each
actually serves and which the owner has been using.

**On the horses side:** `HorseRecordsPage.tsx` exists and carries `HORSE_RECORDS_STANDALONE_RETIRED`
— a retirement flag. **Find out what that flag currently does and whether the standalone page is
reachable.** ⚠️ **CR-74 records that the owner rates the horse-records row-card as the best editing
surface in the app** — *"its bug free and works great … one is clearly superior ux and ui"*. **That
component is an asset. Identify it precisely so it survives the move.**

## 2. THE QUESTIONS YOUR REPORT MUST ANSWER

1. **What is on each of the ten tabs today**, and **which of them belong on a page called Contacts?**
   The owner named four — leads, clients, partners, vendors. ⚠️ **Say explicitly what happens to the
   other six** (lessons, documents, files, deals, archived, horses). *"Not mentioned"* is not an
   answer; each one has to land somewhere or be retired.
2. **Does "My Stable" already exist?** ⚠️ **A member-facing "My Stable" card exists on the account
   page** (CR-58 and CR-68 both discuss it). **Is the owner asking for that surface to become the
   staff home for horses, or for a new staff page that borrows the name?** ⚠️ **Answer it from the
   code and from what he has said — and if it is genuinely ambiguous, flag it rather than choosing.**
3. **What is the nav shape afterwards** — Contacts and My Stable as two rows, in which group, on
   desktop **and** in the mobile menu? ⚠️ **Both surfaces are in `AppLayout.tsx`; name the exact
   lines.**
4. ⚠️ **What breaks when `/app/records` changes shape?** Deep links, the `:tab` route, anything that
   navigates to a named tab, and `RecordsPage`'s own cross-links. **D17: routed is not reachable, and
   the inverse — a route that disappears takes its inbound links with it.**
5. **Do Partners and Vendors carry anything Leads and Clients do not?** Different columns, different
   actions, different document requirements. **If they are the same surface with a filter, say so.**

## 3. THE TRAPS

### ⚠️ UPDATE, 2026-08-30 — THE CR-30 COLLISION IS RESOLVED. STOP TREATING IT AS OPEN.

**An earlier version of this brief told you to surface a collision with CR-30, which ruled that leads
leave the records page entirely. The owner has now ruled again and the collision is gone:**

> *"yes i changed my mind on item 3, after testing the unified single records page it was clearly not
> the right decision. This new revision set should help me understand the other side of the options
> and if i like it, then its the basis for the refactor, if i dont like it, the refactor has more
> work to do to come up with a 3rd option."*

⚠️ **Under the ledger's override rule the earlier statement is DELETED — proceed as if it was never
made.** **Leads belong on Contacts, with Clients, Partners and Vendors. Build the plan for that. Do
not raise it as a question, and do not hedge the plan against CR-30.**

⚠️ **BUT CARRY HIS REASONING INTO YOUR PLAN, BECAUSE IT CHANGES WHAT "GOOD" MEANS HERE.** He is not
claiming this shape is right — **he is buying information.** The unified records page was tested and
rejected; this build exists so he can judge the opposite option against something real.

**Three consequences for your report:**
1. ⚠️ **This is an experiment with a declared exit.** *"if i dont like it, the refactor has more work
   to do to come up with a 3rd option."* **A third option still being needed is a SUCCESS of this
   build, not a failure of it.**
2. **So plan it to be JUDGED, not to be permanent.** ⚠️ **Prefer the reversible option at every fork,
   and say in your plan what it would cost to undo.** Retire behind a flag (D32), never delete.
3. ⚠️ **Say explicitly what QUESTION this build answers for him** — what he will be able to tell
   after using it that he cannot tell today. **That sentence is the real success criterion**, and it
   belongs at the top of your plan.

**The other half of CR-30 survives:** a lead can be a row on Contacts *and* surface as a dashboard
item. **Only "get rid of leads as a record tab" is deleted.** Full ruling: `docs/reference/CHANGE-ORDER-LEDGER.md`,
the CR-30 supersession entry.

⚠️ **CR-75 rules the client record is an EXPANDING ROW on the list**, not a page you travel to.
**Whatever Contacts becomes has to host that pattern.**

⚠️ **`TASK-AR2` is consolidating the client-record surfaces that these tabs open into.** Its outcome
lands inside your page. **Report the dependency; do not design AR2's surface.**

⚠️ **`TASK-AR4` owns the nav section taxonomy** — renames, section moves, which group things sit in.
**You own the two new rows and their labels; AR4 owns the sections they sit in.** Name AR4 in your
contended-files list, because you will both want `pageRegistry.ts` and `AppLayout.tsx`.

⚠️ **`GROUP_LABEL` in `pageRegistry.ts` is dead** — exported, read by nothing. The real labels are
string literals at `AppLayout.tsx:633-649`.

## 4. OUT OF SCOPE

Building anything · section renames and moves (AR4) · the record surface itself (AR2) · module pages
moving to the account page (AR5).

## 5. REPORT

`docs/reports/TASK-AR3-REPORT.md`, standard §4 shape. Worktree `wt-ar3`, branch `task/ar3`.
**Commit the report only. Do not push.**
