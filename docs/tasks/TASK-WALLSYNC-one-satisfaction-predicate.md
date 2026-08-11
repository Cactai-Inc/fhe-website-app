# TASK WALLSYNC — the signing wall and the onboarding page disagree

**Production outage. 3 of 4 real account holders are walled; 2 of them are deadlocked with
no path out of it.** Diagnosed by the orchestrator against production, 2026-08-07,
read-only. Reported by the owner as "Sarah can't see anything" — she is not the only one.

---

## The deadlock

Two functions each answer "has this contact satisfied this required document?" and they
answer differently:

| function | drives | version-aware? |
|---|---|---|
| `contact_document_wall_state()` (via `my_wall_state()`) | the signing wall that traps the session | **yes** — requires `signed_template_version >= current version` |
| `my_onboarding_state()` | the onboarding page, the only way out of the wall | **no** — any `EXECUTED` document satisfies it (lines 126/136) |

So the moment a template is re-versioned:

- the **wall** says "you owe me this document" and blocks every route except
  `/app/onboarding`;
- the **onboarding page** says "all your tasks are complete" and offers nothing to sign.

The member is locked in a room whose only door is painted on. Every symptom the owner
reported is this one bug:

- documents page "empty" — she never reaches it; the wall redirects first
- every emailed link lands on "nothing to do, all tasks complete" — that is the walled
  onboarding page
- lands there on first login instead of the community feed — same
- the contract is nowhere — she cannot leave `/app/onboarding` to reach it

`Documents.tsx` also swallows load failures (`myDocuments().catch(() => [])`), so a real
failure there would *also* render as a silent empty page. Not the cause here, but it is why
the symptom was mis-read as a data problem. **Fix the swallow too** — an error must say so.

## Measured blast radius (production, 2026-08-07)

| person | wall | onboarding page | state |
|---|---|---|---|
| Sarah Morgan | walled (2) | `needed: false` | **deadlocked** |
| Madeline Do | walled (4) | `needed: false` | **deadlocked** |
| Mary Richardson | walled (6) | `needed: true` | fine — has no executed docs, so the page works |
| CJ Z | not walled | — | staff |

Mary is the control case: she escapes precisely *because* she has signed nothing, so the
version comparison never runs. **The bug only bites members who have already signed.**

---

## Bug A — `signed_template_version = 0` re-walls a valid signature

19 `EXECUTED` documents carry `signed_template_version = 0`. The column is nullable with no
default, so `0` was written deliberately by a backfill to mean *"signed before we recorded
versions."*

The wall's check is:

```sql
AND coalesce(d.signed_template_version, ct2.version) >= ct.version
```

`coalesce(0, …)` returns **`0`**, and `0 >= 1` is false. The guard only fires on `NULL`, so
for every one of these rows it never fires at all — and the comment sitting directly above
it says it exists "rather than silently re-walling someone." That is exactly what it does.

### The backfill is provable, not a guess

All 19 rows belong to templates that have **only ever had version 1**:

| template_key | current version | docs at `signed_v = 0` |
|---|---|---|
| `COMPANY_POLICIES` | 1 | 9 |
| `FACILITY_RULES` | 1 | 10 |

There has never been another version of either to sign, so `0` can only mean `1`. Set them
to `1`. **There are no ambiguous rows** — if your own query finds any template at version
≥2 holding `signed_v = 0`, stop and report rather than guessing which version was signed.

**Note the versioning model before you touch this:** `contract_templates` holds **one row
per `template_key`** and mutates the version in place. So `d.template_id → ct2.version` is
the *current* version, never the signed one — which is why the `coalesce` fallback is
unsound in general and must not be relied on as a source of truth.

### What Bug A alone fixes

- **Sarah** — both her blockers are `COMPANY_POLICIES` and `FACILITY_RULES`. She is
  **fully released**. (Her `RELEASE_GENERAL` is already satisfied at v2 — she did sign the
  new release.)
- **Madeline** — 2 of 4 cleared. Her other two are **genuine**: `HUMAN_EMERGENCY_MEDICAL`
  signed v1 / needs v2, `RELEASE_PARTICIPANT` signed v2 / needs v3.
- **Mary** — unaffected.

## Bug B — one predicate, not two

Bug A is the data. **Bug B is why the data could deadlock anyone in the first place**, and
it survives the backfill: Madeline still legitimately owes two re-signed documents, so she
will still be walled, and the onboarding page will still tell her she has nothing to do.

**Extract a single satisfaction predicate and have both callers use it.** Suggested shape:

```sql
contact_document_satisfied(p_contact_id uuid, p_template_key text) RETURNS boolean
```

version-aware, one definition, called by `contact_document_wall_state()` **and**
`my_onboarding_state()`. Any future divergence then becomes impossible by construction
rather than by two authors remembering the same rule.

### CORRECTED 2026-08-07 by the owner — the wall is the half that is wrong

An earlier revision of this doc said "do not fix this by making the wall version-blind …
the wall is the half that is behaving correctly." **That was wrong.** The owner's
correction:

> "I haven't sent re-signs to anyone other than Sarah, and if someone has them we need to
> call them back."

**Nobody was sent one.** No invitation exists for Madeline in 60 days. The re-signature
demands are manufactured by the wall itself, silently, with no email, no notice and no
staff decision.

The mechanism: `contact_required_documents` is `(contact_id, template_key, org_id)` —
**there is no version column.** An assignment records "this person needs
`HUMAN_EMERGENCY_MEDICAL`", never "needs version 1". The wall then compares the signature
against `max(version)`. So the instant anyone edits a template body and bumps its version,
**every prior signer is silently re-papered.** All 9 wall-gating templates were bumped on
2026-08-02 by the contract sprint, which is the true origin of this incident.

Measured exposure: **10 people hold valid signatures the system now treats as stale**, over
20 documents. Madeline Do is walled today; 8 more (Ashlan Hockersmith, Audrey Slater, Brian
Olenik, Charles Zigmund, Elisheva Fiszer, Raymond Thicklin, Serena Lee) have no account yet
and would be walled on first login.

This contradicts the standing owner rule that **an imperfect executed document is still
valid** and that re-signing supersedes and retains. Deciding to re-paper a client is a
business and legal judgement. **The system must never make it as a side effect of editing
text.**

### So the fix inverts

Make satisfaction **version-blind by default**: any `EXECUTED`, non-superseded document for
an assigned `template_key` satisfies it. That makes the wall agree with
`my_onboarding_state()` — resolving Bug B by conforming the *wall* to the page, not the
page to the wall — and it releases Madeline and the 8 latent cases without asking anyone to
sign anything they were never asked for.

Forcing a re-signature must become an **explicit act**, never an inference:

- staff assigning/re-assigning the document, or
- an explicit per-template marker (e.g. "signatures below version N must re-sign"), set
  deliberately when a change is material enough to warrant it.

**Do not** silently bump `signed_template_version` on existing rows to paper over this —
that falsifies the record of what each person actually signed. The signed version is
evidence; leave it exactly as it is and change what the *gate* asks of it.

**Ask the owner before implementing the forced-re-sign marker.** Whether the 2026-08-02
body changes were material enough to require anyone to re-sign is the owner's call and
legal counsel's, not this thread's. Ship the version-blind gate first; that is the part
that is unambiguously correct.

### Required invariant

> **If the wall blocks, the onboarding page must show at least one actionable item.**

Assert it: for every contact, `wall == true` implies `my_onboarding_state()` yields ≥1
signable document. Add it as a check so this class of deadlock cannot ship again.

---

## Order of work — this matters

1. **Bug A first.** If you make the onboarding page version-aware before backfilling, Sarah
   and 8 others are told to re-sign documents they have already validly signed. That is a
   worse outcome than the outage.
2. **Then Bug B.**
3. Then the `Documents.tsx` error swallow.

## Verification

1. Before/after `my_wall_state()` and `my_onboarding_state()` for **all four** account
   holders, raw output in the report.
2. Sarah: `wall == false`, and she can reach `/app/documents`, the community feed, and
   document `704c8d2d-…`.
3. Madeline: still walled (correctly), **and her onboarding page now lists exactly the two
   documents she genuinely owes.** This is the real test of Bug B.
4. Mary: unchanged — still walled, still shown all six. Confirm no regression; she is the
   D8 Stage-2 acceptance case.
5. The invariant above holds for every contact, not just these four.
6. Row counts unchanged on `documents`, `signatures`, `contact_required_documents`.
   **No document's `status`, `current_status` or signature content may change** — this task
   touches `signed_template_version` and function bodies only.

## Constraints

- Own git worktree off `origin/main`.
- Separate migrations for Bug A (data) and Bug B (logic), each revertable alone.
- Dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply.
- **Sarah's document `704c8d2d-…` is a SAMPLE UNDER REVIEW, not a live negotiation.** CORRECTED 2026-08-10 by the owner — *"the one for sarah even is a sample for her to review not the final version."* Verified: `AWAITING_SIGNATURE`, zero signatures. **Template changes are EXPECTED to reach it.** Not read-only.
  backfill must not touch it; scope your `UPDATE` by `signed_template_version = 0` and
  assert the affected count is exactly 19 before committing.
- `ClauseDocument.tsx` is FROZEN and is not involved.
- `AppLayout.tsx` is owned by **ONEMENU** — do not edit it. The wall lives at
  `AppLayout.tsx:684`; if it needs a change, report it and the orchestrator will route it.

## Reporting

`docs/reports/TASK-WALLSYNC-REPORT.md`. Raw before/after per account holder, the exact
affected-row count for the backfill, and an explicit statement of what you verified
yourself versus what you assumed.
