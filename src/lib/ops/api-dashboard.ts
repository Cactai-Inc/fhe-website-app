import { supabase } from '../supabase';

/**
 * THE OWNER DASHBOARD DATA SEAM — one wrapper per zone reader, and nothing else.
 *
 * DASHBOARDBUILD §3 / DASHBOARDS-GROUND-UP-PLAN §7: every zone is ONE named RPC
 * that returns its rows and its true count in a single call, and the dashboard
 * fires them in parallel. Nothing in this file computes a number — if a figure
 * needs deriving, it is derived in the database so that every other surface
 * showing the same figure can call the same function (D18).
 *
 * The envelope is identical for every zone:
 *
 *     { count: number; items: T[] }
 *
 * `count` is the TRUE total and `items` may be capped by the reader, which is
 * why the zone framework reads `count` and never `items.length`. A zone whose
 * count is 0 is not rendered at all — see `OwnerDashboard`.
 */

export interface ZoneResult<T> {
  count: number;
  items: T[];
}

async function zone<T>(fn: string, args?: Record<string, unknown>): Promise<ZoneResult<T>> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) throw error;
  const r = (data ?? { count: 0, items: [] }) as ZoneResult<T>;
  return { count: r.count ?? 0, items: r.items ?? [] };
}

/* ── C1 · today's plan ──────────────────────────────────────────────────── */
export interface TodayRow {
  booking_id: string;
  starts_at: string;
  ends_at: string | null;
  client_id: string | null;
  client_name: string | null;
  service_type: string | null;
  status: string | null;
  plan_id: string | null;
  plan_version: number | null;
  focus: string | null;
  next_up: string | null;
  has_plan: boolean;
  progress_recorded: boolean;
  client_note: boolean;
  horse_name: string | null;
}
export const fetchTodayPlan = () => zone<TodayRow>('dash_today_plan');

/* ── C2 · week strip ───────────────────────────────────────────────────── */
export interface WeekDay {
  day: string;
  is_today: boolean;
  booked: number;
  open: number;
  care_due: number;
  lease_ends: number;
  items: { booking_id: string; starts_at: string; service_type: string | null; client_name: string | null }[];
}
export const fetchWeekStrip = () => zone<WeekDay>('dash_week_strip');

/* ── C3 · money waiting ────────────────────────────────────────────────── */
export interface MoneyRow {
  kind: 'claim' | 'order';
  purchase_id: string;
  display_code: string | null;
  amount: number;
  buyer_name: string | null;
  buyer_contact_id: string | null;
  method: string | null;
  reference: string | null;
  declared_at: string | null;
  created_at: string;
  age_days: number;
  items: string[];
}
export const fetchMoneyWaiting = () => zone<MoneyRow>('dash_money_waiting');

/* ── C4 · people waiting ───────────────────────────────────────────────── */
export interface PersonWaitingRow {
  kind: 'inquiry' | 'reschedule' | 'message' | 'contract_note';
  id: string;
  who: string | null;
  subject: string | null;
  detail: string | null;
  since: string;
  age_hours: number;
  status?: string | null;
  contact_id?: string | null;
  booking_id?: string | null;
  sender_id?: string | null;
  document_id?: string | null;
}
export const fetchPeopleWaiting = () => zone<PersonWaitingRow>('dash_people_waiting');

/* ── C6 · notes loop ───────────────────────────────────────────────────── */
export interface NotesRow {
  kind: 'write_up' | 'unread_note';
  id: string;
  booking_id: string | null;
  note_id?: string;
  starts_at: string | null;
  since: string;
  age_days: number;
  client_id?: string | null;
  client_name?: string | null;
  service_type?: string | null;
  author_name?: string | null;
  phase?: string | null;
  body?: string | null;
}
export const fetchNotesLoop = () => zone<NotesRow>('dash_notes_loop');

/** C6 — record that this staff account has read a client's lesson note.
 *  Writes through the RPC, never the table: `booking_note_seen` has no INSERT
 *  policy, which is what stops a second write path existing at all. */
export async function markBookingNoteSeen(noteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_booking_note_seen', { p_note_id: noteId });
  if (error) throw error;
  return data as boolean;
}

/* ── C7 · stable board ─────────────────────────────────────────────────── */
export interface StableReason {
  kind: 'health_overdue' | 'health_due' | 'lease_ending' | 'medication';
  label: string | null;
  due?: string | null;
  detail?: string | null;
  event_id?: string;
  med_id?: string;
}
export interface StableRow {
  horse_id: string;
  name: string;
  urgency: number;
  rides_this_week: number;
  reasons: StableReason[];
}
export const fetchStableBoard = () => zone<StableRow>('dash_stable_board');

/* ── C9 · documents & onboarding ───────────────────────────────────────── */
export interface DocRow {
  kind: 'unsigned' | 'invitation_expiring';
  id: string;
  who: string | null;
  contact_id?: string | null;
  templates?: string[];
  blocks_at?: string | null;
  expires_at?: string | null;
  rank: number;
}
export const fetchDocumentsOnboarding = () => zone<DocRow>('dash_documents_onboarding');

/* ── C11 · community pulse ─────────────────────────────────────────────── */
export interface CommunityRow {
  kind: 'pulled_down' | 'reported' | 'scan_pending' | 'event_upcoming';
  id: string;
  body?: string | null;
  reason?: string | null;
  title?: string | null;
  since: string;
  starts_at?: string | null;
  rsvps?: number;
  capacity?: number | null;
  author_id?: string | null;
}
export const fetchCommunityPulse = () => zone<CommunityRow>('dash_community_pulse');

/* ── C12 · evaluations due ─────────────────────────────────────────────── */
export interface EvalRow {
  kind: 'rider' | 'horse';
  id: string;
  who: string | null;
  contact_id?: string | null;
  horse_id?: string | null;
  since: string;
}
export const fetchEvaluationsDue = () => zone<EvalRow>('dash_evaluations_due');

/* ── C13 · gifts ───────────────────────────────────────────────────────── */
export interface GiftRow {
  gift_id: string;
  code: string | null;
  item_label: string | null;
  amount: number | null;
  buyer: string | null;
  recipient: string | null;
  deliver_on: string | null;
  opened_at: string | null;
  status: string | null;
  since: string;
}
export const fetchGifts = () => zone<GiftRow>('dash_gifts');

/* ── B1 · money health ─────────────────────────────────────────────────── */
export interface MoneyHealthRow {
  kind: 'declared' | 'unpaid_aging' | 'receipt_failed';
  id: string;
  purchase_id: string | null;
  display_code?: string | null;
  amount?: number;
  who: string | null;
  method?: string | null;
  detail?: string | null;
  since: string;
  age_days: number;
}
export const fetchMoneyHealth = () => zone<MoneyHealthRow>('dash_money_health');

/* ── B2 · Claire's plate (the selective mirror) ────────────────────────── */
export interface MirrorRow {
  kind: 'money' | 'people' | 'notes_overdue';
  label: string;
  count: number;
  amount?: number;
  oldest_days?: number;
  oldest_hours?: number;
  breach: boolean;
}
export const fetchClairesPlate = () => zone<MirrorRow>('dash_claires_plate');

/* ── B3 · deals & contracts ────────────────────────────────────────────── */
export interface DealRow {
  kind: 'proposal' | 'change_request' | 'awaiting_signature' | 'deal_open';
  id: string;
  document_id?: string | null;
  deal_id?: string | null;
  title: string | null;
  display_code?: string | null;
  detail?: string | null;
  who?: string | null;
  deal_type?: string | null;
  status?: string | null;
  since: string;
  age_days?: number;
  mine_to_sign?: boolean;
}
export const fetchDealsContracts = () => zone<DealRow>('dash_deals_contracts');

/* ── B6 · activity read-back — REMOVED 2026-08-31 (owner, TASK-FIX3) ──────
 * The zone went with /app/ops/activity and /app/ops/oversight: *"remove this
 * from all surfaces… less clutter in the menus and on the dashboard."*
 * ⚠️ `dash_activity_readback(p_limit)` IS STILL IN THE DATABASE and still
 * correct — five ledgers, org-scoped, fair-share per ledger. It is the working
 * starting point if an activity surface is ever earned back, which is why it is
 * retained rather than dropped. What it would take is written down in
 * docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md.
 */

/* ── B8 · catalog & tenant hygiene ─────────────────────────────────────── */
export interface HygieneRow {
  kind: 'tile_no_skus' | 'tile_no_image' | 'offering_no_config' | 'offering_no_price' | 'staff_no_title';
  id: string;
  label: string | null;
  detail: string | null;
  rank: number;
}
export const fetchCatalogHygiene = () => zone<HygieneRow>('dash_catalog_hygiene');

/* ── B9 · onboarding pipeline ──────────────────────────────────────────── */
export interface PipelineRow {
  kind: 'invite_failed' | 'invite_open' | 'account_pending';
  id: string;
  who: string | null;
  detail?: string | null;
  contact_id?: string | null;
  expires_at?: string | null;
  unsigned?: number;
  since: string;
  age_days?: number;
}
export const fetchOnboardingPipeline = () => zone<PipelineRow>('dash_onboarding_pipeline');

/* ── N1 · notifications ────────────────────────────────────────────────── */
/**
 * ⚠️ THE ONE ZONE WHOSE `items` ARE NEVER CAPPED. Owner, 2026-08-26: "dashboard
 * zone, full list of notifications, collapsable, never sticky." Every other
 * reader may cap and let `count` carry the true total; a notification list that
 * hides notifications is the complaint that produced this zone, so
 * `dash_notifications` returns all of them and the component renders all of them.
 */
export interface NotificationRow {
  id: string;
  kind: string;
  category: string | null;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}
export const fetchNotifications = () => zone<NotificationRow>('dash_notifications');

/* ── The two KPI ribbons ───────────────────────────────────────────────── */
export interface TrainerKpis {
  today_lessons: number;
  week_booked: number;
  week_capacity: number;
  awaiting_confirmation: number;
  people_waiting: number;
  people_oldest_hours: number;
}
export async function fetchTrainerKpis(): Promise<TrainerKpis> {
  const { data, error } = await supabase.rpc('dash_trainer_kpis');
  if (error) throw error;
  return data as TrainerKpis;
}

export interface RevenueWindow {
  total: number;
  count: number;
  prior_total: number;
  prior_count: number;
  delta: number;
  delta_pct: number | null;
  from: string;
  to: string;
}
/** Revenue is NOT here, deliberately — see `dash_business_kpis`'s own header and
 *  `lib/dashboard/windows.ts`. The ribbon calls `revenue_summary` with the same
 *  window the calendar passes, which is what makes §7.4's "identical number"
 *  true by construction rather than by coincidence. */
export interface BusinessKpis {
  new_clients_month: number;
  leads_90d: number;
  converted_90d: number;
  open_pipeline: number;
  declared_unconfirmed: number;
}
export async function fetchBusinessKpis(): Promise<BusinessKpis> {
  const { data, error } = await supabase.rpc('dash_business_kpis');
  if (error) throw error;
  return data as BusinessKpis;
}

/** THE default-view setting (DASHBOARDBUILD §2.2). The on-dashboard toggle does
 *  NOT call this — a session switch must never move where you land tomorrow. */
export async function setDashboardFocus(userId: string, focus: 'trainer' | 'business'): Promise<void> {
  const { error } = await supabase.rpc('set_dashboard_focus', { p_user_id: userId, p_focus: focus });
  if (error) throw error;
}
