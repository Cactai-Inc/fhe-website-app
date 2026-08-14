/**
 * OPS-DOCS-QUEUE — Documents work-queue (surface `ops`, module `core`).
 *
 * Staff opens /app/ops/documents → every in-tenant document across all
 * engagements, filterable by status (DRAFT / AWAITING_SIGNATURE / EXECUTED /
 * VOID) and sorted by generated_at. Each row links into the OPS-DOC-VIEW
 * viewer/signing surface at /app/ops/documents/:id. Backs OPS-DASH's
 * documents tile.
 *
 * Real data path: `listDocuments()` (INT-API-CORE → supabase.from('documents'),
 * RLS org-scoped — staff sees all in-tenant documents; a client would see only
 * their own) fetches ONCE on mount — RLS scopes the same full set regardless
 * of which filter is selected, so there's nothing a re-fetch on filter change
 * would narrow that client-side filtering doesn't already. Loading / empty /
 * error / success branches all render — errors are surfaced, never swallowed.
 *
 * PRESET VIEWS (DOCUMENT_LIBRARY_DESIGN.md §"One flat library", TASK-DOCQUEUE
 * 20260811): six preset views over the one list — filter presets, not routes
 * or separate pages (v2 owner ruling: "views are filter presets at most, not
 * navigation"). Built against today's schema only:
 *   - Needs attention (default) = AWAITING_SIGNATURE. The spec also wants
 *     assigned-but-never-generated obligations and expires_on-based items in
 *     here; neither exists yet (the first needs a contact_required_documents
 *     cross-reference, the second needs the uploads build) — not built, see
 *     the task report.
 *   - Signed library = EXECUTED, non-archived, with a superseded toggle.
 *     Grouping by template category is not built (no category column yet).
 *   - By person / By horse = pick from who/what actually has documents,
 *     derived from the fetched rows (no extra query) — filters this SAME
 *     list rather than deep-linking to the dossier, which duplicates
 *     nothing since there's no separate view to keep in sync.
 *   - Contracts & deals = rows with a contract_id.
 *   - Drafts, voids & archive = DRAFT/VOID/archived/terminated.
 * The status filter (below) still narrows independently within whichever
 * preset is active — that's what the task's acceptance test exercises.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Helmet } from 'react-helmet-async';
import {
  listDocuments, deleteDocuments,
  pendingVersionDecisions, resolveVersionDecision, templatePastSigners,
  type PendingVersionDecision, type PastSigner,
} from '../../../lib/api';
import { contactName } from '../../../lib/ops/types';
import type { DocumentQueueRow } from '../../../lib/ops/types';
import { EmptyState } from '../../../lib/ops';
import {
  DocumentQueueTable,
  type QueueStatusFilter,
} from '../../../components/ops/documents/DocumentQueueTable';
import { DocumentQueuePicker } from '../../../components/ops/documents/DocumentQueuePicker';

type Preset = 'NEEDS_ATTENTION' | 'SIGNED' | 'BY_PERSON' | 'BY_HORSE' | 'CONTRACTS' | 'ARCHIVE' | 'ALL';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'NEEDS_ATTENTION', label: 'Needs attention' },
  { key: 'SIGNED', label: 'Signed library' },
  { key: 'BY_PERSON', label: 'By person' },
  { key: 'BY_HORSE', label: 'By horse' },
  { key: 'CONTRACTS', label: 'Contracts & deals' },
  { key: 'ARCHIVE', label: 'Drafts, voids & archive' },
  { key: 'ALL', label: 'All documents' },
];

/** Narrow the in-tenant document set to the selected status (`ALL` = no filter). */
function filterByStatus(documents: DocumentQueueRow[], status: QueueStatusFilter): DocumentQueueRow[] {
  if (status === 'ALL') return documents;
  return documents.filter((doc) => doc.status === status);
}

interface PresetOptions {
  personId: string;
  horseId: string;
  showSuperseded: boolean;
}

/** Each preset narrows to its own row set; the status filter then applies on
 *  top, same as it always has for "All documents." */
function presetRows(documents: DocumentQueueRow[], preset: Preset, opts: PresetOptions): DocumentQueueRow[] {
  switch (preset) {
    case 'NEEDS_ATTENTION':
      return documents.filter((d) => d.status === 'AWAITING_SIGNATURE');
    case 'SIGNED':
      return documents.filter((d) => d.status === 'EXECUTED' && !d.archived_at
        && (opts.showSuperseded || d.current_status !== 'superseded'));
    case 'BY_PERSON':
      return opts.personId ? documents.filter((d) => d.contact_id === opts.personId) : [];
    case 'BY_HORSE':
      return opts.horseId ? documents.filter((d) => d.horse_id === opts.horseId) : [];
    case 'CONTRACTS':
      return documents.filter((d) => d.contract_id != null);
    case 'ARCHIVE':
      return documents.filter((d) => d.status === 'DRAFT' || d.status === 'VOID'
        || !!d.archived_at || !!d.terminated_at);
    case 'ALL':
    default:
      return documents;
  }
}

/**
 * VERSION-BUMP DECISION.
 *
 * When a template's version changes, the people who already signed consented to
 * DIFFERENT wording. A trigger records each bump as an unresolved event, and this
 * is where it gets answered — the owner's three choices:
 *
 *   Everyone      every past signer must re-sign
 *   Choose who    pick the subset (e.g. exclude someone mid-onboarding)
 *   No one        recorded, not merely dismissed — deciding nobody re-signs is a
 *                 real decision and should be auditable
 *
 * Requiring does not email or interrupt anyone. It adds a gating obligation, so
 * at their next sign-in they are routed through the normal flow: intake
 * pre-filled from what we hold, edit or continue, sign, into the app.
 */
function VersionDecisions() {
  const [rows, setRows] = useState<PendingVersionDecision[] | null>(null);
  const [picking, setPicking] = useState<PendingVersionDecision | null>(null);
  const [signers, setSigners] = useState<PastSigner[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    pendingVersionDecisions().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  async function answer(ev: PendingVersionDecision, res: 'ALL' | 'NONE') {
    setBusy(true); setErr(null);
    try {
      await resolveVersionDecision(ev.id, res);
      setPicking(null);
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not record that decision.'));
    } finally { setBusy(false); }
  }

  async function openPicker(ev: PendingVersionDecision) {
    setPicking(ev); setSigners(null); setErr(null);
    try {
      const list = await templatePastSigners(ev.template_key);
      setSigners(list);
      // Default to everyone selected: the common case is "all but one".
      setChosen(new Set(list.map((s) => s.contact_id)));
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load past signers.'));
      setSigners([]);
    }
  }

  async function confirmSelected() {
    if (!picking) return;
    setBusy(true); setErr(null);
    try {
      await resolveVersionDecision(picking.id, 'SELECTED', Array.from(chosen));
      setPicking(null);
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not record that decision.'));
    } finally { setBusy(false); }
  }

  if (!rows || rows.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-gold-600/40 bg-gold-50 p-4">
      <p className="text-sm font-medium text-gold-900 mb-1">
        {rows.length} document {rows.length === 1 ? 'version needs' : 'versions need'} a decision
      </p>
      <p className="text-[12.5px] text-gold-900/85 mb-3">
        The wording changed. Anyone who signed the previous version agreed to
        different text — choose who should sign again.
      </p>
      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-white/70 rounded-lg px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-green-900 font-medium">{r.title}</span>
              <span className="text-[11.5px] text-muted">
                v{r.from_version ?? 0} → v{r.to_version}
                {` · ${r.past_signers} signed the older version`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button type="button" disabled={busy || r.past_signers === 0}
                onClick={() => void answer(r, 'ALL')}
                className="text-[11px] px-2.5 py-1 rounded-full bg-green-800 text-white hover:bg-green-700 focus-ring disabled:opacity-40">
                Everyone re-signs
              </button>
              <button type="button" disabled={busy || r.past_signers === 0}
                onClick={() => void openPicker(r)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-green-800/25 text-green-800 hover:bg-green-800/10 focus-ring disabled:opacity-40">
                Choose who
              </button>
              <button type="button" disabled={busy}
                onClick={() => void answer(r, 'NONE')}
                className="text-[11px] px-2.5 py-1 rounded-full border border-green-800/20 text-muted hover:bg-green-800/5 focus-ring disabled:opacity-40">
                No one
              </button>
            </div>
          </div>
        ))}
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4"
          role="dialog" aria-modal="true" aria-labelledby="vd-heading">
          <div className="bg-white rounded-2xl border border-green-800/10 p-6 max-w-md w-full max-h-[80vh] overflow-y-auto overscroll-contain">
            <h2 id="vd-heading" className="font-serif text-lg text-green-800 mb-1">
              Who should re-sign {picking.title}?
            </h2>
            <p className="text-[12.5px] text-muted mb-4">
              Everyone below signed v{picking.from_version ?? 0} or earlier. Unticking
              someone leaves their existing signature in place.
            </p>
            {signers === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : signers.length === 0 ? (
              <p className="text-sm text-muted">Nobody has signed an older version.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-4">
                {signers.map((s) => (
                  <label key={s.contact_id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-green-800/12 cursor-pointer hover:bg-green-50/50">
                    <input type="checkbox" className="accent-green-700 w-[17px] h-[17px]"
                      checked={chosen.has(s.contact_id)}
                      onChange={() => setChosen((prev) => {
                        const n = new Set(prev);
                        if (n.has(s.contact_id)) n.delete(s.contact_id); else n.add(s.contact_id);
                        return n;
                      })} />
                    <span className="min-w-0">
                      <span className="block text-sm text-green-900">{s.name}</span>
                      <span className="block text-[11px] text-muted">
                        signed v{s.signed_version ?? 0}
                        {s.already_required && ' · already required'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" disabled={busy}
                onClick={() => setPicking(null)}>Cancel</button>
              <button type="button" className="btn-primary text-sm"
                disabled={busy || chosen.size === 0}
                onClick={() => void confirmSelected()}>
                {busy ? 'Saving…' : `Require from ${chosen.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentsQueuePage() {
  const [documents, setDocuments] = useState<DocumentQueueRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>('ALL');
  const [preset, setPreset] = useState<Preset>('NEEDS_ATTENTION');
  const [personId, setPersonId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  /** Fetch once — RLS returns the same org-scoped set no matter which filter
   *  is active, so a filter/preset change narrows client-side rather than
   *  re-querying. */
  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listDocuments()
      .then((rows) => {
        if (active) setDocuments(rows);
      })
      .catch((err: unknown) => {
        if (active) setError(toErrorMessage(err, 'Could not load documents.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  async function handleDeleteSelected(ids: string[]) {
    await deleteDocuments(ids);
    load();
  }

  // By-person / By-horse options come from who/what actually has a document
  // on this already-fetched set — no extra query, and nobody with zero
  // documents clutters the picker.
  const personOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const d of documents) {
      if (d.contact_id && !byId.has(d.contact_id)) byId.set(d.contact_id, contactName(d.contact) || 'Unnamed');
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  const horseOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const d of documents) {
      if (d.horse_id && !byId.has(d.horse_id)) {
        byId.set(d.horse_id, d.horse?.nickname || d.horse?.registered_name || 'Unnamed horse');
      }
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  const rows = filterByStatus(
    presetRows(documents, preset, { personId, horseId, showSuperseded }),
    statusFilter,
  );

  const emptyCopy = preset === 'BY_PERSON' && !personId
    ? { title: 'Choose a person', message: 'Pick someone above to see their documents.' }
    : preset === 'BY_HORSE' && !horseId
    ? { title: 'Choose a horse', message: 'Pick a horse above to see its documents.' }
    : undefined;

  return (
    <div className="max-w-5xl">
      <Helmet>
        <title>Documents — Work queue</title>
      </Helmet>
      <p className="eyebrow mb-2">Ops</p>
      <div className="flex items-center justify-between mb-6">
        <h1 className="heading-section text-green-800">Documents</h1>
        {/* Owner ruling 2026-08-11: the button stays, relabelled, and opens a
            documents-focused picker instead of linking straight to contract
            creation — one document type among many the page handles. */}
        <button type="button" onClick={() => setPickerOpen(true)}
          className="px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
          + Add New
        </button>
      </div>

      <VersionDecisions />

      {/* Preset views: filter presets over the one list, not navigation —
          each just narrows `documents` differently before the status filter
          (in DocumentQueueTable) applies on top. */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => setPreset(p.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
              preset === p.key ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'BY_PERSON' && (
        <div className="mb-4">
          <select className="form-input max-w-xs" value={personId} aria-label="Choose a person"
            onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Choose a person…</option>
            {personOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      {preset === 'BY_HORSE' && (
        <div className="mb-4">
          <select className="form-input max-w-xs" value={horseId} aria-label="Choose a horse"
            onChange={(e) => setHorseId(e.target.value)}>
            <option value="">Choose a horse…</option>
            {horseOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      )}
      {preset === 'SIGNED' && (
        <label className="inline-flex items-center gap-2 text-[12.5px] text-secondary mb-4">
          <input type="checkbox" className="accent-green-700"
            checked={showSuperseded} onChange={(e) => setShowSuperseded(e.target.checked)} />
          Include superseded copies
        </label>
      )}

      {error ? (
        <div role="alert" className="py-8">
          <EmptyState title="Could not load documents" message={error} />
        </div>
      ) : (
        <DocumentQueueTable
          documents={rows}
          loading={loading}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          emptyTitle={emptyCopy?.title}
          emptyMessage={emptyCopy?.message}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      {pickerOpen && (
        <DocumentQueuePicker onClose={() => { setPickerOpen(false); load(); }} />
      )}
    </div>
  );
}
