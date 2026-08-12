import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { ReviewBanner } from './ReviewBanner';
import ContactsPageRetired from '../ContactsPage';
import IntakePageRetired from '../IntakePage';
import { ContactDossierModal } from '../../../../components/app/ContactDossierModal';
import { ContactForm } from '../../../../components/ops/contacts/ContactForm';

/**
 * REVIEW SECTION — the four mounts.
 *
 * These are the only implementations in DUPECENSUS's manifest that could not be
 * reached at all: two pages retired behind a boolean, and two components that
 * take props rather than URL params. Each is mounted here UNMODIFIED, behind
 * the review banner.
 *
 * ⚠ NO RETIREMENT CONSTANT WAS FLIPPED. `CONTACTS_PAGE_RETIRED` and
 * `INTAKE_PAGE_RETIRED` are both still `true`, so /app/ops/contacts and
 * /app/ops/intake still redirect for every user exactly as they did. Flipping
 * either would have put a retired page back into the live app for everyone —
 * mounting the component at a review-only route puts it in front of the owner
 * instead, which is the whole difference.
 *
 * On acceptance: delete the entry in src/lib/reviewSection.ts, delete the route
 * in App.tsx, delete the component here.
 */

/** DUPECENSUS People slot B — the 2026-07-01 ContactDirectory, retired 2026-08-10. */
export function ReviewContactsPage() {
  return (
    <div>
      <Helmet><title>Review · Contacts (retired)</title></Helmet>
      <ReviewBanner title="People slot B — the retired contact directory (ContactDirectory, mode &quot;contacts&quot;).">
        Still retired: <code>CONTACTS_PAGE_RETIRED</code> is untouched at <code>true</code>, so
        /app/ops/contacts still redirects to the Clients page for everyone. This route mounts the
        component so it can be compared against People A; it does not put the page back.
      </ReviewBanner>
      <ContactsPageRetired />
    </div>
  );
}

/** DUPECENSUS Inbound slot B — the 2026-07-01 flat queue, retired 2026-08-12. */
export function ReviewIntakePage() {
  return (
    <div>
      <Helmet><title>Review · Inbound queue (retired)</title></Helmet>
      <ReviewBanner title="Inbound slot B — the retired flat intake queue (IntakePage).">
        Still retired: <code>INTAKE_PAGE_RETIRED</code> is untouched at <code>true</code>, so
        /app/ops/intake still redirects to the dashboard and carries its <code>?request=</code>
        param through. This route mounts the component only.
      </ReviewBanner>
      <IntakePageRetired />
    </div>
  );
}

/** A real production contact, so the two editors are compared on one record
 *  rather than on a fixture. Sarah Morgan — the most-populated contact that is
 *  NOT Mary Richardson, who is D8's live acceptance case and is left alone.
 *  `?contact=<id>` overrides it for a different comparison. */
const REVIEW_CONTACT_ID = 'b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6';

/** DUPECENSUS Contact editor slot A — ContactDossierModal, 30 fields.
 *  It is a fixed-inset overlay, so it cannot render *under* a banner: the
 *  banner is the page, and the editor opens over it on a click. */
export function ReviewContactDossier() {
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const contactId = params.get('contact') ?? REVIEW_CONTACT_ID;
  return (
    <div>
      <Helmet><title>Review · Contact dossier</title></Helmet>
      <ReviewBanner title="Contact editor slot A — the dossier (ContactDossierModal): 30 fields in five groups, tabbed.">
        <strong>Its saves are real.</strong> This is the live editor mounted on a real production
        contact, not a copy — the comparison is only honest if it is the real thing. Look at it;
        do not type in it. Compare with slot B at /app/ops/review/contact-form.
      </ReviewBanner>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">
        <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
          Open the dossier editor
        </button>
      </div>
      {open && <ContactDossierModal contactId={contactId} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** DUPECENSUS Contact editor slot B — ContactForm, 4 fields. */
export function ReviewContactForm() {
  /* The refusal goes through the component's OWN error prop — that is the real
     parent contract (ContactsPage does the same with its save error), so the
     form is exercised exactly as it is in production rather than through a
     rejected promise nothing is listening for. */
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Helmet><title>Review · Contact form</title></Helmet>
      <ReviewBanner title="Contact editor slot B — the 2026-07-01 form (ContactForm): 4 fields, FormField primitives, inline validation.">
        <strong>Submit is inert here.</strong> The component is unmodified — this page passes it a
        handler that refuses, because its real create path does not set <code>contact_type</code>
        and would file a new person on the wrong page. That defect is DUPECENSUS&rsquo;s to fix, not
        this task&rsquo;s. Validation, layout and the cancel path are all real: try an empty first name.
      </ReviewBanner>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4 bg-white rounded-xl border border-green-800/10 p-5">
        <ContactForm
          onSubmit={async () => { setError('Review mount — nothing was saved. This form is here to be looked at, not to create a contact.'); }}
          onCancel={() => setError(null)}
          error={error}
        />
      </div>
    </div>
  );
}
