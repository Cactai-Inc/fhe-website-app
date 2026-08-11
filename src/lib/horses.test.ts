import { describe, it, expect } from 'vitest';
import { DbError, errorText, scrubHorseSentinels, HORSE_SENTINEL_UNSAFE_KEYS } from './horses';

/* The two seams that let a real owner sit blocked in onboarding on 2026-08-10:
 * the database's message never reached the screen, and the 'N/A' sentinel was
 * sent to columns that cannot hold it. */

describe('DbError / errorText', () => {
  it('reads a RAW PostgREST object — which is what supabase actually returns', () => {
    // postgrest-js builds this with JSON.parse(body); it is NOT an Error, so
    // `e instanceof Error` was false and the message was thrown away.
    const raw = {
      message: 'invalid input syntax for type date: "N/A"',
      details: null, hint: null, code: '22007',
    };
    expect(raw instanceof Error).toBe(false);
    const e = new DbError(raw, 'Saving the horse record');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain('invalid input syntax for type date');
    expect(e.message).toContain('[22007]');
    expect(e.code).toBe('22007');
  });

  it('carries details and hint when PostgREST sends them', () => {
    const e = new DbError(
      { message: 'violates foreign key constraint "horses_breed_fkey"', details: 'Key (breed)=(Andalusian) is not present in table "horse_breeds".', hint: 'Pick a listed breed', code: '23503' },
      'Saving the horse record',
    );
    expect(e.message).toContain('Key (breed)=(Andalusian)');
    expect(e.message).toContain('Hint: Pick a listed breed');
  });

  it('falls back only when there is genuinely nothing to say', () => {
    expect(errorText({}, 'Could not save the horse record.')).toBe('Could not save the horse record.');
    expect(errorText(null, 'Could not save the horse record.')).toBe('Could not save the horse record.');
    expect(errorText(new Error('boom'), 'fallback')).toBe('boom');
    expect(errorText({ message: 'no org context', code: 'P0001' }, 'fallback'))
      .toBe('no org context [P0001]');
  });
});

describe('scrubHorseSentinels', () => {
  it('clears N/A on every column that cannot store it', () => {
    const payload = Object.fromEntries(HORSE_SENTINEL_UNSAFE_KEYS.map((k) => [k, 'N/A']));
    const out = scrubHorseSentinels(payload);
    for (const k of HORSE_SENTINEL_UNSAFE_KEYS) expect(out[k as string]).toBe('');
  });

  it('leaves N/A alone on the text columns, where it is the answer', () => {
    const out = scrubHorseSentinels({
      microchip_id: 'N/A', registration_number: 'N/A', known_conditions: 'N/A',
      vet_phone: 'N/A', farrier_phone: 'N/A', height: 'N/A',
    });
    expect(out).toEqual({
      microchip_id: 'N/A', registration_number: 'N/A', known_conditions: 'N/A',
      vet_phone: 'N/A', farrier_phone: 'N/A', height: 'N/A',
    });
  });

  it('does not disturb real values, and does not mutate the input', () => {
    const p = { breed: 'THOROUGHBRED', color: 'BAY', sex: 'MARE', date_of_birth: '2015-05-01', fair_market_value: '$12,000.00' };
    const out = scrubHorseSentinels(p);
    expect(out).toEqual(p);
    p.breed = 'N/A';
    expect(out.breed).toBe('THOROUGHBRED');
  });
});
