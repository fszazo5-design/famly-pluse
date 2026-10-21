import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type DevicePermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' | 'unavailable';

export async function getLocationPermissionState(): Promise<DevicePermissionState> {
  if (!Capacitor.isNativePlatform()) return 'unavailable';
  try {
    const status = await Geolocation.checkPermissions();
    return status.location;
  } catch {
    return 'denied';
  }
}

/** Request foreground location only; background access is not silently requested. */
export async function requestLocationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const current = await Geolocation.checkPermissions();
    const result = current.location === 'granted'
      ? current
      : await Geolocation.requestPermissions({ permissions: ['location'] });
    return result.location === 'granted';
  } catch {
    // This also covers device location services being disabled.
    return false;
  }
}
