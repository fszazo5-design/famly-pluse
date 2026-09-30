/**
 * POST /api/tracking/breadcrumb
 *
 * Inserts a single GPS breadcrumb for a tracking session.
 * Called frequently by the device while streaming.
 *
 * Body: { session_id, user_id, family_id, latitude, longitude,
 *         accuracy_m?, speed_mps?, heading_deg?, altitude_m?, battery_level? }
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
    const b = await req.json();
    const { session_id, user_id, family_id, latitude, longitude } = b;

    if (!session_id || !user_id || !family_id || latitude == null || longitude == null) {
      return json({ error: 'session_id, user_id, family_id, latitude, longitude are required' }, 400);
    }

    await sql`
      INSERT INTO gps_breadcrumbs
        (session_id, user_id, family_id, latitude, longitude,
         accuracy_m, speed_mps, heading_deg, altitude_m, battery_level)
      VALUES
        (${session_id}, ${user_id}, ${family_id}, ${latitude}, ${longitude},
         ${b.accuracy_m ?? null}, ${b.speed_mps ?? null},
         ${b.heading_deg ?? null}, ${b.altitude_m ?? null}, ${b.battery_level ?? null})
    `;

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
