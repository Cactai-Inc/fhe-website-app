import { useCallback, useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  DataTable,
  FormField,
  Modal,
  ModuleGate,
  useAsync,
  useToast,
  type Column,
} from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listHorseParties,
  createHorseParty,
  updateHorseParty,
  archiveHorseParty,
  restoreHorseParty,
  getRecordHorse,
  listRecordContacts,
  OWNERSHIP_PARTY_ROLES,
  type HorseParty,
  type HorsePartyInput,
  type HorsePartyRole,
  type HorseRecord,
} from '../../../../lib/ops/api-records';
import { contactName as formatContactName } from '../../../../lib/ops/types';
import type { Contact } from '../../../../lib/ops/types';

/**
 * OPS-REC-PARTIES — per-horse ownership/rights ledger (module mod.horserecords).
 *
 * Staff opens /app/ops/records/horses/:horseId/parties → the whole page is
 * wrapped in ModuleGate('mod.horserecords'). Inside the gate: the horse's
 * party rows (listHorseParties) render in a DataTable (contact, role, share %,
 * effective dates); 'Add party' opens a Modal PartyForm whose submit calls
 * createHorseParty with the exact row payload; a row click reopens the form in
 * edit mode → updateHorseParty; the per-row 'Archive' action soft-deletes via
 * archiveHorseParty (the ledger is never hard-deleted). Share-total sanity is
 * surfaced: for every role whose currently-effective rows carry share_pct, a
 * warning renders when the total ≠ 100%. Errors keep the modal open.
 */

/** A party row counts toward today's share total when its effective window
 *  covers today (missing bounds are open-ended). ISO dates compare lexically. */
function isCurrentlyEffective(p: HorseParty, todayIso: string): boolean {
  if (p.effective_from && p.effective_from > todayIso) return false;
  if (p.effective_to && p.effective_to < todayIso) return false;
  return true;
}

/** role → total share_pct across currently-effective rows that set a share.
 *  Roles with no shared rows are omitted (nothing to sanity-check). */
function shareTotalsByRole(
  parties: HorseParty[],
  todayIso: string,
): Partial<Record<HorsePartyRole, number>> {
  const totals: Partial<Record<HorsePartyRole, number>> = {};
  for (const p of parties) {
    if (p.share_pct === null || !isCurrentlyEffective(p, todayIso)) continue;
    totals[p.role] = (totals[p.role] ?? 0) + Number(p.share_pct);
  }
  return totals;
}

type PartyDraft = {
  contact_id: string;
  role: HorsePartyRole;
  share_pct: string;
  effective_from: string;
  effective_to: string;
  notes: string;
};

function draftFrom(party: HorseParty | null): PartyDraft {
  return {
    contact_id: party?.contact_id ?? '',
    role: party?.role ?? 'owner',
    share_pct: party?.share_pct !== null && party?.share_pct !== undefined ? String(party.share_pct) : '',
    effective_from: party?.effective_from ?? '',
    effective_to: party?.effective_to ?? '',
    notes: party?.notes ?? '',
  };
}

function PartyForm({
  horseId,
  party,
  contacts,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  horseId: string;
  party: HorseParty | null;
  contacts: Contact[];
  onSubmit: (input: HorsePartyInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<PartyDraft>(() => draftFrom(party));
  const [contactError, setContactError] = useState<string | null>(null);

  const set = <K extends keyof PartyDraft>(key: K, value: PartyDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.contact_id) {
      setContactError('Choose a contact.');
      return;
    }
    setContactError(null);
    await onSubmit({
      horse_id: horseId,
      contact_id: draft.contact_id,
      role: draft.role,
      share_pct: draft.share_pct.trim() === '' ? null : Number(draft.share_pct),
      effective_from: draft.effective_from || null,
      effective_to: draft.effective_to || null,
      notes: draft.notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Contact" required error={contactError}>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            className={`form-input ${errorClass}`}
            value={draft.contact_id}
            onChange={(e) => set('contact_id', e.target.value)}
          >
            <option value="">Select a contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {formatContactName(c)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Role" required>
        {({ id }) => (
          <select
            id={id}
            className="form-input"
            value={draft.role}
            onChange={(e) => set('role', e.target.value as HorsePartyRole)}
          >
            {/* item 6c — ownership is owner + lessee only; care roles belong to
                Current providers, not the parties ledger. */}
            {OWNERSHIP_PARTY_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {/* item 6c — share % is an ownership concept; shown for owner only. */}
      {draft.role === 'owner' && (
        <FormField label="Share %" hint="Ownership share, e.g. 50. Leave blank for none.">
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              type="number"
              min="0"
              max="100"
              step="0.001"
              className="form-input"
              value={draft.share_pct}
              onChange={(e) => set('share_pct', e.target.value)}
            />
          )}
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Effective from">
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="form-input"
              value={draft.effective_from}
              onChange={(e) => set('effective_from', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Effective to">
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="form-input"
              value={draft.effective_to}
              onChange={(e) => set('effective_to', e.target.value)}
            />
          )}
        </FormField>
      </div>

      <FormField label="Notes">
        {({ id }) => (
          <textarea
            id={id}
            className="form-input"
            rows={2}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {party ? 'Save party' : 'Create party'}
        </button>
      </div>
    </form>
  );
}

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; party: HorseParty };

export function HorsePartiesPage() {
  const { horseId = '' } = useParams<{ horseId: string }>();
  const modules = useModules();
  const toast = useToast();

  const [horse, setHorse] = useState<HorseRecord | null>(null);
  const [parties, setParties] = useState<HorseParty[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const recordsOn = modules['mod.horserecords'] === true;

  const load = useAsync(
    useCallback(async () => {
      const [h, p, c] = await Promise.all([
        getRecordHorse(horseId),
        listHorseParties(horseId, true), // include ended rows for the history
        listRecordContacts(),
      ]);
      return { h, p, c };
    }, [horseId]),
  );

  const refreshParties = useCallback(async () => {
    setParties(await listHorseParties(horseId, true));
  }, [horseId]);

  useEffect(() => {
    if (!recordsOn) return;
    load
      .run()
      .then(({ h, p, c }) => {
        setHorse(h);
        setParties(p);
        setContacts(c);
      })
      .catch(() => {
        /* surfaced via load.isError */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsOn, horseId]);

  const save = useAsync(async (input: HorsePartyInput, editing: HorseParty | null) => {
    return editing ? updateHorseParty(editing.id, input) : createHorseParty(input);
  });

  const handleSubmit = async (input: HorsePartyInput) => {
    const editing = modal.mode === 'edit' ? modal.party : null;
    setFormError(null);
    try {
      await save.run(input, editing);
      await refreshParties();
      toast.success(editing ? 'Party updated.' : 'Party added.');
      setModal({ mode: 'closed' });
    } catch (err) {
      // Error branch: keep the modal open, surface the message.
      setFormError(toErrorMessage(err, 'Could not save party.'));
    }
  };

  /* ⚠️ FIX ROUND item 6a — ENDING a party, not "archiving" it. The row already
     ENDS at the DB (active=false, ended_at); this states what ends, confirms, and
     offers an undo (restoreHorseParty) because an end is reversible. */
  const handleEnd = async (party: HorseParty) => {
    const who = contactName(party.contact_id);
    if (!window.confirm(
      `End ${who} as ${party.role} of this horse?\n\n`
      + 'The relationship ends today and moves to the history below. '
      + 'It is kept, not deleted, and you can undo this.',
    )) return;
    try {
      await archiveHorseParty(party.id);
      await refreshParties();
      toast.success(`Ended ${who} as ${party.role}. It is in the history below — undo there.`);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not end this party.'));
    }
  };

  /* Undo an End from the history list (item 6a). */
  const handleRestore = async (party: HorseParty) => {
    try {
      await restoreHorseParty(party.id);
      await refreshParties();
      toast.success('Restored.');
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not restore this party.'));
    }
  };

  const contactName = useCallback(
    (id: string) => formatContactName(contacts.find((c) => c.id === id)) || id.slice(0, 8),
    [contacts],
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  /* ⚠️ FIX ROUND item 6a — Ownership shows owner + lessee ONLY. Care roles
     (trainer/caretaker/boarder) are not shown here; they live in Current
     providers. Active rows go in the ledger table; ended rows go in the history
     with an undo. Care-role rows (active or ended) are simply not surfaced on this
     page — they are not deleted. */
  const isOwnership = useCallback(
    (p: HorseParty) => OWNERSHIP_PARTY_ROLES.includes(p.role), [],
  );
  const activeParties = useMemo(
    () => parties.filter((p) => p.deleted_at === null && isOwnership(p)),
    [parties, isOwnership],
  );
  const endedParties = useMemo(
    () => parties.filter((p) => p.deleted_at !== null && isOwnership(p)),
    [parties, isOwnership],
  );

  const badTotals = useMemo(() => {
    const totals = shareTotalsByRole(activeParties, todayIso);
    return (Object.entries(totals) as [HorsePartyRole, number][]).filter(
      ([, total]) => total !== 100,
    );
  }, [activeParties, todayIso]);

  const columns: Column<HorseParty>[] = [
    { key: 'contact', header: 'Contact', render: (p) => contactName(p.contact_id) },
    { key: 'role', header: 'Role', render: (p) => p.role },
    {
      key: 'share',
      header: 'Share %',
      render: (p) => (p.share_pct === null ? '—' : `${p.share_pct}%`),
      className: 'text-right',
    },
    { key: 'from', header: 'From', render: (p) => p.effective_from ?? '—' },
    { key: 'to', header: 'To', render: (p) => p.effective_to ?? '—' },
    {
      key: 'source',
      header: 'Source',
      // item 6a — the executed document this ownership/lease row came from.
      render: (p) => (p.source_document_id
        ? <Link to={`/app/ops/documents/${p.source_document_id}`}
            onClick={(e) => e.stopPropagation()}
            className="link-underline text-xs">Document</Link>
        : '—'),
    },
    { key: 'notes', header: 'Notes', render: (p) => p.notes ?? '—' },
  ];

  const horseLabel = horse?.nickname ?? horse?.registered_name ?? 'Horse';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Helmet>
        <title>Ownership &amp; parties · Records</title>
      </Helmet>

      <Link to="/app/ops/records" className="link-underline text-sm">
        ← Records
      </Link>

      <ModuleGate moduleKey="mod.horserecords" modules={modules}>
        <div className="mt-4 flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-green-900">{horseLabel} — parties</h1>
            <p className="text-sm text-green-800/70">
              Ownership and lease for this horse. Care providers live in the health record.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setModal({ mode: 'create' });
            }}
          >
            Add party
          </button>
        </div>

        {toast.toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`mb-4 rounded px-4 py-2 text-sm ${
              t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
            }`}
          >
            {t.message}
          </div>
        ))}

        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load parties.'}
          </p>
        )}

        {/* Share-total sanity: any role whose current shares don't sum to 100%. */}
        {badTotals.map(([role, total]) => (
          <div
            key={role}
            role="alert"
            data-testid={`share-warning-${role}`}
            className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
          >
            {role} shares total {total}% — expected 100%.
          </div>
        ))}

        <DataTable
          columns={columns}
          rows={activeParties}
          rowKey={(p) => p.id}
          loading={load.isPending && parties.length === 0}
          emptyTitle="No owner or lessee yet"
          emptyMessage="Add an owner or lessee for this horse."
          onRowClick={(party) => {
            setFormError(null);
            setModal({ mode: 'edit', party });
          }}
          rowActions={[{ label: 'End', onClick: (p) => void handleEnd(p) }]}
        />

        {/* item 6a — ended ownership/lease rows, kept as history, each undoable. */}
        {endedParties.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-green-900 mb-2">Ended</h2>
            <ul className="flex flex-col gap-1.5">
              {endedParties.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-b border-green-800/[0.06] pb-1.5 text-sm">
                  <span className="text-green-900">
                    {contactName(p.contact_id)} — {p.role}
                    {p.share_pct !== null ? ` · ${p.share_pct}%` : ''}
                    <span className="text-muted">
                      {p.effective_from ? ` · from ${p.effective_from}` : ''}
                      {p.effective_to ? ` to ${p.effective_to}` : ''}
                    </span>
                  </span>
                  <button type="button" onClick={() => void handleRestore(p)}
                    className="text-xs text-green-800 underline underline-offset-2 focus-ring shrink-0">
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Modal
          open={modal.mode !== 'closed'}
          onClose={() => setModal({ mode: 'closed' })}
          title={modal.mode === 'edit' ? 'Edit party' : 'Add party'}
        >
          {modal.mode !== 'closed' && (
            <PartyForm
              horseId={horseId}
              party={modal.mode === 'edit' ? modal.party : null}
              contacts={contacts}
              onSubmit={handleSubmit}
              onCancel={() => setModal({ mode: 'closed' })}
              submitting={save.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default HorsePartiesPage;
