# TASK-OFFERINGDOCS — the offering decides the paperwork, not the tag

**Owner ruling, 2026-08-24.** Supersedes the "deal party needs its own category tag" framing that
opened this thread — under the model below a deal party needs no tag at all, and owes nothing,
because they bought nothing. Nothing was built on that framing; the branch carries this doc only.

---

## THE RULINGS, VERBATIM

> "The spine for every account should be account. A person should just be able to exist in our
> system as a record, as an account, without any requirement that they are assigned a category tag."

> "tagging is just boxes i tick for all categories. the group construct was to gate the access to
> the app to constrain what each type sees but we abandoned that and now every account is seen as
> an equal in this way. so the tagging is just for us to know what type of services or relationship
> they have with us and it helps inform the onboarding which is a mistake. **the onboarding should
> be informed by the offerings not a tag**"

> "they only get those documents if i want them to get them, not by default. by default they
> require no docs." *(on the LESSOR / SELLER contract-role bundles)*

> "yes the visitor set (guest) is the one that has no offering, but that doesnt mean an account
> without an offering is automatically a visitor. an account doesnt need a designation checked and
> checking any of them other than guest doesnt necessitate the docs until there is an offering.
> **but guest does necessitate the docs.**"

> "if they select an offering that requires a document set, they get them to sign at the point they
> process the offering, so if they activate an account from the signing flow using the url we give
> them, it provisions an initial offering based on that specific url, and thus requires the
> documents. if we provision the account and add an offering it does the same, in the manual
> provisioning its possible to uncheck the auto selected docs, and deal party even if the docs are
> selected it happens after the deal is signed **unless there is an offering which then supersedes
> the contract**. so if a horse owner is being added to the system because they are negotiating to
> lease their horse to us and they want us to provide some horse care services we provision them
> with offerings (even if they are comped and the price is zeroed out) and the documents apply so
> they click the link and they have to sign the docs first then they see the contract. but if that
> same person were to not have the offering provisioned on their account then they would go
> straight to the contract and after the contract is executed if i checked the boxes for any docs
> they would be moved straight from signing the contract into signing the docs, then they get a
> copy of everything emailed to them. in the first scenario the docs get emailed to them after they
> sign the last one and before the contract is even opened. if the contract is then signed the
> contract gets emailed to them like normal but the docs arent part of the contract in the same way
> they would be in scenario 2, since the offering they purchased is independent of the lease
> agreement."

---

## THE MODEL, IN FIVE RULES

1. **The account is the spine.** No tag is required for an account to exist. *(Already true —
   see §1.1.)*
2. **A tag describes; it does not obligate.** Rider and Horse owner say what relationship someone
   has with us. Neither creates a document requirement.
3. **GUEST IS THE ONE EXCEPTION.** Ticking Guest **does** require the visitor set immediately,
   because the obligation is *being on the property*, and a visitor buys nothing. **An account with
   no offering is NOT thereby a guest** — no designation is the normal state.
4. **Every other document requirement comes from an OFFERING**, and is signed **at the point the
   offering is processed**. A comped, zero-priced offering counts — the price is irrelevant, the
   service is what carries the paperwork.
5. **Ordering — an offering supersedes the contract.**
   - **Offering present** → its documents are signed **before** the contract is opened. They are
     emailed as their own set when the last one is signed. The contract is emailed separately
     later, as normal. The two are unrelated: *"the offering they purchased is independent of the
     lease agreement."*
   - **No offering** → straight to the contract. Any documents staff ticked are signed
     **immediately after execution**, and **everything goes out as one email** — contract and
     paperwork together, as one event.

---

## 1. WHAT IS TRUE TODAY — verified live, do not re-derive

### 1.1 The account spine already works. The tag is already optional.

`provision_client_invitation` has no "at least one category" guard — STABILIZE ITEM 2 replaced the
`RAISE EXCEPTION` with the `v_no_cats` flag. Proven in `BEGIN…ROLLBACK` as the tenant owner:
provisioning with `p_categories => '{}'` and `p_template_keys => NULL` gives
**account_exists 1 · documents_owed 0 · tags 0**.

`TASK-PAMELA` (merged `bc244e13`) made that state *reachable* — the form had been auto-ticking
"Guest" on every fresh contact because `suggested_category_for_contact` returns GUEST as its ELSE
branch. **Rule 1 needs no work.**

### 1.2 The tag is literally the middleman, and it launders a guess into an obligation

```
purchase → derive_affiliations → tag → apply_category_documents
         → category_document_requirements (12 rows, keyed 'Guest'/'Rider'/'Horse owner')
         → contact_required_documents
```

**There is no offering→document mapping anywhere in the database.** The only mapping is
category→document. So the offering already decides the outcome — it just has to launder itself
through a tag to get there.

**`derive_affiliations` counts three kinds of evidence: executed documents, the purchase, and
`invitations.categories` — the boxes a staff member ticked.** The first two are facts. The third is
a guess, and it carries identical weight. **That is the mistake, named exactly.**

### 1.3 The group construct is already dead as an access gate — the owner remembers correctly

Nine functions read `groups`: `affiliation_reconciliation`, `apply_affiliations`,
`apply_category_documents`, `contact_dossier`, `deliver_evaluation_report`, `my_standing_categories`,
`promote_contact_to_account`, `purge_account`, `request_onboarding_categories`. **Checked: none of
them gates access.** Access is `members` / `is_active_member()`.

What remains is bookkeeping, one display panel, one delivery check — **and
`apply_category_documents`, the single place where a tag still becomes an obligation.** Remove that
one edge and `groups` is what the owner says it is: a label.

### 1.4 There is ONE seam, and every reader is behind it

```sql
required_templates_for_contact(contact) → SELECT template_key FROM contact_required_documents
                                          WHERE contact_id = $1 AND skipped_at IS NULL
```

The wall (`my_wall_state` → `contact_document_wall_state`), the generator
(`generate_my_onboarding_documents`), the onboarding page (`my_onboarding_state`) and the invitation
checklist all read through it. **Only the WRITER changes. Not one reader moves.** This is why the
change is far smaller than it sounds.

### 1.5 `/sign/*` provisions a CATEGORY, not an offering — this is rule 4's main gap

`api/sign-start.ts` maps the URL through `PATH_CATEGORIES` (`rider → ['RIDER']`,
`horse → ['HORSE_OWNER']`, `rider+horse → both`, `guest → ['GUEST']`) and calls
`provision_client_invitation` with **`p_offering_ids: []`**.

So the self-service URL *is* a tag, and the tag creates the documents. The owner's description —
*"it provisions an initial offering based on that specific url"* — **is not what happens today.**
`/sign/deal` is correctly the exception: it claims an existing contract and provisions nothing.

### 1.6 Some offering→document logic already exists, hardcoded in function bodies

`RELEASE_HORSE_EXERCISE`, `EVALUATION_LIABILITY_WAIVER` and `RELEASE_JUMPER_ADDENDUM` are named
literally inside `generate_my_onboarding_documents`, `my_onboarding_state`, `release_preview` and
`sign_release`. The idea is already half-present and **hardcoded — which D21 makes a defect by
default.** Build the table on top of these, don't leave them beside it.

### 1.7 Scenario 2's email already exists and already does the right thing

`api/deliver-documents.ts` sends a SET of executed documents as ONE email, each signer receiving
only what they are a party to — its own header cites *"a lease plus each side's own role
paperwork (TASK DEALAUTO)"*. **Rule 5's "copy of everything" is built.** Scenario 1 needs the same
endpoint on a different trigger, with a different set.

### 1.8 Contract-role bundles already fire AFTER execution — rule 5's second half is built

`contract_role_documents` is read by `contract_role_document_requirements` and generated by
`ensure_contract_role_documents`, which is called **only** from `deal_autocomplete_on_execution`,
after the governing document executes. LESSEE's two rows were already deactivated on 2026-08-22.

**Still live and contradicting the ruling:** LESSOR carries four (Company Policies,
Horse Emergency Vet, General Release, Horse-Care Release) and SELLER two (Company Policies,
General Release) — **automatically**. The owner has ruled: by default, none.

---

## 2. WHAT TO BUILD

### §1 — The offering carries its documents, and the owner edits that mapping

New table, keyed on **`service_type`** — 14 service types against 23 offerings, so a new SKU
inherits correctly instead of arriving with no paperwork because nobody remembered to map it.
The one place offerings genuinely differ is "(With your horse)", already handled by
`horse_included`.

**D13/D21: it ships with its editor, or it is not done.** A hardcoded requirement list is the exact
pattern those decisions exist to stop, and §1.6 shows three of them already hardcoded. Seed it from
the current `category_document_requirements` behaviour so nothing silently changes on day one, then
let the owner diverge it.

### §2 — Change the WRITER of `contact_required_documents`. Change no reader.

- A purchase writes the requirements of its lines' service types.
- **GUEST — and only GUEST — still writes from the tag** (rule 3). Rider and Horse owner stop
  writing anything.
- Removing the tag never removes a requirement (NOSTRIP stands: narrowing is its own reasoned act).

### §3 — `derive_affiliations` stops treating a ticked box as evidence

Drop the `inv` CTE — the `invitations.categories` branch. Documents and purchases are facts; a
staff tick is a description. **Keep GUEST's own path**, which rule 3 requires.
⚠️ Check `request_onboarding_categories` and `promote_buyer_from_offering` in the same pass.

### §4 — `/sign/<path>` provisions an OFFERING, not a category (§1.5)

`PATH_CATEGORIES` becomes a path→offering map, so the URL provisions the thing that carries the
paperwork. **Which offering each URL provisions is the owner's to set, not a constant in a file** —
same D13 test as §1. `/sign/deal` keeps provisioning nothing.

### §5 — Ordering, both directions (rule 5)

- **Offering present:** its documents gate the contract. ⚠️ **This partly reverses a ruling from
  2026-08-22 — see §3 below. Confirm before building.**
- **Offering absent:** unchanged — `deal_autocomplete_on_execution` already does it.

### §6 — Two email triggers, one endpoint

- **Scenario 1:** last offering-document executes → `deliver-documents` with *that set only*,
  **before the contract is opened**. The contract emails separately later, as normal.
- **Scenario 2:** contract + its role documents → one email, everything. **Already built** (§1.7) —
  verify, don't rebuild.

### §7 — LESSOR / SELLER bundles are not automatic

Default: none. Retire them the way LESSEE's were, with the reason on the row.
**Then give the owner the switch**, or this is a default-off with no way to turn it on — a D13
failure. The natural home is the "paperwork this deal carries" panel on `PartiesHorseCard`, which
already lists exactly these rows.

### §8 — The provisioning form follows the offering

Auto-selected documents come from the chosen offerings, not the category. **Staff can still
uncheck them** — owner: *"in the manual provisioning its possible to uncheck the auto selected
docs."* The mechanism exists (`docChecked` → explicit `templateKeys`); only its source changes.

---

## 3. THE ONE THING TO CONFIRM BEFORE BUILDING §5

**The document-before-contract gate was retired on 2026-08-22, on the owner's own instruction.**
`ContractPage.tsx:401` — `CONTRACT_ONBOARDING_GATE_RETIRED = true` — records it:

> Owner: *"Lessee paperwork is handled separately and doesnt gate signing nor required after
> signing,"* and, asked how far that goes, *"off entirely."*

The server blocker went with it (`contract_lock_blockers`' `onboarding_documents`, migration
`20260822T0820`).

**Rule 5 asks for a gate in front of the contract again.** The two may not actually conflict — the
retired gate keyed on *the onboarding wall in general*, whereas rule 5 keys on *the specific
offering this person just processed*, which is a narrower and differently-motivated thing. But
restoring a gate the owner switched off two days ago is not something to do quietly.

**Ask: does the offering gate apply to the counterparty on a contract (the lessee), or only to the
person who purchased the offering?** The comment flipping the boolean back is already written.

---

## THE REACH

- The owner edits service-type → document requirements at a real screen (§1). No editor, not done.
- The owner sets which offering each `/sign/<path>` URL provisions (§4).
- The owner turns a contract role's bundle on for one deal, from the panel that already lists it (§7).

## THE TELL

- A deal party with no offering: account exists, **zero documents**, straight to the contract.
- The same person with a comped horse-care offering: signs its documents first, gets them emailed,
  **then** sees the contract.
- Ticking Rider assigns nothing. Ticking Guest assigns the visitor set immediately.

## Constraints

- Worktree `~/Downloads/claude-code-repo/wt-dealparty`, branch `task/dealparty`.
- Migration discipline: dry-run in `BEGIN; … ROLLBACK;`, apply, verify, commit. ⚠️ A migration file
  carrying its own `BEGIN;…COMMIT;` **cannot be wrapped** in a dry-run transaction — the inner
  `COMMIT` closes the outer one and it applies for real. This bit TASK-PAMELA.
- `NOTHING IS REMOVED` (D32): retire behind a flag with a reason; never delete.
- Do not push. Report and stop.
