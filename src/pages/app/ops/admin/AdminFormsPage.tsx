import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, History, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import {
  adminFormDefinitions, setFormRequired, addFormField, editFormField, removeFormField,
  formVersionList, formVersionAt, restoreFormVersion,
  type AdminFormDefinition, type FormVersion, type FormVersionDetail,
} from '../../../../lib/admin';
import { Modal } from '../../../../components/ops/kit/Modal';
import { formatDate } from '../../../../lib/formatDateTime';
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
 * forms the version-on-change documents already had, so nothing is orphaned. The
 * MENUS a field offers are edited on the Menus page, which covers these 119 lists
 * and the 5 shared vocabularies together.
 *
 * ⚠️ THE VERSION LIST IS REACHED FROM THE FORM (TASK-VERSIONSPINE, owner
 * 2026-08-26) — "a version list that i can click to see from the page im editing
 * the thing on". History opens a modal; a row opens that version; from there it is
 * restored, or edited into a superseding one.
 *
 * ⚠️ RESTORE MINTS A NEW VERSION. Restoring v1 when v3 exists produces v4 stamped
 * "from v1"; v2 and v3 stay in the list and stay readable. Nothing here can lower
 * a version number or remove a row — the database refuses UPDATE and DELETE on the
 * history outright, so this screen cannot do it even by accident.
 *
 * ⚠️ EDITING AN OLD VERSION IS ONE ACT, NOT TWO. "Edit from this version" puts the
 * card on that version's shape and every mutator carries p_from_version, so the
 * change is applied to THAT version and the result records where it came from —
 * v3 · from v1, not v3 with a silent gap.
 *
 * Forms are the proving ground, not the destination: TASK-SURFACEEDITOR collapses
 * this screen, the template wording editor and the menus screen into one editor.
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


/** "v3 · from v1" — the number says WHEN, the parent says WHAT IT CAME FROM.
 *  A null parent is the ordinary case (edited from the one before), so it says
 *  nothing rather than adding noise to every row. */
function versionLabel(v: { version: number; parent_version: number | null }): string {
  return v.parent_version === null ? `v${v.version}` : `v${v.version} · from v${v.parent_version}`;
}

/** One row in the version list. Module scope — a component defined inside a
 *  render is a new type every keystroke (2026-08-25). */
function VersionListRow({
  v, onOpen,
}: { v: FormVersion; onOpen: (version: number) => void }) {
  return (
    <button type="button" onClick={() => onOpen(v.version)}
      className={`w-full text-left flex items-baseline gap-3 px-4 py-3 rounded-lg border focus-ring ${
        v.is_current ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-cream-100/60'
      }`}>
      <span className="text-[13.5px] font-medium text-green-900 shrink-0">{versionLabel(v)}</span>
      {v.is_current && <span className="text-[10px] uppercase tracking-wide text-green-800 shrink-0">Live</span>}
      <span className="text-[12px] text-muted flex-1 min-w-0 truncate">
        {v.edited_by_name ?? 'author not recorded'} · {formatDate(v.created_at)}
      </span>
    </button>
  );
}

/** The retained version, shown as the form it was. Read-only on purpose: this is
 *  the "fully retained copy" the owner keeps, and the two ways out of it are
 *  restore and edit-from. */
function VersionPreview({ detail }: { detail: FormVersionDetail }) {
  return (
    <div>
      {detail.schema.sections.map((section, si) => {
        const fields = section.fields.filter((f) => f.type !== 'signature' && f.type !== 'system');
        if (fields.length === 0) return null;
        return (
          <div key={`${si}-${section.heading}`} className={si > 0 ? 'mt-4' : ''}>
            <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-2">{section.heading}</p>
            <ul className="grid sm:grid-cols-2 gap-1.5">
              {fields.map((f) => (
                <li key={f.key}
                  className={`text-[13px] px-3 py-2 rounded-lg border ${
                    f.required ? 'border-green-700 bg-green-50 text-green-900' : 'border-green-800/15 text-secondary'
                  }`}>
                  {f.label}
                  <span className="text-[10.5px] text-muted ml-1">· {f.type}</span>
                  {f.options && <span className="text-[10px] text-gold-800 ml-1">({f.options.length})</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function VersionsModal({
  formKey, formTitle, open, onClose, onEditFrom, onChanged, onError,
}: {
  formKey: string;
  formTitle: string;
  open: boolean;
  onClose: () => void;
  onEditFrom: (version: number) => void;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [versions, setVersions] = useState<FormVersion[] | null>(null);
  const [detail, setDetail] = useState<FormVersionDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setVersions(await formVersionList(formKey)); }
    catch (e) { onError(toErrorMessage(e, 'Could not load the version list.')); }
  }, [formKey, onError]);

  useEffect(() => {
    if (!open) { setDetail(null); setVersions(null); return; }
    void load();
  }, [open, load]);

  async function openVersion(version: number) {
    try { setDetail(await formVersionAt(formKey, version)); }
    catch (e) { onError(toErrorMessage(e, 'Could not open that version.')); }
  }

  async function restore(version: number) {
    setBusy(true);
    try {
      const minted = await restoreFormVersion(formKey, version);
      onChanged();
      setDetail(null);
      await load();
      onError(`Restored v${version} as v${minted} · from v${version}. v${version} and everything after it are still in the list.`);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not restore that version.'));
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={detail ? `${formTitle} — ${versionLabel(detail)}` : `${formTitle} — versions`}
      footer={detail ? (
        <>
          <button type="button" className="text-sm text-muted underline" onClick={() => setDetail(null)}>
            Back to the list
          </button>
          {!detail.is_current && (
            <>
              <button type="button" className="btn-outline-gold text-sm" disabled={busy}
                onClick={() => { onEditFrom(detail.version); onClose(); }}>
                <Pencil size={14} /> Edit from this version
              </button>
              <button type="button" className="btn-primary text-sm" disabled={busy}
                onClick={() => void restore(detail.version)}>
                <RotateCcw size={14} /> Restore this version
              </button>
            </>
          )}
        </>
      ) : (
        <button type="button" className="text-sm text-muted underline" onClick={onClose}>Close</button>
      )}>
      {detail ? (
        <>
          <p className="text-[12.5px] text-muted mb-4">
            {detail.is_current
              ? 'This is the live version — it is what people filling in this form see.'
              : 'A fully retained copy, used nowhere. Restoring it mints a NEW version carrying this content; ' +
                'nothing above it is removed. Editing from it mints a new version stamped “from v' + detail.version + '”.'}
          </p>
          <VersionPreview detail={detail} />
        </>
      ) : versions === null ? (
        <p className="text-sm text-muted">Loading versions…</p>
      ) : (
        <>
          <p className="text-[12.5px] text-muted mb-3">
            Every save mints the next number. Nothing is ever overwritten or removed —
            open a version to read it, restore it, or edit it into a new one.
          </p>
          <div className="flex flex-col gap-1.5">
            {versions.map((v) => <VersionListRow key={v.version} v={v} onOpen={(n) => void openVersion(n)} />)}
          </div>
        </>
      )}
    </Modal>
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
  const [version, setVersion] = useState(form.version);
  const [saved, setSaved] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  /** The version the card is editing FROM, when the person opened an older one.
   *  null is the ordinary case: editing the live version. */
  const [editingFrom, setEditingFrom] = useState<number | null>(null);

  /** Re-read the live form. Also leaves edit-from mode: once a save has landed,
   *  the thing that was edited from v1 IS the live version, so staying pinned to
   *  v1 would stamp the next change with a parent it did not come from. */
  const refresh = useCallback(async () => {
    const fresh = (await adminFormDefinitions()).find((x) => x.form_key === form.form_key);
    if (fresh) { setSchema(fresh.schema); setVersion(fresh.version); }
    setEditingFrom(null);
  }, [form.form_key]);

  /** Every field mutation is a server round-trip that MINTS A VERSION, so the
   *  page re-reads rather than patching local state — the schema it shows must be
   *  the one that was just written, not a guess at it. The version it was edited
   *  from rides along, so the new version records where it came from. */
  async function mutate(fn: (from: number | undefined) => Promise<void>) {
    setBusy(true);
    try {
      await fn(editingFrom ?? undefined);
      await refresh();
      setEditingKey(null);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not change that field.'));
    } finally { setBusy(false); }
  }

  /** Open an older version IN the card, so the next change is applied to it. */
  async function beginEditFrom(v: number) {
    try {
      const detail = await formVersionAt(form.form_key, v);
      if (!detail) { onError(`This form has no version ${v}.`); return; }
      setSchema(detail.schema);
      setEditingFrom(v);
      setEditingKey(null);
      setOpen(true);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not open that version.'));
    }
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
      await setFormRequired(form.form_key, flat, editingFrom ?? undefined);
      setSaved(true);
      await refresh();
    } catch { /* stays visibly unsaved */ }
  }

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <div className="w-full flex items-center gap-2 px-5 py-4">
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 flex items-center justify-between text-left focus-ring rounded">
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-green-900">{form.title}</span>
            <span className="block text-[12px] text-muted mt-0.5">
              {requiredCount} of {fieldCount} fields required{form.purpose ? ` · ${form.purpose}` : ''}
            </span>
          </span>
          {open ? <ChevronDown size={17} className="text-muted ml-2" /> : <ChevronRight size={17} className="text-muted ml-2" />}
        </button>
        <span className="flex items-center gap-2 shrink-0">
          {!saved && <span className="text-xs text-gold-800">Saving…</span>}
          <span className="text-[11px] font-medium text-green-800 bg-green-50 border border-green-700/30 rounded px-1.5 py-0.5">
            v{version}
          </span>
          <button type="button" onClick={() => setVersionsOpen(true)}
            className="text-muted hover:text-green-800 focus-ring rounded p-1"
            aria-label={`Version history for ${form.title}`} title="Version history">
            <History size={15} />
          </button>
        </span>
      </div>
      <VersionsModal formKey={form.form_key} formTitle={form.title} open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        onEditFrom={(v) => void beginEditFrom(v)}
        onChanged={() => void refresh()}
        onError={onError} />
      {open && (
        <div className="border-t border-green-800/10 px-5 py-4">
          {editingFrom !== null && (
            <div className="mb-4 rounded-lg border border-gold-500/50 bg-gold-50 px-4 py-3">
              <p className="text-[13px] text-green-900">
                Editing from <strong>v{editingFrom}</strong>. The next change you save mints
                <strong> v{version + 1} · from v{editingFrom}</strong> — it will not contain anything
                added after v{editingFrom}. v{version} stays in the list and stays readable.
              </p>
              <button type="button" className="text-[12px] text-muted underline mt-1"
                onClick={() => void refresh()}>
                Go back to the live version
              </button>
            </div>
          )}
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
                      onSave={(patch) => void mutate((from) => editFormField(form.form_key, f.key, {
                        label: patch.label, type: patch.type,
                        new_key: patch.new_key !== f.key ? patch.new_key : undefined,
                      }, from))} />
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
                        onClick={() => { if (window.confirm(`Remove “${f.label}” from this form?\n\nAnswers already collected keep their meaning — they stay readable against the version of the form they were collected under.`)) void mutate((from) => removeFormField(form.form_key, f.key, from)); }}>
                        <Trash2 size={13} /></button>
                    </div>
                  )))}
                  <AddFieldRow busy={busy}
                    onAdd={(nf) => void mutate((from) => addFormField(form.form_key, section.heading, nf, from))} />
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
        save immediately and the public forms enforce them. Each save mints the next
        version — open a form's history to read, restore or supersede an earlier one.
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
