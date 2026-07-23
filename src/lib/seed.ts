/* Preview seed data (temporary). Gives every surface something to render on the
 * GitHub preview before the RPCs/migrations are wired end-to-end. All exports are
 * plain data; pages import these as a fallback when a live query returns empty.
 * DELETE THIS FILE once the backing RPCs return real rows. Nothing here writes to
 * the database — it is display-only sample content.
 *
 * A single flag (SEED_ENABLED) gates all fallbacks so this can be turned off in one
 * place. It is on by default for the preview. */

export const SEED_ENABLED = false;

/** The single view/filter taxonomy for the community feed. Order is the dropdown
 *  order the product locked: Social, Discussions, For Sale, Events, Articles,
 *  Resources, Members — with All as the default combined view. */
export type FeedView =
  | 'all' | 'social' | 'discussions' | 'for_sale' | 'events' | 'articles' | 'resources' | 'members';

export const FEED_VIEWS: { key: FeedView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'social', label: 'Social' },
  { key: 'discussions', label: 'Discussions' },
  { key: 'for_sale', label: 'For Sale' },
  { key: 'events', label: 'Events' },
  { key: 'articles', label: 'Articles' },
  { key: 'resources', label: 'Resources' },
  { key: 'members', label: 'Members' },
];

/** Per-view header copy. The community feed is ONE stream of categorized posts;
 *  each "view" is just that stream filtered to one category. The nav nests these
 *  under "Community Feed" as indented links, and the page header swaps to the
 *  matching title + blurb so each filter reads like its own place. `navLabel` is
 *  what the nested nav link shows (e.g. "All posts" for the combined view). */
export const FEED_VIEW_META: Record<FeedView, { title: string; navLabel: string; description: string }> = {
  all:         { title: 'Community Feed', navLabel: 'All posts',   description: 'Everything from the barn and community, newest first.' },
  social:      { title: 'Social',         navLabel: 'Social',      description: 'Photos, updates, and moments members are sharing.' },
  discussions: { title: 'Discussions',    navLabel: 'Discussions', description: 'Questions and conversations — jump in or start your own.' },
  for_sale:    { title: 'For Sale',       navLabel: 'For Sale',    description: 'Horses and gear listed by the barn and members.' },
  events:      { title: 'Events',         navLabel: 'Events',      description: 'Clinics, shows, and gatherings — RSVP to save your spot.' },
  articles:    { title: 'Articles',       navLabel: 'Articles',    description: 'Guides and reading from French Heritage.' },
  resources:   { title: 'Resources',      navLabel: 'Resources',   description: 'Trusted vets, farriers, and suppliers members recommend.' },
  members:     { title: 'Members',        navLabel: 'Members',     description: 'Meet the community — say hi, or send a message.' },
};

// ─── Feed items ─────────────────────────────────────────────────
export type SeedCardKind =
  | 'social' | 'discussion' | 'for_sale' | 'event' | 'article' | 'resource'
  | 'member_announce' | 'resource_announce';

export interface SeedFeedItem {
  id: string;
  kind: SeedCardKind;
  view: FeedView;               // which filter it belongs to
  author: string;               // display name or "French Heritage"
  authorInitials: string;
  timeAgo: string;
  title?: string;
  body?: string;
  mediaTint?: boolean;          // render the media placeholder block
  // for_sale
  saleKind?: 'horse' | 'gear' | 'free';
  saleTag?: string;             // "Lease" | "Sale" | "Gear" | "Free"
  price?: string;               // "Inquire" | "$2,400" | "Free"
  // discussion
  replies?: number;
  // article
  audience?: string;
  readMins?: number;
  // event
  when?: string;
}

export const SEED_FEED: SeedFeedItem[] = [
  { id: 'f1', kind: 'for_sale', view: 'for_sale', saleKind: 'horse', saleTag: 'Lease', price: 'Inquire',
    author: 'French Heritage', authorInitials: 'FH', timeAgo: '2h ago', mediaTint: true,
    title: 'Bruno — 16.1hh Warmblood', body: 'A generous, push-ride hunter with an even temperament.' },
  { id: 'f2', kind: 'member_announce', view: 'members', author: 'Jane Whitfield', authorInitials: 'JW',
    timeAgo: 'Joined today', title: 'Welcome, Jane Whitfield', body: 'Amateur rider, just moved to North County.' },
  { id: 'f3', kind: 'discussion', view: 'discussions', author: 'Élise C.', authorInitials: 'EC', timeAgo: '2h ago',
    title: 'Best farrier in North County?', body: 'Looking for recommendations for my new mare…', replies: 4 },
  { id: 'f4', kind: 'social', view: 'social', author: 'Sofia R.', authorInitials: 'SR', timeAgo: '3h ago',
    mediaTint: true, body: 'Golden hour hack down to the beach. Never gets old.' },
  { id: 'f5', kind: 'article', view: 'articles', author: 'French Heritage', authorInitials: 'FH', timeAgo: 'Yesterday',
    title: 'Preparing for your first show', body: 'What to pack, when to arrive, and how to keep your nerves in check.',
    audience: 'New riders', readMins: 6, mediaTint: true },
  { id: 'f6', kind: 'resource_announce', view: 'resources', author: 'French Heritage', authorInitials: '＋',
    timeAgo: 'Added yesterday', title: 'Coastal Equine Vet', body: 'Full-service equine care now listed in Resources.' },
  { id: 'f7', kind: 'event', view: 'events', author: 'French Heritage', authorInitials: 'FH', timeAgo: '1d ago',
    title: 'Summer schooling show', body: 'Open to all levels. Ribbons through 6th.', when: 'Jul 14 · 9:00 AM', mediaTint: true },
  { id: 'f8', kind: 'social', view: 'social', author: 'Margaux C.', authorInitials: 'MC', timeAgo: '5h ago',
    mediaTint: true, body: 'First clean round over 1.10m today. Over the moon with this horse.' },
  { id: 'f9', kind: 'discussion', view: 'discussions', author: 'Sofia R.', authorInitials: 'SR', timeAgo: '1d ago',
    title: 'Clipping tips for a nervous gelding?', body: 'He is fine until the clippers get near his ears…', replies: 7 },
];

// For Sale detail (grid)
export interface SeedListing {
  id: string; saleKind: 'horse' | 'gear' | 'free'; tag: string; price?: string; title: string; sub?: string;
}
export const SEED_LISTINGS: SeedListing[] = [
  { id: 'l1', saleKind: 'horse', tag: 'Lease', price: 'Inquire', title: 'Bruno — 16.1hh', sub: 'Warmblood gelding' },
  { id: 'l2', saleKind: 'horse', tag: 'Sale', title: 'Grey mare 15.3hh', sub: 'Amateur-friendly' },
  { id: 'l3', saleKind: 'gear', tag: 'Gear', price: '$2,400', title: 'Antares saddle', sub: '17.5" medium tree' },
  { id: 'l4', saleKind: 'free', tag: 'Free', price: 'Free', title: 'Jump standards', sub: 'Pair · you haul' },
  { id: 'l5', saleKind: 'gear', tag: 'Gear', price: '$180', title: 'Half-chaps', sub: 'New · medium' },
  { id: 'l6', saleKind: 'horse', tag: 'Sale', title: 'Bay gelding 16.2hh', sub: 'Eq prospect' },
];

// Articles (reading list)
export interface SeedArticle { id: string; title: string; excerpt: string; audience: string; mins: number; }
export const SEED_ARTICLES: SeedArticle[] = [
  { id: 'a1', title: 'Preparing for your first schooling show', excerpt: 'What to pack, when to arrive, and how to keep your nerves in check on the day.', audience: 'New riders', mins: 6 },
  { id: 'a2', title: 'Building an independent seat', excerpt: 'Exercises to develop balance without relying on the reins.', audience: 'General', mins: 4 },
  { id: 'a3', title: 'Reading a course walk like a pro', excerpt: 'Striding, related distances, and where the time faults hide.', audience: 'Competition riders', mins: 8 },
  { id: 'a4', title: 'Winter turnout and blanketing', excerpt: 'A simple decision guide for coastal California owners.', audience: 'Horse owners', mins: 5 },
];

// Members (roster)
export interface SeedMember {
  id: string; name: string; role: string; initials: string;
  email?: string; mobile?: string; whatsapp?: string;
  // per-channel permissions (parity with live directory cards; undefined = allowed)
  allowSms?: boolean; allowCall?: boolean; allowWhatsapp?: boolean;
}
export const SEED_MEMBERS: SeedMember[] = [
  { id: 'm1', name: 'Élise Chastain', role: 'Instructor', initials: 'ÉC', email: 'elise@example.com', mobile: '+17605550142', whatsapp: '+17605550142' },
  { id: 'm2', name: 'Jane Whitfield', role: 'Rider · new', initials: 'JW', email: 'jane@example.com', mobile: '+17605550187' },
  { id: 'm3', name: 'Margaux Colbert', role: 'Rider', initials: 'MC', email: 'margaux@example.com', whatsapp: '+17605550163' },
  { id: 'm4', name: 'Sofia Ramos', role: 'Rider', initials: 'SR', email: 'sofia@example.com', mobile: '+17605550119' },
  { id: 'm5', name: 'Claire Fontaine', role: 'Rider', initials: 'CF', email: 'claire@example.com', mobile: '+17605550148' },
  { id: 'm6', name: 'Amélie Rousseau', role: 'Rider', initials: 'AR', email: 'amelie@example.com' },
];

// Resources (external listings directory)
export interface SeedResource {
  id: string; name: string; category: 'Vets' | 'Farriers' | 'Suppliers'; note: string;
  email?: string; mobile?: string; url?: string;
}
export const SEED_RESOURCES: SeedResource[] = [
  { id: 'r1', name: 'Coastal Equine Vet', category: 'Vets', note: 'Full-service equine care · Encinitas', mobile: '+17605550200', email: 'care@coastalequine.example' },
  { id: 'r2', name: 'North County Farrier Co.', category: 'Farriers', note: 'Hot & cold shoeing · corrective work', mobile: '+17605550211' },
  { id: 'r3', name: 'Del Mar Feed & Tack', category: 'Suppliers', note: 'Feed, supplements, tack · local pickup', url: 'https://example.com', mobile: '+17605550222' },
  { id: 'r4', name: 'Pacific Mobile Dentistry', category: 'Vets', note: 'Equine dental floats · mobile', email: 'book@pacdental.example' },
];

// ─── Dashboard (priority actions + coming up) ──────────────────
export interface SeedActionTile {
  id: string; kind: string; title: string; sub?: string; cta: string; gold?: boolean;
}
export const SEED_ATTENTION: SeedActionTile[] = [
  { id: 't1', kind: 'Approved · action', title: 'Lessons confirmed', sub: 'Sign & pay before the hold releases', cta: 'Complete', gold: true },
  { id: 't2', kind: 'Payment · 3 days', title: 'Membership renews Thu', sub: 'Review or update your method', cta: 'Review', gold: true },
  { id: 't3', kind: 'Invitation', title: 'Summer barn dinner', sub: 'Jul 20 · awaiting RSVP', cta: 'RSVP', gold: true },
];
export const SEED_COMING_UP: SeedActionTile[] = [
  { id: 'c1', kind: 'Next ride', title: 'Thu · 4:00 PM', sub: 'Lesson with Élise · Carmel Creek', cta: 'Add to calendar' },
  { id: 'c2', kind: 'Event', title: 'Schooling show', sub: 'Jul 14 · 9:00 AM', cta: 'RSVP' },
];

// ─── Calendar (everything with a date, RSVP or not) ────────────
export type SeedCalKind = 'lesson' | 'event' | 'payment' | 'expiration' | 'confirmation';
export interface SeedCalItem {
  id: string; date: string; kind: SeedCalKind; title: string; sub?: string;
}
// Dates are ISO (yyyy-mm-dd) relative to a fixed anchor month for the preview.
export const SEED_CALENDAR: SeedCalItem[] = [
  { id: 'k1', date: dateIn(0), kind: 'lesson', title: 'Lesson with Élise', sub: '4:00 PM · Carmel Creek' },
  { id: 'k2', date: dateIn(1), kind: 'payment', title: 'Membership renews', sub: '$340 · Zelle on file' },
  { id: 'k3', date: dateIn(3), kind: 'expiration', title: 'Lesson hold releases', sub: 'Sign & pay to keep your slot' },
  { id: 'k4', date: dateIn(5), kind: 'event', title: 'Summer schooling show', sub: '9:00 AM · open to all levels' },
  { id: 'k5', date: dateIn(7), kind: 'confirmation', title: 'Evaluation confirmed', sub: 'Bruno · in-hand assessment' },
  { id: 'k6', date: dateIn(11), kind: 'event', title: 'Summer barn dinner', sub: '6:30 PM · RSVP requested' },
  { id: 'k7', date: dateIn(14), kind: 'payment', title: 'Lesson package due', sub: '$600 · 8-ride package' },
];

/** yyyy-mm-dd for `days` from today (local). */
function dateIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Unseen counts (per view). Derived illustratively for the preview. ──
export const SEED_UNSEEN: Partial<Record<FeedView, number>> = {
  social: 4, discussions: 2, for_sale: 3, events: 1, articles: 5, resources: 1, members: 2,
};

// ─── My Stable ─────────────────────────────────────────────────
export interface SeedStableHorse {
  id: string; name: string; barnName?: string; breed: string; sex: string; height: string;
  age: string; color: string; discipline: string; ownership: 'Owned' | 'Leased'; location: string;
}
export const SEED_STABLE_HORSES: SeedStableHorse[] = [
  { id: 'h1', name: 'Bellefeuille', barnName: 'Bruno', breed: 'Holsteiner', sex: 'Gelding', height: '16.1hh',
    age: '11 yrs', color: 'Bay', discipline: 'Hunter', ownership: 'Leased', location: 'Carmel Creek Ranch' },
];
export interface SeedStableItem { id: string; name: string; detail?: string; vendor?: string; vendorUrl?: string; }
export const SEED_STABLE_GEAR: SeedStableItem[] = [
  { id: 'g1', name: 'Antares Evolution saddle', detail: '17.5" · medium tree', vendor: 'Antares Sellier', vendorUrl: '#' },
  { id: 'g2', name: 'Bridle — anatomic', detail: 'Full · black', vendor: 'Del Mar Feed & Tack', vendorUrl: '#' },
];
export const SEED_STABLE_SUPPLIES: SeedStableItem[] = [
  { id: 's1', name: 'Joint supplement', detail: 'Monthly · 1 scoop AM', vendor: 'SmartPak', vendorUrl: '#' },
  { id: 's2', name: 'Fly spray', detail: 'Restock each summer', vendor: 'Del Mar Feed & Tack', vendorUrl: '#' },
];

// ─── Billing / account rows ────────────────────────────────────
export const SEED_ACCOUNT = {
  name: 'Claire Fontaine',
  email: 'claire@example.com',
  membership: 'Monthly · active since Mar 2026',
  nextPayment: 'Jul 10 · $340',
  ordersCount: 3,
  postsCount: 8,
  listingsCount: 2,
};

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

// ─── Documents (render as paper) ───────────────────────────────
export interface SeedDocument {
  id: string; title: string; signedOn: string; kind: string; pages: string[];
  /** Full merged text of a REAL document (for PDF download); absent on seed rows. */
  body?: string;
}
export const SEED_DOCUMENTS: SeedDocument[] = [
  {
    id: 'doc1', title: 'Liability Release & Waiver', signedOn: 'Signed Mar 3, 2026', kind: 'Release',
    pages: [
      'RELEASE OF LIABILITY, WAIVER OF CLAIMS, AND ASSUMPTION OF RISK\n\nIn consideration of being permitted to participate in equestrian activities provided by French Heritage Equestrian ("the Company"), the undersigned participant acknowledges and agrees to the following terms.\n\n1. ASSUMPTION OF RISK. The participant understands that horseback riding and related equestrian activities carry inherent risks, including but not limited to the unpredictable behavior of horses, falls, and contact with animals, equipment, and terrain. The participant knowingly and voluntarily assumes all such risks.',
      '2. RELEASE. The participant releases the Company, its owners, instructors, and agents from any and all claims arising from participation in equestrian activities, except those arising from gross negligence, reckless conduct, or intentional misconduct.\n\n3. DISPUTE RESOLUTION. Any dispute shall be resolved through binding arbitration administered under the applicable JAMS/AAA rules, with the Company bearing arbitration fees above the equivalent court filing fee, and each party bearing its own attorney\'s fees.\n\nThe participant has read this document in full and signs it freely.',
    ],
  },
  {
    id: 'doc2', title: 'Standing Photo & Media Authorization', signedOn: 'Signed Mar 3, 2026', kind: 'Authorization',
    pages: [
      'MEDIA AUTHORIZATION\n\nThe undersigned grants French Heritage Equestrian permission to capture and use photographs and video of the participant taken during lessons, events, and activities for the Company\'s promotional and community purposes.\n\nThis authorization remains in effect until revoked in writing by the participant.',
    ],
  },
];

// ─── Instructor servicing home ─────────────────────────────────
export interface SeedSession {
  id: string; rider: string; starts_at: string; ends_at: string;
  status: 'scheduled' | 'completed' | 'cancelled'; location: string | null; focus: string | null;
}
function _todayAt(h: number, m = 0): string {
  const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString();
}
function _daysFrom(n: number, h: number, m = 0): string {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d.toISOString();
}
export const SEED_INSTRUCTOR_SESSIONS: SeedSession[] = [
  { id: 'ls1', rider: 'Jane Whitfield', starts_at: _todayAt(9), ends_at: _todayAt(10), status: 'scheduled', location: 'Main arena', focus: 'Flatwork · establishing contact' },
  { id: 'ls2', rider: 'Margaux Colbert', starts_at: _todayAt(11), ends_at: _todayAt(12), status: 'scheduled', location: 'Main arena', focus: 'Gymnastics · grids' },
  { id: 'ls3', rider: 'Sofia Ramos', starts_at: _todayAt(14), ends_at: _todayAt(15), status: 'scheduled', location: 'Round pen', focus: 'Lunge lesson · seat' },
  { id: 'ls4', rider: 'Amélie Rousseau', starts_at: _daysFrom(1, 10), ends_at: _daysFrom(1, 11), status: 'scheduled', location: 'Main arena', focus: 'Course work · related distances' },
  { id: 'ls5', rider: 'Claire Fontaine', starts_at: _daysFrom(2, 9), ends_at: _daysFrom(2, 10), status: 'scheduled', location: 'Main arena', focus: 'Flatwork · lateral work' },
  { id: 'ls6', rider: 'Jane Whitfield', starts_at: _daysFrom(3, 9), ends_at: _daysFrom(3, 10), status: 'scheduled', location: 'Main arena', focus: 'Cavaletti' },
];
