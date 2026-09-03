# TASK-GRANTS-B — close the `anon` door on every writer nothing anonymous calls

**Profile: `CODR` (`docs/method/CODR-PROFILE.md`). Worktree: assigned by `FHE-MGMT-GRANTS` in your
dispatch line. Branch `task/grants-b` from `origin/main`.**
**Hand this back to `FHE-MGMT-GRANTS`** — not to ORCH, not to the owner.
**Authored by `FHE-TASK-GRANTS-A` (DSNR profile) 2026-09-03. Bundle: `docs/orch/BUNDLE-GRANTS.md`.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **§2a is this task's whole subject.**
>   `docs/method/CODR-PROFILE.md` — your profile. `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-GRANTS-B-LEDGER.md` FIRST.
> - 🔒 **`docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md`** — the sweep, the classification, the
>   evidence behind every recommendation, and **the owner's ruling, which `FHE-MGMT-GRANTS` writes into
>   its `## RULING` section before you are dispatched.** ⚠️ **If that section is absent or says only
>   Block A, build Section 1 and STOP — §6 says what that means.**
> - `docs/orch/BUNDLE-GRANTS.md` — the seven items and the ownership declaration (**ACLs ONLY, never a
>   body, no `DROP`**).
> - 🔒 **`supabase/migrations/20260902T0010_the_retired_kiosk_closes_the_last_anonymous_signing_door.sql`
>   — THE INCUMBENT AND THE IDIOM. Copy its shape: explicit-role revoke by full signature, a header
>   that says why, and a `proacl` proof after.** This task is that migration at scale, not a new
>   mechanism.
> - `docs/reports/TASK-BOOKS1-REPORT.md:80` and `docs/reports/TASK-BACKDATE-REPORT.md:288-294` — the
>   trap the whole bundle exists for, in the words of the two threads it caught.
> - `CLAUDE.md` **D35** (a worktree does not isolate the database — re-prove immediately before you
>   report) · **D32** (nothing is deleted; this migration revokes and never drops).
> - `docs/reports/TASK-SIGNFLOW-D-REPORT.md` §4 (the flagged grants and the comment texts) and §5.1
>   (why `authenticated` was left on the two retired sign functions, and why it is now yours).

---

## 1. THE ONE SENTENCE

**Three hundred and twenty-six `SECURITY DEFINER` functions in `public` can be executed by `anon`.
One hundred and forty-five of them WRITE. One of those is a public door by design (`submit_public_request`). This task revokes
the other 144, in one ACL-only migration, and fixes four comments that describe code that no longer exists.**

## 2. WHAT WAS MEASURED — 2026-09-03, production, by `FHE-TASK-GRANTS-A`

⚠️ **Every number below is a hypothesis until you re-run it (`TASK-ROLE.md` §"SECOND ACT").
Re-run the query; if a count has moved, say so and build against reality.**

```sql
-- the population
select count(*) filter (where true)                                                  as secdef_total,
       count(*) filter (where has_function_privilege('anon',p.oid,'execute'))         as anon_exec,
       count(*) filter (where has_function_privilege('anon',p.oid,'execute')
                          and p.prorettype = 'trigger'::regtype)                      as anon_trigger,
       count(*) filter (where has_function_privilege('anon',p.oid,'execute')
                          and p.prorettype = 'event_trigger'::regtype)                as anon_evt_trigger
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;
--  675 | 326 | 45 | 1
```

| | count | what this task does with it |
|---|---|---|
| `SECURITY DEFINER` in `public` | 675 | — |
| …`anon` can EXECUTE | **326** | — |
| — trigger functions (inert through the API) | **45** | **revoked**, §4 group T |
| — `rls_auto_enable()`, an `event_trigger` (equally inert) | **1** | **revoked**, §4 group T |
| — callable **writers** (the body writes; verified by reading all 326 bodies) | **145** | **144 revoked** · 1 KEEP — ruled CR-116, see the RULING in the escalation list |
| — callable **readers** | **135** | **out of scope**, except the 2 in §4 group P |

**Why `provolatile` is not the test:** the bundle's candidate set was the 151 anon-executable volatile
non-trigger functions. That set is wrong in both directions — it contains readers
(`claim_request_alert_send`, `require_module`, `dm_list_conversations`, `dm_unread_total`, `feed_get`
all only SELECT) and the writer test found writers by reading bodies, one level of callee resolution
deep. **The full classification, function by function with its write targets, its in-body guard and its
call sites, is `docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md`. Do not re-derive it; verify a sample
and say which you checked.**

## 2b. 🔒 THE FOUR NAMED ITEMS — their `proacl` as `FHE-TASK-GRANTS-A` read it, production, **2026-09-03 07:13:13 PDT**

⚠️ **This is a BEFORE picture from another thread's session. Re-read it yourself (D35) — a grant can
have moved.** It is here so you can see at a glance whether it did.

```
item 1  request_purchase_payment(p_purchase_id uuid, p_note text)
          postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres
          anon=t  authenticated=t  secdef=t  volatile
          ⚠️ its OWN migration 20260823T0140_creditgrant_5_…sql:123-124 revokes anon. Production does not
             reflect it — that is the whole reason this bundle exists.
          only caller: api/order-request-payment.ts:74, via callerClient(bearer) → `authenticated`

item 2  reap_expired_holds()
          postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres
          anon=t  authenticated=t  secdef=t  volatile
          writes request_selections; NO in-body guard
          only caller: api/expire-holds.ts:64, via getSupabaseAdmin() → `service_role`
          → `anon` has no caller at all

item 3  trg_seed_display_name()
          =X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres
          anon=t  authenticated=t  **secdef=f (SECURITY INVOKER)**  returns trigger
          note the leading `=X/postgres` — that is PUBLIC EXECUTE, on top of the direct anon grant.
          301 of the 326 carry it. `FROM PUBLIC, anon` is why both roles are named in every statement.

item 5  sign_release(26 args)  ·  sign_general_release(text, text, text, text, uuid, boolean)
          postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres   (both)
          anon=**f** (already closed by 20260902T0010)  authenticated=**t**  secdef=t  volatile
          zero callers: grep -rn "'sign_release'\|'sign_general_release'" src api → empty, 2026-09-03
```

## 3. 🔒 THE INCUMBENT, NAMED (D18) — this is a REPEAT, not a new mechanism

**`supabase/migrations/20260902T0010_the_retired_kiosk_closes_the_last_anonymous_signing_door.sql`
already did exactly this for two functions**, and its header already contains the two warnings this
task turns into a policy:

> *"⚠️ REVOKE FROM PUBLIC ALONE IS NOT ENOUGH — a direct grant to `anon` survives it, and this repo has
> been caught by that before. Both roles are named."*
> *"⚠️ THE FUNCTIONS THEMSELVES ARE NOT DROPPED. A DROP + CREATE would reset the ACL to the schema
> default and re-grant anon through Supabase's default privileges."*

🔒 **CONVERGENCE, NOT GREENFIELD. Same idiom, same file shape, more rows.** Do not invent a helper
function, a loop, or a `DO $$` block that revokes by pattern — **the statements are written out, one
per function, so the diff IS the audit trail** and a later reader can see exactly which door closed.

## 4. THE MIGRATION — one file, ACL statements only

**`supabase/migrations/YYYYMMDDTHHMM_<sentence-name>.sql`.** ⚠️ **NO `CREATE`, no `CREATE OR REPLACE`,
no `DROP`, no `ALTER FUNCTION`, no function body of any kind.** B2 FUNNELDEBT owns bodies. **If the
sweep shows a body needs a guard, that is a line in your report routed up — never a statement here.**

**Every statement takes this exact form, explicit roles, full signature:**

```sql
REVOKE ALL ON FUNCTION public.<name>(<identity args>) FROM PUBLIC, anon;
```

⚠️ **Never touch `service_role` or `postgres`. Grant nothing new — there is NO exception.**
*(Corrected by `FHE-MGMT-GRANTS` 2026-09-03 on `TASK-GRANTS-B`'s report §2 Q3: this line used to read
"with one exception named in group S", and group S contains two REVOKEs and no GRANT. Group S's heading
names the `authenticated` grant it REMOVES, not one it adds; `service_role` keeps EXECUTE by not being
revoked. Proven in production 12:20 PDT — `sign_release`/`sign_general_release`: authenticated=f,
service_role=t. The migration as built contains zero GRANT statements, which is correct.)*

### 🔒 GENERATE THE STATEMENTS; DO NOT TYPE THEM

**Hand-typing 190 signatures is how a signature goes wrong. Run this and paste its output into the
file** (it is also your before-picture — keep it in the ledger):

```sql
select 'REVOKE ALL ON FUNCTION public.' || p.proname || '('
       || pg_get_function_identity_arguments(p.oid) || ') FROM PUBLIC, anon;'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')
  and <the group predicate below>
order by p.proname;
```

### Group W — the writers. 144 functions (142 pinned below + `open_gift` + `redeem_gift`, added by the CR-116 ruling — see Section 2).
Predicate: `p.prosecdef and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype)
and p.proname in (<the list below>)`

⚠️ **This list is the classification's output and it is PINNED. It is not a pattern to re-derive —
if your own sweep disagrees with it, that is a finding you report before you build, not a list you
quietly edit.** It contains **items 1 and 2** of the bundle (`request_purchase_payment`,
`reap_expired_holds`) and every Block-A function from the escalation list.

```
'_restore_contract_template_composition', 'acknowledge_content_block', 'add_contact_location',
'add_deal_document', 'add_deal_member', 'add_form_field', 'add_my_location',
'agree_change_request', 'apply_offering_documents', 'apply_sign_path_documents',
'approve_contract_review', 'approve_contract_termination', 'archive_contract',
'assign_horse_section', 'attach_horse_to_document', 'capture_horse_record_info',
'claim_document_origination', 'company_contact_id', 'complete_deal', 'confirm_my_legal_name',
'consume_notification', 'create_contract_note', 'create_deal', 'create_evaluation_report',
'decline_contract_termination', 'delete_contract_comment', 'deliver_evaluation_report',
'dm_delete_message', 'dm_edit_message', 'dm_hide_conversation', 'dm_mark_conversation_read',
'edit_change_request_entry', 'edit_contract_comment', 'edit_form_field',
'ensure_my_member_access', 'feed_mark_seen', 'feed_moderate', 'feed_post_create',
'feed_post_delete', 'feed_post_update', 'feed_report_post', 'feed_seed_welcome',
'feed_set_view_shape', 'feed_share', 'gift_mark_sent', 'gift_reschedule', 'gift_transfer',
'grant_lesson_credit', 'hard_delete_contract', 'insurance_resolution_sync',
'link_contract_to_purchase', 'log_evaluation_report_access', 'log_mirror_delivery',
'log_payment_request_send', 'log_request_alert_send', 'mark_change_request_seen',
'mark_comment_review', 'mark_document_opened', 'mark_tour_seen', 'my_stable_add_horse',
'my_stable_delete_horse', 'my_stable_update_horse', 'notify_review_changes',
'post_contract_note_message', 'promote_lookup_suggestion', 'propose_community_event',
'provision_client_invitation', 'publish_open_slots', 'reap_expired_holds',
'reassign_document_party', 'record_invitation_failure', 'record_lookup_suggestion',
'redeem_invitation', 'redeem_my_pending_invitation', 'remove_deal_member', 'remove_form_field',
'rename_contract_note', 'reopen_change_request', 'reopen_deal', 'reply_to_change_request',
'request_contract_termination', 'request_documents_from_contact', 'request_permission_to_edit',
'request_purchase_payment', 'require_resign_from', 'resend_executed_document_email',
'resolve_change_request_thread', 'resolve_consumption_billing', 'resolve_version_decision',
'restore_content_block_version', 'restore_contract_template_version',
'restore_email_template_version', 'restore_form_definition_version',
'revoke_lesson_credit_grant', 'save_content_block_version', 'save_contract_template_version',
'save_email_template_version', 'save_evaluation_report', 'save_form_definition_version',
'say_hi', 'say_hi_back', 'send_contract_to_party', 'set_contact_required_documents',
'set_contact_type', 'set_document_co_buyer', 'set_document_party_archived',
'set_document_party_hidden', 'set_field_control_override', 'set_field_included', 'set_field_na',
'set_field_responsibility', 'set_field_structured', 'set_form_field_options',
'set_form_required', 'set_horse_locations', 'set_horse_medications', 'set_lesson_progress_note',
'set_my_onboarding_horses', 'set_support_status', 'share_evaluation_report',
'sign_start_register_attempt', 'staff_assign_documents', 'staff_assign_horse_party',
'staff_end_horse_relationship', 'staff_request_horse_record_completion', 'staff_update_horse',
'start_bill_of_sale', 'start_bill_of_sale_standalone', 'start_sale_contract',
'submit_acquisition_intake', 'submit_change_requests', 'submit_support_request',
'supersede_invitations', 'transfer_payment_responsibility', 'update_contact_record',
'update_deal', 'update_horse_record', 'update_purchase_payment_method', 'upsert_change_request',
'upsert_content_block', 'void_deal', 'void_document'
```

### Group P — the two zero-caller readers. 2 functions.
`release_preview(p_template_key text, p_org uuid)` · `general_release_preview(p_org uuid)`
**Readers, in only because `TASK-SIGNFLOW-D-REPORT.md` §4 bullet 2 flagged them as having zero callers.**
Re-prove it before you write the statement: `grep -rn "'release_preview'\|'general_release_preview'" src api`
must be empty. ⚠️ **This is the ONLY reader work in this bundle. Do not widen to a read-ACL sweep.**

### Group T — the inert ones. 47 functions, and the point is the CLAIM, not the risk.
Predicate: `p.prosecdef and p.prorettype in ('trigger'::regtype,'event_trigger'::regtype)` — **45 + 1**
— **plus, by name, `trg_seed_display_name()`** (the bundle's item 3).

⚠️ **`trg_seed_display_name` is `SECURITY INVOKER`, so the predicate does NOT catch it.** The
`FHE-MGMT-GRANTS` ledger says it is "one of the 45"; measured 2026-09-03 it is not — `prosecdef = f`.
**Add it by name and say so in your report.** Its `proacl` on 2026-09-03 07:13 PDT:
`=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres`.

**Why they are in the migration at all:** a trigger function cannot be invoked through the API, so this
changes no behaviour. `TASK-SIGNBOOK-VERIFICATION.md` recorded *"anon confirmed absent on every
migration"* and that claim was **false** because of this one function. **The revoke makes the claim true.**

### Group S — items 5's `authenticated` grant. 2 functions, and this group is SUBTRACTIVE.
```sql
REVOKE ALL ON FUNCTION public.sign_release(<26 args>) FROM authenticated;
REVOKE ALL ON FUNCTION public.sign_general_release(text, text, text, text, uuid, boolean) FROM authenticated;
```
`anon` is already gone from both (`20260902T0010`). `TASK-SIGNFLOW-D` §5.1 left the `authenticated`
grant deliberately — *"it is subtractive beyond the spec's letter while three other threads are live"* —
and flagged it. **The bundle is that follow-up.** Confirm with `grep -rn "'sign_release'\|'sign_general_release'" src api`
(empty on 2026-09-03) before you write these two, and leave the `service_role` grant standing.

### 🔒 KEEP — ONE function this migration must NOT touch, and the test proves it
| function | why |
|---|---|
| `submit_public_request(…)` | the public contact form. `src/lib/api.ts:79` ← `InquiryForm.tsx:208`, `PublicIntakeForm.tsx:220`. Revoking it kills every inbound request. **Ruled KEEP, CR-116.** |

### Section 2 — RULED (owner, 2026-09-03, CR-116 — `## RULING` at the end of the escalation list)
**`open_gift(p_code text)` and `redeem_gift(p_code text)`: REVOKE anon. Both join group W.** Add both
names to group W's list when you generate the statements and say so in your report. The owner: *"the
reveal of you got a gift is an email animation"* — there is no anonymous user; the gift code is no
longer a credential. **This overrules the DSNR-profile recommendation to KEEP `open_gift`**; the spec
was amended by `FHE-MGMT-GRANTS` on the ruling, not on judgment.
**Safety (MGMT re-run 2026-09-03 10:41 PDT, matches ORCH): `gifts` = 0 rows total / 0 opened / 0
redeemed.** Nothing live is reached through `/redeem` anonymously today — so revoking breaks nothing
that works, and the rebuild of the gift flow onto the activation link is **B2 FUNNELDEBT's**, not yours.
You do not touch `Redeem.tsx`, `gifts.ts`, `api/register-gift.ts`, or either function's BODY.
⚠️ **Do not put a commented-out placeholder in the file. An applied migration is immutable.**

## 5. THE FOUR COMMENT EDITS — item 6

⚠️ **THE BUNDLE SAYS FIVE. IT IS FOUR.** `src/components/ops/documents/MergedBodyView.tsx` was
**already fixed** by commit `d78d3b3c` — lines 35-36 now read *"(It also used to serve the kiosk
confirmation, Release.tsx — that page was retired by TASK-SIGNFLOW-D and no longer exists.)"*, which is
correct, though not the wording `TASK-SIGNFLOW-D-REPORT.md` §2.4 proposed. **Verify with
`git log -L35,36:src/components/ops/documents/MergedBodyView.tsx` and DO NOT edit that file.**

🔒 **You change these lines and nothing else in these files** (bundle ownership). **They are prose:
`typecheck`, `typecheck:api` and `lint` must land exactly at baseline.** Line numbers move — match on
the text, not the number.

**1 · `src/lib/contact.ts:184`** — replacement text verbatim from `TASK-SIGNFLOW-D-REPORT.md` §2.4.
```
FROM:  *  flow (DocsParticipantFlow / Onboarding, via sign-release.ts) and read back
TO:    *  flow (Onboarding) and read back
```

**2 · `api/deliver-document.ts:8-13`** — D's report names the file and the stale citation but supplies
no full sentence, so the replacement is written here from what the code does today. The whole paragraph
is stale: the kiosk flow is retired and `api/sign-release.ts` was deleted by `TASK-SIGNFLOW-D`.
```
FROM:
 * The kiosk release flow no longer calls this endpoint: it has no session to
 * attach (public/anonymous by design), so its delivery now happens
 * server-side, in-process, from api/sign-release.ts via the same
 * deliverExecutedDocument() this handler calls — never over HTTP, never
 * unauthenticated. This endpoint is reserved for the staff-gated resend UI.
TO:
 * There is no anonymous delivery path any more: the kiosk release flow and
 * api/sign-release.ts were both removed by TASK-SIGNFLOW-D (2026-09-01), and
 * signing now happens through /sign/* with an account. This endpoint is the
 * staff-gated resend UI's only door; scheduled delivery runs server-side from
 * api/deliver-documents.ts and api/delivery-sweep.ts.
```

**3 · `src/pages/app/Onboarding.tsx:97-111`** — the block comment's STAFF-PROVISIONED paragraph. No
replacement text was supplied by anyone; it is written here from the code.
**The fact (RECONCILED 1.13, re-proved 2026-09-03): `'payment'` appears only in the `Step` union
(`:111`) and one render branch (`:2230`). There is no `setStep('payment')` anywhere in the file, and
`payment` is not in `wizardSteps()` (`:318-350`), so `backTarget` cannot walk to it either.** The same
file already says so correctly at `:335-340` — *"⚠️ THERE IS NO PAYMENT STEP ANY MORE, ON EITHER DOOR"* —
so this comment contradicts its own file 220 lines later.
```
FROM:
     STAFF-PROVISIONED (an order already exists at mount) — this page's original
     job, unchanged: order → details → horse → sign → PAYMENT → slots → done.
     They were sold something offline and are here to sign and pay for it.
TO:
     STAFF-PROVISIONED (an order already exists at mount) — they were sold
     something offline and are here to sign for it:
     order → details → horse → sign → review → slots → submit → done.
     ⚠️ NO PAYMENT STEP ON THIS DOOR EITHER, since CR-98 — see `wizardSteps`
     below, which is the machine this paragraph describes.
```

**4 · `src/pages/app/Onboarding.tsx:615-625`** — the `holdMyDocumentDelivery` effect's comment.
```
FROM:
     ⚠️ Self-serve only: the provisioned door still ends at payment and has
     nothing to add to the email, so its delivery is left exactly as it is.
TO:
     ⚠️ Self-serve only: the provisioned door has no shop, time or submit step
     to wait for, so it has nothing to add to the email and its delivery is
     left exactly as it is. (It does not end at payment — nothing routes to
     that step on either door; see `wizardSteps`.)
```

## 6. 🔒 THE TEST THIS MUST PASS — proof, not description

⚠️ **Paste output. `TASK-ROLE.md` §2a: prove the ACL, never the absence of an error.**

1. **BEFORE.** The full `proacl` row for every function you are about to touch, pasted from your own
   run, timestamped. One query, one table:
   ```sql
   select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn,
          array_to_string(p.proacl, ',') as proacl_before
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (<every name in the migration>) order by 1;
   ```
2. **THE REHEARSAL.** `BEGIN; \i <the migration>; <the AFTER queries>; ROLLBACK;` — paste the statement
   tags and the in-transaction AFTER table. ⚠️ **No self-contained `COMMIT;` in the file.**
3. **APPLY**, then re-run every check below **against production**.
4. **`anon` is gone from every revoked function:**
   ```sql
   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname in (<every revoked name>)
     and has_function_privilege('anon', p.oid, 'execute');   -- must be 0
   ```
5. **`anon` still holds EXECUTE on the ONE KEEP** — `has_function_privilege('anon', …)` = **t** for
   `submit_public_request`. ⚠️ **A revoke that catches it is the failure this criterion exists to catch.**
   And = **f** for `open_gift` and `redeem_gift` — they are in group W by the CR-116 ruling.
6. **`authenticated` is gone from the two group-S functions and `service_role` is not:**
   both `has_function_privilege('authenticated', …)` = **f** and
   `has_function_privilege('service_role', …)` = **t**.
7. 🔒 **NO BODY CHANGED.** `md5(pg_get_functiondef(p.oid))` for every touched function, before and
   after, **identical**. Paste both columns.
   ```sql
   select p.proname, md5(pg_get_functiondef(p.oid)) from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
     and p.proname in (<every name in the migration>) order by 1;
   ```
8. **The population moved by exactly what you revoked:** re-run §2's population query. `anon_exec`
   must fall from **326** to **326 − (the number of functions in your migration that were
   anon-executable)**, and you state that arithmetic explicitly.
9. **D35 — re-run 4, 5, 6 and 8 immediately before you write the report**, not once at apply time.
   Another thread's migration can land between the two.
10. **The comment edits:** `git diff --stat` shows exactly 3 files (`src/lib/contact.ts`,
    `api/deliver-document.ts`, `src/pages/app/Onboarding.tsx`) plus the one migration, **and
    `MergedBodyView.tsx` is not among them**.
11. **Gates at baseline:** `npm run typecheck` · `npm run typecheck:api` · `npm run lint` · `npm run build`.
    The comments are prose — **any drift is somebody else's and you say whose.**
    ⚠️ `test:db` is red at baseline and proves nothing (`TASK-ROLE.md` §3).

## 7. THE REACH — there isn't one, and that is the correct answer

🔒 **This is not a feature. Nothing new appears on any screen; nobody clicks anything; no value is
captured, so `TASK-ROLE.md` §2c's three questions have no reader to name.** **The whole outcome is
that a door which was open is shut.**
**What a person could notice is a REGRESSION, and there are exactly two places to look:**
1. **the public contact form** — `/contact`, `/visit`, `/gift`, `/lessons` intake, logged out;
2. **`/redeem?code=…`** — a gift reveal opened by someone with no account.
**Both are `WALKR`'s job (`FHE-TASK-GRANTS-W`), walked as an anonymous visitor. You do not walk them
and you do not simulate a login** (`TASK-ROLE.md` §3).

## 8. WHAT IS NOT YOURS
- **Any function body. Any RLS policy. Any `DROP`.** A missing in-body guard is a finding, routed up.
- **The 135 anon-executable READERS.** Out of this bundle. `FHE-TASK-GRANTS-A`'s handoff carries the
  count so ORCH can bundle a read sweep; do not start one.
- **The 60 anon-executable `SECURITY INVOKER` non-trigger functions and the other 15 invoker trigger
  functions.** Outside the bundle's ownership declaration. Only `trg_seed_display_name` is in, by name.
- **`request_category_label`** — invoker, immutable, writes nothing, no call site. Leave it alone;
  the escalation list §E explains why the bundle was wrong about it.
- **Item 7** (CHANGE-ORDER-LEDGER status headers) — `FHE-MGMT-GRANTS` does that last, with ORCH.
- ⚠️ **Probing whether `anon` can actually execute a writer by CALLING it. Probing a writer writes
  production.** `has_function_privilege` is the probe, and it is the only one.

## 9. WHERE THE REPORT GOES
**`docs/reports/TASK-GRANTS-B-REPORT.md`**, in `TASK-ROLE.md` §6's shape. **Hand back to
`FHE-MGMT-GRANTS`**, which dispatches `FHE-TASK-GRANTS-V` (VRFY) to re-run the `proacl` proof itself.
**No owner render checklist — nothing renders.** ⚠️ **The bundle report owes ORCH the full before/after
`proacl` table; write it so MGMT can lift it whole.**

## MODEL AND EFFORT (for MGMT's dispatch line — you do not set these)
**Sonnet · MEDIUM · thinking ON.** The judgement is spent; this is a generated migration, four prose
edits, and a proof that must be pasted rather than described.
