import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as auth from '../lib/auth';
import { myModules, myPropertyTerm, myHiddenPages } from '../lib/api';
import type { Profile } from '../lib/types';
import type { Member } from '../lib/community-types';
import { DEFAULT_PROPERTY_TERM, resolvePropertyTerm, type PropertyTerm } from '../lib/propertyTerm';
import { clearLandingFlags } from '../lib/dashboard/landing';
import { clearOwnerDrafts, getDraftOwner, setDraftOwner } from '../lib/formDraft';

export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'USER';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  member: Member | null;
  loading: boolean;
  isAdmin: boolean;
  // Two-operator model (Slice 5): isStaff = any operator (matches has_staff_access()
  // server-side: ADMIN/SUPER_ADMIN/MANAGER/EMPLOYEE). isTrainer = an operator who is
  // NOT an admin (MANAGER/EMPLOYEE) — the servicing subset (lessons, availability,
  // per-lesson notes, correspondence), no billing/deal-terms/config/oversight.
  isStaff: boolean;
  isTrainer: boolean;
  isMember: boolean; // active membership OR admin
  isSuperAdmin: boolean; // platform operator (SUPER_ADMIN) — a separate path, never OR'd into has_module
  // Entitlement / role bridge (INT-AUTH) — the seam nav/route gating reads. profile.role
  // is authoritative for role; my_modules() resolves the tenant's module set.
  role: AppRole | null;
  orgId: string | null;
  modules: string[];
  hasModule: (key: string) => boolean;
  /** TASK-PAGEVIS: the page_keys this TENANT has hidden from its own nav
   *  (src/lib/pageRegistry.ts). A PREFERENCE, not a permission — every route
   *  still resolves, and nothing here gates data. Empty until my_hidden_pages()
   *  resolves, and empty on error, so a failure shows MORE nav rather than
   *  hiding a page the tenant never chose to hide. */
  hiddenPages: string[];
  isPageHidden: (pageKey: string) => boolean;
  /** Re-read my_hidden_pages() alone. The settings page calls this after a
   *  toggle so the rail updates in the same session — without it the owner
   *  would hide a page and still see its nav row until the next sign-in, which
   *  reads as the toggle not working. */
  refreshHiddenPages: () => Promise<void>;
  /** U16: the current tenant's own word for their facility (barn/ranch/stables/…).
   *  Defaults to FACILITY until my_property_term() resolves (or on error). */
  propertyTerm: PropertyTerm;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** profiles.role + profiles.org_id exist server-side (migrations 25/27) but are not
 *  yet on the base Profile type; project them here for the entitlement bridge. */
type ProfileRow = Profile & { role?: AppRole | null; org_id?: string | null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [propertyTerm, setPropertyTerm] = useState<PropertyTerm>(DEFAULT_PROPERTY_TERM);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setMember(null);
      setModules([]);
      setHiddenPages([]);
      setPropertyTerm(DEFAULT_PROPERTY_TERM);
      return;
    }
    const [profRes, memRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('members').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    const prof = profRes.data;
    let mem = memRes.data;
    // Member self-heal: a provisioned client whose invitation token was
    // lost/consumed signs in with no membership and would dead-end at the
    // member gate. ensure_my_membership grants what redeem_invitation would
    // have; a failure (e.g. RPC not yet deployed) must NOT block sign-in.
    if (prof && (mem as Member | null)?.status !== 'active') {
      try {
        const { data: healed } = await supabase.rpc('ensure_my_member_access');
        if (healed) {
          ({ data: mem } = await supabase
            .from('members').select('*').eq('user_id', userId).maybeSingle());
        }
      } catch {
        // gate stays closed on error — same posture as myModules below
      }
    }
    setProfile((prof as ProfileRow) ?? null);
    setMember((mem as Member) ?? null);
    // Resolve the tenant module set for nav/route gating. A failure (e.g. the RPC
    // not yet deployed) must NOT block sign-in — gate closed (empty) on error.
    try {
      setModules(await myModules());
    } catch {
      setModules([]);
    }
    // Resolve the tenant's property term. A failure must NOT block sign-in —
    // falls back to the neutral FACILITY default, same posture as modules above.
    try {
      setPropertyTerm(resolvePropertyTerm(await myPropertyTerm()));
    } catch {
      setPropertyTerm(DEFAULT_PROPERTY_TERM);
    }
    // Resolve the tenant's hidden-page set. FAIL OPEN, not closed — the opposite
    // posture to modules above, and deliberately: modules are an entitlement, so
    // an unresolved one must lock; page visibility is a display preference, so an
    // unresolved one must SHOW. A failed fetch that hid nav rows would look
    // exactly like the tenant having hidden them.
    try {
      setHiddenPages(await myHiddenPages());
    } catch {
      setHiddenPages([]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      /* TASK-FIX4 §6 — publish the namespace persisted form drafts are written
         under. ⚠️ It is set from the SESSION, not from the profile load, because
         `useFormDraft` holds every restore until this resolves; waiting on the
         profile round-trip would keep every form's draft on the shelf for the
         length of it. */
      setDraftOwner(data.session?.user?.id ?? null);
      loadProfile(data.session?.user?.id).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // D26/TASK-DASHBOARDBUILD, owner 2026-08-23: the dashboard's "land fresh
      // on login" flag lives in sessionStorage, which is scoped to the TAB, not
      // the login — a tab reused across a sign-out/sign-in already had it set.
      // SIGNED_IN is the one point every sign-in path (password, MFA, Google)
      // actually passes through, so it is the one place to reset it.
      if (event === 'SIGNED_IN') clearLandingFlags();
      setSession(newSession);
      setDraftOwner(newSession?.user?.id ?? null);
      loadProfile(newSession?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Auth operations delegate to lib/auth (the single source for supabase.auth calls).
  const signInWithPassword = useCallback(
    (email: string, password: string) => auth.signInWithPassword(email, password),
    [],
  );

  const signUp = useCallback(
    (email: string, password: string) => auth.signUpWithPassword(email, password),
    [],
  );

  const signInWithGoogle = useCallback(
    (redirectTo?: string) => auth.signInWithGoogle(redirectTo),
    [],
  );

  const signOut = useCallback(async () => {
    /* TASK-FIX4 §6 — a draft belongs to the person who typed it. Dropping theirs
       on the way out is the mitigation that makes a shared machine tolerable;
       read the trade-off in `formDraft.ts`. Done BEFORE the sign-out so the
       namespace is still the one their drafts were written under. */
    clearOwnerDrafts(getDraftOwner().owner);
    await auth.signOut();
    setProfile(null);
    setMember(null);
    setModules([]);
    setHiddenPages([]);
    setPropertyTerm(DEFAULT_PROPERTY_TERM);
  }, []);

  const refreshHiddenPages = useCallback(async () => {
    try {
      setHiddenPages(await myHiddenPages());
    } catch {
      // Fail open, same posture as the initial load.
      setHiddenPages([]);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user?.id);
  }, [loadProfile, session?.user?.id]);

  // Role is authoritative from profiles.role (migration 25); is_admin here means the
  // tenant/platform operator (ADMIN or SUPER_ADMIN), matching is_admin() server-side.
  const role: AppRole | null = profile?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  // Two-operator model: any operator (mirrors has_staff_access()); a trainer is an
  // operator below admin (the servicing subset).
  const isStaff = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER' || role === 'EMPLOYEE';
  const isTrainer = isStaff && !isAdmin;
  // SUPER_ADMIN is the platform-operator path (§4.2): surfaced separately so
  // superadmin-only nav/routes gate on it without being folded into has_module().
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const hasModule = useCallback((key: string) => modules.includes(key), [modules]);
  const isPageHidden = useCallback((pageKey: string) => hiddenPages.includes(pageKey), [hiddenPages]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        member,
        loading,
        isAdmin,
        isStaff,
        isTrainer,
        isMember: (!profile?.is_suspended) && (isStaff || member?.status === 'active'),
        isSuperAdmin,
        role,
        orgId: profile?.org_id ?? null,
        modules,
        hasModule,
        hiddenPages,
        isPageHidden,
        refreshHiddenPages,
        propertyTerm,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
