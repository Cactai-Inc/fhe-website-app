# HORSE_SALE_V2 — clause-gate template content (2026-08-02, final legal draft)

Universal horse sale agreement on the HORSE_LEASE_V2 architecture: same tables (contract_clause_defs, contract_field_defs), same conditional_on vocabulary, same creation → review → revise → sign flow, same pending-placeholder and blocks-signing mechanics. Parties: SELLER and BUYER — either may be FHE (principal sales) or two outside parties (brokered sales; the company's compensated-intermediary disclosure lives in the Bill of Sale). All bodies are final vetted legal language: load verbatim. Money fields carry the same format_type/currency typing as the lease's U2 money fields (verify the live value and reuse it). Every conditional states its exact conditional_on JSON; unconditional clauses have conditional_on NULL. clause_type is prose unless a field renders inline in the clause, then input, matching lease conventions. sort_order: sections at listed order times 10; clauses within a section at 10, 20, 30... in listed order.

## SECTION 1 — key PARTIES, heading "Parties"

CLAUSE PARTIES.INTRO — heading NULL, type input, conditional NULL
BODY:
This Horse Sale and Purchase Agreement (the "Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} by and between {{SELLER.FULL_NAME}} of {{SELLER.ADDRESS}} ("Seller") and {{BUYER.FULL_NAME}} of {{BUYER.ADDRESS}} ("Buyer").

FIELDS:
- SELLER.PARTY_TYPE — label "Seller is an", select, choices Individual|Entity / organization (stored INDIVIDUAL|ENTITY), required, owner SELLER
- BUYER.PARTY_TYPE — label "Buyer is an", select, same choices, required, owner BUYER
(Party contact fields auto-import from records exactly as the lease's party fill does.)

CLAUSE PARTIES.CO_BUYER — heading "Co-Buyer", type input, conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}
BODY:
{{COBUYER.FULL_NAME}} of {{COBUYER.ADDRESS}} ("Co-Buyer") purchases the Horse jointly with Buyer. Co-Buyer is a Buyer for all purposes of this Agreement, every reference to Buyer includes Co-Buyer, and the representations, covenants, releases, waivers, and payment obligations of Buyer under this Agreement are made by Buyer and Co-Buyer jointly and severally. Buyer and Co-Buyer shall hold title to the Horse as follows: {{TXN.CO_BUYER_TITLE_FORM}}. This Agreement is effective as to Co-Buyer upon Co-Buyer's execution of it.

CLAUSE PARTIES.CO_BUYER_PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.CO_BUYER_ENABLED"}
BODY:
[Pending — state whether there is a co-buyer. This placeholder is replaced by the applicable terms and blocks signing.]

FIELDS:
- TXN.CO_BUYER_ENABLED — label "Is there a co-buyer?", select, choices Yes|No (stored YES|NO), required, owner DEAL. NO renders nothing.
- COBUYER.FULL_NAME, COBUYER.ADDRESS, COBUYER.PHONE, COBUYER.EMAIL, COBUYER.PRINTED_NAME — same shapes as the BUYER contact fields, owner COBUYER, each conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}, name and address required when shown. Populated by selecting an existing app account or contact; where no account exists, hand-entered and a contact record is created from the entry the same way a new party is handled elsewhere.
- COBUYER.PARTY_TYPE — label "Co-Buyer is an", select, choices Individual|Entity / organization (stored INDIVIDUAL|ENTITY), owner COBUYER, conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}, required when shown.
- TXN.CO_BUYER_TITLE_FORM — label "How will title be held?", select, choices Joint tenants with right of survivorship|Tenants in common in equal shares|Tenants in common in the shares stated below|As stated below (stored JTWROS|TIC_EQUAL|TIC_STATED|OTHER), owner DEAL, conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}, required when shown.
- TXN.CO_BUYER_TITLE_DETAIL — label "Title detail", text, owner DEAL, conditional {"any": [{"equals": ["TIC_STATED"], "field_key": "TXN.CO_BUYER_TITLE_FORM"}, {"equals": ["OTHER"], "field_key": "TXN.CO_BUYER_TITLE_FORM"}]}, required when shown.

CLAUSE PARTIES.CO_BUYER_TITLE_DETAIL — heading NULL, type input, conditional {"any": [{"equals": ["TIC_STATED"], "field_key": "TXN.CO_BUYER_TITLE_FORM"}, {"equals": ["OTHER"], "field_key": "TXN.CO_BUYER_TITLE_FORM"}]}
BODY:
Title detail: {{TXN.CO_BUYER_TITLE_DETAIL}}

CLAUSE DEFINITIONS_NOTE — the Buyer Parties definitions in Section 2 already reach Co-Buyer through "Buyer" once this clause is active; no separate Co-Buyer definition is needed.

## SECTION 2 — key DEFINITIONS, heading "Definitions; Binding Effect; Third-Party Beneficiaries"
(Immediately after PARTIES, matching the M25(a) ordering decision for the lease.)

CLAUSE DEFINITIONS.SELLER_IND — heading NULL, type prose, conditional {"equals": ["INDIVIDUAL"], "field_key": "SELLER.PARTY_TYPE"}
BODY:
"Seller Parties" means Seller; Seller's spouse and family and household members, in each case when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Seller's estate, executors, administrators, legal representatives, successors, and assigns.

CLAUSE DEFINITIONS.SELLER_ENT — heading NULL, type prose, conditional {"equals": ["ENTITY"], "field_key": "SELLER.PARTY_TYPE"}
BODY:
"Seller Parties" means Seller; Seller's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Seller and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

CLAUSE DEFINITIONS.SELLER_PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "SELLER.PARTY_TYPE"}
BODY:
[Pending — select whether Seller is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]

CLAUSE DEFINITIONS.BUYER_IND — heading NULL, type prose, conditional {"equals": ["INDIVIDUAL"], "field_key": "BUYER.PARTY_TYPE"}
BODY:
"Buyer Parties" means Buyer; Buyer's spouse and family and household members, in each case when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Buyer's estate, executors, administrators, legal representatives, successors, and assigns.

CLAUSE DEFINITIONS.BUYER_ENT — heading NULL, type prose, conditional {"equals": ["ENTITY"], "field_key": "BUYER.PARTY_TYPE"}
BODY:
"Buyer Parties" means Buyer; Buyer's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Buyer and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

CLAUSE DEFINITIONS.BUYER_PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "BUYER.PARTY_TYPE"}
BODY:
[Pending — select whether Buyer is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]

CLAUSE DEFINITIONS.CLOSING — heading NULL, type prose, conditional NULL
BODY:
"Closing" means the moment at which both of the following have occurred: Seller's receipt of the Purchase Price in full (or, where installment payment applies, receipt of all amounts due at transfer under the installment terms), and delivery of the Horse to Buyer as provided in this Agreement.

CLAUSE DEFINITIONS.BINDING — heading NULL, type prose, conditional NULL
BODY:
Each release, waiver, assumption of risk, and covenant made by a party under this Agreement is made by that party on its own behalf and, to the fullest extent permitted by law, binds anyone claiming by, through, or under that party, including that party's estate, executors, administrators, heirs, legal representatives, successors, assigns, insurers, and subrogees. Each party covenants that it will not permit any person who has not executed this Agreement or a release approved by the other party to ride, handle, or care for the Horse prior to Closing, and each party shall indemnify, defend, and hold harmless the other party's Seller Parties or Buyer Parties, as applicable, from and against any claim brought by that party's family members, invitees, or authorized riders arising out of the Horse or the activities contemplated by this Agreement, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

CLAUSE DEFINITIONS.BENEFICIARIES — heading NULL, type prose, conditional NULL
BODY:
Each Seller Party and each Buyer Party who is not a signatory to this Agreement is an intended third-party beneficiary of the releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement and may enforce them directly.

## SECTION 3 — key HORSE, heading "The Horse"

CLAUSE HORSE.IDENTITY — heading "Horse", type input, conditional NULL
BODY:
This Agreement applies to the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
Barn Name: {{HORSE.BARN_NAME}}
Color: {{HORSE.COLOR}}
Markings: {{HORSE.MARKINGS}}
Breed: {{HORSE.BREED}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Sex: {{HORSE.SEX}}
Foaling date: {{HORSE.AGE_DOB}}
Height: {{HORSE.HEIGHT}}
Microchip: {{HORSE.MICROCHIP}}
Passport: {{HORSE.PASSPORT_NUMBER}}
Current Location: {{HORSE.CURRENT_LOCATION}}

FIELDS: reuse the lease's HORSE.* field defs one-for-one (same field_key, label, input kind, choices; owner SELLER as the horse-owning party) — copy the live HORSE_LEASE_V2 rows changing template_key and owner role only, with the Foaling-date label per lease manifest M24.

CLAUSE HORSE.OWNERSHIP — heading "Title and Ownership", type prose, conditional NULL
BODY:
Seller warrants that Seller lawfully owns the Horse, holds good and marketable title to the Horse, free and clear of all liens, security interests, leases, breeding contracts, co-ownership interests, and encumbrances except as expressly disclosed in this Agreement, and has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and sell the Horse.

CLAUSE HORSE.ENCUMBRANCES — heading "Disclosed Encumbrances and Interests", type input, conditional {"equals": ["YES"], "field_key": "TXN.HAS_ENCUMBRANCES"}
BODY:
Seller discloses the following liens, leases, co-ownership interests, or other encumbrances affecting the Horse, each of which will be released or satisfied at or before Closing unless expressly stated otherwise: {{TXN.DISCLOSED_ENCUMBRANCES}}

FIELDS:
- TXN.HAS_ENCUMBRANCES — label "Any liens, leases, or other encumbrances?", select, choices Yes|No (stored YES|NO), required, owner SELLER
- TXN.DISCLOSED_ENCUMBRANCES — label "Encumbrance details", longtext, owner SELLER, conditional {"equals": ["YES"], "field_key": "TXN.HAS_ENCUMBRANCES"}, required when shown

CLAUSE HORSE.BEHAVIOR — heading "Behavior", type prose, conditional NULL
BODY:
Seller warrants that, to Seller's knowledge, the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement, except as disclosed in this Agreement.

CLAUSE HORSE.DISCLOSURES — heading "Health and Condition Disclosures", type input, conditional NULL
BODY:
Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions, injuries, lameness history, surgeries, allergies, current and past medications, behavioral issues, vices, and prior veterinary concerns, as follows: {{TXN.KNOWN_CONDITIONS}}. Seller warrants that these disclosures are true and complete to Seller's knowledge as of the Effective Date, and shall promptly disclose any material change arising before Closing.

FIELD: TXN.KNOWN_CONDITIONS — label "Known conditions and history", longtext, required, owner SELLER (seed from the horse record's known-conditions data the way the lease seeds record-backed fields).

CLAUSE HORSE.INJURY_HISTORY_NONE — heading "No Serious Injury History", type input, conditional {"equals": ["NO"], "field_key": "TXN.INJURY_HISTORY"}
BODY:
Seller represents that, to Seller's knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.

CLAUSE HORSE.INJURY_HISTORY_DISCLOSED — heading "Serious Injury History Disclosed", type input, conditional {"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}
BODY:
Seller discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Buyer acknowledges this disclosure and proceeds with knowledge of it.

CLAUSE HORSE.INJURY_HISTORY_PENDING — heading NULL, type input, conditional {"equals": [""], "field_key": "TXN.INJURY_HISTORY"}
BODY:
[Pending — state whether anyone has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]

FIELDS:
- TXN.INJURY_HISTORY — label "Has anyone been seriously injured by the Horse's direct actions?", select, choices Yes|No (stored YES|NO), required, owner SELLER
- TXN.INJURY_HISTORY_DETAILS — label "Injury history details", longtext, owner SELLER, conditional {"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}, required when shown

CLAUSE HORSE.BREEDING — heading "Breeding Warranty", type input, conditional {"equals": ["INCLUDED"], "field_key": "TXN.BREEDING_ELECTION"}
BODY:
Seller expressly warrants that, to Seller's knowledge, the Horse is capable of breeding and free of any reproductive condition that would prevent it, as supported by the reproductive examination or records described here: {{TXN.BREEDING_BASIS}}. If a licensed veterinarian determines within {{TXN.BREEDING_CLAIM_WINDOW}} days after Closing that the Horse was incapable of breeding as of Closing due to a condition existing at Closing, Buyer's exclusive remedy is, at Buyer's election, return of the Horse in substantially the condition delivered for a refund of the Purchase Price, or a reduction of the Purchase Price agreed by the parties. This is the sole warranty regarding breeding and does not otherwise limit the Disclaimer of Warranties.

CLAUSE HORSE.BREEDING_DECLINED — heading "Breeding Warranty Not Elected", type prose, conditional {"equals": ["NOT_INCLUDED"], "field_key": "TXN.BREEDING_ELECTION"}
BODY:
No warranty of breeding soundness, fertility, or reproductive capacity is given or implied. The parties considered including a breeding warranty and both elected not to include one.

FIELDS:
- TXN.BREEDING_ELECTION — label "Breeding warranty", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL
- TXN.BREEDING_BASIS — label "Reproductive exam or records", longtext, owner SELLER, conditional {"equals": ["INCLUDED"], "field_key": "TXN.BREEDING_ELECTION"}, required when shown
- TXN.BREEDING_CLAIM_WINDOW — label "Claim window (days)", number, owner DEAL, conditional {"equals": ["INCLUDED"], "field_key": "TXN.BREEDING_ELECTION"}, required when shown

CLAUSE HORSE.WARRANTY — heading "Disclaimer of Warranties", type prose, conditional NULL
BODY:
Except for the representations and warranties expressly stated in this Agreement, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit Buyer's rights arising from the express representations in this Agreement or from fraud.

## SECTION 4 — key PURPOSE_SALE, heading "Purpose and Sale"

CLAUSE PURPOSE_SALE.MAIN — heading "Purpose of Agreement", type prose, conditional NULL
BODY:
Seller owns the horse described in this Agreement and desires to sell it, and Buyer desires to purchase it, on the terms and conditions of this Agreement.

CLAUSE PURPOSE_SALE.SALE — heading "Agreement to Sell and Purchase", type prose, conditional NULL
BODY:
Subject to the terms and conditions of this Agreement, Seller agrees to sell, transfer, and convey the Horse to Buyer, and Buyer agrees to purchase the Horse from Seller, for the Purchase Price and on the terms stated in this Agreement.

## SECTION 5 — key PRICE, heading "Purchase Price and Payment"

CLAUSE PRICE.AMOUNT — heading "Purchase Price", type input, conditional NULL
BODY:
The purchase price for the Horse is {{TXN.PURCHASE_PRICE}} (the "Purchase Price").

FIELD: TXN.PURCHASE_PRICE — label "Purchase price", currency (same format_type as lease money fields), required, owner DEAL

CLAUSE PRICE.DEPOSIT — heading "Deposit", type input, conditional {"equals": ["YES"], "field_key": "TXN.DEPOSIT_ENABLED"}
BODY:
Buyer shall pay a deposit of {{TXN.DEPOSIT_AMOUNT}} (the "Deposit") upon execution of this Agreement. The Deposit is applied against the Purchase Price at Closing. If this Agreement terminates because a condition precedent stated in this Agreement fails (including an unsatisfactory pre-purchase examination where the sale is contingent on one, a financing contingency that fails where one is included, or a trial period return in accordance with this Agreement), the Deposit is refunded to Buyer in full within 5 business days. If Buyer fails to complete the purchase for any other reason, the parties agree that Seller's actual damages would be impracticable or extremely difficult to determine, that the Deposit is a reasonable estimate of those damages, and that Seller may retain the Deposit as liquidated damages as Seller's sole monetary remedy for that failure.

FIELDS:
- TXN.DEPOSIT_ENABLED — label "Deposit", select, choices Yes|No (stored YES|NO), required, owner DEAL
- TXN.DEPOSIT_AMOUNT — label "Deposit amount", currency, owner DEAL, conditional {"equals": ["YES"], "field_key": "TXN.DEPOSIT_ENABLED"}, required when shown

CLAUSE PRICE.PAYMENT_METHOD — heading "Payment Method", type input, conditional NULL
BODY:
The Purchase Price shall be paid by the following method(s): {{TXN.PAYMENT_METHODS}}. Payment is not received until funds are actually and irrevocably credited to Seller.

FIELD: TXN.PAYMENT_METHODS — reuse the lease's payment-method input pattern and choice set, required, owner DEAL

CLAUSE PRICE.FULL_PAYMENT — heading "Payment in Full at Transfer", type prose, conditional {"equals": ["NO"], "field_key": "TXN.INSTALLMENTS_ENABLED"}
BODY:
The Purchase Price, less any Deposit already paid, is due in full at or before delivery of the Horse. Seller is not obligated to deliver the Horse or any registration or transfer documents until the Purchase Price is received in full.

CLAUSE PRICE.INSTALLMENTS — heading "Installment Terms", type input, conditional {"equals": ["YES"], "field_key": "TXN.INSTALLMENTS_ENABLED"}
BODY:
The Purchase Price is payable in installments as follows: {{TXN.INSTALLMENT_SCHEDULE}}. Until the Purchase Price is paid in full: title to the Horse remains with Seller and Buyer holds possession under this Agreement only; Buyer grants Seller a purchase-money security interest in the Horse and its registration papers to secure the unpaid balance, and authorizes Seller to file a financing statement; Buyer shall not sell, lease, encumber, breed, or relocate the Horse from {{TXN.INSTALLMENT_LOCATION}} without Seller's prior written consent; Buyer shall maintain mortality insurance on the Horse in an amount not less than the unpaid balance, naming Seller as loss payee, and shall provide proof on request; and Buyer bears all costs of the Horse's care. If Buyer fails to make a payment when due and does not cure within 10 days of written notice, Seller may retake possession of the Horse, and amounts already paid are subject to the default and remedies provisions of this Agreement. Registration and transfer documents are delivered upon payment in full.

CLAUSE PRICE.INSTALLMENTS_PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.INSTALLMENTS_ENABLED"}
BODY:
[Pending — select whether the Purchase Price is paid in full at transfer or in installments. This placeholder is replaced by the applicable payment terms and blocks signing.]

FIELDS:
- TXN.INSTALLMENTS_ENABLED — label "Installment payment", select, choices Yes|No (stored YES|NO), required, owner DEAL
- TXN.INSTALLMENT_SCHEDULE — label "Installment schedule", longtext, owner DEAL, conditional {"equals": ["YES"], "field_key": "TXN.INSTALLMENTS_ENABLED"}, required when shown
- TXN.INSTALLMENT_LOCATION — label "Horse location during installments", text, owner DEAL, conditional {"equals": ["YES"], "field_key": "TXN.INSTALLMENTS_ENABLED"}, required when shown

CLAUSE PRICE.FINANCING — heading "Financing Contingency", type input, conditional {"equals": ["INCLUDED"], "field_key": "TXN.FINANCING_ELECTION"}
BODY:
This sale is contingent on Buyer obtaining financing for not less than {{TXN.FINANCING_AMOUNT}} on terms reasonably acceptable to Buyer on or before {{TXN.FINANCING_DEADLINE}}. Buyer shall pursue financing diligently and in good faith. If Buyer gives Seller written notice on or before that date that financing could not be obtained, this Agreement terminates, the Deposit (if any) is refunded in full, and neither party has further obligation to the other except obligations that expressly survive. If no such notice is given by that date, this contingency is deemed waived.

CLAUSE PRICE.FINANCING_DECLINED — heading "Financing Contingency Not Elected", type prose, conditional {"equals": ["NOT_INCLUDED"], "field_key": "TXN.FINANCING_ELECTION"}
BODY:
This sale is not contingent on Buyer obtaining financing. The parties considered including a financing contingency and both elected not to include one.

FIELDS:
- TXN.FINANCING_ELECTION — label "Financing contingency", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL
- TXN.FINANCING_AMOUNT — label "Financing amount", currency, owner DEAL, conditional {"equals": ["INCLUDED"], "field_key": "TXN.FINANCING_ELECTION"}, required when shown
- TXN.FINANCING_DEADLINE — label "Financing deadline", date, owner DEAL, conditional {"equals": ["INCLUDED"], "field_key": "TXN.FINANCING_ELECTION"}, required when shown

CLAUSE PRICE.TAXES — heading "Taxes", type input, conditional NULL
BODY:
Any sales, use, or similar transfer tax arising from this sale is the responsibility of {{TXN.SALES_TAX_RESPONSIBLE}}. Each party is otherwise responsible for its own tax obligations arising from this transaction.

FIELD: TXN.SALES_TAX_RESPONSIBLE — label "Transfer tax responsibility", select, choices Buyer|Seller (stored BUYER|SELLER), required, owner DEAL

## SECTION 6 — key PPE, heading "Pre-Purchase Examination"

CLAUSE PPE.CONDUCTED — heading "Pre-Purchase Examination", type input, conditional {"equals": ["CONDUCTED"], "field_key": "TXN.PPE_CHOICE"}
BODY:
Buyer may, at Buyer's sole cost, have the Horse examined by a licensed veterinarian of Buyer's choosing on or before {{TXN.PPE_DEADLINE}}. Seller shall make the Horse reasonably available for the examination and shall disclose the Horse's known medical history to the examining veterinarian on request.

CLAUSE PPE.CONTINGENCY — heading "Sale Contingent on Examination", type input, conditional {"all": [{"equals": ["CONDUCTED"], "field_key": "TXN.PPE_CHOICE"}, {"equals": ["YES"], "field_key": "TXN.PPE_CONTINGENT"}]}
BODY:
This sale is contingent on a pre-purchase examination whose results are satisfactory to Buyer in Buyer's reasonable discretion. If Buyer gives Seller written notice on or before {{TXN.PPE_DEADLINE}} that the examination results are not satisfactory, this Agreement terminates, the Deposit (if any) is refunded in full, and neither party has further obligation to the other except obligations that expressly survive. If Buyer gives no such notice by that date, this contingency is deemed waived.

CLAUSE PPE.WAIVED — heading "Examination Waived", type prose, conditional {"equals": ["WAIVED"], "field_key": "TXN.PPE_CHOICE"}
BODY:
Buyer has been advised to obtain an independent pre-purchase veterinary examination of the Horse and knowingly and voluntarily waives it. Buyer accepts the Horse without such examination and assumes all risk associated with conditions an examination might have revealed. This waiver does not limit Buyer's rights arising from the express representations in this Agreement or from fraud.

CLAUSE PPE.PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.PPE_CHOICE"}
BODY:
[Pending — select whether a pre-purchase examination will be conducted or is waived. This placeholder is replaced by the applicable examination terms and blocks signing.]

FIELDS:
- TXN.PPE_CHOICE — label "Pre-purchase examination", select, choices Conducted|Waived (stored CONDUCTED|WAIVED), required, owner BUYER
- TXN.PPE_CONTINGENT — label "Sale contingent on exam results", select, choices Yes|No (stored YES|NO), owner DEAL, conditional {"equals": ["CONDUCTED"], "field_key": "TXN.PPE_CHOICE"}, required when shown
- TXN.PPE_DEADLINE — label "Examination deadline", date, owner DEAL, conditional {"equals": ["CONDUCTED"], "field_key": "TXN.PPE_CHOICE"}, required when shown

CLAUSE PPE.DRUG_TESTING — heading "Drug and Substance Testing", type input, conditional {"equals": ["INCLUDED"], "field_key": "TXN.DRUG_TEST_ELECTION"}
BODY:
At the pre-purchase examination or at delivery, whichever Buyer elects, Buyer may, at Buyer's cost, have a licensed veterinarian draw blood or other samples from the Horse. Samples shall be split, sealed, and identified in the presence of both parties or their representatives, with one set retained by the veterinarian or a certified testing laboratory. Buyer may have the samples tested for prohibited, masking, or performance- or behavior-altering substances within {{TXN.DRUG_TEST_WINDOW}} days after collection. If a certified laboratory confirms the presence of such a substance not disclosed in this Agreement and not administered under a disclosed current veterinary prescription, Buyer may rescind this Agreement by written notice within 5 business days of receiving the confirmed result, return the Horse in substantially the condition delivered, and receive a refund of all amounts paid including the Deposit, and Seller shall reimburse Buyer's reasonable testing and return transport costs.

CLAUSE PPE.DRUG_TESTING_DECLINED — heading "Drug and Substance Testing Not Elected", type prose, conditional {"equals": ["NOT_INCLUDED"], "field_key": "TXN.DRUG_TEST_ELECTION"}
BODY:
Buyer was offered the opportunity to have samples drawn from the Horse and tested for prohibited, masking, or performance- or behavior-altering substances, and the parties elected not to include drug testing. Buyer assumes the risk that the Horse's condition or behavior at examination, trial, or delivery may have been affected by a substance present at that time.

FIELDS:
- TXN.DRUG_TEST_ELECTION — label "Drug and substance testing", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL
- TXN.DRUG_TEST_WINDOW — label "Testing window (days)", number, owner DEAL, conditional {"equals": ["INCLUDED"], "field_key": "TXN.DRUG_TEST_ELECTION"}, required when shown

## SECTION 7 — key TRIAL, heading "Trial Period"

CLAUSE TRIAL.TERMS — heading "Trial Period", type input, conditional {"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}
BODY:
Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}. During the trial period: Buyer bears all costs of the Horse's board, care, and routine maintenance; Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse's training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller's written consent; Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement; and Buyer shall maintain, at {{TXN.TRIAL_INSURANCE_RESPONSIBLE}}'s cost, mortality insurance on the Horse in an amount not less than the Purchase Price for the duration of the trial. If the Horse dies or is significantly injured during the trial period due to Buyer's failure to provide reasonable care, Buyer is responsible for the Purchase Price; otherwise Seller bears the risk of loss of the Horse itself during the trial. Buyer may return the Horse in substantially the condition received, on written notice given on or before {{TXN.TRIAL_END}}, in which case this Agreement terminates and the Deposit (if any) is refunded in full; if no such notice is given by that date, Buyer is deemed to have accepted the Horse and Closing proceeds under this Agreement.

CLAUSE TRIAL.NONE — heading NULL, type prose, conditional {"equals": ["NO"], "field_key": "TXN.TRIAL_ENABLED"}
BODY:
No trial period applies to this sale.

CLAUSE TRIAL.PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.TRIAL_ENABLED"}
BODY:
[Pending — select whether a trial period applies. This placeholder is replaced by the applicable trial terms and blocks signing.]

FIELDS:
- TXN.TRIAL_ENABLED — label "Trial period", select, choices Yes|No (stored YES|NO), required, owner DEAL
- TXN.TRIAL_START (date), TXN.TRIAL_END (date), TXN.TRIAL_LOCATION (text), TXN.TRIAL_INSURANCE_RESPONSIBLE (select Buyer|Seller stored BUYER|SELLER) — all owner DEAL, each conditional {"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, required when shown

## SECTION 8 — key DELIVERY, heading "Title, Delivery, and Risk of Loss"

CLAUSE DELIVERY.TERMS — heading "Delivery", type input, conditional NULL
BODY:
The Horse shall be delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}. Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}. If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller's delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day.

FIELDS: TXN.DELIVERY_LOCATION (text, required), TXN.DELIVERY_DATE (date, required), TXN.TRANSPORT_RESPONSIBLE (select Buyer|Seller stored BUYER|SELLER, required), TXN.TRANSPORT_COST_RESPONSIBLE (same, required), TXN.BOARD_RATE_AFTER (currency, required). All owner DEAL.

CLAUSE DELIVERY.TITLE_RISK — heading "Transfer of Title and Risk", type prose, conditional NULL
BODY:
Except as otherwise provided in the Installment Terms, title to the Horse passes to Buyer at Closing, and risk of loss of or injury to the Horse passes to Buyer upon delivery. Upon Closing, this executed Agreement, together with the executed Bill of Sale, constitutes the instruments of transfer for the Horse, and Seller shall execute any additional transfer document reasonably required by a breed registry, microchip registry, or passport authority.

CLAUSE DELIVERY.PAPERS — heading "Registration and Transfer Documents", type input, conditional NULL
BODY:
At Closing (or, where installment payment applies, upon payment in full), Seller shall deliver to Buyer the Horse's registration papers, passport, and any transfer forms required to record the change of ownership, executed by Seller where signature is required. Each party shall cooperate to complete breed registry, microchip registry, and passport transfers promptly, with recording fees paid by {{TXN.TRANSFER_FEES_RESPONSIBLE}}.

FIELD: TXN.TRANSFER_FEES_RESPONSIBLE — label "Registry transfer fees", select, choices Buyer|Seller (stored BUYER|SELLER), required, owner DEAL

CLAUSE DELIVERY.NO_SLAUGHTER — heading "No-Slaughter Covenant", type prose, conditional {"equals": ["INCLUDED"], "field_key": "TXN.NO_SLAUGHTER_ELECTION"}
BODY:
Buyer covenants that Buyer will not sell, transfer, consign, or deliver the Horse, directly or through intermediaries, for slaughter or for human consumption, whether within or outside California, and will not sell or transfer the Horse at auction without commercially reasonable steps to ensure the Horse is not being acquired for slaughter. The parties acknowledge that California Penal Code Section 598c makes it unlawful to possess, import, export, sell, or transfer a horse with the intent that it be killed for human consumption. This covenant survives Closing and binds Buyer's successors in interest to the extent permitted by law.

FIELD: TXN.NO_SLAUGHTER_ELECTION — label "No-slaughter covenant", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL. NOT_INCLUDED renders nothing.

## SECTION 9 — key RISK, heading "Risk, Release, and Indemnification"

CLAUSE RISK.ASSUMPTION_INHERENT — heading "Assumption of Inherent Risks", type prose, conditional NULL
BODY:
Each party understands that horseback riding and handling horses are inherently dangerous activities, and that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. In connection with any examination, trial, handling, riding, transport, or delivery of the Horse under this Agreement, each party, on behalf of itself and anyone claiming by, through, or under it, expressly and voluntarily assumes all inherent risks of equine activities, and acknowledges that the other party's Seller Parties or Buyer Parties, as applicable, owe no duty to protect it from those inherent risks.

CLAUSE RISK.RELEASE_BUYER — heading "Release by Buyer", type prose, conditional NULL
BODY:
Buyer, on behalf of Buyer and anyone claiming by, through, or under Buyer, completely releases, forever discharges, and agrees to hold harmless the Seller Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Buyer's examination, trial, handling, riding, or transport of the Horse before Closing, whether caused by the ordinary negligence of any Seller Party or otherwise, and from any and all claims arising after Closing relating to the Horse's condition, soundness, behavior, suitability, or value. This release does not apply to gross negligence, reckless conduct, intentional misconduct, fraud, or breach of the express representations and warranties stated in this Agreement.

CLAUSE RISK.RELEASE_SELLER — heading "Release by Seller", type prose, conditional NULL
BODY:
Seller, on behalf of Seller and anyone claiming by, through, or under Seller, completely releases, forever discharges, and agrees to hold harmless the Buyer Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Seller's riding or handling of the Horse or Seller's presence at any facility where the Horse is kept in connection with this Agreement, whether caused by the ordinary negligence of any Buyer Party or otherwise. This release does not apply to gross negligence, reckless conduct, intentional misconduct, or fraud.

CLAUSE RISK.WAIVER_UNKNOWN — heading "Waiver of Unknown Claims", type prose, conditional NULL
BODY:
Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Agreement that the waiving party does not know or suspect to exist in its favor at the time of this Agreement. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Agreement. This waiver does not apply to claims arising from fraud or from breach of the express representations and warranties stated in this Agreement.

CLAUSE RISK.POST_CLOSING — heading "Post-Closing Responsibility", type prose, conditional NULL
BODY:
From and after Closing, the Horse and its actions, behavior, care, and condition are the sole responsibility of Buyer, and Buyer shall indemnify, defend, and hold harmless the Seller Parties from and against any claim, damage, loss, liability, cost, or expense arising out of the Horse or its use, handling, care, or possession after Closing, except to the extent caused by the gross negligence, reckless conduct, intentional misconduct, or fraud of a Seller Party or by breach of the express representations and warranties stated in this Agreement.

CLAUSE RISK.PRE_CLOSING — heading "Pre-Closing Responsibility", type prose, conditional NULL
BODY:
Before Closing, and except as allocated to Buyer during any trial period, Seller shall indemnify, defend, and hold harmless the Buyer Parties from and against any third-party claim arising out of the Horse's ownership, care, or condition, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of a Buyer Party.

## SECTION 10 — key DEFAULT, heading "Default and Remedies"

CLAUSE DEFAULT.CURE — heading "Default and Cure", type prose, conditional NULL
BODY:
A party in material breach of this Agreement has 10 days after written notice of the breach to cure it, except that no cure period applies to Buyer's failure to complete the purchase after all conditions precedent are satisfied or waived, which is governed by the Deposit clause where a Deposit applies.

CLAUSE DEFAULT.SELLER — heading "Seller Default", type prose, conditional NULL
BODY:
If Seller fails to complete the sale after all conditions precedent are satisfied or waived, Buyer is entitled to a full refund of the Deposit and all other amounts paid, and, because the Horse is unique, Buyer may alternatively seek specific performance of this Agreement.

CLAUSE DEFAULT.INSTALLMENTS — heading "Buyer Default Under Installments", type prose, conditional {"equals": ["YES"], "field_key": "TXN.INSTALLMENTS_ENABLED"}
BODY:
If Seller retakes possession of the Horse following Buyer's uncured installment default, Seller shall, within 60 days, elect either to retain the Horse and refund amounts paid in excess of the greater of the Deposit and 20 percent of the Purchase Price, or to resell the Horse in a commercially reasonable manner and account to Buyer for any amount received in excess of the unpaid balance plus Seller's reasonable costs of retaking, keeping, and reselling the Horse.

## SECTION 11 — key NOTICE, heading "Notice and Contact Information"

CLAUSE NOTICE.FORM — heading "Form of Notice", type prose, conditional NULL
BODY:
Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.

CLAUSE NOTICE.SELLER_ADDRESS — heading "Seller", type prose, conditional NULL
BODY:
Name: {{SELLER.FULL_NAME}}
Address: {{SELLER.ADDRESS}}
Phone: {{SELLER.PHONE}}
Email: {{SELLER.EMAIL}}

CLAUSE NOTICE.BUYER_ADDRESS — heading "Buyer", type prose, conditional NULL
BODY:
Name: {{BUYER.FULL_NAME}}
Address: {{BUYER.ADDRESS}}
Phone: {{BUYER.PHONE}}
Email: {{BUYER.EMAIL}}

CLAUSE NOTICE.CHANGES — heading "Changes in Contact Information", type prose, conditional NULL
BODY:
Each party shall promptly notify the other party in writing of any change in the party's address or contact information.

## SECTION 12 — key ASSIGNMENT, heading "Assignment"

CLAUSE ASSIGNMENT.NO_ASSIGN — heading "Assignment", type prose, conditional NULL
BODY:
Neither party shall assign this Agreement or any of its rights or obligations under it without the other party's prior written consent.

## SECTION 13 — key ENTIRE_AGREEMENT, heading "Entire Agreement"

CLAUSE ENTIRE_AGREEMENT.INTEGRATION — heading "Entire Agreement", type prose, conditional NULL
BODY:
This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions, advertisements, and understandings, and Buyer acknowledges that Buyer is not relying on any statement or representation regarding the Horse that is not stated in this Agreement. Any modification of this Agreement must be in writing and signed by all parties.

## SECTION 14 — key GOVERNING_LAW, heading "Governing Law and Dispute Resolution"

CLAUSE GOVERNING_LAW.CHOICE — heading "Governing Law and Dispute Resolution", type prose, conditional NULL
BODY:
This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Agreement or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.

## SECTION 15 — key ATTORNEYS_FEES, heading "Attorneys' Fees"

CLAUSE ATTORNEYS_FEES.PREVAILING — heading "Attorneys' Fees", type prose, conditional NULL
BODY:
Each party shall cover their own attorney's fees and costs.

## SECTION 16 — key SEVERABILITY, heading "Severability"

CLAUSE SEVERABILITY.SAVING — heading "Severability", type prose, conditional NULL
BODY:
If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.

## SECTION 17 — key REPS, heading "Representations"

CLAUSE REPS.SELLER — heading "Seller's Representations", type prose, conditional NULL
BODY:
Seller represents and warrants that Seller has full authority to enter into this Agreement, that the warranties of title and the disclosures stated in this Agreement are true and complete to Seller's knowledge, and that Seller will promptly disclose any material change in the Horse's health, soundness, or behavior arising before Closing.

CLAUSE REPS.BUYER_IND — heading "Buyer's Representations", type prose, conditional {"equals": ["INDIVIDUAL"], "field_key": "BUYER.PARTY_TYPE"}
BODY:
Buyer represents and warrants that Buyer is at least 18 years of age and has full authority to enter into this Agreement; that Buyer has had the opportunity to inspect the Horse, to have the Horse examined by a veterinarian of Buyer's choosing, and to ask questions about the Horse; and that Buyer has the knowledge and experience to evaluate the Horse's suitability for Buyer's intended use. By signing this Agreement, Buyer acknowledges that Buyer has read this Agreement, fully understands its terms, and understands that Buyer is giving up substantial legal rights on behalf of Buyer and anyone claiming by, through, or under Buyer, including the right to sue the Seller Parties.

CLAUSE REPS.BUYER_ENT — heading "Buyer's Representations", type prose, conditional {"equals": ["ENTITY"], "field_key": "BUYER.PARTY_TYPE"}
BODY:
Buyer represents and warrants that it is duly organized and in good standing, that the person signing on its behalf is authorized to bind it, that it has had the opportunity to inspect the Horse, to have the Horse examined by a veterinarian of its choosing, and to ask questions about the Horse, and that it has the knowledge and experience, directly or through its personnel, to evaluate the Horse's suitability for its intended use. By signing this Agreement, Buyer acknowledges that it has read this Agreement, fully understands its terms, and understands that it is giving up substantial legal rights on behalf of Buyer and anyone claiming by, through, or under Buyer, including the right to sue the Seller Parties.

CLAUSE REPS.BUYER_PENDING — heading "Buyer's Representations", type prose, conditional {"equals": [""], "field_key": "BUYER.PARTY_TYPE"}
BODY:
[Pending — select whether Buyer is an individual or an entity. This placeholder is replaced by the applicable representations and blocks signing.]

## SECTION 18 — key SIGNATURES, heading "Signatures"

CLAUSE SIGNATURES.BLOCK — heading "Signatures", type prose, conditional NULL
BODY:
IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

BUYER
Signature: {{SIG.BUYER.NAME}}
Printed Name: {{BUYER.PRINTED_NAME}}
Date: {{SIG.BUYER.DATE}}

CLAUSE SIGNATURES.BUYER_CAPACITY — heading NULL, type input, conditional {"equals": ["ENTITY"], "field_key": "BUYER.PARTY_TYPE"}
BODY:
By: {{BUYER.ENTITY_SIGNER_NAME}}
Title: {{BUYER.ENTITY_SIGNER_TITLE}}
Signing on behalf of {{BUYER.FULL_NAME}}

CLAUSE SIGNATURES.COBUYER_BLOCK — heading NULL, type input, conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}
BODY:
CO-BUYER
Signature: {{SIG.COBUYER.NAME}}
Printed Name: {{COBUYER.PRINTED_NAME}}
Date: {{SIG.COBUYER.DATE}}

CLAUSE SIGNATURES.COBUYER_CAPACITY — heading NULL, type input, conditional {"all": [{"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}, {"equals": ["ENTITY"], "field_key": "COBUYER.PARTY_TYPE"}]}
BODY:
By: {{COBUYER.ENTITY_SIGNER_NAME}}
Title: {{COBUYER.ENTITY_SIGNER_TITLE}}
Signing on behalf of {{COBUYER.FULL_NAME}}

CLAUSE SIGNATURES.SELLER_BLOCK — heading NULL, type prose, conditional NULL
BODY:
SELLER (OWNER)
Signature: {{SIG.SELLER.NAME}}
Printed Name: {{SELLER.PRINTED_NAME}}
Date: {{SIG.SELLER.DATE}}

CLAUSE SIGNATURES.SELLER_CAPACITY — heading NULL, type input, conditional {"equals": ["ENTITY"], "field_key": "SELLER.PARTY_TYPE"}
BODY:
By: {{SELLER.ENTITY_SIGNER_NAME}}
Title: {{SELLER.ENTITY_SIGNER_TITLE}}
Signing on behalf of {{SELLER.FULL_NAME}}

FIELDS: BUYER.ENTITY_SIGNER_NAME, BUYER.ENTITY_SIGNER_TITLE (owner BUYER), SELLER.ENTITY_SIGNER_NAME, SELLER.ENTITY_SIGNER_TITLE (owner SELLER), COBUYER.ENTITY_SIGNER_NAME, COBUYER.ENTITY_SIGNER_TITLE (owner COBUYER) — text, each conditional on that party's PARTY_TYPE = ENTITY, required when shown.
