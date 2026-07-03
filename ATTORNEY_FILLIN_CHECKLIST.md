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

## 15. Liability-release pass — the four standalone releases (NEW, counsel review)

The four owner release documents are loaded as standalone templates
(`RELEASE_GENERAL`, `RELEASE_PARTICIPANT`, `RELEASE_HORSE_EXERCISE`,
`RELEASE_HORSE_CARE`; sources in `build_instructions_phase_2/Documents/Liability
Release/`). Tokenization changes counsel should confirm:

- **Company countersignature blocks REMOVED (owner decision 2026-07-02).** The
  releases are UNILATERAL again, matching the sources: an earlier pass had added
  the standard COMPANY block for engine consistency; the owner struck it. The
  company remains identified in the party block only, and a release EXECUTES on
  the single signer signature (adult, or parent/guardian for a minor). The
  effective date auto-merges to the signing day.
- **Releases identify the DBA trade name ONLY (owner decision 2026-07-02).**
  The party block uses `{{ORG.LEGAL_NAME}}` ("French Heritage Equestrian") —
  NOT `{{ORG.LEGAL_IDENTITY}}` — and no `{{ORG.SIGNATORY_NAME}}` /
  `{{ORG.SIGNATORY_TITLE}}` token appears anywhere in a release body, so no
  personal name is printed on a release. **Counsel question:** is a trade-name-
  only identification sufficient for a sole proprietorship's release, or must
  the d/b/a disclosure appear?
- **"Visitor" signs under the PARTICIPANT role.** `VISITOR` is not a
  `party_role` CHECK value, so `RELEASE_GENERAL` keeps "Visitor" as its defined
  term in prose but merges/signs via `{{PARTICIPANT.*}}` / `{{SIG.PARTICIPANT.*}}`
  (guardian via `{{GUARDIAN.*}}`). Confirm acceptable, or the role vocabulary
  must gain VISITOR.
- **Normalized signer sections + minor/guardian flow (counsel review).** All
  four releases now end with the same two marker sections: `ADULT SIGNER`
  (printed name / signature / date / phone / email; the horse releases keep the
  capacity checkboxes + horse name here) and `MINOR SIGNER (PARENT/GUARDIAN)`
  (minor name + date of birth, a guardian-authority certification paragraph,
  guardian name / relationship / signature / date / phone / email). At the
  public kiosk, the minor flow captures these fields and the GUARDIAN signs;
  the executed document carries ONLY the applicable section (adult xor minor).
  The horse releases' signer block moved from the OWNER token namespace to the
  shared PARTICIPANT/GUARDIAN namespaces; "Owner" stays the defined term in
  prose.
- **Effective date wording.** Sources say only "Effective for One (1) Year from
  Date of Signature"; the loaded versions ALSO insert the standard
  "entered into as of {{DOC.EFFECTIVE_DATE}} ('Effective Date')" intro. Confirm
  the until-superseded term vs. the merged effective date is coherent.
- **"Circle one" → checkboxes.** The Owner/Lessee/Lessor "circle one" elections
  in the horse releases are normalized to `□ Owner □ Lessee □ Lessor`.
- **Grammar fix in the care release**, §3: source read "if the owner cannot be
  reach out"; loaded as "or emergency medications if the Owner cannot be
  reached". Confirm intent (administering emergency medication when unreachable).
- **Free-floating initials lines REMOVED (owner decision 2026-07-02).** Every
  general-acknowledgment initials line ("Visitor Initials:", "Owner Initials:",
  "Participant Initials Acknowledging Receipt and Agreement:", …) was removed
  from the four releases; the signer's single signature acknowledges the whole
  document. (Initials tied to a specific opt-in/opt-out election would stay,
  but the releases carry none.)
- **'COVENANT NOT TO SUE' sections REMOVED (owner decision 2026-07-02)** from
  all four releases; remaining sections renumbered. Counsel review.
- **California Civil Code §1542 waiver sections REMOVED (owner decision
  2026-07-02)** from all four releases; remaining sections renumbered. Counsel
  review — the releases now cover known/unknown claims only via the general
  release wording.
- **Media consent converted to a DEFAULT GRANT + written email opt-out (owner
  decision 2026-07-02).** No initials-to-decline mechanic and no checkbox
  election: each release gains one numbered MEDIA CONSENT section granting
  COMPANY a perpetual, royalty-free license to media captured during
  visits/activities (name, image, likeness; instructional, promotional, and
  other lawful business purposes; no compensation), revocable at any time by
  written notice via email to `{{ORG.EMAIL}}`, effective prospectively for
  media captured after receipt. Counsel review the grant + revocation wording.
- **Minor date of birth is now captured and merged.** The kiosk minor flow
  records the minor's DOB and merges it into the "Date of Birth:" line of the
  executed document (no longer a handwritten blank).
- **Facility Rules acknowledgment recorded on the executed release.** The
  kiosk requires reading/accepting the Facility Rules before signing; the
  executed release body carries a dated "FACILITY RULES ACKNOWLEDGMENT" line.

## 16. Liability-release pass — release language STRIPPED from service agreements

Owner directive: release / assumption-of-risk / hold-harmless protections now
live EXCLUSIVELY in the standalone RELEASE_* documents. The embedded sections
were REMOVED from `RIDER_LESSON_JUMPER`, `MINOR_RIDER`, `HORSE_EXERCISE`,
`HORSE_TRAINING`, `HORSEMANSHIP_TRAINING`, `HORSE_SEARCH_RETAINER`, and
`HORSE_REPRESENTATION`, each replaced with this exact incorporation clause
(**attorney must confirm the wording**):

> **LIABILITY RELEASE — INCORPORATED BY REFERENCE**
> The risk acknowledgments, releases, and indemnity obligations applicable to
> the activities under this Agreement are set forth exclusively in the
> separately executed Liability Release and Assumption of Risk agreement, which
> is incorporated herein by reference.

Consequences counsel should note:

- Titles shortened accordingly: `RIDER_LESSON_JUMPER` → "Riding Lesson
  Agreement"; `MINOR_RIDER` → "Minor Rider Agreement, Parental Consent, and
  Medical Authorization Agreement" (it KEEPS parental consent, rules, helmet,
  medical-information, and emergency-medical-authorization sections).
- The stripped indemnities included service-specific carve-outs (e.g. the
  retainer's "failure to locate a horse", the representation agreement's "lease
  decisions", the exercise/training agreements' "undisclosed conditions /
  ownership disputes"). The standalone releases cover the general equine-risk
  scope; counsel should confirm those service-specific protections are
  adequately captured (the releases' hold-harmless clauses are broad) or
  restore narrow, non-release business terms.
- NOT stripped by design: `FACILITY_RULES` (property-rules acknowledgment keeps
  its own risk/release language), `HORSE_EMERGENCY_VET` (its release/indemnity
  is scoped to good-faith emergency-care decisions — its narrow authorization
  subject, no general release found), `HUMAN_EMERGENCY_MEDICAL` (not a service
  agreement), and the RELEASE_* documents themselves.
- A CI gate (`test/db/contract_bodies.test.ts`) now fails if release phrasing
  reappears in a stripped agreement outside the canonical clause above.

## 17. Signing-requirements matrix (`contract_requirements`) — owner rules encoded

`supabase/migrations/20260701070000_liability_releases.sql` seeds, per service:
rider segment (`RIDING_LESSON`, `JUMPER_TRAINING`, `HORSEMANSHIP_TRAINING`) →
`RELEASE_PARTICIPANT` + `FACILITY_RULES` + `HUMAN_EMERGENCY_MEDICAL`; horse
segment (`HORSE_TRAINING`, `HORSE_EXERCISE` → `RELEASE_HORSE_EXERCISE`;
`HORSE_CLIPPING` → `RELEASE_HORSE_CARE`) + `FACILITY_RULES` +
`HORSE_EMERGENCY_VET`; requires-horse brokerage/support (`HORSE_EVALUATION`,
purchase/sale/lease-in/lease-out assistance) → `HORSE_EMERGENCY_VET` only;
`HORSE_FINDER` and `INDEPENDENT_CONTRACTOR` → none; `RELEASE_GENERAL` is the
standalone visitor document (no matrix rows). Judgment calls for owner/counsel
to confirm: (a) brokerage/support lines requiring the vet authorization even
though the horse may not yet be in COMPANY custody; (b) horse-segment services
treated as staff-performed (no `HUMAN_EMERGENCY_MEDICAL` for the client);
(c) no boarding/care service codes exist yet — when they do, pool them to
`RELEASE_HORSE_CARE`.

## 18. Contract-module decomposition (CONTRACT_MODULE_ARCHITECTURE) — counsel review

The search / evaluation / transaction-representation agreements were decomposed
into separately executed modules (`20260701080000_contract_module_decomposition.sql`
+ reworked bodies in `supabase/contract_templates/`). All new wording is OURS
(placeholder-grade, engine-tokenized) — counsel must review and may swap freely;
the legal text lives in the `.md` bodies and merges through data, not code.

- **One directional finder template.** `HORSE_SEARCH_RETAINER` (retitled "Horse
  Finder Search and Sourcing Retainer Agreement") now serves all four directions
  — find a horse to buy / find a horse to lease / find a buyer / find a lessee —
  via `{{DIR.ROLE_TERM}}` / `{{DIR.TARGET_TERM}}` / `{{DIR.DIRECTION_TERM}}`
  tokens resolved from the engagement's current stage (`engagement_stages.retained_by`
  + `deal_side`) through the `template_variants` catalog. **Counsel: confirm the
  per-direction terminology** (`purchase` / `sale` / `lease (lessee)` /
  `lease (lessor)`, seeded in `template_variants.token_overrides`) reads
  correctly in every clause it lands in — the variant WORDS are data and can be
  changed without touching the template.
- **No-result / no-consummation recitals (NEW wording).** Recital C and the
  "NO GUARANTEE OF RESULTS; NO GUARANTEE OF CONSUMMATION" section state that a
  search guarantees neither a result nor a consummated deal, and that
  non-contingent fees remain earned either way. Counsel must confirm this
  earned-fee posture.
- **Success / Acquisition fee kept in the retainer, made expressly contingent.**
  The retainer keeps the flat `{{TXN.RETAINER_FEE}}` AND the contingent
  `{{TXN.SUCCESS_FEE}}` (or `{{TXN.COMMISSION_RATE}}`); the new clause makes the
  success fee payable "whether or not COMPANY is separately retained to
  represent Client in that transaction". Counsel: confirm enforceability of the
  contingent fee absent a transaction-representation engagement.
- **`HORSE_REPRESENTATION` retired.** The lease-flavored search+placement bundle
  was folded into the finder's lease directions; the template row is kept
  inactive (existing signed documents keep their reference) and can no longer be
  generated. Its "Lease Placement Fee" concept is now the finder's success fee
  or the transaction-rep module's representation fee — counsel: confirm no
  placement-specific term was lost that must be restored.
- **NEW `HORSE_TRANSACTION_REP` (entirely our draft).** A side-scoped
  representation module (CLIENT + COMPANY only): COMPANY represents one side;
  the counterparty is named via `{{DIR.COUNTERPARTY_TERM}}` and expressly not
  represented; dual-party deals are TWO representation agreements (one per
  side), with disclosure. Its `{{TXN.REPRESENTATION_FEE}}` (or commission) is
  its own charge. The buyer↔seller transfer instruments
  (`HORSE_PURCHASE_SALE`, `HORSE_SALE_TRANSFER`, `HORSE_LEASE`) are unchanged
  and remain the deal documents between the transacting parties. **Counsel must
  review this agreement end to end** (agency/disclosure duties for equine
  brokers, dual-agency disclosure wording, CA requirements).
- **`HORSE_EVALUATION` repositioned + STRIPPED.** Retitled transaction-agnostic
  ("Horse Evaluation Agreement", was "Pre-Purchase…"), scoped to ONE horse per
  executed agreement with a per-horse `{{TXN.EVALUATION_FEE}}`, and its embedded
  RELEASE OF LIABILITY / LIMITATION OF LIABILITY / INDEMNIFICATION sections were
  REMOVED in favor of the same incorporation-by-reference clause as §16 (the
  new `HORSE_TRANSACTION_REP` carries the clause too, and both are enforced by
  the §16 CI gate). Counsel: the stripped evaluation limitation-of-liability
  (purchase-price losses, consequential damages, etc.) is NOT reproduced in the
  standalone releases — confirm the releases' scope suffices or restore a
  non-release limitation-of-liability section.
- **Staged revenue chain data homes.** One fee column per module on
  `transactions`: `retainer_fee` + `success_fee` (search), `evaluation_fee`
  (per horse), `representation_fee` (transaction rep); `service_fee` remains for
  the generic service agreements. Amounts are unseeded — owner supplies per deal.
- **Directional vocabulary is open.** `engagement_stages.retained_by` is free
  text; variants are seeded for `buyer`/`seller`/`owner`/`lessee`/`lessor`. A
  stage recorded with any other word merges blank DIR terms (visible in review,
  never wrong terminology).
- FACILITY_RULES: dispute-resolution, attorney's fees, and governing-law sections removed per owner 2026-07-02 (rules doc is an acknowledgment; legal machinery lives in the releases/agreements). Counsel to confirm.
