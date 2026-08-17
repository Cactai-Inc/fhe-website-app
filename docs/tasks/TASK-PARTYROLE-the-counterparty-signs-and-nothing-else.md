# TASK PARTYROLE — a contract counterparty signs the contract and nothing else

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** It touches provisioning, the document-requirement
spine and the contract lock gate — the three things standing between a real lessor and a signature.

**HOW TO RUN:** everything is in this file · verify every measurement · migrations dry-run with the
rollback proven · report to `docs/reports/TASK-PARTYROLE-REPORT.md` · commit, **do not push** ·
no subagents · every DB claim is query output, render claims **NOT VERIFIED** with an owner checklist.

---

# THE OWNER'S RULINGS (2026-08-17)

**On the deal client:**
> *"do we use the standard 3 guest documents? release general, policies, and rules?"* — **Yes.**

**On the party:**
> *"if party only then its just the contract, no docs, just their information and the contract and
> their horse. (assuming the party designation relates to horse owner and on a contract they are
> lessor or seller)"*

**And the reason a Party signs nothing — owner, 2026-08-17:**
> *"a seller/lessor who is already boarding at our facility has no need to sign our policies, rules,
> or general release. they are simply leasing or selling us or our client their horse."*

⚠️ **This is the principle, and it is broader than "the counterparty is a stranger".** The onboarding
documents govern **a person's presence and conduct at the facility**. A Party is not arriving — they
are **either never coming, or already here under paperwork they signed long ago.** Asking them again
is not caution, it is duplication. **In the boarding case they may already have signed all three as
a Horse owner**, and a second set would be noise on their record.

⚠️ **So a Party is a ROLE ON A CONTRACT, not a standing relationship.** The same human can be a
Horse owner with five documents *and* the Lessor on a contract — **the Party role adds paperwork
obligations of its own: none.** Anything they have already signed stands untouched.

### ⚠️ BUT THE TEST IS PRESENCE, NOT ROLE — the owner's real case
> *"in the case of the person who sold us the horse Tiz Love (BOS pending), they should have signed
> the general guest release because they delivered the horse to us."*

**A seller who never appears owes nothing. A seller who drives onto the property owes the general
release** — because they were *there*, not because of what they signed on.

**So the rule is:**

| the party… | documents |
|---|---|
| never comes to the property | **none** |
| already boards with you | **none new** — they signed long ago |
| **comes on site** — delivers, views, collects | usually **`RELEASE_GENERAL`** — **staff's call, not a rule** |

### ⚠️ NOTHING IS REQUIRED — BUT ANYTHING MAY BE APPLIED
**Owner, 2026-08-17:** *"but still not required to sign the policies or rules document."*
**And, decisively:** *"so we can apply a document or set to them but we dont have a requirement to
do so."*

**Read those together and the rule is DISCRETION, not a whitelist:**

| | |
|---|---|
| **the requirement** | **NONE. A Party is never obliged to sign anything by the system.** |
| **the default** | **`{}`** — provisioning one assigns zero documents |
| **the capability** | **staff may apply ANY document or set**, case by case |
| **the expected case** | nothing; occasionally `RELEASE_GENERAL` when they come on site |

⚠️ **DO NOT BUILD A WHITELIST OR A CEILING.** An earlier draft of this task said a Party could only
ever hold `RELEASE_GENERAL` and that policies or rules would be a defect. **That was the
orchestrator over-reading "not required" as "prohibited" — it is withdrawn.** Constraining what
staff may apply would be a second mistake in the same place as the first.

**What the build owes is a default of nothing and a control that honestly does what staff ask** —
including applying the standard three to a Party if that is genuinely what the situation calls for.
**The judgement is theirs; the system's job is to have no opinion.**

⚠️ **THE SYSTEM CANNOT KNOW WHICH.** Whether someone will set foot on the property is a fact only
staff hold. **So `Party` supplies a DEFAULT of none, and staff add what the situation warrants.**

**This makes the selection fix (§R2, the "additive-only" checkboxes) the centre of the task, not a
supporting detail.** Staff must be able to move the set **in both directions** — down to nothing for
an absent seller, up to the release for one who is delivering. **A control that only ever adds is as
broken for this case as it is for the empty one.**

⚠️ **`Tiz` is a REAL horse in production with a pending Bill of Sale.** Its seller is the live
example. **Do not create, alter or provision anything against that record while building** — it is
cited as a case to reason about, not a fixture to test on.

**Two different people, and conflating them is what produced the live bug:**

| | **Deal client** | **Party** |
|---|---|---|
| who | **your** client — leasing from you, buying, or having you find a horse | the **counterparty** — the horse's owner, signing as **LESSOR** or **SELLER** |
| documents | **the standard three**: `RELEASE_GENERAL`, `COMPANY_POLICIES`, `FACILITY_RULES` | ⚠️ **NONE. Zero. Not one.** |
| what they need | account, paperwork, then the deal | **their information · the contract · their horse** |

---

# ⚠️ THE GENERAL PRINCIPLE — CATEGORIES PROPOSE, STAFF DISPOSE

**Owner, 2026-08-17:**
> *"the horse owner requirements have to be malleable too, because they are allowing us to care for
> their horse so we need the vet auth and liability release documents signed — but not something that
> relates to them as a rider, just as a person who owns the horse releasing us of liability for
> caring for their horse."*

**This is not a Party rule. It governs every category.** A category's document set is a **sensible
default**, never a locked requirement, and **staff can adjust it for any person.**

## Horse owner is carrying a rider's document
**Measured — the current set:**
`COMPANY_POLICIES · FACILITY_RULES · HORSE_EMERGENCY_VET · RELEASE_HORSE_CARE · RELEASE_PARTICIPANT`

**And what those templates actually are:**

| template | title | whose document |
|---|---|---|
| `HORSE_EMERGENCY_VET` | Horse Emergency Veterinary Authorization | **the horse's owner** ✅ |
| `RELEASE_HORSE_CARE` | Horse Handling and Routine Care Liability Release | **the horse's owner** ✅ |
| `RELEASE_PARTICIPANT` | **Participant** Liability Release | ⚠️ **the RIDER** — wrong set |

**A horse owner who boards a horse and never sits on it is being asked to sign a participant
release.** The owner's line is exact: *"not something that relates to them as a rider, just as a
person who owns the horse."*

**So: remove `RELEASE_PARTICIPANT` from the Horse owner default.** It already belongs to **Rider**
(`COMPANY_POLICIES · FACILITY_RULES · HUMAN_EMERGENCY_MEDICAL · RELEASE_PARTICIPANT`), and
**the categories stack** — an owner who also rides is given both categories and receives it from the
Rider set. **That is the mechanism; nothing is lost.**

⚠️ **EXISTING HORSE OWNERS — do not damage them.** Removing it from the default must not:
- **touch a signed or executed `RELEASE_PARTICIPANT`** — executed documents are never swept
  (standing rule, 2026-07-29);
- **silently strip an outstanding requirement** from someone who does ride and genuinely owes it.

### ✅ MEASURED ON PROD 2026-08-17 — this change is SAFE. Nobody is affected.
**Five contacts hold `RELEASE_PARTICIPANT`, and NOT ONE of them is a Horse owner:**

| who | categories | signed? |
|---|---|---|
| Madeline Do | RIDER | ✅ executed |
| Rachel Engelhorn | RIDER | ✅ executed |
| Gabriella Olenik | RIDER | outstanding |
| Anita Tackette | ⚠️ **none** | outstanding |
| Mary Richardson | ⚠️ **none** | outstanding |

**The only `HORSE_OWNER` in production is Sarah Morgan, and she does not hold it.** So removing it
from the Horse owner default **changes nothing for anyone alive today** — the three riders keep it
through the Rider set, and the two executed ones are untouchable regardless.

⚠️ **BUT NOTE THE ANOMALY: Anita Tackette and Mary Richardson hold the requirement with NO category
at all.** Their requirement cannot have come from a category rule, and nothing will maintain it.
**Report where it came from — do not delete it, and do not "tidy" them.** Mary's twelve draft
documents are the owner's open question already.

⚠️ `apply_category_documents` **deletes** rows outside the wanted set — so an unrelated re-provision
could strip these people as a side effect. **That is the danger this section exists to prevent.**

---

# WHAT WAS MEASURED (2026-08-17 — verify, then build)

## The live bug: a Deal client silently gets three documents
`category_document_requirements` holds a `Deal client → RELEASE_GENERAL` row. **Nothing ever matches
it.** `CATEGORY_TOKEN` maps `'Deal client' → 'GUEST'` *before* the RPC is called, and
`apply_category_documents` matches on the category string — so it resolves **Guest's three** and the
`Deal client` row is dead data. **The screen says one; the database writes three.**
*(Found by `TASK-CONTRACTWALK`; independently verified by the orchestrator.)*

**Under the owner's ruling this stops being a logic bug and becomes a labelling one — the three are
now CORRECT.** ✅ **So: fix the screen, not the mapping.**

## Zero documents IS expressible — the RPC already supports it
`provision_client_invitation`:
```
IF p_template_keys IS NOT NULL THEN
  INSERT INTO contact_required_documents … FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
ELSE
  PERFORM apply_category_documents(v_contact, v_cats);
```
**An explicit empty array inserts nothing AND skips the category defaults.** The RPC is ready.
⚠️ **The UI is not** — `CONTRACTWALK` found the paperwork checkboxes *"additive-only, cannot narrow
the set even when explicitly passed."* **Establish whether the form sends `null` when nothing is
ticked** (falling through to the category defaults) **and fix that distinction — it is the whole
mechanism this task depends on.**

## A fifth group type is cheaper than previously claimed
`CAREPATH` §C10a argued against one, citing "~10 RLS-bearing surfaces". **Measured: ONE RLS policy
reads `groups`**, 10 functions reference the type strings, one CHECK constraint
(`GUEST · RIDER · HORSE_OWNER · PARENT_GUARDIAN`). **That reasoning was wrong and is withdrawn.**

---

# THE BUILD

## R1 — Deal client tells the truth: the standard three
- **The provisioning screen states all three documents** — `RELEASE_GENERAL`, `COMPANY_POLICIES`,
  `FACILITY_RULES`. **No behaviour changes; the database already does this.**
- **Retire the dead `Deal client` row** in `category_document_requirements` — it has never matched
  anything and it is what made the screen lie. ⚠️ **Confirm no other reader depends on it first.**
- **Update `CAREPATH` §C10a**, which says a deal client signs only the waiver. **That was the
  owner's earlier ruling and he has deliberately changed it** — record it as a change of mind, not
  as a correction of an error.

## R2 — `Party`: a real category that requires NOTHING
- **Add `Party` as a provisioning category.** ⚠️ **It must assign ZERO documents** — no
  `contact_required_documents` rows at all, not a shorter list.
- **Do NOT add a `Party` row to `category_document_requirements`.** Absence is the point. Provision
  it by passing an **explicit empty** `p_template_keys`.
- **`groups.group_type`** — the owner's framing is *"the party designation relates to horse owner…
  they are lessor or seller"*. **Decide and justify**: a fifth `PARTY` token, or reuse an existing
  one. **A fifth is affordable** (§WHAT WAS MEASURED) — **but state what actually differs if you add
  it, because a token nothing branches on is decoration.** ⚠️ **`HORSE_OWNER` is the trap: it drags
  five documents with it and would put this person straight back where the bug came from.**

### ⚠️ R2b — AN EXISTING CLIENT CAN BE A PARTY. DO NOT DISTURB THEM.
The owner's boarding case: *"a seller/lessor who is already boarding at our facility."* **That person
already exists**, already has a category, and has **already signed their documents.**

- **Adding the Party role must not remove, re-add, re-require or re-date anything they have signed.**
  A boarder who becomes a Lessor still owes exactly what they owed this morning.
- ⚠️ **`apply_category_documents` DELETES requirement rows that are not in the wanted set**
  (`DELETE … WHERE crd.template_key NOT IN (SELECT template_key FROM _wanted)`). **So a careless
  re-provision with `Party` as the category could strip a boarder's five horse-owner requirements.**
  **Prove this cannot happen** — it is the most destructive thing in this task.
- **Establish how the Party role is applied to an existing contact at all** — is it a category
  change, an additional category, or purely a `document_parties.party_role` on the contract?
  ⚠️ **If the contract's party row is sufficient on its own, then `Party` may not need to be a
  provisioning category — say so.** That would make this task much smaller.

## R3 — what a Party actually needs, and nothing more
1. **Their information** — the contact record. ⚠️ **`contact_profile_complete` demands phone, date of
   birth, emergency contact name and phone. Establish whether a Party is gated on it** — a horse's
   owner signing a lease has no obvious reason to give you an emergency contact. **If they are
   gated, say so; it is friction on the wrong person.**
2. **The contract** — reachable, readable, signable.
3. **Their horse** — the horse they are leasing out or selling.

## R4 — the lock gate must pass trivially for a Party
⚠️ **`CONTRACTWALK` found the real stall is *"cannot lock: Onboarding documents must be completed
first by: …"*** — not the horse-confirmation gate.

**A Party has no onboarding documents, so this must pass with nothing to complete.** ⚠️ **Prove it
does not fail on an empty set** — a check written as "all required documents are signed" behaves
differently from one written as "no unsigned document exists" when there are none at all.

## R5 — signing still requires an account
**Established earlier and unchanged: there is no signing without an account.** A Party is provisioned
and invited like anyone else — **they simply arrive at a contract instead of a pile of paperwork.**
**Do not build an accountless signing path.**

---

# TRAPS
- **Do not map `Party` to `HORSE_OWNER`** — five documents, straight back into the bug.
- **Do not "fix" the three-document behaviour.** Under this ruling it is correct; only the screen lies.
- **Absence of a requirements row is the mechanism** — do not add a `Party` row containing nothing.
- **A fifth group type must earn itself.** If nothing branches on it, say so and reuse.
- ⚠️ **Deal client and Party are NOT the same person.** The whole task exists because they were
  treated as one.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- `assertWrote()` on every write; **RLS silently zeroes UPDATEs.**
- **Run the PGlite suite** — **not a green baseline (46 red files); diff against `main`.**

# THE TEST THIS MUST PASS
1. Provisioning a **Deal client** assigns exactly `RELEASE_GENERAL`, `COMPANY_POLICIES`,
   `FACILITY_RULES` — **and the screen names all three.**
2. The dead `Deal client` requirements row is gone and nothing regressed.
3. Provisioning a **Party** assigns **ZERO** `contact_required_documents` rows — query output.
4. **The form moves the set in BOTH directions** — prove an explicitly empty selection does not
   fall through to the category defaults, **and** that staff can add `RELEASE_GENERAL` alone to a
   Party who is delivering a horse. **Either direction failing fails this test.**
4b. **The Tiz Love case, end to end**: a seller who never visits is provisioned with zero documents;
    the same seller, delivering the horse, is provisioned with `RELEASE_GENERAL` and nothing else.
    ⚠️ **Prove it on synthetic records — never against the real `Tiz` row.**
4c. ⚠️ **NOTHING IS MANDATORY, EVERYTHING IS PERMITTED**: prove a Party defaults to `{}`, that no
    code path ever *requires* a document of them, **and that staff can apply any document or set —
    including the standard three — when they choose to.** A build that restricts what staff may
    apply fails this test just as surely as one that assigns documents unasked.
5. A Party can be **added to a lease as LESSOR or SELLER**, and the document **locks** with no
   onboarding paperwork outstanding — **prove the empty-set case.**
6. A Party can sign, and execution applies the lease effects as normal.
7. **A Party is never assigned a horse-owner document set** — prove it, since that is the trap.
8. State whether a Party is gated on `contact_profile_complete`, and if so which fields.
9. ⚠️ **`RELEASE_PARTICIPANT` is out of the Horse owner default** — prove a newly provisioned Horse
   owner receives `COMPANY_POLICIES · FACILITY_RULES · HORSE_EMERGENCY_VET · RELEASE_HORSE_CARE` and
   **no participant release.**
9b. **A person who owns a horse AND rides still receives it**, through the Rider set — prove the
    categories stack rather than compete.
9c. ⚠️ **No existing contact loses a requirement or a signature.** Re-check the five holders after
    the change: two executed, three outstanding, none of them Horse owners. **All five unchanged.**
10. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTION
**Does a Party get a portal account with an app to log into, or only enough to sign?** They need an
account to sign at all (R5) — but afterwards they are a person with a login, a stable containing a
horse they may have just sold, and no relationship with the business. **Ask before deciding what
they see once the contract is executed.**

Report to `docs/reports/TASK-PARTYROLE-REPORT.md`. Do not push; the orchestrator merges.
