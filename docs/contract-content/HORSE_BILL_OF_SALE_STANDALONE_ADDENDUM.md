# HORSE_BILL_OF_SALE — standalone-posture addendum (2026-08-03)

Stage 0 of the deal plan (L15–L19). Amends the live HORSE_BILL_OF_SALE template so
that the STANDALONE posture (`TXN.BOS_HAS_SALE_AGREEMENT = NO`) is a
self-supporting contract for a California horse sale, per owner direction: the
dual-signed bill of sale IS the contract; a separate purchase-and-sale agreement
is optional and uncommon.

Source of the merged language: HORSE_SALE_V2's already-vetted clause bodies
(disclosures §3, risk/release §9, delivery §8, governing law §14), rewritten to
stand on the bill of sale's own terms. TWO substantive rewrites were required
because the bill of sale defines neither term used by the agreement:

- **"Closing"** — undefined here. In a bill of sale the operative moment is
  DELIVERY, so every "at/after Closing" becomes delivery-referenced.
- **"Seller Parties"** — undefined here. The standalone release names its
  released parties inline rather than importing a defined term.

Conventions unchanged: exact conditional_on JSON per conditional, NULL when
unconditional, prose/input clause_type, sections at listed order × 10, clauses at
10, 20, 30… within their section.

---

## CHANGE 1 — REMOVE the notary election and block (L15)

DELETE clause `BOS_SIGNATURES.NOTARY` and field def `TXN.NOTARY_ELECTION`.
Notarization is not used on our paperwork. It returns with the sworn-affidavit
document (deferred — not in this build).

---

## CHANGE 2 — REVISE `BOS_WARRANTY.CONDITION_STANDALONE` (L19)

The as-is disclaimer stays and is never toggled off, but it must carve out the
express representations added by CHANGE 3 — otherwise, under UCC §2-316, a
disclaimer of "all warranties, express or implied" sitting beside express
representations is resolved against the seller and denied effect.

CLAUSE BOS_WARRANTY.CONDITION_STANDALONE — heading NULL, type prose, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
Except for the warranty of title above and the representations expressly stated in this Bill of Sale, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit claims arising from fraud or from breach of the express representations stated in this Bill of Sale. Buyer acknowledges the opportunity to have the Horse examined by a veterinarian of Buyer's choosing before purchase.

---

## CHANGE 3 — NEW SECTION: Seller's Disclosures (L18.1, REQUIRED)

New section, key BOS_DISCLOSURES, heading "Seller's Disclosures", sort_order 45
(between Warranty of Title; Condition at 50 — see note). Placed BEFORE the
warranty section so the as-is carve-out in CHANGE 2 refers to representations the
reader has already seen.

NOTE ON ORDERING: existing sections are 10/20/30/40/50/60/70/80. This section
takes sort_order 45, landing after Conveyance (40) and before Warranty (50).

Every clause in this section is conditional on the standalone posture — in the
accompanied posture the agreement carries these disclosures.

CLAUSE BOS_DISCLOSURES.HEALTH — heading "Health and Condition Disclosures", type input, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions, injuries, lameness history, surgeries, allergies, current and past medications, behavioral issues, vices, and prior veterinary concerns, as follows: {{TXN.KNOWN_CONDITIONS}}. Seller represents that these disclosures are true and complete to Seller's knowledge as of the date of this Bill of Sale.

CLAUSE BOS_DISCLOSURES.BEHAVIOR — heading "Behavior", type prose, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
Seller represents that, to Seller's knowledge, the Horse has no history of dangerous or vicious behavior as of the date of this Bill of Sale, except as disclosed in this Bill of Sale.

CLAUSE BOS_DISCLOSURES.INJURY_NONE — heading "No Serious Injury History", type prose, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["NO"], "field_key": "TXN.INJURY_HISTORY"}]}
BODY:
Seller represents that, to Seller's knowledge, no person or animal has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.

CLAUSE BOS_DISCLOSURES.INJURY_DISCLOSED — heading "Serious Injury History Disclosed", type input, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}]}
BODY:
Seller discloses that one or more persons or animals have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Buyer acknowledges this disclosure and proceeds with knowledge of it.

CLAUSE BOS_DISCLOSURES.INJURY_PENDING — heading NULL, type prose, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": [""], "field_key": "TXN.INJURY_HISTORY"}]}
BODY:
[Pending — state whether anyone or any animal has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]

CLAUSE BOS_DISCLOSURES.ENCUMBRANCES — heading "Disclosed Encumbrances and Interests", type input, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.HAS_ENCUMBRANCES"}]}
BODY:
Seller discloses the following liens, leases, co-ownership interests, or other encumbrances affecting the Horse, each of which is released or satisfied at or before delivery unless expressly stated otherwise: {{TXN.DISCLOSED_ENCUMBRANCES}}

CLAUSE BOS_DISCLOSURES.ENCUMBRANCES_PENDING — heading NULL, type prose, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": [""], "field_key": "TXN.HAS_ENCUMBRANCES"}]}
BODY:
[Pending — state whether any liens, leases, or other encumbrances affect the Horse. This placeholder is replaced by the applicable statement and blocks signing.]

FIELDS (all owner SELLER, all conditional on the standalone posture so they do not
appear in the accompanied posture where the agreement owns them):
- TXN.KNOWN_CONDITIONS — label "Known conditions and history", longtext, required, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, clause BOS_DISCLOSURES.HEALTH. Seeded from the horse record's known-conditions data.
- TXN.INJURY_HISTORY — label "Has anyone or any animal been seriously injured by the Horse's direct actions?", select, choices Yes|No (stored YES|NO), required, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, clause BOS_DISCLOSURES.INJURY_PENDING (the pending clause, so an unanswered gate is required-on-a-visible-clause and blocks locking).
- TXN.INJURY_HISTORY_DETAILS — label "Injury history details", longtext, required when shown, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}]}, clause BOS_DISCLOSURES.INJURY_DISCLOSED.
- TXN.HAS_ENCUMBRANCES — label "Any liens, leases, or other encumbrances?", select, choices Yes|No (stored YES|NO), required, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, clause BOS_DISCLOSURES.ENCUMBRANCES_PENDING.
- TXN.DISCLOSED_ENCUMBRANCES — label "Encumbrance details", longtext, required when shown, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.HAS_ENCUMBRANCES"}]}, clause BOS_DISCLOSURES.ENCUMBRANCES.

---

## CHANGE 4 — NEW SECTION: Delivery and Risk of Loss (L18.3, REQUIRED)

New section, key BOS_DELIVERY, heading "Delivery and Risk of Loss", sort_order 55
(after Warranty at 50, before Agent at 60). Standalone posture only.

CLAUSE BOS_DELIVERY.TERMS — heading "Delivery", type input, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
The Horse is delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}. Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}. If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller's delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day.

CLAUSE BOS_DELIVERY.RISK — heading "Transfer of Title and Risk", type prose, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
Title to the Horse passes to Buyer as provided in the Conveyance section above, and risk of loss of or injury to the Horse passes to Buyer upon delivery. This executed Bill of Sale constitutes the instrument of transfer for the Horse, and Seller shall execute any additional transfer document reasonably required by a breed registry, microchip registry, or passport authority.

CLAUSE BOS_DELIVERY.PAPERS — heading "Registration and Transfer Documents", type input, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
At delivery (or, where installment payment applies, upon payment in full), Seller shall deliver to Buyer the Horse's registration papers, passport, and any transfer forms required to record the change of ownership, executed by Seller where signature is required. Each party shall cooperate to complete breed registry, microchip registry, and passport transfers promptly, with recording fees paid by {{TXN.TRANSFER_FEES_RESPONSIBLE}}.

FIELDS (all owner DEAL, all conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, required when shown; same defs/shapes as HORSE_SALE_V2's):
TXN.DELIVERY_LOCATION (text) · TXN.DELIVERY_DATE (date) · TXN.TRANSPORT_RESPONSIBLE (select Buyer|Seller stored BUYER|SELLER) · TXN.TRANSPORT_COST_RESPONSIBLE (same) · TXN.BOARD_RATE_AFTER (currency) · TXN.TRANSFER_FEES_RESPONSIBLE (select Buyer|Seller stored BUYER|SELLER).

---

## CHANGE 5 — NEW SECTION: Release of Claims (L18.2, ELECTIVE)

New section, key BOS_RELEASE, heading "Release of Claims", sort_order 57 (after
Delivery at 55, before Agent at 60). Standalone posture AND elected only.

**Owner ruling — no declined body.** When the election is NOT_INCLUDED this
section renders NOTHING: no reference, no placeholder, no trace in the finished or
signed document. This is a deliberate DEPARTURE from the convention used by every
other election in this document set (which prints a "considered and declined"
sentence). Recorded so a future reader does not "fix" it.

"Seller Parties" is undefined in this document, so the released parties are named
inline rather than importing the agreement's defined term.

CLAUSE BOS_RELEASE.BUYER — heading "Release by Buyer", type prose, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["INCLUDED"], "field_key": "TXN.BOS_RELEASE_ELECTION"}]}
BODY:
Buyer, on behalf of Buyer and anyone claiming by, through, or under Buyer, completely releases, forever discharges, and agrees to hold harmless Seller and Seller's family members, employees, agents, contractors, successors, and assigns, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Buyer's examination, trial, handling, riding, or transport of the Horse before delivery, whether caused by the ordinary negligence of any released party or otherwise, and from any and all claims arising after delivery relating to the Horse's condition, soundness, behavior, suitability, or value. This release does not apply to gross negligence, reckless conduct, intentional misconduct, fraud, or breach of the express representations stated in this Bill of Sale.

CLAUSE BOS_RELEASE.POST_DELIVERY — heading "Post-Delivery Responsibility", type prose, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["INCLUDED"], "field_key": "TXN.BOS_RELEASE_ELECTION"}]}
BODY:
From and after delivery, the Horse and its actions, behavior, care, and condition are the sole responsibility of Buyer, and Buyer shall indemnify, defend, and hold harmless Seller and Seller's family members, employees, agents, contractors, successors, and assigns from and against any claim, damage, loss, liability, cost, or expense arising out of the Horse or its use, handling, care, or possession after delivery, except to the extent caused by the gross negligence, reckless conduct, intentional misconduct, or fraud of a released party or by breach of the express representations stated in this Bill of Sale.

CLAUSE BOS_RELEASE.WAIVER_UNKNOWN — heading "Waiver of Unknown Claims", type prose, conditional {"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["INCLUDED"], "field_key": "TXN.BOS_RELEASE_ELECTION"}]}
BODY:
Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Bill of Sale that the waiving party does not know or suspect to exist in its favor at the time of this Bill of Sale. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Bill of Sale. This waiver does not apply to claims arising from fraud or from breach of the express representations stated in this Bill of Sale.

FIELD: TXN.BOS_RELEASE_ELECTION — label "Release of claims and waiver of unknown claims", select, choices Included|Not included (stored INCLUDED|NOT_INCLUDED), required, owner DEAL, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, clause BOS_RELEASE.BUYER. NOT_INCLUDED renders nothing at all.

---

## CHANGE 6 — REVISE `BOS_GOVERNING.CHOICE` (L18.4, DEFECT FIX)

The live clause defers to "the parties' Horse Sale and Purchase Agreement" for the
small-claims and provisional-relief rights, leaving those rights UNDEFINED when no
agreement exists — a real defect in the standalone posture. Replaced with two
posture-specific clauses.

CLAUSE BOS_GOVERNING.CHOICE — heading NULL, type prose, conditional {"equals": ["YES"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
This Bill of Sale is governed by the laws of the State of California. Any dispute arising out of or relating to this Bill of Sale shall be resolved in the same manner as disputes under the parties' Horse Sale and Purchase Agreement, with the same small-claims and provisional-relief rights stated in that Agreement.

CLAUSE BOS_GOVERNING.STANDALONE — heading NULL, type prose, conditional {"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
This Bill of Sale is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Bill of Sale or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.

CLAUSE BOS_GOVERNING.PENDING — heading NULL, type prose, conditional {"equals": [""], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
[Pending — state whether a Horse Sale and Purchase Agreement accompanies this Bill of Sale. This placeholder is replaced by the applicable governing-law terms and blocks signing.]

---

## CHANGE 7 — REVISE `BOS_WARRANTY.CONDITION_XREF` (consistency)

The accompanied posture's cross-reference is unchanged in substance; it is quoted
here verbatim as the no-change baseline for byte verification.

CLAUSE BOS_WARRANTY.CONDITION_XREF — heading NULL, type prose, conditional {"equals": ["YES"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}
BODY:
The Horse is conveyed subject to, and with the benefit of, the representations, disclosures, disclaimers of warranty, releases, and other terms of the parties' Horse Sale and Purchase Agreement of even or prior date, which remains in full force. In the event of a conflict between this Bill of Sale and that Agreement, that Agreement controls.
