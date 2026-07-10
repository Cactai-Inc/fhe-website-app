import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  adminCreateClient, setContactRequiredDocuments, categoryDocumentDefaults,
  CLIENT_CATEGORIES, type CategoryDocDefault,
} from '../../../lib/admin';

/**
 * NEW CLIENT (/app/ops/accounts/new) — creates the client RECORD, not a login.
 * Provision-first order of operations (owner-specified):
 *   1. create the account here (name, email, client categories — multi-select),
 *   2. create whatever pertains to them (contract, engagement, billing) and
 *      link it — the new client is a pickable contact everywhere,
 *   3. back on their account page, review the associated items, THEN send the
 *      invitation (expirable, resendable; 48-hour claim window when a start
 *      date was agreed).
 * Staff account creation lives on Team & access — not here.
 */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="form-label">{label}</span>
      {children}
    </div>
  );
}

export default function AccountInvitePage() {
  useDocumentTitle('New client');
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  const [docChecked, setDocChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
  }, []);

  // every known template (deduped), with which categories suggest it
  const templates = useMemo(() => {
    const m = new Map<string, { title: string; categories: string[] }>();
    for (const d of defaults) {
      const t = m.get(d.template_key) ?? { title: d.title, categories: [] };
      t.categories.push(d.category);
      m.set(d.template_key, t);
    }
    return Array.from(m.entries()).map(([key, v]) => ({ key, ...v }));
  }, [defaults]);

  function toggleCategory(c: string) {
    setCategories((prev) => {
      const on = !prev.includes(c);
      const next = on ? [...prev, c] : prev.filter((x) => x !== c);
      // prefill: enabling a category checks its suggested documents;
      // disabling never unchecks (the admin's explicit picks stand)
      if (on) {
        setDocChecked((old) => {
          const s2 = new Set(old);
          defaults.filter((d) => d.category === c).forEach((d) => s2.add(d.template_key));
          return s2;
        });
      }
      return next;
    });
  }

  function toggleDoc(key: string) {
    setDocChecked((old) => {
      const s2 = new Set(old);
      if (s2.has(key)) s2.delete(key); else s2.add(key);
      return s2;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null);
    try {
      const r = await adminCreateClient({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        categories,
      });
      // the explicit first-login paperwork assignment (what you checked)
      await setContactRequiredDocuments(r.contact_id, Array.from(docChecked));
      // straight to their account page — attach items there, invite last
      navigate(`/app/admin?open=${r.contact_id}`);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not create the client.'));
      setWorking(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link to="/app/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Clients
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">New client</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Creates the account record only — no invitation yet. Attach their contracts,
        engagements, and billing first; send the invite from their account page when
        everything's in place.
      </p>

      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name">
            <input className="form-input" required value={firstName}
              onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </Field>
          <Field label="Last name">
            <input className="form-input" required value={lastName}
              onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </Field>
        </div>
        <Field label="Email">
          <input type="email" required className="form-input" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
        </Field>
        <Field label="Phone (optional)">
          <input className="form-input" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
        </Field>

        <div className="mb-6">
          <span className="form-label">Client categories</span>
          <p className="text-sm text-muted mb-2.5">What kind of client they are — check everything that applies.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CLIENT_CATEGORIES.map((c) => (
              <label key={c}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border cursor-pointer text-[15px] ${
                  categories.includes(c)
                    ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                    : 'border-green-800/15 text-secondary hover:bg-green-50/50'
                }`}>
                <input type="checkbox" className="accent-green-700 w-[18px] h-[18px]"
                  checked={categories.includes(c)} onChange={() => toggleCategory(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <span className="form-label">First-login paperwork</span>
          <p className="text-sm text-muted mb-2.5">
            Exactly what they'll be asked to review and sign when they activate the
            account. Category picks prefill this — you decide the final set, and the
            invitation email lists it.
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {templates.map((t) => (
              <label key={t.key}
                className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border cursor-pointer ${
                  docChecked.has(t.key)
                    ? 'border-green-700 bg-green-50'
                    : 'border-green-800/15 hover:bg-green-50/50'
                }`}>
                <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
                  checked={docChecked.has(t.key)} onChange={() => toggleDoc(t.key)} />
                <span className="min-w-0">
                  <span className={`block text-[14px] leading-snug ${docChecked.has(t.key) ? 'text-green-900 font-medium' : 'text-secondary'}`}>{t.title}</span>
                  <span className="block text-[11.5px] text-muted mt-0.5">Suggested for {t.categories.join(', ')}</span>
                </span>
              </label>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted">Loading document catalog…</p>}
          </div>
          <p className="text-xs text-muted mt-2">
            {docChecked.size === 0 ? 'No paperwork assigned — they land straight on their dashboard.'
              : `${docChecked.size} document${docChecked.size === 1 ? '' : 's'} assigned for first login.`}
          </p>
        </div>

        <button type="submit" disabled={working || !email.trim() || !firstName.trim() || !lastName.trim()}
          className="btn-primary">
          {working ? 'Creating…' : 'Create client account'}
        </button>
        {error && <p className="form-error mt-4" role="alert">{error}</p>}
      </form>
    </div>
  );
}
