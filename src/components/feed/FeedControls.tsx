import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FEED_VIEWS, SORT_OPTIONS, type FeedView } from '../../lib/seed';
import { fetchUnseenCounts } from '../../lib/communityFeed';

/**
 * FEED CONTROLS — Filter + Sort, two rows on every breakpoint.
 *   Desktop:  row 1 = FILTER buttons (with unseen badges) · row 2 = SORT buttons
 *   Mobile:   row 1 = FILTER dropdown                      · row 2 = SORT buttons
 * Sort options regenerate from the active filter; filter is single-select.
 */

function FilterDropdown({
  value, options, onPick,
}: {
  value: string;
  options: { label: string; count?: number }[];
  onPick: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-green-800/10 rounded-lg text-sm text-green-800 font-medium font-sans hover:border-green-800/25 focus-ring"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="text-[10px] tracking-widest uppercase text-muted font-semibold shrink-0">Filter</span>
          <span className="truncate">{value}</span>
        </span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 bg-white border border-green-800/10 rounded-xl shadow-lg p-1.5">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => { onPick(o.label); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-sans transition-colors ${
                o.label === value ? 'bg-green-50 text-green-800 font-semibold' : 'text-secondary hover:bg-cream-100'
              }`}
            >
              <span>{o.label}</span>
              {o.count ? (
                <span className="min-w-[1.25rem] h-5 px-1.5 grid place-items-center bg-gold-600 text-white text-[11px] font-semibold rounded-full">
                  {o.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PillRow({
  options, value, onPick, badges,
}: {
  options: { label: string; count?: number }[];
  value: string;
  onPick: (label: string) => void;
  badges?: boolean;
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
          {badges && o.count ? (
            <span className={`min-w-[1.15rem] h-[1.15rem] px-1 grid place-items-center text-[10.5px] font-semibold rounded-full ${
              o.label === value ? 'bg-white/25 text-white' : 'bg-gold-600 text-white'
            }`}>
              {o.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function FeedControls({
  view, sort, onView, onSort,
}: {
  view: FeedView;
  sort: string;
  onView: (v: FeedView) => void;
  onSort: (s: string) => void;
}) {
  const [counts, setCounts] = useState<Partial<Record<FeedView, number>>>({});

  useEffect(() => {
    let active = true;
    fetchUnseenCounts()
      .then((c) => { if (active) setCounts(c); })
      .catch(() => { if (active) setCounts({}); });
    return () => { active = false; };
  }, [view]);

  const viewLabel = FEED_VIEWS.find((v) => v.key === view)?.label ?? 'All';
  const filterOptions = FEED_VIEWS.map((v) => ({
    label: v.label,
    count: v.key === 'all' ? undefined : counts[v.key],
  }));
  const sortOptions = (SORT_OPTIONS[view] ?? SORT_OPTIONS.all).map((label) => ({ label }));
  const pickFilter = (label: string) => {
    const next = FEED_VIEWS.find((v) => v.label === label);
    if (next) onView(next.key);
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* row 1 — FILTER: buttons on desktop, dropdown on mobile */}
      <div className="hidden sm:block">
        <PillRow options={filterOptions} value={viewLabel} onPick={pickFilter} badges />
      </div>
      <div className="sm:hidden">
        <FilterDropdown value={viewLabel} options={filterOptions} onPick={pickFilter} />
      </div>
      {/* row 2 — SORT: buttons on every breakpoint */}
      <PillRow options={sortOptions} value={sort} onPick={onSort} />
    </div>
  );
}
