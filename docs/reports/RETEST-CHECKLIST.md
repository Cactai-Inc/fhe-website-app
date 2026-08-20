# RETEST CHECKLIST — one ordered walk

**This replaces the six separate browser checklists** stacked across the CAREPATH,
LESSONREQUEST, GIFTPATH, SESSIONBOOK, PARTYROLE and FOOTER reports. Everything those
reports could prove server-side is already proven in them (and in
`TASK-CLOSEOUT-REPORT.md`) with query output — this list is only what genuinely needs
a browser, a session, and an inbox. Steps are in the order a real person moves:
**emails → visitor → staff → activation → lease → execution.** Duplicates across the
six lists appear once.

**How to read each step:**
- **[FIX]** — proves a fix (the task that made it is named). If this step fails, that fix regressed.
- **[CONFIRM]** — confirms behaviour that already existed and was never eyeballed.
- Use a real email address you control for the test client. Everything here runs
  against production; the test people you create can be archived afterwards.

---

## 0 · The emails lead (nothing in six threads has proven a real send)

**1. [CONFIRM — CAREPATH G2] The inquiry pair.**
Open `/lessons`, add *Single Class* to the cart, continue to the details page, fill the
form with your real address, give availability + experience, submit.
→ The confirmation screen shows your items and says a person will be in touch — and does
**NOT** show the "couldn't confirm" fallback line.
→ Within a minute: the **staff ops-inbox email** arrives (admin@ / hello@) *and* your
own **buyer confirmation email** arrives.
→ In the app: Ops → Intake shows "New inquiry from …".
→ (Desk check, optional): `request_alert_sends` has two rows for the request —
`kind='staff'` and `kind='buyer'`, both `succeeded = true`.

**2. [CONFIRM — GIFTPATH 1–4] The gift pair.**
Open `/gift?item=lessons`, submit a gift enquiry with your real address.
→ Same two emails arrive; same no-fallback confirmation; same two `request_alert_sends`
rows; the dashboard notification appears.

**3. [CONFIRM — LESSONREQUEST §6 / CAREPATH 9] The invitation email.**
From Ops → Intake, open the test lead from step 1 and provision them (next section,
step 8, sets the agreed time first — you can do both in one pass).
→ The invitation email arrives, lists exactly the paperwork you left ticked, and — when
you set an agreed time — **names the lesson time at the top**.

**4. [CONFIRM] The executed-copy email.**
After the lease executes (step 17): each party's inbox gets the executed-document email.

---

## 1 · The visitor

**5. [FIX — CLOSEOUT §3.1] The acquisition funnel is three honest steps.**
Open `/acquisition`. Add one service.
→ The tracker shows **derived** steps; with a service that asks nothing the walk is
**two** steps, and the last step is titled **Your Details** and contains: your selection
summary → Continue Shopping → the one form → the submit button. There is **no separate
/checkout screen after "Step 3 of 3"**, and the back control reads **Back** (never
"Previous"), **Back to Services** on step 1.

**6. [CONFIRM — CAREPATH 1/1b/3] The horse funnel, same machinery, quick pass.**
Open `/horse`, add *Full Body Clip* only → two steps. Add *Exercise Weekly* → the
questions step appears and the tracker says three. The last step is the submission.

**7. [FIX — CLOSEOUT §3.2] The turnout heading is the catalog's.**
On `/horse`, add *Turnout Weekly* and continue to the questions page.
→ The turnout section heading is the SKU's own catalog name (today: "Turnout Weekly"),
not a hardcoded word. (D13 spot-check, optional: rename that SKU in the catalog editor,
reload — the heading follows.)

**8. [CONFIRM — LESSONREQUEST 1/G3] The lesson gate, from the form.**
With a lesson in the cart, try to submit without availability or experience → the form
refuses (the server refuses too — that half is query-proven). A mixed cart containing
one lesson also demands availability; a pure horse-care cart never asks.

**9. [FIX — CLOSEOUT §3.6] `/book/rider` is retired.**
Type `/book/rider` into the address bar → you land on `/lessons`.

**10. [CONFIRM — CAREPATH 4] The cart survives the funnel switch.**
From any funnel, use Continue Shopping → pick another category → your earlier items are
still in the cart, and the modal offers Back and ✕.

---

## 2 · Staff, from inquiry to invitation

**11. [CONFIRM — CAREPATH 8 / LESSONREQUEST 3] The lead shows everything.**
Ops → Intake → open the step-1 lead.
→ The submission (answers, notes, availability ranges) and its draft order with line
items are both on the page.

**12. [CONFIRM — LESSONREQUEST §6.2] The ranges sit beside the picker.**
In the invite flow, the agreed-time panel shows the visitor's offered ranges next to the
date/time fields; choosing a time outside them is called out in words, never blocked.

**13. [FIX — CLOSEOUT §3.5] The agreed-time panel is on EVERY provisioning surface.**
Open Clients → **New client** (no lead behind it).
→ The same "Set the time you agreed on the call" panel is there, optional; set a time
and the primary button changes to **Book the lesson & send invitation** — one act.
Spot-check the same panel in a contact dossier's Provision section.

**14. [FIX — CLOSEOUT §1.6] Skip and restore, in the paperwork editor.**
On a client with assigned, unsigned paperwork, open First-login paperwork.
→ Each unsigned row offers **"Skip — stop this from blocking, without signing it"**;
skipping asks for a reason; the row then reads *Skipped 〈date〉 by 〈you〉 — 〈reason〉 ·
not signed, no longer blocking*, with **Restore**. A **signed** row offers no skip.

**15. [CONFIRM — PARTYROLE 1–4] The provisioning checkbox list is the whole truth.**
Provision a Deal client → all three defaults named and ticked; untick all three and the
invitee gets no documents; "+ Add another document" lists **nine**, including the two
never offered before; a contact's paperwork editor shows nine rows and saves both ways.

---

## 3 · Activation

**16. [CONFIRM — CAREPATH 12] The chain, end to end.**
Open the invitation link from step 3 in a private window, register, complete the
profile details, sign each onboarding document, land in the app.
→ If an agreed lesson was set: it shows as **scheduled** on your calendar/dashboard
(LESSONREQUEST 6's render half).

**17. [FIX — CLOSEOUT §1.3] The old link tells the truth now.**
After activating, click the **same invitation link** again (signed out).
→ The page says **"You've already activated this account — this link has done its job.
Sign in below…"** with the Sign In button. It must NOT tell you to check your inbox
for a newer email.

---

## 4 · The lease, to execution

**18. [CONFIRM — PARTYROLE 5] The counterparty round trip.**
Start a lease (New Contract) with a Lessor who has no paperwork; invite them from the
contract page; activate their emailed link in a private window.
→ They land on the **contract**, with **no signing wall and no onboarding list**, and
can sign once the contract is ready.

**19. [FIX — CLOSEOUT §1.5] Nothing extra is manufactured at lock.**
As staff, complete the lease fields, have the Lessor confirm the horse section, lock it.
→ The Lessor's documents list gains **nothing** at lock — no Emergency Vet, no Horse
Care release. **Only after both parties sign** do those two appear, awaiting the
owner's signature.

**20. [FIX — CLOSEOUT §1.1/§1.2] The screen and the gate agree.**
With the blockers panel clean, the sign button signs — no "17 required field(s) still
empty" surprise (that disagreement is closed and server-proven on a document with
conditionals; this is the eyeball half).

**21. [FIX — CLOSEOUT §1.6] Skip clears the lock gate.**
Variant: provision the Lessor as a full **Horse owner** (5 documents) first.
→ Locking the lease is refused, naming them. Skip their five in the paperwork editor
(one reason covers it) → the lease locks, both parties sign, it executes — and their
five requirements still read *skipped, not signed*.

**22. [CONFIRM — CLOSEOUT §1.4] An evergreen lease says so.**
Leave the lease end date empty.
→ After execution the horse reads **"Leased — evergreen"** (stable card) / **"evergreen
— until terminated"** (staff records), never a blank. The staff lease-end editor says
empty = evergreen; the horse intake form no longer demands an end date.

**23. [FIX — CLOSEOUT §1.8] The notification log reads back.**
On the executed contract, expand **Activity** (staff).
→ Below the event feed: **"Notification log · N resolved"** — who was told what, where
it surfaced (in-app / email), what resolved it, and when.

**24. [CONFIRM — CLOSEOUT §1.7] The envelope followed.**
The contract record shows **executed** (not draft) beside its executed document.

**25. [CONFIRM — A5 report item] Termination is reachable — and note the gap.**
Manage → Terminate → the other party approves → the contract reads Terminated.
⚠️ Known, reported, not yet fixed: the **horse record still shows the lease** after
termination — staff clear it manually on Horse Records until the follow-up lands.

---

## 5 · Visual once-overs (FOOTER / SESSIONBOOK leftovers)

**26. [CONFIRM — FOOTER] The map block's light-on-dark contrast** — fine or tone down?
**27. [CONFIRM — FOOTER] The signed-in "Member area" nav state** — never screenshotted
logged in.
**28. [CONFIRM — FOOTER] Real mobile Safari/Chrome pass** of `/` and the footer — the
fixed-hero pattern is the kind that differs from a headless viewport.
**29. [CONFIRM — SESSIONBOOK] `/lessons` signed in** — the plus-pass / booking controls
render against a real session (headless run only covered signed-out).
**30. [CONFIRM — PARTYROLE 6] The footer's first sentence** says "…classical European
style riding and jumper training…" — the word *hunter* is gone.
