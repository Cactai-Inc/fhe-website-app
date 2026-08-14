# UNVIEWED INVENTORY — Part B

Evidence gathered 2026-08-13 against **live prod** (`psql` as `postgres`, PostgreSQL 17.6) and the worktree at `/Users/cactai/Downloads/claude-code-repo/wt-flagharvest`.
Read-only. Nothing changed. Nothing recommended for deletion.

**Scan credibility (positive control).** The `pg_proc.prosrc` scan used throughout was validated on every run against two names known to be alive:

```
target                                  other_fns_mentioning
has_staff_access                        185
caller_is_document_party                 39
```

A scan that returns 185 and 39 for live helpers is working; a `0` from the same scan is therefore meaningful.

**Five claims below are now STALE or WRONG.** Flagged inline in bold: #2, #4, #6, #7, #8/#9 (ACL half), #14.

---

## public.clients_overview (view — public.clients_overview)
- reported by: TASK-SECFIX-REPORT.md
- reachability: VERIFIED unreachable from application code. `grep -rn "clients_overview" src/ api/` → **no output**. The only hits repo-wide are in the generated test fixture `test/db/fixtures/schema_snapshot.sql:20983,20986` (the schema dump itself, not a read). `anon` SELECT is revoked in prod (`has_table_privilege('anon', …, 'SELECT')` = **f**); `authenticated` retains SELECT = t. Claim CONFIRMED.
- exists: yes
- content:

Definition (`pg_get_viewdef('public.clients_overview', true)`):
```sql
 SELECT cl.id,
    cl.status,
    cl.source,
    cl.created_at,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.display_code
   FROM clients cl
     JOIN contacts c ON c.id = cl.contact_id
  WHERE cl.deleted_at IS NULL;
```

Row count: **17**

reloptions: `{security_invoker=true}`

Grants (`relacl`):
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```
Note the `anon` grant string is `awdDxtm` — the `r` (SELECT) is absent, which is the SECFIX revoke. `authenticated` is `arwdDxtm` (has `r`).

Privilege matrix:
```
     relname      | anon_select | auth_select | svc_select
------------------+-------------+-------------+------------
 clients_overview | f           | t           | t
```

---

## public.service_credits (view — public.service_credits)
- reported by: TASK-SECFIX-REPORT.md
- reachability: VERIFIED unreachable from application code. `grep -rn "service_credits" src/ api/` → **no output**. Only hits are `test/db/fixtures/schema_snapshot.sql:23274,23277`. `anon` SELECT revoked (= f), `authenticated` = t. The *reference* claim is CONFIRMED.
- exists: yes
- content:

**⚠️ THE ROW-COUNT CLAIM IS NOW STALE. The report said 0 rows at verification time. It now holds 3 rows, all created 2026-08-10, and two of them have been DECREMENTED since (`updated_at` later than `created_at`, `remaining` dropped 1 → 0).** This view is a live read-alias over `lesson_credits` and the underlying data is actively moving. It is not an empty shell.

Definition (`pg_get_viewdef('public.service_credits', true)`):
```sql
 SELECT id,
    org_id,
    client_id,
    offering_id,
    package_key,
    credits_total AS total,
    credits_remaining AS remaining,
    credits_total,
    credits_remaining,
    purchased_at,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
   FROM lesson_credits;
```

CURRENT row count: **3**

Current rows in full:
```
                  id                  |                org_id                |              client_id               | offering_id |  package_key   | total | remaining | credits_total | credits_remaining |         purchased_at          |          created_at           |          updated_at           | deleted_at | deleted_by
--------------------------------------+--------------------------------------+--------------------------------------+-------------+----------------+-------+-----------+---------------+-------------------+-------------------------------+-------------------------------+-------------------------------+------------+------------
 3ccdbec2-37f5-4b6e-9082-ed7596d85d98 | e656f20b-ef43-4725-9029-19e7f0190d9c | 0a20faf4-a6a4-4965-898c-e992f2a74e01 |             | Full Body Clip |     1 |         1 |             1 |                 1 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 |            |
 d32fb522-7594-4ea2-a205-287f767baf2d | e656f20b-ef43-4725-9029-19e7f0190d9c | 0a20faf4-a6a4-4965-898c-e992f2a74e01 |             | Single Class   |     1 |         0 |             1 |                 0 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 16:45:29.93967+00  |            |
 a8fabb31-9ec2-464a-8cbe-8bcb8e3dac47 | e656f20b-ef43-4725-9029-19e7f0190d9c | 0a20faf4-a6a4-4965-898c-e992f2a74e01 |             | Single Lesson  |     1 |         0 |             1 |                 0 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 16:45:58.26652+00  |            |
```

reloptions: `{security_invoker=true}`

Grants (`relacl`):
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Privilege matrix:
```
    relname     | anon_select | auth_select | svc_select
----------------+-------------+-------------+------------
 service_credits| f           | t           | t
```

---

## public.memberships (view — public.memberships)
- reported by: TASK-SECFIX-REPORT.md
- reachability: The "two grep hits are prose comments" claim is CONFIRMED **for `src/` and `api/`** — `grep -rn "memberships" src/ api/` returns exactly two lines, both in `api/hard-delete-client.ts`, both comments about FK cascade, neither a view read. **However the claim understates reach: `test/db/` contains real SQL reads and writes against `memberships`** (`membership_self_heal.test.ts:53,71,81,90,100,107`, `redeem_invitation.test.ts:40,64,70`, `platform_catalog_org_scope.test.ts:66`). Those run against the PGlite harness, not prod, but they are live executable references, not prose. `anon` SELECT revoked (= f); `authenticated` = t.
- exists: yes
- content:

The two `api/hard-delete-client.ts` hits, verbatim:
```
api/hard-delete-client.ts:12: * memberships / grants (all FK ON DELETE CASCADE on user_id).
api/hard-delete-client.ts:48:    //    cascades profiles / memberships / grants. ──
```

In context (lines 10–13 and 46–49) these read:
```
 * Body: { contactId } for a client, OR { userId } for a team member (staff
 * accounts have no contact row). Deleting the auth user cascades profiles /
 * memberships / grants (all FK ON DELETE CASCADE on user_id).
 * -> 200 { ok, deletedUser, deletedContact }
...
    // ── Team-member (user_id) path: no contact row. Deleting the auth user
    //    cascades profiles / memberships / grants. ──
    if (!contactId && userId) {
```
Both are comments describing the `members` base-table cascade. Neither reads the view. CONFIRMED.

Definition (`pg_get_viewdef('public.memberships', true)`):
```sql
 SELECT id,
    user_id,
    status,
    started_at,
    renews_at,
    created_at,
    org_id
   FROM members;
```

Row count: **12**

reloptions: `{security_invoker=true}`

Grants (`relacl`):
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Also worth seeing — the base table still carries a constraint named for the view, and a live self-heal function references the concept:
```
test/db/fixtures/schema_snapshot.sql:24733:-- Name: members memberships_pkey; Type: CONSTRAINT
test/db/fixtures/schema_snapshot.sql:24741:-- Name: members memberships_user_id_key; Type: CONSTRAINT
```

---

## public.ensure_gift_buyer_account(uuid) (function — public.ensure_gift_buyer_account)
- reported by: TASK-SECFIX2-REPORT.md
- reachability: **THE CLAIM IS NOW WRONG. This function is NOT dead — it has a live in-database caller.** The `pg_proc.prosrc` scan (the same scan that returns 185 for `has_staff_access`) finds **1** other function whose body references it:

  ```
  ensure_gift_buyer_account | 1
  ```
  ```
  === WHO MENTIONS ensure_gift_buyer_account ===
  create_gift(uuid,text,text,text,text,text,boolean,uuid)
  ```

  So: `grep -rn "ensure_gift_buyer_account" src/ api/` → no output (correct, no TS caller); `pg_depend` non-internal dependencies → none (correct, function-to-function calls in plpgsql do not create pg_depend rows — which is exactly why the original three-way check missed it); but the **prosrc scan now finds `create_gift`, which calls it for real**. The report's own premise ("gift redemption runs through redeem_gift, which never calls it") is true but incomplete — it is *gift creation*, not gift redemption, that calls it. GIFTCREDITS item D8/4b explicitly revived this call site on 2026-08-11, after SECFIX2 was written.

  Separately, the ACL has since been hardened: `anon` and `authenticated` EXECUTE are both now **f** (`proacl = {postgres=X/postgres,service_role=X/postgres}`).
- exists: yes
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.ensure_gift_buyer_account(p_gift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_g      gifts%ROWTYPE;
  v_res    jsonb;
  v_fn     text;
  v_ln     text;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF v_g.org_id IS NULL OR nullif(btrim(coalesce(v_g.buyer_email,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing org or buyer email');
  END IF;

  v_fn := nullif(split_part(coalesce(v_g.buyer_name,''), ' ', 1), '');
  v_ln := nullif(btrim(substr(coalesce(v_g.buyer_name,''),
            coalesce(nullif(position(' ' in coalesce(v_g.buyer_name,'')), 0),
                     length(coalesce(v_g.buyer_name,''))+1))), '');

  -- THE SPINE, with the commercial marker. Categories empty → no service docs.
  v_res := _ensure_client_account(v_g.org_id, lower(btrim(v_g.buyer_email)),
                                  v_fn, v_ln, ARRAY[]::text[], ARRAY[]::text[], 'CUSTOMER');
  RETURN jsonb_build_object('ok', true, 'contact_id', v_res->>'contact_id');
END;
$function$
```

ACL / volatility / security: `VOLATILE`, `SECURITY DEFINER`, `proacl = {postgres=X/postgres,service_role=X/postgres}` (no PUBLIC, no anon, no authenticated).

**The live call site, in `create_gift`** — this is the evidence that contradicts the claim:
```sql
  -- D8/4b: revives the buyer-account call site written in Stage 4 for exactly
  -- this moment — dead until now because nothing created a gift. Soft-fails:
  -- a buyer-account hiccup must not block the gift itself from existing, but
  -- (matching the D3 lesson) it must not be a silent NULL either.
  BEGIN
    v_buyer_acct := ensure_gift_buyer_account(v_gift);
  EXCEPTION WHEN others THEN
    PERFORM notify_staff(v_off.org_id, 'gift_buyer_account_failed',
      'Gift ' || v_code || ' created, but buyer account setup failed for '
        || p_buyer_email || ' — ' || SQLERRM,
      '/app/ops/intake');
  END;
```
and its result is returned to the caller:
```sql
  RETURN jsonb_build_object(
    'gift_id', v_gift, 'code', v_code,
    'claim_link', '/redeem?code=' || v_code,
    'buyer_contact_id', v_buyer_acct->>'contact_id');
```

**The account-creation branch of `redeem_gift`, for comparison** (this is what runs for the *recipient*, a different person from the buyer):
```sql
  -- D2 (owner ruling 2026-08-11): the taxonomy splits on what the person
  -- HOLDS, not who paid. A real service (config_kind present, not a pure
  -- inquiry line — the same test attach_first_purchase_policies and
  -- promote_buyer_from_offering already use) makes the redeemer a CLIENT.
  -- Anything else — no linked offering, or a non-service line — CUSTOMER:
  -- they hold something but received no experience.
  v_marker := CASE
    WHEN v_off.config_kind IS NOT NULL AND v_off.config_kind <> 'inquire' THEN 'CLIENT'
    ELSE 'CUSTOMER'
  END;

  v_fn := nullif(split_part(coalesce(v_gift.recipient_name, ''), ' ', 1), '');
  v_ln := nullif(btrim(substr(coalesce(v_gift.recipient_name, ''),
            coalesce(nullif(position(' ' in coalesce(v_gift.recipient_name,'')), 0),
                     length(coalesce(v_gift.recipient_name,''))+1))), '');

  BEGIN
    PERFORM set_config('app.allow_profile_link', '1', true);
    INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
    VALUES (auth.uid(), v_gift.org_id, v_fn, v_ln, v_email)
    ON CONFLICT (user_id) DO NOTHING;

    -- BUG FIX: NULL/NULL, not ARRAY[]::text[]/ARRAY[]::text[]. An empty (but
    -- non-NULL) template_keys array took _ensure_client_account's "insert
    -- these specific docs" branch and unnested to zero rows — permanently
    -- skipping its "derive from category" fallback. NULL lets that fallback
    -- run (category defaults to GUEST for a brand-new contact); the real
    -- RIDER/HORSE_OWNER category — and the documents it requires — gets
    -- derived a moment later from the purchase itself, same as every other
    -- purchase path (see below).
    v_res := _ensure_client_account(v_gift.org_id, v_email, v_fn, v_ln, NULL, NULL, v_marker);
    v_contact := (v_res->>'contact_id')::uuid;
    v_client  := (v_res->>'client_id')::uuid;
    ...
    PERFORM promote_contact_to_account(auth.uid(), v_contact);
  EXCEPTION WHEN others THEN
    PERFORM notify_staff(v_gift.org_id, 'gift_redemption_failed',
      'Gift ' || v_gift.code || ' redemption failed for ' || v_email || ' — ' || SQLERRM,
      '/app/ops/intake');
    RETURN 'redemption_failed';
  END;
```

The two are complementary, not duplicative: `ensure_gift_buyer_account` hard-codes marker `'CUSTOMER'` and `ARRAY[]::text[]` categories (buyer gets no service docs); `redeem_gift` computes `CLIENT` vs `CUSTOMER` from the offering and passes `NULL/NULL` so the category fallback runs. They provision two different people.

---

## public.member_directory (view — public.member_directory)
- reported by: TASK-SECFIX2-REPORT.md
- reachability: CONFIRMED unreadable by every web role. `has_table_privilege` returns **f for both `anon` and `authenticated`**; only `service_role` (and the owner `postgres`) can SELECT. `grep -rn "from('member_directory')" src/ api/` → **no output** (exit 1). Every `member_directory` string in `src/` is either a prose comment or the *different* object `member_directory_list` (a SECURITY DEFINER RPC), e.g. `src/lib/community.ts:36,44` call `supabase.rpc('member_directory_list')`. `security_invoker=true` confirmed in reloptions. Claim CONFIRMED in full.
- exists: yes
- content:

Definition (`pg_get_viewdef('public.member_directory', true)`):
```sql
 SELECT p.user_id,
    p.display_name,
    COALESCE(p.first_name, c.first_name) AS first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
        CASE
            WHEN c.hide_community_email THEN NULL::text
            ELSE c.community_email
        END AS community_email,
        CASE
            WHEN c.hide_mobile_call THEN NULL::text
            ELSE c.mobile_call
        END AS mobile_call,
        CASE
            WHEN c.hide_mobile_text THEN NULL::text
            ELSE c.mobile_text
        END AS mobile_text,
        CASE
            WHEN c.hide_whatsapp_call THEN NULL::text
            ELSE c.whatsapp_call
        END AS whatsapp_call,
        CASE
            WHEN c.hide_whatsapp_text THEN NULL::text
            ELSE c.whatsapp_text
        END AS whatsapp_text,
        CASE
            WHEN c.hide_email THEN NULL::text
            ELSE c.email
        END AS email,
        CASE
            WHEN c.hide_mobile THEN NULL::text
            ELSE c.mobile
        END AS mobile,
        CASE
            WHEN c.hide_whatsapp THEN NULL::text
            ELSE c.whatsapp
        END AS whatsapp,
    c.social_tiktok,
    c.social_instagram,
    c.social_facebook,
    c.social_linkedin,
    (EXISTS ( SELECT 1
           FROM horses h
          WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL)) AS is_horse_owner,
        CASE
            WHEN c.preferred_contact = 'email'::text AND (c.hide_community_email OR c.community_email IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'sms'::text AND (c.hide_mobile_text OR c.mobile_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'call'::text AND (c.hide_mobile_call OR c.mobile_call IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'whatsapp'::text AND (c.hide_whatsapp_text OR c.whatsapp_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'instagram'::text AND c.social_instagram IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'facebook'::text AND c.social_facebook IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'linkedin'::text AND c.social_linkedin IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'tiktok'::text AND c.social_tiktok IS NULL THEN 'none'::text
            ELSE c.preferred_contact
        END AS preferred_contact
   FROM profiles p
     JOIN members m ON m.user_id = p.user_id AND m.status = 'active'::text
     JOIN contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
  WHERE NOT p.is_suspended AND p.role IS DISTINCT FROM 'SUPER_ADMIN'::text;
```

reloptions (proves `security_invoker`):
```
{security_invoker=true}
```

Grants (`relacl`) — note neither `anon` nor `authenticated` carries `r`:
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=awdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Privilege matrix (proves no web role can read):
```
     relname      | anon_select | auth_select | svc_select
------------------+-------------+-------------+------------
 member_directory | f           | f           | t
```

Row count read as `postgres` (superuser): **9**

The prose references left behind in `src/` that still describe it as the enforcement point:
```
src/pages/app/MemberProfile.tsx:14:  * DM conversation) and Say hi. Reads the member_directory view (hide/allow prefs
src/pages/app/MemberProfile.tsx:111: hide-from-community is enforced server-side by member_directory. */}
src/lib/community.ts:26: /* SECFIX2 G2: both reads go through the `member_directory_list` definer RPC, not
src/lib/community.ts:27:  * the `member_directory` view. The view was postgres-owned with security_invoker
```

---

## caller_is_document_party wiring into documents_select / my_documents() (policy + function)
- reported by: TASK-A-PARTY-VERIFY-REPORT.md
- reachability: **THE GAP IS CLOSED. This claim is STALE.** As of prod today, `caller_is_document_party` is OR'd into **both** `documents_select` and `my_documents()`. The report described the state before DOCVIS (`62e83de`) landed. Verified directly against `pg_policies` and `pg_get_functiondef` below. Note also that `caller_is_document_party` is very much alive generally — the prosrc scan finds **39** other functions referencing it.
- exists: yes (all three objects present; gap remediated, not removed)
- content:

Full source of `caller_is_document_party`:
```sql
CREATE OR REPLACE FUNCTION public.caller_is_document_party(p_document_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
    WHERE d.id = p_document_id
      AND d.deleted_at IS NULL
      AND dp.contact_id = current_contact_id()
  );
$function$
```
ACL: `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — PUBLIC EXECUTE, `STABLE`, `SECURITY DEFINER`.

`document_shares_party_read` policy (the usage the report said was correct — still correct):
```
document_shares | document_shares_party_read | SELECT | roles={authenticated}
  USING: (is_admin() OR caller_is_document_party(document_id))
  CHECK: (none)
```

**CURRENT `documents_select` policy — the party arm IS present now:**
```
documents | documents_select | SELECT | roles={authenticated}
  USING: (has_staff_access() OR caller_owns_document(id) OR caller_is_document_party(id) OR ((horse_id IS NOT NULL) AND client_can_read_horse(horse_id)))
  CHECK: (none)
```

For completeness, the other two policies on `documents`:
```
documents | documents_admin_write   | ALL | roles={authenticated}
  USING: is_admin()
  CHECK: is_admin()
documents | documents_org_boundary  | ALL | roles={authenticated}
  USING: (org_id = current_org())
  CHECK: (org_id = current_org())
```

**CURRENT `my_documents()` source — `caller_is_document_party(d.id)` appears in two of the three UNION arms:**
```sql
CREATE OR REPLACE FUNCTION public.my_documents()
 RETURNS TABLE(document_id uuid, template_key text, title text, kind text, signed_at timestamp with time zone, current_status text, superseded boolean, created_at timestamp with time zone, executed_email_sent_at timestamp with time zone, is_contract boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- pending (generated but unsigned)
  SELECT d.id, ct.template_key, ct.title, 'pending'::text,
         NULL::timestamptz, d.current_status, false, d.created_at, NULL::timestamptz,
         EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status <> 'EXECUTED' AND coalesce(d.current_status,'') <> 'void'
  UNION ALL
  -- assigned but not yet generated (a placeholder: there is no document yet, so
  -- it is not a contract)
  SELECT NULL::uuid, crd.template_key, ct.title, 'assigned'::text,
         NULL::timestamptz, 'assigned', false, now(), NULL::timestamptz,
         false
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = current_contact_id()
     AND NOT EXISTS (SELECT 1 FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
                      WHERE d.contact_id = crd.contact_id AND d.deleted_at IS NULL
                        AND ct2.template_key = crd.template_key
                        AND (d.status <> 'EXECUTED' OR (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded')))
  UNION ALL
  -- executed, signing order (newest last → FE may reverse per page convention)
  SELECT d.id, ct.template_key, ct.title, 'executed'::text,
         (SELECT max(s.signed_at) FROM signatures s WHERE s.document_id = d.id AND s.deleted_at IS NULL),
         d.current_status, (d.current_status = 'superseded'), d.created_at, d.executed_email_sent_at,
         EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
   ORDER BY 4 DESC, 8;
$function$
```

Note the middle arm (`assigned`) is still keyed on `crd.contact_id = current_contact_id()` only — by construction, since a required-document assignment belongs to a contact, not to a document party. That is not the reported gap.

---

## public.void_signatures_on_edit(uuid) (function — GONE from prod)
- reported by: TASK-NOGUARD1-REPORT.md
- reachability: n/a — **the function no longer exists.** `select count(*) from pg_proc … where proname='void_signatures_on_edit'` → **0**. A schema-wide scan (`proname ilike '%void_signature%'`, all schemas) → **0 rows**. `pg_trigger` join on `tgfoid` for this name → **0 rows** (no trigger used it, consistent with the claim). The prosrc scan → **0** other functions reference it. `grep -rn "void_signatures_on_edit" src/ api/` → no output.
- exists: **deleted** — dropped by `supabase/migrations/20260810T0100_noguard2_drop_void_signatures_on_edit.sql:118` (`DROP FUNCTION public.void_signatures_on_edit(uuid);`, no CASCADE).
- content:

**The anon-EXECUTE claim was TRUE when written and is now MOOT — the whole function was removed by NOGUARD2 the same day.** The drop migration recorded the exact ACL it had at the time:
```
--   proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,
--            authenticated=X/postgres,service_role=X/postgres}
--   documents with live signatures : 61
--   live signature rows            : 62
--   documents.signatures_voided_at IS NOT NULL : 0 of 81
```
i.e. PUBLIC + anon + authenticated all held EXECUTE, 61 documents were in range, and **it had never fired once in production**.

Full source as it last existed (recovered from `test/db/fixtures/schema_snapshot.sql:20465–20492`):
```sql
CREATE FUNCTION public.void_signatures_on_edit(p_document_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_roles text[];
BEGIN
  SELECT array_agg(DISTINCT s.party_role) INTO v_roles
    FROM signatures s
   WHERE s.document_id = p_document_id AND s.deleted_at IS NULL;

  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN RETURN; END IF;

  -- Soft-delete: the signature is no longer in force, but the RECORD that it was
  -- given, and when, is evidence and is never destroyed.
  UPDATE signatures SET deleted_at = now()
   WHERE document_id = p_document_id AND deleted_at IS NULL;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END
   WHERE id = p_document_id;
END
$$;
```

Its own COMMENT, which is the record of *why* it was left standing for a week before the drop:
```
COMMENT ON FUNCTION public.void_signatures_on_edit(p_document_id uuid) IS
'RETAINED for the deliberate-removal path only (remove_my_signature soft-deletes
directly). As of 2026-08-03 (deal plan L9) NO edit path calls this: a signed
document is read-only, and a signature comes off only when its signer takes it
off. Do not re-wire this into an edit path.';
```

The drop migration's own reasoning, verbatim:
```
-- WHY IT IS BEING DROPPED RATHER THAN GUARDED. It has no identity check of any
-- kind, and anon, authenticated and PUBLIC all hold EXECUTE.
...
-- Every executed document in the system was in range of one anonymous call, and
-- the function has never once fired in production.
--
-- It also has no caller. Verified four ways: no hit in src/, no hit in api/, no
-- other pg_proc body references it, and pg_depend reports zero non-normal
```
The migration is self-guarding — it re-checks callers and dependencies and `RAISE EXCEPTION`s rather than dropping, then re-proves absence post-drop in the same transaction.

What replaced it (installed by `supabase/migrations/20260803140000_signature_edit_rules.sql`, whose header describes the old behavior):
```
  voids every standing signature (four functions call void_signatures_on_edit
  with no confirmation), and there is no party-initiated way to remove one. So a
  party could lose their signature without ever being asked, and could never
  withdraw it deliberately.

  What this migration installs:
    document_signature_state(doc)  — who has signed, and therefore whether the
                                     document is locked to edits.
    remove_my_signature(doc)       — the signing party withdraws their own
                                     signature, which is what unlocks editing.
    request_permission_to_edit(doc)— asks the signer(s) to remove their signature.
    notify_review_changes(doc)     — tells the party to review, and marks the
                                     point their review starts from.
    document_changes_since_signature(doc) — the diff a reviewer sees.
    Edits BLOCK instead of silently voiding: set_contract_field,
    set_field_structured, set_document_co_buyer, remove_document_co_buyer.
```

---

## apply_field_formats / regroup_contract_subjects / seed_cascade_fields (functions — public.*)
- reported by: TASK-NOGUARD1-REPORT.md
- reachability: The **no-callers** half of the claim is CONFIRMED for all three. `grep -rn` across `src/ api/ test/ scripts/` returns only `test/db/fixtures/schema_snapshot.sql` schema-dump lines (`:1870`, `:14321`, `:16475`) — no call sites. prosrc scan → **0** for each (against the working control of 185/39). `pg_depend` non-internal dependencies → **none**. `pg_trigger` → **no trigger uses any of them**.

  **The "anon-callable" half of the claim is now STALE.** All three have had PUBLIC/anon/authenticated EXECUTE revoked:
  ```
                      fn                       | anon_x | auth_x
  ---------------------------------------------+--------+--------
   apply_field_formats(uuid)                    | f      | f
   regroup_contract_subjects(uuid)              | f      | f
   seed_cascade_fields(uuid)                    | f      | f
  ```
  Each now carries `proacl = {postgres=X/postgres,service_role=X/postgres}`. They are unreachable *and* unprivileged; they can only be invoked by `service_role` or the DB owner.
- exists: yes (all three)
- content:

### 1. `apply_field_formats(uuid)` — VOLATILE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

This is the largest of the three (4,975 chars). It is a **one-shot field-presentation normalizer** for a single document: it repairs mangled labels, derives `format_type` from `input_kind`/`value_type`, applies semantic upgrades by field-key suffix, converts specific fields to party-pickers / button groups / dropdowns / a week-grid, links manage↔cost field pairs, and backfills guidance from a registry.

```sql
CREATE OR REPLACE FUNCTION public.apply_field_formats(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST'],
    ARRAY['TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST'],
    ARRAY['TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST'],
    ARRAY['TXN.EMERGENCY_VET_RESPONSIBILITY','TXN.NON_ROUTINE_VET_COST'],
    ARRAY['TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST']
  ];
  party_fields text[] := ARRAY[
    'TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY',
    'TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST',
    'TXN.MORTALITY_INSURANCE_PARTY','TXN.MAJOR_MEDICAL_INSURANCE_PARTY','TXN.LOSS_OF_USE_INSURANCE_PARTY',
    'TXN.COMPETITION_EXPENSES','TXN.COMPETITION_WINNINGS'
  ];
  button_fields text[] := ARRAY[
    'TXN.PERMITTED_ACTIVITIES','TXN.PROHIBITED_ACTIVITIES','TXN.USE_RESTRICTIONS','TXN.AUTHORIZED_USERS'
  ];
  select_fields text[] := ARRAY[
    'HORSE.SEX','HORSE.COLOR','HORSE.BREED','TXN.LEASE_TERM','TXN.PAYMENT_SCHEDULE'
  ];
  p text[];
  bf text;
  sf text;
BEGIN
  -- correct the mangled labels on this document's fields (idempotent)
  UPDATE contract_fields SET label='Lessons/Day — Advanced'     WHERE document_id=p_document_id AND field_key='TXN.LESSONS_ADVANCED';
  UPDATE contract_fields SET label='Lessons/Day — Beginner'     WHERE document_id=p_document_id AND field_key='TXN.LESSONS_BEGINNER';
  UPDATE contract_fields SET label='Lessons/Day — Intermediate' WHERE document_id=p_document_id AND field_key='TXN.LESSONS_INTERMEDIATE';
  UPDATE contract_fields SET label='Payment Options (one per line: amount — description)' WHERE document_id=p_document_id AND field_key='TXN.PAYMENT_OPTIONS';

  -- base format_type from input_kind/value_type
  UPDATE contract_fields SET format_type = CASE
      WHEN input_kind = 'responsibility' THEN 'party'
      WHEN input_kind = 'contact'        THEN 'person'
      WHEN input_kind IN ('week_grid','select','buttons','currency','date','percent','longtext') THEN input_kind
      ELSE 'text' END
    WHERE document_id = p_document_id AND coalesce(format_type,'') = '';

  -- semantic upgrades so the data is reusable
  UPDATE contract_fields SET format_type='email'       WHERE document_id=p_document_id AND field_key LIKE '%.EMAIL';
  UPDATE contract_fields SET format_type='phone'       WHERE document_id=p_document_id AND (field_key LIKE '%.PHONE' OR field_key LIKE '%\_PHONE');
  UPDATE contract_fields SET format_type='person_name' WHERE document_id=p_document_id AND (field_key LIKE '%.FULL_NAME' OR field_key LIKE '%.PRINTED_NAME' OR field_key LIKE '%.VET_NAME' OR field_key LIKE '%.FARRIER_NAME');
  UPDATE contract_fields SET format_type='address'     WHERE document_id=p_document_id AND (field_key LIKE '%.ADDRESS' OR field_key='HORSE.VET_ADDRESS');
  UPDATE contract_fields SET format_type='currency'    WHERE document_id=p_document_id AND field_key LIKE '%FAIR_MARKET_VALUE';
  UPDATE contract_fields SET format_type='location'    WHERE document_id=p_document_id AND field_key IN ('HORSE.CURRENT_LOCATION','HORSE.HOME_LOCATION');
  UPDATE contract_fields SET format_type='number'      WHERE document_id=p_document_id AND field_key LIKE 'TXN.LESSONS_%' AND field_key <> 'TXN.LESSONS_COST';

  -- standalone responsibility/cost fields → party picker (Lessor/Lessee/Shared %)
  UPDATE contract_fields SET format_type='party', input_kind='responsibility'
   WHERE document_id=p_document_id AND field_key = ANY(party_fields);

  -- multi-select activity/rules fields → buttons with preset options
  FOREACH bf IN ARRAY button_fields LOOP
    UPDATE contract_fields
       SET format_type='buttons', input_kind='buttons', value_type='select',
           options = _lease_button_options(bf)
     WHERE document_id=p_document_id AND field_key=bf;
  END LOOP;

  -- single-choice fields with natural option sets → dropdown (SelectWithOther
  -- gives a free-text escape). Options-first, open text still available.
  FOREACH sf IN ARRAY select_fields LOOP
    UPDATE contract_fields
       SET format_type='select', input_kind='select', value_type='select',
           options = _lease_select_options(sf)
     WHERE document_id=p_document_id AND field_key=sf;
  END LOOP;

  -- Days Used → week-grid day picker
  UPDATE contract_fields SET format_type='week_grid', input_kind='week_grid'
   WHERE document_id=p_document_id AND field_key='TXN.DAYS_USED';

  -- link the manage↔cost pairs
  FOREACH p SLICE 1 IN ARRAY pairs LOOP
    UPDATE contract_fields SET format_type='pair', input_kind='pair', pair_cost_key=p[2]
      WHERE document_id=p_document_id AND field_key=p[1];
    UPDATE contract_fields SET pair_manage_key=p[1]
      WHERE document_id=p_document_id AND field_key=p[2];
  END LOOP;

  -- guidance from the registry where missing
  UPDATE contract_fields cf SET guidance = f.guidance
    FROM contract_formats f
   WHERE cf.document_id=p_document_id AND cf.format_type=f.format_type
     AND coalesce(cf.guidance,'')='' AND coalesce(f.guidance,'')<>'';
END;
$function$
```

### 2. `regroup_contract_subjects(uuid)` — VOLATILE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

A **section re-organizer**: reassigns `contract_fields.section` and `sort_order` so that responsibility/cost fields cluster into human subjects (Boarding, Farrier, Veterinary Care, Supplements & Medications, Exercise & Handling, Training & Lessons, Other Care & Expenses) rather than sitting in template order.

```sql
CREATE OR REPLACE FUNCTION public.regroup_contract_subjects(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- BOARDING subject
  UPDATE contract_fields SET section='Boarding', sort_order=CASE field_key
      WHEN 'TXN.BOARDING_RESPONSIBILITY' THEN 1000 WHEN 'TXN.BOARD_COST' THEN 1001 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN ('TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST');

  -- FARRIER subject
  UPDATE contract_fields SET section='Farrier', sort_order=CASE field_key
      WHEN 'TXN.FARRIER_RESPONSIBILITY' THEN 1100 WHEN 'TXN.FARRIER_COST' THEN 1101 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN ('TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST');

  -- VETERINARY subject (routine + emergency + non-routine + auth contact)
  UPDATE contract_fields SET section='Veterinary Care', sort_order=CASE field_key
      WHEN 'TXN.ROUTINE_VET_RESPONSIBILITY' THEN 1200 WHEN 'TXN.ROUTINE_VET_COST' THEN 1201
      WHEN 'TXN.EMERGENCY_VET_RESPONSIBILITY' THEN 1202 WHEN 'TXN.NON_ROUTINE_VET_COST' THEN 1203
      WHEN 'TXN.VET_AUTH_CONTACT' THEN 1204 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST','TXN.EMERGENCY_VET_RESPONSIBILITY',
       'TXN.NON_ROUTINE_VET_COST','TXN.VET_AUTH_CONTACT');

  -- SUPPLEMENTS subject
  UPDATE contract_fields SET section='Supplements & Medications', sort_order=CASE field_key
      WHEN 'TXN.SUPPLEMENTS' THEN 1300 WHEN 'TXN.SUPPLEMENTS_RESPONSIBILITY' THEN 1301
      WHEN 'TXN.SUPPLEMENTS_COST' THEN 1302 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.SUPPLEMENTS','TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST');

  -- EXERCISE & HANDLING subject
  UPDATE contract_fields SET section='Exercise & Handling', sort_order=CASE field_key
      WHEN 'TXN.CARE_RESPONSIBILITY' THEN 1400 WHEN 'TXN.EXERCISE_RESPONSIBILITY' THEN 1401
      WHEN 'TXN.CLIPPING_RESPONSIBILITY' THEN 1402 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY');

  -- TRAINING & LESSONS: fold their costs into the existing Training & Lessons section
  UPDATE contract_fields SET section='Training & Lessons'
    WHERE document_id=p_document_id AND field_key IN ('TXN.TRAINING_COST','TXN.LESSONS_COST');

  -- OTHER care/expenses → their own subject
  UPDATE contract_fields SET section='Other Care & Expenses'
    WHERE document_id=p_document_id AND field_key IN ('TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST');
END;
$function$
```

### 3. `seed_cascade_fields(uuid)` — VOLATILE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`, RETURNS integer

A **backfill**: copies any `contract_field_defs` rows for the document's template that are not yet present on the document into `contract_fields`, and returns how many it inserted. Notably it carries the `is_optional` → `included = NOT is_optional` rule (optional fields start un-included).

```sql
CREATE OR REPLACE FUNCTION public.seed_cascade_fields(p_document_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_tmpl text; v_n int := 0;
BEGIN
  SELECT d.org_id, t.template_key INTO v_org, v_tmpl
    FROM documents d JOIN contract_templates t ON t.id = d.template_id
   WHERE d.id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  INSERT INTO contract_fields
    (org_id, document_id, field_key, label, section, owner_role, value, value_type,
     required, sort_order, parent_field_key, input_kind, options, conditional_on, closed,
     guidance, is_optional, included)
  SELECT v_org, p_document_id, cd.field_key, cd.label, cd.section, cd.owner_role, NULL,
         cd.value_type, cd.required, cd.sort_order, cd.parent_field_key, cd.input_kind,
         cd.options, cd.conditional_on, cd.guidance, cd.is_optional,
         NOT cd.is_optional   -- optional fields start un-included
  FROM contract_field_defs cd
  WHERE cd.template_key = v_tmpl
    AND NOT EXISTS (SELECT 1 FROM contract_fields cf
                    WHERE cf.document_id = p_document_id AND cf.field_key = cd.field_key);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$
```

---

## affiliation_reconciliation() / wall_onboarding_invariant_violations() (functions — public.*)
- reported by: TASK-NOGUARD1-REPORT.md
- reachability: The **no-callers** half is CONFIRMED for both. `grep -rn` across `src/ api/ test/ scripts/`: `affiliation_reconciliation` → only `test/db/fixtures/schema_snapshot.sql:1478,1481`; `wall_onboarding_invariant_violations` → **zero hits anywhere in the repo, including the schema snapshot** (it postdates that fixture). prosrc scan → **0** for both. `pg_depend` non-internal → none. `pg_trigger` → none.

  **The "unauthenticated" half of the claim is now STALE.** Both have had PUBLIC/anon/authenticated EXECUTE revoked:
  ```
                      fn                       | anon_x | auth_x
  ---------------------------------------------+--------+--------
   affiliation_reconciliation()                 | f      | f
   wall_onboarding_invariant_violations()       | f      | f
  ```
  `proacl = {postgres=X/postgres,service_role=X/postgres}` on both. Neither is an open roster dump today.
- exists: yes (both)
- content:

### `affiliation_reconciliation()` — STABLE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

Full source:
```sql
CREATE OR REPLACE FUNCTION public.affiliation_reconciliation()
 RETURNS TABLE(contact_id uuid, display_code text, name text, has_account boolean, is_deleted boolean, derived_groups text[], current_groups text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code,
         nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), ''),
         (p.user_id IS NOT NULL),
         (c.deleted_at IS NOT NULL),
         coalesce(derive_affiliations(c.id), ARRAY[]::text[]),
         coalesce((SELECT array_agg(DISTINCT g.group_type ORDER BY g.group_type)
                     FROM groups g WHERE g.contact_id = c.id),
                  ARRAY[]::text[])
    FROM contacts c
    LEFT JOIN profiles p ON p.contact_id = c.id
   WHERE c.deleted_at IS NULL
      OR EXISTS (SELECT 1 FROM groups g WHERE g.contact_id = c.id)
      OR EXISTS (SELECT 1 FROM documents d WHERE d.contact_id = c.id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL)
   ORDER BY nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), '');
$function$
```

**LIVE OUTPUT (28 rows, run today against prod).** This puts the *derived* affiliation (from `derive_affiliations`, the authoritative deriver) side by side with the *stored* `groups` rows, so any drift is visible in one glance:

```
              contact_id              | display_code |            name            | has_account | is_deleted |      derived_groups       |      current_groups
--------------------------------------+--------------+----------------------------+-------------+------------+---------------------------+---------------------------
 c5319c2a-79e0-48f4-8fcb-5f14fd65c4af | CON-000056   | Anita Tackette             | f           | f          | {}                        | {}
 42f456ad-250f-4feb-b7c6-96d39ccd797d | CON-000101   | Ashlan Hockersmith         | f           | f          | {RIDER}                   | {RIDER}
 b6c984f7-807c-4afe-9f22-4200e323048c | CON-000189   | Audrey Brennan             | f           | f          | {}                        | {}
 7a603cc1-0760-40f3-9e1d-4f8717a37752 | CON-000065   | Audrey Slater              | f           | f          | {RIDER}                   | {RIDER}
 41c5dae9-fc73-4766-9173-6c27347c722c | CON-000130   | Brian Olenik               | f           | f          | {RIDER}                   | {RIDER}
 8795c065-d153-44cc-8a81-758b94d2f5ce | CON-000212   | CACTAI INC.                | t           | f          | {}                        | {}
 d268330c-436a-4f42-bf88-9172d9b4155f | CON-000013   | Charles Zigmund            | f           | t          | {RIDER}                   | {RIDER}
 75475f66-8950-4f13-832c-5471070737f8 | CON-000011   | CJ Z                       | t           | f          | {}                        | {}
 d99f1472-48b4-466e-aaa7-f76396745c17 | CON-000090   | CJ Z                       | t           | f          | {HORSE_OWNER,RIDER}       | {HORSE_OWNER,RIDER}
 862b7936-9148-465c-b0db-b83246e236a0 | CON-000097   | Claire Bourdon             | t           | f          | {}                        | {}
 8c413fd4-e30b-4ceb-96ef-96afca5dccdb | CON-000255   | Claire Bourdon             | t           | f          | {HORSE_OWNER,RIDER}       | {HORSE_OWNER,RIDER}
 07c82329-ec0a-4382-a91c-71cf43577668 | CON-000082   | Elisheva Fiszer            | f           | f          | {RIDER}                   | {RIDER}
 e733b2f0-00b7-4d52-87dd-15e5a26e64af | CON-000219   | Emmy Castro                | f           | f          | {}                        | {}
 352c3898-65d0-4a90-ad59-29107b7e03fe | CON-000060   | French Heritage Equestrian | f           | f          | {}                        | {}
 3c23bb7f-bdce-4943-b40a-85cf41554491 | CON-000131   | Gabriella Olenik           | f           | f          | {}                        | {}
 c5473282-8d20-495a-8ad0-c39ef26e013a | CON-000190   | Hannah Dryden              | f           | f          | {}                        | {}
 5c5bbdb1-5322-4998-924b-81b2d0a5a367 | CON-000254   | Kit Garcin                 | f           | f          | {}                        | {}
 be21609c-ff4c-448a-8346-02b71d40bcc7 | CON-000307   | Kylie Pinion               | f           | f          | {}                        | {}
 a349d66c-1fb1-4107-a87f-364ea663919b | CON-000004   | Madeline Do                | t           | f          | {RIDER}                   | {RIDER}
 9da3f32d-656d-466f-ac30-f95fa12a682f | CON-000214   | Marissa Robertson          | f           | f          | {RIDER}                   | {RIDER}
 bce1bcf7-e0bc-4374-bb13-9f9cef5db204 | CON-000052   | Mary Richardson            | t           | f          | {HORSE_OWNER,RIDER}       | {}
 f4d03b02-641c-4c3b-af85-b2fd2d6b8a30 | CON-000182   | Melanie O’Mea-Smith        | f           | f          | {RIDER}                   | {RIDER}
 ceaadd3c-0f1b-4d59-9819-e3a5b96f8f27 | CON-000191   | Naomi Pouliot              | f           | f          | {}                        | {}
 23dc8f83-a46e-4937-b7c5-78acc052e41b | CON-000102   | Raymond Thicklin           | f           | f          | {RIDER}                   | {RIDER}
 b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6 | CON-000053   | Sarah Morgan               | t           | f          | {GUEST,HORSE_OWNER,RIDER} | {GUEST,HORSE_OWNER,RIDER}
 23cb1681-b260-49cb-bf45-a0141c1a0d32 | CON-000127   | Serena Lee                 | f           | f          | {RIDER}                   | {RIDER}
 a92aace9-705e-484f-a9a9-7167afe76b51 | CON-000280   |                            | t           | f          | {RIDER}                   | {RIDER}
 972d89a6-0b8d-4014-8594-51ccc2508f81 | CON-000278   |                            | t           | f          | {RIDER}                   | {RIDER}
```

Drift summary, same run:
```
 total_rows | drifting
------------+----------
         28 |        1
```

**This function is currently reporting a real, live data-integrity defect.** `Mary Richardson` (CON-000052, `bce1bcf7-e0bc-4374-bb13-9f9cef5db204`, has an account) derives `{HORSE_OWNER,RIDER}` but her stored `groups` rows are `{}` — she has no affiliation recorded at all. Since standing categories drive app nav gating and onboarding-document assignment, an empty `groups` set for a horse-owning rider is a functional gap, not a cosmetic one. Two other things visible in the same output that the owner may want to look at: `Charles Zigmund` (CON-000013) is `is_deleted = t` yet still carries `{RIDER}`; and there are two `CJ Z` and two `Claire Bourdon` contact rows, in each pair one with groups and one without — the contact-sprawl pattern noted elsewhere.

### `wall_onboarding_invariant_violations()` — STABLE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

Full source:
```sql
CREATE OR REPLACE FUNCTION public.wall_onboarding_invariant_violations()
 RETURNS TABLE(contact_id uuid, person text, wall_gating integer, onboarding_actionable integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.id, v.person, v.gating, v.actionable
    FROM (
      SELECT c.id,
             coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                      c.email, c.id::text) AS person,
             (contact_document_wall_state(c.id)->>'gating')::int AS gating,
             (SELECT count(*)::int FROM contact_required_documents crd
               WHERE crd.contact_id = c.id
                 AND NOT contact_document_satisfied(c.id, crd.template_key)) AS actionable
        FROM contacts c
       WHERE c.deleted_at IS NULL) v
   WHERE v.gating > 0 AND v.actionable = 0;
$function$
```

**LIVE OUTPUT (run today against prod):**
```
 contact_id | person | wall_gating | onboarding_actionable
------------+--------+-------------+-----------------------
(0 rows)
```

This is a **zero-is-the-good-answer invariant check**, not a roster dump. It looks for the specific deadlock where a contact is being *blocked* by the document wall (`gating > 0`) while having *nothing they can actually do about it* (`actionable = 0`) — i.e. a user stuck behind a wall with no document to sign. It currently returns clean. Its value is as a canary run after any change to the wall/onboarding logic, not as a report to read routinely.

---

## public.owns_order(uuid) (function — public.owns_order)
- reported by: TASK-TESTDB-REPORT.md
- reachability: VERIFIED orphaned. `select count(*) from pg_class … where relname='orders'` → **0**; a wildcard scan `relname like '%order%'` in `public` → **0 rows**. So the table the function queries does not exist and any call raises. `pg_policies` scan `where qual ilike '%owns_order%' or with_check ilike '%owns_order%'` → **0 rows** — no policy references it. prosrc scan → **0** other functions reference it. `pg_depend` non-internal → none. `grep -rn "owns_order" src/ api/` → **no output**; the only repo hits are in `test/` (`harness.smoke.test.ts:53,55` asserts the function *exists*; `platform_catalog_org_scope.test.ts:122` and `harness.ts:15` are comments). Claim CONFIRMED.
- exists: yes (the function still exists; its table does not)
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.owns_order(p_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND (o.user_id = auth.uid() OR is_admin())
  );
$function$
```

ACL / volatility / security: `STABLE`, `SECURITY DEFINER`,
```
{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
PUBLIC still holds EXECUTE (`anon_x = t`, `auth_x = t`), but the body cannot resolve `orders`, so a call errors rather than leaking. It is a live wrapper around a dropped table.

The one thing that keeps it pinned in place — a test asserts its existence:
```
test/db/harness.smoke.test.ts:53:      `select proname from pg_proc where proname in ('is_admin','owns_order','validate_invitation')`,
test/db/harness.smoke.test.ts:55:    expect(fns.map((f) => f.proname).sort()).toEqual(['is_admin', 'owns_order', 'validate_invitation']);
```

---

## public.reopen_deal(uuid) (function — public.reopen_deal)
- reported by: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- reachability: VERIFIED no UI caller. `grep -rn "reopen_deal" src/ api/ test/ scripts/` → only `test/db/fixtures/schema_snapshot.sql:15142,15145` (schema dump). **No `supabase.rpc('reopen_deal')` anywhere in `src/`.** prosrc scan → **0** other functions reference it. `pg_depend` non-internal → none. Claim CONFIRMED. Note it is *not* unguarded — it requires an authenticated staff caller (see body), even though `anon` holds EXECUTE at the ACL level.
- exists: yes
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.reopen_deal(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to reopen a deal'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status <> 'complete' THEN
    RETURN jsonb_build_object('reopened', false, 'message', 'this deal is not complete');
  END IF;

  UPDATE deals SET status = 'pending', completed_at = NULL WHERE id = p_deal_id;
  UPDATE contracts SET status = 'draft' WHERE id = v_deal.contract_id;

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'deals', p_deal_id,
          jsonb_build_object('status', 'complete', 'completed_at', v_deal.completed_at),
          jsonb_build_object('status', 'pending', 'reason', 'reopened_by_staff'));

  -- completion is DERIVED: if every document is still signed, this deal already
  -- satisfies its requirements again and the next execution event will settle
  -- it. Say so, rather than implying it will stay open.
  RETURN jsonb_build_object(
    'reopened', true,
    'still_satisfied', (deal_completion_state(p_deal_id) ->> 'can_complete')::boolean,
    'message', CASE WHEN (deal_completion_state(p_deal_id) ->> 'can_complete')::boolean
      THEN 'Reopened, but every requirement is still met — void or reopen a document to keep this deal open.'
      ELSE 'Reopened.' END);
END;
$function$
```

ACL / volatility / security: `VOLATILE`, `SECURITY DEFINER`,
```
{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
(`anon_x = t`, `auth_x = t` — but the first two lines of the body are `auth.uid() IS NULL` and `has_staff_access()` guards, so it is self-guarding.)

grep result across `src/`:
```
$ grep -rn "reopen_deal" src/ api/
(no output)
```

Worth the owner's eye: this function writes an `audit_logs` row and returns a *nuanced* message — it tells staff that reopening a deal whose documents are all still signed will simply re-settle on the next execution event. That reasoning does not exist anywhere in the Edit routing that replaced it.

---

## public.start_bill_of_sale_standalone(uuid, uuid, uuid) (function — public.start_bill_of_sale_standalone)
- reported by: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- reachability: VERIFIED no UI caller. `grep -rn "start_bill_of_sale_standalone" src/ api/ test/ scripts/` → only `test/db/fixtures/schema_snapshot.sql:18804,18807` (schema dump). No `supabase.rpc(...)` call anywhere in `src/`. prosrc scan → **0** other functions reference it. `pg_depend` non-internal → none. Claim CONFIRMED.
- exists: yes
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.start_bill_of_sale_standalone(p_buyer_contact_id uuid, p_seller_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  v_doc      uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a bill of sale'; END IF;
  IF p_buyer_contact_id IS NULL THEN RAISE EXCEPTION 'a buyer contact is required'; END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_buyer_contact_id;

  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, current_contact_id(), jsonb_build_object('deal_side','SALE'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  v_doc := bos_generate_document(
    v_contract, p_buyer_contact_id, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract));

  UPDATE contract_fields SET value = 'NO'
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';

  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract);
END;
$function$
```

ACL / volatility / security: `VOLATILE`, `SECURITY DEFINER`,
```
{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
(`anon_x = t`, `auth_x = t` — self-guarding via `auth.uid()` + `has_staff_access()`.)

grep result across `src/`:
```
$ grep -rn "start_bill_of_sale_standalone" src/ api/
(no output)
```

### What makes its behavior "distinct" — contrast with the non-standalone path

The sibling is `public.start_bill_of_sale(p_sale_document_id uuid)`. **The two differ in four material ways**, and only the sibling has ever run:

| | `start_bill_of_sale(sale_doc)` | `start_bill_of_sale_standalone(buyer, seller, horse)` |
|---|---|---|
| Input | an existing `HORSE_SALE_V2` document | three raw contact/horse ids — **no prior sale document** |
| Contract | reuses `v_sale.contract_id` | **CREATES a new `contracts` row** (`segment='acquisition'`, `terms->>'deal_side'='SALE'`) and its own `contract_parties` |
| Parties sourced from | `document_parties` of the sale doc | `contract_parties` it just inserted (BUYER order 1, optional SELLER order 2) |
| `TXN.BOS_HAS_SALE_AGREEMENT` | set to **`'YES'`** | set to **`'NO'`** |
| Field prefill / payment status | copies every non-blank shared field from the sale doc, and derives `TXN.BOS_PAYMENT_STATUS` from the sale's `TXN.INSTALLMENTS_ENABLED` (`YES`→`INSTALLMENTS`, `NO`→`PAID_IN_FULL`) | **none of this** — the BOS starts empty and payment status is left unset |

The sibling's signature and the branch that shows the contrast:
```sql
CREATE OR REPLACE FUNCTION public.start_bill_of_sale(p_sale_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
...
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_sale.template_id;
  IF v_tkey <> 'HORSE_SALE_V2' THEN
    RAISE EXCEPTION 'a bill of sale is generated from a HORSE_SALE_V2 document (got %)', v_tkey;
  END IF;
...
  -- prefill every shared field from the sale document's values (parties, horse,
  -- price, co-buyer set) — same field_keys by design; still editable before signing
  UPDATE contract_fields b
     SET value = s.value, updated_at = now()
    FROM contract_fields s
   WHERE b.document_id = v_doc
     AND s.document_id = p_sale_document_id
     AND s.field_key = b.field_key
     AND coalesce(btrim(s.value), '') <> ''
     AND coalesce(btrim(b.value), '') = '';

  UPDATE contract_fields SET value = 'YES'
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';

  -- payment status derives from the sale's installment election (still editable)
  SELECT coalesce(btrim(value), '') INTO v_installments
    FROM contract_fields
   WHERE document_id = p_sale_document_id AND field_key = 'TXN.INSTALLMENTS_ENABLED';
  UPDATE contract_fields
     SET value = CASE v_installments WHEN 'YES' THEN 'INSTALLMENTS'
                                     WHEN 'NO'  THEN 'PAID_IN_FULL'
                                     ELSE '' END
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_PAYMENT_STATUS';
...
$function$
```

In plain terms: the standalone function is the **"cash sale, no written sale agreement"** path — a bill of sale for a horse that changed hands without a `HORSE_SALE_V2` contract behind it. That is a real business shape (it is the reason `TXN.BOS_HAS_SALE_AGREEMENT` exists as a field at all), and it currently has no way to be reached from the UI.

---

## document_deliveries party-read policy arm (policy — public.document_deliveries / document_deliveries_select)
- reported by: TASK-PARTYRLS-REPORT.md
- reachability: The claim is CONFIRMED with one correction. `listDeliveries` exists and is the only client function reading `document_deliveries` — but **it is at `src/lib/api.ts:1316`, not `:1132`** (the report's line number is stale; the file has grown). Its sole caller chain is staff-facing: `DeliveryPanel` → `DocumentViewerPage` under `/app/ops/`, so no party-facing surface exercises the `recipient_contact_id = current_contact_id()` arm. `grep -rn "listDeliveries" src/ api/` returns exactly three hits, all in that chain.
- exists: yes
- content:

Full `document_deliveries_select` policy, all arms:
```
document_deliveries | document_deliveries_select | SELECT | roles={authenticated}
  USING: (is_admin() OR ((deleted_at IS NULL) AND (caller_owns_document(document_id) OR (recipient_contact_id = current_contact_id()))))
  CHECK: (none)
```
Three arms: `is_admin()`; owner-of-document; and the party arm `recipient_contact_id = current_contact_id()`. The third is the one never exercised from the UI.

The companion write policy:
```
document_deliveries | document_deliveries_admin_write | ALL | roles={authenticated}
  USING: is_admin()
  CHECK: is_admin()
```

`listDeliveries`, verbatim from `src/lib/api.ts:1316`:
```ts
// ─── Deliveries ───────────────────────────────────────────────────────────

export async function listDeliveries(documentId: string): Promise<DocumentDelivery[]> {
  const { data, error } = await supabase
    .from('document_deliveries')
    .select('*')
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .order('delivered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentDelivery[];
}

export async function recordDelivery(input: DeliveryInput): Promise<DocumentDelivery> {
  const { data, error } = await supabase
    .from('document_deliveries')
    .insert({
      document_id: input.document_id,
      recipient_contact_id: input.recipient_contact_id,
      channel: input.channel ?? 'PORTAL',
      copy_url: input.copy_url ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DocumentDelivery;
}
```

Who calls it:
```
$ grep -rn "listDeliveries" src/ api/
src/components/ops/documents/DeliveryPanel.tsx:3:import { listDeliveries, recordDelivery } from '../../../lib/api';
src/components/ops/documents/DeliveryPanel.tsx:19: * delivery log lists prior sends (newest first) from `listDeliveries`.
src/components/ops/documents/DeliveryPanel.tsx:78:    return listDeliveries(documentId)
src/lib/api.ts:1316:export async function listDeliveries(documentId: string): Promise<DocumentDelivery[]> {
```
and who mounts `DeliveryPanel`:
```
src/pages/app/ops/DocumentViewerPage.tsx:10:import { DeliveryPanel } from '../../../components/ops/documents/DeliveryPanel';
src/pages/app/ops/DocumentViewerPage.tsx:245:          <DeliveryPanel
```
Both live under `ops/` — staff only. Confirms no party-facing caller.

**What the stamp trail would show.** Current row count: **49**.

Columns:
```
id, document_id, recipient_contact_id, channel, copy_url, delivered_at, created_at, deleted_at, deleted_by, is_mirror
```

Two most recent rows in full:
```
                  id                  |             document_id              |         recipient_contact_id         | channel |                        copy_url                        |         delivered_at          |          created_at           | deleted_at | deleted_by | is_mirror
--------------------------------------+--------------------------------------+--------------------------------------+---------+--------------------------------------------------------+-------------------------------+-------------------------------+------------+------------+-----------
 e32f1a1f-6741-4d58-9fbf-4ec1f889984b | 31b10f9f-891a-469a-8867-8fb29bee4108 |                                      | EMAIL   | /portal/documents/31b10f9f-891a-469a-8867-8fb29bee4108 | 2026-08-10 16:43:30.310838+00 | 2026-08-10 16:43:30.310838+00 |            |            | t
 3cb7a775-928a-4e7f-9bc0-a9fabf8d2ebf | 31b10f9f-891a-469a-8867-8fb29bee4108 | 8c413fd4-e30b-4ceb-96ef-96afca5dccdb | EMAIL   | /portal/documents/31b10f9f-891a-469a-8867-8fb29bee4108 | 2026-08-10 16:43:28.62767+00  | 2026-08-10 16:43:28.62767+00  |            |            | f
```

Two notes the owner should see. First, there are already **49 real delivery stamps** sitting in prod — this is populated history, not an empty table waiting on a feature. Second, the pair above shows the mirror mechanism: one row for the actual recipient (`8c413fd4…` = Claire Bourdon, CON-000255) and a second `is_mirror = t` row with a **NULL `recipient_contact_id`** for the shared admin@/hello@ inbox copy. Because the party arm keys on `recipient_contact_id = current_contact_id()`, mirror rows match no party — which is correct, but means a party-facing stamp trail would show only their own row, not the mirror.

---

## file_links.subject_type CHECK values `purchase` and `booking` (constraint — public.file_links)
- reported by: TASK-UPLOADS-REPORT.md
- reachability: The claim is CONFIRMED and then some — **no `subject_type` value at all is written by application code.** `grep -rn "file_links" src/ api/` finds exactly one data access, a SELECT at `src/lib/files.ts:220`. There is **no INSERT into `file_links` anywhere in `src/` or `api/`** (`grep -rnE "(linkFile|subject_type)\s*[:(].*(purchase|booking)"` → no output; no `linkFile` symbol exists). The two values are unreachable because the whole write path is unbuilt.

  **One correction to the claim's "no consuming surface" wording:** `purchase` and `booking` *are* present in the TypeScript surface — both in the `FileSubjectType` union and in the display-label map — so they are typed and labelled, just never produced. Detail below.
- exists: yes
- content:

Full CHECK constraint (`pg_get_constraintdef`):
```sql
CHECK ((subject_type = ANY (ARRAY[
  'contact'::text, 'account'::text, 'deal'::text, 'contract'::text, 'document'::text,
  'horse'::text, 'stable'::text, 'lesson'::text, 'offering'::text, 'purchase'::text,
  'booking'::text, 'lead'::text, 'directory_listing'::text, 'org'::text])))
```

All constraints on the table:
```
file_links_created_by_user_id_fkey  | FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id)
file_links_file_id_fkey             | FOREIGN KEY (file_id) REFERENCES files(id)
file_links_org_id_fkey              | FOREIGN KEY (org_id) REFERENCES organizations(id)
file_links_pkey                     | PRIMARY KEY (id)
file_links_subject_type_check       | CHECK (subject_type = ANY (ARRAY['contact','account','deal','contract','document','horse','stable','lesson','offering','purchase','booking','lead','directory_listing','org']))
```

Full table definition:
```
id                 uuid                     NOT NULL  default=gen_random_uuid()
org_id             uuid                     NOT NULL  default=current_org()
file_id            uuid                     NOT NULL  default=-
subject_type       text                     NOT NULL  default=-
subject_id         uuid                     NOT NULL  default=-
created_by_user_id uuid                     NULL      default=auth.uid()
created_at         timestamp with time zone NOT NULL  default=now()
deleted_at         timestamp with time zone NULL      default=-
```

Current row counts grouped by `subject_type`:
```
 coalesce | count
----------+-------
(0 rows)
```
```
 total_file_links
------------------
                0
```
```
 total_files
-------------
           0
```

**The table is entirely empty, and so is `files`.** Not just `purchase`/`booking` — no subject type has ever been written, because the UPLOADS spine shipped its schema and read path but no write path reached production use.

The grep proving no writer:
```
$ grep -rn "linkFile\|file_links" src/ api/
src/lib/files.ts:20: * SURFACING IS A REFERENCE, NEVER A COPY. One `files` row; `file_links` rows put
src/lib/files.ts:217: *  `file_links_owner_read`, which resolves to "links to files I can see." */
src/lib/files.ts:220:    .from('file_links')

$ grep -rnE "(linkFile|subject_type)\s*[:(].*(purchase|booking)" src/ api/
(no output)
```
The single access, a read:
```ts
    .select('id, file_id, subject_type, subject_id, created_at, deleted_at')
```

Where `purchase` and `booking` DO appear on the TS side — `src/lib/files.ts:44–50`:
```ts
/** The surfaces a file can be shown on. Mirrors the `file_links.subject_type`
 *  CHECK — adding a surface is one line there and one here. */
export type FileSubjectType =
  | 'contact' | 'account' | 'deal' | 'contract' | 'document'
  | 'horse' | 'stable' | 'lesson' | 'offering' | 'purchase'
  | 'booking' | 'lead' | 'directory_listing' | 'org';
```
and `src/components/app/FilesContent.tsx:31–37`, which already has human labels ready for them:
```ts
const SUBJECT_LABEL: Record<string, string> = {
  contact: 'a contact record', account: 'an account', deal: 'a deal',
  contract: 'a contract', document: 'a document', horse: 'a horse record',
  stable: 'a stable page', lesson: 'a lesson', offering: 'a service',
  purchase: 'an order', booking: 'a booking', lead: 'a lead',
  directory_listing: 'a directory listing', org: 'the company',
};
```
So `purchase` renders as "an order" and `booking` as "a booking" the moment anything writes such a row. The DB CHECK, the TS union, and the display labels are all in agreement and all complete; only the producer is missing.
