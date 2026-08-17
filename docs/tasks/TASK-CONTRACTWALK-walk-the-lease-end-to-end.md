# TASK CONTRACTWALK — walk a lease from invitation to executed, and report what breaks

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Delicate: it impersonates two different users
against production inside rolled-back transactions, and a mistake here writes to live data.

⚠️ **THIS IS A WALK, NOT A BUILD. YOU FIX NOTHING.** Every break, gap, misleading message or dead
surface is **reported**, not patched. A walk that starts repairing things stops being a walk, and
the owner loses the map he asked for. **The only artefact you produce is the report.**

**HOW TO RUN:** everything is in this file · **all DB work inside `BEGIN … ROLLBACK`** ·
report to `docs/reports/TASK-CONTRACTWALK-REPORT.md` · commit, **do not push** · no subagents.

---

# WHY NOW

**Owner, 2026-08-17:** *"we need to run the lease contract flow… does the invite for a deal only
category party have what it needs? when they click the link in their email what happens next? walk
me through their flow as the code actually dictates it will happen."*

**Production holds ZERO contracts** after the 2026-08-17 test-data purge. There has never been a
cleaner moment to exercise this: nothing to disentangle from test residue, and no risk of confusing
a real client's paperwork with a probe.

**What the owner already knows works:** adding a person, adding a horse, creating a lease — all as
admin. **The unknown is everything on the other party's side.**

---

# THE PATH THE ORCHESTRATOR ALREADY TRACED — verify each claim, do not trust it

Traced from live function bodies on 2026-08-17. **Re-verify; correct anything wrong in the report.**

| step | what the code does |
|---|---|
| provision | `CATEGORY_TOKEN` maps **Deal client → `GUEST`** (`groups.group_type` has no fifth value). Paperwork is keyed on the DISPLAY category: **Deal client ⇒ `RELEASE_GENERAL` only** |
| invite | token minted, `expires_at` from `invitation_expiry_days(org)`, **prior invitations superseded** so one live token exists |
| click | `/activate` → `Register` → password or Google OAuth → `redeem_invitation` (requires `status='sent'` AND `expires_at > now()`) → `members` row, invitation `redeemed`, originating request `converted` |
| next screen | `my_onboarding_state`: **`horse_needed` = FALSE** for a deal client · profile gate = **phone + date_of_birth + emergency_contact_1_name + emergency_contact_1_phone** · documents = `RELEASE_GENERAL` |
| signing | `lock_and_sign_contract` → `record_signature` |
| execution | when signatures ≥ signers: `status='EXECUTED'`, `workflow_state='executed'`, `effective_date`, `execution_hash`, template version frozen |

## The five gates in `lock_and_sign_contract` — PROVE EACH ONE REFUSES
1. `auth.uid()` present — else *"authentication required"*
2. **Document is `locked`** — else *"document is not ready to sign (workflow_state=…); lock it first"*
3. **Zero open change requests** — else *"cannot sign: N open change request(s) remain"*
4. **No required `contract_fields` empty** — else *"cannot sign: N required field(s) still empty"*
5. **`LESSEE.PARTY_TYPE` matches the party record** (person vs company)
6. ⚠️ **The horse section is confirmed by the Lessor** — *"cannot sign: the horse information has not
   been confirmed by the Lessor"*

⚠️ **Gate 6 is the owner's most likely real-world stall**: fields all look complete, the lessee still
cannot sign, and the message names a step admin may not know they owe. **Establish exactly which
admin action satisfies it and how discoverable that action is from the staff UI.**

---

# HOW TO WALK IT WITHOUT TOUCHING PRODUCTION

**Everything inside `BEGIN … ROLLBACK`.** ⚠️ **Never `COMMIT`.** Prove the rollback by re-querying
the row counts afterwards and showing them unchanged.

**`auth.uid()` is NULL on the psql connection**, so signing would fail at gate 1 for the wrong
reason. **Impersonate inside the transaction** — set the request JWT claims so `auth.uid()` returns
the party's user id, the same technique used to test RLS. **You must impersonate TWO different
users** (lessee, then lessor) to reach execution. **State the mechanism you used in the report.**

**Use synthetic people and a synthetic horse**, created inside the transaction. **Do not reuse a
real client**, and do not leave a probe contact behind.

---

# WHAT TO WALK, IN ORDER

**W1 — provision a Deal client.** Prove: contact created, `groups` row is `GUEST`,
`contact_required_documents` holds **`RELEASE_GENERAL` and nothing else**, invitation token minted
with a real expiry, prior invitations superseded.

**W2 — redeem it.** Prove the members row, `redeemed` status, request `converted`. **Then check the
failure modes: an expired token, an already-redeemed token, and a token whose email does not match
the signed-in account.** ⚠️ **Report the exact message each produces** — this is what a confused
client will read.

**W3 — the first screen after activation.** `my_onboarding_state` for that contact. Prove
`horse_needed = false`, the four profile fields are what gate completion, and `RELEASE_GENERAL` is
the only document. **Report what the client actually sees if they supply none of the four.**

**W4 — create the lease and attach parties.** Admin side. Prove the document, its parties
(LESSOR/LESSEE), the horse link, and which `contract_fields` are `required`. **List the required
fields by name** — the owner asked precisely this.

**W5 — attempt to sign too early, six times.** One attempt per gate, each with the gate unmet.
**Paste the exact error text for each.** ⚠️ **Judge each message as a client would read it** — say
plainly which are actionable and which are jargon.

**W6 — satisfy the gates and let the LESSEE sign.** Prove: signature row, document NOT executed,
and **the admin `party_signed` notification exists** (admin is notified on every non-company party
signature).

**W7 — the LESSOR signs.** Prove in one transaction: `status='EXECUTED'`, `workflow_state`,
`effective_date`, `execution_hash`, frozen template version, per-party alerts resolved, and the
other party notified *"… is signed"* — **and that the signer is NOT notified of their own action.**

**W8 — the lease effects.** Prove `apply_contract_execution_effects` ran:
```
horses.lessee_contact_id = the lessee
horses.lease_start / lease_end set
horses.current_owner_contact_id = coalesce(existing, lessor)
a horse_relationships row inserted
```
**Then prove the horse now appears in the lessee's `my_stable_horses`** — that is what makes it show
in their stable. Also report whether `deal_autocomplete_on_execution`,
`apply_document_supersession` and `documents_send_executed_email` fired, and what each did.

**W9 — the admin view at each stage.** For the owner's three questions, state plainly what admin
sees and where: **when the contract is complete (ready to sign), when the other party has signed,
and when both have.** Name the surface and the notification for each.

---

# WHAT TO REPORT
- **A single ordered narrative** — what a deal party experiences, screen by screen, in plain
  language. The owner asked to be walked through it; the report's first section is that walk.
- **Every break, dead end and misleading message**, ranked by whether it stops a real client.
- **The required-field list** for the lease template, by name.
- **Anything unreachable from the staff UI** — a step that exists only as an RPC with no button is a
  finding, and gate 6 is the prime suspect.
- **What could NOT be proven server-side**, as a numbered browser checklist for the owner.

# TRAPS
- **Fix nothing.** Report only.
- **Never `COMMIT`.** Prove the rollback.
- **Do not create a probe contact, horse or document that survives the transaction.**
- **Do not send a real email.** If a step would dispatch mail, say so and stop short of it.
- **`documents_send_executed_email` fires on execution** — establish whether your rolled-back
  transaction can trigger a real send, and **if it can, do not run that step; report the boundary.**
- **A green function call is not a working flow** — `INBOUNDALERT` found a notifier with zero call
  sites and `GIFTPATH` found a gift path that never alerted anyone. **Ask of every step: is anything
  actually wired to this?**

# THE TEST THIS MUST PASS
1. W1–W9 each carry query output, not assertion.
2. **All six gates are shown refusing**, with their exact text.
3. The lease effects are proven by querying `horses` and `horse_relationships`, and the horse appears
   in the lessee's stable.
4. **Production is unchanged** — row counts before and after, shown equal.
5. **No email was sent.**
6. The report opens with the plain-language walk, not with SQL.
7. Anything unproven server-side is a numbered owner checklist.

Report to `docs/reports/TASK-CONTRACTWALK-REPORT.md`. Do not push; the orchestrator merges.
