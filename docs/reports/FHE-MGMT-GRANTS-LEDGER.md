# FHE-MGMT-GRANTS — LEDGER (bundle manager, D44 trial bundle B1)

**Bundle:** `docs/orch/BUNDLE-GRANTS.md` (cut by ORCH 2026-09-03). **Sender to hand back to:** `FHE-ORCH-7`.
**Opened 2026-09-03 · bundle tree `wt-1` · branch `bundle/grants` from `origin/main` @ a1c6c105.** Task tree allotted: `wt-2`.

## RESUME
Role / thread   FHE-MGMT-GRANTS · wt-1 · bundle/grants (from a1c6c105; origin/main = a1c6c105 at open)
DONE            handoff read end to end (all §7 rows present); MGMT-ROLE/VRFY/WALKR read; D36 guard passed in wt-1, bundle/grants claimed; sweep MEASURED once against production (read-only, below) as input for the DSNR-profile task
IN FLIGHT       dispatching FHE-TASK-GRANTS-A (DSNR profile) to wt-2
NEXT            owner launches FHE-TASK-GRANTS-A; on its handoff, dispatch CODR (-B) to wt-2, then VRFY (-V) — needs a second tree from ORCH if -B still holds wt-2 at VRFY time
DECIDED         letters: -A = DSNR-profile spec task · -B = CODR build · -V = VRFY · -W = WALKR. DSNR tier kept at Opus·HIGH·ON (handoff's suggestion; the ground is a classification sweep, not convoluted shape). Escalation 1 is MINE to raise: the -A spec must emit the anon-writer list as a file I can put in front of the owner, and chunk so the un-escalated work builds while he rules.
BLOCKED         nothing yet. Escalation 1 will block only the revokes on functions the owner has not ruled on.
DO NOT          do not write the canonical checkout (D40); do not touch function BODIES (B2 owns them); do not run the "does anon actually execute it" probe on writers — probing writes production; do not treat provolatile='v' as "writes" — it is the candidate set, the spec defines the writer test

## LOG
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
| anon-executable AND volatile AND not a trigger function (**the writer CANDIDATE set**) | **151** |
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
(`trg_seed_display_name` row: see the -A task's own re-run — it is in the 45.)

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
