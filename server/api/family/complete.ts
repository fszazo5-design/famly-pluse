import { sql } from '../lib/neon';
import { requireUser } from '../lib/auth';
import { json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await requireUser(req);
    const body = await req.json() as { action?: string; family_name?: string; family_code?: string; display_name?: string };
    const displayName = (body.display_name ?? user.display_name).trim().slice(0, 80);
    if (!displayName) return json({ error: 'الاسم المعروض مطلوب.' }, 400);

    if (body.action === 'create') {
      const name = (body.family_name ?? '').trim().slice(0, 100);
      if (!name) return json({ error: 'اسم العائلة مطلوب.' }, 400);
      const groups = await sql`
        INSERT INTO family_groups (name, created_by) VALUES (${name}, ${user.id})
        RETURNING id, name, join_code, created_by, created_at
      `;
      const group = groups[0];
      await sql`
        INSERT INTO profiles (user_id, family_id, display_name, role, phone)
        VALUES (${user.id}, ${group.id}, ${displayName}, 'admin', ${user.phone_e164})
        ON CONFLICT (user_id) DO UPDATE SET family_id = ${group.id}, display_name = ${displayName}, role = 'admin', phone = ${user.phone_e164}
      `;
      return json({ group, role: 'admin' });
    }

    if (body.action === 'join') {
      const code = (body.family_code ?? '').trim().toUpperCase();
      if (!/^[A-F0-9]{8}$/.test(code)) return json({ error: 'رمز العائلة يجب أن يكون 8 أحرف.' }, 400);
      const groups = await sql`SELECT id, name, join_code, created_by, created_at FROM family_groups WHERE join_code = ${code} LIMIT 1`;
      if (!groups.length) return json({ error: 'رمز العائلة غير صحيح.' }, 404);
      const group = groups[0];
      await sql`
        INSERT INTO profiles (user_id, family_id, display_name, role, phone)
        VALUES (${user.id}, ${group.id}, ${displayName}, 'member', ${user.phone_e164})
        ON CONFLICT (user_id) DO UPDATE SET family_id = ${group.id}, display_name = ${displayName}, role = 'member', phone = ${user.phone_e164}
      `;
      return json({ group, role: 'member' });
    }
    return json({ error: 'action must be create or join' }, 400);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    console.error('family complete failed', error);
    return json({ error: 'تعذر حفظ بيانات العائلة.' }, 500);
  }
}
