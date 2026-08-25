# TASK-HOMESHAPES — four account shapes, one composable home

**Owner spec, 2026-08-24.** Verbatim, because the four lists are the requirement:

> 1) **Riders** — care about their lesson schedule, their subscription or credits, their past
> and future lesson notes and lesson plans, their individual goals and their progress, plus they
> will care about the community feed content once we have content worth looking at.
> 2) **horse owners (riders and care services clients)** — care about their horse, the horses
> schedule for care, riding (if they are a rider or have exercise services from us), horse
> supplies and their horses vet, farrier, and trainer, plus any contracts for leasing the horse out.
> 3) **deal parties** — care about the document content, the progress / status, knowing when
> something is needed from them, and the final copies of all documents.
> 4) **parents** — cares about their dependents progress, planning, schedule, and sharing
> captured content, as well as setting trainer notes and feedback.

---

## 1. THE ARCHITECTURE — ZONES, NOT FOUR PAGES

**A person is several of these at once.** The owner's own second bullet says so — *"horse owners
(riders and care services clients)"* — and a parent who rides while owning the horse their child
learns on is one account holding all four shapes. Four separate home pages force a question with
no correct answer: *which one do we send them to?*

That question has already cost something. `/app/care` and `/app/deal` were built 2026-08-12 and
reachable **only** by a redirect that fired when a member lacked a `riding` category. Nothing
links to them — no nav row, no `pageRegistry` entry, no `<Link>` anywhere in the codebase — and no
account has ever satisfied the condition, because all five members resolve to `riding`. The same
redirect is what shut the owner out of the community feed on 2026-08-24.

**So: one home, composed of zones, each rendering only when it holds something.** That is
literally D13's recorded exception (owner, 2026-08-22): *"The dashboard doesn't need an editor in
the traditional sense. Surfaces should be fluid and dynamic and only shown when there is something
to show."* A rider sees rider zones. A rider who owns a horse sees both sets. A deal party who
does nothing else sees documents and nothing else — which is correct, and needs no routing
decision to achieve.

**The framework exists.** `src/lib/dashboard/registry.ts` already drives the two owner dashboards
this way — a zone list with an order, each backed by one read, each self-hiding. This adds a
member view to it rather than inventing a second mechanism.

⚠️ **`/app/care` and `/app/deal` are then absorbed, not deleted** (D32). Their content becomes
zones; the routes stay until the zones prove out.

---

## 2. WHAT ALREADY EXISTS — audited live, do not re-derive

Most of this is built and simply not surfaced. The reads below are live database functions.

### Riders — fully covered by existing reads
| The owner asked for | The read that answers it |
|---|---|
| lesson schedule | `my_lesson_sessions`, `my_standing_slots` |
| subscription or credits | `my_fulfillment`, `my_monthly_plan` |
| past & future lesson notes | `my_lesson_reports` |
| lesson plans | `my_lesson_plan` |
| goals and progress | `my_lesson_progress` |
| community feed | the feed itself — now open to every account holder |

### Horse owners — covered except one
| The owner asked for | The read |
|---|---|
| their horse | `my_stable_horses` |
| vet, farrier, trainer | on the horse record (`horses`) |
| horse supplies | `horse_medications` — medications **and** supplements |
| leasing contracts | `my_contract_documents`, `my_documents` |
| **the horse's schedule for care / riding** | ⚠️ **NO READ EXISTS.** `bookings` and
`fulfillment_units` carry it, but nothing returns "this horse's upcoming appointments" |

### Deal parties — fully covered
| The owner asked for | The read |
|---|---|
| document content | `my_contract_documents`, `my_documents` |
| progress / status | `status_events` + `documents.current_status` |
| when something is needed from them | `my_wall_state` (now carries the asked-but-not-demanded set too) |
| final copies | `my_executed_delivery_state` |

### Parents — ⚠️ **THE REAL GAP. Nothing here exists.**
Eight functions mention `guardian_contact_id` and **not one of them reads a dependent's activity**
— they are onboarding, signing and account-purge paths. Every member-facing read
(`my_lesson_progress`, `my_lesson_reports`, `my_lesson_plan`, `my_lesson_sessions`) is scoped to
`current_contact_id()` and **has no dependent-scoped variant**.

So a parent today can see their own lessons and nothing about the child they are paying for.
This is the one shape that is a build rather than a surfacing job, and it is the one with the most
product judgement in it — *"sharing captured content"* and *"setting trainer notes and feedback"*
are new capabilities, not new views.

---

## 3. WHAT TO BUILD

**§1 — A member view in the zone registry.** One order, all four shapes, self-hiding.
Proposed sequence — soonest-and-most-actionable first, which is the order the owner dashboards
already use (time → money → attention → reference):

1. **Needs you now** — unsigned documents, unanswered requests, a payment declared and unconfirmed.
2. **Your next lesson** *(rider)* — the standing slot or the next booking.
3. **Your horse** *(horse owner)* — each horse, its next care/riding appointment, its people.
4. **Credits & plan** *(rider)* — what is left, what renews, when.
5. **Your progress** *(rider)* — goals, the current plan, the last report.
6. **Your dependents** *(parent)* — one card per child, their next lesson and latest note.
7. **Your documents** *(deal party)* — status, what is outstanding, executed copies.
8. **From the community** — the feed, once there is content worth showing.

**§2 — The one missing read for horse owners:** a horse-scoped upcoming-appointments function
over `bookings` + `fulfillment_units`. Small, and it unblocks the whole "Your horse" zone.

**§3 — The parent surface**, which needs its own decisions before code:
- a dependent-scoped read family (progress, plan, schedule, reports) — the guardian link exists,
  the reads do not;
- **who may see what.** A guardian reading a minor's lesson notes is right; the same mechanism
  pointed at an adult dependant is not. D8's linked-accounts item is recorded scope and unbuilt.
- *"sharing captured content"* — photos/video of a lesson. **No storage or capture path exists
  for this today.** It is a product, not a zone.
- *"setting trainer notes and feedback"* — parents WRITING notes is new; today notes are staff
  output. Whether a parent authors, or requests, or only reads, is the owner's call.

**§4 — Absorb `/app/care` and `/app/deal`.** Their content becomes zones 3 and 7. Routes retained
(D32); the pages stop being orphans by becoming the zone's "see everything" destination.

---

## THE REACH

`/app/dashboard` for every member — one address, whatever shapes they hold. The community front
door stays `/app`. No account type is ever redirected away from either.

## THE TELL

A rider with no horse sees no horse zone. Buy a care service and it appears, with no setting
changed. A deal party with one contract sees one zone and an otherwise quiet board — which is the
correct amount of app for someone whose only relationship with us is a document.

## FLAGGED BEFORE STARTING

- **Parents are ~70% of the work** and carry every open product question. Riders, horse owners and
  deal parties are mostly surfacing what already exists.
- **"Content worth looking at"** is the owner's own precondition on the community zone. It should
  render only when the feed has recent posts — self-hiding, like everything else here.
