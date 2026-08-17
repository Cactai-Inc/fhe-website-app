# TASK FOOTER REPORT — a map beside Find Us, sign-in in the nav, and the credit line

**Base:** `origin/main` @ `5a6d1fb`, branch `task/footer`, worktree
`~/Downloads/claude-code-repo/wt-footer`. Presentation only — no migrations, no
RPCs, no data changes. **Do not push; the orchestrator merges.**

**Files changed:** `src/components/layout/Footer.tsx` only.
`npm run typecheck`: 0 errors. `npm run lint`: 0 errors, 46 warnings (all
pre-existing, none in `Footer.tsx` — confirmed with `npm run lint | grep
Footer.tsx`, no output). `npx vitest run test/ui`: 3 failed / 130 passed / 5
skipped — the same three files named in the task's TRAPS section
(`pluspass_create_controls`, plus two others in that red set) fail with the
same pre-existing errors (missing `listMfaFactors` mock, `window is not
defined`); nothing in the failures touches `Footer.tsx` or footer rendering,
and no test file references `Footer` at all (`grep -rl Footer test/` →
nothing). No new failures introduced.

Screenshots in `docs/reports/footer-shots/`: `footer-desktop.png` (1440px),
`footer-tablet.png` (800px), `footer-mobile.png` (390px), all taken with a
real headless Chrome (`scripts/shot-footer.mjs`, new — see note at the end)
against the live dev server on `/faq`.

---

## F1 — the map joins Find Us: DONE

Grid changed from `md:grid-cols-3` (Brand · Navigation · Find Us) to
`grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (Brand · Navigation · Find Us ·
Map). This puts Find Us and Map adjacent as a pair at both the `md` (2-col:
Brand+Nav row, then Find Us+Map row) and `lg` (4-col, all in one row)
breakpoints, and stacks everything to one column below `md` so the map never
competes with the contact details for width on an actual phone. See the three
screenshots — desktop and tablet both read as intended, mobile stacks Find Us
full-width above the map, contact details untouched.

Embed: `https://www.google.com/maps?q=Carmel+Creek+Ranch,+San+Diego,+CA&output=embed`
— Google's key-less embed, per the DEFAULTS section (pin, not street address).
It resolves correctly — the screenshots show a pin labelled "Carmel Creek
Ranch" placed where the footer's own "2.5 miles from Torrey Pines Beach" copy
says it should be. `title`, `loading="lazy"`, fixed aspect
(`aspect-[4/3]` on mobile/tablet-stacked, `h-full` matching the Find Us column
on desktop) so it can't cause layout shift, wrapped in a rounded
`border-white/10` frame.

**CSP:** checked `vercel.json`, `index.html`, and grepped the whole repo for
`Content-Security-Policy` — **there is no CSP configured anywhere in this
app.** There is nothing for the iframe to break.

**How it looks (owner should eyeball, per THE TEST item 6):** Google's default
light-tile map does contrast against the dark green footer, as the task
predicted. The rounded card frame keeps it from looking like a stray hole in
the layout, and honestly it reads reasonably well as a bright accent next to
the dark column in the screenshots — but that's a subjective call the owner
should make, not one I made for them. If it's too glaring, the fix is either
a styled/dark map (requires a Maps JavaScript API key + Cloud Console setup —
out of scope for a presentation-only task) or a lower-contrast treatment
(reduced opacity, grayscale filter) applied to the current key-less embed.

**Mid-session addition — the real address, and a tappable card (owner,
2026-08-17):** the owner supplied the actual Google-listing address ("same as
CCR but we're listed as STE A") and asked for tap-to-open-Maps behavior:
*"the visitor should see the map, tap it and their google map or apple map
opens and they see our listing page and they can click a button to get the
directions started."*

- **Address, verified against prod, not the migration file.** The
  `locations` row for Carmel Creek Ranch
  (`2d771cea-5150-43b9-8e3d-38faa434a07d`) has `address_line1 = '11600 Clews
  Ranch Road'` — the migration comment in
  `20260803010001_horse_location_multiline.sql` says "11500", which is
  **wrong**; I queried the live row directly (`psql`, read-only `SELECT`, no
  write) rather than trust the file, per the repo's working rule. Query now
  used for both the embed and the outbound link:
  `French Heritage Equestrian, 11600 Clews Ranch Road, Ste A, San Diego, CA
  92130`. **This did not touch the `locations` table or any other data** —
  presentation-only, per the task; the visible "Find Us" text block still
  reads the deliberately-imprecise "Carmel Creek Ranch, San Diego, CA," only
  the map's own query string changed.
- **The query resolves to the real verified listing**, not a generic pin —
  visible in `footer-desktop.png`/`footer-mobile.png` as a red marker
  labeled "French Heritage Equestrian" (the earlier screenshots, before this
  address, showed an unlabeled generic pin). That's a good sign the Business
  Profile at that address is real and findable.
- **Tap-to-open, built as an overlay, not a wrapped iframe.** An `<a>`
  wrapping an `<iframe>` doesn't work — clicks landing inside the iframe's
  boundary go to the iframe's own content (panning the map, or its tiny
  built-in "Open in Maps" chip), not the outer link. So the iframe is now
  `pointer-events-none` and purely a visual preview
  (`aria-hidden`, `tabIndex={-1}`); a full-cover `<a
  className="absolute inset-0">` sits on top and is the actual single tap
  target for the whole card, with a small "Get Directions" badge
  (bottom-right, visible in both screenshots) as a visual affordance so it
  doesn't read as a dead embed. `target="_blank" rel="noopener noreferrer"`.
- **The link is a universal Google Maps URL**
  (`google.com/maps/search/?api=1&query=…`), not a scheme-specific one. On a
  phone with the Google Maps app installed, iOS/Android both treat
  `google.com/maps` links as a universal/app link and hand off to the app
  directly; without the app installed it opens Google Maps in the browser.
  Either way the visitor lands on Google's own listing page with Google's own
  Directions button — I did not build a directions button, because Google's
  is the "real" one the owner is describing. I did not build an
  Apple-Maps-specific path (`maps://` / UA-sniffing to pick a scheme) — that
  would add real complexity for a presentation-only task, and the universal
  URL already produces the described experience (tap → app opens → their
  listing → Directions) on the platforms most visitors carry. Flagging in
  case the owner wants Apple Maps as an explicit alternate, not just Safari's
  own handoff behavior.
- **If the owner has the Business Profile's own share link** (a
  `maps.app.goo.gl/…` short link, or a full `…?cid=…` URL, from the "Share"
  button on their own listing), that would point more precisely at the exact
  verified card than a name+address search does, and swapping it into
  `MAPS_LISTING_URL` in `Footer.tsx` is a one-line change — I used the
  search-query form because I don't have that link, not because it's the
  better choice.

## F2 — sign-in moves into the footer nav: DONE

The bottom-bar `Member area` / `Member sign-in` link is gone; the same
`<Link to={user ? '/app' : '/login'}>` with the same ternary label now renders
as the last item in the Navigation list, using the same className as every
other nav link (the old low-key `text-white/[0.45]` styling is dropped, per
the task). **The signed-out variant is visually confirmed** in all three
screenshots (`Member sign-in`, last nav item). **The signed-in variant
(`Member area` → `/app`) was not re-screenshotted while authenticated** — I
did not have a session to log in with in this worktree. This is not a logic
change, though: the conditional (`user ? '/app' : '/login'`, `user ? 'Member
area' : 'Member sign-in'`) is byte-identical to what shipped before, just
relocated and re-styled, so the signed-in behavior claim rests on "the logic
was not touched," not on a fresh screenshot — the owner should confirm once
signed in.

Nav now reads eight items at this length (Home, Our Community, Book a Lesson,
Horse Care, Acquisition Support, Gift a Service, FAQ, Member sign-in) — see
screenshots, it holds up fine in a single column on all three widths tested.

## F3 — the last line, three parts: DONE

Bottom bar is now a `grid-cols-1 sm:grid-cols-3` grid instead of a flex row.
Left cell `justify-self-start`, centre cell `justify-self-center`, right cell
`justify-self-end` — because the three tracks are equal-width, the centre
track's centre point is the page's true centre line regardless of how wide
the left and right text happen to be (the `justify-between` problem the task
flagged doesn't apply to a 3-track grid). Confirmed visually in
`footer-desktop.png`: the copyright line sits centered on the full 1440px
width, not just centered between the other two items.

Owner question 1 (keep `San Diego, California`?) — **not answered**, so per
the DEFAULTS section I kept it, on the right, unchanged text.

On mobile (`footer-mobile.png`) it collapses to one column, centered, in the
order credit → copyright → San Diego, California — matches THE TEST item 3
exactly.

## F4 — the Cactai link: DONE

`Designed, Built & Maintained by Cactai Inc.` renders as plain text (a `<p>`,
no `<a>`). A one-line code comment marks where the `href` goes once the owner
supplies the URL (`target="_blank" rel="noopener noreferrer"`, since it'll
point at an external page). No URL was invented.

## F5 — the stale nav label: DONE

`Our Story` → `Our Community` in the footer's nav array (`href="/story"`
unchanged — the route itself wasn't renamed, only the header's label was,
per the task). Visible in all three screenshots.

---

## Owner questions (unresolved, built on the stated defaults)

1. Does `San Diego, California` stay on the right of the last line? — kept,
   per DEFAULTS.
2. Carmel Creek Ranch pin vs. exact address? — pin, per DEFAULTS. It resolves
   to a real, correctly-placed pin (see screenshots) so this is ready to ship
   as-is if the owner confirms the default.

## Render claims — NOT VERIFIED without the owner's own eyes on it

Everything above is backed by the three committed screenshots plus
`npm run typecheck` / `npm run lint` / `npx vitest run test/ui`, but per THE
TEST item 6, screenshots from a headless Chrome are not a substitute for the
owner looking at the live page. Specifically ask the owner to eyeball:

- The map's light-on-dark contrast (F1) — toned down or fine as-is?
- The signed-in `Member area` nav-item state (F2) — not screenshotted logged
  in.
- Real mobile Safari/Chrome, not just a 390px headless viewport — this repo's
  fixed-hero `/` pattern is exactly the kind of thing that can render
  differently in a real touch browser vs. headless Chrome (see the tooling
  note below for why that pattern mattered here).

---

## Tooling note: `scripts/shot-footer.mjs` (new)

`scripts/shot.mjs` (existing) captures whatever's in the initial viewport at
a given `--window-size` — it can't scroll, because it doesn't run JS. That's
fine for most pages, but this app's `/` route (`Landing`) renders its hero as
`position: fixed; inset: 0; height: 100dvh` with `overflow-y: hidden` on
`html`/`body`, deliberately pinning the hero while the real scrollable
content lives elsewhere — `Landing` intentionally ships "its own naked nav +
no footer" per the comment in `App.tsx`. Trying to screenshot the footer via
`/` with the existing tool just captures the pinned hero at any window
height, because nothing ever scrolls. (Also worth knowing for anyone else
hitting this: the footer only renders on routes wrapped by `<Layout />`, not
on `/` — I used `/faq` instead.)

`scripts/shot-footer.mjs` drives a real headless Chrome via `puppeteer-core`
(installed with `npm install --no-save puppeteer-core` — not added to
`package.json`, not committed) to `scrollIntoView` a given element id
(default `#site-footer`) and re-check `document.documentElement.scrollHeight`
in a loop until it stabilizes (images can still grow the page after the first
scroll), then screenshots. I added `id="site-footer"` to the `<footer>` tag
in `Footer.tsx` so this (and any future "screenshot the footer" need) has a
stable anchor — it's the only change in the diff that isn't one of F1–F5, and
it's inert (no visual or behavioral effect).
