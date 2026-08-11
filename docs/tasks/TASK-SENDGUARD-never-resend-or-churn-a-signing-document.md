# TASK SENDGUARD — a signing document is never re-sent to someone who signed it, and never churns underneath a link

Owner, 2026-08-09, on discovering that Sarah's onboarding document was replaced three times
in six minutes:

> "it looks like we need to review the send and redemption process so i cant send a document
> to someone who already signed it and reclicking the link doesnt start over by deleting the
> document they already signed but rather shows them a screen saying their signed document."

**CORRECTED before this doc was written — read this before anything else.** One third of that
sentence describes something that did not happen, and building for it would waste the thread.

- **A signed document was NOT deleted.** Verified: the two swept rows carried **zero**
  signatures, ever. Sarah had not signed them.
- **The "here is your signed document" screen ALREADY EXISTS.** `Onboarding.tsx` renders
  "You're all set" (with a *See your documents* link) and "Nothing to do here" when nothing is
  pending, and `ContractPage.tsx` branches on `isExecuted`. **Do not build a new screen.**

The two real defects are §1 and §2 below. §3 is defence in depth on the same class of write.

---

## Established findings — verified against production 2026-08-09. Do not re-derive these.

### F1 — nothing guards a re-send to a party who already signed

| path | guards on signatures / EXECUTED? |
|---|---|
| `api/contract-invite.ts` | **no** — loads document, finds party, mints invitation, sends |
| `invite_contract_counterparty` (RPC) | **no** — zero references to `signatures` or `EXECUTED` |
| `redeem_contract_invitation` (RPC) | **no** — its only "signatures" mention is inside a comment |

`api/deliver-documents.ts` **does** guard (409 unless every document is EXECUTED). The
discipline exists in this codebase; the signing-invite path never got it.

### F2 — every re-entry to onboarding destroys the pending draft and mints a new id

`generate_my_onboarding_documents` soft-deletes then regenerates:

```sql
UPDATE documents d SET deleted_at = now()
  FROM contract_templates t
 WHERE d.template_id = t.id AND d.contact_id = v_contact
   AND t.template_key = req.template_key
   AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
```

Sarah's single `RELEASE_GENERAL` became three documents in six minutes, each deleted at the
instant the next was created:

```
62e9c1f7  DRAFT     created 04:47:25  deleted 04:48:26   signatures ever: 0
352ccb89  DRAFT     created 04:48:26  deleted 04:53:52   signatures ever: 0
54665d4d  EXECUTED  created 04:53:52  signed  04:54:22   signatures ever: 1
```

**The harm is link stability, not data loss.** A document id sent in an email points at a
deleted row as soon as the recipient reloads the page. A re-send after that is aiming at a
moving target — which is how §1 and §2 are the same bug seen from two ends.

### F3 — the sweep is keyed on status, not on whether anything is signed

`status <> 'EXECUTED'` would delete a document carrying a real signature. Today nothing is in
that class:

```sql
SELECT d.status, count(*) FROM documents d
WHERE d.status <> 'EXECUTED' AND d.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM signatures s WHERE s.document_id=d.id AND s.deleted_at IS NULL)
GROUP BY 1;
-- (0 rows)
```

**Zero rows — and that is an accident, not a rule.** Onboarding documents have one signer
(`CLIENT`), so signing drives them to `EXECUTED` in the same statement and they become
untouchable. A multi-signer document entering this loop after one signature would lose it.

---

## What to build

### §1 — refuse to re-send a signing invitation to a party who has already signed

Guard all three paths in F1. A party with a live (`deleted_at IS NULL`) signature on that
document in that role **cannot** be sent a fresh signing invitation.

- The **API** returns a clear refusal the UI can render — not a 500, and not a silent
  `{ok:true, emailed:false}` that reads as success.
- The **RPC** guards independently. Do not rely on the endpoint alone; `invite_contract_counterparty`
  is directly callable.
- **`redeem_contract_invitation`**: an already-signed party who clicks an older link must land
  on their signed document, **not** an error and not a re-signing prompt. The screen exists —
  route to it.

**ASK, DO NOT GUESS: should staff be able to override?** There is a legitimate case — a party
signed the wrong version and is being asked to sign a corrected one. **Do not invent an
override, and do not silently make it impossible.** Implement the refusal, and report the
question with your recommendation. The re-sign machinery is a live owner decision
(six template-version calls, still unanswered) — **this task must not pre-empt it.**

### §2 — stop the churn: reuse the pending document instead of delete-and-recreate

This is the fix that makes links durable.

**Understand why the delete exists before you remove it.** The regeneration is deliberate:
onboarding merges fresh profile data (names, addresses) into the document body, so a draft
created before the member completed step 1 would print stale or empty tokens. **A naive
"always reuse" reintroduces that bug.**

The distinction to implement: **regenerate the BODY in place; keep the ROW and its id.** If
the composed body is unchanged, do nothing at all.

If you conclude an id must change in some case, **say which case and why** in the report
rather than quietly widening the rule.

**`ClauseDocument.tsx` is FROZEN.** This work is in the RPC and, if needed,
`generate_document` — not the renderer.

### §3 — make the sweep signature-aware

Key the delete on "carries no live signature", not on `status <> 'EXECUTED'`. A document with
a signature is never swept, whatever its status.

Same class as `void_signatures_on_edit` in `TASK-NOGUARD2`: a write path that can destroy
signatures and is currently safe only by circumstance. **Zero rows change today** — that is
the point. Prove it with a before/after count.

---

## Traps

- **Executed documents are never swept, never rewritten.** `signed_template_version` is
  evidence. Nothing here touches an EXECUTED row.
- **A `{ok:true, emailed:false}` return reads as success to the caller.** `contract-invite.ts`
  already uses that shape for "no email on file". A refusal must be distinguishable.
- **Migrations that rewrite function bodies must assert the rewrite matched.** ~31 migrations
  in this repo string-replace against `pg_get_functiondef`; a non-matching replacement
  silently no-ops and reports success. `20260808T0300_payment_guards_fail_closed.sql` shows
  the assertion pattern.
- **`generate_my_onboarding_documents` carries `v_keep_horses`** — the member's multi-horse
  choice, deliberately preserved across regeneration. Whatever you change must keep that
  working, and reusing the row should make it simpler, not harder.
- **Do not modify real data to demonstrate a fix.** Simulate in `BEGIN … ROLLBACK`.

## Verification — evidence, not assertion

1. **§1** — for a party with a live signature: the API refuses with a readable reason, the RPC
   refuses when called directly, and an old link routes to the signed document. Show all three.
2. **§1 negative case** — a party who has NOT signed can still be sent and can still redeem.
   **Prove the guard did not lock out the working path.**
3. **§2** — open onboarding, leave, re-open. **The document id is the same.** Then change a
   profile field that appears in the body and re-open: the body updates, the id still does not
   change. This is the whole point of the task.
4. **§2 regression** — a draft generated before profile completion still ends up with correct
   merged data. This is the bug the delete existed to prevent.
5. **§3** — before/after count of documents carrying a live signature, and a simulated
   multi-signer document with one signature proven to survive a regeneration pass.
6. Row counts unchanged across `documents`, `signatures`, `contacts`, `profiles`.
7. Typecheck, `typecheck:api`, lint, build clean. Lint baseline: 0 errors / 30 warnings.

## Constraints

- Own git worktree off `origin/main` at `~/Downloads/claude-code-repo/wt-sendguard`.
  **Never `~/Desktop`.** The canonical repo is
  `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app` and there is no other.
- **`ClauseDocument.tsx` is FROZEN.**
- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION —
  read-only, never write.** Her onboarding documents are executed evidence of the bug and are
  likewise read-only. Use throwaway rows in `BEGIN … ROLLBACK` for every test.
- Dry-run every migration in `BEGIN … ROLLBACK` with raw output shown, then apply, then verify
  with a query, then commit.
- Separate migrations per section (§1, §2, §3), each revertable alone.
- **Do not touch the re-sign / template-version model.** Six version decisions are open with
  the owner. Nothing here decides them.

## Reporting

`docs/reports/TASK-SENDGUARD-REPORT.md`. Per section: what changed, the raw before/after, and
an explicit statement of **what you verified yourself versus what you assumed.** Carry the
§1 override question to the top of the report with your recommendation.
