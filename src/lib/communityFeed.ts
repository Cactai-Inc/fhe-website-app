/* Federated community feed. The product's single "community" surface spans several
 * real backends: feed_posts (social + for-sale), threads (discussions), events,
 * content_posts (articles), content_resources (resources), and the member directory
 * (members). This module fetches the right source(s) for the active view and
 * normalizes them to one card shape the UI renders. "All" merges the post-like
 * sources newest-first. Unseen counts come from feed_get's per-post seen flag for
 * feed-backed types; the reference views (members/resources/articles) don't carry a
 * per-item seen state yet, so their badge is derived from recency (best-effort)
 * until a seen-state is added. */
import {
  feedGet, type FeedPost,
} from './feed';
import { supabase } from './supabase';
import {
  fetchThreads, fetchContentPosts, fetchResources, fetchEvents, fetchMemberDirectory,
  fetchAnnouncements,
} from './community';
import { listVendors, type Vendor } from './stable';
import type {
  Thread, ContentPost, ContentResource, CommunityEvent, MemberDirectoryEntry, Announcement,
} from './community-types';
import type { FeedView } from './seed';
import type { PreferredContact } from './contact';

export interface FeedCard {
  id: string;
  view: Exclude<FeedView, 'all'>;
  kind: 'social' | 'for_sale' | 'discussion' | 'event' | 'article' | 'resource' | 'member' | 'announcement';
  title?: string;
  body?: string;
  mediaUrl?: string;
  mediaKind?: 'image' | 'video';
  author?: string;
  authorInitials?: string;
  authorAvatar?: string | null;
  when?: string;              // human label
  ts: number;                 // sort key (ms)
  seen?: boolean;
  // type-specific
  saleKind?: 'horse' | 'gear' | 'free';
  saleTag?: string;
  price?: string;
  replies?: number;
  audience?: string;
  readMins?: number;
  role?: string;
  /** discussion: thread id (for fetching the thread + replies in the modal) */
  threadId?: string;
  /** article: slug (for fetching the full post body in the modal) */
  slug?: string;
  /** article cover image */
  coverUrl?: string | null;
  /** event: raw times + place for the modal */
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  /** member cards: the member's user_id (Say-hi target) + avatar. */
  memberUserId?: string;
  memberAvatar?: string | null;
  isHorseOwner?: boolean;
  preferredContact?: PreferredContact;
  socialInstagram?: string | null;
  socialFacebook?: string | null;
  socialLinkedin?: string | null;
  socialTiktok?: string | null;
  // contact (members/resources)
  email?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  url?: string | null;
  /** click-through target (discussion/article detail) */
  to?: string;
  // per-channel permissions (members; from the directory's shared prefs)
  allowSms?: boolean;
  allowCall?: boolean;
  allowWhatsapp?: boolean;      // WhatsApp chat
  allowWhatsappCall?: boolean;  // WhatsApp voice call
}

export function initials(name: string | null | undefined, fallback = '·'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || fallback;
}
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}

// ── Normalizers ────────────────────────────────────────────────
function fromFeedPost(p: FeedPost): FeedCard {
  const isSale = p.post_type === 'horse' || p.post_type === 'gear';
  // feed_get resolves author_name to the business name for any staff/owner author
  // (or an as_company post) and to the member's real name otherwise — so we just
  // trust author_name. author_is_company drives the brand mark vs personal avatar.
  const isCompany = p.author_is_company ?? p.as_company;
  const author = p.author_name || (isCompany ? 'French Heritage Equestrian' : 'Member');
  return {
    id: p.id,
    view: isSale ? 'for_sale' : 'social',
    kind: isSale ? 'for_sale' : 'social',
    body: p.body ?? undefined,
    mediaUrl: p.media_url ?? undefined,
    mediaKind: p.media_kind ?? undefined,
    author,
    authorInitials: isCompany ? 'FH' : initials(author, 'M'),
    authorAvatar: isCompany ? null : (p.author_avatar ?? null),
    when: ago(p.publish_at),
    ts: new Date(p.publish_at).getTime(),
    seen: p.seen,
    saleKind: p.post_type === 'horse' ? 'horse' : p.post_type === 'gear' ? 'gear' : undefined,
    saleTag: p.post_type === 'horse' ? 'Horse' : p.post_type === 'gear' ? 'Gear' : undefined,
  };
}
function fromThread(t: Thread): FeedCard {
  const name = t.author?.display_name || t.author?.first_name || 'Member';
  return {
    id: t.id, view: 'discussions', kind: 'discussion', threadId: t.id,
    title: t.title, body: t.body,
    author: name, authorInitials: initials(name, 'M'),
    when: ago(t.last_post_at || t.created_at), ts: new Date(t.last_post_at || t.created_at).getTime(),
  };
}
function fromEvent(e: CommunityEvent): FeedCard {
  return {
    id: e.id, view: 'events', kind: 'event',
    title: e.title, body: e.description ?? undefined,
    author: 'French Heritage Equestrian', authorInitials: 'FH',
    when: new Date(e.starts_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    ts: new Date(e.starts_at).getTime(),
    startsAt: e.starts_at, endsAt: e.ends_at, location: e.location,
  };
}
function fromArticle(a: ContentPost): FeedCard {
  return {
    id: a.id, view: 'articles', kind: 'article', slug: a.slug,
    title: a.title, body: a.excerpt ?? undefined, coverUrl: a.cover_url,
    author: 'French Heritage Equestrian', authorInitials: 'FH',
    when: ago(a.created_at), ts: new Date(a.created_at).getTime(),
    readMins: Math.max(2, Math.round((a.body?.length ?? 600) / 900)),
  };
}
function fromResource(r: ContentResource): FeedCard {
  return {
    id: r.id, view: 'resources', kind: 'resource',
    title: r.title, body: r.description ?? undefined,
    ts: new Date(r.created_at).getTime(), when: ago(r.created_at),
  };
}
/** Shared vendors (member share-back from My Stable) also list in Resources. */
function fromVendor(v: Vendor): FeedCard {
  return {
    id: `vendor-${v.id}`, view: 'resources', kind: 'resource',
    title: v.name, body: [v.category, v.note].filter(Boolean).join(' · ') || undefined,
    ts: 0,
    email: v.email, mobile: v.phone, url: v.url,
  };
}
function fromMember(m: MemberDirectoryEntry): FeedCard {
  const name = m.display_name || m.first_name || 'Member';
  // Horse owners carry a "Horse Owner" tag alongside their riding role.
  const role = [m.riding_level || 'Rider', m.is_horse_owner ? 'Horse Owner' : null].filter(Boolean).join(' · ');
  return {
    id: m.user_id, view: 'members', kind: 'member',
    title: name, role,
    authorInitials: initials(name, 'M'),
    // a member is a feed item too (shown in All + Members) with a Say-hi target;
    // the card clicks through to their profile.
    memberUserId: m.user_id,
    memberAvatar: m.avatar_url ?? null,
    ts: 0,
    bio: m.bio ?? undefined,
    isHorseOwner: m.is_horse_owner,
    preferredContact: m.preferred_contact,
    socialInstagram: m.social_instagram,
    socialFacebook: m.social_facebook,
    socialLinkedin: m.social_linkedin,
    socialTiktok: m.social_tiktok,
    // Shared contact fields straight from the widened member_directory view —
    // hide-from-community is enforced server-side (hidden → null); the per-channel
    // allow-flags travel with the card so the buttons honor them exactly.
    email: m.email,
    mobile: m.mobile,
    whatsapp: m.whatsapp,
    allowSms: m.allow_sms,
    allowCall: m.allow_call,
    allowWhatsapp: m.allow_whatsapp,
    allowWhatsappCall: m.allow_whatsapp_call,
  };
}

function fromAnnouncement(a: Announcement): FeedCard {
  return {
    id: a.id, view: 'social', kind: 'announcement',
    title: a.title, body: a.body,
    author: 'Announcement',
    when: ago(a.created_at),
    // pinned announcements float above everything in the merged stream
    ts: a.pinned ? Number.MAX_SAFE_INTEGER : new Date(a.created_at).getTime(),
  };
}

// ── Public: fetch cards for a view ─────────────────────────────
export async function fetchViewCards(view: FeedView): Promise<FeedCard[]> {
  switch (view) {
    case 'discussions': return (await fetchThreads()).map(fromThread);
    case 'events':      return (await fetchEvents()).map(fromEvent);
    case 'articles':    return (await fetchContentPosts()).map(fromArticle);
    case 'resources': {
      // content_resources + shared vendors (share-back from My Stable) in one list
      const [resources, vendors] = await Promise.all([
        fetchResources().catch(() => []),
        listVendors(true).catch(() => [] as Vendor[]),
      ]);
      return [...resources.map(fromResource), ...vendors.map(fromVendor)];
    }
    case 'members':     return (await fetchMemberDirectory()).map(fromMember);
    case 'for_sale': {
      const { posts } = await feedGet();
      return posts.filter((p) => p.post_type === 'horse' || p.post_type === 'gear').map(fromFeedPost);
    }
    case 'social': {
      const { posts } = await feedGet();
      return posts.filter((p) => p.post_type === 'rider_post' || p.post_type === 'marketing').map(fromFeedPost);
    }
    case 'all':
    default: {
      // "All" = the whole feed, unfiltered: posts + discussions + events + articles +
      // announcements + the member directory (members ARE feed items too — the buttons
      // are filters over one feed, not separate content types). Newest-first.
      const [{ posts }, threads, events, articles, announcements, members] = await Promise.all([
        feedGet(),
        fetchThreads().catch(() => [] as Thread[]),
        fetchEvents().catch(() => [] as CommunityEvent[]),
        fetchContentPosts().catch(() => [] as ContentPost[]),
        fetchAnnouncements().catch(() => [] as Announcement[]),
        fetchMemberDirectory().catch(() => [] as MemberDirectoryEntry[]),
      ]);
      const cards: FeedCard[] = [
        // member_joined posts are superseded by the member directory cards below.
        ...posts.filter((p) => p.post_type !== 'member_joined').map(fromFeedPost),
        ...threads.map(fromThread),
        ...events.map(fromEvent),
        ...articles.map(fromArticle),
        ...announcements.filter((a) => a.published).map(fromAnnouncement),
        ...members.map(fromMember),
      ];
      return cards.sort((a, b) => b.ts - a.ts);
    }
  }
}

/** Per-view unseen counts. Feed-backed views (social/for-sale) use the real seen
 *  flag from feed_get. Discussions/events/articles/resources/members have no
 *  per-item seen state yet → omitted (no badge) rather than faked. Returns a sparse
 *  map; a missing key means "no badge". */
export async function fetchUnseenCounts(): Promise<Partial<Record<FeedView, number>>> {
  try {
    const { posts } = await feedGet();
    let social = 0; let forSale = 0;
    for (const p of posts) {
      if (p.seen) continue;
      if (p.post_type === 'horse' || p.post_type === 'gear') forSale += 1;
      else if (p.post_type === 'rider_post' || p.post_type === 'marketing') social += 1;
    }
    const out: Partial<Record<FeedView, number>> = {};
    if (social) out.social = social;
    if (forSale) out.for_sale = forSale;
    return out;
  } catch {
    return {};
  }
}

// ── New-member greetings (say hi / say hi back) ─────────────────────────────

/** Say hi to a new member (one-time). Returns true if this recorded the greeting. */
export async function sayHi(toUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('say_hi', { p_to_user: toUserId });
  if (error) throw error;
  return Boolean(data);
}

/** Reply to a greeter with a thank-you note (one-time). */
export async function sayHiBack(toUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('say_hi_back', { p_to_user: toUserId });
  if (error) throw error;
  return Boolean(data);
}

/** The set of member user_ids the signed-in member has already said hi to — so the
 *  feed can show the button as done without a round-trip per card. */
export async function myGreetedUserIds(): Promise<Set<string>> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return new Set();
  const { data, error } = await supabase
    .from('member_greetings').select('to_user').eq('from_user', uid).eq('kind', 'hi');
  if (error) return new Set();
  return new Set((data ?? []).map((r: { to_user: string }) => r.to_user));
}
