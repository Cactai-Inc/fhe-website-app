# Equine lease insurance logic — request for validation and completion

## Who is asking and what for

We operate an equestrian program in San Diego, California. We do **not** own the
facility, and we do **not** own most of the horses — we lease them from owners who
already board at the facility where we run our program. Our services are English riding
lessons, jump training for advanced riders who intend to compete, horse training
(skills, problem areas, desensitisation), exercise riding, turnout and lungeing.

We have built a contract-authoring system that drafts personalised horse lease
agreements. It must serve four party configurations:

- FHE as **Lessee**, leasing a boarder's horse to use in our program (our most common case)
- FHE as **Lessor**, sub-leasing a horse we hold to one of our clients
- Client-to-client leases where we merely **assist** with the system
- Either side being an **individual** or a **business entity**, in **full** or **partial** leases

You previously supplied a policy framework governing when each party can, must, or
cannot hold each of four insurance types (General Liability, Equine Mortality, Major
Medical/Surgical, Care-Custody-Control), plus deductible and reimbursement rules. We
have translated that into machine-enforceable condition sets. **We need you to validate
the translation and fill the gaps before we build.**

---

## What our system does today (audited, not assumed)

Three insurance areas exist — GL, Medical, Mortality — each with the same six fields:
a "not required" checkbox, a status select for each party, a Lessee responsibility
certification, a deductible-responsibility select, and two split-percentage fields.

**Care, Custody and Control exists only as one unconditional paragraph** reading, in
substance, *"Lessee shall obtain and maintain care, custody and control insurance for
the duration of this Agreement."* It has no fields and no conditions, so it applies to
every lease we issue — including leases where the Lessee is a private individual.

Critically: **the system currently enforces no restrictions whatsoever.** Every election
is freely selectable in every combination. Nothing prevents a Lessor from requiring a
partial lessee to carry mortality insurance, or from obligating an individual consumer
to obtain CCC coverage.

---

## The model we derived

Each insurance type, for each party, resolves to one of three states:

- **MANDATORY** — must be carried; the lease cannot elect otherwise
- **PERMITTED** — may be elected, and the Lessor may require it of the Lessee
- **PROHIBITED** — cannot lawfully be elected (a carrier would deny it, or no insurable
  interest exists)

Driving variables: lease type (full/partial); Lessor and Lessee party type
(individual/entity); whether off-site transport is granted; whether jumping and
competition are permitted; the Lessor's insurable interest in the horse
(owner / leaseholder / none); whether the primary owner has authorised insuring;
whether the horse is used by multiple students in a lesson program.

### General Liability
- Lessor requiring it of Lessee: always permitted; **mandatory** when off-site transport
  is granted or the Lessee is an entity.
- Lessee policy type constrained by party type: individuals may only be required to hold
  Personal Horse Owner's / Private Horse Rider's liability, since commercial GL is not
  sold to hobbyists.
- Lessor: **mandatory** when the Lessor is an entity running a program (CGL with an
  Equestrian Professional Liability endorsement). Never prohibited.
- Never shareable. Where the Lessee carries GL, naming the Lessor **and the facility
  owner** as Additional Insureds is mandatory, with a COI inside 5 days.

### Equine Mortality
- Lessor requiring it of Lessee: permitted on a full lease; **prohibited on a partial
  lease**.
- Lessee holding it at all: **prohibited on a partial lease** — carriers deny for lack
  of sole insurable interest.
- Lessor: **mandatory** if our upstream lease requires it or we own the horse;
  **prohibited when the Lessor has no insurable interest**.
- Not shareable; permitted alternative is the Lessee paying the premium on the Lessor's
  policy with the Lessor as sole Loss Payee.

### Major Medical / Surgical
- Lessor requiring it of Lessee: permitted on a full lease; **on a partial lease,
  restricted to requiring a pro-rata share of the Lessor's existing premium**.
- Lessee holding it: **prohibited on a partial lease where the horse is ridden by
  multiple students**.
- Lessor: **mandatory** for high-value horses in the advanced jumping/training program;
  **prohibited** where the Lessor does not own the horse and the owner has not authorised
  insuring it.
- Not shareable; premium cost-splitting permitted.

### Care, Custody and Control
- Section applies when **either** party is a business entity.
- Lessor: **mandatory** when the Lessor is an entity — we train, lunge and give lessons
  on horses we do not own, so we must answer claims from the primary owners.
- Lessee: may be required **only if the Lessee is a business entity**;
  **prohibited entirely when the Lessee is a private individual**, as CCC is a commercial
  product consumers cannot purchase.

### Deductibles
Two layers, deliberately separated: a **fault override** (Lessee's clear breach — jumping
above the agreed height, gate left unlatched — allocates 100% of the deductible to the
Lessee regardless of any election), and a **no-fault allocation** (illness, pasture
accident) that is selectable, defaulting to 100% Lessee on full leases and 50/50 or 100%
Lessor on partial leases.

### Payment flow
The named primary policyholder must make the initial payment to the veterinary hospital,
file the claim, receive reimbursement, and then reconcile the out-of-pocket balance with
the other party per the elections. An Emergency Medical Care Authorisation Limit grants
our program authority to authorise life-saving surgery when the Lessor cannot be reached.

---

## What we need from you

1. **Validate or correct the three-state model.** Is MANDATORY / PERMITTED / PROHIBITED
   sufficient, or are there states we are missing — conditionally mandatory, mandatory
   only on renewal, waivable by written agreement?

2. **Confirm or correct each PROHIBITED determination**, since these are the ones that
   will now be enforced by software rather than judgement. Specifically: is a partial
   lessee genuinely unable to obtain mortality cover as a matter of carrier practice, or
   is it merely uncommon? Is CCC categorically unavailable to consumers in California, or
   are there products that blur that line?

3. **Define "high-value horse"** for the purpose of mandatory Lessor medical cover. We
   need a threshold our system can evaluate — a dollar figure, or a rule combining agreed
   value with discipline and jumping height.

4. **Insurable interest.** What precisely establishes it for a Lessor who is neither the
   registered owner nor a purchaser — is a paid lease, a training investment, or contractual
   liability for the horse's value sufficient under California law? This determines whether
   we may insure the horses we lease from boarders.

5. **Emergency authorisation.** Is $5,000 an appropriate default limit, and who should
   bear the non-reimbursed portion where the lease is silent?

6. **Assisted leases.** Where our system drafts a lease between two clients and we are
   neither Lessor nor Lessee, do any of these obligations attach to us as the drafter, and
   what disclaimer should the document carry?

7. **Anything the framework still omits** that a California equine lease should address —
   loss of use, agreed-value disputes, subrogation waivers, or coverage lapse mid-term.

8. **Presentation question.** Where an election is prohibited, we intend to show it and
   block it with the reason stated, rather than hiding it — so the parties understand the
   constraint. Is there any legal exposure in displaying an unavailable option alongside
   its explanation?
