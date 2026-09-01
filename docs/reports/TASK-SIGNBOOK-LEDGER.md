
### 3 · THE DESIGN, LOCKED — every piece converges on a named incumbent
| The owner's step | Incumbent found | What I do |
|---|---|---|
| 3 details first | `Onboarding.tsx` `details` step (SIGNDOOR) | nothing — already first |
| 4 then sign | `sign` step | nothing — already after details |
| 5 then the offering | `shop` step + `create_my_purchase` (draft) | make it REACHABLE from signing (it is not, see §4) |
| 6 then a day and time | ⚠️ **nothing in the wizard**; `request_open_time` + `CalendarPage`'s "Request this time" | NEW `time` step, calling the incumbent |
| 7 submit the request | `request_open_time` → `bookings.status='pending'` + `booking_change_requests(kind='new')` + `notify_staff` | NEW `submit` step → `submit_my_booking_request`, which CALLS `request_open_time` |
| 8 one email, docs + order + booking | `document_delivery_holds` + `deliver_executed_document_set` + `/api/deliver-documents` + `DOCUMENT_SET_PARTY_COPY` | hold at `sign`, release at submit, with order+booking context |
| 9 overview modal | `AppOverviewModal` | verify only |
| 10 staff notification AND email | `notify_staff` (in `request_open_time`) + `/api/request-received` + `REQUEST_RECEIVED` template | link a `requests` row (channel `booking`) so the incumbent alert carries order + time — **no endpoint change at all** |

**Payment (Trap 2):** gated on `arrivedWithOrder` — `my_onboarding_state().purchase` present at MOUNT.
That IS the staff-provisioned door, and it keeps today's machine unchanged, `payment` step included.

### 4 · ⚠️ THE BLOCKER, FOUND BEFORE ANY EDIT (§5.7)
`Onboarding.tsx:989-996` — when the last signature lands:
`if (next.purchase && !next.purchase.paid) enterPayment(); else setStep(slots|done)`.
**A self-serve `/sign/rider` visitor has NO purchase, so the else branch runs and they land on
"You're all set" with nothing bought.** The `shop` step is reachable ONLY from `enterPayment()`,
which is only called when a purchase already exists, or from `?step=shop`. **The offering step is
unreachable for exactly the person it was built for.** That is the owner's *"what is blocking a new
visitor"*, and the re-order fixes it as a side effect.

### 5 · ⚠️ WHERE THE SPEC IS WRONG (re-measured, D20)
1. §2: *"sign comes AFTER shop"* — **false.** `:90` is a TYPE UNION, not an order. At runtime
   `signCurrent` runs before `shop` on every path. The owner's 4-before-5 is already true.
2. Trap 1 / front matter: `requested` is not TASK-LIFECYCLE's to add alone — **`requested` is not a
   legal `bookings.status` today at all** and LIFECYCLE §2b does not notice it is missing.
3. Trap 4 (loop back to sign an offering's extra document) — **superseded by CR-98 A1**, which
   ORCH6's addendum states as *"no special case"*. `trg_documents_when_order_opens` is the general
   rule and it already exists.
