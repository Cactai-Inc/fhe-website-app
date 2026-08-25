# STEP 2 — FACT-FINDING

**Started 2026-08-25.** Answers to the assignments in `docs/CHANGE-ORDER-LEDGER.md`.
Plain language; the code references are there so the task thread can go straight to the line.

---

## ✅ ASSIGNMENT 1 — CR-52: the "account is being activated" page

**It is not a page and it has no route.** It is what the app shows **whenever someone is signed in
but has no active membership** — `src/components/ProtectedRoute.tsx:117-138`. Two versions:

| | Says |
|---|---|
| while it retries | *"Almost there — Activating your account… Just a moment while we finish setting you up."* |
| when it gives up | *"We couldn't activate your account. You're signed in, but we couldn't find an active invitation for <email>."* |

**The first one is the liar.** Nothing is being activated; the app is checking, failing, and
describing the failure as progress.

**Why both reported routes land here:** it is not tied to any address. **Any** signed-in visit to a
member area with no active membership shows it — a deleted account whose sign-in still succeeds, or
a stale session going straight to `/app`.

⚠️ **It is a GUARD, not a page** — so "delete the page" means **change what the guard renders**:
send them to login. The guard itself must stay; it is what keeps non-members out.

---

## ✅ ASSIGNMENT 2 — CR-64: two separate bugs, both one line

**`src/pages/app/Onboarding.tsx:838-850`.**

**Bug 1 — the page is blind to the very task that sent him.**
It decides there is nothing to do by asking three questions: *any documents needed? any purchase?
any standing weekly slot?* **It never asks whether a first lesson is still to be booked** — which is
exactly what the dashboard notification is about. So Abby has nothing on those three, the dead-end
renders, and the `?step=shop` on the link is **ignored entirely**.

**Bug 2 — the button goes where it says it doesn't.**
`<Link to="/app">Back to your dashboard</Link>`. ⚠️ **`/app` is the community feed** — the dashboard
is `/app/dashboard` *(`App.tsx:250-251`: `/app` renders Home, `/app/dashboard` renders the
dashboard)*. **The label is right and the address is wrong.**

⚠️ **Not an inverted condition** *(the theory in the ledger)* — it is a wrong destination, and it is
literally one path.

---

## ✅ ASSIGNMENT 3 — CR-57: mobile is a single column. Confirmed.

`src/pages/app/AccountHub.tsx:133` — `grid lg:grid-cols-2`.

**One column below 1024px, two at 1024px and up.** ⚠️ **The split is at LG, not at phone size** — so
**tablets get the single-column layout too**, and the down-arrow rule applies to them as well as to
phones.

---

## ✅ ASSIGNMENT 4 — CR-54: it is coded that way. Two lists, two reads.

`src/components/app/DocumentsContent.tsx` renders **two independent sections**, and a signed
document satisfies both:

| | Section 1 — `signables` | Section 2 — `executedRows` |
|---|---|---|
| heading | **"Contracts you've signed"** *(line 403)* | *(none)* |
| knows | **the role** — *"You sign as client."* | **the date** — *"Signed · 8/24/2026"* |
| buttons | Read · **Download signed PDF** · Resend | Read · Resend |

**Neither read knows what the other knows** — which is exactly what the screenshots show, and why
one set has the PDF button and the other does not.

⚠️ **Nothing was duplicated by refreshing or by the back button.** No data is doubled. **Two
renderers have always existed**, and the "add a PDF button" change landed on one of them — his
first guess was right.

**The fix is a merge, not a delete:** one list, keyed by document, carrying **both** the role and the
date, with the PDF button on it. ⚠️ **Deleting either section alone loses information** — drop
section 1 and the role goes, drop section 2 and the signed date goes.

---

## ⏳ ASSIGNMENT 5 — CR-65: where every flow ends

**First entry, from Assignment 2:**

| Flow | Exit label | Actually goes to | Should go to |
|---|---|---|---|
| Onboarding dead-end | *"Back to your dashboard"* | **`/app` — the community feed** | dashboard if notifications, feed otherwise |

## ✅ ASSIGNMENT 5 — CR-65: **it is a pattern, not one bug. THREE buttons lie the same way.**

You asked whether other buttons say one thing and do another. **Yes — three, and they are all the
identical mistake.** Someone treated `/app` as "the dashboard" throughout; **`/app` is the community
feed** and the dashboard is `/app/dashboard`.

| Where | The label says | It actually goes to |
|---|---|---|
| `Onboarding.tsx:842` | **"Back to your dashboard"** | the community feed |
| `EvaluationsPage.tsx:53` | **"← Dashboard"** | the community feed |
| `AcquisitionIntakePage.tsx:72` | **"Back to dashboard"** | the community feed |

**Two more exits go to `/app` and are arguably right, but neither obeys the landing rule:**
| Where | After | Goes to |
|---|---|---|
| `CreateModal.tsx:348` | posting to the feed | the feed — **correct**, you just posted there |
| `Redeem.tsx:46` | redeeming a gift | the feed — ⚠️ **should follow the rule: dashboard if notifications** |

⚠️ **`ProtectedRoute` also bounces to `/app` in five places.** Once the landing rule exists it should
be **one helper**, not fourteen literals — otherwise the fourteenth gets it wrong again.

---

## ✅ CR-39 — COMPING IS ALREADY BUILT. All three of your requirements are met.

⚠️ **This is the biggest "already exists" of the whole pass.** `grant_lesson_credit` takes a **mode**
— `handwrite` · **`comp`** · `bill` — and a **reason**, and comping already does exactly what you
described:

| Your requirement | What it already does |
|---|---|
| **"not just marking it paid"** | line price is set to **0**, and the payment method is recorded as **`comp`** — not as money received |
| **"records a loss"** | the **list price is stored on the line**, and `comped_credit_value()` reports **list price × quantity as LOSS**, per month, staff-only |
| **"give the client a free credit"** | credits are granted in the same act |
| *(you didn't ask, it does it anyway)* | the order is annotated **"Comped by staff — <reason>"**, and a reason is required |

**It is reachable:** `GrantCreditDialog` and the Lesson Credits page.

**So CR-39 is not a build. It is two extensions:**
1. ⚠️ **It only comps LESSON CREDITS.** You asked to comp **an offering or an order** — comping an
   existing order or one line of it does not exist.
2. ⚠️ **Client-side visibility is unverified.** *"they dont see they got something free."* The line is
   £0 and the method is `comp`, so the data is there — **what the client's own order view shows must
   be checked before assuming it is missing.**

## ✅ CR-40 — discounts: nothing exists, **but the seam does**
**No discount, comp, write-off or adjustment column exists anywhere in the database.** However,
comping already stores **`list_price` on the line** while charging something different. **That is
exactly the shape a discount needs** — list price kept, charged price differs, difference is
reportable. **Build discounts on the mechanism comping already proved, not beside it.**

## ✅ CR-38 — quantity is fully wired and has never been used
`quantity` exists on every order line and is read by **fourteen** functions — credits minted, order
totals, fulfilment units, recurring days. **Every row in production is `1`.** ⚠️ **Same pattern as
the booking states and the request stages: built, wired, never driven.** Setting it is a UI job, not
a schema job — but **what quantity MEANS for a weekly service still needs your answer** (visits per
week vs weeks bought).

## ✅ CR-42 — the redeemable spine exists: **gifts**
`gifts` already carries a **`code`**, **`redeemed_at`** and **`redeemed_user_id`**, with ten
functions around it — create, claim-link, open, redeem, transfer, mark-sent. **That is a redeemable
item, issued to someone who did not buy it, exactly what an incentive is.**
⚠️ **What is missing is the AUDIENCE.** Every one of those functions addresses **one named person**.
There is no concept of sending anything to a group or to everyone. **"To someone" is built; "to
everyone" is the new part.**

---

## ⚠️ CR-47 / CR-43 / CR-50 — A CORRECTION TO MY OWN RECOMMENDATION

I told you to gate lead access on **membership status**. **Fact-finding says that is not sufficient
as things stand**, and you should know before we design it:

- **`members.status` allows exactly three values: `active`, `paused`, `cancelled`.** All sixteen
  members are `active`.
- **There is no status meaning "has an account, is not a client yet."** `paused` means something
  else; `cancelled` means something else.
- So the gate mechanism exists (**app access already requires an active membership**) but **the state
  you want does not**. Either a fourth status is added, or the lead/client distinction is carried
  somewhere else.

⚠️ **Also: `promote_contact_to_account` already exists — and it is NOT what its name suggests.** It
is an identity **merge** (linking a login to a contact record), and it contains **seven hardcoded
account IDs** in deny-lists. It is not lead→client promotion, and **its name will mislead whoever
builds CR-59.**

---

## G9 SWEEPS

**CR-48 — "Guest" → "Visitor":** thirteen files of on-screen wording, **plus three database rows
keyed on the literal word `Guest`** (`category_document_requirements`). ⚠️ **Contacts carry no
`guest` tag at all**, so nothing has to be re-tagged — but those three rows are matched by the word,
so renaming the word without them silently breaks the visitor paperwork rule.

**CR-61 — avatars:** ⚠️ **`initials()` is written FOUR separate times**, in `RosterCard`,
`communityFeed`, `Messages` and `ContactsPage`, and 22 files touch avatars. **Four implementations of
"what letter do we show" is why the rule is inconsistent** — there is no one place to apply "never
the letter where others can see you."

**CR-58 — add controls:** thirteen different labels for the same act, and they do not even agree on
capitalisation: *"+ Add New"* (×5), *"+ Add new"* (×2), *"+ Add a location"*, *"+ Add item"*,
*"+ Add gear"*, *"+ Add a supply"*, *"+ Add an offering"*, *"+ Add a new horse"*, *"+ address"*,
*"+ add"*. ⚠️ **You spotted three disagreeing on one card. There are thirteen across the app.**

