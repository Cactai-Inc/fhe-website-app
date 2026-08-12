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
 * TASK-ADDNEW (2026-08-11) — A6 IS REVERTED. Owner: "I previously told you to
 * make the + icon the button on the pages where i can create something, i
 * revert that and supersede the decision to the documents page version it
 * looks the best, + Add New." A6's stated problem does not survive this
 * change: it dropped the label because labels *varied* ("New deal", "Add a
 * horse", "Add a new client") so every button was a different width. If every
 * button reads the same two words, they are all identical widths — the
 * alignment problem A6 existed to solve is solved by uniformity, not silence.
 * The control is now `+ Add New`, matching `DocumentsQueuePage.tsx`, on every
 * page, always the same width.
 *
 * ACCESSIBLE NAME — resolution 1 of the two TASK-ADDNEW named as compliant
 * with WCAG 2.5.3 Label in Name: the accessible name must CONTAIN the visible
 * text. Visible text is always "Add New"; `addLabel` is now the OBJECT NOUN
 * being added ("horse", "client", "deal" — not a full sentence), composed as
 * `aria-label="Add New {addLabel}"`. That keeps "Add New" as an exact prefix
 * of the accessible name (satisfying 2.5.3) while a screen-reader user still
 * hears which page they're on, which an app-wide "Add New" with no context
 * would not give them. Omitting `addLabel` falls back to the visible text
 * alone as the accessible name (resolution 2) — no page in this app does that
 * today, but the type stays optional for a page with nothing more specific to
 * say.
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
  /** Required whenever `onAdd` is given: the object noun, e.g. "horse", not a
   *  full sentence. Composed into the accessible name as "Add New {addLabel}". */
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
            aria-label={addLabel ? `Add New ${addLabel}` : undefined}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring"
          >
            <Plus size={16} aria-hidden="true" />
            Add New
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
