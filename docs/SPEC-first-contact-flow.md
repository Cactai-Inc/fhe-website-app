# SPEC — THE FIRST-CONTACT FLOW, END TO END

**Owner, 2026-08-25.** The definitive sequence from *staff press send* to *she is looking at the
community feed*. ⚠️ **This supersedes the branching described in
`docs/HANDOFF-P1-CONTRACT-SHIP.md` item 1** — read this first.

---

## 1. THE TWO SEND BUTTONS MEET IN THE MIDDLE

> *"lets make it so the two branches meet in the middle and cross check one another … she should get
> an email regardless of which send button i use"*

⚠️ **Whichever button staff press — send the contract, or send the invitation — the same thing
happens.** Neither path may produce an outcome the other cannot.

**The check is not "does this person have an account."** *(By the ruling of the same day, a contract
party always has one — creating the party required email and full name, which is everything an
account needs.)*

⚠️ **THE CHECK IS: DOES THIS PERSON HAVE AN AUTH METHOD?**
> *"probably as easy as has this person ever logged in"*

**No auth method → send them through the invite flow.**

---

## 2. THE INVITE FLOW ASKS: IS THERE ANYTHING FOR THIS PERSON TO DO?

> *"the invite flow needs to check is there anything for this person to do and it needs to rank them
> in the proper order"*

⚠️ **The ordering is possible because the disposition already exists** — *when* a document is
presented is a property of the assignment, so the flow can place documents **relative to a
contract**.

### THE RANKING — always in this order
| # | Step | Included when |
|---|---|---|
| **1** | ⚠️ **THE INTAKE FORM** | **anything it collects is missing from the client record.** **Always first when present** |
| **2** | **whichever comes first of: the horse record · the documents · the contract** | by what is outstanding and by the documents' own disposition |

### Worked through, for Pamela
1. **Intake** — ⚠️ **included: she has no address.**
2. **Horse record** — she has one, and the contract carries that horse. **Its fields are complete →
   skipped.**
3. **Documents** — ⚠️ **he chose "as part of the contract", which he reads as AFTER it.** So they do
   not come first.
4. **The contract** — therefore **next after intake**.

---

## 3. THE SEQUENCE SHE EXPERIENCES

| # | She sees | Then |
|---|---|---|
| 1 | **the email** — ⚠️ **one, whichever button was pressed** | clicks the link |
| 2 | **the auth setup page** — sets her password | ⚠️ **it logs her in for the first time** |
| 3 | ⚠️ **the intake form** — her personal information, the missing fields | **Continue** |
| 4 | **the contract** — ⚠️ **with the information she just entered already on it** | reviews it |
| 5 | she **signs** | ⚠️ **immediately** → |
| 6 | ⚠️ **the documents she has to sign** — no return trip, no dashboard in between | signs them |
| 7 | the last button — *continue* / *finish* | ⚠️ **this triggers the email carrying the contract AND the documents** |
| 8 | ⚠️ **she exits into the app** | → |
| 9 | **the overview modal**, first time | closes it |
| 10 | ⚠️ **the community feed** — **because she has no notifications** | done |

⚠️ **STEP 10 CONFIRMS THE LANDING RULE:** *dashboard if notifications are present, the community feed
otherwise.* She has none, so she lands on the feed. **This is the same rule that the deleted
"nothing to do here" page had wired backwards.**

⚠️ **STEP 7 IS THE SEND, AND IT IS ONE EMAIL.** The contract and the documents go together, at the
end, **triggered by her finishing** — not by each signature.

---

## 3b. ⚠️ THE SEQUENCE IS COMPUTED, NOT FIXED

> *"for a situation where any of those things i setup are different it should adjust the flow
> accordingly"*

**§3 is one worked instance. The flow is assembled from what is actually outstanding, every time.**

### The rules that generate it
| Rule | |
|---|---|
| **a step appears only when it is outstanding** | nothing is shown to someone who does not owe it |
| **intake leads, when anything it collects is missing** | *"if there was no missing information for her account she would go straight into the contract on sign in"* |
| **documents sit where their DISPOSITION puts them** | ⚠️ *"if i selected have the docs signed first she would see them before the contract"* — **the setting he already has decides the order** |
| **the horse comes before the contract that needs one** | *"if there was no horse on the contract and no horse record she would be shown the horse intake form first"* |
| ⚠️ **the EXIT follows the landing rule** | **dashboard when notifications exist · community feed when they do not** |

### The exit, spelled out
> *"if she has an order that needs payment and scheduling or she has unsigned docs she would exit the
> flow from the contract into the dashboard after she sees the overview modal"*

| After finishing | She lands on |
|---|---|
| nothing else outstanding *(§3, Pamela)* | ⚠️ **the community feed** |
| **an order needing payment or scheduling**, or **unsigned documents** | ⚠️ **the dashboard** — the notifications are there and that is where they live |

⚠️ **The overview modal comes first either way**, on a first sign-in. **The landing rule decides only
what is behind it.**

### ⚠️ THE HORSE CASE — and an improvement he asked for
**As described:** no horse on the contract and no horse record → **horse intake form first**, then
**the contract asks her to add her horse to it.**

> *"unless we can make that happen automatically which would be superior ux"*

⚠️ **IT SHOULD BE AUTOMATIC, AND HE IS RIGHT THAT IT IS BETTER.** A horse created **inside a contract
flow, for a contract that needs a horse**, has exactly one plausible destination. **Asking her to
attach it is asking her to repeat herself.** ⚠️ **Attach it and say so** — *"Sundance has been added
to this agreement"* — rather than attaching it silently or asking.

---

## 3c. ⚠️ IT IS A CHECKLIST THAT RESUMES — not a one-pass wizard

> *"yes she needs to pick up where she left off. the system should have a checklist it builds for the
> steps the person needs to complete in the order they get presented and if things are optional its
> not strict about completion of one gating the others but either way it needs to resume and the
> requirement selection is what dictates if they can skip or close out of what they are shown on login
> or refresh of the page."*

**The flow is a CHECKLIST the system builds for that person** — the steps they owe, **in the order
they are presented**.

| | |
|---|---|
| ⚠️ **it RESUMES** | she picks up where she left off. **Leaving is not abandoning** |
| ⚠️ **it is re-evaluated on LOGIN and on REFRESH** | not computed once and carried. Finish a step and what follows reflects it |
| **optional items do not gate** | *"its not strict about completion of one gating the others"* — an optional step left undone **does not block the next** |
| ⚠️ **THE REQUIREMENT LEVEL DECIDES WHETHER THEY CAN SKIP** | *"the requirement selection is what dictates if they can skip or close out of what they are shown"* |

### ✅ THE SKIP RULE ALREADY EXISTS — do not invent a second one
**The disposition on an assignment already carries exactly this**, and it was built for it:
| Disposition | Behaviour |
|---|---|
| **`AT_LOGIN`** | presented on sign-in |
| **`WITH_CONTRACT`** | presented with the contract — **this is what places documents before or after it** |
| **`WHEN_READY`** | ⚠️ **surfaced every sign-in, DISMISSABLE, never blocking** |

⚠️ **So "can she skip this?" is already answered per item by its disposition.** **The checklist reads
it; it does not decide it.** *(And it is owner-editable, which is the point — the same setting that
orders the steps also decides which of them can be closed out of.)*

### What this means for the build
1. **The checklist is DERIVED, not stored as a wizard position.** *"Where she left off"* is
   **whatever is still outstanding**, recomputed — so it is correct after a refresh, after staff
   change something, and after she completes anything.
2. ⚠️ **Every entry point must produce the same checklist** — the emailed link, a fresh login, a
   refresh mid-flow. **One builder, not one per entry.**
3. **A blocking item stops the ones after it. A dismissable one does not.**
4. ⚠️ **A dismissed item is not a completed one** — it returns next sign-in *(that is what
   `WHEN_READY` means)*. **Dismissal must not read as done anywhere.**

---

## 4. WHAT THIS CHANGES ABOUT WHAT WAS ALREADY BUILT

| | |
|---|---|
| **the account-or-not branch** | ⚠️ **wrong question.** Replace with **auth-method-or-not** |
| **the intake gate** | ✅ built, and correctly placed **first** — ⚠️ but see the fail-open note below |
| **contract → documents → exit** | ⚠️ **the chaining is NOT built.** Today signing ends somewhere else |
| **the sequence itself** | ⚠️ **must be COMPUTED from what is outstanding (§3b), not hard-coded.** §3 is one instance of it |
| **resuming** | ⚠️ **NOT built.** A checklist that rebuilds on login and refresh (§3c), where the disposition decides what may be skipped |
| **attaching a horse created mid-flow** | ⚠️ **not built — and it should be automatic, not a prompt** |
| **the final email** | ⚠️ must fire on **finishing the whole sequence**, carrying **both** |

⚠️ **AND A RISK TO SETTLE BEFORE THIS SHIPS:** run against a caller with no party role,
`contract_intake_requirements` returned **`"complete": true`** with **`"my_roles": []`**. **If "no
roles found" reads as "nothing missing", the gate fails open** and step 3 is skipped for the very
person it exists to catch. **Establish whether `complete` means *nothing is missing* or *nothing was
checked*.**

---

## 5. THE ACCEPTANCE TEST
⚠️ **Pamela Godde — account ✅, auth identity ❌, no address, one horse whose record is complete, a
lease carrying that horse, documents dispositioned to follow the contract.**

**One email → auth setup → intake asks for her address and nothing else → Continue → the lease with
her address on it → sign → the documents → finish → one email carrying both → the app → the overview
modal → the community feed.**

**Every step in that sentence is a checkpoint. None of it is proven until someone walks it in a
browser.**
