import { useEffect, useState } from 'react';
import {
  X, Gift, Send, Clock, ArrowRightLeft, Link as LinkIcon, FileText, BookmarkX,
  Newspaper, Tag, ExternalLink, ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import {
  SEED_GIFTS, SEED_SAVED,
  type SeedGift, type SeedSaved, type SeedDocument,
} from '../../lib/seed';
import { listMySignableDocuments } from '../../lib/ops/api-client';

/**
 * ACCOUNT PANELS — Gifts, Saved items, and Documents-as-paper. Each is a complete,
 * styled inline panel the Account hub expands. Read paths use seed data (the [cc]
 * backend replaces SEED_* later); actions on Gifts are marked "⇢ WIRE" seams.
 */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-5 mb-2.5 first:mt-0">{children}</p>;
}

// ── Gifts ──────────────────────────────────────────────────────
const GIFT_STATUS: Record<SeedGift['status'], { label: string; cls: string }> = {
  delivered: { label: 'Delivered', cls: 'bg-green-50 text-green-800 border-green-200' },
  scheduled: { label: 'Scheduled', cls: 'bg-gold-50 text-gold-800 border-gold-200' },
  unclaimed: { label: 'Unclaimed', cls: 'bg-cream-200 text-secondary border-green-800/15' },
};

export function GiftsPanel() {
  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      <SectionLabel>Gifts you've given</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {SEED_GIFTS.map((g) => {
          const s = GIFT_STATUS[g.status];
          return (
            <div key={g.id} className="bg-white border border-green-800/10 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-lg bg-gold-50 text-gold-700 grid place-items-center shrink-0"><Gift size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-serif text-green-800 text-[16px] font-semibold leading-tight">{g.item}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-[12px] text-muted mt-0.5">
                    To {g.recipient}{g.recipientEmail !== '—' && <span className="text-green-800/50"> · {g.recipientEmail}</span>}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">{g.date} · {g.amount}</p>
                  {/* actions */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <GiftAction icon={Send} label="Resend" />
                    <GiftAction icon={Clock} label="Reschedule" />
                    <GiftAction icon={ArrowRightLeft} label="Transfer payment" />
                    {g.status === 'unclaimed' && <GiftAction icon={LinkIcon} label="Copy claim link" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="text-[12px] text-gold-800 font-semibold text-left px-1 mt-3">+ Send a new gift</button>
    </div>
  );
}

function GiftAction({ icon: Icon, label }: { icon: typeof Send; label: string }) {
  // ⇢ WIRE: connect to the gift action (resend / reschedule / transfer / claim link).
  return (
    <button type="button"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-green-800/15 text-[11.5px] text-secondary hover:bg-green-50 hover:border-green-800/25 focus-ring">
      <Icon size={13} /> {label}
    </button>
  );
}

// ── Saved items ────────────────────────────────────────────────
const SAVED_ICON: Record<SeedSaved['kind'], typeof Newspaper> = {
  article: Newspaper, listing: Tag, link: LinkIcon,
};

export function SavedPanel() {
  if (SEED_SAVED.length === 0) {
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
        {SEED_SAVED.map((s) => {
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

// ── Documents (render as paper) ────────────────────────────────
export function DocumentsPanel() {
  const [open, setOpen] = useState<SeedDocument | null>(null);
  const [rows, setRows] = useState<SeedDocument[] | null>(null);

  // REAL documents: the member's engagement documents with their actual merged
  // text (the placeholders the panel launched with are gone — owner-reported).
  useEffect(() => {
    listMySignableDocuments()
      .then((items) => setRows(items
        .sort((a, b) => Number(b.signed) - Number(a.signed))
        .map((it) => {
          const d = it.document;
          const when = d.effective_date ?? d.generated_at ?? d.created_at;
          const body = d.merged_body ?? 'This document is being prepared.';
          // paginate the real text into readable sheets
          const paras = body.split(/\n\n+/);
          const pages: string[] = [];
          let cur = '';
          for (const para of paras) {
            if (cur && (cur.length + para.length) > 2400) { pages.push(cur); cur = para; }
            else cur = cur ? cur + '\n\n' + para : para;
          }
          if (cur) pages.push(cur);
          return {
            id: d.id,
            title: d.title ?? 'Document',
            kind: d.status === 'EXECUTED' ? 'Signed' : 'Awaiting signature',
            signedOn: `${it.signed ? 'Signed' : 'Generated'} ${new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
            pages: pages.length ? pages : [body],
            body,
          };
        })))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      {rows === null && <p className="text-sm text-muted px-1 py-2">Loading your documents…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted px-1 py-2">No documents yet — agreements you sign will live here.</p>
      )}
      <div className="flex flex-col gap-2">
        {(rows ?? []).map((d) => (
          <button key={d.id} type="button" onClick={() => setOpen(d)}
            className="flex items-center gap-3 bg-white border border-green-800/10 rounded-xl px-3.5 py-3 text-left hover:border-green-800/20 focus-ring">
            <span className="w-9 h-9 rounded-lg bg-cream-100 text-green-700 grid place-items-center shrink-0"><FileText size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-green-900 truncate">{d.title}</p>
              <p className="text-[11px] text-muted">{d.kind} · {d.signedOn}</p>
            </div>
            <ChevronRight size={16} className="text-muted shrink-0" />
          </button>
        ))}
      </div>
      {open && <PaperViewer doc={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The document rendered as PAPER: a page with drop shadow, subtle edges, and page
 *  breaks. Slightly narrower than the sheet so scrolling reads as moving down a
 *  document. Overlay so it feels like opening the physical document. */
function PaperViewer({ doc, onClose }: { doc: SeedDocument; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const total = doc.pages.length;
  return (
    <div className="fixed inset-0 bg-green-950/50 backdrop-blur-[2px] z-[70] flex flex-col" onClick={onClose}>
      {/* top bar */}
      <div className="flex items-center justify-between px-4 h-14 bg-white/95 border-b border-green-800/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-serif text-green-800 text-[15px] font-semibold truncate">{doc.title}</p>
          <p className="text-[11px] text-muted">{doc.signedOn}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={async () => {
              const text = doc.body ?? doc.pages.join('\n\n');
              const { downloadDocumentPdf } = await import('../../lib/documentPdf');
              await downloadDocumentPdf(doc.title, text);
            }}
            className="inline-flex items-center gap-1.5 text-[12px] text-green-800 hover:text-green-700 px-2.5 py-1.5 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring"
          >
            <Download size={14} /> PDF
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-secondary hover:text-green-800 p-2 -mr-2"><X size={20} /></button>
        </div>
      </div>

      {/* paper scroll region */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-8" onClick={(e) => e.stopPropagation()}>
        <div className="max-w-[640px] mx-auto">
          {/* the sheet */}
          <div className="bg-white shadow-2xl shadow-green-950/30 rounded-[3px] mx-auto"
            style={{ width: 'min(100%, 600px)' }}>
            <div className="px-8 sm:px-12 py-10 sm:py-14">
              <p className="whitespace-pre-line font-serif text-[14.5px] leading-[1.85] text-green-950">
                {doc.pages[page]}
              </p>
            </div>
            {/* page-edge foot */}
            <div className="border-t border-dashed border-green-800/15 px-8 sm:px-12 py-3 flex items-center justify-between">
              <span className="text-[10px] tracking-wide uppercase text-muted">French Heritage Equestrian</span>
              <span className="text-[10px] text-muted">Page {page + 1} of {total}</span>
            </div>
          </div>

          {/* pager */}
          {total > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/90 border border-green-800/15 text-[12px] text-secondary disabled:opacity-40 focus-ring">
                <ChevronLeft size={15} /> Prev
              </button>
              <div className="flex gap-1.5">
                {doc.pages.map((_, i) => (
                  <button key={i} type="button" onClick={() => setPage(i)}
                    className={`h-1.5 rounded-full transition-all ${i === page ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} aria-label={`Page ${i + 1}`} />
                ))}
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(total - 1, p + 1))} disabled={page === total - 1}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/90 border border-green-800/15 text-[12px] text-secondary disabled:opacity-40 focus-ring">
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
