/**
 * POST /api/tracking/stop
 *
 * Ends a live tracking session.
 *
 * Body: { session_id }
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
    const { session_id } = await req.json();

    if (!session_id) {
      return json({ error: 'session_id is required' }, 400);
    }

    await sql`
      UPDATE tracking_sessions
      SET status = 'ended', ended_at = NOW()
      WHERE id = ${session_id}
    `;

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
