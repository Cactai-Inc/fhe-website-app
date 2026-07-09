/* Feed data seams (Slice 3) — the app Home feed. Thin wrappers over the feed_*
 * RPCs + feed-media storage. RLS/RPC are the authority; these shape the calls. */
import { supabase } from './supabase';

export type FeedPostType = 'horse' | 'gear' | 'rider_post' | 'event' | 'article' | 'marketing';
export type FeedMediaKind = 'image' | 'video';
export type FeedVisibility = 'public' | 'members' | 'both';
export type FeedViewShape = 'blended' | 'pockets' | 'separate';

export interface FeedPost {
  id: string;
  post_type: FeedPostType;
  media_url: string;
  media_kind: FeedMediaKind;
  body: string | null;
  source_link: string | null;
  subject_horse_id: string | null;
  visibility: FeedVisibility;
  publish_at: string;
  as_company: boolean;
  author_id: string | null;
  seen: boolean;
  shared_by: string | null;
}

export interface FeedAccountItem {
  id: string;
  kind: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  resolved: boolean;
  publish_at: string;
}

export interface FeedResult {
  shape: FeedViewShape;
  posts: FeedPost[];
  account_items: FeedAccountItem[];
}

/** Idempotently seed the first-run welcome/orientation/purchase cards. */
export async function feedSeedWelcome(): Promise<void> {
  const { error } = await supabase.rpc('feed_seed_welcome');
  if (error) throw error;
}

/** The assembled feed for the signed-in user. */
export async function feedGet(limit = 50, before?: string): Promise<FeedResult> {
  const { data, error } = await supabase.rpc('feed_get', { p_limit: limit, p_before: before ?? null });
  if (error) throw error;
  return data as FeedResult;
}

export interface FeedPostInput {
  post_type: FeedPostType;
  media_url: string;
  media_kind: FeedMediaKind;
  body?: string | null;
  source_link?: string | null;
  subject_horse_id?: string | null;
  as_company?: boolean;
  visibility?: FeedVisibility;
  publish_at?: string | null;   // staged/delayed publishing
}

export async function feedPostCreate(input: FeedPostInput): Promise<string> {
  const { data, error } = await supabase.rpc('feed_post_create', {
    p_type: input.post_type,
    p_media_url: input.media_url,
    p_media_kind: input.media_kind,
    p_body: input.body ?? null,
    p_source_link: input.source_link ?? null,
    p_subject_horse_id: input.subject_horse_id ?? null,
    p_as_company: input.as_company ?? false,
    p_visibility: input.visibility ?? 'members',
    p_publish_at: input.publish_at ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function feedMarkSeen(postId: string): Promise<void> {
  const { error } = await supabase.rpc('feed_mark_seen', { p_post_id: postId });
  if (error) throw error;
}

export async function feedSetViewShape(shape: FeedViewShape): Promise<void> {
  const { error } = await supabase.rpc('feed_set_view_shape', { p_shape: shape });
  if (error) throw error;
}

export async function feedShare(postId: string, toUserId: string): Promise<void> {
  const { error } = await supabase.rpc('feed_share', { p_post_id: postId, p_to_user_id: toUserId });
  if (error) throw error;
}

export async function feedReportPost(postId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('feed_report_post', { p_post_id: postId, p_reason: reason });
  if (error) throw error;
}

export async function feedModerate(postId: string, action: 'approve' | 'affirm' | 'pull_down'): Promise<void> {
  const { error } = await supabase.rpc('feed_moderate', { p_post_id: postId, p_action: action });
  if (error) throw error;
}

/** Upload one media file to the feed-media bucket under the user's folder;
 *  returns { url, kind }. Enforces single media (one file) at the call site. */
export async function uploadFeedMedia(file: File): Promise<{ url: string; kind: FeedMediaKind }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('not signed in');
  const kind: FeedMediaKind = file.type.startsWith('video/') ? 'video' : 'image';
  const ext = file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg');
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('feed-media').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('feed-media').getPublicUrl(path);
  return { url: data.publicUrl, kind };
}
