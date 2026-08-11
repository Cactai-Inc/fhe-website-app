# TASK INVITEWORKS — report

**Branch** `task/inviteworks` off `origin/main` (3ae62c0) · worktree
`~/Downloads/claude-code-repo/wt-inviteworks` · 2026-08-11 · **not pushed**

---

## The short version

The invite flow was not one dead flow. **The chain works** — I walked it end to end
in a real Chrome against production and a person went from an activation link to
their paperwork. What was broken was that **every failure along the way was
erased**, so the one leg that genuinely hard-fails (a caller whose account has no
org) came back as the same six-word string as everything else, and a send that
never left the building reported "Invitation sent."

Two real defects were found, fixed, dry-run and **applied to production**:

| # | Defect | Where | State |
|---|---|---|---|
| 1 | Every failure flattened to `could not create invitation` | `api/admin-send-invitation.ts:229` | fixed (code, needs deploy) |
| 2 | A caller with `org_id` NULL hard-fails four triggers deep | same file, no precondition | fixed (code, needs deploy) |
| 3 | `emailed:false` rendered as "email provider not configured" — a guess, not the reason | 3 UI surfaces | fixed (code, needs deploy) |
| 4 | The delivery outcome was never recorded anywhere | send path | **applied to prod** + code |
| 5 | `provision_client_invitation` never superseded prior live invitations | DB spine | **applied to prod** |

**Not verified: the staff send leg** (`ProvisionClientForm` → `/api/admin-send-invitation`
→ email). Per the VERIFICATION POLICY ruling of 2026-08-10 no worktree gets a staff
login, so that leg is the owner's to confirm. §6 is the checklist.

---

## 1. The walk

### 1a. The spine, in a rolled-back transaction against prod

`provision_client_invitation` → `redeem_invitation` → `my_onboarding_state`, run as
the API runs them (service_role for the send, an `auth.uid()` session for the
redeem), everything rolled back:

```
provision  →  contact CONTACT + client 1 + invitation 'sent' + 4 required documents
              (COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT)
redeem     →  invitation 'redeemed' + redeemed_at stamped
              profile created, org stamped, contact_id linked, member 'active'
onboarding →  {"needed": true, "documents": [4 × MISSING], "profile_complete": false}
```

`needed:true` is what `Register.tsx` routes on, so the spine hands the person
straight to `/app/onboarding`. **No break in the database.**

### 1b. The whole thing, in a real browser, against production

Not a harness and not a simulation — headless Chrome against
`https://www.frenchheritageequestrian.com`, driving the real pages.

1. `POST /api/sign-start` (public, no credentials) for `cjzigs+inviteworks@icloud.com`
   → `{"ok":true}`, and the invitation, contact, client and 4 required documents
   appeared in prod.
2. Opened `/activate?token=…` → **"Sign in to activate your account"**, the invited
   address shown.
3. Typed a password → `POST /api/register-invited` `{"ok":true}` → password grant
   returned a session → `redeem_invitation` returned `true`.
4. Landed on **`/app/onboarding`** — *"Let's get you set up. 1. Your details →
   2. Review & sign"*, with `my_wall_state` reporting `pending: 4`.

Prod afterwards: invitation `redeemed`, profile linked to the contact,
membership `active`. **The invitee half works today.**

### 1c. What the "13 sent, never redeemed" actually is

Twelve of the thirteen are test sends by earlier threads to
`cjzigs@icloud.com`, `hello@fhequestrian.com` and `cjzigs+averify2@icloud.com` on
Jul 23–24 and Aug 5. They were never redeemed because nobody clicked them. The
one real address is `maeboon@gmail.com` (Jul 28, expired Aug 4).
**It is not thirteen failures.** A genuine redemption ran as recently as
2026-08-10 (`claire.bourdon21@gmail.com`) and produced a complete account.

---

## 2. Defect 1 — the flattening (`admin-send-invitation.ts:229`)

```ts
} catch (err) {
  console.error('invite error', err);
  return res.status(500).json({ error: 'could not create invitation' });
}
```

A minor being invited, a bad SMTP password, a missing service-role key and a
caller with no org all came back as that one string, with a 500 on every one of
them — including the ones the operator could have fixed in five seconds.

**Fix.** Each step in the handler now runs through `at('<stage>', …)`, which tags
whatever it throws with where it came from; `describeError` turns that into the
real message plus `stage`, `code` and `hint`, and picks 4xx for a rejected request
versus 5xx for a broken deployment. `src/lib/admin.ts` parses that body instead of
throwing the raw JSON text at the user.

Before → after, same failure:

```
"could not create invitation"
"could not resolve org for this invitation [provision]"
```

## 3. Defect 2 — a caller with no org dies four triggers deep

This is what the flattening was hiding. Proven against prod (rolled back):

```sql
-- provisioned path, p_org_id := NULL (what the API passes)
ERROR:  could not resolve org for this invitation
        PL/pgSQL function provision_client_invitation … line 36 at RAISE

-- plain/staff path, org_id := NULL
ERROR:  null value in column "org_id" of relation "status_events"
        violates not-null constraint
        PL/pgSQL function trg_status_invitations() line 8
```

`current_org()` is NULL for a service-role call, so nothing rescues a null
`profile.org_id`. That is the platform owner — `admin@cactai.io`, `org_id` NULL
**by design** (D1a).

**Fix — and explicitly not the other one.** The endpoint now refuses up front with
a sentence that says what to do:

> this account is not part of an organization, so it cannot send invitations —
> sign in with the organization's own staff account and try again

D1a is respected: `admin@cactai.io` keeps its NULL org. The cheap fix (give it an
org) is refused, as it was the last two times.

## 4. Defect 3 — "sent" for a send that did not happen

`sendInvitationEmail` returned a bare `boolean`. `false` came from four different
causes and all three UI surfaces rendered it as *"Invitation sent … (Email provider
not configured — copy the link below.)"* — a guess, in green, next to the word
"sent".

**Fix.** It returns `{ ok, messageId, error }` and the reason is never invented.
The three surfaces now render one shared component
(`src/components/app/InviteResultPanel.tsx`) which turns **red** and says
**"Created but NOT emailed"** with the transport's own reason, above the link to
hand over meanwhile. One panel, three callers, no drift.

## 5. Defects 4 & 5 — applied to production

### 5a. The delivery outcome is now durable
`supabase/migrations/20260811160000_inviteworks_delivery_trail.sql` — **applied**

Nothing anywhere recorded whether an invitation email left the building, so
"provisioned but never delivered" was unknowable five minutes later. Two
sub-status codes on the existing status spine (`email_sent` / `email_failed`,
`is_true_status = false`) plus `record_invitation_delivery(invitation, ok, error)`,
called by **both** senders after the transport returns. A failure also fires
`notify_staff`. It lands in the invitation StatusLog staff already look at — no
new table, no new column.

`/api/sign-start` needed this most: its response is deliberately neutral
(anti-enumeration), so a self-onboarding signup that never got its email was
invisible to everyone, including the person waiting for it.

Verified in prod: vocab rows present, function `SECURITY DEFINER`, a recorded
failure writes the event with its reason and notifies staff, an unknown
invitation id returns `false` instead of raising.

### 5b. One live invitation per person
`supabase/migrations/20260811161000_inviteworks_provision_supersedes.sql` — **applied**

The plain path called `supersede_invitations` after its insert. The provisioned
path — the one the staff form and `/sign` both use — never did. Live before the fix:

```
hello@fhequestrian.com       6 rows status='sent'
cjzigs@icloud.com            3
cjzigs+averify2@icloud.com   2
```

Six simultaneously-valid tokens for one person, and `Register.tsx`'s promise —
*"replaced by a newer one — check your inbox for the most recent email"* — was one
the provisioned path could not keep. `provision_client_invitation` now calls
`supersede_invitations(v_org, v_email, v_inv_id)` right after its insert. The rest
of the body is byte-identical to what was live.

**Proven in production, through the deployed API:**

```
fire 1 → 77ca31d5…  status superseded  superseded_by f4183448…
fire 2 → f4183448…  status sent        resend_of     77ca31d5…
```

and in a real browser the superseded link now dead-ends honestly:

> **This link isn't valid anymore** — This invitation may have expired or been
> replaced by a newer one — check your inbox for the most recent email.

while the live one activated through to `/app/onboarding`.

Historic rows were **not** back-filled — the 6/3/2 above are pre-existing test
sends, and rewriting their lifecycle would be inventing history. New sends
supersede correctly from now on.

---

## 6. NOT VERIFIED — the staff send leg, and how to confirm it

`ProvisionClientForm` → `/api/admin-send-invitation` → email needs a signed-in
staff session. Per the owner ruling of 2026-08-10 (`docs/ORCHESTRATOR-HANDOFF.md`,
VERIFICATION POLICY) no worktree gets one, so **this leg is unproven by me.** What
I can and cannot claim, separately:

- **Proven:** the RPC that leg calls, with the exact arguments the handler passes,
  produces a correct invitation (§1a), and the same RPC through a *deployed*
  endpoint produces a correct invitation in production (§1b, §5b).
- **Not proven:** the handler's own logic — auth, the minor check, the new org
  guard, the email call and the new delivery recording — against a live staff
  session. It typechecks (`typecheck` and `typecheck:api` clean, lint unchanged at
  35 pre-existing warnings) and nothing more.

### Checklist to run after deploying this branch

1. Sign in at `https://www.frenchheritageequestrian.com/app` as
   **`admin@fhequestrian.com`** (the TENANT owner). *Not `admin@cactai.io` — if you
   use that one, step 4 should now tell you so in a sentence instead of failing.*
2. **Clients → New client.** Enter an address you can open, tick **Rider**, leave
   the paperwork defaults, no offering. **Create & send invitation.**
3. **Read the panel.** Green *"Invitation emailed to …"* = it left the building.
   Red *"Created but NOT emailed"* = it did not, and the reason is printed on the
   line below — send me that line.
4. If it fails instead, the message is now the real one — copy it verbatim; it
   names the stage (`[provision]`, `[email]`, `[auth]`).
5. **Open the inbox.** Click the link → set a password → you should land on
   *"Let's get you set up"* with the documents listed.
6. Back in the app, the client's **invitation StatusLog** should now carry
   *"Invitation email sent"* (or *"Invitation email failed"* with the reason)
   under the *Invited* entry — that is 5a working.

### Also worth your eyes: did three real emails arrive?

Three invitations went out through the **live** production send path during this
work, to addresses you control:

- `cjzigs+inviteworks@icloud.com` — 1 email, 15:40 UTC
- `cjzigs+inviteworks2@icloud.com` — 2 emails, 15:48 UTC

If those three landed, invitation email delivery is confirmed working end to end
and §6.3 is a formality. If they did not, delivery is the remaining bug — and from
the next deploy on it will say so itself instead of going quiet.

Indirect evidence says they did: `document_deliveries` holds 49 EMAIL rows,
latest **2026-08-10 16:43 UTC**, and those rows are only written after
`sendViaProvider` returns `ok` (`api/_lib/delivery.ts:291`). The invitation email
uses that same transport, so SMTP was working in production yesterday.

---

## 7. Broken but out of scope — reported, not widened

- **`fhequestrian.com` does not serve the app.** It resolves to `162.255.119.189`
  (Namecheap parking) and times out; the app is on
  `www.frenchheritageequestrian.com`. Mail on the domain is fine (Google MX).
  `BRAND.SITE_URL` in `config_values` is `https://fhequestrian.com`, so any email
  that links to the site sends people to a dead host. Invitation links are built
  from the request origin, so **they are not affected** — but this is worth an hour
  from someone.
- **Expired invitations never flip to `expired`.** `maeboon@gmail.com` has been
  `status='sent'` since it expired on Aug 4. Nothing sweeps them, so "13 sent" reads
  as thirteen live invitations when several are dead. Cosmetic, but it is exactly
  the misreading that made this look worse than it is.
- **Test rows created by this work, left in place** (D1: purges are owner-run, never
  ad hoc). Two accounts, each with contact + client + 4 required documents +
  membership:
  `cjzigs+inviteworks@icloud.com` (contact `972d89a6…`, user `b212e472…`) and
  `cjzigs+inviteworks2@icloud.com` (contact `a92aace9…`, user `77841e60…`).
  Both redeemed, both `active`. Say the word and they go through `purge_account`.
- **`sendViaProvider` has no timeout.** A hung SMTP connection hangs the function
  until Vercel kills it; the invitation is already committed by then, so the
  operator sees a request that never returns. Not hit here.

---

## 8. What changed

```
api/admin-send-invitation.ts                 stage-tagged errors, org guard, delivery recording
api/_lib/invitationEmail.ts                  {ok,messageId,error} + recordInvitationDelivery
api/sign-start.ts                            records its (invisible) delivery outcome
src/lib/admin.ts                             parses the real error body; emailError on the result
src/components/app/InviteResultPanel.tsx     NEW — the one send-result panel
src/components/app/ProvisionClientForm.tsx   uses it
src/pages/app/Admin.tsx                      uses it
src/pages/app/ops/TeamPage.tsx               uses it
supabase/migrations/20260811160000_inviteworks_delivery_trail.sql        APPLIED
supabase/migrations/20260811161000_inviteworks_provision_supersedes.sql  APPLIED
```

`npm run typecheck` 0 errors · `npm run typecheck:api` 0 errors · `npm run lint`
0 errors, 35 warnings (identical to the tree without these changes).
