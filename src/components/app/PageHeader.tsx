import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * PAGE HEADER — the one placement, owner 2026-08-08 (A5/A6/A7).
 *
 * The owner's report: "the add-new button sits at a different height on every
 * page — new deal higher than new contract, lower than new horse." Ten pages had
 * hand-rolled this row, so they drifted. This is that row, once.
 *
 * THE ORDER, owner's words: "the top right corner is where the + button goes,
 * the page name is bottom aligned with that button, and the page title is below
 * those, and the description is below that."
 *
 *     ┌──────────────────────────────────────────────┐
 *     │ PAGE NAME (gold eyebrow) ............   [ + ]│  ← bottoms aligned
 *     │ Page title, large and green                  │
 *     │ Description, one size down                   │
 *     └──────────────────────────────────────────────┘
 *
 * "Page name" and "page title" are two different things and the distinction is
 * the app's own (TASK-PAGETITLES): the gold all-caps eyebrow is the PAGE NAME —
 * what the thing is called — and the large green line is a warm, conversational
 * message to the reader. Never a duplicate of the name.
 *
 * BOTTOM ALIGNMENT is `items-end`, deliberately. The eyebrow is ~12px tall and
 * the control is 40px; aligning their bottoms puts the small text on the
 * control's baseline instead of floating it against the middle of a much taller
 * box. Centre-aligning them is what made these rows look different from each
 * other in the first place.
 *
 * A6 — the control is a SQUARE, ICON-ONLY `+`. The label is dropped: `+` is the
 * universal add-new affordance, and the words made every button a different
 * width, which is part of why the rows never lined up.
 *
 * Dropping visible text does NOT drop the accessible name. `addLabel` becomes
 * both `aria-label` and the hover `title`, so a screen reader still hears "Add a
 * horse" and a mouse user can still discover it.
 */
export function PageHeader({ name, title, description, onAdd, addLabel }: {
  /** The gold eyebrow — what this page IS. Short, it gets uppercased. */
  name: string;
  /** The large green line — a message to the reader, NEVER a repeat of `name`.
   *  OPTIONAL, and deliberately so: TASK-TITLESWEEP holds draft-approved copy for
   *  the user pages only. Ops pages have none, and inventing a conversational
   *  line per page is exactly the improvisation that task forbids. A page with no
   *  approved copy renders name + description and reads fine; TITLESWEEP fills
   *  the titles in later without touching layout. */
  title?: string;
  description?: ReactNode;
  /** Omit to render no control; the row still holds the page name. */
  onAdd?: () => void;
  /** Required whenever `onAdd` is given: the accessible name, e.g. "Add a horse". */
  addLabel?: string;
}) {
  return (
    <header className="mb-8">
      {/* Row 1 — page name left, control top-right, bottoms aligned.
          min-h matches the control so pages WITHOUT one keep the same rhythm
          as pages with one; otherwise the title would ride up on those pages
          and the drift this component exists to fix would come back. */}
      <div className="flex items-end justify-between gap-4 min-h-[40px] mb-3">
        <p className="eyebrow">{name}</p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            title={addLabel}
            className="shrink-0 grid place-items-center w-10 h-10 rounded-lg bg-green-800 text-white hover:bg-green-700 focus-ring"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {title && <h1 className="heading-section text-green-800">{title}</h1>}

      {description && (
        <p className={`body-text text-muted max-w-2xl ${title ? 'mt-3' : ''}`}>{description}</p>
      )}
    </header>
  );
}
