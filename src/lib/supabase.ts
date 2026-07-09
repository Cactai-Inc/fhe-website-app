import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FunnelType = 'rider' | 'horse' | 'support';
export type ContactMethod = 'text' | 'call' | 'email';

/** A cart line as passed to request/order submission (flat catalog). */
export interface SelectedService {
  offeringId: string;
  offeringName: string;
  serviceType: string | null;
  price: number;
  unit: string;
}

// Removed 2026-07-08 (launch dead-code cleanup): submitBooking/BookingPayload
// (legacy `bookings` table best-effort write, superseded by the requests/orders
// spine) and submitInquiry/InquiryPayload (dead — the `inquiries` table had no
// live reader and this had no caller). See launch spec "Removed (delete)".
