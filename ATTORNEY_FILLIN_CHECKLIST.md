# Attorney Fill-In Checklist — Contracts Legal Pass

Every placeholder, pending decision, and deferred item from the Contracts Legal Pass,
with **where each value lives** so counsel's final wording can be applied by editing
data (config), not code. The business is a **sole proprietorship doing business as
"French Heritage Equestrian"**; the signor is **Charles Zigmund**; the defined term
for the business side in every contract is **COMPANY**.

## 1. Identity wording (PLACEHOLDER — attorney must confirm exact wording)

| Item | Current (seeded placeholder) | Where it lives |
| --- | --- | --- |
| Party-block legal identity clause (`{{ORG.LEGAL_IDENTITY}}`) | `Charles Zigmund, an individual doing business as French Heritage Equestrian, a sole proprietorship` | `config_values` namespace `ORG`, key `LEGAL_IDENTITY` (EAV — deliberately NOT a typed column) |
| Legal/trade name (`{{ORG.LEGAL_NAME}}`, letterhead/titles) | `French Heritage Equestrian` | `business_config.legal_entity_name` |
| Signatory name (`{{ORG.SIGNATORY_NAME}}`) | `Charles Zigmund` (seed explicitly overwrote the prior known-bad value `French Heritage Equestrian`) | `business_config.signatory_name` |
| Signatory title (`{{ORG.SIGNATORY_TITLE}}`) | `Owner, Sole Proprietor` — PLACEHOLDER pending attorney | `business_config.signatory_title` |
| Entity formation (`{{ORG.ENTITY_FORMATION}}`) | `Sole proprietorship (California)` — PLACEHOLDER pending attorney | `business_config.entity_formation` |
| Registered agent (`{{ORG.REGISTERED_AGENT}}`) | UNSET | `business_config.registered_agent` |

## 2. Business address disclosure — DECISION NEEDED

The website deliberately omits the mailing address (migration 20 note). Counsel must
decide whether contracts should disclose a business address.
- Where it lives: `business_config.business_address` (renders via `{{ORG.ADDRESS}}`);
  currently NULL → merges blank.

## 3. Company countersignature blocks — ADDED, attorney may strike

`HORSEMANSHIP_TRAINING` and `HUMAN_EMERGENCY_MEDICAL` previously had **no** company
countersignature block; the legal pass ADDS one to each (shared shape:
`COMPANY: {{ORG.LEGAL_NAME}}` / `{{SIG.COMPANY.NAME}}` / `{{ORG.SIGNATORY_NAME}}` /
`{{ORG.SIGNATORY_TITLE}}` / `{{SIG.COMPANY.DATE}}`). Attorney can strike if a
countersignature is not desired on authorizations.
- Where it lives: template bodies in `supabase/contract_templates/` (source of truth),
  loaded by `supabase/migrations/20260629100000_load_contract_bodies.sql` (regenerated
  by `scripts/build-template-load-migration.mjs`).

Note: `HORSE_LEASE`, `HORSE_PURCHASE_SALE`, `HORSE_SALE_TRANSFER` keep their
"(IF APPLICABLE)" company signature structure — there the company is a disclosed
third party (broker), not a principal.

## 4. Dispute-resolution election

- Standardized to a visible election `□ Arbitration / □ Litigation` in the templates
  that had a variant label. No data home yet (intake table lands in Wave-7) — the
  election is made on the signed document itself.
- **HORSE_LEASE anomaly (flagged for counsel):** it is arbitration-ONLY (no
  litigation option) and carried a `Venue: San Diego, California` line. The venue
  line was normalized to `San Diego County, California`; counsel should confirm the
  arbitration-only posture and the venue wording.
- Where it lives: template bodies in `supabase/contract_templates/`.

## 5. Cancellation-policy wording — NEW STANDARD PARAGRAPH, attorney reviews

`MINOR_RIDER` (empty CANCELLATION POLICY section) and `RIDER_LESSON_JUMPER` (bare
"Cancellation Policy:") received a standard tokenized paragraph: cancellation requires
`{{ORG.CANCELLATION_NOTICE_HOURS}}` hours notice; late-cancellation fee
`{{ORG.CANCELLATION_FEE}}`; no-show fee `{{ORG.NO_SHOW_FEE}}`. Wording is ours, not
counsel's — review required.

## 6. Policy numbers — UNSEEDED, owner fills

These render blank until set (whitelisted in `config_keys`; resolve via the generic
`ORG` EAV fallback in `generate_document` v5):

| Token | Where it lives |
| --- | --- |
| `{{ORG.INVOICE_DUE_DAYS}}` ("Invoices are due within … days") | `config_values` ns `ORG`, key `INVOICE_DUE_DAYS` (value_num) |
| `{{ORG.CANCELLATION_NOTICE_HOURS}}` ("Cancellation notice of … hours") | `config_values` ns `ORG`, key `CANCELLATION_NOTICE_HOURS` (value_num) |
| `{{ORG.TERMINATION_NOTICE_DAYS}}` ("terminate upon … days written notice") | `config_values` ns `ORG`, key `TERMINATION_NOTICE_DAYS` (value_num) |

## 7. Unfilled business_config columns (owner/attorney to supply)

All in table `business_config` (per-org row; tenant #1 = FHE):

- `cancellation_fee`, `late_fee`, `no_show_fee` — render via `{{ORG.CANCELLATION_FEE}}`
  / `{{ORG.LATE_FEE}}` / `{{ORG.NO_SHOW_FEE}}` (fmt_money; blank until set)
- `travel_fee_method` (`FLAT`/`MILEAGE`/`TIME`) + `travel_fee_amount`
- `protection_period` (representation protection window, `{{ENG.PROTECTION_PERIOD}}`)
- `sales_tax_rate`
- `document_retention` (e.g. "7 years")
- `esignature_provider`
- `registered_agent`, `business_address` (see §1/§2)

## 8. Commission — CONFIRMATION NEEDED

Confirm the seeded commission terms: **15%** rates
(`business_config.commission_purchase_rate` / `commission_sale_rate` /
`commission_lease_rate`, seeded by `20260629140000_seed_pricing.sql`) and minimum
**$500** (`business_config.commission_min`). Render via `{{TXN.COMMISSION_RATE}}` /
`{{TXN.COMMISSION_MIN}}`.

## 9. Money blanks with no pricing model yet (needs-pricing-model)

Where a blank means the engagement's primary service fee, templates use the existing
`{{TXN.SERVICE_FEE}}` (`transactions.service_fee`). Remaining money blanks that do
NOT map to that semantic were left as handwritten blanks — a future pricing-model
pass (no new TXN columns were invented) must decide their data home. See the
Assemble-stage template notes for the per-template list (Lesson Fees, Training Ride
Fee, Monthly Program Fee, Program Fee, Travel Fee where not the primary service fee).

## 10. Checkbox elections — left as visible elections

Service-scope boxes, vaccination attestations, media consent, initials-to-decline,
and the dispute election stay visible checkboxes (glyph normalized to `□`). No data
home exists yet; the Wave-7 intake table will store elections. Counsel: confirm
initials-to-decline mechanics are acceptable for e-sign.

## 11. Medical / insurance detail blanks — deferred storage

Allergies, medications, physician, and insurance blanks in `HUMAN_EMERGENCY_MEDICAL`
and `MINOR_RIDER` remain handwritten. A future **emergency-profile store** (with
appropriate access controls for sensitive medical data) is the intended home.
`HUMAN_EMERGENCY_MEDICAL` emergency contact **#2** also stays handwritten (the party
model holds one contact per role); contact #1 merges via `{{EMERGENCY_CONTACT.*}}`.

## 12. Search-profile blanks — deferred to Wave-7 intake

`HORSE_SEARCH_RETAINER` / `HORSE_REPRESENTATION` search-profile blanks (intended use,
discipline, budget, …) stay blank; `{{ENG.INTENDED_USE}}`/`{{ENG.DISCIPLINE}}`/
`{{ENG.BUDGET}}` tokens arrive with Wave-7 intake storage (`intake` table).

## 13. provision_tenant gap — future tenants

`provision_tenant()` (`20260630050000_provision_tenant.sql`) does **not** yet
populate `business_config.signatory_contact_id` or `config_values ORG.LEGAL_IDENTITY`
for new tenants. Until it does, a newly provisioned tenant's engagements have **no
COMPANY signing party** and its party blocks merge a blank identity clause.
Deliberately out of scope for this pass; provisioning should create a signatory
contact from `p_legal->>'SIGNATORY_NAME'` and seed both values.

## 14. Where the machinery lives (for reference)

- COMPANY party role (CHECKs, RPC party inserts, `signatory_contact_id` column) and
  resolver v5 (ORG typed arms + generic `ORG` EAV fallback + HORSE vet/farrier):
  `supabase/migrations/20260701000000_company_party_and_org_tokens.sql`
- Tenant #1 identity seed + `party_namespaces` FHE→COMPANY update:
  `supabase/migrations/20260701010000_seed_fhe_company_identity.sql`
- Signatory contact: `contacts` row "Charles Zigmund" (tag `signatory`), referenced by
  `business_config.signatory_contact_id`
- Documents flip `EXECUTED` only after **every** `is_signer` party — now including
  COMPANY — has signed (`record_signature`, unchanged and generic).
