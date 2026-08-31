import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { SaveStatus } from '../../../lib/formState';
import { AutoSaveIndicator } from './AutoSaveIndicator';

/**
 * THE ONE DIALOG (TASK-FIX4 §3 · CR-84 §5).
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
 * | ⚠️ Close · X · Escape · backdrop | ✅ already         | ⚠️ **NEVER**       |
 * | Clear form                       | deliberately drops | ❌                 |
 *
 * Owner: *"no user would input data and click close and expect the form
 * submitted."* ⚠️ **`onClose` here means CLOSE. It must never commit.** A call
 * site that saves inside its own `onClose` has reintroduced the defect
 * `TASK-FIX4` removed from `ContactDossierModal`.
 *
 * ⚠️ **BACKDROP CLOSE IS DECIDED FROM THE LIVE DOM, NOT A PROP.** At the moment of
 * the click the panel is asked whether it currently holds a field. If it does, the
 * click is ignored — *"the main issue is that closing the modal accidentally from
 * clicking outside of it cleared the input."* If it does not, it closes, because
 * *"an information modal or empty one can close on click out."* No call site can
 * get this wrong by forgetting a flag, and a dialog whose fields appear on step 2
 * is protected on step 2 without anyone remembering to say so.
 *
 * ⚠️ **ESCAPE STILL CLOSES, DELIBERATELY.** It is a keystroke nobody presses by
 * accident and it is the a11y contract for `role="dialog"`; the accident the owner
 * reported was the backdrop. With auto-save behind it, closing loses nothing
 * either way. (Flagged in the TASK-FIX4 report rather than decided silently.)
 *
 * ⚠️ **THERE IS NO SAVE BUTTON AND NONE IS TO BE ADDED** (owner: *"no save button,
 * only a close button and a clear form button are needed since it saves"*). Pass
 * `onClear` on every input-bearing dialog and `saveStatus` wherever something is
 * being saved — *"we need to show auto-save so the user knows the inputs are
 * saved"*, and without the indicator auto-save is indistinguishable from data loss.
 */

/** Which fields make a dialog "input-bearing", and so backdrop-proof. */
const FIELDS = 'input:not([type="hidden"]), textarea, select';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export type ModalVariant = 'center' | 'sheet' | 'drawer';
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
  /**
   * Force backdrop-click close OFF even for a dialog with no fields — a
   * destructive confirmation, or mid-submit.
   */
  disableBackdropClose?: boolean;
  /**
   * ⚠️ Force backdrop-click close ON for a dialog that DOES hold fields. Rare and
   * deliberate: a read-only viewer whose only "field" is a search box, where
   * click-out is the expected gesture and there is nothing to lose.
   */
  allowBackdropClose?: boolean;
  /**
   * `center` — the default box. `sheet` — bottom sheet on mobile, centred box
   * above `sm`. `drawer` — a full-height panel against the right edge.
   */
  variant?: ModalVariant;
  size?: ModalSize;
  /** Renders the auto-save indicator in the footer bar. */
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

const OVERLAY: Record<ModalVariant, string> = {
  center: 'flex items-center justify-center p-4',
  sheet: 'flex items-end sm:items-center justify-center p-0 sm:p-4',
  drawer: 'flex justify-end',
};

const PANEL: Record<ModalVariant, string> = {
  center: 'w-full rounded-xl max-h-[90dvh]',
  sheet: 'w-full sm:rounded-2xl max-h-[92dvh]',
  drawer: 'w-full h-full sm:h-full',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  disableBackdropClose,
  allowBackdropClose,
  variant = 'center',
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
  /** ⚠️ A drag that STARTS inside the panel and ends on the backdrop — selecting
   *  text out of a field — must not read as a backdrop click. Tracked on mousedown
   *  because that is the event the close decision is made on. */
  const downOnBackdrop = useRef(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
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
    },
    [onClose],
  );

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

  /**
   * ⚠️ THE RULE, ASKED OF THE LIVE DOM. A dialog that holds a field right now does
   * not close on a backdrop click; an information or empty one does.
   */
  const backdropMayClose = useCallback(() => {
    if (disableBackdropClose) return false;
    if (allowBackdropClose) return true;
    return !dialogRef.current?.querySelector(FIELDS);
  }, [disableBackdropClose, allowBackdropClose]);

  if (!open) return null;

  const showFooterBar = Boolean(onClear || saveStatus || footer);

  return (
    <div
      className={`fixed inset-0 z-50 ${OVERLAY[variant]} bg-green-900/50`}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const fromBackdrop = e.target === e.currentTarget && downOnBackdrop.current;
        downOnBackdrop.current = false;
        if (fromBackdrop && backdropMayClose()) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`bg-white shadow-xl focus:outline-none flex flex-col overflow-hidden ${
          PANEL[variant]
        } ${variant === 'drawer' ? SIZE[size === 'full' ? 'lg' : size] : SIZE[size]} ${panelClassName}`}
        onKeyDown={handleKeyDown}
      >
        {/* ⚠️ THE HEADER ALWAYS RENDERS, because the CLOSE BUTTON is required on
            every modal — it used to appear only when a `title` was passed, so a
            titleless dialog had no visible way out at all. */}
        <div className="flex items-start justify-between gap-3 border-b border-green-800/10 px-5 sm:px-6 py-3.5 shrink-0">
          <div className="min-w-0">
            {title && <h2 className="font-serif text-lg sm:text-xl text-green-900 truncate">{title}</h2>}
            {subtitle && <p className="text-[11.5px] text-muted">{subtitle}</p>}
          </div>
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
            {saveStatus && <AutoSaveIndicator status={saveStatus} />}
            <div className="flex justify-end gap-3 flex-1 min-w-0">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
