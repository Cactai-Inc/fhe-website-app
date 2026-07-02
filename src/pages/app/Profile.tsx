import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { upsertMyProfile } from '../../lib/api';
import { listLinkedProviders, linkOAuthIdentity } from '../../lib/auth';
import { ENABLED_OAUTH_PROVIDERS, OAUTH_LABELS } from '../../lib/authConfig';
import { useDocumentTitle } from '../../lib/hooks';

const RIDING_LEVELS = [
  { value: 'newcomer', label: 'New to riding' },
  { value: 'returning', label: 'Returning rider' },
  { value: 'committed', label: 'Riding regularly' },
  { value: 'experienced', label: 'Experienced' },
];

export default function Profile() {
  useDocumentTitle('Your Profile');
  const { profile, user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [ridingLevel, setRidingLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [linked, setLinked] = useState<string[] | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    listLinkedProviders().then(setLinked).catch(() => setLinked([]));
  }, [user?.id]);

  async function connect(provider: 'google' | 'apple') {
    setLinkError(null);
    const { error } = await linkOAuthIdentity(provider);
    if (error) setLinkError(error); // success = full-page redirect, no state to set
  }

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setPhone(profile?.phone ?? '');
    setBio(profile?.bio ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
    setRidingLevel(profile?.riding_level ?? '');
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await upsertMyProfile({
        display_name: displayName.trim() || null,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        riding_level: ridingLevel || null,
        email: user?.email ?? profile?.email ?? null,
      });
      await refreshProfile();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const initial = (displayName || firstName || 'M').charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-2">Your profile</p>
      <h1 className="heading-section text-green-800 mb-8">How you show up here.</h1>

      <div className="flex items-center gap-4 mb-8">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-green-800 text-white flex items-center justify-center font-serif text-2xl">
            {initial}
          </div>
        )}
        <div>
          <p className="font-serif text-green-800 text-lg">{displayName || firstName || 'Member'}</p>
          <p className="text-xs text-muted">{user?.email}</p>
        </div>
      </div>

      <div className="bg-white border border-green-800/10 p-6 mb-6">
        <h2 className="font-serif text-green-800 text-lg mb-1">Sign-in methods</h2>
        <p className="text-xs text-muted mb-4">
          Connect Google so you can sign in with one tap — your account and history stay the same.
        </p>
        {linkError && <p role="alert" className="form-error mb-3">{linkError}</p>}
        <ul className="space-y-2 text-sm font-sans">
          {linked?.includes('email') && (
            <li className="text-green-900">Email &amp; password <span className="text-muted">— connected</span></li>
          )}
          {ENABLED_OAUTH_PROVIDERS.map((p) =>
            linked === null ? null : linked.includes(p) ? (
              <li key={p} className="text-green-900">
                {p.charAt(0).toUpperCase() + p.slice(1)} <span className="text-muted">— connected</span>
              </li>
            ) : (
              <li key={p}>
                <button type="button" onClick={() => connect(p)} className="btn-outline-gold text-sm">
                  Connect {OAUTH_LABELS[p].replace('Continue with ', '')}
                </button>
              </li>
            ),
          )}
        </ul>
      </div>

      <form onSubmit={save} className="bg-white border border-green-800/10 p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="display_name">Display name</label>
            <input id="display_name" className="form-input" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} placeholder="How others see you" />
          </div>
          <div>
            <label className="form-label" htmlFor="first_name">First name</label>
            <input id="first_name" className="form-input" value={firstName}
              onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label className="form-label" htmlFor="last_name">Last name</label>
            <input id="last_name" className="form-input" value={lastName}
              onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
          <div>
            <label className="form-label" htmlFor="phone">Phone</label>
            <input id="phone" type="tel" className="form-input" value={phone}
              onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </div>
          <div>
            <label className="form-label" htmlFor="riding_level">Riding level</label>
            <select id="riding_level" className="form-input" value={ridingLevel}
              onChange={(e) => setRidingLevel(e.target.value)}>
              <option value="">Prefer not to say</option>
              {RIDING_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="avatar_url">Avatar image URL</label>
            <input id="avatar_url" className="form-input" value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
            <p className="form-hint mt-1">Paste a link to a photo. (Uploads coming with the resource library.)</p>
          </div>
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="bio">About you</label>
            <textarea id="bio" rows={4} className="form-input resize-none" value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line or two — what brought you to riding, what you're working toward." />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary mt-6 w-full justify-center">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        <div aria-live="polite" className="min-h-[1.25rem]">
          {saved && <p className="text-xs text-green-700 mt-2 text-center">Saved.</p>}
        </div>
      </form>
    </div>
  );
}
