import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Plus, PencilLine, FileText, UserRound } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  staffHorseRecords, staffUpdateHorse, staffAssignHorseParty, staffContactOptions,
  type StaffHorseRecord, type ContactOption,
} from '../../../lib/horses';
import { HorseIntakeForm } from '../../../components/app/HorseIntakeForm';
import { companyContactId } from '../../../lib/horses';
import { generateLeaseAvailability } from '../../../lib/ops/api-lease';

/**
 * STAFF HORSE RECORDS (spec H.8, /app/ops/horse-records) — the staff side of the
 * single horse-records table. Per record: view everything, edit descriptive
 * fields, assign/reassign the owner and lessee (writes relationship history),
 * see how many documents attach, and add a horse (creation path 4 — the same
 * create_horse_record intake as everywhere else). Trainers + admins.
 */

const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white';

function EditableRecord({
  r, contacts, onSaved,
}: { r: StaffHorseRecord; contacts: ContactOption[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [patch, setPatch] = useState<Record<string, string>>({});
  const [ownerId, setOwnerId] = useState(r.owner_contact_id ?? '');
  const [lesseeId, setLesseeId] = useState(r.lessee_contact_id ?? '');
  const [leaseStart, setLeaseStart] = useState(r.lease_start ?? '');
  const [leaseEnd, setLeaseEnd] = useState(r.lease_end ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const field = (key: keyof StaffHorseRecord & string, label: string) => (
    <div key={key}>
      <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-0.5">{label}</p>
      {editing ? (
        <input className={input}
          defaultValue={(r[key] as string | number | null) ?? ''}
          onChange={(e) => setPatch((p) => ({ ...p, [key]: e.target.value }))} />
      ) : (
        <p className="text-sm text-green-900">{String(r[key] ?? '—')}</p>
      )}
    </div>
  );

  async function genAvailability() {
    setBusy(true); setErr(null); setOkMsg(null);
    try {
      const n = await generateLeaseAvailability(r.id, 4);
      setOkMsg(n > 0 ? `Generated ${n} bookable slots on the calendar.` : 'No new slots (already generated or none due).');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate availability.');
    } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      if (Object.keys(patch).length > 0) await staffUpdateHorse(r.id, patch);
      if (ownerId !== (r.owner_contact_id ?? '')) {
        await staffAssignHorseParty(r.id, 'OWNER', ownerId || null);
      }
      if (lesseeId !== (r.lessee_contact_id ?? '')
          || leaseStart !== (r.lease_start ?? '') || leaseEnd !== (r.lease_end ?? '')) {
        await staffAssignHorseParty(r.id, 'LESSEE', lesseeId || null, leaseStart || null, leaseEnd || null);
      }
      setEditing(false);
      setPatch({});
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-green-800/10 pt-4 mt-3">
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        {field('registered_name', 'Registered name')}
        {field('nickname', 'Barn name')}
        {field('breed', 'Breed')}
        {field('color', 'Color')}
        {field('markings', 'Markings')}
        {field('sex', 'Sex')}
        {field('height', 'Height')}
        {field('current_location', 'Location')}
        {field('fair_market_value', 'Fair market value')}
        {field('vet_name', 'Vet')}
        {field('vet_phone', 'Vet phone')}
        {field('farrier_name', 'Farrier')}
        {field('farrier_phone', 'Farrier phone')}
        <div>
          <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-0.5">Microchip</p>
          <p className="text-sm text-green-900">{r.microchip_id ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-0.5">Documents</p>
          <p className="text-sm text-green-900 inline-flex items-center gap-1.5">
            <FileText size={13} className="text-gold-800" /> {r.document_count} attached
            <Link to="/app/ops/documents" className="text-gold-800 underline underline-offset-2 text-xs ml-1">open queue</Link>
          </p>
          {r.active_lease_doc && (
            <p className="text-xs text-green-800 mt-1">
              Active lease:{' '}
              <Link to={`/app/contracts/${r.active_lease_doc.document_id}`} className="underline underline-offset-2 font-medium">
                {r.active_lease_doc.display_code ?? 'View lease'}
                {r.active_lease_doc.effective_date ? ` · ${r.active_lease_doc.effective_date}` : ''}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* parties */}
      <div className="grid sm:grid-cols-2 gap-3 bg-cream-100/60 border border-green-800/10 rounded-lg p-3">
        <div>
          <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-1">
            <UserRound size={11} className="inline mr-1" />Owner
          </p>
          {editing ? (
            <select className={input} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">— unassigned{r.owner_name_text ? ` (${r.owner_name_text})` : ''}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>)}
            </select>
          ) : (
            <p className="text-sm text-green-900">{r.owner_name || r.owner_name_text || '— unassigned'}</p>
          )}
        </div>
        <div>
          <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-1">
            <UserRound size={11} className="inline mr-1" />Lessee
          </p>
          {editing ? (
            <div className="flex flex-col gap-2">
              <select className={input} value={lesseeId} onChange={(e) => setLesseeId(e.target.value)}>
                <option value="">— not leased{r.lessee_name_text ? ` (${r.lessee_name_text})` : ''}</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>)}
              </select>
              {lesseeId && (
                <div className="flex gap-2">
                  <input type="date" className={input} value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} />
                  <input type="date" className={input} value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-green-900">
              {r.lessee_name || r.lessee_name_text || '— not leased'}
              {r.lease_end && <span className="text-muted text-xs"> · through {r.lease_end}</span>}
            </p>
          )}
        </div>
      </div>

      {err && <p className="form-error text-sm text-red-700 mt-2">{err}</p>}
      {okMsg && <p className="text-sm text-green-700 mt-2">{okMsg}</p>}
      <div className="flex gap-2 mt-3">
        {editing ? (
          <>
            <button type="button" disabled={busy} onClick={() => void save()}
              className="px-4 py-2 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring disabled:opacity-60">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setPatch({}); }}
              className="px-4 py-2 rounded-lg border border-green-800/15 text-xs text-secondary focus-ring">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-800/15 text-xs text-green-800 hover:bg-green-50 focus-ring">
              <PencilLine size={13} /> Edit record & parties
            </button>
            {r.lessee_contact_id && (!r.lease_end || r.lease_end >= new Date().toISOString().slice(0, 10)) && (
              <button type="button" disabled={busy} onClick={() => void genAvailability()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-800/15 text-xs text-green-800 hover:bg-green-50 focus-ring disabled:opacity-60">
                Generate availability
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HorseRecordsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => { companyContactId().then(setCompanyId).catch(() => {}); }, []);
  useDocumentTitle('Horse records');
  const [rows, setRows] = useState<StaffHorseRecord[] | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([staffHorseRecords(), staffContactOptions()])
      .then(([r, c]) => { setRows(r); setContacts(c); setError(null); })
      .catch(() => setError('Could not load horse records.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-green-900">Horse records</h1>
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
          <Plus size={15} /> Add a horse
        </button>
      </div>
      <p className="text-sm text-green-800/70 mb-6">
        The single source of truth for every horse — identity, parties, lease state,
        and the documents that created them.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {rows === null && !error && <p className="text-sm text-green-800/70">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-green-800/70">No horse records yet — add the first one.</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((r) => (
          <div key={r.id} className="bg-white border border-green-800/10 rounded-xl p-4">
            <button type="button" className="w-full text-left focus-ring rounded-md"
              onClick={() => setOpenId(openId === r.id ? null : r.id)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-green-800 text-lg font-semibold leading-tight truncate">
                    {r.nickname || r.registered_name || 'Horse'}
                    {r.nickname && r.registered_name && (
                      <span className="text-muted font-sans text-sm font-normal"> · {r.registered_name}</span>
                    )}
                  </p>
                  <p className="text-[11.5px] text-muted">
                    {[r.breed, r.sex, r.height, r.color].filter(Boolean).join(' · ') || 'No description yet'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11.5px] text-green-900">{r.owner_name || r.owner_name_text || 'Unassigned owner'}</p>
                  <p className="text-[10.5px] text-muted">
                    {r.lessee_name || r.lessee_name_text
                      ? `Leased${r.lease_end ? ` → ${r.lease_end}` : ''}` : 'Not leased'}
                    {' · '}{r.document_count} docs
                  </p>
                </div>
              </div>
            </button>
            {openId === r.id && <EditableRecord r={r} contacts={contacts} onSaved={load} />}
          </div>
        ))}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAdding(false)}>
          <div className="bg-cream w-full sm:max-w-2xl sm:rounded-2xl flex flex-col max-h-[92dvh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-green-800/10 shrink-0">
              <h2 className="font-serif text-green-800 text-lg">Add a horse</h2>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto pb-8">
              <HorseIntakeForm submitLabel="Create record" ownerContactId={companyId ?? undefined}
                onDone={() => { setAdding(false); load(); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
