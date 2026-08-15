import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { originFrom } from '../../lib/linkOrigin';
import { supabase } from '../../lib/supabase';
import {
  FileText, CheckCircle2, Lock, Send, PenLine, ShieldCheck, RotateCcw, MessageSquarePlus,
  History, StickyNote, Check,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { usePropertyTerm } from '../../contexts/BrandProvider';
import { withArticleCapitalized, agree } from '../../lib/propertyTerm';
import {
  contractDocumentDetail, setContractField,
  resolveChangeRequest, advanceWorkflow, sendForReview, lockAndSign, confirmHorseSection,
  reopenHorseSection, approveContractReview,
  setPartyControls, contractSigningSet,
  contractRedlineState, resolveFieldEdit, withdrawFieldEdit,
  resolveClause, withdrawClause, attachHorseToDocument,
  markDocumentOpened,
  setFieldResponsibility, setFieldIncluded, setFieldNa, setFieldControlOverride, setFieldStructured,
  documentPartiesSummary, captureContactInfo, captureHorseRecord,
  saveContract,
  requestContractTermination, approveContractTermination, declineContractTermination,
  setDocumentPartyArchived, deleteContractWithCopy, clauseConditionMet,
  documentSignatureState, removeMySignature, requestPermissionToEdit, notifyReviewChanges,
  type ContractDetail, type ContractField, type PartyControls,
  type SigningSetDoc, type RedlineState, type PartiesHorseSummary, type PartySummary,
  type DocumentSignatureState,
} from '../../lib/contracts';
import { myWallState, myNameConfirmationState, startBillOfSale, setDocumentCoBuyer, type NameConfirmationState } from '../../lib/api';
import { ReviewChangesModal } from '../../components/app/ReviewChangesModal';
import { contractPartyOptions, type PartyOption } from '../../lib/horses';
import { ContractSubheader, SUBHEADER_BTN, type DrawerSpec } from '../../components/app/ContractSubheader';
import { ContractNotes } from '../../components/app/ContractNotes';
import { subscribeToContract, useContractPresence } from '../../lib/contractRealtime';
import { ConfirmNameModal } from '../../components/app/ConfirmNameModal';
import { CaptureInfoModal } from '../../components/app/CaptureInfoModal';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { ContractCascade, ContractBody } from '../../components/app/ContractCascade';
import { AddElementButton } from '../../components/app/AddElementModal';
import { PartyControlsCard, type PartyControlValues } from '../../components/app/PartyControlsCard';
import { ContractChangeRequests } from '../../components/app/ContractChangeRequests';
import { ContractChangeHistory } from '../../components/app/ContractChangeHistory';
import { VoidContractModal, VoidedKeepOrRemove } from '../../components/app/VoidContractModal';
import { PartiesHorseCard } from '../../components/app/PartiesHorseCard';
import { ClauseDocument } from '../../components/app/ClauseDocument';
import { SendCopiesMenu } from '../../components/app/SendCopiesMenu';
import { ContractActivityCard } from '../../components/app/ContractActivityCard';
import { FlatDocument } from '../../components/app/FlatDocument';
import {
  contractTemplateStructure, DEFAULT_TEMPLATE_CONFIG,
  type TemplateStructure, type TemplateConfig,
} from '../../lib/contracts';

/** Pull a human message out of any thrown value. Supabase/PostgREST errors are
 *  plain objects with a `.message` (and often `.details`/`.hint`), NOT Error
 *  instances — so `e instanceof Error` misses them and the UI showed a useless
 *  "That action failed." This surfaces the real reason (e.g. the lock RPC's
 *  "cannot lock: 1 required field(s) still empty"). */
function errMessage(e: unknown, fallback = 'That action failed.'): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown };
    const msg = [o.message, o.details, o.hint].filter((x) => typeof x === 'string' && x).join(' — ');
    if (msg) return msg;
    if (typeof o.error === 'string' && o.error) return o.error;
  }
  if (typeof e === 'string' && e) return e;
  return fallback;
}

/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33; the
 *  pattern is CONTACTS_PAGE_RETIRED).
 *
 *  TASK ONEAUTHOR 2026-08-11: the collapsible "Review the document text" preview
 *  near the bottom of this page was the flat document's only body renderer, and
 *  it was positioned by how the document happened to be BUILT rather than by
 *  where a document belongs — below the change-request list, behind a control
 *  labelled as though the document were an attachment to itself.
 *
 *  Its successor is <FlatDocument>, in the ONE body slot beside <ClauseDocument>.
 *  Nothing is lost in the move: same ContractBody renderer, still collapsible,
 *  still expanded by default. The block below stays as the record of what it was.
 *  While true, it never renders. */
const INLINE_BODY_PREVIEW_RETIRED = true;

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
    catch (e) { setErr(errMessage(e, 'Could not attach that horse.')); setBusy(null); }
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
    catch (e) { setErr(errMessage(e, 'That action failed.')); }
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
  const location = useLocation();
  useDocumentTitle('Contract');
  const { isStaff, user, profile } = useAuth();
  const propertyTerm = usePropertyTerm();

  /* WHO ELSE IS HERE. Presence uses the same channel pattern as the DM page.
     The display name is the community persona, falling back to the legal first
     name — this is a "Claire is here" affordance, not an identity assertion. */
  /** How the reviewer is named in a pre-authored rejection comment (L9). */
  const reviewerName = profile?.display_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || 'the other party';
  const presenceMe = useMemo(
    () => (user?.id
      ? { key: user.id, name: profile?.display_name || profile?.first_name || 'Someone' }
      : null),
    [user?.id, profile?.display_name, profile?.first_name],
  );
  const viewers = useContractPresence(id, presenceMe);
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
  /* TASK ONEAUTHOR — which surfaces THIS document type can actually have, read
     from contract_templates. It is deliberately SEPARATE state from `structure`:
     `structure` goes null for a flat document (that null IS the flat branch), but
     the configuration applies to both branches and matters most on the flat one.
     Starts at the permissive default, so nothing is hidden before it loads. */
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  // Parties/horse summary drives the "required info missing" gate on lock, and the
  // capture modal shown when locking with gaps.
  const [partiesSummary, setPartiesSummary] = useState<PartiesHorseSummary | null>(null);
  const [captureParty, setCaptureParty] = useState<PartySummary | null>(null);
  // Drawer open/closed lives entirely in ContractSubheader — one owner, one set
  // of buttons. The page no longer asks for a drawer programmatically: the only
  // caller was Add-a-Comment, which is gone.
  const [openRequestCount, setOpenRequestCount] = useState(0);
  const [voidModal, setVoidModal] = useState(false);
  /** Feedback for the party-controls rules, shown beside those controls. It is
   *  cleared whenever the controls reload, so a message never outlives the state
   *  that produced it. */
  const [controlNote, setControlNote] = useState<string | null>(null);
  /** The Send modal: choose which parties are notified, or mail yourself a PDF. */
  const [sendOpen, setSendOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  // RETURN-TO-ORIGIN. Where to send someone who VOIDS and chooses "remove", or
  // who closes the document: the page they came FROM. The linking site puts it in
  // router state (fromHere); `originFrom` validates it and falls back to
  // /app/documents when it is missing, malformed, or not an in-app path — so a
  // bad origin degrades quietly instead of erroring or leaving the app.
  // Captured once on mount so later navigation can't move the target.
  const returnTo = useRef<string>(originFrom(location.state)).current;
  // Extra recipient emails typed into the Send-for-review card (beyond the emails
  // already on file for each party). The draft is the in-progress input.
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  // For a staff member who is also a party: their explicit view choice, or
  // undefined to use the natural default for the current state (edit while
  // editable/in-review; read-only signer view once locked). Set by the toggle.
  const [viewChoice, setViewChoice] = useState<'signer' | 'author' | undefined>(undefined);
  // Sale contracts: bill-of-sale generation + co-buyer capture state.
  const [bosBusy, setBosBusy] = useState(false);
  // L9: signature state drives the read-only rule and its actions
  const [sigState, setSigState] = useState<DocumentSignatureState | null>(null);
  const [sigBusy, setSigBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [coBuyerBusy, setCoBuyerBusy] = useState(false);
  const [coBuyerPick, setCoBuyerPick] = useState('');
  const [coBuyerEntry, setCoBuyerEntry] = useState<Record<string, string>>({});
  const [coBuyerOptions, setCoBuyerOptions] = useState<PartyOption[]>([]);

  // DOCUMENT-BEFORE-CONTRACT: does the VIEWER still owe onboarding documents?
  // Fails CLOSED — if we cannot tell, we gate rather than offer a signing box
  // the server would reject anyway. Staff are never gated (they are never
  // hard-walled, and they sign on a party's behalf from the barn office).
  const [docGated, setDocGated] = useState(false);
  useEffect(() => {
    let active = true;
    if (isStaff) { setDocGated(false); return; }
    myWallState()
      // `wall` is the wall_gating subset — exactly what the server-side guard
      // (contact_document_wall_state → 'gating') tests, so the UI and the DB
      // agree. `pending` would over-gate on non-gating assignments.
      .then((w) => { if (active) setDocGated(Boolean(w?.wall)); })
      .catch(() => { if (active) setDocGated(true); });
    return () => { active = false; };
  }, [isStaff]);

  // NAME-BEFORE-SIGNATURE: a party whose legal name we could not safely assert
  // must state it before signing — otherwise the contract names the wrong
  // person. Fails CLOSED for the same reason the document gate does, and mirrors
  // the hard guard in record_signature() so a deep link changes nothing.
  const [nameState, setNameState] = useState<NameConfirmationState | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const reloadName = useCallback(() => {
    if (isStaff) { setNameState(null); return; }
    myNameConfirmationState()
      .then(setNameState)
      .catch(() => setNameState({ needs_confirmation: true, first_name: null, last_name: null }));
  }, [isStaff]);
  useEffect(reloadName, [reloadName]);
  const nameGated = Boolean(nameState?.needs_confirmation);

  // STALE-DOCUMENT GUARD (found during A-PARTY-VERIFY-2, 2026-08-05): a previous
  // document's fully-rendered, fully-interactive page — including its real Send
  // button — must never remain on screen once the URL has moved to a different
  // document. idRef always holds the latest route id; load() captures the id it
  // was called for and checks idRef before applying each response, so a slow or
  // out-of-order resolution from the PREVIOUS id can't overwrite the new one.
  const idRef = useRef(id);
  useEffect(() => { idRef.current = id; }, [id]);

  /* `blank` decides whether the document is torn down before refetching.
   *
   * Owner, 2026-08-08: "every selection reloads the page and I end up back at
   * the top." THIS was it. load() cleared every piece of state synchronously,
   * so the whole contract unmounted, the page went empty, and it remounted from
   * scratch — on every single field change. Scroll, focus and open drawers all
   * went with it. It reads as a page reload because functionally it is one.
   *
   * The clearing is CORRECT when the document is CHANGING: nothing from the old
   * contract may stay interactive while a different one loads. It is wrong when
   * refetching the SAME document after an edit — there is no other document to
   * protect against, and the refetch is precisely so the reader can see their own
   * change land.
   *
   * So: route change and first mount blank. Edits and realtime refreshes do not —
   * the current content stays on screen and is swapped when the new data arrives.
   * React reconciles in place, so nothing unmounts and the reader keeps their
   * position without needing it restored afterwards. */
  const load = useCallback(async ({ blank = true }: { blank?: boolean } = {}) => {
    if (!id) return;
    const requestedId = id;
    if (blank) {
      setDetail(null);
      setSigningSet([]);
      setRedline(null);
      setPartiesSummary(null);
      setSigState(null);
      setStructure(null);
      setControlNote(null);
    }
    setError(null);
    try {
      const d = await contractDocumentDetail(requestedId);
      if (idRef.current !== requestedId) return;
      setDetail(d);
      setControlNote(null);
      contractSigningSet(requestedId)
        .then((v) => { if (idRef.current === requestedId) setSigningSet(v); })
        .catch(() => { if (idRef.current === requestedId) setSigningSet([]); });
      contractRedlineState(requestedId)
        .then((v) => { if (idRef.current === requestedId) setRedline(v); })
        .catch(() => { if (idRef.current === requestedId) setRedline(null); });
      documentPartiesSummary(requestedId)
        .then((v) => { if (idRef.current === requestedId) setPartiesSummary(v); })
        .catch(() => { if (idRef.current === requestedId) setPartiesSummary(null); });
      documentSignatureState(requestedId)
        .then((v) => { if (idRef.current === requestedId) setSigState(v); })
        .catch(() => { if (idRef.current === requestedId) setSigState(null); });
      setError(null);
    } catch (e) {
      if (idRef.current !== requestedId) return;
      setError(errMessage(e, 'Could not load the contract.'));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  /* LIVE UPDATES (2026-07-31). Everything on this page persisted immediately but
     was invisible to the other party until they refreshed — two people reviewing
     together, likely on a call, each read a stale copy. Sequencing (one party at
     a time) was rejected: it serialises a naturally simultaneous conversation.

     Append-only surfaces (notes / requests / history) just bump changeKey, which
     the drawers already watch.

     FIELDS are the careful case: a remote save must not overwrite what you are
     typing. We reload the document ONLY when no field input is focused; if one
     is, we mark the page stale and reload the moment focus leaves. Losing
     someone's half-typed sentence to a background refresh would be a far worse
     bug than a one-keystroke delay in seeing their edit. */
  const [remoteStale, setRemoteStale] = useState(false);
  useEffect(() => {
    if (!id) return;
    return subscribeToContract(id, (evt) => {
      if (evt === 'notes' || evt === 'requests' || evt === 'history') {
        setChangeKey((k) => k + 1);
        return;
      }
      const el = document.activeElement;
      /* HTMLSelectElement was MISSING here (fixed 2026-08-08, owner-reported:
         "every selection reloads the page, brings me to the top"). A field save
         echoes back over realtime to the client that made it. Typing deferred
         the reload; choosing from a <select> did not, so it fell straight
         through to load() and the document re-rendered under the reader.
         Any focused form control counts as an interaction, not just text. */
      const interacting = el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el instanceof HTMLSelectElement
        || (el instanceof HTMLElement && el.isContentEditable);
      if (interacting) { setRemoteStale(true); return; }
      void load({ blank: false });
    });
  }, [id, load]);

  // Focus left an input and a remote change is waiting — apply it now.
  useEffect(() => {
    if (!remoteStale) return;
    const onFocusOut = () => {
      const el = document.activeElement;
      const stillInteracting = el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el instanceof HTMLSelectElement
        || (el instanceof HTMLElement && el.isContentEditable);
      if (!stillInteracting) { setRemoteStale(false); void load({ blank: false }); }
    };
    document.addEventListener('focusout', onFocusOut);
    return () => document.removeEventListener('focusout', onFocusOut);
  }, [remoteStale, load]);

  /* THE CHANGES FREEZE TRIGGER — the counterparty OPENING THE DOCUMENT.
     Once another party has opened the contract, the authoring party's pending
     CHANGES (field edits) are locked. That is the whole test: no scroll
     observation, no per-section viewport tracking. The DB records one row per
     (document, contact), first-open-wins, and `document_changes_frozen`
     deliberately ignores the caller's OWN open — you cannot lock yourself out by
     reading your own document. Repeat opens are cheap no-ops.
     Failures are swallowed: a stamp must never stop someone reading a contract. */
  useEffect(() => {
    if (!id) return;
    markDocumentOpened(id).catch(() => { /* never block reading the document */ });
  }, [id]);

  // (The IntersectionObserver that used to reveal a sticky duplicate bar is
  // gone: the subheader is always visible, so there is nothing to reveal.)

  const doc = detail?.document;

  /* ONE FETCH, TWO ANSWERS (TASK ONEAUTHOR).
     contract_template_structure() returns the clause structure AND the template's
     surface configuration. Zero sections → `structure` is null, which is the flat
     branch; the config lands either way.
     Every failure path falls back to the PERMISSIVE default rather than hiding
     surfaces: a lookup that did not answer must not be read as "this document has
     no drawers". */
  const templateKey = doc?.template_key ?? null;
  useEffect(() => {
    if (!templateKey) { setStructure(null); setTemplateConfig(DEFAULT_TEMPLATE_CONFIG); return; }
    contractTemplateStructure(templateKey)
      .then((s) => {
        setStructure(s.sections.length > 0 ? s : null);
        setTemplateConfig(s.config ?? DEFAULT_TEMPLATE_CONFIG);
      })
      .catch(() => { setStructure(null); setTemplateConfig(DEFAULT_TEMPLATE_CONFIG); });
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
  /* RETIRED 2026-08-04. Delivery used to be triggered from HERE — when a viewer
     happened to have the page open and saw status EXECUTED. A party who signed
     on a phone and closed the tab was emailed nothing (39 executed documents
     had zero delivery rows). The send now fires in the DATABASE the moment the
     completing signature executes the document
     (documents_send_executed_email_trg -> send_executed_document_email), with
     documents.executed_email_sent_at as the sent/not-sent state the UI reads to
     show Send vs Resend. */
  const deliverExecutedCopy = useCallback(() => {
    if (!id) return;
    deliveredRef.current = true;
  }, [id]);
  const myRoles = detail?.my_roles ?? [];
  const state = doc?.workflow_state ?? 'editable';
  // A staff member can ALSO be a party on the contract (e.g. a barn admin who is
  // the Lessee, signing on the company's behalf). They wear two hats:
  //  • while the doc is editable/in review → author/edit it (default), OR preview it
  //    read-only as the signer to see exactly what they'll sign;
  //  • once it's LOCKED for signing (read-only, awaiting signatures) → they can
  //    temporarily re-enable editing to fix a term before signing.
  // `viewAsSigner` = they've chosen the read-only signer view instead of editing.
  const staffIsParty = isStaff && myRoles.length > 0;
  // Natural default: read-only signer view once locked; author/edit before that.
  const defaultAsSigner = state === 'locked';
  const viewAsSigner = staffIsParty
    ? (viewChoice === undefined ? defaultAsSigner : viewChoice === 'signer')
    : false;
  // H1 originator-authority collapse: the company (staff) is always the author.
  // A party being stamped as originator is provenance only — it no longer opens
  // the owner-side surface.
  const isOwnerSide = isStaff && !viewAsSigner;
  // the horse-owning side: Lessor on a lease, Seller on a sale / bill of sale
  const isLessor = myRoles.includes('LESSOR') || myRoles.includes('SELLER');
  // Editing is allowed in review too — the parties' per-party controls (can_fill /
  // can_edit_deal) decide what each may actually change; a party with neither just
  // sees a read-only document. Locked/executed stay read-only (fields are DB-read-
  // only once locked). To edit a locked doc, the admin UNLOCKS it back to review
  // (see the "Unlock to edit" toggle) — there's no in-place locked editing.
  const editablePhase = state === 'editable' || state === 'editing' || state === 'in_review';
  /* STRUCTURE used to be a narrower gate than FIELDS (TASK ADDITEM,
     2026-08-12): every RPC that changes the document's SHAPE —
     add_contract_composition, remove_contract_composition,
     add_contract_element, propose_clause, set_field_included — accepted only
     `editable | editing`, not `in_review`, so the "Add item" button had to be
     disabled during review or its save would silently fail. TASK-INREVIEW
     (D14, 2026-08-12) widened all five RPCs to also accept `in_review` — the
     safeguard is the review flow itself, not a structural lock — so the
     button's phase gate is `editablePhase` again, same as everything else on
     this page. */
  const horseConfirmed = !!doc?.horse_section_confirmed_at;
  const isSent = !!doc?.sent_at;
  const isArchived = !!doc?.archived_at;
  const isExecuted = state === 'executed';
  const isTerminated = state === 'terminated';
  const terminationRequested = !!doc?.termination_requested_at && !isTerminated;
  // A dead/inactive contract (terminated or void) is the only time the per-party
  // Archive control is offered — you archive to clear it from your list. There is
  // no "cancelled" state any more: staff and parties share the one VOID flow.
  const isInactive = isTerminated || state === 'void';
  // ── VOID lifecycle ──
  // `can_void` comes from the DB (can_void_document): a party who has NOT signed,
  // on a live document. It stays true after the OTHER party signs, and goes false
  // once the caller themselves signs.
  const isVoid = state === 'void' || !!doc?.voided_at;
  const canVoid = !!doc?.can_void && !isVoid;
  // The counterparty of a void needs the same keep-or-remove choice. Show it when
  // the doc is void, they didn't do the voiding, and they haven't chosen yet.
  const needsVoidChoice = isVoid && !doc?.voided_by_me && !doc?.my_hidden_at && myRoles.length > 0;
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
  // NOTHING left to fill (review-for-signature only) sees the whole document as
  // uneditable rich text — the same as the post-lock review view.
  //
  // "Left to fill" = a field that is editable by me, empty, REQUIRED, and ACTIVE
  // (its gate is met). Optional fields (Additional terms, Co-owners, exception
  // notes, restriction toggles, etc.) and gated-off fields must NOT count — leaving
  // them blank is valid, and counting them wrongly kept a party stuck on "fill the
  // highlighted fields" with nothing they could actually fill.
  const valueMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of detail?.fields ?? []) m[f.field_key] = f.responsibility?.party ?? f.value ?? '';
    return m;
  }, [detail?.fields]);
  /* Co-buyer: contact options for the picker (same list the primary parties are
     picked from on NewContractPage). WAS `templateKey === 'HORSE_SALE_V2' ||
     templateKey === 'HORSE_BILL_OF_SALE'` — now the template says so itself
     (contract_templates.allows_co_buyer), so a third document type that takes a
     co-buyer is an UPDATE, not an edit to this file. */
  const allowsCoBuyer = templateConfig.allows_co_buyer;
  useEffect(() => {
    if (allowsCoBuyer && isStaff) {
      contractPartyOptions().then(setCoBuyerOptions).catch(() => setCoBuyerOptions([]));
    }
  }, [allowsCoBuyer, isStaff]);

  const myFillableEmpty = (detail?.fields ?? []).filter(
    (f) => f.can_edit
      && !(f.value ?? '').trim()
      && f.required && !(f.is_optional ?? false)
      && clauseConditionMet(f.conditional_on, valueMap),
  );
  const reviewOnly = !isOwnerSide && editablePhase && myFillableEmpty.length === 0;
  // When the document should render as the READ-ONLY merged-body frame (with the
  // real signature/date substitutions) rather than the editable authoring surface:
  //  • a review-only party (nothing to fill), OR
  //  • any LOCKED or TERMINATED document. Locked is frozen for signing; the
  //    authoring surface shows unsubstituted SIG.* placeholders, so a signer would
  //    never see their captured signature there. (Editing a locked doc means
  //    unlocking it back to in_review, so nobody edits in-place while locked.)
  // Executed has its own sealed view below.
  const readOnlyDoc = (state !== 'executed')
    && (reviewOnly || state === 'locked' || state === 'terminated');
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
  // Seats still awaiting a signature. Signature rows only exist once a doc is
  // locked; before that (in_review) fall back to the party roster so staff can
  // wet-sign on a party's behalf directly from review (signature left open).
  const signedRoles = new Set((detail?.signatures ?? []).filter((s) => s.signed_at).map((s) => s.party_role));
  const pendingFromSignatures = (detail?.signatures ?? [])
    .filter((s) => !s.signed_at && s.party_role !== 'FHE' && s.party_role !== 'COMPANY')
    .map((s) => s.party_role);
  const pendingFromParties = (detail?.party_controls ?? [])
    .map((c) => c.party_role)
    .filter((r) => r && r !== 'FHE' && r !== 'COMPANY' && !signedRoles.has(r));
  const pendingSignerRoles = Array.from(new Set(
    pendingFromSignatures.length > 0 ? pendingFromSignatures : pendingFromParties));
  // TASK COSIGN: of the pending seats that aren't one of my own roles, only
  // the ones belonging to the org's own company contact are staff-signable —
  // record_signature() rejects staff signing for any other party (tightened
  // 20260803, after this screen's original "sign on a party's behalf" box was
  // built for any pending seat). Restrict the affordance to match what the
  // server will actually accept, and label it with the company's name.
  const companySignableRoles = new Set(detail?.company_signable_roles ?? []);
  const companyContactName = detail?.company_contact_name ?? 'the company';
  const companyPendingRoles = pendingSignerRoles.filter(
    (r) => !myRoles.includes(r) && companySignableRoles.has(r));

  /* UIO-017. The #contract-signatures section below (~:1899) has its own
     outer gate (state !== executed/void/terminated, and one of in_review /
     locked / signatures.length > 0) — that part was already correct; a
     comment right above it says so explicitly ("no empty white box"). The
     bug is one level in: EVERY child inside that section is independently
     gated on a finer-grained condition (role, docGated, nameGated, iSigned,
     company-pending, signature count), and none of those seven conditions
     is implied by the outer gate. A viewer who fails all seven — e.g. staff
     with no party role of their own (`myRoles.length === 0`) looking at a
     `locked` document with zero signatures, exactly what the signing freeze
     produces everywhere right now — satisfies the outer gate (state ===
     'locked') while every inner block stays hidden, and the section renders
     its full card chrome around nothing.

     This is the exact disjunction of those seven conditions, not a new
     rule — if this is true, at least one child below actually renders;
     if it's false, none of them would, and the section should not either.
     (The first three below share one shape — `locked && has a role && not
     signed yet`, split three ways only by which message shows — so their
     union collapses to the shared prefix. Withdraw / correct moved to the
     subheader (2026-08-13) and no longer contributes a disjunct here.) */
  const hasSignatureCardContent =
    (state === 'locked' && myRoles.length > 0 && !iSigned)
    || iSigned
    || (isOwnerSide && state === 'locked' && companyPendingRoles.length > 0)
    || (detail?.signatures.length ?? 0) > 0;

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
      /* THIS is the reload the owner reported — "every selection reloads the
         page and I end up back at the top". Not the realtime echo I first went
         after: act() wraps EVERY action, including each field change, and
         reloaded the document directly.

         The reload is correct and must stay — conditional clauses appear and
         disappear based on field values, so the document genuinely has to
         re-evaluate after a write. What was wrong is that it discarded the
         reader's position while doing it. */
      await load({ blank: false });
      setChangeKey((k) => k + 1);   // refresh track-changes / comments
    } catch (e) {
      setError(errMessage(e));
    }
  }

  // Lock-for-signing gate: a party missing required info (name/address/email/phone)
  // can't be locked for signature — open the reusable capture modal on the first
  // incomplete party instead. The horse must also be attached and identified.
  /* lockForSigning() removed 2026-07-31 with both of its buttons. The manual
     "terms are final, just sign" gate is gone: it could not fire until the
     Lessor approved the horse, and the per-party controls already decide whether
     a side may edit or only request changes.
     The 'locked' workflow state itself is UNCHANGED and still reached through
     lock_and_sign_contract() on the approve-and-sign path — only the manual
     button is retired. */

  // Explicit Save — fields already autosave on blur; this re-persists the composed
  // document on demand and confirms, so the creator knows their work is stored.
  /* The Save BUTTON reports the outcome now — it turns green and reads "Saved"
     until the next change. The old setNote('Saved.') banner said the same thing
     a second time, in a green bar further down the page, away from the control
     that caused it. */
  const [justSaved, setJustSaved] = useState(false);
  async function saveNow() {
    setError(null); setNote(null); setSaving(true);
    try { await saveContract(id!); await load({ blank: false }); setJustSaved(true); }
    catch (e) { setError(errMessage(e, 'Could not save.')); }
    finally { setSaving(false); }
  }

  /* Any edit clears the saved state, so the button reverts to "Save" the moment
     there is something to save again. changeKey bumps on every field write. */
  useEffect(() => { setJustSaved(false); }, [changeKey]);

  /* THE CANCEL PATH IS GONE (owner-final). Staff and parties now share the ONE
     void flow — the same 3-page VoidContractModal, the same note field, the same
     counterparty notification. `can_void_document` admits staff-in-org, so the
     "Void contract" button below is the single destructive pre-execution action
     for everyone. Staff additionally keep the hard Delete for a document that
     was never sent. */

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

  // H2: reviewer approval — ALWAYS recorded; the document locks when every
  // non-staff signing party has approved and the preconditions pass, otherwise
  // the named blockers come back for display.
  async function approveReview() {
    setError(null); setNote(null);
    try {
      const r = await approveContractReview(id!);
      setNote(r.locked
        ? 'Approved — the contract is locked and ready to sign below.'
        : `Your approval was recorded. Before signing can open: ${r.blockers.map((b) => b.message).join('; ')}`);
      await load({ blank: false });
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(errMessage(e, 'Could not record your approval.'));
    }
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
      setError(errMessage(e, 'Could not delete the document.'));
    }
  }

  // Notify each counterparty (and any extra emails) to review + sign. Guarded so a
  // second click can't fire while a send is in flight (that previously sent
  // duplicate emails), and it asks for confirmation first, then reports the result.
  /* SEND — to the listed parties only (owner 2026-07-31). The free-text "notify
     anyone" path is gone: a contract is between its parties, and emailing a
     non-party a review request implied a standing they do not have. Someone who
     needs to READ it gets the PDF option below instead. */
  /* Mail the caller a PDF of the contract AS IT STANDS. Deliberately sends only
     to the person asking — the endpoint takes no recipient — so an unexecuted
     contract cannot be pushed to a third party as though it were finished. The
     point is to hand an adviser the open choices, not to distribute the deal. */
  async function emailWorkingCopy() {
    if (pdfBusy || !id) return;
    setPdfBusy(true); setError(null); setNote(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const r = await fetch('/api/contract-working-copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ documentId: id }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload.error || 'Could not send the copy.');
      setNote(`A working copy is on its way to ${payload.to}.`);
      setSendOpen(false);
    } catch (e) {
      setError(errMessage(e, 'Could not send the working copy.'));
    } finally { setPdfBusy(false); }
  }

  async function sendReview(roles: string[] = invitableRoles) {
    if (notifying) return;
    setSendOpen(false);
    setNotifying(true);
    setError(null); setNote(null);
    try {
      const r = await sendForReview(id!, roles);
      // SENDGUARD §1: a party who already signed is refused, not skipped. Say so —
      // folding them into the skipped count would report "no email on file" about
      // someone whose signature is already on this document.
      const prettyRole = (x: string) => x.charAt(0) + x.slice(1).toLowerCase();
      const extraNote = r.refused.length
        ? ` ${r.refused.map(prettyRole).join(' and ')} already signed this document, so no new signing invitation was sent there.`
        : '';
      // Name who was actually notified. "All parties" is only true when this
      // send covered every invitable role — saying it after a single-party send
      // (the "Send to Lessor only" button) reads as though the counterparty was
      // emailed too, which is exactly what it is NOT.
      const pretty = (x: string) => x.charAt(0) + x.slice(1).toLowerCase();
      const names = roles.map(pretty);
      const who = names.length > 1 && names.length === invitableRoles.length
        ? 'all parties'
        : names.length <= 1
          ? (names[0] ?? '')
          : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      const wereWas = who === 'all parties' || names.length > 1 ? 'were' : 'was';
      if (r.emailed === 0 && r.skipped === 0 && r.refused.length > 0) {
        // Every selected party had already signed. Nothing was sent, and that is
        // the correct outcome — report it as the reason, not as "nobody selected".
        setNote(`Nothing to send —${extraNote}`);
      } else if (r.emailed === 0 && r.skipped === 0) {
        // allSettled over an empty roles array yields 0/0, which used to fall
        // into the success branch and report a send that never happened. On a
        // legal document a false success is worse than an error.
        setError('Nothing was sent — no party was selected to notify.');
      } else {
        setNote(r.skipped > 0
          ? `Notified. Emailed ${r.emailed} of ${r.emailed + r.skipped} part${r.emailed + r.skipped === 1 ? 'y' : 'ies'}; ${r.skipped} could not be emailed (no email on file or email delivery not configured). In-app notifications were sent to parties with an account.${extraNote}`
          : `Notified — ${who} ${wereWas} notified by email and in-app.${extraNote}`);
      }
      await load({ blank: false });
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(errMessage(e, 'Could not notify the parties.'));
    } finally {
      setNotifying(false);
    }
  }

  const saveField = useCallback(async (key: string, value: string) => {
    try {
      await setContractField(id!, key, value);
      await load({ blank: false });
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(errMessage(e, 'Could not save that field.'));
    }
  }, [id, load]);

  // Commit a party CONTACT token (LESSOR/LESSEE . ADDRESS/PHONE/EMAIL/FULL_NAME):
  // writes to that party's contact record, then refills + re-merges the doc so the
  // token reflects it. The value is captured now and confirmed by the party at
  // review (see the confirmation modal).
  const editPartyContact = useCallback(async (token: string, value: string) => {
    const [role, field] = token.split('.');
    // COBUYER is a namespace, not a party_role: the co-buyer is the SECOND
    // BUYER party (summary rows are ordered by role then signer_order).
    const party = role === 'COBUYER'
      ? (partiesSummary?.parties.filter((p) => p.party_role === 'BUYER') ?? [])[1]
      : partiesSummary?.parties.find((p) => p.party_role === role);
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
      await load({ blank: false });
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(errMessage(e, 'Could not save that contact detail.'));
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
      await load({ blank: false });
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(errMessage(e, 'Could not save that horse-record detail.'));
    }
  }, [id, load, doc?.horse_id]);

  /* The per-field ✎ "suggest a change" marker and its comment path were removed
     2026-07-31 (owner). The Requests drawer replaces them: a counterparty opens
     it, picks the item, and writes the request there — one place for that
     conversation instead of a superscript icon buried in the prose. */

  // ── sale: generate the companion bill of sale (same engagement) ──
  const generateBillOfSale = useCallback(async () => {
    if (!id) return;
    setBosBusy(true);
    try {
      const out = await startBillOfSale(id);
      navigate(`/app/contracts/${out.document_id}`);
    } catch (e) {
      setError(errMessage(e, 'Could not generate the bill of sale.'));
    } finally {
      setBosBusy(false);
    }
  }, [id, navigate]);

  // ── sale: co-buyer party capture (TXN.CO_BUYER_ENABLED=YES with no second
  //    BUYER party yet). Pick an existing account/contact exactly as the primary
  //    parties are picked, or hand-enter — which creates a contact record. ──
  const addCoBuyer = useCallback(async () => {
    if (!id) return;
    setCoBuyerBusy(true);
    try {
      await setDocumentCoBuyer(id, coBuyerPick
        ? { contactId: coBuyerPick }
        : {
            firstName: coBuyerEntry.first_name, lastName: coBuyerEntry.last_name,
            email: coBuyerEntry.email, phone: coBuyerEntry.phone,
            addressLine1: coBuyerEntry.address_line1, city: coBuyerEntry.city,
            state: coBuyerEntry.state, postalCode: coBuyerEntry.postal_code,
          });
      setCoBuyerEntry({});
      setCoBuyerPick('');
      await load({ blank: false });
      setChangeKey((k) => k + 1);
    } catch (e) {
      setError(errMessage(e, 'Could not add the co-buyer.'));
    } finally {
      setCoBuyerBusy(false);
    }
  }, [id, coBuyerPick, coBuyerEntry, load]);

  if (error && !detail) return <p role="alert" className="form-error">{error}</p>;
  if (!detail || !doc) return <p className="body-text text-muted text-sm">Loading the contract…</p>;

  const STATE_LABEL: Record<string, string> = {
    editable: 'In progress', editing: 'Being edited', in_review: 'In review',
    locked: 'Ready to sign', executed: 'Executed', void: 'Void',
    terminated: 'Terminated',
  };

  /* ── segmented signing set (lease → vet auth → care release) ──
     The step's name is carried WITH the row (contract_templates.short_label, via
     contract_signing_set) instead of a map in this file. That map named 5 of the
     26 templates and rendered every other one as the literal word "Document";
     today's single live set happens to be two of the five, so nothing was visibly
     broken — it was one new document type away from being so.
     `title` is the fallback the RPC itself already applies, so the last resort
     here only fires for a payload from before the column existed. */
  const stepLabel = (s: SigningSetDoc) => s.short_label?.trim() || s.title?.trim() || 'Document';
  const inSet = signingSet.length > 1;
  const curIdx = signingSet.findIndex((s) => s.document_id === id);
  const nextInSeq = curIdx >= 0 ? signingSet.slice(curIdx + 1).find((s) => !s.executed) : undefined;
  const allExecuted = inSet && signingSet.every((s) => s.executed);
  const thisExecuted = doc.status === 'EXECUTED';

  /* max-w-5xl caps READING width — a contract is prose and should not run the
     width of a 30" monitor. But it was on the PAGE, so it also capped the
     subheader at 1024px: on a wide window the bar stopped short of the edge and,
     worse, its buttons sized themselves against a 1024px box and kept wrapping
     when there was obviously room.
     The cap now sits on the document body below the bar, so the bar fills <main>
     and the prose stays readable.

     `mx-auto` added 2026-08-08 (owner: "a large space to the right of the
     content"). The cap was LEFT-ALIGNED, so every pixel of extra window width
     piled up on one side and read as a gap rather than as margin. Centring does
     not widen the column — a contract is prose and 1024px is already generous —
     it just puts the leftover space on both sides where it looks deliberate. */
  /* pb-24 added 2026-08-09 (owner): the last card sat flush against the bottom of
     the scroll area, so a contract read as though it had been cut off rather than
     ended. Only on the standalone page — an embedded contract is laid out by its
     host, which supplies its own spacing. */
  const bodyWidth = embedded ? '' : 'max-w-5xl mx-auto pb-24';
  return (
    <div>
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
                    {stepLabel(s)}
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
              Continue to {stepLabel(nextInSeq)} →
            </button>
          ) : !thisExecuted ? (
            <p className="form-hint mt-3">Sign this document to continue to the next.</p>
          ) : null}
        </div>
      )}

      {showDeck && id && !isExecuted && (
        <ContractSubheader
          viewers={viewers}
          /* WHICH SURFACES THIS DOCUMENT CAN HAVE (TASK ONEAUTHOR).
             The drawer machinery is already generic — every one of these just
             watches `changeKey` and does not care what kind of document it is.
             What varies is whether the surface can ever have contents: a release
             signed at a kiosk is issued as-is, so a change-requests drawer on one
             is a button that opens onto nothing, the same defect as the "and 1
             more" control that expanded to nothing.
             The answer is DATA (contract_templates.show_*), defaulting to true, so
             the only documents that lose a drawer are the ones classified as
             standard-form — and reclassifying one is an UPDATE, not a code edit. */
          drawers={[
            templateConfig.show_comments && {
              key: 'notes',
              label: 'Comments',
              icon: <StickyNote size={14} />,
              render: () => <ContractNotes documentId={id} refreshKey={changeKey} />,
            },
            templateConfig.show_change_requests && {
              key: 'requests',
              label: 'Requests',
              icon: <MessageSquarePlus size={14} />,
              count: openRequestCount,
              render: () => (
                <ContractChangeRequests
                  documentId={id}
                  canRequest={editablePhase && !isVoid}
                  refreshKey={changeKey}
                  onCount={setOpenRequestCount}
                  onChanged={() => { void load({ blank: false }); }}
                  inDrawer
                />
              ),
            },
            templateConfig.show_history && {
              key: 'history',
              label: 'History',
              icon: <History size={14} />,
              render: () => <ContractChangeHistory documentId={id} refreshKey={changeKey} inDrawer />,
            },
          ].filter(Boolean) as DrawerSpec[]}
          /* SAVE IS POSITION 1. It lived in `extras`, which renders AFTER the
             drawer buttons — so "first in extras" still put it fourth on screen.
             `leading` renders before them. */
          leading={(
            <>
              {/* LOCKED is included (2026-08-09, owner): a locked document is frozen
                  FOR SIGNING, so sending it is how the parties are asked to sign —
                  and since the per-party send buttons were removed, this is the only
                  way to reach them. sendForReview skips the illegal locked→in_review
                  advance on its own. */}
              {isOwnerSide && (editablePhase || state === 'locked') && (
                <button type="button" disabled={notifying}
                  className={`${SUBHEADER_BTN} sm:w-[7.5rem] border-green-800 bg-green-800 text-white hover:bg-green-700 disabled:opacity-60`}
                  onClick={() => setSendOpen(true)}>
                  <Send size={15} /> {notifying ? 'Sending…' : 'Send'}
                </button>
              )}
              {/* Every party can mail THEMSELVES the current state as a PDF. */}
              {!isOwnerSide && myRoles.length > 0 && !isExecuted && (
                <button type="button" disabled={pdfBusy}
                  className={`${SUBHEADER_BTN} border-green-800/20 bg-white text-green-900 hover:bg-green-800/5 disabled:opacity-60`}
                  onClick={() => void emailWorkingCopy()}>
                  {pdfBusy ? 'Sending…' : 'Email me a PDF'}
                </button>
              )}
              {isOwnerSide && !isExecuted && (
            <button type="button" disabled={saving || justSaved}
              /* Fixed width so gaining the tick and the extra character does not
                 resize the button and shift everything beside it. */
              /* SAVE — owner, 2026-08-09. Outlined in the same green the Send
                 button is FILLED with (green-800), label in that same green, so
                 the pair reads as one family: Send is the solid form, Save the
                 outlined one. Cursor-over takes the 66% fill with the label
                 flipping to the bar's own colour (cream-25); pressing it goes to
                 100% — momentarily becoming exactly the Send button — then
                 settles back. `active:` is what makes that "briefly": it holds
                 only while the pointer is down.
                 The 66% is declared in tailwind.config.js; it is the lightest
                 step that still carries the label at 4.5:1. */
              className={`${SUBHEADER_BTN} sm:w-[7.5rem] disabled:opacity-100 transition-colors duration-320 ease-glide ${
                justSaved
                  ? 'border-green-700 bg-green-50 text-green-800'
                  : 'border-green-800 bg-white text-green-800 hover:bg-green-800/66 hover:text-cream-25 active:bg-green-800 active:text-cream-25 disabled:opacity-60'}`}
              onClick={() => void saveNow()}>
              {saving ? 'Saving…' : justSaved
                ? <><Check size={15} /> Saved</>
                : 'Save'}
            </button>
              )}
            </>
          )}
          /* ROW ONE beside Send/Save/drawers: the counterparty's primary action. */
          extras={
            <>
              {!isOwnerSide && myRoles.length > 0 && editablePhase && !isInactive && (
                <button type="button"
                  className={`${SUBHEADER_BTN} border-green-800 bg-green-800 text-white hover:bg-green-700`}
                  onClick={() => void approveReview()}>
                  <CheckCircle2 size={15} /> Accept &amp; sign
                </button>
              )}
            </>
          }
          /* ROW TWO when the bar wraps: secondary document actions. */
          trailing={
            <>
              {/* Not gated on `structure` any more (TASK ONEAUTHOR): jumping to
                  the signature block is a PAGE affordance, not a clause-model one,
                  and a 12,000-character release is exactly the document where the
                  reader most needs it. The scroll target is the same either way. */}
              {id && !isExecuted && (
                <button type="button"
                  className={`${SUBHEADER_BTN} border-green-800/20 bg-white text-green-900 hover:bg-green-800/5`}
                  /* The signatures card only exists once the document is in
                     review/locked or has captured signatures — in the plain
                     editable phase (where this button is most useful) the
                     target was absent and the click did NOTHING. Fall back to
                     the end of the page so it always scrolls. */
                  onClick={() => {
                    const target = document.getElementById('contract-signatures');
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                  }}>
                  Scroll to Bottom
                </button>
              )}
              {/* Generate this document's COMPANION on the same engagement (parties,
                  horse, price and payment status carry). WAS `templateKey ===
                  'HORSE_SALE_V2'`; the pairing now lives on the template row
                  (companion_template_key), so a second pairing is an UPDATE.
                  `start_bill_of_sale` is still the RPC — it derives everything from
                  the source document and is the only companion generator that
                  exists; a future second pair needs its own RPC, and this button
                  should stay pointed at the one the config names. */}
              {templateConfig.companion_template_key === 'HORSE_BILL_OF_SALE'
                && id && isStaff && !isVoid && (
                <button type="button" disabled={bosBusy}
                  className={`${SUBHEADER_BTN} border-green-800/20 bg-white text-green-900 hover:bg-green-800/5 disabled:opacity-60`}
                  onClick={() => void generateBillOfSale()}>
                  {bosBusy ? 'Generating…' : `Generate ${(templateConfig.companion_label ?? 'companion document').toLowerCase()}`}
                </button>
              )}
              {structure && id && isOwnerSide && editablePhase && (
                <AddElementButton documentId={id}
                  className={SUBHEADER_BTN}
                  structure={structure} fields={detail.fields}
                  canAddStructure={isOwnerSide}
                  canAddClause={isOwnerSide || (redline?.can_add_clause ?? false)}
                  onAdded={() => void act(async () => {})} />
              )}
              {/* Owner-side only: reopens a sent-out document for corrections.
                  No counterparty equivalent — a party's way to ask for a change
                  is Comments/Requests, not pulling the document back themselves. */}
              {isOwnerSide && (state === 'locked' || state === 'in_review') && !counterpartySigned && (
                <button type="button"
                  className={`${SUBHEADER_BTN} border-green-800/20 bg-white text-green-900 hover:bg-green-800/5`}
                  onClick={() => void act(() => advanceWorkflow(id!, 'editable'), 'Reopened for corrections.')}>
                  <RotateCcw size={13} /> Withdraw / correct
                </button>
              )}
              {isInactive && (
                <button type="button"
                  className={`${SUBHEADER_BTN} border-green-800/20 bg-white text-secondary hover:bg-green-800/5`}
                  onClick={toggleMyArchive}>
                  {isArchived ? 'Unarchive' : 'Archive'}
                </button>
              )}
            </>
          }
          /* Pinned RIGHT on whichever row they land — never adrift mid-wrap. */
          destructive={
            <>
              {canVoid && (
                <button type="button"
                  className={`${SUBHEADER_BTN} border-red-300 bg-white text-red-700 hover:bg-red-50`}
                  onClick={() => setVoidModal(true)}>
                  Void contract
                </button>
              )}
              {isStaff && !isExecuted && (
                <button type="button"
                  className={`${SUBHEADER_BTN} border-red-300 bg-white text-red-700 hover:bg-red-50 ${canVoid ? '' : 'ml-auto'}`}
                  onClick={() => void deleteEntirely()}>
                  Delete
                </button>
              )}
            </>
          }
        />
      )}

      {/* Everything BELOW the bar keeps the reading cap. */}
      <div className={bodyWidth}>

      {/* WHO HAS SIGNED — full-width, above the title, so both sides know where
          the contract stands without hunting for the signature block. */}
      {[...signedRoles].length > 0 && !isExecuted && (
        <div className="-mx-4 sm:-mx-8 xl:-mx-12 mb-5 bg-green-800 text-white px-4 sm:px-8 xl:px-12 py-2.5">
          <p className="text-sm">
            <strong>{[...signedRoles]
              .map((r) => r.charAt(0) + r.slice(1).toLowerCase())
              .join(' and ')}</strong>
            {[...signedRoles].length === 1 ? ' has signed' : ' have signed'} this contract.
            {' '}Editing it now clears that signature and asks them to sign again.
          </p>
        </div>
      )}

      {/* SIGNED → READ-ONLY (deal plan L9). A signature is never cleared by an
          edit: the edit is refused, and the signer takes their own signature off
          when they choose to. */}
      {sigState?.locked_by_signature && !isExecuted && (
        <div className="-mx-4 sm:-mx-8 xl:-mx-12 mb-5 bg-gold-50 border-y border-gold-400/50 px-4 sm:px-8 xl:px-12 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gold-900">
              Signed by {sigState.signers.map((s) => s.name ?? s.party_role).join(', ')} —
              this document is read-only. {sigState.i_have_signed
                ? 'Remove your signature to make changes.'
                : 'Ask them to remove their signature before making changes.'}
            </p>
            <span className="flex gap-2">
              {sigState.i_have_signed ? (
                <button type="button" className="btn-outline-gold text-xs" disabled={sigBusy}
                  onClick={() => {
                    if (!window.confirm('Remove your signature so this document can be changed?')) return;
                    setSigBusy(true);
                    void act(() => removeMySignature(id!), 'Your signature was removed — the document can be edited again.')
                      .finally(() => setSigBusy(false));
                  }}>
                  Remove my signature
                </button>
              ) : (
                <button type="button" className="btn-outline-gold text-xs" disabled={sigBusy}
                  onClick={() => {
                    setSigBusy(true);
                    void act(() => requestPermissionToEdit(id!),
                      'They have been asked to remove their signature.')
                      .finally(() => setSigBusy(false));
                  }}>
                  Request permission to edit
                </button>
              )}
            </span>
          </div>
        </div>
      )}

      {/* A signature came off and there are changes for that party to review. */}
      {!sigState?.locked_by_signature && !isExecuted
        && (doc as { signatures_voided_at?: string | null } | undefined)?.signatures_voided_at && (
        <div className="-mx-4 sm:-mx-8 xl:-mx-12 mb-5 bg-gold-50 border-y border-gold-400/50 px-4 sm:px-8 xl:px-12 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gold-900">
              A signature was removed, so this document can be edited.
              {isOwnerSide
                ? ' Notify the other party when your changes are ready for review.'
                : ' Review what changed, then sign again when you are ready.'}
            </p>
            <span className="flex gap-2">
              {isOwnerSide ? (
                <button type="button" className="btn-outline-gold text-xs" disabled={sigBusy}
                  onClick={() => {
                    setSigBusy(true);
                    void act(() => notifyReviewChanges(id!),
                      'They have been asked to review the changes.')
                      .finally(() => setSigBusy(false));
                  }}>
                  Notify to review
                </button>
              ) : (
                <button type="button" className="btn-outline-gold text-xs"
                  onClick={() => setReviewOpen(true)}>
                  Review the changes
                </button>
              )}
            </span>
          </div>
        </div>
      )}

      {reviewOpen && id && (
        <ReviewChangesModal documentId={id} reviewerName={reviewerName}
          onClose={() => setReviewOpen(false)} onDone={() => { void load({ blank: false }); }} />
      )}

      {/* mb-6: the notify card sat almost against the title. */}
      <div className={`mb-6 ${isInactive ? 'opacity-60' : ''}`}>
        <div className="flex justify-end">
        <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
          isTerminated || isVoid ? 'bg-red-100 text-red-800'
          : state === 'executed' ? 'bg-green-800 text-white'
          : state === 'locked' ? 'bg-gold-50 text-gold-ink' : 'bg-green-800/10 text-green-800'
        }`}>
          {isTerminated
            ? `Terminated${doc?.terminated_at ? ` · ${new Date(doc.terminated_at).toLocaleDateString()}` : ''}`
            : isVoid
              ? `Void${doc?.voided_at ? ` · ${new Date(doc.voided_at).toLocaleDateString()}` : ''}`
              : (STATE_LABEL[state] ?? state)}
        </span>
        </div>
        <h1 className="font-serif text-2xl text-green-900 flex items-center justify-center gap-2 text-center">
          <FileText size={22} className="text-gold-ink" /> {doc.title}
        </h1>
      </div>


      {/* VOID WATERMARK — non-intrusive but obvious. The document below is greyed
          out (isInactive already dims it); this names the state and carries the
          voiding party's note. */}
      {isVoid && (
        <div className="relative mb-4 rounded-lg border-2 border-red-300/70 bg-red-50/60 px-4 py-3 overflow-hidden">
          <span aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 flex items-center justify-center
                       text-red-500/15 font-serif font-bold tracking-[0.35em] text-4xl sm:text-6xl -rotate-12">
            VOID
          </span>
          <div className="relative">
            <p className="text-sm font-medium text-red-900">
              This contract was voided{doc?.voided_at ? ` on ${new Date(doc.voided_at).toLocaleDateString()}` : ''}
              {doc?.voided_by_me ? ' by you' : ''}.
            </p>
            {doc?.void_reason && (
              <p className="text-sm text-red-800 mt-1 whitespace-pre-line">&ldquo;{doc.void_reason}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      {/* The counterparty of a void gets the SAME keep-or-remove choice, either
          from their dashboard or here when they open the document. */}
      {needsVoidChoice && id && (
        <VoidedKeepOrRemove
          documentId={id}
          note={doc?.void_reason ?? null}
          onChosen={() => { void load({ blank: false }); }}
          onRemoved={() => navigate(returnTo)}
        />
      )}
      {terminationRequested && !iRequestedTermination && (
        <div className="mb-3 rounded-lg border border-gold-400/50 bg-gold-50 px-4 py-2.5 text-sm text-gold-900">
          A termination request is pending your response — see Manage above.
        </div>
      )}
      {/* A staff member who is ALSO a party wears two hats. While editable/in review
          they can edit (author) or preview read-only as the signer. Once LOCKED, the
          doc is frozen for signing — but they can temporarily re-enable editing to
          fix a term before anyone signs. The toggle controls which mode they're in. */}
      {staffIsParty && !isExecuted && !isInactive && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-muted">
            {state === 'locked'
              ? 'Locked for signing.'
              : `You’re staff and a party (${myRoles.join(', ')}).`} Mode:
          </span>
          <div className="inline-flex rounded-lg border border-green-800/20 overflow-hidden">
            <button type="button"
              className={`px-3 py-1.5 ${viewAsSigner ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/5'}`}
              onClick={() => setViewChoice('signer')}>
              {state === 'locked' ? 'Read-only (sign)' : `Signer preview (${myRoles[0]})`}
            </button>
            <button type="button"
              className={`px-3 py-1.5 border-l border-green-800/20 ${!viewAsSigner ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/5'}`}
              onClick={() => {
                if (state === 'locked') {
                  // Editing a locked doc means UNLOCKING it (fields are DB-read-only
                  // while locked). Confirm, then move back to review to edit.
                  if (window.confirm('Unlock this document to fix a term? It returns to review and must be locked again before signing. No signatures exist yet.')) {
                    setViewChoice('author');
                    void act(() => advanceWorkflow(id!, 'in_review'), 'Unlocked for editing — lock it again when done.');
                  }
                } else {
                  setViewChoice('author');
                }
              }}>
              {state === 'locked' ? 'Unlock to edit' : 'Author / manage'}
            </button>
          </div>
        </div>
      )}

      {/* VOID — the three-page modal replacing the old hard-void. Page 1 confirm
          + note, page 2 keep-or-remove (PER PARTY), page 3 success. Closing via
          the X on page 1 or 2 does NOT void. */}
      {voidModal && id && (
        <VoidContractModal
          documentId={id}
          onClose={() => setVoidModal(false)}
          onVoided={() => { setVoidModal(false); void load({ blank: false }); setChangeKey((k) => k + 1); }}
          onRemoved={() => { setVoidModal(false); navigate(returnTo); }}
        />
      )}

      {/* Party-facing notes/instructions don't apply during the creation step
          (the embedded inline authoring view) \u2014 nothing has been sent to either
          party yet. Only show guidance on the standalone contract page. */}
      {/* Owner-side guidance removed 2026-07-31: it ended "\u2026then lock it for
          signing", describing a button deleted earlier the same day. The
          party-facing lines below still describe what that party should do. */}
      {!embedded && !isOwnerSide && !isExecuted && (
        <p className="text-sm text-muted mb-5">
          {iSigned
            ? 'You\u2019ve signed. The contract executes once the other party signs.'
            : state === 'locked'
              ? 'The document is final and locked for signing. Review it below, then sign at the bottom of the page.'
              : reviewOnly
                ? 'Review the document below. It will be locked for signing once both sides are ready; you\u2019ll sign then.'
                : 'Complete the highlighted fields. The document is locked for signing once both sides are ready.'}
        </p>
      )}

      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      {/* Kept for the OTHER actions that report here (notify, send for review,
          re-fill). Save no longer sets it — its button turns green instead, so
          the outcome appears on the control that caused it. */}
      {note && <p className="mb-3 rounded px-4 py-2 text-sm bg-green-50 text-green-900">{note}</p>}

      {/* lifecycle status banners. (There is no cancelled banner: the cancel path
          was removed — a dead pre-execution contract is VOID, and the void notice
          is rendered by VoidedKeepOrRemove / the void watermark below.) */}
      {isArchived && !isVoid && (
        <div className="mb-4 rounded-lg border border-green-800/20 bg-cream-100 px-4 py-2.5 text-sm text-secondary">
          Archived — kept on file and resumable. {isStaff && 'Unarchive it below to continue.'}
        </div>
      )}
      {isSent && !isVoid && !isArchived && state !== 'executed' && (
        <p className="mb-3 text-xs text-muted">Sent to the other party — they’ve been notified.</p>
      )}

      {/* Proposed changes (redline) — now positioned in the Review zone, after the
          document identity/status rather than above the title (m-7). */}
      {redline && (
        <RedlineSection
          documentId={id!}
          redline={redline}
          isOwnerSide={isOwnerSide}
          onChanged={() => void load({ blank: false })}
        />
      )}

      {/* Executed: the sealed document */}
      {state === 'executed' && (
        <div className="bg-white border border-green-800/10 rounded-lg p-6 mb-6">
          <p className="inline-flex items-center gap-2 text-green-800 font-medium text-sm mb-3">
            <CheckCircle2 size={16} /> Executed{doc.execution_hash ? ` · ${doc.execution_hash.slice(0, 12)}…` : ''}
          </p>
          <div className="document-paper prose-sm whitespace-pre-line text-[13px] leading-relaxed text-green-950">
            <ContractBody body={doc.merged_body} />
          </div>
        </div>
      )}

      {/* A14 — staff-only activity feed, visible at ANY status (unlike Manage,
          which is executed-only), placed adjacent to it. */}
      {isStaff && id && <ContractActivityCard documentId={id} />}

      {/* TERMINATE — executed contracts only. This survived the removal of the
          notify card, which shared its wrapper: terminating an executed contract
          is unrelated to notifying parties about a draft, and losing it with the
          card would have removed the only mutual-termination path. */}
      {isExecuted && (
        <div className="bg-white border border-green-800/10 rounded-xl p-5 sm:p-6 mb-5">
          <div className="p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Manage</p>
            {/* A8B: staff-only targeted/all-parties re-send of the executed copy. */}
            {isStaff && id && (
              <div className="mb-4">
                <SendCopiesMenu
                  documentId={id}
                  parties={partiesSummary?.parties ?? []}
                  sentAt={doc?.executed_email_sent_at}
                  onSent={() => { void load({ blank: false }); }}
                />
              </div>
            )}
            {terminationRequested ? (
              iRequestedTermination ? (
                <p className="text-[13px] text-gold-800">Termination requested — awaiting the other party's agreement.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-green-950">
                    {isStaff
                      ? `${withArticleCapitalized(propertyTerm)} ${agree(propertyTerm, 'has', 'have')}`
                      : 'The other party has'} requested to terminate this contract.
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
        </div>
      )}

      {/* Parties & Horse summary — who the lease is between and for which horse.
          Staff can reassign a party or the horse in place. Shown on the standalone
          contract page (the creation page already collects these). */}
      {id && !embedded && (
        <PartiesHorseCard documentId={id} canEdit={isStaff && editablePhase}
          onChanged={() => { void load({ blank: false }); }}
          /* The document controls render INSIDE this card (owner 2026-07-31):
             they govern what these same parties may do, so two cards put the
             question and its answer in different places.
             TASK ONEAUTHOR: and only for a document those permissions MEAN
             something. A standard-form release is issued as-is and signed — there
             is no deal to edit and no suggestion to make, so a matrix of
             fill/edit/suggest toggles on one is a control that governs nothing.
             Per-template (contract_templates.show_party_controls), default true. */
          footer={isOwnerSide && editablePhase && templateConfig.show_party_controls ? (
            <>
              {/* Rule feedback lands HERE, beside the checkboxes that caused it —
                  the page-level banner sits far below and would be missed. */}
              {controlNote && (
                <p className="mb-2.5 rounded px-3 py-2 text-[13px] bg-gold-50 border border-gold-400/40 text-gold-900">
                  {controlNote}
                </p>
              )}
          <p className="text-[13px] text-muted mb-2.5">
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
                /* The server refuses to clear the LAST deal editor. Compute the
                   same condition here so the box is disabled with a reason,
                   rather than unticking and snapping back on a failed save. */
                /* Signing parties only — the company's own role is not a
                   counterparty that could carry the edit permission. */
                const signing = partyControls.filter(
                  (x) => x.party_role !== 'FHE' && x.party_role !== 'COMPANY');
                const editors = signing.filter((x) => x.can_edit_deal);
                // Nobody can act yet: no editor anywhere and no suggester either.
                const noOneEngaged = editors.length === 0
                  && !signing.some((x) => x.can_suggest);
                const otherRole = signing.map((x) => x.party_role).find((r) => r !== role);
                return (
                  <PartyControlsCard key={role} role={role} value={value}
                    lastDealEditor={editors.length <= 1 && value.can_edit_deal}
                    noOneEngaged={noOneEngaged}
                    onBlocked={(m) => { setError(null); setControlNote(m); }}
                    onEnableOtherEditor={() => {
                      if (!otherRole) return;
                      const o = signing.find((x) => x.party_role === otherRole);
                      void act(() => setPartyControls(id!, otherRole, {
                        can_fill: o?.can_fill ?? true,
                        can_edit_deal: true,
                        can_suggest: false,
                        can_add_clause: o?.can_add_clause ?? false,
                      }));
                      setControlNote(`A suggestion needs someone who can act on it — `
                        + `${otherRole.charAt(0) + otherRole.slice(1).toLowerCase()} can now edit deal terms.`);
                    }}
                    onChange={(v) => void act(() => setPartyControls(id!, role, v))} />
                );
              })}
          </div>
            </>
          ) : undefined}
        />
      )}

      {/* Horse gate — pick/add the horse before the rest of the contract */}
      {showHorseGate && id && (
        <HorseGate documentId={id} onAttached={() => { void load({ blank: false }); }} />
      )}

      {/* H5: horse-confirmation control for clause-model documents (the legacy
          flat renderer's header affordance never renders for these, so the
          Lessor previously had NO way to confirm). Gated on RIGHTS, not phase:
          the Lessor (or staff) sees it in every pre-lock state (editable /
          editing / in_review); other parties see the awaiting note ONLY while
          unconfirmed. */}
      {structure && !!doc.horse_id && horseFields.length > 0 && editablePhase
        && !isVoid && !showHorseGate && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white border border-green-800/10 rounded-xl px-5 py-3">
          <p className="text-sm font-medium text-green-900">Horse information</p>
          {horseConfirmed ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
              <ShieldCheck size={14} /> Confirmed accurate
              {(isLessor || isStaff) && (
                <button type="button" className="underline text-muted ml-2"
                  onClick={() => void act(() => reopenHorseSection(id!))}>
                  <RotateCcw size={11} className="inline" /> reopen
                </button>
              )}
            </span>
          ) : (isLessor || isStaff) ? (
            <button type="button" className="btn-outline-gold text-xs"
              onClick={() => void act(() => confirmHorseSection(id!), 'Horse information confirmed.')}>
              <ShieldCheck size={13} /> I reviewed the horse info — it's accurate
            </button>
          ) : (
            <span className="text-xs text-muted">Awaiting confirmation by the horse’s owner</span>
          )}
        </div>
      )}

      {/* Co-buyer capture: the co-buyer election is YES but no second BUYER party
          exists yet. Pick an existing account/contact (the same list the primary
          parties come from) or hand-enter to create a contact record. The server
          adds the party with the next signer_order and fills COBUYER.*. */}
      {allowsCoBuyer && isStaff && editablePhase && !isVoid
        && valueMap['TXN.CO_BUYER_ENABLED'] === 'YES'
        && (partiesSummary?.parties.filter((p) => p.party_role === 'BUYER').length ?? 0) < 2 && (
        <div className="mb-4 bg-white border border-gold-600/40 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-green-900 mb-1">Co-Buyer</p>
          <p className="text-[12px] text-muted mb-3">
            A co-buyer is elected on this contract but not yet named. Pick them from
            your accounts and contacts — or enter their details to create a contact.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <span className="form-label">Existing account or contact</span>
              <select className="form-input" value={coBuyerPick} aria-label="Co-Buyer"
                onChange={(e) => setCoBuyerPick(e.target.value)}>
                <option value="">Choose…</option>
                {coBuyerOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.email || c.id}{c.email && c.name ? ` — ${c.email}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          {!coBuyerPick && (
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              {([['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email'], ['phone', 'Phone'],
                 ['address_line1', 'Street address'], ['city', 'City'], ['state', 'State'], ['postal_code', 'ZIP']] as [string, string][]).map(([k, label]) => (
                <div key={k}>
                  <span className="form-label">{label}</span>
                  <input className="form-input" value={coBuyerEntry[k] ?? ''}
                    onChange={(e) => setCoBuyerEntry((s) => ({ ...s, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <button type="button" disabled={coBuyerBusy || (!coBuyerPick && !(coBuyerEntry.first_name || coBuyerEntry.last_name))}
            className="btn-outline-gold text-xs disabled:opacity-60"
            onClick={() => void addCoBuyer()}>
            {coBuyerBusy ? 'Adding…' : 'Add co-buyer'}
          </button>
        </div>
      )}

      {/* ═══ THE DOCUMENT BODY — one slot, renderer chosen by the document ═══
          TASK ONEAUTHOR. Whether a document is clause-composed is not a property
          of this page; it is a property of the document, and the page already
          asks: contract_template_structure returns zero sections for a flat
          template and `structure` becomes null.

            structure present → <ClauseDocument>  (fields, clauses, Add New Item)
            structure null    → <FlatDocument>    (the composed text, read-only)

          Both are hidden when the doc should render read-only (review-only,
          locked, terminated, EXECUTED) — those render as the merged-body frame,
          which shows the actual captured signatures instead of SIG.* placeholders.
          (Executed has readOnlyDoc=false by design — it uses its own sealed frame —
          so exclude it explicitly here too.)

          Clause-model documents (Section›Clause›Field): numbered structure with
          live gating. */}
      {state !== 'executed' && !readOnlyDoc && !showHorseGate && structure && (
        <ClauseDocument
          sections={structure.sections}
          fields={detail.fields}
          cb={{
            editable: editablePhase,
            authorView: isOwnerSide && editablePhase,
            /* Ownership affordances + party-scoped previews (2026-08-04):
               pass the viewer's party roles ONLY when they are reviewing as a
               party. Staff authoring (isOwnerSide) pass none, which the
               document reads as "everything is yours" — no greying, no
               highlighting, every branch previewed. */
            myRoles: isOwnerSide ? [] : myRoles,
            onSave: saveField,
            onSaveStructured: (k, s) => void act(() => setFieldStructured(id!, k, s as never)),
            onSaveResponsibility: (k, r) => void act(() => setFieldResponsibility(id!, k, r as never)),
            onInclude: (k, inc) => void act(() => setFieldIncluded(id!, k, inc)),
            onNa: (k, na) => void act(() => setFieldNa(id!, k, na)),
            onControl: (k, ov) => void act(() => setFieldControlOverride(id!, k, ov as never)),
            canSetControl: isOwnerSide,
            onEditPartyContact: editPartyContact,
            onEditHorseRecord: editHorseRecord,
          }}
        />
      )}

      {/* Field sections (legacy flat grouping) — hidden until a horse is chosen when
          the gate applies, hidden for a review-only party, and skipped entirely for
          clause-model documents (rendered above). */}
      {state !== 'executed' && !showHorseGate && !readOnlyDoc && !structure && sections.map(([section, fields]) => {
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
                  <span className="text-xs text-muted">Awaiting confirmation by the horse’s owner</span>
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
            />
          </section>
        );
      })}

      {/* …and the OTHER half of the one body slot: a document with no clause
          structure. It renders HERE, immediately after any flat field sections, so
          the reading order is fill-then-read; all fourteen flat templates carry
          zero field defs, so in practice it lands in exactly the position
          <ClauseDocument> occupies for the six clause-composed ones.

          Same visibility rule as the clause branch above, so neither renderer can
          appear while the read-only merged frame (below) or the executed frame is
          showing the same text. This REPLACES the old collapsible "Review the
          document text" block that used to sit further down the page. */}
      {state !== 'executed' && !showHorseGate && !readOnlyDoc && !structure && (
        <FlatDocument body={doc.merged_body} title={doc.title} />
      )}

      {/* (change-request composer removed 2026-07-20, audit M-3: it was
          unreachable — crFieldKey was never set. A field-level "suggest a change"
          flow is provided by redline proposeFieldEdit + pinned comments, so this
          superseded third mechanism is gone. The "Open change requests" list
          below still renders any existing requests.) */}

      {/* open change requests.
          DELIBERATELY NOT gated on templateConfig.show_change_requests. That flag
          decides whether the COMPOSE surface appears; this list only renders when
          it already has contents, so it is safe by construction, and gating it
          would strand a real request that was raised before its template was
          classified standard-form — hiding something that exists is the worse of
          the two defects. (Verified 2026-08-11: zero change requests exist on any
          document in production, so nothing is stranded today either.) */}
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

      {/* Read-only document frame: the whole document as uneditable rich text, from
          the composed merged_body — so it shows the ACTUAL captured signatures and
          dates (not SIG.* placeholders). Used for a review-only party, and for any
          locked/terminated document. */}
      {readOnlyDoc && doc.merged_body && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
          <p className="text-sm text-muted mb-3">
            {iSigned
              ? 'You’ve signed. The contract executes once the other party signs.'
              : state === 'terminated'
                ? 'This contract has been terminated. It is kept on file as a record.'
                : state === 'locked'
                  ? 'The document is final and locked for signing. Review it below, then sign at the bottom of the page.'
                  : 'Review the full document below. It will be locked for signing once both sides are ready. To request a change, use “Suggest a change” on the item or message the other party.'}
          </p>
          <div className="document-paper whitespace-pre-line text-[13.5px] leading-relaxed text-green-950">
            <ContractBody body={doc.merged_body} />
          </div>
        </section>
      )}

      {/* The pre-executed "document preview" (collapsible merged_body) is gone:
          the clause-model authoring surface above IS the full document in context
          — every clause's prose renders with its inputs inline, selected and
          unselected alike.
          TASK ONEAUTHOR: the flat fall-through that used to live here moved UP into
          the one body slot, beside <ClauseDocument>, as <FlatDocument>. Retired
          behind INLINE_BODY_PREVIEW_RETIRED, never deleted. */}
      {!INLINE_BODY_PREVIEW_RETIRED && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
          <button type="button" className="font-serif text-green-800 underline-offset-4 hover:underline"
            onClick={() => setShowBody((v) => !v)}>
            {showBody ? 'Hide' : 'Review'} the document text
          </button>
          {showBody && (
            <div className="document-paper mt-3 whitespace-pre-line text-[13px] leading-relaxed text-green-950">
              <ContractBody body={doc.merged_body} />
            </div>
          )}
        </section>
      )}

      {/* workflow + signing — the primary Send / Lock / Manage actions now live in
          the action deck above the title. This section carries the post-send
          workflow steps (review round-trip, send-to-party) and the signing UI.
          UIO-017, corrected: this comment used to claim the card is "omitted"
          whenever there's nothing to show, checking only the workflow STATE —
          but every child inside is gated on its own finer condition (role,
          docGated, nameGated, iSigned, company-pending, signature count), none
          of which the state check implies. A staff viewer with no party role
          of their own on a `locked` document with zero signatures — exactly
          what the signing freeze produces everywhere — passed the state check
          and got the card with nothing inside it. `hasSignatureCardContent`
          (declared above, next to the state it reads) is the actual
          disjunction of what's inside; ANDed on here so this can only get
          MORE restrictive than the state check alone, never less. */}
      {state !== 'executed' && state !== 'void' && state !== 'terminated'
        && (state === 'in_review' || state === 'locked' || (detail?.signatures.length ?? 0) > 0)
        && hasSignatureCardContent && (
        <section id="contract-signatures" className="bg-white border border-green-800/10 rounded-xl p-6 scroll-mt-16 mt-6">
          {/* DOCUMENT-BEFORE-CONTRACT (2026-07-29): a party with unsatisfied
              onboarding documents cannot sign. This is the FRIENDLY half — the
              authoritative gate is server-side in record_signature(), so a deep
              link here changes nothing. We deliberately keep the contract
              READABLE and show an explanatory next step instead of a bare denial:
              a party who cannot read what they are being asked to sign has no way
              to understand why they are blocked, and the onboarding documents are
              a prerequisite, not a secret. */}
          {state === 'locked' && myRoles.length > 0 && !iSigned && docGated && (
            <div className="border-t border-green-800/10 pt-4">
              <div className="bg-gold-50 border border-gold-600/40 rounded-lg p-4">
                <p className="text-sm text-gold-900 font-medium mb-1">
                  Complete your onboarding documents first
                </p>
                <p className="text-sm text-gold-900/90 mb-3">
                  This agreement relies on the information those documents collect, so
                  they have to be signed before it can be executed. You can read this
                  contract now — signing opens as soon as they're done.
                </p>
                <Link to="/app/onboarding" className="btn-primary text-xs inline-flex">
                  Go to my documents
                </Link>
              </div>
            </div>
          )}

          {/* signing: only once LOCKED (read-only). The document is frozen for
              signature — you sign what you see. */}
          {/* NAME-BEFORE-SIGNATURE (2026-07-30): we hold two different surnames
              for this person and blanked rather than guess. Signing now would
              name the wrong person on a legal document. Shown only when the
              document gate is clear, so the member is asked for one thing at a
              time. The contract stays readable throughout. */}
          {state === 'locked' && myRoles.length > 0 && !iSigned && !docGated && nameGated && (
            <div className="border-t border-green-800/10 pt-4">
              <div className="bg-gold-50 border border-gold-600/40 rounded-lg p-4">
                <p className="text-sm text-gold-900 font-medium mb-1">
                  Confirm your legal name before signing
                </p>
                <p className="text-sm text-gold-900/90 mb-3">
                  We want to be certain this agreement carries your name exactly as it
                  should read. It takes a moment, and you only need to do it once.
                </p>
                <button type="button" className="btn-primary text-xs inline-flex"
                  onClick={() => setNameOpen(true)}>
                  Confirm my name
                </button>
              </div>
            </div>
          )}

          {state === 'locked' && myRoles.length > 0 && !iSigned && !docGated && !nameGated && (
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

          {/* Staff signing ON BEHALF OF THE COMPANY (TASK COSIGN). The company
              contact is faceless — it has no login of its own — so when the
              org's own company is a party, staff complete its signature here.
              record_signature()'s company branch does the same for any staff
              of the org; this only surfaces the affordance for roles that
              branch actually accepts (company_signable_roles), never for an
              individual party staff doesn't represent. */}
          {isOwnerSide && state === 'locked' && companyPendingRoles.length > 0 && (
            <div className="border-t border-green-800/10 pt-4">
              <p className="text-sm text-secondary mb-1">Sign on behalf of the company</p>
              <p className="form-hint mb-3">
                {companyContactName} has no individual signer — as staff, you complete
                its signature here. This seals the signature and is recorded in the audit trail.
              </p>
              <div className="flex flex-col gap-2.5">
                {companyPendingRoles.map((r) => {
                  const rl = r.charAt(0) + r.slice(1).toLowerCase();
                  const name = behalfNames[r] ?? companyContactName;
                  return (
                    <div key={r} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-green-900 w-20 shrink-0">{rl}</span>
                      <input value={name}
                        onChange={(e) => setBehalfNames((m) => ({ ...m, [r]: e.target.value }))}
                        placeholder={`${companyContactName}'s full legal name`}
                        className="px-3 py-2 rounded-lg border border-green-800/15 text-sm focus-ring w-64" />
                      <button type="button" className="btn-primary text-sm" disabled={!name.trim()}
                        onClick={() => void act(
                          async () => { await lockAndSign(id!, r, name.trim()); deliverExecutedCopy(); },
                          `Signed as ${name.trim()}.`)}>
                        <PenLine size={14} /> Sign as {name.trim() || companyContactName}
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

      {/* Notes + Change requests + Change history live in the SUBHEADER above.
          This bottom copy renders only where the subheader does not (a void
          document, or the embedded creation view) — the two are mutually
          exclusive on `showDeck`, so nothing is ever shown twice. */}
      {/* Matches the subheader's condition exactly, so the drawers appear in
          EXACTLY one place: inline here whenever the subheader is absent (an
          executed contract, a void one, or the embedded creation view). */}
      {/* Gated on the SAME per-template configuration as the subheader drawers —
          the two are one surface list rendered in two places, so a document that
          cannot have change requests must not get them here either. */}
      {id && !(showDeck && !isExecuted) && (
        <div className="mt-5 flex flex-col gap-4">
          {templateConfig.show_comments && (
            <div className="rounded-lg border border-green-800/12 bg-white p-4">
              <ContractNotes documentId={id} refreshKey={changeKey} />
            </div>
          )}
          {templateConfig.show_change_requests && (
            <div className="rounded-lg border-l-4 border-gold-400 border-y border-r border-green-800/10 bg-cream-100/30 p-4">
              <ContractChangeRequests
                documentId={id}
                canRequest={editablePhase && !isVoid}
                refreshKey={changeKey}
                onCount={setOpenRequestCount}
                onChanged={() => { void load({ blank: false }); }}
              />
            </div>
          )}
          {templateConfig.show_history && (
            <div className="rounded-lg border-l-4 border-green-700 border-y border-r border-green-800/10 bg-green-50/20 p-4">
              <ContractChangeHistory documentId={id} refreshKey={changeKey} />
            </div>
          )}
        </div>
      )}

      {/* Capture-missing-info modal, opened by the lock-for-signing gate. Writes to
          the central contact, then reloads so the doc + card reflect it. */}
      {captureParty && id && (
        <CaptureInfoModal
          documentId={id}
          party={captureParty}
          onClose={() => setCaptureParty(null)}
          onSaved={() => { setCaptureParty(null); void load({ blank: false }); setChangeKey((k) => k + 1); }}
        />
      )}

      {/* SEND — pick who is notified, or mail yourself the current state.
          The old free-text "notify someone else" field is gone (owner): a review
          request implies a standing in the agreement that a non-party does not
          have. Someone who merely needs to READ it gets the PDF option. */}
      {sendOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4"
          role="dialog" aria-modal="true" aria-labelledby="send-heading"
          onClick={() => setSendOpen(false)}>
          <div className="bg-white rounded-2xl border border-green-800/10 p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}>
            <h2 id="send-heading" className="font-serif text-lg text-green-800 mb-1">Send this contract</h2>
            <p className="text-[13px] text-muted mb-4">
              {state === 'locked'
                ? 'This contract is locked for signing, so notifying a party asks them to sign it. You stay on the contract.'
                : 'Notifying a party asks them to review and sign. You stay on the contract.'}
            </p>
            <div className="flex flex-col gap-2">
              {invitableRoles.length > 1 && (
                <button type="button" className="btn-primary text-sm justify-center"
                  disabled={notifying} onClick={() => void sendReview(invitableRoles)}>
                  Send to both parties
                </button>
              )}
              {invitableRoles.map((r) => (
                <button key={r} type="button"
                  className="btn-secondary text-sm justify-center"
                  disabled={notifying} onClick={() => void sendReview([r])}>
                  Send to {r.charAt(0) + r.slice(1).toLowerCase()} only
                </button>
              ))}
              {/* Separated: this one does not notify anybody. */}
              <div className="border-t border-green-800/10 mt-1 pt-3">
                <button type="button"
                  className="btn-secondary text-sm justify-center w-full"
                  disabled={pdfBusy} onClick={() => void emailWorkingCopy()}>
                  {pdfBusy ? 'Sending…' : 'Send myself a PDF copy'}
                </button>
                <p className="text-[12px] text-muted mt-1.5">
                  A copy of the contract exactly as it stands, including options not
                  yet chosen — useful for an adviser reviewing it with you.
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="button" className="btn-secondary text-sm"
                onClick={() => setSendOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {nameOpen && nameState && (
        <ConfirmNameModal
          state={nameState}
          onConfirmed={() => { setNameOpen(false); reloadName(); }}
          onDismiss={() => setNameOpen(false)}
        />
      )}

      </div>
    </div>
  );
}
