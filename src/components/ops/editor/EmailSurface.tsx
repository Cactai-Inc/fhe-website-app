import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AsyncButton } from '../kit/AsyncButton';
import {
  emailTemplateGet, emailTemplateSaveDraft, emailTemplatePublish, emailTemplateDiscardDraft,
  emailVersionList, emailVersionAt, restoreEmailVersion,
  type EmailTemplateRow, type EmailTemplateDetail, type EmailVersionDetail,
} from '../../../lib/surfaceEditor';
import { toErrorMessage } from '../../../lib/ops/errors';
import { VersionChip, VersionsModal, type VersionSource } from './SurfaceVersions';

/**
 * AN EMAIL THE SYSTEM SENDS, EDITABLE IN PLACE.
 *
 * ⚠️ THIS IS THE FIRST SCREEN `email_templates` HAS EVER HAD. 24 templates, six
 * RPCs, and — measured on this branch — zero TypeScript callers of any of them:
 * nothing in src/ named the table. So every word the app emails was a
 * developer-only change, which is D13's definition of unfinished work, and D17's
 * definition of a feature nothing reaches.
 *
 * It behaves exactly as document wording does, because TASK-SURFACEEDITOR's
 * migration put it on the same spine: type, save a draft, publish — and PUBLISH
 * is what mints the version. Same version chip, same history modal, same restore
 * that mints forward.
 */
export function EmailSurface({ row, onError, onReloadList }: {
  row: EmailTemplateRow;
  onError: (m: string) => void;
  onReloadList: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EmailTemplateDetail | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);

  const load = useCallback(async () => {
    const d = await emailTemplateGet(row.email_key);
    setDetail(d);
    setSubject(d.draft_subject ?? d.subject);
    setBody(d.draft_body ?? d.body);
  }, [row.email_key]);

  useEffect(() => {
    if (!open) return;
    load().catch((e) => onError(toErrorMessage(e, 'Could not open that email.')));
  }, [open, load, onError]);

  const dirty = detail !== null
    && (subject !== (detail.draft_subject ?? detail.subject) || body !== (detail.draft_body ?? detail.body));

  const source: VersionSource<EmailVersionDetail> = {
    list: useCallback(() => emailVersionList(row.email_key), [row.email_key]),
    at: useCallback((v: number) => emailVersionAt(row.email_key, v), [row.email_key]),
    restore: useCallback(async (v: number) => {
      const minted = await restoreEmailVersion(row.email_key, v);
      await load();
      onReloadList();
      return minted;
    }, [row.email_key, load, onReloadList]),
    preview: (d) => (
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Subject</p>
        <p className="text-[13.5px] text-green-900 mb-3">{d.subject}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Body</p>
        <pre className="text-[12px] whitespace-pre-wrap font-mono text-secondary">{d.body}</pre>
      </div>
    ),
    note: (
      <>
        The wording each of these emails had before 2026-08-26 was overwritten and not
        kept — this history starts at the number the template is on today.
      </>
    ),
  };

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <div className="w-full flex items-center gap-2 px-5 py-4">
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 flex items-center justify-between text-left focus-ring rounded">
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-medium text-green-900">{row.title}</span>
              {!row.active && (
                <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-cream-100 text-muted border border-green-800/10">
                  off
                </span>
              )}
              {row.has_unpublished && (
                <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-gold-800/10 text-gold-800 border border-gold-800/25 font-semibold">
                  unpublished changes
                </span>
              )}
            </span>
            <span className="block text-[12px] text-muted mt-0.5 truncate">
              {row.description ?? row.subject}
            </span>
          </span>
          {open ? <ChevronDown size={17} className="text-muted ml-2" /> : <ChevronRight size={17} className="text-muted ml-2" />}
        </button>
        <VersionChip version={row.version} label={row.title} onOpen={() => setVersionsOpen(true)} />
      </div>

      <VersionsModal title={row.title} open={versionsOpen} onClose={() => setVersionsOpen(false)}
        source={source} onChanged={onReloadList} onError={onError} />

      {open && (
        <div className="border-t border-green-800/10 px-5 py-4">
          {detail === null ? <p className="text-sm text-muted">Loading…</p> : (
            <>
              {row.recipient_note && (
                <p className="text-[12.5px] text-muted mb-3">Who gets this: {row.recipient_note}</p>
              )}
              <label className="block mb-3">
                <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">Subject line</span>
                <input className="form-input text-sm w-full" value={subject}
                  onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wide text-muted mb-1">Body</span>
                <textarea className="form-input w-full font-mono text-[12.5px] leading-relaxed"
                  rows={Math.min(28, Math.max(8, body.split('\n').length + 2))}
                  value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <AsyncButton className="btn-primary text-[12.5px] px-3 py-1.5" pendingLabel="Saving…"
                  disabled={!dirty}
                  onClick={async () => {
                    await emailTemplateSaveDraft(row.email_key, subject, body);
                    await load(); onReloadList();
                  }}>
                  Save draft
                </AsyncButton>
                <AsyncButton className="btn-outline-gold text-[12.5px] px-3 py-1.5" pendingLabel="Publishing…"
                  disabled={!row.has_unpublished}
                  onClick={async () => {
                    const res = await emailTemplatePublish(row.email_key);
                    await load(); onReloadList();
                    onError(`Published as v${res.new_version}. The previous wording is retained and still readable in the version list.`);
                  }}>
                  Publish
                </AsyncButton>
                {row.has_unpublished && (
                  <AsyncButton
                    className="text-[12.5px] px-3 py-1.5 rounded-lg border border-green-800/20 text-secondary hover:bg-cream-100/60 focus-ring"
                    pendingLabel="Discarding…"
                    onClick={async () => { await emailTemplateDiscardDraft(row.email_key); await load(); onReloadList(); }}>
                    Discard draft
                  </AsyncButton>
                )}
              </div>
              <p className="text-[11px] text-muted mt-2">
                Saving writes a draft — the emails going out keep their current wording until you
                publish. Publishing mints the next version and retains this one in full.
                {' '}Text in double braces, like <code className="font-mono">{'{{CLIENT.NAME}}'}</code>,
                is filled in when the email is sent.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
