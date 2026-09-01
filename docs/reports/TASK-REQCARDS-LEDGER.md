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
