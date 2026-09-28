import { useEffect, useState } from 'react';
import { Modal } from '../ops/kit/Modal';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  listBookingDrafts, hardDeleteBookingDrafts, type BookingDraft,
} from '../../lib/ops/api-calendar';

/**
 * BOOKING DRAFTS — the interstitial that appears when staff go to create a booking
 * and drafts already exist (owner, 2026-09-27). It is not a page you navigate to:
 * the calendar's create routes route THROUGH it when there is anything to resume.
 *
 * A draft is a booking saved with status 'draft' — an accidental close auto-saves
 * one, "Save draft" makes one deliberately, and a queued "find a time later"
 * booking is one. Clients never see drafts.
 *
 *  • Click a draft  → open it in the booking modal to finish (onOpenDraft).
 *  • Create new booking (big button) → skip to a fresh empty modal (onCreateNew).
 *  • Edit → multi-select; a Delete button appears once ≥1 is picked; HARD delete.
 *  • Done → leave edit mode.
 *  • Emptying the list (or none to begin with) closes this and the caller proceeds.
 */
export function BookingDraftsPanel({
  onOpenDraft, onCreateNew, onClose, onEmptied,
}: {
  onOpenDraft: (draft: BookingDraft) => void;
  onCreateNew: () => void;
  onClose: () => void;
  /** Called when the last draft is deleted, so the caller can fall through to the
   *  normal create flow instead of showing an empty panel. */
  onEmptied?: () => void;
}) {
  const [drafts, setDrafts] = useState<BookingDraft[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => {
    listBookingDrafts()
      .then((d) => {
        setDrafts(d);
        if (d.length === 0) (onEmptied ?? onClose)();
      })
      .catch((e) => setErr(toErrorMessage(e, 'Could not load your drafts.')));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Permanently delete ${selected.size} draft${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBusy(true); setErr(null);
    try {
      await hardDeleteBookingDrafts([...selected]);
      setSelected(new Set());
      const remaining = await listBookingDrafts();
      setDrafts(remaining);
      if (remaining.length === 0) { (onEmptied ?? onClose)(); return; }
      setEditMode(false);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not delete the drafts.'));
    } finally { setBusy(false); }
  }

  function whenLabel(d: BookingDraft): string {
    if (!d.starts_at) return 'No time set';
    const s = new Date(d.starts_at);
    return d.all_day
      ? s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : s.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function subtitle(d: BookingDraft): string {
    return [d.client_name, d.offering_name ?? d.horse_name, d.notes]
      .map((x) => x?.trim()).filter(Boolean).join(' · ') || 'Untitled draft';
  }

  return (
    <Modal open onClose={onClose} size="lg" panelClassName="bg-cream"
      title="Booking drafts" error={err}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          Drafts are yours only — a client never sees one. Pick one up to finish it, or
          start a fresh booking below.
        </p>

        {!drafts ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button"
                  onClick={() => (editMode ? toggle(d.id) : onOpenDraft(d))}
                  className={`w-full text-left rounded-lg border px-3.5 py-2.5 flex items-center gap-3 focus-ring ${
                    editMode && selected.has(d.id)
                      ? 'border-red-400 bg-red-50/50'
                      : 'border-green-800/12 bg-white hover:border-green-600'}`}>
                  {editMode && (
                    <input type="checkbox" className="accent-red-600 shrink-0" readOnly
                      checked={selected.has(d.id)} aria-label={`Select ${subtitle(d)}`} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-green-900 truncate">{subtitle(d)}</span>
                    <span className="block text-[12px] text-muted">{whenLabel(d)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-green-800/10 pt-3">
          {!editMode ? (
            <>
              <button type="button" className="btn-primary flex-1 justify-center"
                onClick={onCreateNew}>
                Create new booking
              </button>
              {drafts && drafts.length > 0 && (
                <button type="button" className="text-sm text-green-800 border border-green-800/25 px-3 py-2 rounded-md hover:bg-green-50"
                  onClick={() => setEditMode(true)}>
                  Edit
                </button>
              )}
            </>
          ) : (
            <>
              {selected.size > 0 && (
                <button type="button" className="text-sm text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-md disabled:opacity-50"
                  disabled={busy} onClick={() => void deleteSelected()}>
                  {busy ? 'Deleting…' : `Delete ${selected.size}`}
                </button>
              )}
              <button type="button" className="text-sm text-green-800 border border-green-800/25 px-3 py-2 rounded-md hover:bg-green-50 ml-auto"
                onClick={() => { setEditMode(false); setSelected(new Set()); }}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default BookingDraftsPanel;
