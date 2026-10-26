import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Plus, Paperclip, AlertTriangle, Trash2 } from 'lucide-react';
import {
  horseHealthLog, addHealthProvider, addHealthEvent, deleteHealthEvent,
  uploadHealthEventFile, healthFileUrl,
  PROVIDER_ROLES, PROVIDER_ROLE_LABEL, EVENT_TYPES, EVENT_TYPE_LABEL, EVENT_FIELDS,
  type HealthLog as HealthLogData, type ProviderRole, type EventType, type HealthProvider,
} from '../../lib/health';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * HEALTH LOG (fix round 3, item 6) — a section on the horse record, below the
 * disclosure sections. Visible to staff, the horse's owner, and an active lessee,
 * and editable by the same; nothing here feeds any contract or disclosure.
 *
 *  - a NEXT-DUE strip at the top: every event with a next-due date, soonest first,
 *    overdue marked.
 *  - the care providers: companies with a role, phone and email; people under each.
 *  - the events, newest first, filterable by type and provider, each with its
 *    type-specific fields, notes, next-due and attachments.
 *
 * Add is inline in the record's autosave style — no save button on the section;
 * the add forms commit on their own control. Deleting an event is staff only.
 */

const fmtDate = (s?: string | null) =>
  s ? new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const today = () => new Date().toISOString().slice(0, 10);
function providerLine(p: HealthProvider): string {
  return [p.business_name, p.company_phone, p.company_email].filter(Boolean).join(' · ');
}
function personLine(p: HealthProvider): string {
  return [p.person_name, p.person_phone, p.person_email].filter(Boolean).join(' · ');
}

export function HealthLog({ horseId }: { horseId: string }) {
  const [log, setLog] = useState<HealthLogData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [addingProvider, setAddingProvider] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);

  const load = useCallback(async () => {
    try { setLog(await horseHealthLog(horseId)); setErr(null); }
    catch (e) {
      const msg = toErrorMessage(e, '');
      // A viewer who is not staff, the owner, or an active lessee is not authorized
      // for this horse's health log — show NOTHING, not an error (item 6).
      if (/not authorized|unknown horse/i.test(msg)) { setLog(null); setErr(null); return; }
      setErr(toErrorMessage(e, 'Could not load the health log.'));
    }
  }, [horseId]);
  useEffect(() => { void load(); }, [load]);

  const nextDue = useMemo(() => {
    const rows = (log?.events ?? []).filter((e) => e.next_due_date);
    return rows.sort((a, b) => (a.next_due_date! < b.next_due_date! ? -1 : 1));
  }, [log?.events]);

  const events = useMemo(() => {
    return (log?.events ?? []).filter((e) =>
      (!filterType || e.event_type === filterType)
      && (!filterProvider || e.provider_company_id === filterProvider));
  }, [log?.events, filterType, filterProvider]);

  if (err) return <section className="bg-white border border-green-800/10 rounded-xl p-5"><p role="alert" className="form-error">{err}</p></section>;
  if (!log) return null;
  const { can_edit, is_staff, providers, org_id } = log;
  const t = today();

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={16} className="text-gold-ink" aria-hidden="true" />
        <h2 className="font-serif text-green-800">Health log</h2>
      </div>
      <p className="text-[11px] text-muted mb-4">Care events and providers for this horse. Nothing here appears on a contract.</p>

      {/* Next-due strip */}
      {nextDue.length > 0 && (
        <div className="mb-5 rounded-xl border border-gold-400/50 bg-gold-50 p-3">
          <p className="text-[10.5px] uppercase tracking-wide text-gold-900 font-semibold mb-1.5">Coming due</p>
          <ul className="flex flex-col gap-1">
            {nextDue.map((e) => {
              const overdue = e.next_due_date! < t;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-green-900">{EVENT_TYPE_LABEL[e.event_type]}{e.company_name ? ` · ${e.company_name}` : ''}</span>
                  <span className={overdue ? 'text-red-700 font-medium' : 'text-gold-900'}>
                    {overdue && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
                    due {fmtDate(e.next_due_date)}{overdue ? ' — overdue' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Providers */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Care providers</p>
          {can_edit && !addingProvider && (
            <button type="button" onClick={() => setAddingProvider(true)}
              className="text-xs text-gold-800 hover:underline inline-flex items-center gap-1"><Plus size={12} /> Add provider</button>
          )}
        </div>
        {providers.length === 0 && !addingProvider && <p className="text-sm text-muted">No providers on file yet.</p>}
        {providers.length > 0 && (
          <ul className="flex flex-col gap-2">
            {providers.map((p) => (
              <li key={p.id} className="text-sm">
                <p className="text-green-900">
                  <span className="text-[10px] uppercase tracking-wide text-muted mr-2">{PROVIDER_ROLE_LABEL[p.role as ProviderRole] ?? p.role}{p.role_label ? ` — ${p.role_label}` : ''}</span>
                  {providerLine(p) || p.person_name || '—'}
                </p>
                {personLine(p) && <p className="text-[12.5px] text-secondary ml-1">{personLine(p)}</p>}
              </li>
            ))}
          </ul>
        )}
        {addingProvider && can_edit && (
          <ProviderForm orgId={org_id} horseId={horseId}
            onDone={() => { setAddingProvider(false); void load(); }}
            onCancel={() => setAddingProvider(false)} />
        )}
      </div>

      {/* Events */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Events</p>
          <div className="flex items-center gap-1.5">
            <select className="form-input text-[12px] py-1 w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by type">
              <option value="">All types</option>
              {EVENT_TYPES.map((k) => <option key={k} value={k}>{EVENT_TYPE_LABEL[k]}</option>)}
            </select>
            {providers.length > 0 && (
              <select className="form-input text-[12px] py-1 w-auto" value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} aria-label="Filter by provider">
                <option value="">All providers</option>
                {providers.filter((p) => p.business_name).map((p) => <option key={p.id} value={p.id}>{p.business_name}</option>)}
              </select>
            )}
            {can_edit && !addingEvent && (
              <button type="button" onClick={() => setAddingEvent(true)}
                className="text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-2.5 py-1 hover:bg-gold-50 inline-flex items-center gap-1"><Plus size={12} /> Log event</button>
            )}
          </div>
        </div>

        {addingEvent && can_edit && (
          <EventForm orgId={org_id} horseId={horseId} providers={providers}
            onDone={() => { setAddingEvent(false); void load(); }}
            onCancel={() => setAddingEvent(false)} />
        )}

        {events.length === 0 ? (
          <p className="text-sm text-muted">No events logged yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-green-800/8">
            {events.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-900">
                      {EVENT_TYPE_LABEL[e.event_type]}
                      <span className="text-muted font-normal"> · {fmtDate(e.event_date)}</span>
                    </p>
                    {(e.company_name || e.person_name) && (
                      <p className="text-[12.5px] text-secondary">{[e.company_name, e.person_name].filter(Boolean).join(' — ')}</p>
                    )}
                    {Object.entries(e.structured || {}).filter(([, v]) => v !== '' && v != null).length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                        {Object.entries(e.structured || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => (
                          <li key={k} className="text-[12px] text-green-900/80"><span className="text-muted">{k.replace(/_/g, ' ')}:</span> {String(v)}</li>
                        ))}
                      </ul>
                    )}
                    {e.notes && <p className="text-[12.5px] text-green-900/80 mt-1 whitespace-pre-line">{e.notes}</p>}
                    {e.files.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {e.files.map((f) => (
                          <button key={f.id} type="button" onClick={() => void healthFileUrl(f.path).then((u) => u && window.open(u, '_blank'))}
                            className="inline-flex items-center gap-1 text-[11.5px] text-gold-800 hover:underline"><Paperclip size={11} /> {f.name || 'attachment'}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {is_staff && (
                    <button type="button" onClick={() => void onDelete(e.id)} className="text-[11px] text-muted hover:text-red-700 underline shrink-0"><Trash2 size={12} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  async function onDelete(id: string) {
    if (!window.confirm('Delete this event? This removes it from the record.')) return;
    try { await deleteHealthEvent(id); await load(); } catch (e) { setErr(toErrorMessage(e, 'Could not delete the event.')); }
  }
}

/** Add a provider company (and optionally a person under it). */
function ProviderForm({ horseId, onDone, onCancel }: { orgId: string; horseId: string; onDone: () => void; onCancel: () => void }) {
  const [role, setRole] = useState<ProviderRole>('VET');
  const [roleLabel, setRoleLabel] = useState('');
  const [business, setBusiness] = useState('');
  const [cPhone, setCPhone] = useState(''); const [cEmail, setCEmail] = useState('');
  const [person, setPerson] = useState(''); const [pPhone, setPPhone] = useState(''); const [pEmail, setPEmail] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!business.trim() && !person.trim()) { setErr('Add a company or a person.'); return; }
    setBusy(true); setErr(null);
    try {
      await addHealthProvider({
        horse_id: horseId, relationship: role, role_label: role === 'OTHER' ? roleLabel.trim() : undefined,
        business_name: business.trim() || undefined, phone: cPhone.trim() || undefined, email: cEmail.trim() || undefined,
        party_name_text: person.trim() || undefined, person_phone: pPhone.trim() || undefined, person_email: pEmail.trim() || undefined,
      });
      onDone();
    } catch (e) { setErr(toErrorMessage(e, 'Could not add the provider.')); setBusy(false); }
  }

  return (
    <div className="mt-3 rounded-lg border border-green-800/15 bg-cream-50 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {err && <p role="alert" className="form-error sm:col-span-2 lg:col-span-3">{err}</p>}
      <label className="text-sm"><span className="form-label">Role</span>
        <select className="form-input" value={role} onChange={(e) => setRole(e.target.value as ProviderRole)}>
          {PROVIDER_ROLES.map((r) => <option key={r} value={r}>{PROVIDER_ROLE_LABEL[r]}</option>)}
        </select></label>
      {role === 'OTHER' && (
        <label className="text-sm"><span className="form-label">Label</span>
          <input className="form-input" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="e.g. Nutritionist" /></label>
      )}
      <label className="text-sm"><span className="form-label">Company</span>
        <input className="form-input" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Business name" /></label>
      <label className="text-sm"><span className="form-label">Company phone</span>
        <input className="form-input" value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></label>
      <label className="text-sm"><span className="form-label">Company email</span>
        <input className="form-input" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></label>
      <label className="text-sm"><span className="form-label">Person</span>
        <input className="form-input" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Contact name" /></label>
      <label className="text-sm"><span className="form-label">Person phone</span>
        <input className="form-input" value={pPhone} onChange={(e) => setPPhone(e.target.value)} /></label>
      <label className="text-sm"><span className="form-label">Person email</span>
        <input className="form-input" type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} /></label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Add provider'}</button>
        <button type="button" className="text-xs text-muted underline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Log an event with its type-specific fields + an optional attachment. */
function EventForm({ orgId, horseId, providers, onDone, onCancel }: {
  orgId: string; horseId: string; providers: HealthProvider[]; onDone: () => void; onCancel: () => void;
}) {
  const [type, setType] = useState<EventType>('vet_visit');
  const [date, setDate] = useState(today());
  const [nextDue, setNextDue] = useState('');
  const [company, setCompany] = useState('');
  const [person, setPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [structured, setStructured] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fields = EVENT_FIELDS[type];
  const companies = providers.filter((p) => p.business_name);
  const people = providers.filter((p) => p.person_name);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const id = await addHealthEvent({
        horse_id: horseId, event_type: type, event_date: date || undefined,
        next_due_date: nextDue || null,
        provider_company_id: company || null, provider_person_id: person || null,
        notes: notes.trim() || null, structured,
      });
      const files = fileRef.current?.files;
      if (files && files.length > 0) {
        for (const f of Array.from(files)) await uploadHealthEventFile(horseId, id, orgId, f);
      }
      onDone();
    } catch (e) { setErr(toErrorMessage(e, 'Could not log the event.')); setBusy(false); }
  }

  return (
    <div className="mb-3 rounded-lg border border-green-800/15 bg-cream-50 p-3">
      {err && <p role="alert" className="form-error mb-2">{err}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <label className="text-sm"><span className="form-label">Type</span>
          <select className="form-input" value={type} onChange={(e) => { setType(e.target.value as EventType); setStructured({}); }}>
            {EVENT_TYPES.map((k) => <option key={k} value={k}>{EVENT_TYPE_LABEL[k]}</option>)}
          </select></label>
        <label className="text-sm"><span className="form-label">Date</span>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-sm"><span className="form-label">Next due</span>
          <input type="date" className="form-input" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></label>
        {companies.length > 0 && (
          <label className="text-sm"><span className="form-label">Provider</span>
            <select className="form-input" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">—</option>
              {companies.map((p) => <option key={p.id} value={p.id}>{p.business_name}</option>)}
            </select></label>
        )}
        {people.length > 0 && (
          <label className="text-sm"><span className="form-label">Person</span>
            <select className="form-input" value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">—</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.person_name}</option>)}
            </select></label>
        )}
        {fields.map((f) => (
          <label key={f.key} className={`text-sm ${f.kind === 'long' ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
            <span className="form-label">{f.label}</span>
            {f.kind === 'long'
              ? <textarea rows={2} className="form-input resize-none" value={structured[f.key] ?? ''} onChange={(e) => setStructured((s) => ({ ...s, [f.key]: e.target.value }))} />
              : f.kind === 'yesno'
                ? <select className="form-input" value={structured[f.key] ?? ''} onChange={(e) => setStructured((s) => ({ ...s, [f.key]: e.target.value }))}><option value="">—</option><option value="Yes">Yes</option><option value="No">No</option></select>
                : <input type={f.kind === 'date' ? 'date' : 'text'} className="form-input" value={structured[f.key] ?? ''} onChange={(e) => setStructured((s) => ({ ...s, [f.key]: e.target.value }))} />}
          </label>
        ))}
        <label className="text-sm sm:col-span-2 lg:col-span-3"><span className="form-label">Notes</span>
          <textarea rows={2} className="form-input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <label className="text-sm sm:col-span-2 lg:col-span-3"><span className="form-label">Attachments</span>
          <input ref={fileRef} type="file" multiple className="block text-[12.5px] text-secondary" /></label>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Log event'}</button>
        <button type="button" className="text-xs text-muted underline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default HealthLog;
