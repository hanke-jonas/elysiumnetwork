import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';

// Uppercase letters/digits only, excluding visually ambiguous characters
// (0/O, 1/I/L) -- these get typed or read aloud to a real participant.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const MAX_EDITION_CHARS = 40;
const MAX_LABEL_CHARS = 100;

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

// Staff-only end to end -- this is the invite mechanism, not a public
// endpoint. See functions/api/dots-alumni/submit.js for where a code
// actually gets redeemed.
export async function onRequestGet({ request, env }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const rows = await env.DB.prepare(
      `SELECT c.*, a.name AS alumnus_name, a.slug AS alumnus_slug, a.status AS alumnus_status
       FROM dots_access_codes c LEFT JOIN dots_alumni a ON a.id = c.dots_alumni_id
       ORDER BY c.created_at DESC`,
    ).all();
    return json({ items: rows.results });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    const edition = String(body.edition || '').trim().slice(0, MAX_EDITION_CHARS);
    const label = String(body.label || '').trim().slice(0, MAX_LABEL_CHARS);
    if (!edition) return badRequest('Edition is required');

    const id = randomId();
    let code;
    // Collision odds on an 8-char, 32-symbol alphabet are astronomically
    // low, but the UNIQUE constraint plus a short retry loop makes this
    // correct rather than just "probably fine".
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      try {
        await env.DB.prepare(
          'INSERT INTO dots_access_codes (id, code, edition, label) VALUES (?, ?, ?, ?)',
        ).bind(id, code, edition, label || null).run();
        return json({ id, code, edition, label: label || null }, { status: 201 });
      } catch (err) {
        if (!String(err).includes('UNIQUE constraint failed')) throw err;
      }
    }
    return json({ error: 'Could not generate a unique code, please try again' }, { status: 500 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
