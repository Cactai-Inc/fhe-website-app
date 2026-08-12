import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { REVIEW_NOTE } from '../../../../lib/reviewSection';

/**
 * REVIEW SECTION — the banner every review-only mount wears.
 *
 * Visual language deliberately copied from `ops/InstructorHomePreview` (dashed
 * gold, uppercase eyebrow, full-bleed note) rather than invented: that page
 * already established what "this is not a live page" looks like in this app,
 * and a second vocabulary for the same idea would be a duplicate of exactly the
 * kind this section exists to kill.
 *
 * The copy differs from that banner in one required way — it says what leaving
 * Review MEANS, because the owner's rule is that nav position is the status:
 * *"once its moved out of the review section its deemed done."*
 *
 * This wraps ONLY the four routes that had no route of their own. Every other
 * Review entry points at a real page and is shown unmodified and unbannered —
 * a page tidied on the way into review is a page the owner cannot judge.
 */
export function ReviewBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="note"
      aria-label="Review notice"
      data-testid="review-banner"
      className="border-2 border-dashed border-gold-400 bg-gold-50 rounded-xl px-4 py-3.5 mb-2 max-w-3xl mx-auto mt-6 sm:px-6"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold-800">
        <FlaskConical size={14} aria-hidden="true" />
        In review — not a live page
      </p>
      <p className="text-[13px] text-green-900 mt-1.5">{title}</p>
      <p className="text-[12px] text-green-800/80 mt-1.5">{children}</p>
      <p className="text-[12px] text-green-800/80 mt-1.5">{REVIEW_NOTE}</p>
    </div>
  );
}
