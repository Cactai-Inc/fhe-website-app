import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import { useAuth } from '../../../../contexts/AuthContext';
import { setPageHidden } from '../../../../lib/api';
import { toErrorMessage } from '../../../../lib/ops/errors';
import {
  pageSections, PARKED_IN_REVIEW, type PageEntry, type PageSection,
} from '../../../../lib/pageRegistry';

/**
 * PAGE VISIBILITY (/app/ops/admin/pages) — TASK-PAGEVIS.
 *
 * Owner, 2026-08-11: *"i need the ability to hide individual pages not be
 * required to hide entire modules nor be burdened by things i wont be using."*
 *
 * Every staff page with a nav row of its own, grouped by module, each with a
 * show/hide toggle. Visible pages are listed too — a list of only the hidden
 * ones cannot be used to hide anything.
 *
 * ── WHAT THE CONTROLS ACTUALLY DO ───────────────────────────────────────────
 *
 *  · Hiding removes the NAV ENTRY. The route still resolves, so bookmarks and
 *    in-app links keep working and nothing is gated. This is decluttering, not
 *    permission.
 *  · Hiding NEVER turns a module off. `org_modules.enabled` is an entitlement
 *    set by the platform owner; putting a page away must not revoke it, and must
 *    not take the module's other pages down with it.
 *  · NO CASCADE. Hiding a hub hides one row; the pages inside it keep their own
 *    rows and stay in the nav. That is stated on the section itself, not just in
 *    a comment, because it is the rule a reader would otherwise have to guess.
 *  · This page cannot be hidden — the database refuses it, not just this file —
 *    so the way back always exists.
 *
 * ── LOCKED vs HIDDEN ────────────────────────────────────────────────────────
 *
 * A module the tenant is not entitled to is LOCKED: its pages are listed, shown
 * as locked, and their toggles are inert, because hiding something you do not
 * have is meaningless. Locked is the platform owner's decision (Feature flags);
 * hidden is yours, and reversible here.
 */

/** One page row. `busy` is per-key so a slow save never freezes the whole list. */
function PageRow({
  page, hidden, entitled, busy, onToggle,
}: {
  page: PageEntry;
  hidden: boolean;
  entitled: boolean;
  busy: boolean;
  onToggle: (page: PageEntry, next: boolean) => void;
}) {
  const locked = !entitled;
  const parked = PARKED_IN_REVIEW.has(page.key);
  const disabled = busy || locked || page.protected === true;

  return (
    <div
      data-testid={`pagevis-row-${page.key}`}
      className={`flex items-start justify-between gap-4 px-5 py-3.5 border-b border-green-800/10 last:border-b-0 ${
        hidden ? 'bg-cream-100/60' : ''
      }`}
    >
      <div className="min-w-0">
        <p className={`text-[15px] ${hidden ? 'text-muted' : 'text-green-900 font-medium'}`}>
          {page.parent && <span aria-hidden className="text-muted mr-1.5">└</span>}
          {page.label}
        </p>
        <p className="text-[12px] text-muted mt-0.5 break-all">{page.path}</p>
        {page.note && <p className="text-[12px] text-gold-800 mt-1">{page.note}</p>}
        {parked && (
          <p className="text-[12px] text-muted mt-1">
            Currently sitting in the temporary Review section, so its usual nav row is not in
            the rail yet. Your choice here applies the moment it moves back.
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-3">
        {page.protected === true ? (
          <span className="flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-muted">
            <Lock size={13} aria-hidden /> Always shown
          </span>
        ) : locked ? (
          <span
            data-testid={`pagevis-locked-${page.key}`}
            className="flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-muted"
          >
            <Lock size={13} aria-hidden /> Locked
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(page, !hidden)}
            data-testid={`pagevis-toggle-${page.key}`}
            aria-pressed={hidden}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] focus-ring disabled:opacity-50 ${
              hidden
                ? 'border-green-800/20 text-muted hover:bg-green-50/50'
                : 'border-green-700 bg-green-50 text-green-900'
            }`}
          >
            {hidden ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
            {busy ? 'Saving…' : hidden ? 'Hidden' : 'Shown'}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  section, isHidden, hasModule, busyKey, onToggle,
}: {
  section: PageSection;
  isHidden: (key: string) => boolean;
  hasModule: (key: string) => boolean;
  busyKey: string | null;
  onToggle: (page: PageEntry, next: boolean) => void;
}) {
  const entitled = !section.module || hasModule(section.module);
  const hubs = section.pages.filter((p) => !p.parent);
  const hasChildren = section.pages.some((p) => p.parent);

  return (
    <section className="mb-8" aria-label={section.label}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] tracking-widest uppercase text-muted font-semibold">
          {section.label}
        </p>
        {section.module && (
          <p className="text-[12px] text-muted">
            {entitled ? 'Module enabled' : 'Module locked — ask the platform owner to enable it'}
          </p>
        )}
      </div>

      {entitled && hasChildren && hubs.length > 0 && (
        <p className="text-[12.5px] text-muted mb-2">
          Hiding <span className="text-green-900">{hubs[0].label}</span> hides only its own nav
          row. The pages inside it keep theirs and stay in the menu — nothing gets stranded.
        </p>
      )}

      <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
        {section.pages.map((p) => (
          <PageRow
            key={p.key}
            page={p}
            hidden={isHidden(p.key)}
            entitled={entitled}
            busy={busyKey === p.key}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}

export default function AdminPageVisibilityPage() {
  useDocumentTitle('Page visibility');
  const { hiddenPages, hasModule, refreshHiddenPages } = useAuth();

  /* Optimistic local overlay on top of AuthContext's set, so a toggle responds
     immediately and still reconciles against the server. A rejected write is
     rolled back here AND surfaced — set_page_hidden RAISES rather than no-ops,
     which is what makes "it saved" provable rather than assumed. */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHidden = (key: string) =>
    key in pending ? pending[key] : hiddenPages.includes(key);

  async function onToggle(page: PageEntry, next: boolean) {
    setError(null);
    setBusyKey(page.key);
    setPending((p) => ({ ...p, [page.key]: next }));
    try {
      const landed = await setPageHidden(page.key, next);
      if (landed !== next) throw new Error('The change did not save.');
      await refreshHiddenPages();
      setPending((p) => {
        const { [page.key]: _dropped, ...rest } = p;
        return rest;
      });
    } catch (err: unknown) {
      setPending((p) => {
        const { [page.key]: _dropped, ...rest } = p;
        return rest;
      });
      setError(toErrorMessage(err, `Could not ${next ? 'hide' : 'show'} ${page.label}.`));
    } finally {
      setBusyKey(null);
    }
  }

  const sections = pageSections();
  const hiddenCount = sections
    .flatMap((s) => s.pages)
    .filter((p) => isHidden(p.key)).length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Page visibility</h1>
      <p className="text-sm text-green-800/70 mb-1">
        Every page in the staff menu. Hide the ones you do not use — one page at a time, never a
        whole module.
      </p>
      <p className="text-[12.5px] text-muted mb-6">
        Hiding removes the menu entry and nothing else: the page still opens from a link or a
        bookmark, keeps its data, and stays switched on for your account. Turning a whole module
        off is a different thing and lives under Feature flags.
        {hiddenCount > 0 && ` ${hiddenCount} hidden right now.`}
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {sections.map((s) => (
        <Section
          key={s.id}
          section={s}
          isHidden={isHidden}
          hasModule={hasModule}
          busyKey={busyKey}
          onToggle={onToggle}
        />
      ))}

      <p className="text-[12.5px] text-muted">
        Not listed here: the temporary <Link className="underline" to="/app/ops/review">Review</Link>{' '}
        section, where a page sits until you accept it — moving it out is the acceptance signal, so
        hiding a Review row would falsify it.
      </p>
    </div>
  );
}
