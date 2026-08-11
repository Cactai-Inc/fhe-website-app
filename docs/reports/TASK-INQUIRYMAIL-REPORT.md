# TASK INQUIRYMAIL — report

Branch: `task/inquirymail` (off `origin/main`, worktree `wt-inquirymail`). Not pushed.

## Phase 1 — verify first (findings)

The task doc frames the gap as "the only email path is the daily digest." **Reading the code
first, that's not quite the current state** — `api/request-received.ts` already existed
(built in TASK B, 2026-08-04) and already sends an email on every public intake submission,
immediately, called by `PublicIntakeForm.tsx:227` right after `submit_public_request` returns.
It resolves the recipient correctly (`CONTACT.OPS_INBOX`, fallback `hello@fhequestrian.com` —
the single public/delivery address; co-admin visibility is handled separately, in-app only, by
the `mirror_admin_notification` trigger on the `notifications` table, not by email).

**So the real gap wasn't "no email" — it was an incomplete one, with no way to reply.**
Reading the old handler and its caller together:

1. **Partial content.** The client (`PublicIntakeForm.tsx`) hand-picked which fields to POST:
   name, email, phone, category, channel, notes. Missing from every email: `contact_method`,
   `proposed_times` (availability), `entry_location`, `intent`, `subject`, and — the one most
   likely to matter — `details`, the category-specific answers (rider age, horse care type,
   acquisition budget, etc.). That's the content most likely to be the actual ask.
2. **No Reply-To.** `sendViaProvider`/`SendProviderInput` had no `replyTo` field at all, in
   either transport. Replying to the notification email would reply to the tenant's own From
   address, not the submitter.
3. **Content sourced from the client, not the row.** The handler took content straight from
   the POST body instead of reading the `requests` row it already had the id for — so it was
   only ever as complete as whatever the caller happened to serialize, not "everything already
   stored," per the task's framing.

None of this needed a new column, a new endpoint, or a second mail path — the fix is entirely
in making the existing immediate send **complete** and **reply-able**.

## What was built

- **`api/request-received.ts`** (rewritten) — now takes only `{ requestId }` from the caller
  and reads the full row back from `requests` (`select('id, org_id, contact_name,
  contact_email, contact_phone, contact_method, proposed_times, subject, category, channel,
  entry_location, intent, details, notes, created_at')` by id) — the same "look it up, don't
  trust the body" posture `api/support-received.ts` already established for its DB-triggered
  sibling. The email body now includes every one of those fields when present: contact info +
  preferred contact method, category (human label) + channel + entry location, subject/intent
  routing tags, availability (`proposed_times`, rendered the same way the staff inbox does —
  structured window label, or legacy `{date,time}`), the category-specific `details` (humanized
  key → value list), the free-text notes, and the submission timestamp (Pacific time). Deep-
  links to `/app/ops/intake?request=<id>` (the existing notification-link convention) instead
  of the bare inbox route, so the CTA opens the specific request. Kept: best-effort semantics
  (200 `{emailed:false}` on any failure, never blocks the visitor's already-saved submission),
  recipient resolution unchanged (`identity.opsInbox || OPS_INBOX_FALLBACK`). Added:
  `console.error` on a failed send (with the requestId and provider error) so a send failure
  has a trace, not a silent discard — the pattern the task calls out by name
  (`admin-send-invitation.ts:229`) is a swallow with *no* logged cause; this one logs the
  provider's actual error before returning the flat best-effort response.
- **`api/_lib/email.ts`** — added `replyTo?: string` to `SendProviderInput`, wired through both
  transports (`nodemailer`'s `replyTo` for Google SMTP, `reply_to` for the dormant Resend path).
  `request-received.ts` passes `replyTo: r.contact_email` — replying to the notification now
  reaches the submitter directly.
- **`src/components/PublicIntakeForm.tsx`** — the fire-and-forget POST now sends only
  `{ requestId }`; the endpoint is the single source of truth for what the email contains, so
  the client can't under-report a field the row actually has.
- Left alone: `submit_public_request`, the `mirror_admin_notification` trigger, the daily
  `notifications-nudge` digest (still runs, unchanged, per the task's "does not replace it").
  No migration — no columns added, none needed.

## Done-checks (raw output)

**typecheck (frontend):**
```
> tsc --noEmit -p tsconfig.app.json
(0 errors)
```
**typecheck (api):**
```
> tsc --noEmit -p tsconfig.api.json
(0 errors)
```
**lint** (changed files only):
```
npx eslint api/request-received.ts api/_lib/email.ts src/components/PublicIntakeForm.tsx
(0 errors, 0 warnings)
```
**build:**
```
> vite build
✓ built in 3.72s
```
(pre-existing chunk-size warning only, unrelated to this change)

## The honest limit — could not prove a send

**No email was actually sent and verified in this pass.** This worktree has no `.env` at
all — no `SUPABASE_SERVICE_ROLE_KEY`, no `GMAIL_SMTP_USER`/`GMAIL_SMTP_PASS`, no
`SUPABASE_URL`. Those live only in Vercel, per the task's own note (the INVITEFLOW thread hit
the same wall). So this was verified by code inspection + the type/lint/build passes above,
not a live HTTP call or a live DB round-trip — I have neither a Postgres connection to insert a
throwaway `requests` row nor an SMTP credential to invoke `sendViaProvider` directly.

**One-step way to prove it once this deploys:** submit the public intake/contact form on the
site (any category, filling in at least one category-specific field and a proposed time so the
new content shows up), then check the `hello@fhequestrian.com` inbox. Expect: an email within
seconds (not next-day digest), subject `New inquiry from <name>`, body containing every field
that was filled in, and a working Reply-To back to the address that was submitted.

## Sequencing

This does not touch the Dashboard/Inbound merge and doesn't depend on it, per the task doc —
only `api/request-received.ts`, `api/_lib/email.ts`, and the one client call site changed.
