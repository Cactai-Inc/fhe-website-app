import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  adminFormDefinitions, setFormRequired, addFormField, editFormField, removeFormField,
  setFormFieldOptions, formVersionList, formVersionAt, restoreFormVersion,
  type AdminFormDefinition, type FormVersionDetail,
} from '../../../lib/admin';
import { toErrorMessage } from '../../../lib/ops/errors';
import { VersionChip, VersionsModal, type VersionSource } from './SurfaceVersions';

/**
 * A FORM, RENDERED AS IT APPEARS, EDITABLE IN PLACE.
 *
 * Owner, 2026-08-26: *"if its a menu option on the horse intake form, clicking on
 * the horse intake form from the entry page opens the horse intake form and then
 * i can edit anything on the form, including the menu items."*
 *
 * ⚠️ THE MENU IS ON THE FIELD NOW. Until this thread, a form field's option list
 * was edited on a different screen — /app/ops/admin/menus, a flat inventory of
 * 124 lists where "Front boots / wraps" sat with no indication that it belongs to
 * the equipment question on a lease. The list is unchanged; where you reach it is
 * the whole change (CR-74: do not move someone to edit something they are already
 * looking at).
 *
 * Every mutation mints a version through TASK-VERSIONSPINE's one save path, and
 * every one carries the version being edited FROM, so opening v1 and changing a
 * label gives v3 · from v1 rather than v3 with a silent gap.
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

/** THE MENU, ON THE FIELD IT BELONGS TO.
 *
 *  Edits are local until Save, so adding four options is ONE version rather than
 *  four. `set_form_field_options` replaces the whole list, which is why the whole
 *  list is what this holds.
 *
 *  ⚠️ A FORM OPTION IS A BARE STRING — there is no code/label pair here, unlike a
 *  contract menu. So renaming one changes the words AND the value that future
 *  answers are stored as; answers already collected keep their meaning because
 *  they resolve against the retained form version. That is the same guarantee the
 *  flat menus screen shipped with, stated where the person editing can read it. */
function FieldMenuEditor({
  options, onSave, onCancel, busy,
}: {
  options: string[];
  onSave: (next: string[]) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<string[]>(options);
  const [adding, setAdding] = useState('');
  const dirty = draft.length !== options.length || draft.some((o, i) => o !== options[i]);

  function add() {
    const v = adding.trim();
    if (!v) return;
    setDraft((d) => [...d, v]);
    setAdding('');
  }

  return (
    <div className="sm:col-span-2 xl:col-span-3 border border-gold-500/40 bg-gold-50 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted mb-2">The choices this field offers</p>
      <div className="flex flex-col gap-1.5 mb-2">
        {draft.map((o, i) => (
          <div key={`${i}-${o}`} className="flex items-center gap-2">
            <input className="form-input text-sm flex-1" value={o}
              aria-label={`Option ${i + 1}`}
              onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label={`Remove option ${o}`}
              className="text-muted hover:text-red-700 focus-ring rounded p-1"
              onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
              <X size={14} />
            </button>
          </div>
        ))}
        {draft.length === 0 && <p className="text-[12px] text-muted">This field has no choices left — add at least one.</p>}
      </div>
      <div className="flex items-center gap-2">
        <input className="form-input text-sm flex-1" placeholder="Add a choice…" value={adding}
          aria-label="Add a choice" onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-outline-gold text-xs" disabled={!adding.trim()} onClick={add}>
          <Plus size={13} /> Add
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button type="button" className="btn-primary text-xs"
          disabled={busy || !dirty || draft.some((o) => !o.trim()) || draft.length === 0}
          onClick={() => onSave(draft.map((o) => o.trim()))}>
          Save menu
        </button>
        <button type="button" className="text-xs text-muted underline" onClick={onCancel}>Cancel</button>
        <p className="text-[11px] text-muted w-full">
          Saving mints the next version of this form. Answers already collected keep their
          meaning — they resolve against the version of the form they were collected under.
        </p>
      </div>
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

/** The retained version, shown as the form it was. Read-only on purpose: this is
 *  the "fully retained copy" the owner keeps, and the two ways out of it are
 *  restore and edit-from. */
function FormVersionPreview({ detail }: { detail: FormVersionDetail }) {
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

export function FormSurface({ form, onError }: { form: AdminFormDefinition; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState(form.schema);
  const [version, setVersion] = useState(form.version);
  const [saved, setSaved] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  /** The version the card is editing FROM, when the person opened an older one.
   *  null is the ordinary case: editing the live version. */
  const [editingFrom, setEditingFrom] = useState<number | null>(null);

  useEffect(() => { setSchema(form.schema); setVersion(form.version); }, [form.schema, form.version]);

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
      setMenuKey(null);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not change that field.'));
    } finally { setBusy(false); }
  }

  /** Open an older version IN the card, so the next change is applied to it. */
  const beginEditFrom = useCallback(async (v: number) => {
    try {
      const detail = await formVersionAt(form.form_key, v);
      if (!detail) { onError(`This form has no version ${v}.`); return; }
      setSchema(detail.schema);
      setEditingFrom(v);
      setEditingKey(null);
      setMenuKey(null);
      setOpen(true);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not open that version.'));
    }
  }, [form.form_key, onError]);

  const source: VersionSource<FormVersionDetail> = {
    list: useCallback(() => formVersionList(form.form_key), [form.form_key]),
    at: useCallback((v: number) => formVersionAt(form.form_key, v), [form.form_key]),
    restore: useCallback((v: number) => restoreFormVersion(form.form_key, v), [form.form_key]),
    preview: (d) => <FormVersionPreview detail={d} />,
    editFrom: (v) => void beginEditFrom(v),
  };

  const requiredCount = schema.sections.flatMap((s) => s.fields).filter((f) => f.required).length;
  const fieldCount = schema.sections.flatMap((s) => s.fields)
    .filter((f) => f.type !== 'signature' && f.type !== 'system').length;

  async function toggle(sectionIdx: number, fieldKey: string) {
    const next = {
      sections: schema.sections.map((s, i) => (i !== sectionIdx ? s : {
        ...s,
        fields: s.fields.map((f) => (f.key !== fieldKey ? f : { ...f, required: !f.required })),
      })),
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
        <VersionChip version={version} label={form.title} onOpen={() => setVersionsOpen(true)} />
      </div>
      <VersionsModal title={form.title} open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        source={source}
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
                  {fields.map((f) => {
                    if (editingKey === f.key) {
                      return (
                        <FieldEditRow key={f.key} busy={busy}
                          field={{ key: f.key, label: f.label, type: f.type }}
                          onCancel={() => setEditingKey(null)}
                          onSave={(patch) => void mutate((from) => editFormField(form.form_key, f.key, {
                            label: patch.label,
                            type: patch.type,
                            new_key: patch.new_key !== f.key ? patch.new_key : undefined,
                          }, from))} />
                      );
                    }
                    if (menuKey === f.key) {
                      return (
                        <FieldMenuEditor key={f.key} busy={busy} options={f.options ?? []}
                          onCancel={() => setMenuKey(null)}
                          onSave={(next) => void mutate((from) => setFormFieldOptions(form.form_key, f.key, next, from))} />
                      );
                    }
                    return (
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
                        </span>
                        {f.options && (
                          <button type="button" disabled={busy}
                            className="text-[10.5px] text-gold-800 hover:text-gold-900 underline focus-ring rounded shrink-0"
                            onClick={() => { setMenuKey(f.key); setEditingKey(null); }}>
                            {f.options.length} choice{f.options.length === 1 ? '' : 's'}
                          </button>
                        )}
                        <button type="button" aria-label={`Edit ${f.label}`} disabled={busy}
                          className="text-muted hover:text-green-800 focus-ring rounded p-0.5"
                          onClick={() => { setEditingKey(f.key); setMenuKey(null); }}><Pencil size={13} /></button>
                        <button type="button" aria-label={`Remove ${f.label}`} disabled={busy}
                          className="text-muted hover:text-red-700 focus-ring rounded p-0.5"
                          onClick={() => { if (window.confirm(`Remove “${f.label}” from this form?\n\nAnswers already collected keep their meaning — they stay readable against the version of the form they were collected under.`)) void mutate((from) => removeFormField(form.form_key, f.key, from)); }}>
                          <Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                  <AddFieldRow busy={busy}
                    onAdd={(nf) => void mutate((from) => addFormField(form.form_key, section.heading, nf, from))} />
                </div>
              </div>
            );
          })}
          {!saved && <p className="text-xs text-gold-800 mt-3">Saving…</p>}
        </div>
      )}
    </div>
  );
}
