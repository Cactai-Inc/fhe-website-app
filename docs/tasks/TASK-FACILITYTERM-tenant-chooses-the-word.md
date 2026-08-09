# TASK FACILITYTERM — the tenant picks what to call their place

Owner, 2026-08-08:

> "The term barn, ranch, stables, grounds, facility (and possibly others) all need to be
> written as a list for the tenant owner to select during provisioning based on their use
> case. The single selection then populates the usage throughout the system. From a code
> perspective that means we need to find a universal term to replace barn with in the code,
> and then the tenant's selection is purely for user-facing usage."

**FHE is a stable at a ranch, not a barn.** Today the app says "barn" throughout, which is
wrong for this tenant and would be wrong for many others.

---

## The shape

1. **One internal term** in code, schema, routes and identifiers — never shown to a user.
2. **One tenant selection**, made at provisioning, stored on the organization.
3. **Every user-facing string** renders the tenant's word.

## Scope: 160 mentions across 45 files

Including a whole route family — `ops/barnops`, `BarnopsHubPage`, `ResourcesPage`,
`ConsumptionLogPage`, `AllocationRulesPage` — and the nav item **"Barn Ops"**.

## DO NOT SWEEP BLINDLY — two meanings share the word

| usage | verdict |
|---|---|
| **"Barn name"** — a horse's everyday name, as opposed to its registered name | **LEAVE IT. Not the facility.** Standard equestrian term, correct in every tenant's vocabulary. `HorseIntakeForm.tsx`, `StableEditors.tsx`, `HorseForm.tsx`, `HorseTable.tsx`. |
| **"Barn A" / "Stable B"** — a physical structure prefix in a horse's location | **LEAVE IT.** It names a building on the property, not the business. `HorseIntakeForm.tsx` `PrefixSelect prefixes={['Barn','Stable']}` |
| **"another barn"** — a different facility, generically | Judgement. Industry-generic, probably fine. |
| **"Saw the barn nearby"** — intake source option | **CHANGE.** Calls FHE a barn. |
| **"Barn Ops"** nav item + the `barnops` route family | **CHANGE.** Names FHE's own operation. |

**The test: does the word name a BUILDING or a generic industry thing (keep), or does it name
THIS BUSINESS (make it the tenant term)?**

A find-replace fails this task. Every one of the 160 has to be read.

## The internal term — pick one, then never vary

**Recommendation: `facility`.** It is the most neutral of the candidates and reads correctly
in code: `facility_term`, `facilityLabel`, `mod.facility_ops`, `ops/facility`.

The catch: `facility` is also one of the user-facing choices, so `facility` may mean both the
internal concept and one tenant's chosen word. **Tolerable if the internal use is never
rendered**, but flag it and take the owner's call — the alternative is `site`, which avoids
the collision but competes with "site" meaning the public website (`container-site`, the SEO
helpers).

Do **not** use `location`: `locations` already exist as a distinct concept
(`_resolve_location`, `add_contact_location`) and conflating them would be a real bug.

## The grammar problem — this is the part that will bite

The options are **not grammatically interchangeable**:

| term | article | number | reads as |
|---|---|---|---|
| barn | *the* barn | singular | "at the barn" |
| ranch | *the* ranch | singular | "at the ranch" |
| **stables** | *the* stables | **plural in form** | "at the stables" |
| **grounds** | *the* grounds | **plural in form** | "on the grounds" |
| facility | *the* facility | singular | "at the facility" |

So a single noun substitution produces "at the stables is closed" and similar. **Store more
than the noun.** Minimum viable shape:

```
{ term: 'stables', article: 'the', plural: true, preposition: 'at' }
```

Then copy is written against the shape, not concatenated around a bare noun. Where a sentence
cannot survive substitution, **rewrite the sentence** to avoid the construction rather than
adding special cases.

## Where the selection lives

`organizations` has **no settings column today** — `id, display_code, name, slug, status,
company_contact_id, timestamps`. Tenant config resolves through `src/lib/brand.ts`
(`resolveBrand(cfg)`), which already takes a `Record<string,string>`.

**Follow that seam** rather than inventing a second config path. Confirm where `resolveBrand`
gets its `cfg` from and extend that, so the facility term arrives the same way the rest of the
tenant's branding does.

Set at **provisioning**, editable afterwards by the tenant owner in the settings surface.

## Open questions — ASK, do not guess

1. **What is the full list?** The owner named barn, ranch, stables, grounds, facility and
   said "possibly others". Farm, equestrian centre, yard (British), stable (singular),
   riding school, arena? **Get the final list from the owner.**
2. **Is there a fallback** for a tenant who has not chosen? Recommend `facility` — neutral,
   never wrong, just bland.
3. Does the term ever appear in **outbound email**, contracts or PDFs? If so it must render
   there too, and contract wording is legally reviewed — check before touching document text.

## Verification

1. Every user-facing string uses the tenant's word. Zero hardcoded "barn" in UI copy.
2. "Barn name" and building prefixes are **untouched** — verify by diff, not by search.
3. Switching an org's term changes every surface with no code change and no redeploy.
4. Plural terms (`stables`, `grounds`) read correctly in every sentence they appear in —
   walk them, do not assume.
5. Typecheck, lint, build clean.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-facilityterm`.
  **Never `~/Desktop`.**
- **Do not rename database columns** carrying `barn` as a horse attribute — that is the
  horse's name, not the facility.
- `ClauseDocument.tsx` is FROZEN; contract wording is not swept by this task.
- Coordinate on `AppLayout.tsx` — `TASK-ONEHEADER` holds it.

## Reporting

`docs/reports/TASK-FACILITYTERM-REPORT.md`. Include the full classified list of all 160
mentions with keep/change and the reason for each.
