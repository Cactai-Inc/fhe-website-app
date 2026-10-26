import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { ActivateShell } from '../components/app/ActivateShell';
import { ContractBody } from '../components/app/ContractCascade';
import { buildDisclosureEntries, contractViewByToken, type ContractViewByToken, type ContractField } from '../lib/contracts';
import { useDocumentTitle } from '../lib/hooks';
import { toErrorMessage } from '../lib/ops/errors';

/**
 * CONTRACT-FIRST STEPS 2–4 — the anonymous read-only view of a contract, with the
 * activation modal.
 *
 * STEP 2 (read-only view): a party who has no active account is sent a VIEW link
 * (STEP 1), and lands here. `contract_view_by_token` returns ONLY what the
 * instrument prints — the rendered body, the title, the parties' display names, and
 * the boxed disclosure sections through the shared ContractBody/DisclosureEntryBoxes
 * component. Read-only in every sense: no fields, no inputs, no actions, and the
 * personal-information intake is NOT offered here. The function refuses once the
 * governing document executes — then the link is dead for everyone.
 *
 * STEP 3 (activation modal): on first landing AND on every attempt to interact, a
 * modal says an account is needed, with "Do it later" and "Do it now", and suggests
 * a Gmail address for password-free sign-in.
 *
 * STEP 4 ("Do it now"): the modal asks for the email and an Activate button; on
 * success it confirms the email was sent, shows the address, says to check spam if
 * hello@fhequestrian.com is not in the address book, and says to open the email and
 * click the activation link.
 */
export default function ContractView() {
  useDocumentTitle('Your Contract');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [view, setView] = useState<ContractViewByToken | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // STEP 3 — the modal opens on first landing, and again on any interaction attempt.
  const [modalOpen, setModalOpen] = useState(true);

  useEffect(() => {
    if (!token) { setLoadError('This link is missing its token.'); return; }
    let active = true;
    contractViewByToken(token)
      .then((v) => { if (active) setView(v); })
      .catch((err) => { if (active) setLoadError(toErrorMessage(err, 'We could not open this contract.')); });
    return () => { active = false; };
  }, [token]);

  // The boxed disclosure sections, from the document's own stored HORSE.<SECTION>
  // structured values — the same component the authenticated contract renders.
  const disclosureEntries = useMemo(() => {
    const fields = (view?.disclosure_fields ?? []).map(
      (f) => ({ field_key: f.field_key, structured: f.structured } as ContractField),
    );
    return buildDisclosureEntries(fields);
  }, [view?.disclosure_fields]);

  // Any attempt to interact with the body re-opens the modal — selecting text,
  // clicking, a key press. Read-only enforced: there is nothing to interact WITH,
  // but the gesture is what the owner wants the prompt to answer.
  const nudge = useCallback(() => setModalOpen(true), []);

  if (loadError || (view && !view.found)) {
    return (
      <ActivateShell>
        <main className="max-w-2xl mx-auto px-4 sm:px-8 py-16">
          <div className="bg-white border border-green-800/10 p-8" role="alert">
            <p className="flex items-start gap-2.5 text-red-700 font-medium mb-3">
              <AlertTriangle size={20} className="shrink-0 mt-px" aria-hidden="true" />
              <span>This link isn’t valid.</span>
            </p>
            <p className="body-text text-sm">
              {loadError ?? 'We couldn’t find a contract for this link. It may have been replaced by a newer one — check your email for the most recent message from us.'}
            </p>
          </div>
        </main>
      </ActivateShell>
    );
  }

  if (view && view.executed) {
    return (
      <ActivateShell>
        <main className="max-w-2xl mx-auto px-4 sm:px-8 py-16">
          <div className="bg-white border border-green-800/10 p-8" role="status">
            <p className="flex items-start gap-2.5 text-green-800 font-medium mb-3">
              <Lock size={20} className="shrink-0 mt-px" aria-hidden="true" />
              <span>This contract has been signed.</span>
            </p>
            <p className="body-text text-sm">
              It is now complete, so this preview link is closed. If you are a party to it,
              sign in to your account to see the executed copy.
            </p>
          </div>
        </main>
      </ActivateShell>
    );
  }

  if (!view) {
    return (
      <ActivateShell>
        <main className="max-w-2xl mx-auto px-4 sm:px-8 py-16">
          <p className="body-text text-muted">Opening your contract…</p>
        </main>
      </ActivateShell>
    );
  }

  return (
    <ActivateShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <p className="eyebrow mb-2">For your review</p>
        <h1 className="heading-section text-green-800 mb-2">{view.title || 'Your contract'}</h1>
        {view.parties && view.parties.length > 0 && (
          <p className="body-text text-sm text-muted mb-6">
            Between {view.parties.map((p) => p.name).join(' and ')}.
          </p>
        )}

        {/* STEP 2 — read-only body. No onSelectSpan, so ContractBody renders a plain
            fragment with boxed disclosures and no interaction affordance. A pointer
            or key gesture over it re-opens the activation modal (STEP 3). */}
        <section
          className="bg-white border border-green-800/10 p-6 sm:p-8 whitespace-pre-wrap leading-relaxed text-[15px] text-green-950 select-text"
          onMouseDown={nudge}
          onKeyDown={nudge}
          aria-label="Contract preview, read only"
        >
          <ContractBody body={view.body ?? null} disclosureEntries={disclosureEntries} />
        </section>

        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="body-text text-sm text-muted">
            To add your information and sign, you’ll need an account.
          </p>
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            Activate your account
          </button>
        </div>
      </main>

      {modalOpen && (
        <ActivationModal token={token} onClose={() => setModalOpen(false)} />
      )}
    </ActivateShell>
  );
}

/* ── STEP 3 + STEP 4 — the activation modal ─────────────────────────────────── */
type SendStatus = 'sent' | 'send_failed' | 'unavailable';

function ActivationModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ status: SendStatus; email: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/contract-view-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json()) as { status?: SendStatus; email?: string | null };
      setOutcome({ status: body.status ?? 'unavailable', email: body.email ?? null });
    } catch {
      setOutcome({ status: 'unavailable', email: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-green-950/40 px-4"
      role="dialog" aria-modal="true" aria-label="Activate your account"
    >
      <div className="w-full max-w-md bg-white border border-green-800/15 shadow-xl p-7">
        {outcome?.status === 'sent' ? (
          /* STEP 4 — the success state, exactly as specified. */
          <div role="status" aria-live="polite">
            <p className="flex items-start gap-2.5 text-green-800 font-medium mb-3">
              <CheckCircle2 size={20} className="shrink-0 mt-px" aria-hidden="true" />
              <span>Your activation email is on its way{outcome.email ? ` to ${outcome.email}` : ''}.</span>
            </p>
            <p className="body-text text-sm mb-3">
              Open the email, find the message from us, and click the activation link inside —
              it sets up your account and brings you straight to this contract.
            </p>
            <p className="body-text text-sm text-muted mb-6">
              Don’t see it? Check your spam or junk folder. Adding{' '}
              <strong>hello@fhequestrian.com</strong> to your address book keeps the next one
              out of spam.
            </p>
            <button type="button" className="btn-outline-gold w-full justify-center" onClick={onClose}>
              Back to the contract
            </button>
          </div>
        ) : outcome ? (
          <div role="status" aria-live="polite">
            <p className="flex items-start gap-2.5 text-red-700 font-medium mb-3">
              <AlertTriangle size={20} className="shrink-0 mt-px" aria-hidden="true" />
              <span>We couldn’t send your activation email just now.</span>
            </p>
            <p className="body-text text-sm mb-6">
              Nothing was lost. Try again in a moment, or reply to the email that sent you
              this link and we’ll set you up by hand.
            </p>
            <button type="button" className="btn-outline-gold w-full justify-center mb-3" onClick={() => setOutcome(null)}>
              Try again
            </button>
            <button type="button"
              className="w-full text-sm text-green-800 underline hover:text-green-700 focus-ring py-1"
              onClick={onClose}>
              Do it later
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-lg text-green-900 mb-2">You’ll need an account to continue</h2>
            <p className="body-text text-sm mb-4">
              You can read your contract here, but to add your information and sign it you’ll
              need an account. It takes a moment — we email you a link to set it up.
            </p>
            <p className="body-text text-sm text-muted mb-5">
              Tip: a Gmail address lets you sign in without a password.
            </p>
            <form onSubmit={activate}>
              <label className="block mb-4">
                <span className="form-label">Your email address</span>
                <input
                  className="form-input" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </label>
              {error && <p role="alert" className="form-error mb-3">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50 mb-3">
                {busy ? 'Sending…' : 'Activate'}
              </button>
              <button type="button"
                className="w-full text-sm text-green-800 underline hover:text-green-700 focus-ring py-1"
                onClick={onClose}>
                Do it later
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
