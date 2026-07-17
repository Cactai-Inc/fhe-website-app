import { useCallback, useEffect, useState } from 'react';
import { Check, X, ListPlus } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listLookupSuggestions, promoteLookupSuggestion, dismissLookupSuggestion,
  type LookupSuggestion,
} from '../../../lib/api';

/**
 * LOOKUP REVIEW — the review queue that closes the "select-or-other" loop. Whenever
 * someone picks "Other" and types a value on a controlled field, it's captured here
 * with a count. The admin reviews frequent entries and promotes them into the official
 * option list (or dismisses them). Promoting adds the value to its vocabulary so future
 * users can just select it.
 */

const LOOKUP_LABELS: Record<string, string> = {
  horse_breeds: 'Horse breed',
  horse_colors: 'Horse color',
  horse_markings: 'Horse markings',
  horse_registration_org: 'Registration organization',
  horse_passport_country: 'Passport country',
};

export default function LookupReviewPage() {
  useDocumentTitle('Field option review');
  const [rows, setRows] = useState<LookupSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await listLookupSuggestions('open')); setError(null); }
    catch { setError('Could not load the review queue.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try { await fn(); setRows((r) => r.filter((x) => x.id !== id)); }
    catch { setError('That action failed.'); }
    finally { setBusy(null); }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Field option review</h1>
      <p className="text-sm text-muted mb-5">
        When someone can’t find their answer in a dropdown and types it under “Other,”
        it lands here. Promote the ones you see often — they become selectable options
        so nobody has to type them again.
      </p>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <ListPlus size={26} className="text-gold-800 mx-auto mb-2" />
          <p className="text-sm text-muted">Nothing to review — no manual entries have been captured yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-white border border-green-800/10 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-green-900 font-medium truncate">{r.raw_value}</p>
                <p className="text-[11px] text-muted">
                  {LOOKUP_LABELS[r.lookup_key] ?? r.lookup_key}
                  {r.count > 1 && <span className="ml-2 text-gold-800 font-medium">entered {r.count}×</span>}
                </p>
              </div>
              <button type="button" disabled={busy === r.id}
                onClick={() => void act(r.id, () => promoteLookupSuggestion(r.id))}
                className="inline-flex items-center gap-1.5 text-xs text-green-800 border border-green-800/25 rounded-lg px-3 py-1.5 hover:bg-green-50 focus-ring disabled:opacity-50">
                <Check size={13} /> Add to list
              </button>
              <button type="button" disabled={busy === r.id}
                onClick={() => void act(r.id, () => dismissLookupSuggestion(r.id))}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-red-700 hover:bg-red-50 rounded-lg px-2.5 py-1.5 focus-ring disabled:opacity-50">
                <X size={13} /> Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
