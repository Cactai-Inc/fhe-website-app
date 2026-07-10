import type { ReactNode } from 'react';

/** Minimal APP chrome for the pre-auth activation pages: the app header bar
 *  (wordmark only — no nav, no menus) over the cream canvas. Invitees land
 *  INSIDE the app experience, not on the marketing website. */
export function ActivateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-green-800/10">
        <div className="w-full max-w-[120rem] mx-auto flex items-center px-4 sm:px-8 h-14">
          <span className="flex items-center gap-2.5">
            <span className="w-[34px] h-[34px] rounded-lg bg-green-800 text-gold-400 grid place-items-center font-display text-lg font-semibold">F</span>
            <span className="font-display text-green-800 text-lg uppercase tracking-wide">French Heritage</span>
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
