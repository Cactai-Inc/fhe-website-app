/**
 * Category 2 — Auth ops unit test. Mocks the Supabase client and proves lib/auth
 * (the single home for supabase.auth calls) wires each operation correctly:
 * password, Google OAuth, reset, and the TOTP 2FA enroll/verify/challenge flow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before vi.mock is hoisted, so the factory can reference `m`.
const m = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  mfa: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
    unenroll: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({ supabase: { auth: m } }));

import * as auth from './auth';

beforeEach(() => {
  vi.clearAllMocks();
  m.signInWithPassword.mockResolvedValue({ error: null });
  m.signUp.mockResolvedValue({ error: null });
  m.signInWithOAuth.mockResolvedValue({ error: null });
  m.resetPasswordForEmail.mockResolvedValue({ error: null });
  m.updateUser.mockResolvedValue({ error: null });
  m.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null });
  m.mfa.enroll.mockResolvedValue({ data: { id: 'f1', totp: { uri: 'otpauth://totp/x', qr_code: '<svg/>' } }, error: null });
  m.mfa.challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
  m.mfa.verify.mockResolvedValue({ error: null });
  m.mfa.unenroll.mockResolvedValue({ error: null });
  m.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' } });
  m.mfa.challengeAndVerify.mockResolvedValue({ error: null });
});

describe('password', () => {
  it('signInWithPassword passes credentials and normalizes the result', async () => {
    const r = await auth.signInWithPassword('a@b.com', 'pw');
    expect(m.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    expect(r).toEqual({ error: null });
  });

  it('surfaces a supabase error message', async () => {
    m.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    expect(await auth.signInWithPassword('a@b.com', 'x')).toEqual({ error: 'Invalid login credentials' });
  });
});

describe('google + reset', () => {
  it('signInWithGoogle requests the google provider', async () => {
    await auth.signInWithGoogle('/account');
    expect(m.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
  });

  it('sendPasswordReset targets /reset-password', async () => {
    await auth.sendPasswordReset('a@b.com');
    const [email, opts] = m.resetPasswordForEmail.mock.calls[0];
    expect(email).toBe('a@b.com');
    expect(opts.redirectTo).toContain('/reset-password');
  });

  it('updatePassword calls updateUser', async () => {
    await auth.updatePassword('newpw');
    expect(m.updateUser).toHaveBeenCalledWith({ password: 'newpw' });
  });
});

describe('totp 2fa', () => {
  it('enrollTotp returns the factor id, uri, and qr', async () => {
    const e = await auth.enrollTotp();
    expect(e).toMatchObject({ factorId: 'f1', uri: 'otpauth://totp/x', qrSvg: '<svg/>', error: null });
  });

  it('verifyTotpEnrollment challenges then verifies with the challenge id', async () => {
    await auth.verifyTotpEnrollment('f1', '123456');
    expect(m.mfa.challenge).toHaveBeenCalledWith({ factorId: 'f1' });
    expect(m.mfa.verify).toHaveBeenCalledWith({ factorId: 'f1', challengeId: 'c1', code: '123456' });
  });

  it('needsMfaChallenge detects the aal1→aal2 gap and finds the verified factor', async () => {
    const r = await auth.needsMfaChallenge();
    expect(r).toEqual({ required: true, factorId: 'f1' });
  });

  it('needsMfaChallenge is false when already at aal2', async () => {
    m.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' } });
    expect(await auth.needsMfaChallenge()).toEqual({ required: false, factorId: null });
  });

  it('submitMfaChallenge completes the login-time challenge', async () => {
    await auth.submitMfaChallenge('f1', '654321');
    expect(m.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '654321' });
  });

  it('listMfaFactors flags a verified factor', async () => {
    const f = await auth.listMfaFactors();
    expect(f.hasVerifiedTotp).toBe(true);
  });
});
