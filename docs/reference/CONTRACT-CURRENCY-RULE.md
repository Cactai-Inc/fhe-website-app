# Live documents must carry current template content

**Owner ruling, 2026-08-10:**

> *"i need the contracts to all be updated to the newest content. any selections that are at
> risk can be cleared and removed without consequence. the real consequence is someone signing
> an outdated contract."*

**This outranks preserving field selections.** A cleared dropdown is an inconvenience. An
executed contract carrying superseded terms is the failure this rule exists to prevent.

---

## The gap: nothing recomposes automatically

A template's content lives in two places depending on the template:

| model | templates | content lives in |
|---|---|---|
| **clause-composed** | `HORSE_LEASE_V2`, `HORSE_SALE_V2`, `HORSE_BILL_OF_SALE` | `contract_clause_defs` rows |
| **markdown body** | the onboarding set — `HORSE_EMERGENCY_VET`, `RELEASE_*`, `COMPANY_POLICIES`, `FACILITY_RULES`, `HUMAN_EMERGENCY_MEDICAL` | `contract_templates.body` |

**Changing either does NOT update existing documents.** A document's `merged_body` is composed
once and then frozen until something explicitly recomposes it.

**Verified 2026-08-10.** The three live leases are current only because a remerge was run after
the clause changes. The two awaiting-signature onboarding documents are current only because
they happened to be composed after their template last changed. **Neither is a mechanism.**

## The state that made this urgent

```
3 HORSE_LEASE_V2   awaiting sig  composed 2026-08-11  clauses changed 2026-08-09   current
2 onboarding docs  awaiting sig  composed 2026-08-04  bodies  changed 2026-08-02   current
6 onboarding docs  DRAFT         composed 2026-07-26  bodies  changed 2026-08-02   STALE
```

The six stale drafts are delete-and-recreate churn artifacts and are regenerated on the
owner's next onboarding entry, so they are not signable while stale. **Nothing signable is
outdated today.**

**CORRECTED 2026-08-10 — the orchestrator overstated the urgency here.** The original text
warned that the euthanasia rewrite would leave `fb6abc6c` awaiting signature on superseded
content. That document belongs to **`cjzigs@icloud.com`, the owner's own test identity** (D1).
The owner caught it: *"the one awaiting signature is likely not valid anyway, its either for
Mary or for a test case."*

**Verified: not one AWAITING_SIGNATURE document belongs to an external client.** Two are on
`cjzigs@`; the three leases are anchored to the company contact `hello@fhequestrian.com`.

**The rule below is unaffected — it is an owner requirement, not a response to an incident.**
What changes is the framing: there is no live client exposure today, so this is a mechanism to
build before real volume, not a fire. Do not cite a test document as evidence of client risk.

---

## THE RULE — applies to every thread that changes template content

**Any change to `contract_clause_defs`, `contract_field_defs` or `contract_templates.body` is
not complete until every live unsigned document on that template has been recomposed.**

1. **Recompose** every `DRAFT` and `AWAITING_SIGNATURE` document on the affected template.
   Clause-composed templates use `remerge_contract_from_clauses`. Markdown templates
   regenerate from the body.
2. **Clearing invalid selections is authorised.** A field value that no longer maps to a valid
   option is dropped. The owner has ruled the risk acceptable and the alternative worse.
3. **EXECUTED documents are never recomposed.** 61 of them. They are evidence of what was
   signed, and rewriting them would falsify that. `signed_template_version` is never edited.
4. **Prove it in the report** with the query below, showing zero stale rows afterwards.

## The check — run it after any template change

```sql
-- clause-composed templates
WITH tpl AS (
  SELECT template_key, max(created_at) AS last_change
  FROM contract_clause_defs GROUP BY 1
)
SELECT left(d.id::text,8) AS doc, t.template_key, d.status,
       d.updated_at, tpl.last_change,
       CASE WHEN tpl.last_change > d.updated_at THEN 'STALE' ELSE 'current' END AS verdict
FROM documents d
JOIN contract_templates t ON t.id = d.template_id
JOIN tpl ON tpl.template_key = t.template_key
WHERE d.deleted_at IS NULL AND d.status IN ('DRAFT','AWAITING_SIGNATURE')
ORDER BY verdict;
```

For markdown-body templates, compare `d.updated_at` against
`coalesce(contract_templates.updated_at, created_at)` for the same `template_id`.

**A template change that leaves a STALE row is an incomplete change, not a finished one.**
