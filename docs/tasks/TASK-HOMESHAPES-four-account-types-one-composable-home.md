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

**§1b — THE TRAINER IS ALWAYS CLAIRE. Stop asking (owner, 2026-08-24):** *"the trainer is always
claire there is no need to select a trainer when a lesson or any other service is scheduled."*

Verified: the tenant has exactly **two** staff identities — `hello@fhequestrian.com` (Claire) and
`admin@fhequestrian.com` (CJ), both titled Owner. The third staff row is `admin@cactai.io`, the
PLATFORM owner, which D1a says is never a tenant identity. And on bookings today: **527 have no
instructor at all**, 11 are Claire, 1 is CJ — so the selector is already being skipped far more
often than it is used, and skipping it loses the attribution entirely.

**Default it, do not delete it.** `instructor_user_id` still earns its place: it is the
attribution on the booking and it is what D7's act-as-company trace reads. The change is that
nothing ASKS — the field is populated with the tenant's instructor and the control disappears.
Seven files carry a selector today: `SessionFields.tsx`, `AgreedLessonPanel.tsx`,
`ScheduleSessionForm.tsx`, `CalendarItemPanel.tsx`, and the three libs behind them.

⚠️ **Do not hardcode Claire's user id.** That is a TENANT FACT HARDCODED IN CODE — a fact frozen
into code. It belongs in the value registry / tenant settings beside the other tenant identity
values, so a second instructor one day is a settings change and not a thread.
⚠️ **The 527 unattributed bookings are a separate decision** — backfilling them asserts Claire
taught lessons nobody recorded her at. Leave them, and say so, unless the owner rules otherwise.

**§2 — The one missing read for horse owners:** a horse-scoped upcoming-appointments function
over `bookings` + `fulfillment_units`. Small, and it unblocks the whole "Your horse" zone.

**§3 — The parent surface**, which needs its own decisions before code:
- a dependent-scoped read family (progress, plan, schedule, reports) — the guardian link exists,
  the reads do not;
- ~~**who may see what** — a guardian reading a minor's notes is right, an adult dependent is
  not.~~ **SETTLED, owner 2026-08-24: "we dont have adult dependents."**
  **A dependent IS a minor.** So the guardian link alone is sufficient authority — a
  dependent-scoped read needs no age test and no permission layer beyond
  `guardian_contact_id`, which is what every existing guardian path already trusts
  (`generate_my_onboarding_documents`, `sign_release`, `ensure_contract_role_documents`).
  Confirmed against production: exactly ONE dependent exists — Gabriella Olenik, DOB 2013,
  guardian Brian Olenik — and she is a minor.
  ⚠️ **The one thing to preserve:** `is_minor_contact` already gates delivery so a minor is never
  emailed directly (C10 — guardian-addressed delivery). A parent zone must read the dependent's
  activity without becoming a second path that emails the child.
  D8's linked-accounts item (separate logins, shared records by add-by-email) is a DIFFERENT
  feature — adults sharing a horse record — and stays unbuilt scope.
- ~~*"sharing captured content"* — no storage or capture path exists.~~ **WRONG, CORRECTED BY THE
  OWNER 2026-08-24.** The community feed IS the sharing location and the path already works —
  *"thats why there is content in there."* Capture means a parent filming their child on a phone;
  **we are not involved in capture and we do no editing.** The real work is CONSTRAINTS AND
  COMPRESSION on the posting control, so the feed "runs smoothly, looks professional, and dont get
  out of control in storage costs." Full audit and build plan:
  `docs/archive/HANDOFF-OFFERINGDOCS-2026-08-24.md` §5.2 — in short, image compression before upload is
  missing entirely and is the single biggest storage lever, the `feed-media` bucket has no
  `allowed_mime_types`, and nine other buckets have no size limit at all.
- **SETTLED, owner 2026-08-24:** *"parents can contribute to everything their dependent has
  access to or does but they need to be listed as such — a note needs to inherit the ability to
  stamp entries with who wrote them... so a third party listed as their name along with their
  childs name for the things they wrote, and then Claire's name as the trainer."*

  **His assumption is correct — the stamping already exists.** `booking_notes` carries
  `author_user_id`, `author_role` and `author_name`, so every note already records who wrote it
  and displays their name. Nothing needs inventing.

  **The one real gap is the vocabulary.** `booking_notes_author_role_check` admits exactly
  `rider · instructor · staff · admin` — **there is no guardian/parent role.** So the build is:
  1. widen that CHECK to admit `guardian`;
  2. let a guardian WRITE on a booking belonging to their dependent (the write path and RLS
     today assume the rider is the author, or staff are);
  3. render three names where two render now — the parent (as guardian), the child (as rider),
     and Claire (as instructor). `author_name` already exists to carry it.

  ⚠️ **"contribute to everything their dependent has access to or does" is broader than notes.**
  Booking, rescheduling, documents and purchases are all in scope by that sentence. Notes are the
  first instance, not the whole ruling — scope the guardian-acts-for-dependent capability
  deliberately rather than one surface at a time.

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

- **Parents are the bulk of the work** and carry the open product questions — though LESS than
  first assessed: sharing is not a new product, it is constraints on an existing one (§3 above). Riders, horse owners and
  deal parties are mostly surfacing what already exists.
- **"Content worth looking at"** is the owner's own precondition on the community zone. It should
  render only when the feed has recent posts — self-hiding, like everything else here.
