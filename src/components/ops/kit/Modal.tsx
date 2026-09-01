import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { SaveStatus } from '../../../lib/formState';
import { AutoSaveIndicator } from './AutoSaveIndicator';

/**
 * THE ONE DIALOG (TASK-FIX4 §3 · CR-84 §5 · ⚠️ TASK-MODAL2 · CR-93).
 *
 * ⚠️ **THE MEASUREMENT IS THE FINDING.** 33 modals in this repo closed on a
 * backdrop click or Escape; 17 of those carried an `<input>`, `<textarea>` or
 * `<select>`; and **not one of the 17 used this component**, which has had a
 * `disableBackdropClose` flag and no adopters the whole time. Owner:
 * *"implement a global solution rather than updating each modal with the fix
 * directly."* **17 hand-rolled implementations of one component is the failure
 * this repo keeps repeating** — CR-37 measured the same shape from the other side.
 *
 * ══ THE RULES THIS COMPONENT ENFORCES SO NO CALL SITE HAS TO ═══════════════
 *
 * | Trigger                          | Persists the draft | Commits the record |
 * |----------------------------------|--------------------|--------------------|
 * | auto-save after input            | ✅ (`useFormDraft`)| ❌                 |
 * | Continue · Send · Save · Done    | ✅                 | ✅ **the ONLY one**|
 * | ⚠️ Close · X                     | ✅ already         | ⚠️ **NEVER**       |
 * | Clear form                       | deliberately drops | ❌                 |
 *
 * Owner: *"no user would input data and click close and expect the form
 * submitted."* ⚠️ **`onClose` here means CLOSE. It must never commit.** A call
 * site that saves inside its own `onClose` has reintroduced the defect
 * `TASK-FIX4` removed from `ContactDossierModal`.
 *
 * ══ ⚠️ D1 · A CONTROL IS THE ONLY WAY OUT. NO EXCEPTIONS ═══════════════════
 *
 * ⚠️ **NO MODAL CLOSES ON A BACKDROP CLICK. NO MODAL CLOSES ON ESCAPE.** A button
 * or a link is the only exit, whether the dialog holds a field or not.
 *
 * ⚠️ **THIS SUPERSEDES TASK-FIX4's LIVE-DOM FIELD TEST, WHICH THIS FILE CARRIED
 * FOR ONE DAY.** FIX4 asked the panel at click time whether it held a field and
 * let a field-less "information" dialog close on click-out. The owner ruled that
 * out on 2026-08-31 and the reasoning is the spec, because it settles a question
 * no component can answer from inside itself:
 *
 *   *"just make all modals only close on click of button or link, dont let them
 *   close on click-out since you cant determine which ones the user can reopen and
 *   which ones they cant."*
 *
 * A system-triggered notice is exactly as costly to dismiss by accident as a form
 * is — more so, because there may be no way back to it. `allowBackdropClose` and
 * `disableBackdropClose` are **gone**: with click-out removed there is nothing
 * left for either of them to express, and a prop that can only hold one value is
 * a prop a call site can only get wrong.
 *
 * 🔒 **THEREFORE THE HEADER, AND ITS CLOSE BUTTON, ALWAYS RENDER.** A modal with
 * no visible control is now a trap with no exit. Do not make the header
 * conditional on anything.
 *
 * ══ ⚠️ D2 · ONE SHAPE. THE DRAWER AND THE SHEET ARE ELIMINATED ═════════════
 *
 * **`variant` is gone.** It had three values — `center`, `sheet`, `drawer` — and
 * 12 call sites between the latter two. Owner, 2026-08-31: *"the side drawer i
 * specd as eliminated. center modal is the only version to use."* `size` still
 * decides the width; nothing decides the shape.
 *
 * ══ ⚠️ D3 · THE SAVE STATE SITS IN THE HEADER, BESIDE CLOSE ════════════════
 *
 * Owner: *"save state is always shown up next to the close button/icon as a green
 * checkmark with the word saved in green (light green)."* It used to render in
 * the footer bar, which on a long dialog is off-screen at the moment a person
 * wants the reassurance. It is now the header's right-hand cluster, so the
 * indicator and the only way out are the same glance.
 *
 * ⚠️ **THERE IS NO SAVE BUTTON AND NONE IS TO BE ADDED** (owner: *"no save button,
 * only a close button and a clear form button are needed since it saves"*). Pass
 * `onClear` on every input-bearing dialog and `saveStatus` wherever something is
 * being saved — *"we need to show auto-save so the user knows the inputs are
 * saved"*, and without the indicator auto-save is indistinguishable from data loss.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  /** ⚠️ CLOSE ONLY. Never commit from here — closing is not consent. */
  onClose: () => void;
  title?: ReactNode;
  /** Small line under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** ⚠️ Renders the auto-save indicator in the HEADER, beside Close (D3). */
  saveStatus?: SaveStatus;
  /**
   * ⚠️ Why the last save failed. Rendered above the body and the dialog STAYS
   * OPEN with the edits still in the boxes — the instinct kept from the shipped
   * dossier fix, moved here so every dialog inherits it.
   */
  error?: ReactNode;
  /** Renders `Clear form`. Required on every input form and modal. */
  onClear?: () => void;
  /** Overrides the `Clear form` label where the form is not called a form. */
  clearLabel?: string;
  /** Extra classes on the panel. */
  panelClassName?: string;
  /** Body padding off, for dialogs that lay out their own scroll regions. */
  bare?: boolean;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
  full: 'sm:max-w-5xl',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'lg',
  saveStatus,
  error,
  onClear,
  clearLabel = 'Clear form',
  panelClassName = '',
  bare,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  /**
   * ⚠️ TAB ONLY. Escape used to close here and no longer does (D1) — the focus
   * trap is all this handler is for now. Keeping the trap matters more than
   * before: with no click-out, focus leaving the panel would be a person stuck
   * tabbing through a page they cannot see.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? root)?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const showFooterBar = Boolean(onClear || footer);

  return (
    /* ⚠️ THE OVERLAY CARRIES NO CLICK HANDLER AT ALL (D1). It is not that the
       handler decides not to close — there is no handler to get the decision
       wrong, and no `mousedown` bookkeeping to keep a text-selection drag from
       reading as a dismissal, because nothing on this element dismisses. */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-green-900/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`bg-white shadow-xl focus:outline-none flex flex-col overflow-hidden w-full rounded-xl max-h-[90dvh] ${SIZE[size]} ${panelClassName}`}
        onKeyDown={handleKeyDown}
      >
        {/* ⚠️ THE HEADER ALWAYS RENDERS, because the CLOSE BUTTON is required on
            every modal — it used to appear only when a `title` was passed, so a
            titleless dialog had no visible way out at all. ⚠️ Since D1 removed
            click-out and Escape it is the ONLY way out, so this is now load
            bearing rather than tidy. */}
        <div className="flex items-start justify-between gap-3 border-b border-green-800/10 px-5 sm:px-6 py-3.5 shrink-0">
          <div className="min-w-0">
            {title && <h2 className="font-serif text-lg sm:text-xl text-green-900 truncate">{title}</h2>}
            {subtitle && <p className="text-[11.5px] text-muted">{subtitle}</p>}
          </div>
          {/* ⚠️ D3 — the save state sits beside the close icon, not in the footer. */}
          <div className="flex items-center gap-2.5 shrink-0">
            {saveStatus && <AutoSaveIndicator status={saveStatus} />}
            <button
              type="button"
              aria-label="Close"
              title="Close"
              className="p-1.5 -mr-1.5 rounded-lg text-green-800/60 hover:text-green-900 hover:bg-green-800/5 focus-ring shrink-0"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ⚠️ THE FAILURE STAYS ON SCREEN AND THE DIALOG STAYS OPEN. */}
        {error && (
          <p role="alert" className="form-error mx-5 sm:mx-6 mt-3 shrink-0">
            {error}
          </p>
        )}

        <div className={`${bare ? '' : 'px-5 sm:px-6 py-5'} flex-1 min-h-0 overflow-y-auto overscroll-contain`}>
          {children}
        </div>

        {showFooterBar && (
          <div className="flex items-center gap-3 border-t border-green-800/10 px-5 sm:px-6 py-3 shrink-0">
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="text-[12.5px] text-green-800/70 hover:text-green-900 underline underline-offset-2 focus-ring rounded shrink-0"
              >
                {clearLabel}
              </button>
            )}
            <div className="flex justify-end gap-3 flex-1 min-w-0">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
