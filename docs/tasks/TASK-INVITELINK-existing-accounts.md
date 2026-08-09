# TASK INVITELINK — a contract invite sent to an existing member should open the contract

Owner, 2026-08-09: *"Why is it that I send the contract to both parties and the copy that goes
to my iCloud email is giving me an activation link instead of opening the browser that's
already signed into that account, or giving me the login page?"*

---

## What actually happens

`api/contract-invite.ts` builds the SAME link for every recipient:

```
${origin}/activate?token=${token}&kind=contract
```

It never checks whether the recipient already has an account. The only profile lookup in that
file is the SENDER's, for authorisation.

`Register.tsx` then has one escape hatch — if the current session's email matches the
invitation's email exactly, it redeems and navigates straight to the contract. **Verified in
production: the invite emails DO match real accounts exactly**, so that path is reachable.
It fails only when the browser is signed in as somebody else, which is the normal case for
staff sending themselves a copy.

Everyone who is not already signed in as that exact person lands on an account-activation
form.

## The two defects

**1. Wrong link for an existing member.** Someone with an account does not need to activate
anything. They need the contract, and a sign-in prompt if they are not signed in. Sending
"activate your account" to an established member is the part that reads as broken.

**2. The fall-through is silent.** Landing on the registration form, there is no statement of
who the invitation is for, no indication that you are signed in as someone else, and no route
to the document. It looks like the wrong page rather than a deliberate refusal.

## What to build

**Branch the link on whether the recipient already has an account.**

- **Has an account** → link straight to the contract (`/app/contracts/<id>`). If they are not
  signed in, the app's normal sign-in should return them there afterwards — confirm that the
  post-login redirect preserves the destination before relying on it. `TASK-WALLRETURN`
  solved a closely related problem; read it first.
- **No account** → keep today's `/activate?token=…&kind=contract` exactly as it is. That flow
  works and is not in scope.

**Make the mismatch legible.** When an activation link is opened while signed in as a
different person, say so plainly: who the invitation is for, who you are signed in as, and
offer both ways out — sign out and continue as the invited person, or go to the app as
yourself. Never silently redeem an invitation for a different identity.

## Do not break

- **The token must remain valid** even when a direct link is sent. It is the proof of
  invitation and other flows record against it — do not stop issuing it, only stop making it
  the recipient's route in.
- **Invitation lifecycle** (`record_invitation_failure`, `supersede_invitations`, expiry) is
  untouched by this.
- `redeem_contract_invitation` stays the mechanism for account-less recipients.

## Verification

1. Send to an existing member → the email links to the contract, not to activation.
2. That member, signed OUT, follows it → signs in → lands on the contract, not the dashboard.
3. That member, signed IN as themselves → the contract opens directly.
4. Signed in as SOMEONE ELSE → an explicit explanation with both exits. No silent redeem.
5. A recipient with no account → today's activation flow, unchanged.
6. Sarah's document `704c8d2d-…` is a LIVE NEGOTIATION — read-only, never write.

## Reporting

`docs/reports/TASK-INVITELINK-REPORT.md`. State what was verified against a real send versus
reasoned about.
