import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Check } from 'lucide-react';
import { fetchMyDocuments } from '../../lib/api';
import {
  listMySignableDocuments,
  signMyDocument,
  type SignableDocument,
} from '../../lib/ops/api-client';
import { useDocumentTitle } from '../../lib/hooks';
import type { OrderDocument } from '../../lib/types';

const DOC_TITLE: Record<string, string> = {
  liability_waiver: 'Liability Waiver & Release',
  lesson_policy: 'Lesson & Cancellation Policy',
  training_agreement: 'Training Services Agreement',
  care_agreement: 'Horse Care Services Agreement',
  brokering_agreement: 'Brokering Engagement Agreement',
};
const titleFor = (t: string) => DOC_TITLE[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * MEMBER self-sign row (mirrors the staff SigningPanel's SignPartyRow, but
 * client-facing): the member types THEIR name and signs THEIR OWN party role.
 * The `record_signature` RPC (20260702000000) verifies server-side that the
 * caller's contact IS the party — the UI never chooses whose signature to seal.
 * A rejected sign renders inline and the row stays unsigned (refresh happens
 * only on success).
 */
function SelfSignRow({
  item,
  onSign,
}: {
  item: SignableDocument;
  onSign: (item: SignableDocument, typedName: string) => Promise<void>;
}) {
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-white border border-green-800/10 p-5" data-testid={`self-sign-${doc.id}`}>
      <div className="flex items-start gap-3">
        <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-sans font-medium text-green-900">{doc.title ?? doc.display_code ?? 'Contract'}</p>
          <p className="text-xs text-muted mt-1">You sign as {party_role.replace(/_/g, ' ').toLowerCase()}.</p>

          {signed ? (
            <p className="text-xs text-green-700 mt-2 inline-flex items-center gap-1">
              <Check size={12} aria-hidden="true" /> You've signed this document.
            </p>
          ) : isContractDoc ? (
            <Link to={`/app/contracts/${doc.id}`}
              className="btn-outline-gold inline-flex items-center mt-3 text-sm">
              Open to review &amp; sign →
            </Link>
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

export default function Documents() {
  useDocumentTitle('Your Documents');
  const [docs, setDocs] = useState<(OrderDocument & { order_created_at?: string })[]>([]);
  const [signables, setSignables] = useState<SignableDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchMyDocuments().catch(() => [] as (OrderDocument & { order_created_at?: string })[]),
      listMySignableDocuments().catch(() => [] as SignableDocument[]),
    ])
      .then(([d, s]) => {
        if (!active) return;
        setDocs(d);
        setSignables(s);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  /** Seal, then refresh the signable list so the row re-renders sealed. */
  const handleSign = useCallback(async (item: SignableDocument, typedName: string) => {
    await signMyDocument(item.document.id, item.party_role, typedName);
    setSignables(await listMySignableDocuments());
  }, []);

  const awaiting = signables.filter((s) => !s.signed);
  const sealed = signables.filter((s) => s.signed);

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Your documents</p>
      <h1 className="heading-section text-green-800 mb-8">Everything you've agreed to.</h1>

      {!loading && signables.length > 0 && (
        <section aria-labelledby="self-sign-heading" className="mb-10" data-testid="self-sign-section">
          <h2 id="self-sign-heading" className="font-serif text-lg text-green-900 mb-3">
            {awaiting.length > 0 ? 'Contracts awaiting your signature' : 'Contracts you’ve signed'}
          </h2>
          <div className="flex flex-col gap-3">
            {[...awaiting, ...sealed].map((item) => (
              <SelfSignRow key={item.document.id} item={item} onSign={handleSign} />
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="body-text text-muted text-sm">No documents yet. They'll appear here as you complete orders.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((d) => (
            <div key={d.id} className="bg-white border border-green-800/10 p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">{titleFor(d.document_type)}</p>
                  {d.agreed_at ? (
                    <p className="text-xs text-green-700 mt-1 inline-flex items-center gap-1">
                      <Check size={12} aria-hidden="true" />
                      Agreed by {d.signer_name} · {new Date(d.agreed_at).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted mt-1">Not yet agreed</p>
                  )}
                </div>
              </div>
              <Link to={`/order/${d.order_id}`} className="link-underline whitespace-nowrap">View order</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
