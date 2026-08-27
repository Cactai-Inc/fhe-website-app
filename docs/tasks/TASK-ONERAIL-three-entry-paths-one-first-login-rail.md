# TASK-ONERAIL — three entry paths, one first-login rail

Adversarial verification, read-only. You flag; you do not fix. No migrations, no data writes,
no branches beyond your report. Deliverable: docs/reports/TASK-ONERAIL-REPORT.md. If a finding
is severe enough to warrant an immediate fix, it goes in the report ranked as such — routing is
the orchestrator's, not yours.

## Why this task exists

Two reasons, one specific and one structural.

Specific: the OFFERINGDOCS handoff claims apply_category_documents has no caller that turns a
category into paperwork. ORCH4's audit found that claim false — provision_client_invitation
line 135 holds a live PERFORM apply_category_documents(v_contact, v_cats). Whether it still
fires depends on whether v_cats can be non-empty now that ProvisionClientForm stopped ticking
category boxes. Nobody has read that guard. The thread that was near this code (PAMELA) is
closed, so the question is orphaned. You settle it.

Structural, in the owner's words: provisioning, invitation, and document sharing are extremely
complex in this app. The worked example is Pamela — provisioned by staff, had never logged in,
needed to see her contract at first access, but the contract required information that had not
yet been collected from her. Three pathways can put a link in a person's inbox that ends in a
first login: user-initiated account creation with an activation email; admin account creation
with an invitation email; a contract link email. These were harmonized with checks against one
another so that whichever path the person enters through, every step of the first-login flow is
included and executed. The owner's intent: edge cases ride the same rails, so their handling is
built into how the system functions rather than patched per case. Your job is to verify that
this is actually true, in the live system, universally — so the owner does not have to tackle
edge cases individually.

## Grounding reads, one pass

CLAUDE.md in full — especially D17 (reachable), D18 (no second mechanism beside a correct one),
D20 (a state claim in a doc is a hypothesis; query the live body). HANDOFF-OFFERINGDOCS-
2026-08-24.md — the inverted obligation model: paperwork keyed to the offering purchased or the
door entered; service_type_document_requirements; sign_path_document_requirements;
apply_offering_documents; contact_required_documents.disposition (AT_LOGIN / WITH_CONTRACT /
WHEN_READY); tags derived-only. TASK-PAMELA and its report. docs/reference/FLOW-MAP.md and
docs/reference/flows/onboarding.md for the mapped state — hypotheses to verify, not facts to
inherit.

## Question zero — line 135

In the live database, read the current body of provision_client_invitation (pg_get_functiondef;
the repo carries no migrations directory, so the live body is the only truth). Answer three
things with quoted lines: first, can v_cats be non-empty on any current call path — trace every
caller, including api/admin-send-invitation.ts and any other RPC, trigger, or function that
reaches it; second, if it can, what does apply_category_documents assign, and does that
duplicate or conflict with what apply_offering_documents assigns for the same person; third,
the other three references ORCH4 counted as comments — confirm they are comments in the live
bodies too, not just in repo text. Verdict, exactly one of: cannot fire / fires but harmless
(state why) / fires and assigns paperwork (severity-ranked finding).

## The three paths, traced end to end

For each path — A, user-initiated URL signup with activation email; B, admin provision with
invitation email; C, contract link email — produce the full trace: the UI or api entry point,
every db function called in order, every row written (table and the columns that matter), every
email sent and its template, and the first-login experience the path produces — what the person
is asked for, what documents attach and under which disposition, when the contract becomes
visible, and what completes activation. File and line for code, function names and live bodies
for db, template names for email.

## The convergence test

Build the matrix: required first-login steps as rows — information collection the contract
needs, document assignment under the offering model, contract visibility, activation, plus
anything the traces surface — and the three paths as columns. Every required step must be
present and executing on all three paths. Then the harder check, D18's: present via the same
shared mechanism. A step that works on all three paths through three separate implementations
is a finding even if all three currently work — that is the same-rails requirement, and
per-path duplicates are how rails diverge later. Pamela is the acceptance case, run against all
three columns: a person who has never logged in, whose contract needs information not yet
collected, must be asked for that information before or with contract presentation — on every
path, not only the one she actually used.

## Evidence rules

Live db over repo text, always — D20 verbatim: a state claim in a doc is a hypothesis; query
the live function body or the table, then act. Reach is proven by the actual click path or the
actual email link target, not by a function existing (D17). Handoff and report claims are
inherited by nobody: every claim you repeat is one you verified — the false no-caller claim is
the reason this task exists. Every finding cites file and line or db object, plus the query
that showed it.

## Report shape

docs/reports/TASK-ONERAIL-REPORT.md: the line-135 verdict first; the three traces; the matrix;
findings ranked broken / divergent-rails / duplicate-mechanism / verified-good; and a short
list of what the ADMIN-IA re-grounding must know — the People and Documents surfaces are being
re-specced against the offering model, and your traces are input to that.

## Boundaries

Read-only throughout. wt-dealparty is live on task/pagefit for contract layout — stay out. You
do not touch the refactor docs, CLAUDE.md, or any task file; findings go in your report only.
