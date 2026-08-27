import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PageLayout } from '../../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../../lib/hooks';
import { adminFormDefinitions, menuInventory, type AdminFormDefinition, type MenuSummary } from '../../../../lib/admin';
import { templateEditorList, type TemplateEditorListRow } from '../../../../lib/templateEditor';
import { emailTemplateList, type EmailTemplateRow } from '../../../../lib/surfaceEditor';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { FormSurface } from '../../../../components/ops/editor/FormSurface';
import { DocumentSurface } from '../../../../components/ops/editor/DocumentSurface';
import { EmailSurface } from '../../../../components/ops/editor/EmailSurface';
import { SharedListSurface } from '../../../../components/ops/editor/SharedListSurface';

/**
 * THE EDITOR (/app/ops/admin/editor) — one entry page listing every editable
 * surface BY NAME, and choosing one opens that surface, as it appears, editable
 * in place.
 *
 * Owner, 2026-08-26: *"we only need one editor for forms, docs, and ui pages,
 * with all of the editable items listed with their name and when clicked open an
 * editable version of that item… it would be most effective to just render the
 * entire thing that the thing im editing lives on, so if its a menu option on the
 * horse intake form, clicking on the horse intake form from the entry page opens
 * the horse intake form and then i can edit anything on the form, including the
 * menu items."*
 *
 * ⚠️ A LIST OF SURFACES, NOT A LIST OF MENUS. The flat inventory of 124 menus this
 * replaces was unusable, and not because of its length: *"a menu means nothing
 * away from the thing it appears on."* A form's menus are now on the form; a
 * contract's menus are on the clause that asks the question. The only flat rows
 * left are the five SHARED lists, which genuinely have no single home.
 *
 * ⚠️ THIS IS CR-74/CR-75's PATTERN, ARRIVED AT FROM A DIFFERENT DIRECTION —
 * *"dont take me to an editor page if im already looking at the thing i want to
 * change"*. A surface is a row that expands in place, exactly as a client record
 * is; the version list is the one thing that opens as a modal, because it is a
 * quick look that must not take you off the thing you are editing.
 *
 * ⚠️ THE THREE EDITORS THIS REPLACES KEEP THEIR ROUTES AND LOSE THEIR LINKS
 * (D32): /app/ops/admin/forms, /app/ops/admin/menus and /app/ops/admin/templates
 * still resolve for anyone holding a bookmark, and nothing in the nav, the page
 * registry or any page points at them any more.
 */

type Tab = 'forms' | 'documents' | 'emails' | 'lists';

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: 'forms', label: 'Forms', blurb: 'What people fill in — every question, and the choices each one offers.' },
  { key: 'documents', label: 'Documents', blurb: 'Contract wording, clause by clause, with the menus each clause asks for.' },
  { key: 'emails', label: 'Emails', blurb: 'Every message the system sends, in your words.' },
  { key: 'lists', label: 'Shared lists', blurb: 'The handful of lists used in several places at once, so they have no single home.' },
];

export default function AdminEditorPage() {
  useDocumentTitle('Editor');
  const [tab, setTab] = useState<Tab>('forms');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [forms, setForms] = useState<AdminFormDefinition[] | null>(null);
  const [docs, setDocs] = useState<TemplateEditorListRow[] | null>(null);
  const [emails, setEmails] = useState<EmailTemplateRow[] | null>(null);
  const [lists, setLists] = useState<MenuSummary[] | null>(null);

  const loadDocs = useCallback(() => {
    templateEditorList().then(setDocs).catch((e) => setError(toErrorMessage(e, 'Could not load the documents.')));
  }, []);
  const loadEmails = useCallback(() => {
    emailTemplateList().then(setEmails).catch((e) => setError(toErrorMessage(e, 'Could not load the emails.')));
  }, []);

  useEffect(() => {
    adminFormDefinitions().then(setForms).catch((e) => setError(toErrorMessage(e, 'Could not load the forms.')));
    loadDocs();
    loadEmails();
    menuInventory()
      .then((m) => setLists(m.filter((x) => x.source === 'vocabulary')))
      .catch((e) => setError(toErrorMessage(e, 'Could not load the shared lists.')));
  }, [loadDocs, loadEmails]);

  const needle = q.trim().toLowerCase();
  const hit = (...s: (string | null | undefined)[]) =>
    !needle || s.some((x) => (x ?? '').toLowerCase().includes(needle));

  /* Alphabetical, per the owner's standing rule for lists — a grid or a natural
     order has no reading order a person can rely on (CR-75). */
  const shownForms = useMemo(
    () => (forms ?? []).filter((f) => hit(f.title, f.purpose)).sort((a, b) => a.title.localeCompare(b.title)),
    [forms, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownDocs = useMemo(
    () => (docs ?? []).filter((d) => hit(d.title)).sort((a, b) => a.title.localeCompare(b.title)),
    [docs, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownEmails = useMemo(
    () => (emails ?? []).filter((e) => hit(e.title, e.description, e.subject)).sort((a, b) => a.title.localeCompare(b.title)),
    [emails, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownLists = useMemo(
    () => (lists ?? []).filter((m) => hit(m.label, m.used_by)).sort((a, b) => a.label.localeCompare(b.label)),
    [lists, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const counts: Record<Tab, number | null> = {
    forms: forms?.length ?? null,
    documents: docs?.length ?? null,
    emails: emails?.length ?? null,
    lists: lists?.length ?? null,
  };

  return (
    <PageLayout
      name="Editor"
      width="wide"
      description="Everything you can change the words of, in one place. Pick a thing and it opens the way it actually appears — change the copy, the questions, and the choices those questions offer. Every save keeps the old version and you can read or restore it any time."
    >
      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
          <button type="button" className="ml-2 underline text-[12px]" onClick={() => setError(null)}>Dismiss</button>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`text-[13px] px-3.5 py-2 rounded-lg border focus-ring ${
              tab === t.key
                ? 'bg-green-50 border-green-700 text-green-900 font-medium'
                : 'border-green-800/15 text-secondary hover:bg-cream-100/60'
            }`}>
            {t.label}
            {counts[t.key] !== null && <span className="text-[11px] text-muted ml-1.5">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] text-muted mb-4">{TABS.find((t) => t.key === tab)?.blurb}</p>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="form-input text-sm w-full pl-9" placeholder="Search by name…"
          aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {tab === 'forms' && (
        <div className="flex flex-col gap-3">
          {forms === null && <p className="text-sm text-muted">Loading…</p>}
          {shownForms.map((f) => <FormSurface key={f.form_key} form={f} onError={setError} />)}
          {forms !== null && shownForms.length === 0 && <p className="text-sm text-muted">No form matches that.</p>}
        </div>
      )}

      {tab === 'documents' && (
        <div className="flex flex-col gap-3">
          {docs === null && <p className="text-sm text-muted">Loading…</p>}
          {shownDocs.map((d) => (
            <DocumentSurface key={d.template_key} meta={d} onError={setError} onReloadList={loadDocs} />
          ))}
          {docs !== null && shownDocs.length === 0 && <p className="text-sm text-muted">No document matches that.</p>}
        </div>
      )}

      {tab === 'emails' && (
        <div className="flex flex-col gap-3">
          {emails === null && <p className="text-sm text-muted">Loading…</p>}
          {shownEmails.map((e) => (
            <EmailSurface key={e.email_key} row={e} onError={setError} onReloadList={loadEmails} />
          ))}
          {emails !== null && shownEmails.length === 0 && <p className="text-sm text-muted">No email matches that.</p>}
        </div>
      )}

      {tab === 'lists' && (
        <div className="flex flex-col gap-3">
          {lists === null && <p className="text-sm text-muted">Loading…</p>}
          {shownLists.map((m) => <SharedListSurface key={m.menu_key} menu={m} onError={setError} />)}
          {lists !== null && shownLists.length === 0 && <p className="text-sm text-muted">No shared list matches that.</p>}
        </div>
      )}

      {/* THE ONE THING THAT IS NOT HERE, SAID PLAINLY. The owner asked for forms,
          documents AND ui pages; the text on the app's own pages is still written
          into the code and has no store to be edited from. Saying nothing would
          leave him to conclude the whole editor was missing half its job. */}
      <p className="text-[12px] text-muted mt-8 border-t border-green-800/10 pt-4">
        The wording on the app's own pages — the home page, the services pages, the sign-up
        screens — is not editable here yet. That text is still written into the app itself, and
        changing it is still a job for a developer.
      </p>
    </PageLayout>
  );
}
