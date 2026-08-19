import { badRequest, json } from '../../_lib/http.js';

// Public, unauthenticated -- lets the submission form validate a code
// (and show which edition it unlocks) before revealing the full form.
// Doesn't claim the code; functions/api/dots-alumni/submit.js does that
// atomically at actual submission time.
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const code = String((body && body.code) || '').trim().toUpperCase();
    if (!code) return badRequest('Code is required');

    const row = await env.DB.prepare('SELECT edition, used_at FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!row) return json({ valid: false, error: 'That code was not recognized.' });
    if (row.used_at) return json({ valid: false, error: 'That code has already been used.' });

    return json({ valid: true, edition: row.edition });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
