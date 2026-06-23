/* Data-access layer over Supabase for the FHE platform.
 * UI components call these; RLS enforces ownership/visibility server-side.
 */

import { supabase } from './supabase';
import type {
  Offering, OfferingTier, RequestInput, RequestSelectionInput,
  Invitation, AvailabilitySlot, Order, OrderItem, OrderDocument, Payment,
  PaymentMethod, Profile,
} from './types';

// ─── Offerings catalog ──────────────────────────────────────────────────────

export async function fetchOfferings(): Promise<Offering[]> {
  const { data: offerings, error } = await supabase
    .from('offerings')
    .select('*')
    .eq('active', true)
    .order('segment')
    .order('sort_order');
  if (error) throw error;

  const { data: tiers, error: tierErr } = await supabase
    .from('offering_tiers')
    .select('*')
    .order('sort_order');
  if (tierErr) throw tierErr;

  const byOffering = new Map<string, OfferingTier[]>();
  for (const t of (tiers ?? []) as OfferingTier[]) {
    if (!byOffering.has(t.offering_id)) byOffering.set(t.offering_id, []);
    byOffering.get(t.offering_id)!.push(t);
  }
  return (offerings ?? []).map((o: Offering) => ({ ...o, tiers: byOffering.get(o.id) ?? [] }));
}

// ─── Unauthenticated request flow ───────────────────────────────────────────

export async function submitRequest(
  input: RequestInput,
  selections: RequestSelectionInput[],
): Promise<{ requestId: string }> {
  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone ?? null,
      contact_method: input.contact_method ?? null,
      proposed_times: input.proposed_times ?? [],
      notes: input.notes ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (selections.length > 0) {
    const rows = selections.map((s) => ({
      request_id: request.id,
      offering_id: s.offering_id ?? null,
      offering_slug: s.offering_slug ?? null,
      tier_id: s.tier_id ?? null,
      label: s.label ?? null,
    }));
    const { error: selErr } = await supabase.from('request_selections').insert(rows);
    if (selErr) throw selErr;
  }
  return { requestId: request.id };
}

// ─── Invitations ────────────────────────────────────────────────────────────

/** Validate a signup token via the SECURITY DEFINER RPC. Returns null if invalid/expired. */
export async function validateInvitation(token: string): Promise<Invitation | null> {
  const { data, error } = await supabase.rpc('validate_invitation', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
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

export async function upsertMyProfile(patch: Partial<Profile>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: auth.user.id, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ─── Availability ───────────────────────────────────────────────────────────

export async function fetchOpenSlots(): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('status', 'open')
    .gte('start_at', new Date().toISOString())
    .order('start_at');
  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

/** Atomically place a hold on an open slot for an order. Returns booking id. */
export async function holdSlot(orderId: string, slotId: string): Promise<string> {
  const { data, error } = await supabase.rpc('hold_slot', {
    p_order_id: orderId,
    p_slot_id: slotId,
  });
  if (error) throw error;
  return data as string;
}

export async function getOrderBooking(orderId: string): Promise<{ id: string; slot_id: string | null; status: string } | null> {
  const { data, error } = await supabase
    .from('bookings_v2')
    .select('id, slot_id, status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ─── Orders (authenticated purchase flow) ───────────────────────────────────

export interface DraftOrderInput {
  items: Array<{
    offering_id?: string;
    offering_slug?: string;  // resolved to offering_id server-side
    tier_id?: string;
    label: string;
    price_amount: number;
    price_unit: OrderItem['price_unit'];
    price_min?: number;
  }>;
  qualifiers?: Record<string, string>;
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
    .from('orders')
    .insert({
      user_id: auth.user.id,
      status: 'draft',
      subtotal: input.subtotal,
      total: input.subtotal,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (input.items.length > 0) {
    const rows = input.items.map((i) => ({
      order_id: order.id,
      offering_id: i.offering_id ?? (i.offering_slug ? slugToId.get(i.offering_slug) ?? null : null),
      tier_id: i.tier_id ?? null,
      label: i.label,
      price_amount: i.price_amount,
      price_unit: i.price_unit,
      price_min: i.price_min ?? null,
    }));
    const { error: itemErr } = await supabase.from('order_items').insert(rows);
    if (itemErr) throw itemErr;
  }

  if (input.qualifiers && Object.keys(input.qualifiers).length > 0) {
    const qRows = Object.entries(input.qualifiers).map(([question_key, answer]) => ({
      order_id: order.id,
      question_key,
      answer,
    }));
    const { error: qErr } = await supabase.from('qualifier_answers').insert(qRows);
    if (qErr) throw qErr;
  }
  return { orderId: order.id };
}

export async function getOrder(orderId: string): Promise<(Order & { items: OrderItem[] }) | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (itemErr) throw itemErr;

  return { ...(order as Order), items: (items ?? []) as OrderItem[] };
}

export async function listMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** Move a draft order to awaiting_payment with the chosen method. The server
 *  finalizes pricing (fee, unique_amount, reference) via an edge function in
 *  production; here we set the client-permitted fields only. */
export async function markAwaitingPayment(orderId: string, method: PaymentMethod): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'awaiting_payment', payment_method: method })
    .eq('id', orderId);
  if (error) throw error;
}

// ─── Documents ──────────────────────────────────────────────────────────────

export async function fetchOrderDocuments(orderId: string): Promise<OrderDocument[]> {
  const { data, error } = await supabase
    .from('order_documents')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;
  return (data ?? []) as OrderDocument[];
}

export async function signOrderDocument(
  documentId: string,
  signerName: string,
  extraFields: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from('order_documents')
    .update({
      signer_name: signerName,
      agreed_at: new Date().toISOString(),
      extra_fields: extraFields,
    })
    .eq('id', documentId);
  if (error) throw error;
}

// ─── Payments (read-only from the client) ───────────────────────────────────

export async function getOrderPayment(orderId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}
