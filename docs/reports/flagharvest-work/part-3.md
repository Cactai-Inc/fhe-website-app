# FLAGHARVEST — Part 3 (artifacts 17–32)

Read-only pass. Nothing changed. Nothing recommended for deletion.
Worktree: `/Users/Cactai/Downloads/claude-code-repo/wt-flagharvest` (branch `task/flagharvest`, HEAD `86283dc`).
Prod DB queried SELECT-only via `.env.db`.

---

## 17. Shelved migration (`docs/proposed/INVITEWORKS-provision-no-default-supersede.sql`)
- reported by: `docs/reports/TASK-INVITEWORKS-REPORT.md` [INV batch1.md#17]
- reachability: **verified unreachable.** The file lives in `docs/proposed/`, not `supabase/migrations/`. `ls supabase/migrations | grep -i inviteworks` returns only three *applied* INVITEWORKS migrations (`20260811160000_inviteworks_delivery_trail.sql`, `20260811161000_inviteworks_provision_supersedes.sql`, `20260811170000_inviteworks_resend_support.sql`) — this one is not among them. There is no runner that walks `docs/`, and no file in the repo references the filename. It can only be applied by a human moving it. Its own header states the gate: `docs/proposed/INVITEWORKS-provision-no-default-supersede.sql:1-11` — "NOT APPLIED. HELD FOR OWNER SIGN-OFF."
- exists: yes (9,766 bytes; added by commit `88e1577` "INVITEWORKS: split RESEND from REGENERATE, and make every link visible")
- content:

```sql
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  NOT APPLIED. HELD FOR OWNER SIGN-OFF.                                   ║
-- ║                                                                          ║
-- ║  This file is deliberately NOT in supabase/migrations/ — it changes what ║
-- ║  happens to invitation links that are LIVE RIGHT NOW, and the owner      ║
-- ║  asked to be told before anything does that.                            ║
-- ║                                                                          ║
-- ║  To apply, move it into supabase/migrations/ with a fresh timestamp and  ║
-- ║  run the usual dry-run-then-apply. It has already been dry-run against   ║
-- ║  production inside BEGIN/ROLLBACK — see the report.                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- WHAT IT CHANGES
--
-- provision_client_invitation currently calls supersede_invitations on EVERY
-- call, so minting a token always retires the person's previous live link.
-- Owner ruling 2026-08-11: a link stays alive until it expires or staff
-- deliberately deactivate it, and "I'll send it again" must not be what kills
-- the working one. Retiring is REGENERATE — a deliberate, chosen act — not a
-- side effect of provisioning.
--
-- This removes that default. Retiring then happens only where a caller asks
-- for it, which is exactly how the plain/staff path has always worked
-- (admin-send-invitation calls supersede_invitations itself, right after its
-- insert). One rule, one place, declared by the caller.
--
-- WHO DEPENDS ON IT BEING GONE
--
--   api/admin-send-invitation.ts   already ships the explicit call, gated on
--                                  mode === 'regenerate'. Until this migration
--                                  lands that call is a harmless no-op (the RPC
--                                  has already superseded by then); after it
--                                  lands it is the ONLY thing that retires a
--                                  link, so regenerate keeps working.
--   api/sign-start.ts              the public /sign resume path. TODAY, a
--                                  second self-onboarding submission silently
--                                  kills the link from the first — the exact
--                                  behaviour the owner ruled against. This
--                                  migration is what stops that.
--
-- SAFE TO APPLY BEFORE THE FRONTEND DEPLOYS? Yes, but do the deploy first if
-- you can. Between this landing and the deploy, the staff "Regenerate link"
-- button would mint a new link WITHOUT retiring the old one (both stay live)
-- until the API carrying mode='regenerate' is out. Nothing breaks; a stale
-- link just outlives its replacement for that window.
--
-- Everything below is byte-identical to the live function except the removed
-- PERFORM supersede_invitations(...) line. No self-contained COMMIT.

CREATE OR REPLACE FUNCTION public.provision_client_invitation(
  p_email text, p_first_name text, p_last_name text, p_categories text[],
  p_offering_ids uuid[] DEFAULT '{}'::uuid[], p_template_keys text[] DEFAULT NULL::text[],
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid,
  p_org_id uuid DEFAULT NULL::uuid, p_partial_amount numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_org      uuid;
  v_contact  uuid;
  v_client   uuid;
  v_acct     jsonb;
  v_purchase uuid;
  v_inv_id   uuid;
  v_token    text;
  v_total    numeric := 0;
  v_labels   text[];
  v_has_off  boolean := (array_length(p_offering_ids, 1) IS NOT NULL);
  v_dup_purchase uuid;
  v_cats     text[];
  v_email    text := lower(trim(p_email));
  v_fn       text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln       text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_linked   uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one category is required';
  END IF;

  v_org := p_org_id;
  IF v_org IS NULL AND v_has_off THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for this invitation'; END IF;

  -- ITEM 2: when a request is named, its FK link is the truth. The email match
  -- inside _ensure_client_account remains the fallback for the null-link case.
  IF p_request_id IS NOT NULL THEN
    SELECT r.contact_id INTO v_linked
      FROM requests r WHERE r.id = p_request_id;
    IF v_linked IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM contacts c WHERE c.id = v_linked AND c.deleted_at IS NOT NULL) THEN
      v_contact := v_linked;
      -- ITEM 3: a linked LEAD becomes a real CONTACT at conversion.
      UPDATE contacts
         SET contact_type = CASE WHEN contact_type = 'LEAD' THEN 'CONTACT' ELSE contact_type END,
             first_name = CASE WHEN v_fn IS NOT NULL AND NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                               THEN v_fn ELSE first_name END,
             last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                               THEN v_ln ELSE last_name END
       WHERE id = v_contact;
      SELECT cl.id INTO v_client FROM clients cl
       WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
      IF v_client IS NULL THEN
        INSERT INTO clients (org_id, contact_id, source, client_since)
          VALUES (v_org, v_contact, 'provisioned invitation', now())
          RETURNING id INTO v_client;
      END IF;
      IF p_template_keys IS NOT NULL THEN
        INSERT INTO contact_required_documents (contact_id, template_key, org_id)
        SELECT v_contact, k, v_org FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
        ON CONFLICT DO NOTHING;
      ELSE
        PERFORM apply_category_documents(v_contact, v_cats);
      END IF;
    END IF;
  END IF;

  -- single-sourced account creation (unchanged path when there is no link)
  IF v_contact IS NULL THEN
    v_acct    := _ensure_client_account(v_org, v_email, v_fn, v_ln, v_cats, p_template_keys);
    v_contact := (v_acct->>'contact_id')::uuid;
    v_client  := (v_acct->>'client_id')::uuid;
  END IF;

  IF v_has_off THEN
    SELECT p.id INTO v_dup_purchase
      FROM purchases p
     WHERE p.buyer_contact_id = v_contact AND coalesce(p.status,'') <> 'void' AND p.deleted_at IS NULL
       AND (SELECT array_agg(DISTINCT pi.offering_id ORDER BY pi.offering_id)
              FROM purchase_items pi WHERE pi.purchase_id = p.id)
           = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_offering_ids) x)
     ORDER BY p.created_at DESC LIMIT 1;
    IF v_dup_purchase IS NOT NULL THEN
      v_purchase := v_dup_purchase;
    ELSE
      v_purchase := _provision_purchase_for_offerings(
        v_org, v_contact, v_client, p_offering_ids,
        p_mark_paid, p_payment_method, p_notes, p_partial_amount);
    END IF;
    SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name) INTO v_total, v_labels
      FROM offerings o WHERE o.id = ANY(p_offering_ids);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                           first_name, last_name, contact_id, categories, offering_ids, template_keys)
    VALUES (v_org, p_request_id, v_email, v_token,
            now() + (invitation_expiry_days(v_org) || ' days')::interval, 'sent',
            v_fn, v_ln, v_contact, v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
    RETURNING id INTO v_inv_id;

  -- NO supersede here. Minting a token does not retire the one the person may
  -- already be holding — that is REGENERATE, and the caller asks for it
  -- explicitly (admin-send-invitation, mode='regenerate'). Owner ruling
  -- 2026-08-11: a link lives until it expires or is deliberately deactivated.

  -- The invitation now EXISTS, so it is evidence. Recompute through the sole
  -- writer: the contact record shows the chosen category immediately, and it is
  -- the same computation activation will run, so the two cannot disagree.
  PERFORM apply_affiliations(v_contact);

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
    -- ITEM 5b: the request has been acted on; its inbound alert is done.
    PERFORM resolve_notifications_for_link(
      '/app/ops/intake?request=' || p_request_id::text, auth.uid(), 'request_new');
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id, 'token', v_token, 'contact_id', v_contact,
    'purchase_id', v_purchase, 'categories', v_cats, 'amount', coalesce(v_total, 0),
    'labels', coalesce(v_labels, ARRAY[]::text[]), 'request_id', p_request_id);
END;
$fn$;
```

---

## 18. `void_signatures_on_edit(uuid)` — DROPPED function (prod `pg_proc`)
- reported by: `docs/reports/TASK-NOGUARD2-REPORT.md` [INV batch1.md#19]
- reachability: **verified gone from prod.** `SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='void_signatures_on_edit'` → **zero rows**. Never-fired claim confirmed: `SELECT count(*) FROM documents WHERE signatures_voided_at IS NOT NULL` → **0**. Zero live callers in `src/` or `api/` (only doc/report/report-fixture mentions remain, plus `test/db/fixtures/schema_snapshot.sql`, which is a captured pre-drop snapshot, not live schema).
- exists: **dropped in migration `supabase/migrations/20260810T0100_noguard2_drop_void_signatures_on_edit.sql`, commit `6192208` ("NOGUARD2 Phase A: drop void_signatures_on_edit, make gift guards fail closed")**. The DROP is guarded by a `DO $pre$` block that RAISEs if the function is missing, has overloads, has any in-database caller, or has any non-normal `pg_depend` entry — and a `DO $post$` block that RAISEs if it survived.
- content — the recovered body (verbatim from the drop migration's reversibility comment; byte-identical to `test/db/fixtures/schema_snapshot.sql:20468`, and recorded in six historical migrations `20260731160000`, `20260801000000`, `20260802010001`, `20260802030000`, `20260802090001`, `20260803140000`):

```sql
CREATE OR REPLACE FUNCTION public.void_signatures_on_edit(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
```

Its final COMMENT before the drop (from the snapshot):

```
RETAINED for the deliberate-removal path only (remove_my_signature soft-deletes
directly). As of 2026-08-03 (deal plan L9) NO edit path calls this: a signed
document is read-only, and a signature comes off only when its signer takes it
off. Do not re-wire this into an edit path.
```

The drop migration's own record of the pre-state it was written against:

```
  proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,
           authenticated=X/postgres,service_role=X/postgres}
  documents with live signatures : 61
  live signature rows            : 62
  documents.signatures_voided_at IS NOT NULL : 0 of 81
```

**Note (owner-relevant, not a recommendation):** the two columns it wrote —
`documents.signatures_voided_at` and `documents.signatures_voided_roles` — were
deliberately NOT dropped and now have no writer.

---

## 19. Gifts subsystem (`gifts` table + `gift_claim_link` / `gift_mark_sent` / `gift_reschedule` / `ensure_gift_buyer_account` / `create_gift` / `gifts.order_id`)
- reported by: `docs/reports/TASK-NOGUARD2-REPORT.md` [INV batch1.md#20], `docs/reports/TASK-GIFTCREDITS-REPORT.md` [INV batch2.md#28, #29]
- reachability: **partially superseded — verify each claim separately.**
  - **`gifts` row count in prod = 0.** Still no gift has ever existed.
  - **`create_gift` NOW EXISTS in prod** (`create_gift(uuid,text,text,text,text,text,boolean,uuid)`) and **does call `ensure_gift_buyer_account(v_gift)`** — so claim (b) is correct that GIFTCREDITS revived it. Full pg_proc gift family: `create_gift`, `ensure_gift_buyer_account`, `gift_claim_link`, `gift_mark_sent`, `gift_reschedule`, `gift_transfer`, `my_gifts`, `open_gift`, `redeem_gift`.
  - **`create_gift` is REACHABLE from the live UI.** `src/lib/gifts.ts:85` calls the RPC; `src/components/app/GiftCreateForm.tsx:54` calls `createGift`; `GiftCreateForm` is mounted at `src/components/app/LeadWorkDrawer.tsx:492`, and `LeadWorkDrawer` is mounted in the live dashboard at `src/components/app/DashboardPanel.tsx:493`. So "no INSERT path existed" is **no longer true** — the path exists and has simply never been used. `gift_claim_link` / `gift_reschedule` / `gift_mark_sent` are reached from `src/components/app/GiftsContent.tsx:4`.
  - **`gifts.order_id` — claim CONFIRMED.** `SELECT count(*) FILTER (WHERE order_id IS NOT NULL), count(*) FROM gifts` → `0 | 0`. No `pg_proc` body references both `gifts` and `order_id`. No `src/` or `api/` reference. It was created as `order_id uuid REFERENCES orders(id) ON DELETE SET NULL` at `supabase/migrations/20260623050000_gifts.sql:22`; `orders` is a RETIRED table (CLAUDE.md "RETIRED — do not resurrect"), and the FK is gone — `\d+ gifts` lists FKs for `buyer_user_id`, `offering_id`, `org_id`, `redeemed_user_id` and **no FK on `order_id`**. It is an unconstrained, unread, unwritten uuid.
- exists: yes — table and all functions present in prod.
- content — `gifts` DDL:

```
                                  Table "public.gifts"
         Column         |           Type           | Nullable |      Default
------------------------+--------------------------+----------+-------------------
 id                     | uuid                     | not null | gen_random_uuid()
 code                   | text                     | not null |
 item_type              | text                     | not null |
 item_label             | text                     | not null |
 amount                 | numeric(10,2)            |          |
 buyer_name             | text                     |          |
 buyer_email            | text                     |          |
 buyer_user_id          | uuid                     |          |
 order_id               | uuid                     |          |     <-- vestigial
 recipient_name         | text                     |          |
 recipient_email        | text                     |          |
 gift_message           | text                     |          |
 status                 | text                     | not null | 'created'::text
 unlock_gate            | text                     | not null | 'none'::text
 unlocked               | boolean                  | not null | false
 opened_at              | timestamp with time zone |          |
 redeemed_at            | timestamp with time zone |          |
 redeemed_user_id       | uuid                     |          |
 expires_at             | timestamp with time zone |          |
 created_at             | timestamp with time zone | not null | now()
 org_id                 | uuid                     | not null | current_org()
 deliver_on             | date                     |          |
 last_sent_at           | timestamp with time zone |          |
 send_count             | integer                  | not null | 0
 transferred_from_email | text                     |          |
 offering_id            | uuid                     |          |
Indexes:
    "gifts_pkey" PRIMARY KEY, btree (id)
    "gifts_code_idx" btree (code)
    "gifts_code_key" UNIQUE CONSTRAINT, btree (code)
    "gifts_org_idx" btree (org_id)
    "gifts_recipient_idx" btree (recipient_email)
    "gifts_status_idx" btree (status, created_at DESC)
Check constraints:
    "gifts_status_check" CHECK (status = ANY (ARRAY['created','paid','delivered','opened','redeemed','expired','cancelled']))
    "gifts_unlock_gate_check" CHECK (unlock_gate = ANY (ARRAY['none','intro_call']))
Foreign-key constraints:
    "gifts_buyer_user_id_fkey"    FOREIGN KEY (buyer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
    "gifts_offering_id_fkey"      FOREIGN KEY (offering_id) REFERENCES offerings(id)
    "gifts_org_id_fkey"           FOREIGN KEY (org_id) REFERENCES organizations(id)
    "gifts_redeemed_user_id_fkey" FOREIGN KEY (redeemed_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
    -- (no constraint on order_id)
Policies:
    "gifts_admin_all"      TO authenticated USING (is_admin()) WITH CHECK (is_admin())
    "gifts_buyer_read" FOR SELECT TO authenticated
        USING ((buyer_user_id = auth.uid()) OR (redeemed_user_id = auth.uid()) OR is_admin())
    "gifts_org_boundary" AS RESTRICTIVE TO authenticated
        USING (org_id = current_org()) WITH CHECK (org_id = current_org())
```

`gift_claim_link` / `gift_mark_sent` / `gift_reschedule` bodies (live prod):

```sql
CREATE OR REPLACE FUNCTION public.gift_claim_link(p_gift_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  RETURN '/redeem?code=' || v_g.code;
END;
$function$

CREATE OR REPLACE FUNCTION public.gift_mark_sent(p_gift_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  UPDATE gifts SET last_sent_at = now(), send_count = send_count + 1 WHERE id = p_gift_id;
END;
$function$

CREATE OR REPLACE FUNCTION public.gift_reschedule(p_gift_id uuid, p_deliver_on date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_g gifts%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN
    RAISE EXCEPTION 'not your gift';
  END IF;
  IF v_g.status = 'redeemed' THEN RAISE EXCEPTION 'this gift has already been used'; END IF;
  UPDATE gifts SET deliver_on = p_deliver_on WHERE id = p_gift_id;
END;
$function$
```

The revival call site inside `create_gift` (live prod), which is the proof for claim (b):

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

and `ensure_gift_buyer_account` itself (live prod):

```sql
CREATE OR REPLACE FUNCTION public.ensure_gift_buyer_account(p_gift_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

---

## 20. `template_tokens` dictionary rows (`template_id IS NULL`) — reported 190, prod now **170**
- reported by: `docs/reports/TASK-TOKENAUDIT-REPORT.md` [INV batch1.md#21]
- reachability: **verified unreachable by the merge engine.** `generate_document`'s only `template_tokens` read is scoped to one template:

```sql
  FOR r IN
    SELECT namespace, field, token FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
```

  (line 149 of `pg_get_functiondef(generate_document)`). A row with `template_id IS NULL` can never satisfy `template_id = v_tmpl.id`, so no dictionary row is ever merged into a document.
- exists: yes — but **the count has moved since the report**. Prod today: `SELECT count(*) FROM template_tokens WHERE template_id IS NULL` → **170**; total rows **360** (so 190 are template-scoped). The report recorded `117 scoped / 190 dictionary` (307 total). Both numbers changed; 53 rows were added and the scoped/dictionary split shifted. Not investigated further — flagging the drift, not resolving it.
- content — all 170 dictionary rows, `token | kind | notes`:

```
{{CLIENT.EMERGENCY_CONTACT_1_NAME}} | field | Primary emergency contact's name from the client's profile. Blank until the client fills in emergency contacts.
{{CLIENT.EMERGENCY_CONTACT_1_PHONE}} | field | Primary emergency contact's phone. Blank until filled in.
{{CLIENT.EMERGENCY_CONTACT_1_RELATIONSHIP}} | field | How the primary emergency contact is related to the client, e.g. Spouse. Blank until filled in.
{{CLIENT.EMERGENCY_CONTACT_2_NAME}} | field | Backup (second) emergency contact's name. Blank until filled in — a document generated before the client adds one will show an empty line.
{{CLIENT.EMERGENCY_CONTACT_2_PHONE}} | field | Backup emergency contact's phone. Blank until filled in.
{{CLIENT.EMERGENCY_CONTACT_2_RELATIONSHIP}} | field | Backup emergency contact's relationship to the client. Blank until filled in.
{{CLIENT.JUMP_EXPERIENCE}} | field | The jumping experience and maximum height the client attested on their profile. Blank if never provided. Only meaningful on riding/jumper documents.
{{CLIENT.JUMP_LIMITATIONS}} | field | Injuries, physical limitations or riding gaps the client disclosed on their profile. Blank if none entered.
{{CLIENT.RIDING_BACKGROUND}} | field | The client's prior instruction, showing or competition background as entered on their profile. Blank if never provided.
{{CLIENT.RIDING_EXPERIENCE_YEARS}} | field | Years of riding experience the client attested, e.g. 12. Blank if never provided.
{{DIR.COUNTERPARTY_TERM}} | field | The other side's role word — seller, buyer, lessor or lessee — picked from the contract's direction. Blank without a contract.
{{DIR.DIRECTION_TERM}} | field | The transaction word — purchase, sale or lease — picked from the template's direction variants by who retained us and which side of the deal the contract records. Blank when the document has no contract behind it.
{{DIR.ROLE_TERM}} | field | The client's role word — buyer, seller, owner, lessee or lessor — picked from the contract's direction (who retained us + deal side). Blank without a contract.
{{DIR.TARGET_TERM}} | field | What the search is looking for — a horse, a buyer, a lessee — picked from the contract's direction. Used by the search retainer. Blank without a contract.
{{DOC.DISPLAY_CODE}} | system | The document's short human reference — e.g. "CTR-000101". On the company copy of an execution it falls back to the first eight characters of the document id, so it is never blank there. Blank elsewhere when the document has no code.
{{DOC.EFFECTIVE_DATE}} | system | The date the document takes effect, written out — e.g. August 12, 2026. Uses the document's effective date once set at execution; before that, the date it was created. Always prints a date.
{{DOC.GENERATED_DATE}} | system | The date the document was generated, e.g. August 12, 2026. Always fills.
{{DOC.HAS_TITLE}} | system | A yes/no flag: does this document have a title at all? Non-empty when it does. Use it as {{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}your contract{{/if}} so the fallback wording lives in the template and can be edited. It tests for NULL, not for emptiness — an empty-string title keeps behaving exactly as it did before extraction.
{{DOC.ID}} | system | The document's human reference number, e.g. DOC-000123. Always fills. This is the one to use anywhere a person will read or quote the reference.
{{DOC.INTEGRITY_HASH}} | system | The FULL SHA-256 execution hash. COMPANY COPY ONLY — never put this in an email to a signer; they get DOC.REFERENCE_CODE instead. Blank on a document with no execution hash.
```

*(The full 170-row dump is on disk at
`/private/tmp/claude-504/-Users-Cactai/5a47bfcc-2691-47a7-b539-4d95f2da8aa9/scratchpad/flagharvest/dict.txt`.
The 56 that no body of any kind references are listed in full in artifact 21
below; the remainder are tokens that ARE referenced by a template/clause/email
body but whose dictionary row is nonetheless never read by `generate_document`
— the dictionary is documentation, not machinery.)*

---

## 21. DEFINED-BUT-UNUSED tokens — reported 46, re-derived **56**
- reported by: `docs/reports/TASK-TOKENAUDIT-REPORT.md` [INV batch1.md#22]
- reachability: **verified — these token keys appear in no body anywhere.** Re-derivation query run against prod (defined = `template_tokens`; used = `contract_clause_defs.body` ∪ `contract_templates.body` (active AND inactive) ∪ `contract_field_defs.field_key` ∪ `email_templates.body`+`subject`):

```sql
WITH defined AS (SELECT DISTINCT btrim(token,'{}') tok FROM template_tokens),
clause_used AS (SELECT DISTINCT m[1] tok FROM contract_clause_defs,
  regexp_matches(coalesce(body,''),'\{\{([A-Z0-9_.#/]+)\}\}','g') m),
flat_all AS (SELECT DISTINCT m[1] tok FROM contract_templates,
  regexp_matches(coalesce(body,''),'\{\{([A-Z0-9_.#/]+)\}\}','g') m),
email_used AS (SELECT DISTINCT m[1] tok FROM email_templates,
  regexp_matches(coalesce(body,'')||coalesce(subject,''),'\{\{[#/]?([A-Z0-9_.]+)\}\}','g') m),
fkeys AS (SELECT DISTINCT field_key tok FROM contract_field_defs),
used AS (SELECT tok FROM clause_used UNION SELECT tok FROM flat_all
         UNION SELECT tok FROM fkeys UNION SELECT tok FROM email_used)
SELECT count(*) FROM defined d WHERE NOT EXISTS (SELECT 1 FROM used u WHERE u.tok=d.tok);
-- → 56
```

  **The report's number was 46 and its query did not include `email_templates`** — that table did not exist when TOKENAUDIT ran (`email_templates` now holds 19 rows). Running the report's *original* query (no email arm) against today's prod gives **99**, because ~43 `MSG.*` / `ORG.FOOTER*` / `DOC.TITLE*` email tokens have been added to the dictionary since and are used only in email bodies. **56 is the honest current answer.** The report's original buckets survive inside it: PARTY.* ×6, FHE.* ×7, REQ.* ×5, TXN order-form fee tokens ×6, ENG ×6, plus assorted DOC/ORD/ORG/HORSE/CLIENT singles.
- exists: yes — all 56 rows present in prod, none deleted.
- content — the 56 token keys with their notes:

```
CLIENT.JUMP_LIMITATIONS  ||  Injuries, physical limitations or riding gaps the client disclosed on their profile. Blank if none entered.
DOC.GENERATED_DATE  ||  The date the document was generated, e.g. August 12, 2026. Always fills.
DOC.HAS_TITLE  ||  A yes/no flag: does this document have a title at all? Non-empty when it does. Use it as {{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}your contract{{/if}} so the fallback wording lives in the template and can be edited. It tests for NULL, not for emptiness — an empty-string title keeps behaving exactly as it did before extraction.
DOC.ID  ||  The document's human reference number, e.g. DOC-000123. Always fills. This is the one to use anywhere a person will read or quote the reference.
DOC.PARTY_CAN_EDIT_DEAL  ||  A yes/no flag: may this party edit the terms directly? Non-empty when they may. Takes precedence over DOC.PARTY_CAN_SUGGEST — a party who can edit is never told they may only suggest.
DOC.PARTY_CAN_SUGGEST  ||  A yes/no flag: may this party suggest changes (but not make them)? Non-empty when they may. Only consult it when DOC.PARTY_CAN_EDIT_DEAL is blank; with both blank the party is read-only and reviews the terms as written.
DOC.PARTY_NEEDS_INFO  ||  A yes/no flag: does this party still have fields to fill on this contract? Non-empty when their controls allow filling AND at least one of their fields is empty. Drives the "add your information" phrase in the contract invitation — never promise an action the party's controls do not allow.
DOC.TITLES  ||  The list of document titles in a multi-document delivery, for {{#each DOC.TITLES}}<li>{{.}}</li>{{/each}}. Each item is a plain title string. Empty for a single-document email.
DOC.UUID  ||  The document's internal system id — a long UUID for tracing, not for reading. Always fills. Prefer DOC.ID in anything human-facing.
ENG.COMPETITION_GOALS  ||  Meant to carry competition goals from evaluation intake — never wired, ALWAYS RENDERS BLANK today.
ENG.ID  ||  The contract's reference number, e.g. CTR-000101. Despite the ENG name this reads the CONTRACT behind the document (engagements were retired). Blank when the document has no contract.
ENG.OTHER_CONSIDERATIONS  ||  Meant to carry other evaluation considerations from intake — never wired, ALWAYS RENDERS BLANK today.
ENG.PROGRAM_SCOPE  ||  Meant to carry the horsemanship program scope from an order form that no longer exists — ALWAYS RENDERS BLANK today.
ENG.SERVICE_TYPE  ||  The service type behind the document, e.g. JUMPER_TRAINING — from the start request or the contract's segment. Blank without one.
ENG.START_DATE  ||  The contract's effective date, written out. Blank when there is no contract.
FHE.ADDRESS  ||  Older twin of {{ORG.ADDRESS}} — same value (currently blank until the owner supplies the business address). Pick the ORG token.
FHE.EMAIL  ||  Older twin of {{ORG.EMAIL}} — same value (Hello@FHEquestrian.com). Pick the ORG token.
FHE.LEGAL_NAME  ||  Older twin of {{ORG.LEGAL_NAME}} — renders the same value (French Heritage Equestrian). No live template uses FHE.*; pick the ORG token.
FHE.PHONE  ||  Older twin of {{ORG.PHONE}} — same value (858-439-3614). Pick the ORG token.
FHE.SIGNATORY_NAME  ||  Older twin of {{ORG.SIGNATORY_NAME}} — same value (Charles Zigmund). Pick the ORG token.
FHE.SIGNATORY_TITLE  ||  Older twin of {{ORG.SIGNATORY_TITLE}} — same value (Owner, Sole Proprietor). Pick the ORG token.
FHE.URL  ||  Older twin of {{ORG.URL}} — same value (www.frenchheritageequestrian.com). Pick the ORG token.
HORSE.OWNER_NAME  ||  Meant to name the owner/seller of a third-party horse being evaluated — NOT WIRED: no template uses it and the merge renders nothing for it today (the horses.owner_name column it points at does not exist).
MSG.CHECKLIST  ||  What the invited person will be asked to do after clicking, for {{#each MSG.CHECKLIST}}. Each item has .TITLE (the thing) and .ACTION (what to do with it, already lower-cased so it reads mid-sentence). Only unfinished items appear. Empty when nothing is assigned yet.
MSG.IS_GUARDIAN_COPY  ||  A yes/no flag: is this copy addressed to a guardian because the party is a minor? Non-empty when it is. The greeting then names the guardian and the body names the minor as the SUBJECT of the document, not as the addressee.
MSG.IS_RESEND  ||  A yes/no flag on the invitation: is this the SAME link sent again, rather than a new one? Non-empty on a resend. It changes the subject as well as the opening, because the subject is the only part of a resend most people read and it has to say "you already have this" without looking like a second invitation.
MSG.IS_SHARE  ||  A yes/no flag on an evaluation report: was it shared with someone other than the buyer? Non-empty when shared. Changes "Your report" to "A report has been shared with you".
MSG.IS_SINGLE  ||  A yes/no flag: is MSG.COUNT exactly one? Non-empty when it is. Use as {{#if MSG.IS_SINGLE}}update{{else}}updates{{/if}} so singular and plural wording is editable instead of compiled in.
MSG.ITEMS  ||  The list this email is built around — notification titles, calendar reminders, lapsed holds. Scalar items: {{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}. Already escaped where the original sender escaped. Empty when there is nothing to list, and every use is guarded so no empty <ul> is emitted.
ORD.SERVICE_SELECTION  ||  The purchased item's label from the most recent purchase line on the document's contract, e.g. Riding Lesson — Single. Blank when no purchase is linked to the contract. (Live source is purchase_items.label; the old client_purchases pointer is dead.)
ORD.UUID  ||  WARNING (flagged 2026-08-12, awaiting owner ruling): despite the ORD name this prints the DOCUMENT's internal UUID, not a purchase id — the recorded mapping and the merge code both point at documents.id. Do not place it expecting an order number; use DOC.ID for a readable document reference. The real order number lives on the purchase (PUR-000001 style) and has no token today.
ORG.ADDRESS  ||  The business address from Business Settings — CURRENTLY BLANK until the owner supplies it; the document will show an empty space where it is placed.
ORG.ENTITY_FORMATION  ||  How the entity is formed, e.g. Sole proprietorship (California). From Business Settings.
ORG.INVOICE_DUE_DAYS  ||  Invoice due days from org settings — NOT SEEDED, renders blank until the owner fills it in.
ORG.LATE_FEE  ||  The late fee as money — CURRENTLY BLANK until the owner sets it in Business Settings.
ORG.REGISTERED_AGENT  ||  The registered agent from Business Settings — currently blank until the owner supplies it.
ORG.TERMINATION_NOTICE_DAYS  ||  Termination notice days from org settings — NOT SEEDED, renders blank until the owner fills it in.
ORG.URL  ||  The public website: www.frenchheritageequestrian.com. From org settings (CONTACT / URL).
PARTY.ADDRESS  ||  Generic any-party one-line address. Unused by any live template — prefer the role-named token (e.g. CLIENT.ADDRESS, LESSEE.ADDRESS).
PARTY.DOB  ||  Generic any-party date of birth (was meant for the minor sections). Unused by any live template — prefer PARTICIPANT.DOB.
PARTY.EMAIL  ||  Generic any-party email. Unused by any live template — prefer the role-named token.
PARTY.PHONE  ||  Generic any-party phone. Unused by any live template — prefer the role-named token.
PARTY.PRINTED_NAME  ||  Generic any-party signature-line name — identical output to PARTY.FULL_NAME, and like it unused by any live template. Prefer the role-named token (e.g. CLIENT.PRINTED_NAME).
PARTY.RELATIONSHIP  ||  How a party is related to the client, e.g. parent of participant — from the document's party record. Unused by any live template today.
REQ.CONDITION_UPDATES  ||  Meant to carry client-reported horse condition changes since the last engagement — never wired, ALWAYS RENDERS BLANK today.
REQ.DETAILS  ||  The category-specific answers, for {{#each REQ.DETAILS}}. Each item has .LABEL (the humanised question, e.g. "Rider age") and .VALUE (the answer). Empty when the form asked no follow-up questions or all were left blank.
REQ.LOCATION_PREFERENCE  ||  Meant to carry the requested service location from an order — never wired, ALWAYS RENDERS BLANK today.
REQ.NOTES  ||  Meant to carry free-text notes submitted with an order — never wired, ALWAYS RENDERS BLANK today.
REQ.PREFERRED_SCHEDULE  ||  Meant to carry the client's preferred dates/times submitted with an order — the order-form capture was never wired, so it ALWAYS RENDERS BLANK today.
TXN.ADDITIONAL_SERVICES  ||  Old order-form token for extra evaluation services and pricing. No live template references it and nothing feeds it — renders blank.
TXN.EVALUATION_FEE  ||  Old order-form per-horse evaluation fee token. No live template references it and nothing feeds it — renders blank.
TXN.JUMPER_TRAINING_FEE  ||  Old order-form jumper-training rate token. No live template references it and nothing feeds it — renders blank.
TXN.MONTHLY_FEE  ||  Old order-form monthly program fee token. No live template references it and nothing feeds it — renders blank.
TXN.OTHER_FEES  ||  Old order-form itemized-fees token. No live template references it and nothing feeds it — renders blank.
TXN.PACKAGE_FEE  ||  Old order-form token for a multi-lesson package price. No live template references it and nothing feeds it — renders blank. Historically shared one source with TXN.SERVICE_FEE — owner to rule which name survives.
TXN.SESSION_FEE  ||  Old order-form per-session fee token. No live template references it and nothing feeds it — renders blank.
```

---

## 22. 24 tokens appearing only in INACTIVE flat template bodies
- reported by: `docs/reports/TASK-TOKENAUDIT-REPORT.md` [INV batch1.md#23]
- reachability: **verified — count re-derived as exactly 24.** Each appears in at least one inactive flat body and in NO active flat body, NO clause def, NO `contract_field_defs.field_key`, and NO email template. The gate is the template's own `active` / `deleted_at`: `generate_document` only merges a template it is given, and the inactive ones are not offered.
- exists: yes. Prod state of the four host templates — **all four are `active=false` AND soft-deleted** (`deleted_at IS NOT NULL`):

```
      template_key      | active | deleted | body_bytes
------------------------+--------+---------+------------
 HORSE_LEASE            | f      | t       |      18253
 HORSE_PURCHASE_SALE    | f      | t       |       4755
 HORSE_SALE_TRANSFER    | f      | t       |       4213
 RELEASE_HORSE_EXERCISE | f      | t       |       9871
```

  Note: the report named `HORSE_LEASE` and `RELEASE_HORSE_EXERCISE` as contributors, but **neither contributes any token to this set today** — every token they carry is also present in an active body, a clause def, a field def or an email template. All 24 come from `HORSE_PURCHASE_SALE` and `HORSE_SALE_TRANSFER` only. (`HORSE_LEASE` is the D10 "archived original", retained deliberately.)
- content — token, and which inactive template(s) hold it:

```
HORSE.BEHAVIORAL_HISTORY      ||  HORSE_PURCHASE_SALE
HORSE.COMPETITION_HISTORY     ||  HORSE_PURCHASE_SALE
HORSE.MEDICAL_HISTORY         ||  HORSE_PURCHASE_SALE
HORSE.MEDICATION_HISTORY      ||  HORSE_PURCHASE_SALE
HORSE.TRAINING_HISTORY        ||  HORSE_PURCHASE_SALE
TXN.ADDITIONAL_DISCLOSURES    ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.BALANCE_DUE               ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.DEFAULT_TERMS             ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.DEPOSIT_TERMS             ||  HORSE_PURCHASE_SALE
TXN.DOCUMENTS_TRANSFERRED     ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.EQUIPMENT_EXCLUDED        ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.EQUIPMENT_INCLUDED        ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.PAYMENT_METHOD            ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.PPE_DATE                  ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.PPE_STATUS                ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.RISK_TRANSFER             ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.TRANSFER_CONDITION        ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.TRANSFER_DATE             ||  HORSE_SALE_TRANSFER
TXN.TRANSPORT_RESPONSIBILITY  ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.TRIAL_CARE_PARTY          ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.TRIAL_PERIOD              ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.TRIAL_RISK_PARTY          ||  HORSE_PURCHASE_SALE
TXN.TRIAL_TERMS               ||  HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
TXN.WARRANTIES                ||  HORSE_PURCHASE_SALE
```

---

## 23. `MINOR_RIDER` template (prod `contract_templates`, id `2ea9837b-d535-48c8-bb85-7214e1493e4d`)
- reported by: `docs/reports/TASK-TOKENAUDIT-REPORT.md` [INV batch1.md#24]
- reachability: **NOT gated — this one is live-but-unused, which is the opposite of the others.** All claims re-verified in prod:
  - `active` = **true**, `deleted_at` = NULL, `version` = 1, `wall_gating` = false
  - `length(body)` = **5,481** bytes (matches the report exactly)
  - documents ever generated from it = **0**
  - scoped `template_tokens` rows = **0** — so if anyone did generate from it, all 26 of its `{{…}}` tokens would render as literal text (the `generate_document` loop shown in artifact 20 finds nothing to substitute)
  - `docs/TOKEN_DICTIONARY.md` line 192 (verbatim): *"All signed documents now use a single CLIENT signer block (`SIG.CLIENT.*` + `CLIENT.PRINTED_NAME`); minors are handled by CUT-marker sections (no separate ADULT/MINOR SIGNER marker blocks; no GUARDIAN co-signer namespace in the release bodies). **MINOR_RIDER template retired (no source file).**"* — the doc says retired, the table says `active=true`. They disagree.
- exists: yes
- content — **the full body, verbatim from prod** (a legal instrument the owner has not reviewed):

```
MINOR RIDER AGREEMENT, PARENTAL CONSENT, AND MEDICAL AUTHORIZATION AGREEMENT

This Minor Rider Agreement, Parental Consent, and Medical Authorization Agreement (“Agreement”) is entered into as of {{DOC.EFFECTIVE_DATE}} (“Effective Date”) by and between:

{{ORG.LEGAL_IDENTITY}} ("COMPANY"),

and

Parent/Legal Guardian: {{GUARDIAN.FULL_NAME}}

Address: {{GUARDIAN.ADDRESS}}

Phone: {{GUARDIAN.PHONE}}

Email: {{GUARDIAN.EMAIL}}

and

Minor Participant: {{PARTICIPANT.FULL_NAME}}

Date of Birth:

Emergency Contact (if different): {{EMERGENCY_CONTACT.FULL_NAME}}

Relationship: {{EMERGENCY_CONTACT.RELATIONSHIP}}

Phone: {{EMERGENCY_CONTACT.PHONE}}

RECITALS

A. Parent or Legal Guardian desires to allow the Minor Participant to engage in horseback riding lessons, equine training, horsemanship instruction, horse handling activities, and related equestrian services provided by COMPANY.

B. Parent acknowledges the inherent risks associated with equine activities.

C. Parent wishes to voluntarily permit Minor Participant to participate despite such risks.

AGREEMENT

AUTHORIZATION TO PARTICIPATE

Parent authorizes Minor Participant to participate in:

□ Riding Lessons

□ Horsemanship Instruction

□ Groundwork Activities

□ Horse Handling Activities

□ Mounted Exercises

□ Unmounted Exercises

□ Clinics

□ Horse Shows

□ Educational Programs

□ Other:

LOCATIONS COVERED

This Agreement applies to all activities conducted:

At facilities utilized by COMPANY;

At third-party boarding or training facilities;

At horse shows, clinics, exhibitions, and competitions;

At client-owned facilities;

At any other location where services are provided.

LIABILITY RELEASE — INCORPORATED BY REFERENCE

The risk acknowledgments, releases, and indemnity obligations applicable to the activities under this Agreement are set forth exclusively in the separately executed Liability Release and Assumption of Risk agreement, which is incorporated herein by reference.

RULES AND INSTRUCTIONS

Parent agrees that Minor Participant shall:

Follow instructor directions at all times;

Observe facility rules;

Treat horses humanely;

Use equipment properly;

Refrain from dangerous conduct.

Failure to comply may result in immediate removal from activities without refund.

HELMET REQUIREMENT

Minor Participant shall wear a properly fitted ASTM/SEI-certified riding helmet whenever mounted unless specifically authorized otherwise in writing by Parent and COMPANY.

Parent acknowledges that helmets reduce but do not eliminate risk.

MEDICAL INFORMATION

Known Allergies:

Medical Conditions:

Medications:

Physician:

Physician Phone:

Health Insurance Carrier:

Policy Number:

EMERGENCY MEDICAL AUTHORIZATION

Parent authorizes COMPANY and its representatives to obtain emergency medical treatment for Minor Participant when Parent cannot be immediately reached.

This authorization includes:

Emergency transportation;

Emergency medical care;

Emergency surgical procedures if deemed necessary by medical professionals.

Parent agrees to be solely responsible for all resulting expenses.

PHOTO AND MEDIA CONSENT

Parent grants permission for photographs and video recordings of Minor Participant to be used for educational, promotional, advertising, website, social media, and business purposes.

Parent may decline consent by initialing here:

TRANSPORTATION AUTHORIZATION

Parent authorizes Minor Participant to be transported by:

□ Instructor

□ Trainer

□ Employee

□ Volunteer

□ Not Authorized

Parent acknowledges transportation-related risks.

PAYMENT RESPONSIBILITY

Parent remains responsible for payment of all fees associated with services provided to Minor Participant.

Lesson Fees: {{TXN.SERVICE_FEE}}

Payment Schedule: {{TXN.PAYMENT_SCHEDULE}}

CANCELLATION POLICY

Cancellation of a scheduled session requires at least {{ORG.CANCELLATION_NOTICE_HOURS}} hours advance notice. Sessions cancelled with less than the required notice may be charged a late-cancellation fee of {{ORG.CANCELLATION_FEE}}. Failure to appear for a scheduled session without notice may be charged a no-show fee of {{ORG.NO_SHOW_FEE}}.

TERMINATION

COMPANY may suspend or terminate participation for:

Unsafe conduct;

Repeated rule violations;

Harassment or abusive behavior;

Failure to pay fees;

Conduct detrimental to horses, staff, or participants.

DISPUTE RESOLUTION

Disputes arising under this Agreement shall be resolved by:

□ Arbitration

□ Litigation

Venue shall be San Diego County, California.

ATTORNEY’S FEES

The prevailing party shall recover reasonable attorney’s fees and costs.

GOVERNING LAW

This Agreement shall be governed by California law.

ENTIRE AGREEMENT

This document constitutes the entire agreement between the parties concerning Minor Participant’s involvement in equine activities.

ACKNOWLEDGMENT

Parent acknowledges:

This Agreement has been read completely;

Questions have been answered satisfactorily;

Participation is voluntary;

Parent is authorized to sign for Minor Participant.

PARENT OR LEGAL GUARDIAN

Signature: {{SIG.GUARDIAN.NAME}}

Printed Name: {{GUARDIAN.PRINTED_NAME}}

Relationship to Minor:

Date: {{SIG.GUARDIAN.DATE}}

MINOR PARTICIPANT

Signature (if capable): {{SIG.PARTICIPANT.NAME}}

Printed Name: {{PARTICIPANT.PRINTED_NAME}}

Date: {{SIG.PARTICIPANT.DATE}}

COMPANY: {{ORG.LEGAL_NAME}}

By (signature): {{SIG.COMPANY.NAME}}

Printed: {{ORG.SIGNATORY_NAME}}

Title: {{ORG.SIGNATORY_TITLE}}

Date: {{SIG.COMPANY.DATE}}
```

---

## 24. `docs/BACKLOG.md` — dead nav route + placeholder media items
- reported by: `docs/reports/POST_RUN_CLOSEOUT.md` [INV batch2.md#25] — the naming line is `POST_RUN_CLOSEOUT.md:475`: *"`docs/BACKLOG.md`'s other pre-existing open items (Business admin suite, `pending_fee_candidates` p.mobile bug, dead nav route, placeholder media) — untouched this run, out of scope."*
- reachability: both are **documentation entries, not code** — they describe things that are already absent from the running app. The nav entry they refer to was removed from `MODULES_GROUP` on 2026-08-02; the placeholder media are live-but-unfinished front-end assets, not gated.
- exists: yes, both entries still in `docs/BACKLOG.md`.
- content — verbatim:

```markdown
- **Placeholder media + copy** — hero (`Landing.tsx`), Story "SWAP" bands,
  offering-card `CoverPlaceholder`, `Faq.tsx` placeholder copy, hero/page content
  refresh, real street address for `src/lib/seo.ts` (TODO at :18), and whether
  `Contact.tsx`'s `noindex` is intended. **Stop: owner supplies assets/copy.**
```

```markdown
- **Brokerage staff hub** — `mod.brokerage`'s staff hub page does not exist; the
  dead nav entry (which 404'd live) was removed 2026-08-02. Build the hub, then
  re-add the nav item.
```

The "Placeholder media + copy" item sits under **`## Owner-decision stops`**; the
"Brokerage staff hub" item sits under **`## Zero-live-behavior work`**. The
brokerage entry is the same subject as artifact 28 below.

---

## 25. Abandoned git branch `task/b-lead-notifications`
- reported by: `docs/reports/TASK-B-REPORT.md` [INV batch2.md#27]
- reachability: **verified — it carries nothing.** `git rev-list --count main..task/b-lead-notifications` → **0**. `git merge-base --is-ancestor task/b-lead-notifications main` → **true** (fully contained in main). `git diff --stat main...task/b-lead-notifications` → **empty**. It is a label pointing at a commit that is already on main.
- exists: yes, local-only (`refs/heads/task/b-lead-notifications`; **no** `refs/remotes/origin/task/b-lead-notifications`).
- content:

```
refs/heads/task/b-lead-notifications  523ab7f  2026-08-04 09:44:28 -0700
  R11 spec: condition blocks are self-contained (containment scope, owner model)

commit 523ab7fc2e1a1cf609affe39b497eb0c6f21bfa4
Author: Admin <admin@cactai.io>
Date:   Tue Aug 4 09:44:28 2026 -0700
    R11 spec: condition blocks are self-contained (containment scope, owner model)

$ git log main..task/b-lead-notifications --oneline
(no output — zero commits)

$ git diff --stat main...task/b-lead-notifications
(no output — zero files)
```

The claim that it "sits abandoned pointing at an unrelated R10 commit" is
confirmed in substance: the tip is an **R11** spec commit, unrelated to lead
notifications. The real TASK-B work lives on
`task/b-lead-notifications-v2` (`3b0c2c9`, *"TASK B: lead/inbound notifications
— support-request email dispatch, OPS_INBOX fix"*), which **is** pushed
(`refs/remotes/origin/task/b-lead-notifications-v2`).

---

## 26. Held PAGEVIS nav-filter patch (`docs/reports/PAGEVIS-navfilter.patch`)
- reported by: `docs/reports/TASK-PAGEVIS-REPORT.md` [INV batch2.md#30]
- reachability: **verified unapplied.** `grep -n "isPageHidden\|EyeOff\|admin/pages" src/components/app/AppLayout.tsx` returns **nothing**, and the live signature at `src/components/app/AppLayout.tsx:649-654` still ends at `grantKeys: string[] = []` with no `isPageHidden` parameter. So none of the `page:` keys, none of the 8 module child rows, no Page-visibility settings row and no filter clause are in the running nav. The gate is stated in the patch header (`docs/reports/PAGEVIS-navfilter.patch:2`): *"HELD: AppLayout.tsx belongs to TASK-HORSEONE"*.
- **test file: does NOT exist on disk.** `test/ui/pagevis_nav_filter.test.ts` is absent; `ls test/ui/` shows `pagevis_registry.test.ts` and `pagevis_settings.test.tsx` (both applied) but not the nav-filter one. The 10 tests exist **only inside the patch**, as a `new file mode 100644` hunk.
- exists: yes — 17,482-byte patch file.
- content — the full patch:

```diff
From: TASK-PAGEVIS
Subject: [PATCH] PAGEVIS — the nav filter (HELD: AppLayout.tsx belongs to TASK-HORSEONE)

Apply after HORSEONE merges:
    git apply docs/reports/PAGEVIS-navfilter.patch

Adds: NavItem.page, page keys on every hideable row, the 8 module CHILD rows,
the Page visibility settings row, and the visibility clause in manageNavGroups().
Ships with its own proof — test/ui/pagevis_nav_filter.test.ts, 10 tests, green
against this exact diff before it was held.

diff --git a/src/components/app/AppLayout.tsx b/src/components/app/AppLayout.tsx
index e41fed5..0b27d59 100644
--- a/src/components/app/AppLayout.tsx
+++ b/src/components/app/AppLayout.tsx
@@ -11,7 +11,7 @@ import {
      import when Directory comes back out of Review. */
   ChevronDown, ChevronUp, Plus, LifeBuoy, ShoppingBag, MessageSquare, ListChecks,
   PanelLeftClose, PanelLeftOpen, Activity, Compass, Handshake, Grid3x3, Bookmark,
-  Receipt, Eye, Library,
+  Receipt, Eye, EyeOff, Library,
 } from 'lucide-react';
 import { useAuth } from '../../contexts/AuthContext';
 import { usePrefersReducedMotion } from '../../lib/hooks';
@@ -406,6 +406,11 @@ interface NavItem {
   module?: string;
   adminOnly?: boolean;
   superAdmin?: boolean;
+  /* TASK-PAGEVIS — this row's key in src/lib/pageRegistry.ts. The tenant hides
+     rows one at a time under Settings -> Page visibility, and the stored key is
+     this slug rather than `to`, so a route rename cannot orphan the choice.
+     A row with no `page` can never be hidden; that is the safe default. */
+  page?: string;
   /** Unread-style count shown on this item's badge (RailLink). Not part of the
    *  static nav tables — injected at render time (see AppLayout's navGroups). */
   badge?: number;
@@ -509,20 +514,20 @@ const MANAGEMENT_GROUP: NavItem[] = [
      horse roster) and now live ONLY in the Review group. Put them back here on
      acceptance. Dashboard's badge is injected by route below, not by table
      position, so it followed the row and still reads unread + inbound. */
-  { to: '/app/ops/support', label: 'Support', icon: LifeBuoy },
+  { to: '/app/ops/support', label: 'Support', icon: LifeBuoy, page: 'mgmt.support' },
   // Servicing folded in 2026-07-31: three links did not justify a heading of
   // their own, and they are day-to-day management like the queues above.
-  { to: '/app/ops/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons' },
-  { to: '/app/ops/documents', label: 'Documents', icon: FileText },
+  { to: '/app/ops/lessons', label: 'Lessons', icon: GraduationCap, module: 'mod.lessons', page: 'lessons.hub' },
+  { to: '/app/ops/documents', label: 'Documents', icon: FileText, page: 'mgmt.documents' },
   // A deal is the envelope a transaction lives in — its parties, what each side
   // gives, and the documents that make it real. It sits beside Documents because
   // that is what it produces.
-  { to: '/app/ops/deals', label: 'Deals', icon: Handshake },
+  { to: '/app/ops/deals', label: 'Deals', icon: Handshake, page: 'mgmt.deals' },
   // Payment review is a management task; Business is hidden until the reporting
   // and business-ops surfaces that belong there actually exist.
   /* Receipt, not ReceiptText — which My Orders already uses in the member nav.
      Two different pages were wearing one glyph. */
-  { to: '/app/ops/payments/review', label: 'Payment review', icon: Receipt },
+  { to: '/app/ops/payments/review', label: 'Payment review', icon: Receipt, page: 'mgmt.payments_review' },
 ];
 /* PEOPLE — everyone we know, one list per relationship to the business:
  *   Leads      potential future clients (the campaign list)
@@ -565,23 +570,36 @@ const ACCOUNTS_GROUP: NavItem[] = [
  * goal is fewer headings, not more. Their items live in MANAGEMENT_GROUP above.
  * BUSINESS_GROUP returns when there is more in it than a single link. */
 const COMMUNITY_GROUP: NavItem[] = [
-  { to: '/app/ops/activity', label: 'Activity', icon: Activity },
-  { to: '/app/ops/evaluations', label: 'Evaluations', icon: FileText },
-  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield },
-  { to: '/app/ops/lookups', label: 'Field options', icon: ListChecks },
+  { to: '/app/ops/activity', label: 'Activity', icon: Activity, page: 'community.activity' },
+  { to: '/app/ops/evaluations', label: 'Evaluations', icon: FileText, page: 'community.evaluations' },
+  { to: '/app/ops/moderation', label: 'Moderation', icon: Shield, page: 'community.moderation' },
+  { to: '/app/ops/lookups', label: 'Field options', icon: ListChecks, page: 'community.lookups' },
   // Library, not BookOpen — Directory (People) already holds BookOpen.
-  { to: '/app/ops/content', label: 'Content store', icon: Library },
+  { to: '/app/ops/content', label: 'Content store', icon: Library, page: 'community.content' },
   /* Eye, not Shield. Shield was on Moderation, Oversight, all three Settings
      pages and all three Platform pages — the "eight identical Shield icons" the
      icon exercise names. This takes one of them off it. */
-  { to: '/app/ops/oversight', label: 'Oversight', icon: Eye },
+  { to: '/app/ops/oversight', label: 'Oversight', icon: Eye, page: 'community.oversight' },
 ];
 const MODULES_GROUP: NavItem[] = [
   // Brokerage has no staff hub page yet (mod.brokerage's live surfaces are the
   // client-lane engagement reads) — the entry linked to an unregistered route
   // and 404'd for every staff user with the module on. Re-add with the hub.
-  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding' },
-  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
+  /* TASK-PAGEVIS — the CHILD pages are nav rows now, not just cards on their
+     hub. The owner asked to hide individual pages, and a page with no row of
+     its own can only be hidden by hiding its hub, which is the "do not make me
+     hide whole modules" complaint restated. Their own rows are also what makes
+     the NO-CASCADE rule safe: hiding a hub cannot strand a child that has its
+     own way in. If these rows are ever removed, the cascade rule has to change
+     with them. Every row here starts VISIBLE and the owner trims from there. */
+  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding', page: 'boarding.hub' },
+  { to: '/app/ops/boarding/facilities', label: 'Facilities & stalls', icon: HomeIcon, module: 'mod.boarding', page: 'boarding.facilities' },
+  { to: '/app/ops/boarding/agreements', label: 'Board agreements', icon: FileText, module: 'mod.boarding', page: 'boarding.agreements' },
+  { to: '/app/ops/boarding/charges', label: 'Board charges', icon: Receipt, module: 'mod.boarding', page: 'boarding.charges' },
+  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops', page: 'barnops.hub' },
+  { to: '/app/ops/barnops/resources', label: 'Resources', icon: Boxes, module: 'mod.barnops', page: 'barnops.resources' },
+  { to: '/app/ops/barnops/consumption', label: 'Consumption log', icon: ListChecks, module: 'mod.barnops', page: 'barnops.consumption' },
+  { to: '/app/ops/barnops/allocation-rules', label: 'Allocation rules', icon: ListChecks, module: 'mod.barnops', page: 'barnops.allocation_rules' },
   /* REVIEW SECTION — MOVED OUT, not deleted (TASK-REVIEWNAV). One row LEFT
      this group for Review:
        { to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords' }
@@ -592,7 +610,9 @@ const MODULES_GROUP: NavItem[] = [
      `module` key: the Review row deliberately has no module gate (the owner has
      to be able to reach every implementation), and putting it back ungated
      would show Records to a tenant that has the module off. */
-  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
+  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees', page: 'employees.hub' },
+  { to: '/app/ops/employees/staff', label: 'Staff', icon: UserRound, module: 'mod.employees', page: 'employees.staff' },
+  { to: '/app/ops/employees/schedule', label: 'Schedule', icon: CalendarDays, module: 'mod.employees', page: 'employees.schedule' },
 ];
 const SETTINGS_GROUP: NavItem[] = [
   /* Owner, 2026-08-12: "team moves to configuration section." Arrived here from
@@ -626,9 +646,13 @@ const SETTINGS_GROUP: NavItem[] = [
      production `profiles.role` holds only ADMIN, SUPER_ADMIN and USER; there is
      not one MANAGER or EMPLOYEE account in existence. Restore it here WITHOUT
      `adminOnly` on acceptance, for the reason recorded above. */
-  { to: '/app/ops/admin/branding', label: 'Branding', icon: Shield, adminOnly: true },
-  { to: '/app/ops/admin/products', label: 'Products', icon: Shield, adminOnly: true },
-  { to: '/app/ops/admin/forms', label: 'Forms', icon: Shield, adminOnly: true },
+  { to: '/app/ops/admin/branding', label: 'Branding', icon: Shield, adminOnly: true, page: 'settings.branding' },
+  { to: '/app/ops/admin/products', label: 'Products', icon: Shield, adminOnly: true, page: 'settings.products' },
+  { to: '/app/ops/admin/forms', label: 'Forms', icon: Shield, adminOnly: true, page: 'settings.forms' },
+  /* TASK-PAGEVIS — where the tenant hides pages. Deliberately carries NO
+     `page` key: it is the way back from every other choice made here, and
+     set_page_hidden refuses to hide it server-side as well. */
+  { to: '/app/ops/admin/pages', label: 'Page visibility', icon: EyeOff, adminOnly: true },
 ];
 
 // kept for compatibility with anything importing MANAGE_NAV
@@ -644,6 +668,9 @@ export function manageNavGroups(
   isAdmin: boolean,
   isSuperAdmin: boolean,
   grantKeys: string[] = [],
+  /* TASK-PAGEVIS. Defaulted, so every existing caller and test keeps working
+     and a caller that does not pass it simply hides nothing. */
+  isPageHidden: (pageKey: string) => boolean = () => false,
 ): NavGroup[] {
   if (isSuperAdmin) {
     // the platform admin belongs to no tenant — platform surfaces only
@@ -651,7 +678,14 @@ export function manageNavGroups(
   }
   const visible = (items: NavItem[]) => items.filter(
     (i) => (!i.module || hasModule(i.module))
-        && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
+        && (!i.adminOnly || isAdmin || grantKeys.includes(i.to))
+        /* TASK-PAGEVIS — the tenant's own choice, and the LAST clause on
+           purpose. The two above are ENTITLEMENT and ROLE; this one is a
+           display preference and must never read like a third gate. It removes
+           the row and nothing else: the route stays registered, the URL still
+           works, and nobody is denied anything. A row with no `page` key is
+           unhideable by construction. */
+        && !(i.page && isPageHidden(i.page)),
   );
   const groups: NavGroup[] = [
     /* MANAGEMENT leads: the two work QUEUES that must be dealt with each day.
@@ -1264,7 +1298,7 @@ function ClientRail({ bellCount, dmCount, presence, lessonsOn, onOpenTour, onSig
 }
 
 export default function AppLayout() {
-  const { profile, isAdmin, isStaff, isSuperAdmin, hasModule, signOut } = useAuth();
+  const { profile, isAdmin, isStaff, isSuperAdmin, hasModule, isPageHidden, signOut } = useAuth();
   const dmCount = useDmUnread();
   useViewSurfaces();
   const navigate = useNavigate();
@@ -1507,7 +1541,7 @@ export default function AppLayout() {
   // count has nowhere else to live — dropping it would make open leads
   // invisible from the nav, a regression against today.
   const navGroups = showRail
-    ? manageNavGroups(hasModule, isAdmin, isSuperAdmin, grantKeys).map((g) => ({
+    ? manageNavGroups(hasModule, isAdmin, isSuperAdmin, grantKeys, isPageHidden).map((g) => ({
         ...g,
         items: g.items.map((it) => (it.to === '/app/dashboard' ? { ...it, badge: unreadCount + inboundCount } : it)),
       }))
diff --git a/test/ui/pagevis_nav_filter.test.ts b/test/ui/pagevis_nav_filter.test.ts
new file mode 100644
index 0000000..3d27958
--- /dev/null
+++ b/test/ui/pagevis_nav_filter.test.ts
@@ -0,0 +1,120 @@
+/**
+ * TASK-PAGEVIS — the nav filter.
+ *
+ * ⚠ THIS FILE SHIPS WITH THE HELD AppLayout DIFF, NOT BEFORE IT. AppLayout.tsx
+ * belongs to TASK-HORSEONE, which had not merged when PAGEVIS ran, so the nav
+ * change and this proof of it live together in
+ * docs/reports/PAGEVIS-navfilter.patch. Applying that patch adds both.
+ *
+ * `manageNavGroups` is exported and pure, so the filter is provable without a
+ * browser, without mocking a session, and without rendering the rail. What it
+ * checks is the part that could be got wrong:
+ *
+ *  · hiding removes EXACTLY one row, and the module's other rows survive;
+ *  · hiding is applied AFTER entitlement and role, never instead of them;
+ *  · the Page visibility row itself carries no key, so nothing can hide it;
+ *  · every `page` key in the nav is a real registry entry (the two would
+ *    otherwise drift and a toggle would silently control nothing).
+ */
+import { describe, it, expect } from 'vitest';
+import { manageNavGroups, MANAGE_NAV } from '../../src/components/app/AppLayout';
+import { pageByKey } from '../../src/lib/pageRegistry';
+
+const ALL_MODULES = () => true;
+const NONE_HIDDEN = () => false;
+
+function rows(hidden: (k: string) => boolean, hasModule = ALL_MODULES) {
+  return manageNavGroups(hasModule, true, false, [], hidden)
+    .flatMap((g) => g.items.map((i) => i.to));
+}
+
+describe('PAGEVIS — the nav filter', () => {
+  it('every nav `page` key is a real registry entry', () => {
+    for (const item of MANAGE_NAV) {
+      if (!item.page) continue;
+      expect(
+        pageByKey(item.page),
+        `nav row "${item.label}" carries page key "${item.page}", which the registry does not list`,
+      ).toBeDefined();
+    }
+  });
+
+  it('every nav `page` key points at the row it is on', () => {
+    for (const item of MANAGE_NAV) {
+      if (!item.page) continue;
+      expect(pageByKey(item.page)!.path, `"${item.label}" and its registry entry disagree on the route`)
+        .toBe(item.to);
+    }
+  });
+
+  it('shows all 11 previously-dark module pages when nothing is hidden', () => {
+    const shown = rows(NONE_HIDDEN);
+    for (const path of [
+      '/app/ops/boarding', '/app/ops/boarding/facilities',
+      '/app/ops/boarding/agreements', '/app/ops/boarding/charges',
+      '/app/ops/barnops', '/app/ops/barnops/resources',
+      '/app/ops/barnops/consumption', '/app/ops/barnops/allocation-rules',
+      '/app/ops/employees', '/app/ops/employees/staff', '/app/ops/employees/schedule',
+    ]) {
+      expect(shown, `not in the nav: ${path}`).toContain(path);
+    }
+  });
+
+  it('hiding one page removes exactly that row — its siblings stay', () => {
+    const before = rows(NONE_HIDDEN);
+    const after = rows((k) => k === 'boarding.facilities');
+
+    expect(before.filter((p) => !after.includes(p))).toEqual(['/app/ops/boarding/facilities']);
+    for (const sib of ['/app/ops/boarding', '/app/ops/boarding/agreements', '/app/ops/boarding/charges']) {
+      expect(after, `sibling lost with it: ${sib}`).toContain(sib);
+    }
+  });
+
+  it('hiding a HUB is not a cascade — its children keep their rows', () => {
+    const after = rows((k) => k === 'barnops.hub');
+    expect(after).not.toContain('/app/ops/barnops');
+    for (const child of [
+      '/app/ops/barnops/resources', '/app/ops/barnops/consumption',
+      '/app/ops/barnops/allocation-rules',
+    ]) {
+      expect(after, `orphaned by hiding the hub: ${child}`).toContain(child);
+    }
+  });
+
+  it('hiding does not reach across modules', () => {
+    const after = rows((k) => k.startsWith('boarding.'));
+    expect(after.filter((p) => p.startsWith('/app/ops/boarding'))).toEqual([]);
+    expect(after).toContain('/app/ops/barnops');
+    expect(after).toContain('/app/ops/employees');
+  });
+
+  it('is applied after entitlement, not instead of it', () => {
+    // Module off + page hidden: still gone, and no error from the double gate.
+    const noBoarding = (k: string) => k !== 'mod.boarding';
+    expect(rows((k) => k === 'boarding.hub', noBoarding)).not.toContain('/app/ops/boarding');
+    // Module off alone already removes it — hiding is not what is doing the work.
+    expect(rows(NONE_HIDDEN, noBoarding)).not.toContain('/app/ops/boarding');
+  });
+
+  it('cannot hide the Page visibility row — it carries no key', () => {
+    const row = MANAGE_NAV.find((i) => i.to === '/app/ops/admin/pages');
+    expect(row, 'the control surface has no nav row').toBeDefined();
+    expect(row!.page, 'giving this row a page key would make the way back hideable').toBeUndefined();
+
+    // Hide everything the registry knows about; this row must survive.
+    expect(rows(() => true)).toContain('/app/ops/admin/pages');
+  });
+
+  it('leaves the other Settings rows hideable', () => {
+    const after = rows((k) => k === 'settings.branding');
+    expect(after).not.toContain('/app/ops/admin/branding');
+    expect(after).toContain('/app/ops/admin/products');
+    expect(after).toContain('/app/ops/admin/pages');
+  });
+
+  it('hides nothing when no predicate is passed (every existing caller)', () => {
+    const withDefault = manageNavGroups(ALL_MODULES, true, false, [])
+      .flatMap((g) => g.items.map((i) => i.to));
+    expect(withDefault).toEqual(rows(NONE_HIDDEN));
+  });
+});
```

---

## 27. `/app/ops/admin/pages` — `AdminPageVisibilityPage`
- reported by: `docs/reports/TASK-PAGEVIS-REPORT.md` [INV batch2.md#31]
- reachability: **partly verified, partly corrected.**
  - **No nav entry: CONFIRMED.** The row that would add it is inside the held patch (see artifact 26). `grep "admin/pages" src/components/app/AppLayout.tsx` → nothing.
  - **"reachable only by typing the URL": NOT QUITE.** There is one in-app link: `src/pages/app/ops/OpsDashboard.tsx:210` renders *"…you can bring its menu entry back under **Settings → Page visibility**"* as a `<Link to="/app/ops/admin/pages">`. So a staff admin who is on the Ops dashboard can reach it by clicking. There is no menu row.
  - The route itself is registered and admin-gated: `src/App.tsx:384` — `<Route path="ops/admin/pages" element={<ProtectedRoute requireAdmin><AdminPageVisibilityPage /></ProtectedRoute>} />`.
- exists: yes — `src/pages/app/ops/admin/AdminPageVisibilityPage.tsx`, 240 lines.
- content — the render sections and all user-visible copy:

```tsx
/* ── page header (lines 206-218) ──────────────────────────────────────── */
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Page visibility</h1>
      <p className="text-sm text-green-800/70 mb-1">
        Every page in the staff menu. Hide the ones you do not use — one page at a time, never a
        whole module.
      </p>
      <p className="text-[12.5px] text-muted mb-6">
        Hiding removes the menu entry and nothing else: the page still opens from a link or a
        bookmark, keeps its data, and stays switched on for your account. Turning a whole module
        off is a different thing and lives under Feature flags.
        {hiddenCount > 0 && ` ${hiddenCount} hidden right now.`}
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {sections.map((s) => (
        <Section key={s.id} section={s} isHidden={isHidden} hasModule={hasModule}
                 busyKey={busyKey} onToggle={onToggle} />
      ))}

      <p className="text-[12.5px] text-muted">
        Not listed here: the temporary <Link className="underline" to="/app/ops/review">Review</Link>{' '}
        section, where a page sits until you accept it — moving it out is the acceptance signal, so
        hiding a Review row would falsify it.
      </p>
    </div>
  );

/* ── Section (lines 127-159) ──────────────────────────────────────────── */
    <section className="mb-8" aria-label={section.label}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] tracking-widest uppercase text-muted font-semibold">
          {section.label}
        </p>
        {section.module && (
          <p className="text-[12px] text-muted">
            {entitled ? 'Module enabled' : 'Module locked — ask the platform owner to enable it'}
          </p>
        )}
      </div>

      {entitled && hasChildren && hubs.length > 0 && (
        <p className="text-[12.5px] text-muted mb-2">
          Hiding <span className="text-green-900">{hubs[0].label}</span> hides only its own nav
          row. The pages inside it keep theirs and stay in the menu — nothing gets stranded.
        </p>
      )}

      <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
        {section.pages.map((p) => (
          <PageRow key={p.key} page={p} hidden={isHidden(p.key)} entitled={entitled}
                   busy={busyKey === p.key} onToggle={onToggle} />
        ))}
      </div>
    </section>

/* ── PageRow (lines 58-111) ───────────────────────────────────────────── */
    <div data-testid={`pagevis-row-${page.key}`} className={…}>
      <div className="min-w-0">
        <p className={…}>
          {page.parent && <span aria-hidden className="text-muted mr-1.5">└</span>}
          {page.label}
        </p>
        <p className="text-[12px] text-muted mt-0.5 break-all">{page.path}</p>
        {page.note && <p className="text-[12px] text-gold-800 mt-1">{page.note}</p>}
        {parked && (
          <p className="text-[12px] text-muted mt-1">
            Currently sitting in the temporary Review section, so its usual nav row is not in
            the rail yet. Your choice here applies the moment it moves back.
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-3">
        {page.protected === true ? (
          <span …><Lock size={13} aria-hidden /> Always shown</span>
        ) : locked ? (
          <span data-testid={`pagevis-locked-${page.key}`} …><Lock size={13} aria-hidden /> Locked</span>
        ) : (
          <button type="button" disabled={disabled} onClick={() => onToggle(page, !hidden)}
                  data-testid={`pagevis-toggle-${page.key}`} aria-pressed={hidden} …>
            {hidden ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
            {busy ? 'Saving…' : hidden ? 'Hidden' : 'Shown'}
          </button>
        )}
      </div>
    </div>
```

Every user-visible string on the page, in one list:

```
Page visibility                                    (h1, and document title)
Every page in the staff menu. Hide the ones you do not use — one page at a time, never a whole module.
Hiding removes the menu entry and nothing else: the page still opens from a link or a bookmark,
  keeps its data, and stays switched on for your account. Turning a whole module off is a
  different thing and lives under Feature flags.
 <N> hidden right now.
Module enabled
Module locked — ask the platform owner to enable it
Hiding <hub label> hides only its own nav row. The pages inside it keep theirs and stay in the
  menu — nothing gets stranded.
Currently sitting in the temporary Review section, so its usual nav row is not in the rail yet.
  Your choice here applies the moment it moves back.
Always shown
Locked
Saving…  /  Hidden  /  Shown            (the toggle's three states)
The change did not save.                 (thrown when the write does not land)
Could not hide <page label>.  /  Could not show <page label>.
Not listed here: the temporary Review section, where a page sits until you accept it — moving it
  out is the acceptance signal, so hiding a Review row would falsify it.
```

---

## 28. `mod.brokerage` — entitled module with no hub
- reported by: `docs/reports/TASK-PAGEVIS-REPORT.md` [INV batch2.md#32]
- reachability: **verified.** `MODULE_HUB_ROUTES` is derived from the page registry (`src/pages/app/ops/OpsDashboard.tsx:101-105`); because no registry entry exists for brokerage, `hubRoutes['mod.brokerage']` is `undefined`, so the tile falls to the `else` branch — a `<div role="note">`, not a `<Link>` (`src/pages/app/ops/OpsDashboard.tsx:256-267`). Confirmed by the source comment at `OpsDashboard.tsx:106-108`. There is also no nav row: the `MODULES_GROUP` comment at `src/components/app/AppLayout.tsx` (patch context lines 85-87) records that the entry *"linked to an unregistered route and 404'd for every staff user with the module on"* and was removed.
- **Copy correction:** the tile does **not** render the string "Enabled, hub not built". The rendered text is just **`Enabled`**. "hub not shipped" appears only in the source comment at `OpsDashboard.tsx:256`.
- exists: yes — the entitlement row is live in prod.
- content — the `org_modules` row:

```
 id        | 7f59085b-7ff9-4812-857a-a903794af7ff
 org_id    | e656f20b-ef43-4725-9029-19e7f0190d9c
 module_key| mod.brokerage
 enabled   | t
 source    | TIER
 enabled_at| 2026-07-02 22:24:22.560749+00
 expires_at| (null)
 created_at| 2026-07-02 22:24:22.560749+00
 updated_at| 2026-07-09 14:09:00.379279+00
```

and the tile code that produces the white, non-linking "Enabled" tile
(`src/pages/app/ops/OpsDashboard.tsx`):

```tsx
/* line 93-108 — why brokerage has no route */
/**
 * Wave-7 re-link seam: moduleKey → the module's hub route, listing ONLY routes
 * that are actually registered in App.tsx. A module tile navigates only when
 * its hub route appears here; an enabled module without an entry renders as a
 * non-navigating "Enabled" status tile (dead links are forbidden). When a hub
 * page ships, add its route to App.tsx AND one entry here, e.g.
 *   'mod.brokerage': '/app/ops/brokerage',
 */
export const MODULE_HUB_ROUTES: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_HUB_PAGE_KEY)
    .map(([moduleKey, pageKey]) => [moduleKey, pageByKey(pageKey)?.path])
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string'),
);
// mod.brokerage has no hub page, so the registry yields no entry for it and its
// tile renders as the non-navigating "Enabled" status tile (dead links are
// forbidden). That is the same behaviour as the hand-written map this replaced.

/* line 111-118 — brokerage is the first tile in the launcher */
const MODULE_TILES: { moduleKey: string; label: string }[] = [
  { moduleKey: 'mod.brokerage', label: 'Brokerage' },
  { moduleKey: 'mod.lessons', label: 'Lessons' },
  …
];

/* line 255-267 — the branch that renders for brokerage */
                ) : (
                  /* Enabled module, hub not shipped: status tile, never a dead link. */
                  <div
                    data-testid={`module-${tile.moduleKey}-enabled`}
                    role="note"
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4"
                  >
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">
                      Enabled
                    </span>
                  </div>
                )}
```

---

## 29. `/app/ops/review/contact-dossier` — `ContactDossierModal`
- reported by: `docs/reports/TASK-REVIEWNAV-REPORT.md` [INV batch2.md#35]
- reachability: **claim needs qualifying.** The COMPONENT is not unreachable — it takes a `contactId` prop and is mounted from two live places: `src/pages/app/RecordsPage.tsx:94` (route `/app/records`, live for staff) and `src/pages/app/ops/ContactsPage.tsx:398` (that page IS retired — `CONTACTS_PAGE_RETIRED = true` at `src/pages/app/ops/ContactsPage.tsx:563`). What had no route was **the component in isolation, on a known record, for side-by-side review** — REVIEWNAV gave it one at `src/App.tsx:368`, mounted by `ReviewContactDossier` in `src/pages/app/ops/review/ReviewMounts.tsx:68`. That review route is `requireAdmin` and reachable only from the temporary Review nav section. **Its saves are REAL** — it is mounted on production contact `b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6` (Sarah Morgan), stated at `ReviewMounts.tsx:59-63`.
- exists: yes — `src/components/app/ContactDossierModal.tsx`, 420 lines.
- content — the review mount, then the modal's field labels and render:

```tsx
/* src/pages/app/ops/review/ReviewMounts.tsx:59-88 */
/** A real production contact, so the two editors are compared on one record
 *  rather than on a fixture. Sarah Morgan — the most-populated contact that is
 *  NOT Mary Richardson, who is D8's live acceptance case and is left alone.
 *  `?contact=<id>` overrides it for a different comparison. */
const REVIEW_CONTACT_ID = 'b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6';

export function ReviewContactDossier() {
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const contactId = params.get('contact') ?? REVIEW_CONTACT_ID;
  return (
    <div>
      <Helmet><title>Review · Contact dossier</title></Helmet>
      <ReviewBanner title="Contact editor slot A — the dossier (ContactDossierModal): 30 fields in five groups, tabbed.">
        <strong>Its saves are real.</strong> This is the live editor mounted on a real production
        contact, not a copy — the comparison is only honest if it is the real thing. Look at it;
        do not type in it. Compare with slot B at /app/ops/review/contact-form.
      </ReviewBanner>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">
        <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
          Open the dossier editor
        </button>
      </div>
      {open && <ContactDossierModal contactId={contactId} onClose={() => setOpen(false)} />}
    </div>
  );
}
```

```tsx
/* src/components/app/ContactDossierModal.tsx:31-57 — every field label */
const FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  { title: 'Name and contact', fields: [
    ['first_name', 'First name'], ['last_name', 'Last name'],
    ['email', 'Email'],
    ['phone', 'Phone'], ['phone_ext', 'Phone ext.'],
    ['mobile', 'Mobile'], ['mobile_ext', 'Mobile ext.'],
    ['whatsapp', 'WhatsApp'],
    ['date_of_birth', 'Date of birth'],
  ]},
  { title: 'Mailing address', fields: [
    ['address_line1', 'Street'], ['address_line2', 'Apt / suite'],
    ['city', 'City'], ['state', 'State'], ['postal_code', 'ZIP'], ['country', 'Country'],
  ]},
  { title: 'Emergency contacts', fields: [
    ['emergency_contact_1_name', 'Contact 1 name'],
    ['emergency_contact_1_relationship', 'Relationship'],
    ['emergency_contact_1_phone', 'Phone'],
    ['emergency_contact_2_name', 'Contact 2 name'],
    ['emergency_contact_2_relationship', 'Relationship'],
    ['emergency_contact_2_phone', 'Phone'],
  ]},
  { title: 'Riding background', fields: [
    ['riding_experience_years', 'Years riding'], ['jump_experience', 'Jump experience'],
    ['riding_background', 'Background'], ['jump_limitations', 'Limitations'],
  ]},
  { title: 'Notes', fields: [['notes', 'Staff notes']] },
];

/* line 124-132 — the seven tabs */
  const TABS: [Tab, string, number | null][] = [
    ['record', 'Record', null],
    ['relationships', 'Relationships', (d?.family.dependants.length ?? 0) + (d?.horses.length ?? 0)],
    ['documents', 'Documents', d?.documents.length ?? 0],
    ['orders', 'Orders', d?.orders.length ?? 0],
    ['paperwork', 'Paperwork', null],
    ['account', 'Account', null],
    ['activity', 'Activity', null],
  ];

/* line 134-166 — header + tab bar */
    <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4 py-8"
      role="dialog" aria-modal="true" aria-label={`${name} record`} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-green-800/10 w-full max-w-3xl max-h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start gap-3 px-5 py-4 border-b border-green-800/10">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl text-green-900 truncate">{name}</h2>
            <p className="text-[11.5px] text-muted">
              {(c.display_code as string) ?? '—'}
              {d?.standing.contact_type && ` · ${CONTACT_TYPE_LABEL[…]}`}
              {d?.account ? ' · has an account' : ' · no account'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" …><X size={18} /></button>
        </div>

/* line 171-221 — the Record tab: "Filed under" picker + the five field groups */
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Filed under</p>
                      {/* DIRECTORY is deprecated (TASK-RECORDS, 2026-08-12) — split into
                          VENDOR and PARTNER. Not offered as a fresh pick, but shown if a
                          contact is already filed there so the picker never hides its own
                          current state. */}
                      {(['LEAD', 'CONTACT', 'VENDOR', 'PARTNER', 'TEAM',
                        ...(d.standing.contact_type === 'DIRECTORY' ? ['DIRECTORY'] : [])])
                        .map((t) => <button …>{CONTACT_TYPE_LABEL[t]}</button>)}
                      {d.standing.is_client && (<span …>Client</span>)}

/* line 224-246 — Relationships tab */
                  <Section title="Guardian">    … <Empty>No guardian on file.</Empty>
                  <Section title="Dependants">  … <Empty>None.</Empty>   (sub: `born <dob>`)
                  <Section title="Horses">      … <Empty>None.</Empty>
                  <Section title="Contract roles"> … <Empty>Not a party to any contract.</Empty>

/* line 249-269 — Documents tab */
                    <button type="button" className="btn-secondary text-sm" onClick={() => setAssigning(true)}>
                      Assign a document or contract
                    </button>
                  <Section title="Documents">  … <Empty>None.</Empty>   (badge: 'superseded' | status)
                  {/* Horse records sit beside the document list because the
                      horse-care documents cannot be completed without them. */}
                  <ClientHorseRecordsCard contactId={contactId} />

/* line 271-284 — Orders tab */
                  <AttachOfferingPanel contactId={contactId} onAttached={load} />
                  <Section title="Orders"> … <Empty>None.</Empty>   (main: `$<amount> · <code>`)

/* line 286 — Paperwork tab */
              {tab === 'paperwork' && <PaperworkEditor contactId={contactId} />}

/* line 288-344 — Account tab */
                    <Section title="Account">   (badge: 'suspended' | member_status)
                      <Row main={d.account.display_name ?? '(no display name)'} …/>
                    <Section title="Sign-in">
                      <Row main={… || 'no provider on file'}
                           sub={… `last seen <ts>` : 'never signed in'} />
                    <Section title="Posts"> … <Empty>None.</Empty>  (badge: 'pulled'|'live'|'draft')
                  ) : (
                    <Empty>
                      This person has no account — they have never signed in. That is
                      normal for a counterparty, a lead, or a minor on a parent&apos;s account.
                      Their contact record is complete in its own right; an account
                      simply adds a login.
                    </Empty>
                      <p className="text-sm text-green-800">Invitation sent to {String(c.email)}.</p>
                      <p className="text-[11.5px] text-muted">
                        Add an email address on the Record tab first — then they can be
                        provisioned and invited from here.
                      </p>
                      /* THE ONE shared provisioning path (deal plan L11). */
                      <ProvisionClientForm source="contact" contactId={contactId} … />

/* line 346-363 — Activity tab */
                  <Section title="Notifications"> … <Empty>None.</Empty>
                  <Section title="Audit trail">   … <Empty>None.</Empty>

/* line 368-381 — footer */
            <span className="text-[12px] text-gold-800">
              {n} unsaved change{n === 1 ? '' : 's'}
            </span>
            <button type="button" className="btn-secondary text-sm" onClick={onClose}>Close</button>
            <button type="button" className="btn-primary text-sm" …>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
```

Error strings: `Could not load this record.` · `Could not save.` · `Could not file this contact.`

---

## 30. `/app/ops/review/contact-form` — `ContactForm`
- reported by: `docs/reports/TASK-REVIEWNAV-REPORT.md` [INV batch2.md#36]
- reachability: **verified.** The component is presentational and takes `onSubmit`/`onCancel` props. Its only other mount is `src/pages/app/ops/ContactsPage.tsx:544`, and that page is retired behind `CONTACTS_PAGE_RETIRED = true` (`src/pages/app/ops/ContactsPage.tsx:563`) — so in the live app it renders nowhere. REVIEWNAV's mount is `src/App.tsx:369` → `ReviewContactForm` (`src/pages/app/ops/review/ReviewMounts.tsx:91`), `requireAdmin`, reachable only from the Review nav section. **The submit is inert**: the review page passes a handler that refuses; the component itself is unmodified (`ReviewMounts.tsx:107-111`).
- exists: yes — `src/components/ops/contacts/ContactForm.tsx`, 147 lines.
- content — the inert mount, then the form:

```tsx
/* src/pages/app/ops/review/ReviewMounts.tsx:90-115 */
/** DUPECENSUS Contact editor slot B — ContactForm, 4 fields. */
export function ReviewContactForm() {
  /* The refusal goes through the component's OWN error prop — that is the real
     parent contract (ContactsPage does the same with its save error), so the
     form is exercised exactly as it is in production rather than through a
     rejected promise nothing is listening for. */
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Helmet><title>Review · Contact form</title></Helmet>
      <ReviewBanner title="Contact editor slot B — the 2026-07-01 form (ContactForm): 4 fields, FormField primitives, inline validation.">
        <strong>Submit is inert here.</strong> The component is unmodified — this page passes it a
        handler that refuses, because its real create path does not set <code>contact_type</code>
        and would file a new person on the wrong page. That defect is DUPECENSUS&rsquo;s to fix, not
        this task&rsquo;s. Validation, layout and the cancel path are all real: try an empty first name.
      </ReviewBanner>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4 bg-white rounded-xl border border-green-800/10 p-5">
        <ContactForm
          onSubmit={async () => { setError('Review mount — nothing was saved. This form is here to be looked at, not to create a contact.'); }}
          onCancel={() => setError(null)}
          error={error}
        />
      </div>
    </div>
  );
}
```

```tsx
/* src/components/ops/contacts/ContactForm.tsx:41-146 — fields, labels, copy */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setNameError('First name is required.');
      return;
    }
    setNameError(null);
    const trimmedLast = lastName.trim();
    const input: ContactInput = {
      first_name: trimmedFirst,
      last_name: trimmedLast || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {contact?.tags?.includes('owner') && (
        <p className="mb-4">
          <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
            Owner
          </span>
        </p>
      )}

      <FormField label="First name" required error={nameError}>   … <input name="first_name" />
      <FormField label="Last name">                                … <input name="last_name" />
      <FormField label="Email">                                    … <input name="email" type="email" />
      <FormField label="Phone">                                    … <input name="phone" />

      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving…' : contact ? 'Save changes' : 'Create contact'}
        </button>
      </div>
    </form>
  );
```

Complete visible-copy list: `Owner` · `First name` · `Last name` · `Email` ·
`Phone` · `First name is required.` · `Cancel` · `Saving…` · `Save changes` ·
`Create contact` — plus the review mount's own refusal string
*"Review mount — nothing was saved. This form is here to be looked at, not to create a contact."*

---

## 31. `/app/documents` — member self-sign Documents row hidden for staff
- reported by: `docs/reports/TASK-REVIEWNAV-REPORT.md` [INV batch2.md#40]
- reachability: **verified. The gate is the `!isStaff` argument, not a flag.**
  - `src/components/app/AppLayout.tsx:1280` — `const presence = useNavPresence(!isStaff);`
  - `src/components/app/AppLayout.tsx:374-384` — `useNavPresence(enabled)` initialises every key to `false` and **returns early without calling the RPC when `enabled` is false**: `if (!enabled) return;` (line 380). Its own comment (lines 370-373): *"`enabled` mirrors useInboundOpenCount's staff-only gate, inverted: only non-staff accounts ever see these links."*
  - `src/components/app/AppLayout.tsx:1137` — `{presence.documents && <RailLink to="/app/documents" label="My Documents" icon={FileText} />}` — so for a staff account this is permanently `false && …`.
  - `src/components/app/AppLayout.tsx:1288` — `const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);` filters the same row out of the avatar dropdown and mobile drawer.
  - The row's table entry (never rendered for staff) is `src/components/app/AppLayout.tsx:439` — `{ key: 'documents', label: 'My Documents', icon: FileText, to: '/app/documents' }`.
  - The route itself is open to any signed-in account: `src/App.tsx:231` — `<Route path="documents" element={<Documents />} />`.
  - REVIEWNAV records exactly this at `src/lib/reviewSection.ts:300-302`: *"Signing B · member self-sign → `/app/documents` … This nav row is hidden for staff in the normal app (`useNavPresence(!isStaff)`) — the Review row is the only way you can reach it."*
  - (For completeness: even for a member, the backing RPC `my_nav_presence()` gates it on `EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1)`.)
- exists: yes — `src/pages/app/Documents.tsx` (18 lines) rendering `src/components/app/DocumentsContent.tsx` (477 lines).
- content — the page, then the self-sign surface:

```tsx
/* src/pages/app/Documents.tsx — the whole file */
import { useDocumentTitle } from '../../lib/hooks';
import { DocumentsContent } from '../../components/app/DocumentsContent';

/**
 * MY DOCUMENTS (/app/documents). The content itself is DocumentsContent,
 * shared with the Account page's inline panel — see that file for the
 * self-sign, email-a-copy, and paper-reading behavior.
 */
export default function Documents() {
  useDocumentTitle('My Documents');
  return (
    <div className="max-w-3xl mx-auto">
      <p className="eyebrow mb-2">Documents</p>
      <h1 className="heading-section text-green-800 mb-8">Everything you've agreed to, all in one place.</h1>
      <DocumentsContent />
    </div>
  );
}
```

```tsx
/* src/components/app/DocumentsContent.tsx:192-318 — THE SELF-SIGN ROW */
/**
 * MEMBER self-sign row (mirrors the staff SigningPanel's SignPartyRow, but
 * client-facing): the member types THEIR name and signs THEIR OWN party role.
 * The `record_signature` RPC (20260702000000) verifies server-side that the
 * caller's contact IS the party — the UI never chooses whose signature to seal.
 * A rejected sign renders inline and the row stays unsigned (refresh happens
 * only on success).
 */
function SelfSignRow({ item, onSign, onView }) {
  …
  // Contract-workflow documents (contract_id set) are reviewed + signed on the
  // full contract surface, which uses the contract-aware seal. Only release /
  // waiver docs sign inline here. This keeps one signing entry point per contract
  // (audit M-7) — the list deep-links contracts to /app/contracts/:id.
  const isContractDoc = !!doc.contract_id;

  return (
    <div className="bg-white border border-green-800/10 p-5" data-testid={`self-sign-${doc.id}`}>
      <div className="flex items-start gap-3">
        <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-sans font-medium text-green-900">{doc.title ?? doc.display_code ?? 'Contract'}</p>
          <p className="text-xs text-muted mt-1">You sign as {party_role.replace(/_/g, ' ').toLowerCase()}.</p>

          {signed ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-xs text-green-700 inline-flex items-center gap-1">
                <Check size={12} aria-hidden="true" /> You've signed this document.
              </p>
              {doc.merged_body && <ReadButton onOpen={openReader} />}
              {doc.status === 'EXECUTED' && doc.merged_body && (
                <button type="button" … onClick={…downloadDocumentPdf…}>
                  <Download size={13} aria-hidden="true" /> Download signed PDF
                </button>
              )}
              {doc.status === 'EXECUTED' && (
                <EmailMeACopyButton documentId={doc.id} sentAt={doc.executed_email_sent_at} />
              )}
            </div>
          ) : isContractDoc ? (
            <Link to={`/app/contracts/${doc.id}`} state={fromHere(location)}
              className="btn-outline-gold inline-flex items-center mt-3 text-sm">
              Open to review &amp; sign →
            </Link>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={inputId} className="block text-xs text-muted mb-1">
                  Type your full legal name to sign
                </label>
                <input id={inputId} className="…" value={typedName} autoComplete="off"
                  onChange={(e) => setTypedName(e.target.value)} />
              </div>
              <button type="button" className="btn-outline-gold" disabled={!trimmed || pending} onClick={sign}>
                {pending ? 'Signing…' : 'Sign'}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-700 mt-2">
              Could not sign: {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* lines 381-472 — the list around it */
      {loadError && (
        <div role="alert" …>
          <p …>Your documents could not be loaded.</p>
          <p …>{loadError}</p>
          <button type="button" className="btn-secondary mt-3 text-xs" …>Try again</button>
        </div>
      )}

      {!loading && signables.length > 0 && (
        <section aria-labelledby="self-sign-heading" className="mb-10" data-testid="self-sign-section">
          <h2 id="self-sign-heading" className="font-serif text-lg text-green-900 mb-3">
            {awaiting.length > 0 ? 'Contracts awaiting your signature' : 'Contracts you’ve signed'}
          </h2>
          …{[...awaiting, ...sealed].map((item) => <SelfSignRow … />)}
        </section>
      )}

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : pendingRows.length === 0 && executedRows.length === 0 ? (
        // Never claim "no documents" when the read failed — that is the exact
        // false negative this task was reported as.
        signables.length === 0 && !loadError && (
          <p …>No documents yet. They'll appear here as they're assigned or signed.</p>
        )
      ) : (
        … pendingRows:  <p className="text-xs text-gold-900 mt-1">Awaiting your signature — you'll be prompted at sign-in.</p>
        … executedRows: <Check /> Signed{` · <date>`}
                        <History /> Superseded — kept as a record; a newer version is in force.
      )}
```

Full visible-copy list for the surface: `Documents` (eyebrow) ·
`Everything you've agreed to, all in one place.` ·
`Your documents could not be loaded.` · `Try again` ·
`Contracts awaiting your signature` / `Contracts you’ve signed` ·
`You sign as <role>.` · `You've signed this document.` ·
`Download signed PDF` · `Open to review & sign →` ·
`Type your full legal name to sign` · `Sign` / `Signing…` ·
`Could not sign: <error>` · `Loading…` ·
`No documents yet. They'll appear here as they're assigned or signed.` ·
`Awaiting your signature — you'll be prompted at sign-in.` ·
`Signed · <date>` · `Superseded — kept as a record; a newer version is in force.`

---

## 32. `task/roster` — `RosterRow` / `RosterHeader`
- reported by: `docs/reports/TASK-ROSTERCARD-REPORT.md` [INV batch2.md#44], line 191-192: *"Its `RosterRow`/`RosterHeader` positional-row presentation was **not** ported and **not** merged; `task/roster` itself is untouched."*
- reachability: **verified unreachable — and the branch no longer exists.**
  - `git branch -a | grep -i roster` → **no branch named `task/roster`**, local or remote. `git for-each-ref | grep -i roster` returns only two **tags**: `archive/roster-rows-2026-08-10` → `cd665cd` and `archive/rostercard-2026-08-11` → `7011e9c`. The work was preserved as a tag; the branch label was removed (no commit deleted it — a branch ref deletion leaves no commit).
  - `git merge-base --is-ancestor cd665cd main` → **NOT in main.** So the code is unmerged and unreachable from any working branch; only the tag holds it.
  - There is no `RosterRow.tsx` / `RosterHeader.tsx` file anywhere, at the tag or on main — the two components live **inside** `src/pages/app/Admin.tsx` at `cd665cd:src/pages/app/Admin.tsx:124` and `:157`, used at `:746` and `:749`. On main that file has no such exports; what shipped instead is `src/components/app/RosterCard.tsx` (the ROSTERCARD supersession, per the owner's 2026-08-10 reversal).
  - `cd665cd` touched 10 files (+566/−59), including `supabase/migrations/20260810T1600_roster_one_people_page.sql` — that migration IS on main (it was applied to prod separately); only the row presentation was held back.
- exists: **branch `task/roster` deleted; commit preserved at tag `archive/roster-rows-2026-08-10` (`cd665cd998085d36d02db06c8a4a28bd0ffb8c1f`, 2026-08-10 21:02:30 -0700, "feat(roster): the Clients page is THE one people page — rows read by shape").**
- content — `git show cd665cd:src/pages/app/Admin.tsx`, lines 95-222:

```tsx
// gap holding its place — never a collapsed one. Segment tints group the band
// into rider | horse care | acquisition zones the eye can read at a distance.
const SEGMENT_TINT: Record<string, string> = {
  rider: 'bg-green-800/[0.04]',
  horse: 'bg-gold-600/[0.07]',
  acquisition: 'bg-cream-100/60',
};

/** Display transform only (NOT a catalog): drop the redundant "Horse " prefix
 *  so band headers stay short. Slot identity remains the DB code. */
const slotLabel = (s: ServiceSlot) => s.display_name.replace(/^Horse\s+/, '');

/** Shared column template: person | docs | orders | credits | band… | status.
 *  Derived from the slot count so a new catalog service grows the grid. */
function rosterGrid(slotCount: number): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns:
      `minmax(230px,1fr) 3rem 3rem 8.5rem repeat(${slotCount}, 3.5rem) 6.5rem`,
    alignItems: 'center',
    minWidth: `${230 + 328 + slotCount * 56}px`,
  };
}

function segmentEdge(slots: ServiceSlot[], i: number): string {
  return i > 0 && slots[i - 1].segment !== slots[i].segment
    ? 'border-l border-green-800/15' : '';
}

export function RosterHeader({ slots, hasOther }: { slots: ServiceSlot[]; hasOther: boolean }) {
  return (
    <div style={rosterGrid(slots.length + (hasOther ? 1 : 0))}
      className="px-4 pb-1 text-[9px] font-sans uppercase tracking-wide text-muted select-none">
      <span />
      <span className="text-center">Docs</span>
      <span className="text-center">Orders</span>
      <span className="pl-2">Credits</span>
      {slots.map((s, i) => (
        <span key={s.code} title={s.display_name}
          className={`text-center leading-tight self-end px-0.5 min-w-0 ${SEGMENT_TINT[s.segment] ?? ''} ${segmentEdge(slots, i)}`}>
          <span className="block break-words">{slotLabel(s)}</span>
        </span>
      ))}
      {hasOther && <span className="text-center">Other</span>}
      <span />
    </div>
  );
}

/** One band cell: the count when the slot is filled, a faint placeholder dot
 *  when not. The cell itself always renders — that is the whole point. */
function SlotCell({ n, tint, edge }: { n: number | undefined; tint: string; edge: string }) {
  return (
    <span className={`self-stretch flex items-center justify-center text-sm ${tint} ${edge} ${
      n ? 'text-green-900 font-medium' : 'text-green-800/20'}`}>
      {n ?? '·'}
    </span>
  );
}

/** One roster row. Every cell sits on the shared grid — person, then the fixed
 *  count columns, then the band, then status. Blank beats zero everywhere. */
export function RosterRow({ m, slots, hasOther, otherCount, onOpen }: {
  m: ClientAccountRow; slots: ServiceSlot[]; hasOther: boolean;
  otherCount: (m: ClientAccountRow) => number; onOpen: (key: string) => void;
}) {
  return (
    <button type="button" onClick={() => onOpen(rowKeyOf(m))}
      style={rosterGrid(slots.length + (hasOther ? 1 : 0))}
      className="w-full bg-white border border-green-800/10 rounded-lg px-4 text-left hover:border-green-800/30 focus-ring overflow-hidden">
      {/* person */}
      <span className="min-w-0 flex items-center gap-3 py-2.5">
        <span className="w-9 h-9 rounded-full bg-green-800 text-white grid place-items-center text-[12px] font-sans shrink-0">
          {memberInitials(m)}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-green-900 truncate">{memberName(m)}</span>
          <span className="block text-xs text-muted truncate">{m.email}</span>
          {(m.tags ?? []).length > 0 && (
            <span className="flex flex-wrap gap-1 mt-0.5">
              {(m.tags ?? []).map((t) => (
                <span key={t} className="text-[9px] font-sans uppercase tracking-wide px-1.5 py-px rounded-full bg-green-50 text-green-800 border border-green-200">{t}</span>
              ))}
            </span>
          )}
        </span>
      </span>
      {/* docs · orders — a zero is noise, so blank when empty */}
      <span className="text-center text-sm text-green-900">{m.document_count > 0 ? m.document_count : ''}</span>
      <span className="text-center text-sm text-green-900">{m.order_count > 0 ? m.order_count : ''}</span>
      {/* credits, each with the name it applies to */}
      <span className="min-w-0 pl-2 pr-1">
        {(m.credits ?? []).map((c) => (
          <span key={c.label} title={`${c.remaining} × ${c.label}`}
            className="block text-[11px] text-green-900 truncate leading-snug">
            {c.remaining} × {c.label}
          </span>
        ))}
      </span>
      {/* THE BAND — fixed slot per service type; empty slots hold position */}
      {slots.map((s, i) => (
        <SlotCell key={s.code} n={m.services?.[s.code]}
          tint={SEGMENT_TINT[s.segment] ?? ''} edge={segmentEdge(slots, i)} />
      ))}
      {hasOther && <SlotCell n={otherCount(m) || undefined} tint="" edge="border-l border-green-800/15" />}
      {/* status */}
      <span className="text-right py-2.5">
        {m.kind === 'account' ? (
          <span className={`block text-[10.5px] font-sans uppercase ${m.member_status === 'active' ? 'text-green-700' : 'text-muted'}`}>
            {m.member_status === 'active' ? 'Active' : 'Inactive'}
            {m.is_suspended ? ' · suspended' : ''}
          </span>
        ) : (
          <span className={`block text-[10.5px] font-sans uppercase ${
            m.invite_status === 'sent' ? 'text-gold-800' : 'text-muted'
          }`}>
            {m.invite_status === 'sent'
              ? (m.invite_expires_at && new Date(m.invite_expires_at) < new Date() ? 'Invite expired' : 'Invited')
              : m.invite_status === 'accepted' ? 'Claimed'
              : m.kind === 'contact' ? 'No account' : 'Not invited'}
          </span>
        )}
        <span className="block text-[11px] text-muted">
          {m.kind === 'account' ? 'joined' : m.kind === 'pending' ? 'created' : 'added'} {fmt(m.created_at)}
        </span>
      </span>
    </button>
  );
}
```

---

*End of Part 3. Nothing was modified; all DB access was SELECT-only.*
