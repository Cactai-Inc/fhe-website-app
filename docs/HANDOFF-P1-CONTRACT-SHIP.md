# BUILD HANDOFF — P1: get Pamela's lease shippable

**Written 2026-08-25 for a build thread.** Three items. **All three are blockers** — the owner
cannot ship a real client's lease until they are done.

**Branch from `main` (currently `f95ed03a`). Work in a worktree — a pre-commit hook refuses code
commits in the canonical checkout.**

⚠️ **READ THIS FIRST — what was already done today, so you do not redo it.**
- A saved-but-not-sent client now shows the horse card, so a horse can be added before the
  invitation exists (`Admin.tsx`, the draft/never-invited branch).
- The emergency euthanasia block is gone from `HorseIntakeForm`, and the vet-auth template now
  **states** the position instead of asking the client to choose (migration `20260825T1300`).
- The horse-information confirmation control is gone from **both** renderers in `ContractPage.tsx`,
  and its **lock blocker** is removed (migration `20260825T1200`). It had never once been satisfied
  and was refusing to lock every contract carrying horse fields.

---

# ITEM 1 — ONE EMAIL, NOT TWO

## What the owner said
> *"i will send her the invitation to activate her account and i want her to see the contract for her
> to review, right now the only option is for me to send the contract to her and send the invitation
> to activate her account, i dont want to send her two emails since that is confusing and these
> should be able to be married up as a unified single email send and on activation she sees the
> contract"*

## The current state, established
**Two separate invitations exist, with two separate tokens, two emails and two redemption paths.**

| | Account activation | Contract |
|---|---|---|
| invitation `kind` | **`COMMUNITY`** | **`CONTRACT`** |
| email template | `INVITATION` | `CONTRACT_INVITE` |
| API | `api/admin-send-invitation.ts` | `api/contract-invite.ts` |
| redeemed by | `redeem_invitation(token)` | `redeem_contract_invitation(token)` |
| link | `/activate?token=…` | `/activate?token=…&kind=contract` |

⚠️ **THREE FACTS THAT DECIDE THE DESIGN:**
1. **`invitations` ALREADY HAS `kind` AND `document_id`.** One row can already carry both meanings.
   **You are not adding a column; you are using one that exists.**
2. ⚠️ **NO `CONTRACT` INVITATION HAS EVER BEEN ISSUED.** All 19 invitation rows are `COMMUNITY`.
   The contract path is built and unexercised — **treat it as unproven, not as working.**
3. ⚠️ **`redeem_contract_invitation` REQUIRES AN EXISTING SIGNED-IN USER** (`auth.uid()` must be
   present, and the invitation email must match theirs). **That is why there are two emails today:
   the contract link assumes the account already exists.** A unified send must therefore claim the
   account first and route to the document second — not the other way round.

## What to build
**ONE invitation of `kind = 'COMMUNITY'` carrying `document_id`, and ONE email.**

1. **Sending a contract to a counterparty who has no account** must issue (or reuse) their
   **account** invitation and set `document_id` on it — not issue a second `CONTRACT` invitation.
2. **One email.** Reuse `INVITATION` and extend it, or add a variant. ⚠️ **The subject and body must
   say both things**: your account is ready to claim, **and** there is a contract waiting.
   The template is owner-editable — **put the new wording in the template, not in code.**
3. **After claiming**, route by what the invitation carries:
   - `document_id` present → **ITEM 2's flow**
   - no `document_id` → the existing landing rule *(dashboard if notifications, feed otherwise)*
4. ⚠️ **Do not delete `redeem_contract_invitation` or the `CONTRACT` kind.** A counterparty who
   already has an account is a real case and that path serves it. **Leave it; stop using it for
   people with no account.**

## Validation criteria
- [ ] Staff send a contract to a person with **no account** → **exactly one email leaves.**
- [ ] That email names both the account claim and the contract.
- [ ] Clicking it, setting a password, and continuing lands on **the contract** — not the dashboard,
      not the feed.
- [ ] A person who **already** has an account still receives a working contract link.
- [ ] No invitation row is orphaned or superseded by the change.

---

# ITEM 2 — CLAIM → FILL WHAT IS MISSING → STRAIGHT INTO THE CONTRACT

## What the owner said
> *"on activation she sees the contract, or if there is information we need like her address which i
> dont have she is prompted with an intake page to add the missing information we need for the
> contract, this applies to both her account (personal information) and her horse record. after
> adding that information she clicks continue and then she is taken right into the contract to review
> it and the information she added is shown to her"*

## The current state, established
- Pamela's contact record has **no address** — this is a live example, not hypothetical.
- The onboarding flow already exists and already captures profile details.
- ⚠️ **The onboarding surface has a dead end that must not be reused as-is:** it renders
  *"Nothing to do here"* when a person has no documents, no purchase and no standing slot —
  **it does not ask whether a contract is waiting.** If you route into onboarding without fixing
  that condition, **Pamela will be told she has nothing to do while her lease sits unsigned.**
  *(Same defect as CR-64; that fix is not yet built.)*

## What to build
**A gate between claiming and the contract:**

1. On claim with a `document_id`, compute **what the contract still needs and does not have.**
   ⚠️ **Two sources, both in scope:** the **contact** (personal information — address is the named
   example) and the **horse record**.
2. **If nothing is missing → go straight to the contract.**
3. **If something is missing → show an intake page containing ONLY the missing fields.**
   ⚠️ **Not the whole intake form. Only what this contract needs and does not have.**
4. **A single `Continue` → the contract**, with the information they just entered **visible in it**.
5. ⚠️ **The onboarding dead-end condition must be taught about waiting contracts** before this
   routes through it.

## Validation criteria
- [ ] A counterparty with a complete record claims and lands **directly on the contract**.
- [ ] A counterparty missing an address is asked **for the address**, and not for things already on
      file.
- [ ] Missing **horse** information is asked for on the same page as missing personal information.
- [ ] `Continue` goes to the contract. **One button, one destination.**
- [ ] What they typed **appears in the contract they then read**.
- [ ] ⚠️ Nobody with a waiting contract is ever shown *"Nothing to do here."*

---

# ITEM 3 — A PARTY SEES THE DOCUMENT, NOT THE AUTHORING SURFACE

## What the owner said
> *"her view of the contract should show the selections made and the text that renders along with
> that selection, she should not see the text that doesnt render in the finished document, if she
> makes a change to a selection then the content should change to the appropriately shown text
> immediately"*

## The current state, established
- The contract page renders a **clause/field cascade** — the authoring surface — where conditional
  text is visible whether or not it will appear in the finished document.
- The **merged body** *(what the document actually says)* is composed server-side and already
  resolves conditionals; `remerge_contract_from_fields` is the function that rebuilds it.
- `ContractBody` is the single component every body-rendering frame passes through — **the flat
  renderer, the read-only frame and the executed frame all use it**, so a change there cannot drift
  between them.

## What to build
1. **A party's view renders the MERGED BODY**, not the cascade. What she reads is what the document
   says.
2. **Her selections remain editable** where she is permitted to make them — the fields she owns.
3. ⚠️ **On a change, re-merge and re-render immediately.** The text she sees must change in the same
   interaction, not after a reload. **`remerge_contract_from_fields` already exists — call it; do
   not write a client-side approximation of the merge, or the screen and the PDF will disagree.**
4. ⚠️ **Text that will not appear in the finished document must not be visible to her at any point**
   — including while a selection is unset.

## Validation criteria
- [ ] A party sees prose, not a field editor.
- [ ] No conditional text she has not triggered is visible to her.
- [ ] Changing a selection changes the visible text **immediately**.
- [ ] What she sees matches the generated PDF **exactly**.
- [ ] Staff authoring is unchanged — this is the party view only.

---

# STANDING RULES FOR THIS WORK

- **Migrations:** dry-run inside `BEGIN; … ROLLBACK;`, apply, verify with a query, then commit.
  ⚠️ **Never apply a migration that depends on code which has not shipped** — that mistake has been
  made on this project and cost four hours of broken signups.
- **`invitations.token` is a live credential.** Never render it on a non-staff surface, never log it.
- **Verify as a real user:** `SET ROLE authenticated; SET request.jwt.claim.sub = '<user_id>';`
- **Do not hardcode tenant facts** — a name, an id, a timezone. They belong in settings.
- **Before building anything, grep for it.** This codebase's most common defect is a second
  implementation of something that already exists. Three of today's fixes were removals.
- **Report honestly:** what was built, what was not, and what you could not verify.

## The one test that matters
⚠️ **Pamela Godde (`f80e944a-0043-4358-9488-fa73c1eff43b`) — no account, no address, no horse — must
be able to receive ONE email, claim her account, be asked only for what is missing, and land on her
lease reading the finished text.** Everything above is in service of that.
