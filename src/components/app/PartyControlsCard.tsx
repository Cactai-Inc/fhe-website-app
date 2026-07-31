/**
 * PARTY CONTROLS CARD — the single source of truth for the per-party document
 * controls (can_fill / can_edit_deal / can_suggest / can_add_clause). Used by
 * both the creation page (NewContractPage) and the live contract surface
 * (ContractPage), replacing the two divergent copies that existed before
 * (audit m-6).
 *
 * Note: track-changes and comments are always-on and are NOT gated by these
 * controls — these govern who may FILL fields, EDIT deal terms, and PROPOSE
 * redline edits/clauses. Comments/visibility of changes are a baseline right of
 * every party.
 */

export interface PartyControlValues {
  can_fill: boolean;
  can_edit_deal: boolean;
  can_suggest: boolean;
  can_add_clause: boolean;
}

export const DEFAULT_PARTY_CONTROLS: PartyControlValues = {
  can_fill: true, can_edit_deal: false, can_suggest: false, can_add_clause: false,
};

export function roleLabel(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

/* "Can add their information" was removed from the UI 2026-07-31 (owner). The
   FIELD stays and is still enforced server-side by set_contract_field — it
   defaults to TRUE, which is the sensible behaviour: a party can always complete
   the fields their own side owns. Only the toggle is gone.

   Hints removed too: the control names carry their own meaning, and four
   two-line rows per party made the card taller than the contract section above
   it. */
const ROWS: { key: keyof PartyControlValues; label: string }[] = [
  { key: 'can_edit_deal', label: 'Can edit deal terms' },
  { key: 'can_suggest', label: 'Can suggest changes' },
  // Gates the subheader's "+ Add item" button (ContractPage: canAddClause).
  { key: 'can_add_clause', label: 'Can add new items' },
];

export function PartyControlsCard({
  role, value, onChange, disabled = false, lastDealEditor = false,
}: {
  role: string;
  value: PartyControlValues;
  onChange: (v: PartyControlValues) => void;
  disabled?: boolean;
  /** TRUE when this party is the ONLY one who can edit deal terms. The server
   *  refuses to clear the last one (set_party_controls raises), but a checkbox
   *  that visibly unticks and then silently snaps back reads as a bug — so the
   *  box is disabled here and says why. */
  lastDealEditor?: boolean;
}) {
  return (
    <div className="border border-green-800/10 rounded-lg p-3.5">
      <p className="text-sm font-medium text-green-900 mb-2">{roleLabel(role)}</p>
      <div className="flex flex-col gap-2.5">
        {ROWS.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-green-900 min-w-0">
              {r.label}
              {r.key === 'can_edit_deal' && lastDealEditor && value.can_edit_deal && (
                <span className="block text-[11px] text-muted">
                  Someone has to be able to edit — turn this on for the other party first.
                </span>
              )}
            </span>
            <input type="checkbox" className="accent-green-700 w-4 h-4 shrink-0 disabled:opacity-50"
              checked={value[r.key]}
              disabled={disabled || (r.key === 'can_edit_deal' && lastDealEditor && value.can_edit_deal)}
              title={r.key === 'can_edit_deal' && lastDealEditor && value.can_edit_deal
                ? 'Someone has to be able to edit the terms — turn it on for the other party first.'
                : undefined}
              onChange={(e) => {
                const next = { ...value, [r.key]: e.target.checked };
                // "Can edit deal terms" and "Can suggest changes" are mutually
                // exclusive — a party either changes the terms directly or proposes
                // changes for review, not both.
                if (e.target.checked && r.key === 'can_edit_deal') next.can_suggest = false;
                if (e.target.checked && r.key === 'can_suggest') next.can_edit_deal = false;
                onChange(next);
              }} />
          </label>
        ))}
      </div>
    </div>
  );
}

export default PartyControlsCard;
