import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * PAGE HEADER — the one placement, owner 2026-08-08 (A5/A6).
 *
 * The owner's report: "the add-new button sits at a different height on every
 * page — new deal higher than new contract, lower than new horse." Ten pages had
 * hand-rolled the same header row, so they drifted. This is that row, once.
 *
 * `Horse records` is the reference the owner named, and its metrics are what
 * this reproduces: title and control on one row, `mb-1`, description beneath at
 * `text-sm text-green-800/70 mb-6`.
 *
 * A6 — THE CONTROL IS A SQUARE, ICON-ONLY `+`, RIGHT-ALIGNED. The label is
 * dropped: `+` is already the universal add-new affordance and the words were
 * noise that also made every button a different width, which is part of why the
 * rows never lined up.
 *
 * Dropping visible text does NOT drop the accessible name. `addLabel` is
 * required and becomes both `aria-label` and the hover `title`, so a screen
 * reader still hears "Add a horse" and a mouse user can still discover it.
 * Passing a bare "+" or an empty string here would be a regression.
 */
export function PageHeader({ title, description, onAdd, addLabel }: {
  title: string;
  description?: ReactNode;
  /** Omit to render no control — the row still holds the title. */
  onAdd?: () => void;
  /** Required whenever `onAdd` is given: the accessible name, e.g. "Add a horse". */
  addLabel?: string;
}) {
  return (
    <>
      {/* items-start, not items-center: a title that wraps to two lines on a
          phone should keep the control level with the FIRST line rather than
          sliding to the vertical middle of the block. */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-serif text-2xl text-green-900">{title}</h1>
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
      {description && <p className="text-sm text-green-800/70 mb-6">{description}</p>}
    </>
  );
}
