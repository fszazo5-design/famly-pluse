import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { BellRing, Check, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { getLocationPermissionState, requestLocationPermission, type DevicePermissionState } from '@/lib/devicePermissions';

type PushPermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' | 'unavailable';
type BusyAction = 'location' | 'notifications' | null;

export default function DevicePermissionCard() {
  const [location, setLocation] = useState<DevicePermissionState>('prompt');
  const [notifications, setNotifications] = useState<PushPermissionState>('prompt');
  const [fcmRegistered, setFcmRegistered] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    const initialize = async () => {
      try {
        listeners.push(await PushNotifications.addListener('registration', () => {
          if (active) {
            setFcmRegistered(true);
            setMessage(null);
          }
        }));
        listeners.push(await PushNotifications.addListener('registrationError', () => {
          if (active) {
            setFcmRegistered(false);
            setMessage('تعذر تسجيل الجهاز في Firebase. تحقق من اتصال الإنترنت وإعداد التطبيق.');
          }
        }));

        const [locationState, pushState] = await Promise.all([
          getLocationPermissionState(),
          LocalNotifications.checkPermissions(),
        ]);
        if (!active) return;
        setLocation(locationState);
        setNotifications(pushState.display);
        setLoading(false);

        // Re-register silently only if the user has already granted notifications.
        if (pushState.display === 'granted') {
          await PushNotifications.register();
        }
      } catch {
        if (active) {
          setLoading(false);
          setMessage('تعذر فحص أذونات الجهاز. أعد المحاولة بعد تحديث التطبيق.');
        }
      }
    };

    void initialize();
    return () => {
      active = false;
      void Promise.all(listeners.map((listener) => listener.remove()));
    };
  }, []);

  if (!Capacitor.isNativePlatform()) return null;

  const enableLocation = async () => {
    setBusy('location');
    setMessage(null);
    const granted = await requestLocationPermission();
    setLocation(granted ? 'granted' : 'denied');
    setMessage(granted
      ? 'تم تفعيل الموقع. سيُستخدم عند بدء التتبع أو إرسال SOS.'
      : 'لم يُمنح إذن الموقع أو أن خدمة الموقع متوقفة. يمكنك السماح به من إعدادات التطبيق > الأذونات > الموقع.');
    setBusy(null);
  };

  const enableNotifications = async () => {
    setBusy('notifications');
    setMessage(null);
    try {
      const current = await LocalNotifications.checkPermissions();
      const result = current.display === 'granted'
        ? current
        : await LocalNotifications.requestPermissions();
      setNotifications(result.display);
      if (result.display !== 'granted') {
        setMessage('لم يُمنح إذن الإشعارات. يمكنك السماح به من إعدادات التطبيق > الإشعارات.');
        return;
      }
      setFcmRegistered(false);
      await PushNotifications.register();
      setMessage('تم منح إذن الإشعارات وطلب تسجيل الجهاز في Firebase.');
    } catch {
      setMessage('تعذر تفعيل إشعارات Firebase. تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      setBusy(null);
    }
  };

  const ready = location === 'granted' && notifications === 'granted' && fcmRegistered;
  if (ready) return null;

  return (
    <section className="glass-card border border-white/10 p-4 mb-5" aria-labelledby="device-permissions-title">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-600/20 border border-accent-500/20 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-accent-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="device-permissions-title" className="text-sm font-semibold text-white">أذونات جهازك</h3>
          <p className="text-xs text-slate-400 mt-1">
            فعّل الموقع للتتبع عند طلبه، والإشعارات لاستقبال تنبيهات العائلة على هذا الجهاز.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          type="button"
          onClick={() => void enableLocation()}
          disabled={loading || busy !== null || location === 'granted'}
          className="btn-secondary min-h-11 px-3 py-2 text-xs flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'location' ? <Loader2 className="w-4 h-4 animate-spin" /> : location === 'granted' ? <Check className="w-4 h-4 text-success-400" /> : <MapPin className="w-4 h-4" />}
          {location === 'granted' ? 'الموقع مفعّل' : 'تفعيل الموقع'}
        </button>
        <button
          type="button"
          onClick={() => void enableNotifications()}
          disabled={loading || busy !== null || (notifications === 'granted' && fcmRegistered)}
          className="btn-secondary min-h-11 px-3 py-2 text-xs flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'notifications' ? <Loader2 className="w-4 h-4 animate-spin" /> : notifications === 'granted' && fcmRegistered ? <Check className="w-4 h-4 text-success-400" /> : <BellRing className="w-4 h-4" />}
          {notifications === 'granted' ? (fcmRegistered ? 'إشعارات مفعّلة' : 'ربط Firebase') : 'تفعيل الإشعارات'}
        </button>
      </div>

      {message && <p role="status" className="text-xs text-slate-300 mt-3 leading-relaxed">{message}</p>}
    </section>
  );
}
