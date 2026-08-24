/* /sign/guest, /sign/rider, /sign/horse, /sign/rider+horse — TASK C, rewired by
 * TASK ONBOARD §2 and §3.
 *
 * §2 — NAME AND PHONE ARE NOW CAPTURED. This page was deliberately email-only
 * ("no name capture … captured at first-login intake"). The owner overrode that:
 * "an input form that captures first and last name, phone, email." All four ride
 * the one provisioning spine, so the contact and the invitation carry the real
 * person from the first screen instead of an anonymous address.
 *
 * §3 — THE SCREEN RENDERS THE REAL SEND STATE. It used to print "Check your email"
 * the moment the request returned, whatever had actually happened to the send. Now
 * /api/sign-start reports the outcome and this renders it: sent, failed, or rate
 * limited. Below a successful send sits the spam note and the escape hatch — "I
 * never received it" — which raises an owner dashboard notice AND an owner email
 * carrying the transport's own error, and tells the person support was notified.
 *
 * PARTYEMAIL §2 — THE FULL ADDRESS IS COLLECTED, AND THE FORM ASKS PER PATH.
 * D22 §0 (owner, 2026-08-20, revised same day): "full name and email and phone
 * number are the minimum required set, if they have a contract they need to give
 * us an address."
 *
 * The address is shown on every path — the contact record wants it whoever is
 * filling this in — but it is REQUIRED only on `deal`, because that is the path
 * with a contract behind it and `.ADDRESS` is one of the five party tokens the
 * instrument prints. Somebody signing up for lessons is not made to produce a
 * street address before we will talk to them.
 *
 * The difference is `PATH_REQUIRES_ADDRESS` below — a constant map, the same idiom
 * PATH_SEGMENTS / PATH_CATEGORIES / WELCOME_COPY already use to vary this page by
 * path. It is deliberately NOT configuration: owner-ruled 2026-08-20, recorded in
 * D22 §0. `form_definitions` + /app/ops/admin/forms exists and could back this, and
 * the answer was no — do not propose it again.
 *
 * api/sign-start.ts writes the address through fill_claimant_details on both
 * branches, and enforces the same deal-only requirement server-side.
 *
 * Anti-enumeration is unchanged: the outcome describes OUR send, never whether the
 * address was already known to us.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, LifeBuoy } from 'lucide-react';
import { fetchPublicCatalog } from '../lib/publicCatalog';
import type { Offering, Segment } from '../lib/types';
import { useBrand } from '../contexts/BrandProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Deliberately loose: people write phones a dozen ways and we would rather have
 *  a real number formatted oddly than reject it. Ten digits somewhere is enough. */
const PHONE_DIGITS_RE = /\d/g;
/** US postal: 5 or 5+4 — the same rule CaptureInfoModal applies to a party's ZIP. */
const ZIP_RE = /^\d{5}(-\d{4})?$/;

/** `deal` (§1b) shares this page's form and send-state screen but not its meaning:
 *  the other four provision a new client, `deal` claims a contract that already
 *  exists and activates the account that makes it reachable. */
type SignPath = 'guest' | 'rider' | 'horse' | 'rider+horse' | 'deal';
const VALID_PATHS: SignPath[] = ['guest', 'rider', 'horse', 'rider+horse', 'deal'];

/** The four outcomes /api/sign-start reports. */
type SendStatus = 'sent' | 'send_failed' | 'rate_limited' | 'unavailable';

interface SendOutcome {
  status: SendStatus;
  attemptId: string | null;
}

const WELCOME_COPY: Record<SignPath, string> = {
  guest: "Welcome to French Heritage Equestrian — let's get you set up to visit the ranch.",
  rider: "Welcome to French Heritage Equestrian — let's get you set up to start taking riding lessons.",
  horse: "Welcome to French Heritage Equestrian — let's get you and your horse set up for care services.",
  'rider+horse': "Welcome to French Heritage Equestrian — let's get you and your horse set up for riding lessons.",
  deal: "Let's get you to your contract.",
};

/** Which catalog segments this path shows offerings from. `deal` shows none — the
 *  person is not shopping, they are here for a document that already exists. */
const PATH_SEGMENTS: Record<SignPath, Segment[]> = {
  guest: ['rider', 'horse'],
  rider: ['rider'],
  horse: ['horse'],
  'rider+horse': ['rider', 'horse'],
  deal: [],
};

/**
 * Which paths REQUIRE a full address (D22 §0, owner-revised 2026-08-20). Name,
 * email and phone are the minimum everywhere; the address is required only where a
 * contract will print it. It is still asked for on every path — optional there.
 */
const PATH_REQUIRES_ADDRESS: Record<SignPath, boolean> = {
  guest: false,
  rider: false,
  horse: false,
  'rider+horse': false,
  deal: true,
};

function normalizePath(raw: string | undefined): SignPath | null {
  const decoded = decodeURIComponent(raw ?? '').trim().toLowerCase();
  return (VALID_PATHS as string[]).includes(decoded) ? (decoded as SignPath) : null;
}

/* THE vCARD — MOBILE ONLY, DELIBERATELY.
   Owner, 2026-08-24: first "it downloads a file... that isnt very helpful", then,
   told why it cannot be made to actually write to a mail client: "well keep it
   mobile only then. device dependent is better than not at all."

   No browser lets a web page write to an address book — there is no API, on any
   platform, by design. A .vcf is the only mechanism that exists, and it behaves
   completely differently by device: on a phone it opens a contact card and offers
   to save it, which is exactly the promised action; on a desktop it lands in
   Downloads as a file most people have never seen. So it is offered where it
   works and withheld where it does not, and the copy-the-address control is there
   for everyone either way. */
function buildVcf(name: string, phone: string, email: string): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${name}`,
    `TEL;TYPE=CELL:${phone}`,
    `EMAIL;TYPE=INTERNET:${email}`,
    'END:VCARD',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** Coarse pointer = a touch device, where a .vcf opens the contact card rather
 *  than dropping a file into a folder. Read once on mount: it decides which
 *  control to offer, not a layout that must react to a resize. */
function useIsTouchDevice(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);
  return touch;
}

function DeliverabilityPanel({ brand }: { brand: ReturnType<typeof useBrand> }) {
  const [copied, setCopied] = useState(false);
  const isTouch = useIsTouchDevice();

  function downloadVcf() {
    const vcf = buildVcf(brand.shortName, brand.phoneDisplay, brand.email);
    const blob = new Blob([vcf], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brand.shortName.replace(/\s+/g, '-')}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copyEmail() {
    void navigator.clipboard.writeText(brand.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* the address is on screen either way */ });
  }

  return (
    <div className="border border-green-800/10 bg-white p-6">
      <h3 className="heading-card text-green-800 mb-3">Getting your email</h3>
      <ul className="text-sm text-green-900/80 space-y-1.5 mb-4 list-disc pl-5">
        <li>Use a Gmail address if you have one.</li>
        <li>First-time emails often land in spam — check there if you don&apos;t see it.</li>
        <li>Adding our address to your contacts keeps the next one out of spam.</li>
      </ul>
      <p className="text-sm text-green-900 font-medium mb-1">{brand.email}</p>
      <p className="text-sm text-green-900/80 mb-4">{brand.phoneDisplay}</p>
      <div className="flex flex-wrap gap-2">
        {/* On a phone this genuinely adds the contact. On a desktop it would only
            produce a file, so it is not offered there. */}
        {isTouch && (
          <button type="button" onClick={downloadVcf} className="btn-primary">
            Add us to your contacts
          </button>
        )}
        <button type="button" onClick={copyEmail} className="btn-outline-gold">
          {copied ? 'Copied' : 'Copy our email address'}
        </button>
      </div>
    </div>
  );
}

/**
 * §3 — the send-state screen. Renders WHAT HAPPENED, then what to do about it.
 * `sent` is the only branch that talks about checking an inbox; the others say
 * plainly that no email went out, because telling somebody to go look for a
 * message we never sent is how a signup dies quietly.
 */
function SendStateScreen({ outcome, email, isDeal }: { outcome: SendOutcome; email: string; isDeal: boolean }) {
  const [helping, setHelping] = useState(false);
  const [helped, setHelped] = useState<boolean | null>(null);

  async function askForHelp() {
    if (helping || helped) return;
    setHelping(true);
    try {
      const res = await fetch('/api/signup-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: outcome.attemptId }),
      });
      const body = (await res.json()) as { notified?: boolean };
      setHelped(Boolean(body.notified));
    } catch {
      setHelped(false);
    } finally {
      setHelping(false);
    }
  }

  const sent = outcome.status === 'sent';

  return (
    <div className="bg-white border border-green-800/10 p-8" role="status" aria-live="polite">
      {sent && (
        <>
          {/* §1b: the deal wording never confirms that a contract exists for this
              address — that would make a public form an oracle for who we have
              deals with. It says what we did, and the escape hatch below reaches
              a human for anyone it did not work for. */}
          <p className="flex items-start gap-2.5 text-green-800 font-medium mb-3">
            <CheckCircle2 size={20} className="shrink-0 mt-px" aria-hidden="true" />
            <span>
              {isDeal
                ? `If a contract is waiting on ${email}, we've just emailed you the link to it.`
                : `Your activation email is on its way to ${email}.`}
            </span>
          </p>
          <p className="body-text text-sm mb-3">
            {isDeal
              ? 'Go to your email, find the message from us, and click the link inside — it opens your contract and sets up your account at the same time.'
              : 'Go to your email, find the message from us, and click the link inside to activate your account.'}
          </p>
          <p className="body-text text-sm text-muted mb-6">
            If you don&apos;t see it, check your spam or junk folder — first-time emails often
            land there.
          </p>
        </>
      )}

      {outcome.status === 'send_failed' && (
        <>
          <p className="flex items-start gap-2.5 text-red-700 font-medium mb-3">
            <AlertTriangle size={20} className="shrink-0 mt-px" aria-hidden="true" />
            <span>We couldn&apos;t send your activation email.</span>
          </p>
          <p className="body-text text-sm mb-6">
            Your details are saved — nothing was lost. The email itself didn&apos;t go out, so
            there is no point checking your inbox. Let us know below and we&apos;ll sort it out
            for you.
          </p>
        </>
      )}

      {outcome.status === 'rate_limited' && (
        <>
          <p className="flex items-start gap-2.5 text-green-900 font-medium mb-3">
            <Clock size={20} className="shrink-0 mt-px" aria-hidden="true" />
            <span>We&apos;ve had a lot of sign-ups from this connection just now.</span>
          </p>
          <p className="body-text text-sm mb-6">
            Nothing was sent this time. Wait an hour and try again, or tell us below and
            we&apos;ll set you up by hand.
          </p>
        </>
      )}

      {outcome.status === 'unavailable' && (
        <>
          <p className="flex items-start gap-2.5 text-red-700 font-medium mb-3">
            <AlertTriangle size={20} className="shrink-0 mt-px" aria-hidden="true" />
            <span>Something on our side isn&apos;t working.</span>
          </p>
          <p className="body-text text-sm mb-6">
            No email was sent. Tell us below and someone will reach out to you directly.
          </p>
        </>
      )}

      <div className="border-t border-green-800/10 pt-5">
        {helped === null ? (
          <>
            <button
              type="button"
              onClick={() => void askForHelp()}
              disabled={helping || !outcome.attemptId}
              className="inline-flex items-center gap-2 text-sm text-green-800 underline hover:text-green-700 focus-ring disabled:opacity-60"
            >
              <LifeBuoy size={15} aria-hidden="true" />
              {helping
                ? 'Letting them know…'
                : sent
                  ? 'I never received it — tell support'
                  : 'Tell support I need help'}
            </button>
            {!outcome.attemptId && (
              <p className="text-xs text-muted mt-2">
                We have nothing to attach a support request to — please call or email us
                directly using the details below.
              </p>
            )}
          </>
        ) : helped ? (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 p-3">
            Customer support has been notified and will reach out to you. You don&apos;t need to
            do anything else.
          </p>
        ) : (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-3">
            We couldn&apos;t reach support automatically. Please call or email us directly — the
            details are just below.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SignStart() {
  const { path: rawPath } = useParams<{ path: string }>();
  const path = normalizePath(rawPath);
  const brand = useBrand();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [catalogState, setCatalogState] = useState<'loading' | 'error' | 'ready'>('loading');

  useEffect(() => {
    if (!path) return;
    setCatalogState('loading');
    Promise.all(PATH_SEGMENTS[path].map((s) => fetchPublicCatalog(s)))
      .then((groups) => {
        setOfferings(groups.flat().flatMap((g) => g.offerings));
        setCatalogState('ready');
      })
      .catch(() => {
        setOfferings([]);
        setCatalogState('error');
      });
  }, [path]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateV, setStateV] = useState('');
  const [zip, setZip] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const emailsMatch = emailValid && email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  const phoneValid = (phone.match(PHONE_DIGITS_RE) ?? []).length >= 10;
  const namesFilled = firstName.trim() !== '' && lastName.trim() !== '';
  /* Apt/suite stays optional everywhere — it is the one line a great many addresses
     do not have, and requiring it would teach people to type a dash. */
  const addressFilled = line1.trim() !== '' && city.trim() !== '' && stateV.trim() !== '' && zip.trim() !== '';
  const addressRequired = path ? PATH_REQUIRES_ADDRESS[path] : false;
  /* A partly-typed address is rejected on EVERY path. Optional means "leave it
     blank"; it does not mean a street with no city is acceptable, because
     compose_address would produce a fragment the contract then prints — verified:
     compose_address(NULL,'Apt 3',NULL,NULL,NULL) returns 'Apt 3'. Apt/suite is in
     this list for exactly that reason, even though it is never required. */
  const addressStarted = [line1, line2, city, stateV, zip].some((v) => v.trim() !== '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!path) return;
    if (!namesFilled) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!phoneValid) {
      setError('Please enter a phone number we can reach you on.');
      return;
    }
    if (!emailValid) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!emailsMatch) {
      setError('The two emails must match.');
      return;
    }
    if (addressRequired && !addressFilled) {
      setError('Please enter your full address — we need it for your contract.');
      return;
    }
    if (addressStarted && !addressFilled) {
      setError('Please complete the address, or leave all of it blank.');
      return;
    }
    if (addressStarted && !ZIP_RE.test(zip.trim())) {
      setError('Please enter a valid ZIP code (e.g. 92109).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/sign-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          confirmEmail: confirmEmail.trim(),
          addressLine1: line1.trim(),
          addressLine2: line2.trim(),
          city: city.trim(),
          state: stateV.trim(),
          postalCode: zip.trim(),
        }),
      });
      if (!res.ok) throw new Error('request failed');
      const body = (await res.json()) as { status?: SendStatus; attemptId?: string | null };
      setOutcome({
        status: body.status ?? 'unavailable',
        attemptId: body.attemptId ?? null,
      });
    } catch {
      // The request itself never arrived, so there is no attempt to escalate from.
      setOutcome({ status: 'unavailable', attemptId: null });
    } finally {
      setSubmitting(false);
    }
  }

  if (!path) {
    return (
      <section className="bg-cream pt-32 pb-20">
        <div className="container-site max-w-xl text-center">
          <p className="body-text mb-6">
            That link isn&apos;t quite right. Pick what brings you to us and we&apos;ll take it
            from there.
          </p>
          <Link to="/sign" className="btn-primary">Get started</Link>
        </div>
      </section>
    );
  }

  const catalogHeading = path === 'guest'
    ? "Services we offer once you're onboarded"
    : "What you'll be able to purchase";

  return (
    <>
      <section className="bg-cream pt-32 pb-10">
        <div className="container-site max-w-2xl text-center">
          <p className="eyebrow mb-4">Get started</p>
          <h1 className="heading-display text-green-800 text-[clamp(2rem,4.5vw,3.25rem)]">
            {WELCOME_COPY[path]}
          </h1>
          {!outcome && (
            <p className="body-text text-sm text-muted mt-4">
              Not the right one? <Link to="/sign" className="text-green-800 underline">See the other options</Link>.
            </p>
          )}
        </div>
      </section>

      {!outcome && path !== 'deal' && (
        <section className="bg-cream-50 py-10">
          <div className="container-site max-w-2xl">
            <h2 className="heading-card text-green-800 mb-4">{catalogHeading}</h2>
            {catalogState === 'loading' && (
              <p className="body-text text-sm text-muted">Loading…</p>
            )}
            {catalogState === 'error' && (
              <p className="body-text text-sm text-muted">
                Give us a call and we&apos;ll walk you through what we offer.
              </p>
            )}
            {catalogState === 'ready' && (
              offerings.length === 0 ? (
                <p className="body-text text-sm text-muted">Reach out and we&apos;ll get you set up.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {offerings.map((o) => (
                    <li
                      key={o.id}
                      className="text-sm text-green-900 border border-green-800/10 bg-white px-4 py-2.5"
                    >
                      {o.name}
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </section>
      )}

      <section className="bg-cream-50 pb-10">
        <div className="container-site max-w-md">
          {outcome ? (
            <SendStateScreen outcome={outcome} email={email.trim()} isDeal={path === 'deal'} />
          ) : (
            <form onSubmit={submit} className="bg-white border border-green-800/10 p-8" noValidate>
              {path === 'deal' && (
                <p className="body-text text-sm text-secondary mb-5">
                  Use the email address we have for you on the contract — that&apos;s how we
                  find it.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="form-label" htmlFor="sign-first">First name *</label>
                  <input
                    id="sign-first"
                    className="form-input"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="sign-last">Last name *</label>
                  <input
                    id="sign-last"
                    className="form-input"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="mb-5">
                {/* The number we call AND text. "Phone" read as a landline-era
                    question; the column is unchanged (INTAKE 2026-08-24). */}
                <label className="form-label" htmlFor="sign-phone">Mobile number *</label>
                <input
                  id="sign-phone"
                  type="tel"
                  className="form-input"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="mb-5">
                <label className="form-label" htmlFor="sign-email">Email *</label>
                <input
                  id="sign-email"
                  type="email"
                  className="form-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="mb-5">
                <label className="form-label" htmlFor="sign-confirm-email">Confirm email *</label>
                <input
                  id="sign-confirm-email"
                  type="email"
                  className={`form-input${
                    confirmEmail.trim() && !emailsMatch ? ' border-red-400' : ''}`}
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={Boolean(confirmEmail.trim()) && !emailsMatch}
                  aria-describedby="sign-confirm-email-note"
                />
                {/* Live, at the field, and only once they have typed something —
                    flagging "these don't match" against an empty box is noise. */}
                {confirmEmail.trim() && !emailsMatch && (
                  <p id="sign-confirm-email-note" role="alert" className="form-error mt-1 text-sm">
                    {email.trim() && !emailValid
                      ? 'That email address doesn’t look right yet.'
                      : 'These two email addresses don’t match.'}
                  </p>
                )}
                {confirmEmail.trim() && emailsMatch && (
                  <p id="sign-confirm-email-note" className="text-sm text-green-700 mt-1">
                    Addresses match.
                  </p>
                )}
              </div>
              {/* The fourth value (D22 §0). It lands on the contact record, and the
                  contract composes {{...ADDRESS}} from it — nothing types an address
                  into a contract a second time. Required on `deal` only: that is the
                  path with a contract behind it. The label carries the asterisk (or
                  the word "optional") so the form never asks for more than it means. */}
              {!addressRequired && (
                <p className="body-text text-sm text-muted mb-3">
                  Your address is optional — it saves us asking later.
                </p>
              )}
              <div className="mb-5">
                <label className="form-label" htmlFor="sign-address1">
                  Street address{addressRequired ? ' *' : ''}
                </label>
                <input
                  id="sign-address1"
                  className="form-input"
                  required={addressRequired}
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  autoComplete="address-line1"
                />
              </div>
              <div className="mb-5">
                <label className="form-label" htmlFor="sign-address2">
                  Apt / Suite <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="sign-address2"
                  className="form-input"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  autoComplete="address-line2"
                />
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 mb-5">
                <div>
                  <label className="form-label" htmlFor="sign-city">
                    City{addressRequired ? ' *' : ''}
                  </label>
                  <input
                    id="sign-city"
                    className="form-input"
                    required={addressRequired}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="sign-state">
                    State{addressRequired ? ' *' : ''}
                  </label>
                  <input
                    id="sign-state"
                    className="form-input w-16"
                    required={addressRequired}
                    maxLength={2}
                    value={stateV}
                    onChange={(e) => setStateV(e.target.value.toUpperCase())}
                    autoComplete="address-level1"
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="sign-zip">
                    ZIP{addressRequired ? ' *' : ''}
                  </label>
                  <input
                    id="sign-zip"
                    className="form-input w-24"
                    required={addressRequired}
                    inputMode="numeric"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    autoComplete="postal-code"
                    placeholder="92109"
                  />
                </div>
              </div>
              {error && (
                <p className="form-error mb-4" role="alert">{error}</p>
              )}
              <button
                type="submit"
                /* ⚠️ `emailsMatch` WAS COMPUTED AND NEVER USED HERE. It gated the
                   submit HANDLER (which rejects) and the server rejects too, so
                   nothing bad got through — but the button stayed enabled on a
                   mismatch, invited the click, and answered with a message
                   instead of pointing at the field. Owner, 2026-08-24: "i changed
                   one to a different email and it doesnt flag it... didnt refuse
                   to proceed." A confirm field that does not visibly confirm is
                   worse than no confirm field: it buys trust it has not earned. */
                disabled={submitting || !firstName || !lastName || !phone
                  || !emailsMatch
                  || (addressRequired && !addressFilled)}
                className="btn-primary w-full justify-center"
              >
                {submitting ? 'Sending…' : 'Continue'}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="bg-cream-50 pb-20">
        <div className="container-site max-w-md">
          <DeliverabilityPanel brand={brand} />
        </div>
      </section>
    </>
  );
}
