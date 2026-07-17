/* Data-access layer over Supabase for the FHE platform.
 * UI components call these; RLS enforces ownership/visibility server-side.
 */

import { supabase } from './supabase';
import type {
  Offering, RequestInput, RequestSelectionInput,
  Invitation, Order, OrderItem, OrderDocument, Payment,
  PaymentMethod, Profile,
} from './types';
import type {
  Contact, ContactInput, Client, Horse, HorseInput, LookupCode,
  ContractTemplate,
  DocumentRow, GeneratedDocument, Signature, PartyRole,
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
 *  membership and consumes the token (email must match — server-enforced). */
export async function redeemInvitation(token: string): Promise<void> {
  const { error } = await supabase.rpc('redeem_invitation', { p_token: token });
  if (error) throw error;
}

/** Self-heal for provisioned clients whose invitation token was lost/consumed:
 *  grants the community membership redeem_invitation would have granted when
 *  the signed-in account's contact is a provisioned client. Returns whether an
 *  active membership now exists. */
export async function ensureMyMembership(): Promise<boolean> {
  const { data, error } = await supabase.rpc('ensure_my_membership');
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
}

/** Attach a created horse to the caller's purchase (own-horse services). */
export async function attachPurchaseHorse(purchaseId: string, horseId: string): Promise<void> {
  const { error } = await supabase.rpc('attach_purchase_horse', {
    p_purchase_id: purchaseId,
    p_horse_id: horseId,
  });
  if (error) throw error;
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

/** Unread-notification count for the bell badge. */
export async function myUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('my_unread_count');
  if (error) throw error;
  return Number(data ?? 0);
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

// ─── Orders (authenticated purchase flow) ───────────────────────────────────

export interface DraftOrderInput {
  items: Array<{
    offering_id?: string;
    offering_slug?: string;  // resolved to offering_id server-side
    label: string;
    price_amount: number;
    price_unit: OrderItem['price_unit'];
  }>;
  subtotal: number;
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

  const { data: order, error } = await supabase
    .from('purchases')
    .insert({
      buyer_user_id: auth.user.id,
      status: 'draft',
      amount: input.subtotal,
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

export async function fetchOrderDocuments(_orderId: string): Promise<OrderDocument[]> {
  return [];
}

/** Retired surface — returns nothing (order_documents removed). */
export async function fetchMyDocuments(): Promise<(OrderDocument & { order_created_at?: string })[]> {
  return [];
}

export async function signOrderDocument(
  _documentId: string,
  _signerName: string,
  _extraFields: Record<string, unknown> = {},
): Promise<void> {
  // no-op: order_documents removed.
}

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

export interface OrgPublicConfig {
  org_id: string;
  slug: string;
  brand: Record<string, string>;
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
    .order('barn_name', { nullsFirst: false });
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

/** Merge a template for an engagement via the SECURITY-DEFINER RPC. Returns the
 *  new document id + merged body. RLS/require_module + engagement ownership are
 *  enforced inside generate_document (scopes to the engagement's own org_id). */
export async function generateDocument(
  engagementId: string,
  templateKey: string,
): Promise<GeneratedDocument> {
  const { data, error } = await supabase.rpc('generate_document', {
    p_engagement_id: engagementId,
    p_template_key: templateKey,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as GeneratedDocument;
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as DocumentRow | null) ?? null;
}

export async function listDocuments(engagementId?: string): Promise<DocumentRow[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .is('deleted_at', null);
  if (engagementId) query = query.eq('engagement_id', engagementId);
  const { data, error } = await query.order('generated_at', { ascending: false });
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

// Records (mod.horserecords)
export type HorsePartyRole = 'owner' | 'lessee' | 'trainer' | 'caretaker' | 'boarder';
export interface HorseParty {
  id: string; org_id: string; horse_id: string; contact_id: string;
  role: HorsePartyRole; share_pct: number | null;
  effective_from: string | null; effective_to: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export interface HorsePartyInput {
  horse_id: string; contact_id: string; role: HorsePartyRole; share_pct?: number | null;
  effective_from?: string | null; effective_to?: string | null; notes?: string | null;
}

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

// Employees (mod.employees)
export interface StaffProfile {
  id: string; org_id: string; profile_user_id: string; contact_id: string | null;
  title: string | null; pay_type: string | null; active: boolean;
  created_at: string; updated_at: string;
}
export interface StaffProfileInput {
  profile_user_id: string; contact_id?: string | null;
  title?: string | null; pay_type?: string | null;
}

export interface Shift {
  id: string; org_id: string; staff_profile_id: string; starts_at: string;
  ends_at: string | null; role: string | null; created_at: string; updated_at: string;
}
export interface ShiftInput {
  staff_profile_id: string; starts_at: string; ends_at?: string | null; role?: string | null;
}

export interface TimeEntry {
  id: string; org_id: string; staff_profile_id: string; clock_in: string;
  clock_out: string | null; minutes: number | null;
  source_kind: string | null; source_id: string | null;
  created_at: string; updated_at: string;
}
export interface TimeEntryInput {
  staff_profile_id: string; clock_in: string; clock_out?: string | null;
  minutes?: number | null; source_kind?: string | null; source_id?: string | null;
}

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

// ─── Records (mod.horserecords) ─────────────────────────────────────────────

export async function listHorseParties(horseId?: string): Promise<HorseParty[]> {
  let query = supabase
    .from('horse_parties')
    .select('*')
    .is('deleted_at', null);
  if (horseId) query = query.eq('horse_id', horseId);
  const { data, error } = await query.order('effective_from', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as HorseParty[];
}

export async function createHorseParty(input: HorsePartyInput): Promise<HorseParty> {
  const { data, error } = await supabase
    .from('horse_parties')
    .insert({
      horse_id: input.horse_id,
      contact_id: input.contact_id,
      role: input.role,
      share_pct: input.share_pct ?? null,
      effective_from: input.effective_from ?? null,
      effective_to: input.effective_to ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as HorseParty;
}

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

// ─── Employees (mod.employees) ──────────────────────────────────────────────

export async function listStaff(): Promise<StaffProfile[]> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StaffProfile[];
}

export async function createStaff(input: StaffProfileInput): Promise<StaffProfile> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .insert({
      profile_user_id: input.profile_user_id,
      contact_id: input.contact_id ?? null,
      title: input.title ?? null,
      pay_type: input.pay_type ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as StaffProfile;
}

export async function listShifts(staffProfileId?: string): Promise<Shift[]> {
  let query = supabase
    .from('shifts')
    .select('*')
    .is('deleted_at', null);
  if (staffProfileId) query = query.eq('staff_profile_id', staffProfileId);
  const { data, error } = await query.order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Shift[];
}

export async function createShift(input: ShiftInput): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      staff_profile_id: input.staff_profile_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      role: input.role ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Shift;
}

export async function listTimeEntries(staffProfileId?: string): Promise<TimeEntry[]> {
  let query = supabase
    .from('time_entries')
    .select('*')
    .is('deleted_at', null);
  if (staffProfileId) query = query.eq('staff_profile_id', staffProfileId);
  const { data, error } = await query.order('clock_in', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function createTimeEntry(input: TimeEntryInput): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      staff_profile_id: input.staff_profile_id,
      clock_in: input.clock_in,
      clock_out: input.clock_out ?? null,
      minutes: input.minutes ?? null,
      source_kind: input.source_kind ?? null,
      source_id: input.source_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

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

/** A structured, party-owned field on a contract (from contract_document_detail). */
export interface ContractField {
  field_key: string;
  label: string | null;
  section: string | null;
  owner_role: string;          // a party_role (LESSOR/LESSEE/…) or 'DEAL'
  value: string | null;
  value_type: 'text' | 'number' | 'date' | 'currency' | 'checkbox' | 'select' | 'longtext';
  required: boolean;
  sort_order: number;
  can_edit: boolean;           // may the CALLER write this field right now
}

/** An open change request on a contract. */
export interface ContractChangeRequest {
  id: string;
  annotation_number: number;
  target_field_key: string | null;
  target_section: string | null;
  current_value: string | null;
  requested_change: string;
  status: 'open' | 'accepted' | 'rejected' | 'withdrawn';
}

/** The list-view read model row (my_contract_documents). */
export interface ContractDocumentSummary {
  document_id: string;
  title: string | null;
  status: string;              // DRAFT/AWAITING_SIGNATURE/EXECUTED/VOID
  workflow_state: 'editable' | 'editing' | 'in_review' | 'locked' | 'executed' | 'void';
  recipient_editing: boolean;
  execution_hash: string | null;
  generated_at: string;
  is_originator: boolean;
  my_roles: string | null;     // csv of the caller's party_roles
  open_change_requests: number;
}

/** The detail read model (contract_document_detail). */
export interface ContractDocumentDetail {
  document: {
    document_id: string;
    title: string | null;
    status: string;
    workflow_state: ContractDocumentSummary['workflow_state'];
    recipient_editing: boolean;
    execution_hash: string | null;
    merged_body: string | null;
    is_originator: boolean;
  };
  my_roles: string[];
  fields: ContractField[];
  open_change_requests: ContractChangeRequest[];
  shares: Array<{ shared_with_contact_id: string; recipient_editing: boolean; notified_at: string | null }>;
  signatures: Array<{ party_role: string; typed_name: string | null; signed_at: string | null }>;
}

/** Start a horse lease contract (create engagement + document + seeded owned fields). */
export async function startLeaseContract(
  lesseeContactId: string, lessorContactId?: string, horseId?: string,
  responsibleRole: 'LESSEE' | 'LESSOR' = 'LESSEE',
): Promise<{ document_id: string; contract_id: string; fields_seeded: number }> {
  const { data, error } = await supabase.rpc('start_lease_contract', {
    p_lessee_contact_id: lesseeContactId,
    p_lessor_contact_id: lessorContactId ?? null,
    p_horse_id: horseId ?? null,
    p_responsible_role: responsibleRole,
  });
  if (error) throw error;
  return data as { document_id: string; contract_id: string; fields_seeded: number };
}

/** Start a BUYER/SELLER horse purchase & sale contract (generic engine instance).
 *  BUYER personal → BUYER; SELLER personal + all HORSE.* + disclosures → SELLER;
 *  all TXN/deal terms → DEAL; originator = buyer. */
export async function startPurchaseContract(
  buyerContactId: string, sellerContactId?: string, horseId?: string,
  amount?: number, deposit?: number,
): Promise<{ document_id: string; contract_id: string; fields_seeded: number }> {
  const { data, error } = await supabase.rpc('start_purchase_contract', {
    p_buyer_contact_id: buyerContactId,
    p_seller_contact_id: sellerContactId ?? null,
    p_horse_id: horseId ?? null,
    p_amount: amount ?? null,
    p_deposit: deposit ?? null,
  });
  if (error) throw error;
  return data as { document_id: string; contract_id: string; fields_seeded: number };
}

/** Start a transaction-representation retainer the CLIENT signs with COMPANY
 *  (generic engine instance). CLIENT personal + optional identified HORSE.* →
 *  CLIENT; fee/commission/protection terms → DEAL; originator = client.
 *  dealSide: 'BUY' | 'SELL' (the side we represent). */
export async function startBrokerContract(
  clientContactId: string, dealSide: 'BUY' | 'SELL' = 'BUY', horseId?: string,
): Promise<{ document_id: string; contract_id: string; fields_seeded: number }> {
  const { data, error } = await supabase.rpc('start_broker_contract', {
    p_client_contact_id: clientContactId,
    p_deal_side: dealSide,
    p_horse_id: horseId ?? null,
  });
  if (error) throw error;
  return data as { document_id: string; contract_id: string; fields_seeded: number };
}

/** Ownership-enforcing field write (raises server-side when unauthorized/locked). */
export async function setContractField(
  documentId: string, fieldKey: string, value: string | null,
): Promise<ContractField> {
  const { data, error } = await supabase.rpc('set_contract_field', {
    p_document_id: documentId, p_field_key: fieldKey, p_value: value,
  });
  if (error) throw error;
  return data as ContractField;
}

/** Share a contract with a party and set their editing permission. */
export async function shareDocument(
  documentId: string, withContactId: string, recipientEditing = false,
): Promise<{ id: string; shared_with_contact_id: string; recipient_editing: boolean }> {
  const { data, error } = await supabase.rpc('share_document', {
    p_document_id: documentId, p_with_contact_id: withContactId, p_recipient_editing: recipientEditing,
  });
  if (error) throw error;
  return data as { id: string; shared_with_contact_id: string; recipient_editing: boolean };
}

/** Originator/staff toggles whether the counterparty may edit DEAL fields/body. */
export async function setRecipientEditing(documentId: string, on: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_recipient_editing', { p_document_id: documentId, p_on: on });
  if (error) throw error;
  return data as boolean;
}

/** Originator/staff accepts (optionally applying a value) or rejects a change request. */
export async function resolveChangeRequest(
  changeId: string, accept: boolean, newValue?: string | null,
): Promise<{ id: string; status: ContractChangeRequest['status'] }> {
  const { data, error } = await supabase.rpc('resolve_change_request', {
    p_change_id: changeId, p_accept: accept, p_new_value: newValue ?? null,
  });
  if (error) throw error;
  return data as { id: string; status: ContractChangeRequest['status'] };
}

/** Lock-and-sign bridge to record_signature (seals/executes once all parties sign). */
export async function lockAndSignContract(
  documentId: string, partyRole: string, typedName: string, esignConsent: boolean,
): Promise<string> {
  const { data, error } = await supabase.rpc('lock_and_sign_contract', {
    p_document_id: documentId, p_party_role: partyRole, p_typed_name: typedName, p_esign_consent: esignConsent,
  });
  if (error) throw error;
  return data as string;
}

/** The caller's contracts (list read model). */
export async function myContractDocuments(): Promise<ContractDocumentSummary[]> {
  const { data, error } = await supabase.rpc('my_contract_documents');
  if (error) throw error;
  return (data as ContractDocumentSummary[]) ?? [];
}

/** Full detail read model for one contract the caller is a party to. */
export async function contractDocumentDetail(documentId: string): Promise<ContractDocumentDetail> {
  const { data, error } = await supabase.rpc('contract_document_detail', { p_document_id: documentId });
  if (error) throw error;
  return data as ContractDocumentDetail;
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
