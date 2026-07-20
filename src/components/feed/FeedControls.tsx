import { SORT_OPTIONS, type FeedView } from '../../lib/seed';

/**
 * FEED CONTROLS — the SORT row for the community feed. Filtering is handled by the
 * nested "Community Feed" nav links (each sets ?filter=…), so no filter control
 * lives on the page anymore. Sort options regenerate from the active view.
 */

function PillRow({
  options, value, onPick,
}: {
  options: { label: string }[];
  value: string;
  onPick: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onPick(o.label)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[13px] font-sans transition-colors focus-ring ${
            o.label === value
              ? 'bg-green-800 text-white border-green-800 font-medium'
              : 'bg-white text-secondary border-green-800/15 hover:border-green-800/30'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FeedControls({
  view, sort, onSort,
}: {
  view: FeedView;
  sort: string;
  onSort: (s: string) => void;
}) {
  // Filtering is now driven entirely by the nested "Community Feed" nav links; the
  // page keeps only the SORT row, which regenerates from the active view.
  const sortOptions = (SORT_OPTIONS[view] ?? SORT_OPTIONS.all).map((label) => ({ label }));

  return (
    <div className="mb-4">
      <PillRow options={sortOptions} value={sort} onPick={onSort} />
    </div>
  );
}
