import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import { AsyncButton } from '../../../../components/ops/kit/AsyncButton';
import { Modal } from '../../../../components/ops/kit/Modal';
import { TokenPicker } from '../../../../components/ops/templates/TokenPicker';
import {
  templateEditorList, templateEditorClauses, templateEditorTokens,
  saveClauseDraft, saveFlatDraft, discardTemplateDrafts, publishTemplate, flatTemplateBody,
  type TemplateEditorListRow, type TemplateEditorClause, type TemplateEditorToken,
  type FlatTemplateBody, type PublishResult,
} from '../../../../lib/templateEditor';

/**
 * TEMPLATE EDITOR (/app/ops/admin/templates/:templateKey) — TASK-TEXTEDIT.
 * The visible text only: clause bodies for the composed templates, the one
 * markdown body for the flat ones. Editing writes draft_body and NEVER the
 * live text; Publish copies draft -> live, bumps the version by exactly 1 and
 * clears the drafts; Discard clears them and changes nothing else. The three
 * live lease keys move together (D10) — the banner says so up front, and the
 * save/publish results from the RPCs confirm which keys were written.
 */

const LEASE_SET_NOTE =
  'This is one of the three live lease templates (Standard · Simple · Detailed). '
  + 'They stay word-for-word identical by design, so every draft saved and every '
  + 'publish here applies to all three.';

/** The clause (or flat body) currently holding the caret, for token insertion. */
interface InsertTarget { id: string; el: HTMLTextAreaElement; }

function ClauseCard({ clause, localText, dirty, note, onFocusTextarea, onChange, onSave, onRevert }: {
  clause: TemplateEditorClause;
  localText: string;
  dirty: boolean;
  note: string | null;
  onFocusTextarea: (el: HTMLTextAreaElement) => void;
  onChange: (text: string) => void;
  onSave: () => Promise<void>;
  onRevert: (() => Promise<void>) | null;
}) {
  const [open, setOpen] = useState(false);
  const hasDraft = clause.draft_body !== null;
  const rows = Math.min(18, Math.max(4, localText.split('\n').length + 1));

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cream-100/50 focus-ring">
        <span className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium text-green-900">
            {clause.heading || clause.clause_key}
          </span>
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
        </div>
      )}
    </div>
  );
}

export default function AdminTemplateEditorPage() {
  const { templateKey = '' } = useParams();
  const [meta, setMeta] = useState<TemplateEditorListRow | null>(null);
  const [clauses, setClauses] = useState<TemplateEditorClause[] | null>(null);
  const [flat, setFlat] = useState<FlatTemplateBody | null>(null);
  const [tokens, setTokens] = useState<TemplateEditorToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Local, not-yet-saved edits keyed by clause_id (or FLAT for the flat body). */
  const [local, setLocal] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const notesTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useDocumentTitle(meta ? `Templates — ${meta.title}` : 'Templates');

  const reload = useCallback(async () => {
    const list = await templateEditorList();
    const m = list.find((r) => r.template_key === templateKey) ?? null;
    setMeta(m);
    if (m === null) { setError('No such template.'); return; }
    if (m.locked_reason) { setError(m.locked_reason); return; }
    if (m.is_composed) {
      setClauses(await templateEditorClauses(templateKey));
    } else {
      setFlat(await flatTemplateBody(templateKey));
    }
  }, [templateKey]);

  useEffect(() => {
    setMeta(null); setClauses(null); setFlat(null); setLocal({}); setNotes({});
    setInsertTarget(null); setPublishResult(null); setError(null);
    reload().catch(() => setError('Could not load the template.'));
    templateEditorTokens().then(setTokens).catch(() => { /* picker just stays empty */ });
  }, [reload, templateKey]);

  const flashNote = useCallback((id: string, text: string) => {
    setNotes((n) => ({ ...n, [id]: text }));
    clearTimeout(notesTimer.current[id]);
    notesTimer.current[id] = setTimeout(
      () => setNotes((n) => { const { [id]: _gone, ...rest } = n; return rest; }), 6000,
    );
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

  const savedKeysNote = (keys: string[]) =>
    keys.length > 1 ? `Draft saved to all ${keys.length} lease templates.` : 'Draft saved.';

  async function saveClause(c: TemplateEditorClause) {
    const text = local[c.clause_id];
    if (text === undefined) return;
    const res = await saveClauseDraft(c.clause_id, text);
    flashNote(c.clause_id, res.cleared ? 'Matches the published text — draft cleared.' : savedKeysNote(res.updated_keys));
    setLocal((m) => { const { [c.clause_id]: _gone, ...rest } = m; return rest; });
    await reload();
  }

  async function revertClause(c: TemplateEditorClause) {
    const res = await saveClauseDraft(c.clause_id, null);
    flashNote(c.clause_id, res.updated_keys.length > 1
      ? 'Draft removed from all three lease templates.' : 'Draft removed.');
    setLocal((m) => { const { [c.clause_id]: _gone, ...rest } = m; return rest; });
    await reload();
  }

  async function saveFlat() {
    const text = local.FLAT;
    if (text === undefined || flat === null) return;
    const res = await saveFlatDraft(flat.template_key, text);
    flashNote('FLAT', res.cleared ? 'Matches the published text — draft cleared.' : 'Draft saved.');
    setLocal((m) => { const { FLAT: _gone, ...rest } = m; return rest; });
    await reload();
  }

  async function revertFlat() {
    if (flat === null) return;
    await saveFlatDraft(flat.template_key, null);
    flashNote('FLAT', 'Draft removed.');
    setLocal((m) => { const { FLAT: _gone, ...rest } = m; return rest; });
    await reload();
  }

  async function discardAll() {
    if (meta === null) return;
    await discardTemplateDrafts(meta.template_key);
    setLocal({});
    await reload();
  }

  async function doPublish() {
    if (meta === null) return;
    const res = await publishTemplate(meta.template_key);
    setPublishResult(res);
    setPublishOpen(false);
    await reload();
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

  const isLease = (meta?.lockstep_keys.length ?? 0) > 1;
  const unpublished = meta?.has_unpublished ?? false;
  const unsavedCount = Object.keys(local).filter((id) =>
    id === 'FLAT'
      ? local.FLAT !== undefined && local.FLAT !== (flat?.draft_body ?? flat?.body ?? '')
      : local[id] !== (clauses?.find((c) => c.clause_id === id)?.draft_body
          ?? clauses?.find((c) => c.clause_id === id)?.body),
  ).length;

  const flatText = local.FLAT ?? flat?.draft_body ?? flat?.body ?? '';
  const flatDirty = flat !== null && flatText !== (flat.draft_body ?? flat.body ?? '');

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <Link to="/app/ops/admin/templates"
        className="inline-flex items-center gap-1.5 text-[13px] text-secondary hover:text-green-900 mb-4 focus-ring rounded">
        <ArrowLeft size={14} /> All templates
      </Link>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {meta === null && !error && <p className="text-sm text-muted">Loading…</p>}

      {meta !== null && !error && (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
            <div>
              <h1 className="font-serif text-2xl text-green-900">
                {meta.title} <span className="text-[14px] font-sans text-muted">v{meta.version}</span>
              </h1>
              <p className="text-sm text-green-800/70 mt-1">
                {meta.is_composed
                  ? 'Edit the wording clause by clause. Saving writes a draft; the live template is untouched until you publish.'
                  : 'One body of text. Saving writes a draft; the live template is untouched until you publish.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <AsyncButton
                className="text-[13px] px-3.5 py-2 rounded-lg border border-green-800/20 text-secondary hover:bg-cream-100/60 focus-ring disabled:opacity-50"
                onClick={discardAll} pendingLabel="Discarding…" disabled={!unpublished}>
                Discard drafts
              </AsyncButton>
              <button type="button" className="btn-primary text-[13px] px-4 py-2 disabled:opacity-50"
                disabled={!unpublished} onClick={() => setPublishOpen(true)}>
                Publish…
              </button>
            </div>
          </div>

          {isLease && (
            <p className="text-[12.5px] text-green-900 bg-green-50 border border-green-700/25 rounded-lg px-3.5 py-2.5 mb-4">
              {LEASE_SET_NOTE}
            </p>
          )}

          {unpublished && (
            <p className="text-[12.5px] text-gold-800 mb-4">
              Unpublished changes: {meta.is_composed
                ? `${meta.draft_clause_count} clause${meta.draft_clause_count === 1 ? '' : 's'}`
                : 'the body text'}.
              {' '}Publishing will move them live and bump the version to v{meta.version + 1}.
            </p>
          )}
          {unsavedCount > 0 && (
            <p className="text-[12.5px] text-red-700 mb-4">
              {unsavedCount} open edit{unsavedCount === 1 ? '' : 's'} not yet saved as a draft.
            </p>
          )}
          {publishResult && (
            <p className="text-[12.5px] text-green-900 bg-green-50 border border-green-700/25 rounded-lg px-3.5 py-2.5 mb-4">
              Published. {publishResult.clause_rows_published > 0
                ? `${publishResult.clause_rows_published} clause row${publishResult.clause_rows_published === 1 ? '' : 's'} updated`
                : 'Body updated'}
              {publishResult.published_keys.length > 1 ? ` across ${publishResult.published_keys.length} lease templates` : ''}
              {' — now '}
              {Object.entries(publishResult.new_versions).map(([k, v]) => `${k} v${v}`).join(', ')}.
              {' '}Documents already generated or signed are unchanged.
            </p>
          )}

          <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
            <div>
              {meta.is_composed && clauses === null && <p className="text-sm text-muted">Loading clauses…</p>}

              {meta.is_composed && sections.map((s) => (
                <div key={s.key} className="mb-6">
                  <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-2">{s.heading}</p>
                  <div className="flex flex-col gap-2">
                    {s.clauses.map((c) => {
                      const text = local[c.clause_id] ?? c.draft_body ?? c.body;
                      const dirty = text !== (c.draft_body ?? c.body);
                      return (
                        <ClauseCard
                          key={c.clause_id}
                          clause={c}
                          localText={text}
                          dirty={dirty}
                          note={notes[c.clause_id] ?? null}
                          onFocusTextarea={(el) => setInsertTarget({ id: c.clause_id, el })}
                          onChange={(t) => setLocal((m) => ({ ...m, [c.clause_id]: t }))}
                          onSave={() => saveClause(c)}
                          onRevert={c.draft_body !== null ? () => revertClause(c) : null}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {!meta.is_composed && flat !== null && (
                <div className="bg-white border border-green-800/10 rounded-xl px-4 py-3">
                  {meta.body_empty && flat.draft_body === null && (
                    <p className="text-[12.5px] text-red-700 mb-2">
                      This template is active but its body is empty — anything generated from it today is blank.
                    </p>
                  )}
                  <textarea
                    className="form-input w-full font-mono text-[12.5px] leading-relaxed"
                    rows={Math.min(32, Math.max(12, flatText.split('\n').length + 2))}
                    value={flatText}
                    placeholder="Write the template body here (markdown, with {{TOKENS}} where values merge in)."
                    onFocus={(e) => setInsertTarget({ id: 'FLAT', el: e.currentTarget })}
                    onChange={(e) => { const t = e.target.value; setLocal((m) => ({ ...m, FLAT: t })); }}
                  />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <AsyncButton className="btn-primary text-[12.5px] px-3 py-1.5" onClick={saveFlat}
                      pendingLabel="Saving…" disabled={!flatDirty}>
                      Save draft
                    </AsyncButton>
                    {flat.draft_body !== null && (
                      <AsyncButton
                        className="text-[12.5px] px-3 py-1.5 rounded-lg border border-green-800/20 text-secondary hover:bg-cream-100/60 focus-ring"
                        onClick={revertFlat} pendingLabel="Reverting…">
                        Revert to published text
                      </AsyncButton>
                    )}
                    {notes.FLAT && <span className="text-[11.5px] text-gold-800">{notes.FLAT}</span>}
                  </div>
                </div>
              )}
            </div>

            <TokenPicker
              tokens={tokens}
              templateKey={meta.template_key}
              onInsert={insertToken}
              insertDisabled={insertTarget === null}
            />
          </div>

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
                <strong className="text-green-900">v{meta.version + 1}</strong>.
              </p>
              {isLease && <p>{LEASE_SET_NOTE}</p>}
              <p>
                Newly generated documents pick up the new wording. Documents already
                generated or signed are <strong className="text-green-900">never changed</strong> —
                each keeps the exact text it was executed with.
              </p>
              <p>
                The version bump is recorded, and the usual question of whether past
                signers must re-sign will be raised with staff afterwards.
              </p>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
