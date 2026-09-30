import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, MapPin, ShieldCheck, AlertTriangle, X, Lock, Timer } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { hashPin } from '@/lib/crypto';
import type { CheckIn } from '@/lib/types';

interface Props {
  familyId: string;
  userId: string;
  onClose: () => void;
  onTimeoutTrigger: () => void;
}

type Stage = 'setup' | 'monitoring' | 'confirm' | 'confirmed' | 'expired';

export default function CheckInTimer({ familyId, userId, onClose, onTimeoutTrigger }: Props) {
  const [stage, setStage] = useState<Stage>('setup');
  const [minutes, setMinutes] = useState(30);
  const [destination, setDestination] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const totalSec = minutes * 60;

  const startCheckIn = useCallback(async () => {
    if (pin.length < 4) {
      setError('يجب أن يكون الرمز 4 أرقام على الأقل.');
      return;
    }
    setError(null);
    const pinHash = await hashPin(pin);

    try {
      const { check_in: data } = await api.createCheckIn({
        family_id: familyId,
        user_id: userId,
        pin_hash: pinHash,
        destination_name: destination || undefined,
        deadline_at: new Date(Date.now() + totalSec * 1000).toISOString(),
      });
      if (!data) throw new Error('missing_check_in');
      setCheckIn({ ...data, family_id: familyId, user_id: userId, pin_hash: pinHash } as CheckIn);
    } catch {
      setError('فشل بدء مراقبة الوصول.');
      return;
    }
    setRemainingSec(totalSec);
    setStage('monitoring');
  }, [pin, destination, familyId, userId, totalSec]);

  useEffect(() => {
    if (stage !== 'monitoring') return;
    intervalRef.current = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stage]);

  const handleTimeout = useCallback(async () => {
    if (!checkIn) return;
    await api.confirmCheckIn(checkIn.id, checkIn.pin_hash).catch(() => undefined);
    setStage('expired');
    onTimeoutTrigger();
  }, [checkIn, onTimeoutTrigger]);

  const confirmArrival = useCallback(async () => {
    if (!checkIn || !confirmPin) return;
    setError(null);
    const enteredHash = await hashPin(confirmPin);
    if (enteredHash !== checkIn.pin_hash) {
      setError('رمز غير صحيح. حاول مرة أخرى.');
      return;
    }
    await api.confirmCheckIn(checkIn.id, enteredHash);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStage('confirmed');
  }, [checkIn, confirmPin]);

  const cancelCheckIn = useCallback(async () => {
    if (checkIn) {
      // The API cancels a check-in when a new one is created; local close stops the timer.
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    onClose();
  }, [checkIn, onClose]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSec > 0 ? (remainingSec / totalSec) * 100 : 0;
  const isUrgent = remainingSec <= 60 && stage === 'monitoring';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isUrgent ? 'bg-primary-600/20 border border-primary-500/30' : 'bg-warning-600/20 border border-warning-500/30'
          }`}>
            <Clock className={`w-5 h-5 ${isUrgent ? 'text-primary-400' : 'text-warning-400'}`} />
          </div>
          <div>
            <h2 className="font-bold text-white">مؤقت الوصول الآمن</h2>
            <p className="text-xs text-slate-400">SOS تلقائي عند عدم التأكيد</p>
          </div>
        </div>
        <button onClick={cancelCheckIn} className="text-slate-400 hover:text-white p-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {stage === 'setup' && (
          <div className="w-full max-w-sm space-y-5 animate-slide-up">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-warning-600/20 border border-warning-500/30 mb-4">
                <Timer className="w-8 h-8 text-warning-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">إعداد الوصول الآمن</h3>
              <p className="text-sm text-slate-400">
                اختر المدة المتوقعة للوصول. إذا لم تؤكد وصولك برمزك قبل انتهاء الوقت، سيُرسل تنبيه SOS تلقائيًا.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">مدة الطريق (بالدقائق)</label>
              <div className="flex items-center gap-2">
                {[15, 30, 45, 60, 90].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinutes(m)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      minutes === m ? 'bg-warning-600 text-white' : 'bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">الوجهة (اختياري)</label>
              <div className="relative">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="input-field pr-10"
                  placeholder="مثال: المنزل، المدرسة..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">رمز التحقق (4 أرقام على الأقل)</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="input-field pr-10 font-mono tracking-widest"
                  placeholder="••••"
                  maxLength={8}
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                ستحتاج هذا الرمز لتأكيد وصولك بأمان.
              </p>
            </div>

            {error && <p className="text-sm text-primary-400">{error}</p>}

            <button onClick={startCheckIn} className="btn-primary w-full py-3.5">
              ابدأ المراقبة
            </button>
          </div>
        )}

        {stage === 'monitoring' && (
          <div className="text-center animate-fade-in">
            <div className="relative w-56 h-56 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="100" cy="100" r="90" fill="none"
                  stroke={isUrgent ? '#ef4444' : '#f59e0b'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 90}`}
                  strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold font-mono ${isUrgent ? 'text-primary-400' : 'text-white'}`} dir="ltr">
                  {formatTime(remainingSec)}
                </span>
                <span className="text-xs text-slate-400 mt-1">المتبقي</span>
              </div>
              {isUrgent && (
                <div className="absolute inset-0 rounded-full border-2 border-primary-500/30 animate-sos-pulse" />
              )}
            </div>

            {destination && (
              <p className="text-slate-400 mb-4">متجه إلى <span className="text-white font-medium">{destination}</span></p>
            )}

            <button
              onClick={() => setStage('confirm')}
              className="btn-primary px-12 py-3.5 flex items-center justify-center gap-2 mx-auto"
            >
              <ShieldCheck className="w-5 h-5" /> وصلت بأمان
            </button>
            <button onClick={cancelCheckIn} className="block mx-auto mt-3 text-xs text-slate-500 hover:text-slate-400">
              إلغاء المؤقت
            </button>
          </div>
        )}

        {stage === 'confirm' && (
          <div className="w-full max-w-sm space-y-5 animate-slide-up">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success-600/20 border border-success-500/30 mb-4">
                <ShieldCheck className="w-8 h-8 text-success-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">تأكيد الوصول</h3>
              <p className="text-sm text-slate-400">أدخل رمزك لتأكيد وصولك بأمان.</p>
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="input-field pr-10 font-mono tracking-widest text-center text-2xl"
                placeholder="••••"
                maxLength={8}
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-primary-400 text-center">{error}</p>}
            <button onClick={confirmArrival} className="btn-primary w-full py-3.5">
              تأكيد الوصول الآمن
            </button>
          </div>
        )}

        {stage === 'confirmed' && (
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-success-600/20 border-2 border-success-500/30 mb-6">
              <ShieldCheck className="w-12 h-12 text-success-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">أنت بأمان!</h3>
            <p className="text-slate-400 mb-8">تم تأكيد الوصول. تم إبلاغ عائلتك.</p>
            <button onClick={onClose} className="btn-primary px-8 py-3">تم</button>
          </div>
        )}

        {stage === 'expired' && (
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary-600/20 border-2 border-primary-500/30 mb-6 animate-sos-pulse">
              <AlertTriangle className="w-12 h-12 text-primary-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">تم إطلاق SOS</h3>
            <p className="text-slate-400 mb-8">
              لم تؤكد وصولك في الوقت المحدد. تم إرسال تنبيه طوارئ لعائلتك.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-3">حسناً</button>
          </div>
        )}
      </div>
    </div>
  );
}
