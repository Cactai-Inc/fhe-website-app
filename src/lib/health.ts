import { supabase } from './supabase';
import { DbError } from './horses';

/**
 * HEALTH LOG (fix round 3, item 6) — the per-horse health log and care-provider
 * roster shown on the horse record. Providers are companies (business + phone +
 * email) with people under them (name + phone + email); events are typed with
 * type-specific structured fields, a next-due date, an optional provider company +
 * person, and one or more file attachments in the private horse-health bucket.
 *
 * Visible to staff, the horse's owner, and an active lessee; editable by the same.
 * Deleting an event is staff only.
 */

export const PROVIDER_ROLES = [
  'VET', 'FARRIER', 'DENTIST', 'BODYWORK', 'ACUPUNCTURE', 'MASSAGE', 'CHIROPRACTIC', 'OTHER',
] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export const PROVIDER_ROLE_LABEL: Record<ProviderRole, string> = {
  VET: 'Veterinarian', FARRIER: 'Farrier', DENTIST: 'Dentist', BODYWORK: 'Bodywork',
  ACUPUNCTURE: 'Acupuncture', MASSAGE: 'Massage', CHIROPRACTIC: 'Chiropractic', OTHER: 'Other',
};

/** Every health event type and the structured fields it carries (item 6). */
export const EVENT_TYPES = [
  'vet_visit', 'farrier', 'medication', 'vaccination', 'deworming', 'coggins',
  'dental', 'bodywork', 'injury', 'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  vet_visit: 'Vet visit', farrier: 'Farrier', medication: 'Medication given',
  vaccination: 'Vaccination', deworming: 'Deworming', coggins: 'Coggins',
  dental: 'Dental', bodywork: 'Bodywork', injury: 'Injury', other: 'Other',
};

/** The structured fields per event type — key → label. The form renders these and
 *  stores the answers in the event's `structured` jsonb. */
export const EVENT_FIELDS: Record<EventType, { key: string; label: string; kind?: 'date' | 'yesno' | 'long' }[]> = {
  vet_visit: [{ key: 'reason', label: 'Reason' }, { key: 'findings', label: 'Findings', kind: 'long' }, { key: 'follow_up', label: 'Follow-up', kind: 'long' }],
  farrier: [{ key: 'work_done', label: 'Work done', kind: 'long' }],
  medication: [
    { key: 'medication_name', label: 'Medication name' }, { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'lot_number', label: 'Lot number' }, { key: 'manufacture_date', label: 'Manufacture date', kind: 'date' },
    { key: 'expiration_date', label: 'Expiration date', kind: 'date' }, { key: 'beyond_use_date', label: 'Beyond-use date', kind: 'date' },
    { key: 'dose', label: 'Dose' }, { key: 'route', label: 'Route' }, { key: 'frequency', label: 'Frequency' },
    { key: 'prescription', label: 'Prescription?', kind: 'yesno' }, { key: 'prescribing_provider', label: 'Prescribing provider' },
  ],
  vaccination: [
    { key: 'vaccine_name', label: 'Vaccine name' }, { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'lot_number', label: 'Lot number' }, { key: 'expiration_date', label: 'Expiration date', kind: 'date' },
    { key: 'site', label: 'Site' },
  ],
  deworming: [{ key: 'product', label: 'Product' }, { key: 'dose', label: 'Dose' }],
  coggins: [{ key: 'result', label: 'Result' }, { key: 'lab', label: 'Lab' }, { key: 'expiration_date', label: 'Expiration date', kind: 'date' }],
  dental: [],
  bodywork: [{ key: 'modality', label: 'Modality' }],
  injury: [{ key: 'description', label: 'Description', kind: 'long' }],
  other: [{ key: 'text', label: 'Details', kind: 'long' }],
};

export interface HealthProvider {
  id: string;
  role: ProviderRole;
  role_label: string | null;
  business_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  person_name: string | null;
  person_phone: string | null;
  person_email: string | null;
  party_contact_id: string | null;
}

export interface HealthEventFile { id: string; name: string | null; path: string }

export interface HealthEvent {
  id: string;
  event_type: EventType;
  event_date: string | null;
  next_due_date: string | null;
  notes: string | null;
  structured: Record<string, unknown>;
  provider_company_id: string | null;
  provider_person_id: string | null;
  company_name: string | null;
  person_name: string | null;
  file_count: number;
  files: HealthEventFile[];
}

export interface HealthLog {
  org_id: string;
  can_edit: boolean;
  is_staff: boolean;
  providers: HealthProvider[];
  events: HealthEvent[];
}

export async function horseHealthLog(horseId: string): Promise<HealthLog> {
  const { data, error } = await supabase.rpc('horse_health_log', { p_horse_id: horseId });
  if (error) throw new DbError(error, 'Loading the health log');
  return data as HealthLog;
}

export async function addHealthProvider(p: {
  horse_id: string; relationship: ProviderRole; role_label?: string;
  business_name?: string; phone?: string; email?: string;
  party_name_text?: string; person_phone?: string; person_email?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_horse_provider', { p });
  if (error) throw new DbError(error, 'Adding the provider');
  return data as string;
}

export async function addHealthEvent(p: {
  horse_id: string; event_type: EventType; event_date?: string; next_due_date?: string | null;
  provider_company_id?: string | null; provider_person_id?: string | null;
  notes?: string | null; structured?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_health_event', { p });
  if (error) throw new DbError(error, 'Logging the event');
  return data as string;
}

export async function updateHealthEvent(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('update_health_event', { p_id: id, p: patch });
  if (error) throw new DbError(error, 'Updating the event');
}

export async function deleteHealthEvent(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_health_event', { p_id: id });
  if (error) throw new DbError(error, 'Deleting the event');
}

/** Upload a file into the private horse-health bucket and link it to an event. */
export async function uploadHealthEventFile(
  horseId: string, eventId: string, orgId: string, file: File,
): Promise<void> {
  const path = `${horseId}/${eventId}/${Date.now()}-${file.name}`.replace(/[^\w./-]/g, '_');
  const up = await supabase.storage.from('horse-health').upload(path, file, { upsert: false });
  if (up.error) throw new DbError(up.error, 'Uploading the file');
  const { error } = await supabase.from('horse_health_event_files').insert({
    org_id: orgId, horse_id: horseId, event_id: eventId, storage_path: path,
    file_name: file.name, content_type: file.type, size_bytes: file.size,
  });
  if (error) throw new DbError(error, 'Linking the file');
}

/** A signed URL to open a private attachment. */
export async function healthFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('horse-health').createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
