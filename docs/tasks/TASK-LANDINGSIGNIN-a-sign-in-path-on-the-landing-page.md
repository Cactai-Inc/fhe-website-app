# TASK-LANDINGSIGNIN — a sign-in path on the landing page

Problem: Landing.tsx renders bare — no Layout, no Footer, by design (its own header comment
confirms this) — but it does render the shared Header. Sign In lives in the footer on every
other page, and in the mobile hamburger menu on every page including landing. Desktop landing
has neither: no footer to fall back to, and the desktop header dropped Sign In on 2026-08-16 by
deliberate owner decision, moved to the footer specifically so a first-time visitor sees one
clear entry point, Say Hello. That decision is still right everywhere else — this is the one
page with no footer underneath it to catch the case, which is why the gap exists here only.

Scoped to the landing route only. Not a reversal of the 2026-08-16 decision, which holds
everywhere else. Header.tsx already knows when it's rendering on landing — the existing
`overDark` state initializes from `location.pathname === '/'`, and `location` is already in
scope in the component. Reuse that same signal; no new prop needed.

## Required behavior

Desktop only, min-[940px], matching Say Hello's own breakpoint — mobile already has Sign In in
the hamburger menu, untouched. On the landing route specifically: a text link reading "Sign In"
(matching the mobile menu's existing exact label), underlined, sized and weighted as a
subordinate link rather than a button — visually secondary to Say Hello, not competing with it.
Positioned directly below Say Hello, same horizontal position in the right cluster — wrap Say
Hello and this new link in a small vertical stack rather than adding it as another item in the
horizontal row. Links to /login, same as every other Sign In entry point in the app.

## One call made here, flagged for a look

Say Hello is wrapped in `{itemCount === 0 && (...)}` — it stands down once there's something in
the cart, on the reasoning that someone mid-selection has already found a way in. The new Sign
In link is deliberately NOT nested inside that same condition: on every other page a full cart
still leaves the footer's Sign In reachable, but landing has no footer, so if Sign In shared Say
Hello's condition, a landing visitor with cart items would lose both at once and land back at
zero entry points — the exact gap this task exists to close. Sign In shows regardless of cart
state, gated only on being on the landing route. Overridable if that's not the intent.

## Test

Load / at a desktop width (≥940px): confirm Sign In appears under Say Hello, underlined,
visibly distinct from it. Add an item to the cart from another page, return to landing, confirm
Sign In is still there even though Say Hello has stood down. Load every other page Header
renders on and confirm nothing changed — no Sign In appears outside of landing, footer and
mobile menu are unaffected. Resize below 940px on landing and confirm this new link disappears
the same way Say Hello does, since mobile already has Sign In in its own menu.
