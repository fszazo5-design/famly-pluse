/**
 * GET /api/family/group?join_code=xxx
 *
 * Looks up a family group by its join code (used during signup).
 *
 * POST /api/family/group
 * Creates a new family group.
 * Body: { name, created_by }
 *
 * POST /api/family/join
 * Joins an existing family group.
 * Body: { join_code, user_id, display_name }
 */

import { sql } from '../lib/neon';
import { json, handleOptions } from '../lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);

  // GET: lookup by join_code
  if (req.method === 'GET') {
    const join_code = url.searchParams.get('join_code');
    if (!join_code) {
      return json({ error: 'join_code is required' }, 400);
    }

    const group = await sql`
      SELECT id, name, join_code, created_at
      FROM family_groups
      WHERE join_code = ${join_code.toUpperCase()}
    `;

    if (group.length === 0) {
      return json({ error: 'Invalid join code' }, 404);
    }

    return json({ group: group[0] });
  }

  // Mutations must use the bearer-protected OTP flow.
  if (req.method === 'POST') {
    return json({ error: 'Use POST /api/family/complete with a verified bearer session.' }, 410);
    /* Legacy implementation intentionally disabled.
    try {
      const body = await req.json();
      const action = body.action;

      if (action === 'create') {
        const { name, created_by } = body;
        if (!name || !created_by) {
          return json({ error: 'name and created_by are required' }, 400);
        }

        const result = await sql`
          INSERT INTO family_groups (name, created_by)
          VALUES (${name}, ${created_by})
          RETURNING id, name, join_code, created_at
        `;

        // Create admin profile
        await sql`
          INSERT INTO profiles (user_id, family_id, display_name, role)
          VALUES (${created_by}, ${result[0].id}, ${body.display_name ?? 'Admin'}, 'admin')
        `;

        return json({ group: result[0] });
      }

      if (action === 'join') {
        const { join_code, user_id, display_name } = body;
        if (!join_code || !user_id || !display_name) {
          return json({ error: 'join_code, user_id, display_name are required' }, 400);
        }

        const group = await sql`
          SELECT id FROM family_groups WHERE join_code = ${join_code.toUpperCase()}
        `;

        if (group.length === 0) {
          return json({ error: 'Invalid join code' }, 404);
        }

        await sql`
          INSERT INTO profiles (user_id, family_id, display_name, role)
          VALUES (${user_id}, ${group[0].id}, ${display_name}, 'member')
          ON CONFLICT (user_id) DO UPDATE
          SET family_id = ${group[0].id}, display_name = ${display_name}
        `;

        return json({ group: group[0] });
      }

      return json({ error: 'Unknown action. Use "create" or "join".' }, 400);
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
    */
  }

  return json({ error: 'Method not allowed' }, 405);
}
