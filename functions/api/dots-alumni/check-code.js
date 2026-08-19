import { badRequest, json } from '../../_lib/http.js';

// Public, unauthenticated -- lets the submission page validate a code
// before revealing the full form, and tells it which mode to show:
// - Fresh code (never used): "create" -- the normal new-submission form.
// - Already used, linked to an entry: "edit" -- the participant is
//   proposing changes to their existing page. Returns the entry's
//   current data so the form can be pre-filled.
// Never claims/mutates the code itself -- functions/api/dots-alumni/
// submit.js and propose-edit.js do that atomically at actual submission.
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const code = String((body && body.code) || '').trim().toUpperCase();
    if (!code) return badRequest('Code is required');

    const row = await env.DB.prepare('SELECT edition, used_at, dots_alumni_id FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!row) return json({ valid: false, error: 'That code was not recognized.' });

    if (!row.used_at) {
      return json({ valid: true, mode: 'create', edition: row.edition });
    }

    if (!row.dots_alumni_id) {
      // Used, but never actually produced an entry (shouldn't normally
      // happen given how submit.js claims a code, but fail safe).
      return json({ valid: false, error: 'That code has already been used.' });
    }

    const alumnus = await env.DB.prepare('SELECT * FROM dots_alumni WHERE id = ?').bind(row.dots_alumni_id).first();
    if (!alumnus) return json({ valid: false, error: 'That code has already been used.' });

    return json({
      valid: true,
      mode: 'edit',
      edition: row.edition,
      current: {
        name: alumnus.name,
        bio: alumnus.bio,
        story: alumnus.story,
        photoUrl: alumnus.photo_url,
        photos: JSON.parse(alumnus.photos_json || '[]'),
        links: JSON.parse(alumnus.links_json || '[]'),
        blocks: JSON.parse(alumnus.blocks_json || 'null'),
      },
    });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
