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

const ROWS: { key: keyof PartyControlValues; label: string; hint: string }[] = [
  { key: 'can_fill', label: 'Can add their information', hint: 'They complete the fields their side owns. Off = you fill everything acting on their behalf.' },
  { key: 'can_edit_deal', label: 'Can edit deal terms', hint: 'Direct changes to the negotiated terms. Usually off — the terms are the deal.' },
  { key: 'can_suggest', label: 'Can suggest changes', hint: 'They may propose edits to existing terms for you to accept or reject. Off = take-it-or-leave-it.' },
  { key: 'can_add_clause', label: 'Can add new clauses', hint: 'They may propose entirely new clauses for you to accept or reject. Off = no additions.' },
];

export function PartyControlsCard({
  role, value, onChange, disabled = false,
}: {
  role: string;
  value: PartyControlValues;
  onChange: (v: PartyControlValues) => void;
  disabled?: boolean;
}) {
  return (
    <div className="border border-green-800/10 rounded-lg p-3.5">
      <p className="text-sm font-medium text-green-900 mb-2">{roleLabel(role)}</p>
      <div className="flex flex-col gap-2.5">
        {ROWS.map((r) => (
          <label key={r.key} className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[13px] text-green-900">{r.label}</span>
              <span className="block text-[11px] text-muted">{r.hint}</span>
            </span>
            <input type="checkbox" className="accent-green-700 w-4 h-4 mt-0.5 shrink-0"
              checked={value[r.key]} disabled={disabled}
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
