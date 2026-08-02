INSURANCE RESOLUTION FLOW — SPEC (supersedes the auto-check design)
Owner ruling, 2026-08-01. Applies identically to all three insurance
sections: GL, MORT, MED. Nothing here characterizes what any clause means
legally — clause BODY text and tooltip legal review belong to the contract
review thread's pass; this spec is mechanism only.

THE MODEL
Each insurance section resolves to exactly one of four end-states before
signing:
  1. Lessor has coverage        (TXN.{X}_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)
  2. Lessee has coverage        (TXN.{X}_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)
  3. Lessor responsible         (existing certify TXN.{X}_NOT_REQUIRED = YES)
  4. Lessee responsible         (NEW certify, see below)
When BOTH status fields are NONE and neither certify is checked, the section
is UNRESOLVED: the system alerts both parties, highlights the section, and
blocks signing until one of the two certifies is checked — by the correct
party only.

WHO MAY CHECK WHICH BOX — the core rule
Only the party inheriting responsibility can make the election:
  TXN.{X}_NOT_REQUIRED        checkable by the LESSOR side only
  TXN.{X}_LESSEE_RESPONSIBLE  checkable by the LESSEE side only
Both parties see the alert and the highlighted choices; neither can check
the other's box. Exclusivity: while one is checked, the other renders
disabled; only the checking party can uncheck their own, which re-opens the
choice.
IMPLEMENTATION NOTE, must be honored: enforcement lives in owner_role on the
two certify field defs AND must hold server-side in set_contract_field's
authorization — note that staff currently bypass owner_role checks there.
Because FHE is itself a party on these contracts, the two certify fields
need party-exclusive enforcement that staff status does NOT override; if
that requires a narrow carve-out in the authorization branch for these
fields, that is a DB change to spec explicitly, not to improvise.

DB PARTS (a future DB-thread unit; verify-first protocol as always)
D1. New field def per section: TXN.{X}_LESSEE_RESPONSIBLE — certify,
    section INSURANCE_RISK, required=false, owner_role = the lessee-side
    role, conditional_on:
    {"all":[{"equals":["NONE"],"field_key":"TXN.{X}_LESSOR_STATUS"},
            {"equals":["NONE"],"field_key":"TXN.{X}_LESSEE_STATUS"},
            {"equals":["NO",""],"field_key":"TXN.{X}_NOT_REQUIRED"}]}
    (surfaces only in the unresolved state; the existing certify keeps its
    current availability and behavior).
D2. New clause per section gated {"equals":["YES"],"field_key":"TXN.{X}_LESSEE_RESPONSIBLE"},
    sort adjacent to {X}_NONE. BODY: placeholder pending the legal pass —
    insert as a clearly-bracketed pending body, never draft legal language
    in the DB thread.
D3. Signing gate: extend contract_lock_blockers with one rule per section —
    if both statuses are NONE and neither certify is YES, emit blocker
    "{X} insurance responsibility unresolved — one party must accept it".
    Full CREATE OR REPLACE of the function from its live body; no string
    patching.
D4. Mutual exclusivity server-side: reject setting either certify to YES
    while the other is YES (clear error message naming the conflict).
D5. Notification producer: on the transition INTO the unresolved state
    (second status becoming NONE), insert one notification per party,
    linked to the contract, kind insurance_unresolved, body = the tooltip
    text below; resolver: when either certify flips to YES, resolve that
    contract's insurance_unresolved notifications (use the existing
    resolve-by-link mechanism). Email nudge rides the existing digest.
    Never clear or modify the status values at any point in this flow.

FRONTEND PARTS (a future repo-thread task set)
F1. Unresolved-state rendering: highlight the section, surface both
    certifies side by side with the tooltip, disable the box that isn't
    the viewer's to check (visible, labeled with which party it belongs
    to, not hidden).
F2. Tooltip (also the notification body — procedural copy, final wording
    subject to the legal pass's review):
    "Neither party currently has this coverage. The contract cannot be
    signed until one party accepts financial responsibility for it. Only
    the accepting party can check their box: the Lessor checks the first,
    the Lessee checks the second. Checking a box is that party's election
    and appears in the contract."
F3. Dashboard alert linking to the contract's highlighted section; clears
    when the notification resolves.
F4. Real-time: the highlight and box states update on field change without
    refresh, same channel as other live contract edits.

CONTENT PARTS (contract review thread, at the regeneration gate)
C1. Body for the new Lessee-responsible clause, all three sections.
C2. Review of the existing {X}_NONE election language in light of this
    flow (their earlier finding stands: it must read true in every state
    that renders it).
C3. Tooltip/notification wording sign-off.
C4. Their MORT/MED parity question folds in here — the flow already treats
    all three sections identically.

SEQUENCING
This workstream runs AFTER: the current repo-thread tasks (1,2,4,5), the
regeneration gate, and the legal pass that supplies C1–C3. The DB unit
lands first (D1–D5), then the frontend set (F1–F4), each with its own
done-checks under the standing protocol. Nothing in the current repo
handoff implements any of this — Task 3 there is explicitly removed.
