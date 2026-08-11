# TASK SENDGUARD — report

Branch `task/sendguard`, worktree `~/Downloads/claude-code-repo/wt-sendguard`, off
`origin/main` (7b9f2c6). Database `lrstswfxfsezdmvkvukc` (production).

**Applied to production: §1 and §3.** **§2 is built, dry-run, and NOT applied** — it
waits on the review the APPLY MODE section calls for.

Row counts, before this session and after everything below:

| | documents | signatures | contacts | profiles | invitations | document_parties |
|---|---|---|---|---|---|---|
| before | 81 | 62 | 34 | 11 | 46 | 127 |
| after | 81 | 62 | 34 | 11 | 46 | 127 |

---

## THE QUESTION THE TASK SAYS TO ASK — should staff be able to override the refusal?

**Recommendation: yes, eventually — but not as part of this task, and not as a
"send anyway" button.**

The legitimate case is real: a party signed the wrong version and must sign a
corrected one. It is not, however, a *sending* problem. Re-sending an invitation to
an already-signed party would land them on a document their signature is already
on, and the machinery that decides what happens to that signature — void it,
supersede the document, mint a new version — is exactly the re-sign /
template-version model with six decisions still open with the owner. A "send
anyway" button would quietly pick answers to all six.

What I would build once those decisions land: **"ask for a re-signature"**, a
distinct staff action that (1) supersedes or voids the existing signature
explicitly and leaves a record of who did it and why, and (2) *then* issues the
invitation through the ordinary path — at which point the guard shipped here sees
no live signature and lets it through with no override needed. The refusal is
keyed on `deleted_at IS NULL`, so voiding a signature is already sufficient to
unblock a re-send; I proved that in the dry-run (`invitable_once_signature_is_voided
= t`). The override does not need new bypass machinery, only a decided path to
voiding.

**Today the refusal is absolute and loud.** Nothing bypasses it. Staff who need a
corrected version signed have no path yet, and will see a clear message rather than
a silent failure.

---

## SEPARATE FINDING — a signature-destroying sweep this task did not scope

While confirming §3 was the only write of its class, I checked every function that
soft-deletes `documents`. There are exactly two, and the other one is worse:

```
public | ensure_horse_documents
public | generate_my_onboarding_documents
```

`ensure_horse_documents` sweeps with **no status filter at all**:

```sql
UPDATE documents d SET deleted_at = now(), deleted_by = auth.uid()
 WHERE d.contact_id = v_owner
   AND d.template_id = (SELECT id FROM tmpl)
   AND d.deleted_at IS NULL
   AND (d.horse_id IS NULL
        OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
```

Unlike §3's sweep this one is **not** safe by circumstance today. Two EXECUTED,
signed documents are in its blast radius right now (production, 2026-08-10):

```
   doc    |    template_key     |  status  | no_horse | unfilled_token | live_sigs
----------+---------------------+----------+----------+----------------+-----------
 152912dd | HORSE_EMERGENCY_VET | EXECUTED | t        | f              |         1
 a8623897 | RELEASE_HORSE_CARE  | EXECUTED | t        | f              |         1
```

Either one is soft-deleted, signature and all, the next time
`ensure_horse_documents` runs for that owner's horse. That contradicts both the
task's own trap ("executed documents are never swept") and the standing rule that
signed documents are never swept in cleanup.

**I did not fix it, deliberately.** The one-line fix (`AND NOT EXISTS (live
signature)`) stops the deletion but leaves the signed document live *alongside* the
freshly generated one, because the skip-if-already-correct check requires
`d.horse_id = p_horse_id` and these rows have a NULL horse. Two live documents for
one owner and template is a supersede decision, and supersede is the model this
task is told not to pre-empt. It is a small, well-defined follow-up task and it
should be next.

---

## §1 — refuse to re-send a signing invitation to a party who already signed

**APPLIED.** Migration `supabase/migrations/20260810T1200_sendguard_no_invite_after_signature.sql`,
plus four application files.

### What changed

| path | before | after |
|---|---|---|
| `invite_contract_counterparty` (RPC) | zero references to `signatures` | raises when the contact holds a live signature on the document |
| `api/contract-invite.ts` | no signature check; RPC errors → 400 | 409 `{code:'ALREADY_SIGNED'}` before minting; RPC refusal also mapped to 409 |
| `redeem_contract_invitation` (RPC) | spent/expired/superseded token → `invitation is not valid or has expired` | an already-signed party is routed to their document, `{document_id, already_signed:true}` |
| `src/pages/Register.tsx` | `validate_invitation` rejects a spent token → dead-end screen, redemption never attempted | for a contract invite, redemption is attempted anyway; signed party lands on `/app/contracts/:id` |
| `src/lib/contracts.ts` | `inviteCounterparty` threw on any non-2xx; `sendForReview` returned `{emailed, skipped}` | refusal returned as data; `sendForReview` returns `{emailed, skipped, refused[]}` |
| `src/pages/app/ContractPage.tsx` | refusals counted as "could not be emailed (no email on file…)" | refusals named: "Lessor already signed this document, so no new signing invitation was sent there." |

Two details worth flagging:

- **Grain.** The RPC takes `(document_id, contact_id)` and has no role parameter, so
  its guard is "this contact has signed this document". The endpoint knows the role
  and checks `(document_id, contact_id, party_role)`. They can therefore disagree in
  one direction — a signature recorded under a *different* role than the one being
  invited passes the endpoint and is caught by the RPC. That refusal is mapped to
  the same 409, so it surfaces as a refusal rather than a raw database error.
- **The UI dead end was in `validate_invitation`, not in the redemption RPC.**
  `validate_invitation` only recognises `status='sent' AND expires_at > now()`, so
  `Register.tsx` showed "this link isn't valid anymore" and never called redemption
  at all. Fixing only the RPC would have changed nothing a user could see. Where the
  visitor is not signed in, the invalid screen's Sign In link now carries
  `state.from` back to the activate URL, so signing in completes the route.

### Evidence — `BEGIN … ROLLBACK` against production

```
--- BEFORE: does the CURRENT invite RPC guard on signatures? (expect 0) ---
 mentions_signatures
---------------------
                   0

--- BEFORE: the CURRENT RPC happily mints an invitation for the SIGNED party ---
 invitation_minted_for_signed_party
------------------------------------
 t

--- AFTER §1a/§1b: RPC refuses the SIGNED party ---
NOTICE:  PASS refusal → this party has already signed this document as LESSOR — a new signing invitation cannot be sent

--- AFTER §1 NEGATIVE CASE: the UNSIGNED party can still be invited ---
 unsigned_party_still_invitable
--------------------------------
 t

--- AFTER: a soft-deleted signature does NOT block (deleted_at IS NULL is the key) ---
 invitable_once_signature_is_voided
------------------------------------
 t

--- AFTER §1c: SIGNED party + EXPIRED-AND-SPENT link → routed to their document ---
 {"document_id": "62a55a4d-7ad3-4001-88f3-0a4070729051", "already_signed": true}

--- AFTER §1c: SIGNED party + LIVE link → routed, no re-sign prompt ---
 {"document_id": "62a55a4d-7ad3-4001-88f3-0a4070729051", "already_signed": true}
 live_token_status_after
-------------------------
 redeemed

--- AFTER §1 NEGATIVE CASE: the UNSIGNED party can still REDEEM ---
 {"document_id": "62a55a4d-7ad3-4001-88f3-0a4070729051", "already_signed": false}

--- AFTER: a wrong-email redeemer is still refused (unchanged guard) ---
NOTICE:  PASS wrong-email refusal → this invitation was issued to a different email address

--- AFTER: a token that does not exist is still refused (unchanged) ---
NOTICE:  PASS unknown-token refusal → invitation is not valid or has expired

ROLLBACK
```

Applied afterwards; both functions verified live:

```
invite_contract_counterparty guards_on_signatures=true
redeem_contract_invitation guards_on_signatures=true
```

---

## §3 — the sweep is signature-aware

**APPLIED.** Migration `supabase/migrations/20260810T1300_sendguard_sweep_is_signature_aware.sql`.
**Zero rows changed**, before and after:

```
-- non-EXECUTED documents carrying a live signature, production-wide
-- BEFORE: (0 rows)
-- AFTER:  (0 rows)
```

### Two edits, and one judgement call I want on the record

1. The sweep gains `AND NOT EXISTS (live signature)`. **I kept the `status <>
   'EXECUTED'` test rather than replacing it.** The task says to key the delete on
   "carries no live signature, not on `status <> 'EXECUTED'`"; taken literally, that
   would let the sweep reach an EXECUTED document that happens to carry no signature
   row, which the traps forbid outright. Signature-awareness is *added* to the key.

2. Skipping the delete on its own leaves the signed draft live **and** generates a
   second live draft for the same member and template — the onboarding page then has
   two pending documents and no way to choose. So a pending document carrying a live
   signature is **adopted** as the document for that template and nothing is
   generated. This is the smallest change that makes "never swept" a coherent
   outcome rather than a duplicate. It is not §2: an *unsigned* draft is still
   deleted and regenerated exactly as before.

### Evidence — simulated multi-signer document, `BEGIN … ROLLBACK`

```
--- BEFORE: re-enter onboarding → the SIGNED draft is soft-deleted (signature orphaned) ---
 is_the_signed_doc | signed_doc_was_swept | live_sigs_on_swept_doc
-------------------+----------------------+------------------------
 t                 | t                    |                      1

 before_a_new_id_was_minted
----------------------------
 t

--- AFTER: re-enter onboarding → the SIGNED draft SURVIVES, same id, no duplicate ---
 signed_doc_survived | live_sigs_after
---------------------+-----------------
 t                   |               1

 after_same_id_returned
------------------------
 t

 live_release_general_docs_for_member
--------------------------------------
                                    1

--- AFTER: the UNSIGNED path is UNCHANGED — an unsigned draft still regenerates ---
 unsigned_draft_still_regenerates | unsigned_draft_swept_as_before
----------------------------------+--------------------------------
 t                                | t
```

Verified live after applying: `sweep_signature_aware=t`, `adopts_signed_pending=t`.

---

## §2 — stop the churn (BUILT, DRY-RUN, **NOT APPLIED**)

Migration `supabase/migrations/20260810T1400_sendguard_reuse_pending_onboarding_document.sql`
is committed **unapplied**. Production still runs the original
`generate_document`, and `compose_document_body` / `regenerate_document_body` do not
exist there — confirmed after the dry-run:

```
 proname
---------
(0 rows)

 gendoc_refactored | onboarding_reuses
-------------------+-------------------
 f                 | f
```

### The design, and why it does not reintroduce the stale-data bug

The delete exists because onboarding merges profile data into the **body** at
generation time; a draft made before the member finished step 1 has empty tokens
baked in and nothing refreshes them. So the migration separates the two things the
delete was doing at once:

1. **`compose_document_body(document_id, service_type)`** — the composition half of
   `generate_document`, lifted out *verbatim* and pointed at an existing row. It
   reads template, contract, horse, party roster and config exactly as before and
   returns text. It writes nothing. The only edit to the lifted code is
   `pu.contract_id = p_contract_id` → `pu.contract_id = v_doc.contract_id`, which is
   the same value by construction (`generate_document` writes `p_contract_id` into
   the row it then composes).
2. **`generate_document`** — same signature, same behaviour, ten callers untouched.
   It still inserts the row, binds the horse set, seeds the parties; the text now
   comes from `compose_document_body`.
3. **`regenerate_document_body(document_id, service_type)`** — recompose in place.
   **Writes nothing if the text is identical.** Refuses an EXECUTED document, and
   refuses any document carrying a live signature.
4. **`generate_my_onboarding_documents`** — reuses the pending draft: re-syncs the
   party roster first (a guardian may have added a minor since, and the body reads
   from the roster), refreshes the horse binding by the same
   `coalesce(bound_set[1], resolved_horse)` rule, then recomposes in place.

**Which cases change an id: none, inside the onboarding loop.** The
delete-and-regenerate branch now runs only when there is no reusable pending
document — i.e. when there is no id to keep. A pending document carrying a live
signature is adopted by §3 before the reuse branch is reached, so a signed body is
never rewritten under the signer.

**Known limitation, stated rather than hidden:** `regenerate_document_body` takes
the service type as a parameter because the row does not record it. Onboarding
passes `NULL`, which is what `generate_my_onboarding_documents` passes at generation
today, so the two agree. A future caller regenerating a document that was
*generated* with a service type (`ensure_horse_documents` passes `'horse'`) must
pass the same value or the `JUMPER_*` cut-blocks would compose differently. No such
caller exists in this change.

`ClauseDocument.tsx` is untouched.

### Evidence — `BEGIN … ROLLBACK` against production, raw

```
--- BEFORE: enter onboarding, leave, re-enter → THE ID CHANGES (F2, the defect) ---
 before_id_changed_on_reentry | before_first_draft_deleted
------------------------------+----------------------------
 t                            | t

--- BEFORE: the draft printed an EMPTY name, because the profile was incomplete ---
 body_present | body_has_email | body_has_name_before
--------------+----------------+----------------------
 f            | t              | f

--- APPLYING §2 inside this transaction ---
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
NOTICE:  SENDGUARD2: generate_my_onboarding_documents rewritten

--- PROOF a: compose_document_body reproduces generate_document BYTE FOR BYTE ---
            (regenerating a document generated by the OLD inline code writes nothing)
 body_changed_expect_false
---------------------------
 f

 byte_identical_to_old_composition
-----------------------------------
 t

--- PROOF b: leave and re-enter onboarding → THE SAME DOCUMENT ID ---
 after_same_id_as_existing_draft | after_stable_across_two_reentries | live_docs_for_this_template
---------------------------------+-----------------------------------+-----------------------------
 t                               | t                                 |                           1

--- PROOF: an unchanged re-entry writes NOTHING (updated_at does not move) ---
 no_write_when_body_unchanged
------------------------------
 t

--- PROOF c+d: THE REGRESSION THE DELETE EXISTED TO PREVENT ---
            complete the profile AFTER the draft was made, re-enter:
 id_unchanged_after_profile_completed | body_now_has_the_name | body_now_has_the_phone
--------------------------------------+-----------------------+------------------------
 t                                    | t                     | t

--- PROOF: the multi-horse binding survives re-entry (v_keep_horses intent) ---
 bound_horses_after_reentry | doc_horse_set
----------------------------+---------------
                          2 | t

--- PROOF e: a document carrying a live signature is ADOPTED, never rewritten (§3) ---
 signed_doc_same_id | signed_body_untouched | live_sigs
--------------------+-----------------------+-----------
 t                  | t                     |         1

--- PROOF: regenerate_document_body REFUSES an executed document ---
NOTICE:  PASS executed refusal → document 18d27843-… is executed and is never rewritten

--- PROOF: the other generate_document callers still work (direct call, with a service type) ---
 other_caller_shape_ok | row_created
-----------------------+-------------
 t                     | t

ROLLBACK
================ ROLLED BACK — §2 IS NOT APPLIED ================
```

Proof (a) is the one that matters most for review: `regenerate_document_body`
returning **false** on a document that the *old* inline code composed means the
extracted function reproduced that body byte for byte. The refactor is not
"probably equivalent" — it is equivalent on a real composed document, and the
"unchanged body → no write" rule is what demonstrates it.

Proof (c+d) is the bug the delete existed to prevent, run as the task specified: the
draft was generated while `first_name`, `last_name` and `phone` were empty, the
profile was completed afterwards, and the re-entry produced correct merged data on
the same row.

---

## Verification gates

| gate | result |
|---|---|
| `npm run typecheck` | clean, 0 errors |
| `npm run typecheck:api` | clean, 0 errors |
| `npm run lint` | **0 errors, 30 warnings** — baseline |
| `npm run build` | clean (vite build + prerender + seo-files) |
| row counts | unchanged across documents / signatures / contacts / profiles / invitations / document_parties |

---

## What I verified myself vs what I assumed

**Verified, by running it against production inside `BEGIN … ROLLBACK`:**

- Every "before" claim in §1 and §3 — that the invite RPC minted an invitation for a
  signed party, that the sweep soft-deleted a document carrying a live signature and
  minted a new id, that re-entry changed the document id.
- Every "after" claim, including the negative cases: an unsigned party can still be
  invited and can still redeem; a voided signature unblocks; wrong-email and
  unknown-token refusals are unchanged.
- F3's zero-row count, re-derived before and after §3 rather than taken from the task
  doc.
- The `ensure_horse_documents` finding, including the two live EXECUTED signed rows in
  its blast radius.
- That §2 is not applied: `compose_document_body` and `regenerate_document_body` do
  not exist in production and `generate_document` is unrefactored.
- Both applied migrations assert their own rewrite landed, and both assertions ran.

**Assumed, or verified only by reading:**

- **No browser click-through.** The `Register.tsx`, `ContractPage.tsx` and
  `contracts.ts` changes are verified by typecheck, lint and build, and by reading
  the code paths — not by driving the UI. The claim "an already-signed party lands on
  their signed document" is proven at the RPC boundary (it returns the document id);
  that `/app/contracts/:id` then renders the signed state rather than a re-signing
  prompt I confirmed by reading `ContractPage.tsx` (`iSigned` → "You've signed. The
  contract executes once the other party signs."; `isExecuted` suppresses the signing
  deck), not by loading it.
- **`sendForReview` refusal copy** is exercised by no test. The shape is typechecked;
  the sentence is not proven against a real send.
- **§2's behaviour under a *concurrent* second session** (two tabs entering onboarding
  at once) is not modelled. The reuse path is `SELECT … ORDER BY created_at DESC LIMIT
  1` with no lock. Today's delete-and-regenerate has the same property, so this is not
  a regression, but it is not an improvement either and I did not test it.
- I did not re-derive the task doc's account of Sarah's three documents; I took F1/F2
  as given and verified only F3, the claim §3 depends on.

## Process note

The first §1 dry-run was not a dry-run. Sourcing the migration with `\i` inside an
outer transaction executed the migration's own `COMMIT;`, which closed that
transaction and committed the fixture rows — 2 contacts, 1 document, 2 parties, 1
signature, 2 auth users, 2 profiles, 6 invitations, 7 status events. I found it
immediately, deleted every one of those rows, and confirmed all six table counts
returned to their pre-session values before continuing. I then restored both
functions to their captured pre-change definitions, re-ran the dry-run with the
migration's transaction control stripped, and applied only after it passed and rolled
back cleanly. No production row was modified at any point — the leaked rows were
entirely my own throwaway fixture. All later dry-runs (§1 re-run, §3, §2) used the
stripped form and each was confirmed to have left nothing behind.
