import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';

const PROPOSED_FIELD_MAP = {
  name: 'name',
  pronouns: 'pronouns',
  current_role: 'current_role',
  location: 'location',
  quote: 'quote',
  bio: 'bio',
  story: 'story',
  photo_url: 'photo_url',
  photos_json: 'photos_json',
  links_json: 'links_json',
  blocks_json: 'blocks_json',
};

// Approve on an 'edit' row normally copies proposed_json's fields onto
// the live dots_alumni row verbatim -- but the review screen
// (src/admin/dots-edits.njk) lets staff adjust the proposed fields right
// there before approving, so an optional `fields` object in the request
// body overrides the stored proposal entirely with whatever staff left
// in the editor. blocks_json isn't part of that override -- the page
// builder that produced it is retired, so any edit that goes through
// this review screen always ends up flat-fields-only (see proposeEdit.js
// nulling it in every new proposal). Approve on a 'delete' row (see
// functions/api/dots-alumni/request-deletion.js) deletes it outright,
// same FK-safe order as the direct admin delete in functions/api/admin/
// dots-alumni/[id].js. Reject just closes the review out either way --
// the live entry (or lack of one) is untouched. Neither ever touches
// dots_alumni.status -- an edit proposal can't un-publish or re-queue an
// already-published entry, it only changes its content.
export async function onRequestPut({ request, env, params, waitUntil }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body || (body.action !== 'approve' && body.action !== 'reject')) {
      return badRequest("action must be 'approve' or 'reject'");
    }

    const edit = await env.DB.prepare('SELECT * FROM dots_alumni_edits WHERE id = ?').bind(params.id).first();
    if (!edit) return json({ error: 'Not found' }, { status: 404 });
    if (edit.status !== 'pending') return badRequest('This proposal has already been reviewed.');

    if (body.action === 'approve' && edit.type === 'delete') {
      await env.DB.prepare("UPDATE dots_access_codes SET dots_alumni_id = NULL, entry_deleted_at = datetime('now') WHERE dots_alumni_id = ?").bind(edit.alumni_id).run();
      await env.DB.prepare('DELETE FROM dots_alumni_edits WHERE alumni_id = ?').bind(edit.alumni_id).run();
      await env.DB.prepare('DELETE FROM dots_alumni WHERE id = ?').bind(edit.alumni_id).run();
      waitUntil(scheduleRebuild(env));
      return json({ ok: true });
    }

    if (body.action === 'approve') {
      let proposed;
      if (body.fields && typeof body.fields === 'object') {
        const f = body.fields;
        const name = String(f.name || '').trim().slice(0, 100);
        const bio = String(f.bio || '').trim().slice(0, 600);
        if (!name) return badRequest('Name is required.');
        if (!bio) return badRequest('A short bio is required.');
        proposed = {
          name,
          pronouns: (String(f.pronouns || '').trim().slice(0, 30)) || null,
          current_role: (String(f.current_role || '').trim().slice(0, 120)) || null,
          location: (String(f.location || '').trim().slice(0, 80)) || null,
          quote: (String(f.quote || '').trim().slice(0, 300)) || null,
          bio,
          story: (String(f.story || '').trim().slice(0, 4000)) || null,
          photo_url: String(f.photo_url || '').trim().slice(0, 500),
          photos_json: JSON.stringify(Array.isArray(f.photos) ? f.photos.filter((u) => typeof u === 'string' && u).slice(0, 6) : []),
          links_json: JSON.stringify(Array.isArray(f.links) ? f.links : []),
          blocks_json: null,
        };
      } else {
        try { proposed = JSON.parse(edit.proposed_json); } catch { return badRequest('Stored proposal is corrupt'); }
      }

      const sets = [];
      const values = [];
      for (const [key, col] of Object.entries(PROPOSED_FIELD_MAP)) {
        if (!(key in proposed)) continue;
        sets.push(`${col} = ?`);
        values.push(proposed[key] === undefined ? null : proposed[key]);
      }
      if (sets.length) {
        values.push(edit.alumni_id);
        await env.DB.prepare(`UPDATE dots_alumni SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
      }
    }

    await env.DB.prepare(
      "UPDATE dots_alumni_edits SET status = ?, reviewed_at = datetime('now') WHERE id = ?",
    ).bind(body.action === 'approve' ? 'approved' : 'rejected', params.id).run();

    if (body.action === 'approve') waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
