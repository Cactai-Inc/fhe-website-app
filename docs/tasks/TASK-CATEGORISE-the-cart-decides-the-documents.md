# TASK-CATEGORISE — the cart decides the category, and the category decides the documents

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** It changes which legal documents a person is
required to sign before they set foot on the property. That is the highest-consequence data path in
the product.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-categorise`, branch `task/categorise` ·
report to `docs/reports/TASK-CATEGORISE-REPORT.md` · commit, **do not push** · no subagents ·
migrations dry-run in `BEGIN … ROLLBACK` with the rollback proven, then applied and verified ·
render claims **NOT VERIFIED**. **TEARDOWN:** process census in the report.

⚠️ **WALK2 and WALK3 are driving production.** Coordinate with the orchestrator before applying any
migration — a category change mid-walk makes their findings unattributable.

---

# 1. WHY — this is not a filing nuisance, and it was mis-sized as one

> **Owner, 2026-08-21:** *"the mixed inquiry needs to be fixed so it reads the cart contents and
> everything is properly categorized since that informs the onboarding contents/requirements and we
> need to evolve to that process being fully functional on the user side."*

> *"we need to be able to get to the point where a person has a paid and scheduled purchase with an
> active account and all required documents completed ahead of their initial arrival or ours (when
> its an off-site engagement)."*

**That last sentence is the acceptance criterion for the whole onboarding path.** The category is
not a filter label — **it selects the legal document set a person must execute**, through
`category_document_requirements`:

| category | documents required |
|---|---|
| Guest | COMPANY_POLICIES · FACILITY_RULES · RELEASE_GENERAL |
| Rider | + HUMAN_EMERGENCY_MEDICAL · RELEASE_PARTICIPANT |
| Horse owner | + HORSE_EMERGENCY_VET · RELEASE_HORSE_CARE · RELEASE_PARTICIPANT |

⚠️ **So a mis-categorised inquiry means the WRONG DOCUMENTS ARE ASSIGNED.** Someone who buys a
lesson *and* horse clipping, but is filed under one funnel, signs one set and not the other — and
arrives uncovered. **The orchestrator originally sized this as a staff-filter nuisance. That was
wrong, and the owner corrected it.**

---

# 2. WHAT WAS MEASURED (orchestrator, prod, 2026-08-21) — the good news

**Almost everything needed already exists. This is a convergence, not new machinery.**

- **The cart lines ARE recorded.** `request_selections` (request_id, **offering_id**, offering_slug,
  label, state, …) — **9 rows across 8 requests** in production.
- **The mapping already exists as DATA.** `offerings.segment`, populated for every active SKU:

| segment | service types |
|---|---|
| `rider` | RIDING_LESSON · HORSEMANSHIP_TRAINING |
| `horse` | HORSE_CLIPPING · HORSE_EXERCISE · HORSE_TRAINING |
| `acquisition` | HORSE_EVALUATION · HORSE_FINDER · HORSE_PURCHASE_ASSISTANCE |

- **The derivation already works.** Proven by the orchestrator:
```sql
SELECT rs.request_id, string_agg(DISTINCT o.service_type, ', ')
FROM request_selections rs JOIN offerings o ON o.id = rs.offering_id GROUP BY 1;
```
- **The spine is ALREADY plural.** `provision_client_invitation(p_categories text[])` and
  `apply_category_documents(p_contact_id, p_categories text[])` both take **arrays**.
- **`apply_category_documents` already normalises case and spacing on both sides**
  (`upper(replace(btrim(...),' ','_'))`), so `HORSE_OWNER` matches `Horse owner`.

**So the ONLY defect is upstream:** `requests.category` is a single value chosen from
`state.funnel` — *which page the visitor happened to be standing on* — and **nothing derives
anything from `request_selections`.** `requests_category_check` allows
`general/lessons/horse_care/acquisition/media/partnership/gift` and has no `mixed`.

---

# 3. THE WORK

## §1 — derive the category SET from the cart
An inquiry's categories are computed from its `request_selections` → `offerings.segment`. **A cart
spanning rider and horse yields BOTH.**
⚠️ **Do not add a `mixed` category.** *(Owner-approved option (c).)* "Mixed" is not a category — it
is **more than one** category. A `mixed` value would need its own document set, which is exactly the
wrong shape.
⚠️ **Keep `requests.category` working.** Staff surfaces read it and it is a real check constraint.
Decide and justify: a derived plural column/view beside it, or a lookup. **Do not break the single
column that existing readers depend on** — widen, do not replace.

## §2 — the derived set reaches provisioning
`provision_client_invitation`'s `p_categories` must **default from the request's derived set** when
provisioning from a request, rather than being chosen by hand from the funnel.
⚠️ **Staff must still be able to override.** The derivation is the default, not a cage — a phone
conversation can reveal a need the cart did not contain.

## §3 — prove the documents follow
The end of the chain is the point: **cart → categories → `apply_category_documents` → the exact
document set.**
⚠️ **`apply_category_documents` DELETES requirements outside the wanted set** — the mechanism that
destroyed a boarder's paperwork during `PARTYROLE`. **Prove that widening a person's categories ADDS
documents and never strips ones they already hold**, on a contact who already has requirements.
**This is the single most dangerous thing in this task.**

## §4 — the filters read the derived set
Staff category filters stop reading the single funnel-chosen column and read the derived membership,
so a mixed inquiry appears under **every** category it touches. **A derived filter cannot
under-count** — that is why this option was chosen.

## §5 — state the gap to the owner's end state
The owner's target is *"a paid and scheduled purchase with an active account and all required
documents completed ahead of their initial arrival."* **Report what still stands between today and
that**, in order, without building it. Name what is already true — declaring payment now unblocks
booking (D23), the standing slot exists (D25) — and what does not yet exist.

---

# 4. OUT OF SCOPE
Any UI redesign · the document *contents* · onboarding wording (D25 owns naming) · adding new
categories or document sets · `/sign/*` path categories (already correct — `PATH_CATEGORIES` maps
guest/rider/horse/rider+horse properly; **this task fixes the INQUIRY path, not the direct-link
path**).

# 5. THE TEST THIS MUST PASS
1. **A cart with a riding lesson AND a horse clipping yields BOTH categories**, shown by query from
   `request_selections` alone.
2. **Provisioning that request assigns the union of both document sets** — every template from Rider
   and from Horse owner, listed.
3. **A contact who already holds requirements does not LOSE any** when categories widen. Show
   before/after counts on a real shape.
4. **Existing single-category inquiries behave exactly as before** — no regression on the 8 requests
   that already carry selections.
5. **Staff filtering by horse care finds the mixed inquiry**, and filtering by lessons finds the same
   one.
6. `requests.category` still satisfies its check constraint and every existing reader still works.
7. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (46 red baseline).

# 6. THE REACH
Where staff see an inquiry's categories, and where they override the derived set at provisioning.

# 7. THE TELL
What the client sees telling them which documents they must complete, and what staff see confirming
the right set was assigned.

# 8. REPORT
`docs/reports/TASK-CATEGORISE-REPORT.md`, with **flagged-not-fixed**.
