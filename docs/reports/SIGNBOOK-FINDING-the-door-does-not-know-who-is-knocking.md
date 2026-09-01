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

## 4 · ⚠️ BUILT — the owner directed it be built in this thread rather than routed
| What | Where |
|---|---|
| **One reader of `auth.users`** — `account_state_for_email(text)`, `SECURITY DEFINER`, **service_role only**, `anon`/`authenticated` explicitly revoked | `20260901T1700` |
| **The third email** — `SIGN_IN_EXISTING`, a template row (D13), link on `/login` | `20260901T1700` |
| **The door branches** on the state before it provisions anything | `api/sign-start.ts` |
| **The 409 is fixed** — the dead PostgREST read replaced by that RPC | `api/register-invited.ts` |
| **The website order finally sends the activation link** | `api/request-activation.ts`, dispatched from `submitRequest` |
| One shared branch, so the two doors cannot drift (D18) | `api/_lib/accountDoor.ts` |

**Proven on production, all four cases, `BEGIN … ROLLBACK`:**
```
active  cjzigs@icloud.com        {"state":"active","user_id":"0a7fc801-…","contact_id":"cfce55a1-…"}
known   caseyluke1029@gmail.com  {"state":"known","user_id":null,"contact_id":"1d88cfc6-…"}
new     nobody@example.invalid   {"state":"new","user_id":null,"contact_id":null}
google  madelinedo@gmail.com     {"state":"active", …}      ← no password, and still active
case    "  CJZIGS@IcLoUd.CoM "   {"state":"active", …}      ← trimmed and folded
refused for authenticated: not authorized
```
⚠️ **`cjzigs@icloud.com` is the owner's own failing test case, and it now answers `active`** — so
that address gets "click here to sign in", never an activation link, and never reaches the 409.

### ⚠️ TWO TRAPS CAUGHT WHILE BUILDING IT
1. **"Has a password" is the WRONG test for "can sign in."** 9 of the 18 live accounts carry no
   `encrypted_password` at all — they are Google identities and they sign in perfectly well. Testing
   for a password would have sent every Google member down the auth-setup path they finished months
   ago. The function tests for an **identity**.
2. **`p_send: false` on `provision_client_invitation` is not "I'll send it myself".** It sets the
   invitation's STATUS — `CASE WHEN p_send THEN 'sent' ELSE 'draft' END` — and
   `api/register-invited.ts` refuses anything not `'sent'` with a 404. Passing it would have minted
   a link that **404s on arrival**. It is left defaulted, exactly as `api/sign-start.ts` leaves it.

### FLAGGED — one decision the ruling did not settle
An order-bearing submission now sends the **activation** email **and** still sends
`/api/inquiry-confirmation`'s *"here is what you sent us"* copy (CAREPATH §C6, his own earlier
ruling). **That is two emails for one act.** I did not remove the confirmation — it is a standing
ruling and removing it is subtractive (NOSTRIP) — but he may want one message, not two.

## 5 · WHAT `TASK-SIGNBOOK` DID AND DID NOT DO
It proved the mechanism, recorded the ruling, **and — on the owner's explicit direction, given when
offered the choice between fixing only the 409, building all of it, or routing it — built all of
it.** ⚠️ **`api/sign-start.ts` is `TASK-SIGNDOOR`'s file, merged hours earlier, and SIGNBOOK §7 puts
the door out of scope. Both were overridden by the owner, deliberately, and this line is the record
of it.** Nothing was done silently.

⚠️ **ORCH: this still belongs in `docs/reference/CHANGE-ORDER-LEDGER.md`** — as a ruling that is
already built, not as work to dispatch. It is the answer to CR-98 A1's *"Establish where this stands
today."*
