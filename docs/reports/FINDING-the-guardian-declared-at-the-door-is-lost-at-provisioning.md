# FINDING — the guardian a parent declares on the website is lost at provisioning

**Owner, 2026-09-01:** *"yea i see the relationship but ill let you trace this down and suggest
revisions to the connection between the two."* This is the trace and the proposal.
⚠️ **It also CORRECTS what I told him an hour earlier.** I said the minor answers *"are never read"*.
Half of that was wrong, and the wrong half was the important half.

## 1 · WHAT ACTUALLY EXISTS — the minor spine WORKS
| | |
|---|---|
| `attach_minor_to_guardian(uuid,text,text,date)` | the one writer |
| `contacts.guardian_contact_id` | the link |
| `contacts_minor_no_email_guard()` | ⚠️ **a minor contact may carry NO email** — *"put the address on the guardian record"* |
| `is_minor_contact(uuid)` · `_sign_path_allows_minor(text)` | the readers |
| `Onboarding.tsx` details step | the surface that asks |

**Proven on Casey Caddell's own records — the wizard did it correctly:**
```
b2d7d4ea  Charlotte Caddell  dob 2013-03-09  email —      guardian → Casey   created 2026-09-01
```
No email, a real DOB, guardian-linked, not a client. **That is the right shape**, and it was produced
by the wizard on 1 September.

## 2 · WHAT FAILED — the OTHER door, two days earlier
```
c44de468  Charlotte Caddell  caseyccaddell@gmail.com  CLIENT  1 order  1 booking  0 documents  no login
          invitation sent 2026-08-29, never redeemed
```
A 13-year-old, provisioned as **a full adult client with her own email address**, holding an
Evaluation Lesson and owing four documents she cannot sign because she has no account — and the
invitation went to an address she never gave us.

## 3 · 🔒 THE DEFECT, EXACTLY
**Casey declared the guardian relationship on the PUBLIC FORM on 28 August:**
```
details = {"rider_name": "Charlotte Caddell", "rider_age": "13", "age_bracket": "Under 18",
           "rider_declared_age": "13",
           "guardian_approval_acknowledged": "Yes — I am under 18 and my parent or legal guardian…"}
notes   = "Hi. My daughter rode a few years ago and would like to get back into riding…"
```
⚠️ **And provisioning never sees it.** Measured:
- `provision_client_invitation` — **zero references to `minor` or `guardian`**.
- `api/admin-send-invitation.ts` — zero references to `rider_name` or `attach_minor_to_guardian`.
- Nothing in the staff provisioning surface reads `requests.details`.

**So the answer is only known on one of the two doors.** The wizard asks the person directly and
gets it right. The lead → client path has the answer sitting in the row it is provisioning FROM, and
never looks at it. ⚠️ **The information was not missing. It was ignored.**

**And it is silent**: nothing warns that a contact being created as a client was declared a
13-year-old. The `contacts_minor_no_email_guard` trigger would have refused the email — but only if
a DOB had been set, and provisioning never sets one, so the guard slept.

## 4 · SUGGESTED REVISION — smallest first, and none of it is new machinery
1. **Show it.** The provisioning surface must display the declared rider and age off
   `requests.details` before staff press the button. ⚠️ *A staff member who could see "rider:
   Charlotte Caddell, 13" would not have typed an email address for her.*
2. **Route it.** When a lead declares an under-18 rider, provisioning creates **the guardian's**
   account and calls `attach_minor_to_guardian` for the child — the same call the wizard makes.
   One writer, two callers (D18). The child gets no email, no login and no client row, because that
   is what the existing guard already says a minor is.
3. **Refuse the wrong shape.** `provision_client_invitation` should raise when asked to create a
   client whose linked request declares them under 18 — the same way the trigger refuses a minor
   with an email. **A silent success is what produced record `c44de468`.**
4. **Reconcile the two Charlottes.** `c44de468` holds a real order and a real booking, so it cannot
   simply be archived — the booking must move to the guardian's account with `b2d7d4ea` as the
   attached participant. ⚠️ **Owner's call, and he has said he will resolve the live case himself.**

## 5 · WHAT I DID NOT DO
Nothing above is built. `provision_client_invitation` is a shared spine and the provisioning surface
is `ContactDossierModal.tsx`, which item 4.2 of the owner's backlog says should become a page —
building into it now would be building into something scheduled to move.
