import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

// Revoking a code just deletes it -- if it was already used, the
// submission it produced is untouched (dots_access_codes.dots_alumni_id
// only exists for staff's own traceability, dots_alumni doesn't reference
// it back).
export async function onRequestDelete({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    await env.DB.prepare('DELETE FROM dots_access_codes WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

// Swaps this row's code string for a freshly generated one -- same row,
// same dots_alumni_id link, same used_at/entry_deleted_at history, just a
// new secret. The old code string stops working the instant this runs
// (it's simply no longer any row's `code` value), which is the point:
// staff use this when a participant's code may have leaked and needs
// replacing without disturbing their actual page or its review history.
export async function onRequestPut({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const existing = await env.DB.prepare('SELECT id FROM dots_access_codes WHERE id = ?').bind(params.id).first();
    if (!existing) return json({ error: 'Not found' }, { status: 404 });

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        await env.DB.prepare('UPDATE dots_access_codes SET code = ? WHERE id = ?').bind(code, params.id).run();
        return json({ ok: true, code });
      } catch (err) {
        if (!String(err).includes('UNIQUE constraint failed')) throw err;
      }
    }
    return badRequest('Could not generate a unique code, please try again');
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
