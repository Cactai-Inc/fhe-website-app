# TASK NOGUARD1 — report: which anon-reachable functions enforce their access rules

Branch `task/noguard1`, worktree at `~/Downloads/claude-code-repo/wt-noguard1`, off `origin/main`
@ `ab3d490`. Measured against production (`lrstswfxfsezdmvkvukc`) on 2026-08-07.

**Read-only, as specified. No migration, no function change, no grant change, no data written.**
Every query ran inside `BEGIN … ROLLBACK`.

---

## Headline

**76 of 285** anon-reachable `SECURITY DEFINER` functions do not enforce an access rule.
**38 of those modify data.**

The starting estimate of 84 was close in total but wrong in composition, in both directions —
as the task predicted. The more useful result is *why* the safe ones are safe: **seven different
mechanisms** do the enforcing, and only one of them is an identity check written where you would
look for it. A third of the safe surface is safe for a reason no grep for `IF NOT … THEN RAISE`
would find — and four functions are safe only because of a `NOT NULL` column constraint.

The single worst finding is `void_signatures_on_edit(uuid)` — it takes a document id, soft-deletes
**every signature on it**, and resets the document's status. It has no identity check of any
kind, no caller anywhere in `src/`, `api/`, `pg_proc` or any trigger, and `anon` holds EXECUTE.

---

## Counts

| | count |
|---|---|
| `SECURITY DEFINER` functions in `public` | 441 |
| …executable by `anon` | **319** |
| …of those, trigger functions (`RETURNS trigger`) | 34 |
| **…directly callable by `anon`** | **285** |
| — **ENFORCES** | **199** |
| — **DOES NOT ENFORCE** | **76** (38 write, 38 read) |
| — **INTENTIONALLY PUBLIC** | **10** |

Of the 76: **73 have no check at all**; **3 have a check that does not take effect**.

The orchestrator's figures were 320 / 111 / 27 / 84 / 28. My 319 and 34 differ because I
counted `prokind='f'` with `has_function_privilege` rather than a text scan. The 84→76 movement
is the interesting part and is broken down in *Where the keyword scan was wrong* below.

### Trigger functions — confirmed not directly callable

Not taken on trust. PostgreSQL refuses before any body runs, identically for both roles:

```
postgres=> SELECT public.profiles_role_guard();
ERROR:  trigger functions can only be called as triggers

anon=>     SELECT public.profiles_role_guard();
ERROR:  trigger functions can only be called as triggers
```

Set aside as low priority, as instructed. They are not zero risk — they run with definer rights
on every write to their table — but they are not an anon-reachable entry point.

---

## Method

Four passes, each one added because the previous one was provably wrong.

**1. Population.** `prosecdef AND has_function_privilege('anon', oid, 'EXECUTE')` in `public`,
excluding `RETURNS trigger`. 285 functions, bodies dumped from `pg_proc.prosrc`.

**2. Faithful anon simulation.** `SET LOCAL ROLE anon` alone is **not** an anon request — it
leaves `auth.role()` NULL, whereas a real PostgREST anon call carries a role claim. I set the
GUC PostgREST sets:

```sql
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
```

All zero-argument identity predicates, live in prod:

```
 uid | role | app_role | staff | admin | org_admin | super | member | org | contact | client
-----+------+----------+-------+-------+-----------+-------+--------+-----+---------+--------
     | anon |          | f     | f     | f         | f     | f      |     |         |
```

`has_staff_access`/`is_admin`/`is_org_admin`/`is_super_admin`/`is_active_member` all return
**false**, not NULL — NULLUID's `coalesce(…, false)` repair is live and holding. That is what
makes most of the `IF NOT has_staff_access()` family safe today.

**Argument-taking predicates, which NULLUID explicitly left unevaluated**, tested with real ids
(never Sarah's document):

```
 is_party | party_or_staff | owns_doc | can_void | may_propose | owns_horse | may_use_horse | can_list_horse | is_platform | has_module
----------+----------------+----------+----------+-------------+------------+---------------+----------------+-------------+------------
 f        | f              | f        | f        | f           | f          | f             | f              | t           | f
```

All false. `is_platform_profile` returns **true**, but it is not an identity predicate at all —
it is `SELECT p_role = 'SUPER_ADMIN' OR p_org IS NULL`, IMMUTABLE, a pure classifier of its
arguments. It returned true because I passed `'SUPER_ADMIN'` in. In its two real uses (the
`profiles` RLS policies) the arguments come from the row, not the caller. **Not a hole** — and
exactly the "false unguarded" the task warned about.

**3. Guard extraction and shape evaluation.** Rather than judge guards by eye, I extracted every
`IF <cond> THEN <deny>` block whose condition mentions an identity value, normalised local
variables and parameters to placeholders, which collapsed 115 guards into **50 distinct shapes**,
then evaluated each shape as `anon` with **attacker-chosen, non-NULL** row values — the worst
case, where the attacker picks a real document/gift/org. `fires = t` means the deny runs.

```
 shape                                                                         | uses | fires
-------------------------------------------------------------------------------+------+-------
 auth.uid() IS NULL                                                            |   53 | t
 NOT has_staff_access()                                                        |   30 | t
 NOT ((has_staff_access() AND ROW=current_org()) OR caller_is_document_party()) |   11 | t
 NOT is_admin()                                                                |    6 | t
 NOT (has_staff_access() AND ROW = current_org())                              |    6 | t
 NOT caller_is_document_party_or_staff(ARG)                                    |    3 | t
 NOT (staff AND ROW=org) AND NOT EXISTS(… = current_contact_id())              |    3 | t
 >>> NOT (has_staff_access() OR ROW.buyer_user_id = auth.uid())                |    3 | NULL
 NOT (has_staff_access() OR EXISTS(… = current_contact_id()))                  |    2 | t
 >>> ROW.author <> auth.uid() AND NOT is_admin()                               |    2 | NULL
 NOT coalesce(staff OR ROW=auth.uid() OR ROW=current_contact_id(), false)      |    2 | t
 … 11 further shapes, all t
```

Two shapes evaluate to **NULL** — present, and skipped.

**4. Read every body that pass 3 did not clear.** 107 functions, read in full. This is where the
real answer came from; passes 1–3 are triage. Five separate classes of automated error surfaced
and were corrected, each documented below.

### Why `EXISTS` and `WHERE` save so many of these

The two NULL shapes fail open. The near-identical
`NOT (has_staff_access() OR EXISTS (SELECT 1 … WHERE contact_id = current_contact_id()))` does
not, because **`EXISTS` is never NULL** — the subquery matches nothing and returns `false`.
`false OR false` is `false`, `NOT false` is `true`, the deny fires.

Same for predicates in *filter* position. `admin_client_messages` is guarded only by
`WHERE is_admin() AND …` inside its SQL body. That is fail-**closed**: no rows. The identical
predicate in `IF NOT is_admin() THEN RAISE` would be fail-open if `is_admin()` ever returned NULL.

**Seven mechanisms enforce, and only the first looks like a guard:**

| mechanism | of the 199 that enforce | fails |
|---|---|---|
| explicit deny — `IF … THEN RAISE`/`RETURN` | 126 | **open** on NULL |
| filter position — `WHERE`/`EXISTS`/`CASE` over an identity value | 53 | closed |
| the identity predicates themselves (`is_admin`, `has_staff_access`, …) | 4 | closed — they `coalesce(…, false)` |
| guard by delegation — a wrapper over a guarded function | 3 | inherits the callee |
| schema constraint — `NOT NULL` on the identity column inserted | 4 | closed, **incidentally** |
| not invocable — `rls_auto_enable` returns `event_trigger` | 1 | n/a |
| other filter/`CASE` forms, confirmed by reading | 8 | closed |

The `NOT NULL` row is the fragile one. `dm_hide_conversation` does
`INSERT INTO dm_hidden_conversations (user_id, …) VALUES (auth.uid(), …)`. For anon that is an
insert of NULL, which fails **only** because the column is `NOT NULL`:

```
 table                   | column  | is_nullable
-------------------------+---------+-------------
 content_acknowledgments | user_id | NO
 dm_hidden_conversations | user_id | NO
 feed_seen               | user_id | NO
 feed_view_pref          | user_id | NO
```

Four functions are protected by a column constraint rather than by any access rule. A future
migration relaxing one of those silently opens a write path. Flagged, not fixed — read-only task.

---

## Reachability: `anon` really can call these

Grants alone would be the wrong evidence, so I confirmed the request reaches argument parsing
over the real PostgREST endpoint, with the project's public `anon` key. **No function body was
entered and nothing was written**: a deliberately type-invalid uuid makes the cast fail *before*
the call.

```
POST /rest/v1/rpc/void_signatures_on_edit   {"p_document_id":"NOT-A-UUID-noguard1"}
  → 400 {"code":"22P02","message":"invalid input syntax for type uuid: \"NOT-A-UUID-noguard1\""}
POST /rest/v1/rpc/gift_claim_link           → 400 22P02   (same)
POST /rest/v1/rpc/recompose_document_fields → 400 22P02   (same)
POST /rest/v1/rpc/complete_deal             → 400 22P02   (same)

-- controls: the functions NULLUID revoked
POST /rest/v1/rpc/platform_tenant_detail    → 401 {"code":"42501","message":"permission denied for function platform_tenant_detail"}
POST /rest/v1/rpc/set_org_module            → 401 {"code":"42501","message":"permission denied for function set_org_module"}
```

`22P02` versus `42501` is the discriminator: the first four resolved the signature and began
parsing arguments; the two revoked controls were refused at the grant. These functions are live,
anon-reachable HTTP endpoints.

### Grants — raw, for the findings

Every one carries **both** trap grants simultaneously — the PUBLIC `=X/postgres` *and* the
role-held `anon=X/postgres`. NULLUID found this on all 8 functions it touched; it is the norm
across the whole surface, not a local accident. **Either revoke alone is a silent no-op.**

```
          proname            | anon | authed | svc |                          acl
-----------------------------+------+--------+-----+--------------------------------------------------------
 affiliation_reconciliation  | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 complete_deal               | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 confirm_booking_for_purchase| t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 contract_notes_for_document | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 contract_notify             | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 document_signature_state    | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 gift_claim_link             | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 recompose_document_fields   | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 set_unit_status             | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 void_signatures_on_edit     | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
 redeem_gift                 | t    | t      | t   | =X/postgres | postgres=X/postgres | anon=X/postgres | …
```

`redeem_gift` is included to show it is untouched and intentionally so.

---

## Where the keyword scan was wrong

Both directions, as predicted, plus three failure modes the task did not anticipate.

**Falsely "guarded" — mentions an identity value but does not authorise with it.**
The `record_invitation_failure` shape. Found: **99 functions** mention an identity value with no
deny path at all. Most turned out safe (they *scope* with it — see above), but this is the class
the orchestrator's scan would have cleared wholesale. `contract_notify` and `redline_notify` both
reference `auth.uid()` — `redline_notify` only in `pr.user_id <> auth.uid()`, to avoid notifying
yourself. That is a *recipient filter*, not a guard, and the scan cannot tell the difference.

**Falsely "unguarded" — safe by construction.** `is_platform_profile` (a pure argument
classifier, above). `admin_client_*` (guarded in `WHERE`, not in `IF`). `owns_order`
(`EXISTS(… WHERE user_id = auth.uid() OR is_admin())` → `false`). `rename_contract_note`
(guard inside the `UPDATE … WHERE`, then `IF NOT FOUND THEN RAISE`).

**Guard by delegation.** `reopen_change_request` and `resolve_change_request_thread` are
one-line wrappers over `agree_change_request`, which is properly guarded. They enforce, and no
body-level scan of *their* text can see it.

**Precondition written as a bare `RETURN;`.** My own first-pass regex required
`RETURN null|false|…` and so mis-flagged `record_lookup_suggestion`, whose real precondition is
`IF auth.uid() IS NULL THEN RETURN; END IF;`. Corrected.

**A write that is invisible to a DML scan.** `assert_horse_care_eligible` looks like an assertion
and reads like a reader — it contains no `INSERT`. It calls `generate_document` twice.
Adding transitive write detection through the call graph reclassified **17 functions** from read
to write, including `contract_lock_blockers`, `notify_purchase_unpaid` and `publish_open_slots_all`.
A scan for `INSERT|UPDATE|DELETE` in the body text misses every one of them.

---

## The classified list

Ranked by consequence: `documents`, `signatures`, `contacts`, `profiles`, `purchases`, `members`
above log tables, as instructed. "Callers" is from `src/`, `api/` and `pg_proc.prosrc`; **none**
means nothing in the repo or the database references it.

### Does not enforce — modifies data (38)

| # | function | what it does | consequence | callers |
|---|---|---|---|---|
| 1 | `recompose_document_fields(p_document_id uuid)` | Rewrites contract_fields.value (the composed contract prose) for the given document. | Rewrites the text of any contract. No signature-lock check. | db: `remerge_contract_from_clauses`, `remerge_contract_from_fields`, `set_field_structured` |
| 2 | `remove_document_co_buyer(p_document_id uuid)` | Deletes BUYER document_parties/contract_parties rows and NULLs COBUYER.* values. | Removes a party from any sale document. | db: `set_contract_field` |
| 3 | `sync_contract_fields_from_defs(p_document_id uuid)` | Inserts, updates and DELETEs contract_fields rows for the given document. | Adds, rewrites and removes clauses/fields on any contract. | db: `capture_horse_record_info` |
| 4 | `void_signatures_on_edit(p_document_id uuid)` | Soft-deletes every signature on the given document and rewrites documents.status. | Any executed contract can be stripped of its signatures by an unauthenticated caller. | **none — dead code** |
| 5 | `apply_field_formats(p_document_id uuid)` | Rewrites label, format_type, input_kind and options on the given document's fields. | Alters how any contract renders and what it accepts. | **none — dead code** |
| 6 | `bos_generate_document(p_contract_id uuid, p_anchor_contact_id uuid)` | Creates a HORSE_BILL_OF_SALE document with caller-supplied parties JSON. | Creates a bill of sale against any contract. | db: `start_bill_of_sale`, `start_bill_of_sale_standalone` |
| 7 | `complete_deal(p_deal_id uuid)` | Sets deals.status=complete and contracts.status=executed. | Marks a deal and its contract executed. Gated on business state, not identity. | `src/lib/deals.ts` |
| 8 | `fill_party_fields_from_contacts(p_document_id uuid)` | Copies contact name/email/phone/address into contract_fields for the given document. | Writes party PII into any contract. | `src/lib/contracts.ts`; db: `add_deal_document`, `reassign_document_party`, `set_document_co_buyer`… |
| 9 | `gift_claim_link(p_gift_id uuid)` ⚠️*check present, no effect* | Returns /redeem?code=<gift code> for any gift id. | Leaks the redemption code, which is the credential for open_gift and redeem_gift. | `src/lib/gifts.ts` |
| 10 | `gift_mark_sent(p_gift_id uuid)` ⚠️*check present, no effect* | Sets gifts.last_sent_at and increments send_count. | Corrupts gift send state. | `src/lib/gifts.ts` |
| 11 | `gift_reschedule(p_gift_id uuid, p_deliver_on date)` ⚠️*check present, no effect* | Sets gifts.deliver_on. | Reschedules someone else's gift delivery. | `src/lib/gifts.ts` |
| 12 | `regroup_contract_subjects(p_document_id uuid)` | Rewrites section and sort_order on the given document's fields. | Reorders/relabels any contract. | **none — dead code** |
| 13 | `seed_cascade_fields(p_document_id uuid)` | Inserts contract_fields rows from the template defs for the given document. | Injects fields into any contract. | **none — dead code** |
| 14 | `send_executed_document_email(p_document_id uuid)` | net.http_post to /api/deliver-documents, then stamps executed_email_sent_at. | Triggers outbound delivery of an executed document; one-shot per document. | db: `documents_send_executed_email`, `resend_executed_document_email` |
| 15 | `apply_affiliations(p_contact_id uuid)` | Inserts/deletes groups rows for a contact. | Rewrites a contact's affiliations (bounded to the derived set). | db: `promote_contact_to_account`, `trg_apply_affiliations_on_doc`, `trg_apply_affiliations_on_horse` |
| 16 | `apply_category_documents(p_contact_id uuid, p_categories text[])` | Deletes and re-inserts contact_required_documents for a contact. | Rewrites which documents a person is required to sign. | db: `_ensure_client_account`, `promote_buyer_from_offering`, `provision_client_invitation` |
| 17 | `confirm_booking_for_purchase(p_purchase_id uuid)` | Sets bookings.status=confirmed for a purchase. | Confirms a booking without payment — bypasses the Stripe webhook path. | `api/_lib/reconcile.ts`, `api/stripe-webhook.ts` |
| 18 | `consume_unit_for_booking(p_booking_id uuid)` | Links a fulfillment unit to a booking and marks it scheduled. | Consumes a paid entitlement. | db: `trg_booking_unit_link` |
| 19 | `ensure_contact_for_profile(p_user_id uuid)` | Creates a contacts row and calls promote_contact_to_account. | Creates identity records. Three privileged user_ids are denylisted. | db: `generate_my_onboarding_documents`, `my_onboarding_state`, `profiles_link_contact`… |
| 20 | `ensure_staff_profile(p_user_id uuid, p_title text)` | Sets profiles.staff_active=true and title. | Reactivates a deactivated staff account. Cannot escalate a non-staff role. | db: `profiles_sync_staff_profile` |
| 21 | `generate_fulfillment_units(p_purchase_item_id uuid)` | Inserts fulfillment_units for a purchase item. | Mints entitlement units. | db: `trg_generate_fulfillment_units` |
| 22 | `insurance_resolution_sync(p_document_id uuid)` | Inserts notifications; swallows every exception into a WARNING. | Notification injection; failures are invisible. | db: `set_contract_field` |
| 23 | `log_status_event(p_entity_type text, p_entity_id uuid, p_stat)` | Inserts status_events and flips current_status on documents/purchases/bookings/invitations. | Rewrites the status shown across the app. Vocab-validated only. | db: `apply_document_supersession`, `require_resign_from`, `set_unit_status`… |
| 24 | `set_unit_status(p_unit_id uuid, p_status text, p_detail text)` | Sets fulfillment_units.current_status and consumed_at. | Marks paid entitlements consumed; destroys purchased sessions. | db: `consume_unit_for_booking`, `trg_booking_unit_link`, `trg_evaluation_unit_link` |
| 25 | `supersede_invitations(p_org uuid, p_email text, p_new_invitation_i)` | Sets invitations.status=superseded for an org+email. | Cancels pending invitations; denial of onboarding. | `api/admin-send-invitation.ts` |
| 26 | `_publish_open_slots_for_org(p_org uuid, p_weeks integer, p_slot_minutes )` | Inserts availability bookings for an org. | Floods the calendar. | db: `publish_open_slots`, `publish_open_slots_all` |
| 27 | `_resolve_location(p_org uuid, p_owner uuid, p_loc jsonb)` | Inserts/updates locations rows. | Creates location records. | db: `set_horse_locations` |
| 28 | `assert_horse_care_eligible(p_contact_id uuid, p_horse_id uuid)` | Despite the name, calls generate_document twice as a side effect. | Creates release documents for any contact/horse pair. | db: `attach_booking_horse`, `book_open_slot` |
| 29 | `contract_notify(p_document_id uuid, p_to_contact uuid, p_kin)` | Inserts a notification with caller-supplied kind/title/body to any contact's user. | Arbitrary attacker-authored text in an authenticated user's notification feed. | db: `request_document_change`, `resolve_change_request`, `share_document`… |
| 30 | `lease_expiry_nudge(p_days_ahead integer)` | Delegates to lease_reminder_sweep(), which has no guard; sends lease start/expiry notifications. | Fires the whole lease-reminder sweep on demand; notification injection to every lessee. | `api/notifications-nudge.ts` |
| 31 | `log_evaluation_report_access(p_report_id uuid, p_action text, p_detail te)` | Inserts evaluation_report_access rows. | Pollutes an access audit trail. | `api/deliver-evaluation-report.ts`, `src/lib/acquisition.ts` |
| 32 | `log_mirror_delivery(p_document_id uuid, p_channel text, p_copy_u)` | Inserts a document_deliveries row with a caller-supplied copy_url. | Fabricates delivery evidence. | `api/deliver-documents.ts` |
| 33 | `log_receipt_send(p_purchase_id uuid, p_key text, p_recipient )` | Inserts receipt_sends ON CONFLICT (idempotency_key) DO NOTHING. | Burning an idempotency key can suppress a real receipt. | `api/_lib/receipt.ts` |
| 34 | `notify_purchase_unpaid(p_purchase_id uuid)` | Sends notify_user + notify_staff for a purchase. | Notification injection tied to a real purchase. | db: `_provision_purchase_for_offerings` |
| 35 | `publish_open_slots_all(p_weeks integer, p_slot_minutes integer)` | Same, for every org with business hours. | Floods every tenant's calendar. | `api/calendar-reminders.ts` |
| 36 | `redline_notify(p_document_id uuid, p_kind text, p_prefix te)` | Inserts notifications to every party of a document with a caller-supplied prefix. | Notification spam with attacker-controlled text. | db: `propose_clause`, `propose_field_edit` |
| 37 | `resolve_notifications_for_link(p_link text, p_actor uuid, p_kind text)` | DELETEs notifications matching a link, writing audit_logs with a caller-supplied actor. | Deletes notifications and forges the audit actor. | db: `approve_contract_termination`, `decline_contract_termination`, `insurance_resolution_sync`… |
| 38 | `reap_expired_holds()` | Lapses request_selections whose hold has already expired. | Only affects already-expired holds. | `api/expire-holds.ts` |

### Does not enforce — reads (38)

| # | function | what it does | consequence | callers |
|---|---|---|---|---|
| 1 | `affiliation_reconciliation()` | Every contact: id, display_code, full name, whether they have an account, group memberships. | Full customer roster dump, unauthenticated. | **none — dead code** |
| 2 | `contract_lock_blockers(p_document_id uuid)` | Required-field labels, party names, party-type contradictions, insurance state for any document. | Detailed contract internals and party names. | db: `advance_document_workflow`, `approve_contract_review` |
| 3 | `contract_notes_for_document(p_document_id uuid)` | Note titles and every message body on any document. | Private negotiation commentary. | `src/lib/contracts.ts` |
| 4 | `document_signature_state(p_document_id uuid)` | Signer names, emails and signed_at for any document. | Who signed what, and when. | `src/lib/contracts.ts` |
| 5 | `assert_not_signature_locked(p_document_id uuid)` | Raises an exception naming every signer of the document. | Leaks signer names through the error message. | db: `remove_document_co_buyer`, `set_contract_field`, `set_document_co_buyer`… |
| 6 | `document_changes_since_signature(p_document_id uuid, p_contact_id uuid)` | Change log with old_value/new_value for any document. | Full edit history of a contract. | `src/lib/contracts.ts` |
| 7 | `party_user_ids(p_document_id uuid, p_party_role text)` | auth user ids of the parties on any document in a given role. | Links documents to user accounts. | db: `send_contract_to_party` |
| 8 | `undelivered_executed_documents(p_limit integer, p_grace_minutes integer)` | Ids and titles of executed documents pending delivery, org-wide. | Enumerates executed documents. | db: `sweep_undelivered_executed_documents` |
| 9 | `wall_onboarding_invariant_violations()` | Every contact's name plus onboarding gating counts. | Second roster dump by another route. | **none — dead code** |
| 10 | `contact_document_satisfied(p_contact_id uuid, p_template_key text)` | Whether a contact has an executed copy of a template. | Per-person document oracle. | db: `contact_document_wall_state`, `generate_my_onboarding_documents`, `my_onboarding_state`… |
| 11 | `contact_document_wall_state(p_contact_id uuid)` | Pending/gating counts and document titles for a contact. | Per-person onboarding state. | db: `contract_lock_blockers`, `my_wall_state`, `wall_onboarding_invariant_violations` |
| 12 | `deal_completion_state(p_deal_id uuid)` | Outstanding requirements, party-role gaps, completion eligibility. | Deal internals. | `src/lib/deals.ts`; db: `complete_deal`, `deal_autocomplete_on_execution`, `reopen_deal` |
| 13 | `deal_document_status(p_deal_id uuid)` | Which documents a deal has and which are executed. | Deal document inventory. | `src/lib/deals.ts` |
| 14 | `deal_status(p_deal_id uuid)` | Deal state plus signed/required signature counts. | Deal progress for any deal id. | db: `deal_completion_state`, `deal_detail`, `deal_record_export`… |
| 15 | `derive_affiliations(p_contact_id uuid)` | The affiliations a contact would be granted, derived from their executed documents. | Reveals which releases a person has signed. | db: `affiliation_reconciliation`, `apply_affiliations` |
| 16 | `document_horse_ids(p_document_id uuid)` | The horses bound to any document. | Links documents to horses. | db: `generate_document` |
| 17 | `horse_medication_component(p_horse_id uuid, p_component text)` | The same data, per component. | Animal medical data. | db: `generate_document` |
| 18 | `horse_medications_prose(p_horse_id uuid, p_kind text)` | Medication names, dosages, instructions and costs for any horse. | Animal medical data. | db: `generate_document`, `horse_field_token_value` |
| 19 | `member_horses(p_user_id uuid)` | Horse names and home locations for any user id. | Links members to horses and places. | `src/lib/community.ts` |
| 20 | `owner_has_executed_template(p_owner uuid, p_template_key text)` | Whether an owner has an executed copy of a template with a horse bound. | Per-person document oracle. | db: `ensure_horse_documents` |
| 21 | `required_templates_for_contact(p_contact_id uuid)` | The template keys a contact is required to sign. | Per-person document requirements. | `src/lib/admin.ts`; db: `admin_client_documents`, `contact_checklist`, `generate_my_onboarding_documents`… |
| 22 | `admin_client_documents(p_user_id uuid)` | Guarded by `WHERE is_admin()` — but the requirements branch is a UNION arm. | Verified: both arms carry the guard; listed for completeness. | `src/pages/app/Admin.tsx` |
| 23 | `document_changes_frozen(p_document_id uuid, p_author_contact_id uuid)` | Whether a document is EXECUTED. | Document status oracle. | `src/pages/app/ContractPage.tsx`; db: `pending_notify_summary`, `set_contract_field`, `set_field_structured` |
| 24 | `expand_horse_blocks(p_body text, p_horse_ids uuid[])` | Expands {{HORSE.*}} tokens against supplied horse ids. | Renders horse detail into caller-supplied text. | db: `generate_document` |
| 25 | `horse_field_token_value(v_horse horses, p_field text)` | Renders a horse field, resolving breed/colour/location lookups. | Takes a horses row as its argument. | db: `add_deal_document`, `attach_horse_to_document`, `expand_horse_blocks`… |
| 26 | `location_full_label(p_location_id uuid)` | Composed name and street address of any location. | Address lookup. | db: `generate_document` |
| 27 | `member_display_name(p_user_id uuid)` | First/display name for any user id. | Name lookup by user id. | db: `members_post_join_event`, `say_hi`, `say_hi_back` |
| 28 | `booking_notifies_client(p_booking bookings)` | Whether a booking notifies the client. | Takes a bookings row as its argument. | db: `decide_booking_change` |
| 29 | `booking_service_type(p_booking bookings)` | The service type of a booking. | Takes a bookings row as its argument. | db: `booking_report` |
| 30 | `caller_may_use_horse(p_contact uuid, p_horse uuid)` | Whether a given contact may use a given horse. | Takes the contact as an argument, so it answers about anyone. | db: `attach_booking_horse`, `book_open_slot` |
| 31 | `change_request_is_frozen(p_request_id uuid)` | Whether a change request is frozen. | Change-request oracle. | db: `edit_change_request_entry`, `edit_contract_comment`, `pending_notify_summary`… |
| 32 | `claim_receipt_send(p_purchase_id uuid, p_key text)` | Whether a receipt may still be sent for a purchase. | Receipt-state oracle. | `api/_lib/receipt.ts` |
| 33 | `config_required_missing(p_org uuid)` | Which required config keys an org has not set. | Tenant configuration gaps. | `src/lib/api.ts` |
| 34 | `horse_time_conflict(p_org uuid, p_horse uuid, p_start timestamp )` | Whether a horse is booked in a window. | Schedule oracle. | db: `request_open_time`, `save_calendar_item` |
| 35 | `intake_requirements(p_channel text)` | Intake field requirements for a channel. | Scoped by current_org(); returns nothing for anon in practice. | `src/lib/ops/api-intake.ts`, `src/lib/ops/api-public.ts`; db: `set_intake_requirement` |
| 36 | `invitation_expiry_days(p_org uuid)` | An org's invitation expiry setting. | Configuration value. | `api/admin-send-invitation.ts`; db: `provision_client_invitation` |
| 37 | `next_custom_field_key(p_document_id uuid, p_label text)` | Next free CUSTOM.* field key on a document. | Field-count oracle. | db: `add_contract_composition`, `add_contract_element` |
| 38 | `reschedule_fee(p_org uuid, p_start timestamp with time zone)` | An org's reschedule fee. | Configuration value. | `src/lib/ops/api-calendar.ts`; db: `request_booking_change` |

### Intentionally public (10)

| function | why |
|---|---|
| `general_release_preview` | thin wrapper over release_preview with the same whitelist |
| `open_gift` | the gift code is the credential; a wrong code returns nothing |
| `org_public_config` | public tenant branding/pricing by slug; deliberately public-safe columns only |
| `public_offerings` | marketing catalog; the unauthenticated site reads it |
| `record_invitation_failure` | reached from the unauthenticated invite flow; the token is the credential (NULLUID) |
| `redeem_gift` | self-enforcing: body opens `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'` |
| `release_preview` | kiosk preview; whitelisted to 7 template keys and truncates the signature block |
| `sole_org` | returns the single tenant id when exactly one exists; used to resolve org for public forms |
| `submit_public_request` | the public contact/checkout form; validates every field it accepts |
| `validate_invitation` | the invitation token is the credential; only status=sent and unexpired |

### Enforces (199)

`acknowledge_content_block`, `add_contact_location`, `add_contract_composition`, `add_contract_element`, `add_deal_document`, `add_deal_member`, `add_my_location`, `admin_client_accounts`, `admin_client_bookings`, `admin_client_items`, `admin_client_messages`, `admin_client_overview`, `admin_form_definitions`, `admin_oversight`, `agree_change_request`, `app_role`, `approve_contract_review`, `approve_contract_termination`, `archive_contract`, `assign_horse_section`, `attach_horse_to_document`, `calendar_money_items`, `caller_is_document_party`, `caller_is_document_party_or_staff`, `caller_may_propose`, `caller_owns_document`, `caller_owns_horse`, `caller_party_roles`, `can_list_horse`, `can_void_document`, `capture_horse_record_info`, `category_document_defaults`, `claim_document_origination`, `client_can_read_horse`, `company_contact_id`, `config_value`, `confirm_my_legal_name`, `consume_notification`, `contact_dossier`, `contact_locations`, `contract_caller_is_originator`, `contract_change_requests_list`, `contract_event_log`, `contract_party_options`, `contract_section_tree`, `create_contract_note`, `create_deal`, `create_evaluation_report`, `current_client_id`, `current_contact_id`, `current_org`, `deal_activity`, `deal_detail`, `deal_record_export`, `decline_contract_termination`, `delete_contract_comment`, `deliver_evaluation_report`, `dm_delete_message`, `dm_edit_message`, `dm_hide_conversation`, `dm_list_conversations`, `dm_mark_conversation_read`, `dm_unread_total`, `document_parties_summary`, `edit_change_request_entry`, `edit_contract_comment`, `ensure_my_member_access`, `entity_status_log`, `feed_get`, `feed_mark_seen`, `feed_moderate`, `feed_my_posts`, `feed_post_create`, `feed_post_delete`, `feed_post_update`, `feed_report_post`, `feed_seed_welcome`, `feed_set_view_shape`, `feed_share`, `get_content_block`, `gift_transfer`, `hard_delete_contract`, `has_module`, `has_staff_access`, `horse_deals`, `horse_medications_list`, `horse_page_detail`, `inbound_open_count`, `is_active_member`, `is_admin`, `is_org_admin`, `is_super_admin`, `lease_edit_guard`, `link_contract_to_purchase`, `list_deals`, `list_service_types`, `mark_change_request_seen`, `mark_comment_review`, `mark_document_opened`, `mark_tour_seen`, `my_acquisition_intake_state`, `my_documents`, `my_fulfillment`, `my_gifts`, `my_lesson_progress`, `my_listable_horses`, `my_locations`, `my_modules`, `my_name_confirmation_state`, `my_onboarding_checklist`, `my_purchase_categories`, `my_stable_add_horse`, `my_stable_delete_horse`, `my_stable_horses`, `my_stable_update_horse`, `my_standing_categories`, `my_view_surfaces`, `my_wall_state`, `notify_review_changes`, `owns_order`, `payer_candidates`, `pending_notify_summary`, `pending_version_decisions`, `post_contract_note_message`, `promote_lookup_suggestion`, `propose_community_event`, `publish_open_slots`, `reassign_document_party`, `record_lookup_suggestion`, `record_signature`, `redeem_invitation`, `redeem_my_pending_invitation`, `remove_contract_composition`, `remove_deal_member`, `remove_my_signature`, `rename_contract_note`, `reopen_change_request`, `reopen_deal`, `reply_to_change_request`, `request_contract_termination`, `request_permission_to_edit`, `require_module`, `require_resign_from`, `resend_executed_document_email`, `resolve_change_request_thread`, `resolve_consumption_billing`, `resolve_version_decision`, `rls_auto_enable`, `save_evaluation_report`, `say_hi`, `say_hi_back`, `send_contract_to_party`, `set_contact_required_documents`, `set_contact_type`, `set_document_co_buyer`, `set_document_party_archived`, `set_document_party_hidden`, `set_field_control_override`, `set_field_included`, `set_field_na`, `set_field_responsibility`, `set_field_structured`, `set_form_required`, `set_horse_locations`, `set_horse_medications`, `set_lesson_progress_note`, `set_my_onboarding_horses`, `set_support_status`, `share_evaluation_report`, `sign_general_release`, `sign_release`, `sign_start_register_attempt`, `staff_assign_documents`, `staff_assign_horse_party`, `staff_assignable_templates`, `staff_contact_directory`, `staff_contact_options`, `staff_end_horse_relationship`, `staff_evaluation_reports`, `staff_horse_records`, `staff_request_horse_record_completion`, `staff_update_horse`, `start_bill_of_sale`, `start_bill_of_sale_standalone`, `start_sale_contract`, `status_feed`, `submit_acquisition_intake`, `submit_change_requests`, `submit_support_request`, `template_past_signers`, `transfer_payment_responsibility`, `update_contact_record`, `update_deal`, `update_horse_record`, `update_purchase_payment_method`, `upsert_change_request`, `upsert_content_block`, `void_deal`, `void_document`.

---

## What NOGUARD2 should fix first

Ordered by consequence, not by convenience.

1. **`void_signatures_on_edit`** — dead code that voids signatures on any document. It has no
   caller anywhere. **Drop it, or revoke and guard.** Nothing depends on it.
2. **The `contract_fields` mutator family** — `recompose_document_fields`,
   `sync_contract_fields_from_defs`, `seed_cascade_fields`, `regroup_contract_subjects`,
   `apply_field_formats`, `fill_party_fields_from_contacts`, `remove_document_co_buyer`. Together
   these can insert, rewrite, reorder and delete the content of any contract. Four of the seven
   have no caller at all. **None of them checks `assert_not_signature_locked` first** — that call
   sits *after* the mutation in `remove_document_co_buyer` and is absent from the rest.
3. **The three `gift_*` functions** — the only "guard present, no effect" cases left. The repair
   is the one already proven on the payment functions:
   `IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN`.
   `gift_transfer` and `update_purchase_payment_method` already carry exactly that shape, so the
   fix is a copy, not a design.
4. **`affiliation_reconciliation` and `wall_onboarding_invariant_violations`** — two unauthenticated
   full-roster dumps. Both are dead code.
5. **Internal helpers that were never meant to be endpoints** — `_publish_open_slots_for_org`,
   `_resolve_location`, `apply_affiliations`, `apply_category_documents`, `generate_fulfillment_units`,
   `consume_unit_for_booking`, `set_unit_status`, `contract_notify`, `redline_notify`,
   `log_status_event`, `resolve_notifications_for_link`, `fill_party_fields_from_contacts`. The
   leading underscore on two of them says the intent plainly. These are called from triggers and
   other functions and **do not need any grant to `anon` or `authenticated`** — a `SECURITY DEFINER`
   caller reaches them regardless of the invoker's rights. This is the cheapest large win in the set.
6. **`confirm_booking_for_purchase`** — reachable from `api/stripe-webhook.ts`, so any change must
   keep the `service_role` path alive. This is the one place in this list where the billing-seam
   warning bites: guard on `auth.role() = 'service_role'`, never on `session_user` alone.

**Prefer fixing at the source.** Most of category 5 needs no guard written at all — just the
absence of a grant. NULLUID's strongest result was `contact_dossier` and `inbound_open_count`
denying anon *without* being revoked; the mirror of that here is that a dozen of these need to be
revoked *without* a guard being written, because they are internal by construction.

**Both trap grants are present on every function I checked** (PUBLIC `=X/postgres` *and*
`anon=X/postgres`). Any revoke must name `anon`, `authenticated` and `PUBLIC` separately, and
`has_function_privilege()` must be re-read afterwards — never the `REVOKE` output.

---

## What this method would still miss

The section the task asked for, and the one I'd read first.

1. **`authenticated` is not modelled at all.** Everything here asks "can an unauthenticated
   stranger do this?". Every one of the 76 is *also* callable by any signed-up account, and the
   199 that "enforce" mostly enforce by distinguishing *nobody* from *somebody* — not by
   distinguishing *this* somebody from *that* one. `set_unit_status`, `complete_deal`,
   `contract_notify`, `bos_generate_document` and the whole `contract_fields` family take an
   arbitrary id and never ask whether the caller has any relationship to it. **Signing up is free.**
   I judge this the larger surface, and it is untouched here. A pass with "one signup away" as
   the attacker is the natural successor to NOGUARD2.

2. **I did not execute the 76.** By instruction — the task said reading the body and evaluating
   the predicate is sufficient, and Sarah's document is live. So "no guard in the body" is a claim
   about the code, not a demonstration. Something outside the body could still stop them: a
   `BEFORE` trigger, a `CHECK`, a foreign key, a `NOT NULL`. I found four cases where exactly that
   happens (the `NOT NULL` group) and I only found them because I went looking. **There are
   probably more, which would make my 76 an over-count.** Conversely a function that *fails*
   halfway leaves partial writes; I cannot tell which without running them.

3. **RLS is not in the picture, and that is load-bearing.** `SECURITY DEFINER` runs as the owner,
   so RLS on the target tables does not apply. That is why these are reachable at all. But I did
   not audit the ~70 RLS policies for their own NULL logic. I did note the structural point that
   RLS fails *closed* on NULL (a NULL qualifier excludes the row) where `IF NOT` fails *open* —
   which is why `profiles_select_own` is safe for anon despite containing the same NULL-prone
   comparisons. I checked that one policy. I did not check the rest.

4. **Dynamic SQL.** `org_public_config` and `rls_auto_enable` build statements with
   `EXECUTE format(...)`. A guard assembled at runtime is invisible to every method I used. Neither
   of those two hides a guard, but I cannot generalise from two.

5. **Reachability is proven, exploitability is inferred.** The `22P02` probe proves the request
   reaches argument parsing. It does not prove the body would complete — several of these depend
   on `current_org()`, which is NULL for anon, and may return early or write NULL and fail. I
   flagged that where I saw it, but the honest statement is: *authorisation does not stop them*,
   not *they all succeed*.

6. **Argument-typed composite functions are under-tested.** `horse_field_token_value(v_horse horses, …)`,
   `booking_notifies_client(p_booking bookings)` and `booking_service_type(p_booking bookings)` take
   whole table rows as arguments. PostgREST can pass a JSON object for a composite type, so they
   are callable, but what they leak depends on what the caller already knows. I ranked them low on
   that reasoning rather than on a test.

7. **Overloads.** I keyed on `proname` in several places. Two functions in `public` sharing a name
   with different signatures would be conflated — one guarded overload could mask an unguarded one.
   I did not check for overloads, and `pg_proc` allows them.

8. **The grant default regenerates this class.** `pg_default_acl` still grants EXECUTE on every
   *new* `public` function to `anon`. NULLUID raised this and it is unchanged. Until it changes,
   every migration adds to this surface by default, and this inventory is accurate only until the
   next one lands. **This is the root cause; items 1–7 are symptoms.**

9. **A point-in-time snapshot.** Measured 2026-08-07 against `ab3d490`. Three threads are in
   flight per the handoff commit; any of them adding a function adds to this list.

---

## Appendix — reproduction

Analysis scripts (not committed; they read prod and write nothing):
population and body dump via `pg_proc`, guard extraction and shape normalisation, transitive
write detection through the call graph, and the caller map across `src/`, `api/` and `pg_proc`.
The four psql probes that produced the tables above are quoted inline in *Method*. The PostgREST
reachability probe used the project's public `anon` key, which is served in the deployed
front-end bundle and is public by design.
