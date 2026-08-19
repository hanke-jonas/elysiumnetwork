import { requireStaff } from '../../../_lib/guard.js';
import { json } from '../../../_lib/http.js';

// Staff-only queue of edit proposals participants submitted via their
// access code (functions/api/dots-alumni/propose-edit.js). Joins in the
// live alumnus's current field values alongside each proposal's
// proposed_json so the review UI (src/admin/dots-edits.njk) can render a
// side-by-side before/after without a second round-trip per row.
export async function onRequestGet({ request, env }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

    const rows = await env.DB.prepare(
      `SELECT e.id, e.alumni_id, e.type, e.proposed_json, e.status, e.submitted_at, e.reviewed_at,
              a.name AS current_name, a.pronouns AS current_pronouns,
              a.current_role AS current_current_role, a.location AS current_location,
              a.quote AS current_quote, a.bio AS current_bio, a.story AS current_story,
              a.photo_url AS current_photo_url, a.photos_json AS current_photos_json,
              a.links_json AS current_links_json, a.blocks_json AS current_blocks_json,
              a.slug AS alumni_slug
       FROM dots_alumni_edits e
       JOIN dots_alumni a ON a.id = e.alumni_id
       WHERE e.status = ?
       ORDER BY e.submitted_at DESC`,
    ).bind(status).all();

    return json({ items: rows.results });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
