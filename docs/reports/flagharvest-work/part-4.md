# FLAGHARVEST part 4 — unviewed inventory, artifacts 33–47

Read-only pass. Nothing recommended for deletion; nothing changed.
Worktree HEAD: `86283dc`. Prod DB read via `.env.db` (SELECT only).

---

## 33. SavedPanel + SEED_SAVED + SEED_ENABLED — "Saved items" (`src/components/app/AccountPanels.tsx`, `src/lib/seed.ts`)
- reported by: TASK-I-REPORT.md [INV batch3.md#45], TASK-ACCTEVAL-REPORT.md [INV batch4.md#56]
- reachability: **verified — the section renders, but always empty; the nav row never appears.**
  - `src/lib/seed.ts:10` — `export const SEED_ENABLED = false;` is the single flag.
  - `src/components/app/AccountPanels.tsx:34` — `const items = SEED_ENABLED ? SEED_SAVED : [];` → always `[]`, so the empty state below is the only branch a real user can reach. The four `SEED_SAVED` items are unreachable in the running app.
  - The Account row itself IS clickable: `src/pages/app/AccountHub.tsx:141-142` renders "My Saved Items" for every non-staff account, so a member CAN open it and will see only the empty state.
  - The NAV link is gated off in the database: `my_nav_presence()` returns `'saved', false` **hardcoded** (prod prosrc, below), and `src/components/app/AppLayout.tsx:1288` filters on it — `const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);` — so the `PRESENCE_LINKS` entry at `AppLayout.tsx:446` (`/app/account?section=saved`) never renders. A second, unfiltered copy exists at `AppLayout.tsx:1154`.
  - No saved/bookmark table exists: `information_schema` has no `saved_*` / `bookmark*` table, and nothing in `src/` writes one. Confirmed no save/bookmark control anywhere in `src/`.
- exists: yes

The `SEED_ENABLED` line (`src/lib/seed.ts:1-10`, including the file's own deletion notice):

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

The four fake Saved items, verbatim (`src/lib/seed.ts:218-228`):

```ts
// ─── Saved items ───────────────────────────────────────────────
export type SeedSavedKind = 'article' | 'listing' | 'link';
export interface SeedSaved {
  id: string; kind: SeedSavedKind; title: string; sub?: string; url?: string;
}
export const SEED_SAVED: SeedSaved[] = [
  { id: 'sv1', kind: 'article', title: 'Building an independent seat', sub: 'Article · General' },
  { id: 'sv2', kind: 'listing', title: 'Antares saddle — 17.5"', sub: 'For Sale · $2,400' },
  { id: 'sv3', kind: 'link', title: 'Course-walk checklist (PDF)', sub: 'Link', url: 'https://example.com' },
  { id: 'sv4', kind: 'article', title: 'Winter turnout and blanketing', sub: 'Article · Horse owners' },
];
```

`SavedPanel` render + empty-state copy (`src/components/app/AccountPanels.tsx:22-67`):

```tsx
// ── Saved items ────────────────────────────────────────────────
const SAVED_ICON: Record<SeedSaved['kind'], typeof Newspaper> = {
  article: Newspaper, listing: Tag, link: LinkIcon,
};

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
  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      <div className="flex flex-col gap-2">
        {items.map((s) => {
          const Icon = SAVED_ICON[s.kind];
          return (
            <div key={s.id} className="flex items-center gap-3 bg-white border border-green-800/10 rounded-xl px-3.5 py-3">
              <span className="w-9 h-9 rounded-lg bg-cream-100 text-green-700 grid place-items-center shrink-0"><Icon size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-green-900 truncate">{s.title}</p>
                {s.sub && <p className="text-[11px] text-muted">{s.sub}</p>}
              </div>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-gold-800 shrink-0" aria-label="Open"><ExternalLink size={15} /></a>
              ) : (
                <ChevronRight size={16} className="text-muted shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

The user-visible copy the owner has never seen, in one list:
- Account row: **"My Saved Items"** / sub **"Articles, listings, and links you kept"** (`AccountHub.tsx:141`)
- Nav label: **"My Saved Items"** (`AppLayout.tsx:446`, `:1154`) — never rendered
- Empty state: **"Nothing saved yet"** / **"Bookmark articles, listings, and links to find them here."**
- The four fake rows: "Building an independent seat · Article · General"; "Antares saddle — 17.5" · For Sale · $2,400"; "Course-walk checklist (PDF) · Link"; "Winter turnout and blanketing · Article · Horse owners"

`my_nav_presence()` prosrc from prod — note `'saved', false` is a literal, not a query:

```sql
DECLARE
  v_orders boolean;
  v_documents boolean;
  v_stable boolean;
  v_posts boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'orders', false, 'documents', false, 'stable', false,
      'posts', false, 'saved', false);
  END IF;

  v_orders := EXISTS (
    SELECT 1 FROM purchases p
    WHERE (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
      AND p.org_id = current_org()
  );

  v_documents := EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1);

  v_stable := EXISTS (SELECT 1 FROM public.my_stable_horses() LIMIT 1);

  v_posts := EXISTS (
    SELECT 1 FROM feed_posts fp WHERE fp.author_id = auth.uid()
  );

  RETURN jsonb_build_object(
    'orders', v_orders,
    'documents', v_documents,
    'stable', v_stable,
    'posts', v_posts,
    'saved', false
  );
END;
```

`PRESENCE_LINKS` (`src/components/app/AppLayout.tsx:437-447`):

```ts
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

---

## 34. seed.ts `FEED_VIEW_META.all.description` tagline (`src/lib/seed.ts:34-43`)
- reported by: TASK-PAGETITLES-REPORT.md [INV batch3.md#46]
- reachability: **verified — the `all` description is dead on the render path; the other seven are LIVE.**
  - `src/pages/app/Home.tsx:63-70`: `view === 'all'` renders a hardcoded `<p>` and the `{meta.description}` branch is the `else`. So `FEED_VIEW_META.all.description` can never print.
  - `FEED_VIEW_META.all.title` ("Community Feed") IS still used — `Home.tsx:53` prints `{meta.title}` as the eyebrow for every view, and `Home.tsx:29` uses it for the document title. `navLabel` for all eight is used by `AppLayout.tsx:455`.
  - The other seven `description` values (social, discussions, for_sale, events, articles, resources, members) DO render, at `Home.tsx:69`.
- exists: yes

The full `FEED_VIEW_META` block, so every tagline is visible (`src/lib/seed.ts:29-43`):

```ts
/** Per-view header copy. The community feed is ONE stream of categorized posts;
 *  each "view" is just that stream filtered to one category. The nav nests these
 *  under "Community Feed" as indented links, and the page header swaps to the
 *  matching title + blurb so each filter reads like its own place. `navLabel` is
 *  what the nested nav link shows (e.g. "All posts" for the combined view). */
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

The Home.tsx copy that replaced the `all` tagline (`src/pages/app/Home.tsx:44-70`):

```tsx
      {/* Title model (owner spec 2026-08-05): small gold eyebrow is the view's
          title; the large dark-green line is an optional per-page intro, only
          shown on the default/all view ("Welcome new members!"), not a repeat
          of the title. Filtered views keep their own eyebrow + description. */}
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{meta.title}</p>
            {view === 'all' ? (
              <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Welcome new members!</h1>
            ) : null}
          </div>
          {hasFeed && createModal && (
            <PageCreateButton label="Post" onClick={() => createModal.openCreate('post_type')} />
          )}
        </div>
        {view === 'all' ? (
          <p className="body-text text-secondary text-sm mt-1.5 max-w-2xl">
            This is a space to share your experiences at the ranch, links you find helpful, events you
            hear about, and ads for tack or gear you no longer use that others may need.
          </p>
        ) : (
          <p className="body-text text-secondary text-sm mt-1.5 max-w-2xl">{meta.description}</p>
        )}
      </header>
```

The seed.ts "marked for deletion" header comment (`src/lib/seed.ts:1-8`) is quoted in full under artifact 33 above; the operative sentence is:

```
 * DELETE THIS FILE once the backing RPCs return real rows.
```

Note for the owner: the file is NOT purely dead — `FEED_VIEWS`, `FEED_VIEW_META` (titles + navLabels + seven descriptions) and the `FeedView` type are load-bearing for the live nav and feed header. Only the seed *data* arrays are gated off.

---

## 35. UIO-006 avatar open-state options (`docs/reference/uio-006-open-state-options.html`)
- reported by: TASK-UIBUILD-LOG.md [INV batch3.md#49]
- reachability: **verified — a docs file, never served and never imported.**
  - It lives in `docs/`, not `public/`. `public/` contains only: `apple-touch-icon.png`, `favicon.svg`, `ffmpeg`, `header-stock.jpg`, `reference-images`. Nothing in `vite.config.ts`, `vercel.json` or `scripts/` copies `docs/reference` into the build.
  - Its only inbound reference is a CSS comment: `src/components/app/app-header.css:304` — `— see docs/reference/uio-006-open-state-options.html. Not resolved in this file; do not read the absence of a change here as an oversight.` No code imports it.
  - The shipped CSS is confirmed unchanged, i.e. the decision is still open (`src/components/app/app-header.css:299-310`):
    ```css
    /* `:active` — a real, releasing press. The OPEN state below is paired with
       it unchanged from UIO-002: UIO-006 found that pairing makes the click
       itself invisible (by the time the menu is open the mark already looks
       pressed, so pressing again to close shows no change) but the fix is a
       design choice the order asks to see rendered rather than have picked here
       — see docs/reference/uio-006-open-state-options.html. Not resolved in this
       file; do not read the absence of a change here as an oversight. */
    button.oh-avatar:active,
    button.oh-avatar[aria-expanded='true'] {
      background: linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 0)),
                  theme('colors.green.800');
    }
    ```
- exists: yes

Page title: **UIO-006 — the "open" state, three options**

Visible heading + framing copy:

```html
<h1>UIO-006, item 1 — the "open" state</h1>
<p class="sub">Not an implementation. Three rendered options for what the avatar looks like
while the mobile nav drawer is open, so it stops looking identical to a press. Nothing here
is shipped — <code>app-header.css</code> still pairs <code>:active</code> and
<code>[aria-expanded='true']</code> at 0% veil, unchanged, until this is picked.</p>

<div class="problem">
  <b>The problem, as shipped today:</b> pressing the avatar to open the drawer and pressing it
  again to close both resolve to the exact same fill (0% veil, pure <code>green-800</code>) —
  by the time the menu is open the mark already looks pressed, so closing it produces no visible
  change at all. <b>Whatever "open" becomes, pressing FROM open still has to look like something
  happened</b> — each option below still flashes to the pure <code>:active</code> colour on the
  physical press before settling into its own open state.
</div>
```

The exact colours each option renders (this is what the page shows visually — a 42px round avatar mark reading "M", on a `#f5f0e8` header strip, with a `rgba(20,51,33,.40)` ring and `#fdfcfa` letter):

```css
  .mark{
    width:42px;height:42px;border-radius:999px;
    display:grid;place-items:center;
    font-family:'Libre Caslon Text',Georgia,serif;font-size:20px;line-height:1;
    border:1px solid rgba(20,51,33,.40);
    color:#fdfcfa;
  }
  .rest        { background:#355040; }               /* 14% white over green-800 */
  .hover       { background:#244131; }                /* 7%  white over green-800 */
  .pressed     { background:#143321; }                /* 0%  — pure brand */

  /* OPTION A — reuse the hover value for "open". Hover never fires on mobile
     (this mark's only fill states are mobile ones), so there is no real
     collision; pressing to close still flashes to 0% then releases to this. */
  .open-a      { background:#244131; }

  /* OPTION B — the fill does not change from REST at all. "Open" is carried
     entirely by a second ring outside the existing one — a different visual
     CHANNEL, not a third point on the same lightness ramp. Pressing still
     flashes to 0% (pure brand, no outer ring) so the press itself is still
     visible against either idle state. */
  .open-b      { background:#355040; box-shadow:0 0 0 3px rgba(186,153,53,.55); }

  /* OPTION C — a gold-tinted veil instead of a white one: 15% gold-600 over
     green-800, a hue shift rather than a lightness step. Distinct from the
     white-veil ramp by KIND, mirroring the outline-vs-fill question in
     UIO-011 — "open" reads as a different sort of state, not a stop on the
     same dial as hover/press. */
  .open-c      { background:#2d4224; }
```

Section 1 — "The existing ramp, for reference" (shipped, unchanged): rest · 14% (`#355040`, 8.68:1) → hover · 7% (`#244131`, 10.92:1) → pressed · 0% (`#143321`, 13.43:1).

The three option labels and their descriptive copy, verbatim:

```html
<section>
  <h2>Option A — open reuses the hover value</h2>
  <div class="why">Open settles at the same 7% veil hover already uses. Since hover never fires
    on a touch device, there's no real collision in practice: rest (14%) → press flashes to
    0% → open settles at 7%, a value already in the vocabulary rather than a new one.
    Simplest option — no new mechanism, just a third stop on the existing dial.</div>
  <!-- renders: rest, closed  → press → :active (flash) → settles → open   (10.92 : 1) -->
</section>

<section>
  <h2>Option B — open is a ring, not a fill change</h2>
  <div class="why">Fill stays at REST's 14% — it never moves to signal "open." A second ring
    (gold, outside the existing green ring) carries the open signal instead, on a different
    visual channel entirely. The press still flashes to 0% (no ring), so the click reads even
    though the settled "open" fill is identical to "closed."</div>
  <!-- renders: rest, closed  → press → :active (flash) → settles → open   (8.68 : 1 (fill unchanged)) -->
</section>

<section>
  <h2>Option C — open is gold-tinted, not just darker</h2>
  <div class="why">A hue shift instead of a lightness step: 15% gold-600 blended into
    green-800 rather than white. Reads as a different KIND of state rather than a third point
    on the white-veil ramp — the same distinction UIO-011 raises for hover-as-outline-vs-fill.
    Costs the "always exact brand green" property UIO-002 was built to protect, only in this
    one state.</div>
  <!-- renders: rest, closed  → press → :active (flash) → settles → open   (10.69 : 1) -->
</section>
```

Final section is a "Side by side" row labelled **A — reuse hover**, **B — ring only**, **C — gold-tinted**.

---

## 36. UIO-011 hover-and-green evaluation (`docs/reference/uio-011-hover-and-green-evaluation.html`)
- reported by: TASK-UIBUILD-LOG.md [INV batch3.md#50]
- reachability: **verified — docs file, never served, and with zero inbound references of any kind.**
  - Not in `public/`; no build step copies `docs/reference`.
  - `grep -rn "uio-011" src/ public/ scripts/` → **no hits at all** (unlike UIO-006, which at least has the app-header.css pointer). Nothing in `src/` references it.
- exists: yes

Page title: **UIO-011 — outline hover, and one green**

Framing copy, including the sentence that forbids the builder deciding (the `.banner` block):

```html
<h1>UIO-011 — outline hover, and one green</h1>
<p class="sub">Evaluation only. Nothing here is shipped and nothing in <code>src/</code> changed
for this. Two questions the owner asked to see rendered rather than decide on paper.</p>
<div class="banner">
  <strong>Not a recommendation.</strong> This page shows the options as asked — it does not
  argue for one over another beyond what UIO-011 itself already states (the orchestrator's own
  note, reproduced faithfully: try the harmonized green on large content text first, not
  everywhere, because the logo is a brand mark and the nav-selected green is a rendered
  composite tuned for a surface, not ink).
</div>
```

Question A — outline hover instead of fill (includes the owner's own quoted words):

```html
<section>
  <h2>Question A — outline hover instead of fill</h2>
  <p class="why quote">"im curious if we should change the hover state to an outline instead of
  a fill, it looks weird with two buttons filled even with the difference in intensity."</p>
  <p class="why">Today, hover (<code>bg-navfill/64</code>) and selected (<code>bg-navfill/80</code>)
  are the same KIND of thing at two strengths — two filled rows next to each other compete, and
  64 vs 80 is a narrow gap to carry the whole distinction. An outline hover separates "you're
  pointing at this" from "you're on this" by kind rather than by intensity. Cursor is shown on
  the row below the selected one in both mocks.</p>

  <div class="nav-pair">
    <div class="nav-mock">
      <div class="caption">today — fill hover</div>
      <div class="row selected"><span class="dot"></span>Community Feed</div>
      <div class="row hover-fill"><span class="dot"></span>Dashboard</div>
      <div class="row plain"><span class="dot"></span>Calendar</div>
      <div class="row plain"><span class="dot"></span>Catalog</div>
      <div class="row plain"><span class="dot"></span>Messages</div>
      <div class="cursor-tag">cursor on Dashboard</div>
    </div>
    <div class="nav-mock">
      <div class="caption">proposed — outline hover</div>
      <div class="row selected"><span class="dot"></span>Community Feed</div>
      <div class="row hover-outline"><span class="dot"></span>Dashboard</div>
      <div class="row plain"><span class="dot"></span>Calendar</div>
      <div class="row plain"><span class="dot"></span>Catalog</div>
      <div class="row plain"><span class="dot"></span>Messages</div>
      <div class="cursor-tag">cursor on Dashboard</div>
    </div>
  </div>
</section>
```

The two nav-row treatments it compares:

```css
  .row.selected{background:#31523f;color:#fdfcfa;font-weight:500}
  .row.hover-fill{background:#617a6b;color:#fdfcfa}
  .row.hover-outline{background:transparent;border:1.5px solid rgba(20,51,33,.45);color:#143321}
```

Question B — one green everywhere, or only large content text:

```html
<section>
  <h2>Question B — one green everywhere, or only large content text</h2>
  <p class="why quote">"the intensity of the selected state for the desktop nav buttons differs
  from the avatar button clicked state, and the overall intensity of the page names and company
  name and logo letters and avatar letter. It might look nice to have them all match... should
  we try it for everything or maybe just try it for large green text in the content area?"</p>
  <p class="why">Three columns, same mock page each time. The badge (UIO-010's still-open
  aesthetic complaint) rides along in every column, since this is the pass where the gold, its
  size, shape and position are actually in scope.</p>
```

The three columns, each a mock header ("FH" mark · "French Heritage Equestrian" · avatar "M" with a gold badge "3") over a mock Dashboard page (eyebrow "Dashboard", heading "Good Morning, Mary", card "horse documents / Complete your horse documents"):

```html
    <div class="col">
      <div class="col-label">1 — today, brand green everywhere</div>
      ... mark/company/avatar all color:#0d2118 ; h3 + card title color:#143321 ...
        <p>Large green display text, page names and card titles, all at brand
        <code>green-800 #143321</code>.</p>
    </div>

    <div class="col">
      <div class="col-label">2 — large content text only in #31523f</div>
      ... mark/company/avatar stay #0d2118 ; h3 + card title color:#31523f ...
        <p>Only the large display text (page heading, card titles) moves to
        <code>#31523f</code> — the nav-selected composite. Logo mark, company name and avatar
        letter stay brand green, unchanged from column 1.</p>
    </div>

    <div class="col">
      <div class="col-label">3 — everything in #31523f</div>
      ... mark/company/avatar AND h3 + card title all color:#31523f ...
        <p>Everything moves — page names, company name, the logo mark's letters and the
        avatar's letter all take <code>#31523f</code>, including the header/logo, which is a
        brand-identity decision as much as a harmonisation.</p>
    </div>
```

Contrast table it closes on:

```html
  <table>
    <tr><th>ink</th><th>on page #faf8f4</th><th>on nav #fdfcfa</th><th>on header #f5f0e8</th></tr>
    <tr>
      <td><span class="swatch" style="background:#143321"></span>green-800 — today</td>
      <td>12.98</td><td>13.43</td><td>12.14</td>
    </tr>
    <tr>
      <td><span class="swatch" style="background:#31523f"></span>nav-selected #31523f — proposed</td>
      <td>8.22</td><td>8.50</td><td>7.68</td>
    </tr>
  </table>
```

---

## 37. ARENA_SOLO — dead option in HORSE_LEASE_V2 (`contract_field_defs`, `TXN.PERMITTED_ACTIVITIES`)
- reported by: TASK-LEASEMAP-REPORT.md [INV batch3.md#51]
- reachability: **verified — `ARENA_SOLO` gates nothing, anywhere, in any template.**
  - Prod: `SELECT ... FROM contract_clause_defs WHERE conditional_on::text ILIKE '%ARENA_SOLO%' UNION ALL SELECT ... FROM contract_field_defs WHERE conditional_on::text ILIKE '%ARENA_SOLO%';` → **0 rows** (all templates, not just V2).
  - The only DB occurrences are inside `contract_field_defs.options` for `TXN.PERMITTED_ACTIVITIES` on 4 templates: `HORSE_LEASE_V2`, `HORSE_LEASE_STANDARD`, `HORSE_LEASE_FULL`, `HORSE_LEASE_SIMPLE`.
  - `grep -rn "ARENA_SOLO" src/ api/` → **0 hits**. Only migration files mention it (`20260720250000`, `20260723320000`, `20260801030000`, `20260804020000`). `20260801030000_clause_gate_batch.sql:50` even acknowledges it: *"these two (250/255) did not, so a lease permitting only ARENA_SOLO…"*.
  - So selecting "Solo Arena Riding" changes only the printed activity list — no clause is added or removed by it. It is the ONLY one of the seven options with no gate.
- exists: yes

The full option list (prod, `contract_field_defs` where `template_key='HORSE_LEASE_V2'` and `field_key='TXN.PERMITTED_ACTIVITIES'`; label "Permitted activities", `input_kind=buttons`, section `PERMITTED_USE`, clause `PERMITTED_USE.MAIN`):

```json
[
    { "label": "Riding Lessons",      "value": "LESSONS" },
    { "label": "Solo Arena Riding",   "value": "ARENA_SOLO" },
    { "label": "Group Arena Riding",  "value": "ARENA_GROUP" },
    { "label": "Training",            "value": "TRAINING" },
    { "label": "Competitions",        "value": "COMPETITIONS" },
    { "label": "Jumping",             "value": "JUMPING" },
    { "label": "Trail Riding",        "value": "TRAIL" }
]
```

What each option actually gates in HORSE_LEASE_V2 (every `conditional_on` in the template that names `TXN.PERMITTED_ACTIVITIES`):

```
LESSONS       -> PERMITTED_USE.TRAINER (with JUMPING, COMPETITIONS)
                 TRAINING_LESSONS.PENDING        (+ LESSEE.PARTY_TYPE = '')
                 TRAINING_LESSONS.LESSONS        (+ LESSEE.PARTY_TYPE = INDIVIDUAL)
                 TRAINING_LESSONS.LESSONS_ENTITY (+ LESSEE.PARTY_TYPE = ENTITY)
ARENA_SOLO    -> (nothing)
ARENA_GROUP   -> INSURANCE_RISK.SHARED_ARENA_RISKS
TRAINING      -> TRAINING_LESSONS.TRAINING
COMPETITIONS  -> INSURANCE_RISK.COMPETITION_RISKS
                 PERMITTED_USE.TRAINER
                 COMPETITIONS.INTRO
                 RESTRICT.COMP_TITLE
                 RESTRICT.COMP_ON   (+ TXN.COMP_OMIT = YES)
                 RESTRICT.COMP_OFF  (+ TXN.COMP_OMIT in (NO,''))
JUMPING       -> INSURANCE_RISK.JUMPING_RISKS
                 PERMITTED_USE.TRAINER
                 RESTRICT.JUMP_TITLE
                 RESTRICT.JUMP_ON   (+ TXN.JUMP_OMIT = YES)
                 RESTRICT.JUMP_OFF  (+ TXN.JUMP_OMIT in (NO,''))
TRAIL         -> INSURANCE_RISK.TRAIL_RIDING
                 RESTRICT.TRAIL_TITLE
                 RESTRICT.TRAIL_ON  (+ TXN.TRAIL_OMIT = YES)
                 RESTRICT.TRAIL_OFF (+ TXN.TRAIL_OMIT in (NO,''))
```

Raw prod output for the same query, so the shape of each rule is visible:

```
clause: INSURANCE_RISK.TRAIL_RIDING      | {"contains": ["TRAIL"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: INSURANCE_RISK.JUMPING_RISKS     | {"contains": ["JUMPING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: INSURANCE_RISK.COMPETITION_RISKS | {"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: INSURANCE_RISK.SHARED_ARENA_RISKS| {"contains": ["ARENA_GROUP"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: PERMITTED_USE.TRAINER            | {"contains": ["LESSONS", "JUMPING", "COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: TRAINING_LESSONS.PENDING         | {"all": [{"equals": [""], "field_key": "LESSEE.PARTY_TYPE"}, {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}
clause: TRAINING_LESSONS.LESSONS         | {"all": [{"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}, {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}
clause: TRAINING_LESSONS.LESSONS_ENTITY  | {"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}, {"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}
clause: TRAINING_LESSONS.TRAINING        | {"contains": ["TRAINING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: COMPETITIONS.INTRO               | {"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: RESTRICT.COMP_TITLE              | {"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: RESTRICT.COMP_ON                 | {"all": [{"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}, {"equals": ["YES"], "field_key": "TXN.COMP_OMIT"}]}
clause: RESTRICT.COMP_OFF                | {"all": [{"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}, {"equals": ["NO", ""], "field_key": "TXN.COMP_OMIT"}]}
clause: RESTRICT.JUMP_TITLE              | {"contains": ["JUMPING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: RESTRICT.JUMP_ON                 | {"all": [{"contains": ["JUMPING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}, {"equals": ["YES"], "field_key": "TXN.JUMP_OMIT"}]}
clause: RESTRICT.JUMP_OFF                | {"all": [{"contains": ["JUMPING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}, {"equals": ["NO", ""], "field_key": "TXN.JUMP_OMIT"}]}
clause: RESTRICT.TRAIL_TITLE             | {"contains": ["TRAIL"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
clause: RESTRICT.TRAIL_ON                | {"all": [{"contains": ["TRAIL"], "field_key": "TXN.PERMITTED_ACTIVITIES"}, {"equals": ["YES"], "field_key": "TXN.TRAIL_OMIT"}]}
clause: RESTRICT.TRAIL_OFF               | {"all": [{"contains": ["TRAIL"], "field_key": "TXN.PERMITTED_ACTIVITIES"}, {"equals": ["NO", ""], "field_key": "TXN.TRAIL_OMIT"}]}
```

---

## 38. `contract_split_deductible_sync` — mostly-dead trigger function (prod `pg_proc`)
- reported by: TASK-LEASEMAP-REPORT.md [INV batch3.md#52, #54]
- reachability: **verified — the trigger IS attached and CAN fire, but most of its branches are unreachable for HORSE_LEASE_V2.**
  - Attached in prod:
    ```sql
    CREATE TRIGGER contract_fields_split_sync
      AFTER UPDATE OF value ON public.contract_fields
      FOR EACH ROW
      WHEN (((new.field_key ~~ 'TXN.MORT%') OR (new.field_key ~~ 'TXN.MED%') OR (new.field_key ~~ 'TXN.GL%')))
      EXECUTE FUNCTION contract_split_deductible_sync()
    ```
  - Field-existence check against `contract_field_defs` for `template_key='HORSE_LEASE_V2'`:
    ```
          field_key      | exists_in_v2
    ---------------------+--------------
     TXN.MORT_ELECTED    | f
     TXN.MED_COVERAGE    | f
     TXN.MORT_LIMIT      | f
     TXN.MORT_DEDUCTIBLE | f
     TXN.MED_DEDUCTIBLE  | f
    ```
    All five **do not exist** in HORSE_LEASE_V2. (The live field is `TXN.MORT_ELECTION` with values NOT_CARRIED / CARRIES / WILL_OBTAIN — a different key from `TXN.MORT_ELECTED`; and `TXN.MED_INCLUDED` (yes/no) rather than `TXN.MED_COVERAGE`.)
  - Suffix families present in HORSE_LEASE_V2:
    ```
    TXN.MED_COST_RESP
    TXN.MED_DED_RESP
    TXN.MORT_COST_RESP
    TXN.MORT_DED_RESP
    ```
    i.e. **`_RESP` fields DO exist (4 of them)**, but **no `_RESP_MODE`, no `_RESP_OTHER`, and no `_RESP_SPLIT_LESSOR` / `_RESP_SPLIT_LESSEE` field exists** in this template. So of the seven fields flagged, 5 (`TXN.MORT_ELECTED`, `TXN.MED_COVERAGE`, `TXN.MORT_LIMIT`, `TXN.MORT_DEDUCTIBLE`, `TXN.MED_DEDUCTIBLE`) and 2 suffix families (`<base>_RESP_MODE`, `<base>_RESP_OTHER`) are absent — confirming all seven.
  - Consequence, branch by branch, for a HORSE_LEASE_V2 document: the MORT_ELECTED branch, MED_COVERAGE branch, MORT_LIMIT branch, deductible-recompute branch, `_RESP_MODE$` branch and the whole `_RESP_SPLIT_(LESSOR|LESSEE)$` tail are all unreachable. **The one reachable branch is `NEW.field_key ~ '_RESP$'`**, which fires on the four live `_RESP` fields.
  - Inside that one live branch, the `OTHER` sub-branch clears `NEW.field_key || '_OTHER'` — e.g. `TXN.MORT_DED_RESP_OTHER` — which does not exist in HORSE_LEASE_V2, so it is a dead UPDATE (matches 0 rows). Note the live `_RESP` fields DO offer an `Other` option in their `options` JSON, so a user can pick it; the clear-up it triggers just has nothing to clear.
  - The `SPLIT` sub-branch in the same live branch clears `_MODE` / `_SPLIT_LESSOR` / `_SPLIT_LESSEE` — also non-existent here. The template instead uses `TXN.*_LESSEE_SHARE` fields (`input_kind = share_amount`), which this function never touches.
- exists: yes (function present in prod, trigger attached)

Full prosrc from prod:

```sql
DECLARE
  v_base text;
  v_counterpart text;
  v_mode text;
  v_anchor_key text;
  v_anchor text;
  v_n numeric;
  v_d numeric;
  v_fmv numeric;
  v_self text;
  v_other text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- coverage toggles: clear the block's dependent fields when switched off
  IF NEW.field_key = 'TXN.MORT_ELECTED' AND coalesce(NEW.value,'') <> 'YES'
     AND NEW.value IS DISTINCT FROM OLD.value THEN
    UPDATE contract_fields SET value=''
     WHERE document_id=NEW.document_id AND field_key LIKE 'TXN.MORT\_%'
       AND field_key <> 'TXN.MORT_ELECTED' AND coalesce(value,'') <> '';
    RETURN NEW;
  END IF;
  IF NEW.field_key = 'TXN.MED_COVERAGE' AND coalesce(NEW.value,'') <> 'COVERED'
     AND NEW.value IS DISTINCT FROM OLD.value THEN
    UPDATE contract_fields SET value=''
     WHERE document_id=NEW.document_id AND field_key LIKE 'TXN.MED\_%'
       AND field_key <> 'TXN.MED_COVERAGE' AND coalesce(value,'') <> '';
    RETURN NEW;
  END IF;

  -- mortality limit: must be >= the horse's fair market value
  IF NEW.field_key = 'TXN.MORT_LIMIT' AND coalesce(NEW.value,'') <> '' THEN
    BEGIN
      v_n := nullif(regexp_replace(NEW.value, '[^0-9.]', '', 'g'), '')::numeric;
      SELECT nullif(regexp_replace(coalesce(value,''), '[^0-9.]', '', 'g'), '')::numeric
        INTO v_fmv FROM contract_fields
       WHERE document_id=NEW.document_id AND field_key='HORSE.FAIR_MARKET_VALUE';
    EXCEPTION WHEN others THEN
      v_n := NULL; v_fmv := NULL;
    END;
    IF v_n IS NOT NULL AND v_fmv IS NOT NULL AND v_n < v_fmv THEN
      RAISE EXCEPTION 'Mortality policy limit (%) must be at least the Horse''s fair market value (%)',
        NEW.value, to_char(v_fmv, 'FM$999,999,990.00');
    END IF;
    RETURN NEW;
  END IF;

  -- stated deductible changed: recompute an active $-split against the new amount
  IF NEW.field_key IN ('TXN.MORT_DEDUCTIBLE','TXN.MED_DEDUCTIBLE')
     AND NEW.value IS DISTINCT FROM OLD.value THEN
    v_base := replace(NEW.field_key, '_DEDUCTIBLE', '') || '_DED_RESP';
    SELECT value INTO v_mode FROM contract_fields
     WHERE document_id=NEW.document_id AND field_key = v_base || '_MODE';
    IF v_mode = 'DOLLAR' THEN
      UPDATE contract_fields SET value=''
       WHERE document_id=NEW.document_id
         AND field_key IN (v_base || '_SPLIT_LESSOR', v_base || '_SPLIT_LESSEE')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- responsibility selection changed: clear children that no longer apply
  IF NEW.field_key ~ '_RESP$' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      IF coalesce(NEW.value,'') <> 'SPLIT' THEN
        UPDATE contract_fields SET value=''
         WHERE document_id=NEW.document_id
           AND field_key IN (NEW.field_key || '_MODE', NEW.field_key || '_SPLIT_LESSOR', NEW.field_key || '_SPLIT_LESSEE')
           AND coalesce(value,'') <> '';
      END IF;
      IF coalesce(NEW.value,'') <> 'OTHER' THEN
        UPDATE contract_fields SET value=''
         WHERE document_id=NEW.document_id
           AND field_key = NEW.field_key || '_OTHER' AND coalesce(value,'') <> '';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- mode change: clear both shares for fresh entry
  IF NEW.field_key ~ '_RESP_MODE$' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      v_base := regexp_replace(NEW.field_key, '_MODE$', '');
      UPDATE contract_fields SET value=''
       WHERE document_id=NEW.document_id
         AND field_key IN (v_base || '_SPLIT_LESSOR', v_base || '_SPLIT_LESSEE')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- share entry: normalize + auto-fill counterpart. $-anchored groups
  -- (mortality/medical deductible) resolve mode from _RESP_MODE; all other
  -- groups are %-only.
  IF NEW.field_key !~ '_RESP_SPLIT_(LESSOR|LESSEE)$' THEN RETURN NEW; END IF;
  IF coalesce(NEW.value,'') = '' OR NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;
  v_base := regexp_replace(NEW.field_key, '_SPLIT_(LESSOR|LESSEE)$', '');
  v_counterpart := CASE WHEN NEW.field_key LIKE '%_LESSOR'
                        THEN v_base || '_SPLIT_LESSEE' ELSE v_base || '_SPLIT_LESSOR' END;

  v_anchor_key := CASE v_base
                    WHEN 'TXN.MORT_DED_RESP' THEN 'TXN.MORT_DEDUCTIBLE'
                    WHEN 'TXN.MED_DED_RESP'  THEN 'TXN.MED_DEDUCTIBLE'
                    ELSE NULL END;
  IF v_anchor_key IS NOT NULL THEN
    SELECT value INTO v_mode FROM contract_fields
     WHERE document_id=NEW.document_id AND field_key = v_base || '_MODE';
  ELSE
    v_mode := 'PERCENT';
  END IF;

  BEGIN
    v_n := nullif(regexp_replace(NEW.value, '[^0-9.]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    v_n := NULL;
  END;
  IF v_n IS NULL THEN RETURN NEW; END IF;

  IF v_mode = 'PERCENT' THEN
    IF v_n < 0 OR v_n > 100 THEN
      RAISE EXCEPTION 'A percentage share must be between 0 and 100 (got %)', NEW.value;
    END IF;
    v_self  := to_char(v_n, 'FM990.##') || '%';
    v_other := to_char(100 - v_n, 'FM990.##') || '%';
  ELSIF v_mode = 'DOLLAR' THEN
    SELECT value INTO v_anchor FROM contract_fields
     WHERE document_id=NEW.document_id AND field_key = v_anchor_key;
    BEGIN
      v_d := nullif(regexp_replace(coalesce(v_anchor,''), '[^0-9.]', '', 'g'), '')::numeric;
    EXCEPTION WHEN others THEN
      v_d := NULL;
    END;
    IF v_d IS NULL THEN RETURN NEW; END IF;
    IF v_n > v_d THEN
      RAISE EXCEPTION 'A $ share (%) cannot exceed the stated deductible (%)',
        NEW.value, to_char(v_d, 'FM$999,999,990.00');
    END IF;
    v_self  := to_char(v_n, 'FM$999,999,990.00');
    v_other := to_char(v_d - v_n, 'FM$999,999,990.00');
  ELSE
    RETURN NEW; -- no mode chosen yet
  END IF;

  IF v_self IS DISTINCT FROM NEW.value THEN
    UPDATE contract_fields SET value = v_self
     WHERE document_id=NEW.document_id AND field_key = NEW.field_key;
  END IF;
  UPDATE contract_fields SET value = v_other
   WHERE document_id=NEW.document_id AND field_key = v_counterpart
     AND value IS DISTINCT FROM v_other;
  RETURN NEW;
END;
```

For contrast, here is what the insurance block in HORSE_LEASE_V2 ACTUALLY contains (all 15 `TXN.MORT*` / `TXN.MED*` / `TXN.GL*` field defs), so the owner can see the mismatch:

```
 TXN.GL_LESSEE_STATUS       | Lessee                                               | select       | [{"label":"Agrees","value":"AGREES"},{"when":{"equals":["NEITHER"],"field_key":"TXN.GL_LESSOR_REQUIRES"},"label":"Does not carry general liability insurance","value":"ACCEPTS_PERSONALLY"},{"label":"Other","value":"OTHER"}]
 TXN.GL_LESSOR_COVERAGE     | Lessor                                               | select       | [{"label":"Has and will maintain general liability insurance","value":"HAS"},{"label":"Will obtain and will maintain general liability insurance","value":"WILL_OBTAIN"},{"label":"Does not carry general liability insurance","value":"NONE"}]
 TXN.GL_LESSOR_REQUIRES     | Lessor requires of Lessee                            | select       | [{"label":"Requires Lessee to maintain general liability insurance","value":"GL_ONLY"},{"label":"Does not require general liability insurance of Lessee","value":"NEITHER"}]
 TXN.GL_NO_REQ_ALLOCATION   | Third-party liability costs                          | select       | [{"label":"Lessor assumes all risk and cost","value":"LESSOR_ALL"},{"label":"Each party bears its own at-fault costs","value":"LESSEE_AT_FAULT"}]
 TXN.MED_COST_LESSEE_SHARE  | Lessee's share of the cost                           | share_amount |
 TXN.MED_COST_RESP          | Cost of the medical component                        | select       | [{"label":"paid by Lessor","value":"LESSOR"},{"label":"split between Lessor and Lessee","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
 TXN.MED_DED_LESSEE_SHARE   | Lessee's share of the deductible                     | share_amount |
 TXN.MED_DED_RESP           | Medical deductible responsibility                    | select       | [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
 TXN.MED_INCLUDED           | Medical coverage is included on the mortality policy | yesno        |
 TXN.MEDICATIONS            | Medications and supplements                          | med_schedule |
 TXN.MORT_COST_LESSEE_SHARE | Lessee's share of the cost                           | share_amount |
 TXN.MORT_COST_RESP         | Cost of the policy                                   | select       | [{"label":"paid by Lessor","value":"LESSOR"},{"label":"split between Lessor and Lessee","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
 TXN.MORT_DED_LESSEE_SHARE  | Lessee's share of the deductible                     | share_amount |
 TXN.MORT_DED_RESP          | Mortality deductible responsibility                  | select       | [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
 TXN.MORT_ELECTION          | Mortality insurance                                  | select       | [{"label":"Lessor does not carry a mortality insurance policy for the Horse","value":"NOT_CARRIED"},{"label":"Lessor carries a mortality insurance policy for the Horse","value":"CARRIES"},{"label":"Lessor will obtain a mortality insurance policy for the Horse for the duration of this Agreement","value":"WILL_OBTAIN"}]
```

---

## 39. `clause_cut_kept` — inert on HORSE_LEASE_V2 (prod `pg_proc`)
- reported by: TASK-LEASEMAP-REPORT.md [INV batch3.md#53]
- reachability: **verified — inert on EVERY template, not just HORSE_LEASE_V2.**
  - It is genuinely called: `remerge_contract_from_clauses` and `contract_section_tree` both call it. But both call it only behind a null-guard, from `contract_section_tree`'s prosrc:
    ```
    35:    IF v_sec.cut_name IS NOT NULL AND NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN
    36:      CONTINUE;                                  -- cut: consumes no number
    49:      IF v_cl.cut_name IS NOT NULL AND NOT clause_cut_kept(v_cl.cut_name, v_fields) THEN
    ```
  - `cut_name` census for HORSE_LEASE_V2 — **NULL on every row**:
    ```
       src   | cut_name | count
    ---------+----------+-------
     section |          |    22
     clause  |          |   163
    ```
  - Across ALL templates: `SELECT template_key, cut_name, count(*) FROM contract_clause_defs WHERE cut_name IS NOT NULL GROUP BY 1,2;` → **0 rows**. So the guard never passes and the function is never invoked anywhere in prod.
  - The three insurance fields it tests do not exist in HORSE_LEASE_V2:
    ```
                     k                 | in_v2 | in_any_template
    -----------------------------------+-------+-----------------
     TXN.MORTALITY_INSURANCE_PARTY     | f     | t
     TXN.MAJOR_MEDICAL_INSURANCE_PARTY | f     | t
     TXN.LOSS_OF_USE_INSURANCE_PARTY   | f     | t
    ```
    All three exist only on `HORSE_LEASE` — the retired pre-clause original (D10: "never activated, never used to generate a document"). Two more of its tested fields are also V2-absent: `TXN.EVALUATION_START` (f), `TXN.EVALUATION_END` (f), `TXN.COMPETITION_TERMS` (f). Only `TXN.LEASE_TYPE` (t) and `TXN.COMPETITION_EXPENSES` (t) exist in V2.
- exists: yes

Full definition from prod:

```sql
CREATE OR REPLACE FUNCTION public.clause_cut_kept(p_cut text, v_fields jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_cut
    WHEN 'EVALUATION_PERIOD' THEN
      coalesce(v_fields->>'TXN.EVALUATION_START','') <> '' OR coalesce(v_fields->>'TXN.EVALUATION_END','') <> ''
    WHEN 'PARTIAL_LEASE' THEN
      lower(coalesce(v_fields->>'TXN.LEASE_TYPE','')) LIKE '%partial%'
    WHEN 'INSURANCE' THEN
      coalesce(v_fields->>'TXN.MORTALITY_INSURANCE_PARTY','') <> ''
      OR coalesce(v_fields->>'TXN.MAJOR_MEDICAL_INSURANCE_PARTY','') <> ''
      OR coalesce(v_fields->>'TXN.LOSS_OF_USE_INSURANCE_PARTY','') <> ''
    WHEN 'COMPETITION' THEN
      coalesce(v_fields->>'TXN.COMPETITION_TERMS','') <> ''
      OR coalesce(v_fields->>'TXN.COMPETITION_EXPENSES','') <> ''
    ELSE true
  END;
$function$
```

The four "cut" vocabulary words the owner would be choosing between if `cut_name` were ever populated: `EVALUATION_PERIOD`, `PARTIAL_LEASE`, `INSURANCE`, `COMPETITION` — plus an implicit `ELSE true` (an unknown cut name keeps the clause).

---

## 40. `SendCopiesMenu` (`src/components/app/SendCopiesMenu.tsx`, `src/pages/app/ContractPage.tsx`)
- reported by: TASK-A8B-REPORT.md [INV batch4.md#55]
- reachability: **LIVE and reachable — reporting honestly, this one is NOT dead.** The "unpushed at time of report" state has resolved: it is committed at `edf0c0d TASK A8B: executed-copy send/resend UI + recipient-targeted delivery`, and `git status --porcelain` is clean for both files.
  - Two ordinary conditions, not a kill flag: `src/pages/app/ContractPage.tsx:1614` `{isExecuted && (...)}` (where `isExecuted` is `state === 'executed'`, `ContractPage.tsx:600`) and `:1619` `{isStaff && id && (...)}`. A staff user opening any executed contract sees it.
  - Both backends exist: `api/deliver-documents.ts` is present, and `resend_executed_document_email(uuid)` is in prod `pg_proc` (granted to `authenticated, service_role`, migration `20260804050000_execution_email_state_machine.sql:87`).
  - Caveat worth flagging: options 2 and 3 are *conditionally* hidden — `lessorParties`/`lesseeParties` filter on `p.email && p.contact_id`, so on a document whose parties have no email on file the owner would see only 2 of the 4 options. That is the only sense in which any part of it is unseen.
- exists: yes

Component header comment — the clearest statement of what the four options do:

```tsx
/**
 * A8B — staff "Send copies" menu on an EXECUTED document.
 *
 * Four targeted options, each hitting a different delivery path:
 *  1. Send to me       -> /api/deliver-documents { recipientContactIds: [myContactId] }
 *  2. Send to <Lessor>  -> same endpoint, targeted at the horse-owning side's party ids
 *  3. Send to <Lessee>  -> same endpoint, targeted at the other side's party ids
 *  4. Send to all parties -> resend_executed_document_email(doc_id) RPC — the
 *     OFFICIAL all-parties resend, which re-stamps executed_email_sent_at.
 *     Options 1-3 are targeted sends and deliberately do NOT touch that stamp
 *     (see api/deliver-documents.ts).
 *
 * Role labels come from the document's own parties, never person names.
 * Options 2/3 hide when that side has no party with an email on file.
 */
```

Render + all four option labels + every confirmation/error string (`SendCopiesMenu.tsx:94-177`):

```tsx
  const sendToMe = () => run(async () => {
    const myId = await myContactId();
    if (!myId) throw new Error('Your account has no linked contact record.');
    const delivered = await deliverTargeted(documentId, [myId]);
    return delivered.length > 0 ? `Sent to ${delivered[0].email}.` : 'Already sent to you.';
  });

  const sendToSide = (sideParties: PartySummary[], label: string) => run(async () => {
    const ids = sideParties.map((p) => p.contact_id).filter((cid): cid is string => !!cid);
    if (ids.length === 0) throw new Error(`No ${label.toLowerCase()} party has an email on file.`);
    const delivered = await deliverTargeted(documentId, ids);
    return delivered.length > 0
      ? `Sent to ${label} (${delivered.length} recipient${delivered.length === 1 ? '' : 's'}).`
      : `Already sent to ${label}.`;
  });

  const sendToAll = () => run(async () => {
    const { data, error } = await supabase.rpc('resend_executed_document_email', {
      p_document_id: documentId,
    });
    if (error) throw error;
    const outcome = data as { sent?: boolean; reason?: string } | null;
    if (outcome && outcome.sent === false) throw new Error(outcome.reason ?? 'Could not send.');
    return 'Sent to all parties.';
  });

  const buttonLabel = sentAt ? 'Resend copies' : 'Send copies';

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-secondary hover:bg-green-800/5 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="send-copies-menu-btn"
      >
        <Send size={14} aria-hidden="true" />
        {pending ? 'Sending…' : buttonLabel}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-1 min-w-[14rem] rounded-lg border border-green-800/15 bg-white shadow-lg py-1"
        >
          <button type="button" role="menuitem"
            className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
            onClick={sendToMe}>
            Send to me
          </button>
          {lessorParties.length > 0 && lessorLabel && (
            <button type="button" role="menuitem"
              className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
              onClick={() => sendToSide(lessorParties, lessorLabel)}>
              Send to {lessorLabel}
            </button>
          )}
          {lesseeParties.length > 0 && lesseeLabel && (
            <button type="button" role="menuitem"
              className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
              onClick={() => sendToSide(lesseeParties, lesseeLabel)}>
              Send to {lesseeLabel}
            </button>
          )}
          <button type="button" role="menuitem"
            className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
            onClick={sendToAll}>
            Send to all parties
          </button>
        </div>
      )}

      {result && (
        <p role={result.tone === 'error' ? 'alert' : 'status'}
          className={`mt-1 text-xs ${result.tone === 'error' ? 'text-red-700' : 'text-green-700'}`}>
          {result.tone === 'error' ? `Could not send: ${result.text}` : result.text}
        </p>
      )}
    </div>
  );
```

Role-label mapping — the menu says "Send to Lessor" / "Seller" / "Lessee" / "Buyer" depending on the document (`SendCopiesMenu.tsx:23-32`):

```tsx
const LESSOR_SIDE = ['LESSOR', 'SELLER'];
const LESSEE_SIDE = ['LESSEE', 'BUYER'];

function roleLabel(role: string): string {
  if (role === 'LESSOR') return 'Lessor';
  if (role === 'SELLER') return 'Seller';
  if (role === 'LESSEE') return 'Lessee';
  if (role === 'BUYER') return 'Buyer';
  return role.charAt(0) + role.slice(1).toLowerCase();
}
```

The ContractPage call site (`src/pages/app/ContractPage.tsx:1610-1628`):

```tsx
      {/* TERMINATE — executed contracts only. This survived the removal of the
          notify card, which shared its wrapper: terminating an executed contract
          is unrelated to notifying parties about a draft, and losing it with the
          card would have removed the only mutual-termination path. */}
      {isExecuted && (
        <div className="bg-white border border-green-800/10 rounded-xl p-5 sm:p-6 mb-5">
          <div className="p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Manage</p>
            {/* A8B: staff-only targeted/all-parties re-send of the executed copy. */}
            {isStaff && id && (
              <div className="mb-4">
                <SendCopiesMenu
                  documentId={id}
                  parties={partiesSummary?.parties ?? []}
                  sentAt={doc?.executed_email_sent_at}
                  onSent={() => { void load({ blank: false }); }}
                />
              </div>
            )}
```

---

## 41. `TwoFactorSettings` (`src/components/auth/TwoFactorSettings.tsx`, rendered at `src/pages/Account.tsx:188`)
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#57]
- reachability: **verified unreachable for any member or staff account.**
  - Its ONLY render site is `src/pages/Account.tsx:188` (`grep -rn "TwoFactorSettings" src/` returns exactly two hits: the import at `Account.tsx:7` and the render at `:188`).
  - `Account.tsx` is the legacy public-site `/account` page (`src/App.tsx:191`). It bails out before rendering for anyone with membership — `src/pages/Account.tsx:62-69`:
    ```tsx
      // Members belong in the app — this legacy public-site account page only
      // serves signed-in users WITHOUT an active membership (owner 2026-07-03:
      // "it should be /app/account"). ProtectedRoute waits out auth loading, so
      // isMember is settled by the time we render. After every hook, per the
      // rules of hooks.
      if (isMember) {
        return <Navigate to="/app" replace />;
      }
    ```
  - `isMember` is `(!profile?.is_suspended) && (isStaff || member?.status === 'active')` (`src/contexts/AuthContext.tsx:213`). So the 2FA UI is visible only to a signed-in account that is NOT staff and has NO active `members` row — and post-login redirects all point at `/account` (`src/lib/auth.ts:36,54,62,123`; `src/pages/Login.tsx:15`), meaning such an account would land there, but every real member/staff account bounces to `/app`.
  - The in-app account surface (`AccountHub` → `MyLoginContent`) does not render it — that is the `LoginSecurityCard` path, which is a different component.
- exists: yes

Full component — every user-visible string is inside (`src/components/auth/TwoFactorSettings.tsx`):

```tsx
/**
 * Optional TOTP two-factor management — enroll (scan QR → verify), show status,
 * and turn off. Self-contained: drop <TwoFactorSettings/> anywhere a signed-in
 * user manages their account. 2FA is suggested but never required.
 */
import { useEffect, useState } from 'react';
import { ShieldCheck, Shield } from 'lucide-react';
import {
  listMfaFactors, enrollTotp, verifyTotpEnrollment, unenrollTotp, type TotpEnrollment,
} from '../../lib/auth';
import { AuthError, AuthNotice } from './AuthControls';

export function TwoFactorSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const f = await listMfaFactors();
    setEnabled(f.hasVerifiedTotp);
    setFactorId(f.totp.find((t) => t.status === 'verified')?.id ?? null);
    setLoading(false);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    const e = await enrollTotp('FHE Authenticator');
    setBusy(false);
    if (e.error) {
      setError(e.error);
      return;
    }
    setEnroll(e);
  }

  async function confirm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!enroll) return;
    setBusy(true);
    setError(null);
    const { error } = await verifyTotpEnrollment(enroll.factorId, code.trim());
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setEnroll(null);
    setCode('');
    await refresh();
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await unenrollTotp(factorId);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    await refresh();
  }

  return (
    <div className="bg-white border border-green-800/10 p-6">
      <div className="flex items-center gap-2 mb-1">
        {enabled ? <ShieldCheck size={18} className="text-green-700" /> : <Shield size={18} className="text-green-800/50" />}
        <h3 className="font-serif font-medium text-green-800 text-lg">Two-step verification</h3>
      </div>
      <p className="text-xs text-muted mb-4">
        Recommended. Adds a one-time code from an authenticator app when you sign in. Optional — you
        can turn it off any time.
      </p>

      {loading ? (
        <p className="body-text text-sm text-muted">Loading…</p>
      ) : enroll ? (
        <form onSubmit={confirm}>
          <p className="text-sm font-sans text-green-900 mb-3">
            Scan this with Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
          </p>
          {enroll.qrSvg ? (
            <div className="inline-block bg-white p-2 border border-green-800/10 mb-3" aria-label="2FA QR code"
              dangerouslySetInnerHTML={{ __html: enroll.qrSvg }} />
          ) : (
            <p className="text-xs break-all text-muted mb-3">{enroll.uri}</p>
          )}
          <AuthError>{error}</AuthError>
          <label className="form-label" htmlFor="enroll_code">Verification code</label>
          <input
            id="enroll_code"
            className="form-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={busy} className="btn-primary justify-center flex-1">
              {busy ? 'Verifying…' : 'Turn on'}
            </button>
            <button type="button" onClick={() => { setEnroll(null); setError(null); }}
              className="px-4 text-sm text-secondary hover:text-green-800 focus-ring">
              Cancel
            </button>
          </div>
        </form>
      ) : enabled ? (
        <>
          <AuthNotice>Two-step verification is on.</AuthNotice>
          <AuthError>{error}</AuthError>
          <button type="button" onClick={disable} disabled={busy}
            className="text-sm text-red-700 hover:text-red-800 underline underline-offset-2 focus-ring">
            {busy ? 'Turning off…' : 'Turn off two-step verification'}
          </button>
        </>
      ) : (
        <>
          <AuthError>{error}</AuthError>
          <button type="button" onClick={start} disabled={busy} className="btn-primary justify-center">
            {busy ? 'Starting…' : 'Enable two-step verification'}
          </button>
        </>
      )}
    </div>
  );
}
```

Every user-visible string in the unseen 2FA UI:
- Heading **"Two-step verification"**
- **"Recommended. Adds a one-time code from an authenticator app when you sign in. Optional — you can turn it off any time."**
- **"Loading…"**
- Enrolment: **"Scan this with Google Authenticator, 1Password, or Authy, then enter the 6-digit code."**, a rendered QR SVG (or the raw `otpauth://` URI as fallback), label **"Verification code"**, placeholder **"123456"**, buttons **"Turn on"** / **"Verifying…"** and **"Cancel"**
- Enabled: notice **"Two-step verification is on."**, button **"Turn off two-step verification"** / **"Turning off…"**
- Disabled: button **"Enable two-step verification"** / **"Starting…"**
- The authenticator app entry is named **"FHE Authenticator"** (`enrollTotp('FHE Authenticator')`).

---

## 42. `contacts.rider_skill_level`
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#58]
- reachability: **verified — zero readers and zero writers anywhere.**
  - `grep -rn "rider_skill_level" src/ api/` → **0 hits**.
  - `SELECT proname FROM pg_proc WHERE prosrc LIKE '%rider_skill_level%';` → **0 rows**.
  - `SELECT viewname FROM pg_views WHERE schemaname='public' AND definition ~ 'rider_skill_level';` → **0 rows**.
  - It has no CHECK constraint, so there is no declared vocabulary of allowed values either — the only hint of intended values is the column COMMENT, and `horses.rider_level_min` / `horses.rider_level_max` (also unconstrained) which it was meant to be matched against.
- exists: yes

DDL:

```
 column_name       | data_type | is_nullable | column_default
-------------------+-----------+-------------+----------------
 rider_skill_level | text      | YES         | (none)
```

No CHECK constraint. `contacts` has exactly two CHECKs, neither on this column:

```sql
contacts_contact_type_check | CHECK (((contact_type IS NULL) OR (contact_type = ANY (ARRAY['LEAD','CONTACT','TEAM','DIRECTORY','VENDOR','PARTNER']))))
contacts_staff_preferred_contact_check | CHECK ((staff_preferred_contact = ANY (ARRAY['none','phone_call','text','email'])))
```

Column COMMENT (in prod):

```
Internal staff assessment of the rider's level; pairs with horses.rider_level_min/max for horse-rider matching.
```

Value census (prod, 32 contact rows total):

```
 rider_skill_level_nonnull
---------------------------
                         0

           col           |   v    | count
-------------------------+--------+-------
 rider_skill_level       | (null) |    32
```

The adding migration, `supabase/migrations/20260804030000_guest_category_promotion_skill.sql:95-105` — the comment says outright that no logic was built:

```sql
-- ── K3: skill-match fields, captured now, used when horses land ──────────────
-- Fields only: no matching logic and no booking integration until real
-- lease-borne horses exist (owner, 2026-08-04). Capturing from today means no
-- backfill later.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rider_skill_level text;
COMMENT ON COLUMN contacts.rider_skill_level IS
  'Internal staff assessment of the rider''s level; pairs with horses.rider_level_min/max for horse-rider matching.';
ALTER TABLE horses ADD COLUMN IF NOT EXISTS rider_level_min text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS rider_level_max text;
COMMENT ON COLUMN horses.rider_level_min IS 'Lowest rider level this horse suits (matching, not yet enforced).';
COMMENT ON COLUMN horses.rider_level_max IS 'Highest rider level this horse suits (matching, not yet enforced).';
```

Note for the owner: the migration adds THREE unwired columns, not one — `horses.rider_level_min` and `horses.rider_level_max` are the other half of the same unbuilt matching feature.

---

## 43. `contacts.jump_limitations` / `{{CLIENT.JUMP_LIMITATIONS}}`
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#59]
- reachability: **verified — but the report UNDERSTATES the wiring. It is referenced in three DB functions, not only in ContactDossierModal.**
  - Report's claim "referenced only at ContactDossierModal.tsx:54" is correct **for `src/` and `api/`** — `grep -rn "jump_limitations" src/ api/` returns exactly that one hit.
  - But `SELECT proname FROM pg_proc WHERE prosrc LIKE '%jump_limitations%';` returns **three** live functions:
    - `generate_document` — reads it (line 269 of prosrc: `c.riding_experience_years, c.jump_experience, c.riding_background, c.jump_limitations`) and resolves the token at line 296: `WHEN 'JUMP_LIMITATIONS' THEN v_jl`.
    - `update_my_onboarding_profile` — line 40: `jump_limitations = coalesce(NULLIF(trim(p->>'jump_limitations'), ''), jump_limitations),` — i.e. the RPC WOULD write it if any caller sent that key. Nothing in `src/` sends it.
    - `update_contact_record` — line 9 includes `'jump_limitations'` in its allowed-key list, so the staff dossier RPC can write it. `ContactDossierModal` is the UI that calls it.
  - So the honest reachability statement: **the field IS staff-editable today** via the Contact Dossier modal, and it IS resolvable as a merge token — but the token prints in **0 template bodies and 0 clause defs**, and no onboarding form collects it:
    - `SELECT template_key FROM contract_templates WHERE coalesce(body,'') ILIKE '%JUMP_LIMITATIONS%';` → **0 rows**
    - `SELECT ... FROM contract_clause_defs WHERE coalesce(body,'')||coalesce(draft_body,'') ILIKE '%JUMP_LIMITATIONS%';` → **0 rows**
  - Value census confirms nobody has ever filled it in.
- exists: yes

DDL:

```
 column_name      | data_type | is_nullable | column_default
------------------+-----------+-------------+----------------
 jump_limitations | text      | YES         | (none)
```

No CHECK constraint, no COMMENT.

Value census (32 contacts in prod):

```
 jump_limitations_nonnull
--------------------------
                        0
```

The `template_tokens` row (prod):

```
id            | 5778ab02-c2fa-4dbb-b1bd-300f33474c2c
template_id   | (null)
namespace     | CLIENT
field         | JUMP_LIMITATIONS
token         | {{CLIENT.JUMP_LIMITATIONS}}
kind          | field
source_table  | contacts
source_column | jump_limitations
computed      | f
required      | f
party_scoped  | t
notes         | Injuries, physical limitations or riding gaps the client disclosed on their profile. Blank if none entered.
created_at    | 2026-07-03 21:56:58.331851+00
```

Note the token's `notes` says "the client disclosed on their profile" but the only surface that can write it is the STAFF dossier — no member-facing field collects it.

The `ContactDossierModal.tsx:54` reference, in its section context (`src/components/app/ContactDossierModal.tsx:44-57`) — the visible label the owner would see is **"Limitations"**, under a **"Riding background"** heading:

```tsx
  { title: 'Emergency contacts', fields: [
    ['emergency_contact_1_name', 'Contact 1 name'],
    ['emergency_contact_1_relationship', 'Relationship'],
    ['emergency_contact_1_phone', 'Phone'],
    ['emergency_contact_2_name', 'Contact 2 name'],
    ['emergency_contact_2_relationship', 'Relationship'],
    ['emergency_contact_2_phone', 'Phone'],
  ]},
  { title: 'Riding background', fields: [
    ['riding_experience_years', 'Years riding'], ['jump_experience', 'Jump experience'],
    ['riding_background', 'Background'], ['jump_limitations', 'Limitations'],
  ]},
  { title: 'Notes', fields: [['notes', 'Staff notes']] },
];
```

---

## 44. `profiles` columns: `tour_seen_at`, `first_dashboard_at`, `welcome_removed_at`, `created_from_request_id`
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#60]
- reachability: **verified — but they are not all in the same state. One is still actively WRITTEN and holds real historical data.**
  - `tour_seen_at` — **still written today**, by `mark_tour_seen(p_form_factor text)`, which is called live from `src/lib/api.ts:2421`. It has **no reader**: `grep -rn "tour_seen_at" src/ api/` finds only the type declaration at `src/lib/types.ts:55`; no view or other DB function reads it. It is the superseded roll-up of `tour_seen_mobile_at` / `tour_seen_desktop_at`, kept in sync but consulted by nothing. **5 of 13 profiles hold a real timestamp.**
  - `first_dashboard_at` — no reader, no writer. 0 src/api hits, 0 `pg_proc` hits, 0 views. **0 rows populated.**
  - `welcome_removed_at` — no reader, no writer. 0 src/api hits, 0 `pg_proc` hits, 0 views. **0 rows populated.** (Consistent with D9: the welcome email chain was deleted.)
  - `created_from_request_id` — declared only at `src/lib/types.ts:43`; 0 `pg_proc` hits, 0 views, and **no foreign-key constraint** (`SELECT ... FROM pg_constraint WHERE conrelid='profiles'::regclass AND pg_get_constraintdef(oid) LIKE '%created_from_request_id%'` → 0 rows), so it is not even referentially tied to `requests`. **0 rows populated.**
- exists: yes (all four)

DDL for all four (prod):

```
       column_name       |        data_type         | is_nullable | column_default
-------------------------+--------------------------+-------------+----------------
 created_from_request_id | uuid                     | YES         | (none)
 first_dashboard_at      | timestamp with time zone | YES         | (none)
 tour_seen_at            | timestamp with time zone | YES         | (none)
 welcome_removed_at      | timestamp with time zone | YES         | (none)
```

Value census (prod):

```
 total_profiles | tour_seen_at | first_dashboard_at | welcome_removed_at | created_from_request_id
----------------+--------------+--------------------+--------------------+-------------------------
             13 |            5 |                  0 |                  0 |                       0
```

**`tour_seen_at` holds real historical data on 5 of 13 accounts.** The other three are empty everywhere.

The `lib/types.ts` declarations (`src/lib/types.ts:43` and `:55`) — note only two of the four are declared in TypeScript at all:

```ts
  created_from_request_id: string | null;
```

```ts
  tour_seen_at?: string | null;
```

`first_dashboard_at` and `welcome_removed_at` appear **nowhere** in TypeScript — they exist only as DB columns.

The still-live writer of `tour_seen_at`, for completeness (prod `mark_tour_seen`):

```sql
CREATE OR REPLACE FUNCTION public.mark_tour_seen(p_form_factor text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  -- app.allow_profile_link lets this pass the role guard: the member is
  -- writing their own presentational marker, not an identity/employment field.
  PERFORM set_config('app.allow_profile_link', '1', true);
  IF p_form_factor = 'mobile' THEN
    UPDATE profiles
       SET tour_seen_mobile_at = coalesce(tour_seen_mobile_at, now()),
           tour_seen_at        = coalesce(tour_seen_at, now())
     WHERE user_id = auth.uid();
  ELSE
    UPDATE profiles
       SET tour_seen_desktop_at = coalesce(tour_seen_desktop_at, now()),
           tour_seen_at         = coalesce(tour_seen_at, now())
     WHERE user_id = auth.uid();
  END IF;
END;
$function$
```

---

## 45. `contacts`: `staff_preferred_contact`, `zelle_phone`, `zelle_email`, `correspondence_email`, `mobile_number`, `texts_phone`
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#61]
- reachability: **verified — the WRITE surface is fully live and reachable; the claim is about the READ side, and it holds with one exception.**
  - The writing UI is reachable: `AccountInfoCard` → `ProfileAndPreferences.tsx:21` → `MyProfileContent` → `AccountHub.tsx:109` ("My Profile" row). Any non-staff member can open it. **These are not unreachable fields — they are fields nobody reads.**
  - Read sweep, per column (`src/`+`api/` grep, plus `pg_proc` prosrc scan):
    - `zelle_phone` — src: only `AccountInfoCard.tsx:161` + the `lib/contact.ts` type/select plumbing (`:213,226,236,251`). DB functions: **none**.
    - `zelle_email` — src: only `AccountInfoCard.tsx:162` + same plumbing. DB functions: **none**.
    - `mobile_number` — src: only `AccountInfoCard.tsx:81,105` + plumbing. DB functions: **none**.
    - `texts_phone` — src: only `AccountInfoCard.tsx:56,81,115,122` + plumbing. DB functions: **none**.
    - `staff_preferred_contact` — src: only `AccountInfoCard.tsx:196-200` + plumbing. DB functions: **none**.
    - `correspondence_email` — **exception:** referenced by one live DB function, `contacts_minor_no_email_guard` (the C10 minor-protection trigger), at `AND (NEW.email IS NOT NULL OR NEW.correspondence_email IS NOT NULL)`. So this one column IS read by something outside AccountInfoCard.
  - Three of them also have a normalising trigger (migration `20260805120000_task_profile_account_info.sql:37-38`): `BEFORE INSERT OR UPDATE OF mobile_number, texts_phone, zelle_phone ... normalise_phone_columns(...)` — a writer-side helper, not a reader.
  - **Nothing consumes the Zelle details.** There is no reconciliation surface, no purchase-matching query, no report. The stated purpose ("Used to match your Zelle payments to your orders") is not implemented anywhere.
- exists: yes (all six)

DDL (prod):

```
       column_name       | data_type | is_nullable | column_default
-------------------------+-----------+-------------+----------------
 correspondence_email    | text      | YES         | (none)
 mobile_number           | text      | YES         | (none)
 staff_preferred_contact | text      | NO          | 'none'::text
 texts_phone             | text      | YES         | (none)
 zelle_email             | text      | YES         | (none)
 zelle_phone             | text      | YES         | (none)
```

Plus the CHECK:

```sql
contacts_staff_preferred_contact_check
  CHECK ((staff_preferred_contact = ANY (ARRAY['none','phone_call','text','email'])))
```

**Value census (prod, 32 contacts) — no real people's Zelle details are sitting in there. Every one of these columns is empty:**

```
 staff_pref_nondefault | zelle_phone_nonnull | zelle_email_nonnull | correspondence_email_nonnull | mobile_number_nonnull | texts_phone_nonnull
-----------------------+---------------------+---------------------+------------------------------+-----------------------+---------------------
                     0 |                   0 |                   0 |                            0 |                     0 |                   0

           col           |   v    | count
-------------------------+--------+-------
 staff_preferred_contact | none   |    32
```

The adding migration, `supabase/migrations/20260805120000_task_profile_account_info.sql:10-38`:

```sql
-- `mobile_number` is a deliberately NEW column, not a reuse of the legacy …
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS texts_phone text,
  ADD COLUMN IF NOT EXISTS correspondence_email text,
  ADD COLUMN IF NOT EXISTS zelle_phone text,
  ADD COLUMN IF NOT EXISTS zelle_email text,
  ADD COLUMN IF NOT EXISTS staff_preferred_contact text NOT NULL DEFAULT 'none';
…
  DROP CONSTRAINT IF EXISTS contacts_staff_preferred_contact_check;
  ADD CONSTRAINT contacts_staff_preferred_contact_check
  CHECK (staff_preferred_contact IN ('none', 'phone_call', 'text', 'email'));
…
  BEFORE INSERT OR UPDATE OF mobile_number, texts_phone, zelle_phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION normalise_phone_columns('mobile_number', 'texts_phone', 'zelle_phone');
```

The AccountInfoCard section that writes them, with every label and hint (`src/components/app/profile/AccountInfoCard.tsx:89-204`). Section header is **"Account information"** with the badge **"Visible only to French Heritage staff"**:

```tsx
  return (
    <SectionCard icon={Lock} title="Account information" badge="Visible only to French Heritage staff">
      <div className="flex flex-col gap-5">
        {err && (
          <p role="alert" className="form-error flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            <ShieldAlert size={14} className="shrink-0" /> {err}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name" value={info.first_name ?? ''} onCommit={(v) => commit('first_name', v || null)} />
          <Field label="Last name" value={info.last_name ?? ''} onCommit={(v) => commit('last_name', v || null)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contact phone (for calls)" type="tel" value={info.phone ?? ''} onCommit={(v) => commit('phone', v || null)} />
          <Field label="Mobile number" type="tel" value={info.mobile_number ?? ''} onCommit={(v) => commit('mobile_number', v || null)} />
        </div>

        <div>
          <label className="inline-flex items-center gap-2 text-[12.5px] text-green-900">
            <input
              type="checkbox" className="accent-green-700"
              checked={usesDifferentTextsNumber}
              onChange={(e) => {
                setUsesDifferentTextsNumber(e.target.checked);
                if (!e.target.checked) void commit('texts_phone', null);
              }}
            />
            I use a different number for texts
          </label>
          {usesDifferentTextsNumber && (
            <div className="mt-2">
              <Field label="Texts number" type="tel" value={info.texts_phone ?? ''} onCommit={(v) => commit('texts_phone', v || null)} />
            </div>
          )}
        </div>

        <Field
          label="Correspondence email" type="email"
          value={info.correspondence_email ?? ''}
          onCommit={(v) => commit('correspondence_email', v || null)}
          hint="Used for company correspondence — except access emails (password reset, login-email-change notices, legal documents), which always go to your login email."
        />

        … (mailing address block) …

        <div>
          <p className="text-[12px] font-medium text-green-900 mb-2">Zelle ID</p>
          <p className="text-[11.5px] text-muted -mt-1 mb-2">Used to match your Zelle payments to your orders.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Zelle phone" type="tel" value={info.zelle_phone ?? ''} onCommit={(v) => commit('zelle_phone', v || null)} />
            <Field label="Zelle email" type="email" value={info.zelle_email ?? ''} onCommit={(v) => commit('zelle_email', v || null)} />
          </div>
        </div>

        … (date of birth, emergency contact blocks) …

        <div>
          <label className="form-label" htmlFor="staff_preferred_contact">Preferred contact method (for our staff)</label>
          <select
            id="staff_preferred_contact" className="form-input w-full text-sm"
            value={info.staff_preferred_contact}
            onChange={(e) => commit('staff_preferred_contact', e.target.value as StaffPreferredContact)}
          >
            {staffOptions.map((v) => <option key={v} value={v}>{STAFF_PREFERRED_CONTACT_LABELS[v]}</option>)}
          </select>
        </div>
      </div>
    </SectionCard>
  );
```

The dropdown's option labels (`src/lib/contact.ts:176-181`):

```ts
export const STAFF_PREFERRED_CONTACT_LABELS: Record<StaffPreferredContact, string> = {
  none: 'No preference',
  phone_call: 'Phone call',
  text: 'Text message',
  email: 'Email',
};
```

---

## 46. `contacts.hide_email` / `hide_mobile` / `hide_whatsapp` + `SeedFallback`
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#62]
- reachability: **verified — the "no control anywhere" half is TRUE; the "ship on the wire in every member_directory response" half is now STALE and I could not reproduce it.**
  - **No control:** `grep -rn "hide_email" src/` → **0 hits**. `hide_mobile` / `hide_whatsapp` in `src/` match only the *five-channel* siblings (`hide_mobile_call`, `hide_mobile_text`, `hide_whatsapp_call`, `hide_whatsapp_text`, `hide_community_email`) at `src/components/app/profile/ProfileCard.tsx:281-293` and `src/lib/contact.ts:105-127`. **The three flagged columns have no toggle anywhere.** They ARE writable server-side: `update_contact_record` (the staff dossier RPC) lists them among its allowed keys —
    ```
    10:    'preferred_contact','hide_mobile','hide_whatsapp','hide_email',
    39:      WHEN key IN ('hide_mobile','hide_whatsapp','hide_email') THEN
    ```
    — but `ContactDossierModal`'s field map does not include them, so no UI reaches that path either.
  - **The wire claim:** there are two surfaces with this name. The `member_directory` **VIEW** does still return `email` / `mobile` / `whatsapp` gated by the three flags (see below) — **but `anon` and `authenticated` have NO `SELECT` privilege on it**, so no client can read it:
    ```
        grantee    | privilege_type
    ---------------+----------------
     postgres      | SELECT
     service_role  | SELECT
     authenticated | (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER — no SELECT)
     anon          | (same — no SELECT)
    ```
    The live client read path is the definer RPC `member_directory_list(p_user_id uuid)` (SECFIX2 G2; `src/lib/community.ts:26`), and its `RETURNS TABLE(...)` signature **does not include `email`, `mobile`, or `whatsapp` at all**. So nothing ships on the wire today. `src/lib/community-types.ts:35` already records this: *"no longer SENT either: the member_directory_list RPC does not select them"*.
  - **SeedFallback:** confirmed dead. `src/components/feed/CommunityFeed.tsx:260` — `if (SEED_ENABLED) return <SeedFallback view={view} />;` and `SEED_ENABLED === false` (`src/lib/seed.ts:10`). Its `m.mobile` / `m.whatsapp` reads are against `SEED_MEMBERS` (a hardcoded array), not against any directory response — so they are not evidence of the columns being read either.
- exists: yes (all three columns; the view; the SeedFallback function)

DDL + defaults (prod):

```
   column_name   | data_type | is_nullable | column_default
-----------------+-----------+-------------+----------------
 hide_email      | boolean   | NO          | false
 hide_mobile     | boolean   | NO          | false
 hide_whatsapp   | boolean   | NO          | false
```

Value census (32 contacts) — none has ever been flipped:

```
 hide_email_true | hide_mobile_true | hide_whatsapp_true
-----------------+------------------+--------------------
               0 |                0 |                  0
```

Origin migrations: `supabase/migrations/20260710070000_profile_contact_prefs.sql:15` (`hide_email` on profiles) and `supabase/migrations/20260730100000_person_consolidation_s1.sql:44-46`:

```sql
  ADD COLUMN IF NOT EXISTS hide_email    boolean NOT NULL DEFAULT false,
  …
  ADD COLUMN IF NOT EXISTS hide_whatsapp boolean NOT NULL DEFAULT false;
```

The `member_directory` VIEW definition — the three flagged columns are the last three CASE blocks; note the five *newer* channel columns above them are the ones with real controls:

```sql
 SELECT p.user_id,
    p.display_name,
    COALESCE(p.first_name, c.first_name) AS first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
        CASE WHEN c.hide_community_email THEN NULL::text ELSE c.community_email END AS community_email,
        CASE WHEN c.hide_mobile_call     THEN NULL::text ELSE c.mobile_call     END AS mobile_call,
        CASE WHEN c.hide_mobile_text     THEN NULL::text ELSE c.mobile_text     END AS mobile_text,
        CASE WHEN c.hide_whatsapp_call   THEN NULL::text ELSE c.whatsapp_call   END AS whatsapp_call,
        CASE WHEN c.hide_whatsapp_text   THEN NULL::text ELSE c.whatsapp_text   END AS whatsapp_text,
        CASE WHEN c.hide_email           THEN NULL::text ELSE c.email           END AS email,
        CASE WHEN c.hide_mobile          THEN NULL::text ELSE c.mobile          END AS mobile,
        CASE WHEN c.hide_whatsapp        THEN NULL::text ELSE c.whatsapp        END AS whatsapp,
    c.social_tiktok,
    c.social_instagram,
    c.social_facebook,
    c.social_linkedin,
    (EXISTS ( SELECT 1
           FROM horses h
          WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL)) AS is_horse_owner,
        CASE
            WHEN c.preferred_contact = 'email'::text AND (c.hide_community_email OR c.community_email IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'sms'::text AND (c.hide_mobile_text OR c.mobile_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'call'::text AND (c.hide_mobile_call OR c.mobile_call IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'whatsapp'::text AND (c.hide_whatsapp_text OR c.whatsapp_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'instagram'::text AND c.social_instagram IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'facebook'::text AND c.social_facebook IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'linkedin'::text AND c.social_linkedin IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'tiktok'::text AND c.social_tiktok IS NULL THEN 'none'::text
            ELSE c.preferred_contact
        END AS preferred_contact
   FROM profiles p
     JOIN members m ON m.user_id = p.user_id AND m.status = 'active'::text
     JOIN contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
  WHERE NOT p.is_suspended AND p.role IS DISTINCT FROM 'SUPER_ADMIN'::text;
```

For contrast, the live RPC's return signature — `email`, `mobile`, `whatsapp` are absent:

```sql
CREATE OR REPLACE FUNCTION public.member_directory_list(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, display_name text, first_name text, avatar_url text, bio text,
   riding_level text, community_email text, mobile_call text, mobile_text text,
   whatsapp_call text, whatsapp_text text, social_tiktok text, social_instagram text,
   social_facebook text, social_linkedin text, is_horse_owner boolean, preferred_contact text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Gate 1 — no anonymous reads.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Gate 2 — a suspended caller reads nothing.
  IF COALESCE((SELECT p2.is_suspended FROM profiles p2 WHERE p2.user_id = auth.uid()), false) THEN
    RETURN;
  END IF;
  …
```

The `SeedFallback` block and its gate (`src/components/feed/CommunityFeed.tsx:258-305`) — the `m.mobile` / `m.whatsapp` reads the report flagged are the two lines mapped onto four channels:

```tsx
    if (SEED_ENABLED) return <SeedFallback view={view} />;
    return <EmptyState view={view} />;
  }
…
// Seed fallback pulled lazily so the live path doesn't import seed rendering.
import {
  SEED_FEED, SEED_LISTINGS, SEED_ARTICLES, SEED_MEMBERS, SEED_RESOURCES,
} from '../../lib/seed';
function SeedFallback({ view }: { view: FeedView }) {
  if (view === 'members') {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {SEED_MEMBERS.map((m) => (
          <div key={m.id} className="bg-white border border-green-800/10 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-11 h-11 rounded-full bg-green-100 text-green-800 grid place-items-center text-base font-serif font-semibold">{m.initials}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-900 truncate">{m.name}</p>
                <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold">{m.role}</p>
              </div>
            </div>
            {/* Seed preview carries the pre-split shape; map its one mobile and
                one whatsapp onto both halves so the demo matches live behavior. */}
            <ContactButtons info={{
              communityEmail: m.email,
              mobileCall: m.mobile, mobileText: m.mobile,
              whatsappCall: m.whatsapp, whatsappText: m.whatsapp,
            }} />
          </div>
        ))}
      </div>
    );
  }
```

The fake member names/roles/numbers `SeedFallback` would render if `SEED_ENABLED` were flipped (`src/lib/seed.ts:125-132`) — real-looking contact details the owner has never seen:

```ts
export const SEED_MEMBERS: SeedMember[] = [
  { id: 'm1', name: 'Élise Chastain', role: 'Instructor', initials: 'ÉC', email: 'elise@example.com', mobile: '+17605550142', whatsapp: '+17605550142' },
  { id: 'm2', name: 'Jane Whitfield', role: 'Rider · new', initials: 'JW', email: 'jane@example.com', mobile: '+17605550187' },
  { id: 'm3', name: 'Margaux Colbert', role: 'Rider', initials: 'MC', email: 'margaux@example.com', whatsapp: '+17605550163' },
  { id: 'm4', name: 'Sofia Ramos', role: 'Rider', initials: 'SR', email: 'sofia@example.com', mobile: '+17605550119' },
  { id: 'm5', name: 'Claire Fontaine', role: 'Rider', initials: 'CF', email: 'claire@example.com', mobile: '+17605550148' },
  { id: 'm6', name: 'Amélie Rousseau', role: 'Rider', initials: 'AR', email: 'amelie@example.com' },
];
```

`SeedFallback` also has whole rendering branches for `resources`, `articles`, `for_sale` and the generic feed — all equally gated by the same single `SEED_ENABLED` check at line 260.

---

## 47. AccountHub deep links `?section=profile` and `?section=documents` (`src/pages/app/AccountHub.tsx`)
- reported by: TASK-ACCTEVAL-REPORT.md [INV batch4.md#63]
- reachability: **verified — the deep LINKS are orphaned; the SECTIONS themselves are reachable by clicking their rows. And the orphan list is longer than two.**
  - `AccountHub` accepts 11 section values (`SECTION_VALUES`, `AccountHub.tsx:42-44`).
  - Repo-wide `grep -rn "section=" src/ api/` finds exactly **two** `?section=` link targets:
    - `?section=saved` — `src/components/app/AppLayout.tsx:446` and `:1154` (and `:446` is itself never rendered, per artifact 33)
    - `?section=stable` — `src/pages/app/CalendarPage.tsx:599` ("Add your horse"), which `AccountHub.tsx:96-98` immediately redirects to `/app/stable`
  - One more value has a non-URL entry point: `login`, opened by `consumeGoogleLinkReturn()` after a Google consent redirect (`AccountHub.tsx:82-85`).
  - **Therefore 8 of the 11 accepted values are orphaned as deep links**, not 2: `profile`, `preferences`, `posts`, `lessons`, `documents`, `files`, `orders`, `gifts`. The report named the two it happened to check.
  - Important nuance so this isn't misread as dead UI: the *content* of `profile` and `documents` is fully reachable — a member clicks "My Profile" or "My Documents" on the Account page and it expands in place. What is unreachable is the URL form `/app/account?section=profile` / `?section=documents`, which nothing links to.
- exists: yes

The section-dispatch code showing every accepted value (`src/pages/app/AccountHub.tsx:37-98`):

```tsx
type Section =
  | 'profile' | 'preferences' | 'login'
  | 'posts' | 'lessons' | 'saved' | 'documents' | 'files' | 'stable' | 'orders' | 'gifts'
  | null;

const SECTION_VALUES: readonly string[] = [
  'profile', 'preferences', 'login', 'posts', 'lessons', 'saved', 'documents', 'files', 'stable', 'orders', 'gifts',
];
```

```tsx
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  // TASK-GOOGLEAUTH: coming back from Google's consent screen lands on this page
  // with nothing in the URL to say so (the redirect target carries no query
  // string, so the Supabase Redirect-URL allow-list cannot mis-match it). Open
  // My Login, where the outcome is reported. Reading here is safe: the read is
  // cached for the page load, so LoginSecurityCard still gets the same answer.
  const [open, setOpen] = useState<Section>(() =>
    SECTION_VALUES.includes(sectionParam ?? '') ? (sectionParam as Section)
      : consumeGoogleLinkReturn().returned ? 'login'
        : null);
  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));

  // D8: every account holder sees the full account surface — "guest" is
  // display copy only, never a gate.

  // §2: My Stable now has a real route. Old /app/account?section=stable links
  // (the only way to reach it before this task) redirect there instead of
  // pre-opening this page's panel, so "My Stable" and "Account" stop being
  // the same destination. The row's own click-to-expand still works below —
  // this only concerns the query-param entry point.
  if (sectionParam === 'stable') {
    return <Navigate to="/app/stable" replace />;
  }
```

The two named orphaned sections' render + copy (`src/pages/app/AccountHub.tsx:108-109` and `:144-145`):

```tsx
        <Row icon={UserRound} title="My Profile" sub={`${realName} · profile, account & security`} onClick={() => toggle('profile')} open={open === 'profile'} />
        {open === 'profile' && <div className="lg:col-span-2"><MyProfileContent /></div>}
```

```tsx
        <Row icon={FileText} title="My Documents" sub="Signed agreements & releases" onClick={() => toggle('documents')} open={open === 'documents'} />
        {open === 'documents' && <div className="lg:col-span-2"><DocumentsContent /></div>}
```

The full set of eleven rows, for context on which of the eight orphaned values map to which visible copy (`AccountHub.tsx:108-162`):

```tsx
        <Row icon={UserRound} title="My Profile" sub={`${realName} · profile, account & security`} … />
        <Row icon={Bell} title="My Preferences" sub="How the community can reach you" … />
        <Row icon={ShieldCheck} title="My Login" sub="Sign-in email, password & Google" … />
        <Row icon={Grid3x3} title="My Posts" sub="Your posts & listings" … />
        <Row icon={GraduationCap} title="My Lessons" sub="Credits, schedule & your progress" … />
        <Row icon={Bookmark} title="My Saved Items" sub="Articles, listings, and links you kept" … />
        <Row icon={FileText} title="My Documents" sub="Signed agreements & releases" … />
        <Row icon={Paperclip} title="My Files" sub="Anything you've uploaded — yours, wherever it's shown" … />
        <Row icon={Boxes} title="My Stable" sub="Your horses, gear, and supplies" … />
        <Row icon={ShoppingBag} title="My Orders" sub="Your purchases" … />
        <Row icon={Gift} title="My Gifts" sub="Gifts you can use" … />
```

Page header copy, since it is the frame all of this sits in (`AccountHub.tsx:102-105`):

```tsx
      <header className="mb-4">
        <p className="eyebrow">Account</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Here's everything that's yours.</h1>
      </header>
```

Also worth the owner's attention: 8 of the 11 rows are wrapped in `{!isStaff && (…)}` (`AccountHub.tsx:121-127`, `:132-164`), so a staff account sees only My Profile and My Login. The comment there records it as deliberate and reversible ("REMOVED, NOT DELETED. Every section below still builds and is one boolean from returning").
