# TASK LEASEFIX — report

**2026-08-10.** Written in `~/Downloads/claude-code-repo/wt-leasefix`, branch `task/leasefix`,
off `origin/main` (`7cfe8b6`). Nothing pushed. No migrations applied since the STOP directive.

---

## 0. The `oneheader` claim was wrong — correction for the owner

I told the owner:

> "task/oneheader (eaab867) is committed but not on main, so anything production builds from
> main won't include that week of UI work."

**That is false.** Re-verified myself on 2026-08-10 rather than taking the directive on faith:

```
git merge-base --is-ancestor eaab867 main               -> exit 0   (is an ancestor)
git merge-base --is-ancestor eaab867 origin/main        -> exit 0   (is an ancestor)
git cat-file -e origin/main:src/components/app/AppHeader.tsx -> exit 0 (exists)
git show origin/main:src/components/app/AppLayout.tsx | grep -c AppHeader -> 4
git log --merges --grep=oneheader -> ce06788 "Merge task/oneheader: adopt the login header…"
```

The header work is merged and deployed. **Nothing needs re-merging**, and acting on my warning
would have duplicated already-merged work.

**How I got it wrong:** I ran `git diff main..task/oneheader --stat`, saw files differing, and
concluded "not merged". A diff between an ancestor and its descendant differs in both
directions — the "insertions" I read as unmerged work were lines `main` had since *deleted*. I
also read the `+` in `git branch -a` as significance when it only means "checked out in a
worktree". I never ran the one command that answers the question. Ancestry is a question about
reachability; I answered it with a content diff.

---

## 1. Worktree move — done, no conflicts

Worktree created at `~/Downloads/claude-code-repo/wt-leasefix`, branch `task/leasefix`,
tracking `origin/main` at `7cfe8b6`.

**It was 4 commits, not the 6 I told the owner.** All four cherry-picked cleanly:

| original | on `task/leasefix` | result | patch-id |
|---|---|---|---|
| `f4b7932` yes/no `format_type` | `3ae412b` | clean | identical |
| `2be3faa` dropdown label + GL migration | `41d9b37` | clean | identical |
| `353f5ef` 13.2 requirement model | `f869a96` | clean | identical |
| `1bec0a5` Lessor's own coverage | `fd9329f` | clean | identical |

**No cherry-pick conflicted.** Patch-ids compared with `git patch-id --stable` on both sides —
all four identical, so the moved commits are byte-equivalent in content, not merely
similar-looking. (My first attempt at this comparison printed "DIFFERS" for all four; that was
a broken shell loop — `set --` not splitting under zsh — not a real difference. Rerun in
Python.)

### `main` was left alone, and my commits are still on it

The directive said to move the work and not to rewrite `main`. Those two cannot both be fully
satisfied, so I did the safe half and am reporting the rest.

`local main` is 13 commits ahead of `origin/main`: my 4, and **9 orchestrator documentation
commits stacked on top of them** (`e415cc9`, `3d12d0e`, `b0fd527`, `40123ae`, `90988c7`,
`796586a`, `751ed0e`, `fa13950`, `2b974e2`). Removing mine from `main` would mean rebasing or
dropping commits *underneath* the orchestrator's — history rewriting, which the directive
forbids and which section 2 says to stop and report on instead.

**So the four commits now exist in two places:** on `task/leasefix` (cherry-picked) and still
on local `main` beneath the orchestrator's work. Nothing is lost or duplicated in
`origin/main`, which has neither. **Someone with authority over `main` needs to decide** whether
those four get dropped from it or simply land there when `task/leasefix` merges. I did not
touch it.

---

## 2. Frozen file — `ClauseDocument.tsx`, for the owner's ruling

I edited a file I was not permitted to edit. I did not know it was frozen — that is an
explanation, not a defence; the constraint is in the handoff and I did not read for it before
editing. **Not reverted, per the directive. No further edits.**

Commit `2be3faa` (now `41d9b37`), **16 insertions, 2 deletions**, one hunk at line ~922. The
functional change is two class strings:

```diff
-                      <span className="inline-flex items-baseline gap-1.5">
-                        {!selfLabels && <span>{f.label ?? f.field_key}</span>}
+                      <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1 max-w-full">
+                        {!selfLabels && <span className="shrink-0">{f.label ?? f.field_key}</span>}
```

Everything else in the hunk is a comment.

**Why.** The owner screenshotted 13.3 rendering its label one word per line — "Care, / custody
/ and / control / insurance" — in a narrow column beside the dropdown. `InlineSelect` sizes
itself to its widest option via an invisible `whitespace-pre` sizer (`ContractCascade`
1036-1039); 13.3's widest option is a 107-character sentence. `renderOrphan` put label and
control in a non-wrapping flex row with no shrink floor, so the greedy control took the width
and the label collapsed to its minimum.

### What else in that file this can affect

`renderOrphan` renders **every clause-level authoring control not placed by a `{{token}}`** —
across every template that uses the clause engine, not just the lease. Concretely:

- **Every `certify` checkbox** in the insurance sections (`selfLabels` true, so no label span;
  only the wrapper class changes — `flex-wrap` on a single child cannot alter its layout).
- **Every gate control** rendered above a muted preview (`gateControls`), and every
  non-gate orphan (`previewFields`).
- **Sale and Bill of Sale templates**, which share `ClauseDocument`.

**Assessed risk, not measured:** `flex-wrap` only changes layout when a row would otherwise
overflow, and `shrink-0` only matters when a sibling is competing for width. Rows that fit
today should render identically. **I have not proved that** — I typechecked and built, which
catches neither. A visual regression would show as a control dropping to its own line where it
used to sit inline, most likely on narrow viewports.

**If the freeze holds**, the same defect can be addressed without this file by shortening the
long dropdown option labels — data-only, no deploy. Four fields carry an option long enough to
trigger it: `TXN.OFFSITE_TRANSPORT` (120 chars), `TXN.CCC_REQUIRED` (107, now retired by 2k),
and both GL elections (85).

---

## 3. Applied-but-unpushed migrations

The journal and the database are out of step until these land. **All are applied to
production.** Six, not five — the directive's count predates `20260809T2200`.

| migration | what it did to production |
|---|---|
| `20260809T1900_leasefix_yesno_format_type.sql` | set `format_type='yesno'` on `TXN.RIDER_AIDS_PROHIBITED` and `TXN.MED_INCLUDED` across 4 templates + 3 live docs; they had rendered as text boxes |
| `20260809T2000_leasefix_gl_lessor_requires_lessee.sql` | added the `REQUIRE_LESSEE` option to the GL Lessor election **— superseded hours later by 2100, which deleted that field entirely** |
| `20260809T2100_leasefix_gl_ccc_requirement_model.sql` | rebuilt 13.2: dropped `TXN.GL_LESSOR_ELECTION`, `TXN.GL_LESSEE_ELECTION`, `TXN.CCC_REQUIRED`; added `TXN.GL_LESSOR_REQUIRES`, `TXN.GL_NO_REQ_ALLOCATION`, `TXN.GL_LESSEE_STATUS`; re-keyed CCC to the requirement |
| `20260809T2200_leasefix_gl_lessor_own_coverage.sql` | added `TXN.GL_LESSOR_COVERAGE` as an independent election; renumbered 13.2 clause sort orders |

Two earlier ones (`20260809T1700` horse-import guard, `20260809T1800` 3.5 title) are already in
`origin/main`.

**`20260809T2000` is dead weight** — it adds a field that `20260809T2100` deletes. Replaying the
journal on a fresh database produces the right end state but does needless work. It is left in
place because the journal is a record of what was actually run, not a tidy narrative.

---

## 4. Verified versus asserted

### Verified against production, 2026-08-10, raw output

**Gate-aware blocker — the one that matters legally.** Run inside `BEGIN … ROLLBACK`; nothing
persisted. Three branches, Lessee line blank in all three:

```sql
-- for each case: set the two Lessor answers, blank TXN.GL_LESSEE_STATUS,
-- then read contract_lock_blockers(doc) for the required_fields message
```

```
NOTICE:  A requires GL, Lessee blank       | Lessee named in blocker: YES | Required field(s) still empty: Signing individual — name, Signing individual — title, Lessee
NOTICE:  B neither + Lessor assumes all    | Lessee named in blocker: no  | Required field(s) still empty: Signing individual — name, Signing individual — title
NOTICE:  C neither + at-fault to Lessee    | Lessee named in blocker: YES | Required field(s) still empty: Signing individual — name, Signing individual — title, Lessee
```

Fires in A and C, where the Lessee question appears. Does **not** fire in B, where it does not.
That is the property claimed, confirmed in both directions.

**Template parity, sort collisions, dangling references:**

```
     template_key     | clauses | fields | clauses_identical | fields_identical
 HORSE_LEASE_FULL     |     168 |    131 | t                 | t
 HORSE_LEASE_SIMPLE   |     168 |    131 | t                 | t
 HORSE_LEASE_STANDARD |     168 |    131 | t                 | t
 HORSE_LEASE_V2       |     168 |    131 | t                 | t

sort collisions in INSURANCE_RISK           -> 0 rows
conditional_on refs to missing fields       -> 0 rows
{{TXN.*}} body tokens with no field def     -> 0 rows
```

Note **131 fields, not the 130 I reported to the owner** — that number predated
`TXN.GL_LESSOR_COVERAGE`. The clause count, 168, is right.

**Also verified:** each 13.2 branch renders as described, by `remerge_contract_from_clauses`
inside a rolled-back transaction, reading the resulting `merged_body`.

### Asserted, not verified

- **That the `ClauseDocument.tsx` change is visually harmless elsewhere.** Reasoned from the
  CSS semantics; no screenshot, no visual diff. Section 2.
- **That the fix actually cures the owner's screenshot.** Never rendered in a browser — this
  worktree has placeholder Supabase keys, so the frontend cannot run against real data.
  Typecheck and build pass, which proves neither.
- **That `TXN.OFFSITE_TRANSPORT` (11.8) has the same squeeze.** Inferred from its 120-character
  option; it renders through a different path (inline prose, not `renderOrphan`) and I did not
  confirm it.
- **Every claim about how the deployment behaves.** See section 5.

---

## 5. Could not determine, and what I got wrong

**The reversion diagnosis was mine and it was wrong.** I told the owner, with confidence, that
pushing to `main` had replaced a production build carrying his UI work. The actual mechanism is
in the directive: I ran `git checkout` in the canonical checkout and left it on
`task/leasefix-2026-08-09` for about three hours, so anything serving from that directory
rendered that tree. I reached for a deployment theory without establishing that production was
ever serving anything other than `main` — and I never checked the reflog of the directory I was
standing in, which would have shown it immediately.

**Two false alarms in one session, both from inferring instead of checking**: this, and the
`oneheader` claim. Both were stated to the owner as fact during an incident.

**Still open:**

- Whether the four commits should be dropped from local `main` (section 1) — needs someone with
  authority over `main`.
- The owner's freeze ruling on `ClauseDocument.tsx` (section 2).
- Whether the Lessor's own-coverage election should gate anything. It currently gates nothing,
  which is deliberate: CCC rides on the *Lessee's* policy, so it stays keyed to the requirement.
- `20260809T2000` being a no-op in the journal (section 3) — left as-is, flagged.
