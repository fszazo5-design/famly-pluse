import { sql } from './neon';

export interface AuthUser {
  id: string;
  phone_e164: string;
  display_name: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function createSession(userId: string): Promise<string> {
  const token = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
  const tokenHash = await sha256(token);
  await sql`
    DELETE FROM auth_sessions WHERE user_id = ${userId} OR expires_at < now()
  `;
  await sql`
    INSERT INTO auth_sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, now() + interval '30 days')
  `;
  return token;
}

export async function requireUser(req: Request): Promise<AuthUser> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('UNAUTHORIZED');
  const tokenHash = await sha256(token);
  const rows = await sql`
    SELECT u.id, u.phone_e164, u.display_name
    FROM auth_sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('UNAUTHORIZED');
  return rows[0] as AuthUser;
}
