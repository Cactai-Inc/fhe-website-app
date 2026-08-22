import { useEffect, useState, type ReactNode } from 'react';
import { Users, Pencil, Check, Plus, MapPin, Phone, Mail, User, FileCheck2, Clock } from 'lucide-react';
import {
  documentPartiesSummary, reassignDocumentParty, attachHorseToDocument,
  addDocumentPartyByEmail, contractRoleDocumentRequirements,
  type PartiesHorseSummary, type PartySummary, type PartyField,
  type RoleDocumentRequirement,
} from '../../lib/contracts';
import { contractPartyOptions, staffHorseRecords, type PartyOption, type StaffHorseRecord } from '../../lib/horses';
import { CaptureInfoModal } from './CaptureInfoModal';

/**
 * PARTIES & HORSE — a compact summary card at the top of the contract showing who
 * the Lessee / Lessor are and which horse the lease is for. Staff may reassign a
 * party or the horse in place (re-pick a contact / horse record) without recreating
 * the contract; reassigning refreshes the party auto-fill fields and re-merges.
 *
 * PARTYEMAIL (2026-08-20) adds two things, and they are two halves of one rule.
 *
 * 1. A party can be put on the contract from an EMAIL ADDRESS ALONE (D22 §7).
 *    contract_party_options only offers contacts that already have a NAME, so a
 *    counterparty we know only by email could not be named on a contract at all
 *    without first being typed into the CRM as a person. The email box below the
 *    picker is that door: the address is matched against the org's contacts, and
 *    only an address we have never seen mints a stub.
 *
 * 2. The card SAYS a missing name blocks signing, in the same words the server's
 *    blocker uses. A2 was two disagreeing completeness checks; the gate is
 *    contract_lock_blockers' `party_name_required`, and this card must not imply a
 *    nameless party is merely untidy when it is unsignable.
 */
export function PartiesHorseCard({
  documentId, canEdit, onChanged, footer,
}: {
  documentId: string;
  canEdit: boolean;      // staff, on an editable document
  onChanged: () => void; // reload the contract after a reassignment
  /** Rendered inside this card, below the parties. The document controls live
   *  here (owner 2026-07-31) rather than in a second card of their own: they
   *  describe what those same parties may do, so splitting them across two cards
   *  put the question and its answer in different places. */
  footer?: React.ReactNode;
}) {
  const [summary, setSummary] = useState<PartiesHorseSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // reusable capture modal: which party + which field(s) to collect
  const [capture, setCapture] = useState<{ party: PartySummary; fields?: PartyField[] } | null>(null);
  // PARTYEMAIL: the email typed into a role's "add by email" box, keyed by role.
  const [emailDraft, setEmailDraft] = useState<Record<string, string>>({});

  /** TASK-ROLEBUNDLE: what each role owes on THIS contract. Empty on error —
   *  a panel that cannot load must not imply nobody owes anything, so it simply
   *  does not render rather than rendering "nothing required". */
  const [roleDocs, setRoleDocs] = useState<RoleDocumentRequirement[]>([]);

  const load = () => {
    documentPartiesSummary(documentId).then(setSummary).catch(() => setSummary(null));
    contractRoleDocumentRequirements(documentId).then(setRoleDocs).catch(() => setRoleDocs([]));
  };
  useEffect(load, [documentId]);
  useEffect(() => {
    if (!editing || contacts.length) return;
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
  }, [editing, contacts.length]);

  if (!summary) return null;
  const roleLabel = (r: string) => r === 'LESSEE' ? 'Lessee' : r === 'LESSOR' ? 'Lessor'
    : r === 'BUYER' ? 'Buyer' : r === 'SELLER' ? 'Seller' : r;
  // Display order: the owner side (Lessor / Seller) first, then the counterparty
  // (Lessee / Buyer), then anything else. The horse block renders after all parties.
  const roleRank = (r: string) => r === 'LESSOR' || r === 'SELLER' ? 0
    : r === 'LESSEE' || r === 'BUYER' ? 1 : 2;

  async function reassign(role: string, contactId: string) {
    setBusy(true); setErr(null);
    try { await reassignDocumentParty(documentId, role, contactId); load(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not reassign.'); }
    finally { setBusy(false); }
  }
  async function addByEmail(role: string) {
    const addr = (emailDraft[role] ?? '').trim();
    if (!addr) return;
    setBusy(true); setErr(null);
    try {
      await addDocumentPartyByEmail(documentId, role, addr);
      setEmailDraft((d) => ({ ...d, [role]: '' }));
      load(); onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that party.');
    } finally { setBusy(false); }
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

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        {/* Owner-first ordering: Lessor / Seller before Lessee / Buyer, then the
            horse block below. (The summary comes back alphabetically by role.) */}
        {[...summary.parties]
          .sort((a, b) => roleRank(a.party_role) - roleRank(b.party_role))
          .map((p) => (
          <div key={p.party_role}>
            <dt className="text-[11px] uppercase tracking-wide text-muted">{roleLabel(p.party_role)}</dt>
            {editing && canEdit ? (
              <>
                <select className="form-input mt-0.5" disabled={busy} value={p.contact_id ?? ''}
                  onChange={(e) => void reassign(p.party_role, e.target.value)}>
                  {!p.contact_id && <option value="">Select…</option>}
                  {/* A party added by email has no name yet, so contract_party_options
                      does not offer it. Show it here anyway, or the picker would read
                      as though nobody is on the contract. */}
                  {p.contact_id && !contacts.some((c) => c.id === p.contact_id) && (
                    <option value={p.contact_id}>{p.name ?? p.email ?? 'Added by email'}</option>
                  )}
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* Not in the list? An email address is enough to make them a party. */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input type="email" inputMode="email" className="form-input text-[13px] py-1"
                    placeholder="or add by email…" disabled={busy}
                    value={emailDraft[p.party_role] ?? ''}
                    onChange={(e) => setEmailDraft((d) => ({ ...d, [p.party_role]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addByEmail(p.party_role); } }}
                    aria-label={`Add the ${roleLabel(p.party_role)} by email address`} />
                  <button type="button" className="btn-outline-gold text-xs px-2.5 py-1 shrink-0"
                    disabled={busy || !(emailDraft[p.party_role] ?? '').trim()}
                    onClick={() => void addByEmail(p.party_role)}>Add</button>
                </div>
                <p className="text-[11px] text-muted mt-1">
                  They fill in their own name, phone and address when they claim the contract.
                </p>
              </>
            ) : (
              <dd className="mt-0.5">
                {p.name
                  ? <span className="text-green-900 font-medium">{p.name}</span>
                  : (
                    /* NO NAME = NOT SIGNABLE. The server's party_name_required
                       blocker refuses the lock, so this says the same thing rather
                       than printing an em dash. */
                    <span className="inline-flex flex-col gap-0.5">
                      {canEdit && p.contact_id ? (
                        <button type="button" onClick={() => setCapture({ party: p, fields: ['name'] })}
                          className="inline-flex items-center gap-1.5 text-gold-ink hover:underline w-fit font-medium">
                          <User size={12} /> Add their full name
                        </button>
                      ) : (
                        <span className="text-muted italic inline-flex items-center gap-1.5">
                          <User size={12} /> No name on file
                        </span>
                      )}
                      <span className="text-[11px] text-red-700">
                        A full name is required before signing.
                      </span>
                    </span>
                  )}
                {/* full contact detail — the value when present, an Add affordance when missing */}
                <div className="mt-1 flex flex-col gap-0.5 text-[13px]">
                  <ContactLine icon={<MapPin size={12} />} value={p.address}
                    missing={p.missing.includes('address')} label="address"
                    onAdd={canEdit && p.contact_id ? () => setCapture({ party: p, fields: ['address'] }) : undefined} />
                  <ContactLine icon={<Phone size={12} />} value={p.phone}
                    missing={p.missing.includes('phone')} label="phone"
                    onAdd={canEdit && p.contact_id ? () => setCapture({ party: p, fields: ['phone'] }) : undefined} />
                  <ContactLine icon={<Mail size={12} />} value={p.email}
                    missing={p.missing.includes('email')} label="email"
                    onAdd={canEdit && p.contact_id ? () => setCapture({ party: p, fields: ['email'] }) : undefined} />
                </div>
                {canEdit && p.contact_id && p.missing.length > 1 && (
                  <button type="button"
                    className="mt-1.5 text-xs text-gold-ink hover:underline inline-flex items-center gap-1"
                    onClick={() => setCapture({ party: p })}>
                    <Plus size={12} /> Complete {roleLabel(p.party_role)}’s info ({p.missing.length} missing)
                  </button>
                )}
              </dd>
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
            <dd className="mt-0.5 text-green-900 font-medium">{summary.horse_name ?? '—'}</dd>
          )}
        </div>
      </dl>

      {capture && (
        <CaptureInfoModal
          documentId={documentId}
          party={capture.party}
          fields={capture.fields}
          onClose={() => setCapture(null)}
          onSaved={() => { setCapture(null); load(); onChanged(); }}
        />
      )}

      {/* ── TASK-ROLEBUNDLE — THE PAPERWORK THIS DEAL CARRIES ──────────────
          Owner (D31): a lease with its authorization and liability releases is
          one event, and "the three documents need to be seen together and live
          in the same known event." This is that view. It is not a second list of
          account paperwork — every row here is owed because of the ROLE its party
          holds ON THIS CONTRACT, read from `contract_role_documents`, which was
          seeded years-of-decisions ago and which nothing had ever read.

          Rows marked "attaches on execution" are NOT gaps. CLOSEOUT §1.5 (owner,
          2026-08-18) deliberately holds the horse documents back until the lease
          executes — "only then is the horse genuinely coming into care" — and
          this panel says so rather than showing an alarm for a document that is
          not due yet. */}
      {roleDocs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-green-800/10">
          <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-2">
            The paperwork this deal carries
          </p>
          <div className="flex flex-col gap-3">
            {Array.from(new Set(roleDocs.map((r) => r.party_role))).map((role) => {
              const rows = roleDocs.filter((r) => r.party_role === role);
              const who = rows[0]?.party_name || rows[0]?.party_email || 'This party';
              const outstanding = rows.filter((r) => !r.satisfied);
              return (
                <div key={role}>
                  <p className="text-[12.5px] text-green-900 mb-1">
                    <span className="font-medium">{who}</span>
                    <span className="text-muted"> · {roleLabel(role)}</span>
                    {outstanding.length === 0 && (
                      <span className="text-green-800"> · all on file</span>
                    )}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {rows.map((r) => (
                      <li key={r.template_key} className="flex items-start gap-1.5 text-[12.5px]">
                        {r.satisfied ? (
                          <>
                            <FileCheck2 size={13} className="text-green-800 mt-0.5 shrink-0" aria-hidden="true" />
                            <span className="text-green-900/80">{r.title}</span>
                            <span className="text-muted">— signed</span>
                          </>
                        ) : r.owned_by === 'ensure_horse_documents@execution' ? (
                          <>
                            <Clock size={13} className="text-muted mt-0.5 shrink-0" aria-hidden="true" />
                            <span className="text-green-900/80">{r.title}</span>
                            <span className="text-muted">— attaches when this lease executes</span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} className="text-gold-800 mt-0.5 shrink-0" aria-hidden="true" />
                            <span className="text-green-900/80">{r.title}</span>
                            <span className="text-gold-800">— not on file</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {footer && (
        <div className="mt-4 pt-4 border-t border-green-800/10">{footer}</div>
      )}
    </div>
  );
}

/** One contact line — shows the value, or a muted "Add …" button when it's missing. */
function ContactLine({
  icon, value, missing, label, onAdd,
}: {
  icon: ReactNode; value: string | null; missing: boolean; label: string;
  onAdd?: () => void;
}) {
  if (value) {
    return (
      <span className="inline-flex items-start gap-1.5 text-green-900/80">
        <span className="text-muted mt-0.5">{icon}</span>
        <span className="min-w-0 break-words">{value}</span>
      </span>
    );
  }
  if (!missing) return null;
  if (onAdd) {
    return (
      <button type="button" onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-gold-ink hover:underline w-fit">
        <span className="text-gold-ink"><Plus size={12} /></span>
        Add {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted italic">
      <span>{icon}</span> No {label} on file
    </span>
  );
}

export default PartiesHorseCard;
