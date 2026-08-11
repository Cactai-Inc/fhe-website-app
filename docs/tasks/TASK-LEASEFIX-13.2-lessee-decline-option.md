# LEASEFIX 13.2 — the Lessee's decline option. THREE changes, not one.

> ## STATUS 2026-08-10 — PART 1 IS ALREADY LIVE IN PRODUCTION. Risk knowingly accepted.
>
> The thread widened the option before this document reached it: `ACCEPTS_PERSONALLY`'s
> option-level `when` is **removed** and the label is now "Does not carry general liability
> insurance". Applied to production; all three live leases offer it. `f2b88b3` on
> `task/leasefix`, unpushed.
>
> **The contradiction described below is therefore REACHABLE NOW.** No lease is in that state
> — the only lease carrying an insurance answer is `GL_AND_CCC` + `HAS`.
>
> **Owner ruling:** *"im the one authoring leases... lets wait until it finishes that work and
> right now its just modeling the fix not implementing it so we can run all of it as one
> thing."* Mitigation is that he is the sole lease author and knows the combination to avoid:
> **Lessor requires GL + Lessee "does not carry."** Changes 2 and 3 land in the same batch as
> the insurance-model rebuild.
>
> **Do not treat part 1 as done.** It is half a change sitting in production.

> ## THE BLOCKER DOES NOT CATCH THIS — tested 2026-08-10, not assumed
>
> The thread argued the contradiction *"may be a fine draft state, since it's visible and gets
> resolved before signing."* **Nothing enforces that.**
>
> In a rolled-back transaction, `GL_LESSOR_REQUIRES = GL_AND_CCC` with
> `GL_LESSEE_STATUS = ACCEPTS_PERSONALLY` on a live lease, `contract_lock_blockers` returned:
>
> ```
> required_fields                 — unrelated empty fields
> horse_unconfirmed               — unrelated
> insurance_acceptance_unchecked  — deductible share, care cost
> ```
>
> **Not one blocker mentions the contradiction.** Fill the unrelated fields and it locks and
> executes carrying both clauses. The blocker detects BLANK; `ACCEPTS_PERSONALLY` is a valid
> answer, so the mechanism being relied on is structurally incapable of firing here.
>
> **A fourth compounding clause surfaced in the same test:** `insurance_acceptance_unchecked`
> demands *"Lessee accepts responsibility for the share of any deductible"* — about a policy
> the same document says does not exist. Add it to the suppression list in change 3.

**Owner, 2026-08-10:** *"section 13.2 the lessee dropdown didnt have one option it needs to
have since there is a scenario its valid and there is already the text for it when its
selected."*

**He is right on both counts.** The option value and its clause body already exist. Verified
against production 2026-08-10. **But adding it alone ships a self-contradicting instrument.**

## What exists today

`TXN.GL_LESSEE_STATUS` offers three values. The third is conditionally gated:

| value | offered when |
|---|---|
| `HAS` | always |
| `WILL_OBTAIN` | `GL_LESSOR_REQUIRES` ∈ (`GL_ONLY`, `GL_AND_CCC`) |
| `ACCEPTS_PERSONALLY` | `GL_LESSOR_REQUIRES` = `NEITHER` **AND** `GL_NO_REQ_ALLOCATION` = `LESSEE_AT_FAULT` |

Its clause `INSURANCE_RISK.GL_LESSEE_PERSONAL` is written and reads correctly on its own:

> Lessee does not carry general liability insurance under this Agreement. Lessee accepts
> personal financial responsibility for the costs of any liability claim... and acknowledges
> that no policy stands behind that responsibility.

**The missing scenario:** the Lessor REQUIRES general liability of the Lessee, and the Lessee
declines and accepts personal responsibility instead. Commercially real — a lessor may accept
that in negotiation.

## WHY ADDING THE OPTION ALONE IS DANGEROUS

When `GL_LESSOR_REQUIRES` ∈ (`GL_ONLY`, `GL_AND_CCC`), **`INSURANCE_RISK.GL_REQUIRED` renders**:

> Lessor requires Lessee to obtain and maintain, at Lessee's sole cost, general liability
> insurance... **Failure to obtain or maintain that coverage constitutes a material breach
> subject to the Termination for Cause provisions of this Agreement.**

Put both in one document and the executed lease states that the Lessee **is in material breach
at the moment of signature**, with termination for cause already armed. That is not a cosmetic
contradiction — it is a live grenade in a signed instrument.

**And a third clause compounds it.** `INSURANCE_RISK.GL_DED_SIMPLE` also renders on
`GL_ONLY`/`GL_AND_CCC`:

> If a claim is made under any such policy... responsibility for any deductible shall be borne
> by: {{TXN.GL_DED_RESP}}

It allocates the deductible of a policy the same document says does not exist. `GL_DED_SPLITC`
and `GL_DED_ACCEPT` sit on the same gate.

## THE THREE CHANGES

1. **Widen the option.** Offer `ACCEPTS_PERSONALLY` when the Lessor requires GL, in addition
   to the existing NEITHER + LESSEE_AT_FAULT branch.
2. **Suppress the requirement clause when it is declined.** `GL_REQUIRED` must not render
   alongside `GL_LESSEE_PERSONAL` — either gate it off, or replace it with a clause that
   states the requirement was made AND waived. **The owner chooses which; do not pick.**
3. **Suppress the deductible clauses when no policy exists.** `GL_DED_SIMPLE`,
   `GL_DED_SPLITC`, `GL_DED_ACCEPT` must not render when the Lessee's answer is
   `ACCEPTS_PERSONALLY`.

## THIS SUPERSEDES A DECISION MADE EARLIER IN THE SAME THREAD

The thread previously established, and the owner accepted, that **non-acceptance is the
absence of an answer** — enforced by `contract_lock_blockers` refusing to lock while the
Lessee line is blank, so a rejected term never becomes text.

**This change reverses that for one case:** the Lessee can now answer "no" and the contract
becomes executable. That is a deliberate model change, not an oversight, and the blocker
behaviour must be re-verified afterward: **a blank Lessee line must still block**, while
`ACCEPTS_PERSONALLY` must not.

## VERIFICATION — required, in a rolled-back transaction

Prove all four, with raw output:

1. `GL_ONLY` + `ACCEPTS_PERSONALLY` renders `GL_LESSEE_PERSONAL` and **does NOT render**
   `GL_REQUIRED`, `GL_DED_SIMPLE`, `GL_DED_SPLITC`, `GL_DED_ACCEPT`.
2. `GL_ONLY` + `HAS` still renders `GL_REQUIRED` and the deductible clauses — **the working
   path is unchanged.**
3. `NEITHER` + `LESSEE_AT_FAULT` + `ACCEPTS_PERSONALLY` behaves exactly as it does today.
4. A blank Lessee line still trips `contract_lock_blockers` in the branches where the question
   appears, and stays silent where it does not.

**Item 2 is the one people skip.** A gate widened carelessly suppresses clauses in the branch
that was already correct.

## CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-leasefix`, branch `task/leasefix`. Never the
  canonical checkout — a pre-commit hook will refuse code commits there.
- **`ClauseDocument.tsx` is FROZEN** again. The one lifted exception was `2be3faa`, which has
  shipped.
- **Sarah's document `704c8d2d-…` is a SAMPLE UNDER REVIEW, not a live negotiation.** CORRECTED 2026-08-10 by the owner — *"the one for sarah even is a sample for her to review not the final version."* Verified: `AWAITING_SIGNATURE`, zero signatures. **Template changes are EXPECTED to reach it.** Not read-only.
- **Executed documents are never rewritten.** The two executed leases keep their text.
- Dry-run in `BEGIN … ROLLBACK`, show raw output, then apply, then verify, then commit.
  **Do not push.**
