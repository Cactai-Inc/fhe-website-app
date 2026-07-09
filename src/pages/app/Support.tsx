import { useState } from 'react';
import { LifeBuoy, CheckCircle2 } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { submitSupportRequest } from '../../lib/support';

/**
 * MEMBER SUPPORT (Slice 5, /app/support) — the member's support entry point. They
 * describe an issue; it lands in the admin support inbox (/app/ops/support). The
 * avatar menu links here.
 */
export default function Support() {
  useDocumentTitle('Support');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { setError('A subject and a message are required.'); return; }
    setBusy(true); setError(null);
    try {
      await submitSupportRequest(subject.trim(), body.trim());
      setDone(true);
    } catch {
      setError('We could not send your request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg">
        <div className="bg-white border border-green-800/10 rounded-lg p-8 text-center">
          <CheckCircle2 size={40} className="text-green-800 mx-auto mb-3" />
          <h1 className="font-serif text-xl text-green-800 mb-2">We've got it.</h1>
          <p className="body-text text-sm text-muted">
            Thanks — your message reached us and we'll follow up soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <p className="eyebrow mb-2">Support</p>
      <h1 className="heading-section text-green-800 mb-6 flex items-center gap-2">
        <LifeBuoy size={22} /> How can we help?
      </h1>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="text-sm font-sans text-secondary">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="form-input mt-1" required />
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="form-input mt-1" required />
        </label>
        <button type="submit" disabled={busy} className="btn-primary self-start">
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
