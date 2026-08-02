# HORSE_BILL_OF_SALE — full template extract

Generated 2026-08-02 17:14:40 UTC from the live database (project `lrstswfxfsezdmvkvukc`),
reflecting migration head `20260802090006_record_signature_cobuyer_namespace.sql`.

Every section, clause, field, option list, helper text and conditional in the
live lease template, in render order.

Legend:
  **CONDITIONAL** — appears only when the stated expression is true.
  *(info)* — the text behind that item's info button.
  `{{TOKEN}}` — an input rendered inline in the clause prose.
  Fields list their input kind, and their choices where they have a fixed set.

---

## 1. Bill of Sale

`BOS_TITLE`

### INTRO *(no heading set)*

`BOS_TITLE.INTRO`

> EQUINE BILL OF SALE. This Bill of Sale is made effective as of {{DOC.EFFECTIVE_DATE}} by {{SELLER.FULL_NAME}} of {{SELLER.ADDRESS}} ("Seller") in favor of {{BUYER.FULL_NAME}} of {{BUYER.ADDRESS}} ("Buyer").

- **Seller is an** — `SELLER.PARTY_TYPE` · input: select · required · owner: SELLER
    - choices: Individual, Entity / organization
- **Buyer is an** — `BUYER.PARTY_TYPE` · input: select · required · owner: BUYER
    - choices: Individual, Entity / organization

### CO_BUYER *(no heading set)*

`BOS_TITLE.CO_BUYER`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES

> {{COBUYER.FULL_NAME}} of {{COBUYER.ADDRESS}} ("Co-Buyer") takes title jointly with Buyer as follows: {{TXN.CO_BUYER_TITLE_FORM}}. Every reference to Buyer in this Bill of Sale includes Co-Buyer.

- **Is there a co-buyer?** — `TXN.CO_BUYER_ENABLED` · input: select · required · owner: DEAL
    - choices: Yes, No
- **Co-Buyer name** — `COBUYER.FULL_NAME` · input: text · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
- **Co-Buyer address** — `COBUYER.ADDRESS` · input: text · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
- **Co-Buyer phone** — `COBUYER.PHONE` · input: text · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
- **Co-Buyer email** — `COBUYER.EMAIL` · input: text · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
- **Co-Buyer printed name** — `COBUYER.PRINTED_NAME` · input: text · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
- **Co-Buyer is an** — `COBUYER.PARTY_TYPE` · input: select · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
    - choices: Individual, Entity / organization
- **How will title be held?** — `TXN.CO_BUYER_TITLE_FORM` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES
    - choices: Joint tenants with right of survivorship, Tenants in common in equal shares, Tenants in common in the shares stated below, As stated below
- **Title detail** — `TXN.CO_BUYER_TITLE_DETAIL` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: (TXN.CO_BUYER_TITLE_FORM = TIC_STATED OR TXN.CO_BUYER_TITLE_FORM = OTHER)

## 2. The Horse

`BOS_HORSE`

### IDENTITY *(no heading set)*

`BOS_HORSE.IDENTITY`

> This Bill of Sale conveys the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
> Barn Name: {{HORSE.BARN_NAME}}
> Color: {{HORSE.COLOR}}
> Markings: {{HORSE.MARKINGS}}
> Breed: {{HORSE.BREED}}
> Registration Number: {{HORSE.REGISTRATION_NUMBER}}
> Sex: {{HORSE.SEX}}
> Foaling date: {{HORSE.AGE_DOB}}
> Height: {{HORSE.HEIGHT}}
> Microchip: {{HORSE.MICROCHIP}}
> Passport: {{HORSE.PASSPORT_NUMBER}}

- **Barn name** — `HORSE.BARN_NAME` · input: text · owner: SELLER
- **Height** — `HORSE.HEIGHT` · input: text · owner: SELLER
- **Registered name** — `HORSE.REGISTERED_NAME` · input: text · required · owner: SELLER
- **Color** — `HORSE.COLOR` · input: select · owner: SELLER
    - choices: Bay, Chestnut, Gray, Black, Brown, Roan, Palomino, Pinto / Paint, Buckskin, Dun, White / Cremello
- **Markings** — `HORSE.MARKINGS` · input: text · owner: SELLER
- **Breed** — `HORSE.BREED` · input: select · owner: SELLER
    - choices: Warmblood, Thoroughbred, Quarter Horse, Arabian, Pony, Draft, Appaloosa, Morgan, Friesian, Andalusian, Mustang, Crossbred / Grade
- **Registration number** — `HORSE.REGISTRATION_NUMBER` · input: text · owner: SELLER
- **Sex** — `HORSE.SEX` · input: select · owner: SELLER
    - choices: Mare, Gelding, Stallion, Colt, Filly
- **Foaling date** — `HORSE.AGE_DOB` · input: text · owner: SELLER
- **Microchip #** — `HORSE.MICROCHIP` · input: text · owner: SELLER
- **Passport #** — `HORSE.PASSPORT_NUMBER` · input: text · owner: SELLER

## 3. Consideration

`BOS_CONSIDERATION`

### PRICE *(no heading set)*

`BOS_CONSIDERATION.PRICE`

> The purchase price for the Horse is {{TXN.PURCHASE_PRICE}} (the "Purchase Price"), the receipt and sufficiency of which are acknowledged to the extent stated below. The parties state this Purchase Price for all purposes, including California Business and Professions Code Section 19525 where applicable.

- **Purchase price** — `TXN.PURCHASE_PRICE` · input: currency · required · owner: DEAL

## 4. Conveyance

`BOS_CONVEYANCE`

### PAID *(no heading set)*

`BOS_CONVEYANCE.PAID`

**CONDITIONAL** — shows when: TXN.BOS_PAYMENT_STATUS = PAID_IN_FULL

> Seller acknowledges receipt of the Purchase Price in full and hereby sells, transfers, conveys, and delivers to Buyer all of Seller's right, title, and interest in and to the Horse, together with the Horse's registration papers and passport where applicable, TO HAVE AND TO HOLD the same unto Buyer and Buyer's successors and assigns forever.

### INSTALLMENT *(no heading set)*

`BOS_CONVEYANCE.INSTALLMENT`

**CONDITIONAL** — shows when: TXN.BOS_PAYMENT_STATUS = INSTALLMENTS

> The Purchase Price is payable in installments under the parties' Horse Sale and Purchase Agreement. Seller hereby transfers possession of the Horse to Buyer, and title to the Horse passes to Buyer only upon Seller's receipt of the Purchase Price in full as provided in that Agreement, until which time Seller retains title and a purchase-money security interest in the Horse as stated in that Agreement. Upon payment in full, this Bill of Sale operates without further action to convey all of Seller's right, title, and interest in and to the Horse to Buyer.

### PENDING *(no heading set)*

`BOS_CONVEYANCE.PENDING`

**CONDITIONAL** — shows when: TXN.BOS_PAYMENT_STATUS = (empty)

> [Pending — select whether the Purchase Price is paid in full or payable in installments. This placeholder is replaced by the applicable conveyance language and blocks signing.]

- **Payment status at execution** — `TXN.BOS_PAYMENT_STATUS` · input: select · required · owner: DEAL
    - choices: Paid in full, Installments

## 5. Warranty of Title; Condition

`BOS_WARRANTY`

### TITLE *(no heading set)*

`BOS_WARRANTY.TITLE`

> Seller warrants that Seller is the lawful owner of the Horse, has full right and authority to sell and convey the Horse, and that the Horse is free and clear of all liens, security interests, and encumbrances except as disclosed in writing to Buyer, and Seller will defend title to the Horse against the lawful claims of all persons.

### CONDITION_XREF *(no heading set)*

`BOS_WARRANTY.CONDITION_XREF`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = YES

> The Horse is conveyed subject to, and with the benefit of, the representations, disclosures, disclaimers of warranty, releases, and other terms of the parties' Horse Sale and Purchase Agreement of even or prior date, which remains in full force. In the event of a conflict between this Bill of Sale and that Agreement, that Agreement controls.

### CONDITION_STANDALONE *(no heading set)*

`BOS_WARRANTY.CONDITION_STANDALONE`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> Except for the warranty of title above, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit claims arising from fraud. Buyer acknowledges the opportunity to have the Horse examined by a veterinarian of Buyer's choosing before purchase.

### PENDING *(no heading set)*

`BOS_WARRANTY.PENDING`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = (empty)

> [Pending — state whether a Horse Sale and Purchase Agreement accompanies this Bill of Sale. This placeholder is replaced by the applicable condition language and blocks signing.]

- **Accompanying sale agreement** — `TXN.BOS_HAS_SALE_AGREEMENT` · input: select · required · owner: DEAL
    - choices: Yes, No

## 6. Agent and Dual-Agency Disclosure

`BOS_AGENT`

### DISCLOSURE *(no heading set)*

`BOS_AGENT.DISCLOSURE`

**CONDITIONAL** — shows when: TXN.AGENT_ELECTION = INCLUDED

> The following person or entity acted as agent or intermediary in this transaction and receives compensation in connection with it: {{TXN.AGENT_NAME}}, acting on behalf of {{TXN.AGENT_ACTING_FOR}}, receiving compensation of {{TXN.AGENT_COMPENSATION}} paid by {{TXN.AGENT_PAID_BY}}. Where the agent acted on behalf of both Seller and Buyer, each party acknowledges that it received prior written disclosure of, and consented in writing to, the dual agency. The parties acknowledge that under California Business and Professions Code Section 19525, where it applies, an agent receiving compensation in excess of five hundred dollars in connection with the sale of a racing or showing equine must be authorized by a written agreement signed by the party the agent represents, and this Bill of Sale is delivered in satisfaction of the written bill of sale required by that statute.

- **Agent name** — `TXN.AGENT_NAME` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.AGENT_ELECTION = INCLUDED
- **Acting on behalf of** — `TXN.AGENT_ACTING_FOR` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.AGENT_ELECTION = INCLUDED
    - choices: Seller, Buyer, Both parties
- **Compensation (amount or formula)** — `TXN.AGENT_COMPENSATION` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.AGENT_ELECTION = INCLUDED
- **Compensation paid by** — `TXN.AGENT_PAID_BY` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.AGENT_ELECTION = INCLUDED
    - choices: Seller, Buyer, Both parties

### NONE *(no heading set)*

`BOS_AGENT.NONE`

**CONDITIONAL** — shows when: TXN.AGENT_ELECTION = NOT_INCLUDED

> No agent or intermediary receives compensation in connection with this transaction.

### PENDING *(no heading set)*

`BOS_AGENT.PENDING`

**CONDITIONAL** — shows when: TXN.AGENT_ELECTION = (empty)

> [Pending — state whether a compensated agent or intermediary participated in this transaction. This placeholder is replaced by the applicable statement and blocks signing.]

- **Compensated agent or intermediary** — `TXN.AGENT_ELECTION` · input: select · required · owner: DEAL
    - choices: Included, Not included

## 7. Governing Law

`BOS_GOVERNING`

### CHOICE *(no heading set)*

`BOS_GOVERNING.CHOICE`

> This Bill of Sale is governed by the laws of the State of California. Any dispute arising out of or relating to this Bill of Sale shall be resolved in the same manner as disputes under the parties' Horse Sale and Purchase Agreement where one exists, and otherwise by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, with the same small-claims and provisional-relief rights stated in that Agreement.

## 8. Signatures

`BOS_SIGNATURES`

### BLOCK *(no heading set)*

`BOS_SIGNATURES.BLOCK`

> IN WITNESS WHEREOF, Seller and Buyer execute this Bill of Sale as of the date first written above.
>
> SELLER
> Signature: {{SIG.SELLER.NAME}}
> Printed Name: {{SELLER.PRINTED_NAME}}
> Date: {{SIG.SELLER.DATE}}

### SELLER_CAPACITY *(no heading set)*

`BOS_SIGNATURES.SELLER_CAPACITY`

**CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY

> By: {{SELLER.ENTITY_SIGNER_NAME}}
> Title: {{SELLER.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{SELLER.FULL_NAME}}

- **Signing individual — name** — `SELLER.ENTITY_SIGNER_NAME` · input: text · required · owner: SELLER
    - **CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY
- **Signing individual — title** — `SELLER.ENTITY_SIGNER_TITLE` · input: text · required · owner: SELLER
    - **CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY

### BUYER_BLOCK *(no heading set)*

`BOS_SIGNATURES.BUYER_BLOCK`

> BUYER
> Signature: {{SIG.BUYER.NAME}}
> Printed Name: {{BUYER.PRINTED_NAME}}
> Date: {{SIG.BUYER.DATE}}

### BUYER_CAPACITY *(no heading set)*

`BOS_SIGNATURES.BUYER_CAPACITY`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY

> By: {{BUYER.ENTITY_SIGNER_NAME}}
> Title: {{BUYER.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{BUYER.FULL_NAME}}

- **Signing individual — name** — `BUYER.ENTITY_SIGNER_NAME` · input: text · required · owner: BUYER
    - **CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY
- **Signing individual — title** — `BUYER.ENTITY_SIGNER_TITLE` · input: text · required · owner: BUYER
    - **CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY

### COBUYER_BLOCK *(no heading set)*

`BOS_SIGNATURES.COBUYER_BLOCK`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES

> CO-BUYER
> Signature: {{SIG.COBUYER.NAME}}
> Printed Name: {{COBUYER.PRINTED_NAME}}
> Date: {{SIG.COBUYER.DATE}}

### COBUYER_CAPACITY *(no heading set)*

`BOS_SIGNATURES.COBUYER_CAPACITY`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES AND COBUYER.PARTY_TYPE = ENTITY

> By: {{COBUYER.ENTITY_SIGNER_NAME}}
> Title: {{COBUYER.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{COBUYER.FULL_NAME}}

- **Signing individual — name** — `COBUYER.ENTITY_SIGNER_NAME` · input: text · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES AND COBUYER.PARTY_TYPE = ENTITY
- **Signing individual — title** — `COBUYER.ENTITY_SIGNER_TITLE` · input: text · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES AND COBUYER.PARTY_TYPE = ENTITY

### Notary Acknowledgment

`BOS_SIGNATURES.NOTARY`

**CONDITIONAL** — shows when: TXN.NOTARY_ELECTION = INCLUDED

> State of California, County of _______________. On _______________ before me, _______________, Notary Public, personally appeared _______________, who proved to me on the basis of satisfactory evidence to be the person(s) whose name(s) is/are subscribed to the within instrument and acknowledged to me that he/she/they executed the same in his/her/their authorized capacity(ies), and that by his/her/their signature(s) on the instrument the person(s), or the entity upon behalf of which the person(s) acted, executed the instrument. I certify under PENALTY OF PERJURY under the laws of the State of California that the foregoing paragraph is true and correct. WITNESS my hand and official seal.
> Signature: _______________ (Seal)

- **Notary acknowledgment** — `TXN.NOTARY_ELECTION` · input: select · required · owner: DEAL
    - choices: Included, Not included

