import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { PageLayout } from '../../../../components/app/PageLayout';
import { REVIEW_GROUPS, REVIEW_NOTE } from '../../../../lib/reviewSection';

/**
 * REVIEW SECTION — the index (/app/ops/review).
 *
 * The nav rows are how the owner gets to each page; this is the sheet that says
 * what he is looking at and in what order. It renders FROM `REVIEW_GROUPS`, so
 * adding one entry to that array adds it here too — nothing on this page is
 * written out by hand and nothing can fall out of step with the nav.
 *
 * It also carries the two things the section has to say about itself:
 * leaving Review means accepted, and here is how the next thread adds a page.
 */
export default function ReviewIndexPage() {
  return (
    <PageLayout
      name="Review"
      title="Review"
      description="Duplicates side by side, and new pages waiting to be accepted."
      width="wide"
    >
      <Helmet><title>Review</title></Helmet>

      <div
        role="note"
        data-testid="review-index-banner"
        className="border-2 border-dashed border-gold-400 bg-gold-50 rounded-xl px-4 py-3.5 mb-6 sm:px-6"
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold-800">
          <FlaskConical size={14} aria-hidden="true" />
          Temporary section
        </p>
        <p className="text-[13px] text-green-900 mt-1.5">{REVIEW_NOTE}</p>
        <p className="text-[12px] text-green-800/80 mt-1.5">
          Two things arrive here: every implementation of a <strong>duplicated</strong> page, so you
          can click A then B then C and decide which one to build from; and every <strong>new</strong>
          {' '}page a thread builds, so nothing ships without you having looked at it. Nothing here is
          a second copy of a live page — where a link already existed elsewhere in the nav, it was
          <strong> moved</strong> here, not duplicated.
        </p>
        <p className="text-[12px] text-green-800/80 mt-1.5">
          <strong>Nothing on these pages was changed to get it into Review.</strong> Defects you see
          are the pages as they actually are — that is the point.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {REVIEW_GROUPS.map((g, gi) => (
          <section key={g.key} className="bg-white rounded-xl border border-green-800/10 p-5">
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
              {gi + 1} of {REVIEW_GROUPS.length}
            </p>
            <h2 className="font-serif text-xl text-green-900 mt-0.5">{g.title}</h2>
            <p className="text-sm text-secondary mt-1">{g.question}</p>

            <div className="flex flex-col gap-3 mt-4">
              {g.entries.map((e) => (
                <div key={e.slot} className="border-t border-green-800/10 pt-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-cream-100 text-secondary border border-green-800/10">
                      {e.slot}
                    </span>
                    {e.incumbent && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-800/20">
                        in use
                      </span>
                    )}
                    {e.navRow === false ? (
                      <span className="text-sm text-green-900 font-medium">{e.label}</span>
                    ) : (
                      <Link to={e.to} className="text-sm text-green-800 font-medium underline focus-ring">
                        {e.label}
                      </Link>
                    )}
                    {e.to && <code className="text-[11px] text-muted">{e.to}</code>}
                  </div>
                  <p className="text-[13px] text-secondary mt-1.5">{e.what}</p>
                  {e.warn && (
                    <p className="flex items-start gap-1.5 text-[12px] text-gold-900 bg-gold-50 border border-gold-200 rounded-lg px-2.5 py-1.5 mt-1.5">
                      <AlertTriangle size={13} aria-hidden="true" className="shrink-0 mt-0.5" />
                      <span>{e.warn}</span>
                    </p>
                  )}
                  {e.origin && (
                    <p className="text-[12px] text-muted mt-1.5">
                      {e.origin.moved ? 'Moved here from' : 'Still also in'}: {e.origin.where}.
                      {e.origin.why && ` ${e.origin.why}`}
                      {e.origin.moved && ' On acceptance, put it back there (or wherever the re-bucketing decides).'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="bg-cream-100/60 rounded-xl border border-green-800/10 p-5 mt-6">
        <h2 className="font-serif text-lg text-green-900">For whoever builds the next page</h2>
        <p className="text-[13px] text-secondary mt-1.5">
          Adding a page to Review is one entry in <code>src/lib/reviewSection.ts</code> — the nav
          rows, this index, and the origin map all derive from that array. Accepting one is deleting
          the same entry and putting its nav row back where its origin line says. The file&rsquo;s
          header comment is the whole procedure.
        </p>
      </div>
    </PageLayout>
  );
}
