# TASK GOOGLEAUTH — "Request switch to Sign in with Google"

Lives in **My Login** on the Account page (built by `TASK-ACCOUNTSURFACE` §4).

---

## Why this task exists

`TASK-ACCOUNTSURFACE` was told to offer the Google switch "only when the member already has
a password set **and** is either using a Google email or is switching to one." It correctly
reported that the second half is **not implementable**: nothing in the system can detect
that someone *intends* to switch to a Google email. That is a real gap in the original
spec, not a thread failure.

**The owner's resolution (2026-08-07) removes the need to detect intent at all: this is a
REQUEST button, not an instant switch.** The member declares the intent by pressing it.

## The two scenarios to serve

**A — they have a Google-capable email but signed up with a password.**
They clicked "create a password" instead of the Google button at signup. Their existing
sign-in address already works with Google. The request confirms that address.

**B — they are on a non-Google email and want to move to a Google one.**
The address they sign in with today is not the one they want. The request collects the
Google address they want to switch **to**.

Both land in the same place: a request for staff to action. **Neither path may change the
member's credentials on its own.**

## Behaviour

1. **Where:** the My Login section, beside the sign-in email and password reset.
2. **Who sees it:** any member who signs in with a password. Do **not** try to infer intent
   or gate on the address's domain — scenario B members do not have a Google address yet,
   so a domain gate would hide the button from exactly the people who need it. If the
   member is already signed in via Google, show the current state instead of the button.
3. **What it collects:**
   - scenario A — confirm the existing address; no new input needed.
   - scenario B — the Google address to switch to, validated as a well-formed email.
   Let the member choose, rather than branching on a detected domain: offer "use my current
   address" (prefilled) or "use a different address" (input).
4. **What it does:** records the request and notifies staff. It does **not** mutate
   `auth.users`, link an identity, or change the sign-in email.
5. **Feedback:** explicit states, never optimistic — pending while in flight, confirmed
   only after the server answers, and a failure says so plainly. Follow the
   `EmailMeACopyButton` pattern in `DocumentsContent.tsx`, which already does exactly this.
6. **Idempotence:** a member with an open request sees its status, not a second button.

## Deliberately NOT in scope

**Performing the switch.** Migrating a member to Google sign-in touches `auth.users` and
identity linking, and a wrong move locks someone out of their account. This task builds the
request and the staff notification only. **The staff-side action is a separate task, to be
specced after the owner decides how it should be executed.**

Do not add a "switch now" path even if it looks easy.

## Verification

1. A password member sees the button; a Google-signed-in member does not.
2. Scenario A: request submitted with the existing address; staff notified; **no change to
   `auth.users` or `profiles`** — prove it with before/after row state.
3. Scenario B: request submitted with a different address; same proof.
4. Malformed address is rejected client- and server-side.
5. Submitting twice does not create a second open request.
6. A failed submit renders as failed and is never reported as sent.
7. Typecheck, lint, build clean.

## Constraints

- Own git worktree off `origin/main` (currently `ab2ed85`).
- **Never write to `auth.users`** in this task.
- `ClauseDocument.tsx` is FROZEN and not involved.
- `AppLayout.tsx` — nav is not part of this task.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-GOOGLEAUTH-REPORT.md`. State what you verified yourself versus assumed,
and include the before/after account-state proof for both scenarios.
