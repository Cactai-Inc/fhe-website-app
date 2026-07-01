/**
 * OPS-ENG-CREATE — engagement-type selector for the create wizard.
 *
 * Pure presentational: renders one button per engagement type (purchase /
 * search / lease) and calls `onPick` with the chosen type. The parent
 * (CreateEngagementPage) owns which form mounts. No data call here.
 */
export type EngagementType = 'purchase' | 'search' | 'lease';

export interface EngagementTypeOption {
  type: EngagementType;
  title: string;
  description: string;
}

export const ENGAGEMENT_TYPES: EngagementTypeOption[] = [
  {
    type: 'purchase',
    title: 'Purchase',
    description: 'Buyer, seller, horse, amount + deposit → a PURCHASE engagement.',
  },
  {
    type: 'search',
    title: 'Search',
    description: 'Retained horse-finder search for a client (buy or sell side).',
  },
  {
    type: 'lease',
    title: 'Lease',
    description: 'Lease-in or lease-out for a client against a counterparty.',
  },
];

export interface EngagementTypePickerProps {
  /** Currently selected type (highlights the active card). */
  selected: EngagementType | null;
  /** Fired with the chosen type when a card is clicked. */
  onPick: (type: EngagementType) => void;
}

export function EngagementTypePicker({ selected, onPick }: EngagementTypePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 mb-6" role="group" aria-label="Engagement type">
      {ENGAGEMENT_TYPES.map((opt) => {
        const active = selected === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            data-testid={`eng-type-${opt.type}`}
            aria-pressed={active}
            onClick={() => onPick(opt.type)}
            className={`text-left rounded border px-4 py-3 transition ${
              active
                ? 'border-green-800 bg-green-800/5 ring-1 ring-green-800'
                : 'border-green-800/15 hover:border-green-800/40'
            }`}
          >
            <span className="block font-serif text-base text-green-900">{opt.title}</span>
            <span className="mt-1 block text-sm text-green-800/70">{opt.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export default EngagementTypePicker;
