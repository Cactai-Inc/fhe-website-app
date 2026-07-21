import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText, CheckCircle2, Lock, Send, PenLine, ShieldCheck, RotateCcw, Mail,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import {
  contractDocumentDetail, setContractField,
  resolveChangeRequest, advanceWorkflow, lockAndSign, confirmHorseSection,
  reopenHorseSection, inviteCounterparty, setRecipientEditing,
  setPartyControls, contractMessagesList, contractMessagePost, contractSigningSet,
  contractRedlineState, resolveFieldEdit, withdrawFieldEdit, proposeFieldEdit,
  resolveClause, withdrawClause, attachHorseToDocument,
  sendContractToParty, cancelContract, archiveContract, hardDeleteContract,
  setFieldResponsibility, setFieldIncluded, setFieldNa, setFieldControlOverride, setFieldStructured,
  type ContractDetail, type ContractField, type ContractMessage, type PartyControls,
  type SigningSetDoc, type RedlineState,
} from '../../lib/contracts';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { ContractCascade, ContractBody } from '../../components/app/ContractCascade';
import { AddElementButton } from '../../components/app/AddElementModal';
import { PartyControlsCard, type PartyControlValues } from '../../components/app/PartyControlsCard';
import { TrackChangesPanel } from '../../components/app/TrackChangesPanel';
import { ContractComments, type PendingAnchor } from '../../components/app/ContractComments';
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  // Document body is visible by default (DocuSign principle: you sign what you
  // see). Parties can collapse it while filling fields, but it no longer hides.
  const [showBody, setShowBody] = useState(true);
  const [messages, setMessages] = useState<ContractMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  // Comments: a span selection or a field's "Comment" button sets a pending
  // anchor that opens the comments composer. changeKey bumps to reload the
  // track-changes + comments panels after any edit.
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const [changeKey, setChangeKey] = useState(0);
  // Clause structure for clause-model (Section›Clause›Field) documents.
  const [structure, setStructure] = useState<TemplateStructure | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await contractDocumentDetail(id));
      contractMessagesList(id).then(setMessages).catch(() => setMessages([]));
      contractSigningSet(id).then(setSigningSet).catch(() => setSigningSet([]));
      contractRedlineState(id).then(setRedline).catch(() => setRedline(null));
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
  useEffect(() => {
    if (doc?.status === 'EXECUTED' && id && !deliveredRef.current) {
      deliveredRef.current = true;
      fetch('/api/deliver-documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: [id] }),
      }).catch(() => {});
    }
  }, [doc?.status, id]);
  const myRoles = detail?.my_roles ?? [];
  const isOwnerSide = isStaff || (doc?.is_originator ?? false);
  const isLessor = myRoles.includes('LESSOR');
  const state = doc?.workflow_state ?? 'editable';
  const editablePhase = state === 'editable' || state === 'editing';
  const horseConfirmed = !!doc?.horse_section_confirmed_at;
  const isSent = !!doc?.sent_at;
  const isArchived = !!doc?.archived_at;
  const isCancelled = !!doc?.cancelled_at;

  // Receiving-party rendering (§C): a party who has fields to fill sees the doc
  // with THEIR empty fields highlighted and locked fields lightened; a party with
  // NOTHING to fill (review-for-signature only) sees the whole document as
  // uneditable rich text — the same as the post-lock review view.
  const myFillableEmpty = (detail?.fields ?? []).filter(
    (f) => f.can_edit && !(f.value ?? '').trim(),
  );
  const reviewOnly = !isOwnerSide && editablePhase && myFillableEmpty.length === 0;
  // seats we can send to = the parties that aren't the company/originator side
  const sendableRoles = Array.from(new Set((detail?.signatures ?? [])
    .map((s) => s.party_role).filter((r) => !myRoles.includes(r) && r !== 'FHE' && r !== 'COMPANY')));
  const iSigned = (detail?.signatures ?? []).some(
    (s) => s.signed_at && myRoles.includes(s.party_role));
  const counterpartySigned = (detail?.signatures ?? []).some((s) => s.signed_at);
  const partyControls: PartyControls[] = detail?.party_controls ?? [];
  // the seats an outside party can be invited into (not mine, not the company's)
  const invitableRoles = Array.from(new Set((detail?.signatures ?? [])
    .map((s) => s.party_role)
    .filter((r) => !myRoles.includes(r) && r !== 'FHE' && r !== 'COMPANY')));

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

  const saveField = useCallback(async (key: string, value: string) => {
    try {
      await setContractField(id!, key, value);
      await load();
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that field.');
    }
  }, [id, load]);

  // A party proposes a change to a field they can't directly edit (redline, M-4).
  const suggestFieldEdit = useCallback((f: ContractField) => {
    const proposed = window.prompt(`Suggest a new value for "${f.label ?? f.field_key}":`, f.value ?? '');
    if (proposed == null) return;
    void act(() => proposeFieldEdit(id!, f.field_key, proposed.trim()), 'Suggested change sent for review.');
  }, [id]);

  // Comment anchored to a specific field (opens the comments composer).
  const commentOnField = useCallback((f: ContractField) => {
    setPendingAnchor({ kind: 'field', ref: f.field_key, label: f.label ?? f.field_key });
  }, []);

  if (error && !detail) return <p role="alert" className="form-error">{error}</p>;
  if (!detail || !doc) return <p className="body-text text-muted text-sm">Loading the contract…</p>;

  const STATE_LABEL: Record<string, string> = {
    editable: 'In progress', editing: 'Being edited', in_review: 'In review',
    locked: 'Ready to sign', executed: 'Executed', void: 'Void',
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

      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-serif text-2xl text-green-900 flex items-center gap-2">
          <FileText size={22} className="text-gold-ink" /> {doc.title}
        </h1>
        <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
          state === 'executed' ? 'bg-green-800 text-white'
          : state === 'locked' ? 'bg-gold-50 text-gold-ink' : 'bg-green-800/10 text-green-800'
        }`}>
          {STATE_LABEL[state] ?? state}
        </span>
      </div>

      {/* Sticky "Add to contract" sub-header — one button that launches the
          section/clause/field modal. Present for clause-model docs while editable
          so it's always reachable; the modal asks WHAT and WHERE. */}
      {structure && isOwnerSide && editablePhase && id && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 mb-3 bg-cream-100/95 backdrop-blur border-b border-green-800/10">
          <AddElementButton documentId={id} disabled={!editablePhase}
            sections={structure.sections.map((s) => s.heading)}
            canAddStructure={isOwnerSide}
            canAddClause={isOwnerSide || (redline?.can_add_clause ?? false)}
            onAdded={() => void act(async () => {})} />
        </div>
      )}
      <p className="text-sm text-muted mb-5">
        {isOwnerSide
          ? 'The company originates this contract. Fill any side\u2019s fields \u2014 acting on behalf of a party where needed \u2014 set the controls, lock, then invite.'
          : reviewOnly
            ? 'Review the document below and sign \u2014 or respond to the other party.'
            : 'The highlighted fields need your input. Anything shown lighter is locked while you complete your part.'}
      </p>

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
            <ContractBody body={doc.merged_body}
              onSelectSpan={(sp) => setPendingAnchor({ kind: 'span', quote: sp.quote, quotePrefix: sp.quotePrefix })} />
          </div>
        </div>
      )}

      {/* Owner-side: per-party document controls + invite.
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
          {/* Recipient editing (M-5): let the counterparty edit DEAL terms/body
              directly while negotiating. Distinct from can_edit_deal per-party —
              this is the document-wide switch the field-write RPCs check. */}
          <label className="inline-flex items-center gap-2 text-[12.5px] text-secondary mb-3">
            <input type="checkbox" className="accent-green-700"
              checked={doc?.recipient_editing ?? false}
              onChange={(e) => void act(() => setRecipientEditing(id!, e.target.checked),
                e.target.checked ? 'Counterparty may now edit the deal terms.' : 'Counterparty edit access turned off.')} />
            Let the other party edit deal terms while negotiating
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="email" placeholder="counterparty@email.com" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-green-800/15 text-sm focus-ring w-52" />
            {/* which seat they're invited into — derived from the contract's parties */}
            <select value={inviteRole || invitableRoles[0] || ''} aria-label="Invite as"
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-green-800/15 text-sm bg-white focus-ring">
              {(invitableRoles.length ? invitableRoles : ['LESSOR']).map((r) => (
                <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
              ))}
            </select>
            <button type="button" className="btn-outline-gold text-xs"
              disabled={!inviteEmail}
              onClick={() => void act(
                () => inviteCounterparty(id!, inviteRole || invitableRoles[0] || 'LESSOR', inviteEmail),
                'Invitation sent.')}>
              <Mail size={13} /> Invite
            </button>
          </div>
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
            <ContractBody body={doc.merged_body}
              onSelectSpan={(sp) => setPendingAnchor({ kind: 'span', quote: sp.quote, quotePrefix: sp.quotePrefix })} />
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
              <ContractBody body={doc.merged_body}
              onSelectSpan={(sp) => setPendingAnchor({ kind: 'span', quote: sp.quote, quotePrefix: sp.quotePrefix })} />
            </div>
          )}
        </section>
      )}

      {/* workflow + signing */}
      {state !== 'executed' && state !== 'void' && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5">
          <h2 className="font-serif text-green-800 mb-3">Next steps</h2>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {isOwnerSide && editablePhase && (
              <>
                <button type="button" className="btn-secondary text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'in_review'), 'Sent for review.')}>
                  <Send size={13} /> Send for review
                </button>
                <button type="button" className="btn-outline-gold text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'locked'), 'Locked — the final document is ready to sign.')}>
                  <Lock size={13} /> Lock for signing
                </button>
              </>
            )}
            {isOwnerSide && state === 'in_review' && (
              <>
                <button type="button" className="btn-secondary text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'editable'))}>
                  Back to editing
                </button>
                <button type="button" className="btn-outline-gold text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'locked'), 'Locked — ready to sign.')}>
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

          {/* Cancel (any party) / Archive + Delete (staff) */}
          <div className="flex flex-wrap items-center gap-2 border-t border-green-800/10 pt-3">
            {!isCancelled && (
              <button type="button" className="text-xs text-red-700 hover:bg-red-50 rounded px-3 py-1.5 focus-ring"
                onClick={() => { if (window.confirm('Cancel this document? All parties will be notified and the barn will archive or remove it.')) void act(() => cancelContract(id!), 'Document cancelled — all parties notified.'); }}>
                Cancel document
              </button>
            )}
            {isStaff && (
              <button type="button" className="text-xs text-secondary hover:bg-green-800/5 rounded px-3 py-1.5 focus-ring"
                onClick={() => void act(() => archiveContract(id!, !isArchived), isArchived ? 'Unarchived.' : 'Archived — findable and resumable.')}>
                {isArchived ? 'Unarchive' : 'Archive'}
              </button>
            )}
            {isStaff && (
              <button type="button" className="text-xs text-red-700 hover:bg-red-50 rounded px-3 py-1.5 focus-ring ml-auto"
                onClick={() => { if (window.confirm('Delete this document entirely? This is a hard delete — as if it never existed. This cannot be undone.')) void act(async () => { await hardDeleteContract(id!); navigate('/app/ops/documents'); }); }}>
                Delete entirely
              </button>
            )}
          </div>

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
                  onClick={() => void act(() => lockAndSign(id!, myRoles[0], signName.trim()), 'Signed.')}>
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
            pendingAnchor={pendingAnchor}
            onAnchorConsumed={() => setPendingAnchor(null)}
            onChanged={() => setChangeKey((k) => k + 1)} />
        </div>
      )}

      {/* Change history / track changes (always-on) — what each party changed,
          and the human face of the retained audit trail. */}
      {id && (
        <div className="mt-5">
          <TrackChangesPanel documentId={id} refreshKey={changeKey} />
        </div>
      )}

      {/* Contract messages — parties talk here; the company sees every message
          (deal-conversation oversight), whichever side it serves. */}
      <section className="bg-white border border-green-800/10 rounded-xl p-5 mt-5">
        <h2 className="font-serif text-green-800 mb-1">Messages</h2>
        <p className="text-[12px] text-muted mb-3">
          {isOwnerSide
            ? 'Everything said on this contract, both sides.'
            : state === 'locked' && !iSigned
              ? 'Not ready to sign? Say why here — the other party and the company are notified.'
              : 'Questions or negotiation notes — the other party and the company see these.'}
        </p>
        <div className="flex flex-col gap-2 mb-3 max-h-72 overflow-y-auto">
          {messages.length === 0 && <p className="text-sm text-muted">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className="border border-green-800/10 rounded-lg px-3.5 py-2.5">
              <p className="text-[11px] text-muted mb-0.5">
                {m.sender_label} · {new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="text-sm text-green-900 whitespace-pre-line">{m.body}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea rows={2} value={msgText} onChange={(e) => setMsgText(e.target.value)}
            placeholder="Write a message about this contract…"
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-green-800/15 text-sm focus-ring resize-none" />
          <button type="button" className="btn-primary text-xs self-end" disabled={!msgText.trim()}
            onClick={() => void act(async () => {
              await contractMessagePost(id!, msgText.trim());
              setMsgText('');
            })}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
