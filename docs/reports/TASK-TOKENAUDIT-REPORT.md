# TASK-TOKENAUDIT — Report (2026-08-12)

## QUESTION 1 — answered first, as required

**`source_table` / `source_column` are documentation, not the resolution mechanism. No code
path reads them — at merge time or ever.** The 59 dead-source tokens are therefore **not live
broken renders**; the columns are stale provenance notes. Evidence: the only object in the
entire database whose source references `template_tokens` at all is `generate_document`
(query below), and its loop reads **only** `namespace, field, token` — resolution is a
hardcoded CASE ladder keyed on namespace + field name inside the function body
(`SELECT namespace, field, token FROM template_tokens WHERE template_id = v_tmpl.id AND kind <> 'signature'`,
then `v_val := CASE r.field WHEN … END`). The clause engine (`remerge_contract_from_clauses`
→ `token_display_value`) never touches `template_tokens` at all — it substitutes from the
document's `contract_fields` values keyed by token name, with party tokens upserted into
`contract_fields` by `fill_party_fields_from_contacts` and `SIG.*` stamped at signing by
`record_signature`. No TypeScript in `src/` or `api/` reads `template_tokens` either (grep:
zero files) — the picker that will read it is TASK-TEXTEDIT's, not yet built.

```sql
-- the ONLY function referencing template_tokens or source_table:
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.prosrc ilike '%template_tokens%' or p.prosrc ilike '%source_table%');
-- → generate_document          (1 row)
```

A sharper consequence of the same evidence: `generate_document` loops **only template-scoped
rows** (`template_id = v_tmpl.id`). The **190 dictionary rows (`template_id IS NULL`) are read
by nothing today** — they exist purely for the picker. And a token present in a flat template's
body with **no scoped row is never substituted** — it survives into `merged_body` as literal
`{{…}}` text. That mechanism produced the two frozen artifacts in §4.

---

## Baseline (proven)

```sql
select count(*), count(distinct token), count(distinct namespace),
       count(*) filter (where notes is not null and btrim(notes) <> ''),
       count(*) filter (where notes is null or btrim(notes)='')
from template_tokens;
-- 307 | 132 | 13 | 93 | 214     (before this task)
```

```sql
select coalesce(source_table,'(null)'), count(*),
       (to_regclass('public.'||source_table) is not null)
from template_tokens group by 1,3 order by 3 nulls last, 2 desc;
-- dead: transactions 24 · intake 17 · config 7 · horse_records 4 · engagements 3
--       · brand 2 · engagement_parties 1 · client_purchases 1  = 59
-- live: contacts 16 · horses 16 · business_config 9 · config_values 8
--       · documents 4 · template_variants 4  = 57      (191 rows have NULL source)
```

Split: 190 dictionary rows (`template_id IS NULL`) + 117 template-scoped rows across 11 flat
templates (`select (template_id is null), count(*) from template_tokens group by 1` → 117 f / 190 t).

---

## 1. THE HEADLINE — USED-BUT-UNDEFINED is non-empty: 272 tokens, but read the decomposition before alarm

```sql
-- full matrix: defined = template_tokens; used = clause bodies ∪ flat bodies (active/inactive) ∪ field_defs
WITH defined AS (SELECT DISTINCT btrim(token,'{}') tok FROM template_tokens),
clause_used AS (SELECT DISTINCT m[1] tok FROM contract_clause_defs,
  regexp_matches(coalesce(body,''),'\{\{([A-Z0-9_.]+)\}\}','g') m),
flat_active AS (SELECT DISTINCT m[1] tok FROM contract_templates,
  regexp_matches(coalesce(body,''),'\{\{([A-Z0-9_.]+)\}\}','g') m WHERE active AND deleted_at IS NULL),
flat_inactive AS (SELECT DISTINCT m[1] tok FROM contract_templates,
  regexp_matches(coalesce(body,''),'\{\{([A-Z0-9_.]+)\}\}','g') m WHERE NOT active OR deleted_at IS NOT NULL),
fkeys AS (SELECT DISTINCT field_key tok FROM contract_field_defs)
SELECT … ;
-- USED (defined ∩ used):        86
-- DEFINED-BUT-UNUSED:           46
-- USED-BUT-UNDEFINED:          272
```

(`api/` contributes **zero**: email bodies are TS template literals; the only `{{…}}` in
`api/` are two comments in `_lib/email.ts`. The footer is built programmatically from
`config_values`, not by token merge.)

**The 272 decompose into three very different severities:**

| bucket | count | what it means |
|---|---|---|
| Field-keys of the clause engine | **213** | `contract_field_defs.field_key` values ARE the tokens in clause bodies (all 667 rows are dotted names). They carry their own label/guidance/type in `contract_field_defs` — a parallel, healthier dictionary. **Not dangerous; but it means the picker has TWO vocabularies to draw from** (see §6 recommendation). |
| In an ACTIVE body, no row anywhere | **35** | All 35 resolve through mechanisms that don't need a `template_tokens` row: 10 BUYER/SELLER.* party tokens (filled into `contract_fields` by `fill_party_fields_from_contacts`), 16 `SIG.*.*` stamps (`record_signature` at signing), and **9 in MINOR_RIDER — the one real defect, next paragraph.** |
| Only in INACTIVE flat bodies | **24** | HORSE_LEASE / HORSE_PURCHASE_SALE / HORSE_SALE_TRANSFER / RELEASE_HORSE_EXERCISE leftovers. Harmless while those templates stay off. |

**The one live landmine: `MINOR_RIDER` is ACTIVE with a 5,481-byte body and ZERO scoped token
rows.** If anyone generates from it, **every one of its 26 tokens renders as literal `{{…}}`
text** (the per-template gap query below returned gaps ONLY for MINOR_RIDER; every other
active flat template is fully covered). No document has ever been generated from it
(`select count(*) from documents d join contract_templates ct on ct.id=d.template_id where template_key='MINOR_RIDER'` → 0),
and `docs/TOKEN_DICTIONARY.md` line 192 says it was **retired** — the table disagrees with the
doc. **Recommendation: deactivate it (owner call; retirement = boolean, not delete).**

```sql
-- per-active-template: body tokens with no scoped row → only MINOR_RIDER rows return (26)
WITH body_toks AS (SELECT ct.id, ct.template_key, m[1] tok FROM contract_templates ct,
  regexp_matches(coalesce(ct.body,''),'\{\{([A-Z0-9_.]+)\}\}','g') m
  WHERE ct.active AND ct.deleted_at IS NULL AND length(coalesce(ct.body,''))>100)
SELECT b.template_key, b.tok FROM body_toks b
LEFT JOIN (SELECT template_id, btrim(token,'{}') tok FROM template_tokens WHERE template_id IS NOT NULL) s
  ON s.template_id=b.id AND s.tok=b.tok WHERE s.tok IS NULL;
```

## 2. USED — 86 defined tokens that appear in a live body or field set

All 17 CLIENT.\*, all scoped HORSE.\*, ORG.LEGAL_NAME/EMAIL/PRINCIPALS, DOC.EFFECTIVE_DATE,
PARTICIPANT.\*, DIR.\*, SIG.CLIENT.\*, the ENG/TXN tokens on the retainer/representation
bodies, and the TXN deal fields shared with the clause engine (LEASE_\*, PURCHASE_PRICE,
DEPOSIT_AMOUNT, DELIVERY_\*, PERMITTED_ACTIVITIES, RENEWAL_TERMS, COMPETITION_EXPENSES).
Full list: derived from the matrix query above (`defined AND (clause ∪ flat ∪ fielddefs)`).

## 3. DEFINED-BUT-UNUSED — 46 tokens no body references

The full list (same matrix, `defined AND NOT used`):

- **PARTY.\* (7)** — the generic party namespace. Nothing uses it; bodies use role-named
  namespaces. Notes now steer the owner to CLIENT/PARTICIPANT/LESSOR/… equivalents.
- **FHE.\* (7)** — older twins of ORG.\*. Resolve identically in the merge CASE
  (`namespace IN ('ORG','FHE')`); no body uses FHE. Notes steer to ORG.\*.
- **REQ.\* (4) + ENG intake fields (8 of the 17)** — designed for order/intake capture that
  was never built; they also render blank (CASE ELSE `''`). Dead weight in a picker.
- **Order-form fee tokens (7)**: TXN.PACKAGE_FEE, SESSION_FEE, MONTHLY_FEE, OTHER_FEES,
  EVALUATION_FEE, ADDITIONAL_SERVICES, JUMPER_TRAINING_FEE — their order-form templates no
  longer exist as bodies.
- **DOC.GENERATED_DATE, DOC.ID, DOC.UUID, ORD.UUID, ORD.SERVICE_SELECTION, ENG.ID,
  ENG.SERVICE_TYPE, ENG.START_DATE, HORSE.OWNER_NAME, CLIENT.JUMP_LIMITATIONS** and the
  unseeded ORG numbers (INVOICE_DUE_DAYS, TERMINATION_NOTICE_DAYS, LATE_FEE, PHONE, URL,
  ADDRESS, ENTITY_FORMATION, REGISTERED_AGENT) — defined and resolvable (mostly), just not
  placed in any current body.

None deleted; all have honest notes. Which ones exit the picker is the owner's call.

## 4. Production evidence: literal `{{…}}` already exists in merged bodies — almost all benign

```sql
select ct.template_key, d.status, m[1], count(distinct d.id)
from documents d left join contract_templates ct on ct.id=d.template_id,
     regexp_matches(d.merged_body,'\{\{([A-Z0-9_.]+)\}\}','g') m
where d.merged_body like '%{{%' group by 1,2,3;
```

- **Benign by design:** every `SIG.*.*` leftover on DRAFT / AWAITING_SIGNATURE / VOID docs —
  signature placeholders are intentionally left for `record_signature` to stamp.
- **Two frozen artifacts (report-only, SIGNING FREEZE):** two EXECUTED docs from
  **2026-07-10** carry literal `{{CLIENT.EMERGENCY_CONTACT_2_*}}` / `{{HORSE.MICROCHIP}}` /
  `{{HORSE.FARRIER_*}}` etc. (one HORSE_EMERGENCY_VET, one RELEASE_HORSE_CARE). They were
  generated **before** those scoped rows existed; today's rows cover every one of those
  tokens, so new generations fill them. The executed bodies are evidence and stay as they are.

## 5. The 59 dead-source tokens — recommendation per group, NONE deleted

Full 59-row list proven by:
```sql
select tt.namespace||'.'||tt.field, tt.source_table||'.'||tt.source_column
from template_tokens tt
where tt.source_table is not null and to_regclass('public.'||tt.source_table) is null;
-- 59 rows
```

Because of Q1, "dead source" ≠ "broken token". Sorted by what should happen to the row:

| group (pointer) | tokens | live behavior | recommendation |
|---|---|---|---|
| `config.*` (7): ENG.PROTECTION_PERIOD† · FHE.ADDRESS/LEGAL_NAME/SIGNATORY_NAME/SIGNATORY_TITLE · TXN.COMMISSION_MIN/COMMISSION_RATE | 7 | Commission pair + FHE identity resolve fine from `business_config`; †PROTECTION_PERIOD renders blank (ENG ELSE) | **RE-POINT the documentation** to `business_config` (commission/FHE) when a write beyond `notes` is next authorized; PROTECTION_PERIOD joins the intake group below |
| `brand.*` (2): FHE.EMAIL/PHONE | 2 | Resolve fine from `config_values` CONTACT keys | RE-POINT documentation to `config_values` |
| `engagements.*` (3): ENG.ID/SERVICE_TYPE/START_DATE | 3 | Resolve fine from the CONTRACT (mapped in `generate_document`) | RE-POINT documentation to `contracts` |
| `engagement_parties` (1): PARTY.RELATIONSHIP | 1 | Would read `document_parties.relationship`; unused | RE-POINT documentation to `document_parties`; owner rules whether PARTY.\* stays in the picker at all |
| `client_purchases` (1): ORD.SERVICE_SELECTION | 1 | Resolves fine from `purchase_items.label` | RE-POINT documentation to `purchase_items` |
| `horse_records.*` (4): HORSE.MEDICATION_\* | 4 | Resolve fine from the `horse_medications` composers | RE-POINT documentation to `horse_medications` |
| `intake.*` (17): ENG intake ×13 + REQ ×4 | 17 | **Always render blank** — the capture was never built | **BUILD-OR-RETIRE (owner):** keep only the ones a future intake will feed; hide the rest from the picker. Notes already say "do not place". |
| `transactions.*` (24) — deal fields shared with the clause engine: LEASE_\* ×4, PURCHASE_PRICE, DEPOSIT_AMOUNT, DELIVERY_\* ×2, PERMITTED_ACTIVITIES, RENEWAL_TERMS, COMPETITION_EXPENSES | 11 | **Fill from `contract_fields`** on clause-built contracts (same token string = the field_key) | KEEP; RE-POINT documentation to `contract_fields` |
| `transactions.*` — retainer/rep money: RETAINER_FEE, SUCCESS_FEE, REPRESENTATION_FEE, PAYMENT_TERMS | 4 | In the ACTIVE retainer/representation bodies but **render blank** — no working-copy field feeds those flat templates (`contract_field_defs` covers only clause templates; 0 documents exist on either) | **WIRE BEFORE USE** — these two templates cannot produce a complete agreement today; flagged in notes |
| `transactions.*` — retired order-form fees: PACKAGE_FEE, SERVICE_FEE, PAYMENT_SCHEDULE, SESSION_FEE, MONTHLY_FEE, OTHER_FEES, EVALUATION_FEE, ADDITIONAL_SERVICES, JUMPER_TRAINING_FEE | 9 | Blank + unused (SERVICE_FEE/PAYMENT_SCHEDULE only in the phantom MINOR_RIDER body) | **RETIRE-CANDIDATE** (hide from picker), owner rules |

Also found while validating (live tables, dead **columns**):
`horses.owner_name` (HORSE.OWNER_NAME — column does not exist, token renders blank),
`horses.barn_name` (HORSE.BARN_NAME — real column is `nickname`; the token resolves fine
because the code reads `nickname`), and `contacts.first_name/last_name` (deliberate composite
notation, fine). Report-only.

## 6. Duplicate wiring — for the owner to rule on, not resolved

1. **`{{PARTY.FULL_NAME}}` vs `{{PARTY.PRINTED_NAME}}`** — identical output (both
   `first_name || ' ' || last_name`), and the same twinning exists as CLIENT.FULL_NAME /
   CLIENT.PRINTED_NAME **which IS used**. Both may be legitimate: body-text name vs
   signature-line name. Notes state the identity and the convention; survival is your call.
2. **`{{TXN.PACKAGE_FEE}}` vs `{{TXN.SERVICE_FEE}}`** — both pointed at
   `transactions.service_fee` (gone). Both render blank and neither is used by a live body.
   Pure legacy twins; one name should survive if the concept returns.
3. **`{{DOC.UUID}}` vs `{{ORD.UUID}}` → both `documents.id` — FLAGGED LOUDLY.** The mapping
   and the merge code agree: `ORD.UUID` prints the **document's** UUID. Either the name is
   wrong (it's a DOC token wearing an ORD name) or the mapping is (it should print the
   purchase id / PUR-code — which currently has **no token at all**). Unused by any body
   today, so nothing breaks either way, but the picker note now carries a warning so it can't
   be placed in good faith expecting an order number.
4. **Not duplicates (per task):** the `config_values.value_text/value_num` groups and
   `template_variants.token_overrides` resolve by key — many tokens per column is correct.
5. **FHE.\* vs ORG.\* (7 pairs)** — same CASE arm resolves both namespaces identically.
   FHE is unused everywhere; notes steer to ORG. Retiring FHE.\* from the picker is the
   obvious move, but it is a ruling, not done.

## 7. TOKEN_DICTIONARY.md vs the table — where the claim and the truth disagree

- **MINOR_RIDER**: doc says retired (line 192); table says `active = true`. The table is the
  truth of what can be generated — and generating it produces literal tokens. Deactivation
  recommended (§1).
- **ORD.UUID**: doc says "resolves from purchases.id"; table + code say `documents.id`. The
  doc describes the intent, the code the behavior — owner ruling requested (§6.3).
- **CLIENT.\* autofill**: doc says "from the profiles table"; live path is
  `document_parties → contacts`. (The doc's own 2026-07-27 correction already half-admits
  this.)
- **ENG.ID format**: old note said `ENG-YYYY-NNNNNN`; live value is the contract's
  `CTR-000101` style. Fixed in the new notes.
- **HORSE.AGE_DOB**: doc/note said "age or DOB"; the code always prints the DOB. Fixed.
- **CLIENT.EUTHANASIA_INITIALS** exists in the doc but has **no row** in `template_tokens`
  and appears in no body — doc-only ghost.
- The doc's TXN sections still describe the retired flat purchase/sale/transfer/lease
  templates; the clause engine's 667 field_keys (the real current vocabulary) are absent from
  it. The doc needs a rewrite **after** the owner rules on §5/§6 — not attempted here.

## 8. What was changed (the whole diff)

**One migration: `supabase/migrations/20260812T1500_tokenaudit_notes.sql`** — a single
`UPDATE template_tokens … SET notes` from a 132-entry VALUES list keyed `(namespace, field)`,
so every scoped row shows the same explanation as its dictionary row. Dry-run in
`BEGIN;…ROLLBACK;` (`UPDATE 307`, 0 blank), applied with `psql -1`, verified:

```sql
select count(*), count(*) filter (where notes is not null and btrim(notes)<>''),
       count(*) filter (where notes is null or btrim(notes)='') from template_tokens;
-- 307 | 307 | 0
```

All 93 pre-existing notes were reviewed against the live merge path and rewritten into the
same owner-language format (what it prints + example · when it goes blank · which twin to
prefer); the materially wrong ones are itemized in §7. Real production values are used for
business-identity examples (French Heritage Equestrian, 858-439-3614, $500.00 minimum,
Beaumont de Cactai); client-personal examples are format-true placeholders, **not** real
client data — `template_tokens` is readable by every authenticated user, so real PII does not
belong in its notes.

No other column, table, or code was touched. `git diff` = this migration + this report.

## 9. Open items for the owner (nothing actioned)

1. Deactivate MINOR_RIDER? (doc says retired, table says active, generating it breaks)
2. ORD.UUID — rename to a DOC alias, or re-map to the purchase and mint a real order-number
   token?
3. PARTY.\* and FHE.\* — hide from the picker?
4. The 9 retired order-form fee tokens + 17 intake tokens — hide, or hold for the rebuild?
5. Retainer/representation money tokens — wire working-copy fields before first real use.
6. **D13 note:** token descriptions now live in `template_tokens.notes`, but the only editor
   today is SQL. TASK-TEXTEDIT's picker READS them; an admin surface that EDITS them is not
   yet specified anywhere. Until one ships (or is explicitly named as a follow-up), this
   dictionary is developer-maintained — flagged per D13 rather than called finished.
7. The stale `source_table`/`source_column` re-pointing (§5) — documentation-only writes,
   deliberately outside this task's write scope.
