import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText, CheckCircle2, Lock, Send, PenLine, ShieldCheck, RotateCcw, MessageSquarePlus,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import {
  contractDocumentDetail, setContractField,
  resolveChangeRequest, advanceWorkflow, sendForReview, lockAndSign, confirmHorseSection,
  reopenHorseSection,
  setPartyControls, contractSigningSet,
  contractRedlineState, resolveFieldEdit, withdrawFieldEdit,
  resolveClause, withdrawClause, attachHorseToDocument,
  sendContractToParty, cancelContract, archiveContract, hardDeleteContract,
  setFieldResponsibility, setFieldIncluded, setFieldNa, setFieldControlOverride, setFieldStructured,
  postContractComment, documentPartiesSummary, captureContactInfo, captureHorseRecord,
  saveContract, inviteCounterparty,
  requestContractTermination, approveContractTermination, declineContractTermination,
  setDocumentPartyArchived, deleteContractWithCopy,
  type ContractDetail, type ContractField, type PartyControls,
  type SigningSetDoc, type RedlineState, type PartiesHorseSummary, type PartySummary,
} from '../../lib/contracts';
import { CaptureInfoModal } from '../../components/app/CaptureInfoModal';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { ContractCascade, ContractBody } from '../../components/app/ContractCascade';
import { AddElementButton } from '../../components/app/AddElementModal';
import { PartyControlsCard, type PartyControlValues } from '../../components/app/PartyControlsCard';
import { TrackChangesPanel } from '../../components/app/TrackChangesPanel';
import { ContractComments } from '../../components/app/ContractComments';
import { PartiesHorseCard } from '../../components/app/PartiesHorseCard';
import { ClauseDocument } from '../../components/app/ClauseDocument';
import { contractTemplateStructure, type TemplateStructure } from '../../lib/contracts';

/**
 * CONTRACT (/app/contracts/:id) — the negotiated-contract surface (Update A).
 * One page, two postures decided by the caller's relationship to the document:
 *  - OWNER/STAFF authoring: fields grouped by section (cost categories compose
 *    "Lessor 60% / Lessee 40%" phrases), the Lessor horse-confirm control, the
 *    recipient-editing toggle, counterparty invite, workflow advance, sign-last.
 *  - COUNTERPARTY: their intake (can_edit fields only), change requests on DEAL
 *    terms when recipient_editing, the finished document review, sign-first.
 * The engine (RLS + ownership matrix + state machine + re-merge at lock) is the
 * authority — this page only calls its RPCs and renders what detail returns.
 */


/** "Which horse is this contract for?" gate. Shown before the rest of the contract
 *  when the horse section is the caller's to fill but no horse is chosen yet. Lets
 *  them pick one of their horse records or add a new one (via intake), then attaches
 *  it — filling the HORSE.* fields from the record. */
function HorseGate({ documentId, onAttached }: { documentId: string; onAttached: () => void }) {
  const [horses, setHorses] = useState<StableHorse[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listStableHorses().then(setHorses).catch(() => setHorses([]));
  }, []);

  async function attach(horseId: string) {
    setBusy(horseId); setErr(null);
    try { await attachHorseToDocument(documentId, horseId); onAttached(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not attach that horse.'); setBusy(null); }
  }

  return (
    <section className="bg-gold-50 border border-gold-500/40 rounded-xl p-6 mb-5">
      <h2 className="font-serif text-green-900 text-lg mb-1">Which horse is this contract for?</h2>
      <p className="text-[13px] text-green-900/75 mb-4">
        Choose the horse this agreement covers. We'll fill in its details for you. If the right
        horse isn't listed, add it — it becomes a record on your account.
      </p>
      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      {horses === null ? (
        <p className="text-sm text-muted">Loading your horses…</p>
      ) : (
        <div className="flex flex-col gap-2 max-w-xl">
          {horses.map((h) => (
            <button key={h.id} type="button" disabled={!!busy} onClick={() => void attach(h.id)}
              className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-3 text-left hover:border-green-800/30 focus-ring disabled:opacity-50">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-green-900 truncate">{h.name}</span>
                <span className="block text-xs text-muted truncate">
                  {[h.breed, h.sex, h.color].filter(Boolean).join(' · ') || 'Horse record'}
                </span>
              </span>
              <span className="text-xs text-gold-800 font-medium shrink-0">
                {busy === h.id ? 'Attaching…' : 'Use this horse →'}
              </span>
            </button>
          ))}
          <Link to={`/app/horse-intake?contract=${documentId}`}
            className="flex items-center justify-center gap-2 border border-dashed border-green-800/30 rounded-lg px-4 py-3 text-sm text-green-800 hover:bg-white focus-ring">
            + Add a different horse
          </Link>
        </div>
      )}
    </section>
  );
}


/** Redlining: propose an edit (staged, highlighted) or add a free-text clause,
 *  gated by the party's controls; the owner/staff accept or reject. */
function RedlineSection({
  documentId, redline, isOwnerSide, onChanged,
}: {
  documentId: string;
  redline: RedlineState;
  isOwnerSide: boolean;
  onChanged: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, reset?: () => void) {
    setBusy(true); setErr(null);
    try { await fn(); reset?.(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'That action failed.'); }
    finally { setBusy(false); }
  }

  const pendingEdits = redline.field_proposals;
  const openClauses = redline.addenda.filter((a) => a.status === 'open');
  const acceptedClauses = redline.addenda.filter((a) => a.status === 'accepted');
  // Show ONLY when something is actually pending/agreed to review — never just
  // because a party *could* suggest edits. (Adding clauses now lives in the
  // unified Add toolbar, so an empty "Proposed changes" box must not render at
  // the top of a fresh contract.)
  const anything = pendingEdits.length > 0 || redline.addenda.length > 0;
  if (!anything) return null;

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5 mb-4">
      <h2 className="font-serif text-lg text-green-900 mb-1">Proposed changes</h2>
      <p className="text-[12.5px] text-muted mb-4">
        Proposed edits and new clauses are highlighted here until the owner accepts or rejects them.
      </p>

      {/* pending edits */}
      {pendingEdits.map((p) => (
        <div key={p.field_key} className="border-l-4 border-gold-400 bg-gold-50/60 rounded-r-lg p-3 mb-2.5">
          <p className="text-xs text-gold-900 font-medium mb-1">
            Edit proposed{p.proposed_by ? ` by ${p.proposed_by}` : ''} · {p.label || p.field_key}
          </p>
          <p className="text-sm text-green-900">
            <span className="line-through text-muted">{p.current_value || '—'}</span>
            {' → '}
            <span className="font-medium bg-gold-100 px-1 rounded">{p.proposed_value || '—'}</span>
          </p>
          <div className="flex gap-2 mt-2">
            {isOwnerSide ? (
              <>
                <button type="button" className="btn-primary text-xs" disabled={busy}
                  onClick={() => void run(() => resolveFieldEdit(documentId, p.field_key, true))}>Accept</button>
                <button type="button" className="text-xs text-red-700 px-3 py-1 hover:bg-red-50 rounded" disabled={busy}
                  onClick={() => void run(() => resolveFieldEdit(documentId, p.field_key, false))}>Reject</button>
              </>
            ) : p.mine ? (
              <button type="button" className="text-xs underline text-secondary" disabled={busy}
                onClick={() => void run(() => withdrawFieldEdit(documentId, p.field_key))}>Withdraw</button>
            ) : <span className="text-xs text-muted">Pending owner review</span>}
          </div>
        </div>
      ))}

      {/* clauses (open = highlighted pending; accepted = agreed) */}
      {openClauses.map((a) => (
        <div key={a.id} className="border-l-4 border-gold-400 bg-gold-50/60 rounded-r-lg p-3 mb-2.5">
          <p className="text-xs text-gold-900 font-medium mb-1">
            New clause proposed{a.proposed_by ? ` by ${a.proposed_by}` : ''}{a.proposed_by_role ? ` (${a.proposed_by_role})` : ''}
          </p>
          <p className="text-sm text-green-900 whitespace-pre-line">{a.body}</p>
          <div className="flex gap-2 mt-2">
            {isOwnerSide ? (
              <>
                <button type="button" className="btn-primary text-xs" disabled={busy}
                  onClick={() => void run(() => resolveClause(a.id, true))}>Accept</button>
                <button type="button" className="text-xs text-red-700 px-3 py-1 hover:bg-red-50 rounded" disabled={busy}
                  onClick={() => void run(() => resolveClause(a.id, false))}>Reject</button>
              </>
            ) : a.mine ? (
              <button type="button" className="text-xs underline text-secondary" disabled={busy}
                onClick={() => void run(() => withdrawClause(a.id))}>Withdraw</button>
            ) : <span className="text-xs text-muted">Pending owner review</span>}
          </div>
        </div>
      ))}

      {acceptedClauses.length > 0 && (
        <div className="mb-2.5">
          <p className="form-label mb-1">Agreed additional terms</p>
          <ul className="text-sm text-green-900 flex flex-col gap-1">
            {acceptedClauses.map((a, i) => (
              <li key={a.id} className="flex gap-2"><span className="text-muted">A-{i + 1}.</span><span className="whitespace-pre-line">{a.body}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* (The "Add a clause" box moved out of here into the unified Add toolbar
          (M-2) — clause proposals now live alongside add-field/section. This
          section is purely the review surface for pending edits + clauses.) */}
      {err && <p role="alert" className="form-error mt-2">{err}</p>}
    </section>
  );
}

export default function ContractPage({ documentId, embedded }: { documentId?: string; embedded?: boolean } = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = documentId ?? routeId;   // embedded (inline on the creation page) or routed
  const navigate = useNavigate();
  useDocumentTitle('Contract');
  const { isStaff } = useAuth();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [signingSet, setSigningSet] = useState<SigningSetDoc[]>([]);
  const [redline, setRedline] = useState<RedlineState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [signName, setSignName] = useState('');
  // Staff signing on a party's behalf (barn-office wet-signing): one typed-name
  // draft per party role. Keyed by role so multiple parties can be signed here.
  const [behalfNames, setBehalfNames] = useState<Record<string, string>>({});
  // Document body is visible by default (DocuSign principle: you sign what you
  // see). Parties can collapse it while filling fields, but it no longer hides.
  const [showBody, setShowBody] = useState(true);
  // changeKey bumps to reload the track-changes + comments panels after any edit.
  const [changeKey, setChangeKey] = useState(0);
  // Clause structure for clause-model (Section›Clause›Field) documents.
  const [structure, setStructure] = useState<TemplateStructure | null>(null);
  // Comments UX: visibility toggle, comment count, and the two-step Add-a-Comment
  // modal (pick a section → author the comment inline in the modal).
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [commentModal, setCommentModal] = useState<
    | { step: 'pick' }
    | { step: 'write'; anchorRef: string; heading: string }
    | null
  >(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  // Parties/horse summary drives the "required info missing" gate on lock, and the
  // capture modal shown when locking with gaps.
  const [partiesSummary, setPartiesSummary] = useState<PartiesHorseSummary | null>(null);
  const [captureParty, setCaptureParty] = useState<PartySummary | null>(null);
  // Extra recipient emails typed into the Send-for-review card (beyond the emails
  // already on file for each party). The draft is the in-progress input.
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [extraEmailDraft, setExtraEmailDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await contractDocumentDetail(id));
      contractSigningSet(id).then(setSigningSet).catch(() => setSigningSet([]));
      contractRedlineState(id).then(setRedline).catch(() => setRedline(null));
      documentPartiesSummary(id).then(setPartiesSummary).catch(() => setPartiesSummary(null));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the contract.');
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const doc = detail?.document;

  // Fetch the clause structure for clause-model documents (those carrying a
  // template_key with section/clause defs). Null → render the legacy flat grouping.
  const templateKey = doc?.template_key ?? null;
  useEffect(() => {
    if (!templateKey) { setStructure(null); return; }
    contractTemplateStructure(templateKey)
      .then((s) => setStructure(s.sections.length > 0 ? s : null))
      .catch(() => setStructure(null));
  }, [templateKey]);

  // Email the signer a PDF copy once the document is executed. The endpoint is
  // idempotent per (document, recipient), so viewing an already-delivered doc
  // re-checks but never re-sends.
  const deliveredRef = useRef(false);
  // Belt-and-suspenders executed-copy delivery. The endpoint is idempotent per
  // (document, recipient), so calling it more than once never double-sends. We
  // trigger it (a) on viewing an executed doc AND (b) immediately after a final
  // signature (see deliverExecutedCopy below), so the PDF reaches both parties as
  // soon as the contract is executed even if no one re-opens the page.
  const deliverExecutedCopy = useCallback(() => {
    if (!id) return;
    deliveredRef.current = true;
    fetch('/api/deliver-documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds: [id] }),
    }).catch(() => {});
  }, [id]);
  useEffect(() => {
    if (doc?.status === 'EXECUTED' && id && !deliveredRef.current) deliverExecutedCopy();
  }, [doc?.status, id, deliverExecutedCopy]);
  const myRoles = detail?.my_roles ?? [];
  const isOwnerSide = isStaff || (doc?.is_originator ?? false);
  const isLessor = myRoles.includes('LESSOR');
  const state = doc?.workflow_state ?? 'editable';
  // Editing is allowed in review too — the parties' per-party controls (can_fill /
  // can_edit_deal) decide what each may actually change; a party with neither just
  // sees a read-only document. Locked/executed stay read-only.
  const editablePhase = state === 'editable' || state === 'editing' || state === 'in_review';
  const horseConfirmed = !!doc?.horse_section_confirmed_at;
  const isSent = !!doc?.sent_at;
  const isArchived = !!doc?.archived_at;
  const isCancelled = !!doc?.cancelled_at;
  const isExecuted = state === 'executed';
  const isTerminated = state === 'terminated';
  const terminationRequested = !!doc?.termination_requested_at && !isTerminated;
  // A dead/inactive contract (terminated / cancelled / void) is the only time the
  // per-party Archive control is offered — you archive to clear it from your list.
  const isInactive = isTerminated || isCancelled || state === 'void';
  // The counterparty must approve a termination request; the requester waits. We
  // don't have per-request approver identity, so "I can act on it" = I'm a party or
  // staff and I'm not the requester (staff always may act, e.g. to record consent).
  const iRequestedTermination = !!doc?.termination_requested_by
    && !!partiesSummary?.parties.some((p) => p.contact_id === doc?.termination_requested_by && myRoles.includes(p.party_role));
  // The top-of-page action deck carries Change History. It renders for any party or
  // the owner on a standalone, non-void document. When it renders, the duplicate
  // Change History at the bottom of the page is suppressed (single source of truth).
  const showDeck = !embedded && (isOwnerSide || myRoles.length > 0) && state !== 'void';

  // Receiving-party rendering (§C): a party who has fields to fill sees the doc
  // with THEIR empty fields highlighted and locked fields lightened; a party with
  // NOTHING to fill (review-for-signature only) sees the whole document as
  // uneditable rich text — the same as the post-lock review view.
  const myFillableEmpty = (detail?.fields ?? []).filter(
    (f) => f.can_edit && !(f.value ?? '').trim(),
  );
  const reviewOnly = !isOwnerSide && editablePhase && myFillableEmpty.length === 0;
  const partyControls: PartyControls[] = detail?.party_controls ?? [];
  // Counterparty seats = every party on the document that isn't one of my own
  // roles or the company. Derived from party_controls (a row per party, always
  // present) UNIONed with any signature rows — NOT from signature rows alone,
  // which are empty until a doc is locked, so "Send for review" used to invite
  // nobody and no email ever went out.
  const counterpartyRoles = Array.from(new Set([
    ...partyControls.map((c) => c.party_role),
    ...(detail?.signatures ?? []).map((s) => s.party_role),
  ].filter((r) => r && !myRoles.includes(r) && r !== 'FHE' && r !== 'COMPANY')));
  const sendableRoles = counterpartyRoles;
  const invitableRoles = counterpartyRoles;
  // Owner-side first (Lessor / Seller), then the counterparty (Lessee / Buyer),
  // then anything else — the consistent display order across every party list.
  const roleRank = (r: string) => r === 'LESSOR' || r === 'SELLER' ? 0
    : r === 'LESSEE' || r === 'BUYER' ? 1 : 2;
  const byRoleRank = <T,>(get: (x: T) => string) => (a: T, b: T) => roleRank(get(a)) - roleRank(get(b));
  const iSigned = (detail?.signatures ?? []).some(
    (s) => s.signed_at && myRoles.includes(s.party_role));
  const counterpartySigned = (detail?.signatures ?? []).some((s) => s.signed_at);
  // Signer seats still awaiting a signature — used by the staff/owner "sign on a
  // party's behalf" flow so the barn can wet-sign in the office.
  const pendingSignerRoles = Array.from(new Set((detail?.signatures ?? [])
    .filter((s) => !s.signed_at && s.party_role !== 'FHE' && s.party_role !== 'COMPANY')
    .map((s) => s.party_role)));

  const sections = useMemo(() => {
    const by = new Map<string, ContractField[]>();
    for (const f of detail?.fields ?? []) {
      const k = f.section || 'Terms';
      (by.get(k) ?? by.set(k, []).get(k)!).push(f);
    }
    return Array.from(by.entries());
  }, [detail?.fields]);

  // Horse gate: this contract has a Horse section that's MINE to fill (editable)
  // but no horse is chosen yet (its identifying fields are empty). Until the owner
  // picks/adds the horse, we gate the rest of the contract behind that choice —
  // the horse fields depend on it. (Staff/originator can also use it to set the horse.)
  const horseFields = useMemo(
    () => (detail?.fields ?? []).filter((f) => (f.section || '') === 'Horse'),
    [detail?.fields],
  );
  const horseIsMine = horseFields.some((f) => f.can_edit) || isOwnerSide;
  // Gate ONLY when there is genuinely no horse attached to the document — NOT when
  // horse fields happen to be blank. A document with a horse_id always shows its
  // sections (fields are editable inline whether filled or not).
  const noHorseAttached = !doc?.horse_id;
  const showHorseGate = editablePhase && horseIsMine && horseFields.length > 0
    && noHorseAttached && !horseConfirmed;

  async function act(fn: () => Promise<unknown>, okMsg?: string) {
    setError(null); setNote(null);
    try {
      await fn();
      if (okMsg) setNote(okMsg);
      await load();
      setChangeKey((k) => k + 1);   // refresh track-changes / comments
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action failed.');
    }
  }

  // Lock-for-signing gate: a party missing required info (name/address/email/phone)
  // can't be locked for signature — open the reusable capture modal on the first
  // incomplete party instead. The horse must also be attached and identified.
  function lockForSigning() {
    setError(null); setNote(null);
    const incomplete = (partiesSummary?.parties ?? []).find((p) => p.missing.length > 0);
    if (incomplete) {
      setCaptureParty(incomplete);
      setNote(`${incomplete.party_role.charAt(0) + incomplete.party_role.slice(1).toLowerCase()} is missing required contact information. Add it to continue.`);
      return;
    }
    if ((partiesSummary?.horse_missing ?? []).length > 0) {
      setError('This lease needs a horse selected and identified before it can be locked for signature.');
      return;
    }
    void act(() => advanceWorkflow(id!, 'locked'), 'Locked — the final document is ready to sign.');
  }

  // Explicit Save — fields already autosave on blur; this re-persists the composed
  // document on demand and confirms, so the creator knows their work is stored.
  async function saveNow() {
    setError(null); setNote(null); setSaving(true);
    try { await saveContract(id!); await load(); setNote('Saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSaving(false); }
  }

  // Cancel — before the document has ever been sent, cancelling makes it as if it
  // never existed: a silent hard delete, no one notified. Once it has been sent (but
  // not yet executed), Cancel stops it being worked on and notifies all parties; it
  // stays visible. (An executed contract is never cancelled — it's TERMINATED, which
  // is a separate mutual-agreement flow below.)
  function cancelDocument() {
    if (!isSent) {
      if (window.confirm('Cancel this document? It has not been sent to anyone, so it will be removed entirely — as if it never existed. No one is notified.')) {
        void act(async () => { await hardDeleteContract(id!); navigate('/app/ops/documents'); });
      }
      return;
    }
    if (window.confirm('Cancel this document? All parties will be notified. It stays on file so it can still be viewed.')) {
      void act(() => cancelContract(id!), 'Document cancelled — all parties notified.');
    }
  }

  // Terminate (executed contracts only) — mutual agreement. A party's request goes
  // to the other party to approve/decline; staff's request goes to both parties. The
  // contract stays in force until approved.
  function requestTermination() {
    const who = isStaff
      ? 'Both parties will be asked to agree to terminate this contract.'
      : 'The other party will be asked to approve terminating this contract.';
    if (window.confirm(`Request to terminate this contract? ${who} It remains in force until agreed.`)) {
      void act(() => requestContractTermination(id!), 'Termination requested — awaiting agreement.');
    }
  }
  function approveTermination() {
    if (window.confirm('Approve terminating this contract? It will be marked Terminated and kept on file as a record.')) {
      void act(() => approveContractTermination(id!), 'Contract terminated — kept on file as a record.');
    }
  }
  function declineTermination() {
    void act(() => declineContractTermination(id!), 'Termination declined — the contract remains in force.');
  }

  // Per-party archive — hide/unhide this contract from MY own document list only.
  function toggleMyArchive() {
    void act(() => setDocumentPartyArchived(id!, !isArchived),
      isArchived ? 'Unarchived.' : 'Archived — removed from your document list.');
  }

  // Staff hard delete. If any party has already been notified/seen the doc, the
  // server emails them a PDF copy for their records BEFORE the delete; then it's
  // hard-deleted for everyone.
  async function deleteEntirely() {
    if (!window.confirm('Delete this document entirely? Any party who has seen it is emailed a PDF copy for their records, then it is permanently removed for everyone. This cannot be undone.')) return;
    setError(null); setNote(null);
    try {
      await deleteContractWithCopy(id!);
      navigate('/app/ops/documents');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the document.');
    }
  }

  // Send for review to every counterparty on file, plus any extra emails typed in.
  function sendReview() {
    void act(async () => {
      const r = await sendForReview(id!, invitableRoles);
      // extra ad-hoc recipients: invite the first counterparty role at each address
      const extraRole = invitableRoles[0];
      let extraSent = 0;
      if (extraRole && extraEmails.length) {
        const rs = await Promise.allSettled(extraEmails.map((e) => inviteCounterparty(id!, extraRole, e)));
        extraSent = rs.filter((x) => x.status === 'fulfilled' && x.value.emailed).length;
      }
      const extraNote = extraSent ? ` Also emailed ${extraSent} additional recipient${extraSent === 1 ? '' : 's'}.` : '';
      setExtraEmails([]); setExtraEmailDraft('');
      setNote(r.skipped > 0
        ? `Sent for review. Emailed ${r.emailed} of ${r.emailed + r.skipped} part${r.emailed + r.skipped === 1 ? 'y' : 'ies'}; ${r.skipped} could not be emailed (no email on file or email delivery not configured). In-app notifications were sent to parties with an account.${extraNote}`
        : `Sent for review — all parties were notified by email and in-app.${extraNote}`);
    });
  }

  const saveField = useCallback(async (key: string, value: string) => {
    try {
      await setContractField(id!, key, value);
      await load();
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that field.');
    }
  }, [id, load]);

  // Commit a party CONTACT token (LESSOR/LESSEE . ADDRESS/PHONE/EMAIL/FULL_NAME):
  // writes to that party's contact record, then refills + re-merges the doc so the
  // token reflects it. The value is captured now and confirmed by the party at
  // review (see the confirmation modal).
  const editPartyContact = useCallback(async (token: string, value: string) => {
    const [role, field] = token.split('.');
    const party = partiesSummary?.parties.find((p) => p.party_role === role);
    if (!party?.contact_id) { setError(`No ${role.toLowerCase()} on this document to save to.`); return; }
    const v = value.trim();
    const patch: Parameters<typeof captureContactInfo>[2] = {};
    if (field === 'EMAIL') patch.email = v;
    else if (field === 'PHONE') patch.phone = v;
    else if (field === 'ADDRESS') patch.address_line1 = v;   // full string in line1
    else if (field === 'FULL_NAME') {
      const parts = v.split(/\s+/);
      patch.first_name = parts.shift() ?? '';
      patch.last_name = parts.join(' ');
    }
    try {
      await captureContactInfo(id!, party.contact_id, patch);
      await load();
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that contact detail.');
    }
  }, [id, load, partiesSummary]);

  // Fill/edit a farrier or vet detail directly in the Care section → writes back to
  // the horse record (reused by every document), then re-materializes + re-merges.
  const editHorseRecord = useCallback(async (token: string, value: string) => {
    if (!doc?.horse_id) { setError('No horse on this document to save to.'); return; }
    const v = value.trim();
    const patch: Parameters<typeof captureHorseRecord>[1] = {};
    switch (token) {
      case 'HORSE.FARRIER_NAME':  patch.farrier_name = v; break;
      case 'HORSE.FARRIER_PHONE': patch.farrier_phone = v; break;
      case 'HORSE.VET_NAME':      patch.vet_name = v; break;
      case 'HORSE.VET_PHONE':     patch.vet_phone = v; break;
      case 'HORSE.VET_BUSINESS':  patch.vet_business_name = v; break;
      case 'HORSE.VET_ADDRESS':   patch.vet_address_line1 = v; break;  // full string in line1
      default: return;
    }
    try {
      await captureHorseRecord(id!, patch);
      await load();
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that horse-record detail.');
    }
  }, [id, load, doc?.horse_id]);

  // Comment anchored to a specific field — opens the Add-a-Comment modal straight
  // at the write step, pre-anchored to that field.
  const commentOnField = useCallback((f: ContractField) => {
    setCommentDraft('');
    setCommentModal({ step: 'write', anchorRef: f.field_key, heading: f.label ?? f.field_key });
  }, []);

  // Suggesting a change to a field a party can't directly edit now flows through
  // COMMENTS: the ✎ opens the comment modal pinned to that field, so the suggestion
  // is a pinned comment at that location for the others to review (replacing the
  // separate redline field-proposal path).
  const suggestFieldEdit = commentOnField;

  if (error && !detail) return <p role="alert" className="form-error">{error}</p>;
  if (!detail || !doc) return <p className="body-text text-muted text-sm">Loading the contract…</p>;

  const STATE_LABEL: Record<string, string> = {
    editable: 'In progress', editing: 'Being edited', in_review: 'In review',
    locked: 'Ready to sign', executed: 'Executed', void: 'Void',
    terminated: 'Terminated',
  };

  // ── segmented signing set (lease → vet auth → care release) ──
  const stepLabel = (k: string) =>
    k === 'HORSE_LEASE' ? 'Lease agreement'
      : k === 'HORSE_EMERGENCY_VET' ? 'Vet authorization'
        : k === 'RELEASE_HORSE_CARE' ? 'Care liability release' : 'Document';
  const inSet = signingSet.length > 1;
  const curIdx = signingSet.findIndex((s) => s.document_id === id);
  const nextInSeq = curIdx >= 0 ? signingSet.slice(curIdx + 1).find((s) => !s.executed) : undefined;
  const allExecuted = inSet && signingSet.every((s) => s.executed);
  const thisExecuted = doc.status === 'EXECUTED';

  return (
    <div className={embedded ? '' : 'max-w-5xl'}>
      {inSet && (
        <div className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
          <p className="form-label mb-2.5">Document {curIdx + 1} of {signingSet.length} — signed in order</p>
          <ol className="flex flex-wrap items-center gap-y-2">
            {signingSet.map((s, i) => {
              const current = s.document_id === id;
              const prevDone = signingSet.slice(0, i).every((p) => p.executed);
              const locked = !s.executed && !prevDone;
              return (
                <li key={s.document_id} className="flex items-center">
                  <Link to={`/app/contracts/${s.document_id}`} aria-current={current ? 'step' : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      s.executed ? 'bg-green-700 text-white border-green-700'
                        : current ? 'bg-gold-50 text-gold-900 border-gold-400'
                          : locked ? 'bg-cream-100 text-muted border-green-800/15'
                            : 'bg-white text-green-800 border-green-800/25 hover:border-green-800/50'}`}>
                    {s.executed ? <CheckCircle2 size={13} aria-hidden="true" />
                      : locked ? <Lock size={12} aria-hidden="true" />
                        : <span className="w-3.5 text-center tabular-nums">{i + 1}</span>}
                    {stepLabel(s.template_key)}
                  </Link>
                  {i < signingSet.length - 1 && <span className="text-green-800/30 mx-1.5" aria-hidden="true">→</span>}
                </li>
              );
            })}
          </ol>
          {allExecuted ? (
            <p className="text-sm text-green-700 mt-3 inline-flex items-center gap-1.5">
              <CheckCircle2 size={16} aria-hidden="true" /> All documents in this set are signed.
            </p>
          ) : thisExecuted && nextInSeq ? (
            <button type="button" onClick={() => navigate(`/app/contracts/${nextInSeq.document_id}`)}
              className="btn-primary mt-3">
              Continue to {stepLabel(nextInSeq.template_key)} →
            </button>
          ) : !thisExecuted ? (
            <p className="form-hint mt-3">Sign this document to continue to the next.</p>
          ) : null}
        </div>
      )}

      {/* ── Action deck (above the title): one card, stacked panels — Manage,
          Notify, Change History. Available to ALL parties (not just the owner)
          until the contract is executed; after execution it becomes Terminate +
          (once inactive) per-party Archive + Change History. Buttons are large and
          well-spaced so they're hard to mis-tap on mobile. ── */}
      {showDeck && (
        <div className="bg-white border border-green-800/10 rounded-xl mb-5 divide-y divide-green-800/10">
          {/* MANAGE — pre-execution only. Save (owner), Cancel (any party), Delete
              (staff, hard delete before execution), and per-party Archive once the
              contract is inactive (terminated/cancelled). */}
          {!isExecuted && (
          <div className="p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Manage</p>
            {/* Preserving actions (Save / Archive) sit on the LEFT; destructive
                actions (Cancel / Delete) are pushed to the RIGHT so there's clear
                space between the buttons that keep a document and the ones that kill
                it — no accidental taps. On mobile they stack (preserve then destroy). */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {isOwnerSide && (
                  <button type="button" disabled={saving}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-green-900 hover:bg-green-800/5 focus-ring disabled:opacity-60"
                    onClick={() => void saveNow()}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
                {/* per-party Archive (preserves) appears once the contract is inactive */}
                {isInactive && (
                  <button type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-secondary hover:bg-green-800/5 focus-ring"
                    onClick={toggleMyArchive}>
                    {isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
                {!isCancelled && (
                  <button type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-secondary hover:bg-green-800/5 focus-ring"
                    onClick={cancelDocument}>
                    Cancel
                  </button>
                )}
                {isStaff && (
                  <button type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-ring"
                    onClick={() => void deleteEntirely()}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
          )}

          {/* NOTIFY — pre-execution, owner side. No copy is sent until the contract
              is signed (that happens automatically on execution); this just notifies
              the parties to review + sign. Lists the recipient email(s) with the
              option to add more. Lock for signing is admin-only. */}
          {isOwnerSide && editablePhase && (
            <div className="p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Notify</p>
              <button type="button" className="btn-primary w-full sm:w-auto justify-center py-3"
                onClick={sendReview}>
                <Send size={15} /> Notify for review
              </button>
              <p className="text-[11px] text-muted mt-1.5">Notifies each party to review and sign. The signed copy is emailed to everyone automatically once the contract is fully signed.</p>
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Notifying</p>
                <ul className="flex flex-col gap-1">
                  {(partiesSummary?.parties ?? [])
                    .filter((p) => invitableRoles.includes(p.party_role))
                    .slice()
                    .sort(byRoleRank((p) => p.party_role))
                    .map((p) => {
                      const rl = p.party_role.charAt(0) + p.party_role.slice(1).toLowerCase();
                      return (
                        <li key={p.party_role} className="text-[13px] text-green-950 flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold">{rl}:</span>
                          {p.email
                            ? <span className="break-all">{p.email}</span>
                            : <span className="text-red-700 italic">no email on file — add one below</span>}
                        </li>
                      );
                    })}
                  {extraEmails.map((e, i) => (
                    <li key={`extra-${i}`} className="text-[13px] text-green-950 flex items-baseline gap-2">
                      <span className="font-semibold">Also:</span>
                      <span className="break-all">{e}</span>
                      <button type="button" className="text-red-700 text-xs underline shrink-0"
                        onClick={() => setExtraEmails((xs) => xs.filter((_, j) => j !== i))}>remove</button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                  <input type="email" value={extraEmailDraft}
                    onChange={(e) => setExtraEmailDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = extraEmailDraft.trim();
                        if (v && !extraEmails.includes(v)) { setExtraEmails((xs) => [...xs, v]); setExtraEmailDraft(''); }
                      }
                    }}
                    placeholder="Add another email address"
                    className="px-3 py-2 rounded-lg border border-green-800/15 text-sm focus-ring w-full sm:w-72" />
                  <button type="button" className="btn-secondary text-sm justify-center py-2"
                    disabled={!extraEmailDraft.trim()}
                    onClick={() => {
                      const v = extraEmailDraft.trim();
                      if (v && !extraEmails.includes(v)) { setExtraEmails((xs) => [...xs, v]); setExtraEmailDraft(''); }
                    }}>
                    Add email
                  </button>
                </div>
              </div>
              {/* Lock for signing is ADMIN-ONLY — the manual gate for "terms are
                  final, just sign". Recipients never see it; they simply open and
                  sign, and signing notifies the other party. */}
              {isStaff && (
                <div className="mt-5">
                  <button type="button" className="btn-outline-gold text-sm w-full sm:w-auto justify-center py-3"
                    onClick={lockForSigning}>
                    <Lock size={14} /> Lock for signing
                  </button>
                  <p className="text-[11px] text-muted mt-1.5">Admin only — locks the final document so the parties can only review and sign (use when the terms are final).</p>
                </div>
              )}
            </div>
          )}

          {/* TERMINATE — executed contracts only, mutual agreement. Plus per-party
              Archive once the contract is terminated. */}
          {isExecuted && (
            <div className="p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Manage</p>
              {terminationRequested ? (
                iRequestedTermination ? (
                  <p className="text-[13px] text-gold-800">Termination requested — awaiting the other party's agreement.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] text-green-950">
                      {isStaff ? 'The barn has' : 'The other party has'} requested to terminate this contract.
                      {doc?.termination_request_reason ? ` Reason: ${doc.termination_request_reason}` : ''}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button type="button" className="btn-primary text-sm justify-center py-3 sm:w-auto"
                        onClick={approveTermination}>Approve termination</button>
                      <button type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-secondary hover:bg-green-800/5 focus-ring"
                        onClick={declineTermination}>Decline</button>
                    </div>
                  </div>
                )
              ) : (
                <button type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-ring w-full sm:w-auto"
                  onClick={requestTermination}>
                  Terminate
                </button>
              )}
            </div>
          )}

          {/* Post-termination / inactive: per-party Archive (hide from my list). */}
          {isTerminated && (
            <div className="p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Manage</p>
              <button type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-secondary hover:bg-green-800/5 focus-ring w-full sm:w-auto"
                onClick={toggleMyArchive}>
                {isArchived ? 'Unarchive' : 'Archive (remove from my list)'}
              </button>
            </div>
          )}

          {/* CHANGE HISTORY — always in the deck. */}
          {id && (
            <div className="p-5 sm:p-6">
              <TrackChangesPanel documentId={id} refreshKey={changeKey} />
            </div>
          )}
        </div>
      )}

      <div className={`flex items-start justify-between gap-3 mb-1 ${isInactive ? 'opacity-60' : ''}`}>
        <h1 className="font-serif text-2xl text-green-900 flex items-center gap-2">
          <FileText size={22} className="text-gold-ink" /> {doc.title}
        </h1>
        <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
          isTerminated || isCancelled ? 'bg-red-100 text-red-800'
          : state === 'executed' ? 'bg-green-800 text-white'
          : state === 'locked' ? 'bg-gold-50 text-gold-ink' : 'bg-green-800/10 text-green-800'
        }`}>
          {isTerminated
            ? `Terminated${doc?.terminated_at ? ` · ${new Date(doc.terminated_at).toLocaleDateString()}` : ''}`
            : isCancelled
              ? `Cancelled${doc?.cancelled_at ? ` · ${new Date(doc.cancelled_at).toLocaleDateString()}` : ''}`
              : (STATE_LABEL[state] ?? state)}
        </span>
      </div>
      {terminationRequested && !iRequestedTermination && (
        <div className="mb-3 rounded-lg border border-gold-400/50 bg-gold-50 px-4 py-2.5 text-sm text-gold-900">
          A termination request is pending your response — see Manage above.
        </div>
      )}

      {/* Sticky action sub-header (minimal height): Add a Comment · Add a Section,
          Item, or Field · View/Hide Comments · Proceed to Signatures. Present for
          clause-model docs so the actions are always reachable. */}
      {structure && id && state !== 'executed' && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 mb-3 bg-cream-100/95 backdrop-blur border-b border-green-800/10 flex flex-wrap items-center gap-2">
          {!isCancelled && state !== 'void' && (
            <button type="button" className="btn-outline-gold text-xs inline-flex items-center gap-1"
              onClick={() => { setCommentModal({ step: 'pick' }); setCommentDraft(''); }}>
              <MessageSquarePlus size={13} /> Add a Comment
            </button>
          )}
          {isOwnerSide && editablePhase && (
            <AddElementButton documentId={id} disabled={!editablePhase}
              sections={structure.sections.map((s) => s.heading)}
              canAddStructure={isOwnerSide}
              canAddClause={isOwnerSide || (redline?.can_add_clause ?? false)}
              onAdded={() => void act(async () => {})} />
          )}
          {commentCount > 0 && (
            <button type="button" className="text-xs text-green-800 hover:text-green-700 underline underline-offset-2"
              onClick={() => setCommentsOpen((v) => !v)}>
              {commentsOpen ? 'Hide Comments' : `View Comments (${commentCount})`}
            </button>
          )}
          <button type="button" className="ml-auto text-xs text-green-800 hover:text-green-700 underline underline-offset-2"
            onClick={() => document.getElementById('contract-signatures')?.scrollIntoView({ behavior: 'smooth' })}>
            Proceed to Signatures →
          </button>
        </div>
      )}
      {/* Add-a-Comment modal — step 1: pick the section to pin to; step 2: author
          the comment inline and post. Everything happens in the modal. */}
      {commentModal && structure && id && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4"
          onClick={() => { setCommentModal(null); setCommentDraft(''); }}>
          <div className="bg-white rounded-xl border border-green-800/15 p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-lg"
            onClick={(e) => e.stopPropagation()}>
            {commentModal.step === 'pick' ? (
              <>
                <h3 className="font-serif text-green-900 mb-1">Add a comment</h3>
                <p className="text-sm text-muted mb-3">
                  Choose the section you want to comment on. To comment on a specific
                  item or field instead, close this window and click the comment
                  affordance on that item.
                </p>
                <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-1">
                  {structure.sections.map((s) => (
                    <button key={s.section_key} type="button"
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-cream-100 focus-ring"
                      onClick={() => setCommentModal({ step: 'write', anchorRef: s.section_key, heading: s.heading })}>
                      {s.heading}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-right">
                  <button type="button" className="btn-secondary text-xs"
                    onClick={() => { setCommentModal(null); setCommentDraft(''); }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-serif text-green-900 mb-1">Comment</h3>
                <p className="text-[11px] text-muted mb-2">
                  On <span className="text-green-900">{commentModal.heading}</span>
                  <button type="button" className="underline ml-2"
                    onClick={() => setCommentModal({ step: 'pick' })}>change</button>
                </p>
                <textarea rows={4} className="form-input resize-y text-sm w-full" autoFocus
                  placeholder="Write a comment or a question…"
                  value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} />
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="btn-secondary text-xs"
                    onClick={() => { setCommentModal(null); setCommentDraft(''); }}>Cancel</button>
                  <button type="button" className="btn-primary text-xs"
                    disabled={commentPosting || !commentDraft.trim()}
                    onClick={async () => {
                      if (commentModal.step !== 'write') return;
                      setCommentPosting(true);
                      try {
                        await postContractComment(id, {
                          body: commentDraft.trim(), anchorKind: 'field',
                          anchorRef: commentModal.anchorRef,
                        });
                        setCommentModal(null); setCommentDraft(''); setCommentsOpen(true);
                        setChangeKey((k) => k + 1);
                      } catch (e) {
                        setNote(e instanceof Error ? e.message : 'Could not post the comment.');
                      } finally { setCommentPosting(false); }
                    }}>
                    {commentPosting ? 'Posting…' : 'Post comment'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Party-facing notes/instructions don't apply during the creation step
          (the embedded inline authoring view) \u2014 nothing has been sent to either
          party yet. Only show guidance on the standalone contract page. */}
      {!embedded && (
        <p className="text-sm text-muted mb-5">
          {isOwnerSide
            ? 'Fill any side\u2019s fields \u2014 acting on behalf of a party where needed \u2014 set the controls, lock, then invite.'
            : reviewOnly
              ? 'Review the document below and sign \u2014 or respond to the other party.'
              : 'The highlighted fields need your input. Anything shown lighter is locked while you complete your part.'}
        </p>
      )}

      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      {note && <p className="mb-3 rounded px-4 py-2 text-sm bg-green-50 text-green-900">{note}</p>}

      {/* lifecycle status banners */}
      {isCancelled && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">This document was cancelled.</p>
          {isStaff && <p className="mt-0.5">Archive it (findable &amp; resumable) or delete it entirely below.</p>}
        </div>
      )}
      {isArchived && !isCancelled && (
        <div className="mb-4 rounded-lg border border-green-800/20 bg-cream-100 px-4 py-2.5 text-sm text-secondary">
          Archived — kept on file and resumable. {isStaff && 'Unarchive it below to continue.'}
        </div>
      )}
      {isSent && !isCancelled && !isArchived && state !== 'executed' && (
        <p className="mb-3 text-xs text-muted">Sent to the other party — they’ve been notified.</p>
      )}

      {/* Proposed changes (redline) — now positioned in the Review zone, after the
          document identity/status rather than above the title (m-7). */}
      {redline && (
        <RedlineSection
          documentId={id!}
          redline={redline}
          isOwnerSide={isOwnerSide}
          onChanged={() => void load()}
        />
      )}

      {/* Executed: the sealed document */}
      {state === 'executed' && (
        <div className="bg-white border border-green-800/10 rounded-lg p-6 mb-6">
          <p className="inline-flex items-center gap-2 text-green-800 font-medium text-sm mb-3">
            <CheckCircle2 size={16} /> Executed{doc.execution_hash ? ` · ${doc.execution_hash.slice(0, 12)}…` : ''}
          </p>
          <div className="prose-sm max-h-[70vh] overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-green-950 bg-cream-100/50 border border-green-800/10 rounded p-5">
            <ContractBody body={doc.merged_body} />
          </div>
        </div>
      )}

      {/* Parties & Horse summary — who the lease is between and for which horse.
          Staff can reassign a party or the horse in place. Shown on the standalone
          contract page (the creation page already collects these). */}
      {id && !embedded && (
        <PartiesHorseCard documentId={id} canEdit={isStaff && editablePhase}
          onChanged={() => { void load(); }} />
      )}

      {/* Owner-side: per-party document controls.
          Hidden when embedded on the creation page — that page already collected
          controls; restating them here (with a 4th option) confused the flow. */}
      {isOwnerSide && editablePhase && !embedded && (
        <div className="bg-white border border-green-800/10 rounded-lg p-4 mb-5">
          <p className="text-[12px] text-muted mb-2.5">
            Document controls — what each party may do. The invitation wording follows these.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {invitableRoles.concat(partyControls.map((c) => c.party_role))
              .filter((r, i, a) => a.indexOf(r) === i && r !== 'FHE' && r !== 'COMPANY')
              .sort(byRoleRank((r) => r))
              .map((role) => {
                const c = partyControls.find((x) => x.party_role === role)
                  ?? { party_role: role, can_fill: true, can_edit_deal: false, can_suggest: false, can_add_clause: false };
                const value: PartyControlValues = {
                  can_fill: c.can_fill, can_edit_deal: c.can_edit_deal,
                  can_suggest: c.can_suggest, can_add_clause: c.can_add_clause ?? false,
                };
                return (
                  <PartyControlsCard key={role} role={role} value={value}
                    onChange={(v) => void act(() => setPartyControls(id!, role, v))} />
                );
              })}
          </div>
          {/* The redundant document-wide "let the other party edit" checkbox was
              removed — deal-term editing is driven by each party's "Edit deal
              terms" control above (the single source of truth). Invites go out on
              "Send for review" below (email + in-app); parties are assigned at
              creation, so no manual invite box here. */}
        </div>
      )}

      {/* Horse gate — pick/add the horse before the rest of the contract */}
      {showHorseGate && id && (
        <HorseGate documentId={id} onAttached={() => { void load(); }} />
      )}

      {/* Clause-model documents (Section›Clause›Field): numbered structure with
          live gating. Falls through to the legacy flat grouping when no structure. */}
      {state !== 'executed' && !showHorseGate && !reviewOnly && structure && (
        <ClauseDocument
          sections={structure.sections}
          fields={detail.fields}
          cb={{
            editable: editablePhase,
            authorView: isOwnerSide && editablePhase,
            onSave: saveField,
            onSaveStructured: (k, s) => void act(() => setFieldStructured(id!, k, s as never)),
            onSaveResponsibility: (k, r) => void act(() => setFieldResponsibility(id!, k, r as never)),
            onInclude: (k, inc) => void act(() => setFieldIncluded(id!, k, inc)),
            onNa: (k, na) => void act(() => setFieldNa(id!, k, na)),
            onControl: (k, ov) => void act(() => setFieldControlOverride(id!, k, ov as never)),
            canSetControl: isOwnerSide,
            canSuggest: redline?.can_suggest ?? false,
            onSuggestEdit: suggestFieldEdit,
            onCommentField: commentOnField,
            onEditPartyContact: editPartyContact,
            onEditHorseRecord: editHorseRecord,
          }}
        />
      )}

      {/* Field sections (legacy flat grouping) — hidden until a horse is chosen when
          the gate applies, hidden for a review-only party, and skipped entirely for
          clause-model documents (rendered above). */}
      {state !== 'executed' && !showHorseGate && !reviewOnly && !structure && sections.map(([section, fields]) => {
        const isHorse = section === 'Horse';
        const anyEditable = fields.some((f) => f.can_edit);
        // counterparty intake: show only sections with something for them (or filled)
        if (!isOwnerSide && !anyEditable && !fields.some((f) => f.value)) return null;

        // Section-level include/omit: a section is OPTIONAL when every field is
        // optional; it's OMITTED when none of its fields are included. An omitted
        // optional section collapses to a "＋ Include" placeholder; including it
        // turns its fields on. Non-optional (essential) sections always show.
        const sectionOptional = fields.length > 0 && fields.every((f) => f.is_optional);
        const sectionIncluded = fields.some((f) => f.included !== false);
        const includeSection = (on: boolean) => fields.forEach((f) => {
          if (f.is_optional) void act(() => setFieldIncluded(id!, f.field_key, on));
        });
        if (sectionOptional && !sectionIncluded) {
          return (
            <button key={section} type="button" disabled={!editablePhase}
              onClick={() => includeSection(true)}
              className="w-full text-left text-sm text-gold-800 border border-dashed border-gold-400 rounded-xl px-5 py-3 mb-5 hover:bg-gold-50 focus-ring">
              ＋ Include “{section}”
            </button>
          );
        }

        // EVERY section renders via the cascading living-document renderer —
        // subject-grouped, dropdowns/buttons, decomposed responsibility, conditional
        // reveals, N/A + include/omit, ⓘ guidance. The Horse section keeps its
        // "reviewed & accurate" confirm affordance in the header.
        return (
          <section key={section} className="bg-white border border-green-800/10 rounded-xl p-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-green-800">
                {section}
                {sectionOptional && editablePhase && (
                  <button type="button" className="ml-3 text-[11px] text-muted underline align-middle"
                    onClick={() => includeSection(false)}>omit section</button>
                )}
              </h2>
              {isHorse && (
                horseConfirmed ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                    <ShieldCheck size={14} /> Confirmed accurate
                    {(isLessor || isStaff) && editablePhase && (
                      <button type="button" className="underline text-muted ml-2"
                        onClick={() => void act(() => reopenHorseSection(id!))}>
                        <RotateCcw size={11} className="inline" /> reopen
                      </button>
                    )}
                  </span>
                ) : (isLessor || isStaff) && editablePhase ? (
                  <button type="button" className="btn-outline-gold text-xs"
                    onClick={() => void act(() => confirmHorseSection(id!), 'Horse information confirmed.')}>
                    <ShieldCheck size={13} /> I reviewed the horse info — it's accurate
                  </button>
                ) : (
                  <span className="text-xs text-muted">Awaiting Lessor confirmation</span>
                )
              )}
            </div>
            <ContractCascade
              fields={fields}
              editable={editablePhase && anyEditable}
              onSave={saveField}
              onSaveResponsibility={(k, r) => void act(() => setFieldResponsibility(id!, k, r))}
              onSaveStructured={(k, s) => void act(() => setFieldStructured(id!, k, s))}
              onInclude={(k, inc) => void act(() => setFieldIncluded(id!, k, inc))}
              onNa={(k, na) => void act(() => setFieldNa(id!, k, na))}
              onControl={(k, ov) => void act(() => setFieldControlOverride(id!, k, ov))}
              canSetControl={isOwnerSide}
              onCommentField={commentOnField}
              onSuggestEdit={suggestFieldEdit}
              canSuggest={redline?.can_suggest ?? false}
            />
          </section>
        );
      })}

      {/* Unified "Add" toolbar (M-2): one button for field / section / clause.
          For clause-model docs the sticky sub-header above provides this, so it's
          only shown here for legacy flat documents. */}
      {editablePhase && !showHorseGate && !structure && id && (
        <div className="mb-5">
          <AddElementButton documentId={id} disabled={!editablePhase}
            sections={sections.map(([s]) => s)}
            canAddStructure={isOwnerSide}
            canAddClause={isOwnerSide || (redline?.can_add_clause ?? false)}
            onAdded={() => void act(async () => {})} />
        </div>
      )}


      {/* (change-request composer removed 2026-07-20, audit M-3: it was
          unreachable — crFieldKey was never set. A field-level "suggest a change"
          flow is provided by redline proposeFieldEdit + pinned comments, so this
          superseded third mechanism is gone. The "Open change requests" list
          below still renders any existing requests.) */}

      {/* open change requests */}
      {(detail.open_change_requests.length > 0) && state !== 'executed' && (
        <section className="bg-white border border-gold-400/40 rounded-lg p-5 mb-4">
          <h2 className="font-serif text-green-800 mb-3">Open change requests</h2>
          <div className="flex flex-col gap-3">
            {detail.open_change_requests.map((cr) => (
              <div key={cr.id} className="border border-green-800/10 rounded p-3">
                <p className="text-xs text-muted mb-1">
                  #{cr.annotation_number} · {cr.target_field_key ?? cr.target_section ?? 'general'}
                  {cr.current_value ? ` · currently "${cr.current_value}"` : ''}
                </p>
                <p className="text-sm text-green-900 mb-2">{cr.requested_change}</p>
                {isOwnerSide && (
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-xs"
                      onClick={() => void act(() => resolveChangeRequest(cr.id, true, null), 'Change accepted.')}>
                      Accept
                    </button>
                    <button type="button" className="btn-secondary text-xs"
                      onClick={() => void act(() => resolveChangeRequest(cr.id, false), 'Change rejected.')}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* review-only party (§C): nothing for them to fill → the whole document as
          uneditable rich text, shown expanded (same as the post-lock review view). */}
      {state !== 'executed' && reviewOnly && doc.merged_body && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
          <p className="text-sm text-muted mb-3">Please review the document below and sign, or respond to the other party.</p>
          <div className="max-h-[70vh] overflow-y-auto whitespace-pre-line text-[13.5px] leading-relaxed text-green-950 bg-cream-100/50 border border-green-800/10 rounded p-6">
            <ContractBody body={doc.merged_body} />
          </div>
        </section>
      )}

      {/* The pre-executed "document preview" (collapsible merged_body) is gone:
          the clause-model authoring surface above IS the full document in context
          — every clause's prose renders with its inputs inline, selected and
          unselected alike. For a LEGACY flat document (no clause structure) the
          author still needs a way to read the composed text, so the collapsible
          preview is kept ONLY in that fall-through case. */}
      {state !== 'executed' && !reviewOnly && !structure && doc.merged_body && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
          <button type="button" className="font-serif text-green-800 underline-offset-4 hover:underline"
            onClick={() => setShowBody((v) => !v)}>
            {showBody ? 'Hide' : 'Review'} the document text
          </button>
          {showBody && (
            <div className="mt-3 max-h-[60vh] overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-green-950 bg-cream-100/50 border border-green-800/10 rounded p-5">
              <ContractBody body={doc.merged_body} />
            </div>
          )}
        </section>
      )}

      {/* workflow + signing — the primary Send / Lock / Manage actions now live in
          the action deck above the title. This section carries the post-send
          workflow steps (review round-trip, send-to-party) and the signing UI. It
          only appears once there is something to show (a review/locked action, the
          signing UI, or captured signatures) — in the plain editable phase there is
          nothing here, so the whole card is omitted (no empty white box). */}
      {state !== 'executed' && state !== 'void' && state !== 'terminated'
        && (state === 'in_review' || state === 'locked' || (detail?.signatures.length ?? 0) > 0) && (
        <section id="contract-signatures" className="bg-white border border-green-800/10 rounded-xl p-6 scroll-mt-16 mt-6">
          {(
            (isOwnerSide && (state === 'in_review' || (state === 'locked' && !counterpartySigned)))
            || (isOwnerSide && (state === 'in_review' || state === 'locked') && sendableRoles.length > 0)
          ) && (
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            {isOwnerSide && state === 'in_review' && (
              <>
                <button type="button" className="btn-secondary text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'editable'))}>
                  Back to editing
                </button>
                <button type="button" className="btn-outline-gold text-xs"
                  onClick={lockForSigning}>
                  <Lock size={13} /> Lock for signing
                </button>
              </>
            )}
            {isOwnerSide && state === 'locked' && !counterpartySigned && (
              <button type="button" className="btn-secondary text-xs"
                onClick={() => void act(() => advanceWorkflow(id!, 'editable'), 'Reopened for corrections.')}>
                <RotateCcw size={13} /> Withdraw / correct
              </button>
            )}

            {/* Send to a party = notify them + grant access. Locked = for signature only. */}
            {isOwnerSide && (state === 'in_review' || state === 'locked') && sendableRoles.map((r) => (
              <button key={r} type="button" className="btn-primary text-xs"
                onClick={() => void act(() => sendContractToParty(id!, r),
                  `Sent to ${r.charAt(0) + r.slice(1).toLowerCase()} — they’ve been notified.`)}>
                <Send size={13} /> Send to {r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          )}

          {/* signing: counterparty first when they owe input; owner reviews + signs last */}
          {state === 'locked' && myRoles.length > 0 && !iSigned && (
            <div className="border-t border-green-800/10 pt-4">
              <p className="text-sm text-secondary mb-2">
                Sign as <strong>{myRoles[0]}</strong> — typing your full legal name is your signature.
              </p>
              <div className="flex gap-2">
                <input value={signName} onChange={(e) => setSignName(e.target.value)}
                  placeholder="Full legal name"
                  className="px-3 py-2 rounded-lg border border-green-800/15 text-sm focus-ring w-64" />
                <button type="button" className="btn-primary text-sm" disabled={!signName.trim()}
                  onClick={() => void act(async () => {
                    await lockAndSign(id!, myRoles[0], signName.trim());
                    deliverExecutedCopy();   // no-op unless this signature executed the doc; idempotent
                  }, 'Signed.')}>
                  <PenLine size={14} /> Sign
                </button>
              </div>
            </div>
          )}
          {iSigned && (
            <p className="text-sm text-green-700 inline-flex items-center gap-1.5">
              <CheckCircle2 size={15} /> You've signed — awaiting the remaining signature.
            </p>
          )}

          {/* Staff / owner signing on a party's behalf (barn-office wet-signing).
              Staff hold no party role of their own, so without this there is no way
              to execute a signature from this screen. Each pending seat that isn't
              one of my own roles gets its own name box. */}
          {isOwnerSide && state === 'locked'
            && pendingSignerRoles.filter((r) => !myRoles.includes(r)).length > 0 && (
            <div className="border-t border-green-800/10 pt-4">
              <p className="text-sm text-secondary mb-1">Sign on a party's behalf</p>
              <p className="form-hint mb-3">
                For in-person signing. Type the party's full legal name exactly as it should
                appear — this seals their signature and is recorded in the audit trail.
              </p>
              <div className="flex flex-col gap-2.5">
                {pendingSignerRoles.filter((r) => !myRoles.includes(r)).map((r) => {
                  const rl = r.charAt(0) + r.slice(1).toLowerCase();
                  const name = behalfNames[r] ?? '';
                  return (
                    <div key={r} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-green-900 w-20 shrink-0">{rl}</span>
                      <input value={name}
                        onChange={(e) => setBehalfNames((m) => ({ ...m, [r]: e.target.value }))}
                        placeholder={`${rl}'s full legal name`}
                        className="px-3 py-2 rounded-lg border border-green-800/15 text-sm focus-ring w-64" />
                      <button type="button" className="btn-primary text-sm" disabled={!name.trim()}
                        onClick={() => void act(
                          async () => { await lockAndSign(id!, r, name.trim()); deliverExecutedCopy(); },
                          `Signed as ${rl}.`)}>
                        <PenLine size={14} /> Sign as {rl}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* signature status */}
          {detail.signatures.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {detail.signatures.map((s) => (
                <span key={s.party_role} className={`text-xs px-2.5 py-1 rounded-full ${
                  s.signed_at ? 'bg-green-800/10 text-green-800' : 'bg-cream-100 text-muted border border-green-800/10'
                }`}>
                  {s.party_role}: {s.signed_at ? `signed${s.typed_name ? ` — ${s.typed_name}` : ''}` : 'pending'}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pinned comments (always-on) — anchored to fields or selected passages,
          threaded and resolvable. Select text in the document above to comment. */}
      {id && (
        <div className="mt-5">
          <ContractComments documentId={id} canComment={!isCancelled && state !== 'void'}
            onChanged={() => setChangeKey((k) => k + 1)}
            visible={commentsOpen}
            onCount={setCommentCount}
            refreshKey={changeKey} />
        </div>
      )}

      {/* Change history / track changes (always-on) — what each party changed,
          and the human face of the retained audit trail. Shown here only when it's
          NOT already in the action deck above the title. The deck shows for any
          party (or owner) on a non-void document, so this bottom copy is only for
          void documents and the embedded creation view. */}
      {id && !showDeck && (
        <div className="mt-5">
          <TrackChangesPanel documentId={id} refreshKey={changeKey} />
        </div>
      )}

      {/* Capture-missing-info modal, opened by the lock-for-signing gate. Writes to
          the central contact, then reloads so the doc + card reflect it. */}
      {captureParty && id && (
        <CaptureInfoModal
          documentId={id}
          party={captureParty}
          onClose={() => setCaptureParty(null)}
          onSaved={() => { setCaptureParty(null); void load(); setChangeKey((k) => k + 1); }}
        />
      )}

    </div>
  );
}
