import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { FamilyGroup, Profile, SOSEvent, EmergencyAlert } from '@/lib/types';

interface FamilyData {
  group: FamilyGroup | null;
  members: Profile[];
  loading: boolean;
}

export function useFamilyData(familyId: string | null, userId: string | null) {
  const [data, setData] = useState<FamilyData>({ group: null, members: [], loading: true });
  const [incomingAlerts, setIncomingAlerts] = useState<EmergencyAlert[]>([]);
  const [familySOSEvents, setFamilySOSEvents] = useState<SOSEvent[]>([]);

  const refresh = useCallback(async () => {
    if (!familyId) {
      setData({ group: null, members: [], loading: false });
      return;
    }
    try {
      const result = await api.getFamilyMembers(familyId) as { group: FamilyGroup | null; members: Profile[] };
      setData({ group: result.group, members: result.members ?? [], loading: false });
    } catch {
      setData((current) => ({ ...current, loading: false }));
    }
  }, [familyId]);

  const refreshEvents = useCallback(async () => {
    if (!familyId) return;
    try {
      const result = await api.getActiveSOS(familyId);
      const events = result.events as SOSEvent[];
      setFamilySOSEvents(events);
      if (userId) {
        setIncomingAlerts(events
          .filter((event) => event.triggered_by !== userId)
          .map((event) => ({
            id: event.id,
            sos_event_id: event.id,
            recipient_id: userId,
            family_id: familyId,
            delivered_at: null,
            acknowledged_at: null,
            created_at: event.created_at,
          })));
      }
    } catch {
      // The dashboard remains usable when the API is temporarily offline.
    }
  }, [familyId, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    void refreshEvents();
    const timer = window.setInterval(() => void refreshEvents(), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshEvents]);

  const dismissAlert = useCallback((alertId: string) => {
    setIncomingAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    dismissAlert(alertId);
  }, [dismissAlert]);

  return { ...data, refresh, incomingAlerts, dismissAlert, acknowledgeAlert, familySOSEvents };
}
