import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react';
import { PageLayout } from '../../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../../lib/hooks';
import { toErrorMessage } from '../../../../lib/ops/errors';
import {
  menuInventory, menuVocabularyValues, setMenuValue, setFormFieldOptions,
  adminFormDefinitions, type MenuSummary, type MenuValue,
} from '../../../../lib/admin';
import { addLookupValue } from '../../../../lib/api';

/**
 * MENUS (/app/ops/admin/menus) — every dropdown list in the app, and its contents.
 *
 * Owner, 2026-08-25: *"i need a way to see and edit all of the menu contents
 * throughout the app, i have a form editor but the only thing it lets me do is
 * toggle on and off whether a field is required."*
 *
 * ⚠️ THE SMALL HALF WAS THE HALF THAT HAD A PAGE. Five VOCABULARIES (horse breed,
 * colour, markings, registration organisation, passport country) are shared by the
 * horse record, horse intake and the contracts. Another **119 option lists** live
 * inside `form_definitions.schema`, one per field that offers choices, across all
 * 28 intake and engagement forms — and those had no editor at all. `/app/ops/lookups`
 * looks like it covers this and does not: it is the SUGGESTION QUEUE, showing what
 * people typed under "Other", never the lists themselves.
 *
 * WHAT THIS DOES NOT DO, AND WHY. It does not add, remove or rename a form FIELD.
 * A field's `key` is what submitted answers are filed under, so renaming or
 * removing one orphans real data — that needs a ruling on what happens to the
 * existing answers, not a text box. Editing a field's OPTIONS touches no key, which
 * is why it is here.
 */

/** Retiring a value is switching it OFF, never deleting it: `horses.breed` and
 *  `horses.color` are foreign keys, and records already carry these codes. An
 *  inactive value leaves every dropdown and stays valid where it is already used. */
function VocabularyEditor({ menu, onError }: { menu: MenuSummary; onError: (m: string) => void }) {
  const [values, setValues] = useState<MenuValue[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    menuVocabularyValues(menu.menu_key)
      .then((v) => { setValues(v); setDraft(Object.fromEntries(v.map((x) => [x.code, x.display_name]))); })
      .catch((e) => onError(toErrorMessage(e, 'Could not load that menu.')));
  }, [menu.menu_key, onError]);
  useEffect(load, [load]);

  async function rename(code: string) {
    const name = (draft[code] ?? '').trim();
    const current = values?.find((v) => v.code === code);
    if (!name || !current || name === current.display_name) return;
    try { await setMenuValue(menu.menu_key, code, { display_name: name }); load(); }
    catch (e) { onError(toErrorMessage(e, 'Could not rename that value.')); }
  }
  async function toggle(v: MenuValue) {
    try { await setMenuValue(menu.menu_key, v.code, { active: !v.active }); load(); }
    catch (e) { onError(toErrorMessage(e, 'Could not change that value.')); }
  }
  async function add() {
    const name = adding.trim();
    if (!name || busy) return;
    setBusy(true);
    try { await addLookupValue(menu.menu_key, name); setAdding(''); load(); }
    catch (e) { onError(toErrorMessage(e, 'Could not add that value.')); }
    finally { setBusy(false); }
  }

  if (!values) return <p className="text-sm text-muted px-5 pb-4">Loading…</p>;
  return (
    <div className="px-5 pb-5">
      <div className="flex flex-col gap-1.5 mb-3">
        {values.map((v) => (
          <div key={v.code} className="flex items-center gap-2">
            <input
              className={`form-input text-sm flex-1 ${v.active ? '' : 'opacity-50 line-through'}`}
              value={draft[v.code] ?? ''}
              aria-label={`${v.display_name} — name`}
              onChange={(e) => setDraft((p) => ({ ...p, [v.code]: e.target.value }))}
              onBlur={() => void rename(v.code)}
            />
            <code className="text-[10px] text-muted w-40 truncate" title="Stored code — never changes, records depend on it">
              {v.code}
            </code>
            <button type="button" onClick={() => void toggle(v)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border focus-ring ${v.active
                ? 'text-green-800 border-green-800/25 hover:bg-green-50'
                : 'text-muted border-green-800/15 hover:bg-cream-100'}`}>
              {v.active ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input className="form-input text-sm flex-1" placeholder="Add a value…" value={adding}
          aria-label="Add a value" onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }} />
        <button type="button" className="btn-outline-gold text-xs" disabled={busy || !adding.trim()}
          onClick={() => void add()}>
          <Plus size={13} /> Add
        </button>
      </div>
      <p className="text-[11px] text-muted mt-2">
        Switching a value off removes it from every dropdown and leaves it valid on records
        that already use it. Renaming changes the words everywhere, including in contracts;
        the stored code never changes, because records point at it.
      </p>
    </div>
  );
}

/** A form field's option list — one option per line, saved as a whole. */
function FormOptionsEditor({ menu, onError }: { menu: MenuSummary; onError: (m: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);

  /* The inventory row carries the COUNT, not the values — it spans two storage
     shapes and returning both bodies would make it heavy for a page that opens
     one menu at a time. The values come from the same forms endpoint the
     required-toggles page reads. */
  useEffect(() => {
    let active = true;
    adminFormDefinitions()
      .then((forms) => {
        if (!active) return;
        const field = forms.find((f) => f.form_key === menu.form_key)
          ?.schema.sections.flatMap((s) => s.fields)
          .find((f) => f.key === menu.field_key);
        setText((field?.options ?? []).join('\n'));
      })
      .catch((e) => { if (active) onError(toErrorMessage(e, 'Could not load that menu.')); });
    return () => { active = false; };
  }, [menu.form_key, menu.field_key, onError]);

  async function save() {
    if (text === null || busy) return;
    const options = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (options.length === 0) { onError('A menu needs at least one option.'); return; }
    setBusy(true);
    try { await setFormFieldOptions(menu.form_key!, menu.field_key!, options); setSaved(true); }
    catch (e) { onError(toErrorMessage(e, 'Could not save that menu.')); }
    finally { setBusy(false); }
  }

  if (text === null) return <p className="text-sm text-muted px-5 pb-4">Loading…</p>;
  return (
    <div className="px-5 pb-5">
      <textarea
        className="form-input text-sm w-full resize-y font-mono" rows={Math.min(14, Math.max(4, text.split('\n').length + 1))}
        aria-label={`${menu.label} options, one per line`}
        value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} />
      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-muted">
          One option per line. The field itself — its name, its type, whether it’s required —
          is unchanged; only the choices are.
        </p>
        <button type="button" className="btn-primary text-xs" disabled={busy || saved}
          onClick={() => void save()}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save menu'}
        </button>
      </div>
    </div>
  );
}

function MenuCard({ menu, onError }: { menu: MenuSummary; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-cream-100/50 focus-ring">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-green-900 truncate">{menu.label}</span>
          <span className="block text-[11px] text-muted truncate">
            {menu.total} option{menu.total === 1 ? '' : 's'}
            {menu.source === 'vocabulary' && menu.active < menu.total && ` · ${menu.total - menu.active} switched off`}
            {' · '}{menu.used_by}
          </span>
        </span>
        {open ? <ChevronDown size={16} className="text-muted shrink-0" /> : <ChevronRight size={16} className="text-muted shrink-0" />}
      </button>
      {open && (menu.source === 'vocabulary'
        ? <VocabularyEditor menu={menu} onError={onError} />
        : <FormOptionsEditor menu={menu} onError={onError} />)}
    </div>
  );
}

export default function AdminMenusPage() {
  useDocumentTitle('Menus');
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    menuInventory()
      .then(setMenus)
      .catch((e) => setError(toErrorMessage(e, 'Could not load the menus.')))
      .finally(() => setLoading(false));
  }, []);

  // 124 menus is too many to scroll, so the page opens on a search box. Both
  // groups are alphabetical, per the owner's standing rule for lists.
  const { vocab, forms } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (m: MenuSummary) => !needle
      || m.label.toLowerCase().includes(needle)
      || m.used_by.toLowerCase().includes(needle);
    const shown = menus.filter(hit);
    return {
      vocab: shown.filter((m) => m.source === 'vocabulary'),
      forms: shown.filter((m) => m.source === 'form'),
    };
  }, [menus, q]);

  return (
    <PageLayout
      name="Menus"
      description="Every dropdown list in the app and what’s in it. Shared lists are used by the horse record, horse intake and the contracts; form menus belong to one field on one form."
    >
      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="form-input text-sm w-full pl-9" placeholder="Search menus…"
          aria-label="Search menus" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted">Loading…</p> : (
        <>
          <h2 className="font-serif text-green-800 mb-2">
            Shared lists <span className="text-xs text-muted font-sans">({vocab.length})</span>
          </h2>
          <div className="flex flex-col gap-2 mb-8">
            {vocab.map((m) => <MenuCard key={m.menu_key} menu={m} onError={setError} />)}
            {vocab.length === 0 && <p className="text-sm text-muted">No shared list matches that.</p>}
          </div>

          <h2 className="font-serif text-green-800 mb-2">
            Form menus <span className="text-xs text-muted font-sans">({forms.length})</span>
          </h2>
          <p className="text-[12px] text-muted mb-3">
            One per field that offers choices. To change whether a field is required, or to see
            a form as a whole, use Forms.
          </p>
          <div className="flex flex-col gap-2">
            {forms.map((m) => <MenuCard key={m.menu_key} menu={m} onError={setError} />)}
            {forms.length === 0 && <p className="text-sm text-muted">No form menu matches that.</p>}
          </div>
        </>
      )}
    </PageLayout>
  );
}
