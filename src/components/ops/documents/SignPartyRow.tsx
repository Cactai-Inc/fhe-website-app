import { useState } from 'react';
import { AsyncButton, FormField, StatusBadge } from '../../../lib/ops';
import type { Signature } from '../../../lib/ops/types';

/**
 * OPS-DOC-SIGN — one party row inside the staff-facilitated signing panel.
 *
 * A signature roster row is a `Signature` for a single party_role on the
 * document. When `signature.signed_at` is set the row is SEALED (read-only:
 * shows the typed name + a Signed badge). While it is unsigned, staff types the
 * signer's name and clicks Sign, which invokes `onSign(party_role, typed_name)`
 * with THIS row's own party_role.
 *
 * The Sign control is disabled until a non-empty name is typed, so a blank
 * signature is never sealed, and each row's button is bound to its own
 * party_role captured from `signature` — there is no shared-role handler.
 */
export interface SignPartyRowProps {
  signature: Signature;
  /** Seals this party's signature via `record_signature`. Rejections surface inline. */
  onSign: (partyRole: Signature['party_role'], typedName: string) => Promise<unknown>;
}

export function SignPartyRow({ signature, onSign }: SignPartyRowProps) {
  const [typedName, setTypedName] = useState('');
  const sealed = Boolean(signature.signed_at);
  const trimmed = typedName.trim();

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-green-800/15 p-4 sm:flex-row sm:items-end sm:justify-between"
      data-testid={`party-row-${signature.party_role}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-green-900">{signature.party_role}</span>
        {sealed ? (
          <StatusBadge status="Signed" tone="success" />
        ) : (
          <StatusBadge status="Awaiting signature" tone="warning" />
        )}
      </div>

      {sealed ? (
        <p className="text-sm text-green-800/80" data-testid={`signed-name-${signature.party_role}`}>
          Signed by <span className="font-medium">{signature.typed_name}</span>
        </p>
      ) : (
        <div className="flex items-end gap-3">
          <div className="w-64 max-w-full">
            <FormField label={`Signer name — ${signature.party_role}`}>
              {({ id, errorClass }) => (
                <input
                  id={id}
                  className={`form-input ${errorClass}`}
                  value={typedName}
                  autoComplete="off"
                  aria-label={`Signer name for ${signature.party_role}`}
                  onChange={(e) => setTypedName(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="mb-4">
            <AsyncButton
              className="btn-primary"
              disabled={!trimmed}
              pendingLabel="Signing…"
              aria-label={`Sign as ${signature.party_role}`}
              onClick={() => onSign(signature.party_role, trimmed)}
            >
              Sign
            </AsyncButton>
          </div>
        </div>
      )}
    </div>
  );
}
