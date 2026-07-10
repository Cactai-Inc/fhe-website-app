import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone, Smartphone, Globe } from 'lucide-react';
import { fetchViewCards, type FeedCard } from '../../lib/communityFeed';
import { SEED_ENABLED, type FeedView } from '../../lib/seed';
import {
  mailHref, smsHref, telHref, whatsappHref, type ContactInfo,
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
function ContactButtons({ info, url }: { info: ContactInfo; url?: string | null }) {
  const cls = 'flex-1 grid place-items-center py-2 border border-green-800/10 rounded-lg text-green-700 hover:bg-green-50 focus-ring';
  const links: { key: string; href: string; label: string; icon: typeof Mail }[] = [];
  if (info.email) links.push({ key: 'email', href: mailHref(info.email), label: 'Email', icon: Mail });
  if (info.mobile && info.allowSms !== false) links.push({ key: 'sms', href: smsHref(info.mobile), label: 'Text', icon: MessageCircle });
  if (info.whatsapp && (info.allowWhatsappText !== false || info.allowWhatsappCall !== false)) links.push({ key: 'wa', href: whatsappHref(info.whatsapp), label: 'WhatsApp', icon: Smartphone });
  if (info.mobile && info.allowCall !== false) links.push({ key: 'call', href: telHref(info.mobile), label: 'Call', icon: Phone });
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

function Card({ c }: { c: FeedCard }) {
  return (
    <article className="rounded-xl border border-green-800/10 bg-white overflow-hidden mb-4 break-inside-avoid">
      {c.mediaUrl && <MediaBlock url={c.mediaUrl} label={c.kind === 'for_sale' ? (c.saleTag || 'For Sale') : c.kind === 'social' ? 'Social' : undefined} />}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar initials={c.authorInitials} />
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-green-900">{c.author || c.title}</p>
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
  const [cards, setCards] = useState<FeedCard[] | null>(null);

  useEffect(() => {
    let active = true;
    setCards(null);
    fetchViewCards(view)
      .then((c) => { if (active) setCards(c); })
      .catch(() => { if (active) setCards([]); });
    return () => { active = false; };
  }, [view]);

  if (cards === null) return <p className="body-text text-muted text-sm">Loading…</p>;

  // Empty → seed fallback (preview) or a real empty state.
  if (cards.length === 0) {
    if (SEED_ENABLED) return <SeedFallback view={view} />;
    return <EmptyState view={view} />;
  }

  // Members → roster
  if (view === 'members') {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((m) => (
          <div key={m.id} className="bg-white border border-green-800/10 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-11 h-11 rounded-full bg-green-100 text-green-800 grid place-items-center text-base font-serif font-semibold">{m.authorInitials}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-900 truncate">{m.title}</p>
                <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold">{m.role}</p>
              </div>
            </div>
            <ContactButtons info={{
              email: m.email, mobile: m.mobile, whatsapp: m.whatsapp,
              allowSms: m.allowSms, allowCall: m.allowCall,
              allowWhatsappText: m.allowWhatsapp, allowWhatsappCall: m.allowWhatsapp,
            }} />
          </div>
        ))}
      </div>
    );
  }

  // Resources → listing cards
  if (view === 'resources') {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((r) => (
          <div key={r.id} className="bg-white border border-green-800/10 rounded-xl p-4">
            <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug mb-1">{r.title}</p>
            {r.body && <p className="text-[12px] text-muted mb-3">{r.body}</p>}
            <ContactButtons info={{ email: r.email, mobile: r.mobile }} url={r.url} />
          </div>
        ))}
      </div>
    );
  }

  // Articles → reading list
  if (view === 'articles') {
    return (
      <div className="flex flex-col gap-3.5">
        {cards.map((a) => (
          <div key={a.id} className="flex gap-3.5 p-3.5 bg-white border border-green-800/10 rounded-xl hover:shadow-[0_10px_22px_-14px_rgba(13,33,24,0.18)] transition-shadow cursor-pointer">
            <div className="w-24 h-[70px] rounded-lg bg-gradient-to-br from-green-50 to-gold-50 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold">Article · {a.readMins} min</p>
              <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug my-0.5">{a.title}</p>
              {a.body && <p className="text-[12px] text-muted leading-snug line-clamp-2">{a.body}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // For Sale → square grid
  if (view === 'for_sale') {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {cards.map((l) => (
          <div key={l.id} className="bg-white border border-green-800/10 rounded-xl overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform">
            <div className="relative aspect-square bg-gradient-to-br from-green-50 to-gold-50 overflow-hidden">
              {l.mediaUrl && <img src={l.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
              {l.saleTag && <span className="absolute top-2.5 left-2.5 bg-cream/90 text-[9px] tracking-wide uppercase px-2 py-1 rounded-full text-green-800 font-semibold">{l.saleTag}</span>}
              {l.price && <span className="absolute bottom-2.5 right-2.5 bg-green-800 text-gold-200 font-serif text-sm px-2.5 py-0.5 rounded-lg">{l.price}</span>}
            </div>
            <div className="px-3.5 py-2.5">
              <p className="font-serif text-green-900 text-[15px] font-semibold leading-snug">{l.title || l.body}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // All / Social / Discussions / Events → cards (masonry)
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {cards.map((c) => <Card key={`${c.kind}-${c.id}`} c={c} />)}
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
