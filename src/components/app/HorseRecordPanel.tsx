import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import { HorseRecord } from './HorseRecord';

/**
 * HORSE RECORD PANEL — opens <HorseRecord> in place, beside an open contract.
 *
 * Part 2 item 3. On a wide viewport (lg, 1024px — the app's own wide/narrow
 * switch, the one the contract subheader uses) it is a drawer pinned to the right:
 * the contract stays put on the left and the two scroll independently. Below that
 * it is the shared modal.
 *
 * ⚠️ CLOSING IS ALWAYS SAFE AND NEVER SUBMITS. The record autosaves every field on
 * blur, so there is nothing to commit on the way out and nothing to lose. Close is
 * a visibility action only — the contract stays exactly where it was. Consistent
 * with the one-dialog rule, the explicit control is the only way out: the drawer's
 * backdrop carries no close handler, matching Modal.
 */

/** The app's wide/narrow switch: lg = 1024px. */
function useIsWide(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

export function HorseRecordPanel({
  horseId, onClose, onContractRefetch,
}: {
  horseId: string;
  onClose: () => void;
  /** A record autosave landed — the open contract refetches its detail (item 4a). */
  onContractRefetch: () => void;
}) {
  const wide = useIsWide();

  // Lock the body scroll while the panel is open so the contract underneath does
  // not scroll with it; each pane owns its own scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!wide) {
    // Narrow: the shared modal, sized to the window (item 3 modal-width — scoped to
    // this feature's own modals; the app-wide sweep is a filed follow-up).
    return (
      <Modal open onClose={onClose} title="Horse record" size="window" bare>
        <div className="px-5 sm:px-6 py-5">
          <HorseRecord horseId={horseId} inPanel onContractRefetch={onContractRefetch} />
        </div>
      </Modal>
    );
  }

  // Wide: a right-side drawer. The backdrop is visual only (no close handler) — the
  // header's close button is the way out, matching the one-dialog rule.
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-green-900/40" aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Horse record"
        className="relative h-full w-[min(560px,92vw)] bg-cream shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-green-800/10 px-5 py-3.5 shrink-0 bg-white">
          <h2 className="font-serif text-lg text-green-900">Horse record</h2>
          <button type="button" aria-label="Close" title="Close" onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-green-800/60 hover:text-green-900 hover:bg-green-800/5 focus-ring shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
          <HorseRecord horseId={horseId} inPanel onContractRefetch={onContractRefetch} />
        </div>
      </div>
    </div>
  );
}

export default HorseRecordPanel;
