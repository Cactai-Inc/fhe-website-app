/* ASKRIGHT — the questions belong to the OFFERING, not the funnel.
 *
 * THE DEFECT THIS REPLACES: `BookHorse` asked every horse-care buyer why they
 * were "coming to our horse care services" and for how many months — so someone
 * booking a single clip was asked whether they were travelling or recovering
 * from an injury. `BookSupport` asked every acquisition buyer how many horses
 * they were considering buying — including someone booking an evaluation on a
 * horse they already own. One fixed set per PAGE, regardless of what was chosen.
 *
 * THE SHAPE INSTEAD: every question declares a SUBJECT and belongs to a SET
 * keyed by `service_type`. Page 2 is assembled from the cart at render time —
 * a shared first section holding every question two or more selected services
 * both ask, then one section per service with only its remainder.
 *
 * WHY SUBJECT IS THE KEYING SCHEME (§A2b): two questions merge only when they
 * are the same question about the same subject. Training's "What breed is the
 * horse?" (the horse the client is bringing us), the Finder's "Are there
 * specific breeds you prefer?" (a horse they might buy) and the Evaluation's
 * "Breed" (the horse being assessed) are three different animals. A single
 * `breed` key would destroy all three answers. The answer key is
 * `subject.questionId`, so those three can never collide.
 *
 * NO FALLBACK SET. A service_type with no entry in SETS asks nothing. Silent
 * fallback to another service's questions is precisely today's bug.
 */
import { serviceDisplayName, type CartItem } from './cart';

// ─── Subjects ───────────────────────────────────────────────────────────────

/** Who or what a question is about. The first half of every answer key. */
export type Subject = 'person' | 'client_horse' | 'evaluated_horse' | 'sought_horse';

/** Staff-facing name for each subject — the prefix on every submitted answer,
 *  so a reader never has to work out which horse an answer describes. */
export const SUBJECT_LABEL: Record<Subject, string> = {
  person: 'About you',
  client_horse: 'Your horse',
  evaluated_horse: 'Horse being evaluated',
  sought_horse: 'Horse you are looking for',
};

/** §A3b: when the client has no horse yet, their `client_horse` answers do not
 *  describe a horse they have — they describe the one we are being asked to
 *  find. Relabelled on submission so staff never read it as a horse in hand. */
export const CLIENT_HORSE_NOT_YET_LABEL = 'Horse we are being asked to find';

// ─── Question definitions ───────────────────────────────────────────────────

export type Answers = Record<string, string>;

export interface QuestionOption {
  value: string;
  label: string;
  /** §A3d: "Yes — the horse I currently lease" exists only once a horse-care
   *  section has established that they lease one. */
  showWhen?: (a: Answers) => boolean;
}

export type QuestionKind = 'choice' | 'short_text' | 'long_text';

export interface QuestionDef {
  /** Unique within the subject. `subject.id` is the answer key. */
  id: string;
  subject: Subject;
  /** Rendered verbatim. The owner's wording is the whole of the visible text. */
  question: string;
  kind: QuestionKind;
  options?: QuestionOption[];
  layout?: 'wide' | 'compact';
  placeholder?: string;
  /** Yes/No-plus-detail: values that reveal a follow-up text box. */
  detailWhen?: string[];
  detailPlaceholder?: string;
  /** Hide the question when the answers make it unanswerable (§A3b's gate). */
  showWhen?: (a: Answers) => boolean;
  /** Include the question only for certain SKUs of this service_type — the
   *  exercise reason/duration pair, which is weekly-only (§A3, exercise 10-11). */
  appliesWhen?: (items: CartItem[]) => boolean;
}

/** The answer key for a question: subject + question id. THE keying scheme. */
export function answerKey(q: QuestionDef): string {
  return `${q.subject}.${q.id}`;
}

/** Where a Yes/No question's follow-up text lands. */
export function detailKey(q: QuestionDef): string {
  return `${answerKey(q)}__detail`;
}

// ─── Reusable answer shapes ─────────────────────────────────────────────────

const YES_NO: QuestionOption[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

/** The owner's Yes/No-plus-detail shape (Owner Q1): a plain pair, with a text
 *  box appearing on Yes. */
function yesNo(
  id: string,
  subject: Subject,
  question: string,
  detailPlaceholder: string,
  showWhen?: (a: Answers) => boolean,
): QuestionDef {
  return {
    id, subject, question, kind: 'choice', options: YES_NO, layout: 'compact',
    detailWhen: ['yes'], detailPlaceholder, showWhen,
  };
}

// ─── §A3b — the gate ────────────────────────────────────────────────────────

/** The client told us the horse does not exist yet, so every question about
 *  that horse is unanswerable and is suppressed rather than shown blank. */
export function horseNotYet(a: Answers): boolean {
  return a['client_horse.own_or_lease'] === 'not_yet';
}
const horseExists = (a: Answers) => !horseNotYet(a);

// ─── The shared horse block (identical across training, clipping, exercise) ──
//
// Same six questions, same subject, same ids — so the engine merges them with
// no shared-block constant to maintain. Question 1 gates the other five
// (owner, 2026-08-16: "that third option is the §A3b gate and suppresses the
// next five").

const HORSE_BLOCK: QuestionDef[] = [
  {
    id: 'own_or_lease', subject: 'client_horse',
    question: 'Do you own or lease the horse?',
    kind: 'choice', layout: 'wide',
    options: [
      { value: 'own', label: 'I own the horse' },
      { value: 'lease', label: 'I lease the horse' },
      // §A3b + §A3f: the ONE signal that a horse may not exist yet. It costs no
      // extra question because it is asked anyway, and it is all the
      // disambiguation the inquiry needs — the rest is settled on the call.
      { value: 'not_yet', label: "Not yet — I'd like help finding one" },
    ],
  },
  {
    id: 'how_long', subject: 'client_horse',
    question: 'How long have you had the horse?',
    kind: 'choice', layout: 'compact', showWhen: horseExists,
    options: [
      { value: 'lt-6-months', label: 'Less than 6 months' },
      { value: '6-12-months', label: '6–12 months' },
      { value: '1-3-years', label: '1–3 years' },
      { value: '3-plus-years', label: '3+ years' },
    ],
  },
  {
    id: 'age', subject: 'client_horse', question: 'What is the age of the horse?',
    kind: 'short_text', placeholder: 'e.g. 12', showWhen: horseExists,
  },
  {
    id: 'breed', subject: 'client_horse', question: 'What breed is the horse?',
    kind: 'short_text', placeholder: 'e.g. Warmblood', showWhen: horseExists,
  },
  yesNo('behaviour', 'client_horse', 'Does the horse have any behaviour issues?',
    'Tell us what you have seen', horseExists),
  yesNo('injuries', 'client_horse', 'Has the horse had any injuries or current health issues?',
    'Tell us about them', horseExists),
];

// Horse-history questions training and exercise both ask — same subject, same
// ids, so they merge into the shared section when both are selected.
const RIDING_HISTORY: QuestionDef = {
  id: 'riding_history', subject: 'client_horse',
  question: 'What type of riding has the horse done with you, and prior to you?',
  kind: 'short_text', placeholder: 'Dressage, jumping, trail…', showWhen: horseExists,
};
const PRIOR_TRAINING: QuestionDef = yesNo(
  'prior_training', 'client_horse', 'Has the horse had any prior training?',
  'Tell us about it', horseExists,
);

// ─── §A3c / §A3d — the experience question, asked once, everywhere ──────────
//
// BUILDER CONTEXT, NEVER RENDERED: this measures possession experience, not
// riding ability — which is why Horse Evaluation's separate "current riding
// level" question stays. The owner: "the hint is in the answers." No help line,
// no subtitle, no parenthetical may appear beneath it.

export const EXPERIENCE_KEY = 'person.experience';
export const OWN_OR_LEASE_KEY = 'client_horse.own_or_lease';
export const CONSIDERING_KEY = 'sought_horse.considering';

/** The value the §A3c implication prefills. */
export const EXPERIENCE_OWNS_VALUE = 'currently-own-or-lease';

const EXPERIENCE: QuestionDef = {
  id: 'experience', subject: 'person',
  question: 'Which best matches your equestrian experience?',
  kind: 'choice', layout: 'wide',
  options: [
    { value: 'first-horse', label: 'This will be my first horse' },
    { value: 'owned-in-past', label: 'I have owned or leased a horse in the past' },
    { value: EXPERIENCE_OWNS_VALUE, label: 'I currently own or lease a horse' },
  ],
};

// ─── The acquisition set (Horse Finder AND Acquisition Assistance) ──────────

const ACQUISITION_BLOCK: QuestionDef[] = [
  {
    id: 'lease_or_buy', subject: 'sought_horse',
    question: 'Are you looking to lease, to buy, or open to either?',
    kind: 'choice', layout: 'compact',
    options: [
      { value: 'lease', label: 'To lease' },
      { value: 'buy', label: 'To buy' },
      { value: 'either', label: 'Open to either' },
    ],
  },
  EXPERIENCE,
  {
    id: 'considering', subject: 'sought_horse',
    question: 'Have you found any horses you are already considering?',
    kind: 'choice', layout: 'wide',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
      // §A3d — client_horse and sought_horse may be the SAME horse. Offered
      // only once a horse-care section established that they lease one; you
      // cannot buy a horse you already own.
      {
        value: 'leased_horse', label: 'Yes — the horse I currently lease',
        showWhen: (a) => a[OWN_OR_LEASE_KEY] === 'lease',
      },
    ],
    detailWhen: ['yes'], detailPlaceholder: 'Tell us about them',
  },
  {
    id: 'breed_pref', subject: 'sought_horse',
    question: 'Are there specific breeds you prefer?',
    kind: 'short_text', placeholder: 'Or leave blank if you are open',
  },
  {
    id: 'age_range', subject: 'sought_horse',
    question: 'Is there a specific age range you prefer?',
    kind: 'choice', layout: 'compact',
    options: [
      { value: '3-5', label: '3–5' },
      { value: '5-7', label: '5–7' },
      { value: '7-10', label: '7–10' },
      { value: '10-plus', label: '10+' },
      { value: 'no-preference', label: 'No preference' },
    ],
  },
  {
    id: 'budget', subject: 'sought_horse',
    question: 'Do you have a specific budget range?',
    kind: 'choice', layout: 'compact',
    options: [
      { value: '2-5k', label: '$2–5k' },
      { value: '5-7k', label: '$5–7k' },
      { value: '7-10k', label: '$7–10k' },
      { value: '10k-plus', label: '$10k+' },
      { value: 'not-sure', label: 'Not sure' },
    ],
  },
  yesNo('boarding', 'sought_horse', 'Do you have a location for boarding already selected?',
    'Where?'),
  {
    id: 'intended_use', subject: 'sought_horse',
    question: 'What do you plan to use the horse for?',
    kind: 'short_text', placeholder: 'Showing, trail riding, lessons…',
  },
  {
    id: 'anything_else', subject: 'sought_horse',
    question: 'Anything else you would like us to know?',
    kind: 'long_text', placeholder: 'Anything at all — there are no wrong answers here.',
  },
];

// ─── Sets, keyed by service_type ────────────────────────────────────────────

export interface QuestionSet {
  /** The live catalog's `service_type` code. Verified against the DB, never
   *  parsed from an offering name — names changed on 2026-08-15 and
   *  name-parsing has broken credit minting three times. */
  serviceType: string;
  /** Fallback heading, used only if the cart item carries no display name. */
  fallbackTitle: string;
  questions: QuestionDef[];
}

/** `offerings.config_kind = 'recurring'` is the authoritative recurring/one-off
 *  field — NOT the `cadence` column, which belongs to the retired
 *  `client_purchases` table and has no bearing on the catalog. The exercise
 *  reason/duration pair is weekly-only by the owner's explicit ruling. */
function hasRecurringExercise(items: CartItem[]): boolean {
  return items.some((i) => i.serviceType === 'HORSE_EXERCISE' && i.configKind === 'recurring');
}

export const SETS: QuestionSet[] = [
  {
    serviceType: 'HORSE_TRAINING',
    fallbackTitle: 'Horse Training',
    questions: [
      ...HORSE_BLOCK,
      RIDING_HISTORY,
      PRIOR_TRAINING,
      {
        id: 'training_goals', subject: 'client_horse',
        question: "Problem areas and/or specific goals you have for the horse's training",
        kind: 'long_text', placeholder: 'Anything you would like us to focus on.',
      },
    ],
  },
  {
    serviceType: 'HORSE_CLIPPING',
    fallbackTitle: 'Horse Clipping',
    questions: [
      ...HORSE_BLOCK,
      yesNo('clipping_issues', 'client_horse', 'Has the horse had any issues with being clipped?',
        'Tell us what happened', horseExists),
      {
        id: 'clipping_notes', subject: 'client_horse',
        question: 'Any notes or special requests?',
        kind: 'long_text', placeholder: 'Anything we should know before we start.',
      },
    ],
  },
  {
    serviceType: 'HORSE_EXERCISE',
    fallbackTitle: 'Horse Exercise',
    questions: [
      ...HORSE_BLOCK,
      RIDING_HISTORY,
      PRIOR_TRAINING,
      {
        id: 'exercise_goals', subject: 'client_horse',
        question: "Problem areas, or specific requests or requirements for the horse's exercise",
        kind: 'long_text', placeholder: 'Anything you would like us to focus on.',
      },
      // Weekly only. The à la carte session is one appointment: asking what is
      // bringing them to the service and for how many months is the exact shape
      // of the defect this task exists to remove.
      {
        id: 'reason', subject: 'client_horse',
        question: 'What is bringing you to our horse care exercise services?',
        kind: 'choice', layout: 'wide', appliesWhen: hasRecurringExercise,
        options: [
          { value: 'traveling', label: 'I will be travelling and need my horse looked after' },
          { value: 'injured', label: 'I am recovering from an injury' },
          { value: 'training', label: 'I want professional training for my horse' },
          { value: 'regular-care', label: 'I need ongoing care and turnout support' },
          { value: 'temporary', label: 'Temporary situation — I need short-term coverage' },
          { value: 'other', label: 'Something else' },
        ],
      },
      {
        id: 'duration', subject: 'client_horse',
        question: 'Approximately how long will you need these services?',
        kind: 'choice', layout: 'compact', appliesWhen: hasRecurringExercise,
        options: [
          { value: '1-2-weeks', label: '1–2 weeks' },
          { value: '1-month', label: '1 month' },
          { value: '2-3-months', label: '2–3 months' },
          { value: 'ongoing', label: 'Ongoing' },
        ],
      },
    ],
  },
  { serviceType: 'HORSE_FINDER', fallbackTitle: 'Horse Finder', questions: ACQUISITION_BLOCK },
  {
    serviceType: 'HORSE_PURCHASE_ASSISTANCE',
    fallbackTitle: 'Acquisition Assistance',
    questions: ACQUISITION_BLOCK,
  },
  {
    serviceType: 'HORSE_EVALUATION',
    fallbackTitle: 'Horse Evaluation',
    questions: [
      {
        id: 'location', subject: 'evaluated_horse',
        // Owner-confirmed wording: the HORSE's location, not the client's.
        question: 'Where is the horse located?',
        kind: 'short_text', placeholder: 'City, or the barn it is kept at',
      },
      { id: 'age', subject: 'evaluated_horse', question: 'Age', kind: 'short_text', placeholder: 'e.g. 6' },
      { id: 'breed', subject: 'evaluated_horse', question: 'Breed', kind: 'short_text', placeholder: 'e.g. Thoroughbred' },
      {
        id: 'current_use', subject: 'evaluated_horse',
        question: 'How is the horse currently being used?',
        kind: 'short_text', placeholder: 'What it does today',
      },
      {
        id: 'planned_use', subject: 'evaluated_horse',
        question: 'What are you planning to use the horse for?',
        kind: 'short_text', placeholder: 'What you have in mind',
      },
      {
        id: 'concerns', subject: 'evaluated_horse',
        question: 'Any specific concerns or things you want us to focus on during the evaluation?',
        kind: 'long_text', placeholder: 'Anything you would like us to look at closely.',
      },
      {
        id: 'riding_level', subject: 'person',
        question: 'What is your current riding level?',
        kind: 'choice', layout: 'compact',
        // A DIFFERENT FACT from the experience question above, and both stay:
        // this one exists so a horse suited only to an advanced rider is never
        // recommended to a beginner.
        options: [
          { value: 'new', label: 'New to riding' },
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ],
      },
      EXPERIENCE,
    ],
  },
];

const SET_BY_TYPE = new Map(SETS.map((s) => [s.serviceType, s]));

/** Does anything in the cart carry a question set? Page 2 exists when this is
 *  true and is skipped when it is false — a lessons-only order skips it because
 *  lessons has no set, NOT because `/lessons` is special. */
export function cartHasQuestions(items: CartItem[]): boolean {
  return assembleSections(items).length > 0;
}

/** Cart items whose service_type has no set — they ask nothing, and they are
 *  reported rather than silently given someone else's questions. */
export function unmappedItems(items: CartItem[]): CartItem[] {
  return items.filter((i) => !i.serviceType || !SET_BY_TYPE.has(i.serviceType));
}

// ─── Assembly ───────────────────────────────────────────────────────────────

export interface AssembledSection {
  /** 'shared', or the service_type code. */
  key: string;
  title: string;
  shared: boolean;
  questions: QuestionDef[];
}

/** The heading the visitor sees for a service's section: the live catalog's own
 *  display name, so renaming a service in the DB renames the section. */
function titleFor(serviceType: string, items: CartItem[], set: QuestionSet): string {
  const named = items.find((i) => i.serviceType === serviceType && i.serviceTypeName);
  return named ? serviceDisplayName(named) : set.fallbackTitle;
}

/** Heading for the initial batch. Deliberately neutral: it can hold questions
 *  about the person AND about their horse at the same time. */
export const SHARED_SECTION_TITLE = 'First, a few details';

/**
 * PAGE 2, ASSEMBLED ON THE CLICK.
 *
 * 1. The sets in the cart, in the order the visitor picked them.
 * 2. Every question two or more of those sets ask, hoisted into one shared
 *    first section, asked once.
 * 3. Then one section per service, carrying only its remainder.
 *
 * One service selected → nothing has a count of two → no shared section falls
 * out of the arithmetic, with no special case to write. Sections left with no
 * questions of their own are dropped rather than rendered empty.
 */
export function assembleSections(items: CartItem[]): AssembledSection[] {
  // Distinct service_types with a set, in cart (= pick) order.
  const orderedTypes: string[] = [];
  for (const item of items) {
    const t = item.serviceType;
    if (t && SET_BY_TYPE.has(t) && !orderedTypes.includes(t)) orderedTypes.push(t);
  }
  if (orderedTypes.length === 0) return [];

  // Each set's questions, after the per-SKU filter (exercise weekly-only pair).
  const perType = orderedTypes.map((t) => {
    const set = SET_BY_TYPE.get(t)!;
    return {
      type: t,
      title: titleFor(t, items, set),
      questions: set.questions.filter((q) => !q.appliesWhen || q.appliesWhen(items)),
    };
  });

  // Count how many SETS ask each answer key (not how many times).
  const setsAsking = new Map<string, number>();
  for (const p of perType) {
    const seen = new Set<string>();
    for (const q of p.questions) {
      const k = answerKey(q);
      if (seen.has(k)) continue;
      seen.add(k);
      setsAsking.set(k, (setsAsking.get(k) ?? 0) + 1);
    }
  }

  // Shared = asked by two or more sets, in first-appearance order.
  const sharedQuestions: QuestionDef[] = [];
  const sharedKeys = new Set<string>();
  for (const p of perType) {
    for (const q of p.questions) {
      const k = answerKey(q);
      if ((setsAsking.get(k) ?? 0) >= 2 && !sharedKeys.has(k)) {
        sharedKeys.add(k);
        sharedQuestions.push(q);
      }
    }
  }

  const sections: AssembledSection[] = [];
  if (sharedQuestions.length > 0) {
    sections.push({
      key: 'shared', title: SHARED_SECTION_TITLE, shared: true, questions: sharedQuestions,
    });
  }
  for (const p of perType) {
    const own: QuestionDef[] = [];
    const seen = new Set<string>();
    for (const q of p.questions) {
      const k = answerKey(q);
      if (sharedKeys.has(k) || seen.has(k)) continue;
      seen.add(k);
      own.push(q);
    }
    if (own.length > 0) {
      sections.push({ key: p.type, title: p.title, shared: false, questions: own });
    }
  }
  return sections;
}

/** Every question currently ON the assembled page, gate-suppressed ones removed.
 *  This is what "the assembled form asks" means for derivations and submission. */
export function visibleQuestions(sections: AssembledSection[], answers: Answers): QuestionDef[] {
  return sections.flatMap((s) => s.questions.filter((q) => !q.showWhen || q.showWhen(answers)));
}

/** Options currently offered for a question (§A3d's conditional option). */
export function visibleOptions(q: QuestionDef, answers: Answers): QuestionOption[] {
  return (q.options ?? []).filter((o) => !o.showWhen || o.showWhen(answers));
}

// ─── §A3c — inferred answers ────────────────────────────────────────────────

/**
 * An implication runs ONE WAY. Owning or leasing the horse you want serviced
 * proves you currently own or lease a horse; owning *a* horse proves nothing
 * about *the* one you want serviced — you may be seeking a second, which is
 * exactly the case §A3b exists to protect.
 *
 * `compute` returning null means the implication no longer concludes anything:
 * a still-derived answer is WITHDRAWN rather than left holding a value its
 * source no longer supports.
 */
export interface DerivationRule {
  target: string;
  compute: (a: Answers) => string | null;
  /** Shown to staff so a conclusion is never mistaken for something typed. */
  because: string;
}

/** "12" → the band a 12-year-old falls in. Null when it is not a number, so an
 *  unparseable age never quietly becomes a preference. */
function ageBand(raw: string | undefined): string | null {
  const n = Number.parseFloat((raw ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 5) return '3-5';
  if (n < 7) return '5-7';
  if (n < 10) return '7-10';
  return '10-plus';
}

export const DERIVATIONS: DerivationRule[] = [
  {
    target: EXPERIENCE_KEY,
    because: 'Do you own or lease the horse?',
    compute: (a) => {
      const v = a[OWN_OR_LEASE_KEY];
      return v === 'own' || v === 'lease' ? EXPERIENCE_OWNS_VALUE : null;
    },
  },
  // §A3d — the sought horse IS the leased horse, so its breed and age are not
  // preferences to state, they are facts already given. Budget, boarding and
  // intended use stay real questions and are NOT touched.
  {
    target: 'sought_horse.breed_pref',
    because: 'the horse you currently lease',
    compute: (a) =>
      a[CONSIDERING_KEY] === 'leased_horse' ? (a['client_horse.breed'] ?? '').trim() || null : null,
  },
  {
    target: 'sought_horse.age_range',
    because: 'the horse you currently lease',
    compute: (a) => (a[CONSIDERING_KEY] === 'leased_horse' ? ageBand(a['client_horse.age']) : null),
  },
];

export interface DerivationOutcome {
  key: string;
  /** null = withdraw the derived answer; the implication no longer holds. */
  value: string | null;
  because: string;
}

/**
 * What the derivations conclude right now, for targets the assembled page
 * actually asks. A rule whose target is not on the page has no target — the
 * owner's instruction is explicit that no question is invented to give it one.
 */
export function derivationsFor(
  sections: AssembledSection[],
  answers: Answers,
): DerivationOutcome[] {
  const onPage = new Set(visibleQuestions(sections, answers).map((q) => answerKey(q)));
  return DERIVATIONS
    .filter((r) => onPage.has(r.target))
    .map((r) => ({ key: r.target, value: r.compute(answers), because: r.because }));
}

// ─── Submission ─────────────────────────────────────────────────────────────

/** Human answer text for one question. */
function answerText(q: QuestionDef, answers: Answers): string {
  const raw = (answers[answerKey(q)] ?? '').trim();
  if (!raw) return '';
  if (q.kind === 'choice') {
    const opt = (q.options ?? []).find((o) => o.value === raw);
    const label = opt?.label ?? raw;
    const detail = (answers[detailKey(q)] ?? '').trim();
    return detail && (q.detailWhen ?? []).includes(raw) ? `${label} — ${detail}` : label;
  }
  return raw;
}

/** Free text is trimmed and bounded before it can reach the RPC. */
const MAX_TEXT = 600;
export function boundText(v: string): string {
  const t = v.trim();
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t;
}

export interface SubmissionPayload {
  /** Flat `label → answer`, for `requests.details`. Flat by necessity: both
   *  staff readers (LeadWorkDrawer's list and the ops alert email) stringify
   *  each value, so a nested object would reach the owner as [object Object]. */
  details: Record<string, string>;
  /** The same answers as ordered prose, appended to `requests.notes` — jsonb
   *  does not preserve key order, and the notes block is the only place staff
   *  read them in the order they were asked. */
  notesBlock: string;
}

/**
 * Only answers for offerings STILL in the cart are submitted, and only
 * questions the page actually asks — a gate-suppressed question contributes
 * nothing, and an answer left behind by a removed offering is retained in the
 * store for a re-add but never sent.
 */
export function buildSubmission(
  items: CartItem[],
  answers: Answers,
  origins: Record<string, string>,
): SubmissionPayload {
  const sections = assembleSections(items);
  const details: Record<string, string> = {};
  const lines: string[] = [];
  const notYet = horseNotYet(answers);

  // §A3d — the single most important fact in such an order goes first, in both
  // places, so no one has to notice that two sections describe one animal.
  if (answers[CONSIDERING_KEY] === 'leased_horse') {
    const flag = 'Yes — they want to buy the horse they currently lease with us';
    details['Buying the horse they lease'] = flag;
    lines.push(`⚑ Buying the horse they lease: ${flag}`);
  }
  if (notYet) {
    const flag = 'No horse yet — they have asked us to help find one';
    details['Horse status'] = flag;
    lines.push(`⚑ Horse status: ${flag}`);
  }

  for (const section of sections) {
    const rendered: string[] = [];
    for (const q of section.questions) {
      if (q.showWhen && !q.showWhen(answers)) continue;
      const text = answerText(q, answers);
      if (!text) continue;
      // §A3b: with no horse, a `client_horse` answer describes the horse we are
      // being asked to FIND. Filing it as the horse they have would have staff
      // reading it as an animal in hand.
      const subjectLabel =
        q.subject === 'client_horse' && notYet
          ? CLIENT_HORSE_NOT_YET_LABEL
          : SUBJECT_LABEL[q.subject];
      const derivedFrom = origins[answerKey(q)];
      const value = derivedFrom
        ? `${text} (auto-filled from “${derivedFrom}”, not typed by the client)`
        : text;
      details[`${subjectLabel} — ${q.question}`] = boundText(value);
      rendered.push(`  • ${q.question}\n    ${value}`);
    }
    if (rendered.length > 0) {
      lines.push(`${section.title}\n${rendered.join('\n')}`);
    }
  }

  return {
    details,
    notesBlock: lines.length > 0 ? lines.join('\n\n') : '',
  };
}
