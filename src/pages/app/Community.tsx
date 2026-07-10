import { Link, Navigate } from 'react-router-dom';
import { MessagesSquare, Hash, Users, CalendarPlus, Store, Mail, ArrowRight } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';

/**
 * COMMUNITY HUB (Slice 4, /app/community) — the single entry point for the rider
 * community surface. Membership = anyone who rides (the 'riding' purchase category
 * is the qualifier); the purchase-driven view model gates the whole surface, so a
 * deal/care-only member never reaches here (redirected out). Ties together the
 * existing forum (threads), chat board, rider directory, peer messaging, the Market
 * filter, and host-an-event. Sub-pages are unchanged; this is the front door.
 */

interface Tile {
  to: string;
  label: string;
  blurb: string;
  icon: typeof Hash;
}

const TILES: Tile[] = [
  { to: '/app/threads', label: 'Forum', blurb: 'Start a thread, ask the group, share a win.', icon: MessagesSquare },
  { to: '/app/chat', label: 'Chat board', blurb: 'The quick back-and-forth with everyone at the barn.', icon: Hash },
  { to: '/app/members', label: 'Rider directory', blurb: 'See who else rides here and connect.', icon: Users },
  { to: '/app/messages', label: 'Messages', blurb: 'Direct messages — carry an item into a conversation.', icon: Mail },
  { to: '/app/community/market', label: 'Market', blurb: 'Horses & gear members are sharing.', icon: Store },
  { to: '/app/community/host', label: 'Host an event', blurb: 'Organize a ride, a clinic, or a get-together.', icon: CalendarPlus },
];

export default function Community() {
  useDocumentTitle('Community');
  const { surfaces, loading } = useViewSurfaces();

  // Whole surface is riding-gated: no community purchase → out.
  if (!loading && !surfaces.has_community) return <Navigate to="/app" replace />;

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Community</p>
      <h1 className="heading-section text-green-800 mb-2">Who's at the rail.</h1>
      <p className="body-text text-sm text-muted mb-8">
        The people who ride here — talk, plan, and share the barn.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {TILES.map(({ to, label, blurb, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="bg-white border border-green-800/10 rounded-lg p-5 hover:border-green-800/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon size={20} className="text-gold-ink" aria-hidden="true" />
              <p className="font-serif text-green-800">{label}</p>
              <ArrowRight size={14} className="ml-auto text-muted group-hover:text-green-800" />
            </div>
            <p className="body-text text-sm text-muted">{blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
