/* Admin data-access layer. All operations here require is_admin() (enforced by RLS);
 * the admin UI is additionally gated by ProtectedRoute requireAdmin.
 */
import { supabase } from './supabase';
import type { Profile } from './types';
import type {
  Announcement, ContentPost, ContentResource, CommunityEvent,
} from './community-types';

// ─── Members ─────────────────────────────────────────────────────────────────
/** The role values stored on profiles.role (migration 25). USER = rider;
 *  MANAGER/EMPLOYEE = instructor (servicing subset); ADMIN = tenant admin;
 *  SUPER_ADMIN = platform. The admin UI promotes/demotes with adminSetRole. */
export type MemberRole = 'USER' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AdminMemberRow extends Profile {
  membership_status?: string | null;
  membership_tier?: string | null;
  role?: MemberRole | null;
}

export async function adminListMembers(): Promise<AdminMemberRow[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: memberships } = await supabase.from('memberships').select('user_id, status, tier');
  const byUser = new Map((memberships ?? []).map((m) => [m.user_id, m]));
  return (profiles ?? []).map((p: Profile & { role?: MemberRole | null }) => ({
    ...p,
    membership_status: byUser.get(p.user_id)?.status ?? null,
    membership_tier: byUser.get(p.user_id)?.tier ?? null,
    role: p.role ?? 'USER',
  }));
}

/** Promote/demote an activated user by writing profiles.role — the authoritative
 *  role the app derives nav + surfaces from. Setting MANAGER makes the user an
 *  instructor (servicing subset); ADMIN makes them a tenant admin; USER returns
 *  them to a rider. RLS enforces that only an admin may call this. Keeps the legacy
 *  is_admin boolean in step so older checks stay consistent. */
export async function adminSetRole(userId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, is_admin: role === 'ADMIN' || role === 'SUPER_ADMIN' })
    .eq('user_id', userId);
  if (error) throw error;
  await logModeration('user', userId, `set_role_${role.toLowerCase()}`);
}

export async function adminSetSuspended(userId: string, suspended: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_suspended: suspended }).eq('user_id', userId);
  if (error) throw error;
  await logModeration('user', userId, suspended ? 'suspend' : 'reinstate');
}

export async function adminSetAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('user_id', userId);
  if (error) throw error;
}

export async function adminUpsertMembership(
  userId: string,
  tier: string,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from('memberships')
    .upsert({ user_id: userId, tier, status }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ─── Moderation ──────────────────────────────────────────────────────────────
export async function logModeration(
  targetType: string,
  targetId: string,
  action: string,
  reason?: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from('moderation_actions').insert({
    moderator_id: auth.user?.id ?? null,
    target_type: targetType,
    target_id: targetId,
    action,
    reason: reason ?? null,
  });
}

export async function adminHideChannelMessage(id: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from('channel_messages').update({ hidden }).eq('id', id);
  if (error) throw error;
  await logModeration('channel_message', id, hidden ? 'hide' : 'unhide');
}

export async function adminHideThread(id: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from('threads').update({ hidden }).eq('id', id);
  if (error) throw error;
  await logModeration('thread', id, hidden ? 'hide' : 'unhide');
}

export async function adminHideThreadPost(id: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from('thread_posts').update({ hidden }).eq('id', id);
  if (error) throw error;
  await logModeration('thread_post', id, hidden ? 'hide' : 'unhide');
}

// ─── Posting from the company account ────────────────────────────────────────
export async function adminCreateAnnouncement(
  input: { title: string; body: string; pinned?: boolean },
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('announcements').insert({
    author_id: auth.user?.id ?? null,
    title: input.title,
    body: input.body,
    pinned: input.pinned ?? false,
    published: true,
  });
  if (error) throw error;
}

export async function adminListAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function adminCreateEvent(
  input: { title: string; description?: string; starts_at: string; ends_at?: string; location?: string; capacity?: number },
): Promise<void> {
  const { error } = await supabase.from('events').insert({
    title: input.title,
    description: input.description ?? null,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    location: input.location ?? null,
    capacity: input.capacity ?? null,
    published: true,
  });
  if (error) throw error;
}

export async function adminListEvents(): Promise<CommunityEvent[]> {
  const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CommunityEvent[];
}

export async function adminCreateContentPost(
  input: { title: string; slug: string; excerpt?: string; body: string; cover_url?: string; published?: boolean },
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('content_posts').insert({
    author_id: auth.user?.id ?? null,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt ?? null,
    body: input.body,
    cover_url: input.cover_url ?? null,
    published: input.published ?? false,
  });
  if (error) throw error;
}

export async function adminListContentPosts(): Promise<ContentPost[]> {
  const { data, error } = await supabase.from('content_posts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentPost[];
}

export async function adminCreateResource(
  input: { title: string; description?: string; kind: 'file' | 'video' | 'link'; url?: string; storage_path?: string },
): Promise<void> {
  const { error } = await supabase.from('content_resources').insert({
    title: input.title,
    description: input.description ?? null,
    kind: input.kind,
    url: input.url ?? null,
    storage_path: input.storage_path ?? null,
    published: true,
  });
  if (error) throw error;
}

export async function adminListResources(): Promise<ContentResource[]> {
  const { data, error } = await supabase.from('content_resources').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentResource[];
}

// ─── Invitations (admin creates token + sends email) ─────────────────────────
export interface AdminInviteResult {
  registerUrl: string;
  emailed: boolean;
  /** Present when the invite provisioned a purchase (offeringId was sent). */
  offeringLabel?: string;
}

/**
 * Create an invitation and send the registration email via the serverless
 * function (which holds the email-provider key). Returns the register URL so the
 * admin can copy it as a fallback if email delivery is not yet configured.
 *
 * When `offeringId` is present the server provisions the offline purchase
 * (provision_lesson_invitation: contact + client + engagement + paid
 * transaction + invitation) — firstName/lastName are required on that path.
 */
export async function adminSendInvitation(
  input: {
    email: string; requestId?: string; expiresInDays?: number;
    firstName?: string; lastName?: string; offeringId?: string;
    markPaid?: boolean; paymentMethod?: string; notes?: string;
    /** Account type to provision — 'MANAGER' (instructor) / 'ADMIN' need admin caller. */
    role?: 'USER' | 'MANAGER' | 'ADMIN';
  },
): Promise<AdminInviteResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const res = await fetch('/api/admin-send-invitation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || 'Could not send invitation.');
  }
  return (await res.json()) as AdminInviteResult;
}

// ─── Offerings catalog (admin CRUD) ──────────────────────────────────────────
// The public surfaces (site pricing, booking, checkout, invites) all read
// offerings via fetchOfferings (active only). This admin reach sees BOTH
// published and unpublished rows and writes through offerings_admin_write RLS,
// so an edit here lands at every visibility point immediately.
import type { Offering, Segment, PriceUnitDb, PurchaseType } from './types';

export interface OfferingInput {
  segment: Segment;
  name: string;
  tagline?: string | null;
  description?: string | null;
  service_type?: string | null;
  price_amount?: number | null;
  price_unit?: PriceUnitDb | null;
  price_min?: number | null;
  purchase_type?: PurchaseType | null;
  horse_included?: boolean | null;
  is_popular?: boolean;
  note?: string | null;
  active?: boolean;
  sort_order?: number;
}

export async function adminListOfferings(): Promise<Offering[]> {
  const { data, error } = await supabase
    .from('offerings').select('*')
    .order('segment').order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []) as Offering[];
}

/** kebab-case the name into a slug namespace-prefixed by segment. */
function slugify(segment: string, name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${segment}-${base}`.slice(0, 60);
}

/** Collision-free auto-naming: slug from segment+name; -2, -3… on collision. */
async function uniqueSlug(segment: string, name: string): Promise<string> {
  const want = slugify(segment, name);
  const { data, error } = await supabase
    .from('offerings').select('slug').like('slug', `${want}%`);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r) => (r as { slug: string }).slug));
  if (!taken.has(want)) return want;
  for (let n = 2; ; n += 1) {
    const candidate = `${want}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function adminCreateOffering(input: OfferingInput): Promise<Offering> {
  const slug = await uniqueSlug(input.segment, input.name);
  const { data, error } = await supabase
    .from('offerings')
    .insert({ ...input, slug })
    .select('*')
    .single();
  if (error) throw error;
  return data as Offering;
}

export async function adminUpdateOffering(id: string, patch: Partial<OfferingInput>): Promise<void> {
  const { error } = await supabase.from('offerings').update(patch).eq('id', id);
  if (error) throw error;
}
