# TASK-ONEHEADER — report

Branch `task/oneheader`, worktree `~/Downloads/claude-code-repo/wt-oneheader`, off `origin/main`
(`6b34ec2`).

**Status: the header, the tab removal, the nav panel and the applicable icon changes are done.
One sub-item is not built — "nav resize" — because the owner's dimensions are not recorded
anywhere. Two questions are open. Both are at the bottom.**

---

## 1. What shipped

| | |
|---|---|
| `src/components/app/AppHeader.tsx` | new — the login screen's header, adopted |
| `src/components/app/app-header.css` | new — plain CSS, owns `--cs-hdr-h` |
| `src/components/app/AppLayout.tsx` | header swap, drawer tab deleted, nav palette inverted, icons |
| `src/components/app/CardstockHeader.tsx` | **untouched** — shelved in place |
| `src/components/app/header-cardstock.css` | **untouched** — shelved in place |
| `public/header-stock.jpg` | **untouched** |

The two cardstock files are no longer imported, so nothing of theirs reaches the bundle
(verified below). They are left byte-identical rather than edited, because they *are* the shelf —
`docs/reference/shelved-cardstock-header/README.md`'s restore procedure is "copy both files back",
and that only holds if the originals are still the originals.

This is why `.cs-tab` and `.cs-drawer-tab` were not deleted line-by-line as the task doc asked.
They are dead by a stronger mechanism than deletion: the stylesheet that declares them is not
imported, so they emit no CSS at all. The **markup** for the drawer tab is gone from `AppLayout`.

---

## 2. The header

### What was adopted, and what was not

Adopted from `src/components/layout/Header.tsx`: the two surface states (transparent at the top of
the page, a frosted + gold-hairline surface once you scroll), the 24px scroll threshold, the 450ms
ease-out transition, the squared bordered `FH` monogram, the stacked two-line serif nameplate, the
44px touch target.

Not adopted: the public header's **contents**. It carries site nav, a cart and a sign-in CTA; this
one carries what the app header has always carried — home mark, wordmark, avatar. Material, not
contents, exactly as the task doc required.

Not adopted: **relief**. The debossed wordmark, the `FH` monogram's emboss and the avatar well are
all gone. As predicted, none of it transfers — relief is layered `text-shadow` carving into a
mid-tone photographic surface, and there is nothing to carve on glass. The marks were re-decided as
flat forms, not ported. The tuned values are preserved whole in the shelf.

### Three deliberate differences from the public header

**a) No scroll-minify.** The public site drops ~33% of its height on scroll. Inside the app that
moves every sticky offset beneath the header — both rails and the contract subheader — while you
are scrolling a document. The task doc names a fixed height as the safer default; that is what is
built. **This is question 1 below.**

**b) `--cs-hdr-h` now *defines* the height instead of describing it.** `app-header.css` declares
the variable and the header takes `height: var(--cs-hdr-h)`. In `header-cardstock.css` the two were
separate numbers kept in step by hand. Inverting that makes drift structurally impossible.

| viewport | `--cs-hdr-h` | rendered | equal? | constant across scroll? |
|---|---|---|---|---|
| 390×844 (iPhone) | 64px | 64px | yes | yes |
| 360×780 | 64px | 64px | yes | yes |
| 844×390 (landscape) | 56px | 56px | yes | yes |
| 768×1024 | 76px | 76px | yes | yes |
| 1280×900 | 76px | 76px | yes | yes |

Measured, not asserted — `docs/reports/oneheader-shots/measurements.json`.

**c) The scrolled surface is declared as its *rendered* colour.** The public header declares
`bg-green-900/10`. Over the app's page that renders `#e2e2de`. Declaring `#e2e2de` at high alpha
instead buys stability over what passes behind it, which matters here and does not on the public
site: the member rail is a solid `green-800` panel and sits under the header for the first ~76px of
every scroll. `green-900/10` over `green-800` composites to `#1a2d23` — a dark band with a
dark-green wordmark in it.

This is the same method §1 of the task doc uses: reason in rendered colour, not declared colour.

Sampled from the actual screenshots:

| header is over… | composited surface | vs wordmark `#0d2118` |
|---|---|---|
| nothing (top of page) | `#faf8f4` | 15.87:1 |
| the cream page, scrolled | `#e2e2de` | 12.96:1 |
| a solid `green-800` block | `#c5c9c4` | 10.04:1 |

The predicted values in the CSS comment were `#e3e3df` and `#c5c9c4`. Measured: `#e2e2de` and
`#c5c9c4`.

### The avatar is the menu button (§2), which let the tab go (§3)

Below 1024px the avatar is a `<button>` that toggles the same `mobileNavOpen` state the tab drove —
so the two can no more desync than tab and drawer could. At 1024px+ the rail is the nav and already
open, so there is nothing to toggle and the mark renders as an inert `<span>`. Same breakpoint and
same reasoning the drawer tab used (`@media (min-width: 1024px)`).

It is a **filled** green circle with a gold hairline, not an outline. That is deliberate: the tab
was made solid green at full opacity on 2026-08-08 because a real user could not find a cream tab
on a cream page. This is now the only way into the nav on a phone and inherits that rule.

Which of the two renders is decided by a media query in `app-header.css`, not by `lg:hidden`.
`.oh-avatar` sets `display: grid` itself and a Tailwind display utility is the same specificity —
which one won would have come down to injected stylesheet order.

**Sequencing held.** The button exists and works before the tab was removed.

**One thing checked because it would have been a regression:** the old tab was `position: fixed`
and so was immune to the drawer's `position: fixed` body scroll-lock. A *sticky* header inside a
fixed body could have scrolled off screen, taking the only close control with it. Reproduced the
exact lock from `AppLayout` at scrollY=600 — the header stays at `top: 0`
(`oneheader-shots/bodylock-repro.png`). No regression, and it is strictly better than the tab,
which used to fade out.

---

## 3. The nav — solid green, cream contents (§1)

`NAV_GLASS` is gone. `NAV_PANEL = 'bg-green-800'` replaces it, plus a palette of six constants at
the top of `AppLayout.tsx`. `glass.nav` in `tailwind.config.js` — the base compensated for one
alpha — now has no reader. Left in place; removing a theme colour is a separate call.

**All three nav surfaces took it**, including the staff rail, which was on `bg-cream-100/40`. That
is an interpretation and worth flagging: the owner's arithmetic was run on the two `NAV_GLASS`
surfaces. But every row component (`RailLink`, `PresenceLink`, `AccountNavLink`, `CommunityNav`,
`NavFooter`) is shared across all three, so leaving one light would mean carrying two palettes
through all five. "The mono menu stays" — one menu, one look. **This is question 2 below.**

The selected-row fill had to change too, not just the labels: C5b's selected state was
`bg-green-800`, which *is* the new panel. Selected is now the inversion — cream fill, green ink.

Every pair, computed against WCAG:

| pair | fg | bg | ratio | needs | |
|---|---|---|---|---|---|
| idle label, on panel | `#c8cac0` | `#143321` | 8.32 | 4.5 | pass |
| idle label, on hover fill | `#cbd1c3` | `#215531` | 5.58 | 4.5 | pass |
| idle icon, on panel | `#a6aea2` | `#143321` | 6.03 | 3.0 | pass |
| hover label | `#f5f0e8` | `#215531` | 7.69 | 4.5 | pass |
| group heading | `#9ba498` | `#143321` | 5.37 | 4.5 | pass |
| **selected** label | `#0d2118` | `#f5f0e8` | 14.83 | 4.5 | pass |
| **selected** icon | `#143321` | `#f5f0e8` | 12.14 | 3.0 | pass |
| badge ink | `#0a1a0f` | `#caa83e` | 7.86 | 4.5 | pass |
| badge fill on panel | `#caa83e` | `#143321` | 6.02 | 3.0 | pass |

`focus-ring` → `focus-ring-dark` on every nav row. The two differ only in ring *offset* colour, and
`focus-ring`'s is `cream` — a cream halo drawn on a cream page. On the green panel the offset has
to be the panel, which is what `focus-ring-dark` (`ring-offset-green-800`) already is. Confirmed
from the built CSS: `--tw-ring-offset-color: #143321`.

---

## 4. Icons (§5)

`docs/reference/nav-icon-exercise.md` is settled, but it is also explicit that **"most of this
assignment cannot be applied until [the merges] exist"** — and the merges are not implemented; the
live nav still has 30 destinations. So the applied subset is only pages that survive the merges
under their own name and whose live glyph differs.

**Applied (5):**

| page | was | now | why now |
|---|---|---|---|
| Inbound | `Mail` | `Inbox` | a work queue, not "email a person" |
| Payment review | `ReceiptText` | `Receipt` | `ReceiptText` is My Orders — two pages, one glyph |
| Oversight | `Shield` | `Eye` | one off the pile of eight identical `Shield`s |
| Content store | `BookOpen` | `Library` | `BookOpen` is Directory — same collision |
| Dashboard (staff) | `HomeIcon` | `LayoutDashboard` | settled table gives one glyph per page; staff's was called out as drift by ONEMENU |

**Not applied, and why:**

- **Lessons** and **Horse care** — the two custom marks. Still blocked on artwork; there is no
  horse asset in the repo. Untouched.
- **People → `Contact2`** — `People` is a merged page that does not exist. Its five live members
  (Leads, Clients, Contacts, Team, Directory) are separate routes; assigning the merged page's icon
  to one of them would pre-empt the merge.
- **Barn / Documents / Settings / Content / Oversight as merged pages** — same reason.
- **Gifts → `Gift`** — no Gifts destination exists in the nav to apply it to.

---

## 5. Verification

| # | requirement | result |
|---|---|---|
| 1 | one header on every route, signed in or out; no swap at sign-in | **structurally true** — `Header.tsx` is unchanged and now shares its material with the app header. Not click-verified signed in (see limits) |
| 2 | sticky offsets correct in every state | **measured: 0px gap**, both scroll states, 1280 and 1440. Rail bottom lands exactly on the viewport bottom |
| 3 | wordmark legible on mobile | **yes** — `390-iphone--scrolled.png`, 12.96:1. The stacked nameplate is 189px wide in a 390px header |
| 4 | legible over light and dark page content | **yes** — 15.87:1 / 12.96:1 / 10.04:1 across the three cases |
| 5 | typecheck, lint, build clean | **typecheck 0 errors; `typecheck:api` 0 errors; lint 0 errors / 30 warnings — identical to `origin/main`, which is also 30; build ✓, prerender ✓** |
| 6 | every new arbitrary Tailwind value emits | **yes, all 21 checked against `dist/assets/*.css`** — below |

### Emitted-CSS check (requirement 6)

Not assumed — each was grepped out of the built stylesheet **with its rule body**, so a
present-but-empty rule would have been caught too:

```
bg-green-800            .bg-green-800{--tw-bg-opacity:1;background-color:rgb(20 51 33/…)}
text-cream-100/80       .text-cream-100\/80{color:#f5f0e8cc}
text-cream-100/65       .text-cream-100\/65{color:#f5f0e8a6}
text-cream-100/60       .text-cream-100\/60{color:#f5f0e899}
border-cream-100/20     .border-cream-100\/20{border-color:#f5f0e833}
bg-cream-100            .bg-cream-100{…rgb(245 240 232/…)}
text-green-900          .text-green-900{…rgb(13 33 24/…)}
text-green-800          .text-green-800{…rgb(20 51 33/…)}
text-green-950          .text-green-950{…rgb(10 26 15/…)}
bg-gold-500             .bg-gold-500{…rgb(202 168 62/…)}
bg-green-600            .bg-green-600{…rgb(33 85 49/…)}
border-green-950/20     .border-green-950\/20{border-color:#0a1a0f33}
bg-green-800/10         .bg-green-800\/10{background-color:#1433211a}
hover:text-cream-100    .hover\:text-cream-100:hover{…}
focus-ring-dark         .focus-ring-dark:focus-visible{… --tw-ring-offset-color:#143321}
[@media(hover:hover)]:hover:bg-green-600         emitted
[@media(hover:hover)]:hover:text-cream-100       emitted
[@media(hover:hover)]:group-hover:text-cream-100 emitted
top-[var(--cs-hdr-h)]                            emitted
h-[calc(100dvh-var(--cs-hdr-h))]                 emitted
pb-[max(0.75rem,env(safe-area-inset-bottom))]    emitted
```

Nothing uses the bracket-opacity form (`/[0.92]`) that silently emitted nothing on 2026-08-08.

**The header itself contains zero Tailwind.** `app-header.css` is plain CSS end to end,
deliberately — nothing in it goes through Tailwind's value parser, so nothing in it can fail that
way. Confirmed present in the bundle (`.oh-hdr`, `.is-scrolled`, `.oh-wordmark`, `.oh-mono`,
`.oh-avatar`, `--cs-hdr-h`) and confirmed the cardstock rules are entirely absent (`cs-hdrwrap`,
`cs-emboss`, `cs-tab`, `cs-drawer-tab`, `header-stock`: 0 hits each).

### How the screenshots were made, and what they are not

There are **no Supabase credentials in this worktree**, so a signed-in click-through of the real
app was not possible. Instead the **real `AppHeader` component** was mounted against the **real
stylesheets** in a throwaway Vite harness, with a nav panel built from AppLayout's palette constants
copied verbatim. The header screenshots are therefore of the shipped component; the nav screenshot
is of the shipped *palette*, in reproduced markup.

The harness is archived as `oneheader-shots/harness.main.tsx.txt` +
`harness.index.html.txt` (the `.txt` suffix is the same shelving trick the cardstock header uses —
it keeps the files out of typecheck, lint and the build). To re-run: drop the `.txt`, put both in
`harness/` at the repo root, `npx vite`, open `/harness/index.html`.

**Not verified, and someone should:**

- The signed-in app on a real device — the whole shell, not the header in isolation.
- The mobile drawer *open*, on a phone. The panel colour and every row pair are proven by the
  contrast table, but the drawer's own layout was not photographed.
- **Whether the avatar reads as "menu" to someone who has not been told.** It is the owner's
  ruling and it is built as ruled, but the recorded failure this replaces was exactly a
  discoverability failure, and I cannot test discoverability from here.

### One pre-existing defect found, not fixed

Superadmin's chrome is `h-14` (56px) but the rails read `--cs-hdr-h` and stick at 76px — a 20px
gap. This predates the task (it was 80 vs 56, a 24px gap) and superadmin chrome is explicitly
"deliberately untouched", so I left it. The fix is one inline style on the shared wrapper if wanted.

---

## 6. Not built

**"Nav resize — the drawer's dimensions, per the owner" (§5).** The dimensions are not recorded —
not in the task doc, not in `nav-icon-exercise.md`, not in the shelved-header README. The drawer is
still `w-72 max-w-[85vw]` (288px). I did not invent a number. Everything else in §5 is done.

---

## 7. Open questions

1. **Should the app header minify on scroll?** The task doc asks this and names a fixed height as
   the safer default; that is what is built, and it is what makes `--cs-hdr-h` provably accurate in
   both states. If you want the minify, the variable has to become dynamic and both rails plus the
   contract subheader move while you scroll a document. Recommend keeping it fixed.
2. **Was the staff rail meant to go green too?** Built green, for the reason in §3. Reverting it
   alone means giving the five shared row components a second palette.
3. **The third header item, cut off mid-sentence (H3 in the task doc).** Still unknown — the doc
   says "Ask." Asking.

Related, and now resolved by dissolution as the task doc predicted: `TASK-MOBILEPASS` H1 (faint
mobile wordmark) and H2 (unfilled monogram) were both relief defects. Both surfaces are gone.

**Shared-file note:** `AppLayout.tsx`, `CardstockHeader.tsx` and `header-cardstock.css` are shared
with `TASK-MOBILEPASS`. This branch holds them. The two cardstock files are unmodified, so only
`AppLayout.tsx` is a real conflict surface.
