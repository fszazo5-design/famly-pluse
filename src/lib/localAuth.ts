import type { Profile } from '@/lib/types';

export interface LocalUser {
  id: string;
  phone_e164: string | null;
  display_name: string;
}

export interface LocalSession {
  user: LocalUser;
  profile: Profile | null;
  token: string;
}

const SESSION_KEY = 'family-pulse-phone-session';

export function savePhoneSession(session: LocalSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifyAuthChanged();
}

export function getLocalSession(): LocalSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as LocalSession; } catch { return null; }
}

export function updateLocalProfile(profile: Profile | null): void {
  const session = getLocalSession();
  if (!session) return;
  savePhoneSession({ ...session, profile, user: { ...session.user, display_name: profile?.display_name ?? session.user.display_name } });
}

export function clearLocalSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event('family-pulse-auth-change'));
}
