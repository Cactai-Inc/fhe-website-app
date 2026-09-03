import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  contractIntakeRequirements, captureContactInfo, captureHorseRecord,
  type ContractIntakeRequirements,
} from '../../lib/contracts';
import { toErrorMessage } from '../../lib/ops/errors';
import { useDocumentTitle } from '../../lib/hooks';
import { useFieldNormalizer } from '../../lib/formState';
import { normalizeKindForField } from '../../lib/normalize';

/**
 * P1 ITEM 2 — CLAIM → FILL WHAT IS MISSING → STRAIGHT INTO THE CONTRACT.
 *
 * Owner, 2026-08-25: *"on activation she sees the contract, or if there is
 * information we need like her address which i dont have she is prompted with an
 * intake page to add the missing information we need for the contract, this
 * applies to both her account (personal information) and her horse record. after
 * adding that information she clicks continue and then she is taken right into the
 * contract to review it and the information she added is shown to her."*
 *
 * THIS IS A GATE, NOT A FORM. It asks the server what this contract still needs
 * and does not have (`contract_intake_requirements`), and:
 *   nothing missing → it never renders. It forwards to the document, replacing
 *                     itself in history so Back does not bounce off it.
 *   something missing → ONLY those fields. Not the whole intake form; not a field
 *                     already on file. Personal information and horse-record
 *                     information sit on the SAME page, because they are one
 *                     question from the reader's side: "what do you still need
 *                     from me before I can read this?"
 *
 * ONE `Continue`, ONE DESTINATION. Everything typed here is written to the
 * CENTRAL record — the contact, the horse — never to a copy on the document, so
 * it is reused by every document; the contract is then recomposed so what she
 * typed is IN the text she is about to read.
 *
 * It is reachable directly (`/app/contracts/:id/start`), so re-entering it after
 * the fact is harmless: with nothing missing it is a redirect.
 */
export default function ContractIntake() {
  useDocumentTitle('Before You Read It');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [req, setReq] = useState<ContractIntakeRequirements | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const normalize = useFieldNormalizer();

  useEffect(() => {
    if (!id) return;
    let active = true;
    contractIntakeRequirements(id)
      .then((r) => {
        if (!active) return;
        // Nothing missing: this page has no reason to exist for her. Replace, so
        // the browser's Back button goes where she came from, not back to here.
        if (r.complete) { navigate(`/app/contracts/${id}`, { replace: true }); return; }
        setReq(r);
      })
      .catch((err) => {
        if (!active) return;
        // Never strand someone between their account and their contract: if we
        // cannot compute what is missing, the document itself is still the right
        // destination and it does its own gating.
        setLoadError(toErrorMessage(err, 'We could not check what this contract still needs.'));
      });
    return () => { active = false; };
  }, [id, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !req || busy) return;
    setBusy(true); setSaveError(null);
    try {
      const need = (k: string) => req.contact.missing.some((m) => m.key === k);
      const val = (k: string) => (form[k] ?? '').trim();

      if (req.contact.missing.length > 0 && req.contact.contact_id) {
        const patch: Parameters<typeof captureContactInfo>[2] = {};
        if (need('name')) { patch.first_name = val('first_name'); patch.last_name = val('last_name'); }
        if (need('email')) patch.email = val('email');
        if (need('phone')) patch.phone = val('phone');
        if (need('address')) {
          patch.address_line1 = val('address_line1');
          patch.address_line2 = val('address_line2') || undefined;
          patch.city = val('city');
          patch.state = val('state');
          patch.postal_code = val('postal_code');
        }
        await captureContactInfo(id, req.contact.contact_id, patch);
      }

      if (req.horse.missing.length > 0) {
        const patch: Parameters<typeof captureHorseRecord>[1] = {};
        for (const m of req.horse.missing) {
          if (m.key === 'vet_address') {
            const parts = ['vet_address_line1', 'vet_city', 'vet_state', 'vet_postal'] as const;
            // An OPTIONAL address left entirely blank is a real answer ("this vet
            // has no address"), not an omission — writing four empty strings over
            // four nulls would be a pointless record touch. Skip it.
            if (m.optional && parts.every((k) => val(k) === '')) continue;
            patch.vet_address_line1 = val('vet_address_line1');
            patch.vet_city = val('vet_city');
            patch.vet_state = val('vet_state');
            patch.vet_postal = val('vet_postal');
          } else {
            if (m.optional && val(m.key) === '') continue;
            (patch as Record<string, string>)[m.key] = val(m.key);
          }
        }
        if (Object.keys(patch).length > 0) await captureHorseRecord(id, patch);
      }

      navigate(`/app/contracts/${id}`, { replace: true });
    } catch (err) {
      setSaveError(toErrorMessage(err, 'Could not save what you entered. Please try again.'));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <p role="alert" className="form-error mb-4">{loadError}</p>
        <button type="button" className="btn-primary"
          onClick={() => navigate(`/app/contracts/${id}`, { replace: true })}>
          Go to the document <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="max-w-2xl">
        <p className="body-text text-muted">Opening your document…</p>
      </div>
    );
  }

  const needContact = (k: string) => req.contact.missing.some((m) => m.key === k);
  const docName = req.title?.trim() || 'your contract';

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-2">Before you read it</p>
      <h1 className="heading-section text-green-800 mb-3">We need a few details from you.</h1>
      <p className="body-text text-sm mb-8">
        {docName} is ready for you. These are the only things we don’t already have —
        they go into the document itself, and onto your record so we never have to
        ask again.
      </p>

      <form onSubmit={submit} className="bg-white border border-green-800/10 p-8">
        {req.contact.missing.length > 0 && (
          <section className="mb-6">
            <h2 className="font-serif text-lg text-green-900 mb-4">Your information</h2>

            {needContact('name') && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="block">
                  <span className="form-label">First name</span>
                  <input className="form-input" required value={form.first_name ?? ''} onChange={set('first_name')}
                    onBlur={(() => { const kind = normalizeKindForField('first_name'); return kind ? normalize('intake-first_name', kind, form.first_name ?? '', (v) => setForm((p) => ({ ...p, first_name: v }))) : undefined; })()} />
                </label>
                <label className="block">
                  <span className="form-label">Last name</span>
                  <input className="form-input" required value={form.last_name ?? ''} onChange={set('last_name')}
                    onBlur={(() => { const kind = normalizeKindForField('last_name'); return kind ? normalize('intake-last_name', kind, form.last_name ?? '', (v) => setForm((p) => ({ ...p, last_name: v }))) : undefined; })()} />
                </label>
              </div>
            )}

            {needContact('email') && (
              <label className="block mb-4">
                <span className="form-label">Email address</span>
                <input className="form-input" type="email" required value={form.email ?? ''} onChange={set('email')}
                  onBlur={(() => { const kind = normalizeKindForField('email'); return kind ? normalize('intake-email', kind, form.email ?? '', (v) => setForm((p) => ({ ...p, email: v }))) : undefined; })()} />
              </label>
            )}

            {needContact('phone') && (
              <label className="block mb-4">
                <span className="form-label">Phone number</span>
                <input className="form-input" type="tel" required value={form.phone ?? ''} onChange={set('phone')}
                  onBlur={(() => { const kind = normalizeKindForField('phone'); return kind ? normalize('intake-phone', kind, form.phone ?? '', (v) => setForm((p) => ({ ...p, phone: v }))) : undefined; })()} />
              </label>
            )}

            {needContact('address') && (
              <fieldset className="mb-1">
                <legend className="form-label mb-2">Mailing address</legend>
                <input className="form-input mb-2" required placeholder="Street address"
                  aria-label="Street address" value={form.address_line1 ?? ''} onChange={set('address_line1')}
                  onBlur={(() => { const kind = normalizeKindForField('address_line1'); return kind ? normalize('intake-address_line1', kind, form.address_line1 ?? '', (v) => setForm((p) => ({ ...p, address_line1: v }))) : undefined; })()} />
                <input className="form-input mb-2" placeholder="Apartment, suite (optional)"
                  aria-label="Apartment or suite" value={form.address_line2 ?? ''} onChange={set('address_line2')}
                  onBlur={(() => { const kind = normalizeKindForField('address_line2'); return kind ? normalize('intake-address_line2', kind, form.address_line2 ?? '', (v) => setForm((p) => ({ ...p, address_line2: v }))) : undefined; })()} />
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <input className="form-input" required placeholder="City"
                    aria-label="City" value={form.city ?? ''} onChange={set('city')}
                    onBlur={(() => { const kind = normalizeKindForField('city'); return kind ? normalize('intake-city', kind, form.city ?? '', (v) => setForm((p) => ({ ...p, city: v }))) : undefined; })()} />
                  <input className="form-input" required placeholder="State"
                    aria-label="State" value={form.state ?? ''} onChange={set('state')}
                    onBlur={(() => { const kind = normalizeKindForField('state'); return kind ? normalize('intake-state', kind, form.state ?? '', (v) => setForm((p) => ({ ...p, state: v }))) : undefined; })()} />
                </div>
                <input className="form-input" required placeholder="ZIP code"
                  aria-label="ZIP code" value={form.postal_code ?? ''} onChange={set('postal_code')}
                  onBlur={(() => { const kind = normalizeKindForField('postal_code'); return kind ? normalize('intake-postal_code', kind, form.postal_code ?? '', (v) => setForm((p) => ({ ...p, postal_code: v }))) : undefined; })()} />
              </fieldset>
            )}
          </section>
        )}

        {req.horse.missing.length > 0 && (
          <section className="mb-6">
            {/* Same page, same Continue — the owner's rule. A second screen for
                the horse would be a second thing to abandon. */}
            <h2 className="font-serif text-lg text-green-900 mb-1">Your horse’s record</h2>
            <p className="text-sm text-muted mb-4">
              The contract names these, and the record doesn’t have them yet.
            </p>
            {/* ⚠️ AN OPTIONAL NEED IS OFFERED, NEVER REQUIRED (owner, 2026-08-26:
                "we need to removed the required status of ... the vets address").
                Sundance's veterinarian travels to the horse and publishes no
                address, so a `required` input here was one nobody could satisfy —
                and it was the ONLY thing standing between the Lessor and her
                contract. It is still asked, because a vet who HAS an address
                should give it once; it just cannot hold the page shut. */}
            {req.horse.missing.map((m) => (
              m.kind === 'address' ? (
                <fieldset key={m.key} className="mb-4">
                  <legend className="form-label mb-2">
                    {m.label}
                    {m.optional && <span className="ml-1 font-normal text-muted">— optional</span>}
                  </legend>
                  {m.optional && (
                    <p className="text-xs text-muted mb-2">
                      Leave this blank if the veterinarian travels to the horse and has no street address.
                    </p>
                  )}
                  <input className="form-input mb-2" required={!m.optional} placeholder="Street address"
                    aria-label={`${m.label} — street`} value={form.vet_address_line1 ?? ''} onChange={set('vet_address_line1')} />
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <input className="form-input" required={!m.optional} placeholder="City"
                      aria-label={`${m.label} — city`} value={form.vet_city ?? ''} onChange={set('vet_city')} />
                    <input className="form-input" required={!m.optional} placeholder="State"
                      aria-label={`${m.label} — state`} value={form.vet_state ?? ''} onChange={set('vet_state')} />
                  </div>
                  <input className="form-input" required={!m.optional} placeholder="ZIP code"
                    aria-label={`${m.label} — ZIP`} value={form.vet_postal ?? ''} onChange={set('vet_postal')} />
                </fieldset>
              ) : (
                <label key={m.key} className="block mb-4">
                  <span className="form-label">
                    {m.label}
                    {m.optional && <span className="ml-1 font-normal text-muted">— optional</span>}
                  </span>
                  <input className="form-input" required={!m.optional} value={form[m.key] ?? ''} onChange={set(m.key)} />
                </label>
              )
            ))}
          </section>
        )}

        {saveError && <p role="alert" className="form-error mb-4">{saveError}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
          {busy ? 'Saving…' : 'Continue to the contract'}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>
    </div>
  );
}
