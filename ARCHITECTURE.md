# Guardian Safety — Architecture Overview

A production-grade personal safety & emergency SOS app combining a React/JSX
frontend with native Kotlin background services, wrapped in Capacitor for Android.

---

## 1. Hybrid Architecture: How React Talks to Kotlin

```
┌─────────────────────────────────────────────────────┐
│                   React / JSX Frontend               │
│  (Dashboard, SOS Button, Family UI, Tracking Map)    │
│  Tailwind CSS · Vite · Neon API client            │
└───────────────┬──────────────────┬───────────────────┘
                │                  │
    Capacitor Bridge     Neon API polling
    (nativeBridge.ts)    (gps_breadcrumbs, sos_events,
                │         emergency_alerts subscriptions)
                │                  │
┌───────────────▼────────┐  ┌──────▼──────────────────┐
│  EmergencyPlugin.kt    │  │   Neon API (Postgres)    │
│  (@CapacitorPlugin)    │  │   RLS-secured tables     │
│  triggerSOS()          │  │   Realtime channels      │
│  startGPSTracking()    │  │   Storage (audio vault)  │
│  startAudioRecording() │  └──────────────────────────┘
└───────────────┬────────┘
                │
┌───────────────▼──────────────────────────────────────┐
│     EmergencyForegroundService.kt (Kotlin)      │
│                                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ │
│  │ Power Button │ │ GPS Tracking │ │ Stealth Audio │ │
│  │ Detection    │ │ (Fused Loc)  │ │ Recording     │ │
│  │ (5x press)   │ │ Breadcrumbs  │ │ (MediaRecord) │ │
│  └──────────────┘ └──────────────┘ └───────────────┘ │
│                                                       │
│  Foreground Service · Wake Lock · START_STICKY       │
└───────────────────────────────────────────────────────┘
```

### Communication Flow

**Frontend → Native (via Capacitor Bridge):**
The React layer calls `nativeBridge.triggerSOS()`, which checks for
`Capacitor.Plugins.SosNative`. On a real device, Capacitor routes the call
to `EmergencyPlugin.kt` (annotated `@CapacitorPlugin`), which sends an
`Intent` to the `GuardianSafetyForegroundService`. In the browser/dev
environment, it falls back to web APIs (Geolocation, AudioContext) so the
UI is fully testable without a device.

**Native → Frontend (via Capacitor events):**
The Kotlin service emits events through a callback registered by the plugin
(`GuardianSafetyForegroundService.eventListener`). The plugin forwards them
to JavaScript via `notifyListeners("gps_reading", data)`, which the React
hooks subscribe to.

**Updates (via Neon API polling):**
GPS breadcrumbs, SOS events, and emergency alerts are written to Postgres
by the device. Neon API Realtime broadcasts row changes to all family
members' apps over WebSocket channels, so every linked phone updates
instantly without polling.

### Why a Foreground Service?

Android aggressively kills background processes. A **foreground service**
with a persistent notification and `START_STICKY` return policy survives
memory pressure and device reboots. The `BootReceiver` restarts it
automatically after reboot. A **partial wake lock** keeps the CPU running
during an active SOS so GPS and audio continue even when the screen is off.

---

## 2. Database Schema (Neon Postgres)

| Table | Purpose |
|---|---|
| `family_groups` | A family safety network with a unique 8-char join code |
| `profiles` | Per-user display data, role, and family membership |
| `sos_events` | Emergency trigger records (manual, power-button, check-in timeout) |
| `tracking_sessions` | Live GPS streaming sessions tied to an SOS event |
| `gps_breadcrumbs` | Individual GPS pings within a session (high-frequency) |
| `audio_vault_logs` | Stealth audio recording metadata (binary in Storage) |
| `check_ins` | Safe-arrival monitoring with PIN hash + deadline |
| `emergency_alerts` | Per-recipient alert records driving push notifications |

All tables have **Row Level Security** enabled. Policies scope access by
family membership — a user can only see data for their own family group.
See the migration SQL for full policy definitions.

### Realtime Channels

- `sos-{family_id}` — broadcasts SOS event changes to all family members
- `alerts-{user_id}` — broadcasts incoming emergency alerts to a specific user
- `gps-{family_id}` — broadcasts live GPS breadcrumbs to all family members

---

## 3. Family Account & Auto-Linking

1. **Primary user** signs up and selects "New Family" → a `family_groups`
   row is created with an auto-generated 8-char `join_code`.
2. **Other members** sign up and select "Join Family" → enter the code.
   Their `profiles.family_id` is set to the matching group.
3. All members' apps subscribe to the same family realtime channels, so an
   SOS from any phone instantly creates `emergency_alerts` rows for every
   other member, triggering the bypass-DND alarm overlay.

---

## 4. Feature Implementation Map

| Feature | Frontend | Native (Kotlin) | Backend |
|---|---|---|---|
| Manual SOS | `useSOS` hook + hold-to-trigger button | Foreground service start, GPS + audio | `sos_events`, `emergency_alerts` |
| Power Button SOS | Auto-received via event listener | `screenStateReceiver` (5 presses in 3s) | Same as above |
| Live GPS Streaming | `LiveTrackingView` + realtime subscription | `LocationManager` 5s interval breadcrumbs | `tracking_sessions`, `gps_breadcrumbs` |
| Stealth Audio Vault | `AudioVaultView` (playback + list) | `MediaRecorder` (AAC, 44.1kHz) | `audio_vault_logs` + Configured object storage |
| Safe-Arrival Check-In | `CheckInTimer` (circular countdown, PIN) | N/A (timer + Neon API) | `check_ins` with `pin_hash` |
| Emergency Bypass Alarms | `EmergencyAlertOverlay` (loud AudioContext alarm) | High-importance notification channel with `setBypassDnd(true)` | `emergency_alerts` realtime |

---

## 5. Project Structure

```
src/
├── App.tsx                      # Auth-gated entry point
├── main.tsx                     # React root
├── index.css                    # Tailwind + design system
├── lib/
│   ├── apiClient.ts              # Neon API client singleton
│   ├── types.ts                 # TypeScript interfaces for all tables
│   ├── crypto.ts                # PIN hashing (SHA-256 + salt)
│   └── nativeBridge.ts          # Capacitor ↔ Kotlin bridge (with web fallback)
├── context/
│   └── AuthContext.tsx          # Session + profile state
├── hooks/
│   ├── useSOS.ts                # SOS lifecycle (trigger, broadcast, resolve)
│   └── useFamilyData.ts         # Family group, members, realtime alerts
└── components/
    ├── AuthScreen.tsx           # Sign in / Sign up / Create or join family
    ├── Dashboard.tsx            # Main dashboard with SOS button + feature cards
    ├── LiveTrackingView.tsx     # Real-time GPS map + breadcrumb stream
    ├── CheckInTimer.tsx         # Safe-arrival countdown with PIN confirmation
    ├── AudioVaultView.tsx       # Evidence recording list + playback
    └── EmergencyAlertOverlay.tsx # Bypass-DND loud alarm overlay

android/app/src/main/
├── AndroidManifest.xml          # All permissions + service declarations
└── java/com/guardian/safety/
    ├── EmergencyForegroundService.kt  # Power button, GPS, audio
    ├── EmergencyPlugin.kt                  # Capacitor bridge plugin
    └── BootReceiver.kt                     # Auto-restart on boot

capacitor.config.ts              # Capacitor native shell config
```

---

## 6. Build & Deploy

### Web (development / preview)
```bash
npm run build     # Vite production build → dist/
```

### Android (native APK/AAB)
```bash
npm run build              # Build the web bundle
npx cap add android        # First time only — generates native project
npx cap copy               # Copy web bundle into native project
npx cap open android       # Open in Android Studio
# Build APK/AAB from Android Studio
```

### Required Android Permissions (runtime)
The `SosNativePlugin.ensurePermissions()` method requests all permissions at
runtime when the user first triggers SOS:
- `ACCESS_FINE_LOCATION` + `ACCESS_BACKGROUND_LOCATION`
- `RECORD_AUDIO`
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` + `FOREGROUND_SERVICE_MICROPHONE`
- `POST_NOTIFICATIONS` (Android 13+)

---

## 7. Security Notes

- PINs are hashed with SHA-256 + app salt before storage — never stored raw.
- All database access is gated by RLS policies checking family membership.
- Audio files are stored in Configured object storage with family-scoped access.
- The foreground service uses `START_STICKY` + wake lock for reliability.
- Emergency notification channel is set to `IMPORTANCE_HIGH` with
  `setBypassDnd(true)` to override silent / Do Not Disturb modes.
