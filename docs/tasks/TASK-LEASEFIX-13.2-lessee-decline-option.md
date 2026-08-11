# LEASEFIX 13.2 — the Lessee's decline option. THREE changes, not one.

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
- Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION. Read-only.
- **Executed documents are never rewritten.** The two executed leases keep their text.
- Dry-run in `BEGIN … ROLLBACK`, show raw output, then apply, then verify, then commit.
  **Do not push.**
