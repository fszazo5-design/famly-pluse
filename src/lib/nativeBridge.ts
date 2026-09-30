/**
 * Native Bridge — talks to the Kotlin foreground service via Capacitor.
 *
 * In the web/dev environment these fall back to browser APIs so the UI is
 * fully functional for preview. On a real Android device, Capacitor routes
 * the calls to the registered Kotlin plugin (EmergencyPlugin).
 */

export interface GPSReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
}

type Listener = (reading: GPSReading) => void;

interface EmergencyPluginApi {
  triggerSOS: () => Promise<{ eventId: string }>;
  cancelSOS: () => Promise<void>;
  startGPSTracking: () => Promise<void>;
  stopGPSTracking: () => Promise<void>;
  startAudioRecording: () => Promise<void>;
  stopAudioRecording: () => Promise<{ path: string; durationSec: number; sizeBytes: number }>;
}

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNative?: () => boolean;
    Plugins?: {
      EmergencyPlugin?: EmergencyPluginApi;
      SosNative?: EmergencyPluginApi;
    };
  };
}

class NativeBridge {
  private capacitor: CapacitorWindow['Capacitor'] | null = null;
  private gpsWatchId: number | null = null;
  private geoListeners: Set<Listener> = new Set();

  constructor() {
    try {
      // Capacitor injects a global; available only in the native shell.
      this.capacitor = (window as CapacitorWindow).Capacitor ?? null;
    } catch {
      this.capacitor = null;
    }
  }

  private get plugin(): EmergencyPluginApi | null {
    if (!this.capacitor) return null;
    try {
      return this.capacitor.Plugins?.EmergencyPlugin ?? this.capacitor.Plugins?.SosNative ?? null;
    } catch {
      return null;
    }
  }

  /** True when running inside the Capacitor Android shell. */
  get isNative(): boolean {
    return this.capacitor?.isNative?.() ?? false;
  }

  /**
   * Trigger the SOS sequence natively: starts foreground service, begins
   * GPS streaming, and activates stealth audio recording. Returns the native
   * event id (or a generated one in web mode).
   */
  async triggerSOS(): Promise<{ eventId: string }> {
    const plugin = this.plugin;
    if (plugin) {
      return plugin.triggerSOS();
    }
    return { eventId: crypto.randomUUID() };
  }

  /** Cancel / resolve an active SOS. */
  async cancelSOS(): Promise<void> {
    const plugin = this.plugin;
    if (plugin) return plugin.cancelSOS();
  }

  /** Start continuous GPS tracking + streaming. */
  async startGPSTracking(): Promise<void> {
    const plugin = this.plugin;
    if (plugin) return plugin.startGPSTracking();
    this.startWebGeo();
  }

  /** Stop GPS tracking. */
  async stopGPSTracking(): Promise<void> {
    const plugin = this.plugin;
    if (plugin) return plugin.stopGPSTracking();
    this.stopWebGeo();
  }

  /** Begin stealth microphone recording. */
  async startAudioRecording(): Promise<void> {
    const plugin = this.plugin;
    if (plugin) return plugin.startAudioRecording();
  }

  /** Stop recording and upload the file to cloud storage. */
  async stopAudioRecording(): Promise<{ path: string; durationSec: number; sizeBytes: number }> {
    const plugin = this.plugin;
    if (plugin) return plugin.stopAudioRecording();
    return { path: '', durationSec: 0, sizeBytes: 0 };
  }

  /** Subscribe to GPS readings. Returns an unsubscribe function. */
  onGPSReading(cb: Listener): () => void {
    this.geoListeners.add(cb);
    return () => this.geoListeners.delete(cb);
  }

  // ---- Web fallback using the Geolocation API ----

  private startWebGeo() {
    if (this.gpsWatchId !== null || !navigator.geolocation) return;
    this.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading: GPSReading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          altitude: pos.coords.altitude,
        };
        this.geoListeners.forEach((l) => l(reading));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  private stopWebGeo() {
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
  }
}

export const nativeBridge = new NativeBridge();
