/**
 * GET /api/tracking/sessions?family_id=xxx
 *
 * Returns all live tracking sessions for a family, with the latest
 * breadcrumb for each (so the map can show current positions).
 *
 * Also supports ?session_id=xxx to get the full breadcrumb trail
 * for a specific session.
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
    const session_id = url.searchParams.get('session_id');

    if (session_id) {
      // Full breadcrumb trail for a specific session
      const crumbs = await sql`
        SELECT * FROM gps_breadcrumbs
        WHERE session_id = ${session_id}
        ORDER BY recorded_at ASC
        LIMIT 500
      `;
      return json({ breadcrumbs: crumbs });
    }

    if (!family_id) {
      return json({ error: 'family_id or session_id is required' }, 400);
    }

    // Get all live sessions for the family
    const sessions = await sql`
      SELECT ts.*, p.display_name AS user_name
      FROM tracking_sessions ts
      JOIN profiles p ON p.user_id = ts.user_id
      WHERE ts.family_id = ${family_id} AND ts.status = 'live'
      ORDER BY ts.started_at DESC
    `;

    // Get latest breadcrumb per session
    const latest = await sql`
      SELECT DISTINCT ON (session_id)
        session_id, latitude, longitude, accuracy_m, speed_mps,
        heading_deg, altitude_m, battery_level, recorded_at
      FROM gps_breadcrumbs
      WHERE family_id = ${family_id}
      ORDER BY session_id, recorded_at DESC
    `;

    // Build a map: session_id -> latest position
    const latestMap = new Map();
    for (const l of latest) {
      latestMap.set(l.session_id, l);
    }

    const result = sessions.map((s: any) => ({
      ...s,
      latest_position: latestMap.get(s.id) ?? null,
    }));

    return json({ sessions: result });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
