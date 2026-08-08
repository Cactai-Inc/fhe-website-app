# TASK GOOGLEAUTH — switch a password member to Sign in with Google

Lives in **My Login** on the Account page (built by `TASK-ACCOUNTSURFACE` §4).

---

## CORRECTED 2026-08-07 — this is self-serve, and most of it already exists

The first revision of this doc specced a "request a switch, notify staff" flow and scoped
**performing** the switch out as too dangerous to automate. **That was wrong, and it was
wrong because I specced before reading the codebase.** The mechanism is standard, safe, and
already implemented here:

| what | where | status |
|---|---|---|
| `linkOAuthIdentity(provider)` — attach Google to the CURRENT signed-in account | `src/lib/auth.ts:76` | **built** |
| `listLinkedProviders()` — which identities the account already has | `src/lib/auth.ts:65` | **built** |
| `startGoogleChange(newEmail)` — change email *and* link Google, using the linked identity as the proof instead of a verification email | `src/lib/emailChange.ts:35` | **built** |
| `/api/email-change-start`, `/api/email-change-complete` | `api/` | **built** |

`supabase.auth.linkIdentity()` attaches a Google identity to the existing account. The
member keeps the same account, same `user_id`, same contact, same documents — they simply
gain a second way in. **Nothing is migrated and no account is recreated.**

So this task is mostly **surfacing** existing seams in My Login, not building auth.

## The two scenarios

### A — same address, they just made a password instead of using the button

Their sign-in address is already Gmail or Google Workspace-hosted. They created a password
at signup rather than pressing the Google button, and now want the button.

**Mechanism:** `linkOAuthIdentity('google')` → Google consent → back to the account page.
Done. No email change, no staff action, no verification email.

**The copy must state the requirement plainly**, because the member is the only one who
knows it (owner, 2026-08-07): *this option only works if the address you sign in with today
is a Gmail address or is hosted by Google Workspace.* Say it on the control itself, not in
a tooltip. If they pick this and their address is not Google-hosted, Google consent will
simply not produce a matching identity — the failure must be caught and explained in those
terms, not surfaced as a raw provider error.

### B — moving to a different address that is a Google account

Self-evident to the member; no clarifying copy needed.

**Mechanism:** `startGoogleChange(newEmail)` — already built. Registers the pending change,
hands off to Google consent, returns to `/verify-email?mode=google&token=…` where the
linked identity **is** the proof of ownership. No verification email is sent.

## Open decisions — ASK THE OWNER, do not choose these yourself

1. **Does the password survive the switch?**
   Recommendation: **keep it.** Linking adds a way in; removing the password removes the
   fallback. If Google consent later fails — wrong account chosen, Workspace policy change,
   provider outage — a member with no password has no way into their own account. "Switch
   to the button" is satisfied the moment the button works. If the owner wants the password
   genuinely removed, that is a separate, deliberate control with its own confirmation.
2. **Is manual identity linking enabled in this project's Supabase Auth settings?**
   `linkOAuthIdentity`'s own doc comment says it is required. **Verify it in the dashboard
   before building** — if it is off, every link attempt fails at the provider and no amount
   of frontend work fixes it. Report what you found; do not assume it is on.
3. **Scenario A when the member consents with a *different* Google account.**
   Nothing stops someone choosing another Google identity at the consent screen. That still
   links an account they control, so it is not a security hole, but it silently produces an
   outcome other than the one they asked for. Decide whether to compare the returned
   identity's email against the account email and warn on mismatch.

## Behaviour

1. **Where:** My Login, beside the sign-in email and password reset.
2. **Who sees it:** members whose linked providers do not already include `google` — read
   this from `listLinkedProviders()`, **not** from the email domain. A domain gate would
   hide the control from scenario B, who do not have a Google address yet.
3. **Already linked:** show the linked state instead of the control.
4. **Choice:** offer A and B explicitly, with A carrying the Gmail/Workspace requirement in
   its own label.
5. **Feedback:** explicit states, never optimistic — the flow navigates away to Google, so
   the control stays busy until the browser leaves; on return, confirm from the *server's*
   view of linked identities, never from the fact that the redirect happened. Follow
   `EmailMeACopyButton` in `DocumentsContent.tsx` for the state discipline.

## Verification

1. A password-only member sees the control; a member with `google` already linked sees the
   linked state instead.
2. **Scenario A end to end on a real Google-hosted test address:** after linking,
   `listLinkedProviders()` returns both `email` and `google`, and **signing out and back in
   via the Google button lands in the SAME account** — same `user_id`, same `contact_id`,
   same documents visible. This is the test that matters; nothing else proves the switch
   worked.
3. **Scenario B end to end:** email changes, Google identity linked, same `user_id`
   throughout, and the member's documents and contact link survive intact.
4. A member who abandons Google consent is left exactly as they were — no partial state, no
   pending change stuck on the account.
5. Password sign-in still works after linking (per decision 1, unless the owner rules
   otherwise).
6. Typecheck, lint, build clean.

## Constraints

- Own git worktree off `origin/main`.
- **Do not hand-write `auth.users` or `auth.identities`.** Use the Supabase auth API
  exclusively — `linkIdentity` and the existing email-change seams. Hand-editing auth
  tables is how members get locked out of their own accounts.
- **Do not rebuild the email-change flow.** It exists and works; surface it.
- `ClauseDocument.tsx` is FROZEN. `AppLayout.tsx` is not part of this task.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-GOOGLEAUTH-REPORT.md`. Include the answer to open decision 2 (the
dashboard setting), and the same-account proof from verification step 2. State what you
verified yourself versus assumed.
