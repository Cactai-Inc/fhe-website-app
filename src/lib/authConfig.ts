/**
 * Single source of truth for which sign-in methods are live.
 *
 * The product is OAuth-first: most users tap "Continue with Google" (or Apple) and
 * they're in — no password to remember or reset. Email/password stays as a labeled
 * fallback for the few who need it.
 *
 * Flip a provider to `true` here the moment its OAuth app is configured in the
 * Supabase dashboard — every auth screen updates from this one place. Apple is
 * built and ready; it's off until "Sign in with Apple" is activated.
 */
export type OAuthProvider = 'google' | 'apple';

export const OAUTH_PROVIDERS: Record<OAuthProvider, boolean> = {
  google: true,
  apple: false, // ← flip to true once Sign in with Apple is configured in Supabase
};

export const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
};

export const ENABLED_OAUTH_PROVIDERS = (Object.keys(OAUTH_PROVIDERS) as OAuthProvider[])
  .filter((p) => OAUTH_PROVIDERS[p]);

/** Whether to offer the email/password fallback at all (kept on for the ~10%). */
export const PASSWORD_AUTH_ENABLED = true;
