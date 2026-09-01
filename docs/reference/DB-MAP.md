# DB MAP — the reachable RPC surface and the trigger spines

**Generated 2026-09-01. Regenerate with:**
```
node scripts/gen-db-map.mjs
```

Replaces the 972-file migration journal as the day-to-day "what writes what"
reference (D30). Two parts: the RPC surface actually granted to `authenticated`
or `anon` (the app's real reach into the database — most of the ~750 functions
in the public schema are internal helpers only other functions call, and are not
listed here), and the trigger spines (what fires automatically on a write). The
"called from" column is a static grep for `.rpc('name')` across `src/` and `api/`
only -- a function may also be called from inside another SQL function (function-
to-function calls are not traced here) or not be reachable yet at all. Absence in
this column is a lead worth checking, not proof of dead code.

**667 granted RPCs · 142 triggers.**

---

## RPC surface

| function | args | granted to | called from |
|---|---|---|---|
| **_booking_form_is_blank** | p_answers jsonb | authenticated | _no src/**/*.ts(x) caller found_ |
| **_condition_names_value** | p_cond jsonb, p_field_key text, p_code text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_contact_sort_name** | p_first text, p_last text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_contract_document_frozen** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_current_lesson_plan** | p_client_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **_file_is_on_my_booking** | p_file_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **_form_edit_base** | p_form_key text, p_from_version integer | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_group_types** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_lease_button_options** | p_field_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_lease_select_options** | p_field_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_lesson_plan_for_booking** | p_booking_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **_lesson_plan_json** | p_plan lesson_plans, p_include_private boolean | authenticated | _no src/**/*.ts(x) caller found_ |
| **_lesson_plan_objectives** | p_objectives jsonb | authenticated | _no src/**/*.ts(x) caller found_ |
| **_lesson_plan_same** | p_a_focus text, p_a_objectives jsonb, p_a_notes text, p_b_fo | authenticated | _no src/**/*.ts(x) caller found_ |
| **_normalize_recurring_days** | p_days text[] | authenticated | _no src/**/*.ts(x) caller found_ |
| **_options_patch** | p_options jsonb, p_code text, p_patch jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_recompute_purchase_total** | p_purchase_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **_recurring_allotment** | p_weekly_frequency integer, p_anchor_day text, p_from date,  | authenticated | _no src/**/*.ts(x) caller found_ |
| **_recurring_allotment_days** | p_days text[], p_from date, p_to date | authenticated | _no src/**/*.ts(x) caller found_ |
| **_restore_contract_template_composition** | p_template_key text, p_composition jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_sign_path_for_categories** | p_categories text[] | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_unambiguous_purchase_for_client** | p_client_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_value_selects_code** | p_value text, p_code text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_value_without_code** | p_value text, p_code text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **_waiting_items** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **_write_lesson_plan_version** | p_client_id uuid, p_focus text, p_objectives jsonb, p_coach_ | authenticated | _no src/**/*.ts(x) caller found_ |
| **account_status_code** | p_status text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **acknowledge_content_block** | p_slug text | anon, authenticated | `src/lib/contentStore.ts` |
| **activity_checklist** | p_service_type text | authenticated | `src/lib/ops/api-lessons.ts` |
| **add_booking_note** | p_booking_id uuid, p_phase text, p_body text | authenticated | `src/lib/ops/api-lessons.ts`, `src/lib/ops/api-member.ts` |
| **add_contact_location** | p_contact_id uuid, p_name text, p_address text | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **add_contract_composition** | p_document_id uuid, p_spec jsonb | authenticated | `src/lib/contracts.ts` |
| **add_contract_element** | p_document_id uuid, p_kind text, p_section text, p_after_sec | authenticated | `src/lib/contracts.ts` |
| **add_deal_document** | p_deal_id uuid, p_template_key text, p_has_sale_agreement te | anon, authenticated | `src/lib/deals.ts` |
| **add_deal_member** | p_deal_id uuid, p_party_role text, p_contact_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **add_document_party_by_email** | p_document_id uuid, p_party_role text, p_email text | authenticated | `src/lib/contracts.ts` |
| **add_form_field** | p_form_key text, p_section_heading text, p_key text, p_label | anon, authenticated | `src/lib/admin.ts` |
| **add_lease_participant** | p_document_id uuid, p_contact_id uuid, p_days text, p_hours  | authenticated | _no src/**/*.ts(x) caller found_ |
| **add_lease_payment_option** | p_document_id uuid, p_amount numeric, p_describe text | authenticated | _no src/**/*.ts(x) caller found_ |
| **add_lookup_value** | p_lookup_key text, p_raw_value text | authenticated | `src/lib/api.ts` |
| **add_my_location** | p_name text, p_address text | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **admin_account_action** | p_contact_id uuid, p_action text | authenticated | `src/lib/admin.ts` |
| **admin_client_accounts** |  | anon, authenticated | `src/lib/admin.ts` |
| **admin_client_bookings** | p_user_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **admin_client_documents** | p_user_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **admin_client_items** | p_client_id uuid | anon, authenticated | `src/lib/admin.ts` |
| **admin_client_messages** | p_user_id uuid, p_limit integer | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **admin_client_overview** | p_user_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **admin_delete_invitation** | p_id uuid | authenticated | `src/lib/admin.ts` |
| **admin_expire_invitation** | p_id uuid | authenticated | `src/lib/admin.ts` |
| **admin_form_definitions** |  | anon, authenticated | `src/lib/admin.ts` |
| **admin_offering_usage** |  | authenticated | `src/lib/admin.ts` |
| **admin_oversight** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **advance_document_workflow** | p_document_id uuid, p_to text | authenticated | `src/lib/contracts.ts` |
| **agree_change_request** | p_request_id uuid, p_agreed boolean | anon, authenticated | `src/lib/contracts.ts` |
| **app_role** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **append_request_note** | p_request_id uuid, p_note text | authenticated | `src/lib/ops/api-intake.ts` |
| **apply_booking_fee** | p_booking_id uuid, p_fee_kind text, p_change_id uuid, p_amou | authenticated | `src/lib/ops/api-calendar.ts` |
| **apply_contract_execution_effects** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **apply_document_supersession** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **apply_offering_documents** | p_contact_id uuid, p_disposition text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **apply_sign_path_documents** | p_contact_id uuid, p_path text | anon, authenticated | `api/sign-start.ts` |
| **appointment_notify** | p_booking_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **approve_contract_review** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **approve_contract_termination** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **archive_contact** | p_contact_id uuid, p_reason text | authenticated | `src/lib/api.ts` |
| **archive_contract** | p_document_id uuid, p_archive boolean | anon, authenticated | `src/lib/contracts.ts` |
| **archived_contacts** |  | authenticated | `src/lib/api.ts` |
| **assert_template_is_satisfiable** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **assign_display_code** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **assign_display_code_yearly** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **assign_horse_section** | p_document_id uuid, p_role text | anon, authenticated | `src/lib/contracts.ts` |
| **assign_random_document_code** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **attach_booking_horse** | p_booking_id uuid, p_horse_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **attach_first_purchase_policies** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **attach_horse_to_document** | p_document_id uuid, p_horse_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **attach_offerings_to_client** | p_contact_id uuid, p_offering_ids uuid[], p_mark_paid boolea | authenticated | `src/lib/admin.ts` |
| **attach_purchase_horse** | p_purchase_id uuid, p_horse_id uuid | authenticated | `src/lib/api.ts` |
| **audit_logs_immutable** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **audit_row_change** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **billing_next_due** | p_start date, p_cadence billing_cadence, p_after date | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **block_settled_billable_line_delete** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **block_settled_billable_line_update** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **block_signed_signature_update** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **book_open_slot** | p_booking_id uuid, p_horse_id uuid, p_credit_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **booking_change_fee_schedule** |  | authenticated | `src/lib/ops/api-calendar.ts` |
| **booking_form** | p_booking_id uuid | authenticated | `src/lib/ops/api-lessons.ts` |
| **booking_form_applies** | p_booking bookings | authenticated | _no src/**/*.ts(x) caller found_ |
| **booking_form_key** | p_service_type text | authenticated | _no src/**/*.ts(x) caller found_ |
| **booking_item_options** | p_booking_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **booking_notifies_client** | p_booking bookings | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **booking_report** | p_booking_id uuid | authenticated | `src/lib/ops/api-lessons.ts` |
| **booking_service_label** | p_kind text, p_offering_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **booking_service_type** | p_booking bookings | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **booking_status_code** | p_status text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **bookings_derive_account_contact_id** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **business_hours** |  | authenticated | `src/lib/ops/api-calendar.ts` |
| **calendar_free_busy** | p_from timestamp with time zone, p_to timestamp with time zo | authenticated | `src/lib/ops/api-calendar.ts` |
| **calendar_money_items** | p_from timestamp with time zone, p_to timestamp with time zo | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **calendar_reminder_sweep** |  | authenticated | `api/calendar-reminders.ts` |
| **calendar_revenue** | p_from timestamp with time zone, p_to timestamp with time zo | authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_is_document_party** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_is_document_party_or_staff** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_may_propose** | p_document_id uuid, p_control text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_may_resolve** | p_document_id uuid, p_proposed_by_contact_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_may_use_horse** | p_contact uuid, p_horse uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_owns_document** | doc_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_owns_horse** | h_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **caller_party_roles** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **can_cleanup_document** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **can_list_horse** | p_horse_id uuid, p_intent text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **can_void_document** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **cancel_lesson_session** | p_session_id uuid, p_no_show boolean | authenticated | `src/lib/ops/api-lessons.ts` |
| **capture_contract_template_composition** | p_template_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **capture_horse_record_info** | p_document_id uuid, p_patch jsonb | anon, authenticated | `src/lib/contracts.ts` |
| **category_document_defaults** |  | anon, authenticated | `src/lib/admin.ts` |
| **certify_statement** | p_field_key text, p_raw text, p_tmpl text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **change_log_section_key** | p_document_id uuid, p_field_key text, OUT section_key text,  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **change_request_impact_rank** | p_section text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **claim_document_origination** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **claim_request_alert_send** | p_request_id uuid, p_key text | anon, authenticated | `api/inquiry-confirmation.ts`, `api/request-received.ts` |
| **claim_request_alert_send** | p_request_id uuid, p_key text, p_kind text | anon, authenticated | `api/inquiry-confirmation.ts`, `api/request-received.ts` |
| **claim_signup_help_alert** | p_attempt_id uuid | authenticated | `api/signup-help.ts` |
| **clause_condition_met** | p_cond jsonb, v_fields jsonb | authenticated | _no src/**/*.ts(x) caller found_ |
| **clause_cut_kept** | p_cut text, v_fields jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **cleanup_document** | p_document_id uuid, p_reason text | authenticated | `src/lib/support.ts` |
| **client_can_read_horse** | h_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **client_lesson_plan** | p_client_id uuid | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **client_monthly_plan** | p_client_id uuid | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **client_purchases** | p_client_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **client_standing_slots** | p_contact_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **close_day** | p_date date, p_reason text | authenticated | `src/lib/ops/api-calendar.ts` |
| **comment_author_identity** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **company_contact_id** |  | anon, authenticated | `src/lib/horses.ts` |
| **comped_credit_value** | p_from date, p_to date | anon, authenticated | `src/lib/ops/api-lessons.ts` |
| **complete_deal** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **complete_lesson_session** | p_session_id uuid, p_debit_credit boolean | authenticated | `src/lib/ops/api-lessons.ts` |
| **compose_address** | line1 text, line2 text, city text, state text, postal text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_contacts_list** | p jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_field_prose** | p_format text, p_structured jsonb, p_label text, p_value tex | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_med_schedule** | p_structured jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_pair_cost** | p_manage_structured jsonb, p_label text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_reveal_text** | p_structured jsonb, p_value text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_vet_address** | p_line1 text, p_city text, p_state text, p_postal text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compose_week_grid** | p jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compute_execution_hash** | p_body text, p_signer uuid, p_typed text, p_signed_at timest | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **compute_lease_usage** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **config_required_missing** | p_org uuid | anon, authenticated | `src/lib/api.ts` |
| **config_value** | p_ns text, p_key text | anon, authenticated | `src/lib/api.ts`, `src/lib/ops/api-lessons.ts` |
| **confirm_booking** | p_booking_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **confirm_horse_section** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **confirm_my_legal_name** | p_first text, p_last text | anon, authenticated | `src/lib/api.ts` |
| **confirm_payment_claim** | p_purchase_id uuid | authenticated | `api/orders-mark-paid.ts`, `src/lib/ops/api-payments.ts` |
| **consume_notification** | p_id uuid | anon, authenticated | `src/lib/api.ts` |
| **contact_dossier** | p_contact_id uuid | anon, authenticated | `src/lib/api.ts` |
| **contact_locations** | p_contact_id uuid | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **contact_profile_complete** | p_contact_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **contact_required_documents_state** | p_contact_id uuid | authenticated | `src/lib/admin.ts` |
| **contacts_a_seed_community_channels** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contacts_convert_lead_on_client** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contacts_file_on_insert** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contacts_file_team_on_link** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contacts_minor_no_email_guard** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contacts_normalise_phone** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **content_block_version_at** | p_slug text, p_version integer | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **content_block_version_list** | p_slug text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_caller_is_originator** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_change_log_list** | p_document_id uuid, p_limit integer | authenticated | `src/lib/contracts.ts` |
| **contract_change_requests_list** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **contract_comments_list** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_deal_type** | p_contract_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_document_detail** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_event_log** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **contract_execution_audit_get** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_horse_id** | p_contract_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_intake_requirements** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_menu_add_value** | p_template_key text, p_field_key text, p_code text, p_label  | authenticated | `src/lib/surfaceEditor.ts` |
| **contract_menu_dependents** | p_template_key text, p_field_key text, p_code text | authenticated | `src/lib/surfaceEditor.ts` |
| **contract_menu_recode** | p_template_key text, p_field_key text, p_code text, p_new_co | authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_menu_relabel** | p_template_key text, p_field_key text, p_code text, p_label  | authenticated | `src/lib/surfaceEditor.ts` |
| **contract_menu_set_active** | p_template_key text, p_field_key text, p_code text, p_active | authenticated | `src/lib/surfaceEditor.ts` |
| **contract_notes_for_document** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **contract_notification_log** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_party_options** |  | anon, authenticated | `src/lib/horses.ts` |
| **contract_redline_state** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_role_document_requirements** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **contract_section_tree** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **contract_signing_set** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **contract_signing_set_complete** | p_contract_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_split_deductible_sync** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **contract_template_structure** | p_template_key text | authenticated | `src/lib/contracts.ts` |
| **contract_template_version_at** | p_template_key text, p_version integer | anon, authenticated | `src/lib/surfaceEditor.ts` |
| **contract_template_version_list** | p_template_key text | anon, authenticated | `src/lib/surfaceEditor.ts` |
| **contracts_ensure_deal** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **create_contract_note** | p_document_id uuid, p_title text | anon, authenticated | `src/lib/contracts.ts` |
| **create_deal** | p_deal_type text, p_party_a_contact_ids uuid[], p_party_b_co | anon, authenticated | `src/lib/deals.ts` |
| **create_evaluation_report** | p_contact_id uuid, p_purchase_item_id uuid, p_horse_id uuid, | anon, authenticated | `src/lib/acquisition.ts` |
| **create_gift** | p_offering_id uuid, p_buyer_name text, p_buyer_email text, p | authenticated | `src/lib/gifts.ts` |
| **create_horse_record** | p jsonb | authenticated | `src/lib/horses.ts` |
| **create_my_purchase** | p_items jsonb | authenticated | `src/lib/api.ts` |
| **credit_ledger** | p_client_id uuid | anon, authenticated | `src/lib/ops/api-lessons.ts` |
| **credits_roster** |  | authenticated | `src/lib/ops/api-calendar.ts` |
| **current_addressed_org** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **current_client_id** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **current_contact_id** |  | anon, authenticated | `src/lib/api.ts`, `src/lib/files.ts` |
| **current_org** |  | anon, authenticated | `src/lib/grants.ts`, `src/lib/stable.ts` |
| **dash_activity_readback** | p_limit integer | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_business_kpis** |  | authenticated | `src/lib/ops/api-dashboard.ts` |
| **dash_catalog_hygiene** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_claires_plate** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_community_pulse** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_deals_contracts** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_documents_onboarding** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_evaluations_due** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_gifts** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_money_health** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_money_waiting** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_notes_loop** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_notifications** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_onboarding_pipeline** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_people_waiting** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_stable_board** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_today_plan** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_trainer_kpis** |  | authenticated | `src/lib/ops/api-dashboard.ts` |
| **dash_waiting_on_clients** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_waiting_on_you** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **dash_week_strip** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **deal_activity** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **deal_autocomplete_on_execution** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **deal_completion_state** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **deal_detail** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **deal_document_status** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **deal_governing_document** | p_deal_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **deal_governing_template** | p_deal_type text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **deal_party_roles** | p_deal_type text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **deal_record_export** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **deal_template_options** | p_deal_type text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **decide_booking_change** | p_change_id uuid, p_approve boolean, p_waive_fee boolean, p_ | authenticated | `src/lib/ops/api-calendar.ts` |
| **decline_contract_termination** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **decline_payment_claim** | p_purchase_id uuid, p_reason text | authenticated | `src/lib/ops/api-payments.ts` |
| **delete_calendar_item** | p_id uuid, p_scope text | authenticated | `src/lib/ops/api-calendar.ts` |
| **delete_contract_comment** | p_comment_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **deliver_evaluation_report** | p_report_id uuid | anon, authenticated | `src/lib/acquisition.ts` |
| **deliver_executed_document_set** | p_contact_id uuid, p_include uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **derive_request_status** | p_request_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **discard_booking_form** | p_booking_id uuid | authenticated | `src/lib/ops/api-lessons.ts` |
| **dm_delete_message** | p_message_id uuid | anon, authenticated | `src/lib/community.ts` |
| **dm_edit_message** | p_message_id uuid, p_body text | anon, authenticated | `src/lib/community.ts` |
| **dm_hide_conversation** | p_other_id uuid | anon, authenticated | `src/lib/community.ts` |
| **dm_list_conversations** |  | anon, authenticated | `src/lib/community.ts` |
| **dm_mark_conversation_read** | p_other_id uuid | anon, authenticated | `src/lib/community.ts` |
| **dm_unread_total** |  | anon, authenticated | `src/lib/community.ts` |
| **doc_status_code** | p_status text, p_workflow text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **document_changes_since_signature** | p_document_id uuid, p_contact_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **document_delivery_is_held** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **document_integrity** |  | authenticated | `src/lib/support.ts` |
| **document_parties_summary** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **document_signature_state** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **documents_send_executed_email** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **documents_sync_workflow_on_status** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **edit_change_request_entry** | p_request_id uuid, p_body text | anon, authenticated | `src/lib/contracts.ts` |
| **edit_contract_comment** | p_comment_id uuid, p_body text | anon, authenticated | `src/lib/contracts.ts` |
| **edit_form_field** | p_form_key text, p_field_key text, p_label text, p_type text | anon, authenticated | `src/lib/admin.ts` |
| **email_template_discard_draft** | p_email_key text | authenticated | `src/lib/surfaceEditor.ts` |
| **email_template_get** | p_email_key text | authenticated | `src/lib/surfaceEditor.ts` |
| **email_template_list** |  | authenticated | `src/lib/surfaceEditor.ts` |
| **email_template_publish** | p_email_key text | authenticated | `src/lib/surfaceEditor.ts` |
| **email_template_save_draft** | p_email_key text, p_subject text, p_body text | authenticated | `src/lib/surfaceEditor.ts` |
| **email_template_set_active** | p_email_key text, p_active boolean | authenticated | _no src/**/*.ts(x) caller found_ |
| **email_template_version_at** | p_email_key text, p_version integer | anon, authenticated | `src/lib/surfaceEditor.ts` |
| **email_template_version_list** | p_email_key text | anon, authenticated | `src/lib/surfaceEditor.ts` |
| **ensure_contract_role_documents** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **ensure_horse_documents** | p_horse_id uuid, p_contract_id uuid, p_include_care boolean | authenticated | `src/lib/horses.ts` |
| **ensure_my_member_access** |  | anon, authenticated | `src/contexts/AuthContext.tsx`, `src/lib/api.ts` |
| **ensure_my_membership** |  | authenticated | _no src/**/*.ts(x) caller found_ |
| **ensure_standing_slots** | p_client_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **entity_status_log** | p_entity_type text, p_entity_id uuid | anon, authenticated | `src/lib/ops/api-status.ts` |
| **feed_get** | p_limit integer, p_before timestamp with time zone | anon, authenticated | `src/lib/feed.ts` |
| **feed_mark_seen** | p_post_id uuid | anon, authenticated | `src/lib/feed.ts` |
| **feed_moderate** | p_post_id uuid, p_action text | anon, authenticated | `src/lib/feed.ts` |
| **feed_my_posts** |  | anon, authenticated | `src/lib/feed.ts` |
| **feed_post_create** | p_type feed_post_type, p_media_url text, p_media_kind feed_m | anon, authenticated | `src/lib/feed.ts` |
| **feed_post_delete** | p_id uuid | anon, authenticated | `src/lib/feed.ts` |
| **feed_post_update** | p_id uuid, p_body text, p_source_link text, p_visibility fee | anon, authenticated | `src/lib/feed.ts` |
| **feed_report_post** | p_post_id uuid, p_reason text | anon, authenticated | `src/lib/feed.ts` |
| **feed_scan_media** | p_media_url text, p_media_kind feed_media_kind | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **feed_seed_welcome** |  | anon, authenticated | `src/lib/feed.ts` |
| **feed_set_view_shape** | p_shape feed_view_shape | anon, authenticated | `src/lib/feed.ts` |
| **feed_share** | p_post_id uuid, p_to_user_id uuid | anon, authenticated | `src/lib/feed.ts` |
| **fill_claimant_details** | p_contact_id uuid, p_first_name text, p_last_name text, p_ph | authenticated | `api/sign-start.ts` |
| **fill_party_fields_from_contacts** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **finalize_purchase_payment** | p_purchase_id uuid, p_method text | authenticated | `src/lib/api.ts` |
| **find_claimable_contract** | p_email text | authenticated | `api/sign-start.ts` |
| **flush_held_executed_document_emails** | p_hold_minutes integer | authenticated | `api/delivery-sweep.ts` |
| **fmt_money** | v numeric | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **fmt_time12** | t text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **form_version_at** | p_form_key text, p_version integer | anon, authenticated | `src/lib/admin.ts` |
| **form_version_list** | p_form_key text | anon, authenticated | `src/lib/admin.ts` |
| **format_phone** | p_raw text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **freeze_signed_template_version** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **general_release_preview** | p_org uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **generate_document** | p_contact_id uuid, p_template_key text, p_contract_id uuid,  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **generate_lease_availability** | p_horse_id uuid, p_weeks integer | authenticated | `src/lib/ops/api-lease.ts` |
| **generate_monthly_lessons** | p_client_id uuid, p_purchase_item_id uuid, p_start_time text | authenticated | `src/lib/ops/api-calendar.ts` |
| **generate_my_onboarding_documents** |  | authenticated | `src/lib/api.ts` |
| **get_content_block** | p_slug text, p_context jsonb | anon, authenticated | `src/lib/contentStore.ts` |
| **gift_claim_link** | p_gift_id uuid | anon, authenticated | `src/lib/gifts.ts` |
| **gift_mark_sent** | p_gift_id uuid | anon, authenticated | `src/lib/gifts.ts` |
| **gift_reschedule** | p_gift_id uuid, p_deliver_on date | anon, authenticated | `src/lib/gifts.ts` |
| **gift_transfer** | p_gift_id uuid, p_recipient_name text, p_recipient_email tex | anon, authenticated | `src/lib/gifts.ts` |
| **grant_lesson_credit** | p_client_id uuid, p_offering_id uuid, p_quantity integer, p_ | anon, authenticated | `src/lib/ops/api-lessons.ts` |
| **grantable_offerings** |  | anon, authenticated | `src/lib/ops/api-lessons.ts` |
| **hard_delete_contract** | p_document_id uuid | anon, authenticated | `api/delete-document-with-copy.ts`, `src/lib/contracts.ts` |
| **has_module** | p_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **has_staff_access** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **hold_purchase_for_horse** | p_purchase_id uuid, p_reason text | authenticated | `src/lib/ops/api-intake.ts` |
| **horse_active_lease_doc** | p_horse_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **horse_block_caption** | v_horse horses, p_index integer | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **horse_deals** | p_horse_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **horse_field_token_value** | v_horse horses, p_field text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **horse_medications_list** | p_horse_id uuid | anon, authenticated | `src/lib/horses.ts` |
| **horse_page_detail** | p_horse_id uuid | anon, authenticated | `src/lib/horses.ts` |
| **horse_time_conflict** | p_org uuid, p_horse uuid, p_start timestamp with time zone,  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **http_request_attribution** | OUT ip text, OUT user_agent text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **inbound_open_count** |  | anon, authenticated | `src/lib/api.ts` |
| **instructor_options** |  | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **insurance_resolution_sync** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **intake_requirements** | p_channel text | anon, authenticated | `src/lib/ops/api-intake.ts`, `src/lib/ops/api-public.ts` |
| **invitation_expiry_days** | p_org uuid | anon, authenticated | `api/admin-send-invitation.ts` |
| **invitation_replacement_notice** | p_token text | anon, authenticated | `src/lib/api.ts` |
| **invite_contract_counterparty** | p_document_id uuid, p_contact_id uuid, p_email text | authenticated | `api/contract-invite.ts`, `api/sign-start.ts` |
| **invite_contract_party_account** | p_document_id uuid, p_contact_id uuid, p_email text | authenticated | `api/contract-invite.ts` |
| **is_active_member** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **is_admin** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **is_deal_governing_template** | p_deal_type text, p_template_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **is_horse_lease_template** | p_template_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **is_org_admin** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **is_platform_profile** | p_role text, p_org uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **is_protected_contact** | p_contact_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **is_super_admin** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **lease_edit_guard** | p_document_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **lease_fee_payable** | s jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **lease_participants_for_doc** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **lease_payment_options_for_doc** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **lease_reminder_sweep** |  | authenticated | `api/calendar-reminders.ts` |
| **lesson_activity** | p_client_id uuid, p_horse_id uuid, p_limit integer | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **lesson_forms** | p_scope text | authenticated | `src/lib/ops/api-lessons.ts` |
| **lesson_media** | p_booking_id uuid | authenticated | `src/lib/files.ts` |
| **lesson_plan_for_booking** | p_booking_id uuid | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **lesson_plan_next_up** | p_objectives jsonb | authenticated | _no src/**/*.ts(x) caller found_ |
| **lesson_plan_roster** |  | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **lesson_plans_for_day** | p_day date | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **line_item_hold_expired** | p_state line_item_state, p_hold_expires_at timestamp with ti | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **link_contract_to_purchase** | p_contract_id uuid, p_purchase_id uuid | anon, authenticated | `src/lib/api.ts` |
| **list_deals** |  | anon, authenticated | `src/lib/deals.ts` |
| **list_service_types** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **lock_and_sign_contract** | p_document_id uuid, p_party_role text, p_typed_name text, p_ | authenticated | `src/lib/contracts.ts` |
| **log_contract_change** | p_document_id uuid, p_change_kind text, p_field_key text, p_ | authenticated | _no src/**/*.ts(x) caller found_ |
| **log_evaluation_report_access** | p_report_id uuid, p_action text, p_detail text | anon, authenticated | `api/deliver-evaluation-report.ts`, `src/lib/acquisition.ts` |
| **log_mirror_delivery** | p_document_id uuid, p_channel text, p_copy_url text | anon, authenticated | `api/deliver-documents.ts` |
| **log_payment_request_send** | p_purchase_id uuid, p_key text, p_recipient text, p_succeede | anon, authenticated | `api/_lib/paymentRequest.ts` |
| **log_request_alert_send** | p_request_id uuid, p_key text, p_recipient text, p_succeeded | anon, authenticated | `api/inquiry-confirmation.ts`, `api/request-received.ts` |
| **log_request_alert_send** | p_request_id uuid, p_key text, p_recipient text, p_succeeded | anon, authenticated | `api/inquiry-confirmation.ts`, `api/request-received.ts` |
| **mark_booking_note_seen** | p_note_id uuid | authenticated | `src/lib/ops/api-dashboard.ts` |
| **mark_change_fee_paid** | p_change_id uuid, p_paid boolean | authenticated | `src/lib/ops/api-calendar.ts` |
| **mark_change_request_seen** | p_request_ids uuid[] | anon, authenticated | `src/lib/contracts.ts` |
| **mark_comment_review** | p_comment_id uuid, p_on boolean | anon, authenticated | `src/lib/contracts.ts` |
| **mark_comment_stale** | p_comment_id uuid, p_stale boolean | authenticated | `src/lib/contracts.ts` |
| **mark_document_opened** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **mark_document_set_delivered** | p_document_ids uuid[] | authenticated | `api/deliver-documents.ts` |
| **mark_notification_read** | p_id uuid | authenticated | `src/lib/api.ts` |
| **mark_purchase_paid** | p_purchase_id uuid, p_amount numeric, p_reference text, p_me | authenticated | `api/_lib/reconcile.ts`, `api/orders-mark-paid.ts` |
| **mark_tour_seen** | p_form_factor text | anon, authenticated | `src/lib/api.ts` |
| **med_party_who** | p_party text, p_note text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **member_directory_list** | p_user_id uuid | authenticated | `src/lib/community.ts` |
| **member_horses** | p_user_id uuid | anon, authenticated | `src/lib/community.ts` |
| **members_post_join_event** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **menu_inventory** |  | authenticated | `src/lib/admin.ts` |
| **menu_vocabulary_values** | p_key text | authenticated | `src/lib/admin.ts` |
| **mint_recurring_allotments** |  | authenticated | `api/mint-monthly-allotments.ts` |
| **mirror_admin_notification** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **money_numeric** | p_raw text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **money_shape_violation** | p_format text, p_value text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **my_acquisition_intake_state** |  | anon, authenticated | `src/lib/acquisition.ts` |
| **my_contract_documents** |  | authenticated | `src/lib/contracts.ts` |
| **my_documents** |  | anon, authenticated | `src/lib/api.ts` |
| **my_evaluation_reports** |  | anon, authenticated | `src/lib/acquisition.ts` |
| **my_executed_delivery_state** |  | authenticated | `src/lib/api.ts` |
| **my_first_lesson_state** |  | anon, authenticated | `src/lib/api.ts` |
| **my_fulfillment** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **my_gifts** |  | anon, authenticated | `src/lib/api.ts` |
| **my_hidden_pages** |  | authenticated | `src/lib/api.ts` |
| **my_horse_onboarding_state** |  | authenticated | `src/lib/horses.ts` |
| **my_inquiry_answers** |  | authenticated | `src/lib/api.ts` |
| **my_lesson_plan** |  | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **my_lesson_progress** |  | anon, authenticated | `src/lib/ops/api-member.ts` |
| **my_lesson_reports** |  | authenticated | `src/lib/ops/api-member.ts` |
| **my_lesson_sessions** |  | authenticated | `src/lib/ops/api-member.ts` |
| **my_listable_horses** | p_intent text | anon, authenticated | `src/lib/stable.ts` |
| **my_locations** |  | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **my_modules** |  | anon, authenticated | `src/lib/api.ts` |
| **my_monthly_plan** |  | anon, authenticated | `src/lib/ops/api-calendar.ts` |
| **my_name_confirmation_state** |  | anon, authenticated | `src/lib/api.ts` |
| **my_nav_presence** |  | authenticated | `src/lib/api.ts` |
| **my_notifications** | p_limit integer | authenticated | `src/lib/api.ts` |
| **my_onboarding_checklist** |  | anon, authenticated | `src/components/app/DashboardPanel.tsx` |
| **my_onboarding_state** |  | authenticated | `src/lib/api.ts` |
| **my_payments** |  | authenticated | `src/lib/paymentLedger.ts` |
| **my_pending_changes** |  | authenticated | `src/lib/ops/api-calendar.ts` |
| **my_profile_completion** |  | authenticated | `src/lib/api.ts` |
| **my_property_term** |  | anon, authenticated | `src/lib/api.ts` |
| **my_purchase_categories** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **my_stable_add_horse** | p_name text, p_barn_name text, p_breed text, p_sex text, p_h | anon, authenticated | `src/lib/stable.ts` |
| **my_stable_delete_horse** | p_id uuid | anon, authenticated | `src/lib/horses.ts`, `src/lib/stable.ts` |
| **my_stable_horses** | p_as_company boolean | anon, authenticated | `src/lib/stable.ts` |
| **my_stable_update_horse** | p_id uuid, p_barn_name text, p_breed text, p_sex text, p_hei | anon, authenticated | `src/lib/stable.ts` |
| **my_standing_categories** |  | anon, authenticated | `src/lib/api.ts` |
| **my_standing_slots** | p_purchase_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **my_unread_count** |  | authenticated | `src/lib/api.ts` |
| **my_view_surfaces** |  | anon, authenticated | `src/lib/surfaces.ts` |
| **my_wall_state** |  | anon, authenticated | `src/lib/api.ts` |
| **narrow_contact_required_documents** | p_contact_id uuid, p_keep_template_keys text[], p_reason tex | authenticated | `src/lib/admin.ts` |
| **needs** | p_label text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **normalise_phone_columns** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **normalize_person_name** | p_value text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **notification_category** | p_kind text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **notification_is_personal** | p_kind text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **notifications_capture_provenance** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **notify_review_changes** | p_document_id uuid, p_message text | anon, authenticated | `src/lib/contracts.ts` |
| **notify_staff** | p_org uuid, p_kind text, p_title text, p_link text | authenticated | `api/_lib/reconcile.ts` |
| **notify_user** | p_user_id uuid, p_kind text, p_title text, p_body text, p_li | authenticated | _no src/**/*.ts(x) caller found_ |
| **onboarding_template_options** |  | anon, authenticated | `src/lib/admin.ts` |
| **open_change_requests** |  | authenticated | `src/lib/ops/api-calendar.ts` |
| **open_document_delivery_hold** | p_org uuid, p_contact_id uuid, p_email text, p_source text | authenticated | `api/sign-release.ts` |
| **open_gift** | p_code text | anon, authenticated | `src/lib/gifts.ts` |
| **ops_day_sheet** | p_org uuid | authenticated | `api/calendar-reminders.ts` |
| **order_status_code** | p_status text, p_payment text, p_claim_status text, p_claim_ | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **org_public_config** | p_slug text | anon, authenticated | `src/lib/api.ts` |
| **owns_order** | p_order_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **party_label** | p text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **payer_candidates** |  | anon, authenticated | `src/lib/api.ts` |
| **pending_fee_candidates** |  | authenticated | `api/_lib/reconcile.ts` |
| **pending_notify_summary** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **pending_version_decisions** |  | anon, authenticated | `src/lib/api.ts` |
| **platform_set_tenant_module** | p_org_id uuid, p_module_key text, p_enabled boolean | authenticated | `src/pages/app/ops/superadmin/TenantDetailPage.tsx` |
| **platform_set_tenant_status** | p_org_id uuid, p_status text | authenticated | `src/pages/app/ops/superadmin/TenantDetailPage.tsx` |
| **platform_tenant_detail** | p_org_id uuid | authenticated | `src/pages/app/ops/superadmin/TenantDetailPage.tsx` |
| **post_contract_comment** | p_document_id uuid, p_body text, p_anchor_kind text, p_ancho | authenticated | `src/lib/contracts.ts` |
| **post_contract_note_message** | p_note_id uuid, p_body text | anon, authenticated | `src/lib/contracts.ts` |
| **profiles_link_contact** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **profiles_role_guard** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **profiles_sync_staff_profile** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **promote_buyer_from_offering** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **promote_lookup_suggestion** | p_id uuid, p_code text | anon, authenticated | `src/lib/api.ts` |
| **propose_booking_time** | p_booking_id uuid, p_new_start timestamp with time zone, p_n | authenticated | `src/lib/ops/api-calendar.ts` |
| **propose_clause** | p_document_id uuid, p_body text | authenticated | `src/lib/contracts.ts` |
| **propose_community_event** | p_title text, p_starts_at timestamp with time zone, p_ends_a | anon, authenticated | `src/lib/community.ts` |
| **propose_contract_composition** | p_document_id uuid, p_spec jsonb | authenticated | `src/lib/contracts.ts` |
| **propose_field_edit** | p_document_id uuid, p_field_key text, p_proposed_value text | authenticated | `src/lib/contracts.ts` |
| **provision_client_invitation** | p_email text, p_first_name text, p_last_name text, p_categor | anon, authenticated | `api/admin-send-invitation.ts`, `api/sign-start.ts` |
| **provision_tenant** | p_name text, p_slug text, p_tier_key text, p_admin_email tex | authenticated | `api/admin-provision-tenant.ts`, `src/lib/api.ts` |
| **public_offerings** | p_slug text | anon, authenticated | `src/lib/api.ts`, `src/lib/publicCatalog.ts` |
| **publish_open_slots** | p_weeks integer, p_slot_minutes integer | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **reap_expired_holds** |  | anon, authenticated | `api/expire-holds.ts` |
| **reassign_document_party** | p_document_id uuid, p_party_role text, p_contact_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **record_invitation_delivery** | p_invitation_id uuid, p_ok boolean, p_error text | authenticated | `api/_lib/invitationEmail.ts` |
| **record_invitation_failure** | p_token text | anon, authenticated | `src/lib/api.ts` |
| **record_invitation_resend** | p_invitation_id uuid, p_self_service boolean | authenticated | `api/_lib/invitationEmail.ts` |
| **record_lesson_progress** | p_booking_id uuid, p_answers jsonb, p_outcomes jsonb, p_next | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **record_lookup_suggestion** | p_lookup_key text, p_raw_value text | anon, authenticated | `src/lib/api.ts` |
| **record_signature** | p_document_id uuid, p_party_role text, p_typed_name text, p_ | authenticated | `src/lib/api.ts`, `src/lib/ops/api-client.ts` |
| **record_signup_alert_send** | p_attempt_id uuid, p_key text, p_recipient text, p_ok boolea | authenticated | `api/signup-help.ts` |
| **record_signup_attempt** | p_org uuid, p_email text, p_first_name text, p_last_name tex | authenticated | `api/sign-start.ts` |
| **record_template_version_bump** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **redeem_contract_invitation** | p_token text | authenticated | `src/lib/contracts.ts` |
| **redeem_gift** | p_code text | anon, authenticated | `src/lib/gifts.ts` |
| **redeem_invitation** | p_token text | anon, authenticated | `src/lib/api.ts` |
| **redeem_my_pending_invitation** |  | anon, authenticated | `src/lib/api.ts` |
| **regenerate_contract_document** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **release_preview** | p_template_key text, p_org uuid | anon, authenticated | `src/lib/ops/api-public.ts` |
| **remerge_contract_body** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **remerge_contract_from_clauses** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **remerge_contract_from_fields** | p_document_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **remove_contract_composition** | p_document_id uuid, p_field_key text | authenticated | `src/lib/contracts.ts` |
| **remove_deal_member** | p_deal_id uuid, p_party_role text, p_contact_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **remove_form_field** | p_form_key text, p_field_key text, p_from_version integer | anon, authenticated | `src/lib/admin.ts` |
| **remove_lease_participant** | p_document_id uuid, p_contact_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **remove_lease_payment_option** | p_id uuid | authenticated | _no src/**/*.ts(x) caller found_ |
| **remove_my_signature** | p_document_id uuid, p_contact_id uuid | authenticated | `src/lib/contracts.ts` |
| **rename_contract_note** | p_note_id uuid, p_title text | anon, authenticated | `src/lib/contracts.ts` |
| **reopen_change_request** | p_request_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **reopen_deal** | p_deal_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **reopen_horse_section** | p_document_id uuid | authenticated | `src/lib/contracts.ts` |
| **reply_to_change_request** | p_request_id uuid, p_body text | anon, authenticated | `src/lib/contracts.ts` |
| **report_my_payment** | p_purchase_id uuid, p_method text, p_reference text | authenticated | `src/lib/api.ts` |
| **report_order_incorrect** | p_purchase_id uuid, p_note text | authenticated | `src/lib/api.ts` |
| **request_booking_change** | p_booking_id uuid, p_kind text, p_new_start timestamp with t | authenticated | `src/lib/ops/api-calendar.ts` |
| **request_contract_termination** | p_document_id uuid, p_reason text | anon, authenticated | `src/lib/contracts.ts` |
| **request_document_change** | p_document_id uuid, p_field_key text, p_target_section text, | authenticated | `src/lib/contracts.ts` |
| **request_documents_from_contact** | p_contact_id uuid, p_template_keys text[], p_disposition tex | anon, authenticated | `api/documents-requested.ts` |
| **request_horse_intake** | p_booking_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **request_onboarding_categories** | p_request_id uuid, p_contact_id uuid, p_include_held boolean | anon, authenticated | `src/lib/admin.ts` |
| **request_open_time** | p_starts_at timestamp with time zone, p_ends_at timestamp wi | authenticated | `src/lib/ops/api-calendar.ts` |
| **request_orders** | p_request_id uuid | authenticated | `src/lib/ops/api-intake.ts` |
| **request_permission_to_edit** | p_document_id uuid, p_message text | anon, authenticated | `src/lib/contracts.ts` |
| **request_purchase_payment** | p_purchase_id uuid, p_note text | anon, authenticated | `api/order-request-payment.ts` |
| **requests_capture_contact** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **require_module** | p_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **require_resign_from** | p_template_key text, p_contact_ids uuid[], p_reason text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **required_documents_for** | p_service_type text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **required_templates_for_contact** | p_contact_id uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **reschedule_fee** | p_org uuid, p_start timestamp with time zone | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **resend_executed_document_email** | p_document_id uuid | anon, authenticated | `src/components/app/SendCopiesMenu.tsx` |
| **resolve_change_request** | p_change_id uuid, p_accept boolean, p_new_value text | authenticated | `src/lib/contracts.ts` |
| **resolve_change_request_thread** | p_request_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **resolve_clause** | p_addendum_id uuid, p_accept boolean | authenticated | `src/lib/contracts.ts` |
| **resolve_consumption_billing** | p_period tstzrange | anon, authenticated | `src/lib/api.ts`, `src/lib/ops/api-barnops.ts` |
| **resolve_contract_comment** | p_comment_id uuid, p_resolved boolean | authenticated | `src/lib/contracts.ts` |
| **resolve_field_edit** | p_document_id uuid, p_field_key text, p_accept boolean | authenticated | `src/lib/contracts.ts` |
| **resolve_pending_composition** | p_pending_id uuid, p_decision text | authenticated | `src/lib/contracts.ts` |
| **resolve_property_term** | p_org uuid | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **resolve_version_decision** | p_event_id uuid, p_resolution text, p_contact_ids uuid[] | anon, authenticated | `src/lib/api.ts` |
| **restore_content_block_version** | p_slug text, p_version integer | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **restore_contract_template_version** | p_template_key text, p_version integer | anon, authenticated | `src/lib/surfaceEditor.ts` |
| **restore_email_template_version** | p_email_key text, p_version integer | anon, authenticated | `src/lib/surfaceEditor.ts` |
| **restore_form_definition_version** | p_form_key text, p_version integer | anon, authenticated | `src/lib/admin.ts` |
| **restore_lesson_plan_version** | p_plan_id uuid | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **retired_field_section** | p_field_key text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **revenue_summary** | p_from timestamp with time zone, p_to timestamp with time zo | authenticated | `src/lib/ops/api-calendar.ts` |
| **revoke_lesson_credit_grant** | p_purchase_id uuid, p_reason text | anon, authenticated | `src/lib/ops/api-lessons.ts` |
| **rls_auto_enable** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **roster_service_slots** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **save_booking_form** | p_booking_id uuid, p_answers jsonb, p_submit boolean | authenticated | `src/lib/ops/api-lessons.ts` |
| **save_calendar_item** | p jsonb | authenticated | `src/lib/ops/api-calendar.ts` |
| **save_content_block_version** | p_slug text, p_title text, p_body text, p_kind text, p_paren | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **save_contract_template_version** | p_template_key text, p_title text, p_body text, p_parent_ver | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **save_email_template_version** | p_email_key text, p_title text, p_subject text, p_body text, | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **save_evaluation_report** | p_report_id uuid, p_body text, p_title text, p_horse_label t | anon, authenticated | `src/lib/acquisition.ts` |
| **save_form_definition_version** | p_form_key text, p_title text, p_audience text, p_purpose te | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **save_lesson_plan** | p_client_id uuid, p_focus text, p_objectives jsonb, p_coach_ | authenticated | `src/lib/ops/api-lessonplan.ts` |
| **say_hi** | p_to_user uuid | anon, authenticated | `src/lib/communityFeed.ts` |
| **say_hi_back** | p_to_user uuid | anon, authenticated | `src/lib/communityFeed.ts` |
| **schedule_lesson_session** | p_client_id uuid, p_starts_at timestamp with time zone, p_en | authenticated | `src/lib/ops/api-lessons.ts` |
| **scrub_lesson_content** | p_kind text, p_subject uuid, p_reason text, p_key text | authenticated | `src/lib/files.ts` |
| **seed_contract_fields** | p_document_id uuid, p_fields jsonb | authenticated | _no src/**/*.ts(x) caller found_ |
| **seed_contract_note** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **send_contract_to_party** | p_document_id uuid, p_party_role text | anon, authenticated | `src/lib/contracts.ts` |
| **set_booking_change_fee_schedule** | p_rows jsonb | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_booking_horse** | p_booking_id uuid, p_horse_id uuid | authenticated | `src/lib/ops/api-lessons.ts` |
| **set_booking_log** | p_booking_id uuid, p_activities jsonb, p_text text | authenticated | `src/lib/ops/api-lessons.ts` |
| **set_business_hours** | p jsonb | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_calendar_settings** | p_reschedule_fee numeric | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_contact_required_documents** | p_contact_id uuid, p_template_keys text[] | anon, authenticated | `src/lib/admin.ts` |
| **set_contact_type** | p_contact_id uuid, p_type text | anon, authenticated | `src/lib/api.ts` |
| **set_contract_field** | p_document_id uuid, p_field_key text, p_value text | authenticated | `src/lib/contracts.ts` |
| **set_dashboard_focus** | p_user_id uuid, p_focus text | authenticated | `src/lib/ops/api-dashboard.ts` |
| **set_document_co_buyer** | p_document_id uuid, p_contact_id uuid, p_first_name text, p_ | anon, authenticated | `src/lib/api.ts` |
| **set_document_party_archived** | p_document_id uuid, p_archive boolean | anon, authenticated | `src/lib/contracts.ts` |
| **set_document_party_hidden** | p_document_id uuid, p_hidden boolean | anon, authenticated | `src/lib/contracts.ts` |
| **set_field_control_override** | p_document_id uuid, p_field_key text, p_override jsonb | anon, authenticated | `src/lib/contracts.ts` |
| **set_field_included** | p_document_id uuid, p_field_key text, p_included boolean | anon, authenticated | `src/lib/contracts.ts` |
| **set_field_na** | p_document_id uuid, p_field_key text, p_is_na boolean | anon, authenticated | `src/lib/contracts.ts` |
| **set_field_responsibility** | p_document_id uuid, p_field_key text, p_responsibility jsonb | anon, authenticated | `src/lib/contracts.ts` |
| **set_field_structured** | p_document_id uuid, p_field_key text, p_structured jsonb | anon, authenticated | `src/lib/contracts.ts` |
| **set_form_field_options** | p_form_key text, p_field_key text, p_options text[], p_from_ | anon, authenticated | `src/lib/admin.ts` |
| **set_form_required** | p_form_key text, p_required jsonb, p_from_version integer | anon, authenticated | `src/lib/admin.ts` |
| **set_horse_locations** | p_horse_id uuid, p_payload jsonb | anon, authenticated | `src/lib/horses.ts` |
| **set_horse_medications** | p_horse_id uuid, p_items jsonb | anon, authenticated | `src/lib/horses.ts` |
| **set_intake_requirement** | p_channel text, p_field_key text, p_required boolean | authenticated | `src/lib/ops/api-intake.ts` |
| **set_lesson_progress_note** | p_session_id uuid, p_note text | anon, authenticated | `src/lib/ops/api-lessons.ts` |
| **set_menu_value** | p_key text, p_code text, p_display_name text, p_active boole | authenticated | `src/lib/admin.ts` |
| **set_my_onboarding_horses** | p_horse_ids uuid[], p_deferred_horse_ids uuid[] | anon, authenticated | `src/lib/api.ts` |
| **set_my_standing_schedule** | p_purchase_item_id uuid, p_slots jsonb, p_duration_minutes i | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_org_module** | p_org uuid, p_key text, p_enabled boolean, p_source text | authenticated | `src/lib/api.ts` |
| **set_page_hidden** | p_page_key text, p_hidden boolean | authenticated | `src/lib/api.ts` |
| **set_party_controls** | p_document_id uuid, p_role text, p_can_fill boolean, p_can_e | authenticated | `src/lib/contracts.ts` |
| **set_recipient_editing** | p_document_id uuid, p_on boolean | authenticated | `src/lib/contracts.ts` |
| **set_recurring_day** | p_purchase_item_id uuid, p_day text | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_recurring_days** | p_purchase_item_id uuid, p_days text[], p_weeks integer, p_i | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_recurring_plan_end** | p_purchase_item_id uuid, p_date date | authenticated | `src/lib/ops/api-calendar.ts` |
| **set_request_checklist** | p_request_id uuid, p_checklist jsonb | authenticated | `src/lib/ops/api-intake.ts` |
| **set_support_status** | p_id uuid, p_status text | anon, authenticated | `src/lib/support.ts` |
| **set_updated_at** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **share_document** | p_document_id uuid, p_with_contact_id uuid, p_recipient_edit | authenticated | `src/lib/contracts.ts` |
| **share_evaluation_report** | p_report_id uuid, p_email text, p_contact_id uuid | anon, authenticated | `src/lib/acquisition.ts` |
| **sign_general_release** | p_full_name text, p_email text, p_phone text, p_typed_name t | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **sign_release** | p_template_key text, p_first_name text, p_last_name text, p_ | anon, authenticated | `api/sign-release.ts` |
| **sign_start_register_attempt** | p_hash text, p_org uuid | anon, authenticated | `api/sign-start.ts` |
| **skip_required_document** | p_contact_id uuid, p_template_key text, p_reason text | authenticated | `src/lib/admin.ts` |
| **snapshot_execution_audit** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **sole_org** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **split_purchase** | p_purchase_id uuid, p_item_ids uuid[], p_reason text | authenticated | `src/lib/ops/api-intake.ts` |
| **staff_archive_horse** | p_id uuid | authenticated | `src/lib/horses.ts` |
| **staff_assign_documents** | p_contact_id uuid, p_template_keys text[] | anon, authenticated | `src/lib/admin.ts` |
| **staff_assign_horse_party** | p_horse_id uuid, p_role text, p_contact_id uuid, p_term_star | anon, authenticated | `src/lib/horses.ts`, `src/lib/ops/api-records.ts` |
| **staff_assignable_templates** | p_contact_id uuid | anon, authenticated | `src/lib/admin.ts` |
| **staff_contact_directory** |  | anon, authenticated | `src/lib/api.ts` |
| **staff_contact_options** |  | anon, authenticated | `src/lib/horses.ts` |
| **staff_end_horse_relationship** | p_id uuid | anon, authenticated | `src/lib/ops/api-records.ts` |
| **staff_evaluation_reports** |  | anon, authenticated | `src/lib/acquisition.ts` |
| **staff_horse_records** |  | anon, authenticated | `src/lib/horses.ts` |
| **staff_request_horse_record_completion** | p_horse_id uuid | anon, authenticated | `src/lib/horses.ts` |
| **staff_update_horse** | p_id uuid, p jsonb | anon, authenticated | `src/lib/horses.ts` |
| **start_bill_of_sale** | p_sale_document_id uuid | anon, authenticated | `src/lib/api.ts` |
| **start_bill_of_sale_standalone** | p_buyer_contact_id uuid, p_seller_contact_id uuid, p_horse_i | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **start_lease_contract_v2** | p_lessee_contact_id uuid, p_lessor_contact_id uuid, p_horse_ | authenticated | `src/lib/api.ts` |
| **start_sale_contract** | p_buyer_contact_id uuid, p_seller_contact_id uuid, p_horse_i | anon, authenticated | `src/lib/api.ts` |
| **status_feed** | p_entity_type text, p_true_only boolean, p_limit integer | anon, authenticated | `src/lib/ops/api-status.ts` |
| **submit_acquisition_intake** | p_purchase_item_id uuid, p_data jsonb | anon, authenticated | `src/lib/acquisition.ts` |
| **submit_change_requests** | p_document_id uuid | anon, authenticated | `src/lib/contracts.ts` |
| **submit_public_request** | p_first_name text, p_last_name text, p_email text, p_phone t | anon, authenticated | `src/lib/api.ts` |
| **submit_support_request** | p_subject text, p_body text | anon, authenticated | `src/lib/support.ts` |
| **suggested_category_for_contact** | p_contact_id uuid | authenticated | `src/lib/admin.ts` |
| **supersede_invitations** | p_org uuid, p_email text, p_new_invitation_id uuid | anon, authenticated | `api/admin-send-invitation.ts` |
| **swap_booking_item** | p_booking_id uuid, p_credit_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **sync_document_primary_horse** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **sync_horse_fields_to_documents** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **sync_horse_id_to_document_horses** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **sync_profile_name_from_contact** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **template_editor_clauses** | p_template_key text | authenticated | `src/lib/templateEditor.ts` |
| **template_editor_discard_drafts** | p_template_key text | authenticated | `src/lib/templateEditor.ts` |
| **template_editor_list** |  | authenticated | `src/lib/templateEditor.ts` |
| **template_editor_lockstep_keys** | p_key text | authenticated | _no src/**/*.ts(x) caller found_ |
| **template_editor_publish** | p_template_key text | authenticated | `src/lib/templateEditor.ts` |
| **template_editor_save_clause_draft** | p_clause_id uuid, p_draft text | authenticated | `src/lib/templateEditor.ts` |
| **template_editor_save_flat_draft** | p_template_key text, p_draft text | authenticated | `src/lib/templateEditor.ts` |
| **template_editor_tokens** |  | authenticated | `src/lib/templateEditor.ts` |
| **template_past_signers** | p_template_key text | anon, authenticated | `src/lib/api.ts` |
| **token_display_value** | p_token text, p_raw text, p_labels jsonb | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **transfer_payment_responsibility** | p_purchase_id uuid, p_new_payer_contact_id uuid | anon, authenticated | `src/lib/api.ts` |
| **trg_apply_affiliations_on_doc** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_apply_affiliations_on_horse** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_apply_affiliations_on_party** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_booking_unit_link** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_contacts_cascade_family_key** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_contacts_family_sort_key** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_documents_when_order_opens** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_evaluation_unit_link** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_generate_fulfillment_units** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_mint_credits_when_order_opens** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_mint_purchase_credits** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_status_bookings** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_status_documents** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_status_invitations** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_status_purchases** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **trg_wake_held_orders_on_horse** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **try_cast_uuid** | s text | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **unarchive_contact** | p_contact_id uuid | authenticated | `src/lib/api.ts` |
| **unskip_required_document** | p_contact_id uuid, p_template_key text | authenticated | `src/lib/admin.ts` |
| **update_contact_record** | p_contact_id uuid, p_patch jsonb | anon, authenticated | `src/lib/api.ts` |
| **update_contract_composition** | p_document_id uuid, p_field_key text, p_spec jsonb | authenticated | `src/lib/contracts.ts` |
| **update_deal** | p_deal_id uuid, p_deal_type text, p_notes text, p_title text | anon, authenticated | `src/lib/deals.ts` |
| **update_horse_record** | p_id uuid, p jsonb | anon, authenticated | `src/lib/horses.ts` |
| **update_my_onboarding_profile** | p jsonb | authenticated | `src/lib/api.ts` |
| **update_my_pending_booking** | p_booking_id uuid, p_new_start timestamp with time zone, p_n | authenticated | `src/lib/ops/api-calendar.ts` |
| **update_purchase_payment_method** | p_purchase_id uuid, p_method text | anon, authenticated | `src/lib/api.ts` |
| **upsert_change_request** | p_document_id uuid, p_target_section text, p_body text | anon, authenticated | `src/lib/contracts.ts` |
| **upsert_content_block** | p_slug text, p_title text, p_body text, p_kind text | anon, authenticated | `src/lib/contentStore.ts` |
| **validate_invitation** | p_token text | anon, authenticated | `src/lib/api.ts` |
| **version_rows_are_append_only** |  | anon, authenticated | _no src/**/*.ts(x) caller found_ |
| **void_deal** | p_deal_id uuid | anon, authenticated | `src/lib/deals.ts` |
| **void_document** | p_document_id uuid, p_note text | anon, authenticated | `src/lib/contracts.ts` |
| **void_purchase_item** | p_item_id uuid, p_reason text | authenticated | `src/lib/ops/api-intake.ts` |
| **withdraw_clause** | p_addendum_id uuid | authenticated | `src/lib/contracts.ts` |
| **withdraw_field_edit** | p_document_id uuid, p_field_key text | authenticated | `src/lib/contracts.ts` |
| **withdraw_my_pending_booking** | p_booking_id uuid | authenticated | `src/lib/ops/api-calendar.ts` |
| **withdraw_pending_composition** | p_pending_id uuid | authenticated | `src/lib/contracts.ts` |

---

## Trigger spines — grouped by table

### audit_logs

| trigger | fires | function |
|---|---|---|
| audit_logs_no_mutate | BEFORE DELETE | audit_logs_immutable |
### billable_lines

| trigger | fires | function |
|---|---|---|
| audit_billable_lines | AFTER INSERT | audit_row_change |
| billable_lines_block_settled_delete | BEFORE DELETE | block_settled_billable_line_delete |
| billable_lines_seal_after_settle | BEFORE UPDATE | block_settled_billable_line_update |
| billable_lines_set_updated_at | BEFORE UPDATE | set_updated_at |
### board_agreements

| trigger | fires | function |
|---|---|---|
| audit_board_agreements | AFTER INSERT | audit_row_change |
| board_agreements_set_updated_at | BEFORE UPDATE | set_updated_at |
### board_charges

| trigger | fires | function |
|---|---|---|
| audit_board_charges | AFTER INSERT | audit_row_change |
| board_charges_set_updated_at | BEFORE UPDATE | set_updated_at |
### bookings

| trigger | fires | function |
|---|---|---|
| audit_bookings | AFTER INSERT | audit_row_change |
| booking_form_lifecycle | AFTER INSERT | trg_booking_form_lifecycle |
| bookings_assign_code | BEFORE INSERT | assign_display_code |
| bookings_derive_account_contact_id | BEFORE INSERT | bookings_derive_account_contact_id |
| bookings_set_updated_at | BEFORE UPDATE | set_updated_at |
| bookings_unit_link | AFTER INSERT | trg_booking_unit_link |
| status_bookings | BEFORE INSERT | trg_status_bookings |
### business_config

| trigger | fires | function |
|---|---|---|
| audit_business_config | AFTER INSERT | audit_row_change |
| business_config_set_updated_at | BEFORE UPDATE | set_updated_at |
### clients

| trigger | fires | function |
|---|---|---|
| audit_clients | AFTER INSERT | audit_row_change |
| clients_assign_code | BEFORE INSERT | assign_display_code |
| clients_set_updated_at | BEFORE UPDATE | set_updated_at |
| contacts_convert_lead_on_client_trg | AFTER INSERT | contacts_convert_lead_on_client |
### config_values

| trigger | fires | function |
|---|---|---|
| audit_config_values | AFTER INSERT | audit_row_change |
| config_values_set_updated_at | BEFORE UPDATE | set_updated_at |
### consumption_events

| trigger | fires | function |
|---|---|---|
| audit_consumption_events | AFTER INSERT | audit_row_change |
### contacts

| trigger | fires | function |
|---|---|---|
| audit_contacts | AFTER INSERT | audit_row_change |
| contacts_a_seed_community_channels_trg | BEFORE INSERT | contacts_a_seed_community_channels |
| contacts_assign_code | BEFORE INSERT | assign_display_code |
| contacts_cascade_family_key_trg | AFTER UPDATE | trg_contacts_cascade_family_key |
| contacts_family_sort_key_trg | BEFORE INSERT | trg_contacts_family_sort_key |
| contacts_file_on_insert_trg | BEFORE INSERT | contacts_file_on_insert |
| contacts_minor_no_email_guard_trg | BEFORE INSERT | contacts_minor_no_email_guard |
| contacts_normalise_account_info_phone_trg | BEFORE INSERT | normalise_phone_columns |
| contacts_normalise_ec_phone_trg | BEFORE INSERT | normalise_phone_columns |
| contacts_normalise_phone_trg | BEFORE INSERT | contacts_normalise_phone |
| contacts_set_updated_at | BEFORE UPDATE | set_updated_at |
| sync_profile_name_from_contact_trg | AFTER UPDATE | sync_profile_name_from_contact |
### content_block_versions

| trigger | fires | function |
|---|---|---|
| content_block_versions_append_only | BEFORE DELETE | version_rows_are_append_only |
### content_posts

| trigger | fires | function |
|---|---|---|
| content_posts_set_updated_at | BEFORE UPDATE | set_updated_at |
### contract_fields

| trigger | fires | function |
|---|---|---|
| contract_fields_set_updated_at | BEFORE UPDATE | set_updated_at |
| contract_fields_split_sync | AFTER UPDATE | contract_split_deductible_sync |
### contract_template_versions

| trigger | fires | function |
|---|---|---|
| contract_template_versions_append_only | BEFORE DELETE | version_rows_are_append_only |
### contract_templates

| trigger | fires | function |
|---|---|---|
| audit_contract_templates | AFTER INSERT | audit_row_change |
| contract_templates_set_updated_at | BEFORE UPDATE | set_updated_at |
| record_template_version_bump_trg | AFTER UPDATE | record_template_version_bump |
### contracts

| trigger | fires | function |
|---|---|---|
| contracts_assign_code | BEFORE INSERT | assign_display_code |
| contracts_ensure_deal_trg | AFTER INSERT | contracts_ensure_deal |
| contracts_set_updated_at | BEFORE UPDATE | set_updated_at |
### cost_allocation_rules

| trigger | fires | function |
|---|---|---|
| audit_cost_allocation_rules | AFTER INSERT | audit_row_change |
| cost_allocation_rules_set_updated_at | BEFORE UPDATE | set_updated_at |
### deals

| trigger | fires | function |
|---|---|---|
| deals_assign_code | BEFORE INSERT | assign_display_code |
| deals_set_updated_at | BEFORE UPDATE | set_updated_at |
### document_deliveries

| trigger | fires | function |
|---|---|---|
| audit_document_deliveries | AFTER INSERT | audit_row_change |
### document_horses

| trigger | fires | function |
|---|---|---|
| trg_sync_document_primary_horse | AFTER INSERT | sync_document_primary_horse |
### document_parties

| trigger | fires | function |
|---|---|---|
| document_parties_apply_affiliations | AFTER INSERT | trg_apply_affiliations_on_party |
### documents

| trigger | fires | function |
|---|---|---|
| audit_documents | AFTER INSERT | audit_row_change |
| contract_execution_effects_trg | AFTER UPDATE | apply_contract_execution_effects |
| deal_autocomplete_trg | AFTER UPDATE | deal_autocomplete_on_execution |
| documents_apply_affiliations | AFTER INSERT | trg_apply_affiliations_on_doc |
| documents_apply_supersession | AFTER UPDATE | apply_document_supersession |
| documents_assign_code | BEFORE INSERT | assign_random_document_code |
| documents_send_executed_email_trg | AFTER UPDATE | documents_send_executed_email |
| documents_set_updated_at | BEFORE UPDATE | set_updated_at |
| freeze_signed_template_version_trg | BEFORE UPDATE | freeze_signed_template_version |
| seed_contract_note_trg | AFTER INSERT | seed_contract_note |
| status_documents | BEFORE INSERT | trg_status_documents |
| trg_documents_sync_workflow | BEFORE INSERT | documents_sync_workflow_on_status |
| trg_snapshot_execution_audit | AFTER UPDATE | snapshot_execution_audit |
| trg_sync_horse_id_to_document_horses | AFTER INSERT | sync_horse_id_to_document_horses |
### email_template_versions

| trigger | fires | function |
|---|---|---|
| email_template_versions_append_only | BEFORE DELETE | version_rows_are_append_only |
### email_templates

| trigger | fires | function |
|---|---|---|
| audit_email_templates | AFTER INSERT | audit_row_change |
| email_templates_set_updated_at | BEFORE UPDATE | set_updated_at |
### evaluation_reports

| trigger | fires | function |
|---|---|---|
| evaluation_reports_set_updated | BEFORE UPDATE | set_updated_at |
| evaluation_reports_unit_link | AFTER UPDATE | trg_evaluation_unit_link |
### facilities

| trigger | fires | function |
|---|---|---|
| audit_facilities | AFTER INSERT | audit_row_change |
| facilities_set_updated_at | BEFORE UPDATE | set_updated_at |
### form_definition_versions

| trigger | fires | function |
|---|---|---|
| form_definition_versions_append_only | BEFORE DELETE | version_rows_are_append_only |
### form_definitions

| trigger | fires | function |
|---|---|---|
| form_definitions_set_updated_at | BEFORE UPDATE | set_updated_at |
### groups

| trigger | fires | function |
|---|---|---|
| audit_contact_roles | AFTER INSERT | audit_row_change |
### horse_health_events

| trigger | fires | function |
|---|---|---|
| audit_horse_health_events | AFTER INSERT | audit_row_change |
| horse_health_events_set_updated_at | BEFORE UPDATE | set_updated_at |
### horse_medications

| trigger | fires | function |
|---|---|---|
| horse_medications_normalise_phone_trg | BEFORE INSERT | normalise_phone_columns |
### horse_relationships

| trigger | fires | function |
|---|---|---|
| audit_horse_relationships | AFTER INSERT | audit_row_change |
### horses

| trigger | fires | function |
|---|---|---|
| audit_horses | AFTER INSERT | audit_row_change |
| horses_apply_affiliations | AFTER INSERT | trg_apply_affiliations_on_horse |
| horses_assign_code | BEFORE INSERT | assign_display_code |
| horses_normalise_phone_trg | BEFORE INSERT | normalise_phone_columns |
| horses_set_updated_at | BEFORE UPDATE | set_updated_at |
| horses_sync_contract_fields | AFTER UPDATE | sync_horse_fields_to_documents |
| horses_wake_held_orders | AFTER INSERT | trg_wake_held_orders_on_horse |
### invitations

| trigger | fires | function |
|---|---|---|
| status_invitations | BEFORE INSERT | trg_status_invitations |
### lesson_credits

| trigger | fires | function |
|---|---|---|
| audit_lesson_credits | AFTER INSERT | audit_row_change |
| lesson_credits_set_updated_at | BEFORE UPDATE | set_updated_at |
### lesson_packages

| trigger | fires | function |
|---|---|---|
| audit_lesson_packages | AFTER INSERT | audit_row_change |
| lesson_packages_set_updated_at | BEFORE UPDATE | set_updated_at |
### members

| trigger | fires | function |
|---|---|---|
| trg_members_post_join_event | AFTER INSERT | members_post_join_event |
### notifications

| trigger | fires | function |
|---|---|---|
| trg_mirror_admin_notification | AFTER INSERT | mirror_admin_notification |
| trg_notifications_provenance | BEFORE INSERT | notifications_capture_provenance |
### org_modules

| trigger | fires | function |
|---|---|---|
| audit_org_modules | AFTER INSERT | audit_row_change |
| org_modules_set_updated_at | BEFORE UPDATE | set_updated_at |
### org_page_visibility

| trigger | fires | function |
|---|---|---|
| audit_org_page_visibility | AFTER INSERT | audit_row_change |
### organizations

| trigger | fires | function |
|---|---|---|
| audit_organizations | AFTER INSERT | audit_row_change |
| organizations_set_code | BEFORE INSERT | assign_display_code |
| organizations_set_updated_at | BEFORE UPDATE | set_updated_at |
### payments

| trigger | fires | function |
|---|---|---|
| payments_assign_code | BEFORE INSERT | assign_display_code |
| payments_set_updated_at | BEFORE UPDATE | set_updated_at |
### product_prices

| trigger | fires | function |
|---|---|---|
| audit_product_prices | AFTER INSERT | audit_row_change |
| product_prices_set_updated_at | BEFORE UPDATE | set_updated_at |
### products

| trigger | fires | function |
|---|---|---|
| audit_products | AFTER INSERT | audit_row_change |
| products_set_updated_at | BEFORE UPDATE | set_updated_at |
### profiles

| trigger | fires | function |
|---|---|---|
| bookings_claim_on_account_link_trg | AFTER INSERT | bookings_claim_on_account_link |
| contacts_file_team_on_link_trg | AFTER INSERT | contacts_file_team_on_link |
| profiles_link_contact_trg | AFTER INSERT | profiles_link_contact |
| profiles_role_guard_trg | BEFORE UPDATE | profiles_role_guard |
| profiles_set_updated_at | BEFORE UPDATE | set_updated_at |
| trg_profiles_sync_staff_profile | AFTER INSERT | profiles_sync_staff_profile |
### purchase_items

| trigger | fires | function |
|---|---|---|
| purchase_items_generate_units | AFTER INSERT | trg_generate_fulfillment_units |
| purchase_items_mint_credits | AFTER INSERT | trg_mint_purchase_credits |
| purchase_items_promote_buyer | AFTER INSERT | promote_buyer_from_offering |
### purchases

| trigger | fires | function |
|---|---|---|
| purchases_assign_code | BEFORE INSERT | assign_display_code |
| purchases_assign_documents | AFTER UPDATE | trg_documents_when_order_opens |
| purchases_mint_credits | AFTER UPDATE | trg_mint_credits_when_order_opens |
| purchases_set_updated_at | BEFORE UPDATE | set_updated_at |
| status_purchases | BEFORE INSERT | trg_status_purchases |
### requests

| trigger | fires | function |
|---|---|---|
| requests_capture_contact_trg | AFTER INSERT | requests_capture_contact |
| requests_normalise_phone_trg | BEFORE INSERT | normalise_phone_columns |
### resource_lots

| trigger | fires | function |
|---|---|---|
| audit_resource_lots | AFTER INSERT | audit_row_change |
| resource_lots_set_updated_at | BEFORE UPDATE | set_updated_at |
### resources

| trigger | fires | function |
|---|---|---|
| audit_resources | AFTER INSERT | audit_row_change |
| resources_set_updated_at | BEFORE UPDATE | set_updated_at |
### service_type_document_requirements

| trigger | fires | function |
|---|---|---|
| stdr_template_must_be_satisfiable | BEFORE INSERT | assert_template_is_satisfiable |
### shifts

| trigger | fires | function |
|---|---|---|
| audit_shifts | AFTER INSERT | audit_row_change |
| shifts_set_updated_at | BEFORE UPDATE | set_updated_at |
### sign_path_document_requirements

| trigger | fires | function |
|---|---|---|
| spdr_template_must_be_satisfiable | BEFORE INSERT | assert_template_is_satisfiable |
### signatures

| trigger | fires | function |
|---|---|---|
| audit_signatures | AFTER INSERT | audit_row_change |
| signatures_seal_after_sign | BEFORE UPDATE | block_signed_signature_update |
### stalls

| trigger | fires | function |
|---|---|---|
| audit_stalls | AFTER INSERT | audit_row_change |
| stalls_set_updated_at | BEFORE UPDATE | set_updated_at |
### template_variants

| trigger | fires | function |
|---|---|---|
| template_variants_set_updated_at | BEFORE UPDATE | set_updated_at |
### time_entries

| trigger | fires | function |
|---|---|---|
| audit_time_entries | AFTER INSERT | audit_row_change |
| time_entries_set_updated_at | BEFORE UPDATE | set_updated_at |
### vendors

| trigger | fires | function |
|---|---|---|
| vendors_normalise_phone_trg | BEFORE INSERT | normalise_phone_columns |

