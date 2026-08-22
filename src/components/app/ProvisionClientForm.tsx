import { useEffect, useMemo, useRef, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  adminSendInvitation, categoryDocumentDefaults, suggestedCategoryForContact,
  onboardingTemplateOptions, matchesCategoryToken, requestOnboardingCategories,
  getContactRequiredDocumentsState, narrowContactRequiredDocuments,
  CLIENT_CATEGORIES, CATEGORY_TOKEN, type CategoryDocDefault,
  type AdminInviteResult, type RequiredDocumentState,
} from '../../lib/admin';
import { fetchOfferings } from '../../lib/api';
import { InviteResultPanel } from './InviteResultPanel';
import type { AgreedLesson } from './AgreedLessonPanel';
import type { Offering, Segment } from '../../lib/types';

/**
 * PROVISION CLIENT — the ONE shared "upgrade a contact to an account" form.
 * Every admin account-creation surface renders this so the field set never
 * drifts and there is a single call site to the provisioning spine:
 *   - source='new'        blank (New client page)
 *   - source='contact'    an existing captured contact (client-detail)
 *   - source='submission' a website/kiosk submission (Inbound convert)
 *
 * When launched on a contact that already signed documents (kiosk walk-in), the
 * category is preselected from those signed docs and the paperwork already on
 * file is shown as complete (not re-requested).
 */

// Category (display) → offering segments it may purchase (union when stacked).
const CATEGORY_SEGMENTS: Record<string, Segment[]> = {
  Guest: ['acquisition'],
  Rider: ['rider', 'acquisition'],
  'Horse owner': ['horse', 'acquisition'],
  // CAREPATH §C10a — a DEAL CLIENT buys acquisition services and nothing that
  // needs a horse on our records. Offering them a horse-care SKU here would
  // create the very order that summons the paperwork this category exists to
  // avoid.
  'Deal client': ['acquisition'],
};
// Standing token → display label (reverse of CATEGORY_TOKEN) for preselection.
const TOKEN_TO_DISPLAY: Record<string, string> = {
  GUEST: 'Guest', RIDER: 'Rider', HORSE_OWNER: 'Horse owner',
};

// Offerings the owner removed from INVITE selection (2026-07-28). They stay
// active in the DB because the public catalog still lists them (zero purchases /
// invitations to date) — filtered here, not retired, so the storefront is
// unchanged until the owner decides otherwise.
const INVITE_HIDDEN_OFFERING_IDS = new Set<string>([
  '62f29124-826a-4e7b-bf8c-53d223d97854', // 3x Weekly (riding lessons)
  '85cab901-959c-43ac-b2bf-dd3b7dec9f64', // Evaluation Lesson — the first lesson IS the evaluation now
]);

// The owner's note shown wherever lessons are offered on this page.
const EVALUATION_LESSON_NOTE =
  'The first lesson for anyone new to French Heritage Equestrian is an '
  + 'evaluation lesson — plan for an extra 30 minutes total: arrive 15 minutes '
  + 'early, and the lesson runs 15 minutes longer than normal.';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><span className="form-label">{label}</span>{children}</div>;
}
function money(n: number): string {
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export interface ProvisionClientFormProps {
  source: 'new' | 'contact' | 'submission';
  /** Pre-fill: existing contact to upgrade (contact/submission sources). */
  contactId?: string;
  /** Pre-fill: originating submission (submission source) — linked + flipped to invited. */
  requestId?: string;
  /** Pre-fill: known email (locked when provided). */
  email?: string;
  /** Pre-fill: known name from a submission (carried onto the account). */
  firstName?: string;
  lastName?: string;
  /** Called after a successful provision with the invite result. */
  onProvisioned?: (result: AdminInviteResult) => void;
  /** Hide the built-in result panel (host shows its own, e.g. the client page link). */
  hideResult?: boolean;
  /**
   * LESSONREQUEST §L3 — the slot staff agreed on the phone, when they set one.
   *
   * It rides on THIS submission rather than a second button, because setting
   * the time and issuing the link are one act (CAREPATH §C5b): the order
   * confirms, the lead promotes, the lesson is booked and the invitation sends
   * together, or none of it does. Two RPCs can half-succeed, and there is no
   * good half to be left holding.
   *
   * The panel that produces it lives in the host (`LeadWorkDrawer`), not here,
   * so this form stays the same field set for all three of its sources.
   */
  agreedLesson?: AgreedLesson | null;
  /** Rendered above the fields — the host's own sections for this invite. */
  children?: React.ReactNode;
}

export function ProvisionClientForm({
  source, contactId, requestId, email: emailProp,
  firstName, lastName, onProvisioned, hideResult, agreedLesson, children,
}: ProvisionClientFormProps) {
  const emailLocked = Boolean(emailProp);
  const [email, setEmail] = useState(emailProp ?? '');
  const [categories, setCategories] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  const [docChecked, setDocChecked] = useState<Set<string> | null>(null);
  /** Every document staff MAY apply — not only what the categories suggest. */
  const [allTemplates, setAllTemplates] = useState<{ template_key: string; title: string }[]>([]);
  const [addingDoc, setAddingDoc] = useState(false);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringIds, setOfferingIds] = useState<string[]>([]);
  const [payStatus, setPayStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Zelle');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<
    { url: string; emailed: boolean; emailError?: string; email: string } | null>(null);
  // Already-signed templates (kiosk walk-in) — shown as complete, not re-requested.
  const [signedTemplates, setSignedTemplates] = useState<string[]>([]);
  /** CATEGORISE §2 — the categories this inquiry's CART implied, for the note
   *  that tells staff why the boxes below are ticked. */
  const [derivedCategories, setDerivedCategories] = useState<string[]>([]);
  /** NOSTRIP §4 — what this person ALREADY owes. Without it this screen could
   *  not name what a narrower category selection was about to take away, and
   *  for most of this system's life it took it away silently. */
  const [held, setHeld] = useState<RequiredDocumentState[]>([]);
  const [removeHeld, setRemoveHeld] = useState(false);
  const [removeReason, setRemoveReason] = useState('');

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    onboardingTemplateOptions().then(setAllTemplates).catch(() => setAllTemplates([]));
    fetchOfferings().then(setOfferings).catch(() => setOfferings([]));
  }, []);

  // ⚠️ CATEGORISE §2 — THE CART DECIDES THE CATEGORY, NOT THE FUNNEL.
  //
  // The category selects the LEGAL DOCUMENT SET this person must execute before
  // they arrive. Until now the only signal on this screen was whatever a staff
  // member remembered to tick, and the inquiry itself was filed under
  // `state.funnel` — the page the visitor happened to be standing on. Someone
  // who bought a lesson AND horse clipping in one cart was filed under one of
  // them and signed one of the two sets.
  //
  // `request_onboarding_categories` reads the cart lines and answers with EVERY
  // category they touch, already unioned with whatever this contact holds today
  // (the RPC does that half — a derived default must never be able to strip a
  // boarder's horse paperwork). It is a PREFILL: staff untick freely, and a
  // phone call still beats a cart.
  //
  // Runs once per request. Re-ticking a box a staff member deliberately cleared
  // would be worse than not prefilling at all.
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!requestId || prefilledFor.current === requestId) return;
    prefilledFor.current = requestId;
    requestOnboardingCategories(requestId, contactId)
      .then((cats) => {
        if (cats.length === 0) return;
        setDerivedCategories(cats);
        setCategories((prev) => {
          const wanted = new Set([...prev, ...cats]);
          return CLIENT_CATEGORIES.filter((c) => wanted.has(c));
        });
      })
      .catch(() => { /* the checkboxes still work by hand */ });
  }, [requestId, contactId]);

  // NOSTRIP §4 — the paperwork already standing on this person's record, so the
  // screen can SAY, by name, what a narrower selection would remove, BEFORE the
  // action commits. CATEGORISE shipped an informational note about where the
  // prefill came from; this is the part that was missing — the note explained,
  // it did not gate.
  useEffect(() => {
    if (!contactId) { setHeld([]); return; }
    getContactRequiredDocumentsState(contactId).then(setHeld).catch(() => setHeld([]));
  }, [contactId]);

  // Signed-contact detection: preselect category from what they've already signed.
  useEffect(() => {
    if (!contactId) return;
    suggestedCategoryForContact(contactId)
      .then((r) => {
        setSignedTemplates(r.executed_templates ?? []);
        const display = TOKEN_TO_DISPLAY[r.suggested];
        if (display) setCategories((prev) => (prev.length ? prev : [display]));
      })
      .catch(() => {});
  }, [contactId]);

  // ⚠️ PARTYROLE §R1 — THE SCREEN RESOLVES DOCUMENTS THE WAY THE RPC DOES.
  //
  // This used to match `d.category === c` on the DISPLAY label, while
  // `apply_category_documents` matches on the TOKEN the submit below sends. For
  // 'Deal client' — the one label whose token is not its own name — the two
  // disagreed: the form promised the single 'Deal client' requirements row while
  // the database resolved GUEST and wrote Guest's three. Going through
  // CATEGORY_TOKEN makes the disagreement structurally impossible rather than
  // fixing one instance of it, so a future label that reuses a token cannot
  // reintroduce the bug. (The dead 'Deal client' row itself is retired in
  // migration 20260817T1800; the owner ruled the three CORRECT — a deal client is
  // your client, arriving at the property.)
  const derivedDocKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of categories) {
      const token = CATEGORY_TOKEN[c];
      if (!token) continue;
      for (const d of defaults) if (matchesCategoryToken(d.category, token)) keys.add(d.template_key);
    }
    return keys;
  }, [defaults, categories]);
  const titleFor = (key: string) =>
    defaults.find((d) => d.template_key === key)?.title
    ?? allTemplates.find((t) => t.template_key === key)?.title
    ?? key;
  const effectiveDocs = docChecked ?? derivedDocKeys;
  const shownDocKeys = useMemo(() => {
    const s = new Set(derivedDocKeys);
    if (docChecked) docChecked.forEach((k) => s.add(k));
    return Array.from(s);
  }, [derivedDocKeys, docChecked]);
  // ⚠️ NOSTRIP §4 — SAY IT BEFORE DOING IT.
  //
  // Everything this person currently owes that the selection above does NOT
  // cover. Until this task, ticking a narrower category silently DELETED these
  // rows: no audit_logs row, no reason, no actor, no undo, no trace it ever
  // happened — and what was deleted is the record of what somebody was obliged
  // to sign before being on the property or handling a horse.
  //
  // Nothing is removed now unless a staff member asks for it here, by name, with
  // a reason. Already-skipped rows are not listed: they are already not being
  // asked for, and re-announcing them every visit would train people to ignore
  // this panel.
  const wouldDrop = useMemo(
    () => held.filter((r) => !r.skipped_at && !effectiveDocs.has(r.template_key)),
    [held, effectiveDocs]);
  // Executed paperwork is EVIDENCE that the obligation existed and was met. It
  // is refused by the database on every path; the screen must not offer it.
  const dropExecuted = useMemo(() => wouldDrop.filter((r) => r.satisfied), [wouldDrop]);
  const dropRemovable = useMemo(() => wouldDrop.filter((r) => !r.satisfied), [wouldDrop]);
  const narrowingBlocked = removeHeld && dropRemovable.length > 0 && !removeReason.trim();

  // What staff can still REACH FOR: every onboarding template not already on the
  // list above. The owner's rule is that nothing is required of a counterparty
  // and everything is permitted, so this is deliberately not filtered by category
  // — a seller who is delivering the horse needs the general release, and their
  // category suggests nothing at all.
  const addableTemplates = useMemo(
    () => allTemplates.filter((t) => !shownDocKeys.includes(t.template_key)),
    [allTemplates, shownDocKeys],
  );

  const allowedSegments = useMemo(() => {
    const s = new Set<Segment>();
    for (const c of categories) (CATEGORY_SEGMENTS[c] ?? []).forEach((seg) => s.add(seg));
    return s;
  }, [categories]);
  // Flat SKUs: a purchasable offering is one in the allowed segment that isn't an
  // inquire-only / parent grouping row (config_kind='inquire' or no price). The
  // tier layer was removed 2026-07-08 — each offering IS the purchasable item.
  // "(With your horse)" lesson variants (RIDING_LESSON with horse_included=false —
  // the rider brings their own horse) only make sense for horse owners, so they
  // appear only when the Horse owner category is checked.
  const horseOwnerChecked = categories.includes('Horse owner');
  const visibleOfferings = offerings.filter(
    (o) => allowedSegments.has(o.segment)
      && o.config_kind !== 'inquire'
      && o.price_amount != null
      && !INVITE_HIDDEN_OFFERING_IDS.has(o.id)
      && !(o.service_type === 'RIDING_LESSON' && o.horse_included === false && !horseOwnerChecked));

  // If a category toggle hides an already-checked offering (e.g. unchecking
  // Horse owner while a "(With your horse)" lesson is selected), drop it so the
  // invitation can never carry an offering the form no longer shows.
  useEffect(() => {
    const visible = new Set(visibleOfferings.map((o) => o.id));
    setOfferingIds((prev) => {
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, offerings]);

  const offeringTotal = useMemo(() => {
    let t = 0;
    for (const o of offerings)
      if (offeringIds.includes(o.id)) t += o.price_amount ?? 0;
    return t;
  }, [offerings, offeringIds]);

  function toggleCategory(c: string) {
    setCategories((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      setDocChecked(null);
      const segs = new Set<Segment>();
      for (const cat of next) (CATEGORY_SEGMENTS[cat] ?? []).forEach((s) => segs.add(s));
      setOfferingIds((ids) => ids.filter((id) => {
        const seg = offerings.find((o) => o.id === id)?.segment;
        return seg ? segs.has(seg) : false;
      }));
      return next;
    });
  }
  function toggleDoc(key: string) {
    setDocChecked((prev) => {
      const base = prev ?? new Set(derivedDocKeys);
      const s = new Set(base);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }
  function toggleOffering(id: string) {
    setOfferingIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null); setResult(null);
    try {
      const tokens = categories.map((c) => CATEGORY_TOKEN[c]).filter(Boolean);
      const finalDocs = docChecked ? Array.from(effectiveDocs) : undefined;

      // ⚠️ NOSTRIP §2 — REMOVAL IS ITS OWN ACT, AND IT SKIPS RATHER THAN DELETES.
      //
      // It runs FIRST and on its own: if the database refuses (an executed
      // document is in the way, or the reason is blank) nothing else has
      // happened yet, so there is no half-narrowed record and no invitation
      // promising a document set that was never applied. The kept set carries
      // the executed rows explicitly — they are never removable, and leaving
      // them out would be asking for the refusal.
      if (contactId && removeHeld && dropRemovable.length > 0) {
        await narrowContactRequiredDocuments(
          contactId,
          [...effectiveDocs, ...dropExecuted.map((r) => r.template_key)],
          removeReason.trim(),
        );
      }
      const r = await adminSendInvitation({
        email: email.trim(),
        ...(requestId ? { requestId } : {}),
        ...(firstName?.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName?.trim() ? { lastName: lastName.trim() } : {}),
        categories: tokens,
        // STABILIZE ITEM 2: this form ALWAYS creates a client account, including
        // when staff deliberately tick no category (a contract-only party).
        provisionClient: true,
        ...(offeringIds.length ? { offeringIds } : {}),
        ...(finalDocs ? { templateKeys: finalDocs } : {}),
        paymentStatus: payStatus,
        ...(payStatus === 'partial' ? { partialAmount: Number(partialAmount) || 0 } : {}),
        ...(payStatus !== 'unpaid' ? { paymentMethod } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(agreedLesson ? { agreedLesson } : {}),
      });
      setResult({ url: r.registerUrl, emailed: r.emailed, emailError: r.emailError, email: email.trim() });
      onProvisioned?.(r);
      setRemoveHeld(false); setRemoveReason('');
      if (contactId) getContactRequiredDocumentsState(contactId).then(setHeld).catch(() => {});
      if (source === 'new') {
        setEmail(''); setCategories([]); setDocChecked(null); setOfferingIds([]);
        setPayStatus('unpaid'); setPartialAmount(''); setNotes('');
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Could not create the invitation.'));
    } finally {
      setWorking(false);
    }
  }

  // §L3 — the button says what the one act actually does. When a time was set
  // it books the lesson too, and the label must not hide that.
  const primaryLabel = agreedLesson ? 'Book the lesson & send invitation'
    : source === 'submission' ? 'Convert & send invitation'
    : source === 'contact' ? 'Provision & send invitation'
    : 'Create & send invitation';

  return (
    <>
      <form onSubmit={submit}>
        {children}
        <Field label="Email">
          <input type="email" required className="form-input" value={email}
            disabled={emailLocked}
            onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
        </Field>

        <div className="mb-6">
          <span className="form-label">Account category</span>
          <p className="text-sm text-muted mb-2.5">What kind of client — check everything that applies.</p>
          {/* CATEGORISE §6 (THE REACH) — staff SEE that the cart chose these, and
              can see it was the cart and not a guess. A prefill nobody can
              account for is a prefill nobody trusts. */}
          {derivedCategories.length > 0 && (
            <p className="text-[12.5px] text-green-800/80 mb-2.5">
              Prefilled from what they asked for: <strong className="font-medium">{derivedCategories.join(' + ')}</strong>.
              {' '}This decides the paperwork below — change it if the conversation said otherwise.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {CLIENT_CATEGORIES.map((c) => (
              <label key={c}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border cursor-pointer text-[15px] ${
                  categories.includes(c) ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                    : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                <input type="checkbox" className="accent-green-700 w-[18px] h-[18px]"
                  checked={categories.includes(c)} onChange={() => toggleCategory(c)} />
                {c}
              </label>
            ))}
          </div>
          {/* STABILIZE ITEM 2 — NO CATEGORY IS A CHOICE, NOT AN ERROR STATE.
              Owner, 2026-08-22: "an account gets tags that ENABLE an action,
              never OBLIGATE one on their own... For a party who signs nothing
              but the contract: select ZERO categories, not a new one."
              Until now the submit button was disabled while nothing was ticked,
              so the one shape the owner needs — a person whose only relationship
              to us is a contract — could not be created here at all. Leaving
              them all unticked is now a sentence, not a silence. */}
          {categories.length === 0 && (
            <p className="text-[12.5px] text-secondary mt-2.5">
              <strong className="font-medium text-green-800">No service category.</strong>{' '}
              Leave these unticked when this person's only relationship with us is a
              contract — they aren't visiting, riding or boarding a horse. They'll get
              an account and no onboarding paperwork; the contract carries its own
              signing gate.
            </p>
          )}
        </div>

        {categories.length > 0 && (
          <>
            <div className="mb-6">
              <span className="form-label">First-login paperwork</span>
              <p className="text-sm text-muted mb-2.5">
                What they'll review and sign when they activate. Category picks prefill
                this — adjust as needed; the invitation email lists it.
              </p>
              {shownDocKeys.length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing will be assigned — they'll activate straight into whatever
                  they were invited for. Add a document below if this one needs it.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {shownDocKeys.map((key) => {
                    const alreadySigned = signedTemplates.includes(key);
                    return (
                      <label key={key}
                        className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${
                          alreadySigned ? 'border-green-800/20 bg-cream-100/60 cursor-default'
                          : effectiveDocs.has(key) ? 'border-green-700 bg-green-50 cursor-pointer'
                          : 'border-green-800/15 hover:bg-green-50/50 cursor-pointer'}`}>
                        <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
                          checked={alreadySigned || effectiveDocs.has(key)}
                          disabled={alreadySigned}
                          onChange={() => toggleDoc(key)} />
                        <span className="min-w-0">
                          <span className="block text-[14px] leading-snug text-green-900">{titleFor(key)}</span>
                          {alreadySigned && <span className="block text-[11.5px] text-green-700 mt-0.5">Already signed</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* ⚠️ PARTYROLE §4c — NOTHING IS MANDATORY, EVERYTHING IS PERMITTED.
                  The checkboxes above are the SUGGESTION; this is the reach. A
                  control built only from category defaults can subtract but never
                  add outside them, which is useless for the case the owner named:
                  a seller who never visits owes nothing, and the same seller
                  delivering the horse owes the general release. The judgement is
                  staff's; the system has no opinion, so nothing here is filtered
                  by category. */}
              {addableTemplates.length > 0 && (
                <div className="mt-3">
                  {!addingDoc ? (
                    <button type="button" onClick={() => setAddingDoc(true)}
                      className="text-sm text-green-800 underline underline-offset-2">
                      + Add another document
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="form-input w-auto max-w-full text-sm" defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          toggleDoc(e.target.value);
                          setAddingDoc(false);
                        }}>
                        <option value="">Choose a document…</option>
                        {addableTemplates.map((t) => (
                          <option key={t.template_key} value={t.template_key}>{t.title}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setAddingDoc(false)}
                        className="text-sm text-muted px-2">Cancel</button>
                    </div>
                  )}
                </div>
              )}

              {/* ⚠️ NOSTRIP §4 — SAY IT BEFORE DOING IT.
                  This selection used to DESTROY everything outside it, silently:
                  six documents in, four out, with no audit row, no reason, no
                  actor and no undo. Now it destroys nothing, and this panel is
                  where a staff member who genuinely wants paperwork off somebody's
                  record has to say so — by name, and with a reason. The mitigation
                  CATEGORISE shipped explained the prefill; it did not gate. */}
              {wouldDrop.length > 0 && (
                <div className="mt-4 rounded-lg border border-gold-700/30 bg-gold-50/40 p-4">
                  <p className="text-[13.5px] text-green-900 font-medium mb-1">
                    They already owe paperwork this selection doesn't cover
                  </p>
                  <ul className="text-[13px] text-secondary list-disc pl-5 mb-2 space-y-0.5">
                    {wouldDrop.map((r) => (
                      <li key={r.template_key}>
                        {titleFor(r.template_key)}
                        {r.satisfied && <span className="text-green-700"> — already signed, stays on the record</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12.5px] text-muted mb-2">
                    These stay on their record unless you say otherwise. Signed paperwork is
                    never removed — it is the evidence that they were asked and agreed.
                  </p>
                  {dropRemovable.length > 0 && (
                    <>
                      <label className="flex items-start gap-2.5 text-[13px] text-green-900 cursor-pointer">
                        <input type="checkbox" className="accent-green-700 w-[16px] h-[16px] mt-0.5"
                          checked={removeHeld} onChange={() => setRemoveHeld((v) => !v)} />
                        <span>
                          Stop asking them for{' '}
                          <strong className="font-medium">
                            {dropRemovable.map((r) => titleFor(r.template_key)).join(', ')}
                          </strong>
                          {' '}— kept on the record, marked skipped with your name, and reversible
                          from their Paperwork panel.
                        </span>
                      </label>
                      {removeHeld && (
                        <input type="text" className="form-input mt-2 text-sm" value={removeReason}
                          onChange={(e) => setRemoveReason(e.target.value)}
                          placeholder="Why are these no longer required? (required)" />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mb-6">
              <span className="form-label">Offerings (optional)</span>
              <p className="text-sm text-muted mb-2.5">
                What they're purchasing — their first order. Each is its own item; the
                mechanics (single, pack, or recurring) are shown per line.
              </p>
              {visibleOfferings.length === 0 ? (
                <p className="text-sm text-muted">
                  {categories.length === 0
                    ? 'Choose a category above to see its offerings.'
                    : 'No purchasable offerings for this category.'}
                </p>
              ) : (
                <div className="space-y-4 border border-green-800/15 rounded-lg p-4">
                  {Object.entries(
                    visibleOfferings.reduce<Record<string, Offering[]>>((acc, o) => {
                      const k = o.service_type ?? 'Other';
                      (acc[k] ??= []).push(o); return acc;
                    }, {}),
                  )
                    // Lessons are ALWAYS the top group, whatever categories are
                    // checked; the rest keep their catalog order.
                    .sort(([a], [b]) =>
                      (a === 'RIDING_LESSON' ? 0 : 1) - (b === 'RIDING_LESSON' ? 0 : 1))
                    .map(([svc, items]) => (
                    <div key={svc}>
                      <p className="text-xs uppercase tracking-wide text-secondary/70 mb-1.5">
                        {svc.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      {svc === 'RIDING_LESSON' && (
                        <p className="text-xs text-gold-ink mb-2 leading-relaxed">{EVALUATION_LESSON_NOTE}</p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-2">
                        {items.map((o) => (
                          <label key={o.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                              offeringIds.includes(o.id) ? 'border-green-700 bg-green-50 text-green-900'
                                : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                            <input type="checkbox" className="accent-green-700 w-[17px] h-[17px]"
                              checked={offeringIds.includes(o.id)} onChange={() => toggleOffering(o.id)} />
                            <span className="min-w-0 flex-1">
                              {o.name}
                              {o.config_kind === 'recurring' && o.weekly_frequency
                                ? <span className="text-xs text-muted"> · {o.weekly_frequency}×/wk monthly</span>
                                : o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1
                                  ? <span className="text-xs text-muted"> · {o.unit_count} sessions</span>
                                  : null}
                            </span>
                            <span className="text-green-900 whitespace-nowrap">{money(o.price_amount ?? 0)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {offeringIds.length > 0 && (
              <div className="mb-6">
                <span className="form-label">Payment</span>
                <p className="text-sm text-muted mb-2.5">Total {money(offeringTotal)}. Mark how much they've paid so far.</p>
                <div className="flex flex-wrap gap-3 mb-3">
                  {(['unpaid', 'partial', 'paid'] as const).map((s) => (
                    <label key={s}
                      className={`px-4 py-2 rounded-lg border cursor-pointer text-sm capitalize ${
                        payStatus === s ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                          : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                      <input type="radio" name="paystatus" className="hidden"
                        checked={payStatus === s} onChange={() => setPayStatus(s)} />
                      {s}
                    </label>
                  ))}
                </div>
                {payStatus === 'partial' && (
                  <Field label="Amount already paid">
                    <input type="number" min={0} max={offeringTotal} step="0.01" className="form-input w-40"
                      value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} placeholder="0.00" />
                    <p className="text-xs text-muted mt-1">
                      Balance shown to them: {money(Math.max(offeringTotal - (Number(partialAmount) || 0), 0))}
                    </p>
                  </Field>
                )}
                {payStatus !== 'unpaid' && (
                  <Field label="Payment method">
                    <select className="form-input w-48" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {['Zelle', 'Cash', 'Check', 'Card', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            )}

            <Field label="Notes (optional)">
              <textarea rows={2} className="form-input resize-none" value={notes}
                onChange={(e) => setNotes(e.target.value)} placeholder="Internal note about this invite" />
            </Field>
          </>
        )}

        {/* NOSTRIP §4: the removal is gated, not merely announced — a reason is
            what makes the skip mark worth more than the delete it replaced. */}
        <button type="submit"
          disabled={working || !email.trim() || narrowingBlocked}
          className="btn-primary">
          {working ? 'Sending…' : primaryLabel}
        </button>
        {narrowingBlocked && (
          <p className="text-[12.5px] text-gold-800 mt-2">
            Say why those documents are no longer required, or untick the removal.
          </p>
        )}
        {error && <p className="form-error mt-4" role="alert">{error}</p>}
      </form>

      {!hideResult && result && (
        <InviteResultPanel url={result.url} emailed={result.emailed}
          emailError={result.emailError} email={result.email} className="mt-6 p-5" />
      )}
    </>
  );
}
