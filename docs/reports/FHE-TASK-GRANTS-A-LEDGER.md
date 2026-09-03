# FHE-TASK-GRANTS-A — LEDGER (TASK thread, DSNR profile)

**Spec:** `docs/tasks/TASK-GRANTS-A-author-the-acl-sweep-spec.md` (on `bundle/grants`, read from `wt-1`).
**Bundle:** `docs/orch/BUNDLE-GRANTS.md`. **Dispatched by / hand back to:** `FHE-MGMT-GRANTS`.
**Opened 2026-09-03 · tree `wt-2` · branch `task/grants-a-spec` from `origin/main` @ 2779ca2c.**

## RESUME
Role / thread   FHE-TASK-GRANTS-A · wt-2 · task/grants-a-spec (DSNR profile: specs only, no build, no GRANT/REVOKE run)
Merge-base      2779ca2c (origin/main, unmoved through the session). bundle/grants = d5f97724, 3 ahead of main — the bundle files live there, read from wt-1
DONE            worktree guard + claim + clean · CLNR pass (clean) · population re-run (matches MGMT exactly) · all 326 bodies read and classified · role-of-caller established for every api/ handler · anonymous-surface trace from the 23 public routes · all three deliverables written and committed (5 commits)
IN FLIGHT       nothing — appendix appended, TEARDOWN next
NEXT            hand back to FHE-MGMT-GRANTS: it takes FHE-TASK-GRANTS-A-ANON-WRITERS.md to the owner, writes his ruling into that file's ## RULING section, then dispatches -B (Sonnet · MEDIUM · ON)
DECIDED         one migration file not one-with-a-commented-Section-2 (an applied migration is immutable) · redeem_gift ASK→REVOKE on evidence · all 46 inert fns revoked, not just item 3 · the 15 invoker trigger fns left out (outside the ownership declaration) · statements generated from a PINNED 142-name list, never a predicate · the two Onboarding replacement texts written from the code
BLOCKED         nothing. -B is blocked only on the owner's Block A ruling, which is MGMT's to obtain
DO NOT          do not treat provolatile='v' as "writes" (the 151 contains readers, and the writer count is 145) · do not use `update <tbl> set` as the UPDATE regex — it misses `UPDATE gifts g SET` and it hid open_gift · do not open 326 psql connections to dump bodies (2-minute timeout); one query with a delimiter takes seconds · do not assume an api/ handler runs as anon — all 37 run service_role or authenticated · do not re-edit MergedBodyView.tsx, already fixed by d78d3b3c

## LOG
- 07:03 PDT psql to production proven (`current_user=postgres` via `.env.db`).
- 07:05 POPULATION RE-RUN (MGMT's query, verbatim) — **matches MGMT exactly**: 675 SECURITY DEFINER in `public` · 326 anon-executable · 151 anon+volatile+non-trigger · 45 anon trigger fns · 130 anon stable/immutable.
- 07:10 SWEEP: 326 bodies pulled with `pg_get_functiondef` (one query, split locally); classified by regex over the comment-stripped body + one level of callee resolution across ALL 764 public functions.
  FIRST PASS MISSED ALIASED UPDATES (`update gifts g set …`) — regex required `update <tbl> set`. **Two real writers were classified readers: `open_gift` and `_restore_contract_template_composition`.** Fixed to `(?<!for )(?<!on )\bupdate\s+(?:only\s+)?["a-z_][\w".]*`; re-ran. DO NOT trust a `update <tbl> set` regex on this codebase.
- 07:12 CLASSES (production, 2026-09-03): 326 = 45 trigger fns + 1 **event_trigger** (`rls_auto_enable` — `prorettype='event_trigger'`, missed by a `prorettype='trigger'` test) + 280 callable, of which **145 WRITERS** and **135 READERS**.
- 07:13 `has_function_privilege` + `proacl` pulled for the 14 named functions. **THREE BUNDLE CORRECTIONS:**
  (a) `trg_seed_display_name` is **SECURITY INVOKER** (`prosecdef=f`) — it is NOT in the 326 and NOT "one of the 45"; MGMT's ledger says it is.
  (b) `request_category_label` is SECURITY INVOKER + IMMUTABLE + **writes nothing** and has ZERO call sites in `src`/`api` — it is a label lookup called from inside another SQL function. Not an escalation row at all.
  (c) `sign_release`/`sign_general_release` already have `anon=f` (SIGNFLOW-D applied it); only the `authenticated` grant is left to revoke.
- 07:15 ROLE-OF-CALLER established: **every `api/*.ts` RPC runs as `service_role`** (`api/_lib/supabaseAdmin.ts`) except four files that build a caller client from the ANON key + the user's bearer (`delete-document-with-copy`, `email-change-complete`, `order-request-payment`, `orders-mark-paid`) → those run as **`authenticated`**. **No `api/` handler ever calls a function as `anon`.** So item 2 (`reap_expired_holds`, only caller `api/expire-holds.ts:64`, `getSupabaseAdmin`) has NO anon caller, and item 1 (`request_purchase_payment`, only caller `api/order-request-payment.ts:74`, `callerClient(bearer)`) is `authenticated`.
- 07:18 ANONYMOUS-SURFACE SWEEP: import graph from the 23 public routes (no `ProtectedRoute`) → 98 modules; then per-symbol resolution of every writer wrapper those modules import. **Only 8 writers are transitively imported by a public page/component**, plus `ensure_my_member_access` called directly in `AuthContext.tsx:93`. Read each call site: only **`open_gift` (Redeem.tsx:34, on mount, before the auth check)** and **`submit_public_request` (InquiryForm/PublicIntakeForm)** actually run with no session.
- 07:20 CORRECTS THE BUNDLE'S EXPECTATION: `sign_start_register_attempt`, `apply_sign_path_documents`, `provision_client_invitation` are called ONLY from `api/sign-start.ts` (`getSupabaseAdmin`, line 198) — `/sign/*` does NOT need `anon` on any of them. The bundle predicted "the sign-start writers … will land here [group B]". They do not.
- 07:22 ITEM 6 IS FOUR EDITS, NOT FIVE: `MergedBodyView.tsx`'s stale `Release.tsx` comment was ALREADY fixed by `d78d3b3c` (now lines 35-36, different wording from D's suggestion, and correct). Verified with `git log -L35,36`.
- 07:35 `docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md` written and committed. Blocks: **A = 140** (134 tabled + 6 in §C, on a public route but session-gated) · **B = 3** · already-ruled items 1+2 = 2. 140+3+2 = 145.
- 07:38 DECIDED: `redeem_gift` moved from ASK to **REVOKE**. Evidence, not preference: its first line is `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'` (self-guarding — an anon call writes nothing today) and `registerForGift` awaits `signInWithPassword` before `Redeem.tsx:76` calls it. The owner is left TWO KEEPs to confirm and one block to rule, not 150 questions.

---

# APPENDIX — THE FULL SWEEP: all 326, classified, with body evidence

**Production, 2026-09-03 07:05–07:12 PDT.** Population query, verbatim (MGMT's, re-run unchanged):

```sql
select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as fn,
       coalesce(array_to_string(p.proacl,','),'<NULL=default: PUBLIC EXECUTE>') as proacl,
       has_function_privilege('anon',p.oid,'execute') as anon,
       has_function_privilege('authenticated',p.oid,'execute') as authed,
       p.prokind, p.provolatile, (p.prorettype='trigger'::regtype) as is_trg
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 1;
```

**Bodies, one query, split locally (326 separate `psql` calls timed out; this does not):**

```sql
select '@@@FN@@@'||p.oid||E'\n'||pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'execute')
order by p.proname;
```
The same query without `p.prosecdef and has_function_privilege(...)` (766 rows, every `prokind='f'` in
`public`) supplied the callee side, so a one-level-deep callee is resolved against every function that
exists, not only against the 326.

**THE WRITER TEST, applied to the comment-stripped body** (`--` to end of line and `/* */` removed;
string literals KEPT, because an `INSERT` inside `EXECUTE format(...)` is a write):

```
INSERT     \binsert\s+into\b
UPDATE     (?<!for )(?<!on )\bupdate\s+(?:only\s+)?["a-z_][\w".]*        ← see the trap below
DELETE     \bdelete\s+from\b
TRUNCATE   \btruncate\b            MERGE  \bmerge\s+into\b
DDL        \b(?:create|alter|drop)\s+(?:table|policy|index|trigger|view|schema|type|function|sequence|materialized)\b
ACL        \b(?:grant|revoke)\s+(?:all|execute|select|insert|update|delete|usage)\b
side fx    \bpg_notify\s*\(   \bset_config\s*\(   \bnextval\s*\(
callee     any call to another public function whose own body matched, one level deep
```

⚠️ **THE TRAP, AND IT BIT ONCE.** The first pass used `\bupdate\s+<table>\s+set\b`, which does not match
`UPDATE gifts g SET status = 'opened'` — an **aliased** update. It classified **`open_gift`** and
**`_restore_contract_template_composition`** as readers. Both are writers, and `open_gift` is the single
most consequential row in this whole sweep. **Never trust `update <tbl> set` on this codebase.**
The corrected pattern excludes `for update` (a lock) and `on update` (a constraint clause).

**Verification of the negative side** (a reader misclassified is a door left open): every one of the
135 readers was re-grepped RAW — comments included — for `insert|update|delete|into|execute|notify|
set_config|nextval|copy`. 77 matched, all of them on `deleted_at is null`, `select … into`, `updated_at`
or a comment; the six genuinely ambiguous ones (`_restore_contract_template_composition`, `open_gift`,
`feed_my_posts`, `dm_list_conversations`, `dm_unread_total`, `feed_get`, `org_public_config`,
`pending_notify_summary`) were read in full. Two were writers (above); the rest read only —
`org_public_config`'s `EXECUTE $q$…$q$` is a `SELECT`.

**CLASSES: 45 TRIGGER · 1 EVENT_TRIGGER · 145 WRITER · 135 reader = 326.**

| # | `function(args)` | vol | class | body evidence (line: text) — or the callee that writes |
|---|---|---|---|---|
| 1 | `_restore_contract_template_composition(p_template_key text, p_composition jsonb)` | `v` | **WRITER** | `65: update contract_section_defs t`; `73: update contract_clause_defs t` (+1) |
| 2 | `acknowledge_content_block(p_slug text)` | `v` | **WRITER** | `16: INSERT INTO content_acknowledgments (block_id, version, user_id)` |
| 3 | `add_contact_location(p_contact_id uuid, p_name text, p_address text)` | `v` | **WRITER** | `23: INSERT INTO locations (org_id, name, address, owner_contact_id, is_offsite, is_d` |
| 4 | `add_deal_document(p_deal_id uuid, p_template_key text, p_has_sale_agreement text)` | `v` | **WRITER** | `46: INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit`; `56: INSERT INTO contract_fields (` (+3) |
| 5 | `add_deal_member(p_deal_id uuid, p_party_role text, p_contact_id uuid)` | `v` | **WRITER** | `36: INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_si` |
| 6 | `add_form_field(p_form_key text, p_section_heading text, p_key text, p_label text, p_type text, p_options text[], p_from_version integer)` | `v` | **WRITER** | via `save_form_definition_version` |
| 7 | `add_my_location(p_name text, p_address text)` | `v` | **WRITER** | `21: INSERT INTO locations (org_id, name, address, owner_contact_id, is_offsite, is_d` |
| 8 | `agree_change_request(p_request_id uuid, p_agreed boolean)` | `v` | **WRITER** | `25: UPDATE contract_change_requests`; `34: UPDATE contract_change_requests` |
| 9 | `apply_offering_documents(p_contact_id uuid, p_disposition text)` | `v` | **WRITER** | `15: INSERT INTO contact_required_documents (contact_id, template_key, org_id, dispos` |
| 10 | `apply_sign_path_documents(p_contact_id uuid, p_path text)` | `v` | **WRITER** | `11: INSERT INTO contact_required_documents (contact_id, template_key, org_id)` |
| 11 | `approve_contract_review(p_document_id uuid)` | `v` | **WRITER** | `41: INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor` |
| 12 | `approve_contract_termination(p_document_id uuid)` | `v` | **WRITER** | `31: INSERT INTO notifications (org_id, user_id, kind, title, body, link)`; `16: UPDATE documents SET workflow_state = 'terminated', terminated_at = now(), termi` |
| 13 | `archive_contract(p_document_id uuid, p_archive boolean)` | `v` | **WRITER** | `12: UPDATE documents` |
| 14 | `assign_horse_section(p_document_id uuid, p_role text)` | `v` | **WRITER** | `21: UPDATE contract_fields SET owner_role = upper(p_role)` |
| 15 | `attach_horse_to_document(p_document_id uuid, p_horse_id uuid)` | `v` | **WRITER** | `39: UPDATE documents SET horse_id = p_horse_id, updated_at = now() WHERE id = p_docu`; `48: UPDATE contract_fields` |
| 16 | `capture_horse_record_info(p_document_id uuid, p_patch jsonb)` | `v` | **WRITER** | `24: UPDATE horses SET`; `41: UPDATE contract_fields cf` |
| 17 | `claim_document_origination(p_document_id uuid)` | `v` | **WRITER** | `14: UPDATE documents SET originator_contact_id = current_contact_id()` |
| 18 | `company_contact_id()` | `v` | **WRITER** | `38: INSERT INTO contacts (org_id, first_name, last_name, is_company)`; `26: UPDATE organizations SET company_contact_id = v_id WHERE id = v_org;` (+1) |
| 19 | `complete_deal(p_deal_id uuid)` | `v` | **WRITER** | `29: UPDATE deals SET status = 'complete', completed_at = now() WHERE id = p_deal_id;`; `30: UPDATE contracts SET status = 'executed' WHERE id = v_deal.contract_id AND statu` |
| 20 | `confirm_my_legal_name(p_first text, p_last text)` | `v` | **WRITER** | `17: UPDATE contacts` |
| 21 | `consume_notification(p_id uuid)` | `v` | **WRITER** | `16: INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value,`; `20: DELETE FROM notifications WHERE id = v_n.id;` |
| 22 | `create_contract_note(p_document_id uuid, p_title text)` | `v` | **WRITER** | `23: INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)` |
| 23 | `create_deal(p_deal_type text, p_party_a_contact_ids uuid[], p_party_b_contact_ids uuid[], p_notes text, p_title text, p_horse_id uuid)` | `v` | **WRITER** | `20: INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)` |
| 24 | `create_evaluation_report(p_contact_id uuid, p_purchase_item_id uuid, p_horse_id uuid, p_title text)` | `v` | **WRITER** | `27: INSERT INTO evaluation_reports (org_id, contact_id, purchase_item_id, horse_id, ` |
| 25 | `decline_contract_termination(p_document_id uuid)` | `v` | **WRITER** | `26: INSERT INTO notifications (org_id, user_id, kind, title, body, link)`; `16: UPDATE documents SET termination_requested_at = NULL, termination_requested_by =` |
| 26 | `delete_contract_comment(p_comment_id uuid)` | `v` | **WRITER** | `19: DELETE FROM contract_change_requests WHERE id = p_comment_id OR parent_request_i` |
| 27 | `deliver_evaluation_report(p_report_id uuid)` | `v` | **WRITER** | `31: INSERT INTO notifications (org_id, user_id, kind, title, body, link)`; `22: UPDATE evaluation_reports` |
| 28 | `dm_delete_message(p_message_id uuid)` | `v` | **WRITER** | `8: UPDATE direct_messages` |
| 29 | `dm_edit_message(p_message_id uuid, p_body text)` | `v` | **WRITER** | `9: UPDATE direct_messages` |
| 30 | `dm_hide_conversation(p_other_id uuid)` | `v` | **WRITER** | `8: INSERT INTO dm_hidden_conversations (user_id, other_id, hidden_before)`; `10: ON CONFLICT (user_id, other_id) DO UPDATE SET hidden_before = now();` |
| 31 | `dm_mark_conversation_read(p_other_id uuid)` | `v` | **WRITER** | `8: UPDATE direct_messages` |
| 32 | `edit_change_request_entry(p_request_id uuid, p_body text)` | `v` | **WRITER** | `35: UPDATE contract_change_requests` |
| 33 | `edit_contract_comment(p_comment_id uuid, p_body text)` | `v` | **WRITER** | `28: UPDATE contract_change_requests` |
| 34 | `edit_form_field(p_form_key text, p_field_key text, p_label text, p_type text, p_new_key text, p_from_version integer)` | `v` | **WRITER** | via `save_form_definition_version` |
| 35 | `ensure_my_member_access()` | `v` | **WRITER** | `27: INSERT INTO members (user_id, status, org_id)`; `29: ON CONFLICT (user_id) DO UPDATE SET status = 'active';` (+1) |
| 36 | `feed_mark_seen(p_post_id uuid)` | `v` | **WRITER** | `7: INSERT INTO feed_seen (user_id, post_id) VALUES (auth.uid(), p_post_id)` |
| 37 | `feed_moderate(p_post_id uuid, p_action text)` | `v` | **WRITER** | `10: UPDATE feed_posts SET scan_state='clean', published=true, pulled_down=false, upd`; `12: UPDATE feed_posts SET scan_state='blocked', published=false, updated_at=now() WH` (+1) |
| 38 | `feed_post_create(p_type feed_post_type, p_media_url text, p_media_kind feed_media_kind, p_body text, p_source_link text, p_subject_horse_id uuid, p_as_company boolean, p_visibility feed_visibility, p_publish_at timestamp with time zone)` | `v` | **WRITER** | `27: INSERT INTO feed_posts (org_id, author_id, as_company, post_type, media_url, med` |
| 39 | `feed_post_delete(p_id uuid)` | `v` | **WRITER** | `16: DELETE FROM feed_posts WHERE id = p_id;` |
| 40 | `feed_post_update(p_id uuid, p_body text, p_source_link text, p_visibility feed_visibility)` | `v` | **WRITER** | `16: UPDATE feed_posts SET` |
| 41 | `feed_report_post(p_post_id uuid, p_reason text)` | `v` | **WRITER** | `8: UPDATE feed_posts SET scan_state = 'disputed', reported_reason = p_reason, updat` |
| 42 | `feed_seed_welcome()` | `v` | **WRITER** | `18: INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)`; `23: INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)` (+1) |
| 43 | `feed_set_view_shape(p_shape feed_view_shape)` | `v` | **WRITER** | `7: INSERT INTO feed_view_pref (user_id, shape, updated_at) VALUES (auth.uid(), p_sh`; `8: ON CONFLICT (user_id) DO UPDATE SET shape = EXCLUDED.shape, updated_at = now();` |
| 44 | `feed_share(p_post_id uuid, p_to_user_id uuid)` | `v` | **WRITER** | `9: INSERT INTO feed_shares (org_id, post_id, from_user_id, to_user_id)` |
| 45 | `gift_mark_sent(p_gift_id uuid)` | `v` | **WRITER** | `14: UPDATE gifts SET last_sent_at = now(), send_count = send_count + 1 WHERE id = p_` |
| 46 | `gift_reschedule(p_gift_id uuid, p_deliver_on date)` | `v` | **WRITER** | `15: UPDATE gifts SET deliver_on = p_deliver_on WHERE id = p_gift_id;` |
| 47 | `gift_transfer(p_gift_id uuid, p_recipient_name text, p_recipient_email text)` | `v` | **WRITER** | `18: UPDATE gifts SET` |
| 48 | `grant_lesson_credit(p_client_id uuid, p_offering_id uuid, p_quantity integer, p_mode text, p_reason text, p_payment_method text, p_paid_at timestamp with time zone)` | `v` | **WRITER** | `65: INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,`; `89: INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amoun` |
| 49 | `hard_delete_contract(p_document_id uuid)` | `v` | **WRITER** | `21: UPDATE horse_relationships SET source_document_id = NULL WHERE source_document_i`; `22: UPDATE horse_reconciliation SET evidence_document_id = NULL WHERE evidence_docum` (+12) |
| 50 | `insurance_resolution_sync(p_document_id uuid)` | `v` | **WRITER** | `77: INSERT INTO notifications (org_id, user_id, kind, title, body, link)` |
| 51 | `link_contract_to_purchase(p_contract_id uuid, p_purchase_id uuid)` | `v` | **WRITER** | `19: UPDATE contracts` |
| 52 | `log_evaluation_report_access(p_report_id uuid, p_action text, p_detail text)` | `v` | **WRITER** | `11: INSERT INTO evaluation_report_access (org_id, report_id, actor_user_id, action, ` |
| 53 | `log_mirror_delivery(p_document_id uuid, p_channel text, p_copy_url text)` | `v` | **WRITER** | `9: INSERT INTO document_deliveries (document_id, recipient_contact_id, channel, cop` |
| 54 | `log_payment_request_send(p_purchase_id uuid, p_key text, p_recipient text, p_succeeded boolean, p_amount_due numeric, p_error text, p_message_id text, p_requested_by uuid)` | `v` | **WRITER** | `11: INSERT INTO payment_request_sends (org_id, purchase_id, idempotency_key, recipie` |
| 55 | `log_request_alert_send(p_request_id uuid, p_key text, p_recipient text, p_succeeded boolean, p_error text, p_message_id text, p_kind text)` | `v` | **WRITER** | `11: INSERT INTO request_alert_sends (org_id, request_id, idempotency_key, recipient_` |
| 56 | `mark_change_request_seen(p_request_ids uuid[])` | `v` | **WRITER** | `40: INSERT INTO contract_change_request_seen (request_id, contact_id, org_id, seen_r` |
| 57 | `mark_comment_review(p_comment_id uuid, p_on boolean)` | `v` | **WRITER** | `16: UPDATE contract_change_requests SET needs_review = coalesce(p_on,true), updated_` |
| 58 | `mark_document_opened(p_document_id uuid)` | `v` | **WRITER** | `25: INSERT INTO document_opened (document_id, contact_id, org_id, opened_role, opene` |
| 59 | `mark_tour_seen(p_form_factor text)` | `v` | **WRITER** | `13: UPDATE profiles`; `18: UPDATE profiles` (+1) |
| 60 | `my_stable_add_horse(p_name text, p_barn_name text, p_breed text, p_sex text, p_height text, p_dob date, p_color text, p_location text, p_notes text, p_markings text, p_as_company boolean)` | `v` | **WRITER** | via `company_contact_id`, `create_horse_record` |
| 61 | `my_stable_delete_horse(p_id uuid)` | `v` | **WRITER** | `8: UPDATE horses` |
| 62 | `my_stable_update_horse(p_id uuid, p_barn_name text, p_breed text, p_sex text, p_height text, p_color text, p_location text)` | `v` | **WRITER** | `8: UPDATE horses` |
| 63 | `notify_review_changes(p_document_id uuid, p_message text)` | `v` | **WRITER** | `22: INSERT INTO notifications (org_id, user_id, kind, title, link)` |
| 64 | `open_gift(p_code text)` | `v` | **WRITER** | `9: UPDATE gifts g SET status = 'opened', opened_at = now()` |
| 65 | `post_contract_note_message(p_note_id uuid, p_body text)` | `v` | **WRITER** | `24: INSERT INTO contract_note_messages (org_id, note_id, author_contact_id, author_l`; `28: UPDATE contract_notes SET updated_at = now() WHERE id = p_note_id;` |
| 66 | `promote_lookup_suggestion(p_id uuid, p_code text)` | `v` | **WRITER** | `15: INSERT INTO horse_breeds (code, display_name, active, sort_order)`; `18: INSERT INTO horse_colors (code, display_name, active, sort_order)` (+5) |
| 67 | `propose_community_event(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_description text)` | `v` | **WRITER** | `25: INSERT INTO events (title, description, starts_at, ends_at, location, published,` |
| 68 | `provision_client_invitation(p_email text, p_first_name text, p_last_name text, p_categories text[], p_offering_ids uuid[], p_template_keys text[], p_mark_paid boolean, p_payment_method text, p_notes text, p_request_id uuid, p_org_id uuid, p_partial_amount numeric, p_phone text, p_agreed_lesson jsonb, p_send boolean)` | `v` | **WRITER** | `126: INSERT INTO clients (org_id, contact_id, source, client_since)`; `131: INSERT INTO contact_required_documents (contact_id, template_key, org_id)` (+6) |
| 69 | `publish_open_slots(p_weeks integer, p_slot_minutes integer)` | `v` | **WRITER** | via `_publish_open_slots_for_org` |
| 70 | `reap_expired_holds()` | `v` | **WRITER** | `10: UPDATE request_selections SET state = 'lapsed'` |
| 71 | `reassign_document_party(p_document_id uuid, p_party_role text, p_contact_id uuid)` | `v` | **WRITER** | `28: UPDATE document_parties SET contact_id = p_contact_id`; `31: UPDATE contract_parties SET contact_id = p_contact_id` (+1) |
| 72 | `record_invitation_failure(p_token text)` | `v` | **WRITER** | `28: UPDATE invitations` |
| 73 | `record_lookup_suggestion(p_lookup_key text, p_raw_value text)` | `v` | **WRITER** | `23: INSERT INTO lookup_suggestions (lookup_key, raw_value, norm_value, org_id)`; `26: DO UPDATE SET count = lookup_suggestions.count + 1, last_seen = now(),` |
| 74 | `redeem_gift(p_code text)` | `v` | **WRITER** | `71: INSERT INTO profiles (user_id, org_id, first_name, last_name, email)`; `111: UPDATE gifts SET status = 'redeemed', redeemed_at = now(), redeemed_user_id = au` (+1) |
| 75 | `redeem_invitation(p_token text)` | `v` | **WRITER** | `36: INSERT INTO profiles (user_id, org_id, first_name, last_name, email)`; `78: INSERT INTO notifications (org_id, user_id, kind, title, body, link)` (+9) |
| 76 | `redeem_my_pending_invitation()` | `v` | **WRITER** | via `redeem_invitation` |
| 77 | `remove_deal_member(p_deal_id uuid, p_party_role text, p_contact_id uuid)` | `v` | **WRITER** | `28: DELETE FROM contract_parties` |
| 78 | `remove_form_field(p_form_key text, p_field_key text, p_from_version integer)` | `v` | **WRITER** | via `save_form_definition_version` |
| 79 | `rename_contract_note(p_note_id uuid, p_title text)` | `v` | **WRITER** | `10: UPDATE contract_notes SET title = v_title, updated_at = now()` |
| 80 | `reopen_change_request(p_request_id uuid)` | `v` | **WRITER** | via `agree_change_request` |
| 81 | `reopen_deal(p_deal_id uuid)` | `v` | **WRITER** | `21: INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value,`; `18: UPDATE deals SET status = 'pending', completed_at = NULL WHERE id = p_deal_id;` (+1) |
| 82 | `reply_to_change_request(p_request_id uuid, p_body text)` | `v` | **WRITER** | `32: INSERT INTO contract_change_requests (` |
| 83 | `request_contract_termination(p_document_id uuid, p_reason text)` | `v` | **WRITER** | `38: INSERT INTO notifications (org_id, user_id, kind, title, body, link)`; `24: UPDATE documents SET termination_requested_at = now(), termination_requested_by ` |
| 84 | `request_documents_from_contact(p_contact_id uuid, p_template_keys text[], p_disposition text)` | `v` | **WRITER** | `34: INSERT INTO contact_required_documents (contact_id, template_key, org_id, dispos`; `38: ON CONFLICT (contact_id, template_key) DO UPDATE` |
| 85 | `request_permission_to_edit(p_document_id uuid, p_message text)` | `v` | **WRITER** | `27: INSERT INTO notifications (org_id, user_id, kind, title, link)` |
| 86 | `request_purchase_payment(p_purchase_id uuid, p_note text)` | `v` | **WRITER** | via `log_status_event`, `notify_user` |
| 87 | `require_resign_from(p_template_key text, p_contact_ids uuid[], p_reason text)` | `v` | **WRITER** | `26: INSERT INTO contact_required_documents (contact_id, template_key, org_id)`; `44: UPDATE documents SET current_status = 'superseded' WHERE id = dr.id;` |
| 88 | `resend_executed_document_email(p_document_id uuid)` | `v` | **WRITER** | `14: UPDATE documents SET executed_email_sent_at = NULL WHERE id = p_document_id;` |
| 89 | `resolve_change_request_thread(p_request_id uuid)` | `v` | **WRITER** | via `agree_change_request` |
| 90 | `resolve_consumption_billing(p_period tstzrange)` | `v` | **WRITER** | `75: INSERT INTO billable_lines`; `99: INSERT INTO billable_lines` (+2) |
| 91 | `resolve_version_decision(p_event_id uuid, p_resolution text, p_contact_ids uuid[])` | `v` | **WRITER** | `34: UPDATE template_version_events` |
| 92 | `restore_content_block_version(p_slug text, p_version integer)` | `v` | **WRITER** | via `save_content_block_version` |
| 93 | `restore_contract_template_version(p_template_key text, p_version integer)` | `v` | **WRITER** | via `_restore_contract_template_composition`, `save_contract_template_version` |
| 94 | `restore_email_template_version(p_email_key text, p_version integer)` | `v` | **WRITER** | via `save_email_template_version` |
| 95 | `restore_form_definition_version(p_form_key text, p_version integer)` | `v` | **WRITER** | via `save_form_definition_version` |
| 96 | `revoke_lesson_credit_grant(p_purchase_id uuid, p_reason text)` | `v` | **WRITER** | `71: UPDATE lesson_credits lc`; `82: UPDATE purchases` |
| 97 | `rls_auto_enable()` | `v` | **EVENT_TRIGGER** | `13: WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')`; `13: WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')` (+1) |
| 98 | `save_content_block_version(p_slug text, p_title text, p_body text, p_kind text, p_parent_version integer)` | `v` | **WRITER** | `28: insert into content_blocks (org_id, slug, kind, title, current_version)`; `53: insert into content_block_versions (block_id, version, body, parent_version, edi` (+1) |
| 99 | `save_contract_template_version(p_template_key text, p_title text, p_body text, p_parent_version integer)` | `v` | **WRITER** | `26: insert into contract_template_versions`; `53: insert into contract_template_versions` (+1) |
| 100 | `save_email_template_version(p_email_key text, p_title text, p_subject text, p_body text, p_parent_version integer)` | `v` | **WRITER** | `47: insert into email_template_versions`; `38: update email_templates` |
| 101 | `save_evaluation_report(p_report_id uuid, p_body text, p_title text, p_horse_label text)` | `v` | **WRITER** | `9: UPDATE evaluation_reports` |
| 102 | `save_form_definition_version(p_form_key text, p_title text, p_audience text, p_purpose text, p_schema jsonb, p_parent_version integer)` | `v` | **WRITER** | `27: insert into form_definition_versions (form_key, version, title, audience, purpos`; `48: insert into form_definition_versions` (+1) |
| 103 | `say_hi(p_to_user uuid)` | `v` | **WRITER** | `15: INSERT INTO member_greetings (org_id, from_user, to_user, kind)`; `18: INSERT INTO notifications (org_id, user_id, kind, title, body, link)` |
| 104 | `say_hi_back(p_to_user uuid)` | `v` | **WRITER** | `23: INSERT INTO member_greetings (org_id, from_user, to_user, kind)`; `28: INSERT INTO notifications (org_id, user_id, kind, title, body, link)` |
| 105 | `send_contract_to_party(p_document_id uuid, p_party_role text)` | `v` | **WRITER** | `24: INSERT INTO notifications (org_id, user_id, kind, title, body, link)`; `22: UPDATE documents SET sent_at = coalesce(sent_at, now()), updated_at = now() WHER` |
| 106 | `set_contact_required_documents(p_contact_id uuid, p_template_keys text[])` | `v` | **WRITER** | `44: INSERT INTO contact_required_documents (contact_id, template_key, org_id)`; `51: INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value,` (+1) |
| 107 | `set_contact_type(p_contact_id uuid, p_type text)` | `v` | **WRITER** | `15: UPDATE contacts` |
| 108 | `set_document_co_buyer(p_document_id uuid, p_contact_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_address_line1 text, p_city text, p_state text, p_postal_code text)` | `v` | **WRITER** | `40: INSERT INTO contacts (org_id, first_name, last_name, email, phone,`; `65: INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_si` (+2) |
| 109 | `set_document_party_archived(p_document_id uuid, p_archive boolean)` | `v` | **WRITER** | `15: INSERT INTO document_party_archives (document_id, contact_id, org_id)`; `17: ON CONFLICT (document_id, contact_id) DO UPDATE SET archived_at = now();` (+1) |
| 110 | `set_document_party_hidden(p_document_id uuid, p_hidden boolean)` | `v` | **WRITER** | `21: INSERT INTO document_party_hidden (document_id, contact_id, org_id)`; `25: DELETE FROM document_party_hidden` |
| 111 | `set_field_control_override(p_document_id uuid, p_field_key text, p_override jsonb)` | `v` | **WRITER** | `16: UPDATE contract_fields` |
| 112 | `set_field_included(p_document_id uuid, p_field_key text, p_included boolean)` | `v` | **WRITER** | `16: UPDATE contract_fields SET included = p_included, updated_at = now()` |
| 113 | `set_field_na(p_document_id uuid, p_field_key text, p_is_na boolean)` | `v` | **WRITER** | `16: UPDATE contract_fields` |
| 114 | `set_field_responsibility(p_document_id uuid, p_field_key text, p_responsibility jsonb)` | `v` | **WRITER** | `18: UPDATE contract_fields` |
| 115 | `set_field_structured(p_document_id uuid, p_field_key text, p_structured jsonb)` | `v` | **WRITER** | `70: UPDATE contract_fields`; `76: UPDATE documents` |
| 116 | `set_form_field_options(p_form_key text, p_field_key text, p_options text[], p_from_version integer)` | `v` | **WRITER** | via `save_form_definition_version` |
| 117 | `set_form_required(p_form_key text, p_required jsonb, p_from_version integer)` | `v` | **WRITER** | via `save_form_definition_version` |
| 118 | `set_horse_locations(p_horse_id uuid, p_payload jsonb)` | `v` | **WRITER** | `37: UPDATE horses SET` |
| 119 | `set_horse_medications(p_horse_id uuid, p_items jsonb)` | `v` | **WRITER** | `27: INSERT INTO horse_medications (`; `21: UPDATE horse_medications SET deleted_at = now() WHERE horse_id = p_horse_id AND ` |
| 120 | `set_lesson_progress_note(p_session_id uuid, p_note text)` | `v` | **WRITER** | via `save_booking_form` |
| 121 | `set_my_onboarding_horses(p_horse_ids uuid[], p_deferred_horse_ids uuid[])` | `v` | **WRITER** | `60: INSERT INTO document_horses (org_id, document_id, horse_id, position)`; `98: INSERT INTO notifications (org_id, user_id, kind, title, body, link)` (+3) |
| 122 | `set_support_status(p_id uuid, p_status text)` | `v` | **WRITER** | `15: UPDATE support_requests` |
| 123 | `share_evaluation_report(p_report_id uuid, p_email text, p_contact_id uuid)` | `v` | **WRITER** | `17: INSERT INTO evaluation_report_shares (org_id, report_id, shared_with_contact_id,`; `19: INSERT INTO evaluation_report_access (org_id, report_id, actor_user_id, action, ` |
| 124 | `sign_start_register_attempt(p_hash text, p_org uuid)` | `v` | **WRITER** | `24: INSERT INTO public.sign_start_attempts (requester_hash, window_start, count)`; `28: UPDATE public.sign_start_attempts SET count = count + 1` (+1) |
| 125 | `staff_assign_documents(p_contact_id uuid, p_template_keys text[])` | `v` | **WRITER** | `25: INSERT INTO contact_required_documents (contact_id, template_key, org_id)`; `27: ON CONFLICT (contact_id, template_key) DO UPDATE` (+1) |
| 126 | `staff_assign_horse_party(p_horse_id uuid, p_role text, p_contact_id uuid, p_term_start date, p_term_end date, p_sublease_allowed boolean, p_share_pct numeric, p_notes text)` | `v` | **WRITER** | `39: INSERT INTO horse_relationships`; `20: UPDATE horse_relationships SET active = false, ended_at = now()` (+3) |
| 127 | `staff_end_horse_relationship(p_id uuid)` | `v` | **WRITER** | `11: UPDATE horse_relationships SET active = false, ended_at = now()` |
| 128 | `staff_request_horse_record_completion(p_horse_id uuid)` | `v` | **WRITER** | via `notify_user` |
| 129 | `staff_update_horse(p_id uuid, p jsonb)` | `v` | **WRITER** | `9: UPDATE horses SET` |
| 130 | `start_bill_of_sale(p_sale_document_id uuid)` | `v` | **WRITER** | `37: UPDATE contract_fields b`; `46: UPDATE contract_fields SET value = 'YES'` (+1) |
| 131 | `start_bill_of_sale_standalone(p_buyer_contact_id uuid, p_seller_contact_id uuid, p_horse_id uuid)` | `v` | **WRITER** | `18: INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)`; `21: INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_si` (+2) |
| 132 | `start_sale_contract(p_buyer_contact_id uuid, p_seller_contact_id uuid, p_horse_id uuid, p_amount numeric, p_deposit numeric)` | `v` | **WRITER** | `28: INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)`; `31: INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_si` (+10) |
| 133 | `submit_acquisition_intake(p_purchase_item_id uuid, p_data jsonb)` | `v` | **WRITER** | `22: UPDATE purchase_items` |
| 134 | `submit_change_requests(p_document_id uuid)` | `v` | **WRITER** | `41: UPDATE contract_change_requests` |
| 135 | `submit_public_request(p_first_name text, p_last_name text, p_email text, p_phone text, p_contact_method text, p_notes text, p_proposed_times jsonb, p_category text, p_channel text, p_entry_location text, p_intent text, p_selections jsonb, p_details jsonb, p_interests text[])` | `v` | **WRITER** | `80: INSERT INTO requests (`; `104: INSERT INTO request_selections (request_id, org_id, offering_id, offering_slug, ` (+3) |
| 136 | `submit_support_request(p_subject text, p_body text)` | `v` | **WRITER** | `20: INSERT INTO support_requests (org_id, user_id, subject, body)` |
| 137 | `supersede_invitations(p_org uuid, p_email text, p_new_invitation_id uuid)` | `v` | **WRITER** | `11: UPDATE invitations`; `21: UPDATE invitations SET resend_of = (` |
| 138 | `transfer_payment_responsibility(p_purchase_id uuid, p_new_payer_contact_id uuid)` | `v` | **WRITER** | `26: UPDATE purchases` |
| 139 | `update_contact_record(p_contact_id uuid, p_patch jsonb)` | `v` | **WRITER** | `42: v_sql := 'UPDATE contacts SET ' \|\| array_to_string(` |
| 140 | `update_deal(p_deal_id uuid, p_deal_type text, p_notes text, p_title text)` | `v` | **WRITER** | `18: UPDATE deals SET title = nullif(btrim(p_title),'') WHERE id = p_deal_id;`; `36: UPDATE deals SET deal_type = p_deal_type WHERE id = p_deal_id;` (+2) |
| 141 | `update_horse_record(p_id uuid, p jsonb)` | `v` | **WRITER** | `15: UPDATE horses SET` |
| 142 | `update_purchase_payment_method(p_purchase_id uuid, p_method text)` | `v` | **WRITER** | `24: UPDATE purchases SET payment_method = v_method, updated_at = now()` |
| 143 | `upsert_change_request(p_document_id uuid, p_target_section text, p_body text)` | `v` | **WRITER** | `59: INSERT INTO contract_change_requests (`; `71: UPDATE contract_change_requests` (+1) |
| 144 | `upsert_content_block(p_slug text, p_title text, p_body text, p_kind text)` | `v` | **WRITER** | via `save_content_block_version` |
| 145 | `void_deal(p_deal_id uuid)` | `v` | **WRITER** | `16: UPDATE deals SET status = 'void', deleted_at = now(), deleted_by = current_conta`; `18: UPDATE contracts SET status = 'void' WHERE id = v_deal.contract_id;` |
| 146 | `void_document(p_document_id uuid, p_note text)` | `v` | **WRITER** | `33: UPDATE documents` |
| 147 | `_form_edit_base(p_form_key text, p_from_version integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 148 | `_unambiguous_purchase_for_client(p_client_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 149 | `admin_client_accounts()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 150 | `admin_client_bookings(p_user_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 151 | `admin_client_documents(p_user_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 152 | `admin_client_items(p_client_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 153 | `admin_client_messages(p_user_id uuid, p_limit integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 154 | `admin_client_overview(p_user_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 155 | `admin_form_definitions()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 156 | `admin_oversight()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 157 | `app_role()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 158 | `booking_notifies_client(p_booking bookings)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 159 | `booking_service_type(p_booking bookings)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 160 | `calendar_money_items(p_from timestamp with time zone, p_to timestamp with time zone)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 161 | `caller_is_document_party(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 162 | `caller_is_document_party_or_staff(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 163 | `caller_may_propose(p_document_id uuid, p_control text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 164 | `caller_may_resolve(p_document_id uuid, p_proposed_by_contact_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 165 | `caller_may_use_horse(p_contact uuid, p_horse uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 166 | `caller_owns_document(doc_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 167 | `caller_owns_horse(h_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 168 | `caller_party_roles(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 169 | `can_list_horse(p_horse_id uuid, p_intent text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 170 | `can_void_document(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 171 | `capture_contract_template_composition(p_template_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 172 | `category_document_defaults()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 173 | `claim_request_alert_send(p_request_id uuid, p_key text, p_kind text)` | `v` | **reader** | — no write statement in the body, no writing callee |
| 174 | `client_can_read_horse(h_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 175 | `client_monthly_plan(p_client_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 176 | `comped_credit_value(p_from date, p_to date)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 177 | `config_required_missing(p_org uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 178 | `config_value(p_ns text, p_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 179 | `contact_dossier(p_contact_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 180 | `contact_locations(p_contact_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 181 | `content_block_version_at(p_slug text, p_version integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 182 | `content_block_version_list(p_slug text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 183 | `contract_caller_is_originator(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 184 | `contract_change_requests_list(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 185 | `contract_deal_type(p_contract_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 186 | `contract_event_log(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 187 | `contract_notes_for_document(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 188 | `contract_party_options()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 189 | `contract_role_document_requirements(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 190 | `contract_section_tree(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 191 | `contract_signing_set_complete(p_contract_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 192 | `contract_template_version_at(p_template_key text, p_version integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 193 | `contract_template_version_list(p_template_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 194 | `credit_ledger(p_client_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 195 | `current_client_id()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 196 | `current_contact_id()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 197 | `current_org()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 198 | `deal_activity(p_deal_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 199 | `deal_completion_state(p_deal_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 200 | `deal_detail(p_deal_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 201 | `deal_document_status(p_deal_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 202 | `deal_governing_document(p_deal_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 203 | `deal_record_export(p_deal_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 204 | `dm_list_conversations()` | `v` | **reader** | — no write statement in the body, no writing callee |
| 205 | `dm_unread_total()` | `v` | **reader** | — no write statement in the body, no writing callee |
| 206 | `document_changes_since_signature(p_document_id uuid, p_contact_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 207 | `document_delivery_is_held(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 208 | `document_parties_summary(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 209 | `document_signature_state(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 210 | `email_template_version_at(p_email_key text, p_version integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 211 | `email_template_version_list(p_email_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 212 | `entity_status_log(p_entity_type text, p_entity_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 213 | `feed_get(p_limit integer, p_before timestamp with time zone)` | `v` | **reader** | — no write statement in the body, no writing callee |
| 214 | `feed_my_posts()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 215 | `form_version_at(p_form_key text, p_version integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 216 | `form_version_list(p_form_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 217 | `general_release_preview(p_org uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 218 | `get_content_block(p_slug text, p_context jsonb)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 219 | `gift_claim_link(p_gift_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 220 | `grantable_offerings()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 221 | `has_module(p_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 222 | `has_staff_access()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 223 | `horse_deals(p_horse_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 224 | `horse_field_token_value(v_horse horses, p_field text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 225 | `horse_medications_list(p_horse_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 226 | `horse_page_detail(p_horse_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 227 | `horse_time_conflict(p_org uuid, p_horse uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_exclude_id uuid, p_exclude_series uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 228 | `inbound_open_count()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 229 | `instructor_options()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 230 | `intake_requirements(p_channel text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 231 | `invitation_expiry_days(p_org uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 232 | `invitation_replacement_notice(p_token text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 233 | `is_active_member()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 234 | `is_admin()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 235 | `is_org_admin()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 236 | `is_super_admin()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 237 | `lease_edit_guard(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 238 | `list_deals()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 239 | `list_service_types()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 240 | `member_horses(p_user_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 241 | `my_acquisition_intake_state()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 242 | `my_documents()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 243 | `my_first_lesson_state()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 244 | `my_fulfillment()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 245 | `my_gifts()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 246 | `my_lesson_progress()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 247 | `my_listable_horses(p_intent text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 248 | `my_locations()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 249 | `my_modules()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 250 | `my_monthly_plan()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 251 | `my_name_confirmation_state()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 252 | `my_onboarding_checklist()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 253 | `my_property_term()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 254 | `my_purchase_categories()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 255 | `my_stable_horses(p_as_company boolean)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 256 | `my_standing_categories()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 257 | `my_view_surfaces()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 258 | `my_wall_state()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 259 | `onboarding_template_options()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 260 | `org_public_config(p_slug text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 261 | `owns_order(p_order_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 262 | `payer_candidates()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 263 | `pending_notify_summary(p_document_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 264 | `pending_version_decisions()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 265 | `public_offerings(p_slug text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 266 | `release_preview(p_template_key text, p_org uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 267 | `request_onboarding_categories(p_request_id uuid, p_contact_id uuid, p_include_held boolean)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 268 | `require_module(p_key text)` | `v` | **reader** | — no write statement in the body, no writing callee |
| 269 | `required_templates_for_contact(p_contact_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 270 | `reschedule_fee(p_org uuid, p_start timestamp with time zone)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 271 | `resolve_property_term(p_org uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 272 | `roster_service_slots()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 273 | `sole_org()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 274 | `staff_assignable_templates(p_contact_id uuid)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 275 | `staff_contact_directory()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 276 | `staff_contact_options()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 277 | `staff_evaluation_reports()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 278 | `staff_horse_records()` | `s` | **reader** | — no write statement in the body, no writing callee |
| 279 | `status_feed(p_entity_type text, p_true_only boolean, p_limit integer)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 280 | `template_past_signers(p_template_key text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 281 | `validate_invitation(p_token text)` | `s` | **reader** | — no write statement in the body, no writing callee |
| 282 | `apply_contract_execution_effects()` | `v` | **TRIGGER** | `63: INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,`; `84: INSERT INTO horse_relationships (org_id, horse_id, relationship, party_contact_i` (+5) |
| 283 | `apply_document_supersession()` | `v` | **TRIGGER** | `26: UPDATE documents SET current_status = 'superseded' WHERE id = r.id;` |
| 284 | `assert_template_is_satisfiable()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 285 | `attach_first_purchase_policies()` | `v` | **TRIGGER** | `35: INSERT INTO contact_required_documents (contact_id, template_key, org_id)` |
| 286 | `audit_row_change()` | `v` | **TRIGGER** | `26: INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value,` |
| 287 | `bookings_derive_account_contact_id()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 288 | `contacts_convert_lead_on_client()` | `v` | **TRIGGER** | `8: UPDATE contacts` |
| 289 | `contacts_file_on_insert()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 290 | `contacts_file_team_on_link()` | `v` | **TRIGGER** | `12: UPDATE contacts` |
| 291 | `contract_split_deductible_sync()` | `v` | **TRIGGER** | `24: UPDATE contract_fields SET value=''`; `31: UPDATE contract_fields SET value=''` (+6) |
| 292 | `contracts_ensure_deal()` | `v` | **TRIGGER** | via `ensure_deal_for_contract` |
| 293 | `deal_autocomplete_on_execution()` | `v` | **TRIGGER** | `25: UPDATE contracts`; `64: UPDATE deals SET status = 'complete', completed_at = now() WHERE id = v_deal.id;` (+1) |
| 294 | `documents_send_executed_email()` | `v` | **TRIGGER** | `34: UPDATE documents SET delivery_held_at = coalesce(delivery_held_at, now())`; `44: UPDATE documents SET executed_email_error = SQLERRM WHERE id = NEW.id;` |
| 295 | `freeze_signed_template_version()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 296 | `members_post_join_event()` | `v` | **TRIGGER** | `20: INSERT INTO feed_posts (org_id, author_id, post_type, body, visibility, publishe` |
| 297 | `mirror_admin_notification()` | `v` | **TRIGGER** | `19: INSERT INTO notifications (org_id, user_id, kind, title, body, link)` |
| 298 | `notifications_capture_provenance()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 299 | `profiles_link_contact()` | `v` | **TRIGGER** | via `ensure_contact_for_profile` |
| 300 | `profiles_role_guard()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 301 | `profiles_sync_staff_profile()` | `v` | **TRIGGER** | via `ensure_staff_profile` |
| 302 | `promote_buyer_from_offering()` | `v` | **TRIGGER** | via `apply_affiliations` |
| 303 | `record_template_version_bump()` | `v` | **TRIGGER** | `9: INSERT INTO template_version_events (template_key, from_version, to_version)` |
| 304 | `requests_capture_contact()` | `v` | **TRIGGER** | `22: INSERT INTO contacts (org_id, first_name, last_name, email, phone, contact_type,`; `38: UPDATE requests SET contact_id = v_contact` |
| 305 | `seed_contract_note()` | `v` | **TRIGGER** | `12: INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)` |
| 306 | `snapshot_execution_audit()` | `v` | **TRIGGER** | `21: INSERT INTO contract_execution_audit (` |
| 307 | `sync_document_primary_horse()` | `v` | **TRIGGER** | `18: UPDATE documents SET horse_id = v_primary, updated_at = now()` |
| 308 | `sync_horse_fields_to_documents()` | `v` | **TRIGGER** | `41: UPDATE contract_fields SET value = v_new, updated_at = now() WHERE id = f.id;` |
| 309 | `sync_horse_id_to_document_horses()` | `v` | **TRIGGER** | `23: INSERT INTO document_horses (org_id, document_id, horse_id, position)`; `19: UPDATE document_horses dh` |
| 310 | `sync_profile_name_from_contact()` | `v` | **TRIGGER** | `10: UPDATE profiles` |
| 311 | `trg_apply_affiliations_on_doc()` | `v` | **TRIGGER** | via `apply_affiliations` |
| 312 | `trg_apply_affiliations_on_horse()` | `v` | **TRIGGER** | via `apply_affiliations` |
| 313 | `trg_apply_affiliations_on_party()` | `v` | **TRIGGER** | via `apply_affiliations` |
| 314 | `trg_booking_unit_link()` | `v` | **TRIGGER** | `20: UPDATE fulfillment_units SET booking_id = NULL WHERE id = ANY(v_units);`; `38: UPDATE fulfillment_units SET booking_id = NULL WHERE id = ANY(v_units);` |
| 315 | `trg_contacts_cascade_family_key()` | `v` | **TRIGGER** | `10: UPDATE contacts d` |
| 316 | `trg_contacts_family_sort_key()` | `v` | **TRIGGER** | — no write statement in the body, no writing callee |
| 317 | `trg_documents_when_order_opens()` | `v` | **TRIGGER** | via `apply_offering_documents`, `notify_user` |
| 318 | `trg_evaluation_unit_link()` | `v` | **TRIGGER** | `16: UPDATE fulfillment_units SET report_id = NEW.id WHERE id = v_u;` |
| 319 | `trg_generate_fulfillment_units()` | `v` | **TRIGGER** | via `generate_fulfillment_units` |
| 320 | `trg_mint_credits_when_order_opens()` | `v` | **TRIGGER** | via `_mint_credits_for_purchase_item` |
| 321 | `trg_mint_purchase_credits()` | `v` | **TRIGGER** | via `_mint_credits_for_purchase_item` |
| 322 | `trg_status_bookings()` | `v` | **TRIGGER** | `13: INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id` |
| 323 | `trg_status_documents()` | `v` | **TRIGGER** | `13: INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id` |
| 324 | `trg_status_invitations()` | `v` | **TRIGGER** | `13: INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor` |
| 325 | `trg_status_purchases()` | `v` | **TRIGGER** | `16: INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id` |
| 326 | `trg_wake_held_orders_on_horse()` | `v` | **TRIGGER** | `24: UPDATE purchases SET status = 'awaiting_payment', updated_at = now() WHERE id = ` |
---

## CLOSE — 2026-09-03

- `origin/main` MOVED during this session: `2779ca2c` → **`a1399848`** ("CR-112·A1: the fourteen proposed
  items filed verbatim"). My merge-base is unchanged at `2779ca2c` and nothing I wrote exists on either
  side of that move. `git diff --stat $(git merge-base HEAD origin/main)` = **4 files, all under `docs/`,
  1296 insertions, 0 deletions.** ⚠️ Diff against the MERGE-BASE, not `origin/main` — against
  `origin/main` the same command reads as if this branch deleted `BUNDLE-DASHBOARDS.md`,
  `BUNDLE-FUNNELDEBT.md` and part of `CHANGE-ORDER-LEDGER.md`, which are ORCH's new commits.
- Six commits on `task/grants-a-spec`, not pushed. **Merging is MGMT's (`MGMT-ROLE.md` §3).**
- **Nothing was written to the database.** Every statement this thread ran was `SELECT` /
  `has_function_privilege` / `pg_get_functiondef`. No function was called to see what it would do.
- TEARDOWN: no server, no browser, no scratch worktree started. `psql` was one-shot per invocation.
- **PROCESS CENSUS, 2026-09-03 close:** `ps -Ao pid,ppid,etime,command | grep -Ei "vite|node .*(dev|preview)|psql|playwright|chrome|npm run"` → **no `node`, no `vite`, no dev server, no `psql`, no Playwright.** The only matches are the owner's own Google Chrome (pid 507, uptime 1d 04h — predates this thread by a day). **Nothing to kill.**
- **Worktree census at close (the pool grew during the session — wt-9/10/11 are new, not mine):**
  `fhe-website-app` a1399848 [main] · `wt-1` [bundle/grants] · `wt-2` [task/grants-a-spec ← MINE] ·
  `wt-3` [bundle/supplies] · `wt-4` [task/supplies-a] · `wt-5` detached · `wt-6` detached ·
  `wt-7` [bundle/dashboards] · `wt-8` detached · `wt-9` [bundle/funneldebt] · `wt-10`/`wt-11` detached.
  **wt-2 is then returned detached at `origin/main` and clean.**
