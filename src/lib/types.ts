/* Platform domain types mirroring the Supabase data model
 * (supabase/migrations-archive/20260623010000_platform_data_model.sql).
 */

export type Segment = 'rider' | 'horse' | 'acquisition';

/** Flexible DISPLAY-ONLY pricing for acquisition offerings. Staff compute the
 *  actual charge per engagement; the catalog only renders this as text. */
export interface PriceModel {
  kind: 'fixed' | 'percent' | 'fee_plus_percent' | 'inquire';
  fee_amount?: number | null;
  percent?: number | null;
  cadence?: 'one_time' | 'per_session' | 'monthly' | 'per_engagement' | null;
  basis?: string | null; // what the % is of, e.g. 'sale price' (label only)
}
export type PriceUnitDb = 'session' | 'week' | 'month' | 'flat' | 'percent';
export type ContactMethod = 'text' | 'call' | 'email';

export type RequestStatus = 'new' | 'contacted' | 'invited' | 'expired' | 'converted';
export type InvitationStatus = 'sent' | 'accepted' | 'expired' | 'revoked';
export type OrderStatus =
  | 'draft' | 'awaiting_payment' | 'paid' | 'cancelled' | 'expired';
/** TWO METHODS. Owner, 2026-08-25: "thats it there are only two choices for
 *  payment"; 2026-08-26: Stripe and card removed from every surface. Stripe was
 *  never configured, so no production row has ever held 'stripe'. */
export type PaymentMethod = 'zelle' | 'cash';
export type PaymentStatus =
  | 'pending' | 'matched' | 'confirmed' | 'review' | 'failed' | 'refunded';
export type BookingStatus =
  | 'pending_slot' | 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';

export interface Profile {
  user_id: string;
  contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  /** Sourced from the linked contact record (profiles.phone dropped 2026-08-02). */
  phone: string | null;
  // Address, mobile, WhatsApp, socials and contact preferences are NOT here:
  // they live on `contacts`, the single person record (see
  // docs/archive/PERSON_DATA_CONSOLIDATION.md). The look-alike columns that used to sit
  // on profiles had zero writers for their whole life and were dropped in S6 —
  // they were the trap behind "I typed my address and it disappeared".
  is_admin: boolean;
  created_from_request_id: string | null;
  created_at: string;
  updated_at: string;
  // Community / social layer (migration 20260623040000)
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  riding_level: string | null;
  is_suspended: boolean;
  /** A3: when this account first dismissed the app-overview tour (null = show
   *  it on next login). Menu re-opens never stamp it. Kept as the legacy
   *  "any form factor" stamp; the split markers below are authoritative. */
  tour_seen_at?: string | null;
  /** A3 split persistence: the desktop and mobile tours are different
   *  experiences — each auto-shows on ITS form factor until dismissed there. */
  tour_seen_desktop_at?: string | null;
  tour_seen_mobile_at?: string | null;
}

/** Flat catalog: an Offering IS the purchasable item (the tier layer was removed
 *  2026-07-08). Each offering carries its own price, purchase type, and — for
 *  riding lessons — whether a horse is included. */
export type PurchaseType = 'one_time' | 'subscription' | 'deposit_retainer';

/** The mechanics bucket a SKU falls in (Phase 4). Drives the per-line config UI
 *  and the provisioning flow. NOT a tier — every offering is its own SKU. */
export type OfferingConfigKind =
  | 'scheduled'            // ad-hoc: buy N units, book 1..N specific date/times
  | 'recurring'            // monthly plan: staff choose the days, the month's sessions follow
  | 'intake_finder'        // Find-a-Horse: 0 purchase config, unlocks a criteria form
  | 'intake_evaluation'    // Horse Evaluation: 0 purchase config, unlocks an intake form
  | 'document_transaction' // Transaction Assistance: config is of the documents
  | 'inquire';             // parent grouping / inquire-only

export interface Offering {
  id: string;
  segment: Segment;
  name: string;
  tagline: string | null;
  description: string | null;
  slug: string;
  active: boolean;
  sort_order: number;
  service_type: string | null;
  price_amount: number | null;
  price_unit: PriceUnitDb | null;
  price_min: number | null;
  purchase_type: PurchaseType | null;
  /** Riding lessons only: true = "Ride our horse", false = "With your horse",
   *  null = not a lesson. */
  horse_included: boolean | null;
  is_popular: boolean;
  note: string | null;
  price_model: PriceModel | null;
  /** Phase 4 structural config: the SKU's mechanics as data, not parsed from name. */
  config_kind: OfferingConfigKind | null;
  /** Scheduled SKUs: # of deliverable units (lessons/sessions) this SKU grants. */
  unit_count: number | null;
  /** Recurring SKUs: sessions per week (1/2/3). */
  weekly_frequency: number | null;
  /** Card corner badge text ("Most Popular", "Best Value"). Set → renders as the
   *  badge; null + is_popular → legacy "Popular". */
  badge_label: string | null;
}

export interface ProposedTime {
  date: string;   // ISO date ('' when no specific week was chosen)
  time: string;   // free text e.g. "morning" or "Weekdays AM & PM"
  /* Structured-availability extras (booking request week picker). Optional so
   * legacy {date, time} entries remain valid rows in the same jsonb column. */
  end?: string;   // ISO date — Saturday closing the Sun–Sat window
  label?: string; // human-readable window, e.g. 'Jul 5 – Jul 11, 2026'
  days?: string;  // day-of-week preference, e.g. 'Open to any day of the week' or 'Mon, Wed'
}

/** The service category the unified intake form shape-shifts by. */
export type RequestCategory =
  | 'general'
  | 'lessons'
  | 'horse_care'
  | 'acquisition'
  | 'media'
  | 'partnership'
  | 'gift';

/** Which public form the request came in through. */
export type RequestChannel = 'contact' | 'inquiry' | 'booking' | 'kiosk' | 'gift';

export interface RequestInput {
  /** First + last are the canonical split; last name is required server-side. */
  first_name: string;
  last_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_method?: ContactMethod;
  proposed_times?: ProposedTime[];
  notes?: string;
  category?: RequestCategory;
  channel?: RequestChannel;
  /** The page/context the visitor submitted from (preset key). */
  entry_location?: string;
  /** Hidden purchase-intent tag for analytics. */
  intent?: string;
  /** Category-specific answers (C1), keyed by field key → requests.details. */
  details?: Record<string, string>;
}

export interface RequestSelectionInput {
  offering_id?: string;
  offering_slug?: string;
  label?: string;
}

export interface Invitation {
  id: string;
  email: string;
  status: InvitationStatus;
  expires_at: string;
  request_id: string | null;
  /** 'COMMUNITY' (an account claim) or 'CONTRACT' (a counterparty who already
   *  HAS an account). P1 ITEM 1: a counterparty with no account is invited as
   *  COMMUNITY carrying `document_id`, so ONE email claims the account and
   *  names the contract — the CONTRACT kind is left for the case it serves. */
  kind?: 'COMMUNITY' | 'CONTRACT';
  /** The contract this invitation ALSO carries, if any. Set, the claim page
   *  routes to that document instead of the ordinary landing rule. */
  document_id?: string | null;
}

/** Backed by the `purchases` table (spine refactor). The exported name stays
 *  `Order` so importing UI keeps its shape; the columns are the purchases ones. */
export interface Order {
  id: string;
  /** The order number, 'PUR-000001' (assigned by the purchases_assign_code
   *  trigger). Nullable only for rows that predate it. */
  display_code: string | null;
  buyer_user_id: string;
  status: OrderStatus;
  /** The order's TRUE status code from `status_events_vocab`, denormalised onto the
   *  row by `trg_status_purchases`. RICHER THAN `status`: it is what distinguishes a
   *  declared order ('payment_pending_zelle' / 'payment_pending_cash') from a silent
   *  one ('submitted'), which the five-value `status` column cannot express. Read it
   *  first wherever a state is shown; `status` is the fallback for rows written
   *  before the trigger existed. */
  current_status: string | null;
  payment_method: PaymentMethod | null;
  /** Inline payment state on the purchase row. ⚠️ NO LONGER THE SOURCE OF TRUTH:
   *  `payments` (CR-76b, 2026-08-26) carries one numbered record per input on the
   *  payment screen, which is what makes a split between cash and Zelle
   *  expressible. This column is kept in step by the same five doors and is safe
   *  to read for "is this order settled" — but the METHOD and the history live on
   *  the payment records. (An older `payments` table was retired long before
   *  this one; they share only a name.) */
  payment_status: 'unpaid' | 'pending' | 'paid';
  amount: number;
  payment_reference: string | null;
  unique_amount: number | null;
  paid_at: string | null;
  created_at: string;
  /** ONBOARD §6 — the buyer's own CLAIM that they have paid (or will pay cash).
   *  Never a confirmation: payment_status above is still the only truth, and only
   *  staff reconciliation writes it. */
  client_reported_method: 'zelle' | 'cash' | null;
  client_reported_reference: string | null;
  client_reported_at: string | null;
  items?: OrderItem[];
}

/** Backed by the `purchase_items` table. */
export interface OrderItem {
  id: string;
  purchase_id: string;
  offering_id: string | null;
  label: string;
  price_amount: number;
  price_unit: PriceUnitDb;
}

/** Inline payment view read off a purchase row. ⚠️ NOT the payment RECORD — see
 *  `paymentLedger.ts`; `payments` was reintroduced 2026-08-26 as one numbered
 *  entry per input on the payment screen, which is a different thing from the
 *  older table of the same name that this comment used to say was gone. */
export interface Payment {
  method: PaymentMethod | null;
  amount: number;
  reference_code: string | null;
  status: string;
}

