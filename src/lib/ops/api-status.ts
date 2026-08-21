/**
 * Status model API (Phase 3) — the generic status_events log.
 *
 *   entity_status_log(type, id)  — the full timeline for one entity: TRUE
 *                                  statuses + sub-status/log entries, newest first.
 *   status_feed(filters)         — the org-wide aggregate for the admin panel.
 *
 * TRUE status (is_true_status) is shown prominently (a StatusBadge); sub-status/
 * log entries are shown ADJACENT but distinct (the StatusLog timeline). The DB
 * vocab (status_events_vocab) is the single source of the display label.
 */
import { supabase } from '../supabase';

export type StatusEntity = 'account' | 'document' | 'order' | 'offering';

export interface StatusLogEntry {
  status: string;
  display_name: string;
  is_true_status: boolean;
  is_terminal: boolean;
  detail: string | null;
  actor_user_id: string | null;
  created_at: string;
}

export interface StatusFeedEntry {
  entity_type: StatusEntity;
  entity_id: string;
  status: string;
  display_name: string;
  is_true_status: boolean;
  detail: string | null;
  actor_user_id: string | null;
  created_at: string;
}

/** The append-only timeline for a single entity (true + sub statuses). */
export async function entityStatusLog(entityType: StatusEntity, entityId: string): Promise<StatusLogEntry[]> {
  const { data, error } = await supabase.rpc('entity_status_log', {
    p_entity_type: entityType, p_entity_id: entityId,
  });
  if (error) throw error;
  return (data ?? []) as StatusLogEntry[];
}

/** The org-wide aggregate feed for the admin status panel. */
export async function statusFeed(opts?: {
  entityType?: StatusEntity | null; trueOnly?: boolean; limit?: number;
}): Promise<StatusFeedEntry[]> {
  const { data, error } = await supabase.rpc('status_feed', {
    p_entity_type: opts?.entityType ?? null,
    p_true_only: opts?.trueOnly ?? false,
    p_limit: opts?.limit ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as StatusFeedEntry[];
}

/** Vocab-code → StatusBadge tone. Mirrors the DB is_terminal/true-status intent
 *  so the true-status pill reads at a glance across every entity type. */
export function statusTone(code: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (code) {
    case 'signed': case 'paid': case 'complete': case 'completed': case 'active': case 'redeemed':
      return 'success';
    case 'void': case 'cancelled': case 'revoked': case 'expired': case 'redeemed_unsuccessful': case 'send_failed':
      return 'danger';
    case 'ready_to_sign': case 'submitted': case 'scheduled': case 'sent_for_review':
      return 'info';
    // A declared payment is a claim awaiting a human check — the same weight as every
    // other "somebody has to do something" state, and deliberately NOT 'success':
    // nothing has been received yet.
    case 'pending': case 'assigned': case 'in_progress': case 'invited': case 'superseded':
    case 'payment_pending_zelle': case 'payment_pending_cash':
      return 'warning';
    default:
      return 'neutral';
  }
}
