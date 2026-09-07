# Remaining fixes — as of 2026-09-06

Closed today, for reference: lease `7adcd08f` locked and signable · the app-wide wall redirect removed and merged to `main` · Pamela's three documents sequenced as one signing set so one email carries all three · her paperwork moved from at-login to held-until-contract-executes.

---

## A. Built, not merged — needs verification then merge

**A1. `task/cr119-a` (wt-13) — three commits, unverified by ORCH, not on `main`.**
Covers more than its own change order:
- The co-buyer election exit — a "Not adding a co-buyer" action inside the capture card (CR-119).
- **A gate field homed on its own pending placeholder.** Answering the question deleted the control that answered it. Found by owner testing. 10 field definitions across HORSE_SALE_V2 and HORSE_BILL_OF_SALE re-pointed at real content clauses. Includes a migration.
- **Horse intake location data loss.** Autosave never saved location at all — it only ever patched flat columns. Location saved only via the explicit submit, and that call was gated on the Home name being filled, so a fully-filled Current location with a blank Home saved nothing, silently. This is the likely root cause of Sundance having every location column null. (CR-120 #1)
- Address and name normalization on the intake form. (CR-120 #2)
- Barn/stall "Other" escape. (CR-120 #3)

Carries one migration and one test file. Needs a verification pass and a merge decision.

## B. Waiting on your decision

**B1. ~~Fair market value~~ — CLOSED 2026-09-06, owner: "it stays at 0." No change to the horse record, no template change. Original note:** Section 13.15 caps each party's aggregate liability at the horse's fair market value, and hers renders as zero dollars because she answered N/A and the field only takes a number. Options: get a real figure; change the clause so the cap sentence doesn't render when there's no figure (affects future leases); or leave it. Hers is the only live document with it.

**B2. The approve button.** Your ruling: remove it and make a contract signable once required fields are filled — or, if that can't be done gracefully, move it beside the signature block. Needs someone to look at the lock mechanics before choosing, because locking is also what seeds the signature rows.

## C. Specced and dispatched, never started

**C1. CR-118 — per-account nav visibility** (wt-12). Admin-nested account link, hidden Admin section for the second owner login, Team-page control per staff account, self-protection rule. Also absorbs two older queued items about the nav not reading page visibility.

**C2. CR-120 — horse location fact-find** (wt-14). Partly overtaken by what the CR-119 thread found in A1; worth re-scoping rather than launching as written.

## D. From CR-123, specced but not built

**D1. The 1-2-3 tracker** at the top of the two documents that follow the contract, ending in "copies sent via email", so a signer knows why they're still there.

**D2. Collapse the two client-record document pages into one.** Both configure which documents a client signs, both send an invitation, only one has the signing-sequence selector. This is why you couldn't tell which link to send.

**D3. Contract-first landing as system behavior.** Pamela's flow is correct now by data, not by code. The next client provisioned the same way gets the old behavior.

## E. Found during the investigation, not yet addressed

**E1. Documents regenerate on every save.** Every details or horse save deletes and regenerates all unsigned documents, even when nothing changed — four regenerations in nine minutes for Pamela, a new document id each time. A partially-signed set would lose its unsigned members' identity mid-flow.

**E2. "Assisted signing — no signer roster"** on every unsigned draft, including Rachel Page's two. The panel reads only the signatures table, and rows there don't exist until a document locks. The contract page already solved this for itself by deriving from the party list.

**E3. Nothing tells a party that "Accept & sign" is what opens the signature box.** The signature block is inert until then and doesn't say so.

**E4. Vet business and address can't be edited on the record surfaces.** The horse page and staff records page expose only vet name and phone, and the staff update function doesn't accept the address keys at all. The intake form does carry them.

**E5. Delivered PDFs print the title twice** — once as the header, once as the body's first line.

**E6. Date of birth stored as `0001-01-01`** where someone answered N/A.

## F. CR-122 — date of birth

Required only for a participant under 18. Optional for everyone else, with month and day welcome so a birthday greeting is possible.

## G. Housekeeping

Four idle worktrees (wt-5, wt-6, wt-15, wt-16) promised to bundles that haven't asked for them, roughly 4 GB. The pool grows on demand, so they can be removed and re-cut when needed.
