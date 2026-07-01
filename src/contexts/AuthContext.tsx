import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as auth from '../lib/auth';
import { myModules } from '../lib/api';
import type { Profile } from '../lib/types';
import type { Membership } from '../lib/community-types';

export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'USER';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  membership: Membership | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean; // active membership OR admin
  // Entitlement / role bridge (U15) — the seam nav/route gating reads. profile.role
  // is authoritative for role; my_modules() resolves the tenant's module set.
  role: AppRole | null;
  orgId: string | null;
  modules: string[];
  hasModule: (key: string) => boolean;
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
  const [membership, setMembership] = useState<Membership | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setMembership(null);
      setModules([]);
      return;
    }
    const [{ data: prof }, { data: mem }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('memberships').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setProfile((prof as ProfileRow) ?? null);
    setMembership((mem as Membership) ?? null);
    // Resolve the tenant module set for nav/route gating. A failure (e.g. the RPC
    // not yet deployed) must NOT block sign-in — gate closed (empty) on error.
    try {
      setModules(await myModules());
    } catch {
      setModules([]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadProfile(data.session?.user?.id).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
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
    await auth.signOut();
    setProfile(null);
    setMembership(null);
    setModules([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user?.id);
  }, [loadProfile, session?.user?.id]);

  // Role is authoritative from profiles.role (migration 25); is_admin here means the
  // tenant/platform operator (ADMIN or SUPER_ADMIN), matching is_admin() server-side.
  const role: AppRole | null = profile?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const hasModule = useCallback((key: string) => modules.includes(key), [modules]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        membership,
        loading,
        isAdmin,
        isMember: (!profile?.is_suspended) && (isAdmin || membership?.status === 'active'),
        role,
        orgId: profile?.org_id ?? null,
        modules,
        hasModule,
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
