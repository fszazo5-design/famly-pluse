/**
 * POST /api/audio-vault/log
 *
 * Records metadata for an uploaded stealth audio recording.
 * The audio file itself is uploaded to cloud storage; this endpoint
 * stores the path + metadata in the database.
 *
 * Body: { family_id, user_id, sos_event_id?, storage_path, duration_sec,
 *         file_size_bytes, mime_type? }
 *
 * GET /api/audio-vault/logs?family_id=xxx
 * Returns all audio vault logs for a family.
 */

import { sql } from '../lib/neon';
import { json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  // GET: list logs
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const family_id = url.searchParams.get('family_id');

      if (!family_id) {
        return json({ error: 'family_id is required' }, 400);
      }

      const logs = await sql`
        SELECT a.*, p.display_name AS user_name
        FROM audio_vault_logs a
        JOIN profiles p ON p.user_id = a.user_id
        WHERE a.family_id = ${family_id}
        ORDER BY a.recorded_at DESC
        LIMIT 50
      `;

      return json({ logs });
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  // POST: create log
  if (req.method === 'POST') {
    try {
      const b = await req.json();
      const { family_id, user_id, storage_path, duration_sec } = b;

      if (!family_id || !user_id || !storage_path || duration_sec == null) {
        return json({ error: 'family_id, user_id, storage_path, duration_sec are required' }, 400);
      }

      const result = await sql`
        INSERT INTO audio_vault_logs
          (family_id, user_id, sos_event_id, storage_path, duration_sec,
           file_size_bytes, mime_type)
        VALUES
          (${family_id}, ${user_id}, ${b.sos_event_id ?? null}, ${storage_path},
           ${duration_sec}, ${b.file_size_bytes ?? 0}, ${b.mime_type ?? 'audio/aac'})
        RETURNING id, recorded_at
      `;

      return json({ log: result[0] });
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
