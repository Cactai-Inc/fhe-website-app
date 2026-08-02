# HORSE_BILL_OF_SALE — clause-gate template content (2026-08-02, final legal draft)

California bill of sale companion to HORSE_SALE_V2, on the same clause-gate architecture and the same creation → review → revise → sign flow. Generated from a sale contract where one exists (prefill every shared field from the sale document's values: parties, horse, price, payment status, delivery), or standalone. Written to satisfy California Business and Professions Code Section 19525 for racing or showing equines (including prospects and breeding stock): states the purchase price and is signed by both Seller and Buyer, with the agent and dual-agency disclosure elections below. Same conventions as the sale template: exact conditional_on JSON per conditional, conditional_on NULL when unconditional, prose/input clause_type, sections at listed order times 10, clauses at 10, 20, 30...

Field reuse: SELLER.*, BUYER.*, HORSE.*, and the party-type fields are the same field_keys as HORSE_SALE_V2 — when generated from a sale contract, values copy over; the fields listed here exist on this template's own field defs with the same shapes.

## SECTION 1 — key BOS_TITLE, heading "Bill of Sale"

CLAUSE BOS_TITLE.INTRO — heading NULL, type input, conditional NULL
BODY:
EQUINE BILL OF SALE. This Bill of Sale is made effective as of {{DOC.EFFECTIVE_DATE}} by {{SELLER.FULL_NAME}} of {{SELLER.ADDRESS}} ("Seller") in favor of {{BUYER.FULL_NAME}} of {{BUYER.ADDRESS}} ("Buyer").

CLAUSE BOS_TITLE.CO_BUYER — heading NULL, type input, conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}
BODY:
{{COBUYER.FULL_NAME}} of {{COBUYER.ADDRESS}} ("Co-Buyer") takes title jointly with Buyer as follows: {{TXN.CO_BUYER_TITLE_FORM}}. Every reference to Buyer in this Bill of Sale includes Co-Buyer.

FIELDS: SELLER.PARTY_TYPE and BUYER.PARTY_TYPE — same defs as the sale template, required, owner SELLER / owner BUYER. Co-buyer fields (TXN.CO_BUYER_ENABLED, COBUYER.*, TXN.CO_BUYER_TITLE_FORM, TXN.CO_BUYER_TITLE_DETAIL) — same defs as the sale template, prefilled from the sale contract where one exists.

## SECTION 2 — key BOS_HORSE, heading "The Horse"

CLAUSE BOS_HORSE.IDENTITY — heading NULL, type input, conditional NULL
BODY:
This Bill of Sale conveys the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
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

FIELDS: reuse the HORSE.* defs (owner SELLER), values prefilled from the sale contract or horse record.

## SECTION 3 — key BOS_CONSIDERATION, heading "Consideration"

CLAUSE BOS_CONSIDERATION.PRICE — heading NULL, type input, conditional NULL
BODY:
The purchase price for the Horse is {{TXN.PURCHASE_PRICE}} (the "Purchase Price"), the receipt and sufficiency of which are acknowledged to the extent stated below. The parties state this Purchase Price for all purposes, including California Business and Professions Code Section 19525 where applicable.

FIELD: TXN.PURCHASE_PRICE — currency, required, owner DEAL (prefill from sale contract).

## SECTION 4 — key BOS_CONVEYANCE, heading "Conveyance"

CLAUSE BOS_CONVEYANCE.PAID — heading NULL, type prose, conditional {"equals": ["PAID_IN_FULL"], "field_key": "TXN.BOS_PAYMENT_STATUS"}
BODY:
Seller acknowledges receipt of the Purchase Price in full and hereby sells, transfers, conveys, and delivers to Buyer all of Seller's right, title, and interest in and to the Horse, together with the Horse's registration papers and passport where applicable, TO HAVE AND TO HOLD the same unto Buyer and Buyer's successors and assigns forever.

CLAUSE BOS_CONVEYANCE.INSTALLMENT — heading NULL, type prose, conditional {"equals": ["INSTALLMENTS"], "field_key": "TXN.BOS_PAYMENT_STATUS"}
BODY:
The Purchase Price is payable in installments under the parties' Horse Sale and Purchase Agreement. Seller hereby transfers possession of the Horse to Buyer, and title to the Horse passes to Buyer only upon Seller's receipt of the Purchase Price in full as provided in that Agreement, until which time Seller retains title and a purchase-money security interest in the Horse as stated in that Agreement. Upon payment in full, this Bill of Sale operates without further action to convey all of Seller's right, title, and interest in and to the Horse to Buyer.

CLAUSE BOS_CONVEYANCE.PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.BOS_PAYMENT_STATUS"}
BODY:
[Pending — select whether the Purchase Price is paid in full or payable in installments. This placeholder is replaced by the applicable conveyance language and blocks signing.]

FIELD: TXN.BOS_PAYMENT_STATUS — label "Payment status at execution", select, choices Paid in full|Installments (stored PAID_IN_FULL|INSTALLMENTS), required, owner DEAL (derive from the sale contract's TXN.INSTALLMENTS_ENABLED where generated from one: NO maps to PAID_IN_FULL, YES to INSTALLMENTS; still editable before signing).

## SECTION 5 — key BOS_WARRANTY, heading "Warranty of Title; Condition"

CLAUSE BOS_WARRANTY.TITLE — heading NULL, type prose, conditional NULL
BODY:
Seller warrants that Seller is the lawful owner of the Horse, has full right and authority to sell and convey the Horse, and that the Horse is free and clear of all liens, security interests, and encumbrances except as disclosed in writing to Buyer, and Seller will defend title to the Horse against the lawful claims of all persons.

CLAUSE BOS_WARRANTY.CONDITION_XREF — heading NULL, type prose, conditional {"equals": ["YES"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
The Horse is conveyed subject to, and with the benefit of, the representations, disclosures, disclaimers of warranty, releases, and other terms of the parties' Horse Sale and Purchase Agreement of even or prior date, which remains in full force. In the event of a conflict between this Bill of Sale and that Agreement, that Agreement controls.

CLAUSE BOS_WARRANTY.CONDITION_STANDALONE — heading NULL, type prose, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
Except for the warranty of title above, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit claims arising from fraud. Buyer acknowledges the opportunity to have the Horse examined by a veterinarian of Buyer's choosing before purchase.

CLAUSE BOS_WARRANTY.PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
[Pending — state whether a Horse Sale and Purchase Agreement accompanies this Bill of Sale. This placeholder is replaced by the applicable condition language and blocks signing.]

FIELD: TXN.BOS_HAS_SALE_AGREEMENT — label "Accompanying sale agreement", select, choices Yes|No (stored YES|NO), required, owner DEAL (set YES automatically when generated from a sale contract).

## SECTION 6 — key BOS_AGENT, heading "Agent and Dual-Agency Disclosure"

CLAUSE BOS_AGENT.DISCLOSURE — heading NULL, type input, conditional {"equals": ["INCLUDED"], "field_key": "TXN.AGENT_ELECTION"}
BODY:
The following person or entity acted as agent or intermediary in this transaction and receives compensation in connection with it: {{TXN.AGENT_NAME}}, acting on behalf of {{TXN.AGENT_ACTING_FOR}}, receiving compensation of {{TXN.AGENT_COMPENSATION}} paid by {{TXN.AGENT_PAID_BY}}. Where the agent acted on behalf of both Seller and Buyer, each party acknowledges that it received prior written disclosure of, and consented in writing to, the dual agency. The parties acknowledge that under California Business and Professions Code Section 19525, where it applies, an agent receiving compensation in excess of five hundred dollars in connection with the sale of a racing or showing equine must be authorized by a written agreement signed by the party the agent represents, and this Bill of Sale is delivered in satisfaction of the written bill of sale required by that statute.

CLAUSE BOS_AGENT.NONE — heading NULL, type prose, conditional {"equals": ["NOT_INCLUDED"], "field_key": "TXN.AGENT_ELECTION"}
BODY:
No agent or intermediary receives compensation in connection with this transaction.

CLAUSE BOS_AGENT.PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.AGENT_ELECTION"}
BODY:
[Pending — state whether a compensated agent or intermediary participated in this transaction. This placeholder is replaced by the applicable statement and blocks signing.]

FIELDS:
- TXN.AGENT_ELECTION — label "Compensated agent or intermediary", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL. RULE: whenever the company is a compensated intermediary in the transaction (a brokered sale under a transaction-representation retainer), this election must be INCLUDED — the company cannot collect compensation without having provided this disclosure and this bill of sale.
- TXN.AGENT_NAME — text; TXN.AGENT_ACTING_FOR — select, choices Seller|Buyer|Both parties (stored SELLER|BUYER|BOTH); TXN.AGENT_COMPENSATION — text (amount or formula); TXN.AGENT_PAID_BY — select, choices Seller|Buyer|Both parties (stored SELLER|BUYER|BOTH). All owner DEAL, each conditional {"equals": ["INCLUDED"], "field_key": "TXN.AGENT_ELECTION"}, required when shown.

## SECTION 7 — key BOS_GOVERNING, heading "Governing Law"

CLAUSE BOS_GOVERNING.CHOICE — heading NULL, type prose, conditional NULL
BODY:
This Bill of Sale is governed by the laws of the State of California. Any dispute arising out of or relating to this Bill of Sale shall be resolved in the same manner as disputes under the parties' Horse Sale and Purchase Agreement where one exists, and otherwise by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, with the same small-claims and provisional-relief rights stated in that Agreement.

## SECTION 8 — key BOS_SIGNATURES, heading "Signatures"

CLAUSE BOS_SIGNATURES.BLOCK — heading NULL, type prose, conditional NULL
BODY:
IN WITNESS WHEREOF, Seller and Buyer execute this Bill of Sale as of the date first written above.

SELLER
Signature: {{SIG.SELLER.NAME}}
Printed Name: {{SELLER.PRINTED_NAME}}
Date: {{SIG.SELLER.DATE}}

CLAUSE BOS_SIGNATURES.SELLER_CAPACITY — heading NULL, type input, conditional {"equals": ["ENTITY"], "field_key": "SELLER.PARTY_TYPE"}
BODY:
By: {{SELLER.ENTITY_SIGNER_NAME}}
Title: {{SELLER.ENTITY_SIGNER_TITLE}}
Signing on behalf of {{SELLER.FULL_NAME}}

CLAUSE BOS_SIGNATURES.BUYER_BLOCK — heading NULL, type prose, conditional NULL
BODY:
BUYER
Signature: {{SIG.BUYER.NAME}}
Printed Name: {{BUYER.PRINTED_NAME}}
Date: {{SIG.BUYER.DATE}}

CLAUSE BOS_SIGNATURES.BUYER_CAPACITY — heading NULL, type input, conditional {"equals": ["ENTITY"], "field_key": "BUYER.PARTY_TYPE"}
BODY:
By: {{BUYER.ENTITY_SIGNER_NAME}}
Title: {{BUYER.ENTITY_SIGNER_TITLE}}
Signing on behalf of {{BUYER.FULL_NAME}}

CLAUSE BOS_SIGNATURES.COBUYER_BLOCK — heading NULL, type input, conditional {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}
BODY:
CO-BUYER
Signature: {{SIG.COBUYER.NAME}}
Printed Name: {{COBUYER.PRINTED_NAME}}
Date: {{SIG.COBUYER.DATE}}

CLAUSE BOS_SIGNATURES.COBUYER_CAPACITY — heading NULL, type input, conditional {"all": [{"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}, {"equals": ["ENTITY"], "field_key": "COBUYER.PARTY_TYPE"}]}
BODY:
By: {{COBUYER.ENTITY_SIGNER_NAME}}
Title: {{COBUYER.ENTITY_SIGNER_TITLE}}
Signing on behalf of {{COBUYER.FULL_NAME}}

CLAUSE BOS_SIGNATURES.NOTARY — heading "Notary Acknowledgment", type prose, conditional {"equals": ["INCLUDED"], "field_key": "TXN.NOTARY_ELECTION"}
BODY:
State of California, County of _______________. On _______________ before me, _______________, Notary Public, personally appeared _______________, who proved to me on the basis of satisfactory evidence to be the person(s) whose name(s) is/are subscribed to the within instrument and acknowledged to me that he/she/they executed the same in his/her/their authorized capacity(ies), and that by his/her/their signature(s) on the instrument the person(s), or the entity upon behalf of which the person(s) acted, executed the instrument. I certify under PENALTY OF PERJURY under the laws of the State of California that the foregoing paragraph is true and correct. WITNESS my hand and official seal.
Signature: _______________ (Seal)

FIELD: TXN.NOTARY_ELECTION — label "Notary acknowledgment", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL. NOT_INCLUDED renders nothing (notarization is optional for a California horse bill of sale; some registries and out-of-state transfers request it). Note the notary block signs on paper — its blanks stay literal underscores, not tokens.
