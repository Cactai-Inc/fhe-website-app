// @vitest-environment jsdom
/**
 * TASK-GOOGLEAUTH — unit tests for src/lib/googleLink.ts, the round-trip logic
 * the My Login control depends on: recognising the far side of a Google consent
 * redirect, reading the provider's verdict out of the URL, clearing it so a
 * stale failure cannot re-announce itself, and turning a GoTrue error code into
 * a sentence a member can act on.
 *
 * See google_signin_control.test.tsx for the control that consumes this.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  markGoogleLinkPending, clearGoogleLinkPending, consumeGoogleLinkReturn,
  describeLinkFailure, resetGoogleLinkReturnForTests,
} from '../../src/lib/googleLink';

function at(url: string) {
  window.history.replaceState({}, '', url);
}

beforeEach(() => {
  sessionStorage.clear();
  resetGoogleLinkReturnForTests();
  at('/app/account');
});

describe('consumeGoogleLinkReturn', () => {
  it('reports no return on an ordinary page load', () => {
    expect(consumeGoogleLinkReturn()).toEqual({
      returned: false, errorCode: null, errorDescription: null,
    });
  });

  it('recognises an abandoned attempt from the pending flag alone', () => {
    markGoogleLinkPending();
    const ret = consumeGoogleLinkReturn();
    expect(ret.returned).toBe(true);
    expect(ret.errorCode).toBeNull();
    expect(ret.errorDescription).toBeNull();
  });

  it('reads the provider error out of the hash (the client runs the implicit flow)', () => {
    markGoogleLinkPending();
    at('/app/account#error=server_error&error_code=identity_already_exists'
      + '&error_description=Identity+is+already+linked+to+another+user');
    const ret = consumeGoogleLinkReturn();
    expect(ret.returned).toBe(true);
    expect(ret.errorCode).toBe('identity_already_exists');
    expect(ret.errorDescription).toBe('Identity is already linked to another user');
  });

  it('reads the provider error out of the query string too', () => {
    at('/app/account?error=access_denied&error_code=access_denied&error_description=User+denied');
    const ret = consumeGoogleLinkReturn();
    expect(ret.returned).toBe(true);
    expect(ret.errorCode).toBe('access_denied');
  });

  it('counts a provider error as a return even with no pending flag', () => {
    at('/app/account#error_code=manual_linking_disabled&error_description=Manual+linking+is+disabled');
    expect(consumeGoogleLinkReturn().returned).toBe(true);
  });

  it('strips the error params from the address bar so a refresh cannot repeat them', () => {
    at('/app/account?keep=1#error=server_error&error_code=identity_already_exists&other=x');
    consumeGoogleLinkReturn();
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toContain('other=x');
    expect(window.location.hash).not.toContain('error');
    expect(window.location.pathname).toBe('/app/account');
  });

  it('clears the pending flag, so a later unrelated visit is not a return', () => {
    markGoogleLinkPending();
    consumeGoogleLinkReturn();
    resetGoogleLinkReturnForTests(); // simulate a fresh page load
    expect(consumeGoogleLinkReturn().returned).toBe(false);
  });

  it('is idempotent within a page load — the hub and the card both read the same answer', () => {
    markGoogleLinkPending();
    at('/app/account#error_code=manual_linking_disabled');
    const first = consumeGoogleLinkReturn();
    const second = consumeGoogleLinkReturn();
    expect(second).toEqual(first);
    expect(second.errorCode).toBe('manual_linking_disabled');
  });

  it('clearGoogleLinkPending undoes the mark when the redirect never happened', () => {
    markGoogleLinkPending();
    clearGoogleLinkPending();
    expect(consumeGoogleLinkReturn().returned).toBe(false);
  });
});

describe('describeLinkFailure', () => {
  it('routes the conflict case to staff and never offers to resolve it here', () => {
    const msg = describeLinkFailure('identity_already_exists', 'Identity is already linked to another user');
    expect(msg).toMatch(/already attached to a different account/i);
    expect(msg).toMatch(/office/i);
    expect(msg).toMatch(/nothing on this account has changed/i);
  });

  it('detects the conflict from the description when no code is present', () => {
    const msg = describeLinkFailure(null, 'Identity is already linked to another user');
    expect(msg).toMatch(/already attached to a different account/i);
  });

  it('explains a configuration refusal instead of leaking the provider string', () => {
    const msg = describeLinkFailure('manual_linking_disabled', 'Manual linking is disabled');
    expect(msg).toMatch(/cannot be activated yet/i);
    expect(msg).not.toMatch(/Manual linking is disabled/);
  });

  it('treats a cancelled consent as a non-event', () => {
    const msg = describeLinkFailure('access_denied', 'The user denied the request');
    expect(msg).toMatch(/nothing changed/i);
    expect(msg).toMatch(/email and password still work/i);
  });

  it('falls back to the raw description rather than swallowing an unknown failure', () => {
    const msg = describeLinkFailure('some_new_code', 'Provider is unavailable');
    expect(msg).toContain('Provider is unavailable');
  });

  it('still says something useful with nothing to go on', () => {
    expect(describeLinkFailure(null, null)).toMatch(/could not be activated/i);
  });
});
