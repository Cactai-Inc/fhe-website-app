/* Admin data-access layer. All operations here require is_admin() (enforced by RLS);
 * the admin UI is additionally gated by ProtectedRoute requireAdmin.
 */
import { supabase } from './supabase';
import { assertWrote } from './writeGuard';
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
  member_status?: string | null;
  role?: MemberRole | null;
}

export async function adminListMembers(): Promise<AdminMemberRow[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: members } = await supabase.from('members').select('user_id, status');
  const byUser = new Map((members ?? []).map((m) => [m.user_id, m]));
  // Phone lives on the person's contact record (profiles.phone retired,
  // D14 closure 2026-08-02) — overlay it from contacts by contact_id.
  const contactIds = (profiles ?? []).map((p) => p.contact_id).filter(Boolean) as string[];
  const phoneByContact = new Map<string, string | null>();
  if (contactIds.length) {
    const { data: contacts } = await supabase.from('contacts').select('id, phone').in('id', contactIds);
    for (const c of contacts ?? []) phoneByContact.set(c.id as string, (c.phone as string | null) ?? null);
  }
  return (profiles ?? []).map((p: Profile & { role?: MemberRole | null }) => ({
    ...p,
    phone: p.contact_id ? (phoneByContact.get(p.contact_id) ?? null) : null,
    member_status: byUser.get(p.user_id)?.status ?? null,
    role: p.role ?? 'USER',
  }));
}

/** A staff invitation that hasn't been accepted yet — no profile row exists
 *  until redemption, so these are invisible to adminListMembers. The team roster
 *  surfaces them as "Invited" rows (mirroring how the Clients page shows pending
 *  invitees), so an admin can see who's been invited and resend/revoke. */
export interface PendingStaffInvite {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  invited_role: MemberRole;
  status: string;
  expires_at: string;
  created_at: string;
}

/** Pending (sent, unexpired, unaccepted) invitations for STAFF roles only.
 *  Excludes USER invites (those show on the Clients page) and any invite whose
 *  invitee already has a profile (they've accepted → they're in the roster). */
export async function adminPendingStaffInvites(): Promise<PendingStaffInvite[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, first_name, last_name, title, invited_role, status, expires_at, created_at')
    .in('invited_role', ['MANAGER', 'ADMIN', 'EMPLOYEE'])
    .eq('status', 'sent')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingStaffInvite[];
}

/** Revoke a pending staff invite (kills the link; admin can re-send a fresh one). */
export async function adminRevokeStaffInvite(id: string): Promise<void> {
  // Guarded: a revoke filtered to zero rows by RLS returns no error, which would
  // report the link dead while it still redeems. A revoke must prove it landed.
  assertWrote(
    await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id).select('id'),
    'The revoke',
  );
}

/** Promote/demote an activated user by writing profiles.role — the authoritative
 *  role the app derives nav + surfaces from. Setting MANAGER makes the user an
 *  instructor (servicing subset); ADMIN makes them a tenant admin; USER returns
 *  them to a rider. RLS enforces that only an admin may call this. Keeps the legacy
 *  is_admin boolean in step so older checks stay consistent. */
export async function adminSetRole(userId: string, role: MemberRole): Promise<void> {
  const res = await supabase
    .from('profiles')
    .update({ role, is_admin: role === 'ADMIN' || role === 'SUPER_ADMIN' })
    .eq('user_id', userId)
    .select('user_id');
  assertWrote(res, 'The role change');
  await logModeration('user', userId, `set_role_${role.toLowerCase()}`);
}

export async function adminSetSuspended(userId: string, suspended: boolean): Promise<void> {
  const res = await supabase.from('profiles').update({ is_suspended: suspended })
    .eq('user_id', userId).select('user_id');
  assertWrote(res, 'The suspension change');
  await logModeration('user', userId, suspended ? 'suspend' : 'reinstate');
}

/** Admin-edit another member's profile fields (name, contact, riding level, bio).
 *  RLS profiles_update_own allows is_admin() to write any row. Role/suspension go
 *  through their own dedicated actions; this is identity/contact content only. */
export type MemberProfilePatch = Partial<Pick<Profile,
  'first_name' | 'last_name' | 'display_name' | 'email' | 'phone' | 'riding_level' | 'bio'>>;
export async function adminUpdateProfile(userId: string, patch: MemberProfilePatch): Promise<void> {
  // Phone lives on the person's contact record, not profiles (D14 closure —
  // same repoint as Account/Profile's updateMyContactPhone). Split it out and
  // write it through profiles.contact_id.
  const { phone, ...profilePatch } = patch;
  if (phone !== undefined) {
    const { data: prof, error: profErr } = await supabase
      .from('profiles').select('contact_id').eq('user_id', userId).maybeSingle();
    if (profErr) throw profErr;
    if (!prof?.contact_id) throw new Error('This account has no contact record to hold a phone number.');
    assertWrote(
      await supabase.from('contacts').update({ phone: phone || null }).eq('id', prof.contact_id).select('id'),
      'The phone change',
    );
  }
  if (Object.keys(profilePatch).length) {
    // `.select()` makes the write report what it touched: an RLS-filtered UPDATE
    // returns zero rows with NO error, which used to read as success.
    const res = await supabase.from('profiles').update(profilePatch).eq('user_id', userId).select('user_id');
    assertWrote(res, 'This record');
  }
  await logModeration('user', userId, 'edit_profile');
}

/** Permanently delete a team member's account (auth user cascade → profile,
 *  membership, grants). Staff have no contact row, so this keys on user_id. */
export async function adminHardDeleteMember(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not signed in');
  const res = await fetch('/api/hard-delete-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Could not delete this team member.');
  }
}

export async function adminSetAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const res = await supabase.from('profiles').update({ is_admin: isAdmin })
    .eq('user_id', userId).select('user_id');
  assertWrote(res, 'The admin change');
}

// ─── Document assignment (Stage 3f) ─────────────────────────────────────────

export interface AssignableTemplate {
  template_key: string;
  title: string;
  version: number;
  wall_gating: boolean;
  on_file_status: 'none' | 'executed' | 'superseded';
  on_file_date: string | null;
  on_file_version: number | null;
}

/** The flat sign-only template family with per-person on-file status. Only the
 *  current version of a family is returned (older versions never assignable). */
export async function staffAssignableTemplates(contactId: string): Promise<AssignableTemplate[]> {
  const { data, error } = await supabase.rpc('staff_assignable_templates', { p_contact_id: contactId });
  if (error) throw error;
  return (data ?? []) as AssignableTemplate[];
}

/** staff_assign_documents summary: what was appended to the pending set, and
 *  which templates had a satisfying signed copy that was superseded (kept as
 *  evidence) so the person is asked to RE-SIGN at next sign-in. */
export interface AssignDocumentsResult {
  assigned: string[];
  resign: string[];
}

/** Append the selected templates to the person's pending set (3f: no batch
 *  entity — assignment is rows in contact_required_documents). Assigning a
 *  template the person already signed supersedes the signed copy server-side —
 *  the assignment ALWAYS produces a pending requirement. */
export async function staffAssignDocuments(contactId: string, templateKeys: string[]): Promise<AssignDocumentsResult> {
  const { data, error } = await supabase.rpc('staff_assign_documents', {
    p_contact_id: contactId, p_template_keys: templateKeys,
  });
  if (error) throw error;
  const r = (data ?? {}) as Partial<AssignDocumentsResult>;
  return { assigned: r.assigned ?? [], resign: r.resign ?? [] };
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

/* The hides are assertWrote-guarded: RLS on these tables is
 * `(author_id = auth.uid() OR is_admin())` AND `(org_id = current_org())`, so a
 * hide aimed at another org's content — or at a row deleted in the meantime —
 * matches ZERO rows and returns no error. Unguarded, that wrote a
 * moderation_actions entry claiming content was hidden while it stayed visible:
 * the log has to record what happened, not what was attempted. */
export async function adminHideChannelMessage(id: string, hidden: boolean): Promise<void> {
  assertWrote(
    await supabase.from('channel_messages').update({ hidden }).eq('id', id).select('id'),
    hidden ? 'Hiding the message' : 'Unhiding the message',
  );
  await logModeration('channel_message', id, hidden ? 'hide' : 'unhide');
}

export async function adminHideThread(id: string, hidden: boolean): Promise<void> {
  assertWrote(
    await supabase.from('threads').update({ hidden }).eq('id', id).select('id'),
    hidden ? 'Hiding the thread' : 'Unhiding the thread',
  );
  await logModeration('thread', id, hidden ? 'hide' : 'unhide');
}

export async function adminHideThreadPost(id: string, hidden: boolean): Promise<void> {
  assertWrote(
    await supabase.from('thread_posts').update({ hidden }).eq('id', id).select('id'),
    hidden ? 'Hiding the post' : 'Unhiding the post',
  );
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

/** TASK-UPLOADS: `published` is the members' gate on company material — the
 *  content_resources row policy AND the storage policy on the underlying object
 *  both read it, so unpublishing withdraws the bytes, not just the listing. */
export async function adminSetResourcePublished(id: string, published: boolean): Promise<void> {
  assertWrote(
    await supabase.from('content_resources').update({ published }).eq('id', id).select(),
    published ? 'Publishing the file' : 'Unpublishing the file',
  );
}

// ─── Invitations (admin creates token + sends email) ─────────────────────────
export interface AdminInviteResult {
  registerUrl: string;
  emailed: boolean;
  /** Why delivery failed. Present iff `emailed` is false — never a bare false. */
  emailError?: string;
  invitationId?: string;
  /** Present when the invite provisioned a client (categories/offerings sent). */
  offeringLabel?: string | null;
  contactId?: string;
  categories?: string[];
  purchaseId?: string | null;
  amount?: number;
  /** LESSONREQUEST §L3 — the lesson this act booked, when one was agreed. */
  agreedLesson?: { booking_id: string; starts_at: string; ends_at: string } | null;
}

/**
 * Create an invitation and send the activation email via the serverless function
 * (which holds the email-provider key). Returns the activation URL so the admin
 * can copy it as a fallback if email delivery is not yet configured.
 *
 * When `categories` and/or `offeringIds` are present the server provisions the
 * client via the canonical spine (provision_client_invitation: contact + client
 * + standing categories + onboarding docs + 0..N offering purchase + invitation).
 * Names are OPTIONAL (email-only invites) — captured at first-login intake.
 * `paymentStatus` = paid | partial | unpaid; 'partial' carries `partialAmount`.
 */
export async function adminSendInvitation(
  input: {
    email: string; requestId?: string; expiresInDays?: number;
    firstName?: string; lastName?: string; title?: string;
    /** Standing account categories: GUEST / RIDER / HORSE_OWNER (stackable). */
    categories?: string[];
    /** Offering ids to purchase (child-offering ids). `offeringId` = 1-item shorthand. */
    offeringIds?: string[]; offeringId?: string;
    /** Explicit onboarding doc set (template_keys); omit to derive from categories. */
    templateKeys?: string[];
    /** Payment status; 'partial' reduces the balance shown to the invitee by `partialAmount`. */
    paymentStatus?: 'paid' | 'partial' | 'unpaid'; partialAmount?: number;
    markPaid?: boolean; paymentMethod?: string; notes?: string;
    /** Account type to provision — 'MANAGER' (instructor) / 'ADMIN' need admin caller. */
    role?: 'USER' | 'MANAGER' | 'ADMIN';
    /** Agreed start date (YYYY-MM-DD): puts the invite on the 48-hour claim-and-pay window. */
    scheduledFor?: string;
    /**
     * LESSONREQUEST §L3 — the slot agreed on the phone. Sending it makes this
     * ONE act also book the lesson (through the incumbent
     * `schedule_lesson_session` writer) and name it at the top of the
     * invitation email. Omit it and the act behaves exactly as it always has.
     */
    agreedLesson?: {
      starts_at: string; ends_at: string;
      offering_id?: string; horse_id?: string; instructor_user_id?: string;
      location?: string; notes?: string;
      /** The slot in the barn's own words — see AgreedLessonPanel. */
      display: string;
    };
    /**
     * Does minting this token RETIRE the link they may already be holding?
     * 'new' (default) leaves any prior live link working; 'regenerate' is the
     * deliberate replacement of a compromised or expired one. Sending the same
     * link again is NOT this call — that is `adminResendInvitation`.
     */
    mode?: 'new' | 'regenerate';
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
    // The endpoint returns { error, stage, code?, hint? } — surface the real
    // cause and where it happened, not a JSON blob and not a generic string.
    const payload = await res.json().catch(() => null) as
      { error?: string; stage?: string; hint?: string } | null;
    const detail = payload?.error?.trim();
    const where = payload?.stage ? ` [${payload.stage}]` : '';
    const hint = payload?.hint ? ` (${payload.hint})` : '';
    throw new Error(detail ? `${detail}${hint}${where}` : `Could not send invitation (HTTP ${res.status}).`);
  }
  return (await res.json()) as AdminInviteResult;
}

// ─── Offerings catalog (admin CRUD) ──────────────────────────────────────────
// The public surfaces (site pricing, booking, checkout, invites) all read
// offerings via fetchOfferings (active only). This admin reach sees BOTH
// published and unpublished rows and writes through offerings_admin_write RLS,
// so an edit here lands at every visibility point immediately.
import type { Offering, Segment, PriceUnitDb, PurchaseType, OfferingConfigKind } from './types';

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
  price_model?: import('./types').PriceModel | null;
  // CAREPLANS §P2c, owner-ruled 2026-08-17 ("the non editable components need to
  // be updated"): the three fields that decide what an offering DELIVERS. The
  // editor could change what a product costs but not what it gives, so turning a
  // 4-pack into a 5-pack took a developer. D13 says that means it had no editor.
  /** How many sessions a one-time package gives (a 4-pack is 4). */
  unit_count?: number | null;
  /** The catalog's DEFAULT number of days a week. Staff choose the actual days at
   *  provisioning and those decide the entitlement — this pre-fills the picker. */
  weekly_frequency?: number | null;
  /** One-time vs monthly plan: which half of the entitlement formula applies. */
  config_kind?: OfferingConfigKind | null;
}

export interface OfferingUsage {
  offering_id: string;
  /** Purchase lines that are not voided and whose order is not deleted. */
  live_lines: number;
  bookings: number;
}

/** How many orders and bookings point at each offering. The editor needs this to
 *  warn before a change to `config_kind` rewrites what existing clients are owed
 *  (CAREPLANS §P2c: guarded, not locked). */
export async function adminOfferingUsage(): Promise<Map<string, OfferingUsage>> {
  const { data, error } = await supabase.rpc('admin_offering_usage');
  if (error) throw error;
  return new Map(((data ?? []) as OfferingUsage[]).map((u) => [u.offering_id, u]));
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
  // CAREPATH §C1d: the catalog editor is the surface D13 makes the owner's own
  // (prices, including clearing one back to NULL for "Price on inquiry"). It
  // reported "Offering updated — live everywhere it appears" off `error` alone,
  // and RLS filtering an UPDATE to zero rows is not an error — so a blocked
  // price change looked identical to a saved one. `null` in the patch is a real
  // value and clears the column; the guard is about the write landing at all.
  assertWrote(
    await supabase.from('offerings').update(patch).eq('id', id).select('id'),
    'This offering',
  );
}

// ─── Provision-first client accounts ─────────────────────────────────────────
/** The categories a client can be designated as at creation (multi-select).
 *  Stored as contact tags — visible on the directory and account views. */
/** The ONLY account-category options (stackable). Lessee/Lessor/Buyer/Seller
 *  are contextual record-roles (lease/sale contracts), never account categories. */
export const CLIENT_CATEGORIES = ['Guest', 'Rider', 'Horse owner', 'Deal client'] as const;

/** Display category → standing role token (what the provisioning RPCs accept).
 *
 *  CAREPATH §C10a — 'Deal client' maps to GUEST. It is a DOCUMENT category, not
 *  a new standing affiliation: `groups.group_type` allows only GUEST / RIDER /
 *  HORSE_OWNER / PARENT_GUARDIAN, and inventing a fifth would have to be taught
 *  to `derive_affiliations` and `apply_affiliations` for no gain.
 *
 *  ⚠️ PARTYROLE 2026-08-17 — THE PAPERWORK IS KEYED ON THE TOKEN, NOT ON THIS
 *  LABEL. §C10a's second half ("a deal client signs the general liability waiver
 *  and nothing else, while Guest signs three") was never true in the database and
 *  is withdrawn. `apply_category_documents` matches `category_document_requirements`
 *  against the TOKEN this map produces, so the 'Deal client' requirements row
 *  never matched anything: the screen read that row and promised one document
 *  while the RPC resolved Guest's three and wrote three.
 *
 *  The owner has since ruled the THREE correct — a deal client is your client,
 *  arriving at the property, and signs what any guest signs. So the dead row is
 *  retired (migration 20260817T1800) and every surface derives its prefill
 *  through `matchesCategoryToken` below, which is the same comparison the RPC
 *  makes. The screen and the database can no longer disagree.
 *
 *  A contract COUNTERPARTY — the Lessor or Seller — is NOT on this list and needs
 *  no entry: their role lives on the contract (`document_parties.party_role`), and
 *  the system requires no document of them at all. */
export const CATEGORY_TOKEN: Record<string, string> = {
  Guest: 'GUEST', Rider: 'RIDER', 'Horse owner': 'HORSE_OWNER', 'Deal client': 'GUEST',
};

/** The comparison `apply_category_documents` makes, in the browser: one canonical
 *  form on both sides (upper, spaces → underscores). Pass a
 *  `category_document_requirements.category` and the token a display category
 *  resolved to; a true answer means the RPC will assign that row. */
export function matchesCategoryToken(requirementCategory: string, token: string): boolean {
  const norm = (s: string) => s.trim().replace(/ /g, '_').toUpperCase();
  return norm(requirementCategory) === norm(token);
}

/** Signed-contact detection: the account category implied by a contact's already
 *  EXECUTED documents (kiosk walk-in), plus which templates they've signed — so
 *  the provision form preselects the category and shows signed docs as complete. */
export async function suggestedCategoryForContact(
  contactId: string,
): Promise<{ suggested: string; executed_templates: string[] }> {
  const { data, error } = await supabase.rpc('suggested_category_for_contact', {
    p_contact_id: contactId,
  });
  if (error) throw error;
  const out = (data ?? {}) as { suggested?: string; executed_templates?: string[] };
  return { suggested: out.suggested ?? 'GUEST', executed_templates: out.executed_templates ?? [] };
}

/** Attach offering(s) to an EXISTING client account (purchase + credits only —
 *  no category/document/invitation side effects). Uses the same spine helper as
 *  provisioning via the attach_offerings_to_client RPC. */
export async function adminAttachOfferings(
  contactId: string,
  offeringIds: string[],
  opts?: { markPaid?: boolean; paymentMethod?: string; partialAmount?: number; notes?: string },
): Promise<{ purchaseId: string | null; amount: number; labels: string[] }> {
  const { data, error } = await supabase.rpc('attach_offerings_to_client', {
    p_contact_id: contactId,
    p_offering_ids: offeringIds,
    p_mark_paid: opts?.markPaid ?? false,
    p_payment_method: opts?.paymentMethod ?? null,
    p_notes: opts?.notes ?? null,
    p_partial_amount: opts?.partialAmount ?? 0,
  });
  if (error) throw error;
  const out = (Array.isArray(data) ? data[0] : data) as {
    purchase_id: string | null; amount: number; labels: string[];
  };
  return { purchaseId: out.purchase_id, amount: out.amount, labels: out.labels ?? [] };
}

export interface ClientAccountRow {
  /** 'contact' (TASK-ROSTER): a bare contact — no clients row, no login. */
  kind: 'account' | 'pending' | 'contact';
  user_id: string | null;
  contact_id: string | null;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  is_suspended: boolean;
  member_status: string | null;
  created_at: string;
  tags: string[] | null;
  invite_id: string | null;
  invite_status: string | null;
  invite_expires_at: string | null;
  invite_scheduled_for: string | null;
  document_count: number;
  order_count: number;
  /** Open credit balances, each with the name the credit applies to. */
  credits: { label: string; remaining: number }[];
  /** Consumed service events keyed by service_type code. */
  services: Record<string, number>;
}

// ─── Invitation history (staff support view) ────────────────────────────────
/**
 * EVERY invitation ever issued to one person — not just the live one. The
 * owner's support case: a client reads a URL down the phone and he has to say
 * at a glance whether it is the current link, a retired one or an expired one,
 * and send the right one without leaving the page.
 *
 * `token` is a LIVE CREDENTIAL. It is readable here only because the
 * `invitations` RLS pair is permissive `is_admin()` AND restrictive
 * `org_id = current_org()` — so this returns rows only for an admin of the
 * owning org. Never render it on a surface that is not staff-gated, and never
 * log it.
 */
export interface InvitationHistoryRow {
  id: string;
  email: string;
  token: string;
  status: string;
  invited_role: string | null;
  categories: string[] | null;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  superseded_by: string | null;
  resend_of: string | null;
  failure_reason: string | null;
  deleted_at: string | null;
}

const INVITATION_HISTORY_COLUMNS =
  'id, email, token, status, invited_role, categories, created_at, expires_at, '
  + 'redeemed_at, superseded_by, resend_of, failure_reason, deleted_at';

/** What the row IS, right now — the four words the owner needs on the phone. */
export type InviteLinkState = 'current' | 'retired' | 'expired' | 'redeemed';

export function inviteLinkState(row: InvitationHistoryRow): InviteLinkState {
  if (row.status === 'redeemed' || row.status === 'accepted') return 'redeemed';
  if (row.deleted_at || row.status === 'revoked' || row.status === 'superseded') return 'retired';
  if (row.status === 'redeemed_unsuccessful') return 'retired';
  if (row.status === 'expired' || new Date(row.expires_at) <= new Date()) return 'expired';
  if (row.status === 'sent') return 'current';
  return 'retired';
}

/** Why a link stopped working, in the words staff would use out loud. */
export function inviteRetiredReason(row: InvitationHistoryRow): string | null {
  if (row.deleted_at) return 'deleted by staff';
  if (row.status === 'revoked') return 'revoked by staff';
  if (row.status === 'superseded') return 'replaced by a newer invitation';
  if (row.status === 'redeemed_unsuccessful') {
    return `redemption failed${row.failure_reason ? ` — ${row.failure_reason.replace(/_/g, ' ')}` : ''}`;
  }
  if (inviteLinkState(row) === 'expired') return 'expired';
  return null;
}

/**
 * Every invitation for one person, newest first. Matched on BOTH the contact
 * link and the address, because the plain/staff path writes an invitation with
 * no contact_id — filtering on either alone loses half the history.
 */
export async function adminInvitationHistory(
  person: { contactId?: string | null; email?: string | null },
): Promise<InvitationHistoryRow[]> {
  const queries: PromiseLike<{ data: unknown; error: unknown }>[] = [];
  if (person.contactId) {
    queries.push(supabase.from('invitations').select(INVITATION_HISTORY_COLUMNS)
      .eq('contact_id', person.contactId));
  }
  if (person.email) {
    queries.push(supabase.from('invitations').select(INVITATION_HISTORY_COLUMNS)
      .ilike('email', person.email.trim()));
  }
  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  const byId = new Map<string, InvitationHistoryRow>();
  for (const r of results) {
    if (r.error) throw r.error;
    for (const row of (r.data ?? []) as InvitationHistoryRow[]) byId.set(row.id, row);
  }
  return Array.from(byId.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * RESEND — the SAME link, to the address already on file. Not a regenerate:
 * nothing is superseded and no new row is written, so a link the person is
 * already holding keeps working. Regenerating is `adminSendInvitation`.
 */
export async function adminResendInvitation(
  invitationId: string,
): Promise<{ emailed: boolean; emailError?: string; email: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const res = await fetch('/api/admin-resend-invitation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ invitationId }),
  });
  const payload = await res.json().catch(() => null) as
    { error?: string; emailed?: boolean; emailError?: string; email?: string } | null;
  if (!res.ok) throw new Error(payload?.error || `Could not resend the invitation (HTTP ${res.status}).`);
  return {
    emailed: payload?.emailed === true,
    emailError: payload?.emailError,
    email: payload?.email ?? '',
  };
}

/** Kill the invite link now (still shows as expired; resendable). */
export async function adminExpireInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_expire_invitation', { p_id: id });
  if (error) throw error;
}

/** Soft-delete the invite. It always PRESENTS as expired — never as deleted. */
export async function adminDeleteInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_invitation', { p_id: id });
  if (error) throw error;
}

/** Reversible deactivate / reactivate / soft-delete (keep data, remove user). */
export async function adminAccountAction(
  contactId: string, action: 'remove' | 'unremove' | 'soft',
): Promise<{ had_login: boolean }> {
  const { data, error } = await supabase.rpc('admin_account_action', {
    p_contact_id: contactId, p_action: action,
  });
  if (error) throw error;
  return { had_login: (data as { had_login?: boolean })?.had_login === true };
}

/** NUCLEAR: remove all traces (service-role endpoint). Irreversible. */
export async function adminHardDeleteClient(contactId: string): Promise<{ deletedUser: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch('/api/hard-delete-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ contactId }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'Could not delete the account.');
  return { deletedUser: payload.deletedUser === true };
}

export async function adminClientAccounts(): Promise<ClientAccountRow[]> {
  const { data, error } = await supabase.rpc('admin_client_accounts');
  if (error) throw error;
  return (data ?? []) as ClientAccountRow[];
}

// (adminCreateClient removed 2026-08-03 — deal plan L11. It wrapped
//  admin_create_client, a SECOND account-creation spine with zero component
//  callers that diverged from the canonical one: it stored categories as contact
//  TAGS and matched contacts by email with no is_company / profile-ownership
//  guard, so it could bind to the tenant's own company contact. Account creation
//  goes through ProvisionClientForm → adminSendInvitation →
//  provision_client_invitation. The DB function was dropped in 20260803110000.)

export interface ClientItems {
  documents: {
    id: string; title: string | null; workflow_state: string | null; status: string; created_at: string;
    contract_id: string | null;
  }[];
}

export async function adminClientItems(clientId: string): Promise<ClientItems> {
  const { data, error } = await supabase.rpc('admin_client_items', { p_client_id: clientId });
  if (error) throw error;
  return (data ?? { documents: [] }) as ClientItems;
}

// ─── First-login paperwork (explicit, prefilled by category) ─────────────────
export interface CategoryDocDefault { category: string; template_key: string; title: string }

/** The prefill defaults: which documents each category suggests. */
export async function categoryDocumentDefaults(): Promise<CategoryDocDefault[]> {
  const { data, error } = await supabase.rpc('category_document_defaults');
  if (error) throw error;
  return (data ?? []) as CategoryDocDefault[];
}

/** EVERY document staff may apply as first-login paperwork — the onboarding class
 *  (`contract_templates.wall_gating`), not just the ones some category suggests.
 *
 *  PARTYROLE 2026-08-17 — the owner: *"so we can apply a document or set to them
 *  but we dont have a requirement to do so."* The suggestion list
 *  (`categoryDocumentDefaults`) covers 7 templates and is derived from the
 *  categories; a contract counterparty has no category and therefore no
 *  suggestions, so a control built only from it can never apply anything to them.
 *  This is the universe to CHOOSE from — 9 templates today, including the two the
 *  defaults never mention. It is a floor on staff's reach, never a ceiling. */
export async function onboardingTemplateOptions(): Promise<{ template_key: string; title: string }[]> {
  const { data, error } = await supabase.rpc('onboarding_template_options');
  if (error) throw error;
  return (data ?? []) as { template_key: string; title: string }[];
}

/** Replace the client's assigned first-login documents (the checkbox save). */
export async function setContactRequiredDocuments(contactId: string, templateKeys: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_contact_required_documents', {
    p_contact_id: contactId, p_template_keys: templateKeys,
  });
  if (error) throw error;
}

/* getContactRequiredDocuments (active-only keys) was replaced by the state
 * call below: after CLOSEOUT §1.6 the active view excludes skipped rows, which
 * is correct for the wall and the member ask but would hide a skip from the
 * one surface that manages it. */

/** One assigned requirement with its skip state (CLOSEOUT §1.6). A skipped
 *  requirement stays on the record — who, when, why — but stops blocking the
 *  wall and the lock gate, and is never asked of the member. */
export interface RequiredDocumentState {
  template_key: string;
  skipped_at: string | null;
  skipped_by_name: string | null;
  skip_reason: string | null;
  satisfied: boolean;
}

/** What's currently assigned to a contact, INCLUDING skipped rows — the
 *  active-only view (required_templates_for_contact) would hide a skip from
 *  the one surface that manages it. */
export async function getContactRequiredDocumentsState(
  contactId: string,
): Promise<RequiredDocumentState[]> {
  const { data, error } = await supabase.rpc('contact_required_documents_state', {
    p_contact_id: contactId,
  });
  if (error) throw error;
  return (data ?? []) as RequiredDocumentState[];
}

/** Skip a requirement: it stops blocking, is never asked, and never reads as
 *  signed. Refused when an executed document already satisfies it. */
export async function skipRequiredDocument(
  contactId: string, templateKey: string, reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('skip_required_document', {
    p_contact_id: contactId, p_template_key: templateKey, p_reason: reason || null,
  });
  if (error) throw error;
}

/** Restore a skipped requirement to blocking. */
export async function unskipRequiredDocument(
  contactId: string, templateKey: string,
): Promise<void> {
  const { error } = await supabase.rpc('unskip_required_document', {
    p_contact_id: contactId, p_template_key: templateKey,
  });
  if (error) throw error;
}

// ─── Intake form required-field control ──────────────────────────────────────
export interface AdminFormDefinition {
  form_key: string;
  title: string;
  audience: string;
  purpose: string | null;
  schema: { sections: { heading: string; fields: {
    key: string; label: string; type: string; required?: boolean;
  }[] }[] };
}

export async function adminFormDefinitions(): Promise<AdminFormDefinition[]> {
  const { data, error } = await supabase.rpc('admin_form_definitions');
  if (error) throw error;
  return (data ?? []) as AdminFormDefinition[];
}

/** Bulk-stamp required flags onto a form's fields ({field_key: bool}). */
export async function setFormRequired(formKey: string, required: Record<string, boolean>): Promise<void> {
  const { error } = await supabase.rpc('set_form_required', {
    p_form_key: formKey, p_required: required,
  });
  if (error) throw error;
}
