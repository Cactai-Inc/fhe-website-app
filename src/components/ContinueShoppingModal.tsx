/**
 * CONTINUE SHOPPING — CAREPATH §C3.
 *
 * Owner, 2026-08-16: *"clicking that opens a modal that asks them which category
 * they want to see and shows the three options (riding lessons, horse care
 * services, acquisition services, and a back button and x in the corner to close
 * the modal) clicking an option for one of the three categories takes them to
 * that page."*
 *
 * ⚠️ THE CART SURVIVES THE JUMP, AND THAT IS THE POINT. `CartContext`'s
 * `SET_FUNNEL` preserves items deliberately ("so cross-sell is real"), so
 * choosing a category changes the funnel and keeps every selection. This button
 * is what makes a MIXED cart the expected outcome rather than an accident.
 *
 * Built on the project's existing `Modal` (`components/ops/kit/Modal.tsx`) — the
 * focus trap, Escape handling, scroll lock and backdrop are already solved
 * there, and §C3 says explicitly not to write a second one. That kit component
 * carries no ops-specific dependency; it is a plain dialog.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Modal } from '../lib/ops';

/** The three categories, and where each one lives. */
const SHOP_CATEGORIES: { label: string; blurb: string; to: string }[] = [
  { label: 'Riding Lessons', blurb: 'Lessons on our horses or your own.', to: '/lessons' },
  { label: 'Horse Care Services', blurb: 'Clipping, exercise, turnout and training.', to: '/horse' },
  { label: 'Acquisition Services', blurb: 'Finding, evaluating and buying a horse.', to: '/acquisition' },
];

export interface ContinueShoppingModalProps {
  open: boolean;
  /** Both the ✕ and the Back button call this — §C3 requires both controls. */
  onClose: () => void;
}

export default function ContinueShoppingModal({ open, onClose }: ContinueShoppingModalProps) {
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="What would you like to see?">
      <div className="flex flex-col gap-4">
        <p className="body-text text-sm">
          Your selections stay in your inquiry — pick another category and add to them.
        </p>

        <div className="flex flex-col gap-2">
          {SHOP_CATEGORIES.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              onClick={onClose}
              data-testid={`continue-shopping-${c.to.slice(1)}`}
              className="group flex items-center justify-between gap-4 border border-green-800/15 hover:border-gold-400/60 px-5 py-4 transition-colors focus-ring"
            >
              <span className="min-w-0">
                <span className="block text-sm font-sans font-medium text-green-900">{c.label}</span>
                <span className="block text-xs text-muted mt-0.5">{c.blurb}</span>
              </span>
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="shrink-0 text-green-800/40 group-hover:text-green-800 transition-colors"
              />
            </Link>
          ))}
        </div>

        <div className="flex justify-start pt-1">
          <button type="button" className="btn-outline-gold text-sm" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </Modal>
  );
}
