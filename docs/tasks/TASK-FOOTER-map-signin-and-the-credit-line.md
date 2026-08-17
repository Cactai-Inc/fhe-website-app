# TASK FOOTER — a map beside Find Us, sign-in in the nav, and the credit line

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** Presentation only — no data, no RPCs, no
migrations. Small enough that the orchestrator may simply build it.

**Owner, 2026-08-17:**
> *"we need the google map embed in the footer to the right of the find us block. the find us block
> needs to move to the left. and sign in needs to go in the footer nav not in the last line of the
> site. the center of the last line of the site needs to have out copy rights centered and the left
> side needs to read 'Designed, Built & Maintained by Cactai Inc.' I'll give you a url later so it
> links to the page on my website where i talk about the project."*

# WHAT IS THERE NOW (`src/components/layout/Footer.tsx`, measured 2026-08-17)
- **A 3-column grid** (`md:grid-cols-3`): **Brand** · **Navigation** · **Find Us**.
- **Find Us** holds address, phone, email, then a licensed-&-insured note below a rule.
- **The bottom bar** carries the copyright on the left, and on the right: `San Diego, California`
  plus the member sign-in link (`Member sign-in` / `Member area` when signed in).

# THE BUILD

## F1 — the map joins Find Us
- **Find Us moves left; the Google Map embed sits to its right**, as a pair.
- The grid grows to accommodate it — Brand · Navigation · Find Us · Map. **Keep it collapsing
  sensibly on phones**; the map must not squeeze the contact details on a small screen.
- ⚠️ **A map embed is a third-party iframe.** Use Google's standard embed, give it a
  `title` for screen readers, `loading="lazy"`, and a fixed aspect so it cannot shift layout as it
  loads. **Check it does not break the page's CSP** — if it does, report rather than weakening the
  policy.
- **The dark footer needs a map that suits it.** A default light map will glare against the green.
  Report how it looks; the owner may want it toned down.

## F2 — sign-in moves into the footer nav
- **Move the sign-in link out of the bottom bar and into the Navigation list.**
- **Keep its existing signed-in behaviour** — `Member area` → `/app` when a user is present,
  `Member sign-in` → `/login` otherwise. **Do not turn it into a static `/login` link.**
- It becomes an ordinary nav item; the deliberate low-key styling of the old bottom-bar link no
  longer applies.

## F3 — the last line: three parts
| position | content |
|---|---|
| **left** | **Designed, Built & Maintained by Cactai Inc.** |
| **centre** | **© {year} French Heritage Equestrian. All rights reserved.** — centred |
| **right** | ⚠️ **owner question** — `San Diego, California` lives here today and was not mentioned. Keep, or drop? |

- **The centre must be genuinely centred on the page**, not merely the middle flex child — with the
  side items at different widths, `justify-between` will push it off-centre. Use a three-track grid
  so the copyright sits on the page's true centre line.
- **Stack cleanly on phones**, centred, in the order: credit · copyright · (right item if kept).

## F4 — the Cactai link
- ⚠️ **The URL does not exist yet** — the owner will supply it. **Render the credit as plain text
  for now**, structured so adding an `href` later is a one-line change. **Do not invent a URL.**
- When it arrives it points at the owner's own project write-up, so it is an **external** link:
  `target="_blank"` with `rel="noopener noreferrer"`.

## F5 — while you are in here: the stale nav label
- The footer's Navigation list still says **`Our Story`** pointing at `/story`. **The site renamed
  that to `Our Community` on 2026-08-16** and the header already says so. **Fix the label**; the
  route is unchanged.

# TRAPS
- **Presentation only.** No API, no auth logic beyond reusing the existing `user` check.
- **Do not restyle the rest of the footer.** Brand column, spacing and the licensed-&-insured note
  stay as they are.
- **Never symlink `node_modules` across case-variant paths** (`/Users/Cactai` vs `/Users/cactai`).
- **Run the UI suite** — `clause_ownership_affordance`, `pluspass_create_controls` and
  `wallreturn_onboarding` are **red on `main` already**; diff against `main`, do not fix them here.

# THE TEST THIS MUST PASS
1. The map renders beside Find Us on desktop and stacks without crushing the contact details on a
   phone — **screenshot both**.
2. Sign-in appears in the footer nav and **still switches to `Member area` → `/app` when signed in**.
3. The bottom line reads **credit left · copyright centred · (right item per the owner's answer)**,
   with the copyright on the page's true centre line — **not merely between two flex items**.
4. The Cactai credit is plain text, ready for an `href`.
5. The footer nav says **Our Community**.
6. Render claims are **NOT VERIFIED** without screenshots; list what the owner must eyeball.

# OWNER QUESTIONS
1. **Does `San Diego, California` stay on the right of the last line**, or go?
2. **Which map** — a pin on Carmel Creek Ranch, or the barn's exact address? (The footer currently
   says *"2.5 miles from Torrey Pines Beach"*, so the precise location may be deliberate.)

Report to `docs/reports/TASK-FOOTER-REPORT.md`. Do not push; the orchestrator merges.
