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
 * Hiding a hub hides one row and does not cascade to its children.
 *
 * ⚠️ CORRECTED 2026-08-31 (TASK-FIX3). This paragraph used to read "Every page
 * here has (or will have) its OWN nav row, children included… no-cascade is only
 * safe BECAUSE the children are in the nav. If the child nav rows are ever
 * removed, this rule has to become cascade-with-warning."
 * ⚠️ THE CHILDREN WERE NEVER IN THE NAV. Counted 2026-08-31: 12 of the 32 rows
 * below have no nav row anywhere — the eight module children, the three
 * `lessons.*` rows, and the dead `records.hub`. They are reachable only from
 * their hub's own link cards. So the premise the no-cascade rule rests on has
 * never been true, and the condition the paragraph named for revisiting it was
 * met before it was written.
 *
 * It is left as no-cascade rather than changed here, because the honest fix is
 * either eleven nav rows or a cascade-with-warning, and both are bigger than a
 * comment. ⚠️ It is also moot today: page visibility is wired to NOTHING — the
 * nav never reads `org_page_visibility` (see `manageNavGroups()` in
 * AppLayout.tsx, whose `visible()` filter checks only modules and `adminOnly`).
 * Reported by TASK-FIX3, its own thread.
 *
 * A hub page's own link cards are NOT filtered by visibility — a hub the owner
 * kept still lists a child he put away, and clicking it works. The task rules
 * that in-app links to hidden pages are reported, not fixed.
 */

/** The permanent nav group a page's row belongs in — its home, not necessarily
 *  where it renders today (see PARKED_IN_REVIEW below). */
export type PageGroup = 'app_pages' | 'management' | 'accounts' | 'community' | 'modules' | 'settings';

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

/** ⚠️ NOT DEAD CODE, WHATEVER FOUR DOCUMENTS SAY. Until TASK-AR4 checked, the
 *  standing rule in `docs/tasks/ADMIN-REVIEW-ANALYSIS-STANDARD.md` §5 was that
 *  this map "is exported and read by NOTHING". It is read by `pageSections()`
 *  below, which `AdminPageVisibilityPage.tsx` renders as the visible section
 *  headings on /app/ops/admin/pages. ⚠️ THIS AND THE `label:` FIELDS IN
 *  `manageNavGroups()` (AppLayout.tsx) ARE ONE FACT WRITTEN TWICE. Change one
 *  and you must change the other, or the page whose entire job is to describe
 *  the staff menu will describe a menu that no longer exists.
 *
 *  TASK-FIX3 (owner, 2026-08-31): `community` reads "Admin" and `settings` no
 *  longer names a section of the rail — its pages are rows inside Admin now.
 *  The KEYS are untouched on purpose: they are the first half of every stored
 *  `page_key` in `org_page_visibility`, CHECK-constrained to `group.page`.
 *
 *  TASK-CR85 (owner, 2026-08-31): the menu is THREE sections — Community,
 *  Management, Admin — and `accounts` joins `settings` as a key that names no
 *  section any more. ⚠️ `app_pages` is NEW, and it is the Community section:
 *  the underscore is the DB grammar's (`^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`
 *  rejects the hyphen), while the nav's own group key is `app-pages`, which it
 *  has been since UIO-012 and which keys the section's collapse state. Two
 *  spellings of one section, deliberately, because neither side can take the
 *  other's: `community` was already taken by Admin (see PAGE_REGISTRY) and the
 *  hyphen cannot be stored. */
export const GROUP_LABEL: Record<PageGroup, string> = {
  app_pages: 'Community',
  management: 'Management',
  /* Kept for the same reason `settings` is, below: `PageGroup` is a closed
     union and this string reaches no surface today. TASK-CR85 dissolved the
     People section into Community — both its rows carry `group: 'app_pages'`
     now, so `pageSections()` finds nothing to file under this label. */
  accounts: 'People',
  community: 'Admin',
  modules: 'Modules',
  /* Kept because five registry rows still carry `group: 'settings'` and their
     keys cannot move (see above). It renders as a section heading on
     /app/ops/admin/pages only — `pageSections()` files those five under Admin
     now, so this string reaches no surface today. Left in place rather than
     deleted because `PageGroup` is a closed union and the keys outlive it. */
  settings: 'Settings',
};

/**
 * The staff pages a tenant may hide, in nav order.
 *
 * ⚠️ This heading used to read "EVERY staff page with a nav row of its own".
 * It is not that, and was not on the day it was written — 12 of the 32 rows
 * below have no nav row at all (see THE HUB / CHILD RULE above).
 *
 * Not listed, deliberately:
 *  - the six `core.*` modules — substrate (tenancy, roles, contracts, payments,
 *    registry, branding), not user-facing surfaces;
 *  - the platform rail (Organizations / Feature flags / Registry) — SUPER_ADMIN
 *    surfaces belonging to no tenant, so no tenant hides them;
 *  - the Review rows themselves — nav position IS their status, and hiding one
 *    would falsify the acceptance signal. The real pages behind them ARE here,
 *    under their permanent homes;
 *
 * ⚠️ THE APP-PAGES EXCLUSION IS GONE (TASK-CR85, 2026-08-31). This list used to
 * end with "the App-pages block — Catalog and Messages, hand-written JSX in
 * `StaffNavItems` rather than a NavItem table, so they have no row to filter".
 * `StaffNavItems` no longer exists: CR-85 promoted that block into a real nav
 * group, so both pages are NavItems in `COMMUNITY_PAGES_GROUP` (AppLayout.tsx)
 * and both have rows here — `app_pages.catalog` and `app_pages.messages`. The
 * only nav rows left with no registry row are the community FEED and its filter
 * children, which are one page (/app) under one component, not a table.
 */
export const PAGE_REGISTRY: PageEntry[] = [
  // ── Community (group key `app_pages`; see GROUP_LABEL) ────────────────────
  /* TASK-CR85 (owner, 2026-08-31): *"catalog and messages belong in community.
     the only reason i have catalog view and why its in the community section is
     because that is what the community sees. conversely i have a separate
     surface for editing the catalog contents in the admin section."*

     ⚠️ THE VIEW AND THE EDITOR ARE TWO PAGES, ON PURPOSE. `app_pages.catalog`
     is what the community sees; `settings.products` (below, in Admin) is where
     its contents are edited. Neither is a duplicate of the other and neither
     may be tidied into the other.

     THEIR FIRST REGISTRY ROWS. Both have been routed pages since Phase 6 with
     hand-written nav entries inside `StaffNavItems` and no registry presence at
     all — the same D17 shape Calendar was in until TASK-FIX3. They are NavItems
     in COMMUNITY_PAGES_GROUP (AppLayout.tsx) now, so the tenant can hide them
     like every other row. ⚠️ WITH ONE CAVEAT THAT APPLIES TO EVERY ROW HERE:
     hiding still removes nothing, because the nav never reads
     `org_page_visibility` (see "WHAT HIDING MEANS" above — reported by
     TASK-FIX3, TASK-AR3 and TASK-AR4, and its own thread). */
  { key: 'app_pages.catalog', path: '/app/catalog', label: 'Catalog', group: 'app_pages' },
  { key: 'app_pages.messages', path: '/app/messages', label: 'Messages', group: 'app_pages' },
  /* TASK-RECORDS (2026-08-12): people.leads / people.clients / people.directory
     retired as three keys — Leads, Clients and Directory (split into Partners
     and Vendors) are tabs on ONE page now, not three nav rows. Horses, Lessons,
     Documents, Files and Deals joined them the same way later (2026-08-15) —
     one key covers every tab, because hiding operates on the nav row and there
     is only one.

     TASK-FIX3 (owner, 2026-08-31): one row became two, which put a "People"
     heading back in the rail.
     ⚠️ TASK-CR85 (owner, 2026-08-31) took that heading away again — *"we could
     move people into community and then remove that as a standalone section"*.
     ONLY `group` moved. ⚠️ BOTH KEYS STAY `people.*`: they are stored in
     `org_page_visibility` and this file's header forbids re-deriving a key from
     anything, its group included. A tenant that hid Contacts still has it
     hidden after the move. */
  { key: 'people.records', path: '/app/records', label: 'Contacts', group: 'app_pages' },
  /* The horses. The name was settled by the owner on 2026-08-08
     (docs/reference/nav-icon-exercise.md): "Rename it Stable, which also
     matches the member-side term already in use (My Stable)."
     ⚠️ It points at the Horses TAB, not at /app/stable — TASK-AR3 F3 measured
     /app/stable returning 0 of the tenant's 3 horses for staff, because it
     reads the member-scoped my_stable_horses(). Mounting the staff roster there
     needs RecordsPage.tsx, which TASK-FIX2 owns. */
  { key: 'people.stable', path: '/app/records/horses', label: 'Stable', group: 'app_pages' },

  // ── Management ───────────────────────────────────────────────────────────
  { key: 'mgmt.dashboard', path: '/app/dashboard', label: 'Dashboard', group: 'management' },
  /* TASK-FIX3 (owner, 2026-08-31) — Calendar's FIRST registry row. It has been
     a routed page since Phase 6 with a hand-written nav entry inside
     `StaffNavItems` and no registry presence at all, so the tenant could not
     hide it and this file's own header claim to list "EVERY staff page with a
     nav row of its own" was false. It is a NavItem in MANAGEMENT_GROUP now. */
  { key: 'mgmt.calendar', path: '/app/calendar', label: 'Calendar', group: 'management' },
  { key: 'mgmt.support', path: '/app/ops/support', label: 'Support', group: 'management' },
  { key: 'mgmt.payments_review', path: '/app/ops/payments/review', label: 'Payment review', group: 'management' },
  /* MOVED 2026-08-31 (TASK-FIX3): Evaluations left the Community/Admin section
     for Management. ⚠️ The KEY stays `community.evaluations` — it is stored in
     `org_page_visibility` and this file's header is explicit that a key never
     follows its page. Only `group` moved. */
  { key: 'community.evaluations', path: '/app/ops/evaluations', label: 'Evaluations', group: 'management' },
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


  // ── Admin (group key `community`; see GROUP_LABEL) ────────────────────────
  /* RETIRED 2026-08-31 (owner): `community.activity` (/app/ops/activity) and
     `community.oversight` (/app/ops/oversight). Both pages are gone — route,
     component, nav row and dashboard zone. ⚠️ Not "empty and therefore
     unfinished": full, and saying nothing. The reasoning, and the conditions
     under which an activity log earns a surface again, are written down in
     docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md.
     `community.evaluations` moved up to Management, above.
     Orphan `org_page_visibility` rows for the two retired keys are harmless —
     nothing reads a key the registry no longer lists (this file's header). */
  { key: 'community.moderation', path: '/app/ops/moderation', label: 'Moderation', group: 'community' },
  { key: 'community.lookups', path: '/app/ops/lookups', label: 'Field options', group: 'community' },
  { key: 'community.content', path: '/app/ops/content', label: 'Content store', group: 'community' },

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
  /* TASK-SURFACEEDITOR (2026-08-26) — Forms, Menus and Templates were three
     nav rows over one job. They are one row now: the Editor, which opens each
     surface as it appears. Their routes still resolve (D32) and nothing links
     to them, so their registry rows go — a hidden-page row for a page with no
     nav entry has nothing to hide. Orphan org_page_visibility rows for
     settings.forms / settings.menus are harmless: nothing reads a key the
     registry no longer lists. */
  { key: 'settings.editor', path: '/app/ops/admin/editor', label: 'Editor', group: 'settings' },
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

  /* TASK-FIX3: `settings` is no longer a section of the staff menu — its pages
     are rows inside Admin. ⚠️ The five `group: 'settings'` rows keep their
     stored keys, so they are folded into the Admin section HERE rather than by
     rewriting their `group` field, which would break the `group.page` grammar
     the database CHECK enforces on `page_key`. This page describes the menu; the
     menu has four sections; so does this. */
  /* TASK-CR85: three sections, in the order the rail renders them — Community,
     Management, Admin — then Modules, which is not a rail section but is where
     the module children are listed for hiding. `accounts` is NOT in this list:
     its two rows carry `group: 'app_pages'` now, so the People section has
     nothing left to render and listing it would print an empty heading. */
  const groupOrder: PageGroup[] = ['app_pages', 'management', 'community', 'modules'];
  const FOLDED_INTO: Partial<Record<PageGroup, PageGroup>> = { settings: 'community' };
  for (const g of groupOrder) {
    const pages = PAGE_REGISTRY.filter(
      (p) => (FOLDED_INTO[p.group] ?? p.group) === g && !p.module,
    );
    if (pages.length === 0) continue;
    sections.push({ id: `group:${g}`, label: GROUP_LABEL[g], pages });
  }

  return sections;
}
