/* Platform domain types mirroring the Supabase data model
 * (supabase/migrations/20260623010000_platform_data_model.sql).
 */

export type Segment = 'rider' | 'horse' | 'support';
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

export interface Offering {
  id: string;
  segment: Segment;
  name: string;
  tagline: string | null;
  description: string | null;
  slug: string;
  active: boolean;
  sort_order: number;
  tiers?: OfferingTier[];
}

export interface OfferingTier {
  id: string;
  offering_id: string;
  label: string;
  description: string | null;
  price_amount: number;
  price_unit: PriceUnitDb;
  price_min: number | null;
  note: string | null;
  is_popular: boolean;
  sort_order: number;
}

export interface ProposedTime {
  date: string;   // ISO date
  time: string;   // free text e.g. "morning" or "10am"
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
  tier_id?: string;
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

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  fee: number;
  total: number;
  payment_reference: string | null;
  unique_amount: number | null;
  paid_at: string | null;
  confirmed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  offering_id: string | null;
  tier_id: string | null;
  label: string;
  price_amount: number;
  price_unit: PriceUnitDb;
  price_min: number | null;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  reference_code: string | null;
  status: PaymentStatus;
  match_confidence: string | null;
  matched_at: string | null;
  created_at: string;
}

export interface OrderDocument {
  id: string;
  order_id: string;
  document_type: string;
  signer_name: string | null;
  agreed_at: string | null;
  extra_fields: Record<string, unknown>;
}
