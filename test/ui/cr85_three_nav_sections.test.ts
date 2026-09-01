// @vitest-environment jsdom
/**
 * TASK-CR85 — THE NAV IS THREE SECTIONS, AND PEOPLE DISSOLVES INTO COMMUNITY.
 *
 * Owner, 2026-08-31: *"But Community, People, Managment, Admin, is the correct
 * order… we could move people into community and then remove that as a
 * standalone section, now we have community, management, admin."* and
 * *"catalog and messages belong in community… that is what the community sees.
 * conversely i have a separate surface for editing the catalog contents in the
 * admin section."*
 *
 * ⚠️ WHAT THESE ASSERTIONS ARE ACTUALLY GUARDING, in order of how expensive the
 * mistake was last time:
 *
 *  T2 — THREE NAV SURFACES RENDER THIS: the desktop rail, the mobile drawer and
 *  the avatar drop-down. TASK-AR4 found TASK-FIX3's rename was DESKTOP-ONLY and
 *  the owner, who works on a phone, would have seen nothing change. The rows
 *  are a shared table now rather than hand-written JSX per site, and the source
 *  assertions below are what keep it that way — a component test that mounts
 *  one surface proves nothing about the other two.
 *
 *  T1 — `community` IS THE ADMIN SECTION'S KEY, and it is the `group` field on
 *  six registry rows whose stored `page_key`s are CHECK-constrained to that
 *  grammar. The new Community section must NOT take it, and Admin must not lose
 *  it. Both directions are asserted.
 *
 *  §4 — THE MEMBER RAIL IS NOT THIS TASK. `ClientNavItems` / `PRESENCE_LINKS` /
 *  `QUICK` serve members and are untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { manageNavGroups } from '../../src/components/app/AppLayout';
import { PAGE_REGISTRY, GROUP_LABEL, pageSections } from '../../src/lib/pageRegistry';

const APP_LAYOUT = readFileSync(`${process.cwd()}/src/components/app/AppLayout.tsx`, 'utf8');

/** Mirrors CARD_PAGE_ONLY / railNavGroups() in AppLayout.tsx: `settings` and
 *  `modules` are returned for /app/ops/settings and /app/ops/modules to build
 *  their card grids from, and every nav surface filters them out. */
const rail = (groups: ReturnType<typeof manageNavGroups>) =>
  groups.filter((g) => g.key !== 'settings' && g.key !== 'modules');

/** An admin of a tenant with every module on — FHE's live state. */
const adminRail = () => rail(manageNavGroups(() => true, true, false, []));
/** An instructor: not admin, no grants. */
const instructorRail = () => rail(manageNavGroups(() => true, false, false, []));
const rowsIn = (key: string) => (adminRail().find((g) => g.key === key)?.items ?? []);

describe('CR85 — three sections, in the owner’s order', () => {
  it('the staff rail is Community · Management · Admin, and nothing else', () => {
    expect(adminRail().map((g) => [g.key, g.label])).toEqual([
      ['app-pages', 'Community'],
      ['management', 'Management'],
      ['community', 'Admin'],
    ]);
  });

  it('an instructor sees the same three sections, with fewer Admin rows', () => {
    expect(instructorRail().map((g) => g.label)).toEqual(['Community', 'Management', 'Admin']);
  });

  it('⚠️ no "People" section, and no empty group left where it was', () => {
    for (const groups of [adminRail(), instructorRail()]) {
      expect(groups.map((g) => g.key)).not.toContain('accounts');
      expect(groups.map((g) => g.label)).not.toContain('People');
      // manageNavGroups() drops empty groups — FIX3 hit exactly this.
      expect(groups.every((g) => g.items.length > 0)).toBe(true);
    }
  });
});

describe('CR85 — what Community holds', () => {
  it('the feed first (as a component), then Catalog and Messages, then Contacts and Stable', () => {
    expect(rowsIn('app-pages').map((i) => [i.label, i.to])).toEqual([
      ['Catalog', '/app/catalog'],
      ['Messages', '/app/messages'],
      ['Contacts', '/app/records'],
      ['Stable', '/app/records/horses'],
    ]);
    // The feed is not a NavItem — it has nested filter children — so it is
    // rendered by the section, ahead of the rows. See the surface tests below.
  });

  it('Contacts and Stable keep their icons; nothing was renamed', () => {
    const byLabel = Object.fromEntries(rowsIn('app-pages').map((i) => [i.label, i]));
    expect(byLabel.Contacts.icon.displayName ?? byLabel.Contacts.icon.name).toMatch(/Contact2/);
    expect(byLabel.Stable.icon.displayName ?? byLabel.Stable.icon.name).toMatch(/Fence/);
  });

  it('⚠️ the VIEW is in Community and the EDITOR is in Admin — two pages, on purpose', () => {
    expect(rowsIn('app-pages').map((i) => i.to)).toContain('/app/catalog');
    expect(rowsIn('community').map((i) => i.to)).toContain('/app/ops/admin/products');
  });
});

describe('CR85 — T1: the Admin section’s key is untouched', () => {
  it('Admin is still keyed `community`, and Community is not', () => {
    expect(adminRail().find((g) => g.label === 'Admin')?.key).toBe('community');
    expect(adminRail().find((g) => g.label === 'Community')?.key).toBe('app-pages');
  });

  it('the six registry rows carrying `group: community` are exactly the ones that did', () => {
    expect(PAGE_REGISTRY.filter((p) => p.group === 'community').map((p) => p.key)).toEqual([
      'community.moderation', 'community.lookups', 'community.content',
    ]);
    // The other three `community.` KEYS live under other groups — a key never
    // follows its page (pageRegistry.ts header). These are the six page_keys
    // whose stored grammar depends on that prefix.
    expect(PAGE_REGISTRY.filter((p) => p.key.startsWith('community.')).map((p) => p.key))
      .toEqual(['community.evaluations', 'community.moderation', 'community.lookups', 'community.content']);
    expect(GROUP_LABEL.community).toBe('Admin');
  });
});

describe('CR85 — T3: the registry moved with the nav', () => {
  it('Catalog and Messages have registry rows for the first time', () => {
    const byPath = Object.fromEntries(PAGE_REGISTRY.map((p) => [p.path, p]));
    expect(byPath['/app/catalog']?.key).toBe('app_pages.catalog');
    expect(byPath['/app/messages']?.key).toBe('app_pages.messages');
  });

  it('⚠️ Contacts and Stable KEEP their stored keys — only `group` moved', () => {
    const byKey = Object.fromEntries(PAGE_REGISTRY.map((p) => [p.key, p]));
    expect(byKey['people.records'].path).toBe('/app/records');
    expect(byKey['people.records'].group).toBe('app_pages');
    expect(byKey['people.stable'].path).toBe('/app/records/horses');
    expect(byKey['people.stable'].group).toBe('app_pages');
  });

  it('every Community row in the nav has a registry row, and vice versa', () => {
    const navPaths = rowsIn('app-pages').map((i) => i.to).sort();
    const regPaths = PAGE_REGISTRY.filter((p) => p.group === 'app_pages').map((p) => p.path).sort();
    expect(navPaths).toEqual(regPaths);
  });

  it('/app/ops/admin/pages describes the same three sections the rail renders', () => {
    const plain = pageSections().filter((s) => !s.module).map((s) => s.label);
    expect(plain).toEqual(['Community', 'Management', 'Admin']);
    // (The `modules` group prints no plain section of its own — every row
    // carrying it also carries a `module`, so it is listed in that module's
    // section instead.) `People` is gone from this page too, and no empty
    // heading is left behind: pageSections() skips a group with no rows.
    expect(plain).not.toContain('People');
  });
});

describe('CR85 — T2: all three nav surfaces, proven against the source', () => {
  it('all three still map railGroups, and none maps the unfiltered array', () => {
    expect((APP_LAYOUT.match(/railGroups\.map\(/g) ?? []).length).toBe(3);
    expect(APP_LAYOUT.match(/navGroups\.map\(/g)).toBeNull();
  });

  it('⚠️ the hand-written staff block is GONE — no surface renders rows of its own', () => {
    expect(APP_LAYOUT).not.toContain('<StaffNavItems');
    expect(APP_LAYOUT).not.toContain('function StaffNavItems');
    expect(APP_LAYOUT).not.toContain('APP_PAGES_GROUP:');
  });

  it('the feed renders inside the Community section at the rail AND the drawer', () => {
    const injections = APP_LAYOUT.match(/g\.key === COMMUNITY_KEY && <CommunityNav/g) ?? [];
    expect(injections.length, 'the rail and the drawer, one each').toBe(2);
    expect(APP_LAYOUT).toContain('{g.key === COMMUNITY_KEY && <CommunityNav open={staffRailPinned} />}');
    expect(APP_LAYOUT).toContain('{g.key === COMMUNITY_KEY && <CommunityNav onNavigate={closeMobileNav} />}');
  });

  it('Messages carries its unread badge on every surface, injected by route', () => {
    expect(APP_LAYOUT).toContain("if (it.to === '/app/messages') return { ...it, badge: dmCount };");
    // RailLink (rail + drawer) always rendered a badge; MenuLink (the avatar
    // drop-down) never did, and dropped Dashboard's silently. It does now.
    expect(APP_LAYOUT).toContain('function MenuLink({ to, label, icon: Icon, end, badge = 0, onNavigate }');
  });
});

describe('CR85 — §4: the member rail is not this task', () => {
  it('a member gets no staff sections at all', () => {
    // showRail is false for members, so navGroups is [] — but prove the tables
    // themselves never name a member surface.
    expect(APP_LAYOUT).toContain('<ClientNavItems bellCount={bellCount} dmCount={dmCount} presence={presence} lessonsOn={lessonsOn} />');
    expect(APP_LAYOUT).toContain('const PRESENCE_LINKS');
  });

  it('the drawer’s member block is the member’s alone, and still has no heading', () => {
    expect(APP_LAYOUT).toContain('{!isSuperAdmin && !showRail && (');
    const idx = APP_LAYOUT.indexOf('{!isSuperAdmin && !showRail && (');
    const block = APP_LAYOUT.slice(idx, APP_LAYOUT.indexOf('{railGroups.map((g) => (', idx));
    expect(block).toContain('<CommunityNav onNavigate={closeMobileNav} />');
    expect(block).toContain('<ClientNavItems');
    expect(block, 'a heading appeared over the member block').not.toContain('NAV_HEADING');
  });

  it('a superadmin still sees only Platform, and no Community section', () => {
    const su = rail(manageNavGroups(() => true, false, true, []));
    expect(su.map((g) => g.key)).toEqual(['platform']);
  });
});
