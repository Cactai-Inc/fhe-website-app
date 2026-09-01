/* /visit — COME AND SEE THE PLACE.
 *
 * OWNER, 2026-09-01: *"a guest who is filling this out is planning to visit the
 * ranch and they should be able to request a date and time for the visit, we
 * didnt add this to the website as a request option and we should, its a simple
 * form submission with a calendar and date picker with option to select a
 * timeframe from this set of options 9am-noon, noon-3pm, and 3pm-6pm. After
 * submitting the guest visit request form they get the email showing what they
 * submitted and telling them we will be in touch to discuss scheduling a visit
 * and provide the account activation link. the form needs to ask what they are
 * interested in"* — and, asked which options that last field takes:
 * *"we just need to know what category they go into of the three … except its not
 * buying or selling its buying or leasing a horse."*
 *
 * ⚠️ IT IS THE ONE PUBLIC INTAKE FORM (D18), in `visit` mode. Not a second form:
 * the same component, the same `submit_public_request`, the same staff alert and
 * the same buyer copy. All this page decides is that the category question is
 * asked as "what are you interested in", that the availability block is one date
 * and one window, and that the entry location marks it as a visit — which is the
 * row fact `/api/request-activation` reads to send the activation link even
 * though a visit carries no order.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PublicIntakeForm } from '../components/PublicIntakeForm';
import Seo from '../components/Seo';
import { useDocumentTitle } from '../lib/hooks';
import { usePropertyTerm } from '../contexts/BrandProvider';
import { withArticle } from '../lib/propertyTerm';

export default function Visit() {
  useDocumentTitle('Come and See Us');
  const propertyTerm = usePropertyTerm();
  const [sent, setSent] = useState(false);

  return (
    <>
      <Seo path="/visit" title="Come and See Us" description="Request a visit — pick a day and a time that suits you." />
      <section className="section-padding">
        <div className="mx-auto max-w-2xl px-6">
          {sent ? (
            <div className="bg-green-50 border border-green-200 p-8">
              <h1 className="heading-section text-green-800 mb-3 inline-flex items-center gap-2">
                <Check size={22} aria-hidden="true" /> Your visit request is with us.
              </h1>
              <p className="body-text text-sm mb-3">
                We&apos;ll be in touch to discuss scheduling your visit — nothing is booked yet.
                You&apos;ll also get an email with a copy of what you sent us.
              </p>
              {/* The same promise the order confirmation makes, for the same
                  reason: the link is real, and it is not urgent. */}
              <p className="body-text text-sm mb-6">
                That email carries a link to <strong>activate your account</strong>, where your
                paperwork lives. There&apos;s no rush — you can do it before you come, or leave
                it until we&apos;ve spoken.
              </p>
              <Link to="/" className="btn-outline-gold">Back to the site</Link>
            </div>
          ) : (
            <>
              <p className="eyebrow mb-2">Visit us</p>
              <h1 className="heading-section text-green-800 mb-3">
                Come and see {withArticle(propertyTerm)}.
              </h1>
              <p className="body-text text-sm mb-8">
                Pick a day and a window that suits you, tell us what you&apos;re interested in,
                and we&apos;ll be in touch to arrange it.
              </p>
              <PublicIntakeForm
                channel="booking"
                defaultCategory="lessons"
                entryLocation="guest_visit"
                visit
                submitLabel="Request a visit"
                onSubmitted={() => setSent(true)}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
}
