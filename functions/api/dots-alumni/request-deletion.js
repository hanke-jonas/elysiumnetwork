import { badRequest, json, randomId } from '../../_lib/http.js';

// A participant reuses their already-claimed access code to ask for their
// whole entry to be removed, instead of proposing an edit. Reuses the same
// dots_alumni_edits review queue as propose-edit.js (type='delete' instead
// of 'edit') so staff review it in the same place, in /admin/dots-edits/,
// with the same one-pending-row-per-alumnus rule: this overwrites a
// pending edit on the same row rather than creating a second pending item
// (see also propose-edit.js, which does the reverse -- an edit submitted
// after a pending deletion request converts it back to 'edit').
// Approving a 'delete' row deletes the live dots_alumni row -- see
// functions/api/admin/dots-edits/[id].js.
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const code = String((body && body.code) || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');

    const codeRow = await env.DB.prepare('SELECT used_at, dots_alumni_id FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow || !codeRow.used_at || !codeRow.dots_alumni_id) {
      return badRequest('That access code is not linked to an existing entry.');
    }

    const current = await env.DB.prepare('SELECT id FROM dots_alumni WHERE id = ?').bind(codeRow.dots_alumni_id).first();
    if (!current) return badRequest('That entry no longer exists.');

    const existingEdit = await env.DB.prepare(
      "SELECT id FROM dots_alumni_edits WHERE alumni_id = ? AND status = 'pending'",
    ).bind(current.id).first();

    if (existingEdit) {
      await env.DB.prepare(
        "UPDATE dots_alumni_edits SET type = 'delete', proposed_json = '{}', submitted_at = datetime('now') WHERE id = ?",
      ).bind(existingEdit.id).run();
      return json({ ok: true, id: existingEdit.id });
    }

    const id = randomId();
    await env.DB.prepare(
      "INSERT INTO dots_alumni_edits (id, alumni_id, type, proposed_json, status) VALUES (?, ?, 'delete', '{}', 'pending')",
    ).bind(id, current.id).run();

    return json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
