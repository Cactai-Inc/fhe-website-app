### ITEM [batch1.md#2]
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: The lease-effect stamping deliberately omitted the trigger's ensure_horse_documents side effect (auto-generated HORSE_EMERGENCY_VET / RELEASE_HORSE_CARE paperwork), leaving a known gap from the full trigger body.
- quote: "Not run; logged here as a known, deliberate gap from the full trigger body."
- kind: process
- artifacts: ensure_horse_documents, apply_contract_execution_effects
- decision-mention: none

### ITEM [batch1.md#7]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Correction to the task spec: the three acquisition offerings are not config_kind='inquire' (they are document_transaction / intake_evaluation / intake_finder); the price_amount != null clause alone emptied /acquisition.
- quote: "**One correction to the spec's wording:** the task says the three offerings are `config_kind = 'inquire'`. They are not ... **It is the `price_amount != null` clause alone that emptied the page.**"
- kind: correction
- artifacts: src/lib/publicCatalog.ts, public_offerings
- decision-mention: none

### ITEM [batch1.md#51]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.6: three document-body renderers exist; ContractCascade's comment "This is the single body renderer used across the app (m-5)" is false (third false comment found).
- quote: "**Its own comment (line 241) claims:** *\"This is the single body renderer used across the app (m-5).\"* **It is not.** Third false comment found."
- kind: correctness
- artifacts: src/components/app/ContractCascade.tsx, src/components/ops/documents/MergedBodyView.tsx, src/lib/documentPdf.ts
- decision-mention: none

### ITEM [batch1.md#52]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Document DOC-J7NXZDHD5F (the one document with a NEEDS: mark) shows a styled mark at /app/contracts/:id but raw ⟦NEEDS:…⟧ delimiters at /app/ops/documents/:id — same document, two screens, two appearances.
- quote: "Opened at `/app/contracts/<id>` it shows a styled \"Needs:\" mark; opened at `/app/ops/documents/<id>` it shows the raw `⟦NEEDS:…⟧` delimiters."
- kind: defect
- artifacts: MergedBodyView.tsx, ContractCascade.tsx, DOC-J7NXZDHD5F
- decision-mention: none

### ITEM [batch1.md#53]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Three copies of the signature-line regex exist and one (the PDF renderer's) already tolerates leading whitespace where the others do not — latent screen/PDF divergence; extract to one exported constant regardless of consolidation.
- quote: "**extract the signature-line regex to one exported constant** and have all three import it. Three copies of one pattern, one of which already differs, is how the screen and the PDF drift apart."
- kind: defect
- artifacts: ContractCascade.tsx:245, MergedBodyView.tsx:24, documentPdf.ts:28
- decision-mention: none

### ITEM [batch1.md#66]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Four code comments asserted false things; two are still false at report time: ContractCascade.tsx:240-241 ("the single body renderer") and serviceCatalog.ts:3 ("Every UI that names a service reads from here").
- quote: "**Four code comments asserted things that were false**, each in a file a thread trusted"
- kind: correctness
- artifacts: ContractCascade.tsx, serviceCatalog.ts, useOpenLeads.ts, ContactsPage.tsx
- decision-mention: none

### ITEM [batch1.md#72]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: TASK-LEASESET / D10 (Standard/Simple/Detailed lease templates + archived original) listed as resolved; template duplication was deliberately not re-examined by this census.
- quote: "**`TASK-LEASESET` / D10** | Standard / Simple / Detailed + archived original | **resolved** | **No.** Template duplication was not re-examined."
- kind: inventory
- artifacts: contract_templates
- decision-mention: D10

### ITEM [batch1.md#82]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Two pre-existing test/ui failures confirmed on a clean tree and not fixed: clause_ownership_affordance (needs a dist/assets CSS artifact) and pluspass_create_controls (expects a CreateModal label that drifted).
- quote: "`clause_ownership_affordance` needs a `dist/assets` CSS artifact, and `pluspass_create_controls` expects a `CreateModal` label that has since drifted. **Neither is mine and neither is fixed here.**"
- kind: process
- artifacts: test/ui/clause_ownership_affordance, test/ui/pluspass_create_controls, CreateModal
- decision-mention: none

### ITEM [batch1.md#110]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Frozen-file violation awaiting the owner's ruling: ClauseDocument.tsx was edited (16 insertions, 2 deletions — flex-wrap/shrink-0 label-squeeze fix) without knowing it was frozen; not reverted per directive, no further edits.
- quote: "I edited a file I was not permitted to edit. I did not know it was frozen — that is an explanation, not a defence"
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx (commit 2be3faa/41d9b37)
- decision-mention: none

### ITEM [batch1.md#111]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: The ClauseDocument change's visual harmlessness elsewhere is assessed, not measured — renderOrphan renders every clause-level orphan control across all clause-engine templates (certify checkboxes, gate controls, Sale/BOS); a regression would show as a control dropping to its own line on narrow viewports.
- quote: "**Assessed risk, not measured:** ... **I have not proved that** — I typechecked and built, which catches neither."
- kind: not-verified
- artifacts: ClauseDocument.tsx (renderOrphan), HORSE_SALE_V2, HORSE_BILL_OF_SALE
- decision-mention: none

### ITEM [batch1.md#112]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Whether the fix actually cures the owner's screenshot was never rendered in a browser — the worktree has placeholder Supabase keys so the frontend cannot run against real data.
- quote: "**That the fix actually cures the owner's screenshot.** Never rendered in a browser — this worktree has placeholder Supabase keys"
- kind: not-verified
- artifacts: ClauseDocument.tsx, InlineSelect
- decision-mention: none

### ITEM [batch1.md#113]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: TXN.OFFSITE_TRANSPORT (clause 11.8, 120-char option) may have the same label squeeze — inferred, renders through a different path (inline prose), not confirmed.
- quote: "**That `TXN.OFFSITE_TRANSPORT` (11.8) has the same squeeze.** Inferred from its 120-character option ... I did not confirm it."
- kind: not-verified
- artifacts: TXN.OFFSITE_TRANSPORT
- decision-mention: none

### ITEM [batch1.md#115]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Open: the four cherry-picked commits exist in two places (task/leasefix and local main beneath 9 orchestrator commits); someone with authority over main must decide whether they get dropped or land on merge — not touched.
- quote: "**Someone with authority over `main` needs to decide** whether those four get dropped from it or simply land there when `task/leasefix` merges."
- kind: blocked-on-owner
- artifacts: local main, task/leasefix
- decision-mention: none

### ITEM [batch1.md#117]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Correction: the lease templates hold 131 fields, not the 130 reported to the owner — that number predated TXN.GL_LESSOR_COVERAGE.
- quote: "Note **131 fields, not the 130 I reported to the owner** — that number predated `TXN.GL_LESSOR_COVERAGE`."
- kind: correction
- artifacts: contract_field_defs, TXN.GL_LESSOR_COVERAGE
- decision-mention: none

### ITEM [batch1.md#118]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: The reversion diagnosis given to the owner was wrong — the actual mechanism was a git checkout left on a task branch in the canonical checkout for ~3 hours; two false alarms in one session, both from inferring instead of checking.
- quote: "**The reversion diagnosis was mine and it was wrong.** ... **Two false alarms in one session, both from inferring instead of checking**"
- kind: correction
- artifacts: canonical checkout, task/leasefix-2026-08-09
- decision-mention: none

### ITEM [batch1.md#123]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Flagged, not fixed: remove_document_co_buyer calls assert_not_signature_locked AFTER its DELETEs and UPDATE, not before — not currently exploitable, but a caller wrapping it in an EXCEPTION handler would keep the deletes and swallow the lock, and this codebase has exactly such a handler; reordering belongs in its own reviewed change.
- quote: "any caller wrapping it in an `EXCEPTION` handler would keep the deletes and swallow the lock, and this codebase has exactly such a handler (`sync_horse_fields_to_documents` does `EXCEPTION WHEN OTHERS THEN NULL`). Reordering is a body rewrite and belongs in its own reviewed change"
- kind: defect
- artifacts: remove_document_co_buyer, assert_not_signature_locked
- decision-mention: none

### ITEM [batch1.md#128]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Data observation flagged, not caused here: two documents show a negative contract_fields delta against their template defs (ecaecd42 −22, 9a56b738 −3); both gaps pre-date this task.
- quote: "Two documents show a negative field delta against their template defs (`ecaecd42…` −22, `9a56b738…` −3) ... **Flagged, not caused here.**"
- kind: data-integrity
- artifacts: contract_fields, documents ecaecd42, 9a56b738
- decision-mention: none

### ITEM [batch1.md#142]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Correction to the task doc: emergency-contact data does not live in contract_fields as the doc hedged — the merge tokens bind straight to contacts.emergency_contact_* columns.
- quote: "The \"contract_fields\" pointer in the task doc for emergency contact turned out not to be literally where the data lives"
- kind: correction
- artifacts: contacts.emergency_contact_1_name, token_dictionary_sync
- decision-mention: none

### ITEM [batch1.md#150]
- report: TASK-SQLTRUTH-REPORT.md
- date: 2026-08-04
- item: Correction to the task brief: it was stale — 20260804120000_add_item_composition.sql already carried three of the four claimed-missing features; only the CUSTOM.% terminal-punctuation block was actually missing from git; real drift smaller than described.
- quote: "That is stale. ... only **one** of the four claimed-missing features was actually missing from git: the CUSTOM.% terminal-punctuation block."
- kind: correction
- artifacts: remerge_contract_from_clauses, 20260804120000_add_item_composition.sql
- decision-mention: none

### ITEM [batch1.md#157]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Answer to Question 1: template_tokens.source_table/source_column are documentation, not the resolution mechanism — no code path reads them at merge time or ever; the 59 dead-source tokens are stale provenance notes, not live broken renders.
- quote: "**`source_table` / `source_column` are documentation, not the resolution mechanism. No code path reads them — at merge time or ever.**"
- kind: correctness
- artifacts: template_tokens.source_table, template_tokens.source_column, generate_document
- decision-mention: none

### ITEM [batch1.md#158]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The one live landmine: MINOR_RIDER is ACTIVE with a 5,481-byte body and ZERO scoped token rows — generating from it would render every one of its 26 tokens as literal {{…}} text; no document has ever been generated from it, the doc says it was retired, the table disagrees; deactivation recommended (owner call).
- quote: "**The one live landmine: `MINOR_RIDER` is ACTIVE with a 5,481-byte body and ZERO scoped token rows.** If anyone generates from it, **every one of its 26 tokens renders as literal `{{…}}` text**"
- kind: defect
- artifacts: contract_templates (MINOR_RIDER), template_tokens, docs/design/TOKEN_DICTIONARY.md
- decision-mention: none

### ITEM [batch1.md#159]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: FLAGGED LOUDLY: DOC.UUID and ORD.UUID both map to documents.id — either the ORD.UUID name is wrong (a DOC token wearing an ORD name) or the mapping is (should print the purchase id/PUR-code, which currently has no token at all); unused today so nothing breaks, but owner ruling requested.
- quote: "**`{{DOC.UUID}}` vs `{{ORD.UUID}}` → both `documents.id` — FLAGGED LOUDLY.**"
- kind: blocked-on-owner
- artifacts: template_tokens (ORD.UUID, DOC.UUID), documents.id, purchases
- decision-mention: none

### ITEM [batch1.md#160]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Two EXECUTED documents from 2026-07-10 carry literal unfilled tokens ({{CLIENT.EMERGENCY_CONTACT_2_*}}, {{HORSE.MICROCHIP}}, {{HORSE.FARRIER_*}}) — generated before scoped rows existed; report-only under the SIGNING FREEZE, executed bodies stay as they are.
- quote: "**Two frozen artifacts (report-only, SIGNING FREEZE):** two EXECUTED docs from **2026-07-10** carry literal `{{CLIENT.EMERGENCY_CONTACT_2_*}}` / `{{HORSE.MICROCHIP}}` / `{{HORSE.FARRIER_*}}` etc."
- kind: data-integrity
- artifacts: documents (HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE executed 2026-07-10)
- decision-mention: none

### ITEM [batch1.md#161]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The 17 intake.* tokens (ENG intake ×13 + REQ ×4) always render blank — the capture was never built; BUILD-OR-RETIRE is the owner's call; notes already say "do not place".
- quote: "**Always render blank** — the capture was never built | **BUILD-OR-RETIRE (owner)**"
- kind: blocked-on-owner
- artifacts: template_tokens (ENG.*, REQ.* intake group)
- decision-mention: none

### ITEM [batch1.md#162]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The retainer/representation money tokens (RETAINER_FEE, SUCCESS_FEE, REPRESENTATION_FEE, PAYMENT_TERMS) sit in ACTIVE bodies but render blank — no working-copy field feeds those flat templates, so the two templates cannot produce a complete agreement today; WIRE BEFORE USE.
- quote: "these two templates cannot produce a complete agreement today | **WIRE BEFORE USE**"
- kind: defect
- artifacts: template_tokens (TXN.RETAINER_FEE, TXN.SUCCESS_FEE, TXN.REPRESENTATION_FEE, TXN.PAYMENT_TERMS), retainer/representation contract_templates
- decision-mention: none

### ITEM [batch1.md#163]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The 9 retired order-form fee tokens are retire-candidates (hide from picker) — blank and unused; owner rules; none deleted.
- quote: "**RETIRE-CANDIDATE** (hide from picker), owner rules"
- kind: blocked-on-owner
- artifacts: template_tokens (TXN.PACKAGE_FEE, SERVICE_FEE, PAYMENT_SCHEDULE, SESSION_FEE, MONTHLY_FEE, OTHER_FEES, EVALUATION_FEE, ADDITIONAL_SERVICES, JUMPER_TRAINING_FEE)
- decision-mention: none

### ITEM [batch1.md#164]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Dead columns found while validating: horses.owner_name does not exist (HORSE.OWNER_NAME renders blank) and horses.barn_name's real column is nickname (token resolves fine because the code reads nickname) — report-only.
- quote: "`horses.owner_name` (HORSE.OWNER_NAME — column does not exist, token renders blank), `horses.barn_name` (HORSE.BARN_NAME — real column is `nickname` ...). Report-only."
- kind: correctness
- artifacts: template_tokens (HORSE.OWNER_NAME, HORSE.BARN_NAME), horses
- decision-mention: none

### ITEM [batch1.md#165]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Duplicate wiring for owner rulings, none resolved: PARTY.FULL_NAME vs PARTY.PRINTED_NAME (identical output), TXN.PACKAGE_FEE vs TXN.SERVICE_FEE (pure legacy twins), and FHE.* vs ORG.* (7 pairs, same CASE arm — retiring FHE.* from the picker is the obvious move but is a ruling).
- quote: "**Duplicate wiring — for the owner to rule on, not resolved**"
- kind: blocked-on-owner
- artifacts: template_tokens (PARTY.*, FHE.*, ORG.*, TXN.PACKAGE_FEE, TXN.SERVICE_FEE)
- decision-mention: none

### ITEM [batch1.md#166]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: TOKEN_DICTIONARY.md disagrees with the table in several places (MINOR_RIDER retirement, ORD.UUID source, CLIENT.* autofill path, retired TXN sections, missing clause-engine field_keys) and CLIENT.EUTHANASIA_INITIALS is a doc-only ghost with no row and no body use; the doc needs a rewrite after owner rulings — not attempted here.
- quote: "The doc needs a rewrite **after** the owner rules on §5/§6 — not attempted here."
- kind: correction
- artifacts: docs/design/TOKEN_DICTIONARY.md, template_tokens, CLIENT.EUTHANASIA_INITIALS
- decision-mention: none

### ITEM [batch1.md#167]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: D13 note: token descriptions now live in template_tokens.notes but the only editor is SQL; TEXTEDIT's picker READS them; no admin surface that EDITS them is specified anywhere — the dictionary is developer-maintained until one ships, flagged rather than called finished.
- quote: "an admin surface that EDITS them is not yet specified anywhere. Until one ships ... this dictionary is developer-maintained — flagged per D13"
- kind: blocked-on-owner
- artifacts: template_tokens.notes
- decision-mention: D13

### ITEM [batch1.md#168]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The stale source_table/source_column re-pointing recommendations (per-group in §5) are documentation-only writes deliberately left outside this task's write scope — none done.
- quote: "The stale `source_table`/`source_column` re-pointing (§5) — documentation-only writes, deliberately outside this task's write scope."
- kind: process
- artifacts: template_tokens.source_table, template_tokens.source_column
- decision-mention: none

### ITEM [batch1.md#169]
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The picker has TWO vocabularies to draw from: template_tokens (307 rows) and contract_field_defs' 667 dotted field_keys (a parallel, healthier dictionary that IS the clause-body token set) — 213 of the 272 "used-but-undefined" tokens are simply clause-engine field-keys.
- quote: "**it means the picker has TWO vocabularies to draw from**"
- kind: inventory
- artifacts: template_tokens, contract_field_defs
- decision-mention: none

### ITEM [batch2.md#3]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: Kiosk-to-account auto-promotion and new `/sign/guest|rider|horse|rider+horse` short URLs were explicitly deferred by the owner to a separate orchestrator-authored task.
- quote: "Kiosk-to-account auto-promotion + new `/sign/guest|rider|horse|rider+horse` short URLs — explicitly deferred by the owner to a separate, orchestrator-authored task."
- kind: blocked-on-owner
- artifacts: /release, Release.tsx, sign_release
- decision-mention: none

### ITEM [batch2.md#13]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: New systemic defect D15: remerge_contract_from_clauses (the re-render path run on every draft edit) has none of U2.1's money-rendering logic — currency fields render as bare numbers; reported to BACKLOG, not fixed.
- quote: "`remerge_contract_body` → `remerge_contract_from_clauses` ... has **none** of Stage 2's U2.1 money-rendering logic (`fmt_money`, `fee_schedule` JSON parsing)."
- kind: defect
- artifacts: remerge_contract_from_clauses, remerge_contract_body, fmt_money, docs/archive/BACKLOG.md
- decision-mention: D15

### ITEM [batch2.md#17]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: The test/db harness is not fully green — the HORSE_EMERGENCY_VET template-body drift blocker (a self-verifying migration whose search string no longer matches on fresh replay) and a stale service_catalog.test.ts import of nonexistent src/lib/services are separate, unbounded follow-ups.
- quote: "`20260728010000_release_family_signer_side.sql` raises `\"signer-side binding missing in HORSE_EMERGENCY_VET\"` ... tracing which earlier migration left the body in an unexpected shape is unbounded work, a new unit."
- kind: defect
- artifacts: supabase/migrations/20260728010000_release_family_signer_side.sql, test/db/service_catalog.test.ts, src/lib/services
- decision-mention: none

### ITEM [batch2.md#22]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: The three new D2 insurance clauses carry bracketed `[PENDING LEGAL REVIEW]` placeholder bodies — no legal language drafted; body text awaits the contract review thread's C1 pass, with D3's signing gate preventing a placeholder reaching an executed instrument.
- quote: "Bodies are `[PENDING LEGAL REVIEW — …]` — no legal language drafted."
- kind: blocked-on-owner
- artifacts: INSURANCE_RISK.GL_LESSEE_RESP, INSURANCE_RISK.MORT_LESSEE_RESP, INSURANCE_RISK.MED_LESSEE_RESP, contract_clause_defs
- decision-mention: none

### ITEM [batch2.md#23]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Live draft b7446f9e has its MORTALITY insurance section genuinely unresolved right now — a real currently-live blocking condition discovered during D3 verification, not a synthetic scenario.
- quote: "draft `b7446f9e` has MORTALITY genuinely unresolved right now"
- kind: data-integrity
- artifacts: documents (b7446f9e), contract_lock_blockers
- decision-mention: none

### ITEM [batch2.md#40]
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Judgment call flagged: a genuine RPC/DB exception in /api/sign-start returns 500 rather than the spec's "same `{ ok: true }` body in every non-400 case" — matching admin-send-invitation's precedent for hard provisioning failure.
- quote: "**Unexpected-error response is a 500, not `{ ok: true }`.**"
- kind: process
- artifacts: api/sign-start.ts
- decision-mention: none

### ITEM [batch2.md#50]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Correction: the task doc's "already works" claim that /register?redeem= survives registration is false — Register.tsx reads only params.get('token'), so a new gift recipient hit a dead end ("this link isn't valid anymore"); fixed via a new /api/register-gift + inline signup.
- quote: "\"Claim → `/register?redeem=<code>` when there is no session; the code survives registration\" — false."
- kind: correctness
- artifacts: Register.tsx, api/register-gift.ts, src/pages/Redeem.tsx
- decision-mention: none

### ITEM [batch2.md#51]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Correction: the task doc's "already works" claim that gift redemption assigns documents is false — redeem_gift passed an empty (non-NULL) template_keys array, so every gift redemption silently assigned zero onboarding documents; fixed and proved by counting rows.
- quote: "Net effect: every gift redemption assigned **zero** onboarding documents, silently. No error, nothing in a log"
- kind: correctness
- artifacts: redeem_gift, _ensure_client_account
- decision-mention: none

### ITEM [batch2.md#75]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Flagged, not fixed: HORSE_LEASE_V2's CARE.INTRO (the section's general lead-in) and CARE.SUPPLEMENTS attach under the "3rd Party Exercise" header, where neither belongs — fixing it is a content decision (give CARE.INTRO a heading or move the SCHEDULE.* clauses), outside this spec.
- quote: "CARE.INTRO is the general care-and-expenses lead-in for the whole section and CARE.SUPPLEMENTS is the medications builder; neither belongs under a third-party-exercise header."
- kind: defect
- artifacts: HORSE_LEASE_V2, CARE.INTRO, CARE.SUPPLEMENTS, SCHEDULE.TRAINER_CARE, contract_clause_defs
- decision-mention: none

### ITEM [batch2.md#76]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Flagged, not fixed: HORSE_SALE_V2 and HORSE_BILL_OF_SALE [Pending] placeholder clauses are still headingless (A3 covered only the lease), so while the driving question is unanswered those groups show no number and no title — items appear to materialise on selection; the same one-line fix A3 applied would resolve each.
- quote: "**[Pending] placeholders are still headingless** ... Consequence: while the driving question is unanswered, those groups show **no number and no title**"
- kind: defect
- artifacts: HORSE_SALE_V2, HORSE_BILL_OF_SALE, HORSE.INJURY_HISTORY_PENDING, PPE.PENDING, PRICE.INSTALLMENTS_PENDING, TRIAL.PENDING, PARTIES.CO_BUYER_PENDING, DEFINITIONS.SELLER_PENDING, DEFINITIONS.BUYER_PENDING
- decision-mention: none

### ITEM [batch2.md#77]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Recorded visible change: HORSE_BILL_OF_SALE now composes most sections as "N. TITLE" plus unnumbered preamble with no sub-numbers at all — reads acceptably for a short instrument but is a visible change from the previous numbering.
- quote: "now compose as **\"N. TITLE\" plus unnumbered preamble**, with no sub-numbers at all ... recorded here as such."
- kind: cosmetic
- artifacts: HORSE_BILL_OF_SALE, remerge_contract_from_clauses
- decision-mention: none

### ITEM [batch2.md#78]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Deviation: the spec's literal "muted previews render title-only + gold caption" was not implemented (it would hide headingless gated clauses and their self-enabling toggles entirely); only the numbering half was built — if the owner did mean collapse-to-title, that separate small change has not been made.
- quote: "If the owner did mean \"collapse muted previews to their title\", that is a separate, small change and I have not made it."
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx, gateControls
- decision-mention: none

### ITEM [batch2.md#80]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Pre-existing quirk found tracing the add surface: ContractPage passed section HEADINGS while customBySection matched section_keys, so a legacy custom field could never land inside a template section — not fixed beyond being superseded by the new key-passing path.
- quote: "a legacy custom field could never land inside a template section — it always became a trailing custom section. Not fixed beyond being superseded by the new path, which passes keys."
- kind: defect
- artifacts: ContractPage.tsx, AddElementModal.tsx, ClauseDocument.tsx (customBySection)
- decision-mention: none

### ITEM [batch2.md#81]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Spec contradiction found live: the R5 terminal-punctuation rule only punctuates token-bearing lines, not token-free authored lines — corrected by a follow-up migration scoped to CUSTOM clause keys only.
- quote: "**The spec says \"the composer already appends terminal punctuation (R5 rule)\". Live contradicted it.**"
- kind: correctness
- artifacts: supabase/migrations/20260804120001_authored_line_punctuation.sql, remerge_contract_from_clauses
- decision-mention: none

### ITEM [batch2.md#82]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Deviations disclosed: remove_contract_composition is new and unnamed in the spec (deletion was required by the done-check); a composite add_contract_composition RPC was built instead of N client calls; and two new columns (body, custom_kind) were added to contract_fields.
- quote: "**`remove_contract_composition` is new and not named in the spec.** ... **Two new columns on `contract_fields`.** `body` and `custom_kind`."
- kind: process
- artifacts: add_contract_composition, remove_contract_composition, contract_fields.body, contract_fields.custom_kind
- decision-mention: none

### ITEM [batch3.md#1]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: No real-browser click-through of the party (Lessee) view was done because the test document's LESSEE fixture has no login; jsdom rendering substituted, and someone with a Lessee login should still eyeball it.
- quote: "No real-browser click-through of the party view. The test document's LESSEE (`AVERIFY2 Tester`...) has **no login** — `profiles.user_id` is null"
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM [batch3.md#3]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: opacity-55 dimming was retained on not-mine fields despite the owner's stated preference for "tooltip over graying out"; dropping the dimming is a one-line change in OwnedField if the owner meant remove it.
- quote: "**`opacity-55` retained.** ... If the owner meant drop the dimming, it is now a one-line change in `OwnedField` affecting all three sites at once."
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx (OwnedField)
- decision-mention: none

### ITEM [batch3.md#4]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: A trailing period was added to the owner's quoted tooltip wording ("This item is set by the Lessor.") — trivial to revert if wrong.
- quote: "Owner wording was quoted as \"This item is set by the Lessor\" with no full stop. I shipped `This item is set by the Lessor.`"
- kind: cosmetic
- artifacts: otherPartyTip(), src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM [batch3.md#5]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: SYSTEM and unknown owner roles fall back to the generic "the other party" tooltip phrasing on imported contact tokens — pre-existing, raised rather than fixed.
- quote: "**`SYSTEM` and unknown owner roles read as \"the other party.\"** Pre-existing in `otherPartyTip`'s fallback, and unchanged here. ... Out of scope; raising it rather than widening the diff."
- kind: cosmetic
- artifacts: otherPartyTip(), ImportedRecordToken, src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM [batch3.md#6]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: test/ui/ is the first UI test suite in the repo and requires `npm run build:client` to have run first (it reads the emitted CSS) — a new operational dependency.
- quote: "**First UI test in the repo.** `test/ui/` is new (`test/db/` was the only suite). It needs `npm run build:client` to have run"
- kind: process
- artifacts: test/ui/clause_ownership_affordance.test.tsx
- decision-mention: none

### ITEM [batch3.md#7]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: The task's diagnosis omitted that threading `mine` alone would not fix the pointer cursor — certify's own label carries cursor-pointer, so the wrapper had a latent hole for every certify/reveal_text control; fixed with [&_*]:cursor-help, no change to ContractCascade.tsx.
- quote: "Threading `mine` alone would **not** have fixed the pointer cursor. ... the existing wrapper at line 413 had this latent hole too"
- kind: correctness
- artifacts: src/components/app/ClauseDocument.tsx, src/components/app/ContractCascade.tsx:812
- decision-mention: none

---

### ITEM [batch3.md#15]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 2, confirmed Yes, not fixed): ContractCascade co-owner grid uses bare 1fr tracks (implicit auto minimum) so unguarded inputs floor the row width — the same file family already fixed this in ClauseDocument with minmax(0,1fr).
- quote: "`src/components/app/ContractCascade.tsx:546` ... Bare `1fr` tracks carry an implicit `auto` minimum in CSS Grid, so each of the 4 unguarded `<input>`s ... floors the row at its own intrinsic width."
- kind: defect
- artifacts: src/components/app/ContractCascade.tsx:546
- decision-mention: none

### ITEM [batch3.md#16]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 2, not fixed, frozen file): ClauseDocument grid has a 272px hard column floor; fix needs owner sign-off since the file is out of scope (STOP-AND-PROPOSE).
- quote: "`src/components/app/ClauseDocument.tsx:606` ... `repeat(auto-fill,minmax(17rem,1fr))`, 272px hard floor per column. **STOP-AND-PROPOSE per task constraints — not touched, reported only**"
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx:606
- decision-mention: none

### ITEM [batch3.md#19]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 3, not fixed, frozen file): ClauseDocument matrix-cell label whitespace-nowrap with ~40-char labels inside the driver-2 grid — same STOP-AND-PROPOSE file, needs owner sign-off.
- quote: "`src/components/app/ClauseDocument.tsx:561` ... matrix-cell label `whitespace-nowrap`, labels can run ~40 chars ... **Same STOP-AND-PROPOSE file — reported only.**"
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx:561
- decision-mention: none

### ITEM [batch3.md#32]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F1 — ARENA_SOLO ("Solo Arena Riding") gates nothing anywhere in the template; selecting it only changes the printed word list.
- quote: "**F1 — `ARENA_SOLO` gates nothing, anywhere.** ... It appears in no `conditional_on` in the entire template."
- kind: defect
- artifacts: HORSE_LEASE_V2, TXN.PERMITTED_ACTIVITIES, PERMITTED_USE.MAIN
- decision-mention: none

### ITEM [batch3.md#33]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F2 — choosing OTHER on the three deductible selects prints the bare word "Other" and leads nowhere; the trigger's clear-branch targets a `<base>_RESP_OTHER` field that does not exist in this template.
- quote: "**F2 — `OTHER` on the three deductible selects leads nowhere.** Choosing it prints the bare word *\"Other\"* into the sentence"
- kind: defect
- artifacts: HORSE_LEASE_V2, contract_split_deductible_sync
- decision-mention: none

### ITEM [batch3.md#34]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F3 — the deductible sentence is dead exactly when the Lessee has just accepted financial responsibility (both statuses NONE is the precondition for the box), so an undertaken cover never gets a deductible allocation.
- quote: "**F3 — the deductible sentence is dead exactly when responsibility has just been accepted.**"
- kind: defect
- artifacts: *_DEDR_SIMPLE clauses, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#35]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F4 — clause_cut_kept has no effect on this lease (cut_name null everywhere) and still tests three fields that do not exist in HORSE_LEASE_V2.
- quote: "**F4 — `clause_cut_kept` has no effect on this lease.** `cut_name` is null on every section and every clause"
- kind: defect
- artifacts: clause_cut_kept, TXN.MORTALITY_INSURANCE_PARTY, TXN.MAJOR_MEDICAL_INSURANCE_PARTY, TXN.LOSS_OF_USE_INSURANCE_PARTY
- decision-mention: none

### ITEM [batch3.md#37]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F6 — three of the seven permitted activities (LESSONS, ARENA_SOLO, TRAINING) produce no risk acknowledgement clause in the insurance section; the other four do.
- quote: "**F6 — no risk clause exists for three of the seven activities.**"
- kind: defect
- artifacts: HORSE_LEASE_V2 INSURANCE_RISK, TXN.PERMITTED_ACTIVITIES
- decision-mention: none

### ITEM [batch3.md#38]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F7 — the only executed lease (ecaecd42) carries thirteen orphaned insurance field rows (plus four non-insurance orphans) in a vocabulary the template no longer has; the definition sync no longer touches executed documents.
- quote: "**F7 — the one executed lease carries thirteen orphaned insurance field rows.** ... its insurance terms are expressed in a vocabulary the template no longer has."
- kind: data-integrity
- artifacts: documents ecaecd42, contract_fields
- decision-mention: none

### ITEM [batch3.md#43]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F12 — the Lessee-responsibility clause always prints alongside a contradicting "Does not have and will not obtain" status line by construction; in the medical block the sort order additionally lands the status under the wrong heading.
- quote: "**F12 — the Lessee-responsibility clause and the Lessee's status line contradict each other by construction.**"
- kind: defect
- artifacts: MED_LESSEE_RESP, MED_STATUS, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#45]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F14 — a blank insurance status prints its sentence with a gap that reads as an affirmative undertaking with a typo; live right now in draft 215bac09, six fields behave this way.
- quote: "**F14 — a blank status prints its sentence with a gap.** Live in `215bac09`: *\"Lessor:  general liability insurance covering the Horse...\"*"
- kind: defect
- artifacts: documents 215bac09, remerge_contract_from_clauses, *_STATUS fields
- decision-mention: none

### ITEM [batch3.md#46]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F15 — a blank deductible selection prints a bare colon ("...borne by:"); documented in the composer as intended, which makes it silent rather than broken.
- quote: "**F15 — a blank deductible selection prints a bare colon.**"
- kind: defect
- artifacts: remerge_contract_from_clauses
- decision-mention: none

### ITEM [batch3.md#47]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F16 — blank split shares print an empty allocation ("paid by Lessor and paid by Lessee" with no numbers).
- quote: "**F16 — blank split shares print an empty allocation.**"
- kind: defect
- artifacts: HORSE_LEASE_V2 deductible split clauses
- decision-mention: none

### ITEM [batch3.md#48]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F17 — HORSE.FAIR_MARKET_VALUE is optional yet two money clauses print it, one (LIMITATION) unconditionally on every lease — "shall not exceed the Horse's current fair market value of." with nothing after "of".
- quote: "**F17 — `HORSE.FAIR_MARKET_VALUE` is not required, and two money clauses print it.**"
- kind: defect
- artifacts: HORSE.FAIR_MARKET_VALUE, CCC, LIMITATION
- decision-mention: none

### ITEM [batch3.md#51]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: TXN.LEASE_TYPE (full vs partial) does not reach the insurance section at all — the distinction the owner is worried about is invisible to every gate in the section.
- quote: "**`TXN.LEASE_TYPE` does not reach the insurance section at all.** Not one insurance clause and not one insurance field is gated on whether the lease is full or partial."
- kind: defect
- artifacts: TXN.LEASE_TYPE, HORSE_LEASE_V2 INSURANCE_RISK
- decision-mention: none

### ITEM [batch3.md#53]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: A Lessee's election does not stay made — the Lessor changing their own status hides the election's clause while the stored YES survives, and restoring the status restores the printed undertaking without the Lessee acting again.
- quote: "**A declaration that does not stay made.** ... Restoring the status restores the printed undertaking without the Lessee acting again."
- kind: defect
- artifacts: TXN.*_LESSEE_RESPONSIBLE fields, set_contract_field
- decision-mention: none

### ITEM [batch3.md#55]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: contacts.is_minor_contact is read by no insurance field or clause.
- quote: "The Lessee is a minor | `contacts.is_minor_contact` | No insurance field or clause reads it."
- kind: defect
- artifacts: contacts.is_minor_contact, HORSE_LEASE_V2 INSURANCE_RISK
- decision-mention: none

### ITEM [batch3.md#60]
- report: TASK-LOCFIX-REPORT.md
- date: 2026-08-05
- item: HORSE_SALE_V2's HORSE.IDENTITY grid has the same long-location "runs onto the label's line" exposure; deliberately not touched (would reflow 10 other fields) — flagged as a follow-up for separate sign-off.
- quote: "the same \"runs onto the label's line\" symptom as defect 2 would reproduce there. I did **not** touch it ... flagging as a follow-up for separate sign-off rather than building it here."
- kind: deferred
- artifacts: HORSE_SALE_V2 HORSE.IDENTITY, HORSE.CURRENT_LOCATION, src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM [batch3.md#61]
- report: TASK-LOCFIX-REPORT.md
- date: 2026-08-05
- item: The Location-section fixes have not been visually confirmed — no browser available; the lease editor was never loaded.
- quote: "**UI is browser-pending** — this environment has no browser available; the fix has not been visually confirmed by loading the lease editor."
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx, LOCATION.MAIN, LOCATION.NEW
- decision-mention: none

---

### ITEM [batch3.md#85]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Two pre-existing test/ui failures unchanged: pluspass_create_controls, and reviewnav_section's `templates` group missing an incumbent (a TEXTEDIT-task gap, not touched here).
- quote: "same two pre-existing failures as `main` (`pluspass_create_controls`, and `reviewnav_section`'s `templates` group missing an incumbent — a TEXTEDIT-task gap, not touched here)"
- kind: known issue
- artifacts: test/ui/pluspass_create_controls, test/ui/reviewnav_section, src/lib/reviewSection.ts
- decision-mention: none

### ITEM [batch3.md#91]
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: Mary Richardson holds two blank-horse DRAFTs of the same templates — the blank→bound supersession ruling will govern her path too; noted as a live consequence.
- quote: "plus Mary Richardson holding two blank-horse DRAFTs of the same templates — the blank→bound ruling will govern her path too"
- kind: caveat
- artifacts: documents (Mary Richardson blank-horse DRAFTs), apply_document_supersession
- decision-mention: none

### ITEM [batch3.md#95]
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: OwnedField's ExplainTip ships with the default dotted underline on (drawn under the label only, not the disabled control) — a flagged judgment call; underline={false} is the one-line change if it renders wrong.
- quote: "it was a genuine judgment call, not an oversight, and it's a one-line change (`underline={false}` on the `ExplainTip` call in `OwnedField`) if the rendered result looks wrong in a real browser"
- kind: not-verified
- artifacts: OwnedField, src/components/app/ExplainTip.tsx, src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM [batch3.md#96]
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: No real device or browser was available: iPhone tap behavior, desktop hover, the 390px clamp's rendered result, converted-site text rendering, and screen-reader output are all verified only via jsdom/diff/reasoning, not on hardware.
- quote: "**Could not verify — no real device or browser available in this environment**"
- kind: not-verified
- artifacts: src/components/app/ExplainTip.tsx, src/components/app/ClauseDocument.tsx, src/components/app/ContractCascade.tsx
- decision-mention: none

### ITEM [batch4.md#26]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: {{CLIENT.JUMP_LIMITATIONS}} merges into nothing — editable in staff dossier, declared in template_tokens, but present in 0 template bodies and 0 clause defs; onboarding never collects it.
- quote: "`{{CLIENT.JUMP_LIMITATIONS}}` merges into nothing ... present in 0 `contract_templates.body` values and 0 `contract_clause_defs.body` values."
- kind: correctness
- artifacts: jump_limitations, template_tokens, ContactDossierModal.tsx, update_my_onboarding_profile
- decision-mention: none

### ITEM [batch4.md#65]
- report: TASK-COMPANYFIX-REPORT.md
- date: 2026-08-05
- item: Recommendation flagged back to the task author — the adversarial proof needs re-scoping to two separate orgs since the single-org version is not executable against the current schema.
- quote: "flag back to the task author that the adversarial proof needs re-scoping (e.g. two separate orgs ...) since the single-org version in the locked design is not executable against the schema as it stands today."
- kind: process
- artifacts: company_contact_id()
- decision-mention: none

### ITEM [batch4.md#67]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: HORSE_BILL_OF_SALE has no picker card (diverged from "6→6 cards") because there is no standalone entry point to author one; needs a new RPC or an explicit sale-only decision. Left for the owner.
- quote: "HORSE_BILL_OF_SALE has no card, and this is the one place I diverged from '6 → 6 cards.' ... **If a standalone bill-of-sale start is wanted**, it needs either a new RPC ... or an explicit decision that it stays sale-only. Left for the owner — not built here."
- kind: blocked-on-owner
- artifacts: HORSE_BILL_OF_SALE, startBillOfSale, CONTRACT_KIND_DESTINATION, DocumentQueuePicker.tsx
- decision-mention: none

### ITEM [batch4.md#70]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: Several preset views are partially unbuilt — Needs attention lacks assigned-but-never-generated obligations and expires_on items (needs uploads build J1b); Signed library lacks template-category grouping; By horse lacks health-due-date surfacing.
- quote: "Not built (what it needs) ... Assigned-but-never-generated obligations ... and `expires_on`-based items — neither exists yet; the second needs the uploads build (J1b)."
- kind: correctness
- artifacts: DocumentsQueuePage.tsx, contact_required_documents, horse_health_events
- decision-mention: none

### ITEM [batch4.md#71]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: The Templates tab from design-doc v2 (full version-control workflow) was not built or attempted — a separate much larger spec.
- quote: "The **Templates tab** from design-doc v2 §4–5 ... is a separate, much larger spec that this task never asked for — not built, not attempted."
- kind: correctness
- artifacts: DocumentsQueuePage.tsx
- decision-mention: none

### ITEM [batch4.md#75]
- report: TASK-DOCVIS-REPORT.md
- date: 2026-08-04
- item: my_documents()'s "pending" branch was widened alongside "executed" as a reading of the design's general wording — a judgment call beyond the literal executed-only bug report, called out explicitly.
- quote: "`my_documents()`'s 'pending' branch was widened alongside 'executed' as a reading of the locked design's general wording; this is a judgment call beyond the literal bug report ... and is called out here rather than silently bundled in."
- kind: correctness
- artifacts: my_documents()
- decision-mention: none

### ITEM [batch4.md#94]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The four lease templates (V2/FULL/SIMPLE/STANDARD) are byte-for-byte identical redundant copies created for a divergence that hasn't happened; every lease content change is a 4x write. Nothing deleted; owner decision on which of three options.
- quote: "**They are three redundant copies, created for a divergence that has not happened yet. Nothing was deleted, as instructed.** ... **The decision is the owner's.** Three options, none taken here"
- kind: blocked-on-owner
- artifacts: HORSE_LEASE_V2, HORSE_LEASE_FULL, HORSE_LEASE_SIMPLE, HORSE_LEASE_STANDARD, NewContractPage.tsx
- decision-mention: none

### ITEM [batch4.md#95]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The lease-version picker shows five options that all produce the identical document — a confusing surface today that worsens the moment one fork diverges.
- quote: "Reading it, a staff member is asked to choose between 'Horse Lease Agreement', '— Standard', '— Comprehensive' and '— Simple' that all produce the identical document. That is a confusing surface today"
- kind: correctness
- artifacts: NewContractPage.tsx, listLeaseTemplates()
- decision-mention: none

### ITEM [batch4.md#96]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Found not fixed — FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are active=true, selectable, with body='' and zero clause defs, so a document generated from either would have no text.
- quote: "**Two active templates compose an empty document.** `FACILITY_LICENSE` and `INDEPENDENT_CONTRACTOR` are `active = true`, selectable, and carry **`body = ''` and zero clause defs**."
- kind: defect
- artifacts: FACILITY_LICENSE, INDEPENDENT_CONTRACTOR, FlatDocument.tsx
- decision-mention: none

### ITEM [batch4.md#97]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Found not fixed — listContractTemplates() (src/lib/api.ts:1093) has no callers; dead read path, not deleted.
- quote: "**`listContractTemplates()` (`src/lib/api.ts:1093`) has no callers.** The only template picker in the app uses `listLeaseTemplates()`. Dead read path; not deleted."
- kind: inventory
- artifacts: listContractTemplates() (src/lib/api.ts:1093)
- decision-mention: none

### ITEM [batch4.md#98]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Found not fixed — the ops document viewer's SigningPanel presents a sign box for every unsigned party but record_signature() admits staff only for the org's own company contact, so it's an affordance that fails on click.
- quote: "**The ops document viewer offers signing the server refuses.** ... the ops viewer was never updated to match. **This is an affordance that fails on click**"
- kind: defect
- artifacts: SigningPanel, record_signature(), /app/ops/documents/:id, ContractPage
- decision-mention: none

### ITEM [batch4.md#100]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The inline body-preview block was retired behind INLINE_BODY_PREVIEW_RETIRED=true (not deleted) rather than removed.
- quote: "It is retired behind `INLINE_BODY_PREVIEW_RETIRED = true` (the `CONTACTS_PAGE_RETIRED` pattern), not deleted."
- kind: inventory
- artifacts: ContractPage.tsx, INLINE_BODY_PREVIEW_RETIRED
- decision-mention: none

### ITEM [batch4.md#101]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: The rendered page is NOT VERIFIED — no staff browser session; everything proved against SQL and a production build only.
- quote: "**The rendered page is NOT VERIFIED.** No staff browser session exists. Everything above is proved against SQL and a clean production bundle build."
- kind: not-verified
- artifacts: ContractPage.tsx, FlatDocument.tsx, ClauseDocument.tsx
- decision-mention: none

### ITEM [batch4.md#102]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: FLAT→CLAUSE conversion for 12 flat templates was reported not started (per task); estimated ~3-5 threads, sequenced by value; the four negotiated commercial agreements recommended first.
- quote: "FLAT → CLAUSE CONVERSION — what it would involve (reported, not started) ... **Roughly 3–5 threads**, and it should be sequenced by value, not by size"
- kind: correctness
- artifacts: HORSE_SEARCH_RETAINER, HORSE_TRANSACTION_REP, INDEPENDENT_CONTRACTOR, FACILITY_LICENSE
- decision-mention: none

### ITEM [batch4.md#103]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Contract/document DB suite shows 9 failed / 2 passed, byte-identical on origin/main (pre-existing).
- quote: "contract/document DB suite (11 files) | 9 failed / 2 passed — **byte-identical on `origin/main`**, pre-existing"
- kind: process
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#115]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: The "should staff override the refusal" question — recommendation is yes eventually but not as a "send anyway" button (would silently answer six open re-sign/version decisions); build "ask for a re-signature" instead. Not part of this task.
- quote: "**Recommendation: yes, eventually — but not as part of this task, and not as a 'send anyway' button.** ... A 'send anyway' button would quietly pick answers to all six."
- kind: blocked-on-owner
- artifacts: invite_contract_counterparty
- decision-mention: none

### ITEM [batch4.md#125]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: Contradiction in the brief — it says demands are manufactured by the wall AND that Madeline genuinely owes two re-signed documents; those can't both be true. Followed the corrected section per the tie-break rule; the "still walled" verification item 3 is uncorrected pre-correction text.
- quote: "The brief states two things that cannot both be true ... The residual 'still walled' wording is `## Verification` item 3, which is pre-correction text the correction did not sweep. **I followed the CORRECTED section**"
- kind: correctness
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#126]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: require_resign_from() was already partly broken — it inserted a crd row with ON CONFLICT DO NOTHING, so for anyone already holding the assignment it wrote nothing; version-blindness would have finished it into a total no-op. Fixed to use supersession instead.
- quote: "`require_resign_from()` was already partly broken, and version-blindness would have finished it off. ... `resolve_version_decision` would report *N people required* and create zero real obligations."
- kind: defect
- artifacts: require_resign_from(), contact_required_documents, resolve_version_decision
- decision-mention: none

### ITEM [batch4.md#127]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: All 6 template_version_events from the 2026-08-02 contract sprint are still unresolved (resolved_at IS NULL) — the wall was enforcing a queued decision nobody had made. The owner must decide whether those body changes require re-signatures.
- quote: "All **6 events from the 2026-08-02 contract sprint are still `resolved_at IS NULL`.** Nobody has decided that anyone must re-sign. ... Whether any of those body changes were material enough to require past signers to re-sign is your call."
- kind: blocked-on-owner
- artifacts: template_version_events, pending_version_decisions()
- decision-mention: none

### ITEM [batch4.md#128]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: Assumed not verified — that the Bug A backfill touched exactly 19 rows; the UPDATE had already committed, only the end state (0 ambiguous rows) is provable.
- quote: "*Assumed, not verified:* that the backfill's affected count was exactly 19. I could not observe the UPDATE — it had already committed."
- kind: not-verified
- artifacts: 20260807T1200_backfill_signed_template_version_zero.sql
- decision-mention: none

### ITEM [batch4.md#131]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: For the owner — the 6 template version bumps from 2026-08-02 remain unresolved; the decision (ALL/SELECTED/NONE) is left, now actually taking effect after migration 2 whereas it did not before.
- quote: "The 6 template version bumps from 2026-08-02 are still **unresolved** ... As of migration 2 that answer now actually takes effect, which it did not before."
- kind: blocked-on-owner
- artifacts: template_version_events, pending_version_decisions(), resolve_version_decision
- decision-mention: none

### ITEM [batch5.md#5]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: Open question for the review thread — the clause-gate engine may not support `not_equals`/`any`; if not, the staged U2.8 gates must use the positive fallback form.
- quote: "the live gates use only `equals` and `all`. If the engine has no `not_equals`/`any`, use the positive form in the JSON's `fallback_form_if_not_equals_unsupported`"
- kind: open question
- artifacts: docs/staged/U2_8_deductible_gating.json
- decision-mention: none

### ITEM [batch5.md#10]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R1 — HORSE_LEASE v1 is inactive with 0 documents but still holds 104 body tokens and 98 registry rows; retiring it deletes body text and needs an explicit owner decision.
- quote: "`HORSE_LEASE` v1 is **inactive, 0 documents**, but still holds 104 body tokens and 98 registry rows | retiring it deletes body text"
- kind: blocked-on-owner
- artifacts: HORSE_LEASE (template v1), template_tokens
- decision-mention: none

### ITEM [batch5.md#11]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R2 — MINOR_RIDER is active with 0 documents; its GUARDIAN.*/EMERGENCY_CONTACT.* tokens have never been exercised by a real render, and confirming them needs a render, not a table edit.
- quote: "`MINOR_RIDER` is **active, 0 documents**; its `GUARDIAN.*` / `EMERGENCY_CONTACT.*` tokens have never been exercised by a real render | needs a render to confirm"
- kind: not-verified
- artifacts: MINOR_RIDER template, GUARDIAN.* tokens, EMERGENCY_CONTACT.* tokens
- decision-mention: none

### ITEM [batch5.md#12]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R3 — HORSE.MARKINGS, HORSE.PASSPORT_NUMBER, HORSE.VET_ADDRESS, HORSE.VET_BUSINESS resolve through a third, code-only resolution path (generate_document's HORSE branch) with no row in either registry mechanism; registering them is an ownership judgement not made.
- quote: "have **no row in either registry mechanism** — a third, code-only resolution path | registering them is a judgement about which mechanism owns them"
- kind: inventory
- artifacts: generate_document, template_tokens, contract_field_defs
- decision-mention: none

### ITEM [batch5.md#13]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R4 — HORSE.PASSPORT_COUNTRY and HORSE.REGISTRATION_ORG (audit "offenders") exist only in the dead HORSE_LEASE v1; the finding resolves itself only if R1's retirement proceeds.
- quote: "`HORSE.PASSPORT_COUNTRY`, `HORSE.REGISTRATION_ORG` — audit \"offenders\", but only in dead v1 | resolves itself if R1 proceeds"
- kind: deferred
- artifacts: HORSE_LEASE (template v1)
- decision-mention: none

### ITEM [batch5.md#14]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R5 — HORSE_LEASE_V2 has zero template_tokens rows yet renders correctly via contract_field_defs; registering it would be a new convention, not a fix, so nothing was done.
- quote: "`HORSE_LEASE_V2` has **zero** `template_tokens` rows | working as designed via `contract_field_defs`; registering V2 would be a new convention, not a fix"
- kind: inventory
- artifacts: HORSE_LEASE_V2, template_tokens, contract_field_defs
- decision-mention: none

### ITEM [batch5.md#15]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: HORSE_LEASE v1's HORSE.AGE_DOB label ("Age / Date of Birth") was deliberately left alone when V2's was changed to "Foaling date" — inactive template, never the spec's target.
- quote: "`HORSE_LEASE` v1's `HORSE.AGE_DOB` label (`Age / Date of Birth`) was **deliberately left alone** — inactive template, 0 documents"
- kind: inventory
- artifacts: HORSE_LEASE (template v1), HORSE.AGE_DOB
- decision-mention: none

---

### ITEM [batch5.md#23]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: The gate chicken-and-egg fix carries an accepted tradeoff — while unanswered, a gate-driving body-inlined field renders twice (live control above, inert placeholder inline); flagged for the upcoming renderer rebuild.
- quote: "**Flagged for the upcoming renderer rebuild**: a gate-driving field should always have exactly one live rendering regardless of where its token lives."
- kind: known issue
- artifacts: src/components/.../ClauseDocument.tsx
- decision-mention: none

### ITEM [batch5.md#38]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Assumption stated — contract_field_defs keyed by template_key as the definition of "fields the template defines" reproduces NOGUARD2's numbers but the intent itself was not verified.
- quote: "It reproduces the NOGUARD2 numbers exactly (22 and 3), which is strong corroboration but is not the same as having verified the intent."
- kind: not-verified
- artifacts: contract_field_defs, document_integrity()
- decision-mention: none

### ITEM [batch5.md#51]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Render NOT VERIFIED — no staff browser session; a 10-point owner click-through checklist is provided (party columns, links, parent/dependent labels, column menu, version-drift note, etc.).
- quote: "**Render: NOT VERIFIED.** No staff browser session exists in this environment. Checklist above."
- kind: not-verified
- artifacts: /app/ops/documents, DocumentQueueTable.tsx
- decision-mention: none

---

### ITEM [batch5.md#71]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Design call left open — the header marks name 'Libre Caslon Text' directly rather than the app's font-display token (Big Caslon first); whether the header should pick up Big Caslon on macOS is flagged as a design decision, not a porting one.
- quote: "**Flagging in case you want the header to pick up Big Caslon on macOS too — that is a design call, not a porting one.**"
- kind: blocked-on-owner
- artifacts: header-cardstock.css (.cs-wordmark/.cs-fh/.cs-av), tailwind.config.js
- decision-mention: none

---

### ITEM [batch5.md#72]
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: Reported, not fixed (owner-instructed) — apply_document_supersession matches on contact_id + template_key with no horse_id comparison; now that horse documents are horse-bound, executing a vet authorization for one horse will mark the executed authorization for a different horse owned by the same contact superseded. CJ Z's second horse-bound execution is the trigger. Needs its own spec.
- quote: "The predicate is **contact_id + template_key with no `horse_id` comparison**. ... It stops being harmless the moment they are — which is the state this fix now produces."
- kind: defect
- artifacts: apply_document_supersession, documents, HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE
- decision-mention: none

### ITEM [batch5.md#73]
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: The horse_id-comparison spec must answer the NULL case — a naive horse_id predicate would mean Sarah's retained horse-blank documents are never superseded by their horse-bound replacements, leaving her two live documents per template indefinitely; IS NOT DISTINCT FROM answers neither direction correctly.
- quote: "with `horse_id` added naively, Sarah's retained horse-blank documents would **never** be superseded by the horse-bound replacements ... That is the case to design for."
- kind: open question
- artifacts: apply_document_supersession, documents (152912dd, a8623897)
- decision-mention: none

### ITEM [batch5.md#74]
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: No browser click-through — the Documents page showing one retained signed document plus its pending replacement side by side is the visible face of the skip-and-supersede decision and is untested.
- quote: "**Browser click-through** of the Documents page with one retained signed document plus one pending replacement for the same template. Untested; it is the visible face of this decision."
- kind: not-verified
- artifacts: Documents page, ensure_horse_documents
- decision-mention: none

### ITEM [batch5.md#76]
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: Leftover unmerged tokens ({{HORSE.MICROCHIP}}, {{HORSE.FARRIER_NAME}}, {{CLIENT.EMERGENCY_CONTACT_2_NAME}}, …) sit in the two retained signed bodies — a separate pre-existing merge gap, observed only; the executed documents must not be rewritten to fix it.
- quote: "**Leftover merge tokens** in the two retained bodies ... a separate merge gap, observed only. Those two documents are executed evidence and must not be rewritten to fix it."
- kind: defect
- artifacts: documents (152912dd, a8623897), generate_document merge path
- decision-mention: none

### ITEM [batch5.md#77]
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: Data-integrity observation behind the supersede decision — both retained signed documents merged with an EMPTY Horse Name (token substituted with empty string, horse_id NULL, zero document_horses rows): signed vet authorizations for no identified horse.
- quote: "They are signed authorizations for **emergency veterinary care of no identified horse**."
- kind: data-integrity
- artifacts: documents (152912dd, a8623897), HORSE.REGISTERED_NAME
- decision-mention: none

---

### ITEM [batch5.md#84]
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: Correction to the task premise — the Purpose-of-Agreement defect was already fixed by prior merged work (SEEDFIX migration 2026-08-05 + ClauseDocument R1/ownership fixes); no code change was made because none was needed, a genuine "already done" finding.
- quote: "**both halves of the mechanism were already corrected by prior, already-merged work**, on the same day the defect was reported"
- kind: correction
- artifacts: supabase/migrations/20260805170000_seedfix_can_edit_deal_default.sql, ClauseDocument.tsx, ContractPage.tsx, TXN.LEASE_PURPOSE
- decision-mention: none

### ITEM [batch5.md#87]
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: No browser access — the UI proof is a code-cited claim backed by a jsdom DOM render of ClauseDocument against production fixture data (six combinations, select never disabled), not a visual verification; Sarah's document actionability is reasoned from code, not seen.
- quote: "This is not a claim of visual verification — it is a reproducible, code-cited claim backed by an actual DOM render"
- kind: not-verified
- artifacts: ClauseDocument.tsx, TXN.LEASE_PURPOSE, documents (704c8d2d)
- decision-mention: none

---

### ITEM [batch5.md#105]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Browser render NOT VERIFIED — no staff session; a 10-point owner checklist covers the templates list, trio banner, draft chips, publish modal, token picker insertion/badges, flat editor, discard, and the non-admin bounce.
- quote: "## NOT VERIFIED — browser render (no staff session exists)"
- kind: not-verified
- artifacts: /app/ops/admin/templates, AdminTemplatesPage.tsx, AdminTemplateEditorPage.tsx, TokenPicker.tsx
- decision-mention: none

### ITEM [batch5.md#107]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Noted for the next reader, not a bug — resolve_version_decision returns 0 rows-affected on NONE resolutions because its return counts re-sign obligations created, rightly zero.
- quote: "the return counts *re-sign obligations created*, which for `NONE` is rightly zero. Not a bug; noting so the next reader doesn't chase it."
- kind: caveat
- artifacts: resolve_version_decision
- decision-mention: none

### ITEM [batch5.md#108]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: The token picker surfaces TOKENAUDIT's data as-is — the 59 source-retired tokens and the {{ORD.UUID}}→documents.id mislabel remain in template_tokens; they are TOKENAUDIT's open recommendations, deliberately not deleted here.
- quote: "59 `source retired` tokens and the `{{ORD.UUID}}`→`documents.id` mislabel remain in `template_tokens` — display is honest, the underlying rows are TOKENAUDIT's open recommendations, deliberately not deleted here."
- kind: deferred
- artifacts: template_tokens, ORD.UUID, TokenPicker.tsx
- decision-mention: none

### ITEM [batch5.md#109]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: HORSE_REPRESENTATION and MEDIA_RELEASE are inactive flat templates with empty bodies (beyond the two active empties the task names) — editable in the tool like any other flat; surfaced, no action taken.
- quote: "`HORSE_REPRESENTATION` and `MEDIA_RELEASE` are inactive flats with empty bodies (beyond the two active empties the task names)"
- kind: inventory
- artifacts: HORSE_REPRESENTATION, MEDIA_RELEASE, contract_templates
- decision-mention: none

### ITEM [batch5.md#110]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are ACTIVE templates with empty live bodies — flagged in the editor list with a red "empty body" badge; the bodies themselves remain empty.
- quote: "red \"empty body\" on the two empty actives"
- kind: data-integrity
- artifacts: FACILITY_LICENSE, INDEPENDENT_CONTRACTOR, contract_templates
- decision-mention: none

### ITEM [batch5.md#112]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Honest prod side-effect of the proof — the lease trio's version is now 3 (two bumps for a byte-identical publish+revert cycle) and six template_version_events rows exist, all resolved NONE; a true audit trail of the proof, not drift.
- quote: "The lease trio's `version` is now **3** (was 1): +1 for the proof publish, +1 for the byte-exact revert."
- kind: process
- artifacts: contract_templates (HORSE_LEASE_V2, HORSE_LEASE_SIMPLE, HORSE_LEASE_FULL), template_version_events
- decision-mention: D10

### ITEM [batch6.md#1]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Party-controls bootstrap bug: start_lease_contract_v2 / start_sale_contract never insert into document_party_controls, so no invite UI ever renders for a freshly authored contract, blocking A2/A3/A4.
- quote: "start_lease_contract_v2 (and start_sale_contract, checked as a sibling — same gap) never inserts into document_party_controls. ... a freshly created contract has zero rows in that table, so the only UI that could ever create the first row never renders."
- kind: defect
- artifacts: start_lease_contract_v2, start_sale_contract, document_party_controls, ContractPage.tsx, contract_document_detail
- decision-mention: none

### ITEM [batch6.md#7]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Author's own first-pass error — looked in the wrong table (contracts, not documents) and incorrectly reported the reference document as missing; logged as a visible correction.
- quote: "My first pass looked in the wrong table (contracts, not documents) and incorrectly reported the document as missing — the owner corrected this; logged so the error is visible, not silently absorbed."
- kind: correctness
- artifacts: contracts, documents
- decision-mention: none

### ITEM [batch6.md#18]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: Owner ruling needed — should structural authoring be allowed during in_review? As shipped the owner cannot use Add item on either live lease (both in_review) without reopening for editing; fix is widening five RPCs.
- quote: "Should structural authoring be allowed during in_review? — owner ruling needed. ... as shipped, the owner cannot exercise Add item on either of them"
- kind: blocked-on-owner
- artifacts: add_contract_composition, remove_contract_composition, add_contract_element, propose_clause, set_field_included, ContractPage.tsx
- decision-mention: D14

### ITEM [batch6.md#20]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: remove_contract_composition on an element leaves a dangling {{CUSTOM.…}} token in the prose; the UI deliberately does not offer element removal for this reason.
- quote: "Deleting an element row leaves {{CUSTOM.NAME_3}} in the prose of any line that placed it, which then composes as the literal token (or N/A after execution)."
- kind: defect
- artifacts: remove_contract_composition
- decision-mention: none

### ITEM [batch6.md#21]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: A line whose only token is unanswered composes as a bare sentence with a full stop ("Off-site transport is arranged by."); pre-existing behaviour of remerge_contract_from_clauses.
- quote: "A line whose only token is unanswered composes as a bare sentence with a full stop — 'Off-site transport is arranged by.'. Pre-existing behaviour of remerge_contract_from_clauses"
- kind: defect
- artifacts: remerge_contract_from_clauses
- decision-mention: none

### ITEM [batch6.md#26]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: Headline finding — no composition has ever landed in production; contract_fields holds zero author-added rows before and after.
- quote: "Not one authored item, of any kind, has ever been saved."
- kind: data-integrity
- artifacts: contract_fields, add_contract_composition
- decision-mention: none

### ITEM [batch6.md#29]
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05
- item: No browser click-through — nobody opened ContractPage as CJ against a locked company-party document and clicked "Sign as French Heritage Equestrian"; marked PARTIAL.
- quote: "No browser click-through. Every proof above is psql against production with a simulated session ... nobody has opened ContractPage in a real browser"
- kind: not-verified
- artifacts: ContractPage.tsx
- decision-mention: none

### ITEM [batch6.md#47]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Euthanasia change (Step 5 gate) not made — the shape decision (stamp B silently vs fixed clause, and what happens to CLIENT.EUTHANASIA_INITIALS) is behind the gate awaiting owner.
- quote: "Stopped at the Step 5 gate — no euthanasia change was made. ... The euthanasia shape — (a) stamp B silently and drop the section, or (b) drop the field and state it as a fixed clause"
- kind: blocked-on-owner
- artifacts: euthanasia_authorization, CLIENT.EUTHANASIA_INITIALS
- decision-mention: none

### ITEM [batch6.md#54]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Pre-existing dead gate in HORSE_LEASE_V2 (found and NOT fixed) — TXN.MONTHLY_START is gated on TXN.LEASE_FEE_TYPE which doesn't exist, so "First monthly payment date" can never appear; faithfully dead in all three forks.
- quote: "the field TXN.MONTHLY_START ('First monthly payment date') is gated on TXN.LEASE_FEE_TYPE, which does not exist in the template. ... This is a content defect and content is out of scope, so I did not touch it"
- kind: defect
- artifacts: HORSE_LEASE_V2, TXN.MONTHLY_START, TXN.LEASE_FEE_TYPE, contract_field_defs, clause_condition_met, clauseConditionMet
- decision-mention: none

### ITEM [batch6.md#57]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Correction to ground truth — a seventh satellite table (template_tokens, keyed on template_id) exists that the task's six-table list omitted; zero rows for HORSE_LEASE_V2 so the fork's four-table scope still holds.
- quote: "Correction to the ground truth — a seventh satellite table exists. ... template_tokens, which keys on template_id (not template_key) and so would not surface in a template_key sweep"
- kind: correctness
- artifacts: template_tokens
- decision-mention: none

### ITEM [batch6.md#58]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Related observation, untouched — the retired HORSE_LEASE template still holds 98 orphan contract_field_defs rows with no sections and no clauses.
- quote: "the retired HORSE_LEASE template (§4a) still holds 98 orphan contract_field_defs rows with no sections and no clauses."
- kind: data-integrity
- artifacts: HORSE_LEASE, contract_field_defs
- decision-mention: none

### ITEM [batch6.md#63]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: The four cloned tables are verified sufficient for these forks today but not in general — a future source template carrying satellite rows would need more.
- quote: "That the four cloned tables are sufficient in general. Verified sufficient for these forks today ... A future source template carrying satellite rows would need more."
- kind: caveat
- artifacts: clone_contract_template
- decision-mention: none

---

### ITEM [batch6.md#65]
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: Found while reading (inherited from V2) — TXN.MONTHLY_START ("First monthly payment date") is already orphaned, attached to clause_key LEASE_FEE.PAYMENTS which does not exist in either template.
- quote: "TXN.MONTHLY_START ('First monthly payment date') is already orphaned. It is attached to clause_key = 'LEASE_FEE.PAYMENTS', a clause that does not exist in either template."
- kind: data-integrity
- artifacts: TXN.MONTHLY_START, LEASE_FEE.PAYMENTS, contract_field_defs
- decision-mention: none

### ITEM [batch6.md#67]
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: Found while reading — where the Lessor arranges farrier/vet care, §12.5/§12.6 print "Farrier:"/"Veterinarian:"/"Practice:"/"Address:" labels with nothing after them (body tokens ungated while fields are gated).
- quote: "§12.5 and §12.6 print 'Farrier:', 'Veterinarian:', 'Practice:' and 'Address:' with nothing after them — those fields are gated to TXN.FARRIER_ARRANGE = LESSEE / TXN.VET_ARRANGE = LESSEE while the tokens in the body are ungated."
- kind: defect
- artifacts: HORSE_LEASE_SIMPLE §12.5/§12.6, TXN.FARRIER_ARRANGE, TXN.VET_ARRANGE
- decision-mention: none

### ITEM [batch6.md#68]
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: The protective/standalone classifications are hand-read judgments, not computed, and explicitly not legal advice; a clause wrongly marked standalone is the damaging failure mode.
- quote: "A clause wrongly marked standalone is the failure mode that causes real damage, because it will be cut on that basis. ... This is a flag to take to counsel, not legal advice. I am not a lawyer"
- kind: caveat
- artifacts: WORKSHEET.md protective/standalone columns
- decision-mention: none

---

### ITEM [batch6.md#96]
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: test/db/fixtures/schema_snapshot.sql has drifted from production (still holds the six deleted templates) and test:db is red on main independently of this work; not regenerated (out of scope).
- quote: "test/db/fixtures/schema_snapshot.sql has drifted from production (still holds the six templates), and test:db is red on main independently of this work."
- kind: known-issue
- artifacts: test/db/fixtures/schema_snapshot.sql, test:db
- decision-mention: none

### ITEM [batch6.md#97]
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: MINOR_RIDER and HORSE_REPRESENTATION are body-less, retired-in-practice template rows still present in contract_templates; out of scope, noted since the inventory surfaced them.
- quote: "MINOR_RIDER and HORSE_REPRESENTATION are body-less, retired-in-practice template rows still present in contract_templates. Out of scope here — noting them"
- kind: inventory
- artifacts: MINOR_RIDER, HORSE_REPRESENTATION, contract_templates
- decision-mention: none

### ITEM [batch6.md#98]
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: Judgment call / scope extension called out — deleted six template_variants rows keyed HORSE_EVALUATION (beyond the literal delete list); their contents preserved verbatim in a migration comment in case the call was wrong.
- quote: "This is the one place I went beyond the literal delete list ... Their exact contents are preserved verbatim in a comment block in the migration, so restoring them is a copy-paste if this call was wrong."
- kind: process
- artifacts: template_variants, generate_document
- decision-mention: none

### ITEM [batch6.md#99]
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: The def-tables premise in the task doc was slightly off — the six are flat-body templates holding zero section/clause/field defs; the DELETEs reported DELETE 0 as expected.
- quote: "The def tables were already empty — the task doc's premise was slightly off. ... they reported DELETE 0, as expected. Nothing was missed — the rows simply never existed."
- kind: correctness
- artifacts: contract_section_defs, contract_clause_defs, contract_field_defs
- decision-mention: none

### ITEM [batch6.md#100]
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: Assumed (not verified) — the owner's business ruling that the six contracts are not in use and will not be; verified the data consequence (zero documents) but not the business intent.
- quote: "The owner's ruling that these six contracts are not in use and will not be. I verified the data consequence of that ruling (zero documents ever generated); I did not and cannot verify the business intent behind it."
- kind: not-verified
- artifacts: contract_templates
- decision-mention: none

---

### ITEM [batch7.md#6]
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: The non-staff rejection was not live-tested (no party JWT minted); evidence is citation of an identical guard on publish_open_slots.
- quote: "I did not mint a party JWT (no test-user session available in this worktree). Evidence is the citation + identical-guard argument ... No live negative test was run."
- kind: not-verified
- artifacts: contract_event_log, publish_open_slots, has_staff_access()
- decision-mention: none

### ITEM [batch7.md#39]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #2 — generate_lease_availability parses TXN.DAYS_USED as a comma list but the live lease holds a prose sentence, producing wrong day tokens; the day parsing is wrong and predates this task.
- quote: "the day parsing is wrong and predates this task."
- kind: defect
- artifacts: generate_lease_availability, TXN.DAYS_USED
- decision-mention: none

### ITEM [batch7.md#40]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #3 — generate_lease_availability had been unreachable (filtered on archived template key HORSE_LEASE); retargeted to the live family. The feature has never run in production.
- quote: "`generate_lease_availability` had been unreachable ... Worth knowing that this feature has never run in production."
- kind: defect
- artifacts: generate_lease_availability
- decision-mention: D10

### ITEM [batch7.md#112]
- report: TASK-PARTYCTRL-REPORT.md
- date: 2026-08-04
- item: Backfill included CLIENT/PARTICIPANT onboarding documents outside the three starters' template scope because the backfill clause is document-pattern-based, not starter-scoped; flagged as an inclusion decision.
- quote: "the CLIENT/PARTICIPANT documents are onboarding-style contracts outside the three starters' template scope, but the task spec's backfill clause is document-pattern-based ... so they're included."
- kind: correctness
- artifacts: document_party_controls, document_parties
- decision-mention: none

### ITEM [batch7.md#116]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Systemic finding — SNAPSHOT_DATA_TABLES is a hand-maintained allowlist; every migration-seeded reference table not on it is a silent latent suite failure. Seven were found by chasing failures; there is no guard for the eighth.
- quote: "This is the systemic finding. The allowlist is a hand-maintained list, and every migration-seeded reference table that isn't on it is a silent, latent suite failure ... There is no guard that would catch the eighth."
- kind: process
- artifacts: SNAPSHOT_DATA_TABLES, harness.ts, modules, tiers, horse_breeds, org_modules, template_variants
- decision-mention: none

### ITEM [batch8.md#4]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The sworn affidavit (which absorbed the notary requirement) has no content, no template, and no home for the notary block; deferred by owner.
- quote: "Sworn affidavit: no content, no template, notary block has nowhere to live yet."
- kind: blocked-on-owner
- artifacts: (affidavit template, not created)
- decision-mention: none

### ITEM [batch8.md#6]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Two owner out-of-band commits (1fd6339, d1bbcb9) touch ClauseDocument.tsx and add two migrations whose applied state the assistant never verified.
- quote: "Two owner commits (`1fd6339`, `d1bbcb9`) touch `ClauseDocument.tsx` and add 2 migrations never verified as applied"
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx, 20260803010000_fold_location_into_horse.sql, 20260803010001_horse_location_multiline.sql
- decision-mention: none

### ITEM [batch8.md#14]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The .document-paper shared render class was applied to 5 surfaces but only two were checked, only via code, never in a browser.
- quote: "**The `.document-paper` class** was applied to 5 surfaces; only the ops viewer and contract page were checked, and only via code, never in a browser."
- kind: not-verified
- artifacts: src/index.css (.document-paper), DocumentViewerPage.tsx, ContractPage.tsx, ClauseDocument.tsx
- decision-mention: none

### ITEM [batch8.md#20]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — HORSE_SALE_V2 kept live rather than retired after the BOS became the primary instrument.
- quote: "Keeping `HORSE_SALE_V2` live rather than retiring it after the BOS became the primary instrument."
- kind: blocked-on-owner
- artifacts: contract_templates (HORSE_SALE_V2)
- decision-mention: none

### ITEM [batch8.md#31]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: R4 as written makes the owner's live no-insurance client arrangement unexecutable and deletes the three risk-acceptance clauses; flagged as the rule to stop on before building anything.
- quote: "**Configurations that become unreachable after R4:** the no-insurance arrangement, in full. ... **yes, the owner's live client configuration stops being expressible.** Not degraded — unexecutable."
- kind: blocked-on-owner
- artifacts: TXN.GL_NOT_REQUIRED, TXN.MORT_NOT_REQUIRED, TXN.MED_NOT_REQUIRED, GL_NONE, MORT_NONE, MED_NONE
- decision-mention: none

### ITEM [batch8.md#32]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: R1 and R2 self-contradict — forcing the Lessee's mortality/medical status to NONE opens the *_LESSEE_RESPONSIBLE checkboxes offering the exact undertaking R1/R2 declare ineligible, verified against the live gate evaluator.
- quote: "**R1 and R2 open the door they are meant to close.** ... offered a checkbox whose clause reads *'Lessee shall obtain and maintain, at Lessee's sole cost, mortality insurance on the Horse'* — the exact undertaking R1 declares them ineligible to make."
- kind: correctness
- artifacts: TXN.MORT_LESSEE_RESPONSIBLE, TXN.MED_LESSEE_RESPONSIBLE, clause_condition_met
- decision-mention: none

### ITEM [batch8.md#33]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Phase 2's gates would land on HORSE_LEASE_STANDARD, but no document is on that template and start_lease_contract_v2 still defaults to HORSE_LEASE_V2 — the cutover is out of scope and unassumed, so gates would appear on no newly created lease.
- quote: "**So Phase 2's gates will not appear on any lease anyone creates until that default is flipped.** That cutover is not in this task's scope and I have not assumed it happened."
- kind: caveat
- artifacts: start_lease_contract_v2, HORSE_LEASE_STANDARD, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch8.md#37]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: The ClauseDocument.tsx renderToken diff for the "Not Eligible" affordance was reported, not applied — the file is frozen; the diff was never compiled or run.
- quote: "## `ClauseDocument.tsx` — the render does need it. Diff reported, not applied."
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx, src/lib/contracts.ts, ExplainTip
- decision-mention: none

### ITEM [batch8.md#39]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q1 — what replaces the waiver: "both parties NONE" does not reproduce today's behavior; the *_NONE clauses are load-bearing and are lost under R4-as-written; needs owner resolution before R1/R2 are built.
- quote: "**'Both parties select NONE' does not reproduce today's behaviour, and the checkbox is not redundant.** ... under R4-as-written they are lost."
- kind: blocked-on-owner
- artifacts: TXN.*_NOT_REQUIRED fields, contract_lock_blockers, insurance_resolution_sync
- decision-mention: none

### ITEM [batch8.md#42]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q4 — a forced NONE prints as a choice the Lessee made ("Does not have and will not obtain"); the vocabulary has no word for "cannot", and whether that document text is acceptable is an owner call.
- quote: "'Not Eligible' is a **form** affordance; the **document** will still read as a choice the Lessee made. Whether that is acceptable is an owner call — the vocabulary genuinely has no word for 'cannot'"
- kind: blocked-on-owner
- artifacts: token_display_value, TXN.MORT_LESSEE_STATUS, TXN.MED_LESSEE_STATUS
- decision-mention: none

### ITEM [batch8.md#45]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Inferred rather than observed — the forced-NONE render, the sufficiency of the reported diff, and the silent column-drop behavior were read from code, never run.
- quote: "no lease has ever had a current-generation insurance field filled, so I have not seen it render."
- kind: not-verified
- artifacts: token_display_value, ClauseDocument.tsx, sync_contract_fields_from_defs
- decision-mention: none

### ITEM [batch8.md#47]
- report: TASK-LEASESET-REPORT.md
- date: 2026-08-11
- item: The NewContractPage lease-version picker change (Default option removed, HORSE_LEASE_V2 pre-selected) was not verified in a browser — no staff session available.
- quote: "per the task's own instruction I have **not** verified it in a browser (no staff session available) — reported as **NOT VERIFIED** below, exactly as instructed."
- kind: not-verified
- artifacts: src/pages/app/ops/NewContractPage.tsx, listLeaseTemplates
- decision-mention: none

### ITEM [batch8.md#48]
- report: TASK-LEASESET-REPORT.md
- date: 2026-08-11
- item: HORSE_LEASE_SIMPLE and HORSE_LEASE_FULL were deliberately left active as byte-identical copies per explicit owner ruling.
- quote: "**Did not deactivate `HORSE_LEASE_SIMPLE` or `HORSE_LEASE_FULL`.** The owner explicitly ruled three byte-identical active copies is the correct state until he modifies one."
- kind: blocked-on-owner
- artifacts: contract_templates (HORSE_LEASE_SIMPLE, HORSE_LEASE_FULL)
- decision-mention: D10

### ITEM [batch8.md#50]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: ContractSubheader.tsx:261 carries the same underline-flicker defect (copied from NAV_ROW_IDLE) — found in the sweep but not fixed, outside this task's file ownership; one-token fix.
- quote: "**`ContractSubheader.tsx:261`** carries the §A flicker — it copied `NAV_ROW_IDLE`'s declaration and inherited the bug. Outside this task's file ownership. One-token fix."
- kind: defect
- artifacts: src/components/app/ContractSubheader.tsx
- decision-mention: none

### ITEM [batch8.md#70]
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: Correction — the task table's "current cap" and "+ controls" columns were wrong for most of the 9 pages (numbers grepped from nested modals/sub-components, not page wrappers); every page was re-verified against actual JSX before conversion.
- quote: "**the task's 'current cap' and '+ controls' columns were wrong for most of the 9 pages.** Not close — wrong page-level facts."
- kind: correction
- artifacts: DealsPage.tsx, Admin.tsx, NewContractPage.tsx, ContractPage.tsx, DealPage.tsx, LookupReviewPage.tsx
- decision-mention: none

### ITEM [batch8.md#102]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: One pre-existing skipped UI test file (clause_ownership_affordance.test.tsx requires npm run build:client first) was not attempted — unrelated to this task.
- quote: "5 skipped (one file, `clause_ownership_affordance.test.tsx`, requires `npm run build:client` to have run first; pre-existing, unrelated to this task, not attempted)"
- kind: known issue
- artifacts: test/ui/clause_ownership_affordance.test.tsx
- decision-mention: none

---
