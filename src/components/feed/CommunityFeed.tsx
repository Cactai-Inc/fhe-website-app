import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MessageCircle, Phone, Smartphone, PhoneCall, Globe, Hand } from 'lucide-react';
import { fetchViewCards, sayHi, myGreetedUserIds, type FeedCard } from '../../lib/communityFeed';
import { feedMarkSeen } from '../../lib/feed';
import { SEED_ENABLED, type FeedView } from '../../lib/seed';
import { useAuth } from '../../contexts/AuthContext';
import {
  contactActions, type ContactInfo, type ContactMethod,
} from '../../lib/contact';

/**
 * COMMUNITY FEED (adaptive, live) — fetches the active view's real source(s) via
 * the federation layer and renders each view in its browse-appropriate layout:
 * Members → roster w/ tap-to-contact; For Sale → square grid; Articles → reading
 * list; Resources → listing cards; All/Social/Discussions/Events → cards. Seed
 * content is shown only as an explicit empty-state fallback (SEED_ENABLED), never
 * layered over real rows.
 */

function MediaBlock({ url, label }: { url?: string; label?: string }) {
  return (
    <div className="relative aspect-[16/10] bg-gradient-to-br from-green-50 to-gold-50 overflow-hidden">
      {url && <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />}
      {label && (
        <span className="absolute top-3 left-3 bg-cream/90 text-[9px] tracking-wide uppercase px-2.5 py-1 rounded-full text-green-800 font-semibold">
          {label}
        </span>
      )}
    </div>
  );
}
function Avatar({ initials }: { initials?: string }) {
  return (
    <span className="w-[22px] h-[22px] rounded-full bg-green-100 text-green-800 grid place-items-center text-[9px] font-semibold">
      {initials || '·'}
    </span>
  );
}
const CONTACT_ICON: Record<ContactMethod, typeof Mail> = {
  email: Mail, sms: MessageCircle, call: Phone, whatsapp: Smartphone, whatsapp_call: PhoneCall,
};
function ContactButtons({ info, url }: { info: ContactInfo; url?: string | null }) {
  const cls = 'flex-1 grid place-items-center py-2 border border-green-800/10 rounded-lg text-green-700 hover:bg-green-50 focus-ring';
  // Single source of truth: contactActions honors every allow-toggle, including
  // the split WhatsApp chat vs WhatsApp call.
  const links: { key: string; href: string; label: string; icon: typeof Mail }[] =
    contactActions(info).map((a) => ({ key: a.method, href: a.href, label: a.label, icon: CONTACT_ICON[a.method] }));
  if (url) links.push({ key: 'web', href: url, label: 'Website', icon: Globe });

  if (links.length === 0) {
    return <p className="text-[11px] text-muted">No contact shared</p>;
  }
  return (
    <div className="flex gap-1.5">
      {links.map((l) => (
        <a key={l.key} href={l.href} target={l.key === 'web' || l.key === 'wa' ? '_blank' : undefined}
          rel={l.key === 'web' || l.key === 'wa' ? 'noopener noreferrer' : undefined}
          className={cls} aria-label={l.label}>
          <l.icon size={16} />
        </a>
      ))}
    </div>
  );
}

/** One-click "Say hi 👋" for a new-member card. Disabled once sent (this session
 *  or already greeted per myGreetedUserIds). Self is never shown a button. */
function SayHiButton({ toUserId, alreadyGreeted }: { toUserId: string; alreadyGreeted: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>(alreadyGreeted ? 'done' : 'idle');
  async function greet() {
    if (state !== 'idle') return;
    setState('sending');
    try { await sayHi(toUserId); setState('done'); }
    catch { setState('idle'); }
  }
  return (
    <button type="button" onClick={greet} disabled={state !== 'idle'}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 focus-ring ${
        state === 'done'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-green-800 text-white hover:bg-green-700'}`}>
      <Hand size={14} aria-hidden="true" />
      {state === 'done' ? 'Welcomed 👋' : state === 'sending' ? 'Saying hi…' : 'Say hi 👋'}
    </button>
  );
}

function Card({ c, myId, greeted }: { c: FeedCard; myId?: string; greeted: Set<string> }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement | null>(null);

  // seen-marking: feed-backed cards (social/for-sale) flip their seen flag when
  // they scroll into view — this is what drains the filter badges.
  useEffect(() => {
    if (c.seen !== false || !ref.current) return;
    if (c.kind !== 'social' && c.kind !== 'for_sale') return;
    const el = ref.current;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        feedMarkSeen(c.id).catch(() => {});
        obs.disconnect();
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [c.id, c.seen, c.kind]);

  // ── MEMBER: a standard, vertical, centered community profile card ──
  if (c.kind === 'member') {
    const isMine = c.memberUserId && c.memberUserId === myId;
    return (
      <article ref={ref} className="rounded-xl mb-4 break-inside-avoid border border-green-800/10 bg-white p-5 flex flex-col items-center text-center">
        {c.memberAvatar
          ? <img src={c.memberAvatar} alt="" className="w-20 h-20 rounded-full object-cover" />
          : <span className="w-20 h-20 rounded-full bg-green-100 text-green-800 grid place-items-center text-2xl font-serif font-semibold">{c.authorInitials}</span>}
        <p className="font-serif text-green-900 text-[17px] font-semibold leading-tight mt-3">{c.title}</p>
        {c.role && <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mt-0.5">{c.role}</p>}
        {c.memberUserId && !isMine && (
          <div className="mt-3">
            <SayHiButton toUserId={c.memberUserId} alreadyGreeted={greeted.has(c.memberUserId)} />
          </div>
        )}
        <div className="mt-3 w-full flex justify-center">
          <ContactButtons info={{
            email: c.email, mobile: c.mobile, whatsapp: c.whatsapp,
            allowSms: c.allowSms, allowCall: c.allowCall,
            allowWhatsappText: c.allowWhatsapp, allowWhatsappCall: c.allowWhatsappCall,
          }} />
        </div>
      </article>
    );
  }

  // ── FOR SALE: media-forward listing with a price ──
  if (c.kind === 'for_sale') {
    return (
      <article ref={ref} onClick={c.to ? () => navigate(c.to!) : undefined}
        className={`rounded-xl overflow-hidden mb-4 break-inside-avoid border border-green-800/10 bg-white ${c.to ? 'cursor-pointer hover:border-green-800/30 transition-colors' : ''}`}>
        <div className="relative aspect-square bg-gradient-to-br from-green-50 to-gold-50 overflow-hidden">
          {c.mediaUrl && <img src={c.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
          {c.saleTag && <span className="absolute top-2.5 left-2.5 bg-cream/90 text-[9px] tracking-wide uppercase px-2 py-1 rounded-full text-green-800 font-semibold">{c.saleTag}</span>}
          {c.price && <span className="absolute bottom-2.5 right-2.5 bg-green-800 text-gold-200 font-serif text-sm px-2.5 py-0.5 rounded-lg">{c.price}</span>}
        </div>
        <div className="px-4 py-3">
          <p className="font-serif text-green-900 text-[15px] font-semibold leading-snug">{c.title || c.body}</p>
        </div>
      </article>
    );
  }

  // ── ARTICLE: media + read time ──
  if (c.kind === 'article') {
    return (
      <article ref={ref} onClick={c.to ? () => navigate(c.to!) : undefined}
        className={`rounded-xl overflow-hidden mb-4 break-inside-avoid border border-green-800/10 bg-white ${c.to ? 'cursor-pointer hover:border-green-800/30 transition-colors' : ''}`}>
        <div className="aspect-[16/9] bg-gradient-to-br from-green-50 to-gold-50" />
        <div className="px-4 py-3">
          <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold">Article · {c.readMins} min</p>
          <p className="font-serif text-green-900 text-[17px] font-semibold leading-snug my-0.5">{c.title}</p>
          {c.body && <p className="text-[12px] text-muted leading-snug line-clamp-2">{c.body}</p>}
        </div>
      </article>
    );
  }

  // ── RESOURCE: title + body + contact ──
  if (c.kind === 'resource') {
    return (
      <article ref={ref} className="rounded-xl mb-4 break-inside-avoid border border-green-800/10 bg-white p-4">
        <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug mb-1">{c.title}</p>
        {c.body && <p className="text-[12px] text-muted mb-3">{c.body}</p>}
        <ContactButtons info={{ email: c.email, mobile: c.mobile }} url={c.url} />
      </article>
    );
  }

  // ── SOCIAL / DISCUSSION / EVENT / ANNOUNCEMENT: the standard post card ──
  const isAnnouncement = c.kind === 'announcement';
  return (
    <article
      ref={ref}
      onClick={c.to ? () => navigate(c.to!) : undefined}
      className={`rounded-xl overflow-hidden mb-4 break-inside-avoid ${
        isAnnouncement
          ? 'border-2 border-gold-600/70 bg-gradient-to-br from-gold-50 to-white'
          : 'border border-green-800/10 bg-white'
      } ${c.to ? 'cursor-pointer hover:border-green-800/30 transition-colors' : ''}`}>
      {c.mediaUrl && <MediaBlock url={c.mediaUrl} label={c.kind === 'social' ? 'Social' : undefined} />}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          {!isAnnouncement && <Avatar initials={c.authorInitials} />}
          <div className="min-w-0">
            <p className={`text-[11.5px] font-medium ${isAnnouncement ? 'text-gold-800 uppercase tracking-widest text-[10px] font-semibold' : 'text-green-900'}`}>
              {isAnnouncement ? 'Announcement' : (c.author || c.title)}
            </p>
            {c.when && <p className="text-[10px] text-muted">{c.when}</p>}
          </div>
        </div>
        {c.title && c.kind !== 'social' && <p className="font-serif text-green-900 text-[17px] leading-snug font-semibold mb-1">{c.title}</p>}
        {c.body && <p className="text-[12.5px] leading-relaxed text-secondary line-clamp-3">{c.body}</p>}
        {typeof c.replies === 'number' && <p className="text-[11px] text-gold-800 font-semibold mt-2">{c.replies} replies →</p>}
      </div>
    </article>
  );
}

function EmptyState({ view }: { view: FeedView }) {
  return (
    <div className="text-center py-16">
      <p className="font-serif text-lg text-green-800 mb-1">Nothing here yet.</p>
      <p className="body-text text-sm text-muted">
        {view === 'members' ? 'The member directory will fill in as people join.'
          : view === 'for_sale' ? 'Listings for horses and gear will appear here.'
          : 'New posts from the barn and community will appear here.'}
      </p>
    </div>
  );
}

export function CommunityFeed({ view }: { view: FeedView }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<FeedCard[] | null>(null);
  const [greeted, setGreeted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setCards(null);
    fetchViewCards(view)
      .then((c) => { if (active) setCards(c); })
      .catch(() => { if (active) setCards([]); });
    return () => { active = false; };
  }, [view]);

  // Which new members I've already welcomed — so the Say-hi buttons render as done.
  useEffect(() => {
    let active = true;
    myGreetedUserIds().then((s) => { if (active) setGreeted(s); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  if (cards === null) return <p className="body-text text-muted text-sm">Loading…</p>;

  // Empty → seed fallback (preview) or a real empty state.
  if (cards.length === 0) {
    if (SEED_ENABLED) return <SeedFallback view={view} />;
    return <EmptyState view={view} />;
  }

  // ONE feed, ONE card, ONE grid. Every view uses the same masonry of <Card>s; the
  // filter buttons only change WHICH cards are in `cards` — never how they render.
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {cards.map((c) => <Card key={`${c.kind}-${c.id}`} c={c} myId={user?.id} greeted={greeted} />)}
    </div>
  );
}

// Seed fallback pulled lazily so the live path doesn't import seed rendering.
import {
  SEED_FEED, SEED_LISTINGS, SEED_ARTICLES, SEED_MEMBERS, SEED_RESOURCES,
} from '../../lib/seed';
function SeedFallback({ view }: { view: FeedView }) {
  if (view === 'members') {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {SEED_MEMBERS.map((m) => (
          <div key={m.id} className="bg-white border border-green-800/10 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-11 h-11 rounded-full bg-green-100 text-green-800 grid place-items-center text-base font-serif font-semibold">{m.initials}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-900 truncate">{m.name}</p>
                <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold">{m.role}</p>
              </div>
            </div>
            <ContactButtons info={{
              email: m.email, mobile: m.mobile, whatsapp: m.whatsapp,
              allowSms: m.allowSms, allowCall: m.allowCall,
              // seed preview has no separate call pref; mirror the chat toggle
              allowWhatsappText: m.allowWhatsapp, allowWhatsappCall: m.allowWhatsapp,
            }} />
          </div>
        ))}
      </div>
    );
  }
  if (view === 'resources') {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {SEED_RESOURCES.map((r) => (
          <div key={r.id} className="bg-white border border-green-800/10 rounded-xl p-4">
            <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold mb-1">{r.category}</p>
            <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug mb-1">{r.name}</p>
            <p className="text-[12px] text-muted mb-3">{r.note}</p>
            <ContactButtons info={{ email: r.email, mobile: r.mobile }} url={r.url} />
          </div>
        ))}
      </div>
    );
  }
  if (view === 'articles') {
    return (
      <div className="flex flex-col gap-3.5">
        {SEED_ARTICLES.map((a) => (
          <div key={a.id} className="flex gap-3.5 p-3.5 bg-white border border-green-800/10 rounded-xl">
            <div className="w-24 h-[70px] rounded-lg bg-gradient-to-br from-green-50 to-gold-50 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold">Article · {a.mins} min</p>
              <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug my-0.5">{a.title}</p>
              <p className="text-[12px] text-muted leading-snug line-clamp-2">{a.excerpt}</p>
              <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-gold-50 text-gold-800 border border-gold-200 font-semibold">{a.audience}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (view === 'for_sale') {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {SEED_LISTINGS.map((l) => (
          <div key={l.id} className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
            <div className="relative aspect-square bg-gradient-to-br from-green-50 to-gold-50">
              <span className="absolute top-2.5 left-2.5 bg-cream/90 text-[9px] tracking-wide uppercase px-2 py-1 rounded-full text-green-800 font-semibold">{l.tag}</span>
              {l.price && <span className="absolute bottom-2.5 right-2.5 bg-green-800 text-gold-200 font-serif text-sm px-2.5 py-0.5 rounded-lg">{l.price}</span>}
            </div>
            <div className="px-3.5 py-2.5">
              <p className="font-serif text-green-900 text-[15px] font-semibold leading-snug">{l.title}</p>
              {l.sub && <p className="text-[11.5px] text-muted">{l.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const items = view === 'all' ? SEED_FEED : SEED_FEED.filter((i) => i.view === view);
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {items.map((i) => (
        <article key={i.id} className={`rounded-xl border overflow-hidden mb-4 break-inside-avoid ${
          i.kind === 'member_announce' ? 'border-green-800/10 bg-gradient-to-br from-green-50 to-white'
            : i.kind === 'resource_announce' ? 'border-green-800/10 bg-gradient-to-br from-gold-50 to-white'
            : 'border-green-800/10 bg-white'}`}>
          {i.mediaTint && !(i.kind === 'member_announce' || i.kind === 'resource_announce') && (
            <MediaBlock label={i.kind === 'for_sale' ? `For Sale · ${i.saleTag}` : i.kind === 'article' ? `Article · ${i.readMins} min` : i.kind === 'event' ? 'Event' : i.kind === 'social' ? 'Social' : undefined} />
          )}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar initials={i.authorInitials} />
              <div className="min-w-0">
                <p className={`text-[11.5px] font-medium ${i.kind === 'member_announce' || i.kind === 'resource_announce' ? 'text-gold-800' : 'text-green-900'}`}>
                  {i.kind === 'member_announce' ? 'New member' : i.kind === 'resource_announce' ? 'New resource' : i.author}
                </p>
                <p className="text-[10px] text-muted">{i.timeAgo}</p>
              </div>
            </div>
            {i.title && <p className="font-serif text-green-900 text-[17px] leading-snug font-semibold mb-1">{i.title}</p>}
            {i.body && <p className="text-[12.5px] leading-relaxed text-secondary">{i.body}</p>}
            {i.when && <p className="text-[11px] text-gold-800 font-semibold mt-2">{i.when}</p>}
            {typeof i.replies === 'number' && <p className="text-[11px] text-gold-800 font-semibold mt-2">{i.replies} replies →</p>}
          </div>
        </article>
      ))}
    </div>
  );
}
