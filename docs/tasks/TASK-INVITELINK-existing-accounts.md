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

## What to build — OWNER'S DIRECTION, 2026-08-09

> "This needs to be completely reversed. We need to set a hook to the actual document and hit
> the auth page on the way in."

**Reverses the branching approach an earlier revision of this doc proposed.** Do not build
two link shapes.

### First: what a party actually is — this is why the token cannot be dropped

Owner, 2026-08-09: *"The only way a person is on a contract as a party with the linked info
from their profile is that they are in the system. But we also need to be able to send a
contract to a person without an account — invite someone to claim this party."*

**Every party is a `contact`.** `document_parties` points at a contact, and that contact is
what the party's name and address render from. An account is a separate thing layered on top.
So there are THREE states:

| state | has | can sign in |
|---|---|---|
| Party with profile-linked info | contact **+** account | yes |
| **Party awaiting claim** | contact **only** | **no** |
| Not a party | neither | — |

The middle state is the one the owner is naming, and the machinery already exists: the
invitation carries `contact_id` and `document_id`, and `redeem_contract_invitation` calls
`promote_contact_to_account(auth.uid(), contact_id)` — binding the account the person just
created to the contact that is already the party.

**So the token is not merely authentication. It is the CLAIM on a party slot.** Drop it and an
account-less recipient creates an unrelated account, is not the party, and cannot see the
document — while a duplicate contact for the same human now exists. That is why the token
rides along on the document link rather than being replaced by it.

### One link, for everyone

The email links to **the document itself**, carrying the invitation token:

```
/app/contracts/<documentId>?invite=<token>
```

**The document is the destination. Authentication is an interstitial on the way to it, never
a destination in itself.** Whoever opens the link is going to the same place; what differs is
what has to happen before they arrive.

### The three arrivals, one route

| who opens it | what happens |
|---|---|
| **Signed in, is a party** | The document opens. Nothing else. |
| **Not signed in, has an account** | Auth page → signs in → **continues to the document**. |
| **No account** | Auth page → creates the account using the token → **continues to the document**. |

The differences are handled *inside* the auth step. The URL never changes shape and the
recipient never sees a page about their account when they asked for a contract.

### What that requires

1. **The destination must survive the auth round trip**, including an OAuth redirect out to
   Google and back. `TASK-WALLRETURN` solved exactly this class of problem — the signing wall
   was discarding the destination — so **read that first and reuse its mechanism** rather
   than inventing a second one.
2. **The token must survive with it.** An account-less recipient still needs
   `redeem_contract_invitation` to run, and it must run *before* the document renders or they
   will arrive without access. Redemption becomes a step in the auth path, not a page.
3. **The token stays issued and stays valid.** It is the proof of invitation and other flows
   record against it. What changes is that it is no longer the recipient's route in — it rides
   along as a query parameter.
4. **An already-redeemed token must not break the link.** A member returning to the contract a
   week later hits the same URL with a spent token; that must open the document, not error.

### What this deletes

`/activate?token=…&kind=contract` stops being the contract invitation's link. **Do not remove
the `/activate` route** — other invitation kinds still use it, and old links already sent must
keep working. It simply stops being what a contract email points at.

## Verification

1. **Every** contract email links to the document, whoever it is addressed to.
2. Signed in and a party → the document opens directly.
3. Signed OUT with an account → auth, then the DOCUMENT. Not the dashboard.
4. **No account** → auth, account created, token redeemed, then the DOCUMENT — verify the
   redemption actually ran, not just that the page loaded.
5. Signed in as SOMEONE ELSE → explicit: who it is for, who you are, both exits. No silent
   redeem of another person's invitation.
6. **Returning later with a spent token** → the document opens. Does not error.
7. Survives an OAuth round trip to Google and back with the destination intact.
8. Old `/activate?token=…&kind=contract` links already in inboxes still work.
6. Sarah's document `704c8d2d-…` is a LIVE NEGOTIATION — read-only, never write.

## Reporting

`docs/reports/TASK-INVITELINK-REPORT.md`. State what was verified against a real send versus
reasoned about.
