export interface Auth0Config {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Auth0 credentials are deliberately read only in server functions, never exposed to Vite. */
export function getAuth0Config(): Auth0Config | null {
  const rawDomain = process.env.AUTH0_DOMAIN?.trim();
  const clientId = process.env.AUTH0_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_CLIENT_SECRET?.trim();
  if (!rawDomain || !clientId || !clientSecret) return null;

  try {
    const domainUrl = new URL(rawDomain.includes('://') ? rawDomain : `https://${rawDomain}`);
    if (domainUrl.protocol !== 'https:') return null;

    const redirectUri = process.env.AUTH0_REDIRECT_URI?.trim() || 'https://famlypulse.vercel.app/';
    const callbackUrl = new URL(redirectUri);
    if (callbackUrl.protocol !== 'https:' && callbackUrl.hostname !== 'localhost') return null;

    return {
      baseUrl: domainUrl.origin,
      clientId,
      clientSecret,
      redirectUri: callbackUrl.toString(),
    };
  } catch {
    return null;
  }
}

/** Forward only Vercel's platform-provided single-client IP header to Auth0. */
export function trustedClientIp(request: Request): string | null {
  const ip = request.headers.get('x-real-ip')?.trim();
  if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}
