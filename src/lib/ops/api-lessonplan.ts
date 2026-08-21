/* TASK-LESSONPLAN — typed seams over the plan RPCs.
 *
 * THE LOOP, in one place so the shape is not re-derived on every screen:
 *
 *   save_lesson_plan(client)          Claire authors it. Every content change is
 *                                     a new VERSION; the prior one is retained.
 *   lesson_plans_for_day()            Her day, each Riding Lesson carrying the
 *                                     plan's focus and what comes next.
 *   record_lesson_progress(lesson)    What happened + how each objective went.
 *                                     Writes the form through save_booking_form
 *                                     (LESSONFORM's one writer) and ADVANCES the
 *                                     plan in the same call.
 *   → the next lesson reads the client's CURRENT plan, so it inherits the
 *     advance with nothing to schedule and nothing to keep in step.
 *
 * NAMING (D25): "booking" is internal taxonomy. Everything a person reads on
 * these surfaces says Riding Lesson. The RPC parameter names below are the
 * database's own and stay as they are.
 *
 * VISIBILITY: `coach_notes` is the staff-private lane and is present on the
 * staff types only. `my_lesson_plan()` never returns it — see the m2 migration.
 */
import { supabase } from '../supabase';

export type ObjectiveState = 'planned' | 'working' | 'achieved';

export const OBJECTIVE_STATE_LABEL: Record<ObjectiveState, string> = {
  planned: 'To come',
  working: 'Working on it',
  achieved: 'Achieved',
};

/** One thing the rider is working towards. `id` is assigned server-side and is
 *  what progress is recorded against — never the label, which Claire rewords. */
export interface PlanObjective {
  id: string;
  label: string;
  state: ObjectiveState;
  /** Rider-visible. The staff-private lane is the plan's coach_notes. */
  note: string | null;
}

/** An objective on the way in: the id is optional because a line Claire has
 *  just typed does not have one yet — the server assigns a stable one so later
 *  progress is recorded against the objective and not against its wording. */
export interface PlanObjectiveInput {
  id?: string;
  label: string;
  state?: ObjectiveState;
  note?: string | null;
}

/** The plan as any surface sees it. `coach_notes` is null for a rider. */
export interface LessonPlan {
  id: string;
  client_id: string;
  version: number;
  status: 'current' | 'superseded';
  focus: string | null;
  objectives: PlanObjective[];
  created_at: string;
  advanced_from_booking_id: string | null;
  coach_notes: string | null;
}

/** One retained version, for the history panel. */
export interface LessonPlanVersion {
  id: string;
  version: number;
  status: 'current' | 'superseded';
  focus: string | null;
  objectives: PlanObjective[];
  coach_notes: string | null;
  created_at: string;
  superseded_at: string | null;
  advanced_from_booking_id: string | null;
  /** When this version came out of a lesson, when that lesson was. */
  advanced_from_starts_at: string | null;
}

export interface LessonPlanLogEntry {
  at: string;
  code: 'created' | 'revised' | 'advanced' | 'scrubbed';
  label: string;
  detail: string | null;
}

/** Everything the plan editor needs: the live plan, its whole history, and the
 *  change log read back to a human (D19 — the four existing ledgers are written
 *  and never read; this one has a reader from the day it shipped). */
export interface ClientLessonPlan {
  client_id: string;
  client_name: string | null;
  plan: LessonPlan | null;
  next_up: PlanObjective | null;
  versions: LessonPlanVersion[];
  log: LessonPlanLogEntry[];
}

/** The plan one scheduled Riding Lesson carries. */
export interface LessonPlanForLesson {
  booking_id: string;
  client_id: string | null;
  starts_at: string;
  plan: LessonPlan | null;
  next_up: PlanObjective | null;
  /** True once progress has been recorded: the plan shown is the one this
   *  lesson was taught against and no longer moves. */
  pinned: boolean;
}

/** One row of Claire's day. */
export interface DayPlanRow {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  client_id: string | null;
  client_name: string | null;
  booking_status: string;
  service_type: string | null;
  plan_id: string | null;
  plan_version: number | null;
  focus: string | null;
  next_up: string | null;
  objectives: PlanObjective[];
  progress_recorded: boolean;
}

/** What Claire says happened to one objective. An entry with a `label` and no
 *  `id` is NEW work discovered during the lesson and is appended to the plan. */
export interface ObjectiveOutcome {
  id?: string;
  label?: string;
  state?: ObjectiveState;
  note?: string | null;
}

export interface RecordProgressResult {
  booking_id: string;
  plan_advanced: boolean;
  taught_against: LessonPlan | null;
  plan: LessonPlan | null;
}

/** One entry in the activity log — a lesson that has something on it. */
export interface ActivityEntry {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  client_id: string | null;
  client_name: string | null;
  horse_id: string | null;
  horse_name: string | null;
  service_type: string | null;
  booking_status: string;
  activities: string[];
  report: string | null;
  /** Staff lane. Always null when a rider is the caller — enforced server-side. */
  log_text: string | null;
  plan_version: number | null;
  plan_focus: string | null;
  media_count: number;
  form_status: 'open' | 'submitted' | 'retired' | null;
}

// ─── Authoring (§1) ──────────────────────────────────────────────────────────

/** The client's plan, its versions and its log. Staff only. */
export async function getClientLessonPlan(clientId: string): Promise<ClientLessonPlan> {
  const { data, error } = await supabase.rpc('client_lesson_plan', { p_client_id: clientId });
  if (error) throw error;
  return data as ClientLessonPlan;
}

/**
 * Write the plan. A content change makes a NEW version and retains the previous
 * one; a save that changes nothing makes no version at all, so the history keeps
 * meaning something.
 *
 * `coachNotes === undefined` leaves the private notes as they are; passing `''`
 * clears them. The distinction matters because the progress recorder does not
 * show that field and must not blank it.
 */
export async function saveLessonPlan(
  clientId: string,
  focus: string | null,
  objectives: PlanObjectiveInput[],
  coachNotes?: string | null,
): Promise<ClientLessonPlan> {
  const { data, error } = await supabase.rpc('save_lesson_plan', {
    p_client_id: clientId,
    p_focus: focus,
    p_objectives: objectives,
    p_coach_notes: coachNotes === undefined ? null : coachNotes,
  });
  if (error) throw error;
  return data as ClientLessonPlan;
}

/** Put an earlier version back — as a NEW version, so the history still shows
 *  every step including the one being undone (D19: reversible, not erasable). */
export async function restoreLessonPlanVersion(planId: string): Promise<ClientLessonPlan> {
  const { data, error } = await supabase.rpc('restore_lesson_plan_version', { p_plan_id: planId });
  if (error) throw error;
  return data as ClientLessonPlan;
}

/** One rider on the plans roster. */
export interface PlanRosterRow {
  client_id: string;
  client_name: string | null;
  plan_id: string | null;
  plan_version: number | null;
  focus: string | null;
  next_up: string | null;
  objective_count: number;
  achieved_count: number;
  plan_updated_at: string | null;
  last_lesson_at: string | null;
  next_lesson_at: string | null;
}

/** Every rider with a lesson on the books or a plan already — including the ones
 *  who have NO plan yet, which is the question this list is opened on. */
export async function lessonPlanRoster(): Promise<PlanRosterRow[]> {
  const { data, error } = await supabase.rpc('lesson_plan_roster');
  if (error) throw error;
  return (data ?? []) as PlanRosterRow[];
}

// ─── The day (§2) ────────────────────────────────────────────────────────────

/** Every Riding Lesson on one day with the plan it carries. `day` is a local
 *  'YYYY-MM-DD'; omit it for today in the stable's own timezone. */
export async function lessonPlansForDay(day?: string): Promise<DayPlanRow[]> {
  const { data, error } = await supabase.rpc('lesson_plans_for_day', { p_day: day ?? null });
  if (error) throw error;
  return (data ?? []) as DayPlanRow[];
}

/** The plan one lesson carries, and whether it is pinned. */
export async function getLessonPlanForBooking(bookingId: string): Promise<LessonPlanForLesson> {
  const { data, error } = await supabase.rpc('lesson_plan_for_booking', { p_booking_id: bookingId });
  if (error) throw error;
  return data as LessonPlanForLesson;
}

// ─── Recording progress (§3 + §4) ────────────────────────────────────────────

/**
 * The loop, in one call: save what happened AND advance the plan.
 *
 * `answers` are the activity form's own fields and go through
 * `save_booking_form` — this never writes them itself, so there is still exactly
 * one writer for a lesson's write-up (D18).
 *
 * `nextFocus === undefined` keeps the plan's current focus. Returns whether the
 * plan actually advanced, so the screen can say so rather than implying it.
 */
export async function recordLessonProgress(args: {
  bookingId: string;
  answers?: Record<string, unknown>;
  outcomes?: ObjectiveOutcome[];
  nextFocus?: string | null;
  coachNotes?: string | null;
  submit?: boolean;
}): Promise<RecordProgressResult> {
  const { data, error } = await supabase.rpc('record_lesson_progress', {
    p_booking_id: args.bookingId,
    p_answers: args.answers ?? {},
    p_outcomes: args.outcomes ?? [],
    p_next_focus: args.nextFocus === undefined ? null : args.nextFocus,
    p_coach_notes: args.coachNotes === undefined ? null : args.coachNotes,
    p_submit: args.submit ?? true,
  });
  if (error) throw error;
  return data as RecordProgressResult;
}

// ─── The rider's own view (§5) ───────────────────────────────────────────────

/** The rider's own plan. Null when they have none, or when the caller is not a
 *  client. Never carries the staff-private coach notes. */
export async function myLessonPlan(): Promise<(LessonPlan & { next_up: PlanObjective | null }) | null> {
  const { data, error } = await supabase.rpc('my_lesson_plan');
  if (error) throw error;
  return (data ?? null) as (LessonPlan & { next_up: PlanObjective | null }) | null;
}

/**
 * The activity log. Staff pass a client (or a horse) to scope it; a rider passes
 * nothing and gets their own. The staff-only instructor log comes back null for
 * a rider by construction, not by the caller remembering to drop it.
 */
export async function lessonActivity(opts?: {
  clientId?: string | null;
  horseId?: string | null;
  limit?: number;
}): Promise<ActivityEntry[]> {
  const { data, error } = await supabase.rpc('lesson_activity', {
    p_client_id: opts?.clientId ?? null,
    p_horse_id: opts?.horseId ?? null,
    p_limit: opts?.limit ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as ActivityEntry[];
}
