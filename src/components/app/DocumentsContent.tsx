import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fromHere } from '../../lib/linkOrigin';
import {
  FileText, Check, Download, History, Mail, BookOpen, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { myDocuments, emailMyDocumentCopy, type MyDocumentRow } from '../../lib/api';
import {
  listMySignableDocuments,
  signMyDocument,
  type SignableDocument,
} from '../../lib/ops/api-client';
import { toErrorMessage } from '../../lib/ops/errors';
import type { SeedDocument } from '../../lib/seed';

/**
 * MY DOCUMENTS — the shared subject content (TASK-ACCOUNTSURFACE §3), rendered
 * by both /app/documents and the Account page's inline panel.
 *
 * Phase 1 found the old DocumentsPanel (AccountPanels.tsx) was not a duplicate
 * of the old Documents.tsx but a WEAKER one — no signing, no email-a-copy, no
 * assigned-but-ungenerated documents, no supersede badge. Per the owner's
 * ruling, the fuller behaviour wins: this file IS the old Documents.tsx body
 * (self-sign, email-a-copy, the two-source pending/assigned/executed list),
 * moved here unchanged. The one thing the OLD panel had that the OLD page
 * didn't — reading a document's full merged text as paginated "paper", via
 * PaperViewer — is folded back in (the `onView`/`viewing` plumbing and the
 * PaperViewer component below, both carried over from AccountPanels.tsx
 * unchanged) so neither surface loses anything either direction.
 */

/**
 * ── FIX1 §D — THE INLINE SIGNING BOX IS RETIRED. THE PAGE IS NOT. ───────────
 *
 * Source of truth: docs/reports/TASK-AR7-REPORT.md §3, §9 and R9.
 *
 * ⚠️ AR7 EXONERATED THIS FILE. The premise that /app/documents was a second
 * onboarding corridor is WRONG: all 49 contact_required_documents rows in
 * production are AT_LOGIN, so while anyone owes paperwork the wall makes
 * /app/onboarding the only reachable route in the whole app and this page cannot
 * be reached at all. Its name box has never signed anything, and it did not sign
 * the four documents in the 2026-08-28 incident — those were signed inside the
 * corridor, through Onboarding.tsx, which showed a name and gated on it.
 *
 * So this is not a fix for the incident. It is the removal of a live hazard: an
 * unchecked, unlabelled name box that becomes reachable for the first WHEN_READY
 * assignment, and that manufactures an e-sign consent record for a checkbox the
 * member was never shown (AR7 F6). One place a member signs, and it is the
 * corridor.
 *
 * ⚠️ D32 — FLAGGED, NEVER DELETED. The flag is here, the component below it is
 * intact, and flipping this to `true` restores today's behaviour exactly.
 *
 * ⚠️ AND THE PAGE STAYS. Reading the full paginated body, downloading the signed
 * PDF, emailing yourself a copy and the contract deep-link exist ONLY here —
 * Onboarding.tsx has none of the four. Retiring the page would be a regression;
 * retiring the box is not. Carrying the reader and the PDF into the corridor is
 * AR7 R10 and is not in this task's scope.
 */
const MEMBER_INLINE_SIGN_ENABLED = false;

/** Splits a document's merged body into readable "paper" pages. Lifted
 *  unchanged from the old DocumentsPanel, which computed this eagerly for
 *  every row; here it's computed once, when a document is opened to read. */
function paginateBody(body: string): string[] {
  const paras = body.split(/\n\n+/);
  const pages: string[] = [];
  let cur = '';
  for (const para of paras) {
    if (cur && (cur.length + para.length) > 2400) { pages.push(cur); cur = para; }
    else cur = cur ? cur + '\n\n' + para : para;
  }
  if (cur) pages.push(cur);
  return pages.length ? pages : [body];
}

/**
 * H4/A8B — Send/Resend a copy of an executed document to the caller.
 *
 * Calls the authenticated self-send endpoint (/api/deliver-my-document), which
 * mails ONLY the caller's own copy to their own account address. Renders beside
 * the signed-PDF download and appears on executed documents only.
 *
 * Label reflects `executed_email_sent_at` — the DB-driven all-parties send
 * stamp (documents_send_executed_email_trg), NOT this button's own click
 * history: "Send me a copy" while that stamp is unset, "Resend me a copy"
 * once it is.
 *
 * States are explicit and never optimistic: the button disables while the
 * request is in flight, and success/failure render inline only AFTER the server
 * answers. A failed send says so — it is never reported as sent.
 */
function EmailMeACopyButton({ documentId, sentAt }: { documentId: string; sentAt?: string | null }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const label = sentAt ? 'Resend a copy to me' : 'Send a copy to me';

  const send = async () => {
    setState('sending');
    setMessage(null);
    try {
      const { email } = await emailMyDocumentCopy(documentId);
      // Success is only ever set from the server's answer.
      setState('sent');
      setMessage(email ? `Sent to ${email}` : 'Sent.');
    } catch (err) {
      setState('error');
      setMessage(toErrorMessage(err));
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={state === 'sending'}
        onClick={send}
        data-testid={`email-copy-${documentId}`}
      >
        <Mail size={13} aria-hidden="true" />
        {state === 'sending' ? 'Sending…' : label}
      </button>
      {message && (
        <p
          role={state === 'error' ? 'alert' : 'status'}
          className={`text-xs ${state === 'error' ? 'text-red-700' : 'text-green-700'}`}
        >
          {state === 'error' ? `Could not send: ${message}` : message}
        </p>
      )}
    </>
  );
}

/** The document rendered as PAPER: a page with drop shadow, subtle edges, and page
 *  breaks. Slightly narrower than the sheet so scrolling reads as moving down a
 *  document. Overlay so it feels like opening the physical document. Carried over
 *  unchanged from the old DocumentsPanel/AccountPanels.tsx. */
function PaperViewer({ doc, onClose }: { doc: SeedDocument; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const total = doc.pages.length;
  return (
    <div className="fixed inset-0 bg-green-950/50 backdrop-blur-[2px] z-[70] flex flex-col" onClick={onClose}>
      {/* top bar */}
      <div className="flex items-center justify-between px-4 h-14 bg-white/95 border-b border-green-800/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-serif text-green-800 text-[15px] font-semibold truncate">{doc.title}</p>
          <p className="text-[11px] text-muted">{doc.signedOn}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={async () => {
              const text = doc.body ?? doc.pages.join('\n\n');
              const { downloadDocumentPdf } = await import('../../lib/documentPdf');
              await downloadDocumentPdf(doc.title, text);
            }}
            className="inline-flex items-center gap-1.5 text-[12px] text-green-800 hover:text-green-700 px-2.5 py-1.5 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring"
          >
            <Download size={14} /> PDF
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-secondary hover:text-green-800 p-2 -mr-2"><X size={20} /></button>
        </div>
      </div>

      {/* paper scroll region */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:py-8" onClick={(e) => e.stopPropagation()}>
        <div className="max-w-[640px] mx-auto">
          {/* the sheet */}
          <div className="bg-white shadow-2xl shadow-green-950/30 rounded-[3px] mx-auto"
            style={{ width: 'min(100%, 600px)' }}>
            <div className="px-8 sm:px-12 py-10 sm:py-14">
              <p className="whitespace-pre-line font-serif text-[14.5px] leading-[1.85] text-green-950">
                {doc.pages[page]}
              </p>
            </div>
            {/* page-edge foot */}
            <div className="border-t border-dashed border-green-800/15 px-8 sm:px-12 py-3 flex items-center justify-between">
              <span className="text-[10px] tracking-wide uppercase text-muted">French Heritage Equestrian</span>
              <span className="text-[10px] text-muted">Page {page + 1} of {total}</span>
            </div>
          </div>

          {/* pager */}
          {total > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/90 border border-green-800/15 text-[12px] text-secondary disabled:opacity-40 focus-ring">
                <ChevronLeft size={15} /> Prev
              </button>
              <div className="flex gap-1.5">
                {doc.pages.map((_, i) => (
                  <button key={i} type="button" onClick={() => setPage(i)}
                    className={`h-1.5 rounded-full transition-all ${i === page ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} aria-label={`Page ${i + 1}`} />
                ))}
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(total - 1, p + 1))} disabled={page === total - 1}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/90 border border-green-800/15 text-[12px] text-secondary disabled:opacity-40 focus-ring">
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small "Read" trigger — opens the merged body in PaperViewer. Only rendered
 *  where a body actually exists (signed rows, and executed rows that have a
 *  matching SignableDocument with a merged_body); template-only/pending rows
 *  have nothing to read yet. */
function ReadButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}
      className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring">
      <BookOpen size={13} aria-hidden="true" /> Read
    </button>
  );
}

/**
 * MEMBER document row.
 *
 * It USED to be the self-sign row: the member typed their name and signed their
 * own party role here. Behind MEMBER_INLINE_SIGN_ENABLED (see the flag at the
 * top of this file) that box no longer renders and every unsigned row deep-links
 * into the corridor instead. The signing branch below is kept whole, not
 * deleted, per D32 — one constant restores it.
 *
 * What the row still does, and what nothing else does: read the full merged text
 * as paginated paper, download the executed PDF, and email yourself a copy.
 *
 * The `record_signature` RPC verifies server-side that the caller's contact IS
 * the party — the UI never chooses whose signature to seal — and since FIX1 §C
 * (20260831T0900) it also checks the typed name against the signer's own contact
 * record. A rejected sign renders inline and the row stays unsigned.
 */
function SelfSignRow({
  item,
  onSign,
  onView,
}: {
  item: SignableDocument;
  onSign: (item: SignableDocument, typedName: string) => Promise<void>;
  onView: (doc: SeedDocument) => void;
}) {
  const location = useLocation();
  const [typedName, setTypedName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = typedName.trim();
  const { document: doc, party_role, signed } = item;
  const inputId = `sign-name-${doc.id}`;
  // Contract-workflow documents (contract_id set) are reviewed + signed on the
  // full contract surface, which uses the contract-aware seal. Only release /
  // waiver docs sign inline here. This keeps one signing entry point per contract
  // (audit M-7) — the list deep-links contracts to /app/contracts/:id.
  const isContractDoc = !!doc.contract_id;

  const sign = async () => {
    setPending(true);
    setError(null);
    try {
      await onSign(item, trimmed);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const openReader = () => {
    if (!doc.merged_body) return;
    onView({
      id: doc.id,
      title: doc.title ?? doc.display_code ?? 'Document',
      signedOn: signed ? 'Signed' : 'Awaiting signature',
      kind: doc.status ?? '',
      pages: paginateBody(doc.merged_body),
      body: doc.merged_body,
    });
  };

  return (
    <div className="bg-white border border-green-800/10 p-5" data-testid={`self-sign-${doc.id}`}>
      <div className="flex items-start gap-3">
        <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-sans font-medium text-green-900">{doc.title ?? doc.display_code ?? 'Contract'}</p>
          <p className="text-xs text-muted mt-1">You sign as {party_role.replace(/_/g, ' ').toLowerCase()}.</p>

          {signed ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-xs text-green-700 inline-flex items-center gap-1">
                <Check size={12} aria-hidden="true" /> You've signed this document.
              </p>
              {/* Read the full merged text, paginated as paper (folded back in
                  from the old DocumentsPanel — see file header). */}
              {doc.merged_body && <ReadButton onOpen={openReader} />}
              {/* Fully-executed docs can be downloaded as a signed PDF, rendered
                  from the document's merged_body (same renderer used elsewhere). */}
              {doc.status === 'EXECUTED' && doc.merged_body && (
                <button type="button"
                  className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring"
                  onClick={async () => {
                    const { downloadDocumentPdf } = await import('../../lib/documentPdf');
                    await downloadDocumentPdf(doc.title ?? 'Document', doc.merged_body ?? '');
                  }}>
                  <Download size={13} aria-hidden="true" /> Download signed PDF
                </button>
              )}
              {/* H4: executed documents can also be re-sent to the member's own
                  account email (authenticated party-scoped self-send). */}
              {doc.status === 'EXECUTED' && (
                <EmailMeACopyButton documentId={doc.id} sentAt={doc.executed_email_sent_at} />
              )}
            </div>
          ) : isContractDoc ? (
            /* FIX1 §D — /start, not the bare document. AR7 §9: the two surfaces
               deep-linked differently and Onboarding's is the better of the two,
               because /start asks for missing party fields BEFORE the contract
               rather than presenting a document with holes in it. Converge on it. */
            <Link to={`/app/contracts/${doc.id}/start`} state={fromHere(location)}
              className="btn-outline-gold inline-flex items-center mt-3 text-sm">
              Open to review &amp; sign →
            </Link>
          ) : !MEMBER_INLINE_SIGN_ENABLED ? (
            /* FIX1 §D — the retired box's replacement. An unsigned non-contract
               document is onboarding paperwork, and the corridor is where it gets
               signed: it shows the member the name they must type, captures real
               e-sign consent against a real checkbox, and sequences the set by
               onboarding_order. This row keeps the reader, so nothing is lost —
               the member can still READ what they are being asked to sign from
               here, they simply sign it in one place. */
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link to="/app/onboarding" state={fromHere(location)}
                className="btn-outline-gold inline-flex items-center text-sm">
                Open to review &amp; sign →
              </Link>
              {doc.merged_body && <ReadButton onOpen={openReader} />}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={inputId} className="block text-xs text-muted mb-1">
                  Type your full legal name to sign
                </label>
                <input
                  id={inputId}
                  className="border border-green-800/20 px-3 py-2 text-sm w-64 max-w-full focus-ring"
                  value={typedName}
                  autoComplete="off"
                  onChange={(e) => setTypedName(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-outline-gold"
                disabled={!trimmed || pending}
                onClick={sign}
              >
                {pending ? 'Signing…' : 'Sign'}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-700 mt-2">
              Could not sign: {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const errText = (e: unknown) => toErrorMessage(e);

export function DocumentsContent() {
  const [rows, setRows] = useState<MyDocumentRow[]>([]);
  const [signables, setSignables] = useState<SignableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<SeedDocument | null>(null);
  // WALLSYNC: both loads used to `.catch(() => [])`, so a failed read rendered as
  // "No documents yet" — indistinguishable from genuinely having none. That is how
  // this page got mis-diagnosed as a data problem during the signing-wall outage.
  // A failure must now say so, and stay retryable.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    // allSettled, not all: one failing source must not blank the other, but it
    // must still be reported rather than swallowed.
    Promise.allSettled([myDocuments(), listMySignableDocuments()])
      .then(([d, s]) => {
        if (!active) return;
        const errs: string[] = [];
        if (d.status === 'fulfilled') setRows(d.value); else errs.push(errText(d.reason));
        if (s.status === 'fulfilled') setSignables(s.value); else errs.push(errText(s.reason));
        setLoadError(errs.length > 0 ? errs.join(' · ') : null);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reload]);

  /** Seal, then refresh both lists so the rows re-render sealed. E-sign
   *  consent is passed true — same contract as the onboarding flow.
   *  The signing call itself is NOT caught here: SelfSignRow reports it. The
   *  refresh is reported separately so a successful signature is never shown as
   *  a failed one, nor a failed refresh as stale-but-fine. */
  const handleSign = useCallback(async (item: SignableDocument, typedName: string) => {
    await signMyDocument(item.document.id, item.party_role, typedName, true);
    const [d, s] = await Promise.allSettled([myDocuments(), listMySignableDocuments()]);
    const errs: string[] = [];
    if (d.status === 'fulfilled') setRows(d.value); else errs.push(errText(d.reason));
    if (s.status === 'fulfilled') setSignables(s.value); else errs.push(errText(s.reason));
    setLoadError(errs.length > 0
      ? `Your signature was saved, but this list could not be refreshed: ${errs.join(' · ')}`
      : null);
  }, []);

  const awaiting = signables.filter((s) => !s.signed);
  const sealed = signables.filter((s) => s.signed);
  // The one chronological list (3f): pending/assigned first, then executed in
  // signing order — newest first, matching the page's read order.
  const pendingRows = rows.filter((r) => r.kind !== 'executed');
  const executedRows = rows
    .filter((r) => r.kind === 'executed')
    .sort((a, b) => (b.signed_at ?? '').localeCompare(a.signed_at ?? ''));

  // Executed/pending rows come from `myDocuments()`, which has no body text.
  // Signable rows do carry the merged body — match on document id so the
  // chronological list can also offer "Read", not only the self-sign section.
  const signableById = new Map(signables.map((s) => [s.document.id, s.document] as const));

  return (
    <div className="mt-2.5 mb-1">
      {loadError && (
        <div role="alert" className="mb-6 border border-red-700/40 bg-red-50 p-4">
          <p className="text-sm font-sans font-medium text-red-800">
            Your documents could not be loaded.
          </p>
          <p className="text-xs text-red-700 mt-1 break-words">{loadError}</p>
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            onClick={() => { setLoading(true); setReload((n) => n + 1); }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && signables.length > 0 && (
        <section aria-labelledby="self-sign-heading" className="mb-10" data-testid="self-sign-section">
          <h2 id="self-sign-heading" className="font-serif text-lg text-green-900 mb-3">
            {awaiting.length > 0 ? 'Contracts awaiting your signature' : 'Contracts you’ve signed'}
          </h2>
          <div className="flex flex-col gap-3">
            {[...awaiting, ...sealed].map((item) => (
              <SelfSignRow key={item.document.id} item={item} onSign={handleSign} onView={setViewing} />
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : pendingRows.length === 0 && executedRows.length === 0 ? (
        // Never claim "no documents" when the read failed — that is the exact
        // false negative this task was reported as.
        signables.length === 0 && !loadError && (
          <p className="body-text text-muted text-sm">No documents yet. They'll appear here as they're assigned or signed.</p>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {pendingRows.map((r) => (
            <div key={r.document_id ?? r.template_key} className="bg-white border border-gold-600/30 p-5 flex items-start gap-3">
              <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-sans font-medium text-green-900">{r.title}</p>
                <p className="text-xs text-gold-900 mt-1">Awaiting your signature — you'll be prompted at sign-in.</p>
              </div>
            </div>
          ))}
          {executedRows.map((r) => {
            const matched = r.document_id ? signableById.get(r.document_id) : undefined;
            return (
              <div key={r.document_id ?? r.template_key} className="bg-white border border-green-800/10 p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-sans font-medium text-green-900">{r.title}</p>
                    <p className="text-xs text-green-700 mt-1 inline-flex items-center gap-1">
                      <Check size={12} aria-hidden="true" />
                      Signed{r.signed_at ? ` · ${new Date(r.signed_at).toLocaleDateString()}` : ''}
                    </p>
                    {r.superseded && (
                      <p className="text-xs text-muted mt-1 inline-flex items-center gap-1">
                        <History size={12} aria-hidden="true" />
                        Superseded — kept as a record; a newer version is in force.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {matched?.merged_body && (
                        <ReadButton onOpen={() => setViewing({
                          id: matched.id,
                          title: r.title,
                          signedOn: r.signed_at ? `Signed ${new Date(r.signed_at).toLocaleDateString()}` : 'Signed',
                          kind: r.current_status ?? '',
                          pages: paginateBody(matched.merged_body as string),
                          body: matched.merged_body as string,
                        })} />
                      )}
                      {/* H4: the member can re-send their own copy. Requires a real
                          document row — template-only entries have no document to send. */}
                      {r.document_id && (
                        <EmailMeACopyButton documentId={r.document_id} sentAt={r.executed_email_sent_at} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && <PaperViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
