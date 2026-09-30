/**
 * POST /api/sos/resolve
 *
 * Marks an SOS event as resolved and ends any active tracking session.
 *
 * Body: { event_id, resolved_by }
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
    const { event_id, resolved_by } = await req.json();

    if (!event_id) {
      return json({ error: 'event_id is required' }, 400);
    }

    await sql`
      UPDATE sos_events
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = ${event_id}
    `;

    await sql`
      UPDATE tracking_sessions
      SET status = 'ended', ended_at = NOW()
      WHERE sos_event_id = ${event_id} AND status = 'live'
    `;

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
