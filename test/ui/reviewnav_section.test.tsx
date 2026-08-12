// @vitest-environment jsdom
/**
 * TASK-REVIEWNAV — proves the Review section, in the absence of a browser.
 *
 * No staff browser session exists in this environment, so these tests are the
 * substitute for clicking it. They prove the three things the task's own test
 * list can be proved without one:
 *
 *  1. The REVIEW group renders in the desktop admin rail, admin-only, carrying
 *     the one line that says what sitting in it means.
 *  2. Every moved link appears in Review and NOWHERE ELSE — the owner's "move
 *     it, don't copy it" rule, checked by counting hrefs across the whole nav.
 *  3. Every Review destination is a REGISTERED ROUTE. This reads App.tsx's own
 *     source and builds the route table from it, so a Review entry pointing at
 *     a path nobody registered fails here rather than 404-ing under the owner.
 *
 * What these do NOT prove: that each page renders correctly once loaded. That
 * needs a browser and is reported as NOT VERIFIED.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';

import { REVIEW_GROUPS, REVIEW_NAV_ITEMS, REVIEW_NOTE } from '../../src/lib/reviewSection';
import { CONTACTS_PAGE_RETIRED } from '../../src/pages/app/ops/ContactsPage';
import { INTAKE_PAGE_RETIRED } from '../../src/pages/app/ops/IntakePage';
import AppLayout from '../../src/components/app/AppLayout';

/* The signed-in identity under test. Flipped per-describe: an ADMIN sees
   Review, a non-admin staff account must not. */
const who = { isAdmin: true, isStaff: true };

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { display_name: 'Test Admin', first_name: 'Test', last_name: 'Admin' },
    get isAdmin() { return who.isAdmin; },
    get isStaff() { return who.isStaff; },
    isSuperAdmin: false,
    hasModule: () => true,
    signOut: vi.fn(),
  }),
}));
vi.mock('../../src/lib/surfaces', () => ({
  useViewSurfaces: () => ({ surfaces: { categories: [], surfaces: [], has_feed: false, has_community: false, is_operator: true }, loading: false, refresh: () => {} }),
}));
vi.mock('../../src/lib/community', () => ({ dmUnreadTotal: () => Promise.resolve(0) }));
vi.mock('../../src/lib/grants', () => ({ fetchMyGrantKeys: () => Promise.resolve([]) }));
vi.mock('../../src/lib/api', () => ({
  myUnreadCount: () => Promise.resolve(0),
  inboundOpenCount: () => Promise.resolve(0),
  myWallState: () => Promise.resolve({ pending: 0, wall: false, staff: true }),
  getMyProfile: () => Promise.resolve(null),
  markTourSeen: () => Promise.resolve(),
  fetchMyCategories: () => Promise.resolve([]),
  currentTourFormFactor: () => 'desktop',
  myNavPresence: () => Promise.resolve({ orders: false, documents: false, stable: false, posts: false, saved: false }),
}));

afterEach(() => { cleanup(); who.isAdmin = true; who.isStaff = true; });

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <Routes>
        <Route path="/app" element={<AppLayout />}>
          <Route path="dashboard" element={<div>page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** Every href the whole nav renders, duplicates included — the only way to
 *  prove a link was MOVED rather than copied is to count them. */
function navHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a[href]'))
    .map((a) => a.getAttribute('href') as string);
}

describe('the REVIEW group', () => {
  it('renders in the desktop rail for an admin', () => {
    const { container } = renderLayout();
    expect(screen.getAllByText('Review').length).toBeGreaterThan(0);
    // its own index page is the first row
    expect(navHrefs(container)).toContain('/app/ops/review');
  });

  it('says what sitting in it means — leaving Review is the acceptance signal', () => {
    renderLayout();
    expect(screen.getAllByText(REVIEW_NOTE).length).toBeGreaterThan(0);
    expect(REVIEW_NOTE).toMatch(/moving it out of Review means done/i);
  });

  it('is admin-only: a non-admin staff account gets no Review group', () => {
    who.isAdmin = false;
    const { container } = renderLayout();
    expect(navHrefs(container)).not.toContain('/app/ops/review');
    expect(screen.queryByText(REVIEW_NOTE)).not.toBeInTheDocument();
  });

  it('renders every manifest entry that has its own URL', () => {
    const { container } = renderLayout();
    const hrefs = navHrefs(container);
    for (const item of REVIEW_NAV_ITEMS) {
      expect(hrefs, `Review row missing: ${item.label}`).toContain(item.to);
    }
  });

  it('labels every row with its slot, and says which one is in use', () => {
    for (const g of REVIEW_GROUPS) {
      const incumbents = g.entries.filter((e) => e.incumbent);
      expect(incumbents, `${g.key} must have exactly one incumbent`).toHaveLength(1);
      /* The nav has no badges — the label is the only place the incumbent can
         be marked, so every incumbent WITH a nav row has to say so in words.
         An entry with `navRow: false` is index-page-only, where the "in use"
         pill does that job. */
      if (incumbents[0].navRow !== false) {
        expect(incumbents[0].label, `${g.key} slot A must say it is in use`).toMatch(/in use/i);
      }
      for (const e of g.entries) {
        expect(e.label.length, `${g.key} ${e.slot} needs a label`).toBeGreaterThan(0);
        expect(e.what.length, `${g.key} ${e.slot} needs a description`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the live pages MOVED, they were not copied', () => {
  /* One row per link the task took out of another nav group. If any of these
     ever shows up twice, the owner cannot tell A from a copy of A — which is
     the duplication problem this whole section exists to end. */
  /* /app/admin, /app/ops/leads and /app/ops/directory (People → Clients /
     Leads / Directory) REMOVED 2026-08-12 — TASK-RECORDS accepted that slot
     of the comparison rather than restoring the three rows: they collapsed
     into ONE new row, "Records" (ACCOUNTS_GROUP, /app/records), which was
     never in Review and so is not a MOVED link — it ships straight to its
     permanent home. Those three routes still resolve (they redirect into
     Records' own tabs) but no longer have a nav row of their own to move. */
  const MOVED = [
    '/app/dashboard',          // Management → Dashboard
    '/app/ops/horse-records',  // Management → Horses
    '/app/ops/records',        // Modules → Records
    '/app/ops/team',           // Settings → Team
    '/app/account',            // the rail's AccountNavLink row
    '/app/calendar',           // StaffNavItems → Calendar
    '/app/catalog',            // StaffNavItems → Catalog
  ];

  it('each moved link appears exactly once in the whole nav', () => {
    const { container } = renderLayout();
    const hrefs = navHrefs(container);
    for (const to of MOVED) {
      const n = hrefs.filter((h) => h === to).length;
      expect(n, `${to} should appear once (it appears ${n}×)`).toBe(1);
    }
  });

  it('and that one appearance is the Review row', () => {
    const reviewTargets = REVIEW_NAV_ITEMS.map((i) => i.to);
    for (const to of MOVED) {
      expect(reviewTargets, `${to} must be a Review entry`).toContain(to);
    }
  });
});

describe('the route table', () => {
  /* Built from App.tsx's own source rather than hand-listed: a Review entry
     pointing at an unregistered path is exactly the failure the task warns
     about ("Each one LOADS when clicked"), and it must fail here. */
  /* process.cwd() is the repo root under vitest; `import.meta.url` is an http
     URL in the jsdom environment and cannot be resolved to a file path. */
  const appSrc = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8');
  const registered = new Set<string>(
    Array.from(appSrc.matchAll(/path="([^"]+)"/g)).map((m) => {
      const p = m[1];
      return p.startsWith('/') ? p : `/app/${p}`;
    }),
  );

  it('registers all five review-only routes', () => {
    for (const p of [
      '/app/ops/review', '/app/ops/review/contacts', '/app/ops/review/intake',
      '/app/ops/review/contact-dossier', '/app/ops/review/contact-form',
    ]) {
      expect(registered, `route not registered: ${p}`).toContain(p);
    }
  });

  it('every Review destination resolves to a registered route', () => {
    for (const item of REVIEW_NAV_ITEMS) {
      const path = item.to.split('?')[0];
      // route params: /app/contracts/:id matches /app/contracts/<uuid>
      const hit = registered.has(path) || Array.from(registered).some((r) => {
        const rp = r.split('/'); const pp = path.split('/');
        return rp.length === pp.length && rp.every((seg, i) => seg.startsWith(':') || seg === pp[i]);
      });
      expect(hit, `Review row "${item.label}" points at an unregistered path: ${path}`).toBe(true);
    }
  });

  it('has no two Review rows on one URL', () => {
    const tos = REVIEW_NAV_ITEMS.map((i) => i.to);
    expect(new Set(tos).size, 'duplicate Review destinations').toBe(tos.length);
  });
});

describe('nothing was un-retired to get it into Review', () => {
  it('CONTACTS_PAGE_RETIRED is still true', () => {
    expect(CONTACTS_PAGE_RETIRED).toBe(true);
  });
  it('INTAKE_PAGE_RETIRED is still true', () => {
    expect(INTAKE_PAGE_RETIRED).toBe(true);
  });
  it('and both retired pages are reachable for review anyway', () => {
    const tos = REVIEW_NAV_ITEMS.map((i) => i.to);
    expect(tos).toContain('/app/ops/review/contacts');
    expect(tos).toContain('/app/ops/review/intake');
  });
});
