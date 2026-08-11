/* Data-access layer over Supabase for the FHE platform.
 * UI components call these; RLS enforces ownership/visibility server-side.
 */

import { supabase } from './supabase';
import type {
  Offering, RequestInput, RequestSelectionInput,
  Invitation, Order, OrderItem, Payment,
  PaymentMethod, Profile,
} from './types';
import type { PropertyTerm } from './propertyTerm';
import type {
  Contact, ContactInput, Client, Horse, HorseInput, LookupCode,
  ContractTemplate,
  DocumentRow, Signature, PartyRole,
  DocumentDelivery, DeliveryInput, BillableLine,
  IntakeRequest,
} from './ops/types';

// ─── Offerings catalog ──────────────────────────────────────────────────────

/** Flat catalog: each purchasable item is its own active=true offering row.
 *  Parent "group" offerings were set active=false, so filtering on active
 *  yields exactly the flat purchasable items. */
export async function fetchOfferings(): Promise<Offering[]> {
  const { data: offerings, error } = await supabase
    .from('offerings')
    .select('*')
    .eq('active', true)
    .order('segment')
    .order('sort_order');
  if (error) throw error;

  return (offerings ?? []) as Offering[];
}

/** A catalog category = a service_type, with its cover image + description + the
 *  card-size weight that drives the variable-size grid (2 = featured/large). */
export interface ServiceCategory {
  code: string;
  display_name: string;
  description: string | null;
  segment: string;
  cover_image_url: string | null;
  card_weight: number;
  sort_order: number;
  catalog_rank: number | null;
}
export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_types')
    .select('code, display_name, description, segment, cover_image_url, card_weight, sort_order, catalog_rank')
    .eq('active', true)
    .order('catalog_rank', { nullsFirst: false })
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ServiceCategory[];
}

// ─── Unauthenticated request flow ───────────────────────────────────────────

export async function submitRequest(
  input: RequestInput,
  selections: RequestSelectionInput[],
): Promise<{ requestId: string }> {
  // Routed through the SECURITY DEFINER submit_public_request RPC: a raw anon
  // insert into requests/request_selections fails the RESTRICTIVE org_boundary
  // RLS (org_id resolves NULL for an anon browser), and a function-based column
  // default can't stamp sole_org() in that context. The RPC runs as definer,
  // resolves the tenant, stamps org_id, and inserts request + selections
  // atomically (2026-07-04 production fix).
  const { data, error } = await supabase.rpc('submit_public_request', {
    p_first_name: input.first_name,
    p_last_name: input.last_name,
    p_email: input.contact_email,
    p_phone: input.contact_phone ?? null,
    p_contact_method: input.contact_method ?? null,
    p_notes: input.notes ?? null,
    p_proposed_times: input.proposed_times ?? [],
    p_category: input.category ?? null,
    p_channel: input.channel ?? 'contact',
    p_entry_location: input.entry_location ?? null,
    p_intent: input.intent ?? null,
    p_selections: selections.map((s) => ({
      offering_id: s.offering_id ?? null,
      offering_slug: s.offering_slug ?? null,
      label: s.label ?? null,
    })),
    p_details: input.details ?? {},
  });
  if (error) throw error;
  return { requestId: (data as { request_id: string }).request_id };
}

// ─── Invitations ────────────────────────────────────────────────────────────

/** Redeem the invitation for the SIGNED-IN user: grants the community
 *  membership and consumes the token (email must match — server-enforced).
 *  On failure we record the unsuccessful attempt (redeemed_unsuccessful +
 *  reason, staff notified) in a SEPARATE call — redeem itself raises, so it
 *  cannot durably log its own failure. Best-effort; never masks the throw. */
export async function redeemInvitation(token: string): Promise<void> {
  const { error } = await supabase.rpc('redeem_invitation', { p_token: token });
  if (error) {
    try { await supabase.rpc('record_invitation_failure', { p_token: token }); } catch { /* best-effort */ }
    throw error;
  }
}

/** Self-heal for provisioned clients whose invitation token was lost/consumed:
 *  grants the community membership redeem_invitation would have granted when
 *  the signed-in account's contact is a provisioned client. Returns whether an
 *  active membership now exists. */
export async function ensureMyMemberAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('ensure_my_member_access');
  if (error) throw error;
  return Boolean(data);
}

/** Self-heal for the stale-session trap: if the signed-in user has a live,
 *  unaccepted invitation to their own email, redeem it (grants profile/role/
 *  membership/staff). Returns true if the account is now active. Called by the
 *  member gate before it ever shows a dead-end, so an already-signed-in invitee
 *  who clicked their link never gets stranded. */
export async function redeemMyPendingInvitation(): Promise<boolean> {
  const { data, error } = await supabase.rpc('redeem_my_pending_invitation');
  if (error) throw error;
  return Boolean(data);
}

/** What the retired-link page may tell someone holding a link that no longer
 *  works: where their CURRENT invitation went, and when. A masked address and a
 *  date are not a credential, so this is safe to show to the link holder — but
 *  the new token is never returned and the page never redirects to it. */
export interface InvitationReplacementNotice {
  masked_email: string;
  sent_at: string;
  expires_at: string;
}

/** Null when the token is unknown, still live, or has no current replacement. */
export async function invitationReplacementNotice(
  token: string,
): Promise<InvitationReplacementNotice | null> {
  const { data, error } = await supabase.rpc('invitation_replacement_notice', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InvitationReplacementNotice | null) ?? null;
}

/** "Send it to me again" from the retired-link page. Rate limited server-side,
 *  and it can ONLY ever send to the address already on the invitation — no
 *  address crosses this boundary. The response is deliberately neutral. */
export async function requestInvitationResend(token: string): Promise<void> {
  await fetch('/api/invitation-resend-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/** Validate a signup token via the SECURITY DEFINER RPC. Returns null if invalid/expired. */
export async function validateInvitation(token: string): Promise<Invitation | null> {
  const { data, error } = await supabase.rpc('validate_invitation', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

// ─── Rider onboarding (invite → details → sign → confirmation) ──────────────

/** One onboarding document, in signing order (SECURITY-DEFINER RPC shape). */
export interface OnboardingDocument {
  document_id: string;
  template_key: string;
  title: string;
  status: string;
}

/** What the client bought offline (provisioned by staff with the invite).
 *  Stays populated after onboarding completes — the dashboard plan card. */
export interface OnboardingPurchase {
  /** The spine purchase id — drives the pay-after-sign step. */
  purchase_id: string;
  /** The horse this purchase is for (own-horse services), once attached. */
  horse_id: string | null;
  tier_label: string;
  amount: number;
  /** Punch cards / packs: the number of lessons bought. */
  lessons_included: number | null;
  /** Subscriptions: the weekly cadence (display text, e.g. "2 lessons/week"). */
  cadence: string | null;
  paid: boolean;
  payment_method: string | null;
}

/** The minor rider (the engagement's non-signing PARTICIPANT party). The
 *  guardian is the account holder and the CLIENT signer. */
export interface OnboardingMinor {
  first_name: string;
  last_name: string | null;
  /** YYYY-MM-DD */
  dob: string | null;
}

/** Everything the CONTACT record already knows about the person — the intake
 *  form prefills from this (re-invited members arrive with data on file). */
export interface OnboardingPrefill {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  /** YYYY-MM-DD */
  date_of_birth: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  emergency_contact_1_name: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_relationship: string | null;
  emergency_contact_2_phone: string | null;
  riding_experience_years: string | null;
  jump_experience: string | null;
  riding_background: string | null;
}

/** my_onboarding_state(): `needed` flips false once every doc is EXECUTED. */
export interface OnboardingState {
  needed: boolean;
  profile_complete: boolean;
  documents: OnboardingDocument[];
  purchase: OnboardingPurchase | null;
  /** Guardian-linked minor rider, or null. */
  minor: OnboardingMinor | null;
  /** True when the purchase uses the rider's OWN horse and none is on file yet
   *  (any horse-care service, or a "(With your horse)" lesson) — show the horse
   *  intake step. */
  horse_needed: boolean;
  /** Contact-sourced prefill for the details form (null when no contact). */
  prefill: OnboardingPrefill | null;
}

/** Attach a created horse to the caller's purchase (own-horse services). */
export async function attachPurchaseHorse(purchaseId: string, horseId: string): Promise<void> {
  const { error } = await supabase.rpc('attach_purchase_horse', {
    p_purchase_id: purchaseId,
    p_horse_id: horseId,
  });
  if (error) throw error;
}

/** What set_my_onboarding_horses reports back. */
export interface OnboardingHorseBinding {
  /** How many open horse documents were rebound. */
  documents: number;
  /** documents × horses — the total join rows written. */
  bindings: number;
  /** Soft dashboard reminders raised for horses the member deferred. */
  deferred_reminders: number;
}

/**
 * Bind the member's chosen horses to BOTH horse documents and raise the gentle
 * reminder for any they deferred.
 *
 * COMBINED signing = pass every horse id in `horseIds` (one signature covers
 * them all). SPLIT signing = call this once per horse. `deferredHorseIds` are
 * horses the member has created but chosen not to finish now: they are NOT put
 * on the documents, so document completion is never gated on them, and each one
 * gets a dismissible dashboard action item linking straight to its intake form.
 */
export async function setMyOnboardingHorses(
  horseIds: string[], deferredHorseIds: string[] = [],
): Promise<OnboardingHorseBinding> {
  const { data, error } = await supabase.rpc('set_my_onboarding_horses', {
    p_horse_ids: horseIds,
    p_deferred_horse_ids: deferredHorseIds.length > 0 ? deferredHorseIds : null,
  });
  if (error) throw error;
  return data as OnboardingHorseBinding;
}

/** The signed-in member's onboarding snapshot (profile gate, signing checklist,
 *  purchase summary). Drives /app/onboarding and the dashboard plan card. */
export async function myOnboardingState(): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc('my_onboarding_state');
  if (error) throw error;
  return data as OnboardingState;
}

/** update_my_onboarding_profile payload — all strings, all optional. */
export interface OnboardingProfileInput {
  /** The account holder's legal name — collected here for email-only invites
   *  (which arrive nameless). Fills the contact/profile when currently blank. */
  first_name?: string;
  last_name?: string;
  phone?: string;
  /** YYYY-MM-DD */
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  emergency_contact_1_name?: string;
  emergency_contact_1_relationship?: string;
  emergency_contact_1_phone?: string;
  emergency_contact_2_name?: string;
  emergency_contact_2_relationship?: string;
  emergency_contact_2_phone?: string;
  riding_experience_years?: string;
  jump_experience?: string;
  riding_background?: string;
  /** Minor rider toggle. OMIT to leave the minor state untouched; true (with
   *  the minor fields) attaches/updates the PARTICIPANT party on the pending
   *  engagements; false removes it (drafts only — executed docs are kept). */
  has_minor?: boolean;
  minor_first_name?: string;
  minor_last_name?: string;
  /** YYYY-MM-DD */
  minor_dob?: string;
}

/** Save the member's onboarding details. Only FILLED keys are sent (the RPC
 *  contract: trimmed non-empty strings; blanks are simply omitted). Booleans
 *  (has_minor) pass through as-is — their PRESENCE is the signal. */
export async function updateMyOnboardingProfile(input: OnboardingProfileInput): Promise<void> {
  const p: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() !== '') p[key] = value.trim();
    else if (typeof value === 'boolean') p[key] = value;
  }
  const { error } = await supabase.rpc('update_my_onboarding_profile', { p });
  if (error) throw error;
}

/** Regenerate my unsigned onboarding docs with fresh profile data. Returns the
 *  documents in signing order. */
export async function generateMyOnboardingDocuments(): Promise<OnboardingDocument[]> {
  const { data, error } = await supabase.rpc('generate_my_onboarding_documents');
  if (error) throw error;
  return (data ?? []) as OnboardingDocument[];
}

// ─── Notifications (the messaging spine — BOOKING_FLOWS_PLAN §1) ────────────

/** One row from my_notifications(): a per-user in-app notification. */
export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  /** In-app destination (e.g. '/app/documents'), or null. */
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** The signed-in user's notifications, newest first. */
export async function myNotifications(limit = 20): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('my_notifications', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

/** Mark one of MY notifications read (someone else's id is a server-side no-op). */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { p_id: id });
  if (error) throw error;
}

/**
 * CONSUME one of my notifications — permanently delete it (per-user), leaving only
 * an audit-log record. Called when the owner CLOSES a dashboard alert or OPENS its
 * target: the item is gone for good from THIS user's dashboard (the other owner's
 * copy is untouched). For items the system CAN know are resolved (e.g. a contract
 * gets signed), the server clears every recipient's copy automatically instead.
 */
export async function consumeNotification(id: string): Promise<void> {
  const { error } = await supabase.rpc('consume_notification', { p_id: id });
  if (error) throw error;
}

/** Unread-notification count for the bell badge. */
export async function myUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('my_unread_count');
  if (error) throw error;
  return Number(data ?? 0);
}

/** Open inbound-work count (open requests + open support) for the Inbound nav
 *  badge. Staff-only. */
export async function inboundOpenCount(): Promise<number> {
  const { data, error } = await supabase.rpc('inbound_open_count');
  if (error) throw error;
  return Number(data ?? 0);
}

// ─── My standing categories (Guest / Rider / Horse Owner) ────────────────────

/** A standing account category the signed-in person holds. */
export type StandingCategory = 'GUEST' | 'RIDER' | 'HORSE_OWNER';

/** The signed-in person's standing categories. Drives nav gating (a guest-only
 *  client sees a restricted surface — no community). Resolved server-side by
 *  my_standing_categories(): affiliation groups (RIDER / HORSE_OWNER), else
 *  GUEST for an active client with no group. Returns [] for staff (restriction
 *  inert) and for accounts with no contact. */
export async function fetchMyCategories(): Promise<StandingCategory[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  // Fail CLOSED (2026-07-29): this drives nav + offering gating, so swallowing
  // the error and returning [] used to read as "no restrictions" at the call
  // sites. Throw instead and let each caller decide how to degrade.
  const { data, error } = await supabase.rpc('my_standing_categories');
  if (error) throw error;
  const standing: StandingCategory[] = ['GUEST', 'RIDER', 'HORSE_OWNER'];
  return ((data ?? []) as string[]).filter((c): c is StandingCategory =>
    standing.includes(c as StandingCategory));
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/** Upload the signed-in member's avatar to profile-images/{user_id}/… and
 *  return its public URL (bucket is public-read; writes are owner-scoped).
 *  Accepts a Blob — the crop modal emits a resized JPEG blob, so the stored
 *  path always uses a .jpg extension regardless of the original filename. */
export async function uploadMyAvatar(file: Blob, _filename = 'avatar.jpg'): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const path = `${auth.user.id}/avatar-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('profile-images')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertMyProfile(patch: Partial<Profile>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: auth.user.id, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** U7 Stage 5: phone lives on the person's contact record, not profiles — see
 *  docs/PERSON_DATA_CONSOLIDATION.md. contacts_select's own-row policy
 *  (id = current_contact_id()) permits this read directly; no RPC needed. A
 *  caller with no linked contact yet (no account-creation flow has run) reads
 *  as null rather than throwing — the public Account page still renders. */
export async function myContactPhone(): Promise<string | null> {
  const { data: contactId } = await supabase.rpc('current_contact_id');
  if (!contactId) return null;
  const { data, error } = await supabase
    .from('contacts')
    .select('phone')
    .eq('id', contactId as string)
    .maybeSingle();
  if (error) throw error;
  return (data?.phone as string | null) ?? null;
}

/** Same repoint for the write side. contacts_update_own's RLS
 *  (id = current_contact_id()) permits this directly — no RPC needed, matching
 *  the read. Throws if the caller has no linked contact yet: unlike the read,
 *  a failed save should surface rather than silently do nothing. */
export async function updateMyContactPhone(phone: string | null): Promise<void> {
  const { data: contactId } = await supabase.rpc('current_contact_id');
  if (!contactId) throw new Error('No contact record linked to this account yet.');
  const { error } = await supabase
    .from('contacts')
    .update({ phone })
    .eq('id', contactId as string);
  if (error) throw error;
}

// ─── Orders (authenticated purchase flow) ───────────────────────────────────

/** The captured INTENT for a scheduled/recurring order line (Phase 4).
 *
 *  Both scheduled and recurring SKUs grant a POOL of session credits that the
 *  client books FREELY against calendar availability (any days, any distribution
 *  — recurring is not a fixed weekday/time and not literally N×/week; the SKU's
 *  weekly_frequency only SIZES the monthly pool and reflects the recurring
 *  discount). So there is no weekday/time to capture here — actual scheduling is
 *  the existing calendar booking flow (book_open_slot). This line config carries
 *  only what the calendar doesn't: off-site address + any notes/constraints. */
export interface OfferingLineConfig {
  /** off-site services (training/exercise): address when the horse isn't at CCR. */
  address?: string;
  /** free-text constraints / preferences carried to staff scheduling. */
  notes?: string;
}

export interface DraftOrderInput {
  items: Array<{
    offering_id?: string;
    offering_slug?: string;  // resolved to offering_id server-side
    label: string;
    price_amount: number;
    price_unit: OrderItem['price_unit'];
    /** Phase 4: per-line scheduling/config intent → purchase_items.config. */
    config?: OfferingLineConfig;
  }>;
  subtotal: number;
  /** Staff/self mark-paid at order creation (any origin). Defaults to unpaid draft. */
  markPaid?: boolean;
  amountPaid?: number;
  paymentMethod?: string;
}

export async function createDraftOrder(input: DraftOrderInput): Promise<{ orderId: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Resolve any offering_slug references to offering_id from the catalog.
  const slugs = input.items.map((i) => i.offering_slug).filter(Boolean) as string[];
  const slugToId = new Map<string, string>();
  if (slugs.length > 0) {
    const { data: offerings } = await supabase
      .from('offerings')
      .select('id, slug')
      .in('slug', slugs);
    for (const o of offerings ?? []) slugToId.set(o.slug, o.id);
  }

  // Purchase unification (Phase 2/3): always stamp buyer_contact_id, add
  // buyer_user_id for the authenticated buyer. Mark-paid is first-class on every
  // order-creation path (Phase 4).
  const { data: contactId } = await supabase.rpc('current_contact_id');
  const paid = input.markPaid === true;
  const amountPaid = paid ? input.subtotal : (input.amountPaid ?? 0);
  const { data: order, error } = await supabase
    .from('purchases')
    .insert({
      buyer_user_id: auth.user.id,
      buyer_contact_id: (contactId as string | null) ?? null,
      status: paid ? 'paid' : 'draft',
      amount: input.subtotal,
      amount_paid: amountPaid,
      payment_status: paid ? 'paid' : amountPaid > 0 ? 'pending' : 'unpaid',
      ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
      ...(paid ? { paid_at: new Date().toISOString() } : {}),
    })
    .select('id')
    .single();
  if (error) throw error;

  if (input.items.length > 0) {
    const rows = input.items.map((i) => ({
      purchase_id: order.id,
      offering_id: i.offering_id ?? (i.offering_slug ? slugToId.get(i.offering_slug) ?? null : null),
      label: i.label,
      price_amount: i.price_amount,
      price_unit: i.price_unit,
      config: i.config ?? {},
    }));
    const { error: itemErr } = await supabase.from('purchase_items').insert(rows);
    if (itemErr) throw itemErr;
  }

  return { orderId: order.id };
}

export async function getOrder(orderId: string): Promise<(Order & { items: OrderItem[] }) | null> {
  const { data: order, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemErr } = await supabase
    .from('purchase_items')
    .select('*')
    .eq('purchase_id', orderId);
  if (itemErr) throw itemErr;

  return { ...(order as Order), items: (items ?? []) as OrderItem[] };
}

export async function listMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** A gift the caller received (to use) or gave. */
export interface MyGift {
  id: string; code: string | null; item_type: string | null; item_label: string | null;
  amount: number | null; status: string | null; gift_message: string | null;
  buyer_name: string | null; recipient_name: string | null;
  unlocked: boolean; opened_at: string | null; redeemed_at: string | null;
  expires_at: string | null; created_at: string; direction: 'given' | 'received';
}
export async function listMyGifts(): Promise<MyGift[]> {
  const { data, error } = await supabase.rpc('my_gifts');
  if (error) throw error;
  return (data ?? []) as MyGift[];
}

/** Move a draft order to awaiting_payment with the chosen method. The server
 *  RPC finalizes pricing: offering-linked item prices are enforced server-side,
 *  totals recomputed, and the Zelle matching keys (unique_amount +
 *  brand-prefixed payment_reference) assigned exactly once. */
export async function markAwaitingPayment(orderId: string, method: PaymentMethod): Promise<void> {
  const { error } = await supabase.rpc('finalize_purchase_payment', {
    p_purchase_id: orderId,
    p_method: method,
  });
  if (error) throw error;
}

// ─── Documents ──────────────────────────────────────────────────────────────
// The `order_documents` surface is retired (spine refactor). These keep their
// signatures so existing callers compile, but return empty / no-op until the
// document surface is rebuilt on the contract spine.

/** Retired surface — returns nothing (order_documents removed). */
/** Stage 3a/3f: the person's one chronological document list — pending and
 *  assigned first, then executed in signing order (superseded stay
 *  retrievable as evidence). Account-anchored via the Stage 2 linkage. */
export interface MyDocumentRow {
  document_id: string | null;
  template_key: string;
  title: string;
  kind: 'pending' | 'assigned' | 'executed';
  signed_at: string | null;
  current_status: string | null;
  superseded: boolean;
  created_at: string;
  /** A8B: when the all-parties executed-copy email fired (documents.executed_email_sent_at).
   *  NULL on non-executed rows, and on executed rows the send hasn't happened yet. */
  executed_email_sent_at: string | null;
}
export async function myDocuments(): Promise<MyDocumentRow[]> {
  const { data, error } = await supabase.rpc('my_documents');
  if (error) throw error;
  return (data ?? []) as MyDocumentRow[];
}

/** H3/H4 — "Email me a copy" for an EXECUTED document the caller is a party on.
 *  Personal re-send: the server resolves the caller's contact from their own
 *  profile and mails only THEIR copy to THEIR account address. The document id
 *  is the only input; the destination can never be set by the caller. */
export async function emailMyDocumentCopy(documentId: string): Promise<{ email: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess?.session?.access_token;
  if (!bearer) throw new Error('You need to be signed in.');
  const res = await fetch('/api/deliver-my-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ documentId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
  if (!res.ok) throw new Error(json.error || 'Could not send the email.');
  return { email: json.email ?? '' };
}

/** Stage 3f: the signing-wall state for the signed-in person. */
export interface WallState {
  pending: number;
  wall: boolean;
  staff_banner?: boolean;
  staff: boolean;
}
/** THE SIGNING WALL — FAILS CLOSED (2026-07-29).
 *
 *  This previously swallowed any error and returned `{wall: false}`, which meant
 *  a transient DB/network blip silently UN-GATED someone who should have been
 *  walled — the one failure mode a gate must never have. A gate that cannot
 *  prove you are clear must assume you are not.
 *
 *  On error we THROW. AppLayout catches it and holds the member at an explicit,
 *  retryable error state instead of letting them through. The error is also
 *  surfaced rather than silently defaulted, so a real outage is visible instead
 *  of quietly disabling the wall for everyone. */
export async function myWallState(): Promise<WallState> {
  const { data, error } = await supabase.rpc('my_wall_state');
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    // An unreadable/empty payload is indistinguishable from a failure — treat it
    // as one rather than coercing it into a permissive default.
    throw new Error('Could not read your document status.');
  }
  return data as WallState;
}

/** I2 — which of the five dynamic USER nav destinations (Orders, Documents,
 *  Stable, My Posts, Saved Content) have at least one entry for the caller.
 *  One call on layout mount is enough (see AppLayout) — unlike the wall,
 *  a stale/failed read here only means a link is momentarily missing, not a
 *  security gate, so failures are swallowed to an all-false default. */
export interface NavPresence {
  orders: boolean;
  documents: boolean;
  stable: boolean;
  posts: boolean;
  saved: boolean;
}
export async function myNavPresence(): Promise<NavPresence> {
  const { data, error } = await supabase.rpc('my_nav_presence');
  if (error) throw error;
  return data as NavPresence;
}

// ─── Legal name confirmation ────────────────────────────────────────────────
/** Whether this member must state their legal name before filling a form or
 *  signing. Set when two sources carried genuinely different surnames and we
 *  could not safely pick one — guessing would put the wrong name on a contract. */
export interface NameConfirmationState {
  needs_confirmation: boolean;
  first_name: string | null;
  last_name: string | null;
}

/** FAILS CLOSED, for the same reason the signing wall does: if we cannot tell
 *  whether this person's name is trustworthy, we must not let them sign with it.
 *  The caller treats a throw as "gate them". */
export async function myNameConfirmationState(): Promise<NameConfirmationState> {
  const { data, error } = await supabase.rpc('my_name_confirmation_state');
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Could not read your name status.');
  return data as NameConfirmationState;
}

/** The member states their own legal name. The ONLY way to clear the gate —
 *  staff cannot confirm on someone's behalf, since the point is that we could
 *  not safely assert it ourselves. */
export async function confirmMyLegalName(first: string, last: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_my_legal_name', {
    p_first: first, p_last: last,
  });
  if (error) throw error;
}

// ─── Document versioning / re-assignment (staff) ────────────────────────────
/* templateReassignmentCandidates() / requireDocumentFromAll() were removed
 * 2026-07-30 before ever shipping a caller. They were a population-wide sweep
 * built one step ahead of the owner's actual requirement, which is a PROMPT on
 * each version bump offering all / choose-who / no-one. Keeping both would have
 * left two controls writing contact_required_documents with different semantics
 * — exactly the drift this consolidation exists to remove. The version-decision
 * flow below is the single path; its RPCs remain in the DB as primitives. */

/** A version bump still awaiting the re-sign decision. */
export interface PendingVersionDecision {
  id: string;
  template_key: string;
  title: string;
  from_version: number | null;
  to_version: number;
  occurred_at: string;
  past_signers: number;
}

/** Version bumps nobody has answered yet. Each one asks: should past signers
 *  re-sign? Recorded by trigger when a template's version changes, so a wording
 *  change cannot reach signers without someone deciding what it means for the
 *  people who already signed the old text. */
export async function pendingVersionDecisions(): Promise<PendingVersionDecision[]> {
  const { data, error } = await supabase.rpc('pending_version_decisions');
  if (error) throw error;
  return (data ?? []) as PendingVersionDecision[];
}

/** Answer a version prompt. 'ALL' requires every past signer, 'SELECTED' the
 *  named subset, 'NONE' records that nobody re-signs. NONE is stored rather than
 *  dismissed — it is a real decision and should be auditable. */
export async function resolveVersionDecision(
  eventId: string,
  resolution: 'ALL' | 'SELECTED' | 'NONE',
  contactIds?: string[],
): Promise<number> {
  const { data, error } = await supabase.rpc('resolve_version_decision', {
    p_event_id: eventId, p_resolution: resolution,
    p_contact_ids: contactIds ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/* Deliberately NOT wrapped: assign_document_to_contact(). Per-person assignment
 * already has one home — setContactRequiredDocuments(), the checkbox list on the
 * client record, which sets the whole set at once. Adding a second single-insert
 * path would be two controls writing the same table with different semantics
 * (replace vs append), which is how they drift. The RPC exists in the DB as a
 * primitive; the UI uses the existing control. */

/** Who signed an older version of a template — the candidate list for a re-sign
 *  request. Returned in signing order so the newest signers read first. */
export interface PastSigner {
  contact_id: string;
  name: string;
  email: string | null;
  signed_version: number | null;
  signed_at: string | null;
  /** Already required to re-sign (an obligation row exists). */
  already_required: boolean;
}

export async function templatePastSigners(templateKey: string): Promise<PastSigner[]> {
  const { data, error } = await supabase.rpc('template_past_signers', {
    p_template_key: templateKey,
  });
  if (error) throw error;
  return (data ?? []) as PastSigner[];
}

/* requireResignFrom() removed 2026-07-30 before shipping a caller: the UI answers
 * a version prompt through resolveVersionDecision(), which invokes
 * require_resign_from SERVER-SIDE for both the ALL and SELECTED cases. A second
 * client wrapper would be a parallel way to create the same obligations. The RPC
 * remains in the DB as the primitive resolve_version_decision builds on. */


// ─── Payments (read inline off the purchase row) ────────────────────────────

export async function getOrderPayment(orderId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('purchases')
    .select('payment_method, amount, payment_reference, payment_status')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    method: data.payment_method,
    amount: data.amount,
    reference_code: data.payment_reference,
    status: data.payment_status,
  } as Payment;
}

// ─── Platform: entitlements, registry, public config, provisioning ───────────
// Thin wrappers over the U2/U3/U6 SECURITY-DEFINER RPCs. UI nav/route gating and
// the BrandProvider read through these; the server (RLS + require_module) is the
// authoritative fence — these are convenience seams (PLATFORM_ARCHITECTURE §4.3 C).

/** The current caller's own tenant's enabled+unexpired module keys (e.g.
 *  'mod.lessons'). Works for a plain USER member — my_modules() reads org_modules
 *  PAST its staff-only RLS, current_org()-scoped, so it never crosses tenants.
 *  Drives nav/route gating in AuthContext. */
export async function myModules(): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_modules');
  if (error) throw error;
  const rows = (data ?? []) as Array<{ module_key: string } | string>;
  return rows.map((r) => (typeof r === 'string' ? r : r.module_key));
}

/** The current caller's own tenant's property-term shape (U16). Mirrors
 *  myModules(): my_property_term() reads config_values PAST staff-only RLS,
 *  current_org()-scoped, so a plain USER member can resolve it for UI copy —
 *  the seam the signed-in app was missing (BrandProvider's per-tenant fetch only
 *  ever reached the anon public slug path). */
export async function myPropertyTerm(): Promise<PropertyTerm> {
  const { data, error } = await supabase.rpc('my_property_term');
  if (error) throw error;
  return data as PropertyTerm;
}

export interface OrgPublicConfig {
  org_id: string;
  slug: string;
  brand: Record<string, string>;
  property: PropertyTerm;
  modules: string[];
  pricing: Array<{ product_key: string; name: string; amount: number }>;
}

/** ANON public-exposure seam: resolves a tenant slug to its brand + active public
 *  module list + public pricing. Returns null for an unknown/inactive tenant.
 *  NEVER exposes commission/retention/e-sign/tax internals (enforced server-side). */
export async function orgPublicConfig(slug: string): Promise<OrgPublicConfig | null> {
  const { data, error } = await supabase.rpc('org_public_config', { p_slug: slug });
  if (error) throw error;
  return (data as OrgPublicConfig | null) ?? null;
}

/** Resolve a single registry value for the CURRENT tenant (typed business_config
 *  column when the (ns,key) maps to one, else the config_values EAV row). Returns
 *  null when unset. */
export async function configValue(ns: string, key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('config_value', { p_ns: ns, p_key: key });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  tierKey: string;
  adminEmail: string;
  adminUserId?: string | null;
  brand?: Record<string, unknown>;
  legal?: Record<string, unknown>;
  rates?: Record<string, unknown>;
  modules?: string[];
}

/** SUPER_ADMIN-only push-button provisioning (the single blessed path). The RPC is
 *  SUPER_ADMIN-gated inside the function and rolls back atomically on any failure;
 *  returns the new org id. */
export async function provisionTenant(input: ProvisionTenantInput): Promise<string> {
  const { data, error } = await supabase.rpc('provision_tenant', {
    p_name: input.name,
    p_slug: input.slug,
    p_tier_key: input.tierKey,
    p_admin_email: input.adminEmail,
    p_admin_user_id: input.adminUserId ?? null,
    p_brand: input.brand ?? {},
    p_legal: input.legal ?? {},
    p_rates: input.rates ?? {},
    p_modules: input.modules ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ─── Core ops wrappers: CRM / contracts / billing (INT-API-CORE) ─────────────
// The single core wiring layer. Every core ops/portal slice imports a REAL,
// exported, RLS-enforced function from here; the server (RLS + require_module +
// SECURITY-DEFINER RPCs) is the authoritative fence. These are thin, typed seams
// over supabase.from(table)/.rpc(name) matching the tested backbone signatures.

// ─── CRM: contacts ────────────────────────────────────────────────────────

/** All in-tenant contacts (RLS scopes to current_org()), soft-deleted excluded. */
export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .is('deleted_at', null)
    .order('first_name')
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(id: string, patch: Partial<ContactInput>): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Contact;
}

// ─── CRM: clients ─────────────────────────────────────────────────────────

/** All in-tenant clients (the CRM subset promoted to engagement-eligible). */
export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Client[];
}

// ─── Horses + lookups ─────────────────────────────────────────────────────

export async function listHorses(): Promise<Horse[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('*')
    .is('deleted_at', null)
    .order('nickname', { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Horse[];
}

export async function createHorse(input: HorseInput): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as Horse;
}

export async function updateHorse(id: string, patch: HorseInput): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Horse;
}

export async function listHorseBreeds(): Promise<LookupCode[]> {
  const { data, error } = await supabase
    .from('horse_breeds')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as LookupCode[];
}

export async function listHorseColors(): Promise<LookupCode[]> {
  const { data, error } = await supabase
    .from('horse_colors')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as LookupCode[];
}

/** Generic vocabulary lookup for select-or-other fields that live in lookup_options
 *  (markings, registration org, passport country, …). breeds/colors keep their own
 *  dedicated tables and their own list functions above. */
export async function listLookupOptions(lookupKey: string): Promise<LookupCode[]> {
  const { data, error } = await supabase
    .from('lookup_options')
    .select('code, display_name, active, sort_order')
    .eq('lookup_key', lookupKey)
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as LookupCode[];
}

/** Capture an "Other" free-text entry for periodic review (best-effort; never blocks
 *  the user — a failure is swallowed by the caller). De-dupes + counts server-side. */
export async function recordLookupSuggestion(lookupKey: string, rawValue: string): Promise<void> {
  const { error } = await supabase.rpc('record_lookup_suggestion', { p_lookup_key: lookupKey, p_raw_value: rawValue });
  if (error) throw error;
}

/** Admin review queue: the captured "Other" entries, most-frequent first. */
export interface LookupSuggestion {
  id: string; lookup_key: string; raw_value: string; count: number; status: string;
  first_seen: string; last_seen: string;
}
export async function listLookupSuggestions(status = 'open'): Promise<LookupSuggestion[]> {
  const { data, error } = await supabase
    .from('lookup_suggestions')
    .select('id, lookup_key, raw_value, count, status, first_seen, last_seen')
    .eq('status', status)
    .order('count', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LookupSuggestion[];
}
export async function promoteLookupSuggestion(id: string, code?: string): Promise<void> {
  const { error } = await supabase.rpc('promote_lookup_suggestion', { p_id: id, p_code: code ?? null });
  if (error) throw error;
}
export async function dismissLookupSuggestion(id: string): Promise<void> {
  const { error } = await supabase.from('lookup_suggestions').update({ status: 'dismissed' }).eq('id', id);
  if (error) throw error;
}

// ─── Contracts: templates & documents ────────────────────────────────────

export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('active', true)
    .is('deleted_at', null)
    .order('title');
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

/** LEASEFORK: the selectable lease versions, for the picker on New contract.
 *  `contract_kind` is what groups lease templates — HORSE_LEASE_V2 plus the
 *  HORSE_LEASE_STANDARD / _FULL / _SIMPLE forks. The active + not-deleted filter
 *  is what keeps the retired flat `HORSE_LEASE` template out of the list, and it
 *  mirrors the validation start_lease_contract_v2 applies server-side, so the UI
 *  cannot offer a template the RPC would reject. */
export async function listLeaseTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('contract_kind', 'HORSE_LEASE')
    .eq('active', true)
    .is('deleted_at', null)
    .order('title');
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

/* generateDocument() removed 2026-07-30. It called generate_document with
 * `p_engagement_id`, a parameter no overload has had since `engagements` was
 * retired — every invocation would have failed on arity. It had no callers.
 * The live signature is
 *   generate_document(p_contact_id, p_template_key, p_contract_id, p_horse_id,
 *                     p_parties, p_service_type[, p_horse_ids])
 * and the real generation paths (onboarding, the contract engine) call it
 * through their own wrappers. */

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as DocumentRow | null) ?? null;
}

/** Every non-deleted document, newest first (the staff queue).
 *
 *  The `engagementId` filter was removed 2026-07-30: it filtered on
 *  `documents.engagement_id`, a column dropped with the `engagements` retirement.
 *  The sole caller passes no argument, so the dead branch never ran — but any
 *  future caller supplying one would have got a PostgREST error rather than a
 *  filtered list. Scope by contact or contract instead. */
export async function listDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .is('deleted_at', null)
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

// ─── Signatures ───────────────────────────────────────────────────────────

/** Seal-on-sign via the SECURITY-DEFINER RPC. Sets typed_name/signed_at/ip for the
 *  (document, party_role) signer and advances document status server-side.
 *  `esignConsent` (20260703110000): pass true when the signer affirmed the
 *  electronic-signing checkbox — the server logs a separate esign_consents row.
 *  Omitted → the staff-facilitated pre-checkbox payload is unchanged. */
export async function recordSignature(
  documentId: string,
  partyRole: PartyRole,
  typedName: string,
  ip?: string | null,
  esignConsent?: boolean,
): Promise<void> {
  const params: Record<string, unknown> = {
    p_document_id: documentId,
    p_party_role: partyRole,
    p_typed_name: typedName,
    p_ip: ip ?? null,
  };
  if (esignConsent !== undefined) params.p_esign_consent = esignConsent;
  const { error } = await supabase.rpc('record_signature', params);
  if (error) throw error;
}

export async function listSignatures(documentId: string): Promise<Signature[]> {
  const { data, error } = await supabase
    .from('signatures')
    .select('*')
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Signature[];
}

// ─── Deliveries ───────────────────────────────────────────────────────────

export async function listDeliveries(documentId: string): Promise<DocumentDelivery[]> {
  const { data, error } = await supabase
    .from('document_deliveries')
    .select('*')
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .order('delivered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentDelivery[];
}

export async function recordDelivery(input: DeliveryInput): Promise<DocumentDelivery> {
  const { data, error } = await supabase
    .from('document_deliveries')
    .insert({
      document_id: input.document_id,
      recipient_contact_id: input.recipient_contact_id,
      channel: input.channel ?? 'PORTAL',
      copy_url: input.copy_url ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DocumentDelivery;
}

// ─── Billing: billable_lines + settlement ────────────────────────────────

/** OPEN billable lines for a payer (or all OPEN lines when no payer given). */
export async function listOpenBillableLines(payerContactId?: string): Promise<BillableLine[]> {
  let query = supabase
    .from('billable_lines')
    .select('*')
    .eq('status', 'OPEN')
    .is('deleted_at', null);
  if (payerContactId) query = query.eq('payer_contact_id', payerContactId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillableLine[];
}


// ─── Public intake (requests) ─────────────────────────────────────────────

/** The staff intake-review inbox: public request submissions, newest first. */
export async function listIntake(): Promise<IntakeRequest[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as IntakeRequest[];
}


// ─── Count helpers (dashboard KPI tiles) ──────────────────────────────────
// head:true + count:'exact' returns the count without transferring rows; RLS
// still scopes the count to the caller's tenant/ownership.

export async function countContacts(): Promise<number> {
  const { count, error } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function countHorses(): Promise<number> {
  const { count, error } = await supabase
    .from('horses')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function countOpenDocuments(): Promise<number> {
  const { count, error } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('status', 'EXECUTED');
  if (error) throw error;
  return count ?? 0;
}

export async function countOpenBillableLines(): Promise<number> {
  const { count, error } = await supabase
    .from('billable_lines')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'OPEN')
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

// ─── INT-API-MODULES domain types ───────────────────────────────────────────
// Kept inline (this unit edits only api.ts + its test): the module/admin table
// row + input shapes mirror the backbone schema (§7 module migrations, §4
// entitlements/registry/products). Every field is what RLS returns to a staff
// ADMIN caller.

// Boarding (mod.boarding)
export interface Facility {
  id: string; org_id: string; name: string; address_value_key: string | null;
  created_at: string; updated_at: string;
}
export interface FacilityInput { name: string; address_value_key?: string | null; }

export interface Stall {
  id: string; org_id: string; facility_id: string; code: string;
  stall_type: string | null; active: boolean; created_at: string; updated_at: string;
}
export interface StallInput { facility_id: string; code: string; stall_type?: string | null; }

export interface BoardAgreement {
  id: string; org_id: string; horse_id: string; stall_id: string | null;
  boarder_contact_id: string; board_rate: number | null; board_type: string | null;
  start_date: string | null; end_date: string | null; status: string;
  created_at: string; updated_at: string;
}
export interface BoardAgreementInput {
  horse_id: string; boarder_contact_id: string; stall_id?: string | null;
  board_rate?: number | null; board_type?: string | null;
  start_date?: string | null; end_date?: string | null;
}

export interface BoardCharge {
  id: string; org_id: string; board_agreement_id: string;
  period_start: string; period_end: string; amount: number;
  billable_line_id: string | null; created_at: string; updated_at: string;
}
export interface BoardChargeInput {
  board_agreement_id: string; period_start: string; period_end: string; amount: number;
}

// Barn ops / inventory (mod.barnops)
export type ResourceCategory = 'feed' | 'med' | 'bedding' | 'supply' | 'equipment';
export interface Resource {
  id: string; org_id: string; resource_key: string; name: string;
  category: ResourceCategory; unit_of_measure: string; is_consumable: boolean;
  created_at: string; updated_at: string;
}
export interface ResourceInput {
  resource_key: string; name: string; category: ResourceCategory;
  unit_of_measure?: string; is_consumable?: boolean;
}

export interface ResourceLot {
  id: string; org_id: string; resource_id: string; vendor_contact_id: string | null;
  qty_purchased: number; unit_cost: number; on_hand: number; purchased_at: string;
  created_at: string; updated_at: string;
}
export interface ResourceLotInput {
  resource_id: string; vendor_contact_id?: string | null;
  qty_purchased: number; unit_cost: number; on_hand?: number;
}

export interface ConsumptionEvent {
  id: string; org_id: string; resource_id: string; resource_lot_id: string | null;
  horse_id: string | null; qty: number; administered_by: string | null;
  occurred_at: string; notes: string | null; created_at: string;
}
export interface ConsumptionEventInput {
  resource_id: string; resource_lot_id?: string | null; horse_id?: string | null;
  qty: number; occurred_at?: string; notes?: string | null;
}

export type AllocationScope = 'horse' | 'lease' | 'board' | 'default';
export interface CostAllocationRule {
  id: string; org_id: string; scope: AllocationScope; scope_id: string | null;
  payer_contact_id: string; share_pct: number;
  effective_from: string | null; effective_to: string | null;
  created_at: string; updated_at: string;
}
export interface CostAllocationRuleInput {
  scope: AllocationScope; scope_id?: string | null; payer_contact_id: string;
  share_pct?: number; effective_from?: string | null; effective_to?: string | null;
}

// Lessons (mod.lessons)
export interface LessonPackage {
  id: string; org_id: string; package_key: string; name: string;
  price_value_key: string | null; credits: number; active: boolean;
  created_at: string; updated_at: string;
}
export interface LessonPackageInput {
  package_key: string; name: string; price_value_key?: string | null; credits?: number;
}

export interface LessonCredit {
  id: string; org_id: string; client_id: string; package_key: string | null;
  credits_total: number; credits_remaining: number; purchased_at: string;
  created_at: string; updated_at: string;
}
export interface LessonCreditInput {
  client_id: string; package_key?: string | null;
  credits_total: number; credits_remaining?: number;
}

// Records (mod.horserecords) — the ownership/rights ledger lives in
// src/lib/ops/api-records.ts on the horse_relationships survivor (Stage 1i);
// the duplicate helper pair that lived here was deleted with the old table.

export interface HealthEvent {
  id: string; org_id: string; horse_id: string; event_type: string; occurred_at: string;
  provider_contact_id: string | null; next_due: string | null; notes: string | null;
  document_id: string | null; created_at: string; updated_at: string;
}
export interface HealthEventInput {
  horse_id: string; event_type: string; occurred_at?: string;
  provider_contact_id?: string | null; next_due?: string | null;
  notes?: string | null; document_id?: string | null;
}

// Employees (mod.employees) — the live wrappers are src/lib/ops/api-employees.ts
// (profiles employment columns + shifts/time_entries keyed by staff_user_id
// since Stage 1j); the duplicate suite that lived here was deleted with the
// old staff table.

// Admin: entitlements, registry, branding, products
export interface ModuleCatalogRow {
  module_key: string; name: string; description: string | null;
  is_core: boolean; active: boolean; created_at: string;
}
export interface TierRow {
  tier_key: string; name: string; monthly_price: number | null;
  sort_order: number; active: boolean; created_at: string;
}
export interface BusinessConfig {
  id: string;
  legal_entity_name: string | null; entity_formation: string | null;
  registered_agent: string | null; signatory_name: string | null;
  signatory_title: string | null; business_address: string | null;
  commission_purchase_rate: number | null; commission_sale_rate: number | null;
  commission_lease_rate: number | null; commission_min: number | null;
  travel_fee_method: 'FLAT' | 'MILEAGE' | 'TIME' | null; travel_fee_amount: number | null;
  cancellation_fee: number | null; late_fee: number | null; no_show_fee: number | null;
  protection_period: string | null; sales_tax_rate: number | null;
  document_retention: string | null; esignature_provider: string | null;
  updated_at: string;
}
export interface ConfigValueRow {
  id: string; org_id: string; namespace: string; key: string;
  value_text: string | null; value_num: number | null; value_json: unknown | null;
  category: string | null; effective_from: string; updated_by: string | null;
  created_at: string; updated_at: string;
}
export interface ConfigValueInput {
  namespace: string; key: string; value_text?: string | null;
  value_num?: number | null; value_json?: unknown | null; category?: string | null;
}
export interface Product {
  id: string; org_id: string; product_key: string; name: string;
  service_type: string | null; module_key: string | null;
  price_value_key: string | null; active: boolean;
  created_at: string; updated_at: string;
}
export interface ProductInput {
  product_key: string; name: string; service_type?: string | null;
  module_key?: string | null; price_value_key?: string | null;
}
export interface ProductPrice {
  id: string; org_id: string; product_id: string; amount: number;
  effective_from: string; effective_to: string | null;
  created_at: string; updated_at: string;
}
export interface ProductPriceInput {
  product_id: string; amount: number; effective_from?: string; effective_to?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  INT-API-MODULES — module + admin wrappers
// ═══════════════════════════════════════════════════════════════════════════
// APPENDS to the core wiring layer (INT-API-CORE) after it, honoring the serial
// api.ts chain (§12: dependsOn is the only shared-file collision guard). Every
// module/admin UI slice imports a REAL, exported, RLS-enforced function from
// here; the server (RLS + require_module + SECURITY-DEFINER RPCs) is the
// authoritative fence. Thin, typed seams over supabase.rpc(name)/.from(table)
// matching the tested backbone signatures (PLATFORM_ARCHITECTURE §7, §15).

// ─── Boarding (mod.boarding) ────────────────────────────────────────────────

export async function listFacilities(): Promise<Facility[]> {
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Facility[];
}

export async function createFacility(input: FacilityInput): Promise<Facility> {
  const { data, error } = await supabase
    .from('facilities')
    .insert({ name: input.name, address_value_key: input.address_value_key ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as Facility;
}

export async function listStalls(facilityId?: string): Promise<Stall[]> {
  let query = supabase
    .from('stalls')
    .select('*')
    .is('deleted_at', null);
  if (facilityId) query = query.eq('facility_id', facilityId);
  const { data, error } = await query.order('code');
  if (error) throw error;
  return (data ?? []) as Stall[];
}

export async function createStall(input: StallInput): Promise<Stall> {
  const { data, error } = await supabase
    .from('stalls')
    .insert({
      facility_id: input.facility_id,
      code: input.code,
      stall_type: input.stall_type ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Stall;
}

export async function listBoardAgreements(): Promise<BoardAgreement[]> {
  const { data, error } = await supabase
    .from('board_agreements')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardAgreement[];
}

export async function createBoardAgreement(input: BoardAgreementInput): Promise<BoardAgreement> {
  const { data, error } = await supabase
    .from('board_agreements')
    .insert({
      horse_id: input.horse_id,
      boarder_contact_id: input.boarder_contact_id,
      stall_id: input.stall_id ?? null,
      board_rate: input.board_rate ?? null,
      board_type: input.board_type ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as BoardAgreement;
}

export async function listBoardCharges(boardAgreementId?: string): Promise<BoardCharge[]> {
  let query = supabase
    .from('board_charges')
    .select('*')
    .is('deleted_at', null);
  if (boardAgreementId) query = query.eq('board_agreement_id', boardAgreementId);
  const { data, error } = await query.order('period_start', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardCharge[];
}

export async function createBoardCharge(input: BoardChargeInput): Promise<BoardCharge> {
  const { data, error } = await supabase
    .from('board_charges')
    .insert({
      board_agreement_id: input.board_agreement_id,
      period_start: input.period_start,
      period_end: input.period_end,
      amount: input.amount,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as BoardCharge;
}

// ─── Barn ops / inventory (mod.barnops) ─────────────────────────────────────

export async function listResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Resource[];
}

export async function createResource(input: ResourceInput): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      resource_key: input.resource_key,
      name: input.name,
      category: input.category,
      unit_of_measure: input.unit_of_measure ?? 'unit',
      is_consumable: input.is_consumable ?? true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Resource;
}

export async function listResourceLots(resourceId?: string): Promise<ResourceLot[]> {
  let query = supabase
    .from('resource_lots')
    .select('*')
    .is('deleted_at', null);
  if (resourceId) query = query.eq('resource_id', resourceId);
  const { data, error } = await query.order('purchased_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResourceLot[];
}

export async function createResourceLot(input: ResourceLotInput): Promise<ResourceLot> {
  const { data, error } = await supabase
    .from('resource_lots')
    .insert({
      resource_id: input.resource_id,
      vendor_contact_id: input.vendor_contact_id ?? null,
      qty_purchased: input.qty_purchased,
      unit_cost: input.unit_cost,
      on_hand: input.on_hand ?? input.qty_purchased,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ResourceLot;
}

export async function listConsumptionEvents(): Promise<ConsumptionEvent[]> {
  const { data, error } = await supabase
    .from('consumption_events')
    .select('*')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConsumptionEvent[];
}

/** Append an immutable consumption event (append-only ledger, §barnops). */
export async function createConsumptionEvent(input: ConsumptionEventInput): Promise<ConsumptionEvent> {
  const { data, error } = await supabase
    .from('consumption_events')
    .insert({
      resource_id: input.resource_id,
      resource_lot_id: input.resource_lot_id ?? null,
      horse_id: input.horse_id ?? null,
      qty: input.qty,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ConsumptionEvent;
}

export async function listCostAllocationRules(): Promise<CostAllocationRule[]> {
  const { data, error } = await supabase
    .from('cost_allocation_rules')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CostAllocationRule[];
}

export async function createCostAllocationRule(input: CostAllocationRuleInput): Promise<CostAllocationRule> {
  const { data, error } = await supabase
    .from('cost_allocation_rules')
    .insert({
      scope: input.scope,
      scope_id: input.scope_id ?? null,
      payer_contact_id: input.payer_contact_id,
      share_pct: input.share_pct ?? 100,
      effective_from: input.effective_from ?? null,
      effective_to: input.effective_to ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CostAllocationRule;
}

/** Resolve consumption events in a period into billable_lines via the
 *  SECURITY-DEFINER RPC. p_period is a tstzrange string; returns the count of
 *  lines created. */
export async function resolveConsumptionBilling(period: string): Promise<number> {
  const { data, error } = await supabase.rpc('resolve_consumption_billing', { p_period: period });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

// ─── Lessons (mod.lessons) ──────────────────────────────────────────────────

export async function listLessonPackages(): Promise<LessonPackage[]> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as LessonPackage[];
}

export async function createLessonPackage(input: LessonPackageInput): Promise<LessonPackage> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .insert({
      package_key: input.package_key,
      name: input.name,
      price_value_key: input.price_value_key ?? null,
      credits: input.credits ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonPackage;
}

export async function listLessonCredits(clientId?: string): Promise<LessonCredit[]> {
  let query = supabase
    .from('lesson_credits')
    .select('*')
    .is('deleted_at', null);
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query.order('purchased_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LessonCredit[];
}

export async function createLessonCredit(input: LessonCreditInput): Promise<LessonCredit> {
  const { data, error } = await supabase
    .from('lesson_credits')
    .insert({
      client_id: input.client_id,
      package_key: input.package_key ?? null,
      credits_total: input.credits_total,
      credits_remaining: input.credits_remaining ?? input.credits_total,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonCredit;
}

// ─── Records (mod.horserecords) ──────────────────────────────────────────────
// Ledger helpers live in src/lib/ops/api-records.ts (horse_relationships).

export async function listHealthEvents(horseId?: string): Promise<HealthEvent[]> {
  let query = supabase
    .from('horse_health_events')
    .select('*')
    .is('deleted_at', null);
  if (horseId) query = query.eq('horse_id', horseId);
  const { data, error } = await query.order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HealthEvent[];
}

export async function createHealthEvent(input: HealthEventInput): Promise<HealthEvent> {
  const { data, error } = await supabase
    .from('horse_health_events')
    .insert({
      horse_id: input.horse_id,
      event_type: input.event_type,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      provider_contact_id: input.provider_contact_id ?? null,
      next_due: input.next_due ?? null,
      notes: input.notes ?? null,
      document_id: input.document_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as HealthEvent;
}

// ─── Employees (mod.employees) ───────────────────────────────────────────────
// Live wrappers: src/lib/ops/api-employees.ts (see the type note above).

// ═══════════════════════════════════════════════════════════════════════════
//  Tenant admin + super-admin wrappers
// ═══════════════════════════════════════════════════════════════════════════

// ─── Module & entitlement toggles (ADMIN-MODULES) ───────────────────────────

/** The full module catalog (entitlement toggle source). */
export async function listModuleCatalog(): Promise<ModuleCatalogRow[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('active', true)
    .order('module_key');
  if (error) throw error;
  return (data ?? []) as ModuleCatalogRow[];
}

/** The subscription tiers (name + monthly price), for the provision wizard. */
export async function listTiers(): Promise<TierRow[]> {
  const { data, error } = await supabase
    .from('tiers')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as TierRow[];
}

/** Upsert a single org_modules entitlement (add-on / subscription seam) via the
 *  SUPER_ADMIN/billing SECURITY-DEFINER RPC (§4.1). */
export async function setOrgModule(
  orgId: string,
  moduleKey: string,
  enabled = true,
  source = 'ADDON',
): Promise<void> {
  const { error } = await supabase.rpc('set_org_module', {
    p_org: orgId,
    p_key: moduleKey,
    p_enabled: enabled,
    p_source: source,
  });
  if (error) throw error;
}

// ─── Value registry (ADMIN-REGISTRY) ────────────────────────────────────────

/** The singleton typed business_config row (owner-supplied legal/commission/tax
 *  blanks). Null before the first save. */
export async function getBusinessConfig(): Promise<BusinessConfig | null> {
  const { data, error } = await supabase
    .from('business_config')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as BusinessConfig | null) ?? null;
}

export async function updateBusinessConfig(patch: Partial<BusinessConfig>): Promise<BusinessConfig> {
  const { data, error } = await supabase
    .from('business_config')
    .update(patch)
    .eq('id', patch.id as string)
    .select('*')
    .single();
  if (error) throw error;
  return data as BusinessConfig;
}

/** The EAV config_values rows for the current tenant (registry editor). */
export async function listConfigValues(): Promise<ConfigValueRow[]> {
  const { data, error } = await supabase
    .from('config_values')
    .select('*')
    .order('namespace')
    .order('key');
  if (error) throw error;
  return (data ?? []) as ConfigValueRow[];
}

export async function upsertConfigValue(input: ConfigValueInput): Promise<ConfigValueRow> {
  const { data, error } = await supabase
    .from('config_values')
    .upsert(
      {
        namespace: input.namespace,
        key: input.key,
        value_text: input.value_text ?? null,
        value_num: input.value_num ?? null,
        value_json: input.value_json ?? null,
        category: input.category ?? null,
      },
      { onConflict: 'org_id,namespace,key' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as ConfigValueRow;
}

/** Required (namespace,key) registry entries still unset for the org — completeness
 *  gate via the SECURITY-DEFINER RPC. */
export async function configRequiredMissing(orgId: string): Promise<Array<{ namespace: string; key: string }>> {
  const { data, error } = await supabase.rpc('config_required_missing', { p_org: orgId });
  if (error) throw error;
  return (data ?? []) as Array<{ namespace: string; key: string }>;
}

// ─── Branding (ADMIN-BRANDING) ──────────────────────────────────────────────

/** Read the BRAND.* / CONTACT.* branding registry values (config_values namespaces). */
export async function listBrandingValues(): Promise<ConfigValueRow[]> {
  const { data, error } = await supabase
    .from('config_values')
    .select('*')
    .in('namespace', ['BRAND', 'CONTACT'])
    .order('namespace')
    .order('key');
  if (error) throw error;
  return (data ?? []) as ConfigValueRow[];
}

/** The GLOBAL property-term picker list (U16) — world-readable, SUPER_ADMIN-
 *  write. Extending it (the owner's "possibly others") is a data change: an
 *  INSERT into property_terms, never a code change or a redeploy. */
export async function listPropertyTerms(): Promise<PropertyTerm[]> {
  const { data, error } = await supabase
    .from('property_terms')
    .select('key, term, article, plural, preposition')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as PropertyTerm[];
}

/** Upload a branding asset (e.g. a logo) to the admin-write brand-assets bucket
 *  under the tenant's org prefix. Returns the stored object path. */
export async function uploadBrandingAsset(
  orgId: string,
  file: File,
  filename?: string,
): Promise<string> {
  const path = `${orgId}/${filename ?? file.name}`;
  const { error } = await supabase.storage
    .from('brand-assets')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

// ─── Products & pricing (ADMIN-PRODUCTS) ────────────────────────────────────

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      product_key: input.product_key,
      name: input.name,
      service_type: input.service_type ?? null,
      module_key: input.module_key ?? null,
      price_value_key: input.price_value_key ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Product;
}

export async function listProductPrices(productId: string): Promise<ProductPrice[]> {
  const { data, error } = await supabase
    .from('product_prices')
    .select('*')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductPrice[];
}

/** Add an effective-dated price for a product (new row; history preserved). */
export async function createProductPrice(input: ProductPriceInput): Promise<ProductPrice> {
  const { data, error } = await supabase
    .from('product_prices')
    .insert({
      product_id: input.product_id,
      amount: input.amount,
      effective_from: input.effective_from ?? new Date().toISOString(),
      effective_to: input.effective_to ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProductPrice;
}

// ─── Contract workflow engine (20260705010000) ──────────────────────────────
// Minimal typed seam over the multi-party contract-workflow RPCs. BACKEND-FIRST:
// these are thin, typed wrappers a later UI thread binds to — no components ship
// here. The RPCs (SECURITY DEFINER) enforce ownership/RLS server-side; these just
// carry the shapes. See supabase/migrations/20260705010000_contract_workflow_engine.sql.

// NOTE (2026-07-20 cleanup, audit M-1): a duplicate copy of the contract types
// and 7 RPC wrappers (setContractField, shareDocument, setRecipientEditing,
// resolveChangeRequest, lockAndSignContract, myContractDocuments,
// contractDocumentDetail) lived here and had drifted from the live copies in
// src/lib/contracts.ts. Nothing imported them. Removed — contracts.ts is the one
// source of truth for the contract seam. Only the start*Contract starters, which
// ARE used (by NewContractPage), remain here.

/** Start a horse lease contract — the clause-model authoring system (numbered
 *  Section›Clause›Field, selection-first, real-time conditional clauses).
 *  Cut over from the legacy flat start_lease_contract on 2026-07-20.
 *
 *  LEASEFORK: `templateKey` picks which lease VERSION to author (HORSE_LEASE_V2
 *  and its forks; see listLeaseTemplates). It is OMITTED from the payload when not
 *  supplied, so the RPC's own DEFAULT 'HORSE_LEASE_V2' applies and this call stays
 *  byte-identical to what it sent before the parameter existed. The RPC validates
 *  the key (exists, active, not deleted, contract_kind = HORSE_LEASE) and raises
 *  rather than falling back, so a bad key surfaces as an error, never as a
 *  silently different contract. */
export async function startLeaseContract(
  lesseeContactId: string, lessorContactId?: string, horseId?: string,
  templateKey?: string,
): Promise<{ document_id: string; contract_id: string; fields_seeded: number; template_key: string }> {
  // H1 originator collapse: the company (staff caller) is ALWAYS the author —
  // no party is designated as responsible-for-authoring anymore. The RPC keeps
  // its p_responsible_role parameter for signature compatibility but ignores it.
  const { data, error } = await supabase.rpc('start_lease_contract_v2', {
    p_lessee_contact_id: lesseeContactId,
    p_lessor_contact_id: lessorContactId ?? null,
    p_horse_id: horseId ?? null,
    ...(templateKey ? { p_template_key: templateKey } : {}),
  });
  if (error) throw error;
  return data as { document_id: string; contract_id: string; fields_seeded: number; template_key: string };
}

/** Start a BUYER/SELLER horse sale contract — the clause-model authoring system
 *  (HORSE_SALE_V2). Replaced the flat start_purchase_contract on 2026-08-02.
 *  amount/deposit seed TXN.PURCHASE_PRICE / TXN.DEPOSIT_AMOUNT (+ enable). */
export async function startSaleContract(
  buyerContactId: string, sellerContactId?: string, horseId?: string,
  amount?: number, deposit?: number,
): Promise<{ document_id: string; contract_id: string; fields_seeded: number }> {
  const { data, error } = await supabase.rpc('start_sale_contract', {
    p_buyer_contact_id: buyerContactId,
    p_seller_contact_id: sellerContactId ?? null,
    p_horse_id: horseId ?? null,
    p_amount: amount ?? null,
    p_deposit: deposit ?? null,
  });
  if (error) throw error;
  return data as { document_id: string; contract_id: string; fields_seeded: number };
}

/** Generate the companion Equine Bill of Sale from a sale contract document —
 *  same engagement, parties (incl. co-buyer) and shared field values carry over;
 *  payment status derives from the sale's installment election. */
export async function startBillOfSale(
  saleDocumentId: string,
): Promise<{ document_id: string; contract_id: string }> {
  const { data, error } = await supabase.rpc('start_bill_of_sale', {
    p_sale_document_id: saleDocumentId,
  });
  if (error) throw error;
  return data as { document_id: string; contract_id: string };
}

/** Add a co-buyer to a sale / bill-of-sale document: a second BUYER party with
 *  the next signer_order. Pass a contactId to pick an existing account/contact,
 *  or hand-entry fields to create a contact record (deduped on email). */
export async function setDocumentCoBuyer(
  documentId: string,
  p: { contactId?: string; firstName?: string; lastName?: string; email?: string;
       phone?: string; addressLine1?: string; city?: string; state?: string; postalCode?: string },
): Promise<{ contact_id: string; signer_order: number }> {
  const { data, error } = await supabase.rpc('set_document_co_buyer', {
    p_document_id: documentId,
    p_contact_id: p.contactId ?? null,
    p_first_name: p.firstName ?? null,
    p_last_name: p.lastName ?? null,
    p_email: p.email ?? null,
    p_phone: p.phone ?? null,
    p_address_line1: p.addressLine1 ?? null,
    p_city: p.city ?? null,
    p_state: p.state ?? null,
    p_postal_code: p.postalCode ?? null,
  });
  if (error) throw error;
  return data as { contact_id: string; signer_order: number };
}

// (startBrokerContract removed 2026-07-20, audit m-1: the broker/retainer type
//  was never wired into any creation UI. Re-add alongside a NewContractPage
//  broker mode if/when brokerage contracts ship. The DB function was dropped
//  2026-07-26 (Phase 3) — zero callers.)

/** Link a contract back to the purchase it was started from (traceable
 *  purchase↔contract chain). Contract creation stays manual; this just records
 *  the origin + stamps the originator from the purchase's buyer when absent. */
export async function linkContractToPurchase(contractId: string, purchaseId: string): Promise<void> {
  const { error } = await supabase.rpc('link_contract_to_purchase', {
    p_contract_id: contractId, p_purchase_id: purchaseId,
  });
  if (error) throw error;
}

// ─── Contact mailing address (staff surfaces) ────────────────────────────────
/** The canonical mailing address for a contact.
 *
 *  `contacts` IS the canonical home — the onboarding intake writes here
 *  (update_my_onboarding_profile UPDATEs contacts.address_line1/city/state/
 *  postal_code) and the contract party tokens (LESSEE.ADDRESS etc.) compose from
 *  these same columns via fill_party_fields_from_contacts → compose_address().
 *  `profiles` has a look-alike five-column address that onboarding does NOT
 *  write; reading it would show blanks for people who actually have an address.
 *  Staff surfaces must read THIS. */
export interface ContactAddress {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  /** Generated by compose_address() — never written directly. */
  address_composed: string | null;
}

/** Read one contact's mailing address. Returns null when the contact is absent
 *  or RLS hides it; an existing contact with no address on file comes back with
 *  all-null parts, which the UI renders as a clean "Not on file". */
export async function contactAddress(contactId: string): Promise<ContactAddress | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('address_line1, address_line2, city, state, postal_code, address_composed')
    .eq('id', contactId)
    .maybeSingle();
  if (error) throw error;
  return (data as ContactAddress | null) ?? null;
}

/** True when at least one address part is present. Guards the "no empty labels
 *  / no null" requirement at every call site. */
export function hasAddress(a: ContactAddress | null | undefined): boolean {
  if (!a) return false;
  return [a.address_composed, a.address_line1, a.address_line2, a.city, a.state, a.postal_code]
    .some((v) => typeof v === 'string' && v.trim() !== '');
}

/** The one-line reading form, preferring the DB-composed string and falling back
 *  to assembling the parts (so a partial address still reads cleanly). */
export function formatAddress(a: ContactAddress | null | undefined): string | null {
  if (!hasAddress(a)) return null;
  const composed = a?.address_composed?.trim();
  if (composed) return composed;
  const street = [a?.address_line1, a?.address_line2]
    .map((v) => v?.trim()).filter(Boolean).join(', ');
  const region = [a?.city?.trim(), [a?.state?.trim(), a?.postal_code?.trim()]
    .filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const line = [street, region].filter(Boolean).join(', ');
  return line !== '' ? line : null;
}

// ─── Contact directory (staff) ───────────────────────────────────────────────
/** A directory row: the contact plus the relationship signals its visible
 *  designations derive from (staff_contact_directory RPC). */
export interface DirectoryContact {
  id: string;
  display_code: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  linked_user_id: string | null;
  linked_role: string | null;
  is_client: boolean;
  party_roles: string[];
  horses_owned: number;
  horses_leased: number;
  engagement_count: number;
  document_count: number;
  /** THE page discriminator — an explicit stored value, not a derived leftover.
   *  null = unclassified, surfaced for a human to file rather than defaulted. */
  contact_type: ContactType | null;
  is_company: boolean;
}

/** The four person-pages. One contact appears on exactly one of them.
 *  LEAD      — a potential future client: outreach and campaign target.
 *  CONTACT   — an internal person the business SERVES (client, member, horse
 *              owner, counterparty) who is not part of the company.
 *  TEAM      — the company itself: staff and internal accounts.
 *  DIRECTORY — external people and businesses that PROVIDE something: farriers,
 *              vets, suppliers, service providers, event organizers.
 *  The line that separates LEAD from DIRECTORY: someone we serve who hasn't
 *  bought yet is a LEAD; someone who sells to us is DIRECTORY. */
export type ContactType = 'LEAD' | 'CONTACT' | 'TEAM' | 'DIRECTORY';

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  LEAD: 'Lead', CONTACT: 'Contact', TEAM: 'Team', DIRECTORY: 'Directory',
};

/** Move a contact between the person-pages. Staff only; the RPC validates
 *  against the same four values the column CHECK enforces. */
export async function setContactType(contactId: string, type: ContactType | null): Promise<void> {
  const { error } = await supabase.rpc('set_contact_type', {
    p_contact_id: contactId, p_type: type,
  });
  if (error) throw error;
}

export async function staffContactDirectory(): Promise<DirectoryContact[]> {
  const { data, error } = await supabase.rpc('staff_contact_directory');
  if (error) throw error;
  return (data ?? []) as DirectoryContact[];
}

/** Soft-delete a contact (admin RLS). Directory + pickers filter deleted rows;
 *  history that references the contact keeps working. */
export async function deleteContact(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null })
    .eq('id', id);
  if (error) throw error;
}

// ─── Public catalog (website + app read the SAME offerings) ──────────────────
export interface PublicOffering {
  id: string;
  segment: 'rider' | 'horse' | 'acquisition';
  name: string;
  tagline: string | null;
  description: string | null;
  slug: string;
  service_type: string | null;
  price_amount: number | null;
  price_unit: string | null;
  price_min: number | null;
  purchase_type: string | null;
  horse_included: boolean | null;
  is_popular: boolean;
  note: string | null;
  sort_order: number;
  price_model: import('./types').PriceModel | null;
}

/** The active catalog for the public site (and anywhere the app wants the
 *  canonical offerings). Single source of truth = the offerings table, which
 *  the admin Catalog editor drives. */
export async function fetchPublicOfferings(slug?: string): Promise<PublicOffering[]> {
  const { data, error } = await supabase.rpc('public_offerings', { p_slug: slug ?? null });
  if (error) throw error;
  return (data ?? []) as PublicOffering[];
}

// ─── Payments: method + responsibility (Stage 4d) ────────────────────────────

/** Update the payment method recorded on an unpaid/partially-paid purchase. */
export async function updatePurchasePaymentMethod(purchaseId: string, method: string): Promise<void> {
  const { error } = await supabase.rpc('update_purchase_payment_method', {
    p_purchase_id: purchaseId, p_method: method,
  });
  if (error) throw error;
}

/** Hand payment responsibility for a purchase to another account holder. */
export async function transferPaymentResponsibility(purchaseId: string, newPayerContactId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_payment_responsibility', {
    p_purchase_id: purchaseId, p_new_payer_contact_id: newPayerContactId,
  });
  if (error) throw error;
}

/** Account holders a balance may be transferred to (4d picker). */
export interface PayerCandidate { contact_id: string; name: string }
export async function payerCandidates(): Promise<PayerCandidate[]> {
  const { data, error } = await supabase.rpc('payer_candidates');
  if (error) return [];
  return (data ?? []) as PayerCandidate[];
}

/** The tour's form-factor split: desktop and mobile tours persist
 *  independently. lg (1024px) is the breakpoint where the desktop rail
 *  appears, so it is also the tour's dividing line. */
export type TourFormFactor = 'desktop' | 'mobile';
export function currentTourFormFactor(): TourFormFactor {
  return typeof window !== 'undefined'
    && window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile';
}

/** A3: stamp the app-overview tour as seen for the signed-in account, PER
 *  form factor (desktop and mobile each persist independently). The first
 *  stamp wins — re-opening the tour from the menu never calls this. */
export async function markTourSeen(formFactor: TourFormFactor = currentTourFormFactor()): Promise<void> {
  const { error } = await supabase.rpc('mark_tour_seen', { p_form_factor: formFactor });
  if (error) throw error;
}

// ─── The contact dossier (staff) ────────────────────────────────────────────
/** Everything known about one person.
 *
 *  Keyed on CONTACT, not account: 13 of 19 contacts have no login —
 *  counterparties, kiosk signers, leads, and minors like a rider on a parent's
 *  account. The old client page took a user_id and so could not open for any of
 *  them.
 *
 *  `account`, `posts` and `activity` are null (not empty) when the person has no
 *  login, so the UI can tell "nothing yet" from "does not apply". */
export interface ContactDossier {
  contact: Record<string, unknown>;
  account: {
    user_id: string; role: string | null; is_suspended: boolean;
    display_name: string | null; bio: string | null; riding_level: string | null;
    avatar_url: string | null; created_at: string; member_status: string | null;
    login: {
      providers: string[]; last_sign_in_at: string | null; email_confirmed_at: string | null;
    } | null;
  } | null;
  standing: {
    contact_type: string | null; is_client: boolean;
    groups: string[]; party_roles: string[];
  };
  family: {
    guardian: { contact_id: string; name: string; email: string | null } | null;
    dependants: { contact_id: string; name: string; date_of_birth: string | null }[];
  };
  horses: { horse_id: string; name: string; relation: 'owner' | 'lessee' }[];
  documents: {
    document_id: string; code: string | null; title: string | null;
    status: string; current_status: string | null; generated_at: string;
  }[];
  orders: {
    purchase_id: string; code: string | null; status: string;
    amount: number | null; amount_paid: number | null;
    payment_status: string | null; payment_method: string | null; created_at: string;
  }[];
  notifications: { id: string; kind: string; title: string; created_at: string }[];
  posts: {
    id: string; post_type: string; body: string | null;
    published: boolean; pulled_down: boolean; created_at: string;
  }[] | null;
  activity: {
    id: string; action: string; table_name: string | null; occurred_at: string;
  }[] | null;
}

export async function contactDossier(contactId: string): Promise<ContactDossier> {
  const { data, error } = await supabase.rpc('contact_dossier', { p_contact_id: contactId });
  if (error) throw error;
  return data as ContactDossier;
}

/** Save an edit to the person record. The RPC allowlists field names and RAISES
 *  on an unknown key, so a typo cannot look like a successful save. Returns the
 *  fresh dossier, so the caller never guesses what landed. */
export async function updateContactRecord(
  contactId: string,
  patch: Record<string, unknown>,
): Promise<ContactDossier> {
  const { data, error } = await supabase.rpc('update_contact_record', {
    p_contact_id: contactId, p_patch: patch,
  });
  if (error) throw error;
  return data as ContactDossier;
}
