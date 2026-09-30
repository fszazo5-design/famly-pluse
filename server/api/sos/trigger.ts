/**
 * POST /api/sos/trigger
 *
 * Creates a new SOS event in the Neon database and returns the event ID.
 * The frontend then opens a tracking session and broadcasts alerts.
 *
 * Body: { family_id, triggered_by, trigger_type, latitude?, longitude?, message? }
 */

import { sql } from '../lib/neon';
import { corsHeaders, json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    const { family_id, triggered_by, trigger_type = 'manual', latitude, longitude, message } = body;

    if (!family_id || !triggered_by) {
      return json({ error: 'family_id and triggered_by are required' }, 400);
    }

    const result = await sql`
      INSERT INTO sos_events (family_id, triggered_by, trigger_type, status, latitude, longitude, message)
      VALUES (${family_id}, ${triggered_by}, ${trigger_type}, 'active', ${latitude ?? null}, ${longitude ?? null}, ${message ?? null})
      RETURNING id, family_id, triggered_by, trigger_type, status, latitude, longitude, message, created_at
    `;

    const event = result[0];

    // Broadcast emergency alerts to all family members (except sender)
    const members = await sql`
      SELECT user_id FROM profiles WHERE family_id = ${family_id} AND user_id != ${triggered_by}
    `;

    if (members.length > 0) {
      await sql`
        INSERT INTO emergency_alerts (sos_event_id, recipient_id, family_id)
        SELECT ${event.id}, user_id, ${family_id}
        FROM profiles
        WHERE family_id = ${family_id} AND user_id != ${triggered_by}
      `;
    }

    return json({ event, alerts_sent: members.length });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
