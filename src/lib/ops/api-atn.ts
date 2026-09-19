/* ATN — the dashboard Alerts / Notifications / Tasks awareness system.
 *
 * The three dashboard rows read from here. Alerts are a UNION of live-computed
 * conditions (unpaid orders, new leads, onboarding gaps) and stored alerts
 * (manual + task-attached), newest first (owner). Notifications are the unseen,
 * unmuted rows; rendering them marks them seen so they auto-clear next load. Tasks
 * live in api-tasks; this module adds their reminders, per-assignee alert config,
 * dismiss/snooze/mute, and the History query. All backed by staff-only RPCs and
 * RLS tables; writes go through assertWrote.
 */
import { supabase } from '../supabase';
import { assertWrote } from '../writeGuard';

export type AlertSeverity = 'priority' | 'standard';

export interface DashboardAlert {
  source: string;
  entity_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  severity: AlertSeverity;
  created_at: string;
  has_task: boolean;
}

/** Computed + stored alerts, newest first. Row hidden by the UI when empty. */
export async function dashboardAlerts(): Promise<DashboardAlert[]> {
  const { data, error } = await supabase.rpc('dashboard_alerts');
  if (error) throw error;
  return (data ?? []) as DashboardAlert[];
}

export interface DashboardNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  category: string | null;
  created_at: string;
}

/** Unseen, unmuted notifications, newest first. */
export async function dashboardNotifications(): Promise<DashboardNotification[]> {
  const { data, error } = await supabase.rpc('dashboard_notifications');
  if (error) throw error;
  return (data ?? []) as DashboardNotification[];
}

/** Rendered on screen → seen; they auto-clear on the next load. */
export async function markNotificationsSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('mark_notifications_seen', { p_ids: ids });
  if (error) throw error;
}

/** Dismiss until it recurs. Pass an alert id for a stored alert, or source+entity
 *  for a computed one. */
export async function dismissAlert(
  opts: { alertId?: string; source?: string; entityId?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc('dismiss_alert', {
    p_alert_id: opts.alertId ?? null,
    p_source: opts.source ?? null,
    p_entity_id: opts.entityId ?? null,
  });
  if (error) throw error;
}

/** Snooze off the dashboard until a time. Returns automatically after. */
export async function snoozeAlert(
  until: string, opts: { alertId?: string; source?: string; entityId?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc('snooze_alert', {
    p_until: until,
    p_alert_id: opts.alertId ?? null,
    p_source: opts.source ?? null,
    p_entity_id: opts.entityId ?? null,
  });
  if (error) throw error;
}

// ─── Notification category mutes ─────────────────────────────────────────────

export interface NotificationCategory { code: string; label: string; muted: boolean }

/** The mute list: every notification category with the caller's mute state. */
export async function listNotificationCategories(): Promise<NotificationCategory[]> {
  const [cats, mutes, who] = await Promise.all([
    supabase.from('lookup_options').select('code, display_name')
      .eq('lookup_key', 'notification_category').eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('notification_mutes').select('category'),
    supabase.auth.getUser(),
  ]);
  if (cats.error) throw cats.error;
  const muted = new Set(((mutes.data ?? []) as { category: string }[]).map((m) => m.category));
  void who;
  return ((cats.data ?? []) as { code: string; display_name: string }[])
    .map((c) => ({ code: c.code, label: c.display_name, muted: muted.has(c.code) }));
}

export async function muteNotificationCategory(category: string, muted: boolean): Promise<void> {
  const { error } = await supabase.rpc('mute_notification_category', {
    p_category: category, p_muted: muted,
  });
  if (error) throw error;
}

// ─── Task reminders (one-time or recurring, per party) ───────────────────────

export type ReminderOffset = 'after_create' | 'before_due';
export type ReminderUnit = 'days' | 'weeks' | 'months';

export interface TaskReminder {
  id: string;
  task_id: string;
  user_id: string | null;
  contact_id: string | null;
  offset_kind: ReminderOffset;
  value: number;
  unit: ReminderUnit;
  recurring: boolean;
  via_dashboard: boolean;
  via_modal: boolean;
  via_email: boolean;
  fired_at: string | null;
}

export async function listTaskReminders(taskId: string): Promise<TaskReminder[]> {
  const { data, error } = await supabase.from('task_reminders')
    .select('*').eq('task_id', taskId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskReminder[];
}

export type ReminderInput = Omit<TaskReminder, 'id' | 'task_id' | 'fired_at'>;

/** Replace a task's reminders with exactly this set. */
export async function setTaskReminders(taskId: string, reminders: ReminderInput[]): Promise<void> {
  const { data: org } = await supabase.rpc('current_org');
  const del = await supabase.from('task_reminders').delete().eq('task_id', taskId);
  if (del.error) throw del.error;
  if (reminders.length === 0) return;
  const ins = await supabase.from('task_reminders').insert(
    reminders.map((r) => ({ ...r, task_id: taskId, org_id: org })));
  if (ins.error) throw ins.error;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryItem {
  kind: 'task' | 'alert' | 'notification';
  id: string;
  title: string;
  at: string | null;
  detail: string | null;
}

/** Everything that has left the dashboard — terminal tasks, dismissed alerts,
 *  seen/dismissed notifications — newest first. Restore/hard-delete act per kind. */
export async function atnHistory(): Promise<HistoryItem[]> {
  const { data, error } = await supabase.rpc('atn_history');
  if (error) throw error;
  return (data ?? []) as HistoryItem[];
}

/** Restore a completed/cancelled/deleted task to the active board. */
export async function restoreTask(id: string): Promise<void> {
  assertWrote(
    await supabase.from('tasks')
      .update({ status: 'new', completed_at: null, cancelled_at: null, deleted_at: null })
      .eq('id', id).select('id'),
    'The task',
  );
}

/** The D32 scrub exception: a real hard delete, staff-confirmed. */
export async function hardDeleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
