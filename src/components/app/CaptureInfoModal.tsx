import { useMemo, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import { captureContactInfo, type PartyField, type PartySummary } from '../../lib/contracts';
import { Modal } from '../ops/kit/Modal';
import { useFieldNormalizer, useFormDraft } from '../../lib/formState';

/**
 * CAPTURE MISSING INFO — the one reusable modal for collecting a party's required
 * contact details (name, address, phone, email) when they're missing from the
 * central contact record. It writes to the CONTACT (reused by every document),
 * then refills + re-merges this contract. Used both from the Parties & Horse card
 * ("Add address") and as the auto-prompt when locking a contract with gaps.
 *
 * It never presumes a value exists: it validates each field on submit and only the
 * fields actually requested (or missing) are shown, so we capture, validate, then
 * display — not the other way around.
 *
 * ⚠️ TASK-FIX4 — converged on the shared dialog. The backdrop used to carry
 * `onClick={onClose}`, so a stray click discarded a re-typed address on a contract
 * that could not be locked without it. **Save is the affirmative action and the
 * only thing that writes to the contact record**; the draft persists on its own.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// North-American-friendly: 10+ digits after stripping punctuation.
function phoneOk(v: string): boolean {
  return v.replace(/[^\d]/g, '').length >= 10;
}
// US postal: 5 or 5+4.
const ZIP_RE = /^\d{5}(-\d{4})?$/;

export function CaptureInfoModal({
  documentId, party, fields, onClose, onSaved,
}: {
  documentId: string;
  party: PartySummary;
  /** which fields to collect; defaults to the party's missing set */
  fields?: PartyField[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const want = fields && fields.length ? fields : party.missing;
  const need = (f: PartyField) => want.includes(f);
  const normalize = useFieldNormalizer();

  const [first, setFirst] = useState(party.first_name ?? '');
  const [last, setLast] = useState(party.last_name ?? '');
  const [email, setEmail] = useState(party.email ?? '');
  const [phone, setPhone] = useState(party.phone ?? '');
  const [line1, setLine1] = useState(party.address_line1 ?? '');
  const [line2, setLine2] = useState(party.address_line2 ?? '');
  const [city, setCity] = useState(party.city ?? '');
  const [stateV, setStateV] = useState(party.state ?? '');
  const [zip, setZip] = useState(party.postal_code ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    const r = party.party_role;
    return r.charAt(0) + r.slice(1).toLowerCase();
  }, [party.party_role]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (need('name') && !`${first} ${last}`.trim()) e.name = 'Enter a name.';
    if (need('email')) {
      if (!email.trim()) e.email = 'Enter an email address.';
      else if (!EMAIL_RE.test(email.trim())) e.email = 'That email doesn’t look right.';
    }
    if (need('phone')) {
      if (!phone.trim()) e.phone = 'Enter a phone number.';
      else if (!phoneOk(phone)) e.phone = 'Enter a valid phone number (at least 10 digits).';
    }
    if (need('address')) {
      if (!line1.trim()) e.line1 = 'Enter a street address.';
      if (!city.trim()) e.city = 'Enter a city.';
      if (!stateV.trim()) e.state = 'Enter a state.';
      if (!zip.trim()) e.zip = 'Enter a ZIP code.';
      else if (!ZIP_RE.test(zip.trim())) e.zip = 'Enter a valid ZIP (e.g. 92109).';
    }
    return e;
  }

  /* ⚠️ Keyed on the PARTY, not the document — the same person's half-typed
     address should come back whichever contract prompted for it. */
  const draft = useFormDraft(
    party.contact_id ? `contract.capture-info.${party.contact_id}` : null,
    { first, last, email, phone, line1, line2, city, stateV, zip },
    (d) => {
      if (typeof d.first === 'string') setFirst(d.first);
      if (typeof d.last === 'string') setLast(d.last);
      if (typeof d.email === 'string') setEmail(d.email);
      if (typeof d.phone === 'string') setPhone(d.phone);
      if (typeof d.line1 === 'string') setLine1(d.line1);
      if (typeof d.line2 === 'string') setLine2(d.line2);
      if (typeof d.city === 'string') setCity(d.city);
      if (typeof d.stateV === 'string') setStateV(d.stateV);
      if (typeof d.zip === 'string') setZip(d.zip);
    },
  );

  function clearForm() {
    setFirst(''); setLast(''); setEmail(''); setPhone('');
    setLine1(''); setLine2(''); setCity(''); setStateV(''); setZip('');
    setErrors({}); setSubmitErr(null);
    draft.clear();
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!party.contact_id) { setSubmitErr('This party has no contact record to save to.'); return; }
    setBusy(true); setSubmitErr(null);
    try {
      const patch: Parameters<typeof captureContactInfo>[2] = {};
      if (need('name')) { patch.first_name = first.trim(); patch.last_name = last.trim(); }
      if (need('email')) patch.email = email.trim();
      if (need('phone')) patch.phone = phone.trim();
      if (need('address')) {
        patch.address_line1 = line1.trim();
        patch.address_line2 = line2.trim() || undefined;
        patch.city = city.trim();
        patch.state = stateV.trim();
        patch.postal_code = zip.trim();
      }
      await captureContactInfo(documentId, party.contact_id, patch);
      draft.clear();
      onSaved();
    } catch (err) {
      setSubmitErr(toErrorMessage(err, 'Could not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  const fieldNote = want.length === 1
    ? `Add the ${want[0]} for ${roleLabel} ${party.name ?? ''}`.trim()
    : `Complete the required details for ${roleLabel} ${party.name ?? ''}`.trim();

  return (
    <Modal open onClose={onClose} size="sm"
      title="Add missing information"
      subtitle={`${fieldNote}. Saved to their contact record and reused across every document.`}
      onClear={clearForm} saveStatus={draft.status} error={submitErr}
      footer={
        <button type="button" className="btn-primary text-sm" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }>
        <div className="flex flex-col gap-3.5">
          {need('name') && (
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="form-label">First name</span>
                <input className="form-input" value={first} onChange={(e) => setFirst(e.target.value)}
                  onBlur={normalize('first', 'name', first, setFirst)} />
              </label>
              <label className="block">
                <span className="form-label">Last name</span>
                <input className="form-input" value={last} onChange={(e) => setLast(e.target.value)}
                  onBlur={normalize('last', 'name', last, setLast)} />
              </label>
              {errors.name && <p className="form-error col-span-2">{errors.name}</p>}
            </div>
          )}

          {need('email') && (
            <label className="block">
              <span className="form-label">Email</span>
              <input type="email" inputMode="email" className="form-input"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onBlur={normalize('email', 'email', email, setEmail)}
                aria-invalid={!!errors.email} placeholder="name@example.com" />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </label>
          )}

          {need('phone') && (
            <label className="block">
              <span className="form-label">Phone</span>
              <input type="tel" inputMode="tel" className="form-input"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                onBlur={normalize('phone', 'phone', phone, setPhone)}
                aria-invalid={!!errors.phone} placeholder="(858) 555-0123" />
              {errors.phone && <p className="form-error">{errors.phone}</p>}
            </label>
          )}

          {need('address') && (
            <div className="flex flex-col gap-2.5">
              <label className="block">
                <span className="form-label">Street address</span>
                <input className="form-input" value={line1} onChange={(e) => setLine1(e.target.value)}
                  aria-invalid={!!errors.line1} placeholder="752 Windemere Ct" />
                {errors.line1 && <p className="form-error">{errors.line1}</p>}
              </label>
              <label className="block">
                <span className="form-label">Apt / Suite <span className="text-muted font-normal">(optional)</span></span>
                <input className="form-input" value={line2} onChange={(e) => setLine2(e.target.value)} />
              </label>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2.5">
                <label className="block">
                  <span className="form-label">City</span>
                  <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)}
                    aria-invalid={!!errors.city} />
                </label>
                <label className="block">
                  <span className="form-label">State</span>
                  <input className="form-input w-16" value={stateV} maxLength={2}
                    onChange={(e) => setStateV(e.target.value.toUpperCase())}
                    aria-invalid={!!errors.state} placeholder="CA" />
                </label>
                <label className="block">
                  <span className="form-label">ZIP</span>
                  <input className="form-input w-24" value={zip} onChange={(e) => setZip(e.target.value)}
                    aria-invalid={!!errors.zip} placeholder="92109" />
                </label>
              </div>
              {(errors.city || errors.state || errors.zip) && (
                <p className="form-error">{errors.city || errors.state || errors.zip}</p>
              )}
            </div>
          )}

        </div>
    </Modal>
  );
}

export default CaptureInfoModal;
