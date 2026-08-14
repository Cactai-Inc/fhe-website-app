## CTA-A01: Four lease templates are still byte-identical copies
- item: HORSE_LEASE_V2, _FULL, _SIMPLE and _STANDARD hold identical bodies, clauses and field defs, so every lease content change is a 4x write.
- sources: TASK-ONEAUTHOR-REPORT.md (2026-08-11); TASK-LEASESET-REPORT.md (2026-08-11); TASK-DUPECENSUS-REPORT.md (2026-08-12)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `select count(distinct md5(coalesce(body,''))) from contract_templates where template_key in ('HORSE_LEASE_V2','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE','HORSE_LEASE_STANDARD')` → 1. Clause-set hash per template (md5 of section_key||clause_key||heading||body ordered) → 1 distinct value across all four. Field-def hash per template → 1 distinct value. Each carries 22 sections / 163 clauses / 114 field defs. Only change since the reports: HORSE_LEASE_STANDARD is now `active=false, version=1` while the other three are `active=true, version=3` (migration 20260811T1800_leaseset_standard_simple_detailed_archive.sql, commit 4e4e012).
- decision-note: D10 (owner ruled three byte-identical active copies is the correct state until he modifies one) — recorded, not used to close.
- cost-rank: 3
- recommendation: Take the owner's decision on the three options ONEAUTHOR listed (keep the fan-out, collapse to one template with a variant flag, or let them diverge on first real edit) before any further lease content work multiplies again.

## CTA-A02: The lease picker offers several options that all produce the same document
- item: New contract's lease-version picker lists Standard / Detailed / Simple, all of which compose an identical instrument.
- sources: TASK-ONEAUTHOR-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: src/lib/api.ts:1178 `listLeaseTemplates()` filters `contract_kind='HORSE_LEASE' AND active AND deleted_at IS NULL`. Prod: that predicate returns HORSE_LEASE_FULL ("— Detailed"), HORSE_LEASE_SIMPLE ("— Simple"), HORSE_LEASE_V2 ("— Standard"); HORSE_LEASE and HORSE_LEASE_STANDARD are inactive and excluded. The count is now 3, not the 5 the report described, but per CTA-A01 all three are byte-identical. src/pages/app/ops/NewContractPage.tsx:55 defaults to HORSE_LEASE_V2.
- decision-note: D10
- cost-rank: 5
- recommendation: Until the templates diverge, collapse the picker to one entry (or label the three as "same text, reserved for divergence") so staff are not asked to choose between indistinguishable options.

## CTA-A03: TEXTEDIT's publish proof left the lease trio at version 3
- item: The lease trio's template version is now 3 (two bumps from a byte-identical publish-then-revert proof), with six template_version_events rows all resolved NONE.
- sources: TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: `select template_key, version from contract_templates` → HORSE_LEASE_V2/_FULL/_SIMPLE all version 3. `select template_key, from_version, to_version, occurred_at::date, resolved_at::date, resolution, people_required from template_version_events` → six 2026-08-12 rows (1→2 and 2→3 for each of the three), every one `resolved_at = 2026-08-12, resolution = NONE, people_required = 0`. No re-sign obligation was created; the audit trail is intact and self-consistent. Commit f05ccbc.
- decision-note: D10
- cost-rank: 6
- recommendation: Nothing to do — record that version 3 has no content meaning for the trio so a future reader does not chase a phantom change.

## CTA-A04: MINOR_RIDER is an active template with a body and zero token rows
- item: MINOR_RIDER is active with a 5,481-byte body and no scoped template_tokens rows, so generating from it would render every token literally; it has never been rendered.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12); PROMPT_A_STAGES_1-3.md (2026-08-01); TASK-SVCPURGE-REPORT.md (2026-08-06)
- raised: 2026-08-01
- status: STILL OPEN
- evidence: `select active, version, length(body) from contract_templates where template_key='MINOR_RIDER'` → t, 1, 5481. `select count(*) from template_tokens tt join contract_templates t on t.id=tt.template_id where t.template_key='MINOR_RIDER'` → 0. `select count(distinct m[1]) from contract_templates t, regexp_matches(t.body,'\{\{([A-Z0-9_.]+)\}\}','g') m where t.template_key='MINOR_RIDER'` → 26 distinct tokens in the body. `select count(*) from documents d join contract_templates t on t.id=d.template_id where t.template_key='MINOR_RIDER' and d.deleted_at is null` → 0 (never rendered, so the GUARDIAN.*/EMERGENCY_CONTACT.* tokens are still unexercised). The SVCPURGE purge set (migration 20260806120000_svcpurge_retire_service_contracts.sql) did NOT include MINOR_RIDER.
- decision-note: none
- cost-rank: 1
- recommendation: Deactivate MINOR_RIDER (one UPDATE) until either its token rows are seeded or the body is converted; leaving an active template that renders raw `{{…}}` is a live trap.

## CTA-A05: FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are active with empty bodies
- item: Two templates are active and selectable but carry `body=''` and zero clause/section/field defs, so a document generated from either would have no text.
- sources: TASK-ONEAUTHOR-REPORT.md (2026-08-11); TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `select template_key, active, length(coalesce(body,'')) from contract_templates where template_key in ('FACILITY_LICENSE','INDEPENDENT_CONTRACTOR')` → both `t, 0`; section/clause/field def counts all 0. The only mitigation since is cosmetic: src/pages/app/ops/admin/AdminTemplatesPage.tsx:39 renders a red "empty body" badge in the editor list. The bodies themselves are still empty.
- decision-note: none
- cost-rank: 1
- recommendation: Deactivate both, or write their bodies in the TEXTEDIT editor. An active empty template is a document that executes as a blank page.

## CTA-A06: Body-less template rows still sit in contract_templates
- item: HORSE_REPRESENTATION and MEDIA_RELEASE are inactive templates with empty bodies, left in the table as retired-in-practice rows.
- sources: TASK-SVCPURGE-REPORT.md (2026-08-06); TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `select template_key, active, length(coalesce(body,'')) from contract_templates where template_key in ('HORSE_REPRESENTATION','MEDIA_RELEASE')` → HORSE_REPRESENTATION `f, 0`; MEDIA_RELEASE `f, 0`. Both rows are still present. (HORSE_REPRESENTATION was `active` when SVCPURGE flagged it and is now inactive; the row itself was never removed.)
- decision-note: none
- cost-rank: 6
- recommendation: Delete both rows or write bodies for them; inactive+empty is a third state nobody reads deliberately.

## CTA-A07: HORSE_LEASE v1 is retired but still holds body text and 98 orphan field defs
- item: The inactive HORSE_LEASE template still carries 104 body tokens and 98 contract_field_defs rows with no sections or clauses; retiring it properly deletes body text and needs an owner decision, and the two "offender" tokens live only there.
- sources: PROMPT_A_STAGES_1-3.md (2026-08-01, R1 and R4); TASK-LEASEFORK-REPORT.md (2026-08-07)
- raised: 2026-08-01
- status: STILL OPEN
- evidence: `select active, length(body) from contract_templates where template_key='HORSE_LEASE'` → f, 18253. `select count(distinct m[1]) from contract_templates t, regexp_matches(t.body,'\{\{([A-Z0-9_.]+)\}\}','g') m where t.template_key='HORSE_LEASE'` → 104. `select count(*) from contract_field_defs where template_key='HORSE_LEASE'` → 98, with zero rows in contract_section_defs/contract_clause_defs for that key. `select distinct template_key from contract_templates where body like '%HORSE.PASSPORT_COUNTRY%' or body like '%HORSE.REGISTRATION_ORG%'` → HORSE_LEASE only, so R4 still resolves only if R1 proceeds.
- decision-note: D10 (LEASESET archived HORSE_LEASE by setting active=false, migration 20260811T1800; the row and its defs were kept)
- cost-rank: 3
- recommendation: Get the owner's ruling on hard-deleting HORSE_LEASE v1 (body + 98 defs) versus keeping the archived row; either way the 98 def rows with no parent structure should not survive.

## CTA-A08: HORSE_LEASE v1's HORSE.AGE_DOB label was deliberately left stale
- item: v1 still labels HORSE.AGE_DOB "Age / Date of Birth" while every live template says "Foaling date".
- sources: PROMPT_A_STAGES_1-3.md (2026-08-01)
- raised: 2026-08-01
- status: STILL OPEN
- evidence: `select template_key, label from contract_field_defs where field_key='HORSE.AGE_DOB'` → HORSE_LEASE = "Age / Date of Birth"; HORSE_BILL_OF_SALE, HORSE_LEASE_FULL, HORSE_LEASE_SIMPLE, HORSE_LEASE_STANDARD, HORSE_LEASE_V2, HORSE_SALE_V2 all = "Foaling date".
- decision-note: none
- cost-rank: 6
- recommendation: Resolve with CTA-A07 — if v1 is deleted the label goes with it; if it is kept, align it.

## CTA-A09: HORSE_LEASE_V2 has zero template_tokens rows by design
- item: The clause-engine lease renders correctly through contract_field_defs and holds no template_tokens rows at all; registering it would be a new convention rather than a fix.
- sources: PROMPT_A_STAGES_1-3.md (2026-08-01, R5); TASK-LEASEFORK-REPORT.md (2026-08-07)
- raised: 2026-08-01
- status: STILL OPEN
- evidence: `select count(*) from template_tokens tt join contract_templates t on t.id=tt.template_id where t.template_key like 'HORSE_LEASE%'` → 0 for every lease template. `select count(*) from contract_field_defs where template_key='HORSE_LEASE_V2'` → 114. Both registries are still in use side by side; nothing has reconciled them.
- decision-note: none
- cost-rank: 4
- recommendation: Record the convention explicitly (clause-engine templates use contract_field_defs, flat templates use template_tokens) so the next reader does not treat the empty token set as a gap.

## CTA-A10: The picker draws on two separate token vocabularies
- item: template_tokens and contract_field_defs are two parallel dictionaries; most of the "used-but-undefined" tokens are simply clause-engine field keys from the second one.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select count(*) from template_tokens` → 360 rows, 185 distinct token strings (the report's 307 predates later inserts). `select count(*) from contract_field_defs` → 667 rows, 241 distinct dotted field_keys. src/components/ops/templates/TokenPicker.tsx reads only the template_tokens side (via the `template_editor_tokens` RPC), so the clause-engine vocabulary is not offered in the picker.
- decision-note: none
- cost-rank: 4
- recommendation: Decide whether the picker should offer both vocabularies (with the source labelled) or stay flat-template-only; document the split either way.

## CTA-A11: template_tokens.source_table/source_column are documentation and 59 are dead
- item: The source_table/source_column columns do not drive merge-time resolution; 59 rows point at tables that no longer exist and none were re-pointed.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12, answer to Q1 and the §5 deferral); TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select prosrc from pg_proc where proname='generate_document'` contains no reference to `source_table` — the merge path resolves by token name through CASE arms. Sweep: `select proname from pg_proc where prosrc like '%source_table%' and pronamespace='public'::regnamespace` → exactly one function, `template_editor_tokens`, which uses it only to compute a display flag (`source_table IS NOT NULL AND EXISTS (… information_schema.tables …) AS source_live`). Dead count today: `select count(*) from template_tokens tt where tt.source_table is not null and not exists (select 1 from information_schema.tables t where t.table_schema='public' and t.table_name=tt.source_table)` → 59 (unchanged); a further 4 rows name a live table but a column that does not exist on it.
- decision-note: D13
- cost-rank: 6
- recommendation: Either re-point the 59 (a documentation-only UPDATE) or drop the two columns; leaving them half-true feeds a "source retired" badge that means nothing to the merge.

## CTA-A12: No admin surface edits template_tokens.notes
- item: Token descriptions live in template_tokens.notes and are read by the picker, but the only way to change one is SQL.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select count(*) from template_tokens where notes is null` → 0 (all 360 rows described, TOKENAUDIT commit c14e8d3 holds). Read path: src/components/ops/templates/TokenPicker.tsx:71 renders `t.notes` and :87 searches it. Write path: grep for `template_tokens` across src/ returns only TokenPicker.tsx and the read-only `template_editor_tokens` RPC — no insert/update surface anywhere.
- decision-note: D13 (flagged under D13 by the original report)
- cost-rank: 3
- recommendation: Add a notes field to the token row in the admin template editor, or accept in writing that the dictionary is developer-maintained.

## CTA-A13: ORD.UUID and DOC.UUID both resolve to documents.id
- item: Two differently-named tokens map to the same column; either ORD.UUID is misnamed or it should print the purchase id, which has no token at all.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12); TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select token, source_table||'.'||source_column from template_tokens where token in ('{{ORD.UUID}}','{{DOC.UUID}}')` → `{{DOC.UUID}}=documents.id`, `{{ORD.UUID}}=documents.id`. Both rows still present, unchanged.
- decision-note: none
- cost-rank: 3
- recommendation: Owner ruling — rename ORD.UUID to a DOC.* name, or re-point it at the purchase/PUR-code and give purchases a real token.

## CTA-A14: Duplicate token wiring left unresolved
- item: PARTY.FULL_NAME vs PARTY.PRINTED_NAME, TXN.PACKAGE_FEE vs TXN.SERVICE_FEE, and the seven FHE.* / ORG.* pairs all produce identical output and none were retired.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select distinct token from template_tokens where token in ('{{PARTY.FULL_NAME}}','{{PARTY.PRINTED_NAME}}')` → both present. `select count(*) from template_tokens where token like '{{FHE.%'` → 7; `… like '{{ORG.%'` → 42. TXN.PACKAGE_FEE and TXN.SERVICE_FEE both still present (see CTA-A16).
- decision-note: none
- cost-rank: 3
- recommendation: Retire FHE.* from the picker (the obvious move the report named) and pick one of each remaining pair — a ruling, then one UPDATE.

## CTA-A15: The 17 intake tokens still render blank
- item: The ENG.*/REQ.* intake tokens sit in active template bodies but nothing ever captures their values.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select count(distinct token) from template_tokens where token like '{{ENG.%' or token like '{{REQ.%'` → 33 distinct tokens across 45 rows. `select count(*) from contract_field_defs where field_key like 'ENG.%' or field_key like 'REQ.%'` → 0, so no clause-engine capture exists either. `select count(*) from contract_templates where body like '%{{ENG.%' or body like '%{{REQ.%'` → 2 template bodies still place them.
- decision-note: none
- cost-rank: 3
- recommendation: BUILD-OR-RETIRE, as the report said — either build the intake capture or strip the tokens from the two bodies that place them.

## CTA-A16: Retainer/representation money tokens render blank in two active templates
- item: TXN.RETAINER_FEE / SUCCESS_FEE / REPRESENTATION_FEE / PAYMENT_TERMS appear in two active template bodies with nothing feeding them, so neither template can produce a complete agreement; the nine retired order-form fee tokens are likewise still in the picker.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12, both the WIRE-BEFORE-USE and RETIRE-CANDIDATE findings)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select distinct token from template_tokens where token in ('{{TXN.RETAINER_FEE}}','{{TXN.SUCCESS_FEE}}','{{TXN.REPRESENTATION_FEE}}','{{TXN.PAYMENT_TERMS}}')` → all four present. `select template_key from contract_templates where body like '%RETAINER_FEE%' or body like '%SUCCESS_FEE%' or body like '%REPRESENTATION_FEE%'` → HORSE_TRANSACTION_REP, HORSE_SEARCH_RETAINER (both `active=true`, both flat with zero clause/field defs). `select count(*) from contract_field_defs where field_key like 'TXN.RETAINER%' or field_key like 'TXN.SUCCESS%' or field_key like 'TXN.REPRESENTATION%' or field_key like 'TXN.PAYMENT_TERMS'` → 1, i.e. no working-copy fields feed the flat pair. All nine retire-candidates (TXN.PACKAGE_FEE, SERVICE_FEE, PAYMENT_SCHEDULE, SESSION_FEE, MONTHLY_FEE, OTHER_FEES, EVALUATION_FEE, ADDITIONAL_SERVICES, JUMPER_TRAINING_FEE) are still rows in template_tokens.
- decision-note: none
- cost-rank: 1
- recommendation: Do not send either template until the four money tokens are wired; hide the nine retired fee tokens from the picker at the same time.

## CTA-A17: HORSE.OWNER_NAME points at a column that does not exist
- item: The HORSE.OWNER_NAME token maps to horses.owner_name, which is not a column, so it renders blank; HORSE.BARN_NAME's declared column is also wrong (the real one is nickname) though the code reads the right one.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `select token, source_table||'.'||source_column from template_tokens where token in ('{{HORSE.OWNER_NAME}}','{{HORSE.BARN_NAME}}')` → `horses.owner_name` and `horses.barn_name`. `select column_name from information_schema.columns where table_name='horses' and column_name in ('owner_name','barn_name','nickname')` → `nickname` only. Neither column exists.
- decision-note: none
- cost-rank: 5
- recommendation: Repoint HORSE.BARN_NAME's documentation to horses.nickname and either give HORSE.OWNER_NAME a real resolution (owner contact name) or retire the token.

## CTA-A18: HORSE.MARKINGS and three siblings resolve through a code-only third path
- item: Four horse tokens are resolved by a CASE arm inside generate_document with no template_tokens row, so no registry owns them.
- sources: PROMPT_A_STAGES_1-3.md (2026-08-01, R3)
- raised: 2026-08-01
- status: STILL OPEN
- evidence: `select distinct token from template_tokens where token in ('{{HORSE.MARKINGS}}','{{HORSE.PASSPORT_NUMBER}}','{{HORSE.VET_ADDRESS}}','{{HORSE.VET_BUSINESS}}')` → none. generate_document's prosrc still resolves them inline (`WHEN 'MARKINGS' THEN v_horse.markings`, `WHEN 'PASSPORT_NUMBER' THEN v_horse.passport_number`, `WHEN 'VET_BUSINESS' THEN v_horse.vet_business_name`, `WHEN 'VET_ADDRESS' THEN compose_vet_address(...)`). Partial change since: all four now DO have contract_field_defs rows (in HORSE_LEASE*, and MARKINGS/PASSPORT_NUMBER also in HORSE_BILL_OF_SALE and HORSE_SALE_V2), so the clause-engine registry has adopted them — the flat-template code path is the one still unregistered.
- decision-note: none
- cost-rank: 4
- recommendation: Add the four to template_tokens for the flat path, or document generate_document's CASE as the third sanctioned mechanism.

## CTA-A19: TOKEN_DICTIONARY.md contradicts the live table
- item: The dictionary doc disagrees with template_tokens in several places and documents CLIENT.EUTHANASIA_INITIALS, which has no row and no body use.
- sources: TASK-TOKENAUDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: docs/TOKEN_DICTIONARY.md exists; `git log --oneline -3 -- docs/TOKEN_DICTIONARY.md` → newest touch is 40d7bfd ("Multi-horse onboarding"), i.e. no rewrite since TOKENAUDIT (c14e8d3, 2026-08-12). `select token from template_tokens where token like '%EUTHANASIA_INITIALS%'` → none (only `{{HORSE.EUTHANASIA_A}}` and `{{HORSE.EUTHANASIA_B}}` exist); `select field_key from contract_field_defs where field_key ilike '%EUTHANASIA%'` → none. Every drift the report named (MINOR_RIDER retirement, ORD.UUID source, retired TXN sections) is confirmed still live above.
- decision-note: none
- cost-rank: 6
- recommendation: Rewrite the doc after the owner rules on CTA-A13/A14/A15/A16, exactly as the report proposed — it is currently a misleading reference.

## CTA-A20: CLIENT.JUMP_LIMITATIONS merges into nothing
- item: The token is editable in the staff dossier and declared in template_tokens but appears in no template body and no clause def, and onboarding never collects it.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `select count(*) from contract_templates where body like '%JUMP_LIMITATIONS%'` → 0. `select count(*) from contract_clause_defs where body like '%JUMP_LIMITATIONS%'` → 0. `select count(*) from contract_field_defs where field_key like '%JUMP_LIMITATION%'` → 0. `select distinct token from template_tokens where token like '%JUMP%'` → `{{CLIENT.JUMP_EXPERIENCE}}`, `{{CLIENT.JUMP_LIMITATIONS}}`, `{{TXN.JUMPER_TRAINING_FEE}}` — the row is still there.
- decision-note: none
- cost-rank: 5
- recommendation: Either place the token in RELEASE_JUMPER_ADDENDUM (its obvious home) or retire the token and the dossier field together.

## CTA-A21: listContractTemplates() is a dead read path
- item: The function has no callers; the only template picker uses listLeaseTemplates().
- sources: TASK-ONEAUTHOR-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `grep -rn "listContractTemplates" src/` → one hit, the definition at src/lib/api.ts:1161 (the report cited :1093; the line moved, the fact did not). No import, no call site anywhere in src/ or api/.
- decision-note: none
- cost-rank: 6
- recommendation: Delete it.

## CTA-A22: The inline body preview is retired behind a constant, not removed
- item: ContractPage's inline body-preview block is disabled by `INLINE_BODY_PREVIEW_RETIRED = true` rather than deleted.
- sources: TASK-ONEAUTHOR-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: src/pages/app/ContractPage.tsx:86 `const INLINE_BODY_PREVIEW_RETIRED = true;`, :2021-2022 `{/* … behind INLINE_BODY_PREVIEW_RETIRED, never deleted */} {!INLINE_BODY_PREVIEW_RETIRED && (`. Unchanged.
- decision-note: none
- cost-rank: 6
- recommendation: Delete the dead branch once the owner confirms the preview is not coming back — it is the same CONTACTS_PAGE_RETIRED pattern accumulating across the codebase.

## CTA-A23: The 12 flat templates were never converted to the clause engine
- item: FLAT→CLAUSE conversion (estimated 3-5 threads, commercial agreements first) was reported and not started.
- sources: TASK-ONEAUTHOR-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `select template_key from contract_templates where active and (select count(*) from contract_clause_defs c where c.template_key=t.template_key)=0` → 14 active flat templates, including all four the report named first: HORSE_SEARCH_RETAINER, HORSE_TRANSACTION_REP, INDEPENDENT_CONTRACTOR, FACILITY_LICENSE. Only HORSE_LEASE_V2/_FULL/_SIMPLE, HORSE_SALE_V2 and HORSE_BILL_OF_SALE carry clause defs. src/pages/app/ContractPage.tsx:1822-1823 still routes "structure null → <FlatDocument> (the composed text, read-only)".
- decision-note: none
- cost-rank: 4
- recommendation: Sequence the conversion by value as the report proposed; HORSE_SEARCH_RETAINER and HORSE_TRANSACTION_REP are the two blocked by CTA-A16 anyway.

## CTA-A24: template_tokens is a seventh satellite table keyed on template_id
- item: The lease-fork ground truth listed six satellite tables; template_tokens is a seventh and keys on template_id, so a template_key sweep misses it.
- sources: TASK-LEASEFORK-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: `select string_agg(column_name,',') from information_schema.columns where table_name='template_tokens'` → includes `template_id`, no template_key. `select prosrc from pg_proc where proname='clone_contract_template'` (4213 chars) — the four-table clone; template_tokens is not among them. The correction still holds for lease forks because all HORSE_LEASE* templates have zero template_tokens rows, but the general gap in clone_contract_template is unchanged.
- decision-note: none
- cost-rank: 5
- recommendation: Either extend clone_contract_template to copy template_tokens, or make it raise when the source template has any — the current silence is the failure mode the report warned about.

## CTA-A25: The lease field count in the LEASEFIX report is stale
- item: A report corrected 130 to 131 lease fields; the field set has since changed again.
- sources: TASK-LEASEFIX-REPORT.md (2026-08-10)
- raised: 2026-08-10
- status: SUPERSEDED BY EVENTS
- evidence: `select count(*) from contract_field_defs where template_key='HORSE_LEASE_V2'` → 114 today. TXN.GL_LESSOR_COVERAGE (the field the correction hinged on) exists in all four lease templates. The set was rewritten after the report by 20260810T1500_leasefix_gl_ccc_parent_rider.sql, 20260810T1600_leasefix_mortality_medical_and_one_share.sql and 20260811T1200_leasefix_addendum_gl_ccc_wording.sql, each of which DELETEs and re-INSERTs contract_field_defs rows. Neither 130 nor 131 describes the current template.
- decision-note: none
- cost-rank: 6
- recommendation: Stop quoting a field count in prose; if a number is needed, cite the query.

## CTA-A26: Emergency-contact tokens bind to contacts columns, not contract_fields
- item: A task doc hedged that emergency-contact data lived in contract_fields; the merge tokens bind straight to contacts.emergency_contact_* columns.
- sources: TASK-PROFILE-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: CLOSED BY LATER WORK
- evidence: `select column_name from information_schema.columns where table_name='contacts' and column_name like 'emergency_contact%'` → emergency_contact_1_name/_phone/_relationship and _2_ equivalents, six columns. `select token, source_table||'.'||source_column from template_tokens where token like '%EMERGENCY_CONTACT%'` → each CLIENT.EMERGENCY_CONTACT_n_* row points at the matching contacts column. The correction was absorbed into the shipped PROFILE work (commit 15e4ed3, merge 8d6fff6).
- decision-note: none
- cost-rank: 6
- recommendation: Nothing — the correction is factual and the shipped binding matches it.

## CTA-A27: The /acquisition emptying was the price filter, not config_kind
- item: The task spec mis-described the three acquisition offerings as config_kind='inquire'; the `price_amount != null` clause alone emptied the page.
- sources: TASK-COUNTFIX-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: src/lib/publicCatalog.ts:19-29 now carries the corrected definition in the doc comment ("This used to filter `config_kind !== 'inquire' && price_amount != null`, which silently removed every quote-priced SKU") and fetchPublicCatalog no longer applies either clause — it takes every active offering in the segment. Commit ffbb296 ("COUNTFIX 1.5 + 1.2 + 1.3: one definition per number"), merged 74cd330.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing — the correction shipped with the fix.

## CTA-A28: The test/db schema snapshot still holds the purged service templates
- item: test/db/fixtures/schema_snapshot.sql has drifted from production and still contains the six templates SVCPURGE deleted.
- sources: TASK-SVCPURGE-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: Prod: `select template_key from contract_templates where template_key in ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING','HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER')` → zero rows (deleted by 20260806120000_svcpurge_retire_service_contracts.sql, commit 4049ced). Snapshot: `grep -c "'HORSE_TRAINING'" test/db/fixtures/schema_snapshot.sql` → 2; HORSE_EXERCISE 2, HORSEMANSHIP_TRAINING 2, HORSE_EVALUATION 3. `git log --oneline -2 -- test/db/fixtures/schema_snapshot.sql` → last touched by bcda19b, which predates the purge.
- decision-note: none
- cost-rank: 5
- recommendation: Regenerate the snapshot from prod as part of whatever finally repairs the db suite; do not hand-edit it.

## CTA-A29: SVCPURGE deleted six template_variants rows beyond the literal delete list
- item: A judgment call extended the purge to six HORSE_EVALUATION template_variants rows, with their contents preserved verbatim in a migration comment.
- sources: TASK-SVCPURGE-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: supabase/migrations/20260806120000_svcpurge_retire_service_contracts.sql:123-125 `DELETE FROM template_variants WHERE template_key IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING','HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER')`. `select count(*) from template_variants` → 10 rows remain. No later commit restores them; the owner has not ruled on the extension either way.
- decision-note: none
- cost-rank: 4
- recommendation: One owner yes/no; if no, the restore is the copy-paste the migration comment preserves.

## CTA-A30: SVCPURGE's def-table premise and its business premise were both taken on trust
- item: The task doc assumed the six templates held clause/section/field defs (they held none, so the DELETEs reported 0), and the owner's ruling that the six are not in use was verified only in its data consequence.
- sources: TASK-SVCPURGE-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: CLOSED BY LATER WORK
- evidence: The migration itself encodes both facts — its comment at :92-94 states "The six are flat-body templates and hold ZERO def rows (verified pre-migration)", and guards 1-3 at :44-90 abort unless exactly the six are present, every one has zero documents (counting drafts, voided, archived and soft-deleted), and no live requirement/assignment wiring references them. Prod confirms the end state: zero rows for all six keys in contract_templates. The business intent remains the owner's, which is where it belongs.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing — the guards make the premise self-checking; the business ruling is not a verifiable object.

## CTA-A31: TEXTEDIT's template editor was never opened in a browser
- item: The whole template-wording editor (templates list, trio banner, draft chips, publish modal, token picker, flat editor, discard, non-admin bounce) is proved only against SQL and a build.
- sources: TASK-TEXTEDIT-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: The surfaces exist — src/pages/app/ops/admin/AdminTemplatesPage.tsx, src/pages/app/ops/admin/AdminTemplateEditorPage.tsx, src/components/ops/templates/TokenPicker.tsx (commit f05ccbc, merge 84549ea). No later commit or report records a browser pass over them; `grep -rl "browser click-through" docs/reports/` returns only the same family of "not verified" admissions. The 10-point checklist in the report is still unrun.
- decision-note: D13
- cost-rank: 4
- recommendation: Owner click-through against the report's checklist — it is the only outstanding step and needs no code.

## CTA-A32: The New-contract lease picker change was never opened in a browser
- item: Removing the "Default" option and pre-selecting HORSE_LEASE_V2 was shipped without a staff session to look at it.
- sources: TASK-LEASESET-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: src/pages/app/ops/NewContractPage.tsx:48-55 carries the change and its rationale comment ("the picker now names it explicitly instead", default state `useState('HORSE_LEASE_V2')`). No later commit or report records a render check. Note CTA-A02: what the picker now shows is three identical options.
- decision-note: D10
- cost-rank: 4
- recommendation: Fold into the same owner click-through as CTA-A31 and CTA-A02 — one visit answers all three.
