import { HorseIntakeForm } from './HorseIntakeForm';

/**
 * ADD A NEW HORSE — the one modal, wrapping the one intake form.
 *
 * TASK-PAMELA §B. The contract surfaces used to have their own answers to "the
 * horse isn't on file yet": the new-contract page rendered EIGHT bare text inputs
 * of its own (registered name, "Barn name", breed, color, sex, height, microchip,
 * registration #) with no farrier, no vet, and free text where the record needs a
 * matched code; the contract page's horse gate navigated AWAY to
 * `/app/horse-intake`, losing the contract the author was in the middle of.
 *
 * Owner, 2026-08-23: *"it should open the intake form as a modal."* So this is
 * the modal, and what is inside it is `HorseIntakeForm` exactly as it exists
 * everywhere else — not a trimmed variant, not a second implementation (D18
 * applies to UI, not just RPCs).
 *
 * TWO THINGS IT KNOWS THAT THE FORM DOES NOT:
 *  1. `ownerContactId` — when the calling contract already names the horse-owning
 *     party, that party IS the owner and the modal never asks again. When it does
 *     not, the form's own staff account picker is the ask, and `onSaved` hands the
 *     answer back so the caller can set the party FROM the horse.
 *  2. `createEarly` — a name is enough to create the record here; everything else
 *     completes afterwards through the form's existing autosave-on-blur.
 */
export function AddHorseModal({
  open, onClose, onSaved, ownerContactId, title = 'Add a new horse',
}: {
  open: boolean;
  onClose: () => void;
  /** The created/matched horse, and the contact it belongs to when known. */
  onSaved: (horseId: string, ownerContactId?: string) => void;
  /** Preset owner — omit to have the form ask (staff) or bind to the caller (client). */
  ownerContactId?: string;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto overscroll-contain p-4"
      role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-green-900 text-lg">{title}</h3>
          <button type="button" className="text-sm text-muted hover:text-green-800 focus-ring"
            onClick={onClose}>
            Close
          </button>
        </div>
        <HorseIntakeForm
          submitLabel="Save horse"
          createEarly
          ownerContactId={ownerContactId}
          onDone={(horseId, owner) => onSaved(horseId, owner ?? ownerContactId)} />
      </div>
    </div>
  );
}

export default AddHorseModal;
