import { useEffect, useState } from 'react';
import { Users, Pencil, Check } from 'lucide-react';
import {
  documentPartiesSummary, reassignDocumentParty, attachHorseToDocument,
  type PartiesHorseSummary,
} from '../../lib/contracts';
import { contractPartyOptions, staffHorseRecords, type PartyOption, type StaffHorseRecord } from '../../lib/horses';

/**
 * PARTIES & HORSE — a compact summary card at the top of the contract showing who
 * the Lessee / Lessor are and which horse the lease is for. Staff may reassign a
 * party or the horse in place (re-pick a contact / horse record) without recreating
 * the contract; reassigning refreshes the party auto-fill fields and re-merges.
 */
export function PartiesHorseCard({
  documentId, canEdit, onChanged,
}: {
  documentId: string;
  canEdit: boolean;      // staff, on an editable document
  onChanged: () => void; // reload the contract after a reassignment
}) {
  const [summary, setSummary] = useState<PartiesHorseSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => { documentPartiesSummary(documentId).then(setSummary).catch(() => setSummary(null)); };
  useEffect(load, [documentId]);
  useEffect(() => {
    if (!editing || contacts.length) return;
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
  }, [editing, contacts.length]);

  if (!summary) return null;
  const roleLabel = (r: string) => r === 'LESSEE' ? 'Lessee' : r === 'LESSOR' ? 'Lessor'
    : r === 'BUYER' ? 'Buyer' : r === 'SELLER' ? 'Seller' : r;

  async function reassign(role: string, contactId: string) {
    setBusy(true); setErr(null);
    try { await reassignDocumentParty(documentId, role, contactId); load(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not reassign.'); }
    finally { setBusy(false); }
  }
  async function reassignHorse(horseId: string) {
    setBusy(true); setErr(null);
    try { await attachHorseToDocument(documentId, horseId); load(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not change the horse.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-gold-ink" aria-hidden="true" />
        <h2 className="font-serif text-green-800">Parties &amp; Horse</h2>
        {canEdit && (
          <button type="button" className="ml-auto text-xs text-green-800 hover:text-green-700 inline-flex items-center gap-1"
            onClick={() => setEditing((v) => !v)}>
            {editing ? <><Check size={13} /> Done</> : <><Pencil size={12} /> Edit</>}
          </button>
        )}
      </div>
      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
        {summary.parties.map((p) => (
          <div key={p.party_role}>
            <dt className="text-[11px] uppercase tracking-wide text-muted">{roleLabel(p.party_role)}</dt>
            {editing && canEdit ? (
              <select className="form-input mt-0.5" disabled={busy} value={p.contact_id ?? ''}
                onChange={(e) => void reassign(p.party_role, e.target.value)}>
                {!p.contact_id && <option value="">Select…</option>}
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <dd className="text-green-900 font-medium">{p.name ?? '—'}</dd>
            )}
          </div>
        ))}
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Horse</dt>
          {editing && canEdit ? (
            <select className="form-input mt-0.5" disabled={busy} value={summary.horse_id ?? ''}
              onChange={(e) => void reassignHorse(e.target.value)}>
              {!summary.horse_id && <option value="">Select…</option>}
              {horses.map((h) => <option key={h.id} value={h.id}>{h.registered_name || h.nickname || 'Horse'}</option>)}
            </select>
          ) : (
            <dd className="text-green-900 font-medium">{summary.horse_name ?? '—'}</dd>
          )}
        </div>
      </dl>
    </div>
  );
}

export default PartiesHorseCard;
