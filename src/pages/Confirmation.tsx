import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { usePropertyTerm } from '../contexts/BrandProvider';
import { withArticle } from '../lib/propertyTerm';
import { useDocumentTitle } from '../lib/hooks';
import { formatPrice } from '../lib/pricing';
import { readInquiryReceipt, type InquiryReceipt } from '../lib/inquiryReceipt';
import type { PriceUnit } from '../lib/pricing';

/**
 * WHAT HAPPENED, HONESTLY — CAREPATH §C6b.
 *
 * Owner: *"page 3 shows them the confirmation of the items they selected for
 * their order, the things they input and selected on their form, and a
 * confirmation of the email sent to us and them and that we try to respond
 * within a few hours using their preferred contact method."*
 *
 * ⚠️ IT ONLY CLAIMS WHAT ACTUALLY HAPPENED. The send status comes from what the
 * two email endpoints reported, not from the fact that we called them. Two real
 * leads were lost to a fire-and-forget send that could not report failure
 * (`orchestration/lessons/LESSONS.md`), and the failure path is written here as
 * carefully as the success path: it names the phone number instead of pretending.
 * "Not yet confirmed" is its own state and says so.
 */

const METHOD_PHRASE: Record<string, string> = {
  text: 'by text',
  call: 'with a call',
  email: 'by email',
};

/** "we'll text you" — the promise NAMES their chosen method (§C6b). */
const METHOD_PROMISE: Record<string, string> = {
  text: 'we will text you',
  call: 'we will call you',
  email: 'we will email you',
};

export default function Confirmation() {
  useDocumentTitle('Your Inquiry Is With Us');
  /* The three SendLine strings below say who the inquiry went TO, and that is the
     tenant, so it is the tenant's own word — never a hardcoded "barn" beside the
     mechanism that already holds it (U16 / TASK-FACILITYTERM, D18). Hoisted here
     rather than read inside SendLine: SendLine is a presentational component that
     takes finished sentences, and a hook must not sit in a conditional branch. */
  const propertyTerm = usePropertyTerm();
  const [receipt, setReceipt] = useState<InquiryReceipt | null>(() => readInquiryReceipt());

  // The two sends resolve after this screen has already mounted (the visitor is
  // never made to wait on a mail provider). Re-read the receipt until both have
  // reported, so the status line becomes true rather than staying vague.
  useEffect(() => {
    if (receipt && receipt.sends.staff !== null && receipt.sends.buyer !== null) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const next = readInquiryReceipt();
      setReceipt(next);
      if (tries >= 20 || (next && next.sends.staff !== null && next.sends.buyer !== null)) {
        window.clearInterval(id);
      }
    }, 600);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const method = receipt?.contactMethod ?? '';
  const methodPhrase = METHOD_PHRASE[method] || 'however you asked us to reach you';
  const methodPromise = METHOD_PROMISE[method] || 'we will be in touch however you asked us to';
  const answers = Object.entries(receipt?.answers ?? {});

  return (
    <div className="min-h-screen bg-cream px-6 pt-24 pb-20">
      <div className="max-w-2xl mx-auto">

        {/* Check icon */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-green-800 flex items-center justify-center">
            <Check size={28} className="text-gold-400" aria-hidden="true" />
          </div>
        </div>

        <div className="text-center">
          <p className="eyebrow mb-4">Your inquiry is with us</p>
          <h1 className="heading-display text-green-800 mb-6 text-[clamp(2rem,5vw,3rem)]">
            We Are So Glad<br />
            <em className="text-gold-ink not-italic">You Reached Out</em>
          </h1>

          <p className="body-text mb-10">
            It just landed with us. We try to answer within a few hours, and{' '}
            <span className="font-medium text-green-800">{methodPromise}</span> — the way you asked.
            Nothing is scheduled yet; we will agree the timing together.
          </p>
        </div>

        {receipt ? (
          <>
            {/* ── WHAT YOU ASKED FOR ─────────────────────────────────────── */}
            <section aria-labelledby="conf-items" className="bg-white border border-green-800/10 p-7 mb-5">
              <h2 id="conf-items" className="eyebrow mb-4">What you asked about</h2>
              {receipt.items.length === 0 ? (
                <p className="text-sm font-sans text-muted italic">No services were listed.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-green-800/[0.08]">
                  {receipt.items.map((it, i) => (
                    <li key={`${it.name}-${i}`} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="text-sm font-sans font-medium text-green-900">{it.name}</span>
                      {/* Price-on-inquiry items show NO number (§C6b). */}
                      <span className={`text-sm font-serif text-green-800${it.priceOnEnquiry ? ' italic' : ''}`}>
                        {it.priceOnEnquiry ? 'Price on inquiry' : formatPrice(it.price, it.unit as PriceUnit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── EVERY ANSWER THEY GAVE ─────────────────────────────────── */}
            {(answers.length > 0 || receipt.notes || receipt.availability) && (
              <section aria-labelledby="conf-answers" className="bg-white border border-green-800/10 p-7 mb-5">
                <h2 id="conf-answers" className="eyebrow mb-4">What you told us</h2>
                {answers.length > 0 && (
                  <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr] gap-x-5 gap-y-2 mb-4">
                    {answers.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-xs font-sans text-green-800/70 sm:pt-0.5">{k}</dt>
                        <dd className="text-sm text-green-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {receipt.availability && (
                  <div className="mb-4">
                    <p className="text-xs font-sans text-green-800/70 mb-1">Availability &amp; experience</p>
                    <p className="text-sm text-green-900 whitespace-pre-wrap">{receipt.availability}</p>
                  </div>
                )}
                {receipt.notes && (
                  <div>
                    <p className="text-xs font-sans text-green-800/70 mb-1">Your note</p>
                    <p className="text-sm text-green-900 whitespace-pre-wrap">{receipt.notes}</p>
                  </div>
                )}
              </section>
            )}

            {/* ── THE TWO EMAILS, REPORTED HONESTLY ──────────────────────── */}
            <section aria-labelledby="conf-emails" className="bg-white border border-green-800/10 p-7 mb-8">
              <h2 id="conf-emails" className="eyebrow mb-4">Emails</h2>
              <ul className="flex flex-col gap-2.5">
                <SendLine
                  state={receipt.sends.staff}
                  okText={`Your inquiry has been emailed to ${withArticle(propertyTerm)}.`}
                  failText={`We could not email ${withArticle(propertyTerm)} just now — but your inquiry is saved and already in our queue.`}
                  pendingText={`Sending your inquiry to ${withArticle(propertyTerm)}…`}
                />
                <SendLine
                  state={receipt.sends.buyer}
                  okText="A copy of everything you sent has been emailed to you."
                  failText="We could not email your copy just now. Nothing is lost — everything you sent is above."
                  pendingText="Sending your copy…"
                />
              </ul>
              {/* ⚠️ THE ACTIVATION LINK — OWNER, 2026-09-01. *"You can inform them on
                  the submission confirmation page that the account activation link
                  will be in the email we send them and that activation is optional
                  until their request is approved so they dont have to do it now if
                  they prefer to wait."*

                  ⚠️ SHOWN ONLY WHEN THERE WAS AN ORDER, because that is exactly the
                  condition `/api/request-activation` sends on — a bare enquiry gets
                  no invitation, so promising one here would be a lie. Same trigger,
                  stated once in each place.

                  ⚠️ AND IT PROMISES NOTHING ABOUT THE SEND ITSELF. The two lines
                  above report what actually happened; this describes what the email
                  CONTAINS, which is true whenever it arrives. */}
              {receipt.items.length > 0 && (
                <p className="text-sm text-green-900 mt-4">
                  That email also carries a link to <strong>activate your account</strong>, where
                  you can sign your paperwork and pick your times.{' '}
                  <span className="text-muted">
                    There is no rush — activation is optional until we approve your request, so
                    you can wait until you hear from us if you would rather.
                  </span>
                </p>
              )}
              {(receipt.sends.staff === false || receipt.sends.buyer === false) && (
                <p className="text-sm text-green-900 mt-4">
                  If you would rather not wait, call us directly at{' '}
                  <a href={BRAND.phoneHref} className="text-green-800 underline underline-offset-2 focus-ring">
                    {BRAND.phoneDisplay}
                  </a>.
                </p>
              )}
            </section>
          </>
        ) : (
          // No receipt in this session (a refresh into a new tab, or storage off).
          // Say only what is true regardless.
          <p className="body-text text-sm text-muted mb-10 text-center">
            Your inquiry is saved and one of us will be in touch {methodPhrase}.
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/" className="btn-primary">
            Return Home
            <ArrowRight size={16} />
          </Link>
          <Link to="/about" className="btn-outline-gold">
            Our Story
          </Link>
        </div>

        {/* Location note */}
        <div className="mt-14 pt-10 border-t border-green-800/10 text-center">
          <p className="text-xs font-sans text-muted leading-relaxed">
            French Heritage Equestrian · Carmel Creek Ranch · San Diego, CA<br />
            Fully licensed &amp; insured equestrian business
          </p>
        </div>

      </div>
    </div>
  );
}

/** One send's real state: sent, failed, or not yet confirmed. Never "assumed". */
function SendLine({
  state, okText, failText, pendingText,
}: { state: boolean | null; okText: string; failText: string; pendingText: string }) {
  if (state === true) {
    return (
      <li className="flex items-start gap-2.5 text-sm text-green-900">
        <Check size={16} className="text-green-700 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{okText}</span>
      </li>
    );
  }
  if (state === false) {
    return (
      <li className="flex items-start gap-2.5 text-sm text-green-900">
        <AlertTriangle size={16} className="text-gold-ink shrink-0 mt-0.5" aria-hidden="true" />
        <span>{failText}</span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted">
      <span aria-hidden="true" className="shrink-0 mt-0.5 w-4 text-center">·</span>
      <span>{pendingText}</span>
    </li>
  );
}
