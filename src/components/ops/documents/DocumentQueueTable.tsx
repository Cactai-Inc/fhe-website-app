/**
 * OPS-DOCS-QUEUE — presentational documents work-queue table.
 *
 * Renders the in-tenant documents (DRAFT / AWAITING_SIGNATURE / EXECUTED /
 * VOID) via the KIT DataTable with a StatusBadge on `status`, sorted by
 * `generated_at` (newest first). Each row's title is a real <Link> into the
 * OPS-DOC-VIEW viewer at `/app/ops/documents/:id`, so a click opens the
 * viewer/signing surface.
 *
 * Zero data calls — the rows + current status filter are passed in and
 * `onStatusChange(status)` is fired when the operator changes the filter, so
 * the page owns the fetch/filter (proven wired by the page test firing the
 * select change and asserting the data fn + the narrowed rows).
 *
 * TASK-DOCCOLS (20260811): Contract # and Type columns are gone (`contract_id`
 * itself stays on the row — the "Contracts & deals" preset filters on it).
 * Person is gone too, replaced by Party 1 / Party 2 — `deriveDocumentParties`
 * (`lib/ops/partyDisplay.ts`) is the one place `party_role` becomes a labeled,
 * linked party; this file never inspects `party_role` directly. Also added:
 * a Horse link (was plain text), Date Signed/Sent/Voided (Date Generated kept,
 * off by default), Version (with drift note), and a column show/hide menu
 * persisted to localStorage per user.
 *
 * KNOWN GAP (not built here — TASK-FRAMESCROLL's territory per the task):
 * this table has no horizontal-scroll container at any level (DataTable, this
 * file, or the page). Ten possible columns on a fixed-width page will overflow
 * before FRAMESCROLL's fix lands; reported, not patched around here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { fromHere } from '../../../lib/linkOrigin';
import { documentHref } from '../../../lib/documentHref';
import { useAuth } from '../../../contexts/AuthContext';
import { DataTable, StatusBadge } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { DocumentQueueRow } from '../../../lib/ops/types';
import { deriveDocumentParties, deriveDateSigned, deriveVersion } from '../../../lib/ops/partyDisplay';
import type { PartyDisplay } from '../../../lib/ops/partyDisplay';

/** The real status vocabulary (document_status.code) the queue lets the
 *  operator narrow to. `ALL` = no filter. `SENT` never existed as a status —
 *  it matched zero rows — and `VOID` was previously unreachable here only
 *  because it had no option, not because the query excluded it. */
export const QUEUE_STATUS_FILTERS = ['ALL', 'DRAFT', 'AWAITING_SIGNATURE', 'EXECUTED', 'VOID'] as const;
export type QueueStatusFilter = (typeof QUEUE_STATUS_FILTERS)[number];

export interface DocumentQueueTableProps {
  documents: DocumentQueueRow[];
  loading?: boolean;
  statusFilter: QueueStatusFilter;
  onStatusChange: (status: QueueStatusFilter) => void;
  /** Override the empty state — e.g. a preset view that's waiting on a
   *  person/horse pick has nothing to show yet for a different reason than
   *  "no documents exist." */
  emptyTitle?: string;
  emptyMessage?: string;
  /** Soft-deletes the given document ids (the page owns the actual mutation +
   *  reload, same division as `onStatusChange` — this table stays a zero-data-call
   *  presentational component). Rejecting leaves the selection in place so the
   *  operator can retry. */
  onDeleteSelected?: (ids: string[]) => Promise<void>;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

/** Newest-generated first (spec: "sort by generated_at"). */
function byGeneratedAtDesc(a: DocumentQueueRow, b: DocumentQueueRow): number {
  return (b.generated_at ?? '').localeCompare(a.generated_at ?? '');
}

function horseName(h: DocumentQueueRow['horse']): string {
  if (!h) return '—';
  return h.nickname || h.registered_name || '—';
}

/** A labeled, linked (or plain, for the company) party. Party 2 renders as a
 *  genuinely empty cell when there is no second party — not a repeated "—",
 *  per the owner's explicit instruction to pick one empty treatment. */
function PartyCell({ party }: { party: PartyDisplay | null }) {
  if (!party) return null;
  return (
    <span className="block">
      <span className="block text-[10px] uppercase tracking-wide text-green-800/55">{party.label}</span>
      {party.isCompany ? (
        <span className="font-medium text-green-900">{party.name}</span>
      ) : (
        <Link
          to={`/app/admin?open=${party.contactId}`}
          className="link-underline font-medium text-green-900"
        >
          {party.name}
        </Link>
      )}
    </span>
  );
}

function HorseCell({ row }: { row: DocumentQueueRow }) {
  if (!row.horse_id || !row.horse) return <span>—</span>;
  return (
    <Link to={`/app/horses/${row.horse_id}`} className="link-underline">
      {horseName(row.horse)}
    </Link>
  );
}

function VersionCell({ row }: { row: DocumentQueueRow }) {
  const v = deriveVersion(row);
  if (v.version == null) return <span>—</span>;
  return (
    <span>
      v{v.version}
      {v.drift && (
        <span className="block text-[11px] text-gold-700">template now v{v.currentVersion}</span>
      )}
    </span>
  );
}

/** Column definitions, in the order both the table and the toggle menu use.
 *  Every column is independently show/hide-able (owner spec: "a multi select
 *  toggle menu of ALL the columns") — `title` and `status` are not pinned. */
const COLUMN_DEFS: Column<DocumentQueueRow>[] = [
  {
    key: 'title',
    header: 'Document',
    render: (row) => (
      <Link
        // Contract/deal docs open the full contract workspace (fill, send, sign,
        // archive, delete); other docs open the read-only viewer.
        to={documentHref(row)}
        /* RETURN-TO-ORIGIN: back to the ops documents queue, not the member
           documents list. COLUMN_DEFS is module-level so there is no hook here —
           this surface has one fixed home, so naming it is exact, not a guess. */
        state={fromHere('/app/ops/documents')}
        className="link-underline font-sans font-medium text-green-900"
        data-testid={`doc-link-${row.id}`}
      >
        {row.title ?? row.display_code ?? row.id.slice(0, 8)}
      </Link>
    ),
  },
  {
    key: 'party1',
    header: 'Party 1',
    render: (row) => <PartyCell party={deriveDocumentParties(row.parties).party1} />,
  },
  {
    key: 'party2',
    header: 'Party 2',
    render: (row) => <PartyCell party={deriveDocumentParties(row.parties).party2} />,
  },
  {
    key: 'horse',
    header: 'Horse',
    render: (row) => <HorseCell row={row} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'dateSigned',
    header: 'Date Signed',
    render: (row) => <span>{formatDate(deriveDateSigned(row.signatures))}</span>,
  },
  {
    key: 'dateSent',
    header: 'Date Sent',
    render: (row) => <span>{formatDate(row.sent_at)}</span>,
  },
  {
    key: 'dateVoided',
    header: 'Date Voided',
    render: (row) => <span>{formatDate(row.voided_at)}</span>,
  },
  {
    key: 'dateGenerated',
    header: 'Date Generated',
    render: (row) => <span>{formatDate(row.generated_at)}</span>,
  },
  {
    key: 'version',
    header: 'Version',
    render: (row) => <VersionCell row={row} />,
  },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

/** First-time default — a first-time user must not meet an empty or
 *  overwhelming table. "The most relevant date" (owner's words, singular) is
 *  Date Signed: it's the one that tracks EXECUTED, the terminal successful
 *  state. Date Sent/Voided stay off by default (undeclared by the owner's
 *  list) but are one toggle away. */
const DEFAULT_COLUMN_KEYS = ['title', 'party1', 'party2', 'horse', 'status', 'dateSigned'];

const COLUMN_STORAGE_PREFIX = 'docQueue.columns.';

function loadVisibleColumns(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set(DEFAULT_COLUMN_KEYS);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_COLUMN_KEYS);
    const valid = parsed.filter((k): k is string => typeof k === 'string' && ALL_COLUMN_KEYS.includes(k));
    return valid.length > 0 ? new Set(valid) : new Set(DEFAULT_COLUMN_KEYS);
  } catch {
    return new Set(DEFAULT_COLUMN_KEYS);
  }
}

/** Column show/hide state, persisted to localStorage keyed per user — a
 *  display preference, not tenant data, so it doesn't belong in the database
 *  (owner spec explicitly allows this call; flagged as a choice in the task
 *  report). Guards against a zero-column table: the last visible column
 *  can't be unchecked. */
function useColumnVisibility(storageKey: string) {
  const [visible, setVisible] = useState<Set<string>>(() => loadVisibleColumns(storageKey));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...visible]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function toggle(key: string) {
    setVisible((prev) => {
      if (prev.has(key)) {
        if (prev.size === 1) return prev; // at least one column is always on
        const next = new Set(prev);
        next.delete(key);
        return next;
      }
      return new Set(prev).add(key);
    });
  }

  function reset() {
    setVisible(new Set(DEFAULT_COLUMN_KEYS));
  }

  return { visible, toggle, reset };
}

interface ColumnMenuProps {
  visible: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}

/** Keyboard-reachable menu of checkboxes: <details>/<summary> gets focus and
 *  Enter/Space-to-open for free, and every checkbox has its own <label>. */
function ColumnMenu({ visible, onToggle, onReset }: ColumnMenuProps) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        className="list-none cursor-pointer select-none px-3 py-1.5 rounded-lg border border-green-800/20 text-xs font-sans text-green-800 hover:bg-green-800/5 focus-ring inline-block"
        aria-haspopup="true"
      >
        Columns
      </summary>
      <div
        role="menu"
        aria-label="Show or hide columns"
        className="absolute right-0 z-20 mt-1.5 w-56 rounded-lg border border-green-800/15 bg-white p-3 shadow-lg"
      >
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[10px] uppercase tracking-wide text-green-800/55 mb-1">Columns</legend>
          {COLUMN_DEFS.map((col) => (
            <label key={col.key} className="flex items-center gap-2 text-sm text-green-900 cursor-pointer">
              <input
                type="checkbox"
                className="accent-green-700"
                checked={visible.has(col.key)}
                onChange={() => onToggle(col.key)}
                disabled={visible.has(col.key) && visible.size === 1}
              />
              {col.header}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={onReset}
          className="mt-2.5 text-[11px] link-underline text-green-800/80"
        >
          Reset columns
        </button>
      </div>
    </details>
  );
}

/** Header checkbox: checked when every visible row is selected, indeterminate
 *  (native, so it needs the DOM ref rather than a prop) when only some are. */
function SelectAllCheckbox({
  rows, selected, onChange,
}: { rows: DocumentQueueRow[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="accent-green-700 w-[15px] h-[15px]"
      aria-label="Select all documents"
      checked={allSelected}
      onChange={() => onChange(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
    />
  );
}

/** Appears once at least one row is selected. Two-click confirm — same
 *  pattern as the lead-delete button on ContactsPage — so a stray click
 *  can't discard documents. */
function DeleteSelectedBar({
  count, onDelete,
}: { count: number; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setError(null);
    try {
      await onDelete();
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the selected documents.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
      <span className="text-sm text-red-900">{count} selected</span>
      {error && <p role="alert" className="form-error text-[12.5px]">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleClick()}
        className={`ml-auto px-3.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 focus-ring disabled:opacity-50 ${
          confirming ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-red-300 text-red-700 hover:bg-red-100'
        }`}
      >
        <Trash2 size={13} /> {busy ? 'Deleting…' : confirming ? `Really delete ${count}?` : `Delete selected`}
      </button>
    </div>
  );
}

export function DocumentQueueTable({
  documents,
  loading,
  statusFilter,
  onStatusChange,
  emptyTitle = 'No documents',
  emptyMessage = 'Documents generated across engagements will appear here.',
  onDeleteSelected,
}: DocumentQueueTableProps) {
  const { profile } = useAuth();
  const storageKey = `${COLUMN_STORAGE_PREFIX}${profile?.user_id ?? 'anon'}`;
  const { visible, toggle, reset } = useColumnVisibility(storageKey);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = [...documents].sort(byGeneratedAtDesc);
  const rowIdsKey = documents.map((d) => d.id).sort().join(',');

  // Drop stale ids from selection when the underlying set changes (filter
  // switch, preset switch, or a delete completing) — never carry a selection
  // forward that points at a row no longer in view.
  useEffect(() => {
    const ids = new Set(rowIdsKey ? rowIdsKey.split(',') : []);
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => { if (ids.has(id)) next.add(id); else changed = true; });
      return changed ? next : prev;
    });
  }, [rowIdsKey]);

  const columns = useMemo(() => {
    const visibleCols = COLUMN_DEFS.filter((c) => visible.has(c.key));
    if (!onDeleteSelected) return visibleCols;
    const selectCol: Column<DocumentQueueRow> = {
      key: '__select',
      header: <SelectAllCheckbox rows={rows} selected={selected} onChange={setSelected} />,
      className: 'w-8',
      render: (row) => (
        <input
          type="checkbox"
          className="accent-green-700 w-[15px] h-[15px]"
          aria-label={`Select ${row.title ?? row.display_code ?? 'document'}`}
          checked={selected.has(row.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
            return next;
          })}
        />
      ),
    };
    return [selectCol, ...visibleCols];
  }, [visible, onDeleteSelected, rows, selected]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="doc-queue-status" className="form-label">
            Status
          </label>
          <select
            id="doc-queue-status"
            className="form-input max-w-xs"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as QueueStatusFilter)}
          >
            {QUEUE_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status}
              </option>
            ))}
          </select>
        </div>
        <ColumnMenu visible={visible} onToggle={toggle} onReset={reset} />
      </div>
      {onDeleteSelected && selected.size > 0 && (
        <DeleteSelectedBar
          count={selected.size}
          onDelete={() => onDeleteSelected([...selected])}
        />
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
