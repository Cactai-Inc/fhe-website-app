import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FunnelType = 'rider' | 'horse' | 'support';

export interface BookingPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
  funnel_type: FunnelType;
  selected_services: SelectedService[];
  qualifier_answers: Record<string, string>;
  subtotal: number;
  notes?: string;
}

export interface SelectedService {
  serviceId: string;
  serviceName: string;
  tierId: string;
  tierLabel: string;
  price: number;
  unit: string;
}

export interface InquiryPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  message: string;
}

export async function submitBooking(payload: BookingPayload) {
  const { data, error } = await supabase.from('bookings').insert(payload).select('id').maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitInquiry(payload: InquiryPayload) {
  const { error } = await supabase.from('inquiries').insert(payload);
  if (error) throw error;
}
