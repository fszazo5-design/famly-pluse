import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/apiClient';
import { nativeBridge, type GPSReading } from '@/lib/nativeBridge';
import type { SOSEvent } from '@/lib/types';

interface SOSState {
  active: boolean;
  event: SOSEvent | null;
  triggering: boolean;
}

export function useSOS(familyId: string | null, userId: string | null) {
  const [state, setState] = useState<SOSState>({ active: false, event: null, triggering: false });
  const trackingSessionId = useRef<string | null>(null);
  const gpsUnsub = useRef<(() => void) | null>(null);

  const pushBreadcrumb = useCallback(async (reading: GPSReading, sessionId: string, famId: string, uid: string) => {
    await api.pushBreadcrumb({
      session_id: sessionId,
      user_id: uid,
      family_id: famId,
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracy_m: reading.accuracy,
      speed_mps: reading.speed ?? undefined,
      heading_deg: reading.heading ?? undefined,
      altitude_m: reading.altitude ?? undefined,
    });
  }, []);

  const triggerSOS = useCallback(
    async (triggerType: 'manual' | 'power_button' | 'check_in_timeout' = 'manual', message?: string) => {
      if (!familyId || !userId || state.active) return;
      setState((s) => ({ ...s, triggering: true }));
      try {
        await nativeBridge.triggerSOS();
        const { event } = await api.triggerSOS({
          family_id: familyId,
          triggered_by: userId,
          trigger_type: triggerType,
          message,
        }) as { event: SOSEvent };
        const { session } = await api.startTracking({ family_id: familyId, user_id: userId, sos_event_id: event.id });
        trackingSessionId.current = session?.id ?? null;
        await nativeBridge.startGPSTracking();
        gpsUnsub.current = nativeBridge.onGPSReading((reading) => {
          if (trackingSessionId.current) void pushBreadcrumb(reading, trackingSessionId.current, familyId, userId);
        });
        setState({ active: true, event, triggering: false });
      } catch (err) {
        console.error('SOS trigger failed:', err);
        setState({ active: false, event: null, triggering: false });
      }
    },
    [familyId, userId, state.active, pushBreadcrumb],
  );

  const resolveSOS = useCallback(async () => {
    if (!state.event) return;
    await nativeBridge.stopGPSTracking();
    await nativeBridge.stopAudioRecording();
    gpsUnsub.current?.();
    if (trackingSessionId.current) await api.stopTracking(trackingSessionId.current);
    await api.resolveSOS(state.event.id);
    trackingSessionId.current = null;
    setState({ active: false, event: null, triggering: false });
  }, [state.event]);

  useEffect(() => () => {
    gpsUnsub.current?.();
    void nativeBridge.stopGPSTracking();
  }, []);

  return { ...state, triggerSOS, resolveSOS };
}
