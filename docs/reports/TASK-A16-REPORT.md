# TASK A16 — admin notified when a party signs

Branch: `task/a16-sign-notifications` · Worktree: `wt-a16` (off `origin/main` @ `5b5b5cd`)
Date: 2026-08-04

## Scope delivered

One migration (`record_signature` `CREATE OR REPLACE`), no other writes. No UI
changes. `ClauseDocument.tsx` untouched. No documents deleted.

## 1. Characterize first (read-only, done before writing anything)

Dumped live `prosrc` for every function in the signing path:

- **`record_signature`** — already contained ONE `notify_staff` call, but only
  inside the *completing*-signature branch (`v_need > 0 AND v_have >=
  v_need`): kind `document_executed`, title `'<title> is signed'`, link
  `/app/ops/documents` (no document id). This is a genuine, previously
  undocumented finding — the task doc's "Known context" only mentions the
  execution *email* as separate/done and doesn't mention this in-app staff
  broadcast. **There was no notification of any kind for a partial
  (non-completing) signature.** The tracker's "NOT VERIFIED" was correct: the
  gap A16 describes is real, just narrower than a blank slate.
- **`remove_my_signature`** — the shape being mirrored per the task doc:
  direct `PERFORM notify_staff(org,'signature_removed',...)`, un-isolated
  (no `BEGIN/EXCEPTION`).
- **`lock_and_sign_contract`** — thin wrapper, delegates straight to
  `record_signature`. No independent notification logic.
- **`sign_release`** (kiosk) — does not call `record_signature` at all; fully
  separate inline path. Grepped for any notify/status_events mechanism
  around kiosk signing (`grep -rn "sign_release\|VISITOR_RELEASE"` across
  `src/`, `api/`, and the trigger set on `documents`/`clients`) — **zero
  precedent** of any kind. No staff notification exists for kiosk releases
  today, via any mechanism.
- **`documents_send_executed_email`** (trigger on `documents.status`) — the
  only existing example in the codebase of a notification-class side effect
  being deliberately isolated from the write it accompanies:
  ```sql
  BEGIN
    PERFORM send_executed_document_email(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE documents SET executed_email_error = SQLERRM WHERE id = NEW.id;
  END;
  ```
  This is the precedent the new `party_signed` call's `BEGIN/EXCEPTION WHEN
  OTHERS` isolation mirrors (record_signature has no error-tracking column
  for it, so a `RAISE WARNING` stands in for the `UPDATE ... _error` column
  the email trigger uses).
- `notifications.kind` has no CHECK constraint (free text) — `party_signed`
  needed no schema change. Grepped the frontend for any `kind`-specific
  branching (`DashboardPanel.tsx`, `IntakePage.tsx`, `AppLayout.tsx`,
  `ClientRecordActions.tsx`, `AccountHub.tsx`, `Onboarding.tsx`): the only
  kind ever special-cased is `member_hi`; every other kind (including
  `document_executed`) is rendered generically. Confirmed safe to fold the
  old staff-only `document_executed` call into the new one without a UI
  regression.

## 2. Judgment call — folding the pre-existing staff broadcast (flagged for the orchestrator)

The task doc's spec, written without knowledge of the pre-existing staff
`document_executed` call, says the completing signature should "still
notify... so **one** notification carries both facts, not two rows." Taken
literally alongside "live body carried forward unchanged otherwise," these
two instructions conflict once the pre-existing call is accounted for:
firing the new `party_signed` call on the completing signature *in addition
to* the old untouched `document_executed` staff call would produce **two**
staff rows for the same event — the exact outcache the spec says to avoid.

**Decision**: removed the old staff-only `PERFORM notify_staff(v_doc_org,
'document_executed', v_title || ' is signed', '/app/ops/documents')` line
(3 lines) and folded its intent into the new unified `party_signed` call,
which now carries the same information plus the signer's name/role and a
document-specific link. Nothing else in that block changed — the
`resolve_notifications_for_link` call, the hash computation, and the
**other-parties** notification loop (co-signers, kind `document_executed`,
a different feature entirely — informs fellow signers, not staff) are
byte-identical to the live body. Verified via `grep` that no frontend code
branches on `kind='document_executed'` specifically (§1), so this is a safe
consolidation, not a silent behavior change anyone depends on.

If the orchestrator would rather the old call be left untouched (accepting
two staff rows on completion), that's a one-line revert — flagging here
rather than assuming.

## 3. Migration — `supabase/migrations/20260805030000_party_signed_notifications.sql`

`CREATE OR REPLACE FUNCTION record_signature(...)`, live body carried forward
verbatim except:

1. New `v_is_company_signer boolean := false` DECLARE; set `true` inside the
   pre-existing company-side-signing branch (same spot that already
   re-resolves `v_signer` to the company contact) — no new logic needed to
   detect company-side, just latching the pre-existing branch's own
   knowledge into a flag.
2. The old staff-only `document_executed` `PERFORM` removed (§2).
3. New block after the existing completing-signature `IF` closes:
   ```sql
   IF NOT v_is_company_signer THEN
     BEGIN
       SELECT coalesce(d.title, 'A document') INTO v_title FROM documents d WHERE d.id = p_document_id;
       IF v_need > 0 AND v_have >= v_need THEN
         PERFORM notify_staff(v_doc_org, 'party_signed',
           v_title || ' — fully executed; signed by ' || p_typed_name || ' (' || p_party_role || ')',
           '/app/ops/documents/' || p_document_id::text);
       ELSE
         PERFORM notify_staff(v_doc_org, 'party_signed',
           v_title || ' — signed by ' || p_typed_name || ' (' || p_party_role || ')',
           '/app/ops/documents/' || p_document_id::text);
       END IF;
     EXCEPTION WHEN OTHERS THEN
       RAISE WARNING 'record_signature: party_signed notify_staff failed for document %: %', p_document_id, SQLERRM;
     END;
   END IF;
   ```
   Company-side signers never notify, regardless of whether their signature
   happens to complete the document (exclusion takes precedence over the
   completing-title branch, per the task doc's ordering). The `BEGIN/
   EXCEPTION` means a `notify_staff` failure can raise a warning but can
   never abort or roll back the transaction — the signature that already
   sealed above stays sealed either way.

### Dry-run, then apply

```sql
BEGIN;
\i supabase/migrations/20260805030000_party_signed_notifications.sql
-- full 3-scenario proof (see §4) run here first
ROLLBACK;
```
→ `CREATE FUNCTION` succeeded; the full proof scenario below was run inside
this same rolled-back transaction first and produced identical results to
the post-apply run; `ROLLBACK` — nothing persisted (`notifications` count
27 → 27).

**Applied for real**: `psql -v ON_ERROR_STOP=1 -f
supabase/migrations/20260805030000_party_signed_notifications.sql` — no
errors. Confirmed live: `prosrc LIKE '%party_signed%'` on `record_signature`
→ `true`.

## 4. Live proofs (raw psql against production, all simulated sessions rolled back)

Simulation technique (same as `TASK-DOCVIS`): `SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<user_id>"}'` inside
`BEGIN;…ROLLBACK;`. Fixtures used real production rows (two admin staff
profiles in the sole org `e656f20b-…`; individual contacts Madeline Do, CJ
Z, Mary Richardson, each with a linked profile; company contact "French
Heritage Equestrian", `is_company=true`), created via `start_lease_contract_v2`
+ `record_signature` directly (bypassing `lock_and_sign_contract`'s
field-completeness gate, since `record_signature` itself is the function
under test and doesn't require the document be otherwise lockable).

Re-ran **identically** post-apply (all counts below are from the real,
post-apply proof run, wrapped in its own `BEGIN;…ROLLBACK;`):

**Baseline**: `notifications` count 27, `party_signed` count 0.

**DOC1 — two individual (non-company) parties, LESSEE then LESSOR**:

- LESSEE (Madeline Do) signs first — **partial**, non-completing:
  ```
  kind          | title                                                    | link                                        | user_id
  party_signed  | Horse Lease Agreement — signed by Madeline Do (LESSEE)   | /app/ops/documents/<doc1-id>               | admin-1
  party_signed  | Horse Lease Agreement — signed by Madeline Do (LESSEE)   | /app/ops/documents/<doc1-id>               | admin-2
  ```
  2 rows, exact title/link match, one per admin staff profile.
- LESSOR (CJ Z) signs second — **completing**:
  ```
  party_signed  | Horse Lease Agreement — fully executed; signed by CJ Z (LESSOR) | /app/ops/documents/<doc1-id> | admin-1
  party_signed  | Horse Lease Agreement — fully executed; signed by CJ Z (LESSOR) | /app/ops/documents/<doc1-id> | admin-2
  ```
  2 more rows (total 4), single row per admin for this event, exact
  "fully executed" title. **Zero** new `document_executed` rows for
  staff recipients (`staff_document_executed_new` = 0) — confirms the fold-in
  produced no duplicate. The untouched other-parties loop still fired
  exactly once, for the LESSEE (Madeline) as co-signer
  (`cosigner_document_executed` = 1) — proving that feature is unaffected.

**DOC2 — company-side exclusion, LESSEE then company LESSOR**:

- `party_signed_before_doc2` = 4 (carried from DOC1).
- Mary Richardson (individual LESSEE) signs — partial: count → 6 (+2, one
  per admin) — confirms individual partial signing still notifies on an
  unrelated document.
- Staff signs the LESSOR role on behalf of the company contact ("French
  Heritage Equestrian", `is_company=true`) — **completing** this document:
  `party_signed_after_company_sign` = 6, **unchanged**. Company-side
  exclusion held even though this was the completing signature — proves
  the exclusion takes precedence over the "still notify on completion" rule,
  as the task doc's ordering specifies.

**Residue check**: `ROLLBACK` → `notifications` count back to 27,
`party_signed` count back to 0. Zero residue.

## 5. Kiosk path (`sign_release`) — question for the orchestrator, not built

No existing precedent anywhere (DB triggers, RPC bodies, or the
`api/sign-release.ts` handler) shows kiosk signings alerting staff via any
mechanism. Per the task doc's own instruction ("If unclear, do NOT add it;
note the question... A16's tracker text is about contract parties, not
kiosk"), nothing was added to `sign_release`. Open question: should a kiosk
release/waiver signing raise the same `party_signed`-style staff alert? It
currently raises none at all (not even on completion — kiosk documents are
single-signer, so there is no multi-party "completing" concept, and no
`notify_staff` call exists in that function today).

## 6. `docs/archive/BUILD_TRACKER.md`

A16 changed from **NOT VERIFIED** to **DONE**, describing the characterization
finding (a completing-only staff broadcast already existed), the fix (one
unified `party_signed` call on every signature, non-company only, folding the
old completing-only call into it), and the live proofs above. The kiosk
open question (§5) is noted inline rather than silently resolved either way.

## 7. Done-checks

- `npm install` (fresh worktree, no shared `node_modules`).
- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — **0 errors, 29 warnings**, matching the documented
  baseline exactly; this task touched no `.ts`/`.tsx` files, only SQL and
  docs.
- Live proofs: §4, all reproduced above, run twice (dry-run + post-apply)
  with identical results.

## 8. Production writes (everything logged)

1. The one migration, `20260805030000_party_signed_notifications.sql` —
   dry-run in `BEGIN;…ROLLBACK;` (full proof scenario included), then
   applied live via `psql -v ON_ERROR_STOP=1 -f …` (§3).

Everything else against production was either read-only (`pg_get_functiondef`,
`\df+`, `SELECT`) or ran inside `BEGIN;…ROLLBACK;` blocks independently
re-verified to leave no residue (§4's before/after `notifications` counts).
No document was deleted, superseded, or otherwise mutated outside the rolled
back proof transactions. No UI file was touched.

## Honesty notes

- Every command output quoted above is what was actually returned by psql
  against `db.lrstswfxfsezdmvkvukc.supabase.co` — nothing is paraphrased
  from assumption.
- The pre-existing completing-only staff broadcast (§1) was not mentioned in
  the task doc's "Known context" — it's a genuine finding from this task's
  characterization pass, not something assumed or asserted without checking
  `prosrc` first.
- Folding that pre-existing call into the new one (§2) is a judgment call
  beyond the task doc's literal text (which didn't anticipate the call's
  existence) and is called out rather than silently bundled in; the
  orchestrator can revert it to a two-row-on-completion behavior with a
  one-line change if they'd prefer the old call left untouched.
- The kiosk question (§5) is left genuinely open, not resolved by omission —
  the task doc's own instruction was to ask rather than guess when
  precedent is absent either way.
