/* Community / members-app domain types
 * (supabase/migrations/20260623040000_community.sql).
 */
import type { PreferredContact } from './contact';

export type MemberStatus = 'active' | 'paused' | 'cancelled';
export type ResourceKind = 'file' | 'video' | 'link';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface Member {
  id: string;
  user_id: string;
  status: MemberStatus;
  started_at: string;
  renews_at: string | null;
}

export interface MemberDirectoryEntry {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  riding_level: string | null;
  /** The five community channels (hide-from-community enforced in the
   *  member_directory_list RPC — a hidden field arrives as null, so a present
   *  value IS an offered channel). */
  community_email: string | null;
  mobile_call: string | null;
  mobile_text: string | null;
  whatsapp_call: string | null;
  whatsapp_text: string | null;
  // The old one-value-plus-allow-toggles columns (email, mobile, whatsapp,
  // allow_*) are deliberately NOT declared here — and as of SECFIX2 G2 they are
  // no longer SENT either: the member_directory_list RPC does not select them,
  // so the Stage A deprecation window is closed on the read path. The columns
  // still exist on `contacts`; dropping them there is still a DB change and
  // still not this thread's.
  social_tiktok: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  /** true when this member owns at least one horse in the system */
  is_horse_owner: boolean;
  /** the member's preferred contact method (hidden channels suppressed to 'none') */
  preferred_contact: PreferredContact;
}

/** A horse a member owns — for their community profile. */
export interface MemberHorse {
  name: string | null;
  home_location: string | null;
}

export interface Announcement {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  published: boolean;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  hidden: boolean;
  created_at: string;
  // joined for display
  author?: { display_name: string | null; first_name: string | null; avatar_url: string | null };
}

export interface Thread {
  id: string;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  created_at: string;
  last_post_at: string;
  author?: { display_name: string | null; first_name: string | null };
}

export interface ThreadPost {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  hidden: boolean;
  created_at: string;
  author?: { display_name: string | null; first_name: string | null; avatar_url: string | null };
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

/** One conversation row from dm_list_conversations() — a partner + the last
 *  message + unread count, for the messenger's conversation list. */
export interface DmConversation {
  user_id: string;               // the OTHER party
  display_name: string | null;
  first_name: string | null;
  avatar_url: string | null;
  last_body: string | null;      // null when the last message was deleted
  last_mine: boolean;
  last_at: string;
  unread: number;
}

export interface ContentPost {
  id: string;
  author_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentResource {
  id: string;
  title: string;
  description: string | null;
  kind: ResourceKind;
  url: string | null;
  storage_path: string | null;
  /** TASK-UPLOADS: the `files` row holding the bytes. The company's material is
   *  stored once, owned by the ORG, and catalogued here. Null on link/video
   *  resources, which have no stored object. */
  file_id: string | null;
  published: boolean;
  created_at: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  capacity: number | null;
  published: boolean;
}

export interface EventRsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
}

export interface MemberGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
