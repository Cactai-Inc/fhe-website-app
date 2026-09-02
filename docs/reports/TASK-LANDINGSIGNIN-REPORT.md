# TASK-LANDINGSIGNIN — report

**Thread `FHE-TASK-LANDINGSIGNIN` · `wt-1` · branch `task/landingsignin` · merge-base `0ae5855f`.**
Ledger with every measurement as it was taken: `docs/reports/FHE-TASK-LANDINGSIGNIN-LEDGER.md`.

**CLNR: clean.** *(No §4 trigger fired that `CLNR-1` (2026-09-01) had not already recorded. Nothing was
moved — `SITECOPY-B` and `SIGNFLOW-A` are live in `wt-2`/`wt-3`, and "never move a file under a running
thread" outranks tidiness. One drift line for ORCH in §4 below.)*

---

## 1. THE HEADLINE

The landing page had **zero** sign-in entry points at ≥940px; it now has **one** — a small underlined
`Sign In` text link stacked under Say Hello, gated on `location.pathname === '/'`, coloured by
`overDark`, and rendered **regardless of cart state**.
**All eleven criteria in §8 pass**, including the two the spec calls the whole task (§8.3's full-cart
frame and §8.5's scrolled `/story` regression).
**The right cluster's width at 940px is unchanged: 574px before, 574px after** — the stack is vertical,
so Say Hello still sets the width.
**One consequence the spec did not name and I did not decide silently: the landing header grows 17px
taller** (105px → 122px) because a second row of type sits under a 40px button. §5.

## 2. CRITERION BY CRITERION — §8 OF THE SPEC

Everything below is pasted from `scratchpad/verify.log` (Playwright against `vite preview` on the real
`npm run build` output, not the dev server). Screenshots: `docs/reports/TASK-LANDINGSIGNIN-shots/`.

### §8.1 — `/` at ≥940px, Sign In UNDER Say Hello, underlined, subordinate ✅
```
§8.1 / @1440  SignIn visible=true text="SIGN IN" href=/login
             SayHello box  x=1268   y=31.5 w=118   h=40
             SignIn   box  x=1303.5 y=76   w=46.9  h=21.5
             BELOW Say Hello? true   horizontally inside it? true
```
`01-landing-1440-signin-under-sayhello.png`. Subordination is measured, not asserted:
```
§8.2 computed  {"color":"rgba(255, 255, 255, 0.9)","fontSize":"10px","deco":"underline","off":"4px","display":"flex","shadow":"rgba(0, 0, 0, 0.5) 0px 1px 10px"}
     SayHello  {"fontSize":"11px","border":"1px","color":"rgb(229, 205, 126)"}
```
10px vs 11px, no border vs a 1px gold outline, nav ink vs gold. It is a link; Say Hello is a button.

### §8.2 — legible over the hero ✅
Same screenshot. `text-shadow: rgba(0,0,0,0.5) 0 1px 10px` and `rgba(255,255,255,0.9)` — the identical
`heroShadow` + `navText` pair the nav itself uses (`Header.tsx:159-162`), so it cannot drift from the
nav's own legibility.

### §8.3 — 🔒 THE ACCEPTANCE CASE: full cart, `/` at ≥940px ✅
**All three facts in one frame** — `03-landing-1440-fullcart-signin-and-cart.png` (and the 940px twin,
`02-…`): Say Hello gone, **Sign In present**, **cart glyph present with its `1` badge**.
```
§8.3/8.4 / @940  FULL CART  SayHello visible=false  SignIn visible=true  Cart visible=true
§8.3/8.4 / @1440 FULL CART  SayHello visible=false  SignIn visible=true  Cart visible=true
```
⚠️ **How the cart was filled, stated plainly:** this worktree has **no network route to Supabase**
(`ERR_NAME_NOT_RESOLVED` on every catalog fetch), so `/shop` and `/lessons` render with no offerings and
there is no add-to-cart control to click. The item was written into **the app's own persistence store**
— `sessionStorage['fhe-cart-v1']`, `CartContext.tsx:69-86` — which is exactly the mechanism that carries
a real visitor's cart from `/lessons` back to `/`. `itemCount` is `state.items.length`
(`CartContext.tsx:229`), so one seeded item is the same input a real selection produces.
**The owner's checklist item 3 (§8) re-runs this with a real click.**

### §8.4 — TRAP 4: the stack survives Say Hello disappearing ✅
```
/ @940  cart=true   wrapper w=46.9 x=861.1 | SignIn w=46.9 | wrapper−SignIn slack = 0px | cart→wrapper gap = 16px  (row gap-4 = 16px)
/ @1440 cart=true   wrapper w=46.9 x=1339.1| SignIn w=46.9 | wrapper−SignIn slack = 0px | cart→wrapper gap = 22.5px (row xl:gap-5 = 22.5px measured)
/ @940  cart=false  wrapper w=103.6 | SignIn w=46.9  (wrapper = Say Hello's width)
/ @1440 cart=false  wrapper w=118.0 | SignIn w=46.9  (wrapper = Say Hello's width)
```
🔒 **Wrapper width minus Sign In width is 0px in the full-cart state — no slot is reserved where Say
Hello was**, and the gap to the cart glyph is *exactly* the row's own gap. A phantom Say Hello would
show as ~120px. **No collapse either:** the wrapper is not rendered at all unless it has a child, so it
never becomes an empty flex item spending 16px of the row's gap.
**The cart glyph does not move vertically:** `y=30` at 940 and `y=36.5` at 1440, identical to the
before-shape control (`/about`, full cart). ⚠️ **It does move horizontally, and that is unavoidable —
see §5.**

### §8.5 — 🔒 TRAP 1's regression check, WITH SCROLLING ✅
```
§8.5 /story at top      navColour=rgb(10, 26, 15)  SignIn in header=0
§8.5 /story dark sections found = 2
§8.5 /story scrolled to y=1200 → nav is WHITE = true  navColour=rgb(255, 255, 255)
§8.5 a dark section IS under the header band = true   ⇒ overDark === true
§8.5 🔒 Sign In links in the header at this moment = 0  (MUST BE 0)
```
`06-story-whitenav-no-signin.png` is the white-nav state: green section under the header, nav white,
Say Hello present, **no Sign In**. The loop scrolled in 150px steps until the computed nav colour
turned white — the defect the spec describes would have shown here and does not, because presence asks
`location.pathname` (`Header.tsx:87`) and only tone asks `overDark`.

### §8.6 — every other page at ≥940px ✅
```
§8.6 /about        header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /story        header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /shop         header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /faq          header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /ride         header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /membership   header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /lessons      header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /horse        header SignIn=0   footer sign-in=1 "Member sign-in"
§8.6 /acquisition  header SignIn=0   footer sign-in=1 "Member sign-in"
```
The footer's wording and its `user ? … : …` branch are untouched — `Footer.tsx` is not in the diff.

### §8.7 — below 940px, and exactly one Sign In at every width ✅
```
§8.7 @320   desktop SignIn visible=false  hamburger visible=true   menu SignIn: 1 visible=true text="SIGN IN"
§8.7 @768   desktop SignIn visible=false  hamburger visible=true   menu SignIn: 1 visible=true text="SIGN IN"
§8.7 @939   desktop SignIn visible=false  hamburger visible=true   menu SignIn: 1 visible=true text="SIGN IN"
§8.7 @940   desktop SignIn visible=true   hamburger visible=false  menu SignIn: n/a
§8.7 @1440  desktop SignIn visible=true   hamburger visible=false  menu SignIn: n/a
```
939 → hamburger only. 940 → link only. **Never both.** The hamburger's own Sign In was not touched.

### §8.8 — the 940px fit measurement (TRAP 3) ✅
```
§8.8 @940 BEFORE (/about, empty cart) cluster=574px nav=454.4px headerH=105px navRows=1 hOverflow=false
§8.8 @940 AFTER  (/,      empty cart) cluster=574px nav=454.4px headerH=122px navRows=1 hOverflow=false
§8.8 @940 DELTA  cluster 0px   header height +17px   wordmark y +8.5px
§8.8 @940 full cart: BEFORE(/about) cluster=490.4px  AFTER(/) cluster=553.3px  delta=+62.9px
```
🔒 **The number the spec asked for: 574px → 574px. The row's horizontal budget is unchanged**, because
the stack is a column and Say Hello (103.6px at 940) is wider than Sign In (46.9px).
*(`/about` at 940 with an empty cart is the before-shape: same four nav labels, same cart rule, same Say
Hello, no stack.)* In the full-cart state the cluster grows by 62.9px — the link's own 46.9px plus the
row's 16px gap, with the 490.4px starting point leaving 366px of slack in a 940px viewport.
**No wrap at any width ≥940:**
```
§8.8 no-wrap @940  navRows=1 signInHeight=21   horizontalOverflow=false
§8.8 no-wrap @1000 navRows=1 signInHeight=21   horizontalOverflow=false
§8.8 no-wrap @1100 navRows=1 signInHeight=21   horizontalOverflow=false
§8.8 no-wrap @1280 navRows=1 signInHeight=21   horizontalOverflow=false
§8.8 no-wrap @1440 navRows=1 signInHeight=21.5 horizontalOverflow=false
§8.8 no-wrap @1920 navRows=1 signInHeight=21.8 horizontalOverflow=false
```
`navRows` is the count of distinct `top` values across the four nav anchors — 1 means one line.

### §8.9 — clicked, not inspected (D17) ✅
```
§8.9 CLICKED the link → url=http://localhost:4181/login  h1="Welcome back"
login buttons: ["Continue with Google","Sign in with email and password"]
```
The click navigated and `/login` rendered its own two doors. *(No `input` elements at rest — the
password form is behind the "Sign in with email and password" disclosure; that is the page's existing
design, unrelated to this task.)*

### §8.10 — `npm run build` and the prerender (TRAP 6) ✅
```
BUILD EXIT: 0
prerendered / -> dist/index.html
```
The link is in the **static** HTML, before any JavaScript runs:
```html
<a class="hidden min-[940px]:inline-flex items-center whitespace-nowrap py-0.5 text-[10px] font-sans
tracking-[0.14em] uppercase underline underline-offset-4 transition-colors duration-[400ms]
focus-ring-dark text-white/90 hover:text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]"
href="/login" data-discover="true">Sign In</a>
```
`grep -c 'href="/login"' dist/index.html` → **1**, and it is this anchor. On the other nine prerendered
routes the single `/login` anchor is the footer's (`…>Member sign-in</a>`), unchanged.
⚠️ **The classes are proven to have COMPILED, not merely to be present in the markup** — the trap where
a class emits no CSS rule at all:
```
@media (min-width: 940px){ .min-\[940px\]\:inline-flex{display:inline-flex}
@media (min-width: 940px){ .min-\[940px\]\:flex{display:flex}
.text-\[10px\]{font-size:10px}   .underline-offset-4{text-underline-offset:4px}
```
and the browser's own computed style (§8.1) confirms `display:flex`, `underline`, `10px` at runtime.
**Spec premise re-verified while there:** `dist/index.html` `site-footer` = **0**; `dist/ride` = **1**.

### §8.11 — the diff surface ✅
```
$ git diff --name-only 0ae5855f
docs/reports/FHE-TASK-LANDINGSIGNIN-LEDGER.md
src/components/layout/Header.tsx
```
**One code file.** `Landing.tsx`, `Footer.tsx`, `Layout.tsx` untouched. *(Plus this report and its four
screenshots, added after the line above was taken.)*
⚠️ **`git diff --name-only origin/main` also lists `docs/reference/CHANGE-ORDER-LEDGER.md` — that is
NOT mine.** `origin/main` moved to `d6eb5691` (ORCH's CR-106/CR-107 capture) while this thread was
running; the file shows as a deletion only because my branch predates that commit. **I did not rebase**
— it is a docs file ORCH is actively writing (D40) and merging is ORCH's act.

## 3. THE REACH (D17)

| | |
|---|---|
| **What a person clicks** | the `Sign In` text link in the top-right of the landing header, under Say Hello |
| **From which page** | `/` — and `/` only, `Header.tsx:396` `{isLanding && (` |
| **Where it goes** | `/login`, `Header.tsx:398` → route `src/App.tsx:215` |
| **Is it the only way?** | At ≥940px **on `/`, yes** — that is the whole point; there is no footer on this route. At <940px on `/` the hamburger's `Header.tsx:462` is the only way, unchanged. On every other route the footer's `Footer.tsx:90-94` is unchanged. |
| **Rendered where** | `Header.tsx:360-405`, the vertical stack inside the right cluster at `:263` |
| **Present in the shipped artifact** | `dist/index.html`, statically — §8.10 |

## 3b. §2c'S THREE QUESTIONS

1. **CAPTURE → WHERE IS IT SEEN?** — **This task captures nothing.** It stores no value, writes no row,
   sets no state. It is one anchor to an existing route. There is no column with no reader here.
2. **SEEN → WHERE IS IT ACTED ON?** — The person acts on it themselves by clicking it; `/login` is a
   fully built page with two working doors (§8.9). Nothing lands in a queue for staff.
3. **WHAT ELSE DOES THE OUTCOME NEED THAT NOBODY ASKED FOR?** — The outcome is "a person at the front
   door on a laptop can get to their account." That is complete as built. **One thing worth the owner's
   eye, and it is in §5, not hidden here: the landing header is 17px taller.** Nothing else is missing.

## 4. FLAGGED, NOT FIXED — one line each

- `docs/orch/BOARD.md` RESUME says `wt-1` = SIGNBOOK running; `wt-1` was detached and clean at claim
  time, so the board is one step stale (ORCH owns the file).
- Board's `lint 46` baseline reads **45** on this tree, measured on the unmodified merge-base file
  (§7) — one stale, not a regression.
- `/shop` and `/lessons` render an empty catalog in a worktree with no Supabase route; every
  DB-backed acceptance test in this repo inherits that limit.

## 5. WHAT I DECIDED THAT THE SPEC DID NOT

1. 🔒 **The landing header grows 17px taller (105px → 122px) and the wordmark and nav drop 8.5px.**
   This is inherent to the approved shape — a second line of type under a 40px button makes the right
   cluster the tallest item in an `items-center` row, where the 44px logo used to be. **I did not try
   to hide it** (an absolutely-positioned link would keep the height but breaks the moment Say Hello
   stands down, which is TRAP 4's exact failure). ⚠️ **Landing only, and only with an empty cart** — in
   the full-cart state the header is 105px, identical to before. The header is transparent on this
   route and never scrolls, so nothing else on the page moves. **Owner checklist item 1.**
2. ⚠️ **In the full-cart state on `/`, the cart glyph shifts LEFT by 62.9px at 940px (69.4px at 1440).**
   §8.4 says "the cart glyph has not moved." **It has not moved vertically, and no space is reserved for
   the absent Say Hello (slack = 0px)** — but a right-anchored row cannot gain a visible 46.9px link
   without its neighbours moving by exactly that link plus one gap, which is what happened. **Reporting
   it rather than claiming the criterion whole.**
3. **Alignment: `items-center`** — Sign In is centred under Say Hello rather than flush to the right
   rail, so it reads as attached to the button above it. The spec said "same horizontal position",
   which permits either.
4. **The wrapper carries the `min-[940px]` breakpoint itself**, in addition to both children keeping
   theirs. Without it an always-present wrapper is a zero-width flex item below 940px and the row's
   `gap-4` puts 16px of dead air beside the hamburger — a mobile regression, and TRAP 7 says mobile is
   already correct. For the same reason the wrapper renders only when it has a child
   (`{(itemCount === 0 || isLanding) && (`): on an inner page with a full cart both children are absent.
5. **Two stale comments in `Header.tsx` amended** (`:7-27` "the nav is identical everywhere" and
   `:34-38` "Sign In leave the header entirely and live in the footer only"). Both were false the
   moment this shipped. The 2026-08-16 decision is quoted intact with the amendment beneath it, so the
   original ruling is still readable.
6. **Screenshots committed at 1200px wide, four of them (~1.0 MB)** rather than the full set —
   `CLNR-1` flagged ~57 MB of committed screenshot dumps as a standing problem.

## 6. WHERE THE SPEC WAS WRONG

**Nowhere material — it is the most accurate spec this thread has been handed.** Every line number in
§2 re-verified exactly: `:54` `location`, `:55` `itemCount`, `:73` `overDark`, `:258` the right cluster,
`:334` the cart gate, `:342` Say Hello's breakpoint, `:410` the label `Sign In`, `Footer.tsx:91,94`,
`Story.tsx:223` and `:512`, `App.tsx:215` *(spec said `:217` — off by two, cosmetic)*, `dist/index.html`
carrying no `site-footer` while `dist/ride/index.html` does.
**TRAP 1 was right and it mattered:** `overDark` really does flip to `true` on `/story` after ~1200px of
scroll (§8.5), so a link gated on it really would have appeared on a page that already has one.
**One imprecision:** §2's premise table cites `Header.tsx:373` for the mobile breakpoint — `:373` is the
mobile menu *sheet*; the hamburger *button* is `:356`. Both carry `min-[940px]:hidden`, so the claim
holds.

## 7. THE TELL, AND HOW IT IS UNDONE (D19)

**No D19 flags.** A navigation link moves no money, no credits, no documents and no state; it writes no
row and sends nothing. **The tell is the link itself and the `/login` page it lands on.** **The undo for
the visitor is the browser's back button; the undo for the change is `git revert`** of the single
commit, which touches one file.

## 8. THE OWNER'S RENDER CHECKLIST

⚠️ **No worktree has a staff login and none of this was simulated.** Run these on a **laptop** and on
**your phone**.

1. **Laptop, `/`.** `SIGN IN`, small and underlined, directly under `SAY HELLO`, top right.
   ⚠️ **The one thing to judge: the header sits 17px taller here than it used to, so the nameplate and
   nav sit ~8px lower on this page only.** If that reads wrong, say so — it is the cost of stacking and
   it is reversible.
2. **Laptop, `/`.** Can you read `SIGN IN` against the hero? It carries the same shadow as the nav.
3. **Laptop.** Put something in your cart on `/lessons`, then go back to `/`. **`SAY HELLO` is gone,
   `SIGN IN` is still there, and the cart bag with its number is beside it.** This is the case the whole
   task is for. *(The thread proved this with a seeded cart; this is the real click.)*
4. **Laptop.** Click `SIGN IN` → the sign-in page loads.
5. **Laptop, narrow the window** until the menu turns into a hamburger. `SIGN IN` disappears from the
   bar and is inside the menu. **Never two at once.**
6. **Laptop, `/story`.** Scroll down until the nav turns white over a green section. **No `SIGN IN`
   should appear.** Scroll further; still none.
7. **Laptop, any other page.** The footer still says `Member sign-in` and still works.
8. **Your phone, `/`.** ⚠️ **Nothing should have changed at all** — hamburger, and `SIGN IN` inside it.

## 9. TEARDOWN CENSUS

```
$ pkill -f "vite preview"                 # the one server this thread started (port 4181)
$ lsof -nP -iTCP:4181 -sTCP:LISTEN        # (empty — down)
$ ps ... | grep -i -E "chromium|playwright|headless" | wc -l
0
$ ps -Ao pid,ppid,etime,command | grep vite
39646  1      04:02  npm exec vite --config test/browser/vite.config.ts --port 5199 --strictPort
39662  39646  04:02  node /…/wt-2/node_modules/.bin/vite --config test/browser/vite.config.ts --port 5199
$ git worktree list
/Users/Cactai/Downloads/claude-code-repo/fhe-website-app  d6eb5691 [main]
/Users/Cactai/Downloads/claude-code-repo/wt-1             1567d24c [task/landingsignin]   ← this thread
/Users/Cactai/Downloads/claude-code-repo/wt-2             65064905 [task/sitecopy-b]
/Users/Cactai/Downloads/claude-code-repo/wt-3             4875c308 [task/signflow-a]
```
⚠️ **The two surviving `vite` processes on port 5199 are `wt-2`'s — `FHE-TASK-SITECOPY-B`, a live
sibling. Deliberately NOT killed.** Everything this thread started is down: the port-4181 preview
server, and every Playwright chromium (each script ends `await b.close()`; the count above is 0).
**No scratch worktree was created**; scratch scripts and the full 13-screenshot set live outside the
repo in the session scratchpad, and the `node_modules` symlink into it has been removed.
**`wt-1` stays claimed on `task/landingsignin` until ORCH merges.**

⚠️ **Census note for ORCH:** `wt-2` and `wt-3` were detached and idle when this thread claimed `wt-1`;
they are now on `task/sitecopy-b` and `task/signflow-a`. **All three of wave 2 are live.**
