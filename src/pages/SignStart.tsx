/* /sign/guest, /sign/rider, /sign/horse, /sign/rider+horse — TASK C, rewired by
 * TASK ONBOARD §2/§3, PARTYEMAIL §2 and FIX1 §A, and cut back to one question by
 * TASK-SIGNDOOR.
 *
 * ⚠️ SIGNDOOR — THE FOUR FUNNEL DOORS ASK FOR THE EMAIL ADDRESS AND NOTHING ELSE.
 * Owner, 2026-09-01: *"the purpose of this page is purely to capture the initial
 * information for the setup of an account, it was supposed to only ask for their
 * email address. then it prints a notification to check their email account for
 * the link to click to setup their account, with the spam notice and the report
 * issue link at the bottom."*
 *
 * That is the whole of the funnel branch below: two inputs, one button, then
 * `SendStateScreen` — which is unchanged and is the second half of the sentence
 * he just said.
 *
 * ⚠️ THE FIELDS WERE NOT DELETED; THEY MOVED. Name, phone, address and the FIX1
 * minor question are asked on the FIRST PAGE AFTER AUTH — the `details` step of
 * src/pages/app/Onboarding.tsx, which had been asking most of them since it
 * shipped. The reason the minor question can safely go back there, after FIX1
 * deliberately moved it HERE, is that post-auth the account is PROVABLY the
 * guardian's: they clicked a link sent to an address only they can read. The
 * property FIX1 needed was never "ask early", it was "never assume"; a no-default
 * radio after a verified email keeps that, and asking a stranger for their
 * child's date of birth before we know their email works does not.
 *
 * ⚠️ `deal` IS DELIBERATELY UNCHANGED (SIGNDOOR §5.4). It shares this page but
 * not its meaning: the other four provision a NEW client, `deal` claims a
 * contract that ALREADY EXISTS, and the address it collects is printed on that
 * instrument (D22 §0 — ".ADDRESS" is one of the five party tokens). Its form,
 * its validation and its POST body are exactly what they were. Whether it should
 * also be slimmed is an owner question, flagged in the DSGN-2 handoff and
 * deliberately not answered here.
 *
 * PATH_REQUIRES_ADDRESS, PATH_ALLOWS_MINOR, MINOR_QUESTION and isUnder18 all
 * stood in this file and are gone from it. The address rule collapsed to "deal",
 * which is the only path that still renders the block; the minor rule now lives
 * in ONE place, `_sign_path_allows_minor(text)` in the database (20260901T1120),
 * consulted by update_my_onboarding_profile — so the browser still is not the
 * authority on which doors may carry a child.
 *
 * §3 — THE SCREEN RENDERS THE REAL SEND STATE, and still does. /api/sign-start
 * reports the outcome and SendStateScreen renders it: sent, failed, or rate
 * limited. Below a successful send sits the spam note and the escape hatch — "I
 * never received it" — which raises an owner dashboard notice AND an owner email
 * carrying the transport's own error.
 *
 * Anti-enumeration is unchanged: the outcome describes OUR send, never whether the
 * address was already known to us.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useFieldNormalizer, useFormDraft } from '../lib/formState';
import { AutoSaveIndicator } from '../components/ops/kit/AutoSaveIndicator';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, LifeBuoy } from 'lucide-react';
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
  /** FIX1 §B — the server applied the name from THIS submission to a record it
   *  already held. Only ever true for a genuine self-correction, and what it
   *  echoes is the visitor's own input, so showing it discloses nothing about
   *  whether the address was already known to us. */
  nameApplied: boolean;
  /** What was actually submitted, so the confirmation can name it. */
  submittedName: string;
}

const WELCOME_COPY: Record<SignPath, string> = {
  guest: "Welcome to French Heritage Equestrian — let's get you set up to visit the ranch.",
  rider: "Welcome to French Heritage Equestrian — let's get you set up to start taking riding lessons.",
  horse: "Welcome to French Heritage Equestrian — let's get you and your horse set up for care services.",
  'rider+horse': "Welcome to French Heritage Equestrian — let's get you and your horse set up for riding lessons.",
  deal: "Let's get you to your contract.",
};

/* PATH_REQUIRES_ADDRESS was a five-key map with one `true` in it. `deal` is the
   only path that still renders an address block at all, so the map became a
   lookup whose answer was always `isDeal`, and the rule it encoded — D22 §0,
   "if they have a contract they need to give us an address" — reads better as
   the sentence beside the block than as a constant nothing else consults. */

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
          {/* ── FIX1 §B — THE CORRECTION IS ACKNOWLEDGED ────────────────────
              Until 2026-08-31 a second submission with a corrected name was
              discarded in silence and the screen said the send had succeeded —
              which it had. The person who spotted their own mistake was told it
              worked when the part that mattered had not (AR7 F2). This says
              which name we will use. It names the string THEY just typed, never
              the one we held, so a public form still tells nobody whether we
              already knew this address. */}
          {outcome.nameApplied && outcome.submittedName !== '' && (
            <p className="text-sm text-green-800 bg-green-50 border border-green-200 p-3 mb-3">
              We&apos;ve updated your name to <strong>{outcome.submittedName}</strong>.
              That is the name that will appear on your paperwork.
            </p>
          )}
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
  /* ⚠️ SIGNDOOR — THE ONE BRANCH IN THIS COMPONENT. `deal` keeps the whole form;
     the four funnels are the email box. Every field below except `email` and
     `confirmEmail` is rendered, validated and sent ONLY when this is true. */
  const isDeal = path === 'deal';

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
  const normalize = useFieldNormalizer();

  /* ⚠️ TASK-FIX4 §6 — AND THIS IS THE CASE THAT DECIDED THE STORAGE SEAM. There
     is no `auth.uid()` here: a stranger filling in the front door has no session,
     so a server-side draft table has nobody to key on. Browser storage under the
     `anon` namespace is the only thing that can hold their work — and this is the
     longest form in the app, on the path where abandoning it costs a lead.

     ⚠️ `confirmEmail` is deliberately NOT persisted. It exists to catch a typo in
     `email`; restoring both from one store would restore the typo AND its
     confirmation, and the check would pass on a wrong address. */
  const draft = useFormDraft(
    `sign-start.${path}`,
    { firstName, lastName, phone, email, line1, line2, city, stateV, zip },
    (d) => {
      if (typeof d.firstName === 'string') setFirstName(d.firstName);
      if (typeof d.lastName === 'string') setLastName(d.lastName);
      if (typeof d.phone === 'string') setPhone(d.phone);
      if (typeof d.email === 'string') setEmail(d.email);
      if (typeof d.line1 === 'string') setLine1(d.line1);
      if (typeof d.line2 === 'string') setLine2(d.line2);
      if (typeof d.city === 'string') setCity(d.city);
      if (typeof d.stateV === 'string') setStateV(d.stateV);
      if (typeof d.zip === 'string') setZip(d.zip);
    },
  );

  function clearForm() {
    setFirstName(''); setLastName(''); setPhone(''); setEmail(''); setConfirmEmail('');
    setLine1(''); setLine2(''); setCity(''); setStateV(''); setZip('');
    setError(null);
    draft.clear();
  }

  const emailValid = EMAIL_RE.test(email.trim());
  const emailsMatch = emailValid && email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  const phoneValid = (phone.match(PHONE_DIGITS_RE) ?? []).length >= 10;
  const namesFilled = firstName.trim() !== '' && lastName.trim() !== '';
  /* Apt/suite stays optional everywhere — it is the one line a great many addresses
     do not have, and requiring it would teach people to type a dash. */
  const addressFilled = line1.trim() !== '' && city.trim() !== '' && stateV.trim() !== '' && zip.trim() !== '';
  // D22 §0 — only the path with a contract behind it prints an address.
  const addressRequired = isDeal;
  /* A partly-typed address is rejected on EVERY path. Optional means "leave it
     blank"; it does not mean a street with no city is acceptable, because
     compose_address would produce a fragment the contract then prints — verified:
     compose_address(NULL,'Apt 3',NULL,NULL,NULL) returns 'Apt 3'. Apt/suite is in
     this list for exactly that reason, even though it is never required. */
  const addressStarted = [line1, line2, city, stateV, zip].some((v) => v.trim() !== '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!path) return;
    /* ⚠️ SIGNDOOR — a funnel validates the email and stops. The name, phone and
       address checks below run on `deal` alone, and are word-for-word the ones
       that ran on every path before. */
    if (isDeal && !namesFilled) {
      setError('Please enter your first and last name.');
      return;
    }
    if (isDeal && !phoneValid) {
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
        /* ⚠️ SIGNDOOR — THREE KEYS FROM A FUNNEL, and the endpoint reads no more
           than three. `deal` sends what it always sent. */
        body: JSON.stringify(isDeal ? {
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
        } : {
          path,
          email: email.trim(),
          confirmEmail: confirmEmail.trim(),
        }),
      });
      if (!res.ok) throw new Error('request failed');
      // The door is through — the draft has done its job. ⚠️ Only on success:
      // a failed POST must leave everything they typed exactly where it is.
      draft.clear();
      const body = (await res.json()) as {
        status?: SendStatus; attemptId?: string | null; nameApplied?: boolean;
      };
      setOutcome({
        status: body.status ?? 'unavailable',
        attemptId: body.attemptId ?? null,
        nameApplied: Boolean(body.nameApplied),
        submittedName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
    } catch {
      // The request itself never arrived, so there is no attempt to escalate from.
      setOutcome({ status: 'unavailable', attemptId: null, nameApplied: false, submittedName: '' });
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
              {/* ⚠️ FIX1 §A's radio pair STOOD HERE, and the whole of it — the
                  question, the no-default rule, the "Your details" / "The
                  rider's details" split — is now on the first page after auth
                  (Onboarding.tsx, the `details` step). It is the same question
                  asked in the same shape; what changed is that by the time it is
                  asked, the person has proved the email address is theirs. */}
              {/* ⚠️ SIGNDOOR — NAME AND PHONE: `deal` ONLY. On a funnel these are
                  asked on the first page after auth. */}
              {isDeal && (<>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="form-label" htmlFor="sign-first">
                    First name *
                  </label>
                  {/* ⚠️ TASK-FIX4 §4 — normalised ON BLUR. This is the front door:
                      a stranger typing their own name, and the value that becomes
                      the contact record and then the contract's party tokens. */}
                  <input
                    id="sign-first"
                    className="form-input"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onBlur={normalize('sign-first', 'name', firstName, setFirstName)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="sign-last">
                    Last name *
                  </label>
                  <input
                    id="sign-last"
                    className="form-input"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={normalize('sign-last', 'name', lastName, setLastName)}
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
                  onBlur={normalize('sign-phone', 'phone', phone, setPhone)}
                  autoComplete="tel"
                />
              </div>
              </>)}
              <div className="mb-5">
                <label className="form-label" htmlFor="sign-email">Email *</label>
                <input
                  id="sign-email"
                  type="email"
                  className="form-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={normalize('sign-email', 'email', email, setEmail)}
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
                  into a contract a second time. ⚠️ SIGNDOOR: `deal` ONLY, and
                  required there, because that is the path with a contract behind
                  it. A funnel signup is asked for an address on the first page
                  after auth, where the paperwork that prints it is generated. */}
              {/* ⚠️ CR-100 — every box below normalises ON BLUR, in front of the
                  person, and the value they can then see is the value that reaches
                  the `/api/sign-start` payload. This is the front door: a
                  counterparty who is usually NOT signed in, typing the address that
                  becomes the contact record and then the contract's `…ADDRESS`
                  tokens. Nothing here validates that the address EXISTS — the owner
                  ruled that out explicitly. The ZIP submit-gate above (`ZIP_RE`,
                  `:442`) is unchanged; normalisation never rejects. */}
              {isDeal && (<>
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
                  onBlur={normalize('sign-address1', 'street', line1, setLine1)}
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
                  onBlur={normalize('sign-address2', 'street', line2, setLine2)}
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
                    onBlur={normalize('sign-city', 'city', city, setCity)}
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
                    /* 🔒 CR-100/CR-83 — this used to `.toUpperCase()` ON CHANGE, which
                       rewrote the box under the person's fingers. Correcting a value
                       while somebody is still typing is the silent correction
                       `normalize.ts` exists to prevent, so the shaping moved to the
                       blur below: while they type `ca` the box says `ca`.
                       `maxLength` and the placeholder shape the input without
                       rewriting it, so both stay. */
                    onChange={(e) => setStateV(e.target.value)}
                    onBlur={normalize('sign-state', 'region', stateV, setStateV)}
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
                    onBlur={normalize('sign-zip', 'postal', zip, setZip)}
                    autoComplete="postal-code"
                    placeholder="92109"
                  />
                </div>
              </div>
              </>)}

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
                /* ⚠️ SIGNDOOR — on a funnel there is exactly one thing that can
                   hold this button: the two addresses agreeing. The `deal`
                   conditions are unchanged and simply do not apply elsewhere. */
                disabled={submitting || !emailsMatch
                  || (isDeal && (!firstName || !lastName || !phone
                    || (addressRequired && !addressFilled)))}
                className="btn-primary w-full justify-center"
              >
                {submitting ? 'Sending…' : 'Continue'}
              </button>
              {/* ⚠️ TASK-FIX4 §3 — the indicator and Clear form. `Continue` is the
                  affirmative action and the only thing that submits; the draft
                  beside it is a promise that leaving does not cost them the form. */}
              <div className="flex items-center justify-between gap-3 mt-3">
                <button type="button" onClick={clearForm}
                  className="text-[12.5px] text-green-800/70 hover:text-green-900 underline underline-offset-2 focus-ring rounded">
                  Clear form
                </button>
                <AutoSaveIndicator status={draft.status} savedLabel="Saved on this device" />
              </div>
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
