import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { useDocumentTitle } from '../../../lib/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { adminSendInvitation } from '../../../lib/admin';
import { fetchOfferings } from '../../../lib/api';
import type { Offering } from '../../../lib/types';

/**
 * NEW ACCOUNT (/app/ops/accounts/new) — one provisioning point for every
 * account type. Client invites can carry a purchase (offering provisioning →
 * onboarding with paperwork ready); instructor/admin invites carry the role,
 * applied when the invitation is redeemed. Instructors can invite clients;
 * only admins see the staff types.
 */

const PAYMENT_METHODS = ['Zelle', 'Cash', 'Card', 'Other'];
type AccountType = 'USER' | 'MANAGER' | 'ADMIN';
const TYPES: { id: AccountType; label: string; blurb: string }[] = [
  { id: 'USER', label: 'Client', blurb: 'A customer account — can carry a purchase so onboarding starts with the paperwork ready.' },
  { id: 'MANAGER', label: 'Instructor', blurb: 'Servicing staff — lessons, intake, client support. Admin surfaces only by grant.' },
  { id: 'ADMIN', label: 'Admin', blurb: 'Full management of this business — accounts, catalog, billing, content.' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="form-label">{label}</span>
      {children}
    </div>
  );
}

function formatTierPrice(amount: number | null): string {
  if (amount == null) return '';
  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AccountInvitePage() {
  useDocumentTitle('New account');
  const { isAdmin } = useAuth();
  const [type, setType] = useState<AccountType>('USER');
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('7');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Zelle');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<{ url: string; emailed: boolean; offeringLabel?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.horse_included !== null)))
      .catch(() => setOfferings([]));
  }, []);

  const isClient = type === 'USER';
  const provisioning = isClient && offeringId !== '';
  const visibleTypes = TYPES.filter((t) => isAdmin || t.id === 'USER');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null); setResult(null);
    try {
      const r = await adminSendInvitation({
        email: email.trim(),
        expiresInDays: Number(days) || 7,
        ...(type !== 'USER' ? { role: type } : {}),
        ...(provisioning
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              offeringId,
              markPaid,
              ...(markPaid ? { paymentMethod } : {}),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            }
          : {}),
      });
      setResult({ url: r.registerUrl, emailed: r.emailed, offeringLabel: r.offeringLabel });
      setEmail(''); setFirstName(''); setLastName('');
      setOfferingId(''); setMarkPaid(false); setNotes('');
    } catch (err) {
      setError(toErrorMessage(err, 'Could not send invitation.'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-xl">
      <Link to="/app/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Clients
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">New account</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Send a registration invitation. The account type is applied the moment they register.
      </p>

      {/* account type — buttons on desktop, dropdown on mobile */}
      <div className="hidden sm:flex gap-1.5 mb-2">
        {visibleTypes.map((t) => (
          <button key={t.id} type="button" onClick={() => { setType(t.id); setOfferingId(''); }}
            className={`px-4 py-2 rounded-full text-sm font-sans focus-ring ${
              type === t.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <select className="form-input sm:hidden mb-2" value={type} aria-label="Account type"
        onChange={(e) => { setType(e.target.value as AccountType); setOfferingId(''); }}>
        {visibleTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <p className="text-xs text-muted mb-6">{TYPES.find((t) => t.id === type)?.blurb}</p>

      <form onSubmit={submit}>
        <Field label="Email">
          <input type="email" required className="form-input" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={provisioning ? 'First name' : 'First name (optional)'}>
            <input className="form-input" required={provisioning} value={firstName}
              onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </Field>
          <Field label={provisioning ? 'Last name' : 'Last name (optional)'}>
            <input className="form-input" required={provisioning} value={lastName}
              onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </Field>
        </div>

        {isClient && (
          <>
            <Field label="What did they buy?">
              <select className="form-input" value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
                <option value="">No purchase (plain invite)</option>
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {formatTierPrice(o.price_amount)}
                  </option>
                ))}
              </select>
            </Field>
            {provisioning && (
              <>
                <label className="flex items-center gap-2 mb-4 text-sm text-secondary">
                  <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="accent-green-800" />
                  Already paid
                </label>
                {markPaid && (
                  <Field label="Payment method">
                    <select className="form-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Notes (optional)">
                  <textarea rows={2} className="form-input resize-none" value={notes}
                    onChange={(e) => setNotes(e.target.value)} placeholder="e.g. paid via Zelle 7/1, starts next week" />
                </Field>
              </>
            )}
          </>
        )}

        <Field label="Expires in (days)">
          <input type="number" min={1} className="form-input" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <button
          type="submit"
          disabled={working || !email.trim() || (provisioning && (!firstName.trim() || !lastName.trim()))}
          className="btn-primary"
        >
          {working ? 'Sending…' : 'Create & send invitation'}
        </button>

        {error && <p className="form-error mt-4" role="alert">{error}</p>}
        {result && (
          <div className="bg-green-50 border border-green-200 p-4 mt-5 text-sm">
            <p className="text-green-800 mb-2">
              {result.offeringLabel ? `${result.offeringLabel} provisioned — invitation created` : 'Invitation created'}
              {result.emailed ? ' and emailed.' : '. (Email provider not configured — copy the link below.)'}
            </p>
            <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2">{result.url}</code>
          </div>
        )}
      </form>
    </div>
  );
}
