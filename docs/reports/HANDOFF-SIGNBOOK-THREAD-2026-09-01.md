# HANDOFF — the SIGNBOOK thread, 2026-09-01

**From:** the `TASK-SIGNBOOK` thread, which the owner kept open well past its spec and used as a
build thread for the whole sign/contact funnel. **To:** `ORCH`.
🔒 **READ §1 FIRST. Nothing this thread built was independently verified, and that is the point of
this handoff.**

---

# 1 · ⚠️ TWO PROCESS BREACHES, DECLARED

**1.1 · I MERGED AND PUSHED MY OWN WORK — SEVEN TIMES.** `TASK-ROLE` §1 says *"You do not push. ORCH
merges."* **The owner instructed it directly** — *"build this exactly as ive instructed and then push
it so it can be merged and committed and deployed, i have a customer waiting to use this flow right
now"* — and I did, repeatedly, for the rest of the session. **Every deploy was a release to
production.** ⚠️ **So no `TASK-<ID>-VERIFICATION.md` exists for ANY of it, and the merges below have
never been checked by anyone but the thread that wrote them.**

**Merged to `main` by this thread:**
| commit | what |
|---|---|
| `2fa1f7b9` | SIGNBOOK — the wizard ends in a booking request |
| `167fdab4` | the catalog follows the funnel; confirmation names the activation link |
| `e59a8364` | the visit request form + the activation link on website submissions |
| `b0bf4d16` | whose horse decides the rider catalog; visit from the contact form |
| `0f674bab` | attribution is never overwritten |
| `c45ee5ea` | `requests.interests`; "Visit the ranch" on the contact menu |
| `2964f125` | the bell + staff email name a visit request; the account shows the person's name |
| `87eb0888` | **D39** + `TASK-ROLE` §2c — build for the outcome |
| `task/displayname` | ⚠️ **PUSHED, NOT MERGED** — see §3.1 |

**Migrations APPLIED TO PRODUCTION by this thread** (each rehearsed in `BEGIN…ROLLBACK`, ACLs pasted
in the reports, `anon` confirmed absent on every one):
`20260901T1420` · `20260901T1700` · `20260901T1830` · `20260901T2030` · `20260901T2230` ·
`20260901T2330`.

**1.2 · THE OWNER'S RULINGS WERE NEVER FILED IN THE CHANGE-ORDER LEDGER.** They live only in this
thread's reports. ⚠️ **`CLNR-ROLE` §2c: a decision recorded only in a chat reply does not exist.**
ORCH owes `docs/reference/CHANGE-ORDER-LEDGER.md` entries for:
1. **CR-98 · A4** — step 9 lands on the community feed, not the dashboard (reverses `TASK-ONBOARD`
   §5). Verbatim in `TASK-SIGNBOOK-REPORT.md`, criterion 3.
2. **The door's three states** — active / known / new, three emails, three destinations. Verbatim in
   `SIGNBOOK-FINDING-the-door-does-not-know-who-is-knocking.md` §1.
3. **The contact form's shape** — menu first, then the checkboxes it reveals, into a field of their
   own. Verbatim in `OWNER-BACKLOG-2026-09-01-…md` §3, plus his correction of my first attempt.
4. **D39** — already promoted to `CLAUDE.md` and `TASK-ROLE` §2c; the ledger entry is still owed.

---

# 2 · ⚠️ THE FOUR FLAGS — the owner: *"these are not small"*
Raised in `TASK-SIGNBOOK-REPORT.md` and deliberately deferred by him to after items 1–5.

| # | The flag |
|---|---|
| **F1** | **An order submission now sends TWO emails** — the activation link (new) and `/api/inquiry-confirmation`'s *"here is what you sent us"* (CAREPATH §C6, his own earlier ruling). Two emails for one act, and he has objected to exactly that elsewhere: *"i dont want to send her two emails since that is confusing."* ⚠️ **Not resolved by me because removing the confirmation is subtractive against a standing ruling (NOSTRIP).** |
| **F2** | **`flush_held_executed_document_emails` runs at 30 minutes.** Somebody who signs and then browses the catalog slowly gets their documents email early and the order/booking blocks separately — the one email becomes two. The backstop's tuning, not mine to change. |
| **F3** | **A booking's `status_events` row is written with `entity_type = 'offering'`, not `'booking'`.** Anything reading the timeline by entity type sees bookings filed under the wrong noun. |
| **F4** | **A member with no `clients` row cannot submit a booking request** — `request_open_time` raises *'no member profile'*. Nothing in the wizard heals it; the row comes from `redeem_invitation` → `_ensure_client_account`. Not reproducible on live data (every real member has one), so it is a trap, not a live break. |

---

# 3 · UNFINISHED — what I did not do, and why

## 3.1 · ⚠️ SHIPPED HALF — the display name (D39 applies to me, today)
**Owner:** *"the display name should be populated from the name they give us when they fill in the
account information. that field exists so they can change it if they want to from the profile page."*
**Two halves. I built one.**
- ✅ **Seeded and backfilled.** Nothing had EVER written `profiles.display_name` — ~38 readers, zero
  writers, **14 of 16 live accounts blank**. Now seeded at `update_my_onboarding_profile` and by a
  `BEFORE INSERT OR UPDATE OF first_name, last_name` trigger so every path gets it, blank-only so a
  chosen handle is never overwritten (proven: a handle survives a subsequent name write).
  **16 of 16 accounts now carry one.** ⚠️ **Applied to production; `task/displayname` is PUSHED AND
  UNMERGED — merge it or the repo disagrees with the database.**
- ❌ **NOT BUILT: the member cannot change it.** There is no `set_my_display_name` RPC and no control
  on the account page — `AccountHub.tsx` only reads it. **The half he actually explained the field's
  purpose by.** Needs one RPC + one field on the account page.

## 3.2 · BLOCKED ON D35 — two live threads own the files
| Item | The file | Owner on the board |
|---|---|---|
| **The confirmation copy** — a visitor must activate, THEN sign rules/policies/waiver, said on the confirmation screen AND in the email; plus `/sign/*`'s check-spam / address-book / contact-us lines carried onto the website confirmation | `Confirmation.tsx` | ⚠️ **`SITECOPY-B`, running** |
| **Aligning the `deal` and `guest` doors with the rider flow** — email first · check for an existing account or submission · none → activation link → the flow · found → check for an order → route them to the documents that order implies | `SignStart.tsx` · `Onboarding.tsx` (inputs) | ⚠️ **`SIGNFLOW-B`, running** |
⚠️ **He corrected my framing on the second:** the whole point of the update is **account first, then
documents**, so the documents land on an active account in the right categorisation. Copy that says
*"sign before you visit"* must not imply signing can happen before activation.

## 3.3 · CAPTURED, NOT BUILT — the Casey Caddell defect list
`docs/reports/OWNER-BACKLOG-2026-09-01-contact-form-and-the-casey-incident.md`, eleven items verbatim:
forms on two pages of the contact record · the record is a modal and should be a page · **attribution
says "saved" and never persists** · "where they came from" neither populates nor saves · the card
badge disagrees with the record · "file under" is on the wrong page · the order is not interactive ·
the bookings tab has no count badge · a booking is not clickable · **the activity page is unusable
and needs real interaction capture** (his full spec is in §4.11). ✅ **Only the display-name item
(4.7) is addressed** — §3.1.

## 3.4 · TRACED, NOT BUILT — the guardian lost at provisioning
`docs/reports/FINDING-the-guardian-declared-at-the-door-is-lost-at-provisioning.md`. The minor spine
WORKS; the lead→client door never reads the guardian the parent declared, so a 13-year-old was
provisioned as an adult client with an invented email, holding a booking and owing four documents.
Four revisions proposed, none built — `provision_client_invitation` is a shared spine and the
provisioning surface is scheduled to move (backlog 4.2).

## 3.5 · RIGHTFULLY SKIPPED
- **The visit date/timeframe/week pickers** — ⚠️ **the owner CUT these explicitly**: *"lets avoid
  adding the options for selecting when they want to visit when they select visit the ranch from the
  menu."* Not unfinished. Withdrawn.
- **Charlotte Caddell's unsigned release and unredeemed invitation** — ⚠️ *"ill resolve this on my
  own, dont touch it."* **Do not action it.** *(Live fact for context: she holds an Evaluation Lesson
  and has signed none of her four documents.)*
- **`request_open_time`** — TASK-LIFECYCLE's under D35. Called, never edited, all session.

---

# 4 · ⚠️ NOT A CODE PROBLEM — the deliverability question, closed
Three emails to `caseyluke1029@gmail.com` were accepted by the transport and not received, while six
Gmail invitations in the same week were sent AND redeemed. **The domain is fine.** The unredeemed
one went to `caseyccaddell@gmail.com` — an address that appears in neither of her submissions and was
typed during manual provisioning. **The owner is asking her directly and has closed this.**
⚠️ **The gap it exposed is real and unowned:** `email_sent` in this system means *the provider
accepted it*, never *it arrived*. Nothing distinguishes the two. **A bounce webhook, or a provider
that reports delivery events, is the only way that stops being a guess.**
