/**
 * GET /api/sos/active?family_id=xxx
 *
 * Returns all active SOS events for a family group.
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

    const events = await sql`
      SELECT e.*, p.display_name AS sender_name
      FROM sos_events e
      JOIN profiles p ON p.user_id = e.triggered_by
      WHERE e.family_id = ${family_id} AND e.status = 'active'
      ORDER BY e.created_at DESC
    `;

    return json({ events });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
