import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * SECTION CARD — the shared shell for every section of the consolidated
 * Profile & Preferences surface (owner spec 2026-08-05, TASK-PROFILE). The
 * prior layout's section boundaries "blended into the cards below" (owner
 * critique); a colored header band + a hard outer border make each section's
 * extent unmistakable at a glance, independent of its contents.
 */
export function SectionCard({
  icon: Icon, title, badge, children,
}: {
  icon: LucideIcon;
  title: string;
  /** e.g. "Visible only to staff" — rendered as a pill in the header band. */
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 first:mt-0 rounded-xl border border-green-800/15 overflow-hidden bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-green-800/[0.06] border-b border-green-800/15">
        <Icon size={16} className="text-green-700 shrink-0" />
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-green-900">{title}</span>
        {badge && (
          <span className="ml-auto text-[10.5px] font-medium text-gold-800 bg-gold-50 border border-gold-200 rounded-full px-2.5 py-1">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
