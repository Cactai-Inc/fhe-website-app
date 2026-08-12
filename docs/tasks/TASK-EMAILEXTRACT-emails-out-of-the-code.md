# TASK EMAILEXTRACT — get the email content out of the code so it can be edited

**Plan of attack item 10.** **This is a D13 task**: *a feature is not done if changing it
requires a developer.* Today, changing a single word in any email the app sends requires editing
TypeScript and deploying.

**Owner ruling (D12):** *"the email templates will use the same concept as a document engine,
only difference is the output type."* **Emails are DOCUMENTS with a delivery output. There is no
third engine.**

---

# MEASURED 2026-08-12

**19 files under `api/` compose an email.** Every subject line and every body is hardcoded.

```
admin-send-invitation · admin-resend-invitation · invitation-resend-request
contract-invite · contract-voided · contract-change-requests-submitted
deliver-document · deliver-documents · deliver-my-document · deliver-evaluation-report
delete-document-with-copy · email-change-start · email-change-complete
request-received · support-received · notifications-nudge · calendar-reminders
delivery-sweep · admin-provision-tenant
```

**This task EXTRACTS. It does not build the editor.** The Document engine (item 12) edits what
this produces. **Extraction has to happen first, and it is the harder half** — an editor over
nothing is useless.

---

# WHAT TO BUILD

## 1. Inventory every email before changing one

For each of the 19: **what triggers it · who receives it · its subject · its body · every
dynamic value it interpolates · whether it is transactional or a notification.**

**Put the inventory in the report first.** Several of these may be dead — a sender nothing calls
is a finding, and this project has form: `AdminFormsPage` writes to a column no renderer reads,
and 23 form definitions are consumed by nothing.

**Check each one has a live caller.** Report the dead ones; **do not delete them.**

## 2. The dynamic values ARE tokens — reuse the library, do not invent a second one

`template_tokens` holds **307 tokens**, and `TASK-TOKENAUDIT` has just written a description for
every one. Each email's interpolated values map onto that vocabulary — recipient name, document
title, org identity, links.

**⚠️ Do NOT create an email-specific token namespace.** One token library. Where an email needs
something the library lacks, **add a row to `template_tokens`** with a description, exactly as
TOKENAUDIT established.

**Read `docs/reports/TASK-TOKENAUDIT-REPORT.md` first** — it answers whether `source_table` is
how a token resolves or merely documents it, and that determines how an email body resolves its
values.

## 3. Where the content lands

**Follow D12's ruling: emails are documents.** So the natural home is the existing
`contract_templates` family with a delivery output — **not a new `email_templates` table.**

**But verify that before committing to it.** An email has properties a contract does not: a
subject line, a recipient rule, a plain-text alternative, a from-address. **If the existing shape
genuinely cannot hold those, say so with evidence** — the owner's constraint is *the tool fits
the architecture*, and stretching a table until it breaks is not fitting.

**Whichever you choose, state it and why in the report's first paragraph.**

## 4. Behaviour must be identical

**This is a refactor. Not one recipient may notice.**

- Same subject, same body, same recipients, same triggers.
- **Prove it**: for each of the 19, render the extracted version and the current version with the
  same inputs and **diff them**. Paste the diffs. **Any difference is a defect unless the owner
  approved it.**
- **THE SIGNING FREEZE IS IN FORCE**, and several of these are document-delivery emails. **Do
  not send test email to a real contact.**

## 5. The 6-hour guard stays

There is a **hard guard against the 6-hour email bug** in the invitation path. **Find it, keep
it, and say where it ended up.** Losing it in a refactor would resurrect a bug the owner has
already paid for.

---

# OUT OF SCOPE — report, do not build

- **The editor.** Item 12.
- **Any new email.** Extract what exists.
- **Sign-by-email / magic-link signing.** Recorded in
  `docs/reference/TEMPLATE-ENGINES-DELTA-2026-08-12.md`; it is its own work and the signing
  freeze covers it.
- **D9 is settled: there is NO welcome email and NO dunning email.** Both producers were deleted
  deliberately. **If you find either, that is a finding — do not restore it.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-emailextract`, branch `task/emailextract`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`TASK-TEXTEDIT` owns `contract_clause_defs` and the template editor surface.** If your
  content lands in the same family, **coordinate — you own the email rows, it owns the editing
  UI.** Rebase before you finish.
- **Delete nothing**, including senders you find to be dead.
- **`api/` is serverless — `npm run typecheck:api` must pass**, and it is a separate tsconfig
  from the frontend. Run both.
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.**
- **`test:db` is broken** (60 of 68 files fail) — do not cite it as proof.
- No staff browser session exists. **Do not send live email to prove anything.** Render and diff.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. All **19** senders inventoried — trigger, recipient, subject, body, dynamic values — with
   dead ones named and kept.
2. Every email's content lives in data, and **changing a word requires no code edit and no
   deploy.**
3. **Rendered output is byte-identical** to today's for all 19, proven by pasted diffs.
4. Dynamic values use `template_tokens`; **no second token namespace exists.**
5. The 6-hour invitation guard is intact and its location stated.
6. `npm run typecheck` and `npm run typecheck:api` both pass.

Report to `docs/reports/TASK-EMAILEXTRACT-REPORT.md`.
