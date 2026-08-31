import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * THE ONE BACK CONTROL (CR-53 · CR-83 · CR-84 §3 · TASK-FIX4 §7).
 *
 * ⚠️ **A FLOW, NOT EVERY PAGE.** Owner: *"on pages, a back button for anything
 * that is a flow like the onboarding, orders, etc."* A leaf page reached from a
 * list does not need one; a multi-step sequence a person is part-way through does,
 * because there is otherwise no way to revise a step they have already passed.
 *
 * ⚠️ **AND ON ONBOARDING IT IS WHAT MAKES §4 SAFE.** `Onboarding.tsx` had eight
 * steps and two `Back` controls — one on the *done* screen pointing at the
 * dashboard, one inside the horse sub-flow — so **from `sign` there was no route
 * back to the field holding the name.** Normalising a person's name before they
 * sign, with no way to revise it, would be worse than not normalising it at all.
 * CR-83 attached this requirement itself: *"we need to allow them to go back … so
 * they can revise our normalization prior to signing."*
 *
 * **Placement is CR-53's:** *"a back button in the top left area of the page."*
 * `TASK-AR5` found **20+ hand-rolled back affordances and no shared component**;
 * this is the component, and new flows use it rather than growing a 21st.
 *
 * Two shapes, one look: pass `to` for a destination, or `onClick` for a step
 * inside a flow that has no URL of its own.
 */
export function BackControl({
  to,
  onClick,
  label = 'Back',
  className = '',
}: {
  /** A route. Use for leaving the flow. */
  to?: string;
  /** A step change inside the flow. Wins over `to` when both are given. */
  onClick?: () => void;
  label?: string;
  className?: string;
}) {
  const shared =
    'inline-flex items-center gap-1.5 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring rounded';
  const body = (
    <>
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shared} ${className}`}>
        {body}
      </button>
    );
  }
  if (to) {
    return (
      <Link to={to} className={`${shared} ${className}`}>
        {body}
      </Link>
    );
  }
  return null;
}
