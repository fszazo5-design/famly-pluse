import { sql } from '../lib/neon';
import { getAuth0Config, trustedClientIp } from '../lib/auth0';
import { checkBotId } from 'botid/server';
import { isTurnstileConfigured, verifyTurnstileToken } from '../lib/turnstile';
import { json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

function validE164(phone: unknown): phone is string {
  return typeof phone === 'string' && /^\+[1-9]\d{7,14}$/.test(phone);
}

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { phone, captchaToken } = await req.json();
    if (!validE164(phone)) return json({ error: 'استخدم رقمًا دوليًا بصيغة E.164 مثل +9665XXXXXXX.' }, 400);

    const auth0 = getAuth0Config();
    if (!auth0) return json({ error: 'إعداد تسجيل الدخول عبر Auth0 غير مكتمل.' }, 503);

    if (typeof captchaToken === 'string' && captchaToken.trim()) {
      if (!isTurnstileConfigured()) return json({ error: 'تحقق Turnstile غير مهيأ على الخادم.' }, 503);
      const captchaValid = await verifyTurnstileToken(captchaToken, req);
      if (captchaValid === null) return json({ error: 'تعذر الاتصال بخدمة Turnstile. حاول لاحقًا.' }, 502);
      if (!captchaValid) return json({ error: 'فشل اختبار التحقق. أكمله ثم حاول مرة أخرى.' }, 400);
    } else {
      const botIdHeadersPresent = req.headers.has('x-is-human')
        && req.headers.get('x-path') === '/api/auth/request-otp'
        && req.headers.get('x-method')?.toUpperCase() === 'POST';
      if (!botIdHeadersPresent) return json({ error: 'يلزم إكمال التحقق الأمني قبل طلب الرمز.' }, 403);

      let botVerification;
      try {
        botVerification = await checkBotId({ advancedOptions: { checkLevel: 'basic' } });
      } catch (error) {
        console.error('BotID verification failed', error);
        return json({ error: 'تحقق BotID غير مهيأ في Vercel. فعّل OIDC ثم حاول مرة أخرى.' }, 503);
      }
      if (botVerification.isBot) return json({ error: 'تم رفض الطلب الآلي. حاول من متصفح عادي.' }, 403);
    }

    const recent = await sql`
      SELECT last_requested_at FROM otp_requests WHERE phone_e164 = ${phone} LIMIT 1
    `;
    if (recent.length && Date.now() - new Date(recent[0].last_requested_at as string).getTime() < 60_000) {
      return json({ error: 'انتظر دقيقة قبل طلب رمز جديد.' }, 429);
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-request-language': 'ar',
    });
    const clientIp = trustedClientIp(req);
    if (clientIp) headers.set('auth0-forwarded-for', clientIp);

    const response = await fetch(`${auth0.baseUrl}/passwordless/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_id: auth0.clientId,
        client_secret: auth0.clientSecret,
        connection: 'sms',
        phone_number: phone,
        send: 'code',
        authParams: {
          scope: 'openid profile phone',
          redirect_uri: auth0.redirectUri,
        },
      }),
    });

    if (!response.ok) {
      console.error('Auth0 passwordless start failed', response.status);
      if (response.status === 429) return json({ error: 'تجاوزت حد طلب الرموز؛ حاول لاحقًا.' }, 429);
      return json({ error: 'تعذر إرسال الرمز عبر Auth0. تحقق من إعداد SMS في Auth0.' }, 502);
    }

    await sql`
      INSERT INTO otp_requests (phone_e164, last_requested_at, request_count)
      VALUES (${phone}, now(), 1)
      ON CONFLICT (phone_e164) DO UPDATE
      SET last_requested_at = now(), request_count = otp_requests.request_count + 1
    `;
    return json({ accepted: true, expires_in_seconds: 180 });
  } catch (error) {
    console.error('request-otp failed', error);
    return json({ error: 'تعذر إرسال رمز التحقق.' }, 500);
  }
}
