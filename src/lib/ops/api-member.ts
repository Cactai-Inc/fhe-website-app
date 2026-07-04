/* Lane-4 data wrappers — the gated MEMBER module pages (MyLessons / MyBrokerage /
 * MyBoarding). Member-scoped READS only: every query relies on the client-scoped
 * RLS policies as the authoritative fence — no staff predicate, no org filter in
 * client code:
 *
 *   lesson_credits    lesson_credits_client_read_own   (client_id = current_client_id())
 *                       — 20260630070000_mod_lessons.sql
 *   lesson_packages   lesson_packages_read             (any in-tenant authenticated read)
 *                       — 20260630070000_mod_lessons.sql
 *   engagements       engagements_select               (client_id = current_client_id())
 *                       — 20260629030000_engagements_horses_backbone.sql
 *   board_agreements  board_agreements_client_read     (boarder_contact_id = current_contact_id())
 *   board_charges     board_charges_client_read        (via the owning agreement)
 *                       — 20260630090000_mod_boarding.sql
 *
 * All module tables additionally carry the RESTRICTIVE org boundary + module gate
 * (has_module(...)), so a module-OFF tenant reads zero rows even if the UI gate
 * were bypassed. Wrappers stay thin and throw on error.
 */
import { supabase } from '../supabase';

// ─── MyLessons (mod.lessons) ─────────────────────────────────────────────────

/** The member's own lesson_credits ledger row (RLS-scoped). */
export interface MemberLessonCredit {
  id: string;
  package_key: string | null;
  credits_total: number;
  credits_remaining: number;
  purchased_at: string;
}

/** A purchasable pack from the tenant's catalog (price stays behind the registry). */
export interface MemberLessonPackage {
  id: string;
  package_key: string;
  name: string;
  credits: number;
}

export interface MyLessonsOverview {
  /** Newest purchase first. */
  credits: MemberLessonCredit[];
  /** Active catalog packs, for the "buy more" rail. */
  packages: MemberLessonPackage[];
  /** Sum of credits_remaining across the member's ledger. */
  creditsRemaining: number;
}

/** The member's lesson balance + the purchasable catalog, in one load. */
export async function myLessonsOverview(): Promise<MyLessonsOverview> {
  const [creditRes, pkgRes] = await Promise.all([
    supabase
      .from('lesson_credits')
      .select('id, package_key, credits_total, credits_remaining, purchased_at')
      .is('deleted_at', null)
      .order('purchased_at', { ascending: false }),
    supabase
      .from('lesson_packages')
      .select('id, package_key, name, credits')
      .is('deleted_at', null)
      .eq('active', true)
      .order('name'),
  ]);
  if (creditRes.error) throw creditRes.error;
  if (pkgRes.error) throw pkgRes.error;

  const credits = ((creditRes.data ?? []) as MemberLessonCredit[]).map((c) => ({
    ...c,
    credits_total: Number(c.credits_total) || 0,
    credits_remaining: Number(c.credits_remaining) || 0,
  }));
  return {
    credits,
    packages: (pkgRes.data ?? []) as MemberLessonPackage[],
    creditsRemaining: credits.reduce((sum, c) => sum + c.credits_remaining, 0),
  };
}

// ─── My lesson sessions (mod.lessons — 20260703120000) ──────────────────────

export type MemberLessonSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/** One of the member's own confirmed lesson sessions (my_lesson_sessions RPC). */
export interface MemberLessonSession {
  id: string;
  starts_at: string;
  ends_at: string;
  status: MemberLessonSessionStatus;
  location: string | null;
  notes: string | null;
}

/** The member's own sessions: upcoming soonest-first, then recent past (~50).
 *  SECURITY DEFINER RPC scoped to current_client_id() — empty for non-clients. */
export async function myLessonSessions(): Promise<MemberLessonSession[]> {
  const { data, error } = await supabase.rpc('my_lesson_sessions');
  if (error) throw error;
  return (data ?? []) as MemberLessonSession[];
}

// ─── MyBrokerage (mod.brokerage) ─────────────────────────────────────────────

/** The member's own engagement, flattened with its service + status lookups. */
export interface MemberEngagement {
  id: string;
  display_code: string | null;
  /** NULL for non-service engagements (kiosk releases); those carry no
   *  service_types embed and never pass the brokerage segment filter. */
  service_type: string | null;
  status: string;
  start_date: string | null;
  created_at: string;
  /** service_types lookup (world-readable). */
  service: { display_name: string; segment: string | null } | null;
  /** engagement_status lookup (world-readable); is_terminal = closed. */
  status_row: { display_name: string; is_terminal: boolean } | null;
}

export interface MyBrokerageOverview {
  /** The member's search/purchase (brokerage-segment) engagements, newest first. */
  engagements: MemberEngagement[];
  /** Engagements not in a terminal status. */
  openCount: number;
}

/** The member's own brokerage (search/evaluation/purchase/sale/lease-representation)
 *  engagements: engagements RLS returns only the caller's rows; the brokerage set is
 *  the 'support' segment of the service_types catalog. */
export async function myBrokerageOverview(): Promise<MyBrokerageOverview> {
  const { data, error } = await supabase
    .from('engagements')
    .select(
      'id, display_code, service_type, status, start_date, created_at, ' +
        'service:service_types(display_name, segment), ' +
        'status_row:engagement_status(display_name, is_terminal)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const engagements = ((data ?? []) as unknown as MemberEngagement[]).filter(
    (e) => e.service?.segment === 'support',
  );
  return {
    engagements,
    openCount: engagements.filter((e) => e.status_row?.is_terminal !== true).length,
  };
}

// ─── MyBoarding (mod.boarding) ───────────────────────────────────────────────

/** A period charge on one of the member's board agreements (RLS-scoped). */
export interface MemberBoardCharge {
  id: string;
  period_start: string;
  period_end: string;
  amount: number;
}

/** The member's own board agreement with the horse + its charges flattened. */
export interface MemberBoardAgreement {
  id: string;
  board_rate: number | null;
  board_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  /** horses read is itself RLS-gated (owner/engagement); null when not readable. */
  horse: { barn_name: string | null; registered_name: string | null } | null;
  charges: MemberBoardCharge[];
}

export interface MyBoardingOverview {
  /** The member's agreements, newest start first, each with its charges. */
  agreements: MemberBoardAgreement[];
  /** Sum of every charge across the member's agreements. */
  chargesTotal: number;
}

/** The member's board agreements + charges. board_charges rows arrive through the
 *  embed; the client_read policies already exclude soft-deleted rows. */
export async function myBoardingOverview(): Promise<MyBoardingOverview> {
  const { data, error } = await supabase
    .from('board_agreements')
    .select(
      'id, board_rate, board_type, start_date, end_date, status, ' +
        'horse:horses(barn_name, registered_name), ' +
        'charges:board_charges(id, period_start, period_end, amount)',
    )
    .is('deleted_at', null)
    .order('start_date', { ascending: false });
  if (error) throw error;

  const agreements = ((data ?? []) as unknown as MemberBoardAgreement[]).map((a) => ({
    ...a,
    board_rate: a.board_rate === null ? null : Number(a.board_rate),
    charges: (a.charges ?? []).map((c) => ({ ...c, amount: Number(c.amount) || 0 })),
  }));
  return {
    agreements,
    chargesTotal: agreements.reduce(
      (sum, a) => sum + a.charges.reduce((s, c) => s + c.amount, 0),
      0,
    ),
  };
}

/** Display helper: a horse's presentable name. */
export function horseName(
  horse: { barn_name: string | null; registered_name: string | null } | null,
): string {
  return horse?.barn_name ?? horse?.registered_name ?? 'Your horse';
}
