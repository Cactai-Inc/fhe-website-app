/* /visit — COME AND SEE THE PLACE.
 *
 * OWNER, 2026-09-01: *"we didnt add this to the website as a request option and
 * we should."*
 *
 * ⚠️ IT IS THE ONE PUBLIC INTAKE FORM (D18), opened on the `visit` menu answer.
 * Not a second form and not a mode: the same component, the same
 * `submit_public_request`, the same staff alert and the same buyer copy. All this
 * page does is preselect the menu, which then reveals the interest checkboxes on
 * its own.
 *
 * ⚠️ NO WHEN-PICKER. The owner cut it explicitly: *"lets avoid adding the options
 * for selecting when they want to visit when they select visit the ranch from the
 * menu."* Scheduling the visit is a conversation, for now.
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
                Tell us what you&apos;re interested in and we&apos;ll be in touch to arrange it.
              </p>
              <PublicIntakeForm
                channel="contact"
                defaultCategory="visit"
                entryLocation="visit_page"
                submitLabel="Send it our way"
                onSubmitted={() => setSent(true)}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
}
