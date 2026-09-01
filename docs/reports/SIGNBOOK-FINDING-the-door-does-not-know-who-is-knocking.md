# FINDING — the door does not know who is knocking

**Raised by the OWNER, 2026-09-01, from his own live test, during `TASK-SIGNBOOK`.**
⚠️ **This is a DEFECT plus a SPECIFICATION. It is recorded here because a decision that lives only
in a chat reply does not exist. `TASK-SIGNBOOK` did not build it — see §4.**

## 1 · THE OWNER'S WORDS, VERBATIM
> *"yea there is a major fuckup here on two sides. 1) it doesnt check if that email belongs to and
> account already, my test case just proved that by rejecting my password setup step on submission
> of the password i created. 2) a valid form submission creates a lead with an order, when the user
> does this they should be sent an email with the link to activate their account and that is the
> exact same flow as this one, same link destination, everything, if they already completed that
> flow and we just didnt realize it, the input of the email address should trigger an email to them
> that says click here to sign into your account. and the link takes them to the login page to log
> in since they already have an active account with auth set up. if they didnt do that step and all
> they did was submit the form to us then the email should be recognized as belonging to that
> account but needing auth set up and docs signed so the email they received tells them what the
> current email i just received says and the link takes them to the screen i just got to where i
> create my auth."*

## 2 · 🔒 THE RULING — ONE EMAIL FIELD, THREE STATES, THREE DIFFERENT EMAILS AND DESTINATIONS
| State of the address | The email says | The link goes to |
|---|---|---|
| **has an active account, auth already set up** | *"click here to sign into your account"* | 🔒 **the LOGIN page** |
| **known to us but no auth yet** — they only ever submitted the form | 🔒 **exactly what today's activation email says** | 🔒 **the auth-setup screen** (password creation) |
| **brand new** | today's activation email | the auth-setup screen |

🔒 **AND: a website form submission that creates a lead with an order MUST send that same activation
email — "the exact same flow as this one, same link destination, everything."**

## 3 · ⚠️ WHY HIS PASSWORD SUBMIT WAS REJECTED — MEASURED, NOT GUESSED
`api/register-invited.ts:66-77` already has a branch for *"the email already has an auth account"*.
It looks the user up and sets the password they just chose. **That branch cannot ever succeed**:

```
$ select has_schema_privilege('service_role','auth','USAGE'),
         has_table_privilege('service_role','auth.users','SELECT');
 schema_usage | users_select
 t            | f
```
The lookup is `db.schema('auth').from('users').select('id')…` — a PostgREST read of `auth.users`,
and **`service_role` has no SELECT on that table**. So `existing?.id` is always null and the branch
falls to its own guard:
```
409  "an account already exists for this email — sign in instead"
```
⚠️ **This is failure mode 2a exactly** (`TASK-ROLE.md` §2a): code that reads as if it handles the
case, and handles nothing. **The fix is to stop reading `auth.users` through PostgREST** and use the
admin API instead (`auth.admin.listUsers` / `getUserById`), which is the same client already in the
file and needs no new privilege.

**His own test data proves the state:**
```
email                      | invitation | auth_user_exists | auth_created        | profile_exists
cjzigs@icloud.com          | sent       | t                | 2026-07-28 15:38    | f
charlesjzigmund@icloud.com | sent       | f                | —                   | f
```
`cjzigs@icloud.com` has had an auth user since 28 July and **no profile** — the exact "known, auth
exists, nothing else done" case, and the one that 409s.

## 4 · WHAT `TASK-SIGNBOOK` DID AND DID NOT DO
**Did:** proved the mechanism above and recorded it. **Did not build it**, because every part of it
lands outside this task's spec and inside files it does not own:
- `api/sign-start.ts` — `TASK-SIGNDOOR`'s, merged 2026-09-01. SIGNBOOK §7 puts the door out of scope.
- `api/register-invited.ts` — nobody's; the 409 above is a contained fix and is the one piece that
  could ship on its own.
- The website-submission → activation-email link — **does not exist at all**; `submit_public_request`
  has zero references to invitations or provisioning, and both live order-leads confirm it
  (`caseyluke1029@`, `msrachelpage@`: *NO INVITATION EVER SENT*).
- A new email template + a login-destination link — new surface, new copy, D13 template work.

⚠️ **ORCH: this belongs in `docs/reference/CHANGE-ORDER-LEDGER.md` and then to `DSNR`.** It is the
same subject as CR-98 A1's *"Establish where this stands today"*, and it now has an answer.
