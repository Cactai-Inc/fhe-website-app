# TASK INVITEWORKS — make the invite flow actually work, end to end

**Owner, 2026-08-11:** *"nothing in the app you built actually works yet. not the invite, not
the paperwork, not the purchasing, not the booking, not the people management"*

**This task is not an audit.** Do not inventory, do not classify, do not report counts. The
deliverable is a working flow.

## The one thing that counts as done

**The owner invites a real person, that person receives the email, clicks the link, creates an
account, and lands on their paperwork.** Start to finish, in a browser, no manual database
work anywhere in the middle.

Anything short of that is not done, however good the code looks.

## Where to start — the flow already half-exists

```
api/admin-send-invitation.ts     the send path
api/register-invited.ts          the redeem path
provision_client_invitation      the canonical provisioning spine (DB)
invitations                      13 sent · 13 revoked · 6 redeemed · 6 accepted · 2 superseded
```

**Walk the whole path yourself before changing anything.** Send an invitation in a rolled-back
transaction, follow every branch, and find where it actually stops. The failure is more likely
to be one broken link than a missing feature — 13 invitations sit `sent` and were never
redeemed.

**`api/admin-send-invitation.ts:229` flattens every failure into a flat string**, so a real
send error is indistinguishable from success. **Fix that first** — you cannot debug a flow
whose errors are erased, and it may be the only reason this looks mysterious.

## Rules

- **Fix the flow, not the symptoms.** If provisioning succeeds but the email never sends, that
  is the bug — do not add a retry button.
- **Distinguish a workaround from a fix.** This project has been bitten by that exact
  distinction before: restoring scroll after a teardown was a workaround; not tearing down was
  the fix.
- **`provision_client_invitation` is the canonical spine.** All account creation goes through
  it. **Do not build a second path.**
- **D1a:** the platform owner (`admin@cactai.io`, `org_id` NULL) is not a tenant member and is
  correctly denied by tenant surfaces. If it blocks you, sign in as the tenant owner. **Do not
  "fix" it by giving that account an org.**
- **THE SIGNING FREEZE IS IN FORCE** — nothing gets signed. Getting a person *to* their
  paperwork is in scope; signing it is not.
- **Report what is broken but out of scope** rather than widening. Paperwork, purchasing and
  booking are separate tasks in the same chain.

## Constraints

Worktree `~/Downloads/claude-code-repo/wt-inviteworks`, branch `task/inviteworks`, off
`origin/main`. **Never `~/Desktop`.** Do not push.

Migrations: **no self-contained `COMMIT;`** — it ends a dry-run wrapper and applies for real.
**Do not create a temp table with a name another migration uses** — two LEASEFIX migrations
both used `_lf` and could not run together, which is part of why that work sat unshipped.

Dry-run, then apply — and **do not leave working code unapplied.** Report to
`docs/reports/TASK-INVITEWORKS-REPORT.md`.
