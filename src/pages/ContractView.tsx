import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ActivateShell } from '../components/app/ActivateShell';
import { ContractBody } from '../components/app/ContractCascade';
import { buildDisclosureEntries, contractViewByToken, type ContractViewByToken, type ContractField } from '../lib/contracts';
import { useDocumentTitle } from '../lib/hooks';
import { toErrorMessage } from '../lib/ops/errors';

/**
 * CONTRACT REVIEW VIEW — the read-only copy a staff member shares for REVIEW
 * (fix round 3, item 5). It is NOT an invite path: there is no activation modal,
 * no inputs, no prompts, no account language.
 *
 * `contract_view_by_token` returns ONLY what the instrument prints — the rendered
 * body, the title, the parties' display names, and the boxed disclosure sections
 * through the shared ContractBody/DisclosureEntryBoxes component. The link stays
 * valid until a staff member revokes it; it is not killed by the contract
 * executing. A revoked token returns `found:false` and the page says the link is
 * no longer valid.
 */
export default function ContractView() {
  useDocumentTitle('Contract — for review');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [view, setView] = useState<ContractViewByToken | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
              {loadError ?? 'This review link has been revoked or replaced. If you still need to see the contract, ask the sender for a new link.'}
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
          <p className="body-text text-muted">Opening the contract…</p>
        </main>
      </ActivateShell>
    );
  }

  return (
    <ActivateShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <p className="eyebrow mb-2">For your review</p>
        <h1 className="heading-section text-green-800 mb-2">{view.title || 'Contract'}</h1>
        {view.parties && view.parties.length > 0 && (
          <p className="body-text text-sm text-muted mb-6">
            Between {view.parties.map((p) => p.name).join(' and ')}.
          </p>
        )}

        {/* Read-only body with boxed disclosures and nothing else — no inputs, no
            prompts, no account language. */}
        <section
          className="bg-white border border-green-800/10 p-6 sm:p-8 whitespace-pre-wrap leading-relaxed text-[15px] text-green-950 select-text"
          aria-label="Contract, read only"
        >
          <ContractBody body={view.body ?? null} disclosureEntries={disclosureEntries} />
        </section>
      </main>
    </ActivateShell>
  );
}
