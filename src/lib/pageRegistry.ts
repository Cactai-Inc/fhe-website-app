/**
 * TASK-PAGEVIS — THE PAGE REGISTRY.
 *
 * Owner, 2026-08-11: *"i need the ability to hide individual pages not be
 * required to hide entire modules nor be burdened by things i wont be using."*
 *
 * ── WHY THIS FILE EXISTS, AND WHY THE KEY IS NOT THE PATH ───────────────────
 *
 * Page visibility is stored per tenant in `org_page_visibility`. The obvious key
 * is the route path — and it is the wrong one. TASK-HORSEONE is about to move
 * `/app/ops/horse-records`; a row keyed on that path would silently stop
 * applying the moment it moved, and the page the owner deliberately put away
 * would reappear with no trace of why.
 *
 * So the stored key is `PageEntry.key` — a slug that belongs to this file and
 * never changes — and the route is `PageEntry.path`, one field beside it.
 *
 *   RENAMING A ROUTE: edit `path` here (and in App.tsx). Do NOT touch `key`.
 *   RETIRING A PAGE:  delete the entry. Orphan rows are harmless — nothing
 *                     reads a key the registry no longer lists.
 *   ADDING A PAGE:    add an entry. It ships VISIBLE, because visibility is the
 *                     absence of a row and there is nothing to add to the
 *                     database at all.
 *
 * The catalog lives in CODE rather than in a table on purpose: code is what
 * actually creates pages, so a table would be a second source of truth that
 * goes stale the first time someone adds a route. The database owns exactly one
 * fact — which keys this tenant has put away. `test/ui/pagevis_registry.test.ts`
 * fails the build if any `path` here stops being a registered route.
 *
 * ── WHAT HIDING MEANS ───────────────────────────────────────────────────────
 *
 * The NAV ENTRY goes. That is all. The route still resolves, bookmarks and
 * in-app links still work, and nothing is gated — `requireStaff` and the module
 * gates already do that job, and a third gate over a display preference is how a
 * tenant locks itself out of its own data. A hidden page is still ENTITLED;
 * `org_modules.enabled` is never touched.
 *
 * ── THE HUB / CHILD RULE: NO CASCADE ────────────────────────────────────────
 *
 * Every page here has (or will have) its OWN nav row, children included. So
 * hiding a hub hides one row and cannot orphan anything — its children keep
 * their own rows and stay reachable. Those two decisions are joined: no-cascade
 * is only safe BECAUSE the children are in the nav. If the child nav rows are
 * ever removed, this rule has to become cascade-with-warning.
 *
 * A hub page's own link cards are NOT filtered by visibility — a hub the owner
 * kept still lists a child he put away, and clicking it works. The task rules
 * that in-app links to hidden pages are reported, not fixed.
 */

/** The permanent nav group a page's row belongs in — its home, not necessarily
 *  where it renders today (see PARKED_IN_REVIEW below). */
export type PageGroup = 'management' | 'accounts' | 'community' | 'modules' | 'settings';

export interface PageEntry {
  /** THE STORED KEY. Grammar `group.page`, enforced by a CHECK constraint on
   *  org_page_visibility. Stable for the life of the page — never re-derive it
   *  from `path`. */
  key: string;
  /** Where the page lives today. Free to change; `key` does not follow it. */
  path: string;
  label: string;
  group: PageGroup;
  /** The module entitlement gating this page, when it has one. Visibility is a
   *  SEPARATE question: a page can be entitled and hidden, and that is the whole
   *  point of this feature. */
  module?: string;
  /** The hub this page sits under, for display grouping only. Hiding a parent
   *  does NOT hide a child (see the header). */
  parent?: string;
  /** Cannot be hidden. MIRRORS the denylist inside set_page_hidden() — the
   *  database is the authority; this flag only lets the UI say so up front. */
  protected?: true;
  /** Shown on the settings row when the page needs explaining. */
  note?: string;
}

/** Nav rows that TASK-REVIEWNAV moved into the temporary Review section. Their
 *  permanent home is the `group` recorded below; Review is a status queue, and a
 *  page leaving it is the owner's acceptance signal. Listed here so the settings
 *  page can say why a row it offers to hide is not in the rail today, and so
 *  nobody reads the absence as a registry bug. */
export const PARKED_IN_REVIEW = new Set([
  'mgmt.dashboard', 'records.hub', 'settings.team',
  /* people.leads / people.clients / people.directory REMOVED 2026-08-12
     (TASK-RECORDS) — not restored, superseded. Their one-key replacement,
     people.records, ships directly into ACCOUNTS_GROUP, never parked. */
  /* mgmt.horses REMOVED 2026-08-15 — the key itself no longer exists in
     PAGE_REGISTRY (every key in this set must, per this file's own test);
     it isn't parked in Review, it's genuinely retired. See PAGE_REGISTRY. */
]);

/** Display names for the module sections on the settings page. Mirrors
 *  `modules.name` in the database; the settings page groups by module because
 *  that is the structure the owner reasons about. */
export const MODULE_LABEL: Record<string, string> = {
  'mod.brokerage': 'Brokerage & Contracts',
  'mod.lessons': 'Lessons & Membership',
  'mod.boarding': 'Boarding & Facility',
  'mod.barnops': 'Barn Ops & Inventory',
  'mod.horserecords': 'Horse Records & Health',
  'mod.employees': 'Employees & Scheduling',
};

export const GROUP_LABEL: Record<PageGroup, string> = {
  management: 'Management',
  accounts: 'People',
  community: 'Community',
  modules: 'Modules',
  settings: 'Settings',
};

/**
 * EVERY staff page with a nav row of its own, in nav order.
 *
 * Not listed, deliberately:
 *  - the six `core.*` modules — substrate (tenancy, roles, contracts, payments,
 *    registry, branding), not user-facing surfaces;
 *  - the platform rail (Organizations / Feature flags / Registry) — SUPER_ADMIN
 *    surfaces belonging to no tenant, so no tenant hides them;
 *  - the Review rows themselves — nav position IS their status, and hiding one
 *    would falsify the acceptance signal. The real pages behind them ARE here,
 *    under their permanent homes;
 *  - the App-pages block (Messages, and Calendar/Catalog while they are parked
 *    in Review) — it is hand-written JSX, not a NavItem table, so it has no row
 *    to filter. Recorded as a follow-up in the report rather than half-done.
 */
export const PAGE_REGISTRY: PageEntry[] = [
  // ── Management ───────────────────────────────────────────────────────────
  { key: 'mgmt.dashboard', path: '/app/dashboard', label: 'Dashboard', group: 'management' },
  { key: 'mgmt.support', path: '/app/ops/support', label: 'Support', group: 'management' },
  { key: 'mgmt.payments_review', path: '/app/ops/payments/review', label: 'Payment review', group: 'management' },
  // mgmt.horses RETIRED 2026-08-15 (TASK-HORSEONE's anticipated move happened,
  // then went further): the standalone Horses page is gone, not moved — its
  // one nav row was Records' own Horses tab wearing a second hat. people.records
  // below already covers it. Per this file's own convention: retiring a page
  // means deleting the entry.
  // mgmt.documents / mgmt.deals RETIRED the same day, same reason ("lessons…
  // is really a records ledger so it should be added to the records page
  // along with documents, files, and deals") — both are now Records tabs.
  // lessons.hub is NOT deleted alongside them — see the Modules section
  // below, it still feeds MODULE_HUB_PAGE_KEY and only needed a path update.

  // ── People ───────────────────────────────────────────────────────────────
  // TASK-RECORDS (2026-08-12): people.leads / people.clients / people.directory
  // retired as three keys — Leads, Clients and Directory (split into Partners
  // and Vendors) are tabs on ONE page now, not three nav rows. Horses, Lessons,
  // Documents, Files and Deals joined them the same way later (2026-08-15) —
  // one key covers every tab, because hiding operates on the nav row and there
  // is only one.
  { key: 'people.records', path: '/app/records', label: 'Records', group: 'accounts' },

  // ── Community ────────────────────────────────────────────────────────────
  { key: 'community.activity', path: '/app/ops/activity', label: 'Activity', group: 'community' },
  { key: 'community.evaluations', path: '/app/ops/evaluations', label: 'Evaluations', group: 'community' },
  { key: 'community.moderation', path: '/app/ops/moderation', label: 'Moderation', group: 'community' },
  { key: 'community.lookups', path: '/app/ops/lookups', label: 'Field options', group: 'community' },
  { key: 'community.content', path: '/app/ops/content', label: 'Content store', group: 'community' },
  { key: 'community.oversight', path: '/app/ops/oversight', label: 'Oversight', group: 'community' },

  // ── Modules ──────────────────────────────────────────────────────────────
  // Lessons' hub has always sat in Management rather than Modules; it keeps that
  // home and is listed under its module here so the section is complete.
  // MOVED 2026-08-15: /app/ops/lessons -> /app/records/lessons (Records tab).
  // The key stays lessons.hub — MODULE_HUB_PAGE_KEY reads it by key, not path
  // (this is exactly the case pageRegistry.ts's own header comment names).
  { key: 'lessons.hub', path: '/app/records/lessons', label: 'Lessons', group: 'management', module: 'mod.lessons' },
  // LESSONPLAN — its OWN nav row, per the hub/child rule above: no-cascade is
  // only safe because children are in the nav. D17 was written about exactly the
  // opposite of this (a routed page with no registry row, which the owner
  // concluded did not exist).
  { key: 'lessons.plans', path: '/app/ops/lessons/plans', label: 'Lesson plans', group: 'management', module: 'mod.lessons', parent: 'lessons.hub' },
  // TASK-CREDITGRANT — the credits ledger is no longer read-only: it is where
  // staff hand-write, comp and bill a credit, and where they undo one. D17 was
  // written about exactly this shape (a value-moving surface reachable only as a
  // small link on a hub KPI card, which the owner concluded did not exist), so it
  // gets its own nav row like every other child here.
  { key: 'lessons.credits', path: '/app/ops/lessons/credits', label: 'Lesson credits', group: 'management', module: 'mod.lessons', parent: 'lessons.hub' },

  { key: 'boarding.hub', path: '/app/ops/boarding', label: 'Boarding', group: 'modules', module: 'mod.boarding' },
  { key: 'boarding.facilities', path: '/app/ops/boarding/facilities', label: 'Facilities & stalls', group: 'modules', module: 'mod.boarding', parent: 'boarding.hub' },
  { key: 'boarding.agreements', path: '/app/ops/boarding/agreements', label: 'Board agreements', group: 'modules', module: 'mod.boarding', parent: 'boarding.hub' },
  { key: 'boarding.charges', path: '/app/ops/boarding/charges', label: 'Board charges', group: 'modules', module: 'mod.boarding', parent: 'boarding.hub' },

  { key: 'barnops.hub', path: '/app/ops/barnops', label: 'Barn Ops', group: 'modules', module: 'mod.barnops' },
  { key: 'barnops.resources', path: '/app/ops/barnops/resources', label: 'Resources', group: 'modules', module: 'mod.barnops', parent: 'barnops.hub' },
  { key: 'barnops.consumption', path: '/app/ops/barnops/consumption', label: 'Consumption log', group: 'modules', module: 'mod.barnops', parent: 'barnops.hub' },
  { key: 'barnops.allocation_rules', path: '/app/ops/barnops/allocation-rules', label: 'Allocation rules', group: 'modules', module: 'mod.barnops', parent: 'barnops.hub' },

  { key: 'employees.hub', path: '/app/ops/employees', label: 'Employees', group: 'modules', module: 'mod.employees' },
  { key: 'employees.staff', path: '/app/ops/employees/staff', label: 'Staff', group: 'modules', module: 'mod.employees', parent: 'employees.hub' },
  { key: 'employees.schedule', path: '/app/ops/employees/schedule', label: 'Schedule', group: 'modules', module: 'mod.employees', parent: 'employees.hub' },

  { key: 'records.hub', path: '/app/ops/records', label: 'Records', group: 'modules', module: 'mod.horserecords' },

  // ── Settings ─────────────────────────────────────────────────────────────
  { key: 'settings.team', path: '/app/ops/team', label: 'Team', group: 'settings' },
  { key: 'settings.branding', path: '/app/ops/admin/branding', label: 'Branding', group: 'settings' },
  { key: 'settings.products', path: '/app/ops/admin/products', label: 'Products', group: 'settings' },
  { key: 'settings.forms', path: '/app/ops/admin/forms', label: 'Forms', group: 'settings' },
  { key: 'settings.menus', path: '/app/ops/admin/menus', label: 'Menus', group: 'settings' },
  {
    key: 'settings.page_visibility', path: '/app/ops/admin/pages', label: 'Page visibility',
    group: 'settings', protected: true,
    note: 'This page brings every other one back, so it cannot be hidden. Refused by the database, not just here.',
  },
];

/** MODULE HUBS, by module key — what the Ops status tile reads to tell "you put
 *  this away" apart from "you do not have this". */
export const MODULE_HUB_PAGE_KEY: Record<string, string> = Object.fromEntries(
  PAGE_REGISTRY.filter((p) => p.module && !p.parent).map((p) => [p.module as string, p.key]),
);

const BY_KEY = new Map(PAGE_REGISTRY.map((p) => [p.key, p]));

export function pageByKey(key: string): PageEntry | undefined {
  return BY_KEY.get(key);
}

/** The registry key for a route path, or undefined. Used only by tooling and
 *  tests — runtime code passes keys, never paths. */
export function pageKeyForPath(path: string): string | undefined {
  return PAGE_REGISTRY.find((p) => p.path === path)?.key;
}

export interface PageSection {
  /** Stable section id (a module key, or `group:<name>`). */
  id: string;
  label: string;
  /** The entitlement behind this section, when it is a module section. */
  module?: string;
  pages: PageEntry[];
}

/**
 * The registry arranged for the settings page: MODULE sections first (grouped by
 * module, which is the structure the owner reasons about), then the plain nav
 * groups. Hubs lead their own section, children follow in registry order.
 *
 * Every page is listed, visible ones included — a list of only the hidden pages
 * cannot be used to hide anything.
 */
export function pageSections(): PageSection[] {
  const sections: PageSection[] = [];

  const moduleOrder = PAGE_REGISTRY
    .map((p) => p.module)
    .filter((m): m is string => !!m)
    .filter((m, i, all) => all.indexOf(m) === i);

  for (const mod of moduleOrder) {
    sections.push({
      id: mod,
      label: MODULE_LABEL[mod] ?? mod,
      module: mod,
      pages: PAGE_REGISTRY.filter((p) => p.module === mod),
    });
  }

  const groupOrder: PageGroup[] = ['management', 'accounts', 'community', 'modules', 'settings'];
  for (const g of groupOrder) {
    const pages = PAGE_REGISTRY.filter((p) => p.group === g && !p.module);
    if (pages.length === 0) continue;
    sections.push({ id: `group:${g}`, label: GROUP_LABEL[g], pages });
  }

  return sections;
}
