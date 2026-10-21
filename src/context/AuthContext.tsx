import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capgo/capacitor-firebase-authentication';
import type { Profile } from '@/lib/types';
import {
  clearLocalSession,
  getLocalSession,
  notifyAuthChanged,
  type LocalUser,
} from '@/lib/localAuth';

interface AuthState {
  user: LocalUser | null;
  profile: Profile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    const sync = () => {
      const session = getLocalSession();
      setState({ user: session?.user ?? null, profile: session?.profile ?? null, loading: false });
    };
    sync();
    window.addEventListener('family-pulse-auth-change', sync);
    return () => window.removeEventListener('family-pulse-auth-change', sync);
  }, []);

  async function refreshProfile() {
    if (!state.user) return;
    const session = getLocalSession();
    setState((current) => ({ ...current, profile: session?.profile ?? current.profile }));
  }

  async function signOut() {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAuthentication')) {
        await FirebaseAuthentication.signOut();
      } else {
        const [{ signOut: webSignOut }, { firebaseAuth }] = await Promise.all([
          import('firebase/auth'),
          import('@/lib/firebase'),
        ]);
        await webSignOut(firebaseAuth);
      }
    } catch {
      // Clear the app session even if the identity provider is temporarily unavailable.
    }
    clearLocalSession();
    setState({ user: null, profile: null, loading: false });
    notifyAuthChanged();
  }

  return (
    <AuthContext.Provider value={{ ...state, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function persistProfile(userId: string, profile: Profile | null) {
  const session = getLocalSession();
  if (session?.user.id === userId) {
    localStorage.setItem('family-pulse-phone-session', JSON.stringify({ ...session, profile }));
  }
  notifyAuthChanged();
}
