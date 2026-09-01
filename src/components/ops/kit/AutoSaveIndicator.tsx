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
 *
 * ⚠️ **WHERE IT SITS IS PART OF THE SPEC (TASK-MODAL2 D3 · CR-93).** Owner,
 * 2026-08-31: *"save state is always shown up next to the close button/icon as a
 * green checkmark with the word saved in green (light green), persistent until
 * inputs that arent saved are entered. shown when the state is true."* `ops/kit/Modal`
 * renders it in the header's right-hand cluster; `ContactDossierModal`, the one
 * deliberate non-adopter, does the same by hand. **A call site that places it
 * anywhere else has broken the rule, not chosen a layout.**
 *
 * ⚠️ **`text-green-500`, NOT `text-green-700`.** The owner asked for LIGHT green
 * and `green-700` (#1a4429) is the body-text green — it reads as ordinary prose,
 * not as an affirmative state. `green-500` (#2d7043) is the lightest step in this
 * palette that still clears WCAG AA at this size (5.9:1 on white; `green-400`
 * is 4.0:1 and fails). It is a declared theme colour, so the rule is compiled —
 * see the T1 grep in the TASK-MODAL2 report.
 *
 * ⚠️ **`Saved` IS THE WORD.** The owner named it. `savedLabel` survives only for
 * a caller that must say something narrower, and no caller currently does —
 * `ContactDossierModal` said *"Saved to the record"* until D3 and no longer does.
 */
export function AutoSaveIndicator({
  status,
  className = '',
  savedLabel = 'Saved',
}: {
  status: SaveStatus;
  className?: string;
  /** ⚠️ `Saved` is the owner's word (D3). Overriding it needs a reason. */
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
    <span className={`${base} text-green-500`} aria-live="polite">
      <Check size={12} aria-hidden />
      {savedLabel}
    </span>
  );
}
