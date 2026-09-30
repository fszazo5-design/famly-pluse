interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
}

const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

function trustedClientIp(request: Request): string | null {
  const ip = request.headers.get('x-real-ip')?.trim();
  if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

/** Returns null for configuration/provider failures and false for rejected tokens. */
export async function verifyTurnstileToken(token: unknown, request: Request): Promise<boolean | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return null;
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  try {
    const body: { secret: string; response: string; remoteip?: string } = { secret, response: token };
    const remoteIp = trustedClientIp(request);
    if (remoteIp) body.remoteip = remoteIp;

    const response = await fetch(siteverifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;

    const result = await response.json().catch(() => null) as SiteverifyResponse | null;
    if (!result) return null;

    const requestHostname = new URL(request.url).hostname.toLowerCase();
    return result.success === true
      && result.action === 'request_otp'
      && typeof result.hostname === 'string'
      && result.hostname.toLowerCase() === requestHostname;
  } catch {
    return null;
  }
}
