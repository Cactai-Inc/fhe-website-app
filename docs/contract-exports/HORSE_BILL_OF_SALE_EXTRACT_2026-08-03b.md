# HORSE_BILL_OF_SALE — full template extract

Generated 2026-08-03 20:52:57 UTC from the live database (project `lrstswfxfsezdmvkvukc`),
reflecting migration head `20260803110001_requests_converted_on_redemption.sql`.

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

## 5. Seller's Disclosures

`BOS_DISCLOSURES`

### Health and Condition Disclosures

`BOS_DISCLOSURES.HEALTH`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions, injuries, lameness history, surgeries, allergies, current and past medications, behavioral issues, vices, and prior veterinary concerns, as follows: {{TXN.KNOWN_CONDITIONS}}. Seller represents that these disclosures are true and complete to Seller's knowledge as of the date of this Bill of Sale.

- **Known conditions and history** — `TXN.KNOWN_CONDITIONS` · input: longtext · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

### Behavior

`BOS_DISCLOSURES.BEHAVIOR`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> Seller represents that, to Seller's knowledge, the Horse has no history of dangerous or vicious behavior as of the date of this Bill of Sale, except as disclosed in this Bill of Sale.

### No Serious Injury History

`BOS_DISCLOSURES.INJURY_NONE`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.INJURY_HISTORY = NO

> Seller represents that, to Seller's knowledge, no person or animal has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.

### Serious Injury History Disclosed

`BOS_DISCLOSURES.INJURY_DISCLOSED`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.INJURY_HISTORY = YES

> Seller discloses that one or more persons or animals have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Buyer acknowledges this disclosure and proceeds with knowledge of it.

- **Injury history details** — `TXN.INJURY_HISTORY_DETAILS` · input: longtext · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.INJURY_HISTORY = YES

### INJURY_PENDING *(no heading set)*

`BOS_DISCLOSURES.INJURY_PENDING`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.INJURY_HISTORY = (empty)

> [Pending — state whether anyone or any animal has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]

- **Has anyone or any animal been seriously injured by the Horse's direct actions?** — `TXN.INJURY_HISTORY` · input: select · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
    - choices: Yes, No

### Disclosed Encumbrances and Interests

`BOS_DISCLOSURES.ENCUMBRANCES`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.HAS_ENCUMBRANCES = YES

> Seller discloses the following liens, leases, co-ownership interests, or other encumbrances affecting the Horse, each of which is released or satisfied at or before delivery unless expressly stated otherwise: {{TXN.DISCLOSED_ENCUMBRANCES}}

- **Encumbrance details** — `TXN.DISCLOSED_ENCUMBRANCES` · input: longtext · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.HAS_ENCUMBRANCES = YES

### ENCUMBRANCES_PENDING *(no heading set)*

`BOS_DISCLOSURES.ENCUMBRANCES_PENDING`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.HAS_ENCUMBRANCES = (empty)

> [Pending — state whether any liens, leases, or other encumbrances affect the Horse. This placeholder is replaced by the applicable statement and blocks signing.]

- **Any liens, leases, or other encumbrances?** — `TXN.HAS_ENCUMBRANCES` · input: select · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
    - choices: Yes, No

## 6. Warranty of Title; Condition

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

> Except for the warranty of title above and the representations expressly stated in this Bill of Sale, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit claims arising from fraud or from breach of the express representations stated in this Bill of Sale. Buyer acknowledges the opportunity to have the Horse examined by a veterinarian of Buyer's choosing before purchase.

### PENDING *(no heading set)*

`BOS_WARRANTY.PENDING`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = (empty)

> [Pending — state whether a Horse Sale and Purchase Agreement accompanies this Bill of Sale. This placeholder is replaced by the applicable condition language and blocks signing.]

- **Accompanying sale agreement** — `TXN.BOS_HAS_SALE_AGREEMENT` · input: select · required · owner: DEAL
    - choices: Yes, No

## 7. Delivery and Risk of Loss

`BOS_DELIVERY`

### Delivery

`BOS_DELIVERY.TERMS`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> The Horse is delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}. Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}. If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller's delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day.

- **Delivery location** — `TXN.DELIVERY_LOCATION` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
- **Delivery date** — `TXN.DELIVERY_DATE` · input: date · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
- **Transport arranged by** — `TXN.TRANSPORT_RESPONSIBLE` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
    - choices: Buyer, Seller
- **Transport paid by** — `TXN.TRANSPORT_COST_RESPONSIBLE` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
    - choices: Buyer, Seller
- **Board rate after missed delivery (per day)** — `TXN.BOARD_RATE_AFTER` · input: currency · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

### Transfer of Title and Risk

`BOS_DELIVERY.RISK`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> Title to the Horse passes to Buyer as provided in the Conveyance section above, and risk of loss of or injury to the Horse passes to Buyer upon delivery. This executed Bill of Sale constitutes the instrument of transfer for the Horse, and Seller shall execute any additional transfer document reasonably required by a breed registry, microchip registry, or passport authority.

### Registration and Transfer Documents

`BOS_DELIVERY.PAPERS`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> At delivery (or, where installment payment applies, upon payment in full), Seller shall deliver to Buyer the Horse's registration papers, passport, and any transfer forms required to record the change of ownership, executed by Seller where signature is required. Each party shall cooperate to complete breed registry, microchip registry, and passport transfers promptly, with recording fees paid by {{TXN.TRANSFER_FEES_RESPONSIBLE}}.

- **Registry transfer fees** — `TXN.TRANSFER_FEES_RESPONSIBLE` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
    - choices: Buyer, Seller

## 8. Release of Claims

`BOS_RELEASE`

### Release by Buyer

`BOS_RELEASE.BUYER`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.BOS_RELEASE_ELECTION = INCLUDED

> Buyer, on behalf of Buyer and anyone claiming by, through, or under Buyer, completely releases, forever discharges, and agrees to hold harmless Seller and Seller's family members, employees, agents, contractors, successors, and assigns, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Buyer's examination, trial, handling, riding, or transport of the Horse before delivery, whether caused by the ordinary negligence of any released party or otherwise, and from any and all claims arising after delivery relating to the Horse's condition, soundness, behavior, suitability, or value. This release does not apply to gross negligence, reckless conduct, intentional misconduct, fraud, or breach of the express representations stated in this Bill of Sale.

- **Release of claims and waiver of unknown claims** — `TXN.BOS_RELEASE_ELECTION` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO
    - choices: Included, Not included

### Post-Delivery Responsibility

`BOS_RELEASE.POST_DELIVERY`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.BOS_RELEASE_ELECTION = INCLUDED

> From and after delivery, the Horse and its actions, behavior, care, and condition are the sole responsibility of Buyer, and Buyer shall indemnify, defend, and hold harmless Seller and Seller's family members, employees, agents, contractors, successors, and assigns from and against any claim, damage, loss, liability, cost, or expense arising out of the Horse or its use, handling, care, or possession after delivery, except to the extent caused by the gross negligence, reckless conduct, intentional misconduct, or fraud of a released party or by breach of the express representations stated in this Bill of Sale.

### Waiver of Unknown Claims

`BOS_RELEASE.WAIVER_UNKNOWN`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.BOS_RELEASE_ELECTION = INCLUDED

> Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Bill of Sale that the waiving party does not know or suspect to exist in its favor at the time of this Bill of Sale. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Bill of Sale. This waiver does not apply to claims arising from fraud or from breach of the express representations stated in this Bill of Sale.

## 9. Agent and Dual-Agency Disclosure

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

## 10. Governing Law

`BOS_GOVERNING`

### CHOICE *(no heading set)*

`BOS_GOVERNING.CHOICE`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = YES

> This Bill of Sale is governed by the laws of the State of California. Any dispute arising out of or relating to this Bill of Sale shall be resolved in the same manner as disputes under the parties' Horse Sale and Purchase Agreement, with the same small-claims and provisional-relief rights stated in that Agreement.

### STANDALONE *(no heading set)*

`BOS_GOVERNING.STANDALONE`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = NO

> This Bill of Sale is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Bill of Sale or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.

### PENDING *(no heading set)*

`BOS_GOVERNING.PENDING`

**CONDITIONAL** — shows when: TXN.BOS_HAS_SALE_AGREEMENT = (empty)

> [Pending — state whether a Horse Sale and Purchase Agreement accompanies this Bill of Sale. This placeholder is replaced by the applicable governing-law terms and blocks signing.]

## 11. Signatures

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

