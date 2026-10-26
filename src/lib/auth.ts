/**
 * Single source of truth for authentication operations.
 *
 * Every call into `supabase.auth` lives here — password sign-in/up, Google OAuth,
 * password reset, and optional TOTP two-factor — so there is exactly one place to
 * change auth behavior and it propagates everywhere (AuthContext + every page).
 *
 * Functions return a normalized `{ error: string | null }` (plus data where the
 * caller needs it, e.g. the TOTP QR code) so the UI never reaches into raw
 * Supabase error shapes.
 */
import { supabase } from './supabase';
import type { OAuthProvider } from './authConfig';

/** Absolute URL for an app path; safe to call only in the browser. */
function appUrl(path: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path}`;
}

export interface Result {
  error: string | null;
}

// ── Password ─────────────────────────────────────────────────────────────────

export async function signInWithPassword(email: string, password: string): Promise<Result> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUpWithPassword(email: string, password: string): Promise<Result> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl('/account') },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ── OAuth (Google, Apple) ────────────────────────────────────────────────────

/**
 * Begin OAuth sign-in with a provider. Triggers a full-page redirect to the
 * provider and back to `redirectTo` (default /account); the AuthContext
 * onAuthStateChange picks up the resulting session on return. Each provider must be
 * configured in the Supabase dashboard (owner-side go-live step) and enabled in
 * authConfig.ts.
 */
export async function signInWithOAuth(provider: OAuthProvider, redirectTo = '/account'): Promise<Result> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: appUrl(redirectTo) },
  });
  return { error: error?.message ?? null };
}

export const signInWithGoogle = (redirectTo = '/account') => signInWithOAuth('google', redirectTo);

export interface LinkedIdentity {
  /** 'email' (a password) or an OAuth provider such as 'google'. */
  provider: string;
  /**
   * The address the provider identified them by. This CAN differ from the
   * account's sign-in email — linking does not require them to match and does
   * not change the primary email — which is exactly why it is surfaced.
   */
  email: string | null;
  linkedAt: string | null;
}

/**
 * Identities attached to the signed-in account, as the SERVER sees them.
 * `getUserIdentities()` runs through `getUser()`, which is a network read of
 * `GET /user` rather than a projection of the cached session — so this is the
 * authority on whether a link actually landed, and the only thing allowed to
 * confirm one. Never infer a linked provider from the email domain.
 */
export async function listLinkedIdentities(): Promise<LinkedIdentity[]> {
  const { data } = await supabase.auth.getUserIdentities();
  return (data?.identities ?? []).map((i) => ({
    provider: i.provider,
    email: typeof i.identity_data?.email === 'string' ? i.identity_data.email : null,
    linkedAt: i.created_at ?? null,
  }));
}

/** Identities already linked to the signed-in user (e.g. ['email','google']). */
export async function listLinkedProviders(): Promise<string[]> {
  return (await listLinkedIdentities()).map((i) => i.provider);
}

export interface LinkResult extends Result {
  /**
   * GoTrue error code when the server refused *before* any redirect, e.g.
   * `manual_linking_disabled`. `linkIdentity()` fetches the authorize URL over
   * the wire first and only then calls `window.location.assign`, so a
   * configuration refusal comes back here synchronously and never reaches Google.
   */
  code: string | null;
}

/**
 * Attach an OAuth identity to the CURRENT signed-in account (explicit linking —
 * works regardless of email-confirmation state, unlike sign-in auto-linking).
 * Nothing is migrated and no account is created: the same `user_id`, contact and
 * documents simply gain a second way in, and the password keeps working.
 *
 * Redirects to the provider and back; requires manual linking to be enabled in
 * Supabase Auth settings — see `LinkResult.code`.
 */
export async function linkOAuthIdentity(provider: OAuthProvider, redirectTo = '/app/account'): Promise<LinkResult> {
  const { error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: appUrl(redirectTo) },
  });
  return { error: error?.message ?? null, code: error?.code ?? null };
}
export const signInWithApple = (redirectTo = '/account') => signInWithOAuth('apple', redirectTo);

// ── Password reset ───────────────────────────────────────────────────────────

/** Email the user a recovery link that lands on /reset-password.
 *
 * ⚠️ FIX ROUND 2d — ONE RECOVERY PATH. This posts to /api/account-reset, the same
 * endpoint the staff reset action uses, so staff and client send the identical
 * recovery email to the same landing. The endpoint answers the same neutral
 * { ok: true } whether or not the account exists, so a failure here is only a
 * network/transport fault — never a signal about the address. */
export async function sendPasswordReset(email: string): Promise<Result> {
  try {
    const res = await fetch('/api/account-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return { error: 'Could not send the reset email. Please try again.' };
    return { error: null };
  } catch {
    return { error: 'Could not reach the server. Please try again.' };
  }
}

/** ⚠️ FIX ROUND 2d — classify a failed login. After a wrong password, the login
 *  form asks whether the email matches an account at all: if it does, offer a
 *  reset; if it does not, send them to account recovery (never an automated
 *  reset). Returns {exists} — defaults to exists:true on any error so a transient
 *  fault never routes a real user to the wrong path. */
export async function classifyLoginEmail(email: string): Promise<{ exists: boolean }> {
  try {
    const res = await fetch('/api/account-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, classify: true }),
    });
    if (!res.ok) return { exists: true };
    const data = (await res.json().catch(() => null)) as { exists?: boolean } | null;
    return { exists: data?.exists !== false };
  } catch {
    return { exists: true };
  }
}

/** Set a new password for the recovery session created by the reset link. */
export async function updatePassword(password: string): Promise<Result> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

// ── Two-factor (TOTP) — optional, user-managed ───────────────────────────────

export interface TotpEnrollment {
  factorId: string;
  /** otpauth:// URI for manual entry. */
  uri: string;
  /** SVG QR code for the authenticator app. */
  qrSvg: string;
  error: string | null;
}

export async function listMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  return {
    totp: data?.totp ?? [],
    // a factor is usable once verified
    hasVerifiedTotp: (data?.totp ?? []).some((f) => f.status === 'verified'),
    error: error?.message ?? null,
  };
}

/** Begin TOTP enrollment; returns a QR code to scan, then call verifyTotpEnrollment. */
export async function enrollTotp(friendlyName = 'Authenticator'): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  return {
    factorId: data?.id ?? '',
    uri: data?.totp?.uri ?? '',
    qrSvg: data?.totp?.qr_code ?? '',
    error: error?.message ?? null,
  };
}

/** Confirm a freshly enrolled factor with the 6-digit code from the app. */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<Result> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return { error: challenge.error.message };
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  return { error: error?.message ?? null };
}

/** Turn 2FA off by removing a factor. */
export async function unenrollTotp(factorId: string): Promise<Result> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return { error: error?.message ?? null };
}

/**
 * After a password sign-in, decide whether a 2FA code is still required. Supabase
 * reports the current vs. next assurance level; if they differ, the user has a
 * verified factor and must complete a challenge to reach aal2.
 */
export async function needsMfaChallenge(): Promise<{ required: boolean; factorId: string | null }> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const required = !!data && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel;
  if (!required) return { required: false, factorId: null };
  const factors = await supabase.auth.mfa.listFactors();
  const verified = (factors.data?.totp ?? []).find((f) => f.status === 'verified');
  return { required: true, factorId: verified?.id ?? null };
}

/** Complete the login-time 2FA challenge. */
export async function submitMfaChallenge(factorId: string, code: string): Promise<Result> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return { error: error?.message ?? null };
}
