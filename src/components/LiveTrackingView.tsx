import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigation, Radio, Loader2, X, Users, Crosshair, Satellite } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { nativeBridge, type GPSReading } from '@/lib/nativeBridge';
import { requestLocationPermission } from '@/lib/devicePermissions';
import type { GPSBreadcrumb, Profile, TrackingSession } from '@/lib/types';
import TrackingMap, { type MapPosition } from '@/components/TrackingMap';

interface Props {
  familyId: string;
  userId: string;
  onClose: () => void;
  members: Profile[];
  sessionId?: string | null;
}

const MEMBER_COLORS = ['#06b6d4', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6'];

export default function LiveTrackingView({ familyId, userId, onClose, members, sessionId }: Props) {
  const [allBreadcrumbs, setAllBreadcrumbs] = useState<Map<string, GPSBreadcrumb[]>>(new Map());
  const [myReading, setMyReading] = useState<GPSReading | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
  const [activeSessions, setActiveSessions] = useState<TrackingSession[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(userId);
  const [showAll, setShowAll] = useState(true);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  // Load active sessions and recent breadcrumb trails.
  const loadExisting = useCallback(async () => {
    const result = await api.getSessions(familyId);
    const sessions = result.sessions as unknown as TrackingSession[];
    setActiveSessions(sessions);
    const grouped = new Map<string, GPSBreadcrumb[]>();
    await Promise.all(sessions.map(async (session) => {
      const trail = await api.getSessionTrail(session.id);
      grouped.set(session.user_id, trail.breadcrumbs as GPSBreadcrumb[]);
    }));
    setAllBreadcrumbs(grouped);
  }, [familyId]);

  useEffect(() => {
    void loadExisting().catch(() => undefined);
    const timer = window.setInterval(() => void loadExisting().catch(() => undefined), 10_000);
    return () => window.clearInterval(timer);
  }, [loadExisting]);

  // The API has no websocket dependency; refresh positions on a short interval.
  useEffect(() => {
    const timer = window.setInterval(() => void loadExisting().catch(() => undefined), 10_000);
    return () => window.clearInterval(timer);
  }, [loadExisting]);

  // Start broadcasting my location
  const startStreaming = useCallback(async () => {
    setPermissionMessage(null);
    const locationGranted = await requestLocationPermission();
    if (!locationGranted) {
      setPermissionMessage('لم يُمنح إذن الموقع. اسمح به من إعدادات التطبيق ثم أعد المحاولة.');
      return;
    }

    let sid = activeSessionId;
    if (!sid) {
      const result = await api.startTracking({ family_id: familyId, user_id: userId });
      const session = result.session as TrackingSession;
      if (session) {
        sid = session.id;
        setActiveSessionId(sid);
        setActiveSessions((prev) => [...prev, session]);
      }
    }
    if (!sid) return;

    await nativeBridge.startGPSTracking();
    const unsub = nativeBridge.onGPSReading(async (reading) => {
      setMyReading(reading);
      await api.pushBreadcrumb({
        session_id: sid!,
        user_id: userId,
        family_id: familyId,
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy_m: reading.accuracy,
        speed_mps: reading.speed ?? undefined,
        heading_deg: reading.heading ?? undefined,
        altitude_m: reading.altitude ?? undefined,
      });
    });
    setStreaming(true);
    return () => {
      unsub();
      nativeBridge.stopGPSTracking();
    };
  }, [activeSessionId, familyId, userId]);

  const stopStreaming = useCallback(async () => {
    await nativeBridge.stopGPSTracking();
    setStreaming(false);
    if (activeSessionId) {
      await api.stopTracking(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    return () => {
      if (streaming) nativeBridge.stopGPSTracking();
    };
  }, [streaming]);

  // Build tracks for the map
  const tracks = useMemo(() => {
    const colorMap = new Map<string, string>();
    members.forEach((m, i) => {
      colorMap.set(m.user_id, MEMBER_COLORS[i % MEMBER_COLORS.length]);
    });

    return members
      .filter((m) => m.user_id === userId || allBreadcrumbs.has(m.user_id))
      .map((m) => {
        const crumbs = allBreadcrumbs.get(m.user_id) ?? [];
        const positions: MapPosition[] = crumbs.map((c) => ({
          lat: c.latitude,
          lng: c.longitude,
          accuracy: c.accuracy_m,
        }));
        // Include my live reading if streaming
        if (m.user_id === userId && myReading) {
          positions.push({
            lat: myReading.latitude,
            lng: myReading.longitude,
            accuracy: myReading.accuracy,
          });
        }
        return {
          userId: m.user_id,
          name: m.display_name,
          color: colorMap.get(m.user_id) ?? '#06b6d4',
          positions,
          isMe: m.user_id === userId,
        };
      });
  }, [members, allBreadcrumbs, myReading, userId]);

  // Filtered tracks for display
  const visibleTracks = useMemo(() => {
    if (showAll) return tracks;
    return tracks.filter((t) => t.userId === selectedUserId);
  }, [tracks, showAll, selectedUserId]);

  const followTarget = showAll ? null : selectedUserId;
  const isUserStreaming = (uid: string) => activeSessions.some((s) => s.user_id === uid && s.status === 'live');

  const totalPoints = Array.from(allBreadcrumbs.values()).reduce((sum, arr) => sum + arr.length, 0);
  const hasAnyPositions = tracks.some((t) => t.positions.length > 0) || !!myReading;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent-600/20 border border-accent-500/30 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">التتبع المباشر للعائلة</h2>
            <p className="text-xs text-slate-400">
              {activeSessions.length} بث نشط · {totalPoints} نقطة موقع
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {hasAnyPositions ? (
          <TrackingMap
            tracks={visibleTracks}
            followUserId={followTarget}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800/50 border border-white/10 mb-4">
                <Satellite className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد مواقع نشطة</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                ابدأ بث موقعك أو انتظر حتى يبدأ أحد أفراد العائلة البث لرؤية المواقع على الخريطة.
              </p>
            </div>
          </div>
        )}

        {/* Map overlay controls — member selector */}
        {tracks.length > 1 && (
          <div className="absolute top-3 right-3 left-3 z-[500]">
            <div className="glass-card p-2 flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => { setShowAll(true); setSelectedUserId(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  showAll ? 'bg-accent-600 text-white' : 'bg-slate-800/50 text-slate-400'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> الجميع
              </button>
              {tracks.map((t) => (
                <button
                  key={t.userId}
                  onClick={() => { setShowAll(false); setSelectedUserId(t.userId); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    !showAll && selectedUserId === t.userId
                      ? 'text-white'
                      : 'bg-slate-800/50 text-slate-400'
                  }`}
                  style={!showAll && selectedUserId === t.userId ? { background: t.color } : undefined}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                  {isUserStreaming(t.userId) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* My live position overlay */}
        {myReading && (
          <div className="absolute bottom-3 right-3 left-3 z-[500]">
            <div className="glass-card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-600/30 flex items-center justify-center flex-shrink-0">
                <Crosshair className="w-4.5 h-4.5 text-accent-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">موقعك الحالي</p>
                <p className="text-xs text-slate-400 font-mono" dir="ltr">
                  {myReading.latitude.toFixed(5)}, {myReading.longitude.toFixed(5)}
                </p>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-xs text-accent-400 font-mono" dir="ltr">
                  {myReading.speed ? `${(myReading.speed * 3.6).toFixed(0)} كم/س` : '—'}
                </p>
                <p className="text-xs text-slate-500" dir="ltr">±{myReading.accuracy.toFixed(0)}م</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="p-3 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl">
        {permissionMessage && <p role="alert" className="text-xs text-primary-300 text-center mb-3">{permissionMessage}</p>}
        {!streaming ? (
          <button
            onClick={startStreaming}
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
          >
            <Radio className="w-5 h-5" /> ابدأ بث موقعي على الخريطة
          </button>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-accent-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">جارٍ بث موقعك لحظيًا...</span>
            </div>
            <button
              onClick={stopStreaming}
              className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> إيقاف البث
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
