/* Tasks — the single client surface for the unified task entity.
 *
 * A task is work that is NOT tied to a client purchase (client lessons/care are
 * `bookings`, with their own engine). A task can optionally be scheduled onto the
 * calendar (`scheduled_at`) and optionally block that timeframe
 * (`blocks_availability`). This one module is used everywhere tasks are shown,
 * authored, or edited — the calendar (task-typed items + the untimed "to do
 * today" list), the Day-view rundown, and the dashboard Tasks section all call
 * these functions; there is no second implementation.
 *
 * Backed by the `tasks` / `task_links` / `task_assignees` tables (org-scoped,
 * staff-only via RLS). Writes go through assertWrote so an RLS-blocked write
 * throws instead of reporting success. Category vocabulary is the owner-editable
 * lookup_options key 'task_category'.
 */
import { supabase } from '../supabase';
import { assertWrote } from '../writeGuard';

export type TaskStatus = 'new' | 'in_progress' | 'complete' | 'cancelled';
export type TaskLinkType =
  | 'order' | 'booking' | 'horse' | 'offering' | 'contract' | 'document' | 'client';
export type TaskAssigneeRole = 'participant' | 'observer';

export interface TaskLink { id: string; link_type: TaskLinkType; target_id: string }
export interface TaskAssignee { id: string; user_id: string; role: TaskAssigneeRole }

export interface Task {
  id: string;
  org_id: string;
  title: string;
  body: string | null;
  category: string | null;
  status: TaskStatus;
  created_by_user_id: string | null;
  created_at: string;
  due_at: string | null;
  /** Set → the task is on the calendar at this time. Null → untimed ("to do today"). */
  scheduled_at: string | null;
  scheduled_end: string | null;
  /** A timed task the person is busy during — marks the slot unavailable. */
  blocks_availability: boolean;
  completed_at: string | null;
  cancelled_at: string | null;
  deleted_at: string | null;
  image_file_id: string | null;
  links: TaskLink[];
  assignees: TaskAssignee[];
}

/** The row shape PostgREST returns with the two child selects embedded. */
interface TaskRow extends Omit<Task, 'links' | 'assignees'> {
  task_links: TaskLink[] | null;
  task_assignees: TaskAssignee[] | null;
}

const SELECT =
  '*, task_links(id, link_type, target_id), task_assignees(id, user_id, role)';

function toTask(r: TaskRow): Task {
  const { task_links, task_assignees, ...rest } = r;
  return { ...rest, links: task_links ?? [], assignees: task_assignees ?? [] };
}

/** List tasks for the org (RLS scopes to the caller's org + staff).
 *  - `statuses` filters by status (default: everything not deleted).
 *  - `from`/`to` (ISO) limit to tasks SCHEDULED in that window — used by the
 *    calendar/Day view. Omit both to get the full task list (the dashboard). */
export async function listTasks(opts: {
  statuses?: TaskStatus[];
  from?: string;
  to?: string;
  /** Include soft-deleted rows (History). Default false. */
  includeDeleted?: boolean;
} = {}): Promise<Task[]> {
  let q = supabase.from('tasks').select(SELECT);
  if (!opts.includeDeleted) q = q.is('deleted_at', null);
  if (opts.statuses?.length) q = q.in('status', opts.statuses);
  if (opts.from) q = q.gte('scheduled_at', opts.from);
  if (opts.to) q = q.lte('scheduled_at', opts.to);
  q = q.order('scheduled_at', { ascending: true, nullsFirst: false })
       .order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(toTask);
}

export interface TaskInput {
  title: string;
  body?: string | null;
  category?: string | null;
  due_at?: string | null;
  scheduled_at?: string | null;
  scheduled_end?: string | null;
  blocks_availability?: boolean;
  image_file_id?: string | null;
}

/** Create a task. Returns the created row (with empty links/assignees). */
export async function createTask(input: TaskInput): Promise<Task> {
  const { data: who } = await supabase.auth.getUser();
  const { data: org } = await supabase.rpc('current_org');
  const rows = assertWrote(
    await supabase.from('tasks').insert({
      org_id: org,
      title: input.title,
      body: input.body ?? null,
      category: input.category ?? null,
      due_at: input.due_at ?? null,
      scheduled_at: input.scheduled_at ?? null,
      scheduled_end: input.scheduled_end ?? null,
      blocks_availability: input.blocks_availability ?? false,
      image_file_id: input.image_file_id ?? null,
      created_by_user_id: who?.user?.id ?? null,
    }).select(SELECT),
    'The task',
  ) as TaskRow[];
  return toTask(rows[0]);
}

/** Patch any authorable field. Only the keys present are changed. */
export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task> {
  const rows = assertWrote(
    await supabase.from('tasks').update(patch).eq('id', id).select(SELECT),
    'The task',
  ) as TaskRow[];
  return toTask(rows[0]);
}

/** Move a task's status. Completing/cancelling stamps the terminal time so the
 *  row leaves the active board for History; reopening clears both stamps. */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const patch: Record<string, unknown> = {
    status,
    completed_at: status === 'complete' ? new Date().toISOString() : null,
    cancelled_at: status === 'cancelled' ? new Date().toISOString() : null,
  };
  const rows = assertWrote(
    await supabase.from('tasks').update(patch).eq('id', id).select(SELECT),
    'The task',
  ) as TaskRow[];
  return toTask(rows[0]);
}

/** Soft-delete → History (D32; a real hard delete is a separate staff action). */
export async function deleteTask(id: string): Promise<void> {
  assertWrote(
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString() })
      .eq('id', id).select('id'),
    'The task',
  );
}

/** Replace a task's links with exactly this set (delete-then-insert). */
export async function setTaskLinks(
  taskId: string, links: { link_type: TaskLinkType; target_id: string }[],
): Promise<void> {
  const del = await supabase.from('task_links').delete().eq('task_id', taskId);
  if (del.error) throw del.error;
  if (links.length === 0) return;
  const ins = await supabase.from('task_links')
    .insert(links.map((l) => ({ task_id: taskId, link_type: l.link_type, target_id: l.target_id })));
  if (ins.error) throw ins.error;
}

/** Replace a task's staff assignees with exactly this set. */
export async function setTaskAssignees(
  taskId: string, assignees: { user_id: string; role?: TaskAssigneeRole }[],
): Promise<void> {
  const del = await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (del.error) throw del.error;
  if (assignees.length === 0) return;
  const ins = await supabase.from('task_assignees')
    .insert(assignees.map((a) => ({ task_id: taskId, user_id: a.user_id, role: a.role ?? 'participant' })));
  if (ins.error) throw ins.error;
}

export interface TaskCategory { code: string; label: string }

/** The owner-editable task-category vocabulary (lookup_options 'task_category'). */
export async function listTaskCategories(): Promise<TaskCategory[]> {
  const { data, error } = await supabase
    .from('lookup_options')
    .select('code, display_name')
    .eq('lookup_key', 'task_category')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { code: string; display_name: string }[])
    .map((r) => ({ code: r.code, label: r.display_name }));
}
