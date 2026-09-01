# TASK-REQCARDS — running ledger

**Thread:** `TASK` · opened 2026-09-01 · spec
`docs/tasks/TASK-REQCARDS-the-request-card-is-an-action-surface-and-both-ends-press-buttons.md`
**Binding:** `docs/method/TASK-ROLE.md` · `docs/method/THE-RUNNING-RECORD.md`

## 🔴 RESUME — read this first
**STATE: STOPPED ON A QUESTION, BEFORE ANY EDIT. No worktree taken. No code written. Zero diff.**
**Two blocks, both confirmed by measurement, not inferred:**
1. **The machine this card drives does not exist.** `TASK-LIFECYCLE` is unbuilt
   (`docs/reports/` has no `TASK-LIFECYCLE-*`), and production's `bookings_status_check` does not
   permit `requested`, `approved` or `moved` — the three states every action on this card reads or
   writes. THE TEST §10.1 ("a `requested` booking … renders ONE card") is unreachable today.
2. **§9 THE SHAPE is unanswered** (DSGN-2 handoff ASK-OWNER **A2**) — the spec's own header says
   *"ORCH: route §9 to him first."*

**The question that went up:** sequencing (build `TASK-LIFECYCLE` first, or something else) + the
§9 shape ruling. **Next thread: do not start until both are answered.**

## CLNR (zeroth act)
CLNR: clean — no new §2a breakage. `wt-1` and `wt-2` are idle, clean, detached at `6ffbd0df` (main
HEAD); `wt-3` sits at `14140564` (BOOKS1 verification, merged). `docs/reports/` carries its
long-standing evidence attachments (`*.sql`, `*-output.txt`, `*-shots/`), unchanged by me.

## FIRST ACT — the spec read back
Build ONE staff-side card component plus its cluster, rendering a `requested` order and/or booking,
whose buttons CALL existing machinery — approve (LIFECYCLE transition), contact details, suggest a
different date/time (LIFECYCLE's hold/`Pending reschedule`), mark paid (`mark_purchase_paid`, never
a second writer), confirm Zelle received — and the client end of the same ping-pong: a dashboard
notification and an emailed deep link that opens `OrderPayment` as a modal for that order, with the
notifications closing as each act completes. **Status is derived, never typed; no dropdown.**
**I will not** touch the wizard (SIGNBOOK), the door (SIGNDOOR), month-view rendering, or any
payment method beyond cash/Zelle, and **I will not** create a status value or a second state
machine.

## SECOND ACT — the spec's premises, re-run 2026-09-01 (main @ `6ffbd0df`, not `475f1724`)
| Spec premise | Re-run | Verdict |
|---|---|---|
| "No staff request-card surface exists" | `grep -rn "RequestCard" src/` → 0 hits | ✅ holds |
| "The client payment half is built" | `src/components/order/OrderPayment.tsx` (13,435 b), consumed by `OrderDetail.tsx:152` and `Onboarding.tsx:1884` | ✅ holds — and note it already has a non-wizard home in `OrderDetail` |
| "Must merge first: LIFECYCLE + SIGNBOOK" | neither has a report or a branch; `docs/tasks/` has both specs only | ⚠️ **BLOCKING — neither is built** |
| The `requested` state exists to render | prod `bookings_status_check` = `draft available unavailable pending pending_slot pending_payment confirmed cancelled expired completed scheduled no_show` — **no `requested`, no `approved`, no `moved`** | 🔴 **THE TEST §10.1 CANNOT PASS TODAY** |
| §2 "main @ 475f1724" | main is `6ffbd0df` (SIGNDOOR + analytics merged since) | minor: spec's SHA is stale |
| LIFECYCLE Trap 9 ("BACKDATE and BOOKS1 unmerged, land first") | both merged — `98646249` / `14140564` | ✅ **LIFECYCLE's own dependency is now clear** |

## FACTS FOUND THAT THE NEXT THREAD SHOULD NOT RE-DISCOVER
- **The cluster has an incumbent the spec does not name.**
  `src/components/app/dashboard/NotificationsZone.tsx` (138 lines) is zone **N1** on **both** desks —
  first, uncapped, collapsible, never sticky, with dismiss via `consume_notification` (which already
  logs to `audit_logs` and `_log_notification_resolution`). Staff reach it through `OwnerDashboard`;
  members through `DashboardHome`/`DashboardPanel`. Its `KIND_LABEL` map already carries
  `request_new`, `purchase_unpaid`, `payment_received`, `booking_time_requested`.
  🔒 **This makes §9's "dedicated Requests band" a D18 question, not a styling one:** a second
  notification surface pinned above N1 is a second surface, and the owner's *"possibly a location"*
  is exactly the fork. Put it to him as: **new band above N1** vs **a rich, actionable row type
  INSIDE N1**.
- `OrderPayment` is **already reused outside the wizard** (`OrderDetail.tsx:152`), so "give it a
  modal home" is a third mount, not a relocation — and SIGNBOOK, not this task, owns removing the
  wizard's copy.
- `IntakePage.tsx:94` is the only `'requested'` string in `src/` and it is an intake column header,
  unrelated to booking status.

## EVENTS
- **2026-09-01** — opened. CLNR pass; spec read back; premises re-run; the two blocks confirmed;
  question sent up to the owner. **Nothing edited outside this ledger.**

---

# 🔒 THE OWNER'S ANSWERS — 2026-09-01, in his words where it matters
**All three questions came back. §9 (ASK-OWNER A2) IS NOW ANSWERED. DSGN must fold this into the
spec; it is recorded here so it cannot be lost if this thread dies.**

## A · SEQUENCING — **build `TASK-LIFECYCLE` first.** REQCARDS waits on it, as its header always said.

## B · §9 CLUSTER LOCATION — **a rich, actionable ROW TYPE INSIDE `NotificationsZone` (N1).**
Not a second band. One notification surface; the request card is a variety of notification row.

## C · THE REACH, and the CARD'S TWO DEPTHS — his words:
> *"the email that is sent to hello@fhequestrian.com to notify them of the request provides all the
> information about the request received and the link takes them to the login page for the app, when
> they login since they have a dashboard notification the app opens to the dashboard automatically
> and they find the notification and they should be able to take action on the notification without
> needing to go to another page, a quick action set of approve/mark paid/1-click contact to text or
> call or send them an email (based on the preference the client selected) and then clicking on the
> notification card itself opens a center placed large modal with the full set of options for
> handling the request, if a request doesnt have a specific date and time then the large modal might
> be opened to select a date and time before approving the request, make sure the date and time
> selected if there is one is shown on the notification otherwise the staff cant know what they are
> approving and the quick action buttons are useless."*

**What that pins, for the thread that builds REQCARDS:**
1. **No one-click-from-email actions.** The email is INFORMATION + a link to login; the app then
   opens on the dashboard and every action is taken signed in. No token endpoint, no anon surface.
2. **The row itself is actionable — without navigating.** Quick actions: **approve · mark paid ·
   one-click contact**, where contact dials/texts/emails **by the channel the client chose**
   (⚠️ find the client's stated contact preference; if no such field exists, that is a QUESTION, not
   a default).
3. **The row MUST show the requested date and time.** *"otherwise the staff cant know what they are
   approving and the quick action buttons are useless."* A row without the time is a failed build.
4. **Clicking the row opens a large, centre-placed modal** with the full handling set.
5. **A request with NO date/time is legal** — the modal is where staff pick one BEFORE approving.
   ⚠️ This is new: it means `requested` does not imply a chosen time, which REQCARDS §10.1 assumed.
6. ⚠️ **OPEN, and he offered to settle it:** *"if you need to know the full set of options for
   handling requests and payment declarations please ask me so we can discuss what the system
   already shows vs what is expected to be needed by staff or clients."* **The modal's full option
   set is NOT yet specified.** The REQCARDS thread must open with that conversation — inventory what
   the surfaces show today, put it beside what staff/clients need, and get the set locked.

## EVENTS (cont.)
- **2026-09-01** — answers received. This thread stands down on REQCARDS and takes `TASK-LIFECYCLE`
  as its build, per A. Ledger continues at `docs/reports/TASK-LIFECYCLE-LEDGER.md`.
