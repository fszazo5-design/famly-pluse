export interface FamilyGroup {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  family_id: string | null;
  display_name: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type SOSTriggerType = 'manual' | 'power_button' | 'check_in_timeout';
export type SOSStatus = 'active' | 'resolved' | 'cancelled';

export interface SOSEvent {
  id: string;
  family_id: string;
  triggered_by: string;
  trigger_type: SOSTriggerType;
  status: SOSStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  battery_level: number | null;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface TrackingSession {
  id: string;
  family_id: string;
  user_id: string;
  sos_event_id: string | null;
  status: 'live' | 'ended';
  started_at: string;
  ended_at: string | null;
}

export interface GPSBreadcrumb {
  id: string;
  session_id: string;
  user_id: string;
  family_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
  battery_level: number | null;
  recorded_at: string;
}

export interface AudioVaultLog {
  id: string;
  family_id: string;
  user_id: string;
  sos_event_id: string | null;
  storage_path: string;
  duration_sec: number;
  file_size_bytes: number;
  mime_type: string;
  recorded_at: string;
}

export type CheckInStatus = 'active' | 'confirmed' | 'expired' | 'cancelled';

export interface CheckIn {
  id: string;
  family_id: string;
  user_id: string;
  pin_hash: string;
  destination_name: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  deadline_at: string;
  confirmed_at: string | null;
  status: CheckInStatus;
  auto_sos_event_id: string | null;
  created_at: string;
}

export interface EmergencyAlert {
  id: string;
  sos_event_id: string;
  recipient_id: string;
  family_id: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface FamilyMember extends Profile {
  email?: string;
}
