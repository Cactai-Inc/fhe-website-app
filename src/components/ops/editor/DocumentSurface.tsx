import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { AsyncButton } from '../kit/AsyncButton';
import { Modal } from '../kit/Modal';
import { TokenPicker } from '../templates/TokenPicker';
import {
  templateEditorClauses, templateEditorTokens, saveClauseDraft, saveFlatDraft,
  discardTemplateDrafts, publishTemplate, flatTemplateBody,
  type TemplateEditorListRow, type TemplateEditorClause, type TemplateEditorToken,
  type FlatTemplateBody,
} from '../../../lib/templateEditor';
import {
  contractTemplateFields, contractMenuSetActive, contractMenuRelabel, contractMenuAddValue,
  contractMenuDependents, templateVersionList, templateVersionAt, restoreTemplateVersion,
  type ContractFieldDef, type TemplateVersionDetail,
} from '../../../lib/surfaceEditor';
import { toErrorMessage } from '../../../lib/ops/errors';
import { VersionChip, VersionsModal, type VersionSource } from './SurfaceVersions';

/**
 * A DOCUMENT TEMPLATE, RENDERED AS IT APPEARS, EDITABLE IN PLACE — its sections,
 * its clauses, and THE MENUS THE CLAUSES ASK FOR, in the place they appear.
 *
 * This is the half of TASK-CONTRACTMENUS §6 that a flat inventory could not do:
 * *"a menu means nothing away from the thing it appears on — 'Front boots /
 * wraps' is only meaningful while looking at the equipment question on a lease."*
 * `contract_field_defs.clause_key` is what makes that possible; every field on
 * the six live templates carries one.
 *
 * ⚠️ TWO RHYTHMS ON ONE SURFACE, AND THEY ARE THE ENGINE'S, NOT A CHOICE MADE
 * HERE:
 *   WORDING is drafted and published — the live template is untouched until you
 *   publish, and publishing mints the version (template_editor_publish ->
 *   save_contract_template_version).
 *   A MENU CHANGE APPLIES AT ONCE and mints its own version, because a retired
 *   value has to leave every picker immediately and reach open drafts — that is
 *   what `contract_menu_set_active` does, and it calls the save path itself.
 * ⚠️ SO NOTHING HERE MINTS A SECOND VERSION FOR A MENU EDIT. It re-reads.
 *
 * ⚠️ AND THE RULE THAT GOVERNS EVERYTHING ON THIS SCREEN: A LIVE SURFACE IS
 * DERIVED, A SIGNED DOCUMENT IS FROZEN. An executed document renders the version
 * it was signed against, forever (documents.signed_template_version, read by the
 * drift guard in regenerate_contract_document). Publishing here cannot reach it,
 * and D33 forbids ever asking a past signer to re-sign because of an edit made
 * on this screen.
 */

const LEASE_SET_NOTE =
  'This is one of the three live lease templates (Standard · Simple · Detailed). '
  + 'They stay word-for-word identical by design, so every draft saved and every '
  + 'publish here applies to all three.';

interface InsertTarget { id: string; el: HTMLTextAreaElement }

/* ─── One option on one contract field ──────────────────────────────────────── */

function OptionRow({ opt, onRelabel, onSetActive, onDependents, busy }: {
  opt: { value: string; label: string; active?: boolean };
  onRelabel: (label: string) => void;
  onSetActive: (active: boolean) => void;
  onDependents: () => void;
  busy: boolean;
}) {
  const [label, setLabel] = useState(opt.label);
  useEffect(() => { setLabel(opt.label); }, [opt.label]);
  const active = opt.active !== false;
  return (
    <div className="flex items-center gap-2">
      <input
        className={`form-input text-[13px] flex-1 ${active ? '' : 'opacity-50 line-through'}`}
        value={label} aria-label={`${opt.label} — wording`} disabled={busy}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label !== opt.label) onRelabel(label.trim()); }} />
      <code className="text-[10px] text-muted w-36 truncate" title="The stored code — it can never change, because conditions and signed documents name it">
        {opt.value}
      </code>
      <button type="button" disabled={busy} onClick={onDependents}
        className="text-[10.5px] text-muted underline hover:text-green-800 focus-ring rounded shrink-0">
        What uses this?
      </button>
      <button type="button" disabled={busy} onClick={() => onSetActive(!active)}
        className={`text-xs rounded-lg px-2.5 py-1.5 border focus-ring shrink-0 ${active
          ? 'text-green-800 border-green-800/25 hover:bg-green-50'
          : 'text-muted border-green-800/15 hover:bg-cream-100'}`}>
        {active ? 'Offered' : 'Retired'}
      </button>
    </div>
  );
}

function FieldMenu({ templateKey, field, onChanged, onError }: {
  templateKey: string;
  field: ContractFieldDef;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<{ code: string; label: string } | null>(null);
  const [dependents, setDependents] = useState<{ code: string; text: string } | null>(null);
  const opts = field.options ?? [];

  async function run(fn: () => Promise<unknown>, after?: (r: unknown) => void) {
    setBusy(true);
    try { const r = await fn(); after?.(r); onChanged(); }
    catch (e) { onError(toErrorMessage(e, 'Could not change that choice.')); }
    finally { setBusy(false); }
  }

  async function showDependents(code: string) {
    setBusy(true);
    try {
      const d = await contractMenuDependents(templateKey, field.field_key, code);
      const t = d.totals;
      setDependents({
        code,
        text: t.conditions === 0 && t.documents_open === 0 && t.documents_frozen === 0
          ? 'Nothing depends on this value: no clause or field appears or disappears because of it, and no document has it selected. Retiring it is safe.'
          : `${t.clauses} clause condition(s), ${t.fields} field condition(s) and ${t.options} option gate(s) name this value. `
            + `${t.documents_open} open document(s) have it selected — retiring it clears those answers and re-opens the contract. `
            + `${t.documents_frozen} executed or signed document(s) have it and are untouched.`,
      });
    } catch (e) {
      onError(toErrorMessage(e, 'Could not work out what uses that value.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-2 border border-gold-500/30 bg-gold-50/60 rounded-lg p-3">
      <p className="text-[11px] text-green-900 font-medium mb-2">
        {field.label}
        <span className="text-[10px] text-muted font-normal ml-1.5">· the choices this asks for</span>
      </p>
      <div className="flex flex-col gap-1.5">
        {opts.map((o) => (
          <OptionRow key={o.value} opt={o} busy={busy}
            onRelabel={(label) => void run(() => contractMenuRelabel(templateKey, field.field_key, o.value, label))}
            onSetActive={(active) => void run(
              () => contractMenuSetActive(templateKey, field.field_key, o.value, active),
              (r) => {
                const res = r as { cleared?: unknown[]; reopened?: unknown[] };
                const cleared = res.cleared?.length ?? 0;
                if (!active && cleared > 0) {
                  onError(`Retired. ${cleared} draft document(s) had it selected — those answers were cleared and logged, and those contracts are no longer ready to sign. `
                    + 'Bringing the value back offers it again; it does not put the answers back.');
                }
              },
            )}
            onDependents={() => void showDependents(o.value)} />
        ))}
        {opts.length === 0 && <p className="text-[12px] text-muted">This field offers no choices.</p>}
      </div>

      {adding === null ? (
        <button type="button" className="btn-outline-gold text-xs mt-2" disabled={busy}
          onClick={() => setAdding({ code: '', label: '' })}>
          <Plus size={13} /> Add a choice
        </button>
      ) : (
        <div className="flex flex-wrap items-end gap-2 mt-2">
          <label className="flex-1 min-w-[140px]">
            <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">What it says</span>
            <input className="form-input text-sm" value={adding.label}
              onChange={(e) => setAdding((a) => (a ? { ...a, label: e.target.value } : a))} />
          </label>
          <label className="w-44">
            <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">Stored code</span>
            <input className="form-input text-sm font-mono" value={adding.code}
              placeholder={adding.label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')}
              onChange={(e) => setAdding((a) => (a ? { ...a, code: e.target.value } : a))} />
          </label>
          <button type="button" className="btn-primary text-xs" disabled={busy || !adding.label.trim()}
            onClick={() => {
              const code = (adding.code.trim() || adding.label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''));
              void run(() => contractMenuAddValue(templateKey, field.field_key, code, adding.label.trim()),
                () => setAdding(null));
            }}>
            Add
          </button>
          <button type="button" className="text-xs text-muted underline" onClick={() => setAdding(null)}>Cancel</button>
          <p className="w-full text-[11px] text-muted">
            The code is what documents and conditions store. It can never be changed afterwards —
            only the wording can. New documents and open drafts see the new choice; documents already
            executed are untouched.
          </p>
        </div>
      )}

      <Modal open={dependents !== null} onClose={() => setDependents(null)}
        title={`${field.label} — what uses “${dependents?.code ?? ''}”`}
        footer={<button type="button" className="text-sm text-muted underline" onClick={() => setDependents(null)}>Close</button>}>
        <p className="text-[13.5px] text-secondary">{dependents?.text}</p>
        <p className="text-[12px] text-muted mt-3">
          A value is retired, never deleted and never re-coded: 208 field conditions, 449 clause
          conditions and 8 option gates name values as bare text, and a signed document stores the
          code it was signed with. Retiring leaves every one of those readable.
        </p>
      </Modal>
    </div>
  );
}

/* ─── One clause, and the menus it asks for ─────────────────────────────────── */

function ClauseCard({
  clause, fields, templateKey, localText, dirty, note,
  onFocusTextarea, onChange, onSave, onRevert, onMenusChanged, onError,
}: {
  clause: TemplateEditorClause;
  fields: ContractFieldDef[];
  templateKey: string;
  localText: string;
  dirty: boolean;
  note: string | null;
  onFocusTextarea: (el: HTMLTextAreaElement) => void;
  onChange: (text: string) => void;
  onSave: () => Promise<void>;
  onRevert: (() => Promise<void>) | null;
  onMenusChanged: () => void;
  onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDraft = clause.draft_body !== null;
  const rows = Math.min(18, Math.max(4, localText.split('\n').length + 1));
  const menuFields = fields.filter((f) => (f.options?.length ?? 0) > 0);

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cream-100/50 focus-ring">
        <span className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium text-green-900">
            {clause.heading || clause.clause_key}
          </span>
          {menuFields.length > 0 && (
            <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-gold-800/10 text-gold-800 border border-gold-800/25">
              {menuFields.length} menu{menuFields.length === 1 ? '' : 's'}
            </span>
          )}
          {hasDraft && (
            <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-gold-800/10 text-gold-800 border border-gold-800/25 font-semibold">
              draft
            </span>
          )}
          {dirty && (
            <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
              unsaved
            </span>
          )}
        </span>
        {open ? <ChevronDown size={15} className="text-muted shrink-0" /> : <ChevronRight size={15} className="text-muted shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-green-800/10 px-4 py-3">
          <textarea
            className="form-input w-full font-mono text-[12.5px] leading-relaxed"
            rows={rows}
            aria-label={`${clause.heading || clause.clause_key} wording`}
            value={localText}
            onFocus={(e) => onFocusTextarea(e.currentTarget)}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <AsyncButton className="btn-primary text-[12.5px] px-3 py-1.5" onClick={onSave}
              pendingLabel="Saving…" disabled={!dirty}>
              Save draft
            </AsyncButton>
            {onRevert && (
              <AsyncButton
                className="text-[12.5px] px-3 py-1.5 rounded-lg border border-green-800/20 text-secondary hover:bg-cream-100/60 focus-ring"
                onClick={onRevert} pendingLabel="Reverting…">
                Revert to published text
              </AsyncButton>
            )}
            {note && <span className="text-[11.5px] text-gold-800">{note}</span>}
          </div>
          {menuFields.map((f) => (
            <FieldMenu key={f.field_key} templateKey={templateKey} field={f}
              onChanged={onMenusChanged} onError={onError} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── The retained version, shown as the document it was ────────────────────── */

function DocumentVersionPreview({ detail }: { detail: TemplateVersionDetail }) {
  const clauses = detail.composition?.clauses ?? [];
  const fields = detail.composition?.fields ?? [];
  return (
    <div>
      <p className="text-[12px] text-muted mb-3">
        {clauses.length} clause{clauses.length === 1 ? '' : 's'} · {fields.length} field{fields.length === 1 ? '' : 's'} retained.
      </p>
      {clauses.length === 0 && detail.body && (
        <pre className="text-[12px] whitespace-pre-wrap font-mono text-secondary">{detail.body}</pre>
      )}
      <div className="flex flex-col gap-2">
        {clauses.slice(0, 40).map((c) => (
          <div key={c.clause_key} className="border border-green-800/15 rounded-lg px-3 py-2">
            <p className="text-[12px] font-medium text-green-900">{c.heading || c.clause_key}</p>
            <p className="text-[12px] text-secondary line-clamp-3 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
        {clauses.length > 40 && (
          <p className="text-[12px] text-muted">…and {clauses.length - 40} more, all retained in full.</p>
        )}
      </div>
    </div>
  );
}

/* ─── The surface ───────────────────────────────────────────────────────────── */

export function DocumentSurface({ meta, onError, onReloadList }: {
  meta: TemplateEditorListRow;
  onError: (m: string) => void;
  onReloadList: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clauses, setClauses] = useState<TemplateEditorClause[] | null>(null);
  const [fields, setFields] = useState<ContractFieldDef[]>([]);
  const [flat, setFlat] = useState<FlatTemplateBody | null>(null);
  const [tokens, setTokens] = useState<TemplateEditorToken[]>([]);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [tokensOpen, setTokensOpen] = useState(false);
  const locked = meta.locked_reason != null;

  const load = useCallback(async () => {
    if (meta.is_composed) {
      const [c, f] = await Promise.all([
        templateEditorClauses(meta.template_key),
        contractTemplateFields(meta.template_key),
      ]);
      setClauses(c); setFields(f);
    } else {
      const [b, f] = await Promise.all([
        flatTemplateBody(meta.template_key),
        contractTemplateFields(meta.template_key),
      ]);
      setFlat(b); setFields(f);
    }
  }, [meta.is_composed, meta.template_key]);

  useEffect(() => {
    if (!open || locked) return;
    load().catch((e) => onError(toErrorMessage(e, 'Could not open that document.')));
    if (tokens.length === 0) templateEditorTokens().then(setTokens).catch(() => { /* picker stays empty */ });
  }, [open, locked, load, onError, tokens.length]);

  const flashNote = useCallback((id: string, text: string) => {
    setNotes((n) => ({ ...n, [id]: text }));
    setTimeout(() => setNotes((n) => { const { [id]: _gone, ...rest } = n; return rest; }), 6000);
  }, []);

  const insertToken = useCallback((token: string) => {
    if (!insertTarget) return;
    const { id, el } = insertTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setLocal((m) => ({ ...m, [id]: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }, [insertTarget]);

  const refreshAll = useCallback(async () => {
    await load();
    onReloadList();
  }, [load, onReloadList]);

  async function saveClause(c: TemplateEditorClause) {
    const text = local[c.clause_id];
    if (text === undefined) return;
    const res = await saveClauseDraft(c.clause_id, text);
    flashNote(c.clause_id, res.cleared
      ? 'Matches the published text — draft cleared.'
      : (res.updated_keys.length > 1 ? `Draft saved to all ${res.updated_keys.length} lease templates.` : 'Draft saved.'));
    setLocal((m) => { const { [c.clause_id]: _gone, ...rest } = m; return rest; });
    await refreshAll();
  }

  async function revertClause(c: TemplateEditorClause) {
    await saveClauseDraft(c.clause_id, null);
    flashNote(c.clause_id, 'Draft removed.');
    setLocal((m) => { const { [c.clause_id]: _gone, ...rest } = m; return rest; });
    await refreshAll();
  }

  async function saveFlat() {
    const text = local.FLAT;
    if (text === undefined || flat === null) return;
    const res = await saveFlatDraft(flat.template_key, text);
    flashNote('FLAT', res.cleared ? 'Matches the published text — draft cleared.' : 'Draft saved.');
    setLocal((m) => { const { FLAT: _gone, ...rest } = m; return rest; });
    await refreshAll();
  }

  async function doPublish() {
    const res = await publishTemplate(meta.template_key);
    setPublishOpen(false);
    await refreshAll();
    onError(`Published — now ${Object.entries(res.new_versions).map(([k, v]) => `${k} v${v}`).join(', ')}. `
      + 'Documents already generated or signed are unchanged: each keeps the exact text it was executed with.');
  }

  const sections = useMemo(() => {
    if (clauses === null) return [];
    const out: { key: string; heading: string; clauses: TemplateEditorClause[] }[] = [];
    for (const c of clauses) {
      const last = out[out.length - 1];
      if (last && last.key === c.section_key) last.clauses.push(c);
      else out.push({ key: c.section_key, heading: c.section_heading || c.section_key, clauses: [c] });
    }
    return out;
  }, [clauses]);

  /** Fields that belong to no clause on a composed template, or every field with
   *  a menu on a flat one — they still have to be reachable, or the editor would
   *  govern some menus and quietly not others. */
  const orphanMenuFields = useMemo(() => {
    const clauseKeys = new Set((clauses ?? []).map((c) => c.clause_key));
    return fields.filter((f) => (f.options?.length ?? 0) > 0
      && (!f.clause_key || !clauseKeys.has(f.clause_key)));
  }, [fields, clauses]);

  const source: VersionSource<TemplateVersionDetail> = {
    list: useCallback(() => templateVersionList(meta.template_key), [meta.template_key]),
    at: useCallback((v: number) => templateVersionAt(meta.template_key, v), [meta.template_key]),
    restore: useCallback(async (v: number) => {
      const minted = await restoreTemplateVersion(meta.template_key, v);
      await refreshAll();
      return minted;
    }, [meta.template_key, refreshAll]),
    preview: (d) => <DocumentVersionPreview detail={d} />,
    note: (
      <>
        Restoring puts an earlier version's WORDING back and mints a new number for it. It
        refuses, naming what differs, when clauses have been added or removed since — a
        half-restore that silently leaves a clause behind is worse than a refusal.
        {meta.lockstep_keys.length > 1
          && ' The three live lease templates currently sit one clause ahead of their retained v3, '
            + 'so restoring v3 will refuse until the next publish mints v4. That is correct, not broken.'}
      </>
    ),
  };

  const flatText = local.FLAT ?? flat?.draft_body ?? flat?.body ?? '';
  const flatDirty = flat !== null && flatText !== (flat.draft_body ?? flat.body ?? '');
  const isLease = meta.lockstep_keys.length > 1;

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <div className="w-full flex items-center gap-2 px-5 py-4">
        <button type="button" onClick={() => setOpen((v) => !v)} disabled={locked}
          className="flex-1 min-w-0 flex items-center justify-between text-left focus-ring rounded disabled:opacity-60">
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-medium text-green-900">{meta.title}</span>
              {!meta.active && (
                <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-cream-100 text-muted border border-green-800/10">
                  retired
                </span>
              )}
              {meta.has_unpublished && (
                <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-gold-800/10 text-gold-800 border border-gold-800/25 font-semibold">
                  unpublished changes
                </span>
              )}
            </span>
            <span className="block text-[12px] text-muted mt-0.5">
              {meta.is_composed ? `${meta.clause_count} clauses` : 'One body of text'}
              {isLease && !locked ? ' · edits apply to all three leases' : ''}
              {locked ? ` · ${meta.locked_reason}` : ''}
            </span>
          </span>
          {!locked && (open
            ? <ChevronDown size={17} className="text-muted ml-2" />
            : <ChevronRight size={17} className="text-muted ml-2" />)}
        </button>
        <VersionChip version={meta.version} label={meta.title} onOpen={() => setVersionsOpen(true)} />
      </div>

      <VersionsModal title={meta.title} open={versionsOpen} onClose={() => setVersionsOpen(false)}
        source={source} onChanged={onReloadList} onError={onError} />

      {open && !locked && (
        <div className="border-t border-green-800/10 px-5 py-4">
          {isLease && (
            <p className="text-[12.5px] text-green-900 bg-green-50 border border-green-700/25 rounded-lg px-3.5 py-2.5 mb-3">
              {LEASE_SET_NOTE}
            </p>
          )}
          <p className="text-[12.5px] text-muted mb-3">
            Wording is saved as a draft and goes live when you publish; a menu change applies
            immediately, because a retired choice has to leave every picker at once.
            {' '}<strong className="text-green-900">Documents already signed never change</strong> —
            each keeps the exact wording and the version number it was executed with.
          </p>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button type="button" className="btn-primary text-[13px] px-4 py-2 disabled:opacity-50"
              disabled={!meta.has_unpublished} onClick={() => setPublishOpen(true)}>
              Publish wording…
            </button>
            <AsyncButton
              className="text-[13px] px-3.5 py-2 rounded-lg border border-green-800/20 text-secondary hover:bg-cream-100/60 focus-ring disabled:opacity-50"
              onClick={async () => { await discardTemplateDrafts(meta.template_key); setLocal({}); await refreshAll(); }}
              pendingLabel="Discarding…" disabled={!meta.has_unpublished}>
              Discard drafts
            </AsyncButton>
            <button type="button" className="text-[12.5px] text-muted underline"
              onClick={() => setTokensOpen((v) => !v)}>
              {tokensOpen ? 'Hide the token library' : 'Show the token library'}
            </button>
          </div>

          {tokensOpen && (
            <div className="mb-4 max-w-md">
              <TokenPicker tokens={tokens} templateKey={meta.template_key}
                onInsert={insertToken} insertDisabled={insertTarget === null} />
            </div>
          )}

          {meta.is_composed && clauses === null && <p className="text-sm text-muted">Loading the document…</p>}

          {meta.is_composed && sections.map((s) => (
            <div key={s.key} className="mb-5">
              <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-2">{s.heading}</p>
              <div className="flex flex-col gap-2">
                {s.clauses.map((c) => {
                  const text = local[c.clause_id] ?? c.draft_body ?? c.body;
                  return (
                    <ClauseCard key={c.clause_id} clause={c} templateKey={meta.template_key}
                      fields={fields.filter((f) => f.clause_key === c.clause_key)}
                      localText={text} dirty={text !== (c.draft_body ?? c.body)}
                      note={notes[c.clause_id] ?? null}
                      onFocusTextarea={(el) => setInsertTarget({ id: c.clause_id, el })}
                      onChange={(t) => setLocal((m) => ({ ...m, [c.clause_id]: t }))}
                      onSave={() => saveClause(c)}
                      onRevert={c.draft_body !== null ? () => revertClause(c) : null}
                      onMenusChanged={() => void refreshAll()}
                      onError={onError} />
                  );
                })}
              </div>
            </div>
          ))}

          {!meta.is_composed && flat !== null && (
            <div className="border border-green-800/10 rounded-xl px-4 py-3">
              {meta.body_empty && flat.draft_body === null && (
                <p className="text-[12.5px] text-red-700 mb-2">
                  This template is active but its body is empty — anything generated from it today is blank.
                </p>
              )}
              <textarea
                className="form-input w-full font-mono text-[12.5px] leading-relaxed"
                rows={Math.min(32, Math.max(12, flatText.split('\n').length + 2))}
                aria-label={`${meta.title} body`}
                value={flatText}
                placeholder="Write the template body here (markdown, with {{TOKENS}} where values merge in)."
                onFocus={(e) => setInsertTarget({ id: 'FLAT', el: e.currentTarget })}
                onChange={(e) => { const t = e.target.value; setLocal((m) => ({ ...m, FLAT: t })); }}
              />
              <AsyncButton className="btn-primary text-[12.5px] px-3 py-1.5 mt-2" onClick={saveFlat}
                pendingLabel="Saving…" disabled={!flatDirty}>
                Save draft
              </AsyncButton>
              {notes.FLAT && <span className="text-[11.5px] text-gold-800 ml-2">{notes.FLAT}</span>}
            </div>
          )}

          {orphanMenuFields.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-2">
                Menus this document asks for outside any clause
              </p>
              {orphanMenuFields.map((f) => (
                <FieldMenu key={f.field_key} templateKey={meta.template_key} field={f}
                  onChanged={() => void refreshAll()} onError={onError} />
              ))}
            </div>
          )}

          <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish this wording?"
            footer={(
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setPublishOpen(false)}
                  className="text-[13px] px-3.5 py-2 rounded-lg border border-green-800/20 text-secondary hover:bg-cream-100/60 focus-ring">
                  Not yet
                </button>
                <AsyncButton className="btn-primary text-[13px] px-4 py-2" onClick={doPublish} pendingLabel="Publishing…">
                  Publish
                </AsyncButton>
              </div>
            )}>
            <div className="text-[13.5px] text-secondary flex flex-col gap-2">
              <p>
                The draft wording becomes the live template and the version moves to{' '}
                <strong className="text-green-900">v{meta.version + 1}</strong>, with this one
                retained in full and still readable.
              </p>
              {isLease && <p>{LEASE_SET_NOTE}</p>}
              <p>
                Newly generated documents pick up the new wording. Documents already
                generated or signed are <strong className="text-green-900">never changed</strong> —
                each renders the version it was signed against, and nobody is asked to re-sign
                because of an edit made here.
              </p>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
