import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import {
  adminFormDefinitions, setFormRequired, type AdminFormDefinition,
} from '../../../../lib/admin';

/**
 * FORMS (/app/ops/admin/forms) — see and decide which fields on the intake
 * forms users see are REQUIRED. Every active form_definitions schema, expanded
 * to its sections and fields with a required checkbox per field; toggles save
 * immediately (set_form_required) and the public renderer enforces them
 * (required inputs + gated checkbox groups). Signature/system rows aren't
 * user-answerable, so they carry no toggle.
 *
 * The two fixed system forms are listed read-only at the bottom so the whole
 * "what users must fill in" picture lives on one page.
 */

const AUDIENCE_LABEL: Record<string, string> = { CLIENT: 'Client-facing', STAFF: 'Staff' };

function FormCard({ form }: { form: AdminFormDefinition }) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState(form.schema);
  const [saved, setSaved] = useState(true);

  const requiredCount = schema.sections.flatMap((s) => s.fields).filter((f) => f.required).length;
  const fieldCount = schema.sections.flatMap((s) => s.fields)
    .filter((f) => f.type !== 'signature' && f.type !== 'system').length;

  async function toggle(sectionIdx: number, fieldKey: string) {
    const next = {
      sections: schema.sections.map((s, i) => i !== sectionIdx ? s : {
        ...s,
        fields: s.fields.map((f) => f.key !== fieldKey ? f : { ...f, required: !f.required }),
      }),
    };
    setSchema(next); setSaved(false);
    const flat: Record<string, boolean> = {};
    for (const s of next.sections) for (const f of s.fields) flat[f.key] = f.required === true;
    try {
      await setFormRequired(form.form_key, flat);
      setSaved(true);
    } catch { /* stays visibly unsaved */ }
  }

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-cream-100/50 focus-ring">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-green-900">{form.title}</span>
          <span className="block text-[12px] text-muted mt-0.5">
            {requiredCount} of {fieldCount} fields required{form.purpose ? ` · ${form.purpose}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!saved && <span className="text-xs text-gold-800">Saving…</span>}
          {open ? <ChevronDown size={17} className="text-muted" /> : <ChevronRight size={17} className="text-muted" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-green-800/10 px-5 py-4">
          {schema.sections.map((section, si) => {
            const fields = section.fields.filter((f) => f.type !== 'signature' && f.type !== 'system');
            if (fields.length === 0) return null;
            return (
              <div key={`${si}-${section.heading}`} className={si > 0 ? 'mt-5' : ''}>
                <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-2">{section.heading}</p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {fields.map((f) => (
                    <label key={f.key}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border cursor-pointer ${
                        f.required ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-green-50/50'
                      }`}>
                      <input type="checkbox" className="accent-green-700 w-[17px] h-[17px]"
                        checked={f.required === true} onChange={() => void toggle(si, f.key)} />
                      <span className={`text-[13.5px] leading-snug ${f.required ? 'text-green-900 font-medium' : 'text-secondary'}`}>
                        {f.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SYSTEM_FORMS = [
  {
    title: 'Onboarding — Your details (system form)',
    note: 'Fixed requirements: phone, date of birth, street, city, state, zip, emergency contact #1 name & phone (plus minor name/DOB when a minor is toggled). Changing these means changing what counts as a complete profile — tell Claude which to relax.',
  },
  {
    title: 'Horse intake form (system form)',
    note: 'Fixed requirement: registered name (the record anchor). Microchip is strongly encouraged (it powers duplicate detection) but not required. Everything else optional.',
  },
];

export default function AdminFormsPage() {
  useDocumentTitle('Forms');
  const [forms, setForms] = useState<AdminFormDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFormDefinitions().then(setForms).catch(() => setError('Could not load the forms.'));
  }, []);

  const audiences = Array.from(new Set((forms ?? []).map((f) => f.audience)));

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Forms</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Every intake form users see, with a required checkbox per field. Toggles
        save immediately and the public forms enforce them.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {forms === null && !error && <p className="text-sm text-muted">Loading forms…</p>}

      {audiences.map((aud) => (
        <div key={aud} className="mb-8">
          <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-3">
            {AUDIENCE_LABEL[aud] ?? aud}
          </p>
          <div className="flex flex-col gap-3">
            {(forms ?? []).filter((f) => f.audience === aud).map((f) => (
              <FormCard key={f.form_key} form={f} />
            ))}
          </div>
        </div>
      ))}

      {forms !== null && (
        <div className="mb-4">
          <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-3">System forms (fixed)</p>
          <div className="flex flex-col gap-3">
            {SYSTEM_FORMS.map((f) => (
              <div key={f.title} className="bg-cream-100/60 border border-green-800/10 rounded-xl px-5 py-4">
                <p className="text-[15px] font-medium text-green-900">{f.title}</p>
                <p className="text-[12.5px] text-muted mt-1">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
