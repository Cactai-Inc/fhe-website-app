import { FlaskConical } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
 * THE REVIEW SECTION — what it is, who asked for it, and how it ends
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Owner, 2026-08-11: *"have the nav menu on admin on desktop create a section
 * for Review: and lets use it while we audit and work on pages… we need to find
 * all duplicates in the code, wire them up and make them visible for A/B,
 * A/B/C, or A/B/C/D review by placing them side-by-side."*
 *
 * Owner, 2026-08-12 (the addendum that decides the shape of this file):
 * *"any new pages go here too for review before confirmation and acceptance
 * that they are done and ready for use (then they move to their new home)…
 * once its moved out of the review section its deemed done."*
 *
 * SO: NAV POSITION IS THE STATUS. A page sits in Review until the owner accepts
 * it. Moving it out is the acceptance signal — there is no other one. This is
 * NOT scaffolding awaiting a demolition date; it EMPTIES OUT, one entry at a
 * time, and the last removal is whenever the last thing is accepted.
 *
 * ── ADDING A PAGE (this is the mechanism; it is one line) ───────────────────
 * Built a new page? Add an entry to REVIEW_GROUPS below — a new group if it is
 * a new concept, or a slot on an existing one if it is another take on an
 * existing concept. That is the whole job: the nav rows, the index page at
 * /app/ops/review, and the origin map all derive from this array.
 *
 * ── ACCEPTING A PAGE (the operation that actually runs, repeatedly) ─────────
 * 1. Delete its entry object here.
 * 2. If `origin.moved` is true, put its nav row BACK where `origin.where` says
 *    (or wherever the re-bucketing decides) in AppLayout.tsx.
 * 3. If its route is under /app/ops/review/, delete that route from App.tsx and
 *    the wrapper in pages/app/ops/review/.
 * Nothing else references any of this.
 *
 * ── REMOVING THE WHOLE THING ────────────────────────────────────────────────
 * When REVIEW_GROUPS is empty: delete this file, delete
 * src/pages/app/ops/review/, delete the five `ops/review*` routes in App.tsx,
 * and delete the four blocks in AppLayout.tsx marked `REVIEW SECTION`.
 *
 * ── WHAT THIS TASK DID NOT DO, DELIBERATELY ─────────────────────────────────
 * Not one reviewed page was modified. No retirement constant was flipped —
 * CONTACTS_PAGE_RETIRED and INTAKE_PAGE_RETIRED are both still `true` and both
 * pages are still retired for every user; the two components are MOUNTED at
 * review-only routes instead, which puts them in front of the owner without
 * putting them back in the app.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Where a link lived before Review, and whether this task actually took it. */
export interface ReviewOrigin {
  /** The exact place to put it back on acceptance. */
  where: string;
  /** true  = REMOVED from there and now lives only in Review (the owner's rule:
   *          move, don't copy — two entries for one page is the problem itself).
   *  false = still in its original place, with the reason on `why`. */
  moved: boolean;
  why?: string;
}

export interface ReviewEntry {
  slot: 'A' | 'B' | 'C' | 'D';
  /** Nav label. Says the concept, the slot, and whether it is the incumbent —
   *  the owner is comparing these minutes apart and the URLs do not say. */
  label: string;
  /** Route. Real production ids where a route needs one, so A and B are
   *  compared on the same record. */
  to: string;
  /** One line for the index page: what this implementation actually is. */
  what: string;
  /** The one currently in use. Exactly one per group. */
  incumbent?: boolean;
  origin?: ReviewOrigin;
  /** Anything that would otherwise be reported as a broken review link. */
  warn?: string;
  /** false = shown on the index page but NOT given its own nav row, because it
   *  is the same URL as another slot. Two nav rows for one URL is the exact
   *  ambiguity this section exists to remove. */
  navRow?: false;
}

export interface ReviewGroup {
  key: string;
  /** The concept these are all implementations of. */
  title: string;
  /** The question the owner is answering by clicking through them. */
  question: string;
  entries: ReviewEntry[];
}

/** Input: the manifest at the end of docs/reports/TASK-DUPECENSUS-REPORT.md,
 *  re-derived against main at 7a6dec5 (route table, nav arrays, retirement
 *  constants and the production ids were all re-checked, per that report's own
 *  warning that it goes stale within hours). */
export const REVIEW_GROUPS: ReviewGroup[] = [
  /* ACCEPTED 2026-08-15 (TASK-PAGEMERGE) — 'horses' group removed. All three
     slots now redirect into the Records page's Horses tab (HORSE_RECORDS_
     STANDALONE_RETIRED, HORSES_PAGE_RETIRED, RECORDS_HUB_RETIRED), so the
     comparison this group asked for is moot on production. Slot B's breed/
     colour lookup and slot C's Ownership/Health lane links were harvested
     into HorseRecordsPage (the surviving component) before this entry was
     deleted, per the "delete its entry object" acceptance step above. */
  {
    key: 'staff-home',
    title: 'Staff landing page',
    question: 'Where should a staff member land when they sign in?',
    entries: [
      {
        slot: 'A', label: 'Staff home A · in use', to: '/app/dashboard', incumbent: true,
        what: 'DashboardHome. The one in use — priority actions, notifications, and the leads band. Also holds Inbound slot A below.',
        origin: { where: 'AppLayout MANAGEMENT_GROUP — "Dashboard", icon LayoutDashboard (it carries the injected unread+inbound badge; that follows the row, see AppLayout navGroups)', moved: true },
      },
      {
        slot: 'B', label: 'Staff home B · OpsDashboard', to: '/app/ops',
        what: 'OpsHome → OpsDashboard, the 2026-07-01 original. Per-tile error branches and no arbitrary Tailwind values. Also holds Inbound slot D below.',
      },
      {
        slot: 'C', label: 'Staff home C · Instructor preview', to: '/app/ops/preview/instructor-home',
        what: 'InstructorHome, behind the preview banner ADMINSWEEP built for exactly this comparison.',
        warn: 'Renders only via this preview — no production account has the non-admin staff role, so it can never be seen any other way. Its data is yours, not a trainer’s.',
      },
    ],
  },
  {
    key: 'inbound',
    title: 'Inbound work waiting',
    question: 'Four surfaces counted the same inbound work and disagreed. They now all read inbound_open_count() (TASK-COUNTFIX 1.1) — which one is the queue?',
    entries: [
      {
        slot: 'A', label: 'Inbound A', to: '/app/dashboard', incumbent: true, navRow: false,
        what: 'The dashboard’s leads band + LeadWorkDrawer — the same URL as Staff home A above, so it has no second nav row.',
      },
      {
        slot: 'B', label: 'Inbound B · retired queue', to: '/app/ops/review/intake',
        what: 'IntakePage, the 2026-07-01 flat queue, retired 2026-08-12 by TASK-LEADCLEAN.',
        warn: 'RETIRED and STILL RETIRED: INTAKE_PAGE_RETIRED is untouched at `true`, so /app/ops/intake still redirects for everyone. This review route mounts the component behind a banner instead of putting the page back in the app.',
      },
      {
        slot: 'C', label: 'Inbound C · lead drawer', to: '/app/dashboard?request=9e6ec09c-ef9b-467c-bd84-3c2b2a259a02',
        what: 'The deep-workflow surface: one lead’s drawer, opened by the ?request= param LEADCLEAN repointed here. Marissa Robertson’s request — deliberately not Kit Garcin’s, which TASK-LEADCLEAN reserves.',
        warn: 'Shares /app/dashboard with slot A, so both rows highlight as active while you are on the dashboard.',
      },
      {
        slot: 'D', label: 'Inbound D', to: '/app/ops', navRow: false,
        what: 'The Ops KPI tile, now "Inbound work waiting" — TASK-COUNTFIX 1.1 moved it onto inbound_open_count(), the badge and band\u2019s own definition, so it agrees with them instead of counting seven already-converted leads. Same URL as Staff home B.',
      },
    ],
  },
  {
    key: 'people',
    title: 'People (and horse) roster',
    question: 'The composed Records page vs. the one retired original it absorbed part of. Which is the people page?',
    /* RESOLVED 2026-08-12 by TASK-RECORDS, exactly as this group's own slot-A
       warning anticipated: "if it has landed now, this group collapses to the
       composed page vs slot B." Slots A/C/D (Clients, Leads, Directory) do not
       reappear as three separate entries — they are three of Records' five
       tabs now (the other two are Partners, split out of Directory, and
       Horses). Slot B is untouched: it was ADDED, not moved, and stays the
       retired 07-01 comparison point. */
    entries: [
      {
        slot: 'A', label: 'People A · Records (in use)', to: '/app/records', incumbent: true,
        what: 'RecordsPage — Leads / Clients / Partners / Vendors / Horses, one tab strip over independent renderers (TASK-RECORDS). Composes Admin (Clients) and ContactDirectory (Leads/Partners/Vendors/All) unchanged, plus HorseRecordsPage as a fifth peer tab.',
        origin: { where: 'AppLayout ACCOUNTS_GROUP — one row, "Records", icon BookOpen (replaces the three-row Clients/Leads/Directory origin below)', moved: true },
      },
      {
        slot: 'B', label: 'People B · retired directory', to: '/app/ops/review/contacts',
        what: 'ContactDirectory in "contacts" mode — the 2026-07-01 original, retired 2026-08-10 when the Clients page won.',
        warn: 'RETIRED and STILL RETIRED: CONTACTS_PAGE_RETIRED is untouched at `true`, so /app/ops/contacts still redirects to /app/records/clients (the redirect target moved with the Clients tab; the constant did not change). This review route mounts the component behind a banner. Its nav row was removed on 2026-08-12, so there was nothing to move — this one was ADDED.',
      },
    ],
  },
  {
    key: 'contact-editor',
    title: 'Contact editor',
    question: 'Two editors open from the same page and write through different paths. Which one edits a person?',
    entries: [
      {
        slot: 'A', label: 'Contact editor A · dossier (in use)', to: '/app/ops/review/contact-dossier', incumbent: true,
        what: 'ContactDossierModal — 30 fields across five groups, tabbed, saves field by field.',
        warn: 'Mounted on a REAL production contact and its saves are REAL — it is the live editor, not a copy. Look; do not type.',
      },
      {
        slot: 'B', label: 'Contact editor B · 4-field form', to: '/app/ops/review/contact-form',
        what: 'ContactForm — the 2026-07-01 original: 4 fields, FormField primitives, real inline validation.',
        warn: 'Submit is inert on this review mount only (the component is unmodified; the review page passes a handler that refuses). Its real create path (ContactsPage.tsx\'s `save`) FIXED 2026-08-15 (TASK-PAGEMERGE): a create now sets contact_type via the same setContactType RPC the Unfiled filing control uses, so a contact made from Leads lands on Leads. This group stays open — the bigger consolidation DUPECENSUS recommended (retire ContactForm, rebuild its create path on ContactDossierModal\'s update_contact_record RPC) was not attempted.',
      },
    ],
  },
  /* ACCEPTED 2026-08-15 (TASK-PAGEMERGE) — 'account' group removed. Slot B's
     one real capability, <TwoFactorSettings/>, was unreachable for every real
     member (it redirected them away before rendering) — ported into
     AccountHub's My Login section (LoginSecurityCard.tsx) before /account was
     flagged ACCOUNT_PAGE_RETIRED and pointed at /app. */
  {
    key: 'time',
    title: 'Member time surface',
    question: 'Two time surfaces; the nav points at one and the dashboard links to the other.',
    entries: [
      {
        slot: 'A', label: 'Time A · Calendar (in use)', to: '/app/calendar', incumbent: true,
        what: 'CalendarPage — the full calendar that absorbed booking and availability.',
        origin: { where: 'AppLayout StaffNavItems — "Calendar", icon CalendarDays (the App-pages block above the groups)', moved: true },
      },
      {
        slot: 'B', label: 'Time B · Schedule', to: '/app/schedule',
        what: 'Schedule, the 2026-06-23 original. Routed; no nav entry has pointed here for weeks.',
      },
    ],
  },
  {
    key: 'catalog',
    title: 'Catalog',
    question: 'Two renderers, four entry points, three different counts (27 / 24 / 0).',
    entries: [
      {
        slot: 'A', label: 'Catalog A · in-app (in use)', to: '/app/catalog', incumbent: true,
        what: 'OfferingCatalog in the app — the newer renderer, and the one case where the replacement beats the original on every marker but accessibility.',
        origin: { where: 'AppLayout StaffNavItems — "Catalog", icon ShoppingBag', moved: true },
      },
      {
        slot: 'B', label: 'Catalog B · public shop', to: '/shop',
        what: 'The same OfferingCatalog on the public site. Same renderer, different chrome and different count.',
        origin: {
          where: 'site footer — "Ways to Ride" AND "Book a Lesson", Footer.tsx:37-38, two links to this one page',
          moved: false,
          why: 'Public marketing nav, not the admin app nav. Removing it would change the live public site, which this task is not allowed to do. The two-links-one-page defect is recorded, not fixed.',
        },
      },
      {
        slot: 'C', label: 'Catalog C · horse funnel', to: '/horse',
        what: 'ServiceSelector, the 2026-07-01 renderer, on the horse-care funnel.',
        origin: { where: 'marketing header — "Horse Care Services" (Header.tsx:36) + footer "Horse Care"', moved: false, why: 'Public marketing nav — same reason as B.' },
      },
      {
        slot: 'D', label: 'Catalog D · acquisition (empty)', to: '/acquisition',
        what: 'The same ServiceSelector on the acquisition funnel.',
        origin: { where: 'marketing header — "Find a Horse" (Header.tsx:37) + footer "Acquisition Support"', moved: false, why: 'Public marketing nav — same reason as B.' },
        warn: 'Renders ZERO offerings: all three acquisition SKUs have price_amount = NULL and the reader filters them out. A page in the marketing site’s primary nav that cannot be completed — the finding, not a broken review link.',
      },
    ],
  },
  {
    key: 'document',
    title: 'Document viewer + body renderer',
    question: 'Which viewer do we keep — and which of the three body renderers is the renderer?',
    entries: [
      {
        slot: 'A', label: 'Document A · authoring (in use)', to: '/app/contracts/704c8d2d-d179-43f9-8a4a-7ea8cb920ab9', incumbent: true,
        what: 'ContractPage, the authoring view, rendering its body through ContractBody (body renderer slot A — NEEDS: marks and span-select).',
        warn: 'DOC-J7NXZDHD5F — deliberately the one document carrying a NEEDS: mark, so A and B differ on the thing that matters.',
      },
      {
        slot: 'B', label: 'Document B · read-only view', to: '/app/ops/documents/704c8d2d-d179-43f9-8a4a-7ea8cb920ab9',
        what: 'DocumentViewerPage, the 2026-07-01 read-only viewer, rendering the SAME document through MergedBodyView (body renderer slot B).',
      },
      {
        slot: 'C', label: 'Body C · the PDF renderer', to: '', navRow: false,
        what: 'src/lib/documentPdf.ts — a third implementation of the same plain-text body regex, and the third one that disagrees with the other two.',
        warn: 'NOT MOUNTED. It is a non-React PDF writer with no component and no route; nothing was invented to give it one. To compare it, email or download a signed copy of the same document.',
      },
    ],
  },
  {
    key: 'signing',
    title: 'Signature capture',
    question: 'Five capture surfaces, three writers. Which is the signing surface?',
    entries: [
      {
        slot: 'A', label: 'Signing A · contract (in use)', to: '/app/contracts/e1052bae-c20c-47e3-8703-7ef64f2bf852', incumbent: true,
        what: 'The contract page’s own signing block, on DOC-EP8HFFEV74 — an AWAITING_SIGNATURE lease, so the block actually renders.',
      },
      {
        slot: 'B', label: 'Signing B · member self-sign', to: '/app/documents',
        what: 'The member’s document list: an inline typed-name input in the row.',
        warn: 'This nav row is hidden for staff in the normal app (useNavPresence(!isStaff)) — the Review row is the only way you can reach it.',
      },
      {
        slot: 'C', label: 'Signing C · onboarding', to: '/app/onboarding',
        what: 'The onboarding flow’s signing step.',
        warn: 'Renders its signing step only for an account with pending onboarding documents. On a staff account you will see the flow, not the step.',
      },
      {
        slot: 'D', label: 'Signing D · public kiosk ⚠', to: '/release',
        what: 'The public kiosk release — the visit-day surface.',
        warn: 'DESTRUCTIVE. This signs a REAL document. Look at it; do not complete it.',
      },
    ],
  },
  {
    key: 'staff-roster',
    title: 'Staff roster',
    question: 'Who works here — one page or two?',
    entries: [
      {
        slot: 'A', label: 'Staff roster A · Team (in use)', to: '/app/ops/team', incumbent: true,
        what: 'TeamPage — roles, suspension, staff invitations, instructor grants.',
        origin: { where: 'AppLayout SETTINGS_GROUP — "Team", icon UserRound, deliberately NOT adminOnly (the route is requireStaff)', moved: true },
      },
      {
        slot: 'B', label: 'Staff roster B · employees module', to: '/app/ops/employees/staff',
        what: 'StaffPage — the employees module’s own roster. Owns title and pay type, which TeamPage does not.',
        warn: 'mod.employees is DISABLED for FHE, so this renders ModuleGate’s locked fallback. Enabling the module in org_modules is the only way to see the page, and nothing here does that.',
      },
    ],
  },
  /* ACCEPTED 2026-08-15 (TASK-PAGEMERGE) — 'templates' group removed.
     AdminTemplatesPage was never a duplicate — it just had nowhere permanent
     to live once Review's nav group went. It now has the SETTINGS_GROUP row
     this entry's own `what` said it was owed. */
];

/** The one sentence the section has to say about itself, per the owner's rule
 *  that leaving Review IS the acceptance signal. Shown under the nav heading
 *  and at the top of the index page. */
export const REVIEW_NOTE = 'Temporary. A page stays here until you accept it — moving it out of Review means done.';

/** Every review destination, in walkthrough order, as nav rows.
 *  One row per distinct URL (see ReviewEntry.navRow). One icon for all of them,
 *  deliberately: the labels carry the identity, and a block of identical glyphs
 *  reads as one temporary section rather than as new permanent surfaces. */
export const REVIEW_NAV_ITEMS: { to: string; label: string; icon: typeof FlaskConical; adminOnly: true }[] = [
  { to: '/app/ops/review', label: 'How to use Review', icon: FlaskConical, adminOnly: true },
  ...REVIEW_GROUPS.flatMap((g) => g.entries
    .filter((e) => e.navRow !== false)
    .map((e) => ({ to: e.to, label: e.label, icon: FlaskConical, adminOnly: true as const }))),
];
