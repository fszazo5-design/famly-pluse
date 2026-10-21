import { useState, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capgo/capacitor-firebase-authentication';
import { ArrowRight, Loader2, Phone, Shield, Users, UserPlus } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { savePhoneSession } from '@/lib/localAuth';
import { normalizePhoneInput, validateInternationalPhone } from '@/lib/phone';
import type { Profile } from '@/lib/types';

type Step = 'google' | 'family';
type FamilyAction = 'create' | 'join';

interface AuthResponse {
  token: string;
  user: { id: string; phone_e164: string | null; display_name: string; email?: string | null };
  profile: Profile | null;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 17.9l6.8-5.2Z" />
      <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z" />
    </svg>
  );
}

function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : '';
  const normalized = `${code} ${message}`.toLowerCase();
  if (normalized.includes('popup-closed-by-user') || normalized.includes('cancelled') || normalized.includes('canceled')) {
    return 'تم إلغاء تسجيل الدخول.';
  }
  if (normalized.includes('operation-not-allowed') || normalized.includes('provider') && normalized.includes('disabled')) {
    return 'فعّل تسجيل الدخول باستخدام Google من Firebase Authentication.';
  }
  if (normalized.includes('unauthorized-domain')) {
    return 'أضف نطاق التطبيق إلى النطاقات المسموح بها في Firebase Authentication.';
  }
  if (normalized.includes('developer_error') || normalized.includes('10:')) {
    return 'إعداد Google OAuth غير مكتمل. نزّل google-services.json المحدّث بعد تفعيل Google في Firebase.';
  }
  if (normalized.includes('network') || normalized.includes('timeout')) {
    return 'تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.';
  }
  if (message && /[\u0600-\u06FF]/.test(message)) return message;
  return 'تعذر تسجيل الدخول باستخدام Google. تحقق من إعداد Firebase وحاول مرة أخرى.';
}

export default function AuthScreen() {
  const [step, setStep] = useState<Step>('google');
  const [displayName, setDisplayName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [familyAction, setFamilyAction] = useState<FamilyAction>('create');
  const [familyName, setFamilyName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nativeGoogleAuthAvailable = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAuthentication');

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      let idToken: string;
      let googleName = '';

      if (nativeGoogleAuthAvailable) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        googleName = result.user?.displayName ?? '';
        const tokenResult = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
        idToken = tokenResult.token;
      } else {
        const [{ GoogleAuthProvider, signInWithPopup }, { firebaseAuth }] = await Promise.all([
          import('firebase/auth'),
          import('@/lib/firebase'),
        ]);
        const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
        googleName = result.user.displayName ?? result.user.email?.split('@')[0] ?? '';
        idToken = await result.user.getIdToken(true);
      }

      const session = await api.exchangeGoogle({ id_token: idToken, display_name: googleName }) as AuthResponse;
      setAuth(session);
      setDisplayName(session.user.display_name || googleName);
      setEmergencyPhone(session.profile?.phone ?? session.user.phone_e164 ?? '');
      if (session.profile?.family_id) {
        savePhoneSession(session);
      } else {
        setStep('family');
      }
    } catch (err: unknown) {
      const message = authErrorMessage(err);
      if (message !== 'تم إلغاء تسجيل الدخول.') setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function switchGoogleAccount() {
    setLoading(true);
    try {
      if (nativeGoogleAuthAvailable) {
        await FirebaseAuthentication.signOut();
      } else {
        const [{ signOut }, { firebaseAuth }] = await Promise.all([
          import('firebase/auth'),
          import('@/lib/firebase'),
        ]);
        await signOut(firebaseAuth);
      }
    } catch {
      // Returning to the sign-in screen is still safe if provider sign-out fails.
    } finally {
      setAuth(null);
      setStep('google');
      setError(null);
      setLoading(false);
    }
  }

  async function completeFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setError(null);

    const phone = validateInternationalPhone(emergencyPhone);
    if (!phone.valid) {
      setError(phone.error ?? 'اكتب رقم الهاتف مع رمز الدولة.');
      return;
    }
    if (familyAction === 'create' && familyName.trim().length < 2) {
      setError('اكتب اسم العائلة (حرفان على الأقل).');
      return;
    }

    setLoading(true);
    try {
      const result = await api.completeFamily(auth.token, {
        action: familyAction,
        family_name: familyAction === 'create' ? familyName.trim() : undefined,
        family_code: familyAction === 'join' ? familyCode.trim().toUpperCase() : undefined,
        display_name: displayName.trim() || auth.user.display_name,
        phone: phone.e164,
      }) as { group: { id: string }; role: string; profile?: Profile };

      const profile: Profile = result.profile ?? {
        id: auth.user.id,
        user_id: auth.user.id,
        family_id: result.group.id,
        display_name: displayName.trim() || auth.user.display_name,
        role: result.role,
        phone: phone.e164,
        avatar_url: null,
        created_at: new Date().toISOString(),
      };
      savePhoneSession({
        token: auth.token,
        user: { ...auth.user, display_name: profile.display_name },
        profile,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر ربط العائلة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600/20 border border-primary-500/30 mb-4">
            <Shield className="w-8 h-8 text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">نبض العائلة</h1>
          <p className="text-slate-400 mt-1 text-sm">حسابك عبر Google — بدون رمز SMS لتسجيل الدخول</p>
        </div>

        <div className="glass-card p-6">
          {step === 'google' && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">مرحبًا بك</h2>
                <p className="text-sm text-slate-400 mt-2">سجّل الدخول أو أنشئ حسابك مباشرة باستخدام حساب Google.</p>
              </div>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-semibold flex items-center justify-center gap-3 transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><GoogleMark /> المتابعة باستخدام Google</>}
              </button>
              <p className="text-xs text-slate-500 text-center leading-6">لن نطلب رقمًا لإرسال رمز تحقق. يمكنك إضافة رقم تواصل للطوارئ بعد تسجيل الدخول.</p>
            </div>
          )}

          {step === 'family' && (
            <form onSubmit={completeFamily} className="space-y-5">
              <div className="text-center">
                <Users className="w-10 h-10 text-secondary-400 mx-auto mb-2" />
                <h2 className="text-lg font-bold text-white">أنشئ مساحة عائلتك</h2>
                <p className="text-sm text-slate-400 mt-1">أضف اسم العائلة ورقم التواصل للطوارئ.</p>
              </div>

              <div className="rounded-lg bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
                {displayName || auth?.user.email || 'تم تسجيل الدخول بحساب Google'}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setFamilyAction('create')} className={`flex-1 py-2.5 rounded-lg text-sm ${familyAction === 'create' ? 'bg-secondary-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <UserPlus className="inline w-4 h-4 ml-1" /> إنشاء عائلة
                </button>
                <button type="button" onClick={() => setFamilyAction('join')} className={`flex-1 py-2.5 rounded-lg text-sm ${familyAction === 'join' ? 'bg-secondary-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Users className="inline w-4 h-4 ml-1" /> الانضمام برمز
                </button>
              </div>

              {familyAction === 'create' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">اسم العائلة</label>
                  <input required minLength={2} maxLength={100} value={familyName} onChange={(event) => setFamilyName(event.target.value)} className="input-field" placeholder="مثال: عائلة أحمد" />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">رمز العائلة</label>
                  <input required maxLength={8} dir="ltr" value={familyCode} onChange={(event) => setFamilyCode(event.target.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase())} className="input-field text-center font-mono tracking-widest" placeholder="AB12CD34" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">رقم هاتف للتواصل وقت الطوارئ</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input required maxLength={20} autoComplete="tel" inputMode="tel" dir="ltr" type="tel" value={emergencyPhone} onChange={(event) => setEmergencyPhone(normalizePhoneInput(event.target.value))} className="input-field pr-10 font-mono" placeholder="+9665XXXXXXXX أو +20..." />
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-5">هذا الرقم مخصص لرسائل التنبيه عند الطوارئ، وليس لتأكيد تسجيل الدخول. إرسال SMS الفعلي يتطلب تفعيل خدمة الرسائل.</p>
              </div>

              <button disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ ومتابعة'}
              </button>
              <button type="button" onClick={() => void switchGoogleAccount()} disabled={loading} className="w-full text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1">
                <ArrowRight className="w-4 h-4" /> استخدام حساب Google آخر
              </button>
            </form>
          )}

          {error && <div role="alert" className="mt-4 text-sm text-primary-300 bg-primary-950/30 border border-primary-800/50 rounded-lg px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>
  );
}
