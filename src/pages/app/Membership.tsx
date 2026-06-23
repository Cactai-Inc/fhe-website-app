import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';

const TIER_LABEL: Record<string, string> = {
  community: 'Community',
  rider: 'Rider',
  full: 'Full',
};

const TIER_BENEFITS: Record<string, string[]> = {
  community: ['The chat board & threads', 'Members directory', 'Announcements & events'],
  rider: ['Everything in Community', 'Lesson & training booking', 'Members-only content library'],
  full: ['Everything in Rider', 'Priority scheduling', 'Acquisition & care concierge'],
};

export default function Membership() {
  useDocumentTitle('Your Membership');
  const { membership, isAdmin } = useAuth();

  const tier = membership?.tier ?? (isAdmin ? 'full' : 'community');
  const status = membership?.status ?? (isAdmin ? 'active' : 'community');

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-2">Your membership</p>
      <h1 className="heading-section text-green-800 mb-8">Where you stand with us.</h1>

      <div className="bg-green-800 text-white p-8 mb-8">
        <p className="eyebrow-on-dark mb-2">Current tier</p>
        <p className="font-display text-4xl mb-1">{TIER_LABEL[tier] ?? tier}</p>
        <p className="text-sm text-white/[0.7] capitalize">{status}</p>
        {membership?.renews_at && (
          <p className="text-xs text-white/[0.6] mt-3">
            Renews {new Date(membership.renews_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="bg-white border border-green-800/10 p-8">
        <h2 className="font-serif font-medium text-green-800 text-lg mb-4">What's included</h2>
        <ul className="flex flex-col gap-2.5">
          {(TIER_BENEFITS[tier] ?? TIER_BENEFITS.community).map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm font-sans text-secondary">
              <div className="w-1 h-1 bg-gold-600 rounded-full flex-shrink-0" />
              {b}
            </li>
          ))}
        </ul>
        <p className="form-hint mt-6">
          Questions about your membership? Reach out and we'll take care of it.
        </p>
      </div>
    </div>
  );
}
