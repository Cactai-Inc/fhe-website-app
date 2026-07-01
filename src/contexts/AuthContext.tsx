import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as auth from '../lib/auth';
import type { Profile } from '../lib/types';
import type { Membership } from '../lib/community-types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  membership: Membership | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean; // active membership OR admin
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setMembership(null);
      return;
    }
    const [{ data: prof }, { data: mem }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('memberships').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setProfile((prof as Profile) ?? null);
    setMembership((mem as Membership) ?? null);
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
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user?.id);
  }, [loadProfile, session?.user?.id]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        membership,
        loading,
        isAdmin: !!profile?.is_admin,
        isMember: (!profile?.is_suspended) && (!!profile?.is_admin || membership?.status === 'active'),
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
