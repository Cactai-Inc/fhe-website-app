# TASK GOOGLEAUTH — let a member activate Sign in with Google themselves

Lives in **My Login** on the Account page (built by `TASK-ACCOUNTSURFACE` §4).

**One control. Self-serve. No staff step, no email sent, no account created.**

---

## What this is

A member who signs in with a password presses one control and gains the ability to sign in
with the Google button. Same account, same `user_id`, same contact, same documents — they
simply gain a second way in.

`supabase.auth.linkIdentity()` attaches a Google identity to the signed-in account.
**Nothing is migrated and no account is recreated.**

Most of it already exists — this task is mostly surfacing it:

| what | where | status |
|---|---|---|
| `linkOAuthIdentity(provider)` — attach Google to the CURRENT account | `src/lib/auth.ts:76` | **built** |
| `listLinkedProviders()` — identities the account already has | `src/lib/auth.ts:65` | **built** |

## The flow

1. Member presses **Activate Sign in with Google**.
2. `linkOAuthIdentity('google')` → Google consent.
3. They consent with **whichever Google account they control** — it does **not** have to be
   the address they sign in with today.
4. Back on the account page, the Google button now works for them. Their existing email and
   password continue to work.

That is the whole feature.

### Why there is no second path

`linkIdentity` does not require the Google address to match the account's email, and does
not change the primary email. So there is no "your address isn't Google-hosted" rejection,
and nothing for a fallback path to solve. **One control covers everyone.**

## Owner ruling 2026-08-07 — do not rebuild this

The owner initially proposed that, on rejection, the member be emailed an invite, a
**duplicate account** be created under a Gmail address, and the original then merged or
deleted — with the member later choosing which address to keep and where mail is sent.

**All of that is void**, in the owner's words, because two emails can sit on one `user_id`.
Only the self-serve part survives. Specifically dropped: the invite email, the duplicate
account, the merge, the deletion, the keep-or-remove choice, and the mail-routing choice.

It was a sound answer to a constraint that did not exist — an earlier revision of this doc
wrongly stated the member's current address had to be Google-hosted. Recorded so nobody
re-proposes it.

**Never duplicate an account to solve an auth problem.** Duplication spans ~34
`contact_id`-keyed tables and ~20 `user_id`-keyed ones including executed documents and
signatures; it then needs a merge and a deletion, and it runs straight at the standing rule
that executed documents are never swept. `promote_contact_to_account` carries
evidence-based survivor logic and a structural denylist precisely because this is the
hardest operation in the system.

## Must be proven FIRST — do not build on an assumption

Every identity in production currently has an identity email **equal to** its account email.
So the thing this feature rests on — linking a Google identity whose email **differs** — has
never happened in this project.

Coexistence IS proven: `admin@cactai.io` holds both an `email` and a `google` identity on
one account.

**Step 1 of this task is to prove cross-email linking on a throwaway account** and report
the raw result. If it does not work, **stop and report.** Do not fall back to creating an
account.

## Open decisions — ASK THE OWNER

1. **Does the password survive?** Recommendation: **keep it.** Linking adds a way in;
   removing the password removes the fallback, and a member whose Google consent later
   breaks would have no way into their own account. Removing it should be a separate,
   deliberate control with its own confirmation.
2. **Is manual identity linking enabled in the Supabase Auth dashboard?**
   `linkOAuthIdentity`'s own doc comment says it is required. **Verify before building** —
   if it is off, every attempt fails at the provider and no frontend work fixes it. Report
   what you found; do not assume.

## The one case that is NOT self-serve

If the Google account the member consents with **already belongs to another account** in
this system, linking conflicts. That is a genuine identity merge: **detect it, explain it,
route it to staff.** Never resolve it in this flow.

## Behaviour

1. **Where:** My Login, beside the sign-in email and password reset.
2. **Who sees it:** members whose linked providers do not already include `google` — read
   from `listLinkedProviders()`, **never** inferred from the email domain.
3. **Already linked:** show the linked state, including *which* Google address is linked, so
   a member whose two addresses differ can see what they connected.
4. **Feedback:** explicit states, never optimistic. The flow navigates away to Google, so
   the control stays busy until the browser leaves; on return, confirm from the **server's**
   view of linked identities — never from the fact that a redirect happened. Follow
   `EmailMeACopyButton` in `DocumentsContent.tsx` for the state discipline.
5. **Abandoned consent** leaves the member exactly as they were — no partial state.

## Verification

1. Password-only member sees the control; a member with `google` linked sees the linked
   state instead.
2. **The test that matters:** after linking, sign out and sign back in **via the Google
   button**, and land in the **SAME account** — same `user_id`, same `contact_id`, same
   documents visible. Nothing else proves the switch worked.
3. Cross-email case specifically: linked with a Google address different from the account
   email, the primary email is **unchanged** and password sign-in still works.
4. Abandoning consent leaves no partial state.
5. Conflict case surfaces as an explained message, not a raw provider error.
6. Typecheck, lint, build clean.

## Constraints

- Own git worktree off `origin/main`.
- **Do not hand-write `auth.users` or `auth.identities`.** Use the Supabase auth API only.
  Hand-editing auth tables is how members get locked out of their own accounts.
- **Do not create, duplicate, merge or delete an account** in this task, for any reason.
- `ClauseDocument.tsx` is FROZEN. `AppLayout.tsx` is not part of this task.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-GOOGLEAUTH-REPORT.md`. Lead with the cross-email proof and the answer to
open decision 2. State what you verified yourself versus assumed.

---

## OWNER RULINGS — 2026-08-11. Both open decisions are CLOSED.

### Decision 2 — MANUAL LINKING IS ENABLED. Verified by the owner in Supabase directly.

Not inferable from outside — `/auth/v1/settings` does not expose the flag, and the authorize
endpoint checks authentication before the manual-linking gate, so it returns 401/403 and never
the 422 that would answer it. **The owner checked the dashboard. It is on.** Do not re-derive
this and do not re-ask.

**Correction to this doc, carried forward:** it offered `admin@cactai.io` holding both an email
and a google identity as evidence the flag was on. That inference was wrong — automatic
same-email linking produces the same state with the flag off. The account is nonetheless a
genuine manual-link case: the owner confirms it was linked through a prior working session,
**not through the UI**. So it evidences manual linking having been performed; it evidences
nothing about the UI path, which has still never run in production.

### Decision 1 — the password SURVIVES. Implemented as built.

Linking Google removes nothing. A member keeps both sign-in methods. Nothing here forecloses a
separate, deliberate password-removal control later.

### Still outstanding, and it is the QUIET failure

The Google OAuth **Redirect URL allow-list** — the owner is checking it. If `/app/account` is
not allow-listed, a member completes consent, is returned to the home page, and **the outcome
is reported nowhere**: no error, no success. The linking flag fails loudly; this fails silently.
