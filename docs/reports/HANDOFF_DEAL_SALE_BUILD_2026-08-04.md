# Handoff Export — Deal / Sale Build Session

**Produced:** 2026-08-04, for an external audit thread.
**Verification note:** this report is written to be checked against the live database
and the repo. It reports what actually happened, not what was intended. Nothing was
re-opened or fixed while producing it.

**Repo:** `~/Downloads/claude-code-repo/fhe-website-app` · **DB:** `lrstswfxfsezdmvkvukc` (live production)
**Session start:** `99977e5` · **Session end / HEAD:** `d1bbcb9`
**Branch checked out:** `work/ui-design` (tracks and pushes to `origin/main`)
**Push state:** local `d1bbcb9` == `origin/main` `d1bbcb9`. Nothing unpushed. Working tree clean (0 modified files).

> ⚠️ **Two commits on this branch were not authored by the assistant.**
> `1fd6339` and `d1bbcb9` (author `Admin <admin@cactai.io>`) were made outside the
> conversation. They are listed for completeness; the assistant cannot attest to
> their contents or to whether their migrations were applied.

---

## Section 1 — Requests received

| REQ | What was asked | Disposition |
|---|---|---|
| **REQ-1** | Locate FHE repo, confirm current/aligned with main, report hash. Run only if the closure-phase report was clean; stop if closure items open. | **Implemented.** Confirmed `99977e5`, clean, aligned. |
| **REQ-2** | Build HORSE_SALE_V2 + HORSE_BILL_OF_SALE per `SALE_BUILD_INSTRUCTIONS.md` rev B, phases 0–6, bodies verbatim. | **Implemented.** 18/76/65 and 8/22/37 loaded byte-exact. |
| **REQ-3** | Co-buyer as a real build item (2nd contact, party_role BUYER, next signer_order, picker + hand-entry, title form, conditional signature blocks). | **Implemented**, then **partially reversed** — hand-entry branch retired later under REQ-22 (L2a: nothing created from a deal surface). |
| **REQ-4** | Fold in owner rulings: edit-mode default for editable docs; horse step = seller's-horses dropdown + add-new modal; leased horse selectable with encumbrances prefilled YES; single shared white-page render style. | **Implemented.** Edit-mode default was already true; verified rather than changed. |
| **REQ-5** | Phase 6 gates incl. exports of test sale + BOS as merged markdown and rendered PDF for owner review. | **Implemented.** 4 export files committed. |
| **REQ-6** | Explain 4 parked items (identity/provisioning, wiring fixes, retirements, signature-predicate). | **Implemented** (explanation only). |
| **REQ-7** | Status of the sale contract upgrade / duplicate-contract question; assess what's built vs wired. | **Implemented** (assessment). Finding: no duplicate existed; old flat templates already retired. |
| **REQ-8** | L9: signed documents cannot be edited unless the signing party removes their signature. | **Implemented** (`8279b51`, `65f7640`). |
| **REQ-9** | Consideration = category + detail (payment/goods/services/horse). | **Implemented**, then **removed entirely** under REQ-22. |
| **REQ-10** | Members/horses selected only from existing records; no create-from-deal path. | **Implemented.** |
| **REQ-11** | Fold in the 2 in-path items (writeback retirement, co-buyer hand-entry removal) + the whole cleanup bundle; "just get it done". | **Implemented** (`ed4f884`). |
| **REQ-12** | Notary concern → skip notary entirely; it moves to a future sworn affidavit. | **Implemented** (`ed4f884`). |
| **REQ-13** | BOS is the contract; focus on BOS + affidavit; sale agreement optional. | **Implemented** for BOS. Affidavit **deferred** by owner ("we do it later"). |
| **REQ-14** | Render the standalone BOS in chat (owner on remote/phone). | **Implemented.** |
| **REQ-15** | Duplicate BOS into a standalone version; A/B warranty toggle question. | **Deliberately changed** with owner agreement — one template with a posture election instead of a duplicate; no A/B toggle (UCC §2-316 research showed it unenforceable). |
| **REQ-16** | Standalone merge scope: disclosures + release/§1542 (elective, renders nothing when excluded) + delivery/risk + governing-law rewrite. | **Implemented** (`ed4f884`). |
| **REQ-17** | Build the completion mechanics flagged as missing. | **Implemented** (`90e56e5`). |
| **REQ-18** | Explain insurance-elections "fix", reopen behavior; delete leftover test documents. | **Implemented.** Clarified nothing was fixed on insurance; deleted 7 test documents. |
| **REQ-19** | Deals page should be on the nav rail after Documents; is it pushed and live? | **Implemented** (`47303b3`). Nav entry was genuinely missing. |
| **REQ-20** | "Reopen" is ambiguous — use "Edit"; explain where the button is and what the user sees. | **Implemented** (`47303b3`). |
| **REQ-21** | UI critique (grade F): FHE prefix not DEA; deal title input + editable; drop "Pending — still being put together"; title + type/status badges; no save button; add-document button; deal record as modal with download/email/print at top; modals under-used. | **Partially implemented** (`ff869c0`) — FHE prefix, title capture + rename, badges, header rebuilt, creation modal replacing the no-save panel, add-document buttons, deal-record modal with download/email/print. **Not done:** deal-record button on the deals-list tile and on party/horse records with contextual text. |
| **REQ-22** | Deal = blank named container; drop consideration; creation via modal reusing contract config; documents added by repeatable button routing to the existing contract page. | **Implemented** (`ff869c0`). |
| **REQ-23** | Drop deal_consideration table + RPCs; deal completes on BOS signature; other docs not forced. | **Implemented** (`ff869c0`). |
| **REQ-24** | Status vocabulary: created/editing/sent/reviewing/signed n-of-m/complete → simplified by owner to created/editable/signed/complete; "sent" is activity not status; deal needs an activity log. | **Implemented** (`ff869c0`), display-layer only per owner's choice. |
| **REQ-25** | Documents page: management functions, filters/sorting by type + status (incl. void), "send a document" not "create". | **NOT DONE.** Session ended before it was started. |
| **REQ-26** | Inventory of deal workflow stages / functions / actions / rendered content, for the external UI-spec thread. | **NOT DONE.** Deferred repeatedly in favour of build work the owner prioritised; never produced. |
| **REQ-27** | Did you edit the lease contract? | **Implemented** (verification only). Proven identical to the 2026-08-02b baseline. |
| **REQ-28** | This handoff export. | **Implemented** (this document). |

---

## Section 2 — Changes made

### 2.1 Commits (all on `work/ui-design`, all pushed to `origin/main`)

| Hash | Line | Author |
|---|---|---|
| `3475dd4` | Sale build: HORSE_SALE_V2 + HORSE_BILL_OF_SALE on the clause engine; flat sale templates retired | assistant |
| `ed4f884` | Deal plan Stage 0+1: bill of sale becomes a standalone contract; cleanup bundle | assistant |
| `9b593dd` | Deal plan Stage 2: the deal layer — envelope, RPCs, deals page, deal page | assistant |
| `d47c8a8` | Deal plan Stage 3: documents on a deal, status by type, reciprocal links, deal record | assistant |
| `8279b51` | Deal plan Stage 4a: signed documents are read-only; signatures are withdrawn, never silently voided (L9) | assistant |
| `65f7640` | Deal plan Stage 4b: the L9 signature/edit surface | assistant |
| `e668be7` | Deal plan Stage 5: verification — the lease gate passes | assistant |
| `90e56e5` | Deal completion: a deal settles itself when its requirements are met | assistant |
| `47303b3` | Deals in the nav rail; Reopen becomes Edit and routes to the blocking document | assistant |
| `ff869c0` | Deals rebuilt as a blank named container (owner correction) | assistant |
| `1fd6339` | Lease authoring surface repaired + Location folded into The Horse + multi-line horse location | **owner, out-of-band** |
| `d1bbcb9` | Imported data is locked at the document, tooltip names the source record | **owner, out-of-band** |

### 2.2 Migrations created — all applied to the live database

| File | Applied |
|---|---|
| `20260802090000_sale_and_bos_templates.sql` | yes |
| `20260802090001_sale_engine_functions.sql` | yes |
| `20260802090002_sale_execution_effects.sql` | yes |
| `20260802090003_retire_flat_sale_templates.sql` | yes |
| `20260802090004_prune_flat_sale_orphan_global_tokens.sql` | yes |
| `20260802090005_lock_blockers_self_gating_drivers.sql` | yes |
| `20260802090006_record_signature_cobuyer_namespace.sql` | yes |
| `20260803100000_bos_standalone_contract.sql` | yes |
| `20260803110000_cleanup_wiring_and_retirements.sql` | yes |
| `20260803110001_requests_converted_on_redemption.sql` | yes |
| `20260803120000_deal_layer.sql` | yes |
| `20260803120001_deal_rpcs.sql` | yes |
| `20260803130000_deal_documents.sql` | yes (re-applied once after edit) |
| `20260803130001_deal_record_export.sql` | yes (re-applied 3× during fixes) |
| `20260803140000_signature_edit_rules.sql` | yes |
| `20260803140001_resign_after_withdrawal.sql` | yes (rewritten twice; final version applied) |
| `20260803150000_deal_completion.sql` | yes (re-applied after `reopen_deal` return-type change) |
| `20260804100000_deal_container_model.sql` | yes |
| `20260804100001_deal_rpcs_container_model.sql` | yes |
| `20260803010000_fold_location_into_horse.sql` | **owner's commit** — applied state not verified |
| `20260803010001_horse_location_multiline.sql` | **owner's commit** — applied state not verified |
| `20260629100000_load_contract_bodies.sql` (modified, regenerated) | yes |

### 2.3 Live-database changes made OUTSIDE a migration file

| Object | What | Why it bypassed a migration |
|---|---|---|
| `public.record_signature` | Hand-patched to revive soft-deleted signature rows (`deleted_at = NULL` in ON CONFLICT), then **hand-reverted** to its original form. **Verified: revert succeeded, no hack present.** | Debugging in-flight. The failed approach was abandoned; migration `20260803140001` contains the correct archive-then-free design. Net DB state matches the migration. |
| `public.create_deal`, `update_deal`, `list_deals`, `horse_deals` | `DROP FUNCTION` issued directly before re-applying `20260804100001` (Postgres cannot change return types in place). | Ad-hoc during apply. **Drops were then added into the migration file**, so a fresh replay works. |
| `public.reopen_deal` | `DROP FUNCTION` + recreate with `jsonb` return instead of `void`. | Same reason; the edit was made in `20260803150000` and re-applied. |
| `documents` + 24 dependent tables | **Deleted 7 pre-existing test documents** (5 "H2Verify TestSigner" visitor releases, 2 unsigned voided leases) at owner's instruction, with `session_replication_role = replica`. | Data cleanup, not schema. No migration appropriate. |
| Test rows throughout | Created and deleted deals/contracts/documents/contacts/horses/auth users/profiles/notifications (see 2.5). | Verification data. |
| `deals.display_code` | `UPDATE … SET display_code = 'FHE-' || …` for existing DEA- rows. | Inside migration `20260804100000`. |

### 2.4 Frontend / API / script / doc files changed (assistant, `99977e5..ff869c0`)

| File | Behavior change |
|---|---|
| `src/App.tsx` | Added `/app/ops/deals` and `/app/ops/deals/:dealId` routes. |
| `src/components/app/AppLayout.tsx` | Added "Deals" to the management nav group after Documents. |
| `src/components/app/ClauseDocument.tsx` | Added SELLER/BUYER/COBUYER token maps; root wrapped in `.document-paper`. *(Further modified by the owner in `d1bbcb9`.)* |
| `src/components/app/ContactDossierModal.tsx` | Invite path converged on `ProvisionClientForm`; removed the degraded direct-invite branch. |
| `src/components/app/CreateModal.tsx` | Added "New deal" destination; corrected the "New client" hint. |
| `src/components/app/ReviewChangesModal.tsx` | **New.** Accept/reject walk-through of changes since a signature was removed; rejection writes a pre-authored comment via `postContractComment`. |
| `src/index.css` | Added the shared `.document-paper` render surface. |
| `src/lib/admin.ts` | Removed `adminCreateClient` wrapper. |
| `src/lib/api.ts` | `startPurchaseContract` → `startSaleContract`; added `startBillOfSale`, `setDocumentCoBuyer`. |
| `src/lib/contracts.ts` | Added 5 L9 wrappers: `documentSignatureState`, `removeMySignature`, `requestPermissionToEdit`, `notifyReviewChanges`, `changesSinceSignature`. |
| `src/lib/deals.ts` | **New**, then rewritten for the container model. All deal RPC wrappers + `dealLabel`. |
| `src/pages/app/ContractPage.tsx` | L9 banners/actions; co-buyer picker; generate-bill-of-sale action; `.document-paper`; `stepLabel` v2 keys; SELLER counted as horse-owning side. |
| `src/pages/app/HorsePage.tsx` | Documents tab lists the deals a horse is part of. |
| `src/pages/app/ops/DealPage.tsx` | **New**, then rebuilt: header w/ rename + badges, parties, deal documents w/ add buttons, activity log, deal-record modal. |
| `src/pages/app/ops/DealsPage.tsx` | **New**, then rebuilt: empty state, list rows, creation modal. |
| `src/pages/app/ops/DocumentViewerPage.tsx` | Body wrapped in `.document-paper`. |
| `src/pages/app/ops/NewContractPage.tsx` | Sale path → `start_sale_contract`; seller's-horses dropdown + HorseIntakeForm modal; label "Horse sale". |
| `scripts/build-sale-template-migration.mjs` | **New.** Generates the template seed migration from the content files. |
| `scripts/build-template-load-migration.mjs` | RETIRED set gained the two flat sale templates. |
| `scripts/build-lease-extract.mjs` | Deterministic ordering tiebreak. |
| `test/db/sale_golden_render.test.ts` | **New.** 4 fixtures (sale co-buyer yes/no, pendings, BOS). |
| `test/db/fixtures/schema_snapshot.sql` | Regenerated 3×. |
| `docs/` (14 files) | Canonical content files, archived flat templates, extracts, sample renders. |

### 2.5 Test rows created / deleted

| What | IDs | Cleaned up |
|---|---|---|
| Sale-build test contacts/horse/docs (2026-08-02) | seller `48addb61…`, buyer `753f5b74…`, cobuyer `20ab79ef…`, hand-entry `5216b5af…`, horse `afef8dde…`, docs `9226a494…`, `edf04fbc…`, `bc48d477…`, `827785ae…`, auth `aaaa1111-…-0001/2/3` | **Yes**, verified 0 residual |
| Stage-1 lease baseline | contacts `16d3382e…`, `3eba364e…`; horse `60dcd03c…`; doc `9b713e0e…` | **Yes** |
| Stage-2 deal smoke | 2 deals + contacts `zz-deal-*`, horse "ZZ Deal Horse" | **Yes** |
| Stage-3 | deal `1a052e6c…`, docs `3b23faaa…` + 2 more, contacts `zz-s3-*`, horse "ZZ S3 Horse" | **Yes** |
| Stage-4 | deal + doc `98c539a3…`, contacts `zz-s4-*`, auth `bbbb2222-…-0001` | **Yes** |
| Stage-5 | deal `55fb83b8…`, doc `adb74b1d…`, contacts `zz-base-*`, horse "ZZ Baseline Horse", auth `cccc3333-…-0001/2` | **Yes** |
| Completion tests | deals "completion sale"/"completion lease", docs, contacts `zz-c-*`, horses "ZZ Completion Horse"/"ZZ Lease Horse", auth `dddd4444-…` | **Yes** |
| Container-model test | deal `FHE-000012` (`3641f7bd…`) + its BOS | **Yes** |
| **Pre-existing test docs deleted at owner request** | `474775d8…`, `81e347fa…`, `05cd7200…`, `ebdcbe06…`, `3c7bd786…` (H2Verify releases), `c36449f7…`, `4051bd91…` (voided leases) | **Deleted permanently** |
| **RESIDUE — not cleaned** | 1 row in `audit_logs` (`table_name='signatures'`, `reason='signature_withdrawn_by_party'`) from Stage-4 testing | **NO** — see §4 |

---

## Section 3 — Mapping

| REQ | Implemented by |
|---|---|
| REQ-1 | (verification only, no artifacts) |
| REQ-2 | `3475dd4`; migrations `20260802090000/1/2`; `scripts/build-sale-template-migration.mjs`; `docs/contract-content/*` |
| REQ-3 | `3475dd4` (`20260802090001`: `set_document_co_buyer`, `remove_document_co_buyer`); partially reversed by `ff869c0` |
| REQ-4 | `3475dd4` — `NewContractPage.tsx`, `index.css` (`.document-paper`), `ClauseDocument.tsx`, `ContractPage.tsx`, `DocumentViewerPage.tsx` |
| REQ-5 | `3475dd4` — `docs/contract-exports/SAMPLE_HORSE_*_2026-08-02.{md,pdf}` |
| REQ-6 | (explanation only) |
| REQ-7 | (assessment only) |
| REQ-8 | `8279b51`, `65f7640`; migrations `20260803140000`, `20260803140001`; `ReviewChangesModal.tsx`, `contracts.ts`, `ContractPage.tsx` |
| REQ-9 | `9b593dd` (`20260803120000/1`) — **superseded**, removed in `ff869c0` |
| REQ-10 | `9b593dd` (guards in `add_deal_member`, `add_deal_consideration`) |
| REQ-11 | `ed4f884` — migrations `20260803110000`, `20260803110001`; `admin.ts`, `ContactDossierModal.tsx`, `CreateModal.tsx` |
| REQ-12 | `ed4f884` — `20260803100000` (notary clause + field dropped) |
| REQ-13 | `ed4f884` — `20260803100000`; affidavit deferred |
| REQ-14 | (chat render only) |
| REQ-15 | `ed4f884` — one template, posture election |
| REQ-16 | `ed4f884` — `20260803100000`; `docs/contract-content/HORSE_BILL_OF_SALE_STANDALONE_ADDENDUM.md` |
| REQ-17 | `90e56e5` — `20260803150000` |
| REQ-18 | direct DB deletes (§2.3) |
| REQ-19 | `47303b3` — `AppLayout.tsx` |
| REQ-20 | `47303b3` — `DealPage.tsx` |
| REQ-21 | `ff869c0` — partially; see §1 for the un-done parts |
| REQ-22 | `ff869c0` — `20260804100000`, `20260804100001`; `deals.ts`, `DealsPage.tsx`, `DealPage.tsx` |
| REQ-23 | `ff869c0` — `20260804100000` (drops), `20260804100001` (`deal_completion_state`) |
| REQ-24 | `ff869c0` — `20260804100000` (`deal_status`, `deal_activity`) |
| **REQ-25** | **NOT IMPLEMENTED** |
| **REQ-26** | **NOT IMPLEMENTED** |
| REQ-27 | (verification only) |
| REQ-28 | this document |

### UNREQUESTED changes

| Change | Why |
|---|---|
| `20260802090005_lock_blockers_self_gating_drivers.sql` | Found during REQ-2 testing: required gate-driver fields whose clause is conditional on themselves were skipped by the lock blocker, so an unanswered election could sign through silently. Affects the lease too. |
| `20260802090006_record_signature_cobuyer_namespace.sql` | Found in REQ-3 e2e: the co-buyer's signature tokens were never substituted, leaving literal `{{SIG.COBUYER.*}}` in an executed document. |
| `20260803140001_resign_after_withdrawal.sql` | Found in REQ-8 e2e: a party who withdrew a signature could never sign again (unique key + soft delete). Fatal to L9's purpose. |
| `scripts/build-lease-extract.mjs` ordering tiebreak | Non-deterministic ordering made lease-untouched diffs unreliable. |
| `ContractPage.tsx` `stepLabel` v2 keys | Pre-existing bug: v2 leases displayed as generic "Document". |
| `.document-paper` applied to 5 surfaces | REQ-4 asked for one shared style "applied to every contract render". |
| Deletion of 7 pre-existing test documents | Owner-instructed under REQ-18. |

---

## Section 4 — Known gaps and hazards

### Not done at all
- **REQ-25 (documents page)** — no filters, no sorting, no multi-select/delete, "create" still used where "send" is meant, `void` missing from the status filter. Untouched.
- **REQ-26 (inventory document)** — never produced, despite being requested twice and being the artifact the external UI-spec thread is blocked on. **This is the largest outstanding item.**
- **REQ-21 partial** — deal-record button is only on the deal page. Not on deals-list tiles, not on party accounts ("Sale of Beau on [date]"), not on horse records ("Ownership Transfer of Beau on [date]").
- Sworn affidavit: no content, no template, notary block has nowhere to live yet.

### State to verify before building
- **Branch is `work/ui-design`, not `main`.** It tracks `origin/main` and all pushes went there, so `main` is correct — but the next session inherits a branch whose name implies otherwise.
- **Two owner commits (`1fd6339`, `d1bbcb9`) touch `ClauseDocument.tsx` and add 2 migrations never verified as applied** by the assistant.
- **One live lease document exists** (`215bac09-9f66-43ce-8655-85fd05fea1e2`, DOC-VWRU4KUN93, created 02:11 Aug 4, `hello@fhequestrian.com`) — created after the last cleanup, presumed owner testing.
- **Residue: 1 `audit_logs` row** from Stage-4 signature-withdrawal testing (`old_value->>'reason' = 'signature_withdrawn_by_party'`). Harmless but not real history.

### Fragile / assumed
- **Status vocabulary is display-only.** DB still stores `EXECUTED`; the badge derives Created/Editable/Signed/Complete. A future real rename touches ~38 DB functions and ~20 frontend files.
- **`deal_activity` is composed at read time** from documents, signatures and `contract_change_log` — no dedicated activity table. Anything not already logged does not appear.
- **`reopen_deal` still exists in the DB** but nothing in the UI calls it (replaced by Edit routing). Dead-ish API surface.
- **`start_bill_of_sale_standalone` has no UI caller** and its distinct behavior (`BOS_HAS_SALE_AGREEMENT=NO`, standalone ownership transfer) was never exercised end to end.
- **Deal creation now auto-adds documents** in the modal. If `addDealDocument` fails after `createDeal` succeeds, an empty deal is left behind — no transaction spans both.
- **The `.document-paper` class** was applied to 5 surfaces; only the ops viewer and contract page were checked, and only via code, never in a browser.
- **PGlite suites cover 13 tests**; the other ~54 `test/db/*.test.ts` files remain unrun (pre-existing condition).

### Decisions made without explicit sign-off
- Removing the co-buyer hand-entry path (justified by L2a, but it deletes a capability explicitly requested in REQ-3).
- Auto-generating documents inside the creation modal (inferred from "the container is never empty", not stated).
- `dealLabel()` fallback naming when a deal is untitled (`"Sale — Beau"`).
- Excluding voided documents from the deal record export.
- Keeping `HORSE_SALE_V2` live rather than retiring it after the BOS became the primary instrument.

---

## Appendix — verified live state at time of writing

```
TABLES        deals=1  deal_consideration=0  inquiries=0  engagement_status=0
FUNCTIONS     31 deal/sale/L9 functions present (create_deal, deal_status, deal_activity,
              add_deal_document, remove_my_signature, assert_not_signature_locked, …)
DROPPED       contract_horse_field_writeback=0  admin_create_client=0
              add_deal_consideration=0  start_purchase_contract=0
TEMPLATES     HORSE_BILL_OF_SALE  active  11 sections / 36 clauses / 48 fields
              HORSE_SALE_V2       active  18 / 76 / 65
              HORSE_LEASE_V2      active  22 / 144 / 117   (identical to 2026-08-02b baseline)
              HORSE_PURCHASE_SALE inactive + soft-deleted
              HORSE_SALE_TRANSFER inactive + soft-deleted
TEST RESIDUE  deals=0  zz/test contacts=0  ZZ horses=0  example.invalid auth users=0
              synthetic signers=0   live documents=61   deal_code_seq=12
```
