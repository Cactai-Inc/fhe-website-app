# TASK TOKENAUDIT — every token gets a definition, and the dead wiring gets named

**Owner, 2026-08-12:**

> *"what i need is the list of tokens to be made visible to select from, alongside each one i
> need a description/definition so i know if im picking the right one, and this will be a good
> exercise for you to hand off because an audit is long overdue on those. and it will surface
> duplicate pages with almost duplicate wiring"*

**`TASK-TEXTEDIT` builds the token picker. This makes the picker worth using** — a list of 307
tokens with no descriptions is a list you cannot pick from.

---

# MEASURED IN PRODUCTION, 2026-08-12

```
template_tokens        307 rows · 132 distinct tokens · 13 namespaces
  with a description    93
  WITHOUT              214      <- the picker would show these with nothing to explain them
```

## ⚠️ 59 tokens point at tables that DO NOT EXIST

```
transactions        24   <- on CLAUDE.md's RETIRED list
intake              17
config               7
horse_records        4
engagements          3   <- RETIRED
brand                2
engagement_parties   1
client_purchases     1   <- RETIRED
                    ──
                    59

live sources:  contacts 16 · horses 16 · business_config 9 · config_values 8
               documents 4 · template_variants 4   =  57
```

**More token wiring points at dead tables than live ones.**

## Duplicate wiring — the owner predicted it and it is there

| tokens | shared source | note |
|---|---|---|
| `{{PARTY.FULL_NAME}}` · `{{PARTY.PRINTED_NAME}}` | `contacts.first_name/last_name` | two names, same output |
| `{{TXN.PACKAGE_FEE}}` · `{{TXN.SERVICE_FEE}}` | `transactions.service_fee` | **and that table is gone** |
| `{{DOC.UUID}}` · `{{ORD.UUID}}` | `documents.id` | **an ORDER token resolving to a DOCUMENT id** |

**Not duplicates — do not report them as such:** the `config_values.value_text` /
`value_num` groups and `template_variants.token_overrides`. Those resolve **by key**, so many
tokens legitimately share one column.

---

# QUESTION 1 — ANSWER THIS FIRST, EVERYTHING ELSE DEPENDS ON IT

**Is `source_table` / `source_column` how a token actually RESOLVES at merge time, or is it
documentation of where the value came from?**

- **If it is the resolution mechanism**, those 59 tokens are **live broken renders** and this is
  a defect report, not a cleanup.
- **If resolution happens elsewhere** — in `fill_party_fields_from_contacts`, in
  `compose_field_prose`, in `remerge_contract_from_clauses`, or by namespace in code — then
  `source_table` is stale documentation and the severity is completely different.

**Read the merge path and establish this before writing anything else.** **Do not assume
either.** The orchestrator deliberately did not claim these are broken, because this question was
unanswered — and this codebase has repeatedly punished the plausible assumption.

**State the answer in the first paragraph of the report.**

---

# QUESTION 2 — WHICH TOKENS ARE ACTUALLY USED?

A token defined in `template_tokens` and referenced by no template body is dead weight in the
picker.

**Cross-reference the 132 distinct tokens against what actually appears in:**

- `contract_clause_defs` (clause bodies)
- `contract_field_defs`
- `contract_templates.body` (the 14 flat templates)
- the hardcoded email bodies in `api/`

**Produce three lists: USED · DEFINED-BUT-UNUSED · USED-BUT-UNDEFINED.**

**The third is the dangerous one** — a token appearing in a template body with no
`template_tokens` row is one nobody can look up, and it will render as literal text or blank.
**If any exist, that is the headline finding.**

---

# THE DELIVERABLE — a description for every token

**One line per token, in the owner's language, not the schema's.** He is choosing between
`{{PARTY.FULL_NAME}}` and `{{PARTY.PRINTED_NAME}}` in an editor and needs to know which one to
pick.

Each description says:

1. **What it produces** — the actual rendered value, with a real example from production where
   one exists. `{{PARTY.ADDRESS}}` → *"the party's address on one line — 12 Main St, Carmel CA
   93923"*.
2. **When it resolves and when it does not.** `party_scoped` tokens mean nothing where there is
   no party context. **Say so per token** — this is what stops the owner putting a token
   somewhere it renders blank.
3. **Which to prefer** where two overlap, and why.

**Write them into `template_tokens.notes`** — the column exists and 93 rows already use it.
**Do not create a second description store**, and do not put the descriptions only in a markdown
file: the picker reads the table.

**`docs/TOKEN_DICTIONARY.md` is the behavioural contract** — read it, reconcile against it, and
report where the table and that document disagree. **Where they conflict, the database is the
truth and the doc is the claim.**

---

# WHAT TO FIX vs WHAT TO REPORT

**FIX:** the missing descriptions. That is the deliverable.

**REPORT, DO NOT FIX:**

- The 59 dead-source tokens. **Whether they are deleted, re-pointed or left depends on
  Question 1**, and on whether they are used — which is Question 2. **Deleting a token that a
  live template body references would break that template.**
- The duplicate pairs. Which survives is the owner's call; both may be legitimate if they
  render differently.
- `{{ORD.UUID}}` → `documents.id`. **Flag this loudly** — either the mapping is wrong or the
  name is, and both are worth knowing.
- Anything in the USED-BUT-UNDEFINED list.

**Deleting nothing is deliberate. 61 EXECUTED documents were merged using these tokens**, and
while their `merged_body` is a frozen snapshot, the token set is how the next one gets built.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-tokenaudit`, branch `task/tokenaudit`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **Writes are limited to `template_tokens.notes`.** No other column, no other table, no code.
  If you believe something else must change, **report it**.
- **Do not restructure `template_tokens`.** The owner's constraint stands: the tool fits the
  architecture.
- **THE SIGNING FREEZE IS IN FORCE.** **61 EXECUTED documents are evidence and are never
  rewritten.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify.
- **`test:db` is broken** (55 of 64 files failing) — **do not cite it as proof.** Verify against
  production with direct SQL.
- **Every count you state must be proven with the query that produced it**, pasted in the report.

# THE TEST THIS MUST PASS

1. **All 307 rows have a description** written in plain language, and the 93 existing ones were
   reviewed rather than assumed correct.
2. Question 1 is answered in the report's first paragraph, with the merge-path evidence.
3. Three usage lists produced; **USED-BUT-UNDEFINED is called out first if it is non-empty**.
4. The 59 dead-source tokens are listed with a recommendation each — **and none is deleted**.
5. The duplicate pairs are presented for the owner to rule on, not resolved unilaterally.
6. `git diff` shows **one migration writing `notes`, and no code**.

Report to `docs/reports/TASK-TOKENAUDIT-REPORT.md`.
