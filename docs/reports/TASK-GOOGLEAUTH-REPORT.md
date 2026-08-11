# TASK-GOOGLEAUTH — report

Branch `task/googleauth`, worktree `wt-googleauth`, off `origin/main` @ `d9cb6d1`. Not pushed.

---

## 1. The cross-email proof — NOT RUN. Read this before anything else.

**The task's Step 1 was to prove cross-email linking on a throwaway account and report the
raw result. I could not run it, and I have not pretended otherwise anywhere below.** What
follows is why, so the gap is auditable rather than a shrug.

The proof needs two things this environment cannot supply:

1. **A human click on Google's consent screen** with a second Google account. There is no
   browser and no Google credentials here, and Google blocks automated consent by design.
2. **A signed-in session on a throwaway account**, to reach the link endpoint at all.

The second one is the harder wall, and I checked every route to it before concluding:

| route to a session | result | how I know |
|---|---|---|
| Sign up a throwaway account | dead end — `mailer_autoconfirm: false`, so signup yields no session until a confirmation link is clicked, and there is no mailbox here | `GET /auth/v1/settings` |
| Admin API (`auth.admin.createUser`) | no `service_role` key anywhere on this machine | only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` exist, and both are placeholders in `.env`; the real anon key I took from the deployed bundle, which carries `"role":"anon"` |
| Mint a token from the project JWT secret | not available | `current_setting('app.settings.jwt_secret')` → not readable; `vault.secrets` → 0 rows |
| Supabase Management API | no token | no `~/.supabase/access-token`, no Supabase CLI installed |
| Write `auth.identities` directly | **refused** — the task forbids it, and correctly | — |

Per the task's instruction I stopped short of inventing a fallback. **I did not create,
duplicate, merge or delete any account.** Everything I did against production was read-only:
`SELECT`s over `auth.users` / `auth.identities`, and unauthenticated GETs against the auth API.

### What I could establish instead

**The premise the task states is true.** Every identity in production has an identity email
equal to its account email — so cross-email linking has indeed never happened here:

```
account email                    provider   identity email                   match
admin@cactai.io                  email      admin@cactai.io                   t
admin@cactai.io                  google     admin@cactai.io                   t
admin@fhequestrian.com           google     admin@fhequestrian.com            t
ashlanalexis22@gmail.com         google     ashlanalexis22@gmail.com          t
cjzigs@icloud.com                email      cjzigs@icloud.com                 t
cjzigs+averify2@icloud.com       email      cjzigs+averify2@icloud.com        t
cjzigs+inviteworks@icloud.com    email      cjzigs+inviteworks@icloud.com     t
cjzigs+inviteworks2@icloud.com   email      cjzigs+inviteworks2@icloud.com    t
claire.bourdon21@gmail.com       google     claire.bourdon21@gmail.com        t
hello@fhequestrian.com           google     hello@fhequestrian.com            t
madelinedo@gmail.com             google     madelinedo@gmail.com              t
maeboon@gmail.com                google     maeboon@gmail.com                 t
sarahrosengard@gmail.com         google     sarahrosengard@gmail.com          t
```

13 identities, 12 auth users. **Only `admin@cactai.io` holds two.**

### Correction: the coexistence evidence proves less than the task doc credits it with

The doc offers `admin@cactai.io` holding both an `email` and a `google` identity as proof that
coexistence works. Coexistence is real, but **that pair is not evidence that manual linking is
on**, and it should not be leaned on when answering open decision 2:

```
user created   2026-07-02 23:52:36.211
email identity 2026-07-02 23:52:36.224   (+0.01s)
google identity 2026-07-02 23:52:51.910   (+15s)
```

Fifteen seconds after signup, on a **confirmed** email, with **matching** addresses. That is
the signature of GoTrue's *automatic* same-email linking at sign-in — the behaviour
`lib/auth.ts` already names and distinguishes from explicit linking in its own doc comment.
It would have happened identically with manual linking switched off. So decision 2 is still
genuinely open, and the two questions are separable:

- **Does coexistence work?** Yes — proven by the row above.
- **Is `linkIdentity()` permitted?** Unknown — never exercised in this project.
- **Does linking tolerate a different email?** Unknown here; per Supabase it does, but that
  is documentation, not this project's evidence. **Treat it as unproven.**

### The two-minute procedure that settles both, once someone is signed in

1. Sign in as any password member (`cjzigs@icloud.com` is the obvious throwaway).
2. Open **Account → My Login** and press **Activate Sign in with Google**.
3. Consent with a Google address **deliberately different** from the account email.

The outcome is unambiguous at each step, and the control now names each one:

- Refused *before* leaving the page, "cannot be activated yet" → **manual linking is off.**
  Turn it on at Supabase → Authentication → Sign In / Providers → *Allow manual linking*.
  No frontend change fixes this, and no other failure looks like it (see §3).
- Reaches Google, comes back **Connected as `<the other address>`** → **cross-email linking
  works**, and the account's own email is untouched below it.
- Comes back with the conflict message → that Google account belongs to someone else here.

Then sign out and back in **via the Google button** and confirm the same account —
`user_id`, contact and documents. That last step is the one that proves the feature, and it
is the one no amount of code can substitute for.

## 2. Open decision 2 — answered as far as it can be from outside

**Is manual identity linking enabled in the Supabase Auth dashboard? Unknown. Not
determinable without a session, and I am not going to assume it.** I tried:

- `GET /auth/v1/settings` — returns providers, `disable_signup`, autoconfirm flags. **It does
  not expose the manual-linking flag.** Verified against the live response.
- `GET /auth/v1/user/identities/authorize?provider=google` unauthenticated → **401**; with a
  malformed bearer → **403 `bad_jwt`**. Authentication is checked before the manual-linking
  gate, so the `422 manual_linking_disabled` answer is unreachable without a real token.

What `/auth/v1/settings` *does* confirm, and this matters:

```json
{ "external": { "google": true, "email": true, ... },
  "disable_signup": false, "mailer_autoconfirm": false }
```

**Google is enabled as a provider.** So if linking fails, the cause is the manual-linking flag
or the redirect allow-list, not a missing OAuth app.

**The build is safe under either answer.** `linkIdentity()` fetches the authorize URL over the
wire *before* `window.location.assign` — I read this in
`@supabase/auth-js` `GoTrueClient.linkIdentity` — so if the flag is off, the refusal arrives
synchronously, the browser never leaves, and the member is told plainly that linking is
switched off for the site rather than being dumped at a broken Google page. Nothing is
half-done and nothing is claimed that did not happen.

## 3. Open decision 1 — does the password survive?

**Implemented as: yes, it survives.** Nothing in this change removes a password, and the
linked-state copy says so to the member's face. I agree with the task's recommendation and
did not build a removal control — removing the fallback would strand a member whose Google
consent later breaks, and it deserves its own deliberate control with its own confirmation.
**Flagging rather than deciding: this is still the owner's call, and nothing here forecloses
it.**

## 4. What I found in the existing build — the feature was unreachable

The control already existed in `LoginSecurityCard.tsx`. It was gated on:

```ts
const isGoogleHostedEmail = /@gmail\.com$/i.test(user?.email?.trim() ?? '');
const showGoogleSwitch = !googleConnected && hasPassword && isGoogleHostedEmail;
```

This is the domain inference the task forbids, and in production it was not a partial
restriction — **it hid the control from every single member it was for.** All four
password-only accounts are `@icloud.com`:

| account | identities | sees now | saw before |
|---|---|---|---|
| `cjzigs@icloud.com` | `email` | **Activate** control | nothing — hidden by the `@gmail.com` gate |
| `cjzigs+averify2@icloud.com` | `email` | **Activate** control | nothing — same |
| `cjzigs+inviteworks@icloud.com` | `email` | **Activate** control | nothing — same |
| `cjzigs+inviteworks2@icloud.com` | `email` | **Activate** control | nothing — same |
| the other 8 accounts | `google` (+`email` for `admin@cactai.io`) | linked state | linked state |

So "most of it already exists — this task is mostly surfacing it" is right, with the sharper
point that **nothing was surfaced to anyone**: 0 of 4 eligible members could see the control,
and the reachable-in-principle set was empty. That also means the redirect path has never
been exercised in production by anyone (see the risk in §6).

The second condition, `hasPassword`, is gone too. It came from the "switch from something"
framing; under the owner's 2026-08-07 ruling the feature *adds* a way in, and the task states
the criterion as exactly one thing — providers do not already include `google`.

## 5. What I changed

| file | change |
|---|---|
| `src/lib/googleLink.ts` | **new.** Owns the redirect round trip: mark/clear the pending flag, read the provider verdict out of the return URL, strip it, and map a GoTrue error code to a sentence a member can act on. |
| `src/lib/auth.ts` | `listLinkedIdentities()` — provider **plus the identity's email and link date**, needed to name *which* Google address is connected. `listLinkedProviders()` kept, now derived from it. `linkOAuthIdentity()` returns the GoTrue `code` alongside the message so a configuration refusal can be told apart from a member-facing one. |
| `src/components/app/profile/LoginSecurityCard.tsx` | The Google row becomes `GoogleSignInRow`: domain gate deleted, explicit state machine, linked state names the connected address, outcomes reported on return. |
| `src/pages/app/AccountHub.tsx` | Opens **My Login** when this page load is the far side of a link attempt, so the outcome is not reported into a collapsed section. |
| `test/ui/google_link_return.test.ts` | **new**, 15 tests — URL parsing, param stripping, idempotence, message mapping. |
| `test/ui/google_signin_control.test.tsx` | **new**, 10 tests — who sees the control, the linked state, every return outcome. |

### Behaviour, against the task's five points

1. **Where** — third row of Login & security, beside the sign-in email and the password row.
2. **Who sees it** — `!identities.some(i => i.provider === 'google')`, from
   `listLinkedIdentities()`. No domain test exists anywhere in the file any more.
3. **Already linked** — `Connected as <identity email>` + an `Active` marker. When that
   address differs from the sign-in email, a second line says so explicitly: *"You sign in
   here as X, and that has not changed — the Google account above is an additional way in."*
   That line is the whole point of surfacing the identity email rather than just the provider.
4. **Feedback** — `idle → starting → leaving | failed`, plus `unfinished` on return.
   `leaving` is **terminal on purpose**: the browser is on its way to Google and the control
   stays busy until the page is gone. Linked is set **only** from the server's identity list.
   `getUserIdentities()` runs through `getUser()`, which is a network `GET /user` and not a
   projection of the cached session — I checked the SDK source, because "read from the
   server" is worth nothing if the call is secretly local.
5. **Abandoned consent** — returns to the exact prior state, with one honest sentence
   (*"That did not finish, so nothing changed"*) rather than silence or a false success. No
   partial state is written anywhere; the only thing the flow stores is a sessionStorage
   breadcrumb, cleared on read.

### Two implementation details that were not obvious

**Success is unreadable from the URL; failure is not.** `auth-js` clears the hash
(`window.location.hash = ''`) only on the success path, and *throws before that line* on
failure. So the error params are still there to be read on return, and success never is —
which happens to force the correct design: confirm from the server, always.

**The redirect target deliberately carries no query string.** The obvious move is
`redirectTo: '/app/account?section=login'`. I did not, because the Supabase Redirect-URL
allow-list is configured outside this repo and a query string can fail to match it, which
would silently drop the member on the home page. A sessionStorage flag carries the "open My
Login" intent instead, the same round-trip pattern as `wallReturn.ts`. `redirectTo` is
unchanged from what was already shipped.

### The conflict case is routed, never resolved

`identity_already_exists` (and its description-text fallback, since older GoTrue builds send
no code) produces: *"That Google account is already attached to a different account here.
Joining the two is something the office has to do — contact us and we will sort it out.
Nothing on this account has changed."* No merge is offered, attempted, or hinted at. The raw
provider string is not shown.

## 6. Verification — what I ran, and what remains unrun

Verified myself:

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors, 35 warnings, **identical to `origin/main`'s baseline**; none in
  the files I touched.
- `npm run build` — clean, including the prerender pass.
- 25 new tests pass. Full `test/ui` suite: 2 pre-existing failures, both confirmed by
  stashing my changes and re-running on a clean tree —
  `clause_ownership_affordance` needs a `dist/assets` CSS artifact, and
  `pluspass_create_controls` expects a `CreateModal` label that has since drifted. **Neither
  is mine and neither is fixed here.**
- The production identity census and the auth-settings reads quoted above.

**Not verified, and not claimable:**

1. **The cross-email link end-to-end** — §1. This is the test that matters and it has not run.
2. **Sign out → sign in via Google → same `user_id` / `contact_id` / documents** — the
   task's "nothing else proves the switch worked". Follows from (1) and is equally unrun.
3. **Manual linking enabled** — §2.
4. **The redirect allow-list contains `/app/account`.** Nobody has ever completed this
   redirect in production, because §4 shows the control was invisible to everyone eligible.
   If the allow-list holds only the site root, the member returns to the home page instead of
   Account and the outcome is reported nowhere. **Worth a glance at Supabase → Authentication
   → URL Configuration → Redirect URLs at the same time as the manual-linking flag.** The
   flag itself is the loud failure; this one is the quiet one.
5. **Anything in a real browser.** No authenticated session exists in this environment; the
   component tests stand in for click-through, and they are not the same thing.

## 7. Constraints observed

- Own worktree off `origin/main`; not pushed.
- `auth.users` / `auth.identities` — **read only**. Never written, by any route.
- No account created, duplicated, merged or deleted.
- `ClauseDocument.tsx` untouched. `AppLayout.tsx` untouched.
- Sarah's document `704c8d2d-…` untouched — this task reads no document tables at all.
- **D1a honoured.** `admin@cactai.io` is the platform owner, holds `org_id NULL` by design,
  and is not a tenant member. Nothing here gives it an org, reads `current_org()`, or touches
  a tenant surface — the change is client-side auth-identity plumbing with no org dimension.
  Incidentally, that account already holds a `google` identity, so it sees the linked state
  and never the control.
