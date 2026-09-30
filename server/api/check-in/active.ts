/**
 * GET /api/check-in/active?family_id=xxx
 *
 * Returns all active check-ins for a family (so members can see
 * who's currently in transit with a safety timer running).
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

    const checkIns = await sql`
      SELECT c.*, p.display_name AS user_name
      FROM check_ins c
      JOIN profiles p ON p.user_id = c.user_id
      WHERE c.family_id = ${family_id} AND c.status = 'active'
      ORDER BY c.deadline_at ASC
    `;

    return json({ check_ins: checkIns });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
