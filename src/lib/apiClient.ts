/*
 * API client for the Cloudflare Worker backend used by the mobile and web app.
 * The Worker validates sessions and stores family data in its configured KV namespace.
 */

const DEFAULT_API_URL = 'https://famly-pluse-api.fszazo5.workers.dev';
const API_URL = DEFAULT_API_URL;

function authHeaders(token?: string): Record<string, string> {
  const storedToken = token ?? (() => {
    try {
      const raw = localStorage.getItem('family-pulse-phone-session');
      return raw ? (JSON.parse(raw) as { token?: string }).token : undefined;
    } catch { return undefined; }
  })();
  return storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
}

export interface ApiSosEvent {
  id: string;
  family_id: string;
  triggered_by: string;
  trigger_type: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  message: string | null;
  created_at: string;
  sender_name?: string;
}

export interface ApiSession {
  id: string;
  family_id: string;
  user_id: string;
  status: string;
  started_at: string;
  user_name: string;
  latest_position: {
    latitude: number;
    longitude: number;
    accuracy_m: number | null;
    speed_mps: number | null;
    recorded_at: string;
  } | null;
}

export interface ApiCheckIn {
  id: string;
  user_id: string;
  user_name: string;
  destination_name: string | null;
  deadline_at: string;
  status: string;
}

async function post(path: string, body: Record<string, unknown>, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const api = {
  exchangeGoogle: (body: { id_token: string; display_name: string }) =>
    post('/api/auth/google-exchange', body),

  completeFamily: (token: string, body: { action: 'create' | 'join'; family_name?: string; family_code?: string; display_name: string; phone?: string }) =>
    post('/api/family/complete', body, token),

  // Family
  createFamily: (body: { name: string; created_by: string; display_name: string }) =>
    post('/api/family/group', { action: 'create', ...body }),

  joinFamily: (body: { join_code: string; user_id: string; display_name: string }) =>
    post('/api/family/group', { action: 'join', ...body }),

  findFamily: (join_code: string) => get('/api/family/group', { join_code }),

  getFamilyMembers: (family_id: string) => get('/api/family/members', { family_id }),

  // SOS
  triggerSOS: (body: {
    family_id: string;
    triggered_by: string;
    trigger_type?: string;
    latitude?: number;
    longitude?: number;
    message?: string;
  }) => post('/api/sos/trigger', body),

  resolveSOS: (event_id: string) => post('/api/sos/resolve', { event_id }),

  getActiveSOS: (family_id: string) =>
    get('/api/sos/active', { family_id }) as Promise<{ events: ApiSosEvent[] }>,

  // Tracking
  startTracking: (body: { family_id: string; user_id: string; sos_event_id?: string }) =>
    post('/api/tracking/start', body),

  stopTracking: (session_id: string) => post('/api/tracking/stop', { session_id }),

  pushBreadcrumb: (body: {
    session_id: string;
    user_id: string;
    family_id: string;
    latitude: number;
    longitude: number;
    accuracy_m?: number;
    speed_mps?: number;
    heading_deg?: number;
    altitude_m?: number;
    battery_level?: number;
  }) => post('/api/tracking/breadcrumb', body),

  getSessions: (family_id: string) =>
    get('/api/tracking/sessions', { family_id }) as Promise<{ sessions: ApiSession[] }>,

  getSessionTrail: (session_id: string) =>
    get('/api/tracking/sessions', { session_id }) as Promise<{ breadcrumbs: unknown[] }>,

  // Check-in
  createCheckIn: (body: {
    family_id: string;
    user_id: string;
    pin_hash: string;
    destination_name?: string;
    deadline_at: string;
  }) => post('/api/check-in/create', body),

  confirmCheckIn: (check_in_id: string, pin_hash: string) =>
    post('/api/check-in/confirm', { check_in_id, pin_hash }),

  getActiveCheckIns: (family_id: string) =>
    get('/api/check-in/active', { family_id }) as Promise<{ check_ins: ApiCheckIn[] }>,

  getAudioLogs: (family_id: string) =>
    get('/api/audio-vault/log', { family_id }) as Promise<{ logs: unknown[] }>,
};
