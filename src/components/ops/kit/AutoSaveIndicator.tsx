import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { SaveStatus } from '../../../lib/formState';

/**
 * THE AUTO-SAVE INDICATOR (CR-84 · TASK-FIX4 §3).
 *
 * Owner: *"we need to show auto-save so the user knows the inputs are saved."*
 * ⚠️ **Without it, auto-save is indistinguishable from data loss.** A person who
 * types into a box, sees no Save button and no confirmation has every reason to
 * believe nothing was kept — which is the state the app was in before this task,
 * and is why the indicator is a requirement rather than a decoration.
 *
 * ⚠️ It reports what actually happened. `useFormDraft` returns `error` when browser
 * storage REFUSED the write (private mode, quota) rather than pretending — an
 * indicator that says "Saved" when nothing was saved is worse than none.
 */
export function AutoSaveIndicator({
  status,
  className = '',
  savedLabel = 'Saved',
}: {
  status: SaveStatus;
  className?: string;
  /** `Saved` for a draft; a call site committing a record may say `Saved to the record`. */
  savedLabel?: string;
}) {
  if (status === 'idle') return null;

  const base = `inline-flex items-center gap-1.5 text-[11.5px] shrink-0 ${className}`;

  if (status === 'saving') {
    return (
      <span className={`${base} text-muted`} aria-live="polite">
        <Loader2 size={12} className="animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className={`${base} text-red-700`} role="alert">
        <AlertCircle size={12} aria-hidden />
        Not saved — your input is still here
      </span>
    );
  }

  return (
    <span className={`${base} text-green-700`} aria-live="polite">
      <Check size={12} aria-hidden />
      {savedLabel}
    </span>
  );
}
