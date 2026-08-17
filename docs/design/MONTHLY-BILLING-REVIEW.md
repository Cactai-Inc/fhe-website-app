# DESIGN RECORD — monthly billing, with a human in the loop

**Owner, 2026-08-16. NOT SCHEDULED. Nothing here is built by `TASK-CAREPLANS`**, which is explicitly
forbidden from building a biller (§P6). This is where the design waits until it gets its own task.

---

# 1. THE RHYTHM

> *"the intention with monthly items is they are prorated or billed in full on the first purchase and
> then billed every month on the last day of the month prior."*

| moment | what happens |
|---|---|
| **first purchase** | **prorated OR billed in full** — a choice made then, not a fixed rule |
| **every month after** | billed on the **last day of the PRIOR month** — **in advance** of the month it covers |
| **until** | cancelled |

⚠️ **Billing is IN ADVANCE.** September's charge is raised on 31 August. **A cycle that bills on the
1st, or in arrears, is wrong.**

# 2. THE HUMAN IN THE LOOP — the part that must not be automated away

> *"automated billing would be nice but we need human in the loop. so the day before they go out
> (2 days before the end of the month) the staff accounts see an ops notification surfaced to them
> for reviewing the billings with checkboxes that can be unchecked for not sending the invoice, and
> an option to remove the client from the monthly billing entirely."*

**The sequence:**

```
  T-1 (the day before the send)      T-0 (last day of the month)
  ┌───────────────────────────┐      ┌──────────────────────────┐
  │ ops notification to staff │  →   │ invoices go out for the  │
  │ the billing run, listed:  │      │ month ahead — ONLY the   │
  │  ☑ client · plan · amount │      │ lines still checked      │
  │  ☑ …unchecking = no send  │      │                          │
  │  [remove from billing]    │      │                          │
  └───────────────────────────┘      └──────────────────────────┘
```

**Requirements:**
1. **An ops notification to staff accounts**, one per billing run, surfacing the run for review.
2. **A reviewable list**: every client due to be billed, their plan, and the amount.
3. **A checkbox per line, checked by default.** **Unchecking suppresses that one invoice** for this
   month only — it is a skip, not a cancellation.
4. **A separate action: remove the client from monthly billing entirely** — a durable change, not a
   one-month skip. **These two must be visibly different**; conflating them is how a client silently
   stops being billed forever.
5. **Only checked lines send.** ⚠️ **If staff never open the notification, what happens?** Send
   everything, or send nothing? **OWNER QUESTION — this is the decision that decides whether a
   missed review costs revenue or costs trust.**

# 3. WHAT WAS MEASURED (2026-08-16 — verify before building)

| piece | state |
|---|---|
| notification spine | **EXISTS** — `20260703090000_notifications.sql`, with `notify_staff`, `_notify`, `_notify_summary`, `_notify_purchase_paid`. **Reuse it. Do not build a second notifier.** |
| a scheduler | ⚠️ **NONE.** No `pg_cron`, no `cron.schedule` anywhere in the migrations. **There is nothing in the database that runs on a date.** |
| recurring entitlement | `CREDITALIGN`'s monthly roll re-mints monthly allotments and expires them at the month boundary |
| a recurring **charge** | ⚠️ **Not established.** Entitlement rolling is not the same as money moving. **Confirm before assuming either way.** |

**So the missing pieces are: something that runs on a date, the review surface, and the send.**
⚠️ **The absence of any scheduler is the biggest unknown here** — it decides whether this is a DB
job, an external trigger, or a staff-initiated "run this month's billing" button. **A staff-pressed
button is worth serious consideration**: the owner wants a human in the loop anyway, and it removes
the scheduler problem entirely.

# 4. TRAPS FOR WHOEVER BUILDS THIS
- **Never bill in arrears or on the 1st.** In advance, on the last day of the prior month.
- **A skip is not a cancellation.** One unchecked box must never durably unsubscribe anyone.
- **Reuse the notification spine**, and **prove the alert actually fires** — real leads were lost
  here to a fire-and-forget send that could not report failure (`orchestration/lessons/LESSONS.md`).
- **Entitlement and money are separate.** `CREDITALIGN` keeps minting sessions regardless of what
  billing does; **do not couple them.**
- **Proration already exists in the business** — the lessons footnote promises it. **Find whether it
  exists in code before writing a second one.**
- **An invoice that was sent must be auditable** — who reviewed, what they unchecked, what went out.

# 5. OPEN QUESTIONS FOR THE OWNER
1. **The exact review day.** *"the day before they go out (2 days before the end of the month)"* —
   those two readings differ by a day. For a 31-day month, if invoices go out on the **31st**, is the
   review on the **30th** or the **29th**? **State it as a rule, since a scheduler needs one.**
2. **If nobody reviews, do the invoices send?** (§2.5 — the consequential one.)
3. **Who receives the notification** — every staff account, or a billing role?
4. **Does the client get anything at review time**, or only the invoice itself?
