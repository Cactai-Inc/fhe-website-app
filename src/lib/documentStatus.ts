/**
 * Document status display — the ONE mapping every surface uses so a signed
 * document never reads "editable" again.
 *
 * A document carries two DB columns:
 *  - `status`         legal lifecycle: DRAFT | AWAITING_SIGNATURE | EXECUTED | VOID
 *  - `workflow_state` editing/negotiation phase: editable | editing | in_review |
 *                     locked | executed | void
 *
 * `status` is authoritative for "is it done" (EXECUTED = signed/complete); a DB
 * guard trigger keeps `workflow_state` coherent when `status` is terminal. For
 * display we lead with the legal state and fall back to the negotiation phase
 * only while the document is still in play (not yet executed/void).
 */

export type DocDisplayTone = 'done' | 'active' | 'pending' | 'void';

export interface DocDisplay {
  label: string;
  tone: DocDisplayTone;
}

/** Human display for a document's status. `status` wins for terminal states;
 *  `workflow_state` refines the in-progress middle (negotiation phases). */
export function docDisplay(
  status: string | null | undefined,
  workflowState?: string | null,
): DocDisplay {
  const s = (status ?? '').toUpperCase();
  const w = (workflowState ?? '').toLowerCase();

  // Terminal legal states are authoritative — never show "editable" here.
  if (s === 'EXECUTED') return { label: 'Signed', tone: 'done' };
  if (s === 'VOID') return { label: 'Void', tone: 'void' };

  // Synthetic admin rows for a required template with no generated doc yet.
  if (s === 'NOT_STARTED') return { label: 'Not started', tone: 'pending' };

  // In-play: prefer the negotiation phase for a richer label.
  switch (w) {
    case 'in_review': return { label: 'In review', tone: 'active' };
    case 'editing':   return { label: 'Being edited', tone: 'active' };
    case 'locked':    return { label: 'Ready to sign', tone: 'active' };
    case 'editable':  break; // fall through to status-based label
    default:          break;
  }

  if (s === 'AWAITING_SIGNATURE') return { label: 'Awaiting signature', tone: 'active' };
  if (s === 'DRAFT') return { label: 'Draft', tone: 'pending' };

  // Fallback: whatever we were given, title-cased, never a raw "editable".
  const raw = status ?? workflowState ?? 'Unknown';
  return { label: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(), tone: 'pending' };
}

/** Convenience: just the label. */
export function docDisplayLabel(status: string | null | undefined, workflowState?: string | null): string {
  return docDisplay(status, workflowState).label;
}
