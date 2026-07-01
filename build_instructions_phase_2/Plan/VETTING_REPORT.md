# FHE Document Package — Vetting Report
# All 136 files reviewed against the live codebase

Reviewed by: planning thread. Source: the cleaned extraction of the uploaded contract/forms package, vetted against the seven deployed Supabase migrations in the app repo.

This report is for you, to decide what to fix before handoff. The companion file CLAUDE_CODE_OPERATIONAL_HANDOFF.md is the focused plan for Claude Code, written after you resolve the decisions flagged here.

## Bottom line

The package is coherent and mostly sound, but it is NOT in a state where Claude Code can "assemble contracts" without one structural fix and one cleanup pass. The internal/company forms already speak the schema's language (merge tokens throughout). The client intake forms and the 20 contracts do not — they are authored as human-fillable documents with labeled blanks, not machine-mergeable templates. Closing that gap is the main pre-build task. Separately, stale references to the killed Horse Care / Grooming service line survive in several still-active files and an entire dead folder, and there is duplication that would waste Claude Code's tokens and risk it building the wrong canonical document.

## Finding 1 — The contract assembly gap (most important)

The build goal is: collect intake → assemble contract → sign → deliver. For automated assembly to work, every fillable point in a contract must be a machine-addressable merge token mapped to a database column. Current state:

- Company/internal forms (engagement intake, delivery logs, reports): properly tokenized. 26 {{UUID}}, 19 {{ENGAGEMENT_ID}}, 10 {{CLIENT_ID}}, plus REPORT_ID, RECORD_ID, HORSE_ID, etc. These are build-ready.
- Client intake forms: almost no tokens (a couple of {{UUID}}/{{CLIENT_ID}}/{{HORSE_ID}} only). Fields are labeled blanks ("Full Legal Name:", "Phone:", "Asking Price: $").
- The 20 contracts: effectively untokenized. Only 8 token instances total across all 20, all metadata (UUID, dates, IDs). Every party name, address, horse detail, price, deposit, and date is a bare labeled blank.

Consequence: a human can fill these contracts in; the application cannot auto-generate them from intake data as written. The fields are not addressable.

The bridge already exists: each instruction file is marked "INTERNAL USE / APPLICATION BUILD REFERENCE" and carries a "REQUIRED DATABASE FIELDS" section. That is the mapping spec between form labels and schema columns. It needs to be turned into actual merge tokens in the contracts and intake forms.

Decision needed: do you want the contracts tokenized for automated assembly now (real work — ~20 contracts, each with 15–40 fields to tokenize and map), or do you launch with human-assisted fill (staff completes the contract from the intake record) and defer full automation? Both are valid; they produce very different handoff scopes.

## Finding 2 — Stale killed-service references (must clean before handoff)

The catalog amendment finalized 13 services and removed the entire Horse Care / Grooming / Bathing / Mane-pulling / Turnout-assist / Show-prep line. HORSE_CLIPPING survived; grooming and horse-care did not. Stale references remain in ACTIVE files (not just the dead folder):

- Contracts: the combined "Training, Exercise, Clipping & Horse Care Agreement" framing in the Contract Template guide (Document 3) and "horse care services" / "grooming" language in several agreements (lines flagged in Purchase/Sale, Training, Facility agreements).
- Client intake: "Grooming Fundamentals", "Grooming", "Horse Care" checkboxes in active intake forms.
- Company forms: "Horse Care Agreement (if applicable)", "Grooming", "Grooming Education", "Grooming / Handling" across engagement-intake and delivery records.

These must be removed or rewritten so Claude Code does not rebuild dead services into the catalog and UI.

## Finding 3 — Dead and duplicate files (exclude from handoff)

Do not hand these to Claude Code:

- Entire "Other Versions/" folder (13 files): Horse Care, Grooming service records/forms/instructions (killed line), plus an older Engagement Summary (2), a duplicate "Intake Form - Horse Lease", and Horse Care internal instructions. All superseded.
- Liability Release "(1)" duplicates (4 files): General, Horse Care, Horse Exercise, Participant each exist twice. Keep one of each — and note the Horse Care Liability Release itself is for a killed service; confirm whether it's still needed (it may be, if FHE still does any horse handling under the exercise/training agreements).
- Near-duplicate contracts — pick one canonical each:
  - "Horse Purchase Agreement" vs "Horse Purchase and Sale Agreement" (the latter is more complete; recommend it as canonical).
  - "Horse Sale Agreement" vs "Horse Sale and Transfer Agreement".
  - "Human Emergency Medical Authorization Agreement" vs "...v2" (use v2).
  - "Horse Purchase and Sale Agreement" also overlaps "Horse Lease_Purchase Representation Agreement" in purpose — confirm representation vs transfer are intended as separate documents (they should be: representation = FHE's role; purchase/sale = the buyer-seller transfer).

## Finding 4 — Schema alignment (good news)

Mapped against the deployed schema, the package mostly fits what exists, with named additions:

Already supported by current tables:
- Client identity and profile → profiles.
- Intake submissions → can land in orders + qualifier_answers + order_documents.extra_fields (JSONB), or a dedicated intake table if you prefer structure over JSON.
- Document records with signer + agreed-at → order_documents (signer_name, agreed_at, extra_fields).
- Pricing/catalog → offerings + offering_tiers (seeded).
- Payments + Zelle reconciliation → payments + payment_notifications (unique_amount key already present).
- Service catalog enumeration → the existing CHECK constraints use 'rider'/'horse'/'support' segments, NOT the spec's 13-value SERVICE_TYPE. These need reconciling (see Finding 5).

Genuinely missing, needs new migration(s):
- Contract template storage + merge: no table holds template bodies or token maps. order_documents records that a document exists, not the template it came from.
- Multi-party signature routing/delivery: order_documents has one signer_name; a purchase has buyer, seller, and FHE. Needs a signatures-per-party model and a delivery record.
- Append-only audit log: not present. The spec and the Master Field list both require it.
- TRAINER role: schema has only profiles.is_admin (admin vs owner). No trainer tier or per-engagement assignment.
- Horse entity: no horses table; horse details currently live as free text/JSONB. The transaction/representation forms assume a horse record with HORSE_ID.
- Emergency profiles / veterinary authorization: referenced by contracts ({{EMERGENCY_PROFILE_ID}}) but no table.

## Finding 5 — Catalog naming mismatch

Three naming systems are in play and must be unified to one before build:
- Deployed seed: segments 'rider' / 'horse' / 'support' with offering slugs (riding-lesson, horse-training, brokering, etc.). Still includes hair-clipping (kept) AND implies the old care line in places.
- Spec taxonomy: SERVICE_TYPE enum (HORSE_PURCHASE, RIDING_LESSON, ...).
- Catalog amendment: the finalized 13 (HORSE_PURCHASE_ASSISTANCE, ..., HORSE_CLIPPING, INDEPENDENT_CONTRACTOR).

The amendment is newest and should win. The seed migration's offerings/slugs need a follow-on migration to (a) drop/deactivate killed services and (b) align names/identifiers to the 13. The seed currently still seeds hair-clipping tiers (fine — clipping survived) but uses the old segment vocabulary.

## Finding 6 — Configuration gaps (data, not schema; from the Master Blank Field list)

These are blank and block go-live regardless of code: legal entity name + formation state + registered agent + authorized signatory; commission rates (purchase/sale/lease) + minimum; cancellation notice + late/no-show fees; travel fee method + schedule; contractor insurance minimums; document retention period; e-signature provider; sales tax config. The contracts and pricing engine reference these; they must be filled by you.

## Cleaning status

The character-bloat cleanup is done and verified: zero residual underscore/signature-line runs across the contract set, legal scaffolding (California governing law, San Diego County venue) intact in 62 places. The cleaned files are token-lean and safe to hand over. The remaining "waste" to remove is not characters but dead files (Finding 3) and stale service references (Finding 2).

## What you need to decide before the handoff plan is final

1. Tokenize contracts for automated assembly now, or launch human-assisted and defer? (Finding 1 — biggest scope lever.)
2. Confirm canonical choices among the duplicate contracts (Finding 3).
3. Confirm the Horse Care Liability Release stays or goes (Finding 3).
4. TRAINER role now or admin-only for launch? (Finding 4.)
5. Horses as a real table now, or deferred? (Finding 4 — purchase/rep flows assume it.)

Answer these and the Claude Code handoff plan locks to a definite scope instead of carrying branches.
