CLAUSE-GATE BATCH — SPEC AND VERIFY-FIRST PROTOCOL
Template: HORSE_LEASE_V2. Every expected condition below is quoted from the
July 31 live dump. Nothing here is to be applied until each item's VERIFY
query returns exactly the expected state; any mismatch comes back as a
finding, not a workaround. Conditions are DATA — a wrong assumption renders
a legally wrong contract silently, so this batch runs row-by-row, not as one
blind migration.

PRINCIPLE GOVERNING THE WHOLE BATCH
"" in a gate is only a bug where "" means "not yet chosen" on a select that
drives clause identity (party type, lease purpose). It is NOT a bug where ""
is a real state: the certify inputs (GL_NOT_REQUIRED etc.) are unchecked=""
by design, and their {"equals":["NO",""]} gates are correct — do not touch
them. The fix pattern for the real bugs: remove "" from the identity gates,
add an explicit PENDING clause gated on {"equals":[""]} so an unset field
renders a visible placeholder instead of silently picking a variant or
rendering nothing, and rely on required=true + contract_lock_blockers to
block signing (documents stay sendable incomplete — owner rule).

═══════════════════════════════════════════════════════════════════
ITEM A — party-type identity gates: remove "", add pending variants
═══════════════════════════════════════════════════════════════════
VERIFY (expected conditional_on, byte-for-byte after jsonb normalization):
  select clause_key, conditional_on from contract_clause_defs
   where template_key='HORSE_LEASE_V2' and clause_key in
   ('LESSEE_REPS.MAIN_INDIVIDUAL','TRAINING_LESSONS.LESSONS',
    'TRAINING_LESSONS.LESSONS_ENTITY','DEFINITIONS.LESSOR_IND',
    'DEFINITIONS.LESSEE_IND','DEFINITIONS.LESSOR_ENT','DEFINITIONS.LESSEE_ENT');
EXPECTED:
  LESSEE_REPS.MAIN_INDIVIDUAL: {"equals": ["INDIVIDUAL", ""], "field_key": "LESSEE.PARTY_TYPE"}
  TRAINING_LESSONS.LESSONS:    {"equals": ["INDIVIDUAL", ""], "field_key": "LESSEE.PARTY_TYPE"}
  TRAINING_LESSONS.LESSONS_ENTITY: {"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}
  DEFINITIONS.LESSOR_IND: {"any": [{"equals": ["INDIVIDUAL", ""], "field_key": "LESSOR.PARTY_TYPE"}]}
  DEFINITIONS.LESSEE_IND: {"any": [{"equals": ["INDIVIDUAL", ""], "field_key": "LESSEE.PARTY_TYPE"}]}
  DEFINITIONS.LESSOR_ENT: {"any": [{"equals": ["ENTITY"], "field_key": "LESSOR.PARTY_TYPE"}]}
  DEFINITIONS.LESSEE_ENT: {"any": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}]}
ALSO VERIFY the two field defs:
  select field_key, required from contract_field_defs
   where template_key='HORSE_LEASE_V2' and field_key in ('LESSEE.PARTY_TYPE','LESSOR.PARTY_TYPE');
EXPECTED: LESSEE.PARTY_TYPE required=t, LESSOR.PARTY_TYPE required=f.

CHANGES on confirmation:
A1. Remove "" from the four individual gates (keep each JSON's existing shape,
    only shrink the equals array):
    LESSEE_REPS.MAIN_INDIVIDUAL → {"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}
    TRAINING_LESSONS.LESSONS    → {"all": [{"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"},
                                           {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}
    DEFINITIONS.LESSOR_IND → {"any": [{"equals": ["INDIVIDUAL"], "field_key": "LESSOR.PARTY_TYPE"}]}
    DEFINITIONS.LESSEE_IND → {"any": [{"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}]}
    Note TRAINING_LESSONS.LESSONS additionally gains the permitted-activities
    gate (a continuous-lesson-enrollment obligation is incoherent when lessons
    aren't a permitted activity). Mirror on the entity sibling:
    TRAINING_LESSONS.LESSONS_ENTITY → {"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                               {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}
A2. Insert four PENDING clauses (new clause_keys, bodies bracketed so they
    read unmistakably as working-copy placeholders and never as terms):
    DEFINITIONS.LESSOR_PENDING  gate {"equals": [""], "field_key": "LESSOR.PARTY_TYPE"}
      body: [Pending — select whether Lessor is an individual or an entity. This
      placeholder is replaced by the applicable definition and blocks signing.]
    DEFINITIONS.LESSEE_PENDING  gate {"equals": [""], "field_key": "LESSEE.PARTY_TYPE"}  (same body pattern)
    LESSEE_REPS.PENDING         gate {"equals": [""], "field_key": "LESSEE.PARTY_TYPE"}
    TRAINING_LESSONS.PENDING    gate {"all": [{"equals": [""], "field_key": "LESSEE.PARTY_TYPE"},
                                              {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}
    sort_order: immediately after the pair each replaces (session picks exact
    values from the live sort_order sequence and reports them).
A3. Set LESSOR.PARTY_TYPE required=true (LESSEE already is). Party fill
    auto-writes both from the contact's company flag, so this only ever
    blocks signing on a contract whose party lacks a linked contact — which
    should block anyway.

═══════════════════════════════════════════════════════════════════
ITEM B — LEASE_PURPOSE: default-to-recreation becomes pending
═══════════════════════════════════════════════════════════════════
VERIFY:
  select clause_key, conditional_on from contract_clause_defs
   where template_key='HORSE_LEASE_V2' and clause_key in ('PURPOSE.RECREATION','PURPOSE.RECREATION_DEFAULT');
EXPECTED:
  PURPOSE.RECREATION: {"equals": ["RECREATIONAL", "INSTRUCTIONAL", "COMPETITION", "COMMERCIAL"], "field_key": "TXN.LEASE_PURPOSE"}
  PURPOSE.RECREATION_DEFAULT: {"equals": [""], "field_key": "TXN.LEASE_PURPOSE"}
  and contract_field_defs TXN.LEASE_PURPOSE required=f.

CHANGES on confirmation:
B1. PURPOSE.RECREATION_DEFAULT: keep clause_key and gate, replace the BODY
    with the bracketed pending placeholder (report current body before
    overwriting — it becomes the pattern reference for what the old default
    said, in case the owner wants that language reachable as an explicit
    selection later).
B2. TXN.LEASE_PURPOSE required=true, so signing blocks while it's unset.
Residual accepted: an out-of-domain value (API misuse past the select UI)
renders neither variant; with required=true and a constrained select this is
unreachable through the product. Documented, not gated — clause_condition_met
has no negation operator and we are not extending it in a data batch.

═══════════════════════════════════════════════════════════════════
ITEM C — TXN.TRAINER_EVAL_CHOICE: out of the warranty clause
═══════════════════════════════════════════════════════════════════
VERIFY (report, don't assume — my evidence is from migrations, and bodies
may have been edited since):
  select field_key, clause_key, section from contract_field_defs
   where template_key='HORSE_LEASE_V2' and field_key='TXN.TRAINER_EVAL_CHOICE';
  select clause_key, body from contract_clause_defs
   where template_key='HORSE_LEASE_V2' and clause_key in ('HORSE.WARRANTY','HORSE.TRAINER_EVAL');
EXPECTED SHAPE: the warranty body ends with (and possibly contains TWICE —
two different migrations appended it) the fragment
  'Professional suitability evaluation: {{TXN.TRAINER_EVAL_CHOICE}}'
and HORSE.TRAINER_EVAL exists as its own clause.

CHANGES on confirmation, with both current bodies pasted back first:
C1. Strip every occurrence of the token sentence (and its leading newline)
    from HORSE.WARRANTY's body.
C2. Ensure HORSE.TRAINER_EVAL's body carries the evaluation line with the
    token; if its body already covers the topic, integrate rather than
    duplicate — paste proposed final bodies for approval before UPDATE.
C3. Point the field def's clause_key at HORSE.TRAINER_EVAL.

═══════════════════════════════════════════════════════════════════
ITEM D — evaluation date variants: explicit mode instead of
         excluded-by-the-other's-empty-field
═══════════════════════════════════════════════════════════════════
VERIFY:
  select clause_key, conditional_on from contract_clause_defs
   where template_key='HORSE_LEASE_V2' and section_key='EVALUATION' order by sort_order;
EXPECTED:
  EVALUATION.CHOICE          (no condition)
  EVALUATION.DATES_INCLUDED: {"all": [{"equals": ["REQUESTED", "REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"}, {"gte": 1, "field_key": "TXN.EVAL_INCLUDED_LENGTH"}, {"equals": [""], "field_key": "TXN.EVAL_FIXED_LENGTH"}]}
  EVALUATION.DATES_FIXED:    {"all": [{"equals": ["REQUESTED", "REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"}, {"gte": 1, "field_key": "TXN.EVAL_FIXED_LENGTH"}]}
  EVALUATION.REFUSED / EVALUATION.WAIVED: any-equals on REFUSED / WAIVED.

CHANGES on confirmation:
D1. New field def TXN.EVAL_PERIOD_TYPE — select, section EVALUATION,
    clause_key EVALUATION.CHOICE, required=false, options
    [{label:'Included within the lease term', value:'INCLUDED'},
     {label:'Fixed evaluation period before the term', value:'FIXED'}],
    conditional_on {"equals": ["REQUESTED","REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"}.
D2. Regate the variants on the explicit mode, keeping the data-completeness
    checks:
    DATES_INCLUDED → {"all": [{"equals": ["REQUESTED","REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"},
                              {"equals": ["INCLUDED"], "field_key": "TXN.EVAL_PERIOD_TYPE"},
                              {"gte": 1, "field_key": "TXN.EVAL_INCLUDED_LENGTH"}]}
    DATES_FIXED    → {"all": [{"equals": ["REQUESTED","REQUIRED"], "field_key": "TXN.EVALUATION_ENABLED"},
                              {"equals": ["FIXED"], "field_key": "TXN.EVAL_PERIOD_TYPE"},
                              {"gte": 1, "field_key": "TXN.EVAL_FIXED_LENGTH"}]}
D3. The two length fields gain conditional_on tying each to its mode, so the
    editor only surfaces the relevant one:
    TXN.EVAL_INCLUDED_LENGTH → {"equals": ["INCLUDED"], "field_key": "TXN.EVAL_PERIOD_TYPE"}
    TXN.EVAL_FIXED_LENGTH    → {"equals": ["FIXED"],    "field_key": "TXN.EVAL_PERIOD_TYPE"}
    (VERIFY first that neither currently carries a conditional_on that this
    would overwrite — report if so.)

═══════════════════════════════════════════════════════════════════
ITEM E — GL no-coverage fallback: HELD pending exact keys
═══════════════════════════════════════════════════════════════════
I do not have the GL/MORT/MED status field keys or their option values, and
this item is not written until they're supplied. Session: run and return
  select field_key, input_kind, options, conditional_on from contract_field_defs
   where template_key='HORSE_LEASE_V2' and section='INSURANCE_RISK' order by sort_order;
plus the INSURANCE_RISK clause list with conditions. With that in hand I'll
spec the fallback clause (risk allocation when GL is not certified-unnecessary
and both parties' status is does-not-have-and-will-not-obtain) against the
real vocabulary — expressible as all[equals] only if the status options are
what the review thread implied; if it needs "neither has coverage" as a
negation, the clause gets restructured instead of the operator extended.

═══════════════════════════════════════════════════════════════════
ITEM F — NONE exclusivity: DECIDED — input-level, gate unchanged
═══════════════════════════════════════════════════════════════════
Decision with reasoning, closing the open design question:
PROHIBITED.OTHER_NONE keeps {"equals": ["", "NONE"]}. Its equals-on-the-raw-
CSV semantics are exactly right: the none-clause should render only when the
selection is exactly NONE or nothing. Switching it to contains would render
the none-clause AND the activity clauses simultaneously for a NONE+BREEDING
selection — a self-contradicting contract. The invalid state (NONE combined
with anything) is killed at the input instead: in the buttons input kind,
selecting a NONE-valued option clears all others and selecting any other
clears NONE. That's a frontend change (ContractCascade's buttons handler),
generic to every multi-select that carries a NONE option (TXN.ADDITIONAL_ACTIVITIES,
TXN.OTHERS_ALLOWED today), and it lands with the repo work stream, not this
data batch. Until it ships, the equals gate already fails safe: a mixed
selection renders the activity clauses and suppresses the none-clause.

═══════════════════════════════════════════════════════════════════
ORDER, NAMING, AND THE GATE AFTER
═══════════════════════════════════════════════════════════════════
FILENAME COLLISION — before anything else: the revoke migration took
20260801010000, which is the same timestamp my Stage A community-channels
file carries. Rename Stage A to 20260801020000_community_channels_stage_a.sql
when applying, and this batch takes 20260801030000. One journal, unique
ordered stamps.

Apply order: A → B → C → D (E when keys return, F in the repo stream).
After each item: re-run its VERIFY, confirm the new state matches this spec
byte-for-byte, and regenerate the merged body of the one live draft to
confirm no unrelated clause appeared or vanished (diff the clause-key set
rendered before vs after — only the keys this spec names may change state).
When A–D are in: the regeneration gate — fresh sample with FHE's contact
marked as a company and deliberate selections, fresh DB extract for the
review thread, and the legal items 8–15 proceed against that.
