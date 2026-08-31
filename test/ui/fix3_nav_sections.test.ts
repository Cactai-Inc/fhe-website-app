// @vitest-environment jsdom
/**
 * TASK-FIX3 — THE NAV SECTIONS, AND THE FILTER THAT DID NOT EXIST.
 *
 * ⚠️ THE DEFECT THIS PINS IS NOT A BUG IN A FUNCTION. It is a comment that
 * described a change nobody made. On 2026-08-15 the owner asked for the Settings
 * and Modules sections to leave the staff menu; a comment was added to
 * `manageNavGroups()` asserting they "are filtered out of the SIDEBAR at the
 * render site below"; **no such filter was ever written**, and both sections
 * were still on screen sixteen days later, on every nav surface, when the owner
 * found them a second time.
 *
 * So the assertions below are in two halves, and BOTH are required:
 *
 *   1. `manageNavGroups()` still RETURNS the `settings` and `modules` groups —
 *      /app/ops/settings and /app/ops/modules build their card grids by calling
 *      this same function and looking themselves up by key, so deleting the
 *      entries would blank both pages. The membership is a data fact.
 *
 *   2. ⚠️ NO RENDER SITE MAPS OVER `navGroups`. There are THREE (the avatar
 *      drop-down, the desktop rail, the mobile drawer) and they are the reason
 *      the original miss was invisible: changing some of them looks exactly like
 *      changing all of them. This is asserted against the SOURCE, because a
 *      component test that mounts one surface proves nothing about the other two.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { manageNavGroups } from '../../src/components/app/AppLayout';

const APP_LAYOUT = readFileSync(`${process.cwd()}/src/components/app/AppLayout.tsx`, 'utf8');

/** An admin of a tenant with every module on — FHE's live state, verified
 *  against `org_modules` on 2026-08-31 (all six enabled). */
const adminGroups = () => manageNavGroups(() => true, true, false, []);
/** An instructor: not admin, no grants. */
const instructorGroups = () => manageNavGroups(() => true, false, false, []);

const labelOf = (key: string) => adminGroups().find((g) => g.key === key)?.label;
const pathsIn = (key: string) => (adminGroups().find((g) => g.key === key)?.items ?? []).map((i) => i.to);

describe('FIX3 — the section names', () => {
  it('the section formerly called Community reads "Admin"', () => {
    expect(labelOf('community')).toBe('Admin');
  });

  it('"People" is a rendered section again, because it has rows again', () => {
    expect(labelOf('accounts')).toBe('People');
    expect(pathsIn('accounts')).toEqual(['/app/records', '/app/records/horses']);
  });

  it('"App pages" is labelled Community, and the label is written once', () => {
    expect(APP_LAYOUT).toContain("key: 'app-pages', label: 'Community'");
    expect(APP_LAYOUT).not.toContain("'App pages'");
  });
});

describe('FIX3 — what moved where', () => {
  it('Calendar and Evaluations are under Management', () => {
    expect(pathsIn('management')).toContain('/app/calendar');
    expect(pathsIn('management')).toContain('/app/ops/evaluations');
  });

  it('Calendar left the hand-written staff block — it is a NavItem now, not JSX', () => {
    expect(APP_LAYOUT).not.toContain('<RailLink to="/app/calendar" label="Calendar" icon={CalendarDays} open={open} />');
  });

  it('Settings dissolved into Admin — every one of its pages is an Admin row', () => {
    const admin = pathsIn('community');
    for (const p of ['/app/ops/team', '/app/ops/admin/branding', '/app/ops/admin/products',
      '/app/ops/admin/editor', '/app/ops/admin/pages']) {
      expect(admin, `${p} is not in the Admin section`).toContain(p);
    }
  });

  it('Page visibility has a nav row for the first time, and it is admin-only', () => {
    expect(pathsIn('community')).toContain('/app/ops/admin/pages');
    const forInstructor = instructorGroups().find((g) => g.key === 'community')?.items.map((i) => i.to) ?? [];
    expect(forInstructor).not.toContain('/app/ops/admin/pages');
    // Team is deliberately NOT adminOnly — its route is requireStaff.
    expect(forInstructor).toContain('/app/ops/team');
  });
});

describe('FIX3 — Activity and Oversight are gone', () => {
  it('neither path appears in any nav group, for any role', () => {
    for (const groups of [adminGroups(), instructorGroups()]) {
      const all = groups.flatMap((g) => g.items.map((i) => i.to));
      expect(all).not.toContain('/app/ops/activity');
      expect(all).not.toContain('/app/ops/oversight');
    }
  });

  it('no NavItem in the file points at either page', () => {
    expect(APP_LAYOUT).not.toContain("to: '/app/ops/activity'");
    expect(APP_LAYOUT).not.toContain("to: '/app/ops/oversight'");
  });
});

describe('FIX3 — ⚠️ Settings and Modules: in the data, out of every rail', () => {
  it('both groups are STILL RETURNED, or their landing pages blank', () => {
    const keys = adminGroups().map((g) => g.key);
    expect(keys, 'NavGroupCardsPage finds these by key').toContain('settings');
    expect(keys, 'NavGroupCardsPage finds these by key').toContain('modules');
  });

  it('⚠️ ALL THREE render sites map over railGroups, and none over navGroups', () => {
    // The three sites: the avatar drop-down (lg:hidden), the desktop staff rail,
    // and the mobile drawer.
    const railSites = APP_LAYOUT.match(/railGroups\.map\(/g) ?? [];
    expect(railSites.length, 'expected exactly three nav render sites').toBe(3);
    expect(APP_LAYOUT.match(/navGroups\.map\(/g), 'a render site still maps the unfiltered array').toBeNull();
  });

  it('the filter is real and names both keys', () => {
    expect(APP_LAYOUT).toContain("const CARD_PAGE_ONLY = new Set(['settings', 'modules']);");
    expect(APP_LAYOUT).toContain('const railGroups = railNavGroups(navGroups);');
  });

  it('the mobile drawer has a heading element for the App-pages block', () => {
    // TASK-AR4 Finding 3: renaming the label was a desktop-only change, because
    // the mobile drawer rendered no heading for this block at all.
    const drawerAnchor = APP_LAYOUT.indexOf('<CommunityNav onNavigate={closeMobileNav} />');
    expect(drawerAnchor, 'the mobile drawer block moved — re-anchor this test').toBeGreaterThan(0);
    const justAbove = APP_LAYOUT.slice(Math.max(0, drawerAnchor - 900), drawerAnchor);
    expect(justAbove, 'the drawer renders the block with no heading again').toContain('{APP_PAGES_GROUP.label}');
    // Desktop renders it twice (the pinned button, and the collapsed strip's
    // aria-label); mobile now renders it once. Three in total, not two.
    expect(APP_LAYOUT.match(/\{APP_PAGES_GROUP\.label\}/g)?.length).toBe(3);
  });
});
