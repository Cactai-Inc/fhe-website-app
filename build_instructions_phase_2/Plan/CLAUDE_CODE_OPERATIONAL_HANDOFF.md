# Claude Code Operational Handoff
# Orientation + execution plan for the FHE contract/transaction build

Read this first, then the three companion docs: MERGE_TOKEN_DICTIONARY.md, RECONCILIATION_SPEC.md, DATABASE_SECURITY_AND_PERMISSION_MODEL.md. Work against the existing repo (github.com/Cactai-Inc/fhe-website-app); do not start a new project.

> **2026-06-30 owner correction — read CONTRACT_MODULE_ARCHITECTURE.md.** The contract templates must be decomposed into three modular layers (search retainer / transaction representation / evaluation), tokenized by party + deal side. This SUPERSEDES the "Lease/Purchase Representation Agreement is the representation doc" line under *Decisions already made* below. Not yet implemented.

## What you're building

A contract/transaction operational layer ON TOP OF the existing, working FHE platform. The app already has: request→invitation→order→booking→payment flows, an offerings/tiers catalog, profiles, Zelle+Stripe payment plumbing, RLS via is_admin()/owns_order(), and SECURITY DEFINER RPCs. Seven migrations are deployed in supabase/migrations/. DO NOT rewrite them. Everything you add is additive migrations 8+ and new flows.

The new layer lets FHE: collect intake → assemble a contract from a tokenized template merged with intake/engagement data → route it to multiple parties for typed-name signature → deliver copies → record the transaction, with an append-only audit trail.

## Canonical authority (resolve conflicts in this order)

1. Contract legal language and structure are canonical.
2. EXCEPT the finalized 13-service catalog overrides any service reference anywhere. Killed line: Horse Care, Grooming, Bathing, Mane-pulling, Turnout-assist, Show-prep. Survived: HORSE_CLIPPING. The 13 values are in DATABASE_SECURITY_AND_PERMISSION_MODEL.md §10; use them verbatim.
3. MERGE_TOKEN_DICTIONARY.md is canonical for field naming. Documents and SQL both conform to it.

## Decisions already made (apply; flag back only if you hit a blocker)

- Tokenize contracts now for automated assembly. Field naming per the dictionary.
- Canonical contracts: Purchase and Sale Agreement; Sale and Transfer Agreement; Human Emergency Medical Authorization v2; Lease/Purchase Representation Agreement is the representation doc, distinct from transfer docs.
- TRAINER role deferred — launch with admin vs. owner only (existing is_admin). Build new RLS so a TRAINER role can be added later without schema change (roles as data, not hardcoded).
- horses is a real table now (purchase/sale/lease/representation require HORSE.* fields).
- Enum strategy: lookup tables, not native Postgres enums.
- Soft deletes + append-only audit per the security model.

## Execution order

Phase 1 — Schema (additive migrations 8+). Build in this order, each reversible, applied after the existing seven:
1. lookup tables incl. the 13-value service catalog; catalog reconciliation (deactivate killed offerings, retain clipping, align identifiers).
2. horses; engagement_parties.
3. contract_templates; template_tokens (generated from the dictionary — they must match).
4. documents; signatures (multi-party, append-only post-sign); document_deliveries.
5. audit_logs (trigger-based, append-only) + apply RLS from the security model to every new table.
6. pricing/config table for the blank business values (commission, travel, cancellation).
Verify: existing app still typechecks/builds and existing flows are untouched after each migration.

Phase 2 — Document reconciliation (per RECONCILIATION_SPEC Groups A–D).
- Tokenize the 17 canonical contracts; strip killed-service references; keep fixed legal clauses untokenized.
- Map client intake form fields to columns; remove killed-service checkboxes; use the 13 catalog values.
- Migrate company forms from the old flat tokens ({{ENGAGEMENT_ID}}) to namespaced tokens ({{ENG.ID}}).
- Update instruction files' "REQUIRED DATABASE FIELDS" to cite dictionary names.
Load each tokenized contract into contract_templates with its token rows in template_tokens.

Phase 3 — Assembly + signing + delivery flow.
- RPC generate_document(engagement_id, template_key): merge template body with field tokens from the resolved sources, create a documents row (status DRAFT→AWAITING_SIGNATURE), leave {{SIG.*}} unmerged.
- Signing UI: typed name + checkbox; on submit, write a signatures row (typed_name, signed_at, ip_address, method); when all required parties signed, status→EXECUTED, audit + (deferred) email event.
- Delivery: write document_deliveries per party; deliver copy (storage URL).
- Wire into the existing engagement/order flow rather than a parallel one; reuse owns_order-style ownership.

Phase 4 — Pricing surfaces. Wire commission/fees/{{TXN.*}} through product/purchase/summary/receipt and the existing Stripe/Zelle paths. Fill blanks from the config table (owner supplies values).

## Working agreement (from the repo's HANDOFF.md)

- SHOW renders / screenshots at each milestone; don't build blind.
- typecheck (app+api), lint, build+prerender must stay green.
- Confirm IA/scope before large builds; commit per phase with clear messages.
- Git author Cactai-Inc <admin@cactai.io>.

## Out of scope here (other threads)

- Marketing copy, imagery, SEO → website-content thread (CLAUDE_CODE_OVERHAUL_PLAN.md).
- Google Business Profile, reviews, DNS, service keys → external thread.
- Do not edit pricing-bearing marketing pages here beyond wiring values; the content thread owns their copy and lands AFTER this operational work commits, to avoid file collisions.

## Owner-supplied blanks you'll reference (not blockers to building; blockers to go-live)

Legal entity name/formation/agent/signatory; commission rates + minimum; travel fee method/schedule; cancellation/late/no-show fees; e-signature provider; sales tax config; document retention. These populate the config table; build with them nullable.

## Definition of done for this thread's handoff

All new migrations apply cleanly after the seven existing, existing flows intact; 17 contracts tokenized and loaded as templates with matching token rows; intake/company/instruction files reconciled; assembly→sign→deliver flow works end to end for at least the purchase path; pricing wired; audit logging on; typecheck/lint/build green.
