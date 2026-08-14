## Header mockup — drawer + modal are dead script (docs/reference/header-mockup.html)
- reported by: TASK-HEADER-REPORT.md
- reachability: VERIFIED, and the mechanism is more precise than reported. The file is 558 lines. The inline `<script>` opens at line 479, but the DOM nodes it reaches for are declared **after** it: `#drawerTab` line 532, `#navScrim` 535, `#drawer` 536, `#scrim` 547, `#createModal` 548. Only `#avatarBtn` (452) and `#createBtn` (457) exist when the script runs. The script therefore **throws at line 512** — `scrim.addEventListener('click', closeModal)` on a null `scrim` — and everything from 512 down never registers: the modal's Escape handler and the *entire* drawer block (516–530). The create button's click handler at 501 *is* registered, but it calls `openModal()`, which touches `scrim.classList` and throws, so the modal never opens either. Net: the avatar press physics (483–491) and the coarse-pointer "reveal the + tab" branch are the only things that work — exactly as reported.
- exists: yes
- content:
```html
<!-- line 479 — script opens here, BEFORE the nodes below exist -->
<script>
/* press physics — JS class so touch-drag-off and touchcancel release cleanly.
   No radius juggling needed now: the struck rim never changes, and the well's
   blurred wall is clipped to the rim so its growth can only go inward. */
const btn = document.getElementById('avatarBtn');          // 452 — EXISTS
const press = () => btn.classList.add('is-pressed');
const release = () => btn.classList.remove('is-pressed');
btn.addEventListener('mousedown', press);                  // ✅ these run
btn.addEventListener('mouseup', release);
btn.addEventListener('mouseleave', release);
btn.addEventListener('touchstart', press, {passive:true});
btn.addEventListener('touchend', release, {passive:true});
btn.addEventListener('touchcancel', release, {passive:true});

/* ---- create button -> modal ---- */
const createBtn = document.getElementById('createBtn');    // 457 — EXISTS
const scrim = document.getElementById('scrim');            // 547 — null
const modal = document.getElementById('createModal');      // 548 — null
const openModal = () => { scrim.classList.add('open'); modal.classList.add('open'); };   // throws when called
const closeModal = () => { scrim.classList.remove('open'); modal.classList.remove('open'); };
/* No hover on touch, so the first tap reveals the tab and the second opens
   the modal — otherwise the + would be invisible when tapped. */
createBtn.addEventListener('click', () => {                // ✅ registers, but…
  const coarse = window.matchMedia('(hover: none)').matches;
  if (coarse && !createBtn.classList.contains('is-out')) {
    createBtn.classList.add('is-out'); return;             // ✅ this branch works
  }
  createBtn.classList.remove('is-out');
  openModal();                                             // ❌ TypeError on null scrim
});
addEventListener('pointerdown', e => {
  if (!createBtn.contains(e.target)) createBtn.classList.remove('is-out');
}, true);
scrim.addEventListener('click', closeModal);   // ❌ LINE 512 — THROWS HERE. Nothing below runs.
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---- mobile drawer: the tab rides out attached to the drawer's edge ---- */
const drawerTab = document.getElementById('drawerTab');    // never reached
const drawer = document.getElementById('drawer');
const navScrim = document.getElementById('navScrim');
const setDrawer = (open) => {
  drawer.classList.toggle('is-open', open);
  drawerTab.classList.toggle('is-open', open);
  navScrim.classList.toggle('open', open);
  drawerTab.setAttribute('aria-expanded', String(open));
  drawerTab.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
drawerTab.addEventListener('click', () => setDrawer(!drawer.classList.contains('is-open')));
navScrim.addEventListener('click', () => setDrawer(false));
/* any real navigation closes it */
drawer.addEventListener('click', e => { if (e.target.closest('a')) setDrawer(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
</script>
```

The avatar press physics that DO work (the part worth keeping), CSS lines 162–174:
```css
.avatar .ring-dark{transition:transform .18s cubic-bezier(.22,.61,.36,1)}
  .avatar:hover .ring-wall{stroke-width:2.4}
  .avatar:hover .ring-dark{transform:translateY(0.5px)}
  .avatar:hover .ring-breath{stroke:rgba(226,236,226,.04)}
  .avatar:hover .av{transform:translateY(2px)}       /* +1 rest + 1 */
.avatar.is-pressed .ring-wall{stroke-width:4;transition-duration:.14s}
.avatar.is-pressed .ring-dark{transform:translateY(1.1px);transition-duration:.07s}
.avatar.is-pressed .ring-breath{ … }
.avatar.is-pressed .av{transform:translateY(3.25px);transition-duration:.07s}  /* +1 rest + 2.25 */
```

The mockup's page markup — this is the visual the owner would be judging (lines 444–478):
```html
<div class="hdrwrap">
<header class="hdr">
  <div class="left"><div class="mark logo"><svg viewBox="0 0 56 56" …>
    … three stacked squircle rings (light / dark / face) …
    </svg><span class="glyph fh emboss">FH</span></div></div>

  <div class="wordmark emboss"><span class="long">French Heritage Equestrian</span><span class="short">French Heritage</span></div>

  <div class="right"><div class="mark avatar" id="avatarBtn"><svg viewBox="0 0 50 50" …>
      <g clip-path="url(#wellClip)"><circle class="ring-wall" cx="25" cy="24.4" r="21.8"/></g>
      <circle class="ring-dark" …/><circle class="ring-breath" …/><circle class="ring" …/>
    </svg><span class="glyph av">C</span></div></div>
</header>
  <button class="tab" id="createBtn" type="button" aria-label="Create" aria-haspopup="dialog">
    <span class="chev" aria-hidden="true"></span>
  </button>
</div>

<div class="page">
  <div class="tag">FINAL DRAFT · variant-5 outlines · letter sinks 1px hover / 2.25px click · well band grows inward</div>
  <div class="eyebrow">Dashboard</div>
  <div class="intro">Good morning, CJ</div>
  <div class="lede">Claire left notes for today's lesson. Beau is in Arena&nbsp;2 at three o'clock, and the farrier comes Thursday.</div>
  <div class="item"><div class="meta">Today · 3:00 pm</div><h2>Lesson with Claire</h2>
    <p>Flatwork focus — leg yield at the trot, then a short gymnastic line. Beau was stiff on the right rein last week, so give him extra time to loosen before you ask for bend.</p></div>
  <div class="item"><div class="meta">Awaiting signature</div><h2>Horse Lease Agreement</h2>
    <p>The purpose and schedule sections are complete. Review the insurance elections before signing.</p></div>
  <div class="item"><div class="meta">Thursday</div><h2>Farrier</h2>
    <p>Sign-up sheet is in the barn. Beau is due for a full set.</p></div>
  <div class="item"><div class="meta">Saturday</div><h2>Clinic — flatwork</h2>
    <p>Two spots left. Auditing is open to all members at no charge.</p></div>
  <div class="item"><div class="meta">This week</div><h2>Feed change</h2>
    <p>Evening grain moves to 5:30pm starting Monday.</p></div>
</div><div class="tail"></div>
```

---

## Shared PageHeader component (src/components/app/PageHeader.tsx) — REPORT IS STALE
- reported by: TASK-ACCOUNTSURFACE-PHASE1.md
- reachability: **The claim is no longer true.** ACCOUNTSURFACE Phase 1 reported "there is no shared PageHeader component anywhere in the codebase." One now exists at `src/components/app/PageHeader.tsx`, created by `9cdb5b1 feat(pages): one page-header component, square icon-only add control (A5/A6)` and amended by `310b21c TASK-ADDNEW: revert A6, page-level create control reads "+ Add New"`. What survives of the finding is the **adoption gap**: PageHeader is reached only through `PageLayout.tsx:45`, and only **10 of 113 page files** use PageLayout — CareHome, Admin, DealsPage, ContactsPage (itself retired), LookupReviewPage, HorseRecordsPage, EvaluationReportsPage, DealPage, ReviewIndexPage, NewContractPage. **94 files still contain a hand-rolled `<h1>`**, across **20 distinct className strings**. So the component is real inventory that is 9% adopted, not a missing component.
- exists: yes
- content:

Current drift census (`grep -rho '<h1 className="[^"]*"' src/pages src/components | sort | uniq -c`):
```
  27 <h1 className="font-serif text-2xl text-green-900"
  14 <h1 className="font-serif text-2xl text-green-900 mb-1"
  12 <h1 className="heading-section text-green-800 mb-4"
   9 <h1 className="heading-section text-green-800 mb-3"
   8 <h1 className="heading-section text-green-800"
   5 <h1 className="heading-section text-green-800 mb-8"
   4 <h1 className="heading-section text-green-800 mb-2"
   4 <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5"
   2 <h1 className="font-serif text-xl text-green-800 mb-2"
   2 <h1 className="font-serif text-green-800 text-xl"
   1 <h1 className="qs-rise qs-delay-2 heading-display text-white leading-[1.08] tracking-[-0.01em] [text-wrap:balance] [overflow-wrap:break-word] text-[clamp(1.9rem,5vw,3.75rem)] [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]"
   1 <h1 className="heading-section text-white mb-4"
   1 <h1 className="heading-section text-green-800 mb-6"
   1 <h1 className="heading-section text-green-800 mb-6 flex items-center gap-2"
   1 <h1 className="heading-section text-green-800 mb-10"
   1 <h1 className="heading-section text-green-800 max-w-xl mx-auto mb-6"
   1 <h1 className="heading-display text-white text-[clamp(2.5rem,6vw,4.5rem)]"
   1 <h1 className="heading-display text-white mb-8 text-[clamp(2rem,5vw,3rem)]"
   1 <h1 className="heading-display text-white mb-4 text-[clamp(2rem,5vw,3rem)]"
   1 <h1 className="heading-display text-green-900 text-[clamp(2.5rem,6vw,4.5rem)]"
```

Real hand-rolled examples, each a different variant:
```
src/pages/app/HorsePage.tsx:111            <h1 className="font-serif text-2xl text-green-900">{name}</h1>
src/pages/app/HorseIntakePage.tsx:64       <h1 className="font-serif text-2xl text-green-900 mb-1">
src/pages/app/AcquisitionIntakePage.tsx:80 <h1 className="font-serif text-2xl text-green-900 mb-1">{title}</h1>
src/pages/app/CalendarPage.tsx:221         <h1 className="font-serif text-2xl text-green-900 inline-flex items-center gap-2">
src/pages/OrderDetail.tsx:56               <h1 className="heading-section text-green-800 mb-4">We couldn’t find that order</h1>
src/pages/Release.tsx:225                  <h1 className="heading-section text-green-800 mb-4">Stable rules and liability release.</h1>
```

The component nobody adopted (src/components/app/PageHeader.tsx:59-105), including the owner's own layout ruling in its header comment:
```tsx
/**
 * PAGE HEADER — the one placement, owner 2026-08-08 (A5/A6/A7).
 *
 * The owner's report: "the add-new button sits at a different height on every
 * page — new deal higher than new contract, lower than new horse." Ten pages had
 * hand-rolled this row, so they drifted. This is that row, once.
 *
 * THE ORDER, owner's words: "the top right corner is where the + button goes,
 * the page name is bottom aligned with that button, and the page title is below
 * those, and the description is below that."
 *
 *     ┌──────────────────────────────────────────────┐
 *     │ PAGE NAME (gold eyebrow) ............   [ + ]│  ← bottoms aligned
 *     │ Page title, large and green                  │
 *     │ Description, one size down                   │
 *     └──────────────────────────────────────────────┘
 */
export function PageHeader({ name, title, description, onAdd, addLabel }: { … }) {
  return (
    <header className="mb-8">
      <div className="flex items-end justify-between gap-4 min-h-[40px] mb-3">
        <p className="eyebrow">{name}</p>
        {onAdd && (
          <button type="button" onClick={onAdd}
            aria-label={addLabel ? `Add New ${addLabel}` : undefined}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
            <Plus size={16} aria-hidden="true" />
            Add New
          </button>
        )}
      </div>
      {title && <h1 className="heading-section text-green-800">{title}</h1>}
      {description && (
        <p className={`body-text text-muted max-w-2xl ${title ? 'mt-3' : ''}`}>{description}</p>
      )}
    </header>
  );
}
```

---

## /app/stable + StableSection (src/pages/app/Stable.tsx, src/components/app/StableSection.tsx) — REPORT IS STALE
- reported by: TASK-ACCOUNTSURFACE-PHASE1.md
- reachability: **Not dark. The claim is superseded.** Phase 1 reported "No /app/stable route exists yet." Phase 2 shipped it: the route is registered at `src/App.tsx:253` (`<Route path="stable" element={<Stable />} />`), and it is in the nav — `AppLayout.tsx:444` `{ key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' }` in PRESENCE_LINKS, with the old `section` marker deliberately dropped so active-state highlighting works. `AccountHub.tsx:97` now redirects `?section=stable` to the real route. The one live gate is presence: `my_nav_presence()` sets `stable` from `EXISTS (SELECT 1 FROM my_stable_horses())`, so the nav link is hidden for a member with no horses — the page itself is still reachable by URL.
- exists: yes
- content:

Route + nav registration:
```
src/App.tsx:250   {/* TASK-ACCOUNTSURFACE §2 (2026-08-07): My Stable's real route —
src/App.tsx:251       it previously only existed as /app/account?section=stable, */}
src/App.tsx:253   <Route path="stable" element={<Stable />} />

src/components/app/AppLayout.tsx:444
  { key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' },
```

The page (src/pages/app/Stable.tsx, whole file):
```tsx
export default function Stable() {
  useDocumentTitle('My Stable');
  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My Stable</p>
      <h1 className="heading-section text-green-800 mb-2">Your horses, gear, and supplies.</h1>
      <p className="body-text text-sm text-muted mb-8">Everything you keep here — manage your horses, gear, and supplies, and add new ones any time.</p>
      <StableSection />
    </div>
  );
}
```

The shared body (src/components/app/StableSection.tsx, 147 lines) — three labelled bands, each with its own add control:
```tsx
  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Horses</SectionLabel>
        <PageCreateButton label="Horse" onClick={() => setModal('horse')} />
      </div>
      <div className="flex flex-col gap-2.5">
        {showHorses.map((h) => (
          <Link key={h.id} to={`/app/horses/${h.id}`} className="block bg-white …">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-green-50 to-gold-50 shrink-0" />
              <div className="min-w-0">
                <p className="font-serif text-green-800 text-lg font-semibold leading-tight">
                  {h.name}{h.barnName && <span className="text-muted font-sans text-sm font-normal"> · "{h.barnName}"</span>}
                </p>
                <p className="text-[11.5px] text-muted">{[h.breed, h.sex, h.height, h.age, h.color].filter(Boolean).join(' · ')}</p>
                <p className="text-[11px] text-gold-800 font-semibold mt-0.5">{[h.ownership, h.discipline, h.location].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <SectionLabel>Gear</SectionLabel>
      … each gear row: name, detail, and a vendor link ("<ExternalLink/> {g.vendor}") …
        <button type="button" onClick={() => setModal('gear')} className="text-[12px] text-gold-800 font-semibold text-left px-1">+ Add gear</button>

      <SectionLabel>Supplies</SectionLabel>
      … same shape, "+ Add supply" …
```
Ownership copy is computed, not stored: `h.ownership === 'leased' ? (h.lease_end ? \`Leased through ${fmtDate(h.lease_end)}\` : 'Leased') : 'Owned'`.

---

## CardstockHeader.tsx + header-cardstock.css — DELETED, shelved intact (docs/reference/shelved-cardstock-header/)
- reported by: TASK-MOBILEPASS-REPORT.md
- reachability: deleted from `src/`, so nothing can import them. Verified: `grep -rn "CardstockHeader\|header-cardstock" src/` returns nothing; the ONEHEADER commit message records "cs-hdrwrap / cs-emboss / cs-tab / cs-drawer-tab / header-stock: 0 hits in dist CSS". Backups are present and readable: `CardstockHeader.tsx.txt` (154 lines, 8,434 B), `header-cardstock.css.txt` (532 lines, 27,066 B), `README.md` (2,516 B). The texture asset `public/header-stock.jpg` (493 KB) was **left in place**, so the restore is genuinely two file copies.
- exists: deleted in `ff10e1d fix(mobilepass): correct stale scrim comment, delete dead cardstock files` (−154 / −532 lines)
- content:

The shelving note, verbatim (docs/reference/shelved-cardstock-header/README.md) — this contains the owner's own words and the measured reason it cannot come back alone:
```markdown
# Shelved: the cardstock header

**Shelved 2026-08-08, not deleted.** Owner: *"the green header is cool and I love it but it's
got to go. We can save it for another time when we can colour-match the entire site to it."*

## To restore
1. Copy both files back, dropping the `.txt` suffix.
2. Confirm `header-cardstock.css` is imported (it was imported from `AppLayout.tsx`).
3. Check `--cs-hdr-h` still matches what the rails, contract subheader and drawer tab expect
   — they read it for their sticky offsets.
That is the whole restore. Nothing else was entangled with it.

## Why it was shelved
**The app was two backdrops.** A dark cardstock header above a near-white page meant the
translucent nav panel composited against both at once, and no single label colour is legible
across both. Measured:

    green-800/20 over the cream page   -> #c8cac0   hue  73deg   (yellow-green)
    green-800/20 over the dark header  -> #1a2d23   hue 147deg   (green)

**The page is warm (hue 37°), so mixing green into it rotates the hue 72° toward yellow.**
That is why the nav read as washed out — not paleness, a different colour.

## What is genuinely good here and should not be lost
The wordmark, monogram and avatar are **debossed relief** — layered `text-shadow` carving the
letters into the stock texture, with the avatar pressing on hover and click. It was tuned
over several sessions (the "5c" shadow values, the press depth, the ~36px threshold below
which relief stops resolving on mobile).
**Relief needs a mid-tone surface to carve into.** … If this returns, it returns whole.
```

The component's render (CardstockHeader.tsx.txt:58-120):
```tsx
  return (
    <div className="cs-hdrwrap">
      {/* Filter/clip/gradient defs for the avatar well. A native feGaussianBlur
          is used because iOS ignores CSS filter:blur() on SVG children. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="csWallBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          {/* keeps the blurred wall strictly inside the struck rim */}
          <clipPath id="csWellClip"><circle cx="25" cy="25" r="22.2" /></clipPath>
          {/* same clip, redrawn for the 42-unit avatar (≤410px) — cx/cy/r
              scaled ×42/50, not the 50-unit circle resized */}
          <clipPath id="csWellClip42"><circle cx="21" cy="21" r="18.65" /></clipPath>
          {/* Light comes from above, so the top wall casts and the bottom barely
              does. Faint on purpose: a diffuse shadow that gains REACH as the
              button sinks, not a fill that switches on. */}
          <linearGradient id="csWallFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity=".30" />
            <stop offset="45%" stopColor="#000" stopOpacity=".16" />
            <stop offset="75%" stopColor="#000" stopOpacity=".06" />
            <stop offset="100%" stopColor="#000" stopOpacity=".02" />
          </linearGradient>
        </defs>
      </svg>

      <header className="cs-hdr">
        <div className="cs-left">
          <Link to="/app" className="cs-homelink" aria-label="French Heritage Equestrian — home">
            <span className="cs-mark cs-logo">
              <svg className="cs-mark-lg" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE} />
                <path className="cs-ring" d={SQUIRCLE} />
              </svg>
              {/* TASK-BP410: redrawn at 48 units, not the 56-unit mark resized */}
              <svg className="cs-mark-sm" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE_48} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE_48} />
                <path className="cs-ring" d={SQUIRCLE_48} />
              </svg>
              <span className="cs-glyph cs-fh cs-emboss">FH</span>
            </span>
          </Link>
        </div>

        {/* The wordmark's own text is its accessible name, so it needs no label. */}
        <Link to="/app" className="cs-wordmark cs-emboss">
          <span className="cs-long">French Heritage Equestrian</span>
          <span className="cs-short">French Heritage</span>
        </Link>

        <div className="cs-right">
          {/* ONEMENU (owner ruling 2026-08-07): decorative monogram only — no
              button, no click handler, no press/hover class, no ARIA control
              semantics. … the account link now lives in the nav. */}
          <span className="cs-mark cs-avatar" aria-hidden="true">
            <svg className="cs-mark-lg" viewBox="0 0 50 50" width="50" height="50" focusable="false">
              <g clipPath="url(#csWellClip)">
                <circle className="cs-ring-wall" cx="25" cy="24.4" r="21.8" />
```

---

## The floating drawer tab (deleted from AppLayout.tsx; CSS rides out with the shelved cardstock stylesheet)
- reported by: TASK-MOBILEPASS-REPORT.md
- reachability: gone from the tree. The only trace is a tombstone comment at `src/components/app/AppLayout.tsx:2061`. The `.cs-drawer-tab` rules survive only inside the shelved `docs/reference/shelved-cardstock-header/header-cardstock.css.txt:353-388`, which is not imported by anything.
- exists: deleted in `eaab867 ONEHEADER: adopt the login header, drop the glass, delete the drawer tab`
- content:

The tombstone that replaced it (AppLayout.tsx:2061-2074):
```tsx
      {/* THE DRAWER TAB IS GONE — ONEHEADER §3 (owner, 2026-08-08). No hanging
          tab: the header's avatar button is the way into the nav on a phone, so
          there is one control for one job instead of a tab bolted to the side of
          the viewport. The `.cs-drawer-tab` rules ride out with the shelved
          cardstock stylesheet, which is no longer imported.

          Sequencing held, per the task doc: the tab was the ONLY way into the
          nav on mobile, so it could not go until the avatar button existed. It
          does — see AppHeader above, and note it drives this same
          `mobileNavOpen` state, so the two can no more desync than the tab
          could.

          Superadmin never had the tab; it keeps its own mobile nav button and
          its own drawer anchor — see the `isSuperAdmin` checks below. */}
```

The deleted JSX, recovered from `git show eaab867`:
```tsx
-          Tab and drawer are driven from the single `mobileNavOpen` state, so
-          they cannot desync: the tab's position, its arrow, its labels and the
-          drawer are all one boolean. Every close path already routes through
-          that state — the scrim's onClick, the Escape handler and the
-          route-change effect above, and a selection inside the drawer.
-
-          Superadmin does not get it (it keeps its own mobile nav button,
-          unchanged, and its own drawer anchor — see the `isSuperAdmin` check
-          on the `<nav>` below); the CSS also hides it at lg+, where the rail
-          is the nav. */}
-      {!isSuperAdmin && (
-        <button
-          type="button"
-          className={`cs-drawer-tab${mobileNavOpen ? ' is-open' : ''}`}
-          onClick={() => setMobileNavOpen((v) => !v)}
-          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
-          aria-expanded={mobileNavOpen}
-        >
-          <ChevronLeft size={20} aria-hidden="true" strokeWidth={2.25} />
-        </button>
-      )}
```

Its styling, still sitting in the shelved stylesheet (header-cardstock.css.txt:353-388) — note the recorded field failure that drove its design:
```css
.cs-drawer-tab {
  /* Owner, 2026-08-08. Two changes, both from a real user failing to find this.

     SOLID, NOT GLASS. It previously used NAV_GLASS. On an older iPhone the
     broken @supports test (fixed in 628079a) resolved that to a SOLID CREAM
     panel — a cream tab on a cream page, invisible. Sarah could not find the
     menu. A tab is a CONTROL, not a surface: it has to be found, so it now
     carries the brand green at full opacity with a cream chevron.

     BIGGER. 34x46 -> 40x52, clearing the 44px touch guideline on both axes
     with drawn pixels rather than an invisible pseudo-element. */
  position: fixed;
  right: env(safe-area-inset-right, 0px);
  top: calc(var(--cs-hdr-h) + 24px);
  z-index: 45;                       /* BELOW the drawer (z-50), not above it */
  width: 40px; height: 52px; border: 0; cursor: pointer;
  display: grid; place-items: center;
  border-radius: 12px 0 0 12px;
  background: #143321;
  color: #f5f0e8;
  box-shadow: 0 1px 2px rgba(16,28,22,.18), 0 6px 16px rgba(16,28,22,.22);
  transition: opacity .22s ease;
}
/* Owner: rather than fix the tab and drawer travelling at different speeds, do
   not make the tab travel at all. It fades out on open and back in on close, so
   there is no motion to synchronise — the mismatch is removed at the source
   instead of tuned. */
.cs-drawer-tab.is-open { opacity: 0; pointer-events: none; }
@media (min-width: 1024px) { .cs-drawer-tab { display: none; } }
```

---

## No notification surface, no bell — 45 notifications behind one nav badge (AppLayout.tsx NAV_BADGE, DashboardPanel.tsx)
- reported by: TASK-MOBILEPASS-REPORT.md
- reachability: VERIFIED — `grep -n "Bell" src/components/app/AppLayout.tsx src/components/app/AppHeader.tsx` returns **nothing**; there is no bell icon and no notifications route. The entire surface is (a) a count badge on the Dashboard nav link and (b) "Needs your attention" tiles inside DashboardPanel. Note the badge is not even notifications alone: `AppLayout.tsx:1519` sums it with the staff inbound-request count.
- exists: yes
- content:

The whole visible surface (AppLayout.tsx):
```tsx
257:  const NAV_BADGE = 'bg-gold-500 text-green-950';

823:  <span className={`absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 ${NAV_BADGE} … text-[10px] leading-4 text-center rounded-full`}>{badge > 9 ? '9+' : badge}</span>
836:  <span className={`min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full ${NAV_BADGE} …`}>{badge > 9 ? '9+' : badge}</span>

1511: // just move house, it SUMS into Dashboard's: myUnreadCount() (unreadCount,
1519: items: g.items.map((it) => (it.to === '/app/dashboard' ? { ...it, badge: unreadCount + inboundCount } : it)),
```

The tiles (src/components/app/DashboardPanel.tsx) — and note the dismissal semantics:
```tsx
 32: *   "Needs your attention" — unread notifications (each links to its target) and
244:      myNotifications().catch(() => [] as AppNotification[]),
259:      // ── needs attention: unread notifications (linked, dismissable) ──
260:      // Welcome greetings ("[member] said hi") appear here like any notification, but
268:      const att: Tile[] = notifications
274:            id: `n-${n.id}`, notificationId: n.id, kind: n.kind.replace(/_/g, ' '), title: n.title,

348:  // Close a notification tile. A manual close CONSUMES it — deletes the
349:  // notification (per-user) and leaves an audit-log entry — so it's gone for good
353:  function dismiss(notificationId: string, opts?: { silent?: boolean }) {
355:      markNotificationRead(notificationId).catch(() => {});
358:    consumeNotification(notificationId).catch(() => {});
```

What is actually flowing into this thin surface, from prod:
```
notifications: 45 total, 42 unread

kind             | title                                                                                       | created_at
-----------------+---------------------------------------------------------------------------------------------+---------------------------
request_new      | New inquiry from Kylie Pinion                                                               | 2026-08-12 14:47:28+00
purchase_unpaid  | Training Session — awaiting payment ($95.00)                                                | 2026-08-10 18:41:28+00
purchase_unpaid  | Single Lesson, Training Session — awaiting payment ($245.00)                                | 2026-08-10 18:41:28+00
purchase_unpaid  | Single Lesson — awaiting payment ($150.00)                                                  | 2026-08-10 18:41:28+00
party_signed     | Horse Emergency Veterinary Authorization — fully executed; signed by Claire Bourdon (CLIENT)| 2026-08-10 16:43:25+00
party_signed     | Human Emergency Medical Authorization v2 — fully executed; signed by Claire Bourdon (CLIENT)| 2026-08-10 16:43:12+00

(columns: id, org_id, user_id, kind, title, body, link, read_at, created_at, emailed_at — `body` is NULL on every row above)
```

---

## seed.ts — the switched-off preview content (src/lib/seed.ts, 270 lines)
- reported by: TASK-FACILITYTERM-REPORT.md
- reachability: VERIFIED — `export const SEED_ENABLED = false;` at `src/lib/seed.ts:10`. Every consumer guards on it (`SEED_ENABLED ? SEED_X : []`). `FEED_VIEW_META` is the exception: it is not seed data at all but the live per-view header copy, imported unconditionally by AppLayout's COMMUNITY_VIEWS and by the feed page headers.
- exists: yes
- content:

The file's own instruction to delete it (lines 1-10):
```ts
/* Preview seed data (temporary). Gives every surface something to render on the
 * GitHub preview before the RPCs/migrations are wired end-to-end. All exports are
 * plain data; pages import these as a fallback when a live query returns empty.
 * DELETE THIS FILE once the backing RPCs return real rows. Nothing here writes to
 * the database — it is display-only sample content.
 *
 * A single flag (SEED_ENABLED) gates all fallbacks so this can be turned off in one
 * place. It is on by default for the preview. */

export const SEED_ENABLED = false;
```
(Note the comment's last sentence — "It is on by default for the preview" — is now false.)

FEED_VIEW_META, which DOES render — this is live product copy sitting in a file marked for deletion (lines 34-43):
```ts
export const FEED_VIEW_META: Record<FeedView, { title: string; navLabel: string; description: string }> = {
  all:         { title: 'Community Feed', navLabel: 'All posts',   description: 'A place to welcome new members, share your experiences or views from around the stables, and helpful links, tack, or gear you no longer use that others may need' },
  social:      { title: 'Social',         navLabel: 'Social',      description: 'Photos, updates, and moments members are sharing.' },
  discussions: { title: 'Discussions',    navLabel: 'Discussions', description: 'Questions and conversations — jump in or start your own.' },
  for_sale:    { title: 'For Sale',       navLabel: 'For Sale',    description: 'Horses and gear listed by the ranch and members.' },
  events:      { title: 'Events',         navLabel: 'Events',      description: 'Clinics, shows, and gatherings — RSVP to save your spot.' },
  articles:    { title: 'Articles',       navLabel: 'Articles',    description: 'Guides and reading from French Heritage.' },
  resources:   { title: 'Resources',      navLabel: 'Resources',   description: 'Trusted vets, farriers, and suppliers members recommend.' },
  members:     { title: 'Members',        navLabel: 'Members',     description: 'Meet the community — say hi, or send a message.' },
};
```

A representative slice of the placeholder content that is switched OFF (feed, listings, articles, members, resources, dashboard, calendar, stable, account, saved, documents, instructor sessions):
```ts
export const SEED_FEED: SeedFeedItem[] = [
  { id: 'f1', kind: 'for_sale', view: 'for_sale', saleKind: 'horse', saleTag: 'Lease', price: 'Inquire',
    author: 'French Heritage', … title: 'Bruno — 16.1hh Warmblood', body: 'A generous, push-ride hunter with an even temperament.' },
  { id: 'f3', kind: 'discussion', … title: 'Best farrier in North County?', body: 'Looking for recommendations for my new mare…', replies: 4 },
  { id: 'f4', kind: 'social', author: 'Sofia R.', … body: 'Golden hour hack down to the beach. Never gets old.' },
  { id: 'f5', kind: 'article', … title: 'Preparing for your first show', body: 'What to pack, when to arrive, and how to keep your nerves in check.', audience: 'New riders', readMins: 6 },
  { id: 'f7', kind: 'event', … title: 'Summer schooling show', body: 'Open to all levels. Ribbons through 6th.', when: 'Jul 14 · 9:00 AM' },
  { id: 'f8', kind: 'social', author: 'Margaux C.', … body: 'First clean round over 1.10m today. Over the moon with this horse.' },
  { id: 'f9', kind: 'discussion', … title: 'Clipping tips for a nervous gelding?', body: 'He is fine until the clippers get near his ears…', replies: 7 },
];

export const SEED_ARTICLES: SeedArticle[] = [
  { id: 'a1', title: 'Preparing for your first schooling show', excerpt: 'What to pack, when to arrive, and how to keep your nerves in check on the day.', audience: 'New riders', mins: 6 },
  { id: 'a2', title: 'Building an independent seat', excerpt: 'Exercises to develop balance without relying on the reins.', audience: 'General', mins: 4 },
  { id: 'a3', title: 'Reading a course walk like a pro', excerpt: 'Striding, related distances, and where the time faults hide.', audience: 'Competition riders', mins: 8 },
  { id: 'a4', title: 'Winter turnout and blanketing', excerpt: 'A simple decision guide for coastal California owners.', audience: 'Horse owners', mins: 5 },
];

export const SEED_RESOURCES: SeedResource[] = [
  { id: 'r1', name: 'Coastal Equine Vet', category: 'Vets', note: 'Full-service equine care · Encinitas', … },
  { id: 'r2', name: 'North County Farrier Co.', category: 'Farriers', note: 'Hot & cold shoeing · corrective work', … },
  { id: 'r3', name: 'Del Mar Feed & Tack', category: 'Suppliers', note: 'Feed, supplements, tack · local pickup', … },
  { id: 'r4', name: 'Pacific Mobile Dentistry', category: 'Vets', note: 'Equine dental floats · mobile', … },
];

export const SEED_ATTENTION: SeedActionTile[] = [
  { id: 't1', kind: 'Approved · action', title: 'Lessons confirmed', sub: 'Sign & pay before the hold releases', cta: 'Complete', gold: true },
  { id: 't2', kind: 'Payment · 3 days', title: 'Membership renews Thu', sub: 'Review or update your method', cta: 'Review', gold: true },
  { id: 't3', kind: 'Invitation', title: 'Summer barn dinner', sub: 'Jul 20 · awaiting RSVP', cta: 'RSVP', gold: true },
];

export const SEED_CALENDAR: SeedCalItem[] = [
  { id: 'k1', date: dateIn(0),  kind: 'lesson',       title: 'Lesson with Élise',       sub: '4:00 PM · Carmel Creek' },
  { id: 'k2', date: dateIn(1),  kind: 'payment',      title: 'Membership renews',       sub: '$340 · Zelle on file' },
  { id: 'k3', date: dateIn(3),  kind: 'expiration',   title: 'Lesson hold releases',    sub: 'Sign & pay to keep your slot' },
  { id: 'k4', date: dateIn(5),  kind: 'event',        title: 'Summer schooling show',   sub: '9:00 AM · open to all levels' },
  { id: 'k5', date: dateIn(7),  kind: 'confirmation', title: 'Evaluation confirmed',    sub: 'Bruno · in-hand assessment' },
  { id: 'k6', date: dateIn(11), kind: 'event',        title: 'Summer barn dinner',      sub: '6:30 PM · RSVP requested' },
  { id: 'k7', date: dateIn(14), kind: 'payment',      title: 'Lesson package due',      sub: '$600 · 8-ride package' },
];
```

The seed file also carries two **full fake legal documents** (SEED_DOCUMENTS), which is worth the owner's eye given the app's real contract engine:
```
'RELEASE OF LIABILITY, WAIVER OF CLAIMS, AND ASSUMPTION OF RISK

In consideration of being permitted to participate in equestrian activities provided by French Heritage Equestrian ("the Company"), the undersigned participant acknowledges and agrees to the following terms.

1. ASSUMPTION OF RISK. The participant understands that horseback riding and related equestrian activities carry inherent risks, including but not limited to the unpredictable behavior of horses, falls, and contact with animals, equipment, and terrain. …

2. RELEASE. The participant releases the Company, its owners, instructors, and agents from any and all claims arising from participation in equestrian activities, except those arising from gross negligence, reckless conduct, or intentional misconduct.

3. DISPUTE RESOLUTION. Any dispute shall be resolved through binding arbitration administered under the applicable JAMS/AAA rules, with the Company bearing arbitration fees above the equivalent court filing fee, and each party bearing its own attorney's fees.'
```

---

## Sales financials backend — 8 objects written, never applied (supabase/migrations/20260726090000_biz_expenses_and_financials.sql, 315 lines)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: VERIFIED AND STILL TRUE. Queried prod `pg_proc` / `pg_views` / `pg_tables` for all eight names plus the two backing tables — **zero rows returned**. Nothing from this migration exists in the database. `grep -rn "sales_summary\|business_kpis\|growth_summary\|profit_and_loss\|upsert_expense\|list_expenses\|expense_categories_list" src/ api/` also returns **nothing**. So: unapplied AND unreferenced. (All eight are FUNCTIONS returning jsonb, not views as the report's phrasing implies.)
- exists: yes (file present, 315 lines)
- content:

The header's own statement of intent:
```sql
-- Admin business suite — expense model + financial rollup RPCs.
--
-- Everything reads LIVE data: sales/P&L aggregate the real purchases +
-- board_charges; growth reads real contacts/clients/memberships; the KPI tiles
-- pull the same. Expenses are the one greenfield piece (new tables). All rollups
-- are org-scoped + staff-gated and degrade to zeroes on an empty period (the
-- data is sparse today; these must populate correctly as real rows land).
```

The chart of accounts it would seed (13 categories, each mapped to a tax bucket):
```sql
INSERT INTO public.expense_categories (org_id, code, name, tax_bucket, sort_order)
SELECT o.id, c.code, c.name, c.tax_bucket, c.sort_order
  FROM public.organizations o
  CROSS JOIN (VALUES
    ('FEED',        'Feed & Hay',              'Supplies',            10),
    ('VET',         'Veterinary & Medical',    'Contract labor',      20),
    ('FARRIER',     'Farrier',                 'Contract labor',      30),
    ('SUPPLIES',    'Barn Supplies & Equipment','Supplies',           40),
    ('FACILITY',    'Facility & Rent',         'Rent/lease',          50),
    ('UTILITIES',   'Utilities',               'Utilities',           60),
    ('INSURANCE',   'Insurance',               'Insurance',           70),
    ('PAYROLL',     'Labor & Contractors',     'Wages',               80),
    ('MARKETING',   'Marketing & Advertising', 'Advertising',         90),
    ('TRANSPORT',   'Transport & Fuel',        'Car & truck',        100),
    ('SOFTWARE',    'Software & Subscriptions','Other',              110),
    ('FEES',        'Bank & Processing Fees',  'Other',              120),
    ('OTHER',       'Other',                   'Other',              130)
  ) AS c(code, name, tax_bucket, sort_order)
ON CONFLICT (org_id, code) DO NOTHING;
```

`sales_summary(p_from, p_to, p_grain)` — totals, a time series, and a payment-method split:
```sql
CREATE OR REPLACE FUNCTION public.sales_summary(
  p_from date DEFAULT (current_date - 30), p_to date DEFAULT current_date, p_grain text DEFAULT 'day')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  SELECT jsonb_build_object(
    'orders', count(*),
    'gross_booked', coalesce(sum(amount),0),
    'collected', coalesce(sum(amount_paid),0),
    'outstanding', coalesce(sum(greatest(amount - coalesce(amount_paid,0),0)),0),
    'paid_orders', count(*) FILTER (WHERE payment_status = 'paid'))
  INTO v_totals
  FROM purchases
  WHERE org_id = v_org AND deleted_at IS NULL AND coalesce(status,'') <> 'void'
    AND created_at::date BETWEEN p_from AND p_to;

  -- per-bucket series (day | week | month)
  SELECT date_trunc(v_trunc, created_at)::date AS bucket, count(*) AS orders,
         sum(amount) AS booked, sum(amount_paid) AS collected  … GROUP BY 1

  -- by payment method
  SELECT coalesce(payment_method,'—') AS method, count(*) AS orders, sum(amount_paid) AS collected … GROUP BY 1

  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'grain', v_trunc,
    'totals', v_totals, 'series', v_series, 'by_method', v_by_method);
END; $function$;
```

`profit_and_loss(p_from, p_to)` — revenue from purchases + board_charges, less expenses, broken out by category:
```sql
  SELECT coalesce(sum(amount_paid),0) INTO v_purch FROM purchases
   WHERE org_id=v_org AND deleted_at IS NULL AND coalesce(status,'')<>'void'
     AND coalesce(paid_at, created_at)::date BETWEEN p_from AND p_to;
  SELECT coalesce(sum(amount),0) INTO v_board FROM board_charges …;
  SELECT coalesce(sum(amount),0) INTO v_exp   FROM expenses …;

  SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.total DESC), '[]'::jsonb) INTO v_by_cat FROM (
    SELECT coalesce(ec.name,'Uncategorized') AS category, coalesce(ec.tax_bucket,'Other') AS tax_bucket,
           sum(e.amount) AS total
    FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE … GROUP BY 1,2) c;

  RETURN jsonb_build_object('from', p_from, 'to', p_to,
    'revenue',  jsonb_build_object('purchases', v_purch, 'boarding', v_board, 'total', v_purch + v_board),
    'expenses', jsonb_build_object('total', v_exp, 'by_category', v_by_cat),
    'net', (v_purch + v_board) - v_exp);
```

`growth_summary(...)` — new contacts per period plus an MRR calculation with a documented correction:
```sql
  -- MRR: the MONTHLY value of currently-active recurring subscriptions —
  -- per-item monthly price (recurring items are priced price_unit='month')
  -- times quantity, over PAID recurring purchases whose last payment is
  -- recent enough to still be live (35-day window covers a monthly cadence
  -- with grace). The prior version summed purchases.amount over ALL
  -- recurring purchases ever, unwindowed and unnormalised — a lifetime
  -- total mislabelled "monthly".
  SELECT coalesce(sum(pi.price_amount * coalesce(pi.quantity,1)),0) INTO v_mrr
    FROM purchases p JOIN purchase_items pi ON pi.purchase_id=p.id JOIN offerings o ON o.id=pi.offering_id
   WHERE p.org_id=v_org AND p.deleted_at IS NULL AND p.status='paid'
     AND o.config_kind='recurring'
     AND coalesce(p.paid_at, p.created_at) >= current_date - 35;

  'active_memberships', (
      -- paying-member proxy, NOT activated accounts: non-staff members only.
      -- The prior count included staff profiles (every activated account).
      SELECT count(*) FROM memberships m JOIN profiles pr ON pr.user_id=m.user_id
       WHERE m.status='active' AND coalesce(pr.role,'USER')='USER'
         AND NOT coalesce(pr.is_admin,false)),
```

`business_kpis()` — the six headline dashboard tiles:
```sql
  RETURN jsonb_build_object(
    'mtd_revenue',        (… sum(amount_paid) FROM purchases … coalesce(paid_at,created_at)::date >= v_mstart),
    'mtd_expenses',       (… sum(amount)      FROM expenses  … incurred_on >= v_mstart),
    'outstanding',        (… sum(greatest(amount-coalesce(amount_paid,0),0)) FROM purchases …),
    'mtd_new_clients',    (… count(*) FROM contacts … created_at::date >= v_mstart),
    'active_memberships', (… non-staff active memberships …),
    'open_orders',        (… count(*) FROM purchases WHERE status IN ('draft','awaiting_payment'))
  );
```

---

## renderTemplate() — dead email registry still holding forbidden welcome + dunning copy (api/_lib/email.ts:257-290)
- reported by: TASK-EMAILEXTRACT-REPORT.md
- reachability: VERIFIED — `grep -rn "renderTemplate" src/ api/ supabase/ scripts/` returns exactly one definition and **no call site**. (The other hits are a *different* symbol, `renderTemplateString` in `api/_lib/emailTemplates.ts`, and a comment in `scripts/emailextract/diff.mjs:512`.) Its last caller, `_lib/receipt.ts` case `'receipt'`, now reads the `ORDER_RECEIPT` row out of `email_templates`.
- exists: yes
- content:

The retention notice the previous task left on it, verbatim (lines 236-256) — this is the decision record:
```ts
/**
 * DEAD AS OF TASK-EMAILEXTRACT (2026-08-12) — RETAINED, NOT DELETED.
 *
 * This was the old built-in registry. Its only live caller was `_lib/receipt.ts`
 * (case 'receipt'), which now reads the `ORDER_RECEIPT` row out of
 * `email_templates` like every other sender. Nothing calls this function today.
 *
 * ⚠️ TWO OF ITS FOUR CASES ARE D9 VIOLATIONS AND MUST NOT BE WIRED UP.
 * D9 settled that there is NO welcome email and NO dunning email, and that both
 * producers were deleted deliberately. Their TEMPLATE STRINGS survive here:
 *   'signup'  → "Welcome to {brand} — your account is ready."   ← the welcome email
 *   'dunning' → "Payment reminder / You have an outstanding balance." ← the dunning email
 * They have no producer and no caller, so nothing sends them; they are wording
 * looking for a sender. They are NOT extracted into `email_templates` — putting
 * them in a list the owner browses and publishes from is exactly how a settled
 * decision gets quietly reversed. The third dead case, 'contract_executed', was
 * superseded by DOCUMENT_PARTY_COPY (its hardcoded subject was fixed in 2026-08-02's
 * delivery work) and is likewise left alone.
 *
 * Deleting this is TASK-EMAILEXTRACT's finding to report, not its change to make.
 */
```

**Every email template it holds, complete — subject and body, verbatim** (lines 257-290):
```ts
export function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
  fromName: string,
): TransactionalTemplate {
  const v = (k: string): string => (vars?.[k] == null ? '' : String(vars[k]));
  switch (template) {
    case 'signup':
      return {
        subject: `Welcome to ${fromName}`,
        body: `<p>Welcome${v('name') ? `, ${v('name')}` : ''} — your account is ready.</p>`,
      };
    case 'contract_executed':
      return {
        subject: `Your contract is executed`,
        body: `<p>Your document ${v('documentTitle') || 'contract'} has been fully executed.</p>`,
      };
    case 'receipt':
      return {
        subject: `Your receipt from ${fromName}`,
        body: `<p>We received your payment${v('amount') ? ` of ${v('amount')}` : ''}. Thank you.</p>`,
      };
    case 'dunning':
      return {
        subject: `Payment reminder`,
        body: `<p>You have an outstanding balance${v('amount') ? ` of ${v('amount')}` : ''}.</p>`,
      };
    default:
      return {
        subject: v('subject') || `A message from ${fromName}`,
        body: v('body') || `<p>${v('message')}</p>`,
      };
  }
}
```
Rendered plainly, the four subject/body pairs are:

| case | subject | body |
|---|---|---|
| `signup` | Welcome to French Heritage Equestrian | Welcome, {name} — your account is ready. |
| `contract_executed` | Your contract is executed | Your document {documentTitle} has been fully executed. |
| `receipt` | Your receipt from French Heritage Equestrian | We received your payment of {amount}. Thank you. |
| `dunning` | Payment reminder | You have an outstanding balance of {amount}. |
| *(default)* | {subject} — or "A message from {brand}" | {body} — or {message} |

The D9 decision itself, as recorded elsewhere in the tree:
```
docs/PERSON_DATA_CONSOLIDATION.md:63   - `payment_reminders` — D9: no dunning email exists
docs/reports/TASK-EMAILEXTRACT-REPORT.md:106  > D9 settled that there is **no welcome email and no dunning email**, and that both producers
docs/reports/TASK-EMAILEXTRACT-REPORT.md:329  1. **🔴 D9: the welcome and dunning WORDING still exists** in `renderTemplate`
```

---

## 48 deleted DB tests across 5 files (test/db/*.test.ts)
- reported by: TASK-TESTDB-REPORT.md
- reachability: deleted outright; the subjects they exercised (`orders`, `order_items`, `transactions`, `billable_lines` settlement, `engagements`, `offering_tiers`) are retired tables/layers.
- exists: deleted in `bcda19b test(db): make the db suite actually run — 651 skipped -> 107`. Deleted line counts from that commit's stat: `client_balance_read.test.ts` −220, `client_self_signing.test.ts` −133, `e2e_payment.test.ts` −212, `purchase_catalog_matrix.test.ts` −225, `settlement_rollup.test.ts` −320. **Total −1,110 lines.**
- content:

**The test titles are the spec of the retired behaviour.** Recovered via `git show bcda19b^:<path>`:

`test/db/purchase_catalog_matrix.test.ts` (−225):
```
describe('catalog inventory')
  it('has priced tiers to exercise (the seeded catalog is non-empty)')
describe('EVERY priced catalog tier survives the full money path')
  it('finalizes each tier and auto-matches its Zelle payment by unique amount')
describe('combination carts (multi-item orders)')
  it('every adjacent pair of priced tiers totals correctly and gets a distinct key')
  it('a full mixed cart (first 5 priced tiers) finalizes with a server-recomputed total')
describe('hardcoded-value defenses')
  it('a client-tampered tier price is overridden by the server price')
  it('finalize is idempotent: re-calls keep the same amount + reference')
  it("a non-owner cannot finalize someone else's order; confirmed orders are immutable")
describe('catalog.ts ↔ offering_tiers drift guard')
  it('lesson pack prices in the frontend catalog match the DB tiers exactly')
```

`test/db/client_balance_read.test.ts` (−220):
```
describe('billable_lines: client reads own OPEN lines only')
  it('the client sees exactly their own lines (payer scoping, not client-side filtering)')
  it("another member's line is invisible to the client, and vice versa")
  it('the client cannot write lines: UPDATE is a zero-row no-op, INSERT is rejected')
describe('transactions: the payer reads their own settlement INVOICE (payer-read policy)')
  it('setup: staff settle rolls the client lines into ONE invoice with engagement_id NULL')
  it('the client reads their own invoice; another member sees nothing')
  it('the client also reads their own engagement (the grouping read the page does)')
  it('payer read grants SELECT only: the payer cannot UPDATE the invoice')
  it("cross-tenant: an org-B payer's invoice never appears for the org-A client")
describe('payments: history is owner-scoped via owns_order')
  it('a client reads payments on their OWN orders only')
  it('a client cannot write payments (server-managed)')
```

`test/db/settlement_rollup.test.ts` (−320):
```
describe('settle_billable_lines: rolls OPEN lines into one INVOICE (real RPC path)')
  it('creates ONE transactions INVOICE with amount = SUM for the correct payer + org')
  it('flips every rolled line to SETTLED and stamps it with the new transaction_id')
  it('audits the settle (audit_logs INSERT for the new transaction)')
describe('settle_billable_lines: stamps the shared engagement when all lines tie to one')
  it('sets engagement_id when EVERY rolled line ties to the same engagement')
describe('settle_billable_lines: idempotent + re-runnable')
  it('a re-run for the same payer creates NO second invoice (settled lines skipped)')
  it('a NEW open line added after settle IS rolled by a later settle (distinct invoice)')
describe('settle_billable_lines: period scoping')
  it('only rolls lines whose period is contained in the settle window')
describe('settle_billable_lines: tenant isolation')
  it('org-A settle never rolls org-B lines; org-B settle rolls only org-B lines')
describe('settle_billable_lines: only org staff may settle')
  it('a plain USER (client) is denied (has_staff_access() guard)')
describe('settle_billable_lines: rolled lines are sealed (append-only)')
  it('a line settled by the RPC cannot be un-settled or re-amounted')
```

`test/db/e2e_payment.test.ts` (−212):
```
describe('chain 3 — draft order + hold, then finalize_order_payment')
  it('the client drafts the order with a TAMPERED tier item price and holds the slot')
  it('finalize forces the SERVER tier price, recomputes totals, and mints the Zelle keys')
  it('re-finalizing is idempotent — the matching keys are assigned ONCE')
  it('a second open order at the SAME total gets a DIFFERENT unique_amount')
describe('chain 3 — the Zelle reconciler match on unique_amount')
  it("the reconciler's candidate query finds EXACTLY the one order (deterministic key)")
  it('confirm: payment row + order confirmed + confirm_booking_for_order (the reconciler writes)')
describe('chain 3 — duplicate guards')
  it('a replayed notification no longer matches (the order left awaiting_payment)')
  it('an order already carrying a confirmed payment hits the duplicate guard (no second payment)')
  it('a confirmed order can never be re-finalized')
```

`test/db/client_self_signing.test.ts` (−133):
```
describe('client-scoped reads (MyEngagements / MyEngagementDetail rely on RLS)')
  it('the member reads their own engagement, parties, and document')
  it('a stranger member reads NONE of it')
describe('record_signature caller verification')
  it("a stranger cannot sign another client's document as its party")
  it("the party's own contact self-signs their own role")
  it('the member cannot sign a role that is not theirs (COMPANY)')
  it('tenant staff still facilitate any party, and the document executes')
  it('an unauthenticated caller is still rejected outright')
```

One full deleted test body, as a sample of the depth that went (purchase_catalog_matrix.test.ts:154-170):
```ts
describe('hardcoded-value defenses', () => {
  it('a client-tampered tier price is overridden by the server price', async () => {
    await h.asUser(uid);
    const tier = tiers.find((t) => Number(t.price_amount) >= 100)!;
    const orderId = await makeOrder([
      { tier_id: tier.id, offering_id: tier.offering_id, label: tier.label, price: 1 }, // tampered
    ]);
    const { uniqueAmount } = await finalize(orderId);
    await h.asSuperuser();
    const [o] = await h.q<{ total: string }>(`select total from orders where id=$1`, [orderId]);
    expect(Number(o.total)).toBe(tier.price_amount!); // server price won
    expect(uniqueAmount).toBeGreaterThan(tier.price_amount!);
    const [item] = await h.q<{ price_amount: string }>(
      `select price_amount from order_items where order_id=$1`, [orderId]);
    expect(Number(item.price_amount)).toBe(tier.price_amount!);
  });
```

---

## DocumentsPanel + PaperViewer, removed from AccountPanels.tsx
- reported by: TASK-ACCOUNTSURFACE-REPORT.md
- reachability: removed from the file; `AccountPanels.tsx` is now 67 lines (was 198 — the report's "200" and "down from 200" are close enough). Its header comment records that they were retired as a *weaker duplicate*, not merely a smaller one.
- exists: deleted in `02efb58 TASK-ACCOUNTSURFACE Phase 2: all account rows expand in place, My Stable gets a route`
- content:

What replaced them, stated in the surviving file's header (src/components/app/AccountPanels.tsx:11-17):
```tsx
/**
 * ACCOUNT PANELS — Saved items, the one subject left here. (Gifts moved to
 * their own page; Documents moved to DocumentsContent.tsx, TASK-ACCOUNTSURFACE
 * §3 — the old DocumentsPanel/PaperViewer in this file were a WEAKER duplicate
 * of Documents.tsx, not just a smaller one, so they were retired rather than
 * kept as a second implementation. See that file's header for the reconciliation.)
 */
```

The removed `DocumentsPanel` — note it did real work (it fetched live documents and paginated their merged text into sheets), recovered from `git show 02efb58^`:
```tsx
export function DocumentsPanel() {
  const [open, setOpen] = useState<SeedDocument | null>(null);
  const [rows, setRows] = useState<SeedDocument[] | null>(null);

  // REAL documents: the member's engagement documents with their actual merged
  // text (the placeholders the panel launched with are gone — owner-reported).
  useEffect(() => {
    listMySignableDocuments()
      .then((items) => setRows(items
        .sort((a, b) => Number(b.signed) - Number(a.signed))
        .map((it) => {
          const d = it.document;
          const when = d.effective_date ?? d.generated_at ?? d.created_at;
          const body = d.merged_body ?? 'This document is being prepared.';
          // paginate the real text into readable sheets
          const paras = body.split(/\n\n+/);
          const pages: string[] = [];
          let cur = '';
          for (const para of paras) {
            if (cur && (cur.length + para.length) > 2400) { pages.push(cur); cur = para; }
            else cur = cur ? cur + '\n\n' + para : para;
          }
          if (cur) pages.push(cur);
          return {
            id: d.id,
            title: d.title ?? 'Document',
            kind: d.status === 'EXECUTED' ? 'Signed' : 'Awaiting signature',
            signedOn: `${it.signed ? 'Signed' : 'Generated'} ${new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
            pages: pages.length ? pages : [body],
            body,
          };
        })))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      {rows === null && <p className="text-sm text-muted px-1 py-2">Loading your documents…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted px-1 py-2">No documents yet — agreements you sign will live here.</p>
      )}
      … each row: FileText tile, title, "{kind} · {signedOn}", chevron …
      {open && <PaperViewer doc={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The document rendered as PAPER: a page with drop shadow, subtle edges, and page
 *  breaks. Slightly narrower than the sheet so scrolling reads as moving down a
 *  document. Overlay so it feels like opening the physical document. */
function PaperViewer({ doc, onClose }: { doc: SeedDocument; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const total = doc.pages.length;
  return (
    <div className="fixed inset-0 bg-green-950/50 backdrop-blur-[2px] z-[70] flex flex-col" onClick={onClose}>
      {/* top bar */}
      <div className="flex items-center justify-between px-4 h-14 bg-white/95 border-b border-green-800/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-serif text-green-800 text-[15px] font-semibold truncate">{doc.title}</p>
          <p className="text-[11px] text-muted">{doc.signedOn}</p>
        </div>
        …
```

All that remains in the file (SavedPanel, 67 lines total) — and it always renders its empty state, because `SEED_ENABLED` is false and there is no real saved-items model:
```tsx
export function SavedPanel() {
  // I2 fix (found during nav-presence verification): this unconditionally
  // rendered SEED_SAVED regardless of SEED_ENABLED, showing the same 4 fake
  // items to every real account — the only seed section that skipped the
  // gate every other one (e.g. StableSection) applies. There is no real
  // saved/bookmark data model yet (tracked separately); until there is, this
  // always renders empty, matching my_nav_presence()'s saved=false.
  const items = SEED_ENABLED ? SEED_SAVED : [];
  if (items.length === 0) {
    return (
      <div className="mt-2.5 mb-1 p-8 bg-cream-100/60 border border-green-800/10 rounded-xl text-center">
        <BookmarkX size={26} className="text-muted mx-auto mb-2" />
        <p className="font-serif text-green-800">Nothing saved yet</p>
        <p className="text-[12px] text-muted mt-1">Bookmark articles, listings, and links to find them here.</p>
      </div>
    );
  }
  … (the populated branch, unreachable today: icon tile, title, sub, ExternalLink or chevron)
}
```

---

## PRESENCE_LINKS / MenuLink / accountMenu — the superadmin-only avatar dropdown (src/components/app/AppLayout.tsx)
- reported by: TASK-ONEMENU-REPORT.md
- reachability: VERIFIED, both halves.
  1. **`accountMenu` renders only for superadmin.** It is built at `AppLayout.tsx:1633` but placed in exactly one spot, `line 1803`, inside the `{isSuperAdmin ? ( … ) : ( … )}` branch that begins at `line 1735`. The tenant header (CardstockHeader → AppHeader) renders an inert monogram with no dropdown — recorded in the comment at 1743-1750.
  2. **The presence branch inside it never renders, even for superadmin.** `line 1279`: `const presence = useNavPresence(!isStaff)` — the hook is *disabled* for staff, so every key is false; `line 1288`: `const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key])` is therefore always `[]` for a superadmin, and the `navLinks.map(...)` block at 1691-1702 emits nothing. It is also nested inside `{!isAdmin && !isSuperAdmin && ( … )}` (line 1667), which is false for a superadmin regardless. Two independent gates, same result.
- exists: yes
- content:

`PRESENCE_LINKS` in full — a five-item member menu, with its own design note (AppLayout.tsx:437-448):
```tsx
const PRESENCE_LINKS: { key: keyof NavPresence; label: string; icon: typeof ShoppingBag; to: string; section?: string }[] = [
  { key: 'orders', label: 'My Orders', icon: ReceiptText, to: '/app/orders' },
  { key: 'documents', label: 'My Documents', icon: FileText, to: '/app/documents' },
  /* D2 resolved: /app/stable shipped with ACCOUNTSURFACE, so this points at the
     real route. `section` MUST be dropped alongside it — isActive falls back to
     a pathname match only when `section` is absent (see PresenceLink), so
     leaving it would mean My Stable never highlights as active. */
  { key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' },
  { key: 'posts', label: 'My Posts', icon: Grid3x3, to: '/app/my-posts' },
  { key: 'saved', label: 'My Saved Items', icon: Bookmark, to: '/app/account?section=saved', section: 'saved' },
];
```
(Correction to the report: PRESENCE_LINKS is **not** dead-for-tenant. It is also consumed by the live tenant rail/drawer through `PresenceLink` at `line 1145`. What is superadmin-only is the *dropdown copy* of it inside `accountMenu`.)

`MenuLink` in full (AppLayout.tsx:845-861):
```tsx
function MenuLink({ to, label, icon: Icon, end, onNavigate }: NavItem & { onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-sans transition-colors focus-ring ${
          isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100'
        }`
      }
    >
      <Icon size={17} aria-hidden="true" />
      {label}
    </NavLink>
  );
}
```

`accountMenu` — every label the owner has never seen rendered (AppLayout.tsx:1628-1725):
```tsx
  /* THE ACCOUNT DROPDOWN — hoisted out of the header markup because there are
     now two headers (superadmin's untouched platform chrome and the tenant's
     cardstock nameplate) and this panel is identical in both. … */
  const accountMenu = menuOpen ? (
    <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 …">
      <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
      <MenuLink to="/app/account" label="Account" icon={UserRound} onNavigate={closeMenu} />

      {/* admin references — company-associable items only */}
      {isAdmin && !isSuperAdmin && (
        <>
          <div className="… uppercase tracking-wide text-secondary/60">Company</div>
          <button … onClick={() => { closeMenu(); navigate('/app/ops/documents'); }}>
            <FileText size={17} /> Pending agreements
          </button>
          {/* Both operators navigate to the community + catalog to help
              members with what they're seeing — no shopper-only links. */}
          <div className="… uppercase tracking-wide text-secondary/60">Quick access</div>
          <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" rowInsetClass="px-3" /></div>
          <button … onClick={() => { closeMenu(); navigate('/app/dashboard'); }}>
            <LayoutDashboard size={17} /> Dashboard
            {unreadCount > 0 && <span className="… bg-gold-600/70 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button … onClick={() => { closeMenu(); navigate('/app/catalog'); }}>
            <ShoppingBag size={17} /> Catalog
          </button>
        </>
      )}

      {/* client quick links — an admin's menu carries company work, not shopper shortcuts */}
      {!isAdmin && !isSuperAdmin && (
        <>
          <div className="… uppercase tracking-wide text-secondary/60">Quick access</div>
          <div className="px-1"><CommunityNav … /></div>
          {QUICK.map((q) => { … <q.icon size={17} /> {q.label} … })}
          {/* I2 — same five presence-gated links as the rail, dropdown-shaped. */}
          {navLinks.map((l) => { … })}          {/* ← always [] — see reachability */}
        </>
      )}

      {navGroups.length > 0 && (
        <div className="lg:hidden">
          {navGroups.map((g) => (
            <div key={g.key}>
              <div className="… uppercase tracking-wide text-secondary/60">{g.label}</div>
              {g.items.map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
            </div>
          ))}
        </div>
      )}

      <button … onClick={() => { closeMenu(); setTourOpen(true); }}>
        <Compass size={17} aria-hidden="true" className="shrink-0" /> App tour
      </button>
      <button … onClick={handleSignOut}>
        <LogOut size={17} aria-hidden="true" className="shrink-0" /> Sign out
      </button>
    </div>
  ) : null;
```

The superadmin-only gate and its recorded reasoning (AppLayout.tsx:1735-1750, 1792-1803):
```tsx
      {isSuperAdmin ? (
      /* ── SUPERADMIN: PLATFORM CHROME, DELIBERATELY UNTOUCHED ──────────────
         This is the platform operator's chrome, not a tenant's branding …

         ONEMENU (2026-08-07): the tenant's CardstockHeader avatar is now an
         inert monogram and no longer renders `accountMenu` at all — its
         contents (Account, Company, Quick access, Sign out) moved into the
         tenant side nav (rail + drawer) instead. `accountMenu` itself is
         UNCHANGED and lives on here, exclusively for superadmin: it is the
         platform operator's only sign-out path, and Q3's ruling was to leave
         this chrome alone entirely rather than fold it into the
         consolidation too. */
        …
            <div className="relative" ref={menuRef}>            {/* line 1792 */}
              <button type="button" onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full … focus-ring"
                aria-label="Account menu" aria-expanded={menuOpen}>
                {/* No notifications badge on the avatar — the count lives on the
                    Dashboard nav link (desktop rail + mobile menu) instead. */}
                <span className="w-8 h-8 rounded-full bg-green-800 text-white text-sm font-sans grid place-items-center">
                  {initial}
                </span>
                <ChevronDown size={14} className="text-secondary" />
              </button>
              {accountMenu}                                     {/* line 1803 — the ONLY render site */}
            </div>
```

The presence gate that empties it (AppLayout.tsx:1279, 1288) and the RPC behind it:
```tsx
1279:  const presence = useNavPresence(!isStaff);   // disabled for staff → all keys false
1288:  const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);   // → [] for superadmin
```
```sql
CREATE OR REPLACE FUNCTION public.my_nav_presence() RETURNS jsonb …
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('orders', false, 'documents', false, 'stable', false, 'posts', false, 'saved', false);
  END IF;
  v_orders    := EXISTS (SELECT 1 FROM purchases p WHERE (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id()) AND p.org_id = current_org());
  v_documents := EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1);
  v_stable    := EXISTS (SELECT 1 FROM public.my_stable_horses() LIMIT 1);
  v_posts     := EXISTS (SELECT 1 FROM feed_posts fp WHERE fp.author_id = auth.uid());
  RETURN jsonb_build_object('orders', v_orders, 'documents', v_documents, 'stable', v_stable,
                            'posts', v_posts, 'saved', false);   -- 'saved' is hardcoded false
```
