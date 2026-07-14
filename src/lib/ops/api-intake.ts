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
