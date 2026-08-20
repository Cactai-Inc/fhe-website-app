# RETEST CHECKLIST — one ordered walk

**This replaces the seven separate browser checklists** stacked across the ASKRIGHT (§7,
16 steps), CAREPATH, LESSONREQUEST, GIFTPATH, SESSIONBOOK, PARTYROLE and FOOTER reports.
Everything those reports could prove server-side is already proven in them (and in
`TASK-CLOSEOUT-REPORT.md`) with query output — this list is only what genuinely needs a
browser, a session, and an inbox. Steps are in the order a real person moves:
**emails → visitor → staff → activation → lease → execution.** Duplicates across the
seven lists appear once (ASKRIGHT's checkout-fields, lead-details and email steps are
folded into steps 1, 17 and 20 rather than repeated).

**How to read each step:**
- **[FIX]** — proves a fix (the task that made it is named). If this step fails, that fix regressed.
- **[CONFIRM]** — confirms behaviour that already existed and was never eyeballed.
- Use a real email address you control for the test client. Everything here runs
  against production; the test people you create can be archived afterwards.
- The cart persists in `sessionStorage` — start each funnel run in a private window or
  clear it between runs.

---

## 0 · The emails lead (nothing in six threads has proven a real send)

**1. [CONFIRM — CAREPATH G2 + ASKRIGHT 15] The inquiry pair.**
Open `/lessons`, add *Single Class* to the cart, continue to the details page, fill the
form with your real address, give availability + experience, submit.
→ The confirmation screen shows your items and says a person will be in touch — and does
**NOT** show the "couldn't confirm" fallback line.
→ Within a minute: the **staff ops-inbox email** arrives (admin@ / hello@) *and* your
own **buyer confirmation email** arrives — and the staff alert email **renders the
answers as a readable labelled list**, the same list the lead page shows.
→ In the app: Ops → Intake shows "New inquiry from …".
→ (Desk check, optional): `request_alert_sends` has two rows for the request —
`kind='staff'` and `kind='buyer'`, both `succeeded = true`.

**2. [CONFIRM — GIFTPATH 1–4] The gift pair.**
Open `/gift?item=lessons`, submit a gift enquiry with your real address.
→ Same two emails arrive; same no-fallback confirmation; same two `request_alert_sends`
rows; the dashboard notification appears.

**3. [CONFIRM — LESSONREQUEST §6 / CAREPATH 9] The invitation email.**
From Ops → Intake, open the test lead from step 1 and provision them (section 2,
step 22, sets the agreed time first — you can do both in one pass).
→ The invitation email arrives, lists exactly the paperwork you left ticked, and — when
you set an agreed time — **names the lesson time at the top**.

**4. [CONFIRM] The executed-copy email.**
After the lease executes (step 31): each party's inbox gets the executed-document email.

---

## 1 · The visitor — funnels and the questions engine

**5. [FIX — CLOSEOUT §3.1] The acquisition funnel is three honest steps.**
Open `/acquisition`. Add one service.
→ The tracker shows **derived** steps; with a service that asks nothing the walk is
**two** steps, and the last step is titled **Your Details** and contains: your selection
summary → Continue Shopping → the one form → the submit button. There is **no separate
/checkout screen after "Step 3 of 3"**, the back control reads **Back** (never
"Previous"), **Back to Services** on step 1 — and the old *"Noted for our conversation"*
lessons panel is gone (ASKRIGHT 6's second half).

**6. [CONFIRM — CAREPATH 1/1b/3] The horse funnel, same machinery, quick pass.**
Open `/horse`, add *Full Body Clip* only → two steps. Add *Exercise Weekly* → the
questions step appears and the tracker says three. The last step is the submission.

**7. [FIX — CLOSEOUT §3.2] The turnout heading is the catalog's.**
On `/horse`, add *Turnout Weekly* and continue to the questions page.
→ The turnout section heading is the SKU's own catalog name (today: "Turnout Weekly"),
not a hardcoded word. (D13 spot-check, optional: rename that SKU in the catalog editor,
reload — the heading follows.)

**8. [CONFIRM — ASKRIGHT 1–3] One à la carte clip, the right eight questions.**
`/horse` → *Full Body Clip* alone → Continue.
→ **Eight questions in one unnamed run**: own/lease, how long, age, breed, behaviour,
injuries, clipping issues, notes — and **NO** "what is bringing you to our horse care
services", **NO** "how long will you need these services".
→ Answer **Yes** to *behaviour issues* — a "Tell us more" box appears directly under it,
on the same card.
→ Change question 1 to *"Not yet — I'd like help finding one"* — questions 2–6 and the
clipping question **disappear**; the notes box stays.

**9. [CONFIRM — ASKRIGHT 4] Shared questions are asked once.**
`/horse` → *Full Body Clip* **and** *Training Session* → Continue.
→ **Three headings**: *First, a few details* (the six shared), *Horse Clipping* (2),
*Horse Training* (3). The six appear **once**.

**10. [CONFIRM — ASKRIGHT 5] Weekly-only questions stay weekly-only.**
`/horse` → *Exercise Session* (à la carte) alone → **9 questions, no reason/duration
pair**. Swap it for *Exercise 1x Weekly* → **11, with them**.

**11. [CONFIRM — ASKRIGHT 6–7] The Horse Finder set.**
`/acquisition` → *Horse Finder* alone → **9 questions**. *"Which best matches your
equestrian experience?"* has **three** options and **no grey help line** beneath it.
**No "how many horses"** and **no "are you interested in lessons"** anywhere. Budget and
age bands read exactly **`$2–5k · $5–7k · $7–10k · $10k+ · Not sure`** and
**`3–5 · 5–7 · 7–10 · 10+ · No preference`**.

**12. [CONFIRM — ASKRIGHT 8] Finder + Evaluation share the experience question.**
Add *Horse Evaluation* beside *Horse Finder* → the experience question appears **once**,
in *First, a few details* at the top.

**13. [CONFIRM — ASKRIGHT 9] The cross-entry case.**
`/horse` → add *Training Session*. Navigate to `/lessons`, add *Single Lesson*, press
**Continue there**. → You land on **`/questions`** and see the **Horse Training**
section — *not* the form.

**14. [CONFIRM — ASKRIGHT 10] Lessons alone skip the questions page.**
Empty cart → `/lessons` → *Single Lesson* → Continue → **straight to `/checkout`**,
button reading **"Continue to Submit Inquiry"**. No questions page.

**15. [CONFIRM — ASKRIGHT 11–12] The inference fills, announces itself, and yields.**
Cart = *Training Session* + *Horse Finder*. On page 2 answer *"I lease the horse"*.
→ The experience question already shows **"I currently own or lease a horse"** with the
gold italic line *"We filled this in from your answer… change it if we got it wrong."*
→ Change it yourself to *"This will be my first horse"* — the gold line disappears. Go
back and flip the horse answer to *"I own the horse"* — **your answer holds**.

**16. [CONFIRM — ASKRIGHT 13] The leased horse carries over.**
Cart = *Exercise 1x Weekly* + *Horse Finder*. Answer *"I lease the horse"*, breed
`Warmblood`, age `8`.
→ Under Horse Finder, *"Have you found any horses you are already considering?"* offers
a third option: **"Yes — the horse I currently lease"**. Choose it → **breed and age
range fill in (Warmblood, 7–10) with the gold line**, while **budget, boarding and
intended use stay empty and still asked**.

**17. [CONFIRM — LESSONREQUEST 1/G3 + ASKRIGHT 14] The lesson-only fields come and go.**
On `/checkout` with **horse care only**: the availability picker and the "Riding
experience (years)" row are **GONE**. Add a lesson to the cart and reload — **both come
back**, and the form refuses to submit without them (the server refuses too — that half
is query-proven). A mixed cart containing one lesson also demands availability.

**18. [FIX — CLOSEOUT §3.6] `/book/rider` is retired.**
Type `/book/rider` into the address bar → you land on `/lessons`.

**19. [CONFIRM — CAREPATH 4] The cart survives the funnel switch.**
From any funnel, use Continue Shopping → pick another category → your earlier items are
still in the cart, and the modal offers Back and ✕.

---

## 2 · Staff, from inquiry to invitation

**20. [CONFIRM — CAREPATH 8 / LESSONREQUEST 3 / ASKRIGHT 15] The lead shows everything.**
Ops → Intake → open the step-1 lead.
→ The submission and its draft order with line items are both on the page, and the
**Details** list shows **every answer with readable labels** — including **"Buying the
horse they lease"** when it applies (the step-16 cart produces it).

**21. [CONFIRM — LESSONREQUEST §6.2] The ranges sit beside the picker.**
In the invite flow, the agreed-time panel shows the visitor's offered ranges next to the
date/time fields; choosing a time outside them is called out in words, never blocked.

**22. [FIX — CLOSEOUT §3.5] The agreed-time panel is on EVERY provisioning surface.**
Open Clients → **New client** (no lead behind it).
→ The same "Set the time you agreed on the call" panel is there, optional; set a time
and the primary button changes to **Book the lesson & send invitation** — one act.
Spot-check the same panel in a contact dossier's Provision section.

**23. [FIX — CLOSEOUT §1.6] Skip and restore, in the paperwork editor.**
On a client with assigned, unsigned paperwork, open First-login paperwork.
→ Each unsigned row offers **"Skip — stop this from blocking, without signing it"**;
skipping asks for a reason; the row then reads *Skipped 〈date〉 by 〈you〉 — 〈reason〉 ·
not signed, no longer blocking*, with **Restore**. A **signed** row offers no skip.

**24. [CONFIRM — PARTYROLE 1–4] The provisioning checkbox list is the whole truth.**
Provision a Deal client → all three defaults named and ticked; untick all three and the
invitee gets no documents; "+ Add another document" lists **nine**, including the two
never offered before; a contact's paperwork editor shows nine rows and saves both ways.

---

## 3 · Activation

**25. [CONFIRM — CAREPATH 12] The chain, end to end.**
Open the invitation link from step 3 in a private window, register, complete the
profile details, sign each onboarding document, land in the app.
→ If an agreed lesson was set: it shows as **scheduled** on your calendar/dashboard
(LESSONREQUEST 6's render half).

**26. [FIX — CLOSEOUT §1.3] The old link tells the truth now.**
After activating, click the **same invitation link** again (signed out).
→ The page says **"You've already activated this account — this link has done its job.
Sign in below…"** with the Sign In button. It must NOT tell you to check your inbox
for a newer email.

---

## 4 · The lease, to execution

**27. [CONFIRM — PARTYROLE 5] The counterparty round trip.**
Start a lease (New Contract) with a Lessor who has no paperwork; invite them from the
contract page; activate their emailed link in a private window.
→ They land on the **contract**, with **no signing wall and no onboarding list**, and
can sign once the contract is ready.

**28. [FIX — CLOSEOUT §1.5] Nothing extra is manufactured at lock.**
As staff, complete the lease fields, have the Lessor confirm the horse section, lock it.
→ The Lessor's documents list gains **nothing** at lock — no Emergency Vet, no Horse
Care release. **Only after both parties sign** do those two appear, awaiting the
owner's signature.

**29. [FIX — CLOSEOUT §1.1/§1.2] The screen and the gate agree.**
With the blockers panel clean, the sign button signs — no "17 required field(s) still
empty" surprise (that disagreement is closed and server-proven on a document with
conditionals; this is the eyeball half).

**30. [FIX — CLOSEOUT §1.6] Skip clears the lock gate.**
Variant: provision the Lessor as a full **Horse owner** (5 documents) first.
→ Locking the lease is refused, naming them. Skip their five in the paperwork editor
(one reason covers it) → the lease locks, both parties sign, it executes — and their
five requirements still read *skipped, not signed*.

**31. [CONFIRM — CLOSEOUT §1.4] An evergreen lease says so.**
Leave the lease end date empty.
→ After execution the horse reads **"Leased — evergreen"** (stable card) / **"evergreen
— until terminated"** (staff records), never a blank. The staff lease-end editor says
empty = evergreen; the horse intake form no longer demands an end date.

**32. [FIX — CLOSEOUT §1.8] The notification log reads back.**
On the executed contract, expand **Activity** (staff).
→ Below the event feed: **"Notification log · N resolved"** — who was told what, where
it surfaced (in-app / email), what resolved it, and when.

**33. [CONFIRM — CLOSEOUT §1.7] The envelope followed.**
The contract record shows **executed** (not draft) beside its executed document.

**34. [CONFIRM — A5 report item] Termination is reachable — and note the gap.**
Manage → Terminate → the other party approves → the contract reads Terminated.
⚠️ Known, reported, not yet fixed: the **horse record still shows the lease** after
termination — staff clear it manually on Horse Records until the follow-up lands.

---

## 5 · Visual once-overs and wording

**35. [CONFIRM — FOOTER] The map block's light-on-dark contrast** — fine or tone down?
**36. [CONFIRM — FOOTER] The signed-in "Member area" nav state** — never screenshotted
logged in.
**37. [CONFIRM — FOOTER] Real mobile Safari/Chrome pass** of `/` and the footer — the
fixed-hero pattern is the kind that differs from a headless viewport.
**38. [CONFIRM — SESSIONBOOK] `/lessons` signed in** — the plus-pass / booking controls
render against a real session (headless run only covered signed-out).
**39. [CONFIRM — PARTYROLE 6] The footer's first sentence** says "…classical European
style riding and jumper training…" — the word *hunter* is gone.
**40. [CONFIRM — ASKRIGHT 16] Wording sweep.** No screen says *"Booking Request"*,
*"Price on enquiry"* or *"Your request is empty"*, and the nav is unchanged
(*Book a Lesson*, *Horse Care Services*, *Find a Horse*).
