# TASK SESSIONBOOK — Book a Lesson knows whether you are signed in, and whether you own a horse

**Owner, 2026-08-16, verbatim:**

> *"we need to have session awareness, so when im in an authenticated session and i click the
> book a lesson page link from the website nav it opens a page that is formatted like the horse
> care and find a horse pages, same content in the cards, but also aware of if i own a horse or
> not, if i own a horse it shows me those lessons if i dont own a horse it doesnt show them to
> me. and the focus is on the purchase flow like those other pages use, not a marketing approach
> like the unauthenticated page uses."*

**The principle:** a stranger needs persuading; a signed-in member needs a fast path to buying.
Same URL, two jobs. Today `/lessons` only does the first.

# WHAT WAS MEASURED (prod + main, 2026-08-16 — verify, then build)

**Both halves of this already exist. This is composition, not invention.**

| piece | state |
|---|---|
| `/lessons` (`Lessons.tsx`) | the MARKETING page — hero image, headline, video, section copy, then cards. No session awareness at all |
| `/horse` (`BookHorse.tsx`), `/acquisition` (`BookSupport.tsx`) | the PURCHASE-FLOW pages the owner wants matched: `ServiceSelector` cards → cart → checkout |
| `ServiceSelector` | the shared card/radiogroup component all three funnels use |
| **the horse-ownership split** | **already in the data**: `offerings.horse_included` — `false` on the three "(With your horse)" SKUs, `true` on the other six |
| `caller_owns_horse(h_id)` | exists, but takes **a specific horse id** — there is **no "do I own ANY horse" check** |
| `my_stable_horses` | the member's own horses reader — **this is the seam**; a non-empty result IS the answer |
| `useAuth()` | how every component already knows whether someone is signed in |

**So the only genuinely missing piece is a "does this member have a horse" signal**, and
`my_stable_horses` already answers it.

# THE BUILD

## S1 — one route, two faces
- `/lessons` stays the URL (the nav link, the landing CTA and the Story card all point at it).
- **Signed out** → exactly what ships today. Do not touch the marketing page's copy or layout.
- **Signed in** → the purchase-flow layout, built the way `/horse` and `/acquisition` are built:
  `ServiceSelector` groups, cart, checkout. **Same card content** — name, mechanics, price, the
  gold note — because that is what the owner asked for and it is the component those pages use.
- **Do not fork the page into two files that drift.** One page, a branch at the top, shared
  card rendering. If a copy change is needed later it must not have to be made twice.

## S2 — hide the own-horse lessons from members with no horse
- Read the member's horses (`my_stable_horses`). **Empty → filter out every offering with
  `horse_included = false`.** Owns at least one → show them.
- **`horse_included` is already the right axis** — three SKUs are `false`, six are `true`. Do not
  add a second flag, and do not key on the name (`(With your horse)` is display text; the names
  changed on 2026-08-15, which is exactly why nothing may parse them).
- **Signed-out visitors keep seeing everything.** They have no horse on record and no way to say
  so; hiding half the catalogue from a stranger would be a bug, not a feature.
- ⚠️ **Leases count.** `caller_owns_horse` treats a lessee and a relationship-holder as an owner,
  and so must this — a member leasing a horse needs those lessons. State which definition you
  used and why.

## S3 — the purchase focus
- Signed in, the page opens on the choice, not on a hero image and a video. Lead with the cards.
- The onward action is the existing cart → checkout path (`createDraftOrder` and the flow
  `/horse` and `/acquisition` already use). **One purchase spine — do not add a second.**
- Keep the page honest for a member who has NO purchasable options after filtering (possible if
  the catalogue changes): say so plainly rather than rendering an empty grid.

# TRAPS
- **Do not build a second catalogue.** `/shop` was just hidden for exactly this reason; the point
  is fewer surfaces, not more.
- **`ServiceSelector` is shared by three funnels.** A group with ONE offering renders full width
  and a multi-offering group renders two columns (changed 2026-08-16) — do not undo that, and
  check `/horse` and `/acquisition` still render correctly after any change to it.
- **Nothing may parse offering names.** Names changed on 2026-08-15 (`1x Weekly` →
  `1x Weekly Lesson`); a name-based rule broke credit minting three separate times.
- **`assertWrote()` on every write**; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths** — macOS loads React twice and nulls
  every hook.
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).
  It is **not** a green baseline — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. Signed out: `/lessons` renders exactly as it does today — prove the marketing page is unchanged.
2. Signed in with **no** horse: purchase-flow layout, and **none** of the three
   `horse_included = false` offerings appear.
3. Signed in **with** a horse (owned OR leased): the same layout, and those three DO appear.
4. Selecting and checking out uses the existing cart/`createDraftOrder` path — prove no second
   purchase path was added.
5. `/horse` and `/acquisition` render unchanged — prove `ServiceSelector` was not regressed.
6. No offering name is parsed anywhere in the new code.
7. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTIONS — ask, do not guess
1. A member who owns a horse: should they still see the on-our-horse lessons, or only their own?
   (This spec shows both — hiding them would prevent a horse owner booking a lesson on a school
   horse, which happens.)
2. Should the signed-in view keep any of the marketing copy — a single line for context — or open
   straight on the cards?

Report to `docs/reports/TASK-SESSIONBOOK-REPORT.md`. Do not push; the orchestrator merges.
