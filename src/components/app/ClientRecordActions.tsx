import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import {
  categoryDocumentDefaults, setContactRequiredDocuments,
  requestDocumentsFromContact, DISPOSITION_LABEL, type DocumentDisposition,
  getContactRequiredDocumentsState, skipRequiredDocument, unskipRequiredDocument,
  onboardingTemplateOptions,
  adminAttachOfferings, staffAssignableTemplates, staffAssignDocuments,
  type CategoryDocDefault, type AssignableTemplate, type AssignDocumentsResult,
  type RequiredDocumentState,
} from '../../lib/admin';
import {
  contactHorseRecords, horseRecordCompleteness, requestHorseRecordCompletion,
  staffContactOptions,
  type HorseIntakeRecord, type ContactOption,
} from '../../lib/horses';
import { fetchOfferings } from '../../lib/api';
import { HorseIntakeForm } from './HorseIntakeForm';
import { toErrorMessage } from '../../lib/ops/errors';
import type { Offering } from '../../lib/types';

/** The small "+ add" button these panels share. */
/**
 * CLIENT-RECORD ACTIONS — the working parts of the old Clients page, extracted
 * so they can live on the contact dossier.
 *
 * These four were the reason the Clients page could not simply be deleted: they
 * existed NOWHERE else. Each was already keyed on `contactId` rather than a
 * user_id, which is what makes this a move rather than a rewrite — and it is why
 * they work unchanged for the 13 of 19 contacts who have no account.
 *
 * Exported from here and rendered by ContactDossierModal; Admin.tsx no longer
 * defines them.
 */

/** 3f: the assignment picker — CONTRACTS (the clause-engine path, unchanged)
 *  and DOCUMENTS (the flat sign-only family). Selected documents APPEND to the
 *  person's pending set; assignment never gates staff operations — the wall
 *  constrains only the person's own session. On-file never blocks selection.
 *
 *  TASK-DOCQUEUE (20260811): `contactId` is now optional and `initialTemplateKey`
 *  lets a caller open this pre-scoped to one flat template — the documents
 *  picker's "assign and generate" act for a flat card, where there is no
 *  contact in context yet. When `contactId` is omitted, a first step asks
 *  who it's for; both existing callers (ContactDossierModal, Admin.tsx)
 *  already know the contact and skip straight past it, unchanged. */
export function AssignDocumentsModal({
  contactId: fixedContactId, initialTemplateKey, initialTemplateTitle, onClose, onAssigned,
}: {
  contactId?: string; initialTemplateKey?: string; initialTemplateTitle?: string;
  onClose: () => void; onAssigned: () => void;
}) {
  const navigate = useNavigate();
  const [contactId, setContactId] = useState(fixedContactId ?? '');
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [templates, setTemplates] = useState<AssignableTemplate[]>([]);
  const [picked, setPicked] = useState<string[]>(initialTemplateKey ? [initialTemplateKey] : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Explicit confirmation: the modal stays open after a successful assign and
  // states exactly what happened (incl. which signed docs were superseded for
  // re-signature) — no more silent close-and-nothing-changed.
  const [result, setResult] = useState<AssignDocumentsResult | null>(null);

  useEffect(() => {
    if (fixedContactId) return;
    staffContactOptions().then(setContactOptions).catch((e) =>
      setErr(toErrorMessage(e, 'Could not load contacts.')));
  }, [fixedContactId]);

  useEffect(() => {
    if (!contactId) return;
    staffAssignableTemplates(contactId).then(setTemplates).catch((e) =>
      setErr(toErrorMessage(e, 'Could not load templates.')));
  }, [contactId]);

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function assign() {
    if (picked.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const r = await staffAssignDocuments(contactId, picked);
      setResult(r);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not assign.'));
    } finally { setBusy(false); }
  }

  // No contact in context (opened from the documents picker rather than a
  // dossier): ask who it's for before anything else can load.
  if (!contactId) {
    return (
      <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="font-serif text-xl text-green-900 mb-1">Who is this for?</h2>
          {initialTemplateTitle && (
            <p className="text-sm text-muted mb-3">Assigning: {initialTemplateTitle}</p>
          )}
          <select className="form-input mb-4" value="" aria-label="Choose a person"
            onChange={(e) => setContactId(e.target.value)}>
            <option value="">
              {contactOptions.length === 0 && !err ? 'Loading…' : 'Choose…'}
            </option>
            {contactOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
            ))}
          </select>
          {err && <p role="alert" className="text-sm text-red-700 mb-3">{err}</p>}
          <div className="flex justify-end">
            <button type="button" className="btn-outline-gold" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const titleFor = (k: string) => templates.find((t) => t.template_key === k)?.title ?? k;
    return (
      <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onAssigned}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="font-serif text-xl text-green-900 mb-2">Documents assigned</h2>
          <p className="text-sm text-green-900 mb-3">
            {result.assigned.length} document{result.assigned.length === 1 ? '' : 's'} now
            awaiting their signature — they'll be walled to sign at their next sign-in,
            and the list below shows as “Awaiting signature” on this page.
          </p>
          <ul className="text-sm text-green-900 mb-3 flex flex-col gap-1">
            {result.assigned.map((k) => (
              <li key={k} className="flex items-baseline justify-between gap-3 border border-green-800/10 rounded-lg px-3 py-1.5">
                <span>{titleFor(k)}</span>
                {result.resign.includes(k) && (
                  <span className="text-[11px] text-gold-800 whitespace-nowrap">replaces signed copy</span>
                )}
              </li>
            ))}
          </ul>
          {result.resign.length > 0 && (
            <p className="text-xs text-muted mb-4">
              Their previously signed {result.resign.length === 1 ? 'copy is' : 'copies are'} kept
              on file as superseded evidence.
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={onAssigned}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  const onFile = (t: AssignableTemplate) =>
    t.on_file_status === 'none' ? 'None on file'
    : t.on_file_status === 'superseded' ? 'Superseded on file'
    : `Executed v${t.on_file_version ?? t.version}${t.on_file_date ? ` on ${new Date(t.on_file_date).toLocaleDateString()}` : ''}`;

  return (
    <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-green-900 mb-3">Assign documents</h2>

        {/* Opened pre-scoped to one flat template (the documents picker's
            assign-and-generate card): the contract shortcut doesn't apply —
            clause-composed types route to authoring, not here. */}
        {!initialTemplateKey && (
          <>
            <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-1.5">Contracts</p>
            <button type="button" className="btn-outline-gold w-full justify-center mb-4"
              onClick={() => navigate('/app/ops/contracts/new')}>
              New contract (lease / purchase) →
            </button>
          </>
        )}

        <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-1.5">Documents</p>
        <div className="flex flex-col gap-1.5 mb-4">
          {templates.map((t) => (
            <label key={t.template_key}
              className="flex items-start gap-2.5 border border-green-800/10 rounded-lg px-3 py-2 cursor-pointer hover:border-green-800/25">
              <input type="checkbox" className="accent-green-700 mt-0.5"
                checked={picked.includes(t.template_key)} onChange={() => toggle(t.template_key)} />
              <span className="min-w-0">
                <span className="block text-sm text-green-900">{t.title}</span>
                <span className="block text-xs text-muted">
                  {onFile(t)}{t.wall_gating ? ' · gates sign-in' : ''}
                </span>
              </span>
            </label>
          ))}
          {templates.length === 0 && !err && <p className="text-sm text-muted">Loading…</p>}
        </div>

        {err && <p role="alert" className="text-sm text-red-700 mb-3">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline-gold" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={picked.length === 0 || busy} onClick={assign}>
            {busy ? 'Assigning…' : `Assign ${picked.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

/** DOCUMENTS-TAB HORSE CARD — the client's horse records beside their document
 *  list: per horse, a link to the record, its completeness against the
 *  doc-required field set (not started / partially complete / complete, with
 *  what's missing), an admin-editable intake view (staff may contribute), and
 *  a "send task" action that notifies the member to finish the required fields
 *  (existing notifications machinery → their dashboard). */
export function ClientHorseRecordsCard({ contactId }: { contactId: string }) {
  const [horses, setHorses] = useState<HorseIntakeRecord[] | null>(null);
  const [taskSent, setTaskSent] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  /** STABILIZE ITEM 3 — adding a horse FOR a client, from the client's own record. */
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    contactHorseRecords(contactId).then(setHorses).catch(() => setHorses([]));
  }, [contactId]);

  useEffect(() => {
    let active = true;
    contactHorseRecords(contactId)
      .then((h) => active && setHorses(h))
      .catch(() => active && setHorses([]));
    return () => { active = false; };
  }, [contactId]);

  async function sendTask(horseId: string) {
    setTaskSent((p) => ({ ...p, [horseId]: 'sending' }));
    try {
      await requestHorseRecordCompletion(horseId);
      setTaskSent((p) => ({ ...p, [horseId]: 'sent' }));
    } catch {
      setTaskSent((p) => ({ ...p, [horseId]: 'error' }));
    }
  }

  /* STABILIZE ITEM 3 — THE CARD USED TO VANISH WHEN IT WAS MOST NEEDED.
   *
   *     if (horses === null || horses.length === 0) return null;
   *
   * A client with no horse yet is precisely the client staff need to add one
   * for, and this line meant their record showed nothing at all — no list, and
   * no way in. Verified in a browser against production first (STABILIZE rule):
   * Overview, Bookings and Documents on a real client's dossier carry no
   * add-horse control of any kind; the only creation path was the separate
   * Horse Records page, which starts from the horse and not from the person.
   *
   * `null` is still returned while the first fetch is in flight, so the card
   * doesn't flash an empty state over data that is about to arrive.
   *
   * ⚠️ NO NEW FUNCTIONS (D18). The button opens the SAME `HorseIntakeForm` the
   * Horse Records page opens, with `ownerContactId` preset to this client —
   * the one `create_horse_record` intake path, which already honours
   * owner_contact_id for staff. */
  if (horses === null) return null;
  return (
    <div className="mb-4 rounded-lg border border-green-800/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[11px] tracking-wide uppercase text-secondary/70">Horse records</p>
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring">
          <Plus size={13} /> Add a horse
        </button>
      </div>
      {horses.length === 0 && (
        <p className="text-sm text-muted">
          No horse on this client's record yet.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {horses.map((h) => {
          const c = horseRecordCompleteness(h);
          const name = String(h.nickname || h.registered_name || 'Horse');
          const badge = c.state === 'complete' ? 'Complete'
            : c.state === 'partial' ? `Partially complete (${c.answered}/${c.total})`
            : 'Not started';
          const badgeCls = c.state === 'complete' ? 'bg-green-800 text-white'
            : c.state === 'partial' ? 'bg-gold-600 text-white' : 'bg-cream-100 text-secondary';
          const task = taskSent[h.id];
          return (
            <div key={h.id} className="border border-green-800/10 rounded-lg px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/app/horses/${h.id}`} className="text-sm font-medium text-green-900 underline underline-offset-2">
                  {name}
                </Link>
                <span className={`text-[10.5px] uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>
                <span className="flex-1" />
                <Link to={`/app/horse-intake?horse=${h.id}`}
                  className="text-xs text-gold-800 underline underline-offset-2">Open intake form</Link>
                {c.state !== 'complete' && (
                  <button type="button" onClick={() => void sendTask(h.id)}
                    disabled={task === 'sending' || task === 'sent'}
                    className="text-xs text-green-800 border border-green-800/20 rounded-lg px-2.5 py-1 hover:bg-green-50 focus-ring disabled:opacity-60">
                    {task === 'sending' ? 'Sending…' : task === 'sent' ? 'Task sent' : 'Ask them to finish it'}
                  </button>
                )}
              </div>
              {c.state !== 'complete' && c.missing.length > 0 && (
                <p className="text-[11.5px] text-muted mt-1.5">Missing: {c.missing.join(', ')}</p>
              )}
              {task === 'error' && <p className="text-[11.5px] text-red-700 mt-1">Could not send the task.</p>}
            </div>
          );
        })}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setAdding(false)}>
          <div className="bg-cream w-full sm:max-w-2xl sm:rounded-2xl flex flex-col max-h-[92dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-green-800/10 shrink-0">
              <h2 className="font-serif text-green-800 text-lg">Add a horse for this client</h2>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain pb-8">
              <HorseIntakeForm submitLabel="Add horse" ownerContactId={contactId}
                onDone={() => { setAdding(false); load(); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Orders tab action: attach offering(s) to this existing client account via the
 *  canonical spine (attach_offerings_to_client → _provision_purchase_for_offerings). */
export function AttachOfferingPanel({ contactId, onAttached }: { contactId: string; onAttached: () => void }) {
  const [open, setOpen] = useState(false);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [payStatus, setPayStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partial, setPartial] = useState('');
  const [method, setMethod] = useState('Zelle');
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) fetchOfferings().then(setOfferings).catch(() => setOfferings([])); }, [open]);

  // 4a: flat SKUs — an offering IS the purchasable item (the tier layer was
  // removed 2026-07-08). Same fix pattern as ProvisionClientForm.
  const purchasable = offerings.filter(
    (o) => o.config_kind !== 'inquire' && o.price_amount != null);
  const total = purchasable
    .filter((o) => picked.includes(o.id))
    .reduce((s, o) => s + (o.price_amount ?? 0), 0);
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  async function submit() {
    if (picked.length === 0) return;
    setWorking(true); setErr(null);
    try {
      await adminAttachOfferings(contactId, picked, {
        markPaid: payStatus === 'paid',
        ...(payStatus !== 'unpaid' ? { paymentMethod: method } : {}),
        ...(payStatus === 'partial' ? { partialAmount: Number(partial) || 0 } : {}),
      });
      setOpen(false); setPicked([]); setPayStatus('unpaid'); setPartial('');
      onAttached();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not attach offering.'));
    } finally { setWorking(false); }
  }

  /* ⚠️ NOT THE FILLED PILL (owner, 2026-08-25): "maybe dont make it a thing dark
     green button, instead make it an outline that holds space for a new line item
     to be added and just show the button with text as an unfilled button on the
     left side of the inside of the box, and make it the size of the text and make
     it square." So: a bordered box the height of a line item, holding a square
     outline button at its left. The filled `TabCreate` pill this replaced turned
     out to have exactly ONE caller — this one — so it went with it rather than
     being left behind as a helper nothing uses. */
  if (!open) {
    return (
      <div className="border border-green-800/15 p-2 mt-1.5">
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 border border-green-800/40 text-green-900 text-xs font-medium px-2 py-1 hover:bg-green-50 focus-ring">
          <Plus size={12} /> Add offerings
        </button>
      </div>
    );
  }
  return (
    <div className="border border-green-800/15 p-4 mt-1.5">
      <p className="text-sm font-medium text-green-900 mb-2">Add offerings</p>
      <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain mb-3">
        {purchasable.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm text-secondary py-0.5">
            <input type="checkbox" className="accent-green-800" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
            <span className="flex-1">{o.name}</span>
            <span>${Number(o.price_amount ?? 0).toFixed(2)}</span>
          </label>
        ))}
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <span className="text-muted">Total ${total.toFixed(2)} ·</span>
          {(['unpaid', 'partial', 'paid'] as const).map((s) => (
            <button type="button" key={s} onClick={() => setPayStatus(s)}
              className={`px-2.5 py-1 rounded border capitalize text-xs ${payStatus === s ? 'border-green-700 bg-green-50 text-green-900' : 'border-green-800/20 text-secondary'}`}>{s}</button>
          ))}
          {payStatus === 'partial' && (
            <input type="number" min={0} max={total} step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)}
              placeholder="paid" className="form-input w-24 py-1 text-sm" />
          )}
          {payStatus !== 'unpaid' && (
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="form-input w-28 py-1 text-sm">
              {['Zelle', 'Cash', 'Check', 'Card', 'Other'].map((m) => <option key={m}>{m}</option>)}
            </select>
          )}
        </div>
      )}
      {err && <p className="form-error text-xs mb-2">{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={working || picked.length === 0} onClick={submit} className="btn-primary text-xs py-1.5 px-3">
          {working ? 'Attaching…' : 'Attach'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted px-2">Cancel</button>
      </div>
    </div>
  );
}

export function PaperworkEditor({ contactId }: { contactId: string }) {
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  const [allTemplates, setAllTemplates] = useState<{ template_key: string; title: string }[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // CLOSEOUT §1.6: skip state per assigned key — a skipped requirement stays
  // on the record (who/when/why) but stops blocking and is never asked.
  const [skipInfo, setSkipInfo] = useState<Map<string, RequiredDocumentState>>(new Map());
  const [saved, setSaved] = useState(true);
  /* OFFERINGDOCS §11 — ticking a box was SILENT. set_contact_required_documents
     writes an audit row and nothing else, so a person could owe four documents
     and have no way to discover it. This is the act that tells them. */
  const [disposition, setDisposition] = useState<DocumentDisposition>('WHEN_READY');
  const [sending, setSending] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);
  // NOSTRIP: this editor's save can now be REFUSED — executed paperwork is
  // evidence and is never removed. A refusal that lands in an empty catch is
  // indistinguishable from a save, so it is shown.
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(() => {
    getContactRequiredDocumentsState(contactId).then((rows) => {
      setChecked(new Set(rows.map((r) => r.template_key)));
      setSkipInfo(new Map(rows.map((r) => [r.template_key, r])));
    }).catch(() => {});
  }, [contactId]);

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    onboardingTemplateOptions().then(setAllTemplates).catch(() => setAllTemplates([]));
    loadState();
  }, [contactId, loadState]);

  async function skip(key: string) {
    // D19: a value-moving action states itself and captures a reason.
    // NOSTRIP §2: the reason is REQUIRED, not optional — the database refuses a
    // blank one, so asking again here beats bouncing off the RPC.
    const reason = window.prompt(
      'Skip this document? It will stop blocking their access and the contract '
      + 'lock gate, but is NOT signed and stays on the record as skipped.\n\nReason (required):');
    if (reason === null) return;
    if (!reason.trim()) { setError('A reason is required to skip a required document.'); return; }
    setError(null);
    try { await skipRequiredDocument(contactId, key, reason.trim()); loadState(); }
    catch (e) { setError(toErrorMessage(e, 'Could not skip that document.')); }
  }

  async function unskip(key: string) {
    setError(null);
    try { await unskipRequiredDocument(contactId, key); loadState(); }
    catch (e) { setError(toErrorMessage(e, 'Could not restore that document.')); }
  }

  // ⚠️ PARTYROLE §4c — the list is EVERY onboarding document, and the categories
  // are a note on the row rather than the source of the row. Built from the
  // defaults alone it showed 7 of the 9 and silently withheld two from staff; on
  // a contact with no category — a Lessor, a Seller — the whole editor was the
  // union of nothing, so the one surface that can apply a document to a
  // counterparty offered none. `set_contact_required_documents` REPLACES the set,
  // so this control already moves in both directions; what it lacked was reach.
  const templates = (() => {
    const cats = new Map<string, string[]>();
    for (const d of defaults) cats.set(d.template_key, [...(cats.get(d.template_key) ?? []), d.category]);
    const m = new Map<string, { title: string; categories: string[] }>();
    for (const t of allTemplates) {
      m.set(t.template_key, { title: t.title, categories: cats.get(t.template_key) ?? [] });
    }
    // A key already assigned to this contact stays visible even if it is not in
    // the onboarding class — never hide paperwork somebody actually owes.
    for (const d of defaults) {
      if (!m.has(d.template_key)) m.set(d.template_key, { title: d.title, categories: cats.get(d.template_key) ?? [] });
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.title.localeCompare(b.title));
  })();

  async function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setChecked(next); setSaved(false); setError(null);
    try {
      await setContactRequiredDocuments(contactId, Array.from(next));
      setSaved(true);
      loadState();
    } catch (e) {
      // NOSTRIP §1 — the likeliest refusal is "that one is signed". Put the
      // checkbox back where the record actually is rather than leaving the
      // screen showing a removal that never happened.
      setError(toErrorMessage(e, 'Could not save the paperwork.'));
      setSaved(true);
      loadState();
    }
  }

  /** The assigned, unsigned, unskipped set — what asking them is actually about. */
  const outstanding = Array.from(checked).filter((k) => {
    const st = skipInfo.get(k);
    return !st?.satisfied && !st?.skipped_at;
  });

  async function askThem() {
    setSending(true); setError(null); setSentNote(null);
    try {
      const r = await requestDocumentsFromContact(contactId, outstanding, disposition);
      const n = `${r.count} document${r.count === 1 ? '' : 's'}`;
      // ⚠️ NEVER REPORT AN EMAIL THAT DID NOT GO. The requirement and the
      // notification are committed before the mailer runs, so "asked" and
      // "emailed" are separate facts and this says which is which.
      setSentNote(
        !r.has_account
          ? `Set on their record. They have no login yet, so nothing was sent — `
            + `${r.count === 1 ? 'it' : 'they'} will be waiting when they activate.`
          : r.emailed
            ? `Asked for ${n}. Email sent to ${r.email}, and it's on their dashboard — `
              + `they'll see ${r.count === 1 ? 'it' : 'them'} at every sign-in until signed.`
            : `Asked for ${n} — it's on their dashboard, but the email did NOT send`
              + `${r.emailError ? `: ${r.emailError}` : '.'}`);
      loadState();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not ask them for those documents.'));
    } finally { setSending(false); }
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-green-800 text-lg">First-login paperwork</h3>
        <span className={`text-xs ${saved ? 'text-green-700' : 'text-gold-800'}`}>{saved ? 'Saved' : 'Saving…'}</span>
      </div>
      <p className="text-sm text-muted mb-3">
        What they'll be asked to review and sign when they activate. The invitation email lists exactly this.
        {' '}Signed paperwork stays on the record — it is the evidence they were asked and agreed.
      </p>
      {error && <p className="form-error mb-3" role="alert">{error}</p>}

      {/* ⚠️ ASKING IS ITS OWN ACT, AND IT SAYS WHEN (OFFERINGDOCS §10/§11).
          Owner: "if i want to send them docs to sign i can select them from a
          list by checking them off... and they get an email notification, a
          dashboard notification, and on their login the docs are shown to them."
          The list is the checkboxes below — this is the part that was missing.
          `disposition` is the three-way decision, and it now lives on the
          ASSIGNMENT rather than on the template, so the same document can be
          demanded of one person and merely asked of another. */}
      {outstanding.length > 0 && (
        <div className="rounded-lg border border-gold-600/40 bg-gold-50/50 p-3 mb-3">
          <p className="text-[13px] text-green-900 mb-2">
            <strong className="font-medium">{outstanding.length} outstanding.</strong>{' '}
            When do they need to sign?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select className="form-input w-auto text-sm" value={disposition}
              aria-label="When this paperwork is due"
              onChange={(e) => setDisposition(e.target.value as DocumentDisposition)}>
              {(['WHEN_READY', 'AT_LOGIN', 'WITH_CONTRACT'] as DocumentDisposition[]).map((d) => (
                <option key={d} value={d}>{DISPOSITION_LABEL[d]}</option>
              ))}
            </select>
            <button type="button" className="btn-primary text-xs py-1.5 px-3"
              disabled={sending} onClick={() => void askThem()}>
              {sending ? 'Asking…' : 'Ask them to sign'}
            </button>
          </div>
          <p className="text-[11.5px] text-muted mt-1.5">
            {disposition === 'AT_LOGIN'
              ? 'They can’t use the app until these are signed.'
              : disposition === 'WITH_CONTRACT'
                ? 'Held back until their contract executes, then signed with it.'
                : 'Shown at every sign-in until signed — they can leave it for later.'}
          </p>
          {sentNote && <p className="text-[12.5px] text-green-800 mt-2">{sentNote}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2.5">
        {templates.map((t) => (
          <label key={t.key}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border cursor-pointer ${
              checked.has(t.key) ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-green-50/50'
            }`}>
            {/* NOSTRIP §1 — an EXECUTED requirement is never removed by any path.
                The database refuses it; the box must not invite the attempt. */}
            <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
              checked={checked.has(t.key)}
              disabled={skipInfo.get(t.key)?.satisfied === true}
              onChange={() => void toggle(t.key)} />
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] leading-snug ${checked.has(t.key) ? 'text-green-900 font-medium' : 'text-secondary'}`}>{t.title}</span>
              <span className="block text-[11.5px] text-muted mt-0.5">
                {t.categories.length > 0 ? `Suggested for ${t.categories.join(', ')}` : 'Not suggested by any category — apply when the situation calls for it'}
              </span>
              {/* CLOSEOUT §1.6: skip / restore on an assigned, unsigned requirement.
                  Skipping is not signing — the row says so, with who and why. */}
              {(() => {
                const s = skipInfo.get(t.key);
                if (!s) return null;
                if (s.skipped_at) {
                  return (
                    <span className="block text-[11.5px] text-gold-800 mt-1">
                      Skipped {new Date(s.skipped_at).toLocaleDateString()}
                      {s.skipped_by_name ? ` by ${s.skipped_by_name}` : ''}
                      {s.skip_reason ? ` — ${s.skip_reason}` : ''} · not signed, no longer blocking{' '}
                      <button type="button" className="underline underline-offset-2 hover:text-green-700"
                        onClick={(e) => { e.preventDefault(); void unskip(t.key); }}>
                        Restore
                      </button>
                    </span>
                  );
                }
                if (!s.satisfied) {
                  return (
                    <span className="block text-[11.5px] mt-1">
                      <button type="button" className="text-muted underline underline-offset-2 hover:text-green-700"
                        onClick={(e) => { e.preventDefault(); void skip(t.key); }}>
                        Skip — stop this from blocking, without signing it
                      </button>
                    </span>
                  );
                }
                return (
                  <span className="block text-[11.5px] text-green-700 mt-1">
                    Signed — kept as evidence, and cannot be removed or skipped
                  </span>
                );
              })()}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
