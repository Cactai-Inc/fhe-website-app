# HORSE_SALE_V2 — full template extract

Generated 2026-08-02 17:14:39 UTC from the live database (project `lrstswfxfsezdmvkvukc`),
reflecting migration head `20260802090006_record_signature_cobuyer_namespace.sql`.

Every section, clause, field, option list, helper text and conditional in the
live lease template, in render order.

Legend:
  **CONDITIONAL** — appears only when the stated expression is true.
  *(info)* — the text behind that item's info button.
  `{{TOKEN}}` — an input rendered inline in the clause prose.
  Fields list their input kind, and their choices where they have a fixed set.

---

## 1. Parties

`PARTIES`

### INTRO *(no heading set)*

`PARTIES.INTRO`

> This Horse Sale and Purchase Agreement (the "Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} by and between {{SELLER.FULL_NAME}} of {{SELLER.ADDRESS}} ("Seller") and {{BUYER.FULL_NAME}} of {{BUYER.ADDRESS}} ("Buyer").

- **Seller is an** — `SELLER.PARTY_TYPE` · input: select · required · owner: SELLER
    - choices: Individual, Entity / organization
- **Buyer is an** — `BUYER.PARTY_TYPE` · input: select · required · owner: BUYER
    - choices: Individual, Entity / organization

### Co-Buyer

`PARTIES.CO_BUYER`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES

> {{COBUYER.FULL_NAME}} of {{COBUYER.ADDRESS}} ("Co-Buyer") purchases the Horse jointly with Buyer. Co-Buyer is a Buyer for all purposes of this Agreement, every reference to Buyer includes Co-Buyer, and the representations, covenants, releases, waivers, and payment obligations of Buyer under this Agreement are made by Buyer and Co-Buyer jointly and severally. Buyer and Co-Buyer shall hold title to the Horse as follows: {{TXN.CO_BUYER_TITLE_FORM}}. This Agreement is effective as to Co-Buyer upon Co-Buyer's execution of it.

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

### CO_BUYER_PENDING *(no heading set)*

`PARTIES.CO_BUYER_PENDING`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = (empty)

> [Pending — state whether there is a co-buyer. This placeholder is replaced by the applicable terms and blocks signing.]

- **Is there a co-buyer?** — `TXN.CO_BUYER_ENABLED` · input: select · required · owner: DEAL
    - choices: Yes, No

### CO_BUYER_TITLE_DETAIL *(no heading set)*

`PARTIES.CO_BUYER_TITLE_DETAIL`

**CONDITIONAL** — shows when: (TXN.CO_BUYER_TITLE_FORM = TIC_STATED OR TXN.CO_BUYER_TITLE_FORM = OTHER)

> Title detail: {{TXN.CO_BUYER_TITLE_DETAIL}}

- **Title detail** — `TXN.CO_BUYER_TITLE_DETAIL` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: (TXN.CO_BUYER_TITLE_FORM = TIC_STATED OR TXN.CO_BUYER_TITLE_FORM = OTHER)

## 2. Definitions; Binding Effect; Third-Party Beneficiaries

`DEFINITIONS`

### SELLER_IND *(no heading set)*

`DEFINITIONS.SELLER_IND`

**CONDITIONAL** — shows when: SELLER.PARTY_TYPE = INDIVIDUAL

> "Seller Parties" means Seller; Seller's spouse and family and household members, in each case when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Seller's estate, executors, administrators, legal representatives, successors, and assigns.

### SELLER_ENT *(no heading set)*

`DEFINITIONS.SELLER_ENT`

**CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY

> "Seller Parties" means Seller; Seller's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Seller and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

### SELLER_PENDING *(no heading set)*

`DEFINITIONS.SELLER_PENDING`

**CONDITIONAL** — shows when: SELLER.PARTY_TYPE = (empty)

> [Pending — select whether Seller is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]

### BUYER_IND *(no heading set)*

`DEFINITIONS.BUYER_IND`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = INDIVIDUAL

> "Buyer Parties" means Buyer; Buyer's spouse and family and household members, in each case when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Buyer's estate, executors, administrators, legal representatives, successors, and assigns.

### BUYER_ENT *(no heading set)*

`DEFINITIONS.BUYER_ENT`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY

> "Buyer Parties" means Buyer; Buyer's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Buyer and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

### BUYER_PENDING *(no heading set)*

`DEFINITIONS.BUYER_PENDING`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = (empty)

> [Pending — select whether Buyer is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]

### CLOSING *(no heading set)*

`DEFINITIONS.CLOSING`

> "Closing" means the moment at which both of the following have occurred: Seller's receipt of the Purchase Price in full (or, where installment payment applies, receipt of all amounts due at transfer under the installment terms), and delivery of the Horse to Buyer as provided in this Agreement.

### BINDING *(no heading set)*

`DEFINITIONS.BINDING`

> Each release, waiver, assumption of risk, and covenant made by a party under this Agreement is made by that party on its own behalf and, to the fullest extent permitted by law, binds anyone claiming by, through, or under that party, including that party's estate, executors, administrators, heirs, legal representatives, successors, assigns, insurers, and subrogees. Each party covenants that it will not permit any person who has not executed this Agreement or a release approved by the other party to ride, handle, or care for the Horse prior to Closing, and each party shall indemnify, defend, and hold harmless the other party's Seller Parties or Buyer Parties, as applicable, from and against any claim brought by that party's family members, invitees, or authorized riders arising out of the Horse or the activities contemplated by this Agreement, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

### BENEFICIARIES *(no heading set)*

`DEFINITIONS.BENEFICIARIES`

> Each Seller Party and each Buyer Party who is not a signatory to this Agreement is an intended third-party beneficiary of the releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement and may enforce them directly.

## 3. The Horse

`HORSE`

### Horse

`HORSE.IDENTITY`

> This Agreement applies to the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
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
> Current Location: {{HORSE.CURRENT_LOCATION}}

- **Barn name** — `HORSE.BARN_NAME` · input: text · owner: SELLER
- **Height** — `HORSE.HEIGHT` · input: text · owner: SELLER
- **Registered name** — `HORSE.REGISTERED_NAME` · input: text · required · owner: SELLER
- **Color** — `HORSE.COLOR` · input: select · owner: SELLER
    - choices: Bay, Chestnut, Gray, Black, Brown, Roan, Palomino, Pinto / Paint, Buckskin, Dun, White / Cremello
- **Facility** — `HORSE.CURRENT_LOCATION` · input: location · owner: SELLER
- **Markings** — `HORSE.MARKINGS` · input: text · owner: SELLER
- **Breed** — `HORSE.BREED` · input: select · owner: SELLER
    - choices: Warmblood, Thoroughbred, Quarter Horse, Arabian, Pony, Draft, Appaloosa, Morgan, Friesian, Andalusian, Mustang, Crossbred / Grade
- **Registration number** — `HORSE.REGISTRATION_NUMBER` · input: text · owner: SELLER
- **Sex** — `HORSE.SEX` · input: select · owner: SELLER
    - choices: Mare, Gelding, Stallion, Colt, Filly
- **Foaling date** — `HORSE.AGE_DOB` · input: text · owner: SELLER
- **Microchip #** — `HORSE.MICROCHIP` · input: text · owner: SELLER
- **Passport #** — `HORSE.PASSPORT_NUMBER` · input: text · owner: SELLER

### Title and Ownership

`HORSE.OWNERSHIP`

> Seller warrants that Seller lawfully owns the Horse, holds good and marketable title to the Horse, free and clear of all liens, security interests, leases, breeding contracts, co-ownership interests, and encumbrances except as expressly disclosed in this Agreement, and has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and sell the Horse.

### Disclosed Encumbrances and Interests

`HORSE.ENCUMBRANCES`

**CONDITIONAL** — shows when: TXN.HAS_ENCUMBRANCES = YES

> Seller discloses the following liens, leases, co-ownership interests, or other encumbrances affecting the Horse, each of which will be released or satisfied at or before Closing unless expressly stated otherwise: {{TXN.DISCLOSED_ENCUMBRANCES}}

- **Any liens, leases, or other encumbrances?** — `TXN.HAS_ENCUMBRANCES` · input: select · required · owner: SELLER
    - choices: Yes, No
- **Encumbrance details** — `TXN.DISCLOSED_ENCUMBRANCES` · input: longtext · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.HAS_ENCUMBRANCES = YES

### Behavior

`HORSE.BEHAVIOR`

> Seller warrants that, to Seller's knowledge, the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement, except as disclosed in this Agreement.

### Health and Condition Disclosures

`HORSE.DISCLOSURES`

> Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions, injuries, lameness history, surgeries, allergies, current and past medications, behavioral issues, vices, and prior veterinary concerns, as follows: {{TXN.KNOWN_CONDITIONS}}. Seller warrants that these disclosures are true and complete to Seller's knowledge as of the Effective Date, and shall promptly disclose any material change arising before Closing.

- **Known conditions and history** — `TXN.KNOWN_CONDITIONS` · input: longtext · required · owner: SELLER

### No Serious Injury History

`HORSE.INJURY_HISTORY_NONE`

**CONDITIONAL** — shows when: TXN.INJURY_HISTORY = NO

> Seller represents that, to Seller's knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.

### Serious Injury History Disclosed

`HORSE.INJURY_HISTORY_DISCLOSED`

**CONDITIONAL** — shows when: TXN.INJURY_HISTORY = YES

> Seller discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Buyer acknowledges this disclosure and proceeds with knowledge of it.

- **Injury history details** — `TXN.INJURY_HISTORY_DETAILS` · input: longtext · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.INJURY_HISTORY = YES

### INJURY_HISTORY_PENDING *(no heading set)*

`HORSE.INJURY_HISTORY_PENDING`

**CONDITIONAL** — shows when: TXN.INJURY_HISTORY = (empty)

> [Pending — state whether anyone has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]

- **Has anyone been seriously injured by the Horse's direct actions?** — `TXN.INJURY_HISTORY` · input: select · required · owner: SELLER
    - choices: Yes, No

### Breeding Warranty

`HORSE.BREEDING`

**CONDITIONAL** — shows when: TXN.BREEDING_ELECTION = INCLUDED

> Seller expressly warrants that, to Seller's knowledge, the Horse is capable of breeding and free of any reproductive condition that would prevent it, as supported by the reproductive examination or records described here: {{TXN.BREEDING_BASIS}}. If a licensed veterinarian determines within {{TXN.BREEDING_CLAIM_WINDOW}} days after Closing that the Horse was incapable of breeding as of Closing due to a condition existing at Closing, Buyer's exclusive remedy is, at Buyer's election, return of the Horse in substantially the condition delivered for a refund of the Purchase Price, or a reduction of the Purchase Price agreed by the parties. This is the sole warranty regarding breeding and does not otherwise limit the Disclaimer of Warranties.

- **Breeding warranty** — `TXN.BREEDING_ELECTION` · input: select · required · owner: DEAL
    - choices: Included, Not included
- **Reproductive exam or records** — `TXN.BREEDING_BASIS` · input: longtext · required · owner: SELLER
    - **CONDITIONAL** — shows when: TXN.BREEDING_ELECTION = INCLUDED
- **Claim window (days)** — `TXN.BREEDING_CLAIM_WINDOW` · input: number · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.BREEDING_ELECTION = INCLUDED

### Breeding Warranty Not Elected

`HORSE.BREEDING_DECLINED`

**CONDITIONAL** — shows when: TXN.BREEDING_ELECTION = NOT_INCLUDED

> No warranty of breeding soundness, fertility, or reproductive capacity is given or implied. The parties considered including a breeding warranty and both elected not to include one.

### Disclaimer of Warranties

`HORSE.WARRANTY`

> Except for the representations and warranties expressly stated in this Agreement, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit Buyer's rights arising from the express representations in this Agreement or from fraud.

## 4. Purpose and Sale

`PURPOSE_SALE`

### Purpose of Agreement

`PURPOSE_SALE.MAIN`

> Seller owns the horse described in this Agreement and desires to sell it, and Buyer desires to purchase it, on the terms and conditions of this Agreement.

### Agreement to Sell and Purchase

`PURPOSE_SALE.SALE`

> Subject to the terms and conditions of this Agreement, Seller agrees to sell, transfer, and convey the Horse to Buyer, and Buyer agrees to purchase the Horse from Seller, for the Purchase Price and on the terms stated in this Agreement.

## 5. Purchase Price and Payment

`PRICE`

### Purchase Price

`PRICE.AMOUNT`

> The purchase price for the Horse is {{TXN.PURCHASE_PRICE}} (the "Purchase Price").

- **Purchase price** — `TXN.PURCHASE_PRICE` · input: currency · required · owner: DEAL

### Deposit

`PRICE.DEPOSIT`

**CONDITIONAL** — shows when: TXN.DEPOSIT_ENABLED = YES

> Buyer shall pay a deposit of {{TXN.DEPOSIT_AMOUNT}} (the "Deposit") upon execution of this Agreement. The Deposit is applied against the Purchase Price at Closing. If this Agreement terminates because a condition precedent stated in this Agreement fails (including an unsatisfactory pre-purchase examination where the sale is contingent on one, a financing contingency that fails where one is included, or a trial period return in accordance with this Agreement), the Deposit is refunded to Buyer in full within 5 business days. If Buyer fails to complete the purchase for any other reason, the parties agree that Seller's actual damages would be impracticable or extremely difficult to determine, that the Deposit is a reasonable estimate of those damages, and that Seller may retain the Deposit as liquidated damages as Seller's sole monetary remedy for that failure.

- **Deposit** — `TXN.DEPOSIT_ENABLED` · input: select · required · owner: DEAL
    - choices: Yes, No
- **Deposit amount** — `TXN.DEPOSIT_AMOUNT` · input: currency · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.DEPOSIT_ENABLED = YES

### Payment Method

`PRICE.PAYMENT_METHOD`

> The Purchase Price shall be paid by the following method(s): {{TXN.PAYMENT_METHODS}}. Payment is not received until funds are actually and irrevocably credited to Seller.

- **Accepted payment methods** — `TXN.PAYMENT_METHODS` · input: buttons · required · owner: DEAL
    - choices: Cash, Zelle, Credit Card

### Payment in Full at Transfer

`PRICE.FULL_PAYMENT`

**CONDITIONAL** — shows when: TXN.INSTALLMENTS_ENABLED = NO

> The Purchase Price, less any Deposit already paid, is due in full at or before delivery of the Horse. Seller is not obligated to deliver the Horse or any registration or transfer documents until the Purchase Price is received in full.

### Installment Terms

`PRICE.INSTALLMENTS`

**CONDITIONAL** — shows when: TXN.INSTALLMENTS_ENABLED = YES

> The Purchase Price is payable in installments as follows: {{TXN.INSTALLMENT_SCHEDULE}}. Until the Purchase Price is paid in full: title to the Horse remains with Seller and Buyer holds possession under this Agreement only; Buyer grants Seller a purchase-money security interest in the Horse and its registration papers to secure the unpaid balance, and authorizes Seller to file a financing statement; Buyer shall not sell, lease, encumber, breed, or relocate the Horse from {{TXN.INSTALLMENT_LOCATION}} without Seller's prior written consent; Buyer shall maintain mortality insurance on the Horse in an amount not less than the unpaid balance, naming Seller as loss payee, and shall provide proof on request; and Buyer bears all costs of the Horse's care. If Buyer fails to make a payment when due and does not cure within 10 days of written notice, Seller may retake possession of the Horse, and amounts already paid are subject to the default and remedies provisions of this Agreement. Registration and transfer documents are delivered upon payment in full.

- **Installment schedule** — `TXN.INSTALLMENT_SCHEDULE` · input: longtext · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.INSTALLMENTS_ENABLED = YES
- **Horse location during installments** — `TXN.INSTALLMENT_LOCATION` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.INSTALLMENTS_ENABLED = YES

### INSTALLMENTS_PENDING *(no heading set)*

`PRICE.INSTALLMENTS_PENDING`

**CONDITIONAL** — shows when: TXN.INSTALLMENTS_ENABLED = (empty)

> [Pending — select whether the Purchase Price is paid in full at transfer or in installments. This placeholder is replaced by the applicable payment terms and blocks signing.]

- **Installment payment** — `TXN.INSTALLMENTS_ENABLED` · input: select · required · owner: DEAL
    - choices: Yes, No

### Financing Contingency

`PRICE.FINANCING`

**CONDITIONAL** — shows when: TXN.FINANCING_ELECTION = INCLUDED

> This sale is contingent on Buyer obtaining financing for not less than {{TXN.FINANCING_AMOUNT}} on terms reasonably acceptable to Buyer on or before {{TXN.FINANCING_DEADLINE}}. Buyer shall pursue financing diligently and in good faith. If Buyer gives Seller written notice on or before that date that financing could not be obtained, this Agreement terminates, the Deposit (if any) is refunded in full, and neither party has further obligation to the other except obligations that expressly survive. If no such notice is given by that date, this contingency is deemed waived.

- **Financing contingency** — `TXN.FINANCING_ELECTION` · input: select · required · owner: DEAL
    - choices: Included, Not included
- **Financing amount** — `TXN.FINANCING_AMOUNT` · input: currency · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.FINANCING_ELECTION = INCLUDED
- **Financing deadline** — `TXN.FINANCING_DEADLINE` · input: date · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.FINANCING_ELECTION = INCLUDED

### Financing Contingency Not Elected

`PRICE.FINANCING_DECLINED`

**CONDITIONAL** — shows when: TXN.FINANCING_ELECTION = NOT_INCLUDED

> This sale is not contingent on Buyer obtaining financing. The parties considered including a financing contingency and both elected not to include one.

### Taxes

`PRICE.TAXES`

> Any sales, use, or similar transfer tax arising from this sale is the responsibility of {{TXN.SALES_TAX_RESPONSIBLE}}. Each party is otherwise responsible for its own tax obligations arising from this transaction.

- **Transfer tax responsibility** — `TXN.SALES_TAX_RESPONSIBLE` · input: select · required · owner: DEAL
    - choices: Buyer, Seller

## 6. Pre-Purchase Examination

`PPE`

### Pre-Purchase Examination

`PPE.CONDUCTED`

**CONDITIONAL** — shows when: TXN.PPE_CHOICE = CONDUCTED

> Buyer may, at Buyer's sole cost, have the Horse examined by a licensed veterinarian of Buyer's choosing on or before {{TXN.PPE_DEADLINE}}. Seller shall make the Horse reasonably available for the examination and shall disclose the Horse's known medical history to the examining veterinarian on request.

- **Examination deadline** — `TXN.PPE_DEADLINE` · input: date · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.PPE_CHOICE = CONDUCTED

### Sale Contingent on Examination

`PPE.CONTINGENCY`

**CONDITIONAL** — shows when: TXN.PPE_CHOICE = CONDUCTED AND TXN.PPE_CONTINGENT = YES

> This sale is contingent on a pre-purchase examination whose results are satisfactory to Buyer in Buyer's reasonable discretion. If Buyer gives Seller written notice on or before {{TXN.PPE_DEADLINE}} that the examination results are not satisfactory, this Agreement terminates, the Deposit (if any) is refunded in full, and neither party has further obligation to the other except obligations that expressly survive. If Buyer gives no such notice by that date, this contingency is deemed waived.

- **Sale contingent on exam results** — `TXN.PPE_CONTINGENT` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.PPE_CHOICE = CONDUCTED
    - choices: Yes, No

### Examination Waived

`PPE.WAIVED`

**CONDITIONAL** — shows when: TXN.PPE_CHOICE = WAIVED

> Buyer has been advised to obtain an independent pre-purchase veterinary examination of the Horse and knowingly and voluntarily waives it. Buyer accepts the Horse without such examination and assumes all risk associated with conditions an examination might have revealed. This waiver does not limit Buyer's rights arising from the express representations in this Agreement or from fraud.

### PENDING *(no heading set)*

`PPE.PENDING`

**CONDITIONAL** — shows when: TXN.PPE_CHOICE = (empty)

> [Pending — select whether a pre-purchase examination will be conducted or is waived. This placeholder is replaced by the applicable examination terms and blocks signing.]

- **Pre-purchase examination** — `TXN.PPE_CHOICE` · input: select · required · owner: BUYER
    - choices: Conducted, Waived

### Drug and Substance Testing

`PPE.DRUG_TESTING`

**CONDITIONAL** — shows when: TXN.DRUG_TEST_ELECTION = INCLUDED

> At the pre-purchase examination or at delivery, whichever Buyer elects, Buyer may, at Buyer's cost, have a licensed veterinarian draw blood or other samples from the Horse. Samples shall be split, sealed, and identified in the presence of both parties or their representatives, with one set retained by the veterinarian or a certified testing laboratory. Buyer may have the samples tested for prohibited, masking, or performance- or behavior-altering substances within {{TXN.DRUG_TEST_WINDOW}} days after collection. If a certified laboratory confirms the presence of such a substance not disclosed in this Agreement and not administered under a disclosed current veterinary prescription, Buyer may rescind this Agreement by written notice within 5 business days of receiving the confirmed result, return the Horse in substantially the condition delivered, and receive a refund of all amounts paid including the Deposit, and Seller shall reimburse Buyer's reasonable testing and return transport costs.

- **Drug and substance testing** — `TXN.DRUG_TEST_ELECTION` · input: select · required · owner: DEAL
    - choices: Included, Not included
- **Testing window (days)** — `TXN.DRUG_TEST_WINDOW` · input: number · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.DRUG_TEST_ELECTION = INCLUDED

### Drug and Substance Testing Not Elected

`PPE.DRUG_TESTING_DECLINED`

**CONDITIONAL** — shows when: TXN.DRUG_TEST_ELECTION = NOT_INCLUDED

> Buyer was offered the opportunity to have samples drawn from the Horse and tested for prohibited, masking, or performance- or behavior-altering substances, and the parties elected not to include drug testing. Buyer assumes the risk that the Horse's condition or behavior at examination, trial, or delivery may have been affected by a substance present at that time.

## 7. Trial Period

`TRIAL`

### Trial Period

`TRIAL.TERMS`

**CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = YES

> Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}. During the trial period: Buyer bears all costs of the Horse's board, care, and routine maintenance; Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse's training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller's written consent; Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement; and Buyer shall maintain, at {{TXN.TRIAL_INSURANCE_RESPONSIBLE}}'s cost, mortality insurance on the Horse in an amount not less than the Purchase Price for the duration of the trial. If the Horse dies or is significantly injured during the trial period due to Buyer's failure to provide reasonable care, Buyer is responsible for the Purchase Price; otherwise Seller bears the risk of loss of the Horse itself during the trial. Buyer may return the Horse in substantially the condition received, on written notice given on or before {{TXN.TRIAL_END}}, in which case this Agreement terminates and the Deposit (if any) is refunded in full; if no such notice is given by that date, Buyer is deemed to have accepted the Horse and Closing proceeds under this Agreement.

- **Trial start** — `TXN.TRIAL_START` · input: date · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = YES
- **Trial end** — `TXN.TRIAL_END` · input: date · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = YES
- **Trial location** — `TXN.TRIAL_LOCATION` · input: text · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = YES
- **Trial mortality insurance paid by** — `TXN.TRIAL_INSURANCE_RESPONSIBLE` · input: select · required · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = YES
    - choices: Buyer, Seller

### NONE *(no heading set)*

`TRIAL.NONE`

**CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = NO

> No trial period applies to this sale.

### PENDING *(no heading set)*

`TRIAL.PENDING`

**CONDITIONAL** — shows when: TXN.TRIAL_ENABLED = (empty)

> [Pending — select whether a trial period applies. This placeholder is replaced by the applicable trial terms and blocks signing.]

- **Trial period** — `TXN.TRIAL_ENABLED` · input: select · required · owner: DEAL
    - choices: Yes, No

## 8. Title, Delivery, and Risk of Loss

`DELIVERY`

### Delivery

`DELIVERY.TERMS`

> The Horse shall be delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}. Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}. If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller's delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day.

- **Delivery location** — `TXN.DELIVERY_LOCATION` · input: text · required · owner: DEAL
- **Delivery date** — `TXN.DELIVERY_DATE` · input: date · required · owner: DEAL
- **Transport arranged by** — `TXN.TRANSPORT_RESPONSIBLE` · input: select · required · owner: DEAL
    - choices: Buyer, Seller
- **Transport paid by** — `TXN.TRANSPORT_COST_RESPONSIBLE` · input: select · required · owner: DEAL
    - choices: Buyer, Seller
- **Board rate after missed delivery (per day)** — `TXN.BOARD_RATE_AFTER` · input: currency · required · owner: DEAL

### Transfer of Title and Risk

`DELIVERY.TITLE_RISK`

> Except as otherwise provided in the Installment Terms, title to the Horse passes to Buyer at Closing, and risk of loss of or injury to the Horse passes to Buyer upon delivery. Upon Closing, this executed Agreement, together with the executed Bill of Sale, constitutes the instruments of transfer for the Horse, and Seller shall execute any additional transfer document reasonably required by a breed registry, microchip registry, or passport authority.

### Registration and Transfer Documents

`DELIVERY.PAPERS`

> At Closing (or, where installment payment applies, upon payment in full), Seller shall deliver to Buyer the Horse's registration papers, passport, and any transfer forms required to record the change of ownership, executed by Seller where signature is required. Each party shall cooperate to complete breed registry, microchip registry, and passport transfers promptly, with recording fees paid by {{TXN.TRANSFER_FEES_RESPONSIBLE}}.

- **Registry transfer fees** — `TXN.TRANSFER_FEES_RESPONSIBLE` · input: select · required · owner: DEAL
    - choices: Buyer, Seller

### No-Slaughter Covenant

`DELIVERY.NO_SLAUGHTER`

**CONDITIONAL** — shows when: TXN.NO_SLAUGHTER_ELECTION = INCLUDED

> Buyer covenants that Buyer will not sell, transfer, consign, or deliver the Horse, directly or through intermediaries, for slaughter or for human consumption, whether within or outside California, and will not sell or transfer the Horse at auction without commercially reasonable steps to ensure the Horse is not being acquired for slaughter. The parties acknowledge that California Penal Code Section 598c makes it unlawful to possess, import, export, sell, or transfer a horse with the intent that it be killed for human consumption. This covenant survives Closing and binds Buyer's successors in interest to the extent permitted by law.

- **No-slaughter covenant** — `TXN.NO_SLAUGHTER_ELECTION` · input: select · required · owner: DEAL
    - choices: Included, Not included

## 9. Risk, Release, and Indemnification

`RISK`

### Assumption of Inherent Risks

`RISK.ASSUMPTION_INHERENT`

> Each party understands that horseback riding and handling horses are inherently dangerous activities, and that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. In connection with any examination, trial, handling, riding, transport, or delivery of the Horse under this Agreement, each party, on behalf of itself and anyone claiming by, through, or under it, expressly and voluntarily assumes all inherent risks of equine activities, and acknowledges that the other party's Seller Parties or Buyer Parties, as applicable, owe no duty to protect it from those inherent risks.

### Release by Buyer

`RISK.RELEASE_BUYER`

> Buyer, on behalf of Buyer and anyone claiming by, through, or under Buyer, completely releases, forever discharges, and agrees to hold harmless the Seller Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Buyer's examination, trial, handling, riding, or transport of the Horse before Closing, whether caused by the ordinary negligence of any Seller Party or otherwise, and from any and all claims arising after Closing relating to the Horse's condition, soundness, behavior, suitability, or value. This release does not apply to gross negligence, reckless conduct, intentional misconduct, fraud, or breach of the express representations and warranties stated in this Agreement.

### Release by Seller

`RISK.RELEASE_SELLER`

> Seller, on behalf of Seller and anyone claiming by, through, or under Seller, completely releases, forever discharges, and agrees to hold harmless the Buyer Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Seller's riding or handling of the Horse or Seller's presence at any facility where the Horse is kept in connection with this Agreement, whether caused by the ordinary negligence of any Buyer Party or otherwise. This release does not apply to gross negligence, reckless conduct, intentional misconduct, or fraud.

### Waiver of Unknown Claims

`RISK.WAIVER_UNKNOWN`

> Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Agreement that the waiving party does not know or suspect to exist in its favor at the time of this Agreement. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Agreement. This waiver does not apply to claims arising from fraud or from breach of the express representations and warranties stated in this Agreement.

### Post-Closing Responsibility

`RISK.POST_CLOSING`

> From and after Closing, the Horse and its actions, behavior, care, and condition are the sole responsibility of Buyer, and Buyer shall indemnify, defend, and hold harmless the Seller Parties from and against any claim, damage, loss, liability, cost, or expense arising out of the Horse or its use, handling, care, or possession after Closing, except to the extent caused by the gross negligence, reckless conduct, intentional misconduct, or fraud of a Seller Party or by breach of the express representations and warranties stated in this Agreement.

### Pre-Closing Responsibility

`RISK.PRE_CLOSING`

> Before Closing, and except as allocated to Buyer during any trial period, Seller shall indemnify, defend, and hold harmless the Buyer Parties from and against any third-party claim arising out of the Horse's ownership, care, or condition, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of a Buyer Party.

## 10. Default and Remedies

`DEFAULT`

### Default and Cure

`DEFAULT.CURE`

> A party in material breach of this Agreement has 10 days after written notice of the breach to cure it, except that no cure period applies to Buyer's failure to complete the purchase after all conditions precedent are satisfied or waived, which is governed by the Deposit clause where a Deposit applies.

### Seller Default

`DEFAULT.SELLER`

> If Seller fails to complete the sale after all conditions precedent are satisfied or waived, Buyer is entitled to a full refund of the Deposit and all other amounts paid, and, because the Horse is unique, Buyer may alternatively seek specific performance of this Agreement.

### Buyer Default Under Installments

`DEFAULT.INSTALLMENTS`

**CONDITIONAL** — shows when: TXN.INSTALLMENTS_ENABLED = YES

> If Seller retakes possession of the Horse following Buyer's uncured installment default, Seller shall, within 60 days, elect either to retain the Horse and refund amounts paid in excess of the greater of the Deposit and 20 percent of the Purchase Price, or to resell the Horse in a commercially reasonable manner and account to Buyer for any amount received in excess of the unpaid balance plus Seller's reasonable costs of retaking, keeping, and reselling the Horse.

## 11. Notice and Contact Information

`NOTICE`

### Form of Notice

`NOTICE.FORM`

> Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.

### Seller

`NOTICE.SELLER_ADDRESS`

> Name: {{SELLER.FULL_NAME}}
> Address: {{SELLER.ADDRESS}}
> Phone: {{SELLER.PHONE}}
> Email: {{SELLER.EMAIL}}

### Buyer

`NOTICE.BUYER_ADDRESS`

> Name: {{BUYER.FULL_NAME}}
> Address: {{BUYER.ADDRESS}}
> Phone: {{BUYER.PHONE}}
> Email: {{BUYER.EMAIL}}

### Changes in Contact Information

`NOTICE.CHANGES`

> Each party shall promptly notify the other party in writing of any change in the party's address or contact information.

## 12. Assignment

`ASSIGNMENT`

### Assignment

`ASSIGNMENT.NO_ASSIGN`

> Neither party shall assign this Agreement or any of its rights or obligations under it without the other party's prior written consent.

## 13. Entire Agreement

`ENTIRE_AGREEMENT`

### Entire Agreement

`ENTIRE_AGREEMENT.INTEGRATION`

> This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions, advertisements, and understandings, and Buyer acknowledges that Buyer is not relying on any statement or representation regarding the Horse that is not stated in this Agreement. Any modification of this Agreement must be in writing and signed by all parties.

## 14. Governing Law and Dispute Resolution

`GOVERNING_LAW`

### Governing Law and Dispute Resolution

`GOVERNING_LAW.CHOICE`

> This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Agreement or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.

## 15. Attorneys' Fees

`ATTORNEYS_FEES`

### Attorneys' Fees

`ATTORNEYS_FEES.PREVAILING`

> Each party shall cover their own attorney's fees and costs.

## 16. Severability

`SEVERABILITY`

### Severability

`SEVERABILITY.SAVING`

> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.

## 17. Representations

`REPS`

### Seller's Representations

`REPS.SELLER`

> Seller represents and warrants that Seller has full authority to enter into this Agreement, that the warranties of title and the disclosures stated in this Agreement are true and complete to Seller's knowledge, and that Seller will promptly disclose any material change in the Horse's health, soundness, or behavior arising before Closing.

### Buyer's Representations

`REPS.BUYER_IND`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = INDIVIDUAL

> Buyer represents and warrants that Buyer is at least 18 years of age and has full authority to enter into this Agreement; that Buyer has had the opportunity to inspect the Horse, to have the Horse examined by a veterinarian of Buyer's choosing, and to ask questions about the Horse; and that Buyer has the knowledge and experience to evaluate the Horse's suitability for Buyer's intended use. By signing this Agreement, Buyer acknowledges that Buyer has read this Agreement, fully understands its terms, and understands that Buyer is giving up substantial legal rights on behalf of Buyer and anyone claiming by, through, or under Buyer, including the right to sue the Seller Parties.

### Buyer's Representations

`REPS.BUYER_ENT`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY

> Buyer represents and warrants that it is duly organized and in good standing, that the person signing on its behalf is authorized to bind it, that it has had the opportunity to inspect the Horse, to have the Horse examined by a veterinarian of its choosing, and to ask questions about the Horse, and that it has the knowledge and experience, directly or through its personnel, to evaluate the Horse's suitability for its intended use. By signing this Agreement, Buyer acknowledges that it has read this Agreement, fully understands its terms, and understands that it is giving up substantial legal rights on behalf of Buyer and anyone claiming by, through, or under Buyer, including the right to sue the Seller Parties.

### Buyer's Representations

`REPS.BUYER_PENDING`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = (empty)

> [Pending — select whether Buyer is an individual or an entity. This placeholder is replaced by the applicable representations and blocks signing.]

## 18. Signatures

`SIGNATURES`

### Signatures

`SIGNATURES.BLOCK`

> IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.
>
> BUYER
> Signature: {{SIG.BUYER.NAME}}
> Printed Name: {{BUYER.PRINTED_NAME}}
> Date: {{SIG.BUYER.DATE}}

### BUYER_CAPACITY *(no heading set)*

`SIGNATURES.BUYER_CAPACITY`

**CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY

> By: {{BUYER.ENTITY_SIGNER_NAME}}
> Title: {{BUYER.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{BUYER.FULL_NAME}}

- **Signing individual — name** — `BUYER.ENTITY_SIGNER_NAME` · input: text · required · owner: BUYER
    - **CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY
- **Signing individual — title** — `BUYER.ENTITY_SIGNER_TITLE` · input: text · required · owner: BUYER
    - **CONDITIONAL** — shows when: BUYER.PARTY_TYPE = ENTITY

### COBUYER_BLOCK *(no heading set)*

`SIGNATURES.COBUYER_BLOCK`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES

> CO-BUYER
> Signature: {{SIG.COBUYER.NAME}}
> Printed Name: {{COBUYER.PRINTED_NAME}}
> Date: {{SIG.COBUYER.DATE}}

### COBUYER_CAPACITY *(no heading set)*

`SIGNATURES.COBUYER_CAPACITY`

**CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES AND COBUYER.PARTY_TYPE = ENTITY

> By: {{COBUYER.ENTITY_SIGNER_NAME}}
> Title: {{COBUYER.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{COBUYER.FULL_NAME}}

- **Signing individual — name** — `COBUYER.ENTITY_SIGNER_NAME` · input: text · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES AND COBUYER.PARTY_TYPE = ENTITY
- **Signing individual — title** — `COBUYER.ENTITY_SIGNER_TITLE` · input: text · required · owner: COBUYER
    - **CONDITIONAL** — shows when: TXN.CO_BUYER_ENABLED = YES AND COBUYER.PARTY_TYPE = ENTITY

### SELLER_BLOCK *(no heading set)*

`SIGNATURES.SELLER_BLOCK`

> SELLER (OWNER)
> Signature: {{SIG.SELLER.NAME}}
> Printed Name: {{SELLER.PRINTED_NAME}}
> Date: {{SIG.SELLER.DATE}}

### SELLER_CAPACITY *(no heading set)*

`SIGNATURES.SELLER_CAPACITY`

**CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY

> By: {{SELLER.ENTITY_SIGNER_NAME}}
> Title: {{SELLER.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{SELLER.FULL_NAME}}

- **Signing individual — name** — `SELLER.ENTITY_SIGNER_NAME` · input: text · required · owner: SELLER
    - **CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY
- **Signing individual — title** — `SELLER.ENTITY_SIGNER_TITLE` · input: text · required · owner: SELLER
    - **CONDITIONAL** — shows when: SELLER.PARTY_TYPE = ENTITY

