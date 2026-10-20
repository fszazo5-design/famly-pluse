import { sql } from '../lib/neon';
import { createSession } from '../lib/auth';
import { getAuth0Config } from '../lib/auth0';
import { json, handleOptions } from '../lib/http';
import { validInternationalPhone } from '../lib/phone';

export const config = { runtime: 'edge' };

interface Auth0TokenResponse {
  access_token?: string;
}

interface Auth0UserInfo {
  sub?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
}

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { phone, code, display_name } = await req.json();
    if (!validInternationalPhone(phone) || typeof code !== 'string' || !/^\d{4,10}$/.test(code)) {
      return json({ error: 'رقم الهاتف أو رمز التحقق غير صالح.' }, 400);
    }

    const auth0 = getAuth0Config();
    if (!auth0) return json({ error: 'إعداد تسجيل الدخول عبر Auth0 غير مكتمل.' }, 503);

    const tokenBody = new URLSearchParams({
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      client_id: auth0.clientId,
      client_secret: auth0.clientSecret,
      username: phone,
      otp: code,
      realm: 'sms',
      scope: 'openid profile phone',
      redirect_uri: auth0.redirectUri,
    });
    const tokenResponse = await fetch(`${auth0.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: tokenBody,
    });
    const tokens = await tokenResponse.json().catch(() => ({})) as Auth0TokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) {
      console.error('Auth0 passwordless exchange failed', tokenResponse.status);
      if (tokenResponse.status === 429) return json({ error: 'تجاوزت حد محاولات التحقق؛ حاول لاحقًا.' }, 429);
      return json({ error: 'رمز التحقق غير صحيح أو منتهي.' }, 401);
    }

    // Auth0 validates its own bearer token and returns the claims allowed by the `phone` scope.
    const userInfoResponse = await fetch(`${auth0.baseUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    });
    const userInfo = await userInfoResponse.json().catch(() => ({})) as Auth0UserInfo;
    if (!userInfoResponse.ok || userInfo.phone_number_verified !== true || userInfo.phone_number !== phone) {
      console.error('Auth0 UserInfo did not confirm the requested phone', userInfoResponse.status);
      return json({ error: 'تعذر تأكيد ملكية رقم الهاتف عبر Auth0.' }, 401);
    }

    const safeName = typeof display_name === 'string' ? display_name.trim().slice(0, 80) : '';
    const users = await sql`
      INSERT INTO app_users (phone_e164, phone_verified_at, display_name)
      VALUES (${userInfo.phone_number}, now(), ${safeName})
      ON CONFLICT (phone_e164) DO UPDATE SET phone_verified_at = now(),
        display_name = CASE WHEN ${safeName} = '' THEN app_users.display_name ELSE ${safeName} END
      RETURNING id, phone_e164, display_name
    `;
    const user = users[0];
    const token = await createSession(user.id as string);
    const profiles = await sql`
      SELECT id, user_id, family_id, display_name, role, phone, avatar_url, created_at
      FROM profiles WHERE user_id = ${user.id} LIMIT 1
    `;
    return json({ token, user, profile: profiles[0] ?? null });
  } catch (error) {
    console.error('verify-otp failed', error);
    return json({ error: 'تعذر إكمال التحقق.' }, 500);
  }
}
