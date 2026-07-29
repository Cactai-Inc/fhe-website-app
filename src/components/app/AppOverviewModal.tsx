import { useMemo } from 'react';
import {
  LayoutDashboard, CalendarDays, ShoppingBag, FileText, ReceiptText,
  MessageSquare, GraduationCap, UserRound, Users, Gift, Boxes, Bookmark,
  Grid3x3, PanelLeft,
} from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import { currentTourFormFactor, type StandingCategory } from '../../lib/api';

/**
 * APP OVERVIEW — the welcome tour of the member surface, rebuilt per the owner
 * spec (2026-07-28). FOUR variants, one per standing-category group, each
 * describing ONLY what that group actually sees:
 *   GUEST                 — minimal: community, dashboard, calendar, messages,
 *                           catalog, account basics.
 *   RIDER                 — adds lessons (My Lessons) and the tackroom (the
 *                           gear & supplies side of My Stable). No horses.
 *   HORSE OWNER           — adds their horses + horse-care services (My
 *                           Stable). No lessons.
 *   RIDER + HORSE OWNER   — everything.
 *
 * Structure per variant (owner-final): purpose/value overview → access points
 * for their visible pages → Community Feed (focused views + how to toggle
 * them) → Dashboard → Account page → its contents/subcontents.
 *
 * The DESKTOP and MOBILE tours are different experiences and persist
 * independently (profiles.tour_seen_desktop_at / tour_seen_mobile_at): the
 * mobile variant also orients the member to the menu button at the top-left
 * of every page. Auto-open stamps the marker for the CURRENT form factor on
 * dismiss; re-opening from the avatar menu never stamps.
 */

type Variant = 'guest' | 'rider' | 'owner' | 'both';

function variantOf(categories: StandingCategory[]): Variant {
  const rider = categories.includes('RIDER');
  const owner = categories.includes('HORSE_OWNER');
  if (rider && owner) return 'both';
  if (owner) return 'owner';
  if (rider) return 'rider';
  return 'guest';
}

const INTRO: Record<Variant, string> = {
  guest:
    'The French Heritage Equestrian community is your window into life at the barn. '
    + 'Your account opens the whole community: follow what’s happening, join the '
    + 'conversation, message the barn and other members, and browse everything we '
    + 'offer whenever you’re ready for more.',
  rider:
    'This is your home for riding with French Heritage Equestrian. Everything '
    + 'around your lessons lives here — your schedule, your lesson credits, your '
    + 'tackroom, and your signed paperwork — alongside the full member community: '
    + 'the feed, events, and direct messages with the barn and other members.',
  owner:
    'This is the home for you and your horse at French Heritage Equestrian. Your '
    + 'horse’s record, their care services, and the paperwork that goes with them '
    + 'all live here — alongside the full member community: the feed, events, and '
    + 'direct messages with the barn and other members.',
  both:
    'This is your home for everything you do with French Heritage Equestrian — '
    + 'your riding and your horse. Your lessons, your schedule, your horse’s '
    + 'record and care services, and all your paperwork live here, alongside the '
    + 'full member community: the feed, events, and direct messages.',
};

interface Line { icon: typeof LayoutDashboard; label: string; desc: string }

/** The pages each variant actually sees (derived from AppLayout — the rail and
 *  avatar menu are the same for every member account under D8; the per-group
 *  difference is which pages carry that member's real content). */
function pageLines(v: Variant): Line[] {
  const lines: Line[] = [
    { icon: Users, label: 'Community Feed', desc: 'The one member feed — more on its focused views below.' },
    { icon: LayoutDashboard, label: 'Dashboard', desc: 'What needs your attention, and what’s coming up.' },
    { icon: CalendarDays, label: 'Calendar', desc: v === 'guest'
      ? 'Anything scheduled with the barn, and open times you can book.'
      : v === 'owner'
        ? 'Your horse’s scheduled services, payments due, and open times you can book.'
        : 'Your lessons and sessions, payments due, and open times you can book straight from the grid.' },
    { icon: MessageSquare, label: 'Messages', desc: 'Direct messages with the barn and with other members.' },
  ];
  if (v === 'rider' || v === 'both') {
    lines.push({ icon: GraduationCap, label: 'My Lessons', desc: 'Your lesson credits, upcoming sessions, and riding history.' });
  }
  lines.push({ icon: ShoppingBag, label: 'Catalog', desc: v === 'owner'
    ? 'Every service we offer — including horse-care services for your horse. Browse, book, and pay in one place.'
    : 'Everything we offer. Browse, book, and pay in one place.' });
  lines.push({ icon: UserRound, label: 'Account', desc: 'Your profile, paperwork, orders, and more — its contents are below.' });
  return lines;
}

/** The Account page rows each variant meaningfully uses (every account sees the
 *  full page — these are the rows that carry this group's real content). */
function accountLines(v: Variant): Line[] {
  const lines: Line[] = [
    { icon: UserRound, label: 'Profile & preferences', desc: 'Your contact details and emergency contacts, socials, notification preferences, and how you sign in.' },
    { icon: Grid3x3, label: 'My posts', desc: 'Your community posts and listings, in one place.' },
  ];
  if (v === 'rider' || v === 'both') {
    lines.push({ icon: GraduationCap, label: 'My lessons', desc: 'Credits, schedule, and your progress (also in the side menu).' });
  }
  lines.push({ icon: Bookmark, label: 'Saved items', desc: 'Articles, listings, and links you kept.' });
  lines.push({ icon: FileText, label: 'Documents', desc: 'Every agreement you’ve signed, always available to download. If we update one, the new version appears here for your signature — we’ll walk you to it when you next sign in.' });
  if (v === 'owner' || v === 'both') {
    lines.push({ icon: Boxes, label: 'My Stable', desc: 'Your horses’ records — details, health and care history, and the paperwork tied to each horse — plus your gear and supplies.' });
  } else if (v === 'rider') {
    lines.push({ icon: Boxes, label: 'My Stable — your tackroom', desc: 'The gear and supplies you keep on file with us.' });
  }
  lines.push({ icon: ReceiptText, label: 'Orders', desc: 'What you’ve purchased, what each covers, and how it was paid.' });
  lines.push({ icon: Gift, label: 'Gifts', desc: 'Gift certificates you’ve been given or bought for someone else — redeem, resend, or transfer.' });
  return lines;
}

const FEED_VIEW_LINES: { label: string; desc: string }[] = [
  { label: 'Social', desc: 'photos and moments members share' },
  { label: 'Discussions', desc: 'questions and conversations' },
  { label: 'For Sale', desc: 'horses and gear listed by the barn and members' },
  { label: 'Events', desc: 'clinics, shows, and gatherings — RSVP to save your spot' },
  { label: 'Articles', desc: 'guides and reading from French Heritage' },
  { label: 'Resources', desc: 'trusted vets, farriers, and suppliers' },
  { label: 'Members', desc: 'meet the community' },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-serif text-green-900 text-[15px] font-semibold mt-6 mb-2">{children}</h3>;
}

function LineList({ lines }: { lines: Line[] }) {
  return (
    <ul className="space-y-2.5">
      {lines.map((l) => (
        <li key={l.label} className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 text-green-700"><l.icon size={17} aria-hidden="true" /></span>
          <span>
            <span className="block text-sm font-medium text-green-900">{l.label}</span>
            <span className="block text-[13px] text-secondary">{l.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AppOverviewModal({
  open, onClose, categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: StandingCategory[];
}) {
  const variant = useMemo(() => variantOf(categories), [categories]);
  const mobile = currentTourFormFactor() === 'mobile';
  const pages = useMemo(() => pageLines(variant), [variant]);
  const account = useMemo(() => accountLines(variant), [variant]);

  const menuPhrase = mobile
    ? 'the menu button at the top-left of the page'
    : 'the left side menu (or the menu under your avatar)';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Welcome to The French Heritage Equestrian Community"
      footer={
        <button type="button" onClick={onClose} className="btn-primary">
          Enter the app
        </button>
      }
    >
      <p className="body-text text-sm text-secondary">{INTRO[variant]}</p>

      {mobile && (
        <p className="mt-3 flex items-start gap-2.5 text-[13px] text-green-900 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <PanelLeft size={16} className="shrink-0 mt-0.5 text-green-700" aria-hidden="true" />
          <span>
            <span className="font-medium">Finding your way:</span> the menu button at the
            top-left of every page opens the side menu — every page below is in there.
          </span>
        </p>
      )}

      <SectionHeading>Your pages</SectionHeading>
      <p className="text-[13px] text-secondary mb-2.5">
        Reach any of these from {menuPhrase}.
      </p>
      <LineList lines={pages} />

      <SectionHeading>The Community Feed</SectionHeading>
      <p className="text-[13px] text-secondary mb-2">
        One feed, from the whole barn — announcements, events, and posts from members.
        Post your own, or list something for sale. In the menu, the arrow next to
        &ldquo;Community Feed&rdquo; expands its focused views; each one filters the feed to
        just that kind of post, and &ldquo;Community Feed&rdquo; itself brings back everything:
      </p>
      <ul className="space-y-1 text-[13px] text-secondary list-none">
        {FEED_VIEW_LINES.map((f) => (
          <li key={f.label}>
            <span className="font-medium text-green-900">{f.label}</span> — {f.desc}
          </li>
        ))}
      </ul>

      <SectionHeading>Your Dashboard</SectionHeading>
      <p className="text-[13px] text-secondary">
        Where anything needing your attention collects — confirmations, payments due,
        documents to sign — along with what&rsquo;s coming up next for you.
      </p>

      <SectionHeading>Your Account page</SectionHeading>
      <p className="text-[13px] text-secondary mb-2.5">
        Everything that&rsquo;s yours, in one place:
      </p>
      <LineList lines={account} />

      <p className="mt-6 text-[13px] text-muted">
        You can reopen this tour any time from the menu under your avatar.
      </p>
    </Modal>
  );
}
