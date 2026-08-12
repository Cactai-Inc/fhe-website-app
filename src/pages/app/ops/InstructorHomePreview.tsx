import { Helmet } from 'react-helmet-async';
import { Eye } from 'lucide-react';
import InstructorHome from '../InstructorHome';

/**
 * INSTRUCTOR HOME — PREVIEW (/app/ops/preview/instructor-home).
 *
 * WHY THIS EXISTS (TASK-ADMINSWEEP Phase 2, owner 2026-08-11: "Lets see
 * OpsDashboard and InstructorHome wired up before we make a decision").
 * `InstructorHome` renders only for non-admin staff — `OpsHome` picks it when
 * `isAdmin` is false — and production `profiles.role` holds only ADMIN,
 * SUPER_ADMIN and USER. There is no account in existence that renders it, so
 * there was no way to look at the page before deciding its future.
 *
 * WHAT THIS IS NOT. It does not fake a role, shadow `isAdmin`, or write to
 * `profiles.role` — the owner ruled that out and it would be a lie about
 * access rather than a preview of a page. It mounts the real component
 * unmodified and puts a banner over it.
 *
 * THE LIMIT THAT MATTERS, and it is on the banner as well as here: every query
 * inside InstructorHome runs as the SIGNED-IN VIEWER. An admin previewing this
 * sees admin-scoped rows. A real trainer's RLS scope may return a different
 * set. So this shows the page's LAYOUT and BEHAVIOUR faithfully and its DATA
 * only approximately.
 *
 * DELIBERATELY NOT AN ENTRY POINT. No nav entry, and nothing links here — the
 * route is reached by typing the URL. TASK-LEADCLEAN is consolidating the
 * staff landing surfaces onto DashboardPanel; a second discoverable home would
 * recreate the duplication it is removing. If the owner keeps this page, the
 * preview wrapper is what gets deleted, not the page.
 */
export default function InstructorHomePreview() {
  return (
    <div>
      <Helmet><title>PREVIEW · Instructor home</title></Helmet>

      {/* Unmistakable, and deliberately not in the app's own chrome vocabulary:
          full-bleed gold, uppercase eyebrow, dashed edge. Nothing else in the
          staff app looks like this, which is the point — a reader who lands
          here mid-session must not mistake it for a shipped surface. */}
      <div
        role="note"
        aria-label="Preview notice"
        data-testid="instructor-preview-banner"
        className="border-2 border-dashed border-gold-400 bg-gold-50 rounded-xl px-4 py-3.5 mb-2 max-w-3xl mx-auto mt-6 sm:px-6"
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold-800">
          <Eye size={14} aria-hidden="true" />
          Preview — not a live page
        </p>
        <p className="text-[13px] text-green-900 mt-1.5">
          This is the <strong>trainer&rsquo;s home</strong> (<code>InstructorHome</code>), which
          normally renders only for staff who are not admins. No such account exists in
          production, so this route mounts the page for evaluation.
        </p>
        <p className="text-[12px] text-green-800/80 mt-1.5">
          <strong>Its data is yours, not a trainer&rsquo;s.</strong> Every query below runs as
          your signed-in account, so the rows are admin-scoped. Read the layout and the
          behaviour as accurate; treat the specific rows as indicative only.
        </p>
      </div>

      <InstructorHome />
    </div>
  );
}
