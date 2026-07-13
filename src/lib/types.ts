/* Platform domain types mirroring the Supabase data model
 * (supabase/migrations/20260623010000_platform_data_model.sql).
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
  | 'draft' | 'awaiting_payment' | 'paid' | 'confirmed' | 'cancelled' | 'expired';
export type PaymentMethod = 'zelle' | 'stripe';
export type PaymentStatus =
  | 'pending' | 'matched' | 'confirmed' | 'review' | 'failed' | 'refunded';
export type SlotStatus = 'open' | 'held' | 'booked' | 'blocked';
export type SlotType = 'consultation' | 'onsite_visit' | 'lesson' | 'training' | 'other';
export type LocationMode = 'onsite' | 'mobile';
export type BookingStatus =
  | 'pending_slot' | 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';

export interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
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
}

/** Flat catalog: an Offering IS the purchasable item (the tier layer was removed
 *  2026-07-08). Each offering carries its own price, purchase type, and — for
 *  riding lessons — whether a horse is included. */
export type PurchaseType = 'one_time' | 'subscription' | 'deposit_retainer';

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

export interface RequestInput {
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_method?: ContactMethod;
  proposed_times?: ProposedTime[];
  notes?: string;
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
}

export interface AvailabilitySlot {
  id: string;
  start_at: string;
  end_at: string;
  slot_type: SlotType;
  capacity: number;
  location_mode: LocationMode;
  status: SlotStatus;
}

/** Backed by the `purchases` table (spine refactor). The exported name stays
 *  `Order` so importing UI keeps its shape; the columns are the purchases ones. */
export interface Order {
  id: string;
  buyer_user_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  /** Inline payment state on the purchase row (payments table retired). */
  payment_status: 'unpaid' | 'pending' | 'paid';
  amount: number;
  payment_reference: string | null;
  unique_amount: number | null;
  paid_at: string | null;
  created_at: string;
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

/** Inline payment view read off a purchase row (the `payments` table is gone). */
export interface Payment {
  method: PaymentMethod | null;
  amount: number;
  reference_code: string | null;
  status: string;
}

export interface OrderDocument {
  id: string;
  order_id: string;
  document_type: string;
  signer_name: string | null;
  agreed_at: string | null;
  extra_fields: Record<string, unknown>;
}
