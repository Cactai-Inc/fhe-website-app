/**
 * Small pill for enum-ish statuses (DRAFT / EXECUTED / PAID / …). Tone is
 * derived from the status text via a keyword map, with an explicit `tone`
 * override. Pure presentational.
 */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusBadgeProps {
  status: string;
  tone?: BadgeTone;
  className?: string;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-green-800/10 text-green-800',
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
};

const SUCCESS = new Set(['EXECUTED', 'PAID', 'SETTLED', 'ACTIVE', 'COMPLETE', 'COMPLETED', 'APPROVED']);
const WARNING = new Set(['PENDING', 'DRAFT', 'AWAITING', 'PARTIAL', 'IN_REVIEW', 'SENT']);
const DANGER = new Set(['VOID', 'CANCELLED', 'CANCELED', 'FAILED', 'OVERDUE', 'REJECTED', 'EXPIRED']);

export function toneForStatus(status: string): BadgeTone {
  const key = status.trim().toUpperCase();
  if (SUCCESS.has(key)) return 'success';
  if (WARNING.has(key)) return 'warning';
  if (DANGER.has(key)) return 'danger';
  return 'neutral';
}

export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolved = tone ?? toneForStatus(status);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-sans font-medium tracking-wide ${TONE_CLASS[resolved]} ${className ?? ''}`}
    >
      {status}
    </span>
  );
}
