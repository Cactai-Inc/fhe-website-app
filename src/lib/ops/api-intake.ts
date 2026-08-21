/**
 * OPS-INTAKE data seams (lane-owned; src/lib/api.ts is integrator-owned).
 *
 * Thin, typed wrappers over supabase.from('requests') — the public inbox that
 * the unified intake (Phase 5) writes every contact/inquiry/booking/kiosk
 * submission into. RLS (org_boundary + has_staff_access) is the authoritative
 * fence; these seams only shape the calls.
 */
import { supabase } from '../supabase';
import type { ProposedTime } from '../types';

// ─── Intake requirements (owner-configured, per channel) ─────────────────────

/** The configurable optional fields the owner can require on a channel. */
export const INTAKE_FIELDS: { key: string; label: string }[] = [
  { key: 'phone', label: 'Phone number' },
  { key: 'contact_method', label: 'Preferred contact method' },
  { key: 'message', label: 'A message / note' },
  { key: 'source', label: 'How they heard about us' },
  { key: 'availability', label: 'Availability' },
  { key: 'experience', label: 'Rider experience' },
];

/** Read a channel's required-field map, e.g. { phone: true }. */
export async function getIntakeRequirements(channel: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.rpc('intake_requirements', { p_channel: channel });
  if (error) throw error;
  return (data ?? {}) as Record<string, boolean>;
}

/** Staff: set whether one field is required for a channel (upsert). */
export async function setIntakeRequirement(
  channel: string,
  fieldKey: string,
  required: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_intake_requirement', {
    p_channel: channel,
    p_field_key: fieldKey,
    p_required: required,
  });
  if (error) throw error;
}

// ─── Booking requests (the Request Inbox) ────────────────────────────────────

export type BookingRequestStatus = 'new' | 'contacted' | 'invited' | 'expired' | 'converted';

/** One append_request_note timeline entry (requests.staff_notes element). */
export interface RequestStaffNote {
  at: string; // timestamptz serialized by jsonb_build_object(now())
  by_name: string;
  note: string;
}

/** request_selections row embedded on the request (what the visitor asked for). */
export interface BookingRequestSelection {
  id: string;
  offering_id: string | null;
  offering_slug: string | null;
  label: string | null;
}

export interface BookingRequest {
  id: string;
  created_at: string;
  status: BookingRequestStatus;
  contact_name: string;
  /** Canonical split from the unified intake (older rows may be null). */
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  contact_method: 'text' | 'call' | 'email' | null;
  /** Where the submission came from + what it's about (unified intake). */
  category: string | null;
  channel: string | null;
  /** Structured availability (src/lib/availability.ts) — legacy {date,time} entries may coexist. */
  proposed_times: ProposedTime[];
  notes: string | null;
  staff_notes: RequestStaffNote[];
  /** Flat object of checklist-item key → boolean; null until staff start it. */
  checklist: Record<string, boolean> | null;
  /** Category-specific answers (C1), keyed by field key. Empty object when none. */
  details: Record<string, string> | null;
  request_selections: BookingRequestSelection[];
  /** INBOUNDALERT: whether the ops inbox was actually told about this lead.
   *  NOT selected from `requests` — merged on by `listLeadQueue` from the
   *  `inbound_queue` row, which is where the verdict is defined. Absent on rows
   *  that did not come through `listLeadQueue` (e.g. plain `listBookingRequests`). */
  alert?: RequestAlertState;
}

/** How the ops-inbox alert for one request turned out. Mirrors `inbound_queue`'s
 *  alert_* columns exactly — the definition lives in the view, not here. */
export interface RequestAlertState {
  /** 'sent' | 'failed' | 'not_attempted' | 'unknown' (predates the record). */
  state: 'sent' | 'failed' | 'not_attempted' | 'unknown';
  /** When the alert last succeeded, or last failed. Null when never attempted. */
  attemptedAt: string | null;
  /** Where it was sent — the tenant's configured ops inbox. */
  recipient: string | null;
  /** The provider's error, verbatim. Null unless `state` is 'failed'. */
  error: string | null;
}

/** The Request Inbox, newest first, selections embedded; optionally one status. */
export async function listBookingRequests(
  status?: BookingRequestStatus,
): Promise<BookingRequest[]> {
  let query = supabase
    .from('requests')
    .select('*, request_selections(*)')
    .order('created_at', { ascending: false });
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BookingRequest[];
}

/* ─── TASK-CATEGORISE §4 — the DERIVED category membership of an inquiry ──────
 *
 * `requests.category` is ONE value and it is chosen from `state.funnel` — the
 * page the visitor happened to be standing on when they submitted. A cart
 * holding a riding lesson and a horse clipping is filed under one of them, so a
 * staff member filtering by horse care never sees it. The category is not a
 * label: it selects the legal document set the person must sign before they
 * arrive, so under-counting here is someone arriving uncovered.
 *
 * The `request_categories` view is the plural answer — every category the cart
 * touches, PLUS the value the funnel stored, with provenance on each. It cannot
 * under-count, which is why this shape was chosen over a second stored column
 * that a trigger would have to keep in step with a cart that keeps changing.
 */
export interface RequestCategoryRow {
  request_id: string;
  category: string;
  /** The cart says so — an offering in this category's segment is on the request. */
  from_cart: boolean;
  /** The stored `requests.category` says so — the funnel they submitted from. */
  from_funnel: boolean;
}

/** Every inquiry's derived category membership, as request_id -> categories.
 *  Read straight from the view: RLS (security_invoker) means a non-staff caller
 *  gets an empty map rather than someone else's inbox. */
export async function listRequestCategories(): Promise<Map<string, RequestCategoryRow[]>> {
  const { data, error } = await supabase
    .from('request_categories')
    .select('request_id, category, from_cart, from_funnel');
  if (error) throw error;
  const out = new Map<string, RequestCategoryRow[]>();
  for (const row of (data ?? []) as RequestCategoryRow[]) {
    const list = out.get(row.request_id);
    if (list) list.push(row);
    else out.set(row.request_id, [row]);
  }
  for (const list of out.values()) list.sort((a, b) => a.category.localeCompare(b.category));
  return out;
}

/** One row of the inbound QUEUE: the request plus how long it has been sitting
 *  and whether its person ever got captured. */
export interface InboundQueueRow {
  id: string;
  status: string;
  channel: string | null;
  category: string | null;
  created_at: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  subject: string | null;
  notes: string | null;
  days_open: number;
  contact_id: string | null;
  contact_type: string | null;
  /** The person already became a client — the work is done, the row was just
   *  never closed. Six of the nine rows in the live backlog were exactly this. */
  already_converted: boolean;
  /** Still new, NOT already converted, and 2+ days old. Deliberately narrow so
   *  stale bookkeeping does not shout for attention it does not need. */
  overdue: boolean;
  /** INBOUNDALERT — was the owner actually told? Computed in the view from
   *  `request_alert_sends`, one row per send attempt. 'not_attempted' means the
   *  alert endpoint never ran at all; 'unknown' means the request predates the
   *  attempt record, so silence proves nothing either way. */
  alert_state: 'sent' | 'failed' | 'not_attempted' | 'unknown';
  alert_attempted_at: string | null;
  alert_recipient: string | null;
  /** The provider's error verbatim, or null when the alert succeeded. */
  alert_error: string | null;
}

/** The inbound queue, oldest first — a queue is worked from the top, so the
 *  thing that has waited longest leads. This is the opposite of the registry
 *  pages, which sort newest-first for browsing. */
export async function listInboundQueue(): Promise<InboundQueueRow[]> {
  const { data, error } = await supabase
    .from('inbound_queue')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InboundQueueRow[];
}

// ─── The lead queue: which cards are still open, and which retired themselves ─

/** A request nobody needs to work anymore, because its person already became a
 *  client. The row is NOT deleted and NOT restatused — it is the evidence of how
 *  the relationship started. It just stops being an open card, and carries the
 *  contact it resolved to so the surface can link to that person's record. */
export interface ConvertedLead {
  requestId: string;
  name: string;
  email: string | null;
  /** The contact `inbound_queue` resolved this request to (its own join). */
  contactId: string | null;
  createdAt: string;
  /** The request's stored status, untouched — usually still 'new'. */
  status: string;
}

export interface LeadQueue {
  /** Still real work: not converted, not in a terminal status. */
  open: BookingRequest[];
  /** Converted — retired from the open list, kept as history. Newest first. */
  converted: ConvertedLead[];
}

/** Statuses that end a request's life in the queue on their own, converted-or-not. */
const TERMINAL_REQUEST_STATUSES = new Set(['converted', 'expired']);

/**
 * Split the request inbox into what still needs working and what quietly
 * finished. **The verdict is `inbound_queue.already_converted` and nothing
 * else** — the view joins requests → contacts on `contact_id` when it is set and
 * on lower(email) when it is not, and calls the person converted once that
 * contact is a CONTACT rather than a LEAD. That definition already existed, is
 * already delivered to the UI, and is the only one allowed: a second derivation
 * here is how three surfaces came to disagree in the first place.
 *
 * `already_converted` is null when no contact matched at all (a submission from
 * someone we have no record of) — that is NOT converted, so it stays open.
 *
 * Two reads rather than one because the view carries the verdict and the
 * `requests` table carries `request_selections` (what they actually asked for),
 * which the card needs to say anything useful.
 */
export async function listLeadQueue(): Promise<LeadQueue> {
  const [queue, requests] = await Promise.all([
    listInboundQueue(),
    listBookingRequests(),
  ]);
  const byId = new Map(requests.map((r) => [r.id, r]));
  const open: BookingRequest[] = [];
  const converted: ConvertedLead[] = [];
  for (const row of queue) {
    if (row.already_converted === true) {
      const full = byId.get(row.id);
      converted.push({
        requestId: row.id,
        name: [row.contact_first_name, row.contact_last_name].filter(Boolean).join(' ')
          || full?.contact_name || row.contact_email || 'Someone',
        email: row.contact_email,
        contactId: row.contact_id,
        createdAt: row.created_at,
        status: row.status,
      });
      continue;
    }
    if (TERMINAL_REQUEST_STATUSES.has(row.status)) continue;
    const full = byId.get(row.id);
    // The alert verdict rides along from the view rather than being re-derived
    // here — same rule as `already_converted`: one definition, in the database.
    if (full) {
      open.push({
        ...full,
        alert: {
          state: row.alert_state,
          attemptedAt: row.alert_attempted_at,
          recipient: row.alert_recipient,
          error: row.alert_error,
        },
      });
    }
  }
  converted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { open, converted };
}

/** Flip a request to 'contacted' (staff UPDATE policy is the fence). */
export async function markRequestContacted(id: string): Promise<BookingRequest> {
  const { data, error } = await supabase
    .from('requests')
    .update({ status: 'contacted' })
    .eq('id', id)
    .select('*, request_selections(*)')
    .single();
  if (error) throw error;
  return data as BookingRequest;
}

/** Append a staff call note via the staff-gated RPC; returns the updated timeline. */
export async function appendRequestNote(
  id: string,
  note: string,
): Promise<RequestStaffNote[]> {
  const { data, error } = await supabase.rpc('append_request_note', {
    p_request_id: id,
    p_note: note,
  });
  if (error) throw error;
  return (data ?? []) as RequestStaffNote[];
}

/** Persist the lesson-fit checklist state (flat key → boolean object). */
export async function setRequestChecklist(
  id: string,
  checklist: Record<string, boolean>,
): Promise<void> {
  const { error } = await supabase.rpc('set_request_checklist', {
    p_request_id: id,
    p_checklist: checklist,
  });
  if (error) throw error;
}

/**
 * Resolve the CLIENT provisioned from a booking request, walking the Flow A
 * chain: request → invitations.request_id → email → contacts → clients. Staff
 * RLS (invitations admin read, contacts/clients staff read) is the fence.
 * Returns null when the request has no invitation yet or the provisioned
 * contact/client rows are missing — the drawer renders the explanatory branch.
 */
export async function findClientForRequest(requestId: string): Promise<string | null> {
  const { data: inv, error: invError } = await supabase
    .from('invitations')
    .select('email')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invError) throw invError;
  const email = (inv as { email: string } | null)?.email;
  if (!email) return null;

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id')
    .ilike('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact) return null;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('contact_id', (contact as { id: string }).id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (clientError) throw clientError;
  return (client as { id: string } | null)?.id ?? null;
}

/**
 * Resolve the submission's contact to a CRM contact id: match on email when
 * present (soft-deleted excluded), otherwise create the contact. The brokerage
 * engagement RPCs take a contact id, so CONVERT needs this seam first.
 */
export async function findOrCreateContactByEmail(
  fullName: string,
  email: string | null,
): Promise<string> {
  if (email) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return (data as { id: string }).id;
  }
  // contacts carry first/last only (full_name removed 20260702090000): split the
  // freeform intake name on the FIRST space; a single-token name is first-only.
  const trimmed = fullName.trim();
  const spaceAt = trimmed.indexOf(' ');
  const firstName = spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed;
  const lastName = spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() || null : null;
  const { data, error } = await supabase
    .from('contacts')
    .insert({ first_name: firstName, last_name: lastName, email })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ─── CAREPATH §C5/§C5c/§C6 — the ORDER(S) an inquiry opened ─────────────────

/** One line on an inquiry's order. `voided_at` set = cancelled but retained. */
export interface RequestOrderItem {
  id: string;
  label: string;
  price_amount: number | null;
  price_unit: string | null;
  quantity: number;
  offering_id: string | null;
  /** From the CATALOG — what shape of schedule this line needs (§C7). */
  config_kind: string | null;
  /** From the CATALOG. The `2x` is how the owner DESCRIBES a weekly item; this
   *  is where the number actually lives. Never parsed from the name. */
  weekly_frequency: number | null;
  unit_count: number | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface RequestOrder {
  id: string;
  display_code: string | null;
  status: string;
  /** 'enquiry' = opened by a website inquiry and awaiting the call;
   *  'awaiting_horse' = held (§C5c). NULL on a staff-made draft. */
  current_status: string | null;
  current_status_label: string | null;
  amount: number;
  payment_status: string;
  created_at: string;
  notes: string | null;
  items: RequestOrderItem[];
}

/** Every order this inquiry opened — TWO of them after a §C5c split. */
export async function listRequestOrders(requestId: string): Promise<RequestOrder[]> {
  const { data, error } = await supabase.rpc('request_orders', { p_request_id: requestId });
  if (error) throw error;
  return (data ?? []) as RequestOrder[];
}

/** §C5c — move chosen lines into a SECOND order on the same inquiry. A staff
 *  action, taken after the call; nothing splits automatically at submission. */
export async function splitRequestOrder(
  purchaseId: string, itemIds: string[], reason?: string,
): Promise<{ purchase_id: string; moved: number }> {
  const { data, error } = await supabase.rpc('split_purchase', {
    p_purchase_id: purchaseId, p_item_ids: itemIds, p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as { purchase_id: string; moved: number };
}

/** §C5c — hold an order as a draft that owes nothing and schedules nothing. It
 *  wakes by itself when a horse appears for this client. */
export async function holdOrderForHorse(purchaseId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('hold_purchase_for_horse', {
    p_purchase_id: purchaseId, p_reason: reason ?? null,
  });
  if (error) throw error;
}

/** §C5b rule 6 — cancel ONE line. The order total recomputes, and the order
 *  itself voids when the last live line goes. The line is retained, never
 *  deleted: what was asked for is evidence. */
export async function voidOrderItem(itemId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('void_purchase_item', {
    p_item_id: itemId, p_reason: reason ?? null,
  });
  if (error) throw error;
}
