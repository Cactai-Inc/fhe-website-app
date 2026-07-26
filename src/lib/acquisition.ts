/* Acquisition intake (Phase 4) — a Find-a-Horse / Horse-Evaluation purchase
 * unlocks an intake form the client fills. The submission lands on the purchased
 * line's purchase_items.config (via submit_acquisition_intake) and is surfaced as
 * a dashboard task by my_acquisition_intake_state. */
import { supabase } from './supabase';

export type AcquisitionIntakeKind = 'intake_finder' | 'intake_evaluation';

export interface PendingAcquisitionIntake {
  purchase_item_id: string;
  offering_id: string | null;
  label: string;
  config_kind: AcquisitionIntakeKind;
}

export interface AcquisitionIntakeState {
  pending: PendingAcquisitionIntake[];
  needs_intake: boolean;
}

export async function fetchAcquisitionIntakeState(): Promise<AcquisitionIntakeState> {
  const { data, error } = await supabase.rpc('my_acquisition_intake_state');
  if (error) throw error;
  return data as AcquisitionIntakeState;
}

export async function submitAcquisitionIntake(
  purchaseItemId: string, data: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('submit_acquisition_intake', {
    p_purchase_item_id: purchaseItemId, p_data: data,
  });
  if (error) throw error;
}

/** One intake field. Free-text/textarea/select cover every datapoint the two
 *  forms need without a schema table (the values live in purchase_items.config). */
export interface IntakeField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  placeholder?: string;
}

/** Find-a-Horse — the SELECTION CRITERIA the client contributes; we defer on the
 *  rest and run the search. */
export const FINDER_FIELDS: IntakeField[] = [
  { key: 'discipline', label: 'Discipline / intended use', type: 'text', placeholder: 'e.g. hunter/jumper, dressage, trail' },
  { key: 'budget', label: 'Budget range', type: 'text', placeholder: 'e.g. $15,000–$25,000' },
  { key: 'experience_level', label: 'Rider experience level', type: 'select',
    options: ['Beginner', 'Advanced beginner', 'Intermediate', 'Advanced', 'Professional'] },
  { key: 'height', label: 'Preferred height', type: 'text', placeholder: 'e.g. 15.2–16.2 hh' },
  { key: 'age', label: 'Preferred age range', type: 'text', placeholder: 'e.g. 6–12 years' },
  { key: 'breed', label: 'Breed preferences (optional)', type: 'text', placeholder: 'Any preferred breeds' },
  { key: 'temperament', label: 'Temperament', type: 'text', placeholder: 'e.g. quiet, forward, brave' },
  { key: 'location_radius', label: 'How far will you travel?', type: 'text', placeholder: 'e.g. within 200 miles of San Diego' },
  { key: 'timeline', label: 'Timeline', type: 'text', placeholder: 'e.g. within 3 months' },
  { key: 'must_haves', label: 'Must-haves / deal-breakers', type: 'textarea', placeholder: 'Anything essential or disqualifying' },
];

/** Horse Evaluation — the OWNER-INTAKE facts we need before the in-person visit. */
export const EVALUATION_FIELDS: IntakeField[] = [
  { key: 'horse_name', label: "Horse's name", type: 'text' },
  { key: 'horse_location', label: 'Where is the horse located?', type: 'text', placeholder: 'Barn / property address' },
  { key: 'owner_name', label: "Current owner's name", type: 'text' },
  { key: 'purpose', label: 'Why are you having this horse evaluated?', type: 'textarea',
    placeholder: 'Considering purchase, lease, pre-purchase exam, etc.' },
  { key: 'breed', label: 'Breed', type: 'text' },
  { key: 'age', label: 'Age', type: 'text' },
  { key: 'discipline', label: 'Current discipline / training', type: 'text' },
  { key: 'known_issues', label: 'Any known health or behavioral issues?', type: 'textarea' },
  { key: 'availability', label: 'When is the horse available for us to visit?', type: 'text' },
];

export function fieldsForKind(kind: AcquisitionIntakeKind): IntakeField[] {
  return kind === 'intake_finder' ? FINDER_FIELDS : EVALUATION_FIELDS;
}

// ─── Evaluation reports (Phase 4) ────────────────────────────────────────────
import { downloadDocumentPdf } from './documentPdf';

export interface MyEvaluationReport {
  id: string;
  title: string;
  horse_label: string | null;
  body: string | null;
  delivered_at: string | null;
  available_until: string | null;
  is_shared: boolean;
}
export interface StaffEvaluationReport {
  id: string;
  contact_id: string;
  title: string;
  horse_label: string | null;
  status: 'draft' | 'delivered' | 'void';
  delivered_at: string | null;
  available_until: string | null;
  created_at: string;
}

/** The client's own currently-available reports (retention + shares via RLS). */
export async function fetchMyEvaluationReports(): Promise<MyEvaluationReport[]> {
  const { data, error } = await supabase.rpc('my_evaluation_reports');
  if (error) throw error;
  return (data ?? []) as MyEvaluationReport[];
}

/** Staff: every report in the org (all statuses). */
export async function fetchStaffEvaluationReports(): Promise<StaffEvaluationReport[]> {
  const { data, error } = await supabase.rpc('staff_evaluation_reports');
  if (error) throw error;
  return (data ?? []) as StaffEvaluationReport[];
}

export async function createEvaluationReport(input: {
  contactId: string; purchaseItemId?: string | null; horseId?: string | null; title?: string;
}): Promise<{ id: string; reused: boolean }> {
  const { data, error } = await supabase.rpc('create_evaluation_report', {
    p_contact_id: input.contactId,
    p_purchase_item_id: input.purchaseItemId ?? null,
    p_horse_id: input.horseId ?? null,
    p_title: input.title ?? null,
  });
  if (error) throw error;
  return data as { id: string; reused: boolean };
}

export async function saveEvaluationReport(
  reportId: string, body: string, title?: string, horseLabel?: string): Promise<void> {
  const { error } = await supabase.rpc('save_evaluation_report', {
    p_report_id: reportId, p_body: body,
    p_title: title ?? null, p_horse_label: horseLabel ?? null,
  });
  if (error) throw error;
}

/** Staff: deliver the report → status delivered, retention window, client alert.
 *  Then email the client a PDF copy (best-effort). */
export async function deliverEvaluationReport(reportId: string): Promise<{ consistent_client: boolean }> {
  const { data, error } = await supabase.rpc('deliver_evaluation_report', { p_report_id: reportId });
  if (error) throw error;
  // email the client their copy (best-effort — the in-app copy is authoritative)
  await fetch('/api/deliver-evaluation-report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, action: 'email' }),
  }).catch(() => {});
  return data as { consistent_client: boolean };
}

/** Share a report with someone by email (records the share + emails the PDF). */
export async function shareEvaluationReport(reportId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('share_evaluation_report', { p_report_id: reportId, p_email: email });
  if (error) throw error;
  await fetch('/api/deliver-evaluation-report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, action: 'share', toEmail: email }),
  }).catch(() => {});
}

/** Email the signed-in client their own copy of a report. */
export async function emailMyEvaluationReport(reportId: string): Promise<void> {
  const r = await fetch('/api/deliver-evaluation-report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, action: 'email' }),
  });
  if (!r.ok) throw new Error('Could not email the report.');
}

/** Download a report as a PDF in the browser + log the access. */
export async function downloadEvaluationReport(report: MyEvaluationReport): Promise<void> {
  const heading = report.horse_label ? `${report.title} — ${report.horse_label}` : report.title;
  await downloadDocumentPdf(heading, report.body ?? '');
  await supabase.rpc('log_evaluation_report_access', {
    p_report_id: report.id, p_action: 'downloaded', p_detail: 'pdf',
  }).then(() => {}, () => {});
}

export async function logReportViewed(reportId: string): Promise<void> {
  await supabase.rpc('log_evaluation_report_access', {
    p_report_id: reportId, p_action: 'viewed', p_detail: null,
  }).then(() => {}, () => {});
}
