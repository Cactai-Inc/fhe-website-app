import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * PAGE CREATE BUTTON (PLUSPASS) — the one shared "+" control every add-capable
 * page renders near its own title/toolbar, now that the header's universal "+"
 * is admin/staff + desktop only (CardstockHeader). Icon + short label, quiet
 * secondary styling deliberately NOT tied to the cardstock/leather material
 * design (that's still an open A/B) so it's cheap to restyle later. Callers
 * gate visibility themselves on the viewer's actual capability — this
 * component only renders the control.
 */
const cls =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-green-800/15 ' +
  'bg-white text-green-800 text-sm font-medium hover:bg-green-50 hover:border-green-800/30 ' +
  'transition-colors focus-ring shrink-0';

type Props = {
  label: string;
  onClick?: () => void;
  to?: string;
};

export function PageCreateButton({ label, onClick, to }: Props) {
  const content = (
    <>
      <Plus size={15} aria-hidden="true" />
      {label}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
