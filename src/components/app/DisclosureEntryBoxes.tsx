/* DisclosureEntryBoxes — THE ONE on-screen renderer for a disclosure section's
 * entries. Used by the horse record view, the contract read-only view, and the
 * contract editor (all three render identically). Each field is an outlined box
 * with its label above the value; boxes flow left-to-right and wrap; an empty
 * field is an empty box; entries are visibly separated. Read-only: the component
 * never edits — disclosure content is edited on the horse record.
 *
 * The PDF draws its own boxes from the same structured data (shared/documentPdf.ts);
 * this is the screen twin, not shared code (one is React, one is pdf-lib drawing),
 * but both consume the identical { label, value }[] entry shape.
 */
import type { DisclosureEntry } from '../../lib/disclosureMarker';

export function DisclosureEntryBoxes({ entries }: { entries: DisclosureEntry[] }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 my-1">
      {entries.map((entry, ei) => (
        <div
          key={ei}
          className="rounded-lg border border-green-800/15 bg-green-50/40 p-2"
        >
          <div className="flex flex-wrap gap-1.5">
            {entry.map((f, fi) => (
              <div
                key={fi}
                className="min-w-[7rem] flex-1 basis-[7rem] rounded-md border border-green-800/15 bg-white px-2 py-1"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-green-700/70">
                  {f.label}
                </div>
                <div className="text-[13px] text-green-950 break-words min-h-[1.1em]">
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
