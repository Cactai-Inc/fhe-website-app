RIDING LESSON ORDER

Order ID: {{ORD.UUID}}
Date: {{DOC.EFFECTIVE_DATE}}

ENGAGEMENT SUMMARY

This order is a request for riding instruction from {{ORG.LEGAL_NAME}} ("COMPANY"). Submission is a request, not a purchase. COMPANY reviews the request and, if approved, issues an approval for payment; the contract is formed upon completion of payment and is summarized in the purchase receipt. This engagement is governed by the Company Policies and the signed documents on file, including the Participant Liability Release, Emergency Medical Authorization, and Property Rules, Safety Acknowledgment, and Equestrian Conduct Agreement. No result, riding level, or outcome is guaranteed.

OFFERING

Service selected: {{ORD.SERVICE_SELECTION}}
Lesson Fee: {{TXN.SERVICE_FEE}}
Multi-Lesson Package: {{TXN.PACKAGE_FEE}}

<!-- CUT-START: JUMPER_TRAINING_SECTION | condition: include only if jumper training is selected -->
JUMPER TRAINING

Jumper training is a distinct offering separate from standard riding lessons, priced at its own rate and available only after COMPANY assesses the rider's ability and authorizes participation. Jumper training requires the signed Jumper Training Addendum on file before the first jumping session.

Jumper Training Fee: {{TXN.JUMPER_TRAINING_FEE}}
<!-- CUT-END: JUMPER_TRAINING_SECTION -->

<!-- CUT-START: MINOR_PARTICIPANT_INFO | condition: include only if PARTICIPANT is a minor -->
PARTICIPANT

This order is for the following minor participant on file:
Name: {{PARTICIPANT.FULL_NAME}}
Date of Birth: {{PARTICIPANT.DOB}}
<!-- CUT-END: MINOR_PARTICIPANT_INFO -->

SCHEDULING REQUEST

Preferred dates and times: {{REQ.PREFERRED_SCHEDULE}}
Location preference (if applicable): {{REQ.LOCATION_PREFERENCE}}
Notes: {{REQ.NOTES}}

Sessions are confirmed as bookings upon approval and payment. Rescheduling, late arrival, weather, and fee terms are set out in the Company Policies.
