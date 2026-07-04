import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, PenLine, Printer } from 'lucide-react';
import Seo from '../components/Seo';
import { BodyWithSignatures } from '../components/ops/documents/MergedBodyView';
import { fetchReleasePreview, signRelease } from '../lib/ops/api-public';
import type { ReleasePreview, ReleaseTemplateKey, SignReleaseResult } from '../lib/ops/api-public';

/**
 * /release — the public release kiosk.
 *
 * Owner directive 2026-07-03: the kiosk serves ONLY the general visitor
 * release (RELEASE_GENERAL — the non-transactional walk-in document). Every
 * other release is signed in the client's account (or via their invitation
 * link); a deep link to a retired kiosk slug renders a sign-in notice instead
 * of a form. Email is REQUIRED (kiosk attribution), matching the
 * sign_general_release RPC contract.
 *
 * Flow:
 *   info    — capture the signer's details (adult fields, or minor + guardian
 *             fields when the minor box is checked — visitors bring kids);
 *   rules   — the FACILITY_RULES gate: the merged rules document plus a
 *             required "I have read and agree" checkbox;
 *   sign    — the general release (merged preview, truncated BEFORE the
 *             signature area) with the captured details shown filled in; the
 *             signer types their name to sign AND checks the REQUIRED
 *             electronic-signing consent (release-signing audit — the RPC
 *             rejects without it);
 *   done    — the EXECUTED document (completed signature section, DOB for a
 *             minor, dated rules acknowledgment) rendered back, with a
 *             "Print or save this page" affordance (kiosk paper copy).
 *
 * Signing calls the sign_release RPC (20260702050000): the server creates the
 * real contact/engagement, merges the document through generate_document,
 * strips the inapplicable minor section, and records the sealed typed
 * signature. The RPC re-validates everything — the client-side checks only
 * mirror it.
 */

export const RELEASE_OPTIONS: {
  key: ReleaseTemplateKey;
  slug: string;
  label: string;
  description: string;
}[] = [
  {
    key: 'RELEASE_GENERAL',
    slug: 'general',
    label: 'General Visitor',
    description: 'For anyone visiting the property.',
  },
];

type Step = 'info' | 'rules' | 'sign';

/** Print / save the signed confirmation (DocumentViewerPage pattern): body
 *  gets `printing`, the print stylesheet (src/index.css @media print) shows
 *  ONLY the `.print-document` subtree, and window.print() opens the dialog. */
function printSignedRelease() {
  const body = window.document.body;
  const cleanup = () => body.classList.remove('printing');
  body.classList.add('printing');
  // `afterprint` covers browsers where print() returns before the dialog
  // closes; the synchronous cleanup covers those where it blocks.
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  cleanup();
}

export default function Release() {
  const { releaseKey } = useParams();
  // The kiosk signs ONLY the general visitor release. Any other deep-linked
  // slug (participant, horse-exercise, horse-care, …) is an in-account
  // document now — show the sign-in notice instead of a form.
  const blocked = releaseKey !== undefined
    && !RELEASE_OPTIONS.some((o) => o.slug === releaseKey);
  const selected: ReleaseTemplateKey | null = blocked ? null : 'RELEASE_GENERAL';

  const [step, setStep] = useState<Step>('info');
  const [isMinor, setIsMinor] = useState(false);

  // signer details (the adult, or the parent/guardian when isMinor).
  // First + last name replace the single full-name field (owner 2026-07-02);
  // the official/printed name is the trimmed "first last" concatenation.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [minorFirstName, setMinorFirstName] = useState('');
  const [minorLastName, setMinorLastName] = useState('');
  const [minorDob, setMinorDob] = useState('');
  const [relationship, setRelationship] = useState('');

  const [rules, setRules] = useState<ReleasePreview | null>(null);
  const [rulesOk, setRulesOk] = useState(false);
  const [preview, setPreview] = useState<ReleasePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [typedName, setTypedName] = useState('');
  // E-sign consent (release-signing audit): a REQUIRED checkbox — the server
  // rejects a kiosk signing without it.
  const [esignOk, setEsignOk] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignReleaseResult | null>(null);

  // Load the general release + the rules document up front (single-document kiosk).
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setPreview(null);
    setRules(null);
    setLoadError(null);
    Promise.all([fetchReleasePreview(selected), fetchReleasePreview('FACILITY_RULES')])
      .then(([p, r]) => { if (active) { setPreview(p); setRules(r); } })
      .catch(() => { if (active) setLoadError('We could not load the release documents. Please see a staff member.'); });
    return () => { active = false; };
  }, [selected]);

  const option = RELEASE_OPTIONS.find((o) => o.key === selected) ?? null;

  // The OFFICIAL name the server merges + the typed signature must match.
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const minorFullName = [minorFirstName.trim(), minorLastName.trim()].filter(Boolean).join(' ');

  const nameOk = firstName.trim() !== '' && fullName.length >= 2;
  // Email is REQUIRED at the kiosk (owner 2026-07-03: attribution).
  const emailOk = email.trim() !== '';
  const minorOk = !isMinor
    || (minorFirstName.trim() !== '' && minorFullName.length >= 2
        && minorDob !== '' && relationship.trim().length >= 2);
  const infoOk = nameOk && emailOk && minorOk;
  const typedMatches = typedName.trim() !== ''
    && typedName.trim().toLowerCase() === fullName.toLowerCase();
  const canSign = infoOk && typedMatches && rulesOk && esignOk && !signing;

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    if (!canSign || !selected) return;
    setSigning(true);
    setError(null);
    try {
      const r = await signRelease({
        template_key: selected,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        typed_name: typedName.trim(),
        is_minor: isMinor,
        minor_first_name: isMinor ? minorFirstName.trim() : null,
        minor_last_name: isMinor ? minorLastName.trim() : null,
        minor_dob: isMinor ? minorDob : null,
        guardian_relationship: isMinor ? relationship.trim() : null,
        rules_acknowledged: rulesOk,
        esign_consent: esignOk,
      });
      setResult(r);
      // Best-effort delivery: email the executed copy to the signer and the
      // company inbox. Never blocks the signed confirmation.
      fetch('/api/deliver-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: r.document_id }),
      }).catch(() => { /* the document is safely stored either way */ });
    } catch {
      setError('We could not record your signature. Please try again or see a staff member.');
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <Seo
        title="Stable Rules and Liability Release — French Heritage Equestrian"
        description="Sign the visitor liability release before your visit."
        path="/release"
        noindex
      />
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="container-site max-w-3xl">
          <p className="eyebrow mb-2">Before you visit</p>
          <h1 className="heading-section text-green-800 mb-4">Stable rules and liability release.</h1>

          {blocked ? (
            <div className="bg-white border border-green-800/10 p-8">
              <p className="body-text text-secondary mb-6 max-w-2xl">
                This document is signed in your client account — sign in or use
                your invitation link.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/login" className="btn-primary">Sign in</Link>
                <Link to="/release" className="btn-outline-gold">
                  Sign the general visitor release instead
                </Link>
              </div>
            </div>
          ) : result ? (
            <div>
              <div className="bg-green-50 border border-green-200 p-8 mb-6">
                <h2 className="font-serif font-medium text-green-800 text-xl mb-2 inline-flex items-center gap-2">
                  <Check size={20} aria-hidden="true" />
                  Thank you — your release is on file.
                </h2>
                <p className="body-text text-sm mb-2">
                  Signed by {fullName} · Document {result.document_code}
                  {email.trim() !== '' && ' · A copy is on its way to your email'}
                </p>
                <p className="body-text text-sm text-secondary mb-4">
                  Your release is fully executed. Enjoy your visit.
                </p>
                {/* Kiosk record affordance (release-signing audit): the signer
                    can always take a paper/PDF copy home, on top of the email. */}
                <button type="button" onClick={printSignedRelease} className="btn-outline-gold">
                  <Printer size={16} aria-hidden="true" />
                  Print or save this page
                </button>
              </div>
              {/* Printable subtree (DocumentViewerPage pattern): body.printing
                  shows ONLY this block — the print-only header + the executed
                  document text. */}
              <div className="bg-white border border-green-800/10 print-document">
                <header className="print-only print-doc-header">
                  <h1>Signed release</h1>
                  <p>Reference: {result.document_code} · Signed by {fullName}</p>
                </header>
                <h2 className="eyebrow px-8 pt-6 pb-2 print-hidden">Your signed document</h2>
                <div
                  className="px-8 pb-6 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-secondary leading-relaxed"
                  aria-label="Signed release document"
                >
                  <BodyWithSignatures text={result.merged_body} />
                </div>
              </div>
            </div>
          ) : loadError ? (
            <p className="form-error" role="alert">{loadError}</p>
          ) : step === 'info' ? (
            <form onSubmit={(e) => { e.preventDefault(); if (infoOk) setStep('rules'); }}>
              <p className="body-text text-secondary mb-8 max-w-2xl">
                {option?.label} release. Enter {isMinor ? 'the minor’s details and the parent or guardian’s details' : 'your details'};
                you will read and sign the document next.
              </p>
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <label className="flex items-start gap-3 mb-6 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={isMinor}
                    onChange={(e) => setIsMinor(e.target.checked)}
                  />
                  <span className="body-text text-sm">
                    This release covers a minor (under 18) — a parent or legal guardian will sign.
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {isMinor && (
                    <>
                      <div>
                        <label className="form-label" htmlFor="r-minor-first-name">Minor's first name *</label>
                        <input id="r-minor-first-name" className="form-input" required value={minorFirstName}
                          onChange={(e) => setMinorFirstName(e.target.value)} autoComplete="off" />
                      </div>
                      <div>
                        <label className="form-label" htmlFor="r-minor-last-name">Minor's last name *</label>
                        <input id="r-minor-last-name" className="form-input" required value={minorLastName}
                          onChange={(e) => setMinorLastName(e.target.value)} autoComplete="off" />
                      </div>
                      <div>
                        <label className="form-label" htmlFor="r-minor-dob">Minor's date of birth *</label>
                        <input id="r-minor-dob" type="date" className="form-input" required value={minorDob}
                          onChange={(e) => setMinorDob(e.target.value)} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="form-label" htmlFor="r-first-name">
                      {isMinor ? 'Parent/guardian first name *' : 'First name *'}
                    </label>
                    <input id="r-first-name" className="form-input" required value={firstName}
                      onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="r-last-name">
                      {isMinor ? 'Parent/guardian last name *' : 'Last name *'}
                    </label>
                    <input id="r-last-name" className="form-input" required value={lastName}
                      onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </div>
                  {isMinor && (
                    <div className="sm:col-span-2">
                      <label className="form-label" htmlFor="r-relationship">Relationship to minor *</label>
                      <input id="r-relationship" className="form-input" required value={relationship}
                        onChange={(e) => setRelationship(e.target.value)} placeholder="Parent, legal guardian, …" />
                    </div>
                  )}
                  <div>
                    <label className="form-label" htmlFor="r-email">Email *</label>
                    <input id="r-email" type="email" className="form-input" required value={email}
                      onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="r-phone">Phone</label>
                    <input id="r-phone" type="tel" className="form-input" value={phone}
                      onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </div>
                </div>
                {!emailOk && (
                  <p className="form-hint mt-3">Please provide an email address — your signed copy is sent there.</p>
                )}
              </div>
              <button type="submit" disabled={!infoOk} className="btn-primary w-full justify-center">
                Continue to the facility rules
              </button>
            </form>
          ) : step === 'rules' ? (
            <div>
              <p className="body-text text-secondary mb-8 max-w-2xl">
                Please read our facility rules. You must agree to them before signing the release.
              </p>
              {!rules ? (
                <p className="body-text text-muted">Loading the facility rules…</p>
              ) : (
                <div className="bg-white border border-green-800/10 mb-2">
                  <h2 className="eyebrow px-8 pt-6 pb-2">{rules.title}</h2>
                  <div
                    className="px-8 pb-6 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-secondary leading-relaxed"
                    aria-label="Facility rules document"
                  >
                    {rules.body}
                  </div>
                  <p className="px-8 pb-4 text-xs font-sans text-muted">
                    ↕ The rules above scroll — read them in full before continuing.
                  </p>
                </div>
              )}
              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={rulesOk}
                  onChange={(e) => setRulesOk(e.target.checked)}
                />
                <span className="body-text text-sm">I have read and agree to the Facility Rules. *</span>
              </label>
              <button
                type="button"
                disabled={!rulesOk || !rules}
                onClick={() => setStep('sign')}
                className="btn-primary w-full justify-center"
              >
                Continue to the release
              </button>
            </div>
          ) : (
            <form onSubmit={sign}>
              <p className="body-text text-secondary mb-8 max-w-2xl">
                Read the {option?.label.toLowerCase()} release below, confirm your details, then type
                your name to sign.
              </p>
              {!preview ? (
                <p className="body-text text-muted">Loading the release…</p>
              ) : (
                <div className="bg-white border border-green-800/10 mb-6">
                  <h2 className="eyebrow px-8 pt-6 pb-2">{preview.title}</h2>
                  <div
                    className="px-8 pb-6 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-secondary leading-relaxed"
                    aria-label="Release document"
                  >
                    {preview.body}
                  </div>
                  <p className="px-8 pb-4 text-xs font-sans text-muted">
                    ↕ The document above scrolls — read it in full before signing.
                  </p>
                  {/* Signer details: a visibly darker panel so it reads as YOUR
                      section, distinct from the scrollable document above. */}
                  <div className="px-8 pb-6 text-sm text-green-900 leading-relaxed border-t border-green-800/15 pt-5 bg-green-800/[0.06]">
                    <p className="eyebrow mb-3 pt-1">{isMinor ? 'Minor signer (parent/guardian)' : 'Adult signer'}</p>
                    {isMinor ? (
                      <>
                        <p>Minor's Name: {minorFullName}</p>
                        <p>Date of Birth: {minorDob}</p>
                        <p>Parent/Guardian Name: {fullName}</p>
                        <p>Relationship to Minor: {relationship.trim()}</p>
                      </>
                    ) : (
                      <p>Printed Name: {fullName}</p>
                    )}
                    {email.trim() !== '' && <p>Email: {email.trim()}</p>}
                    {phone.trim() !== '' && <p>Phone: {phone.trim()}</p>}
                    <p>Signature: (type below to sign)</p>
                  </div>
                </div>
              )}
              <div className="bg-green-800/[0.06] border border-green-800/15 p-8">
                <label className="form-label" htmlFor="r-signature">
                  <span className="inline-flex items-center gap-2">
                    <PenLine size={14} aria-hidden="true" />
                    {isMinor
                      ? 'Parent/guardian: type your full name to sign *'
                      : 'Type your full name to sign *'}
                  </span>
                </label>
                <input id="r-signature" className="form-input font-serif italic" value={typedName}
                  onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />
                {typedName.trim() !== '' && !typedMatches && (
                  <p className="form-hint mt-2">Your typed signature must match your full legal name exactly.</p>
                )}
                {/* E-sign consent (release-signing audit): REQUIRED — the
                    sign_release RPC rejects a kiosk signing without it. */}
                <label className="flex items-start gap-3 mt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={esignOk}
                    onChange={(e) => setEsignOk(e.target.checked)}
                  />
                  <span className="body-text text-sm">
                    I agree to sign this document electronically and understand
                    my electronic signature is legally binding. *
                  </span>
                </label>
                {error && <p className="form-error mt-4" role="alert">{error}</p>}
                <button type="submit" disabled={!canSign || !preview} className="btn-primary mt-6 w-full justify-center">
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
