# Info-button audit — HORSE_LEASE_V2

Every info bubble in the lease, in the order it appears. 97 in total.

Format:  (Location - "Bubble contents")

KIND tells you what the bubble is attached to:
  SECTION — the section title (the right home for consolidated guidance)
  CLAUSE  — a clause inside a section
  FIELD   — an individual input (these are the ones scattered mid-sentence)

---


CLAUSE   (Parties → PARTIES.INTRO - "The parties to the lease. Owner (Lessor) leases the horse to the Lessee.")
FIELD    (Parties → Lessee is an - "Derived from the Lessee's contact record (company vs person) at creation; override if needed. Drives the entity-specific representations, CCC insurance, and Coordination of Coverage clauses.")

FIELD    (Purpose and Lease Grant → Purpose of the lease - "Unset renders the neutral "For the purposes permitted herein" phrasing.")
FIELD    (Purpose and Lease Grant → Lease type - "Full lease gives the Lessee full-time access and care responsibility. Partial lease is shared or limited; the Owner retains responsibility for the Horse's exercise and use.")

CLAUSE   (Schedule for Lessee's Usage → SCHEDULE.MAIN - "When Lessee may use the horse. Pick a schedule type, and mark specific days on the grid where applicable.")
FIELD    (Schedule for Lessee's Usage → Additional schedule terms - "Describe the usage schedule the parties agree to.")
FIELD    (Schedule for Lessee's Usage → Reserved days of use - "Mark the days of the week reserved for Lessee's use (applies when the schedule is specific days).")

FIELD    (Lease Fee → Lease fee - "Set the initial payment due, then add one or more monthly fee options. When more than one option is present, select the one that applies.")

CLAUSE   (Payment Terms → PAYMENT_TERMS.LATE - "Late fee, interest rate, and the grace period before interest begins to accrue.")

SECTION  (Payment Method - "How the Lessee may pay amounts owed under this Agreement.")
FIELD    (Payment Method → Accepted payment methods - "Select every method the Lessee may use to pay.")
FIELD    (Payment Method → Card processor & instructions - "Name the payment processor and how the Lessee pays (e.g. an invoice with a payment link sent by email or text, a payment URL, etc.).")

CLAUSE   (The Horse → HORSE.IDENTITY - "Identity of the leased horse. Most of this auto-fills from the horse's record.")
CLAUSE   (The Horse → HORSE.OWNERSHIP - "e.g. a lease, community-property spouse, installment purchase, or a prior seller's right of first refusal.")
CLAUSE   (The Horse → HORSE.BEHAVIOR - "Whether the Lessee relies on their own knowledge of the horse's behavior, or the Owner warrants no history of dangerous behavior except as noted.")
CLAUSE   (The Horse → HORSE.CONDITION - "Whether the Lessee relies on their own knowledge of the horse's condition, or the Owner warrants it is sound except as noted.")
CLAUSE   (The Horse → HORSE.VET_CHECK - "ELS recommends a pre-lease vet exam. Choose who arranges and pays for it (the ELS default is the Lessee, but this is a selectable term).")
FIELD    (The Horse → Any limitations on ownership? - "Choose Yes only if there are liens, encumbrances, or other limitations to describe.")
FIELD    (The Horse → Co-owner(s) - "Add Co-Owner")
FIELD    (The Horse → Known condition exceptions - "List any known illnesses, lamenesses, or physical conditions the Lessee should be aware of.")
FIELD    (The Horse → Known behavior exceptions - "List any known behaviors — e.g. biting, kicking, bucking, rearing, bolting, trailer-loading or farrier issues.")
FIELD    (The Horse → Any exceptions to note? - "The Lessor warrants the Horse is sound and in good condition. Choose Yes only to note specific known illnesses, lamenesses, or physical conditions.")
FIELD    (The Horse → Markings - "e.g. blaze, socks, snip")
FIELD    (The Horse → Any exceptions to note? - "The Lessor warrants the Horse has no history of dangerous behavior. Choose Yes only to note specific known behaviors.")
FIELD    (The Horse → Fair market value - "Used to compute liquidated damages if the horse is lost or injured.")

CLAUSE   (Location of Horse → LOCATION.MAIN - "Where Horse is kept during the lease. Choose the Owner's home address or another facility.")
FIELD    (Location of Horse → Horse will move to a new location for the Lessee - "Check yes if the Horse will be kept at a different location during the lease. A location block will appear to fill in manually.")
FIELD    (Location of Horse → Location during lease term - "Facility / place name, full street address, and any notes for locating the Horse — access codes and the property manager's contact information.")
FIELD    (Location of Horse → Facility - "The barn or facility where Horse is kept.")

CLAUSE   (Evaluation Period → EVALUATION.CHOICE - "An optional trial window at the start of the lease during which either party may end the arrangement.")
FIELD    (Evaluation Period → Evaluation period - "Whether an evaluation (trial) period applies. Choose Requested or Required to set its length.")
FIELD    (Evaluation Period → Length - "How long the evaluation period lasts (enter the number first).")
FIELD    (Evaluation Period → Length - "How long the evaluation period lasts (enter the number first).")

CLAUSE   (Agreement Term → TERM.MAIN - "How long the lease runs. A fixed period has a set end date; an open-ended lease continues until terminated.")
CLAUSE   (Agreement Term → TERM.RENEWAL - "Any renewal, extension, or other term arrangement not covered by a simple start and end date.")
FIELD    (Agreement Term → Include renewal terms - "Checking this box adds a renewal-terms clause to the lease. Leaving it unchecked omits it.")
FIELD    (Agreement Term → Add additional terms - "Additional terms")
FIELD    (Agreement Term → Term type - "A fixed period ends on a set date; an open-ended lease continues until either party terminates it.")
FIELD    (Agreement Term → Renewal terms - "Describe any renewal, extension, or other arrangement.")
FIELD    (Agreement Term → Lease end date - "Leave blank for an open-ended lease.")

CLAUSE   (Permitted Use(s) & Restrictions → PERMITTED_USE.MAIN - "Check every activity Lessee is allowed to use the horse for. Any use not checked requires the Owner's written consent.")
CLAUSE   (Permitted Use(s) & Restrictions → TRAINING_LESSONS.LESSONS - "Whether Lessee must take riding lessons as a condition of the lease, and with whom.")
CLAUSE   (Permitted Use(s) & Restrictions → TRAINING_LESSONS.LESSONS_ENTITY - "Whether the entity Lessee may provide riding lessons with the Horse.")
CLAUSE   (Permitted Use(s) & Restrictions → TRAINING_LESSONS.TRAINING - "Whether Horse is in professional training during the lease, and with whom.")
CLAUSE   (Permitted Use(s) & Restrictions → COMPETITIONS.INTRO - "Whether and on what terms the Lessee may compete on the horse.")
CLAUSE   (Permitted Use(s) & Restrictions → PROHIBITED.OTHER - "Any additional activities the Owner wishes to prohibit.")
CLAUSE   (Permitted Use(s) & Restrictions → PROHIBITED.OTHERS - "Who besides the Lessee may ride or handle the horse without asking the Owner.")
FIELD    (Permitted Use(s) & Restrictions → Other persons allowed - "Name the other person(s) allowed to ride or handle the Horse.")
FIELD    (Permitted Use(s) & Restrictions → Lessee required to take lessons? - "Whether Lessee must take riding lessons as a condition of the lease.")
FIELD    (Permitted Use(s) & Restrictions → Additional permitted activities - "Additional activities GRANTED to Lessee beyond the permitted uses in the Permitted Use(s) clause. Anything not granted remains prohibited by the catch-all. Unset or None renders the no-additional-activities statement.")
FIELD    (Permitted Use(s) & Restrictions → Competition expenses - "Who pays the expenses of competing.")
FIELD    (Permitted Use(s) & Restrictions → Permitted activities - "Select every activity the Lessee may do with the Horse. Riding Lessons, Horse Training, Jumping, and Competitions require an approved Trainer to be present.")
FIELD    (Permitted Use(s) & Restrictions → Others allowed to ride - "Select who besides the Lessee may ride or handle the horse without the Owner's permission.")
FIELD    (Permitted Use(s) & Restrictions → Maximum height - "e.g. max feet.")
FIELD    (Permitted Use(s) & Restrictions → Competition winnings - "Who keeps any prize money or winnings.")
FIELD    (Permitted Use(s) & Restrictions → Offsite transport - "Controls whether the Lessee may take the Horse to offsite locations for any reason other than medical care. Riding trails attached to the stated location are not considered offsite.")
FIELD    (Permitted Use(s) & Restrictions → Add Restrictions - "Restrictions on the permitted activities")
FIELD    (Permitted Use(s) & Restrictions → Other additional permitted activity - "An additional activity Lessee is permitted to engage in; restrictions belong in Additional Restrictions.")

CLAUSE   (Horse Care and Expenses → SCHEDULE.CARE_DUTY - "The lease schedule carries a duty of consistent care; 24 hours' notice is required if Lessee cannot make a scheduled day.")
CLAUSE   (Horse Care and Expenses → CARE.SUPPLEMENTS - "Supplements means any medication, vitamin, mineral, or other feed additive Horse regularly receives. List them and identify who administers them.")
CLAUSE   (Horse Care and Expenses → CARE.FARRIER - "Who arranges routine hoof care (trimming and shoeing), and Horse's preferred farrier.")
CLAUSE   (Horse Care and Expenses → CARE.ROUTINE_VET - "Routine Veterinary Care means vaccinations, de-worming, dental care, and other regular preventive treatments provided on a normal schedule. Identify who arranges it and Horse's preferred veterinarian.")
CLAUSE   (Horse Care and Expenses → CARE.PROTECTIVE - "Protective equipment (such as boots or wraps) required for particular activities, and who provides it.")
CLAUSE   (Horse Care and Expenses → CARE.TACK - "Any saddle, bit, bridle, or other tack that must be used with Horse, and who provides it.")
CLAUSE   (Horse Care and Expenses → CARE.RIDER_AIDS - "Artificial aids Lessee may use when riding Horse.")
FIELD    (Horse Care and Expenses → Include 3rd party exercise - "Checking this box adds the clause permitting the Lessee to hire the approved trainer to exercise the Horse. Leaving it unchecked omits that clause.")
FIELD    (Horse Care and Expenses → Include Lessee care & exercise responsibility - "Checking this box adds the care-and-exercise obligation clause to the lease. Leaving it unchecked omits that clause.")
FIELD    (Horse Care and Expenses → Prohibited rider aids - "Select any rider aids the Lessee is prohibited from using. Leave blank if none.")
FIELD    (Horse Care and Expenses → Medications and supplements - "Add each medication or supplement with its dose and schedule, and set the party responsible for administering, for ordering, and for its cost (each can be a different party).")
FIELD    (Horse Care and Expenses → Party responsible for arranging - "Who arranges the 3rd party exercise.")
FIELD    (Horse Care and Expenses → Party responsible for costs - "Who pays for the 3rd party exercise.")
FIELD    (Horse Care and Expenses → Lessee's share of the cost - "Lessee's percentage share of the 3rd party exercise cost; the remainder is the Lessor's.")
FIELD    (Horse Care and Expenses → Veterinarian - "Veterinarian on the horse record.")
FIELD    (Horse Care and Expenses → Farrier - "Farrier on the horse record.")
FIELD    (Horse Care and Expenses → Farrier phone - "Farrier phone on the horse record.")
FIELD    (Horse Care and Expenses → Practice - "Veterinary practice on the horse record.")
FIELD    (Horse Care and Expenses → Address - "Veterinary address on the horse record.")
FIELD    (Horse Care and Expenses → Veterinarian phone - "Veterinarian phone on the horse record.")
FIELD    (Horse Care and Expenses → Horse must wear protective equipment - "Check Yes if the Lessor requires the Horse to wear protective equipment.")
FIELD    (Horse Care and Expenses → Protective equipment - "The protective equipment Horse must wear during those activities.")
FIELD    (Horse Care and Expenses → Is Lessee prohibited from using certain tack or equipment? - "List any tack or equipment the Lessee is prohibited from using.")
FIELD    (Horse Care and Expenses → Other prohibited rider aid - "Describe the other approved rider aid.")

CLAUSE   (Insurance, Risk of Loss, and Indemnification → INSURANCE_RISK.MORTALITY - "Mortality insurance pays out if the Horse dies. Where required, decide who is responsible for obtaining and maintaining the policy.")
CLAUSE   (Insurance, Risk of Loss, and Indemnification → INSURANCE_RISK.RISK_OF_LOSS - "Allocates the risk if the Horse is lost, dies, is stolen, or is injured while on lease.")
CLAUSE   (Insurance, Risk of Loss, and Indemnification → INSURANCE_RISK.ASSUMPTION_INHERENT - "Assumption of the inherent risks of equine activities, grounded in California case law. Under owner review — to be reevaluated.")
CLAUSE   (Insurance, Risk of Loss, and Indemnification → INSURANCE_RISK.RELEASE - "Release of Lessor from claims, including ordinary negligence. Under owner review — to be reevaluated.")
CLAUSE   (Insurance, Risk of Loss, and Indemnification → INSURANCE_RISK.INDEMNIFICATION - "Which party protects the other against third-party claims arising from the lease.")
FIELD    (Insurance, Risk of Loss, and Indemnification → Deductible responsibility (Lessee-responsibility claims) - "Applies only to claims arising from events for which Lessee bears responsibility; other claims leave the deductible with the policyholder.")
FIELD    (Insurance, Risk of Loss, and Indemnification → Split — % paid by Lessor - "Percentage only (no stated amount to anchor a $ split). The other share auto-fills to total 100%.")
FIELD    (Insurance, Risk of Loss, and Indemnification → Split — % paid by Lessee - "Percentage only. The other share auto-fills to total 100%.")

CLAUSE   (Termination → TERMINATION.LESSEE - "How much notice the Lessee must give to end the lease early.")
CLAUSE   (Termination → TERMINATION.OWNER - "How much notice the Owner must give to end the lease early.")
CLAUSE   (Termination → TERMINATION.CAUSE - "Notice period for terminating because the other party is in breach.")
FIELD    (Termination → Days notice - "Days of notice required to terminate for cause.")
FIELD    (Termination → Days notice - "Days of notice the Owner must give to terminate.")
FIELD    (Termination → Days notice - "Days of notice the Lessee must give to terminate.")

CLAUSE   (Governing Law and Venue → GOVERNING_LAW.CHOICE - "The state whose law governs the lease, and the county and state where any lawsuit must be filed.")
