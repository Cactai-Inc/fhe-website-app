// @vitest-environment jsdom
/**
 * TASK-WALLRETURN — unit tests for src/lib/wallReturn.ts, the pure
 * capture/consume/validate logic the AppLayout + Onboarding integration
 * relies on (see wallreturn_applayout.test.tsx and
 * wallreturn_onboarding.test.tsx for the integration coverage).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSafeAppDestination, captureWallReturnDestination, consumeWallReturnDestination,
} from '../../src/lib/wallReturn';

beforeEach(() => {
  sessionStorage.clear();
});

describe('isSafeAppDestination', () => {
  it('accepts a plain internal /app/* path', () => {
    expect(isSafeAppDestination('/app/contracts/abc-123')).toBe(true);
  });

  it('accepts an internal /app/* path with a query string', () => {
    expect(isSafeAppDestination('/app/account?section=stable')).toBe(true);
  });

  it.each([
    ['an absolute external URL', 'https://evil.example.com/phish'],
    ['a scheme-relative external URL', 'http://evil.example.com/app/x'],
    ['a protocol-relative path (open-redirect classic)', '//evil.example.com/app/x'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a bare root path', '/'],
    ['a non-/app path', '/activate?token=abc'],
    ['empty string', ''],
    ['whitespace-smuggled scheme', ' https://evil.example.com'],
    ['the onboarding route itself (no self-loop)', '/app/onboarding'],
    ['onboarding with a query string', '/app/onboarding?x=1'],
    ['onboarding as a path prefix', '/app/onboarding/sub'],
  ])('rejects %s (%s)', (_label, value) => {
    expect(isSafeAppDestination(value)).toBe(false);
  });
});

describe('captureWallReturnDestination + consumeWallReturnDestination', () => {
  it('round-trips a valid destination', () => {
    captureWallReturnDestination('/app/contracts/abc-123', '');
    expect(consumeWallReturnDestination()).toBe('/app/contracts/abc-123');
  });

  it('round-trips a valid destination with a query string', () => {
    captureWallReturnDestination('/app/account', '?section=stable');
    expect(consumeWallReturnDestination()).toBe('/app/account?section=stable');
  });

  it('does not capture an unsafe destination in the first place', () => {
    captureWallReturnDestination('/activate', '?token=abc');
    expect(consumeWallReturnDestination()).toBeNull();
  });

  it('consumes exactly once — a second read returns null', () => {
    captureWallReturnDestination('/app/contracts/abc-123', '');
    expect(consumeWallReturnDestination()).toBe('/app/contracts/abc-123');
    expect(consumeWallReturnDestination()).toBeNull();
  });

  it('a later, unrelated capture is unaffected by an earlier consume', () => {
    captureWallReturnDestination('/app/contracts/abc-123', '');
    expect(consumeWallReturnDestination()).toBe('/app/contracts/abc-123');
    // simulates a fresh, later interception — must not resurrect the old value
    captureWallReturnDestination('/app/documents', '');
    expect(consumeWallReturnDestination()).toBe('/app/documents');
  });

  it('returns null and consumes nothing when storage is empty', () => {
    expect(consumeWallReturnDestination()).toBeNull();
  });

  it('rejects a tampered off-origin value found in storage at read time', () => {
    sessionStorage.setItem('fhe.wallReturnTo', 'https://evil.example.com/phish');
    expect(consumeWallReturnDestination()).toBeNull();
    // still consumed (removed) even though rejected — no stale leftover
    expect(sessionStorage.getItem('fhe.wallReturnTo')).toBeNull();
  });

  it('a fresh capture overwrites whatever was captured before it', () => {
    captureWallReturnDestination('/app/documents', '');
    captureWallReturnDestination('/app/contracts/xyz-999', '');
    expect(consumeWallReturnDestination()).toBe('/app/contracts/xyz-999');
  });
});
