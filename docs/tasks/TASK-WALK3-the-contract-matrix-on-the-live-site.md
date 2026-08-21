# TASK-WALK3 — the contract matrix, both party sides, on the LIVE SITE

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** The high-stakes decisions are pre-decided in
§3. **Escalate, do not diagnose.**

⚠️ **RUNS AGAINST PRODUCTION** with real credentials and real signatures. **Read §3 before opening a
browser.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-walk3` (**already created; `.env.test` is
already in it**), branch `task/walk3` · report to `docs/reports/TASK-WALK3-REPORT.md` · commit,
**do not push** · no subagents · **TEARDOWN:** kill every browser; process census in the report.

---

# 1. WHY — the largest untested area in the product

The owner listed the whole contract matrix and **none of it has ever been exercised in a browser**.
`TASK-PARTYEMAIL` just rebuilt this area — email-only parties, name-required-to-sign, propagation,
regenerate-on-open, and the kiosk execution-snapshot fix — and **every one of those is
server-proven only, marked NOT VERIFIED.** This walk is where they meet a human.

**Production has 0 contracts and 0 deals**, so everything you create is the first of its kind.

---

# 2. PHASE 0 — TOOLING (commit alone)

Install **Playwright** worktree-local (`wt-walk3/walk3-tooling/`, own `package.json`, a `.gitignore`
containing `*`). ⚠️ **Never add it to the repo's `package.json`** — that deploys.
Credentials: **`.env.test` in the worktree root.** `FHE_SITE_URL` + `FHE_ADMIN_PASSWORD` (durable —
log in as often as you like). **Never echo a credential anywhere, including screenshots.**
**Screenshots** → `docs/reports/walk3-shots/`, decision points only, one per numbered step,
**never full-page DOM dumps.**

---

# 3. RULES OF ENGAGEMENT

1. **Two identities, both yours to create:**
   **FHE side** = `admin@fhequestrian.com` (real staff account — author and sign as the company).
   **Counterparty** = a fresh `cjzigs+walk3-<yyyymmddHHMM>@icloud.com`, last name **`WALKTEST`**
   (plus-addressing so the owner receives the mail). **Never sign in as `cjzigs@` itself** — D1
   protected.
2. ⚠️ **NEVER touch a real client's document.** **55 executed documents exist and are EVIDENCE.**
   Read them if useful; never edit, never sign, never void, never supersede.
3. **The signing freeze is lifted for the WALKTEST identity only.**
4. **Use a test horse, not a real one.** Create one if needed; name it so it is purgeable.
5. **Escalate, do not diagnose.** Record what you saw, what you expected, the step number — then
   continue if safe, stop if not. **Do not open `src/` or query the DB to explain a behaviour.**
6. **Stop** for: anything touching a real client, a real payment, or anything you cannot classify as
   safe.

---

# 4. THE WALK — the owner's matrix, in order

## §A — author and invite (verifies PARTYEMAIL in a browser for the first time)
Author a lease from the contract page. **Add the counterparty as an EMAIL-ONLY party** — type an
address, no name. Then:
- **Confirm it is NOT signable** while the party has no name (PARTYEMAIL §3 built this blocker).
  **Record the exact wording the blocker shows.**
- Invite them. **Follow the invitation** — build the link from `invitations.token` rather than
  waiting on email (`SELECT token FROM invitations WHERE lower(email)=lower('<walk3 identity>')
  ORDER BY created_at DESC LIMIT 1` → `${FHE_SITE_URL}/activate?token=…`).
- **The counterparty should land ON the contract** after activation (`RegisterComplete` does this).
  **Record where they actually land.**
- **Their details should now fill in** — name, email, phone, address — from their contact record.
  **Record whether the contract shows them or blanks.**

## §B — Add New Item, the full ladder
Owner's words: *"try adding a new clause, try adding a new subsection with a clause, and try adding
a new section with a subsection with a clause. try out the different inserts and the tokens."*
1. **A clause** into an existing subsection.
2. **A subsection containing a clause.**
3. **A section containing a subsection containing a clause.**
4. **Every insert type the editor offers** — enumerate what exists, use each, record which work.
5. **Tokens** — insert them and confirm they resolve to real values in the composed document, not
   raw `{{TOKEN}}`. ⚠️ **A token that renders as its own literal is a defect worth reporting.**

## §C — the two-sided matrix
**Each of these from BOTH sides — the FHE side and the counterparty side. Eight runs.**
- **Sign** · **Edit** · **Suggest a change** · **Cancel**

⚠️ **D14 governs and is the thing to watch:** a change is surfaced to the party who did **not** make
it, presented one at a time, and **being seen on screen IS approval** — there is no accept button.
A signed party may keep editing without removing their signature; **the other party's signature must
come off for them to edit.** **Record whether the app actually behaves this way** — this is the
single most valuable observation in the walk.
⚠️ **After both have signed, both must agree to remove signatures**, and the result is a
**superseding version, never a void** — the prior one is retained.

## §D — doc controls together with edit/suggest
Owner: *"you will need to use the doc controls in unison with the edit/suggest functions."*
Exercise the document controls **while** an edit or suggestion is in flight. Record what the
controls offer, what they do, and **whether any combination produces a state the UI cannot explain.**

## §E — comments
Use them from both sides. Who sees a comment, when, and is anyone notified.

## §F — notifications, watched throughout
**All three channels at every stage: the counterparty's dashboard, the admin dashboard, and email to
both.**
⚠️ **`emailed_at` is ALWAYS NULL and means nothing** — its only two writers are crons that cannot
run. **Never cite it as delivery evidence.** Email works (owner-confirmed 2026-08-20). **Record
every message that should have arrived — step, subject, recipient, time — so the owner confirms from
his own inbox.**

---

# 5. OUT OF SCOPE
Bookings, payments, credits, lessons (**WALK2**) · any code change · any fix · installing anything
into the repo's `package.json`.

# 6. THE TEST THIS MUST PASS
1. A contract exists that was **authored from scratch and signed by both sides** — the first in
   production.
2. **The email-only party path is proven in a browser**: no name ⇒ not signable ⇒ activation ⇒
   details fill ⇒ signable.
3. **All three Add-New-Item depths** attempted, each marked works/fails, with what was seen.
4. **All eight §C runs** attempted (4 actions × 2 sides), each with its outcome.
5. **D14's seen-is-approved behaviour is stated plainly as observed** — matching or not matching the
   rule.
6. **No real client document was touched** — assert it, and show the executed count is still 55.
7. Every notification recorded across all three channels; every expected email listed for the owner.
8. Every stop recorded with its reason.

# 7. REPORT
`docs/reports/TASK-WALK3-REPORT.md` — lead with: does the contract flow work end to end for two real
people, yes or no. Then the matrix, then **flagged-not-fixed**, then teardown.
