/**
 * PARTY CONTROLS CARD — the single source of truth for the per-party document
 * controls. Used by both the creation page (NewContractPage) and the live
 * contract surface (ContractPage).
 *
 * THE LOCK MODEL (owner): a contract is fully editable by both parties by
 * default. The control does not grant abilities — it RESTRICTS them. Each party
 * sits at one of three access levels:
 *
 *   • Full access        — edit deal terms, propose changes, add items, comment.
 *                          The subheader shows Add + Comments + Requests.
 *   • Suggestions only   — no direct edits or additions; propose changes for the
 *                          other party to accept, plus comments. Shows Comments +
 *                          Requests (no Add).
 *   • Read only          — comments only; no edits, additions, or proposals.
 *                          Shows Comments.
 *
 * These map onto the engine booleans (can_edit_deal / can_suggest /
 * can_add_clause), which the server enforces. can_fill stays true throughout:
 * a party may always complete the fields their own side owns. Track-changes and
 * comments are always-on baseline rights, never gated here.
 */

export interface PartyControlValues {
  can_fill: boolean;
  can_edit_deal: boolean;
  can_suggest: boolean;
  can_add_clause: boolean;
}

export const DEFAULT_PARTY_CONTROLS: PartyControlValues = {
  can_fill: true, can_edit_deal: true, can_suggest: true, can_add_clause: true,
};

export function roleLabel(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

export type AccessLevel = 'full' | 'suggest' | 'readonly';

const LEVELS: { key: AccessLevel; label: string; hint: string }[] = [
  { key: 'full',     label: 'Full access',       hint: 'Edit terms, propose changes, add items, and comment.' },
  { key: 'suggest',  label: 'Suggestions only',  hint: 'Propose changes for the other party to accept, plus comments — no direct edits.' },
  { key: 'readonly', label: 'Read only',         hint: 'Comments only — no edits, additions, or proposals.' },
];

/** Derive the access level from the engine booleans. */
export function levelOf(v: PartyControlValues): AccessLevel {
  if (v.can_edit_deal) return 'full';
  if (v.can_suggest || v.can_add_clause) return 'suggest';
  return 'readonly';
}

/** Expand an access level back into the engine booleans (can_fill is preserved). */
export function controlsForLevel(level: AccessLevel, can_fill = true): PartyControlValues {
  switch (level) {
    case 'full':     return { can_fill, can_edit_deal: true,  can_suggest: true,  can_add_clause: true };
    case 'suggest':  return { can_fill, can_edit_deal: false, can_suggest: true,  can_add_clause: true };
    case 'readonly': return { can_fill, can_edit_deal: false, can_suggest: false, can_add_clause: false };
  }
}

export function PartyControlsCard({
  role, value, onChange, disabled = false, lastDealEditor = false,
  onBlocked,
}: {
  role: string;
  value: PartyControlValues;
  onChange: (v: PartyControlValues) => void;
  disabled?: boolean;
  /** TRUE when this party is the ONLY one who can edit deal terms. Dropping them
   *  below Full access would leave nobody able to change a term, so the server
   *  refuses it and this card explains why. */
  lastDealEditor?: boolean;
  /** Called when the owner tries something the rules forbid, so the page can say
   *  so where they are looking. */
  onBlocked?: (message: string) => void;
}) {
  const current = levelOf(value);
  return (
    <div className="border border-green-800/10 rounded-lg p-3.5">
      <p className="text-sm font-medium text-green-900 mb-2">{roleLabel(role)}</p>
      <div className="flex flex-col gap-2">
        {LEVELS.map((lvl) => {
          const selected = current === lvl.key;
          // Leaving Full access while this party is the last deal editor is
          // refused (server enforces it too): one party must always be able to
          // edit. The radio stays clickable, refuses, and says why.
          const wouldOrphan = lvl.key !== 'full' && lastDealEditor && current === 'full';
          return (
            <label key={lvl.key} className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" name={`access-${role}`} className="accent-green-700 mt-0.5 shrink-0"
                checked={selected} disabled={disabled}
                onChange={() => {
                  if (selected) return;
                  if (wouldOrphan) {
                    onBlocked?.('Give the other party Full access first — '
                      + 'one party must always be able to edit.');
                    return;
                  }
                  onChange(controlsForLevel(lvl.key, value.can_fill));
                }} />
              <span className="min-w-0">
                <span className="text-[13px] text-green-900">{lvl.label}</span>
                <span className="block text-[11px] text-muted">{lvl.hint}</span>
                {wouldOrphan && selected === false && lvl.key !== 'full' && (
                  <span className="block text-[11px] text-amber-700">
                    Give the other party Full access first.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default PartyControlsCard;
