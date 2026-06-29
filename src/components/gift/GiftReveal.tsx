import { useState } from 'react';
import { Gift } from 'lucide-react';

/**
 * Placeholder animated "open" element for a gift reveal.
 *
 * This is intentionally a swappable shell: a tappable gift box with a small
 * open animation. To ship the real experience, replace the inner visual (the
 * `.gift-box` block) with the final animation — a Lottie/Rive player, a video,
 * or an SVG sequence — and call `onOpen()` when the open animation completes.
 * The surrounding redeem flow does not change.
 */
export default function GiftReveal({ onOpen }: { onOpen: () => void }) {
  const [opening, setOpening] = useState(false);

  function handleOpen() {
    if (opening) return;
    setOpening(true);
    // Let the lid animation play, then reveal. (Real animation would drive this.)
    window.setTimeout(onOpen, 700);
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      aria-label="Open your gift"
      className="group relative mx-auto block focus-ring-dark"
      style={{ width: 160, height: 160 }}
    >
      {/* Glow */}
      <span
        className={`absolute inset-0 rounded-full bg-gold-400/30 blur-2xl transition-opacity duration-500 ${opening ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`}
        aria-hidden="true"
      />
      {/* Box */}
      <span
        className={`relative flex items-center justify-center w-full h-full transition-transform duration-700 ${
          opening ? 'scale-110' : 'group-hover:-translate-y-1'
        }`}
        aria-hidden="true"
      >
        <span
          className={`flex items-center justify-center w-28 h-28 rounded-2xl bg-gradient-to-br from-green-700 to-green-900 border border-gold-400/40 shadow-2xl transition-all duration-700 ${
            opening ? 'rotate-[8deg] opacity-0' : 'opacity-100'
          }`}
        >
          <Gift size={48} className="text-gold-300" />
        </span>
        {/* Burst on open */}
        {opening && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-gold-300 animate-fade-in" />
          </span>
        )}
      </span>
    </button>
  );
}
