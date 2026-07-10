# Spec H — Horse Record System

Goal: a single authoritative horse record, its matching standardized intake form, the four authenticated paths that create it, a microchip-based dedup model, execution effects from lease/sale, a staff horse-records page, marketplace wiring, and the onboarding field append — replacing the prior horse record, the prior horse intake, and their wiring.

Artifacts delivered with this spec: `artifacts/horse_record/horse_record_schema.sql` (schema reference) and `artifacts/horse_record/horse_intake_form.md` (the standardized intake, superset of the lease's horse fields). These are a matched pair: every intake field maps to a record column.

## H.1 The record (see schema artifact)
Extend the existing `horses` table (additive) with the missing columns; add `horse_relationships` (full ownership+lease history) and `horse_reconciliation` (admin queue). Key concepts:
- Creator is distinct from parties. `created_by_contact_id` is the authenticated creator (immutable). `owner_contact_id` / `lessee_contact_id` are current parties and may be NULL (e.g. a staff-created listing horse has a creator but no owner assigned). Owner/lessee change over the horse's life; every change writes a `horse_relationships` row.
- Full history retained in `horse_relationships`; current-state pointers on `horses` are convenience.
- Unresolved parties: when the owner or lessee named on intake has no contact yet, store `owner_name_text` / `lessee_name_text` (and email) and leave the contact link NULL; match later (manually for the edge case where their account identity differs). No anonymous records exist — every creation path is authenticated (see H.3).

## H.2 The intake form (matched pair)
`artifacts/horse_record/horse_intake_form.md` is the standardized intake in the build-script source format (parses cleanly: 7 sections, 34 fields, microchip first). It is the superset derived from the lease's horse fields plus identity/care/history. BEFORE replacing the old intake, DIFF this field set against any horse fields already captured in code (the old intake, onboarding captures, the lease seed) to confirm nothing is lost; then replace.

Where the form lives depends on the record-creation pattern decision (H.6): it is NOT a convert-submission form. It is an authenticated form-to-record input. If the prior app update established a generic form-to-record pattern, this form uses it; otherwise this spec's create_horse_record RPC IS the record-creation path and the form posts to it.

## H.3 Four creation paths (all authenticated)
1. Account-activation intake for a qualifying purchase (lessons-with-own-horse, horse-care services): the onboarding paperwork already generates horse-dependent documents from a `horses` record. APPEND the full intake field set to the onboarding horse capture (H.7) so activation produces a FULL record, not minimal.
2. Add-a-horse from the account page: an authenticated member opens the intake from their account and adds a horse; on submit the record is created and attached to their account (as owner or lessee per the form).
3. Lease/sale transaction: the contract collects the horse fields (as specified in the lease work) and, on execution, creates the horse record (if not already matched) — see H.4. The document then surfaces in three places: each party's account (if they have one) and the horse record.
4. Staff add-a-horse: a staff/admin "Add a Horse" control (NEW — build it) creates a record directly, with the staff member as `created_by` and owner/lessee assigned or left blank (e.g. a horse added solely to create a marketplace listing).

All four converge on the same `create_horse_record` RPC and the same dedup check (H.5).

## H.4 Execution effects (lease vs sale)
On document execution (`record_signature` → EXECUTED), apply the record effect. Add this to the contract execution path (a hook in the lease/purchase flow, invoked when the document reaches EXECUTED):
- Lease executed: ensure the horse record exists (create from the contract's horse fields if not already matched to an existing record via microchip); set/keep `owner_contact_id` = Lessor; set `lessee_contact_id` = Lessee, `lease_start`/`lease_end` from the terms, `sublease_allowed` from the terms; write a `horse_relationships` OWNER row (if new) and a LESSEE row with `term_start`/`term_end` and `source_document_id`. Ownership unchanged.
- Sale executed: ensure the record exists; CHANGE `owner_contact_id` from Seller to Buyer; close any active LESSEE relationship if the sale ends it (per terms); write a new OWNER `horse_relationships` row for the Buyer with `source_document_id` and mark the prior owner's row `active=false`, `ended_at=now()`. No term, no lessee attachment from a sale.

This makes lease = attach-lessee-for-term, sale = transfer-ownership, both preserving history (owner decision; settled).

## H.5 Dedup / identity model (microchip primary)
Implemented server-side in `create_horse_record`, never as a client lookup. Full model in the schema artifact's "Identity / dedup model" comment. Summary:
- Microchip is the universal key, checked once at submit (normalized). No hard UNIQUE constraint (would leak existence via errors).
- Match + caller authorized to see the horse (owner/lessee/creator/staff via the horses RLS links) → return "already on file" with the record; pre-fill; ask only for missing fields; no duplicate created.
- Match + caller NOT authorized → reveal nothing; create a `horse_reconciliation` task (admin-only); ask the caller to UPLOAD their basis (lease agreement for a lessee claim; ownership docs for an owner claim) via the existing document/storage path; admin validates chip + claim, then links or rejects.
- No chip / no match → create the record. Fuzzy fallback (name + DOB + color + markings + owner) runs AFTER creation as an admin reconciliation signal only — never surfaced to the submitter.
- Indistinguishable responses for the not-authorized case; rate-limit submissions; microchip validated with the form, not queried as-you-type.

## H.6 Record-creation pattern (NOT convert-submission) — cross-update note
An authenticated user filling a form to create a record they own is RECORD-CREATION, not convert-submission (which is a staff-reviewed lead queue for possibly-unknown submitters). These must not share a pipeline. FLAG FOR THE OWNER: the app update running BEFORE this one should establish a generic authenticated-user form-to-record pattern (form → data record owned by the submitter, no review queue, no convert semantics). If that update builds it, this horse work uses it. If not, `create_horse_record` in this spec is the horse-specific record-creation path and stands alone. Either way, do NOT log horse-record creation as a convert-submission.

## H.7 Onboarding field append (replace minimal capture)
Onboarding flows that touch a horse (`20260703030000_rider_onboarding.sql`, `20260703060000_minor_onboarding.sql`, and any horse-care activation) currently capture only the minimal horse fields the vet-auth/medical documents need. APPEND the full intake field set to those flows so activation produces a full horse record; fields not required for the signed documents may be left blank. The onboarding-generated `horses` row becomes a full record attached to the new member's account. Do not remove the document generation; extend the capture that feeds it.

## H.8 Staff horse-records page (NEW)
Build a clearly accessible staff/admin page listing horse records. Per record: view all fields; edit fields; assign/reassign owner, lessee, lessor; see the documents associated with the horse (leases, sales, vet auths — via `source_document_id` on relationships and documents linked to the horse's engagements); and select the horse when creating a horse-care, lease, or sale agreement (wire the horse selector in the contract-authoring flow to these records). This is the staff-side counterpart to the account-side horse display.

## H.9 Marketplace / community listing wiring
The prior app update builds the community section with a for-sale category (which includes for-lease). This spec wires horse records into it:
- A horse is selectable when creating a listing; selecting it informs the listing surface of the fields it should contain (the listing likely has fewer fields than the record — the record is the source, so the listing pulls from it).
- Option to create a horse record when posting a listing (a staff member posting a listing for a horse not yet in the system creates the record inline via `create_horse_record`, as creator).
- Listing eligibility gated by lease state: a leased horse (has an active LESSEE relationship) CANNOT be listed for sale by the lessee. It can be listed FOR LEASE only if the governing lease's `sublease_allowed` is true. A horse's owner listing their own un-leased horse may list it for sale or lease. Enforce this in the listing-create path by checking the horse's current relationships and `sublease_allowed`.
- No availability-status field on the record (owner decision); eligibility derives from relationships, not a stored status.

## H.10 Obsolete — remove and replace
- The PRIOR horse record shape and any minimal horse intake and their wiring are superseded by this matched pair. Remove the old horse intake capture and repoint all horse data entry to the standardized intake + `create_horse_record`.
- The two placeholder lease intake forms (already marked obsolete in the lease work) remain obsolete.
- The brokerage `INTAKE_HORSE_LEASE_IN/OUT` form_definitions: the owner has NOT seen these and they are unrelated to the standardized horse record; leave active unless the owner deactivates them. (Unchanged from the lease handoff.)
- Do NOT delete the form_definitions/intake_submissions machinery — it still serves convert-submission (lead) forms. Only the horse capture moves to record-creation.

## H.11 Account-side surfacing + expiration prompt (from the lease work, restated for the record)
- If the lessee has an account, the active lease surfaces automatically in their account under the appropriate section (read from `horses` where `lessee_contact_id` = them / `horse_relationships`). Same for an owner seeing their owned horses.
- Automatic prompt before `lease_end`: a scheduled notification to the lessee (and/or owner) ahead of the lease expiration date. Reuse the existing notifications/nudge path (`20260703090000_notifications.sql`, `notification_nudge`); add a producer that scans `horses.lease_end` (or active LESSEE `horse_relationships.term_end`) and notifies ahead of expiry.

## H.12 Acceptance
- The standardized intake and record are a matched pair; every intake field maps to a column; the intake parses.
- All four paths create a record via `create_horse_record` with correct creator/owner/lessee assignment; onboarding produces a full record.
- Dedup: authorized match pre-fills and does not duplicate; unauthorized match reveals nothing and opens a reconciliation task requesting document upload; no-match creates; fuzzy matches never surface to the submitter.
- Lease execution attaches lessee-for-term; sale execution transfers ownership; both write history.
- Staff horse-records page lists/edits/assigns, shows documents, and feeds the contract horse-selector.
- Marketplace: horse selectable for a listing; leased-no-sublease horse cannot be listed; lease-with-sublease can be listed for lease only; create-record-on-post works.
- Lessee sees active lease in-account; pre-expiration prompt fires.
