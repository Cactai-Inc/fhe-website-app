import { HorseIntakeForm } from './HorseIntakeForm';
import { Modal } from '../ops/kit/Modal';

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
 *
 * ⚠️ TASK-FIX4 §3 — converged on the shared dialog. The backdrop used to close it,
 * and `HorseIntakeForm` is fourteen fields deep: this is CR-68a's own incident,
 * *"losing horse-intake data"*, reported 2026-08-25 and still live six days later.
 * It no longer closes on a backdrop click.
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
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <HorseIntakeForm
        submitLabel="Save horse"
        createEarly
        ownerContactId={ownerContactId}
        onDone={(horseId, owner) => onSaved(horseId, owner ?? ownerContactId)} />
    </Modal>
  );
}

export default AddHorseModal;
