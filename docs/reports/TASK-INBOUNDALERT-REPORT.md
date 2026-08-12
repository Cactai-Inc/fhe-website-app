# TASK INBOUNDALERT — report

Branch `task/inboundalert`, worktree `wt-inboundalert`, rebased onto `origin/main`
(`af8420a`, after EMAILEXTRACT merged). Not pushed. Migration APPLIED to production.

---

## The short version

**The owner is right that no email alert went out — and the cause is worse and simpler
than the task doc supposed.** `/api/request-received` was never called for Kit, for
Kylie, or for any of the other eleven leads. Not a provider failure, not an env var, not
an aborted fetch. **The only caller was the `/contact` page, and no real lead has ever
come through it.** All 13 production requests arrived through checkout (6) or the kiosk
(7), neither of which called the endpoint at all.

**Two of the task doc's premises turned out to be wrong, both correctable from
production data:**

1. **Kit DID get an in-app notification** — two rows, exactly like Kylie. One was
   deleted, by its own recipient, a day later.
2. **"No evidence either way" about the email is now provably "it was never
   attempted."** Not for Kit and Kylie specifically — they predate the record and are
   reported honestly as `unknown` — but the call site that would have alerted them
   demonstrably did not exist.

---

## 1. What the attempt record reused

`receipt_sends`, as instructed — read first, then copied rather than reinvented.
`request_alert_sends` has **the same columns in the same order** (`id, org_id,
<parent>_id, idempotency_key, recipient_email, succeeded, error, message_id,
attempted_at`), the same `UNIQUE (idempotency_key)`, the same parent index, the same
`FOR SELECT USING (has_staff_access())` policy, and the same function pair with the same
bodies and semantics: `claim_request_alert_send` / `log_request_alert_send` are
`claim_receipt_send` / `log_receipt_send` with the parent table swapped. `api/_lib/
receipt.ts`'s call shape — claim, send, log either way, log again from the catch — is
the shape the endpoint now uses.

**Two deliberate departures, both stated in the migration:**

- **Tighter grants.** `claim_receipt_send` and `log_receipt_send` are still executable
  by `anon` and `authenticated` in production, so anyone with the public key can forge
  or suppress receipt evidence. The new pair is `service_role`-only.
- **No cascade.** `receipt_sends` cascades from `purchases`; BOOKWRITE has since disarmed
  exactly that kind of cascade. The FK is `ON DELETE RESTRICT`, so evidence that an alert
  was attempted cannot evaporate with the row it is about.

**A fourth state that `receipt_sends` has no concept of:** *no row at all*. That is not
an absence of information, it is the finding — it means the endpoint never ran. The view
reports it as `not_attempted`, separately from `failed`.

---

## 2. "Was the owner told about lead X?" — the one query

```sql
SELECT r.contact_name, q.alert_state, q.alert_recipient, q.alert_attempted_at, q.alert_error
  FROM inbound_queue q JOIN requests r ON r.id = q.id
 WHERE r.contact_email = 'zz-inboundalert@example.invalid';
```
```
     contact_name     | alert_state |    alert_recipient     |      alert_attempted_at       |          alert_error
----------------------+-------------+------------------------+-------------------------------+-------------------------------
 ZZ Inboundalert Test | failed      | hello@fhequestrian.com | 2026-08-12 21:42:35.885454+00 | email provider not configured
```

The verdict is computed **once**, in `inbound_queue` — the view the dashboard already
reads and where `already_converted` is already defined — not re-derived in the client.
Four states: `sent`, `failed`, `not_attempted`, and `unknown` for requests that predate
the record.

---

## 3. Why Kit got no in-app notification — he did, and here is the proof

**The `notifications` table is a live queue, not a record.** Reading it alone is what
produced the "Kit → NONE" finding. `audit_logs` holds what it lost:

```
2026-08-10 15:41:15.510482+00 | DELETE | notifications | actor: fdbdfe89… (hello@fhequestrian.com)
old_value: {"id":"a11e5177-11bd-4734-aa1b-b9e9a7bd6cbd", "kind":"request_new",
            "title":"New inquiry from Kit Garcin", "link":"/app/ops/intake",
            "user_id":"fdbdfe89-76d7-486b-b734-8e23b09e0353",
            "created_at":"2026-08-09T17:53:06.621926+00:00", "read_at":null}
```

**Kit's submission fired two notification rows at `17:53:06.621926` — the identical
timestamp on both — one to `admin@fhequestrian.com` and one to
`hello@fhequestrian.com`. Exactly what Kylie produced.** The `hello@` copy was deleted
by `hello@` itself the next day at 15:41. `admin@`'s copy is still there, still unread.

**Verified as the general mechanism, not a one-off:** `consume_notification` (the card's
dismiss button) is a hard `DELETE` that writes an `audit_logs` row first. The same actor
dismissed three `purchase_unpaid` alerts the same way on 2026-08-10 — which is also why
those look like they only went to `admin@`.

**Can it recur?** The *notification failing to fire* cannot — `notify_staff` was probed
against production inside a rolled-back transaction and inserts **2 rows, one per
admin**, today. What can recur is the appearance of it: **a dismissed notification leaves
no trace in any surface the owner looks at.** The evidence survives only in `audit_logs`,
which nothing in the app reads. That is a real gap, but it is a notification-lifecycle
question, not this task's, and I have not changed it.

**Nothing changed between 08-09 and 08-12.** `INQUIRYMAIL`, `LEADCLEAN` and `REQTRIGGER`
are all innocent of this one — I checked each against the notification path and none of
them touches `notify_staff` or `mirror_admin_notification`.

---

## 4. The send itself — diagnosed from evidence

```
channel | entry_location | count
--------+----------------+------
kiosk   | kiosk          |   7
booking | checkout       |   6
```

**Thirteen requests. Zero from the contact form.** And `/api/request-received` had
exactly one caller in the entire codebase: `PublicIntakeForm.tsx`, mounted on exactly one
page, `/contact`. `Checkout.tsx` and `DocsParticipantFlow.tsx` — the two paths every real
lead actually used, including Kit and Kylie, both `channel:'booking'`,
`entry_location:'checkout'` — call `submitRequest` and then nothing.

**So the endpoint INQUIRYMAIL rewrote has never once run for a real lead.** Its own
report closed with "could not prove a send"; this is why.

**The fix is where the fix belongs.** The dispatch moved out of the one call site that
had it and into `submitRequest` (`src/lib/api.ts`) — the single RPC wrapper all three
intake paths already share. A new intake surface now cannot be built without the alert,
which is the property whose absence caused this. `PublicIntakeForm`'s copy was removed so
it does not fire twice.

**The `void fetch` suspect, tested specifically.** It is real but secondary — it could
not have been the cause, because the fetch it would have aborted was never issued on the
paths that mattered. It is fixed anyway: the dispatch now carries `keepalive: true`, so
the browser must complete it even if the page navigates or unmounts immediately after
submit (the body is one id, far under the 64KB keepalive limit). Without it, a
confirmation screen rendering is enough to cancel the request.

**The ops inbox resolves — and it does NOT reach the owner.** `CONTACT.OPS_INBOX` is
`hello@fhequestrian.com` and resolves correctly (proven live, above: the attempt row
recorded that exact recipient). **But the task doc's expectation that "a mirror trigger is
supposed to bridge them" is not so.** `mirror_admin_notification` is a trigger on the
`notifications` table; it copies **in-app notifications** between admins and touches no
email at all. Nothing in this codebase sends the lead alert anywhere but `hello@`.

**RESOLVED by the owner, 2026-08-12: `hello@` DOES forward to `admin@`.** The bridge is
mailbox-side at Google, not in this codebase — which is the right place for it, but means
no code reader can discover it. **The delivery path now has no unknowns:** an alert that
sends reaches the owner. Recorded here because the next thread to read
`identity.opsInbox || 'hello@fhequestrian.com'` will otherwise ask the same question.

---

## 5. What the owner sees

A lead card whose alert did not land now carries one line, in red, under the existing
subtitle — **added to LEADCLEAN's card, not a restructure of it**:

> ✉ Email alert failed — you were not emailed about this lead. *(provider's error, verbatim)*
> ✉ Email alert never sent — this lead is saved, but you were not emailed about it.

Two different failures worded differently, because they are different: a provider that
refused, versus a call that never came. **A successful alert says nothing, and so does
`unknown`** — a request older than the record. Not knowing is not the same as knowing it
failed, and the card does not pretend otherwise.

No new alerting system, no new table for the UI to read, no second notification channel.

---

## The test this had to pass

| # | Requirement | Result |
|---|---|---|
| 1 | A submission writes one attempt row — recipient, timestamp, outcome, raw error | **Proven live.** Real handler, real production DB, row written with `hello@fhequestrian.com`, `succeeded=f`, `error='email provider not configured'` |
| 2 | "Was the owner told about lead X?" answerable in one query | **Shown above.** |
| 3 | Kit's in-app notification explained, recurrence stated with evidence | **Established from `audit_logs`.** It fired (2 rows); the recipient deleted her copy. Cannot silently fail; *can* be silently dismissed. |
| 4 | A failed send visible on the dashboard, not only in a log | **Two tests**, 4 states each, incl. the two that must stay silent |
| 5 | A mail failure still leaves the lead captured | **Proven live.** After the failed send: request row present, `contact_id` captured |
| 6 | Neither Kit nor Kylie emailed | **Yes — no email was sent at all**, to anyone. The provider is unconfigured in this environment, which is what made it a safe failure test |

**How #1 and #5 were proven without a service-role key.** `SUPABASE_SERVICE_ROLE_KEY`
lives only in Vercel, so the JS client cannot be constructed here. The **real, unmodified**
`api/request-received.ts` was bundled with only `_lib/supabaseAdmin.js` swapped for a
psql-backed transport and invoked as Vercel would. The handler, `api/_lib/email.ts`,
`sendViaProvider`, and the database were all real; only the wire the SQL travelled on was
substituted. It ran twice against a throwaway request and recorded **two separate
attempts** — proving a retry after failure is recorded, not swallowed by the unique index.

The throwaway row used `zz-inboundalert@example.invalid`, the repo's existing `zz-`
convention. It is now `status='expired'` and its auto-captured contact is soft-deleted, so
neither shows in the owner's working surfaces. **Nothing was deleted** — the request row
and both attempt rows are retained.

---

## Checks

```
npm run typecheck        0 errors
npm run typecheck:api    0 errors
npx eslint <8 changed files>   0 errors, 0 warnings
npm run build            ✓ built
npx vitest run test/ui   15 passed, 2 failed  ← both pre-existing
```

The two failures (`reviewnav_section`, `pluspass_create_controls`) were confirmed failing
on a stashed clean tree at the same commit. `test:db` was not run and is not cited —
everything above is verified against production or by the UI suite.

**Migration applied to production**, dry-run → apply → verify:
`20260812T2000_inboundalert_request_alert_attempts.sql`. All four `alert_state` branches
were exercised inside `BEGIN … ROLLBACK` before applying. The file is re-runnable (ran
twice cleanly). No self-contained `COMMIT;`, no temp tables.

**A grant trap, caught by verifying:** `REVOKE … FROM PUBLIC` was a **silent no-op** — this
project's `ALTER DEFAULT PRIVILEGES` grants `anon`/`authenticated` explicitly, so a
PUBLIC-only revoke left them untouched. The first apply verified as still open; the
migration now names every role. Final state confirmed: `anon` cannot execute either RPC,
cannot read the table, and `service_role` can.

---

## Coordination

**EMAILEXTRACT merged into `main` (`74d9e46`) mid-task and I rebased onto it.** Its content
move is untouched — the email's prose stays in the `REQUEST_RECEIVED` template, which is
live and active in production.

**But it introduced a new instance of the exact defect this task exists to close**, and
that one I did cover: a missing template returns `200 { emailed:false, reason:'template
missing' }` and, as merged, wrote no record. It now logs the attempt like any other
failure. This is delivery-path, not content — I did not move where the content lives.

---

## Flagged, NOT fixed — for the orchestrator

1. **`CONTACT.OPS_INBOX` has no owner-facing editor — a D13 violation.** The single address
   every lead alert is sent to exists only as a `config_values` row. **Nothing in `src/`
   references `OPS_INBOX` at all**, and no UI writes any `CONTACT.*` key —
   `AdminBrandingPage` fetches `BRAND.*` and `CONTACT.*` together and then discards
   everything that is not `BRAND` (`api.ts:2016` reads both; the page keeps one). So
   changing where lead alerts go — a different address, a second one, a new staff member —
   requires a thread and a SQL statement. **Per D13's corollary I am naming the follow-up
   rather than calling this shipped: the ops inbox needs a field on the branding page.**
   Not urgent, now that forwarding is confirmed: alerts reach the owner today. It is the
   day he wants to change it that has no answer.

2. **`claim_receipt_send` / `log_receipt_send` are executable by `anon` and
   `authenticated`.** Anyone with the public anon key can write `receipt_sends` rows
   claiming a receipt was sent, or claim one to suppress a real send. Not touched — it is
   not this task's table, and the new pair does not repeat it.

3. **A dismissed notification leaves no trace in any surface the owner reads.** The
   evidence survives in `audit_logs` and nothing in the app reads it. This is precisely
   what made "Kit was never notified" look true for three days.

4. ~~Whether `hello@` forwards to `admin@`.~~ **Answered by the owner: it does.** Closed —
   see §4. No action.

5. **Kit and Kylie report `alert_state = 'unknown'`, deliberately.** No attempt record
   existed when they came in, so silence proves nothing. Per the task: not backfilled, not
   re-notified. **They were both missed, and that is the owner's to act on.**
