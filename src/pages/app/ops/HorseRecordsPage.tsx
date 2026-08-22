import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fromHere } from '../../../lib/linkOrigin';
import { X, PencilLine, FileText, UserRound, Trash2, HeartPulse, Handshake } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  staffHorseRecords, staffUpdateHorse, staffArchiveHorse, staffAssignHorseParty, staffContactOptions,
  type StaffHorseRecord, type ContactOption,
} from '../../../lib/horses';
import { HorseIntakeForm } from '../../../components/app/HorseIntakeForm';
import { companyContactId } from '../../../lib/horses';
import { generateLeaseAvailability } from '../../../lib/ops/api-lease';
import { listHorseBreeds, listHorseColors } from '../../../lib/api';
import { lookupName } from '../../../lib/ops/types';
import type { LookupCode } from '../../../lib/ops/types';

/**
 * STAFF HORSE RECORDS (spec H.8, /app/ops/horse-records) — the staff side of the
 * single horse-records table. Per record: view everything, edit descriptive
 * fields, assign/reassign the owner and lessee (writes relationship history),
 * see how many documents attach, and add a horse (creation path 4 — the same
 * create_horse_record intake as everywhere else). Trainers + admins.
 */

const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white';

function EditableRecord({
  r, contacts, breeds, colors, onSaved, onOpenContact,
}: {
  r: StaffHorseRecord; contacts: ContactOption[]; breeds: LookupCode[]; colors: LookupCode[]; onSaved: () => void;
  /** TASK-RECORDS (2026-08-12): when composed inside the Records page, opens the
   *  owner/lessee's dossier in place instead of leaving the tab — "a horse links
   *  to its people … without leaving the page." Undefined on the standalone
   *  /app/ops/horse-records route, where owner/lessee render as plain text,
   *  unchanged from before. */
  onOpenContact?: (contactId: string) => void;
}) {
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [patch, setPatch] = useState<Record<string, string>>({});
  const [ownerId, setOwnerId] = useState(r.owner_contact_id ?? '');
  const [lesseeId, setLesseeId] = useState(r.lessee_contact_id ?? '');
  const [leaseStart, setLeaseStart] = useState(r.lease_start ?? '');
  const [leaseEnd, setLeaseEnd] = useState(r.lease_end ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  /* TASK-PAGEMERGE (DUPECENSUS 2.1): breed/color are lookup CODES
   * (horses.breed → horse_breeds, horses.color → horse_colors), and this page
   * was rendering the raw code — the one thing the retired HorsesPage did
   * that this one didn't. `displayValue`, when given, overrides only the
   * read-mode text; the edit-mode input still edits the raw code, same as
   * HorsesPage's own edit form does. */
  const field = (key: keyof StaffHorseRecord & string, label: string, displayValue?: string) => (
    <div key={key}>
      <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-0.5">{label}</p>
      {editing ? (
        <input className={input}
          defaultValue={(r[key] as string | number | null) ?? ''}
          onChange={(e) => setPatch((p) => ({ ...p, [key]: e.target.value }))} />
      ) : (
        <p className="text-sm text-green-900">{displayValue ?? String(r[key] ?? '—')}</p>
      )}
    </div>
  );

  async function genAvailability() {
    setBusy(true); setErr(null); setOkMsg(null);
    try {
      const n = await generateLeaseAvailability(r.id, 4);
      setOkMsg(n > 0 ? `Generated ${n} bookable slots on the calendar.` : 'No new slots (already generated or none due).');
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not generate availability.'));
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
      setErr(toErrorMessage(e, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  /* Owner, 2026-08-15: "i need a delete function on the records page" — the
   * Horses tab had none (Leads/Partners/Vendors/Clients all already did, one
   * way or another). Archive, not delete (D11: nothing is purged). */
  async function archive() {
    if (!confirmArchive) { setConfirmArchive(true); return; }
    setBusy(true); setErr(null);
    try {
      await staffArchiveHorse(r.id);
      onSaved();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not archive.'));
      setConfirmArchive(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-green-800/10 pt-4 mt-3">
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        {field('registered_name', 'Registered name')}
        {field('nickname', 'Barn name')}
        {field('breed', 'Breed', lookupName(breeds, r.breed))}
        {field('color', 'Color', lookupName(colors, r.color))}
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
          {/* TASK-PAGEMERGE (DUPECENSUS 2.1): the two record lanes RecordsHubPage
              owned and this page didn't — the horse_relationships ownership
              ledger and the health log + care team. RecordsHubPage's own
              roster is retired in favor of this tab; these links are what
              carries across. */}
          <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-0.5">Records</p>
          <p className="text-sm text-green-900 inline-flex items-center gap-3">
            <Link to={`/app/ops/records/horses/${r.id}/parties`} className="inline-flex items-center gap-1 text-gold-800 underline underline-offset-2">
              <Handshake size={13} /> Ownership
            </Link>
            <Link to={`/app/ops/records/horses/${r.id}/health`} className="inline-flex items-center gap-1 text-gold-800 underline underline-offset-2">
              <HeartPulse size={13} /> Health
            </Link>
          </p>
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
              <Link to={`/app/contracts/${r.active_lease_doc.document_id}`} state={fromHere(location)} className="underline underline-offset-2 font-medium">
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
          ) : onOpenContact && r.owner_contact_id ? (
            <button type="button" onClick={() => onOpenContact(r.owner_contact_id!)}
              className="text-sm text-green-900 underline underline-offset-2 hover:text-green-700 focus-ring rounded-sm">
              {r.owner_name || r.owner_name_text || '— unassigned'}
            </button>
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
                <>
                  <div className="flex gap-2">
                    <input type="date" className={input} value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} />
                    <input type="date" className={input} value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} />
                  </div>
                  {/* CLOSEOUT §1.4 (owner-ruled): an empty end date is a legitimate
                      permanent state, so the editor says what leaving it empty means. */}
                  <p className="text-[11px] text-muted">
                    Leave the end date empty for an evergreen lease — it runs until terminated.
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-green-900">
              {onOpenContact && r.lessee_contact_id ? (
                <button type="button" onClick={() => onOpenContact(r.lessee_contact_id!)}
                  className="underline underline-offset-2 hover:text-green-700 focus-ring rounded-sm">
                  {r.lessee_name || r.lessee_name_text || '— not leased'}
                </button>
              ) : (r.lessee_name || r.lessee_name_text || '— not leased')}
              {/* CLOSEOUT §1.4: staff must see that an empty end date is deliberate */}
              {(r.lessee_name || r.lessee_name_text || r.lessee_contact_id) && (
                <span className="text-muted text-xs">
                  {r.lease_end ? ` · through ${r.lease_end}` : ' · evergreen — until terminated'}
                </span>
              )}
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
            <button type="button" disabled={busy} onClick={() => void archive()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs focus-ring ml-auto disabled:opacity-60 ${
                confirmArchive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-red-300 text-red-700 hover:bg-red-50'
              }`}>
              <Trash2 size={13} /> {confirmArchive ? 'Really archive?' : 'Archive'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function HorseRecordsPage({ onOpenContact }: { onOpenContact?: (contactId: string) => void } = {}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => { companyContactId().then(setCompanyId).catch(() => {}); }, []);
  useDocumentTitle('Horse records');
  const [rows, setRows] = useState<StaffHorseRecord[] | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([staffHorseRecords(), staffContactOptions(), listHorseBreeds(), listHorseColors()])
      .then(([r, c, b, cl]) => { setRows(r); setContacts(c); setBreeds(b); setColors(cl); setError(null); })
      .catch(() => setError('Could not load horse records.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <PageLayout
      name="Horse records"
      addLabel="horse"
      onAdd={() => setAdding(true)}
      description="The single source of truth for every horse — identity, parties, lease state, and the documents that created them."
    >

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
                    {[lookupName(breeds, r.breed), r.sex, r.height, lookupName(colors, r.color)]
                      .filter((v) => v && v !== '—').join(' · ') || 'No description yet'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11.5px] text-green-900">{r.owner_name || r.owner_name_text || 'Unassigned owner'}</p>
                  <p className="text-[10.5px] text-muted">
                    {r.lessee_name || r.lessee_name_text
                      ? `Leased${r.lease_end ? ` → ${r.lease_end}` : ' → until terminated'}` : 'Not leased'}
                    {' · '}{r.document_count} docs
                  </p>
                </div>
              </div>
            </button>
            {openId === r.id && (
              <EditableRecord r={r} contacts={contacts} breeds={breeds} colors={colors} onSaved={load} onOpenContact={onOpenContact} />
            )}
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
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain pb-8">
              <HorseIntakeForm submitLabel="Create record" ownerContactId={companyId ?? undefined}
                onDone={() => { setAdding(false); load(); }} />
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

/** RETIRED as a standalone route behind a boolean, never deleted (standing
 *  rule from 86a2c33). Owner, 2026-08-15: "we dont need horses as its own
 *  page if we have horses on the records page" — this component itself is
 *  unchanged and still IS the Records "Horses" tab (RecordsPage.tsx renders
 *  it directly); only the standalone /app/ops/horse-records entry point and
 *  nav row go away. /app/ops/horse-records now redirects to
 *  /app/records/horses. */
export const HORSE_RECORDS_STANDALONE_RETIRED = true;
