import { ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

/**
 * SELECTION BAR — the floating footer that appears once something is selected.
 *
 * Owner, 2026-08-16: "on any page where they select an item, we should have a
 * floating footer that appears with the checkout button so they dont have to go
 * looking for it."
 *
 * It does NOT introduce a second way forward. It calls the SAME handler the
 * page's own Continue button calls, so a funnel's step logic, its validation and
 * its final "Continue to Booking Request" all stay in one place — this is a
 * shortcut to the existing control, not a parallel path to checkout.
 *
 * Hidden when nothing is selected, so it never covers content the visitor is
 * still reading. `pb-[env(safe-area-inset-bottom)]` keeps it clear of the iOS
 * home indicator, and the page it sits on adds matching bottom padding so the
 * bar can never hide the last card.
 */
export default function SelectionBar({
  onContinue,
  label = 'Continue',
  disabled = false,
}: {
  onContinue: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const { itemCount } = useCart();
  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-green-800/10 bg-cream/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="container-site py-3 sm:py-4 flex items-center justify-between gap-4">
        <p className="text-sm font-sans text-green-900">
          <span className="font-medium">{itemCount}</span>{' '}
          {itemCount === 1 ? 'service selected' : 'services selected'}
        </p>
        <button type="button" onClick={onContinue} disabled={disabled} className="btn-primary">
          {label}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
