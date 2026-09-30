/**
 * GET /api/family/members?family_id=xxx
 *
 * Returns all members of a family group with their profile data.
 */

import { sql } from '../lib/neon';
import { json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const family_id = url.searchParams.get('family_id');

    if (!family_id) {
      return json({ error: 'family_id is required' }, 400);
    }

    const group = await sql`
      SELECT * FROM family_groups WHERE id = ${family_id}
    `;

    const members = await sql`
      SELECT id, user_id, display_name, role, phone, avatar_url, created_at
      FROM profiles
      WHERE family_id = ${family_id}
      ORDER BY created_at ASC
    `;

    return json({ group: group[0] ?? null, members });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
