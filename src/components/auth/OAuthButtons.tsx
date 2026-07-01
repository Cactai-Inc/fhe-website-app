/**
 * OAuth sign-in buttons — renders one button per provider enabled in authConfig.ts
 * (Google now, Apple when activated). One home for the OAuth affordance, used by
 * Login and the invite-activation screen. Presentational: the caller wires
 * onProvider to signInWithOAuth so it stays reusable and testable.
 */
import { ENABLED_OAUTH_PROVIDERS, OAUTH_LABELS, type OAuthProvider } from '../../lib/authConfig';

export function OAuthButtons({
  onProvider,
  loadingProvider,
}: {
  onProvider: (provider: OAuthProvider) => void;
  loadingProvider?: OAuthProvider | null;
}) {
  if (ENABLED_OAUTH_PROVIDERS.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {ENABLED_OAUTH_PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => onProvider(provider)}
          disabled={!!loadingProvider}
          className="w-full inline-flex items-center justify-center gap-3 border border-green-800/20 bg-white px-5 py-3 font-sans text-sm font-medium text-green-900 transition-colors hover:bg-cream focus-ring disabled:opacity-60"
        >
          <ProviderMark provider={provider} />
          {loadingProvider === provider ? 'Redirecting…' : OAUTH_LABELS[provider]}
        </button>
      ))}
    </div>
  );
}

function ProviderMark({ provider }: { provider: OAuthProvider }) {
  return provider === 'google' ? <GoogleG /> : <AppleMark />;
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="#000">
      <path d="M13.3 9.6c0-2 1.6-2.95 1.7-3-.93-1.36-2.37-1.55-2.88-1.57-1.23-.12-2.4.72-3.02.72-.62 0-1.58-.7-2.6-.68-1.34.02-2.57.78-3.26 1.97-1.39 2.41-.36 5.98 1 7.94.66.96 1.45 2.03 2.48 1.99.99-.04 1.37-.64 2.57-.64 1.2 0 1.54.64 2.6.62 1.07-.02 1.75-.97 2.4-1.94.76-1.11 1.07-2.19 1.08-2.24-.02-.01-2.07-.79-2.09-3.14ZM11.3 3.73c.55-.66.92-1.58.82-2.5-.79.03-1.75.53-2.32 1.19-.51.58-.96 1.51-.84 2.4.88.07 1.78-.45 2.34-1.09Z" />
    </svg>
  );
}
