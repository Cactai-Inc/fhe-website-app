/* /sign/guest, /sign/rider, /sign/horse, /sign/rider+horse — TASK C.
 * Public self-onboarding: no staff involved, no name capture (email-only,
 * matching the manual invite's "captured at first-login intake" convention).
 * One page component parameterized by the URL path segment. */
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicCatalog } from '../lib/publicCatalog';
import type { Offering, Segment } from '../lib/types';
import { useBrand } from '../contexts/BrandProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignPath = 'guest' | 'rider' | 'horse' | 'rider+horse';
const VALID_PATHS: SignPath[] = ['guest', 'rider', 'horse', 'rider+horse'];

const WELCOME_COPY: Record<SignPath, string> = {
  guest: "Welcome to French Heritage Equestrian — let's get you set up to visit the ranch.",
  rider: "Welcome to French Heritage Equestrian — let's get you set up to start taking riding lessons.",
  horse: "Welcome to French Heritage Equestrian — let's get you and your horse set up for care services.",
  'rider+horse': "Welcome to French Heritage Equestrian — let's get you and your horse set up for riding lessons.",
};

/** Which catalog segments this path shows offerings from. */
const PATH_SEGMENTS: Record<SignPath, Segment[]> = {
  guest: ['rider', 'horse'],
  rider: ['rider'],
  horse: ['horse'],
  'rider+horse': ['rider', 'horse'],
};

function normalizePath(raw: string | undefined): SignPath | null {
  const decoded = decodeURIComponent(raw ?? '').trim().toLowerCase();
  return (VALID_PATHS as string[]).includes(decoded) ? (decoded as SignPath) : null;
}

/** Build a minimal vCard 3.0 from the resolved brand identity. */
function buildVcf(name: string, phone: string, email: string): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${name}`,
    `TEL;TYPE=WORK,VOICE:${phone}`,
    `EMAIL;TYPE=INTERNET:${email}`,
    'END:VCARD',
  ];
  return lines.join('\r\n') + '\r\n';
}

function DeliverabilityPanel({ brand }: { brand: ReturnType<typeof useBrand> }) {
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

  return (
    <div className="border border-green-800/10 bg-white p-6">
      <h3 className="heading-card text-green-800 mb-3">Getting your email</h3>
      <ul className="text-sm text-green-900/80 space-y-1.5 mb-4 list-disc pl-5">
        <li>Use a Gmail address if you have one.</li>
        <li>First-time emails often land in spam — check there if you don&apos;t see it.</li>
      </ul>
      <p className="text-sm text-green-900/80 mb-1">
        Add us as a contact so calls, texts and emails reach you.
      </p>
      <p className="text-sm text-green-900 font-medium mb-4">
        {brand.email} · {brand.phoneDisplay}
      </p>
      <button type="button" onClick={downloadVcf} className="btn-outline-gold">
        Add us to your contacts
      </button>
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

  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const emailsMatch = emailValid && email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!path) return;
    if (!emailValid) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!emailsMatch) {
      setError('The two emails must match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/sign-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, email: email.trim(), confirmEmail: confirmEmail.trim() }),
      });
      if (!res.ok) throw new Error('request failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again, or email or call us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!path) {
    return (
      <section className="bg-cream pt-32 pb-20">
        <div className="container-site max-w-xl text-center">
          <p className="body-text">
            That link isn&apos;t quite right. Please double-check the URL, or reach out and
            we&apos;ll get you set up.
          </p>
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
        </div>
      </section>

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

      <section className="bg-cream-50 pb-10">
        <div className="container-site max-w-md">
          <form onSubmit={submit} className="bg-white border border-green-800/10 p-8" noValidate>
            {submitted ? (
              <p className="body-text text-green-800 font-medium" role="status">
                Check your email — we sent your activation link.
              </p>
            ) : (
              <>
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
                    className="form-input"
                    required
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                {error && (
                  <p className="form-error mb-4" role="alert">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting || !email || !confirmEmail}
                  className="btn-primary w-full justify-center"
                >
                  {submitting ? 'Sending…' : 'Send my activation email'}
                </button>
              </>
            )}
          </form>
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
