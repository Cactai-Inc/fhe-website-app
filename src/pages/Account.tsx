import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { listMyOrders, upsertMyProfile } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import { TwoFactorSettings } from '../components/auth/TwoFactorSettings';
import type { Order } from '../lib/types';

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'In progress',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Account() {
  useDocumentTitle('Your Account');
  const { profile, user, signOut, refreshProfile, isMember } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Editable profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile]);

  useEffect(() => {
    let active = true;
    listMyOrders()
      .then((o) => active && setOrders(o))
      .catch(() => active && setOrders([]))
      .finally(() => active && setLoadingOrders(false));
    return () => {
      active = false;
    };
  }, []);

  // Members belong in the app — this legacy public-site account page only
  // serves signed-in users WITHOUT an active membership (owner 2026-07-03:
  // "it should be /app/account"). ProtectedRoute waits out auth loading, so
  // isMember is settled by the time we render. After every hook, per the
  // rules of hooks.
  if (isMember) {
    return <Navigate to="/app" replace />;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await upsertMyProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        email: user?.email ?? profile?.email ?? null,
      });
      await refreshProfile();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const greetingName = profile?.first_name || 'rider';

  return (
    <div className="min-h-screen bg-cream pt-28 pb-20">
      <div className="container-site max-w-4xl">
        <div className="flex items-start justify-between mb-10 gap-4">
          <div>
            <p className="eyebrow mb-2">Your account</p>
            <h1 className="heading-section text-green-800">Welcome, {greetingName}.</h1>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring whitespace-nowrap"
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Orders */}
          <div className="lg:col-span-3">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Your activity</h2>
            {loadingOrders ? (
              <p className="body-text text-muted">Loading…</p>
            ) : orders.length === 0 ? (
              <div className="bg-white border border-green-800/10 p-8 text-center">
                <p className="body-text text-sm mb-6">
                  Nothing here yet. When you're ready, choose how you'd like to ride with us.
                </p>
                <Link to="/services" className="btn-outline-gold">
                  Ways to Ride
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/order/${o.id}`}
                    className="bg-white border border-green-800/10 p-5 flex items-center justify-between hover:shadow-md transition-shadow focus-ring"
                  >
                    <div>
                      <p className="text-sm font-sans font-medium text-green-900">
                        Order · {new Date(o.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs font-sans text-muted mt-0.5">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-serif text-green-800">{usd(o.total)}</span>
                      <ArrowRight size={16} className="text-green-800/40" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="lg:col-span-2">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Your details</h2>
            <form onSubmit={saveProfile} className="bg-white border border-green-800/10 p-6">
              <div className="mb-4">
                <label className="form-label" htmlFor="acc_first">First Name</label>
                <input id="acc_first" type="text" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} className="form-input" />
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="acc_last">Last Name</label>
                <input id="acc_last" type="text" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} className="form-input" />
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="acc_phone">Phone</label>
                <input id="acc_phone" type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className="form-input" />
              </div>
              <div className="mb-5">
                <label className="form-label" htmlFor="acc_email">Email</label>
                <input id="acc_email" type="email" value={user?.email ?? ''} disabled
                  className="form-input" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <div aria-live="polite" className="min-h-[1.25rem]">
                {saved && <p className="text-xs text-green-700 mt-2 text-center">Saved.</p>}
              </div>
            </form>

            {/* Security */}
            <div className="mt-6">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Security</h2>
              <TwoFactorSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
