import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X, MapPin, Clock, Volume2, Phone, MessageCircle } from 'lucide-react';
import type { EmergencyAlert, SOSEvent, Profile } from '@/lib/types';
import { api } from '@/lib/apiClient';

interface Props {
  familyId: string;
  alerts: EmergencyAlert[];
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
}

export default function EmergencyAlertOverlay({ familyId, alerts, onAcknowledge, onDismiss }: Props) {
  const [expandedAlert, setExpandedAlert] = useState<EmergencyAlert | null>(null);
  const [sosEvent, setSosEvent] = useState<SOSEvent | null>(null);
  const [senderProfile, setSenderProfile] = useState<Profile | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (alerts.length > 0) {
      playAlarm();
    } else {
      stopAlarm();
    }
    return () => stopAlarm();
  }, [alerts.length]);

  function playAlarm() {
    if (oscRef.current) return;
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.45);
      osc.start();
      oscRef.current = osc;
      const interval = setInterval(() => {
        if (!audioCtxRef.current) return;
        const t = audioCtxRef.current.currentTime;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.setValueAtTime(0, t + 0.15);
        gain.gain.setValueAtTime(0.3, t + 0.3);
        gain.gain.setValueAtTime(0, t + 0.45);
      }, 1000);
      alarmIntervalRef.current = interval;
    } catch {
      // AudioContext might not be available
    }
  }

  function stopAlarm() {
    if (oscRef.current) {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
      try { oscRef.current.stop(); } catch { /* already stopped */ }
      oscRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }

  const expandAlert = useCallback(async (alert: EmergencyAlert) => {
    setExpandedAlert(alert);
    if (!familyId) return;
    const [{ events }, memberResult] = await Promise.all([
      api.getActiveSOS(familyId),
      api.getFamilyMembers(familyId) as Promise<{ members: Profile[] }>,
    ]);
    const event = (events as SOSEvent[]).find((item) => item.id === alert.sos_event_id) ?? null;
    setSosEvent(event);
    setSenderProfile(event ? memberResult.members.find((member) => member.user_id === event.triggered_by) ?? null : null);
  }, [familyId]);

  if (alerts.length === 0 && !expandedAlert) return null;

  return (
    <>
      {alerts.length > 0 && !expandedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/90 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0 bg-primary-600/20 animate-sos-pulse" />
          <div className="relative z-10 max-w-sm w-full mx-4">
            <div className="glass-card border-primary-500/50 p-6 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-600/30 border-2 border-primary-500 mb-4 animate-sos-pulse">
                <AlertTriangle className="w-10 h-10 text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">تنبيه طوارئ SOS</h2>
              <p className="text-primary-200 text-sm mb-5">
                {alerts.length} تنبيه{alerts.length > 1 ? 'ات' : ''} من عائلتك
              </p>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => expandAlert(alert)}
                    className="w-full bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 text-right transition-all"
                  >
                    <p className="text-sm font-medium text-white">عرض تفاصيل الطوارئ</p>
                    <p className="text-xs text-slate-400" dir="ltr">
                      {new Date(alert.created_at).toLocaleTimeString('ar-EG')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {expandedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="glass-card max-w-sm w-full p-6 animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-600/30 border border-primary-500/50 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">تنبيه طوارئ</h3>
                  <p className="text-xs text-slate-400" dir="ltr">
                    {new Date(expandedAlert.created_at).toLocaleString('ar-EG')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setExpandedAlert(null); setSosEvent(null); setSenderProfile(null); }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {senderProfile && (
              <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-400 mb-1">مِن</p>
                <p className="text-lg font-semibold text-white">{senderProfile.display_name}</p>
                <p className="text-xs text-slate-500">{roleAr(senderProfile.role)}</p>
              </div>
            )}

            {sosEvent && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-xs">الموقع</span>
                    </div>
                    {sosEvent.latitude != null ? (
                      <p className="text-xs text-white font-mono" dir="ltr">
                        {sosEvent.latitude.toFixed(4)}, {sosEvent.longitude?.toFixed(4)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">بانتظار GPS...</p>
                    )}
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs">المُطلِق</span>
                    </div>
                    <p className="text-xs text-white">
                      {triggerTypeAr(sosEvent.trigger_type)}
                    </p>
                  </div>
                </div>

                {sosEvent.message && (
                  <div className="bg-slate-800/50 rounded-xl p-3 mb-4">
                    <p className="text-xs text-slate-400 mb-1">الرسالة</p>
                    <p className="text-sm text-white">{sosEvent.message}</p>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <a
                href={sosEvent?.latitude != null ? `tel:` : undefined}
                className="btn-secondary py-2.5 flex items-center justify-center gap-1.5 text-sm"
              >
                <Phone className="w-4 h-4" /> اتصال
              </a>
              <button className="btn-secondary py-2.5 flex items-center justify-center gap-1.5 text-sm">
                <MessageCircle className="w-4 h-4" /> رسالة
              </button>
            </div>
            <button
              onClick={() => {
                onAcknowledge(expandedAlert.id);
                setExpandedAlert(null);
                setSosEvent(null);
                setSenderProfile(null);
              }}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
            >
              <Volume2 className="w-4 h-4" /> تأكيد وإيقاف الصوت
            </button>
            <button
              onClick={() => onDismiss(expandedAlert.id)}
              className="w-full mt-2 text-xs text-slate-500 hover:text-slate-400"
            >
              إغلاق دون تأكيد
            </button>
          </div>
        </div>
      )}
    </>
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

function roleAr(role: string): string {
  switch (role) {
    case 'admin': return 'مدير';
    case 'member': return 'عضو';
    default: return role;
  }
}
