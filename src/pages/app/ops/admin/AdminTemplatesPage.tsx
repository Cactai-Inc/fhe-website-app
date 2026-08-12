import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import { templateEditorList, type TemplateEditorListRow } from '../../../../lib/templateEditor';

/**
 * TEMPLATES (/app/ops/admin/templates) — the landing surface is a LIST of what
 * exists (D12/D13: editing is the hot path, "new" is not the front door). Every
 * contract template, split clause-composed vs flat, with an "unpublished
 * changes" badge so the owner can see at a glance what he left half-edited.
 * Opening a row is the whole flow; drafting and publishing happen inside.
 */

function TemplateRow({ t }: { t: TemplateEditorListRow }) {
  const draftNote = t.is_composed
    ? (t.draft_clause_count > 0 ? `${t.draft_clause_count} clause${t.draft_clause_count === 1 ? '' : 's'} edited` : null)
    : (t.has_flat_draft ? 'body edited' : null);
  const locked = t.locked_reason != null;

  const inner = (
    <>
      <span className="min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-medium text-green-900">{t.title}</span>
          <span className="text-[11px] text-muted font-mono">v{t.version}</span>
          {!t.active && (
            <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-cream-100 text-muted border border-green-800/10">
              inactive
            </span>
          )}
          {t.has_unpublished && (
            <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-gold-800/10 text-gold-800 border border-gold-800/25 font-semibold">
              unpublished changes
            </span>
          )}
          {t.body_empty && !t.is_composed && (
            <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
              empty body
            </span>
          )}
        </span>
        <span className="block text-[12px] text-muted mt-0.5">
          {t.is_composed ? `${t.clause_count} clauses` : 'Single body'}
          {draftNote ? ` · ${draftNote}` : ''}
          {t.lockstep_keys.length > 1 && !locked ? ' · edits apply to all three leases' : ''}
          {locked ? ` · ${t.locked_reason}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-muted">
        {locked ? <Lock size={16} /> : <ChevronRight size={17} />}
      </span>
    </>
  );

  if (locked) {
    return (
      <div className="w-full flex items-center justify-between px-5 py-4 bg-cream-100/60 border border-green-800/10 rounded-xl opacity-75">
        {inner}
      </div>
    );
  }
  return (
    <Link
      to={`/app/ops/admin/templates/${t.template_key}`}
      className="w-full flex items-center justify-between px-5 py-4 bg-white border border-green-800/10 rounded-xl hover:bg-cream-100/50 focus-ring"
    >
      {inner}
    </Link>
  );
}

export default function AdminTemplatesPage() {
  useDocumentTitle('Templates');
  const [rows, setRows] = useState<TemplateEditorListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    templateEditorList().then(setRows).catch(() => setError('Could not load the templates.'));
  }, []);

  const composed = (rows ?? []).filter((r) => r.is_composed);
  const flat = (rows ?? []).filter((r) => !r.is_composed);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Templates</h1>
      <p className="text-sm text-green-800/70 mb-6">
        The wording of every document template. Open one, change the text, save a
        draft — the live template is untouched until you publish. Publishing bumps
        the version and never changes documents that were already generated or signed.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted">Loading templates…</p>}

      {rows !== null && (
        <>
          <div className="mb-8">
            <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-3">
              Clause-composed — edited clause by clause
            </p>
            <div className="flex flex-col gap-3">
              {composed.map((t) => <TemplateRow key={t.template_key} t={t} />)}
            </div>
          </div>
          <div className="mb-8">
            <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-3">
              Flat — one body of text
            </p>
            <div className="flex flex-col gap-3">
              {flat.map((t) => <TemplateRow key={t.template_key} t={t} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
