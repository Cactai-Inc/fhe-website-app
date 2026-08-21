# TASK-NOSTRIP — narrowing a category must never destroy required paperwork

**Branch `task/nostrip`, worktree `~/Downloads/claude-code-repo/wt-nostrip`.
Committed, NOT pushed. NOTHING IS APPLIED TO PRODUCTION** — the migration was
dry-run inside `BEGIN … ROLLBACK` and the rollback proven; WALK2/WALK3 are
driving prod and `apply_category_documents` is exactly what WALK3 observes when
a counterparty activates, so the apply step is held pending the go-ahead.
**Render claims: NOT VERIFIED** (no browser was driven).

---

## 1. The answer to §2's question, first, because it decides the shape

**`my_wall_state()` DELEGATES. Skipping alone DOES release the person. The two
wall functions need no reconciliation, and nothing about the wall was touched.**

The task flagged that `my_wall_state` does not reference `skipped_at` while
`contact_document_wall_state` does. Read against the live bodies
(`pg_get_functiondef`, prod, 2026-08-21) that is true and harmless — the whole of
`my_wall_state`'s counting is one line:

```
v_state := contact_document_wall_state(v_contact);
```

It computes nothing itself. It calls the skip-aware function, then decides
`wall` / `staff_banner` from the `gating` count that comes back. So the skip
filter CLOSEOUT §1.6 put in `contact_document_wall_state` is already the filter
the member's session gates on.

Proven twice rather than read off the SQL:

* **PGlite** (test 2) drives `my_wall_state()` itself as the member: pending
  drops by exactly the number of skipped documents, and
  `required_templates_for_contact` stops offering them.
* **Prod dry-run**, immediately after narrowing a mixed-cart contact to Rider:
  ```
  {"gating": 4, "titles": ["Company Policies", "Facility Rules and Safety
   Acknowledgment", "Human Emergency Medical Authorization v2",
   "Participant Liability Release"], "pending": 4}
  ```
  Six requirements, two skipped, four gating. The two horse documents are gone
  from the wall and from the titles the member is shown.

**Consequence for this task:** skipping is sufficient, so the fix is complete as
built. No wall change was made, attempted, or needed.

---

## 2. What was destroying the record

One statement, four lines, five callers, no guard:

```sql
DELETE FROM contact_required_documents crd
 WHERE crd.contact_id = p_contact_id
   AND crd.template_key NOT IN (SELECT template_key FROM _wanted);
```

The only protection was rule 1a — an EMPTY category list deletes nothing. **A
non-empty narrower set deleted freely**, including a requirement whose document
was already EXECUTED, from all five call sites:

| caller | what it is | could it strip? |
|---|---|---|
| `_ensure_client_account` | provisioning / adoption-by-email | yes |
| `provision_client_invitation` | the staff invitation | yes |
| `promote_buyer_from_offering` | **a TRIGGER on `purchase_items`** | yes |
| `redeem_contract_invitation` | counterparty claiming a contract | defended by PARTYROLE's explicit `'{}'` |
| `request_onboarding_categories` | reads only | n/a |

The trigger is the one worth naming. It fires when somebody **buys a lesson**,
recomputes their affiliations, and passes those to `apply_category_documents`. A
boarder whose horse paperwork is assigned but not yet executed holds no
`HORSE_OWNER` group — so buying a lesson passed `['RIDER']` and stripped the
horse requirements. No human was involved in that path at all.

---

## 3. What was built

### One migration — `20260821T1400_nostrip_narrowing_skips_and_never_destroys.sql`

**§2 — `apply_category_documents` is now purely ADDITIVE.** The four lines are
gone. Assigning categories adds what those categories require and removes
nothing, from every one of its five callers. Rule 1a is kept verbatim. A
requirement already in the wanted set that is SKIPPED stays skipped — re-ticking
a category, or buying another lesson, must not silently undo a deliberate staff
decision.

**§2 — removal moved to one door that has to be asked for by name.**
`narrow_contact_required_documents(contact, keep_template_keys, reason)`:
refuses without a reason, refuses executed evidence, **skips rather than
deletes**, writes the audit row.

**§2 / D18 — there is ONE skipping body.** CLOSEOUT §1.6's `skip_required_document`
was split into `_skip_required_document` (the body) and `skip_required_document`
(its authorised front door, guards unchanged). The narrowing path calls the same
body once per template. No second skipping path was written, and
`unskip_required_document` — which already existed — is the only undo.

**§1 — executed paperwork is never removed by ANY path.** Guarded in
`narrow_contact_required_documents`, in `set_contact_required_documents` (the
Paperwork editor's uncheck-and-save, which would previously have deleted it), and
already in `_skip_required_document`. The refusal names the document:

```
cannot remove RELEASE_HORSE_CARE: satisfied by an executed document. Executed
paperwork is the evidence that the obligation existed and was met, and is never
removed — uncheck the rest, or leave this one on the record.
```

It refuses **outright**: the other, removable candidate is not half-skipped
either, so a half-applied narrowing cannot exist.

**§3 — it is recorded.** Every narrowing writes an `audit_logs` row naming the
contact, the kept and skipped templates, the actor and the reason, beside the
per-template rows the skipping body writes. The editor's uncheck-and-save now
also writes a row (actor + names; it carries no reason because it is a checkbox,
not a narrowing, and it says so). `lesson_credits` and `bookings` are already
absent from `audit_logs` (W10) — this did not become a third silent table.

### §4 — the staff surface says it before doing it

**`ProvisionClientForm.tsx`.** The mitigation CATEGORISE shipped explained where
the prefill came from; it did not gate. This replaces it. The form now loads what
the person **already owes** (`contact_required_documents_state`) and, whenever
the ticked categories do not cover all of it, shows a panel naming every such
document. The default is that they are **kept**. Removing them is a separate,
explicitly ticked act with a **required** reason; the submit button is disabled
until the reason is given. Documents already signed are listed as
*"already signed, stays on the record"* and are never offered for removal.

The narrowing call runs **first and alone**, before the invitation: if the
database refuses, nothing else has happened, so there is no half-narrowed record
and no invitation promising a set that was never applied.

**`ClientRecordActions.tsx` (PaperworkEditor).** This is where a skip is seen and
undone, and it already rendered *who / when / why* plus a **Restore** link. Three
repairs: the checkbox for a signed requirement is now disabled and labelled
*"Signed — kept as evidence, and cannot be removed or skipped"*; a blank skip
reason is refused in the browser as well as the database; and the three empty
`catch {}` blocks that made a refusal indistinguishable from a save now surface
the message and reload the true state.

### §5 — the derived path is still additive, re-proven

CATEGORISE's union in `request_onboarding_categories` is untouched. It is now
belt-and-braces rather than the only thing standing between a checkbox and a
destroyed legal record. Re-proven at the function that used to do the damage: a
contact holding the six-document mixed set, put through
`apply_category_documents(contact, ['RIDER'])`, comes out holding **six**.

**D28 respected.** `category_document_requirements` was read, reproduced in the
test fixture exactly as production holds it, and **not modified**.

---

## 4. §5's nine tests

`test/db/nostrip_narrowing_never_destroys.test.ts` — **19 tests, all passing.**

> The 2026-08-03 schema snapshot predates both WALLSYNC (2026-08-07) and CLOSEOUT
> §1.6 (2026-08-19), so the test applies those two migrations and then the one
> under test on top of the snapshot — the pattern `uploads_files_spine.test.ts`
> established. The snapshot itself is not modified.

| # | test | result |
|---|---|---|
| 1 | CATEGORISE case reproduced: 6 docs, narrow to Rider → **all 6 rows still exist**, 2 skipped with reason + actor | PASS |
| 2 | the person is not blocked — `my_wall_state()` pending drops by exactly 2; they are not asked either | PASS |
| 3 | `unskip_required_document` restores it, and it blocks again — round trip | PASS |
| 4 | executed requirement refused on **three** paths (narrow, editor save, direct skip), record intact | PASS |
| 5 | `audit_logs` row naming templates, actor and reason + per-template skip rows | PASS |
| 6 | narrowing with `null` / `''` / `'   '` refused, nothing changed | PASS |
| 7 | derived path cannot strip; rule 1a kept; still ADDS; re-ticking does not undo a skip; the four lines are gone from the body | PASS |
| 8 | the migration runs no DML at all (comments and function bodies stripped before asserting) | PASS |
| 9 | `typecheck` / lint / `test/db` | see below |

Plus two authority tests: a member cannot narrow their own paperwork; anon cannot
reach the function.

### §5.9

* **`npm run typecheck` — 0 errors.** `typecheck:api` — 0 errors.
* **lint — identical to main:** 0 errors, 46 warnings, both checkouts.
* **`test/db` — diffed file-for-file against the main baseline: IDENTICAL.**
  46 red files before, 46 red files after, same failure counts per file (`diff`
  of the two per-file verdict lists is empty). Totals move only by this task's
  own additions: `46 failed | 26 passed (72)` → `46 failed | 27 passed (73)`,
  `203 failed | 479 passed` → `203 failed | 497 passed`. **The 203 failures are
  unchanged.**
* `test/ui` — the same 3 failures on main and on this branch
  (`pluspass_create_controls`, `wallreturn_onboarding` ×2). A 4th file,
  `clause_ownership_affordance`, needs `dist/assets` and is red in any fresh
  worktree; unrelated.

### §5.8 — the 23 live rows

Proven on production inside the dry-run transaction, before rollback:

```
BEFORE            23 rows   fingerprint c4d04549b711476d069e4b7a6894053d
AFTER THE DDL     23 rows   fingerprint c4d04549b711476d069e4b7a6894053d
AFTER ROLLBACK    23 rows   fingerprint c4d04549b711476d069e4b7a6894053d
```

---

## 5. The dry-run, and the proof the rollback worked

`psql -f`, one transaction, `lock_timeout 5s` / `statement_timeout 60s` so it
could not block WALK2/WALK3. Every §5 proof was run against the **live prod
schema** inside it, on a throwaway contact created and rolled back with it.

Selected output:

```
--- TEST 7 --- apply_category_documents(RIDER) on a mixed holder
still_held: COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET,
            HUMAN_EMERGENCY_MEDICAL, RELEASE_HORSE_CARE, RELEASE_PARTICIPANT

--- TEST 6 --- REFUSED as required -> a reason is required to remove required
               paperwork from someone's record

--- TEST 1 --- {"skipped": ["HORSE_EMERGENCY_VET", "RELEASE_HORSE_CARE"]}
 HORSE_EMERGENCY_VET | t | b45a5503-… | Phone call: they board elsewhere, lessons only
 RELEASE_HORSE_CARE  | t | b45a5503-… | Phone call: they board elsewhere, lessons only
 (four Rider rows, skipped = f)

--- TEST 4 --- narrow REFUSED      -> cannot remove RELEASE_HORSE_CARE: satisfied …
               editor save REFUSED -> cannot remove RELEASE_HORSE_CARE: satisfied …
 rows_survived_both_refusals: all six
```

**Rollback proven — production is exactly as it was:**

```
crd_rows              23   fingerprint c4d04549b711476d069e4b7a6894053d  (unchanged)
narrow_exists_after   NULL          (the new function is NOT on prod)
strip_present_after   t             (the old body is still live)
dryrun_contacts_left  0
dryrun_audit_rows_left 0
```

> One probe in the dry-run script is misleading and is called out rather than
> quietly dropped: `strip_present_inside` reported `t`. It greps the function
> definition for the literal `DELETE FROM contact_required_documents`, and the
> new body **quotes the removed statement in a comment** so the next reader knows
> what left and why. The behavioural proof above (six rows survive
> `apply_category_documents(['RIDER'])`) is the real one. A comment-stripping
> version of the same assertion is in the test file and passes.

---

## 6. THE REACH — where staff narrow, and where they see and undo a skip

| surface | route | what it now does |
|---|---|---|
| **Provision / Convert / Invite** (`ProvisionClientForm`, rendered by the New client, client-detail and Inbound-convert flows) | `/app/ops/clients/new`, client detail, `/app/ops/intake` | names the uncovered documents before commit; keeps them by default; removal is an explicit tick + required reason; submit disabled until given |
| **Paperwork editor** (`PaperworkEditor` in `ClientRecordActions`) | client record | shows *skipped / by / when / why* with **Restore**; signed rows disabled and labelled; refusals now visible |

`apply_category_documents` is granted to `service_role` only — it is unreachable
from a browser, so the provisioning API and the purchase trigger are its whole
surface, and both are now additive. `narrow_contact_required_documents` is
granted to `authenticated` behind `has_staff_access()` + org check.

## 7. THE TELL

**Before:** ticking Rider on someone who owed six documents left them owing four,
with no row, no reason, no actor and no undo.

**After, staff see:** *"They already owe paperwork this selection doesn't
cover"*, with the documents listed by title, *"These stay on their record unless
you say otherwise"*, and — if they insist — a reason box that must be filled.
Afterwards, on the client record: *"Skipped 21/08/2026 by CJ — Phone call: they
board elsewhere, lessons only · not signed, no longer blocking · **Restore**"*.

**After, the client sees:** the two horse documents disappear from their
onboarding list and from the wall — a document they no longer owe stops being
demanded of them — while remaining on the staff-side record as a skipped
requirement, never as a signed one.

---

## 8. FLAGGED, NOT FIXED

1. **A deliberate behaviour change, declared rather than hidden.**
   `skip_required_document` now REQUIRES a reason; CLOSEOUT §1.6 accepted a blank
   one and wrote NULL. §2 asks for the reason to be required, and having two
   different rules for the same mark would be worse than either. The one caller
   (PaperworkEditor) already prompted for a reason and now enforces it.

2. **`promote_contact_to_account` loses skip marks on a merge.** It moves the
   dissolved contact's requirements to the survivor only where the survivor does
   not already hold that `template_key`, then deletes the rest. If the dissolved
   row was skipped and the survivor's was not, the survivor's unskipped row wins
   and the skip silently disappears. Not a strip — the requirement survives — and
   out of this task's scope, but it is the same class.

3. **`purge_account` still deletes requirement rows.** D1 test-identity purge
   only, and D11 has since ruled that nothing is purged. Untouched.

4. **`set_contact_required_documents` is granted EXECUTE to `anon`.**
   `has_staff_access()` returns false for anon so it is refused at runtime, but a
   writing SECURITY DEFINER function carrying an anon grant is the class SECFIX /
   SECFIX2 have been revoking. **Deliberately not changed here** — altering
   grants while WALK2/WALK3 drive production is exactly the unattributable change
   the hold exists to prevent.

5. **`staff_assign_documents` clears a skip with no audit row.** CLOSEOUT ruled
   the clearing correct ("assigning something you skipped is the explicit way of
   saying you want it back"), but `unskip_required_document` audits the same
   transition and this one does not. Asymmetry, not a defect.

6. **`provision_client_invitation` records a NULL actor on its notification.**
   Line ~291 uses `auth.uid()`, and the API calls the RPC as `service_role` where
   that is NULL. Pre-existing and unrelated; noticed while tracing the actor for
   the skip mark, which is why the narrowing door is called from the browser as
   the staff user instead of being threaded through the service-role chain.

7. **`test/db/fixtures/schema_snapshot.sql` is 18 days stale** (2026-08-03). It
   is why 46 files are red, and why this task's test has to apply two migrations
   by hand before the one under test. Standing debt, named again.

---

## 9. TEARDOWN — process census

```
$ ps -Ao pid,etime,pcpu,rss,comm | grep -Ei 'vitest|node|esbuild|psql|vite'
 1502  00:07  0.9  130432  node
 1511  00:06  5.4  130352  node
```

Two short-lived `node` processes, both from the vitest run in flight at the time
of the census; no vitest pool, esbuild server, vite dev server or `psql` session
left behind. Every `vitest` run in this thread used `--maxWorkers=2`. Every
`psql` invocation was `-f` or `-c` and exited. One background run was started
with a bad flag, and one with the migration still in the tree; both were killed
(`pkill -f "vitest run test/db"`) rather than left to finish.

**Worktree note:** `wt-nostrip/node_modules` is a **symlink** to the main
checkout's (`package.json` verified byte-identical to `main` first), and `.env`
/ `.env.test` / `.env.db` were copied in so the suites could run. All four are
gitignored and none is committed.
