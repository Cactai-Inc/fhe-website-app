import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  adminSendInvitation, categoryDocumentDefaults, suggestedCategoryForContact,
  onboardingTemplateOptions, getContactRequiredDocumentsState,
  narrowContactRequiredDocuments, contactProvisioningDraft,
  serviceTypeDocumentDefaults, TAG_LABEL, TAG_REASON,
  type CategoryDocDefault, type ServiceTypeDocDefault,
  type AdminInviteResult, type RequiredDocumentState,
} from '../../lib/admin';
import { fetchOfferings, contactDossier, updateContactRecord } from '../../lib/api';
import { InviteResultPanel } from './InviteResultPanel';
import type { AgreedLesson } from './AgreedLessonPanel';
import { X } from 'lucide-react';
import type { Offering } from '../../lib/types';
import { isEvaluationOffering, serviceDisplayRank } from '../../lib/serviceCatalog';

/**
 * ⚠️ TASK-PAMELA §A — THE ACCOUNT IS REAL WHEN IT IS SAVED, NOT WHEN IT IS SENT.
 *
 * Owner, 2026-08-23: *"i can create the account but my changes dont get saved
 * until i send her the invite to activate the account… im making a contract for
 * her so i want to wait until the contract is created, then i will send her the
 * activation email."* And the framing: *"every account hinges on activation and
 * it shouldnt."*
 *
 * This form had ONE submit path and it was `adminSendInvitation`. Every field it
 * collected — category, paperwork, offerings, payment, notes — was thrown away
 * unless staff also emailed the person in the same click. There are now two acts:
 *
 *   SAVE            provisions the account and stops. The whole spine runs
 *                   (contact, clients row, categories, onboarding documents, the
 *                   order, apply_affiliations); the invitation is written as a
 *                   DRAFT; no email leaves and no live link is retired. Per the
 *                   owner's own terminology this IS the activation — *"truly the
 *                   activation is when i create an account."*
 *   SEND INVITATION delivers the claim link. Reachable any time after, and it
 *                   sends the token the draft has been holding, so the link staff
 *                   saved is the link the client receives.
 *
 * A saved-but-unsent account re-opens THIS form, prefilled from its own draft —
 * `invitations.categories / offering_ids / template_keys` are that draft's own
 * columns, so there is no second store and nothing to keep in sync.
 *
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

/* ⚠️ OFFERINGDOCS 2026-08-24 — THE CATEGORY MAPS ARE GONE.
   `CATEGORY_SEGMENTS` filtered the purchasable offerings by whichever boxes were
   ticked, and `TOKEN_TO_DISPLAY` fed the preselect. Both are removed with the
   checkbox block itself: staff no longer tick a tag, so a tag can no longer
   decide what they are allowed to sell. Every purchasable offering is offered.
   Owner: "i dont check any boxes for their tagging they just exist as an
   account." */

// Offerings the owner removed from INVITE selection (2026-07-28). They stay
// active in the DB because the public catalog still lists them (zero purchases /
// invitations to date) — filtered here, not retired, so the storefront is
// unchanged until the owner decides otherwise.
const INVITE_HIDDEN_OFFERING_IDS = new Set<string>([
  '62f29124-826a-4e7b-bf8c-53d223d97854', // 3x Weekly (riding lessons)
  /* ⚠️ THE EVALUATION LESSON IS NO LONGER HIDDEN (owner, 2026-08-24).
     It was withheld here in July on the reading that "the first lesson IS the
     evaluation now" — i.e. it was folded into a Single Lesson rather than sold.
     Today's ruling reverses that: it is a distinct offering, it is the FIRST
     purchase, and the self-onboarding shop refuses to sell anything else until it
     is added. Staff could not offer the one thing every new rider must buy. */
]);

/* ⚠️ THE EVALUATION NOTE IS GONE FROM THIS SURFACE (owner, 2026-08-25):
   "this is handled by software not by surfacing words i read and comply with,
   also the notes like that are things that should be in the client facing content
   not things facing me as the admin."

   It was a paragraph of arrive-15-minutes-early guidance shown to STAFF, asking
   them to remember a rule the form could simply enforce. The rule is now enforced
   below; the sentence still lives where it is for — the member's own shop, at
   Onboarding.tsx. */

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
  /**
   * ⚠️ THE SCHEDULING SECTION, AND THE ONLY TWO REASONS IT EXISTS.
   *
   * Owner, 2026-08-23: *"the huge provision form is mostly content that matters
   * for one of two reasons, A) they are a rider… B) they have an order created
   * for them that involves scheduling in some capacity… If they are not a rider,
   * it shouldnt be shown to me, if they dont have an order with offering that
   * requires scheduling it shouldnt be shown to me."*
   *
   * Hosts pass the agreed-time panel here rather than as `children`, because THIS
   * form is the only thing that knows both conditions: the RIDER tag (ticked here,
   * or already standing on the contact) and whether any selected offering's
   * `config_kind` is `scheduled` or `recurring`. Neither true → it does not
   * render at all. Not collapsed, not present-but-empty.
   */
  scheduling?: ReactNode;
}

export function ProvisionClientForm({
  source, contactId, requestId, email: emailProp,
  firstName, lastName, onProvisioned, hideResult, agreedLesson, children, scheduling,
}: ProvisionClientFormProps) {
  const emailLocked = Boolean(emailProp);
  const [email, setEmail] = useState(emailProp ?? '');
  /* ⚠️ WHO THEY ARE — RECONCILED WITH THE TWO CLIENT-FACING INTAKES (§A).
     `/sign/*` asks name + phone + address; the invited intake (Onboarding) asks
     name + phone + DOB + address; this staff form asked for NONE of them, so the
     one person who already has all of it — the staff member who just had them on
     the phone — had nowhere to put it and the record went out empty. D22 §0 is
     the standard: name + email + phone are the minimum on every path, and the
     address is required where a contract prints it. */
  const [ident, setIdent] = useState({
    first_name: firstName ?? '', last_name: lastName ?? '', phone: '',
    address_line1: '', city: '', state: '', postal_code: '',
  });
  const setIdentField = (k: keyof typeof ident) => (v: string) => setIdent((p) => ({ ...p, [k]: v }));
  /** The groups already standing on this contact (RIDER / HORSE_OWNER / …). */
  const [standingGroups, setStandingGroups] = useState<string[]>([]);
  /** PAMELA §A — a saved-but-unsent provisioning on this contact, if any. */
  const [draftId, setDraftId] = useState<string | null>(null);
  /** Which act the last submit was. Drives the confirmation, not the button. */
  const [savedOnly, setSavedOnly] = useState(false);
  /* The categories the invitation still RECORDS. Never ticked by staff any more —
     kept as state only so a saved draft round-trips unchanged. */
  const [categories, setCategories] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  /** OFFERINGDOCS §1 — service_type → the documents that service requires. */
  const [serviceDocs, setServiceDocs] = useState<ServiceTypeDocDefault[]>([]);
  const [docChecked, setDocChecked] = useState<Set<string> | null>(null);
  /** Every document staff MAY apply — not only what the categories suggest. */
  const [allTemplates, setAllTemplates] = useState<{ template_key: string; title: string }[]>([]);
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

  /** NOSTRIP §4 — what this person ALREADY owes. Without it this screen could
   *  not name what a narrower category selection was about to take away, and
   *  for most of this system's life it took it away silently. */
  const [held, setHeld] = useState<RequiredDocumentState[]>([]);
  const [removeHeld, setRemoveHeld] = useState(false);
  const [removeReason, setRemoveReason] = useState('');

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    serviceTypeDocumentDefaults().then(setServiceDocs).catch(() => setServiceDocs([]));
    onboardingTemplateOptions().then(setAllTemplates).catch(() => setAllTemplates([]));
    fetchOfferings().then(setOfferings).catch(() => setOfferings([]));
  }, []);

  /* ⚠️ THE CART-DERIVED CATEGORY PREFILL IS REMOVED (OFFERINGDOCS).
     CATEGORISE built it because the category decided the document set and the
     only other signal was whichever funnel a visitor happened to submit from.
     The cart was the better guess — but it was still a guess feeding a tag that
     then created a legal obligation. The cart's OFFERINGS now decide the
     documents directly (`service_type_document_requirements`), so there is
     nothing left for a derived category to inform. */

  // NOSTRIP §4 — the paperwork already standing on this person's record, so the
  // screen can SAY, by name, what a narrower selection would remove, BEFORE the
  // action commits. CATEGORISE shipped an informational note about where the
  // prefill came from; this is the part that was missing — the note explained,
  // it did not gate.
  useEffect(() => {
    if (!contactId) { setHeld([]); return; }
    getContactRequiredDocumentsState(contactId).then(setHeld).catch(() => setHeld([]));
  }, [contactId]);

  // Which templates they have already EXECUTED — shown as complete rather than
  // re-requested. (The category preselect this used to drive is gone: a tag no
  // longer decides paperwork, so guessing one from signed documents decides
  // nothing.)
  useEffect(() => {
    if (!contactId) return;
    suggestedCategoryForContact(contactId)
      .then((r) => setSignedTemplates(r.executed_templates ?? []))
      .catch(() => {});
  }, [contactId]);

  /* ⚠️ PAMELA §A — RE-OPEN WHAT WAS SAVED, AND WHAT IS ALREADY KNOWN.
     Two reads, both prefills, neither ever overwriting a staff edit in progress:
       · the DRAFT invitation — the categories / documents / offerings a previous
         Save persisted, so a reload shows the work rather than a blank form;
       · the CONTACT record — name, phone and address already on file, so the
         identity block below is a review, not a re-interrogation. `standing.groups`
         also answers half the scheduling gate: a contact who is ALREADY a rider
         gets the section without anybody re-ticking the box. */
  const prefilledContact = useRef<string | null>(null);
  useEffect(() => {
    if (!contactId || prefilledContact.current === contactId) return;
    prefilledContact.current = contactId;
    contactProvisioningDraft(contactId)
      .then((d) => {
        if (!d) return;
        setDraftId(d.id);
        // Carried through untouched — a draft's recorded categories are history,
        // not a control. Nothing on this screen sets or reads them any more.
        setCategories((d.categories ?? []).filter(Boolean));
        if (d.template_keys) setDocChecked(new Set(d.template_keys));
        if (d.offering_ids?.length) setOfferingIds(d.offering_ids);
      })
      .catch(() => { /* the form still works from scratch */ });
    contactDossier(contactId)
      .then((dos) => {
        const c = dos.contact as Record<string, unknown>;
        const str = (k: string) => (c?.[k] == null ? '' : String(c[k]));
        setIdent((prev) => ({
          first_name: prev.first_name || str('first_name'),
          last_name: prev.last_name || str('last_name'),
          phone: prev.phone || str('phone'),
          address_line1: prev.address_line1 || str('address_line1'),
          city: prev.city || str('city'),
          state: prev.state || str('state'),
          postal_code: prev.postal_code || str('postal_code'),
        }));
        setStandingGroups(dos.standing?.groups ?? []);
      })
      .catch(() => setStandingGroups([]));
  }, [contactId]);

  /* ⚠️ OFFERINGDOCS — THE SCREEN RESOLVES DOCUMENTS THE WAY THE DATABASE DOES.
     It used to walk the ticked CATEGORIES through `category_document_requirements`,
     which is the same walk `apply_category_documents` made — the two agreed, and
     both were wrong, because a ticked box is not why anybody owes a document.
     Now both sides read `service_type_document_requirements` against the SERVICE
     of each selected offering, which is what `apply_offering_documents` does on
     the purchase trigger. Same source, same answer, no tag in between. */
  const derivedDocKeys = useMemo(() => {
    const keys = new Set<string>();
    const chosen = new Set(
      offerings.filter((o) => offeringIds.includes(o.id))
        .map((o) => o.service_type).filter(Boolean) as string[]);
    for (const r of serviceDocs) if (chosen.has(r.service_type)) keys.add(r.template_key);
    return keys;
  }, [serviceDocs, offerings, offeringIds]);

  const titleFor = (key: string) =>
    defaults.find((d) => d.template_key === key)?.title
    ?? allTemplates.find((t) => t.template_key === key)?.title
    ?? key;
  const effectiveDocs = docChecked ?? derivedDocKeys;
  /* `shownDocKeys` (prefill ∪ hand-added, INCLUDING un-ticked suggestions) went with
     the checkbox grid — see `docRowKeys` below. Un-ticking and deleting are now the
     same act, so a suggestion that is off is simply not a row. */
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
  /* ⚠️ AN ORDER FORM FOR PAPERWORK TOO (owner, 2026-08-25): "we can preselect and
     make rows for the documents they should be signing … a quick click of an X to
     remove it … just show a row with the menu to select a new document and the
     placeholder selection says select a document to add it, and when i select
     something it becomes a row and the x is there to delete it and the new empty
     selectable row appears below the one i just added and moves up when something
     is deleted."

     So the rows ARE the answer, not a grid of ticked and unticked boxes. A document
     on the record is a row; removing it is an X; the trailing row is always an empty
     menu. `docRowKeys` is therefore what is ON — the prefill from the offerings,
     plus anything added by hand, minus anything removed — where the old
     `shownDocKeys` also carried un-ticked suggestions that now simply are not rows.
     Unticking and deleting became the same act, which is what makes the trailing
     menu honest: everything not on a row is in it. */
  const docRowKeys = useMemo(() => {
    const on = new Set<string>(effectiveDocs);
    signedTemplates.forEach((k) => on.add(k)); // signed paperwork is never not-on
    return Array.from(on);
  }, [effectiveDocs, signedTemplates]);

  const addableTemplates = useMemo(
    () => allTemplates.filter((t) => !docRowKeys.includes(t.template_key)),
    [allTemplates, docRowKeys],
  );

  /* EVERY purchasable offering. The segment filter was driven by the ticked
     categories, so unticking a box could hide a service staff were about to
     sell — a tag deciding what the business may offer. Inquire-only rows and
     price-less grouping rows are still excluded: they are not purchasable. */
  const visibleOfferings = offerings.filter(
    (o) => o.config_kind !== 'inquire'
      && o.price_amount != null
      && !INVITE_HIDDEN_OFFERING_IDS.has(o.id));

  /* THE SCHEDULING SECTION'S EXACT CONDITION (owner): the RIDER tag — now the
     DERIVED one, since nothing is ticked — or a selected offering whose
     config_kind schedules something. Neither → it does not render at all. */
  const schedulingNeeded = useMemo(() => {
    if (standingGroups.includes('RIDER')) return true;
    return offerings.some(
      (o) => offeringIds.includes(o.id)
        && (o.config_kind === 'scheduled' || o.config_kind === 'recurring'));
  }, [standingGroups, offerings, offeringIds]);

  const offeringTotal = useMemo(() => {
    let t = 0;
    for (const o of offerings)
      if (offeringIds.includes(o.id)) t += o.price_amount ?? 0;
    return t;
  }, [offerings, offeringIds]);

  function toggleDoc(key: string) {
    setDocChecked((prev) => {
      const base = prev ?? new Set(derivedDocKeys);
      const s = new Set(base);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }
  /* ⚠️ THE EVALUATION IS THE FIRST LESSON — ENFORCED, NOT ANNOUNCED (owner,
     2026-08-25): "the evaluation being a requirement means it should be the only
     riding lesson option to select right now until i select it nothing else can be
     added from that category."

     The member's own shop already worked this way; this staff form only had a
     paragraph asking the reader to comply. Same rule, same shape: the other riding
     lessons stay VISIBLE and readable (opacity, not hidden — the owner's earlier
     ruling on the shop) so it is obvious what selecting the evaluation unlocks.
     Nothing is locked when the catalog has no evaluation lesson to require. */
  const evaluationOffering = useMemo(
    () => visibleOfferings.find(isEvaluationOffering) ?? null,
    [visibleOfferings]);
  const lessonsLocked = !!evaluationOffering && !offeringIds.includes(evaluationOffering.id);

  function toggleOffering(id: string) {
    setOfferingIds((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      /* Dropping the evaluation drops every lesson it unlocked — leaving them
         selected would provision a set the rule says is not orderable. */
      if (evaluationOffering && id === evaluationOffering.id) {
        const lessonIds = new Set(visibleOfferings
          .filter((o) => o.service_type === 'RIDING_LESSON').map((o) => o.id));
        return prev.filter((x) => !lessonIds.has(x));
      }
      return prev.filter((x) => x !== id);
    });
  }

  /** Which act is running — so the button that is NOT pressed can also disable. */
  const [pending, setPending] = useState<'save' | 'send' | null>(null);

  async function submit(e: React.FormEvent, send: boolean) {
    e.preventDefault();
    setWorking(true); setPending(send ? 'send' : 'save'); setError(null); setResult(null);
    try {
      /* The invitation still CARRIES categories (a saved draft round-trips them),
         but nothing on this screen sets them any more and they no longer decide
         a single document. Tags are derived — see `apply_affiliations`. */
      const tokens = categories;
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
        // The names travel on the RPC (they land on the invitation and are carried
        // onto the profile at redemption); everything else in the identity block
        // is written to the contact record below, through its own writer.
        ...(ident.first_name.trim() ? { firstName: ident.first_name.trim() } : {}),
        ...(ident.last_name.trim() ? { lastName: ident.last_name.trim() } : {}),
        sendInvitation: send,
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
      /* ⚠️ D22 — THE CONTACT RECORD IS THE SOURCE OF TRUTH FOR PARTY FIELDS.
         Phone and address go through `update_contact_record`, the incumbent staff
         writer, onto the contact the act just resolved — so they reach the party
         tokens of every contract this person is on, not just this screen. Written
         AFTER provisioning because on a brand-new account there is no contact to
         write to until the spine has made one. Best-effort: the account exists
         either way, and losing an address must not read as "the save failed". */
      const targetContact = r.contactId ?? contactId;
      const patch: Record<string, string> = {};
      for (const k of ['phone', 'address_line1', 'city', 'state', 'postal_code'] as const) {
        if (ident[k].trim()) patch[k] = ident[k].trim();
      }
      if (targetContact && Object.keys(patch).length > 0) {
        try { await updateContactRecord(targetContact, patch); }
        catch { /* provisioning stands; staff can correct the record directly */ }
      }

      setSavedOnly(!send);
      setResult({ url: r.registerUrl ?? '', emailed: r.emailed, emailError: r.emailError, email: email.trim() });
      if (r.inviteStatus === 'draft' && r.invitationId) setDraftId(r.invitationId);
      if (send) setDraftId(null);
      onProvisioned?.(r);
      setRemoveHeld(false); setRemoveReason('');
      if (contactId) getContactRequiredDocumentsState(contactId).then(setHeld).catch(() => {});
      // Only a SEND finishes the New-client page's job; a save is meant to be
      // returned to, so clearing the form under the staff member would be wrong.
      if (source === 'new' && send) {
        setEmail(''); setCategories([]); setDocChecked(null); setOfferingIds([]);
        setPayStatus('unpaid'); setPartialAmount(''); setNotes('');
        setIdent({ first_name: '', last_name: '', phone: '', address_line1: '', city: '', state: '', postal_code: '' });
      }
    } catch (err) {
      setError(toErrorMessage(err, send ? 'Could not send the invitation.' : 'Could not save the account.'));
    } finally {
      setWorking(false); setPending(null);
    }
  }

  // §L3 — the SEND button says what that one act actually does. When a time was
  // set it books the lesson too, and the label must not hide that.
  const sendLabel = agreedLesson ? 'Book the lesson & send invitation'
    : source === 'submission' ? 'Convert & send invitation'
    : 'Send invitation';
  const saveLabel = draftId ? 'Save changes'
    : source === 'contact' ? 'Save the account'
    : 'Create the account';

  return (
    <>
      <form onSubmit={(e) => void submit(e, true)}>
        {/* ⚠️ SAVED, AND NOT SENT — SAY SO. A contact whose provisioning was saved
            but never delivered must not look identical to one where nothing has
            been done, which is precisely what an un-marked form does. */}
        {draftId && (
          <div className="mb-5 rounded-lg border border-green-700/40 bg-green-50 px-4 py-3">
            <p className="text-[13.5px] text-green-900 font-medium">
              This account exists — the invitation has not been sent.
            </p>
            <p className="text-[12.5px] text-green-900/75 mt-0.5">
              Everything below is saved on their record. Change it as often as you like;
              send the invitation when you're ready for them to set up their login.
            </p>
          </div>
        )}
        {children}
        <Field label="Email">
          <input type="email" required className="form-input" value={email}
            disabled={emailLocked}
            onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
        </Field>

        {/* ⚠️ WHAT WE ALREADY KNOW ABOUT THEM (PAMELA §A).
            Owner: *"if i have any of the info from them already I can add it in
            this section."* Both client-facing intakes collect name, phone and
            address; this staff form collected none of it, so a person staff had
            just spoken to arrived as an email address and nothing else — and the
            contract party tokens that read from this record printed blanks.
            Prefilled from the contact and written back through
            `update_contact_record`, so it reaches every document they are on. */}
        <div className="mb-6">
          <span className="form-label">Their details</span>
          <p className="text-sm text-muted mb-2.5">
            Whatever you already have. They complete the rest when they set up their
            login — nothing here is asked of them twice.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="form-input" value={ident.first_name} placeholder="First name"
              aria-label="First name" onChange={(e) => setIdentField('first_name')(e.target.value)} />
            <input className="form-input" value={ident.last_name} placeholder="Last name"
              aria-label="Last name" onChange={(e) => setIdentField('last_name')(e.target.value)} />
            {/* If staff have it now, the onboarding form stops asking — and if
                they don't, it asks (INTAKE 2026-08-24: my_onboarding_state now
                surfaces on an incomplete profile, not only on unsigned docs). */}
            <input type="tel" inputMode="tel" className="form-input" value={ident.phone} placeholder="Mobile number"
              aria-label="Mobile number" onChange={(e) => setIdentField('phone')(e.target.value)} />
            <input className="form-input" value={ident.address_line1} placeholder="Street address"
              aria-label="Street address" onChange={(e) => setIdentField('address_line1')(e.target.value)} />
            <input className="form-input" value={ident.city} placeholder="City"
              aria-label="City" onChange={(e) => setIdentField('city')(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="form-input" value={ident.state} placeholder="State"
                aria-label="State" onChange={(e) => setIdentField('state')(e.target.value)} />
              <input className="form-input" inputMode="numeric" value={ident.postal_code} placeholder="ZIP"
                aria-label="ZIP" onChange={(e) => setIdentField('postal_code')(e.target.value)} />
            </div>
          </div>
          {/* D22 §0: a contract prints the address, so say so where it matters
              rather than refusing the save — staff may genuinely not have it yet. */}
          <p className="text-[12px] text-muted mt-2">
            A full address is what a contract prints. Leave it blank if you don't have
            it — a partial one (a street with no city) is worse than none.
          </p>
        </div>

        {/* ⚠️ TAGS ARE DERIVED. THERE IS NOTHING TO TICK.
            Owner, 2026-08-24: "those tags are auto set by the purchase, the
            existence of a file, or the existence of a record... i dont check any
            boxes for their tagging they just exist as an account."

            What stood here was four checkboxes — Guest / Rider / Horse owner /
            Deal client — and ticking one wrote that category's document set onto
            the person, whether or not they had bought, visited or agreed to
            anything. That edge is cut in the database too (`_ensure_client_account`
            no longer calls `apply_category_documents`), so this is not a screen
            hiding a control that still works: there is no longer anything for it
            to do. This shows what the record ALREADY says, and why. */}
        <div className="mb-6">
          <span className="form-label">What we know about them</span>
          {standingGroups.length === 0 ? (
            <p className="text-sm text-muted mt-1">
              Nothing yet — and that is a normal, finished state. Tags appear on their
              own when there is a reason: a purchase, a horse, a file, or a contract.
              An account needs none of them to exist.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted mb-2.5">
                Applied automatically, from what is on their record. These describe the
                relationship — none of them requires paperwork by itself.
              </p>
              <div className="flex flex-wrap gap-2">
                {standingGroups.map((g) => (
                  <span key={g}
                    className="inline-flex flex-col px-3 py-2 rounded-lg border border-green-800/15 bg-cream-100/60">
                    <span className="text-[14px] text-green-900 font-medium">{TAG_LABEL[g] ?? g}</span>
                    <span className="text-[11.5px] text-muted">{TAG_REASON[g] ?? 'derived from their record'}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {(

          <>
            <div className="mb-6">
              <span className="form-label">Offerings (optional)</span>
              <p className="text-sm text-muted mb-2.5">
                What they're purchasing — their first order. <strong>This is what decides
                their paperwork</strong>: each service carries its own documents, and the
                list below fills in from whatever you pick here. To comp or discount,
                build the order at full price and settle it from Payment review — the
                paperwork is the same either way.
              </p>
              {visibleOfferings.length === 0 ? (
                <p className="text-sm text-muted">
                  No purchasable offerings are published.
                </p>
              ) : (
                /* ⚠️ AN ORDER FORM, NOT A CATALOGUE (owner, 2026-08-25): "the items
                   can be an order form with line items i add and select from a list
                   on a menu not a giant list of everything with check boxes its a
                   terrible waste of space and on mobile its going to be a nightmare."

                   Was: every purchasable offering rendered as a checkbox, grouped,
                   two columns — the whole catalogue on screen to choose two things
                   from. Now: the chosen lines, and one menu to add another. The menu
                   is a native <select> with <optgroup>s, which is the mobile-native
                   picker and costs one row of space instead of the page.

                   The evaluation rule rides on the SAME data: a locked lesson is a
                   disabled <option>, so it is still listed and readable — the owner's
                   "greyed but still very readable" — without a paragraph explaining
                   why. */
                <div className="border border-green-800/15 p-3">
                  {offeringIds.length === 0 ? (
                    <p className="text-sm text-muted mb-2">No offerings on this order yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 mb-2">
                      {offeringIds.map((id) => {
                        const o = visibleOfferings.find((x) => x.id === id);
                        if (!o) return null;
                        return (
                          <div key={id} className="flex items-baseline gap-2 text-sm border-b border-green-800/[0.06] pb-1.5">
                            <span className="min-w-0 flex-1 text-green-900">
                              {o.name}
                              {o.config_kind === 'recurring' && o.weekly_frequency
                                ? <span className="text-xs text-muted"> · {o.weekly_frequency}×/wk monthly</span>
                                : o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1
                                  ? <span className="text-xs text-muted"> · {o.unit_count} sessions</span>
                                  : null}
                            </span>
                            <span className="text-green-900 whitespace-nowrap">{money(o.price_amount ?? 0)}</span>
                            <button type="button" onClick={() => toggleOffering(id)}
                              aria-label={`Remove ${o.name}`}
                              className="text-muted hover:text-green-900 focus-ring shrink-0">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex items-baseline gap-2 text-sm pt-0.5">
                        <span className="min-w-0 flex-1 text-muted">Total</span>
                        <span className="text-green-900 whitespace-nowrap">{money(offeringTotal)}</span>
                        <span className="w-[14px] shrink-0" aria-hidden="true" />
                      </div>
                    </div>
                  )}
                  <select className="form-input text-sm" value=""
                    aria-label="Add an offering to this order"
                    onChange={(e) => { if (e.target.value) toggleOffering(e.target.value); }}>
                    <option value="">+ Add an offering…</option>
                    {Object.entries(
                      visibleOfferings
                        .filter((o) => !offeringIds.includes(o.id))
                        .reduce<Record<string, Offering[]>>((acc, o) => {
                          const k = o.service_type ?? 'Other';
                          (acc[k] ??= []).push(o); return acc;
                        }, {}),
                    )
                      /* Owner, 2026-08-25: lessons, then horsemanship, then horse
                         training, exercise, clipping. One order, in serviceCatalog. */
                      .sort(([a], [b]) => serviceDisplayRank(a) - serviceDisplayRank(b))
                      .map(([svc, items]) => (
                        <optgroup key={svc} label={svc.replace(/_/g, ' ').toLowerCase()}>
                          {items.map((o) => (
                            <option key={o.id} value={o.id}
                              disabled={lessonsLocked && svc === 'RIDING_LESSON' && !isEvaluationOffering(o)}>
                              {o.name} · {money(o.price_amount ?? 0)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* ⚠️ PAPERWORK COMES AFTER THE OFFERINGS (owner, 2026-08-25): "we can
                preselect and make rows for the documents they should be signing but
                that comes after the selection of offerings."

                It sat ABOVE them, prefilled from a choice the reader had not made yet —
                so the section explaining "the offerings you chose prefill this" was
                shown before there were any. Reading order now matches causal order. */}
            <div className="mb-6">
              <span className="form-label">First-login paperwork</span>
              <p className="text-sm text-muted mb-2.5">
                What they'll review and sign when they activate. <strong>The offerings you
                chose prefill this</strong> — adjust as needed; the invitation email lists
                it. Choose no offerings and nothing is required, which is the right answer
                for a contract party.
              </p>
              <div className="border border-green-800/15 p-3">
                {docRowKeys.length === 0 && addableTemplates.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nothing will be assigned — they'll activate straight into whatever
                    they were invited for. That is correct for someone who has bought
                    nothing.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {docRowKeys.map((key) => {
                      const alreadySigned = signedTemplates.includes(key);
                      return (
                        <div key={key}
                          className="flex items-baseline gap-2 text-sm border-b border-green-800/[0.06] pb-1.5">
                          <span className="min-w-0 flex-1 text-green-900">
                            {titleFor(key)}
                            {alreadySigned && (
                              <span className="text-[11.5px] text-green-700"> · already signed</span>
                            )}
                          </span>
                          {/* Signed paperwork has no X. It is evidence they were asked
                              and agreed, and it is never removed (NOSTRIP §4). */}
                          {alreadySigned ? (
                            <span className="w-[14px] shrink-0" aria-hidden="true" />
                          ) : (
                            <button type="button" onClick={() => toggleDoc(key)}
                              aria-label={`Remove ${titleFor(key)}`}
                              className="text-muted hover:text-green-900 focus-ring shrink-0">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* ⚠️ PARTYROLE §4c — NOTHING IS MANDATORY, EVERYTHING IS PERMITTED.
                        The prefill above is the SUGGESTION; this is the reach. A control
                        built only from category defaults can subtract but never add
                        outside them, which is useless for the case the owner named: a
                        seller who never visits owes nothing, and the same seller
                        delivering the horse owes the general release. Nothing here is
                        filtered by category — the judgement is staff's.
                        The empty row is ALWAYS last, so adding pushes a fresh one down
                        and deleting pulls the list up, with no button to press first. */}
                    {addableTemplates.length > 0 && (
                      <select className="form-input text-sm" value=""
                        aria-label="Add a document"
                        onChange={(e) => { if (e.target.value) toggleDoc(e.target.value); }}>
                        <option value="">Select a document to add it…</option>
                        {addableTemplates.map((t) => (
                          <option key={t.template_key} value={t.template_key}>{t.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

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
                      {[{ v: 'zelle', l: 'Zelle' }, { v: 'cash', l: 'Cash' }].map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
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

        {/* ⚠️ SCHEDULING — SHOWN ONLY FOR THE TWO REASONS IT EXISTS.
            Rider (ticked here or already standing on the record), or a selected
            offering whose config_kind is 'scheduled' / 'recurring'. Neither →
            nothing renders; this is the gate, not a collapse. */}
        {scheduling && schedulingNeeded && scheduling}

        {/* ⚠️ TWO REAL BUTTONS (PAMELA §A rule 2). SAVE is the primary act, because
            it is the one that makes the account exist and the one staff will use
            most; SEND is deliberately separate and reachable at any time after.
            NOSTRIP §4: the removal is gated on both, not merely announced — a
            reason is what makes the skip mark worth more than the delete it
            replaced. */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button"
            onClick={(e) => void submit(e, false)}
            disabled={working || !email.trim() || narrowingBlocked}
            className="btn-primary">
            {pending === 'save' ? 'Saving…' : saveLabel}
          </button>
          <button type="submit"
            disabled={working || !email.trim() || narrowingBlocked}
            className="btn-outline-gold">
            {pending === 'send' ? 'Sending…' : sendLabel}
          </button>
        </div>
        <p className="text-[12px] text-muted mt-2">
          Saving creates the account and keeps every choice above — no email is sent.
          Send the invitation when you want them to set up their login.
        </p>
        {narrowingBlocked && (
          <p className="text-[12.5px] text-gold-800 mt-2">
            Say why those documents are no longer required, or untick the removal.
          </p>
        )}
        {error && <p className="form-error mt-4" role="alert">{error}</p>}
      </form>

      {/* A SAVE has no link to show and no delivery to report — showing the
          invite-result panel would announce an email that deliberately did not
          happen. It gets its own confirmation instead. */}
      {!hideResult && result && (savedOnly ? (
        <div className="mt-6 p-5 rounded-lg border border-green-700/40 bg-green-50">
          <p className="text-[14px] text-green-900 font-medium">Saved. No email was sent.</p>
          <p className="text-[13px] text-green-900/75 mt-1">
            {result.email} has an account and everything you chose is on their record.
            Come back and send the invitation whenever you're ready.
          </p>
        </div>
      ) : (
        <InviteResultPanel url={result.url} emailed={result.emailed}
          emailError={result.emailError} email={result.email} className="mt-6 p-5" />
      ))}
    </>
  );
}
