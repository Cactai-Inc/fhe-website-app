import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import {
  listPublicIntakeForms,
  submitIntakeSubmission,
} from '../lib/ops/api-public';
import type { PublicFormField, PublicIntakeForm } from '../lib/ops/api-public';

/**
 * /inquire — the public, form_definitions-driven intake page.
 *
 * Renders the ACTIVE CLIENT intake forms (anon read policy, 20260702010000)
 * and submits the visitor's answers into the staff intake queue
 * (intake_submissions anon INSERT). Staff review at /app/ops/intake.
 *
 * Signature/system fields are omitted: an inquiry is not a signing surface —
 * the client acknowledgment happens later on the generated contract.
 */

/** Payload keys we mine for the queue's contact_name column, in priority order. */
const NAME_KEYS = ['full_legal_name', 'full_name', 'client_name', 'participant_name'];

const isAnswerable = (f: PublicFormField) => f.type !== 'signature' && f.type !== 'system';

function inputTypeFor(field: PublicFormField): string {
  switch (field.type) {
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'date': return 'date';
    default: return 'text';
  }
}

export default function Inquire() {
  const [forms, setForms] = useState<PublicIntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listPublicIntakeForms()
      .then((f) => { if (active) setForms(f); })
      .catch(() => { if (active) setLoadError('We could not load the inquiry forms. Please email or call us instead.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const form = useMemo(() => forms.find((f) => f.form_key === formKey) ?? null, [forms, formKey]);

  function setValue(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function toggleOption(key: string, option: string) {
    setValues((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [key]: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    // only answered fields travel; empty strings / empty checkbox sets are noise
    const payload: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(values)) {
      if (Array.isArray(v) ? v.length > 0 : v.trim() !== '') {
        payload[k] = Array.isArray(v) ? v : v.trim();
      }
    }
    const nameKey = NAME_KEYS.find((k) => typeof payload[k] === 'string');
    const contactName = nameKey ? (payload[nameKey] as string) : null;
    const contactEmail = typeof payload['email'] === 'string' ? (payload['email'] as string) : null;

    setSending(true);
    setError(null);
    try {
      await submitIntakeSubmission({
        form_key: form.form_key,
        payload,
        contact_name: contactName,
        contact_email: contactEmail,
      });
      setSent(true);
    } catch {
      setError('Something went wrong sending your inquiry. Please try again, or email or call us directly.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Seo
        title="Inquire — French Heritage Equestrian"
        description="Tell us about your horse, your goals, or the service you're looking for."
        path="/inquire"
        noindex
      />
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="container-site max-w-4xl">
          <p className="eyebrow mb-2">Inquire</p>
          <h1 className="heading-section text-green-800 mb-4">Tell us what you're looking for.</h1>
          <p className="body-text text-secondary mb-10 max-w-2xl">
            Pick the form that fits and share as much as you'd like. It lands directly with our
            team — we read every submission ourselves.
          </p>

          {loading ? (
            <p className="body-text text-muted">Loading forms…</p>
          ) : loadError ? (
            <p className="form-error" role="alert">{loadError}</p>
          ) : sent ? (
            <div className="bg-green-50 border border-green-200 p-8">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-2">Your inquiry just landed.</h2>
              <p className="body-text text-sm">
                One of us will review it and be in touch shortly. Talk soon.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8 max-w-xl">
                <label className="form-label" htmlFor="inquire-form">What can we help with? *</label>
                <select
                  id="inquire-form"
                  className="form-input"
                  value={formKey}
                  onChange={(e) => { setFormKey(e.target.value); setValues({}); setError(null); }}
                >
                  <option value="">Choose a form…</option>
                  {forms.map((f) => (
                    <option key={f.form_key} value={f.form_key}>{f.title}</option>
                  ))}
                </select>
                {form?.purpose && <p className="form-hint mt-2">{form.purpose}</p>}
              </div>

              {form && (
                <form onSubmit={submit} className="bg-white border border-green-800/10 p-8">
                  {form.schema.sections.map((section, si) => {
                    const fields = section.fields.filter(isAnswerable);
                    if (fields.length === 0) return null;
                    return (
                      <div key={`${si}-${section.heading}`} className={si > 0 ? 'mt-8' : ''}>
                        <h2 className="eyebrow mb-4">{section.heading}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          {fields.map((field) => {
                            const id = `f-${si}-${field.key}`;
                            if (field.type === 'checkbox' && field.options?.length) {
                              const selected = Array.isArray(values[field.key])
                                ? (values[field.key] as string[])
                                : [];
                              return (
                                <fieldset key={id} className="sm:col-span-2">
                                  <legend className="form-label">{field.label}</legend>
                                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
                                    {field.options.map((option) => (
                                      <label key={option} className="inline-flex items-center gap-2 text-sm text-secondary">
                                        <input
                                          type="checkbox"
                                          checked={selected.includes(option)}
                                          onChange={() => toggleOption(field.key, option)}
                                        />
                                        {option}
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>
                              );
                            }
                            return (
                              <div key={id}>
                                <label className="form-label" htmlFor={id}>{field.label}</label>
                                <input
                                  id={id}
                                  type={inputTypeFor(field)}
                                  className="form-input"
                                  value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
                                  onChange={(e) => setValue(field.key, e.target.value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {error && <p className="form-error mt-6" role="alert">{error}</p>}
                  <button type="submit" disabled={sending} className="btn-primary mt-8 w-full justify-center">
                    {sending ? 'Sending…' : 'Send my inquiry'}
                    {!sending && <ArrowRight size={16} />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
