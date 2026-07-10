import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ModuleGate, useAsync } from '../../../lib/ops';
import { useModules } from '../../../lib/ops/useModules';
import {
  listContacts,
  listHorses,
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
  listServiceTypes,
  createServiceEngagement,
  type CreatePurchaseEngagementInput,
  type CreateSearchEngagementInput,
  type CreateLeaseEngagementInput,
  type ServiceTypeRow,
} from '../../../lib/api';
import { contactName } from '../../../lib/ops/types';
import type { Contact, Horse } from '../../../lib/ops/types';
import {
  EngagementTypePicker,
  type EngagementType,
} from '../../../components/ops/engagements/EngagementTypePicker';
import { PurchaseEngagementForm } from '../../../components/ops/engagements/PurchaseEngagementForm';
import { SearchEngagementForm } from '../../../components/ops/engagements/SearchEngagementForm';
import { LeaseEngagementForm } from '../../../components/ops/engagements/LeaseEngagementForm';

/**
 * OPS-ENG-CREATE — create-engagement wizard.
 *
 * TWO families (owner-reported gap: only brokerage deals were offered):
 *  SERVICES — the whole catalog (lessons, subscriptions, training, care) from
 *    the service_types registry via create_service_engagement. Core, no module
 *    gate. Client + service (+ horse when the service requires one) + start.
 *  BROKERAGE DEALS — purchase / search / lease via their dedicated RPCs,
 *    gated by mod.brokerage exactly as before.
 * ?contact=<id> preselects the client (the account page's "+ engagement").
 */

const SEGMENT_LABEL: Record<string, string> = {
  rider: 'Riding & lessons', horse: 'Horse services', support: 'Support services',
};

function ServiceEngagementForm({
  contacts, horses, presetContact, onDone,
}: {
  contacts: Contact[]; horses: Horse[]; presetContact: string | null;
  onDone: (id: string) => void;
}) {
  const [services, setServices] = useState<ServiceTypeRow[]>([]);
  const [contactId, setContactId] = useState(presetContact ?? '');
  const [serviceType, setServiceType] = useState('');
  const [horseId, setHorseId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listServiceTypes().then(setServices).catch(() => setServices([]));
  }, []);
  useEffect(() => { if (presetContact) setContactId(presetContact); }, [presetContact]);

  const selected = services.find((s) => s.code === serviceType);
  const segments = Array.from(new Set(services.map((s) => s.segment)));
  const ready = !!contactId && !!serviceType && (!selected?.requires_horse || !!horseId);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      const id = await createServiceEngagement({
        clientContactId: contactId,
        serviceType,
        horseId: selected?.requires_horse ? horseId : null,
        startDate: startDate || null,
        notes: notes || null,
      });
      onDone(id);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not create the engagement.'));
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-6 mt-4">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <span className="form-label">Client</span>
          <select className="form-input" value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Client">
            <option value="">Choose…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{contactName(c) || c.email || c.id}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="form-label">Service</span>
          <select className="form-input" value={serviceType} onChange={(e) => setServiceType(e.target.value)} aria-label="Service">
            <option value="">Choose…</option>
            {segments.map((seg) => (
              <optgroup key={seg} label={SEGMENT_LABEL[seg] ?? seg}>
                {services.filter((s) => s.segment === seg).map((s) => (
                  <option key={s.code} value={s.code}>{s.display_name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {selected?.description && <p className="text-[12px] text-muted mt-1.5">{selected.description}</p>}
        </div>
        {selected?.requires_horse && (
          <div>
            <span className="form-label">Horse</span>
            <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)} aria-label="Horse">
              <option value="">{horses.length === 0 ? 'No horse records' : 'Choose…'}</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.barn_name || h.registered_name || h.id}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <span className="form-label">Start date (optional)</span>
          <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <span className="form-label">Notes (optional)</span>
          <textarea rows={2} className="form-input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 4x monthly, prefers mornings" />
        </div>
      </div>
      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      <button type="button" className="btn-primary" disabled={busy || !ready} onClick={() => void submit()}>
        {busy ? 'Creating…' : 'Create engagement'}
      </button>
      <p className="text-[12px] text-muted mt-2">
        Its paperwork (per this service's requirements) generates when the client
        goes through signing — nothing is emailed by this step.
      </p>
    </div>
  );
}

export function CreateEngagementPage() {
  const modules = useModules();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetContact = params.get('contact');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [family, setFamily] = useState<'service' | 'brokerage'>('service');
  const [type, setType] = useState<EngagementType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadContacts = useAsync(listContacts);
  const loadHorses = useAsync(listHorses);

  useEffect(() => {
    loadContacts.run().then(setContacts).catch(() => { /* surfaced below */ });
    loadHorses.run().then(setHorses).catch(() => { /* surfaced below */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setFormError(toErrorMessage(err, 'Could not create the engagement.'));
      }
    },
    [create, navigate],
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">New engagement</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Services (lessons, training, care) or a brokerage deal.
      </p>

      {(loadContacts.isError || loadHorses.isError) && (
        <p role="alert" className="form-error mb-4">Could not load contacts or horses.</p>
      )}

      {/* family — buttons desktop, dropdown mobile */}
      <div className="hidden sm:flex gap-1.5 mb-4">
        {([['service', 'Services'], ['brokerage', 'Brokerage deals']] as ['service' | 'brokerage', string][]).map(([f, label]) => (
          <button key={f} type="button" onClick={() => { setFamily(f); setType(null); setFormError(null); }}
            className={`px-4 py-2 rounded-full text-sm font-sans focus-ring ${
              family === f ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {label}
          </button>
        ))}
      </div>
      <select className="form-input sm:hidden mb-4" value={family} aria-label="Engagement family"
        onChange={(e) => { setFamily(e.target.value as 'service' | 'brokerage'); setType(null); }}>
        <option value="service">Services</option>
        <option value="brokerage">Brokerage deals</option>
      </select>

      {family === 'service' && (
        <ServiceEngagementForm
          contacts={contacts}
          horses={horses}
          presetContact={presetContact}
          onDone={(id) => navigate(`/app/ops/engagements/${id}`)}
        />
      )}

      {family === 'brokerage' && (
        <ModuleGate moduleKey="mod.brokerage" modules={modules}>
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
      )}
    </div>
  );
}

export default CreateEngagementPage;
