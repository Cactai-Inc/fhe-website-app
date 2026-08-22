/**
 * OPS-DOCS-QUEUE — the documents-focused "+ Add New" picker.
 *
 * Owner ruling 2026-08-11: the queue's own button stays (superseding
 * DOCUMENT_LIBRARY_DESIGN.md §J2, which said to remove it), relabelled
 * "+ Add New", and opens a picker — "a list of cards with the document
 * types," like the global Add New button but documents-focused.
 *
 * Every card's act is DERIVED from whether the template has clause defs
 * (documentTypeOptions' `has_clauses`) — never a hardcoded key list:
 *   - clause-composed  → opens the existing authoring flow. Grouped by
 *     `contract_kind` (a real column, not a guessed grouping) so the four
 *     lease variants share one "Horse lease" card — NewContractPage already
 *     has its own version picker for that when more than one exists.
 *   - flat (no clauses) → nothing to author; the act is picking a person,
 *     so the card opens AssignDocumentsModal pre-scoped to that template.
 *
 * A clause-composed kind with no wired standalone entry point today
 * (HORSE_BILL_OF_SALE — generated only as a companion from within an
 * existing sale contract, via startBillOfSale(saleDocumentId)) is left OUT
 * rather than shipped as a card that opens nothing. See
 * docs/reports/TASK-DOCQUEUE-REPORT.md.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileSignature, FileText } from 'lucide-react';
import { documentTypeOptions } from '../../../lib/api';
import type { DocumentTypeOption } from '../../../lib/ops/types';
import { toErrorMessage } from '../../../lib/ops/errors';
import { AssignDocumentsModal } from '../../app/ClientRecordActions';

/** contract_kind → where authoring that kind actually starts. Only kinds
 *  with a real standalone entry point are listed; anything else (a new
 *  clause-composed kind, or one that's companion-only like the bill of
 *  sale) simply has no card until one exists. */
const CONTRACT_KIND_DESTINATION: Record<string, { path: string; label: string; hint: string }> = {
  HORSE_LEASE: {
    path: '/app/ops/contracts/new',
    label: 'Horse lease',
    hint: 'Lease agreement — lessee & lessor',
  },
  HORSE_SALE: {
    path: '/app/ops/contracts/new?type=purchase',
    label: 'Horse sale',
    hint: 'Sale and purchase agreement — buyer & seller',
  },
};

function Card({
  icon: Icon, label, hint, onClick,
}: { icon: typeof FileText; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-white border border-green-800/10 rounded-xl hover:border-green-800/25 focus-ring text-left">
      <span className="w-10 h-10 rounded-lg bg-cream-100 grid place-items-center text-green-700 shrink-0">
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-green-900">{label}</span>
        <span className="block text-[11.5px] text-muted">{hint}</span>
      </span>
    </button>
  );
}

export function DocumentQueuePicker({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [options, setOptions] = useState<DocumentTypeOption[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ key: string; title: string } | null>(null);

  useEffect(() => {
    documentTypeOptions().then(setOptions).catch((e) =>
      setErr(toErrorMessage(e, 'Could not load document types.')));
  }, []);

  const { contractCards, flatOptions } = useMemo(() => {
    const rows = options ?? [];
    const byKind = new Map<string, DocumentTypeOption[]>();
    const flat: DocumentTypeOption[] = [];
    for (const t of rows) {
      if (!t.has_clauses) { flat.push(t); continue; }
      const kind = t.contract_kind ?? t.template_key;
      byKind.set(kind, [...(byKind.get(kind) ?? []), t]);
    }
    const cards = [...byKind.keys()]
      .map((kind) => ({ kind, dest: CONTRACT_KIND_DESTINATION[kind] }))
      // No wired destination yet → leave the card out rather than ship one
      // that opens nothing.
      .filter((c): c is { kind: string; dest: NonNullable<typeof c.dest> } => !!c.dest);
    return {
      contractCards: cards,
      flatOptions: flat.sort((a, b) => a.title.localeCompare(b.title)),
    };
  }, [options]);

  // A flat card's act is "assign and generate" — pick a person, pre-scoped
  // to that one template. AssignDocumentsModal owns the whole rest of the
  // flow (person step when no contact is known, confirmation), so once a
  // card is picked, THIS picker steps aside for it rather than layering
  // another dialog on top.
  if (assignTarget) {
    return (
      <AssignDocumentsModal
        initialTemplateKey={assignTarget.key}
        initialTemplateTitle={assignTarget.title}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => { setAssignTarget(null); onClose(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:rounded-2xl sm:max-w-md flex flex-col max-h-[92dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center p-4 border-b border-green-800/10 bg-cream shrink-0">
          <div />
          <h2 className="font-serif text-green-800 text-lg text-center">Add New</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="justify-self-end text-secondary hover:text-green-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain pb-8">
          {err && <p role="alert" className="form-error mb-3">{err}</p>}
          {!options && !err && <p className="text-sm text-muted">Loading…</p>}
          {options && (
            <div className="flex flex-col gap-2.5">
              {contractCards.length > 0 && (
                <>
                  <p className="text-[10px] tracking-widest uppercase text-muted font-semibold">Contracts</p>
                  {contractCards.map((c) => (
                    <Card key={c.kind} icon={FileSignature} label={c.dest.label} hint={c.dest.hint}
                      onClick={() => { onClose(); navigate(c.dest.path); }} />
                  ))}
                </>
              )}
              {flatOptions.length > 0 && (
                <>
                  <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-2">Documents</p>
                  {flatOptions.map((t) => (
                    <Card key={t.template_key} icon={FileText} label={t.title} hint="Assign to a person to sign"
                      onClick={() => setAssignTarget({ key: t.template_key, title: t.title })} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
