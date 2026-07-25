import { describe, it, expect } from 'vitest';
import { authMethodForEmail, emailDomain } from './emailAuthMethod';

describe('emailDomain', () => {
  it('extracts the lowercased domain', () => {
    expect(emailDomain('Jane@Example.COM')).toBe('example.com');
  });
  it('returns null for unparseable / dotless', () => {
    expect(emailDomain('')).toBeNull();
    expect(emailDomain('nope')).toBeNull();
    expect(emailDomain('a@localhost')).toBeNull();
    expect(emailDomain('a@')).toBeNull();
  });
});

describe('authMethodForEmail', () => {
  it('gmail / googlemail → google only', () => {
    expect(authMethodForEmail('a@gmail.com')).toBe('google');
    expect(authMethodForEmail('A@GOOGLEMAIL.COM')).toBe('google');
  });
  it('known non-Google consumer mailboxes → password only', () => {
    for (const e of ['a@hotmail.com', 'b@outlook.com', 'c@yahoo.com', 'd@icloud.com', 'e@proton.me', 'f@att.net']) {
      expect(authMethodForEmail(e)).toBe('password');
    }
  });
  it('ambiguous custom domain → both', () => {
    expect(authMethodForEmail('jane@herbusiness.com')).toBe('both');
    expect(authMethodForEmail('owner@frenchheritageequestrian.com')).toBe('both');
  });
  it('empty / unparseable → both (never strand the user)', () => {
    expect(authMethodForEmail('')).toBe('both');
    expect(authMethodForEmail(null)).toBe('both');
    expect(authMethodForEmail('garbage')).toBe('both');
  });
});
