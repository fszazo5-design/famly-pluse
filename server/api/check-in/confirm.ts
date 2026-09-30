/**
 * POST /api/check-in/confirm
 *
 * Confirms a safe arrival by verifying the PIN hash.
 *
 * Body: { check_in_id, pin_hash }
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
    const { check_in_id, pin_hash } = await req.json();

    if (!check_in_id || !pin_hash) {
      return json({ error: 'check_in_id and pin_hash are required' }, 400);
    }

    const rows = await sql`
      SELECT pin_hash FROM check_ins WHERE id = ${check_in_id} AND status = 'active'
    `;

    if (rows.length === 0) {
      return json({ error: 'Check-in not found or already resolved' }, 404);
    }

    if (rows[0].pin_hash !== pin_hash) {
      return json({ error: 'Incorrect PIN' }, 403);
    }

    await sql`
      UPDATE check_ins
      SET status = 'confirmed', confirmed_at = NOW()
      WHERE id = ${check_in_id}
    `;

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
