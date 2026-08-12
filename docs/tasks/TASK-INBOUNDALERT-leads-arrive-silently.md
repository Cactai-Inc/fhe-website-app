# TASK INBOUNDALERT — two leads arrived and the owner was never told

**Owner, 2026-08-12, on Kit Garcin and Kylie Pinion:** *"they have in common… no email alert."*

**This jumps the queue.** The owner's stated goal for the whole system is that *"what i need to
do will be provoked into my world from the app."* **Inbound leads arriving silently is that
promise failing at the first step**, and it is failing for real people who filled in the form.

---

# WHAT IS TRUE IN PRODUCTION, 2026-08-12

```
requests: 13 total
  Kit Garcin    kitgarcin@gmail.com   2026-08-09   status new
  Kylie Pinion  kpinion16@gmail.com   2026-08-12 07:47   status new

notifications (in-app):
  Kylie  ->  2 rows, 'request_new', "New inquiry from Kylie Pinion", 07:47   ✅ fired
  Kit    ->  NONE                                                            ❌ never fired

email to the ops inbox:  NO EVIDENCE EITHER WAY, for either one.
```

**The in-app notification is written by the `submit_public_request` RPC. The email is a separate
path.** They fail independently, and both have failed.

---

# THE DEFECT — a notification path with no evidence

## Two layers of silence, stacked

**1. The caller does not wait.**

```js
// src/components/PublicIntakeForm.tsx:235
void fetch('/api/request-received', { … })
```

**Fire and forget.** No `await`, no error check, no retry. The form submits successfully whether
the email sends or not.

**2. The endpoint returns success on failure — by design.**

Its own header: *"Best-effort: any failure returns **200 `{ emailed:false }`** so a mail hiccup
never [breaks the submission]."* On failure it writes `console.error` to serverless logs
**nobody reads.**

**So even a caller that DID check would see `200`.** There is no signal anywhere.

**This is the eighth instance of this project's defining failure mode: code that reports success
while doing nothing.** See `orchestration/lessons/LESSONS.md`.

## Why "best-effort" was the right instinct and the wrong implementation

**The instinct is correct: a mail failure must never lose the lead.** The request row must be
written regardless — and it is.

**The error is treating "do not block the submission" as "do not record the outcome."** Those
are different. The submission can succeed *and* the attempt can be recorded.

**The precedent is already in this codebase.** `CLAUDE.md`: *"`receipt_sends` (one row per
attempt; a receipt is provable and single)."* **Apply that discipline here.**

---

# WHAT TO BUILD

## 1. Record every attempt — this is the core of the task

**One row per attempt**, whatever the outcome: which request, which recipient, when, sent or
failed, and **the provider's error verbatim** when it failed.

**Follow `receipt_sends`' shape rather than inventing one.** Read it first and say what you
reused.

**With this in place the question "did the owner get told?" becomes answerable from SQL.** Today
it is not, and that is why this defect survived two leads.

## 2. Establish why Kit got no in-app notification and Kylie did

**Both went through the same form. One produced two notification rows, the other produced
none.** Something changed between 2026-08-09 and 2026-08-12 — `INQUIRYMAIL`, `LEADCLEAN` and
`REQTRIGGER` all touched this path.

**Find out which, and whether Kit's case can still happen.** If it was fixed incidentally, say
so and prove it. **Do not assume it is fixed because the newer one worked.**

## 3. Make the failure visible to the owner, not to a log

A `console.error` in a serverless function is not a notification. **When the email fails, the
owner must find out from a surface he looks at** — the dashboard is where he lands, and
`LEADCLEAN` just made it the one lead surface.

**Do not build a new alerting system.** A field on the lead card saying the notification did not
send is enough, and it is the honest thing: the lead is still captured, he just was not told.

## 4. Then, and only then, fix the send itself

**Once attempts are recorded, the actual cause becomes visible.** It may be a provider failure,
a bad ops-inbox address, a fetch that never fires because the page navigates away, or an
environment variable missing in production.

**Diagnose from evidence, not from a guess.** `api/request-received.ts` sends to
`identity.opsInbox || 'hello@fhequestrian.com'`; `config_values.OPS_INBOX` is
`hello@fhequestrian.com`. **Verify the address resolves and that mail to it is actually
received** — the owner reads `admin@`, and a mirror trigger is supposed to bridge them.

**⚠️ `void fetch` from a page the user is leaving is a real suspect.** A form submit that
navigates or re-renders can abort an in-flight request the caller never awaited. **Test that
specifically.**

---

# WHAT NOT TO DO

- **Do not make the submission depend on the email.** A mail outage must never cost a lead. The
  request row is written first and stays written.
- **Do not send anything to Kit Garcin or Kylie Pinion.** Kit is the owner's **reserved
  acceptance case**; Kylie is a **real prospective client**. Neither is a test target. Use a
  throwaway address.
- **Do not backfill notifications** for the two that were missed. Tell the owner they were
  missed; that is his to act on.
- **Do not add a second notification system.** The `notifications` table and the ops-inbox email
  are the two channels. Make them work.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-inboundalert`, branch `task/inboundalert`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`api/` is a separate tsconfig** — `npm run typecheck:api` **and** `npm run typecheck` must
  both pass.
- **`DashboardPanel.tsx` carries LEADCLEAN's shipped design.** Adding a "not notified" indicator
  to a lead card is in scope; **restructuring the card is not.**
- **`EMAILEXTRACT` is running and owns the 19 hardcoded senders**, including this one. **You own
  the ATTEMPT RECORD and the delivery path; it owns where the content lives.** Coordinate:
  **do not move this email's content**, and rebase before you finish.
- **Delete nothing.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.**
- **`test:db` is broken** (60 of 68 files fail) — do not cite it as proof. Verify against
  production.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. **A submitted form writes one attempt row** — recipient, timestamp, outcome, and the raw
   error when it failed.
2. **"Was the owner told about lead X?" is answerable with one query.** Show it.
3. The reason Kit got no in-app notification is **established**, and whether it can recur is
   **stated with evidence**.
4. A failed send is **visible on the dashboard**, not only in a log.
5. **A mail failure still leaves the lead captured** — prove it by forcing a failure.
6. Neither Kit Garcin nor Kylie Pinion was emailed by this work.

Report to `docs/reports/TASK-INBOUNDALERT-REPORT.md`.
