import { useCallback, useEffect, useState } from 'react';
import {
  recordSignature as apiRecordSignature,
  listSignatures as apiListSignatures,
} from '../../../lib/api';
import type { Signature } from '../../../lib/ops/types';
import { EmptyState, StatusBadge } from '../../../lib/ops';
import { SignPartyRow } from './SignPartyRow';

/**
 * OPS-DOC-SIGN — Multi-party staff-facilitated signing panel.
 *
 * Flow: on the document viewer, staff facilitates assisted signing. The panel
 * loads the signature roster (`listSignatures(documentId)`) — one row per party
 * role, each either sealed (`signed_at` set) or awaiting. For every unsigned
 * party, staff types the signer's name and clicks Sign, which calls
 * `recordSignature(documentId, party_role, typed_name)` → `record_signature`
 * RPC. That seals the (document, party) signature and, once every required
 * signer party has signed, flips `documents.status` to EXECUTED server-side.
 *
 * After each successful sign the roster is refreshed via `listSignatures` so the
 * just-signed row re-renders sealed. When every roster party is sealed the panel
 * renders the EXECUTED banner (and calls `onExecuted`). A rejected sign is NOT
 * swallowed: the row's inline error renders and the row stays unsigned because
 * the roster is only refreshed on success.
 *
 * `recordSignature`/`listSignatures` are injectable (default to the real api
 * fns) so the wiring can be proven against a mocked data seam.
 */
export interface SigningPanelProps {
  documentId: string;
  /** Seals a party's typed signature. Defaults to the real `record_signature` wrapper. */
  recordSignature?: (
    documentId: string,
    partyRole: Signature['party_role'],
    typedName: string,
  ) => Promise<unknown>;
  /** Loads the signature roster. Defaults to the real `listSignatures` wrapper. */
  listSignatures?: (documentId: string) => Promise<Signature[]>;
  /** Fired once the last required party signs and the document is EXECUTED. */
  onExecuted?: () => void;
}

function allSigned(roster: Signature[]): boolean {
  return roster.length > 0 && roster.every((s) => Boolean(s.signed_at));
}

export function SigningPanel({
  documentId,
  recordSignature = apiRecordSignature,
  listSignatures = apiListSignatures,
  onExecuted,
}: SigningPanelProps) {
  const [roster, setRoster] = useState<Signature[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [executed, setExecuted] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listSignatures(documentId);
    setRoster(rows);
    if (allSigned(rows)) {
      setExecuted(true);
      onExecuted?.();
    }
    return rows;
  }, [documentId, listSignatures, onExecuted]);

  // Initial roster load.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    listSignatures(documentId)
      .then((rows) => {
        if (cancelled) return;
        setRoster(rows);
        if (allSigned(rows)) {
          setExecuted(true);
          onExecuted?.();
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
    // onExecuted intentionally excluded: fire-once semantics on the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, listSignatures]);

  /**
   * Seal one party, then refresh the roster. RE-THROWS on failure so the row's
   * AsyncButton renders the inline error and the row stays unsigned (no refresh
   * happens, so no false "signed" state).
   */
  const handleSign = useCallback(
    async (partyRole: Signature['party_role'], typedName: string) => {
      await recordSignature(documentId, partyRole, typedName);
      await refresh();
    },
    [documentId, recordSignature, refresh],
  );

  if (loadError) {
    return (
      <div data-testid="signing-panel-error">
        <EmptyState
          title="Could not load signature roster"
          message={loadError.message}
        />
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="py-8 text-center text-sm text-green-800/70" data-testid="signing-panel-loading">
        Loading signature roster…
      </div>
    );
  }

  return (
    <section aria-labelledby="signing-heading" className="space-y-4" data-testid="signing-panel">
      <div className="flex items-center justify-between gap-4">
        <h2 id="signing-heading" className="font-serif text-lg text-green-900">
          Assisted signing
        </h2>
        {executed && <StatusBadge status="EXECUTED" tone="success" />}
      </div>

      {executed && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          data-testid="executed-banner"
        >
          All required parties have signed — this document is fully executed.
        </div>
      )}

      {roster.length === 0 ? (
        <EmptyState
          title="No signature parties"
          message="This document has no signer roster to facilitate."
        />
      ) : (
        <div className="space-y-3">
          {roster.map((signature) => (
            <SignPartyRow key={signature.id} signature={signature} onSign={handleSign} />
          ))}
        </div>
      )}
    </section>
  );
}
