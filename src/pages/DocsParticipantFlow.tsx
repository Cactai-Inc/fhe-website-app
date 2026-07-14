import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { BodyWithSignatures } from '../components/ops/documents/MergedBodyView';
import { signRelease, fetchReleasePreview } from '../lib/ops/api-public';
import type { ReleaseTemplateKey, SignReleaseResult } from '../lib/ops/api-public';

/**
 * /docs/release-participant — the guided participant onboarding signing flow.
 *
 * ONE information step, then FOUR documents signed in sequence, each inheriting
 * the same signer data (same email → same contact server-side):
 *   1. Property Rules & Safety   (FACILITY_RULES)
 *   2. Business Policies         (COMPANY_POLICIES)
 *   3. Participant Release       (RELEASE_PARTICIPANT)
 *   4. Emergency Medical Auth    (HUMAN_EMERGENCY_MEDICAL)
 *
 * Each sign is a real sign_release call → its own EXECUTED documents row (logged,
 * findable in ops). After the final sign we deliver an emailed copy of EVERY
 * signed document (best-effort /api/deliver-document per doc) and show one
 * combined done screen. This flow is independent of the /release kiosk.
 *
 * Required: first name, last name, email, and a typed signature matching the
 * name. Everything medical (DOB, address, emergency contacts) is optional —
 * blank fields simply merge blank on the documents.
 */

interface DocStep {
  key: ReleaseTemplateKey;
  label: string;
}

const SEQUENCE: DocStep[] = [
  { key: 'FACILITY_RULES', label: 'Property Rules & Safety' },
  { key: 'COMPANY_POLICIES', label: 'Business Policies' },
  { key: 'RELEASE_PARTICIPANT', label: 'Participant Liability Release' },
  { key: 'HUMAN_EMERGENCY_MEDICAL', label: 'Emergency Medical Authorization' },
];

type Phase = 'info' | 'sign' | 'done';

export default function DocsParticipantFlow() {
  // ---- signer info (shared across all documents) ----
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postal, setPostal] = useState('');
  const [ec1Name, setEc1Name] = useState('');
  const [ec1Rel, setEc1Rel] = useState('');
  const [ec1Phone, setEc1Phone] = useState('');
  const [ec2Name, setEc2Name] = useState('');
  const [ec2Rel, setEc2Rel] = useState('');
  const [ec2Phone, setEc2Phone] = useState('');

  // ---- minor flow ----
  const [isMinor, setIsMinor] = useState(false);
  const [minorFirst, setMinorFirst] = useState('');
  const [minorLast, setMinorLast] = useState('');
  const [minorDob, setMinorDob] = useState('');
  const [relationship, setRelationship] = useState('');

  // ---- flow state ----
  const [phase, setPhase] = useState<Phase>('info');
  const [index, setIndex] = useState(0); // which document in SEQUENCE
  const [typedName, setTypedName] = useState('');
  const [esignOk, setEsignOk] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<SignReleaseResult[]>([]);

  // Preview body for the current document (fetched from the anon release_preview
  // RPC — real org identity + dates merged, body truncated before the signature
  // area). Re-fetched whenever the sign step advances to the next document.
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const minorFullName = [minorFirst.trim(), minorLast.trim()].filter(Boolean).join(' ');

  const nameOk = firstName.trim() !== '' && fullName.length >= 2;
  const emailOk = email.trim() !== '';
  const minorOk =
    !isMinor ||
    (minorFirst.trim() !== '' &&
      minorFullName.length >= 2 &&
      minorDob !== '' &&
      relationship.trim().length >= 2);
  const infoOk = nameOk && emailOk && minorOk;

  const current = SEQUENCE[index];

  // Fill the preview's labeled "__________" blanks with what the signer just
  // entered, so the pre-sign preview shows THEIR real data (owner: readers were
  // confused by an all-blank information section). Label-keyed replace: for each
  // "Label: __________" line, drop in the matching value. Only fills known
  // person-info labels; anything else stays blank.
  function populatePreview(bodyText: string): string {
    const addr = [address1.trim(), address2.trim(), [city.trim(), stateRegion.trim()].filter(Boolean).join(', '), postal.trim()]
      .filter(Boolean).join(', ');
    const fills: Array<[RegExp, string]> = [
      [/^(Name:\s*)_{3,}/m, fullName],
      [/^(Date of Birth:\s*)_{3,}/m, dob],
      [/^(Address:\s*)_{3,}/m, addr],
      [/^(Phone:\s*)_{3,}/m, phone.trim()],
      [/^(Email:\s*)_{3,}/m, email.trim()],
    ];
    let out = bodyText;
    for (const [re, val] of fills) {
      if (val) out = out.replace(re, `$1${val}`);
    }
    // Emergency contacts (two blocks): replace the first two of each label in order.
    const ec = [
      [ec1Name.trim(), ec1Rel.trim(), ec1Phone.trim()],
      [ec2Name.trim(), ec2Rel.trim(), ec2Phone.trim()],
    ];
    (['Name', 'Relationship', 'Phone'] as const).forEach((label, fi) => {
      // within EMERGENCY CONTACT sections these labels repeat; fill sequentially
      let occurrence = 0;
      out = out.replace(new RegExp(`^(${label}:\\s*)_{3,}`, 'gm'), (m, p1) => {
        const val = ec[occurrence]?.[fi] ?? '';
        occurrence += 1;
        return val ? `${p1}${val}` : m;
      });
    });
    return out;
  }

  // Load the current document's preview when signing this doc. For the medical
  // authorization, populate the info blanks with the signer's entered data.
  useEffect(() => {
    if (phase !== 'sign' || !current) return;
    let active = true;
    setPreviewBody(null);
    setPreviewError(null);
    fetchReleasePreview(current.key)
      .then((p) => {
        if (!active) return;
        const populated = current.key === 'HUMAN_EMERGENCY_MEDICAL' ? populatePreview(p.body) : p.body;
        setPreviewBody(populated);
      })
      .catch(() => { if (active) setPreviewError('We could not load this document. Please see a staff member.'); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current]);

  const typedMatches =
    typedName.trim() !== '' && typedName.trim().toLowerCase() === fullName.toLowerCase();
  const canSign = typedMatches && esignOk && !signing;

  function startSigning(e: React.FormEvent) {
    e.preventDefault();
    if (infoOk) setPhase('sign');
  }

  async function signCurrent(e: React.FormEvent) {
    e.preventDefault();
    if (!canSign) return;
    setSigning(true);
    setError(null);
    try {
      const r = await signRelease({
        template_key: current.key,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        typed_name: typedName.trim(),
        is_minor: isMinor,
        minor_first_name: isMinor ? minorFirst.trim() : null,
        minor_last_name: isMinor ? minorLast.trim() : null,
        minor_dob: isMinor ? minorDob : null,
        guardian_relationship: isMinor ? relationship.trim() : null,
        // FACILITY_RULES / COMPANY_POLICIES / HUMAN_EMERGENCY_MEDICAL are not
        // RELEASE_* templates, so the server does not require a rules ack for
        // them; RELEASE_PARTICIPANT is gated, so we pass true (the signer has
        // just signed the rules doc as step 1 of this same flow).
        rules_acknowledged: true,
        esign_consent: esignOk,
        dob: dob || null,
        address_line1: address1.trim() || null,
        address_line2: address2.trim() || null,
        city: city.trim() || null,
        state: stateRegion.trim() || null,
        postal_code: postal.trim() || null,
        emergency_contact_1_name: ec1Name.trim() || null,
        emergency_contact_1_relationship: ec1Rel.trim() || null,
        emergency_contact_1_phone: ec1Phone.trim() || null,
        emergency_contact_2_name: ec2Name.trim() || null,
        emergency_contact_2_relationship: ec2Rel.trim() || null,
        emergency_contact_2_phone: ec2Phone.trim() || null,
      });
      const nextSigned = [...signed, r];
      setSigned(nextSigned);

      if (index + 1 < SEQUENCE.length) {
        // advance to the next document, reset per-doc inputs
        setIndex(index + 1);
        setTypedName('');
        setEsignOk(false);
      } else {
        // final document signed — deliver ONE email with all signed documents
        // attached as PDFs (best-effort; the documents are safely stored
        // regardless) and finish.
        fetch('/api/deliver-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentIds: nextSigned.map((d) => d.document_id) }),
        }).catch(() => {
          /* stored either way */
        });
        setPhase('done');
      }
    } catch {
      setError(
        'We could not record your signature. Please try again, or see a staff member.',
      );
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <Seo
        title="Participant Documents — French Heritage Equestrian"
        description="Complete and sign your participant documents."
        path="/docs/release-participant"
        noindex
      />
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="container-site max-w-3xl">
          <p className="eyebrow mb-2">Participant documents</p>
          <h1 className="heading-section text-green-800 mb-4">
            Complete and sign your documents.
          </h1>

          {/* progress */}
          {phase !== 'info' && (
            <ol className="flex flex-wrap gap-2 mb-8" aria-label="Document progress">
              {SEQUENCE.map((d, i) => {
                const state =
                  phase === 'done' || i < index ? 'done' : i === index ? 'current' : 'todo';
                return (
                  <li
                    key={d.key}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      state === 'done'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : state === 'current'
                          ? 'bg-white border-green-800/40 text-green-900 font-medium'
                          : 'bg-transparent border-green-800/10 text-secondary'
                    }`}
                  >
                    {state === 'done' && <Check size={12} className="inline mr-1" aria-hidden="true" />}
                    {d.label}
                  </li>
                );
              })}
            </ol>
          )}

          {/* ---------- INFO STEP ---------- */}
          {phase === 'info' && (
            <form onSubmit={startSigning} className="bg-white border border-green-800/10 p-8">
              <h2 className="eyebrow mb-4">Your information</h2>
              <p className="form-hint mb-6">
                Fields marked * are required. You may skip anything you don't have on hand.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="form-label" htmlFor="fn">First name *</label>
                  <input id="fn" className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ln">Last name *</label>
                  <input id="ln" className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="em">Email *</label>
                  <input id="em" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ph">Phone</label>
                  <input id="ph" type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="dob">Date of birth</label>
                  <input id="dob" type="date" className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>

              <h2 className="eyebrow mt-8 mb-4">Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="form-label" htmlFor="a1">Street address</label>
                  <input id="a1" className="form-input" value={address1} onChange={(e) => setAddress1(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label" htmlFor="a2">Apt / unit</label>
                  <input id="a2" className="form-input" value={address2} onChange={(e) => setAddress2(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ci">City</label>
                  <input id="ci" className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="st">State</label>
                  <input id="st" className="form-input" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="zp">ZIP</label>
                  <input id="zp" className="form-input" value={postal} onChange={(e) => setPostal(e.target.value)} />
                </div>
              </div>

              <h2 className="eyebrow mt-8 mb-4">Emergency contact #1</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="form-label" htmlFor="e1n">Name</label>
                  <input id="e1n" className="form-input" value={ec1Name} onChange={(e) => setEc1Name(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="e1r">Relationship</label>
                  <input id="e1r" className="form-input" value={ec1Rel} onChange={(e) => setEc1Rel(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="e1p">Phone</label>
                  <input id="e1p" type="tel" className="form-input" value={ec1Phone} onChange={(e) => setEc1Phone(e.target.value)} />
                </div>
              </div>

              <h2 className="eyebrow mt-8 mb-4">Emergency contact #2</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="form-label" htmlFor="e2n">Name</label>
                  <input id="e2n" className="form-input" value={ec2Name} onChange={(e) => setEc2Name(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="e2r">Relationship</label>
                  <input id="e2r" className="form-input" value={ec2Rel} onChange={(e) => setEc2Rel(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="e2p">Phone</label>
                  <input id="e2p" type="tel" className="form-input" value={ec2Phone} onChange={(e) => setEc2Phone(e.target.value)} />
                </div>
              </div>

              <div className="mt-8 border-t border-green-800/10 pt-6">
                <label className="inline-flex items-center gap-2 text-sm text-secondary">
                  <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
                  I am signing as the parent or legal guardian of a minor participant.
                </label>
                {isMinor && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                    <div>
                      <label className="form-label" htmlFor="mf">Minor's first name *</label>
                      <input id="mf" className="form-input" value={minorFirst} onChange={(e) => setMinorFirst(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="ml">Minor's last name *</label>
                      <input id="ml" className="form-input" value={minorLast} onChange={(e) => setMinorLast(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="md">Minor's date of birth *</label>
                      <input id="md" type="date" className="form-input" value={minorDob} onChange={(e) => setMinorDob(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="rel">Your relationship to the minor *</label>
                      <input id="rel" className="form-input" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={!infoOk} className="btn-primary mt-8 w-full justify-center">
                Continue to documents <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* ---------- SIGN STEP ---------- */}
          {phase === 'sign' && current && (
            <form onSubmit={signCurrent} className="bg-white border border-green-800/10 p-8">
              <h2 className="font-serif text-xl text-green-800 mb-1">{current.label}</h2>
              <p className="form-hint mb-5">Document {index + 1} of {SEQUENCE.length}</p>

              <div className="border border-green-800/10 rounded max-h-96 overflow-y-auto p-5 mb-6 bg-cream/40">
                {previewError ? (
                  <p className="form-error" role="alert">{previewError}</p>
                ) : previewBody === null ? (
                  <p className="body-text text-sm text-muted">Loading document…</p>
                ) : (
                  // whitespace-pre-wrap preserves the blank lines between sections
                  // (the merged body is plain text; without this, HTML collapses
                  // every newline and the document renders as one block).
                  <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-green-900">
                    <BodyWithSignatures text={previewBody} />
                  </pre>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm text-secondary mb-5">
                <input type="checkbox" checked={esignOk} onChange={(e) => setEsignOk(e.target.checked)} className="mt-1" />
                I agree to sign this document electronically, and my typed name below is my legal signature.
              </label>

              <label className="form-label" htmlFor="typed">Type your full name to sign *</label>
              <input
                id="typed"
                className="form-input"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={fullName}
              />
              {typedName.trim() !== '' && !typedMatches && (
                <p className="form-hint mt-1">Your typed name must match: {fullName}</p>
              )}

              {error && <p className="form-error mt-5" role="alert">{error}</p>}

              <button type="submit" disabled={!canSign} className="btn-primary mt-6 w-full justify-center">
                {signing
                  ? 'Signing…'
                  : index + 1 < SEQUENCE.length
                    ? 'Sign & continue'
                    : 'Sign & finish'}
                {!signing && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          {/* ---------- DONE STEP ---------- */}
          {phase === 'done' && (
            <div className="bg-green-50 border border-green-200 p-8">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-2 inline-flex items-center gap-2">
                <Check size={20} aria-hidden="true" />
                All documents signed. Thank you.
              </h2>
              <p className="body-text text-sm mb-4">
                We've emailed {email.trim()} a copy of your signed documents,
                attached as PDFs.
              </p>
              <ul className="text-sm text-green-900 space-y-1">
                {SEQUENCE.map((d, i) => (
                  <li key={d.key} className="flex items-center gap-2">
                    <Check size={14} aria-hidden="true" />
                    {d.label}
                    {signed[i]?.document_code && (
                      <span className="text-green-800/60 font-mono text-xs">
                        · {signed[i].document_code}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {/* The kiosk is a precursor to a client account: these signed docs
                  attach to the signer's contact and follow them into their
                  account once activated. */}
              <div className="mt-6 pt-5 border-t border-green-200">
                <p className="body-text text-sm mb-3">
                  Your documents are on file and will appear in your online account.
                  Sign in to view them anytime — or we'll help you get set up.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:text-green-700 px-4 py-2 rounded-lg border border-green-800/20 hover:border-green-800/40 focus-ring"
                >
                  Sign in to your account
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
