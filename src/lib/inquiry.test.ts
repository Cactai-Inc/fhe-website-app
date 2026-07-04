/**
 * Unit tests for the category-aware inquiry wording (src/lib/inquiry.ts).
 *
 * Proves the submit label personalizes to the CATEGORY of the chosen items —
 * derived from the real Service.category in services.ts — with singular/plural
 * awareness, and that mixed carts and the empty cart resolve correctly. Never
 * "cart" / "checkout" / "selection" / "submit".
 */
import { describe, it, expect } from 'vitest';
import { inquiryLabel, inquiryCategories } from './inquiry';
import type { CartItem } from './cart';
import {
  RIDING_LESSON,
  HUNTER_JUMPER,
  HORSEMANSHIP,
  HORSE_TRAINING,
  HORSE_EXERCISE,
  HORSE_LOCATOR,
  EVALUATION,
  BROKERING,
} from './services';
import type { Service, ServiceTier } from './services';

/** Build a CartItem from a real service + one of its real tiers. */
function item(svc: Service, tier: ServiceTier): CartItem {
  return {
    serviceId: svc.id,
    serviceName: svc.name,
    tierId: tier.id,
    tierLabel: tier.label,
    price: tier.price,
    unit: tier.unit,
  };
}

const lesson = item(RIDING_LESSON, RIDING_LESSON.tiers[0]);
const lesson2 = item(HORSEMANSHIP, HORSEMANSHIP.tiers[0]);
const jumper = item(HUNTER_JUMPER, HUNTER_JUMPER.tiers[0]);
const horse = item(HORSE_TRAINING, HORSE_TRAINING.tiers[0]);
const horse2 = item(HORSE_EXERCISE, HORSE_EXERCISE.tiers[0]);
const locator = item(HORSE_LOCATOR, HORSE_LOCATOR.tiers[0]);
const evaluation = item(EVALUATION, EVALUATION.tiers[0]);
const broker = item(BROKERING, BROKERING.tiers[0]);

describe('inquiryCategories', () => {
  it('maps rider/horse/support services to lessons/horse/acquisition', () => {
    expect(inquiryCategories([lesson])).toEqual(new Set(['lessons']));
    expect(inquiryCategories([jumper])).toEqual(new Set(['lessons'])); // jumper training = rider = lessons
    expect(inquiryCategories([horse])).toEqual(new Set(['horse']));
    expect(inquiryCategories([locator])).toEqual(new Set(['acquisition']));
    expect(inquiryCategories([lesson, horse, broker])).toEqual(
      new Set(['lessons', 'horse', 'acquisition']),
    );
  });

  it('falls back to lessons for an unresolvable serviceId', () => {
    const orphan: CartItem = { ...lesson, serviceId: 'nonexistent-service' };
    expect(inquiryCategories([orphan])).toEqual(new Set(['lessons']));
  });
});

describe('inquiryLabel', () => {
  it('lessons only — singular vs plural', () => {
    expect(inquiryLabel([lesson])).toBe('Inquire about this lesson');
    expect(inquiryLabel([lesson, lesson2])).toBe('Inquire about these lessons');
    expect(inquiryLabel([lesson, jumper])).toBe('Inquire about these lessons');
  });

  it('horse services only — singular vs plural', () => {
    expect(inquiryLabel([horse])).toBe('Inquire about this service');
    expect(inquiryLabel([horse, horse2])).toBe('Inquire about these services');
  });

  it('acquisition only — finding your horse', () => {
    expect(inquiryLabel([locator])).toBe('Inquire about finding your horse');
    expect(inquiryLabel([evaluation, broker])).toBe('Inquire about finding your horse');
  });

  it('mixed categories (2+ buckets) — bookings and services', () => {
    expect(inquiryLabel([lesson, horse])).toBe('Inquire about these bookings and services');
    expect(inquiryLabel([lesson, locator])).toBe('Inquire about these bookings and services');
    expect(inquiryLabel([horse, broker])).toBe('Inquire about these bookings and services');
    expect(inquiryLabel([lesson, horse, broker])).toBe('Inquire about these bookings and services');
  });

  it('empty cart (defensive) — neutral Inquire', () => {
    expect(inquiryLabel([])).toBe('Inquire');
  });

  it('never emits cart/checkout/selection/submit wording', () => {
    const labels = [
      inquiryLabel([lesson]),
      inquiryLabel([horse]),
      inquiryLabel([locator]),
      inquiryLabel([lesson, horse]),
      inquiryLabel([]),
    ];
    for (const label of labels) {
      expect(label.toLowerCase()).not.toMatch(/cart|checkout|selection|submit/);
    }
  });
});
