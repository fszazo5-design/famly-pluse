-- ============================================================
-- Guardian Safety — Neon Database Schema
-- ============================================================
-- Run this SQL in your Neon project's SQL editor
-- (https://neon.tech → your project → SQL Editor).
--
-- This schema is used by the Neon backend.
-- Access control is handled
-- by the Vercel serverless API layer instead).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- family_groups ----------
CREATE TABLE IF NOT EXISTS family_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  family_id uuid REFERENCES family_groups(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member',
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- ---------- sos_events ----------
CREATE TABLE IF NOT EXISTS sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  triggered_by uuid NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'active',
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  battery_level int,
  message text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- ---------- tracking_sessions ----------
CREATE TABLE IF NOT EXISTS tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sos_event_id uuid REFERENCES sos_events(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'live',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- ---------- gps_breadcrumbs ----------
CREATE TABLE IF NOT EXISTS gps_breadcrumbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_m double precision,
  speed_mps double precision,
  heading_deg double precision,
  altitude_m double precision,
  battery_level int,
  recorded_at timestamptz DEFAULT now()
);

-- ---------- audio_vault_logs ----------
CREATE TABLE IF NOT EXISTS audio_vault_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sos_event_id uuid REFERENCES sos_events(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  duration_sec int NOT NULL DEFAULT 0,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'audio/aac',
  recorded_at timestamptz DEFAULT now()
);

-- ---------- check_ins ----------
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pin_hash text NOT NULL,
  destination_name text,
  destination_lat double precision,
  destination_lng double precision,
  deadline_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  auto_sos_event_id uuid REFERENCES sos_events(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ---------- emergency_alerts ----------
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_event_id uuid NOT NULL REFERENCES sos_events(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_sos_family ON sos_events(family_id);
CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_events(status);
CREATE INDEX IF NOT EXISTS idx_sos_created ON sos_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_family ON tracking_sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_ts_status ON tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_gps_session ON gps_breadcrumbs(session_id);
CREATE INDEX IF NOT EXISTS idx_gps_recorded ON gps_breadcrumbs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_family ON gps_breadcrumbs(family_id);
CREATE INDEX IF NOT EXISTS idx_av_sos ON audio_vault_logs(sos_event_id);
CREATE INDEX IF NOT EXISTS idx_av_family ON audio_vault_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_ci_status ON check_ins(status);
CREATE INDEX IF NOT EXISTS idx_ci_deadline ON check_ins(deadline_at);
CREATE INDEX IF NOT EXISTS idx_ea_recipient ON emergency_alerts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_ea_sos ON emergency_alerts(sos_event_id);
-- Phone OTP authentication additions for Neon.
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text UNIQUE NOT NULL,
  phone_verified_at timestamptz,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_requests (
  phone_e164 text PRIMARY KEY,
  last_requested_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
