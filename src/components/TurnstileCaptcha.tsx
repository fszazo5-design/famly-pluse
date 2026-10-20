import { useEffect, useMemo, useRef, useState } from 'react';

interface TurnstileCaptchaProps {
  siteKey: string;
  widgetOrigin: string;
  resetKey: number;
  onTokenChange: (token: string) => void;
}

interface WidgetMessage {
  source?: unknown;
  type?: unknown;
  token?: unknown;
}

const widgetMessageSource = 'famlypulse-turnstile-widget';

export default function TurnstileCaptcha({ siteKey, widgetOrigin, resetKey, onTokenChange }: TurnstileCaptchaProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);

  const widgetUrl = useMemo(() => {
    if (!siteKey || !widgetOrigin) return '';
    const url = new URL('/turnstile-widget.html', widgetOrigin);
    url.searchParams.set('sitekey', siteKey);
    url.searchParams.set('parentOrigin', window.location.origin);
    return url.toString();
  }, [siteKey, widgetOrigin]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== widgetOrigin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as WidgetMessage | null;
      if (!message || message.source !== widgetMessageSource) return;

      if (message.type === 'token' && typeof message.token === 'string' && message.token.length > 0) {
        setLoadError(false);
        onTokenChange(message.token);
      } else if (message.type === 'expired') {
        onTokenChange('');
      } else if (message.type === 'error') {
        onTokenChange('');
        setLoadError(true);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTokenChange, widgetOrigin]);

  if (!siteKey || !widgetOrigin) {
    return <p role="status" className="text-xs text-primary-300 bg-primary-950/30 border border-primary-800/50 rounded-lg px-3 py-2">
      إعداد Turnstile أو رابط Worker غير موجود؛ لن يُرسل رمز SMS.
    </p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">أكد أنك لست روبوتًا لإرسال رمز SMS.</p>
      <iframe
        key={resetKey}
        ref={frameRef}
        src={widgetUrl}
        title="Cloudflare Turnstile verification"
        loading="eager"
        referrerPolicy="strict-origin"
        className="mx-auto block h-[90px] w-full max-w-[320px] rounded-lg border-0"
      />
      {loadError && <p role="alert" className="text-xs text-primary-300">تعذر تحميل اختبار التحقق. تحقق من اتصال التطبيق ثم أعد المحاولة.</p>}
    </div>
  );
}
