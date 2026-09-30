/**
 * POST /api/tracking/start
 *
 * Opens a new live tracking session for a user.
 *
 * Body: { family_id, user_id, sos_event_id? }
 * Returns: { session }
 */

import { sql } from '../lib/neon';
import { json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { family_id, user_id, sos_event_id } = await req.json();

    if (!family_id || !user_id) {
      return json({ error: 'family_id and user_id are required' }, 400);
    }

    // End any existing live session for this user first
    await sql`
      UPDATE tracking_sessions
      SET status = 'ended', ended_at = NOW()
      WHERE user_id = ${user_id} AND status = 'live'
    `;

    const result = await sql`
      INSERT INTO tracking_sessions (family_id, user_id, sos_event_id, status)
      VALUES (${family_id}, ${user_id}, ${sos_event_id ?? null}, 'live')
      RETURNING id, family_id, user_id, sos_event_id, status, started_at
    `;

    return json({ session: result[0] });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
