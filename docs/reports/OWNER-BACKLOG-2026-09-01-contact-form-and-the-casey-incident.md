# OWNER BACKLOG — the contact form, and the Casey Caddell incident

**Raised by the OWNER, 2026-09-01, in one message.** ⚠️ **This is a CAPTURE, not a plan I invented.**
Two items are fixed and deployed (§1, §2); everything else is recorded here because a decision that
lives only in a chat reply does not exist.

---

# 1 · 🔴 THE EMAILS — DIAGNOSED, AND IT IS NOT THE APP

**What he reported:** Casey Caddell (`caseyluke1029@gmail.com`) filled in the form and got no email;
he provisioned her by hand and the manual invitation produced no email either; he ended up texting
Claire the link.

**⚠️ THE APP SENT ALL THREE, AND RECORDED EACH AS ACCEPTED BY THE TRANSPORT.**

```
request_alert_sends (her two submissions)
 buyer | caseyluke1029@gmail.com | succeeded=t | 2026-08-28 15:19:23
 staff | hello@fhequestrian.com  | succeeded=t | 2026-08-28 15:19:24
 buyer | caseyluke1029@gmail.com | succeeded=t | 2026-09-01 07:38:43
 staff | hello@fhequestrian.com  | succeeded=t | 2026-09-01 07:38:43

status_events for invitation 718a3aa3 (the one he sent by hand)
 2026-09-01 15:51:56  invited
 2026-09-01 15:51:59  email_sent      ← the provider ACCEPTED it
 2026-09-01 16:32:30  redeemed        ← she used the link Claire texted her
```

🔒 **THREE emails were handed to the transport for her address and accepted. She received none.**
⚠️ **`email_sent` in this system means "the provider accepted the send". It does not mean "it
arrived", and nothing here can currently tell the two apart.**

**The transport is Google Workspace SMTP** (`api/_lib/email.ts` — nodemailer, `smtp.gmail.com`).
⚠️ **The pattern is decisive: mail to `hello@fhequestrian.com` arrives — he reads those leads — and
mail to an EXTERNAL address does not.** That is a deliverability problem (SPF / DKIM / DMARC
alignment, Google sending limits, or Gmail spam placement), **not an application defect**, and no
amount of work in this repo would have fixed it.

### ⚠️ WHAT TO CHECK, IN THIS ORDER — none of it is in this codebase
1. **The bounce mailbox for `hello@fhequestrian.com`.** Three sends to one Gmail address in four
   days almost certainly produced a bounce or a deferral notice.
2. **`TRANSACTIONAL_FROM_EMAIL` in Vercel.** `api/_lib/email.ts` warns in its own comment: *"Gmail
   rewrites the From header to the authenticated account unless fromEmail is that account or one of
   its configured aliases."* A rewritten From breaks DKIM alignment and Gmail drops it silently.
3. **SPF, DKIM and DMARC for `frenchheritageequestrian.com`** — `docs/reference/GOOGLE_SMTP_SETUP.md`
   is the setup record. Check Google Postmaster Tools for the domain's reputation.
4. **Google Workspace sending limits** — a relay account that trips them fails quietly for a day.

### THE APP-SIDE GAP THIS EXPOSES — worth a task of its own
**Nothing distinguishes "accepted" from "delivered".** Every send here writes an outcome row and
every one of them says the same thing for both. A bounce webhook, or moving transactional mail to a
provider that reports delivery events, is the only way the answer to *"did she get it?"* stops being
a guess. ⚠️ **Until then, `succeeded=t` should be read as "we handed it over", nowhere else.**

---

# 2 · ✅ FIXED AND DEPLOYED — my own defect, which he caught

**Owner:** *"It cannot wipe the attribution tagging."*
The visit option I shipped an hour earlier wrote `'guest_visit'` over `requests.entry_location` —
**destroying how the person found us**, which is the one fact that column exists to keep. The visit
is now its own answer in `details.visit_requested`, which the staff email (`REQ.DETAILS`) and the
lead already render. Proven on production, rolled back:

```
check            | entry_location | visit_flag                         | requested_window
attribution kept | referral       | Yes — would like to come and visit | Tue, Sep 15, 9am–noon
```

---

# 3 · 🔒 THE CONTACT FORM — HIS SPEC, VERBATIM. NOT YET BUILT.
> *"add a selection option to the menu on the contact us form. if they want to come for a visit as
> their primary interest they select that, then they use checkboxes for any of their interests and
> they provide is with their information and they pick a date and timeframe or a box that indicates
> any time that day is fine. alternatively they can select an option instead of a specific date that
> selects a week from the next three weeks. So their choices for helping us get this booked are to
> select a range of 7 days as a Sunday-Saturday week range with the current week and the following
> two weeks to choose from, they can pick a specific date with out a timeframe or they can also
> select a timeframe for that date. Before they can visit they need to complete the rules, policies,
> and liability waiver documents so those should be shown for signing after they activate their
> account using the link in the email and the submission confirmation screen and the email should
> both show this information to them so they know they should complete the activation. and the same
> information shown on the submission confirmation screen in the /sign/\* flow should be included
> with the confirmation information shown on the website so they know to check spam, add us to their
> address book, and contact us if they dont get the email. If they select another option from the
> menu on the contact us form then the option to check a box to indicate they would like to visit.
> This then prints that information in the email and on the notification/lead information staff see.
> It cannot wipe the attribution tagging."*

**⚠️ WHAT I SHIPPED IS THE WRONG SHAPE AND HE SAID SO.** Today's build offers the visit as a
tick-box beside a single-select category. His design is:
| | |
|---|---|
| **Primary interest** | a MENU option — "come for a visit" is one of the choices |
| **Their interests** | ⚠️ **CHECKBOXES, plural** — not the single-select dropdown that is there now |
| **When** | one of: a **Sun–Sat week** from this week + the next two · a **specific date** · a specific date **+ timeframe** · **"any time that day"** |
| **Any other primary interest** | still offers the visit as a tick-box, printed in the email and on the lead |
| **Attribution** | ⚠️ never overwritten (done, §2) |
| **The confirmation screen + the email** | must both say the visit needs rules, policies and the liability waiver signed, which happens after activation — so activation is the thing to do |
| **The confirmation screen** | must carry `SendStateScreen`'s lines: check spam · add us to your address book · contact us if it does not arrive |

**The single-select category is load-bearing elsewhere** (`requests.category` is one value, and
`intakeCategoryFields` shape-shifts the form from it), so "checkboxes for any of their interests" is
a schema question, not a widget swap. **That is why this is recorded rather than guessed at.**

---

# 4 · THE CASEY INCIDENT — the defect list, verbatim, one line each
Every one of these is HIS observation. None is fixed.

| # | What he found |
|---|---|
| 4.1 | **The onboarding forms are configured on TWO separate pages of the contact record.** *"very confusing and needs to be corrected."* |
| 4.2 | **The contact record is a MODAL and should be a PAGE.** |
| 4.3 | ⚠️ **Attribution: the menu says "saved" in the top right and never persists the selection.** A save that reports success and writes nothing — this repo's signature failure (`TASK-ROLE` §2a). |
| 4.4 | **"Where they came from" does not auto-populate and does not save from the menu either.** |
| 4.5 | ⚠️ **The contact CARD shows the badge for the channel he chose, while the RECORD still shows "other (enter manually)…"** — two readers of one value disagreeing. |
| 4.6 | **"File under" belongs on the ACCOUNT page only, not the record page.** Same for "where they came from". |
| 4.7 | **Her account shows "no display name" although her name is on the record** — the wiring that populates it is broken. |
| 4.8 | **An order on her Orders page cannot be opened.** It must open so staff can schedule the offering(s) in it, set the status, adjust the order date and mark it paid. *(The "Mark paid" control below it does work and expands to Zelle / cash / a manual date.)* |
| 4.9 | **The Bookings tab carries no count badge** — Relationships, Documents and Orders all do. |
| 4.10 | **A booking is not clickable.** It should open the lesson page: details, notes, messages, and a **"View order"** link to the order the booking was made for. |
| 4.11 | ⚠️ **The Activity page shows database-level rows that are "virtually useless."** |

## 4.11 · WHAT THE ACTIVITY PAGE SHOULD SHOW — his spec
- **login** — timestamp, device, general location
- **viewed document `[name]`** — timestamp, device, general location
- **signed document `[name]`** — timestamp, device, general location
- **website visit** — chronological: referring site · pages visited · buttons clicked · links clicked
  · submissions sent, each with a timestamp, device and general location
- ⚠️ **the same for the APP** — pages, buttons, links, submissions
- 🔒 **Named the way he can read it** — *"most likely the name shown on the screen"*, and for a
  control, **where it is**: *"you might enumerate all actions under the page they happen on."*

⚠️ **This is analytics capture that does not exist.** `audit_logs` and `status_events` record row
changes, not interactions; there is no click, page-view or device/location capture anywhere in this
codebase. **It is a build, not a repair of the existing page.**

---

# 5 · SUGGESTED ORDER — mine, for him to overrule
1. 🔴 **The mail domain** (§1). Nothing else matters while real customers get nothing.
2. **4.3 / 4.4 / 4.5** — the attribution save that lies. Small, and it is corrupting the record he
   uses to decide where to spend money.
3. **4.7** display name · **4.9** bookings badge — small, visible, same area.
4. **§3** the contact form, once the multi-select question is settled.
5. **4.8 / 4.10** — the order and booking surfaces becoming interactive. A real build.
6. **4.1 / 4.2 / 4.6** — the contact record becoming a page and its sections moving. A real build.
7. **4.11** — activity/analytics. The largest, and worth its own design pass.
