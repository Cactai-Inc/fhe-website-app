import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModuleGate, useAsync } from '../../../lib/ops';
import { useModules } from '../../../lib/ops/useModules';
import {
  listContacts,
  listHorses,
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
  type CreatePurchaseEngagementInput,
  type CreateSearchEngagementInput,
  type CreateLeaseEngagementInput,
} from '../../../lib/api';
import type { Contact, Horse } from '../../../lib/ops/types';
import {
  EngagementTypePicker,
  type EngagementType,
} from '../../../components/ops/engagements/EngagementTypePicker';
import { PurchaseEngagementForm } from '../../../components/ops/engagements/PurchaseEngagementForm';
import { SearchEngagementForm } from '../../../components/ops/engagements/SearchEngagementForm';
import { LeaseEngagementForm } from '../../../components/ops/engagements/LeaseEngagementForm';

/**
 * OPS-ENG-CREATE — create-engagement wizard (purchase / search / lease).
 *
 * Brokerage-tenant staff opens /app/ops/engagements/new → the whole page is
 * wrapped in ModuleGate('mod.brokerage') (Layer C, §4.3), so a lesson-only
 * tenant sees the lock and NO forms. Inside the gate: pick a type, fill the
 * matching form, submit. Each form's submit is wired to ITS OWN rpc wrapper
 * (create_purchase/search/lease_engagement) with EXACT p-shaped args — no
 * cross-wiring — and a success navigates to the new engagement. A rejected
 * create surfaces the message inline and does NOT navigate.
 */
export function CreateEngagementPage() {
  const modules = useModules();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [type, setType] = useState<EngagementType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadContacts = useAsync(listContacts);
  const loadHorses = useAsync(listHorses);

  const brokerageOn = modules['mod.brokerage'] === true;

  useEffect(() => {
    if (!brokerageOn) return;
    loadContacts
      .run()
      .then(setContacts)
      .catch(() => {
        /* surfaced via loadContacts.isError */
      });
    loadHorses
      .run()
      .then(setHorses)
      .catch(() => {
        /* surfaced via loadHorses.isError */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerageOn]);

  const create = useAsync(
    async (
      kind: EngagementType,
      input:
        | CreatePurchaseEngagementInput
        | CreateSearchEngagementInput
        | CreateLeaseEngagementInput,
    ): Promise<string> => {
      if (kind === 'purchase')
        return createPurchaseEngagement(input as CreatePurchaseEngagementInput);
      if (kind === 'search')
        return createSearchEngagement(input as CreateSearchEngagementInput);
      return createLeaseEngagement(input as CreateLeaseEngagementInput);
    },
  );

  const submit = useCallback(
    async (
      kind: EngagementType,
      input:
        | CreatePurchaseEngagementInput
        | CreateSearchEngagementInput
        | CreateLeaseEngagementInput,
    ) => {
      setFormError(null);
      try {
        const id = await create.run(kind, input);
        navigate(`/app/ops/engagements/${id}`);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'Could not create the engagement.',
        );
      }
    },
    [create, navigate],
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-6">New engagement</h1>

      <ModuleGate moduleKey="mod.brokerage" modules={modules}>
        {(loadContacts.isError || loadHorses.isError) && (
          <p role="alert" className="form-error mb-4">
            Could not load contacts or horses.
          </p>
        )}

        <EngagementTypePicker selected={type} onPick={(t) => { setType(t); setFormError(null); }} />

        {type === 'purchase' && (
          <PurchaseEngagementForm
            contacts={contacts}
            horses={horses}
            onSubmit={(input) => submit('purchase', input)}
            submitting={create.isPending}
            error={formError}
          />
        )}

        {type === 'search' && (
          <SearchEngagementForm
            contacts={contacts}
            horses={horses}
            onSubmit={(input) => submit('search', input)}
            submitting={create.isPending}
            error={formError}
          />
        )}

        {type === 'lease' && (
          <LeaseEngagementForm
            contacts={contacts}
            horses={horses}
            onSubmit={(input) => submit('lease', input)}
            submitting={create.isPending}
            error={formError}
          />
        )}
      </ModuleGate>
    </div>
  );
}

export default CreateEngagementPage;
