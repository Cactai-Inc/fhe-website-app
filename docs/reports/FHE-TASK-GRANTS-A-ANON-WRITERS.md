# 🔒 THE ANON-WRITER LIST — the owner rules, per block

**For `FHE-MGMT-GRANTS` to put in front of the owner. Bundle `docs/orch/BUNDLE-GRANTS.md`, pre-registered
escalation 1: _"Which anon-executable writers are LEGITIMATELY anon."_**
**Measured by `FHE-TASK-GRANTS-A` against PRODUCTION on 2026-09-03, 07:05–07:22 PDT.** Nothing here is
inherited from a document; every number carries the query or the `file:line` that produced it.

> **WHAT "anon-executable" MEANS AND DOES NOT MEAN.** It means the Postgres role `anon` holds EXECUTE on
> the function, so a logged-out browser holding only the public anon key could call it over PostgREST.
> **It does NOT mean anything calls it that way today** — most of this list has no anonymous caller at
> all. The risk is that the door is open, not that somebody is walking through it.
> **Nothing was probed by calling it. Probing a writer writes production** (bundle §"pre-registered
> escalation"); `has_function_privilege('anon', oid, 'execute')` is the probe used throughout.

## THE ONE QUESTION FOR YOU

**Block A (140 functions) — REVOKE as one block?** None of them has an anonymous caller. Say yes and the
build revokes all 140 in one migration. 134 are in the table below; the other 6 are itemised in §C
because they sit on a page a logged-out person can open — but never run without a session.
**Block B (3 functions) — one ruling each.** Two must KEEP `anon` (the contact form, and the gift
reveal a recipient opens before they have an account). The third is recommended REVOKE with the
evidence set out, so a "no" from you is one word.

---

## THE POPULATION, RE-MEASURED

```sql
select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as fn,
       coalesce(array_to_string(p.proacl,','),'<NULL=default: PUBLIC EXECUTE>') as proacl,
       has_function_privilege('anon',p.oid,'execute') as anon,
       has_function_privilege('authenticated',p.oid,'execute') as authed,
       p.prokind, p.provolatile, (p.prorettype='trigger'::regtype) as is_trg
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 1;
```

| | count | in this list? |
|---|---|---|
| `SECURITY DEFINER` functions in `public` | **675** | |
| …of which `anon` can EXECUTE | **326** | |
| — trigger functions (inert: a trigger function cannot be invoked through the API) | **45** | no — revoked in the migration under their own heading, never escalated |
| — `rls_auto_enable()`, an **event_trigger** function (equally inert; a `prorettype='trigger'` test misses it) | **1** | no — same treatment |
| — **callable, and the BODY writes** | **145** | ✅ **this list** — 140 Block A · 3 Block B · 2 already ruled (items 1 and 2) |
| — callable readers (no write in the body, one level deep) | **135** | no — out of this bundle (2 exceptions, §D) |

**The writer test was the BODY, not `provolatile`.** Every one of the 326 bodies was pulled with
`pg_get_functiondef` and searched, comments stripped, for `INSERT` / `UPDATE … ` / `DELETE FROM` /
`TRUNCATE` / `MERGE` / DDL / `pg_notify` / `set_config` / `nextval`, plus one level of callee resolution
across all 764 functions in `public`. **No function on this list was classified by its name.**
⚠️ 18 of the 145 write only through a callee — the callee is named in their row.
⚠️ **A `STABLE` function that writes would have been caught: there were none.** Two writers were
initially missed by an `update <table> set` regex that does not match `UPDATE gifts g SET …` —
`open_gift` and `_restore_contract_template_composition`. Both are on this list.

---

## BLOCK A — no anonymous caller. One ruling covers all 140 (134 here + the 6 in §C).

**Why they are safe to revoke, established by reading, not assumed:**
1. **Every `api/*.ts` handler runs as `service_role`** (`api/_lib/supabaseAdmin.ts:15` — the service-role
   key). Four files build a second client from the anon key **plus the signed-in user's bearer token**
   (`api/order-request-payment.ts:26-33`, `api/orders-mark-paid.ts`, `api/delete-document-with-copy.ts`,
   `api/email-change-complete.ts`) — that client runs as **`authenticated`**, never `anon`.
   🔒 **No serverless handler in this repo has ever called a function as `anon`.**
2. **The browser client is `anon` only while logged out.** The 23 routes a logged-out person can reach
   were taken from `src/App.tsx:155-243` (every route outside `<ProtectedRoute>`), their import graph
   resolved to 98 modules, and every writer-calling wrapper those modules import was traced to its call
   site. **Nine writers came out of that trace; each was read by hand.** They are in Block B and §C.
3. **12 of the 140 have no call site anywhere in `src` or `api`** — nothing calls them at all.

| `function(signature)` | writes | internal guard | call sites | anonymous surface? | recommendation |
|---|---|---|---|---|---|
| `_restore_contract_template_composition(p_template_key text, p_composition jsonb)` | `contract_clause_defs`, `contract_field_defs`, `contract_section_defs` | **none** | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `apply_offering_documents(p_contact_id uuid, p_disposition text)` | `contact_required_documents` | **none** | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `insurance_resolution_sync(p_document_id uuid)` | `notifications` · via `resolve_notifications_for_link`: `audit_logs` | `current_org()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `publish_open_slots(p_weeks integer, p_slot_minutes integer)` | via `_publish_open_slots_for_org`: `bookings` | `has_staff_access()`, `current_org()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `reopen_deal(p_deal_id uuid)` | `audit_logs`, `contracts`, `deals` | `has_staff_access()`, `auth.uid()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `require_resign_from(p_template_key text, p_contact_ids uuid[], p_reason text)` | `contact_required_documents`, `documents` · via `log_status_event`: `bookings`, `invitations`, `purchases` | `has_staff_access()`, `current_org()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `restore_content_block_version(p_slug text, p_version integer)` | via `save_content_block_version`: `content_block_versions`, `content_blocks` | `current_org()`, `profiles.is_admin` / `has_admin_access()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `save_content_block_version(p_slug text, p_title text, p_body text, p_kind text, p_parent_version integer)` | `content_block_versions`, `content_blocks` | `auth.uid()`, `current_org()`, `profiles.is_admin` / `has_admin_access()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `save_contract_template_version(p_template_key text, p_title text, p_body text, p_parent_version integer)` | `contract_template_versions`, `contract_templates` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `save_email_template_version(p_email_key text, p_title text, p_subject text, p_body text, p_parent_version integer)` | `email_template_versions`, `email_templates` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `save_form_definition_version(p_form_key text, p_title text, p_audience text, p_purpose text, p_schema jsonb, p_parent_version integer)` | `form_definition_versions`, `form_definitions` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `start_bill_of_sale_standalone(p_buyer_contact_id uuid, p_seller_contact_id uuid, p_horse_id uuid)` | `contract_fields`, `contract_parties`, `contracts` · via `attach_horse_to_document`, `bos_generate_document`: `documents`, `set` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | **none** | no — no call site anywhere in `src`/`api` | REVOKE anon |
| `acknowledge_content_block(p_slug text)` | `content_acknowledgments` | `auth.uid()`, `current_org()` | `src/lib/contentStore.ts:51` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `add_contact_location(p_contact_id uuid, p_name text, p_address text)` | `locations` | `has_staff_access()`, `current_org()` | `src/lib/ops/api-calendar.ts:129` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `add_deal_document(p_deal_id uuid, p_template_key text, p_has_sale_agreement text)` | `contract_fields`, `document_party_controls`, `documents` · via `attach_horse_to_document`, `fill_party_fields_from_contacts`: `document_horses`, `document_parties`, `set` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/lib/deals.ts:208` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `add_deal_member(p_deal_id uuid, p_party_role text, p_contact_id uuid)` | `contract_parties` | `has_staff_access()`, `auth.uid()` | `src/lib/deals.ts:156` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `add_form_field(p_form_key text, p_section_heading text, p_key text, p_label text, p_type text, p_options text[], p_from_version integer)` | via `save_form_definition_version`: `form_definition_versions`, `form_definitions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/admin.ts:1246` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `add_my_location(p_name text, p_address text)` | `locations` | `current_contact_id()`, `current_org()` | `src/lib/ops/api-calendar.ts:112` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `agree_change_request(p_request_id uuid, p_agreed boolean)` | `contract_change_requests` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:1407` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `apply_sign_path_documents(p_contact_id uuid, p_path text)` | `contact_required_documents` | **none** | `api/sign-start.ts:401` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `approve_contract_review(p_document_id uuid)` | `status_events` · via `advance_document_workflow`: `documents`, `notifications`, `signatures` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/contracts.ts:476` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `approve_contract_termination(p_document_id uuid)` | `documents`, `notifications` · via `notify_staff`, `resolve_notifications_for_link`: `audit_logs` | `auth.uid()`, `current_contact_id()` | `src/lib/contracts.ts:958` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `archive_contract(p_document_id uuid, p_archive boolean)` | `documents` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:922` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `assign_horse_section(p_document_id uuid, p_role text)` | `contract_fields` | `has_staff_access()`, `current_org()` | `src/lib/contracts.ts:689` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `attach_horse_to_document(p_document_id uuid, p_horse_id uuid)` | `contract_fields`, `documents` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:1132` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `capture_horse_record_info(p_document_id uuid, p_patch jsonb)` | `contract_fields`, `horses` | `has_staff_access()`, `current_org()` | `src/lib/contracts.ts:891` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `claim_document_origination(p_document_id uuid)` | `documents` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:683` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `company_contact_id()` | `contacts`, `organizations` | `current_org()` | `src/lib/horses.ts:336` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `complete_deal(p_deal_id uuid)` | `contracts`, `deals` | **none** | `src/lib/deals.ts:241` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `confirm_my_legal_name(p_first text, p_last text)` | `contacts` | `current_contact_id()` | `src/lib/api.ts:908` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `consume_notification(p_id uuid)` | `audit_logs`, `notifications` · via `_log_notification_resolution`: `notification_log` | `auth.uid()` | `src/lib/api.ts:519` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `create_contract_note(p_document_id uuid, p_title text)` | `contract_notes` | `has_staff_access()`, `current_contact_id()` | `src/lib/contracts.ts:1600` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `create_deal(p_deal_type text, p_party_a_contact_ids uuid[], p_party_b_contact_ids uuid[], p_notes text, p_title text, p_horse_id uuid)` | `contracts` · via `add_deal_member`, `ensure_deal_for_contract`: `contract_parties`, `deals` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/deals.ts:115` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `create_evaluation_report(p_contact_id uuid, p_purchase_item_id uuid, p_horse_id uuid, p_title text)` | `evaluation_reports` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/acquisition.ts:119` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `decline_contract_termination(p_document_id uuid)` | `documents`, `notifications` · via `resolve_notifications_for_link`: `audit_logs` | `auth.uid()` | `src/lib/contracts.ts:963` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `delete_contract_comment(p_comment_id uuid)` | `contract_change_requests` | `auth.uid()` | `src/lib/contracts.ts:1529` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `deliver_evaluation_report(p_report_id uuid)` | `evaluation_reports`, `notifications` | `has_staff_access()`, `current_org()` | `src/lib/acquisition.ts:141` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `dm_delete_message(p_message_id uuid)` | `direct_messages` | `auth.uid()` | `src/lib/community.ts:233` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `dm_edit_message(p_message_id uuid, p_body text)` | `direct_messages` | `auth.uid()` | `src/lib/community.ts:227` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `dm_hide_conversation(p_other_id uuid)` | `dm_hidden_conversations` | `auth.uid()` | `src/lib/community.ts:239` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `dm_mark_conversation_read(p_other_id uuid)` | `direct_messages` | `auth.uid()` | `src/lib/community.ts:221` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `edit_change_request_entry(p_request_id uuid, p_body text)` | `contract_change_requests` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:1374` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `edit_contract_comment(p_comment_id uuid, p_body text)` | `contract_change_requests` | `auth.uid()`, `current_contact_id()` | `src/lib/contracts.ts:1525` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `edit_form_field(p_form_key text, p_field_key text, p_label text, p_type text, p_new_key text, p_from_version integer)` | via `save_form_definition_version`: `form_definition_versions`, `form_definitions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/admin.ts:1262` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_mark_seen(p_post_id uuid)` | `feed_seen` | `auth.uid()` | `src/lib/feed.ts:90` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_moderate(p_post_id uuid, p_action text)` | `feed_posts` | `profiles.is_admin` / `has_admin_access()` | `src/lib/feed.ts:154` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_post_create(p_type feed_post_type, p_media_url text, p_media_kind feed_media_kind, p_body text, p_source_link text, p_subject_horse_id uuid, p_as_company boolean, p_visibility feed_visibility, p_publish_at timestamp with time zone)` | `feed_posts` | `auth.uid()`, `current_org()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/feed.ts:74` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_post_delete(p_id uuid)` | `feed_posts` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/feed.ts:134` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_post_update(p_id uuid, p_body text, p_source_link text, p_visibility feed_visibility)` | `feed_posts` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/feed.ts:123` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_report_post(p_post_id uuid, p_reason text)` | `feed_posts` | `auth.uid()` | `src/lib/feed.ts:149` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_seed_welcome()` | `feed_account_items` | `auth.uid()`, `current_org()` | `src/lib/feed.ts:50` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_set_view_shape(p_shape feed_view_shape)` | `feed_view_pref` | `auth.uid()` | `src/lib/feed.ts:139` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `feed_share(p_post_id uuid, p_to_user_id uuid)` | `feed_shares` | `auth.uid()`, `current_org()` | `src/lib/feed.ts:144` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `gift_mark_sent(p_gift_id uuid)` | `gifts` | `has_staff_access()`, `auth.uid()` | `src/lib/gifts.ts:189` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `gift_reschedule(p_gift_id uuid, p_deliver_on date)` | `gifts` | `has_staff_access()`, `auth.uid()` | `src/lib/gifts.ts:173` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `gift_transfer(p_gift_id uuid, p_recipient_name text, p_recipient_email text)` | `gifts` | `has_staff_access()`, `auth.uid()` | `src/lib/gifts.ts:179` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `grant_lesson_credit(p_client_id uuid, p_offering_id uuid, p_quantity integer, p_mode text, p_reason text, p_payment_method text, p_paid_at timestamp with time zone)` | `purchase_items`, `purchases` · via `_mint_credits_for_purchase_item`, `log_status_event`: `bookings`, `documents`, `invitations` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/ops/api-lessons.ts:376` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `hard_delete_contract(p_document_id uuid)` | `contract_addenda`, `contract_change_requests`, `contract_fields`, `contract_parties`, `contracts` | `has_staff_access()`, `current_org()` | `src/lib/contracts.ts:928` · `api/delete-document-with-copy.ts:132` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `link_contract_to_purchase(p_contract_id uuid, p_purchase_id uuid)` | `contracts` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/api.ts:2354` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `log_evaluation_report_access(p_report_id uuid, p_action text, p_detail text)` | `evaluation_report_access` | `auth.uid()` | `src/lib/acquisition.ts:174` · `src/lib/acquisition.ts:180` · `api/deliver-evaluation-report.ts:123` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `log_mirror_delivery(p_document_id uuid, p_channel text, p_copy_url text)` | `document_deliveries` · via `company_contact_id`: `contacts`, `organizations` | **none** | `api/deliver-documents.ts:471` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `log_payment_request_send(p_purchase_id uuid, p_key text, p_recipient text, p_succeeded boolean, p_amount_due numeric, p_error text, p_message_id text, p_requested_by uuid)` | `payment_request_sends` | `auth.uid()` | `api/_lib/paymentRequest.ts:49` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `log_request_alert_send(p_request_id uuid, p_key text, p_recipient text, p_succeeded boolean, p_error text, p_message_id text, p_kind text)` | `request_alert_sends` | **none** | `api/request-received.ts:161` · `api/inquiry-confirmation.ts:100` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `mark_change_request_seen(p_request_ids uuid[])` | `contract_change_request_seen` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:1333` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `mark_comment_review(p_comment_id uuid, p_on boolean)` | `contract_change_requests` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:1533` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `mark_document_opened(p_document_id uuid)` | `document_opened` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:1343` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `mark_tour_seen(p_form_factor text)` | `profiles` | `auth.uid()` | `src/lib/api.ts:2606` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `my_stable_add_horse(p_name text, p_barn_name text, p_breed text, p_sex text, p_height text, p_dob date, p_color text, p_location text, p_notes text, p_markings text, p_as_company boolean)` | via `company_contact_id`, `create_horse_record`: `contacts`, `horse_reconciliation`, `horse_relationships` | `has_staff_access()` | `src/lib/stable.ts:128` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `my_stable_delete_horse(p_id uuid)` | `horses` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/stable.ts:162` · `src/lib/horses.ts:187` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `my_stable_update_horse(p_id uuid, p_barn_name text, p_breed text, p_sex text, p_height text, p_color text, p_location text)` | `horses` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/stable.ts:150` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `notify_review_changes(p_document_id uuid, p_message text)` | `notifications` · via `log_contract_change`: `contract_change_log` | `auth.uid()`, `current_contact_id()` | `src/lib/contracts.ts:1668` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `post_contract_note_message(p_note_id uuid, p_body text)` | `contract_note_messages`, `contract_notes` | `has_staff_access()`, `current_contact_id()` | `src/lib/contracts.ts:1615` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `promote_lookup_suggestion(p_id uuid, p_code text)` | `horse_breeds`, `horse_colors`, `lookup_options`, `lookup_suggestions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/api.ts:1336` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `propose_community_event(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_description text)` | `events` | `has_staff_access()`, `current_org()` | `src/lib/community.ts:360` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `provision_client_invitation(p_email text, p_first_name text, p_last_name text, p_categories text[], p_offering_ids uuid[], p_template_keys text[], p_mark_paid boolean, p_payment_method text, p_notes text, p_request_id uuid, p_org_id uuid, p_partial_amount numeric, p_phone text, p_agreed_lesson jsonb, p_send boolean)` | `clients`, `contact_required_documents`, `contacts`, `invitations`, `purchases` · via `_ensure_client_account`, `_provision_purchase_for_offerings`: `audit_logs`, `bookings`, `documents` | `has_staff_access()`, `auth.uid()`, `current_org()` | `api/admin-send-invitation.ts:310` · `api/sign-start.ts:357` · `api/request-activation.ts:119` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `reassign_document_party(p_document_id uuid, p_party_role text, p_contact_id uuid)` | `contract_fields`, `contract_parties`, `document_parties` · via `fill_party_fields_from_contacts`, `remerge_contract_from_clauses`: `documents`, `set` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:698` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `record_lookup_suggestion(p_lookup_key text, p_raw_value text)` | `lookup_suggestions` | `auth.uid()`, `current_org()` | `src/lib/api.ts:1317` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `redeem_my_pending_invitation()` | via `redeem_invitation`: `contacts`, `invitations`, `members` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/api.ts:217` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `remove_deal_member(p_deal_id uuid, p_party_role text, p_contact_id uuid)` | `contract_parties` | `has_staff_access()`, `auth.uid()` | `src/lib/deals.ts:163` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `remove_form_field(p_form_key text, p_field_key text, p_from_version integer)` | via `save_form_definition_version`: `form_definition_versions`, `form_definitions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/admin.ts:1275` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `rename_contract_note(p_note_id uuid, p_title text)` | `contract_notes` | `has_staff_access()`, `current_contact_id()` | `src/lib/contracts.ts:1608` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `reopen_change_request(p_request_id uuid)` | via `agree_change_request`: `contract_change_requests` | **none** | `src/lib/contracts.ts:1391` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `reply_to_change_request(p_request_id uuid, p_body text)` | `contract_change_requests` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:1398` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `request_contract_termination(p_document_id uuid, p_reason text)` | `documents`, `notifications` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:953` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `request_documents_from_contact(p_contact_id uuid, p_template_keys text[], p_disposition text)` | `contact_required_documents` · via `notify_user`: `notifications` | `has_staff_access()` | `api/documents-requested.ts:89` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `request_permission_to_edit(p_document_id uuid, p_message text)` | `notifications` · via `log_contract_change`: `contract_change_log` | `auth.uid()`, `current_contact_id()` | `src/lib/contracts.ts:1657` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `resend_executed_document_email(p_document_id uuid)` | `documents` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/components/app/SendCopiesMenu.tsx:112` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `resolve_change_request_thread(p_request_id uuid)` | via `agree_change_request`: `contract_change_requests` | **none** | `src/lib/contracts.ts:1383` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `resolve_consumption_billing(p_period tstzrange)` | `billable_lines` | `auth.uid()`, `current_org()`, `require_module()` | `src/lib/api.ts:1998` · `src/lib/ops/api-barnops.ts:319` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `resolve_version_decision(p_event_id uuid, p_resolution text, p_contact_ids uuid[])` | `template_version_events` · via `require_resign_from`: `contact_required_documents`, `documents` | `has_staff_access()`, `auth.uid()` | `src/lib/api.ts:952` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `restore_contract_template_version(p_template_key text, p_version integer)` | via `_restore_contract_template_composition`, `save_contract_template_version`: `contract_clause_defs`, `contract_field_defs`, `contract_section_defs` | `profiles.is_admin` / `has_admin_access()` | `src/lib/surfaceEditor.ts:197` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `restore_email_template_version(p_email_key text, p_version integer)` | via `save_email_template_version`: `email_template_versions`, `email_templates` | `profiles.is_admin` / `has_admin_access()` | `src/lib/surfaceEditor.ts:304` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `restore_form_definition_version(p_form_key text, p_version integer)` | via `save_form_definition_version`: `form_definition_versions`, `form_definitions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/admin.ts:1360` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `revoke_lesson_credit_grant(p_purchase_id uuid, p_reason text)` | `lesson_credits`, `purchases` · via `log_status_event`, `resolve_notifications_for_link`: `audit_logs`, `bookings`, `documents` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/ops/api-lessons.ts:394` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `save_evaluation_report(p_report_id uuid, p_body text, p_title text, p_horse_label text)` | `evaluation_reports` | `has_staff_access()`, `current_org()` | `src/lib/acquisition.ts:131` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `say_hi(p_to_user uuid)` | `member_greetings`, `notifications` | `auth.uid()` | `src/lib/communityFeed.ts:280` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `say_hi_back(p_to_user uuid)` | `member_greetings`, `notifications` | `auth.uid()` | `src/lib/communityFeed.ts:287` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `send_contract_to_party(p_document_id uuid, p_party_role text)` | `documents`, `notifications` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:913` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_contact_required_documents(p_contact_id uuid, p_template_keys text[])` | `audit_logs`, `contact_required_documents` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/admin.ts:1073` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_contact_type(p_contact_id uuid, p_type text)` | `contacts` | `has_staff_access()`, `current_org()` | `src/lib/api.ts:2471` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_document_co_buyer(p_document_id uuid, p_contact_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_address_line1 text, p_city text, p_state text, p_postal_code text)` | `contacts`, `contract_fields`, `contract_parties`, `document_parties` · via `fill_party_fields_from_contacts`, `remerge_contract_from_clauses`: `documents`, `set` | `has_staff_access()`, `auth.uid()` | `src/lib/api.ts:2329` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_document_party_archived(p_document_id uuid, p_archive boolean)` | `document_party_archives` | `auth.uid()`, `current_contact_id()` | `src/lib/contracts.ts:969` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_document_party_hidden(p_document_id uuid, p_hidden boolean)` | `document_party_hidden` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:1448` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_field_control_override(p_document_id uuid, p_field_key text, p_override jsonb)` | `contract_fields` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:987` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_field_included(p_document_id uuid, p_field_key text, p_included boolean)` | `contract_fields` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:979` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_field_na(p_document_id uuid, p_field_key text, p_is_na boolean)` | `contract_fields` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:983` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_field_responsibility(p_document_id uuid, p_field_key text, p_responsibility jsonb)` | `contract_fields` | `has_staff_access()`, `auth.uid()`, `current_contact_id()`, `current_org()` | `src/lib/contracts.ts:975` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_field_structured(p_document_id uuid, p_field_key text, p_structured jsonb)` | `contract_fields`, `documents` · via `log_contract_change`, `recompose_document_fields`: `contract_change_log`, `set` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:993` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_form_field_options(p_form_key text, p_field_key text, p_options text[], p_from_version integer)` | via `save_form_definition_version`: `form_definition_versions`, `form_definitions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/admin.ts:1221` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_form_required(p_form_key text, p_required jsonb, p_from_version integer)` | via `save_form_definition_version`: `form_definition_versions`, `form_definitions` | `profiles.is_admin` / `has_admin_access()` | `src/lib/admin.ts:1306` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_lesson_progress_note(p_session_id uuid, p_note text)` | via `save_booking_form`: `booking_forms`, `bookings` | **none** | `src/lib/ops/api-lessons.ts:791` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_my_onboarding_horses(p_horse_ids uuid[], p_deferred_horse_ids uuid[])` | `document_horses`, `notifications`, `purchases` · via `generate_my_onboarding_documents`: `documents` | `auth.uid()`, `current_contact_id()` | `src/lib/api.ts:406` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `set_support_status(p_id uuid, p_status text)` | `support_requests` | `auth.uid()`, `current_org()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/support.ts:41` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `share_evaluation_report(p_report_id uuid, p_email text, p_contact_id uuid)` | `evaluation_report_access`, `evaluation_report_shares` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/lib/acquisition.ts:153` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `sign_start_register_attempt(p_hash text, p_org uuid)` | `sign_start_attempts` · via `notify_staff`: `notifications` | `has_staff_access()` | `api/sign-start.ts:212` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `staff_assign_documents(p_contact_id uuid, p_template_keys text[])` | `contact_required_documents`, `documents` · via `log_status_event`: `bookings`, `invitations`, `purchases` | `has_staff_access()` | `src/lib/admin.ts:195` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `staff_assign_horse_party(p_horse_id uuid, p_role text, p_contact_id uuid, p_term_start date, p_term_end date, p_sublease_allowed boolean, p_share_pct numeric, p_notes text)` | `horse_relationships`, `horses` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/horses.ts:309` · `src/lib/ops/api-records.ts:193` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `staff_end_horse_relationship(p_id uuid)` | `horse_relationships` | `has_staff_access()`, `current_org()` | `src/lib/ops/api-records.ts:213` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `staff_request_horse_record_completion(p_horse_id uuid)` | via `notify_user`: `notifications` | `has_staff_access()` | `src/lib/horses.ts:470` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `staff_update_horse(p_id uuid, p jsonb)` | `horses` | `has_staff_access()`, `current_org()` | `src/lib/horses.ts:295` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `start_bill_of_sale(p_sale_document_id uuid)` | `contract_fields` · via `attach_horse_to_document`, `bos_generate_document`: `documents`, `set` | `has_staff_access()`, `auth.uid()` | `src/lib/api.ts:2314` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `start_sale_contract(p_buyer_contact_id uuid, p_seller_contact_id uuid, p_horse_id uuid, p_amount numeric, p_deposit numeric)` | `contract_fields`, `contract_parties`, `contracts`, `document_party_controls`, `documents` · via `attach_horse_to_document`, `fill_party_fields_from_contacts`: `document_horses`, `document_parties`, `set` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/lib/api.ts:2297` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `submit_acquisition_intake(p_purchase_item_id uuid, p_data jsonb)` | `purchase_items` · via `notify_staff`: `notifications` | `auth.uid()`, `current_contact_id()` | `src/lib/acquisition.ts:29` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `submit_change_requests(p_document_id uuid)` | `contract_change_requests` · via `contract_notify`: `notifications` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:1291` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `submit_support_request(p_subject text, p_body text)` | `support_requests` · via `notify_staff`: `notifications` | `auth.uid()`, `current_org()` | `src/lib/support.ts:19` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `supersede_invitations(p_org uuid, p_email text, p_new_invitation_id uuid)` | `invitations` | **none** | `api/admin-send-invitation.ts:360` · `api/admin-send-invitation.ts:464` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `transfer_payment_responsibility(p_purchase_id uuid, p_new_payer_contact_id uuid)` | `purchases` · via `log_status_event`: `bookings`, `documents`, `invitations` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/lib/api.ts:2579` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `update_contact_record(p_contact_id uuid, p_patch jsonb)` | `contacts` | `has_staff_access()`, `current_org()` | `src/lib/api.ts:2775` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `update_deal(p_deal_id uuid, p_deal_type text, p_notes text, p_title text)` | `contracts`, `deals` | `has_staff_access()`, `auth.uid()` | `src/lib/deals.ts:173` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `update_purchase_payment_method(p_purchase_id uuid, p_method text)` | `purchases` · via `_payment_open`: `payments` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/lib/api.ts:2571` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `upsert_change_request(p_document_id uuid, p_target_section text, p_body text)` | `contract_change_requests` | `has_staff_access()`, `auth.uid()`, `current_org()` | `src/lib/contracts.ts:1274` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `upsert_content_block(p_slug text, p_title text, p_body text, p_kind text)` | via `save_content_block_version`: `content_block_versions`, `content_blocks` | **none** | `src/lib/contentStore.ts:39` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `void_deal(p_deal_id uuid)` | `contracts`, `deals` | `has_staff_access()`, `auth.uid()`, `current_contact_id()` | `src/lib/deals.ts:183` | no — callers run `authenticated` or `service_role` | REVOKE anon |
| `void_document(p_document_id uuid, p_note text)` | `documents` · via `contract_notify`, `log_contract_change`: `contract_change_log`, `notifications` | `auth.uid()`, `current_contact_id()` | `src/lib/contracts.ts:1420` | no — callers run `authenticated` or `service_role` | REVOKE anon |

---

## BLOCK B — an anonymous surface calls it. One ruling each.

| `function(signature)` | writes | internal guard | call sites | anonymous surface? | recommendation |
|---|---|---|---|---|---|
| `open_gift(p_code text)` | `gifts` | **none** | `src/lib/gifts.ts:34` | YES — see the note per row | **KEEP anon BY DESIGN** |
| `redeem_gift(p_code text)` | `gifts`, `profiles` · via `_ensure_client_account`, `_provision_purchase_for_offerings`: `clients`, `contact_required_documents`, `contacts` | `auth.uid()` | `src/lib/gifts.ts:44` | YES — see the note per row | REVOKE anon |
| `submit_public_request(p_first_name text, p_last_name text, p_email text, p_phone text, p_contact_method text, p_notes text, p_proposed_times jsonb, p_category text, p_channel text, p_entry_location text, p_intent text, p_selections jsonb, p_details jsonb, p_interests text[])` | `purchase_items`, `purchases`, `request_selections`, `requests` · via `log_status_event`, `notify_staff`: `bookings`, `documents`, `invitations` | `current_org()` | `src/lib/api.ts:79` | YES — see the note per row | **KEEP anon BY DESIGN** |

### B1 · `submit_public_request` — **KEEP. This is the contact form.**
`src/lib/api.ts:79`, reached from `src/components/InquiryForm.tsx:208` and
`src/components/PublicIntakeForm.tsx:220` — the intake on `/contact`, `/visit`, `/gift`, `/lessons`,
`/horse`, `/acquisition`. A logged-out visitor is the only caller that matters.
**Revoking it silently kills every inbound request.** The bundle already names it public by design.

### B2 · `open_gift` — **KEEP. The gift code is the credential.**
`src/lib/gifts.ts:34`, called from `src/pages/Redeem.tsx:34` **on mount, before the page ever looks at
`user`** — the recipient of a gift has no account yet. It writes `gifts.status='opened'`,
`opened_at=now()` and has **no in-body guard**, which is deliberate: `src/lib/gifts.ts:38-40` says so —
*"open_gift/redeem_gift are unguarded/self-guarding for the same reason"* — the code IS the credential.
**Revoking it breaks `/redeem` for every gift recipient who is not already signed in.**
⚠️ **This one is NOT on the bundle's known-public list.** It is a genuinely new answer to the
escalation's question, and the sweep is why it was found.

### B3 · `redeem_gift` — **REVOKE. It is reachable from the anonymous page and it already refuses anon.**
`src/lib/gifts.ts:44`, called from `src/pages/Redeem.tsx:65` (behind `if (!user)`) **and from
`Redeem.tsx:76`, immediately after `registerForGift()` creates the account.** It is listed in Block B
rather than Block A because the page it sits on is one a logged-out person opens — but two facts settle it:
1. **The function self-guards.** Its first line is `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;`
   — an `anon` call today writes nothing and returns a string. Revoking swaps that string for a 403.
2. **The session is attached before the call.** `registerForGift` (`src/lib/gifts.ts:54-66`) `await`s
   `supabase.auth.signInWithPassword()`, which resolves with the session set on the client, and only then
   does `Redeem.tsx:76` call `redeemGift`. The caller is `authenticated`.
**Nothing that works today stops working.** `TASK-GRANTS-B` proves point 2 by re-reading those lines
before it writes the statement, and the WALKR pass redeems a real gift as a brand-new account.

---

## §C — WRITERS ON A PUBLIC ROUTE THAT ARE **NOT** ANONYMOUS. Listed so the ruling is not a leap of faith.

These six are the rest of the trace in Block A's point 2 — reachable from a page a logged-out person can
open, but **the call itself never happens without a session.** Each was read, not inferred. **They are
the last 6 of Block A's 140** and need no separate ruling.

| `function(signature)` | writes | internal guard | call sites | anonymous surface? | recommendation |
|---|---|---|---|---|---|
| `ensure_my_member_access()` | `members` | `auth.uid()`, `current_contact_id()` | `src/contexts/AuthContext.tsx:93` · `src/lib/api.ts:206` | BUNDLED on a public route — see the note per row | REVOKE anon |
| `record_invitation_failure(p_token text)` | `invitations` · via `notify_staff`: `notifications` | `auth.uid()` | `src/lib/api.ts:196` | BUNDLED on a public route — see the note per row | REVOKE anon |
| `redeem_invitation(p_token text)` | `contacts`, `invitations`, `members`, `notifications`, `profiles` · via `_ensure_client_account`, `promote_contact_to_account`: `clients`, `contact_required_documents`, `contract_fields` | `auth.uid()`, `profiles.is_admin` / `has_admin_access()` | `src/lib/api.ts:194` | BUNDLED on a public route — see the note per row | REVOKE anon |
| `set_horse_locations(p_horse_id uuid, p_payload jsonb)` | `horses` · via `_resolve_location`: `locations` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/horses.ts:133` | BUNDLED on a public route — see the note per row | REVOKE anon |
| `set_horse_medications(p_horse_id uuid, p_items jsonb)` | `horse_medications` | `has_staff_access()`, `current_contact_id()`, `current_org()` | `src/lib/horses.ts:213` | BUNDLED on a public route — see the note per row | REVOKE anon |
| `update_horse_record(p_id uuid, p jsonb)` | `horses` | `has_staff_access()` | `src/lib/horses.ts:192` | BUNDLED on a public route — see the note per row | REVOKE anon |

- **`redeem_invitation` · `record_invitation_failure`** — `src/lib/api.ts:193-197`, from
  `src/pages/Register.tsx:48` and `src/pages/RegisterComplete.tsx:94`. `/activate` is public, but the
  call sits **after** `supabase.auth.signInWithPassword()` succeeds (`Register.tsx:199-211`) or after a
  live session is read (`RegisterComplete.tsx:54`). The caller is `authenticated`.
- **`ensure_my_member_access`** — `src/contexts/AuthContext.tsx:93`, inside
  `if (prof && mem.status !== 'active')`, i.e. only once a `profiles` row for a signed-in `userId` has
  been read. No session, no call.
- **`set_horse_locations` · `set_horse_medications` · `update_horse_record`** — `src/lib/horses.ts`,
  from `src/components/app/HorseIntakeForm.tsx:925/933/946`. That component **is** bundled onto the
  public `/checkout` route (`Checkout.tsx:8` → `HorseCareSelect` → `HorseIntakeForm`), which is why it
  shows up in the trace — but `Checkout.tsx:163` renders `HorseCareSelect` **only inside `{user ? … }`**.
  Its sibling `create_horse_record` already has `anon=f`, which is the precedent this follows.

---

## §D — THE TWO ZERO-CALLER READERS, included because `TASK-SIGNFLOW-D` flagged them

`TASK-SIGNFLOW-D-REPORT.md` §4, bullet 2: *"`release_preview` and `general_release_preview` keep an
`anon` EXECUTE grant and now have ZERO callers — `fetchReleasePreview` was their only one and is
deleted."* Re-checked 2026-09-03: `grep -rn "'release_preview'\|'general_release_preview'" src api` →
**no hits.** They read, they do not write, and they are the only readers this bundle touches.
**No ruling needed — they are in the migration's Section 1 on D's flag.**

## §E — `request_category_label`: the bundle is wrong about it, and there is nothing to rule

The bundle names it alongside `submit_public_request` as *"known-public by design … (the contact form)"*.
Measured: it is **`SECURITY INVOKER`, `IMMUTABLE`, and writes nothing** —

```
request_category_label(p_category text) | postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres | anon=t | secdef=f | vol=i
```

Its whole body is a `CASE` that turns `'visit'` into `'Visit the ranch'`
(`supabase/migrations/20260901T2230_…sql:19-36`). `grep -rn "request_category_label"` across the repo
finds **no call site in `src` or `api`** — it is called from inside another SQL function
(`…20260901T2230…sql:220`). **It is not in the 675, not a writer, not on this list, and outside this
bundle's ownership. Its `anon` grant is harmless and is left exactly as it is.**

---

## ALREADY RULED BY THE HANDOFF — listed for completeness, NOT for a ruling

| item | function | `proacl`, production, 2026-09-03 07:13 PDT | why it is not a question |
|---|---|---|---|
| 1 | `request_purchase_payment(p_purchase_id uuid, p_note text)` | `postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres` | Its own migration `20260823T0140_…sql:123-124` already revoked `anon`; production does not reflect it. Only caller `api/order-request-payment.ts:74` runs as **`authenticated`** |
| 2 | `reap_expired_holds()` | `postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres` | Only caller `api/expire-holds.ts:64` uses `getSupabaseAdmin()` → **`service_role`**. `anon` has no caller at all. Writes `request_selections`, **no in-body guard** |
| 3 | `trg_seed_display_name()` | `=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres` | A trigger function — inert through the API. ⚠️ **It is `SECURITY INVOKER`, so it is NOT one of the 326 and NOT "one of the 45"** as the MGMT ledger states |
| 5 | `sign_release(…)` · `sign_general_release(…)` | `postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres` | `anon` is already gone (`20260902T0010`). Only the caller-less `authenticated` grant remains, which `TASK-SIGNFLOW-D` §5.1 deliberately left and flagged |

---

## WHAT HAPPENS AFTER THE RULING

- **Yes to Block A** → `FHE-TASK-GRANTS-B` builds Section 1 of one migration: the 140 Block-A revokes
  + items 1, 2, 3, 5 + the two zero-caller previews + the 45 trigger functions + `rls_auto_enable`.
- **Block B** is Section 2 of the same file, written only for whatever you rule REVOKE.
  **Section 1 does not wait for Section 2** — that is why they are separated.
- Proof either way is `proacl` before and after, `has_function_privilege('anon', …)` per function, and
  `md5(pg_get_functiondef(oid))` unchanged for every touched function — **no body is edited by this
  bundle at all** (`DROP`+`CREATE` is what re-grants `anon`; this migration never does either).
