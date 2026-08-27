import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { menuVocabularyValues, setMenuValue, type MenuSummary, type MenuValue } from '../../../lib/admin';
import { addLookupValue } from '../../../lib/api';
import { toErrorMessage } from '../../../lib/ops/errors';

/**
 * A SHARED LIST — THE ONE THING THAT KEEPS A FLAT ROW, AND WHY.
 *
 * TASK-SURFACEEDITOR §4: *"A flat list stays useful only as the fallback for a
 * vocabulary with no single surface to render."* These five are exactly that.
 * Horse breed, colour, markings, registration organisation and passport country
 * are used by the horse record, the horse intake form AND the contracts — there
 * is no one surface to open them on, because they appear on several. Every other
 * menu in the app now lives on the form or the document it belongs to.
 *
 * ⚠️ RETIRING IS SWITCHING OFF, NEVER DELETING: `horses.breed` and `horses.color`
 * are foreign keys and records already carry these codes. An inactive value
 * leaves every dropdown and stays valid where it is already used (D32).
 */
export function SharedListSurface({ menu, onError }: { menu: MenuSummary; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<MenuValue[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    menuVocabularyValues(menu.menu_key)
      .then((v) => { setValues(v); setDraft(Object.fromEntries(v.map((x) => [x.code, x.display_name]))); })
      .catch((e) => onError(toErrorMessage(e, 'Could not load that list.')));
  }, [menu.menu_key, onError]);

  useEffect(() => { if (open) load(); }, [open, load]);

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

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-cream-100/50 focus-ring">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-green-900 truncate">{menu.label}</span>
          <span className="block text-[12px] text-muted truncate mt-0.5">
            {menu.total} value{menu.total === 1 ? '' : 's'}
            {menu.active < menu.total && ` · ${menu.total - menu.active} switched off`}
            {' · '}{menu.used_by}
          </span>
        </span>
        {open ? <ChevronDown size={17} className="text-muted shrink-0" /> : <ChevronRight size={17} className="text-muted shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-green-800/10 px-5 py-4">
          {values === null ? <p className="text-sm text-muted">Loading…</p> : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
