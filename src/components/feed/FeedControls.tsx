import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  FEED_VIEWS, SORT_OPTIONS, SEED_UNSEEN, SEED_ENABLED, type FeedView,
} from '../../lib/seed';
import { fetchUnseenCounts } from '../../lib/communityFeed';

/**
 * FEED CONTROLS — the two dependent dropdowns that drive the community feed.
 * View (single-select, with per-category unseen counts; All has no total) sits
 * beside Sort (options regenerate from the active View). Same control on desktop
 * and mobile — no pill row. Large, comfortable tap targets.
 */

function Dropdown({
  cue, value, options, badges, onPick,
}: {
  cue: string;
  value: string;
  options: { label: string; count?: number }[];
  badges?: boolean;
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
    <div className="relative flex-1 sm:flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto sm:min-w-[11rem] flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-green-800/10 rounded-lg text-sm text-green-800 font-medium font-sans hover:border-green-800/25 focus-ring"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="text-[10px] tracking-widest uppercase text-muted font-semibold shrink-0">{cue}</span>
          <span className="truncate">{value}</span>
        </span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1.5 min-w-full sm:min-w-[15rem] bg-white border border-green-800/10 rounded-xl shadow-lg p-1.5">
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
              {badges && o.count ? (
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
      .then((c) => {
        if (!active) return;
        // Live counts win; if live returns nothing and seed is on, show seed badges.
        const hasLive = Object.keys(c).length > 0;
        setCounts(hasLive || !SEED_ENABLED ? c : SEED_UNSEEN);
      })
      .catch(() => { if (active) setCounts(SEED_ENABLED ? SEED_UNSEEN : {}); });
    return () => { active = false; };
  }, [view]);

  const viewLabel = FEED_VIEWS.find((v) => v.key === view)?.label ?? 'All';
  const viewOptions = FEED_VIEWS.map((v) => ({
    label: v.label,
    count: v.key === 'all' ? undefined : counts[v.key],
  }));
  const sortOptions = (SORT_OPTIONS[view] ?? SORT_OPTIONS.all).map((label) => ({ label }));

  return (
    <div className="flex gap-2.5 mb-4">
      <Dropdown
        cue="View"
        value={viewLabel}
        options={viewOptions}
        badges
        onPick={(label) => {
          const next = FEED_VIEWS.find((v) => v.label === label);
          if (next) onView(next.key);
        }}
      />
      <Dropdown
        cue="Sort"
        value={sort}
        options={sortOptions}
        onPick={onSort}
      />
    </div>
  );
}
