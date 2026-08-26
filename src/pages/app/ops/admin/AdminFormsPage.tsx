import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import {
  adminFormDefinitions, setFormRequired, addFormField, editFormField, removeFormField,
  type AdminFormDefinition,
} from '../../../../lib/admin';
import { toErrorMessage } from '../../../../lib/ops/errors';

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
 *
 * ⚠️ FIELDS ARE EDITABLE HERE NOW (owner, 2026-08-25) — rename, retype, remove, add.
 * That was previously unsafe: `booking_forms.answers` is keyed by field `key`, and
 * `form_definitions` held ONE mutable row per form with `max(version)` still 1
 * across all 28, so renaming or removing a field detached real submitted answers.
 * `form_definition_versions` + `booking_forms.form_version` (20260825T1740) gave
 * forms the version-on-change documents already had, so every mutator snapshots the
 * outgoing shape first and nothing is orphaned. The MENUS a field offers are edited
 * on the Menus page, which covers these 119 lists and the 5 shared vocabularies
 * together.
 */

/** The field types the renderer understands. Kept beside the editor because
 *  changing a field to a type nothing renders is the one edit that silently breaks
 *  a form. */
const FIELD_TYPES = ['text', 'longtext', 'number', 'date', 'phone', 'email', 'select', 'checkbox', 'radio'];

/** One field's row in edit mode. Module scope on purpose — a component defined
 *  inside a render is a new type every keystroke, which is what made the horse
 *  record editor eat every character (2026-08-25). */
function FieldEditRow({
  field, onSave, onCancel, busy,
}: {
  field: { key: string; label: string; type: string };
  onSave: (patch: { label: string; type: string; new_key: string }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState(field.type);
  const [key, setKey] = useState(field.key);
  return (
    <div className="sm:col-span-2 xl:col-span-3 border border-gold-500/40 bg-gold-50 rounded-lg p-3 flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[160px]">
        <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">Label</span>
        <input className="form-input text-sm" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="w-36">
        <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">Type</span>
        <select className="form-input text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="w-44">
        <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">Key</span>
        <input className="form-input text-sm font-mono" value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <button type="button" className="btn-primary text-xs" disabled={busy}
        onClick={() => onSave({ label, type, new_key: key })}>Save</button>
      <button type="button" className="text-xs text-muted underline" onClick={onCancel}>Cancel</button>
      <p className="w-full text-[11px] text-muted">
        Renaming the key is safe — answers already collected stay readable against the
        form version they were collected under.
      </p>
    </div>
  );
}

/** The "add a field" row for one section. */
function AddFieldRow({ onAdd, busy }: { onAdd: (f: { key: string; label: string; type: string }) => void; busy: boolean }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const auto = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return (
    <div className="sm:col-span-2 xl:col-span-3 flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[160px]">
        <span className="sr-only">New field label</span>
        <input className="form-input text-sm" placeholder="Add a field…" value={label}
          onChange={(e) => setLabel(e.target.value)} />
      </label>
      <select className="form-input text-sm w-36" aria-label="New field type"
        value={type} onChange={(e) => setType(e.target.value)}>
        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button type="button" className="btn-outline-gold text-xs" disabled={busy || !auto}
        onClick={() => onAdd({ key: auto, label: label.trim(), type })}>
        <Plus size={13} /> Add
      </button>
    </div>
  );
}

const AUDIENCE_LABEL: Record<string, string> = {
  CLIENT: 'Client-facing',
  STAFF: 'Staff',
  // LESSONFORM: the audience the internal forms have always carried — the
  // engagement worksheets, and now the session activity form. The page already
  // rendered them (it maps over whatever audiences come back); they just showed
  // the raw enum as their heading.
  COMPANY: 'Internal — staff fill these in',
};

function FormCard({ form, onError }: { form: AdminFormDefinition; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState(form.schema);
  const [saved, setSaved] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Every field mutation is a server round-trip that VERSIONS the form, so the
   *  page re-reads rather than patching local state — the schema it shows must be
   *  the one that was just written, not a guess at it. */
  async function mutate(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      const fresh = (await adminFormDefinitions()).find((x) => x.form_key === form.form_key);
      if (fresh) setSchema(fresh.schema);
      setEditingKey(null);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not change that field.'));
    } finally { setBusy(false); }
  }

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
                  {fields.map((f) => (editingKey === f.key ? (
                    <FieldEditRow key={f.key} busy={busy}
                      field={{ key: f.key, label: f.label, type: f.type }}
                      onCancel={() => setEditingKey(null)}
                      onSave={(patch) => void mutate(() => editFormField(form.form_key, f.key, {
                        label: patch.label, type: patch.type,
                        new_key: patch.new_key !== f.key ? patch.new_key : undefined,
                      }))} />
                  ) : (
                    <div key={f.key}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border ${
                        f.required ? 'border-green-700 bg-green-50' : 'border-green-800/15'
                      }`}>
                      <input type="checkbox" className="accent-green-700 w-[17px] h-[17px] cursor-pointer"
                        aria-label={`${f.label} is required`}
                        checked={f.required === true} onChange={() => void toggle(si, f.key)} />
                      <span className={`text-[13.5px] leading-snug flex-1 min-w-0 truncate ${f.required ? 'text-green-900 font-medium' : 'text-secondary'}`}
                        title={`${f.label} · ${f.type}`}>
                        {f.label}
                        {f.options && <span className="text-[10px] text-gold-800 ml-1">({f.options.length})</span>}
                      </span>
                      <button type="button" aria-label={`Edit ${f.label}`} disabled={busy}
                        className="text-muted hover:text-green-800 focus-ring rounded p-0.5"
                        onClick={() => setEditingKey(f.key)}><Pencil size={13} /></button>
                      <button type="button" aria-label={`Remove ${f.label}`} disabled={busy}
                        className="text-muted hover:text-red-700 focus-ring rounded p-0.5"
                        onClick={() => { if (window.confirm(`Remove “${f.label}” from this form?\n\nAnswers already collected keep their meaning — they stay readable against the version of the form they were collected under.`)) void mutate(() => removeFormField(form.form_key, f.key)); }}>
                        <Trash2 size={13} /></button>
                    </div>
                  )))}
                  <AddFieldRow busy={busy}
                    onAdd={(nf) => void mutate(() => addFormField(form.form_key, section.heading, nf))} />
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
              <FormCard key={f.form_key} form={f} onError={setError} />
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
