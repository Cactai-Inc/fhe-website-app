# TASK-TRIGGERSWEEP report — every `UPDATE OF` trigger, proven

**Lead answer: of the 32 candidate triggers, 1 is PARTIAL and 4 are DEAD (all four benign — no
writer touches the watched column via UPDATE at all). 27 are FIRES. Zero fixes were applied.**

That is a materially better number than the "found by accident, one at a time" framing implied —
this sweep did not find a fourth `sign_release`. The one PARTIAL finding is a minor audit-trail
gap (§4), not a value-moving, email-sending, or evidence-losing defect, and its naive fix
(widen the event clause) would not actually work — see §4 for why.

**Method note (mid-task, from the orchestrator, 2026-08-20):** two live browser walks (WALK2,
WALK3) were driving production while this audit ran. Per instruction, **no migration was applied
to prod** — every proof below runs inside `BEGIN … ROLLBACK`, so nothing here touched the walks'
state. This is moot for the fix step specifically: the audit found no unambiguous fix to apply
(§4 explains why the one PARTIAL isn't fixable by this task's technique). Reporting at the apply
step as instructed — there is nothing queued to apply.

---

## 1. The 32, classified

Enumerated fresh from prod (query in the task doc, re-run below), not trusted from any prior list.

| table | trigger | watches | class | writer evidence |
|---|---|---|---|---|
| documents | `contract_execution_effects_trg` | workflow_state | **FIRES** | `record_signature`, `sign_release` set `workflow_state='executed'` in the same statement as `status='EXECUTED'` |
| documents | `deal_autocomplete_trg` | workflow_state | **FIRES** | same two writers |
| documents | `documents_apply_affiliations` | status | **FIRES** | same two writers set `status` in target list; also `add_deal_document`/`start_sale_contract`/`bos_generate_document`/`staff_assign_documents` |
| documents | `documents_send_executed_email_trg` | status | **FIRES** | `record_signature`, `sign_release` |
| documents | `freeze_signed_template_version_trg` | status | **FIRES** | same two |
| documents | `status_documents` | status, workflow_state | **FIRES** | union of every writer below — union-of-both-columns design makes it structurally resistant to this defect (see §5) |
| documents | `trg_documents_sync_workflow` | status, workflow_state | **FIRES** | same union design; this is itself **the trap mechanism** other triggers fall into (§5) |
| documents | `trg_snapshot_execution_audit` | workflow_state | **FIRES** | `record_signature`, `sign_release` — this is the exact PARTYEMAIL P0 column (kiosk-execution snapshot) |
| documents | `trg_sync_horse_id_to_document_horses` | horse_id | **FIRES** | `sync_document_primary_horse`, `attach_horse_to_document` both target `horse_id` explicitly |
| contacts | `contacts_a_seed_community_channels_trg` | phone, email | **FIRES** | `update_contact_record` (staff editor, both in `v_allowed`), `sign_release`, `provision_client_invitation` |
| contacts | `contacts_normalise_account_info_phone_trg` | mobile_number, texts_phone, zelle_phone | **FIRES** | `saveMyAccountInfo` → `.from('contacts').update({[key]: value})`, single-key patch from `AccountInfoCard.tsx`'s `commit()` |
| contacts | `contacts_normalise_ec_phone_trg` | emergency_contact_1/2_phone | **FIRES** | `update_contact_record` (`v_allowed` includes both) |
| contacts | `contacts_normalise_phone_trg` | phone, mobile, phone_ext, mobile_ext, mobile_call, mobile_text, whatsapp_call, whatsapp_text | **FIRES** | `update_contact_record` (phone/mobile/phone_ext/mobile_ext) + `saveMyContactPrefs` → single-key patch from `ProfileCard.tsx`'s `set()` (the 4 community-channel columns) |
| contacts | `sync_profile_name_from_contact_trg` | first_name, last_name | **FIRES** | `confirm_my_legal_name`, `sign_release`, `_ensure_client_account`, `provision_client_invitation`, `update_contact_record` |
| bookings | `booking_form_lifecycle` | client_id, status, deleted_at, kind, offering_id | **FIRES** | `save_calendar_item`, `book_open_slot` (kind+status+client_id+offering_id together); `delete_calendar_item` (deleted_at+status) |
| bookings | `status_bookings` | status | **FIRES** | `decide_booking_change`, `confirm_booking`, `cancel_lesson_session`, `complete_lesson_session`, `withdraw_my_pending_booking`, etc. — all target `status` |
| purchases | `purchases_mint_credits` | status | **FIRES** | `finalize_purchase_payment` sets `status='awaiting_payment'` (the D23 "declaration opens the order" path); `mark_purchase_paid` sets `status='paid'` |
| purchases | `status_purchases` | status, payment_status, client_claim_status, client_reported_method | **FIRES** | `report_my_payment` sets `client_reported_method` + `client_claim_status` — **this is the BUYANDBOOK fix, re-verified live (§2)** |
| contract_fields | `contract_fields_split_sync` | value | **FIRES** | `set_contract_field`, `add_deal_document`, `sync_contract_fields_from_defs`, `start_sale_contract` etc. all target `value` |
| contract_templates | `record_template_version_bump_trg` | version | **FIRES** | `template_editor_publish` sets `version = version + 1` |
| horses | `horses_apply_affiliations` | current_owner_contact_id | **FIRES** | `apply_contract_execution_effects`, `staff_assign_horse_party`, `purge_account` |
| horses | `horses_normalise_phone_trg` | vet_phone, farrier_phone | **FIRES** | `staff_update_horse`, `update_horse_record`, `capture_horse_record_info` — all target both columns unconditionally (CASE-wrapped but always in the SET list) |
| horses | `horses_wake_held_orders` | current_owner_contact_id, lessee_contact_id | **FIRES** | `apply_contract_execution_effects`, `staff_assign_horse_party` |
| invitations | `status_invitations` | status | **PARTIAL** | fires via `redeem_invitation`/`redeem_contract_invitation`/`supersede_invitations`/`record_invitation_failure`; **does not** fire via `admin_expire_invitation` (touches `expires_at` only) — see §4 |
| members | `trg_members_post_join_event` | status | **FIRES** | `ensure_my_member_access` sets `status='active'` |
| profiles | `bookings_claim_on_account_link_trg` | contact_id | **FIRES** | `promote_contact_to_account` (both branches) |
| profiles | `contacts_file_team_on_link_trg` | role, contact_id | **FIRES** | `promote_contact_to_account`, `redeem_invitation`, `admin_account_action` |
| profiles | `trg_profiles_sync_staff_profile` | role, is_admin, org_id | **FIRES** | `redeem_invitation` (all three together), `admin_account_action` (org_id) |
| horse_medications | `horse_medications_normalise_phone_trg` | supplier_phone | **DEAD (benign)** | `set_horse_medications` never `UPDATE`s a row in place — it soft-deletes the whole set and re-`INSERT`s. INSERT always fires regardless of column list, so data is normalised at creation; the UPDATE clause is inert because there is no in-place edit path |
| requests | `requests_normalise_phone_trg` | contact_phone | **DEAD (benign)** | `contact_phone` is captured once at intake (`PublicIntakeForm`/`InquiryForm`/gifts, all `INSERT`); no writer anywhere `UPDATE`s it afterward |
| vendors | `vendors_normalise_phone_trg` | phone | **DEAD (benign)** | `addVendor` only `INSERT`s; there is no vendor-edit feature at all in `src/lib/stable.ts` |
| buckets (storage) | `enforce_bucket_name_length_trigger` | name | **DEAD (benign)** | Supabase-managed `storage.buckets`; the only app-side writes touch `public`, never `name` — bucket ids/names are migration-time constants |

**27 FIRES · 1 PARTIAL · 4 DEAD (all benign — no live writer, not a silent gap in a real workflow).**

---

## 2. Calibration — the three known instances, re-verified FIRING by query output

Enumeration query (re-run fresh, not trusted from the task doc):

```
SELECT c.relname, t.tgname, ...
-- 32 rows, matches task doc §2 exactly
```

### `sign_release` / `record_signature` → `contract_execution_effects_trg`, `deal_autocomplete_trg`, `trg_snapshot_execution_audit`

Both writers' live bodies set `status='EXECUTED'` **and** `workflow_state='executed'` in the same
`UPDATE` statement — the PARTYEMAIL fix is live. Proven with a probe-trigger transaction
(`BEGIN…ROLLBACK`, real production triggers disabled so no real email/affiliation side effects ran,
a synthetic document row, never committed):

**A. Current shape** (`status` + `workflow_state` together, i.e. today's `sign_release`/`record_signature`):
```
        probe         | count
----------------------+-------
 status_watch         |     1
 workflow_state_watch |     1
```
Both fire. ✅

**B. The historical pre-fix shape** (`status` only — literally what `sign_release` used to do per
the task doc): with `trg_documents_sync_workflow` (the trap) left enabled and every *other* real
trigger disabled:
```
    probe     | count
--------------+-------
 status_watch |     1
```
`workflow_state_watch` — **0 rows, i.e. zero firings.** And the row itself:
```
  status  | workflow_state
----------+----------------
 EXECUTED | executed
```
**The value is correct and the event never fired** — exactly the task's own description of the
defect, reproduced on demand. This validates the whole method: if it can't show the *known* bug
being invisible-by-row-inspection, it can't be trusted to find new ones. It can.

### `status_purchases` (BUYANDBOOK fix)

`report_my_payment`'s live body sets `client_reported_method` and `client_claim_status` (never
`status`/`payment_status` directly — by design, per its own comment: *"Nothing here writes an
entitlement directly"*). Probe with the trigger's **current** watch list
(`status, payment_status, client_claim_status, client_reported_method`):
```
         probe          | count
------------------------+-------
 status_purchases_watch |     1
```
Fires. ✅ Probe with the **pre-fix** watch list (`status, payment_status` only, i.e. what the task
doc says the trigger used to watch) against the identical statement: **0 rows** — confirms the
historical shape would have missed every declared-payment event, matching the task doc's own
account exactly.

`deal_autocomplete_trg` is the same function/gate as `contract_execution_effects_trg`
(`NEW.workflow_state='executed' AND OLD IS DISTINCT FROM 'executed'`) — covered by the same proof
above, since both are AFTER triggers on `documents.workflow_state` fired by the same two writers.

**All three re-verified as FIRING. The method is sound.**

---

## 3. The trap mechanism, confirmed present exactly once

`trg_documents_sync_workflow` (BEFORE, watches `status, workflow_state`) is the live trap: its body
sets `NEW.workflow_state := 'executed'` whenever `NEW.status = 'EXECUTED'`, silently correcting the
row **without ever putting `workflow_state` in anyone's UPDATE statement**. I checked every other
BEFORE trigger on all 14 tables with a no-column-list filter (BEFORE triggers are the only kind
that *can* silently rewrite `NEW`; AFTER triggers can't mutate the row at all) — the only two
candidates were `contacts_minor_no_email_guard` and `profiles_role_guard`, and both are pure guards
(`RAISE EXCEPTION`, no silent `NEW.field :=` assignment). **The trap exists exactly once in this
schema**, on `documents`, and it's already been worked around correctly at every current writer.

---

## 4. The one PARTIAL — flagged, not fixed, and why the obvious fix doesn't work

**`status_invitations`** (watches `status`) does not fire when `admin_expire_invitation` runs —
that function's entire body is:
```sql
UPDATE invitations SET expires_at = now() WHERE id = p_id AND org_id = current_org();
```
Proven (probe trigger mirroring the exact watch list, real trigger disabled):
```
 probe | count
-------+-------
(0 rows)
```
against
```
 status | is_expired_by_time
--------+--------------------
 sent   | t
```
— the invitation is functionally expired (and both `RosterCard.tsx`/`admin.ts:686` compute
"expired" client-side from `expires_at <= now()`, so **nothing user-facing is broken**), but no
`status_events` row is ever written and `current_status` never updates for this specific staff
action. Every other invitation-status transition (`redeem`, `supersede`, `record_invitation_failure`)
does log correctly — proven in the same transaction, contrast probe fires `count=1`.

**Why I did not fix it:** the task's prescribed technique is "add the column the writer actually
sets to the trigger's list" — here that would mean widening the trigger to
`UPDATE OF status, expires_at`. I checked whether that would actually help, because
`admin_delete_invitation` *also* touches `expires_at` (for an unrelated reason — soft-delete), so a
naive widening would make the trigger fire on deletion too. Tracing `trg_status_invitations`'s body:
```sql
v_code := account_status_code(NEW.status);
...
IF TG_OP = 'INSERT' OR v_code IS DISTINCT FROM v_old THEN ...
```
**`account_status_code` takes only `status` as input.** Widening the event clause would make the
trigger *run* on both the expire and delete paths, but `v_code` would be computed from the
unchanged `status` text either way and come out identical to `v_old` — **the `IF` would still
never pass, so nothing would actually get logged.** Adding `expires_at` to the event clause is a
no-op dressed as a fix. The real gap is in `account_status_code`'s vocabulary (it has no "expired"
distinct from "sent"), which is trigger-body/function logic — explicitly out of this task's scope
("this task changes event clauses, not logic"). **Flagging for the orchestrator**: closing this
requires either teaching `account_status_code` to derive `expired` from `expires_at`, or having
`admin_expire_invitation` explicitly set `status = 'expired'`. Low severity — no money, email, or
evidence is at stake, only a missing audit-log line for one staff action.

---

## 5. Why `status_documents`/`status_bookings`/`status_purchases`/`status_invitations` are structurally the safest triggers here

All four "denormalize `current_status` + log a `status_event`" triggers share a design that makes
most of them immune to this whole defect class: they watch the **union** of every column that can
plausibly represent the entity's state (documents: `status, workflow_state`; purchases:
`status, payment_status, client_claim_status, client_reported_method`), and they recompute the
*combined* code from `NEW` at execution time rather than caring which specific column changed. As
long as **any** writer touches **any one** watched column when it means to change state, the
trigger fires and reads the full truth. `status_invitations` is the one member of this family that
only watches `status` alone (not `expires_at`), which is exactly why it's the one with a gap — and
per §4, even fixing the event clause wouldn't close it, because the derivation function itself
doesn't consume the second column.

---

## 6. Sibling trap (function overloading) — checked, clean

Queried for duplicate signatures among every function this audit relied on
(`sign_release`, `record_signature`, `report_my_payment`, `mark_purchase_paid`,
`finalize_purchase_payment`, `admin_expire_invitation`, `advance_document_workflow`,
`update_contact_record`, `trg_status_purchases`, `trg_status_invitations`):
```sql
SELECT proname, count(*) FROM pg_proc WHERE ... GROUP BY proname HAVING count(*) > 1;
-- 0 rows
```
No overloads. Not applicable further since this task made no function-body edits.

---

## 7. Secondary observation (not one of the 32, noted for hygiene)

`advance_document_workflow(p_document_id, 'void')` is a live, staff-gated, RPC-reachable branch
(`GRANT EXECUTE ... TO authenticated`) that sets `workflow_state = 'void'` **alone** — it does not
touch `status`. It is real code, callable directly via `supabase.rpc(...)` by any staff session even
though the UI never calls it that way (`advanceWorkflow(...)` is only ever invoked with
`'editable'`/`'in_review'` — confirmed by grep across `src/`). Traced through every trigger it would
affect: no consequence-bearing trigger misfires (execution-gated triggers correctly no-op since
`workflow_state <> 'executed'`; `status_documents` still logs correctly since it reads `NEW.status`
+ `NEW.workflow_state` together). The only symptom, if this branch were ever exercised, is that the
raw `status` column would go stale while `workflow_state` and `current_status` stay correct. The
real (`void_document`) flow used by `VoidContractModal.tsx` sets both columns correctly. Recommend
either removing this now-superseded branch from `advance_document_workflow` or making it also set
`status`, next time that function is touched — not urgent, not part of the 32.

---

## 8. Out of scope, confirmed untouched

101 no-column-list triggers, any UI, any new feature, trigger *bodies* (only event clauses were in
scope — none needed changing), `test:db`'s existing red baseline (cited nothing from it).

## 9. Checks

- `npm run typecheck` — **0 errors**.
- `npm run lint` — **0 errors**, 46 warnings (pre-existing; no file was edited by this task, so this
  is identical to main by construction — `git status --short` on the worktree is empty).
- `test/db` — no migration, no code change; nothing to diff.
- No migration was written or applied. Per the orchestrator's mid-task instruction, any fix would
  have held for WALK2/WALK3 regardless — moot here since none was needed.

## 10. TEARDOWN — process census

```
$ ps aux | grep -E 'vitest|node|psql' | grep -v grep
```
No `vitest`/dev-server/background processes were started by this task — only short-lived `psql`
invocations, each exited before the next command ran. `npm install` populated
`wt-triggersweep/node_modules` (gitignored, worktree-local) to run `typecheck`/`lint`; no daemon
left running. Confirmed via the census above (see raw output at time of writing — empty).
