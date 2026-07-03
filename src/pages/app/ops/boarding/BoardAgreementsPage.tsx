import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import type { FormEvent } from 'react';
import {
  DataTable,
  FormField,
  Modal,
  ModuleGate,
  Money,
  StatusBadge,
  useAsync,
  useToast,
} from '../../../../lib/ops';
import type { Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { useDocumentTitle } from '../../../../lib/hooks';
import { listContacts, listHorses } from '../../../../lib/api';
import { contactName } from '../../../../lib/ops/types';
import type { Contact, Horse } from '../../../../lib/ops/types';
import {
  listBoardAgreements,
  createBoardAgreement,
  updateBoardAgreementStatus,
  listStalls,
  type BoardAgreement,
  type BoardAgreementInput,
  type BoardAgreementStatus,
  type Stall,
} from '../../../../lib/ops/api-boarding';

/**
 * OPS-BOARD-AGREEMENTS — board_agreements list + create + status transitions
 * (module mod.boarding, gated by ModuleGate; RLS `_module_gate` underneath).
 *
 * 'New agreement' opens a Modal form (horse + payer/boarder contact + stall +
 * monthly rate) wired to createBoardAgreement — a BLANK rate is OMITTED from
 * the insert so the DB default config_value('BOARDING','DEFAULT_BOARD_RATE')
 * resolves (§7.5). Per-row transition buttons follow the schema's status CHECK
 * (ACTIVE/SUSPENDED/ENDED/CANCELLED); ENDED/CANCELLED are terminal. Agreements
 * are never hard-deleted (DB REVOKEs DELETE) — status is the lifecycle.
 */

/** Allowed next statuses per the schema's lifecycle. */
const TRANSITIONS: Record<BoardAgreementStatus, BoardAgreementStatus[]> = {
  ACTIVE: ['SUSPENDED', 'ENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'ENDED', 'CANCELLED'],
  ENDED: [],
  CANCELLED: [],
};

const TRANSITION_LABEL: Record<BoardAgreementStatus, string> = {
  ACTIVE: 'Reactivate',
  SUSPENDED: 'Suspend',
  ENDED: 'End',
  CANCELLED: 'Cancel',
};

export function horseLabel(h: Pick<Horse, 'barn_name' | 'registered_name'> | null | undefined): string {
  return h?.barn_name ?? h?.registered_name ?? '—';
}

interface AgreementFormProps {
  horses: Horse[];
  contacts: Contact[];
  stalls: Stall[];
  onSubmit: (input: BoardAgreementInput) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

function AgreementForm({
  horses,
  contacts,
  stalls,
  onSubmit,
  onCancel,
  submitting,
  error,
}: AgreementFormProps) {
  const [horseId, setHorseId] = useState('');
  const [boarderId, setBoarderId] = useState('');
  const [stallId, setStallId] = useState('');
  const [rate, setRate] = useState('');
  const [boardType, setBoardType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!horseId || !boarderId) {
      setFormError('Horse and boarder are required.');
      return;
    }
    setFormError(null);
    await onSubmit({
      horse_id: horseId,
      boarder_contact_id: boarderId,
      stall_id: stallId || null,
      board_rate: rate.trim() === '' ? null : Number(rate),
      board_type: boardType.trim() || null,
      start_date: startDate || null,
      end_date: null,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Horse" required>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select a horse…</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {horseLabel(h)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Boarder" required hint="The payer contact board charges bill to.">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={boarderId}
            onChange={(e) => setBoarderId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select a contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Stall">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={stallId}
            onChange={(e) => setStallId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Unassigned</option>
            {stalls
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                  {s.facility?.name ? ` — ${s.facility.name}` : ''}
                </option>
              ))}
          </select>
        )}
      </FormField>

      <FormField
        label="Monthly rate"
        hint="Leave blank to use the tenant default board rate from the registry."
      >
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            type="number"
            min="0"
            step="0.01"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Board type" hint="e.g. full, pasture, training.">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Start date">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            type="date"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {(formError || error) && (
        <p role="alert" className="form-error mb-4">
          {formError ?? error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving…' : 'Create agreement'}
        </button>
      </div>
    </form>
  );
}

export function BoardAgreementsPage() {
  useDocumentTitle('Board agreements · Boarding');
  const modules = useModules();
  const boardingOn = modules['mod.boarding'] === true;

  const [agreements, setAgreements] = useState<BoardAgreement[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [a, h, c, s] = await Promise.all([
        listBoardAgreements(),
        listHorses(),
        listContacts(),
        listStalls(),
      ]);
      setAgreements(a);
      setHorses(h);
      setContacts(c);
      setStalls(s);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load board agreements.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!boardingOn) return;
    void load();
  }, [boardingOn, load]);

  const create = useAsync(createBoardAgreement);
  const transition = useAsync(updateBoardAgreementStatus);

  const handleCreate = async (input: BoardAgreementInput) => {
    setFormError(null);
    try {
      const created = await create.run(input);
      setAgreements((prev) => [created, ...prev]);
      toast.success('Board agreement created.');
      setCreateOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not create the agreement.'));
    }
  };

  const handleTransition = async (agreement: BoardAgreement, next: BoardAgreementStatus) => {
    try {
      const updated = await transition.run(agreement.id, next);
      setAgreements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(`Agreement ${next.toLowerCase()}.`);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not update the agreement.'));
    }
  };

  const columns: Column<BoardAgreement>[] = [
    { key: 'horse', header: 'Horse', render: (a) => horseLabel(a.horse) },
    { key: 'boarder', header: 'Boarder', render: (a) => contactName(a.boarder) || '—' },
    { key: 'stall', header: 'Stall', render: (a) => a.stall?.code ?? '—' },
    {
      key: 'rate',
      header: 'Monthly rate',
      render: (a) => <Money amount={a.board_rate} />,
      className: 'text-right',
    },
    { key: 'start', header: 'Start', render: (a) => a.start_date ?? '—' },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    {
      key: 'transitions',
      header: <span className="sr-only">Transitions</span>,
      render: (a) => (
        <span className="whitespace-nowrap">
          {TRANSITIONS[a.status].map((next) => (
            <button
              key={next}
              type="button"
              className="link-underline ml-3 first:ml-0"
              disabled={transition.isPending}
              onClick={() => void handleTransition(a, next)}
            >
              {TRANSITION_LABEL[next]}
            </button>
          ))}
        </span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <ModuleGate moduleKey="mod.boarding" modules={modules}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-green-900">Board agreements</h1>
            <p className="text-sm text-green-800/70">
              Per-horse boarding contracts. Agreements archive by status — never delete.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            New agreement
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

        {loadError && (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={agreements}
          rowKey={(a) => a.id}
          loading={loading}
          emptyTitle="No board agreements yet"
          emptyMessage="Create an agreement to link a horse, a payer and a stall."
        />

        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="New board agreement"
          disableBackdropClose={create.isPending}
        >
          {createOpen && (
            <AgreementForm
              horses={horses}
              contacts={contacts}
              stalls={stalls}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
              submitting={create.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default BoardAgreementsPage;
