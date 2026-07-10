import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { useDocumentTitle } from '../../../lib/hooks';
import { adminCreateClient, CLIENT_CATEGORIES } from '../../../lib/admin';

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
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  function toggleCategory(c: string) {
    setCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
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
      // straight to their account page — attach items there, invite last
      navigate(`/app/admin?open=${r.contact_id}`);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not create the client.'));
      setWorking(false);
    }
  }

  return (
    <div className="max-w-xl">
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
          <p className="text-xs text-muted mb-2">What kind of client they are — pick everything that applies.</p>
          <div className="flex flex-wrap gap-1.5">
            {CLIENT_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => toggleCategory(c)}
                aria-pressed={categories.includes(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
                  categories.includes(c)
                    ? 'bg-green-800 text-white'
                    : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
                }`}>
                {c}
              </button>
            ))}
          </div>
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
