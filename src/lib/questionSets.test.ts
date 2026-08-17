import { describe, it, expect } from 'vitest';
import type { CartItem } from './cart';
import {
  SETS,
  assembleSections,
  answerKey,
  buildSubmission,
  cartHasQuestions,
  derivationsFor,
  visibleOptions,
  visibleQuestions,
  unmappedItems,
  EXPERIENCE_KEY,
  EXPERIENCE_OWNS_VALUE,
  OWN_OR_LEASE_KEY,
  CONSIDERING_KEY,
  type Answers,
  type QuestionDef,
} from './questionSets';

/*
 * ASKRIGHT — "THE TEST THIS MUST PASS", executed.
 *
 * Every case below is numbered to the acceptance list in
 * docs/tasks/TASK-ASKRIGHT-questions-belong-to-the-offering.md so a reader can
 * check them off one for one. The offering ids, service_type codes and
 * config_kind values are the LIVE ones, queried from production on 2026-08-17.
 */

// ─── Live catalog fixtures (verified against prod, 2026-08-17) ──────────────

function item(
  offeringId: string,
  offeringName: string,
  serviceType: string,
  serviceTypeName: string,
  configKind: CartItem['configKind'] = 'scheduled',
): CartItem {
  return { offeringId, offeringName, serviceType, serviceTypeName, price: 0, unit: 'flat', configKind };
}

const CLIP_FULL_BODY = item('o1', 'Full Body Clip', 'HORSE_CLIPPING', 'Horse Clipping');
const TRAINING_SESSION = item('o2', 'Training Session', 'HORSE_TRAINING', 'Horse Training');
const EXERCISE_ALACARTE = item('o3', 'Exercise Session', 'HORSE_EXERCISE', 'Horse Exercise', 'scheduled');
const EXERCISE_WEEKLY = item('o4', 'Exercise 1x Weekly', 'HORSE_EXERCISE', 'Horse Exercise', 'recurring');
const EVALUATION = item('o5', 'Horse Evaluation', 'HORSE_EVALUATION', 'Horse Evaluation', 'intake_evaluation');
const FINDER = item('o6', 'Horse Finder', 'HORSE_FINDER', 'Horse Finder', 'intake_finder');
const ASSISTANCE = item('o7', 'Acquisition Assistance', 'HORSE_PURCHASE_ASSISTANCE', 'Acquisition Assistance', 'document_transaction');
const SINGLE_LESSON = item('o8', 'Single Lesson', 'RIDING_LESSON', 'Riding Lesson');

/** Every question the page asks, as `subject.id`, gates applied. */
function askedKeys(items: CartItem[], answers: Answers = {}): string[] {
  return visibleQuestions(assembleSections(items), answers).map((q) => answerKey(q));
}

function sectionTitles(items: CartItem[]): string[] {
  return assembleSections(items).map((s) => s.title);
}

function questionsOf(items: CartItem[], sectionKey: string): string[] {
  return (assembleSections(items).find((s) => s.key === sectionKey)?.questions ?? [])
    .map((q) => answerKey(q));
}

/** The union of every question every selected set defines — coverage, not
 *  de-duplication. Deliberately computed from SETS rather than the engine, so
 *  the engine cannot mark its own homework. */
function unionFromSets(codes: string[]): Set<string> {
  const out = new Set<string>();
  for (const code of codes) {
    const set = SETS.find((s) => s.serviceType === code)!;
    for (const q of set.questions) out.add(answerKey(q));
  }
  return out;
}

const SHARED_SIX = [
  'client_horse.own_or_lease',
  'client_horse.how_long',
  'client_horse.age',
  'client_horse.breed',
  'client_horse.behaviour',
  'client_horse.injuries',
];

describe('1 — clipping alone', () => {
  const items = [CLIP_FULL_BODY];

  it('asks the shared six plus its own two, and nothing else', () => {
    expect(askedKeys(items)).toEqual([
      ...SHARED_SIX,
      'client_horse.clipping_issues',
      'client_horse.clipping_notes',
    ]);
  });

  it('NEVER asks what is bringing them to horse care, or for how long', () => {
    // The defect verbatim: a clip is one appointment.
    expect(askedKeys(items)).not.toContain('client_horse.reason');
    expect(askedKeys(items)).not.toContain('client_horse.duration');
  });
});

describe('2 — training alone', () => {
  it('asks the shared six plus its three', () => {
    expect(askedKeys([TRAINING_SESSION])).toEqual([
      ...SHARED_SIX,
      'client_horse.riding_history',
      'client_horse.prior_training',
      'client_horse.training_goals',
    ]);
  });
});

describe('3 — exercise: weekly asks eleven, à la carte asks nine', () => {
  // The catalog field that decides it: `offerings.config_kind`
  // ('recurring' vs 'scheduled'), carried on the cart item. NOT the `cadence`
  // column, which belongs to the retired client_purchases table, and never the
  // offering NAME.
  it('the weekly SKU asks all eleven', () => {
    const asked = askedKeys([EXERCISE_WEEKLY]);
    expect(asked).toHaveLength(11);
    expect(asked).toContain('client_horse.reason');
    expect(asked).toContain('client_horse.duration');
  });

  it('the à la carte SKU asks nine — no reason, no duration', () => {
    const asked = askedKeys([EXERCISE_ALACARTE]);
    expect(asked).toHaveLength(9);
    expect(asked).not.toContain('client_horse.reason');
    expect(asked).not.toContain('client_horse.duration');
  });

  it('one weekly SKU in a mixed exercise cart is enough to ask them', () => {
    expect(askedKeys([EXERCISE_ALACARTE, EXERCISE_WEEKLY])).toContain('client_horse.reason');
  });
});

describe('4 — two horse-care services: one shared section, then the extras', () => {
  const items = [TRAINING_SESSION, CLIP_FULL_BODY];

  it('renders the six once, in a shared section, then a named section each', () => {
    expect(sectionTitles(items)).toEqual(['First, a few details', 'Horse Training', 'Horse Clipping']);
    expect(questionsOf(items, 'shared')).toEqual(SHARED_SIX);
    expect(questionsOf(items, 'HORSE_TRAINING')).toEqual([
      'client_horse.riding_history', 'client_horse.prior_training', 'client_horse.training_goals',
    ]);
    expect(questionsOf(items, 'HORSE_CLIPPING')).toEqual([
      'client_horse.clipping_issues', 'client_horse.clipping_notes',
    ]);
  });

  it('COVERAGE: every question from both lists is present exactly once', () => {
    const asked = askedKeys(items);
    expect(new Set(asked).size).toBe(asked.length);                 // no repeats
    expect(new Set(asked)).toEqual(unionFromSets(['HORSE_TRAINING', 'HORSE_CLIPPING']));
  });

  it('sections follow the order the visitor picked the offerings', () => {
    expect(sectionTitles([CLIP_FULL_BODY, TRAINING_SESSION]))
      .toEqual(['First, a few details', 'Horse Clipping', 'Horse Training']);
  });

  it('two SKUs of ONE service are one section, and produce no shared section', () => {
    const twoClips = [CLIP_FULL_BODY, item('o9', 'Legs & Face Clip', 'HORSE_CLIPPING', 'Horse Clipping')];
    expect(sectionTitles(twoClips)).toEqual(['Horse Clipping']);
  });
});

describe('4b — one offering renders no shared section', () => {
  it.each([
    ['clipping', CLIP_FULL_BODY],
    ['training', TRAINING_SESSION],
    ['evaluation', EVALUATION],
    ['finder', FINDER],
  ])('%s', (_name, only) => {
    expect(assembleSections([only]).some((s) => s.shared)).toBe(false);
  });
});

describe('4c — non-overlapping lists render no shared section, and lose nothing', () => {
  const items = [TRAINING_SESSION, EVALUATION];

  it('no shared section', () => {
    expect(assembleSections(items).some((s) => s.shared)).toBe(false);
  });

  it('every question from both lists still appears', () => {
    expect(new Set(askedKeys(items))).toEqual(unionFromSets(['HORSE_TRAINING', 'HORSE_EVALUATION']));
  });
});

describe('4d — lookalike questions never merge (the keying scheme)', () => {
  const items = [TRAINING_SESSION, FINDER, EVALUATION];

  it('three breeds and two ages stay separate, one per subject', () => {
    const asked = askedKeys(items);
    // Training's "What breed is the horse?" — the horse they are bringing us.
    expect(asked).toContain('client_horse.breed');
    // The Finder's "Are there specific breeds you prefer?" — a horse they might buy.
    expect(asked).toContain('sought_horse.breed_pref');
    // The Evaluation's "Breed" — the horse being assessed, which may be neither.
    expect(asked).toContain('evaluated_horse.breed');
    expect(asked).toContain('client_horse.age');
    expect(asked).toContain('evaluated_horse.age');
  });

  it('the keying scheme is subject + question id, so a collision is impossible', () => {
    const all: QuestionDef[] = SETS.flatMap((s) => s.questions);
    const breeds = all.filter((q) => q.question.toLowerCase().includes('breed'));
    expect(new Set(breeds.map((q) => q.subject)).size).toBeGreaterThan(1);
    // Distinct subjects ⇒ distinct keys, by construction.
    expect(new Set(breeds.map(answerKey)).size).toBe(new Set(breeds.map((q) => `${q.subject}.${q.id}`)).size);
  });
});

describe("4e — the owner's example: lesson + evaluation + horse training", () => {
  const items = [SINGLE_LESSON, EVALUATION, TRAINING_SESSION];

  it('renders exactly two sections and no shared section', () => {
    // Lessons contribute none: their rider info lives on the form.
    expect(sectionTitles(items)).toEqual(['Horse Evaluation', 'Horse Training']);
    expect(assembleSections(items).some((s) => s.shared)).toBe(false);
  });

  it('the experience question appears once, under Evaluation', () => {
    expect(askedKeys(items).filter((k) => k === EXPERIENCE_KEY)).toHaveLength(1);
    expect(questionsOf(items, 'HORSE_EVALUATION')).toContain(EXPERIENCE_KEY);
  });

  it('age and breed appear twice — two different animals — correctly', () => {
    const asked = askedKeys(items);
    expect(asked.filter((k) => k.endsWith('.age'))).toEqual(['evaluated_horse.age', 'client_horse.age']);
    expect(asked.filter((k) => k.endsWith('.breed'))).toEqual(['evaluated_horse.breed', 'client_horse.breed']);
  });

  it('adding a Finder moves the experience question up into the shared batch', () => {
    expect(questionsOf([...items, FINDER], 'shared')).toEqual([EXPERIENCE_KEY]);
  });
});

describe('4e2 — Finder + Evaluation: the experience question is asked once, shared', () => {
  const items = [FINDER, EVALUATION];

  it('sits in the shared first batch, alone', () => {
    expect(questionsOf(items, 'shared')).toEqual([EXPERIENCE_KEY]);
    expect(askedKeys(items).filter((k) => k === EXPERIENCE_KEY)).toHaveLength(1);
  });

  it('carries the one unified option list — the possession-pure trio', () => {
    const q = visibleQuestions(assembleSections(items), {}).find((x) => answerKey(x) === EXPERIENCE_KEY)!;
    expect(q.question).toBe('Which best matches your equestrian experience?');
    expect(q.options?.map((o) => o.label)).toEqual([
      'This will be my first horse',
      'I have owned or leased a horse in the past',
      'I currently own or lease a horse',
    ]);
  });

  it('renders no help line, subtitle or clarifier — the hint is in the answers', () => {
    const q = visibleQuestions(assembleSections(items), {}).find((x) => answerKey(x) === EXPERIENCE_KEY)!;
    const rendered = JSON.stringify(q);
    for (const banned of ['ownership', 'caretaking', 'leasing experience', 'background']) {
      expect(rendered.toLowerCase()).not.toContain(banned);
    }
  });

  it('everything else stays separate: no other question merges', () => {
    expect(questionsOf(items, 'shared')).toHaveLength(1);
    expect(new Set(askedKeys(items))).toEqual(unionFromSets(['HORSE_FINDER', 'HORSE_EVALUATION']));
  });
});

describe('4f — answers are held across cart changes', () => {
  const answers: Answers = { 'client_horse.breed': 'Warmblood', 'evaluated_horse.age': '6' };

  it('adding an offering extends the form and re-asks nothing already answered', () => {
    const before = askedKeys([TRAINING_SESSION], answers);
    const after = askedKeys([TRAINING_SESSION, EVALUATION], answers);
    // Every question that was there is still there, keyed identically — so an
    // answer given before the addition is still the answer to the same question.
    for (const k of before) expect(after).toContain(k);
    expect(after.length).toBeGreaterThan(before.length);
  });

  it('removing an offering submits only what is still in the cart, and keeps the rest', () => {
    const { details } = buildSubmission([TRAINING_SESSION], answers, {});
    expect(details['Your horse — What breed is the horse?']).toBe('Warmblood');
    // The evaluation answer is retained in the store for a re-add, but is NOT
    // submitted, because the evaluation is no longer in the cart.
    expect(Object.keys(details).some((k) => k.startsWith('Horse being evaluated'))).toBe(false);
    // Re-adding it brings the question back with the answer still attached.
    const back = buildSubmission([TRAINING_SESSION, EVALUATION], answers, {});
    expect(back.details['Horse being evaluated — Age']).toBe('6');
  });
});

describe('4g / 4h — the questions page is conditional on CONTENT, not entry point', () => {
  it('4h — a lessons-only cart has no questions at all', () => {
    expect(cartHasQuestions([SINGLE_LESSON])).toBe(false);
    expect(assembleSections([SINGLE_LESSON])).toEqual([]);
  });

  it('4g — a lesson plus a horse-care item DOES have questions', () => {
    expect(cartHasQuestions([SINGLE_LESSON, CLIP_FULL_BODY])).toBe(true);
  });

  it('4g — a lesson plus an acquisition item DOES have questions', () => {
    expect(cartHasQuestions([SINGLE_LESSON, FINDER])).toBe(true);
  });

  it('the skip is a fact about riding lessons, not about the /lessons page', () => {
    // Nothing in the decision reads the funnel, the route or the entry point:
    // the same cart gives the same answer wherever it is asked.
    expect(cartHasQuestions([SINGLE_LESSON])).toBe(cartHasQuestions([SINGLE_LESSON]));
    expect(SETS.some((s) => s.serviceType === 'RIDING_LESSON')).toBe(false);
  });
});

describe('4k — the horse may not exist yet', () => {
  const items = [FINDER, TRAINING_SESSION];
  const notYet: Answers = { [OWN_OR_LEASE_KEY]: 'not_yet' };

  it('suppresses every question about a horse that is not there', () => {
    const asked = askedKeys(items, notYet);
    for (const k of [
      'client_horse.how_long', 'client_horse.age', 'client_horse.breed',
      'client_horse.behaviour', 'client_horse.injuries',
      'client_horse.riding_history', 'client_horse.prior_training',
    ]) {
      expect(asked).not.toContain(k);
    }
  });

  it('still asks the gate itself, and still takes their training goals', () => {
    const asked = askedKeys(items, notYet);
    expect(asked).toContain(OWN_OR_LEASE_KEY);
    expect(asked).toContain('client_horse.training_goals');
  });

  it('records that the horse is still to be acquired', () => {
    const { details } = buildSubmission(items, notYet, {});
    expect(details['Horse status']).toBe('No horse yet — they have asked us to help find one');
  });

  it('does NOT file those answers as describing a horse the client owns', () => {
    const answers = { ...notYet, 'client_horse.training_goals': 'Needs to be safe on trails' };
    const { details } = buildSubmission(items, answers, {});
    const keys = Object.keys(details);
    expect(keys.some((k) => k.startsWith('Your horse —'))).toBe(false);
    expect(keys.some((k) => k.startsWith('Horse we are being asked to find —'))).toBe(true);
  });

  it('asking questions is unaffected when the horse DOES exist', () => {
    expect(askedKeys(items, { [OWN_OR_LEASE_KEY]: 'lease' })).toContain('client_horse.age');
  });
});

describe('4k2 — §A3f: a mixed cart asks nothing extra and is never routed differently', () => {
  it('horse care + acquisition adds no disambiguating question', () => {
    const mixed = new Set(askedKeys([TRAINING_SESSION, FINDER]));
    const expected = unionFromSets(['HORSE_TRAINING', 'HORSE_FINDER']);
    expect(mixed).toEqual(expected);
  });

  it('no question anywhere asks which horse the care is for', () => {
    const all = SETS.flatMap((s) => s.questions).map((q) => q.question.toLowerCase());
    expect(all.some((q) => q.includes('which horse'))).toBe(false);
    expect(all.some((q) => q.includes('same horse'))).toBe(false);
  });
});

describe('4l — the two ownership questions remain separate', () => {
  it('a client can own a horse while seeking another, and say both', () => {
    const answers: Answers = {
      [OWN_OR_LEASE_KEY]: 'not_yet',                    // the horse for TRAINING does not exist
      [EXPERIENCE_KEY]: EXPERIENCE_OWNS_VALUE,          // but they DO own a horse
    };
    const { details } = buildSubmission([TRAINING_SESSION, FINDER], answers, {});
    expect(details['Horse status']).toContain('No horse yet');
    expect(details['About you — Which best matches your equestrian experience?'])
      .toBe('I currently own or lease a horse');
  });

  it('they are different keys under different subjects', () => {
    expect(OWN_OR_LEASE_KEY.split('.')[0]).toBe('client_horse');
    expect(EXPERIENCE_KEY.split('.')[0]).toBe('person');
  });
});

describe('4m / 4n / 4o — the inference (§A3c)', () => {
  const items = [TRAINING_SESSION, FINDER];
  const sections = assembleSections(items);

  it('4m — own or lease the serviced horse ⇒ the experience answer is concluded', () => {
    const out = derivationsFor(sections, { [OWN_OR_LEASE_KEY]: 'lease' });
    expect(out.find((d) => d.key === EXPERIENCE_KEY)?.value).toBe(EXPERIENCE_OWNS_VALUE);
    expect(out.find((d) => d.key === EXPERIENCE_KEY)?.because).toBe('Do you own or lease the horse?');
  });

  it('4m — owning it concludes the same thing as leasing it', () => {
    const out = derivationsFor(sections, { [OWN_OR_LEASE_KEY]: 'own' });
    expect(out.find((d) => d.key === EXPERIENCE_KEY)?.value).toBe(EXPERIENCE_OWNS_VALUE);
  });

  it('4n — the implication is ONE WAY: there is no rule pointing the other direction', () => {
    const out = derivationsFor(sections, { [EXPERIENCE_KEY]: EXPERIENCE_OWNS_VALUE });
    expect(out.some((d) => d.key === OWN_OR_LEASE_KEY)).toBe(false);
  });

  it('4o — "not yet" withdraws a conclusion that no longer holds', () => {
    const out = derivationsFor(sections, { [OWN_OR_LEASE_KEY]: 'not_yet' });
    expect(out.find((d) => d.key === EXPERIENCE_KEY)?.value).toBeNull();
  });

  it('an implication with no target on the page concludes nothing', () => {
    // Horse care alone never asks the experience question, so there is nothing
    // to prefill — and no question is invented to give the rule a target.
    const careOnly = assembleSections([TRAINING_SESSION]);
    expect(derivationsFor(careOnly, { [OWN_OR_LEASE_KEY]: 'own' })).toEqual([]);
  });
});

describe('4p — staff can tell a derived answer from a given one', () => {
  it('the submitted answer says so, in words', () => {
    const { details, notesBlock } = buildSubmission(
      [TRAINING_SESSION, FINDER],
      { [EXPERIENCE_KEY]: EXPERIENCE_OWNS_VALUE },
      { [EXPERIENCE_KEY]: 'Do you own or lease the horse?' },
    );
    const value = details['About you — Which best matches your equestrian experience?'];
    expect(value).toContain('I currently own or lease a horse');
    expect(value).toContain('auto-filled');
    expect(value).toContain('not typed by the client');
    expect(notesBlock).toContain('auto-filled');
  });

  it('an answer the visitor gave carries no such marker', () => {
    const { details } = buildSubmission(
      [TRAINING_SESSION, FINDER], { [EXPERIENCE_KEY]: EXPERIENCE_OWNS_VALUE }, {},
    );
    expect(details['About you — Which best matches your equestrian experience?'])
      .toBe('I currently own or lease a horse');
  });
});

describe("4q — the owner's full scenario: lease + exercise + lessons + ready to buy", () => {
  const items = [EXERCISE_WEEKLY, SINGLE_LESSON, ASSISTANCE];

  it('renders the exercise and acquisition sections; lessons adds nothing', () => {
    expect(sectionTitles(items)).toEqual(['Horse Exercise', 'Acquisition Assistance']);
  });

  it('the experience question appears once, under Acquisition', () => {
    expect(askedKeys(items).filter((k) => k === EXPERIENCE_KEY)).toHaveLength(1);
    expect(questionsOf(items, 'HORSE_PURCHASE_ASSISTANCE')).toContain(EXPERIENCE_KEY);
  });

  it('leasing the exercise horse prefills it to "currently own or lease"', () => {
    const out = derivationsFor(assembleSections(items), { [OWN_OR_LEASE_KEY]: 'lease' });
    expect(out.find((d) => d.key === EXPERIENCE_KEY)?.value).toBe(EXPERIENCE_OWNS_VALUE);
  });

  it('the horse questions ARE asked — the horse exists, it is simply leased', () => {
    expect(askedKeys(items, { [OWN_OR_LEASE_KEY]: 'lease' })).toContain('client_horse.age');
  });

  it('the same cart produces the same page whichever page they started on', () => {
    // Nothing in the assembly reads a funnel or a route.
    const fromLessons = assembleSections([SINGLE_LESSON, EXERCISE_WEEKLY, ASSISTANCE]);
    const fromHorse = assembleSections([EXERCISE_WEEKLY, ASSISTANCE, SINGLE_LESSON]);
    expect(fromLessons.map((s) => s.title)).toEqual(fromHorse.map((s) => s.title));
  });
});

describe('4r — buying the horse they lease', () => {
  const items = [EXERCISE_WEEKLY, FINDER];
  const leased: Answers = { [OWN_OR_LEASE_KEY]: 'lease', 'client_horse.breed': 'Warmblood', 'client_horse.age': '8' };

  it('the option exists only once a horse-care section established a LEASE', () => {
    const q = visibleQuestions(assembleSections(items), leased)
      .find((x) => answerKey(x) === CONSIDERING_KEY)!;
    expect(visibleOptions(q, leased).map((o) => o.label)).toContain('Yes — the horse I currently lease');
    // You cannot buy a horse you already own, and you cannot buy one that does
    // not exist: the option is not offered in either case.
    expect(visibleOptions(q, { [OWN_OR_LEASE_KEY]: 'own' }).map((o) => o.label))
      .not.toContain('Yes — the horse I currently lease');
    expect(visibleOptions(q, {}).map((o) => o.label))
      .not.toContain('Yes — the horse I currently lease');
  });

  it('choosing it prefills breed and age range from the horse in hand', () => {
    const answers = { ...leased, [CONSIDERING_KEY]: 'leased_horse' };
    const out = derivationsFor(assembleSections(items), answers);
    expect(out.find((d) => d.key === 'sought_horse.breed_pref')?.value).toBe('Warmblood');
    expect(out.find((d) => d.key === 'sought_horse.age_range')?.value).toBe('7-10');
  });

  it('budget, boarding and intended use are STILL asked — only the horse is known', () => {
    const asked = askedKeys(items, { ...leased, [CONSIDERING_KEY]: 'leased_horse' });
    expect(asked).toContain('sought_horse.budget');
    expect(asked).toContain('sought_horse.boarding');
    expect(asked).toContain('sought_horse.intended_use');
  });

  it('4s — the link is stated on the inquiry, not left to be inferred', () => {
    const answers = { ...leased, [CONSIDERING_KEY]: 'leased_horse' };
    const { details, notesBlock } = buildSubmission(items, answers, {});
    expect(details['Buying the horse they lease'])
      .toBe('Yes — they want to buy the horse they currently lease with us');
    expect(notesBlock.split('\n')[0]).toContain('Buying the horse they lease');
  });

  it('nothing is prefilled when they are not buying the leased horse', () => {
    const out = derivationsFor(assembleSections(items), { ...leased, [CONSIDERING_KEY]: 'yes' });
    expect(out.find((d) => d.key === 'sought_horse.breed_pref')?.value).toBeNull();
  });
});

describe('5 — Horse Finder and Acquisition Assistance ask the same nine', () => {
  it.each([['Horse Finder', FINDER], ['Acquisition Assistance', ASSISTANCE]] as const)(
    '%s', (_name, only) => {
      expect(askedKeys([only])).toEqual([
        'sought_horse.lease_or_buy',
        EXPERIENCE_KEY,
        'sought_horse.considering',
        'sought_horse.breed_pref',
        'sought_horse.age_range',
        'sought_horse.budget',
        'sought_horse.boarding',
        'sought_horse.intended_use',
        'sought_horse.anything_else',
      ]);
    });

  it("the owner's budget and age bands, exactly", () => {
    const qs = visibleQuestions(assembleSections([FINDER]), {});
    const budget = qs.find((q) => answerKey(q) === 'sought_horse.budget')!;
    const age = qs.find((q) => answerKey(q) === 'sought_horse.age_range')!;
    expect(budget.options?.map((o) => o.label)).toEqual(['$2–5k', '$5–7k', '$7–10k', '$10k+', 'Not sure']);
    expect(age.options?.map((o) => o.label)).toEqual(['3–5', '5–7', '7–10', '10+', 'No preference']);
  });

  it('how_many_horses and wants_lessons are gone from every set', () => {
    const all = SETS.flatMap((s) => s.questions);
    expect(all.some((q) => q.question.includes('How many horses'))).toBe(false);
    expect(all.some((q) => q.question.toLowerCase().includes('interested in riding lessons'))).toBe(false);
  });
});

describe('6 — Horse Evaluation asks its own eight', () => {
  it('in order, with the horse-location wording the owner confirmed', () => {
    expect(askedKeys([EVALUATION])).toEqual([
      'evaluated_horse.location',
      'evaluated_horse.age',
      'evaluated_horse.breed',
      'evaluated_horse.current_use',
      'evaluated_horse.planned_use',
      'evaluated_horse.concerns',
      'person.riding_level',
      EXPERIENCE_KEY,
    ]);
    const q = visibleQuestions(assembleSections([EVALUATION]), {})[0];
    expect(q.question).toBe('Where is the horse located?');
  });

  it('riding level and equestrian experience are different questions, both asked', () => {
    const asked = askedKeys([EVALUATION]);
    expect(asked).toContain('person.riding_level');
    expect(asked).toContain(EXPERIENCE_KEY);
  });
});

describe('7 — an offering with no mapped set asks nothing', () => {
  const unmapped = item('oX', 'Horse Sale Assistance', 'HORSE_SALE_ASSISTANCE', 'Horse Sale Assistance');

  it('no fallback set: it contributes no questions and no section', () => {
    expect(assembleSections([unmapped])).toEqual([]);
    expect(cartHasQuestions([unmapped])).toBe(false);
  });

  it('and it never inherits another service\'s questions', () => {
    expect(askedKeys([unmapped, CLIP_FULL_BODY])).toEqual(askedKeys([CLIP_FULL_BODY]));
    expect(sectionTitles([unmapped, CLIP_FULL_BODY])).toEqual(['Horse Clipping']);
  });

  it('it is reportable rather than silent', () => {
    expect(unmappedItems([unmapped, CLIP_FULL_BODY]).map((i) => i.serviceType))
      .toEqual(['HORSE_SALE_ASSISTANCE']);
  });
});

describe('8 — free text reaches the request, bounded, and is never required', () => {
  it('travels in the details payload', () => {
    const { details } = buildSubmission(
      [TRAINING_SESSION], { 'client_horse.training_goals': 'Wants to jump 2ft by spring' }, {},
    );
    expect(details["Your horse — Problem areas and/or specific goals you have for the horse's training"])
      .toBe('Wants to jump 2ft by spring');
  });

  it('is bounded before it can reach the RPC', () => {
    const { details } = buildSubmission(
      [TRAINING_SESSION], { 'client_horse.training_goals': 'x'.repeat(5000) }, {},
    );
    const only = Object.values(details)[0];
    expect(only.length).toBeLessThanOrEqual(601);
  });

  it('an empty cart or empty answers submit nothing at all', () => {
    expect(buildSubmission([], {}, {})).toEqual({ details: {}, notesBlock: '' });
    expect(buildSubmission([TRAINING_SESSION], {}, {}).details).toEqual({});
  });

  it('no question anywhere is marked required', () => {
    const all = SETS.flatMap((s) => s.questions) as Array<QuestionDef & { required?: boolean }>;
    expect(all.some((q) => q.required)).toBe(false);
  });
});

describe('the sets are keyed to the LIVE catalog', () => {
  // Queried from production 2026-08-17: these are every service_type that has
  // an active offering, in the two segments that ask questions.
  it('every set keys to a real, active service_type', () => {
    expect(SETS.map((s) => s.serviceType).sort()).toEqual([
      'HORSE_CLIPPING', 'HORSE_EVALUATION', 'HORSE_EXERCISE',
      'HORSE_FINDER', 'HORSE_PURCHASE_ASSISTANCE', 'HORSE_TRAINING',
    ]);
  });

  it('section headings come from the catalog, so renaming a service renames them', () => {
    const renamed = { ...CLIP_FULL_BODY, serviceTypeName: 'Clipping & Trace' };
    expect(sectionTitles([renamed])).toEqual(['Clipping & Trace']);
  });

  it('a cart persisted before display names existed still gets a sane heading', () => {
    const legacy = { ...CLIP_FULL_BODY, serviceTypeName: undefined };
    expect(sectionTitles([legacy])).toEqual(['Horse Clipping']);
  });
});
