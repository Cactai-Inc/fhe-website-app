# TASK INVITEWORKS — report

**Branch** `task/inviteworks` off `origin/main` (3ae62c0) · worktree
`~/Downloads/claude-code-repo/wt-inviteworks` · 2026-08-11 · **not pushed**

Covers the original task and both owner follow-ups of 2026-08-11
(RESEND vs REGENERATE; the staff invitation-links support view).

---

## ⚠ ONE THING IS WAITING ON YOU

`provision_client_invitation` still supersedes on **every** call, which is the
behaviour you ruled against. It is live right now, and its one remaining victim
is the public `/sign` resume path: **a second self-onboarding submission kills
the link from the first.** The staff UI is already safe — Resend and Regenerate
are separate buttons and Resend never touches the RPC.

The fix is written, dry-run against production, and **deliberately not applied**,
because you asked to be told before anything changes what a live link does:

```
docs/proposed/INVITEWORKS-provision-no-default-supersede.sql
```

Apply after the frontend deploys (see §D for why that order, and what the gap
looks like if you do it the other way round).

---

## The short version

The chain works. I walked it end to end in a real Chrome against production and
a person went from an activation link to their paperwork. What was broken was
that **every failure along the way was erased**, and that **sending again killed
the working link**.

| # | Defect | State |
|---|---|---|
| 1 | Every failure flattened to `could not create invitation` (`admin-send-invitation.ts:229`) | fixed — needs deploy |
| 2 | A caller with `org_id` NULL hard-fails four triggers deep | fixed — needs deploy |
| 3 | `emailed:false` rendered as "email provider not configured" — a guess | fixed — needs deploy |
| 4 | Delivery outcome recorded nowhere | **applied to prod** + code |
| 5 | `provision_client_invitation` never superseded (multiple live tokens) | **applied to prod** |
| 6 | …and then superseded on *every* send, killing working links | **HELD for sign-off** (§D) |
| 7 | No RESEND: "send it again" could only mean "mint a new one" | built — needs deploy |
| 8 | Retired-link page said "check your inbox" without naming which | built — needs deploy |
| 9 | Retired invitations never fetched; activation URL in no staff component | built — needs deploy |

**Not verified: the staff send leg.** Per the VERIFICATION POLICY ruling of
2026-08-10 no worktree gets a staff login. §F is the checklist.

---

## 1. The walk

### 1a. The spine, in a rolled-back transaction against prod

`provision_client_invitation` → `redeem_invitation` → `my_onboarding_state`, run
as the API runs them, everything rolled back:

```
provision  →  contact CONTACT + client 1 + invitation 'sent' + 4 required documents
redeem     →  invitation 'redeemed', profile created + org stamped + contact linked, member 'active'
onboarding →  {"needed": true, "documents": [4 × MISSING], "profile_complete": false}
```

`needed:true` is what `Register.tsx` routes on. **No break in the database.**

### 1b. The whole thing, in a real browser, against production

Headless Chrome against `https://www.frenchheritageequestrian.com`, driving the
real pages — not a harness, not a simulation.

1. `POST /api/sign-start` (public, no credentials) → invitation, contact, client
   and 4 required documents appeared in prod.
2. `/activate?token=…` → **"Sign in to activate your account"**.
3. Password → `register-invited` `{"ok":true}` → session → `redeem_invitation` `true`.
4. Landed on **`/app/onboarding`**, `my_wall_state` reporting `pending: 4`.

Prod afterwards: invitation `redeemed`, profile linked, membership `active`.

### 1c. What the "13 sent, never redeemed" actually is

Twelve of thirteen are test sends by earlier threads (`cjzigs@`,
`hello@fhequestrian.com`, `cjzigs+averify2@`) on Jul 23–24 and Aug 5, never
clicked. The one real address is `maeboon@gmail.com` (Jul 28, expired Aug 4).
**It is not thirteen failures.** A genuine redemption ran 2026-08-10
(`claire.bourdon21@gmail.com`) and produced a complete account.

---

## 2. Defect 1 — the flattening (`admin-send-invitation.ts:229`)

```ts
} catch (err) {
  console.error('invite error', err);
  return res.status(500).json({ error: 'could not create invitation' });
}
```

A minor being invited, a bad SMTP password, a missing service-role key and a
caller with no org all came back as that one string, with a 500 on every one —
including the ones fixable in five seconds.

Each step now runs through `at('<stage>', …)`, which tags what it throws with
where it came from; `describeError` returns the real message plus `stage`,
`code` and `hint`, and picks 4xx for a rejected request vs 5xx for a broken
deployment. `src/lib/admin.ts` parses that body instead of throwing raw JSON at
the user.

```
"could not create invitation"
"could not resolve org for this invitation [provision]"
```

## 3. Defect 2 — a caller with no org dies four triggers deep

Proven against prod (rolled back):

```sql
-- provisioned path, p_org_id := NULL
ERROR:  could not resolve org for this invitation
-- plain/staff path, org_id := NULL
ERROR:  null value in column "org_id" of relation "status_events"
        violates not-null constraint  (trg_status_invitations line 8)
```

`current_org()` is NULL for a service-role call, so nothing rescues a null
`profile.org_id`. That is the platform owner — `admin@cactai.io`, `org_id` NULL
**by design** (D1a). The endpoint now refuses up front:

> this account is not part of an organization, so it cannot send invitations —
> sign in with the organization's own staff account and try again

D1a is respected: that account keeps its NULL org. The cheap fix is refused.

## 4. Defect 3 — "sent" for a send that did not happen

`sendInvitationEmail` returned a bare `boolean`; `false` came from four causes
and all three surfaces rendered it as *"Invitation sent … (Email provider not
configured)"*. It now returns `{ ok, messageId, error }` and the three surfaces
share one component (`InviteResultPanel`) that turns **red** and says
**"Created but NOT emailed"** with the transport's own reason.

## 5. Defect 4 — the delivery outcome is now durable *(applied)*

`supabase/migrations/20260811160000_inviteworks_delivery_trail.sql`

Two sub-status codes on the existing status spine (`email_sent` / `email_failed`)
plus `record_invitation_delivery()`, called by **both** senders after the
transport returns; a failure also fires `notify_staff`. No new table, no new
column — it lands in the invitation trail staff already read.

`/api/sign-start` needed it most: its response is deliberately neutral
(anti-enumeration), so a self-onboarding signup that never got its email was
invisible to everyone, including the person waiting for it.

---

# The 2026-08-11 follow-ups

## A. RESEND is not REGENERATE

> *"an invitation link stays alive until it expires or he deliberately
> deactivates it… 'I'll send it again' is what kills the working link"*

Two different acts, and staff choose between them. Nothing infers it.

| | RESEND | REGENERATE |
|---|---|---|
| token | **the same one** | a new one |
| the link they already have | **keeps working** | retired |
| invitation row | none written | one written |
| supersede | **never** | yes, explicitly |
| endpoint | `/api/admin-resend-invitation` | `/api/admin-send-invitation` `mode:'regenerate'` |
| subject line | *"Here's your invitation link again — …"* | *"Your invitation to …"* |

**The address is never taken from the request.** Both resend paths read it off
the invitation row, so neither can be pointed at an address someone supplied.

**Staff choose in the UI, not by inference.** On a person's record: *Resend the
same link* leads (it is the safe one); *Regenerate link* sits beside it in a
warning style and takes **two clicks** — the second reads *"Confirm — retire the
current link"* — because it destroys something that may be working right now and
may already be sitting in someone's inbox.

`api/admin-send-invitation.ts` now takes `mode: 'new' | 'regenerate'` and calls
`supersede_invitations` **itself** when regenerating — the same thing the
plain/staff path has always done. That call is the reason §D can land safely.

### #5 — the subject line

*"People triage from the subject line and open one message."* A resend is not a
new invitation and must not look like one, so `kind` drives the subject, not
just the body:

```
first   Your invitation to French Heritage Equestrian
resend  Here's your invitation link again — French Heritage Equestrian
```

and the body opens by saying it outright: *"this is the **same invitation** we
sent you before, not a new one. If you still have the first email, either link
works."*

Every resend writes a `resent` entry on the invitation's trail — a vocab code
that existed since Phase 3a and had never had a writer.

## B. The retired-link page *(#3, #4)*

**#3 — name the inbox.** "Check your inbox for the most recent email" is useless
advice that does not say *which* inbox. The page now says:

> Your current invitation went to **c•••••••••••1@gmail.com** on Monday, August 11.
> Look for the most recent email from us and use the link in that one.

A masked address and a date are not a credential, so the compromise assumption
holds. `invitation_replacement_notice(token)` returns **only** the masked
address and the dates — never the replacement token — and the page **does not
link or redirect** to it.

It returns NULL when the token is unknown, when it is still live (that page is
not shown), and when there is no current invitation to point at — so a dead
token can never be used to discover whether an address has one.

**#4 — "Send it to me again".** Appears only when a current invitation exists.
It sends the **same** link to the address already on file:

- the endpoint takes **no address** and ignores any address in the body;
- `invitation_request_resend` resolves the person's live invitation *from the
  retired token* and returns it **only to the serverless sender** —
  `service_role` is the sole grantee, and the body refuses any other caller;
- rate limited to **3 self-service sends per invitation per hour**, counted off
  the `resent` trail, with `detail='self-service'` so a staff resend never eats
  the invitee's budget;
- the response is `{ ok: true }` whatever happened — sent, rate limited, or
  nothing found — so it is not an oracle for which addresses have invitations.

**Proven through production PostgREST with the site's own publishable key:**

```
anon → invitation_replacement_notice   200  null          (public by design)
anon → invitation_request_resend       401  permission denied for function
anon → GET /invitations?select=token   200  []            (no token leakage)
```

## C. Invitation links — the staff support view *(second follow-up)*

> *"a client reads a URL over the phone, and the owner can tell at a glance
> whether it is the current link, a retired one, or expired — and can send the
> right one immediately without leaving the page."*

`src/components/app/InvitationHistoryPanel.tsx`, mounted on the person's record:
the Clients page invitation card, an existing team member's panel, and (behind a
**Links** toggle) a pending staff invitee's row.

1. **Every invitation ever issued**, newest first. `adminInvitationHistory`
   matches on **both** `contact_id` and the address — the plain/staff path
   writes invitations with no `contact_id`, so either filter alone loses half
   the history. No status filter.
2. Each row: a **Current / Retired / Expired / Redeemed** chip, the **real
   activation URL**, when it was sent, when it expires, and when it was retired
   or redeemed.
3. **One-click copy** on every row. Current rows also get **"Email this link
   again"** — a resend, so what you copied and what they receive are the same
   link. The URL is built from `window.location.origin`, so it is always the
   host you are actually on (and never the parked `fhequestrian.com` — §G).
4. Retired rows say **why** — *replaced by a newer invitation · revoked by staff
   · deleted by staff · expired · redemption failed — {reason}* — and name the
   invitation that replaced them via `superseded_by`.

For the phone case each row also shows `…token=7a99f46a…`, the first characters
of the token — what someone reads out first, so a dictated link is matched at a
glance rather than by comparing 64 hex characters.

**This is a live credential on screen.** It is staff-only by construction:
`invitations` RLS is permissive `is_admin()` **AND** restrictive
`org_id = current_org()`, so a non-admin gets an empty list rather than tokens
(verified above — anon reads `[]`). It is on no list view that is not
staff-gated, and the URL is never logged.

**Note:** that RLS pair is `is_admin()`, not `has_staff_access()` — so an
instructor (MANAGER/EMPLOYEE) sees an empty panel rather than a permission
error. Pre-existing, unchanged, flagged rather than widened.

## D. HELD FOR SIGN-OFF — the supersede default

`docs/proposed/INVITEWORKS-provision-no-default-supersede.sql` — **not applied**,
and deliberately not in `supabase/migrations/` so no sweep can pick it up.

`provision_client_invitation` supersedes on every call. Retiring a link is
REGENERATE, a chosen act — not a side effect of minting a token. This removes
the default; the only thing that then retires a link is a caller asking for it,
which is exactly how the plain/staff path has always worked.

**Dry-run against production, rolled back:**

```
a live link exists, then a repeat provision runs (the /sign resume path):
  original token  status sent   ← survives, which is the whole point
  new token       status sent

then REGENERATE (the explicit supersede the API now calls):
  original token  status superseded
  new token       status sent
```

**Apply it after the frontend deploys.** Between the migration landing and the
deploy, "Regenerate link" would mint a new link *without* retiring the old one —
both stay live until the API carrying `mode:'regenerate'` is out. Nothing
breaks; a stale link just outlives its replacement for that window. The other
order has no gap at all.

```bash
# after deploying, and after you're happy with it:
cp docs/proposed/INVITEWORKS-provision-no-default-supersede.sql \
   supabase/migrations/$(date -u +%Y%m%d%H%M%S)_inviteworks_no_default_supersede.sql
# dry run, then apply, per the CLAUDE.md convention
```

## E. Defect 5 — one live invitation per person *(applied earlier today)*

`supabase/migrations/20260811161000_inviteworks_provision_supersedes.sql`

The plain path called `supersede_invitations`; the provisioned path never did,
so live tokens stacked up: `hello@` 6, `cjzigs@` 3, `cjzigs+averify2@` 2. Proven
live through the deployed API — the older link now dead-ends and the newer one
activates through to paperwork.

**This is the change §D corrects.** It was right that *regenerating* retires the
old link, and wrong that *every send* did. §D keeps the first and removes the
second. Historic rows were not back-filled — those 6/3/2 are pre-existing test
sends and rewriting their lifecycle would be inventing history.

---

## F. NOT VERIFIED — the staff send leg, and how to confirm it

Everything under §A and §C needs a signed-in staff session, which no worktree
gets (`docs/ORCHESTRATOR-HANDOFF.md`, VERIFICATION POLICY 2026-08-10). Stated
separately, as that ruling requires:

- **Proven:** the RPCs those surfaces call, with the exact arguments the
  handlers pass, against production (§1a, §B, §D); and the whole invitee half in
  a real browser (§1b).
- **Not proven:** the handlers' own logic and the new UI, rendered. They
  typecheck (`typecheck` and `typecheck:api` clean; lint 0 errors, 35 warnings —
  identical to the tree without these changes) and nothing more.

### Checklist to run after deploying this branch

1. Sign in at `https://www.frenchheritageequestrian.com/app` as
   **`admin@fhequestrian.com`** (the TENANT owner). *Not `admin@cactai.io` — if
   you use that one, step 3 now tells you so in a sentence instead of failing.*
2. **Clients → New client.** An address you can open, tick **Rider**, defaults,
   no offering. **Create & send invitation.**
3. **Read the panel.** Green *"Invitation emailed to …"* = it left the building.
   Red *"Created but NOT emailed"* = it did not, and the reason is on the next
   line — send me that line.
4. **Open the client's record → Invitation links.** One row, chip **Current**,
   the real URL, a **Copy link** button. Copy it — that is what you would text
   someone standing in front of you.
5. **Resend the same link.** The row's URL must be **unchanged**, and no second
   row appears. Check the inbox: subject *"Here's your invitation link again"*,
   and the link is byte-identical to the first email's.
6. **Regenerate link** → it asks you to confirm → confirm. Now **two** rows: the
   new one **Current**, the old one **Retired — replaced by a newer invitation**,
   both URLs still on screen.
7. **Open the retired URL** in a private window. It must say the link isn't
   valid, name the masked address the current one went to and the date, and
   offer **Send it to me again** — never redirect to the live link.
8. Click **Send it to me again**. The email that arrives carries the **current**
   link. Click it four times in a row: the fourth is silently ignored (rate
   limit) and the page still says the same neutral thing.
9. Finish one activation from the current link and confirm you land on
   *"Let's get you set up"*.
10. Back in the record, the trail under **Invitation timeline** should show
    *Invited → Invitation email sent → Invitation resent → Redeemed*.

### Did three real emails arrive?

Three invitations went out through the **live** production send path during this
work, to addresses you control — these were sent *before* the resend work, so
all three carry the original subject:

- `cjzigs+inviteworks@icloud.com` — 1 email, 15:40 UTC
- `cjzigs+inviteworks2@icloud.com` — 2 emails, 15:48 UTC

If those landed, invitation email delivery is confirmed end to end. Indirect
evidence says they did: `document_deliveries` holds 49 EMAIL rows, latest
**2026-08-10 16:43 UTC**, and those rows are written only after
`sendViaProvider` returns `ok` (`api/_lib/delivery.ts:291`) — the invitation
email uses that same transport.

---

## G. Broken but out of scope — reported, not widened

- **`fhequestrian.com` does not serve the app.** It resolves to
  `162.255.119.189` (Namecheap parking) and times out; the app is on
  `www.frenchheritageequestrian.com`. Mail on the domain is fine (Google MX).
  `BRAND.SITE_URL` in `config_values` points at the dead host, so any email
  linking to the site sends people nowhere. Invitation links are built from the
  request origin, so **they are not affected**.
- **Expired invitations never flip to `expired`.** `maeboon@gmail.com` has been
  `status='sent'` since it expired Aug 4. Nothing sweeps them, so "13 sent"
  reads as thirteen live invitations when several are dead. The new links panel
  shows these correctly (it derives **Expired** from the date, not the column),
  but the underlying row is still wrong.
- **Test rows created by this work, left in place** (D1: purges are owner-run,
  never ad hoc). Two accounts, each contact + client + 4 required documents +
  membership: `cjzigs+inviteworks@icloud.com` (contact `972d89a6…`, user
  `b212e472…`) and `cjzigs+inviteworks2@icloud.com` (contact `a92aace9…`, user
  `77841e60…`). Both redeemed and `active`. Say the word and they go through
  `purge_account`.
- **`sendViaProvider` has no timeout.** A hung SMTP connection hangs the
  function until Vercel kills it; the invitation is already committed by then,
  so the operator sees a request that never returns.
- **Supabase default privileges grant `EXECUTE` to `anon` at CREATE time**, so
  `REVOKE … FROM public` does **not** close a function — it leaves the
  role-specific grant untouched. Caught on the first apply of
  `20260811170000` (`proacl` still carried `anon=X`); every function in that
  migration now revokes by name, including a correction for
  `record_invitation_delivery` from the earlier one. **Worth checking the other
  ~48 SECURITY DEFINER functions** — anything relying on a PUBLIC revoke alone
  is reachable by `anon` today.

---

## H. What changed

```
api/admin-send-invitation.ts                    stage-tagged errors, org guard,
                                                mode:new|regenerate, delivery recording
api/admin-resend-invitation.ts                  NEW — same token, no supersede, no new row
api/invitation-resend-request.ts                NEW — public, rate-limited, address-on-file only
api/_lib/invitationEmail.ts                     options object; resend SUBJECT; {ok,messageId,error};
                                                recordInvitationDelivery + resendInvitationEmail
api/sign-start.ts                               records its (invisible) delivery outcome
src/lib/api.ts                                  invitationReplacementNotice, requestInvitationResend
src/lib/admin.ts                                real error body, adminInvitationHistory,
                                                adminResendInvitation, inviteLinkState/RetiredReason
src/pages/Register.tsx                          retired-link page: masked address, date, self-resend
src/components/app/InviteResultPanel.tsx        NEW — the one send-result panel
src/components/app/InvitationHistoryPanel.tsx   NEW — every link ever issued, copyable
src/components/app/ProvisionClientForm.tsx      uses InviteResultPanel
src/pages/app/Admin.tsx                         Resend vs Regenerate (two-click), links panel
src/pages/app/ops/TeamPage.tsx                  links panel on staff records + pending invitees

supabase/migrations/20260811160000_inviteworks_delivery_trail.sql        APPLIED
supabase/migrations/20260811161000_inviteworks_provision_supersedes.sql  APPLIED
supabase/migrations/20260811170000_inviteworks_resend_support.sql        APPLIED
docs/proposed/INVITEWORKS-provision-no-default-supersede.sql             HELD — §D
```

`npm run typecheck` 0 errors · `npm run typecheck:api` 0 errors · `npm run lint`
0 errors, 35 warnings (identical to the tree without these changes).
