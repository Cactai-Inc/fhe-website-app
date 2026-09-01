# TASK INQUIRYMAIL — a form submission must email you, with what they wrote

**Owner, 2026-08-10:**

> "the inbound served only one purpose and that is to alert me to a form submission. the real
> issue to fix … is the emails i should be getting with the full form content submitted to me.
> right now the app alert surface is the only way to see that i got a submission and the only
> way to see the submitted content."

**Confirmed against production. It is worse than described.**

---

## What happens today

```
form submitted  ->  a `request_new` notification row  ->  NO EMAIL
                ->  daily cron, 16:00 UTC             ->  "You have 3 updates at …"
```

- The **only** email path is `api/notifications-nudge.ts`, on a daily cron (`0 16 * * *`).
- Its subject is a **count**: `` `You have ${n} ${n === 1 ? 'update' : 'updates'} at …` ``
- **No content. Up to 24 hours late.** To learn what someone asked for you must log into the app.

**For an inbound inquiry that is a lost lead, not an inconvenience.** Someone asking about
lessons waits a day for anyone to even know they wrote.

## Nothing needs capturing — it is all already stored

`requests` already carries everything the email should contain:

```
contact_first_name · contact_last_name · contact_email · contact_phone
contact_method · proposed_times · subject · category · channel
entry_location · intent · details · notes · created_at
```

**The gap is purely that nothing sends it.** Do not add columns.

## What to build

**An immediate email on submission, carrying the full content.** Not a digest, not a count, not
a link that requires signing in to read.

- **Immediate**, on the submission itself — not on the daily cron.
- **The whole submission in the body**, so it can be read and acted on from a phone without
  opening the app.
- **Reply-to the submitter's address** where one was given, so replying just works.
- **The daily nudge stays** for everything else. This does not replace it.

## Where it goes — check before choosing

`api/` currently sends from: `admin-send-invitation.ts`, `email-change-start.ts`,
`email-change-complete.ts`, `notifications-nudge.ts`. **Reuse the existing sender and identity
resolution** rather than introducing a second mail path.

**Who receives it** — `docs/reference/NOTIFICATIONS.md` records that `admin@` and `hello@` share one
notification inbox via a mirror trigger, and that **`hello@` is the only public/delivery
address**. Read it before deciding recipients. **Website inquiries have been silently dropped
before** — that is recorded history, not a hypothetical.

## Verification — and the honest limit

- **Prove an email is actually sent**, with the real content, for a real submission shape.
- **The email leg cannot be tested locally** — SMTP and service-role keys live in Vercel, not
  in `.env`. The `INVITEFLOW` thread hit exactly this. **Say plainly that you could not send
  one**, and give the owner a one-step way to prove it from the UI.
- **Do not swallow failures.** `api/admin-send-invitation.ts:229` catches everything and returns
  a flat "could not create invitation" — the same discard that hid a client's real error for
  hours on 2026-08-10. **A send failure must surface its cause.**

## Sequencing

The owner: *"the real issue to fix **after** we merge the two."* This follows the Dashboard /
Inbound merge. **It does not depend on it** — the merge changes where alerts are read, this
changes whether they reach him at all.

## Constraints

- Own worktree off `origin/main`. **Never the canonical checkout** — a pre-commit hook refuses
  code commits there.
- `npm install` in the worktree before claiming a typecheck. **`npx tsc` with no `node_modules`
  fetches an unrelated package and exits 0.**
- A migration must **never** contain its own `BEGIN;`/`COMMIT;` — the file's COMMIT ends the
  dry-run wrapper. Two threads applied to production that way on 2026-08-10.
