import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Instagram, Facebook, Linkedin, Music2, Mail, Phone, MapPin, Calendar, Globe, Star,
} from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchThread, replyToThread, fetchContentPost, fetchMemberHorses, setRsvp,
} from '../../lib/community';
import { sayHi, myGreetedUserIds, type FeedCard } from '../../lib/communityFeed';
import { contactActions, preferredContactLabel, type PreferredContact } from '../../lib/contact';
import { FeedVideo } from './FeedVideo';
import type { ThreadPost, ContentPost, MemberHorse, RsvpStatus } from '../../lib/community-types';

/**
 * POST MODAL — every community card opens its full content HERE, in a modal, never a
 * page. One component handles all card kinds: members (profile + horses + Message +
 * Say hi), discussions (thread + replies + reply box), articles (full body), events
 * (details + RSVP), social/for-sale/announcement (full post), resources (contact).
 * The card carries most data; only threads/articles/member-horses are fetched on open.
 */
export function PostModal({ card, onClose }: { card: FeedCard; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={modalTitle(card)}>
      <Body card={card} onClose={onClose} />
    </Modal>
  );
}

function modalTitle(c: FeedCard): string {
  switch (c.kind) {
    case 'member': return c.title || 'Member';
    case 'discussion': return c.title || 'Discussion';
    case 'article': return 'Article';
    case 'event': return 'Event';
    case 'for_sale': return c.saleTag || 'For sale';
    case 'resource': return 'Resource';
    case 'announcement': return 'Announcement';
    default: return c.author || 'Post';
  }
}

function Body({ card, onClose }: { card: FeedCard; onClose: () => void }) {
  switch (card.kind) {
    case 'member': return <MemberBody card={card} onClose={onClose} />;
    case 'discussion': return <DiscussionBody card={card} />;
    case 'article': return <ArticleBody card={card} />;
    case 'event': return <EventBody card={card} />;
    case 'resource': return <ResourceBody card={card} />;
    default: return <PostBody card={card} />;
  }
}

/** The launch URL for a member's preferred channel, from the card's shared fields.
 *  Returns null for 'platform'/'none' (platform = the in-app Message button below). */
function preferredHref(card: FeedCard): string | null {
  const p = card.preferredContact as PreferredContact | undefined;
  switch (p) {
    case 'email':     return card.email ? `mailto:${card.email}` : null;
    case 'sms':       return card.mobile ? `sms:${card.mobile.replace(/[^\d+]/g, '')}` : null;
    case 'call':      return card.mobile ? `tel:${card.mobile.replace(/[^\d+]/g, '')}` : null;
    case 'whatsapp':  return card.whatsapp ? `https://wa.me/${card.whatsapp.replace(/[^\d]/g, '')}` : null;
    case 'instagram': return card.socialInstagram ?? null;
    case 'facebook':  return card.socialFacebook ?? null;
    case 'linkedin':  return card.socialLinkedin ?? null;
    case 'tiktok':    return card.socialTiktok ?? null;
    default:          return null;
  }
}

// ── MEMBER ──────────────────────────────────────────────────────────────────
function MemberBody({ card, onClose }: { card: FeedCard; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [horses, setHorses] = useState<MemberHorse[]>([]);
  const [greeted, setGreeted] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const uid = card.memberUserId;
  const isMe = uid === user?.id;

  useEffect(() => {
    if (!uid) return;
    fetchMemberHorses(uid).then(setHorses).catch(() => {});
    myGreetedUserIds().then((s) => setGreeted(s.has(uid))).catch(() => {});
  }, [uid]);

  const socials = [
    card.socialInstagram && { icon: Instagram, href: card.socialInstagram, label: 'Instagram' },
    card.socialFacebook && { icon: Facebook, href: card.socialFacebook, label: 'Facebook' },
    card.socialLinkedin && { icon: Linkedin, href: card.socialLinkedin, label: 'LinkedIn' },
    card.socialTiktok && { icon: Music2, href: card.socialTiktok, label: 'TikTok' },
  ].filter(Boolean) as { icon: typeof Instagram; href: string; label: string }[];

  // Preferred contact — a hint chip. Where it maps to a launchable channel, the chip
  // links straight to it; 'platform' points at the Message action below.
  const prefLabel = preferredContactLabel(card.preferredContact);
  const prefHref = preferredHref(card);

  return (
    <div className="flex flex-col items-center text-center">
      {card.memberAvatar
        ? <img src={card.memberAvatar} alt="" className="w-24 h-24 rounded-full object-cover" />
        : <span className="w-24 h-24 rounded-full bg-green-100 text-green-800 grid place-items-center text-3xl font-serif font-semibold">{card.authorInitials}</span>}
      {card.role && <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mt-3">{card.role}</p>}
      {prefLabel && !isMe && (
        prefHref ? (
          <a href={prefHref} target={prefHref.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 hover:bg-green-100 focus-ring">
            <Star size={13} className="text-gold-600" /> Prefers {prefLabel}
          </a>
        ) : (
          <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <Star size={13} className="text-gold-600" /> Prefers {prefLabel}
          </span>
        )
      )}
      {card.bio && <p className="text-sm text-secondary mt-3 max-w-md leading-relaxed">{card.bio}</p>}

      {horses.filter((h) => h.name).length > 0 && (
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

      {uid && !isMe && (
        <div className="flex items-center gap-2 mt-6">
          <button type="button" onClick={() => { onClose(); navigate(`/app/messages/${uid}`); }}
            className="btn-primary text-sm"><MessageSquare size={15} /> Message</button>
          <button type="button" disabled={greeting || greeted}
            onClick={async () => { setGreeting(true); try { await sayHi(uid); setGreeted(true); } finally { setGreeting(false); } }}
            className={`text-sm px-4 py-2.5 rounded-lg border focus-ring ${greeted ? 'border-green-800 bg-green-800/5 text-green-900' : 'border-green-800/40 text-green-900 hover:border-green-800'}`}>
            {greeted ? 'Welcomed 👋' : 'Say hi 👋'}
          </button>
        </div>
      )}

      {(card.email || card.mobile || socials.length > 0) && (
        <div className="mt-6 pt-6 border-t border-green-800/10 w-full flex flex-wrap items-center justify-center gap-2">
          {card.email && <a href={`mailto:${card.email}`} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Mail size={14} /> Email</a>}
          {card.mobile && card.allowCall && <a href={`tel:${card.mobile}`} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Phone size={14} /> Call</a>}
          {socials.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              aria-label={s.label} className="grid place-items-center w-9 h-9 text-green-700 border border-green-800/15 rounded-lg hover:bg-green-50"><s.icon size={16} /></a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DISCUSSION (thread + replies + reply box) ───────────────────────────────
function authorName(a?: { display_name: string | null; first_name: string | null }): string {
  return a?.display_name || a?.first_name || 'Member';
}
function DiscussionBody({ card }: { card: FeedCard }) {
  const id = card.threadId;
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [openBody, setOpenBody] = useState<string | undefined>(card.body);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    fetchThread(id).then(({ thread, posts }) => {
      setPosts(posts); setLocked(thread.locked); setOpenBody(thread.body);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !id) return;
    setPosting(true);
    try { await replyToThread(id, reply.trim()); setReply(''); load(); }
    finally { setPosting(false); }
  }

  return (
    <div>
      <p className="text-xs text-muted mb-3">{card.author} · {card.when}</p>
      <div className="bg-cream-50 border border-green-800/10 rounded-lg p-4 mb-5">
        <p className="body-text text-sm whitespace-pre-line">{openBody}</p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading replies…</p> : (
        <div className="flex flex-col gap-3 mb-5">
          {posts.map((p) => (
            <div key={p.id} className="border border-green-800/10 rounded-lg p-4">
              <p className="text-xs text-muted mb-1.5">{authorName(p.author)} · {new Date(p.created_at).toLocaleString()}</p>
              <p className="body-text text-sm whitespace-pre-line">{p.body}</p>
            </div>
          ))}
          {posts.length === 0 && <p className="text-sm text-muted">No replies yet — start the conversation.</p>}
        </div>
      )}

      {locked ? (
        <p className="text-sm text-muted">This thread is locked.</p>
      ) : (
        <form onSubmit={submit}>
          <textarea rows={3} className="form-input resize-none mb-3" value={reply}
            onChange={(e) => setReply(e.target.value)} placeholder="Share your thoughts…" />
          <button type="submit" disabled={posting || !reply.trim()} className="btn-primary text-sm">
            {posting ? 'Posting…' : 'Reply'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── ARTICLE (full body) ─────────────────────────────────────────────────────
function ArticleBody({ card }: { card: FeedCard }) {
  const [post, setPost] = useState<ContentPost | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!card.slug) { setLoading(false); return; }
    fetchContentPost(card.slug).then(setPost).catch(() => {}).finally(() => setLoading(false));
  }, [card.slug]);

  const cover = post?.cover_url || card.coverUrl;
  return (
    <article>
      {cover && <img src={cover} alt="" className="w-full h-56 object-cover rounded-lg mb-5" />}
      <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold">Article · {card.readMins} min</p>
      <h3 className="font-serif text-green-900 text-2xl font-semibold leading-tight mt-1 mb-3">{card.title}</h3>
      {loading ? <p className="text-sm text-muted">Loading…</p>
        : <div className="body-text whitespace-pre-line leading-relaxed text-sm">{post?.body || card.body}</div>}
    </article>
  );
}

// ── EVENT (details + RSVP) ──────────────────────────────────────────────────
function EventBody({ card }: { card: FeedCard }) {
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [saving, setSaving] = useState(false);

  async function rsvp(s: RsvpStatus) {
    setSaving(true);
    try { await setRsvp(card.id, s); setStatus(s); }
    finally { setSaving(false); }
  }

  const start = card.startsAt ? new Date(card.startsAt) : null;
  const end = card.endsAt ? new Date(card.endsAt) : null;
  return (
    <div>
      <h3 className="font-serif text-green-900 text-2xl font-semibold leading-tight mb-3">{card.title}</h3>
      <div className="flex flex-col gap-2 mb-5 text-sm">
        {start && (
          <p className="inline-flex items-center gap-2 text-secondary">
            <Calendar size={15} className="text-gold-800" />
            {start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {end && ` – ${end.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
          </p>
        )}
        {card.location && <p className="inline-flex items-center gap-2 text-secondary"><MapPin size={15} className="text-gold-800" /> {card.location}</p>}
      </div>
      {card.body && <p className="body-text text-sm whitespace-pre-line leading-relaxed mb-6">{card.body}</p>}

      <div className="border-t border-green-800/10 pt-5">
        <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Will you be there?</p>
        <div className="flex gap-2">
          {(['going', 'maybe', 'declined'] as RsvpStatus[]).map((s) => (
            <button key={s} type="button" disabled={saving} onClick={() => rsvp(s)}
              className={`text-sm px-4 py-2 rounded-lg border focus-ring capitalize ${
                status === s ? 'border-green-800 bg-green-800 text-white' : 'border-green-800/30 text-green-900 hover:border-green-800'}`}>
              {s === 'declined' ? "Can't make it" : s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RESOURCE (title + body + contact) ───────────────────────────────────────
function ResourceBody({ card }: { card: FeedCard }) {
  const links = contactActions({ email: card.email, mobile: card.mobile });
  return (
    <div>
      <h3 className="font-serif text-green-800 text-xl font-semibold leading-snug mb-2">{card.title}</h3>
      {card.body && <p className="text-sm text-secondary mb-5 leading-relaxed">{card.body}</p>}
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.method} href={l.href} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50">
            {l.method === 'email' ? <Mail size={14} /> : <Phone size={14} />} {l.label}
          </a>
        ))}
        {card.url && <a href={card.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Globe size={14} /> Website</a>}
        {links.length === 0 && !card.url && <p className="text-sm text-muted">No contact shared.</p>}
      </div>
    </div>
  );
}

// ── SOCIAL / FOR-SALE / ANNOUNCEMENT (full post) ────────────────────────────
function PostBody({ card }: { card: FeedCard }) {
  return (
    <div>
      {card.mediaUrl && (
        <div className="relative rounded-lg overflow-hidden mb-4 bg-gradient-to-br from-green-50 to-gold-50">
          {card.mediaKind === 'video'
            ? <FeedVideo src={card.mediaUrl} mode="modal" className="w-full rounded-lg" />
            : <img src={card.mediaUrl} alt="" className="w-full max-h-[60vh] object-contain" />}
          {card.price && <span className="absolute bottom-3 right-3 bg-green-800 text-gold-200 font-serif text-base px-3 py-1 rounded-lg pointer-events-none">{card.price}</span>}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2 text-xs text-muted">
        {card.authorAvatar
          ? <img src={card.authorAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
          : card.author && <span className="w-6 h-6 rounded-full bg-green-100 text-green-800 grid place-items-center text-[9px] font-semibold">{card.authorInitials}</span>}
        {card.author && (
          <span className="text-green-900">
            <span className="font-semibold">{card.author}</span>
            {card.kind === 'social' ? ' posted' : ''}
          </span>
        )}
        {card.when && <span>· {card.when}</span>}
      </div>
      {card.title && card.kind !== 'social' && <h3 className="font-serif text-green-900 text-xl font-semibold leading-snug mb-2">{card.title}</h3>}
      {card.body && <p className="body-text text-sm whitespace-pre-line leading-relaxed">{card.body}</p>}
    </div>
  );
}
