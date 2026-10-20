import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import {
  checkForOtaUpdate,
  downloadAndStageOtaUpdate,
  isOtaSupported,
  OtaUpdateError,
  type OtaUpdateInfo,
} from '@/lib/ota';

export default function OtaUpdateNotice() {
  const [update, setUpdate] = useState<OtaUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isOtaSupported()) return;
    let cancelled = false;
    setChecking(true);
    checkForOtaUpdate()
      .then((result) => {
        if (!cancelled) setUpdate(result);
      })
      .catch(() => {
        // OTA is optional; a failed check must never block the app.
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isOtaSupported() || checking || !update || dismissed) return null;

  async function installUpdate() {
    if (!update) return;
    setInstalling(true);
    setMessage(null);
    try {
      await downloadAndStageOtaUpdate(update);
      setMessage('تم تنزيل التحديث. سيُفعّل عند إعادة فتح التطبيق.');
    } catch (error: unknown) {
      const diagnostic = error instanceof OtaUpdateError
        ? `${error.message}\nكود الخطأ: ${error.code}\nالتفاصيل: ${error.technicalDetails}`
        : `فشل غير متوقع في OTA: ${error instanceof Error ? error.message : String(error)}`;
      console.error('OTA update failed', error);
      setMessage(diagnostic);
      setInstalling(false);
    }
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto rounded-2xl border border-accent-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md" dir="rtl">
      <button
        aria-label="إغلاق تنبيه التحديث"
        onClick={() => setDismissed(true)}
        className="absolute left-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pl-6">
        <div className="rounded-xl bg-accent-500/15 p-2 text-accent-400">
          {installing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">يتوفر تحديث جديد للواجهة</p>
          <p className="mt-1 whitespace-pre-line text-xs text-slate-400">{message || `الإصدار ${update.version}`}</p>
          {!message && (
            <button
              onClick={installUpdate}
              disabled={installing}
              className="mt-3 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-500 disabled:opacity-60"
            >
              {installing ? 'جارٍ التنزيل...' : 'تنزيل التحديث'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
