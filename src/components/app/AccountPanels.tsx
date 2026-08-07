import {
  Link as LinkIcon,
  BookmarkX,
  Newspaper, Tag, ExternalLink, ChevronRight,
} from 'lucide-react';
import {
  SEED_ENABLED, SEED_SAVED,
  type SeedSaved,
} from '../../lib/seed';

/**
 * ACCOUNT PANELS — Saved items, the one subject left here. (Gifts moved to
 * their own page; Documents moved to DocumentsContent.tsx, TASK-ACCOUNTSURFACE
 * §3 — the old DocumentsPanel/PaperViewer in this file were a WEAKER duplicate
 * of Documents.tsx, not just a smaller one, so they were retired rather than
 * kept as a second implementation. See that file's header for the reconciliation.)
 */

// Gifts moved to their own page (src/pages/app/Gifts.tsx), backed by the my_gifts
// RPC — the old placeholder GiftsPanel + SEED_GIFTS were removed.

// ── Saved items ────────────────────────────────────────────────
const SAVED_ICON: Record<SeedSaved['kind'], typeof Newspaper> = {
  article: Newspaper, listing: Tag, link: LinkIcon,
};

export function SavedPanel() {
  // I2 fix (found during nav-presence verification): this unconditionally
  // rendered SEED_SAVED regardless of SEED_ENABLED, showing the same 4 fake
  // items to every real account — the only seed section that skipped the
  // gate every other one (e.g. StableSection) applies. There is no real
  // saved/bookmark data model yet (tracked separately); until there is, this
  // always renders empty, matching my_nav_presence()'s saved=false.
  const items = SEED_ENABLED ? SEED_SAVED : [];
  if (items.length === 0) {
    return (
      <div className="mt-2.5 mb-1 p-8 bg-cream-100/60 border border-green-800/10 rounded-xl text-center">
        <BookmarkX size={26} className="text-muted mx-auto mb-2" />
        <p className="font-serif text-green-800">Nothing saved yet</p>
        <p className="text-[12px] text-muted mt-1">Bookmark articles, listings, and links to find them here.</p>
      </div>
    );
  }
  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      <div className="flex flex-col gap-2">
        {items.map((s) => {
          const Icon = SAVED_ICON[s.kind];
          return (
            <div key={s.id} className="flex items-center gap-3 bg-white border border-green-800/10 rounded-xl px-3.5 py-3">
              <span className="w-9 h-9 rounded-lg bg-cream-100 text-green-700 grid place-items-center shrink-0"><Icon size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-green-900 truncate">{s.title}</p>
                {s.sub && <p className="text-[11px] text-muted">{s.sub}</p>}
              </div>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-gold-800 shrink-0" aria-label="Open"><ExternalLink size={15} /></a>
              ) : (
                <ChevronRight size={16} className="text-muted shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
