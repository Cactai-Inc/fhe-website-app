import { useEffect, useState } from 'react';
import { Check, PenLine } from 'lucide-react';
import Seo from '../components/Seo';
import { fetchGeneralRelease, signGeneralRelease } from '../lib/ops/api-public';
import type { GeneralReleaseTemplate, SignGeneralReleaseResult } from '../lib/ops/api-public';

/**
 * /release — the visitor general-release kiosk.
 *
 * A visitor enters their name and contact, reads the RELEASE_GENERAL document
 * (template body, anon-readable), and signs by typing their name exactly.
 * Signing calls the sign_general_release RPC (20260702020000): the server
 * creates the real contact/engagement, merges the document through
 * generate_document, and records the sealed PARTICIPANT signature. The RPC
 * re-validates everything — the client-side match check only mirrors it.
 */
export default function Release() {
  const [template, setTemplate] = useState<GeneralReleaseTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [typedName, setTypedName] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignGeneralReleaseResult | null>(null);

  useEffect(() => {
    let active = true;
    fetchGeneralRelease()
      .then((t) => { if (active) setTemplate(t); })
      .catch(() => { if (active) setLoadError('We could not load the release document. Please see a staff member.'); })
      .finally(() => undefined);
    return () => { active = false; };
  }, []);

  const nameOk = fullName.trim().length >= 2;
  const contactOk = email.trim() !== '' || phone.trim() !== '';
  const typedMatches = typedName.trim() !== ''
    && typedName.trim().toLowerCase() === fullName.trim().toLowerCase();
  const canSign = nameOk && contactOk && typedMatches && !signing;

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    if (!canSign) return;
    setSigning(true);
    setError(null);
    try {
      const r = await signGeneralRelease({
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        typed_name: typedName.trim(),
      });
      setResult(r);
    } catch {
      setError('We could not record your signature. Please try again or see a staff member.');
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <Seo
        title="Visitor Release — French Heritage Equestrian"
        description="Sign the general visitor liability release before your visit."
        path="/release"
        noindex
      />
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="container-site max-w-3xl">
          <p className="eyebrow mb-2">Before you visit</p>
          <h1 className="heading-section text-green-800 mb-4">Visitor liability release.</h1>

          {result ? (
            <div className="bg-green-50 border border-green-200 p-8">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-2 inline-flex items-center gap-2">
                <Check size={20} aria-hidden="true" />
                Thank you — your release is on file.
              </h2>
              <p className="body-text text-sm mb-2">
                Signed by {fullName.trim()} · Document {result.document_code}
              </p>
              <p className="body-text text-sm text-secondary">
                {result.status === 'EXECUTED'
                  ? 'Your release is fully executed. Enjoy your visit.'
                  : 'Your signature is recorded; our team will countersign shortly. Enjoy your visit.'}
              </p>
            </div>
          ) : loadError ? (
            <p className="form-error" role="alert">{loadError}</p>
          ) : !template ? (
            <p className="body-text text-muted">Loading the release…</p>
          ) : (
            <form onSubmit={sign}>
              <p className="body-text text-secondary mb-8 max-w-2xl">
                Every visitor signs our general release once a year. Enter your details, read the
                document, then type your name to sign.
              </p>

              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="form-label" htmlFor="r-name">Full legal name *</label>
                    <input id="r-name" className="form-input" required value={fullName}
                      onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="r-email">Email</label>
                    <input id="r-email" type="email" className="form-input" value={email}
                      onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="r-phone">Phone</label>
                    <input id="r-phone" type="tel" className="form-input" value={phone}
                      onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </div>
                </div>
                {!contactOk && (
                  <p className="form-hint mt-3">Please provide an email address or a phone number.</p>
                )}
              </div>

              <div className="bg-white border border-green-800/10 mb-6">
                <h2 className="eyebrow px-8 pt-6 pb-2">{template.title}</h2>
                <div
                  className="px-8 pb-6 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-secondary leading-relaxed"
                  aria-label="Release document"
                >
                  {template.body}
                </div>
              </div>

              <div className="bg-white border border-green-800/10 p-8">
                <label className="form-label" htmlFor="r-signature">
                  <span className="inline-flex items-center gap-2">
                    <PenLine size={14} aria-hidden="true" />
                    Type your full name to sign *
                  </span>
                </label>
                <input id="r-signature" className="form-input font-serif italic" value={typedName}
                  onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />
                {typedName.trim() !== '' && !typedMatches && (
                  <p className="form-hint mt-2">Your typed signature must match your full legal name exactly.</p>
                )}
                {error && <p className="form-error mt-4" role="alert">{error}</p>}
                <button type="submit" disabled={!canSign} className="btn-primary mt-6 w-full justify-center">
                  {signing ? 'Recording your signature…' : 'Sign the release'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
