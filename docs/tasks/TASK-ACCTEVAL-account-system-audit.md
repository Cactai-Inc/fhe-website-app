# TASK ACCTEVAL — account system audit

**This is an AUDIT. You will not change any code, and you will not propose a design.**

The owner is planning a refactor of the account system and wants **ground truth first**,
uncontaminated by anyone else's proposed direction. They already have a shape in mind.
Your job is to tell them exactly what exists, what is split, what is fake, and what
leaks — nothing more.

---

## The one rule that matters most

**Report findings. Do not recommend.**

The line, precisely:

| Allowed — a finding | Not allowed — a recommendation |
|---|---|
| "`bio` is written by X and read by Y and Z." | "`bio` should move to `contacts`." |
| "These three checkboxes have no write path; toggling them persists nothing." | "Build a notification preferences table." |
| "`member_directory` exposes `contacts.mobile` gated only by `hide_mobile`, and no UI sets that flag." | "Add a privacy toggle to the account page." |
| "Reaching X takes three clicks: A → B → C." | "X should be two clicks." |
| "The same value is editable in two places, which can diverge." | "Consolidate these two editors." |

Stating that something is **broken, duplicated, unreachable, or dishonest is a finding**
and is wanted. Stating **what to do about it is not.** If you find yourself writing
"should", "recommend", "consider", or "instead", delete the sentence.

If something is so severe you believe it needs immediate attention, put it in a short
**"Flagged as urgent"** list with the factual consequence stated (e.g. "this data is
visible to all members and no control exists to prevent it") — still without prescribing
a fix.

---

## Scope

Everything that **reads or writes the same underlying account data** — not just the
account page. Split systems hide at the edges, not in the middle. Known surfaces, and
find any others:

- `/app/account` — the four sections from TASK-PROFILE (Profile, Preferences, Account
  information, Login & security)
- **Onboarding** — writes emergency contacts and identity fields directly at signing
  (`DocsParticipantFlow.tsx` / `Onboarding.tsx` → `sign-release.ts` → `api-public.ts`)
- **`ContactDossierModal`** — the staff-side view of the same person
- **`member_directory`** — publishes a subset to the community
- **The avatar menu** — what it exposes and where it routes
- Any other reader or writer you discover: RPCs, triggers, edge functions, seeds

## Depth

The audit **includes the data model**, not just the interface.

`contacts` holds person-facts, `profiles` holds login-facts. Determine whether that
boundary is actually held, or whether facts have leaked across it. Map every account-ish
field to: which table, who writes it, who reads it, whether it is duplicated, and whether
the two copies can diverge.

**Coordinate, do not contradict.** `docs/IDENTITY_MODEL_DESIGN.md` describes ratified
identity work (`is_tenant`, freed `is_company`, `contact_affiliations`, phases P1–P5).
Read it first. Where your findings touch that model, say so explicitly and note whether
what you found is consistent with it or in tension with it. Do not re-litigate it.

---

## What to produce

A findings report covering at minimum:

1. **Field map.** Every account field: table, column, who writes, who reads, and whether
   another copy exists. A table is the right format.
2. **Duplication and divergence.** Same fact in two places. State whether the two paths
   can produce different values, and how.
3. **Fake or dead surfaces.** Controls that appear functional but persist nothing;
   displayed data that is seeded rather than real; fields nothing reads; UI nothing
   writes. *(Precedent: the Preferences notification checkboxes were `defaultChecked`
   with no read/write wiring — they did nothing, on every account, forever. `SavedPanel`
   had the same class of problem. Assume more exist.)*
4. **Exposure.** Data reaching other users, and what governs it. *(Known: `member_directory`
   exposes the legacy `contacts.mobile` / `.whatsapp` / `.email` columns gated only by
   `hide_mobile` / `hide_whatsapp` / `hide_email` — flags with no UI to set them.
   Confirm, and find the rest.)*
5. **Click depth.** For each account task a user can perform, the actual click path.
   Count them. Note anything behind an inner page.
6. **Permission reality.** Which fields staff can see or edit versus the member, and
   whether that matches what the UI implies.
7. **What you could not determine**, and why.

---

## Constraints

- **Read-only.** No migrations, no writes, no schema changes. `SELECT` and `\d` only
  against production.
- **No code changes.** Not even obvious fixes. If you find something trivially broken,
  report it; do not repair it.
- **`ClauseDocument.tsx` is FROZEN** and out of scope regardless.
- Work in your **own git worktree** — the shared checkout gets clobbered by parallel
  threads. Your branch will contain only the report.
- Sarah's document `704c8d2d-…` is a live negotiation: read-only, never write.

## Reporting

Write `docs/reports/TASK-ACCTEVAL-REPORT.md`.

State plainly what you verified with your own eyes versus what you inferred. Quote real
query output for structural claims. If you could not verify something, say so — an honest
gap is worth more than a confident guess, and a wrong "finding" here will be built on.

**Do not end the report with recommendations, next steps, or a proposed plan.**
