> # 🔒 SUPERSEDED 2026-09-01 by `FHE-DSNR-SITE-PUBLIC` — DO NOT BUILD FROM THIS FILE
> **This is the owner's 2026-08-24 chat-thread draft, kept for its provenance.** It was rebased and
> split into two chunks, because its two items turned out to need two different mechanisms:
> - `docs/tasks/TASK-SITECOPY-A-jumper-only-program-not-barn-in-public-marketing-copy.md`
> - `docs/tasks/TASK-SITECOPY-B-the-app-stops-calling-itself-the-barn.md`
>
> ⚠️ **Two of its claims did not survive re-measurement:**
> 1. *"No other public-copy instance of `barn` found in an identity-claiming context"* — **there are
>    four**, in `Confirmation.tsx:148-150`, `OrderPayment.tsx:231`, `ActivationOrderPanel.tsx:151`
>    and `App.tsx:509`. They are `-B`.
> 2. Its TEST asks for `/ride` and `/shop` to be read in a browser. **Both are `<Navigate>` redirects
>    and prerender to a blank, titleless page** — see `docs/tasks/TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md`.
>
> **Its "verified accurate, do not touch" list DID survive in full and is carried into `-A` §2.**

---

# TASK-SITECOPY — jumper-only, program-not-barn, across public copy

Scope: public marketing site only (index.html, src/lib/seo.ts, src/pages/Services.tsx,
src/pages/About.tsx). No schema, no data model, no admin surfaces. Smallest correct diff per
item — swap the wrong word, keep sentence structure. Verify by loading each route in a real
browser and reading the rendered title/meta/body text, not just the source.

Two corrections, both owner-confirmed 2026-08-24: FHE teaches jumper only, never
hunter/hunter-jumper. FHE is a program operating out of Carmel Creek Ranch, not a barn.

## Item 1 — hunter/jumper to jumper

index.html
- title: "French Heritage Equestrian — Hunter/Jumper Lessons & Training | Coastal San Diego" →
  "French Heritage Equestrian — Jumper Lessons & Training | Coastal San Diego"

src/lib/seo.ts, ROUTE_SEO array
- '/' title: same fix as index.html's, verbatim — the two are meant to match, index.html is the
  pre-hydration fallback for this exact entry.
- '/about' description: "...Classical hunter/jumper horsemanship, patient teaching..." →
  "Classical jumper horsemanship..."
- '/ride' description: "...Classical hunter/jumper riding — join the rider community..." →
  "Classical jumper riding..."
- '/lessons' description: "Private hunter/jumper riding lessons..." → "Private jumper riding
  lessons..."
- '/acquisition' description: "Expert hunter/jumper horse acquisition..." → "Expert jumper
  horse acquisition..."
- '/shop' description already reads "jumper training" — no change, already correct.

src/pages/Services.tsx
- rider-path services list: 'Hunter/jumper training' → 'Jumper training'
- acquisition-path description: "drawing on years in the hunter/jumper world" → "drawing on
  years in the jumper world"

src/pages/About.tsx
- "learning the classical hunter/jumper tradition from the people who do it best" → "learning
  the classical jumper tradition from the people who do it best"

## Item 2 — barn to program/ranch

index.html
- description: "A family-run hunter/jumper barn and community in coastal San Diego — riding
  lessons, horse care, and acquisition support, rooted in classical European training." →
  "A family-run jumper program and community at Carmel Creek Ranch in coastal San Diego —
  riding lessons, horse care, and acquisition support, rooted in classical European training."
  One edit, not two — this line absorbs Item 1's fix as well.

No other public-copy instance of "barn" found in an identity-claiming context. About.tsx,
"the best barns are not really about the riding at all," uses the word the way any rider would
— generically, about facilities in general, not a claim that FHE itself is one. Reads as fine
as written; flagging so it isn't missed, not so it's changed. Owner call if it should go anyway.

## Verified accurate, do not touch

BRAND.tagline (src/lib/brand.ts): "Equestrian community by the sea - made for fun, friendships,
and rider advancement" — owner-confirmed accurate, 2026-08-24.
Landing.tsx hero h1: "Join Our Riding Community / California Days Are Made For This" —
owner-confirmed accurate, 2026-08-24.
BUSINESS.description (src/lib/seo.ts) and Footer.tsx — already jumper-only, already
program-framed, matches the footer's own words per the file's existing comment. No change.
serviceCatalog.ts's 'hunter-jumper' alias key and inquiry.ts's matching legacy service_type
string — data-layer backward-compat, never rendered, leave in place.
acquisition.ts and intakeCategoryFields.ts discipline-field placeholders ("e.g. hunter/jumper,
dressage, trail") — describe what a client wants in a horse or a lesson interest, not FHE's own
program; different context, leave in place.
seed.ts and portalFixtures.ts — dev/test fixture data, not live copy, out of scope.

## Test

Load /, /about, /ride, /lessons, /acquisition, /shop in a real browser: confirm the rendered
title tag and meta description match the fixed text above, and confirm the on-page body copy in
Services and About reads jumper, not hunter/jumper, not hunter-anything. Report anything that
renders differently from source rather than assuming source-correct means render-correct.
