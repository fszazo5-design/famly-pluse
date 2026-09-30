import { useState, useEffect } from 'react';
import { Mic, Clock, X, Download, Shield, Play, Pause } from 'lucide-react';
import { api } from '@/lib/apiClient';
import type { AudioVaultLog, Profile, SOSEvent } from '@/lib/types';

interface Props {
  familyId: string;
  onClose: () => void;
  members: Profile[];
}

export default function AudioVaultView({ familyId, onClose, members }: Props) {
  const [logs, setLogs] = useState<AudioVaultLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [sosEvents, setSosEvents] = useState<Map<string, SOSEvent>>(new Map());

  useEffect(() => {
    async function load() {
      const [{ logs }, { events }] = await Promise.all([
        api.getAudioLogs(familyId),
        api.getActiveSOS(familyId),
      ]);
      setLogs((logs as AudioVaultLog[]) ?? []);
      const map = new Map<string, SOSEvent>();
      for (const e of (events as SOSEvent[]) ?? []) {
        map.set(e.id, e);
      }
      setSosEvents(map);
      setLoading(false);
    }
    load();
  }, [familyId]);

  function togglePlay(log: AudioVaultLog) {
    if (playingId === log.id) {
      audioEl?.pause();
      setPlayingId(null);
      return;
    }
    const publicUrl = log.storage_path.startsWith('http') ? log.storage_path : '';
    if (!publicUrl) return;
    if (audioEl) {
      audioEl.pause();
    }
    const el = new Audio(publicUrl);
    el.play().catch(() => {});
    setAudioEl(el);
    setPlayingId(log.id);
    el.onended = () => setPlayingId(null);
  }

  useEffect(() => {
    return () => audioEl?.pause();
  }, [audioEl]);

  const memberName = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? 'غير معروف';
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  function triggerTypeAr(type: string): string {
    switch (type) {
      case 'manual': return 'يدوي';
      case 'power_button': return 'زر الطاقة';
      case 'check_in_timeout': return 'انتهاء المؤقت';
      default: return type;
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-600/20 border border-secondary-500/30 flex items-center justify-center">
            <Mic className="w-5 h-5 text-secondary-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">خزنة الصوت السرية</h2>
            <p className="text-xs text-slate-400">تسجيلات أدلة مؤمّنة</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="glass-card p-4 mb-2 flex items-start gap-3">
          <Shield className="w-5 h-5 text-success-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">تخزين أدلة محمي من العبث</p>
            <p className="text-xs text-slate-400 mt-0.5">
              يتم تسجيل الصوت تلقائيًا أثناء تنبيهات SOS ورفعه إلى تخزين سحابي مشفّر. التسجيلات تُعدّ أدلة قانونية ولا يمكن الوصول إليها إلا لأفراد العائلة.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-slate-500 py-8">جارٍ تحميل التسجيلات...</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Mic className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">لا توجد تسجيلات صوتية بعد</p>
            <p className="text-xs text-slate-600 mt-1">
              تظهر التسجيلات هنا عند إطلاق SOS
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const event = log.sos_event_id ? sosEvents.get(log.sos_event_id) : null;
            return (
              <div key={log.id} className="glass-card p-4 animate-slide-up">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePlay(log)}
                    className="w-12 h-12 rounded-full bg-secondary-600/30 border border-secondary-500/30 flex items-center justify-center flex-shrink-0 hover:bg-secondary-600/50 transition-all active:scale-95"
                  >
                    {playingId === log.id ? (
                      <Pause className="w-5 h-5 text-secondary-300" />
                    ) : (
                      <Play className="w-5 h-5 text-secondary-300 ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {memberName(log.user_id)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1" dir="ltr">
                        <Clock className="w-3 h-3" />
                        {formatDuration(log.duration_sec)}
                      </span>
                      <span dir="ltr">{new Date(log.recorded_at).toLocaleString('ar-EG')}</span>
                    </div>
                    {event && (
                      <p className="text-xs text-primary-400 mt-1">
                        أُطلق بواسطة: {triggerTypeAr(event.trigger_type)}
                      </p>
                    )}
                  </div>
                  <button className="text-slate-400 hover:text-white p-2">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-end gap-0.5 h-8 mt-3">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-secondary-500/30 rounded-sm"
                      style={{
                        height: `${20 + Math.abs(Math.sin(i * 0.5 + log.recorded_at.length)) * 60}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
