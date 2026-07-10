import { SEED_ATTENTION, SEED_COMING_UP, type SeedActionTile } from '../../lib/seed';

/**
 * DASHBOARD PANEL — the thin, high-value strip above the community feed on the
 * main page. Only two bands: "Needs your attention" (gold action tiles) and
 * "Coming up". Given its own surface (soft gradient + shadow) so it reads as a
 * distinct block. Shared by riders, instructors, and admins — it's the top of
 * the shared main page.
 */

function Tile({ tile }: { tile: SeedActionTile }) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        tile.gold
          ? 'border-gold-400 shadow-[0_0_0_1px_theme(colors.gold.400)] bg-gradient-to-br from-gold-50 to-white'
          : 'border-green-800/10 bg-white'
      }`}
    >
      <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold mb-1.5">{tile.kind}</p>
      <p className="font-serif text-green-800 text-xl leading-tight font-semibold">{tile.title}</p>
      {tile.sub && <p className="text-sm text-muted mt-1">{tile.sub}</p>}
      <button
        type="button"
        className="inline-flex mt-3 text-[10.5px] tracking-wide uppercase text-white bg-green-800 px-3.5 py-2 rounded-lg font-medium hover:bg-green-700 focus-ring"
      >
        {tile.cta} →
      </button>
    </div>
  );
}

export function DashboardPanel() {
  return (
    <div className="rounded-2xl border border-green-800/10 shadow-[0_14px_34px_-14px_rgba(13,33,24,0.22)] bg-gradient-to-br from-white to-cream-100 p-5 sm:p-6 mb-6 sm:mb-7">
      <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mb-3">Needs your attention</p>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {SEED_ATTENTION.map((t) => <Tile key={t.id} tile={t} />)}
      </div>
      <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-5 mb-3">Coming up</p>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {SEED_COMING_UP.map((t) => <Tile key={t.id} tile={t} />)}
      </div>
    </div>
  );
}
