import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Phone, Shield, Users, UserPlus } from 'lucide-react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { api } from '@/lib/apiClient';
import { firebaseAuth } from '@/lib/firebase';
import { savePhoneSession } from '@/lib/localAuth';
import { normalizePhoneInput, validateInternationalPhone } from '@/lib/phone';
import type { Profile } from '@/lib/types';

type Step = 'phone' | 'otp' | 'family';
type FamilyAction = 'create' | 'join';

interface AuthResponse {
  token: string;
  user: { id: string; phone_e164: string; display_name: string };
  profile: Profile | null;
}

function firebaseErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-phone-number')) return 'رقم الهاتف غير صحيح.';
  if (code.includes('too-many-requests')) return 'تم تجاوز عدد المحاولات. حاول لاحقًا.';
  if (code.includes('quota-exceeded')) return 'تم تجاوز حصة رسائل SMS في Firebase.';
  if (code.includes('captcha-check-failed')) return 'فشل التحقق الأمني. أعد المحاولة.';
  if (code.includes('invalid-verification-code')) return 'رمز التحقق غير صحيح.';
  if (code.includes('code-expired')) return 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.';
  if (error instanceof Error) return error.message;
  return 'تعذر إكمال التحقق عبر Firebase.';
}

export default function AuthScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+966');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyAction, setFamilyAction] = useState<FamilyAction>('create');
  const [familyName, setFamilyName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }, []);

  function getRecaptcha(): RecaptchaVerifier {
    if (recaptchaRef.current) return recaptchaRef.current;
    const verifier = new RecaptchaVerifier(firebaseAuth, 'firebase-recaptcha-container', { size: 'normal' });
    recaptchaRef.current = verifier;
    return verifier;
  }

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const phoneValidation = validateInternationalPhone(phone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.error ?? 'رقم الهاتف غير صحيح.');
      return;
    }
    setLoading(true);
    try {
      setPhone(phoneValidation.e164);
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, phoneValidation.e164, getRecaptcha());
      setStep('otp');
    } catch (err: unknown) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!confirmationRef.current) {
      setError('اطلب رمزًا جديدًا أولًا.');
      return;
    }
    setLoading(true);
    try {
      const credential = await confirmationRef.current.confirm(otp.trim());
      const idToken = await credential.user.getIdToken();
      const result = await api.exchangeFirebase({ id_token: idToken, display_name: displayName.trim() }) as AuthResponse;
      setAuth(result);
      if (result.profile?.family_id) {
        savePhoneSession({ token: result.token, user: result.user, profile: result.profile });
      } else {
        setStep('family');
      }
    } catch (err: unknown) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function completeFamily(event: React.FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setError(null); setLoading(true);
    try {
      const result = await api.completeFamily(auth.token, {
        action: familyAction,
        family_name: familyAction === 'create' ? familyName.trim() : undefined,
        family_code: familyAction === 'join' ? familyCode.trim().toUpperCase() : undefined,
        display_name: displayName.trim(),
      }) as { group: { id: string }; role: string };
      const profile: Profile = {
        id: auth.user.id, user_id: auth.user.id, family_id: result.group.id,
        display_name: displayName.trim(), role: result.role, phone: auth.user.phone_e164,
        avatar_url: null, created_at: new Date().toISOString(),
      };
      savePhoneSession({ token: auth.token, user: { ...auth.user, display_name: displayName.trim() }, profile });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر ربط العائلة.');
    } finally { setLoading(false); }
  }

  async function changePhone() {
    confirmationRef.current = null;
    await signOut(firebaseAuth).catch(() => undefined);
    setStep('phone');
    setOtp('');
    setError(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600/20 border border-primary-500/30 mb-4"><Shield className="w-8 h-8 text-primary-500" /></div>
          <h1 className="text-2xl font-bold text-white">نبض العائلة</h1>
          <p className="text-slate-400 mt-1 text-sm">دخول آمن برقم الهاتف عبر Firebase</p>
        </div>
        <div className="glass-card p-6">
          {step === 'phone' && <form onSubmit={requestOtp} className="space-y-5">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">رقم الهاتف الدولي</label><div className="relative"><Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input required maxLength={20} autoComplete="tel" inputMode="tel" dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(normalizePhoneInput(e.target.value))} className="input-field pr-10 font-mono" placeholder="+9665XXXXXXXX" /></div><p className="text-xs text-slate-500 mt-2">اكتب رمز الدولة والرقم، مثل +966 أو +20.</p></div>
            <div id="firebase-recaptcha-container" className="flex justify-center" />
            <button disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Phone className="w-5 h-5" /> إرسال رمز SMS</>}</button>
          </form>}
          {step === 'otp' && <form onSubmit={verifyOtp} className="space-y-5">
            <button type="button" onClick={changePhone} className="text-xs text-slate-400 hover:text-white flex items-center gap-1"><ArrowRight className="w-4 h-4" /> تغيير الرقم</button>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">الاسم المعروض</label><input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-field" placeholder="مثال: أحمد" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">رمز التحقق</label><input required minLength={4} maxLength={10} inputMode="numeric" dir="ltr" autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="input-field text-center font-mono text-2xl tracking-[0.5em]" placeholder="••••••" /><p className="text-xs text-slate-500 mt-2">أدخل الرمز المرسل إلى {phone}</p></div>
            <button disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد رقم الهاتف'}</button>
          </form>}
          {step === 'family' && <form onSubmit={completeFamily} className="space-y-5">
            <div className="text-center"><Users className="w-10 h-10 text-secondary-400 mx-auto mb-2" /><h2 className="text-lg font-bold text-white">اربط عائلتك</h2><p className="text-sm text-slate-400">أنشئ عائلة جديدة أو استخدم رمزًا للانضمام.</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => setFamilyAction('create')} className={`flex-1 py-2.5 rounded-lg text-sm ${familyAction === 'create' ? 'bg-secondary-600 text-white' : 'bg-slate-800 text-slate-400'}`}><UserPlus className="inline w-4 h-4 ml-1" /> إنشاء</button><button type="button" onClick={() => setFamilyAction('join')} className={`flex-1 py-2.5 rounded-lg text-sm ${familyAction === 'join' ? 'bg-secondary-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Users className="inline w-4 h-4 ml-1" /> انضمام</button></div>
            {familyAction === 'create' ? <input required value={familyName} onChange={(e) => setFamilyName(e.target.value)} className="input-field" placeholder="اسم العائلة" /> : <input required maxLength={8} dir="ltr" value={familyCode} onChange={(e) => setFamilyCode(e.target.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase())} className="input-field text-center font-mono tracking-widest" placeholder="رمز العائلة" />}
            <button disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'متابعة إلى التطبيق'}</button>
          </form>}
          {error && <div className="mt-4 text-sm text-primary-300 bg-primary-950/30 border border-primary-800/50 rounded-lg px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>
  );
}
