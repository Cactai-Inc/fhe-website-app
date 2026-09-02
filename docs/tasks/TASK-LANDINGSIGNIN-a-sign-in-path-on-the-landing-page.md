# TASK-LANDINGSIGNIN — a sign-in path on the landing page

**Spec by `FHE-DSNR-SITE-PUBLIC`, 2026-09-01.** **Thread name: `FHE-TASK-LANDINGSIGNIN`.**
**Rebased in place from the owner's 2026-08-24 chat-thread draft.** ⚠️ **Every path in that draft has
moved and its central mechanism was wrong. See §2 and TRAP 1 — do not work from a remembered version
of this file.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **Not repeated here.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-LANDINGSIGNIN-LEDGER.md` FIRST.
> - `CLAUDE.md` **D17** (`:365`) — reachable, or it is not done. **This task exists because one page
>   has zero reachable sign-in entry points at desktop width.**
> - `CLAUDE.md` **D20** (`:406`) — *"a state claim in a doc is a hypothesis."* Including this spec's.
> - `src/components/layout/Header.tsx` — **read `:60-122` before you write a line.** TRAP 1 lives there.

---

## 1. THE PROBLEM, AND WHY IT IS THIS PAGE ONLY

`src/pages/Landing.tsx` renders **bare** — no `Layout`, no `Footer`, by design; its own header comment
says so (`Landing.tsx:9-23`, *"The page renders bare (no Layout footer chrome)"*). **But it does render
the shared `Header`** (`Landing.tsx:7`).

Sign-in lives in **two** places today, and the landing route has neither at desktop width:
- **the footer**, on every page that has one — `src/components/layout/Footer.tsx:90-94`. **Landing has
  no footer.**
- **the mobile hamburger menu**, on every page including landing —
  `src/components/layout/Header.tsx:406-411`. **Hidden above 940px** (`:373`, `min-[940px]:hidden`).

The desktop header dropped Sign In on **2026-08-16 by deliberate owner decision** — carried verbatim
in `Header.tsx:316-318`: *"Member Area and Sign In used to sit here; both moved to the footer (owner,
2026-08-16), so a first-time visitor sees one way in and no account chrome."*

🔒 **That decision still holds, everywhere else. This is not a reversal of it.** Landing is simply the
one page with no footer underneath to catch the case, which is why the gap exists here and nowhere
else.

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01, `main` at `4297345a`

⚠️ **THE DRAFT'S PATHS ARE ALL STALE. The component moved.**

| The draft said | Where it actually is, today |
|---|---|
| `src/components/Header.tsx` | 🔒 **`src/components/layout/Header.tsx`** (418 lines) |
| `Footer.tsx` | 🔒 **`src/components/layout/Footer.tsx`** |

| Premise | Verified? | The measurement |
|---|---|---|
| Landing renders `Header` but no `Footer` | ✅ | `Landing.tsx:7` imports it; `dist/index.html` (the prerender of `/`) contains **zero** occurrences of `site-footer`, while `dist/ride/index.html` contains it. |
| `location` is already in scope in the component | ✅ | `Header.tsx:54`, `const location = useLocation()` |
| `itemCount` is in scope | ✅ | `Header.tsx:55`, `const { itemCount } = useCart()` |
| Say Hello stands down on a non-empty cart | ✅ | `Header.tsx:334`, `{itemCount === 0 && (` … `)}` closing at `:350` |
| Say Hello's breakpoint is 940 | ✅ | `Header.tsx:342`, `hidden min-[940px]:inline-flex` |
| The mobile menu's label is exactly `Sign In` | ✅ | `Header.tsx:410` |
| Say Hello sits in the right cluster | ✅ | `Header.tsx:258`, `<div className="justify-self-end flex items-center gap-4 xl:gap-5">` |
| ⚠️ *"the footer's Sign In"* | **IMPRECISE** | The footer's label is **`Member sign-in`**, and it is conditional: `Footer.tsx:91,94` → `to={user ? '/app' : '/login'}`, `{user ? 'Member area' : 'Member sign-in'}`. **The rationale in §1 survives; the wording claim did not.** |
| ⚠️ *"reuse `overDark`, it knows when it's on landing"* | 🔒 **FALSE. See TRAP 1.** | `Header.tsx:73` initialises from `location.pathname === '/'`, but `:84-121` **overwrites it on every scroll and resize, on every route.** |

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE onto `/login`, greenfield only in placement

**There is no second sign-in mechanism to build.** Every existing entry point links to the same place:
`Footer.tsx:91` → `/login`, `Header.tsx:407` → `/login`, route at `src/App.tsx:217`.
**You add a third link to the same route. You do not add an auth affordance, a modal, or a form.**

**The visual incumbent is Say Hello itself** (`Header.tsx:342-348`). The new link sits beneath it and
must read as **subordinate to it**, not as a second button.

## 4. THE TRAPS

**TRAP 1 — 🔒 `overDark` IS A TONE SIGNAL, NOT A ROUTE SIGNAL. THE DRAFT WAS WRONG. DO NOT GATE ON IT.**
`Header.tsx:73` initialises `overDark` from `location.pathname === '/'` — and that is the *only*
moment it means "landing". From `:84` onward an effect re-measures it on **scroll and resize, on
every route**, by sampling `[data-header-tone="dark"]` elements against the header band (`:97-104`).

**Proof it would misfire:** `src/pages/Story.tsx:223` and `:512` both carry `data-header-tone="dark"`.
**Scroll `/story` until one of those green sections passes under the header and `overDark` becomes
`true` — and a Sign In gated on it would appear on a page that already has one in its footer.**

🔒 **Gate on `location.pathname === '/'` directly.** `location` is already in scope at `:54`; no new
prop, no new state, no new hook. ⚠️ **A `const isLanding = location.pathname === '/'` beside the
existing state is the whole mechanism.**
**You may still use `overDark` for COLOUR** — the link sits over the dark hero and must read against
it, exactly as Say Hello does at `:342-347`. **Tone: `overDark`. Presence: `pathname`. Two different
questions; the draft merged them.**

**TRAP 2 — ⚠️ SIGN IN MUST *NOT* BE NESTED INSIDE `{itemCount === 0 && …}`.**
Say Hello stands down once the cart has items — owner, 2026-08-17, quoted at `Header.tsx:325-333`.
**On every other page a full cart still leaves the footer's sign-in reachable. Landing has no footer.**
If Sign In shared that condition, a landing visitor with cart items would lose **both at once** and be
back at zero entry points — the exact gap this task closes.
🔒 **Sign In renders whenever the route is `/` and the width is ≥940px, regardless of cart state.**
⚠️ **This was flagged "overridable" in the draft. DSNR closed it, and then the OWNER RULED ON IT.**

> ## 🔒 OWNER RULING, 2026-09-01 — THE SHAPE IS APPROVED. VERBATIM:
> > *"thats correct, a person with things in their cart needs to go to the cart not the say hello
> > contact us form page."*
>
> 🔒 **So the full-cart corner is deliberate and complete: the CART is the way onward, and Sign In is
> the way in. Say Hello is correctly absent — it would send a person mid-selection to a contact form
> instead of to the inquiry they are already building.**
> **Verified 2026-09-01 that his rationale holds in the code:** `Header.tsx:156-171`, `cart()` is
> gated on `itemCount > 0` ONLY — **no breakpoint, no route condition** — and it links to
> `/checkout` (`:158`). It is rendered in the right cluster at `:314`, **so it is present on the
> landing page at every width.** ⚠️ **If the cart glyph were NOT on landing, this ruling would not
> hold. Confirm it renders there before you finish (§8.3).**

**TRAP 3 — the right cluster is a horizontal flex row** (`Header.tsx:258`). **Do not add the link as a
fifth item in that row** — that row's fit floor is already measured at 940px and the comment at
`:259-271` records that adding to it is what broke the header before (595px of labels at
`tracking-widest`, which is **0.25em**, ~1117px needed). **Wrap Say Hello and the new link in a small
vertical stack**, so the row's horizontal budget is unchanged. ⚠️ **Measure the row at exactly 940px
after your change and put the number in the report.**

**TRAP 4 — the stack must survive Say Hello disappearing.** Because of TRAP 2, at `itemCount > 0` the
stack contains **only** Sign In. **It must not collapse, shift the cart glyph, or leave a gap where
Say Hello was.** Check both cart states at 940px and at 1440px.

**TRAP 5 — landing does not scroll.** `Landing.tsx:31-35` adds `qs-no-scroll` to `<html>` on mount.
**So the header never minifies or frosts here, and `overDark` never flips.** Do not build anything
that depends on a scroll event on this route.

**TRAP 6 — `/` is prerendered.** `scripts/prerender.mjs:21` renders `/` to `dist/index.html`.
**Your change ships into static HTML**, so it must be SSR-safe: no `window`/`document` at render time.
`location.pathname` from `useLocation()` is safe; `window.location` is not.

**TRAP 7 — mobile is already correct. Do not touch it.** `Header.tsx:406-411` gives every route,
landing included, a Sign In in the hamburger. **The new link is `hidden min-[940px]:inline-flex`,
matching Say Hello's own breakpoint at `:342`**, so below 940px exactly one of the two mechanisms is
live. **Two visible Sign Ins at any width is a failure.**

## 5. REQUIRED BEHAVIOUR

- **Route:** `/` only.
- **Width:** desktop only, `min-[940px]`, matching Say Hello's breakpoint verbatim.
- **Label:** `Sign In` — **the mobile menu's exact existing label** (`Header.tsx:410`). ⚠️ **Not
  `Member sign-in`** (the footer's), and not `Log in`.
- **Target:** `/login`. **Unconditional** — do **not** copy the footer's `user ? '/app' : '/login'`
  branch. A signed-in visitor on the landing page is out of scope and `/login` already handles it.
- **Treatment:** a **text link, underlined**, sized and weighted as a **subordinate** link, not a
  button. It must not compete with Say Hello. Colour keys off `overDark` for legibility over the
  hero, the same way Say Hello's does at `:342-347`.
- **Position:** directly **below** Say Hello, same horizontal position in the right cluster — a small
  vertical stack, not a new row item.
- **Cart:** always shown. See TRAP 2.

## 6. THE REACH — and the case that proves it

| Width | Route | Sign-in entry points BEFORE | AFTER |
|---|---|---|---|
| ≥940px | `/` | ⚠️ **0** | **1** — the new link |
| ≥940px | `/` with items in cart | ⚠️ **0** | **1** — TRAP 2's case, **plus the cart glyph → `/checkout`** |
| <940px | `/` | 1 (hamburger, `:406-411`) | **1 — unchanged** |
| ≥940px | every other page | 1 (footer, `Footer.tsx:90-94`) | **1 — unchanged** |
| <940px | every other page | 2 (hamburger + footer) | **2 — unchanged** |

🔒 **Row 2 is the acceptance case.** A desktop visitor who put something in the cart on `/lessons` and
came back to `/` is the person this task is for.

## 7. THE TELL, AND HOW IT IS UNDONE (D19)

**No D19 flags** — a navigation link moves no value, writes no row, sends nothing.
**The tell is the link itself and the `/login` page it lands on. The undo is the browser back button;
the undo of the change is `git revert`.** ⚠️ **State this in the report rather than omitting the
section.**

## 8. THE TEST THIS MUST PASS

Built from the owner's own acceptance lines in the 2026-08-24 draft, plus the two traps that draft got
wrong.

1. **`/` at ≥940px.** Sign In appears **under** Say Hello, underlined, visibly subordinate to it.
   **Screenshot.**
2. **Legible over the hero.** Same screenshot: the link reads clearly against the dark image, as Say
   Hello does.
3. **🔒 TRAP 2's case — the owner has ruled on this exact frame.** Add an item to the cart on another
   page, return to `/` at ≥940px: **Say Hello is gone, Sign In is still there, and the cart glyph is
   there beside it.** ⚠️ **All three facts in one screenshot.** **The cart is what makes his ruling
   true — a frame showing Sign In but no cart is a FAIL, not a pass.** A report without this
   screenshot is incomplete.
4. **TRAP 4.** In that same state the cart glyph has not moved and no gap remains. Screenshot at
   **940px** and at **1440px**.
5. **🔒 TRAP 1's regression check — and it requires SCROLLING, not just loading.**
   Load `/story`, **scroll until a `data-header-tone="dark"` section (`Story.tsx:223` or `:512`) is
   under the header and the nav turns white** — confirm **no Sign In appears**.
   ⚠️ **"I loaded the other pages and saw nothing new" does NOT pass this. The defect only shows after
   scrolling.** Screenshot the white-nav state with no Sign In.
6. **Every other page `Header` renders, at ≥940px:** no Sign In in the header; the footer's
   `Member sign-in` is unchanged; the mobile menu is unchanged.
7. **Below 940px on `/`:** the new link is gone, exactly as Say Hello is, and the hamburger's Sign In
   still works. **Exactly one Sign In at every width. Sweep 320 / 768 / 939 / 940 / 1440.**
8. **The 940px fit measurement** (TRAP 3), stated as a number: the right cluster's width at exactly
   940px, before and after. **No two-line wrap at any width ≥940px.**
9. **The link goes to `/login`** and the page loads. **Clicked, not inspected** (D17).
10. **`npm run build` passes and `/` still prerenders.** `dist/index.html` contains the new link in
    its static HTML — proving TRAP 6.
11. **`git diff --name-only` names `src/components/layout/Header.tsx` and nothing else.**
    ⚠️ **`Landing.tsx`, `Footer.tsx` and `Layout.tsx` are not touched.**

## 9. WHERE THE REPORT GOES

`docs/reports/TASK-LANDINGSIGNIN-REPORT.md`, ledger at
`docs/reports/FHE-TASK-LANDINGSIGNIN-LEDGER.md`.
**Carry into the report:** the 940px measurement (§8.8), and the screenshots for §8.3 and §8.5 — those
two are the whole task.
