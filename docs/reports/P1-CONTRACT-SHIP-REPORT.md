# P1 — CONTRACT SHIP: REPORT

**Branch** `task/p1ship` (worktree `wt-p1ship`, from `origin/main` @ `0b1b2bbe`).
**Written** 2026-08-25. **Assignment:** `docs/tasks/TASK-P1SHIP-contract-ship.md`.

**All three items are built.** Nothing was descoped. Two boundaries inside the
items are named explicitly below (§"What I did NOT build") rather than left for
someone to discover.

---

## THE HANDOFF WAS WRONG ABOUT ONE THING — READ THIS FIRST

> *"`remerge_contract_from_fields` is the function that rebuilds it … call it; do
> not write a client-side approximation of the merge."*

**`remerge_contract_from_fields` would have destroyed Pamela's lease.** It composes
from `contract_templates.body`, and every clause-composed template stores this
there:

```
HORSE_LEASE_V2 | body = '(composed from clauses)'   -- 23 characters
```

| template | `body` length | clause defs |
|---|---|---|
| HORSE_LEASE_V2 / _FULL / _SIMPLE / _STANDARD | **23** | 163 |
| HORSE_SALE_V2 | 23 | 76 |
| HORSE_BILL_OF_SALE | 23 | 36 |
| the 20 flat templates | 3,732 – 18,253 | 0 |

The instruction is right for the flat half of the catalogue and catastrophic for
the clause half — which is the half the lease is in. The correct function already
exists and I did not have to write it:

```sql
remerge_contract_body(doc)          -- the dispatcher
  → remerge_contract_from_clauses   -- returns NULL when there are no clause defs
  → remerge_contract_from_fields    -- the flat fallback
```

I call `regenerate_contract_document`, which wraps that dispatch and also refreshes
the horse and party tokens and replays signatures — one RPC, one transaction, and
already the function the contract page calls when a document is opened.

### The same mistake is live in two shipped functions, and I fixed it

`fill_party_fields_from_contacts` and `capture_horse_record_info` both **end** on
`PERFORM remerge_contract_from_fields(...)`. Their client callers papered over it
with a second RPC:

```ts
await rpc('fill_party_fields_from_contacts')   // merged_body := '(composed from clauses)'
await rpc('remerge_contract_from_clauses')     // …and back again
```

Two RPCs are two transactions. **Between them the lease's entire text was the
23-character placeholder**, and anything that stopped the second call from landing
— a dropped connection, a closed tab, a thrown error — left the contract with no
text at all. `captureContactInfo` and `captureHorseRecord` now make one call to
`regenerate_contract_document` instead. (`regenerate_contract_document` itself
already recovered correctly, because its own fill-then-clause-remerge is inside a
single function body.)

---

## ITEM 1 — ONE EMAIL, NOT TWO ✅

**The shape of the fix.** `/api/contract-invite` now branches on the one fact that
decides it — *does this person have an account?* — because that is the fact that
forced two emails in the first place: `redeem_contract_invitation` requires an
already signed-in user whose email matches, so the CONTRACT link presupposes the
account. The unified send therefore claims the account **first** and routes to the
document **second**.

| | has an account | has no account |
|---|---|---|
| invitation | `CONTRACT` (unchanged) | **`COMMUNITY` + `document_id`** |
| RPC | `invite_contract_counterparty` | **`invite_contract_party_account`** (new) |
| email | `CONTRACT_INVITE` | **`INVITATION`, extended** |
| link | `/activate?token=…&kind=contract` | `/activate?token=…` |
| emails sent | 1 | **1** |

`redeem_contract_invitation` and the `CONTRACT` kind are untouched, as instructed.

**Reuse, not a second row.** `invite_contract_party_account` prefers an existing
`COMMUNITY` invitation for that address — **including a `draft`**, which is exactly
what Pamela is holding from PAMELA §A's save-without-send. It stamps `document_id`,
promotes `draft → sent`, extends the expiry only if it would otherwise be short,
and returns the row's **existing token**. So the link staff already saved is the
link she receives, nothing is superseded, and calling it twice is a no-op.

It carries the guards the account path needs and the CONTRACT path never did: the
same SENDGUARD already-signed refusal, party membership, org authorization — plus
**C10's minor check**, which the contract path could skip because it only ever
reached people who already had accounts.

**Routing.** `validate_invitation` now returns `kind` and `document_id`, so the
claim page knows where to land *before* redeeming. Both claim paths route on it —
password (`Register.tsx`) and Google (`RegisterComplete.tsx`, where the document id
also rides in the localStorage stash across the OAuth redirect, and the server's
answer wins over the stash on the way back).

**Wording is data.** The new copy is in the `INVITATION` row, driven by a new
`MSG.CONTRACT_TITLE` token with a dictionary entry. Rendered both ways against the
**live template** through the real renderer:

```
no contract   SUBJECT: Your invitation to French Heritage Equestrian
              …unchanged, byte for byte, from what it sends today.
              UNRESOLVED TOKENS: []

carrying one  SUBJECT: French Heritage Equestrian: your account and your Horse Lease Agreement — Standard
              "Your Horse Lease Agreement — Standard is ready for you to review.
               Claim your account with the link below and we will take you straight
               to it — one link does both. If we still need anything from you, such
               as your address, we will ask for that first and then open the document."
              …"Create your account here to review and sign it."
              UNRESOLVED TOKENS: []
```

### Validation criteria

| criterion | evidence |
|---|---|
| ☑ no account → **exactly one email** | one branch, one `sendInvitationEmail`, one `recordInvitationDelivery`; the CONTRACT_INVITE send is in the other arm of the `if` |
| ☑ names both the claim and the contract | render above, subject **and** body, from the live row |
| ☑ click → password → lands on **the contract** | `validate_invitation` returns `document_id` → `/app/contracts/:id/start` → forwards to `/app/contracts/:id` when nothing is missing (ITEM 2) |
| ☑ someone who **has** an account still gets a working contract link | that arm is unchanged; `redeem_contract_invitation` (1 row), `invite_contract_counterparty` (1 row) and the `CONTRACT` kind constraint all verified intact after the migrations |
| ☑ no invitation orphaned or superseded | rehearsed on Pamela's real row: `reused = true`, `invitation_rows = 1`, `superseded = 0`, `carrying_the_contract = 1`, and unchanged on a second call |

---

## ITEM 2 — CLAIM → FILL WHAT IS MISSING → STRAIGHT INTO THE CONTRACT ✅

**New RPC `contract_intake_requirements(document)`.** It answers *"what does THIS
CONTRACT still need and not have"*, which is deliberately **not** the question
`document_parties_summary().missing` already answers (*"which of the four fields
every lease party must have are blank"* — the staff Parties card). It reads the
tokens **this template actually prints** — from `contract_clause_defs.body`, the
flat `contract_templates.body`, and any author-added line — and reports only those
whose underlying record is empty. A contract that never prints a phone number never
asks for one.

It asks only about the caller: the contact side is scoped to roles whose party row
**is the caller's own contact**, so staff reading a counterparty's contract are
never prompted to type their details into her seat.

**The horse half is ownership-derived, not assumed.** The HORSE.* fields carry an
`owner_role` (LESSOR on this tenant's leases), so an FHE-as-Lessor contract asks its
Lessee nothing about a horse, and a Pamela-as-Lessor contract asks her. That falls
out of the data — no hardcoded tenant fact.

**New page `/app/contracts/:id/start`.** It is a **gate, not a form**: with nothing
missing it never renders and forwards to the document with `replace: true`. With
something missing it renders **only** those fields, personal and horse on one page,
under one `Continue`. Everything writes to the **central record** (contact, horse),
then recomposes, so what she typed is in the text she then reads.

**The dead end.** `my_onboarding_state` gained `contracts_waiting`, and
`Onboarding.tsx` uses it twice: the step machine now **leaves** for the contract
before the wizard resolves, and `contracts_waiting.length === 0` is a fourth
condition on the "Nothing to do here" branch — so no path into that component can
produce that sentence for someone with a contract open. When the wizard genuinely
does have work of its own, a gold banner names the contract instead of hiding it.

### Validation criteria — proven against production data (rolled back)

Run as the real LESSOR party on the live lease:

| criterion | evidence |
|---|---|
| ☑ complete record → **straight to the contract** | address on file → `contact.missing: []`; page redirects on `complete` |
| ☑ missing address → asked **for the address**, not for what is on file | address blanked → `contact.missing: [{key: address, label: "Mailing address"}]` and **nothing else** — name, email and phone were on file and were not asked |
| ☑ missing **horse** info on the **same page** | same payload: `horse.missing: [{key: vet_address, kind: address, label: "Veterinarian — address"}]` — genuinely blank in the horse record |
| ☑ one `Continue`, one destination | one `<form onSubmit>`, one `navigate` |
| ☑ what she typed **appears in the contract she reads** | both writes end in `regenerate_contract_document`, which recomposes the body before the page opens; `redeem_invitation` also recomposes at claim time |
| ☑ nobody with a waiting contract sees "Nothing to do here" | `contracts_waiting` returned the lease; both the redirect and the branch condition read it |

---

## ITEM 3 — A PARTY SEES THE DOCUMENT, NOT THE AUTHORING SURFACE ✅

**New `PartyDocumentView`.** A party now reads `documents.merged_body` — the
composed instrument — through `ContractBody`, the single renderer the flat, the
read-only and the executed frames all use, so her screen cannot drift from the PDF.
Her own controls attach to the section they govern, so a choice sits beside the
text it changes.

**Bullet 4 is satisfied by construction, not by a second set of gates.** The
composer already omits a gated-off clause and drops a line whose fillable tokens
are all empty. Rendering only its output means there is no client-side rule that
could disagree with it.

**⚠️ This reverses a standing directive, deliberately.** `ClauseDocument` shows a
party gated-off clauses **muted** while the controlling selection is unmade —
"PARTY DECISION SUPPORT (owner directive 2026-08-04)". The 2026-08-25 instruction
is explicit that unrendered text must not be visible *"at any point — including
while a selection is unset."* The newer instruction wins for the party view; the
2026-08-04 behaviour is untouched for staff authoring.

**One thing I changed beyond the letter of the item, because the item requires it.**
`reviewOnly` (no *required* field of hers is empty) used to hand a party the
read-only frame — so the instant she answered her last required question, **every
control she owned vanished, including the ones she had just used.** "Changing a
selection changes the visible text immediately" cannot be true on a surface with no
selections on it. The party view now covers the whole editable phase; `readOnlyDoc`
is what it says on the tin — locked, terminated, executed.

**Immediacy.** `saveField` calls `regenerateContractDocument` before reloading —
**only** when the party view is on screen. The page's own comment records that
regenerating on every save "would make a full recompose the cost of a keystroke",
and the authoring cascade renders from the fields directly and needs none of it. It
runs exactly where the composed text is what is on screen. The recompose is
swallowed on failure: her answer is already saved and must not be lost to it.

**Section splitting, verified against the real lease body:**

```
SECTION CHUNKS FOUND: 22
  · PARTIES · DEFINITIONS… · THE HORSE · PURPOSE AND LEASE GRANT · SCHEDULE FOR
    LESSEE'S USAGE · LEASE FEE · PAYMENT TERMS · PAYMENT METHOD · EVALUATION
    PERIOD · AGREEMENT TERM · PERMITTED USE(S) & RESTRICTIONS · HORSE CARE AND
    EXPENSES · INSURANCE… · TERMINATION · NOTICE AND CONTACT INFORMATION ·
    ASSIGNMENT OR TRANSFER · ENTIRE AGREEMENT · GOVERNING LAW AND VENUE ·
    ATTORNEYS' FEES · SEVERABILITY · LESSEE'S REPRESENTATIONS · SIGNATURES

DISTINCT FIELD SECTIONS PLACED IN THE PRINTED BODY: 13
UNPLACED (fall to the trailing block): none
```

Sub-items (`3.1 Horse Details`) correctly do not split a section — the heading
pattern requires whitespace after the dot.

### Validation criteria

| criterion | evidence |
|---|---|
| ☑ prose, not a field editor | the body slot renders `merged_body`; `ClauseDocument` and the flat field sections are gated off for a party |
| ☑ no untriggered conditional text visible | the composer omits it; nothing else renders |
| ☑ a change changes the text **immediately** | `saveField` → `regenerate_contract_document` → `load({blank:false})` in the same interaction |
| ☑ matches the PDF exactly | same `merged_body`, same `ContractBody` renderer as the executed frame the PDF is made from |
| ☑ staff authoring unchanged | `partyDocView` requires `!isOwnerSide`; a staff member who is also a party gets it **only** when they explicitly choose "view as signer" |

---

## WHAT I DID NOT BUILD, AND WHY

1. **Horse IDENTITY fields are not on the intake page** (breed, colour, sex,
   microchip, registration). The intake page writes through
   `capture_horse_record_info`, the one existing path for editing a horse record
   from inside a contract, and that function covers farrier and vet only. Identity
   comes from the horse record itself via the attach/intake gate the contract page
   already runs. Building a second horse writer to duplicate it is precisely the
   "second implementation of something that already exists" the handoff warns
   about. `contract_intake_requirements` returns `horse.needs_horse` so the gate
   can hand over rather than invent a surface.
2. **No horse-attach flow on the intake page.** Same reason: `HorseGate` on the
   contract page owns that, and `Continue` lands on the contract where it runs.

---

## MIGRATIONS — DRY-RUN, APPLIED, VERIFIED

All six applied to production (`lrstswfxfsezdmvkvukc`) after a combined
`BEGIN; … ROLLBACK;` dry run.

| file | what |
|---|---|
| `20260825T1600_one_invitation_carries_the_contract` | `validate_invitation` widened (+`kind`, +`document_id`; PUBLIC/anon grants restored after the required DROP); `invite_contract_party_account` |
| `20260825T1605_redemption_carries_the_contract` | `redeem_invitation` recomposes a carried document at claim time (PARTYEMAIL 4b's half) |
| `20260825T1610_invitation_email_names_the_contract` | `MSG.CONTRACT_TITLE` dictionary row; INVITATION subject + body |
| `20260825T1620_contract_intake_requirements` | the new read model |
| `20260825T1630_onboarding_knows_about_waiting_contracts` | `my_onboarding_state` + `contracts_waiting` |
| `20260825T1640_revoke_public_on_the_new_p1_functions` | see below |

**Ordering.** None of these depends on unshipped code — the rule that cost four
hours of broken signups is respected. Each is a no-op until the code lands:
`{{#if MSG.CONTRACT_TITLE}}` on an absent token is falsey, so the email renders
today's words byte for byte; `redeem_invitation`'s new block only fires when
`document_id` is set, which only the new RPC does; the two new functions have no
callers yet; `contracts_waiting` is an added key.

**The grant migration is not cosmetic.** Postgres grants EXECUTE to PUBLIC on a new
function by default and this database has no `ALTER DEFAULT PRIVILEGES` to stop it
— the existing functions carry `authenticated | service_role` because each was
revoked explicitly. `invite_contract_party_account` **mints an invitation token**,
and `invitations.token` is a live credential, so its own guard should not be the
only thing standing there. Verified anon is refused:

```
### 2. anon CANNOT mint a contract-party invitation
NOTICE:  PASS: refused (no EXECUTE)
```

`validate_invitation` keeps PUBLIC/anon deliberately — it is the pre-auth token
check the claim page makes before anyone is signed in. Verified still callable as
`anon` after the DROP/CREATE.

**The two rewritten functions** (`redeem_invitation`, `my_onboarding_state`) are
written as full `CREATE OR REPLACE` bodies generated from the live definitions, not
as in-place string rewrites, so they are replayable on a fresh database — unlike the
~31 pre-existing rewrite migrations CLAUDE.md flags.

---

## VERIFICATION RUN

```
npm run typecheck      0 errors
npm run typecheck:api  0 errors
npm run lint           0 errors, 48 warnings  ← identical to origin/main's 48
npm run build          ✓ built in 3.90s, prerender + sitemap clean
```

The one warning my work introduced (a non-component export from
`PartyDocumentView`) was removed rather than accepted.

**`npm run test:db` — no change, and it is red at baseline.**

| | files | tests |
|---|---|---|
| `origin/main` | 51 failed / 27 passed | 193 failed / 608 passed / 107 skipped |
| `task/p1ship` | 51 failed / 27 passed | 193 failed / 608 passed / 107 skipped |

Byte-identical. The suite loads a committed schema snapshot rather than replaying
migrations, so it does not see function-body changes at all; the red is
pre-existing and out of this assignment's scope. **Production behaviour was
verified directly against the live database instead**, which is the stronger check
for changes that are entirely function bodies.

---

## WHAT I COULD NOT VERIFY

1. **No email actually left.** Every send here is `sendViaProvider`, which I did not
   invoke — I rendered the live template through the real renderer and asserted on
   subject, body and unresolved tokens. The transport is unchanged.
2. **No browser click-through.** The routing is proven at the seams
   (`validate_invitation` returns the document; the page reads it) and the build
   compiles, but nobody has clicked the link. **This is the one thing left before
   Pamela's lease goes out** — see below.
3. **Pamela has no lease yet.** Her contact exists (`f80e944a…`, no address, no
   account, one `draft` invitation) but she is not a party to any document; the live
   `HORSE_LEASE_V2` belongs to Abby Little. Every rehearsal above made her the
   Lessor on that lease inside `BEGIN; … ROLLBACK;`, so the code paths are real and
   the data is untouched. **Production data was not modified by any rehearsal.**
4. **`contract_intake_requirements` under a party who is not yet linked.** It was
   exercised as a party with an account. Pamela's contact is linked to her account
   by `promote_contact_to_account` *inside* `redeem_invitation`, before any routing
   happens, so `current_contact_id()` resolves by the time the gate loads — but that
   specific ordering was verified by reading `redeem_invitation`, not by executing a
   claim.

### THE ONE TEST THAT MATTERS — how to run it

1. Add Pamela as a party to a `HORSE_LEASE_V2` and send it to her seat.
2. **Her inbox gets one message**, subject `French Heritage Equestrian: your
   account and your Horse Lease Agreement — Standard`.
3. Click → set a password → she is asked **for her address and nothing else**.
4. `Continue` → the lease, as finished prose, with her address in it.
5. Change a selection → the text changes without a reload.
