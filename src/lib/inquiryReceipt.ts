/**
 * WHAT THE VISITOR ACTUALLY SUBMITTED — carried to the confirmation screen.
 *
 * CAREPATH §C6b: *"page 3 shows them the confirmation of the items they
 * selected for their order, the things they input and selected on their form,
 * and a confirmation of the email sent to us and them and that we try to respond
 * within a few hours using their preferred contact method."*
 *
 * The cart is cleared at submit (it must be — the order is placed), so the
 * confirmation screen cannot read it. This is the receipt: written once by
 * `InquiryForm` at submit, read by `Confirmation`, and patched in place when the
 * two email sends report their real outcome.
 *
 * ⚠️ `sends` IS EVIDENCE, NOT OPTIMISM. `null` means "we do not yet know", and
 * the screen says so in those words. Two real leads were lost to a
 * fire-and-forget send that could not report failure; the confirmation screen is
 * never allowed to print "we've emailed you" from an assumption. The durable
 * record is the per-attempt `request_alert_sends` row written server-side —
 * this is only what to tell the person standing in front of us.
 *
 * sessionStorage, deliberately: it is the same session as the cart it replaces,
 * it dies with the tab, and it holds nothing that is not already the visitor's
 * own words back to them.
 */

export interface InquiryReceiptItem {
  name: string;
  price: number;
  unit: string;
  /** Quote-priced: the screen shows NO number for these (§C6b). */
  priceOnEnquiry: boolean;
}

export interface InquirySendOutcome {
  /** true = the endpoint reported a successful send; false = it reported a
   *  failure; null = not yet confirmed. Never assume. */
  staff: boolean | null;
  buyer: boolean | null;
}

export interface InquiryReceipt {
  requestId: string;
  contactMethod: string;
  items: InquiryReceiptItem[];
  /** Every page-2 answer, already labelled by subject and question. */
  answers: Record<string, string>;
  /** The visitor's own free-text note (not the assembled block). */
  notes: string;
  /** Lessons only — the availability block, as prose. */
  availability: string;
  subtotal: number;
  sends: InquirySendOutcome;
}

const KEY = 'fhe-inquiry-receipt-v1';

/** Write or patch the receipt. A partial patch merges over what is there, so the
 *  send outcome can land after the confirmation screen has already mounted. */
export function rememberInquiryReceipt(patch: Partial<InquiryReceipt>): void {
  try {
    const prev = readInquiryReceipt();
    const next = { ...(prev ?? {}), ...patch };
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode, etc.) — the screen degrades to its
       generic copy rather than lying about what it does not know. */
  }
}

export function readInquiryReceipt(): InquiryReceipt | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InquiryReceipt>;
    if (!parsed.requestId) return null;
    return {
      requestId: parsed.requestId,
      contactMethod: parsed.contactMethod ?? '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      answers: parsed.answers ?? {},
      notes: parsed.notes ?? '',
      availability: parsed.availability ?? '',
      subtotal: parsed.subtotal ?? 0,
      sends: {
        staff: parsed.sends?.staff ?? null,
        buyer: parsed.sends?.buyer ?? null,
      },
    };
  } catch {
    return null;
  }
}

export function clearInquiryReceipt(): void {
  try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
