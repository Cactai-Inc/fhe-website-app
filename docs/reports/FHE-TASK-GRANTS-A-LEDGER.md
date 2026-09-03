# FHE-TASK-GRANTS-A — LEDGER (TASK thread, DSNR profile)

**Spec:** `docs/tasks/TASK-GRANTS-A-author-the-acl-sweep-spec.md` (on `bundle/grants`, read from `wt-1`).
**Bundle:** `docs/orch/BUNDLE-GRANTS.md`. **Dispatched by / hand back to:** `FHE-MGMT-GRANTS`.
**Opened 2026-09-03 · tree `wt-2` · branch `task/grants-a-spec` from `origin/main` @ 2779ca2c.**

## RESUME
Role / thread   FHE-TASK-GRANTS-A · wt-2 · task/grants-a-spec (DSNR profile: specs only, no build, no GRANT/REVOKE run)
Merge-base      2779ca2c (origin/main at 07:02 PDT 2026-09-03; bundle/grants is d5f97724, ahead of main by 3 — the bundle files are NOT on main)
DONE            worktree guard (detached + porcelain empty) → claimed task/grants-a-spec → clean; psql to production proven
IN FLIGHT       ledger opened; CLNR pass next
NEXT            CLNR §3 census → re-run the MGMT population query → the writer sweep over all 326
DECIDED         —
BLOCKED         nothing
DO NOT          do not run any GRANT/REVOKE; do not call any function (probing a writer writes production — `has_function_privilege` is the probe); do not touch bodies (B2 owns them)

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
