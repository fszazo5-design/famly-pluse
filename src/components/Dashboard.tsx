import { useState, useMemo, useRef } from 'react';
import {
  Shield, AlertTriangle, Navigation, Mic, Clock, Users,
  LogOut, Copy, Check, Phone, Power,
  Activity, MapPin, Volume2, BookOpen
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSOS } from '@/hooks/useSOS';
import { useFamilyData } from '@/hooks/useFamilyData';
import LiveTrackingView from '@/components/LiveTrackingView';
import CheckInTimer from '@/components/CheckInTimer';
import AudioVaultView from '@/components/AudioVaultView';
import EmergencyAlertOverlay from '@/components/EmergencyAlertOverlay';
import HelpCenter from '@/components/HelpCenter';
import DevicePermissionCard from '@/components/DevicePermissionCard';

type View = 'dashboard' | 'tracking' | 'checkin' | 'audio' | 'help';

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const familyId = profile?.family_id ?? null;
  const userId = user?.id ?? null;

  const sos = useSOS(familyId, userId);
  const family = useFamilyData(familyId, userId);
  const [view, setView] = useState<View>('dashboard');
  const [copied, setCopied] = useState(false);
  const [sosHolding, setSosHolding] = useState(false);
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const sosTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeEvents = useMemo(
    () => family.familySOSEvents.filter((e) => e.status === 'active'),
    [family.familySOSEvents],
  );

  function copyJoinCode() {
    if (!family.group) return;
    navigator.clipboard.writeText(family.group.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // SOS hold-to-trigger
  function startSosHold() {
    if (sos.active) return;
    setSosHolding(true);
    setSosHoldProgress(0);
    const startTime = Date.now();
    const duration = 1500;
    const tick = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setSosHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        setSosHolding(false);
        setSosHoldProgress(0);
        sos.triggerSOS('manual', 'تنبيه SOS يدوي من لوحة التحكم');
      }
    }, 16);
    sosTickRef.current = tick;
  }

  function cancelSosHold() {
    if (sosTickRef.current) {
      clearInterval(sosTickRef.current);
      sosTickRef.current = null;
    }
    setSosHolding(false);
    setSosHoldProgress(0);
  }

  if (family.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary-500 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-400 text-sm">جارٍ تحميل شبكة الأمان...</p>
        </div>
      </div>
    );
  }

  if (view === 'tracking' && familyId && userId) {
    return <LiveTrackingView familyId={familyId} userId={userId} onClose={() => setView('dashboard')} members={family.members} />;
  }
  if (view === 'checkin' && familyId && userId) {
    return (
      <CheckInTimer
        familyId={familyId}
        userId={userId}
        onClose={() => setView('dashboard')}
        onTimeoutTrigger={() => sos.triggerSOS('check_in_timeout', 'انتهاء مؤقت الوصول الآمن')}
      />
    );
  }
  if (view === 'audio' && familyId) {
    return <AudioVaultView familyId={familyId} onClose={() => setView('dashboard')} members={family.members} />;
  }
  if (view === 'help') {
    return <HelpCenter onClose={() => setView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <EmergencyAlertOverlay
        familyId={familyId ?? ''}
        alerts={family.incomingAlerts}
        onAcknowledge={family.acknowledgeAlert}
        onDismiss={family.dismissAlert}
      />

      {/* SOS active banner */}
      {sos.active && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-primary-600/90 backdrop-blur-md px-4 py-3 flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
            <span className="text-white font-semibold text-sm">تنبيه SOS نشط — تم إبلاغ عائلتك</span>
          </div>
          <button
            onClick={sos.resolveSOS}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
          >
            إنهاء
          </button>
        </div>
      )}

      <div className={`max-w-md mx-auto px-5 pb-8 ${sos.active ? 'pt-16' : 'pt-6'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">نبض العائلة</h1>
              <p className="text-xs text-slate-400">أهلاً، {profile?.display_name}</p>
            </div>
          </div>
          <button onClick={signOut} className="text-slate-400 hover:text-white p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <DevicePermissionCard />

        {/* Active emergency events */}
        {activeEvents.length > 0 && (
          <div className="glass-card border-primary-500/30 p-4 mb-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary-400" />
              <h3 className="text-sm font-semibold text-white">حالات طوارئ نشطة</h3>
            </div>
            <div className="space-y-2">
              {activeEvents.map((event) => {
                const sender = family.members.find((m) => m.user_id === event.triggered_by);
                return (
                  <div key={event.id} className="flex items-center gap-3 bg-primary-950/30 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-full bg-primary-600/30 border border-primary-500/50 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-primary-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {sender?.display_name ?? 'فرد من العائلة'} — تنبيه SOS
                      </p>
                      <p className="text-xs text-slate-400">
                        {triggerTypeAr(event.trigger_type)} · {new Date(event.created_at).toLocaleTimeString('ar-EG')}
                      </p>
                    </div>
                    <button
                      onClick={() => setView('tracking')}
                      className="text-xs text-accent-400 font-medium hover:text-accent-300"
                    >
                      تتبع ←
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SOS Button */}
        <div className="flex flex-col items-center my-8">
          <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider">
            {sos.active ? 'الطوارئ نشطة' : 'اضغط مع الاستمرار لإطلاق SOS'}
          </p>
          {sos.error && <p role="alert" className="text-xs text-primary-300 text-center mb-3">{sos.error}</p>}
          <div className="relative">
            {!sos.active && sosHolding && (
              <div className="absolute inset-0 rounded-full border-4 border-primary-500/30 animate-pulse-ring" />
            )}
            <button
              onMouseDown={startSosHold}
              onMouseUp={cancelSosHold}
              onMouseLeave={cancelSosHold}
              onTouchStart={startSosHold}
              onTouchEnd={cancelSosHold}
              disabled={sos.active || sos.triggering}
              className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-200 ${
                sos.active
                  ? 'bg-primary-700 animate-sos-pulse'
                  : sosHolding
                    ? 'bg-primary-600 scale-105'
                    : 'bg-gradient-to-b from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600'
              } disabled:cursor-not-allowed shadow-2xl shadow-primary-900/50`}
              style={{
                backgroundImage: sos.active || sosHolding
                  ? undefined
                  : `conic-gradient(from 0deg, #dc2626 ${sosHoldProgress * 3.6}deg, #991b1b ${sosHoldProgress * 3.6}deg)`,
              }}
            >
              {sos.triggering ? (
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : sos.active ? (
                <>
                  <AlertTriangle className="w-10 h-10 text-white mb-1" />
                  <span className="text-white font-bold text-lg">SOS نشط</span>
                </>
              ) : (
                <>
                  <Shield className="w-10 h-10 text-white mb-1" />
                  <span className="text-white font-bold text-lg">SOS</span>
                  <span className="text-white/70 text-xs mt-0.5">استمر بالضغط</span>
                </>
              )}
            </button>
          </div>
          {sos.active && (
            <button
              onClick={sos.resolveSOS}
              className="mt-5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all"
            >
              إنهاء حالة الطوارئ
            </button>
          )}
        </div>

        {/* Family Group Card */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary-400" />
              <h3 className="text-sm font-semibold text-white">{family.group?.name ?? 'المجموعة العائلية'}</h3>
            </div>
            {profile?.role === 'admin' && family.group && (
              <button
                onClick={copyJoinCode}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 px-2.5 py-1.5 rounded-lg transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="font-mono" dir="ltr">{family.group.join_code}</span>
              </button>
            )}
          </div>
          <div className="space-y-2">
            {family.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 py-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                  member.user_id === userId
                    ? 'bg-accent-600/30 text-accent-300 border border-accent-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {member.display_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">
                    {member.display_name}
                    {member.user_id === userId && <span className="text-slate-500 text-xs mr-1.5">(أنت)</span>}
                  </p>
                  <p className="text-xs text-slate-500">{roleAr(member.role)}</p>
                </div>
                {member.phone && (
                  <a href={`tel:${member.phone}`} className="text-slate-400 hover:text-white p-1.5">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Full-width Live Tracking Card */}
        <button
          onClick={() => setView('tracking')}
          className="w-full glass-card p-5 mb-3 text-right hover:border-accent-500/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-32 h-32 bg-accent-600/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent-600/20 border border-accent-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Navigation className="w-7 h-7 text-accent-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-semibold text-white">تتبع العائلة على الخريطة</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                خريطة تفاعلية تُظهر مواقع ومسارات جميع أفراد العائلة لحظيًا
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-accent-400 text-xs font-medium bg-accent-600/10 px-2.5 py-1.5 rounded-lg">
              <MapPin className="w-3.5 h-3.5" />
              فتح الخريطة
            </div>
          </div>
        </button>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setView('checkin')}
            className="glass-card p-4 text-right hover:border-warning-500/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-warning-600/20 border border-warning-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-warning-400" />
            </div>
            <h4 className="text-sm font-semibold text-white">مؤقت الوصول</h4>
            <p className="text-xs text-slate-400 mt-0.5">SOS تلقائي عند التأخير</p>
          </button>

          <button
            onClick={() => setView('audio')}
            className="glass-card p-4 text-right hover:border-secondary-500/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary-600/20 border border-secondary-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5 text-secondary-400" />
            </div>
            <h4 className="text-sm font-semibold text-white">خزنة الصوت</h4>
            <p className="text-xs text-slate-400 mt-0.5">تسجيلات الأدلة</p>
          </button>

          <div className="glass-card p-4">
            <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/20 flex items-center justify-center mb-3">
              <Volume2 className="w-5 h-5 text-primary-400" />
            </div>
            <h4 className="text-sm font-semibold text-white">تجاوز الصامت</h4>
            <p className="text-xs text-slate-400 mt-0.5">تنبيهات طوارئ عالية</p>
          </div>
        </div>

        {/* Help Center */}
        <button
          onClick={() => setView('help')}
          className="w-full glass-card p-4 mb-4 text-right hover:border-primary-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5 text-primary-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white">دليل الاستخدام</h4>
              <p className="text-xs text-slate-400 mt-0.5">افتح شرح PDF أو شاهد فيديو تعليمياً</p>
            </div>
            <span className="text-primary-400 text-xs font-medium">فتح الدليل ←</span>
          </div>
        </button>

        {/* Recent activity */}
        {family.familySOSEvents.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">النشاط الأخير</h3>
            <div className="space-y-2">
              {family.familySOSEvents.slice(0, 5).map((event) => {
                const sender = family.members.find((m) => m.user_id === event.triggered_by);
                return (
                  <div key={event.id} className="flex items-center gap-3 py-2 border-t border-white/5 first:border-t-0">
                    <div className={`w-2 h-2 rounded-full ${
                      event.status === 'active' ? 'bg-primary-500 animate-pulse' : 'bg-slate-600'
                    }`} />
                    <div className="flex-1">
                      <p className="text-xs text-white">
                        {sender?.display_name ?? 'غير معروف'} — {triggerTypeAr(event.trigger_type)}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      event.status === 'active' ? 'bg-primary-950/50 text-primary-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {statusAr(event.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Power button trigger info */}
        <div className="glass-card p-4 mt-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
            <Power className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">SOS سريع: زر الطاقة</p>
            <p className="text-xs text-slate-400 mt-0.5">
              اضغط زر الطاقة 5 مرات بسرعة لإطلاق SOS حتى عندما يكون التطبيق مغلقًا. خدمة الخلفية الأصلية تكتشف ذلك وتبثّ التنبيه فورًا.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function triggerTypeAr(type: string): string {
  switch (type) {
    case 'manual': return 'يدوي';
    case 'power_button': return 'زر الطاقة';
    case 'check_in_timeout': return 'انتهاء المؤقت';
    default: return type;
  }
}

function statusAr(status: string): string {
  switch (status) {
    case 'active': return 'نشط';
    case 'resolved': return 'تم الحل';
    case 'cancelled': return 'ملغى';
    default: return status;
  }
}

function roleAr(role: string): string {
  switch (role) {
    case 'admin': return 'مدير';
    case 'member': return 'عضو';
    default: return role;
  }
}
