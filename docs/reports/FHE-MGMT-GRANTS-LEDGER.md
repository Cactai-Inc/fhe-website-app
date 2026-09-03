# FHE-MGMT-GRANTS — LEDGER (bundle manager, D44 trial bundle B1)

**Bundle:** `docs/orch/BUNDLE-GRANTS.md` (cut by ORCH 2026-09-03). **Sender to hand back to:** `FHE-ORCH-7`.
**Opened 2026-09-03 · bundle tree `wt-1` · branch `bundle/grants` from `origin/main` @ a1c6c105.** Task tree allotted: `wt-2`.

## RESUME
Role / thread   FHE-MGMT-GRANTS · wt-1 · bundle/grants (origin/main e8bdb372 merged; -A merged 6ed5ff63); bundle branch pushed to origin, NEVER to main (ORCH-8 ruling: ORCH merges bundle branches)
DONE            handoff §7 check · tree claimed · sweep population measured · -A dispatched, run, handed back · -A output reviewed by MGMT (diff vs merge-base docs-only; 6 claims re-run against prod/main, all hold) · -A merged · board section + ledger corrected · ESCALATION 1 RAISED to the owner
IN FLIGHT       waiting on the owner's ruling (Block A · KEEP×2 · redeem_gift)
NEXT            write the ruling VERBATIM into `## RULING` of docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md and this ledger → commit + push bundle/grants → dispatch FHE-TASK-GRANTS-B (Sonnet · MEDIUM · thinking ON · wt-2 · sender FHE-MGMT-GRANTS) → on its report dispatch -V (Opus · HIGH · ON · wt-11) → merge → ask ORCH to merge bundle/grants to main → -W on the deploy → item 7 → bundle report
DECIDED         -A merged without a VRFY task: docs-only, no DB write, no build — VRFY is for builds (MGMT-ROLE §4); MGMT re-ran the claims itself instead · -B is NOT dispatched before the ruling: its spec stops without `## RULING`, so a pre-ruling dispatch would burn a thread · WALKR gains `/redeem` (a KEEP whose regression only a walk would show)
BLOCKED         -B, -V, -W all behind escalation 1. Nothing runs meanwhile — the natural boundary.
DO NOT          do not push bundle/grants to main (D40 + ORCH-8 ruling) · do not touch bodies · do not probe writers by calling them · do not `git checkout <ref> --` with no path in wt-1 — it detaches HEAD off the bundle branch (done once by MGMT 2026-09-03, recovered with `git checkout bundle/grants`, nothing lost) · do not treat provolatile='v' as the writer test (151 candidates ≠ 145 writers)

## LOG
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


## NOTE FROM ORCH (2026-09-03) — routed finding from DASHBOARDS, not fixed there
DASHBOARDS' hand-up flags `my_documents()` carrying `anon=X` in its `proacl` — same class as your
sweep's Block A/B (a writer or reader reachable by anon with no anonymous caller, or one that needs a
ruling). Fold it into your sweep's candidate set if not already caught (it may already be one of the
151/145 — confirm by name) rather than treat as a new finding.
