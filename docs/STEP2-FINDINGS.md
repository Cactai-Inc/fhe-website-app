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

*(sweep continuing)*
