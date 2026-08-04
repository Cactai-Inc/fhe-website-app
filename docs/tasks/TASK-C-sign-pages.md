# TASK C — Four /sign self-onboarding pages (additive)

Branch: `task/c-sign-pages` in its own worktree. Scope: exactly this document.
HARD RULE: additive only. The old kiosk routes (/release, /release/:key,
/docs/release-participant) are NOT removed, redirected, or modified.

## The flow (owner-final design)
Public URLs carrying the account type:
  /sign/guest → categories ['GUEST']
  /sign/rider → ['RIDER']
  /sign/horse → ['HORSE_OWNER']
  /sign/rider+horse → ['RIDER','HORSE_OWNER']   (also accept /sign/rider%2Bhorse)

Each page shows, in order:
1. Welcome header per category — copy:
   guest: "Welcome to French Heritage Equestrian — let's get you set up to
   visit the ranch."
   rider: "…let's get you set up to start taking riding lessons."
   horse: "…let's get you and your horse set up for care services."
   rider+horse: "…let's get you and your horse set up for riding lessons."
2. "What you'll be able to purchase" — active offerings from the live catalog
   (reuse fetchPublicCatalog / publicCatalog.ts): rider → rider segment;
   horse → horse segment; rider+horse → both; guest → both segments under the
   heading "Services we offer once you're onboarded". Names only, no prices.
3. Email + Confirm-email inputs (must match, client-validated) + one button:
   "Send my activation email".
4. Deliverability panel (VISIBLE BEFORE AND AFTER SUBMIT, unchanged by it):
   - "Use a Gmail address if you have one."
   - "First-time emails often land in spam — check there if you don't see it."
   - Org contact info (resolve email/phone from the same org config the app
     uses — api pattern in calendar-reminders OPS_INBOX resolution; display
     hello@fhequestrian.com + phone) with copy "Add us as a contact so calls,
     texts and emails reach you."
   - "Add us to your contacts" button → downloads a .vcf (vCard 3.0) built
     from that same org config (name/phone/email). Plain text fallback shown
     regardless.
5. After submit: the same page with the email inputs replaced by "Check your
   email — we sent your activation link." IDENTICAL response whether the email
   was known or new (no enumeration). Deliverability panel stays.

## Backend: ONE new public endpoint api/sign-start.ts
POST { path: 'guest'|'rider'|'horse'|'rider+horse', email, confirmEmail }
1. Validate: emails match, plausible format; map path → categories; 400 else.
2. RATE LIMIT: table `sign_start_attempts` (new migration: requester_hash text,
   window_start timestamptz, count int). requester_hash = sha256(ip + user
   agent). 10 submissions per rolling hour → further requests get the SAME
   success-shaped response (neutral) but do nothing except increment; on the
   10th, notify_staff('sign_start_lockout', …) once per window with a link to
   /app/ops/intake. NEVER key on the email.
3. Provision via the EXISTING spine with the service role:
   provision_client_invitation(email, NULL names, categories, no offerings,
   defaults otherwise). This upserts the contact by email (existing helper),
   attaches category documents, preserves existing requirements (verified
   behavior), and returns a token. A repeat email = same contact, fresh token
   — that IS the resume path; build no other.
4. Send the SAME activation email the manual flow sends: read
   api/admin-send-invitation.ts, extract its email-compose/send into a shared
   _lib helper if needed and call it from both places — do NOT write a second
   template or sender. Activation link identical in shape to the manual one.
5. Respond { ok: true } — same body in every non-400 case.

## Wiring
- Routes in src/App.tsx public section (additive lines only).
- One page component (src/pages/SignStart.tsx) parameterized by path; keep it
  self-contained; match the public site's existing styling (see Lessons.tsx /
  Landing.tsx patterns).

## Done-checks (raw output in report)
- typecheck 0 errors, lint 0 errors.
- psql probe of the endpoint's core (call provision_client_invitation exactly
  as the endpoint does, service-role psql pattern from migration
  20260804050000) with throwaway email A: show contact + invitation +
  contact_required_documents rows per category for /sign/rider+horse (6 docs,
  union, deduped). Repeat with the SAME email: show NO duplicate contact and
  requirements preserved (counts before/after). Clean both up to zero residue
  (list every DELETE).
- Rate limit: unit-exercise the counting logic (script or SQL) proving 10th
  increments to locked and 11th returns neutral; show the notify_staff row,
  then delete it.
- vCard: paste the generated .vcf content; validate it has FN, TEL, EMAIL.
- Confirm /release and /docs/release-participant routes untouched (git diff
  scope proof).

## Report
docs/reports/TASK-C-REPORT.md on the branch; file:line per change, raw
outputs, retries/failures, deviations. Print only report path + branch.
