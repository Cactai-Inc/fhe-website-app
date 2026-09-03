# FHE-MGMT-GRANTS — LEDGER (bundle manager, D44 trial bundle B1)

**Bundle:** `docs/orch/BUNDLE-GRANTS.md` (cut by ORCH 2026-09-03). **Sender to hand back to:** `FHE-ORCH-7`.
**Opened 2026-09-03 · bundle tree `wt-1` · branch `bundle/grants` from `origin/main` @ a1c6c105.** Task tree allotted: `wt-2`.

## RESUME
Role / thread   FHE-MGMT-GRANTS · wt-1 · bundle/grants (this commit); task/grants-b PAUSED in wt-2 (7f2b36ff, unpushed, unmerged — do not touch until -D)
DONE            -V back: **DOES NOT HOLD — one row (item 6, edit 4).** All DB-STATE claims, the diff, the migration and the gates HOLD; VRFY's own re-proof at 15:40 PDT matches mine at 12:20. Per MGMT-ROLE §4 this is never overruled at the pass. `-C` (DSNR, spec amendment) authored and ready to dispatch.
IN FLIGHT       nothing — **BLOCKED on ORCH for one more pool worktree.** GRANTS was allotted wt-1 (bundle) + wt-2 (tasks) only; wt-2 holds the PAUSED task/grants-b (real, uncommitted-forward work `-D` continues) and cannot also host `-C`. Asking ORCH for one tree, named for `-C` only — `-D` needs none, it continues in wt-2.
NEXT            ORCH grants a tree (or says use one of the idle-looking wt-5/6/10/12/14/15/16 — MGMT does not self-select, D36) → dispatch `FHE-TASK-GRANTS-C` (Fable · HIGH) → on its handoff, dispatch `FHE-TASK-GRANTS-D` (CODR, continuing `task/grants-b` in `wt-2`, one-hunk fix) → re-run `-V`'s criterion 6 only (not a full re-VRFY — MGMT's own re-check suffices per `VRFY-PROFILE.md`'s "Sonnet when the trust-list is already written," but this is a comment, not DB state, so MGMT can verify it directly) → merge into `bundle/grants` → gates → `## VALIDATION` + `TASK-LEDGER.md` → push → ORCH merges the branch whole → `-W` → item 7 → bundle report
DECIDED         **not** overruling VRFY's verdict, even though the miss is one sentence — the rule is explicit and absolute. **Not** widening `holdMyDocumentDelivery` to the provisioned door inside this fix — that's a real, undecided product question (finding 5), and folding a behavioural change into a comment-correction task is exactly the scope creep the standing rules exist to stop. `-C`/`-D` letters continue the lineage rather than "-B-2" (same generation, D37).
BLOCKED         `-C`'s dispatch, on ORCH provisioning one more tree.
DO NOT          do not self-select an idle worktree for `-C` (D36 — ORCH assigns) · do not touch `task/grants-b` in `wt-2` except via `-D` · do not widen the delivery-hold guard as part of this fix · do not merge `task/grants-b` to `bundle/grants` before `-D` lands the corrected comment · do not re-run the whole VRFY pass for a one-hunk prose fix — verify criterion 6 only

## LOG
- **-V BACK 2026-09-03, ~15:45 PDT.** Verdict DOES NOT HOLD, one row: item 6 edit 4 (`Onboarding.tsx:625-628`). Every DB-STATE claim independently re-proven at 15:40 PDT (matches MGMT's 12:20 run); diff isolated to the same 6 files; gates at baseline; two overload rows and the door-factory finding CONFIRMED, not new. VRFY's own words: *"the fix is one DSNR amendment to spec §5 edit 4 and a one-hunk re-edit; nothing else in this branch depends on it."*
- MGMT read the actual code before dispatching -C (a read is not a finding until checked): `showShopStep`/`showTimeStep` ARE unconditionally `true` since `f9c66b49` (2026-09-01) — the spec's edit-4 text was already wrong when written, 2 days stale. Confirmed `holdMyDocumentDelivery` has exactly ONE call site in the file, gated `!selfServe`, with NO provisioned-door equivalent — so VRFY's routed finding 5 (the provisioned door's email may go out before its booking request exists) is a REAL, currently-true asymmetry, not a hypothetical. Not resolving it here — routed, again, to ORCH below.
- `TASK-GRANTS-C` authored (DSNR profile, Fable·HIGH): amend spec §5 edit 4's text + add a THE TEST line ("read the flags before claiming what steps a door has"). Explicitly told NOT to widen the delivery-hold's scope — that stays a routed, undecided product question.
- **BLOCKED on tree provisioning**, not an escalation: GRANTS' allotted wt-2 holds the paused, real `task/grants-b` (3 commits, `-D` continues it) and cannot double as `-C`'s tree. One-line ask to ORCH below.
- **-B BACK 2026-09-03.** task/grants-b @ 7f2b36ff (05069b76 migration · d844cf36 comments · 7f2b36ff report), unpushed, wt-2 clean. Migration `20260903T1130_…` applied to prod 11:31 PDT: 195 REVOKEs, one transaction, zero GRANT/CREATE/DROP/ALTER/COMMIT (MGMT re-grepped the file: none).
- **MGMT's merge-time re-proof, production, 2026-09-03 12:20:15 PDT** (D35 — the builder's 11:32 numbers are not evidence at merge time):
  `secdef_total 675 · anon_exec 134 · anon_trigger 0 · anon_event_trigger 0` — matches the report's 326→134.
  Per function (anon/authenticated/service_role): submit_public_request **t**/t/t (the ruled KEEP SURVIVED) · open_gift **f** · redeem_gift **f** (the ruling applied) · request_purchase_payment **f** (bundle item 1) · reap_expired_holds **f** (item 2) · trg_seed_display_name **f**, prosecdef=f (item 3, the invoker) · sign_release + sign_general_release anon f / authenticated **f** / service_role **t** (item 5, group S exactly right) · release_preview + general_release_preview **f** (the two zero-caller readers). **All ten HOLD.**
  Arithmetic checks out end to end: 195 statements − 2 authenticated-only − 1 invoker (trg_seed, outside the 326) = 192 = 326 − 134. The 134 remaining = 133 readers + submit_public_request.
- **Diff, isolated correctly:** `git merge-base origin/main task/grants-b` = aa8d347c → **exactly 6 files** (migration · deliver-document.ts · contact.ts · Onboarding.tsx · report · -B ledger). Inside ownership, MergedBodyView.tsx untouched. ⚠️ The bundle-side merge-base (6790396f) shows 19 files, 13 inherited from main — a trap named explicitly in the -V task file.
- **Q1 ANSWERED.** Verified the concern is live: `origin/main` does NOT carry the ruling (`grep -c "KEEP — ONE function"` on main's spec copy → 0; no `## RULING` section either). ORCH's earlier merge 975c77bc took a26cde43, one commit before the ruling 1e421e45. **Resolution: the lane already handles it** — -B merges into bundle/grants (which has the ruling), ORCH merges the bundle branch whole. Told to ORCH explicitly so it does not shortcut a task branch to main.
- **Q2 ANSWERED + ROUTED TO ORCH.** Door factory PROVEN still open, and it is worse than one row: `pg_default_acl` carries **TWO** function-default rows for schema `public` — one owned by `postgres`, one by `supabase_admin` — and **both grant `anon=X`**. ⚠️ **A fix that runs `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE …` as postgres touches only the postgres row and silently leaves supabase_admin's standing** — the "reports success while doing nothing" class. It needs `FOR ROLE postgres` AND `FOR ROLE supabase_admin`. Outside B1's declaration (not an ACL on a named function; it governs future objects of every kind). Sequencing is ORCH's: landing it mid-flight means any new function another bundle creates without an explicit GRANT gets a silent 403 — worth doing when the bundles quiesce, plus a line in CLAUDE.md's migration convention.
- **Q3 ANSWERED.** No grant was ever meant. Group S's heading names the `authenticated` grant it REMOVES; the migration has zero GRANTs; `service_role` keeps EXECUTE by not being revoked (proven 12:20). Struck the phrase from spec §4 under the "fully specified, no judgment" exception.
- **Overload finding VERIFIED and WIDENED** before routing (a read is not a finding): `log_request_alert_send` 6-arg anon=f **authenticated=f** — reachable by nobody — beside the live 7-arg; and -B missed a second, `claim_request_alert_send` (2-arg orphaned f/f, 3-arg live t/t). Both are definer. Dropping an overload is a signature change → not B1's. Routed.
- -V dispatched: Opus · HIGH · thinking ON · wt-11 (D45 — my call; VRFY-PROFILE's default, and the two traps need judgment, not a query).
- ESCALATION 1 RULED 2026-09-03 (owner via ORCH; CR-116 on main d4036431). Block A REVOKE · submit_public_request KEEP · open_gift REVOKE (overrules -A's KEEP: "the reveal is an email animation") · redeem_gift REVOKE. Principle: there is no anonymous user; account exists at email; activation = auth setup. Gift-flow REBUILD routed to B2 FUNNELDEBT (Redeem.tsx, gifts.ts, api/register-gift.ts, gift email, open_gift/redeem_gift BODIES). MGMT re-ran gifts count 10:41:43 PDT: 0/0/0; proacl of both gift fns still anon=t.
- Spec TASK-GRANTS-B amended by MGMT on the ruling (§1 sentence, §2 table, group W heading, KEEP table, Section 2, THE TEST #5). No judgment in the edit. -A's recommendation on open_gift was reasoned from the code as it stands; the owner ruled from where the flow is going — recorded, not a DSNR fault.
- D45 noted (no thread dictates a tier; spawner decides): -B = Sonnet · MEDIUM · ON.
- -B dispatched to wt-2 (detached a1399848, clean at census). Branch task/grants-b.
- -A handed back 2026-09-03 (10 commits on task/grants-a-spec, docs only). Review by MGMT: diff vs merge-base a1c6c105 = 4 GRANTS-A files + ORCH's own upstream commits (branch cut from 2779ca2c). Re-run against prod/main, all HOLD: trg_seed_display_name prosecdef=f · open_gift no guard, `Redeem.tsx:34` on mount before `user` · redeem_gift body line 19 `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'` · sign-start rides `getSupabaseAdmin()` (`api/sign-start.ts:198`) · zero callers of sign_release/sign_general_release/release_preview/general_release_preview (grep = 0) · MergedBodyView fixed by d78d3b3c. Merged 6ed5ff63.
- -A's hand-back message told MGMT its "next three acts" (task emitting instruction, not a report). One instance — noted, not a pattern.
- Bundle corrections from -A §4 accepted: trg_seed is INVOKER · request_category_label is invoker/immutable/no writer/no call site (nothing to rule) · sign-start writers are Block A, not Block B · item 6 is FOUR comments. Bundle row "known-public: request_category_label" was wrong but harmless.
- ORCH-8 ruled (board PROCESS): MGMT never pushes main; pushes bundle branch; ORCH merges. wt-11 allotted for -V/-W. Adopted.
- ESCALATION 1 RAISED 2026-09-03 (summons in chat; the file is `docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md`). Recommendation: YES Block A · KEEP submit_public_request + open_gift · REVOKE redeem_gift.
- 912d907a: ledger + `docs/tasks/TASK-GRANTS-A-author-the-acl-sweep-spec.md` + board section. Prompt for -A handed to the owner: Opus · HIGH · thinking ON · wt-2 · sender FHE-MGMT-GRANTS.
- Fact for -A, found while dispatching: `request_category_label` is SECURITY INVOKER (not in the definer population) with an explicit `GRANT … TO anon` in `20260901T2230_…sql:37-38` — public by design, as the bundle says. `api/expire-holds.ts` authorizes via `authorizeCronRequest` (cron header / CRON_SECRET); which DB role its client runs as is -A's to establish.
- 2026-09-03 open. Handoff §7 check: bundle name ✓ · items+state ✓ · ownership (ACLs only, 5 comment lines, ledger headers) ✓ · escalation points (1 pre-registered) ✓ · gates (none guest-facing; proacl table up) ✓ · merge lane (per task after VRFY; migration applied by build task under rehearsal) ✓ · WALKR flows (inbound request flow, sign-start flow; anonymous visitor) ✓ · model/effort ✓ · sender `FHE-ORCH-7` ✓. Nothing missing — no send-back.
- NOTE for ORCH (not a question): RECONCILED §8 row B1 also lists 1.15 (spec corrections for DSNR), 1.19 (5 reports lacking VALIDATION) and §7.6 (D42 gap); `BUNDLE-GRANTS.md` does not carry them. Executing the handoff as cut; the three go up in the bundle report as "not in this bundle".
- wt-1 guard: detached at c48be110, porcelain empty → `git checkout -b bundle/grants origin/main` (a1c6c105), clean run, .env/.env.db/node_modules present.

## MEASUREMENT — the sweep population, production, 2026-09-03 (read-only; the query the -A spec inherits)
```
select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as fn,
       coalesce(array_to_string(p.proacl,','),'<NULL=default: PUBLIC EXECUTE>') as proacl,
       has_function_privilege('anon',p.oid,'execute') as anon,
       has_function_privilege('authenticated',p.oid,'execute') as authed,
       p.prokind, p.provolatile, (p.prorettype='trigger'::regtype) as is_trg
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 1;
```
| Population | Count |
|---|---|
| SECURITY DEFINER functions in `public` | 675 |
| of which anon-executable | 326 |
| anon-executable AND volatile AND not a trigger function (the CANDIDATE set — ⚠️ NOT the writer set: -A read all 326 bodies and found **145 writers**, 135 readers; 5 of these 151 only SELECT) | **151** |
| anon-executable trigger functions (inert via the API; `trg_seed_display_name` is one) | 45 |
| anon-executable stable/immutable (readers by declaration — but a STABLE mislabel is possible; the spec's writer test must read bodies, not trust `provolatile`) | 130 |

The named ones, `proacl` verbatim:
    general_release_preview(p_org uuid) | postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres | t | t | f | s | f
    reap_expired_holds() | postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres | t | t | f | v | f
    release_preview(p_template_key text, p_org uuid) | postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres | t | t | f | s | f
    request_purchase_payment(p_purchase_id uuid, p_note text) | postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres | t | t | f | v | f
    sign_general_release(p_full_name text, p_email text, p_phone text, p_typed_name text, p_org uuid, p_esign_consent boolean) | postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres | f | t | f | v | f
    sign_release(p_template_key text, p_first_name text, p_last_name text, p_email text, p_phone text, p_typed_name text, p_is_minor boolean, p_minor_first_name text, p_minor_last_name text, p_minor_dob date, p_guardian_relationship text, p_rules_acknowledged boolean, p_org uuid, p_esign_consent boolean, p_dob date, p_address_line1 text, p_address_line2 text, p_city text, p_state text, p_postal_code text, p_ec1_name text, p_ec1_relationship text, p_ec1_phone text, p_ec2_name text, p_ec2_relationship text, p_ec2_phone text) | postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres | f | t | f | v | f
    submit_public_request(p_first_name text, p_last_name text, p_email text, p_phone text, p_contact_method text, p_notes text, p_proposed_times jsonb, p_category text, p_channel text, p_entry_location text, p_intent text, p_selections jsonb, p_details jsonb, p_interests text[]) | postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres | t | t | f | v | f
⚠️ CORRECTED by -A (handoff §4.1), re-run by MGMT 2026-09-03: `trg_seed_display_name` is **SECURITY INVOKER** (`prosecdef = f`) — it is NOT in the 326 population and NOT one of the 45. It enters the migration BY NAME because the bundle names it. Its `proacl`: `=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres`.

The 151 candidates by name (signatures in the -A task's re-run; this list is so the next MGMT does not re-derive it):
    _restore_contract_template_composition acknowledge_content_block add_contact_location add_deal_document 
    add_deal_member add_form_field add_my_location agree_change_request apply_offering_documents 
    apply_sign_path_documents approve_contract_review approve_contract_termination archive_contract 
    assign_horse_section attach_horse_to_document capture_horse_record_info claim_document_origination 
    claim_request_alert_send company_contact_id complete_deal confirm_my_legal_name consume_notification 
    create_contract_note create_deal create_evaluation_report decline_contract_termination 
    delete_contract_comment deliver_evaluation_report dm_delete_message dm_edit_message dm_hide_conversation 
    dm_list_conversations dm_mark_conversation_read dm_unread_total edit_change_request_entry 
    edit_contract_comment edit_form_field ensure_my_member_access feed_get feed_mark_seen feed_moderate 
    feed_post_create feed_post_delete feed_post_update feed_report_post feed_seed_welcome feed_set_view_shape 
    feed_share gift_mark_sent gift_reschedule gift_transfer grant_lesson_credit hard_delete_contract 
    insurance_resolution_sync link_contract_to_purchase log_evaluation_report_access log_mirror_delivery 
    log_payment_request_send log_request_alert_send mark_change_request_seen mark_comment_review 
    mark_document_opened mark_tour_seen my_stable_add_horse my_stable_delete_horse my_stable_update_horse 
    notify_review_changes open_gift post_contract_note_message promote_lookup_suggestion propose_community_event 
    provision_client_invitation publish_open_slots reap_expired_holds reassign_document_party 
    record_invitation_failure record_lookup_suggestion redeem_gift redeem_invitation redeem_my_pending_invitation 
    remove_deal_member remove_form_field rename_contract_note reopen_change_request reopen_deal 
    reply_to_change_request request_contract_termination request_documents_from_contact 
    request_permission_to_edit request_purchase_payment require_module require_resign_from 
    resend_executed_document_email resolve_change_request_thread resolve_consumption_billing 
    resolve_version_decision restore_content_block_version restore_contract_template_version 
    restore_email_template_version restore_form_definition_version revoke_lesson_credit_grant rls_auto_enable 
    save_content_block_version save_contract_template_version save_email_template_version save_evaluation_report 
    save_form_definition_version say_hi say_hi_back send_contract_to_party set_contact_required_documents 
    set_contact_type set_document_co_buyer set_document_party_archived set_document_party_hidden 
    set_field_control_override set_field_included set_field_na set_field_responsibility set_field_structured 
    set_form_field_options set_form_required set_horse_locations set_horse_medications set_lesson_progress_note 
    set_my_onboarding_horses set_support_status share_evaluation_report sign_start_register_attempt 
    staff_assign_documents staff_assign_horse_party staff_end_horse_relationship 
    staff_request_horse_record_completion staff_update_horse start_bill_of_sale start_bill_of_sale_standalone 
    start_sale_contract submit_acquisition_intake submit_change_requests submit_public_request 
    submit_support_request supersede_invitations transfer_payment_responsibility update_contact_record 
    update_deal update_horse_record update_purchase_payment_method upsert_change_request upsert_content_block 
    void_deal void_document 
