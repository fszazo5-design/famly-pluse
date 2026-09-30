/**
 * POST /api/check-in/create
 *
 * Creates a safe-arrival check-in with a deadline and PIN hash.
 *
 * Body: { family_id, user_id, pin_hash, destination_name?,
 *         destination_lat?, destination_lng?, deadline_at }
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
    const { family_id, user_id, pin_hash, deadline_at } = b;

    if (!family_id || !user_id || !pin_hash || !deadline_at) {
      return json({ error: 'family_id, user_id, pin_hash, deadline_at are required' }, 400);
    }

    // Cancel any existing active check-in for this user
    await sql`
      UPDATE check_ins SET status = 'cancelled'
      WHERE user_id = ${user_id} AND status = 'active'
    `;

    const result = await sql`
      INSERT INTO check_ins
        (family_id, user_id, pin_hash, destination_name,
         destination_lat, destination_lng, deadline_at, status)
      VALUES
        (${family_id}, ${user_id}, ${pin_hash}, ${b.destination_name ?? null},
         ${b.destination_lat ?? null}, ${b.destination_lng ?? null},
         ${deadline_at}, 'active')
      RETURNING id, deadline_at, status, created_at
    `;

    return json({ check_in: result[0] });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
