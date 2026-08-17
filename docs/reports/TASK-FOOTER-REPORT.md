# TASK FOOTER REPORT — a map beside Find Us, sign-in in the nav, and the credit line

**Base:** `origin/main` @ `5a6d1fb`, branch `task/footer`, worktree
`~/Downloads/claude-code-repo/wt-footer`. Presentation only — no migrations, no
RPCs, no data changes. **Do not push; the orchestrator merges.**

**Files changed:** `src/components/layout/Footer.tsx` (the task's own scope),
plus two small content changes the owner asked for live in this same thread —
`src/lib/seo.ts` and `src/pages/Story.tsx` — documented in their own section
near the end, since they're not part of F1–F5.
`npm run typecheck`: 0 errors. `npm run lint`: 0 errors, 46 warnings (all
pre-existing — confirmed with `npm run lint | grep -E
'Footer.tsx|seo.ts|Story.tsx'`, no output). `npx vitest run test/ui`: 3 failed
/ 130 passed / 5 skipped — the same three files named in the task's TRAPS
section (`pluspass_create_controls`, plus two others in that red set) fail
with the same pre-existing errors (missing `listMfaFactors` mock, `window is
not defined`); nothing in the failures touches any file in this diff, and no
test file references `Footer`, `Story`, or `seo.ts` at all. No new failures
introduced.

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

**Mid-session round 1 — the real address, and a tappable card (owner,
2026-08-17):** the owner supplied the actual Google-listing address ("same as
CCR but we're listed as STE A") and asked for tap-to-open-Maps behavior:
*"the visitor should see the map, tap it and their google map or apple map
opens and they see our listing page and they can click a button to get the
directions started."*

I looked up the address in the live `locations` row for Carmel Creek Ranch
(`2d771cea-5150-43b9-8e3d-38faa434a07d`, `address_line1 = '11600 Clews Ranch
Road'`), preferring the live DB over a migration comment that said "11500" —
per the repo's own working rule to verify against the DB, not a file. Built
the map query as `French Heritage Equestrian, 11600 Clews Ranch Road, Ste A,
San Diego, CA 92130`, and made the whole card a single tap target: the
iframe went `pointer-events-none`/`aria-hidden` (purely a visual preview, since
an `<a>` wrapping an `<iframe>` can't intercept clicks landing inside it), with
a full-cover overlay `<a>` on top opening a universal Google Maps URL, plus a
small "Get Directions" badge for affordance. Rounded corners, per the F1
frame from round zero.

**Mid-session round 2 — owner rejected round 1 outright (2026-08-17):**
*"the map pin is on the exact address but it is not on the right location for
where people actually go. and the map is really shitty, it has rounded
corners, it doesnt have zoom out capability, clicking it doesnt open or offer
to open a google map."* Three of those four are direct, unambiguous
consequences of round 1's own choices, so I reverted them rather than debug
the overlay further:

- **Rounded corners → gone.** Dropped `rounded-lg overflow-hidden` from the
  map's wrapper div.
- **No zoom → `pointer-events-none` was the cause.** That single class
  disabled all interaction with the iframe, scroll/pinch-zoom included, which
  is what round 1's tap-target hack required. Removed it — the map is native
  Google embed again: draggable, zoomable, with its own zoom/fullscreen
  controls.
- **"Doesn't offer to open a Google Map" → the custom overlay wasn't the
  right way to satisfy this, so it's gone too.** Google's default embed
  already carries its own "Open in Maps ↗" chip (visible top-left in
  `footer-desktop.png`/`footer-tablet.png`) that does exactly what was asked
  — clicking it offers to open the real Google Maps app/site. I didn't debug
  why the owner's test of the custom overlay didn't work (a real click on a
  live page vs. my headless-Chrome verification could differ in ways I can't
  reproduce here); removing the custom layer entirely and relying on Google's
  own affordance is more robust than a bespoke click-catcher regardless.
- **"Not the right location for where people actually go" → NOT fixed, needs
  the owner's input.** The owner sent a screenshot showing two pins — the
  business-listing pin (where the query resolves) and a second, correct
  arrival point near the CA-56 Carmel Creek Rd exit ("almost immediately
  after they exit the highway and turn right, at the sign for French Heritage
  Equestrian and Carmel Creek Ranch"). A screenshot doesn't give me exact
  coordinates to embed with any confidence, and I'm not going to guess
  lat/long off a raster image for driving directions. **Asked the owner
  directly for either the exact coordinates or a dropped-pin share link** —
  see the open item at the end of this report.
- **A genuine data discrepancy, found while re-verifying the embed in
  isolation:** loading the map embed standalone (outside the app, to debug
  why a screenshot came back blank — see the tooling note) showed Google's own
  listing info-card reading **"11500 Clews Ranch Rd Ste A"** — not "11600."
  That means the `locations` table's `address_line1` disagrees with the real
  Google Business Profile. I did not write anything to the DB (out of scope,
  presentation-only task) — I switched the map query to Google's own number
  (**11500**, not the DB's 11600) since that's what keeps matching Google's
  real listing, and flagged the mismatch here rather than silently pick a
  side. Worth a separate look at whatever else in the app reads
  `locations.address_line1` for this row.
- **Owner also asked, mid-round:** *"add out [our] hours 8am to 7pm 7 days
  per week"* / *"below the email address in the footer."* Added a fourth row
  in the Find Us contact list, a `Clock` icon (`lucide-react`, already used
  elsewhere in this file for `MapPin`/`Phone`/`Mail`) plus "8:00 AM – 7:00 PM,
  7 days a week," directly under the email row. No source given for these
  hours beyond the owner's message — if they're meant to match a value stored
  somewhere (e.g. a future `business_hours` config), that's not wired up;
  this is static text same as the rest of the Find Us block.

Current map query, used for both the visible embed and nothing else (the
custom overlay/link from round 1 was removed): `French Heritage Equestrian,
11500 Clews Ranch Rd Ste A, San Diego, CA 92130`.

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

## Out-of-scope addendum — the site description, requested live (owner, 2026-08-17): DONE

Not part of TASK-FOOTER's F1–F5 and not in `Footer.tsx`, but asked for
directly in this same thread, with a screenshot of a Google search results
panel: *"out [our] website short description shown here needs to be changed
to match the facebook description, and the first line of our community page
needs to be changed to match this sentence too. 'Join our community of
riders, where camaraderie, enjoyment, and a love for horses come together.'"*

- **`src/lib/seo.ts`**, the `/` entry in `ROUTE_SEO`: `description` changed
  from *"A community of women who ride for the love of it. Classical European
  hunter/jumper riding lessons, horse care, and acquisition support at Carmel
  Creek Ranch in coastal San Diego."* to the exact sentence quoted above —
  full replacement, not a blend, since "match the facebook description" reads
  as a match, not a merge. This flows through `src/components/Seo.tsx` into
  `<meta name="description">`, `og:description`, and `twitter:description`
  together (same `description` prop feeds all three) — verified with
  `page.$$eval` against the live dev server, `og:description` came back as
  the new sentence, `data-rh="true"` confirming it's Helmet's tag.
- **`src/pages/Story.tsx`** (the "Our Community" page, `/story`): the first
  body paragraph — *"We are a community of riders who love all things
  equestrian. This is the place we're grateful to call home for us and our
  horses."* — replaced with the same sentence, verbatim. Screenshot:
  `docs/reports/footer-shots/story-first-line.png`.
- **A real gotcha, worth knowing, not a bug in this diff:** `npm run dev`
  serves `index.html`'s static fallback `<meta name="description">`
  alongside Helmet's per-route tag — TWO tags in the DOM at once in dev mode,
  because `react-helmet-async` only manages tags it renders itself and
  doesn't strip the static one. A naive `document.querySelector` (or a quick
  view-source in dev) grabs the *first* one — the stale static text — which
  looks like the edit didn't take even though it did. **This is dev-only.**
  `scripts/prerender.mjs` (used by `npm run build`) explicitly strips the
  static `<title>`/`<meta name="description">` from each route's output
  before injecting Helmet's version (`out.replace(/<meta
  name="description"[^>]*>/, '')`), so the real built site has exactly one,
  correct, per-route tag. Mentioning this because it cost real time to
  diagnose and would trip up anyone else checking this change with a quick
  dev-server view-source instead of a build.
- **No source given for "the facebook description"** beyond the owner's own
  quoted sentence and the attached screenshot — I used exactly what was
  quoted, not the (slightly longer, truncated in the screenshot) live
  Facebook page text, since the owner typed out the specific sentence they
  wanted.

---

## Owner questions (unresolved, built on the stated defaults)

1. Does `San Diego, California` stay on the right of the last line? — kept,
   per DEFAULTS.
2. Carmel Creek Ranch pin vs. exact address? — **superseded by the owner's
   round-2 feedback**, see below: the pin is on the exact address, but that's
   not where visitors are actually routed.

## STILL OPEN — the map pin's location, needs the owner

The map query (`French Heritage Equestrian, 11500 Clews Ranch Rd Ste A, San
Diego, CA 92130`) puts the pin on the business's real, geocoded address. The
owner's screenshot shows this is the WRONG spot for directions — the actual
arrival point is near the CA-56 / Carmel Creek Rd exit, immediately after the
turn at the FHE/CCR sign, which is a different point on the property than the
mailing address. I don't have exact coordinates for that arrival point and
won't guess them off a screenshot for something people will actually drive
by. **Need one of:**

- The exact lat/long (long-press the correct spot in Google Maps → the
  coordinates show at the bottom; or "What's here?").
- A dropped-pin share link for that exact spot (different from a Business
  Profile share link — this would be "drop a pin" → Share).

Once I have either, the fix is swapping `MAP_QUERY` in `Footer.tsx` for a
`lat,lng` query instead of a name+address one — small, but I'd rather ask
than embed a guess into a live "how do I get there" tool.

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
