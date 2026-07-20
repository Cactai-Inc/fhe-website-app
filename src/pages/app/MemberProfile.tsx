import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Instagram, Facebook, Linkedin, Music2, Mail, Phone, MapPin, Star } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMemberProfile, fetchMemberHorses } from '../../lib/community';
import { sayHi, myGreetedUserIds } from '../../lib/communityFeed';
import { preferredContactLabel } from '../../lib/contact';
import type { MemberDirectoryEntry, MemberHorse } from '../../lib/community-types';

/**
 * MEMBER PROFILE (/app/members/:userId) — a community member's public profile:
 * avatar, name, role, bio, shared socials/contact, with a Message button (opens the
 * DM conversation) and Say hi. Reads the member_directory view (hide/allow prefs
 * already enforced there).
 */
export default function MemberProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [m, setM] = useState<MemberDirectoryEntry | null>(null);
  const [horses, setHorses] = useState<MemberHorse[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeted, setGreeted] = useState(false);
  const [greeting, setGreeting] = useState(false);

  useDocumentTitle(m?.display_name || m?.first_name || 'Member');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [prof, hs] = await Promise.all([
        fetchMemberProfile(userId),
        fetchMemberHorses(userId).catch(() => [] as MemberHorse[]),
      ]);
      setM(prof); setHorses(hs);
    } finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (userId) myGreetedUserIds().then((s) => setGreeted(s.has(userId))).catch(() => {});
  }, [userId]);

  if (loading) return <p className="body-text text-muted text-sm">Loading…</p>;
  if (!m) return (
    <div className="max-w-xl">
      <Link to="/app?filter=members" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4"><ArrowLeft size={14} /> Members</Link>
      <p className="body-text text-muted">This member isn't available.</p>
    </div>
  );

  const name = m.display_name || m.first_name || 'Member';
  const isMe = m.user_id === user?.id;
  const socials = [
    m.social_instagram && { icon: Instagram, href: m.social_instagram, label: 'Instagram' },
    m.social_facebook && { icon: Facebook, href: m.social_facebook, label: 'Facebook' },
    m.social_linkedin && { icon: Linkedin, href: m.social_linkedin, label: 'LinkedIn' },
    m.social_tiktok && { icon: Music2, href: m.social_tiktok, label: 'TikTok' },
  ].filter(Boolean) as { icon: typeof Instagram; href: string; label: string }[];

  return (
    <div className="max-w-xl">
      <Link to="/app?filter=members" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Members
      </Link>

      <div className="bg-white border border-green-800/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center">
        {m.avatar_url
          ? <img src={m.avatar_url} alt="" className="w-28 h-28 rounded-full object-cover" />
          : <span className="w-28 h-28 rounded-full bg-green-100 text-green-800 grid place-items-center text-4xl font-serif font-semibold">{(name[0] || 'M').toUpperCase()}</span>}
        <h1 className="font-serif text-green-900 text-2xl font-semibold mt-4">{name}</h1>
        <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mt-1">
          {[m.riding_level || 'Rider', m.is_horse_owner ? 'Horse Owner' : null].filter(Boolean).join(' · ')}
        </p>
        {preferredContactLabel(m.preferred_contact) && !isMe && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <Star size={13} className="text-gold-600" /> Prefers {preferredContactLabel(m.preferred_contact)}
          </span>
        )}
        {m.bio && <p className="text-sm text-secondary mt-4 max-w-md leading-relaxed">{m.bio}</p>}

        {/* Horses this member owns — name + home location */}
        {horses.length > 0 && (
          <div className="mt-5 w-full flex flex-col gap-2">
            {horses.filter((h) => h.name).map((h, i) => (
              <div key={i} className="flex items-center justify-center gap-2 text-sm">
                <span className="font-serif text-green-900 font-medium">{h.name}</span>
                {h.home_location && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                    <MapPin size={12} /> {h.home_location}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!isMe && (
          <div className="flex items-center gap-2 mt-6">
            <button type="button" onClick={() => navigate(`/app/messages/${m.user_id}`)}
              className="btn-primary text-sm"><MessageSquare size={15} /> Message</button>
            <button type="button" disabled={greeting || greeted}
              onClick={async () => { setGreeting(true); try { await sayHi(m.user_id); setGreeted(true); } finally { setGreeting(false); } }}
              className={`text-sm px-4 py-2.5 rounded-lg border focus-ring ${greeted ? 'border-green-800 bg-green-800/5 text-green-900' : 'border-green-800/40 text-green-900 hover:border-green-800'}`}>
              {greeted ? 'Welcomed 👋' : 'Say hi 👋'}
            </button>
          </div>
        )}

        {/* Shared contact + socials (hide/allow prefs already applied in the view) */}
        {(m.email || m.mobile || socials.length > 0) && (
          <div className="mt-6 pt-6 border-t border-green-800/10 w-full flex flex-wrap items-center justify-center gap-2">
            {m.email && <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Mail size={14} /> Email</a>}
            {m.mobile && m.allow_call && <a href={`tel:${m.mobile}`} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Phone size={14} /> Call</a>}
            {socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                aria-label={s.label} className="grid place-items-center w-9 h-9 text-green-700 border border-green-800/15 rounded-lg hover:bg-green-50"><s.icon size={16} /></a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
