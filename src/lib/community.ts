/* Community data-access layer + Realtime helpers. RLS enforces member-gating and
 * ownership server-side; these are thin typed wrappers.
 */
import { supabase } from './supabase';
import type {
  Membership, MemberDirectoryEntry, MemberHorse, Announcement, Channel, ChannelMessage,
  Thread, ThreadPost, DirectMessage, ContentPost, ContentResource,
  CommunityEvent, EventRsvp, RsvpStatus,
} from './community-types';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// ─── Membership ──────────────────────────────────────────────────────────────
export async function getMyMembership(): Promise<Membership | null> {
  const { data, error } = await supabase.from('memberships').select('*').maybeSingle();
  if (error) throw error;
  return (data as Membership) ?? null;
}

// ─── Directory ───────────────────────────────────────────────────────────────
export async function fetchMemberDirectory(): Promise<MemberDirectoryEntry[]> {
  const { data, error } = await supabase
    .from('member_directory')
    .select('*')
    .order('display_name', { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as MemberDirectoryEntry[];
}

/** A single member's public profile (from the same directory view, so hide/allow
 *  prefs are already enforced). Returns null if not a visible member. */
export async function fetchMemberProfile(userId: string): Promise<MemberDirectoryEntry | null> {
  const { data, error } = await supabase
    .from('member_directory')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as MemberDirectoryEntry | null;
}

/** A member's owned horses (name + home location) for their community profile. */
export async function fetchMemberHorses(userId: string): Promise<MemberHorse[]> {
  const { data, error } = await supabase.rpc('member_horses', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as MemberHorse[];
}

// ─── Announcements ───────────────────────────────────────────────────────────
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

// ─── Channels + messages (real-time chat) ────────────────────────────────────
export async function fetchChannels(): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export async function fetchChannelMessages(channelId: string, limit = 100): Promise<ChannelMessage[]> {
  const { data, error } = await supabase
    .from('channel_messages')
    .select('*, author:profiles!channel_messages_author_id_fkey(display_name, first_name, avatar_url)')
    .eq('channel_id', channelId)
    .eq('hidden', false)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChannelMessage[];
}

export async function sendChannelMessage(channelId: string, body: string): Promise<void> {
  const author_id = await uid();
  const { error } = await supabase
    .from('channel_messages')
    .insert({ channel_id: channelId, author_id, body });
  if (error) throw error;
}

/** Subscribe to new messages in a channel. Returns an unsubscribe function. */
export function subscribeToChannel(channelId: string, onInsert: (m: ChannelMessage) => void): () => void {
  const channel = supabase
    .channel(`channel-messages-${channelId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
      (payload) => onInsert(payload.new as ChannelMessage),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Threads (forum) ─────────────────────────────────────────────────────────
export async function fetchThreads(): Promise<Thread[]> {
  const { data, error } = await supabase
    .from('threads')
    .select('*, author:profiles!threads_author_id_fkey(display_name, first_name)')
    .eq('hidden', false)
    .order('pinned', { ascending: false })
    .order('last_post_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Thread[];
}

export async function fetchThread(id: string): Promise<{ thread: Thread; posts: ThreadPost[] }> {
  const { data: thread, error } = await supabase
    .from('threads')
    .select('*, author:profiles!threads_author_id_fkey(display_name, first_name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  const { data: posts, error: postErr } = await supabase
    .from('thread_posts')
    .select('*, author:profiles!thread_posts_author_id_fkey(display_name, first_name, avatar_url)')
    .eq('thread_id', id)
    .eq('hidden', false)
    .order('created_at', { ascending: true });
  if (postErr) throw postErr;
  return { thread: thread as Thread, posts: (posts ?? []) as ThreadPost[] };
}

export async function createThread(title: string, body: string): Promise<string> {
  const author_id = await uid();
  const { data, error } = await supabase
    .from('threads')
    .insert({ author_id, title, body })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function replyToThread(threadId: string, body: string): Promise<void> {
  const author_id = await uid();
  const { error } = await supabase.from('thread_posts').insert({ thread_id: threadId, author_id, body });
  if (error) throw error;
  // Bump last_post_at (best-effort; admins/authors can update threads).
  await supabase.from('threads').update({ last_post_at: new Date().toISOString() }).eq('id', threadId);
}

// ─── Direct messages ─────────────────────────────────────────────────────────
export async function fetchConversation(otherUserId: string): Promise<DirectMessage[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${me})`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

export async function sendDirectMessage(recipientId: string, body: string): Promise<void> {
  const sender_id = await uid();
  const { error } = await supabase
    .from('direct_messages')
    .insert({ sender_id, recipient_id: recipientId, body });
  if (error) throw error;
}

/** Subscribe to DMs addressed to me. Returns unsubscribe. */
export function subscribeToMyDirectMessages(myId: string, onInsert: (m: DirectMessage) => void): () => void {
  const channel = supabase
    .channel(`dm-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${myId}` },
      (payload) => onInsert(payload.new as DirectMessage),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function listMyConversations(): Promise<DirectMessage[]> {
  // Most-recent message per counterpart; client groups by the other party.
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

// ─── Content ─────────────────────────────────────────────────────────────────
export async function fetchContentPosts(): Promise<ContentPost[]> {
  const { data, error } = await supabase
    .from('content_posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentPost[];
}

export async function fetchContentPost(slug: string): Promise<ContentPost | null> {
  const { data, error } = await supabase.from('content_posts').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data as ContentPost) ?? null;
}

export async function fetchResources(): Promise<ContentResource[]> {
  const { data, error } = await supabase
    .from('content_resources')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentResource[];
}

/** Signed URL for a Storage-backed resource (private 'members' bucket). */
export async function resourceDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('members').createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

// ─── Events + RSVP ───────────────────────────────────────────────────────────
export async function fetchEvents(): Promise<CommunityEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('published', true)
    .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommunityEvent[];
}

export async function fetchMyRsvps(): Promise<EventRsvp[]> {
  const me = await uid();
  const { data, error } = await supabase.from('event_rsvps').select('*').eq('user_id', me);
  if (error) throw error;
  return (data ?? []) as EventRsvp[];
}

export async function setRsvp(eventId: string, status: RsvpStatus): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from('event_rsvps')
    .upsert({ event_id: eventId, user_id, status }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
}

export interface ProposeEventInput {
  title: string;
  starts_at: string;         // ISO
  ends_at?: string | null;
  location?: string | null;
  description?: string | null;
}

/** Host an event (Slice 4): members propose an UNPUBLISHED event that operators
 *  review and publish. Riding-gated server-side. Returns the new event id. */
export async function proposeEvent(input: ProposeEventInput): Promise<string> {
  const { data, error } = await supabase.rpc('propose_community_event', {
    p_title: input.title,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at ?? null,
    p_location: input.location ?? null,
    p_description: input.description ?? null,
  });
  if (error) throw error;
  return data as string;
}
